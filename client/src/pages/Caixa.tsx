import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Wallet, ArrowUpRight, ArrowDownRight, Building2, PlusCircle, MinusCircle, ClipboardCheck, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { formatarMoeda } from "../../../shared/finance";

// ── Modal: Nova Conta ─────────────────────────────────────────────────────────
function NovaConta({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo: "caixa", banco: "", saldoInicial: "0" });

  const mutation = trpc.caixa.criarConta.useMutation({
    onSuccess: () => { toast.success(t('toast_success.conta_criada')); setOpen(false); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" />{t('cashbox.newTransaction')}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">{t('cashbox.title').toUpperCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>{t('cashbox.account')} *</Label>
            <Input className="mt-1" placeholder={t('placeholder.ex_caixa_principal')} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <Label>{t('cashbox.type')}</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="caixa">{t('cashbox.other')}</SelectItem>
                <SelectItem value="banco">{t('cashbox.account')}</SelectItem>
                <SelectItem value="digital">{t('cashbox.account')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.tipo === 'banco' && (
            <div>
              <Label>{t('cashbox.account')}</Label>
              <Input className="mt-1" placeholder={t('placeholder.ex_banco')} value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
            </div>
          )}
          <div>
            <Label>{t('cashbox.balance')} (R$)</Label>
            <Input className="mt-1" type="number" step="0.01" value={form.saldoInicial} onChange={e => setForm(f => ({ ...f, saldoInicial: e.target.value }))} />
          </div>
          <Button
            className="w-full"
            disabled={!form.nome || mutation.isPending}
            onClick={() => mutation.mutate({ nome: form.nome, tipo: form.tipo as any, banco: form.banco || undefined, saldoInicial: parseFloat(form.saldoInicial) })}
          >
            {mutation.isPending ? t('common.saving') : t('cashbox.createAccount')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal: Nova Transação (completo) ─────────────────────────────────────────
function NovaTransacao({ contas, onSuccess }: { contas: { id: number; nome: string }[]; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contaCaixaId: "", tipo: "entrada", categoria: "outros", valor: "", descricao: "" });

  const mutation = trpc.caixa.registrarTransacao.useMutation({
    onSuccess: () => { toast.success(t('toast_success.transação_registrada')); setOpen(false); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />{t('cashbox.newTransaction')}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">{t('cashbox.newTransaction').toUpperCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>{t('cashbox.account')} *</Label>
            <Select value={form.contaCaixaId} onValueChange={v => setForm(f => ({ ...f, contaCaixaId: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={t('emprestimos.cashAccount')} /></SelectTrigger>
              <SelectContent>
                {contas.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('cashbox.type')}</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {['entrada', 'saida'].map(t => (
                <button
                  key={t}
                  className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                    form.tipo === t
                      ? t === 'entrada' ? 'border-success bg-success/15 text-success' : 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                  onClick={() => setForm(f => ({ ...f, tipo: t }))}
                >
                  {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>{t('cashbox.type')}</Label>
            <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagamento_parcela">{t('cashbox.paymentReceived')}</SelectItem>
                <SelectItem value="emprestimo_liberado">{t('cashbox.loanDisbursement')}</SelectItem>
                <SelectItem value="despesa_operacional">{t('cashbox.operationalExpense')}</SelectItem>
                <SelectItem value="transferencia_conta">{t('cashbox.other')}</SelectItem>
                <SelectItem value="ajuste_manual">{t('cashbox.other')}</SelectItem>
                <SelectItem value="outros">{t('cashbox.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('cashbox.amount')} (R$) *</Label>
            <Input className="mt-1" type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
          </div>
          <div>
            <Label>{t('cashbox.description')}</Label>
            <Input className="mt-1" placeholder={t('cashflow.descriptionPlaceholder')} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <Button
            className="w-full"
            disabled={!form.contaCaixaId || !form.valor || mutation.isPending}
            onClick={() => mutation.mutate({
              contaCaixaId: parseInt(form.contaCaixaId),
              tipo: form.tipo as any,
              categoria: form.categoria as any,
              valor: parseFloat(form.valor),
              descricao: form.descricao || undefined,
            })}
          >
            {mutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal: Lançamento Rápido (Adicionar / Debitar) ────────────────────────────
function LancamentoRapido({
  conta,
  tipo,
  onSuccess,
}: {
  conta: { id: number; nome: string };
  tipo: "entrada" | "saida";
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");

  const mutation = trpc.caixa.registrarTransacao.useMutation({
    onSuccess: () => {
      toast.success(tipo === "entrada" ? t("toast.balanceAdded") : t("toast.balanceDebited"));
      setOpen(false);
      setValor("");
      setDescricao("");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const isEntrada = tipo === "entrada";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
            isEntrada
              ? "bg-success/15 hover:bg-success/30 text-success"
              : "bg-primary/15 hover:bg-primary/30 text-primary"
          }`}
          title={isEntrada ? t('cashbox.addBalance') : t('cashbox.debitBalance')}
        >
          {isEntrada ? <PlusCircle className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">
            {isEntrada ? `➕ ${t('cashbox.addBalance').toUpperCase()}` : `➖ ${t('cashbox.debitBalance').toUpperCase()}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            {t('cashbox.account')}: <span className="font-medium text-foreground">{conta.nome}</span>
          </div>
          <div>
            <Label>{t('cashbox.amount')} (R$) *</Label>
            <Input
              className="mt-1 text-lg font-semibold"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={valor}
              onChange={e => setValor(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label>{t('cashbox.description')} ({t('common.optional')})</Label>
            <Input
              className="mt-1"
              placeholder={isEntrada ? t('placeholder.ex_deposito') : t('placeholder.ex_retirada')}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              className={isEntrada ? "bg-success hover:bg-success/90 text-white" : ""}
              variant={isEntrada ? "default" : "destructive"}
              disabled={!valor || parseFloat(valor) <= 0 || mutation.isPending}
              onClick={() => mutation.mutate({
                contaCaixaId: conta.id,
                tipo,
                categoria: "ajuste_manual",
                valor: parseFloat(valor),
                descricao: descricao || (isEntrada ? t('cashbox.addBalance') : t('cashbox.debitBalance')),
              })}
            >
              {mutation.isPending ? t('common.saving') : isEntrada ? t('common.add') : t('cashbox.debit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Conferência operacional (somente leitura) ─────────────────────────────────
function ConferenciaCaixa() {
  const [open, setOpen] = useState(false);
  const { data, isFetching, error, refetch } = trpc.caixa.conferencia.useQuery(undefined, {
    enabled: open,
    staleTime: 0,
  });

  const formatarData = (valor?: string) => valor
    ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ClipboardCheck className="h-4 w-4" /> Conferir caixa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> CONFERÊNCIA FINANCEIRA
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100 flex gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
          <span>Esta conferência é somente leitura: ela não cria, edita ou apaga lançamentos. Revise as divergências antes de qualquer ajuste manual.</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {data?.geradoEm ? `Atualizado em ${formatarData(data.geradoEm)}` : 'Carregue os dados para iniciar a conferência.'}
          </p>
          <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Conferindo...' : 'Atualizar conferência'}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Não foi possível conferir o caixa: {error.message}
          </div>
        )}

        {isFetching && !data && (
          <div className="py-10 text-center text-sm text-muted-foreground">Lendo o livro-caixa e os pagamentos registrados...</div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Contas</p><p className="font-semibold text-lg">{data.resumo.contas}</p></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Movimentos</p><p className="font-semibold text-lg">{data.resumo.movimentos}</p></div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Divergências</p><p className="font-semibold text-lg text-primary">{data.resumo.divergencias}</p></div>
              <div className={`rounded-lg border p-3 ${data.resumo.criticas > 0 ? 'border-destructive/40 bg-destructive/10' : 'border-success/30 bg-success/10'}`}><p className="text-xs text-muted-foreground">Críticas</p><p className={`font-semibold text-lg ${data.resumo.criticas > 0 ? 'text-destructive' : 'text-success'}`}>{data.resumo.criticas}</p></div>
            </div>

            {data.truncado && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                A conta possui mais de {data.limitePorOrigem.toLocaleString('pt-BR')} registros em uma das origens. Esta leitura foi limitada e deve ser revisada por período.
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Saldos calculados pelo livro</h3>
              {data.contas.map(conta => (
                <div key={conta.id} className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-border p-3 text-sm sm:grid-cols-5">
                  <span className="col-span-2 font-medium truncate sm:col-span-1">{conta.nome}</span>
                  <span className="text-muted-foreground">Base: {formatarMoeda(conta.saldoBase)}</span>
                  <span className="text-success">Entradas: {formatarMoeda(conta.entradas)}</span>
                  <span className="text-primary">Saídas: {formatarMoeda(conta.saidas)}</span>
                  <span className="font-semibold">Livro: {formatarMoeda(conta.saldoLivro)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Divergências encontradas</h3>
              {data.divergencias.length === 0 ? (
                <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0" /> Nenhuma divergência foi encontrada nos registros analisados.</div>
              ) : data.divergencias.map((divergencia, indice) => (
                <div key={`${divergencia.tipo}-${divergencia.referencia}-${indice}`} className={`rounded-lg border p-3 ${divergencia.severidade === 'critica' ? 'border-destructive/40 bg-destructive/10' : divergencia.severidade === 'atencao' ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-blue-500/30 bg-blue-500/10'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-medium text-sm">{divergencia.referencia}</p><p className="text-xs text-muted-foreground mt-1">{divergencia.mensagem}</p></div>
                    <span className="text-xs uppercase font-semibold shrink-0">{divergencia.severidade}</span>
                  </div>
                  {(divergencia.esperado !== null || divergencia.encontrado !== null) && <p className="text-xs mt-2 text-muted-foreground">Esperado: <strong>{divergencia.esperado === null ? '—' : formatarMoeda(divergencia.esperado)}</strong> · Encontrado: <strong>{divergencia.encontrado === null ? '—' : formatarMoeda(divergencia.encontrado)}</strong></p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function Caixa() {
  const { t } = useTranslation();
  const [contaSelecionada, setContaSelecionada] = useState<number | undefined>();
  const utils = trpc.useUtils();

  const { data: contas, isLoading: contasLoading } = trpc.caixa.contas.useQuery();
  const { data: transacoes } = trpc.caixa.transacoes.useQuery({ contaCaixaId: contaSelecionada });

  const saldoTotal = contas?.reduce((sum, c) => sum + c.saldoAtual, 0) ?? 0;

  const tipoIcons = { entrada: ArrowUpRight, saida: ArrowDownRight };
  const categoriaLabels: Record<string, string> = {
    pagamento_parcela: t('cashbox.paymentReceived'),
    emprestimo_liberado: t('cashbox.loanDisbursement'),
    despesa_operacional: t('cashbox.operationalExpense'),
    transferencia_conta: t('cashbox.transfer'),
    ajuste_manual: t('cashbox.manualAdjustment'),
    outros: t('cashbox.other'),
  };

  const invalidarTudo = () => {
    utils.caixa.contas.invalidate();
    utils.caixa.transacoes.invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">{t('cashbox.title').toUpperCase()}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('cashbox.transactions')}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <ConferenciaCaixa />
          <NovaConta onSuccess={invalidarTudo} />
          <NovaTransacao contas={contas ?? []} onSuccess={invalidarTudo} />
        </div>
      </div>

      {/* Saldo Total */}
      <Card className="border-border bg-gradient-to-r from-card to-card/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/15">
              <Wallet className="h-6 w-6 text-success" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('cashbox.totalIncome')}</div>
              <div className={`font-display text-3xl ${saldoTotal >= 0 ? 'text-success' : 'text-primary'}`}>
                {formatarMoeda(saldoTotal)}
              </div>
              {saldoTotal < 0 && (
                <div className="text-xs text-primary mt-1">⚠ Saldo negativo — contratos podem ser criados normalmente</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contas */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('cashbox.account')}</h2>
        {contasLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Card key={i} className="border-border animate-pulse"><CardContent className="p-5 h-24" /></Card>)}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contas?.map(conta => (
            <Card
              key={conta.id}
              className={`border cursor-pointer transition-all ${contaSelecionada === conta.id ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-border/80'}`}
              onClick={() => setContaSelecionada(contaSelecionada === conta.id ? undefined : conta.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Botões rápidos de lançamento */}
                    <LancamentoRapido conta={conta} tipo="entrada" onSuccess={invalidarTudo} />
                    <LancamentoRapido conta={conta} tipo="saida" onSuccess={invalidarTudo} />
                    <span className="text-xs text-muted-foreground capitalize ml-1">{conta.tipo.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className={`font-display text-xl ${conta.saldoAtual >= 0 ? 'text-foreground' : 'text-primary'}`}>
                  {formatarMoeda(conta.saldoAtual)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{conta.nome}</div>
                {conta.banco && <div className="text-xs text-muted-foreground">{conta.banco}</div>}
                {conta.saldoAtual < 0 && (
                  <div className="text-xs text-primary mt-1">{t('cashbox.balance')}</div>
                )}
              </CardContent>
            </Card>
          ))}
          {!contasLoading && contas?.length === 0 && (
            <div className="col-span-3 text-center py-8 text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{t('common.noData')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Transações */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {contaSelecionada ? `Transações — ${contas?.find(c => c.id === contaSelecionada)?.nome}` : 'Últimas Transações'}
        </h2>
        <Card className="border-border">
          <CardContent className="p-0">
            {transacoes?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">{t('common.noData')}</p>
              </div>
            )}
            <div className="divide-y divide-border">
              {transacoes?.map(t => {
                const Icon = tipoIcons[t.tipo as keyof typeof tipoIcons] ?? ArrowUpRight;
                const isEntrada = t.tipo === 'entrada';
                return (
                  <div key={t.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${isEntrada ? 'bg-success/15' : 'bg-primary/15'}`}>
                        <Icon className={`h-4 w-4 ${isEntrada ? 'text-success' : 'text-primary'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {t.descricao || categoriaLabels[t.categoria] || t.categoria}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.contaNome} · {t.clienteNome && `${t.clienteNome} · `}
                          {new Date(t.dataTransacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className={`font-semibold text-sm shrink-0 ml-4 ${isEntrada ? 'text-success' : 'text-primary'}`}>
                      {isEntrada ? '+' : '-'}{formatarMoeda(t.valor)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
