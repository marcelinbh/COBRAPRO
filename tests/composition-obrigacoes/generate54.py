#!/usr/bin/env python3
"""Compile only verificar51 from pinned HEAD-c6 sources. No database/network access."""
import hashlib,json,re
from pathlib import Path
R=Path(__file__).resolve().parents[2]
H=lambda s:hashlib.sha256(s.encode()).hexdigest()
paths=['0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa','0037_rpc_aporte_transferencia_caixa','0044_manutencao_emprestimos','0045_caixa_manutencao_observacao_auditada','0046_calendario25_governado','0047_reparcelamento_atual','0048_manutencao25_governada','0049_manutencao_despesas','0038c_cancelamento_pendente_isolado','0051_composicao_obrigacoes']
pattern=re.compile(r'CREATE(?: OR REPLACE)? FUNCTION ([\w.]+)\((.*?)\) RETURNS (.*?) AS (\$\w*\$)(.*?)\4;',re.S)
funcs={};files={}
frozen=json.loads((R/'tests/composition-obrigacoes/predecessor-sources.json').read_text())
frozen['drizzle/0051_composicao_obrigacoes.sql']='4df5a5b8fe7b3f0ed88be71e9376779e79a3c24f5a043fc64f7813dda6c18365'
for p in paths:
 f=R/'drizzle'/f'{p}.sql';s=f.read_text();files[str(f.relative_to(R))]=H(s);assert frozen[str(f.relative_to(R))]==H(s),str(f)
 for m in pattern.finditer(s):funcs[m[1]]={'body':m[5],'header':m[0].split(' AS ')[0],'path':str(f.relative_to(R)),'return':m[3],'args':m[2]}
root='obrigacoes51.verificar'
names=['public.legados_verificar','public.multimodal_verificar','public.multa36_verificar','public.caixa37_verificar','manutencao44.verificar','caixa_manutencao45.verificar','calendario46.verificar','private47.verificar','manutencao48.verificar','despesas49.verificar','despesa_cancelamento_v1.verificar',root]
for n in names:
 assert funcs[n]['return']=='void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp',n
 assert not re.search(r'\b(?:RETURN|EXIT|EXCEPTION\s+WHEN)\b',funcs[n]['body'],re.I),n
calls=re.compile(r'PERFORM\s+([\w.]+)\(\);')
seen=set();order=[];removed=[]
def compile_body(n):
 assert n not in seen;seen.add(n);order.append(n)
 def sub(m):
  child=m[1];assert child in names,(n,child)
  if child in seen:removed.append({'parent':n,'child':child});return ''
  return '-- inherited '+child+'; identical function context pinned at installation\n'+compile_body(child)
 body=calls.sub(sub,funcs[n]['body'])
 # Every inherited block preserves its own DECLARE scope. Only call statements
 # are eliminated/substituted; the body text and guards otherwise remain exact.
 return body.rstrip().removesuffix(';')+';'
body=compile_body(root)+'\n'
assert len(seen)==12
newddl='CREATE OR REPLACE FUNCTION obrigacoes51.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $verify54$'+body+'$verify54$;'
s51=(R/'drizzle/0051_composicao_obrigacoes.sql').read_text()
# Reuse genuine certified installation pins; replace only explicit install51 successors.
arrays=[json.loads(m[1]) for m in re.finditer(r"jsonb_array_elements\('(\[.*?\])'(?:\:\:jsonb)?\)",s51,re.S)]
arrays=[a for a in arrays if a and isinstance(a[0],dict) and "bodyHash" in a[0]]
assert len(arrays)==3 and arrays[0]==arrays[1]
arrays=[arrays[0],arrays[-1]]
pins={(x['namespace'],x['name'],x['args']):x.copy() for x in arrays[0]}
for x in arrays[1]:
 existing=[k for k in pins if k[:2]==(x['namespace'],x['name'])]
 assert len(existing)<=1,(x,existing)
 args=re.sub(r',\s*',', ',re.sub(r' DEFAULT [^,]+','',funcs[x['namespace']+'.'+x['name']]['args'],flags=re.I)).replace('timestamptz','timestamp with time zone')
 k=existing[0] if existing else (x['namespace'],x['name'],args)
 pins[k]={**pins.get(k,{}),**x,'args':k[2]}
for n in names:
 x=pins[(*n.split('.'),'')];assert x['bodyHash']==H(funcs[n]['body']),(n,x['bodyHash'],H(funcs[n]['body']))
for x in pins.values():
 x.pop('sourceHash',None)
 if 'acl' not in x:x['acl']='{postgres=X/postgres,service_role=X/postgres}' if x['namespace']=='public' and x['name'].startswith('rpc_') else '{postgres=X/postgres}'
pins=list(pins.values())
metas=['public.legados_metadata','public.multimodal_metadata','public.multa36_metadata','public.caixa37_metadata','manutencao44.metadata','caixa_manutencao45.metadata','calendario46.metadata','private47.metadata','manutencao48.metadata','despesa_cancelamento_v1.metadata','despesas49.metadata']
metadata_expr="jsonb_build_array("+','.join(n+'()' for n in metas)+')'
# Derive expected self51 seal from the original exact metadata source, replacing
# only its pg_proc aggregation with the permitted single prosrc delta.
oldagg="jsonb_agg(to_jsonb(p) ORDER BY p.oid)"
assert oldagg+' FROM pg_proc p' in funcs['obrigacoes51.metadata']['body']
expected=funcs['obrigacoes51.metadata']['body'].strip().removesuffix(';').replace(oldagg+' FROM pg_proc p',"jsonb_agg(CASE WHEN p.oid=target THEN to_jsonb(p)||jsonb_build_object('prosrc',newsrc) ELSE to_jsonb(p) END ORDER BY p.oid) FROM pg_proc p")
source_json=json.dumps(pins,ensure_ascii=False,separators=(',',':')).replace("'","''")
sql=f'''-- 0054: HEAD c6b78c549395bb5b06bd58187871d5dac3e9a5d5. Historical DDL51 untouched.
-- Generated by tests/composition-obrigacoes/generate54.py. Install-time only.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261126,51);
SELECT pg_advisory_xact_lock(20261126,54);
LOCK TABLE obrigacoes51.manifesto IN SHARE ROW EXCLUSIVE MODE;
DO $install54$
DECLARE e jsonb; target oid; proc_before jsonb; proc_after jsonb;
 predecessor_before jsonb; expected51 text; oldseal text; pin_count54 integer; role_profile54 jsonb;
 newsrc text := $newsrc54${body}$newsrc54$;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user LIMIT 1) THEN RAISE EXCEPTION '54 PG17 owner roles/isolation incompatible' USING ERRCODE='55000'; END IF;
 -- Exact permitted install-only role profiles: private NOSUPER/NOBYPASS fixture,
 -- or confirmed Supabase postgres/service_role BYPASSRLS baseline. Never ALTER ROLE.
 SELECT jsonb_object_agg(rolname,jsonb_build_array(rolsuper,rolbypassrls,rolcanlogin)) INTO role_profile54 FROM pg_roles WHERE rolname IN('postgres','service_role','anon','authenticated');
 IF role_profile54 NOT IN ('{{"anon":[false,false,false],"authenticated":[false,false,false],"postgres":[false,false,true],"service_role":[false,false,false]}}'::jsonb,'{{"anon":[false,false,false],"authenticated":[false,false,false],"postgres":[false,true,true],"service_role":[false,true,false]}}'::jsonb) THEN RAISE EXCEPTION '54 install role profile mismatch' USING ERRCODE='55000'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements('{source_json}'::jsonb) LOOP
  SELECT count(*) INTO pin_count54 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname=e->>'namespace' AND p.proname=e->>'name' AND pg_get_function_identity_arguments(p.oid)=e->>'args' AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres' LIMIT 1) AND p.prosecdef=(e->>'secdef')::boolean AND to_jsonb(p.proconfig)=e->'config' AND encode(extensions.digest(p.prosrc,'sha256'),'hex')=e->>'bodyHash' AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND p.proacl::text=e->>'acl';
  IF pin_count54<>1 THEN RAISE EXCEPTION '54 preflight source/config/owner/ACL divergente %.%',e->>'namespace',e->>'name' USING ERRCODE='55000'; END IF;
 END LOOP;
 target:='obrigacoes51.verificar()'::regprocedure;
 IF encode(extensions.digest(newsrc,'sha256'),'hex')<>'{H(body)}' THEN RAISE EXCEPTION '54 compiled body pin mismatch' USING ERRCODE='55000'; END IF;
 PERFORM obrigacoes51.verificar(); -- ORIGINAL must pass; no timeout catch/reseal.
 predecessor_before:={metadata_expr};
 SELECT assinatura INTO STRICT oldseal FROM obrigacoes51.manifesto WHERE id=1;
 SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) INTO proc_before FROM pg_proc p;
 {expected} INTO expected51;
 EXECUTE $ddl54${newddl}$ddl54$;
 SELECT jsonb_agg(CASE WHEN p.oid=target THEN to_jsonb(p)||jsonb_build_object('prosrc',(SELECT v->>'prosrc' FROM jsonb_array_elements(proc_before) v WHERE (v->>'oid')::oid=target LIMIT 1)) ELSE to_jsonb(p) END ORDER BY p.oid) INTO proc_after FROM pg_proc p;
 IF proc_after IS DISTINCT FROM proc_before OR (SELECT prosrc FROM pg_proc WHERE oid=target LIMIT 1) IS DISTINCT FROM newsrc THEN RAISE EXCEPTION '54 catalog delta outside exact verificar51.prosrc' USING ERRCODE='55000'; END IF;
 IF {metadata_expr} IS DISTINCT FROM predecessor_before THEN RAISE EXCEPTION '54 predecessor metadata changed; no implicit reseal' USING ERRCODE='55000'; END IF;
 IF obrigacoes51.metadata() IS DISTINCT FROM expected51 THEN RAISE EXCEPTION '54 derived self51 seal mismatch' USING ERRCODE='55000'; END IF;
 UPDATE obrigacoes51.manifesto SET assinatura=expected51 WHERE id=1 AND assinatura=oldseal;
 GET DIAGNOSTICS pin_count54=ROW_COUNT;
 IF pin_count54<>1 THEN RAISE EXCEPTION '54 manifest update cardinality mismatch' USING ERRCODE='55000'; END IF;
 PERFORM obrigacoes51.verificar();
 IF {metadata_expr} IS DISTINCT FROM predecessor_before THEN RAISE EXCEPTION '54 post predecessor drift' USING ERRCODE='55000'; END IF;
END $install54$;
COMMIT;
'''
# SELECT ... INTO must appear before FROM (the metadata SELECT has no outer FROM).
assert 'SELECT obrigacoes51.hash' in sql
(R/'drizzle/0054_verificacao_obrigacoes_deduplicada.sql').write_text(sql)
manifest={'baseCommit':'c6b78c549395bb5b06bd58187871d5dac3e9a5d5','historicalSources':files,'originalBodySha256':H(funcs[root]['body']),'compiledBodySha256':H(body),'compiledDDLSha256':H(sql),'uniqueBodies':order,'removedCallStatements':removed,'contexts':{n:funcs[n]['return'] for n in names},'blocks':{n:{'bodySha256':H(funcs[n]['body']),'path':funcs[n]['path']} for n in names},'allowedCatalogDelta':'obrigacoes51.verificar.prosrc only','allowedDML':'obrigacoes51.manifesto.assinatura only; install-time derived expected hash','pinCount':len(pins)}
(R/'tests/composition-obrigacoes/pins54.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'compiledBodySha256':H(body),'ddlSha256':H(sql),'uniqueBodies':len(seen),'pinCount':len(pins)},indent=2))
