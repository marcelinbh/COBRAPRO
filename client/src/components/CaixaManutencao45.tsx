import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { conferirRecoveryCaixa45, intencaoCaixa45, type IntencaoCaixa45 } from "../../../shared/caixaManutencao45";

import { comLockJournalCaixa45, pendenteCaixa45, persistirCaixa45, concluirCaixa45 } from "../../../shared/caixaManutencao45Storage";

/** Observação adicional auditada: não renomeia a descrição original usada pelos ciclos. */
export function CaixaManutencao45({ userId, atual, onSuccess }: { userId: number; atual: () => boolean; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [tid, setTid] = useState("");
  const [observacao, setObservacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState<IntencaoCaixa45 | null>(null);
  const [storageOk, setStorageOk] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const busy = useRef(false), tenant = useRef(userId);
  tenant.current = userId;
  const vigente = () => mounted.current && tenant.current === userId && atual();
  const journal = <T,>(fn: () => T | Promise<T>) => comLockJournalCaixa45(navigator.locks, userId, fn);
  useEffect(() => {
    mounted.current = true; setStorageOk(false); setPending(null); setMessage("");
    let alive = true;
    const carregar = async () => {
      try {
        const p = await journal(() => pendenteCaixa45(localStorage, userId));
        if (alive && vigente()) { setPending(p); setStorageOk(true); }
      } catch { if (alive && vigente()) { setStorageOk(false); setMessage("Journal/lock indisponível ou ilegível. Nada novo será enviado. Preserve o armazenamento; reabra para recuperar."); } }
    };
    void carregar();
    window.addEventListener("storage", carregar); window.addEventListener("focus", carregar);
    return () => { alive = false; mounted.current = false; window.removeEventListener("storage", carregar); window.removeEventListener("focus", carregar); };
  }, [userId]);
  const id = /^[1-9][0-9]*$/.test(tid) && Number(tid) <= 2147483647 ? Number(tid) : 0;
  const query = trpc.caixa.consultarObservacao45.useQuery({ transacaoId: id || 1 }, { enabled: open && !!id && !pending && storageOk && vigente(), retry: false, staleTime: 0 });
  const corrigir = trpc.caixa.corrigirObservacao45.useMutation({ retry: false });
  const reconciliar = trpc.caixa.reconciliarObservacao45.useMutation({ retry: false });
  const valid = query.data && !query.isError && !query.error && !query.isFetching && query.data.empresaId === userId && query.data.transacaoId === id;
  const finalizar = async (text: string, intent: IntencaoCaixa45, evidence: unknown) => {
    const prova = conferirRecoveryCaixa45(evidence, userId, intent);
    const next = await journal(() => { concluirCaixa45(localStorage, userId, intent, prova); return pendenteCaixa45(localStorage, userId); });
    if (!vigente()) return;
    setPending(next); setMessage(text); setObservacao(""); setMotivo("");
    void query.refetch(); onSuccess();
  };
  const enviar = async () => {
    if (!vigente() || busy.current || pending || !valid || !storageOk) return;
    busy.current = true;
    let intent: IntencaoCaixa45 | null = null;
    try {
      intent = await journal(() => {
        if (!vigente()) throw new Error("Empresa alterada");
        const anterior = pendenteCaixa45(localStorage, userId);
        if (anterior) { setPending(anterior); setMessage("Há uma intenção preservada. Confira antes de criar outra."); return null; }
        const i = intencaoCaixa45.parse({ idempotencyKey: crypto.randomUUID(), request: { transacaoId: id, estadoHash: query.data!.estadoHash, observacao: observacao.trim(), motivo: motivo.trim() } });
        persistirCaixa45(localStorage, userId, i); return i;
      });
      if (!intent) return;
      if (vigente()) setPending(intent);
      // Payload fechado persistido ANTES de rede; mudança de tenant preserva recovery.
      if (!vigente()) return;
      const result = await corrigir.mutateAsync(intent);
      await finalizar("Observação corrigida com auditoria. Movimento original e saldo preservados.", intent, { status: "confirmed", result });
    } catch { if (vigente()) setMessage(intent ? "Resultado/limpeza não confirmado. Use Conferir envio com o mesmo UUID; não crie outra chave." : "Não foi possível persistir intenção válida. Nada enviado."); }
    finally { busy.current = false; }
  };
  const conferir = async () => {
    if (!pending || busy.current || !vigente()) return;
    busy.current = true;
    const intent = pending;
    try {
      const r = conferirRecoveryCaixa45(await reconciliar.mutateAsync(intent), userId, intent);
      await finalizar(r.status === "confirmed" ? "Correção confirmada pela auditoria persistida." : "Envio não executado: UUID fechado contra execução tardia. Uma nova intenção exige nova prévia.", intent, r);
    } catch { if (vigente()) setMessage("Conferência/limpeza indisponível. Intenção preservada: erro não é prova de ausência de execução."); }
    finally { busy.current = false; }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm">Corrigir observação</Button></DialogTrigger>
    <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Correção auditada de observação</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Acrescenta uma observação com motivo. Não altera a descrição original, valores, conta, contratos ou parcelas. Estorno monetário e exclusão continuam indisponíveis neste fluxo.</p>
      {message && <p role="status" className="text-sm">{message}</p>}
      {pending ? <div className="space-y-3">
        <p className="text-sm">Intenção preservada do lançamento #{pending.request.transacaoId}: {pending.request.observacao}</p>
        <p className="text-xs break-all">UUID: {pending.idempotencyKey}</p>
        <Button disabled={corrigir.isPending || reconciliar.isPending || !vigente()} onClick={() => void conferir()}>Conferir envio</Button>
      </div> : <div className="space-y-3">
        <Label htmlFor="caixa45-id">Número do lançamento (#)</Label>
        <Input id="caixa45-id" inputMode="numeric" value={tid} onChange={e => setTid(e.target.value)} disabled={!storageOk} />
        {query.error && id > 0 && <p role="alert" className="text-sm">Não foi possível validar o movimento. Nenhum writer alternativo será usado.</p>}
        {valid && <div className="text-sm"><p>Observação atual: {query.data!.observacaoAtual || "Nenhuma"}</p><p>{query.data!.correcoes} correção(ões) auditada(s). O original permanece intacto.</p></div>}
        <Label htmlFor="caixa45-nota">Nova observação adicional</Label><Input id="caixa45-nota" maxLength={500} value={observacao} onChange={e => setObservacao(e.target.value)} disabled={!storageOk} />
        <Label htmlFor="caixa45-motivo">Motivo da correção</Label><Input id="caixa45-motivo" maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={!storageOk} />
        <Button disabled={!valid || !storageOk || !observacao.trim() || !motivo.trim() || corrigir.isPending || !vigente()} onClick={() => void enviar()}>Confirmar observação auditada</Button>
      </div>}
    </DialogContent>
  </Dialog>;
}
