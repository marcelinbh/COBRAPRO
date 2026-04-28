'use client';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageCircle, Edit2, AlertTriangle, DollarSign, TrendingUp,
  Trash2, FileText, Send, CheckCircle, Download, Loader2
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";
import { trpc } from '@/lib/trpc';
import { gerarComprovantePDF } from '@/lib/gerarComprovante';
import { DeleteEmprestimoDialog } from './DeleteEmprestimoDialog';

interface EmprestimoDetalhesModalProps {
  emprestimo: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contas: { id: number; nome: string; saldoAtual: number }[];
  onRefresh: () => void;
}

export function EmprestimoDetalhesModal({
  emprestimo,
  open,
  onOpenChange,
  contas,
  onRefresh,
}: EmprestimoDetalhesModalProps) {
  const [aba, setAba] = useState<'etiqueta' | 'detalhes' | 'comprovante'>('etiqueta');
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [loadingWpp, setLoadingWpp] = useState(false);

  // Estado dos sub-modais
  const [modalPagar, setModalPagar] = useState(false);
  const [modalPagarJuros, setModalPagarJuros] = useState(false);
  const [modalEditarJuros, setModalEditarJuros] = useState(false);
  const [modalMulta, setModalMulta] = useState(false);
  const [modalDeletar, setModalDeletar] = useState(false);

  // Campos
  const [contaCaixaId, setContaCaixaId] = useState('');
  const [valorCustomPagar, setValorCustomPagar] = useState('');
  const [valorCustomJuros, setValorCustomJuros] = useState('');
  const [novaTaxa, setNovaTaxa] = useState('');
  const [valorMulta, setValorMulta] = useState('');
  const [pagamentoRealizado, setPagamentoRealizado] = useState<{ valorPago: number; parcelaNum: number } | null>(null);

  const { data: config } = trpc.configuracoes.get.useQuery();
  const utils = trpc.useUtils();

  const pagarTotalMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: (_data, variables) => {
      const parcelaNum = emprestimo?.todasParcelas?.find((p: any) => p.id === variables.parcelaId)?.numero_parcela ?? 1;
      setPagamentoRealizado({ valorPago: variables.valorPago, parcelaNum });
      toast.success('Pagamento registrado!');
      setTimeout(() => {
        onRefresh();
        utils.contratos.listComParcelas.invalidate();
        utils.dashboard.kpis.invalidate();
      }, 300);
    },
    onError: (e) => toast.error('Erro ao registrar pagamento: ' + e.message),
  });

  const pagarJurosMutation = trpc.parcelas.pagarJuros.useMutation({
    onSuccess: () => {
      toast.success('Juros pagos! Empréstimo renovado.');
      setModalPagarJuros(false);
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error('Erro ao pagar juros: ' + e.message),
  });

  const editarJurosMutation = trpc.contratos.editarJuros.useMutation({
    onSuccess: () => {
      toast.success('Taxa de juros atualizada!');
      setModalEditarJuros(false);
      setNovaTaxa('');
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const aplicarMultaMutation = trpc.contratos.aplicarMulta.useMutation({
    onSuccess: () => {
      toast.success('Multa aplicada com sucesso!');
      setModalMulta(false);
      setValorMulta('');
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  if (!emprestimo) return null;

  const diasAtraso = emprestimo.parcelasComAtraso?.[0]?.diasAtraso ?? 0;
  const totalComAtraso = emprestimo.parcelasComAtraso?.[0]?.totalComAtraso ?? 0;
  const jurosAtraso = emprestimo.parcelasComAtraso?.[0]?.jurosAtraso ?? 0;
  const isAtrasado = diasAtraso > 0;
  const isQuitado = emprestimo.status === 'quitado';
  const parcela = emprestimo.todasParcelas?.find((p: any) => p.status !== 'paga') ?? emprestimo.todasParcelas?.[0];
  const valorOriginalParcela = parcela ? parseFloat(String(parcela.valor_original ?? '0')) : 0;
  const valorJurosParcela = emprestimo.valorJurosParcela ?? 0;

  const handlePagar = () => {
    if (!contaCaixaId) { toast.error('Selecione uma conta'); return; }
    if (!parcela) { toast.error('Nenhuma parcela pendente'); return; }
    const valor = valorCustomPagar ? parseFloat(valorCustomPagar) : (isAtrasado ? totalComAtraso : valorOriginalParcela);
    pagarTotalMutation.mutate({
      parcelaId: parcela.id,
      valorPago: valor,
      contaCaixaId: parseInt(contaCaixaId),
    });
  };

  const handlePagarJuros = () => {
    if (!contaCaixaId) { toast.error('Selecione uma conta'); return; }
    if (!parcela) { toast.error('Nenhuma parcela pendente'); return; }
    const valor = valorCustomJuros ? parseFloat(valorCustomJuros) : valorJurosParcela;
    pagarJurosMutation.mutate({
      parcelaId: parcela.id,
      valorJurosPago: valor,
      contaCaixaId: parseInt(contaCaixaId),
    });
  };

  const handleWhatsApp = async (tipo: 'atraso' | 'preventivo' = 'atraso') => {
    if (!emprestimo.clienteWhatsapp) { toast.error('Telefone WhatsApp não cadastrado'); return; }
    setLoadingWpp(true);
    try {
      const result = await utils.client.whatsapp.gerarMensagemContrato.query({
        contratoId: emprestimo.id,
        tipo,
      });
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, '_blank');
      } else {
        toast.error('Não foi possível gerar o link do WhatsApp');
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
      const parcelaPaga = emprestimo.todasParcelas?.find((p: any) => p.status === 'paga') ||
        emprestimo.todasParcelas?.[0];
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
      toast.success('Comprovante gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar comprovante');
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">{emprestimo.clienteNome}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{emprestimo.modalidade}</p>
              </div>
              <Badge variant={isQuitado ? 'secondary' : isAtrasado ? 'destructive' : 'default'}>
                {isQuitado ? 'Quitado' : isAtrasado ? 'Atrasado' : 'Ativo'}
              </Badge>
            </div>

            {/* KPI Principal */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20">
              <div>
                <p className="text-sm text-muted-foreground">Restante a Receber</p>
                <p className="text-2xl font-bold text-red-400">{formatarMoeda(emprestimo.totalReceber)}</p>
                <p className="text-xs text-muted-foreground mt-1">{emprestimo.parcelasAbertas} parcelas pendentes</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Juros por Atraso</p>
                <p className="text-2xl font-bold text-orange-400">
                  {diasAtraso > 0 ? formatarMoeda(jurosAtraso) : 'R$ 0,00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {diasAtraso > 0 ? `${diasAtraso} dias de atraso` : 'Em dia'}
                </p>
              </div>
            </div>

            {/* Abas */}
            <div className="flex gap-2 border-b border-border">
              {(['etiqueta', 'detalhes', 'comprovante'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAba(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    aba === tab ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'etiqueta' ? '🏷️ Etiqueta' : tab === 'detalhes' ? '📋 Detalhes' : '📄 Comprovante'}
                </button>
              ))}
            </div>

            {/* Conteúdo das Abas */}
            {aba === 'etiqueta' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Emprestado</p>
                    <p className="text-lg font-bold text-foreground">{formatarMoeda(emprestimo.valorPrincipal)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Lucro Previsto</p>
                    <p className="text-lg font-bold text-green-400">{formatarMoeda(emprestimo.lucroPrevisto)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Lucro Realizado</p>
                    <p className="text-lg font-bold text-green-500">{formatarMoeda(emprestimo.lucroRealizado)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="text-lg font-bold text-foreground">{formatarData(emprestimo.dataInicio)}</p>
                  </div>
                </div>
                {emprestimo.parcelasComAtraso?.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <p className="font-semibold text-red-500">Parcela em Atraso</p>
                    </div>
                    {emprestimo.parcelasComAtraso.map((p: any) => (
                      <div key={p.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Parcela #{p.numero_parcela}</span>
                          <span className="font-semibold text-red-400">{p.diasAtraso} dias</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total com Atraso:</span>
                          <span className="text-red-400 font-bold">{formatarMoeda(p.totalComAtraso)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm font-semibold text-foreground mb-2">Só Juros (por parcela)</p>
                  <p className="text-2xl font-bold text-foreground">{formatarMoeda(valorJurosParcela)}</p>
                </div>
              </div>
            )}

            {aba === 'detalhes' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Total a Receber</p><p className="text-lg font-bold">{formatarMoeda(emprestimo.totalReceber)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total Pago</p><p className="text-lg font-bold text-green-500">{formatarMoeda(emprestimo.totalPago)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Parcelas Pagas</p><p className="text-lg font-bold">{emprestimo.parcelasPagas}</p></div>
                  <div><p className="text-xs text-muted-foreground">Parcelas Abertas</p><p className="text-lg font-bold">{emprestimo.parcelasAbertas}</p></div>
                  <div><p className="text-xs text-muted-foreground">Taxa de Juros</p><p className="text-lg font-bold">{emprestimo.taxaJuros}% {emprestimo.tipoTaxa}</p></div>
                  <div><p className="text-xs text-muted-foreground">Nº de Parcelas</p><p className="text-lg font-bold">{emprestimo.numeroParcelas}</p></div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Todas as Parcelas</p>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {emprestimo.todasParcelas?.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-xs p-2 rounded bg-muted/50">
                        <span>#{p.numero_parcela}</span>
                        <span className="text-muted-foreground">{formatarData(p.data_vencimento)}</span>
                        <span>{formatarMoeda(p.valor_original)}</span>
                        <Badge variant={p.status === 'paga' ? 'default' : p.status === 'atrasada' ? 'destructive' : 'secondary'}>
                          {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {aba === 'comprovante' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Gera o comprovante de pagamento com os dados da empresa configurados em Configurações.</p>
                {config?.nomeEmpresa && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
                    <p className="font-medium text-foreground">{config.nomeEmpresa}</p>
                    {config.enderecoEmpresa && <p className="text-muted-foreground text-xs mt-1">{config.enderecoEmpresa}</p>}
                  </div>
                )}
                <Button className="w-full gap-2" variant="outline" onClick={handleGerarComprovante} disabled={gerandoPDF}>
                  <FileText className="h-4 w-4" />
                  {gerandoPDF ? 'Gerando PDF...' : 'Gerar Comprovante em PDF'}
                </Button>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border">
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" onClick={() => { setValorCustomPagar(''); setModalPagar(true); }} disabled={isQuitado}>
                <DollarSign className="h-4 w-4" /> Pagar
              </Button>
              <Button className="gap-2" variant="outline" size="sm" onClick={() => { setValorCustomJuros(''); setModalPagarJuros(true); }} disabled={isQuitado}>
                <TrendingUp className="h-4 w-4" /> Pagar Juros
              </Button>
              <Button className="gap-2" variant="outline" size="sm" onClick={() => { setNovaTaxa(emprestimo.taxaJuros); setModalEditarJuros(true); }}>
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
              <Button className="gap-2 col-span-2" variant="destructive" size="sm" onClick={() => setModalDeletar(true)}>
                <Trash2 className="h-4 w-4" /> Deletar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SUB-MODAL PAGAR ── */}
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
                <Button className="flex-1" onClick={() => { setPagamentoRealizado(null); setModalPagar(false); }}>Fechar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Valor da Parcela</span>
                  <span className="font-semibold">{formatarMoeda(valorOriginalParcela)}</span>
                </div>
                {isAtrasado && (
                  <div className="flex justify-between text-red-400">
                    <span>Total com Atraso ({diasAtraso} dias)</span>
                    <span className="font-semibold">{formatarMoeda(totalComAtraso)}</span>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Valor a Pagar (deixe em branco para usar o valor padrão)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={isAtrasado ? String(totalComAtraso.toFixed(2)) : String(valorOriginalParcela.toFixed(2))}
                  value={valorCustomPagar}
                  onChange={e => setValorCustomPagar(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Conta de Caixa</Label>
                <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setModalPagar(false)}>Cancelar</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={!contaCaixaId || pagarTotalMutation.isPending} onClick={handlePagar}>
                  {pagarTotalMutation.isPending ? 'Processando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── SUB-MODAL PAGAR JUROS ── */}
      <Dialog open={modalPagarJuros} onOpenChange={setModalPagarJuros}>
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
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalPagarJuros(false)}>Cancelar</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700" disabled={!contaCaixaId || pagarJurosMutation.isPending} onClick={handlePagarJuros}>
                {pagarJurosMutation.isPending ? 'Processando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SUB-MODAL EDITAR JUROS ── */}
      <Dialog open={modalEditarJuros} onOpenChange={setModalEditarJuros}>
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
              <Button variant="outline" className="flex-1" onClick={() => setModalEditarJuros(false)}>Cancelar</Button>
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

      {/* ── SUB-MODAL APLICAR MULTA ── */}
      <Dialog open={modalMulta} onOpenChange={setModalMulta}>
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
              <Button variant="outline" className="flex-1" onClick={() => setModalMulta(false)}>Cancelar</Button>
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

      {/* ── SUB-MODAL DELETAR ── */}
      <DeleteEmprestimoDialog
        emprestimoId={emprestimo.id}
        clienteNome={emprestimo.clienteNome}
        open={modalDeletar}
        onOpenChange={setModalDeletar}
        onSuccess={() => { onOpenChange(false); onRefresh(); }}
      />
    </>
  );
}
