import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Car, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';

export default function Veiculos() {
  const { t } = useTranslation();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'quitado'>('todos');
  const [novoVeiculo, setNovoVeiculo] = useState({
    marca: '',
    modelo: '',
    placa: '',
    renavam: '',
    chassi: '',
    comprador: '',
    telefone: '',
    cpf: '',
    email: '',
    valor: '',
    entrada: '',
    parcelas: '12',
    primeiroVencimento: '',
  });

  // KPIs simulados
  const kpis = {
    total: 8,
    quitados: 3,
    recebido: 15000,
    lucroTotal: 2500,
  };

  const handleNovoVeiculo = () => {
    console.log('Novo veículo:', novoVeiculo);
    // Aqui seria feito o POST para criar o veículo
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('vehicles.title')}</h1>
          <p className="text-slate-400 mt-1">{t('vehicles.subtitle')}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              {t('vehicles.newVehicle')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('vehicles.registerNew')}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">{t('vehicles.vehicleData')}</TabsTrigger>
                <TabsTrigger value="comprador">{t('vehicles.buyer')}</TabsTrigger>
                <TabsTrigger value="financeiro">{t('vehicles.financial')}</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('vehicles.brand')}</Label>
                    <Input
                      placeholder="Ex: Toyota"
                      value={novoVeiculo.marca}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, marca: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('vehicles.model')}</Label>
                    <Input
                      placeholder="Ex: Corolla"
                      value={novoVeiculo.modelo}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, modelo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('vehicles.plate')}</Label>
                    <Input
                      placeholder="ABC-1234"
                      value={novoVeiculo.placa}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, placa: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('vehicles.renavam')}</Label>
                    <Input
                      placeholder="00000000000"
                      value={novoVeiculo.renavam}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, renavam: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>{t('vehicles.chassis')}</Label>
                    <Input
                      placeholder={t('vehicles.chassisPlaceholder')}
                      value={novoVeiculo.chassi}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, chassi: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comprador" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>{t('vehicles.buyerName')}</Label>
                    <Input
                      placeholder={t('vehicles.fullName')}
                      value={novoVeiculo.comprador}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, comprador: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('common.cpf')}</Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={novoVeiculo.cpf}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, cpf: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('common.phone')}</Label>
                    <Input
                      placeholder="(11) 99999-9999"
                      value={novoVeiculo.telefone}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, telefone: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>{t('common.email')}</Label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={novoVeiculo.email}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, email: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="financeiro" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('vehicles.totalValue')}</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={novoVeiculo.valor}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, valor: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('vehicles.downPayment')}</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={novoVeiculo.entrada}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, entrada: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('vehicles.installments')}</Label>
                    <Input
                      type="number"
                      value={novoVeiculo.parcelas}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, parcelas: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('vehicles.firstDueDate')}</Label>
                    <Input
                      type="date"
                      value={novoVeiculo.primeiroVencimento}
                      onChange={(e) => setNovoVeiculo({ ...novoVeiculo, primeiroVencimento: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 justify-end">
              <Button variant="outline">{t('common.cancel')}</Button>
              <Button onClick={handleNovoVeiculo} className="bg-blue-600 hover:bg-blue-700">
                {t('vehicles.registerVehicle')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-sm">{t('vehicles.totalVehicles')}</div>
              <div className="text-2xl font-bold text-white mt-2">{kpis.total}</div>
            </div>
            <Car className="w-8 h-8 text-slate-600" />
          </div>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-400 text-sm">{t('vehicles.settled')}</div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">{kpis.quitados}</div>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-400 text-sm">{t('vehicles.received')}</div>
              <div className="text-2xl font-bold text-blue-400 mt-2">{kpis.recebido.toLocaleString('pt-BR')}</div>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-yellow-400 text-sm">{t('vehicles.totalProfit')}</div>
              <div className="text-2xl font-bold text-yellow-400 mt-2">{kpis.lucroTotal.toLocaleString('pt-BR')}</div>
            </div>
            <TrendingUp className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <Input
          placeholder={t('vehicles.searchPlaceholder')}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1"
        />
        <Select value={filtroStatus} onValueChange={(value: any) => setFiltroStatus(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{t('common.all')}</SelectItem>
            <SelectItem value="ativo">{t('vehicles.inProgress')}</SelectItem>
            <SelectItem value="quitado">{t('vehicles.settled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Listagem de Veículos */}
      <div className="space-y-3">
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-semibold text-white">Toyota Corolla 2022</div>
              <div className="text-sm text-slate-400">{t('vehicles.plate')}: ABC-1234 | {t('vehicles.buyer')}: João Silva</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white">R$ 85.000,00</div>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{t('vehicles.inProgress')}</Badge>
            </div>
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-semibold text-white">Honda Civic 2021</div>
              <div className="text-sm text-slate-400">{t('vehicles.plate')}: XYZ-9876 | {t('vehicles.buyer')}: Maria Santos</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white">R$ 75.000,00</div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t('vehicles.settled')}</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
