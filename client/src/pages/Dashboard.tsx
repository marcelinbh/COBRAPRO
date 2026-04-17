import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatarMoeda } from "../../../shared/finance";
import {
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle,
  Clock, DollarSign, CalendarClock, ArrowUpRight, ArrowDownRight,
  Plus, ChevronRight, Send
} from "lucide-react";
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${iconStyles[variant]}`}>
            <Icon className="h-4 w-4" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend.value >= 0 ? 'text-success' : 'text-primary'}`}>
              {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className={`font-display text-2xl mb-1 ${valueStyles[variant]}`}>{value}</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paga: { label: "Paga", className: "bg-success/15 text-success border-success/30" },
    pendente: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
    atrasada: { label: "Atrasada", className: "bg-primary/15 text-primary border-primary/30" },
    vencendo_hoje: { label: "Vence Hoje", className: "bg-warning/15 text-warning border-warning/30" },
    parcial: { label: "Parcial", className: "bg-warning/15 text-warning border-warning/30" },
  };
  const s = map[status] ?? map.pendente;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>
      {s.label}
    </span>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: meuKoletor } = trpc.cobradores.me.useQuery();
  // Perfil koletor = funcionário com acesso restrito (sem KPIs financeiros globais)
  const isKoletor = meuKoletor?.perfil === 'koletor';
  const { data: kpis, isLoading: kpisLoading } = trpc.dashboard.kpis.useQuery();
  const { data: parcelasHoje } = trpc.dashboard.parcelasHoje.useQuery();
  const { data: atrasadas } = trpc.dashboard.parcelasAtrasadas.useQuery();
  const { data: fluxoMensal } = trpc.dashboard.fluxoMensal.useQuery();
  const relatorioDiarioMutation = trpc.whatsapp.relatorioDiario.useMutation({
    onSuccess: (data) => {
      window.open(data.whatsappUrl, '_blank');
      toast.success(`Relatório gerado! Recebido hoje: R$ ${data.totalRecebidoHoje.toFixed(2).replace('.', ',')}`);
    },
    onError: () => toast.error('Erro ao gerar relatório diário'),
  });

  const chartData = fluxoMensal ?? [];

  // Calcular taxa de inadimplência
  const taxaInadimplencia = kpis && kpis.capitalCirculacao > 0
    ? ((kpis.totalInadimplente / kpis.capitalCirculacao) * 100).toFixed(1)
    : '0.0';

  // Calcular taxa de recebimento hoje
  const taxaRecebimentoHoje = kpis && kpis.valorVenceHoje > 0
    ? ((kpis.recebidoHoje / kpis.valorVenceHoje) * 100).toFixed(0)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">DASHBOARD</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => relatorioDiarioMutation.mutate({})}
            disabled={relatorioDiarioMutation.isPending}
            className="gap-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Send className="h-4 w-4" />
            {relatorioDiarioMutation.isPending ? 'Gerando...' : 'Relatório Diário'}
          </Button>
          <Button onClick={() => setLocation('/contratos/novo')} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* Banner de acesso restrito para koletores */}
      {isKoletor && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-warning">Você está visualizando apenas seus próprios empréstimos e parcelas.</p>
        </div>
      )}

      {/* KPI Cards — ocultos para koletores */}
      {!isKoletor && <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Saldo em Contas"
          value={kpisLoading ? "..." : formatarMoeda(kpis?.saldoTotal ?? 0)}
          icon={Wallet}
          variant="default"
          subtitle="Todas as contas"
        />
        <KPICard
          title="Capital em Circulação"
          value={kpisLoading ? "..." : formatarMoeda(kpis?.capitalCirculacao ?? 0)}
          icon={TrendingUp}
          variant="primary"
          subtitle={`${kpis?.contratosAtivos ?? 0} contratos ativos`}
        />
        <KPICard
          title="Total a Receber"
          value={kpisLoading ? "..." : formatarMoeda(kpis?.totalReceber ?? 0)}
          icon={DollarSign}
          variant="success"
          subtitle="Parcelas pendentes"
        />
        <KPICard
          title="Inadimplência"
          value={kpisLoading ? "..." : formatarMoeda(kpis?.totalInadimplente ?? 0)}
          icon={AlertTriangle}
          variant="danger"
          subtitle={`${kpis?.qtdInadimplentes ?? 0} clientes · ${taxaInadimplencia}%`}
        />
        <KPICard
          title="Juros Pendentes"
          value={kpisLoading ? "..." : formatarMoeda(kpis?.jurosPendentes ?? 0)}
          icon={TrendingDown}
          variant="warning"
          subtitle="Acumulados"
        />
        <KPICard
          title="Vence Hoje"
          value={kpisLoading ? "..." : `${kpis?.qtdVenceHoje ?? 0}`}
          icon={CalendarClock}
          variant={kpis?.qtdVenceHoje ? "warning" : "default"}
          subtitle={formatarMoeda(kpis?.valorVenceHoje ?? 0)}
        />
      </div>}

      {/* Barra de saúde financeira — oculta para koletores */}
      {!isKoletor && kpis && kpis.capitalCirculacao > 0 && (
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saúde da Carteira</span>
              <span className="text-xs text-muted-foreground">Taxa de inadimplência: <span className={`font-bold ${parseFloat(taxaInadimplencia) > 15 ? 'text-primary' : parseFloat(taxaInadimplencia) > 8 ? 'text-warning' : 'text-success'}`}>{taxaInadimplencia}%</span></span>
            </div>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              <div className="bg-success rounded-l-full transition-all" style={{ width: `${Math.max(0, 100 - parseFloat(taxaInadimplencia))}%` }} title="Em dia" />
              <div className="bg-primary rounded-r-full transition-all" style={{ width: `${Math.min(100, parseFloat(taxaInadimplencia))}%` }} title="Inadimplente" />
            </div>
            <div className="flex justify-between mt-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-success" /> Em dia: {formatarMoeda((kpis.capitalCirculacao - kpis.totalInadimplente))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary" /> Inadimplente: {formatarMoeda(kpis.totalInadimplente)}
              </div>
            </div>
          </CardContent>
        </Card>
       )}

      {/* Charts + Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Fluxo Mensal */}
        <Card className="xl:col-span-2 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Fluxo de Recebimentos — Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
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
                  formatter={(v: number) => [formatarMoeda(v), 'Recebido']}
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
              Resumo do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
              <div>
                <div className="text-xs text-muted-foreground">Recebido Hoje</div>
                <div className="font-display text-lg text-success">{formatarMoeda(kpis?.recebidoHoje ?? 0)}</div>
              </div>
              <ArrowUpRight className="h-5 w-5 text-success" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div>
                <div className="text-xs text-muted-foreground">Vence Hoje</div>
                <div className="font-display text-lg text-primary">{formatarMoeda(kpis?.valorVenceHoje ?? 0)}</div>
              </div>
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <div>
                <div className="text-xs text-muted-foreground">Contratos Ativos</div>
                <div className="font-display text-lg text-foreground">{kpis?.contratosAtivos ?? 0}</div>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parcelas Vencendo Hoje + Atrasadas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Vencendo Hoje */}
        <Card className="border-warning/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-warning uppercase tracking-wide flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Vencendo Hoje ({parcelasHoje?.length ?? 0})
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation('/parcelas')}>
                Ver todas <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {parcelasHoje?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela vence hoje</p>
            )}
            {parcelasHoje?.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border hover:border-warning/30 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.clienteNome}</div>
                  <div className="text-xs text-muted-foreground">Parcela {p.numeroParcela}/{p.totalParcelas}</div>
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
                Em Atraso ({atrasadas?.length ?? 0})
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation('/parcelas?status=atrasada')}>
                Ver todas <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {atrasadas?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela em atraso</p>
            )}
            {atrasadas?.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 hover:border-primary/40 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.clienteNome}</div>
                  <div className="text-xs text-muted-foreground">{p.diasAtraso} dias em atraso</div>
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
