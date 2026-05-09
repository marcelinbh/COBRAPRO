'use client';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  MessageCircle, Edit2, AlertTriangle, DollarSign, TrendingUp,
  Trash2, FileText, Send, ArrowLeft, Download, CheckCircle, Loader2, Pencil, Filter, History, Clock
} from 'lucide-react';
import { formatarMoeda, formatarData } from '../../../shared/finance';
import { trpc } from '@/lib/trpc';
import { gerarComprovantePDF } from '@/lib/gerarComprovante';
import { DeleteEmprestimoDialog } from '@/components/DeleteEmprestimoDialog';

export default function EmprestimoDetalhes() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [aba, setAba] = useState<'etiqueta' | 'detalhes' | 'comprovante' | 'historico'>('etiqueta');
  const { id } = useParams<{ id: string }>();
  const emprestimoId = parseInt(id || '0');

  // Estado dos modais de ação
  const [modalPagar, setModalPagar] = useState(false);
  const [modalPagarJuros, setModalPagarJuros] = useState(false);
  const [modalEditarJuros, setModalEditarJuros] = useState(false);
  const [modalMulta, setModalMulta] = useState(false);
  const [modalDeletar, setModalDeletar] = useState(false);

  // Campos dos modais
  const [contaCaixaId, setContaCaixaId] = useState('');
  const [valorCustomPagar, setValorCustomPagar] = useState('');
  const [valorCustomJuros, setValorCustomJuros] = useState('');
  const [novaTaxa, setNovaTaxa] = useState('');
  const [valorMulta, setValorMulta] = useState('');
  const [loadingWpp, setLoadingWpp] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [pagamentoRealizado, setPagamentoRealizado] = useState<{ valorPago: number; parcelaNum: number } | null>(null);

  // Estado para editar parcela individualmente
  const [parcelaEditando, setParcelaEditando] = useState<{ id: number; valor: string; data: string } | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'paga' | 'atrasada'>('todas');
  // Estado para criar nova parcela
  const [showNovaParcela, setShowNovaParcela] = useState(false);
  const [novaParcelaData, setNovaParcelaData] = useState('');
  const [novaParcelaValor, setNovaParcelaValor] = useState('');
  // Estado para pagamento com data/juros customizados
  const [dataPagamentoCustom, setDataPagamentoCustom] = useState('');
  const [jurosCustomDetalhes, setJurosCustomDetalhes] = useState('');

  const utils = trpc.useUtils();
  const { data: contas } = trpc.caixa.contas.useQuery();
  const { data: config } = trpc.configuracoes.get.useQuery();

  const { data: emprestimo, isLoading, refetch } = trpc.contratos.obterDetalhes.useQuery(
    { id: emprestimoId },
    { enabled: emprestimoId > 0 }
  );

  const pagarTotalMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: (_data, variables) => {
      const parcelaNum = emprestimo?.todasParcelas?.find((p: any) => p.id === variables.parcelaId)?.numero_parcela ?? 1;
      setPagamentoRealizado({ valorPago: variables.valorPago, parcelaNum });
      toast.success(t('toast_success.pagamento_registrado'));
      refetch();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error('Erro ao registrar pagamento: ' + e.message),
  });

  const pagarJurosMutation = trpc.parcelas.pagarJuros.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.juros_pagos_empréstimo_renovado'));
      setModalPagarJuros(false);
      refetch();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error('Erro ao pagar juros: ' + e.message),
  });

  const editarJurosMutation = trpc.contratos.editarJuros.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.taxa_de_juros_atualizada'));
      setModalEditarJuros(false);
      setNovaTaxa('');
      refetch();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const criarParcelaMutation = trpc.parcelas.criarParcela.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.parcela_criada_com_sucesso'));
      setShowNovaParcela(false);
      setNovaParcelaData('');
      setNovaParcelaValor('');
      refetch();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e: any) => toast.error('Erro ao criar parcela: ' + e.message),
  });

  const editarParcelaMutation = trpc.parcelas.editarParcela.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.parcela_atualizada'));
      setParcelaEditando(null);
      refetch();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e: any) => toast.error('Erro ao atualizar parcela: ' + e.message),
  });

  const aplicarMultaMutation = trpc.contratos.aplicarMulta.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.multa_aplicada_com_sucesso'));
      setModalMulta(false);
      setValorMulta('');
      refetch();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!emprestimo) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">Empréstimo não encontrado</p>
        <Button onClick={() => setLocation('/emprestimos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Empréstimos
        </Button>
      </div>
    );
  }

  const diasAtraso = emprestimo.parcelasComAtraso?.[0]?.diasAtraso ?? 0;
  const jurosAtraso = emprestimo.parcelasComAtraso?.[0]?.jurosAtraso ?? 0;
  const totalComAtraso = emprestimo.parcelasComAtraso?.[0]?.totalComAtraso ?? 0;
  const isAtrasado = diasAtraso > 0;
  const isQuitado = emprestimo.status === 'quitado';
  const parcela = emprestimo.todasParcelas?.find((p: any) => p.status !== 'paga') ?? emprestimo.todasParcelas?.[0];
  const valorOriginalParcela = parcela ? parseFloat(String(parcela.valor_original ?? '0')) : 0;
  const valorJurosParcela = emprestimo.valorJurosParcela;

  const handlePagar = () => {
    if (!contaCaixaId) { toast.error(t('toast_error.selecione_uma_conta')); return; }
    if (!parcela) { toast.error(t('toast_error.nenhuma_parcela_pendente')); return; }
    const valor = valorCustomPagar ? parseFloat(valorCustomPagar) : (isAtrasado ? totalComAtraso : valorOriginalParcela);
    const jurosVal = jurosCustomDetalhes ? parseFloat(jurosCustomDetalhes) : undefined;
    const dataManual = dataPagamentoCustom || undefined;
    pagarTotalMutation.mutate({
      parcelaId: parcela.id,
      valorPago: valor,
      contaCaixaId: parseInt(contaCaixaId),
      valorJurosCustom: jurosVal,
      dataPagamento: dataManual,
    });
  };

  const handleCriarParcela = () => {
    if (!novaParcelaData) { toast.error(t('toast_error.informe_a_data_de_vencimento')); return; }
    const valor = novaParcelaValor ? parseFloat(novaParcelaValor) : (emprestimo?.valorPrincipal ?? 0);
    if (valor <= 0) { toast.error(t('toast_error.informe_um_valor_válido')); return; }
    criarParcelaMutation.mutate({
      contratoId: emprestimoId,
      dataVencimento: novaParcelaData,
      valorOriginal: valor,
    });
  };

  const handlePagarJuros = () => {
    if (!contaCaixaId) { toast.error(t('toast_error.selecione_uma_conta')); return; }
    if (!parcela) { toast.error(t('toast_error.nenhuma_parcela_pendente')); return; }
    const valor = valorCustomJuros ? parseFloat(valorCustomJuros) : valorJurosParcela;
    pagarJurosMutation.mutate({
      parcelaId: parcela.id,
      valorJurosPago: valor,
      contaCaixaId: parseInt(contaCaixaId),
    });
  };

  const handleWhatsApp = async (tipo: 'atraso' | 'preventivo' = 'atraso') => {
    if (!emprestimo.clienteWhatsapp) { toast.error(t('toast_error.telefone_whatsapp_não_cadastrado')); return; }
    setLoadingWpp(true);
    try {
      const result = await utils.client.whatsapp.gerarMensagemContrato.query({
        contratoId: emprestimo.id,
        tipo,
      });
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, '_blank');
      } else {
        toast.error(t('toast_error.não_foi_possível_gerar_o_link_do_whatsap'));
      }
    } catch {
      const msg = tipo === 'atraso'
        ? `⚠️ Olá ${emprestimo.clienteNome}, você tem parcela(s) em atraso. Favor regularizar o quanto antes.`
        : `🟢 Olá ${emprestimo.clienteNome}! Lembrete: você tem parcela vencendo em breve. Fique em dia!`;
      const url = `https://wa.me/55${emprestimo.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    } finally {
      setLoadingWpp(false);
    }
  };

  const handleGerarComprovante = async () => {
    setGerandoPDF(true);
    try {
      const parcelaPaga = emprestimo.todasParcelas?.find((p: any) => p.status === 'paga') || emprestimo.todasParcelas?.[0];
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/emprestimos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-3xl text-foreground tracking-wide">{emprestimo.clienteNome}</h1>
            <p className="text-sm text-muted-foreground mt-1">{emprestimo.modalidade}</p>
          </div>
        </div>
        <Badge variant={isQuitado ? 'secondary' : isAtrasado ? 'destructive' : 'default'}>
          {isQuitado ? 'QUITADO' : isAtrasado ? 'ATRASADO' : 'EM DIA'}
        </Badge>
      </div>

      {/* KPI Principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-lg bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20">
          <p className="text-sm text-muted-foreground mb-2">Restante a Receber</p>
          <p className="text-4xl font-bold text-red-400 mb-1">{formatarMoeda(emprestimo.totalReceber)}</p>
          <p className="text-xs text-muted-foreground">{emprestimo.parcelasAbertas} parcelas pendentes</p>
        </div>
        <div className="p-6 rounded-lg bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20">
          <p className="text-sm text-muted-foreground mb-2">Juros por Atraso</p>
          <p className="text-4xl font-bold text-orange-400 mb-1">{isAtrasado ? formatarMoeda(jurosAtraso) : 'R$ 0,00'}</p>
          <p className="text-xs text-muted-foreground">{isAtrasado ? `${diasAtraso} dias de atraso` : 'Em dia'}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-border">
        <div className="flex gap-2">
          {(['etiqueta', 'detalhes', 'comprovante', 'historico'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setAba(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                aba === tab ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {tab === 'etiqueta' ? '🏷️ Etiqueta' : tab === 'detalhes' ? '📋 Detalhes' : tab === 'comprovante' ? '📄 Comprovante' : '📜 Histórico'}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="space-y-4">
        {aba === 'etiqueta' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Emprestado</p>
                <p className="text-xl font-bold text-foreground">{formatarMoeda(emprestimo.valorPrincipal)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Lucro Previsto</p>
                <p className="text-xl font-bold text-green-400">{formatarMoeda(emprestimo.lucroPrevisto)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Lucro Realizado</p>
                <p className="text-xl font-bold text-green-500">{formatarMoeda(emprestimo.lucroRealizado)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">{t('common.dueDate')}</p>
                <p className="text-xl font-bold text-foreground">{formatarData(emprestimo.dataVencimento)}</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-semibold text-foreground mb-2">Só Juros (por parcela)</p>
              <p className="text-3xl font-bold text-amber-400">{formatarMoeda(emprestimo.valorJurosParcela)}</p>
            </div>
            {emprestimo.parcelasComAtraso?.length > 0 && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <p className="font-semibold text-red-500">Parcela em Atraso</p>
                </div>
                {emprestimo.parcelasComAtraso.map((p: any) => (
                  <div key={p.id} className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parcela #{p.numero_parcela}</span>
                      <span className="font-semibold text-red-400">{p.diasAtraso} dias</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('common.dueDate')}</span>
                      <span>{formatarData(p.data_vencimento)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor Original</span>
                      <span>{formatarMoeda(p.valor_original)}</span>
                    </div>
                    <div className="border-t border-red-500/20 pt-2 flex justify-between font-bold">
                      <span>Total com Atraso:</span>
                      <span className="text-red-400">{formatarMoeda(p.totalComAtraso)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === 'detalhes' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Total a Receber', value: formatarMoeda(emprestimo.totalReceber) },
                { label: 'Total Pago', value: formatarMoeda(emprestimo.totalPago), cls: 'text-green-500' },
                { label: 'Parcelas Pagas', value: `${emprestimo.parcelasPagas}/${emprestimo.numeroParcelas}` },
                { label: 'Taxa de Juros', value: `${emprestimo.taxaJuros}% ${emprestimo.tipoTaxa}` },
                { label: 'Parcelas Abertas', value: String(emprestimo.parcelasAbertas) },
                { label: 'Data de Criação', value: formatarData(emprestimo.dataCriacao) },
              ].map(({ label, value, cls }) => (
                <div key={label} className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-lg font-bold ${cls ?? 'text-foreground'}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Todas as Parcelas</p>
                <div className="flex gap-1">
                  {(['todas', 'pendente', 'paga', 'atrasada'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFiltroStatus(f)}
                      className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                        filtroStatus === f
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
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
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Valor</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Status</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Editar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emprestimo.todasParcelas
                      ?.filter((p: any) => filtroStatus === 'todas' || p.status === filtroStatus)
                      .map((p: any) => (
                        parcelaEditando?.id === p.id ? (
                          <tr key={p.id} className="border-b border-border/50 bg-muted/20">
                            <td className="px-3 py-2 text-foreground">#{p.numero_parcela}</td>
                            <td className="px-2 py-1">
                              <Input
                                type="date"
                                value={parcelaEditando!.data}
                                onChange={e => setParcelaEditando(prev => prev ? { ...prev, data: e.target.value } : null)}
                                className="h-7 text-xs w-36"
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                              />
                            </td>
                            <td className="px-2 py-1 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={parcelaEditando!.valor}
                                onChange={e => setParcelaEditando(prev => prev ? { ...prev, valor: e.target.value } : null)}
                                className="h-7 text-xs w-28 text-right"
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={p.status === 'paga' ? 'default' : p.status === 'atrasada' ? 'destructive' : 'secondary'}>
                                {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}
                              </Badge>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => editarParcelaMutation.mutate({
                                    parcelaId: p.id,
                                    novoValor: parcelaEditando ? (parseFloat(parcelaEditando.valor) || undefined) : undefined,
                                    novaDataVencimento: parcelaEditando ? (parcelaEditando.data || undefined) : undefined,
                                  })}
                                  disabled={editarParcelaMutation.isPending}
                                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                                  title="Salvar"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setParcelaEditando(null)}
                                  className="p-1 rounded bg-muted hover:bg-muted/80 text-foreground"
                                  title="Cancelar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="px-3 py-2 text-foreground">#{p.numero_parcela}</td>
                            <td className="px-3 py-2 text-foreground">{formatarData(p.data_vencimento)}</td>
                            <td className="px-3 py-2 text-right text-foreground">{formatarMoeda(p.valor_original)}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={p.status === 'paga' ? 'default' : p.status === 'atrasada' ? 'destructive' : 'secondary'}>
                                {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {p.status !== 'paga' && (
                                <button
                                  onClick={() => setParcelaEditando({
                                    id: p.id,
                                    valor: String(parseFloat(p.valor_original).toFixed(2)),
                                    data: p.data_vencimento?.split('T')[0] ?? '',
                                  })}
                                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                  title="Editar parcela"
                                >
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
              {/* Botão e formulário para adicionar nova parcela */}
              {!isQuitado && (
                <div className="mt-3">
                  {!showNovaParcela ? (
                    <button
                      onClick={() => setShowNovaParcela(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                    >
                      <span className="text-base leading-none">⊕</span>
                      Adicionar Nova Parcela
                    </button>
                  ) : (
                    <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                      <p className="text-sm font-semibold text-foreground">Nova Parcela</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Data de Vencimento *</Label>
                          <Input
                            type="date"
                            value={novaParcelaData}
                            onChange={e => setNovaParcelaData(e.target.value)}
                            className="mt-1 h-8 text-sm [color-scheme:dark]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Valor (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={`Padrão: ${formatarMoeda(emprestimo.valorPrincipal)}`}
                            value={novaParcelaValor}
                            onChange={e => setNovaParcelaValor(e.target.value)}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCriarParcela}
                          disabled={criarParcelaMutation.isPending || !novaParcelaData}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                        >
                          {criarParcelaMutation.isPending ? 'Criando...' : 'Salvar Parcela'}
                        </button>
                        <button
                          onClick={() => { setShowNovaParcela(false); setNovaParcelaData(''); setNovaParcelaValor(''); }}
                          className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {aba === 'historico' && (
          <HistoricoAba contratoId={emprestimoId} />
        )}
        {aba === 'comprovante' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Gera o comprovante de pagamento com os dados da empresa configurados em Configurações.</p>
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

      {/* Botões de Ação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-6 border-t border-border">
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" onClick={() => { setValorCustomPagar(''); setContaCaixaId(''); setPagamentoRealizado(null); setModalPagar(true); }} disabled={isQuitado}>
          <DollarSign className="h-4 w-4" /> Pagar
        </Button>
        <Button className="gap-2" variant="outline" size="sm" onClick={() => { setValorCustomJuros(''); setContaCaixaId(''); setModalPagarJuros(true); }} disabled={isQuitado}>
          <TrendingUp className="h-4 w-4" /> Pagar Juros
        </Button>
        <Button className="gap-2" variant="outline" size="sm" onClick={() => { setNovaTaxa(String(emprestimo.taxaJuros)); setModalEditarJuros(true); }}>
          <Edit2 className="h-4 w-4" /> Editar Juros
        </Button>
        <Button className="gap-2" variant="outline" size="sm" onClick={() => { setValorMulta(''); setModalMulta(true); }} disabled={isQuitado}>
          <AlertTriangle className="h-4 w-4" /> Aplicar Multa
        </Button>
        {emprestimo.clienteWhatsapp && (
          <Button className="gap-2" variant="outline" size="sm" onClick={() => handleWhatsApp(isAtrasado ? 'atraso' : 'preventivo')} disabled={loadingWpp}>
            {loadingWpp ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Cobrar (WhatsApp)
          </Button>
        )}
        <Button className="gap-2" variant="outline" size="sm" onClick={() => handleWhatsApp(isAtrasado ? 'atraso' : 'preventivo')} disabled={loadingWpp || !emprestimo.clienteWhatsapp}>
          {loadingWpp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Cobrança
        </Button>
        <Button className="gap-2" variant="outline" size="sm" onClick={handleGerarComprovante} disabled={gerandoPDF}>
          <FileText className="h-4 w-4" />
          {gerandoPDF ? 'Gerando...' : 'Comprovante'}
        </Button>
        <Button className="gap-2" variant="destructive" size="sm" onClick={() => setModalDeletar(true)}>
          <Trash2 className="h-4 w-4" /> Deletar
        </Button>
      </div>

      {/* ── MODAL PAGAR ── */}
      <Dialog open={modalPagar} onOpenChange={(v) => { setModalPagar(v); if (!v) setPagamentoRealizado(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>REGISTRAR PAGAMENTO</DialogTitle>
            <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
          </DialogHeader>
          {pagamentoRealizado ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-500">Pagamento Registrado!</div>
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
                    valorOriginal: valorOriginalParcela,
                    juros: valorJurosParcela,
                    valorPago: pagamentoRealizado.valorPago,
                    dataPagamento: new Date().toISOString(),
                    modalidade: emprestimo.modalidade,
                  });
                }}>
                  <Download className="h-3.5 w-3.5" /> Comprovante PDF
                </Button>
                <Button className="flex-1" onClick={() => { setPagamentoRealizado(null); setModalPagar(false); }}>{t('common.close')}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo Capital / Juros / Total */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>{t('common.capital')}</span>
                  <span>{formatarMoeda(emprestimo.valorPrincipal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{t('common.interest')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">{formatarMoeda(jurosCustomDetalhes ? parseFloat(jurosCustomDetalhes) : valorJurosParcela)}</span>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground underline hover:text-foreground"
                      onClick={() => setJurosCustomDetalhes(jurosCustomDetalhes ? '' : valorJurosParcela.toFixed(2))}
                    >
                      {jurosCustomDetalhes ? 'usar padrão' : 'editar'}
                    </button>
                  </div>
                </div>
                {jurosCustomDetalhes !== '' && (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Valor dos juros (R$)"
                    value={jurosCustomDetalhes}
                    onChange={e => setJurosCustomDetalhes(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
                {isAtrasado && (
                  <div className="flex justify-between text-red-400 border-t border-border pt-2">
                    <span>Total com Atraso ({diasAtraso} dias)</span>
                    <span className="font-semibold">{formatarMoeda(totalComAtraso)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>{t('common.total')}</span>
                  <span className="text-emerald-400">{formatarMoeda(valorCustomPagar ? parseFloat(valorCustomPagar) : (isAtrasado ? totalComAtraso : valorOriginalParcela))}</span>
                </div>
              </div>
              {/* Valor personalizado */}
              <div>
                <Label className="text-xs">Valor a Pagar (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Padrão: ${formatarMoeda(isAtrasado ? totalComAtraso : valorOriginalParcela)}`}
                  value={valorCustomPagar}
                  onChange={e => setValorCustomPagar(e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              {/* Data de pagamento manual */}
              <div>
                <Label className="text-xs">Data do Pagamento</Label>
                <Input
                  type="date"
                  value={dataPagamentoCustom}
                  onChange={e => setDataPagamentoCustom(e.target.value)}
                  className="mt-1 h-9 text-sm [color-scheme:dark]"
                  placeholder="Hoje (padrão)"
                />
                {!dataPagamentoCustom && (
                  <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para usar a data de hoje</p>
                )}
              </div>
              {/* Conta de Caixa */}
              <div>
                <Label className="text-xs">Conta de Caixa</Label>
                <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {(contas ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setModalPagar(false)}>{t('common.cancel')}</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={!contaCaixaId || pagarTotalMutation.isPending} onClick={handlePagar}>
                  {pagarTotalMutation.isPending ? 'Processando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL PAGAR JUROS ── */}
      <Dialog open={modalPagarJuros} onOpenChange={(v) => { setModalPagarJuros(v); if (!v) { setValorCustomJuros(''); setContaCaixaId(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PAGAR SÓ JUROS</DialogTitle>
            <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <p className="text-amber-400 font-semibold">Juros por parcela: {formatarMoeda(valorJurosParcela)}</p>
              <p className="text-xs text-muted-foreground mt-1">Pagando apenas os juros, o contrato é renovado sem abater o principal.</p>
            </div>
            <div>
              <Label className="text-xs">Valor dos Juros (deixe em branco para usar o valor padrão)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={String(valorJurosParcela.toFixed(2))}
                value={valorCustomJuros}
                onChange={e => setValorCustomJuros(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Conta de Caixa</Label>
              <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {(contas ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalPagarJuros(false)}>{t('common.cancel')}</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700" disabled={!contaCaixaId || pagarJurosMutation.isPending} onClick={handlePagarJuros}>
                {pagarJurosMutation.isPending ? 'Processando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL EDITAR JUROS ── */}
      <Dialog open={modalEditarJuros} onOpenChange={(v) => { setModalEditarJuros(v); if (!v) setNovaTaxa(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>EDITAR TAXA DE JUROS</DialogTitle>
            <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
              <p className="text-muted-foreground">Taxa atual: <span className="font-bold text-foreground">{emprestimo.taxaJuros}% {emprestimo.tipoTaxa}</span></p>
            </div>
            <div>
              <Label>Nova Taxa de Juros (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 5"
                value={novaTaxa}
                onChange={e => setNovaTaxa(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalEditarJuros(false)}>{t('common.cancel')}</Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!novaTaxa.trim() || editarJurosMutation.isPending}
                onClick={() => editarJurosMutation.mutate({ id: emprestimo.id, novaTaxa })}
              >
                {editarJurosMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL APLICAR MULTA ── */}
      <Dialog open={modalMulta} onOpenChange={(v) => { setModalMulta(v); if (!v) setValorMulta(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>APLICAR MULTA POR ATRASO</DialogTitle>
            <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isAtrasado && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
                <p className="text-red-400 font-semibold">{diasAtraso} dias de atraso</p>
                <p className="text-xs text-muted-foreground mt-1">A multa será adicionada ao valor das parcelas em atraso.</p>
              </div>
            )}
            <div>
              <Label>Valor da Multa (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 50.00"
                value={valorMulta}
                onChange={e => setValorMulta(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalMulta(false)}>{t('common.cancel')}</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={!valorMulta.trim() || aplicarMultaMutation.isPending}
                onClick={() => aplicarMultaMutation.mutate({ id: emprestimo.id, multa: valorMulta })}
              >
                {aplicarMultaMutation.isPending ? 'Aplicando...' : 'Aplicar Multa'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DELETAR ── */}
      <DeleteEmprestimoDialog
        emprestimoId={emprestimo.id}
        clienteNome={emprestimo.clienteNome}
        open={modalDeletar}
        onOpenChange={setModalDeletar}
        onSuccess={() => setLocation('/emprestimos')}
      />
    </div>
  );
}

function HistoricoAba({ contratoId }: { contratoId: number }) {
  const { t } = useTranslation();
  const { data: historico, isLoading } = trpc.contratos.historico.useQuery(
    { contratoId },
    { enabled: contratoId > 0 }
  );

  const tipoLabel: Record<string, string> = {
    pagamento: 'Pagamento',
    pagamento_juros: 'Pagamento de Juros',
    edicao_juros: 'Edição de Juros',
    aplicacao_multa: 'Multa Aplicada',
    edicao_parcela: 'Edição de Parcela',
    edicao_contrato: 'Edição de Contrato',
    reparcelamento: 'Reparcelamento',
    criacao: 'Criação',
  };

  const tipoColor: Record<string, string> = {
    pagamento: 'text-emerald-400',
    pagamento_juros: 'text-amber-400',
    edicao_juros: 'text-blue-400',
    aplicacao_multa: 'text-red-400',
    edicao_parcela: 'text-purple-400',
    edicao_contrato: 'text-cyan-400',
    reparcelamento: 'text-orange-400',
    criacao: 'text-green-400',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!historico || historico.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm">{t('emprestimos.noHistory')}</p>
        <p className="text-muted-foreground/60 text-xs mt-1">As ações futuras (pagamentos, multas, edições) aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground mb-3">Histórico de Alterações ({historico.length})</p>
      <div className="space-y-2">
        {historico.map((h) => (
          <div key={h.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
            <div className="mt-0.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${tipoColor[h.tipo] ?? 'text-foreground'}`}>
                  {tipoLabel[h.tipo] ?? h.tipo}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(h.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-foreground mt-0.5">{h.descricao}</p>
              {(h.valorAnterior || h.valorNovo) && (
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {h.valorAnterior && <span>Antes: <span className="text-foreground">{h.valorAnterior}</span></span>}
                  {h.valorNovo && <span>Depois: <span className="text-foreground">{h.valorNovo}</span></span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
