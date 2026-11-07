#!/usr/bin/env python3
"""Finite PostgreSQL integration tests. No dotenv, remote connections or Python database dependency."""
import json, os, pwd, subprocess, sys, time, uuid
from pathlib import Path
ROOT=Path(sys.argv[1]).resolve()
assert ROOT.name.startswith('cobrapro-pg-test-') and ROOT.parent == Path('/tmp'), 'Only isolated temporary directory allowed'
PROFILE=sys.argv[2] if len(sys.argv)>2 else 'legacy'
assert PROFILE in ('legacy','prod')
DB='rpc_validation' if PROFILE=='legacy' else 'rpc_validation_prod'
EVIDENCE=ROOT/'evidence'/PROFILE
EVIDENCE.mkdir(exist_ok=True)
ENV={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'}
BASE=['psql','-X','-qAt','-h',str(ROOT/'socket'),'-p','55432','-U',pwd.getpwuid(os.getuid()).pw_name,'-d',DB,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
RESULTS=[]
LOG=(EVIDENCE/'tests-transcript.log').open('w')
def sql(query, error=None):
    p=subprocess.run(BASE+['-c',query],env=ENV,text=True,capture_output=True,timeout=20)
    LOG.write(f'COMMAND: {BASE!r} -c {query!r}\nEXIT: {p.returncode}\nSTDOUT:\n{p.stdout}STDERR:\n{p.stderr}\n');LOG.flush()
    if error:
        assert p.returncode==1 and f'ERROR:  {error}:' in p.stderr,(error,p.returncode,p.stderr)
    else: assert p.returncode==0,(p.returncode,p.stderr)
    return p.stdout.strip()
def val(query): return json.loads(sql(query))
def key(i): return str(uuid.UUID(int=i))
def literal(x):
    if x is None:return 'NULL'
    if isinstance(x,(int,float)):return str(x)
    return "'"+str(x).replace("'","''")+"'"
def call_query(pid,amount,k,tenant=1,cash=1,discount=0,interest=None,date='2026-11-06',obs=None,role='service_role',zone='UTC'):
    args=[tenant,pid,cash,amount,discount,interest,date,obs,k]
    return f"SET TIME ZONE '{zone}'; SET ROLE {role}; SELECT public.rpc_registrar_pagamento_parcela({','.join(map(literal,args))});"
def call(pid,amount,k,**kwargs): return val(call_query(pid,amount,k,**kwargs))
def error_call(code,pid,amount,k,**kwargs): sql(call_query(pid,amount,k,**kwargs),code)
def seed(pid,tenant=1,client=None,due='2026-11-06',contract_status='ativo'):
    client=client or tenant
    if PROFILE=='prod':
        sql(f"INSERT INTO contratos(id,user_id,cliente_id,status,numero_parcelas,num_parcelas) VALUES({pid},{tenant},{client},'{contract_status}',1,1); INSERT INTO parcelas(id,user_id,contrato_id,cliente_id,numero,numero_parcela,valor,valor_original,data_vencimento) VALUES({pid},{tenant},{pid},{client},1,1,100,100,'{due}');")
    else:
        sql(f"INSERT INTO contratos(id,user_id,cliente_id,status,numero_parcelas) VALUES({pid},{tenant},{client},'{contract_status}',1); INSERT INTO parcelas(id,user_id,contrato_id,cliente_id,numero_parcela,valor_original,data_vencimento) VALUES({pid},{tenant},{pid},{client},1,100,'{due}');")
def snap(pid):
    return val(f"SELECT jsonb_build_object('parcela',(SELECT to_jsonb(p) FROM parcelas p WHERE id={pid}),'contrato',(SELECT to_jsonb(c) FROM contratos c WHERE id={pid}),'caixa',(SELECT count(*) FROM transacoes_caixa WHERE parcela_id={pid}),'total',(SELECT coalesce(sum(valor),0) FROM transacoes_caixa WHERE parcela_id={pid}),'operacoes',(SELECT count(*) FROM operacoes_financeiras),'audit',(SELECT count(*) FROM auditoria_financeira),'historico',(SELECT count(*) FROM contrato_historico))")
def test(name,fn):
    start=time.monotonic()
    try: detail=fn();r={'test':name,'pass':True,'seconds':round(time.monotonic()-start,3),'evidence':detail}
    except Exception as e:r={'test':name,'pass':False,'seconds':round(time.monotonic()-start,3),'error':repr(e)}
    RESULTS.append(r); print(json.dumps(r,ensure_ascii=False),flush=True)

def full():
    seed(101);r=call(101,100,key(101));s=snap(101)
    assert r['status']=='paga' and s['parcela']['valor_pago']==100 and s['parcela']['saldo_residual']==0
    assert s['caixa']==1 and s['total']==100 and s['contrato']['status']=='quitado'
    return {'response':r,'saldo':s['parcela']['saldo_residual'],'caixa':s['caixa'],'contrato':s['contrato']['status']}
test('integral',full)
def idem_same():
    before=snap(101);r=call(101,100,key(101));after=snap(101)
    assert r['repetida'] is True and before==after
    return {'response':r,'all_financial_rows_unchanged':True}
test('idempotencia_mesma_chave_payload',idem_same)
def idem_other_payload():
    before=snap(101);error_call('23505',101,99,key(101));assert before==snap(101)
    return {'sqlstate':'23505','all_financial_rows_unchanged':True}
test('idempotencia_mesma_chave_payload_diferente',idem_other_payload)
def other_key_paid():
    before=snap(101);error_call('23514',101,100,key(999101));assert before==snap(101)
    return {'sqlstate':'23514','reason':'Contrato quitado é rejeitado antes de status parcela','new_operation_rolled_back':True}
test('outra_chave_parcela_ja_quitada',other_key_paid)
def partial():
    sql("INSERT INTO configuracoes(user_id,chave,valor) VALUES(1,'jurosMultaAutomatico','true'),(1,'multaDiaria','1'),(1,'multaPadrao','2')")
    seed(102);r1=call(102,30,key(1021),date='2026-11-07',discount=2,interest=5,obs=' paid ')
    same=call(102,30,key(1021),date='2026-11-07',discount=2,interest=5,obs='paid');assert same['repetida']
    before=snap(102);error_call('22023',102,25,key(1028),discount=1);assert before==snap(102)
    sql("UPDATE configuracoes SET valor='99' WHERE user_id=1 AND chave IN ('multaDiaria','multaPadrao')")
    r2=call(102,25,key(1022),date='2026-11-20');r3=call(102,50,key(1023),date='2026-11-21');s=snap(102)
    assert [r1['saldoResidual'],r2['saldoResidual'],r3['saldoResidual']]==[75,50,0]
    assert s['total']==105 and s['caixa']==3 and s['parcela']['valor_pago']==105
    assert [s['parcela'][f] for f in ['valor_juros','valor_multa','valor_desconto']]==[5,2,2]
    sql("UPDATE configuracoes SET valor=CASE WHEN chave='multaDiaria' THEN '1' ELSE '2' END WHERE user_id=1 AND chave IN ('multaDiaria','multaPadrao')")
    return {'responses':[r1,r2,r3],'replay_trim_normalized':same['repetida'],'total_caixa':s['total'],'encargos_preservados':[5,2,2]}
test('parcial_repetido_chaves_distintas_encargos_preservados',partial)
def isolation():
    seed(103);seed(203,tenant=2)
    codes=[]
    for kwargs,pid in [({'cash':2},103),({'cash':3},103),({},203),({'tenant':2,'cash':2},103)]:
        before=snap(pid);error_call('42501',pid,10,key(10300+len(codes)),**kwargs);assert before==snap(pid);codes.append('42501')
    sql('UPDATE parcelas SET cliente_id=3 WHERE id=103');before=snap(103)
    error_call('42501',103,10,key(10399));assert before==snap(103)
    sql('UPDATE parcelas SET cliente_id=1 WHERE id=103')
    # Same UUID may validly exist in separate tenant scopes.
    a=call(103,100,key(103));b=call(203,100,key(103),tenant=2,cash=2)
    assert a['operationId']!=b['operationId']
    return {'foreign_cash_inactive_foreign_parcel_foreign_user':codes,'wrong_contract_client':'42501','same_key_per_tenant_distinct_operations':True}
test('isolamento_tenant_caixa_cliente',isolation)
def acl():
    seed(104)
    for role in ['anon','authenticated']:
        before=snap(104);error_call('42501',104,100,key(104),role=role);assert before==snap(104)
    r=call(104,100,key(104));assert r['success']
    grants=val("SELECT jsonb_build_object('service_role',has_function_privilege('service_role','public.rpc_registrar_pagamento_parcela(integer,integer,integer,numeric,numeric,numeric,date,text,uuid)','execute'),'anon',has_function_privilege('anon','public.rpc_registrar_pagamento_parcela(integer,integer,integer,numeric,numeric,numeric,date,text,uuid)','execute'),'authenticated',has_function_privilege('authenticated','public.rpc_registrar_pagamento_parcela(integer,integer,integer,numeric,numeric,numeric,date,text,uuid)','execute'))")
    assert grants=={'service_role':True,'anon':False,'authenticated':False}
    return grants
test('acl_execucao_real_roles',acl)
def dates():
    civil=val("SELECT jsonb_build_array(('2026-11-07 02:59:59+00'::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date,('2026-11-07 03:00:00+00'::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date)")
    assert civil==['2026-11-06','2026-11-07']
    seed(105);seed(106)
    a=call(105,100,key(105),date=civil[0],zone='Asia/Tokyo');b=call(106,103,key(106),date=civil[1],zone='UTC')
    if PROFILE=='prod':
        rows=val("SELECT jsonb_agg(jsonb_build_object('id',id,'juros',valor_juros,'multa',valor_multa,'civil',data_pagamento) ORDER BY id) FROM parcelas WHERE id IN (105,106)")
        assert rows[0]['civil']==civil[0] and rows[1]['civil']==civil[1]
        caixa_dates=val("SELECT jsonb_agg(data_transacao ORDER BY parcela_id) FROM transacoes_caixa WHERE parcela_id IN (105,106)")
        assert caixa_dates==civil
    else:
        rows=val("SELECT jsonb_agg(jsonb_build_object('id',id,'juros',valor_juros,'multa',valor_multa,'civil',(data_pagamento AT TIME ZONE 'America/Sao_Paulo')::date,'utc',to_char(data_pagamento AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) ORDER BY id) FROM parcelas WHERE id IN (105,106)")
        assert rows[0]['utc']=='2026-11-06 15:00:00' and rows[1]['utc']=='2026-11-07 15:00:00'
    assert rows[0]['juros']==0 and rows[0]['multa']==0
    assert rows[1]['juros']==1 and rows[1]['multa']==2
    return {'utc_boundary_to_civil':civil,'rows':rows}
test('multa_dia_vs_dia_seguinte_America_Sao_Paulo',dates)
def rollback():
    seed(107)
    sql("CREATE FUNCTION test_fail_caixa() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.parcela_id=107 THEN RAISE EXCEPTION 'fixture caixa failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_fail_caixa BEFORE INSERT ON transacoes_caixa FOR EACH ROW EXECUTE FUNCTION test_fail_caixa();")
    before=snap(107);error_call('23514',107,100,key(107));after=snap(107)
    assert before==after
    sql('DROP TRIGGER test_fail_caixa ON transacoes_caixa; DROP FUNCTION test_fail_caixa()')
    r=call(107,100,key(107));assert r['success'] and not r['repetida']
    return {'injected_failure':'BEFORE INSERT caixa SQLSTATE 23514','all_financial_rows_and_contract_rolled_back':True,'same_key_retry_success':True}
test('rollback_caixa_e_retry_mesma_chave',rollback)
def composite_fks():
    op=sql('SELECT id FROM operacoes_financeiras WHERE user_id=1 LIMIT 1')
    before=sql('SELECT count(*) FROM transacoes_caixa')
    sql(f"INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao,operacao_financeira_id) VALUES(2,2,'entrada','outros',1,'fixture','2026-11-06','{op}')",'23505')
    unused=key(987654321)
    sql(f"BEGIN; INSERT INTO operacoes_financeiras(id,user_id,tipo,chave_idempotencia,hash_requisicao,status) VALUES('{unused}',1,'ajuste_manual','{unused}','fixture','processando'); INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao,operacao_financeira_id) VALUES(2,2,'entrada','outros',1,'fixture','2026-11-06','{unused}'); COMMIT",'23503')
    sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) VALUES(1,2,'entrada','outros',1,'fixture','2026-11-06')",'23503')
    assert before==sql('SELECT count(*) FROM transacoes_caixa')
    return {'duplicate_operation_first_rejected':'23505','foreign_unused_operation':'23503','foreign_account':'23503','no_inserted_rows':True}
test('fks_compostas_escrita_direta',composite_fks)
def bad_values():
    seed(108)
    for amount,discount,interest in [(0,0,None),(-1,0,None),(1.001,0,None),(1,-1,None),(101,0,None),(1,0,-1)]:
        before=snap(108);error_call('22023',108,amount,key(108),discount=discount,interest=interest);assert before==snap(108)
    return {'rejected_cases':6,'sqlstate':'22023','no_financial_mutation':True}
test('valores_invalidos_precisao_e_sobrepagamento',bad_values)
def duplicate_config():
    sql("INSERT INTO configuracoes(user_id,chave,valor) VALUES(1,'multa_diaria','1')")
    before=snap(108);error_call('23505',108,10,key(108));assert before==snap(108)
    sql("DELETE FROM configuracoes WHERE user_id=1 AND chave='multa_diaria'")
    return {'synonym_ambiguity':'23505','no_financial_mutation':True}
test('configuracao_sinonima_duplicada_falha_fechada',duplicate_config)

def concurrent(pid,amounts,same,second_cash=1):
    seed(pid)
    # First connection completes its RPC but holds transaction open. Second must genuinely wait.
    k1=key(pid*10+1);k2=k1 if same else key(pid*10+2)
    q1="BEGIN; SET application_name='rpc_validation_first'; "+call_query(pid,amounts[0],k1)+" SELECT pg_sleep(1.2); COMMIT;"
    p1=subprocess.Popen(BASE+['-c',q1],env=ENV,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    deadline=time.monotonic()+5
    while time.monotonic()<deadline:
        active=sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='rpc_validation_first' AND wait_event='PgSleep'")
        if active=='1':break
        time.sleep(.05)
    else: raise AssertionError('first connection never reached open-transaction barrier')
    q2="SET application_name='rpc_validation_second'; "+call_query(pid,amounts[1],k2,cash=second_cash)
    p2=subprocess.Popen(BASE+['-c',q2],env=ENV,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    waited=False
    while time.monotonic()<deadline:
        if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='rpc_validation_second' AND wait_event_type='Lock'")=='1':waited=True;break
        time.sleep(.03)
    out1,err1=p1.communicate(timeout=10);out2,err2=p2.communicate(timeout=10)
    LOG.write(f'CONCURRENT {pid}\nCOMMAND1 {q1}\nEXIT1 {p1.returncode}\n{out1}{err1}\nCOMMAND2 {q2}\nEXIT2 {p2.returncode}\n{out2}{err2}\nACTUAL_LOCK_WAIT {waited}\n');LOG.flush()
    assert waited and p1.returncode==0
    r1=json.loads(out1.splitlines()[0]);s=snap(pid)
    if same:
        assert p2.returncode==0;r2=json.loads(out2)
        assert r2['repetida'] and r1['operationId']==r2['operationId'] and s['caixa']==1 and s['total']==100
    elif amounts==[30,70]:
        assert p2.returncode==0;r2=json.loads(out2)
        assert not r2['repetida'] and s['caixa']==2 and s['total']==100 and s['parcela']['saldo_residual']==0
    else:
        assert p2.returncode==1 and 'ERROR:  23514:' in err2
        r2={'sqlstate':'23514'};assert s['caixa']==1 and s['total']==100
    return {'first_exit':p1.returncode,'second_exit':p2.returncode,'actual_lock_wait':waited,'responses':[r1,r2],'caixa_count':s['caixa'],'total':s['total']}
test('concorrencia_mesma_chave',lambda:concurrent(109,[100,100],True))
test('concorrencia_chaves_diferentes_parciais',lambda:concurrent(110,[30,70],False))
test('concorrencia_chaves_diferentes_integral',lambda:concurrent(111,[100,100],False))
sql("INSERT INTO contas_caixa(id,user_id,nome) VALUES(4,1,'Caixa A separado')")
test('concorrencia_caixas_distintos_mesma_parcela',lambda:concurrent(112,[30,70],False,second_cash=4))
if PROFILE=='prod':
    def prod_catalog():
        result=val("SELECT jsonb_build_object('pgcrypto_schema',(SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto'),'pgcrypto_version',(SELECT extversion FROM pg_extension WHERE extname='pgcrypto'),'uuid_defaults',(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('operacoes_financeiras','auditoria_financeira') AND column_name='id' AND column_default IS NOT NULL),'historico_user_type',(SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='contrato_historico' AND column_name='user_id'),'historico_valor_type',(SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='contrato_historico' AND column_name='valor_novo'),'cliente_nullable',(SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='transacoes_caixa' AND column_name='cliente_id'),'tenant_nullable',(SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='parcelas' AND column_name='user_id'),'triggers',(SELECT count(*) FROM pg_trigger WHERE tgrelid IN ('parcelas'::regclass,'contratos'::regclass,'transacoes_caixa'::regclass) AND NOT tgisinternal),'historico_integral',(SELECT jsonb_build_object('user_id',user_id,'valor_novo',valor_novo) FROM contrato_historico WHERE contrato_id=101 LIMIT 1))")
        assert result=={'pgcrypto_schema':'extensions','pgcrypto_version':'1.3','uuid_defaults':0,'historico_user_type':'text','historico_valor_type':'numeric','cliente_nullable':'YES','tenant_nullable':'YES','triggers':0,'historico_integral':{'user_id':'1','valor_novo':100}}
        return result
    test('catalogo_prod_extensions_uuid_sem_default_historico_tipos',prod_catalog)
    def overdue_prod():
        seed(113,contract_status='atrasado');seed(114,contract_status='atrasado')
        sql("UPDATE parcelas SET status='atrasado' WHERE id IN (113,114); UPDATE parcelas SET numero=2,numero_parcela=2 WHERE id=114; UPDATE parcelas SET contrato_id=113 WHERE id=114")
        first=call(113,100,key(113));assert snap(113)['contrato']['status']=='atrasado'
        second=call(114,100,key(114));assert snap(113)['contrato']['status']=='quitado'
        return {'first':first,'second':second,'remaining_atrasado_prevents_premature_quitado':True}
    test('status_atrasado_parcela_contrato_e_quitacao_total',overdue_prod)
    def denied_states_prod():
        codes=[]
        for i,status in enumerate(['cancelada','cancelado','pago']):
            pid=120+i;seed(pid);sql(f"UPDATE parcelas SET status='{status}' WHERE id={pid}");before=snap(pid)
            code='23505' if status=='pago' else '23514'
            error_call(code,pid,100,key(pid));assert before==snap(pid);codes.append({'status':status,'sqlstate':code})
        for i,status in enumerate(['cancelado','renegociado']):
            pid=123+i;seed(pid,contract_status=status);before=snap(pid)
            error_call('23514',pid,100,key(pid));assert before==snap(pid);codes.append({'contract_status':status,'sqlstate':'23514'})
        return codes
    test('estados_reais_cancelado_pago_renegociado_bloqueados',denied_states_prod)
    def nullable_links_prod():
        seed(125)
        for column in ['user_id','cliente_id']:
            sql(f'UPDATE parcelas SET {column}=NULL WHERE id=125');before=snap(125)
            error_call('42501',125,100,key(125));assert before==snap(125)
            sql(f'UPDATE parcelas SET {column}=1 WHERE id=125')
        return {'null_user_id':'42501','null_cliente_id':'42501','no_inference_no_mutation':True}
    test('links_nullable_sem_inferencia_automatica',nullable_links_prod)
    def fallback_principal_prod():
        seed(126);sql('UPDATE parcelas SET valor_original=NULL WHERE id=126')
        r=call(126,100,key(126));assert r['status']=='paga' and snap(126)['parcela']['valor_original'] is None
        seed(127);sql('UPDATE parcelas SET valor_original=NULL,valor=0 WHERE id=127');before=snap(127)
        error_call('23514',127,1,key(127));assert before==snap(127)
        return {'fallback_valor':r,'valor_original_remains_null':True,'zero_principal':'23514'}
    test('valor_original_nullable_usa_valor_sem_backfill',fallback_principal_prod)
    def civil_extreme_zones_prod():
        evidence=[]
        for pid,zone in [(128,'Pacific/Kiritimati'),(129,'Etc/GMT+12')]:
            seed(pid);r=call(pid,100,key(pid),zone=zone)
            dates=val(f"SELECT jsonb_build_object('parcela',p.data_pagamento,'caixa',t.data_transacao) FROM parcelas p JOIN transacoes_caixa t ON t.parcela_id=p.id WHERE p.id={pid}")
            assert dates=={'parcela':'2026-11-06','caixa':'2026-11-06'}
            evidence.append({'zone':zone,'dates':dates,'success':r['success']})
        return evidence
    test('date_nao_trunca_timestamptz_em_timezones_extremos',civil_extreme_zones_prod)
def invariants():
    result=val("SELECT jsonb_build_object('parcelas_caixa_divergentes',(SELECT count(*) FROM parcelas p WHERE coalesce(p.valor_pago,0)<>(SELECT coalesce(sum(t.valor),0) FROM transacoes_caixa t WHERE t.parcela_id=p.id AND t.user_id=p.user_id AND t.categoria='pagamento_parcela')),'operacoes_sem_caixa',(SELECT count(*) FROM operacoes_financeiras o WHERE o.status='concluida' AND NOT EXISTS(SELECT 1 FROM transacoes_caixa t WHERE t.operacao_financeira_id=o.id)),'operacoes_sem_auditoria',(SELECT count(*) FROM operacoes_financeiras o WHERE NOT EXISTS(SELECT 1 FROM auditoria_financeira a WHERE a.operacao_id=o.id)),'operacoes_nao_concluidas',(SELECT count(*) FROM operacoes_financeiras WHERE status<>'concluida'))")
    assert all(x==0 for x in result.values())
    return result
test('invariantes_finais_ledger_operacao_auditoria',invariants)
LOG.close()
(EVIDENCE/'test-results.json').write_text(json.dumps(RESULTS,indent=2,ensure_ascii=False)+'\n')
passed=sum(r['pass'] for r in RESULTS)
print(f'SUMMARY: {passed}/{len(RESULTS)} tests passed',flush=True)
raise SystemExit(0 if passed==len(RESULTS) else 1)
