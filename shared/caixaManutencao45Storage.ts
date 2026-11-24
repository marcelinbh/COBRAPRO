import { z } from "zod";
import { intencaoCaixa45, storageKeyCaixa45, recoveryCaixa45, conferirRecoveryCaixa45, type IntencaoCaixa45 } from "./caixaManutencao45";
export type StorageCaixa45 = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export type ProvaTerminalCaixa45 = z.infer<typeof recoveryCaixa45>;
const terminal45 = z.object({ versao: z.literal(2), empresaId: z.number().int().positive(), intencao: intencaoCaixa45, prova: recoveryCaixa45 }).strict();
const serializar = (intent: IntencaoCaixa45) => JSON.stringify(intencaoCaixa45.parse(intent));
const key45 = (uid: number, intent: IntencaoCaixa45) => `${storageKeyCaixa45(uid)}:${intent.idempotencyKey}`;
function removerSeIgual(storage: StorageCaixa45, key: string, expected: string): void {
  if (storage.getItem(key) !== expected) throw new Error("CAS45 divergiu; preserve o journal.");
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error("Limpeza45 não confirmada; preserve o journal.");
}
/** Mesmo Web Lock para persistir, concluir e recolher prova terminal, nunca durante rede. */
export async function comLockJournalCaixa45<T>(locks: Pick<LockManager, "request"> | undefined, userId: number, fn: () => T | Promise<T>): Promise<T> {
  if (!locks) throw new Error("Web Locks indisponível; nada enviar nem descartar.");
  return locks.request(`${storageKeyCaixa45(userId)}:journal-lock`, { mode: "exclusive" }, fn);
}
/** Um registro por UUID. Terminal validado é coletado; erro/corrupção nunca é ausência. */
export function pendenteCaixa45(storage: StorageCaixa45, userId: number): IntencaoCaixa45 | null {
  const prefix = `${storageKeyCaixa45(userId)}:`;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k?.startsWith(prefix)) keys.push(k); }
  keys.sort();
  let pending: IntencaoCaixa45 | null = null;
  for (const k of keys) {
    const raw = storage.getItem(k);
    if (raw === null) continue;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "versao" in parsed) {
      const t = terminal45.parse(parsed);
      if (t.empresaId !== userId || k !== key45(userId, t.intencao)) throw new Error("Terminal45 de outra empresa/UUID.");
      conferirRecoveryCaixa45(t.prova, userId, t.intencao);
      // Prova persistida antes do remove: reload pode retomar limpeza após falha.
      removerSeIgual(storage, k, raw); continue;
    }
    const intent = intencaoCaixa45.parse(parsed);
    if (k !== key45(userId, intent) || raw !== serializar(intent)) throw new Error("Journal45 corrompido; preserve os registros.");
    pending ??= intent;
  }
  return pending;
}
export function persistirCaixa45(storage: StorageCaixa45, userId: number, value: IntencaoCaixa45): void {
  const intent = intencaoCaixa45.parse(value), k = key45(userId, intent), payload = serializar(intent);
  const old = storage.getItem(k);
  if (old !== null && old !== payload) throw new Error("UUID45 local já vinculado a outra intenção/prova.");
  storage.setItem(k, payload);
  if (storage.getItem(k) !== payload) throw new Error("Persistência45 não confirmada; nada enviar.");
}
/** Não aceitar só sucesso HTTP: exige prova SQL do mesmo tenant, UUID e payload. */
export function concluirCaixa45(storage: StorageCaixa45, userId: number, value: IntencaoCaixa45, evidence: unknown): void {
  const intent = intencaoCaixa45.parse(value), k = key45(userId, intent);
  const prova = conferirRecoveryCaixa45(evidence, userId, intent);
  const old = storage.getItem(k);
  if (old === null) return; // Outra aba já concluiu: não recriar nem apagar outra chave.
  if (old !== serializar(intent)) {
    const t = terminal45.parse(JSON.parse(old));
    if (t.empresaId !== userId || serializar(t.intencao) !== serializar(intent)) throw new Error("CAS45 divergiu; preserve o journal.");
    conferirRecoveryCaixa45(t.prova, userId, intent);
    if (JSON.stringify(t.prova) !== JSON.stringify(prova)) throw new Error("Provas45 terminais divergentes.");
    removerSeIgual(storage, k, old); return;
  }
  const terminal = JSON.stringify({ versao: 2, empresaId: userId, intencao: intent, prova });
  if (storage.getItem(k) !== old) throw new Error("CAS45 divergiu; preserve o journal.");
  storage.setItem(k, terminal);
  removerSeIgual(storage, k, terminal);
}
