import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart2, TrendingUp, AlertTriangle, DollarSign, Filter, ArrowDownCircle, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatarMoeda } from "../../../shared/finance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CORES = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const MODALIDADE_LABELS: Record<string, string> = {
  'emprestimo_padrao': 'Empréstimo Padrão',
  'emprestimo_diario': 'Empréstimo Diário',
  'tabela_price': 'Tabela Price',
  'venda_produto': 'Venda de Produto',
  'desconto_cheque': 'Desconto de Cheque',
  'reparcelamento': 'Reparcelamento',
};

export default function Relatorios() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
  );
  const [dataFim, setDataFim] = useState(hoje.toISOString().split('T')[0]);
  const [filtroModalidade, setFiltroModalidade] = useState('todas');

  const { data: kpis } = trpc.dashboard.kpis.useQuery();
  const { data: parcelas } = trpc.parcelas.list.useQuery({});
  const { data: transacoes } = trpc.caixa.transacoes.useQuery({});
  const { data: contasCaixa } = trpc.caixa.contas.useQuery();
  const { data: contasPagarData } = trpc.contasPagar.listar.useQuery({ status: 'paga' });

  // Filtrar parcelas por período e modalidade
  // Para parcelas pagas: filtrar por data_pagamento (quando foi pago)
  // Para parcelas pendentes/atrasadas: filtrar por data_vencimento (quando vence)
  const parcelasPeriodo = (parcelas ?? []).filter(p => {
    const modalidadeOk = filtroModalidade === 'todas' || p.modalidade === filtroModalidade;
    if (!modalidadeOk) return false;
    if (p.status === 'paga' && p.dataPagamento) {
      const d = new Date(p.dataPagamento).toISOString().split('T')[0];
      return d >= dataInicio && d <= dataFim;
    }
    const d = new Date(p.dataVencimento).toISOString().split('T')[0];
    return d >= dataInicio && d <= dataFim;
  });

  const totalPeriodo = parcelasPeriodo.reduce((sum, p) => sum + parseFloat(p.valorOriginal), 0);
  const recebidoPeriodo = parcelasPeriodo.filter(p => p.status === 'paga').reduce((sum, p) => sum + parseFloat(p.valorPago ?? p.valorOriginal), 0);
  const inadimplentePeriodo = parcelasPeriodo.filter(p => p.status === 'atrasada').reduce((sum, p) => sum + parseFloat(p.valorOriginal), 0);

  // Dados para gráfico de status de parcelas (filtrado)
  const statusData = [
    { name: 'Pagas', value: parcelasPeriodo.filter(p => p.status === 'paga').length, color: '#22c55e' },
    { name: 'Pendentes', value: parcelasPeriodo.filter(p => p.status === 'pendente').length, color: '#6b7280' },
    { name: 'Atrasadas', value: parcelasPeriodo.filter(p => p.status === 'atrasada').length, color: '#ef4444' },
    { name: 'Vence Hoje', value: parcelasPeriodo.filter(p => p.status === 'vencendo_hoje').length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Dados para gráfico de modalidades (distribuição do valor recebido por modalidade)
  const modalidadesMap: Record<string, { recebido: number; total: number; count: number }> = {};
  parcelasPeriodo.forEach(p => {
    const mod = p.modalidade ?? 'outros';
    if (!modalidadesMap[mod]) modalidadesMap[mod] = { recebido: 0, total: 0, count: 0 };
    modalidadesMap[mod].total += parseFloat(p.valorOriginal);
    modalidadesMap[mod].count += 1;
    if (p.status === 'paga') {
      modalidadesMap[mod].recebido += parseFloat(p.valorPago ?? p.valorOriginal);
    }
  });
  const modalidadesData = Object.entries(modalidadesMap).map(([key, val], idx) => ({
    name: MODALIDADE_LABELS[key] ?? key,
    recebido: val.recebido,
    total: val.total,
    parcelas: val.count,
    color: CORES[idx % CORES.length],
  }));

  // Entradas e saídas por dia (últimos 7 dias) — filtrado por modalidade se possível
  const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const fluxoData = ultimos7Dias.map(d => {
    const dayKey = d.toISOString().split('T')[0];
    const entradas = (transacoes ?? [])
      .filter(t => t.tipo === 'entrada' && new Date(t.dataTransacao).toISOString().split('T')[0] === dayKey)
      .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0);
    const saidas = (transacoes ?? [])
      .filter(t => t.tipo === 'saida' && new Date(t.dataTransacao).toISOString().split('T')[0] === dayKey)
      .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0);
    return {
      dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      entradas,
      saidas,
    };
  });

  // Modalidades disponíveis (para o seletor)
  const modalidadesDisponiveis = Array.from(new Set((parcelas ?? []).map(p => p.modalidade).filter(Boolean)));

  // Saídas no período (empréstimos concedidos + contas a pagar pagas)
  const saidasCaixaPeriodo = (transacoes ?? [])
    .filter(t => {
      const d = new Date(t.dataTransacao).toISOString().split('T')[0];
      return t.tipo === 'saida' && d >= dataInicio && d <= dataFim;
    })
    .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0);

  // Contas a pagar pagas no período
  const contasPagarPagas = (contasPagarData ?? []).filter((c: any) => {
    const dataPag = c.dataPagamento || c.data_pagamento;
    if (!dataPag) return false;
    const d = new Date(dataPag).toISOString().split('T')[0];
    return d >= dataInicio && d <= dataFim;
  });
  const totalContasPagarPeriodo = contasPagarPagas.reduce((sum: number, c: any) =>
    sum + parseFloat(String(c.valor ?? c.valorPago ?? 0)), 0);
  const saidasPeriodo = saidasCaixaPeriodo + totalContasPagarPeriodo;

  const entradasPeriodo = (transacoes ?? [])
    .filter(t => {
      const d = new Date(t.dataTransacao).toISOString().split('T')[0];
      return t.tipo === 'entrada' && d >= dataInicio && d <= dataFim;
    })
    .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0);

  // Distribuição de vendas por modalidade (gráfico de pizza)
  const distribuicaoVendas = Object.entries(modalidadesMap).map(([key, val], idx) => ({
    name: MODALIDADE_LABELS[key] ?? key,
    value: val.total,
    color: CORES[idx % CORES.length],
  })).filter(d => d.value > 0);

  // Caixa Extra manual
  const [caixaExtraValor, setCaixaExtraValor] = useState('');
  const [caixaExtraDesc, setCaixaExtraDesc] = useState('');
  const [caixaExtraTipo, setCaixaExtraTipo] = useState<'entrada' | 'saida'>('entrada');
  const utils = trpc.useUtils();
  const caixaExtraMutation = trpc.caixa.registrarTransacao.useMutation({
    onSuccess: () => {
      toast.success('Lançamento registrado no caixa!');
      setCaixaExtraValor('');
      setCaixaExtraDesc('');
      utils.caixa.transacoes.invalidate();
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  function handleCaixaExtra() {
    const valor = parseFloat(caixaExtraValor.replace(',', '.'));
    if (!valor || valor <= 0) { toast.error('Informe um valor válido'); return; }
    if (!caixaExtraDesc.trim()) { toast.error('Informe uma descrição'); return; }
    const contaId = contasCaixa?.[0]?.id;
    if (!contaId) { toast.error('Nenhuma conta caixa encontrada. Crie uma conta no módulo Caixa.'); return; }
    caixaExtraMutation.mutate({
      contaCaixaId: contaId,
      tipo: caixaExtraTipo,
      valor,
      descricao: caixaExtraDesc,
      categoria: caixaExtraTipo === 'entrada' ? 'ajuste_manual' : 'despesa_operacional',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-foreground tracking-wide">RELATÓRIOS</h1>
        <p className="text-sm text-muted-foreground mt-1">Análise financeira e desempenho</p>
      </div>

      {/* Filtros */}
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
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Filter className="h-3 w-3" /> Modalidade
              </Label>
              <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas as modalidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Modalidades</SelectItem>
                  {modalidadesDisponiveis.map(mod => (
                    <SelectItem key={mod} value={mod!}>
                      {MODALIDADE_LABELS[mod!] ?? mod}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filtroModalidade !== 'todas' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtrando por:</span>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                {MODALIDADE_LABELS[filtroModalidade] ?? filtroModalidade}
              </span>
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setFiltroModalidade('todas')}
              >
                Limpar filtro
              </button>
            </div>
          )}
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
              Status das Parcelas {filtroModalidade !== 'todas' ? `— ${MODALIDADE_LABELS[filtroModalidade] ?? filtroModalidade}` : ''}
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
                Nenhuma parcela no período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico por Modalidade */}
      {modalidadesData.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Recebimentos por Modalidade — Período Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={modalidadesData} margin={{ top: 0, right: 0, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
                  formatter={(v: number, name: string) => [formatarMoeda(v), name === 'recebido' ? 'Recebido' : 'Total Previsto']}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="total" opacity={0.5} />
                <Bar dataKey="recebido" fill="#22c55e" radius={[4, 4, 0, 0]} name="recebido" />
              </BarChart>
            </ResponsiveContainer>
            {/* Tabela resumo por modalidade */}
            <div className="mt-4 space-y-2">
              {modalidadesData.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                    <span className="text-sm font-medium text-foreground">{m.name}</span>
                    <span className="text-xs text-muted-foreground">({m.parcelas} parcelas)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Recebido</div>
                      <div className="text-sm font-medium text-success">{formatarMoeda(m.recebido)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="text-sm font-medium text-foreground">{formatarMoeda(m.total)}</div>
                    </div>
                    <div className="text-right min-w-[50px]">
                      <div className="text-xs text-muted-foreground">%</div>
                      <div className="text-sm font-medium text-warning">
                        {m.total > 0 ? ((m.recebido / m.total) * 100).toFixed(0) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saídas e Entradas do Período */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-success/15"><DollarSign className="h-4 w-4 text-success" /></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Entradas no Período</span>
            </div>
            <div className="font-display text-2xl text-success">{formatarMoeda(entradasPeriodo)}</div>
            <div className="text-xs text-muted-foreground mt-1">Total recebido no caixa</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-destructive/15"><ArrowDownCircle className="h-4 w-4 text-destructive" /></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Saídas no Período</span>
            </div>
            <div className="font-display text-2xl text-destructive">{formatarMoeda(saidasPeriodo)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Caixa: {formatarMoeda(saidasCaixaPeriodo)}{totalContasPagarPeriodo > 0 ? ` + Contas: ${formatarMoeda(totalContasPagarPeriodo)}` : ''}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/15"><TrendingUp className="h-4 w-4 text-primary" /></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Saldo do Período</span>
            </div>
            <div className={`font-display text-2xl ${entradasPeriodo - saidasPeriodo >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatarMoeda(entradasPeriodo - saidasPeriodo)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Entradas − Saídas</div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição de Vendas por Modalidade */}
      {distribuicaoVendas.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Distribuição de Vendas por Modalidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={distribuicaoVendas}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {distribuicaoVendas.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
                    formatter={(v: number) => formatarMoeda(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex flex-col justify-center">
                {distribuicaoVendas.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      <span className="text-sm font-medium text-foreground">{d.name}</span>
                    </div>
                    <div className="text-sm font-semibold text-foreground">{formatarMoeda(d.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caixa Extra Manual */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Lançamento Manual no Caixa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</Label>
              <Select value={caixaExtraTipo} onValueChange={(v: any) => setCaixaExtraTipo(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (Recebimento)</SelectItem>
                  <SelectItem value="saida">Saída (Despesa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Valor (R$)</Label>
              <input
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="0,00"
                value={caixaExtraValor}
                onChange={e => setCaixaExtraValor(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Descrição</Label>
              <input
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Ex: Aluguel, Combustível..."
                value={caixaExtraDesc}
                onChange={e => setCaixaExtraDesc(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCaixaExtra}
              disabled={caixaExtraMutation.isPending}
              className={caixaExtraTipo === 'entrada' ? 'bg-success hover:bg-success/90 text-white' : 'bg-destructive hover:bg-destructive/90 text-white'}
            >
              {caixaExtraTipo === 'entrada' ? <Plus className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
              {caixaExtraMutation.isPending ? 'Salvando...' : 'Lançar no Caixa'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">O lançamento será registrado no caixa do dia atual e aparecerá no fluxo de caixa.</p>
        </CardContent>
      </Card>

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
