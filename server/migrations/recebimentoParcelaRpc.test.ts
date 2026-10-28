import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/0015_rpc_recebimento_parcela.sql"),
  "utf8",
);

describe("migration 0015 — recebimento de parcela atômico", () => {
  it("protege a função com tenant, idempotência e transação de Caixa vinculada", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = public, pg_temp");
    expect(migration).toContain("WHERE id = p_conta_caixa_id AND user_id = p_user_id");
    expect(migration).toContain("WHERE p.id = p_parcela_id AND p.user_id = p_user_id");
    expect(migration).toContain("ON CONFLICT (user_id, chave_idempotencia) DO NOTHING");
    expect(migration).toContain("operacoes_financeiras_user_chave_uk");
    expect(migration).toContain("FOR UPDATE OF p, c");
    expect(migration).toContain("operacao_financeira_id");
    expect(migration).toContain("transacoes_caixa_operacao_financeira_uk");
    expect(migration).toContain("tabela física public.% ausente");
    expect(migration).toContain("FOR requisito IN");
    expect(migration).toContain("FK de transacoes_caixa para operacoes_financeiras inválida");
  });

  it("preserva data civil de Brasília e bloqueia reencargos em parcela parcial", () => {
    expect(migration).toContain("p_data_pagamento DATE,");
    expect(migration).toContain("p_data_pagamento - v_parcela.data_vencimento");
    expect(migration).toContain("Uma parcela parcial preserva os encargos já apurados");
    expect(migration).toContain("v_parcela.status = 'parcial'");
    expect(migration).toContain("O desconto não pode superar o valor devido");
    expect(migration).toContain("Valores monetários devem ter no máximo duas casas decimais");
    expect(migration).toContain("v_valor_pago_normalizado = v_valor_total");
  });

  it("restringe execução da RPC ao service_role", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.rpc_registrar_pagamento_parcela");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_registrar_pagamento_parcela");
    expect(migration).toContain("TO service_role");
  });

  it("não aceita chave gerada automaticamente e deixa trilha suficiente para auditoria", () => {
    expect(migration).toContain("p_chave_idempotencia UUID\n");
    expect(migration).not.toContain("p_chave_idempotencia UUID DEFAULT");
    expect(migration).toContain("'hashRequisicao', v_hash");
    expect(migration).toContain("'valorTotalDevido', v_valor_total_devido");
    expect(migration).toContain("'diasAtraso', v_dias_atraso");
  });
});
