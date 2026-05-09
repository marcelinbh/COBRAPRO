import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Users, Plus, Edit, TrendingUp, DollarSign, AlertTriangle, Award } from "lucide-react";

const PERFIL_LABELS: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  koletor: "Cobrador",
  cobrador: "Cobrador",
};

const PERFIL_COLORS: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  gerente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  koletor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cobrador: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function formatMoeda(v: number | string | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export default function Cobradores() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"lista" | "performance">("lista");
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [mesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado] = useState(new Date().getFullYear());

  const { data: cobradores = [], refetch } = trpc.cobradores.list.useQuery();
  const { data: performance = [] } = trpc.cobradores.performance.useQuery({
    mes: mesSelecionado,
    ano: anoSelecionado,
  });

  const createMutation = trpc.cobradores.create.useMutation({
    onSuccess: () => { toast.success(t('toast_success.cobrador_criado_com_sucesso')); refetch(); setModalOpen(false); setEditando(null); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.cobradores.update.useMutation({
    onSuccess: () => { toast.success(t('toast_success.cobrador_atualizado')); refetch(); setModalOpen(false); setEditando(null); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.cobradores.delete.useMutation({
    onSuccess: () => { toast.success(t('toast_success.cobrador_desativado')); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", whatsapp: "",
    perfil: "koletor" as "admin" | "gerente" | "koletor",
    limiteEmprestimo: 0, comissaoPercentual: 0, observacoes: "",
  });

  function abrirNovo() {
    setEditando(null);
    setForm({ nome: "", email: "", telefone: "", whatsapp: "", perfil: "koletor", limiteEmprestimo: 0, comissaoPercentual: 0, observacoes: "" });
    setModalOpen(true);
  }

  function abrirEditar(k: any) {
    setEditando(k);
    setForm({
      nome: k.nome, email: k.email ?? "", telefone: k.telefone ?? "", whatsapp: k.whatsapp ?? "",
      perfil: k.perfil, limiteEmprestimo: parseFloat(k.limiteEmprestimo ?? "0"),
      comissaoPercentual: parseFloat(k.comissaoPercentual ?? "0"), observacoes: k.observacoes ?? "",
    });
    setModalOpen(true);
  }

  function salvar() {
    if (!form.nome.trim()) return toast.error(t('toast_error.nome_é_obrigatório'));
    if (editando) {
      updateMutation.mutate({ id: editando.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Cobradores
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('collectors.manageTeam')}</p>
        </div>
        <Button onClick={abrirNovo} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Novo Cobrador
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("lista")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "lista" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Lista de Cobradores
        </button>
        <button
          onClick={() => setTab("performance")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "performance" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Performance do Mês
        </button>
      </div>

      {tab === "lista" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cobradores.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum cobrador cadastrado ainda.</p>
              <Button onClick={abrirNovo} variant="outline" className="mt-4">Adicionar primeiro cobrador</Button>
            </div>
          )}
          {cobradores.map((k) => (
            <Card key={k.id} className={`border-border bg-card ${!k.ativo ? "opacity-50" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base text-foreground">{k.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{k.email ?? "Sem e-mail"}</p>
                  </div>
                  <Badge className={`text-xs border ${PERFIL_COLORS[k.perfil]}`}>
                    {PERFIL_LABELS[k.perfil]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">WhatsApp</p>
                    <p className="text-foreground font-medium">{k.whatsapp ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t('collectors.commission')}</p>
                    <p className="text-foreground font-medium">{parseFloat(k.comissaoPercentual ?? "0").toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Limite</p>
                    <p className="text-foreground font-medium">{formatMoeda(k.limiteEmprestimo)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <Badge variant={k.ativo ? "default" : "secondary"} className="text-xs">
                      {k.ativo ? t('collectors.active') : t('collectors.inactive')}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => abrirEditar(k)} className="flex-1 text-xs">
                    <Edit className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  {k.ativo && (
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate({ id: k.id })}
                      className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10">
                      Desativar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "performance" && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Performance de {new Date(anoSelecionado, mesSelecionado - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          {performance.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('collectors.noPerformanceData')}</p>
            </div>
          )}
          {performance.map((p) => (
            <Card key={p.koletor.id} className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{p.koletor.nome.charAt(0)}</span>
                    </div>
                    <div>
                      <CardTitle className="text-base text-foreground">{p.koletor.nome}</CardTitle>
                      <Badge className={`text-xs border ${PERFIL_COLORS[p.koletor.perfil]}`}>
                        {PERFIL_LABELS[p.koletor.perfil]}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t('collectors.estimatedCommission')}</p>
                    <p className="text-lg font-bold text-green-400">{formatMoeda(p.comissao)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                    <p className="text-xs text-muted-foreground">Emprestado</p>
                    <p className="font-bold text-foreground text-sm">{formatMoeda(p.totalEmprestado)}</p>
                    <p className="text-xs text-muted-foreground">{p.qtdContratos} contratos</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-400" />
                    <p className="text-xs text-muted-foreground">Recebido</p>
                    <p className="font-bold text-green-400 text-sm">{formatMoeda(p.totalRecebido)}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-400" />
                    <p className="text-xs text-muted-foreground">Inadimplente</p>
                    <p className="font-bold text-red-400 text-sm">{formatMoeda(p.totalInadimplente)}</p>
                    <p className="text-xs text-muted-foreground">{p.qtdInadimplentes} clientes</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <Award className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                    <p className="text-xs text-muted-foreground">Taxa Inadimp.</p>
                    <p className={`font-bold text-sm ${p.taxaInadimplencia > 10 ? "text-red-400" : p.taxaInadimplencia > 5 ? "text-yellow-400" : "text-green-400"}`}>
                      {p.taxaInadimplencia.toFixed(1)}%
                    </p>
                  </div>
                </div>
                {/* Barra de progresso de inadimplência */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{t('collectors.delinquencyRate')}</span>
                    <span>{p.taxaInadimplencia.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${p.taxaInadimplencia > 10 ? "bg-red-500" : p.taxaInadimplencia > 5 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(p.taxaInadimplencia, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? t('collectors.editCollector') : t('collectors.newCollector')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" className="bg-background border-border" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" className="bg-background border-border" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" className="bg-background border-border" />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select value={form.perfil} onValueChange={(v: any) => setForm({ ...form, perfil: v })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="koletor">Cobrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('collectors.commissionPercent')}</Label>
                <Input type="number" value={form.comissaoPercentual} onChange={(e) => setForm({ ...form, comissaoPercentual: parseFloat(e.target.value) || 0 })} className="bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>Limite de Empréstimo (R$)</Label>
                <Input type="number" value={form.limiteEmprestimo} onChange={(e) => setForm({ ...form, limiteEmprestimo: parseFloat(e.target.value) || 0 })} className="bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>{t('collectors.observations')}</Label>
                <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="bg-background border-border" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={createMutation.isPending || updateMutation.isPending}>
                {editando ? "Salvar" : "Criar Cobrador"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
