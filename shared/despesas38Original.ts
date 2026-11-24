/** NEW implementation. Not the missing historical shared/despesas38.ts.
 * Attribution: source-inputs/despesas38Intent.ts lines 8, 16-18, 80-83;
 * source-inputs/cases.mjs lines 51-75, 255-271.
 * This recognizes an opaque retained original, NOT a valid Request38/W20.
 */
export type Json38 = null | boolean | number | string | readonly Json38[] | { readonly [key: string]: Json38 };
export type OpaqueRequest38 = Readonly<{ despesaId: number; acao: string; expectedRevision: string; [key: string]: Json38 }>;
export type KnownOriginal38 = Readonly<{
  version: 38;
  userId: number;
  idempotencyKey: string;
  request: OpaqueRequest38;
}>;
export type KnownOriginalRef38 = Readonly<{ original: KnownOriginal38; raw: string; sourceKey: string }>;
export class Blocked38 extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'Blocked38'; }
}
export function owner38(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 2147483647)
    throw new Blocked38('INVALID_OWNER_OR_ID', 'Owner/ID fora do subconjunto conservador int32 positivo');
}
export function immutable38<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) immutable38(child);
    Object.freeze(value);
  }
  return value;
}
function assertJson38(value: unknown): asserts value is Json38 {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value) && (Number.isInteger(value) ? Number.isSafeInteger(value) : true)) return;
  if (Array.isArray(value)) { for (const item of value) assertJson38(item); return; }
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype')
        throw new Blocked38('UNSUPPORTED_JSON_KEY', 'Chave JSON conservadoramente recusada');
      assertJson38(item);
    }
    return;
  }
  throw new Blocked38('UNSUPPORTED_JSON', 'JSON opaco não representável com segurança');
}
export function originalPrefix38(owner: number): string {
  owner38(owner); return `cobrapro:despesas:0038:v38:user:${owner}:ui:`;
}
export function inventoryPrefix38(owner: number): string {
  owner38(owner); return `cobrapro:despesas38:successor-postreset-v1:user:${owner}:uuid:`;
}
export function journalKey38(original: KnownOriginal38): string {
  return `${inventoryPrefix38(original.userId)}${original.idempotencyKey}:original`;
}
export function isOwnedKey38(key: string, owner: number): boolean {
  return key.startsWith(originalPrefix38(owner)) || key.startsWith(inventoryPrefix38(owner));
}
/** No normalization, no missing fields filled, no request-key allowlist invented.
 * Successful recognition is sufficient only to retain/select exact local bytes.
 * Canonical JSON here means original-store serialization, NOT PostgreSQL jsonb/hash.
 */
export function recognizeOriginal38(raw: string, sourceKey: string, expectedOwner: number): KnownOriginalRef38 {
  owner38(expectedOwner);
  if (!isOwnedKey38(sourceKey, expectedOwner)) throw new Blocked38('OWNER_KEY_MISMATCH', 'Namespace de outro owner recusado');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Blocked38('CORRUPT_JSON', 'Original JSON corrompido; não remover'); }
  assertJson38(value);
  if (value === null || Array.isArray(value) || typeof value !== 'object') throw new Blocked38('INVALID_ORIGINAL', 'Original deve ser objeto');
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 4 || !['version', 'userId', 'idempotencyKey', 'request'].every(k => keys.includes(k)))
    throw new Blocked38('INVALID_OUTER_FIELDS', 'Envelope local original strict de quatro campos');
  if (record.version !== 38 || record.userId !== expectedOwner) throw new Blocked38('OWNER_OR_VERSION_MISMATCH', 'Owner/version original divergem');
  if (typeof record.idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(record.idempotencyKey))
    throw new Blocked38('UNSUPPORTED_UUID', 'UUID canônica lowercase exigida para retenção; não normalizar');
  if (record.request === null || Array.isArray(record.request) || typeof record.request !== 'object') throw new Blocked38('INVALID_REQUEST_SHAPE', 'Request original opaco deve ser objeto');
  const request = record.request as Record<string, unknown>;
  owner38(request.despesaId);
  if (!['retificar', 'cancelar', 'arquivar', 'desarquivar'].includes(String(request.acao)) || typeof request.acao !== 'string')
    throw new Blocked38('UNKNOWN_ACTION', 'Ação não demonstrada pelos casos originais');
  if (typeof request.expectedRevision !== 'string' || !/^(0|[1-9][0-9]*)$/.test(request.expectedRevision) || BigInt(request.expectedRevision) >= 9223372036854775807n)
    throw new Blocked38('INVALID_REVISION', 'Revisão não canônica ou sem espaço para incremento');
  if (JSON.stringify(value) !== raw) throw new Blocked38('NON_EXACT_LOCAL_SERIALIZATION', 'Preservar bytes originais; nenhuma recanonicalização automática');
  if (sourceKey.startsWith(originalPrefix38(expectedOwner))) {
    const tail = sourceKey.slice(originalPrefix38(expectedOwner).length);
    const match = /^([a-zA-Z0-9_-]{1,80}):despesa:([1-9][0-9]*)(:original-journal:r2a)?$/.exec(tail);
    if (!match || match[2] !== String(request.despesaId)) throw new Blocked38('TARGET_KEY_MISMATCH', 'Despesa/UI divergem do namespace original');
  } else if (sourceKey !== journalKey38(record as unknown as KnownOriginal38)) {
    throw new Blocked38('UUID_KEY_MISMATCH', 'UUID diverge do journal sucessor');
  }
  return immutable38({ original: value as unknown as KnownOriginal38, raw, sourceKey });
}
