import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, MessageCircle, CreditCard, MapPin, FileText, Plus } from "lucide-react";
import { formatarMoeda, formatarData, MODALIDADE_LABELS, STATUS_CONTRATO_LABELS } from "../../../shared/finance";

export default function ClienteDetalhe() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const clienteId = parseInt(params.id ?? "0");

  const { data: cliente, isLoading } = trpc.clientes.byId.useQuery({ id: clienteId });
  const { data: contratos } = trpc.clientes.contratosByCliente.useQuery({ clienteId });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-48 bg-card border border-border rounded-lg" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation('/clientes')}>
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    ativo: "bg-success/15 text-success border-success/30",
    quitado: "bg-muted text-muted-foreground border-border",
    inadimplente: "bg-primary/15 text-primary border-primary/30",
    cancelado: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/clientes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">{cliente.nome.toUpperCase()}</h1>
          <p className="text-sm text-muted-foreground">{cliente.cpfCnpj ?? "CPF não informado"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dados do Cliente */}
        <Card className="md:col-span-1 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dados de Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cliente.telefone && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Telefone</div>
                  <div className="text-sm text-foreground">{cliente.telefone}</div>
                </div>
              </div>
            )}
            {cliente.whatsapp && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/15">
                  <MessageCircle className="h-4 w-4 text-success" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">WhatsApp</div>
                  <a
                    href={`https://wa.me/55${cliente.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-success hover:underline"
                  >
                    {cliente.whatsapp}
                  </a>
                </div>
              </div>
            )}
            {cliente.chavePix && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/15">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Chave PIX ({cliente.tipoChavePix})</div>
                  <div className="text-sm text-foreground font-mono">{cliente.chavePix}</div>
                </div>
              </div>
            )}
            {(cliente.cidade || cliente.estado) && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Localização</div>
                  <div className="text-sm text-foreground">{[cliente.cidade, cliente.estado].filter(Boolean).join(', ')}</div>
                </div>
              </div>
            )}
            {cliente.observacoes && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">Observações</div>
                <p className="text-sm text-foreground">{cliente.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contratos */}
        <Card className="md:col-span-2 border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Contratos ({contratos?.length ?? 0})
              </CardTitle>
              <Button size="sm" className="gap-1" onClick={() => setLocation('/contratos/novo')}>
                <Plus className="h-3 w-3" /> Novo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {contratos?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum contrato para este cliente
              </p>
            )}
            {contratos?.map(contrato => (
              <div
                key={contrato.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setLocation(`/contratos`)}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {MODALIDADE_LABELS[contrato.modalidade] ?? contrato.modalidade}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[contrato.status] ?? ''}`}>
                      {STATUS_CONTRATO_LABELS[contrato.status] ?? contrato.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contrato.numeroParcelas}x de {formatarMoeda(contrato.valorParcela)} · Início: {formatarData(contrato.dataInicio)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg text-foreground">{formatarMoeda(contrato.valorPrincipal)}</div>
                  <div className="text-xs text-muted-foreground">Principal</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
