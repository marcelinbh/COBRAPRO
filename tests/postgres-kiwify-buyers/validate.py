#!/usr/bin/env python3
"""Disposable synthetic PG17; no secrets, dotenv, TCP, backup or production."""
import concurrent.futures, datetime as dt, hashlib, json, os, pathlib, subprocess, sys, time
PSQL, SOCKET, PORT, USER, PROJECT, EVIDENCE = sys.argv[1:]
P, E = pathlib.Path(PROJECT), pathlib.Path(EVIDENCE)
assert SOCKET.startswith('/tmp/cobrapro-kiwify-buyers-') and SOCKET.endswith('/socket')
assert not any(k in os.environ for k in ['DATABASE_URL','SUPABASE_URL','PGHOST','PGSERVICE','PGPASSWORD'])
BASE=[PSQL,'-X','-q','-At','-h',SOCKET,'-p',PORT,'-U',USER,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
M=P/'drizzle/0028_kiwify_compradores_transacional.sql'
results=[]; seq=0

def query(q=None,db='ready',file=None,error=None):
    global seq
    seq+=1
    r=subprocess.run(BASE+['-d',db]+(['-f',str(file)] if file else ['-c',q]),text=True,capture_output=True,timeout=40)
    (E/f'{seq:03d}-{db}.log').write_text(f'SQL: {q}\nFILE: {file}\nEXIT: {r.returncode}\n{r.stdout}\n{r.stderr}')
    assert (r.returncode!=0 and error in r.stderr) if error else r.returncode==0,(q,r.stdout,r.stderr)
    return r.stdout.strip()
def check(name):
    results.append({'name':name,'status':'PASS'});print(f'PASS {len(results):02d}: {name}',flush=True)
    (E/'results.json').write_text(json.dumps({'status':'RUNNING','checks':results},indent=2)+'\n')
def quote(v):return "'"+json.dumps(v,separators=(',',':')).replace("'","''")+"'::jsonb"
def call(v):return 'SELECT public.rpc_kiwify_buyer_provision('+quote(v)+')'
def rpc(v,db='ready',error=None):
    out=query('SET ROLE service_role; '+call(v),db=db,error=error)
    return json.loads(out) if not error else None
def clone(db,source='ready'):query(f'CREATE DATABASE {db} TEMPLATE {source}',db='postgres')
def apply(db='ready',error=None):query(db=db,file=M,error=error)
def buyer(order='order_new',email='new@example.invalid',sub=None,**patch):
    now=dt.datetime.now(dt.timezone.utc);iso=lambda d:d.strftime('%Y-%m-%dT%H:%M:%SZ')
    event={'order_id':order,'subscription_id':sub or 'sub_'+order,'product_id':'prod_fixture','event_type':'order_approved',
      'event_fingerprint':hashlib.sha256(order.encode()).hexdigest(),'verified_sale_status':'paid','status':'active',
      'start_date':iso(now-dt.timedelta(days=10)),'event_at':iso(now-dt.timedelta(seconds=10)),
      'access_until':iso(now+dt.timedelta(days=20)),'has_access':True,'active_period':True}
    event.update(patch)
    return {'email':email,'password_hash':'$2b$12$'+'a'*53,'open_id':'kiwify_12345678-1234-4123-8123-'+hashlib.sha256(order.encode()).hexdigest()[:12],'event':event}
def invite(order,email,token):return {'order_id':order,'email':email,'token_hash':hashlib.sha256(token.encode()).hexdigest()}
def claim(v,db='ready',error=None):
    out=query('SET ROLE service_role; SELECT public.rpc_kiwify_buyer_invite_claim('+quote(v)+')',db=db,error=error)
    return json.loads(out) if not error else None
def finish(v,state,db='ready',error=None):
    out=query('SET ROLE service_role; SELECT public.rpc_kiwify_buyer_invite_finish('+quote(dict(v,state=state))+')',db=db,error=error)
    return json.loads(out) if not error else None
def snap(db='ready'):
    return query("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM users u),(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM password_resets r),(SELECT jsonb_agg(to_jsonb(b) ORDER BY order_id) FROM kiwify_buyers b),(SELECT jsonb_agg(to_jsonb(e) ORDER BY order_id,event_type,event_fingerprint) FROM kiwify_blacklist_events e),(SELECT jsonb_agg(to_jsonb(s) ORDER BY subscription_id) FROM kiwify_blacklist_subscriptions s),(SELECT jsonb_agg(to_jsonb(f)) FROM synthetic_financial f))",db=db)
def catalog(db='ready'):
    return query("SELECT jsonb_build_array((SELECT jsonb_agg(jsonb_build_array(relname,relacl::text,relrowsecurity,relforcerowsecurity,obj_description(oid,'pg_class')) ORDER BY relname) FROM pg_class WHERE relnamespace='public'::regnamespace),(SELECT jsonb_agg(jsonb_build_array(oid::regprocedure::text,pg_get_functiondef(oid),proacl::text,obj_description(oid,'pg_proc')) ORDER BY proname) FROM pg_proc WHERE pronamespace='public'::regnamespace),(SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled,tgtype) ORDER BY tgname) FROM pg_trigger WHERE NOT tgisinternal))",db=db)
query('CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS; CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE outsider NOLOGIN NOSUPERUSER NOBYPASSRLS;',db='postgres')
query('CREATE DATABASE ready',db='postgres')
query(file=P/'tests/postgres-kiwify-buyers/fixture.sql')
query(file=P/'drizzle/0027_kiwify_assinaturas_blacklist.sql')
query("INSERT INTO kiwify_blacklist_products VALUES('prod_fixture',true),('disabled_fixture',false)")
clone('pristine');apply();before=catalog();apply();assert catalog()==before
check('0027 + 0028 initial install and identical second application under Supabase PG17 default ACL')
for role in ['anon','authenticated','service_role','outsider']:
    assert query(f"SELECT has_table_privilege('{role}','kiwify_buyers','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')")=='f'
    for name in ['provision','invite_claim','invite_finish']:
        assert query(f"SELECT has_function_privilege('{role}','rpc_kiwify_buyer_{name}(jsonb)','EXECUTE')")==('t' if role=='service_role' else 'f')
query('SET ROLE anon; SELECT * FROM kiwify_buyers',error='42501')
query('SET ROLE authenticated; '+call(buyer()),error='42501')
check('RLS/no policies + owner/service execute only; no direct tables even for service')
manual=query('SELECT to_jsonb(u) FROM users u WHERE id=1');financial=query('SELECT to_jsonb(f) FROM synthetic_financial f')
r=rpc(buyer('manual_order','manual@example.invalid'));assert r['user_id']==1 and not r['created'] and r['invite_state']=='not_needed'
assert query('SELECT to_jsonb(u) FROM users u WHERE id=1')==manual and query('SELECT to_jsonb(f) FROM synthetic_financial f')==financial
assert query('SELECT count(*) FROM password_resets')=='0'
assert claim(invite('manual_order','manual@example.invalid','manual-token'))['claimed'] is False
check('existing manual case/trim identity linked with ZERO users update or reset/email intent; finance unchanged')
s=snap();rpc(buyer('ambiguous_order','ambiguous@example.invalid'),error='23505');assert snap()==s
check('two legacy case/trim matches deny and rollback all state')
r=rpc(buyer());uid=r['user_id'];assert r['created'] and r['invite_state']=='pending' and r['applied']
row=json.loads(query(f'SELECT to_jsonb(u) FROM users u WHERE id={uid}'))
assert row['name']=='Cliente CobraPro' and row['role']=='user' and row['session_version']==0 and row['onboarding_completo'] is False
s=snap();dup=rpc(buyer(email=' NEW@EXAMPLE.INVALID '));assert dup['user_id']==uid and not dup['applied'] and snap()==s
check('new random-hash account defaults + immutable order/email normalized duplicate idempotency')
for v in [buyer(email='other@example.invalid'),buyer(sub='other_sub'),buyer(product_id='disabled_fixture')]:
    s=snap();rpc(v,error='42501' if v['event']['product_id']=='disabled_fixture' else '23505');assert snap()==s
check('immutable order refuses changed destination/subscription/product')
for patch in [{'verified_sale_status':s} for s in ['refused','waiting_payment','refunded','chargedback']]+[
 {'event_type':'pix_created'},{'event_type':'billet_created'},{'event_type':'order_refunded'},
 {'has_access':False},{'active_period':'true'},{'status':'ended'},{'access_until':'2099-01-01T00:00:00Z'},
 {'access_until':'2026-02-31T00:00:00Z'},{'start_date':None},{'event_at':'2099-01-01T00:00:00Z'},{'user_id':1}]:
    s=snap();rpc(buyer('invalid_order','invalid@example.invalid',**patch),error='220' if patch.get('access_until')=='2026-02-31T00:00:00Z' else '22023');assert snap()==s
for v in [dict(buyer('bad_dto'),unapproved=True),dict(buyer('bad_dto'),password_hash='12345678'),dict(buyer('bad_dto'),open_id='bad')]:
    s=snap();rpc(v,error='22023');assert snap()==s
check('all nonpaid/invalid/malformed/extra-key DTOs create ZERO user/ledger/binding')
# Existing manual order establishes subscription identity: new buyer conflict rolls back user.
s=snap();rpc(buyer('conflict_order','conflict@example.invalid',sub='sub_manual_order'),error='23505');assert snap()==s
check('0027 subscription conflict rolls back brand-new user + buyer atomically')
i=invite('order_new','new@example.invalid','token-1');assert claim(i)['claimed']
reset=json.loads(query("SELECT to_jsonb(r) FROM password_resets r WHERE token='"+i['token_hash']+"'"))
assert reset['used'] is False
expires=dt.datetime.fromisoformat(reset['expires_at']);created=dt.datetime.fromisoformat(reset['createdAt']);assert 3599<=(expires-created).total_seconds()<=3601
assert query("SELECT invite_state FROM kiwify_buyers WHERE order_id='order_new'")=='sending'
assert not claim(invite('order_new','new@example.invalid','token-after-crash'))['claimed']
assert finish(i,'unknown')['finished'] and not claim(invite('order_new','new@example.invalid','token-after-timeout'))['claimed']
assert rpc(buyer())['invite_state']=='unknown'
check('CAS claim inserts hash-only reset used=false TTL1h before sending; sending/unknown NEVER redeliver')
r=rpc(buyer('retry_order','retry@example.invalid'));retry_uid=r['user_id'];i=invite('retry_order','retry@example.invalid','retry-1');assert claim(i)['claimed'];finish(i,'retryable')
assert rpc(buyer('retry_order','retry@example.invalid'))['user_id']==retry_uid
j=invite('retry_order','retry@example.invalid','retry-2');assert claim(j)['claimed'];assert query("SELECT used FROM password_resets WHERE token='"+i['token_hash']+"'")=='t'
finish(i,'accepted',error='23505');assert finish(j,'accepted')['finished'];assert finish(j,'accepted')['finished']
assert not claim(invite('retry_order','retry@example.invalid','retry-3'))['claimed']
assert query("SELECT count(*) FROM users WHERE lower(btrim(email))='retry@example.invalid'")=='1'
check('known retryable rejection retries new token/same user; old token invalidated; stale CAS refused; accepted not resent')
r=rpc(buyer('blocked_order','blocked@example.invalid'));i=invite('blocked_order','blocked@example.invalid','blocked');claim(i);finish(i,'blocked');assert not claim(invite('blocked_order','blocked@example.invalid','blocked-2'))['claimed']
check('permanent rejection blocks automatic resends')
# Claim failures never commit either a reset row or sending state.
rpc(buyer('claim_errors','claimerrors@example.invalid'))
for bad in [dict(invite('claim_errors','claimerrors@example.invalid','bad'),extra=True),
            dict(invite('claim_errors','claimerrors@example.invalid','bad'),token_hash='raw-token'),
            dict(invite('claim_errors','claimerrors@example.invalid','bad'),order_id=42)]:
    s=snap();claim(bad,error='22023');assert snap()==s
claim(invite('claim_errors','swapped@example.invalid','bad'),error='23505')
collision=invite('claim_errors','claimerrors@example.invalid','token-1');s=snap();claim(collision,error='23505');assert snap()==s
real=invite('claim_errors','claimerrors@example.invalid','claim-errors-valid');claim(real)
for bad in [dict(real,state='delivered'),dict(real,state='accepted',extra=True)]:
    s=snap();query('SET ROLE service_role; SELECT rpc_kiwify_buyer_invite_finish('+quote(bad)+')',error='22023');assert snap()==s
finish(real,'retryable');s=snap();claim(real,error='22023');assert snap()==s
check('strict claim/finish DTOs, swapped email, duplicate/reused token: rollback reset + CAS')
rpc(buyer('revoked_invite','revokedinvite@example.invalid'))
query("UPDATE kiwify_blacklist_subscriptions SET financial_revoked=true,has_access=false,active_period=false WHERE subscription_id='sub_revoked_invite'")
s=snap();claim(invite('revoked_invite','revokedinvite@example.invalid','revoked-token'),error='42501');assert snap()==s
check('refund before claim denies invitation without reset insert or state mutation')
# Expiration does NOT make accepted/unknown/sending eligible for automatic resend.
query("UPDATE password_resets SET expires_at=clock_timestamp()-interval '1 hour' WHERE token='"+j['token_hash']+"'")
assert not claim(invite('retry_order','retry@example.invalid','expired-accepted-new-token'))['claimed']
check('expired accepted token never reopens automatic email delivery; manual reconciliation required')
# Package drift and unsafe initial homonyms MUST rollback, never repaired.
for num,sql in enumerate([
 'ALTER TABLE kiwify_buyers ADD COLUMN drift text',
 'GRANT MAINTAIN ON kiwify_buyers TO authenticated',
 'GRANT SELECT ON kiwify_buyers TO outsider',
 'GRANT SELECT(email) ON kiwify_buyers TO anon',
 'CREATE POLICY drift ON kiwify_buyers USING(true)',
 'ALTER TABLE kiwify_buyers DISABLE TRIGGER kiwify_buyers_identity',
 'DROP FUNCTION rpc_kiwify_buyer_invite_finish(jsonb)',
 'ALTER FUNCTION rpc_kiwify_buyer_provision(jsonb) SET search_path=public',
 'CREATE FUNCTION rpc_kiwify_buyer_provision(text) RETURNS text LANGUAGE sql AS $$SELECT $1$$',
 'ALTER TABLE users ALTER COLUMN session_version TYPE bigint',
 'ALTER TABLE password_resets ADD COLUMN usado boolean',
 'ALTER TABLE password_resets ALTER COLUMN used DROP NOT NULL',
 'ALTER TABLE users ALTER COLUMN onboarding_completo SET DEFAULT true',
]):
    db='drift_'+str(num);clone(db);query(sql,db=db);c=catalog(db);apply(db,error='0028');assert catalog(db)==c
check('13 catalog/ACL/policy/trigger/overload/precondition drifts refused without repair')
for num,sql in enumerate([
 'CREATE TABLE kiwify_buyers(id integer)',
 'CREATE TYPE kiwify_buyers AS (id integer)',
 'CREATE FUNCTION rpc_kiwify_buyer_invite_finish(jsonb) RETURNS jsonb LANGUAGE sql AS $$SELECT $1$$',
 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO outsider',
 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO outsider',
]):
    db='homonym_'+str(num);clone(db,'pristine');query(sql,db=db);c=catalog(db);apply(db,error='0028');assert catalog(db)==c
check('fresh table/type/function homonyms and unknown default ACL refused transactionally')
# All concurrent calls use different psql sessions; no process-local lock.
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
    rows=list(ex.map(lambda _:rpc(buyer('concurrent_order','concurrent@example.invalid')),range(6)))
assert len({r['user_id'] for r in rows})==1 and sum(r['applied'] for r in rows)==1
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
    claims=list(ex.map(lambda n:claim(invite('concurrent_order','concurrent@example.invalid',f'concurrent-token-{n}')),range(4)))
assert sum(c['claimed'] for c in claims)==1
check('6 same-order concurrent transactions create ONE user/binding; 4 concurrent invite claims send once')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
    rows=list(ex.map(lambda n:rpc(buyer('email_order_'+str(n),' SAMEEMAIL@EXAMPLE.INVALID ' if n%2 else 'sameemail@example.invalid')),range(3)))
assert len({r['user_id'] for r in rows})==1 and sum(r['created'] for r in rows)==1
check('different-order case/trim concurrent RPCs create ONE user; subsequent bindings no manual-account invitation')
# A REST insert that acquired ROW EXCLUSIVE first is serialized BEFORE lookup.
cmd=BASE+['-d','ready','-c',"BEGIN; INSERT INTO users(\"openId\",email,role) VALUES('rest_before',' RESTBEFORE@EXAMPLE.INVALID ','user'); SELECT pg_sleep(1); COMMIT;"]
p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);time.sleep(.2)
r=rpc(buyer('rest_before_order','restbefore@example.invalid'));out,err=p.communicate(timeout=10);assert p.returncode==0,(out,err)
assert not r['created'] and query("SELECT count(*) FROM users WHERE lower(btrim(email))='restbefore@example.invalid'")=='1'
check('REST insert holding table lock FIRST is observed; no second user or invitation')
# Important limitation: REST can have stale pre-lock SELECT. It is NOT rewritten
# by this task; later case-variant insert may create ambiguity, which denies.
query('GRANT USAGE ON SCHEMA public TO service_role')
r=rpc(buyer('rest_after_order','restafter@example.invalid'));query("INSERT INTO users(\"openId\",email,role) VALUES('rest_after',' RESTAFTER@EXAMPLE.INVALID ','user')")
s=snap();rpc(buyer('rest_after_order','restafter@example.invalid'),error='23505');assert snap()==s
claim(invite('rest_after_order','restafter@example.invalid','deny-ambiguous'),error='23505')
matches=json.loads(query("SET ROLE service_role; SELECT rpc_kiwify_blacklist_find_users('restafter@example.invalid')"));assert len(matches)==2
check('documented stale REST pre-read race creates ambiguity only; buyer replay/claim and LIMIT2 identity fail closed')
# Mutation/delete/truncate cannot reassign/remove immutable bindings.
for sql in ["UPDATE kiwify_buyers SET email='evil@example.invalid' WHERE order_id='order_new'",'DELETE FROM kiwify_buyers','TRUNCATE kiwify_buyers']:
    query(sql,error='23514')
check('identity mutation/delete/truncate prohibited')
assert query('SELECT to_jsonb(u) FROM users u WHERE id=1')==manual and query('SELECT to_jsonb(f) FROM synthetic_financial f')==financial
check('manual account/session/name/password/onboarding and synthetic financial remain byte-identical')
(E/'results.json').write_text(json.dumps({'status':'PASS','total':len(results),'checks':results},indent=2)+'\n')
print(f'PASS: {len(results)} checks; PostgreSQL17 disposable, synthetic only.',flush=True)
