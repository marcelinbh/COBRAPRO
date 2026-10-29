import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../drizzle/0017_integridade_webhook_kiwify.sql", import.meta.url), "utf8");

describe("migration 0017 — integridade do webhook Kiwify", () => {
  it("recusa dados legados inválidos antes de criar unicidade por pedido", () => {
    expect(migration).toContain("kiwify_webhooks");
    expect(migration).toContain("order_id IS NULL");
    expect(migration).toContain("HAVING COUNT(*) > 1");
    expect(migration).toContain("RAISE EXCEPTION");
  });

  it("cria uma chave única de order_id sem suprimir índice homônimo inseguro", () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS kiwify_webhooks_order_id_uk/i);
    expect(migration).toMatch(/AND NOT i\.indisunique/i);
  });
});
