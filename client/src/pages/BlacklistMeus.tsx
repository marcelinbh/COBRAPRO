import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, ShieldAlert, Plus, Trash2, Edit, AlertTriangle,
  CheckCircle, Clock, User, MapPin, DollarSign, Calendar, Building2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_DIVIDA_LABELS: Record<string, string> = {
  emprestimo: "Empréstimo",
  servico: "Serviço",
  produto: "Produto",
  aluguel: "Aluguel",
  cheque: "Cheque",
  outros: "Outros",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "destructive" | "secondary" | "outline"; icon: React.ElementType; color: string }> = {
  ativo: { label: "Inadimplente", variant: "destructive", icon: AlertTriangle, color: "text-red-500" },
  resolvido: { label: "Resolvido", variant: "secondary", icon: CheckCircle, color: "text-green-500" },
  em_negociacao: { label: "Em Negociação", variant: "outline", icon: Clock, color: "text-orange-500" },
};

function cpfMask(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatCurrency(v: string | null) {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v));
}

export default function BlacklistMeus() {
  const [deletarId, setDeletarId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");

  const utils = trpc.useUtils();
  const { data: registros, isLoading } = trpc.blacklist.listarMeus.useQuery();
  const deletar = trpc.blacklist.deletar.useMutation({
    onSuccess: () => {
      toast.success("Registro removido da blacklist");
      utils.blacklist.listarMeus.invalidate();
      utils.blacklist.estatisticas.invalidate();
      setDeletarId(null);
    },
    onError: (err) => {
      toast.error("Erro ao remover", { description: err.message });
      setDeletarId(null);
    },
  });

  const atualizar = trpc.blacklist.atualizar.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado");
      utils.blacklist.listarMeus.invalidate();
    },
    onError: (err) => toast.error("Erro", { description: err.message }),
  });

  const filtrados = registros?.filter((r) =>
    statusFilter === "todos" ? true : r.status === statusFilter
  ) ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/blacklist">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <ShieldAlert className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Meus Registros</h1>
              <p className="text-sm text-muted-foreground">
                {registros?.length ?? 0} registro(s) cadastrado(s) por você
              </p>
            </div>
          </div>
        </div>
        <Button className="bg-red-600 hover:bg-red-700" asChild>
          <Link href="/blacklist/nova">
            <Plus className="h-4 w-4 mr-2" />
            Nova Inclusão
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Inadimplente</SelectItem>
            <SelectItem value="em_negociacao">Em Negociação</SelectItem>
            <SelectItem value="resolvido">Resolvido</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtrados.length} resultado(s)</span>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-lg font-semibold text-foreground">Nenhum registro encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === "todos"
                ? "Você ainda não cadastrou nenhum devedor na blacklist"
                : `Nenhum registro com status "${statusFilter}"`}
            </p>
            <Button className="mt-4 bg-red-600 hover:bg-red-700" asChild>
              <Link href="/blacklist/nova">
                <Plus className="h-4 w-4 mr-2" />
                Fazer primeira inclusão
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((r) => {
            const statusCfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.ativo;
            const StatusIcon = statusCfg.icon;

            return (
              <div
                key={r.id}
                className={`rounded-lg border p-4 transition-all ${
                  r.status === "ativo"
                    ? "border-red-500/30 bg-red-500/5"
                    : r.status === "resolvido"
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-orange-500/30 bg-orange-500/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                      r.status === "ativo" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {r.nome.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{r.nome}</h3>
                        <Badge variant={statusCfg.variant} className="text-xs">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusCfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {TIPO_DIVIDA_LABELS[r.tipoDivida] ?? r.tipoDivida}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-mono text-muted-foreground">{cpfMask(r.cpfCnpj)}</span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {(r.cidade || r.estado) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[r.cidade, r.estado].filter(Boolean).join(" - ")}
                          </span>
                        )}
                        {r.valorDivida && (
                          <span className="flex items-center gap-1 text-red-500 font-medium">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(r.valorDivida)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>

                      <p className="text-sm text-foreground/80 mt-2 line-clamp-1">
                        <span className="font-medium">Motivo:</span> {r.motivo}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Alterar status */}
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        atualizar.mutate({
                          id: r.id,
                          status: v as "ativo" | "resolvido" | "em_negociacao",
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Inadimplente</SelectItem>
                        <SelectItem value="em_negociacao">Em Negociação</SelectItem>
                        <SelectItem value="resolvido">Resolvido</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => setDeletarId(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Fotos em miniatura */}
                {r.fotos && r.fotos.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {r.fotos.slice(0, 4).map((foto) => (
                      <a key={foto.id} href={foto.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={foto.url}
                          alt="Foto"
                          className="w-12 h-12 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                    {r.fotos.length > 4 && (
                      <div className="w-12 h-12 rounded-lg border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        +{r.fotos.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deletarId !== null} onOpenChange={(open) => !open && setDeletarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da Blacklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente o registro da blacklist CobraPro.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletarId && deletar.mutate({ id: deletarId })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
