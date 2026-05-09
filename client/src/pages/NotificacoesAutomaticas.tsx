import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bell, BellOff, MessageSquare, Clock, CheckCircle2, XCircle,
  Send, Info, History, Settings2, Zap
} from "lucide-react";

// ─── VARIÁVEIS DISPONÍVEIS ────────────────────────────────────────────────────
const VARIAVEIS = [
  { var: "{nome}", desc: "Nome do cliente" },
  { var: "{valor}", desc: "Valor da parcela (R$)" },
  { var: "{data_vencimento}", desc: "Data de vencimento (dd/mm/aaaa)" },
  { var: "{dias_atraso}", desc: "Dias em atraso" },
  { var: "{empresa}", desc: "Nome da sua empresa" },
  { var: "{parcela}", desc: "Número da parcela" },
  { var: "{total_parcelas}", desc: "Total de parcelas do contrato" },
];

// ─── CORES POR CATEGORIA ─────────────────────────────────────────────────────
function getCategoria(tipo: string) {
  if (tipo.startsWith("antes_")) return { cor: "bg-blue-500/10 text-blue-400 border-blue-500/30", icone: Clock, label: "Lembrete" };
  if (tipo === "no_vencimento") return { cor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icone: Bell, label: "Vencimento" };
  if (tipo.startsWith("apos_")) return { cor: "bg-red-500/10 text-red-400 border-red-500/30", icone: BellOff, label: "Cobrança" };
  return { cor: "bg-green-500/10 text-green-400 border-green-500/30", icone: CheckCircle2, label: "Confirmação" };
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function NotificacoesAutomaticas() {
  const { t } = useTranslation();
  const [editando, setEditando] = useState<{ tipo: string; mensagem: string } | null>(null);
  const [disparando, setDisparando] = useState(false);

  const utils = trpc.useUtils();

  const { data: globalAtivo, isLoading: loadingGlobal } = trpc.notificacoes.getGlobalAtivo.useQuery();
  const { data: regras, isLoading: loadingRegras } = trpc.notificacoes.listar.useQuery();
  const { data: historico, isLoading: loadingHistorico } = trpc.notificacoes.historico.useQuery({ limit: 50 });

  const setGlobal = trpc.notificacoes.setGlobalAtivo.useMutation({
    onSuccess: () => utils.notificacoes.getGlobalAtivo.invalidate(),
  });

  const toggle = trpc.notificacoes.toggle.useMutation({
    onSuccess: () => utils.notificacoes.listar.invalidate(),
  });

  const salvar = trpc.notificacoes.salvar.useMutation({
    onSuccess: () => {
      utils.notificacoes.listar.invalidate();
      setEditando(null);
      toast.success(t('toast_success.mensagem_salva_com_sucesso'));
    },
    onError: (e) => toast.error(e.message),
  });

  const testar = trpc.notificacoes.testar.useMutation({
    onSuccess: (data) => toast.success(`Mensagem de teste enviada! "${data.mensagem.substring(0, 60)}..."`),
    onError: (e) => toast.error(`Erro ao testar: ${e.message}`),
  });

  const disparar = trpc.notificacoes.dispararDoDia.useMutation({
    onSuccess: (data) => {
      toast.success(data.mensagem);
      utils.notificacoes.historico.invalidate();
      setDisparando(false);
    },
    onError: (e) => {
      toast.error(`Erro: ${e.message}`);
      setDisparando(false);
    },
  });

  const handleToggleGlobal = (val: boolean) => {
    setGlobal.mutate({ ativo: val });
  };

  const handleToggleRegra = (tipo: string, ativo: boolean) => {
    toggle.mutate({ tipo, ativo });
  };

  const handleEditar = (regra: { tipo: string; mensagem_template: string }) => {
    setEditando({ tipo: regra.tipo, mensagem: regra.mensagem_template });
  };

  const handleSalvar = () => {
    if (!editando) return;
    const regra = regras?.find(r => r.tipo === editando.tipo);
    if (!regra) return;
    salvar.mutate({ tipo: editando.tipo, ativo: regra.ativo, mensagem_template: editando.mensagem });
  };

  const handleTestar = () => {
    if (!editando) return;
    testar.mutate({ tipo: editando.tipo, mensagem_template: editando.mensagem });
  };

  const inserirVariavel = (variavel: string) => {
    if (!editando) return;
    setEditando(prev => prev ? { ...prev, mensagem: prev.mensagem + variavel } : null);
  };

  const handleDisparar = () => {
    setDisparando(true);
    disparar.mutate();
  };

  const regraEditando = regras?.find(r => r.tipo === editando?.tipo);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              {t('notifications.title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('notifications.subtitle')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisparar}
            disabled={disparando || !globalAtivo}
            className="gap-2"
          >
            <Zap className="w-4 h-4" />
            {disparando ? t('common.sending') : t('notifications.fireNow')}
          </Button>
        </div>

        {/* Toggle Global */}
        <Card className={`border-2 transition-colors ${globalAtivo ? "border-green-500/40 bg-green-500/5" : "border-border"}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${globalAtivo ? "bg-green-500/20" : "bg-muted"}`}>
                  {globalAtivo ? <Bell className="w-5 h-5 text-green-400" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {globalAtivo ? t('notifications.globalActive') : t('notifications.globalInactive')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {globalAtivo
                      ? t('notifications.globalActiveDesc')
                      : t('notifications.globalInactiveDesc')}
                  </p>
                </div>
              </div>
              <Switch
                checked={globalAtivo ?? false}
                onCheckedChange={handleToggleGlobal}
                disabled={loadingGlobal || setGlobal.isPending}
                className="scale-125"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="regras">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="regras" className="gap-2">
              <Settings2 className="w-4 h-4" />
              {t('notifications.rules')}
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="w-4 h-4" />
              {t('notifications.history')}
            </TabsTrigger>
          </TabsList>

          {/* ─── ABA REGRAS ─────────────────────────────────────────────────── */}
          <TabsContent value="regras" className="space-y-3 mt-4">
            {/* Info variáveis */}
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-blue-300 font-medium">{t('notifications.availableVars')}:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {VARIAVEIS.map(v => (
                        <span key={v.var} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono" title={v.desc}>
                          {v.var}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingRegras ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(regras ?? []).map((regra) => {
                  const cat = getCategoria(regra.tipo);
                  const Icone = cat.icone;
                  return (
                    <Card key={regra.tipo} className={`transition-all ${!globalAtivo ? "opacity-50" : ""}`}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* Ícone categoria */}
                          <div className={`p-2 rounded-lg border ${cat.cor}`}>
                            <Icone className="w-4 h-4" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground text-sm">{regra.label}</span>
                              <Badge variant="outline" className={`text-xs ${cat.cor}`}>{cat.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {regra.mensagem_template.substring(0, 80)}...
                            </p>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditar(regra)}
                              disabled={!globalAtivo}
                              className="h-8 px-2 text-xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1" />
                              {t('common.edit')}
                            </Button>
                            <Switch
                              checked={regra.ativo}
                              onCheckedChange={(val) => handleToggleRegra(regra.tipo, val)}
                              disabled={!globalAtivo || toggle.isPending}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── ABA HISTÓRICO ───────────────────────────────────────────────── */}
          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('notifications.sendHistory')}</CardTitle>
                <CardDescription>{t('notifications.historyDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistorico ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}
                  </div>
                ) : !historico || historico.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('notifications.noMessages')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(historico as {
                      id: number;
                      tipo: string;
                      telefone?: string;
                      mensagem?: string;
                      status: string;
                      erro?: string;
                      createdAt: string;
                      clientes?: { nome: string };
                    }[]).map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                        {log.status === "enviado" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {(log.clientes as { nome: string } | null)?.nome ?? "—"}
                            </span>
                            <Badge variant="outline" className={`text-xs ${getCategoria(log.tipo).cor}`}>
                              {getCategoria(log.tipo).label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{log.telefone}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {log.mensagem?.substring(0, 100)}
                          </p>
                          {log.erro && <p className="text-xs text-red-400 mt-0.5">{log.erro}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── DIALOG EDITAR MENSAGEM ──────────────────────────────────────────── */}
      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              {t('notifications.editMessage')} — {regraEditando?.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Variáveis */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                {t('notifications.clickToInsert')}:
              </Label>
              <div className="flex flex-wrap gap-1">
                {VARIAVEIS.map(v => (
                  <button
                    key={v.var}
                    onClick={() => inserirVariavel(v.var)}
                    className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded font-mono transition-colors"
                    title={v.desc}
                  >
                    {v.var}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <Label htmlFor="msg">{t('notifications.message')}</Label>
              <Textarea
                id="msg"
                value={editando?.mensagem ?? ""}
                onChange={(e) => setEditando(prev => prev ? { ...prev, mensagem: e.target.value } : null)}
                rows={6}
placeholder={t('notifications.messagePlaceholder')}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('notifications.boldHint')}
              </p>
            </div>

            {/* Preview */}
            {editando?.mensagem && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                <p className="text-xs text-green-400 font-medium mb-1">{t('notifications.preview')}:</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {editando.mensagem
                    .replace(/{nome}/g, "João Silva")
                    .replace(/{valor}/g, "250,00")
                    .replace(/{data_vencimento}/g, new Date().toLocaleDateString("pt-BR"))
                    .replace(/{dias_atraso}/g, "2")
                    .replace(/{empresa}/g, "Sua Empresa")
                    .replace(/{parcela}/g, "3")
                    .replace(/{total_parcelas}/g, "12")
                  }
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => testar.mutate({ tipo: editando?.tipo ?? "", mensagem_template: editando?.mensagem ?? "" })} disabled={testar.isPending} className="gap-2">
              <Send className="w-4 h-4" />
              {testar.isPending ? t('common.sending') : t('common.test')}
            </Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {salvar.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
