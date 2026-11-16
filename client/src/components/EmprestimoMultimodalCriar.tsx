import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { multimodalRpc, percentualMultimodal, useIntencaoMultimodal } from "./EmprestimoMultimodalRpc";
import { dinheiroIntencao } from "./EmprestimoSeguroRpc";
import { calcularMultimodal, gerarAgendaMultimodal, tipoTaxaMultimodal, validarEntradaCriacaoMultimodal, type ModalidadeMultimodal, type EntradaMultimodal } from "../../../shared/emprestimosMultimodalCalculo";

const nomes: Record<ModalidadeMultimodal, string> = { mensal: "Mensal — juros simples do período", semanal: "Semanal — juros simples do período", quinzenal: "Quinzenal — juros simples do período", diario: "Diário — taxa única sobre o principal", tabela_price: "Tabela Price — taxa mensal sobre saldo" };
export function EmprestimoMultimodalCriar({ onSuccess, modalidadeInicial = "mensal" }: { onSuccess: (id: number) => void; modalidadeInicial?: ModalidadeMultimodal }) {
  const auth = trpc.auth.me.useQuery(undefined, { refetchOnMount: false });
  const user = !auth.isError && !auth.isLoading && !auth.isFetching ? auth.data : undefined;
  const clientesQ = trpc.clientes.list.useQuery(undefined, { enabled: !!user });
  const contasQ = trpc.emprestimosMultimodal.contasParaCadastro.useQuery(undefined, { enabled: !!user });
  const capacidadesQ = trpc.emprestimosMultimodal.disponibilidade.useQuery(undefined, { enabled: !!user });
  const utils = trpc.useUtils();
  const [modalidade, setModalidade] = useState<ModalidadeMultimodal>(modalidadeInicial);
  const [clienteId, setCliente] = useState(""), [contaId, setConta] = useState("");
  const [principal, setPrincipal] = useState(""), [taxa, setTaxa] = useState("0");
  const [inicio, setInicio] = useState(""), [primeira, setPrimeira] = useState("");
  const [numero, setNumero] = useState("1"), [multa, setMulta] = useState("2.0000"), [mora, setMora] = useState("0.0330");
  const clientes = user && !clientesQ.isError && !clientesQ.isLoading && !clientesQ.isFetching ? (clientesQ.data?.clientes ?? []).filter(c => c.userId === user.id) : [];
  const contas = user && !contasQ.isError && !contasQ.isLoading && !contasQ.isFetching && contasQ.data?.empresaId === user.id ? contasQ.data?.contas ?? [] : [];
  const loading = clientesQ.isLoading || contasQ.isLoading || capacidadesQ.isLoading || clientesQ.isFetching || contasQ.isFetching || capacidadesQ.isFetching;
  const erroDados = clientesQ.isError || contasQ.isError || capacidadesQ.isError;
  const disponivel = !!user && !capacidadesQ.isError && !capacidadesQ.isLoading && !capacidadesQ.isFetching && capacidadesQ.data?.disponivel === true && Array.isArray(capacidadesQ.data.modalidades) && capacidadesQ.data.modalidades.includes(modalidade);
  const podeCriar = useRef(false); podeCriar.current = disponivel && !loading && !erroDados;
  const intent = useIntencaoMultimodal<EntradaMultimodal>(user?.id, "criar", result => {
    const id = (result as { id?: number })?.id;
    if (!Number.isInteger(id) || !id || id <= 0) return;
    void Promise.all([utils.contratos.list.invalidate(), utils.contratos.listComParcelas.invalidate(), utils.parcelas.list.invalidate(), utils.caixa.contas.invalidate(), utils.dashboard.kpis.invalidate(), utils.dashboard.resumoCaixa.invalidate()]).catch(() => {});
    onSuccess(id);
  });
  useEffect(() => {
    setCliente(""); setConta(""); setPrincipal(""); setTaxa("0"); setInicio(""); setPrimeira(""); setNumero("1"); setMulta("2.0000"); setMora("0.0330"); setModalidade(modalidadeInicial);
  }, [user?.id]);
  async function atualizar() { await Promise.all([clientesQ.refetch(), contasQ.refetch(), capacidadesQ.refetch()]); }
  let previa: ReturnType<typeof calcularMultimodal> | null = null, datas: string[] = [], erroPrevia = "";
  if (principal && primeira && numero) {
    try { previa = calcularMultimodal(dinheiroIntencao(principal), dinheiroIntencao(taxa), Number(numero), modalidade); datas = gerarAgendaMultimodal(primeira, Number(numero), modalidade); }
    catch (e) { erroPrevia = (e as Error).message; }
  }
  async function novoPayload(): Promise<EntradaMultimodal> {
    if (!intent.atual() || !podeCriar.current) throw new Error("Cadastro sem sessão e capacidades atuais; não iniciar outra intenção.");
    if (!clienteId || !contaId || !inicio || !primeira || !clientes.some(c => c.id === Number(clienteId)) || !contas.some(c => c.id === Number(contaId))) throw new Error("Cliente e conta próprios, principal e datas civis devem ser selecionados explicitamente.");
    const payload: EntradaMultimodal = {
      idempotencyKey: crypto.randomUUID(), clienteId: Number(clienteId), contaCaixaId: Number(contaId), modalidade,
      tipoTaxa: tipoTaxaMultimodal[modalidade], valorPrincipal: dinheiroIntencao(principal), taxaJuros: dinheiroIntencao(taxa),
      numeroParcelas: Number(numero), dataInicio: inicio, dataDesembolso: inicio, vencimentos: gerarAgendaMultimodal(primeira, Number(numero), modalidade),
      multaAtraso: percentualMultimodal(multa), jurosMoraDiario: percentualMultimodal(mora),
    };
    validarEntradaCriacaoMultimodal(payload);
    const validada = await multimodalRpc.validarCriacao.mutate(payload);
    if (!validada?.validada || !intent.atual() || !podeCriar.current) throw new Error("Validação incompleta ou sessão mudou; não iniciar intenção.");
    return payload;
  }
  function corrigirOuConcluir() {
    const old = intent.concluirOuCorrigir();
    if (old) {
      setModalidade(old.modalidade); setCliente(String(old.clienteId)); setConta(String(old.contaCaixaId)); setPrincipal(String(old.valorPrincipal)); setTaxa(String(old.taxaJuros));
      setInicio(old.dataInicio); setPrimeira(old.vencimentos[0]); setNumero(String(old.numeroParcelas)); setMulta(String(old.multaAtraso)); setMora(String(old.jurosMoraDiario));
    } else if (intent.encerrada()) {
      setPrincipal(""); setCliente(""); setConta(""); setInicio(""); setPrimeira("");
    }
  }
  if (!intent.pronta) return <p role="status">Aguardando a sessão atual.</p>;
  return <section className="space-y-4 rounded-lg border p-4">
    <h2 className="font-semibold">Cadastrar empréstimo e registrar desembolso</h2>
    <p className="text-sm text-muted-foreground">Contrato, parcelas e saída do principal são confirmados juntos. Taxa diária é única sobre o principal; mensal, semanal e quinzenal usam juros simples por período. Price amortiza o saldo com taxa mensal. Encargos só após virar o dia em Brasília.</p>
    {loading && <p role="status">Carregando dados próprios do cadastro...</p>}
    {erroDados && <p role="alert">Não foi possível carregar os dados. Nenhum cadastro foi gravado por essa consulta.</p>}
    {!loading && !erroDados && !disponivel && <p role="alert">O ciclo desta modalidade está indisponível. Atualize os dados antes de tentar; a operação não será convertida para outra modalidade.</p>}
    <Button type="button" variant="outline" disabled={intent.busy} onClick={atualizar}>Atualizar dados do cadastro</Button>
    {intent.erro && <p role="alert">{intent.erro}</p>}
    {!loading && !erroDados && !intent.pendente && clientes.length === 0 && <p>Cadastre primeiro um cliente da sua empresa em <a className="underline" href="/clientes">Clientes</a>.</p>}
    {!loading && !erroDados && !intent.pendente && contas.length === 0 && <p>Cadastre uma conta própria de Caixa antes do desembolso.</p>}
    {intent.pendente ? <div className="space-y-2">
      <p>Intenção preservada: <code>{intent.pendente.payload.idempotencyKey}</code></p>
      <p>{nomes[intent.pendente.payload.modalidade]} — {intent.pendente.payload.numeroParcelas} parcelas.</p>
      <p>{intent.pendente.confirmacao ? "Confirmada. Não será enviado outro desembolso ao repetir." : "Aguardando confirmação. Após timeout/reload será usado exatamente o UUID e payload original."}</p>
      {!intent.pendente.confirmacao && <Button type="button" variant="outline" disabled={intent.busy} onClick={intent.reconciliar}>Conferir intenção no servidor</Button>}
      {(!!intent.pendente.confirmacao || intent.recovery?.status === "not_executed") && <Button type="button" variant="outline" disabled={intent.busy} onClick={corrigirOuConcluir}>{intent.pendente.confirmacao ? "Iniciar outro cadastro após confirmação" : "Corrigir após não execução comprovada"}</Button>}
    </div> : <fieldset disabled={intent.busy} className="grid gap-3 sm:grid-cols-2">
      <label><Label>Modalidade e regra de juros</Label><select className="w-full border p-2 rounded bg-background" value={modalidade} onChange={e => setModalidade(e.target.value as ModalidadeMultimodal)}>{Object.entries(nomes).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
      <label><Label>Cliente da empresa</Label><select className="w-full border p-2 rounded bg-background" value={clienteId} onChange={e => setCliente(e.target.value)}><option value="">Selecione</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label><Label>Conta própria de desembolso e recebimento</Label><select className="w-full border p-2 rounded bg-background" value={contaId} onChange={e => setConta(e.target.value)}><option value="">Selecione</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label><Label>Principal (decimal)</Label><Input inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="1000.00" /></label>
      <label><Label>{modalidade === "diario" ? "Taxa única (%)" : modalidade === "tabela_price" ? "Taxa mensal Price (%)" : "Taxa do período (%)"}</Label><Input inputMode="decimal" value={taxa} onChange={e => setTaxa(e.target.value)} /></label>
      <label><Label>Número de parcelas (1 a 60)</Label><Input type="number" min={1} max={60} value={numero} onChange={e => setNumero(e.target.value)} /></label>
      <label><Label>Data de início e desembolso</Label><Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
      <label><Label>Primeiro vencimento</Label><Input type="date" value={primeira} onChange={e => setPrimeira(e.target.value)} /></label>
      <label><Label>Multa após atraso (%)</Label><Input inputMode="decimal" value={multa} onChange={e => setMulta(e.target.value)} /></label>
      <label><Label>Mora simples por dia após atraso (%)</Label><Input inputMode="decimal" value={mora} onChange={e => setMora(e.target.value)} /></label>
      {erroPrevia && <p role="alert" className="sm:col-span-2">{erroPrevia}</p>}
      {previa && <div className="space-y-1 sm:col-span-2 text-sm">
        <p>Prévia: principal {previa.valorPrincipal}; juros contratuais {previa.jurosTotal}; total {previa.totalContrato}.</p>
        <p>Parcela de referência {previa.valorParcela}. Última parcela {previa.parcelas[previa.parcelas.length - 1].valor}; centavos e principal conservados.</p>
        <p>Vencimentos: {datas.join(", ")}</p>
      </div>}
    </fieldset>}
    {!intent.pendente?.confirmacao && <Button disabled={intent.busy || !disponivel || !!intent.erro || intent.recovery?.status === "not_executed" || (!intent.pendente && (loading || erroDados || clientes.length === 0 || contas.length === 0))} onClick={() => intent.enviar(novoPayload, payload => multimodalRpc.criar.mutate(payload))}>{intent.busy ? "Conferindo..." : intent.pendente ? "Conferir/repetir a mesma intenção" : "Confirmar cadastro e desembolso"}</Button>}
  </section>;
}
