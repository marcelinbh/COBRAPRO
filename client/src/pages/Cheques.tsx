import { useTranslation } from 'react-i18next';
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { decimalCheque40, diaCheque40, type Cheque40Request } from "../../../shared/cheques40";
import { lerIntencaoCheque40, reservarIntencaoCheque40, concluirIntencaoCheque40, concluirAbandonoCheque40 } from "@/lib/cheques40Intent";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileCheck, Plus, Clock, CheckCircle2, XCircle, AlertTriangle,
  Calculator, TrendingDown, DollarSign, ArrowRight
} from "lucide-react";
import { formatarMoeda } from "../../../shared/finance";

// STATUS_CONFIG is now a function that returns translated labels
function getStatusConfig(t: (key: string) => string): Record<string, { label: string; color: string; icon: React.ReactNode }> {
  return {
    em_carteira: { label: 'Em carteira', color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: <Clock className="h-3 w-3" /> },
    descontado: { label: 'Descontado', color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: <Clock className="h-3 w-3" /> },
    compensado: { label: t('common.completed'), color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <CheckCircle2 className="h-3 w-3" /> },
    devolvido: { label: t('cheques.returned'), color: "text-red-400 bg-red-400/10 border-red-400/20", icon: <AlertTriangle className="h-3 w-3" /> },
    cancelado: { label: t('common.cancelled'), color: "text-muted-foreground bg-muted/30 border-border", icon: <XCircle className="h-3 w-3" /> },
  };
}

export default function Cheques() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [temPendente40, setTemPendente40] = useState(false);
  const [preparando40, setPreparando40] = useState(false);
  useEffect(() => {
    if (!user) return;
    try { setTemPendente40(Boolean(lerIntencaoCheque40(localStorage, user.id))); }
    catch (e) { setTemPendente40(true); toast.error((e as Error).message); }
  }, [user?.id]);
  const STATUS_CONFIG = getStatusConfig(t);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogDevolverAberto, setDialogDevolverAberto] = useState(false);
  const [chequeIdDevolver, setChequeIdDevolver] = useState<number | null>(null);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");

  // Simulação em tempo real
  const [sim, setSim] = useState({
    valorNominal: "",
    dataVencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    taxaDesconto: "3",
    tipoTaxa: "mensal" as "mensal" | "diaria" | "anual",
  });

  // Form de cadastro
  const [form, setForm] = useState({
    clienteId: "",
    numeroCheque: "",
    banco: "",
    agencia: "",
    conta: "",
    emitente: "",
    cpfCnpjEmitente: "",
    valorNominal: "",
    dataVencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    taxaDesconto: "3",
    tipoTaxa: "mensal" as "mensal" | "diaria" | "anual",
    contaCaixaId: "",
    observacoes: "",
  });

  const utils = trpc.useUtils();
  const { data: resumo } = trpc.cheques.resumo.useQuery();
  const { data: listaCheques, isLoading } = trpc.cheques.listar.useQuery(
    filtroStatus !== "todos" ? { status: filtroStatus as "em_carteira" | "descontado" | "compensado" | "devolvido" | "cancelado" } : undefined
  );
  const { data: clientesData } = trpc.clientes.list.useQuery({});
  const clientes = clientesData?.clientes ?? [];
  const { data: metadataCaixa40 } = trpc.caixa.contasParaOperacao37.useQuery();
  const contasCaixa = metadataCaixa40?.empresaId === user?.id ? metadataCaixa40?.contas : [];

  // Simulação
  const simValor = parseFloat(sim.valorNominal.replace(",", ".")) || 0;
  const simTaxa = parseFloat(sim.taxaDesconto) || 0;
  const { data: simResult } = trpc.cheques.simular.useQuery(
    simValor > 0 && simTaxa > 0 && sim.dataVencimento
      ? { valorNominal: simValor, dataVencimento: sim.dataVencimento, taxaDesconto: simTaxa, tipoTaxa: sim.tipoTaxa }
      : { valorNominal: 1000, dataVencimento: sim.dataVencimento, taxaDesconto: 3, tipoTaxa: "mensal" },
    { enabled: simValor > 0 && simTaxa > 0 }
  );

  const cheque40 = trpc.cheques.executar40.useMutation({ retry: false });
  const fence40 = trpc.cheques.abandonar40.useMutation({ retry: false });
  async function enviar40(request?: Cheque40Request) {
    if (!user || preparando40 || cheque40.isPending || fence40.isPending) return;
    if (!navigator.locks) { toast.error("Este navegador não oferece bloqueio seguro entre abas. Operação não enviada."); return; }
    const owner = user.id;
    setPreparando40(true);
    try {
      await navigator.locks.request(`cobrapro.cheques40.${owner}`, async () => {
        const intent = request
          ? reservarIntencaoCheque40(localStorage, owner, request, () => crypto.randomUUID())
          : lerIntencaoCheque40(localStorage, owner);
        if (!intent) throw new Error("Nenhuma intenção pendente para recuperar.");
        setTemPendente40(true);
        // Mesma procedure = recovery transacional da intenção exata; nunca novo UUID.
        const result = await cheque40.mutateAsync(intent);
        concluirIntencaoCheque40(localStorage, owner, intent);
        setTemPendente40(false);
        if (intent.request.acao === "criar") setForm(current => ({ ...current, clienteId: "", emitente: "", valorNominal: "", numeroCheque: "", observacoes: "" }));
        await Promise.all([utils.cheques.listar.invalidate(), utils.cheques.resumo.invalidate(), utils.caixa.invalidate()]);
        setDialogAberto(false); setDialogDevolverAberto(false); setMotivoDevolucao("");
        toast.success(`Cheque ${result.status}. Movimento no Caixa confirmado${result.repetida ? " (recuperado)" : ""}.`);
      });
    } catch (e) {
      // Qualquer erro preserva a intenção: nem timeout nem resposta inválida demonstram ausência.
      toast.error((e as Error).message + " A intenção foi preservada; use Recuperar mesma intenção.");
    } finally { setPreparando40(false); }
  }
  async function abandonar40() {
    if (!user || preparando40 || cheque40.isPending || fence40.isPending || !navigator.locks) return;
    if (!window.confirm("Confirmar abandono? O servidor recuperará a operação se ela já foi executada. Se não foi, impedirá para sempre a execução desta intenção.")) return;
    const owner = user.id; setPreparando40(true);
    try {
      await navigator.locks.request(`cobrapro.cheques40.${owner}`, async () => {
        const intent = lerIntencaoCheque40(localStorage, owner);
        if (!intent) throw new Error("Nenhuma intenção preservada.");
        const proof = await fence40.mutateAsync(intent);
        concluirAbandonoCheque40(localStorage, owner, intent, proof);
        setTemPendente40(false);
        await Promise.all([utils.cheques.listar.invalidate(), utils.cheques.resumo.invalidate(), utils.caixa.invalidate()]);
        toast.success(proof.estado === "executada" ? "Operação anterior recuperada; não foi abandonada nem duplicada." : "Ausência confirmada e intenção impedida no servidor. Agora é seguro corrigir os dados.");
      });
    } catch (e) { toast.error((e as Error).message + " A intenção continua preservada."); }
    finally { setPreparando40(false); }
  }
  const ocupado40 = preparando40 || cheque40.isPending || fence40.isPending || temPendente40;
  function handleCriar() {
    try {
      const text = (v: string) => v.trim() || null;
      const request: Cheque40Request = {
        acao: "criar", dataOperacao: diaCheque40(), clienteId: Number(form.clienteId), contaCaixaId: Number(form.contaCaixaId),
        emitente: form.emitente.trim(), numeroCheque: form.numeroCheque.trim(), banco: text(form.banco), agencia: text(form.agencia),
        conta: text(form.conta), cpfCnpjEmitente: text(form.cpfCnpjEmitente), valorNominal: decimalCheque40(form.valorNominal),
        dataVencimento: form.dataVencimento, taxaDesconto: decimalCheque40(form.taxaDesconto, 2), tipoTaxa: form.tipoTaxa,
        observacoes: text(form.observacoes),
      };
      void enviar40(request);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="rounded border border-amber-500/40 p-3 text-sm" role="status">
        Cheques novos usam transação única com Caixa compartilhado, inclusive contas com empréstimos e aportes.
        Cheques legados permanecem somente leitura; nenhuma informação histórica é inferida.
        {temPendente40 && <p>Existe uma intenção financeira preservada. Não altere o pedido nem envie outra operação.</p>}
        <Button variant="outline" className="ml-2" onClick={() => void enviar40()} disabled={!temPendente40 || preparando40 || cheque40.isPending}>
          Recuperar mesma intenção
        </Button>
        <Button variant="outline" className="ml-2" onClick={() => void abandonar40()} disabled={!temPendente40 || preparando40 || cheque40.isPending || fence40.isPending}>
          Confirmar abandono seguro
        </Button>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FileCheck className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Desconto de Cheques</h1>
            <p className="text-sm text-muted-foreground">{t('checks.anticipateReceivables')}</p>
          </div>
        </div>
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cheque
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Desconto de Cheque</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Cliente *</Label>
                  <Select value={form.clienteId} onValueChange={(v) => setForm({ ...form, clienteId: v })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecionar cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('cheques.issuer')} *</Label>
                  <Input className="bg-background border-border" placeholder={t('cheques.issuer')} value={form.emitente} onChange={(e) => setForm({ ...form, emitente: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('common.cpfCnpj')}</Label>
                  <Input className="bg-background border-border" placeholder="000.000.000-00" value={form.cpfCnpjEmitente} onChange={(e) => setForm({ ...form, cpfCnpjEmitente: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('cheques.checkNumber')} *</Label>
                  <Input className="bg-background border-border" placeholder="000000" value={form.numeroCheque} onChange={(e) => setForm({ ...form, numeroCheque: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('cheques.bank')}</Label>
                  <Input className="bg-background border-border" placeholder={t('cheques.bank')} value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('checks.agency')}</Label>
                  <Input className="bg-background border-border" placeholder="0000" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('cashbox.account')}</Label>
                  <Input className="bg-background border-border" placeholder="00000-0" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('cheques.nominalValue')} (R$) *</Label>
                  <Input className="bg-background border-border" placeholder="0,00" value={form.valorNominal} onChange={(e) => setForm({ ...form, valorNominal: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('common.dueDate')} *</Label>
                  <Input type="date" className="bg-background border-border" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('cheques.discountRate')} (%) *</Label>
                  <Input className="bg-background border-border" placeholder="3" value={form.taxaDesconto} onChange={(e) => setForm({ ...form, taxaDesconto: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('cheques.rateType')}</Label>
                  <Select value={form.tipoTaxa} onValueChange={(v) => setForm({ ...form, tipoTaxa: v as "mensal" | "diaria" | "anual" })}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">{t('common.monthly')}</SelectItem>
                      <SelectItem value="diaria">{t('checks.dailyRate')}</SelectItem>
                      <SelectItem value="anual">{t('common.annual')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>{t('emprestimos.cashAccount')} *</Label>
                  <Select value={form.contaCaixaId} onValueChange={(v) => setForm({ ...form, contaCaixaId: v })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder={t('emprestimos.cashAccount')} />
                    </SelectTrigger>
                    <SelectContent>
                      {contasCaixa?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>{t('checks.observations')}</Label>
                  <Textarea className="bg-background border-border resize-none" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCriar} disabled={ocupado40}>
                {ocupado40 ? t('common.saving') : t('cheques.newCheque')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Em carteira / descontados</p>
            <p className="text-xl font-bold text-amber-400">{formatarMoeda(resumo?.totalAguardando ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{resumo?.qtdAguardando ?? 0} cheques</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Compensados</p>
            <p className="text-xl font-bold text-emerald-400">{formatarMoeda(resumo?.totalCompensado ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{resumo?.qtdCompensado ?? 0} cheques</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Devolvidos</p>
            <p className="text-xl font-bold text-red-400">{formatarMoeda(resumo?.totalDevolvido ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{resumo?.qtdDevolvido ?? 0} cheques</p>
          </CardContent>
        </Card>
      </div>

      {/* Simulador */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4 text-blue-400" />
            Simulador de Desconto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor Nominal</Label>
              <Input className="bg-background border-border h-9 text-sm" placeholder="R$ 0,00" value={sim.valorNominal} onChange={(e) => setSim({ ...sim, valorNominal: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" className="bg-background border-border h-9 text-sm" value={sim.dataVencimento} onChange={(e) => setSim({ ...sim, dataVencimento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Taxa (%)</Label>
              <Input className="bg-background border-border h-9 text-sm" placeholder="3" value={sim.taxaDesconto} onChange={(e) => setSim({ ...sim, taxaDesconto: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={sim.tipoTaxa} onValueChange={(v) => setSim({ ...sim, tipoTaxa: v as "mensal" | "diaria" | "anual" })}>
                <SelectTrigger className="bg-background border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="diaria">{t('checks.dailyRate')}</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {simValor > 0 && simResult && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 flex-wrap">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Valor Nominal</p>
                <p className="font-bold text-base">{formatarMoeda(simValor)}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Desconto ({simResult.diasAteVencimento}d)</p>
                <p className="font-bold text-base text-red-400">- {formatarMoeda(simResult.valorDesconto)}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Valor Líquido</p>
                <p className="font-bold text-xl text-emerald-400">{formatarMoeda(simResult.valorLiquido)}</p>
              </div>
              <div className="ml-auto text-center">
                <p className="text-xs text-muted-foreground">Taxa Efetiva Total</p>
                <p className="font-bold text-base text-amber-400">{simResult.taxaEfetivaTotal.toFixed(2)}%</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {["todos", "em_carteira", "descontado", "compensado", "devolvido", "cancelado"].map((s) => (
          <Button
            key={s}
            variant={filtroStatus === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroStatus(s)}
            className={filtroStatus === s ? "bg-primary text-primary-foreground" : "border-border"}
          >
            {s === "todos" ? "Todos" : STATUS_CONFIG[s]?.label ?? s}
          </Button>
        ))}
      </div>

      {/* Lista de Cheques */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : !listaCheques || listaCheques.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <FileCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum cheque encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">Clique em {t('checks.newCheck')} para registrar</p>
            </CardContent>
          </Card>
        ) : (
          listaCheques.map((cheque) => {
            const statusCfg = STATUS_CONFIG[cheque.status] ?? { label: cheque.status ?? "Status histórico não informado", color: "text-muted-foreground border-border", icon: null };
            const vencimento = cheque.dataVencimento ? new Date(cheque.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
            return (
              <Card key={cheque.id} className="bg-card border-border hover:border-border/80 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{cheque.emitente ?? "Emitente histórico não informado"}</p>
                        {cheque.numeroCheque && (
                          <span className="text-xs text-muted-foreground">Nº {cheque.numeroCheque}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span>Cliente: {cheque.clienteNome ?? "—"}</span>
                        {cheque.banco && <><span>•</span><span>{cheque.banco}</span></>}
                        <span>•</span>
                        <span>Vence: {vencimento}</span>
                        <span>•</span>
                        <span>Taxa: {cheque.taxaDesconto == null ? "não informada" : `${parseFloat(cheque.taxaDesconto).toFixed(2)}%`} {cheque.tipoTaxa ?? "(período histórico não informado)"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Nominal</p>
                        <p className="font-bold text-sm">{formatarMoeda(parseFloat(cheque.valorNominal))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t('checks.netAmount')}</p>
                        <p className="font-bold text-base text-emerald-400">{cheque.valorLiquido == null ? "Não informado" : formatarMoeda(parseFloat(cheque.valorLiquido))}</p>
                      </div>
                      <Badge className={`text-xs border ${statusCfg.color} flex items-center gap-1`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Ações */}
                  {cheque.status === "descontado" && cheque.novo40 && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                        onClick={() => void enviar40({ acao: "compensar", id: cheque.id, dataOperacao: diaCheque40() })}
                        disabled={ocupado40}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Compensado
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 flex-1"
                        onClick={() => { setChequeIdDevolver(cheque.id); setDialogDevolverAberto(true); }}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                        Devolvido
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border"
                        disabled={ocupado40}
                        onClick={() => void enviar40({ acao: "cancelar", id: cheque.id, dataOperacao: diaCheque40() })}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {cheque.status === "devolvido" && cheque.motivoDevolucao && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-red-400">Motivo: {cheque.motivoDevolucao}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog de Devolução */}
      <Dialog open={dialogDevolverAberto} onOpenChange={setDialogDevolverAberto}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Devolução</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Motivo da Devolução *</Label>
              <Textarea
                className="bg-background border-border resize-none"
                placeholder="Ex: Sem fundos, conta encerrada..."
                rows={3}
                value={motivoDevolucao}
                onChange={(e) => setMotivoDevolucao(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (!motivoDevolucao.trim()) { toast.error(t('toast_error.informe_o_motivo_da_devolução')); return; }
                void enviar40({ acao: "devolver", id: chequeIdDevolver!, motivo: motivoDevolucao.trim(), dataOperacao: diaCheque40() });
              }}
              disabled={ocupado40}
            >
              Confirmar Devolução
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
