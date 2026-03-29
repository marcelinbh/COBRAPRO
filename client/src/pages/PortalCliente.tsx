import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle, Copy, ExternalLink, Shield } from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";
import { toast } from "sonner";

function StatusIcon({ status }: { status: string }) {
  if (status === 'paga') return <CheckCircle className="h-5 w-5 text-success" />;
  if (status === 'atrasada') return <AlertTriangle className="h-5 w-5 text-primary" />;
  return <Clock className="h-5 w-5 text-warning" />;
}

export default function PortalCliente() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get('token');

  const { data: portalData, isLoading, error } = trpc.portal.acessar.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  const copiarPix = (chave: string) => {
    navigator.clipboard.writeText(chave);
    toast.success("Chave PIX copiada!");
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl text-foreground mb-2">PORTAL DO CLIENTE</h1>
          <p className="text-muted-foreground text-sm">
            Acesse este portal através do link enviado por email ou WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl text-foreground mb-2">LINK INVÁLIDO</h1>
          <p className="text-muted-foreground text-sm">
            Este link de acesso é inválido ou expirou. Solicite um novo link ao seu credor.
          </p>
        </div>
      </div>
    );
  }

  const { cliente, parcelas } = portalData;
  const chavePix = cliente.chavePix;
  const parcelasAtrasadas = parcelas.filter((p: any) => p.status === 'atrasada');
  const parcelasPendentes = parcelas.filter((p: any) => p.status === 'pendente' || p.status === 'vencendo_hoje');
  const totalPendente = [...parcelasAtrasadas, ...parcelasPendentes].reduce((sum: number, p: any) => sum + parseFloat(p.valorOriginal), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="font-display text-lg text-foreground tracking-wide">COBRAPRO</div>
            <div className="text-xs text-muted-foreground">Portal do Cliente</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-success">
            <Shield className="h-3 w-3" />
            Acesso Seguro
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Boas-vindas */}
        <div>
          <h1 className="font-display text-2xl text-foreground">Olá, {cliente.nome.split(' ')[0]}!</h1>
          <p className="text-sm text-muted-foreground mt-1">Aqui estão suas parcelas e informações de pagamento.</p>
        </div>

        {/* Resumo */}
        {totalPendente > 0 && (
          <Card className={`border ${parcelasAtrasadas.length > 0 ? 'border-primary/30 bg-primary/5' : 'border-warning/30 bg-warning/5'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {parcelasAtrasadas.length > 0 ? 'Total em Atraso' : 'Total Pendente'}
                  </div>
                  <div className={`font-display text-3xl ${parcelasAtrasadas.length > 0 ? 'text-primary' : 'text-warning'}`}>
                    {formatarMoeda(totalPendente)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {parcelasAtrasadas.length > 0 && `${parcelasAtrasadas.length} parcela(s) atrasada(s)`}
                    {parcelasPendentes.length > 0 && ` · ${parcelasPendentes.length} pendente(s)`}
                  </div>
                </div>
                {parcelasAtrasadas.length > 0 && (
                  <AlertTriangle className="h-8 w-8 text-primary opacity-50" />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chave PIX */}
        {chavePix && (
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Chave PIX para Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                <div className="flex-1 font-mono text-sm text-foreground break-all">{chavePix}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 shrink-0"
                  onClick={() => copiarPix(chavePix)}
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use esta chave PIX para realizar seus pagamentos. Após o pagamento, entre em contato para confirmar.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Lista de Parcelas */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Suas Parcelas ({parcelas.length})
          </h2>
          <div className="space-y-2">
            {parcelas.map((parcela: any) => (
              <Card
                key={parcela.id}
                className={`border ${
                  parcela.status === 'atrasada' ? 'border-primary/20 bg-primary/3' :
                  parcela.status === 'vencendo_hoje' ? 'border-warning/20 bg-warning/3' :
                  parcela.status === 'paga' ? 'border-success/10 opacity-70' :
                  'border-border'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={parcela.status} />
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          Parcela {parcela.numeroParcela}/{parcela.numeroParcelas}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Vence: {formatarData(parcela.dataVencimento)}
                          {parcela.dataPagamento && ` · Pago: ${formatarData(parcela.dataPagamento)}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${
                        parcela.status === 'atrasada' ? 'text-primary' :
                        parcela.status === 'paga' ? 'text-success' :
                        'text-foreground'
                      }`}>
                        {formatarMoeda(parcela.valorPago ?? parcela.valorOriginal)}
                      </div>
                      {parcela.status === 'paga' && parcela.valorPago && (
                        <div className="text-xs text-muted-foreground line-through">
                          {formatarMoeda(parcela.valorOriginal)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          <p>Em caso de dúvidas, entre em contato com seu credor.</p>
          <p className="mt-1 opacity-50">CobraPro — Sistema de Gestão de Cobranças</p>
        </div>
      </div>
    </div>
  );
}
