import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from "react";
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
import { Plus, Wallet, ArrowUpRight, ArrowDownRight, Building2, ClipboardCheck, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { formatarData, formatarMoeda } from "../../../shared/finance";
import { calcularSaldoAtual } from "../../../shared/caixa";
import { Caixa37Aporte, Caixa37Transferencia, type ContaOpcao37 } from "@/components/Caixa37Operacoes";
import { copiarJsonCaixa37, CAIXA37_MAX_ID } from "../../../shared/caixa37";
import { z } from "zod";
import { CaixaManutencao45 } from "@/components/CaixaManutencao45";
import ConferenciaDespesasCaixa from "@/components/ConferenciaDespesasCaixa";

const metadata37Schema = z.object({
  empresaId: z.number().int().positive().max(CAIXA37_MAX_ID),
  contas: z.array(z.object({ id: z.number().int().positive().max(CAIXA37_MAX_ID), nome: z.string(), tipo: z.string() }).strict()).max(10000),
}).strict().refine(m => m.contas.every((c, i) => i === 0 || c.id > m.contas[i - 1].id));

/** Metadados próprios não certificam dinheiro; JSON inválido nunca vira seletor de outra empresa. */
export function contasPropriasCaixa37(value: unknown, userId: number): ContaOpcao37[] | null {
  try {
    const m = metadata37Schema.parse(copiarJsonCaixa37(value));
    return m.empresaId === userId ? m.contas.map(c => ({ id: c.id, nome: c.nome })) : null;
  } catch { return null; }
}

function formatarDataTransacao(valor: string | Date): string {
  // DATE representa um dia civil, não meia-noite UTC nem um horário de lançamento.
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatarData(valor);
  const instante = valor instanceof Date ? valor : new Date(valor);
  if (!Number.isFinite(instante.getTime())) return "Data indisponível";
  return instante.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
  });
}

function ErroConsultaCaixa({ origem, mensagem, isFetching, refetch }: {
  origem: string;
  mensagem?: string;
  isFetching: boolean;
  refetch: () => unknown;
}) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <p>Não foi possível carregar {origem}. {mensagem || "Consulta indisponível."}</p>
      <Button variant="outline" size="sm" className="mt-2 gap-2" aria-label={`Tentar novamente: ${origem}`} disabled={isFetching} onClick={() => void refetch()}>
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        {isFetching ? "Tentando novamente..." : "Tentar novamente"}
      </Button>
    </div>
  );
}

// ── Modal: Nova Conta ─────────────────────────────────────────────────────────
function NovaConta({ onSuccess, disabled = false, atual }: { onSuccess: () => void; disabled?: boolean; atual: () => boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo: "caixa", banco: "", saldoInicial: "0" });

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const vigente = () => mounted.current && atual();
  const mutation = trpc.caixa.criarConta.useMutation({
    onSuccess: () => { if (!vigente()) return; toast.success(t('toast_success.conta_criada')); setOpen(false); onSuccess(); },
    onError: (e) => { if (vigente()) toast.error(e.message); },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}><Plus className="h-4 w-4" />Nova conta</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">NOVA CONTA</DialogTitle>
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
            disabled={disabled || !form.nome || mutation.isPending}
            onClick={() => {
              if (disabled || !vigente()) return;
              const raw = form.saldoInicial;
              if (!/^-?(0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?$/.test(raw)) {
                toast.error("Saldo inicial inválido. Use decimal com até duas casas, sem arredondamento."); return;
              }
              const [inteiro, fracao = ""] = raw.replace(/^-/, "").split(".");
              const cents = (BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, "0"))) * (raw.startsWith("-") ? BigInt(-1) : BigInt(1));
              const valor = Number(raw);
              if (!Number.isFinite(valor) || !Number.isSafeInteger(Number(cents)) ||
                BigInt(Math.round(valor * 100)) !== cents) {
                toast.error("Saldo inicial não representável com precisão. Nenhum cadastro enviado."); return;
              }
              mutation.mutate({ nome: form.nome.trim(), tipo: form.tipo as "caixa" | "banco" | "digital", banco: form.banco || undefined, saldoInicial: valor });
            }}
          >
            {mutation.isPending ? t('common.saving') : t('cashbox.createAccount')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Conferência operacional (somente leitura) ─────────────────────────────────
function ConferenciaCaixa({ leituraId }: { leituraId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isFetching, error, refetch } = trpc.caixa.conferencia.useQuery({ leituraId }, {
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
          <ClipboardCheck className="h-4 w-4" /> Diagnóstico legado
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
          <span>Diagnóstico legado somente leitura. Este leitor não certifica saldo nem vínculo de despesas: usa descrições, pode omitir status pago e dados podem ser limitados. Para despesas por conta use Conferir despesas e caixa; diferenças não autorizam ajuste manual. Parcelas permanecem no diagnóstico legado.</span>
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
export function CaixaEmpresa({ userId, atual }: { userId: number; atual: () => boolean }) {
  const [leituraId] = useState(() => globalThis.crypto.randomUUID());
  const { t } = useTranslation();
  const [contaSelecionada, setContaSelecionada] = useState<number | undefined>();
  const utils = trpc.useUtils();
  const metadata = trpc.caixa.contasParaOperacao37.useQuery(undefined, { retry: false, staleTime: 0 });
  const metadadosProprios = contasPropriasCaixa37(metadata.data, userId);
  const metadataValida = !metadata.isError && !metadata.error && !metadata.isLoading &&
    !metadata.isFetching && metadadosProprios !== null;
  const contasOperacao: ContaOpcao37[] = metadataValida ? metadadosProprios! : [];

  const {
    data: contas, isLoading: contasLoading, isError: contasIsError,
    error: contasError, isFetching: contasFetching, refetch: refetchContas,
  } = trpc.caixa.contas.useQuery({ leituraId }, { retry: false });
  const {
    data: transacoes, isLoading: transacoesLoading, isError: transacoesIsError,
    error: transacoesError, isFetching: transacoesFetching, refetch: refetchTransacoes,
  } = trpc.caixa.transacoes.useQuery({ contaCaixaId: contaSelecionada, leituraId }, { retry: false });

  // Um refetch pode falhar mantendo data em cache. Esse cache não é sucesso atual.
  const contasFalha = contasIsError || !!contasError;
  const transacoesFalha = transacoesIsError || !!transacoesError;
  const contasDisponiveis = !contasFalha && !contasLoading && contas !== undefined;
  const transacoesDisponiveis = !transacoesFalha && !transacoesLoading && transacoes !== undefined;
  const contasVisiveis = contasDisponiveis ? contas : undefined;
  const transacoesVisiveis = transacoesDisponiveis ? transacoes : undefined;

  let saldoTotal: number | null = null;
  let saldoError: string | undefined;
  if (contasVisiveis) {
    try {
      saldoTotal = calcularSaldoAtual(0, contasVisiveis.map(conta => ({
        tipo: conta.saldoAtual < 0 ? "saida" : "entrada",
        valor: String(conta.saldoAtual).replace(/^-/, ""),
      })));
    } catch {
      saldoError = "Não foi possível calcular o saldo total com segurança. Atualize as contas antes de lançar valores.";
    }
  }

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
    utils.caixa.contasParaOperacao37.invalidate();
    utils.caixa.conferencia.invalidate();
    utils.contasPagar.conferirCaixa.invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">{t('cashbox.title').toUpperCase()}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('cashbox.transactions')}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <ConferenciaDespesasCaixa userId={userId} atual={atual} />
          <ConferenciaCaixa leituraId={leituraId} />
          <CaixaManutencao45 userId={userId} atual={atual} onSuccess={invalidarTudo} />
          <NovaConta onSuccess={invalidarTudo} disabled={!atual()} atual={atual} />
          <Caixa37Aporte userId={userId} contas={contasOperacao} onSuccess={invalidarTudo} />
          <Caixa37Transferencia userId={userId} contas={contasOperacao} onSuccess={invalidarTudo} />
        </div>
      </div>

      {!metadataValida && <div role="status" className="text-sm text-muted-foreground">
        {metadata.isError || metadata.error ? "Não foi possível carregar os metadados próprios de contas." : "Conferindo os metadados de contas desta empresa..."}
        <span> A conferência de uma intenção já enviada continua acessível em Aportar ou Transferir. Saldo e extrato antigos não autorizam nova operação.</span>
        <Button variant="outline" size="sm" disabled={metadata.isFetching} onClick={() => void metadata.refetch()}>Atualizar seletor de contas</Button>
      </div>}
      <p className="text-xs text-muted-foreground">Aportes e transferências têm prévia autoritativa e confirmação próprias. Retiradas avulsas e exclusão de lançamentos não são substituídas por ajuste manual.</p>
      {/* Saldo Total */}
      <Card className="border-border bg-gradient-to-r from-card to-card/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/15">
              <Wallet className="h-6 w-6 text-success" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Saldo total do Caixa</div>
              {saldoTotal !== null ? (
                <div className={`font-display text-3xl ${saldoTotal >= 0 ? 'text-success' : 'text-primary'}`}>
                  {formatarMoeda(saldoTotal)}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground" role={saldoError ? "alert" : "status"}>
                  {contasFalha ? "Saldo indisponível: falha na consulta de contas." : saldoError || "Carregando saldo..."}
                </div>
              )}
              {saldoTotal !== null && saldoTotal < 0 && (
                <div className="text-xs text-primary mt-1">⚠ Saldo negativo — contratos podem ser criados normalmente</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contas */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('cashbox.account')}</h2>
        {contasFalha ? (
          <ErroConsultaCaixa origem="as contas do caixa" mensagem={contasError?.message} isFetching={contasFetching} refetch={refetchContas} />
        ) : !contasDisponiveis ? (
          <div role="status">
            <p className="text-sm text-muted-foreground mb-3">Carregando contas...</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Card key={i} className="border-border animate-pulse"><CardContent className="p-5 h-24" /></Card>)}
            </div>
          </div>
        ) : contasFetching && <p role="status" className="text-sm text-muted-foreground mb-3">Atualizando contas...</p>}
        {saldoError && <Button variant="outline" size="sm" className="mb-3" disabled={contasFetching} onClick={() => void refetchContas()}>Atualizar contas</Button>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contasVisiveis?.map(conta => (
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
                    {/* Operações financeiras usam os controles37 acima; nenhum writer genérico por cartão. */}
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
          {contasVisiveis?.length === 0 && (
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
          {contaSelecionada ? `Transações — ${contasVisiveis?.find(c => c.id === contaSelecionada)?.nome ?? `conta #${contaSelecionada}`}` : 'Últimas Transações'}
        </h2>
        <Card className="border-border">
          <CardContent className="p-0">
            {transacoesFalha ? (
              <ErroConsultaCaixa origem="as transações do caixa" mensagem={transacoesError?.message} isFetching={transacoesFetching} refetch={refetchTransacoes} />
            ) : !transacoesDisponiveis ? (
              <p role="status" className="text-center py-12 text-sm text-muted-foreground">Carregando transações...</p>
            ) : transacoesFetching && <p role="status" className="p-4 text-sm text-muted-foreground">Atualizando transações...</p>}
            {transacoesVisiveis?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">{t('common.noData')}</p>
              </div>
            )}
            <div className="divide-y divide-border">
              {transacoesVisiveis?.map(t => {
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
                          #{t.id} · {t.descricao || categoriaLabels[t.categoria] || t.categoria}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.contaNome} · {t.clienteNome && `${t.clienteNome} · `}
                          {formatarDataTransacao(t.dataTransacao)}
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

/** Troca de empresa invalida formulários/seleção e callbacks da tela anterior. */
export default function Caixa() {
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const userId = !auth.isError && !auth.error && !auth.isLoading && !auth.isFetching &&
    Number.isSafeInteger(auth.data?.id) && (auth.data?.id ?? 0) > 0 ? auth.data!.id : undefined;
  const scope = useRef({ userId, epoch: 0 });
  if (scope.current.userId !== userId) scope.current = { userId, epoch: scope.current.epoch + 1 };
  const token = scope.current;
  if (!userId) return <p role="status">Conferindo a sessão atual da empresa...</p>;
  return <CaixaEmpresa key={`${userId}:${token.epoch}`} userId={userId} atual={() => scope.current === token} />;
}
