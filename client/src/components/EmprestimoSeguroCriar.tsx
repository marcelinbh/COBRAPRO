import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cicloRpc, chaveIntencao, guardarIntencao, lerIntencao, dinheiroIntencao, escopoFinanceiroAtual, type IntencaoPersistida } from "./EmprestimoSeguroRpc";
import type { EntradaEmprestimoProspectivo } from "../../../server/services/emprestimosRpc";
import { assertRecoveryEvidence, canCloseRejectedIntent, recoveryRequest, type RecoveryEvidence } from "../../../shared/financialIntentRecovery";

export function EmprestimoSeguroCriar({ onSuccess }: { onSuccess: (id: number) => void }) {
  const { data: user } = trpc.auth.me.useQuery();
  const { data: clientes } = trpc.clientes.list.useQuery();
  const { data: contas } = trpc.caixa.contas.useQuery();
  const [clienteId, setCliente] = useState(""); const [contaId, setConta] = useState("");
  const [principal, setPrincipal] = useState(""); const [taxa, setTaxa] = useState("0");
  const [inicio, setInicio] = useState(""); const [datas, setDatas] = useState("");
  const [busy, setBusy] = useState(false); const [disponivel, setDisponivel] = useState(false);
  const [pendente, setPendente] = useState<IntencaoPersistida<EntradaEmprestimoProspectivo> | null>(null);
  const [erroSessao, setErroSessao] = useState("");
  const ref = useRef<IntencaoPersistida<EntradaEmprestimoProspectivo> | null>(null);
  const flight = useRef(false);
  const [recovery, setRecovery] = useState<RecoveryEvidence>();
  const key = user ? chaveIntencao(user.id, "criar") : "";
  const escopoAtual = useRef(key);
  escopoAtual.current = key;
  const [escopoDaTela, setEscopoDaTela] = useState("");
  useEffect(() => {
    let active = true;
    cicloRpc.disponibilidade.query().then(r => { if (active) setDisponivel(r.disponivel); }).catch(() => { if (active) setDisponivel(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    ref.current = null; setPendente(null);
    flight.current = false; setRecovery(undefined);
    setEscopoDaTela(key); setErroSessao(""); setBusy(false);
    setCliente(""); setConta(""); setPrincipal(""); setTaxa("0"); setInicio(""); setDatas("");
    if (!key) return;
    try { const p = lerIntencao<EntradaEmprestimoProspectivo>(sessionStorage, key); ref.current = p; setPendente(p); }
    catch (e) { setErroSessao((e as Error).message); }
  }, [key]);
  async function enviar() {
    if (!escopoFinanceiroAtual(escopoAtual, key) || escopoDaTela !== key || busy || erroSessao) return;
    if (flight.current || recovery?.status === "not_executed") return;
    flight.current = true;
    setBusy(true);
    try {
      let p = ref.current;
      if (!p) {
        const vencimentos = datas.split(/[\s,;]+/).filter(Boolean);
        if (!clienteId || !contaId || !inicio || !vencimentos.length || vencimentos.length > 60) throw new Error("Cliente, conta, início e 1..60 datas civis são obrigatórios.");
        const payload: EntradaEmprestimoProspectivo = { idempotencyKey: crypto.randomUUID(), clienteId: Number(clienteId), contaCaixaId: Number(contaId),
          modalidade: "mensal", tipoTaxa: "mensal", valorPrincipal: dinheiroIntencao(principal), taxaJuros: dinheiroIntencao(taxa),
          numeroParcelas: vencimentos.length, dataInicio: inicio, dataDesembolso: inicio, vencimentos };
        // TODA validação determinística do adaptador (agenda/catálogo/rateio) antes de persistir.
        const validation = await cicloRpc.validarCriacao.mutate(payload);
        if (!escopoFinanceiroAtual(escopoAtual, key)) return;
        if (validation.validada !== true) throw new Error("Validação incompleta. Nenhuma intenção persistida ou enviada.");
        p = { versao: 1, payload };
        guardarIntencao(sessionStorage, key, p); ref.current = p; setPendente(p);
      }
      // Reenvia payload original integral, nunca reconstrói de campos atuais após timeout.
      const result = await cicloRpc.criar.mutate(p.payload);
      if (!escopoFinanceiroAtual(escopoAtual, key)) return;
      const confirmed = { ...p, confirmacao: result };
      guardarIntencao(sessionStorage, key, confirmed); ref.current = confirmed; setPendente(confirmed);
      toast.success(`Contrato #${result.id} confirmado. Total ${result.totalContrato}; última parcela pode diferir por centavos.`);
      onSuccess(result.id);
    } catch (e) { if (escopoFinanceiroAtual(escopoAtual, key)) toast.error(`${(e as Error).message} Preserve a intenção para conferir/repetir; erro de transporte não prova rollback.`); }
    finally { if (escopoFinanceiroAtual(escopoAtual, key)) { flight.current = false; setBusy(false); } }
  }
  async function reconciliar() {
    const p = ref.current;
    if (!p || !user || flight.current || !escopoFinanceiroAtual(escopoAtual, key)) return;
    flight.current = true; setBusy(true);
    try {
      const request = recoveryRequest("emprestimo_criar", p.payload);
      const r = assertRecoveryEvidence(await cicloRpc.reconciliar.mutate(request), user.id, request);
      if (!escopoFinanceiroAtual(escopoAtual, key) || ref.current?.payload.idempotencyKey !== p.payload.idempotencyKey) return;
      setRecovery(r);
      if (r.status === "confirmed") {
        const confirmed = { ...p, confirmacao: r.result };
        guardarIntencao(sessionStorage, key, confirmed); ref.current = confirmed; setPendente(confirmed);
        onSuccess((r.result as { id: number }).id);
      }
    } catch (e) { if (escopoFinanceiroAtual(escopoAtual, key)) toast.error(`${(e as Error).message} Não execução NÃO comprovada; nenhum descarte permitido.`); }
    finally { if (escopoFinanceiroAtual(escopoAtual, key)) { flight.current = false; setBusy(false); } }
  }
  function corrigirRejeitada() {
    const p = ref.current;
    if (!p || !user || flight.current || !canCloseRejectedIntent(recovery, user.id, recoveryRequest("emprestimo_criar", p.payload))) return;
    try {
      // Não gera chave aqui: volta a campos explícitos somente após fence server confirmado.
      sessionStorage.removeItem(key);
      setCliente(String(p.payload.clienteId)); setConta(String(p.payload.contaCaixaId));
      setPrincipal(String(p.payload.valorPrincipal)); setTaxa(String(p.payload.taxaJuros));
      setInicio(p.payload.dataInicio); setDatas(p.payload.vencimentos.join(", "));
      ref.current = null; setPendente(null); setRecovery(undefined);
    } catch { toast.error("Não foi possível remover a intenção. Preserve a chave; formulário continua bloqueado."); }
  }
  if (!key || escopoDaTela !== key) return <p>Aguardando a sessão atual para recuperar sua intenção.</p>;
  return <section className="space-y-4 rounded-lg border p-4">
    <h2 className="font-semibold">Novo empréstimo seguro — mensal simples</h2>
    <p className="text-sm text-muted-foreground">Somente taxa mensal simples, 1..60 parcelas. Desembolso único do principal e juros embutidos. Datas consecutivas explícitas, mesmo dia 1..28 se houver várias. O ajuste de centavos fecha na última parcela. Defaults: multa 2% e mora simples 0,033%/dia civil BRT, somente após vencimento. Sem descontos ou renovação.</p>
    <p className="text-sm">Price, diário, semanal, quinzenal, bullet, venda, cheque e reparcelamento não estão suportados neste ciclo. O formulário legado não é uma alternativa financeira segura.</p>
    {!disponivel && <p role="alert">Criação e recebimento prospectivos ainda não foram habilitados juntos pelo responsável. Não há envio REST.</p>}
    {erroSessao && <p role="alert">{erroSessao}</p>}
    {pendente ? <div className="space-y-2">
      <p>Intenção preservada: <code>{pendente.payload.idempotencyKey}</code></p>
      <pre className="overflow-auto text-xs">{JSON.stringify(pendente.payload, null, 2)}</pre>
      <p>{pendente.confirmacao ? "Confirmada. Uma nova intenção só pode ser iniciada após conferir esta confirmação." : "Aguardando confirmação. Mesmo após reload/timeout será repetido o UUID e o payload acima. Não inicie outra intenção para a mesma dívida."}</p>
      {!!pendente.confirmacao && <Button variant="outline" onClick={() => { sessionStorage.removeItem(key); ref.current = null; setPendente(null); }}>Iniciar outro empréstimo após confirmação</Button>}
      {!pendente.confirmacao && <Button variant="outline" disabled={busy} onClick={reconciliar}>Reconciliar UUID no servidor (pode encerrar sem execução)</Button>}
      {recovery?.status === "not_executed" && <><p role="status">Não execução comprovada pelo servidor. UUID bloqueado permanentemente para POST atrasado. Correção não converte modalidade.</p><Button disabled={busy} onClick={corrigirRejeitada}>Corrigir campos após não execução comprovada</Button></>}
    </div> : <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      <label><Label>Cliente</Label><select className="w-full border p-2 rounded bg-background" value={clienteId} onChange={e => setCliente(e.target.value)}><option value="">Selecione</option>{clientes?.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label><Label>Conta original de desembolso e recebimento</Label><select className="w-full border p-2 rounded bg-background" value={contaId} onChange={e => setConta(e.target.value)}><option value="">Selecione</option>{contas?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label><Label>Principal (decimal)</Label><Input value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="1000.00" /></label>
      <label><Label>Taxa mensal (%)</Label><Input value={taxa} onChange={e => setTaxa(e.target.value)} /></label>
      <label><Label>Início = desembolso</Label><Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
      <label><Label>Vencimentos YYYY-MM-DD separados por vírgula</Label><Input value={datas} onChange={e => setDatas(e.target.value)} placeholder="2027-01-15, 2027-02-15" /></label>
    </fieldset>}
    <Button disabled={busy || !disponivel || !key || !!erroSessao || recovery?.status === "not_executed"} onClick={enviar}>{busy ? "Conferindo..." : pendente ? "Conferir/repetir a mesma intenção" : "Confirmar criação e desembolso atômicos"}</Button>
  </section>;
}
