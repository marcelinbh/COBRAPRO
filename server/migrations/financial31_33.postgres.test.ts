import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { baselineFunctions, renewalFunctions, assertKnownRenewal, sourceSQL } from './0033.preflight.sources.mjs';

it('PG17 31/33: drift funcional/metadados/ACL, híbridos, ordem inversa e one-shot fail-closed', async () => {
  assertKnownRenewal();
  const root = mkdtempSync(`${tmpdir()}/migrations-31-33-pg17-`), bin = '/usr/lib/postgresql/17/bin';
  mkdirSync(`${root}/socket`, { mode: 0o700 });
  const env = { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', HOME: root };
  const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { env, encoding: 'utf8' });
  const db = new pg.Client({ host: `${root}/socket`, port: 55444, user: run('/usr/bin/id',['-un']).trim(), database: 'postgres' });
  const evidence: string[] = []; let started = false;
  const m31 = readFileSync('drizzle/0031_rpc_renovacao_juros_prospectiva.sql', 'utf8');
  const m33 = readFileSync('drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql', 'utf8');
  try {
    run(`${bin}/initdb`, ['-D',`${root}/data`,'-A','trust','--no-locale','-E','UTF8']);
    run(`${bin}/pg_ctl`, ['-D',`${root}/data`,'-l',`${root}/postgres.log`,'-o',`-k ${root}/socket -p 55444 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']); started = true;
    await db.connect();
    for (const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','drizzle/0020_rpc_despesas_prospectivas.sql','drizzle/0021_rpc_emprestimos_prospectivos.sql','drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql','drizzle/0025_integrar_rpc_despesas_ciclo.sql']) await db.query(readFileSync(f,'utf8'));
    const fingerprint = async () => (await db.query(`SELECT jsonb_build_object(
      'proc',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace),
      'class',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_class c WHERE relnamespace='public'::regnamespace),
      'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE connamespace='public'::regnamespace),
      'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE NOT tgisinternal),
      'legacy',(SELECT jsonb_agg(to_jsonb(c)) FROM public.contratos c WHERE id=900),
      'parcels',(SELECT jsonb_agg(to_jsonb(c)) FROM public.parcelas c WHERE contrato_id=900),
      'ledger',(SELECT jsonb_agg(to_jsonb(c)) FROM public.transacoes_caixa c),
      'expenses',(SELECT jsonb_agg(to_jsonb(c)) FROM public.contas_pagar c)) s`)).rows[0].s;
    const gate = async (name: string, setup: string, migration: string, code: string) => {
      await db.query('BEGIN');
      try {
        await db.query(setup); const before = await fingerprint(); await db.query('SAVEPOINT rejected');
        // O SQL one-shot completo contém BEGIN/COMMIT. Remover SOMENTE delimitadores para
        // executar EXATAMENTE o gate e DDL em savepoint dentro do cenário adversarial.
        await expect(db.query(migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''))).rejects.toMatchObject({ code });
        await db.query('ROLLBACK TO SAVEPOINT rejected'); expect(await fingerprint()).toEqual(before);
        evidence.push(`PASS ${name}: recusado ${code}, catálogo/linhas inalterados`);
      } finally { await db.query('ROLLBACK'); }
    };
    for (const [renewal, sql, code] of [[false,m31,'P0001'],[false,m33,'55000'],[true,m33,'55000']] as const) {
      if (renewal) await db.query(m31);
      const functions = renewal ? [...baselineFunctions.filter(f => !renewalFunctions.some(r => r.proname === f.proname && r.types === f.types)),...renewalFunctions] : baselineFunctions;
      for (const f of functions) {
        const unknown = f.lang === 'plpgsql' ? f.body.replace(/\bBEGIN\b/, "BEGIN\n RAISE EXCEPTION 'drift funcional desconhecido';") : f.result === 'void' ? 'SELECT pg_catalog.pg_sleep(0)' : `SELECT NULL::${f.result}`;
        const changed = f.ddl.replace(/^CREATE (?:OR REPLACE )?FUNCTION/,'CREATE OR REPLACE FUNCTION').replace(f.body, () => unknown);
        await gate(`${renewal?'31':'25'} -> ${sql===m31?'31':'33'} body ${f.proname}(${f.types})`, changed, sql, code);
      }
      for (const [name, setup] of [
        ['overload', "CREATE FUNCTION public.ciclo_autorizar(text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$"],
        ['namespace', "CREATE SCHEMA alternate; CREATE FUNCTION alternate.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$"],
        ['owner', 'ALTER FUNCTION public.ciclo_guardar() OWNER TO service_role'],
        ['acl-short', 'GRANT EXECUTE ON FUNCTION public.ciclo_autorizar(text,integer,integer) TO service_role'],
        ['acl-long', 'GRANT EXECUTE ON FUNCTION public.ciclo_autorizar(text,integer,integer,integer,uuid,numeric,date,text) TO authenticated'],
        ['acl-public', 'GRANT EXECUTE ON FUNCTION public.despesas_rpc_executar(integer,uuid,text,jsonb) TO PUBLIC'],
        ['language-config', 'ALTER FUNCTION public.ciclo_guardar() SET search_path=public'],
        ['volatility', 'ALTER FUNCTION public.ciclo_guardar() STABLE'],
        ['strict', 'ALTER FUNCTION public.ciclo_guardar() STRICT'],
        ['parallel', 'ALTER FUNCTION public.ciclo_guardar() PARALLEL SAFE'],
        ['trigger-off', 'ALTER TABLE transacoes_caixa DISABLE TRIGGER ciclo_ledger'],
        ['trigger-extra', 'CREATE TRIGGER unexpected BEFORE INSERT ON parcelas FOR EACH ROW EXECUTE FUNCTION ciclo_guardar()'],
        ['column-acl', 'GRANT INSERT(acao) ON ciclo_despesas_autorizacoes TO service_role'],
        ['table-acl', 'GRANT SELECT ON ciclo_despesas_autorizacoes TO service_role'],
        ['table-owner', 'ALTER TABLE ciclo_despesas_autorizacoes OWNER TO service_role'],
        ['table-rls', 'ALTER TABLE ciclo_despesas_autorizacoes DISABLE ROW LEVEL SECURITY'],
        ['table-policy', 'CREATE POLICY unexpected ON ciclo_despesas_autorizacoes USING(true)'],
      ]) await gate(`${renewal?'31':'25'} -> ${sql===m31?'31':'33'} ${name}`, setup, sql, code);
      if (!renewal && sql===m33) {
        await gate('híbrido receive31 sem renovação completa',renewalFunctions.find(f=>f.proname==='rpc_receber_emprestimo_prospectivo')!.ddl,m33,'55000');
        await gate('híbrido guard31 sem renovação completa',renewalFunctions.find(f=>f.proname==='ciclo_guardar')!.ddl,m33,'55000');
        await gate('ordem inversa 33 sobre25 antes31',m33.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''),m31,'P0001');
        await gate('homônimo prefixo parcial',"CREATE FUNCTION public.renovacao_unknown() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$",m33,'55000');
        await gate('homônimo fence outro schema',"CREATE SCHEMA alternate; CREATE FUNCTION alternate.financial_intent_unknown() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$",m33,'55000');
      }
      if (renewal) {
        await gate('variante31 com função extra desconhecida',"CREATE FUNCTION public.renovacao_unknown() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$",m33,'55000');
        await gate('variante31 com guard antigo22',sourceSQL['drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql'].match(/CREATE FUNCTION public\.ciclo_guardar\(\)[\s\S]*?\$\$;/)![0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'),m33,'55000');
        await gate('variante31 incompleta receive22',baselineFunctions.find(f=>f.proname==='rpc_receber_emprestimo_prospectivo')!.ddl.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'),m33,'55000');
      }
    }
    await gate('31 reaplicada duas vezes','SELECT 1',m31,'P0001');
    await db.query(m33);
    await gate('33 reaplicada duas vezes','SELECT 1',m33,'55000');
    await gate('31 após33 recusada','SELECT 1',m31,'P0001');
    evidence.push('PASS baseline25 e variante25+31 exatas; nenhuma aceitação individual de corpo desconhecido');
  } finally {
    await db.end().catch(()=>{});
    if (started) { run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-m','fast','-w','stop']); let status=0; try { run(`${bin}/pg_ctl`,['-D',`${root}/data`,'status']); } catch(e) { status=(e as {status:number}).status; } expect(status).toBe(3); evidence.push('STOP_EXIT=0 FINAL_STATUS=3'); }
    writeFileSync(`${root}/evidence.log`,evidence.join('\n')+'\n'); console.log(`MIGRATIONS_31_33_EVIDENCE=${root}/evidence.log\n${evidence.join('\n')}`);
  }
},120000);
