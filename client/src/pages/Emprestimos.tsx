import { useTranslation } from 'react-i18next';
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, Plus, MessageCircle, CheckCircle, Clock, AlertTriangle,
  TrendingUp, DollarSign, Filter, RefreshCw, FileText, ChevronDown, ChevronUp,
  Edit, Trash2, Send, Phone, Eye, List, Zap, Users, ExternalLink, Loader2, Tag, X, Check, FolderOpen, LayoutGrid, Download,
  Edit2, History, Pencil, CreditCard
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";
import { gerarComprovantePDF } from "@/lib/gerarComprovante";
import { badgeContrato } from "@/lib/statusEmprestimoBadge";
import { useLocation } from "wouter";
import { rotaReparcelamentoAtual } from "@/lib/legacyFinanceNavigation";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { EmprestimosListaSeguraFallback } from "@/components/EmprestimosListaSeguraFallback";
import { deveUsarListaSegura } from "../../../shared/emprestimosListaSegura";

type EmprestimoCard = {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteWhatsapp: string | null;
  clienteChavePix: string | null;
  modalidade: string;
  status: string;
  valorPrincipal: string;
  valorParcela: string;
  numeroParcelas: number;
  taxaJuros: string;
  tipoTaxa: string;
  dataInicio: string;
  totalReceber: number;
  totalPago: number;
  lucroPrevisto: number;
  lucroRealizado: number;
  valorJurosParcela: number;
  parcelasAbertas: number;
  parcelasAtrasadas: number;
  parcelasPagas: number;
  proximaParcela: {
    id: number;
    numero_parcela: number;
    valor_original: string;
    saldo_residual?: string | null;
    data_vencimento: string;
    status: string;
  } | null;
  parcelasComAtraso: {
    id: number;
    numero_parcela: number;
    valor_original: string;
    saldo_residual?: string | null;
    data_vencimento: string;
    status: string;
    diasAtraso: number;
    jurosAtraso: number;
    totalComAtraso: number;
  }[];
  todasParcelas: any[];
  etiquetas?: string[];
};

// ─── CARD DE EMPRÉSTIMO (COBRA FÁCIL STYLE) ────────────────────────────────────
function EmprestimoCardCobra({
  emp,
  contas,
  onRefresh,
}: {
  emp: EmprestimoCard;
  contas: { id: number; nome: string; saldoAtual: number }[];
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [showEtiquetasModal, setShowEtiquetasModal] = useState(false);
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState("");
  const [novaEtiquetaCor, setNovaEtiquetaCor] = useState("#6366f1");
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const utils = trpc.useUtils();

  const { data: todasEtiquetas = [] } = trpc.etiquetas.listar.useQuery();
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState<string[]>(emp.etiquetas ?? []);

  const criarEtiquetaMutation = trpc.etiquetas.criar.useMutation({
    onSuccess: () => { toast.success(t('toast_success.etiqueta_criada')); setNovaEtiquetaNome(""); utils.etiquetas.listar.invalidate(); },
    onError: (e) => toast.error(t("toast.errorPrefix") + e.message),
  });
  const removerEtiquetaMutation = trpc.etiquetas.remover.useMutation({
    onSuccess: () => { utils.etiquetas.listar.invalidate(); },
  });
  const aplicarEtiquetasMutation = trpc.etiquetas.aplicarContrato.useMutation({
    onSuccess: () => { toast.success(t('toast_success.etiquetas_salvas')); setShowEtiquetasModal(false); onRefresh(); utils.contratos.listComParcelas.invalidate(); },
    onError: (e) => toast.error(t("toast.errorPrefix") + e.message),
  });

  const deletarMutation = trpc.contratos.deletar.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.empréstimo_deletado'));
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error(t("toast.errorPrefix") + e.message),
  });

  const parcela = emp.proximaParcela ?? emp.parcelasComAtraso[0];
  const parcelaComAtraso = emp.parcelasComAtraso.length > 0 ? emp.parcelasComAtraso[0] : null;
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const jurosAtraso = parcelaComAtraso?.jurosAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? 0;

  const statusBadge = badgeContrato(emp.status, diasAtraso > 0);

  const initials = emp.clienteNome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];
  const bgColor = colors[emp.clienteId % colors.length];

  const [loadingWpp, setLoadingWpp] = useState(false);

  const handleWhatsApp = async (tipo: 'atraso' | 'preventivo' = 'atraso') => {
    if (!emp.clienteWhatsapp) {
      toast.error(t('toast_error.telefone_whatsapp_não_cadastrado'));
      return;
    }
    setLoadingWpp(true);
    try {
      const result = await utils.client.whatsapp.gerarMensagemContrato.query({
        contratoId: emp.id,
        tipo,
      });
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, '_blank');
      } else {
        toast.error(t('toast_error.não_foi_possível_gerar_o_link_do_whatsap'));
      }
    } catch {
      // Fallback para mensagem simples
      const msg = tipo === 'atraso'
        ? `⚠️ Olá ${emp.clienteNome}, você tem parcela(s) em atraso. Favor regularizar o quanto antes.`
        : `🟢 Olá ${emp.clienteNome}! Lembrete: você tem parcela vencendo em breve. Fique em dia!`;
      const url = `https://wa.me/55${emp.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    } finally {
      setLoadingWpp(false);
    }
  };

  const handleGerarComprovante = async () => {
    setGerandoPDF(true);
    try {
      const parcelaPaga = emp.todasParcelas?.find((p: any) => p.status === 'paga') || emp.todasParcelas?.[0];
      await gerarComprovantePDF({
        clienteNome: emp.clienteNome,
        contratoId: emp.id,
        parcelaNumero: parcelaPaga?.numero_parcela ?? 1,
        valorOriginal: parcelaPaga?.valor_original ?? emp.valorPrincipal,
        juros: parcelaPaga?.valor_juros ?? 0,
        valorPago: parcelaPaga?.valor_pago ?? parcelaPaga?.valor_original ?? emp.valorPrincipal,
        dataPagamento: parcelaPaga?.data_pagamento ?? new Date().toISOString(),
        modalidade: emp.modalidade,
      });
      toast.success(t('toast_success.comprovante_gerado'));
    } catch {
      toast.error(t('toast_error.erro_ao_gerar_comprovante'));
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
           CARD ESTILO COBRA FÁCIL
      ═══════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border/60 overflow-hidden bg-[#0f1923] shadow-xl hover:shadow-2xl transition-all">

        {/* ── HEADER: Nome + Status + Modalidade ── */}
        <div className="bg-[#0a1520] px-4 pt-4 pb-3 border-b border-border/40">
          {/* Nome centralizado */}
          <h3 
            className="text-center font-bold text-white text-base tracking-wide mb-2 cursor-pointer hover:text-emerald-400 transition-colors"
            onClick={() => setLocation(`/emprestimos/${emp.id}`)}
            title="Clique para ver detalhes"
          >
            {emp.clienteNome.toUpperCase()}
          </h3>

          {/* Avatar + badges + botões de ação */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                {initials}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={`text-xs font-semibold ${statusBadge.variant === 'destructive' ? 'text-red-400' : statusBadge.variant === 'default' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  {statusBadge.label}
                </span>
                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${emp.tipoTaxa === 'quinzenal' ? 'bg-cyan-700' : emp.tipoTaxa === 'semanal' ? 'bg-purple-700' : emp.tipoTaxa === 'diaria' ? 'bg-orange-700' : emp.tipoTaxa === 'diario' ? 'bg-orange-700' : 'bg-blue-700'} text-white border-0`}>
                  {emp.tipoTaxa?.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Botões Etiqueta | Detalhes | Comprovante */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 border-border/50 bg-transparent hover:bg-accent/20"
                onClick={() => setShowEtiquetasModal(true)}
              >
                <Tag className="w-3 h-3" /> {t('loans.label')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 border-border/50 bg-transparent hover:bg-accent/20"
                onClick={() => setLocation(`/emprestimos/${emp.id}`)}
              >
                <Eye className="w-3 h-3" /> {t('loans.details')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 border-border/50 bg-transparent hover:bg-accent/20"
                onClick={handleGerarComprovante}
                disabled={gerandoPDF}
              >
                <FileText className="w-3 h-3" /> {t('loans.receipt')}
              </Button>
            </div>
          </div>

          {/* Etiquetas aplicadas */}
          {etiquetasSelecionadas.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {etiquetasSelecionadas.map((nome) => {
                const et = todasEtiquetas.find((e: any) => e.nome === nome);
                return (
                  <span key={nome} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: et?.cor ?? '#6366f1' }}>
                    <Tag className="w-2 h-2" />{nome}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── VALOR PRINCIPAL ── */}
        <div className="px-4 py-4 text-center border-b border-border/40">
          <div className="text-3xl font-bold text-emerald-400">{formatarMoeda(emp.totalReceber)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{t('loans.remainingToReceive')}</div>
          {diasAtraso > 0 && (
            <div className="text-xs text-red-400 mt-1 font-medium">
              contém {formatarMoeda(jurosAtraso)} de juros por atraso
            </div>
          )}
        </div>

        {/* ── KPIs: Emprestado | Total a Receber | Lucro Previsto | Lucro Realizado ── */}
        <div className="px-4 py-3 border-b border-border/40">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <div className="text-muted-foreground">{t('loans.borrowed')}</div>
              <div className="font-bold text-white">{formatarMoeda(emp.valorPrincipal)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('loans.totalToReceive')}</div>
              <div className="font-bold text-white">{formatarMoeda(emp.totalReceber)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">💰 {t('loans.projectedProfit')}</div>
              <div className="font-bold text-emerald-400">{formatarMoeda(emp.lucroPrevisto)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">✅ {t('loans.realizedProfit')}</div>
              <div className="font-bold text-emerald-400">
                {formatarMoeda(emp.lucroRealizado)}{' '}
                <span className="text-muted-foreground font-normal">
                  {emp.lucroPrevisto > 0 ? `${Math.round((emp.lucroRealizado / emp.lucroPrevisto) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Venc + Pago */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Venc: <span className="text-foreground font-medium">{parcela ? formatarData(parcela.data_vencimento) : 'N/A'}</span></span>
              <button title="Alterar vencimentos no calendário completo" onClick={() => setLocation(`/emprestimos/${emp.id}#manutencao-financeira`)} className="ml-1 text-muted-foreground hover:text-foreground">
                <Edit className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span>Pago: <span className="text-emerald-400 font-medium">{formatarMoeda(emp.totalPago)}</span></span>
            </div>
          </div>
        </div>

        {/* ── SÓ JUROS ── */}
        <div className="mx-4 my-3 px-4 py-2.5 rounded-lg bg-purple-900/30 border border-purple-500/30 flex items-center justify-between">
          <span className="text-sm text-purple-200">{t('loans.onlyInterest')}:</span>
          <span className="text-sm font-bold text-purple-300">{formatarMoeda(emp.valorJurosParcela)}</span>
        </div>

        {/* ── BLOCO DE ATRASO ── */}
        {diasAtraso > 0 && parcelaComAtraso && (
          <div className="mx-4 mb-3 rounded-lg bg-red-950/60 border border-red-500/40 overflow-hidden">
            {/* Cabeçalho do atraso */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-red-500/30">
              <span className="text-sm font-bold text-red-300">
                Parcela {parcelaComAtraso.numero_parcela}/{emp.numeroParcelas} em atraso
              </span>
              <span className="text-sm font-bold text-red-400">{diasAtraso} dias</span>
            </div>

            {/* Detalhes do atraso */}
            <div className="px-4 py-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vencimento: {formatarData(parcelaComAtraso.data_vencimento)}</span>
                <span className="text-white font-medium">Valor: {formatarMoeda(parcelaComAtraso.valor_original)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">% Juros (R$ {diasAtraso > 0 ? (jurosAtraso / diasAtraso).toFixed(2) : '0,00'}/dia)</span>
                <span className="text-orange-400 font-bold">+{formatarMoeda(jurosAtraso)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-red-500/30">
                <span className="text-white font-semibold">Total com Atraso:</span>
                <span className="text-white font-bold">{formatarMoeda(totalComAtraso)}</span>
              </div>
            </div>

            {/* Botões Editar Juros e Aplicar Multa */}
            <div className="px-4 pb-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs gap-1 border-border/50 bg-transparent hover:bg-accent/20 text-purple-300 hover:text-purple-200"
                onClick={() => setLocation(`/emprestimos/${emp.id}#manutencao-financeira`)}
              >
                <Edit className="w-3 h-3" /> Alterar juros futuros
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs gap-1 border-border/50 bg-transparent hover:bg-accent/20 text-emerald-300 hover:text-emerald-200"
                onClick={() => setLocation(`/emprestimos/${emp.id}`)}
              >
                <DollarSign className="w-3 h-3" /> Aplicar Multa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                onClick={() => { if (confirm('Deletar este empréstimo?')) deletarMutation.mutate({ id: emp.id }); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Mensagem de regularização */}
            <div className="px-4 pb-2 text-[10px] text-muted-foreground">
              Pague a parcela em atraso para regularizar o empréstimo
            </div>
          </div>
        )}

        {/* ── BARRA DE AÇÕES INFERIOR ── */}
        <div className="px-4 pb-4 flex items-center gap-2 border-t border-border/40 pt-3">
          {/* Pagar */}
          <Button className="flex-1 h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
            onClick={() => setLocation(`/emprestimos/${emp.id}`)}>
            <CheckCircle className="h-3.5 w-3.5" /> Receber / conferir
          </Button>

          {/* A ficha oferece somente recebimento/renovação validados para a origem. */}
          <Button className="flex-1 h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
            onClick={() => setLocation(`/emprestimos/${emp.id}`)}>
            <DollarSign className="h-3.5 w-3.5" /> Receber / renovar
          </Button>

          <Button variant="outline" size="sm" onClick={() => setLocation(rotaReparcelamentoAtual(emp.id))}>Reparcelar mensal</Button>

          {/* Ícones de ação */}
          <div className="flex gap-1">
            {/* Histórico */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20"
              title={t('loanDetails.paymentHistory')}
              onClick={() => setLocation(`/emprestimos/${emp.id}`)}
            >
              <Clock className="h-4 w-4" />
            </Button>

            {/* Editar */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20"
              title="Alterar juros, valores ou vencimentos"
              onClick={() => setLocation(`/emprestimos/${emp.id}`)}
            >
              <Edit className="h-4 w-4" />
            </Button>

            {/* Etiquetas */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20 text-violet-400 hover:text-violet-300"
              title="Etiquetas"
              onClick={() => setShowEtiquetasModal(true)}
            >
              <Tag className="h-4 w-4" />
            </Button>
            {/* Renegociar / Cobrar WhatsApp */}
            <Button
              size="sm"
              variant="outline"
              className={`h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20 ${diasAtraso > 0 ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
              title={diasAtraso > 0 ? t('loans.collectWhatsApp') : t('loans.preventiveCollection')}
              onClick={() => handleWhatsApp(diasAtraso > 0 ? 'atraso' : 'preventivo')}
              disabled={loadingWpp}
            >
              {loadingWpp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>

            {/* Deletar (vermelho) */}
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-red-700 hover:bg-red-800 text-white border-0"
              title={t('loanDetails.deleteLoan')}
              onClick={() => { if (confirm('Tem certeza que deseja deletar este empréstimo?')) deletarMutation.mutate({ id: emp.id }); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>

      {showEtiquetasModal && (
        <Dialog open={true} onOpenChange={() => setShowEtiquetasModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Tag className="w-4 h-4" /> Etiquetas</DialogTitle>
              <DialogDescription>{emp.clienteNome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Criar nova etiqueta */}
              <div className="flex gap-2">
                <Input placeholder="Nome da etiqueta" value={novaEtiquetaNome} onChange={(e) => setNovaEtiquetaNome(e.target.value)} className="flex-1" />
                <input type="color" value={novaEtiquetaCor} onChange={(e) => setNovaEtiquetaCor(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
                <Button size="sm" onClick={() => { if (novaEtiquetaNome.trim()) criarEtiquetaMutation.mutate({ nome: novaEtiquetaNome.trim(), cor: novaEtiquetaCor }); }} disabled={criarEtiquetaMutation.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {/* Lista de etiquetas disponíveis */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {todasEtiquetas.map((et: any) => {
                  const selecionada = etiquetasSelecionadas.includes(et.nome);
                  return (
                    <div key={et.id} className="flex items-center justify-between p-2 rounded border border-border hover:bg-accent/30">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEtiquetasSelecionadas(selecionada ? etiquetasSelecionadas.filter(n => n !== et.nome) : [...etiquetasSelecionadas, et.nome])} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border flex items-center justify-center" style={{ backgroundColor: selecionada ? et.cor : 'transparent', borderColor: et.cor }}>
                            {selecionada && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: et.cor }}>
                            <Tag className="w-2.5 h-2.5" />{et.nome}
                          </span>
                        </button>
                      </div>
                      <button onClick={() => removerEtiquetaMutation.mutate({ id: et.id })} className="text-muted-foreground hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {todasEtiquetas.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma etiqueta criada ainda</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEtiquetasModal(false)}>{t('common.cancel')}</Button>
                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => aplicarEtiquetasMutation.mutate({ contratoId: emp.id, etiquetas: etiquetasSelecionadas })} disabled={aplicarEtiquetasMutation.isPending}>
                  {aplicarEtiquetasMutation.isPending ? t('common.saving') : t('emprestimos.saveLabels')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function Emprestimos() {
  const { t, i18n } = useTranslation();
  const [busca, setBusca] = useState("");
  const [abaSelecionada, setAbaSelecionada] = useState("emprestimos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroKoletor, setFiltroKoletor] = useState("todos");
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [loadingLote, setLoadingLote] = useState(false);
  const [periodoRecebimentos, setPeriodoRecebimentos] = useState<'hoje' | 'semana' | 'mes' | 'todos'>('mes');
  const [modoVisualizacao, setModoVisualizacao] = useState<'cards' | 'pasta'>('cards');
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: emprestimos, error: erroLista, isPending, isLoading, isError, isFetching, refetch } = trpc.contratos.listComParcelas.useQuery(undefined, {
    retry: (failureCount, error) => !deveUsarListaSegura(error) && failureCount < 3,
  });
  const { data: contas } = trpc.caixa.contas.useQuery();
  const { data: koletores } = trpc.cobradores.list.useQuery();
  const { data: recebimentosData, isLoading: loadingRecebimentos } = trpc.whatsapp.recebimentos.useQuery(
    { periodo: periodoRecebimentos },
    { enabled: abaSelecionada === 'recebimentos' }
  );

  const cobrarLoteMutation = trpc.whatsapp.cobrarLote.useMutation({
    onSuccess: (data) => {
      const urls = data.resultados.filter(r => r.whatsappUrl && r.sucesso);
      if (urls.length === 0) {
        toast.error(t('toast_error.nenhum_cliente_tem_whatsapp_cadastrado'));
        return;
      }
      toast.success(`Abrindo ${urls.length} cobranças...`);
      // Abrir uma por uma com delay para não bloquear popups
      urls.forEach((r, i) => {
        setTimeout(() => {
          if (r.whatsappUrl) window.open(r.whatsappUrl, '_blank');
        }, i * 800);
      });
      setSelecionados([]);
      setModoSelecao(false);
    },
    onError: (e) => toast.error('Erro na cobrança em lote: ' + e.message),
  });

  const toggleSelecao = (id: number) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selecionarTodosAtrasados = () => {
    const atrasadosIds = (emprestimos ?? []).filter(e => e.parcelasComAtraso.length > 0).map(e => e.id);
    setSelecionados(atrasadosIds);
  };

  const emprestimosFiltrados = useMemo(() => {
    if (!emprestimos) return [];
    let resultado = emprestimos;

    if (busca) {
      resultado = resultado.filter(e =>
        e.clienteNome.toLowerCase().includes(busca.toLowerCase())
      );
    }

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(e => {
        const temAtraso = e.parcelasComAtraso.length > 0;
        return filtroStatus === 'atrasados' ? temAtraso : !temAtraso;
      });
    }

    if (filtroKoletor !== 'todos') {
      const koletorId = parseInt(filtroKoletor);
      resultado = resultado.filter(e => (e as any).koletorId === koletorId);
    }

    return resultado;
  }, [emprestimos, busca, filtroStatus, filtroKoletor]);

  // Agrupar empréstimos por cliente
  const emprestimosAgrupados = useMemo(() => {
    const grupos: Record<number, {
      clienteId: number;
      clienteNome: string;
      clienteWhatsapp: string | null;
      emprestimos: typeof emprestimosFiltrados;
      totalCapital: number;
      totalReceber: number;
      totalAtrasados: number;
      totalEmDia: number;
    }> = {};
    emprestimosFiltrados.forEach(e => {
      if (!grupos[e.clienteId]) {
        grupos[e.clienteId] = {
          clienteId: e.clienteId,
          clienteNome: e.clienteNome,
          clienteWhatsapp: e.clienteWhatsapp,
          emprestimos: [],
          totalCapital: 0,
          totalReceber: 0,
          totalAtrasados: 0,
          totalEmDia: 0,
        };
      }
      grupos[e.clienteId].emprestimos.push(e);
      grupos[e.clienteId].totalCapital += parseFloat(e.valorPrincipal);
      grupos[e.clienteId].totalReceber += e.totalReceber;
      if (e.parcelasComAtraso.length > 0) grupos[e.clienteId].totalAtrasados += 1;
      else grupos[e.clienteId].totalEmDia += 1;
    });
    return Object.values(grupos).sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
  }, [emprestimosFiltrados]);

  const atrasados = emprestimos?.filter(e => e.parcelasComAtraso.length > 0).length ?? 0;
  const emDia = (emprestimos?.length ?? 0) - atrasados;
  const capitalNaRua = emprestimos?.reduce((s, e) => s + parseFloat(e.valorPrincipal), 0) ?? 0;
  const totalReceber = emprestimos?.reduce((s, e) => s + e.totalReceber, 0) ?? 0;

  // Fallback separado: não mistura dados/totais parciais com cards ou ações estritos.
  if (isError && deveUsarListaSegura(erroLista)) return <EmprestimosListaSeguraFallback
    onRetryStrict={() => { void refetch(); }} isRetryingStrict={isFetching} />;

  // isLoading exclui pending/paused. Ausência de resposta e vazio em refetch não confirmam ausência de registros.
  const leituraEmAndamento = isLoading || isPending || (!isError && (!emprestimos || (isFetching && emprestimos.length === 0)));
  if (leituraEmAndamento || isError) return <div className="space-y-4">
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-2xl font-bold">{t('loans.title')}</h1>
      <Button onClick={() => setLocation('/contratos/novo')}><Plus className="h-4 w-4" /> Novo empréstimo</Button>
    </div>
    {leituraEmAndamento ? <p role="status">Carregando empréstimos...</p> : <div role="alert" className="space-y-3 rounded-lg border p-4">
      <p>Não foi possível carregar os empréstimos. A consulta está indisponível; isso não significa que os registros foram apagados. Não cadastre novamente uma dívida já existente.</p>
      <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>Tentar novamente</Button>
    </div>}
  </div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('loans.title')}</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">{t('loans.manageLoans')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1 hidden sm:flex">
            <Eye className="h-4 w-4" />
            {t('common.tutorial')}
          </Button>
          <Button size="sm" variant="outline" className="gap-1 hidden sm:flex">
            <FileText className="h-4 w-4" />
            {t('common.downloadReport')}
          </Button>
          <Button
            size="sm"
            onClick={() => setLocation('/contratos/novo')}
            className="gap-1 bg-emerald-600 hover:bg-emerald-700 sm:hidden"
          >
            <Plus className="h-4 w-4" />
            {t('loans.new')}
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 sm:gap-4 border-b border-border overflow-x-auto">
        {[
          { id: 'emprestimos', label: t('loans.title'), count: emprestimos?.filter(e => e.modalidade !== 'diario' && e.modalidade !== 'emprestimo_diario' && e.modalidade !== 'tabela_price').length ?? 0 },
          { id: 'diario', label: t('loans.daily'), count: emprestimos?.filter(e => e.modalidade === 'diario' || e.modalidade === 'emprestimo_diario').length ?? 0 },
          { id: 'price', label: t('loans.fixedInstallment'), count: emprestimos?.filter(e => e.modalidade === 'tabela_price').length ?? 0 },
          { id: 'recebimentos', label: t('loans.receipts'), count: recebimentosData?.total ?? 0 },
        ].map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaSelecionada(aba.id)}
            className={`pb-3 px-2 text-sm font-medium transition-all border-b-2 ${
              abaSelecionada === aba.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {aba.label} ({aba.count})
          </button>
        ))}
      </div>

      {abaSelecionada === 'emprestimos' && (
        <>
          {/* Barra de Cobrança em Lote */}
          {modoSelecao && (
            <div className="flex items-center gap-3 p-3 bg-blue-900/30 border border-blue-500/40 rounded-lg">
              <span className="text-sm font-medium text-blue-300">
                {selecionados.length} {t('loans.selected')}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={selecionarTodosAtrasados}
              >
                {t('loans.selectOverdue')}
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-red-700 hover:bg-red-800 text-white text-xs"
                disabled={selecionados.length === 0 || cobrarLoteMutation.isPending}
                onClick={() => cobrarLoteMutation.mutate({ contratoIds: selecionados, tipo: 'atraso' })}
              >
                {cobrarLoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {t('loans.collectSelected')}
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-green-700 hover:bg-green-800 text-white text-xs"
                disabled={selecionados.length === 0 || cobrarLoteMutation.isPending}
                onClick={() => cobrarLoteMutation.mutate({ contratoIds: selecionados, tipo: 'preventivo' })}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t('loans.preventiveBatch')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto text-xs"
                onClick={() => { setModoSelecao(false); setSelecionados([]); }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          )}

          {/* Filtros e Busca */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('loans.searchByClient')}
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t('loans.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t('common.all')}</SelectItem>
                <SelectItem value="atrasados">{t('loans.overdue')}</SelectItem>
                <SelectItem value="emdia">{t('loans.onTime')}</SelectItem>
              </SelectContent>
            </Select>
            {koletores && koletores.length > 0 && (
              <Select value={filtroKoletor} onValueChange={setFiltroKoletor}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('loans.collector')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">{t('loans.allCollectors')}</SelectItem>
                  {koletores.map((k: any) => (
                    <SelectItem key={k.id} value={String(k.id)}>{k.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant={modoSelecao ? 'default' : 'outline'}
              className="gap-1"
              onClick={() => { setModoSelecao(!modoSelecao); setSelecionados([]); }}
            >
              <Users className="h-4 w-4" />
              {t('loans.batch')}
            </Button>
            <Button
              size="sm"
              variant={modoVisualizacao === 'pasta' ? 'default' : 'outline'}
              className="gap-1"
              title={modoVisualizacao === 'pasta' ? t('loans.viewAsCards') : t('loans.viewByClient')}
              onClick={() => setModoVisualizacao(v => v === 'cards' ? 'pasta' : 'cards')}
            >
              {modoVisualizacao === 'pasta' ? <LayoutGrid className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
              {modoVisualizacao === 'pasta' ? t('loans.cards') : t('loans.folder')}
            </Button>
            <Button
              onClick={() => setLocation('/contratos/novo')}
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </div>

          {/* Modo Cards (padrão) */}
          {modoVisualizacao === 'cards' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {emprestimosFiltrados.map(emp => (
                  <div key={emp.id} className="relative">
                    {modoSelecao && (
                      <div
                        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 cursor-pointer flex items-center justify-center ${
                          selecionados.includes(emp.id)
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-background border-border'
                        }`}
                        onClick={() => toggleSelecao(emp.id)}
                      >
                        {selecionados.includes(emp.id) && <CheckCircle className="h-4 w-4" />}
                      </div>
                    )}
                    <EmprestimoCardCobra
                      emp={emp}
                      contas={contas ?? []}
                      onRefresh={() => refetch()}
                    />
                  </div>
                ))}
              </div>
              {emprestimosFiltrados.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum empréstimo encontrado
                </div>
              )}
            </>
          )}

          {/* Modo Pasta (agrupado por cliente) */}
          {modoVisualizacao === 'pasta' && (
            <>
              {emprestimosAgrupados.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum empréstimo encontrado
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-3">
                  {emprestimosAgrupados.map(grupo => {
                    const iniciais = grupo.clienteNome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                    const temAtraso = grupo.totalAtrasados > 0;
                    return (
                      <AccordionItem
                        key={grupo.clienteId}
                        value={String(grupo.clienteId)}
                        className="border border-border rounded-xl overflow-hidden bg-card last:border-b"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/10">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                              temAtraso ? 'bg-red-600' : 'bg-emerald-600'
                            }`}>
                              {iniciais}
                            </div>
                            {/* Info do cliente */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">{grupo.clienteNome.toUpperCase()}</span>
                                {temAtraso ? (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full shrink-0">🔴 {grupo.totalAtrasados} atrasado{grupo.totalAtrasados > 1 ? 's' : ''}</span>
                                ) : (
                                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">🟢 Em Dia</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                <span>{grupo.emprestimos.length} contrato{grupo.emprestimos.length > 1 ? 's' : ''}</span>
                                <span>Capital: <span className="text-foreground font-medium">{formatarMoeda(grupo.totalCapital)}</span></span>
                                <span>A receber: <span className="text-warning font-medium">{formatarMoeda(grupo.totalReceber)}</span></span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {grupo.emprestimos.map(emp => (
                              <div key={emp.id} className="relative">
                                {modoSelecao && (
                                  <div
                                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 cursor-pointer flex items-center justify-center ${
                                      selecionados.includes(emp.id)
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'bg-background border-border'
                                    }`}
                                    onClick={() => toggleSelecao(emp.id)}
                                  >
                                    {selecionados.includes(emp.id) && <CheckCircle className="h-4 w-4" />}
                                  </div>
                                )}
                                <EmprestimoCardCobra
                                  emp={emp}
                                  contas={contas ?? []}
                                  onRefresh={() => refetch()}
                                />
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </>
          )}
        </>
      )}

      {/* Aba Recebimentos */}
      {abaSelecionada === 'recebimentos' && (
        <div className="space-y-4">
          {/* Filtro de período */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Período:</span>
            {(['hoje', 'semana', 'mes', 'todos'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodoRecebimentos(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  periodoRecebimentos === p
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'hoje' ? 'Hoje' : p === 'semana' ? '7 dias' : p === 'mes' ? 'Este Mês' : 'Todos'}
              </button>
            ))}
            {recebimentosData && (
              <span className="ml-auto text-sm font-bold text-emerald-400">
                Total: {recebimentosData.totalValor.toLocaleString(i18n.language === 'es' ? 'es-ES' : 'pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </div>

          {/* Lista de recebimentos */}
          {loadingRecebimentos ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : recebimentosData?.recebimentos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t('loanDetails.noReceiptsInPeriod')}</div>
          ) : (
            <div className="space-y-2">
              {recebimentosData?.recebimentos.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{r.descricao}</div>
                      <div className="text-xs text-muted-foreground">{r.contaNome} · {new Date(r.dataTransacao).toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'pt-BR')}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-400">
                    +{r.valor.toLocaleString(i18n.language === 'es' ? 'es-ES' : 'pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aba Diário */}
      {abaSelecionada === 'diario' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(emprestimos ?? []).filter(e => e.modalidade === 'diario' || e.modalidade === 'emprestimo_diario').map(emp => (
              <EmprestimoCardCobra
                key={emp.id}
                emp={emp}
                contas={contas ?? []}
                onRefresh={() => refetch()}
              />
            ))}
          </div>
          {(emprestimos ?? []).filter(e => e.modalidade === 'diario' || e.modalidade === 'emprestimo_diario').length === 0 && (
            <div className="p-8 text-center text-muted-foreground">{t('loans.noLoansFound')}</div>
          )}
        </>
      )}

      {/* Aba Parcela Fixa (Price) */}
      {abaSelecionada === 'price' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(emprestimos ?? []).filter(e => e.modalidade === 'tabela_price').map(emp => (
              <EmprestimoCardCobra
                key={emp.id}
                emp={emp}
                contas={contas ?? []}
                onRefresh={() => refetch()}
              />
            ))}
          </div>
          {(emprestimos ?? []).filter(e => e.modalidade === 'tabela_price').length === 0 && (
            <div className="p-8 text-center text-muted-foreground">{t('loans.noLoansFound')}</div>
          )}
        </>
      )}


    </div>
  );
}
