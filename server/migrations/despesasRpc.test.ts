import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const sql = readFileSync(resolve(process.cwd(), "drizzle/0020_rpc_despesas_prospectivas.sql"), "utf8");
const fixture = readFileSync(resolve(process.cwd(), "tests/postgres-expenses/fixture.sql"), "utf8");
describe("0020 — trilho prospectivo independente", () => {
  it("não depende das tabelas de operações/recebimentos legados nem altera livro/saldo-base", () => {
    expect(sql).not.toMatch(/(?:UPDATE|DELETE\s+FROM)\s+public\.(?:transacoes_caixa|contas_caixa)/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+public\.(?:parcelas|contratos|contas_pagar|transacoes_caixa)/i);
    expect(sql).not.toContain("operacoes_financeiras");
    expect(sql).not.toContain("cliente_id");
    expect(sql).not.toContain("operacao_financeira_id");
    expect(sql).toContain("v_antes IS DISTINCT FROM v_origem.snapshot");
    expect(sql).toContain("v_antes IS DISTINCT FROM v_pg.despesa_snapshot");
  });
  it("instala tabela aditiva validando campos, CHECK/FK/índices, grants e RLS", () => {
    for (const text of ["pg_get_constraintdef", "pg_get_indexdef", "attnotnull", "attidentity", "attgenerated", "aclexplode", "ENABLE ROW LEVEL SECURITY", "grants residuais", "trigger/policy inesperado", "tabela homônima fora de public"]) expect(sql).toContain(text);
  });
  it("somente wrappers SECURITY DEFINER service_role com search_path seguro e UUID obrigatório", () => {
    expect(sql.match(/SECURITY DEFINER/g)).toHaveLength(4);
    expect(sql.match(/SET search_path = pg_catalog, pg_temp/g)).toHaveLength(4);
    for (const name of ["rpc_criar_despesa_prospectiva", "rpc_pagar_despesa_prospectiva", "rpc_estornar_despesa_prospectiva"]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${name}`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${name}`);
    }
    expect(sql).not.toMatch(/p_chave_idempotencia uuid\s+DEFAULT/i);
    expect(sql).toContain("extensions.digest");
    expect(sql).toContain("RETURN v_op.resultado");
    expect(sql).toContain("Chave reutilizada com payload diferente");
  });
  it("vincula débito original único, valida snapshot e conserva data de pagamento", () => {
    expect(sql).toContain("saida_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT");
    expect(sql).toContain("to_jsonb(v_tx) IS DISTINCT FROM v_pg.saida_snapshot");
    expect(sql).toContain("v_tx.valor<>v_valor");
    expect(sql).toContain("v_tx.conta_caixa_id<>v_conta_id");
    expect(sql).toContain("VALUES(v_conta_id,'entrada','despesa_operacional','Estorno: '||v_d.descricao,v_tx.valor");
    expect(sql).not.toContain("SET data_pagamento=NULL");
    expect(sql).toContain("FOR SHARE");
    expect(sql).toContain("user_id IS DISTINCT FROM p_user_id");
  });
  it("fixture reproduz schema real sem colunas planejadas ou CHECK de categoria inventado", () => {
    expect(fixture).toContain('"valor" numeric(15,2) NOT NULL');
    expect(fixture).toContain('"data_pagamento" date');
    expect(fixture).toContain("'pago'::character varying");
    expect(fixture).toContain("'quinzenal'::character varying");
    expect(fixture).not.toContain("cliente_id");
    expect(fixture).not.toContain("operacao_financeira_id");
    expect(fixture).not.toContain("transacoes_caixa_categoria_check");
  });
});
