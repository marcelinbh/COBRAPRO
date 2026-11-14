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
  const utils = trpc.useUtils();
  const clientesQuery = trpc.clientes.list.useQuery(undefined, { enabled: !!user });
  const contasQuery = trpc.emprestimosProspectivos.contasParaCadastro.useQuery(undefined, { enabled: !!user });
  const disponibilidadeQuery = trpc.emprestimosProspectivos.disponibilidade.useQuery(undefined, { enabled: !!user });
  const disponivel = disponibilidadeQuery.data?.disponivel === true && !disponibilidadeQuery.isError;
  // Um cache da sessão anterior nunca preenche os seletores da empresa atual.
  const clientes = clientesQuery.isError ? [] : (clientesQuery.data?.clientes ?? []).filter(c => c.userId === user?.id);
  const contas = !contasQuery.isError && contasQuery.data?.empresaId === user?.id ? contasQuery.data?.contas ?? [] : [];
  const carregandoDados = clientesQuery.isLoading || contasQuery.isLoading || disponibilidadeQuery.isLoading;
  const erroDados = clientesQuery.isError || contasQuery.isError || disponibilidadeQuery.isError;
  const [clienteId, setCliente] = useState(""); const [contaId, setConta] = useState("");
  const [principal, setPrincipal] = useState(""); const [taxa, setTaxa] = useState("0");
  const [inicio, setInicio] = useState(""); const [datas, setDatas] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendente, setPendente] = useState<IntencaoPersistida<EntradaEmprestimoProspectivo> | null>(null);
  const [erroSessao, setErroSessao] = useState("");
  const ref = useRef<IntencaoPersistida<EntradaEmprestimoProspectivo> | null>(null);
  const flight = useRef(false);
  const [recovery, setRecovery] = useState<RecoveryEvidence>();
  const key = user ? chaveIntencao(user.id, "criar") : "";
  const escopoAtual = useRef(key);
  escopoAtual.current = key;
  const [escopoDaTela, setEscopoDaTela] = useState("");
  async function atualizarCadastro() {
    await Promise.all([clientesQuery.refetch(), contasQuery.refetch(), disponibilidadeQuery.refetch()]);
  }
  useEffect(() => {
    ref.current = null; setPendente(null);
    flight.current = false; setRecovery(undefined);
    setEscopoDaTela(key); setErroSessao(""); setBusy(false);
    setCliente(""); setConta(""); setPrincipal(""); setTaxa("0"); setInicio(""); setDatas("");
    if (!key) return;
    void atualizarCadastro();
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
      // Refetch é leitura: falhar aqui não desfaz a confirmação nem cria outra dívida.
      void Promise.all([
        utils.contratos.list.invalidate(), utils.contratos.listComParcelas.invalidate(),
        utils.parcelas.list.invalidate(), utils.caixa.contas.invalidate(),
        utils.dashboard.kpis.invalidate(), utils.dashboard.resumoCaixa.invalidate(),
      ]).catch(() => { /* A confirmação autoritativa permanece preservada na intenção. */ });
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
    <h2 className="font-semibold">Cadastrar empréstimo mensal</h2>
    <p className="text-sm text-muted-foreground">Taxa mensal simples, de 1 a 60 parcelas. O cadastro registra o desembolso e as parcelas juntos, na sua empresa. Informe datas mensais consecutivas; com várias parcelas, use o mesmo dia entre 1 e 28. O acerto de centavos é feito na última parcela. Multa de 2% e mora simples de 0,033% ao dia, apenas após o vencimento no horário de Brasília.</p>
    {carregandoDados && <p role="status">Carregando os dados do cadastro...</p>}
    {erroDados && <p role="alert">Não foi possível carregar os dados do cadastro. Tente novamente; nenhum empréstimo foi criado por essa consulta.</p>}
    {!carregandoDados && !erroDados && !disponivel && <p role="alert">O serviço de cadastro de empréstimos está temporariamente indisponível. Tente novamente ou contate o suporte.</p>}
    <Button type="button" variant="outline" disabled={busy || clientesQuery.isFetching || contasQuery.isFetching || disponibilidadeQuery.isFetching} onClick={atualizarCadastro}>Atualizar dados do cadastro</Button>
    {!carregandoDados && !erroDados && !pendente && clientes.length === 0 && <p>Cadastre primeiro um cliente da sua empresa em <a className="underline" href="/clientes">Clientes</a>.</p>}
    {!carregandoDados && !erroDados && !pendente && contas.length === 0 && <p>Cadastre uma conta de Caixa da sua empresa antes do desembolso.</p>}
    {erroSessao && <p role="alert">{erroSessao}</p>}
    {pendente ? <div className="space-y-2">
      <p>Intenção preservada: <code>{pendente.payload.idempotencyKey}</code></p>
      <pre className="overflow-auto text-xs">{JSON.stringify(pendente.payload, null, 2)}</pre>
      <p>{pendente.confirmacao ? "Confirmada. Uma nova intenção só pode ser iniciada após conferir esta confirmação." : "Aguardando confirmação. Mesmo após reload/timeout será repetido o UUID e o payload acima. Não inicie outra intenção para a mesma dívida."}</p>
      {!!pendente.confirmacao && <Button variant="outline" onClick={() => { sessionStorage.removeItem(key); ref.current = null; setPendente(null); }}>Iniciar outro empréstimo após confirmação</Button>}
      {!pendente.confirmacao && <Button variant="outline" disabled={busy} onClick={reconciliar}>Reconciliar UUID no servidor (pode encerrar sem execução)</Button>}
      {recovery?.status === "not_executed" && <><p role="status">Não execução comprovada pelo servidor. UUID bloqueado permanentemente para POST atrasado. Correção não converte modalidade.</p><Button disabled={busy} onClick={corrigirRejeitada}>Corrigir campos após não execução comprovada</Button></>}
    </div> : <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      <label><Label>Cliente</Label><select className="w-full border p-2 rounded bg-background" value={clienteId} onChange={e => setCliente(e.target.value)}><option value="">Selecione</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label><Label>Conta de desembolso e recebimento</Label><select className="w-full border p-2 rounded bg-background" value={contaId} onChange={e => setConta(e.target.value)}><option value="">Selecione</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label><Label>Principal (decimal)</Label><Input value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="1000.00" /></label>
      <label><Label>Taxa mensal (%)</Label><Input value={taxa} onChange={e => setTaxa(e.target.value)} /></label>
      <label><Label>Início = desembolso</Label><Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
      <label><Label>Vencimentos YYYY-MM-DD separados por vírgula</Label><Input value={datas} onChange={e => setDatas(e.target.value)} placeholder="2027-01-15, 2027-02-15" /></label>
    </fieldset>}
    <Button disabled={busy || !disponivel || !key || !!erroSessao || recovery?.status === "not_executed" || (!pendente && (carregandoDados || erroDados || clientes.length === 0 || contas.length === 0))} onClick={enviar}>{busy ? "Conferindo..." : pendente ? "Conferir/repetir a mesma intenção" : "Cadastrar empréstimo e registrar desembolso"}</Button>
  </section>;
}
