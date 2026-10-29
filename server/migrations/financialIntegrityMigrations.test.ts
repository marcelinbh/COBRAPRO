import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const lerMigration = (nome: string) => readFileSync(resolve(process.cwd(), `drizzle/${nome}`), "utf8");
const parcelas = lerMigration("0013_integridade_parcelas.sql");
const assinaturas = lerMigration("0014_integridade_assinaturas_financeiras.sql");
const recebimento = lerMigration("0015_rpc_recebimento_parcela.sql");
const preflight = readFileSync(resolve(process.cwd(), "reports/preflight-rpcs-financeiras.sql"), "utf8");

describe("migrations financeiras — garantias de integridade", () => {
  it("não aceita parcelas sem chave de negócio nem índice parcial", () => {
    expect(parcelas).toContain("user_id IS NULL OR contrato_id IS NULL OR numero_parcela IS NULL");
    expect(parcelas).toContain("ALTER COLUMN user_id SET NOT NULL");
    expect(parcelas).toContain("ALTER COLUMN contrato_id SET NOT NULL");
    expect(parcelas).toContain("ALTER COLUMN numero_parcela SET NOT NULL");
    expect(parcelas).toContain("i.indpred IS NULL");
    expect(parcelas).not.toContain("WHERE user_id IS NOT NULL");
  });

  it("exige tenant, cliente e Caixa compatíveis nos pagamentos recorrentes", () => {
    expect(assinaturas).toContain("pagamentos_assinatura_assinatura_tenant_cliente_fk");
    expect(assinaturas).toContain("FOREIGN KEY (user_id, assinatura_id, cliente_id)");
    expect(assinaturas).toContain("pagamentos_assinatura_conta_caixa_tenant_fk");
    expect(assinaturas).toContain("FOREIGN KEY (user_id, conta_caixa_id)");
    expect(assinaturas).toContain("transacoes_caixa_pagamento_assinatura_tenant_fk");
    expect(assinaturas).toContain("REFERENCES public.pagamentos_assinatura (user_id, id)");
    expect(assinaturas).toContain("pagamentos_assinatura_user_assinatura_mes_uk");
  });

  it("calcula a segunda baixa parcial pelo saldo líquido, sem reaplicar encargos", () => {
    expect(recebimento).toContain("Parcela parcial possui saldo residual inválido");
    expect(recebimento).toContain("v_valor_total := v_valor_total_devido;");
    const blocoParcial = recebimento.slice(
      recebimento.indexOf("IF v_parcela.status = 'parcial' THEN"),
      recebimento.indexOf("ELSE", recebimento.indexOf("IF v_parcela.status = 'parcial' THEN")),
    );
    expect(blocoParcial).not.toContain("v_valor_total_devido + v_juros");
    expect(recebimento).toContain("Parcela possui vencimento inválido");
  });

  it("protege a baixa e o lançamento de Caixa com referências compostas por tenant", () => {
    expect(recebimento).toContain("JOIN public.clientes cl ON cl.id = p.cliente_id AND cl.user_id = p_user_id");
    expect(recebimento).toContain("AND p.cliente_id = c.cliente_id");
    expect(recebimento).toContain("transacoes_caixa_operacao_financeira_tenant_fk");
    expect(recebimento).toContain("FOREIGN KEY (user_id, operacao_financeira_id)");
    expect(recebimento).toContain("REFERENCES public.operacoes_financeiras (user_id, id)");
    expect(recebimento).toContain("transacoes_caixa_conta_tenant_fk");
    expect(recebimento).toContain("REFERENCES public.contas_caixa (user_id, id)");
  });

  it("permite retomar a migration sem recriar constraints já instaladas", () => {
    expect(recebimento).toContain("IF NOT EXISTS (\n    SELECT 1 FROM pg_constraint");
    expect(recebimento).toContain("transacoes_caixa_operacao_financeira_tenant_check");
    expect(recebimento).not.toContain("ADD CONSTRAINT transacoes_caixa_operacao_financeira_tenant_fk\n  FOREIGN KEY");
  });

  it("mantém o preflight capaz de detectar vínculos cruzados e estados residuais inválidos", () => {
    expect(preflight).toContain("transacao_user_id");
    expect(preflight).toContain("saldo_residual IS NULL OR saldo_residual <= 0");
    expect(preflight).toContain("operacao_financeira_id");
    expect(preflight).toContain("pagamento_user_id");
    expect(preflight).toContain("conta_user_id");
  });
});
