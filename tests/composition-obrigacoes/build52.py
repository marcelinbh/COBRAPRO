#!/usr/bin/env python3
from pathlib import Path
import re,json,hashlib,sys
ROOT=Path(__file__).resolve().parents[2]
CHECK=sys.argv[1:]==['--check']
assert sys.argv[1:] in ([],['--check']), 'usage: compiler [--check]'
def emit(path,text):
 if CHECK:
  assert path.read_text()==text, 'generated output drift: '+str(path)
  print('CHECK',str(path.relative_to(ROOT)),hashlib.sha256(text.encode()).hexdigest())
 else:path.write_text(text)
def body(s,name):
 p=re.search(r'CREATE (?:OR REPLACE )?FUNCTION '+re.escape(name)+r'\(',s)
 if not p:raise Exception(name)
 m=re.search(r'\bAS\s+(\$[A-Za-z0-9_]*\$)',s[p.start():]);start=p.start()+m.end();tag=m[1];end=s.index(tag+';',start)
 return s[p.start():end+len(tag)+1]
s51=(ROOT/'drizzle/0051_composicao_obrigacoes.sql').read_text();s40=(ROOT/'drizzle/0040_cheques_transacionais.sql').read_text();s34=(ROOT/'drizzle/0037_rpc_aporte_transferencia_caixa.sql').read_text()
for rel,expected in {'drizzle/0051_composicao_obrigacoes.sql': '4df5a5b8fe7b3f0ed88be71e9376779e79a3c24f5a043fc64f7813dda6c18365', 'drizzle/0040_cheques_transacionais.sql': 'd829fa99f81b3ec0f023480cad0cdb80a5c704e58c6aed532fc2ad10ec91d1af', 'drizzle/0037_rpc_aporte_transferencia_caixa.sql': '2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334', 'tests/composition-obrigacoes/implementation52.sql': '66bae0cecc612d5ea75d7da0151fde5a54acf6691d0e5a36e9a90d7c8e3d9c56'}.items():
 assert hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==expected, 'frozen compiler52 input: '+rel
changes={}
for name in ['obrigacoes51.base','obrigacoes51.eventos_leitura','obrigacoes51.estado','obrigacoes51.plano','obrigacoes51.replay21','manutencao44.validar','obrigacoes51.cotacao','obrigacoes51.executar']:
 changes[name]=body(s51,name).replace('CREATE FUNCTION ','CREATE OR REPLACE FUNCTION ',1)
for name in ['public.ciclo_guardar','public.legados_guardar']:changes[name]=body(s40,name)
changes['public.legados_validar']=body(s34,'public.legados_validar').replace('CREATE FUNCTION ','CREATE OR REPLACE FUNCTION ',1)
x=changes['obrigacoes51.base'];x=x.replace('DECLARE source text;','DECLARE source text;r jsonb;');x=x.replace(" RETURN jsonb_build_object('origemTipo'"," r:=jsonb_build_object('origemTipo'");x=x.replace('END $$;'," IF EXISTS(SELECT 1 FROM inclusao52.adicionais WHERE contrato_id=cid LIMIT 1) THEN r:=r||jsonb_build_object('adicionais52',(SELECT jsonb_agg(to_jsonb(a) ORDER BY numero) FROM inclusao52.adicionais a WHERE contrato_id=cid));END IF;RETURN r;\nEND $$;");changes['obrigacoes51.base']=x
x=changes['obrigacoes51.eventos_leitura'];x=x.replace('BEGIN\n',"BEGIN\n IF EXISTS(SELECT 1 FROM inclusao52.adicionais WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL AND request->'proposta'->>'acao'='adicionar' AND antes->'financeiro'->'contrato'->>'modalidade' IN('semanal','quinzenal','diario') LIMIT 1) THEN PERFORM inclusao52.verificar();END IF;\n",1);x=x.replace('END $$;'," FOR ev IN SELECT extra.operacao51 FROM inclusao52.adicionais extra WHERE extra.contrato_id=cid ORDER BY extra.numero LOOP PERFORM inclusao52.provar(ev.operacao51);END LOOP;\n FOR ev IN SELECT o.id FROM obrigacoes51.operacoes o WHERE o.contrato_id=cid AND o.resultado IS NOT NULL AND o.request->'proposta'->>'acao'='adicionar' AND o.antes->'financeiro'->'contrato'->>'modalidade' IN('semanal','quinzenal','diario') LOOP PERFORM inclusao52.provar35(ev.id);END LOOP;\nEND $$;");changes['obrigacoes51.eventos_leitura']=x
x=changes['obrigacoes51.estado'];x=x.replace("SELECT valor INTO a FROM obrigacoes51.adicionais WHERE parcela_id=(p->>'id')::int LIMIT 1;","SELECT sum(valor) INTO a FROM (SELECT valor FROM obrigacoes51.adicionais WHERE parcela_id=(p->>'id')::int UNION ALL SELECT valor FROM inclusao52.adicionais WHERE parcela_id=(p->>'id')::int) extras;");changes['obrigacoes51.estado']=x
x=changes['obrigacoes51.plano'];x=x.replace("EXISTS(SELECT 1 FROM obrigacoes51.adicionais WHERE parcela_id=pid LIMIT 1)","(EXISTS(SELECT 1 FROM obrigacoes51.adicionais WHERE parcela_id=pid LIMIT 1) OR EXISTS(SELECT 1 FROM inclusao52.adicionais WHERE parcela_id=pid LIMIT 1))");changes['obrigacoes51.plano']=x
x=changes['obrigacoes51.replay21'];x=x.replace("request->'proposta'->>'acao'='editar'","request->'proposta'->>'acao' IN('editar','adicionar')");x=x.replace(" IF ev.kind='51' THEN", " IF ev.kind='51' AND ev.request->'proposta'->>'acao'='adicionar' THEN\n PERFORM inclusao52.provar(ev.tag::uuid);SELECT linha_inicial INTO STRICT p FROM inclusao52.adicionais WHERE operacao51=ev.tag::uuid LIMIT 1;plan:=inclusao52.plano(s,ev.request->'proposta',stamp,p);expected:=jsonb_set(jsonb_set(expected,'{contrato}',plan->'contrato'),'{parcelas}',(SELECT jsonb_agg(j ORDER BY (j->>'numero')::int,(j->>'id')::int) FROM jsonb_array_elements(plan->'parcelas') j));n:=jsonb_array_length(expected->'parcelas');\n ELSIF ev.kind='51' THEN");changes['obrigacoes51.replay21']=x
x=changes['manutencao44.validar'];x=x.replace("request->'proposta'->>'acao'='editar'","request->'proposta'->>'acao' IN('editar','adicionar')");changes['manutencao44.validar']=x
x=changes['obrigacoes51.cotacao'];x=x.replace(" IF source<>'multimodal35' THEN RAISE EXCEPTION '51 append inicial somente raiz35 genuína' USING ERRCODE='0A000';END IF;\n s:=obrigacoes51.validar_mensal(uid,cid);PERFORM private47.estado_auditado(uid,cid,s);plan:=obrigacoes51.plano(s,v,instante);ids:='{}'::integer[];", " IF source='multimodal35' AND s->'contrato'->>'modalidade'='mensal' THEN\n IF EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid LIMIT 1) THEN RAISE EXCEPTION '52 append não reabre arquivo' USING ERRCODE='23514';END IF;\n s:=obrigacoes51.validar_mensal(uid,cid);PERFORM private47.estado_auditado(uid,cid,s);plan:=obrigacoes51.plano(s,v,instante);\n ELSE s:=inclusao52.validar(uid,cid,s,source);plan:=inclusao52.plano(s,v,instante);END IF;ids:='{}'::integer[];")
x=x.replace("SELECT coalesce(sum(valor),0) INTO additional FROM obrigacoes51.adicionais WHERE contrato_id=cid;","SELECT coalesce(sum(valor),0) INTO additional FROM (SELECT valor FROM obrigacoes51.adicionais WHERE contrato_id=cid UNION ALL SELECT valor FROM inclusao52.adicionais WHERE contrato_id=cid) extras;");changes['obrigacoes51.cotacao']=x
x=changes['obrigacoes51.executar'];x=x.replace(" PERFORM obrigacoes51.travar(uid,cid);", " IF a='adicionar' AND EXISTS(SELECT 1 FROM public.multimodal_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE o.contrato_id=cid AND c.modalidade IN('semanal','quinzenal','diario') LIMIT 1) THEN PERFORM public.multimodal_barreira(uid,'multimodal_manutencao48',k,false);END IF;\n PERFORM obrigacoes51.travar(uid,cid);",1)
x=x.replace("instante:=clock_timestamp();day:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;q:=obrigacoes51.cotacao(uid,cid,v,instante);", "instante:=clock_timestamp();day:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;\n IF a='adicionar' THEN b:=obrigacoes51.base(uid,cid);IF NOT(b->>'origemTipo'='multimodal35' AND b->'financeiro'->'contrato'->>'modalidade'='mensal') AND (r->>'estadoHash' IS DISTINCT FROM obrigacoes51.hash(jsonb_build_object('base',b,'dia',day::text)) OR r->>'dataCalculo' IS DISTINCT FROM day::text) THEN RAISE EXCEPTION '52 cotação/base/BRT expirou antes da elegibilidade' USING ERRCODE='40001';END IF;END IF;\n q:=obrigacoes51.cotacao(uid,cid,v,instante);")
x=x.replace(" IF a IN('adicionar','editar') THEN\n IF source='multimodal35' THEN", " IF a IN('adicionar','editar') THEN\n IF a='adicionar' AND NOT(source='multimodal35' AND s->'contrato'->>'modalidade'='mensal') THEN ids:=inclusao52.adicionar(uid,k,cid,oid51,s,v,r->>'motivo',instante,source);\n ELSIF source='multimodal35' THEN")
x=x.replace('WHERE id=oid51;RETURN closed;',"WHERE id=oid51;IF a='adicionar' AND NOT(source='multimodal35' AND s->'contrato'->>'modalidade'='mensal') THEN IF source='multimodal35' THEN PERFORM inclusao52.provar35(oid51);ELSE PERFORM inclusao52.provar(oid51);END IF;END IF;RETURN closed;");changes['obrigacoes51.executar']=x
for name in ['public.ciclo_guardar','public.legados_guardar']:
 x=changes[name];g=name.split('.')[1];x=x.replace('BEGIN\n',"BEGIN\n IF inclusao52.consumir('"+g+"',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW;END IF;\n",1);changes[name]=x
x=changes['public.legados_validar'];old="IF h.tipo IS NULL OR h.tipo NOT IN('criacao','pagamento') OR (h.tipo='pagamento' AND NOT EXISTS(SELECT 1 FROM public.legados_auditoria WHERE historico_id=h.id AND user_id=uid)) THEN"
new="IF h.tipo='inclusao_obrigacao' THEN IF NOT inclusao52.historico_valido(uid,cid,to_jsonb(h)) THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514';END IF;ELSIF h.tipo IS NULL OR h.tipo NOT IN('criacao','pagamento') OR (h.tipo='pagamento' AND NOT EXISTS(SELECT 1 FROM public.legados_auditoria WHERE historico_id=h.id AND user_id=uid)) THEN";assert old in x;x=x.replace(old,new);changes['public.legados_validar']=x
# Predecessor hashes exact; never derive from live production.
pre=[];post=[]
for name,x in changes.items():
 source=body(s40 if name in ['public.ciclo_guardar','public.legados_guardar'] else s34 if name=='public.legados_validar' else s51,name)
 def hashbody(sql):
  m=re.search(r'\bAS\s+(\$[A-Za-z0-9_]*\$)',sql);return hashlib.sha256(sql[m.end():sql.index(m[1]+';',m.end())].encode()).hexdigest()
 pre.append({'name':name,'bodyHash':hashbody(source),'config':['search_path=pg_catalog, pg_temp']+(['TimeZone=UTC'] if "SET TimeZone='UTC'" in source else [])})
 post.append({'name':name,'bodyHash':hashbody(x),'config':['search_path=pg_catalog, pg_temp']+(['TimeZone=UTC'] if "SET TimeZone='UTC'" in x else [])})
private=(ROOT/'tests/composition-obrigacoes/implementation52.sql').read_text()
for m in re.finditer(r'CREATE FUNCTION ([\w.]+)\(',private):post.append({'name':m[1],'bodyHash':hashbody(body(private,m[1])),'config':['search_path=pg_catalog, pg_temp']+(['TimeZone=UTC'] if "SET TimeZone='UTC'" in body(private,m[1]) else [])})
header='''-- Candidato privado52. One-shot pós51; nenhum DML financeiro install-time.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261126,52);
LOCK TABLE public.contratos,public.parcelas,public.transacoes_caixa,public.contrato_historico,public.contas_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $pre52$ DECLARE e jsonb;role_profile52 jsonb;BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR to_regnamespace('inclusao52') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_proc WHERE proname LIKE '%inclusao52%' LIMIT 1) THEN RAISE EXCEPTION '52 PG17 owner/isolation/one-shot incompatível' USING ERRCODE='55000';END IF;
 -- Exact install-only profiles: private fixture or confirmed Supabase. Never ALTER ROLE.
 SELECT jsonb_object_agg(rolname,jsonb_build_array(rolsuper,rolbypassrls,rolcanlogin)) INTO role_profile52 FROM pg_roles WHERE rolname IN('postgres','service_role','anon','authenticated');
 IF role_profile52 IS NULL OR role_profile52 NOT IN ('{"anon":[false,false,false],"authenticated":[false,false,false],"postgres":[false,false,true],"service_role":[false,false,false]}'::jsonb,'{"anon":[false,false,false],"authenticated":[false,false,false],"postgres":[false,true,true],"service_role":[false,true,false]}'::jsonb) THEN RAISE EXCEPTION '52 install role profile mismatch' USING ERRCODE='55000';END IF;
 PERFORM obrigacoes51.verificar();
 FOR e IN SELECT value FROM jsonb_array_elements('''+"'"+json.dumps(pre,separators=(',',':'))+"'::jsonb) LOOP\n"+''' IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name' AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres' LIMIT 1) AND p.prosecdef AND p.proacl::text='{postgres=X/postgres}' AND encode(extensions.digest(p.prosrc,'sha256'),'hex')=e->>'bodyHash' LIMIT 1) THEN RAISE EXCEPTION '52 predecessor exato divergente %',e->>'name' USING ERRCODE='55000';END IF;END LOOP;
END $pre52$;
CREATE TEMP TABLE witness52_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) snapshot,n.nspname||'.'||p.proname name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions');
CREATE TEMP TABLE witness52_catalog ON COMMIT DROP AS SELECT 'class' kind,c.oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') UNION ALL SELECT 'trigger',oid,to_jsonb(t) FROM pg_trigger t UNION ALL SELECT 'constraint',oid,to_jsonb(c) FROM pg_constraint c UNION ALL SELECT 'policy',oid,to_jsonb(p) FROM pg_policy p UNION ALL SELECT 'default',oid,to_jsonb(d) FROM pg_attrdef d UNION ALL SELECT 'index',indexrelid,to_jsonb(i) FROM pg_index i;
CREATE TEMP TABLE witness52_attributes ON COMMIT DROP AS SELECT attrelid,attnum,to_jsonb(a) snapshot FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions');
'''
footer='''
CREATE FUNCTION inclusao52.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT obrigacoes51.hash(jsonb_build_object('schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='inclusao52'),'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='inclusao52'::regnamespace OR oid=to_regprocedure('public.rpc_capacidade_inclusao52()')),'classes',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY oid) FROM pg_class c WHERE relnamespace='inclusao52'::regnamespace),'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE relnamespace='inclusao52'::regnamespace),'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE connamespace='inclusao52'::regnamespace),'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE relnamespace='inclusao52'::regnamespace),'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE relnamespace='inclusao52'::regnamespace),'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE relnamespace='inclusao52'::regnamespace),'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE relnamespace='inclusao52'::regnamespace)));
$$;
CREATE FUNCTION inclusao52.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN PERFORM obrigacoes51.verificar();IF (SELECT assinatura FROM inclusao52.manifesto WHERE id=1 LIMIT 1) IS DISTINCT FROM inclusao52.metadata() THEN RAISE EXCEPTION '52 catálogo divergente; sem reseal runtime' USING ERRCODE='55000';END IF;END $$;
CREATE FUNCTION public.rpc_capacidade_inclusao52() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN PERFORM inclusao52.verificar();RETURN jsonb_build_object('versao','inclusao52_v1','predecessor','obrigacoes51_v1','disponivel',true,'coortes',jsonb_build_array('prospectivo21_mensal','multimodal35_semanal','multimodal35_quinzenal','multimodal35_diario','legado34_mensal_estrito'),'classificacao','obrigacao_adicional_nao_desembolsada','caixaPreservado',true);END $$;
DO $$ DECLARE p record;t text;BEGIN
 FOR p IN SELECT oid FROM pg_proc WHERE pronamespace='inclusao52'::regnamespace OR oid=to_regprocedure('public.rpc_capacidade_inclusao52()') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.oid::regprocedure);END LOOP;
 GRANT EXECUTE ON FUNCTION public.rpc_capacidade_inclusao52() TO service_role;
 FOREACH t IN ARRAY ARRAY['manifesto','adicionais','capacidades'] LOOP EXECUTE format('ALTER TABLE inclusao52.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON inclusao52.%I FROM PUBLIC,anon,authenticated,service_role',t);END LOOP;
END $$;
'''
for m in re.finditer(r'CREATE FUNCTION ([\w.]+)\(',footer):post.append({'name':m[1],'bodyHash':hashbody(body(footer,m[1])),'config':['search_path=pg_catalog, pg_temp']+(['TimeZone=UTC'] if "SET TimeZone='UTC'" in body(footer,m[1]) else [])})
allow=json.dumps(list(changes),separators=(',',':'))
footer+='''DO $after52$ DECLARE e jsonb;BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('''+"'"+json.dumps(post,separators=(',',':'))+"'::jsonb) LOOP\n"+''' IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name' AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres' LIMIT 1) AND p.prosecdef AND to_jsonb(p.proconfig)=e->'config' AND encode(extensions.digest(p.prosrc,'sha256'),'hex')=e->>'bodyHash' AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND has_function_privilege('service_role',p.oid,'EXECUTE')=(e->>'name'='public.rpc_capacidade_inclusao52') LIMIT 1) THEN RAISE EXCEPTION '52 successor pin/config/ACL divergente %',e->>'name' USING ERRCODE='55000';END IF;END LOOP;
 IF EXISTS(SELECT 1 FROM witness52_functions w LEFT JOIN pg_proc p ON p.oid=w.oid WHERE CASE WHEN '''+"'"+allow+"'::jsonb @> to_jsonb(w.name) THEN to_jsonb(p)-'prosrc' IS DISTINCT FROM w.snapshot-'prosrc' ELSE to_jsonb(p) IS DISTINCT FROM w.snapshot END LIMIT 1) THEN RAISE EXCEPTION '52 predecessor function fora allowlist prosrc' USING ERRCODE='55000';END IF;\n"+'''
 IF EXISTS(SELECT 1 FROM witness52_attributes w LEFT JOIN pg_attribute a ON a.attrelid=w.attrelid AND a.attnum=w.attnum WHERE to_jsonb(a) IS DISTINCT FROM w.snapshot LIMIT 1) THEN RAISE EXCEPTION '52 predecessor rowtype mudou' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM witness52_catalog w LEFT JOIN (SELECT 'class' kind,c.oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c UNION ALL SELECT 'trigger',oid,to_jsonb(t) FROM pg_trigger t UNION ALL SELECT 'constraint',oid,to_jsonb(c) FROM pg_constraint c UNION ALL SELECT 'policy',oid,to_jsonb(p) FROM pg_policy p UNION ALL SELECT 'default',oid,to_jsonb(d) FROM pg_attrdef d UNION ALL SELECT 'index',indexrelid,to_jsonb(i) FROM pg_index i) a ON a.kind=w.kind AND a.oid=w.oid WHERE a.snapshot IS DISTINCT FROM w.snapshot LIMIT 1) THEN RAISE EXCEPTION '52 predecessor catálogo fora allowlist' USING ERRCODE='55000';END IF;
END $after52$;
-- INSTALL ONLY after allowlisted body witnesses; no flags, financial rows or old trails.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
UPDATE manutencao44.manifesto SET assinatura=manutencao44.metadata() WHERE id=1;
UPDATE calendario46.manifesto SET assinatura=calendario46.metadata() WHERE id=1;
ALTER TABLE private47.manifesto DISABLE TRIGGER imutavel47;
UPDATE private47.manifesto m SET predecessoras=(SELECT jsonb_object_agg(e.key,CASE WHEN '''+"'"+allow+"'::jsonb @> to_jsonb(n.nspname||'.'||p.proname) THEN to_jsonb(p) ELSE e.value END) FROM jsonb_each(m.predecessoras) e JOIN pg_proc p ON p.oid=e.key::oid JOIN pg_namespace n ON n.oid=p.pronamespace),assinatura=private47.metadata() WHERE id=1;\n"+'''ALTER TABLE private47.manifesto ENABLE TRIGGER imutavel47;
DO $$ DECLARE sig text;BEGIN sig:=private47.metadata();ALTER TABLE private47.manifesto DISABLE TRIGGER imutavel47;UPDATE private47.manifesto SET assinatura=sig WHERE id=1;ALTER TABLE private47.manifesto ENABLE TRIGGER imutavel47;END $$;
UPDATE manutencao48.manifesto SET assinatura=manutencao48.metadata() WHERE id=1;
UPDATE obrigacoes51.manifesto SET assinatura=obrigacoes51.metadata() WHERE id=1;
INSERT INTO inclusao52.manifesto VALUES(1,inclusao52.metadata());
SELECT inclusao52.verificar();
COMMIT;
'''
# Runtime dispatch fails closed on new metadata too; public wrappers remain byte-exact.
# Preserve exact predecessor bodies; only the private cotacao/executar call52 checks.
for name in ['obrigacoes51.cotacao']:
 old=changes[name];changes[name]=old.replace("IF a='adicionar' THEN","IF a='adicionar' THEN PERFORM inclusao52.verificar();",1)
 for pin in post:
  if pin['name']==name:pin['bodyHash']=hashbody(changes[name])
# rewrite pins in footer after dispatch substitution
start=footer.index("FOR e IN SELECT value FROM jsonb_array_elements('");end=footer.index("'::jsonb) LOOP",start)
footer=footer[:start]+"FOR e IN SELECT value FROM jsonb_array_elements('"+json.dumps(post,separators=(',',':'))+footer[end:]
out=header+private+'\n'+'\n'.join(changes.values())+'\n'+footer
emit(ROOT/'drizzle/0052_inclusao_expandida.sql',out)
emit(ROOT/'tests/composition-obrigacoes/pins52.json',json.dumps({'predecessors':pre,'successors':post,'allowlist':list(changes)},indent=2)+'\n')
print('BUILT52',len(out),'bytes',hashlib.sha256(out.encode()).hexdigest())
