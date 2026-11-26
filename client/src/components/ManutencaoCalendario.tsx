import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calendario44Schema, validarClosure44, type Closure44, type Calendario44 } from "../../../shared/manutencaoEmprestimos";

import { encerrarJournal44 } from "../../../shared/calendario44Journal";

/** Sem reaproveitar o editor legado que também altera principal/juros. */
export function ManutencaoCalendario({ contratoId, onSuccess }: { contratoId: number; onSuccess?: () => void }) {
  const auth = trpc.auth.me.useQuery(undefined, { refetchOnMount: true });
  const userId = !auth.isFetching && !auth.isError ? auth.data?.id : undefined;
  const scope = trpc.manutencaoEmprestimos.sessao46.useQuery(undefined, { enabled: !!userId, retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true });
  const sessionScope = !scope.isFetching && !scope.isError && scope.data && scope.data.userId === userId ? scope.data.sessionScope : undefined;
  return userId && sessionScope ? <CalendarioSessao key={`${userId}:${sessionScope}:${contratoId}`} userId={userId} sessionScope={sessionScope} contratoId={contratoId} onSuccess={onSuccess} /> : <Button disabled variant="outline">Conferindo sessão...</Button>;
}
function CalendarioSessao({ userId, sessionScope, contratoId, onSuccess }: { userId: number; sessionScope: string; contratoId: number; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [datas, setDatas] = useState<string[]>([]), [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState<Calendario44 | null>(null), [terminal, setTerminal] = useState<Closure44 | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const legacyKey = `cobrapro:calendario44:${userId}:${contratoId}`;
  const scopedKey = `cobrapro:calendario46:${userId}:${sessionScope}:${contratoId}`;
  // Never migrate/delete old44 intentions. They have their own original writer/recovery.
  const [storageKey, setStorageKey] = useState(scopedKey);
  const [legacyPending, setLegacyPending] = useState(false);
  const active = useRef(true), flight = useRef(false), disk = useRef<string | null>(null);
  const supported = ready && !legacyPending;
  const quote = trpc.manutencaoEmprestimos.cotarCalendario46.useQuery({ contratoId, sessionScope }, { enabled: open && ready && !pending && !error && supported, retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false });
  const execute46 = trpc.manutencaoEmprestimos.alterarCalendario46.useMutation();
  const recover46 = trpc.manutencaoEmprestimos.conferirCalendario46.useMutation();
  const busy = execute46.isPending || recover46.isPending;
  useEffect(() => {
    active.current = true;
    try {
      const old = localStorage.getItem(legacyKey), current = localStorage.getItem(scopedKey);
      if (old && current) throw Error("Há intenções44 e46 simultâneas. Preserve ambas para conferência; nenhuma nova operação autorizada.");
      const key = old ? legacyKey : scopedKey, raw = old ?? current;
      setStorageKey(key); setLegacyPending(!!old); disk.current = raw;
      if (raw) {
        const parsed = calendario44Schema.parse(JSON.parse(raw));
        if (parsed.contratoId !== contratoId) throw Error("Intenção local pertence a outro contrato.");
        setPending(parsed); setMessage("Intenção preservada: repita somente o envio original ou confira para confirmar/fechar com fence.");
      }
      setReady(true);
    } catch { setError("Não foi possível validar a intenção persistida. Nenhuma nova operação foi autorizada. Preserve o armazenamento para conferência."); }
    return () => { active.current = false; };
  }, [legacyKey, scopedKey, contratoId]);
  useEffect(() => { if (quote.data && !pending) setDatas([...quote.data.vencimentos]); }, [quote.data, pending]);
  function checkDisk() {
    if (localStorage.getItem(storageKey) !== disk.current) throw Error("Intenção alterada em outra aba. Não sobrescreva nem gere nova UUID.");
  }
  async function send(conferir: boolean) {
    if (!active.current || !ready || flight.current || error || terminal) return;
    flight.current = true;
    if (!navigator.locks) {
      setError("Este navegador não oferece coordenação segura entre abas. Nenhum envio foi autorizado.");
      flight.current = false; return;
    }
    await navigator.locks.request(storageKey, async () => {
    try {
      if (!active.current) return;
      checkDisk();
      let intent = pending;
      if (!intent) {
        if (conferir || !supported || !quote.data || quote.isFetching || quote.isError) return;
        intent = calendario44Schema.parse({ contratoId, idempotencyKey: crypto.randomUUID(), estadoHash: quote.data.estadoHash, vencimentos: datas, motivo });
        const raw = JSON.stringify(intent);
        // Read-back obrigatório ANTES de solicitar a mutação. Payload nunca muda no retry.
        localStorage.setItem(storageKey, raw);
        if (localStorage.getItem(storageKey) !== raw) throw Error("Intenção não persistiu. Nenhum envio autorizado.");
        disk.current = raw; setPending(intent);
      }
      const scoped = { sessionScope, intent };
      const r = conferir ? await recover46.mutateAsync(scoped) : await execute46.mutateAsync(scoped);
      if (!active.current) return;
      checkDisk();
      const proof = validarClosure44(r, intent);
      setTerminal(proof);
      if (proof.status === "confirmed") {
        setMessage("Calendário confirmado; principal, juros e livro-caixa preservados."); onSuccess?.();
      } else setMessage("Intenção encerrada no servidor por fence durável. Esta UUID nunca mais poderá executar; encerre o journal para cotar uma nova intenção corrigida.");
    } catch (e) { if (active.current) setMessage(`${(e as Error).message} Preserve a mesma UUID; não é prova de rollback.`); }
    finally { flight.current = false; }
    }).catch(e => { flight.current = false; if (active.current) setError(`Não foi possível coordenar a intenção: ${(e as Error).message}`); });
  }
  async function closeConfirmed() {
    if (!terminal || !pending || busy || flight.current || !navigator.locks) return;
    flight.current = true;
    await navigator.locks.request(storageKey, async () => {
    try {
      if (!active.current) return;
      checkDisk();
      encerrarJournal44(localStorage, storageKey, pending, terminal);
      disk.current = null; setStorageKey(scopedKey); setLegacyPending(false); setPending(null); setTerminal(null); setMotivo(""); setMessage(""); setOpen(false);
      void quote.refetch();
    } catch (e) { setError((e as Error).message); }
    finally { flight.current = false; }
    }).catch(e => { flight.current = false; if (active.current) setError((e as Error).message); });
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Calendário / conferir</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Alterar vencimentos mensais</DialogTitle></DialogHeader>
      <p>Somente contrato mensal integralmente aberto com datas futuras, origem real25 ou21, sem recebimentos, renovação ou multa manual. Não altera valores, juros ou número de parcelas. Não apaga lançamentos.</p>
      {error && <p role="alert">{error}</p>}
      {!ready && !error && <p role="status">Conferindo intenção preservada...</p>}
      {pending ? <div><p>Conferir confirma um commit existente ou impede definitivamente qualquer execução atrasada desta UUID.</p><p className="break-all">UUID: <code>{pending.idempotencyKey}</code></p><p>Agenda preservada: {pending.vencimentos.join(", ")}</p><p>Motivo: {pending.motivo}</p></div> : <>
        {quote.isFetching && <p role="status">Conferindo elegibilidade no banco...</p>}
        {supported && quote.isError && <p role="alert">Calendário indisponível para este contrato. É necessário um contrato mensal aberto, com datas futuras e sem recebimentos, renovação ou multa manual. Nenhuma alteração enviada.</p>}
        {supported && !quote.isFetching && !quote.isError && quote.data?.parcelasIds.map((id, i) => <label key={id}>Parcela {i + 1}<Input type="date" value={datas[i] ?? ""} disabled={busy || !ready} onChange={e => setDatas(prev => prev.map((d, k) => i === k ? e.target.value : d))} /></label>)}
        {supported && <label>Motivo auditável<Input value={motivo} maxLength={500} disabled={busy || !ready} onChange={e => setMotivo(e.target.value)} /></label>}
      </>}
      {message && <p role="status">{message}</p>}
      {terminal ? <Button onClick={closeConfirmed}>Arquivar confirmação / fence</Button> : <div className="flex flex-wrap gap-2">
        {pending && <Button variant="outline" disabled={busy || !ready || !!error} onClick={() => void send(true)}>Conferir / encerrar intenção no servidor</Button>}
        <Button disabled={busy || !ready || !!error || (!pending && (!supported || !quote.data || quote.isError || quote.isFetching))} onClick={() => void send(false)}>{busy ? "Conferindo..." : pending ? "Repetir a mesma intenção" : "Confirmar calendário"}</Button>
      </div>}
    </DialogContent></Dialog>
  </>;
}
