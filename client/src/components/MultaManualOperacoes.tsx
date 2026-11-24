import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCotacaoAtual } from "./EmprestimoMultimodalOperacoes";
import { dinheiroIntencao } from "./EmprestimoSeguroRpc";
import { multaManualRpc, useIntencaoMulta } from "./MultaManualRpc";
import { dataMultimodalValida } from "../../../shared/emprestimosMultimodalCalculo";
import {
  aplicarMultaSchema, receberMultaSchema, renovarMultaSchema, capacidadesMultaSchema,
  normalizarCotacaoMulta, normalizarCotacaoRenovacaoMulta,
  type EntradaAplicarMulta, type EntradaReceberMulta, type EntradaRenovarMulta,
} from "../../../shared/multaManual";

function useAtualizar(onSuccess?: () => void) {
  const utils = trpc.useUtils();
  return () => {
    void Promise.all([utils.contratos.list.invalidate(), utils.contratos.listComParcelas.invalidate(),
      utils.contratos.obterDetalhes.invalidate(), utils.parcelas.list.invalidate(), utils.recebimentosLegados.origem.invalidate(),
      utils.multaManual.cotar.invalidate(), utils.multaManual.cotarRenovacao.invalidate(), utils.caixa.contas.invalidate(),
      utils.dashboard.kpis.invalidate(), utils.dashboard.resumoCaixa.invalidate()]).catch(() => {});
    onSuccess?.();
  };
}
function useSessao(origemUserId?: number) {
  const auth = trpc.auth.me.useQuery(undefined, { refetchOnMount: false });
  const user = !auth.isError && !auth.isLoading && !auth.isFetching ? auth.data : undefined;
  return user && (origemUserId === undefined || user.id === origemUserId) ? user : undefined;
}
type Intent = ReturnType<typeof useIntencaoMulta<any>>;
function IntencaoMulta({ intent, corrigir, encerrar }: { intent: Intent; corrigir?: (payload: any) => void; encerrar?: boolean }) {
  if (!intent.pendente) return null;
  const confirmed = Object.hasOwn(intent.pendente, "confirmacao");
  return <div className="space-y-2">
    <p className="break-all">Intenção preservada: <code>{intent.pendente.payload.idempotencyKey}</code></p>
    <p>{confirmed ? "Operação confirmada. Esta intenção não será cobrada novamente." : "Resultado pendente: confira ou repita somente a intenção original. Não inicie outra cobrança."}</p>
    {!confirmed && <Button variant="outline" disabled={intent.busy} onClick={intent.reconciliar}>Conferir intenção no servidor</Button>}
    {intent.recovery?.status === "not_executed" && <Button variant="outline" disabled={intent.busy} onClick={() => { const p = intent.concluirOuCorrigir(); if (p) corrigir?.(p); }}>Corrigir após não execução comprovada</Button>}
    {confirmed && encerrar && <Button variant="outline" disabled={intent.busy} onClick={() => intent.concluirOuCorrigir()}>Encerrar confirmação e preparar outra seleção</Button>}
  </div>;
}
const uuidValidacao = "00000000-0000-4000-8000-000000000000";
export function MultaManualFormulario({ contratoId, onSuccess }: { contratoId: number; onSuccess?: () => void }) {
  const user = useSessao();
  const [valor, setValor] = useState(""), [selecao, setSelecao] = useState("automatica"), [idsText, setIds] = useState("");
  const atualizar = useAtualizar(onSuccess);
  const intent = useIntencaoMulta<EntradaAplicarMulta>(user?.id, "multa", contratoId, undefined, atualizar);
  const source = trpc.multaManual.disponibilidade.useQuery(undefined, { enabled: false, retry: false, staleTime: 0 });
  const capacidade = useCotacaoAtual(intent.generation, !!user && intent.pronta && !intent.pendente && !intent.erro,
    `${user?.id ?? 0}:${contratoId}:capacidade36`, source, value => capacidadesMultaSchema.parse(value));
  const form = useRef({ valor, selecao, idsText, capacidade: capacidade.data }); form.current = { valor, selecao, idsText, capacidade: capacidade.data };
  useEffect(() => { setValor(""); setSelecao("automatica"); setIds(""); }, [user?.id, contratoId]);
  if (!user || !intent.pronta) return <p role="status">Conferindo a sessão atual...</p>;
  async function nova(): Promise<EntradaAplicarMulta> {
    if (!intent.atual() || form.current.valor !== valor || form.current.selecao !== selecao || form.current.idsText !== idsText || form.current.capacidade !== capacidade.data || !capacidade.data?.aplicacao) throw Error("Aplicação sem capacidade e formulário atuais.");
    let parcelasIds: number[] | undefined;
    if (selecao === "explicita") {
      if (!/^[1-9]\d*(?:\s*,\s*[1-9]\d*)*$/.test(idsText.trim())) throw Error("Informe IDs positivos separados por vírgula, sem duplicar parcelas.");
      parcelasIds = idsText.trim().split(/\s*,\s*/).map(Number);
    }
    const input = aplicarMultaSchema.parse({ idcontrato: contratoId, multa: dinheiroIntencao(valor), idempotencyKey: uuidValidacao, ...(parcelasIds ? { parcelasIds } : {}) });
    return { ...input, idempotencyKey: crypto.randomUUID() };
  }
  return <section className="space-y-3">
    <p className="text-sm">Valor fixo por parcela vencida, apenas depois de virar o dia em Brasília. Substitui a multa percentual nas parcelas selecionadas; a mora permanece separada. Aplicar multa não cria entrada no Caixa: a entrada ocorre no recebimento.</p>
    {intent.erro && <p role="alert">{intent.erro}</p>}
    {intent.pendente ? <IntencaoMulta intent={intent} encerrar corrigir={p => { setValor(p.multa); setSelecao(p.parcelasIds ? "explicita" : "automatica"); setIds(p.parcelasIds?.join(", ") ?? ""); }} /> : <>
      {capacidade.isFetching && <p role="status">Conferindo disponibilidade do ciclo completo...</p>}
      {capacidade.isError && <><p role="alert">O ciclo de multa não foi comprovado no banco. Nenhuma alteração foi enviada.</p><Button variant="outline" onClick={capacidade.refetch}>Conferir disponibilidade novamente</Button></>}
      <label className="block space-y-1"><Label>Multa fixa por parcela (R$)</Label><Input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="50.00" disabled={intent.busy} /></label>
      <label className="block space-y-1"><Label>Parcelas selecionadas</Label><select className="w-full rounded border bg-background p-2" value={selecao} onChange={e => setSelecao(e.target.value)} disabled={intent.busy}><option value="automatica">Todas as vencidas elegíveis, sem pagamento ou multa manual anterior</option><option value="explicita">Informar IDs específicos deste contrato</option></select></label>
      {selecao === "explicita" && <label className="block space-y-1"><Label>IDs das parcelas, separados por vírgula</Label><Input value={idsText} onChange={e => setIds(e.target.value)} disabled={intent.busy} placeholder="12, 13" /></label>}
    </>}
    {!intent.pendente?.confirmacao && <Button disabled={intent.busy || !!intent.erro || intent.recovery?.status === "not_executed" || (!intent.pendente && (!capacidade.data?.aplicacao || capacidade.isError))} onClick={() => intent.enviar(nova, p => multaManualRpc.aplicar.mutate(p))}>{intent.busy ? "Conferindo..." : intent.pendente ? "Repetir a mesma intenção de multa" : "Confirmar multa fixa"}</Button>}
  </section>;
}
export function MultaManualAplicar({ contratoId, onSuccess }: { contratoId: number; onSuccess?: () => void }) {
  const user = useSessao();
  const scope = `${user?.id ?? 0}:${contratoId}`, current = useRef({ scope, epoch: 0 });
  if (current.current.scope !== scope) current.current = { scope, epoch: current.current.epoch + 1 };
  const token = current.current, screen = `${scope}:${token.epoch}`;
  const [opened, setOpened] = useState("");
  const open = !!user && opened === screen;
  return <>
    <Button variant="outline" size="sm" disabled={!user} onClick={() => setOpened(screen)}>Aplicar / conferir multa</Button>
    <Dialog open={open} onOpenChange={v => setOpened(v ? screen : "")}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Multa manual fixa</DialogTitle></DialogHeader>
      {open && <MultaManualFormulario key={screen} contratoId={contratoId} onSuccess={() => { if (current.current === token) onSuccess?.(); }} />}
    </DialogContent></Dialog>
  </>;
}

type Props = { contratoId: number; parcelaId: number; origemUserId: number; status: string; onSuccess?: () => void };
export function MultaManualReceber({ contratoId, parcelaId, origemUserId, status, onSuccess }: Props) {
  const user = useSessao(origemUserId), aberta = ["pendente", "atrasada", "vencendo_hoje", "parcial"].includes(status);
  const [modo, setModo] = useState<"integral" | "parcial">("integral"), [valor, setValor] = useState("");
  const atualizar = useAtualizar(onSuccess);
  const intent = useIntencaoMulta<EntradaReceberMulta>(user?.id, "receber", contratoId, parcelaId, atualizar, status);
  const source = trpc.multaManual.cotar.useQuery({ contratoId, parcelaId }, { enabled: false, retry: false, staleTime: 0 });
  const query = useCotacaoAtual(intent.generation, !!user && aberta && intent.pronta && !intent.pendente && !intent.erro,
    `${contratoId}:${parcelaId}:${status}`, source, value => normalizarCotacaoMulta(value, { contratoId, parcelaId }));
  const q = query.data, form = useRef({ aberta, q, modo, valor }); form.current = { aberta, q, modo, valor };
  useEffect(() => { setModo("integral"); setValor(""); }, [user?.id, contratoId, parcelaId, origemUserId]);
  if (!user || !intent.pronta) return <p role="status">Aguardando a origem e sessão atuais.</p>;
  if (!aberta && !intent.pendente) return <p>Parcela encerrada. Nenhum novo recebimento será enviado.</p>;
  async function nova(): Promise<EntradaReceberMulta> {
    if (!intent.atual() || !form.current.aberta || form.current.q !== q || form.current.modo !== modo || form.current.valor !== valor || !q?.elegivel) throw Error("Recebimento sem cotação atual.");
    const p = receberMultaSchema.parse({ idempotencyKey: uuidValidacao, contratoId, parcelaId, modo, valorRecebido: modo === "integral" ? q.totalExigido : dinheiroIntencao(valor), totalExigido: q.totalExigido, dataPagamento: q.dataPagamento, estadoHash: q.estadoHash });
    return { ...p, idempotencyKey: crypto.randomUUID() };
  }
  return <section className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Receber parcela com multa</h3>
    {intent.erro && <p role="alert">{intent.erro}</p>}
    {intent.pendente ? <IntencaoMulta intent={intent} corrigir={() => setValor("")} encerrar /> : <>
      {query.isFetching && <p role="status">Conferindo a cotação financeira...</p>}
      {query.isError && <><p role="alert">Não foi possível obter cotação válida. Nenhum recebimento foi enviado.</p><Button variant="outline" onClick={query.refetch}>Tentar novamente</Button></>}
      {q && <>
        <p>Total exigido {q.totalExigido}; multa {q.multa}; mora {q.mora}. Data de pagamento {q.dataPagamento} (Brasília).</p>
        <p className="text-sm text-muted-foreground">Juros contratuais {q.jurosEmbutidos} já estão embutidos. Após a primeira baixa parcial, os próximos pagamentos consomem apenas o residual congelado, sem novos encargos.</p>
        <label className="block space-y-1"><Label>Tipo de recebimento</Label><select className="w-full rounded border bg-background p-2" value={modo} onChange={e => setModo(e.target.value as "integral" | "parcial")} disabled={intent.busy}><option value="integral">Integral — residual exato</option><option value="parcial">Parcial — positivo e menor que o residual</option></select></label>
        {modo === "parcial" && <label className="block space-y-1"><Label>Valor recebido (R$)</Label><Input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} disabled={intent.busy} placeholder="100.00" /></label>}
      </>}
    </>}
    {!intent.pendente?.confirmacao && <Button disabled={intent.busy || !!intent.erro || intent.recovery?.status === "not_executed" || (!intent.pendente && (!q?.elegivel || query.isError || !aberta))} onClick={() => intent.enviar(nova, p => multaManualRpc.receber.mutate(p))}>{intent.busy ? "Conferindo..." : intent.pendente ? "Repetir a mesma intenção de recebimento" : "Confirmar recebimento"}</Button>}
  </section>;
}
export function MultaManualRenovar({ contratoId, parcelaId, origemUserId, status, onSuccess }: Props) {
  const user = useSessao(origemUserId), aberta = ["pendente", "atrasada", "vencendo_hoje"].includes(status);
  const [novoVencimento, setVencimento] = useState("");
  const atualizar = useAtualizar(onSuccess);
  const intent = useIntencaoMulta<EntradaRenovarMulta>(user?.id, "renovar", contratoId, parcelaId, atualizar, status);
  const source = trpc.multaManual.cotarRenovacao.useQuery({ contratoId, parcelaId, novoVencimento }, { enabled: false, retry: false, staleTime: 0 });
  const query = useCotacaoAtual(intent.generation, !!user && aberta && intent.pronta && !intent.pendente && !intent.erro && dataMultimodalValida(novoVencimento),
    `${contratoId}:${parcelaId}:${novoVencimento}:${status}`, source, value => normalizarCotacaoRenovacaoMulta(value, { contratoId, parcelaId, novoVencimento }));
  const q = query.data, form = useRef({ aberta, q, novoVencimento }); form.current = { aberta, q, novoVencimento };
  useEffect(() => { setVencimento(""); }, [user?.id, contratoId, parcelaId, origemUserId]);
  if (!user || !intent.pronta) return <p role="status">Aguardando a origem e sessão atuais.</p>;
  if (!aberta && !intent.pendente) return <p>Parcela encerrada ou parcialmente recebida. Nenhuma nova renovação será enviada.</p>;
  async function nova(): Promise<EntradaRenovarMulta> {
    if (!intent.atual() || !form.current.aberta || form.current.q !== q || form.current.novoVencimento !== novoVencimento || !q?.renovavel) throw Error("Renovação sem cotação atual e cadeia íntegra.");
    const p = renovarMultaSchema.parse({ idempotencyKey: uuidValidacao, contratoId, parcelaId, novoVencimento: q.novoVencimento, valorRecebido: q.totalExigido, totalExigido: q.totalExigido, dataPagamento: q.dataPagamento, estadoHash: q.estadoHash });
    return { ...p, idempotencyKey: crypto.randomUUID() };
  }
  return <section className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Receber juros, multa e mora e renovar</h3>
    <p className="text-sm text-muted-foreground">Somente bullet elegível, sem pagamento parcial e sem Price. O principal é transferido uma única vez para a sucessora, sem novo desembolso e sem herdar multa manual.</p>
    {intent.erro && <p role="alert">{intent.erro}</p>}
    {intent.pendente ? <IntencaoMulta intent={intent} corrigir={() => setVencimento("")} /> : <>
      <label className="block space-y-1"><Label>Novo vencimento explícito</Label><Input type="date" value={novoVencimento} onChange={e => setVencimento(e.target.value)} disabled={intent.busy} /></label>
      {query.isFetching && <p role="status">Conferindo a cotação de renovação...</p>}
      {query.isError && <><p role="alert">Renovação não comprovada para este estado ou vencimento. Nenhuma cobrança foi enviada.</p><Button variant="outline" onClick={query.refetch}>Tentar novamente</Button></>}
      {q && <p>Receber {q.totalExigido}: juros {q.juros}, multa {q.multa}, mora {q.mora}. Principal preservado {q.principalPreservado}. Novo vencimento {q.novoVencimento}.</p>}
    </>}
    {!intent.pendente?.confirmacao && <Button disabled={intent.busy || !!intent.erro || intent.recovery?.status === "not_executed" || (!intent.pendente && (!q?.renovavel || query.isError || !aberta))} onClick={() => intent.enviar(nova, p => multaManualRpc.renovar.mutate(p))}>{intent.busy ? "Conferindo..." : intent.pendente ? "Repetir a mesma intenção de renovação" : "Confirmar juros e renovação"}</Button>}
  </section>;
}
