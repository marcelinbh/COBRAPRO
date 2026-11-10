#!/usr/bin/env python3
"""PG17 descartável. Dados sintéticos, sem dotenv/segredos/TCP/produção."""
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time

PSQL, SOCKET, PORT, USER, PROJECT, EVIDENCE = sys.argv[1:]
P, E = pathlib.Path(PROJECT), pathlib.Path(EVIDENCE)
assert SOCKET.startswith('/tmp/cobrapro-kiwify-subscriptions-') and SOCKET.endswith('/socket')
assert not any(k in os.environ for k in ['DATABASE_URL','SUPABASE_URL','PGHOST','PGSERVICE','PGPASSWORD'])
BASE = [PSQL,'-X','-q','-At','-h',SOCKET,'-p',PORT,'-U',USER,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
MIG = P/'drizzle/0027_kiwify_assinaturas_blacklist.sql'
results = []
seq = 0

def query(q=None, db='ready', file=None, error=None):
    global seq
    seq += 1
    cmd = BASE+['-d',db]+(['-f',str(file)] if file else ['-c',q])
    r = subprocess.run(cmd,text=True,capture_output=True,timeout=35)
    (E/f'{seq:03d}-{db}.log').write_text(f'SQL: {q}\nFILE: {file}\nEXIT: {r.returncode}\n{r.stdout}\n{r.stderr}')
    assert (r.returncode!=0 and error in r.stderr) if error else r.returncode==0, (q,r.stdout,r.stderr)
    return r.stdout.strip()

def apply(db='ready', error=None):
    return query(db=db,file=MIG,error=error)

def clone(db, source='ready'):
    query(f'CREATE DATABASE {db} TEMPLATE {source}',db='postgres')
    return db

def check(name, detail=True):
    results.append({'name':name,'status':'PASS','detail':detail})
    print(f'PASS {len(results):02d}: {name}',flush=True)
    (E/'results.json').write_text(json.dumps({'status':'RUNNING','checks':results},indent=2)+'\n')

def quote(v):
    return "'"+json.dumps(v,separators=(',',':')).replace("'","''")+"'::jsonb"

def event(sub='sub_a', order='order_a', typ='order_approved', user=1, product='prod_blacklist', at=None, until=None, **kw):
    now=dt.datetime.now(dt.timezone.utc)
    iso=lambda d:d.strftime('%Y-%m-%dT%H:%M:%SZ')
    data={'event_fingerprint':hashlib.sha256(f'{sub}/{order}/{typ}'.encode()).hexdigest(),
          'order_id':order,'event_type':typ,'subscription_id':sub,'user_id':user,'product_id':product,
          'status':'active','start_date':iso(now-dt.timedelta(days=10)),'has_access':True,
          'active_period':True,'access_until':iso(until or now+dt.timedelta(days=20)),
          'verified_sale_status':'paid','event_at':iso(at or now-dt.timedelta(seconds=10))}
    data.update(kw)
    return data

def call(e):return f'SELECT public.rpc_kiwify_blacklist_consume({quote(e)})'
def rpc(e, db='ready', error=None):
    out=query('SET ROLE service_role; '+call(e),db=db,error=error)
    return json.loads(out) if not error else None

def gate(user=1,db='ready'):
    return json.loads(query(f'SET ROLE service_role; SELECT public.rpc_kiwify_blacklist_access({user})',db=db))

def sql_text(v):
    return 'NULL' if v is None else "'"+v.replace("'","''")+"'"

def reader(name, param, db='ready', error=None):
    out=query(f'SET ROLE service_role; SELECT public.rpc_kiwify_blacklist_{name}({sql_text(param)})',db=db,error=error)
    return (json.loads(out) if out else None) if not error else None

EVIDENCE_FIELDS={'eligible','subscription_id','user_id','product_id','last_paid_order_id','status',
                 'start_date','has_access','active_period','access_until','financial_revoked','review_required'}

def assert_denied(e):
    assert set(e)==EVIDENCE_FIELDS and e['eligible'] is False
    assert all(v is None for k,v in e.items() if k!='eligible'),e

def snapshot(db):
    return query("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(x) ORDER BY product_id) FROM public.kiwify_blacklist_products x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY subscription_id) FROM public.kiwify_blacklist_subscriptions x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY order_id,event_type,event_fingerprint) FROM public.kiwify_blacklist_events x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.users x),(SELECT jsonb_agg(to_jsonb(x)) FROM public.blacklist_access_grants x))",db=db)

def base_snapshot(db):
    return query("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.users x),(SELECT jsonb_agg(to_jsonb(x)) FROM public.blacklist_access_grants x))",db=db)

def catalog(db):
    return query("SELECT jsonb_build_array((SELECT jsonb_agg(jsonb_build_array(relname,relacl::text,relrowsecurity,relforcerowsecurity,obj_description(oid,'pg_class')) ORDER BY relname) FROM pg_class WHERE relnamespace='public'::regnamespace),(SELECT jsonb_agg(jsonb_build_array(oid::regprocedure::text,pg_get_functiondef(oid),proacl::text,obj_description(oid,'pg_proc')) ORDER BY proname) FROM pg_proc WHERE pronamespace='public'::regnamespace),(SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled,tgtype) ORDER BY tgname) FROM pg_trigger WHERE NOT tgisinternal))",db=db)

query('CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS; CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE outsider NOLOGIN NOSUPERUSER NOBYPASSRLS;',db='postgres')
query('CREATE DATABASE empty',db='postgres')
query('CREATE DATABASE ready',db='postgres')
fixture="CREATE TABLE public.users(id integer PRIMARY KEY,role text NOT NULL,email text); ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; INSERT INTO public.users VALUES(1,'user','one@example.invalid'),(2,'admin','two@example.invalid'),(3,'user',NULL); CREATE TABLE public.blacklist_access_grants(user_id integer,lifetime boolean); INSERT INTO public.blacklist_access_grants VALUES(1,true),(2,true);"
query(fixture,db='empty');query(fixture)
apply()
assert query('SELECT count(*) FROM public.kiwify_blacklist_products')=='0'
assert not gate()['eligible'] and not gate(2)['eligible']
rpc(event(),error='42501')
check('allowlist nasce vazia, cadastro/admin/grants vitalícios legados NÃO concedem')
query("INSERT INTO public.kiwify_blacklist_products VALUES('prod_blacklist',true),('prod_other',true),('prod_disabled',false)")
assert query("SELECT current_setting('server_version_num')::int/10000||'|'||current_setting('listen_addresses')||'|'||current_setting('unix_socket_directories')")=='17||'+SOCKET
assert os.stat(SOCKET).st_mode&0o777==0o700
check('PG17 socket privado e TCP desativado, ambiente limpo')
state,cat=snapshot('ready'),catalog('ready')
apply();apply()
assert state==snapshot('ready') and cat==catalog('ready')
check('idempotência 2x preserva todas as linhas e catálogo')
for role in ['anon','authenticated','outsider']:
    query(f'SET ROLE {role}; '+call(event()),error='42501')
    query(f'SET ROLE {role}; SELECT public.rpc_kiwify_blacklist_access(1)',error='42501')
    query(f"SET ROLE {role}; SELECT public.rpc_kiwify_blacklist_order_binding('order_a')",error='42501')
    query(f"SET ROLE {role}; SELECT public.rpc_kiwify_blacklist_find_users('one@example.invalid')",error='42501')
for role in ['anon','authenticated','outsider','service_role']:
    for table in ['products','subscriptions','events']:
        for sql in [f'SELECT * FROM public.kiwify_blacklist_{table}',f'DELETE FROM public.kiwify_blacklist_{table}',f'TRUNCATE public.kiwify_blacklist_{table}']:
            query(f'SET ROLE {role}; '+sql,error='42501')
    query(f'SET ROLE {role}; UPDATE public.kiwify_blacklist_subscriptions SET financial_revoked=false',error='42501')
    query(f"SET ROLE {role}; INSERT INTO public.kiwify_blacklist_products VALUES('fake',true)",error='42501')
assert query("SELECT count(*) FROM pg_class WHERE relname LIKE 'kiwify_blacklist_%' AND relkind='r' AND relrowsecurity")=='3'
assert query("SELECT count(*) FROM pg_policy WHERE polrelid IN ('public.kiwify_blacklist_products'::regclass,'public.kiwify_blacklist_subscriptions'::regclass,'public.kiwify_blacklist_events'::regclass)")=='0'
check('RLS zero policies; ACL bloqueia frontend/outsider e DML direto service_role')

# Each behavior test uses its own clone: NEVER repair/correct production-like table data.
db=clone('paid')
e=event();r=rpc(e,db);assert r['eligible'] and r['outcome']=='paid_period'
before=snapshot(db);assert rpc(e,db)['duplicate'];assert before==snapshot(db)
assert not gate(2,db)['eligible']
check('paid verificado inicia, replay exato sem escrita, gate isolado por user')
now=dt.datetime.now(dt.timezone.utc)
renew=event(order='order_renew',typ='subscription_renewed',at=now-dt.timedelta(seconds=5),until=now+dt.timedelta(days=50))
renew['start_date']=e['start_date']
assert rpc(renew,db)['outcome']=='paid_period';paid_until=gate(1,db)['access_until']
old=event(order='old_payment',at=now-dt.timedelta(days=1),until=now+dt.timedelta(days=100));old['start_date']=e['start_date']
assert rpc(old,db)['outcome']=='stale';assert gate(1,db)['access_until']==paid_until
same=event(order='order_renew',typ='order_approved',at=now-dt.timedelta(seconds=2),until=now+dt.timedelta(days=100));same['start_date']=e['start_date']
assert rpc(same,db)['outcome']=='same_paid_order';assert gate(1,db)['access_until']==paid_until
check('nova cobrança renova; atrasado e segundo evento do mesmo pedido nunca estendem')
cancel=event(order='order_renew',typ='subscription_canceled',status='canceled',at=now-dt.timedelta(seconds=1),until=now+dt.timedelta(days=200));cancel['start_date']=e['start_date']
assert rpc(cancel,db)['eligible'];assert gate(1,db)['access_until']==paid_until
cancel2=dict(cancel,event_fingerprint=hashlib.sha256(b'legitimate_cancel_2').hexdigest(),event_at=(now+dt.timedelta(seconds=1)).strftime('%Y-%m-%dT%H:%M:%SZ'),has_access=False,active_period=False)
assert not rpc(cancel2,db)['eligible'];assert query("SELECT count(*) FROM public.kiwify_blacklist_events WHERE event_type='subscription_canceled'",db=db)=='2'
assert gate(1,db)['eligible'] is False
check('cancel mantém somente prazo pago; duas notificações distintas aceitas; término fecha sem estender')

db=clone('closed_observation');paid=event();rpc(paid,db)
closed=dict(paid,event_type='subscription_canceled',status='ended',has_access=False,active_period=False,
            event_fingerprint=hashlib.sha256(b'closed').hexdigest(),event_at=dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
assert not rpc(closed,db)['eligible']
stale=event(order='stale_order',until=dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=100),
            at=dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=1));stale['start_date']=paid['start_date']
assert rpc(stale,db)['outcome']=='stale' and not gate(1,db)['eligible']
same_period=event(order='same_period',at=dt.datetime.now(dt.timezone.utc)+dt.timedelta(seconds=1));same_period['start_date']=paid['start_date'];same_period['access_until']=paid['access_until']
assert rpc(same_period,db)['outcome']=='observed_no_grant' and not gate(1,db)['eligible']
check('evento pago atrasado ou outro pedido com prazo já conhecido não reabre observação encerrada')

for typ,sale in [('order_refunded','refunded'),('chargeback','chargedback')]:
    db=clone('financial_'+typ)
    paid=event();assert rpc(paid,db)['eligible']
    revoke={k:v for k,v in paid.items() if k in ['event_fingerprint','order_id','subscription_id','user_id','product_id']}
    revoke.update(event_type=typ,verified_sale_status=sale,event_fingerprint=hashlib.sha256(typ.encode()).hexdigest(),access_until={'bad':'not UTC'},has_access='yes',status='garbage',event_at='not-a-date')
    r=rpc(revoke,db);assert r['financial_revoked'] and not r['eligible']
    before=snapshot(db);assert rpc(revoke,db)['duplicate'];assert before==snapshot(db)
    again=rpc(paid,db);assert again['outcome']=='sticky_revocation' and again['review_required'] and not again['eligible']
    fresh=event(order='new_order',typ='subscription_renewed',at=dt.datetime.now(dt.timezone.utc),until=dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=100))
    fresh['start_date']=paid['start_date'];assert not rpc(fresh,db)['eligible']
    new=event(sub='new_verified_sub',order='new_purchase');assert rpc(new,db)['eligible']
    assert gate(1,db)['subscription_id']=='new_verified_sub'
check('refund/chargeback sem customer_access e parse inválido revogam sticky; mesmo id revisão, novo id compra nova')
db=clone('current_sale_revoked');e=event();assert rpc(e,db)['eligible']
assert rpc(dict(e,verified_sale_status='refunded'),db)['financial_revoked']
assert not gate(1,db)['eligible'];assert query('SELECT count(*) FROM public.kiwify_blacklist_events',db=db)=='1'
check('replay exato com API venda agora refunded revoga sem reescrever evento original')

db=clone('disabled_revocation');e=event();assert rpc(e,db)['eligible']
query("UPDATE public.kiwify_blacklist_products SET enabled=false WHERE product_id='prod_blacklist'",db=db)
assert not gate(1,db)['eligible']
rev=dict(e,event_type='chargeback',verified_sale_status='chargedback',event_fingerprint=hashlib.sha256(b'disabled_rev').hexdigest())
assert rpc(rev,db)['financial_revoked']
query("UPDATE public.kiwify_blacklist_products SET enabled=true WHERE product_id='prod_blacklist'",db=db)
assert not gate(1,db)['eligible']
check('produto desligado bloqueia gate mas não impede revogação sticky; reenable não restaura')

for label,kw in [('waiting',{'status':'waiting_payment'}),('ended',{'status':'ended'}),('no_access',{'has_access':False}),('inactive',{'active_period':False}),('unpaid',{'verified_sale_status':'waiting_payment'}),('disabled',{'product':'prod_disabled'}),('late',{'typ':'subscription_late'}),('cancel',{'typ':'subscription_canceled'}),('expired',{'until':dt.datetime.now(dt.timezone.utc)-dt.timedelta(seconds=1)}),('lifetime',{'until':dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=500)})]:
    db=clone('nogrant_'+label);assert not rpc(event(**kw),db)['eligible'];assert not gate(1,db)['eligible']
check('waiting/ended/false/unpaid/disabled/late/cancel/expired/prazo-vitalício não iniciam acesso')
db=clone('expiration');e=event(until=dt.datetime.now(dt.timezone.utc)+dt.timedelta(seconds=3));assert rpc(e,db)['eligible']
snapshot_before=snapshot(db);time.sleep(3.2)
assert not gate(1,db)['eligible'];assert snapshot_before==snapshot(db)
assert not rpc(e,db)['eligible'];assert snapshot_before==snapshot(db)
check('expiração por cada leitura sem cron ou mudança de tabela; replay não reabre expirado')
db=clone('utc');e=event();e['start_date']=e['start_date'][:-1].replace('T',' ');e['access_until']=e['access_until'][:-1];e['event_at']=e['event_at'][:-1]
assert json.loads(query("SET ROLE service_role; SET TIME ZONE 'Asia/Tokyo'; "+call(e),db=db))['eligible']
assert gate(1,db)['access_until'].startswith(e['access_until'])
check('datas Subscription sem Z interpretadas UTC independentemente de timezone da sessão')

db=clone('conflicts');e=event();rpc(e,db);before=snapshot(db)
for bad in [dict(e,user_id=2),dict(e,product_id='prod_other'),dict(e,subscription_id='another'),dict(e,order_id='new',user_id=2)]:
    rpc(bad,db,error='23505');assert before==snapshot(db)
for patch in [{'email':'raw@example.invalid'},{'rawbody':'secret'},{'token':'secret'},{'user_id':2147483648},{'user_id':'1'},{'has_access':'true'},{'access_until':'infinity'},{'event_at':None},{'event_fingerprint':'A'*64},{'access_until':'2027-01-01T00:00:00-03:00'}]:
    rpc(dict(e,**patch),db,error='22023');assert before==snapshot(db)
check('conflitos multiuser/produto/assinatura e DTO PII/token/data/flag inválidos são atômicos sem correção')
for sql in ['UPDATE public.kiwify_blacklist_events SET outcome=outcome','DELETE FROM public.kiwify_blacklist_events','TRUNCATE public.kiwify_blacklist_events',"UPDATE public.kiwify_blacklist_subscriptions SET user_id=2",'TRUNCATE public.kiwify_blacklist_subscriptions, public.kiwify_blacklist_events']:
    query(sql,db=db,error='23514');assert before==snapshot(db)
check('ledger append-only e identidade imutável protegidos por triggers inclusive owner DML/truncate')

# Deterministic competing transaction tests: hold lock before second statement begins.
def race(db,e1,e2):
    cmd=BASE+['-d',db,'-c','BEGIN; SET ROLE service_role; '+call(e1)+'; SELECT pg_sleep(1.2); COMMIT']
    a=subprocess.Popen(cmd,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    time.sleep(.25)
    b=subprocess.run(BASE+['-d',db,'-c','SET ROLE service_role; '+call(e2)],text=True,capture_output=True,timeout=10)
    oa,ea=a.communicate(timeout=10)
    assert a.returncode==0,(oa,ea)
    (E/f'race-{db}.log').write_text(oa+ea+b.stdout+b.stderr)
    return b

db=clone('race_replay');e=event();r=race(db,e,e);assert r.returncode==0 and json.loads(r.stdout)['duplicate'];assert query('SELECT count(*) FROM public.kiwify_blacklist_events',db=db)=='1'
db=clone('race_conflict');r=race(db,event(),event(user=2));assert r.returncode!=0 and '23505' in r.stderr
for rev_first in [False,True]:
    db=clone('race_revoke_'+str(rev_first).lower());paid=event();rev=dict(paid,event_type='chargeback',verified_sale_status='chargedback',event_fingerprint=hashlib.sha256(b'race-rev').hexdigest())
    r=race(db,rev if rev_first else paid,paid if rev_first else rev);assert r.returncode==0
    assert not gate(1,db)['eligible'];assert query('SELECT financial_revoked FROM public.kiwify_blacklist_subscriptions',db=db)=='t'
check('concorrência exata dedup, titular conflitante e paid/revoke ambas ordens serializam fail-closed')

for newest_first in [False,True]:
    db=clone('race_renew_'+str(newest_first).lower());first=event();assert rpc(first,db)['eligible']
    now=dt.datetime.now(dt.timezone.utc)
    older=event(order='renew_older',typ='subscription_renewed',at=now-dt.timedelta(seconds=5),until=now+dt.timedelta(days=40))
    newer=event(order='renew_newer',typ='subscription_renewed',at=now-dt.timedelta(seconds=1),until=now+dt.timedelta(days=60))
    older['start_date']=newer['start_date']=first['start_date']
    r=race(db,newer if newest_first else older,older if newest_first else newer);assert r.returncode==0
    assert gate(1,db)['access_until'].startswith(newer['access_until'][:-1])
    assert query("SELECT last_paid_order_id FROM public.kiwify_blacklist_subscriptions",db=db)=='renew_newer'
check('renovações concorrentes ambas ordens: watermark conserva período e pedido mais recente')

db=clone('populated_reapply',source='paid');before,cat=snapshot(db),catalog(db)
apply(db);apply(db);assert before==snapshot(db) and cat==catalog(db)
db=clone('paid_canceled');r=rpc(event(status='canceled'),db)
assert r['eligible'] and r['outcome']=='paid_period'
check('idempotência 2x com ledger populado; canceled com flags/período pago verdadeiro pode iniciar')

# Expanded reader contract. Only consume grants periods; no owner correction of eligible rows.
db=clone('reader_fields');paid=event();assert rpc(paid,db)['eligible']
g=gate(1,db);assert set(g)==EVIDENCE_FIELDS
assert g['eligible'] is True and g['user_id']==1 and g['subscription_id']==paid['subscription_id']
assert g['product_id']==paid['product_id'] and g['last_paid_order_id']==paid['order_id']
assert g['status']=='active' and g['has_access'] is True and g['active_period'] is True
assert g['financial_revoked'] is False and g['review_required'] is False
for field in ['start_date','access_until']:
    assert g[field].endswith('.000000Z') and g[field].startswith(paid[field][:-1])
before=snapshot(db)
assert json.loads(query("SET ROLE service_role; SET search_path=pg_temp; SET TIME ZONE 'Asia/Tokyo'; SELECT public.rpc_kiwify_blacklist_access(1)",db=db))==g
assert before==snapshot(db);assert_denied(gate(2,db));assert_denied(gate(2147483647,db))
for param in ['NULL','0','-1']:
    query(f'SET ROLE service_role; SELECT public.rpc_kiwify_blacklist_access({param})',db=db,error='22023')
check('reader access 12 campos exatos, flags reais, last-paid e UTC; denied null e parâmetros negados; read-only')

db=clone('reader_deterministic');first=event(sub='z_subscription',order='z_paid');rpc(first,db)
second=dict(first,subscription_id='a_subscription',order_id='a_paid',event_fingerprint=hashlib.sha256(b'a_paid').hexdigest(),status='canceled')
rpc(second,db);g=gate(1,db);assert g['subscription_id']=='a_subscription' and g['status']=='canceled' and g['last_paid_order_id']=='a_paid'
longer=dict(first,subscription_id='m_subscription',order_id='m_paid',event_fingerprint=hashlib.sha256(b'm_paid').hexdigest(),access_until=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=40)).strftime('%Y-%m-%dT%H:%M:%SZ'))
rpc(longer,db);assert gate(1,db)['subscription_id']=='m_subscription'
rev=dict(longer,event_type='chargeback',verified_sale_status='chargedback',event_fingerprint=hashlib.sha256(b'm_refund').hexdigest())
rpc(rev,db);assert gate(1,db)['subscription_id']=='a_subscription'
check('reader escolhe somente elegível por período DESC e assinatura ASC; revogada nunca mascara elegível')

db=clone('reader_review');paid=event();rpc(paid,db)
rpc(dict(paid,verified_sale_status='refunded'),db);assert rpc(paid,db)['review_required'] is True
for source in ['closed_observation','reader_review','current_sale_revoked','disabled_revocation','expiration','nogrant_waiting','nogrant_lifetime']:
    assert_denied(gate(1,source))
before=snapshot('reader_fields');assert reader('order_binding','unknown_order','reader_fields') is None
assert before==snapshot('reader_fields')
check('reader false contém só null sem evidência parcial para encerrado/financeiro/review/expirado/sem período')

db=clone('reader_binding');paid=event();rpc(paid,db)
expected={'subscription_id':paid['subscription_id'],'user_id':1,'product_id':paid['product_id']}
assert reader('order_binding',paid['order_id'],db)==expected
before=snapshot(db)
for bad in [dict(paid,user_id=2),dict(paid,product_id='prod_other'),dict(paid,subscription_id='cross_subscription')]:
    rpc(bad,db,error='23505');assert reader('order_binding',paid['order_id'],db)==expected and before==snapshot(db)
revoke={k:v for k,v in paid.items() if k in ['order_id','user_id','product_id']}
revoke.update(reader('order_binding',paid['order_id'],db),event_type='order_refunded',verified_sale_status='refunded',event_fingerprint=hashlib.sha256(b'binding_refund').hexdigest())
assert rpc(revoke,db)['financial_revoked'];assert_denied(gate(1,db))
assert reader('order_binding',paid['order_id'],db)==expected
query("UPDATE public.kiwify_blacklist_products SET enabled=false WHERE product_id='prod_blacklist'",db=db)
assert reader('order_binding',paid['order_id'],db)==expected
second=event(sub='user_two',order='user_two_order',user=2,product='prod_other');rpc(second,db)
assert reader('order_binding',second['order_id'],db)=={'subscription_id':'user_two','user_id':2,'product_id':'prod_other'}
assert reader('order_binding','another_order_same_email_product',db) is None
assert reader('order_binding','order_a','expiration')==expected
before=snapshot(db)
for param in [None,'',' ',' order_a','order_a ','order.a','a'*129,"order_a\n","bad'order"]:
    reader('order_binding',param,db,error='22023');assert before==snapshot(db)
check('binding existente imutável/isola pedido e user; null missing sem inferir; refund sem IDs; expiração/disabled/sticky legíveis')

db=clone('binding_hostile',source='reader_binding')
query("INSERT INTO public.kiwify_blacklist_events(order_id,event_type,event_fingerprint,subscription_id,user_id,product_id,verified_sale_status,outcome) VALUES('order_a','chargeback',repeat('f',64),'user_two',2,'prod_other','chargedback','financial_revoked')",db=db)
before=snapshot(db);assert reader('order_binding','order_a',db) is None;assert before==snapshot(db)
check('binding nega ledger hostil com identidades cruzadas no mesmo order_id sem adotar ou corrigir linhas')

db=clone('reader_users');before=snapshot(db)
assert reader('find_users','  ONE@EXAMPLE.INVALID  ',db)==[{'id':1,'email':'one@example.invalid'}]
assert reader('find_users','missing@example.invalid',db)==[]
assert before==snapshot(db)
query("INSERT INTO public.users VALUES(11,'user',' Mixed@Example.Invalid '),(12,'user','mixed@example.invalid'),(13,'user',' MIXED@EXAMPLE.INVALID ')",db=db)
expected=[{'id':11,'email':' Mixed@Example.Invalid '},{'id':12,'email':'mixed@example.invalid'}]
assert reader('find_users',' Mixed@Example.Invalid ',db)==expected
assert reader('find_users','mixed@example.invalid',db)==expected
assert len(reader('find_users','MIXED@EXAMPLE.INVALID',db))==2
assert reader('find_users','@example.invalid',db,error='22023') is None
assert query('SELECT email IS NULL FROM public.users WHERE id=3',db=db)=='t'
before=snapshot(db)
for param in [None,'','  ','no-at','two@@example.invalid','x@example','x@.invalid','x@example.','x@exam ple.invalid','x\n@example.invalid','x\t@example.invalid','x\x01@example.invalid','a'*307+'@example.invalid','a'*8193]:
    reader('find_users',param,db,error='22023');assert before==snapshot(db)
query(f"SET ROLE service_role; SET search_path=pg_temp; SELECT public.rpc_kiwify_blacklist_find_users('MIXED@EXAMPLE.INVALID')",db=db)
assert before==snapshot(db)
check('find_users case/trim normalizado, duplicates LIMIT2 determinístico, null tabela excluído, strict null/control/oversize negados')

for role in ['anon','authenticated','outsider','service_role']:
    query(f'SET ROLE {role}; SELECT id,email FROM public.users',error='42501')
assert query("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('kiwify_blacklist_products','kiwify_blacklist_events','kiwify_blacklist_subscriptions') AND column_name IN ('email','customer_email','rawbody','payload','token')")=='0'
assert query("SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE 'rpc_kiwify_blacklist_%' AND (a.grantee=0 OR a.grantee IN ('anon'::regrole::oid,'authenticated'::regrole::oid,'outsider'::regrole::oid) OR a.is_grantable)")=='0'
check('novos readers zero ACL anônima e sem SELECT direto users; PII só RPC privilegiada, ledger sem email/payload')

# Hostile catalog clones. No repair after failure; catalog and data must remain exactly corrupted input.
mutations=[
('policy',"CREATE POLICY leak ON public.kiwify_blacklist_events TO anon USING(true)",'policy'),
 ('grant',"GRANT SELECT ON public.kiwify_blacklist_events TO authenticated",'ACL'),
 ('column_grant',"GRANT SELECT(user_id) ON public.kiwify_blacklist_events TO outsider",'ACL'),
 ('rls',"ALTER TABLE public.kiwify_blacklist_events DISABLE ROW LEVEL SECURITY",'RLS'),
 ('column',"ALTER TABLE public.kiwify_blacklist_events ADD COLUMN pii text",'colunas'),
 ('default',"ALTER TABLE public.kiwify_blacklist_products ALTER COLUMN enabled SET DEFAULT true",'colunas'),
 ('constraint',"ALTER TABLE public.kiwify_blacklist_events DROP CONSTRAINT kiwify_blacklist_events_event_fingerprint_check",'constraints'),
 ('index',"CREATE INDEX bad_idx ON public.kiwify_blacklist_events(user_id)",'índices'),
 ('trigger',"ALTER TABLE public.kiwify_blacklist_events DISABLE TRIGGER kiwify_blacklist_events_immutable",'gatilho'),
 ('missing_trigger',"DROP TRIGGER kiwify_blacklist_events_immutable ON public.kiwify_blacklist_events",'gatilho ausente'),
 ('body',"CREATE OR REPLACE FUNCTION public.rpc_kiwify_blacklist_access(p_user_id integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN RETURN '{}'::jsonb; END$$",'função'),
 ('fn_grant',"GRANT EXECUTE ON FUNCTION public.rpc_kiwify_blacklist_consume(jsonb) TO anon",'função'),
 ('fn_path',"ALTER FUNCTION public.rpc_kiwify_blacklist_consume(jsonb) SET search_path=public",'função'),
 ('fn_owner',"ALTER FUNCTION public.rpc_kiwify_blacklist_consume(jsonb) OWNER TO outsider",'função'),
 ('fn_marker',"COMMENT ON FUNCTION public.rpc_kiwify_blacklist_consume(jsonb) IS 'legacy'",'função'),
 ('overload',"CREATE FUNCTION public.rpc_kiwify_blacklist_consume(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$",'overload'),
 ('table_marker',"COMMENT ON TABLE public.kiwify_blacklist_events IS 'legacy'",'proveniência'),
 ('users_type',"ALTER TABLE public.users ALTER COLUMN id TYPE bigint",'users'),
]
for name,sql,error in mutations:
    db=clone('hostile_'+name);query(sql,db=db);before,cat=snapshot(db),catalog(db);apply(db,error)
    assert before==snapshot(db) and cat==catalog(db)
check('18 preflights homônimos/ACL/RLS/types/constraints/índices/trigger/função falham preservando linhas/catálogo')
reader_mutations=[
 ('email_missing','ALTER TABLE public.users DROP COLUMN email','users.email'),
 ('email_type','ALTER TABLE public.users ALTER COLUMN email TYPE bytea USING NULL','users.email'),
 ('email_generated',"ALTER TABLE public.users DROP COLUMN email; ALTER TABLE public.users ADD COLUMN email text GENERATED ALWAYS AS ('same@example.invalid') STORED",'users.email'),
]
for fn,arg in [('order_binding','p_order_id'),('find_users','p_email')]:
    full='public.rpc_kiwify_blacklist_'+fn
    reader_mutations.extend([
      (fn+'_missing',f'DROP FUNCTION {full}(text)','função ausente'),
      (fn+'_body',f"CREATE OR REPLACE FUNCTION {full}({arg} text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN RETURN '[]'::jsonb; END$$",'função'),
      (fn+'_grant',f'GRANT EXECUTE ON FUNCTION {full}(text) TO anon','função'),
      (fn+'_path',f'ALTER FUNCTION {full}(text) SET search_path=public','função'),
      (fn+'_owner',f'ALTER FUNCTION {full}(text) OWNER TO outsider','função'),
      (fn+'_marker',f"COMMENT ON FUNCTION {full}(text) IS 'legacy'",'função'),
      (fn+'_strict',f'ALTER FUNCTION {full}(text) STRICT','função'),
      (fn+'_overload',f"CREATE FUNCTION {full}(integer) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{{}}'::jsonb $$",'overload'),
    ])
for name,sql,error in reader_mutations:
    db=clone('hostile_reader_'+name);query(sql,db=db);before,cat=snapshot(db),catalog(db);apply(db,error)
    assert before==snapshot(db) and cat==catalog(db)
db=clone('reader_varchar',source='empty');query('ALTER TABLE public.users ALTER COLUMN email TYPE varchar(320)',db=db)
apply(db);cat=catalog(db);apply(db);assert cat==catalog(db)
assert reader('find_users',' ONE@EXAMPLE.INVALID ',db)==[{'id':1,'email':'one@example.invalid'}]
check('19 preflights novos users.email/readers rejeitam drift/ausência/ACL/hash/owner/path/strict/overloads sem reparo; varchar aceito')
db=clone('homonym',source='empty');query('CREATE TABLE public.kiwify_blacklist_products(product_id text PRIMARY KEY,enabled boolean)',db=db);cat=catalog(db);apply(db,'pacote parcial');assert cat==catalog(db)
db=clone('type_homonym',source='empty');query("CREATE TYPE public.kiwify_blacklist_events AS ENUM('untrusted')",db=db);cat=catalog(db);apply(db,'tipo homônimo');assert cat==catalog(db)
check('tabela legada parcial e type homônimo não são adotados ou corrigidos')

for fn,arg in [('order_binding','p_order_id'),('find_users','p_email')]:
    db=clone('fresh_homonym_'+fn,source='empty')
    query(f"CREATE FUNCTION public.rpc_kiwify_blacklist_{fn}({arg} text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{{}}'::jsonb $$",db=db)
    before,cat=base_snapshot(db),catalog(db);apply(db,'função');assert before==base_snapshot(db) and cat==catalog(db)
check('readers homônimos em pacote ainda ausente não são adotados; instalação reverte tabelas/ACL inteiramente')

query('CREATE ROLE reader_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;',db='postgres')
for label,sql in [('no_select',''),('filtered_rls','ALTER TABLE public.users OWNER TO reader_owner; ALTER TABLE public.users FORCE ROW LEVEL SECURITY; CREATE POLICY hide_duplicates ON public.users TO reader_owner USING(id=1);')]:
    db=clone('owner_'+label,source='empty')
    query('GRANT CREATE ON SCHEMA public TO reader_owner; '+sql,db=db)
    before,cat=base_snapshot(db),catalog(db)
    query('SET ROLE reader_owner; '+MIG.read_text(),db=db,error='owner leitor')
    assert before==base_snapshot(db) and cat==catalog(db)
check('owner sem SELECT ou sujeito a RLS que oculta candidatos falha preflight sem corrigir users/grants/policy')

# Role membership is cluster-global: isolated final tests, no undo needed.
query('GRANT service_role TO authenticated',db='postgres');before=snapshot('ready');apply(error='owner/roles');assert before==snapshot('ready')
check('membership frontend -> service_role bloqueia reaplicação sem corrigir ACL')
hashes=json.loads(query("SELECT jsonb_object_agg(proname,encode(sha256(convert_to(prosrc,'UTF8')),'hex')) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('rpc_kiwify_blacklist_consume','rpc_kiwify_blacklist_access','rpc_kiwify_blacklist_order_binding','rpc_kiwify_blacklist_find_users','kiwify_blacklist_immutable','kiwify_blacklist_identity')"))
assert hashes['rpc_kiwify_blacklist_consume']=='bc3323053a8a5b8822d41e20176093079d92c00d996e17e7170dfc5f9370c2ac'
assert hashes['kiwify_blacklist_identity']=='e3cf72d59b128b5a39ef91f89ae96606f187364c764d62ca362c478fa1d61b66'
assert hashes['kiwify_blacklist_immutable']=='c904bf80dddcba0906ce18c51f00099185fc0252b6d055e1852a49fce0affcda'
check('consume/identity/immutable SHA256 preservados exatamente; sem mudança financial/replay/ordem/expiração')
report={'status':'PASS','checks_count':len(results),'checks':results,'postgres':query('SELECT version()'),'scope':'local-only; no table correction; no production','migration_sha256':hashlib.sha256(MIG.read_bytes()).hexdigest(),'function_body_sha256':hashes}
(E/'results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
(P/'tests/postgres-kiwify-subscriptions/results-pg17.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(f'PASS: {len(results)} grupos de verificações; zero remoto/produção.',flush=True)
