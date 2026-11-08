import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../drizzle/0026_congelar_blacklist_ate_backend_privado.sql", import.meta.url), "utf8");
const executable = sql.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");

describe("0026 — congelamento transitório antes do backend privado", () => {
  it("contém apenas ACL transacional e lock das duas tabelas", () => {
    expect(executable.trim()).toMatch(/^BEGIN;/);
    expect(executable.trim()).toMatch(/COMMIT;$/);
    expect(executable).toContain("LOCK TABLE public.blacklist, public.blacklist_fotos IN ACCESS EXCLUSIVE MODE");
    expect(executable).not.toMatch(/\b(?:DROP|TRUNCATE|INSERT|UPDATE|DELETE)\s+(?:TABLE|INTO|FROM|public\.)/i);
  });
  it("revoga escrita do backend anterior e não libera clientes, fotos ou grants", () => {
    expect(executable).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.blacklist, public.blacklist_fotos FROM service_role");
    expect(executable).toContain("REVOKE ALL ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) FROM service_role");
    expect(executable).not.toMatch(/\bGRANT\b/i);
    expect(executable).not.toMatch(/DISABLE ROW LEVEL SECURITY|CREATE POLICY/i);
  });
});
