import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bell, BellOff, MessageSquare, Clock, CheckCircle2, XCircle,
  Send, Info, History, Settings2, Zap, Loader2, Phone, ShieldCheck, CheckCheck, AlertTriangle
} from "lucide-react";

// ─── VARIÁVEIS DISPONÍVEIS ────────────────────────────────────────────────────
const VARIAVEIS = [
  { var: "{nome}", desc: "Nome do cliente" },
  { var: "{valor}", desc: "Valor da parcela (R$)" },
  { var: "{data_vencimento}", desc: "Data de vencimento (dd/mm/aaaa)" },
  { var: "{dias_atraso}", desc: "Dias em atraso" },
  { var: "{empresa}", desc: "Nome da sua empresa" },
  { var: "{parcela}", desc: i18n.t('whatsapp.installmentNumber') },
  { var: "{total_parcelas}", desc: "Total de parcelas do contrato" },
];

// ─── CORES POR CATEGORIA ─────────────────────────────────────────────────────
function getCategoria(tipo: string) {
  if (tipo === "teste_envio") return { cor: "bg-violet-500/10 text-violet-400 border-violet-500/30", icone: Send, label: "Teste" };
  if (tipo.startsWith("antes_")) return { cor: "bg-blue-500/10 text-blue-400 border-blue-500/30", icone: Clock, label: "Lembrete" };
  if (tipo === "no_vencimento") return { cor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icone: Bell, label: "Vencimento" };
  if (tipo.startsWith("apos_")) return { cor: "bg-red-500/10 text-red-400 border-red-500/30", icone: BellOff, label: i18n.t('whatsapp.chargeType') };
  return { cor: "bg-green-500/10 text-green-400 border-green-500/30", icone: CheckCircle2, label: i18n.t('whatsapp.confirmationType') };
}

function getStatusEnvio(status: string) {
  if (status === "aceito_evolution") return { label: "Aceito pela Evolution", cor: "bg-blue-500/10 text-blue-400 border-blue-500/30", icone: Send };
  if (status === "enviado") return { label: "Enviado", cor: "bg-green-500/10 text-green-400 border-green-500/30", icone: CheckCircle2 };
  if (status === "entregue") return { label: "Entregue", cor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icone: CheckCheck };
  if (status === "lido") return { label: "Lido", cor: "bg-violet-500/10 text-violet-400 border-violet-500/30", icone: CheckCheck };
  if (status === "desconhecido") return { label: "Revisar confirmação", cor: "bg-orange-500/10 text-orange-400 border-orange-500/30", icone: AlertTriangle };
  if (status === "erro" || status === "falhou") return { label: "Falhou", cor: "bg-red-500/10 text-red-400 border-red-500/30", icone: XCircle };
  return { label: status || "Aguardando", cor: "bg-amber-500/10 text-amber-400 border-amber-500/30", icone: Clock };
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function NotificacoesAutomaticas() {
  const { t, i18n } = useTranslation();
  const [editando, setEditando] = useState<{ tipo: string; mensagem: string } | null>(null);
  const [horario, setHorario] = useState("09:00");
  const [abaAtiva, setAbaAtiva] = useState("regras");
  const [testeAberto, setTesteAberto] = useState(false);
  const [testeConfigurado, setTesteConfigurado] = useState<{ tipo: string; mensagem: string } | null>(null);
  const [telefoneTeste, setTelefoneTeste] = useState("");
  const [confirmarFila, setConfirmarFila] = useState(false);
  const filaEmExecucao = useRef(false);
  const [resultadoFila, setResultadoFila] = useState<{
    dryRun: boolean;
    elegiveis: number;
    enfileiradas: number;
    processadas: number;
    enviadas: number;
    falhas: number;
    aguardandoReconexao: number;
    ambiguas: number;
    canceladas: number;
  } | null>(null);
  const [resultadoTeste, setResultadoTeste] = useState<{
    telefone: string;
    providerMessageId: string | null;
    aceitoEm: string;
    historicoRegistrado: boolean;
  } | null>(null);

  const utils = trpc.useUtils();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnMount: false });
  const userId = auth.data?.id;
  const sessaoDisponivel = Number.isSafeInteger(userId) && Number(userId) > 0 && !auth.isLoading && !auth.isFetching && !auth.isError;
  const sessao = useRef({ userId, disponivel: sessaoDisponivel, geracao: 0 });
  const identidadeMudou = sessao.current.userId !== userId || sessao.current.disponivel !== sessaoDisponivel;
  if (identidadeMudou) sessao.current = { userId, disponivel: sessaoDisponivel, geracao: sessao.current.geracao + 1 };
  const geracao = sessao.current.geracao;
  const queryScope = {
    enabled: sessaoDisponivel && !identidadeMudou,
    queryKeyHashFn: (key: readonly unknown[]) => JSON.stringify([userId, geracao, key]),
  };
  const capturarSessao = () => ({ userId, geracao });
  const respostaAtual = (origem: { userId: number | undefined; geracao: number } | undefined) =>
    !!origem && sessao.current.disponivel && origem.userId === sessao.current.userId && origem.geracao === sessao.current.geracao;

  const { data: globalAtivo, isLoading: loadingGlobal, error: erroGlobal } = trpc.notificacoes.getGlobalAtivo.useQuery(undefined, queryScope);
  const { data: automacao, isLoading: loadingAutomacao, error: erroAutomacao } = trpc.notificacoes.getAutomacao.useQuery(undefined, queryScope);
  const { data: regras, isLoading: loadingRegras, error: erroRegras } = trpc.notificacoes.listar.useQuery(undefined, queryScope);
  const { data: historico, isLoading: loadingHistorico, error: erroHistorico } = trpc.notificacoes.historico.useQuery({ limit: 50 }, queryScope);
  const { data: saude, isLoading: loadingSaude, error: erroSaude } = trpc.notificacoes.saude.useQuery(undefined, { ...queryScope, refetchInterval: 30_000 });
  const { data: conexao, isLoading: loadingConexao, error: erroConexao } = trpc.whatsappEvolution.getStatus.useQuery(undefined, { ...queryScope, refetchInterval: testeAberto ? 10_000 : 60_000 });

  const salvarAutomacao = trpc.notificacoes.salvarAutomacao.useMutation({
    onMutate: capturarSessao,
    onSuccess: (_data, _input, origem) => {
      if (!respostaAtual(origem)) return;
      utils.notificacoes.getGlobalAtivo.invalidate();
      utils.notificacoes.getAutomacao.invalidate();
      toast.success("Automação de WhatsApp atualizada.");
    },
    onError: (erro, _input, origem) => { if (respostaAtual(origem)) toast.error(erro.message); },
  });

  const toggle = trpc.notificacoes.toggle.useMutation({
    onMutate: capturarSessao,
    onSuccess: (_data, _input, origem) => { if (respostaAtual(origem)) utils.notificacoes.listar.invalidate(); },
    onError: (erro, _input, origem) => { if (respostaAtual(origem)) toast.error(erro.message); },
  });

  const salvar = trpc.notificacoes.salvar.useMutation({
    onMutate: capturarSessao,
    onSuccess: (_data, _input, origem) => {
      if (!respostaAtual(origem)) return;
      utils.notificacoes.listar.invalidate();
      setEditando(null);
      toast.success(t('toast_success.mensagem_salva_com_sucesso'));
    },
    onError: (e, _input, origem) => { if (respostaAtual(origem)) toast.error(e.message); },
  });

  const testar = trpc.notificacoes.testar.useMutation({
    onMutate: capturarSessao,
    retry: false,
    onSuccess: (data, _input, origem) => {
      if (!respostaAtual(origem)) return;
      setResultadoTeste({
        telefone: data.telefone,
        providerMessageId: data.providerMessageId,
        aceitoEm: data.aceitoEm,
        historicoRegistrado: data.historicoRegistrado,
      });
      utils.notificacoes.historico.invalidate();
      utils.notificacoes.saude.invalidate();
      toast.success("A Evolution aceitou a mensagem de teste.");
    },
    onError: (e, _input, origem) => { if (respostaAtual(origem)) toast.error(`Erro ao testar: ${e.message}`); },
  });

  const disparar = trpc.notificacoes.dispararDoDia.useMutation({
    onMutate: capturarSessao,
    retry: false,
    onSettled: (_data, _erro, _input, origem) => { if (respostaAtual(origem)) filaEmExecucao.current = false; },
    onSuccess: (data, _input, origem) => {
      if (!respostaAtual(origem)) return;
      setResultadoFila(data);
      setConfirmarFila(false);
      utils.notificacoes.historico.invalidate();
      utils.notificacoes.saude.invalidate();
      if (data.falhas || data.ambiguas) {
        toast.warning("Operação concluída com itens que exigem atenção. Confira os contadores e o histórico.");
      } else {
        toast.info(data.dryRun ? "Validação concluída sem enviar mensagens." : `Fila processada: ${data.enviadas} solicitação(ões) aceita(s) pela Evolution.`);
      }
    },
    onError: (erro, _input, origem) => {
      if (!respostaAtual(origem)) return;
      utils.notificacoes.historico.invalidate();
      utils.notificacoes.saude.invalidate();
      toast.error(erro.message);
    },
  });
  const filaIndisponivel = !sessaoDisponivel || identidadeMudou || loadingRegras || loadingGlobal || loadingAutomacao || !!erroRegras || !!erroGlobal || !!erroAutomacao || disparar.isPending || salvar.isPending || toggle.isPending || salvarAutomacao.isPending;
  const handleProcessarFila = (dryRun: boolean) => {
    if (filaEmExecucao.current || filaIndisponivel || testar.isPending || (!dryRun && (!confirmarFila || !conexao?.connected || loadingConexao || erroConexao))) return;
    filaEmExecucao.current = true;
    setResultadoFila(null);
    disparar.reset();
    disparar.mutate({ dryRun });
  };

  useEffect(() => {
    setEditando(null);
    setTelefoneTeste("");
    setTesteConfigurado(null);
    setResultadoTeste(null);
    setResultadoFila(null);
    setTesteAberto(false);
    setConfirmarFila(false);
    setHorario("09:00");
    filaEmExecucao.current = false;
    salvarAutomacao.reset(); toggle.reset(); salvar.reset(); testar.reset(); disparar.reset();
  }, [geracao]);

  useEffect(() => {
    sessao.current.disponivel = sessaoDisponivel;
    return () => {
      sessao.current.disponivel = false;
      filaEmExecucao.current = false;
    };
  }, []);

  useEffect(() => {
    if (sessaoDisponivel && !erroAutomacao && automacao?.horario) setHorario(automacao.horario);
  }, [automacao?.horario, sessaoDisponivel, erroAutomacao]);

  const handleToggleGlobal = (ativo: boolean) => {
    if (!sessaoDisponivel || identidadeMudou || loadingGlobal || loadingAutomacao || erroGlobal || erroAutomacao || salvarAutomacao.isPending || disparar.isPending) return;
    // Desativar não salva nem valida o rascunho ainda não confirmado do horário.
    salvarAutomacao.mutate({ ativo, horario: ativo ? horario : automacao?.horario || "09:00" });
  };

  const handleSalvarHorario = () => {
    if (!sessaoDisponivel || identidadeMudou || loadingGlobal || loadingAutomacao || erroGlobal || erroAutomacao || salvarAutomacao.isPending || disparar.isPending) return;
    salvarAutomacao.mutate({ ativo: globalAtivo ?? false, horario });
  };

  const handleToggleRegra = (tipo: string, ativo: boolean) => {
    if (!sessaoDisponivel || identidadeMudou || loadingRegras || erroRegras || salvar.isPending || toggle.isPending || disparar.isPending) return;
    toggle.mutate({ tipo, ativo });
  };

  const handleEditar = (regra: { tipo: string; mensagem_template: string }) => {
    if (!sessaoDisponivel || identidadeMudou || loadingRegras || erroRegras || salvar.isPending || toggle.isPending || disparar.isPending) return;
    setEditando({ tipo: regra.tipo, mensagem: regra.mensagem_template });
  };

  const handleSalvar = () => {
    if (!sessaoDisponivel || identidadeMudou || loadingRegras || erroRegras || salvar.isPending || toggle.isPending || disparar.isPending) return;
    if (!editando) return;
    const regra = regras?.find(r => r.tipo === editando.tipo);
    if (!regra) return;
    salvar.mutate({ tipo: editando.tipo, ativo: regra.ativo, mensagem_template: editando.mensagem });
  };

  const abrirTeste = (tipo?: string, mensagem?: string) => {
    if (!sessaoDisponivel || identidadeMudou || loadingRegras || erroRegras || testar.isPending || disparar.isPending) return;
    const regraPadrao = regras?.[0];
    const configuracao = tipo && mensagem
      ? { tipo, mensagem }
      : regraPadrao
        ? { tipo: regraPadrao.tipo, mensagem: regraPadrao.mensagem_template }
        : null;
    if (!configuracao) {
      toast.error("Crie ou selecione uma regra antes de enviar o teste.");
      return;
    }
    setTesteConfigurado(configuracao);
    setTelefoneTeste("");
    setResultadoTeste(null);
    setEditando(null);
    setTesteAberto(true);
  };

  const handleTestar = () => {
    if (!sessaoDisponivel || identidadeMudou || loadingRegras || erroRegras || testar.isPending || disparar.isPending || loadingConexao || erroConexao || !conexao?.connected) return;
    if (!testeConfigurado) return;
    if (!telefoneTeste.replace(/\D/g, "").match(/^\d{10,13}$/)) {
      toast.error("Informe um número brasileiro com DDD para receber o teste.");
      return;
    }
    testar.mutate({
      tipo: testeConfigurado.tipo,
      mensagem_template: testeConfigurado.mensagem,
      telefone: telefoneTeste,
    });
  };

  const inserirVariavel = (variavel: string) => {
    if (!editando) return;
    setEditando(prev => prev ? { ...prev, mensagem: prev.mensagem + variavel } : null);
  };

  const regraEditando = regras?.find(r => r.tipo === editando?.tipo);
  if (!sessaoDisponivel || identidadeMudou) return (
    <DashboardLayout>
      <div className="p-6" role={auth.isError ? "alert" : "status"}>
        {auth.isError ? "Sessão indisponível. Nenhuma alteração ou envio pode ser solicitado." : "Conferindo sua sessão antes de carregar notificações…"}
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              {t('notifications.title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('notifications.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={conexao?.connected ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}>
              {loadingConexao ? <Loader2 className="mr-1 size-3 animate-spin" /> : conexao?.connected ? <CheckCheck className="mr-1 size-3" /> : <Phone className="mr-1 size-3" />}
              {loadingConexao ? "Verificando WhatsApp" : conexao?.connected ? "WhatsApp conectado" : "WhatsApp desconectado"}
            </Badge>
            <Button size="sm" onClick={() => abrirTeste()} disabled={loadingRegras || !!erroRegras || loadingConexao || !!erroConexao || !conexao?.connected || testar.isPending || disparar.isPending} className="w-full gap-2 sm:w-auto">
              <Send className="w-4 h-4" />
              Enviar teste
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleProcessarFila(true)} disabled={filaIndisponivel || testar.isPending} className="gap-2">
              {disparar.isPending && disparar.variables?.dryRun ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Validar sem enviar
            </Button>
            <Button variant="outline" size="sm" onClick={() => { disparar.reset(); setConfirmarFila(true); }} disabled={filaIndisponivel || testar.isPending || loadingConexao || !!erroConexao || !conexao?.connected} className="gap-2">
              <Zap className="w-4 h-4" />
              Processar minha fila
            </Button>
          </div>
        </div>

        {(erroRegras || erroGlobal || erroAutomacao || erroConexao) && (
          <p role="alert" className="rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400">
            Não foi possível carregar {erroRegras ? "as regras" : erroConexao ? "a conexão do WhatsApp" : "as preferências da automação"}. Tente novamente antes de alterar esta configuração ou processar a fila.
          </p>
        )}
        {disparar.error && (
          <p role="alert" className="rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400">{disparar.error.message}</p>
        )}
        {disparar.isPending && <p role="status" className="text-sm text-muted-foreground">{disparar.variables?.dryRun ? "Validando sem enviar…" : "Processando sua fila…"}</p>}
        {resultadoFila && (
          <Card>
            <CardContent className="space-y-2 py-4" aria-live="polite">
              <p className="font-semibold">{resultadoFila.dryRun ? "Validação sem envio" : "Resultado do processamento"}</p>
              <p className="text-sm">Elegíveis: {resultadoFila.elegiveis} · Enfileiradas: {resultadoFila.enfileiradas} · Processadas: {resultadoFila.processadas} · Aceitas pela Evolution: {resultadoFila.enviadas}</p>
              <p className="text-sm">Falhas: {resultadoFila.falhas} · Aguardando reconexão: {resultadoFila.aguardandoReconexao} · Revisão manual: {resultadoFila.ambiguas} · {resultadoFila.dryRun ? "Obsoletas" : "Canceladas"}: {resultadoFila.canceladas}</p>
              <p className="text-xs text-muted-foreground">{resultadoFila.dryRun ? "Nenhuma mensagem enviada e nenhuma alteração persistida. A simulação da fila avalia apenas itens já pendentes." : "Aceitação pela Evolution não comprova entrega ou leitura. Itens ambíguos não são reenviados; confira o histórico."} Novos lembretes respeitam o horário de Brasília, a ativação geral e as regras ativas. Cada processamento avalia até 25 itens da sua fila.</p>
            </CardContent>
          </Card>
        )}
        {!loadingConexao && !erroConexao && !conexao?.connected && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            Conecte o WhatsApp da empresa antes de enviar um teste. O teste não depende de as automações estarem ativadas.
          </p>
        )}

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
                aria-label="Ativar automação geral"
                checked={globalAtivo ?? false}
                onCheckedChange={handleToggleGlobal}
                disabled={loadingGlobal || loadingAutomacao || !!erroGlobal || !!erroAutomacao || salvarAutomacao.isPending || disparar.isPending}
                className="scale-125"
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Label htmlFor="horario-automacao" className="text-sm font-medium">Horário do envio</Label>
                <p className="mt-1 text-xs text-muted-foreground">Os lembretes ativos serão enviados diariamente neste horário de Brasília.</p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Input
                  id="horario-automacao"
                  type="time"
                  step="300"
                  value={horario}
                  onChange={(event) => setHorario(event.target.value)}
                  disabled={loadingGlobal || loadingAutomacao || !!erroGlobal || !!erroAutomacao || salvarAutomacao.isPending || disparar.isPending}
                  className="w-full sm:w-32"
                />
                <Button variant="outline" size="sm" onClick={handleSalvarHorario} disabled={loadingGlobal || loadingAutomacao || !!erroGlobal || !!erroAutomacao || salvarAutomacao.isPending || disparar.isPending}>
                  Salvar horário
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {!loadingGlobal && !erroGlobal && !globalAtivo && (
          <p className="text-sm text-muted-foreground">Você pode editar e ligar regras com a automação geral desligada. Isso não ativa os envios automaticamente; o envio depende da ativação geral e do horário configurado.</p>
        )}
        {erroSaude && <p role="alert" className="text-sm text-red-400">Não foi possível carregar a situação da fila.</p>}
        <Card className="border-border bg-muted/20">
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
            {[
              ["Pendentes", saude?.pendentes ?? 0, "text-amber-400"],
              ["Enviando", saude?.enviando ?? 0, "text-blue-400"],
              ["Falhas", saude?.falhas ?? 0, "text-red-400"],
              ["Revisar", saude?.ambiguas ?? 0, "text-orange-400"],
            ].map(([label, valor, cor]) => (
              <div key={String(label)} className="rounded-lg border border-border bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-1 text-lg font-semibold ${cor}`}>{loadingSaude ? "…" : erroSaude ? "—" : valor}</p>
              </div>
            ))}
            <div className="col-span-2 rounded-lg border border-border bg-background/40 p-3 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Último envio</p>
              <p className="mt-1 truncate text-xs font-medium text-foreground">
                {loadingSaude ? "Carregando…" : erroSaude ? "Indisponível" : saude?.ultimoEnvioEm ? new Date(saude.ultimoEnvioEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Sem envio"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
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
            ) : erroRegras ? (
              <p role="alert" className="text-sm text-red-400">Regras indisponíveis. Não foram substituídas por uma lista vazia.</p>
            ) : (
              <div className="space-y-2">
                {(regras ?? []).map((regra) => {
                  const cat = getCategoria(regra.tipo);
                  const Icone = cat.icone;
                  return (
                    <Card key={regra.tipo} className="transition-all">
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
                              disabled={loadingRegras || !!erroRegras || salvar.isPending || toggle.isPending || disparar.isPending}
                              className="h-8 px-2 text-xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1" />
                              {t('common.edit')}
                            </Button>
                            <Switch
                              aria-label={`Ativar regra ${regra.label}`}
                              checked={regra.ativo}
                              onCheckedChange={(val) => handleToggleRegra(regra.tipo, val)}
                              disabled={loadingRegras || !!erroRegras || toggle.isPending || salvar.isPending || disparar.isPending}
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
                ) : erroHistorico ? (
                  <p role="alert" className="text-sm text-red-400">Não foi possível carregar o histórico. A ausência de dados não comprova ausência de envios.</p>
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
                        {(() => {
                          const statusEnvio = getStatusEnvio(log.status);
                          const StatusIcon = statusEnvio.icone;
                          return <StatusIcon className={`w-4 h-4 mt-0.5 shrink-0 ${statusEnvio.cor.split(" ")[1]}`} />;
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {log.tipo === "teste_envio" ? "Teste de envio" : (log.clientes as { nome: string } | null)?.nome ?? "—"}
                            </span>
                            <Badge variant="outline" className={`text-xs ${getCategoria(log.tipo).cor}`}>
                              {getCategoria(log.tipo).label}
                            </Badge>
                            {(() => {
                              const statusEnvio = getStatusEnvio(log.status);
                              return <Badge variant="outline" className={`text-xs ${statusEnvio.cor}`}>{statusEnvio.label}</Badge>;
                            })()}
                            <span className="text-xs text-muted-foreground">{log.telefone}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {log.mensagem?.substring(0, 100)}
                          </p>
                          {log.erro && <p className="text-xs text-red-400 mt-0.5">{log.erro}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(log.createdAt).toLocaleString(i18n.language === "es" ? "es-ES" : "pt-BR")}
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
      <Dialog open={!!editando} onOpenChange={(open) => !open && !salvar.isPending && setEditando(null)}>
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
                    .replace(/{nome}/g, t('whatsapp.exampleName') ?? 'João Silva')
                    .replace(/{valor}/g, "250,00")
                    .replace(/{data_vencimento}/g, new Date().toLocaleDateString(i18n.language === "es" ? "es-ES" : "pt-BR"))
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
            <Button variant="outline" onClick={() => editando && abrirTeste(editando.tipo, editando.mensagem)} disabled={!conexao?.connected} className="gap-2">
              <Send className="w-4 h-4" />
              Testar em um número
            </Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending || toggle.isPending || loadingRegras || !!erroRegras || !editando?.mensagem.trim()} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {salvar.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarFila} onOpenChange={(open) => !open && !disparar.isPending && setConfirmarFila(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar processamento da minha fila</DialogTitle>
            <DialogDescription>Esta ação pode enviar mensagens reais pelo WhatsApp da sua empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Somente suas regras ativas e seus próprios clientes são considerados, com a ativação geral e o horário de Brasília respeitados. Nenhuma regra ou automação será ativada por esta ação.</p>
            <p>Até 25 itens pendentes da sua fila serão revalidados antes do envio. Relatórios próprios já autorizados também podem estar na fila. Mensagens ambíguas e testes manuais não são reenviados.</p>
            <p className="text-muted-foreground">Para conferir sem enviar nem persistir alterações, cancele e use “Validar sem enviar”. A aceitação pela Evolution não é prova de entrega ou leitura.</p>
            {disparar.error && <p role="alert" className="text-red-400">{disparar.error.message}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmarFila(false)} disabled={disparar.isPending}>Cancelar</Button>
            <Button onClick={() => handleProcessarFila(false)} disabled={filaIndisponivel || testar.isPending || loadingConexao || !!erroConexao || !conexao?.connected} className="gap-2">
              {disparar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {disparar.isPending ? "Processando…" : "Confirmar envio da minha fila"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG TESTE DE ENVIO ───────────────────────────────────────────── */}
      <Dialog open={testeAberto} onOpenChange={(open) => !open && !testar.isPending && setTesteAberto(false)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Testar envio pelo WhatsApp
            </DialogTitle>
          </DialogHeader>

          {!resultadoTeste ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-200">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-blue-400" />
                  <p>O teste envia uma cópia apenas para o número informado. Nenhum cliente é selecionado nem recebe mensagem automática.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone-teste">Número que receberá o teste</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="telefone-teste"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(11) 99999-9999"
                    value={telefoneTeste}
                    onChange={(event) => setTelefoneTeste(event.target.value)}
                    disabled={testar.isPending}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Use um número brasileiro com DDD. O sistema adiciona o código +55 quando necessário.</p>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Mensagem que será testada</p>
                <p className="mt-1 text-sm font-medium text-foreground">{regras?.find((regra) => regra.tipo === testeConfigurado?.tipo)?.label ?? "Mensagem selecionada"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {(testeConfigurado?.mensagem ?? "")
                    .replace(/{nome}/g, "João Silva (teste)")
                    .replace(/{valor}/g, "250,00")
                    .replace(/{data_vencimento}/g, new Date().toLocaleDateString("pt-BR"))
                    .replace(/{dias_atraso}/g, "2")
                    .replace(/{empresa}/g, "Sua Empresa")
                    .replace(/{parcela}/g, "3")
                    .replace(/{total_parcelas}/g, "12")}
                </p>
              </div>

              {!conexao?.connected && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-300">
                  O WhatsApp da empresa está desconectado. Conecte-o antes de enviar o teste.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4" aria-live="polite">
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-500/15 p-2">
                    <ShieldCheck className="size-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-300">Aceito pela Evolution</p>
                    <p className="mt-1 text-sm text-muted-foreground">A API aceitou a solicitação de envio para {resultadoTeste.telefone} às {new Date(resultadoTeste.aceitoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
                <p className="font-medium">O que este teste confirma</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ele confirma que a Evolution API aceitou o envio. “Entregue” e “Lido” dependem do retorno assíncrono do WhatsApp; a ausência desse recibo não prova que a mensagem não chegou.</p>
              </div>

              {resultadoTeste.providerMessageId && (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Identificador do envio</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">{resultadoTeste.providerMessageId}</p>
                </div>
              )}
              {!resultadoTeste.historicoRegistrado && (
                <p className="text-xs text-amber-300">A mensagem foi aceita, mas este ambiente não conseguiu registrar a linha no histórico.</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {resultadoTeste ? (
              <>
                <Button variant="outline" onClick={() => { setResultadoTeste(null); setTelefoneTeste(""); }}>
                  Novo teste
                </Button>
                <Button onClick={() => { setTesteAberto(false); setAbaAtiva("historico"); }} className="gap-2">
                  <History className="size-4" />
                  Ver no histórico
                </Button>
              </>
            ) : (
              <Button onClick={handleTestar} disabled={testar.isPending || !conexao?.connected || !telefoneTeste.trim()} className="w-full gap-2 sm:w-auto">
                {testar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {testar.isPending ? "Enviando teste…" : "Enviar mensagem de teste"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
