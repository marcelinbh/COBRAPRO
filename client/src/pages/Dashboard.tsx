import { useTranslation } from 'react-i18next';
import { trpc } from "@/lib/trpc";
import { formatarMoeda } from "../../../shared/finance";
import {
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle,
  Clock, DollarSign, CalendarClock, ArrowUpRight, ArrowDownRight,
  Plus, ChevronRight, Send, Target, Zap, ShieldAlert, BarChart2
} from "lucide-react";
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";

function KPICard({
  title, value, subtitle, icon: Icon, variant = "default", trend
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  variant?: "default" | "success" | "danger" | "warning" | "primary";
  trend?: { value: number; label: string };
}) {
  const variantStyles = {
    default: "border-border",
    success: "border-success/30 bg-success/5",
    danger: "border-danger/30 bg-danger/5",
    warning: "border-warning/30 bg-warning/5",
    primary: "border-primary/30 bg-primary/5",
  };
  const iconStyles = {
    default: "text-muted-foreground bg-muted",
    success: "text-success bg-success/15",
    danger: "text-primary bg-primary/15",
    warning: "text-warning bg-warning/15",
    primary: "text-primary bg-primary/15",
  };
  const valueStyles = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-primary",
    warning: "text-warning",
    primary: "text-primary",
  };

  return (
    <Card className={`border ${variantStyles[variant]} transition-all hover:border-opacity-60`}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between mb-1.5">
          <div className={`p-1.5 rounded-lg ${iconStyles[variant]}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend.value >= 0 ? 'text-success' : 'text-primary'}`}>
              {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className={`font-display text-sm sm:text-2xl mb-0.5 leading-tight ${valueStyles[variant]}`}>{value}</div>
        <div className="text-[9px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{title}</div>
        {subtitle && <div className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { labelKey: string; className: string }> = {
    paga: { labelKey: 'loans.paid', className: "bg-success/15 text-success border-success/30" },
    pendente: { labelKey: 'loans.pending', className: "bg-muted text-muted-foreground border-border" },
    atrasada: { labelKey: 'loans.overdue', className: "bg-primary/15 text-primary border-primary/30" },
    vencendo_hoje: { labelKey: 'loans.dueToday', className: "bg-warning/15 text-warning border-warning/30" },
    parcial: { labelKey: 'loans.partial', className: "bg-warning/15 text-warning border-warning/30" },
  };
  const s = map[status] ?? map.pendente;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>
      {t(s.labelKey)}
    </span>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const { t } = useTranslation();
  const cor = score >= 75 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-primary';
  const label = score >= 75 ? t('dashboard.scoreExcellent') : score >= 50 ? t('dashboard.scoreGood') : score >= 25 ? t('dashboard.scoreRegular') : t('dashboard.scorePoor');
  const corBg = score >= 75 ? 'bg-success/10 border-success/30' : score >= 50 ? 'bg-warning/10 border-warning/30' : 'bg-primary/10 border-primary/30';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = score >= 75 ? 'oklch(0.55 0.18 145)' : score >= 50 ? 'oklch(0.75 0.18 80)' : 'oklch(0.55 0.22 25)';
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-xl border ${corBg}`}>
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="oklch(0.22 0.01 240)" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={strokeColor} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${cor}`}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <div className={`text-xs font-semibold mt-1 ${cor}`}>{label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{t('dashboard.businessScore')}</div>
    </div>
  );
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: meuKoletor } = trpc.cobradores.me.useQuery();
  const isKoletor = meuKoletor?.perfil === 'koletor';
  const { data: kpis, isLoading: kpisLoading } = trpc.dashboard.kpis.useQuery();
  const { data: parcelasHoje } = trpc.dashboard.parcelasHoje.useQuery();
  const { data: atrasadas } = trpc.dashboard.parcelasAtrasadas.useQuery();
  const { data: fluxoMensal } = trpc.dashboard.fluxoMensal.useQuery();
  const { data: scoreData } = trpc.dashboard.scoreNegocio.useQuery();
  const { data: atencao } = trpc.dashboard.precisaAtencao.useQuery();
  const { data: tendencia } = trpc.dashboard.tendenciaJuros.useQuery();
  const relatorioDiarioMutation = trpc.whatsapp.relatorioDiario.useMutation({
    onSuccess: (data) => {
      window.open(data.whatsappUrl, '_blank');
      toast.success(`Relatório gerado! Recebido hoje: R$ ${data.totalRecebidoHoje.toFixed(2).replace('.', ',')}`);
    },
    onError: () => toast.error(t('toast_error.erro_ao_gerar_relatório_diário')),
  });

  const chartData = fluxoMensal ?? [];
  const tendenciaData = tendencia ?? [];

  const taxaInadimplencia = kpis && kpis.capitalCirculacao > 0
    ? ((kpis.totalInadimplente / kpis.capitalCirculacao) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-3xl text-foreground tracking-wide">{t('dashboard.title')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            {new Date().toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
            {new Date().toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => relatorioDiarioMutation.mutate({})}
            disabled={relatorioDiarioMutation.isPending}
            className="gap-1.5 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 text-xs px-2.5"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{relatorioDiarioMutation.isPending ? t('common.generating') : t('dashboard.dailyReportButton')}</span>
            <span className="sm:hidden">{relatorioDiarioMutation.isPending ? '...' : t('dashboard.dailyReport')}</span>
          </Button>
          <Button size="sm" onClick={() => setLocation('/contratos/novo')} className="gap-1.5 text-xs px-2.5">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('common.newContract')}</span>
            <span className="sm:hidden">{t('common.new')}</span>
          </Button>
        </div>
      </div>

      {/* Banner de acesso restrito para koletores */}
      {isKoletor && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-warning">{t('dashboard.koletorBanner')}</p>
        </div>
      )}

      {/* KPI Cards - ocultos para koletores */}
      {!isKoletor && <div className="grid grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-4">
        <KPICard title={t('dashboard.balance')} value={kpisLoading ? "..." : formatarMoeda(kpis?.saldoTotal ?? 0)} icon={Wallet} variant="default" subtitle={t('dashboard.allAccounts')} />
        <KPICard title={t('dashboard.capital')} value={kpisLoading ? "..." : formatarMoeda(kpis?.capitalCirculacao ?? 0)} icon={TrendingUp} variant="primary" subtitle={`${kpis?.contratosAtivos ?? 0} ${t('dashboard.activeContracts')}`} />
        <KPICard title={t('dashboard.toReceive2')} value={kpisLoading ? "..." : formatarMoeda(kpis?.totalReceber ?? 0)} icon={DollarSign} variant="success" subtitle={t('dashboard.pendingInstallments')} />
        <KPICard title={t('dashboard.delinquency')} value={kpisLoading ? "..." : formatarMoeda(kpis?.totalInadimplente ?? 0)} icon={AlertTriangle} variant="danger" subtitle={`${kpis?.qtdInadimplentes ?? 0} clientes · ${taxaInadimplencia}%`} />
        <KPICard title={t('dashboard.interest')} value={kpisLoading ? "..." : formatarMoeda(kpis?.jurosPendentes ?? 0)} icon={TrendingDown} variant="warning" subtitle={t('dashboard.accumulated')} />
        <KPICard title={t('dashboard.dueToday')} value={kpisLoading ? "..." : `${kpis?.qtdVenceHoje ?? 0}`} icon={CalendarClock} variant={kpis?.qtdVenceHoje ? "warning" : "default"} subtitle={formatarMoeda(kpis?.valorVenceHoje ?? 0)} />
      </div>}

      {/* Barra de saúde financeira */}
      {!isKoletor && kpis && kpis.capitalCirculacao > 0 && (
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('dashboard.portfolioHealth')}</span>
              <span className="text-xs text-muted-foreground">{t('dashboard.delinquencyRate')}: <span className={`font-bold ${parseFloat(taxaInadimplencia) > 15 ? 'text-primary' : parseFloat(taxaInadimplencia) > 8 ? 'text-warning' : 'text-success'}`}>{taxaInadimplencia}%</span></span>
            </div>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              <div className="bg-success rounded-l-full transition-all" style={{ width: `${Math.max(0, 100 - parseFloat(taxaInadimplencia))}%` }} />
              <div className="bg-primary rounded-r-full transition-all" style={{ width: `${Math.min(100, parseFloat(taxaInadimplencia))}%` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-success" /> {t('dashboard.onTime')}: {formatarMoeda((kpis.capitalCirculacao - kpis.totalInadimplente))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary" /> {t('dashboard.delinquent')}: {formatarMoeda(kpis.totalInadimplente)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score do Negócio + Precisa de Atenção */}
      {!isKoletor && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Score do Negócio */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Target className="h-3.5 w-3.5" /> {t('dashboard.businessScore')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <ScoreCircle score={scoreData?.score ?? 0} />
              <div className="w-full space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('dashboard.received')}</span>
                  <span className="text-success font-medium">{(scoreData?.taxaRecebimento ?? 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('dashboard.delinquency')}</span>
                  <span className="text-primary font-medium">{(scoreData?.inadimplencia ?? 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('dashboard.received')}</span>
                  <span className="text-foreground font-medium">{formatarMoeda(scoreData?.totalRecebido ?? 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Precisa de Atenção */}
          <Card className="border-warning/20 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-warning uppercase tracking-wide flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5" /> {t('dashboard.needsAttention')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Vence esta semana */}
              <div
                className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20 cursor-pointer hover:border-warning/40 transition-colors"
                onClick={() => setLocation('/parcelas')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/15">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{t('dashboard.dueThisWeek')}</div>
                    <div className="text-xs text-muted-foreground">{atencao?.venceSemana.qtd ?? 0} {t('dashboard.installmentsNext7Days')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-warning">{formatarMoeda(atencao?.venceSemana.valor ?? 0)}</div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                </div>
              </div>

              {/* Inadimplentes +30 dias */}
              <div
                className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setLocation('/parcelas?status=atrasada')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/15">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{t('dashboard.overdueMore30Days')}</div>
                    <div className="text-xs text-muted-foreground">{atencao?.atrasados30.qtd ?? 0} {t('dashboard.clientsWithSeriousDelay')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-primary">{formatarMoeda(atencao?.atrasados30.valor ?? 0)}</div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                </div>
              </div>

              {/* Atalhos rápidos */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={() => setLocation('/emprestimos')}>
                  <Zap className="h-3 w-3" /> {t('dashboard.loans')}
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={() => setLocation('/clientes')}>
                  <Users className="h-3 w-3" /> {t('dashboard.clients2')}
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={() => setLocation('/caixa')}>
                  <Wallet className="h-3 w-3" /> {t('dashboard.cashbox')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts + Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Fluxo Mensal */}
        <Card className="xl:col-span-2 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {t('dashboard.cashFlowWeek')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.55 0.18 145)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.55 0.18 145)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 240)" />
                <XAxis dataKey="dia" tick={{ fill: 'oklch(0.55 0.01 240)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'oklch(0.55 0.01 240)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'oklch(0.14 0.008 240)', border: '1px solid oklch(0.22 0.01 240)', borderRadius: '8px' }}
                  labelStyle={{ color: 'oklch(0.95 0.005 240)' }}
                  formatter={(v: number) => [formatarMoeda(v), t('dashboard.received')]}
                />
                <Area type="monotone" dataKey="valor" stroke="oklch(0.55 0.18 145)" strokeWidth={2} fill="url(#colorEntrada)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resumo Rápido */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {t('dashboard.dailySummary')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
              <div>
                <div className="text-xs text-muted-foreground">{t('dashboard.received')}</div>
                <div className="font-display text-lg text-success">{formatarMoeda(kpis?.recebidoHoje ?? 0)}</div>
              </div>
              <ArrowUpRight className="h-5 w-5 text-success" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div>
                <div className="text-xs text-muted-foreground">{t('dashboard.dueToday')}</div>
                <div className="font-display text-lg text-primary">{formatarMoeda(kpis?.valorVenceHoje ?? 0)}</div>
              </div>
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <div>
                <div className="text-xs text-muted-foreground">{t('dashboard.activeContracts2')}</div>
                <div className="font-display text-lg text-foreground">{kpis?.contratosAtivos ?? 0}</div>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tendência de Juros Recebidos (últimos 6 meses) */}
      {!isKoletor && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <BarChart2 className="h-3.5 w-3.5" /> {t('dashboard.receivingTrend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={tendenciaData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 240)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: 'oklch(0.55 0.01 240)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'oklch(0.55 0.01 240)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'oklch(0.14 0.008 240)', border: '1px solid oklch(0.22 0.01 240)', borderRadius: '8px' }}
                  labelStyle={{ color: 'oklch(0.95 0.005 240)' }}
                  formatter={(v: number) => [formatarMoeda(v), t('dashboard.received')]}
                />
                <Bar dataKey="valor" fill="oklch(0.55 0.22 25)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Parcelas Vencendo Hoje + Atrasadas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Vencendo Hoje */}
        <Card className="border-warning/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-warning uppercase tracking-wide flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('dashboard.dueTodayTitle')} ({parcelasHoje?.length ?? 0})
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation('/parcelas')}>
                {t('dashboard.viewAll')} <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {parcelasHoje?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('common.noData')}</p>
            )}
            {parcelasHoje?.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border hover:border-warning/30 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.clienteNome}</div>
                  <div className="text-xs text-muted-foreground">{t('common.installment')} {p.numeroParcela}/{p.totalParcelas}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-sm font-semibold text-warning">{formatarMoeda(p.valorOriginal)}</div>
                  <StatusBadge status="vencendo_hoje" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Atrasadas */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-primary uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t('dashboard.overdueTitle')} ({atrasadas?.length ?? 0})
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation('/parcelas?status=atrasada')}>
                {t('dashboard.viewAll')} <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {atrasadas?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('common.noData')}</p>
            )}
            {atrasadas?.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 hover:border-primary/40 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.clienteNome}</div>
                  <div className="text-xs text-muted-foreground">{p.diasAtraso} {t('dashboard.daysOverdue')}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-sm font-semibold text-primary">{formatarMoeda(p.valorAtualizado)}</div>
                  <StatusBadge status="atrasada" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
