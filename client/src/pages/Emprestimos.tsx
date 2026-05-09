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
  Edit2, History, Pencil
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";
import { gerarComprovantePDF } from "@/lib/gerarComprovante";
import { useLocation } from "wouter";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { EmprestimoDetalhesModal } from "@/components/EmprestimoDetalhesModal";
import { DeleteEmprestimoDialog } from "@/components/DeleteEmprestimoDialog";

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
    data_vencimento: string;
    status: string;
  } | null;
  parcelasComAtraso: {
    id: number;
    numero_parcela: number;
    valor_original: string;
    data_vencimento: string;
    status: string;
    diasAtraso: number;
    jurosAtraso: number;
    totalComAtraso: number;
  }[];
  todasParcelas: any[];
  etiquetas?: string[];
};

// ─── MODAL UNIFICADO DE EMPRÉSTIMO (Editar + Detalhes + Histórico + Comprovante) ─
function EditarEmprestimoModal({
  emprestimo,
  onClose,
  onSuccess,
  abaInicial = 'editar',
}: {
  emprestimo: EmprestimoCard;
  onClose: () => void;
  onSuccess: () => void;
  abaInicial?: 'editar' | 'detalhes' | 'historico' | 'comprovante';
}) {
  const { t } = useTranslation();
  const [aba, setAba] = useState<'editar' | 'detalhes' | 'historico' | 'comprovante'>(abaInicial);

  // ── Estados da aba Editar ──
  const [valor, setValor] = useState(parseFloat(emprestimo.valorPrincipal));
  const [juros, setJuros] = useState(parseFloat(emprestimo.taxaJuros));
  const [tipo, setTipo] = useState(emprestimo.tipoTaxa);
  const [parcelas, setParcelas] = useState(emprestimo.numeroParcelas);
  const [jurosAplicado, setJurosAplicado] = useState("total");
  const [dataContrato, setDataContrato] = useState(formatarData(emprestimo.dataInicio));
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(
    emprestimo.proximaParcela ? formatarData(emprestimo.proximaParcela.data_vencimento) : ""
  );
  const [novaParcelaData, setNovaParcelaData] = useState("");
  const [novaParcelaValor, setNovaParcelaValor] = useState("");
  const [showNovaParcela, setShowNovaParcela] = useState(false);

  // ── Estados da aba Detalhes ──
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'paga' | 'atrasada'>('todas');
  const [parcelaEditando, setParcelaEditando] = useState<{ id: number; valor: string; data: string } | null>(null);
  const [showNovaParcelaDetalhes, setShowNovaParcelaDetalhes] = useState(false);
  const [novaParcelaDataDetalhes, setNovaParcelaDataDetalhes] = useState("");
  const [novaParcelaValorDetalhes, setNovaParcelaValorDetalhes] = useState("");

  // ── Estados dos modais de ação ──
  const [modalPagar, setModalPagar] = useState(false);
  const [modalPagarJuros, setModalPagarJuros] = useState(false);
  const [modalEditarJuros, setModalEditarJuros] = useState(false);
  const [modalMulta, setModalMulta] = useState(false);
  const [modalDeletar, setModalDeletar] = useState(false);
  const [contaCaixaId, setContaCaixaId] = useState('');
  const [valorCustomPagar, setValorCustomPagar] = useState('');
  const [valorCustomJuros, setValorCustomJuros] = useState('');
  const [novaTaxa, setNovaTaxa] = useState('');
  const [valorMulta, setValorMulta] = useState('');
  const [dataPagamentoCustom, setDataPagamentoCustom] = useState('');
  const [jurosCustomDetalhes, setJurosCustomDetalhes] = useState('');
  const [novaDataVencJuros, setNovaDataVencJuros] = useState('');
  const [novoValorParcelaJuros, setNovoValorParcelaJuros] = useState('');
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [loadingWpp, setLoadingWpp] = useState(false);
  const [pagamentoRealizado, setPagamentoRealizado] = useState<{ valorPago: number; parcelaNum: number } | null>(null);

  const jurosTotal = valor * (juros / 100);
  const valorParcela = (valor + jurosTotal) / parcelas;
  const totalReceber = valor + jurosTotal;

  const utils = trpc.useUtils();

  // Buscar dados completos para abas Detalhes/Histórico
  const { data: detalhes, refetch: refetchDetalhes } = trpc.contratos.obterDetalhes.useQuery(
    { id: emprestimo.id },
    { enabled: aba === 'detalhes' || aba === 'historico' || aba === 'comprovante' }
  );
  const { data: contas } = trpc.caixa.contas.useQuery();
  const { data: config } = trpc.configuracoes.get.useQuery();
  const { data: historico, isLoading: historicoLoading } = trpc.contratos.historico.useQuery(
    { contratoId: emprestimo.id },
    { enabled: aba === 'historico' }
  );

  const invalidarTudo = () => {
    utils.contratos.list.invalidate();
    utils.contratos.listComParcelas.invalidate();
    utils.dashboard.kpis.invalidate();
    refetchDetalhes();
    onSuccess();
  };

  // ── Mutations ──
  const editarMutation = trpc.contratos.editar.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.empréstimo_atualizado_com_sucesso'));
      invalidarTudo();
      onClose();
    },
    onError: (err) => toast.error('Erro ao atualizar: ' + err.message),
  });

  const criarParcelaMutation = trpc.parcelas.criarParcela.useMutation({
    onSuccess: (data) => {
      toast.success(`Parcela #${data.numeroParcela} criada com sucesso!`);
      setNovaParcelaData(""); setNovaParcelaValor(""); setShowNovaParcela(false);
      setNovaParcelaDataDetalhes(""); setNovaParcelaValorDetalhes(""); setShowNovaParcelaDetalhes(false);
      invalidarTudo();
    },
    onError: (err) => toast.error('Erro ao criar parcela: ' + err.message),
  });

  const editarParcelaMutation = trpc.parcelas.editarParcela.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.parcela_atualizada'));
      setParcelaEditando(null);
      invalidarTudo();
    },
    onError: (e: any) => toast.error('Erro ao atualizar parcela: ' + e.message),
  });

  const pagarTotalMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: (_data, variables) => {
      const parcelaNum = detalhes?.todasParcelas?.find((p: any) => p.id === variables.parcelaId)?.numero_parcela ?? 1;
      setPagamentoRealizado({ valorPago: variables.valorPago, parcelaNum });
      toast.success(t('toast_success.pagamento_registrado'));
      invalidarTudo();
    },
    onError: (e) => toast.error('Erro ao registrar pagamento: ' + e.message),
  });

  const pagarJurosMutation = trpc.parcelas.pagarJuros.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.juros_pagos_empréstimo_renovado'));
      setModalPagarJuros(false);
      invalidarTudo();
    },
    onError: (e) => toast.error('Erro ao pagar juros: ' + e.message),
  });

  const editarJurosMutation = trpc.contratos.editarJuros.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.taxa_de_juros_atualizada'));
      setModalEditarJuros(false); setNovaTaxa('');
      invalidarTudo();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const aplicarMultaMutation = trpc.contratos.aplicarMulta.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.multa_aplicada_com_sucesso'));
      setModalMulta(false); setValorMulta('');
      invalidarTudo();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleSalvar = () => {
    editarMutation.mutate({
      id: emprestimo.id,
      valorPrincipal: valor,
      taxaJuros: String(juros),
      tipoTaxa: tipo,
      numeroParcelas: parcelas,
      dataPrimeiraParcela: dataPrimeiraParcela || undefined,
    });
  };

  const handleCriarParcela = (dataVenc: string, valorP: string) => {
    if (!dataVenc) { toast.error(t('toast_error.informe_a_data_de_vencimento')); return; }
    if (!valorP || parseFloat(valorP) <= 0) { toast.error(t('toast_error.informe_o_valor_da_parcela')); return; }
    criarParcelaMutation.mutate({ contratoId: emprestimo.id, dataVencimento: dataVenc, valorOriginal: parseFloat(valorP) });
  };

  const parcela = emprestimo.proximaParcela ?? emprestimo.parcelasComAtraso[0];
  const valorOriginalParcela = parcela ? parseFloat(String(parcela.valor_original ?? '0')) : 0;
  const valorJurosParcela = emprestimo.valorJurosParcela;
  const parcelaComAtraso = parcela ? emprestimo.parcelasComAtraso.find(p => p.id === parcela.id) : undefined;
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? valorOriginalParcela;
  const isQuitado = emprestimo.status === 'quitado';

  const handlePagar = () => {
    if (!contaCaixaId) { toast.error(t('toast_error.selecione_uma_conta')); return; }
    if (!parcela) { toast.error(t('toast_error.nenhuma_parcela_pendente')); return; }
    const v = valorCustomPagar ? parseFloat(valorCustomPagar) : (diasAtraso > 0 ? totalComAtraso : valorOriginalParcela);
    const jurosVal = jurosCustomDetalhes ? parseFloat(jurosCustomDetalhes) : undefined;
    pagarTotalMutation.mutate({ parcelaId: parcela.id, valorPago: v, contaCaixaId: parseInt(contaCaixaId), valorJurosCustom: jurosVal, dataPagamento: dataPagamentoCustom || undefined });
  };

  const handlePagarJuros = () => {
    if (!contaCaixaId) { toast.error(t('toast_error.selecione_uma_conta')); return; }
    if (!parcela) { toast.error(t('toast_error.nenhuma_parcela_pendente')); return; }
    const v = valorCustomJuros ? parseFloat(valorCustomJuros) : valorJurosParcela;
    pagarJurosMutation.mutate({ parcelaId: parcela.id, valorJurosPago: v, contaCaixaId: parseInt(contaCaixaId), novaDataVencimento: novaDataVencJuros || undefined, novoValorParcela: novoValorParcelaJuros ? parseFloat(novoValorParcelaJuros) : undefined });
  };

  const handleWhatsApp = async () => {
    if (!emprestimo.clienteWhatsapp) { toast.error(t('toast_error.telefone_whatsapp_não_cadastrado')); return; }
    setLoadingWpp(true);
    try {
      const result = await utils.client.whatsapp.gerarMensagemContrato.query({ contratoId: emprestimo.id, tipo: diasAtraso > 0 ? 'atraso' : 'preventivo' });
      if (result.whatsappUrl) window.open(result.whatsappUrl, '_blank');
      else toast.error(t('toast_error.não_foi_possível_gerar_o_link_do_whatsap'));
    } catch {
      const msg = diasAtraso > 0
        ? `⚠️ Olá ${emprestimo.clienteNome}, você tem parcela(s) em atraso. Favor regularizar o quanto antes.`
        : `🟢 Olá ${emprestimo.clienteNome}! Lembrete: você tem parcela vencendo em breve. Fique em dia!`;
      window.open(`https://wa.me/55${emprestimo.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    } finally {
      setLoadingWpp(false);
    }
  };

  const handleGerarComprovante = async () => {
    setGerandoPDF(true);
    try {
      const parcelaPaga = detalhes?.todasParcelas?.find((p: any) => p.status === 'paga') || detalhes?.todasParcelas?.[0];
      await gerarComprovantePDF({
        clienteNome: emprestimo.clienteNome,
        contratoId: emprestimo.id,
        parcelaNumero: parcelaPaga?.numero_parcela ?? 1,
        valorOriginal: parcelaPaga?.valor_original ?? emprestimo.valorPrincipal,
        juros: parcelaPaga?.valor_juros ?? 0,
        valorPago: parcelaPaga?.valor_pago ?? parcelaPaga?.valor_original ?? emprestimo.valorPrincipal,
        dataPagamento: parcelaPaga?.data_pagamento ?? new Date().toISOString(),
        modalidade: emprestimo.modalidade,
        nomeEmpresa: config?.nomeEmpresa || 'CobraPro',
        logoUrl: config?.logoUrl || undefined,
        enderecoEmpresa: config?.enderecoEmpresa || undefined,
        telefoneEmpresa: config?.telefoneEmpresa || undefined,
      });
      toast.success(t('toast_success.comprovante_gerado'));
    } catch {
      toast.error(t('toast_error.erro_ao_gerar_comprovante'));
    } finally {
      setGerandoPDF(false);
    }
  };

  const tipoLabel: Record<string, string> = {
    pagamento: 'Pagamento', pagamento_juros: 'Pagamento de Juros', edicao_juros: 'Edição de Juros',
    aplicacao_multa: 'Multa Aplicada', edicao_parcela: 'Edição de Parcela', edicao_contrato: 'Edição de Contrato',
    reparcelamento: 'Reparcelamento', criacao: 'Criação',
  };
  const tipoColor: Record<string, string> = {
    pagamento: 'text-emerald-400', pagamento_juros: 'text-amber-400', edicao_juros: 'text-blue-400',
    aplicacao_multa: 'text-red-400', edicao_parcela: 'text-purple-400', edicao_contrato: 'text-cyan-400',
    reparcelamento: 'text-orange-400', criacao: 'text-green-400',
  };

  const abas = [
    { id: 'editar', label: '✏️ Editar' },
    { id: 'detalhes', label: '📋 Detalhes' },
    { id: 'historico', label: '📜 Histórico' },
    { id: 'comprovante', label: '📄 Comprovante' },
  ] as const;

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-0 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg">{emprestimo.clienteNome}</DialogTitle>
            <DialogDescription>{emprestimo.modalidade} · {emprestimo.taxaJuros}% {emprestimo.tipoTaxa}</DialogDescription>
          </DialogHeader>
          {/* Abas */}
          <div className="flex gap-1 mt-4 border-b border-border">
            {abas.map(a => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  aba === a.id ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ─── ABA EDITAR ─── */}
          {aba === 'editar' && (
            <div className="space-y-5">
              {/* Cliente */}
              <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {emprestimo.clienteNome.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="font-semibold text-sm">{emprestimo.clienteNome}</div>
                  <div className="text-xs text-muted-foreground">{emprestimo.clienteWhatsapp}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" value={valor} onChange={e => setValor(parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label>Juros (%) *</Label>
                  <Input type="number" step="0.01" value={juros} onChange={e => setJuros(parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Pagamento</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diário</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Parcelas</Label>
                  <Input type="number" value={parcelas} onChange={e => setParcelas(parseInt(e.target.value) || 1)} className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Juros Aplicado</Label>
                <Select value={jurosAplicado} onValueChange={setJurosAplicado}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Sobre o Total</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                <div><div className="text-xs text-muted-foreground">Juros Total</div><div className="text-base font-bold text-emerald-400">{formatarMoeda(jurosTotal)}</div></div>
                <div><div className="text-xs text-muted-foreground">Valor Parcela</div><div className="text-base font-bold text-emerald-400">{formatarMoeda(valorParcela)}</div></div>
                <div><div className="text-xs text-muted-foreground">Total a Receber</div><div className="text-base font-bold text-emerald-400">{formatarMoeda(totalReceber)}</div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data do Contrato</Label>
                  <Input type="date" value={dataContrato.split('/').reverse().join('-')} onChange={e => setDataContrato(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>1ª Parcela *</Label>
                  <Input type="date" value={dataPrimeiraParcela.split('/').reverse().join('-')} onChange={e => setDataPrimeiraParcela(e.target.value)} className="mt-1" />
                </div>
              </div>

              {/* Parcelas existentes */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                  <Label className="text-sm font-semibold">Parcelas do Contrato</Label>
                  <button type="button" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium" onClick={() => setShowNovaParcela(!showNovaParcela)}>
                    <span className="text-base leading-none">+</span> Criar Parcela
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left px-3 py-2 text-muted-foreground">#</th>
                        <th className="text-left px-3 py-2 text-muted-foreground">{t('common.dueDate')}</th>
                        <th className="text-right px-3 py-2 text-muted-foreground">{t('common.value')}</th>
                        <th className="text-right px-3 py-2 text-muted-foreground">Multa</th>
                        <th className="text-center px-3 py-2 text-muted-foreground">Renov.</th>
                        <th className="text-center px-3 py-2 text-muted-foreground">{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(emprestimo.todasParcelas ?? []).length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhuma parcela</td></tr>
                      ) : (
                        (emprestimo.todasParcelas ?? []).map((p: any) => (
                          <tr key={p.id} className="border-b border-border/50 hover:bg-muted/10">
                            <td className="px-3 py-2 font-medium">{p.numero_parcela}</td>
                            <td className="px-3 py-2">{formatarData(p.data_vencimento)}</td>
                            <td className="px-3 py-2 text-right">{formatarMoeda(parseFloat(p.valor_original ?? '0'))}</td>
                            <td className="px-3 py-2 text-right text-amber-400">{parseFloat(p.valor_multa ?? '0') > 0 ? formatarMoeda(parseFloat(p.valor_multa)) : '-'}</td>
                            <td className="px-3 py-2 text-center">{p.contagem_renovacoes > 0 ? <span className="text-blue-400">{p.contagem_renovacoes}x</span> : <span className="text-muted-foreground">-</span>}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                p.status === 'paga' ? 'bg-emerald-500/20 text-emerald-400' :
                                p.status === 'atrasada' ? 'bg-red-500/20 text-red-400' :
                                p.status === 'vencendo_hoje' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : p.status === 'vencendo_hoje' ? 'Hoje' : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {showNovaParcela && (
                  <div className="px-4 py-3 border-t border-border bg-emerald-500/5 space-y-3">
                    <div className="text-xs font-semibold text-emerald-400">{t('emprestimos.newInstallment')}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">{t('emprestimos.dueDateRequired')}</Label>
                        <Input type="date" value={novaParcelaData} onChange={e => setNovaParcelaData(e.target.value)} className="mt-1 h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Valor (R$) *</Label>
                        <Input type="number" step="0.01" min="0.01" placeholder={formatarMoeda(valorParcela)} value={novaParcelaValor} onChange={e => setNovaParcelaValor(e.target.value)} className="mt-1 h-8 text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { setShowNovaParcela(false); setNovaParcelaData(""); setNovaParcelaValor(""); }}>{t('common.cancel')}</Button>
                      <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleCriarParcela(novaParcelaData, novaParcelaValor)} disabled={criarParcelaMutation.isPending}>
                        {criarParcelaMutation.isPending ? 'Criando...' : 'Confirmar Parcela'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de ação rápida */}
              {!isQuitado && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setValorCustomPagar(''); setContaCaixaId(''); setPagamentoRealizado(null); setModalPagar(true); }}>
                    <DollarSign className="h-3.5 w-3.5" /> Pagar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValorCustomJuros(''); setContaCaixaId(''); setModalPagarJuros(true); }}>
                    <TrendingUp className="h-3.5 w-3.5" /> Pagar Juros
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNovaTaxa(String(emprestimo.taxaJuros)); setModalEditarJuros(true); }}>
                    <Edit2 className="h-3.5 w-3.5" /> Editar Juros
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValorMulta(''); setModalMulta(true); }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Aplicar Multa
                  </Button>
                  {emprestimo.clienteWhatsapp && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={handleWhatsApp} disabled={loadingWpp}>
                      {loadingWpp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />} WhatsApp
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setModalDeletar(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Deletar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ─── ABA DETALHES ─── */}
          {aba === 'detalhes' && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Total a Receber', value: formatarMoeda(emprestimo.totalReceber) },
                  { label: 'Total Pago', value: formatarMoeda(emprestimo.totalPago), cls: 'text-green-500' },
                  { label: 'Parcelas Pagas', value: `${emprestimo.parcelasPagas}/${emprestimo.numeroParcelas}` },
                  { label: 'Taxa de Juros', value: `${emprestimo.taxaJuros}% ${emprestimo.tipoTaxa}` },
                  { label: 'Parcelas Abertas', value: String(emprestimo.parcelasAbertas) },
                  { label: 'Só Juros/Parcela', value: formatarMoeda(emprestimo.valorJurosParcela), cls: 'text-amber-400' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-base font-bold ${cls ?? 'text-foreground'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabela de parcelas editáveis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{t('emprestimos.allInstallments')}</p>
                  <div className="flex gap-1">
                    {(['todas', 'pendente', 'paga', 'atrasada'] as const).map(f => (
                      <button key={f} onClick={() => setFiltroStatus(f)}
                        className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                          filtroStatus === f ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}>
                        {f === 'todas' ? 'Todas' : f === 'pendente' ? 'Pendentes' : f === 'paga' ? 'Pagas' : 'Atrasadas'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t('common.dueDate')}</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">{t('common.value')}</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">{t('common.status')}</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">{t('common.edit')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalhes?.todasParcelas ?? emprestimo.todasParcelas)
                        ?.filter((p: any) => filtroStatus === 'todas' || p.status === filtroStatus)
                        .map((p: any) => (
                          parcelaEditando?.id === p.id ? (
                            <tr key={p.id} className="border-b border-border/50 bg-muted/20">
                              <td className="px-3 py-2">#{p.numero_parcela}</td>
                              <td className="px-2 py-1">
                                <Input type="date" value={parcelaEditando?.data ?? ''} onChange={e => setParcelaEditando(prev => prev ? { ...prev, data: e.target.value } : null)} className="h-7 text-xs w-36" />
                              </td>
                              <td className="px-2 py-1 text-right">
                                <Input type="number" step="0.01" value={parcelaEditando?.valor ?? ''} onChange={e => setParcelaEditando(prev => prev ? { ...prev, valor: e.target.value } : null)} className="h-7 text-xs w-28 text-right" />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant={p.status === 'paga' ? 'default' : p.status === 'atrasada' ? 'destructive' : 'secondary'}>
                                  {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}
                                </Badge>
                              </td>
                              <td className="px-2 py-1 text-center">
                                <div className="flex gap-1 justify-center">
                                  <button onClick={() => editarParcelaMutation.mutate({ parcelaId: p.id, novoValor: parcelaEditando ? (parseFloat(parcelaEditando.valor) || undefined) : undefined, novaDataVencimento: parcelaEditando ? (parcelaEditando.data || undefined) : undefined })} disabled={editarParcelaMutation.isPending} className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white" title="Salvar">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => setParcelaEditando(null)} className="p-1 rounded bg-muted hover:bg-muted/80 text-foreground" title="Cancelar">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="px-3 py-2">#{p.numero_parcela}</td>
                              <td className="px-3 py-2">{formatarData(p.data_vencimento)}</td>
                              <td className="px-3 py-2 text-right">{formatarMoeda(p.valor_original)}</td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant={p.status === 'paga' ? 'default' : p.status === 'atrasada' ? 'destructive' : 'secondary'}>
                                  {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {p.status !== 'paga' && (
                                  <button onClick={() => setParcelaEditando({ id: p.id, valor: String(parseFloat(p.valor_original).toFixed(2)), data: p.data_vencimento?.split('T')[0] ?? '' })} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Editar parcela">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        ))}
                    </tbody>
                  </table>
                </div>
                {/* Adicionar nova parcela */}
                {!isQuitado && (
                  <div className="mt-3">
                    {!showNovaParcelaDetalhes ? (
                      <button onClick={() => setShowNovaParcelaDetalhes(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
                        <span className="text-base leading-none">⊕</span> Adicionar Nova Parcela
                      </button>
                    ) : (
                      <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                        <p className="text-sm font-semibold text-foreground">{t('emprestimos.newInstallment')}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">{t('emprestimos.dueDateRequired')}</Label>
                            <Input type="date" value={novaParcelaDataDetalhes} onChange={e => setNovaParcelaDataDetalhes(e.target.value)} className="mt-1 h-8 text-sm [color-scheme:dark]" />
                          </div>
                          <div>
                            <Label className="text-xs">Valor (R$)</Label>
                            <Input type="number" step="0.01" min="0" placeholder={`Padrão: ${formatarMoeda(emprestimo.valorPrincipal)}`} value={novaParcelaValorDetalhes} onChange={e => setNovaParcelaValorDetalhes(e.target.value)} className="mt-1 h-8 text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleCriarParcela(novaParcelaDataDetalhes, novaParcelaValorDetalhes || String(emprestimo.valorPrincipal))} disabled={criarParcelaMutation.isPending || !novaParcelaDataDetalhes} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                            {criarParcelaMutation.isPending ? 'Criando...' : 'Salvar Parcela'}
                          </button>
                          <button onClick={() => { setShowNovaParcelaDetalhes(false); setNovaParcelaDataDetalhes(''); setNovaParcelaValorDetalhes(''); }} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">{t('common.cancel')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              {!isQuitado && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setValorCustomPagar(''); setContaCaixaId(''); setPagamentoRealizado(null); setModalPagar(true); }}>
                    <DollarSign className="h-3.5 w-3.5" /> Pagar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValorCustomJuros(''); setContaCaixaId(''); setModalPagarJuros(true); }}>
                    <TrendingUp className="h-3.5 w-3.5" /> Pagar Juros
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNovaTaxa(String(emprestimo.taxaJuros)); setModalEditarJuros(true); }}>
                    <Edit2 className="h-3.5 w-3.5" /> Editar Juros
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValorMulta(''); setModalMulta(true); }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Aplicar Multa
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ─── ABA HISTÓRICO ─── */}
          {aba === 'historico' && (
            <div className="space-y-2">
              {historicoLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !historico || historico.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">{t('emprestimos.noHistory')}</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">{t('emprestimos.historyWillAppear')}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground mb-3">{t('emprestimos.changeHistory')} ({historico.length})</p>
                  {historico.map((h) => (
                    <div key={h.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold uppercase tracking-wide ${tipoColor[h.tipo] ?? 'text-foreground'}`}>{tipoLabel[h.tipo] ?? h.tipo}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(h.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm text-foreground mt-0.5">{h.descricao}</p>
                        {(h.valorAnterior || h.valorNovo) && (
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            {h.valorAnterior && <span>{t('common.before')}: <span className="text-foreground">{h.valorAnterior}</span></span>}
                            {h.valorNovo && <span>{t('common.after')}: <span className="text-foreground">{h.valorNovo}</span></span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ─── ABA COMPROVANTE ─── */}
          {aba === 'comprovante' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('emprestimos.receiptInfo')}</p>
              {config?.nomeEmpresa && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
                  <p className="font-medium text-foreground">{config.nomeEmpresa}</p>
                  {config.enderecoEmpresa && <p className="text-muted-foreground text-xs mt-1">{config.enderecoEmpresa}</p>}
                  {config.telefoneEmpresa && <p className="text-muted-foreground text-xs">{config.telefoneEmpresa}</p>}
                </div>
              )}
              <Button className="gap-2 w-full" size="lg" onClick={handleGerarComprovante} disabled={gerandoPDF}>
                <Download className="h-4 w-4" />
                {gerandoPDF ? 'Gerando PDF...' : 'Gerar Comprovante em PDF'}
              </Button>
            </div>
          )}

        </div>

        {/* Rodapé fixo — só mostra Salvar na aba Editar */}
        {aba === 'editar' && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSalvar} disabled={editarMutation.isPending}>
              {editarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* ─── MODAIS DE AÇÃO ─── */}
    {/* Modal Pagar */}
    <Dialog open={modalPagar} onOpenChange={(v) => { setModalPagar(v); if (!v) setPagamentoRealizado(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>REGISTRAR PAGAMENTO</DialogTitle>
          <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
        </DialogHeader>
        {pagamentoRealizado ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center"><CheckCircle className="h-8 w-8 text-emerald-500" /></div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-500">{t('emprestimos.paymentRegistered')}</div>
                <div className="text-sm text-muted-foreground">{emprestimo.clienteNome}</div>
                <div className="text-2xl font-bold text-foreground mt-1">{formatarMoeda(pagamentoRealizado.valorPago)}</div>
                <div className="text-xs text-muted-foreground">Parcela {pagamentoRealizado.parcelaNum}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => gerarComprovantePDF({ clienteNome: emprestimo.clienteNome, contratoId: emprestimo.id, parcelaNumero: pagamentoRealizado.parcelaNum, valorOriginal: valorOriginalParcela, juros: valorJurosParcela, valorPago: pagamentoRealizado.valorPago, dataPagamento: new Date().toISOString(), modalidade: emprestimo.modalidade })}>
                <Download className="h-3.5 w-3.5" /> Comprovante PDF
              </Button>
              <Button className="flex-1" onClick={() => { setPagamentoRealizado(null); setModalPagar(false); }}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
              <div className="flex justify-between"><span>{t('common.capital')}</span><span>{formatarMoeda(emprestimo.valorPrincipal)}</span></div>
              <div className="flex justify-between">
                <span>{t('common.interest')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">{formatarMoeda(jurosCustomDetalhes ? parseFloat(jurosCustomDetalhes) : valorJurosParcela)}</span>
                  <button type="button" className="text-[10px] text-muted-foreground underline hover:text-foreground" onClick={() => setJurosCustomDetalhes(jurosCustomDetalhes ? '' : valorJurosParcela.toFixed(2))}>{jurosCustomDetalhes ? 'usar padrão' : 'editar'}</button>
                </div>
              </div>
              {jurosCustomDetalhes !== '' && <Input type="number" step="0.01" min="0" placeholder="Valor dos juros (R$)" value={jurosCustomDetalhes} onChange={e => setJurosCustomDetalhes(e.target.value)} className="h-8 text-sm" />}
              {diasAtraso > 0 && <div className="flex justify-between text-red-400 border-t border-border pt-2"><span>{t('emprestimos.totalWithDelay')} ({diasAtraso} dias)</span><span className="font-semibold">{formatarMoeda(totalComAtraso)}</span></div>}
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>{t('common.total')}</span><span className="text-emerald-400">{formatarMoeda(valorCustomPagar ? parseFloat(valorCustomPagar) : (diasAtraso > 0 ? totalComAtraso : valorOriginalParcela))}</span></div>
            </div>
            <div><Label className="text-xs">{t('emprestimos.valueToPay')}</Label><Input type="number" step="0.01" placeholder={`Padrão: ${formatarMoeda(diasAtraso > 0 ? totalComAtraso : valorOriginalParcela)}`} value={valorCustomPagar} onChange={e => setValorCustomPagar(e.target.value)} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">{t('emprestimos.paymentDate')}</Label><Input type="date" value={dataPagamentoCustom} onChange={e => setDataPagamentoCustom(e.target.value)} className="mt-1 h-9 text-sm [color-scheme:dark]" /></div>
            <div>
              <Label className="text-xs">{t('emprestimos.cashAccount')}</Label>
              <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>{(contas ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalPagar(false)}>{t('common.cancel')}</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={!contaCaixaId || pagarTotalMutation.isPending} onClick={handlePagar}>{pagarTotalMutation.isPending ? 'Processando...' : 'Confirmar'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Modal Pagar Juros */}
    <Dialog open={modalPagarJuros} onOpenChange={(v) => { setModalPagarJuros(v); if (!v) { setValorCustomJuros(''); setContaCaixaId(''); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>PAGAR SÓ JUROS</DialogTitle><DialogDescription>{emprestimo.clienteNome}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
            <p className="text-amber-400 font-semibold">Juros por parcela: {formatarMoeda(valorJurosParcela)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('emprestimos.interestOnlyInfo')}</p>
          </div>
          <div><Label className="text-xs">Valor dos Juros (deixe em branco para usar o valor padrão)</Label><Input type="number" step="0.01" placeholder={String(valorJurosParcela.toFixed(2))} value={valorCustomJuros} onChange={e => setValorCustomJuros(e.target.value)} className="mt-1" /></div>
          {/* Próximo vencimento */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-3">
            <p className="text-xs font-semibold text-blue-400">{t('emprestimos.nextDueDateOptions')}</p>
            <div>
              <Label className="text-xs">{t('emprestimos.nextDueDate')}</Label>
              <Input type="date" value={novaDataVencJuros} onChange={e => setNovaDataVencJuros(e.target.value)} className="mt-1 h-8 text-sm [color-scheme:dark]" />
              <p className="text-[10px] text-muted-foreground mt-1">{t('emprestimos.leaveBlankAutoCalc')}</p>
            </div>
            <div>
              <Label className="text-xs">{t('emprestimos.nextDueDateValue')}</Label>
              <Input type="number" step="0.01" min="0" placeholder={`Padrão: ${formatarMoeda(valorOriginalParcela)}`} value={novoValorParcelaJuros} onChange={e => setNovoValorParcelaJuros(e.target.value)} className="mt-1 h-8 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter o valor atual</p>
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('emprestimos.cashAccount')}</Label>
            <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>{(contas ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalPagarJuros(false)}>{t('common.cancel')}</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700" disabled={!contaCaixaId || pagarJurosMutation.isPending} onClick={handlePagarJuros}>{pagarJurosMutation.isPending ? 'Processando...' : 'Confirmar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Editar Juros */}
    <Dialog open={modalEditarJuros} onOpenChange={(v) => { setModalEditarJuros(v); if (!v) setNovaTaxa(''); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>EDITAR TAXA DE JUROS</DialogTitle><DialogDescription>{emprestimo.clienteNome}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm"><p className="text-muted-foreground">Taxa atual: <span className="font-bold text-foreground">{emprestimo.taxaJuros}% {emprestimo.tipoTaxa}</span></p></div>
          <div><Label>Nova Taxa de Juros (%)</Label><Input type="number" step="0.01" min="0" placeholder="Ex: 5" value={novaTaxa} onChange={e => setNovaTaxa(e.target.value)} className="mt-1" /></div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalEditarJuros(false)}>{t('common.cancel')}</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!novaTaxa.trim() || editarJurosMutation.isPending} onClick={() => editarJurosMutation.mutate({ id: emprestimo.id, novaTaxa })}>{editarJurosMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Aplicar Multa */}
    <Dialog open={modalMulta} onOpenChange={(v) => { setModalMulta(v); if (!v) setValorMulta(''); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>APLICAR MULTA POR ATRASO</DialogTitle><DialogDescription>{emprestimo.clienteNome}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {diasAtraso > 0 && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm"><p className="text-red-400 font-semibold">{diasAtraso} dias de atraso</p><p className="text-xs text-muted-foreground mt-1">A multa será adicionada ao valor das parcelas em atraso.</p></div>}
          <div><Label>Valor da Multa (R$)</Label><Input type="number" step="0.01" min="0" placeholder="Ex: 50.00" value={valorMulta} onChange={e => setValorMulta(e.target.value)} className="mt-1" /></div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalMulta(false)}>{t('common.cancel')}</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={!valorMulta.trim() || aplicarMultaMutation.isPending} onClick={() => aplicarMultaMutation.mutate({ id: emprestimo.id, multa: valorMulta })}>{aplicarMultaMutation.isPending ? 'Aplicando...' : 'Aplicar Multa'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Deletar */}
    <DeleteEmprestimoDialog
      emprestimoId={emprestimo.id}
      clienteNome={emprestimo.clienteNome}
      open={modalDeletar}
      onOpenChange={setModalDeletar}
      onSuccess={() => { onClose(); onSuccess(); }}
    />
    </>
  );
}

// ─── MODAL DE PAGAMENTO ───────────────────────────────────────────────────────
function PagamentoModal({
  emprestimo,
  contas,
  onSuccess,
  modoInicial = 'total',
  triggerLabel,
  triggerClassName,
  triggerIcon,
}: {
  emprestimo: EmprestimoCard;
  contas: { id: number; nome: string; saldoAtual: number }[];
  onSuccess: () => void;
  modoInicial?: 'total' | 'juros';
  triggerLabel?: string;
  triggerClassName?: string;
  triggerIcon?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<'total' | 'juros'>(modoInicial);
  const [contaCaixaId, setContaCaixaId] = useState(contas[0]?.id ? String(contas[0].id) : "");
  const [valorCustom, setValorCustom] = useState("");
  const [jurosCustom, setJurosCustom] = useState(""); // juros editável manualmente
  const [dataPagamentoCustom, setDataPagamentoCustom] = useState(""); // data manual
  const [transferirSaldo, setTransferirSaldo] = useState(true); // transferir saldo residual automaticamente
  const [novaDataVencJuros, setNovaDataVencJuros] = useState(""); // data do próximo vencimento (só juros)
  const [novoValorParcelaJuros, setNovoValorParcelaJuros] = useState(""); // valor do próximo vencimento (só juros)
  const [pagamentoRealizado, setPagamentoRealizado] = useState<{ valorPago: number; parcelaNum: number } | null>(null);

  // TODOS os hooks devem vir ANTES de qualquer early return (Regra dos Hooks do React)
  const utils = trpc.useUtils();

  const pagarTotalMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: (_data, variables) => {
      const valorPago = variables.valorPago;
      const parcelaNum = parcela?.numero_parcela ?? 1;
      setPagamentoRealizado({ valorPago, parcelaNum });
      toast.success(t('toast_success.pagamento_registrado'));
      setTimeout(() => {
        onSuccess();
        utils.contratos.listComParcelas.invalidate();
        utils.dashboard.kpis.invalidate();
      }, 300);
    },
    onError: (e) => {
      toast.error("Erro ao registrar pagamento: " + e.message);
    },
  });

  const pagarJurosMutation = trpc.parcelas.pagarJuros.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.juros_pagos_empréstimo_renovado'));
      setOpen(false);
      setTimeout(() => {
        onSuccess();
        utils.contratos.listComParcelas.invalidate();
        utils.dashboard.kpis.invalidate();
      }, 300);
    },
    onError: (e) => {
      toast.error("Erro ao pagar juros: " + e.message);
      setOpen(false);
    },
  });

  const isPending = pagarTotalMutation.isPending || pagarJurosMutation.isPending;

  // Early return APÓS todos os hooks (regra dos hooks do React)
  const parcela = emprestimo.proximaParcela ?? emprestimo.parcelasComAtraso[0];
  const valorOriginal = parcela ? parseFloat(String(parcela.valor_original ?? '0')) : 0;
  const valorJuros = emprestimo.valorJurosParcela;
  const valorTotal = valorOriginal;
  const valorSoJuros = valorJuros > 0 ? valorJuros : valorOriginal * 0.5;
  const parcelaComAtraso = parcela ? emprestimo.parcelasComAtraso.find(p => p.id === parcela.id) : undefined;
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const jurosAtraso = parcelaComAtraso?.jurosAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? valorTotal;

  if (!parcela) return null;

  const handleConfirmar = () => {
    if (!contaCaixaId) { toast.error(t('toast_error.selecione_uma_conta')); return; }
    const contaId = parseInt(contaCaixaId);
    const dataManual = dataPagamentoCustom || undefined;

    if (tipo === 'total') {
      const valor = valorCustom ? parseFloat(valorCustom) : (diasAtraso > 0 ? totalComAtraso : valorTotal);
      const jurosVal = jurosCustom ? parseFloat(jurosCustom) : undefined;
      pagarTotalMutation.mutate({
        parcelaId: parcela.id,
        valorPago: valor,
        contaCaixaId: contaId,
        valorJurosCustom: jurosVal,
        dataPagamento: dataManual,
        transferirSaldoResidual: transferirSaldo,
      });
    } else {
      const valor = valorCustom ? parseFloat(valorCustom) : (jurosCustom ? parseFloat(jurosCustom) : valorSoJuros);
      pagarJurosMutation.mutate({
        parcelaId: parcela.id,
        valorJurosPago: valor,
        contaCaixaId: contaId,
        novaDataVencimento: novaDataVencJuros || undefined,
        novoValorParcela: novoValorParcelaJuros ? parseFloat(novoValorParcelaJuros) : undefined,
      });
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTipo(modoInicial);
    setValorCustom("");
    setJurosCustom("");
    setDataPagamentoCustom("");
    setTransferirSaldo(true);
    setNovaDataVencJuros("");
    setNovoValorParcelaJuros("");
    setOpen(true);
  };

  return (
    <>
      <Button
        size="sm"
        className={triggerClassName ?? "h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"}
        onClick={handleOpen}
      >
        {triggerIcon ?? <CheckCircle className="h-3.5 w-3.5" />}
        {triggerLabel ?? "Pagar"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>REGISTRAR PAGAMENTO</DialogTitle>
            <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
          </DialogHeader>

          {pagamentoRealizado ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-success">{t('emprestimos.paymentRegistered')}</div>
                  <div className="text-sm text-muted-foreground">{emprestimo.clienteNome}</div>
                  <div className="text-2xl font-bold text-foreground mt-1">{formatarMoeda(pagamentoRealizado.valorPago)}</div>
                  <div className="text-xs text-muted-foreground">Parcela {pagamentoRealizado.parcelaNum}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => {
                  gerarComprovantePDF({
                    clienteNome: emprestimo.clienteNome,
                    contratoId: emprestimo.id,
                    parcelaNumero: pagamentoRealizado.parcelaNum,
                    valorOriginal: valorTotal,
                    juros: valorSoJuros,
                    valorPago: pagamentoRealizado.valorPago,
                    dataPagamento: new Date().toISOString(),
                    modalidade: emprestimo.modalidade,
                  });
                }}>
                  <Download className="h-3.5 w-3.5" /> Comprovante PDF
                </Button>
                <Button className="flex-1" onClick={() => { setPagamentoRealizado(null); setOpen(false); }}>Fechar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Saldo residual de parcela anterior */}
              {(() => {
                const saldoAnterior = parseFloat(String((parcela as any).saldo_residual ?? '0'));
                return saldoAnterior > 0 ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      Saldo Residual da Parcela Anterior
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor pendente anterior</span>
                      <span className="text-amber-400 font-bold">{formatarMoeda(saldoAnterior)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Este valor foi adicionado ao total desta parcela automaticamente.</p>
                  </div>
                ) : null;
              })()}

              {/* Resumo Capital / Juros / Total */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>{t('common.capital')}</span>
                  <span className="font-medium">{formatarMoeda(emprestimo.valorPrincipal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Juros ({emprestimo.taxaJuros}%)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-medium">{formatarMoeda(jurosCustom ? parseFloat(jurosCustom) : valorSoJuros)}</span>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground underline hover:text-foreground"
                      onClick={() => setJurosCustom(jurosCustom ? "" : valorSoJuros.toFixed(2))}
                    >
                      {jurosCustom ? "usar padrão" : "editar"}
                    </button>
                  </div>
                </div>
                {jurosCustom !== "" && (
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Valor dos juros (R$)"
                      value={jurosCustom}
                      onChange={e => setJurosCustom(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>{t('common.total')}</span>
                  <span className="text-emerald-400">
                    {formatarMoeda(
                      valorCustom ? parseFloat(valorCustom) :
                      diasAtraso > 0 ? totalComAtraso :
                      emprestimo.valorPrincipal + (jurosCustom ? parseFloat(jurosCustom) : valorSoJuros)
                    )}
                  </span>
                </div>
              </div>

              {/* Tipo de pagamento */}
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as 'total' | 'juros')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Pagar Total</SelectItem>
                    <SelectItem value="juros">Só Juros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Valor personalizado */}
              <div>
                <Label className="text-xs">{t('emprestimos.valueToPay')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Padrão: ${formatarMoeda(tipo === 'total' ? (diasAtraso > 0 ? totalComAtraso : valorTotal) : valorSoJuros)}`}
                  value={valorCustom}
                  onChange={e => setValorCustom(e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              {/* Data de pagamento manual */}
              <div>
                <Label className="text-xs">{t('emprestimos.paymentDate')}</Label>
                <Input
                  type="date"
                  value={dataPagamentoCustom}
                  onChange={e => setDataPagamentoCustom(e.target.value)}
                  className="mt-1 h-9 text-sm [color-scheme:dark]"
                  placeholder="Hoje (padrão)"
                />
                {!dataPagamentoCustom && (
                  <p className="text-[10px] text-muted-foreground mt-1">{t('emprestimos.leaveBlankToday')}</p>
                )}
              </div>

              {/* Campos de próximo vencimento para pagamento Só Juros */}
              {tipo === 'juros' && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <RefreshCw className="h-4 w-4" />
                    Próxima Renovação
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('emprestimos.nextDueDate')}</Label>
                    <Input
                      type="date"
                      value={novaDataVencJuros}
                      onChange={e => setNovaDataVencJuros(e.target.value)}
                      className="mt-1 h-9 text-sm [color-scheme:dark]"
                    />
                    {!novaDataVencJuros && (
                      <p className="text-[10px] text-muted-foreground mt-1">{t('emprestimos.leaveBlankAutoCalc')}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('emprestimos.nextDueDateValue')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={`Padrão: ${formatarMoeda(valorTotal)}`}
                      value={novoValorParcelaJuros}
                      onChange={e => setNovoValorParcelaJuros(e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                    {!novoValorParcelaJuros && (
                      <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter o valor atual</p>
                    )}
                  </div>
                </div>
              )}

              {/* Saldo residual automático - mostrar quando valor pago < total */}
              {(() => {
                const valorDigitado = valorCustom ? parseFloat(valorCustom) : 0;
                const valorReferencia = diasAtraso > 0 ? totalComAtraso : valorTotal;
                const saldoAnterior = parseFloat(String((parcela as any).saldo_residual ?? '0'));
                const totalDevido = valorReferencia + saldoAnterior;
                const temPagamentoParcial = valorDigitado > 0 && valorDigitado < totalDevido - 0.01;
                return temPagamentoParcial ? (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm space-y-2">
                    <div className="flex items-center gap-2 text-blue-400 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      Pagamento Parcial Detectado
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo que faltará</span>
                      <span className="text-blue-400 font-bold">{formatarMoeda(Math.max(0, totalDevido - valorDigitado))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Transferir saldo para próxima parcela</span>
                      <button
                        type="button"
                        onClick={() => setTransferirSaldo(!transferirSaldo)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          transferirSaldo ? 'bg-blue-500' : 'bg-muted'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          transferirSaldo ? 'translate-x-4' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    {transferirSaldo && (
                      <p className="text-[10px] text-blue-300">✓ O saldo de {formatarMoeda(Math.max(0, totalDevido - valorDigitado))} será somado automaticamente à próxima parcela.</p>
                    )}
                    {!transferirSaldo && (
                      <p className="text-[10px] text-muted-foreground">O saldo não será transferido. A parcela ficará como "parcial".</p>
                    )}
                  </div>
                ) : null;
              })()}

              {/* {t('emprestimos.cashAccount')} */}
              <div>
                <Label className="text-xs">{t('emprestimos.cashAccount')}</Label>
                <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={!contaCaixaId || isPending}
                  onClick={handleConfirmar}
                >
                  {isPending ? "Processando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

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
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [abaModalInicial, setAbaModalInicial] = useState<'editar' | 'detalhes' | 'historico' | 'comprovante'>('editar');
  const [showEditarJurosModal, setShowEditarJurosModal] = useState<number | null>(null);
  const [showAplicarMultaModal, setShowAplicarMultaModal] = useState<number | null>(null);
  const [showEtiquetasModal, setShowEtiquetasModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showDetalhesCompleto, setShowDetalhesCompleto] = useState(false);
  const [showComprovanteModal, setShowComprovanteModal] = useState(false);
  const [novasTaxaJuros, setNovasTaxaJuros] = useState<string>("");
  const [valorMulta, setValorMulta] = useState<string>("");
  const [motivoMulta, setMotivoMulta] = useState<string>("");
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState("");
  const [novaEtiquetaCor, setNovaEtiquetaCor] = useState("#6366f1");
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const utils = trpc.useUtils();

  const { data: todasEtiquetas = [] } = trpc.etiquetas.listar.useQuery();
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState<string[]>(emp.etiquetas ?? []);

  const criarEtiquetaMutation = trpc.etiquetas.criar.useMutation({
    onSuccess: () => { toast.success(t('toast_success.etiqueta_criada')); setNovaEtiquetaNome(""); utils.etiquetas.listar.invalidate(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const removerEtiquetaMutation = trpc.etiquetas.remover.useMutation({
    onSuccess: () => { utils.etiquetas.listar.invalidate(); },
  });
  const aplicarEtiquetasMutation = trpc.etiquetas.aplicarContrato.useMutation({
    onSuccess: () => { toast.success(t('toast_success.etiquetas_salvas')); setShowEtiquetasModal(false); onRefresh(); utils.contratos.listComParcelas.invalidate(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const editarJurosMutation = trpc.contratos.editarJuros.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.taxa_de_juros_atualizada'));
      setShowEditarJurosModal(null);
      setNovasTaxaJuros("");
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const aplicarMultaMutation = trpc.contratos.aplicarMulta.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.multa_aplicada_com_sucesso'));
      setShowAplicarMultaModal(null);
      setValorMulta("");
      setMotivoMulta("");
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deletarMutation = trpc.contratos.deletar.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.empréstimo_deletado'));
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const parcela = emp.proximaParcela ?? emp.parcelasComAtraso[0];
  const parcelaComAtraso = emp.parcelasComAtraso.length > 0 ? emp.parcelasComAtraso[0] : null;
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const jurosAtraso = parcelaComAtraso?.jurosAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? 0;

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
            onClick={() => { setAbaModalInicial('detalhes'); setShowEditarModal(true); }}
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
                <span className={`text-xs font-semibold ${diasAtraso > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {diasAtraso > 0 ? 'Atrasado' : 'Em Dia'}
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
                <Tag className="w-3 h-3" /> Etiqueta
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 border-border/50 bg-transparent hover:bg-accent/20"
                onClick={() => { setAbaModalInicial('detalhes'); setShowEditarModal(true); }}
              >
                <Eye className="w-3 h-3" /> Detalhes
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 border-border/50 bg-transparent hover:bg-accent/20"
                onClick={handleGerarComprovante}
                disabled={gerandoPDF}
              >
                <FileText className="w-3 h-3" /> Comprovante
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
          <div className="text-xs text-muted-foreground mt-0.5">restante a receber</div>
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
              <div className="text-muted-foreground">Emprestado</div>
              <div className="font-bold text-white">{formatarMoeda(emp.valorPrincipal)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total a Receber</div>
              <div className="font-bold text-white">{formatarMoeda(emp.totalReceber)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">💰 Lucro Previsto</div>
              <div className="font-bold text-emerald-400">{formatarMoeda(emp.lucroPrevisto)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">✅ Lucro Realizado</div>
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
              <button className="ml-1 text-muted-foreground hover:text-foreground">
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
          <span className="text-sm text-purple-200">Só Juros (por parcela):</span>
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
                onClick={() => setShowEditarJurosModal(emp.id)}
              >
                <Edit className="w-3 h-3" /> Editar Juros
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs gap-1 border-border/50 bg-transparent hover:bg-accent/20 text-emerald-300 hover:text-emerald-200"
                onClick={() => setShowAplicarMultaModal(emp.id)}
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
          <PagamentoModal
            emprestimo={emp}
            contas={contas}
            onSuccess={onRefresh}
            triggerClassName="flex-1 h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
            triggerLabel="Pagar"
            triggerIcon={<CheckCircle className="h-3.5 w-3.5" />}
          />

          {/* Pagar Juros */}
          <PagamentoModal
            emprestimo={emp}
            contas={contas}
            onSuccess={onRefresh}
            modoInicial="juros"
            triggerClassName="flex-1 h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
            triggerLabel="Pagar Juros"
            triggerIcon={<DollarSign className="h-3.5 w-3.5" />}
          />

          {/* Ícones de ação */}
          <div className="flex gap-1">
            {/* Histórico */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20"
              title="Histórico de pagamentos"
              onClick={() => setLocation(`/emprestimos/${emp.id}`)}
            >
              <Clock className="h-4 w-4" />
            </Button>

            {/* Editar */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20"
              title="Editar empréstimo"
              onClick={() => { setAbaModalInicial('editar'); setShowEditarModal(true); }}
            >
              <Edit className="h-4 w-4" />
            </Button>

            {/* Renegociar / Cobrar WhatsApp */}
            <Button
              size="sm"
              variant="outline"
              className={`h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20 ${diasAtraso > 0 ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
              title={diasAtraso > 0 ? 'Cobrar via WhatsApp' : 'Cobrança preventiva'}
              onClick={() => handleWhatsApp(diasAtraso > 0 ? 'atraso' : 'preventivo')}
              disabled={loadingWpp}
            >
              {loadingWpp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>

            {/* Deletar (vermelho) */}
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-red-700 hover:bg-red-800 text-white border-0"
              title="Deletar empréstimo"
              onClick={() => { if (confirm('Tem certeza que deseja deletar este empréstimo?')) deletarMutation.mutate({ id: emp.id }); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Botões de ação secundários - REMOVIDO (integrado na barra inferior) */}
        <div className="hidden">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Editar Juros"
            onClick={() => setShowEditarJurosModal(emp.id)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Aplicar Multa"
            onClick={() => setShowAplicarMultaModal(emp.id)}
          >
            <Zap className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Deletar"
            onClick={() => {
              if (confirm('Tem certeza?')) {
                deletarMutation.mutate({ id: emp.id });
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title={t('common.history')}
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title={t('common.details')}
            onClick={() => { setAbaModalInicial('detalhes'); setShowEditarModal(true); }}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title={t('common.edit')}
            onClick={() => { setAbaModalInicial('editar'); setShowEditarModal(true); }}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs col-span-3 sm:col-span-1"
            title="Etiquetas"
            onClick={() => setShowEtiquetasModal(true)}
          >
            <Tag className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {showEditarModal && (
        <EditarEmprestimoModal
          emprestimo={emp}
          onClose={() => { setShowEditarModal(false); setAbaModalInicial('editar'); }}
          onSuccess={onRefresh}
          abaInicial={abaModalInicial}
        />
      )}

      {showEditarJurosModal === emp.id && (
        <Dialog open={true} onOpenChange={() => setShowEditarJurosModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Taxa de Juros</DialogTitle>
              <DialogDescription>{emp.clienteNome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Taxa de Juros Atual (%)</Label>
                <Input 
                  type="number" 
                  defaultValue={emp.taxaJuros} 
                  placeholder="Ex: 5"
                  onChange={(e) => setNovasTaxaJuros(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditarJurosModal(null)}>{t('common.cancel')}</Button>
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700" 
                  onClick={() => {
                    if (!novasTaxaJuros.trim()) {
                      toast.error(t('toast_error.digite_a_nova_taxa_de_juros'));
                      return;
                    }
                    editarJurosMutation.mutate({
                      id: emp.id,
                      novaTaxa: novasTaxaJuros,
                    });
                  }}
                  disabled={editarJurosMutation.isPending}
                >
                  {editarJurosMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showAplicarMultaModal === emp.id && (
        <Dialog open={true} onOpenChange={() => setShowAplicarMultaModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aplicar Multa por Atraso</DialogTitle>
              <DialogDescription>{emp.clienteNome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Valor da Multa (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="Ex: 100.00"
                  value={valorMulta}
                  onChange={(e) => setValorMulta(e.target.value)}
                />
              </div>
              <div>
                <Label>Motivo</Label>
                <Input 
                  type="text" 
                  placeholder="Ex: Atraso de 30 dias"
                  value={motivoMulta}
                  onChange={(e) => setMotivoMulta(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAplicarMultaModal(null)}>{t('common.cancel')}</Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700" 
                  onClick={() => {
                    if (!valorMulta.trim()) {
                      toast.error(t('toast_error.digite_o_valor_da_multa'));
                      return;
                    }
                    aplicarMultaMutation.mutate({
                      id: emp.id,
                      multa: valorMulta,
                    });
                  }}
                  disabled={aplicarMultaMutation.isPending}
                >
                  {aplicarMultaMutation.isPending ? "Aplicando..." : "Aplicar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Etiquetas */}
      {showDetalhesCompleto && (
        <EmprestimoDetalhesModal
          emprestimo={emp}
          open={showDetalhesCompleto}
          onOpenChange={setShowDetalhesCompleto}
          contas={contas}
          onRefresh={onRefresh}
        />
      )}
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
                  {aplicarEtiquetasMutation.isPending ? "Salvando..." : "Salvar Etiquetas"}
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
  const { t } = useTranslation();
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

  const { data: emprestimos, isLoading, refetch } = trpc.contratos.listComParcelas.useQuery();
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

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Empréstimos</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Gerencie seus empréstimos</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1 hidden sm:flex">
            <Eye className="h-4 w-4" />
            Tutorial
          </Button>
          <Button size="sm" variant="outline" className="gap-1 hidden sm:flex">
            <FileText className="h-4 w-4" />
            Baixar Relatório
          </Button>
          <Button
            size="sm"
            onClick={() => setLocation('/contratos/novo')}
            className="gap-1 bg-emerald-600 hover:bg-emerald-700 sm:hidden"
          >
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 sm:gap-4 border-b border-border overflow-x-auto">
        {[
          { id: 'emprestimos', label: 'Empréstimos', count: emprestimos?.length ?? 0 },
          { id: 'diario', label: 'Diário', count: 0 },
          { id: 'price', label: 'Parcela Fixa', count: 0 },
          { id: 'recebimentos', label: 'Recebimentos', count: recebimentosData?.total ?? 0 },
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
                {selecionados.length} selecionado(s)
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={selecionarTodosAtrasados}
              >
                Selecionar Atrasados
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-red-700 hover:bg-red-800 text-white text-xs"
                disabled={selecionados.length === 0 || cobrarLoteMutation.isPending}
                onClick={() => cobrarLoteMutation.mutate({ contratoIds: selecionados, tipo: 'atraso' })}
              >
                {cobrarLoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Cobrar Selecionados
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-green-700 hover:bg-green-800 text-white text-xs"
                disabled={selecionados.length === 0 || cobrarLoteMutation.isPending}
                onClick={() => cobrarLoteMutation.mutate({ contratoIds: selecionados, tipo: 'preventivo' })}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Preventivo em Lote
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto text-xs"
                onClick={() => { setModoSelecao(false); setSelecionados([]); }}
              >
                Cancelar
              </Button>
            </div>
          )}

          {/* Filtros e Busca */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
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
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="atrasados">Atrasados</SelectItem>
                <SelectItem value="emdia">Em Dia</SelectItem>
              </SelectContent>
            </Select>
            {koletores && koletores.length > 0 && (
              <Select value={filtroKoletor} onValueChange={setFiltroKoletor}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Cobrador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Cobradores</SelectItem>
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
              Lote
            </Button>
            <Button
              size="sm"
              variant={modoVisualizacao === 'pasta' ? 'default' : 'outline'}
              className="gap-1"
              title={modoVisualizacao === 'pasta' ? 'Ver como cards' : 'Ver por cliente (pasta)'}
              onClick={() => setModoVisualizacao(v => v === 'cards' ? 'pasta' : 'cards')}
            >
              {modoVisualizacao === 'pasta' ? <LayoutGrid className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
              {modoVisualizacao === 'pasta' ? 'Cards' : 'Pasta'}
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
                Total: {recebimentosData.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </div>

          {/* Lista de recebimentos */}
          {loadingRecebimentos ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : recebimentosData?.recebimentos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum recebimento no período</div>
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
                      <div className="text-xs text-muted-foreground">{r.contaNome} · {new Date(r.dataTransacao).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-400">
                    +{r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Abas placeholder */}
      {(abaSelecionada === 'diario' || abaSelecionada === 'price') && (
        <div className="p-8 text-center text-muted-foreground">
          Em breve: {abaSelecionada === 'diario' ? 'Empréstimos Diários' : 'Parcela Fixa'}
        </div>
      )}


    </div>
  );
}
