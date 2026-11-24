import { validarFenceCheque40, cheque40IntentSchema, type Cheque40Intent, type Cheque40Request } from "../../../shared/cheques40";
export interface Cheque40Storage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const key = (owner: number) => {
  if (!Number.isInteger(owner) || owner <= 0) throw new Error("Entre novamente antes de operar cheques.");
  return `cobrapro.cheques40.intent.v1.${owner}`;
};
export function lerIntencaoCheque40(storage: Cheque40Storage, owner: number): Cheque40Intent | null {
  const raw = storage.getItem(key(owner));
  if (raw === null) return null;
  const parsed = cheque40IntentSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("Intenção de cheque local ilegível. Preserve-a para conferência; nenhuma nova gravação foi enviada.");
  return parsed.data;
}
export function reservarIntencaoCheque40(storage: Cheque40Storage, owner: number, request: Cheque40Request, uuid: () => string): Cheque40Intent {
  const pending = lerIntencaoCheque40(storage, owner);
  if (pending) throw new Error("Existe uma intenção pendente. Use Recuperar mesma intenção; não envie outra operação.");
  const intent = cheque40IntentSchema.parse({ idempotencyKey: uuid(), request });
  storage.setItem(key(owner), JSON.stringify(intent));
  // Falha de persistência/readback impede a chamada de rede.
  const saved = lerIntencaoCheque40(storage, owner);
  if (!saved || JSON.stringify(saved) !== JSON.stringify(intent)) throw new Error("Não foi possível preservar a intenção de cheque.");
  return saved;
}
export function concluirIntencaoCheque40(storage: Cheque40Storage, owner: number, intent: Cheque40Intent): void {
  const pending = lerIntencaoCheque40(storage, owner);
  if (pending && JSON.stringify(pending) === JSON.stringify(intent)) storage.removeItem(key(owner));
}

/** Somente após prova de servidor vinculada; nenhum botão pode simplesmente limpar intenção. */
export function concluirAbandonoCheque40(storage: Cheque40Storage, owner: number, intent: Cheque40Intent, raw: unknown): void {
  validarFenceCheque40(raw, intent);
  concluirIntencaoCheque40(storage, owner, intent);
}
