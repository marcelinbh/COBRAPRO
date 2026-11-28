import { useEffect, useMemo, useRef, useState } from 'react';
import { hashKey } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { diaCivilBrt, dinheiroDespesa, moedaDespesa } from '../../../shared/despesasIntent';
import { dataOcorrencia68, template68, validarProof68, type Request68, type Serie68 } from '../../../shared/despesasRecorrencia68';
import { DespesasRecorrencia68Journal, type Journal68 } from '@/lib/despesasRecorrencia68Journal';
let generation68 = 0;
const categories = ['aluguel', 'energia', 'agua', 'internet', 'telefone', 'salario', 'imposto', 'fornecedor', 'outros'] as const;
const fresh = () => ({ descricao: '', categoria: 'outros' as typeof categories[number], valor: '', observacoes: '' });
export default function RecorrenciaDespesas68({ userId, refreshToken }: { userId: number; refreshToken?: number }) {
  const session = useMemo(() => ({ owner: userId, generation: ++generation68, closed: false }), [userId]);
  const now = useRef(session); now.current = session;
  const valid = () => now.current === session && !session.closed;
  const [ready, setReady] = useState(session);
  const [pending, setPending] = useState<Journal68 | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false); const flight = useRef(false);
  const [form, setForm] = useState(fresh);
  const [ancora, setAncora] = useState(diaCivilBrt);
  const [frequencia, setFrequencia] = useState<'mensal' | 'semanal' | 'quinzenal' | 'anual'>('mensal');
  const [termino, setTermino] = useState('');
  const [selected, setSelected] = useState<Serie68 | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [fenced, setFenced] = useState(false);
  const journal = useMemo(() => {
    let storage = null; let locks;
    try { storage = window.sessionStorage; locks = navigator.locks; } catch { /* no memory fallback */ }
    return new DespesasRecorrencia68Journal(userId, storage, locks, valid);
  }, [session]);
  function inventory() {
    try { const original = journal.read(); setPending(original); setFenced(original !== null && journal.knownProof(original)?.status === 'not_executed'); setBlocked(false); } catch { setBlocked(true); setMessage('Original68/persistência inconclusiva. Releia sem apagar os bytes.'); }
  }
  useEffect(() => {
    session.closed = false; setPending(null); setMessage(''); setBusy(false); flight.current = false;
    setForm(fresh()); setSelected(null); setAfter(null); setAncora(diaCivilBrt()); setTermino(''); setFenced(false); inventory(); setReady(session);
    return () => { session.closed = true; };
  }, [session, journal]);
  const options = useMemo(() => ({ retry: false, gcTime: 0, initialData: undefined, placeholderData: undefined, queryKeyHashFn: (key: readonly unknown[]) => hashKey(['despesas68', session.generation, userId, key]), trpc: { abortOnUnmount: true } }), [session]);
  const query = trpc.despesasRecorrencia68.listar.useQuery({ after }, options);
  const write = trpc.despesasRecorrencia68.configurar.useMutation({ retry: false });
  const recover = trpc.despesasRecorrencia68.recuperar.useMutation({ retry: false });
  const utils = trpc.useUtils();
  // Edição49 invalida a lista20; o pai repassa dataUpdatedAt para atualizar linhagem68.
  useEffect(() => { if (valid() && refreshToken !== undefined) void query.refetch(); }, [refreshToken, session]);
  const data = !query.isError && query.data?.userId === userId ? query.data : undefined;
  const writable = valid() && ready === session && !!data && !busy && !blocked && !pending;
  const target = selected;
  function reset() { setSelected(null); setForm(fresh()); setMessage(''); }
  async function send(j: Journal68, recovery: boolean) {
    if (!valid() || flight.current || (!recovery && (fenced || !data))) return;
    flight.current = true; setBusy(true);
    try {
      await journal.run(j, async () => {
        const raw = await (recovery ? recover : write).mutateAsync(j.input);
        if (!valid()) return;
        journal.assertCurrent(j);
        const proof = validarProof68(raw, userId, j.input);
        if (proof.status === 'not_executed') setFenced(true);
        if (journal.closeInsideLock(j, proof)) {
          setPending(null); setFenced(false); reset();
          setMessage(proof.status === 'confirmed' ? 'Configuração68 confirmada. Despesas já geradas e Caixa não foram alterados.' : 'Não execução comprovada; UUID terminal encerrada. Escolha uma nova operação explicitamente.');
        }
        // Consulta falha NÃO desfaz confirmação, nem repete a configuração.
        if (valid()) void Promise.allSettled([query.refetch(), utils.contasPagar.listar.invalidate(), utils.contasPagar.resumo.invalidate()]);
      });
    } catch (e) { if (valid()) setMessage(`${(e as Error).message} Original68 mantido; reenvio exato ou recovery.`); }
    finally { if (valid()) { flight.current = false; setBusy(false); inventory(); } }
  }
  async function prepare(request: Request68) {
    if (!writable || flight.current) return;
    try {
      const j = await journal.prepare(request);
      if (!valid()) return; setPending(j); setMessage(''); void send(j, false);
    } catch (e) { if (valid()) { setMessage((e as Error).message); inventory(); } }
  }
  function save() {
    if (!writable) return;
    try {
      const t = template68.parse({ ...form, descricao: form.descricao.trim(), valor: dinheiroDespesa(form.valor.replace(',', '.')) ?? form.valor });
      if (selected) {
        if (!target) throw Error('Série não encontrada nesta consulta.');
        void prepare({ action: 'alterar', serieId: target.serieId, expectedRevision: target.revision, effectiveOrdinal: target.futureOrdinal, template: t });
      } else void prepare({ action: 'criar', template: t, ancora, frequencia, termino: termino || null });
    } catch (e) { setMessage((e as Error).message); }
  }
  let preview: string[] = [];
  try { preview = [0, 1, 2].map(n => dataOcorrencia68(ancora, frequencia, n)); } catch { /* invalid input: no invented preview */ }
  if (ready !== session) return <p role="status">Atualizando sessão68...</p>;
  return <section aria-label="Séries de despesas68" className="border rounded-lg p-4 space-y-3">
    <h2 className="font-semibold">Despesas recorrentes: configurar próximas competências</h2>
    <p className="text-sm">Cada ocorrência nasce pendente com origem20 e sem movimento de Caixa. Pagamento é manual. Editar uma ocorrência49/69 não altera a série; o template abaixo só vale para competências futuras ainda não geradas. Frequência, âncora e término são imutáveis: encerre e cadastre uma nova série se necessário.</p>
    {!data ? <p role={query.isError ? 'alert' : 'status'}>{query.isError ? 'Consulta68 indisponível, não é lista vazia nem geração confirmada.' : 'Consultando séries68...'}</p> : <p role="status">Agenda: {!data.agenda.vinculada ? 'aguardando vínculo dedicado pelo operador; você já pode configurar séries' : !data.agenda.ativa ? 'pausada pelo operador' : `ativa; último resultado ${data.agenda.resultado}`}. Última execução: {data.agenda.ultimaExecucao ?? 'ainda não observada'}.</p>}
    <Button variant="outline" disabled={busy} onClick={() => { inventory(); void query.refetch(); }}>Reconsultar séries e persistência</Button>
    {message && <p role="alert">{message}</p>}
    {pending ? <div className="space-y-2"><p className="break-all">UUID original68: {pending.input.idempotencyKey}</p><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(pending.input, null, 2)}</pre>
      <Button disabled={busy} onClick={() => void send(pending, true)}>Recuperar e encerrar com prova68</Button>
      <Button disabled={busy || fenced || !data} variant="outline" onClick={() => void send(pending, false)}>Reenviar configuração original68</Button>
    </div> : <div className="space-y-2">
      <h3>{target ? `Alterar somente futuras da série ${target.serieId}` : 'Nova série (opt-in explícito)'}</h3>
      <label htmlFor="serie68-descricao">Descrição</label><Input id="serie68-descricao" disabled={!writable} maxLength={255} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
      <label htmlFor="serie68-valor">Valor decimal exato</label><Input id="serie68-valor" disabled={!writable} inputMode="decimal" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
      <label htmlFor="serie68-categoria">Categoria</label><select id="serie68-categoria" disabled={!writable} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value as typeof form.categoria })}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
      <label htmlFor="serie68-obs">Observações</label><Textarea id="serie68-obs" disabled={!writable} maxLength={10000} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
      {!selected ? <><label htmlFor="serie68-frequencia">Frequência civil BRT</label><select id="serie68-frequencia" disabled={!writable} value={frequencia} onChange={e => setFrequencia(e.target.value as typeof frequencia)}>{['mensal', 'semanal', 'quinzenal', 'anual'].map(f => <option key={f} value={f}>{f}</option>)}</select>
        <label htmlFor="serie68-ancora">Primeira competência (não retroativa)</label><Input id="serie68-ancora" disabled={!writable} type="date" value={ancora} onChange={e => setAncora(e.target.value)} />
        <label htmlFor="serie68-termino">Término opcional</label><Input id="serie68-termino" disabled={!writable} type="date" value={termino} onChange={e => setTermino(e.target.value)} />
        <p>Prévia civil: {preview.length ? preview.join(' → ') : 'informe uma âncora válida'}. Semanal = 7 dias; quinzenal = 15 dias.</p></> : <p>Vigência: ordinal {target?.futureOrdinal}, revisão esperada {target?.revision}. Backlog anterior mantém seu template original.</p>}
      <Button disabled={!writable} onClick={save}>{selected ? 'Confirmar template só futuro68' : 'Cadastrar série recorrente68'}</Button>
      {selected && <Button variant="outline" disabled={busy} onClick={reset}>Voltar para nova série</Button>}
    </div>}
    {data?.series.map(s => <article key={s.serieId} className="border rounded p-3 space-y-2">
      <h3>{s.template.descricao} · {moedaDespesa(s.template.valor)} · {s.frequencia}</h3>
      <p className="text-sm break-all">Série {s.serieId} · {s.estado} · revisão {s.revision} · próxima competência {s.nextDate ?? 'encerrada'} ({s.nextOrdinal}). {s.backlog ? 'Backlog pendente: será recuperado em lotes limitados.' : ''} {s.failure ? 'Último lote falhou; nenhuma confirmação financeira presumida.' : ''}</p>
      {s.skipped.length > 0 && <p>Intervalos de pausa ignorados explicitamente: {s.skipped.map(i => `[${i.from}, ${i.toExclusive})`).join(', ')}.</p>}
      {s.estado !== 'encerrada' && <><Button disabled={!writable} variant="outline" onClick={() => { setSelected(s); setForm(s.template); setMessage(''); }}>Alterar próximas desta série</Button>
        <Button disabled={!writable} variant="outline" onClick={() => { if (window.confirm(s.estado === 'ativa' ? 'Pausar geração futura? Despesas existentes não mudam.' : 'Retomar somente a primeira competência posterior a hoje? Competências não geradas durante a pausa serão registradas como ignoradas, sem retroativo.')) void prepare({ action: s.estado === 'ativa' ? 'pausar' : 'retomar', serieId: s.serieId, expectedRevision: s.revision }); }}>{s.estado === 'ativa' ? 'Pausar série' : 'Retomar sem retroativo'}</Button>
        <Button disabled={!writable} variant="outline" onClick={() => { if (window.confirm('Encerrar definitivamente esta série, sem excluir despesas já geradas?')) void prepare({ action: 'encerrar', serieId: s.serieId, expectedRevision: s.revision }); }}>Encerrar série</Button></>}
      {data.ocorrencias.filter(o => o.serieId === s.serieId).map(o => <p key={o.ordinal} className="text-sm">Competência {o.competencia} · ordinal {o.ordinal} · raiz #{o.rootId} · {o.status === 'UNKNOWN' ? 'linhagem requer conferência (UNKNOWN)' : `despesa atual #${o.currentId} (${o.status})`}. A edição atua somente nesta ocorrência; cancelamento não a regenera.</p>)}
    </article>)}
    {data && data.series.length === 0 && <p>Nenhuma série nesta página. Histórico recorrente não é ativado automaticamente.</p>}
    {after && <Button disabled={busy} variant="outline" onClick={() => { reset(); setAfter(null); }}>Primeira página de séries</Button>}
    {data?.hasMore && <Button disabled={busy} variant="outline" onClick={() => { reset(); setAfter(data.series.at(-1)!.serieId); }}>Próxima página de séries</Button>}
  </section>;
}
