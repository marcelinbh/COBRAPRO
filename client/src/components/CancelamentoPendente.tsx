import { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hashKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CancelamentoPendenteStore, validarCancelamentoPendente, validarRecoveryCancelamento, type IntencaoCancelamentoPendente, type StorageCancelamento } from '../../../shared/despesaCancelamentoPendente';
import { isOwnedKey38 } from '../../../shared/despesas38Original';
let nextGeneration = 0;
type Item = { id: number; descricao: string; podeCancelarPendente: boolean; origemOperationId: string | null };
/** Incremento deliberadamente separado dos fluxos20: não muda criação/pagamento/estorno.
 * O original fica fora da lista filtrada, não é removido por confirmação/reload.
 * Fechamento CAS somente mediante recovery terminal, recibo por UUID preservado.
 */
export default function CancelamentoPendente({ userId, itens, onOriginalEncerrado }: { userId: number; itens: Item[]; onOriginalEncerrado?: (userId: number) => void }) {
  const session = useMemo(() => ({ userId, generation: ++nextGeneration, closed: false }), [userId]);
  const current = useRef(session); current.current = session;
  const valid = () => current.current === session && !session.closed;
  const [ready, setReady] = useState(session);
  const [original, setOriginal] = useState<IntencaoCancelamentoPendente | null>(null);
  const [selected, setSelected] = useState('');
  const [motivo, setMotivo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const inflight = useRef(false);
  const [storage] = useState(() => { try { return window.sessionStorage; } catch { return null; } });
  const store = useMemo(() => new CancelamentoPendenteStore(userId, storage as StorageCancelamento | null), [session, storage]);
  // Reuso do reconhecedor sucessor38 byte-exato: só examina nomes de chave do
  // owner atual. Nunca getItem de38, nunca normaliza/apaga/adota request38 opaco.
  function historical38Pending(): boolean {
    if (!storage) throw new Error('Inventário local indisponível.');
    const size = storage.length;
    if (!Number.isSafeInteger(size) || size < 0 || size > 100000) throw new Error('Inventário local inconclusivo.');
    const keys = new Set<string>(); let found = false;
    for (let i = 0; i < size; i++) {
      const key = storage.key(i);
      if (!valid() || key === null || keys.has(key)) throw new Error('Sessão/inventário mudou.');
      keys.add(key); if (isOwnedKey38(key, userId)) found = true;
    }
    if (storage.length !== size) throw new Error('Inventário mudou.');
    return found;
  }
  useEffect(() => {
    session.closed = false;
    setSelected(''); setMotivo(''); setBusy(false); inflight.current = false; setConfirmed(false); setMessage('');
    try { setOriginal(store.read()); if (historical38Pending()) setMessage('Há originais38 preservados: manutenção nova bloqueada; requer recuperação38 própria.'); }
    catch (error) { setMessage((error as Error).message); }
    setReady(session);
    return () => { session.closed = true; };
  }, [session, store]);
  const options = useMemo(() => ({ retry: false, gcTime: 0, initialData: undefined, placeholderData: undefined, staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true, queryKeyHashFn: (key: readonly unknown[]) => hashKey(['cancelamento-pendente', session, key]), trpc: { abortOnUnmount: true } }), [session]);
  const cap = trpc.contasPagar.capacidadesCancelamentoPendente.useQuery(undefined, options);
  const cancel = trpc.contasPagar.cancelarPendente.useMutation({ retry: false });
  const recovery = trpc.contasPagar.recuperarCancelamentoPendente.useMutation({ retry: false });
  const utils = trpc.useUtils();
  const canWrite = ready === session && valid() && cap.data?.habilitado === true && !cap.isError && !cap.isLoading && !cap.isFetching && !busy && !message && !store.blocked;
  async function send(intent: IntencaoCancelamentoPendente, recover: boolean, close = false) {
    if (!valid() || inflight.current || (!recover && (cap.data?.habilitado !== true || cap.isError || cap.isLoading || cap.isFetching || confirmed || store.blocked))) return;
    const token = store.acquire(); if (!token) return;
    inflight.current = true; setBusy(true);
    try {
      const result = recover ? await recovery.mutateAsync(intent.input) : await cancel.mutateAsync(intent.input);
      if (!valid()) return;
      const proof = recover ? validarRecoveryCancelamento(result, userId, intent.input) : null;
      if (proof?.status === 'unknown') { setMessage('Resultado desconhecido. Original e UUID preservados; ausência não autoriza substituição.'); return; }
      if (close) {
        if (!proof) throw new Error('Fechamento exige recovery terminal');
        store.close(token, intent, proof);
        if (proof.status === 'confirmed') void Promise.allSettled([utils.contasPagar.listar.invalidate(), utils.contasPagar.resumo.invalidate()]);
        if (!valid()) return;
        onOriginalEncerrado?.(userId);
        setOriginal(null); setSelected(''); setMotivo(''); setConfirmed(false); setMessage('');
        toast.success('Intenção encerrada com prova e recibo preservados. Próximo cancelamento disponível quando habilitado.');
        return;
      }
      if (proof?.status === 'not_executed') { setConfirmed(true); setMessage('Não execução provada por fence durável. Encerre com prova para preparar nova intenção.'); return; }
      validarCancelamentoPendente(proof ? proof.result : result, userId, intent.input);
      setConfirmed(true); setMessage('Cancelamento original confirmado, sem movimento de Caixa. Original retido até encerrar com prova e CAS.');
      toast.success('Cancelamento confirmado. Consulte o cadastro físico atualizado.');
      // Sem overlay do resultado histórico sobre lista; consulta física separada.
      void Promise.allSettled([utils.contasPagar.listar.invalidate(), utils.contasPagar.resumo.invalidate()]);
    } catch (error) {
      if (valid()) { setMessage(`${(error as Error).message} UUID original mantida; confira no servidor ou reenvie a mesma intenção.`); }
    } finally {
      store.release(token);
      if (valid()) { inflight.current = false; setBusy(false); try { setOriginal(store.read()); } catch (error) { setMessage((error as Error).message); } }
    }
  }
  function begin() {
    if (!canWrite || original || inflight.current) return;
    try {
      if (historical38Pending()) throw new Error('Original38 existente; não criar intenção paralela.');
      const item = itens.find(i => String(i.id) === selected && i.podeCancelarPendente && i.origemOperationId);
      if (!item?.origemOperationId) throw new Error('Despesa não elegível; refaça consulta.');
      const intent = store.begin({ despesaId: item.id, origemOperationId: item.origemOperationId, motivo: motivo.trim() });
      setOriginal(intent); void send(intent, false);
    } catch (error) { setMessage((error as Error).message); try { setOriginal(store.read()); } catch { /* original nunca descartado */ } }
  }
  if (ready !== session) return <p role="status">Atualizando sessão de cancelamento...</p>;
  return <section aria-label="Cancelamento pendente auditado" className="border rounded-lg p-4 space-y-3">
    <h2 className="font-semibold">Cancelar obrigação pendente</h2>
    <p className="text-sm">Somente despesa avulsa20 intacta e nunca paga. Não exclui registro nem movimenta Caixa. Edição de metadados pendentes tem painel49 próprio; valor, exclusão física e recorrência não são alterados aqui.</p>
    {cap.isError ? <p role="alert">Disponibilidade não comprovada; escritas bloqueadas.</p> : cap.isLoading || cap.isFetching || !cap.data ? <p role="status">Consultando disponibilidade do cancelamento; nenhuma escrita nova será feita.</p> : !cap.data.habilitado ? <p role="status">Cancelamento novo desligado no banco (OFF). Conferência/fechamento da intenção original continua disponível.</p> : null}
    {message && <p role="alert">{message}</p>}
    {original && <p className="text-sm">A conferência aguarda a operação no servidor. Se não houve execução, fecha definitivamente esta UUID por fence durável; não há reenvio possível após esse fechamento.</p>}
    {original ? <div className="space-y-2">
      <p className="text-sm break-all">UUID original: {original.input.idempotencyKey}</p>
      <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(original.input, null, 2)}</pre>
      <Button disabled={busy || store.blocked} variant="outline" onClick={() => void send(original, true, true)}>Encerrar intenção com prova e liberar próxima</Button>
      <Button disabled={busy} variant="outline" onClick={() => void send(original, true)}>Conferir cancelamento original no servidor</Button>
      <Button disabled={busy || confirmed || cap.data?.habilitado !== true || store.blocked} variant="outline" onClick={() => { setMessage(''); void send(original, false); }}>Reenviar MESMA intenção original</Button>
    </div> : <div className="space-y-2">
      <label className="block" htmlFor="cancelamento-despesa">Despesa pendente elegível</label>
      <select id="cancelamento-despesa" value={selected} disabled={!canWrite} onChange={e => setSelected(e.target.value)} className="bg-background border rounded p-2 w-full"><option value="">Selecionar</option>{itens.filter(i => i.podeCancelarPendente).map(i => <option key={i.id} value={i.id}>#{i.id} · {i.descricao}</option>)}</select>
      <label className="block" htmlFor="cancelamento-motivo">Motivo obrigatório</label><Input id="cancelamento-motivo" value={motivo} maxLength={2000} disabled={!canWrite} onChange={e => setMotivo(e.target.value)} />
      <Button disabled={!canWrite || !selected || !motivo.trim()} onClick={begin}>Confirmar cancelamento auditado sem Caixa</Button>
    </div>}
  </section>;
}
