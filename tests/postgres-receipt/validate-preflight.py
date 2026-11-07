#!/usr/bin/env python3
"""Pré-auditoria 0015, somente fixture prod e socket isolado; nenhum dotenv/URL remota."""
import json, os, pwd, subprocess, sys, uuid
from pathlib import Path
ROOT=Path(sys.argv[1]).resolve()
PROJECT=Path(sys.argv[2]).resolve()
assert ROOT.name.startswith('cobrapro-pg-test-') and ROOT.parent==Path('/tmp')
ENV={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'}
BASE=['psql','-X','-qAt','-h',str(ROOT/'socket'),'-p','55432','-U',pwd.getpwuid(os.getuid()).pw_name,'-d','rpc_validation_prod','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
EVIDENCE=ROOT/'evidence/prod'
LOG=(EVIDENCE/'preflight-tests-transcript.log').open('w')
RESULTS=[]
def run(args):
    p=subprocess.run(BASE+args,env=ENV,text=True,capture_output=True,timeout=20)
    LOG.write(f'COMMAND: {BASE+args!r}\nEXIT: {p.returncode}\nSTDOUT:\n{p.stdout}STDERR:\n{p.stderr}\n');LOG.flush()
    return p
def sql(query):
    p=run(['-c',query]);assert p.returncode==0,p.stderr
    return p.stdout.strip()
def schema():
    return sql("SELECT jsonb_build_object('columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,ordinal_position) FROM information_schema.columns c WHERE table_schema='public'),'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'def',pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE connamespace='public'::regnamespace),'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY indexname) FROM pg_indexes i WHERE schemaname='public'),'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace))")
def seed():
    sql("INSERT INTO contratos(id,user_id,cliente_id,status,numero_parcelas,num_parcelas) VALUES(1,1,1,'ativo',1,1); INSERT INTO parcelas(id,user_id,contrato_id,cliente_id,numero,numero_parcela,valor,valor_original,data_vencimento) VALUES(1,1,1,1,1,1,100,100,'2026-11-06')")
def rejected(name,mutation,message,restore=''):
    seed();sql(mutation);before=schema()
    # NÃO usa -1: comprova que o primeiro DO aborta, sem depender de rollback de DDL.
    p=run(['-f',str(PROJECT/'drizzle/0015_rpc_recebimento_parcela.sql')])
    assert p.returncode==3 and message in p.stderr,(name,p.returncode,p.stderr)
    assert before==schema(),f'{name}: migration deixou DDL parcial'
    sql('TRUNCATE contrato_historico,auditoria_financeira,transacoes_caixa,operacoes_financeiras,parcelas,contratos,configuracoes CASCADE')
    if restore:sql(restore)
    result={'test':name,'pass':True,'error':message,'ddl_unchanged_without_transaction_wrapper':True}
    RESULTS.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
rejected('parcela_tenant_nulo','UPDATE parcelas SET user_id=NULL WHERE id=1','parcelas com chave nula')
rejected('parcela_numero_nulo','UPDATE parcelas SET numero_parcela=NULL WHERE id=1','parcelas com chave nula')
rejected('parcela_cliente_divergente','UPDATE parcelas SET cliente_id=3 WHERE id=1','parcelas com chave nula')
rejected('parcela_cliente_nulo','UPDATE parcelas SET cliente_id=NULL WHERE id=1','parcelas com chave nula')
rejected('parcela_contrato_foreign_tenant','UPDATE contratos SET user_id=2 WHERE id=1','parcelas com chave nula')
rejected('parcela_duplicada',"DROP INDEX parcelas_user_contrato_numero_uk; INSERT INTO parcelas(id,user_id,contrato_id,cliente_id,numero,numero_parcela,valor,valor_original,data_vencimento) VALUES(2,1,1,1,1,1,100,100,'2026-11-06')",'parcelas com chave nula', 'CREATE UNIQUE INDEX parcelas_user_contrato_numero_uk ON parcelas(user_id,contrato_id,numero_parcela)')
rejected('parcial_saldo_zero',"UPDATE parcelas SET status='parcial' WHERE id=1",'estados ou valores legados inválidos')
rejected('pago_saldo_nao_zero',"UPDATE parcelas SET status='pago',saldo_residual=1 WHERE id=1",'estados ou valores legados inválidos')
rejected('principal_zero',"UPDATE parcelas SET valor_original=NULL,valor=0 WHERE id=1",'estados ou valores legados inválidos')
rejected('valor_pago_sem_caixa','UPDATE parcelas SET valor_pago=10 WHERE id=1','valor pago de parcela diverge')
rejected('caixa_tenant_nulo',"INSERT INTO transacoes_caixa(conta_caixa_id,tipo,categoria,descricao,valor,data_transacao) VALUES(1,'entrada','outros','fixture',1,'2026-11-06')",'há lançamentos de Caixa sem tenant')
rejected('caixa_tenant_divergente',"INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,descricao,valor,data_transacao) VALUES(1,2,'entrada','outros','fixture',1,'2026-11-06')",'há lançamentos de Caixa sem tenant')
rejected('recebimento_sem_coluna_cliente_nao_inferido',"UPDATE parcelas SET valor_pago=10 WHERE id=1; INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,descricao,valor,data_transacao,parcela_id,contrato_id) VALUES(1,1,'entrada','pagamento_parcela','fixture',10,'2026-11-06',1,1)",'recebimento legado sem vínculo inequívoco')
u=str(uuid.UUID(int=1))
rejected('operacao_processando',f"INSERT INTO operacoes_financeiras(id,user_id,tipo,chave_idempotencia,hash_requisicao) VALUES('{u}',1,'recebimento_parcela','{u}','fixture')",'operações idempotentes legadas exigem revisão')
rejected('configuracao_sinonima_duplicada',"INSERT INTO configuracoes(user_id,chave,valor) VALUES(1,'multaDiaria','1'),(1,'multa_diaria','1')",'configurações financeiras sinônimas/duplicadas')
rejected('contratos_cliente_id_coluna_ausente','ALTER TABLE contratos RENAME COLUMN cliente_id TO cliente_id_fixture','coluna contratos.cliente_id ausente','ALTER TABLE contratos RENAME COLUMN cliente_id_fixture TO cliente_id')
LOG.close()
(EVIDENCE/'preflight-test-results.json').write_text(json.dumps(RESULTS,indent=2,ensure_ascii=False)+'\n')
print(f'SUMMARY: {len(RESULTS)}/{len(RESULTS)} preflight tests passed',flush=True)
