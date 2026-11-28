"""Only file generation. Never connects to a database or runs application code."""
from pathlib import Path
import re, json, hashlib
root = Path(__file__).resolve().parents[2]
p = root / 'drizzle/0069_substituicao_valor_despesa.sql'
s = p.read_text()
checks = ' '.join('PERFORM '+f+'();' for f in ['public.legados_verificar','public.multimodal_verificar','public.multa36_verificar','public.caixa37_verificar','despesa_cancelamento_v1.verificar','telefone41.verificar','manutencao44.verificar','caixa_manutencao45.verificar','calendario46.verificar','private47.verificar','manutencao48.verificar','despesas49.verificar','obrigacoes51.verificar','inclusao52.verificar','sucessores53.verificar','emprestimos_lista60.verificar'])
old = (root/'drizzle/0049_manutencao_despesas.sql').read_text()
meta = old[old.index('CREATE FUNCTION despesas49.metadata()'):old.index('CREATE FUNCTION despesas49.verificar()')].replace('despesas49','despesas69').replace('despesa49','despesa69').replace("'rpc_capacidades_despesas69'", "'rpc_capacidades_despesas69','rpc_linhagem_despesas69'")
s = s.replace('-- METADATA69_GENERATED', meta.rstrip())
# Predecessor expression is pinned and reused verbatim. Only the new facade OIDs may be removed.
source37 = (root/'drizzle/0037_rpc_aporte_transferencia_caixa.sql').read_text()
expr = source37[source37.index(' SELECT public.caixa37_hash(jsonb_build_object('):source37.index('\n$$;',source37.index('CREATE FUNCTION public.caixa37_metadata()'))]
facades = ['public.rpc_cotar_edicao_despesa69(integer,integer)','public.rpc_editar_despesa69(integer,uuid,jsonb)','public.rpc_recuperar_edicao_despesa69(integer,uuid,jsonb)','public.rpc_capacidades_despesas69()','public.rpc_linhagem_despesas69(integer,integer)']
oids = 'ARRAY['+','.join("'"+x+"'::regprocedure" for x in facades)+']'
expr = expr.replace("WHERE p.pronamespace='public'::regnamespace OR p.proname LIKE 'caixa37\\_%' ESCAPE '\\' OR p.proname LIKE 'rpc\\_%caixa37' ESCAPE '\\'", "WHERE (p.pronamespace='public'::regnamespace OR p.proname LIKE 'caixa37\\_%' ESCAPE '\\' OR p.proname LIKE 'rpc\\_%caixa37' ESCAPE '\\') AND p.oid<>ALL("+oids+")")
pins = {'public.caixa37_metadata()':'088bced7e8df832b95b32a44f83c2d19450eaa076c487179df54b410dd224280','obrigacoes51.verificar()':'8f587261d12bad22e26b6a3381f2c8004c6ab950faf1a9c3dd5e6932778e7074','despesas49.validar(integer,integer)':'95551d42ebf9d0d7a6a70e8fe885f59dff0ec3bb35579faec81244afcaef4c70'}
# Entire old object rows, including sources/ACLs/config; no pg_temp objects.
catalog = """SELECT 'class' kind,c.oid::text k,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'attribute',a.attrelid::text||':'||a.attnum,to_jsonb(a) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'constraint',c.oid::text,to_jsonb(c) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'trigger',t.oid::text,to_jsonb(t) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'policy',p.oid::text,to_jsonb(p) FROM pg_policy p
 UNION ALL SELECT 'default',d.oid::text,to_jsonb(d) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'index',i.indexrelid::text,to_jsonb(i) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'namespace',oid::text,to_jsonb(n) FROM pg_namespace n WHERE nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'role',oid::text,to_jsonb(r) FROM pg_roles r
 UNION ALL SELECT 'member',roleid::text||':'||member,to_jsonb(m) FROM pg_auth_members m
 UNION ALL SELECT 'defaultacl',oid::text,to_jsonb(d) FROM pg_default_acl d
 UNION ALL SELECT 'type',t.oid::text,to_jsonb(t) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'setting',setdatabase::text||':'||setrole,to_jsonb(d) FROM pg_db_role_setting d"""
pre = """DO $pre69$ BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR to_regnamespace('despesas69') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_proc WHERE proname IN('rpc_cotar_edicao_despesa69','rpc_editar_despesa69','rpc_recuperar_edicao_despesa69','rpc_capacidades_despesas69','rpc_linhagem_despesas69')) THEN RAISE EXCEPTION '69 baseline/contexto/namespace incompatível' USING ERRCODE='55000'; END IF;
""" + checks + '\n'
for sig, h in pins.items(): pre += f" IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='{sig}'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '{h}' THEN RAISE EXCEPTION '69 predecessor pinado divergente' USING ERRCODE='55000'; END IF;\n"
pre += """END $pre69$;
CREATE TEMP TABLE witness69_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) snapshot FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_temp_%';
CREATE TEMP TABLE witness69_catalog ON COMMIT DROP AS """ + catalog + ";\n" + """CREATE TEMP TABLE witness69_data(rel oid PRIMARY KEY,snapshot jsonb) ON COMMIT DROP;
DO $data69$ DECLARE r record;j jsonb;projection text; BEGIN
 FOR r IN SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','extensions') LOOP
  EXECUTE format('LOCK TABLE %s IN SHARE MODE',r.oid::regclass);
  projection:=CASE WHEN r.oid='public.caixa37_manifesto'::regclass THEN 'to_jsonb(x)-''assinatura''' ELSE 'to_jsonb(x)' END;
  EXECUTE format('SELECT coalesce(jsonb_agg(%s ORDER BY (%s)::text),''[]''::jsonb) FROM %s x',projection,projection,r.oid::regclass) INTO j;
  INSERT INTO witness69_data VALUES(r.oid,j);
 END LOOP;
END $data69$;
CREATE TEMP TABLE witness69_seal ON COMMIT DROP AS SELECT assinatura FROM public.caixa37_manifesto WHERE id=1;
"""
if '-- PRE69_GENERATED' in s:
 s = s.replace('-- PRE69_GENERATED',pre.rstrip())
else:
 s = s[:s.index('DO $pre69$')] + pre.rstrip() + '\n' + s[s.index('CREATE SCHEMA despesas69'):]
entries = []
for m in re.finditer(r'CREATE FUNCTION ([\w.]+)\((.*?)\) RETURNS (.*?) AS \$\$(.*?)\$\$;',s,re.S):
 name,args,options,body = m.groups()
 config = ['search_path=pg_catalog, pg_temp'] + (["TimeZone=UTC"] if "SET TimeZone='UTC'" in options else [])
 types = ', '.join(a.strip().split(' ',1)[1] for a in args.split(',') if a.strip())
 result_type = options.split(' LANGUAGE ',1)[0]
 entries.append({'name':name,'sha256':hashlib.sha256(body.encode()).hexdigest(),'argtypes':types,'result':result_type,'secdef':'SECURITY DEFINER' in options,'config':config})
assert len(entries)==21, len(entries)
post = """DO $post69$ DECLARE old text;derived text;expected text;nr integer;witness_row record;j jsonb;projection text;e jsonb; BEGIN
 SELECT assinatura INTO STRICT old FROM witness69_seal;
 IF EXISTS(SELECT 1 FROM witness69_functions w LEFT JOIN pg_proc p ON p.oid=w.oid WHERE p.oid IS NULL OR to_jsonb(p) IS DISTINCT FROM w.snapshot) THEN RAISE EXCEPTION '69 old functions changed' USING ERRCODE='55000'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements('"""+json.dumps(entries,separators=(',',':'))+"""'::jsonb) LOOP
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name')<>1 OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name' AND p.proowner='postgres'::regrole AND p.prosecdef=(e->>'secdef')::boolean AND oidvectortypes(p.proargtypes)=e->>'argtypes' AND pg_get_function_result(p.oid)=e->>'result' AND p.prokind='f' AND p.prolang IN(SELECT oid FROM pg_language WHERE lanname IN('sql','plpgsql')) AND to_jsonb(p.proconfig)=e->'config' AND encode(extensions.digest(p.prosrc,'sha256'),'hex')=e->>'sha256') THEN RAISE EXCEPTION '69 new function unknown %',e->>'name' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_temp_%' AND NOT EXISTS(SELECT 1 FROM witness69_functions w WHERE w.oid=p.oid))<>21 THEN RAISE EXCEPTION '69 extra function' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM witness69_catalog w LEFT JOIN ("""+catalog+""") a ON a.kind=w.kind AND a.k=w.k WHERE a.snapshot IS DISTINCT FROM w.snapshot) THEN RAISE EXCEPTION '69 old catalog changed' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='despesas69' AND a.grantee<>n.nspowner)
 OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::\"char\" ELSE 'r'::\"char\" END,c.relowner))) a WHERE c.relnamespace='despesas69'::regnamespace AND a.grantee<>c.relowner)
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE (n.nspname='despesas69' OR p.oid=ANY("""+oids+""")) AND a.grantee<>p.proowner AND NOT(n.nspname='public' AND a.grantee='service_role'::regrole AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)) THEN RAISE EXCEPTION '69 inherited/extra ACL unknown' USING ERRCODE='55000'; END IF;
"""+expr.rstrip(';')+" INTO derived;\n"+""" IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_' AND NOT EXISTS(SELECT 1 FROM witness69_catalog w WHERE w.kind='class' AND w.k=c.oid::text) AND c.relnamespace<>'despesas69'::regnamespace AND NOT(c.oid IN(SELECT reltoastrelid FROM pg_class WHERE relnamespace='despesas69'::regnamespace) OR c.oid IN(SELECT indexrelid FROM pg_index WHERE indrelid IN(SELECT reltoastrelid FROM pg_class WHERE relnamespace='despesas69'::regnamespace)))) THEN RAISE EXCEPTION '69 relation outside exact allowlist' USING ERRCODE='55000'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='despesas69'::regnamespace AND relkind='r')<>3 OR (SELECT count(*) FROM pg_class WHERE relnamespace='despesas69'::regnamespace)<>10
 OR (SELECT count(*) FROM pg_constraint WHERE connamespace='despesas69'::regnamespace)<>13
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas69'::regnamespace))<>7
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas69'::regnamespace))
 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='despesas69'::regnamespace AND relkind='r' AND (NOT relrowsecurity OR relowner<>'postgres'::regrole))
 OR (SELECT array_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid='despesas69.operacoes'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM ARRAY['user_id','chave','operation_id','despesa_id','raiz_id','sucessora_id','sucessora_operation_id','filha_chave','status','request','hash_request','antes','depois','sucessora','valor_anterior','valor_novo','motivo','resultado','instante']::name[] THEN RAISE EXCEPTION '69 new object shape/allowlist unknown' USING ERRCODE='55000',DETAIL=jsonb_build_object('tables',(SELECT count(*) FROM pg_class WHERE relnamespace='despesas69'::regnamespace AND relkind='r'),'classes',(SELECT count(*) FROM pg_class WHERE relnamespace='despesas69'::regnamespace),'constraints',(SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE connamespace='despesas69'::regnamespace),'triggers',(SELECT count(*) FROM pg_trigger WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas69'::regnamespace)),'columns',(SELECT array_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid='despesas69.operacoes'::regclass AND attnum>0 AND NOT attisdropped))::text; END IF;
 IF derived IS DISTINCT FROM old THEN RAISE EXCEPTION '69 exact delta37 failed; cannot reseal drift' USING ERRCODE='55000'; END IF;
 expected:=public.caixa37_metadata();
 UPDATE public.caixa37_manifesto SET assinatura=expected WHERE id=1 AND assinatura=old;
 GET DIAGNOSTICS nr=ROW_COUNT; IF nr<>1 THEN RAISE EXCEPTION '69 CAS37 failed' USING ERRCODE='55000'; END IF;
 FOR witness_row IN SELECT * FROM witness69_data LOOP
  projection:=CASE WHEN witness_row.rel='public.caixa37_manifesto'::regclass THEN 'to_jsonb(x)-''assinatura''' ELSE 'to_jsonb(x)' END;
  EXECUTE format('SELECT coalesce(jsonb_agg(%s ORDER BY (%s)::text),''[]''::jsonb) FROM %s x',projection,projection,witness_row.rel::regclass) INTO j;
  IF j IS DISTINCT FROM witness_row.snapshot THEN RAISE EXCEPTION '69 changed existing data %',witness_row.rel::regclass USING ERRCODE='55000'; END IF;
 END LOOP;
 INSERT INTO despesas69.manifesto VALUES(1,despesas69.metadata());
"""+checks+"""
 PERFORM despesas69.verificar();
 -- Own capability ON only after intact metadata/postflight, no old flag flips.
 PERFORM despesas69.configurar(true);
 IF EXISTS(SELECT 1 FROM despesas69.operacoes) OR NOT despesas69.habilitado() THEN RAISE EXCEPTION '69 installation state invalid' USING ERRCODE='55000'; END IF;
END $post69$;
"""
if '-- POST69_GENERATED' in s:
 s = s.replace('-- POST69_GENERATED',post.rstrip())
else:
 s = s[:s.index('DO $post69$')] + post.rstrip() + "\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n"
p.write_text(s)
print('File generation only: 21 definitions pinned; 5 new public OIDs excluded from exact delta37.')
