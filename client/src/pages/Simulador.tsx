import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Calculator, TrendingUp, Calendar, DollarSign, FileText,
  ChevronDown, ChevronUp, GitCompare, Download
} from "lucide-react";
import { formatarMoeda, calcularParcelaPadrao, calcularParcelasPrice } from "../../../shared/finance";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Modalidade = "emprestimo_padrao" | "emprestimo_diario" | "tabela_price" | "desconto_cheque";

interface ResultadoSimulacao {
  modalidade: Modalidade;
  valorPrincipal: number;
  taxaJuros: number;
  tipoTaxa: string;
  numeroParcelas: number;
  valorParcela: number;
  totalJuros: number;
  totalPagar: number;
  parcelas: { numero: number; vencimento: string; valor: number }[];
}

const MODALIDADE_LABELS: Record<Modalidade, string> = {
  emprestimo_padrao: "Juros Simples",
  emprestimo_diario: "Diário",
  tabela_price: "Tabela Price",
  desconto_cheque: "Desconto de Cheque",
};

export default function Simulador() {
  const [, setLocation] = useLocation();
  const [modalidade, setModalidade] = useState<Modalidade>("emprestimo_padrao");
  const [valorPrincipal, setValorPrincipal] = useState("");
  const [taxaJuros, setTaxaJuros] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState("");
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().split("T")[0]);
  const [diaVencimento, setDiaVencimento] = useState("5");
  const [resultado, setResultado] = useState<ResultadoSimulacao | null>(null);
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const [tipoTaxaManual, setTipoTaxaManual] = useState("mensal");
  const [modoComparacao, setModoComparacao] = useState(false);
  const [comparacoes, setComparacoes] = useState<ResultadoSimulacao[]>([]);

  const tipoTaxa = modalidade === "emprestimo_diario" ? "diaria" : tipoTaxaManual;

  // Buscar configurações para logo nos PDFs
  const { data: config } = trpc.configuracoes.get.useQuery();

  function gerarParcelas(
    numParcelas: number,
    valorParcela: number,
    dataInicio: string,
    diaVencimento: string,
    tipoTaxa: string
  ) {
    const parcelas = [];
    const inicio = new Date(dataInicio + "T00:00:00");
    for (let i = 1; i <= numParcelas; i++) {
      let vencimento: Date;
      if (tipoTaxa === "diaria") {
        vencimento = new Date(inicio);
        vencimento.setDate(inicio.getDate() + i);
      } else if (tipoTaxa === "semanal") {
        vencimento = new Date(inicio);
        vencimento.setDate(inicio.getDate() + i * 7);
      } else if (tipoTaxa === "quinzenal") {
        vencimento = new Date(inicio);
        vencimento.setDate(inicio.getDate() + i * 15);
      } else {
        vencimento = new Date(inicio);
        vencimento.setMonth(inicio.getMonth() + i);
        const dia = parseInt(diaVencimento) || inicio.getDate();
        vencimento.setDate(dia);
      }
      parcelas.push({
        numero: i,
        vencimento: vencimento.toLocaleDateString("pt-BR"),
        valor: valorParcela,
      });
    }
    return parcelas;
  }

  function calcularResultado(mod: Modalidade): ResultadoSimulacao | null {
    const principal = parseFloat(valorPrincipal.replace(",", "."));
    const taxa = parseFloat(taxaJuros.replace(",", "."));
    const parcelas = parseInt(numeroParcelas);
    if (!principal || !taxa || !parcelas || principal <= 0 || taxa <= 0 || parcelas <= 0) return null;

    const tipoT = mod === "emprestimo_diario" ? "diaria" : tipoTaxaManual;

    if (mod === "desconto_cheque") {
      const desconto = principal * (taxa / 100) * (parcelas / 30);
      const parcelasGeradas = gerarParcelas(1, principal, dataInicio, diaVencimento, tipoT);
      return {
        modalidade: mod, valorPrincipal: principal - desconto, taxaJuros: taxa, tipoTaxa: tipoT,
        numeroParcelas: 1, valorParcela: principal, totalJuros: desconto, totalPagar: principal,
        parcelas: parcelasGeradas,
      };
    }

    let valorParcela = 0;
    if (mod === "tabela_price") {
      valorParcela = calcularParcelasPrice(principal, taxa, parcelas);
    } else {
      valorParcela = calcularParcelaPadrao(principal, taxa, parcelas);
    }
    const totalPagar = valorParcela * parcelas;
    const totalJuros = totalPagar - principal;
    const parcelasGeradas = gerarParcelas(parcelas, valorParcela, dataInicio, diaVencimento, tipoT);
    return {
      modalidade: mod, valorPrincipal: principal, taxaJuros: taxa, tipoTaxa: tipoT,
      numeroParcelas: parcelas, valorParcela, totalJuros, totalPagar, parcelas: parcelasGeradas,
    };
  }

  const calcular = useCallback(() => {
    if (modoComparacao) {
      // Calcular todas as modalidades para comparação
      const mods: Modalidade[] = ["emprestimo_padrao", "tabela_price", "emprestimo_diario"];
      const resultados = mods.map(m => calcularResultado(m)).filter(Boolean) as ResultadoSimulacao[];
      setComparacoes(resultados);
      setResultado(resultados[0] || null);
    } else {
      const r = calcularResultado(modalidade);
      setResultado(r);
      setComparacoes([]);
    }
  }, [valorPrincipal, taxaJuros, numeroParcelas, modalidade, dataInicio, diaVencimento, tipoTaxa, modoComparacao]);

  function irParaNovoContrato() {
    if (!resultado) return;
    const params = new URLSearchParams({
      modalidade: resultado.modalidade,
      valorPrincipal: resultado.valorPrincipal.toString(),
      taxaJuros: resultado.taxaJuros.toString(),
      tipoTaxa: resultado.tipoTaxa,
      numeroParcelas: resultado.numeroParcelas.toString(),
      valorParcela: resultado.valorParcela.toString(),
      dataInicio,
      diaVencimento,
    });
    setLocation(`/contratos/novo?${params.toString()}`);
  }

  function exportarPDF(res?: ResultadoSimulacao) {
    const r = res || resultado;
    if (!r) return;

    const doc = new jsPDF();
    const nomeEmpresa = (config as any)?.nomeEmpresa || "CobraPro";
    const logoUrl = (config as any)?.logoUrl;

    // Cabeçalho
    let yPos = 15;
    if (logoUrl && logoUrl.startsWith("data:image")) {
      try {
        const ext = logoUrl.includes("png") ? "PNG" : "JPEG";
        doc.addImage(logoUrl, ext, 14, yPos, 40, 15);
        yPos += 20;
      } catch { /* sem logo */ }
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Simulação de Empréstimo", 14, yPos + 5);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`${nomeEmpresa} · Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, yPos + 12);
    doc.setTextColor(0, 0, 0);
    yPos += 20;

    // Parâmetros
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Parâmetros da Simulação", 14, yPos);
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const params = [
      ["Modalidade", MODALIDADE_LABELS[r.modalidade]],
      ["Capital Emprestado", formatarMoeda(r.valorPrincipal)],
      ["Taxa de Juros", `${r.taxaJuros}% ${r.tipoTaxa === "diaria" ? "ao dia" : "ao mês"}`],
      ["Número de Parcelas", `${r.numeroParcelas}x`],
    ];
    params.forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, yPos);
      yPos += 5;
    });
    yPos += 4;

    // Resultado
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resultado", 14, yPos);
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const resultados = [
      ["Valor da Parcela", formatarMoeda(r.valorParcela)],
      ["Total a Pagar", formatarMoeda(r.totalPagar)],
      ["Total de Juros", formatarMoeda(r.totalJuros)],
      ["Custo Efetivo Total", `${r.valorPrincipal > 0 ? ((r.totalJuros / r.valorPrincipal) * 100).toFixed(2) : "0.00"}%`],
    ];
    resultados.forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, yPos);
      yPos += 5;
    });
    yPos += 4;

    // Tabela de parcelas
    if (r.parcelas.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [["Parcela", "Vencimento", "Valor"]],
        body: r.parcelas.map(p => [`${p.numero}ª`, p.vencimento, formatarMoeda(p.valor)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    }

    doc.save(`simulacao-${r.modalidade}-${new Date().toISOString().split("T")[0]}.pdf`);
  }

  function exportarComparacaoPDF() {
    if (comparacoes.length === 0) return;
    const doc = new jsPDF();
    const nomeEmpresa = (config as any)?.nomeEmpresa || "CobraPro";
    const logoUrl = (config as any)?.logoUrl;

    let yPos = 15;
    if (logoUrl && logoUrl.startsWith("data:image")) {
      try {
        const ext = logoUrl.includes("png") ? "PNG" : "JPEG";
        doc.addImage(logoUrl, ext, 14, yPos, 40, 15);
        yPos += 20;
      } catch { /* sem logo */ }
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Comparação de Modalidades", 14, yPos + 5);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`${nomeEmpresa} · Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, yPos + 12);
    doc.setTextColor(0, 0, 0);
    yPos += 22;

    // Tabela comparativa
    autoTable(doc, {
      startY: yPos,
      head: [["Modalidade", "Parcela", "Total Juros", "Total a Pagar", "CET (%)"]],
      body: comparacoes.map(r => [
        MODALIDADE_LABELS[r.modalidade],
        formatarMoeda(r.valorParcela),
        formatarMoeda(r.totalJuros),
        formatarMoeda(r.totalPagar),
        `${r.valorPrincipal > 0 ? ((r.totalJuros / r.valorPrincipal) * 100).toFixed(2) : "0.00"}%`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`comparacao-modalidades-${new Date().toISOString().split("T")[0]}.pdf`);
  }

  const taxaLabel = tipoTaxa === "diaria" ? "Taxa Diária (%)" : tipoTaxa === "semanal" ? "Taxa Semanal (%)" : tipoTaxa === "quinzenal" ? "Taxa Quinzenal (%)" : tipoTaxa === "anual" ? "Taxa Anual (%)" : "Taxa Mensal (%)";
  const parcelasLabel = modalidade === "emprestimo_diario" ? "Prazo (dias)" : modalidade === "desconto_cheque" ? "Prazo (dias)" : "Número de Parcelas";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Calculator className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simulador de Empréstimo</h1>
            <p className="text-sm text-muted-foreground">Calcule parcelas antes de criar o contrato</p>
          </div>
        </div>
        {/* Modo Comparação */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <GitCompare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Comparar Modos</span>
          <Switch checked={modoComparacao} onCheckedChange={setModoComparacao} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Parâmetros da Simulação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Modalidade — só mostra se não estiver em modo comparação */}
            {!modoComparacao && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Modalidade</Label>
                <Select value={modalidade} onValueChange={(v) => setModalidade(v as Modalidade)}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emprestimo_padrao">Empréstimo Padrão (Juros Simples)</SelectItem>
                    <SelectItem value="emprestimo_diario">Empréstimo Diário</SelectItem>
                    <SelectItem value="tabela_price">Tabela Price (Juros Compostos)</SelectItem>
                    <SelectItem value="desconto_cheque">Desconto de Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {modoComparacao && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                <GitCompare className="h-3.5 w-3.5 inline mr-1.5" />
                Modo comparação ativo — calculará Juros Simples, Tabela Price e Diário simultaneamente.
              </div>
            )}

            {/* Valor Principal */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">
                {modalidade === "desconto_cheque" ? "Valor Nominal do Cheque (R$)" : "Valor do Empréstimo (R$)"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input className="pl-8 bg-background border-border" placeholder="0,00"
                  value={valorPrincipal} onChange={(e) => setValorPrincipal(e.target.value)} />
              </div>
            </div>

            {/* Taxa */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">{taxaLabel}</Label>
              <div className="relative">
                <Input className="pr-8 bg-background border-border" placeholder="0,00"
                  value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </div>

            {/* Número de Parcelas */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">{parcelasLabel}</Label>
              <Input className="bg-background border-border"
                placeholder={modalidade === "emprestimo_diario" ? "30" : "6"}
                value={numeroParcelas} onChange={(e) => setNumeroParcelas(e.target.value)}
                type="number" min="1" />
            </div>

            {/* Data de Início */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Data de Início</Label>
              <Input type="date" className="bg-background border-border"
                value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>

            {/* Periodicidade */}
            {!modoComparacao && modalidade !== "emprestimo_diario" && modalidade !== "desconto_cheque" && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Periodicidade</Label>
                <Select value={tipoTaxaManual} onValueChange={setTipoTaxaManual}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dia de Vencimento */}
            {tipoTaxa === "mensal" && !modoComparacao && modalidade !== "desconto_cheque" && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Dia de Vencimento</Label>
                <Select value={diaVencimento} onValueChange={setDiaVencimento}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                      <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" onClick={calcular}>
              <Calculator className="h-4 w-4 mr-2" />
              {modoComparacao ? "Comparar Modalidades" : "Calcular Simulação"}
            </Button>
          </CardContent>
        </Card>

        {/* Resultado — Modo Normal */}
        {!modoComparacao && resultado ? (
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  Resultado da Simulação
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportarPDF()}>
                  <Download className="h-3.5 w-3.5" /> Exportar PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Valor da Parcela</p>
                  <p className="text-xl font-bold text-emerald-400">{formatarMoeda(resultado.valorParcela)}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Total a Pagar</p>
                  <p className="text-xl font-bold text-blue-400">{formatarMoeda(resultado.totalPagar)}</p>
                </div>
              </div>

              <Separator className="bg-border/50" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Capital emprestado</span>
                  <span className="font-medium">{formatarMoeda(resultado.valorPrincipal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de juros</span>
                  <span className="font-medium text-amber-400">{formatarMoeda(resultado.totalJuros)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Número de parcelas</span>
                  <span className="font-medium">{resultado.numeroParcelas}x</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de juros</span>
                  <span className="font-medium">{resultado.taxaJuros}% {resultado.tipoTaxa === "diaria" ? "ao dia" : "ao mês"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo efetivo total</span>
                  <span className="font-medium text-red-400">
                    {resultado.valorPrincipal > 0 ? ((resultado.totalJuros / resultado.valorPrincipal) * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>
              </div>

              <Separator className="bg-border/50" />

              <Button variant="outline" className="w-full border-border" onClick={() => setMostrarTabela(!mostrarTabela)}>
                <Calendar className="h-4 w-4 mr-2" />
                {mostrarTabela ? "Ocultar" : "Ver"} Plano de Parcelas
                {mostrarTabela ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>

              {mostrarTabela && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs text-muted-foreground">Parcela</th>
                        <th className="px-3 py-2 text-left text-xs text-muted-foreground">Vencimento</th>
                        <th className="px-3 py-2 text-right text-xs text-muted-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.parcelas.map((p) => (
                        <tr key={p.numero} className="border-t border-border/50 hover:bg-muted/20">
                          <td className="px-3 py-1.5 text-muted-foreground">{p.numero}ª</td>
                          <td className="px-3 py-1.5">{p.vencimento}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-emerald-400">{formatarMoeda(p.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={irParaNovoContrato}>
                <FileText className="h-4 w-4 mr-2" />
                Criar Contrato com estes Dados
              </Button>
            </CardContent>
          </Card>
        ) : !modoComparacao ? (
          <Card className="bg-card border-border flex items-center justify-center min-h-[300px]">
            <div className="text-center space-y-3 p-6">
              <div className="p-4 rounded-full bg-muted/30 w-16 h-16 mx-auto flex items-center justify-center">
                <Calculator className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                Preencha os parâmetros ao lado e clique em<br />
                <strong className="text-foreground">Calcular Simulação</strong> para ver o resultado
              </p>
            </div>
          </Card>
        ) : null}

        {/* Resultado — Modo Comparação */}
        {modoComparacao && comparacoes.length === 0 && (
          <Card className="bg-card border-border flex items-center justify-center min-h-[300px]">
            <div className="text-center space-y-3 p-6">
              <div className="p-4 rounded-full bg-blue-500/10 w-16 h-16 mx-auto flex items-center justify-center">
                <GitCompare className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-muted-foreground text-sm">
                Preencha os parâmetros e clique em<br />
                <strong className="text-foreground">Comparar Modalidades</strong>
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Tabela de Comparação */}
      {modoComparacao && comparacoes.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-blue-400" />
                Comparação de Modalidades
              </CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportarComparacaoPDF}>
                <Download className="h-3.5 w-3.5" /> Exportar PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Modalidade</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Parcela</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total Juros</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total a Pagar</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">CET (%)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacoes.map((r, i) => {
                    const melhor = comparacoes.reduce((a, b) => a.totalPagar < b.totalPagar ? a : b);
                    const isMelhor = r.modalidade === melhor.modalidade;
                    return (
                      <tr key={r.modalidade} className={`border-b border-border/50 hover:bg-muted/20 ${isMelhor ? "bg-emerald-500/5" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={isMelhor ? "default" : "outline"} className={`text-xs ${isMelhor ? "bg-emerald-600" : ""}`}>
                              {MODALIDADE_LABELS[r.modalidade]}
                            </Badge>
                            {isMelhor && <span className="text-xs text-emerald-400">✓ Menor custo</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-400">{formatarMoeda(r.valorParcela)}</td>
                        <td className="px-4 py-3 text-right text-amber-400">{formatarMoeda(r.totalJuros)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatarMoeda(r.totalPagar)}</td>
                        <td className="px-4 py-3 text-right text-red-400">
                          {r.valorPrincipal > 0 ? ((r.totalJuros / r.valorPrincipal) * 100).toFixed(2) : "0.00"}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => exportarPDF(r)}>
                              <Download className="h-3 w-3" /> PDF
                            </Button>
                            <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => { setResultado(r); setModoComparacao(false); }}>
                              <FileText className="h-3 w-3" /> Usar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumo visual */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {comparacoes.map((r) => {
                const melhor = comparacoes.reduce((a, b) => a.totalPagar < b.totalPagar ? a : b);
                const isMelhor = r.modalidade === melhor.modalidade;
                return (
                  <div key={r.modalidade} className={`p-3 rounded-lg border ${isMelhor ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/20"}`}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">{MODALIDADE_LABELS[r.modalidade]}</p>
                    <p className="text-lg font-bold text-foreground">{formatarMoeda(r.valorParcela)}</p>
                    <p className="text-xs text-muted-foreground">{r.numeroParcelas}x · {formatarMoeda(r.totalPagar)} total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info sobre modalidades */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Como funciona cada modalidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/20">
              <Badge variant="outline" className="mb-2 text-xs">Empréstimo Padrão</Badge>
              <p className="text-muted-foreground text-xs">Juros simples mensais. Total = Capital × (1 + Taxa% × Parcelas). Parcelas iguais.</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20">
              <Badge variant="outline" className="mb-2 text-xs">Empréstimo Diário</Badge>
              <p className="text-muted-foreground text-xs">Cobrança diária. Taxa aplicada por dia. Ideal para prazos curtos de 15 a 60 dias.</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20">
              <Badge variant="outline" className="mb-2 text-xs">Tabela Price</Badge>
              <p className="text-muted-foreground text-xs">Juros compostos (SAC). Parcelas iguais com amortização crescente e juros decrescentes.</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20">
              <Badge variant="outline" className="mb-2 text-xs">Desconto de Cheque</Badge>
              <p className="text-muted-foreground text-xs">Antecipação de cheque. O cliente recebe o valor nominal menos o desconto calculado.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
