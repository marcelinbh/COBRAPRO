import { useTranslation } from 'react-i18next';
import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart2, TrendingUp, AlertTriangle, DollarSign, Filter, ArrowDownCircle, Plus, Minus, Download, FileText, Users, Calendar, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatarMoeda } from "../../../shared/finance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CORES = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const MODALIDADE_LABELS: Record<string, string> = {
  'emprestimo_padrao': 'Empréstimo Padrão',
  'emprestimo_diario': 'Empréstimo Diário',
  'tabela_price': 'Parcela Fixa',
  'venda_produto': 'Venda de Produto',
  'desconto_cheque': 'Desconto de Cheque',
  'reparcelamento': 'Reparcelamento',
};

export default function Relatorios() {
  const { t, i18n } = useTranslation();
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
  );
  const [dataFim, setDataFim] = useState(hoje.toISOString().split('T')[0]);
  const [filtroModalidade, setFiltroModalidade] = useState('todas');
  // Filtros avançados — Empréstimos Ativos
  const [filtroValorMin, setFiltroValorMin] = useState('');
  const [filtroValorMax, setFiltroValorMax] = useState('');

  const { data: kpis } = trpc.dashboard.kpis.useQuery();
  const { data: contratos } = trpc.contratos.list.useQuery({});
  const { data: clientesData } = trpc.clientes.list.useQuery({});
  const [clienteSelecionado, setClienteSelecionado] = useState<string>('todos');
  const [expandirProjecao, setExpandirProjecao] = useState(false);
  const { data: parcelas } = trpc.parcelas.list.useQuery({});
  const { data: transacoes } = trpc.caixa.transacoes.useQuery({ limit: 1000 });
  const { data: contasCaixa } = trpc.caixa.contas.useQuery();
  const { data: contasPagarData } = trpc.contasPagar.listar.useQuery({ status: 'paga' });

  // Filtrar parcelas por período e modalidade
  // Para parcelas pagas: filtrar por data_pagamento (quando foi pago)
  // Para parcelas pendentes/atrasadas: filtrar por data_vencimento (quando vence)
  const parcelasPeriodo = (parcelas ?? []).filter(p => {
    const modalidadeOk = filtroModalidade === 'todas' || p.modalidade === filtroModalidade;
    if (!modalidadeOk) return false;
    if (p.status === 'paga' && p.dataPagamento) {
      // Usar slice para evitar problemas de timezone (data_pagamento pode ser string YYYY-MM-DD ou ISO)
      const d = String(p.dataPagamento).slice(0, 10);
      return d >= dataInicio && d <= dataFim;
    }
    const d = String(p.dataVencimento).slice(0, 10);
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
      .filter(t => t.tipo === 'entrada' && String(t.dataTransacao).slice(0, 10) === dayKey)
      .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0);
    const saidas = (transacoes ?? [])
      .filter(t => t.tipo === 'saida' && String(t.dataTransacao).slice(0, 10) === dayKey)
      .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0);
    return {
      dia: d.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'pt-BR', { day: '2-digit', month: '2-digit' }),
      entradas,
      saidas,
    };
  });

  // Modalidades disponíveis (para o seletor)
  const modalidadesDisponiveis = Array.from(new Set((parcelas ?? []).map(p => p.modalidade).filter(Boolean)));

  // Saídas no período (empréstimos concedidos + contas a pagar pagas)
  const saidasCaixaPeriodo = (transacoes ?? [])
    .filter(t => {
      const d = String(t.dataTransacao).slice(0, 10);
      return t.tipo === 'saida' && d >= dataInicio && d <= dataFim;
    })
    .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0);

  // Contas a pagar pagas no período
  const contasPagarPagas = (contasPagarData ?? []).filter((c: any) => {
    const dataPag = c.dataPagamento || c.data_pagamento;
    if (!dataPag) return false;
    const d = String(dataPag).slice(0, 10);
    return d >= dataInicio && d <= dataFim;
  });
  const totalContasPagarPeriodo = contasPagarPagas.reduce((sum: number, c: any) =>
    sum + parseFloat(String(c.valor ?? c.valorPago ?? 0)), 0);
  const saidasPeriodo = saidasCaixaPeriodo + totalContasPagarPeriodo;

  const entradasPeriodo = (transacoes ?? [])
    .filter(t => {
      const d = String(t.dataTransacao).slice(0, 10);
      return t.tipo === 'entrada' && d >= dataInicio && d <= dataFim;
    })
    .reduce((sum, t) => sum + parseFloat(String(t.valor)), 0);

  // === Empréstimos Ativos ===
  const todosEmprestimosAtivos = useMemo(() => (contratos ?? []).filter(c => c.status === 'ativo'), [contratos]);
  const emprestimosAtivos = useMemo(() => {
    const vMin = filtroValorMin !== '' ? parseFloat(filtroValorMin.replace(',', '.')) : null;
    const vMax = filtroValorMax !== '' ? parseFloat(filtroValorMax.replace(',', '.')) : null;
    return todosEmprestimosAtivos.filter(c => {
      const val = parseFloat(String(c.valorPrincipal ?? 0));
      if (vMin !== null && !isNaN(vMin) && val < vMin) return false;
      if (vMax !== null && !isNaN(vMax) && val > vMax) return false;
      return true;
    });
  }, [todosEmprestimosAtivos, filtroValorMin, filtroValorMax]);
  const capitalEmCirculacao = emprestimosAtivos.reduce((sum, c) => sum + parseFloat(String(c.valorPrincipal ?? 0)), 0);

  // === Projeção de Recebimentos (próximos 30 dias) ===
  const hojeStr = new Date().toISOString().slice(0, 10);
  const em30DiasStr = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
  const projecaoRecebimentos = useMemo(() => {
    const pendentes = (parcelas ?? []).filter(p => {
      if (p.status === 'paga' || p.status === 'cancelada') return false;
      const venc = String(p.dataVencimento).slice(0, 10);
      return venc >= hojeStr && venc <= em30DiasStr;
    });
    const semanas: Record<string, { total: number; count: number; atrasadas: number }> = {};
    pendentes.forEach(p => {
      const d = new Date(String(p.dataVencimento).slice(0, 10) + 'T00:00:00');
      const semanaInicio = new Date(d); semanaInicio.setDate(d.getDate() - d.getDay());
      const key = semanaInicio.toISOString().slice(0, 10);
      if (!semanas[key]) semanas[key] = { total: 0, count: 0, atrasadas: 0 };
      semanas[key].total += parseFloat(String(p.valorOriginal ?? 0));
      semanas[key].count += 1;
      if (p.status === 'atrasada') semanas[key].atrasadas += 1;
    });
    return Object.entries(semanas).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => ({ semana: key, ...val }));
  }, [parcelas, hojeStr, em30DiasStr]);
  const totalProjecao30Dias = projecaoRecebimentos.reduce((sum, s) => sum + s.total, 0);

  // === Extrato por Cliente ===
  const parcelasCliente = useMemo(() => {
    if (clienteSelecionado === 'todos') return [];
    const cid = parseInt(clienteSelecionado);
    return (parcelas ?? []).filter(p => (p.clienteId ?? (p as any).cliente_id) === cid)
      .sort((a, b) => String(a.dataVencimento).localeCompare(String(b.dataVencimento)));
  }, [parcelas, clienteSelecionado]);
  const totalClienteRecebido = parcelasCliente.filter(p => p.status === 'paga').reduce((sum, p) => sum + parseFloat(String(p.valorPago ?? p.valorOriginal ?? 0)), 0);
  const totalClientePendente = parcelasCliente.filter(p => p.status !== 'paga' && p.status !== 'cancelada').reduce((sum, p) => sum + parseFloat(String(p.valorOriginal ?? 0)), 0);

  // Exportar Extrato por Cliente em PDF
  const exportarExtratoPDF = () => {
    if (clienteSelecionado === 'todos' || parcelasCliente.length === 0) {
      toast.error('Selecione um cliente com parcelas para exportar');
      return;
    }
    const clienteNome = (clientesData?.clientes ?? []).find((c: any) => String(c.id) === clienteSelecionado)?.nome ?? 'Cliente';
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Extrato do Cliente: ${clienteNome}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    doc.text(`Total Recebido: ${formatarMoeda(totalClienteRecebido)}  |  Pendente: ${formatarMoeda(totalClientePendente)}  |  Parcelas: ${parcelasCliente.length}`, 14, 35);
    autoTable(doc, {
      startY: 42,
      head: [['Parcela', 'Vencimento', 'Valor', 'Status', 'Pago em', 'Valor Pago']],
      body: parcelasCliente.map(p => {
        const statusLabel = p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : p.status === 'vencendo_hoje' ? 'Vence Hoje' : p.status === 'parcial' ? 'Parcial' : 'Pendente';
        return [
          String(p.numeroParcela ?? '-'),
          new Date(String(p.dataVencimento).slice(0,10)+'T00:00:00').toLocaleDateString('pt-BR'),
          formatarMoeda(parseFloat(String(p.valorOriginal ?? 0))),
          statusLabel,
          p.dataPagamento ? new Date(String(p.dataPagamento).slice(0,10)+'T00:00:00').toLocaleDateString('pt-BR') : '-',
          p.valorPago ? formatarMoeda(parseFloat(String(p.valorPago))) : '-',
        ];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    doc.save(`extrato_${clienteNome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };
  // Distribuição de vendas por modalidade (gráfico de pizza)
  const distribuicaoVendas = Object.entries(modalidadesMap).map(([key, val], idx) => ({
    name: MODALIDADE_LABELS[key] ?? key,
    value: val.total,
    color: CORES[idx % CORES.length],
  })).filter(d => d.value > 0);

  // Caixa Extra manual
  // Exportar PDF do relatório
  function exportarRelatorioPDF() {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    // Header
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('COBRAPRO', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('Relatório Operacional', 14, 20);
    doc.text(`Período: ${dataInicio} a ${dataFim}`, pageW - 14, 20, { align: 'right' });
    doc.text(`Gerado em: ${new Date().toLocaleString(i18n.language === 'es' ? 'es-ES' : 'pt-BR')}`, pageW - 14, 12, { align: 'right' });
    // KPIs
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo do Período', 14, 38);
    const kpiRows = [
      ['Recebido no Período', `R$ ${recebidoPeriodo.toFixed(2).replace('.', ',')}`],
      ['Total Previsto', `R$ ${totalPeriodo.toFixed(2).replace('.', ',')}`],
      ['Inadimplência', `R$ ${inadimplentePeriodo.toFixed(2).replace('.', ',')}`],
      ['Taxa de Recebimento', `${totalPeriodo > 0 ? ((recebidoPeriodo / totalPeriodo) * 100).toFixed(1) : 0}%`],
      ['Entradas no Caixa', `R$ ${entradasPeriodo.toFixed(2).replace('.', ',')}`],
      ['Saídas no Caixa', `R$ ${saidasPeriodo.toFixed(2).replace('.', ',')}`],
      ['Saldo do Período', `R$ ${(entradasPeriodo - saidasPeriodo).toFixed(2).replace('.', ',')}`],
    ];
    autoTable(doc, {
      startY: 42,
      head: [['Indicador', 'Valor']],
      body: kpiRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 15, 15], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    });
    // Parcelas por modalidade
    if (modalidadesData.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? 80;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Recebimentos por Modalidade', 14, finalY + 10);
      autoTable(doc, {
        startY: finalY + 14,
        head: [['Modalidade', 'Parcelas', 'Recebido', 'Total Previsto', 'Taxa']],
        body: modalidadesData.map(m => [
          m.name,
          String(m.parcelas),
          `R$ ${m.recebido.toFixed(2).replace('.', ',')}`,
          `R$ ${m.total.toFixed(2).replace('.', ',')}`,
          `${m.total > 0 ? ((m.recebido / m.total) * 100).toFixed(0) : 0}%`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 15, 15], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      });
    }
    // Parcelas detalhadas
    if (parcelasPeriodo.length > 0) {
      const finalY2 = (doc as any).lastAutoTable?.finalY ?? 120;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Parcelas do Período', 14, finalY2 + 10);
      autoTable(doc, {
        startY: finalY2 + 14,
        head: [['Cliente', 'Vencimento', 'Valor', 'Status', 'Pago em']],
        body: parcelasPeriodo.slice(0, 100).map(p => [
          p.clienteNome ?? '-',
          new Date(p.dataVencimento).toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'pt-BR'),
          `R$ ${parseFloat(p.valorOriginal).toFixed(2).replace('.', ',')}`,
          p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : p.status === 'pendente' ? 'Pendente' : p.status,
          p.dataPagamento ? new Date(p.dataPagamento).toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'pt-BR') : '-',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 15, 15], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      });
    }
    doc.save(`relatorio-${dataInicio}-a-${dataFim}.pdf`);
  }

  const [caixaExtraValor, setCaixaExtraValor] = useState('');
  const [caixaExtraDesc, setCaixaExtraDesc] = useState('');
  const [caixaExtraTipo, setCaixaExtraTipo] = useState<'entrada' | 'saida'>('entrada');
  const utils = trpc.useUtils();
  const caixaExtraMutation = trpc.caixa.registrarTransacao.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.lançamento_registrado_no_caixa'));
      setCaixaExtraValor('');
      setCaixaExtraDesc('');
      utils.caixa.transacoes.invalidate();
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  function handleCaixaExtra() {
    const valor = parseFloat(caixaExtraValor.replace(',', '.'));
    if (!valor || valor <= 0) { toast.error(t('toast_error.informe_um_valor_válido')); return; }
    if (!caixaExtraDesc.trim()) { toast.error(t('toast_error.informe_uma_descrição')); return; }
    const contaId = contasCaixa?.[0]?.id;
    if (!contaId) { toast.error(t('toast_error.nenhuma_conta_caixa_encontrada_crie_uma_')); return; }
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
        <h1 className="font-display text-3xl text-foreground tracking-wide">{t('reports.title').toUpperCase()}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('reports.subtitle')}</p>
      </div>

      {/* Botão Exportar PDF */}
      <div className="flex justify-end">
        <button
          onClick={exportarRelatorioPDF}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          Exportar Relatório PDF
        </button>
      </div>

      {/* Filtros */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('reports.startDate')}</Label>
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
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('relatorios.defaulters')}</span>
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
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('reports.delinquencyRate')}</span>
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
                <Bar dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} name={t('reports.expenses')} />
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
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('reports.description')}</Label>
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
          <p className="text-xs text-muted-foreground mt-2">{t('reports.entryWillBeRegistered')}</p>
        </CardContent>
      </Card>

      {/* === Empréstimos Ativos === */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Empréstimos Ativos
              {(filtroValorMin !== '' || filtroValorMax !== '') && (
                <span className="ml-2 text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {emprestimosAtivos.length} de {todosEmprestimosAtivos.length}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Capital:</span>
              <input
                type="number"
                placeholder="Mín (R$)"
                value={filtroValorMin}
                onChange={e => setFiltroValorMin(e.target.value)}
                className="h-7 w-24 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <input
                type="number"
                placeholder="Máx (R$)"
                value={filtroValorMax}
                onChange={e => setFiltroValorMax(e.target.value)}
                className="h-7 w-24 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {(filtroValorMin !== '' || filtroValorMax !== '') && (
                <button
                  onClick={() => { setFiltroValorMin(''); setFiltroValorMax(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Limpar filtros"
                >
                  × Limpar
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Ativos</div>
              <div className="font-display text-2xl text-foreground">{emprestimosAtivos.length}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Capital em Circulação</div>
              <div className="font-display text-xl text-warning">{formatarMoeda(capitalEmCirculacao)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Média por Contrato</div>
              <div className="font-display text-xl text-foreground">{formatarMoeda(emprestimosAtivos.length > 0 ? capitalEmCirculacao / emprestimosAtivos.length : 0)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Inadimplentes</div>
              <div className="font-display text-xl text-destructive">{(parcelas ?? []).filter(p => p.status === 'atrasada').length} parcelas</div>
            </div>
          </div>
          {emprestimosAtivos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Cliente</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Modalidade</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Capital</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Taxa</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Parcelas</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Início</th>
                  </tr>
                </thead>
                <tbody>
                  {emprestimosAtivos.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground">{c.clienteNome}</td>
                      <td className="py-2 px-3 text-muted-foreground">{MODALIDADE_LABELS[c.modalidade ?? ''] ?? c.modalidade}</td>
                      <td className="py-2 px-3 text-right font-semibold text-warning">{formatarMoeda(parseFloat(String(c.valorPrincipal ?? 0)))}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{c.taxaJuros}%</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{c.numeroParcelas}x</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.dataInicio ? new Date(String(c.dataInicio).slice(0,10)+'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum empréstimo ativo encontrado</div>
          )}
        </CardContent>
      </Card>

      {/* === Projeção de Recebimentos (30 dias) === */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Projeção de Recebimentos — Próximos 30 Dias
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setExpandirProjecao(v => !v)} className="text-xs text-muted-foreground">
              {expandirProjecao ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expandirProjecao ? 'Recolher' : 'Ver detalhes'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Previsto (30 dias)</div>
              <div className="font-display text-xl text-success">{formatarMoeda(totalProjecao30Dias)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Parcelas a Vencer</div>
              <div className="font-display text-xl text-foreground">{projecaoRecebimentos.reduce((s, w) => s + w.count, 0)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Semanas com Recebimento</div>
              <div className="font-display text-xl text-foreground">{projecaoRecebimentos.length}</div>
            </div>
          </div>
          {projecaoRecebimentos.length > 0 ? (
            <div className="space-y-2">
              {projecaoRecebimentos.map(s => (
                <div key={s.semana} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Semana de {new Date(s.semana + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.count} parcela{s.count !== 1 ? 's' : ''}{s.atrasadas > 0 ? ` · ${s.atrasadas} atrasada${s.atrasadas !== 1 ? 's' : ''}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-success">{formatarMoeda(s.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma parcela a vencer nos próximos 30 dias</div>
          )}
        </CardContent>
      </Card>

      {/* === Extrato por Cliente === */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4" />
              Extrato por Cliente
            </CardTitle>
            {clienteSelecionado !== 'todos' && parcelasCliente.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportarExtratoPDF} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Selecionar Cliente</Label>
            <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
              <SelectTrigger className="mt-1 max-w-xs">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">— Selecione um cliente —</SelectItem>
                {(clientesData?.clientes ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {clienteSelecionado !== 'todos' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Recebido</div>
                  <div className="font-display text-xl text-success">{formatarMoeda(totalClienteRecebido)}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pendente</div>
                  <div className="font-display text-xl text-warning">{formatarMoeda(totalClientePendente)}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total de Parcelas</div>
                  <div className="font-display text-xl text-foreground">{parcelasCliente.length}</div>
                </div>
              </div>
              {parcelasCliente.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Parcela</th>
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Vencimento</th>
                        <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Valor</th>
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Pago em</th>
                        <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase tracking-wide">Valor Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasCliente.map(p => {
                        const statusColor = p.status === 'paga' ? 'text-success' : p.status === 'atrasada' ? 'text-destructive' : p.status === 'vencendo_hoje' ? 'text-warning' : 'text-muted-foreground';
                        const statusLabel = p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : p.status === 'vencendo_hoje' ? 'Vence Hoje' : p.status === 'parcial' ? 'Parcial' : 'Pendente';
                        return (
                          <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="py-2 px-3 text-muted-foreground">{p.numeroParcela ?? '-'}</td>
                            <td className="py-2 px-3 text-foreground">{new Date(String(p.dataVencimento).slice(0,10)+'T00:00:00').toLocaleDateString('pt-BR')}</td>
                            <td className="py-2 px-3 text-right font-semibold text-foreground">{formatarMoeda(parseFloat(String(p.valorOriginal ?? 0)))}</td>
                            <td className={`py-2 px-3 font-medium ${statusColor}`}>{statusLabel}</td>
                            <td className="py-2 px-3 text-muted-foreground">{p.dataPagamento ? new Date(String(p.dataPagamento).slice(0,10)+'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                            <td className="py-2 px-3 text-right text-success">{p.valorPago ? formatarMoeda(parseFloat(String(p.valorPago))) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma parcela encontrada para este cliente</div>
              )}
            </>
          )}
          {clienteSelecionado === 'todos' && (
            <div className="text-center py-8 text-muted-foreground text-sm">Selecione um cliente para ver o extrato completo</div>
          )}
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
