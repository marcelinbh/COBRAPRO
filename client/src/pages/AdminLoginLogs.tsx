import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  User,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

type LoginLog = {
  id: number;
  user_id: number;
  ip: string | null;
  cidade: string | null;
  regiao: string | null;
  pais: string | null;
  pais_codigo: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
  user_agent: string | null;
  dispositivo: string | null;
  navegador: string | null;
  os: string | null;
  sucesso: boolean;
  created_at: string;
  user?: { id: number; name: string | null; email: string | null; role: string } | null;
};

function DeviceIcon({ dispositivo }: { dispositivo: string | null }) {
  if (dispositivo === "Mobile") return <Smartphone className="h-4 w-4 text-blue-400" />;
  if (dispositivo === "Tablet") return <Tablet className="h-4 w-4 text-purple-400" />;
  return <Monitor className="h-4 w-4 text-gray-400" />;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function timeAgo(dateStr: string) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}m atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  } catch {
    return "";
  }
}

export default function AdminLoginLogs() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const PAGE_SIZE = 50;

  const { data, isLoading, refetch } = trpc.admin.getLoginLogs.useQuery(
    { page, pageSize: PAGE_SIZE },
    { enabled: !!user && user.role === "admin" }
  );

  const deleteMutation = trpc.admin.deleteLoginLog.useMutation({
    onSuccess: () => {
      toast.success("Log removido", { description: "Registro excluído com sucesso." });
      refetch();
    },
  });

  const clearMutation = trpc.admin.clearLoginLogs.useMutation({
    onSuccess: () => {
      toast.success("Logs limpos", { description: "Todos os registros foram removidos." });
      refetch();
      setConfirmClear(false);
    },
  });

  // Redirecionar se não for admin
  if (!loading && (!user || user.role !== "admin")) {
    navigate("/dashboard");
    return null;
  }

  const logs: LoginLog[] = (data?.logs ?? []) as LoginLog[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Filtro local por nome/email/IP
  const filtered = search.trim()
    ? logs.filter((l) => {
        const q = search.toLowerCase();
        return (
          l.ip?.toLowerCase().includes(q) ||
          l.user?.name?.toLowerCase().includes(q) ||
          l.user?.email?.toLowerCase().includes(q) ||
          l.cidade?.toLowerCase().includes(q) ||
          l.pais?.toLowerCase().includes(q) ||
          l.navegador?.toLowerCase().includes(q) ||
          l.os?.toLowerCase().includes(q)
        );
      })
    : logs;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Shield className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Logs de Acesso</h1>
              <p className="text-sm text-muted-foreground">
                Rastreamento de IP, localização e dispositivo por login
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
              <Shield className="h-3 w-3 mr-1" />
              Somente Admin
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar Tudo
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total de Logins</p>
              <p className="text-2xl font-bold text-foreground">{total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Usuários Únicos</p>
              <p className="text-2xl font-bold text-foreground">
                {new Set(logs.map((l) => l.user_id)).size}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">IPs Únicos</p>
              <p className="text-2xl font-bold text-foreground">
                {new Set(logs.map((l) => l.ip).filter(Boolean)).size}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Países</p>
              <p className="text-2xl font-bold text-foreground">
                {new Set(logs.map((l) => l.pais_codigo).filter(Boolean)).size}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtro */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filtrar por nome, email, IP, cidade, país, navegador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
              Limpar
            </Button>
          )}
        </div>

        {/* Tabela */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Registros de Login
              {search && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filtered.length} resultado{filtered.length !== 1 ? "s" : ""})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Cada login registra IP, localização geográfica, dispositivo e navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="w-[180px]">Usuário</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Navegador / OS</TableHead>
                    <TableHead>ISP</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i} className="border-border/30">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted/30 rounded animate-pulse w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>Nenhum log de login encontrado.</p>
                        <p className="text-xs mt-1">Os logs aparecem após o primeiro login realizado.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((log) => (
                      <TableRow key={log.id} className="border-border/30 hover:bg-muted/20">
                        {/* Usuário */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-[130px]">
                                {log.user?.name ?? `User #${log.user_id}`}
                              </p>
                              <p className="text-xs text-muted-foreground truncate max-w-[130px]">
                                {log.user?.email ?? ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* IP */}
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-mono text-xs text-yellow-400 cursor-default">
                                  {log.ip ?? "—"}
                                </span>
                              </TooltipTrigger>
                              {log.latitude && log.longitude && (
                                <TooltipContent>
                                  <p>Lat: {log.latitude}, Lon: {log.longitude}</p>
                                  {log.timezone && <p>TZ: {log.timezone}</p>}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>

                        {/* Localização */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {log.pais_codigo && (
                              <img
                                src={`https://flagcdn.com/16x12/${log.pais_codigo.toLowerCase()}.png`}
                                alt={log.pais ?? ""}
                                className="w-4 h-3 object-cover rounded-sm flex-shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm truncate max-w-[140px]">
                                {log.cidade && log.pais
                                  ? `${log.cidade}, ${log.pais}`
                                  : log.pais ?? (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                              </p>
                              {log.regiao && (
                                <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                                  {log.regiao}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Dispositivo */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <DeviceIcon dispositivo={log.dispositivo} />
                            <span className="text-sm">{log.dispositivo ?? "—"}</span>
                          </div>
                        </TableCell>

                        {/* Navegador / OS */}
                        <TableCell>
                          <div>
                            <p className="text-sm">{log.navegador ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">{log.os ?? ""}</p>
                          </div>
                        </TableCell>

                        {/* ISP */}
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground truncate max-w-[120px] block cursor-default">
                                  {log.isp ?? "—"}
                                </span>
                              </TooltipTrigger>
                              {log.isp && (
                                <TooltipContent>
                                  <p>{log.isp}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>

                        {/* Data */}
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-default">
                                  <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground">
                                    {timeAgo(log.created_at)}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{formatDate(log.created_at)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>

                        {/* Ações */}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-400"
                            onClick={() => deleteMutation.mutate({ id: log.id })}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && !search && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages} ({total} registros)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmação de limpar tudo */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Limpar todos os logs?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os {total} registros de login serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => clearMutation.mutate({})}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? "Limpando..." : "Sim, limpar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
