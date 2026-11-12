import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cicloRpc, chaveIntencao, guardarIntencao, lerIntencao, dinheiroIntencao, escopoFinanceiroAtual, type IntencaoPersistida } from "./EmprestimoSeguroRpc";
import type { CotacaoEmprestimoProspectivo, EntradaRecebimentoProspectivo, ResultadoRecebimentoProspectivo } from "../../../server/services/cicloEmprestimosRpc";
import { assertRecoveryEvidence, canCloseRejectedIntent, recoveryRequest, type RecoveryEvidence } from "../../../shared/financialIntentRecovery";

export function EmprestimoSeguroReceber({ contratoId, parcelaId, onSuccess }: { contratoId: number; parcelaId: number; onSuccess: () => void }) {
  const { data: user } = trpc.auth.me.useQuery();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [cotacao, setCotacao] = useState<CotacaoEmprestimoProspectivo | null>(null);
  const [valor, setValor] = useState(""); const [modo, setModo] = useState<"integral" | "parcial">("integral");
  const [erro, setErro] = useState("");
  const [pendente, setPendente] = useState<IntencaoPersistida<EntradaRecebimentoProspectivo> | null>(null);
  const ref = useRef<IntencaoPersistida<EntradaRecebimentoProspectivo> | null>(null);
  const flight = useRef(false);
  const [recovery, setRecovery] = useState<RecoveryEvidence>();
  const key = user ? chaveIntencao(user.id, "receber", parcelaId) : "";
  const escopo = key ? `${key}:contrato:${contratoId}` : "";
  const escopoAtual = useRef(escopo);
  escopoAtual.current = escopo;
  const [escopoDaTela, setEscopoDaTela] = useState("");
  useEffect(() => {
    ref.current = null; setPendente(null);
    flight.current = false; setRecovery(undefined);
    setEscopoDaTela(escopo); setErro(""); setCotacao(null); setValor(""); setModo("integral"); setBusy(false); setOpen(false);
    if (!key) return;
    try {
      const p = lerIntencao<EntradaRecebimentoProspectivo>(sessionStorage, key);
      if (p && (p.payload.parcelaId !== parcelaId || p.payload.contratoId !== contratoId)) throw new Error("Intenção armazenada pertence a outro contrato. Confira antes de prosseguir.");
      ref.current = p; setPendente(p);
    } catch (e) { setErro((e as Error).message); }
  }, [key, escopo, contratoId, parcelaId]);
  async function consultar() {
    if (!escopoFinanceiroAtual(escopoAtual, escopo) || escopoDaTela !== escopo) return;
    if (ref.current || flight.current) return;
    flight.current = true;
    setBusy(true); setErro("");
    try { const q = await cicloRpc.cotar.query({ contratoId, parcelaId }); if (!escopoFinanceiroAtual(escopoAtual, escopo)) return; setCotacao(q); setValor(q.totalExigido); }
    catch (e) { if (escopoFinanceiroAtual(escopoAtual, escopo)) setErro(`${(e as Error).message} Apenas proveniência 0021 íntegra é elegível. Recebimento legado permanece suspenso, sem alternativa REST.`); }
    finally { if (escopoFinanceiroAtual(escopoAtual, escopo)) { flight.current = false; setBusy(false); } }
  }
  async function enviar() {
    if (!escopoFinanceiroAtual(escopoAtual, escopo) || escopoDaTela !== escopo || busy) return;
    if (flight.current || recovery?.status === "not_executed") return;
    flight.current = true;
    setBusy(true);
    try {
      let p = ref.current;
      if (!p) {
        if (!cotacao?.elegivel) throw new Error("Cotação SQL elegível é obrigatória.");
        const recebido = dinheiroIntencao(valor);
        const rc = BigInt(recebido.replace(".", "")), tc = BigInt(cotacao.totalExigido.replace(".", ""));
        if (rc <= BigInt(0) || (modo === "integral" ? rc !== tc : rc >= tc)) throw new Error("Integral = total exato; parcial = positivo menor. Sem desconto.");
        p = { versao: 1, payload: { idempotencyKey: crypto.randomUUID(), contratoId, parcelaId, valorRecebido: recebido,
          totalExigido: cotacao.totalExigido, dataPagamento: cotacao.dataPagamento, estadoHash: cotacao.estadoHash, modo } };
        guardarIntencao(sessionStorage, key, p); ref.current = p; setPendente(p);
      }
      const r = await cicloRpc.receber.mutate(p.payload);
      if (!escopoFinanceiroAtual(escopoAtual, escopo)) return;
      const confirmed = { ...p, confirmacao: r };
      guardarIntencao(sessionStorage, key, confirmed); ref.current = confirmed; setPendente(confirmed);
      toast.success(`Recebimento confirmado: ${r.valorRecebido}; residual ${r.saldoResidual}; operação ${r.operationId}.`);
      onSuccess();
    } catch (e) { if (escopoFinanceiroAtual(escopoAtual, escopo)) setErro(`${(e as Error).message} Não presuma rollback: conserve e confira o mesmo UUID/payload antes de iniciar nova intenção.`); }
    finally { if (escopoFinanceiroAtual(escopoAtual, escopo)) { flight.current = false; setBusy(false); } }
  }
  async function reconciliar() {
    const p = ref.current;
    if (!p || !user || flight.current || !escopoFinanceiroAtual(escopoAtual, escopo)) return;
    flight.current = true; setBusy(true);
    try {
      const request = recoveryRequest("emprestimo_receber", p.payload);
      const r = assertRecoveryEvidence(await cicloRpc.reconciliar.mutate(request), user.id, request);
      if (!escopoFinanceiroAtual(escopoAtual, escopo) || ref.current?.payload.idempotencyKey !== p.payload.idempotencyKey) return;
      setRecovery(r); setErro("");
      if (r.status === "confirmed") {
        const confirmed = { ...p, confirmacao: r.result };
        guardarIntencao(sessionStorage, key, confirmed); ref.current = confirmed; setPendente(confirmed); onSuccess();
      }
    } catch (e) { if (escopoFinanceiroAtual(escopoAtual, escopo)) setErro(`${(e as Error).message} Não execução NÃO comprovada. Sem descarte; mantenha UUID/payload para conferência/retry.`); }
    finally { if (escopoFinanceiroAtual(escopoAtual, escopo)) { flight.current = false; setBusy(false); } }
  }
  function recotarRejeitada() {
    const p = ref.current;
    if (!p || !user || flight.current || !canCloseRejectedIntent(recovery, user.id, recoveryRequest("emprestimo_receber", p.payload))) return;
    try {
      sessionStorage.removeItem(key); ref.current = null; setPendente(null); setRecovery(undefined);
      setCotacao(null); setValor(""); setModo("integral"); setErro(""); void consultar();
    } catch { setErro("Armazenamento não liberado; intenção preservada. Não inicie outra operação."); }
  }
  function prepararNovoParcial() {
    if (!pendente?.confirmacao) return;
    const r = pendente.confirmacao as ResultadoRecebimentoProspectivo;
    if (r.status !== "parcial") return;
    sessionStorage.removeItem(key); ref.current = null; setPendente(null); setCotacao(null); void consultar();
  }
  if (!key || escopoDaTela !== escopo) return <span>Aguardando a sessão atual.</span>;
  return <>
    <Button size="sm" onClick={e => { e.stopPropagation(); setOpen(true); if (!ref.current) void consultar(); }}>Receber / conferir</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Recebimento prospectivo seguro</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <p className="text-sm">Contrato #{contratoId}, parcela #{parcelaId}. Renovação e descontos não suportados; parcial mantém residual na mesma parcela. Conta original fixa, sem troca.</p>
        {erro && <p role="alert" className="text-sm">{erro}</p>}
        {pendente ? <>
          <p>Intenção preservada: <code className="text-xs">{pendente.payload.idempotencyKey}</code></p>
          <pre className="text-xs overflow-auto">{JSON.stringify(pendente.payload, null, 2)}</pre>
          {pendente.confirmacao && <><p>Confirmado:</p><pre className="text-xs overflow-auto">{JSON.stringify(pendente.confirmacao, null, 2)}</pre><Button variant="outline" onClick={prepararNovoParcial}>Receber próximo parcial após confirmação</Button></>}
          {!pendente.confirmacao && <Button variant="outline" disabled={busy} onClick={reconciliar}>Reconciliar UUID e estado SQL (pode encerrar sem execução)</Button>}
          {recovery?.status === "not_executed" && <><p role="status">Não execução comprovada. UUID bloqueado para POST atrasado; nenhuma baixa feita por esta intenção.</p><Button disabled={busy} onClick={recotarRejeitada}>Recotar após não execução comprovada</Button></>}
        </> : cotacao && <>
          <p>Conta original #{cotacao.contaCaixaId}. Data civil SQL BRT: {cotacao.dataPagamento}. Vencimento: {cotacao.vencimento}.</p>
          <p>Exigido: {cotacao.totalExigido}. Multa: {cotacao.multa}; mora: {cotacao.mora}. Juros embutidos {cotacao.jurosEmbutidos} já inclusos, não somados novamente.</p>
          {!cotacao.elegivel && <p>Parcela paga ou não elegível: não há nova baixa.</p>}
          <label>Modo<select className="w-full border p-2 rounded bg-background" value={modo} onChange={e => { const m = e.target.value as "integral" | "parcial"; setModo(m); setValor(m === "integral" ? cotacao.totalExigido : ""); }}><option value="integral">Integral — exatamente o total</option><option value="parcial">Parcial — sem desconto</option></select></label>
          <label>Valor realmente recebido<Input value={valor} disabled={modo === "integral" || busy} onChange={e => setValor(e.target.value)} /></label>
          <Button variant="outline" disabled={busy} onClick={consultar}>Atualizar cotação SQL antes de confirmar</Button>
        </>}
        <Button disabled={busy || !key || recovery?.status === "not_executed" || (!pendente && (!cotacao?.elegivel || !!erro))} onClick={enviar}>{busy ? "Conferindo..." : pendente ? "Conferir/repetir UUID e payload preservados" : "Confirmar valor recebido"}</Button>
        <p className="text-xs text-muted-foreground">Timeout ou reload não gera chave nova. Se a cotação mudar após envio, confira a intenção existente e o histórico; não há reset automático ou promessa de rollback.</p>
      </div>
    </DialogContent></Dialog>
  </>;
}
