'use client';
import { useState, useMemo } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageCircle, Edit2, AlertTriangle, DollarSign, TrendingUp,
  Share2, Trash2, FileText, Copy, Send, ArrowLeft, Download
} from 'lucide-react';
import { formatarMoeda, formatarData } from '../../../shared/finance';
import { trpc } from '@/lib/trpc';

export default function EmprestimoDetalhes() {
  const [, setLocation] = useLocation();
  const [aba, setAba] = useState<'etiqueta' | 'detalhes' | 'comprovante'>('etiqueta');
  const { id } = useParams<{ id: string }>();
  const emprestimoId = parseInt(id || '0');
  const [modalAcao, setModalAcao] = useState<'pagar' | 'juros' | 'editar' | 'multa' | null>(null);
  const [valor, setValor] = useState<string>('');

  const pagarTotalMutation = trpc.contratos.pagarTotal.useMutation();
  const editarJurosMutation = trpc.contratos.editarJuros.useMutation();
  const aplicarMultaMutation = trpc.contratos.aplicarMulta.useMutation();

  // Query para buscar empréstimo detalhado
  const { data: emprestimo, isLoading } = trpc.contratos.obterDetalhes.useQuery(
    { id: emprestimoId },
    { enabled: emprestimoId > 0 }
  );

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
  const totalComAtraso = emprestimo.parcelasComAtraso?.[0]?.totalComAtraso ?? 0;
  const jurosAtraso = emprestimo.parcelasComAtraso?.[0]?.jurosAtraso ?? 0;
  const isAtrasado = diasAtraso > 0;
  const isQuitado = emprestimo.status === 'quitado';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/emprestimos')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-3xl text-foreground tracking-wide">
              {emprestimo.clienteNome}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {emprestimo.modalidade}
            </p>
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
          <p className="text-4xl font-bold text-red-400 mb-1">
            {formatarMoeda(emprestimo.totalReceber)}
          </p>
          <p className="text-xs text-muted-foreground">
            {emprestimo.parcelasAbertas} parcelas pendentes
          </p>
        </div>

        <div className="p-6 rounded-lg bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20">
          <p className="text-sm text-muted-foreground mb-2">Juros por Atraso</p>
          <p className="text-4xl font-bold text-orange-400 mb-1">
            {isAtrasado ? formatarMoeda(jurosAtraso) : 'R$ 0,00'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAtrasado ? `${diasAtraso} dias de atraso` : 'Em dia'}
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-border">
        <div className="flex gap-2">
          <button
            onClick={() => setAba('etiqueta')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              aba === 'etiqueta'
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            🏷️ Etiqueta
          </button>
          <button
            onClick={() => setAba('detalhes')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              aba === 'detalhes'
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            📋 Detalhes
          </button>
          <button
            onClick={() => setAba('comprovante')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              aba === 'comprovante'
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            📄 Comprovante
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="space-y-4">
        {aba === 'etiqueta' && (
          <div className="space-y-4">
            {/* KPIs da Etiqueta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Emprestado</p>
                <p className="text-xl font-bold text-foreground">
                  {formatarMoeda(emprestimo.valorPrincipal)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Lucro Previsto</p>
                <p className="text-xl font-bold text-green-400">
                  {formatarMoeda(emprestimo.lucroPrevisto)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Lucro Realizado</p>
                <p className="text-xl font-bold text-green-500">
                  {formatarMoeda(emprestimo.lucroRealizado)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                <p className="text-xl font-bold text-foreground">
                  {formatarData(emprestimo.dataVencimento)}
                </p>
              </div>
            </div>

            {/* Só Juros */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-semibold text-foreground mb-2">Só Juros (por parcela)</p>
              <p className="text-3xl font-bold text-amber-400">
                {formatarMoeda(emprestimo.valorJurosParcela)}
              </p>
            </div>

            {/* Parcelas com Atraso */}
            {emprestimo.parcelasComAtraso?.length > 0 && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <p className="font-semibold text-red-500">Parcela em Atraso</p>
                </div>
                {emprestimo.parcelasComAtraso.map((parcela: any) => (
                  <div key={parcela.id} className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parcela #{parcela.numero_parcela}</span>
                      <span className="font-semibold text-red-400">{parcela.diasAtraso} dias</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vencimento</span>
                      <span>{formatarData(parcela.data_vencimento)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor Original</span>
                      <span>{formatarMoeda(parcela.valor_original)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Juros Diários</span>
                      <span className="text-orange-400">
                        R$ {(parseFloat(String(parcela.valor_original)) * 0.1).toFixed(2)}/dia
                      </span>
                    </div>
                    <div className="border-t border-red-500/20 pt-2 flex justify-between font-bold">
                      <span>Total com Atraso:</span>
                      <span className="text-red-400">{formatarMoeda(parcela.totalComAtraso)}</span>
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
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Total a Receber</p>
                <p className="text-lg font-bold text-foreground">
                  {formatarMoeda(emprestimo.totalReceber)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Total Pago</p>
                <p className="text-lg font-bold text-green-500">
                  {formatarMoeda(emprestimo.totalPago)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Parcelas Pagas</p>
                <p className="text-lg font-bold text-foreground">
                  {emprestimo.parcelasPagas}/{emprestimo.numeroParcelas}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Taxa de Juros</p>
                <p className="text-lg font-bold text-foreground">
                  {emprestimo.taxaJuros}% {emprestimo.tipoTaxa}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Parcelas Abertas</p>
                <p className="text-lg font-bold text-foreground">
                  {emprestimo.parcelasAbertas}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Data de Criação</p>
                <p className="text-lg font-bold text-foreground">
                  {formatarData(emprestimo.dataCriacao)}
                </p>
              </div>
            </div>

            {/* Todas as Parcelas */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Todas as Parcelas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Vencimento</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Valor</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emprestimo.todasParcelas?.map((p: any) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2 text-foreground">#{p.numero_parcela}</td>
                        <td className="px-3 py-2 text-foreground">{formatarData(p.data_vencimento)}</td>
                        <td className="px-3 py-2 text-right text-foreground">
                          {formatarMoeda(p.valor_original)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={
                            p.status === 'paga' ? 'default' :
                            p.status === 'atrasada' ? 'destructive' :
                            'secondary'
                          }>
                            {p.status === 'paga' ? 'Paga' :
                             p.status === 'atrasada' ? 'Atrasada' :
                             'Pendente'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {aba === 'comprovante' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Gerar e baixar comprovante do empréstimo</p>
            <Button className="gap-2" size="lg">
              <Download className="h-4 w-4" />
              Gerar Comprovante em PDF
            </Button>
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-6 border-t border-border">
        <Button className="gap-2" size="sm">
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
        <Button className="gap-2" variant="outline" size="sm">
          <FileText className="h-4 w-4" />
          Comprovante
        </Button>
        <Button className="gap-2 col-span-1 md:col-span-1" variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" />
          Deletar
        </Button>
      </div>
    </div>
  );
}
