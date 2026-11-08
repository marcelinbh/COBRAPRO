import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const read = (name: string) => readFileSync(resolve(process.cwd(), name), "utf8");
const sql = read("drizzle/0025_integrar_rpc_despesas_ciclo.sql");
const old20 = read("drizzle/0020_rpc_despesas_prospectivas.sql");
const old22 = read("drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql");
const baseline = JSON.parse(read("tests/postgres-financial-coexistence/baseline.json"));
function expense(source: string) {
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public.despesas_rpc_executar(");
  return source.slice(start, source.indexOf("$rpc$;", start) + "$rpc$;".length);
}
describe("0025 — coexistência mínima de despesas e ciclo", () => {
  it("preserva corpo exato 0020 retiradas apenas uma aquisição de lock e duas emissões privadas", () => {
    const integrated = expense(sql)
      .replace(/^    PERFORM pg_catalog.pg_advisory_xact_lock\(22022,v_conta_id\); -- 0025: antes do lock de linha da conta\n/m, "")
      .replace(/^      PERFORM public.ciclo_autorizar\('(pagar|estornar)',v_conta_id,p_user_id,v_d.id,v_id,v_valor,v_data,'(Pagamento|Estorno): '\|\|v_d.descricao\); -- 0025: capability exata após validações\n/gm, "");
    expect(integrated).toBe(expense(old20));
    expect(expense(sql).match(/PERFORM public.ciclo_autorizar/g)).toHaveLength(2);
  });
  it("preserva guarda 0022 salvo declaração e consumo single-use exato no ramo ledger", () => {
    const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.ciclo_guardar()");
    const end = sql.indexOf("$$;", start) + 3;
    const integrated = sql.slice(start, end)
      .replace("CREATE OR REPLACE FUNCTION", "CREATE FUNCTION")
      .replace("autorizado boolean; despesa_autorizada boolean;", "autorizado boolean;")
      .replace(/   -- 0025: consumo atômico[\s\S]*?   END IF;\n(?=   IF protegido AND)/, "");
    const original = old22.slice(old22.indexOf("CREATE FUNCTION public.ciclo_guardar()"), old22.indexOf("\nCREATE TRIGGER ciclo_conta"));
    expect(integrated).toBe(original);
  });
  it("corrige exclusivamente os três bits RLS conhecidos sem aceitar drift da baseline integral", () => {
    const restored = structuredClone(baseline);
    const baseNames = ["contas_caixa", "contas_pagar", "transacoes_caixa"];
    expect(baseline.functions).toHaveLength(15);
    const baseTables = restored.base_tables.filter((t: { relname: string }) => baseNames.includes(t.relname));
    expect(baseTables.map((t: { relname: string }) => t.relname)).toEqual(baseNames);
    for (const table of baseTables) {
      expect(table.relrowsecurity).toBe(true);
      expect(table.relforcerowsecurity).toBe(false);
      table.relrowsecurity = false; // Reconstrói só os três bits da baseline anterior revisada.
    }
    // SHA256 do JSON compacto anterior: fixa 15 corpos/hashes e todos os metadados.
    expect(createHash("sha256").update(JSON.stringify(restored)).digest("hex"))
      .toBe("4f3dc0483eee2f5d521b1bec5c6ae5bec0325ebca45123b3ceac6efd618129d6");
    const preflight = sql.slice(0, sql.indexOf("CREATE TABLE public.ciclo_despesas_autorizacoes"));
    const tableLiteral = preflight.split("expected := ")[2].split("'::jsonb;")[0].slice(1).replaceAll("''", "'");
    const expectedTables = [...baseline.tables, ...baseline.base_tables.filter((t: { relname: string }) => baseNames.includes(t.relname))]
      .sort((a, b) => a.relname.localeCompare(b.relname));
    expect(JSON.parse(tableLiteral)).toEqual(expectedTables);
    expect(preflight).toContain("IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0025: tabelas/defaults/CHECK/FK/índices incompatíveis'");
    const fixture = read("tests/postgres-financial-coexistence/fixture.sql");
    for (const name of baseNames) expect(fixture).toContain(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;`);
    expect(fixture).toContain("ALTER ROLE service_role NOSUPERUSER BYPASSRLS;");
    expect(sql).not.toMatch(/ALTER ROLE|ALTER TABLE public\.(contas_caixa|contas_pagar|transacoes_caixa)\b/);
  });
  it("whitelist CHECK aceita só as cinco formas completas de cast ARRAY PG17.6 comprovadas", () => {
    const castLiteral = sql.split("constraint_casts := ")[1].split("'::jsonb;")[0].slice(1).replaceAll("''", "'");
    const expectedCasts: Record<string, Record<string, Record<string, string>>> = {};
    for (const [table, column, values] of [
      ["contas_caixa", "tipo", ["caixa", "banco", "digital"]],
      ["contas_pagar", "categoria", ["aluguel", "energia", "agua", "internet", "telefone", "salario", "imposto", "fornecedor", "outros"]],
      ["contas_pagar", "frequencia", ["mensal", "semanal", "quinzenal", "anual"]],
      ["contas_pagar", "status", ["pendente", "pago", "atrasado", "cancelado"]],
      ["transacoes_caixa", "tipo", ["entrada", "saida"]],
    ] as const) {
      const canonical = `CHECK (((${column})::text = ANY (ARRAY[${values.map(v => `('${v}'::character varying)::text`).join(", ")}])))`;
      const variant = `CHECK (((${column})::text = ANY ((ARRAY[${values.map(v => `'${v}'::character varying`).join(", ")}])::text[])))`;
      (expectedCasts[table] ??= {})[`${table}_${column}_check`] = { [variant]: canonical };
    }
    expect(JSON.parse(castLiteral)).toEqual(expectedCasts);
    const gate = sql.slice(0, sql.indexOf("CREATE TABLE public.ciclo_despesas_autorizacoes"));
    expect(gate).toContain("c.relname IN('contas_caixa','contas_pagar','transacoes_caixa') AND contype='c' THEN coalesce(constraint_casts->c.relname->conname->>pg_get_constraintdef(oid,false),pg_get_constraintdef(oid,false)) ELSE pg_get_constraintdef(oid,false)");
    expect(gate).not.toMatch(/regexp_replace|regexp_match|replace\(/);
  });
  it("fecha préflight antes de DDL usando todos hashes originais e objetos/ACL/overload", () => {
    const gate = sql.slice(0, sql.indexOf("CREATE TABLE public.ciclo_despesas_autorizacoes"));
    for (const f of baseline.functions) {
      expect(createHash("sha256").update(f.prosrc).digest("hex")).toBe(f.body_hash);
      expect(gate).toContain(f.body_hash);
    }
    for (const token of ["pg_get_function_identity_arguments", "oidvectortypes", "proowner<>owner_oid", "pg_get_constraintdef", "pg_get_indexdef", "pg_get_triggerdef", "tgenabled", "aclexplode", "attacl", "pg_policy", "body_hash", "current_user", "capability residual 0022"]) expect(gate).toContain(token);
  });
  it("capability somente INSERT exato expense/reversal, provenance deferred e sem grant/GUC", () => {
    expect(sql).toContain("a.esperado=newj-'id'");
    expect(sql).toContain("DELETE FROM public.ciclo_despesas_autorizacoes a");
    expect(sql).toContain("TG_OP='INSERT'");
    expect(sql).toContain("AND newj->'contrato_id'='null'::jsonb AND newj->'parcela_id'='null'::jsonb");
    expect(sql).toContain("FOREIGN KEY(operacao_id) REFERENCES public.despesas_rpc_operacoes(id)");
    expect(sql).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(sql).not.toMatch(/\bGRANT\s+(?:EXECUTE|ALL|INSERT|UPDATE|DELETE)/i);
    expect(sql).not.toMatch(/set_config|session_replication_role|DISABLE TRIGGER|SET ROLE|ALTER OWNER/i);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.ciclo_autorizar(text,integer,integer,integer,uuid,numeric,date,text)");
  });
  it("adquire lock global antes de conta e emite apenas após validação de conta/livro e original", () => {
    const body = expense(sql);
    expect(body.indexOf("pg_advisory_xact_lock(22022,v_conta_id)")).toBeLessThan(body.indexOf("SELECT * INTO v_conta"));
    expect(body.indexOf("Livro da conta possui owner/valores inconsistentes")).toBeLessThan(body.indexOf("ciclo_autorizar('pagar'"));
    expect(body.indexOf("Saída original ausente ou alterada")).toBeLessThan(body.indexOf("ciclo_autorizar('estornar'"));
    expect(body).not.toMatch(/(?:UPDATE|DELETE FROM) public\.(?:transacoes_caixa|contas_caixa)/);
    expect(sql).not.toContain("CREATE OR REPLACE FUNCTION public.ciclo_snapshot");
    expect(sql).not.toContain("CREATE OR REPLACE FUNCTION public.ciclo_validar");
  });
  it("runner usa PG17 fixo, socket privado, env-i e shutdown verificado", () => {
    const runner = read("tests/postgres-financial-coexistence/run.sh");
    for (const token of ["/usr/lib/postgresql/17/bin", "env -i", "listen_addresses=''", "unix_socket_permissions=0700", "chmod 700", "FINAL_STATUS", "$status_rc != 3", "trap cleanup EXIT"]) expect(runner).toContain(token);
    const executable = runner.split("\n").filter(line => !/^\s*#/.test(line)).join("\n");
    expect(executable).not.toMatch(/dotenv|DATABASE_URL|SUPABASE_URL|curl|wget/);
  });
});
