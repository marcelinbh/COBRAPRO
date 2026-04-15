import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import jsPDF from "jspdf";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Smartphone, TrendingUp, DollarSign, Clock, BarChart3, Plus, Trash2,
  ChevronRight, ArrowLeft, Eye, Users, Package, CheckCircle2, AlertCircle,
  Banknote, Calendar, Phone, Mail, MapPin, Briefcase, Instagram, X, FileText
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtN(v: number, dec = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ─── Geração de PDF do Contrato ─────────────────────────────────────────────
function gerarPDFContrato(venda: any, parcelas: any[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 15;
  let y = 20;

  // Helpers internos
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const line = (text: string, x: number, yPos: number, size = 10, bold = false, color: [number,number,number] = [30,30,30]) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    doc.text(text, x, yPos);
  };
  const hline = (yPos: number, color: [number,number,number] = [220,220,220]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, W - margin, yPos);
  };

  // ── Cabeçalho ──
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, W, 30, "F");
  line("CONTRATO DE VENDA PARCELADA", margin, 13, 14, true, [255,255,255]);
  line("CobraPro · Sistema de Gestão de Cobranças", margin, 21, 9, false, [156,163,175]);
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  line(`Emitido em: ${dataHoje}`, W - margin - 40, 21, 9, false, [156,163,175]);
  y = 40;

  // ── Dados do Aparelho ──
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y, W - margin * 2, 8, "F");
  line("DADOS DO APARELHO", margin + 3, y + 5.5, 10, true, [5,150,105]);
  y += 12;

  const aparelhoItems = [
    ["Marca", venda.marca ?? "-"],
    ["Modelo", venda.modelo ?? "-"],
    ["Armazenamento", venda.armazenamento ?? "-"],
    ["Cor", venda.cor ?? "-"],
    ["IMEI", venda.imei ?? "-"],
  ];
  aparelhoItems.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? margin : W / 2 + 5;
    if (i % 2 === 0 && i > 0) y += 7;
    line(`${label}:`, col, y, 9, true, [100,100,100]);
    line(value, col + 28, y, 9, false, [30,30,30]);
  });
  y += 10;
  hline(y); y += 6;

  // ── Dados do Comprador ──
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y, W - margin * 2, 8, "F");
  line("DADOS DO COMPRADOR", margin + 3, y + 5.5, 10, true, [5,150,105]);
  y += 12;

  const compradorItems: [string, string][] = [
    ["Nome", venda.comprador_nome ?? "-"],
    ["CPF", venda.comprador_cpf ?? "-"],
    ["RG", venda.comprador_rg ?? "-"],
    ["Estado Civil", venda.comprador_estado_civil ?? "-"],
    ["Profissão", venda.comprador_profissao ?? "-"],
    ["Telefone", venda.comprador_telefone ?? "-"],
    ["E-mail", venda.comprador_email ?? "-"],
    ["Instagram", venda.comprador_instagram ?? "-"],
    ["Local Trabalho", venda.comprador_local_trabalho ?? "-"],
    ["Endereço", [venda.comprador_endereco, venda.comprador_cidade, venda.comprador_estado].filter(Boolean).join(", ") || "-"],
  ];
  compradorItems.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? margin : W / 2 + 5;
    if (i % 2 === 0 && i > 0) y += 7;
    line(`${label}:`, col, y, 9, true, [100,100,100]);
    const maxW = W / 2 - margin - 35;
    const truncated = doc.getStringUnitWidth(value) * 9 / doc.internal.scaleFactor > maxW
      ? value.substring(0, 30) + "..."
      : value;
    line(truncated, col + 32, y, 9, false, [30,30,30]);
  });
  y += 10;
  hline(y); y += 6;

  // ── Condições Financeiras ──
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y, W - margin * 2, 8, "F");
  line("CONDIÇÕES FINANCEIRAS", margin + 3, y + 5.5, 10, true, [5,150,105]);
  y += 12;

  const finItems: [string, string][] = [
    ["Preço de Venda", fmtBRL(parseFloat(venda.preco_venda))],
    ["Entrada", `${fmtBRL(parseFloat(venda.entrada_valor))} (${parseFloat(venda.entrada_percentual).toFixed(0)}%)`],
    ["Nº de Parcelas", `${venda.num_parcelas}x de ${fmtBRL(parseFloat(venda.valor_parcela))}`],
    ["Juros Mensal", `${parseFloat(venda.juros_mensal).toFixed(0)}% a.m.`],
    ["Total de Juros", fmtBRL(parseFloat(venda.total_juros ?? 0))],
    ["Total a Receber", fmtBRL(parseFloat(venda.total_a_receber))],
  ];
  finItems.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? margin : W / 2 + 5;
    if (i % 2 === 0 && i > 0) y += 7;
    line(`${label}:`, col, y, 9, true, [100,100,100]);
    line(value, col + 36, y, 9, false, [30,30,30]);
  });
  y += 10;
  hline(y); y += 6;

  // ── Tabela de Parcelas ──
  if (parcelas.length > 0) {
    doc.setFillColor(240, 253, 244);
    doc.rect(margin, y, W - margin * 2, 8, "F");
    line("TABELA DE PARCELAS", margin + 3, y + 5.5, 10, true, [5,150,105]);
    y += 12;

    // Cabeçalho da tabela
    doc.setFillColor(17, 24, 39);
    doc.rect(margin, y - 4, W - margin * 2, 7, "F");
    line("Nº", margin + 3, y + 1, 8, true, [255,255,255]);
    line("Vencimento", margin + 15, y + 1, 8, true, [255,255,255]);
    line("Valor", margin + 60, y + 1, 8, true, [255,255,255]);
    line("Status", margin + 100, y + 1, 8, true, [255,255,255]);
    y += 7;

    parcelas.forEach((p, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 3, W - margin * 2, 6, "F");
      }
      const venc = new Date(p.vencimento).toLocaleDateString("pt-BR");
      const statusLabel = p.status === "paga" ? "PAGA" : p.status === "atrasada" ? "ATRASADA" : "PENDENTE";
      const statusColor: [number,number,number] = p.status === "paga" ? [5,150,105] : p.status === "atrasada" ? [220,38,38] : [107,114,128];
      line(`${p.numero}`, margin + 3, y + 1, 8, false, [30,30,30]);
      line(venc, margin + 15, y + 1, 8, false, [30,30,30]);
      line(fmtBRL(parseFloat(p.valor)), margin + 60, y + 1, 8, false, [30,30,30]);
      line(statusLabel, margin + 100, y + 1, 8, true, statusColor);
      y += 6;
    });
    y += 6;
    hline(y); y += 8;
  }

  // ── Termos e Assinaturas ──
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y, W - margin * 2, 8, "F");
  line("TERMOS E CONDIÇÕES", margin + 3, y + 5.5, 10, true, [5,150,105]);
  y += 12;

  const termos = [
    "1. O comprador se compromete a pagar as parcelas nas datas acordadas.",
    "2. O atraso no pagamento implicará em juros de mora de 2% ao mês.",
    "3. O aparelho permanece como garantia até a quitação total do contrato.",
    "4. Em caso de inadimplência, o vendedor poderá retomar o aparelho.",
    "5. Este contrato é válido como instrumento particular de compra e venda.",
  ];
  termos.forEach(t => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(t, margin, y, { maxWidth: W - margin * 2 });
    y += 6;
  });
  y += 8;

  // Assinaturas
  if (y > 250) { doc.addPage(); y = 20; }
  hline(y); y += 10;
  const sigY = y + 15;
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(margin, sigY, margin + 75, sigY);
  doc.line(W / 2 + 5, sigY, W - margin, sigY);
  line("Vendedor", margin + 25, sigY + 5, 8, false, [100,100,100]);
  line(venda.comprador_nome ?? "Comprador", W / 2 + 20, sigY + 5, 8, false, [100,100,100]);
  line(`CPF: ${venda.comprador_cpf ?? "-"}`, W / 2 + 15, sigY + 10, 7, false, [150,150,150]);

  // Rodapé
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(17, 24, 39);
    doc.rect(0, 287, W, 10, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`CobraPro · Contrato gerado em ${dataHoje} · Página ${i} de ${totalPages}`, margin, 293);
  }

  doc.save(`contrato-${venda.comprador_nome?.replace(/\s+/g, "-").toLowerCase() ?? "venda"}-${venda.id}.pdf`);
}

// ─── Cálculo financeiro ───────────────────────────────────────────────────────
function calcularSimulacao(custo: number, precoVenda: number, entradaPct: number, parcelas: number, jurosMensal: number) {
  const entradaValor = precoVenda * (entradaPct / 100);
  const saldoFinanciado = precoVenda - entradaValor;
  const taxa = jurosMensal / 100;

  let valorParcela: number;
  let totalJuros: number;

  if (taxa === 0) {
    valorParcela = saldoFinanciado / parcelas;
    totalJuros = 0;
  } else {
    // PMT (Price)
    valorParcela = saldoFinanciado * (taxa * Math.pow(1 + taxa, parcelas)) / (Math.pow(1 + taxa, parcelas) - 1);
    totalJuros = valorParcela * parcelas - saldoFinanciado;
  }

  const totalAReceber = entradaValor + valorParcela * parcelas;
  const lucroBruto = totalAReceber - custo;
  const margem = custo > 0 ? (lucroBruto / custo) * 100 : 0;
  const capitalInvestido = custo - entradaValor;
  const roi = capitalInvestido > 0 ? (lucroBruto / capitalInvestido) * 100 : 0;

  // Payback: mês em que o lucro acumulado supera o capital investido
  let payback = 0;
  let acumulado = entradaValor - custo; // começa negativo
  for (let i = 1; i <= parcelas; i++) {
    acumulado += valorParcela;
    if (acumulado >= 0 && payback === 0) payback = i;
  }

  // Fluxo mensal para gráfico
  const fluxo = [];
  let acum = entradaValor - custo;
  for (let i = 1; i <= parcelas; i++) {
    acum += valorParcela;
    fluxo.push({
      mes: `Mês ${i}`,
      investido: Math.min(0, acum),
      lucro: Math.max(0, acum),
      payback: i === payback,
    });
  }

  return {
    entradaValor, saldoFinanciado, valorParcela, totalJuros,
    totalAReceber, lucroBruto, margem, capitalInvestido, roi,
    payback: payback || parcelas, fluxo,
  };
}

// ─── Slider customizado ───────────────────────────────────────────────────────
function SliderField({
  label, value, min, max, step, marks, format, onChange
}: {
  label: string; value: number; min: number; max: number; step: number;
  marks?: { value: number; label: string }[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className="text-base font-bold text-emerald-600">{format(value)}</span>
      </div>
      <div className="relative px-1">
        <Slider
          min={min} max={max} step={step}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="[&_[role=slider]]:bg-emerald-500 [&_[role=slider]]:border-emerald-500 [&_.relative]:bg-gray-200 [&_[data-orientation=horizontal]_.absolute]:bg-emerald-500"
        />
        {marks && (
          <div className="flex justify-between mt-1">
            {marks.map(m => (
              <span key={m.value} className="text-xs text-gray-400">{m.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card de resultado ────────────────────────────────────────────────────────
function ResultCard({ icon: Icon, label, value, sub, color = "black" }: {
  icon: any; label: string; value: string; sub?: string; color?: "green" | "black";
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-1 border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color === "green" ? "text-emerald-600" : "text-gray-900"}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

// ─── Tooltip customizado para o gráfico ──────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name === "investido" ? "Investido" : "Lucro"}: {fmt(Math.abs(p.value))}
        </p>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VendasTelefone() {
  const [, setLocation] = useLocation();

  // Tela atual: "lista" | "simulador" | "formulario"
  const [tela, setTela] = useState<"lista" | "simulador" | "formulario">("lista");

  // ── Simulador ──
  const [custo, setCusto] = useState(1500);
  const [precoVenda, setPrecoVenda] = useState(3000);
  const [custoInput, setCustoInput] = useState("1500");
  const [vendaInput, setVendaInput] = useState("3000");
  const [entradaPct, setEntradaPct] = useState(30);
  const [parcelas, setParcelas] = useState(12);
  const [jurosMensal, setJurosMensal] = useState(10);

  // ── Formulário de contrato ──
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [imei, setImei] = useState("");
  const [cor, setCor] = useState("");
  const [armazenamento, setArmazenamento] = useState("");
  const [compradorNome, setCompradorNome] = useState("");
  const [compradorCpf, setCompradorCpf] = useState("");
  const [compradorRg, setCompradorRg] = useState("");
  const [compradorTelefone, setCompradorTelefone] = useState("");
  const [compradorEmail, setCompradorEmail] = useState("");
  const [compradorEstadoCivil, setCompradorEstadoCivil] = useState("");
  const [compradorProfissao, setCompradorProfissao] = useState("");
  const [compradorInstagram, setCompradorInstagram] = useState("");
  const [compradorCep, setCompradorCep] = useState("");
  const [compradorCidade, setCompradorCidade] = useState("");
  const [compradorEstado, setCompradorEstado] = useState("");
  const [compradorEndereco, setCompradorEndereco] = useState("");
  const [compradorLocalTrabalho, setCompradorLocalTrabalho] = useState("");
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });

  // ── Modal de parcelas ──
  const [vendaSelecionada, setVendaSelecionada] = useState<any>(null);
  const [showParcelas, setShowParcelas] = useState(false);

  // ── Queries & Mutations ──
  const { data: vendas = [], refetch } = trpc.vendasTelefone.listar.useQuery();
  const { data: kpis } = trpc.vendasTelefone.kpis.useQuery();
  const { data: parcelasVenda = [] } = trpc.vendasTelefone.parcelas.useQuery(
    { vendaId: vendaSelecionada?.id ?? 0 },
    { enabled: !!vendaSelecionada?.id }
  );

  const criarMutation = trpc.vendasTelefone.criar.useMutation({
    onSuccess: () => {
      toast.success("Contrato criado com sucesso!");
      refetch();
      setTela("lista");
      resetForm();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const deletarMutation = trpc.vendasTelefone.deletar.useMutation({
    onSuccess: () => { toast.success("Excluído com sucesso!"); refetch(); },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const pagarMutation = trpc.vendasTelefone.pagarParcela.useMutation({
    onSuccess: () => { toast.success("Parcela paga!"); refetch(); },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  // ── Cálculo do simulador ──
  const sim = useMemo(
    () => calcularSimulacao(custo, precoVenda, entradaPct, parcelas, jurosMensal),
    [custo, precoVenda, entradaPct, parcelas, jurosMensal]
  );

  function resetForm() {
    setMarca(""); setModelo(""); setImei(""); setCor(""); setArmazenamento("");
    setCompradorNome(""); setCompradorCpf(""); setCompradorRg(""); setCompradorTelefone("");
    setCompradorEmail(""); setCompradorEstadoCivil(""); setCompradorProfissao("");
    setCompradorInstagram(""); setCompradorCep(""); setCompradorCidade("");
    setCompradorEstado(""); setCompradorEndereco(""); setCompradorLocalTrabalho("");
  }

  function handleCriarContrato() {
    if (!compradorNome.trim()) {
      toast.error("Nome obrigatório: informe o nome do comprador.");
      return;
    }
    if (!marca.trim() || !modelo.trim()) {
      toast.error("Produto obrigatório: informe marca e modelo.");
      return;
    }
    criarMutation.mutate({
      marca, modelo, imei: imei || undefined, cor: cor || undefined, armazenamento: armazenamento || undefined,
      custo, precoVenda, entradaPercentual: entradaPct, entradaValor: sim.entradaValor,
      numParcelas: parcelas, jurosMensal, valorParcela: sim.valorParcela,
      totalJuros: sim.totalJuros, totalAReceber: sim.totalAReceber, lucroBruto: sim.lucroBruto,
      roi: sim.roi, paybackMeses: sim.payback,
      compradorNome, compradorCpf: compradorCpf || undefined, compradorRg: compradorRg || undefined,
      compradorTelefone: compradorTelefone || undefined, compradorEmail: compradorEmail || undefined,
      compradorEstadoCivil: compradorEstadoCivil || undefined, compradorProfissao: compradorProfissao || undefined,
      compradorInstagram: compradorInstagram || undefined, compradorCep: compradorCep || undefined,
      compradorCidade: compradorCidade || undefined, compradorEstado: compradorEstado || undefined,
      compradorEndereco: compradorEndereco || undefined, compradorLocalTrabalho: compradorLocalTrabalho || undefined,
      dataPrimeiraParcela,
    });
  }

  const statusColor: Record<string, string> = {
    ativo: "bg-emerald-100 text-emerald-700",
    quitado: "bg-blue-100 text-blue-700",
    inadimplente: "bg-red-100 text-red-700",
    cancelado: "bg-gray-100 text-gray-500",
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TELA: LISTA
  // ─────────────────────────────────────────────────────────────────────────────
  if (tela === "lista") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Venda de Telefone</h1>
                <p className="text-sm text-gray-500">Gerencie contratos de venda parcelada</p>
              </div>
            </div>
            <Button
              onClick={() => setTela("simulador")}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Venda</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total de Vendas", value: kpis?.totalVendas ?? 0, icon: Package, fmt: (v: number) => String(v) },
              { label: "Vendas Ativas", value: kpis?.vendasAtivas ?? 0, icon: CheckCircle2, fmt: (v: number) => String(v) },
              { label: "Vendas Quitadas", value: kpis?.vendasQuitadas ?? 0, icon: TrendingUp, fmt: (v: number) => String(v) },
              { label: "Capital Investido", value: kpis?.capitalInvestido ?? 0, icon: Banknote, fmt: fmt },
              { label: "A Receber", value: kpis?.totalAReceber ?? 0, icon: DollarSign, fmt: fmt },
              { label: "Lucro Bruto", value: kpis?.lucroBruto ?? 0, icon: TrendingUp, fmt: fmt },
            ].map(({ label, value, icon: Icon, fmt: f }) => (
              <div key={label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-gray-500 font-medium">{label}</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{f(value)}</span>
              </div>
            ))}
          </div>

          {/* Lista de vendas */}
          {vendas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
              <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhuma venda registrada</h3>
              <p className="text-gray-400 mb-6">Clique em "Nova Venda" para simular e criar seu primeiro contrato</p>
              <Button onClick={() => setTela("simulador")} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                <Plus className="w-4 h-4 mr-2" /> Criar primeira venda
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {vendas.map((v: any) => (
                <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {/* Cabeçalho do card */}
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{v.marca} {v.modelo}</p>
                        <p className="text-gray-400 text-xs">{v.armazenamento} · {v.cor}</p>
                      </div>
                    </div>
                    <Badge className={statusColor[v.status] ?? "bg-gray-100 text-gray-500"}>
                      {v.status}
                    </Badge>
                  </div>

                  {/* Corpo */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="font-medium truncate">{v.comprador_nome}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500">Preço de Venda</p>
                        <p className="text-sm font-bold text-gray-900">{fmt(parseFloat(v.preco_venda))}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500">Parcelas</p>
                        <p className="text-sm font-bold text-gray-900">{v.num_parcelas}x {fmt(parseFloat(v.valor_parcela))}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-emerald-600">Lucro Bruto</p>
                        <p className="text-sm font-bold text-emerald-700">{fmt(parseFloat(v.lucro_bruto))}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-blue-600">ROI</p>
                        <p className="text-sm font-bold text-blue-700">{fmtN(parseFloat(v.roi ?? 0), 0)}%</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Entrada: {fmt(parseFloat(v.entrada_valor))} ({fmtN(parseFloat(v.entrada_percentual), 0)}%)</span>
                      <span>Juros: {fmtN(parseFloat(v.juros_mensal), 0)}% a.m.</span>
                    </div>
                  </div>

                  {/* Rodapé */}
                  <div className="border-t border-gray-100 p-3 flex gap-2">
                    <Button
                      size="sm" variant="outline"
                      className="flex-1 text-xs gap-1 text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50"
                      onClick={() => { setVendaSelecionada(v); setShowParcelas(true); }}
                    >
                      <Eye className="w-3 h-3" /> Parcelas
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                      onClick={() => {
                        // Buscar parcelas via query para o PDF
                        const parcelasDoCard = parcelasVenda.length > 0 && vendaSelecionada?.id === v.id ? parcelasVenda : [];
                        gerarPDFContrato(v, parcelasDoCard);
                        toast.success("PDF gerado com sucesso!");
                      }}
                    >
                      <FileText className="w-3 h-3" /> PDF
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                      onClick={() => {
                        if (confirm(`Excluir venda de ${v.comprador_nome}?`)) deletarMutation.mutate({ id: v.id });
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de parcelas */}
        <Dialog open={showParcelas} onOpenChange={setShowParcelas}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-500" />
                Parcelas — {vendaSelecionada?.comprador_nome}
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-end mb-3">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                onClick={() => {
                  gerarPDFContrato(vendaSelecionada, parcelasVenda);
                  toast.success("PDF do contrato gerado!");
                }}
              >
                <FileText className="w-3.5 h-3.5" /> Baixar Contrato PDF
              </Button>
            </div>
            <div className="space-y-2">
              {parcelasVenda.map((p: any) => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.status === 'paga' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                  <div>
                    <p className="font-medium text-sm">Parcela {p.numero}/{vendaSelecionada?.num_parcelas}</p>
                    <p className="text-xs text-gray-500">{new Date(p.vencimento).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{fmt(parseFloat(p.valor))}</span>
                    {p.status === 'paga' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">Paga</Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-7"
                        onClick={() => pagarMutation.mutate({ parcelaId: p.id, valorPago: parseFloat(p.valor) })}
                        disabled={pagarMutation.isPending}
                      >
                        Pagar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TELA: SIMULADOR
  // ─────────────────────────────────────────────────────────────────────────────
  if (tela === "simulador") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setTela("lista")} className="gap-1 text-gray-500">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
              <div className="w-px h-6 bg-gray-200" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Simulador de Venda</h1>
                <p className="text-sm text-gray-500">Configure os parâmetros e veja o retorno em tempo real</p>
              </div>
            </div>
            <Button
              onClick={() => setTela("formulario")}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
            >
              Criar Contrato <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Coluna esquerda: Configuração ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-500" />
                Configuração da Venda
              </h2>

              {/* Custo e Preço de Venda */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-600">Custo do Aparelho</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <Input
                      type="number" min={0} step={50}
                      value={custoInput}
                      onChange={(e) => {
                        setCustoInput(e.target.value);
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) setCusto(v);
                      }}
                      className="pl-9 text-lg font-bold border-gray-200 focus:border-emerald-400"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-600">Preço de Venda</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <Input
                      type="number" min={0} step={50}
                      value={vendaInput}
                      onChange={(e) => {
                        setVendaInput(e.target.value);
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) setPrecoVenda(v);
                      }}
                      className="pl-9 text-lg font-bold border-gray-200 focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-6 pt-2">
                <SliderField
                  label="Entrada"
                  value={entradaPct}
                  min={0} max={80} step={5}
                  format={(v) => `${v}% = ${fmt(precoVenda * v / 100)}`}
                  onChange={setEntradaPct}
                  marks={[{ value: 0, label: "0%" }, { value: 35, label: "35% (rec.)" }, { value: 80, label: "80%" }]}
                />
                <SliderField
                  label="Parcelas"
                  value={parcelas}
                  min={1} max={24} step={1}
                  format={(v) => `${v}x`}
                  onChange={setParcelas}
                  marks={[{ value: 3, label: "3x" }, { value: 6, label: "6x" }, { value: 12, label: "12x" }, { value: 18, label: "18x" }, { value: 24, label: "24x" }]}
                />
                <SliderField
                  label="Juros Mensal"
                  value={jurosMensal}
                  min={0} max={30} step={1}
                  format={(v) => `${v}%`}
                  onChange={setJurosMensal}
                  marks={[{ value: 0, label: "0%" }, { value: 10, label: "10%" }, { value: 20, label: "20%" }, { value: 30, label: "30%" }]}
                />
              </div>

              {/* Resumo rápido */}
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-emerald-100 text-xs">Entrada</p>
                    <p className="font-bold text-sm">{fmt(sim.entradaValor)}</p>
                  </div>
                  <div>
                    <p className="text-emerald-100 text-xs">Parcela</p>
                    <p className="font-bold text-sm">{fmt(sim.valorParcela)}</p>
                  </div>
                  <div>
                    <p className="text-emerald-100 text-xs">Total</p>
                    <p className="font-bold text-sm">{fmt(sim.totalAReceber)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Coluna direita: Resultados ── */}
            <div className="space-y-6">
              {/* Cards de resultado */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  Detalhes da Operação
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <ResultCard icon={DollarSign} label="Lucro Bruto" value={fmt(sim.lucroBruto)} sub={`Margem de ${fmtN(sim.margem, 1)}%`} color="green" />
                  <ResultCard icon={Clock} label="Payback" value={`${sim.payback} ${sim.payback === 1 ? 'mês' : 'meses'}`} sub={`Recupera no mês ${sim.payback}`} color="green" />
                  <ResultCard icon={Banknote} label="Parcela Mensal" value={fmt(sim.valorParcela)} />
                  <ResultCard icon={TrendingUp} label="Capital Investido" value={fmt(sim.capitalInvestido)} sub={`Entrada: ${fmt(sim.entradaValor)}`} />
                  <ResultCard icon={DollarSign} label="Total de Juros" value={fmt(sim.totalJuros)} />
                  <ResultCard icon={TrendingUp} label="ROI Total" value={`${fmtN(sim.roi, 0)}%`} color="green" />
                </div>
              </div>

              {/* Gráfico de fluxo */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  Fluxo do Investimento
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sim.fluxo} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => v.replace("Mês ", "")} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(0)}k` : Math.abs(v)}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#e5e7eb" />
                    <Bar dataKey="investido" name="investido" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="lucro" name="lucro" radius={[2, 2, 0, 0]}>
                      {sim.fluxo.map((entry, index) => (
                        <Cell key={index} fill={entry.payback ? "#f59e0b" : "#10b981"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-400" /><span className="text-xs text-gray-500">Investido</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-400" /><span className="text-xs text-gray-500">Payback</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500" /><span className="text-xs text-gray-500">Lucro</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TELA: FORMULÁRIO DE CONTRATO
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setTela("simulador")} className="gap-1 text-gray-500">
              <ArrowLeft className="w-4 h-4" /> Simulador
            </Button>
            <div className="w-px h-6 bg-gray-200" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dados do Comprador</h1>
              <p className="text-sm text-gray-500">{marca || "Aparelho"} {modelo} · {fmt(precoVenda)} · {parcelas}x {fmt(sim.valorParcela)}</p>
            </div>
          </div>
          <Button
            onClick={handleCriarContrato}
            disabled={criarMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
          >
            {criarMutation.isPending ? "Salvando..." : "Confirmar"}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Resumo da venda */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Resumo da Operação</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><p className="text-gray-400 text-xs">Preço de Venda</p><p className="font-bold">{fmt(precoVenda)}</p></div>
            <div><p className="text-gray-400 text-xs">Entrada</p><p className="font-bold">{fmt(sim.entradaValor)}</p></div>
            <div><p className="text-gray-400 text-xs">Parcelas</p><p className="font-bold">{parcelas}x {fmt(sim.valorParcela)}</p></div>
            <div><p className="text-gray-400 text-xs">Lucro Bruto</p><p className="font-bold text-emerald-400">{fmt(sim.lucroBruto)}</p></div>
          </div>
        </div>

        {/* Dados do aparelho */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-500" /> Dados do Aparelho
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Marca *</Label>
              <Input placeholder="Samsung, Apple, Xiaomi..." value={marca} onChange={e => setMarca(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Modelo *</Label>
              <Input placeholder="Galaxy S24, iPhone 15..." value={modelo} onChange={e => setModelo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Armazenamento</Label>
              <Input placeholder="128GB, 256GB..." value={armazenamento} onChange={e => setArmazenamento(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cor</Label>
              <Input placeholder="Preto, Branco, Azul..." value={cor} onChange={e => setCor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">IMEI</Label>
              <Input placeholder="000000000000000" value={imei} onChange={e => setImei(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Data 1ª Parcela</Label>
              <Input type="date" value={dataPrimeiraParcela} onChange={e => setDataPrimeiraParcela(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" /> Dados Pessoais
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Nome Completo *</Label>
              <Input placeholder="Nome do comprador" value={compradorNome} onChange={e => setCompradorNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">CPF</Label>
              <Input placeholder="000.000.000-00" value={compradorCpf} onChange={e => setCompradorCpf(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">RG</Label>
              <Input placeholder="00.000.000-0" value={compradorRg} onChange={e => setCompradorRg(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Estado Civil</Label>
              <Select value={compradorEstadoCivil} onValueChange={setCompradorEstadoCivil}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                  <SelectItem value="casado">Casado(a)</SelectItem>
                  <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                  <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Profissão</Label>
              <Input placeholder="Ex: Comerciante" value={compradorProfissao} onChange={e => setCompradorProfissao(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone</Label>
              <Input placeholder="(11) 99999-9999" value={compradorTelefone} onChange={e => setCompradorTelefone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1"><Mail className="w-3 h-3" /> E-mail</Label>
              <Input placeholder="email@exemplo.com" type="email" value={compradorEmail} onChange={e => setCompradorEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</Label>
              <Input placeholder="@usuario" value={compradorInstagram} onChange={e => setCompradorInstagram(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1"><Briefcase className="w-3 h-3" /> Local de Trabalho</Label>
              <Input placeholder="Empresa / Local" value={compradorLocalTrabalho} onChange={e => setCompradorLocalTrabalho(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-500" /> Endereço
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">CEP</Label>
              <Input placeholder="00000-000" value={compradorCep} onChange={e => setCompradorCep(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cidade</Label>
              <Input placeholder="São Paulo" value={compradorCidade} onChange={e => setCompradorCidade(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Estado</Label>
              <Select value={compradorEstado} onValueChange={setCompradorEstado}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label className="text-sm">Rua, número, complemento</Label>
              <Input placeholder="Rua das Flores, 123, Apto 4" value={compradorEndereco} onChange={e => setCompradorEndereco(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Botão final */}
        <div className="flex gap-3 pb-8">
          <Button variant="outline" className="flex-1" onClick={() => setTela("simulador")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Simulador
          </Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={handleCriarContrato}
            disabled={criarMutation.isPending}
          >
            {criarMutation.isPending ? "Criando contrato..." : "Criar Contrato"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
