import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const sql = read("drizzle/0029_reabrir_blacklist_backend_privado.sql");
const executable = sql.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
const router = read("server/routers/blacklist.ts");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

describe("0029 — reabertura mínima para backend privado LIVE, somente LOCAL", () => {
  it("exige declaração EXTERNA do SHA live e usa uma transação com locks antes do grant", () => {
    expect(executable.trim()).toMatch(/^BEGIN;/);
    expect(executable.trim()).toMatch(/COMMIT;$/);
    expect(executable).toContain("current_setting('cobrapro.blacklist_private_backend_live',true)");
    expect(executable).toContain("d458e684d574b56aac3e6c7c73c88b133acaa29d");
    expect(executable).toContain("LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE");
    expect(executable.indexOf("RAISE EXCEPTION '0029 bucket")).toBeLessThan(executable.indexOf("GRANT INSERT"));
  });

  it("concede só DML usado pelo router, inclusive UPDATE do pai pelo guard de fotos", () => {
    expect(executable.match(/\bGRANT\s+[^;]+;/g)).toEqual([
      "GRANT INSERT, UPDATE, DELETE ON TABLE public.blacklist TO service_role;",
      "GRANT INSERT, DELETE ON TABLE public.blacklist_fotos TO service_role;",
      "GRANT EXECUTE ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) TO service_role;",
    ]);
    expect(router).toContain('supabase.rpc("blacklist_delete_empty_owned", { target_id: input.id, owner_id: ctx.user.id })');
    expect(router).toContain('.insert({ blacklist_id: input.blacklistId, url: stored.reference, file_key: stored.key })');
    expect(router).toContain('.from("blacklist_fotos").delete()');
    expect(read("drizzle/0019_base_blacklist_backend_only.sql")).toContain('UPDATE public.blacklist SET "updatedAt" = "updatedAt"');
    expect(executable).not.toMatch(/GRANT[^;]*\b(?:TRUNCATE|REFERENCES|TRIGGER|MAINTAIN|ALL)\b/);
  });

  it("não modifica linhas, grants legados, Storage, RLS, policies, funções nem frontend ACL", () => {
    const commands = executable.replace(/'(?:''|[^'])*'/g, "''");
    expect(commands).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s|DROP\s|CREATE\s|ALTER\s|REVOKE\s)/i);
    expect(executable).not.toMatch(/GRANT[^;]*(?:anon|authenticated|PUBLIC|storage\.|blacklist_access_grants)/);
    expect(executable).toContain("relrowsecurity AND NOT relforcerowsecurity");
    expect(executable).toContain("a.grantee NOT IN(owner_oid,service_oid)");
    expect(executable).toContain("IS DISTINCT FROM true THEN");
    expect(executable).toContain("ARRAY['DELETE','INSERT','SELECT']");
    expect(executable).toContain("MAINTAIN");
  });

  it("valida hashes fixos das funções reais 0019/0023/0027/0028, não só marcador autodeclarado", () => {
    const specs = [
      ["0019_base_blacklist_backend_only.sql", /\$guard\$([\s\S]*?)\$guard\$/],
      ["0023_acesso_blacklist_assinantes.sql", /\$delete\$([\s\S]*?)\$delete\$/],
    ] as const;
    for (const [file, pattern] of specs) {
      expect(sql).toContain(hash(read(`drizzle/${file}`).match(pattern)![1]));
    }
    for (const file of ["0027_kiwify_assinaturas_blacklist.sql", "0028_kiwify_compradores_transacional.sql"]) {
      for (const body of read(`drizzle/${file}`).matchAll(/\w+_body text := \$fn\$([\s\S]*?)\$fn\$;/g)) {
        expect(sql).toContain(hash(body[1]));
      }
    }
    expect(executable).toContain("p.proargtypes=f.args::oidvector");
    expect(executable).toContain("p.prosecdef=f.sec");
    expect(executable).toContain("p.proconfig=ARRAY['search_path=pg_catalog']");
    expect(executable).toContain("NOT has_function_privilege('service_role',fn_oid,'EXECUTE')");
  });

  it("exige private_storage_path da 0030 autorizada e bucket privado", () => {
    expect(sql).toContain("0030 foi autorizada APÓS metadata live");
    expect(executable).toContain("conname <> 'private_storage_path'");
    expect(executable).toContain("conname='private_storage_path'");
    expect(executable).toContain("pg_get_constraintdef(oid)");
    expect(executable).toContain("public=false");
    expect(executable).toContain("file_size_limit=2097152");
    expect(executable).toContain("ARRAY['image/jpeg','image/png','image/webp']");
    expect(executable).toContain("pg_policy WHERE polrelid=to_regclass('storage.objects')");
    expect(read("drizzle/0019_base_blacklist_backend_only.sql")).not.toContain("private_storage_path");
  });

  it("contrato local permanece Kiwify por acesso, sem admin/manual/lifetime; fotos antes da SPA", () => {
    const entitlement = read("server/services/blacklistEntitlement.ts");
    expect(entitlement).toContain("evidence.lifetime !== false");
    expect(entitlement).toContain('evidence.source !== "kiwify:authenticated-webhook+verified-sale"');
    expect(entitlement).not.toMatch(/if\s*\([^)]*role\s*===\s*["']admin/);
    const photos = read("server/blacklistPhotoRoutes.ts");
    expect(photos.match(/await requireBlacklistEntitlement\(user\)/g)).toHaveLength(2);
    expect(photos).not.toMatch(/getPublicUrl|createSignedUrl|\.redirect\(/);
    const index = read("server/_core/index.ts");
    expect(index.indexOf("registerBlackListPhotoRoutes(app)")).toBeLessThan(index.indexOf("await setupVite(app, server)"));
    expect(index.indexOf("registerBlackListPhotoRoutes(app)")).toBeLessThan(index.indexOf("serveStatic(app)"));
  });
});
