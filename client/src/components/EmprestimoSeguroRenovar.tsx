import { useEffect, useRef, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RenovacaoProspectivaAppRouter } from "../../../server/routers/renovacaoProspectiva";
import type { CotacaoRenovacaoProspectiva, EntradaRenovacaoProspectiva, ResultadoRenovacaoProspectiva } from "../../../server/services/renovacaoProspectivaRpc";
import { renovacaoProspectivaLerIntencao, renovacaoProspectivaGuardarIntencao, renovacaoProspectivaNovaIntencao, type RenovacaoProspectivaIntencao } from "./renovacaoProspectivaIntencao";
const rpc = createTRPCProxyClient<RenovacaoProspectivaAppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson,
    fetch(input, init) { return globalThis.fetch(input, { ...init, credentials: "include" }); },
  })],
}).renovacaoProspectiva;
function conferirResultado(r: ResultadoRenovacaoProspectiva, p: RenovacaoProspectivaIntencao) {
  if (!r || r.contratoId !== p.payload.contratoId || r.parcelaId !== p.payload.parcelaId || r.valorRecebido !== p.payload.valorRecebido || r.totalExigido !== p.payload.totalExigido || r.dataPagamento !== p.payload.dataPagamento || r.estadoHash !== p.payload.estadoHash || r.cotacaoHash !== p.payload.cotacaoHash || r.principalPago !== "0.00" || !r.principalAntes || r.principalAntes !== r.principalDepois || r.status !== "renovada" || r.success !== true)
    throw new Error("Confirmação divergiu da intenção original; conserve UUID/payload e confira o histórico.");
}
/** Origem prospectiva comprovada pelo pai; conferência nunca cria nova operação. */
export function EmprestimoSeguroRenovar({ contratoId, parcelaId, onSuccess, origemUserId, somenteConferencia = false }: {
  contratoId: number; parcelaId: number; onSuccess: (r: ResultadoRenovacaoProspectiva) => void;
  origemUserId: number; somenteConferencia?: boolean;
}) {
  const auth = trpc.auth.me.useQuery();
  const user = !auth.isError && !auth.isLoading && !auth.isFetching ? auth.data : undefined;
  const key = user && origemUserId === user.id ? `cobrapro:renovacao:v1:${user.id}:${contratoId}:${parcelaId}` : "";
  const context = key ? `${key}:${somenteConferencia ? "conferencia" : "primeira"}` : "";
  const scope = useRef(context);
  const mounted = useRef(true);
  const serial = useRef(0);
  // Invalidar também antes dos effects: handlers antigos não podem agir em outra sessão/modo.
  if (scope.current !== context) { scope.current = context; serial.current++; }
  const intention = useRef<RenovacaoProspectivaIntencao | null>(null);
  const flight = useRef(false);
  const storageBlocked = useRef(false);
  const [screenKey, setScreenKey] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<CotacaoRenovacaoProspectiva | null>(null);
  const [pending, setPending] = useState<RenovacaoProspectivaIntencao | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; serial.current++; }; }, []);
  useEffect(() => {
    serial.current++; flight.current = false; intention.current = null; storageBlocked.current = false;
    setScreenKey(context); setOpen(false); setBusy(false); setError(""); setQuote(null); setPending(null);
    if (!key) return;
    try {
      const p = renovacaoProspectivaLerIntencao(sessionStorage, key, { contratoId, parcelaId });
      if (p?.confirmacao) conferirResultado(p.confirmacao, p);
      intention.current = p; setPending(p);
    } catch (e) { storageBlocked.current = true; setError((e as Error).message); }
  }, [context, key, contratoId, parcelaId]);
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(id); }, []);
  const renderEpoch = serial.current;
  const current = (expected: string, epoch: number) => mounted.current && !!expected && scope.current === expected && serial.current === epoch;
  const expired = !!quote && (!Number.isFinite(Date.parse(quote.expiraEm)) || clock >= Date.parse(quote.expiraEm));
  // Uma segunda montagem/cache alterado não pode sobrescrever a intenção já preservada.
  function preserved() {
    try {
      const stored = renovacaoProspectivaLerIntencao(sessionStorage, key, { contratoId, parcelaId });
      if (stored?.confirmacao) conferirResultado(stored.confirmacao, stored);
      if (intention.current && (!stored || JSON.stringify(stored.payload) !== JSON.stringify(intention.current.payload)))
        throw new Error("Intenção/cache mudou. Confira o histórico; não substitua UUID/payload.");
      if (!intention.current && stored) { intention.current = stored; setPending(stored); setQuote(null); }
      return intention.current;
    } catch (e) { storageBlocked.current = true; throw e; }
  }
  async function consult() {
    if (!key || screenKey !== context || !current(context, renderEpoch) || somenteConferencia || flight.current || storageBlocked.current) return;
    const expected = context, epoch = renderEpoch;
    flight.current = true; setBusy(true); setError(""); setQuote(null);
    try {
      if (preserved()) return;
      const available = await rpc.disponibilidade.query();
      if (!current(expected, epoch)) return;
      if (!available.disponivel) throw new Error(`Renovação indisponível. ${available.limitacao}`);
      if (preserved()) return;
      const q = await rpc.cotar.query({ contratoId, parcelaId });
      if (!current(expected, epoch) || preserved()) return;
      if (!q.elegivel || q.contratoId !== contratoId || q.parcelaId !== parcelaId || q.principalPago !== "0.00" || q.principalAntes !== q.principalDepois)
        throw new Error("Cotação não elegível/divergente da origem atual. Nenhuma renovação será criada.");
      setQuote(q); setClock(Date.now());
    } catch (e) { if (current(expected, epoch)) setError((e as Error).message); }
    finally { if (current(expected, epoch)) { flight.current = false; setBusy(false); } }
  }
  async function send() {
    if (!key || screenKey !== context || !current(context, renderEpoch) || flight.current || storageBlocked.current) return;
    const expected = context, epoch = renderEpoch;
    flight.current = true; setBusy(true); setError("");
    try {
      let p = preserved();
      if (!p) {
        if (somenteConferencia) throw new Error("Sem intenção de renovação preservada nesta sessão. Somente consulta ao histórico.");
        if (!quote || expired) throw new Error("Cotação SQL expirada/ausente. Atualize antes de criar intenção.");
        p = renovacaoProspectivaNovaIntencao(quote, crypto.randomUUID());
        // Persistir ANTES de enviar; falha de storage bloqueia a operação, sem reset.
        try { renovacaoProspectivaGuardarIntencao(sessionStorage, key, p); }
        catch (e) { storageBlocked.current = true; throw e; }
        intention.current = p; setPending(p);
      }
      const r = await rpc.renovar.mutate(p.payload as EntradaRenovacaoProspectiva);
      if (!current(expected, epoch)) return;
      preserved();
      conferirResultado(r, p);
      const confirmed = { ...p, confirmacao: r };
      renovacaoProspectivaGuardarIntencao(sessionStorage, key, confirmed);
      intention.current = confirmed; setPending(confirmed); onSuccess(r);
    } catch (e) {
      if (current(expected, epoch)) setError(`${(e as Error).message} Se houve envio, não presuma rollback: conserve UUID/payload e confira a mesma intenção. Não há reset automático.`);
    } finally { if (current(expected, epoch)) { flight.current = false; setBusy(false); } }
  }
  if (!key || screenKey !== context) return <span className="text-sm">Aguardando sessão atual e origem prospectiva comprovada para renovação.</span>;
  if (somenteConferencia && !pending) return <p className="text-sm" role={error ? "alert" : undefined}>{error ? `${error} ` : ""}Sem intenção de renovação preservada nesta sessão. Somente consulta ao histórico; nenhuma nova ação financeira disponível.</p>;
  return <>
    <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); if (!current(context, renderEpoch)) return; setOpen(true); if (!somenteConferencia && !intention.current) void consult(); }}>{somenteConferencia ? "Conferir renovação preservada" : "Renovar / conferir"}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{somenteConferencia ? "Conferência da renovação preservada" : "Renovação mensal prospectiva v1"}</DialogTitle></DialogHeader>
      <div className="space-y-3 text-sm">
        <p>{somenteConferencia ? "Parcela renovada: somente leitura e replay da mesma intenção. Não há nova cotação, chave, recebimento ou cobrança de principal." : "Somente primeira renovação de uma parcela mensal inicial 0021/0022 íntegra. Legado, parcial anterior, desconto, múltiplas parcelas e amortização permanecem bloqueados."}</p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {pending ? <>
          <p>Intenção preservada: <code>{pending.payload.idempotencyKey}</code>. Retry usa exatamente o payload original, mesmo após expiração.</p>
          <pre className="overflow-auto text-xs">{JSON.stringify(pending.payload, null, 2)}</pre>
          {pending.confirmacao && <><p>Renovação confirmada: juros e encargos recebidos; principal transferido, não quitado.</p><pre className="overflow-auto text-xs">{JSON.stringify(pending.confirmacao, null, 2)}</pre></>}
        </> : !somenteConferencia && quote && <>
          <p>Contrato #{contratoId} / parcela #{parcelaId}; conta original fixa #{quote.contaCaixaId}.</p>
          <dl className="grid grid-cols-2 gap-2 border rounded p-3">
            <dt>Juros embutidos pagos</dt><dd>R$ {quote.jurosEmbutidos}</dd>
            <dt>Multa exigida</dt><dd>R$ {quote.multa}</dd><dt>Mora exigida BRT</dt><dd>R$ {quote.mora}</dd>
            <dt>Total recebido EXATO</dt><dd className="font-semibold">R$ {quote.totalExigido}</dd>
            <dt>Principal pago</dt><dd>R$ 0,00</dd><dt>Principal conservado</dt><dd>R$ {quote.principalDepois}</dd>
            <dt>Nova obrigação</dt><dd>R$ {quote.novoTotal} (juros {quote.novoJuros})</dd>
            <dt>Novo vencimento</dt><dd>{quote.novoVencimento}</dd>
          </dl>
          <p>Data civil BRT: {quote.dataPagamento}; expira na próxima meia-noite BRT ({quote.expiraEm}). Calendário: um mês após o maior entre hoje BRT e vencimento anterior, com último dia do mês quando necessário.</p>
          {expired && <p role="alert">Cotação expirou. Atualize antes de confirmar.</p>}
          <Button variant="outline" disabled={busy || storageBlocked.current} onClick={consult}>Atualizar cotação antes de enviar</Button>
        </>}
        <Button disabled={busy || storageBlocked.current || (!pending && (somenteConferencia || !quote || expired || !!error))} onClick={send}>
          {busy ? "Conferindo..." : pending ? "Conferir/repetir intenção preservada" : "Confirmar juros + encargos recebidos e renovar"}
        </Button>
        <p className="text-xs text-muted-foreground">Não há valor livre, quitação fictícia do principal, nova chave após timeout ou restauração automática de operação incerta. Segunda renovação não está incluída na v1.</p>
      </div>
    </DialogContent></Dialog>
  </>;
}
