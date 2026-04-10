'use client';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageCircle, Edit2, AlertTriangle, DollarSign, TrendingUp,
  Share2, Trash2, FileText, Copy, Send
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";

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

  if (!emprestimo) return null;

  const diasAtraso = emprestimo.parcelasComAtraso?.[0]?.diasAtraso ?? 0;
  const totalComAtraso = emprestimo.parcelasComAtraso?.[0]?.totalComAtraso ?? 0;
  const jurosAtraso = emprestimo.parcelasComAtraso?.[0]?.jurosAtraso ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header com nome do cliente e status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{emprestimo.clienteNome}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{emprestimo.modalidade}</p>
            </div>
            <Badge variant={emprestimo.status === 'ativo' ? 'default' : 'secondary'}>
              {emprestimo.status === 'ativo' ? 'Ativo' : 'Quitado'}
            </Badge>
          </div>

          {/* KPI Principal */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20">
            <div>
              <p className="text-sm text-muted-foreground">Restante a Receber</p>
              <p className="text-2xl font-bold text-red-400">{formatarMoeda(emprestimo.totalReceber)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {emprestimo.parcelasAbertas} parcelas pendentes
              </p>
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
            <button
              onClick={() => setAba('etiqueta')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                aba === 'etiqueta'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🏷️ Etiqueta
            </button>
            <button
              onClick={() => setAba('detalhes')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                aba === 'detalhes'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              📋 Detalhes
            </button>
            <button
              onClick={() => setAba('comprovante')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                aba === 'comprovante'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              📄 Comprovante
            </button>
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

              {/* Parcelas com Atraso */}
              {emprestimo.parcelasComAtraso?.length > 0 && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <p className="font-semibold text-red-500">Parcela em Atraso</p>
                  </div>
                  {emprestimo.parcelasComAtraso.map((parcela: any) => (
                    <div key={parcela.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Parcela #{parcela.numero_parcela}</span>
                        <span className="font-semibold text-red-400">{parcela.diasAtraso} dias</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Vencimento</span>
                        <span>{formatarData(parcela.data_vencimento)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor Original</span>
                        <span>{formatarMoeda(parcela.valor_original)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Juros (R$ {(parseFloat(String(parcela.valor_original)) * 0.1).toFixed(2)}/dia)</span>
                        <span className="text-orange-400 font-semibold">+{formatarMoeda(parcela.jurosAtraso)}</span>
                      </div>
                      <div className="border-t border-red-500/20 pt-2 flex justify-between text-sm font-bold">
                        <span>Total com Atraso:</span>
                        <span className="text-red-400">{formatarMoeda(parcela.totalComAtraso)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Só Juros */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-semibold text-foreground mb-2">Só Juros (por parcela)</p>
                <p className="text-2xl font-bold text-foreground">{formatarMoeda(emprestimo.valorJurosParcela)}</p>
              </div>
            </div>
          )}

          {aba === 'detalhes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total a Receber</p>
                  <p className="text-lg font-bold text-foreground">{formatarMoeda(emprestimo.totalReceber)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Pago</p>
                  <p className="text-lg font-bold text-green-500">{formatarMoeda(emprestimo.totalPago)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Parcelas Pagas</p>
                  <p className="text-lg font-bold text-foreground">{emprestimo.parcelasPagas}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Parcelas Abertas</p>
                  <p className="text-lg font-bold text-foreground">{emprestimo.parcelasAbertas}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxa de Juros</p>
                  <p className="text-lg font-bold text-foreground">{emprestimo.taxaJuros}% {emprestimo.tipoTaxa}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Número de Parcelas</p>
                  <p className="text-lg font-bold text-foreground">{emprestimo.numeroParcelas}</p>
                </div>
              </div>

              {/* Todas as parcelas */}
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
              <p className="text-sm text-muted-foreground">Comprovante do empréstimo</p>
              <Button className="w-full gap-2" variant="outline">
                <FileText className="h-4 w-4" />
                Gerar Comprovante em PDF
              </Button>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border">
            <Button className="gap-2" variant="default" size="sm">
              <DollarSign className="h-4 w-4" />
              Pagar
            </Button>
            <Button className="gap-2" variant="outline" size="sm">
              <TrendingUp className="h-4 w-4" />
              Pagar Juros
            </Button>
            <Button className="gap-2" variant="outline" size="sm">
              <Edit2 className="h-4 w-4" />
              Editar Juros
            </Button>
            <Button className="gap-2" variant="outline" size="sm">
              <AlertTriangle className="h-4 w-4" />
              Aplicar Multa
            </Button>
            {emprestimo.clienteWhatsapp && (
              <Button className="gap-2" variant="outline" size="sm">
                <MessageCircle className="h-4 w-4" />
                Cobrar (WhatsApp)
              </Button>
            )}
            <Button className="gap-2" variant="outline" size="sm">
              <Send className="h-4 w-4" />
              Enviar Cobrança
            </Button>
            <Button className="gap-2 col-span-2" variant="destructive" size="sm">
              <Trash2 className="h-4 w-4" />
              Deletar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
