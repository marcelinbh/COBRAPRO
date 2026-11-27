'use client';
import { arquivada51, contagensParcelas51, referenciaMonetaria51, statusContrato51, statusParcela51, REFERENCIA51 } from "@/lib/obrigacoes51Apresentacao";
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageCircle, AlertTriangle,
  Trash2, FileText, Send, ArrowLeft, Download, Loader2, History, Clock
} from 'lucide-react';
import { formatarMoeda, formatarData } from '../../../shared/finance';
import { trpc } from '@/lib/trpc';
import { badgeContrato, badgeParcela } from '@/lib/statusEmprestimoBadge';
import { DeleteEmprestimoDialog } from '@/components/DeleteEmprestimoDialog';
import { OperacoesObrigacao51 } from '@/components/OperacoesObrigacao51';
import { ManutencaoSucessor53 } from '@/components/ManutencaoSucessor53';
import { RecebimentoValidado } from '@/components/RecebimentoValidado';
import { ManutencaoJuros48 } from '@/components/ManutencaoJuros48';
import { ManutencaoCalendario } from '@/components/ManutencaoCalendario';
import { MultaManualAplicar } from '@/components/MultaManualOperacoes';
import { rotaReparcelamentoAtual } from '@/lib/legacyFinanceNavigation';
import { useAcoesListaEmprestimo62 } from '@/lib/useAcoesListaEmprestimo62';

// Calendário46 posterior à manutenção48 preserva valores atuais, somente após prova fechada criação25→46/48.
export default function EmprestimoDetalhes() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [aba, setAba] = useState<'etiqueta' | 'detalhes' | 'comprovante' | 'historico'>('etiqueta');
  const { id } = useParams<{ id: string }>();
  const emprestimoId = parseInt(id || '0');

  const [modalDeletar, setModalDeletar] = useState(false);
  const [loadingWpp, setLoadingWpp] = useState(false);
  const [gerandoPDF] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'paga' | 'atrasada' | 'cancelada' | 'arquivada'>('todas');

  const utils = trpc.useUtils();
  const { data: config } = trpc.configuracoes.get.useQuery();

  const { data: emprestimo, isPending, isLoading, isError, isFetching, refetch } = trpc.contratos.obterDetalhes.useQuery(
    { id: emprestimoId },
    { enabled: emprestimoId > 0 }
  );
  useAcoesListaEmprestimo62({ id, emprestimo, isPending, isLoading, isError, isFetching });

  // Pending/paused e ausência de resposta não comprovam exclusão do contrato.
  const leituraEmAndamento = emprestimoId > 0 && !isError && (
    isLoading || isPending || emprestimo === undefined || (isFetching && emprestimo === null)
  );
  if (leituraEmAndamento) {
    return (
      <div className="space-y-6">
        <p role="status" aria-live="polite">Carregando ficha do empréstimo...</p>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => setLocation('/emprestimos')}>Voltar para Empréstimos</Button>
        </div>
      </div>
    );
  }

  if (isError) {
    return <div role="alert" className="space-y-4 rounded-lg border p-4">
      <p>Não foi possível carregar a ficha do empréstimo. A consulta precisa ser conferida; isso não significa que o contrato foi apagado. Não cadastre novamente a mesma dívida.</p>
      <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>Tentar novamente</Button>
      <Button variant="outline" onClick={() => setLocation('/emprestimos')}>Voltar para Empréstimos</Button>
    </div>;
  }

  if (!emprestimo) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">{t('loanDetails.loanNotFound')}</p>
        <Button onClick={() => setLocation('/emprestimos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Empréstimos
        </Button>
      </div>
    );
  }

  const contagens = contagensParcelas51(emprestimo.todasParcelas ?? []);
  const diasAtraso = emprestimo.parcelasComAtraso?.[0]?.diasAtraso ?? 0;
  const jurosAtraso = emprestimo.parcelasComAtraso?.[0]?.jurosAtraso ?? 0;
  const isAtrasado = diasAtraso > 0;
  const statusBadge = badgeContrato(statusContrato51(emprestimo), isAtrasado);
  const parcela = emprestimo.todasParcelas?.find((p: any) => ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'].includes(p.status)) ?? emprestimo.todasParcelas?.find((p: any) => ['paga', 'pago'].includes(p.status));
  const atualizarFinanceiro = () => {
    void refetch();
    void utils.contratos.listComParcelas.invalidate();
    void utils.dashboard.invalidate();
    void utils.caixa.invalidate();
    void utils.parcelas.invalidate();
  };
  const handleWhatsApp = async (tipo: 'atraso' | 'preventivo' = 'atraso') => {
    if (emprestimo.arquivado || emprestimo.statusObrigacao !== 'ativo') { toast.info('Cobrança indisponível para obrigação encerrada ou não confirmada.'); return; }
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
    // A ficha não carrega prova de recebimento durável por operação. Status
    // ou primeiro registro não permitem inventar valor, data ou pagamento.
    toast.info('Comprovante indisponível nesta ficha sem prova financeira por operação. Consulte a confirmação da operação em Receber / conferir.');
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
        <Badge variant={statusBadge.variant}>
          {statusBadge.label}{emprestimo.arquivado ? ' · Arquivado' : ''}
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
          <p className="text-xs text-muted-foreground">{emprestimo.status !== 'ativo' ? statusBadge.label : isAtrasado ? `${diasAtraso} dias de atraso` : 'Em dia'}</p>
        </div>
      </div>

      <section aria-label="Composição da obrigação" className="rounded-lg border p-3 text-sm space-y-1">
        <p>Obrigação registrada51: {referenciaMonetaria51(emprestimo.obrigacaoAtual)}</p>
        <p>A — obrigação adicional não desembolsada: {referenciaMonetaria51(emprestimo.obrigacaoAdicional)}. Não compõe capital, juros ou lucro.</p>
        <p>{contagens.pagas} pagas reais · {contagens.canceladas} canceladas · {contagens.arquivadas} arquivadas (atributo separado).</p>
        <p className="text-xs text-muted-foreground">{REFERENCIA51} Restante a receber acima conserva a apresentação validada do reader.</p>
      </section>
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
            <div className="rounded border p-3 space-y-2">
              <h2 className="font-semibold">Editar / operações do contrato</h2>
              <OperacoesObrigacao51 contratoId={emprestimo.id} alvoInicial={{ tipo: 'contrato' }} onSuccess={atualizarFinanceiro} />
              <ManutencaoSucessor53 contratoId={emprestimo.id} onSuccess={atualizarFinanceiro} />
              <p className="text-sm text-muted-foreground">Adicionar parcela manual é obrigação adicional não desembolsada. Reparcelamento redistribui dívida existente; não substitui inclusão.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Total a Receber', value: formatarMoeda(emprestimo.totalReceber) },
                { label: 'Total Pago', value: formatarMoeda(emprestimo.totalPago), cls: 'text-green-500' },
                { label: 'Parcelas Pagas', value: `${contagens.pagas}/${emprestimo.todasParcelas?.length ?? emprestimo.numeroParcelas}` },
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
                  {(['todas', 'pendente', 'paga', 'atrasada', 'cancelada', 'arquivada'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFiltroStatus(f)}
                      className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                        filtroStatus === f
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {f === 'todas' ? 'Todas' : f === 'pendente' ? 'Pendentes' : f === 'paga' ? 'Pagas' : f === 'cancelada' ? 'Canceladas' : f === 'arquivada' ? 'Arquivadas' : 'Atrasadas'}
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
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Obrigação registrada / histórico</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Status</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Editar</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emprestimo.todasParcelas
                      ?.filter((p: any) => filtroStatus === 'todas' || (filtroStatus === 'arquivada' ? arquivada51(p) : statusParcela51(p) === filtroStatus))
                      .map((p: any) => (
                          <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="px-3 py-2 text-foreground">#{p.numero_parcela}</td>
                            <td className="px-3 py-2 text-foreground">{formatarData(p.data_vencimento)}</td>
                            <td className="px-3 py-2 text-right text-foreground">{referenciaMonetaria51(p.obrigacaoAtual)}
                              <div className="text-xs text-muted-foreground">Original histórico: {formatarMoeda(p.valor_original)} · Pago histórico: {p.valor_pago == null ? 'Não registrado' : formatarMoeda(p.valor_pago)}</div>
                              <div className="text-xs text-muted-foreground">A: {referenciaMonetaria51(p.componenteAdicional)} (não desembolsada)</div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={badgeParcela(statusParcela51(p), emprestimo.status).variant}>
                                {badgeParcela(statusParcela51(p), emprestimo.status).label}{p.arquivada ? ' · Arquivada' : ''}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <OperacoesObrigacao51 contratoId={emprestimo.id} alvoInicial={{ tipo: 'parcela', parcelaId: p.id }} acaoInicial="editar" label="Editar / cancelar / arquivar parcela" onSuccess={atualizarFinanceiro} />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <RecebimentoValidado contratoId={emprestimo.id} parcelaId={p.id} permitirRenovacao onSuccess={atualizarFinanceiro} />
                            </td>
                          </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">Para incluir obrigação nova não desembolsada, use Adicionar parcela manual em Operações do contrato. Reparcelamento redistribui a dívida existente, não inclui nova obrigação. Para renovar pagando juros, abra Receber / conferir na parcela; a origem determina a operação disponível.</p>
              <Button variant="outline" onClick={() => setLocation(rotaReparcelamentoAtual(emprestimo.id))}>Simular reparcelamento mensal</Button>
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
      <div id="manutencao-financeira" className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-6 border-t border-border">
        <div id="receber-conferir" tabIndex={-1} className="rounded-lg border border-border p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {parcela ? <RecebimentoValidado contratoId={emprestimo.id} parcelaId={parcela.id} permitirRenovacao onSuccess={atualizarFinanceiro} /> :
            <p className="text-sm text-muted-foreground">Nenhuma parcela disponível para receber nesta ficha. Abra a aba Detalhes para conferir as parcelas; nenhuma parcela será escolhida pelo atalho.</p>}
        </div>
        <ManutencaoJuros48 contratoId={emprestimo.id} parcelasIds={(emprestimo.todasParcelas??[]).map((p: {id:number})=>p.id)} onSuccess={atualizarFinanceiro} />
        <ManutencaoCalendario contratoId={emprestimo.id} onSuccess={atualizarFinanceiro} />
        <div id="editar-obrigacao" tabIndex={-1} className="rounded-lg border border-border p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <OperacoesObrigacao51 contratoId={emprestimo.id} alvoInicial={{ tipo: 'contrato' }} acaoInicial="editar" label="Adicionar parcela / editar obrigação / quitar" onSuccess={atualizarFinanceiro} />
        </div>
        <MultaManualAplicar contratoId={emprestimo.id} onSuccess={atualizarFinanceiro} />
        <Button id="reparcelar" variant="outline" size="sm" onClick={() => setLocation(rotaReparcelamentoAtual(emprestimo.id))}>Reparcelar mensal</Button>
        {emprestimo.clienteWhatsapp && (
          <Button className="gap-2" variant="outline" size="sm" onClick={() => handleWhatsApp(isAtrasado ? 'atraso' : 'preventivo')} disabled={loadingWpp || emprestimo.arquivado || emprestimo.statusObrigacao !== 'ativo'}>
            {loadingWpp ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Cobrar (WhatsApp)
          </Button>
        )}
        <Button className="gap-2" variant="outline" size="sm" onClick={() => handleWhatsApp(isAtrasado ? 'atraso' : 'preventivo')} disabled={loadingWpp || !emprestimo.clienteWhatsapp || emprestimo.arquivado || emprestimo.statusObrigacao !== 'ativo'}>
          {loadingWpp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Cobrança
        </Button>
        <Button className="gap-2" variant="outline" size="sm" onClick={handleGerarComprovante} disabled={gerandoPDF}>
          <FileText className="h-4 w-4" />
          {gerandoPDF ? 'Gerando...' : 'Comprovante'}
        </Button>
        <Button id="cancelar-arquivar" title="Renúncia sem estorno ou arquivo de contrato encerrado; nunca exclusão do histórico." className="gap-2" variant="destructive" size="sm" onClick={() => setModalDeletar(true)}>
          <Trash2 className="h-4 w-4" /> Cancelar / arquivar
        </Button>
      </div>

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
        <p className="text-muted-foreground/60 text-xs mt-1">{t('loanDetails.futureActionsWillAppear')}</p>
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
