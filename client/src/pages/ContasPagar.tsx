import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Receipt, Plus, CheckCircle2, XCircle, AlertTriangle, Clock,
  Building2, Users, Zap, FileText, ShoppingCart, Megaphone, Monitor, MoreHorizontal,
  Trash2, Check
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";

const CATEGORIA_LABELS: Record<string, string> = {
  aluguel: "Aluguel",
  salario: "Salário",
  servicos: "Serviços",
  impostos: "Impostos",
  fornecedores: "Fornecedores",
  marketing: "Marketing",
  tecnologia: "Tecnologia",
  outros: "Outros",
};

const CATEGORIA_ICONS: Record<string, React.ReactNode> = {
  aluguel: <Building2 className="h-3.5 w-3.5" />,
  salario: <Users className="h-3.5 w-3.5" />,
  servicos: <Zap className="h-3.5 w-3.5" />,
  impostos: <FileText className="h-3.5 w-3.5" />,
  fornecedores: <ShoppingCart className="h-3.5 w-3.5" />,
  marketing: <Megaphone className="h-3.5 w-3.5" />,
  tecnologia: <Monitor className="h-3.5 w-3.5" />,
  outros: <MoreHorizontal className="h-3.5 w-3.5" />,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: <Clock className="h-3 w-3" /> },
  paga: { label: "Paga", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  atrasada: { label: "Atrasada", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: <AlertTriangle className="h-3 w-3" /> },
  cancelada: { label: "Cancelada", color: "text-muted-foreground bg-muted/30 border-border", icon: <XCircle className="h-3 w-3" /> },
};

export default function ContasPagar() {
  const { t } = useTranslation();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogPagarId, setDialogPagarId] = useState<number | null>(null);
  const [contaCaixaIdPagar, setContaCaixaIdPagar] = useState<string>("");

  // Form state
  const [form, setForm] = useState({
    descricao: "",
    categoria: "outros" as const,
    valor: "",
    dataVencimento: new Date().toISOString().split("T")[0],
    recorrente: false,
    periodicidade: "unica" as const,
    observacoes: "",
  });

  const utils = trpc.useUtils();
  const { data: resumo } = trpc.contasPagar.resumo.useQuery();
  const { data: contas, isLoading } = trpc.contasPagar.listar.useQuery(
    filtroStatus !== "todos" ? { status: filtroStatus as 'pendente' | 'paga' | 'atrasada' | 'cancelada' } : undefined
  );
  const { data: contasCaixa } = trpc.caixa.contas.useQuery();

  const criarMutation = trpc.contasPagar.criar.useMutation({
    onSuccess: () => {
      utils.contasPagar.listar.invalidate();
      utils.contasPagar.resumo.invalidate();
      setDialogAberto(false);
      setForm({ descricao: "", categoria: "outros", valor: "", dataVencimento: new Date().toISOString().split("T")[0], recorrente: false, periodicidade: "unica", observacoes: "" });
      toast.success("Conta a pagar registrada com sucesso.");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const pagarMutation = trpc.contasPagar.pagar.useMutation({
    onSuccess: () => {
      utils.contasPagar.listar.invalidate();
      utils.contasPagar.resumo.invalidate();
      setDialogPagarId(null);
      toast.success("Conta marcada como paga!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const cancelarMutation = trpc.contasPagar.cancelar.useMutation({
    onSuccess: () => {
      utils.contasPagar.listar.invalidate();
      utils.contasPagar.resumo.invalidate();
      toast.success("Conta cancelada.");
    },
  });

  const excluirMutation = trpc.contasPagar.excluir.useMutation({
    onSuccess: () => {
      utils.contasPagar.listar.invalidate();
      utils.contasPagar.resumo.invalidate();
      toast.success("Conta excluída.");
    },
  });

  function handleCriar() {
    const valor = parseFloat(form.valor.replace(",", "."));
    if (!form.descricao || !valor || !form.dataVencimento) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    criarMutation.mutate({
      descricao: form.descricao,
      categoria: form.categoria,
      valor,
      dataVencimento: form.dataVencimento,
      recorrente: form.recorrente,
      periodicidade: form.periodicidade,
      observacoes: form.observacoes || undefined,
    });
  }

  function handlePagar(id: number) {
    pagarMutation.mutate({
      id,
      contaCaixaId: contaCaixaIdPagar ? parseInt(contaCaixaIdPagar) : undefined,
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <Receipt className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Controle de despesas e obrigações financeiras</p>
          </div>
        </div>
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Conta a Pagar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Descrição *</Label>
                <Input
                  className="bg-background border-border"
                  placeholder="Ex: Aluguel do escritório"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Categoria *</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as typeof form.categoria })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor (R$) *</Label>
                  <Input
                    className="bg-background border-border"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Data de Vencimento *</Label>
                <Input
                  type="date"
                  className="bg-background border-border"
                  value={form.dataVencimento}
                  onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
                <div>
                  <p className="text-sm font-medium">Conta Recorrente</p>
                  <p className="text-xs text-muted-foreground">Repete automaticamente</p>
                </div>
                <Switch
                  checked={form.recorrente}
                  onCheckedChange={(v) => setForm({ ...form, recorrente: v })}
                />
              </div>
              {form.recorrente && (
                <div className="space-y-1.5">
                  <Label>Periodicidade</Label>
                  <Select value={form.periodicidade} onValueChange={(v) => setForm({ ...form, periodicidade: v as typeof form.periodicidade })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  className="bg-background border-border resize-none"
                  placeholder="Informações adicionais..."
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCriar}
                disabled={criarMutation.isPending}
              >
                {criarMutation.isPending ? "Salvando..." : "Salvar Conta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">A Pagar</p>
            <p className="text-xl font-bold text-amber-400">{formatarMoeda(resumo?.totalPendente ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{resumo?.qtdPendente ?? 0} contas</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Em Atraso</p>
            <p className="text-xl font-bold text-red-400">{formatarMoeda(resumo?.totalAtrasado ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{resumo?.qtdAtrasado ?? 0} contas</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Pagas (mês)</p>
            <p className="text-xl font-bold text-emerald-400">{formatarMoeda(resumo?.totalPago ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{resumo?.qtdPago ?? 0} contas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {["todos", "pendente", "atrasada", "paga", "cancelada"].map((s) => (
          <Button
            key={s}
            variant={filtroStatus === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroStatus(s)}
            className={filtroStatus === s ? "bg-primary text-primary-foreground" : "border-border"}
          >
            {s === "todos" ? "Todas" : STATUS_CONFIG[s]?.label ?? s}
          </Button>
        ))}
      </div>

      {/* Lista de contas */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : !contas || contas.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma conta encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">Clique em "Nova Conta" para adicionar</p>
            </CardContent>
          </Card>
        ) : (
          contas.map((conta) => {
            const statusCfg = STATUS_CONFIG[conta.status] ?? STATUS_CONFIG.pendente;
            return (
              <Card key={conta.id} className="bg-card border-border hover:border-border/80 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-muted/30 shrink-0 mt-0.5">
                        {CATEGORIA_ICONS[conta.categoria] ?? <MoreHorizontal className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{conta.descricao}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{CATEGORIA_LABELS[conta.categoria]}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            Vence: {conta.dataVencimento ? new Date(conta.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </span>
                          {conta.recorrente && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-blue-400">Recorrente ({conta.periodicidade})</span>
                            </>
                          )}
                        </div>
                        {conta.observacoes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{conta.observacoes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="font-bold text-base">{formatarMoeda(parseFloat(conta.valor))}</p>
                      <Badge className={`text-xs border ${statusCfg.color} flex items-center gap-1`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Ações */}
                  {(conta.status === "pendente" || conta.status === "atrasada") && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Dialog open={dialogPagarId === conta.id} onOpenChange={(open) => { setDialogPagarId(open ? conta.id : null); setContaCaixaIdPagar(""); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            Marcar como Paga
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Registrar Pagamento</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <p className="text-sm text-muted-foreground">{conta.descricao}</p>
                            <p className="text-2xl font-bold">{formatarMoeda(parseFloat(conta.valor))}</p>
                            <div className="space-y-1.5">
                              <Label>Conta de Caixa (opcional)</Label>
                              <Select value={contaCaixaIdPagar} onValueChange={setContaCaixaIdPagar}>
                                <SelectTrigger className="bg-background border-border">
                                  <SelectValue placeholder="Selecionar conta..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {contasCaixa?.map((c: { id: number; nome: string }) => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handlePagar(conta.id)}
                              disabled={pagarMutation.isPending}
                            >
                              Confirmar Pagamento
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border"
                        onClick={() => cancelarMutation.mutate({ id: conta.id })}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {conta.status === "cancelada" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => excluirMutation.mutate({ id: conta.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Excluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
