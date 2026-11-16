import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { multimodalRpc, useIntencaoMultimodal } from "./EmprestimoMultimodalRpc";
import { dinheiroIntencao } from "./EmprestimoSeguroRpc";
import {
  dataMultimodalValida, normalizarCotacaoMultimodal, normalizarCotacaoRenovacaoMultimodal,
  recebimentoMultimodalSchema, renovacaoMultimodalSchema,
  type EntradaRecebimentoMultimodal, type EntradaRenovacaoMultimodal,
} from "../../../shared/emprestimosMultimodalCalculo";

type Props = { contratoId: number; parcelaId: number; origemUserId: number; status: string; onSuccess?: () => void };
function useAtualizar(onSuccess?: () => void) {
  const utils = trpc.useUtils();
  return () => {
    void Promise.all([utils.contratos.list.invalidate(), utils.contratos.listComParcelas.invalidate(), utils.contratos.obterDetalhes.invalidate(), utils.parcelas.list.invalidate(), utils.recebimentosLegados.origem.invalidate(), utils.emprestimosMultimodal.cotar.invalidate(), utils.emprestimosMultimodal.cotarRenovacao.invalidate(), utils.caixa.contas.invalidate(), utils.dashboard.kpis.invalidate(), utils.dashboard.resumoCaixa.invalidate()]).catch(() => {});
    onSuccess?.();
  };
}
/** Cache tRPC não contém owner. Só uma resposta de refetch iniciada nesta geração certifica a cotação. */
function useCotacaoAtual<T>(geracao: object, enabled: boolean, pedido: string,
  query: { isError: boolean; isLoading: boolean; isFetching: boolean; refetch: () => Promise<{ data?: unknown; isError?: boolean; isLoading?: boolean; isFetching?: boolean }> }, normalizar: (value: unknown) => T,
) {
  const current = useRef({ geracao, enabled, pedido, ativa: false, envio: 0 });
  if (current.current.geracao !== geracao || current.current.enabled !== enabled || current.current.pedido !== pedido) {
    current.current.ativa = false;
    current.current = { geracao, enabled, pedido, ativa: false, envio: 0 };
  }
  const token = current.current;
  const [data, setData] = useState<{ token: typeof token; value: T }>();
  const [loading, setLoading] = useState(false), [erro, setErro] = useState(false);
  const atual = () => token.enabled && token.ativa && current.current === token;
  async function refetch() {
    if (!atual()) return;
    const envio = ++token.envio;
    setLoading(true); setErro(false); setData(undefined);
    try {
      const response = await query.refetch();
      if (!atual() || envio !== token.envio) return;
      if (response.isError || response.isLoading || response.isFetching || !response.data) throw new Error("Cotação não confirmada.");
      setData({ token, value: normalizar(response.data) });
    } catch { if (atual() && envio === token.envio) { setErro(true); setData(undefined); } }
    finally { if (atual() && envio === token.envio) setLoading(false); }
  }
  useEffect(() => {
    token.ativa = true; setData(undefined); setLoading(false); setErro(false);
    if (enabled) void refetch();
    return () => { token.ativa = false; };
  }, [token]);
  return {
    data: atual() && data?.token === token && !loading && !query.isError && !query.isLoading && !query.isFetching ? data.value : undefined,
    isLoading: enabled && loading, isError: enabled && (erro || query.isError), isFetching: enabled && (loading || query.isFetching), refetch,
  };
}
export function EmprestimoMultimodalReceber({ contratoId, parcelaId, origemUserId, status, onSuccess }: Props) {
  const auth = trpc.auth.me.useQuery();
  const user = !auth.isError && !auth.isLoading && !auth.isFetching ? auth.data : undefined;
  const atual = !!user && user.id === origemUserId;
  const aberta = ["pendente", "atrasada", "vencendo_hoje", "parcial"].includes(status);
  const [modo, setModo] = useState<"integral" | "parcial">("integral"), [valor, setValor] = useState("");
  const atualizar = useAtualizar(onSuccess);
  const intent = useIntencaoMultimodal<EntradaRecebimentoMultimodal>(atual ? user.id : undefined, "receber", result => {
    const r = result as { contratoId?: number; parcelaId?: number; success?: boolean };
    if (r?.success === true && r.contratoId === contratoId && r.parcelaId === parcelaId) atualizar();
  }, contratoId, parcelaId, status);
  const source = trpc.emprestimosMultimodal.cotar.useQuery({ contratoId, parcelaId }, { enabled: false, retry: false, staleTime: 0 });
  const query = useCotacaoAtual(intent.geracao, atual && aberta && intent.pronta && !intent.pendente && !intent.erro, `${contratoId}:${parcelaId}`, source, value => normalizarCotacaoMultimodal(value, { contratoId, parcelaId }));
  const q = query.data;
  const form = useRef({ aberta, q, modo, valor }); form.current = { aberta, q, modo, valor };
  useEffect(() => { setModo("integral"); setValor(""); }, [user?.id, contratoId, parcelaId, origemUserId]);
  if (!atual || !intent.pronta) return <p role="status">Aguardando a origem e sessão atuais.</p>;
  if (!aberta && !intent.pendente) return <p>Parcela encerrada. Nenhum novo recebimento será enviado.</p>;
  async function nova(): Promise<EntradaRecebimentoMultimodal> {
    if (!intent.atual() || !form.current.aberta || form.current.q !== q || form.current.modo !== modo || form.current.valor !== valor || !q?.elegivel) throw new Error("Parcela sem cotação atual de recebimento.");
    const value = modo === "integral" ? q.totalExigido : dinheiroIntencao(valor);
    const payload = { idempotencyKey: crypto.randomUUID(), contratoId, parcelaId, valorRecebido: value, totalExigido: q.totalExigido, dataPagamento: q.dataPagamento, estadoHash: q.estadoHash, modo };
    recebimentoMultimodalSchema.parse(payload);
    return payload;
  }
  return <section className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Receber parcela</h3>
    {intent.erro && <p role="alert">{intent.erro}</p>}
    {intent.pendente ? <>
      <p>Intenção preservada: <code>{intent.pendente.payload.idempotencyKey}</code></p>
      <p>{intent.pendente.confirmacao ? "Recebimento confirmado. Não será recebido novamente." : "Resultado pendente: confira a mesma intenção; não inicie outro pagamento."}</p>
      {!intent.pendente.confirmacao && <Button variant="outline" disabled={intent.busy} onClick={intent.reconciliar}>Conferir recebimento no servidor</Button>}
      {intent.recovery?.status === "not_executed" && <Button variant="outline" disabled={intent.busy} onClick={() => { if (intent.concluirOuCorrigir()) setValor(""); }}>Corrigir após não execução comprovada</Button>}
    </> : <>
      {query.isLoading && <p role="status">Conferindo a cotação financeira...</p>}
      {query.isError && <><p role="alert">Não foi possível obter uma cotação válida. Nenhum recebimento foi enviado.</p><Button variant="outline" onClick={query.refetch}>Tentar novamente</Button></>}
      {q && <>
        <p>Total exigido {q.totalExigido}; multa {q.multa}; mora {q.mora}. Data de pagamento {q.dataPagamento} (Brasília).</p>
        <p className="text-sm text-muted-foreground">Juros contratuais {q.jurosEmbutidos} já estão embutidos na parcela. Não são cobrados de novo como mora. Pagamento parcial preserva residual; não renova multa após a primeira baixa.</p>
        <label><Label>Tipo de recebimento</Label><select className="w-full border p-2 rounded bg-background" value={modo} onChange={e => setModo(e.target.value as "integral" | "parcial")} disabled={intent.busy}><option value="integral">Integral — total cotado exato</option><option value="parcial">Parcial — valor positivo menor que o total</option></select></label>
        {modo === "parcial" && <label><Label>Valor recebido (decimal)</Label><Input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} disabled={intent.busy} placeholder="100.00" /></label>}
      </>}
    </>}
    {!intent.pendente?.confirmacao && <Button disabled={intent.busy || !!intent.erro || intent.recovery?.status === "not_executed" || (!intent.pendente && (!q?.elegivel || query.isError || !aberta))} onClick={() => intent.enviar(nova, payload => multimodalRpc.receber.mutate(payload))}>{intent.busy ? "Conferindo..." : intent.pendente ? "Repetir a mesma intenção de recebimento" : "Confirmar recebimento"}</Button>}
  </section>;
}
export function EmprestimoMultimodalRenovar({ contratoId, parcelaId, origemUserId, status, onSuccess }: Props) {
  const auth = trpc.auth.me.useQuery();
  const user = !auth.isError && !auth.isLoading && !auth.isFetching ? auth.data : undefined;
  const atual = !!user && user.id === origemUserId;
  const aberta = ["pendente", "atrasada", "vencendo_hoje"].includes(status);
  const [novoVencimento, setVencimento] = useState("");
  const atualizar = useAtualizar(onSuccess);
  const intent = useIntencaoMultimodal<EntradaRenovacaoMultimodal>(atual ? user.id : undefined, "renovar", result => {
    const r = result as { contratoId?: number; parcelaId?: number; success?: boolean };
    if (r?.success === true && r.contratoId === contratoId && r.parcelaId === parcelaId) atualizar();
  }, contratoId, parcelaId, status);
  const source = trpc.emprestimosMultimodal.cotarRenovacao.useQuery({ contratoId, parcelaId, novoVencimento }, { enabled: false, retry: false, staleTime: 0 });
  const query = useCotacaoAtual(intent.geracao, atual && aberta && intent.pronta && !intent.pendente && !intent.erro && dataMultimodalValida(novoVencimento), `${contratoId}:${parcelaId}:${novoVencimento}`, source, value => normalizarCotacaoRenovacaoMultimodal(value, { contratoId, parcelaId, novoVencimento }));
  const q = query.data;
  const form = useRef({ aberta, q, novoVencimento }); form.current = { aberta, q, novoVencimento };
  useEffect(() => { setVencimento(""); }, [user?.id, contratoId, parcelaId, origemUserId]);
  if (!atual || !intent.pronta) return <p role="status">Aguardando a origem e sessão atuais.</p>;
  if (!aberta && !intent.pendente) return <p>Parcela encerrada. Não será criada outra renovação. Intenção existente pode ser conferida na parcela correspondente.</p>;
  async function nova(): Promise<EntradaRenovacaoMultimodal> {
    if (!intent.atual() || !form.current.aberta || form.current.q !== q || form.current.novoVencimento !== novoVencimento || !q?.renovavel) throw new Error("Renovação exige último bullet íntegro e cotação válida.");
    const payload = { idempotencyKey: crypto.randomUUID(), contratoId, parcelaId, novoVencimento: q.novoVencimento, valorRecebido: q.totalExigido, totalExigido: q.totalExigido, dataPagamento: q.dataPagamento, estadoHash: q.estadoHash };
    renovacaoMultimodalSchema.parse(payload);
    return payload;
  }
  return <section className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Receber juros e renovar bullet</h3>
    <p className="text-sm text-muted-foreground">Somente bullet de uma parcela inicial, sem amortização ou baixa parcial, com juros positivos. Recebe juros e encargos; conserva o principal na sucessora, sem novo desembolso. Renovações anteriores ficam provadas na cadeia.</p>
    {intent.erro && <p role="alert">{intent.erro}</p>}
    {intent.pendente ? <>
      <p>Intenção preservada: <code>{intent.pendente.payload.idempotencyKey}</code></p>
      <p>{intent.pendente.confirmacao ? "Renovação confirmada. Nenhuma nova cobrança será enviada nesta parcela." : "Conferir/repetir somente a intenção original. Não gere outro UUID para esta cobrança."}</p>
      {!intent.pendente.confirmacao && <Button variant="outline" disabled={intent.busy} onClick={intent.reconciliar}>Conferir renovação no servidor</Button>}
      {intent.recovery?.status === "not_executed" && <Button variant="outline" disabled={intent.busy} onClick={() => { if (intent.concluirOuCorrigir()) setVencimento(""); }}>Corrigir após não execução comprovada</Button>}
    </> : <>
      <label><Label>Novo vencimento explícito</Label><Input type="date" value={novoVencimento} onChange={e => setVencimento(e.target.value)} disabled={intent.busy} /></label>
      {query.isFetching && <p role="status">Conferindo a cotação da renovação...</p>}
      {query.isError && <><p role="alert">Renovação indisponível para este estado ou vencimento. Nenhuma cobrança foi enviada.</p><Button variant="outline" onClick={query.refetch}>Tentar novamente</Button></>}
      {q && <p>Receber {q.totalExigido}: juros {q.juros}, multa {q.multa}, mora {q.mora}. Principal preservado {q.principalPreservado}. Novo vencimento {q.novoVencimento}.</p>}
    </>}
    {!intent.pendente?.confirmacao && <Button disabled={intent.busy || !!intent.erro || intent.recovery?.status === "not_executed" || (!intent.pendente && (!q?.renovavel || query.isError || !aberta))} onClick={() => intent.enviar(nova, payload => multimodalRpc.renovar.mutate(payload))}>{intent.busy ? "Conferindo..." : intent.pendente ? "Repetir a mesma intenção de renovação" : "Confirmar juros e renovação"}</Button>}
  </section>;
}
