import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Tv2, Plus, Search, DollarSign, Users, XCircle, CheckCircle2,
  CreditCard, Calendar, ChevronDown, ChevronUp, Pencil, Trash2, AlertCircle
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ativa: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  inadimplente: 'bg-red-500/20 text-red-400 border-red-500/30',
  suspensa: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelada: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  ativa: 'Ativa',
  inadimplente: 'Inadimplente',
  suspensa: 'Suspensa',
  cancelada: 'Cancelada',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getMesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Assinaturas() {
  const { t } = useTranslation();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativa' | 'inadimplente' | 'suspensa' | 'cancelada'>('todas');
  const [modalCriar, setModalCriar] = useState(false);
  const [modalPagar, setModalPagar] = useState<number | null>(null);
  const [modalEditar, setModalEditar] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form states
  const [form, setForm] = useState({
    clienteId: '',
    servico: '',
    descricao: '',
    valorMensal: '',
    diaVencimento: '10',
    dataInicio: new Date().toISOString().split('T')[0],
    observacoes: '',
  });
  const [formPagamento, setFormPagamento] = useState({
    valorPago: '',
    mesReferencia: getMesAtual(),
    observacoes: '',
  });

  // Queries
  const utils = trpc.useUtils();
  const { data: assinaturas = [], isLoading } = trpc.assinaturas.list.useQuery({
    status: filtroStatus,
    busca: busca || undefined,
  });
  const { data: kpis } = trpc.assinaturas.kpis.useQuery();
  const { data: clientesData } = trpc.clientes.list.useQuery({ ativo: true, busca: '' });
  const clientes: any[] = Array.isArray((clientesData as any)?.clientes)
    ? (clientesData as any).clientes
    : Array.isArray(clientesData) ? clientesData as any[] : [];
  const { data: contas = [] } = trpc.caixa.contas.useQuery();
  const { data: pagamentosExpanded } = trpc.assinaturas.pagamentos.useQuery(
    { assinaturaId: expandedId! },
    { enabled: !!expandedId }
  );

  // Mutations
  const criarMutation = trpc.assinaturas.criar.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.assinatura_criada_com_sucesso'));
      utils.assinaturas.list.invalidate();
      utils.assinaturas.kpis.invalidate();
      setModalCriar(false);
      setForm({ clienteId: '', servico: '', descricao: '', valorMensal: '', diaVencimento: '10', dataInicio: new Date().toISOString().split('T')[0], observacoes: '' });
    },
    onError: (e) => toast.error('Erro ao criar: ' + e.message),
  });

  const pagarMutation = trpc.assinaturas.registrarPagamento.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.pagamento_registrado'));
      utils.assinaturas.list.invalidate();
      utils.assinaturas.kpis.invalidate();
      if (expandedId) utils.assinaturas.pagamentos.invalidate({ assinaturaId: expandedId });
      setModalPagar(null);
      setFormPagamento({ valorPago: '', mesReferencia: getMesAtual(), observacoes: '' });
    },
    onError: (e) => toast.error('Erro ao registrar pagamento: ' + e.message),
  });

  const atualizarMutation = trpc.assinaturas.atualizar.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.assinatura_atualizada'));
      utils.assinaturas.list.invalidate();
      utils.assinaturas.kpis.invalidate();
      setModalEditar(null);
    },
    onError: (e) => toast.error('Erro ao atualizar: ' + e.message),
  });

  const deletarMutation = trpc.assinaturas.deletar.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.assinatura_removida'));
      utils.assinaturas.list.invalidate();
      utils.assinaturas.kpis.invalidate();
    },
    onError: (e) => toast.error('Erro ao remover: ' + e.message),
  });

  const handleCriar = () => {
    if (!form.clienteId || !form.servico || !form.valorMensal) {
      toast.error(t('toast_error.preencha_cliente_serviço_e_valor_mensal'));
      return;
    }
    criarMutation.mutate({
      clienteId: parseInt(form.clienteId),
      servico: form.servico,
      descricao: form.descricao || undefined,
      valorMensal: parseFloat(form.valorMensal),
      diaVencimento: parseInt(form.diaVencimento),
      dataInicio: form.dataInicio,
      observacoes: form.observacoes || undefined,
    });
  };

  const handlePagar = (assinatura: any) => {
    if (!formPagamento.valorPago) {
      toast.error(t('toast_error.informe_o_valor_pago'));
      return;
    }
    pagarMutation.mutate({
      assinaturaId: assinatura.id,
      clienteId: assinatura.cliente_id,
      valorPago: parseFloat(formPagamento.valorPago),
      mesReferencia: formPagamento.mesReferencia,
      observacoes: formPagamento.observacoes || undefined,
    });
  };

  const assinaturaParaPagar = useMemo(() => {
    if (!modalPagar) return null;
    return assinaturas.find((a: any) => a.id === modalPagar);
  }, [modalPagar, assinaturas]);

  // Verificar se as tabelas existem (se der erro de relação, mostrar banner)
  const tabelasNaoExistem = isLoading === false && (assinaturas as any)?.error?.message?.includes('relation') || false;

  return (
    <div className="space-y-6">
      {/* Banner de configuração inicial */}
      {tabelasNaoExistem && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-amber-300 font-medium text-sm">{t('subscriptions.setupRequired')}</p>
            <p className="text-amber-400/80 text-xs mt-1">Para usar o módulo de Assinaturas, execute o SQL abaixo no <strong>Supabase Dashboard → SQL Editor</strong>:</p>
            <pre className="mt-2 text-[10px] bg-black/30 rounded p-2 text-amber-300 overflow-x-auto whitespace-pre-wrap">CREATE TABLE IF NOT EXISTS assinaturas (id BIGSERIAL PRIMARY KEY, cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE, servico TEXT NOT NULL, descricao TEXT, valor_mensal NUMERIC(10,2) NOT NULL, dia_vencimento INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'ativa', data_inicio DATE NOT NULL DEFAULT CURRENT_DATE, data_fim DATE, observacoes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pagamentos_assinatura (id BIGSERIAL PRIMARY KEY, assinatura_id BIGINT NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE, valor_pago NUMERIC(10,2) NOT NULL, data_pagamento TIMESTAMPTZ DEFAULT NOW(), mes_referencia TEXT NOT NULL, forma_pagamento TEXT DEFAULT 'dinheiro', observacoes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());</pre>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Tv2 className="text-purple-400" size={32} />
            Assinaturas / IPTV
          </h1>
          <p className="text-slate-400 mt-1">{t('subscriptions.manageSubscriptions')}</p>
        </div>
        <Button
          onClick={() => setModalCriar(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
        >
          <Plus size={16} />
          Nova Assinatura
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Tv2 className="text-purple-400" size={20} />
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-white">{kpis?.total ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="text-emerald-400" size={20} />
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide">Ativas</p>
                <p className="text-2xl font-bold text-emerald-400">{kpis?.ativas ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertCircle className="text-red-400" size={20} />
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide">Inadimplentes</p>
                <p className="text-2xl font-bold text-red-400">{kpis?.inadimplentes ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <DollarSign className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide">Receita/Mês</p>
                <p className="text-xl font-bold text-blue-400">{fmt(kpis?.receitaMensal ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                placeholder="Buscar por cliente ou serviço..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="inadimplente">Inadimplentes</SelectItem>
                <SelectItem value="suspensa">Suspensas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : assinaturas.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center">
              <Tv2 className="mx-auto text-slate-600 mb-3" size={40} />
              <p className="text-slate-400">Nenhuma assinatura encontrada</p>
              <p className="text-slate-500 text-sm mt-1">
                {filtroStatus !== 'todas' ? 'Tente mudar o filtro de status' : 'Clique em "Nova Assinatura" para começar'}
              </p>
            </CardContent>
          </Card>
        ) : (
          assinaturas.map((a: any) => (
            <Card key={a.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-purple-500/20 shrink-0">
                      <Tv2 className="text-purple-400" size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white truncate">{a.servico}</span>
                        <Badge className={`text-xs border ${STATUS_COLORS[a.status] || ''}`}>
                          {STATUS_LABELS[a.status] || a.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {a.clientes?.nome}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          Dia {a.dia_vencimento}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-white">{fmt(parseFloat(a.valor_mensal))}</p>
                    <p className="text-xs text-slate-400">/mês</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.status !== 'cancelada' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/20 gap-1"
                        onClick={() => {
                          setModalPagar(a.id);
                          setFormPagamento({ valorPago: a.valor_mensal, mesReferencia: getMesAtual(), observacoes: '' });
                        }}
                      >
                        <CreditCard size={14} />
                        Pagar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setModalEditar(a)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-400"
                      onClick={() => {
                        if (confirm('Remover esta assinatura?')) {
                          deletarMutation.mutate({ id: a.id });
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    >
                      {expandedId === a.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </Button>
                  </div>
                </div>

                {/* Histórico de pagamentos expandido */}
                {expandedId === a.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-sm font-medium text-slate-300 mb-3">Histórico de Pagamentos</p>
                    {!pagamentosExpanded || pagamentosExpanded.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum pagamento registrado</p>
                    ) : (
                      <div className="space-y-2">
                        {pagamentosExpanded.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-sm bg-slate-700/50 rounded px-3 py-2">
                            <span className="text-slate-300">{p.mes_referencia}</span>
                            <span className="text-emerald-400 font-medium">{fmt(parseFloat(p.valor_pago))}</span>
                            <span className="text-slate-500">{new Date(p.data_pagamento).toLocaleDateString('pt-BR')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {a.observacoes && (
                      <p className="text-xs text-slate-500 mt-2">Obs: {a.observacoes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal: Nova Assinatura */}
      <Dialog open={modalCriar} onOpenChange={setModalCriar}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv2 size={20} className="text-purple-400" />
              Nova Assinatura
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Cliente *</Label>
              <Select value={form.clienteId} onValueChange={(v) => setForm(f => ({ ...f, clienteId: v }))}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clientes as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Serviço / Plano *</Label>
              <Input
                placeholder="Ex: IPTV Premium, Netflix, Spotify..."
                value={form.servico}
                onChange={(e) => setForm(f => ({ ...f, servico: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Valor Mensal (R$) *</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={form.valorMensal}
                  onChange={(e) => setForm(f => ({ ...f, valorMensal: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300">Dia de Vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaVencimento}
                  onChange={(e) => setForm(f => ({ ...f, diaVencimento: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Data de Início</Label>
              <Input
                type="date"
                value={form.dataInicio}
                onChange={(e) => setForm(f => ({ ...f, dataInicio: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">{t('subscriptions.description')}</Label>
              <Textarea
                placeholder="Detalhes do plano..."
                value={form.descricao}
                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
                rows={2}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setModalCriar(false)} className="flex-1 border-slate-600">
                Cancelar
              </Button>
              <Button
                onClick={handleCriar}
                disabled={criarMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {criarMutation.isPending ? 'Criando...' : 'Criar Assinatura'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Registrar Pagamento */}
      <Dialog open={!!modalPagar} onOpenChange={(o) => !o && setModalPagar(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard size={20} className="text-emerald-400" />
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>
          {assinaturaParaPagar && (
            <div className="space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-white font-medium">{assinaturaParaPagar.servico}</p>
                <p className="text-slate-400 text-sm">{(assinaturaParaPagar as any).clientes?.nome}</p>
                <p className="text-purple-400 text-sm mt-1">Valor mensal: {fmt(parseFloat(assinaturaParaPagar.valor_mensal))}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">Valor Pago (R$) *</Label>
                  <Input
                    type="number"
                    value={formPagamento.valorPago}
                    onChange={(e) => setFormPagamento(f => ({ ...f, valorPago: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Mês de Referência</Label>
                  <Input
                    type="month"
                    value={formPagamento.mesReferencia}
                    onChange={(e) => setFormPagamento(f => ({ ...f, mesReferencia: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">{t('subscriptions.observations')}</Label>
                <Input
                  placeholder="Opcional..."
                  value={formPagamento.observacoes}
                  onChange={(e) => setFormPagamento(f => ({ ...f, observacoes: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setModalPagar(null)} className="flex-1 border-slate-600">
                  Cancelar
                </Button>
                <Button
                  onClick={() => handlePagar(assinaturaParaPagar)}
                  disabled={pagarMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {pagarMutation.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Assinatura */}
      <Dialog open={!!modalEditar} onOpenChange={(o) => !o && setModalEditar(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={20} className="text-blue-400" />
              Editar Assinatura
            </DialogTitle>
          </DialogHeader>
          {modalEditar && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Status</Label>
                <Select
                  value={modalEditar.status}
                  onValueChange={(v) => setModalEditar((e: any) => ({ ...e, status: v }))}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="suspensa">Suspensa</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Valor Mensal (R$)</Label>
                <Input
                  type="number"
                  value={modalEditar.valor_mensal}
                  onChange={(e) => setModalEditar((ed: any) => ({ ...ed, valor_mensal: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300">Dia de Vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={modalEditar.dia_vencimento}
                  onChange={(e) => setModalEditar((ed: any) => ({ ...ed, dia_vencimento: parseInt(e.target.value) }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300">{t('subscriptions.observations')}</Label>
                <Textarea
                  value={modalEditar.observacoes || ''}
                  onChange={(e) => setModalEditar((ed: any) => ({ ...ed, observacoes: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setModalEditar(null)} className="flex-1 border-slate-600">
                  Cancelar
                </Button>
                <Button
                  onClick={() => atualizarMutation.mutate({
                    id: modalEditar.id,
                    status: modalEditar.status,
                    valorMensal: parseFloat(modalEditar.valor_mensal),
                    diaVencimento: modalEditar.dia_vencimento,
                    observacoes: modalEditar.observacoes,
                  })}
                  disabled={atualizarMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {atualizarMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
