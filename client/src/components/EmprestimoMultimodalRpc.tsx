import { useEffect, useRef, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { toast } from "sonner";
import type { EmprestimosMultimodalAppRouter } from "../../../server/routers/emprestimosMultimodal";
import { guardarIntencao, lerIntencao, type IntencaoPersistida } from "./EmprestimoSeguroRpc";
import { canCloseRejectedIntent, recoveryRequest, type RecoveryEvidence } from "../../../shared/financialIntentRecovery";
import {
  entradaMultimodalSchema, recebimentoMultimodalSchema, renovacaoMultimodalSchema,
  normalizarResultadoCriacaoMultimodal, normalizarRecebimentoMultimodal, normalizarRenovacaoMultimodal,
  normalizarRecuperacaoMultimodal, validarRecuperacaoMultimodal, type EntradaMultimodal, type EntradaRecebimentoMultimodal, type EntradaRenovacaoMultimodal,
} from "../../../shared/emprestimosMultimodalCalculo";

export const multimodalRpc = createTRPCProxyClient<EmprestimosMultimodalAppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson,
    fetch(input, init) { return globalThis.fetch(input, { ...init, credentials: "include" }); },
  })],
}).emprestimosMultimodal;
export type AcaoMultimodal = "criar" | "receber" | "renovar";
export function chaveMultimodal(userId: number | undefined, acao: AcaoMultimodal, contratoId?: number, parcelaId?: number): string {
  return userId && Number.isInteger(userId) && userId > 0 ? `cobrapro:multimodal:v1:${userId}:${acao}:${contratoId ?? "novo"}:${parcelaId ?? "nova"}` : "";
}
export function percentualMultimodal(value: string): string {
  if (!/^\d{1,4}(\.\d{1,4})?$/.test(value)) throw new Error("Informe percentual explícito com até quatro casas decimais.");
  const [inteiro, fracao = ""] = value.split(".");
  return `${BigInt(inteiro)}.${fracao.padEnd(4, "0")}`;
}
function confirmar(acao: AcaoMultimodal, result: unknown, payload: Record<string, unknown>) {
  if (acao === "criar") return normalizarResultadoCriacaoMultimodal(result, payload as EntradaMultimodal);
  if (acao === "receber") return normalizarRecebimentoMultimodal(result, payload as EntradaRecebimentoMultimodal);
  return normalizarRenovacaoMultimodal(result, payload as EntradaRenovacaoMultimodal);
}
type Geracao = { key: string; contexto: string; ativa: boolean };
/** Uma geração é identidade, não apenas chave: A→B→A e unmount não ressuscitam callbacks de A. */
export function useIntencaoMultimodal<T extends Record<string, unknown> & { idempotencyKey: string }>(
  userId: number | undefined, acao: AcaoMultimodal, onSuccess: (result: unknown) => void, contratoId?: number, parcelaId?: number, contexto = "",
) {
  const key = chaveMultimodal(userId, acao, contratoId, parcelaId);
  const current = useRef<Geracao>({ key, contexto, ativa: false });
  if (current.current.key !== key || current.current.contexto !== contexto) {
    current.current.ativa = false;
    current.current = { key, contexto, ativa: false };
  }
  const geracao = current.current;
  const flight = useRef(false), ref = useRef<IntencaoPersistida<T> | null>(null);
  const snapshot = useRef<string | null>(null), bloqueio = useRef("");
  const callback = useRef(onSuccess); callback.current = onSuccess;
  const [escopo, setEscopo] = useState<Geracao>();
  const [pendente, setPendente] = useState<IntencaoPersistida<T> | null>(null);
  const [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  const recoveryRef = useRef<RecoveryEvidence | undefined>(undefined);
  const [recovery, setRecovery] = useState<RecoveryEvidence>();
  const family = acao === "criar" ? "multimodal_criar" : acao === "receber" ? "multimodal_receber" : "multimodal_renovar";
  const atual = () => !!key && current.current === geracao && geracao.ativa && escopo === geracao;
  function bloquear(message: string): never { bloqueio.current = message; setErro(message); throw new Error(message); }
  function ler(raw: string | null): IntencaoPersistida<T> | null {
    const saved = lerIntencao<T>({ getItem: () => raw }, key);
    if (!saved) return null;
    const schema = acao === "criar" ? entradaMultimodalSchema : acao === "receber" ? recebimentoMultimodalSchema : renovacaoMultimodalSchema;
    if (!schema.safeParse(saved.payload).success ||
        (acao !== "criar" && (saved.payload.contratoId !== contratoId || saved.payload.parcelaId !== parcelaId))) {
      throw new Error("Intenção não corresponde à ação/contrato/parcela. Preserve UUID/payload e confira o histórico.");
    }
    return saved;
  }
  function adotar(raw: string | null) {
    const saved = ler(raw);
    snapshot.current = raw; ref.current = saved;
    if (saved && Object.hasOwn(saved, "confirmacao")) {
      try { confirmar(acao, saved.confirmacao, saved.payload); }
      catch {
        // O registro original fica intocado. Só reconciliação autoritativa pode substituí-lo.
        const pending = { versao: 1 as const, payload: saved.payload };
        ref.current = pending; setPendente(pending);
        bloquear("Confirmação local inválida. Preserve a intenção; confira o mesmo UUID no servidor.");
      }
    }
    setPendente(saved);
    return saved;
  }
  function conferirStorage() {
    let raw: string | null;
    try { raw = sessionStorage.getItem(key); }
    catch { bloquear("Storage indisponível. Preserve UUID/payload; nenhum novo envio autorizado."); }
    if (raw !== snapshot.current) bloquear("Intenção/cache mudou ou foi removida. Não sobrescreva nem gere outra operação; confira o histórico.");
  }
  function persistir(saved: IntencaoPersistida<T>) {
    guardarIntencao(sessionStorage, key, saved);
    const raw = JSON.stringify(saved);
    if (sessionStorage.getItem(key) !== raw) throw new Error("Intenção não foi preservada no storage; não iniciar outra operação.");
    snapshot.current = raw; ref.current = saved; setPendente(saved);
  }
  useEffect(() => {
    geracao.ativa = true;
    flight.current = false; ref.current = null; snapshot.current = null; bloqueio.current = "";
    recoveryRef.current = undefined;
    setPendente(null); setRecovery(undefined); setBusy(false); setErro(""); setEscopo(geracao);
    if (key) {
      try { adotar(sessionStorage.getItem(key)); }
      catch (e) { bloqueio.current = (e as Error).message; setErro(bloqueio.current); }
    }
    return () => { geracao.ativa = false; };
  }, [geracao]);
  async function enviar(nova: () => Promise<T>, executar: (payload: T) => Promise<unknown>) {
    if (!atual() || flight.current || bloqueio.current || recoveryRef.current?.status === "not_executed") return;
    flight.current = true; setBusy(true);
    try {
      // Outra montagem pode ter persistido enquanto o formulário ainda estava aberto.
      if (!ref.current) adotar(sessionStorage.getItem(key));
      else conferirStorage();
      let saved = ref.current;
      if (saved && Object.hasOwn(saved, "confirmacao")) return;
      if (!saved) {
        const payload = await nova();
        if (!atual()) return;
        conferirStorage();
        saved = { versao: 1, payload };
        // Mantém o UUID candidato inclusive se setItem falhar. Handler antigo não gera substituto.
        ref.current = saved; setPendente(saved);
        try { persistir(saved); }
        catch (e) { bloquear(`Não foi possível preservar a intenção: ${(e as Error).message}`); }
      }
      conferirStorage();
      const result = await executar(saved.payload);
      if (!atual()) return;
      conferirStorage();
      const confirmed = { ...saved, confirmacao: confirmar(acao, result, saved.payload) };
      persistir(confirmed);
      toast.success("Operação financeira confirmada sem duplicar a intenção."); callback.current(confirmed.confirmacao);
    } catch (e) {
      if (atual()) {
        const aviso = ref.current
          ? "Preserve UUID/payload; erro de transporte não prova rollback."
          : "Corrija o campo informado e confirme novamente. Nenhum desembolso foi solicitado por esta tentativa.";
        toast.error(`${(e as Error).message} ${aviso}`);
      }
    }
    finally { if (atual()) { flight.current = false; setBusy(false); } }
  }
  async function reconciliar() {
    const saved = ref.current;
    if (!saved || !userId || !atual() || flight.current || Object.hasOwn(saved, "confirmacao")) return;
    flight.current = true; setBusy(true);
    try {
      conferirStorage();
      const request = validarRecuperacaoMultimodal(recoveryRequest(family, saved.payload));
      const value = await multimodalRpc.reconciliar.mutate(request);
      if (!atual()) return;
      conferirStorage();
      const result = normalizarRecuperacaoMultimodal(value, userId, request);
      if (result.status === "confirmed") {
        const confirmed = { ...saved, confirmacao: confirmar(acao, result.result, saved.payload) };
        persistir(confirmed); recoveryRef.current = result; setRecovery(result);
        bloqueio.current = ""; setErro(""); callback.current(confirmed.confirmacao);
      } else { recoveryRef.current = result; setRecovery(result); bloqueio.current = ""; setErro(""); }
    } catch (e) { if (atual()) toast.error(`${(e as Error).message} Não execução não comprovada; não descarte a intenção.`); }
    finally { if (atual()) { flight.current = false; setBusy(false); } }
  }
  function concluirOuCorrigir(): T | null {
    const saved = ref.current;
    if (!saved || !userId || !atual() || flight.current) return null;
    try {
      conferirStorage();
      const confirmada = Object.hasOwn(saved, "confirmacao");
      if (confirmada) confirmar(acao, saved.confirmacao, saved.payload);
      else if (!canCloseRejectedIntent(recoveryRef.current, userId, recoveryRequest(family, saved.payload))) return null;
      sessionStorage.removeItem(key);
      if (sessionStorage.getItem(key) !== null) bloquear("Não foi possível encerrar a intenção local. Preserve a mesma chave.");
      ref.current = null; snapshot.current = null; bloqueio.current = "";
      recoveryRef.current = undefined;
      setPendente(null); setRecovery(undefined); setErro("");
      return confirmada ? null : saved.payload;
    } catch (e) { if (atual()) { bloqueio.current = (e as Error).message; setErro(bloqueio.current); } return null; }
  }
  return { key, geracao, atual, encerrada: () => atual() && !ref.current && !bloqueio.current, pronta: atual(), pendente: atual() ? pendente : null, busy: atual() && busy, erro: atual() ? erro : "", recovery: atual() ? recovery : undefined, enviar, reconciliar, concluirOuCorrigir };
}
