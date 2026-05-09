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
import { toast } from "sonner";
import {
  FileCheck, Plus, Clock, CheckCircle2, XCircle, AlertTriangle,
  Calculator, TrendingDown, DollarSign, ArrowRight
} from "lucide-react";
import { formatarMoeda } from "../../../shared/finance";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  aguardando: { label: "Aguardando", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: <Clock className="h-3 w-3" /> },
  compensado: { label: "Compensado", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  devolvido: { label: "Devolvido", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: <AlertTriangle className="h-3 w-3" /> },
  cancelado: { label: "Cancelado", color: "text-muted-foreground bg-muted/30 border-border", icon: <XCircle className="h-3 w-3" /> },
};

export default function Cheques() {
  const { t } = useTranslation();
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
    filtroStatus !== "todos" ? { status: filtroStatus as "aguardando" | "compensado" | "devolvido" | "cancelado" } : undefined
  );
  const { data: clientesData } = trpc.clientes.list.useQuery({});
  const clientes = clientesData?.clientes ?? [];
  const { data: contasCaixa } = trpc.caixa.contas.useQuery();

  // Simulação
  const simValor = parseFloat(sim.valorNominal.replace(",", ".")) || 0;
  const simTaxa = parseFloat(sim.taxaDesconto) || 0;
  const { data: simResult } = trpc.cheques.simular.useQuery(
    simValor > 0 && simTaxa > 0 && sim.dataVencimento
      ? { valorNominal: simValor, dataVencimento: sim.dataVencimento, taxaDesconto: simTaxa, tipoTaxa: sim.tipoTaxa }
      : { valorNominal: 1000, dataVencimento: sim.dataVencimento, taxaDesconto: 3, tipoTaxa: "mensal" },
    { enabled: simValor > 0 && simTaxa > 0 }
  );

  const criarMutation = trpc.cheques.criar.useMutation({
    onSuccess: (data) => {
      utils.cheques.listar.invalidate();
      utils.cheques.resumo.invalidate();
      setDialogAberto(false);
      setForm({ clienteId: "", numeroCheque: "", banco: "", agencia: "", conta: "", emitente: "", cpfCnpjEmitente: "", valorNominal: "", dataVencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], taxaDesconto: "3", tipoTaxa: "mensal", contaCaixaId: "", observacoes: "" });
      toast.success(`Cheque registrado! Valor líquido: ${formatarMoeda(data.valorLiquido)}`);
    },
    onError: (e) => toast.error(t("toast.errorPrefix") + e.message),
  });

  const compensarMutation = trpc.cheques.compensar.useMutation({
    onSuccess: () => {
      utils.cheques.listar.invalidate();
      utils.cheques.resumo.invalidate();
      toast.success(t('toast_success.cheque_marcado_como_compensado'));
    },
    onError: (e) => toast.error(t("toast.errorPrefix") + e.message),
  });

  const devolverMutation = trpc.cheques.devolver.useMutation({
    onSuccess: () => {
      utils.cheques.listar.invalidate();
      utils.cheques.resumo.invalidate();
      setDialogDevolverAberto(false);
      setMotivoDevolucao("");
      toast.success(t('toast_success.cheque_marcado_como_devolvido'));
    },
    onError: (e) => toast.error(t("toast.errorPrefix") + e.message),
  });

  const cancelarMutation = trpc.cheques.cancelar.useMutation({
    onSuccess: () => {
      utils.cheques.listar.invalidate();
      utils.cheques.resumo.invalidate();
      toast.success(t('toast_success.cheque_cancelado'));
    },
  });

  function handleCriar() {
    const valor = parseFloat(form.valorNominal.replace(",", "."));
    const taxa = parseFloat(form.taxaDesconto);
    if (!form.clienteId || !form.emitente || !valor || !taxa || !form.dataVencimento) {
      toast.error(t('toast_error.preencha_todos_os_campos_obrigatórios'));
      return;
    }
    criarMutation.mutate({
      clienteId: parseInt(form.clienteId),
      numeroCheque: form.numeroCheque || undefined,
      banco: form.banco || undefined,
      agencia: form.agencia || undefined,
      conta: form.conta || undefined,
      emitente: form.emitente,
      cpfCnpjEmitente: form.cpfCnpjEmitente || undefined,
      valorNominal: valor,
      dataVencimento: form.dataVencimento,
      taxaDesconto: taxa,
      tipoTaxa: form.tipoTaxa,
      contaCaixaId: form.contaCaixaId ? parseInt(form.contaCaixaId) : undefined,
      observacoes: form.observacoes || undefined,
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
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
                  <Label>Emitente do Cheque *</Label>
                  <Input className="bg-background border-border" placeholder="Nome do emitente" value={form.emitente} onChange={(e) => setForm({ ...form, emitente: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF/CNPJ Emitente</Label>
                  <Input className="bg-background border-border" placeholder="000.000.000-00" value={form.cpfCnpjEmitente} onChange={(e) => setForm({ ...form, cpfCnpjEmitente: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nº do Cheque</Label>
                  <Input className="bg-background border-border" placeholder="000000" value={form.numeroCheque} onChange={(e) => setForm({ ...form, numeroCheque: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Banco</Label>
                  <Input className="bg-background border-border" placeholder="Ex: Bradesco" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('checks.agency')}</Label>
                  <Input className="bg-background border-border" placeholder="0000" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Conta</Label>
                  <Input className="bg-background border-border" placeholder="00000-0" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor Nominal (R$) *</Label>
                  <Input className="bg-background border-border" placeholder="0,00" value={form.valorNominal} onChange={(e) => setForm({ ...form, valorNominal: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Vencimento *</Label>
                  <Input type="date" className="bg-background border-border" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Taxa de Desconto (%) *</Label>
                  <Input className="bg-background border-border" placeholder="3" value={form.taxaDesconto} onChange={(e) => setForm({ ...form, taxaDesconto: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de Taxa</Label>
                  <Select value={form.tipoTaxa} onValueChange={(v) => setForm({ ...form, tipoTaxa: v as "mensal" | "diaria" | "anual" })}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="diaria">{t('checks.dailyRate')}</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Conta de Caixa (opcional)</Label>
                  <Select value={form.contaCaixaId} onValueChange={(v) => setForm({ ...form, contaCaixaId: v })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecionar conta..." />
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
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCriar} disabled={criarMutation.isPending}>
                {criarMutation.isPending ? "Registrando..." : "Registrar Cheque"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Aguardando</p>
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
        {["todos", "aguardando", "compensado", "devolvido", "cancelado"].map((s) => (
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
            const statusCfg = STATUS_CONFIG[cheque.status] ?? STATUS_CONFIG.aguardando;
            const vencimento = cheque.dataVencimento ? new Date(cheque.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
            return (
              <Card key={cheque.id} className="bg-card border-border hover:border-border/80 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{cheque.emitente}</p>
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
                        <span>Taxa: {parseFloat(cheque.taxaDesconto).toFixed(2)}% {cheque.tipoTaxa}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Nominal</p>
                        <p className="font-bold text-sm">{formatarMoeda(parseFloat(cheque.valorNominal))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t('checks.netAmount')}</p>
                        <p className="font-bold text-base text-emerald-400">{formatarMoeda(parseFloat(cheque.valorLiquido))}</p>
                      </div>
                      <Badge className={`text-xs border ${statusCfg.color} flex items-center gap-1`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Ações */}
                  {cheque.status === "aguardando" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                        onClick={() => compensarMutation.mutate({ id: cheque.id })}
                        disabled={compensarMutation.isPending}
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
                        onClick={() => cancelarMutation.mutate({ id: cheque.id })}
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
                devolverMutation.mutate({ id: chequeIdDevolver!, motivo: motivoDevolucao });
              }}
              disabled={devolverMutation.isPending}
            >
              Confirmar Devolução
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
