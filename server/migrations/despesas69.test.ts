import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
const sql = readFileSync(new URL('../../drizzle/0069_substituicao_valor_despesa.sql', import.meta.url), 'utf8');
describe('migration69 static scope, runtime PG17 is separately authoritative', () => {
  it('one transaction and exactly one writer20, original only status/updatedAt', () => {
    expect(sql).toMatch(/^BEGIN;$/m); expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    const execution = sql.slice(sql.indexOf('CREATE FUNCTION despesas69.executar('), sql.indexOf('CREATE FUNCTION despesas69.linhagem('));
    expect(execution.match(/public\.rpc_criar_despesa_prospectiva\(/g)).toHaveLength(1);
    expect(execution).toContain("r->>'categoria',op.valor_novo");
    expect(sql.match(/UPDATE public\.contas_pagar SET[^;]+;/g)).toHaveLength(1);
    expect(sql).toMatch(/UPDATE public\.contas_pagar SET status='cancelado',"updatedAt"=op\.instante/);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:contas_caixa|transacoes_caixa|despesas_rpc_pagamentos|despesas_rpc_origens)/);
    expect(sql).not.toMatch(/REFERENCES public\.|CREATE OR REPLACE FUNCTION|ALTER FUNCTION|DISABLE TRIGGER/);
  });
  it('DDL compares current valid seal excluding only 5 new facade OIDs and CAS updates only37', () => {
    expect(sql).toContain('PERFORM emprestimos_lista60.verificar()');
    expect(sql).toContain('derived IS DISTINCT FROM old');
    expect(sql).toContain('WHERE id=1 AND assinatura=old');
    expect(sql.match(/UPDATE [\w.]+manifesto/g)).toEqual(['UPDATE public.caixa37_manifesto']);
    const expr = sql.slice(sql.indexOf('SELECT public.caixa37_hash(jsonb_build_object('), sql.indexOf(' INTO derived;'));
    expect(expr).toContain("p.oid<>ALL(ARRAY['public.rpc_cotar_edicao_despesa69(integer,integer)'::regprocedure");
    expect(expr.match(/::regprocedure/g)).toHaveLength(5);
    expect(sql).not.toMatch(/despesas49\.configurar\(|despesa_cancelamento_v1\.configurar\(/);
    expect(sql).toContain('PERFORM despesas69.configurar(true)');
  });
  it('pins21 new definitions including sealed recurrence adapter to concrete bytes, not reseal unknown new source', () => {
    const pins = JSON.parse(sql.match(/FOR e IN SELECT value FROM jsonb_array_elements\('(\[.*?\])'::jsonb\) LOOP/)![1]);
    const bodies = new Map([...sql.matchAll(/CREATE FUNCTION ([\w.]+)\((.*?)\) RETURNS (.*?) AS \$\$(.*?)\$\$;/gs)].map(m => [m[1], createHash('sha256').update(m[4]).digest('hex')]));
    expect(bodies.size).toBe(21); expect(pins).toHaveLength(21);
    expect(bodies.has('despesas69.sucessora68')).toBe(true);
    for (const pin of pins) expect(bodies.get(pin.name)).toBe(pin.sha256);
  });
  it('recovery does not needON, exactUUID locks33/20 and no delta includes amount', () => {
    expect(sql).toContain("hashtextextended('despesa:'||uid::text||':'||k::text,33)");
    expect(sql).toContain("hashtextextended(uid::text||':'||k::text,20)");
    expect(sql).toContain("IF op.status='not_executed' THEN RAISE EXCEPTION '69 UUID terminal fenced'");
    expect(sql).toContain("AND (w->'original'->>'valor')::numeric=op.valor_novo");
    expect(sql).toContain('CREATE CONSTRAINT TRIGGER commit69');
  });
});
