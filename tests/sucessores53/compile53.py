#!/usr/bin/env python3
from pathlib import Path
import re,hashlib,json,sys
R=Path(__file__).resolve().parents[2]
CHECK=sys.argv[1:]==['--check']
assert sys.argv[1:] in ([],['--check']), 'usage: compiler [--check]'
def emit(path,text):
 if CHECK:
  assert path.read_text()==text, 'generated output drift: '+str(path)
  print('CHECK',str(path.relative_to(R)),hashlib.sha256(text.encode()).hexdigest())
 else:path.write_text(text)
def functions(s):
 return list(re.finditer(r'CREATE (?:OR REPLACE )?FUNCTION\s+([\w.]+)\((.*?)\)\s+RETURNS\b.*?AS (\$\w*\$)(.*?)\3;',s,re.S))
def hash(s):return hashlib.sha256(s.encode()).hexdigest()
# Resolve actual predecessor definitions in installation order, not blind old-pin replacement.
expected={'drizzle/0051_composicao_obrigacoes.sql':'4df5a5b8fe7b3f0ed88be71e9376779e79a3c24f5a043fc64f7813dda6c18365','drizzle/0052_inclusao_expandida.sql':'9ef96a0b0daed0e3994a3ae70ab5d29365000724d9be6224c617725312c11556'}
assert hashlib.sha256((R/'drizzle/0047_reparcelamento_atual.sql').read_bytes()).hexdigest()=='1b0a6e9bac53b00e859db9ef3fe3cd61b21a22401c5156a7e36250eb22a64175', 'frozen compiler53 input: drizzle/0047_reparcelamento_atual.sql'
assert hashlib.sha256((R/'tests/sucessores53/core53.sql').read_bytes()).hexdigest()=='d4838969116698fdb1472873e41dfd5cc83f13fdb0bebfb17e7843616558cb93', 'frozen compiler53 input: tests/sucessores53/core53.sql'
resolved={};provenance={}
for file in ['drizzle/0047_reparcelamento_atual.sql',*expected]:
 source=(R/file).read_text()
 if file in expected:assert hash(source)==expected[file],file
 for m in functions(source):
  if m[1] in ['public.multimodal_guardar','private47.validar']:
   resolved[m[1]]=m[0];provenance[m[1]]={'source':file,'bodySha256':hash(m[4]),'definitionSha256':hash(m[0])}
assert set(resolved)=={'public.multimodal_guardar','private47.validar'}
emit(R/'tests/sucessores53/predecessor5253.json',json.dumps({'chain':expected,'resolved':provenance},indent=2)+'\n')
old='\n'.join(resolved.values())
changes=[];pins=[]
for m in functions(old):
 if m[1] not in ['public.multimodal_guardar','private47.validar']:continue
 body=m[4]
 if m[1]=='public.multimodal_guardar':new=body.replace('BEGIN','BEGIN\n IF sucessores53.consumir(TG_NAME,TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP=\'INSERT\' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP=\'DELETE\' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW;END IF;',1)
 else:new=body.replace('BEGIN','BEGIN\n IF EXISTS(SELECT 1 FROM sucessores53.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL LIMIT 1) THEN RETURN sucessores53.replay(uid,cid,public.multimodal_snapshot(cid));END IF;',1)
 changes.append(m[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1).replace(m[3]+body+m[3],m[3]+new+m[3]))
 pins.append({'name':m[1],'old':hash(body),'new':hash(new)})
core=(R/'tests/sucessores53/core53.sql').read_text()
newpins=[{'name':m[1],'body':hash(m[4])} for m in functions(core)]
pre="""-- 0053 private composition on certified51 then exact52. Exact two role profiles; INSTALL ONLY.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261126,53);
SELECT pg_advisory_xact_lock(20261126,51);
LOCK TABLE public.contratos,public.parcelas,public.transacoes_caixa,public.contrato_historico,public.multimodal_operacoes,public.multimodal_estados,public.multimodal_origens,public.contas_caixa,private47.cadeia,private47.operacoes,private47.recebimentos IN SHARE ROW EXCLUSIVE MODE;
DO $pre53$ DECLARE role_profile53 jsonb;BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '53 PG17 owner/session/isolation required' USING ERRCODE='55000';END IF;
 -- Exact install-only profiles: private fixture or confirmed Supabase. Never ALTER ROLE.
 SELECT jsonb_object_agg(rolname,jsonb_build_array(rolsuper,rolbypassrls,rolcanlogin)) INTO role_profile53 FROM pg_roles WHERE rolname IN('postgres','service_role','anon','authenticated');
 IF role_profile53 IS NULL OR role_profile53 NOT IN ('{"anon":[false,false,false],"authenticated":[false,false,false],"postgres":[false,false,true],"service_role":[false,false,false]}'::jsonb,'{"anon":[false,false,false],"authenticated":[false,false,false],"postgres":[false,true,true],"service_role":[false,true,false]}'::jsonb) THEN RAISE EXCEPTION '53 install role profile mismatch' USING ERRCODE='55000';END IF;
 IF to_regnamespace('sucessores53') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_proc WHERE proname IN('rpc_cotar_sucessores53','rpc_executar_sucessores53','rpc_conferir_sucessores53','rpc_estado_sucessores53') LIMIT 1) THEN RAISE EXCEPTION '53 one-shot/homônimo recusado' USING ERRCODE='55000';END IF;
 PERFORM obrigacoes51.verificar();
 PERFORM inclusao52.verificar();
END $pre53$;
CREATE TEMP TABLE witness53_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) snapshot,n.nspname||'.'||p.proname name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions');
CREATE TEMP TABLE witness53_catalog ON COMMIT DROP AS SELECT
 (SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY oid) FROM pg_class c WHERE relnamespace NOT IN(SELECT oid FROM pg_namespace WHERE nspname ~ '^pg_(temp|toast_temp)_')) relations,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE relnamespace NOT IN(SELECT oid FROM pg_namespace WHERE nspname ~ '^pg_(temp|toast_temp)_')) attributes,
 (SELECT jsonb_agg(to_jsonb(k) ORDER BY oid) FROM pg_constraint k WHERE connamespace NOT IN(SELECT oid FROM pg_namespace WHERE nspname ~ '^pg_(temp|toast_temp)_')) constraints,
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE relnamespace NOT IN(SELECT oid FROM pg_namespace WHERE nspname ~ '^pg_(temp|toast_temp)_')) triggers,
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p) policies;
CREATE TEMP TABLE witness53_financial ON COMMIT DROP AS SELECT jsonb_build_object(
 'contratos',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.contratos x),'parcelas',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.parcelas x),
 'contas',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.contas_caixa x),'ledger',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.transacoes_caixa x),'history',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.contrato_historico x),
 'chain47',(SELECT jsonb_agg(to_jsonb(x) ORDER BY origem_id) FROM private47.cadeia x),'ops47',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM private47.operacoes x),'receipts47',(SELECT jsonb_agg(to_jsonb(x) ORDER BY operacao_id) FROM private47.recebimentos x),'ops35',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.multimodal_operacoes x),'ops51',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM obrigacoes51.operacoes x)) snapshot;
"""
pre+="DO $old53$ DECLARE e jsonb;BEGIN FOR e IN SELECT value FROM jsonb_array_elements('"+json.dumps(pins,separators=(',',':'))+"'::jsonb) LOOP IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name')<>1 OR (SELECT encode(extensions.digest(p.prosrc,'sha256'),'hex') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name') IS DISTINCT FROM e->>'old' THEN RAISE EXCEPTION '53 predecessor static pin drift' USING ERRCODE='55000';END IF;END LOOP;END $old53$;\n"
post="""DO $after53$ DECLARE e jsonb;v jsonb;w record;BEGIN
 FOR w IN SELECT * FROM witness53_functions LOOP
 SELECT to_jsonb(p) INTO v FROM pg_proc p WHERE oid=w.oid;
 IF w.name=ANY(ARRAY['public.multimodal_guardar','private47.validar']) THEN
 IF v-'prosrc' IS DISTINCT FROM w.snapshot-'prosrc' THEN RAISE EXCEPTION '53 changed config/ACL/signature outside prosrc' USING ERRCODE='55000';END IF;
 ELSE IF v IS DISTINCT FROM w.snapshot THEN RAISE EXCEPTION '53 old function not preserved %',w.name USING ERRCODE='55000';END IF;END IF;
 END LOOP;
"""
post+=" FOR e IN SELECT value FROM jsonb_array_elements('"+json.dumps(pins,separators=(',',':'))+"'::jsonb) LOOP IF (SELECT encode(extensions.digest(p.prosrc,'sha256'),'hex') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name') IS DISTINCT FROM e->>'new' THEN RAISE EXCEPTION '53 new delta static pin drift' USING ERRCODE='55000';END IF;END LOOP;\n"
post+=" FOR e IN SELECT value FROM jsonb_array_elements('"+json.dumps(newpins,separators=(',',':'))+"'::jsonb) LOOP IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name')<>1 OR (SELECT encode(extensions.digest(p.prosrc,'sha256'),'hex') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name') IS DISTINCT FROM e->>'body' THEN RAISE EXCEPTION '53 new function static pin drift' USING ERRCODE='55000';END IF;END LOOP;\n"
post+=""" IF EXISTS(SELECT 1 FROM witness53_catalog wc CROSS JOIN jsonb_array_elements(wc.relations) entry53 LEFT JOIN pg_class c ON c.oid=(entry53->>'oid')::oid WHERE (to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']) IS DISTINCT FROM entry53) OR EXISTS(SELECT 1 FROM witness53_catalog wc CROSS JOIN jsonb_array_elements(wc.attributes) entry53 LEFT JOIN pg_attribute a ON a.attrelid=(entry53->>'attrelid')::oid AND a.attnum=(entry53->>'attnum')::smallint WHERE to_jsonb(a) IS DISTINCT FROM entry53) OR EXISTS(SELECT 1 FROM witness53_catalog wc CROSS JOIN jsonb_array_elements(wc.constraints) entry53 LEFT JOIN pg_constraint k ON k.oid=(entry53->>'oid')::oid WHERE to_jsonb(k) IS DISTINCT FROM entry53) OR EXISTS(SELECT 1 FROM witness53_catalog wc CROSS JOIN jsonb_array_elements(wc.triggers) entry53 LEFT JOIN pg_trigger t ON t.oid=(entry53->>'oid')::oid WHERE to_jsonb(t) IS DISTINCT FROM entry53) OR EXISTS(SELECT 1 FROM witness53_catalog wc CROSS JOIN jsonb_array_elements(wc.policies) entry53 LEFT JOIN pg_policy pol ON pol.oid=(entry53->>'oid')::oid WHERE to_jsonb(pol) IS DISTINCT FROM entry53) THEN RAISE EXCEPTION '53 old catalog relation/attribute/constraint/trigger/policy drift' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM sucessores53.operacoes) OR EXISTS(SELECT 1 FROM sucessores53.capacidades) OR EXISTS(SELECT 1 FROM sucessores53.fences) THEN RAISE EXCEPTION '53 installation cannot create financial events' USING ERRCODE='55000';END IF;
 IF (SELECT snapshot FROM witness53_financial) IS DISTINCT FROM jsonb_build_object(
 'contratos',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.contratos x),'parcelas',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.parcelas x),
 'contas',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.contas_caixa x),'ledger',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.transacoes_caixa x),'history',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.contrato_historico x),
 'chain47',(SELECT jsonb_agg(to_jsonb(x) ORDER BY origem_id) FROM private47.cadeia x),'ops47',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM private47.operacoes x),'receipts47',(SELECT jsonb_agg(to_jsonb(x) ORDER BY operacao_id) FROM private47.recebimentos x),'ops35',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.multimodal_operacoes x),'ops51',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM obrigacoes51.operacoes x)) THEN RAISE EXCEPTION '53 installation financial drift' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c WHERE relnamespace='sucessores53'::regnamespace AND relkind='r' AND (NOT relrowsecurity OR has_table_privilege('service_role',oid,'SELECT,INSERT,UPDATE,DELETE'))) OR has_schema_privilege('service_role','sucessores53','USAGE') THEN RAISE EXCEPTION '53 private ACL/RLS invalid' USING ERRCODE='55000';END IF;
END $after53$;
-- INSTALL ONLY repin, after static source witnesses; no runtime branch performs these operations.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
UPDATE manutencao44.manifesto SET assinatura=manutencao44.metadata() WHERE id=1;
UPDATE calendario46.manifesto SET assinatura=calendario46.metadata() WHERE id=1;
ALTER TABLE private47.manifesto DISABLE TRIGGER imutavel47;
UPDATE private47.manifesto m SET predecessoras=(SELECT jsonb_object_agg(e.key,to_jsonb(p)) FROM jsonb_each(m.predecessoras) e JOIN pg_proc p ON p.oid=e.key::oid),assinatura=private47.metadata() WHERE id=1;
ALTER TABLE private47.manifesto ENABLE TRIGGER imutavel47;
DO $install_sig47$ DECLARE sig text;BEGIN sig:=private47.metadata();ALTER TABLE private47.manifesto DISABLE TRIGGER imutavel47;UPDATE private47.manifesto SET assinatura=sig WHERE id=1;ALTER TABLE private47.manifesto ENABLE TRIGGER imutavel47;END $install_sig47$;
UPDATE manutencao48.manifesto SET assinatura=manutencao48.metadata() WHERE id=1;
UPDATE obrigacoes51.manifesto SET assinatura=obrigacoes51.metadata() WHERE id=1;
INSERT INTO sucessores53.manifesto VALUES(1,sucessores53.metadata());
SELECT sucessores53.verificar();
COMMIT;
"""
emit(R/'drizzle/0053_sucessores_financeiros.sql',pre+core+'\n'+'\n'.join(changes)+'\n'+post)
emit(R/'tests/sucessores53/function-deltas.json',json.dumps({'changed':pins,'new':newpins},indent=2)+'\n')
