import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Database, AlertCircle, CheckCircle, Users, FileText, DollarSign, Car, Loader2, Calendar } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

function jsonToCsv(data: any[]): string {
  if (!data || data.length === 0) return '';
  const flatten = (obj: any, prefix = ''): Record<string, any> => {
    return Object.keys(obj).reduce((acc: Record<string, any>, k) => {
      const pre = prefix ? `${prefix}_${k}` : k;
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flatten(obj[k], pre));
      } else if (Array.isArray(obj[k])) {
        acc[pre] = JSON.stringify(obj[k]);
      } else {
        acc[pre] = obj[k];
      }
      return acc;
    }, {});
  };
  const flat = data.map(r => flatten(r));
  const headers = Array.from(new Set(flat.flatMap(r => Object.keys(r))));
  const rows = flat.map(r => headers.map(h => {
    const v = r[h] ?? '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function downloadCsv(content: string, filename: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const hoje = new Date().toISOString().split('T')[0];

export default function Backup() {
  const [formato, setFormato] = useState<'csv' | 'json'>('csv');
  const [exportando, setExportando] = useState<string | null>(null);
  const [filtroModalidade, setFiltroModalidade] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState(hoje);

  const { data: clientes } = trpc.backup.exportarClientes.useQuery();
  const { data: contratos } = trpc.backup.exportarContratos.useQuery({ modalidade: 'todos' });
  const { data: vendas } = trpc.backup.exportarVendas.useQuery();

  const exportarClientesMutation = trpc.backup.exportarClientes.useQuery(undefined, { enabled: false });
  const utils = trpc.useUtils();

  const handleExportar = async (tipo: string) => {
    setExportando(tipo);
    try {
      const date = new Date().toISOString().split('T')[0];

      if (tipo === 'clientes') {
        const res = await utils.backup.exportarClientes.fetch();
        if (formato === 'csv') {
          downloadCsv(jsonToCsv(res.dados), `clientes_${date}.csv`);
        } else {
          downloadJson(res.dados, `clientes_${date}.json`);
        }
        toast.success(`${res.total} clientes exportados!`);
      }

      else if (tipo === 'contratos') {
        const res = await utils.backup.exportarContratos.fetch({ modalidade: 'todos' });
        if (formato === 'csv') {
          downloadCsv(jsonToCsv(res.dados), `contratos_${date}.csv`);
        } else {
          downloadJson(res.dados, `contratos_${date}.json`);
        }
        toast.success(`${res.total} contratos exportados!`);
      }

      else if (tipo === 'contratos_diarios') {
        const res = await utils.backup.exportarContratos.fetch({ modalidade: 'diario' });
        if (formato === 'csv') {
          downloadCsv(jsonToCsv(res.dados), `emprestimos_diarios_${date}.csv`);
        } else {
          downloadJson(res.dados, `emprestimos_diarios_${date}.json`);
        }
        toast.success(`${res.total} empréstimos diários exportados!`);
      }

      else if (tipo === 'parcelas') {
        const res = await utils.backup.exportarParcelas.fetch({
          status: filtroStatus,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        });
        if (formato === 'csv') {
          downloadCsv(jsonToCsv(res.dados), `parcelas_${date}.csv`);
        } else {
          downloadJson(res.dados, `parcelas_${date}.json`);
        }
        toast.success(`${res.total} parcelas exportadas!`);
      }

      else if (tipo === 'vendas') {
        const res = await utils.backup.exportarVendas.fetch();
        const todos = [
          ...res.produtos.map((p: any) => ({ tipo: 'produto', ...p })),
          ...res.veiculos.map((v: any) => ({ tipo: 'veiculo', ...v })),
        ];
        if (formato === 'csv') {
          downloadCsv(jsonToCsv(todos), `vendas_${date}.csv`);
        } else {
          downloadJson({ produtos: res.produtos, veiculos: res.veiculos }, `vendas_${date}.json`);
        }
        toast.success(`${todos.length} vendas exportadas!`);
      }

      else if (tipo === 'transacoes') {
        const res = await utils.backup.exportarTransacoes.fetch({
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        });
        if (formato === 'csv') {
          downloadCsv(jsonToCsv(res.dados), `transacoes_${date}.csv`);
        } else {
          downloadJson(res.dados, `transacoes_${date}.json`);
        }
        toast.success(`${res.total} transações exportadas!`);
      }

      else if (tipo === 'completo') {
        const [cRes, pRes, vRes, tRes] = await Promise.all([
          utils.backup.exportarClientes.fetch(),
          utils.backup.exportarContratos.fetch({ modalidade: 'todos' }),
          utils.backup.exportarVendas.fetch(),
          utils.backup.exportarTransacoes.fetch({}),
        ]);
        const backup = {
          dataExportacao: new Date().toISOString(),
          clientes: cRes.dados,
          contratos: pRes.dados,
          produtos: vRes.produtos,
          veiculos: vRes.veiculos,
          transacoes: tRes.dados,
        };
        downloadJson(backup, `backup_completo_cobrapro_${date}.json`);
        toast.success('Backup completo exportado!');
      }
    } catch (e: any) {
      toast.error('Erro ao exportar: ' + (e?.message || 'Tente novamente'));
    } finally {
      setExportando(null);
    }
  };

  const isLoading = (tipo: string) => exportando === tipo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Backup de Dados</h1>
        <p className="text-slate-400 mt-1">Exporte seus dados em CSV ou JSON para backup seguro</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/30 p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-400" />
            <div>
              <div className="text-blue-400 text-sm">Clientes</div>
              <div className="text-2xl font-bold text-blue-300">{clientes?.total ?? '—'}</div>
            </div>
          </div>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/30 p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-emerald-400" />
            <div>
              <div className="text-emerald-400 text-sm">Contratos</div>
              <div className="text-2xl font-bold text-emerald-300">{contratos?.total ?? '—'}</div>
            </div>
          </div>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/30 p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-purple-400" />
            <div>
              <div className="text-purple-400 text-sm">Produtos Vendidos</div>
              <div className="text-2xl font-bold text-purple-300">{vendas?.totalProdutos ?? '—'}</div>
            </div>
          </div>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30 p-4">
          <div className="flex items-center gap-3">
            <Car className="w-8 h-8 text-orange-400" />
            <div>
              <div className="text-orange-400 text-sm">Veículos</div>
              <div className="text-2xl font-bold text-orange-300">{vendas?.totalVeiculos ?? '—'}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Formato */}
      <Card className="bg-slate-800/50 border-slate-700 p-5">
        <h2 className="text-base font-semibold text-white mb-3">Formato de Exportação</h2>
        <div className="flex gap-6">
          {(['csv', 'json'] as const).map(f => (
            <label key={f} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="formato" value={f} checked={formato === f} onChange={() => setFormato(f)} className="w-4 h-4 accent-blue-500" />
              <span className="text-slate-300 font-medium">{f === 'csv' ? 'CSV (Planilha)' : 'JSON (Estruturado)'}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Filtros de Período */}
      <Card className="bg-slate-800/50 border-slate-700 p-5">
        <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" /> Filtros (para Parcelas e Transações)
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Data Início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Data Fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Status Parcelas</label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="paga">Pagas</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="atrasada">Atrasadas</SelectItem>
                <SelectItem value="vencendo_hoje">Vencendo Hoje</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Exportações Individuais */}
      <Card className="bg-slate-800/50 border-slate-700 p-5">
        <h2 className="text-base font-semibold text-white mb-4">Exportar por Módulo</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { tipo: 'clientes', label: 'Clientes', icon: Users, color: 'blue', desc: `${clientes?.total ?? 0} registros` },
            { tipo: 'contratos', label: 'Todos os Contratos', icon: FileText, color: 'emerald', desc: `${contratos?.total ?? 0} registros` },
            { tipo: 'contratos_diarios', label: 'Empréstimos Diários', icon: FileText, color: 'yellow', desc: 'Somente modalidade Diário' },
            { tipo: 'parcelas', label: 'Parcelas', icon: DollarSign, color: 'purple', desc: 'Com filtros de data e status' },
            { tipo: 'vendas', label: 'Vendas (Produtos + Veículos)', icon: Car, color: 'orange', desc: `${(vendas?.totalProdutos ?? 0) + (vendas?.totalVeiculos ?? 0)} registros` },
            { tipo: 'transacoes', label: 'Transações de Caixa', icon: Database, color: 'pink', desc: 'Com filtro de período' },
          ].map(({ tipo, label, icon: Icon, color, desc }) => (
            <div key={tipo} className={`flex items-center justify-between p-4 bg-${color}-500/10 border border-${color}-500/30 rounded-lg`}>
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 text-${color}-400`} />
                <div>
                  <div className={`font-semibold text-${color}-300 text-sm`}>{label}</div>
                  <div className="text-xs text-slate-400">{desc}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className={`border-${color}-500/50 text-${color}-400 hover:bg-${color}-500/20 gap-1.5`}
                onClick={() => handleExportar(tipo)}
                disabled={!!exportando}
              >
                {isLoading(tipo) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {isLoading(tipo) ? 'Exportando...' : 'Exportar'}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Backup Completo */}
      <Card className="bg-slate-800/50 border-slate-700 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-400" />
            <div>
              <div className="font-semibold text-white">Backup Completo</div>
              <div className="text-sm text-slate-400">Exporta todos os dados em um único arquivo JSON</div>
            </div>
          </div>
          <Button
            onClick={() => handleExportar('completo')}
            disabled={!!exportando}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {isLoading('completo') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isLoading('completo') ? 'Exportando...' : 'Backup Completo (JSON)'}
          </Button>
        </div>
      </Card>

      {/* Aviso */}
      <Card className="bg-yellow-500/10 border-yellow-500/30 p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-yellow-400">Dados Sensíveis</div>
          <p className="text-sm text-yellow-300 mt-1">
            O arquivo de backup contém informações sensíveis de clientes. Guarde-o em local seguro e não compartilhe com terceiros.
          </p>
        </div>
      </Card>
    </div>
  );
}
