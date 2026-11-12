import { useEffect, useRef, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RecebimentosLegadosAppRouter } from "../../../server/routers/recebimentosLegados";
import { entradaRecebimentoLegadoSchema, normalizarRecebimentoLegado, type CotacaoRecebimentoLegado, type EntradaRecebimentoLegado, type ResultadoRecebimentoLegado } from "../../../server/services/recebimentosLegadosRpc";
const rpc = createTRPCProxyClient<RecebimentosLegadosAppRouter>({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson,
  fetch(input, init) { return globalThis.fetch(input, { ...init, credentials: "include" }); },
})] }).recebimentosLegados;
export type IntencaoLegada = { versao: 1; payload: EntradaRecebimentoLegado; confirmacao?: ResultadoRecebimentoLegado };
export function lerIntencaoLegada(text: string, contratoId: number, parcelaId: number): IntencaoLegada {
  const value = JSON.parse(text);
  const payload = entradaRecebimentoLegadoSchema.parse(value?.payload);
  if (value?.versao !== 1 || payload.contratoId !== contratoId || payload.parcelaId !== parcelaId) throw new Error("Intenção armazenada incompatível. Não inicie outra; confira o histórico.");
  return { versao: 1, payload, ...(value.confirmacao == null ? {} : { confirmacao: normalizarRecebimentoLegado(value.confirmacao, payload) }) };
}
/** Conta escolhida explicitamente. Não infere, adota ou altera vínculos legados. */
export function ParcelaLegadaReceber({ contratoId, parcelaId, contaCaixaId, onSuccess }: { contratoId: number; parcelaId: number; contaCaixaId: number; onSuccess: () => void }) {
  const { data: user } = trpc.auth.me.useQuery();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  const [q, setQ] = useState<CotacaoRecebimentoLegado | null>(null), [intencao, setIntencao] = useState<IntencaoLegada | null>(null);
  const [aceite, setAceite] = useState(false), [valor, setValor] = useState("");
  // NÃO varia com conta: trocar destino não pode criar segunda intenção após timeout.
  const key = user ? `cobrapro:legado:v1:${user.id}:${contratoId}:${parcelaId}` : "";
  const scope = key ? `${key}:destino:${contaCaixaId}` : "";
  const atual = useRef(scope); atual.current = scope;
  const mounted = useRef(true), epoch = useRef(0), storageBlocked = useRef(false);
  const [tela, setTela] = useState(""); const pending = useRef<IntencaoLegada | null>(null); const enviando = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; }; }, []);
  useEffect(() => {
    epoch.current++; storageBlocked.current = false; pending.current = null; enviando.current = false;
    setIntencao(null); setQ(null); setErro(""); setAceite(false); setValor(""); setOpen(false); setBusy(false); setTela(scope);
    if (!key) return;
    try {
      const text = sessionStorage.getItem(key);
      if (text) { const p = lerIntencaoLegada(text, contratoId, parcelaId); pending.current = p; setIntencao(p); }
    } catch { storageBlocked.current = true; setErro("Storage indisponível ou intenção armazenada inválida. Não substitua o UUID: confira o histórico antes de continuar."); }
  }, [key, scope, contratoId, parcelaId]);
  const valido = () => mounted.current && !!scope && atual.current === scope && tela === scope;
  async function cotar() {
    if (!valido() || storageBlocked.current || pending.current || enviando.current) return;
    const ticket = epoch.current; const current = () => valido() && epoch.current === ticket;
    enviando.current = true; setBusy(true); setErro(""); setQ(null); setAceite(false);
    try { const v = await rpc.cotar.query({ contratoId, parcelaId, contaCaixaId }); if (current()) { setQ(v); setValor(""); } }
    catch (e) { if (current()) setErro((e as Error).message); }
    finally { if (current()) { enviando.current = false; setBusy(false); } }
  }
  async function receber() {
    if (!valido() || storageBlocked.current || enviando.current || busy || erro && !pending.current) return;
    const ticket = epoch.current; const current = () => valido() && epoch.current === ticket;
    enviando.current = true; setBusy(true);
    try {
      let p = pending.current;
      if (!p) {
        if (!q?.elegivel || !aceite || valor !== q.totalExigido) throw new Error("Confirme o valor realmente recebido exatamente igual à cotação SQL.");
        p = { versao: 1, payload: entradaRecebimentoLegadoSchema.parse({ contratoId, parcelaId, contaCaixaId, idempotencyKey: crypto.randomUUID(), estadoHash: q.estadoHash, regra: q.regra, totalExigido: q.totalExigido, valorRecebido: valor, dataPagamento: q.dataPagamento }) };
        // Falha de storage ANTES do POST impede o envio.
        sessionStorage.setItem(key, JSON.stringify(p)); pending.current = p; setIntencao(p);
      }
      const r = await rpc.receber.mutate(p.payload);
      if (!current()) return;
      const confirmed = { ...p, confirmacao: normalizarRecebimentoLegado(r, p.payload) };
      sessionStorage.setItem(key, JSON.stringify(confirmed)); pending.current = confirmed; setIntencao(confirmed); setErro(""); onSuccess();
    } catch (e) { if (current()) setErro(`${(e as Error).message} Sem confirmação, preserve e confira o mesmo UUID/payload. Não presuma rollback.`); }
    finally { if (current()) { enviando.current = false; setBusy(false); } }
  }
  if (!key || tela !== scope) return <span>Aguardando sessão atual.</span>;
  return <><Button size="sm" onClick={e => { e.stopPropagation(); setOpen(true); if (!pending.current) void cotar(); }}>Receber legado / conferir</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Recebimento legado integral validado</DialogTitle></DialogHeader>
      <p className="text-sm">Sem recálculo, desconto, multa nova, mora nova ou parcial. Só parcela financeiramente virgem com encargos explicitamente zero. Não é perdão de encargos. Não movimenta dinheiro externo nem altera o saldo-base da conta.</p>
      {erro && <p role="alert">{erro}</p>}
      {intencao ? <><p>Intenção preservada; conta da intenção #{intencao.payload.contaCaixaId}.</p><pre className="text-xs overflow-auto">{JSON.stringify(intencao.payload, null, 2)}</pre>
        {intencao.confirmacao && <p role="status">Recebimento confirmado: {intencao.confirmacao.valorRecebido}; operação {intencao.confirmacao.operationId}; residual zero.</p>}
        <Button disabled={busy || storageBlocked.current} onClick={receber}>Conferir/repetir mesmo UUID e payload</Button></>
        : q?.elegivel ? <><p>Contrato #{contratoId}; parcela #{parcelaId}; conta escolhida #{contaCaixaId}. Total exato: {q.totalExigido}. Data SQL Brasília: {q.dataPagamento}; validade: {q.validadeDataCivil}.</p>
          <label>Valor realmente recebido (formato 100.00)<input className="w-full border rounded p-2" value={valor} disabled={busy} onChange={e => setValor(e.target.value)} /></label>
          <label className="flex gap-2"><input type="checkbox" checked={aceite} disabled={busy} onChange={e => setAceite(e.target.checked)} />Confirmo a regra sem recálculo e o recebimento integral real.</label>
          <Button disabled={busy || storageBlocked.current || !aceite || valor !== q.totalExigido || !!erro} onClick={receber}>Confirmar recebimento</Button><Button variant="outline" disabled={busy || storageBlocked.current} onClick={cotar}>Atualizar cotação</Button></>
        : q && <p>Não elegível: {q.motivos.join(", ")}. Nenhuma baixa será feita.</p>}
      <p className="text-xs">Timeout/reload não cria chave nova. Não há reset automático ou fallback antigo. Nova cotação não substitui intenção já enviada.</p>
    </DialogContent></Dialog></>;
}
