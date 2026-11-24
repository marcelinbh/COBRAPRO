import { calendario44Schema, validarClosure44, type Calendario44 } from "./manutencaoEmprestimos";
type Storage44 = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** Chamador mantém Web Lock da MESMA chave; nunca chamar por erro/timeout/not_found. */
export function encerrarJournal44(storage: Storage44, key: string, intent: Calendario44, closure: unknown) {
  const terminal = validarClosure44(closure, intent);
  const raw = storage.getItem(key);
  if (raw === null || JSON.stringify(calendario44Schema.parse(JSON.parse(raw))) !== JSON.stringify(intent)) throw Error("Journal44 alterado: preserve a intenção");
  const archiveKey = `${key}:closed:${intent.idempotencyKey}`;
  const archive = JSON.stringify({ intent, closure: terminal });
  const existing = storage.getItem(archiveKey);
  if (existing !== null && existing !== archive) throw Error("Arquivo terminal44 divergente");
  storage.setItem(archiveKey, archive);
  if (storage.getItem(archiveKey) !== archive) throw Error("Prova terminal44 não persistiu");
  // Nunca remover antes de preservar e conferir prova terminal completa. Não é reset local.
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw Error("Journal44 permanece pendente");
  return terminal;
}
