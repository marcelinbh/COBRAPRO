import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, DollarSign, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ClienteComRisco {
  id: number;
  nome: string;
  email: string;
  score: number;
  capitalTotal: number;
  totalReceber: number;
  parcelas: number;
  atrasadas: number;
  limiteSugerido: number;
  risco: "baixo" | "medio" | "alto" | "critico";
  recomendacao: string;
}

export default function AnaliseRisco() {
  const { t } = useTranslation();
  const [clientes, setClientes] = useState<ClienteComRisco[]>([]);
  const [filtroRisco, setFiltroRisco] = useState<"todos" | "baixo" | "medio" | "alto" | "critico">("todos");

  const { data: clientesComScore } = trpc.clientes.listarComScore.useQuery();

  useEffect(() => {
    if (clientesComScore && Array.isArray(clientesComScore.clientes)) {
      const clientesComRisco = clientesComScore.clientes.map((cliente: any) => {
        const score = cliente.score || 0;
        const capitalTotal = cliente.capitalTotal || 0;
        const totalReceber = cliente.totalReceber || 0;
        const parcelas = cliente.parcelas || 0;
        const atrasadas = cliente.atrasadas || 0;
        const taxaAdimplencia = parcelas > 0 ? ((parcelas - atrasadas) / parcelas) * 100 : 100;
        
        // Calcular limite sugerido baseado em Score
        let limiteSugerido = 0;
        let risco: "baixo" | "medio" | "alto" | "critico" = "baixo";
        let recomendacao = "";

        if (score >= 100) {
          limiteSugerido = capitalTotal * 3; // 300% do capital atual
          risco = "baixo";
          recomendacao = "Excelente cliente. Pode aumentar limite e oferecer melhores taxas.";
        } else if (score >= 75) {
          limiteSugerido = capitalTotal * 2; // 200% do capital atual
          risco = "medio";
          recomendacao = "Bom cliente. Monitorar regularmente.";
        } else if (score >= 50) {
          limiteSugerido = capitalTotal * 1.5; // 150% do capital atual
          risco = "alto";
          recomendacao = "Cliente com histórico de atrasos. Aumentar frequência de cobranças.";
        } else {
          limiteSugerido = capitalTotal * 0.5; // 50% do capital atual
          risco = "critico";
          recomendacao = "Alto risco. Considerar suspender novos empréstimos até regularização.";
        }

        return {
          ...cliente,
          capitalTotal: capitalTotal || 0,
          totalReceber: totalReceber || 0,
          parcelas: parcelas || 0,
          atrasadas: atrasadas || 0,
          limiteSugerido: limiteSugerido || 0,
          risco,
          recomendacao,
        };
      });

      setClientes(clientesComRisco);
    }
  }, [clientesComScore]);

  const clientesFiltrados = filtroRisco === "todos" 
    ? clientes 
    : clientes.filter((c) => c.risco === filtroRisco);

  const estatisticas = {
    total: clientes.length,
    baixoRisco: clientes.filter((c) => c.risco === "baixo").length,
    medioRisco: clientes.filter((c) => c.risco === "medio").length,
    altoRisco: clientes.filter((c) => c.risco === "alto").length,
    criticoRisco: clientes.filter((c) => c.risco === "critico").length,
  };

  const getRiscoBadge = (risco: string) => {
    switch (risco) {
      case "baixo":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">✓ Baixo Risco</Badge>;
      case "medio":
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">⚠ Médio Risco</Badge>;
      case "alto":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">⚠ Alto Risco</Badge>;
      case "critico":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">🚨 Crítico</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Análise de Risco de Crédito</h1>
        <p className="text-muted-foreground mt-2">
          Avaliação automática de risco baseada no Score de cada cliente
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{estatisticas.total}</p>
              <p className="text-sm text-muted-foreground">Total de Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{estatisticas.baixoRisco}</p>
              <p className="text-sm text-muted-foreground">Baixo Risco</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{estatisticas.medioRisco}</p>
              <p className="text-sm text-muted-foreground">Médio Risco</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">{estatisticas.altoRisco}</p>
              <p className="text-sm text-muted-foreground">Alto Risco</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{estatisticas.criticoRisco}</p>
              <p className="text-sm text-muted-foreground">{t('riskAnalysis.critical')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["todos", "baixo", "medio", "alto", "critico"] as const).map((filtro) => (
          <button
            key={filtro}
            onClick={() => setFiltroRisco(filtro)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              filtroRisco === filtro
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-accent"
            }`}
          >
            {filtro === "todos" && "Todos"}
            {filtro === "baixo" && "✓ Baixo"}
            {filtro === "medio" && "⚠ Médio"}
            {filtro === "alto" && "⚠ Alto"}
            {filtro === "critico" && "🚨 Crítico"}
          </button>
        ))}
      </div>

      {/* Lista de Clientes */}
      <div className="space-y-4">
        {clientesFiltrados.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Nenhum cliente encontrado nesta categoria de risco.
            </CardContent>
          </Card>
        ) : (
          clientesFiltrados.map((cliente) => (
            <Card key={cliente.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{cliente.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">{cliente.email}</p>
                  </div>
                  {getRiscoBadge(cliente.risco)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Score e Recomendação */}
                <div className="bg-accent/50 rounded-lg p-4 border border-border/50">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-1">{t('riskAnalysis.recommendation')}</p>
                      <p className="text-sm text-muted-foreground">{cliente.recomendacao}</p>
                    </div>
                  </div>
                </div>

                {/* Grid de Dados */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Score */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Score</p>
                    <p className="text-2xl font-bold">{cliente.score}</p>
                  </div>

                  {/* Capital Total */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Capital
                    </p>
                    <p className="text-lg font-semibold">
                      R$ {cliente.capitalTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  {/* Total a Receber */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">A Receber</p>
                    <p className="text-lg font-semibold">
                      R$ {cliente.totalReceber.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  {/* Atrasos */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Atrasos</p>
                    <p className="text-lg font-semibold text-red-600">
                      {cliente.atrasadas} de {cliente.parcelas}
                    </p>
                  </div>
                </div>

                {/* Limite Sugerido */}
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Limite Sugerido</p>
                        <p className="font-semibold">
                          R$ {cliente.limiteSugerido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
