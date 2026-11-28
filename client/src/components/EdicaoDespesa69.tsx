import { useEffect, useMemo, useRef, useState } from 'react';
import { hashKey } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { dinheiroDespesa } from '../../../shared/despesasIntent';
import { edicao69Request, temDelta69, validarQuote69, validarRecibo69, validarRecovery69, type Edicao69Request, type Quote69 } from '../../../shared/despesas69';
import { Despesas69Journal, type Journal69 } from '@/lib/despesas69Journal';
let generation69 = 0;
const categories = ['aluguel', 'energia', 'agua', 'internet', 'telefone', 'salario', 'imposto', 'fornecedor', 'outros'] as const;
export type Item69 = { id: number; descricao: string; podePagar: boolean };
export default function EdicaoDespesa69({ userId, itens, onConfirmed }: { userId: number; itens: Item69[]; onConfirmed?: () => void | Promise<void> }) {
  const session = useMemo(() => ({ owner: userId, generation: ++generation69, closed: false }), [userId]);
  const now = useRef(session); now.current = session;
  const valid = () => now.current === session && !session.closed;
  const [ready, setReady] = useState(session);
  const [pending, setPending] = useState<Journal69 | null>(null);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState<Edicao69Request | null>(null);
  const [quoted, setQuoted] = useState<Quote69 | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [message, setMessage] = useState('');
  const flight = useRef(false);
  const journal = useMemo(() => {
    let storage = null; let locks;
    try { storage = window.sessionStorage; locks = navigator.locks; } catch { /* fail closed */ }
    return new Despesas69Journal(userId, storage, locks, valid);
  }, [session]);
  function discover() {
    if (!valid()) return;
    try { setPending(journal.read()); setBlocked(!journal.storage || !journal.locks); }
    catch { setBlocked(true); setMessage('Persistência69 inconclusiva. Pedido retido; revalidar armazenamento antes de escrever.'); }
  }
  useEffect(() => {
    session.closed = false; flight.current = false; setBusy(false); setSelected(''); setForm(null); setQuoted(null); setMessage(''); setTerminal(false);
    discover(); setReady(session);
    return () => { session.closed = true; };
  }, [session, journal]);
  const options = useMemo(() => ({ retry: false, gcTime: 0, initialData: undefined, placeholderData: undefined, queryKeyHashFn: (key: readonly unknown[]) => hashKey(['despesas69', session.generation, userId, key]) }), [session]);
  const cap = trpc.despesas69.capacidades.useQuery(undefined, options);
  const quote = trpc.despesas69.cotar.useMutation({ retry: false });
  const edit = trpc.despesas69.editar.useMutation({ retry: false });
  const recovery = trpc.despesas69.recuperar.useMutation({ retry: false });
  const utils = trpc.useUtils();
  const canWrite = valid() && ready === session && !blocked && !busy && !pending && !cap.isError && cap.data?.habilitado === true;
  const parsed = form ? edicao69Request.safeParse({ ...form, descricao: form.descricao.trim(), motivo: form.motivo.trim(), valor: dinheiroDespesa(form.valor) ?? form.valor }) : null;
  const delta = parsed?.success && quoted ? temDelta69(parsed.data, quoted) : false;
  async function cotar() {
    if (!canWrite || flight.current || !itens.some(i => i.id === Number(selected) && i.podePagar)) return;
    flight.current = true; setBusy(true); setMessage(''); setForm(null); setQuoted(null);
    try {
      const did = Number(selected), q = validarQuote69(await quote.mutateAsync({ despesaId: did }), userId, did);
      if (!valid()) return;
      if (!q.habilitado) throw new Error('Edição69 desabilitada no banco; recuperação continua disponível.');
      const o = q.quote49.original;
      setQuoted(q); setForm({ despesaId: did, origemOperationId: q.quote49.origemOperationId, estadoHash: q.quote49.estadoHash, descricao: String(o.descricao), categoria: o.categoria as Edicao69Request['categoria'], dataVencimento: String(o.data_vencimento), observacoes: String(o.observacoes ?? ''), motivo: '', valor: q.quote49.valor });
    } catch { if (valid()) setMessage('Cotação69 não confirmada. Tente cotar novamente; nenhuma UUID foi preparada.'); }
    finally { if (valid()) { setBusy(false); flight.current = false; } }
  }
  function refreshReads() {
    if (!valid()) return;
    // Confirmação não depende do sucesso das leituras; callback invocado só na sessão capturada.
    void Promise.allSettled([utils.contasPagar.listar.invalidate(), utils.contasPagar.resumo.invalidate(), Promise.resolve().then(() => valid() ? onConfirmed?.() : undefined)]).then(results => {
      if (valid() && results.some(r => r.status === 'rejected')) setMessage('Operação confirmada; leitura não atualizada. Reconsulte a lista, não repita a operação.');
    });
  }
  async function send(j: Journal69, recover: boolean, close = false) {
    if (!valid() || flight.current || (!recover && (terminal || cap.isError || cap.data?.habilitado !== true))) return;
    flight.current = true; setBusy(true);
    try {
      await journal.run(j, async () => {
        const raw = recover ? await recovery.mutateAsync(j.input) : await edit.mutateAsync(j.input);
        if (!valid()) return;
        journal.assertCurrent(j);
        if (recover) {
          const proof = validarRecovery69(raw, userId, j.input);
          setTerminal(true); // confirmed também não precisa de novo POST.
          if (close && journal.closeInsideLock(j, proof)) { setPending(null); setForm(null); setQuoted(null); setSelected(''); setTerminal(false); }
          setMessage(proof.status === 'confirmed' ? 'Substituição69 confirmada. Valor novo auditado; sem movimento de Caixa.' : 'UUID69 terminalmente não executada e fenced. Nunca reenviar este pedido.');
          if (proof.status === 'confirmed') refreshReads();
        } else {
          validarRecibo69(raw, userId, j.input); setTerminal(true);
          setMessage('Substituição69 confirmada. Original retido até encerramento com prova/CAS.'); refreshReads();
        }
      });
    } catch { if (valid()) setMessage('Resultado69 não comprovado. Preserve pedido e UUID originais; confira recuperação ou reenvie exatamente o original se ainda não terminal.'); }
    finally { if (valid()) { flight.current = false; setBusy(false); discover(); } }
  }
  async function confirmar() {
    if (!canWrite || flight.current || !parsed?.success || !quoted || !delta) return;
    // Flight cobre também prepare, antes do primeiro await: duplo clique não gera segunda intenção.
    flight.current = true; setBusy(true);
    let j: Journal69 | null = null;
    try { j = await journal.prepare(parsed.data, quoted); if (valid()) { setPending(j); setTerminal(false); } }
    catch { if (valid()) { setMessage('Preparação69 não confirmada. Nenhum POST enviado; releitura recupera eventual pedido já gravado.'); discover(); } }
    finally { if (valid()) { flight.current = false; setBusy(false); } }
    if (j && valid()) void send(j, false);
  }
  if (ready !== session) return <p role="status">Atualizando sessão69...</p>;
  return <section aria-label="Edição pendente com valor69" className="border rounded-lg p-4 space-y-3">
    <h2 className="font-semibold">Editar pendente, inclusive valor</h2>
    <p className="text-sm">A original é cancelada logicamente e a sucessora avulsa20 criada com novo valor na mesma transação, sem Caixa. Em recorrência, muda somente esta ocorrência: a série e próximas competências não mudam. Pagas usam estorno existente; legados são consulta/conferência, sem adoção automática.</p>
    {cap.isError || cap.data?.habilitado !== true ? <p role="status">Capacidade69 não confirmada; escrita indisponível. Recuperação permanece disponível.</p> : null}
    <Button variant="outline" disabled={busy} onClick={() => { discover(); void cap.refetch(); }}>Revalidar persistência e capacidade69</Button>
    {message && <p role="alert">{message}</p>}
    {pending ? <div className="space-y-2"><p className="break-all">UUID original69: {pending.input.idempotencyKey}</p>
      <Button disabled={busy || blocked} onClick={() => void send(pending, true, true)}>Encerrar69 com prova terminal e CAS</Button>
      <Button variant="outline" disabled={busy || blocked} onClick={() => void send(pending, true)}>Conferir UUID original69</Button>
      <Button variant="outline" disabled={busy || blocked || terminal || cap.isError || cap.data?.habilitado !== true} onClick={() => void send(pending, false)}>Reenviar pedido original69</Button>
    </div> : <div className="space-y-2">
      <label htmlFor="edicao69-id">Pendente elegível na lista atual</label><select id="edicao69-id" className="bg-background border p-2 w-full" disabled={!canWrite} value={selected} onChange={e => { setSelected(e.target.value); setForm(null); setQuoted(null); setMessage(''); }}><option value="">Selecionar</option>{itens.filter(i => i.podePagar).map(i => <option key={i.id} value={i.id}>#{i.id} · {i.descricao}</option>)}</select>
      <Button disabled={!canWrite || !selected} onClick={() => void cotar()}>Cotar edição69</Button>
      {form && quoted && <><p>Valor anterior: R$ {quoted.quote49.valor}. A sucessora terá novo ID.</p>
        <label htmlFor="edicao69-valor">Novo valor (decimal exato, ponto para centavos)</label><Input id="edicao69-valor" inputMode="decimal" disabled={!canWrite} value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
        <label htmlFor="edicao69-descricao">Descrição</label><Input id="edicao69-descricao" disabled={!canWrite} maxLength={255} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        <label htmlFor="edicao69-categoria">Categoria</label><select id="edicao69-categoria" disabled={!canWrite} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value as Edicao69Request['categoria'] })}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <label htmlFor="edicao69-data">Vencimento civil</label><Input id="edicao69-data" type="date" disabled={!canWrite} value={form.dataVencimento} onChange={e => setForm({ ...form, dataVencimento: e.target.value })} />
        <label htmlFor="edicao69-obs">Observações</label><Textarea id="edicao69-obs" disabled={!canWrite} maxLength={10000} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
        <label htmlFor="edicao69-motivo">Motivo obrigatório</label><Textarea id="edicao69-motivo" disabled={!canWrite} maxLength={2000} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
        {!delta && <p role="status">Informe motivo, valor/data/campos válidos e ao menos uma alteração. Apenas motivo não prepara UUID.</p>}
        <Button disabled={!canWrite || !delta || !parsed?.success} onClick={() => void confirmar()}>Confirmar substituição69 sem Caixa</Button>
      </>}
    </div>}
  </section>;
}
