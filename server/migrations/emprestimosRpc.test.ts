import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const sql = readFileSync(new URL("../../drizzle/0021_rpc_emprestimos_prospectivos.sql", import.meta.url), "utf8");

describe("0021 — criação nova prospectiva sem liberação do legado", () => {
  it("tem uma única RPC de criação e provenance dedicada com constraints integrais", () => {
    expect(sql.match(/CREATE FUNCTION/g)).toHaveLength(1);
    expect(sql).toContain("CREATE TABLE public.emprestimos_rpc_operacoes");
    expect(sql).toContain("CREATE TABLE public.emprestimos_rpc_origens");
    expect(sql).toContain("UNIQUE (user_id, chave_idempotencia)");
    expect(sql).toContain("FOREIGN KEY (user_id, operacao_id)");
    expect(sql).toContain("contrato_id INTEGER PRIMARY KEY");
    expect(sql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX[^;]*WHERE/is);
    expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM)\s+public\.(contratos|parcelas|transacoes_caixa|contas_caixa|clientes)/i);
    expect(sql).not.toMatch(/ALTER TABLE public\.(contratos|parcelas|transacoes_caixa|operacoes_financeiras)/i);
  });
  it("reserva, calcula, registra trilha e resultado dentro da função", () => {
    expect(sql.trim()).toMatch(/^--[\s\S]*BEGIN;[\s\S]*COMMIT;$/);
    expect(sql).toContain("p_chave_idempotencia UUID,");
    expect(sql).not.toContain("p_chave_idempotencia UUID DEFAULT");
    expect(sql).toContain("extensions.digest(v_payload::text, 'sha256')");
    expect(sql).toContain("ON CONFLICT (user_id, chave_idempotencia) DO NOTHING");
    expect(sql).toContain("FOR UPDATE;");
    expect(sql).toContain("IF v_op.hash_payload <> v_hash THEN");
    expect(sql).toContain("RETURN v_op.resultado || jsonb_build_object('repetida', true)");
    expect(sql).toContain("INSERT INTO public.contrato_historico");
    expect(sql).toContain("auditoria = jsonb_build_object");
    expect(sql).not.toMatch(/EXCEPTION\s+WHEN/i);
  });
  it("recalcula soma e juros, não aceita valorParcela/total fornecido", () => {
    expect(sql).toContain("round(p_valor_principal * p_taxa_juros / 100 * p_numero_parcelas, 2)");
    expect(sql).toContain("v_total - v_referencia * (p_numero_parcelas - 1)");
    expect(sql).toContain("v_juros - v_juros_ref * (p_numero_parcelas - 1)");
    expect(sql).toContain("v_soma <> v_total OR v_soma_juros <> v_juros");
    expect(sql).not.toContain("p_valor_parcela");expect(sql).not.toContain("p_total_contrato");
    expect(sql).toContain("NUMERIC(12,2) do histórico");
  });
  it("valida owners sem esconder lançamentos de outra empresa ou nulos", () => {
    expect(sql).toContain("t.conta_caixa_id = p_conta_caixa_id AND t.user_id IS DISTINCT FROM p_user_id");
    expect(sql).toContain("v_cliente.user_id IS DISTINCT FROM p_user_id");
    expect(sql).toContain("v_conta.ativo IS DISTINCT FROM true");
    expect(sql).toContain("WHERE k.user_id = p_user_id ORDER BY k.id FOR UPDATE");
    expect(sql).toContain("v_koletor_count > 1");
    expect(sql).not.toContain("operacao_financeira_id");
  });
  it("service_role, search_path seguro e DATE nativas", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = pg_catalog, pg_temp");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.rpc_criar_emprestimo");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("TO service_role;");
    expect(sql).toContain("p_data_inicio DATE,");expect(sql).toContain("p_vencimentos DATE[]");
    expect(sql).toContain("AT TIME ZONE 'America/Sao_Paulo'");
    expect(sql).not.toContain("::public.status_contrato");
    expect(sql).toContain("p_user_id::text, v_contrato");
  });
});
