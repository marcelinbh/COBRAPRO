import { useEffect, useMemo, useRef, useState } from 'react';
import { hashKey } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { edicao49Request, validarQuote49, validarRecibo49, validarRecovery49, type Edicao49Request } from '../../../shared/despesas49';
import { isOwnedKey38 } from '../../../shared/despesas38Original';
import { CancelamentoPendenteStore } from '../../../shared/despesaCancelamentoPendente';
import { Despesas49Journal, type Journal49 } from '@/lib/despesas49Journal';
let generation49 = 0;
type Item49 = { id: number; descricao: string; podePagar: boolean };
export type OriginaisRevision49 = { userId: number; revision: number };
export type SelecaoEdicao49 = OriginaisRevision49 & { despesaId: number };
type Terminal49 = { raw: string; status: 'confirmed' | 'not_executed' };
const categories = ['aluguel', 'energia', 'agua', 'internet', 'telefone', 'salario', 'imposto', 'fornecedor', 'outros'] as const;
export default function EdicaoDespesa49({ userId, itens, originaisRevision, selecao }: { userId: number; itens: Item49[]; originaisRevision?: OriginaisRevision49; selecao?: SelecaoEdicao49 | null }) {
  const session = useMemo(() => ({ owner: userId, generation: ++generation49, closed: false }), [userId]);
  const now = useRef(session); now.current = session;
  const valid = () => now.current === session && !session.closed;
  const [ready, setReady] = useState(session);
  const [pending, setPending] = useState<Journal49 | null>(null);
  const knownPending = useRef<Journal49 | null>(null);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState<Edicao49Request | null>(null);
  const [quotedForm, setQuotedForm] = useState<Edicao49Request | null>(null);
  const [quoteValue, setQuoteValue] = useState('');
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  // Texto recuperável nunca é autorização. Inventário e persistência têm estados próprios.
  const [message, setMessage] = useState('');
  const [inventoryBlocked, setInventoryBlocked] = useState('');
  const [persistenceUncertain, setPersistenceUncertain] = useState('');
  const [terminal, setTerminal] = useState<Terminal49 | null>(null);
  const terminalRef = useRef<Terminal49 | null>(null);
  const handledSelection = useRef<SelecaoEdicao49 | null>(null);
  const journal = useMemo(() => {
    let storage = null; let locks;
    try { storage = window.sessionStorage; locks = navigator.locks; } catch { /* fail closed */ }
    return new Despesas49Journal(userId, storage, locks, valid);
  }, [session]);
  function exigirOriginaisEncerrados() {
    const storage = window.sessionStorage;
    const size = storage.length;
    if (!Number.isSafeInteger(size) || size < 0 || size > 100000) throw new Error('Inventário de originais inconclusivo.');
    const keys = new Set<string>();
    for (let i = 0; i < size; i++) {
      const key = storage.key(i);
      if (!valid() || key === null || keys.has(key)) throw new Error('Sessão/inventário mudou.');
      keys.add(key);
      // Apenas nomes do owner: não ler, converter nem apagar originais20/38 opacos.
      if (isOwnedKey38(key, userId) || key.startsWith(`cobrapro:despesas:0020:v1:user:${userId}:action:`)) throw new Error('Original20/38 retido. Recupere o pedido exato no fluxo original antes de preparar49. Original38 exige recuperação38 própria.');
    }
    if (storage.length !== size) throw new Error('Inventário mudou.');
    const previous = new CancelamentoPendenteStore(userId, storage);
    if (previous.read() || previous.blocked) throw new Error('Original38c retido ou inconclusivo. Encerre com prova própria antes de preparar49.');
  }
  function revalidarInventario(): boolean {
    if (!valid()) return false;
    try { exigirOriginaisEncerrados(); setInventoryBlocked(''); return true; }
    catch (e) { if (valid()) setInventoryBlocked((e as Error).message); return false; }
  }
  /** Descoberta protegida também após write-then-throw; leitura falha não significa ausência. */
  function relerJournal(): Journal49 | null | undefined {
    if (!valid()) return undefined;
    try {
      const j = journal.read();
      if (!valid()) return undefined;
      if (!j && knownPending.current) throw new Error('Original49 conhecido desapareceu sem fechamento CAS comprovado.');
      knownPending.current = j;
      setPending(j);
      if (terminalRef.current?.raw !== j?.raw) { terminalRef.current = null; setTerminal(null); }
      const proof = j ? journal.readProof(j) : null;
      if (proof && j) { const t: Terminal49 = { raw: j.raw, status: proof.status }; terminalRef.current = t; setTerminal(t); }
      setPersistenceUncertain(''); return j;
    } catch (e) {
      if (valid()) setPersistenceUncertain(`Persistência49 inconclusiva: ${(e as Error).message} Revalide a leitura; nenhum POST ou UUID novo permitido.`);
      return undefined; // Manter pending conhecido; nunca apresentar falha como inventário vazio.
    }
  }
  function revalidarLocal() {
    const j = relerJournal();
    // Recovery49 não depende de outros writers. Só consultar o store38c quando
    // for possível preparar uma próxima intenção, sem latch incidental por erro49.
    if (j === null) revalidarInventario();
  }
  useEffect(() => {
    session.closed = false; setSelected(''); setForm(null); setQuotedForm(null); setQuoteValue(''); setMessage(''); setBusy(false); flight.current = false;
    terminalRef.current = null; setTerminal(null); handledSelection.current = null; knownPending.current = null; setPending(null);
    revalidarLocal(); setReady(session);
    return () => { session.closed = true; };
  }, [session, journal]);
  // Um evento só pede releitura; não é prova nem ignora um original ainda retido.
  useEffect(() => {
    if (ready === session && originaisRevision?.userId === userId && !flight.current) revalidarLocal();
  }, [session, ready, originaisRevision?.userId, originaisRevision?.revision]);
  const options = useMemo(() => ({ retry: false, gcTime: 0, initialData: undefined, placeholderData: undefined, queryKeyHashFn: (key: readonly unknown[]) => hashKey(['despesas49', session.generation, userId, key]), trpc: { abortOnUnmount: true } }), [session]);
  const cap = trpc.despesas49.capacidades.useQuery(undefined, options);
  const quote = trpc.despesas49.cotar.useMutation({ retry: false });
  const edit = trpc.despesas49.editar.useMutation({ retry: false });
  const recovery = trpc.despesas49.recuperar.useMutation({ retry: false });
  const utils = trpc.useUtils();
  const writerOn = cap.data?.habilitado === true && !cap.isError && !cap.isLoading && !cap.isFetching;
  const writerCurrent = useRef(writerOn); writerCurrent.current = writerOn;
  const canWrite = valid() && ready === session && writerOn && !busy && !pending && !inventoryBlocked && !persistenceUncertain;
  const writeCurrent = useRef(canWrite); writeCurrent.current = canWrite;
  const hasDelta = !!form && !!quotedForm && (form.descricao.trim() !== quotedForm.descricao || form.categoria !== quotedForm.categoria || form.dataVencimento !== quotedForm.dataVencimento || form.observacoes !== quotedForm.observacoes);
  async function cotar(id = Number(selected)) {
    if (!valid() || !writeCurrent.current || flight.current || !itens.some(i => i.id === id && i.podePagar)) return;
    if (relerJournal() !== null || !revalidarInventario()) return;
    flight.current = true; setBusy(true); setMessage(''); setForm(null); setQuotedForm(null);
    try {
      const q = validarQuote49(await quote.mutateAsync({ despesaId: id }), userId, id);
      if (!valid()) return;
      if (!q.habilitado) throw new Error('Edição49 desabilitada no banco; reconsulte a disponibilidade.');
      const snapshot: Edicao49Request = { despesaId: id, origemOperationId: q.origemOperationId, estadoHash: q.estadoHash, descricao: String(q.original.descricao), categoria: q.original.categoria as Edicao49Request['categoria'], dataVencimento: String(q.original.data_vencimento), observacoes: String(q.original.observacoes ?? ''), motivo: '' };
      setSelected(String(id)); setQuoteValue(q.valor); setQuotedForm(snapshot); setForm(snapshot);
    } catch (e) { if (valid()) setMessage(`${(e as Error).message} Corrija/reconsulte e cote novamente; nenhuma intenção foi preparada.`); }
    finally { if (valid()) { setBusy(false); flight.current = false; } }
  }
  useEffect(() => {
    if (!valid() || ready !== session || !selecao || selecao.userId !== userId || handledSelection.current === selecao) return;
    handledSelection.current = selecao;
    if (pending || flight.current) { setMessage('Encerre a intenção original49 com prova antes de selecionar outra edição.'); return; }
    if (!itens.some(i => i.id === selecao.despesaId && i.podePagar)) { setMessage('Despesa selecionada não elegível na consulta atual; refaça a lista.'); return; }
    setSelected(String(selecao.despesaId)); setForm(null); setQuotedForm(null);
    if (canWrite) void cotar(selecao.despesaId);
    else setMessage('Despesa selecionada. Revalide disponibilidade/inventário e clique em Cotar edição pendente49.');
  }, [session, ready, selecao]);
  async function reconsultar() {
    if (!valid() || flight.current) return;
    flight.current = true; setBusy(true);
    revalidarLocal();
    try { await cap.refetch(); }
    catch { if (valid()) setMessage('Não foi possível reconsultar a disponibilidade49. Tente novamente; nenhuma escrita foi feita.'); }
    finally { if (valid()) { revalidarLocal(); setBusy(false); flight.current = false; } }
  }
  async function send(j: Journal49, recover: boolean, close = false) {
    if (!valid() || flight.current || persistenceUncertain || (!recover && (!writerCurrent.current || terminalRef.current?.raw === j.raw))) return;
    flight.current = true; setBusy(true);
    try {
      await journal.run(j, async () => {
        // Revalidar também sob o lock; mensagens e capability OFF não impedem recovery.
        if (!valid() || (!recover && (!writerCurrent.current || terminalRef.current?.raw === j.raw))) return;
        if (!recover) {
          const saved = journal.readProof(j);
          if (saved) { const t: Terminal49 = { raw: j.raw, status: saved.status }; terminalRef.current = t; setTerminal(t); setMessage('Prova terminal49 preservada. Use recovery/CAS; não reenviar.'); return; }
        }
        const raw = recover ? await recovery.mutateAsync(j.input) : await edit.mutateAsync(j.input);
        if (!valid()) return;
        journal.assertCurrent(j);
        if (recover) {
          const proof = validarRecovery49(raw, userId, j.input);
          const t: Terminal49 = { raw: j.raw, status: proof.status }; terminalRef.current = t; setTerminal(t);
          if (close && journal.closeInsideLock(j, proof)) { knownPending.current = null; setPending(null); setForm(null); setQuotedForm(null); setSelected(''); setMessage(''); }
          else {
            journal.saveProofInsideLock(j, proof);
            setMessage(proof.status === 'confirmed' ? 'Edição confirmada. Encerre com prova para liberar próxima.' : 'UUID terminalmente não executada. Encerre com prova; não reenviar. Depois escolha e cote explicitamente a próxima edição.');
          }
        } else {
          validarRecibo49(raw, userId, j.input);
          const t: Terminal49 = { raw: j.raw, status: 'confirmed' }; terminalRef.current = t; setTerminal(t);
          setMessage('Edição por sucessão20 confirmada, valor inalterado e Caixa zero. Original retido até recovery/CAS.');
        }
        void Promise.allSettled([utils.contasPagar.listar.invalidate(), utils.contasPagar.resumo.invalidate()]);
      });
    } catch (e) { if (valid()) setMessage(`${(e as Error).message} Preserve pedido e UUID originais49. Resultado incerto ou cotação desatualizada: confira/encerre por recovery; só após prova faça nova cotação. Retry usa exclusivamente o pedido original.`); }
    finally { if (valid()) { setBusy(false); flight.current = false; revalidarLocal(); } }
  }
  async function confirmar() {
    if (!valid() || !writeCurrent.current || !form || !hasDelta || flight.current) return;
    const parsed = edicao49Request.safeParse({ ...form, descricao: form.descricao.trim(), motivo: form.motivo.trim() });
    if (!parsed.success) { setMessage('Formulário inválido. Revise descrição, vencimento civil e motivo obrigatório antes de confirmar; nenhum UUID foi criado.'); return; }
    if (relerJournal() !== null || !revalidarInventario()) return;
    flight.current = true; setBusy(true);
    let handedOff = false;
    try {
      const j = await journal.prepare(parsed.data);
      if (!valid()) return;
      knownPending.current = j; setPending(j); flight.current = false; setBusy(false); handedOff = true; void send(j, false);
    } catch (e) {
      if (valid()) {
        setMessage(`${(e as Error).message} Nenhum POST de preparação foi feito. Se o original49 foi gravado, confira/encerre a MESMA UUID.`);
        revalidarLocal();
      }
    } finally { if (valid() && !handedOff) { flight.current = false; setBusy(false); } }
  }
  if (ready !== session) return <p role="status">Atualizando sessão49...</p>;
  return <section id="edicao-despesa49" aria-label="Edição pendente auditada49" className="border rounded-lg p-4 space-y-3">
    <h2 className="font-semibold">Editar despesa pendente com cotação e histórico</h2>
    <p className="text-sm">Somente avulsa prospectiva20 intacta, pendente ou atrasada na apresentação. A original será cancelada logicamente e uma sucessora20 criada na mesma transação, com o mesmo valor. Datas, categoria, descrição e observações podem mudar; baixa e origem originais nunca são reescritas. Não há movimento de Caixa. Valor e recorrência não são editáveis aqui; legado é somente consulta, e pagas oferecem estorno manual no fluxo próprio.</p>
    {cap.isError ? <p role="alert">Erro ao consultar disponibilidade49. Escrita bloqueada; recuperação original continua disponível.</p>
      : cap.isLoading || cap.isFetching || !cap.data ? <p role="status">Consultando disponibilidade49; nenhuma escrita será feita.</p>
        : cap.data.habilitado !== true ? <p role="status">Edição49 desligada no banco (OFF); nenhuma escrita será feita. Recuperação original continua disponível.</p> : null}
    <Button disabled={busy} variant="outline" onClick={() => void reconsultar()}>Reconsultar disponibilidade49 e revalidar inventário</Button>
    <Button disabled={busy} variant="outline" onClick={revalidarLocal}>Revalidar inventário e original49 sem nova UUID</Button>
    {inventoryBlocked && <p role="alert">{inventoryBlocked}</p>}
    {persistenceUncertain && <p role="alert">{persistenceUncertain}</p>}
    {message && <p role="alert">{message}</p>}
    {pending ? <div className="space-y-2"><p className="break-all">UUID original49: {pending.input.idempotencyKey}</p><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(pending.input, null, 2)}</pre>
      {terminal?.raw === pending.raw && <p role="status">{terminal.status === 'not_executed' ? 'Não execução terminal comprovada: reenvio proibido.' : 'Execução confirmada: use recovery/CAS para encerrar o original.'}</p>}
      <Button disabled={busy || !!persistenceUncertain} onClick={() => void send(pending, true, true)}>Encerrar edição com prova terminal e CAS</Button>
      <Button disabled={busy || !!persistenceUncertain} variant="outline" onClick={() => void send(pending, true)}>Conferir UUID original49</Button>
      <Button disabled={busy || !writerOn || !!persistenceUncertain || terminal?.raw === pending.raw} variant="outline" onClick={() => void send(pending, false)}>Reenviar pedido original49</Button>
    </div> : <div className="space-y-2">
      <p className="text-xs">O seletor usa o filtro atual da lista. Para outras pendentes, selecione Todas/Pendentes/Em atraso; a ação Editar por linha apenas seleciona e cota, nunca confirma automaticamente.</p>
      <label htmlFor="edicao49-id">Despesa elegível do owner atual</label><select id="edicao49-id" className="bg-background border p-2 w-full" disabled={!canWrite} value={selected} onChange={e => { setSelected(e.target.value); setForm(null); setQuotedForm(null); }}><option value="">Selecionar</option>{itens.filter(i => i.podePagar).map(i => <option key={i.id} value={i.id}>#{i.id} · {i.descricao}</option>)}</select>
      <Button disabled={!canWrite || !selected} onClick={() => void cotar()}>Cotar edição pendente49</Button>
      {form && <><p>Valor preservado: R$ {quoteValue}. Original #{form.despesaId}; sucessora terá novo ID e origem auditada.</p>
        <label htmlFor="edicao49-descricao">Descrição</label><Input id="edicao49-descricao" disabled={!canWrite} value={form.descricao} maxLength={255} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        <label htmlFor="edicao49-categoria">Categoria</label><select id="edicao49-categoria" disabled={!canWrite} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value as Edicao49Request['categoria'] })}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <label htmlFor="edicao49-data">Vencimento civil</label><Input id="edicao49-data" type="date" disabled={!canWrite} value={form.dataVencimento} onChange={e => setForm({ ...form, dataVencimento: e.target.value })} />
        <label htmlFor="edicao49-obs">Observações</label><Textarea id="edicao49-obs" disabled={!canWrite} maxLength={10000} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
        <label htmlFor="edicao49-motivo">Motivo obrigatório da substituição</label><Textarea id="edicao49-motivo" disabled={!canWrite} maxLength={2000} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
        {!hasDelta && <p role="status">Altere descrição, categoria, vencimento ou observações. Somente motivo não é edição e não cria UUID.</p>}
        <Button disabled={!canWrite || !hasDelta || !form.motivo.trim()} onClick={() => void confirmar()}>Confirmar edição por sucessão20 sem Caixa</Button>
      </>}
    </div>}
  </section>;
}
