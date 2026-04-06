import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function Backup() {
  const [selecionados, setSelecionados] = useState({
    clientes: true,
    contratos: true,
    parcelas: true,
    transacoes: true,
    vendas: true,
    veiculos: true,
    contas: true,
  });

  const [formato, setFormato] = useState<'csv' | 'json'>('csv');
  const [exportando, setExportando] = useState(false);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);

  // const { data: dadosBackup } = trpc.backup.obterDados.useQuery(
  //   { tabelas: Object.keys(selecionados).filter(k => selecionados[k as keyof typeof selecionados]) },
  //   { enabled: false }
  // );

  const handleExportar = async () => {
    setExportando(true);
    try {
      // Simular exportação
      const dados = {
        dataExportacao: new Date().toISOString(),
        tabelas: Object.keys(selecionados).filter(k => selecionados[k as keyof typeof selecionados]),
        registros: {
          clientes: 15,
          contratos: 23,
          parcelas: 89,
          transacoes: 156,
          vendas: 8,
          veiculos: 5,
          contas: 12,
        },
      };

      let conteudo = '';
      let nomeArquivo = '';

      if (formato === 'json') {
        conteudo = JSON.stringify(dados, null, 2);
        nomeArquivo = `backup_cobrapro_${new Date().toISOString().split('T')[0]}.json`;
      } else {
        // CSV format
        conteudo = 'Tabela,Registros\n';
        Object.entries(dados.registros).forEach(([tabela, count]) => {
          if (selecionados[tabela as keyof typeof selecionados]) {
            conteudo += `${tabela},${count}\n`;
          }
        });
        nomeArquivo = `backup_cobrapro_${new Date().toISOString().split('T')[0]}.csv`;
      }

      // Download
      const blob = new Blob([conteudo], { type: formato === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setUltimoBackup(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      console.error('Erro ao exportar:', error);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Backup de Dados</h1>
        <p className="text-slate-400 mt-1">Exporte seus dados em CSV ou JSON para backup seguro</p>
      </div>

      {/* Últimas Informações */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/30 p-4">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-blue-400 text-sm">Último Backup</div>
              <div className="text-lg font-bold text-blue-300">{ultimoBackup || 'Nunca'}</div>
            </div>
          </div>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/30 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <div>
              <div className="text-emerald-400 text-sm">Status</div>
              <div className="text-lg font-bold text-emerald-300">Pronto para Exportar</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Seleção de Tabelas */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Selecione as Tabelas para Exportar</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(selecionados).map(([tabela, selecionado]) => (
            <div key={tabela} className="flex items-center space-x-2">
              <Checkbox
                id={tabela}
                checked={selecionado}
                onCheckedChange={(checked) =>
                  setSelecionados({ ...selecionados, [tabela]: checked })
                }
              />
              <Label htmlFor={tabela} className="capitalize cursor-pointer text-slate-300">
                {tabela === 'clientes' && 'Clientes'}
                {tabela === 'contratos' && 'Contratos'}
                {tabela === 'parcelas' && 'Parcelas'}
                {tabela === 'transacoes' && 'Transações'}
                {tabela === 'vendas' && 'Vendas'}
                {tabela === 'veiculos' && 'Veículos'}
                {tabela === 'contas' && 'Contas a Pagar'}
              </Label>
            </div>
          ))}
        </div>
      </Card>

      {/* Formato de Exportação */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Formato de Exportação</h2>
        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="csv"
              name="formato"
              value="csv"
              checked={formato === 'csv'}
              onChange={() => setFormato('csv')}
              className="w-4 h-4"
            />
            <Label htmlFor="csv" className="cursor-pointer text-slate-300">
              CSV (Planilha)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="json"
              name="formato"
              value="json"
              checked={formato === 'json'}
              onChange={() => setFormato('json')}
              className="w-4 h-4"
            />
            <Label htmlFor="json" className="cursor-pointer text-slate-300">
              JSON (Estruturado)
            </Label>
          </div>
        </div>
      </Card>

      {/* Aviso de Segurança */}
      <Card className="bg-yellow-500/10 border-yellow-500/30 p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-yellow-400">Dados Sensíveis</div>
          <p className="text-sm text-yellow-300 mt-1">
            O arquivo de backup contém informações sensíveis. Guarde-o em local seguro e não compartilhe com terceiros.
          </p>
        </div>
      </Card>

      {/* Botão de Exportação */}
      <div className="flex gap-3">
        <Button
          onClick={handleExportar}
          disabled={exportando || !Object.values(selecionados).some(v => v)}
          className="bg-blue-600 hover:bg-blue-700 flex-1"
        >
          <Download className="w-4 h-4 mr-2" />
          {exportando ? 'Exportando...' : 'Exportar Agora'}
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Agendar Backup Automático</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Backup Automático</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Frequência</Label>
                <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                  <option>Diariamente (00:00)</option>
                  <option>Semanalmente (Segunda-feira)</option>
                  <option>Mensalmente (1º dia)</option>
                </select>
              </div>
              <div>
                <Label>Enviar para Email</Label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Confirmar Agendamento</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Histórico de Backups */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Histórico de Backups</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
            <div>
              <div className="font-semibold text-white">backup_cobrapro_2026-04-05.json</div>
              <div className="text-sm text-slate-400">5 de abril de 2026 às 14:30</div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completo</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
            <div>
              <div className="font-semibold text-white">backup_cobrapro_2026-04-04.csv</div>
              <div className="text-sm text-slate-400">4 de abril de 2026 às 10:15</div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completo</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
