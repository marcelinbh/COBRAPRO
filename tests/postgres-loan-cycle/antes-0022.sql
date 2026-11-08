CREATE TABLE public.test_origens(nome text PRIMARY KEY, r jsonb NOT NULL);
INSERT INTO test_origens SELECT 'intacta', public.rpc_criar_emprestimo(1,'11111111-1111-4111-8111-111111111111',1,1,'mensal','mensal',100,10,1,'2026-01-01','2026-01-01',ARRAY['2026-02-01'::date]);
INSERT INTO test_origens SELECT 'caixa_adulterado', public.rpc_criar_emprestimo(1,'22222222-2222-4222-8222-222222222222',1,1,'mensal','mensal',100,10,1,'2026-01-01','2026-01-01',ARRAY['2026-02-01'::date]);
UPDATE transacoes_caixa SET valor=101 WHERE id=(SELECT (r->>'transacaoCaixaId')::int FROM test_origens WHERE nome='caixa_adulterado');
INSERT INTO test_origens SELECT 'parcela_adulterada', public.rpc_criar_emprestimo(1,'33333333-3333-4333-8333-333333333333',1,1,'mensal','mensal',100,10,1,'2026-01-01','2026-01-01',ARRAY['2026-02-01'::date]);
UPDATE parcelas SET valor_juros=0 WHERE contrato_id=(SELECT (r->>'id')::int FROM test_origens WHERE nome='parcela_adulterada');
INSERT INTO test_origens SELECT 'hist_adulterado', public.rpc_criar_emprestimo(1,'44444444-4444-4444-8444-444444444444',1,1,'mensal','mensal',100,10,1,'2026-01-01','2026-01-01',ARRAY['2026-02-01'::date]);
UPDATE contrato_historico SET valor_novo=101 WHERE contrato_id=(SELECT (r->>'id')::int FROM test_origens WHERE nome='hist_adulterado');
