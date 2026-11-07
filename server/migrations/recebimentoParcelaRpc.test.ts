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
    expect(migration).toContain("SET search_path = pg_catalog, extensions, public, pg_temp");
    expect(migration).toContain("WHERE id = p_conta_caixa_id AND user_id = p_user_id");
    expect(migration).toContain("WHERE p.id = p_parcela_id AND p.user_id = p_user_id");
    expect(migration).toContain("ON CONFLICT (user_id, chave_idempotencia) DO NOTHING");
    expect(migration).toContain("operacoes_financeiras_user_chave_uk");
    expect(migration).toContain("FOR UPDATE OF p, c");
    expect(migration).toContain("operacao_financeira_id");
    expect(migration).toContain("transacoes_caixa_operacao_financeira_uk");
    expect(migration).toContain("tabela física public.% ausente");
    expect(migration).toContain("FOR requisito IN");
    expect(migration).toContain("FK composta de transacoes_caixa para operacoes_financeiras ausente");
    expect(migration).toContain("FOREIGN KEY (user_id, operacao_financeira_id)");
    expect(migration).toContain("FOREIGN KEY (user_id, conta_caixa_id)");
  });

  it("preserva data civil de Brasília e bloqueia reencargos em parcela parcial", () => {
    expect(migration).toContain("p_data_pagamento DATE,");
    expect(migration).toContain("p_data_pagamento - v_parcela.data_vencimento");
    expect(migration).toContain("Uma parcela parcial preserva os encargos já apurados");
    expect(migration).toContain("v_parcela.status = 'parcial'");
    expect(migration).toContain("Parcela parcial possui saldo residual inválido");
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

  it("normaliza os limites de indkey antes de comparar a unicidade", () => {
    expect(migration).toContain("ARRAY(SELECT unnest(i.indkey::smallint[])) = ARRAY[");
    expect(migration).not.toContain("AND i.indkey::smallint[] = ARRAY[");
  });

  it("atribui ROWTYPE sozinho e lê o status do contrato já travado", () => {
    expect(migration).toContain("SELECT p.* INTO v_parcela");
    expect(migration).not.toContain("INTO v_parcela, v_contrato_status");
    const lock = migration.indexOf("FOR UPDATE OF p, c;");
    const status = migration.indexOf("SELECT c.status::text INTO v_contrato_status");
    expect(status).toBeGreaterThan(lock);
  });

  it("adiciona cliente nullable sem exigir coluna prévia nem sanear histórico", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS cliente_id INTEGER;");
    expect(migration).not.toContain("('transacoes_caixa','cliente_id')");
    expect(migration).not.toMatch(/cliente_id INTEGER NOT NULL/);
    expect(migration).not.toMatch(/SET\s+cliente_id\s*=/i);
    expect(migration).toContain("inferência exige aprovação separada");
    expect(migration).toContain("('contratos','cliente_id')");
  });

  it("aborta por chaves, links, estados e ledger inválidos antes de qualquer DDL", () => {
    const ddl = migration.indexOf("ALTER TABLE public.transacoes_caixa");
    for (const check of [
      "parcelas com chave nula, duplicada",
      "estados ou valores legados inválidos",
      "há lançamentos de Caixa sem tenant",
      "recebimento legado sem vínculo inequívoco",
      "valor pago de parcela diverge do livro-caixa",
      "operações idempotentes legadas exigem revisão",
    ]) {
      expect(migration.indexOf(check)).toBeGreaterThan(0);
      expect(migration.indexOf(check)).toBeLessThan(ddl);
    }
    expect(migration).toContain("to_jsonb(t)->>'operacao_financeira_id'");
    expect(migration).toContain("to_jsonb(t)->>'cliente_id'");
  });

  it("usa tipos reais de status, histórico e datas sem coerção por timezone da sessão", () => {
    expect(migration).toContain("v_status_parcela public.parcelas.status%TYPE");
    expect(migration).toContain("v_status_quitado public.contratos.status%TYPE");
    expect(migration).toContain("v_historico_user_id public.contrato_historico.user_id%TYPE");
    expect(migration).not.toContain("::public.status_parcela");
    expect(migration).not.toContain("::public.status_contrato");
    expect(migration).toContain("v_data_pagamento := p_data_pagamento;");
    expect(migration).toContain("v_data_transacao := p_data_pagamento;");
    expect(migration).toContain("v_valor_pago_normalizado\n  );");
  });

  it("aceita atraso produtivo e preserva principal obrigatório quando valor_original é nulo", () => {
    expect(migration).toContain("v_contrato_status NOT IN ('ativo', 'atrasado', 'inadimplente')");
    expect(migration).toContain("'pendente', 'atrasada', 'atrasado', 'vencendo_hoje', 'parcial'");
    expect(migration).toContain("coalesce(v_parcela.valor_original, (to_jsonb(v_parcela)->>'valor')::numeric)");
    expect(migration).not.toContain("coalesce(v_parcela.valor_original, 0)");
    expect(migration).toContain("gen_random_uuid(), p_user_id, 'recebimento_parcela'");
    expect(migration).toContain("gen_random_uuid(), p_user_id, v_operacao.id");
  });

  it("pré-auditoria não exige a coluna que a própria 0015 cria", () => {
    const preflight = readFileSync(resolve(process.cwd(), "reports/preflight-rpcs-financeiras.sql"), "utf8");
    expect(preflight).toContain("to_jsonb(t)->>'operacao_financeira_id'");
    expect(preflight).not.toContain("ON o.id = t.operacao_financeira_id");
  });
});
