import { useState } from "react";
import { useTranslation } from "react-i18next";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { formatarMoeda } from "../../../shared/finance";
import { abertoCentavosRelatorio, adicionarDiasRelatorio, atrasadaRelatorio, dataRelatorio, formatarDataRelatorio, hojeRelatorio, leituraValidada, resumirLedgerRelatorio, type LeituraRelatorio } from "../../../shared/reporting";

function EstadoLeitura({ leitura, carregando, erro }: { leitura?: LeituraRelatorio<unknown> | null; carregando: boolean; erro?: string }) {
  if (carregando) return <p className="text-sm text-muted-foreground">Carregando e validando a leitura...</p>;
  if (erro) return <p role="alert" className="text-sm text-warning">Indisponível: {erro} Valores não calculados.</p>;
  if (!leituraValidada(leitura ?? undefined)) return <p role="alert" className="text-sm text-warning">Indisponível para revisão. {leitura?.status === "indisponivel" ? leitura.motivo : "Completude não confirmada."}</p>;
  return null;
}

function Indicador({ titulo, valor }: { titulo: string; valor: number }) {
  return <div className="rounded-lg border border-border bg-muted/20 p-4"><div className="text-xs text-muted-foreground uppercase mb-2">{titulo}</div><div className="font-display text-xl">{formatarMoeda(valor)}</div></div>;
}

export default function Relatorios() {
  const { t } = useTranslation();
  const hoje = hojeRelatorio();
  const [dataInicio, setDataInicio] = useState(`${hoje.slice(0, 7)}-01`);
  const [dataFim, setDataFim] = useState(hoje);
  const [modalidade, setModalidade] = useState("todas");
  const [clienteSelecionado, setClienteSelecionado] = useState("todos");
  let periodoValido = false;
  try { periodoValido = dataRelatorio(dataInicio) <= dataRelatorio(dataFim); } catch { /* input ainda incompleto */ }

  const consulta = trpc.dashboard.relatorioFinanceiro.useQuery({
    inicio: dataInicio, fim: dataFim,
    modalidade: modalidade === "todas" ? undefined : modalidade,
    clienteId: clienteSelecionado === "todos" ? undefined : Number(clienteSelecionado),
  }, { enabled: periodoValido, retry: false });
  const { data: kpis, isLoading: kpisLoading, isError: kpisFalhou } = trpc.dashboard.kpis.useQuery();
  const { data: resumoCaixa, isLoading: caixaLoading, isError: caixaFalhou } = trpc.dashboard.resumoCaixa.useQuery(undefined, { enabled: kpisFalhou });
  const carregando = consulta.isLoading || consulta.isFetching;
  const erro = !periodoValido ? "Informe um período civil válido (Brasília)." : consulta.isError ? consulta.error?.message || "Falha na leitura." : undefined;
  // Nunca reutilizar cache antigo após erro, refetch ou mudança de filtro/período.
  const relatorio = !carregando && !erro && consulta.data?.inicio === dataInicio && consulta.data?.fim === dataFim ? consulta.data : undefined;
  const ledger = leituraValidada(relatorio?.ledger) ? relatorio.ledger.dados : undefined;
  const fluxo = leituraValidada(relatorio?.fluxo) ? relatorio.fluxo.dados : undefined;
  const dividas = leituraValidada(relatorio?.dividas) ? relatorio.dividas.dados : undefined;
  const projecao = leituraValidada(relatorio?.projecao) ? relatorio.projecao.dados : undefined;
  const vinculos = leituraValidada(relatorio?.vinculos) ? relatorio.vinculos.dados : undefined;
  const leituraExtrato = relatorio?.extrato ?? undefined;
  const extrato = leituraValidada(leituraExtrato) ? leituraExtrato.dados : undefined;
  const exportavel = !!relatorio && relatorio.completo === true && !!ledger && !!fluxo && !!dividas && !!projecao && !!vinculos && (clienteSelecionado === "todos" || !!extrato);
  const modalidades = Array.from(new Set<string>((vinculos?.contratos ?? []).map(c => String(c.modalidade))));
  const contratosAtivos = vinculos?.contratos.filter(c => c.status === "ativo");
  const fluxoData = fluxo ? Array.from({ length: 7 }, (_, i) => {
    const data = adicionarDiasRelatorio(relatorio!.hoje, i - 6);
    const dia = resumirLedgerRelatorio(fluxo.movimentos.filter(m => m.dataTransacao === data));
    return { dia: formatarDataRelatorio(data).slice(0, 5), entradas: dia.entradas, saidas: dia.saidas };
  }) : undefined;
  const clienteNome = vinculos?.clientes.find(c => String(c.id) === clienteSelecionado)?.nome;

  function exportarRelatorioPDF() {
    if (!exportavel || !relatorio || !ledger || !dividas || !projecao) { toast.error("PDF indisponível: aguarde leituras completas e validadas."); return; }
    const doc = new jsPDF();
    doc.setFontSize(17); doc.text("COBRAPRO — Relatório Operacional", 14, 20);
    doc.setFontSize(10); doc.text(`Período: ${formatarDataRelatorio(dataInicio)} a ${formatarDataRelatorio(dataFim)} — Brasília`, 14, 29);
    doc.text(`Referência da dívida atual: ${formatarDataRelatorio(relatorio.hoje)}. Leituras completas e validadas.`, 14, 36);
    autoTable(doc, { startY: 42, head: [["Indicador / base", "Valor"]], body: [
      ["Entradas no Caixa (ledger)", formatarMoeda(ledger.entradas)],
      ["Saídas no Caixa (ledger, despesa contada uma vez)", formatarMoeda(ledger.saidas)],
      ["Saldo do período (entradas menos saídas)", formatarMoeda(ledger.saldo)],
      ["Recebimentos de parcelas no período (evento no ledger)", formatarMoeda(ledger.recebido)],
      ["Dívida ainda aberta com vencimento no período", formatarMoeda(dividas.aberto)],
      ["Dívida em atraso com vencimento no período", formatarMoeda(dividas.emAtraso)],
      ["Dívida aberta projetada: hoje até +30 dias", formatarMoeda(projecao.aberto)],
    ], styles: { fontSize: 9 } });
    let y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    const notas = doc.splitTextToSize(relatorio.base, 180);
    doc.text(notas, 14, y); y += notas.length * 5 + 8;
    doc.text(`Detalhes de dívida: ${dividas.parcelas.length} parcelas; sem truncamento de detalhes.`, 14, y);
    if (dividas.parcelas.length) autoTable(doc, { startY: y + 5, head: [["Cliente", "Vencimento civil", "Estado", "Ainda aberto"]], body: dividas.parcelas.map(p => [p.clienteNome, formatarDataRelatorio(p.dataVencimento), atrasadaRelatorio(p, relatorio.hoje) ? `${p.status} / vencida` : p.status, formatarMoeda(abertoCentavosRelatorio(p) / 100)]), styles: { fontSize: 8 } });
    doc.save(`relatorio-${dataInicio}-a-${dataFim}.pdf`);
  }

  function exportarExtratoPDF() {
    if (!exportavel || !extrato || !clienteNome || clienteSelecionado === "todos") { toast.error("Extrato PDF indisponível: fontes ainda não validadas."); return; }
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`Extrato: ${clienteNome}`, 14, 20);
    doc.setFontSize(9); doc.text(`Recebido no ledger (${dataInicio} a ${dataFim}, BRT): ${formatarMoeda(extrato.recebidoPeriodo)}`, 14, 30);
    doc.text(`Dívida aberta atual: ${formatarMoeda(extrato.aberto)}. Não é extrato de saldo histórico.`, 14, 37);
    autoTable(doc, { startY: 44, head: [["Parcela", "Vencimento", "Status atual", "Ainda aberto"]], body: extrato.parcelas.map(p => [String(p.numeroParcela), formatarDataRelatorio(p.dataVencimento), atrasadaRelatorio(p, relatorio!.hoje) ? `${p.status} / vencida` : p.status, formatarMoeda(abertoCentavosRelatorio(p) / 100)]), styles: { fontSize: 9 } });
    doc.save(`extrato-${clienteSelecionado}-${dataInicio}-a-${dataFim}.pdf`);
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="font-display text-3xl">{t("reports.title").toUpperCase()}</h1><p className="text-sm text-muted-foreground">Relatório somente leitura. Calendário civil de Brasília, independente do navegador.</p></div>
      <Button onClick={exportarRelatorioPDF} disabled={!exportavel} className="gap-2"><Download className="h-4 w-4" />Exportar Relatório PDF</Button></div>
    <Card><CardContent className="p-4 grid sm:grid-cols-3 gap-4">
      <div><Label>Data inicial (Brasília)</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
      <div><Label>Data final (Brasília)</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
      <div><Label>Modalidade da dívida / projeção</Label><Select value={modalidade} onValueChange={setModalidade}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as modalidades</SelectItem>{modalidades.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
    </CardContent></Card>
    {erro && <p role="alert" className="rounded-lg border border-warning/30 p-3 text-warning">Relatório indisponível: {erro} Nenhum zero é presumido.</p>}
    {relatorio && !relatorio.completo && <p role="alert" className="text-sm text-warning">Há seção indisponível para revisão; exportação PDF bloqueada. Leituras válidas do Caixa permanecem visíveis.</p>}
    <p className="text-xs text-muted-foreground">{relatorio?.base || "Entradas e saídas: exclusivamente ledger. Contas pagas já registradas no Caixa não são somadas de novo. Valores desconhecidos não são apresentados como zero."}</p>

    <Card><CardHeader><CardTitle>Caixa do período — ledger completo</CardTitle></CardHeader><CardContent>
      <EstadoLeitura leitura={relatorio?.ledger} carregando={carregando} erro={erro} />
      {ledger && <><div className="grid sm:grid-cols-4 gap-4"><Indicador titulo="Entradas no Caixa" valor={ledger.entradas} /><Indicador titulo="Saídas no Caixa" valor={ledger.saidas} /><Indicador titulo="Saldo do período" valor={ledger.saldo} /><Indicador titulo="Recebimentos de parcelas (ledger)" valor={ledger.recebido} /></div><p className="text-xs text-muted-foreground mt-3">{ledger.quantidade} movimentos lidos integralmente. Não inclui pagamentos inferidos pelo status final de parcelas.</p>{ledger.quantidade === 0 && <p className="text-sm mt-3">Nenhum movimento no período (vazio confirmado pela leitura completa).</p>}</>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Dívida aberta — vencimentos no período</CardTitle></CardHeader><CardContent>
      <EstadoLeitura leitura={relatorio?.dividas} carregando={carregando} erro={erro} />
      {dividas && <><div className="grid sm:grid-cols-3 gap-4"><Indicador titulo="Ainda aberto (residual validado)" valor={dividas.aberto} /><Indicador titulo="Ainda aberto em atraso civil" valor={dividas.emAtraso} /><div className="border rounded-lg p-4"><div className="text-xs text-muted-foreground">Atraso / dívida aberta da mesma base</div><div className="text-xl">{dividas.abertoCentavos > 0 ? `${(dividas.atrasoCentavos / dividas.abertoCentavos * 100).toFixed(1)}%` : "Sem base percentual"}</div></div></div>
        <p className="text-xs text-muted-foreground mt-3">{dividas.quantidade} parcelas abertas; {dividas.quantidadeAtrasadas} vencidas. Base atual com vencimento no período — não é reconstrução histórica.</p>
        {dividas.parcelas.length === 0 ? <p className="text-sm mt-3">Nenhuma parcela com vencimento no período (vazio confirmado).</p> : <div className="overflow-x-auto mt-4"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Cliente</th><th className="text-left p-2">Vencimento civil</th><th className="text-left p-2">Estado atual</th><th className="text-right p-2">Ainda aberto</th></tr></thead><tbody>{dividas.parcelas.map(p => <tr key={p.id} className="border-t"><td className="p-2">{p.clienteNome}</td><td className="p-2">{formatarDataRelatorio(p.dataVencimento)}</td><td className="p-2">{p.status}{atrasadaRelatorio(p, relatorio!.hoje) ? " / vencida" : ""}</td><td className="p-2 text-right">{formatarMoeda(abertoCentavosRelatorio(p) / 100)}</td></tr>)}</tbody></table></div>}
      </>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart2 className="h-4 w-4" />Fluxo do Caixa — últimos sete dias civis</CardTitle></CardHeader><CardContent>
      <EstadoLeitura leitura={relatorio?.fluxo} carregando={carregando} erro={erro} />
      {fluxoData && <ResponsiveContainer width="100%" height={240}><BarChart data={fluxoData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" /><YAxis /><Tooltip formatter={(valor: number) => formatarMoeda(valor)} /><Bar dataKey="entradas" fill="#22c55e" name="Entradas (ledger)" /><Bar dataKey="saidas" fill="#ef4444" name="Saídas (ledger)" /></BarChart></ResponsiveContainer>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Projeção — dívida aberta de hoje até +30 dias</CardTitle></CardHeader><CardContent>
      <EstadoLeitura leitura={relatorio?.projecao} carregando={carregando} erro={erro} />
      {projecao && <><Indicador titulo="Total ainda aberto projetado" valor={projecao.aberto} /><p className="text-xs text-muted-foreground mt-3">{projecao.quantidade} parcelas abertas; valor parcial é apenas residual validado. Projeção não garante recebimento.</p>{projecao.parcelas.length === 0 ? <p className="text-sm mt-3">Nenhuma parcela a vencer (vazio confirmado).</p> : <div className="mt-3 space-y-2">{projecao.parcelas.map(p => <div key={p.id} className="border rounded p-2 flex justify-between gap-3"><span>{formatarDataRelatorio(p.dataVencimento)} — {p.clienteNome}</span><span>{formatarMoeda(abertoCentavosRelatorio(p) / 100)}</span></div>)}</div>}</>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Contratos ativos — capital contratual, não saldo de Caixa</CardTitle></CardHeader><CardContent>
      <EstadoLeitura leitura={relatorio?.vinculos} carregando={carregando} erro={erro} />
      {contratosAtivos && <>{contratosAtivos.length === 0 ? <p>Nenhum contrato ativo (leitura completa confirmada).</p> : contratosAtivos.map(c => <div key={c.id} className="flex justify-between border-b py-2"><span>{vinculos?.clientes.find(cl => cl.id === c.cliente_id)?.nome} — {c.modalidade}</span><span>{formatarMoeda(c.valor_principal)}</span></div>)}</>}
    </CardContent></Card>

    <Card><CardHeader><div className="flex justify-between gap-3"><CardTitle>Extrato por cliente</CardTitle><Button variant="outline" onClick={exportarExtratoPDF} disabled={!exportavel || !extrato || !clienteNome} className="gap-2"><Download className="h-4 w-4" />Exportar Extrato PDF</Button></div></CardHeader><CardContent>
      <EstadoLeitura leitura={relatorio?.vinculos} carregando={carregando} erro={erro} />
      <Select value={clienteSelecionado} onValueChange={setClienteSelecionado} disabled={!vinculos}><SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Selecione um cliente</SelectItem>{vinculos?.clientes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent></Select>
      {clienteSelecionado !== "todos" && <div className="mt-4"><EstadoLeitura leitura={relatorio?.extrato} carregando={carregando} erro={erro} />{extrato && <><div className="grid sm:grid-cols-2 gap-4"><Indicador titulo="Recebido no período (ledger / contrato validado)" valor={extrato.recebidoPeriodo} /><Indicador titulo="Dívida aberta atual do cliente" valor={extrato.aberto} /></div><p className="text-xs text-muted-foreground mt-3">Não atribui eventos sem contrato confirmado. Não infere data ou valor recebido pelo status da parcela.</p>{extrato.parcelas.length === 0 ? <p className="mt-3">Nenhuma parcela deste cliente (vazio confirmado).</p> : extrato.parcelas.map(p => <div key={p.id} className="flex justify-between border-b py-2"><span>Parcela {p.numeroParcela} — {formatarDataRelatorio(p.dataVencimento)} — {p.status}</span><span>{formatarMoeda(abertoCentavosRelatorio(p) / 100)}</span></div>)}</>}</div>}
    </CardContent></Card>

    {/* KPIs Globais */}
    <Card><CardHeader><CardTitle>Resumo Geral do Sistema — fontes independentes</CardTitle></CardHeader><CardContent>
      {kpisFalhou && <p role="alert" className="mb-3 text-sm text-warning">Carteira indisponível para revisão; valores desconhecidos não são apresentados como zero. O saldo e capital do Caixa são consultados separadamente.</p>}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[
        { label: "Saldo atual do Caixa", value: kpisFalhou ? (caixaFalhou ? undefined : resumoCaixa?.saldoTotal) : kpis?.saldoTotal },
        { label: "Capital em Circulação", value: kpisFalhou ? (caixaFalhou ? undefined : resumoCaixa?.capitalCirculacao) : kpis?.capitalCirculacao },
        { label: "Total a Receber", value: kpisFalhou ? undefined : kpis?.totalReceber },
        { label: "Inadimplência Total", value: kpisFalhou ? undefined : kpis?.totalInadimplente },
        { label: "Juros Pendentes", value: kpisFalhou ? undefined : kpis?.jurosPendentes },
      ].map(k => <div key={k.label} className="border rounded-lg p-4"><div className="text-xs text-muted-foreground mb-2">{k.label}</div><div className="font-display text-xl">{k.value !== undefined ? formatarMoeda(k.value) : kpisLoading || (kpisFalhou && caixaLoading && ["Saldo atual do Caixa", "Capital em Circulação"].includes(k.label)) ? "..." : "Indisponível"}</div></div>)}</div>
    </CardContent></Card>
  </div>;
}
