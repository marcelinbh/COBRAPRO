import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  capacidade37Schema,
  dinheiro37,
  descricao37,
  inputCotacao37,
  qRequest,
  validarCotacao37,
  respostaCaixa37,
  useIntencaoCaixa37,
  type Acao37,
  type Cotacao37,
  type Form37,
  type Result37,
} from "./Caixa37Rpc";

export type ContaOpcao37 = { id: number; nome: string; ativo?: boolean };
export type Caixa37Props = {
  userId: number | undefined;
  contas: ContaOpcao37[];
  acaoInicial?: Acao37;
  contaDestinoInicialId?: number;
  contaOrigemInicialId?: number;
  onSuccess?: () => void;
};
type QuoteState = { generation: object; revision: number; quote: Cotacao37 };
type CapabilityState = {
  generation: object;
  data: ReturnType<typeof capacidade37Schema.parse>;
};

function Preview37({ q }: { q: Cotacao37 }) {
  return (
    <div
      className="space-y-2 rounded border p-3"
      aria-label="Prévia autoritativa do Caixa"
    >
      <p>Data da operação: {q.dataTransacao} (Brasília, emitida pelo SQL).</p>
      <p>
        Valor exato: R$ {q.valor}. Descrição: {q.descricao ?? "Sem descrição"}.
      </p>
      {q.origem && (
        <p>
          Origem {q.origem.nome} (#{q.origem.contaCaixaId}): R${" "}
          {q.origem.saldoEfetivo} → R$ {q.saldoOrigemApos}.
        </p>
      )}
      <p>
        Destino {q.destino.nome} (#{q.destino.contaCaixaId}): R${" "}
        {q.destino.saldoEfetivo} → R$ {q.saldoDestinoApos}.
      </p>
      <p className="text-sm">
        Destino: saldo-base {q.destino.saldoBase} + entradas{" "}
        {q.destino.entradas} − saídas {q.destino.saidas} = saldo efetivo{" "}
        {q.destino.saldoEfetivo}.
      </p>
      {q.origem && (
        <p className="text-sm">
          Origem: saldo-base {q.origem.saldoBase} + entradas {q.origem.entradas}{" "}
          − saídas {q.origem.saidas} = saldo efetivo {q.origem.saldoEfetivo}.
        </p>
      )}
      <p>
        Total da empresa, incluindo contas inativas: R$ {q.saldoTotalOwnerAntes}{" "}
        → R$ {q.saldoTotalOwnerApos}.
        {q.acao === "transferir"
          ? " Total invariável: uma saída e uma entrada de mesmo valor."
          : " Uma única entrada de dinheiro novo efetivamente recebido."}
      </p>
      <p className="text-sm text-muted-foreground">
        Saldo-base preservado. Não há estorno ou exclusão nesta operação. A
        cotação não reserva saldo; qualquer alteração no livro exige nova
        cotação.
      </p>
    </div>
  );
}

export function Caixa37Operacoes({
  userId,
  contas,
  acaoInicial = "aporte",
  contaDestinoInicialId,
  contaOrigemInicialId,
  onSuccess,
}: Caixa37Props) {
  const auth = trpc.auth.me.useQuery(undefined, { refetchOnMount: false });
  const owner =
    !auth.isError &&
    !auth.isLoading &&
    !auth.isFetching &&
    auth.data?.id === userId
      ? userId
      : undefined;
  const [action, setAction] = useState<Acao37>(acaoInicial);
  const [origem, setOrigem] = useState(String(contaOrigemInicialId ?? ""));
  const [destino, setDestino] = useState(String(contaDestinoInicialId ?? ""));
  const [valor, setValor] = useState(""),
    [description, setDescription] = useState("");
  const [negativeAccepted, setNegativeAccepted] = useState(false);
  const utils = trpc.useUtils();
  function confirmed(_result: Result37) {
    // Invalidar todas as variantes de contas/extratos/cotações/conferência,
    // dashboard, relatórios, contratos, recebimentos e agregados financeiros.
    // O resultado é histórico: nunca aplicar seus saldos ao cache nem incrementar ledger.
    void utils.invalidate().catch(() => {});
    onSuccess?.();
  }
  const intent = useIntencaoCaixa37(owner, action, confirmed);
  const [quoteState, setQuoteState] = useState<QuoteState | null>(null);
  const [capState, setCapState] = useState<CapabilityState | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false),
    [capBusy, setCapBusy] = useState(false);
  const [quoteError, setQuoteError] = useState(""),
    [capError, setCapError] = useState("");
  const revision = useRef(0),
    quoteFlight = useRef<object | null>(null),
    capFlight = useRef<object | null>(null);
  const accountContext = JSON.stringify(
    contas.map(c => [c.id, c.nome, c.ativo ?? true])
  );
  const context = `${owner ?? ""}:${action}:${accountContext}`;
  const formRef = useRef({ context, origem, destino, valor, description });
  if (
    formRef.current.context !== context ||
    formRef.current.origem !== origem ||
    formRef.current.destino !== destino ||
    formRef.current.valor !== valor ||
    formRef.current.description !== description
  )
    revision.current++;
  formRef.current = { context, origem, destino, valor, description };
  const q =
    quoteState?.generation === intent.generation &&
    quoteState.revision === revision.current
      ? quoteState.quote
      : null;
  const capability =
    capState?.generation === intent.generation ? capState.data : null;
  const liveAuthorization = useRef({ q, capability, negativeAccepted });
  liveAuthorization.current = { q, capability, negativeAccepted };
  const available =
    !!capability?.disponivel &&
    (action === "aporte" ? capability.aporte : capability.transferencia);
  const negative =
    !!q &&
    (q.saldoOrigemApos?.startsWith("-") === true ||
      q.saldoDestinoApos.startsWith("-"));
  let form: Form37 | null = null;
  try {
    const target = contas.find(
      c => c.id === Number(destino) && c.ativo !== false
    );
    const source = contas.find(
      c => c.id === Number(origem) && c.ativo !== false
    );
    if (
      !target ||
      (action === "transferir" && (!source || source.id === target.id))
    )
      throw Error("Contas ativas distintas necessárias.");
    form = {
      acao: action,
      contaOrigemId: action === "transferir" ? source!.id : null,
      contaDestinoId: target.id,
      valor: dinheiro37(valor),
      descricao: descricao37(description),
    };
  } catch {
    /* Campo incompleto não é cotação zero nem fallback. */
  }
  const quoteSource = trpc.caixa.cotar37.useQuery(
    inputCotacao37(
      form ?? {
        acao: "aporte",
        contaOrigemId: null,
        contaDestinoId: 1,
        valor: "0.01",
        descricao: null,
      }
    ),
    { enabled: false, retry: false, staleTime: 0 }
  );
  const capSource = trpc.caixa.capacidades37.useQuery(undefined, {
    enabled: false,
    retry: false,
    staleTime: 0,
  });
  async function loadCapability() {
    if (!intent.atual() || intent.pendente || capFlight.current) return;
    const token = {};
    capFlight.current = token;
    setCapBusy(true);
    setCapError("");
    setCapState(null);
    liveAuthorization.current = {
      q: null,
      capability: null,
      negativeAccepted: false,
    };
    revision.current++;
    setQuoteState(null);
    setNegativeAccepted(false);
    try {
      const response = await respostaCaixa37(
        capSource.refetch({ cancelRefetch: true })
      );
      if (!intent.atual() || capFlight.current !== token) return;
      if (
        response.isError ||
        response.isFetching ||
        response.isLoading ||
        !response.data
      )
        throw Error("Capacidade não comprovada.");
      setCapState({
        generation: intent.generation,
        data: capacidade37Schema.parse(response.data),
      });
    } catch {
      if (intent.atual() && capFlight.current === token)
        setCapError(
          "Lote 37 indisponível ou capacidade não comprovada. Nenhum writer alternativo será usado."
        );
    } finally {
      if (intent.atual() && capFlight.current === token) {
        capFlight.current = null;
        setCapBusy(false);
      }
    }
  }
  useEffect(() => {
    quoteFlight.current = null;
    capFlight.current = null;
    setQuoteState(null);
    setCapState(null);
    setQuoteBusy(false);
    setCapBusy(false);
    setQuoteError("");
    setCapError("");
    setNegativeAccepted(false);
    if (intent.pronta && !intent.pendente && !intent.erro)
      void loadCapability();
  }, [intent.generation, intent.pronta, !!intent.pendente]);
  useEffect(() => {
    setAction(acaoInicial);
    setOrigem(String(contaOrigemInicialId ?? ""));
    setDestino(String(contaDestinoInicialId ?? ""));
    setValor("");
    setDescription("");
    setNegativeAccepted(false);
  }, [owner, acaoInicial, contaDestinoInicialId, contaOrigemInicialId]);
  useEffect(() => {
    setNegativeAccepted(false);
  }, [context, origem, destino, valor, description]);

  async function quote() {
    if (
      !intent.atual() ||
      intent.pendente ||
      intent.erro ||
      !available ||
      liveAuthorization.current.capability !== capability ||
      !form ||
      quoteFlight.current ||
      capFlight.current
    )
      return;
    const captured = form,
      capturedRevision = revision.current,
      token = {};
    quoteFlight.current = token;
    liveAuthorization.current.q = null;
    setQuoteState(null);
    setQuoteError("");
    setQuoteBusy(true);
    setNegativeAccepted(false);
    try {
      const response = await respostaCaixa37(
        quoteSource.refetch({ cancelRefetch: true })
      );
      if (
        !intent.atual() ||
        quoteFlight.current !== token ||
        revision.current !== capturedRevision
      )
        return;
      if (
        response.isError ||
        response.isFetching ||
        response.isLoading ||
        !response.data
      )
        throw Error("Cotação não comprovada.");
      const result = validarCotacao37(response.data, captured);
      setQuoteState({
        generation: intent.generation,
        revision: capturedRevision,
        quote: result,
      });
    } catch (e) {
      if (
        intent.atual() &&
        quoteFlight.current === token &&
        revision.current === capturedRevision
      )
        setQuoteError(
          `${e instanceof Error ? e.message : "Falha de cotação"} Nenhum envio autorizado.`
        );
    } finally {
      if (intent.atual() && quoteFlight.current === token) {
        quoteFlight.current = null;
        setQuoteBusy(false);
      }
    }
  }
  function confirm() {
    if (
      !intent.atual() ||
      intent.pendente ||
      intent.erro ||
      quoteFlight.current ||
      capFlight.current ||
      !available ||
      !form ||
      !q ||
      liveAuthorization.current.q !== q ||
      liveAuthorization.current.capability !== capability ||
      quoteState?.revision !== revision.current ||
      (negative && !liveAuthorization.current.negativeAccepted)
    )
      return;
    return intent.enviar(qRequest(q));
  }
  function finish() {
    const previous = intent.encerrar();
    if (!previous) return;
    setQuoteState(null);
    revision.current++;
    setNegativeAccepted(false);
    setQuoteError("");
    // not_executed apenas libera editar; nova cotação e novo gesto continuam obrigatórios.
    setOrigem(String(previous.contaOrigemId ?? ""));
    setDestino(String(previous.contaDestinoId));
    setValor(previous.valor);
    setDescription(previous.descricao ?? "");
  }
  if (!owner || !intent.pronta)
    return <p role="status">Conferindo a sessão atual da empresa...</p>;
  const pending = intent.pendente;
  return (
    <section className="space-y-3" aria-label="Operações Caixa 37">
      <h3 className="font-semibold">
        {action === "aporte"
          ? "Aporte recebido"
          : "Transferência entre contas próprias"}
      </h3>
      {intent.erro && <p role="alert">{intent.erro}</p>}
      {pending ? (
        <div className="space-y-3 rounded border p-3">
          <p className="break-all">
            Intenção preservada: <code>{pending.idempotencyKey}</code>.
          </p>
          <p>
            {pending.request.acao === "aporte" ? "Aporte" : "Transferência"} de
            R$ {pending.request.valor}; origem{" "}
            {pending.request.contaOrigemId ?? "não aplicável"}; destino{" "}
            {pending.request.contaDestinoId}; data{" "}
            {pending.request.dataTransacao}. Descrição:{" "}
            {pending.request.descricao ?? "Sem descrição"}.
          </p>
          {pending.confirmacao ? (
            <>
              <p role="status">
                Operação confirmada:{" "}
                <code>{pending.confirmacao.operationId}</code>.{" "}
                {pending.confirmacao.repetida
                  ? "Confirmação histórica repetida, sem novas pernas."
                  : "Registrada no histórico."}
              </p>
              {pending.confirmacao.acao === "transferir" && (
                <p>
                  Saldo histórico da origem:{" "}
                  {pending.confirmacao.saldoOrigemAntes} →{" "}
                  {pending.confirmacao.saldoOrigemApos}.
                </p>
              )}
              <p>
                Saldo histórico do destino:{" "}
                {pending.confirmacao.saldoDestinoAntes} →{" "}
                {pending.confirmacao.saldoDestinoApos}. Total histórico da
                empresa: {pending.confirmacao.saldoTotalOwnerAntes} →{" "}
                {pending.confirmacao.saldoTotalOwnerApos}.
              </p>
              <p>
                IDs físicos:{" "}
                {pending.confirmacao.pernas
                  .map(p => `${p.papel}: ${p.transacaoCaixaId}`)
                  .join("; ")}
                . Saldos da prova são históricos, não o saldo atual.
              </p>
              <Button variant="outline" disabled={intent.busy} onClick={finish}>
                Encerrar confirmação e preparar nova operação
              </Button>
            </>
          ) : (
            <>
              <p role="status">
                {intent.busy
                  ? "Aguardando resposta. Fechar não cancela dinheiro."
                  : "Resultado não confirmado. Não repita o envio nem crie outra chave; confira a intenção original."}
              </p>
              <Button
                variant="outline"
                disabled={intent.busy}
                onClick={intent.reconciliar}
              >
                Conferir intenção no servidor
              </Button>
              {intent.recovery?.status === "not_executed" && (
                <>
                  <p>
                    Não execução comprovada pelo servidor: UUID permanentemente
                    bloqueado.
                  </p>
                  <Button
                    variant="outline"
                    disabled={intent.busy}
                    onClick={finish}
                  >
                    Preparar nova intenção após não execução comprovada
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <label className="block space-y-1">
            <Label>Ação</Label>
            <select
              aria-label="Ação"
              className="w-full rounded border bg-background p-2"
              value={action}
              onChange={e => {
                if (
                  e.target.value === "aporte" ||
                  e.target.value === "transferir"
                )
                  setAction(e.target.value);
              }}
            >
              <option value="aporte">Aporte recebido</option>
              <option value="transferir">Transferência</option>
            </select>
          </label>
          <p className="text-sm">
            {action === "aporte"
              ? "Declare somente dinheiro novo efetivamente recebido. Não use para corrigir divergência, saldo inicial ou cancelamento de parcela."
              : "Uma saída na origem e uma entrada no destino, no mesmo commit, sem tarifa, câmbio ou retirada avulsa."}
          </p>
          {capBusy && <p role="status">Conferindo disponibilidade...</p>}
          {capError && <p role="alert">{capError}</p>}
          {capability && !available && (
            <p role="alert">
              Lote 37 não disponível para nova operação. Sem fallback.
            </p>
          )}
          <Button
            variant="outline"
            disabled={capBusy || !!intent.erro}
            onClick={loadCapability}
          >
            Conferir disponibilidade novamente
          </Button>
          {contas.length === 0 && (
            <p role="alert">
              Metadados de contas indisponíveis. Nenhuma conta ou saldo será
              presumido.
            </p>
          )}
          {action === "transferir" && (
            <label className="block space-y-1">
              <Label>Conta de origem</Label>
              <select
                aria-label="Conta de origem"
                className="w-full rounded border bg-background p-2"
                value={origem}
                onChange={e => setOrigem(e.target.value)}
              >
                <option value="">Selecione</option>
                {contas
                  .filter(c => c.ativo !== false)
                  .map(c => (
                    <option key={c.id} value={String(c.id)}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="block space-y-1">
            <Label>Conta de destino</Label>
            <select
              aria-label="Conta de destino"
              className="w-full rounded border bg-background p-2"
              value={destino}
              onChange={e => setDestino(e.target.value)}
            >
              <option value="">Selecione</option>
              {contas
                .filter(c => c.ativo !== false)
                .map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </label>
          <label className="block space-y-1">
            <Label>Valor (R$)</Label>
            <Input
              aria-label="Valor"
              inputMode="decimal"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="100.00"
            />
          </label>
          <label className="block space-y-1">
            <Label>Descrição opcional</Label>
            <Input
              aria-label="Descrição opcional"
              maxLength={500}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>
          {valor && !form && (
            <p role="alert">
              Informe valor positivo com ponto e até duas casas; selecione
              contas próprias ativas, distintas na transferência.
            </p>
          )}
          <Button
            variant="outline"
            disabled={
              quoteBusy || capBusy || !available || !form || !!intent.erro
            }
            onClick={quote}
          >
            {quoteBusy ? "Conferindo cotação..." : "Obter cotação e prévia"}
          </Button>
          {quoteError && <p role="alert">{quoteError}</p>}
          {q && <Preview37 q={q} />}
          {negative && (
            <div className="rounded border border-destructive p-3">
              <p role="alert">
                Atenção: o saldo efetivo após esta operação será negativo. Não
                será truncado para zero.
              </p>
              <label className="flex items-center gap-2">
                <input
                  aria-label="Confirmar saldo negativo"
                  type="checkbox"
                  checked={negativeAccepted}
                  onChange={e => setNegativeAccepted(e.target.checked)}
                />
                Confirmo explicitamente o saldo negativo exibido.
              </label>
            </div>
          )}
          <Button
            disabled={
              intent.busy ||
              quoteBusy ||
              !available ||
              !form ||
              !q ||
              !!intent.erro ||
              (negative && !negativeAccepted)
            }
            onClick={confirm}
          >
            Confirmar{" "}
            {action === "aporte" ? "aporte recebido" : "transferência"}
          </Button>
        </>
      )}
    </section>
  );
}

function Caixa37Controle({
  action,
  ...props
}: Caixa37Props & { action: Acao37 }) {
  const scope = `${props.userId ?? ""}:${action}:${props.contaDestinoInicialId ?? ""}:${props.contaOrigemInicialId ?? ""}`;
  const current = useRef({ scope, epoch: 0 });
  if (current.current.scope !== scope)
    current.current = { scope, epoch: current.current.epoch + 1 };
  const token = current.current,
    screen = `${scope}:${token.epoch}`;
  const [opened, setOpened] = useState("");
  const open = opened === screen;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!props.userId}
        onClick={() => setOpened(screen)}
      >
        {action === "aporte"
          ? "Aportar / conferir aporte"
          : "Transferir / conferir transferência"}
      </Button>
      <Dialog open={open} onOpenChange={v => setOpened(v ? screen : "")}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {action === "aporte"
                ? "Aporte no Caixa"
                : "Transferência entre contas"}
            </DialogTitle>
          </DialogHeader>
          {open && (
            <Caixa37Operacoes
              key={screen}
              {...props}
              acaoInicial={action}
              onSuccess={() => {
                if (current.current === token) props.onSuccess?.();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function Caixa37Aporte(props: Caixa37Props) {
  return <Caixa37Controle {...props} action="aporte" />;
}
export function Caixa37Transferencia(props: Caixa37Props) {
  return <Caixa37Controle {...props} action="transferir" />;
}
export const AporteCaixa37 = Caixa37Aporte;
export const TransferenciaCaixa37 = Caixa37Transferencia;
