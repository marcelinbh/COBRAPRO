import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

it.each([false, true])('PG17 privado perfil renovacao=%s: timeout, cotação expirada, principal inválido, NOT_FOUND e fence atrasado', async renewal => {
  const root = mkdtempSync(`${tmpdir()}/financial-intent-pg17-`), bin = '/usr/lib/postgresql/17/bin';
  mkdirSync(`${root}/socket`, { mode: 0o700 });
  const env = { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', HOME: root };
  const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { env, encoding: 'utf8' });
  const clients: pg.Client[] = []; const evidence: string[] = [];
  const connect = async (role?: string) => { const c = new pg.Client({ host: `${root}/socket`, port: 55443, user: run('/usr/bin/id', ['-un']).trim(), database: 'postgres' }); await c.connect(); clients.push(c); if (role) await c.query(`SET ROLE ${role}`); return c; };
  let started = false;
  try {
    run(`${bin}/initdb`, ['-D', `${root}/data`, '-A', 'trust', '--no-locale', '-E', 'UTF8']);
    run(`${bin}/pg_ctl`, ['-D', `${root}/data`, '-l', `${root}/postgres.log`, '-o', `-k ${root}/socket -p 55443 -c listen_addresses='' -c unix_socket_permissions=0700`, '-w', 'start']); started = true;
    const db = await connect();
    expect((await db.query('SHOW server_version')).rows[0].server_version).toMatch(/^17\./);
    expect((await db.query('SHOW listen_addresses')).rows[0].listen_addresses).toBe('');
    for (const f of ['tests/postgres-loans/fixture.sql', 'tests/postgres-financial-coexistence/fixture.sql', 'drizzle/0020_rpc_despesas_prospectivas.sql', 'drizzle/0021_rpc_emprestimos_prospectivos.sql', 'drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql', 'drizzle/0025_integrar_rpc_despesas_ciclo.sql']) await db.query(readFileSync(f, 'utf8'));
    const financialTables = ['contas_caixa','contratos','parcelas','contas_pagar','transacoes_caixa','contrato_historico'];
    const financialState = async () => { const rows: Record<string, unknown> = {}; for (const t of financialTables) rows[t] = (await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) s FROM public.${t} t`)).rows[0].s; return rows; };
    const beforeInstall = await financialState();
    if (renewal) await db.query(readFileSync('drizzle/0031_rpc_renovacao_juros_prospectiva.sql', 'utf8'));
    const predecessor = (await db.query("SELECT oid,proname,prosrc,proacl,proargdefaults::text FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('rpc_criar_emprestimo','rpc_receber_emprestimo_prospectivo','rpc_criar_despesa_prospectiva','rpc_pagar_despesa_prospectiva','rpc_estornar_despesa_prospectiva') ORDER BY proname")).rows;
    await db.query(readFileSync('drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql', 'utf8'));
    expect(await financialState()).toEqual(beforeInstall);
    for (const original of predecessor) {
      const preserved = (await db.query('SELECT oid,proname,prosrc,proargdefaults::text,has_function_privilege(\'service_role\',oid,\'EXECUTE\') exposed FROM pg_proc WHERE oid=$1', [original.oid])).rows[0];
      expect(preserved).toEqual({ oid: original.oid, proname: `financial_intent_original_${original.proname}`, prosrc: original.prosrc, proargdefaults: original.proargdefaults, exposed: false });
    }
    evidence.push(`PASS perfil ${renewal ? '0025+0031' : '0025'}: instalação sem escrita e cinco corpos/defaults/OIDs preservados`);
    const a = await connect('service_role'), b = await connect('service_role');
    const body = { clienteId: 1, contaCaixaId: 1, modalidade: 'mensal', tipoTaxa: 'mensal', valorPrincipal: '100.00', taxaJuros: '10.00', numeroParcelas: 1, dataInicio: '2026-01-01', dataDesembolso: '2026-01-01', vencimentos: ['2090-01-01'] };
    const sqlCreate = 'SELECT public.rpc_criar_emprestimo($1::int,$2::uuid,$3::int,$4::int,$5::text,$6::text,$7::numeric,$8::numeric,$9::int,$10::date,$11::date,$12::date[],$13::text,$14::text) r';
    const create = async (key: string, p = body, c = a) => (await c.query(sqlCreate, [1, key, p.clienteId, p.contaCaixaId, p.modalidade, p.tipoTaxa, p.valorPrincipal, p.taxaJuros, p.numeroParcelas, p.dataInicio, p.dataDesembolso, p.vencimentos, null, null])).rows[0].r;
    const rec = async (family: string, key: string, p: unknown, c = b) => (await c.query('SELECT public.rpc_reconciliar_intencao_financeira($1,$2,$3,$4) r', [1, family, key, p])).rows[0].r;
    const state = async () => {
      const out: Record<string, unknown> = {};
      for (const t of ['contas_caixa','contratos','parcelas','contas_pagar','transacoes_caixa','contrato_historico','emprestimos_rpc_operacoes','ciclo_operacoes','despesas_rpc_operacoes','ciclo_pernas']) out[t] = (await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) s FROM public.${t} t`)).rows[0].s;
      return out;
    };
    const waitLock = async (c: pg.Client) => {
      for (let n = 0; n < 150; n++) { if ((await db.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [c.processID])).rows[0]?.wait_event_type === 'Lock') return; await new Promise(r => setTimeout(r, 10)); }
      throw new Error('Espera real não observada');
    };
    // COMMIT sem entregar resultado ao consumidor; reconciliar espera a transação e confirma.
    const committedKey = randomUUID(); await a.query('BEGIN'); const committed = await create(committedKey);
    const pendingRec = rec('emprestimo_criar', committedKey, body); await waitLock(b); await a.query('COMMIT');
    const r = await pendingRec; expect(r.status).toBe('confirmed'); expect(r.result).toEqual(committed);
    expect(await create(committedKey)).toEqual({ ...committed, repetida: true });
    evidence.push('PASS timeout old response: reconciliação esperou COMMIT e replay retornou mesmo operationId');
    await expect(rec('emprestimo_criar', committedKey, { ...body, valorPrincipal: '101.00' })).rejects.toMatchObject({ code: '23514' });
    // SELECT ausente não impede execução. Fence do mesmo UUID torna POST futuro impossível.
    const delayedKey = randomUUID(), beforeDelayed = await state();
    expect((await db.query('SELECT id FROM emprestimos_rpc_operacoes WHERE chave_idempotencia=$1 LIMIT 1', [delayedKey])).rowCount).toBe(0);
    const fenced = await rec('emprestimo_criar', delayedKey, body); expect(fenced.status).toBe('not_executed'); expect(fenced.fenceId).toMatch(/^[a-f0-9-]{36}$/);
    await expect(create(delayedKey)).rejects.toMatchObject({ code: '55000' }); expect(await state()).toEqual(beforeDelayed);
    expect(await rec('emprestimo_criar', delayedKey, body)).toEqual(fenced);
    await expect(rec('emprestimo_criar', delayedKey, { ...body, valorPrincipal: '101.00' })).rejects.toMatchObject({ code: '23505' });
    evidence.push('PASS absent SELECT isolado não é usado: UUID fenced bloqueia POST atrasado sem efeito financeiro');
    const invalidKey = randomUUID(), invalid = { ...body, valorPrincipal: '0.00' }, beforeInvalid = await state();
    await expect(create(invalidKey, invalid)).rejects.toMatchObject({ code: '22023' });
    expect((await rec('emprestimo_criar', invalidKey, invalid)).status).toBe('not_executed');
    await expect(create(invalidKey, invalid)).rejects.toMatchObject({ code: '55000' }); expect(await state()).toEqual(beforeInvalid);
    evidence.push('PASS saved invalid principal: 22023 sem side effects, reconciliação fenced recuperável');
    const q = (await a.query('SELECT public.rpc_cotar_emprestimo_prospectivo(1,$1,$2) q', [committed.id, committed.parcelasIds[0]])).rows[0].q;
    const receipt = { contratoId: q.contratoId, parcelaId: q.parcelaId, valorRecebido: q.totalExigido, totalExigido: q.totalExigido, dataPagamento: q.dataPagamento, estadoHash: q.estadoHash, modo: 'integral' };
    const receive = async (key: string, p = receipt, c = a) => (await c.query('SELECT public.rpc_receber_emprestimo_prospectivo(1,$1,$2,$3,$4,$5,$6,$7,$8,NULL) r', [key, p.contratoId, p.parcelaId, p.valorRecebido, p.totalExigido, p.dataPagamento, p.estadoHash, p.modo])).rows[0].r;
    // Pagamento concorrente altera o snapshot: segunda intenção aguarda e recusa cotação antiga.
    const firstKey = randomUUID(), expiredKey = randomUUID(); await a.query('BEGIN'); const payment = await receive(firstKey);
    const expired = receive(expiredKey, receipt, b).then(() => { throw new Error('Não devia aceitar cotação antiga'); }, e => e);
    await waitLock(b); await a.query('COMMIT'); expect((await expired).code).toBe('40001');
    const afterPayment = await state(); const expiredProof = await rec('emprestimo_receber', expiredKey, receipt);
    expect(expiredProof.status).toBe('not_executed'); expect(expiredProof.quote.estadoHash).not.toBe(q.estadoHash); expect(expiredProof.quote.elegivel).toBe(false);
    await expect(receive(expiredKey)).rejects.toMatchObject({ code: '55000' }); expect(await state()).toEqual(afterPayment);
    // Resposta perdida de recebimento retorna persistida antes de cotação hoje diferente.
    expect((await rec('emprestimo_receber', firstKey, receipt)).result).toEqual(payment);
    expect(await receive(firstKey)).toEqual({ ...payment, repetida: true });
    evidence.push('PASS concurrent quote expired: lock real, 40001 rollback, cotação+UUID/hash, uma única entrada');
    const expense = (await a.query("SELECT public.rpc_criar_despesa_prospectiva(1,'Sintética','energia',30.25,'2026-11-10',NULL,$1) r", [randomUUID()])).rows[0].r;
    const payBody = { id: expense.despesaId, contaCaixaId: 3, dataPagamento: '2026-11-10' }, notFoundKey = randomUUID();
    const pay = async (key: string, p = payBody) => (await a.query('SELECT public.rpc_pagar_despesa_prospectiva(1,$1,$2,$3,$4) r', [p.id, p.contaCaixaId, p.dataPagamento, key])).rows[0].r;
    const beforeNF = await state(); await expect(pay(notFoundKey)).rejects.toMatchObject({ code: '42501' }); expect(await state()).toEqual(beforeNF);
    expect((await rec('despesa_pagar', notFoundKey, payBody)).status).toBe('not_executed');
    await expect(pay(notFoundKey)).rejects.toMatchObject({ code: '55000' }); expect(await state()).toEqual(beforeNF);
    // Despesa resposta perdida, confirmação persistida e hash mesmo após conta indisponível.
    const goodKey = randomUUID(), goodBody = { ...payBody, contaCaixaId: 1 }; const good = await pay(goodKey, goodBody);
    expect((await rec('despesa_pagar', goodKey, goodBody)).result).toEqual(good); expect(await pay(goodKey, goodBody)).toEqual(good);
    evidence.push('PASS definite NOT_FOUND no side effects, cannot discard unknown: só fence autoritativo habilita fechamento');
    const reversalKey = randomUUID(), reversalBody = { id: expense.despesaId, pagamentoOperationId: good.operationId, dataEstorno: '2026-11-11', motivo: 'Estorno sintético' };
    const reverse = async () => (await a.query('SELECT public.rpc_estornar_despesa_prospectiva(1,$1,$2,$3,$4,$5) r', [reversalBody.id, reversalBody.pagamentoOperationId, reversalBody.dataEstorno, reversalBody.motivo, reversalKey])).rows[0].r;
    const reversed = await reverse(); expect((await rec('despesa_estornar', reversalKey, reversalBody)).result).toEqual(reversed); expect(await reverse()).toEqual(reversed);
    for (const t of ['ciclo_autorizacoes','ciclo_despesas_autorizacoes', ...(renewal ? ['renovacao_capacidades'] : [])]) expect((await db.query(`SELECT count(*)::int n FROM public.${t}`)).rows[0].n).toBe(0);
    if (renewal) {
      const loan = await create(randomUUID());
      const q = (await a.query('SELECT public.rpc_cotar_renovacao_prospectiva(1,$1,$2) q', [loan.id, loan.parcelasIds[0]])).rows[0].q;
      const key = randomUUID(), args = [key, loan.id, loan.parcelasIds[0], q.totalExigido, q.dataPagamento, q.estadoHash, q.cotacaoHash];
      const sql = 'SELECT public.rpc_renovar_emprestimo_prospectivo(1,$1,$2,$3,$4,$4,$5,$6,$7) r';
      const renewed = (await a.query(sql, args)).rows[0].r;
      expect(renewed.principalAntes).toBe('100.00'); expect(renewed.principalDepois).toBe('100.00'); expect(renewed.principalPago).toBe('0.00');
      expect((await a.query(sql, args)).rows[0].r).toEqual({ ...renewed, repetida: true });
      const successorQuote = (await a.query('SELECT public.rpc_cotar_emprestimo_prospectivo(1,$1,$2) q', [loan.id, renewed.sucessoraId])).rows[0].q;
      const successorBody = { ...receipt, contratoId: loan.id, parcelaId: renewed.sucessoraId, valorRecebido: successorQuote.totalExigido, totalExigido: successorQuote.totalExigido, dataPagamento: successorQuote.dataPagamento, estadoHash: successorQuote.estadoHash };
      const successorKey = randomUUID(), paid = await receive(successorKey, successorBody);
      expect(paid.contratoStatus).toBe('quitado'); expect((await rec('emprestimo_receber', successorKey, successorBody)).result).toEqual(paid);
      evidence.push('PASS 0031+0033: despesa/pagar/estornar na conta protegida e renovação/replay/sucessor conservam principal');
    }
    // Fencer começa antes do POST: segunda transação espera barreira; depois rejeita.
    const raceKey = randomUUID(), beforeRace = await state(); await a.query('BEGIN'); await rec('emprestimo_criar', raceKey, body, a);
    const late = create(raceKey, body, b).then(() => { throw new Error('POST fenced executou'); }, e => e);
    await waitLock(b); await a.query('COMMIT'); expect((await late).code).toBe('55000'); expect(await state()).toEqual(beforeRace);
    evidence.push('PASS fence concurrent-before-POST: espera real, 55000 e estado financeiro intacto');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const c = await connect(role);
      await expect(c.query('SELECT * FROM public.financial_intent_fences LIMIT 1')).rejects.toMatchObject({ code: '42501' });
      await expect(c.query('SELECT public.financial_intent_original_rpc_criar_emprestimo(1,$1,1,1,\'mensal\',\'mensal\',100,10,1,\'2026-01-01\',\'2026-01-01\',ARRAY[\'2090-01-01\']::date[],NULL,NULL)', [randomUUID()])).rejects.toMatchObject({ code: '42501' });
      if (role !== 'service_role') await expect(rec('emprestimo_criar', randomUUID(), body, c)).rejects.toMatchObject({ code: '42501' });
    }
    evidence.push('PASS ACL/RLS: nenhuma bypass RPC original ou fence editável pelo backend');
    const beforeReinstall = await state();
    await expect(db.query(readFileSync('drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql','utf8'))).rejects.toMatchObject({ code: '55000' }); await db.query('ROLLBACK');
    expect(await state()).toEqual(beforeReinstall);
    if (renewal) { await expect(db.query(readFileSync('drizzle/0031_rpc_renovacao_juros_prospectiva.sql','utf8'))).rejects.toMatchObject({ code: 'P0001' }); await db.query('ROLLBACK'); expect(await state()).toEqual(beforeReinstall); }
    evidence.push('PASS one-shot: reaplicação recusada integralmente sem escrita financeira');
  } finally {
    await Promise.all(clients.map(c => c.end().catch(() => {})));
    if (started) {
      run(`${bin}/pg_ctl`, ['-D', `${root}/data`, '-m', 'fast', '-w', 'stop']);
      let status = 0; try { run(`${bin}/pg_ctl`, ['-D', `${root}/data`, 'status']); } catch (e) { status = (e as { status: number }).status; }
      expect(status).toBe(3); evidence.push('STOP_EXIT=0 FINAL_STATUS=3');
    }
    writeFileSync(`${root}/evidence.log`, evidence.join('\n') + '\n'); console.log(`FINANCIAL_INTENT_EVIDENCE=${root}/evidence.log\n${evidence.join('\n')}`);
  }
}, 120000);
