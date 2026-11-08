import type { Express } from "express";
import { TRPCError } from "@trpc/server";
import { sdk } from "./_core/sdk";
import { getSupabaseClientAsync } from "./db";
import { requireBlacklistEnabled, requireBlacklistEntitlement } from "./services/blacklistEntitlement";
import { downloadPrivateBlacklistPhoto, validatedBlacklistPhotoKey } from "./services/blacklistPrivateStorage";

/** Pai registra antes do fallback SPA; nunca redirect/signedURL/publicURL.
 * Leitura compartilhada só nesta blacklist: não estende acesso a outros tenants.
 */
export function registerBlackListPhotoRoutes(app: Express): void {
  app.get("/api/blacklist/photos/:id", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    try {
      requireBlacklistEnabled();
      let user;
      try { user = await sdk.authenticateRequest(req); } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão inválida. Entre na sua conta." });
      }
      await requireBlacklistEntitlement(user);
      if (!/^[1-9]\d{0,9}$/.test(req.params.id)) throw new TRPCError({ code: "BAD_REQUEST", message: "Foto inválida." });
      const id = Number(req.params.id);
      if (id > 2147483647) throw new TRPCError({ code: "BAD_REQUEST", message: "Foto inválida." });
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Banco indisponível." });
      const { data: photo, error } = await sb.from("blacklist_fotos")
        .select("id, blacklist_id, file_key, url").eq("id", id).limit(1).maybeSingle();
      if (error || !photo || photo.id !== id) throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada." });
      const { data: parent, error: parentError } = await sb.from("blacklist")
        .select("id, cadastrado_por_user_id, status").eq("id", photo.blacklist_id).limit(1).maybeSingle();
      if (parentError || !parent || parent.id !== photo.blacklist_id
        || (parent.cadastrado_por_user_id !== user.id && !["ativo", "em_negociacao"].includes(parent.status))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada." });
      }
      const scope = { userId: parent.cadastrado_por_user_id, blacklistId: parent.id };
      const key = validatedBlacklistPhotoKey(photo, scope);
      const safe = await downloadPrivateBlacklistPhoto(key, scope);
      // Revalidar concessão depois do IO de storage: revogação não depende owner.
      await requireBlacklistEntitlement(user);
      res.setHeader("Content-Type", safe.contentType);
      res.setHeader("Content-Disposition", 'inline; filename="blacklist-photo"');
      res.status(200).send(safe.buffer);
    } catch (error) {
      const codes: Record<string, number> = { UNAUTHORIZED: 401, FORBIDDEN: 403, BAD_REQUEST: 400, NOT_FOUND: 404, PRECONDITION_FAILED: 412 };
      const known = error instanceof TRPCError;
      res.status(known ? codes[error.code] ?? 500 : 503).json({ error: known ? error.message : "Foto indisponível. Tente novamente mais tarde." });
    }
  });
}
