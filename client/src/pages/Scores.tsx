import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function Scores() {
  const { t } = useTranslation();
  const [ordenarPor, setOrdenarPor] = useState<'score' | 'lucro' | 'nome'>('score');
  const { data, isLoading } = trpc.clientes.listarComScore.useQuery({ ordenarPor });

  const getBadgeColor = (score: number) => {
    if (score >= 100) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 70) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (score >= 40) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getInitials = (nome: string) => {
    return nome
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (score: number) => {
    if (score >= 100) return 'bg-emerald-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const clientes = data?.clientes || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Score de Clientes</h1>
          <p className="text-slate-400 mt-1">Ranking de confiabilidade e desempenho</p>
        </div>
        <Select value={ordenarPor} onValueChange={(value: any) => setOrdenarPor(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Ordenar por Score</SelectItem>
            <SelectItem value="lucro">Ordenar por Lucro</SelectItem>
            <SelectItem value="nome">Ordenar por Nome</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="text-slate-400 text-sm">Total de Clientes</div>
          <div className="text-2xl font-bold text-white mt-2">{clientes.length}</div>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/30 p-4">
          <div className="text-emerald-400 text-sm">Excelentes (100+)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {clientes.filter((c: any) => c.score >= 100).length}
          </div>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30 p-4">
          <div className="text-blue-400 text-sm">Bons (70-99)</div>
          <div className="text-2xl font-bold text-blue-400 mt-2">
            {clientes.filter((c: any) => c.score >= 70 && c.score < 100).length}
          </div>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30 p-4">
          <div className="text-red-400 text-sm">Ruim (&lt;40)</div>
          <div className="text-2xl font-bold text-red-400 mt-2">
            {clientes.filter((c: any) => c.score < 40).length}
          </div>
        </Card>
      </div>

      {/* Ranking */}
      <div className="space-y-3">
        {clientes.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
            <p className="text-slate-400">Nenhum cliente encontrado</p>
          </Card>
        ) : (
          clientes.map((cliente: any, idx: number) => (
            <Card key={cliente.id} className="bg-slate-800/50 border-slate-700 p-4 hover:bg-slate-800/70 transition">
              <div className="flex items-center justify-between">
                {/* Posição + Avatar + Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-2xl font-bold text-slate-500 w-8 text-center">#{idx + 1}</div>
                  <Avatar className={`${getAvatarColor(cliente.score)}`}>
                    <AvatarFallback className="bg-inherit text-white font-bold">
                      {getInitials(cliente.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{cliente.nome}</div>
                    <div className="text-sm text-slate-400">{cliente.cpfCnpj || 'Sem CPF'}</div>
                  </div>
                </div>

                {/* Score + Badge */}
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">{cliente.score}</div>
                    <div className="text-xs text-slate-400">pontos</div>
                  </div>
                  <Badge className={`${getBadgeColor(cliente.score)} border`}>{cliente.badge}</Badge>
                </div>

                {/* Estatísticas */}
                <div className="flex gap-4 ml-6 text-sm">
                  <div className="text-center">
                    <div className="text-emerald-400 font-semibold">{cliente.parcelasQuitadas}</div>
                    <div className="text-slate-400 text-xs">Quitadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-blue-400 font-semibold">{cliente.parcelasEmDia}</div>
                    <div className="text-slate-400 text-xs">Em Dia</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-400 font-semibold">{cliente.parcelasAtrasadas}</div>
                    <div className="text-slate-400 text-xs">Atrasadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-semibold">R$ {(cliente.lucroGerado || 0).toFixed(2)}</div>
                    <div className="text-slate-400 text-xs">Lucro</div>
                  </div>
                  <div className="text-center">
                    <div className="text-purple-400 font-semibold">{cliente.taxaAdimplencia ?? 0}%</div>
                    <div className="text-slate-400 text-xs">Adimpl.</div>
                  </div>
                  {(cliente.pontosRecuperacao ?? 0) > 0 && (
                    <div className="text-center">
                      <div className="text-orange-400 font-semibold">+{cliente.pontosRecuperacao}</div>
                      <div className="text-slate-400 text-xs">Recup.</div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
