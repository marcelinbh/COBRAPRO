import { useTranslation } from 'react-i18next';
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, MessageCircle, CheckCircle, Clock, AlertTriangle, Filter, Download, FileSpreadsheet, FileText, ArrowLeft
} from "lucide-react";
import { formatarMoeda, formatarData, calcularJurosMora } from "../../../shared/finance";
import { gerarComprovantePDF } from "@/lib/gerarComprovante";
// xlsx e jspdf são carregados sob demanda (lazy) para reduzir o bundle inicial em ~1.1MB

// Templates padrão (mesmos do Cobra Fácil)
const TEMPLATE_ATRASO = `⚠️ *Atenção {CLIENTE}* ━━━━━━━━━━━━━━━━
🚨 *PARCELA EM ATRASO*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏰ *Dias em Atraso:* {DIAS_ATRASO}
💸 *Multa:* {MULTA}
💸 *Juros:* {JUROS}
💰 *Total a Pagar:* {TOTAL}
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

const TEMPLATE_VENCE_HOJE = `🟡 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━
📅 *SUA PARCELA VENCE HOJE!*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
⏰ *Vencimento:* {DATA}
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

const TEMPLATE_ANTECIPADA = `🟢 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━
📋 *LEMBRETE DE PARCELA*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏳ *Faltam:* {DIAS_PARA_VENCER} dias
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

function gerarMensagemCobranca(
  nome: string,
  numeroParcela: number,
  numeroParcelas: number,
  valorOriginal: string,
  dataVencimento: Date,
  diasAtraso: number,
  juros: number,
  multa: number,
  total: number,
  chavePix: string | null,
  assinatura = '',
  fechamento = 'Regularize hoje e evite mais juros!'
): string {
  const hoje = new Date();
  const diasParaVencer = Math.max(0, Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
  let template = TEMPLATE_ANTECIPADA;
  if (diasAtraso > 0) template = TEMPLATE_ATRASO;
  else if (diasAtraso === 0) template = TEMPLATE_VENCE_HOJE;
  const pixMsg = chavePix ? `🔑 *PIX:* \`${chavePix}\`` : '';
  return template
    .replace(/{CLIENTE}/g, nome)
    .replace(/{VALOR}/g, formatarMoeda(valorOriginal))
    .replace(/{PARCELA}/g, `Parcela ${numeroParcela}/${numeroParcelas}`)
    .replace(/{DATA}/g, formatarData(dataVencimento))
    .replace(/{DIAS_ATRASO}/g, String(diasAtraso))
    .replace(/{DIAS_PARA_VENCER}/g, String(diasParaVencer))
    .replace(/{MULTA}/g, formatarMoeda(multa))
    .replace(/{JUROS}/g, formatarMoeda(juros))
    .replace(/{JUROS_MULTA}/g, formatarMoeda(juros + multa))
    .replace(/{TOTAL}/g, formatarMoeda(total))
    .replace(/{JUROS_CONTRATO}/g, '')
    .replace(/{PROGRESSO}/g, '')
    .replace(/{PARCELAS_STATUS}/g, '')
    .replace(/{PIX}/g, pixMsg)
    .replace(/{ASSINATURA}/g, assinatura ? `💼 *${assinatura}*` : '')
    .replace(/{FECHAMENTO}/g, fechamento ? `✅ ${fechamento}` : '')
    .trim();
}

function StatusBadge({ status }: { status: string }) {
  const { t, i18n } = useTranslation();
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    paga: { label: "Paga", className: "bg-success/15 text-success border-success/30", icon: CheckCircle },
    pendente: { label: t('parcels.pending'), className: "bg-muted text-muted-foreground border-border", icon: Clock },
    atrasada: { label: "Atrasada", className: "bg-primary/15 text-primary border-primary/30", icon: AlertTriangle },
    vencendo_hoje: { label: t('installments.dueToday'), className: "bg-warning/15 text-warning border-warning/30", icon: Clock },
    parcial: { label: "Parcial", className: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  };
  const s = map[status] ?? map.pendente;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

type ParcelaRow = {
  id: number;
  contratoId: number;
  clienteId: number;
  clienteNome: string;
  clienteWhatsapp: string | null;
  clienteChavePix: string | null;
  numeroParcela: number;
  valorOriginal: string;
  valorPago: string | null;
  valorJuros: string | null;
  valorMulta: string | null;
  dataVencimento: Date;
  dataPagamento: Date | null;
  status: string;
  modalidade: string;
  numeroParcelas: number;
  taxaJuros?: string | null;
  tipoTaxa?: string | null;
  valorPrincipalContrato?: string | null;
  valorPrincipal?: string | null;
};

function PagamentoDialog({
  parcela,
  contas,
  configData,
  onSuccess,
}: {
  parcela: ParcelaRow;
  contas: { id: number; nome: string; saldoAtual: number }[];
  onSuccess: () => void;
  configData?: { multaPadrao?: number; multaDiaria?: number; jurosMoraDiario?: number; jurosMultaAutomatico?: boolean } | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [valorPago, setValorPago] = useState("");
  const [contaCaixaId, setContaCaixaId] = useState("");
  const [desconto, setDesconto] = useState("0");

  // Usar parâmetros de multa/juros das configurações quando jurosMultaAutomatico estiver ativo
  const multaDiariaConfig = configData?.jurosMultaAutomatico ? (configData?.multaDiaria ?? 0) : 0;
  const multaPercentualConfig = configData?.jurosMultaAutomatico ? (configData?.multaPadrao ?? 0) : 0;
  const { juros, multa, total, diasAtraso } = calcularJurosMora(
    parseFloat(parcela.valorOriginal),
    new Date(parcela.dataVencimento),
    new Date(),
    multaDiariaConfig,
    multaPercentualConfig
  );

  // Calcular valor dos juros do período (taxa do contrato)
  const valorOriginal = parseFloat(parcela.valorOriginal);
  // Usar valor_juros do banco se disponível (calculado na criação da parcela)
  // Fallback: calcular a partir do principal e taxa
  const principalContrato = parseFloat(parcela.valorPrincipal ?? parcela.valorPrincipalContrato ?? '0');
  const nParcelas = parcela.numeroParcelas || 1;
  const taxaContrato = parcela.taxaJuros ? parseFloat(parcela.taxaJuros) : 0;
  // jurosParcela: usar valor_juros do banco se disponível, senão calcular
  const jurosParcela = parcela.valorJuros && parseFloat(parcela.valorJuros) > 0
    ? parseFloat(parcela.valorJuros)
    : principalContrato > 0
      ? Math.round(principalContrato * (taxaContrato / 100) * 100) / 100
      : Math.max(0, valorOriginal - (principalContrato > 0 ? principalContrato / nParcelas : 0));

  const [modoSoJuros, setModoSoJuros] = useState(false);
  const utils = trpc.useUtils();
  const pagarJurosMutation = trpc.parcelas.pagarJuros.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ Juros pagos! Nova parcela criada com vencimento em ${data.novaDataVencimento}`);
      setOpen(false);
      setModoSoJuros(false);
      onSuccess();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error('Erro ao pagar juros: ' + e.message),
  });
  const pagarMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.pagamento_registrado_com_sucesso'));
      setOpen(false);
      onSuccess();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error(t("toast.errorPrefix") + e.message),
  });

  return (
    <>
      <Button
        size="sm"
        className="gap-1 h-7 text-xs"
        onClick={(e) => { e.stopPropagation(); setValorPago(total.toFixed(2)); setOpen(true); }}
      >
        <CheckCircle className="h-3 w-3" />
        Pagar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-wide flex items-center gap-2">
              REGISTRAR PAGAMENTO
              {configData?.jurosMultaAutomatico && diasAtraso > 0 && (
                <span className="text-xs font-normal bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
                  ⚡ Juros/Multa Auto
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-lg bg-muted border border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('common.client')}</span>
                <span className="text-foreground font-medium">{parcela.clienteNome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('common.installment')}</span>
                <span className="text-foreground">{parcela.numeroParcela}/{parcela.numeroParcelas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('parcelas.originalValue')}</span>
                <span className="text-foreground">{formatarMoeda(parcela.valorOriginal)}</span>
              </div>
              {diasAtraso > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Multa ({diasAtraso} dias)</span>
                    <span className="text-warning">{formatarMoeda(multa)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('parcelas.lateInterest')}</span>
                    <span className="text-warning">{formatarMoeda(juros)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                    <span className="text-foreground">{t('parcelas.updatedTotal')}</span>
                    <span className="text-primary">{formatarMoeda(total)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Botões rápidos */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('parcelas.paymentShortcuts')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 ${!modoSoJuros ? 'ring-1 ring-emerald-400' : ''}`}
                  onClick={() => { setValorPago(total.toFixed(2)); setModoSoJuros(false); }}
                >
                  ✅ Pagar Total ({formatarMoeda(total)})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 ${modoSoJuros ? 'ring-1 ring-amber-400 bg-amber-500/10' : ''}`}
                  onClick={() => { setValorPago(jurosParcela.toFixed(2)); setModoSoJuros(true); }}
                >
                  💰 Só Juros ({formatarMoeda(jurosParcela)})
                  {modoSoJuros && <span className="ml-1 text-[10px] bg-amber-500/20 px-1 rounded">↺ Renova</span>}
                </Button>
              </div>
            </div>

            <div>
              <Label>{t('parcelas.receivedValue')}</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={valorPago}
                onChange={e => setValorPago(e.target.value)}
              />
            </div>

            <div>
              <Label>{t('parcelas.discount')}</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={desconto}
                onChange={e => setDesconto(e.target.value)}
              />
            </div>

            <div>
              <Label>{t('emprestimos.cashAccount')} <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome} — {formatarMoeda(c.saldoAtual)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {modoSoJuros && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                ⚠️ <strong>Modo Renovação:</strong> Ao confirmar, os juros serão pagos e uma nova parcela será criada automaticamente com vencimento +{parcela.modalidade === 'diario' ? '1 dia' : parcela.modalidade === 'semanal' ? '7 dias' : parcela.modalidade === 'quinzenal' ? '15 dias' : '30 dias'}.
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); setModoSoJuros(false); }}>{t('common.cancel')}</Button>
              <Button
                className={`flex-1 ${modoSoJuros ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                disabled={!valorPago || pagarMutation.isPending || pagarJurosMutation.isPending}
                onClick={() => {
                  if (modoSoJuros) {
                    pagarJurosMutation.mutate({
                      parcelaId: parcela.id,
                      valorJurosPago: parseFloat(valorPago),
                      contaCaixaId: contaCaixaId ? parseInt(contaCaixaId) : undefined,
                    });
                  } else {
                    pagarMutation.mutate({
                      parcelaId: parcela.id,
                      valorPago: parseFloat(valorPago),
                      contaCaixaId: contaCaixaId ? parseInt(contaCaixaId) : undefined,
                      desconto: parseFloat(desconto),
                    });
                  }
                }}
              >
                {(pagarMutation.isPending || pagarJurosMutation.isPending)
                  ? 'Salvando...'
                  : modoSoJuros
                    ? `💰 Confirmar Só Juros (${formatarMoeda(parseFloat(valorPago || '0'))})`
                    : 'Confirmar Pagamento'
                }
              </Button>
            </div>
            
            {/* Botão de Baixar Comprovante (após pagamento) */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
              onClick={() => {
                gerarComprovantePDF({
                  clienteNome: parcela.clienteNome,
                  parcelaNumero: parcela.numeroParcela,
                  valorOriginal: parseFloat(String(parcela.valorOriginal)),
                  juros: 0,
                  valorPago: parseFloat(valorPago),
                  dataPagamento: new Date().toISOString(),
                  contratoId: parcela.contratoId,
                  modalidade: 'Padrão',
                })
              }}
            >
              📄 Baixar Comprovante
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Parcelas() {
  const { t, i18n } = useTranslation();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");

  // Bug #4 corrigido: ler contratoId da URL (?contratoId=X) para filtrar por contrato
  const contratoIdFiltro = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const val = params.get('contratoId');
    return val ? parseInt(val, 10) : undefined;
  }, []);

  const { data: parcelas, isLoading, refetch } = trpc.parcelas.list.useQuery({
    status: filtroStatus !== "todos" ? filtroStatus : undefined,
    modalidade: filtroModalidade !== "todas" ? filtroModalidade : undefined,
    contratoId: contratoIdFiltro,
  });
  const { data: contas } = trpc.caixa.contas.useQuery();
  const { data: configData } = trpc.configuracoes.get.useQuery();

  const filtradas = parcelas?.filter(p =>
    !busca || p.clienteNome.toLowerCase().includes(busca.toLowerCase())
  );

  const statusCount = {
    atrasada: parcelas?.filter(p => p.status === 'atrasada').length ?? 0,
    vencendo_hoje: parcelas?.filter(p => p.status === 'vencendo_hoje').length ?? 0,
    pendente: parcelas?.filter(p => p.status === 'pendente').length ?? 0,
    paga: parcelas?.filter(p => p.status === 'paga').length ?? 0,
  };

  // Contadores por modalidade (apenas pendentes/atrasadas)
  const MODALIDADES = [
    { key: 'diario', label: t('loans.daily'), color: 'border-orange-500/30 bg-orange-500/5', textColor: 'text-orange-400' },
    { key: 'semanal', label: t('loans.weekly'), color: 'border-blue-500/30 bg-blue-500/5', textColor: 'text-blue-400' },
    { key: 'quinzenal', label: t('loans.biweekly'), color: 'border-purple-500/30 bg-purple-500/5', textColor: 'text-purple-400' },
    { key: 'mensal', label: t('loans.monthly'), color: 'border-teal-500/30 bg-teal-500/5', textColor: 'text-teal-400' },
  ];
  const modalidadeCount = MODALIDADES.map(m => ({
    ...m,
    qtd: parcelas?.filter(p => p.modalidade === m.key && ['pendente','atrasada','vencendo_hoje','parcial'].includes(p.status)).length ?? 0,
    valor: parcelas?.filter(p => p.modalidade === m.key && ['pendente','atrasada','vencendo_hoje','parcial'].includes(p.status)).reduce((s, p) => s + parseFloat(p.valorOriginal), 0) ?? 0,
  }));

  // Funções de exportação (lazy loading para reduzir bundle inicial em ~1.1MB)
  const exportarExcel = async () => {
    if (!filtradas || filtradas.length === 0) { toast.error(t('toast_error.nenhuma_parcela_para_exportar')); return; }
    const XLSX = await import('xlsx');
    const dados = filtradas.map(p => ({
      'Cliente': p.clienteNome,
      'Parcela': `${p.numeroParcela}/${p.numeroParcelas}`,
      'Modalidade': p.modalidade ?? '-',
      'Vencimento': formatarData(p.dataVencimento),
      'Valor Original': parseFloat(p.valorOriginal),
      'Valor Pago': parseFloat(p.valorPago ?? '0'),
      'Status': p.status,
      'Data Pagamento': p.dataPagamento ? formatarData(p.dataPagamento) : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parcelas');
    XLSX.writeFile(wb, `parcelas_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t('toast_success.excel_exportado_com_sucesso'));
  };

  const exportarPDF = async () => {
    if (!filtradas || filtradas.length === 0) { toast.error(t('toast_error.nenhuma_parcela_para_exportar')); return; }
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Relatório de Parcelas', 14, 16);
    doc.setFontSize(10);
    const filtroInfo = [
      filtroModalidade !== 'todas' ? `Modalidade: ${filtroModalidade}` : '',
      filtroStatus !== 'todos' ? `Status: ${filtroStatus}` : '',
      busca ? `Busca: ${busca}` : '',
    ].filter(Boolean).join(' | ');
    if (filtroInfo) doc.text(filtroInfo, 14, 24);
    doc.text(`Gerado em: ${new Date().toLocaleString(i18n.language === 'es' ? 'es-ES' : 'pt-BR')} — Total: ${filtradas.length} parcelas`, 14, filtroInfo ? 30 : 24);
    autoTable(doc, {
      startY: filtroInfo ? 36 : 30,
      head: [['Cliente', 'Parcela', 'Modalidade', 'Vencimento', 'Valor', 'Status']],
      body: filtradas.map(p => [
        p.clienteNome,
        `${p.numeroParcela}/${p.numeroParcelas}`,
        p.modalidade ?? '-',
        formatarData(p.dataVencimento),
        formatarMoeda(p.valorOriginal),
        p.status,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    doc.save(`parcelas_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success(t('toast_success.pdf_exportado_com_sucesso'));
  };

  return (
    <div className="space-y-6">
      {/* Banner de filtro por contrato (Bug #4 corrigido) */}
      {contratoIdFiltro && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <Filter className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-primary font-medium">
            Exibindo apenas parcelas do Contrato #{contratoIdFiltro}
          </span>
          <button
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { window.location.href = '/parcelas'; }}
          >
            <ArrowLeft className="h-3 w-3" />
            Ver todas
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">{t('installments.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtradas?.length ?? 0} {t('installments.installments')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel} className="gap-1.5 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5 text-green-500" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportarPDF} className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5 text-red-500" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Contador por Modalidade */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {modalidadeCount.map(m => (
          <button
            key={m.key}
            className={`p-3 rounded-lg border ${m.color} text-left transition-all hover:opacity-80 ${filtroModalidade === m.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFiltroModalidade(filtroModalidade === m.key ? 'todas' : m.key)}
          >
            <div className={`font-display text-2xl ${m.textColor}`}>{m.qtd}</div>
            <div className="text-xs text-muted-foreground">{m.label}</div>
            {m.qtd > 0 && <div className={`text-xs font-medium ${m.textColor} mt-0.5`}>{formatarMoeda(m.valor)}</div>}
          </button>
        ))}
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "atrasada", label: t('installments.overdue'), color: "border-primary/30 bg-primary/5", textColor: "text-primary" },
          { key: "vencendo_hoje", label: t('installments.dueToday'), color: "border-warning/30 bg-warning/5", textColor: "text-warning" },
          { key: "pendente", label: t('installments.pending'), color: "border-border bg-muted/30", textColor: "text-foreground" },
          { key: "paga", label: t('installments.paid'), color: "border-success/30 bg-success/5", textColor: "text-success" },
        ].map(s => (
          <button
            key={s.key}
            className={`p-3 rounded-lg border ${s.color} text-left transition-all hover:opacity-80 ${filtroStatus === s.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFiltroStatus(filtroStatus === s.key ? "todos" : s.key)}
          >
            <div className={`font-display text-2xl ${s.textColor}`}>{statusCount[s.key as keyof typeof statusCount]}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('loans.searchByClient')} value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Modalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">{t('parcelas.allModalities')}</SelectItem>
            <SelectItem value="diario">{t('common.daily')}</SelectItem>
            <SelectItem value="semanal">{t('common.weekly')}</SelectItem>
            <SelectItem value="quinzenal">{t('common.biweekly')}</SelectItem>
            <SelectItem value="mensal">{t('common.monthly')}</SelectItem>
            <SelectItem value="tabela_price">{t('parcelas.priceTable')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{t('parcelas.allStatuses')}</SelectItem>
            <SelectItem value="atrasada">{t('parcelas.overduePlural')}</SelectItem>
            <SelectItem value="vencendo_hoje">{t('parcelas.dueTodayLabel')}</SelectItem>
            <SelectItem value="pendente">{t('parcelas.pending')}</SelectItem>
            <SelectItem value="paga">{t('parcelas.paidPlural')}</SelectItem>
            <SelectItem value="parcial">{t('common.partial')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="border-border animate-pulse">
              <CardContent className="p-4 h-16" />
            </Card>
          ))}
        </div>
      )}

      {/* Bug #3 corrigido: só mostrar empty state quando dados já foram carregados (parcelas !== undefined) */}
      {!isLoading && parcelas !== undefined && filtradas?.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t('parcelas.noParcelas')}</p>
        </div>
      )}

      <div className="space-y-2">
        {filtradas?.map(parcela => {
          const { total: totalAtualizado, diasAtraso } = calcularJurosMora(
            parseFloat(parcela.valorOriginal),
            new Date(parcela.dataVencimento),
            new Date()
          );
          const { juros: jurosCalc, multa: multaCalc } = calcularJurosMora(
            parseFloat(parcela.valorOriginal),
            new Date(parcela.dataVencimento),
            new Date()
          );
          const mensagem = gerarMensagemCobranca(
            parcela.clienteNome,
            parcela.numeroParcela,
            parcela.numeroParcelas,
            parcela.valorOriginal,
            new Date(parcela.dataVencimento),
            diasAtraso,
            jurosCalc,
            multaCalc,
            totalAtualizado,
            parcela.clienteChavePix,
            configData?.assinaturaWhatsapp ?? '',
            configData?.fechamentoWhatsapp ?? 'Regularize hoje e evite mais juros!'
          );
          const whatsappUrl = parcela.clienteWhatsapp
            ? `https://wa.me/55${parcela.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
            : null;

          return (
            <Card
              key={parcela.id}
              className={`border transition-all ${
                parcela.status === 'atrasada' ? 'border-primary/20 bg-primary/3' :
                parcela.status === 'vencendo_hoje' ? 'border-warning/20 bg-warning/3' :
                parcela.status === 'paga' ? 'border-success/10 opacity-60' :
                'border-border'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{parcela.clienteNome}</span>
                        <StatusBadge status={parcela.status} />
                        {diasAtraso > 0 && (
                          <span className="text-xs text-primary">+{diasAtraso} dias</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Parcela {parcela.numeroParcela}/{parcela.numeroParcelas} · Vence: {formatarData(parcela.dataVencimento)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className={`font-semibold text-sm ${diasAtraso > 0 ? 'text-primary' : 'text-foreground'}`}>
                        {diasAtraso > 0 ? formatarMoeda(totalAtualizado) : formatarMoeda(parcela.valorOriginal)}
                      </div>
                      {diasAtraso > 0 && (
                        <div className="text-xs text-muted-foreground line-through">{formatarMoeda(parcela.valorOriginal)}</div>
                      )}
                    </div>

                    {parcela.status !== 'paga' && (
                      <div className="flex gap-2">
                        {whatsappUrl && (
                          <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-success/30 text-success hover:bg-success/10">
                              <MessageCircle className="h-3 w-3" />
                              <span className="hidden sm:inline">Cobrar</span>
                            </Button>
                          </a>
                        )}
                        <PagamentoDialog
                          parcela={parcela as any}
                          contas={contas ?? []}
                          onSuccess={() => refetch()}
                          configData={configData}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
