import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, TrendingUp, Calendar, DollarSign, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { formatarMoeda, calcularParcelaPadrao, calcularParcelasPrice } from "../../../shared/finance";
import { useLocation } from "wouter";

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

  const tipoTaxa = modalidade === "emprestimo_diario" ? "diaria" : tipoTaxaManual;

  const calcular = useCallback(() => {
    const principal = parseFloat(valorPrincipal.replace(",", "."));
    const taxa = parseFloat(taxaJuros.replace(",", "."));
    const parcelas = parseInt(numeroParcelas);

    if (!principal || !taxa || !parcelas || principal <= 0 || taxa <= 0 || parcelas <= 0) {
      return;
    }

    let valorParcela = 0;
    if (modalidade === "tabela_price") {
      valorParcela = calcularParcelasPrice(principal, taxa, parcelas);
    } else if (modalidade === "emprestimo_padrao" || modalidade === "emprestimo_diario") {
      valorParcela = calcularParcelaPadrao(principal, taxa, parcelas);
    } else if (modalidade === "desconto_cheque") {
      // Desconto de cheque: valor líquido = valor nominal - desconto
      const desconto = principal * (taxa / 100) * (parcelas / 30);
      valorParcela = principal; // valor nominal do cheque
      const totalPagar = principal;
      const totalJuros = desconto;
      const parcelasGeradas = gerarParcelas(1, valorParcela, dataInicio, diaVencimento, tipoTaxa);
      setResultado({
        modalidade,
        valorPrincipal: principal - desconto,
        taxaJuros: taxa,
        tipoTaxa,
        numeroParcelas: 1,
        valorParcela,
        totalJuros,
        totalPagar,
        parcelas: parcelasGeradas,
      });
      return;
    }

    const totalPagar = valorParcela * parcelas;
    const totalJuros = totalPagar - principal;
    const parcelasGeradas = gerarParcelas(parcelas, valorParcela, dataInicio, diaVencimento, tipoTaxa);

    setResultado({
      modalidade,
      valorPrincipal: principal,
      taxaJuros: taxa,
      tipoTaxa,
      numeroParcelas: parcelas,
      valorParcela,
      totalJuros,
      totalPagar,
      parcelas: parcelasGeradas,
    });
  }, [valorPrincipal, taxaJuros, numeroParcelas, modalidade, dataInicio, diaVencimento, tipoTaxa]);

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

  const taxaLabel = tipoTaxa === "diaria" ? "Taxa Diária (%)" : tipoTaxa === "semanal" ? "Taxa Semanal (%)" : tipoTaxa === "quinzenal" ? "Taxa Quinzenal (%)" : tipoTaxa === "anual" ? "Taxa Anual (%)" : "Taxa Mensal (%)";
  const parcelasLabel = modalidade === "emprestimo_diario" ? "Prazo (dias)" : modalidade === "desconto_cheque" ? "Prazo (dias)" : "Número de Parcelas";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <Calculator className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Simulador de Empréstimo</h1>
          <p className="text-sm text-muted-foreground">Calcule parcelas antes de criar o contrato</p>
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
            {/* Modalidade */}
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

            {/* Valor Principal */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">
                {modalidade === "desconto_cheque" ? "Valor Nominal do Cheque (R$)" : "Valor do Empréstimo (R$)"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  className="pl-8 bg-background border-border"
                  placeholder="0,00"
                  value={valorPrincipal}
                  onChange={(e) => setValorPrincipal(e.target.value)}
                />
              </div>
            </div>

            {/* Taxa */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">{taxaLabel}</Label>
              <div className="relative">
                <Input
                  className="pr-8 bg-background border-border"
                  placeholder="0,00"
                  value={taxaJuros}
                  onChange={(e) => setTaxaJuros(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </div>

            {/* Número de Parcelas */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">{parcelasLabel}</Label>
              <Input
                className="bg-background border-border"
                placeholder={modalidade === "emprestimo_diario" ? "30" : "6"}
                value={numeroParcelas}
                onChange={(e) => setNumeroParcelas(e.target.value)}
                type="number"
                min="1"
              />
            </div>

            {/* Data de Início */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Data de Início</Label>
              <Input
                type="date"
                className="bg-background border-border"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            {/* Periodicidade (apenas para empréstimos, não diário) */}
            {modalidade !== "emprestimo_diario" && modalidade !== "desconto_cheque" && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Periodicidade</Label>
                <Select value={tipoTaxaManual} onValueChange={setTipoTaxaManual}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
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

            {/* Dia de Vencimento (apenas para mensais) */}
            {tipoTaxa === "mensal" && modalidade !== "desconto_cheque" && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Dia de Vencimento</Label>
                <Select value={diaVencimento} onValueChange={setDiaVencimento}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                      <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={calcular}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Simulação
            </Button>
          </CardContent>
        </Card>

        {/* Resultado */}
        {resultado ? (
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                Resultado da Simulação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* KPIs principais */}
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

              {/* Detalhes */}
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
                    {resultado.valorPrincipal > 0
                      ? ((resultado.totalJuros / resultado.valorPrincipal) * 100).toFixed(2)
                      : "0.00"}%
                  </span>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Botão tabela de parcelas */}
              <Button
                variant="outline"
                className="w-full border-border"
                onClick={() => setMostrarTabela(!mostrarTabela)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {mostrarTabela ? "Ocultar" : "Ver"} Plano de Parcelas
                {mostrarTabela ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>

              {/* Tabela de parcelas */}
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

              {/* Botão criar contrato */}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={irParaNovoContrato}
              >
                <FileText className="h-4 w-4 mr-2" />
                Criar Contrato com estes Dados
              </Button>
            </CardContent>
          </Card>
        ) : (
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
        )}
      </div>

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
