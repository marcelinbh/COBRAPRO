'use client';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, AlertTriangle
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";
import { trpc } from '@/lib/trpc';
import { gerarComprovantePDF } from '@/lib/gerarComprovante';
import { useLocation } from 'wouter';
import { rotaReparcelamentoAtual } from '@/lib/legacyFinanceNavigation';

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
  const [, navigate] = useLocation();
  const [aba, setAba] = useState<'etiqueta' | 'detalhes' | 'comprovante'>('etiqueta');
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [loadingWpp, setLoadingWpp] = useState(false);

  const { data: config } = trpc.configuracoes.get.useQuery();
  const utils = trpc.useUtils();
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'paga' | 'atrasada'>('todas');

  if (!emprestimo) return null;

  const diasAtraso = emprestimo.parcelasComAtraso?.[0]?.diasAtraso ?? 0;
  const totalComAtraso = emprestimo.parcelasComAtraso?.[0]?.totalComAtraso ?? 0;
  const jurosAtraso = emprestimo.parcelasComAtraso?.[0]?.jurosAtraso ?? 0;
  const isAtrasado = diasAtraso > 0;
  const isQuitado = emprestimo.status === 'quitado';
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
                  <p className="text-2xl font-bold text-foreground">{formatarMoeda(emprestimo.valorJurosParcela ?? 0)}</p>
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
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Todas as Parcelas</p>
                    <div className="flex gap-1">
                      {(['todas', 'pendente', 'paga', 'atrasada'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setFiltroStatus(f)}
                          className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${
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
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {emprestimo.todasParcelas
                      ?.filter((p: any) => filtroStatus === 'todas' || p.status === filtroStatus)
                      .map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center text-xs p-2 rounded bg-muted/50 hover:bg-muted/70">
                            <span>#{p.numero_parcela}</span>
                            <span className="text-muted-foreground">{formatarData(p.data_vencimento)}</span>
                            <span>{formatarMoeda(p.valor_original)}</span>
                            <Badge variant={p.status === 'paga' ? 'default' : p.status === 'atrasada' ? 'destructive' : 'secondary'}>
                              {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/emprestimos/${emprestimo.id}`); }}>
                              Abrir ficha segura
                            </Button>
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

            {/* 43/44: a ficha identifica a origem; não montar writers/editor legados aqui. */}
            <div className="pt-4 border-t border-border">
              <Button variant="outline" onClick={() => { onOpenChange(false); navigate(`/emprestimos/${emprestimo.id}`); }}>
                Abrir ficha segura: recebimento / calendário
              </Button>
              <Button variant="outline" onClick={() => { onOpenChange(false); navigate(rotaReparcelamentoAtual(emprestimo.id)); }}>Simular reparcelamento mensal</Button>
              <p className="text-xs text-muted-foreground">Na ficha, escolha recebimento, renovação por juros, multa fixa, juros/valores futuros ou vencimentos. Cada operação confere a origem e a sessão antes de confirmar.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
