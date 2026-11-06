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
    expect(migration).toContain("i.indisunique AND i.indisvalid AND i.indisready");
    expect(migration).toContain("i.indrelid = 'public.kiwify_webhooks'::regclass");
    expect(migration).toContain("i.indnkeyatts = 1 AND i.indnatts = 1");
    expect(migration).toContain("i.indexprs IS NULL AND i.indpred IS NULL");
    expect(migration).toContain("attname = 'order_id'");
    expect(migration).toContain("LEFT JOIN pg_index");
    expect(migration).toContain("AND NOT COALESCE");
  });

  it("bloqueia novos pedidos NULL ou vazios depois do preflight", () => {
    expect(migration).toContain("ALTER COLUMN order_id SET NOT NULL");
    expect(migration).toContain("CHECK (btrim(order_id) <> '')");
  });
});
