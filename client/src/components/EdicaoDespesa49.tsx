import { useEffect, useMemo, useRef, useState } from 'react';
import { hashKey } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { validarQuote49, validarRecibo49, validarRecovery49, type Edicao49Request } from '../../../shared/despesas49';
import { isOwnedKey38 } from '../../../shared/despesas38Original';
import { CancelamentoPendenteStore } from '../../../shared/despesaCancelamentoPendente';
import { Despesas49Journal, type Journal49 } from '@/lib/despesas49Journal';
let generation49 = 0;
type Item49 = { id: number; descricao: string; podePagar: boolean };
const categories = ['aluguel', 'energia', 'agua', 'internet', 'telefone', 'salario', 'imposto', 'fornecedor', 'outros'] as const;
export default function EdicaoDespesa49({ userId, itens }: { userId: number; itens: Item49[] }) {
  const session = useMemo(() => ({ owner: userId, generation: ++generation49, closed: false }), [userId]);
  const now = useRef(session); now.current = session;
  const valid = () => now.current === session && !session.closed;
  const [ready, setReady] = useState(session);
  const [pending, setPending] = useState<Journal49 | null>(null);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState<Edicao49Request | null>(null);
  const [quoteValue, setQuoteValue] = useState('');
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [message, setMessage] = useState('');
  const journal = useMemo(() => {
    let storage = null; let locks;
    try { storage = window.sessionStorage; locks = navigator.locks; } catch { /* fail closed */ }
    return new Despesas49Journal(userId, storage, locks, valid);
  }, [session]);
  function exigirOriginaisEncerrados() {
    const storage = window.sessionStorage;
    const size = storage.length;
    if (!Number.isSafeInteger(size) || size < 0 || size > 100000) throw new Error('Inventário de originais inconclusivo.');
    for (let i = 0; i < size; i++) {
      const key = storage.key(i);
      if (!valid() || key === null) throw new Error('Sessão/inventário mudou.');
      if (isOwnedKey38(key, userId) || key.startsWith(`cobrapro:despesas:0020:v1:user:${userId}:action:`)) throw new Error('Original20/38 retido. Recupere o pedido exato no fluxo original antes de preparar49.');
    }
    if (storage.length !== size) throw new Error('Inventário mudou.');
    const previous = new CancelamentoPendenteStore(userId, storage);
    if (previous.read() || previous.blocked) throw new Error('Original38c retido. Encerre com prova própria antes de preparar49.');
  }
  useEffect(() => {
    session.closed = false; setSelected(''); setForm(null); setMessage(''); setBusy(false); flight.current = false;
    try { setPending(journal.read()); if (!journal.read()) exigirOriginaisEncerrados(); } catch (e) { setMessage((e as Error).message); }
    setReady(session); return () => { session.closed = true; };
  }, [session, journal]);
  const options = useMemo(() => ({ retry: false, gcTime: 0, initialData: undefined, placeholderData: undefined, queryKeyHashFn: (key: readonly unknown[]) => hashKey(['despesas49', session.generation, userId, key]) }), [session]);
  const cap = trpc.despesas49.capacidades.useQuery(undefined, options);
  const quote = trpc.despesas49.cotar.useMutation({ retry: false });
  const edit = trpc.despesas49.editar.useMutation({ retry: false });
  const recovery = trpc.despesas49.recuperar.useMutation({ retry: false });
  const utils = trpc.useUtils();
  const canWrite = valid() && ready === session && cap.data?.habilitado === true && !cap.isError && !busy && !pending && !message;
  async function cotar() {
    if (!canWrite || flight.current || !itens.some(i => i.id === Number(selected) && i.podePagar)) return;
    flight.current = true; setBusy(true);
    try {
      const id = Number(selected), q = validarQuote49(await quote.mutateAsync({ despesaId: id }), userId, id);
      if (!valid()) return;
      if (!q.habilitado) throw new Error('Edição49 desabilitada no banco.');
      setQuoteValue(q.valor);
      setForm({ despesaId: id, origemOperationId: q.origemOperationId, estadoHash: q.estadoHash, descricao: String(q.original.descricao), categoria: q.original.categoria as Edicao49Request['categoria'], dataVencimento: String(q.original.data_vencimento), observacoes: String(q.original.observacoes ?? ''), motivo: '' });
    } catch (e) { if (valid()) setMessage((e as Error).message); }
    finally { if (valid()) { setBusy(false); flight.current = false; } }
  }
  async function send(j: Journal49, recover: boolean, close = false) {
    if (!valid() || flight.current || (!recover && (cap.isError || cap.data?.habilitado !== true))) return;
    flight.current = true; setBusy(true);
    try {
      await journal.run(j, async () => {
        const raw = recover ? await recovery.mutateAsync(j.input) : await edit.mutateAsync(j.input);
        if (!valid()) return;
        journal.assertCurrent(j);
        if (recover) {
          const proof = validarRecovery49(raw, userId, j.input);
          if (close && journal.closeInsideLock(j, proof)) { setPending(null); setForm(null); setSelected(''); setMessage(''); }
          else setMessage(proof.status === 'confirmed' ? 'Edição confirmada. Encerre com prova para liberar próxima.' : 'UUID terminalmente não executada. Encerre com prova; não reenviar.');
        } else {
          validarRecibo49(raw, userId, j.input);
          setMessage('Edição por sucessão20 confirmada, valor inalterado e Caixa zero. Original retido até recovery/CAS.');
        }
        void Promise.allSettled([utils.contasPagar.listar.invalidate(), utils.contasPagar.resumo.invalidate()]);
      });
    } catch (e) { if (valid()) setMessage(`${(e as Error).message} Preserve pedido e UUID originais49.`); }
    finally { if (valid()) { setBusy(false); flight.current = false; try { setPending(journal.read()); } catch (e) { setMessage((e as Error).message); } } }
  }
  async function confirmar() {
    if (!canWrite || !form || flight.current) return;
    try {
      exigirOriginaisEncerrados();
      const j = await journal.prepare({ ...form, descricao: form.descricao.trim(), motivo: form.motivo.trim() });
      if (!valid()) return;
      setPending(j); void send(j, false);
    } catch (e) { if (valid()) setMessage((e as Error).message); }
  }
  if (ready !== session) return <p role="status">Atualizando sessão49...</p>;
  return <section aria-label="Edição pendente auditada49" className="border rounded-lg p-4 space-y-3">
    <h2 className="font-semibold">Editar despesa pendente com cotação e histórico</h2>
    <p className="text-sm">A original será cancelada logicamente e uma sucessora20 criada na mesma transação, com o mesmo valor. Datas, categoria, descrição e observações podem mudar; baixa e origem originais nunca são reescritas. Não há movimento de Caixa.</p>
    {cap.isError || cap.data?.habilitado !== true ? <p role="status">Edição49 indisponível; nenhuma escrita será feita. Recuperação original continua disponível.</p> : null}
    {message && <p role="alert">{message}</p>}
    {pending ? <div className="space-y-2"><p className="break-all">UUID original49: {pending.input.idempotencyKey}</p><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(pending.input, null, 2)}</pre>
      <Button disabled={busy} onClick={() => void send(pending, true, true)}>Encerrar edição com prova terminal e CAS</Button>
      <Button disabled={busy} variant="outline" onClick={() => void send(pending, true)}>Conferir UUID original49</Button>
      <Button disabled={busy || cap.data?.habilitado !== true || cap.isError || !!message} variant="outline" onClick={() => void send(pending, false)}>Reenviar pedido original49</Button>
    </div> : <div className="space-y-2">
      <label htmlFor="edicao49-id">Despesa elegível do owner atual</label><select id="edicao49-id" className="bg-background border p-2 w-full" disabled={!canWrite} value={selected} onChange={e => { setSelected(e.target.value); setForm(null); }}><option value="">Selecionar</option>{itens.filter(i => i.podePagar).map(i => <option key={i.id} value={i.id}>#{i.id} · {i.descricao}</option>)}</select>
      <Button disabled={!canWrite || !selected} onClick={() => void cotar()}>Cotar edição pendente49</Button>
      {form && <><p>Valor preservado: R$ {quoteValue}. Original #{form.despesaId}; sucessora terá novo ID e origem auditada.</p>
        <label htmlFor="edicao49-descricao">Descrição</label><Input id="edicao49-descricao" disabled={!canWrite} value={form.descricao} maxLength={255} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        <label htmlFor="edicao49-categoria">Categoria</label><select id="edicao49-categoria" disabled={!canWrite} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value as Edicao49Request['categoria'] })}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <label htmlFor="edicao49-data">Vencimento civil</label><Input id="edicao49-data" type="date" disabled={!canWrite} value={form.dataVencimento} onChange={e => setForm({ ...form, dataVencimento: e.target.value })} />
        <label htmlFor="edicao49-obs">Observações</label><Textarea id="edicao49-obs" disabled={!canWrite} maxLength={10000} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
        <label htmlFor="edicao49-motivo">Motivo obrigatório da substituição</label><Textarea id="edicao49-motivo" disabled={!canWrite} maxLength={2000} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
        <Button disabled={!canWrite || !form.motivo.trim()} onClick={() => void confirmar()}>Confirmar edição por sucessão20 sem Caixa</Button>
      </>}
    </div>}
  </section>;
}
