import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TrendingDown, Phone, MessageCircle, ChevronDown, ChevronUp, AlertTriangle, Users, DollarSign, Calendar } from "lucide-react";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatarData(data: string) {
  if (!data) return "-";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function getBadgeDias(dias: number) {
  if (dias <= 7) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (dias <= 30) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export default function Inadimplencia() {
  const { t } = useTranslation();
  const [ordenarPor, setOrdenarPor] = useState<"dias" | "valor" | "nome">("dias");
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  const { data: inadimplentes = [], isLoading, refetch } = trpc.relatorios.inadimplentes.useQuery(
    { ordenarPor },
    { refetchOnWindowFocus: true }
  );

  const filtrados = inadimplentes.filter((c: any) =>
    !busca || c.clienteNome.toLowerCase().includes(busca.toLowerCase())
  );

  const totalDevido = filtrados.reduce((s: number, c: any) => s + c.totalDevido, 0);
  const totalClientes = filtrados.length;
  const totalParcelas = filtrados.reduce((s: number, c: any) => s + c.parcelas.length, 0);
  const maiorAtraso = filtrados.reduce((max: number, c: any) => Math.max(max, c.maiorDiasAtraso), 0);

  function toggleExpand(clienteId: number) {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(clienteId)) next.delete(clienteId);
      else next.add(clienteId);
      return next;
    });
  }

  function abrirWhatsApp(whatsapp: string, nome: string) {
    const numero = whatsapp.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá ${nome}, passando para lembrar sobre parcelas em atraso. Por favor, entre em contato para regularizar sua situação.`);
    window.open(`https://wa.me/55${numero}?text=${msg}`, "_blank");
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <TrendingDown className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('inadimplencia.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('inadimplencia.subtitle')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t('common.refresh')}
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-red-400" />
                <span className="text-xs text-muted-foreground">{t('common.clients')}</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{totalClientes}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-muted-foreground">{t('common.parcels')}</span>
              </div>
              <p className="text-2xl font-bold text-orange-400">{totalParcelas}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-yellow-400" />
                <span className="text-xs text-muted-foreground">{t('inadimplencia.totalOwed')}</span>
              </div>
              <p className="text-lg font-bold text-yellow-400">{formatarMoeda(totalDevido)}</p>
            </CardContent>
          </Card>
          <Card className="border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">{t('inadimplencia.longestDelay')}</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">{maiorAtraso}d</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder={t('clients.searchClient')}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="flex-1"
          />
          <Select value={ordenarPor} onValueChange={(v: any) => setOrdenarPor(v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dias">{t('inadimplencia.sortByDays')}</SelectItem>
              <SelectItem value="valor">{t('inadimplencia.sortByValue')}</SelectItem>
              <SelectItem value="nome">{t('inadimplencia.sortByName')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de inadimplentes */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {busca ? t('common.noResults') : t('inadimplencia.noDelinquents')}
              </p>
              {!busca && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('inadimplencia.allClientsOnTime')}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtrados.map((cliente: any) => {
              const isExpanded = expandidos.has(cliente.clienteId);
              return (
                <Card key={cliente.clienteId} className="border-border hover:border-red-500/30 transition-colors">
                  <CardContent className="p-4">
                    {/* Linha principal */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{cliente.clienteNome}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 ${getBadgeDias(cliente.maiorDiasAtraso)}`}
                          >
                            {cliente.maiorDiasAtraso}d {t('inadimplencia.delay')}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                            {cliente.parcelas.length} parcela{cliente.parcelas.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <p className="text-sm text-red-400 font-medium mt-0.5">
                          {t('inadimplencia.totalOwed')}: {formatarMoeda(cliente.totalDevido)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cliente.clienteWhatsapp && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 border-green-500/30 hover:bg-green-500/10"
                            onClick={() => abrirWhatsApp(cliente.clienteWhatsapp, cliente.clienteNome)}
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4 text-green-400" />
                          </Button>
                        )}
                        {cliente.clienteTelefone && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(`tel:${cliente.clienteTelefone}`, "_blank")}
                            title="Ligar"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleExpand(cliente.clienteId)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Parcelas expandidas */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('inadimplencia.overdueInstallments')}</p>
                        {cliente.parcelas.map((p: any) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/40"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">#{p.numeroParcela}</span>
                              <span>{t('common.dueDate')}: {formatarData(p.dataVencimento)}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${getBadgeDias(p.diasAtraso)}`}
                              >
                                {p.diasAtraso}d
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatarMoeda(p.totalParcela)}</p>
                              {p.valorMulta > 0 && (
                                <p className="text-[10px] text-orange-400">
                                  +{formatarMoeda(p.valorMulta)} {t('common.fine')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
