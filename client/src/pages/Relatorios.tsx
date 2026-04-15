import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart2, TrendingUp, AlertTriangle, DollarSign } from "lucide-react";
import { formatarMoeda } from "../../../shared/finance";

const CORES = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function Relatorios() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
  );
  const [dataFim, setDataFim] = useState(hoje.toISOString().split('T')[0]);

  const { data: kpis } = trpc.dashboard.kpis.useQuery();
  const { data: parcelas } = trpc.parcelas.list.useQuery({});
  const { data: transacoes } = trpc.caixa.transacoes.useQuery({});

  // Dados para gráfico de status de parcelas
  const statusData = [
    { name: 'Pagas', value: parcelas?.filter(p => p.status === 'paga').length ?? 0, color: '#22c55e' },
    { name: 'Pendentes', value: parcelas?.filter(p => p.status === 'pendente').length ?? 0, color: '#6b7280' },
    { name: 'Atrasadas', value: parcelas?.filter(p => p.status === 'atrasada').length ?? 0, color: '#ef4444' },
    { name: 'Vence Hoje', value: parcelas?.filter(p => p.status === 'vencendo_hoje').length ?? 0, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Entradas e saídas por dia (últimos 7 dias)
  const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const fluxoData = ultimos7Dias.map(d => {
    const dayKey = d.toISOString().split('T')[0];
    const entradas = transacoes
      ?.filter(t => t.tipo === 'entrada' && new Date(t.dataTransacao).toISOString().split('T')[0] === dayKey)
      .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0) ?? 0;
    const saidas = transacoes
      ?.filter(t => t.tipo === 'saida' && new Date(t.dataTransacao).toISOString().split('T')[0] === dayKey)
      .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0) ?? 0;
    return {
      dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      entradas,
      saidas,
    };
  });

  // Total a receber no período
  const parcelasPeriodo = parcelas?.filter(p => {
    const d = new Date(p.dataVencimento).toISOString().split('T')[0];
    return d >= dataInicio && d <= dataFim;
  }) ?? [];

  const totalPeriodo = parcelasPeriodo.reduce((sum, p) => sum + parseFloat(p.valorOriginal), 0);
  const recebidoPeriodo = parcelasPeriodo.filter(p => p.status === 'paga').reduce((sum, p) => sum + parseFloat(p.valorPago ?? p.valorOriginal), 0);
  const inadimplentePeriodo = parcelasPeriodo.filter(p => p.status === 'atrasada').reduce((sum, p) => sum + parseFloat(p.valorOriginal), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-foreground tracking-wide">RELATÓRIOS</h1>
        <p className="text-sm text-muted-foreground mt-1">Análise financeira e desempenho</p>
      </div>

      {/* Filtro de período */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Data Início</Label>
              <Input type="date" className="mt-1" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Data Fim</Label>
              <Input type="date" className="mt-1" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs do período */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-success/15"><DollarSign className="h-4 w-4 text-success" /></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Recebido no Período</span>
            </div>
            <div className="font-display text-2xl text-success">{formatarMoeda(recebidoPeriodo)}</div>
            <div className="text-xs text-muted-foreground mt-1">de {formatarMoeda(totalPeriodo)} previstos</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/15"><AlertTriangle className="h-4 w-4 text-primary" /></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Inadimplência</span>
            </div>
            <div className="font-display text-2xl text-primary">{formatarMoeda(inadimplentePeriodo)}</div>
            <div className="text-xs text-muted-foreground mt-1">{parcelasPeriodo.filter(p => p.status === 'atrasada').length} parcelas atrasadas</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-warning/15"><TrendingUp className="h-4 w-4 text-warning" /></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Taxa de Recebimento</span>
            </div>
            <div className="font-display text-2xl text-warning">
              {totalPeriodo > 0 ? ((recebidoPeriodo / totalPeriodo) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">do total previsto</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-destructive/15"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Taxa de Inadimplência</span>
            </div>
            <div className="font-display text-2xl text-destructive">
              {totalPeriodo > 0 ? ((inadimplentePeriodo / totalPeriodo) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {parcelasPeriodo.filter(p => p.status === 'atrasada').length} parcelas em atraso
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fluxo de Caixa */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Fluxo de Caixa — Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fluxoData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
                  formatter={(v: number) => formatarMoeda(v)}
                />
                <Bar dataKey="entradas" fill="#22c55e" radius={[4, 4, 0, 0]} name="Entradas" />
                <Bar dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status de Parcelas */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Status das Parcelas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                Nenhuma parcela cadastrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPIs Globais */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Resumo Geral do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Capital em Circulação", value: kpis?.capitalCirculacao ?? 0, color: "text-foreground" },
              { label: "Total a Receber", value: kpis?.totalReceber ?? 0, color: "text-warning" },
              { label: "Inadimplência Total", value: kpis?.totalInadimplente ?? 0, color: "text-primary" },
              { label: "Juros Pendentes", value: kpis?.jurosPendentes ?? 0, color: "text-success" },
            ].map(k => (
              <div key={k.label} className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{k.label}</div>
                <div className={`font-display text-xl ${k.color}`}>{formatarMoeda(k.value)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
