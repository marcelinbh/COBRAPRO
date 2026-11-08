import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClientAsync } from "../db";
import { validarFotoBlacklist, MAX_BLACKLIST_FOTO_BYTES } from "../uploadSecurity";

export const BLACKLIST_PRIVATE_BUCKET = "cobrapro-blacklist-private";
export const BLACKLIST_MAX_BASE64 = Math.ceil(MAX_BLACKLIST_FOTO_BYTES / 3) * 4;
const MIMES = ["image/jpeg", "image/png", "image/webp"];
const PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([1-9]\d*)\/([1-9]\d*)\.(jpg|png|webp)$/;
type Scope = { userId: number; blacklistId: number };
export type PrivatePhoto = { key: string; reference: string; buffer: Buffer; contentType: string };

function unavailable(message = "Armazenamento privado indisponível. Contate o responsável pela configuração."): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}

export function blacklistPhotoUrl(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) unavailable("Referência de foto inválida.");
  return `/api/blacklist/photos/${id}`;
}

export function privateBlacklistKey(reference: unknown, scope: Scope): string {
  if (typeof reference !== "string" || reference.length > 500) unavailable("Foto legada exige migração privada aprovada.");
  const prefix = `storage://${BLACKLIST_PRIVATE_BUCKET}/`;
  const key = reference.startsWith(prefix) ? reference.slice(prefix.length) : reference;
  const match = PATH.exec(key);
  if (!match || !Number.isSafeInteger(scope.userId) || !Number.isSafeInteger(scope.blacklistId)
    || Number(match[2]) !== scope.userId || Number(match[3]) !== scope.blacklistId) {
    unavailable("Foto legada ou vínculo inválido: migração privada aprovada necessária.");
  }
  return key;
}

/** Ambas as colunas precisam ser privadas e apontar ao MESMO objeto do autor/pai.
 * Não resolver URL externa, logo público, data:, traversal ou chave de outro tenant.
 */
export function validatedBlacklistPhotoKey(photo: { file_key: unknown; url: unknown }, scope: Scope): string {
  const key = privateBlacklistKey(photo.file_key, scope);
  if (privateBlacklistKey(photo.url, scope) !== key) unavailable("Vínculo da foto inválido.");
  return key;
}

async function client(): Promise<SupabaseClient> {
  const sb = await getSupabaseClientAsync();
  if (!sb) unavailable();
  return sb;
}

function notFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: unknown; statusCode?: unknown; message?: unknown };
  // Storage v1 pode retornar status 400 com mensagem exata; não tratar 403,
  // timeout, rede ou qualquer texto contendo "not found" como permissão de criar.
  return Number(e.statusCode ?? e.status) === 404
    || (Number(e.statusCode ?? e.status) === 400 && e.message === "Bucket not found");
}

export async function requirePrivateBlacklistBucket(sb: SupabaseClient): Promise<void> {
  let result = await sb.storage.getBucket(BLACKLIST_PRIVATE_BUCKET);
  if (result.error) {
    if (!notFound(result.error)) unavailable();
    const created = await sb.storage.createBucket(BLACKLIST_PRIVATE_BUCKET, {
      public: false, fileSizeLimit: MAX_BLACKLIST_FOTO_BYTES, allowedMimeTypes: MIMES,
    });
    // Inclusive corrida com outro criador: reler metadata, não confiar mensagem.
    result = await sb.storage.getBucket(BLACKLIST_PRIVATE_BUCKET);
    if (created.error && result.error) unavailable();
  }
  if (result.error || !result.data || result.data.id !== BLACKLIST_PRIVATE_BUCKET || result.data.public !== false) {
    // NUNCA converter bucket público silenciosamente, vazio ou não.
    unavailable("Bucket da Blacklist não está comprovadamente privado. Correção manual aprovada necessária.");
  }
}

export async function uploadPrivateBlacklistPhoto(scope: Scope, base64: string, mime: string): Promise<{ key: string; reference: string }> {
  let validated;
  try {
    const dataPrefix = `data:${mime};base64,`;
    const raw = base64.startsWith(dataPrefix) ? base64.slice(dataPrefix.length) : base64;
    validated = validarFotoBlacklist(raw, mime);
    if (validated.buffer.toString("base64") !== raw) throw new Error("Base64 não canônico");
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Foto inválida: use JPEG, PNG ou WEBP de até 2 MB, com conteúdo correspondente." });
  }
  const key = `${randomUUID()}/${scope.userId}/${scope.blacklistId}.${validated.extensao}`;
  privateBlacklistKey(key, scope);
  const sb = await client();
  await requirePrivateBlacklistBucket(sb);
  try {
    const { error } = await sb.storage.from(BLACKLIST_PRIVATE_BUCKET).upload(key, validated.buffer, {
      contentType: validated.contentType, upsert: false, cacheControl: "0",
    });
    if (error) throw new Error("Upload privado não confirmado");
  } catch {
    // Nenhum DB foi inserido. Timeout pode ter gravado objeto: compensar UUID
    // próprio, sem remover objeto de terceiro nem fazer upsert do upload.
    try {
      const removed = await sb.storage.from(BLACKLIST_PRIVATE_BUCKET).remove([key]);
      if (removed.error) throw new Error("Compensação falhou");
    } catch {
      console.error("[Blacklist] upload storage não confirmado; reconciliar UUID", { key });
      unavailable("Upload não confirmado; limpeza privada exige intervenção do responsável.");
    }
    unavailable("Não foi possível armazenar a foto; upload revertido.");
  }
  return { key, reference: `storage://${BLACKLIST_PRIVATE_BUCKET}/${key}` };
}

export async function downloadPrivateBlacklistPhoto(key: string, scope: Scope): Promise<PrivatePhoto> {
  key = privateBlacklistKey(key, scope);
  const sb = await client();
  await requirePrivateBlacklistBucket(sb);
  const { data, error } = await sb.storage.from(BLACKLIST_PRIVATE_BUCKET).download(key);
  if (error || !data) unavailable("Foto indisponível no armazenamento privado.");
  if (data.size > MAX_BLACKLIST_FOTO_BYTES || data.size === 0 || !MIMES.includes(data.type)) unavailable("Conteúdo da foto não é seguro.");
  const buffer = Buffer.from(await data.arrayBuffer());
  try {
    const validated = validarFotoBlacklist(buffer.toString("base64"), data.type);
    const extension = key.split(".").pop();
    if (extension !== validated.extensao) unavailable("Conteúdo da foto não corresponde à referência.");
    return { key, reference: `storage://${BLACKLIST_PRIVATE_BUCKET}/${key}`, buffer: validated.buffer, contentType: validated.contentType };
  } catch {
    unavailable("Conteúdo da foto não é seguro.");
  }
}

export async function removePrivateBlacklistPhoto(key: string, scope: Scope): Promise<void> {
  key = privateBlacklistKey(key, scope);
  const sb = await client();
  await requirePrivateBlacklistBucket(sb);
  const { error } = await sb.storage.from(BLACKLIST_PRIVATE_BUCKET).remove([key]);
  if (error) unavailable("Não foi possível remover a foto privada; dados do registro preservados.");
}

/** Backup validado em memória, sem arquivo PII/URL pública. Primeiro storage,
 * depois DB; se storage ou DB falhar, restaurar bytes antes de retornar falha.
 * commit deve distinguir zero-row/commit confirmado de resposta ambígua e
 * confirmar existência no banco quando erro de transporte ocorre.
 */
export async function removePrivatePhotoReversibly(
  key: string, scope: Scope,
  commit: () => Promise<void>,
): Promise<void> {
  const backup = await downloadPrivateBlacklistPhoto(key, scope);
  try {
    await removePrivateBlacklistPhoto(key, scope);
    await commit();
  } catch (error) {
    const sb = await client();
    await requirePrivateBlacklistBucket(sb);
    const restored = await sb.storage.from(BLACKLIST_PRIVATE_BUCKET).upload(key, backup.buffer, {
      contentType: backup.contentType, upsert: true, cacheControl: "0",
    });
    if (restored.error) {
      // Serviço distribuído não oferece transação entre DB e Storage. Falha
      // dupla exige reconciliação operacional; não fingir sucesso nem apagar DB.
      console.error("[Blacklist] compensação storage falhou; reconciliação necessária", { key });
      unavailable("Exclusão não concluída: recuperação da foto exige intervenção do responsável.");
    }
    throw error;
  }
}
