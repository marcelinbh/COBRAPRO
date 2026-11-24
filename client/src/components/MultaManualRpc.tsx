import { useEffect, useRef, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { toast } from "sonner";
import type { MultaManualAppRouter } from "../../../server/routers/multaManual";
import { guardarIntencao, lerIntencao, type IntencaoPersistida } from "./EmprestimoSeguroRpc";
import { canonicalIntent } from "../../../shared/financialIntentRecovery";
import {
  aplicarMultaSchema, receberMultaSchema, renovarMultaSchema,
  normalizarAplicacaoMulta, normalizarRecebimentoMulta, normalizarRenovacaoMulta,
  normalizarRecuperacaoMulta,
  type EntradaAplicarMulta, type EntradaReceberMulta, type EntradaRenovarMulta,
} from "../../../shared/multaManual";

export const multaManualRpc = createTRPCProxyClient<MultaManualAppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson,
    fetch(input, init) { return globalThis.fetch(input, { ...init, credentials: "include" }); },
  })],
}).multaManual;
export type AcaoMulta = "multa" | "receber" | "renovar";
export function chaveMulta(userId: number | undefined, acao: AcaoMulta, contratoId: number, parcelaId?: number) {
  return Number.isSafeInteger(userId) && userId! > 0 && Number.isSafeInteger(contratoId) && contratoId > 0
    ? `cobrapro:multa36:v1:${userId}:${acao}:${contratoId}:${parcelaId ?? "contrato"}` : "";
}
function request(acao: AcaoMulta, payload: Record<string, unknown> & { idempotencyKey: string }) {
  const { idempotencyKey, ...body } = payload;
  return { acao, idempotencyKey, payload: body };
}
function confirmar(acao: AcaoMulta, value: unknown, payload: Record<string, unknown>) {
  if (acao === "multa") return normalizarAplicacaoMulta(value, payload as EntradaAplicarMulta);
  if (acao === "receber") return normalizarRecebimentoMulta(value, payload as EntradaReceberMulta);
  return normalizarRenovacaoMulta(value, payload as EntradaRenovarMulta);
}
type Generation = { key: string; contexto: string; ativa: boolean };
export function useIntencaoMulta<T extends Record<string, unknown> & { idempotencyKey: string }>(
  userId: number | undefined, acao: AcaoMulta, contratoId: number, parcelaId: number | undefined,
  onSuccess: (result: unknown) => void, contexto = "",
) {
  const key = chaveMulta(userId, acao, contratoId, parcelaId);
  const current = useRef<Generation>({ key, contexto, ativa: false });
  if (current.current.key !== key || current.current.contexto !== contexto) { current.current.ativa = false; current.current = { key, contexto, ativa: false }; }
  const generation = current.current;
  const saved = useRef<IntencaoPersistida<T> | null>(null), disk = useRef<string | null>(null);
  const flight = useRef(false), blocked = useRef("");
  const recoveryRef = useRef<ReturnType<typeof normalizarRecuperacaoMulta> | undefined>(undefined);
  const cb = useRef(onSuccess); cb.current = onSuccess;
  const [ready, setReady] = useState<Generation>();
  const [pending, setPending] = useState<IntencaoPersistida<T> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [recovery, setRecovery] = useState<ReturnType<typeof normalizarRecuperacaoMulta>>();
  const atual = () => !!key && generation.ativa && current.current === generation && ready === generation;
  function bloquear(message: string): never { blocked.current = message; setError(message); throw Error(message); }
  function validarPayload(payload: T) {
    const schema = acao === "multa" ? aplicarMultaSchema : acao === "receber" ? receberMultaSchema : renovarMultaSchema;
    if (!schema.safeParse(payload).success ||
      (acao === "multa" ? payload.idcontrato !== contratoId : payload.contratoId !== contratoId || payload.parcelaId !== parcelaId)) {
      throw Error("Intenção de multa não corresponde à ação, contrato ou parcela desta empresa. Preserve a chave.");
    }
  }
  function read(raw: string | null) {
    const value = lerIntencao<T>({ getItem: () => raw }, key);
    if (value) validarPayload(value.payload);
    saved.current = value; disk.current = raw; setPending(value);
    if (value && Object.hasOwn(value, "confirmacao")) {
      try { confirmar(acao, value.confirmacao, value.payload); }
      catch { saved.current = { versao: 1, payload: value.payload }; setPending(saved.current); bloquear("Confirmação local inválida. Confira a intenção original no servidor."); }
    }
    return saved.current;
  }
  function conferirDisk() {
    let raw: string | null;
    try { raw = sessionStorage.getItem(key); }
    catch { bloquear("Não foi possível consultar a intenção preservada. Nenhum novo envio foi autorizado."); }
    if (raw !== disk.current) bloquear("A intenção mudou em outra montagem. Não sobrescreva ou gere outra operação.");
  }
  function persistir(value: IntencaoPersistida<T>) {
    guardarIntencao(sessionStorage, key, value);
    const raw = JSON.stringify(value);
    if (sessionStorage.getItem(key) !== raw) bloquear("A intenção não foi preservada. Confira a mesma chave antes de tentar novamente.");
    saved.current = value; disk.current = raw; setPending(value);
  }
  useEffect(() => {
    generation.ativa = true; saved.current = null; disk.current = null; flight.current = false; blocked.current = "";
    recoveryRef.current = undefined; setReady(generation); setPending(null); setBusy(false); setError(""); setRecovery(undefined);
    if (key) try { read(sessionStorage.getItem(key)); } catch (e) { blocked.current = (e as Error).message; setError(blocked.current); }
    return () => { generation.ativa = false; };
  }, [generation]);
  async function enviar(nova: () => Promise<T>, executar: (payload: T) => Promise<unknown>) {
    if (!atual() || flight.current || blocked.current || recoveryRef.current?.status === "not_executed") return;
    flight.current = true; setBusy(true);
    try {
      if (!saved.current) read(sessionStorage.getItem(key)); else conferirDisk();
      if (saved.current && Object.hasOwn(saved.current, "confirmacao")) return;
      if (!saved.current) {
        const payload = await nova(); if (!atual()) return; validarPayload(payload); conferirDisk();
        // Guardar o candidato antes de tocar na rede; falha de storage não gera UUID substituto.
        saved.current = { versao: 1, payload }; setPending(saved.current);
        try { persistir(saved.current); } catch (e) { bloquear((e as Error).message); }
      }
      const value = saved.current!; conferirDisk();
      const result = await executar(value.payload); if (!atual()) return; conferirDisk();
      const confirmed = { ...value, confirmacao: confirmar(acao, result, value.payload) };
      persistir(confirmed); cb.current(confirmed.confirmacao); toast.success("Operação confirmada e registrada no histórico.");
    } catch (e) {
      if (atual()) toast.error(`${(e as Error).message} ${saved.current ? "Preserve a mesma intenção; erro de transporte não prova não execução." : "Nenhuma operação foi solicitada. Corrija o campo informado."}`);
    } finally { if (atual()) { flight.current = false; setBusy(false); } }
  }
  async function reconciliar() {
    const value = saved.current;
    if (!atual() || !value || !userId || flight.current || Object.hasOwn(value, "confirmacao")) return;
    flight.current = true; setBusy(true);
    try {
      conferirDisk(); const req = request(acao, value.payload);
      const response = await multaManualRpc.reconciliar.mutate(req); if (!atual()) return; conferirDisk();
      const result = normalizarRecuperacaoMulta(response, userId, req);
      if (result.status === "confirmed") {
        const confirmed = { ...value, confirmacao: confirmar(acao, result.result, value.payload) };
        persistir(confirmed); cb.current(confirmed.confirmacao);
      }
      recoveryRef.current = result; setRecovery(result); blocked.current = ""; setError("");
    } catch (e) { if (atual()) toast.error(`${(e as Error).message} Não descarte a intenção sem comprovação do servidor.`); }
    finally { if (atual()) { flight.current = false; setBusy(false); } }
  }
  function concluirOuCorrigir(): T | null {
    const value = saved.current;
    if (!atual() || !value || !userId || flight.current) return null;
    try {
      conferirDisk(); const confirmed = Object.hasOwn(value, "confirmacao");
      if (confirmed) confirmar(acao, value.confirmacao, value.payload);
      else {
        const evidence = recoveryRef.current;
        if (!evidence || evidence.status !== "not_executed") return null;
        // A evidência é novamente vinculada ao UUID e ao corpo completos antes de descartá-los.
        normalizarRecuperacaoMulta(evidence, userId, request(acao, value.payload));
        if (canonicalIntent(evidence.payload) !== canonicalIntent(request(acao, value.payload).payload)) return null;
      }
      sessionStorage.removeItem(key); if (sessionStorage.getItem(key) !== null) bloquear("Não foi possível encerrar a intenção local.");
      saved.current = null; disk.current = null; blocked.current = ""; recoveryRef.current = undefined;
      setPending(null); setError(""); setRecovery(undefined); return confirmed ? null : value.payload;
    } catch (e) { if (atual()) { blocked.current = (e as Error).message; setError(blocked.current); } return null; }
  }
  return { key, generation, atual, pronta: atual(), pendente: atual() ? pending : null, busy: atual() && busy,
    erro: atual() ? error : "", recovery: atual() ? recovery : undefined, enviar, reconciliar, concluirOuCorrigir };
}
