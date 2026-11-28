import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql=readFileSync(new URL('../../drizzle/0067_lista_controles_organizacao.sql',import.meta.url),'utf8');
describe('67 instalação: contrato aditivo para gates PG17 do parent',()=>{
 it('BEGIN/COMMIT, schema real antigo sem owner, koletores real e catálogo privado',()=>{
  expect(sql).toMatch(/BEGIN;/); expect(sql.trim()).toMatch(/COMMIT;$/); expect(sql).toContain('"contrato_id","bigint",true'); expect(sql).toContain('public.koletores'); expect(sql).not.toContain('public.cobradores');
  expect(sql).toContain('UNIQUE(user_id,nome)'); expect(sql).not.toMatch(/ALTER TABLE public\./); expect(sql).not.toMatch(/REFERENCES public\./); expect(sql).not.toMatch(/UPDATE public\.(contratos|parcelas|transacoes_caixa|contas_caixa)/);
 });
 it('STABLE wrapper chama lista60 uma vez, metadata somente IDs validated',()=>{
  const body=sql.slice(sql.indexOf('CREATE FUNCTION lista_controles67.lista('),sql.indexOf('CREATE FUNCTION public.rpc_lista_emprestimos67'));
  expect(body).toContain('STABLE'); expect(body.match(/emprestimos_lista60\.lista\(uid\)/g)).toHaveLength(1); expect(body).toContain("i->>'kind'='validated'"); expect(body).toContain("'state','unavailable','scope','ALLscope'");
 });
 it('delta37 só quatro facades novas, CAS corrente derivado e todos verificadores',()=>{
  const post=sql.slice(sql.indexOf('DO $post67$'));
  expect(post).toContain('derived IS DISTINCT FROM old'); expect(post).toContain('WHERE id=1 AND assinatura=old'); expect(post).toContain('pg_get_functiondef(p.oid) IS DISTINCT FROM w.definition');
  expect(post).toContain('p.oid NOT IN('); expect(post).not.toContain('rpc_lista_emprestimos60(integer)');
  for(const schema of ['obrigacoes51','inclusao52','sucessores53','emprestimos_lista60','private47','despesas49']) expect(post).toContain(`PERFORM ${schema}.verificar()`);
  expect(sql).not.toMatch(/CREATE OR REPLACE/); expect(sql).not.toMatch(/UPDATE (?:obrigacoes51|inclusao52|sucessores53|emprestimos_lista60)\.manifesto/);
 });
 it('writers owner/catalog/ref/hash/CAS sem capacidade financeira ou retries',()=>{
  expect(sql).toContain('FOR SHARE NOWAIT'); expect(sql).toContain('pg_try_advisory_xact_lock(670067,uid)'); expect(sql).toContain("current_labels->>'estadoHash' IS DISTINCT FROM hash"); expect(sql).toContain('WHERE user_id=uid AND contrato_id=cid AND revisao=rev'); expect(sql).toContain('ON CONFLICT DO NOTHING');
  expect(sql).not.toMatch(/set_config|INSERT INTO .*capacidades|DISABLE TRIGGER/);
 });
});
