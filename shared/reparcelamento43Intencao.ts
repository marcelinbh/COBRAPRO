import {
  reparcelamento43ExecucaoSchema,type Reparcelamento43Execucao,type Reparcelamento43Resultado,
} from './reparcelamento43';
export type Armazenamento43 = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const key = (owner: number) => {
  if (!Number.isInteger(owner) || owner <= 0 || owner > 2147483647) throw new Error('Owner43 inválido');
  return `cobrapro:reparcelamento43:v1:${owner}`;
};
function igual(a: Reparcelamento43Execucao,b: Reparcelamento43Execucao) {
  return JSON.stringify(reparcelamento43ExecucaoSchema.parse(a)) === JSON.stringify(reparcelamento43ExecucaoSchema.parse(b));
}
/** Guardar ANTES da chamada remota; uma intenção pendente por tenant, sem PII. Falha de storage bloqueia envio. */
export function guardarIntencao43(storage: Armazenamento43,owner: number,input: Reparcelamento43Execucao) {
  const k = key(owner), intention = reparcelamento43ExecucaoSchema.parse(input), previous = lerIntencao43(storage,owner);
  if (previous && !igual(previous,intention)) throw new Error('Intenção43 pendente: reconciliar mesma UUID/payload antes de criar outra');
  storage.setItem(k,JSON.stringify({version:1,owner,input:intention}));
  const persisted = lerIntencao43(storage,owner);
  if (!persisted || !igual(persisted,intention)) throw new Error('Persistência43 não confirmada; não enviar');
  return intention;
}
export function lerIntencao43(storage: Armazenamento43,owner: number): Reparcelamento43Execucao|null {
  const raw = storage.getItem(key(owner));
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Intenção43 local corrompida; não apagar automaticamente');
  const r = value as Record<string,unknown>;
  if (Object.keys(r).sort().join(',') !== 'input,owner,version' || r.version !== 1 || r.owner !== owner) throw new Error('Intenção43 local de outro owner/versão');
  return reparcelamento43ExecucaoSchema.parse(r.input);
}
/** Somente após confirmação conferida no wrapper ou fence durável not_executed da MESMA intenção. */
export function concluirIntencao43(storage: Armazenamento43,owner: number,input: Reparcelamento43Execucao,
  recovery: {status:'confirmed';result:Reparcelamento43Resultado}|{status:'not_executed';idempotencyKey:string}) {
  const pending = lerIntencao43(storage,owner);
  if (!pending || !igual(pending,input)) throw new Error('Conclusão43 não corresponde à intenção persistida');
  if (recovery.status === 'confirmed') {
    const r = recovery.result;
    if (r.userId !== owner || r.idempotencyKey !== input.idempotencyKey || r.contratoOrigemId !== input.contratoId ||
      r.estadoHash !== input.estadoHash || r.cotacaoHash !== input.cotacaoHash) throw new Error('Confirmação43 de outra intenção');
  } else if (recovery.idempotencyKey !== input.idempotencyKey) throw new Error('Fence43 de outra UUID');
  storage.removeItem(key(owner));
}
