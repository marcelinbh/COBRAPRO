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
import { formatarMoeda, formatarData, calcularJurosMora, dataHojeBrasilia, dataVencimentoCivil, diferencaDiasCivis } from "../../../shared/finance";
import { protegerValorDePlanilha } from "@/lib/spreadsheetSafety";
import { RecebimentoValidado } from "@/components/RecebimentoValidado";
// Excel e PDF são carregados sob demanda para reduzir o bundle inicial.

// Templates padrão (mesmos do Cobra Fácil)
const TEMPLATE_ATRASO = `⚠️ *Atenção {CLIENTE}* ━━━━━━━━━━━━━━━━
🚨 *PARCELA EM ATRASO*
💵 *Valor original (referência, não cotação):* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏰ *Dias em Atraso:* {DIAS_ATRASO}
O total, o saldo após pagamentos parciais e eventuais encargos devem ser confirmados na cotação atual antes do pagamento.
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

const TEMPLATE_VENCE_HOJE = `🟡 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━
📅 *SUA PARCELA VENCE HOJE!*
💵 *Valor original (referência, não cotação):* {VALOR}
📊 *{PARCELA}*
⏰ *Vencimento:* {DATA}
O total, o saldo após pagamentos parciais e eventuais encargos devem ser confirmados na cotação atual antes do pagamento.
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

const TEMPLATE_ANTECIPADA = `🟢 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━
📋 *LEMBRETE DE PARCELA*
💵 *Valor original (referência, não cotação):* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏳ *Faltam:* {DIAS_PARA_VENCER} dias
O total, o saldo após pagamentos parciais e eventuais encargos devem ser confirmados na cotação atual antes do pagamento.
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

function gerarMensagemCobranca(
  nome: string,
  numeroParcela: number,
  numeroParcelas: number,
  valorOriginal: string,
  dataVencimento: Date | string,
  diasAtraso: number,
  juros: number,
  multa: number,
  total: number,
  chavePix: string | null,
  assinatura = '',
  fechamento = 'Regularize hoje e evite mais juros!'
): string {
  const hoje = dataHojeBrasilia();
  const vencimento = dataVencimentoCivil(dataVencimento);
  const diferenca = diferencaDiasCivis(hoje, vencimento);
  const diasParaVencer = Math.max(0, diferenca);
  let template = TEMPLATE_ANTECIPADA;
  if (vencimento < hoje) template = TEMPLATE_ATRASO;
  else if (vencimento === hoje) template = TEMPLATE_VENCE_HOJE;
  const fechamentoCivil = vencimento > hoje && fechamento === 'Regularize hoje e evite mais juros!'
    ? 'Este é um lembrete do vencimento futuro.' : fechamento;
  const pixMsg = chavePix ? `🔑 *PIX:* \`${chavePix}\`` : '';
  return template
    .replace(/{CLIENTE}/g, nome)
    .replace(/{VALOR}/g, formatarMoeda(valorOriginal))
    .replace(/{PARCELA}/g, `Parcela ${numeroParcela}/${numeroParcelas}`)
    .replace(/{DATA}/g, formatarData(vencimento))
    .replace(/{DIAS_ATRASO}/g, String(Math.max(0, -diferenca)))
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
    .replace(/{FECHAMENTO}/g, fechamentoCivil ? `✅ ${fechamentoCivil}` : '')
    .trim();
}

function StatusBadge({ status }: { status: string }) {
  const { t, i18n } = useTranslation();
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    paga: { label: t('parcelas.paid'), className: "bg-success/15 text-success border-success/30", icon: CheckCircle },
    pendente: { label: t('parcelas.pending'), className: "bg-muted text-muted-foreground border-border", icon: Clock },
    atrasada: { label: t('parcelas.overdue'), className: "bg-primary/15 text-primary border-primary/30", icon: AlertTriangle },
    vencendo_hoje: { label: t('installments.dueToday'), className: "bg-warning/15 text-warning border-warning/30", icon: Clock },
    parcial: { label: t('parcelas.partial'), className: "bg-warning/15 text-warning border-warning/30", icon: Clock },
    renovada: { label: "Renovada: principal transferido", className: "bg-muted text-muted-foreground border-border", icon: Clock },
    cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border", icon: Clock },
    cancelado: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border", icon: Clock },
  };
  const s = map[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border", icon: Clock };
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
  saldoResidual?: string | null;
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
    const { default: ExcelJS } = await import('exceljs');
    const dados = filtradas.map(p => ({
      cliente: protegerValorDePlanilha(p.clienteNome),
      parcela: `${p.numeroParcela}/${p.numeroParcelas}`,
      modalidade: protegerValorDePlanilha(p.modalidade ?? '-'),
      vencimento: formatarData(p.dataVencimento),
      valorOriginal: parseFloat(p.valorOriginal),
      valorPago: parseFloat(p.valorPago ?? '0'),
      status: protegerValorDePlanilha(p.status),
      dataPagamento: p.dataPagamento ? formatarData(p.dataPagamento) : '-',
    }));
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Parcelas');
    worksheet.columns = [
      { header: 'Cliente', key: 'cliente', width: 32 },
      { header: 'Parcela', key: 'parcela', width: 14 },
      { header: 'Modalidade', key: 'modalidade', width: 15 },
      { header: 'Vencimento', key: 'vencimento', width: 16 },
      { header: 'Valor Original', key: 'valorOriginal', width: 17 },
      { header: 'Valor Pago', key: 'valorPago', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Data Pagamento', key: 'dataPagamento', width: 18 },
    ];
    worksheet.addRows(dados);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getColumn('valorOriginal').numFmt = 'R$ #,##0.00';
    worksheet.getColumn('valorPago').numFmt = 'R$ #,##0.00';

    const conteudo = await workbook.xlsx.writeBuffer();
    const blob = new Blob([new Uint8Array(conteudo)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parcelas_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

      <p className="text-sm text-muted-foreground">Recebimentos de empréstimos novos e parcelas antigas íntegras exigem cotação validada e disponibilidade do fluxo seguro. Registros inconsistentes ficam bloqueados para revisão. A primeira renovação mensal prospectiva elegível pode ser acessada em Receber / conferir; parcelas renovadas permitem somente conferir/repetir uma intenção já preservada na sessão, sem cobrar principal novamente. Descontos e alterações financeiras manuais continuam indisponíveis. Os valores originais da listagem não representam saldos atualizados após pagamentos parciais; confirme a cotação do diálogo. Cobrar nesta listagem permanece bloqueado porque não há cotação autoritativa vinculada à mensagem. Lembretes manuais sem total permanecem disponíveis.</p>
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
            <SelectValue placeholder={t('novoContrato.modality')} />
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
            <SelectValue placeholder={t('parcelas.filterByStatus')} />
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
            parcela.dataVencimento,
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
                        Parcela {parcela.numeroParcela}/{parcela.numeroParcelas} · Vencimento: {formatarData(dataVencimentoCivil(parcela.dataVencimento))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className={`font-semibold text-sm ${diasAtraso > 0 ? 'text-primary' : 'text-foreground'}`}>
                        {formatarMoeda(parcela.valorOriginal)}
                      </div>
                      <div className="text-xs text-muted-foreground">Valor original · sem cotação</div>
                    </div>

                    {parcela.status === 'paga' && <RecebimentoValidado contratoId={parcela.contratoId} parcelaId={parcela.id} permitirRenovacao onSuccess={() => refetch()} />}
                    {parcela.status !== 'paga' && (
                      <div className="flex gap-2">
                        {whatsappUrl && (
                          <span title="Cobrança bloqueada: a listagem não tem cotação autoritativa atual para validar total, encargos e saldo parcial.">
                            <Button disabled size="sm" variant="outline" className="gap-1 h-7 text-xs border-success/30 text-success">
                              <MessageCircle className="h-3 w-3" />
                              <span className="hidden sm:inline">Cobrar bloqueado</span>
                            </Button>
                          </span>
                        )}
                        <RecebimentoValidado
                          contratoId={parcela.contratoId}
                          parcelaId={parcela.id}
                          permitirRenovacao
                          onSuccess={() => refetch()}
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
