#!/usr/bin/env python3
"""Geração determinística local. Não conecta ao banco nem recalcula baseline confiável.
baseline.json foi capturado com fixture sintético PG17, antes de 0025.
"""
import json,pathlib,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
b=json.loads((ROOT/'tests/postgres-financial-coexistence/baseline.json').read_text())
functions=[{k:v for k,v in f.items() if k!='prosrc'} for f in b['functions']]
tables=b['tables']+[t for t in b['base_tables'] if t['relname'] in ('contas_caixa','contas_pagar','transacoes_caixa')]; tables.sort(key=lambda t:t['relname']); triggers=b['triggers']
def literal(obj):return "'"+json.dumps(obj,ensure_ascii=False,separators=(',',':')).replace("'","''")+"'::jsonb"
# Cinco variantes de catálogo PG17.6 comprovadas; não é parser/regex genérico.
# Chave tabela + constraint + definição completa; somente cast de ARRAY varchar
# inteiro para text[] versus cast text por elemento, mesmos valores/ordem/coluna/=ANY.
constraint_casts={}
for table,column,values in [
 ('contas_caixa','tipo',['caixa','banco','digital']),
 ('contas_pagar','categoria',['aluguel','energia','agua','internet','telefone','salario','imposto','fornecedor','outros']),
 ('contas_pagar','frequencia',['mensal','semanal','quinzenal','anual']),
 ('contas_pagar','status',['pendente','pago','atrasado','cancelado']),
 ('transacoes_caixa','tipo',['entrada','saida'])
]:
 name=f'{table}_{column}_check'
 canonical=f"CHECK ((({column})::text = ANY (ARRAY["+', '.join(f"('{v}'::character varying)::text" for v in values)+"])))"
 variant=f"CHECK ((({column})::text = ANY ((ARRAY["+', '.join(f"'{v}'::character varying" for v in values)+"])::text[])))"
 expected_table=next(t for t in tables if t['relname']==table)
 assert next(c[-1] for c in expected_table['constraints'] if c[0]==name and c[1]=='c')==canonical
 constraint_casts.setdefault(table,{})[name]={variant:canonical}
sql="""-- 0025: integração LOCAL mínima de 0020 + 0021 + 0022; one-shot, fail-closed.
-- Não certifica legado nem autoriza rollout. Nenhuma escrita de dados antigos.
-- Owners devem ser current_user: postgres em produção, ubuntu no fixture sintético.
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(20261107,20);
SELECT pg_catalog.pg_advisory_xact_lock(20261108,25);
DO $preflight$
DECLARE expected jsonb; actual jsonb; constraint_casts jsonb; r record; fid oid; owner_oid oid;
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 THEN RAISE EXCEPTION '0025: requer PostgreSQL17 exato'; END IF;
 SELECT oid INTO owner_oid FROM pg_catalog.pg_roles WHERE rolname=current_user;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN RAISE EXCEPTION '0025: pgcrypto extensions obrigatório'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN('service_role','anon','authenticated') AND (rolsuper OR pg_has_role(oid,owner_oid,'MEMBER'))) THEN RAISE EXCEPTION '0025: caller role privilegiada/owner membership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relname='ciclo_despesas_autorizacoes') THEN RAISE EXCEPTION '0025: capability homônima/reaplicação recusada'; END IF;
 -- Comparação de TODOS os corpos 0020/21/22 e metadados, não apenas nomes.
 expected := @FUNCTIONS@;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.proname IN(SELECT x->>'proname' FROM jsonb_array_elements(expected) x)
   AND (p.pronamespace<>'public'::regnamespace OR p.proowner<>owner_oid)) THEN RAISE EXCEPTION '0025: schema/owner de função incompatível'; END IF;
 SELECT jsonb_agg(jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) ORDER BY p.proname)
 INTO actual FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.proname IN(SELECT x->>'proname' FROM jsonb_array_elements(expected) x);
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0025: corpo/hash/overload/assinatura/configuração incompatível'; END IF;
 FOR r IN SELECT p.* FROM pg_catalog.pg_proc p WHERE p.proname IN(SELECT x->>'proname' FROM jsonb_array_elements(expected) x) LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(r.proacl,pg_catalog.acldefault('f',r.proowner))) g WHERE g.grantee<>owner_oid AND NOT(r.proname LIKE 'rpc_%' AND g.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role') AND g.privilege_type='EXECUTE' AND NOT g.is_grantable))
     OR (r.proname LIKE 'rpc_%' AND NOT has_function_privilege('service_role',r.oid,'EXECUTE'))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_depend WHERE classid='pg_proc'::regclass AND objid=r.oid AND deptype='e') THEN RAISE EXCEPTION '0025: grants/dependência de função incompatível: %',r.proname; END IF;
 END LOOP;
 -- Metadados normalizados sem OIDs: todas colunas/defaults/CHECKs/FKs/índices das trilhas.
 expected := @TABLES@;
 -- Só cinco CHECKs comprovados PG17.6/17.11: whitelist de strings completas.
 -- Não altera baseline, tipos, valores, ordem, coluna, operador, casts desconhecidos ou FKs.
 constraint_casts := @CONSTRAINT_CASTS@;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relname IN(SELECT x->>'relname' FROM jsonb_array_elements(expected) x) AND(c.relnamespace<>'public'::regnamespace OR c.relowner<>owner_oid)) THEN RAISE EXCEPTION '0025: schema/owner de tabela incompatível'; END IF;
 SELECT jsonb_agg(jsonb_build_object('relname',c.relname,'relrowsecurity',c.relrowsecurity,'relforcerowsecurity',c.relforcerowsecurity,'relkind',c.relkind,'relpersistence',c.relpersistence,'relispartition',c.relispartition,
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,co.collname,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_catalog.pg_collation co ON co.oid=a.attcollation WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(conname,contype,convalidated,condeferrable,condeferred,CASE WHEN c.relname IN('contas_caixa','contas_pagar','transacoes_caixa') AND contype='c' THEN coalesce(constraint_casts->c.relname->conname->>pg_get_constraintdef(oid,false),pg_get_constraintdef(oid,false)) ELSE pg_get_constraintdef(oid,false) END) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(x.relname,i.indisunique,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid)) ORDER BY x.relname) FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=c.oid)) ORDER BY c.relname)
 INTO actual FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN(SELECT x->>'relname' FROM jsonb_array_elements(expected) x);
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0025: tabelas/defaults/CHECK/FK/índices incompatíveis'; END IF;
 FOR r IN SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN(SELECT x->>'relname' FROM jsonb_array_elements(expected) x) AND c.relname NOT IN('contas_caixa','contas_pagar','transacoes_caixa') LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(r.relacl,pg_catalog.acldefault('r',r.relowner))) g WHERE g.grantee<>owner_oid AND NOT(r.relname LIKE 'despesas_rpc_%' AND g.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role') AND g.privilege_type='SELECT' AND NOT g.is_grantable))
    OR (r.relname LIKE 'despesas_rpc_%' AND NOT has_table_privilege('service_role',r.oid,'SELECT'))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a,LATERAL pg_catalog.aclexplode(a.attacl) g WHERE a.attrelid=r.oid AND g.grantee<>owner_oid)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=r.oid) THEN RAISE EXCEPTION '0025: grants de tabela/coluna/policy incompatíveis: %',r.relname; END IF;
 END LOOP;
 -- Guardas habilitadas e exatas; qualquer trigger extra no caminho é NO-GO.
 expected := @TRIGGERS@;
 SELECT jsonb_agg(jsonb_build_object('relname',c.relname,'tgname',t.tgname,'def',pg_get_triggerdef(t.oid,false),'tgenabled',t.tgenabled,'tgtype',t.tgtype,'tgconstraint',t.tgconstraint::bigint,'function',t.tgfoid::regprocedure::text) ORDER BY c.relname,t.tgname)
 INTO actual FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal
 AND c.relname IN('contas_caixa','contas_pagar','transacoes_caixa','contratos','parcelas','contrato_historico','despesas_rpc_origens','despesas_rpc_pagamentos','despesas_rpc_operacoes','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_autorizacoes','ciclo_estados','ciclo_operacoes','ciclo_pernas');
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0025: trigger incompatível/desabilitado/extra'; END IF;
 -- Nada de capabilities antigas em aberto: tabela 0022 não é um canal manual.
 IF EXISTS(SELECT 1 FROM public.ciclo_autorizacoes) THEN RAISE EXCEPTION '0025: capability residual 0022'; END IF;
END;
$preflight$;

-- Capacidade transacional privada, restrita a uma única linha exata de despesa.
-- Não altera a capability original 0022 nem permite UPDATE/DELETE ou vínculo loan.
CREATE TABLE public.ciclo_despesas_autorizacoes (
 xid bigint NOT NULL, pid integer NOT NULL,
 acao text NOT NULL CHECK(acao IN('pagar','estornar')),
 conta_id integer NOT NULL REFERENCES public.contas_caixa(id) ON DELETE RESTRICT,
 user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 despesa_id integer NOT NULL REFERENCES public.despesas_rpc_origens(despesa_id) ON DELETE RESTRICT,
 operacao_id uuid NOT NULL,
 esperado jsonb NOT NULL CHECK(jsonb_typeof(esperado)='object'
   AND esperado->>'categoria'='despesa_operacional'
   AND esperado->'contrato_id'='null'::jsonb AND esperado->'parcela_id'='null'::jsonb
   AND ((acao='pagar' AND esperado->>'tipo'='saida') OR(acao='estornar' AND esperado->>'tipo'='entrada'))),
 PRIMARY KEY(xid,pid),
 FOREIGN KEY(operacao_id) REFERENCES public.despesas_rpc_operacoes(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.ciclo_despesas_autorizacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ciclo_despesas_autorizacoes FROM PUBLIC,anon,authenticated,service_role;

-- Overload novo, privado; somente despesas_rpc_executar owner trusted emite.
-- Nenhum proxy genérico executável por service_role. Permissão é ACL, não superuser.
CREATE FUNCTION public.ciclo_autorizar(p_acao text,p_conta integer,p_user integer,p_despesa integer,
 p_operacao uuid,p_valor numeric,p_data date,p_descricao text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $capability$
BEGIN
 IF p_acao IS NULL OR p_acao NOT IN('pagar','estornar') OR p_operacao IS NULL
   OR p_valor IS NULL OR p_valor<=0 OR p_valor::text IN('NaN','Infinity','-Infinity')
   OR scale(p_valor)>2 OR p_data IS NULL OR NOT isfinite(p_data)
   OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=p_conta AND user_id=p_user AND ativo=true)
   OR NOT EXISTS(SELECT 1 FROM public.despesas_rpc_origens o JOIN public.contas_pagar d ON d.id=o.despesa_id WHERE o.despesa_id=p_despesa AND o.user_id=p_user AND d.user_id=p_user AND d.valor=p_valor AND p_descricao=(CASE WHEN p_acao='pagar' THEN 'Pagamento: ' ELSE 'Estorno: ' END)||d.descricao)
 THEN RAISE EXCEPTION '0025: intenção de capability inválida' USING ERRCODE='42501'; END IF;
 INSERT INTO public.ciclo_despesas_autorizacoes(xid,pid,acao,conta_id,user_id,despesa_id,operacao_id,esperado)
 VALUES(txid_current(),pg_backend_pid(),p_acao,p_conta,p_user,p_despesa,p_operacao,
   jsonb_build_object('conta_caixa_id',p_conta,'user_id',p_user,'tipo',CASE WHEN p_acao='pagar' THEN 'saida' ELSE 'entrada' END,
   'categoria','despesa_operacional','descricao',p_descricao,'valor',p_valor::numeric(15,2),'data_transacao',p_data,
   'contrato_id',NULL,'parcela_id',NULL,'createdAt',now()));
 -- Sem ON CONFLICT: nunca substituir capability pendente nem tolerar nesting.
END;
$capability$;
REVOKE ALL ON FUNCTION public.ciclo_autorizar(text,integer,integer,integer,uuid,numeric,date,text) FROM PUBLIC,anon,authenticated,service_role;

@GUARD@

-- Corpo 0020 byte-a-byte preservado, exceto lock global e DUAS emissões abaixo.
@EXPENSE@
REVOKE ALL ON FUNCTION public.despesas_rpc_executar(integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
"""
sql=sql.replace('@FUNCTIONS@',literal(functions)).replace('@TABLES@',literal(tables)).replace('@TRIGGERS@',literal(triggers)).replace('@CONSTRAINT_CASTS@',literal(constraint_casts))
s20=(ROOT/'drizzle/0020_rpc_despesas_prospectivas.sql').read_text(); s22=(ROOT/'drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql').read_text()
expense=s20[s20.index('CREATE OR REPLACE FUNCTION public.despesas_rpc_executar('):s20.index('\nCREATE OR REPLACE FUNCTION public.rpc_criar_despesa_prospectiva(')].strip()
lock='    PERFORM pg_catalog.pg_advisory_xact_lock(22022,v_conta_id); -- 0025: antes do lock de linha da conta\n'
anchor='    SELECT * INTO v_conta FROM public.contas_caixa WHERE id=v_conta_id AND user_id=p_user_id FOR UPDATE;'
assert expense.count(anchor)==1; expense=expense.replace(anchor,lock+anchor)
for action,prefix in [('pagar','Pagamento'),('estornar','Estorno')]:
 anchor="      INSERT INTO public.transacoes_caixa(conta_caixa_id,tipo,categoria,descricao,valor,data_transacao,user_id)\n        VALUES(v_conta_id,'"+('saida' if action=='pagar' else 'entrada')+"','despesa_operacional','"+prefix+": '||v_d.descricao"
 assert expense.count(anchor)==1
 call=f"      PERFORM public.ciclo_autorizar('{action}',v_conta_id,p_user_id,v_d.id,v_id,v_valor,v_data,'{prefix}: '||v_d.descricao); -- 0025: capability exata após validações\n"
 expense=expense.replace(anchor,call+anchor)
guard=s22[s22.index('CREATE FUNCTION public.ciclo_guardar()'):s22.index('\nCREATE TRIGGER ciclo_conta')].strip().replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1)
guard=guard.replace('autorizado boolean;','autorizado boolean; despesa_autorizada boolean;')
anchor="   IF protegido AND (TG_OP<>'INSERT' OR NOT autorizado) THEN"
assert guard.count(anchor)==1
guard=guard.replace(anchor,"""   -- 0025: consumo atômico de UMA linha exata; sem bypass de outros triggers/tabelas.
   IF TG_OP='INSERT' THEN
     DELETE FROM public.ciclo_despesas_autorizacoes a
      WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.conta_id=aid
        AND a.user_id=(newj->>'user_id')::integer AND a.esperado=newj-'id'
        AND newj->>'categoria'='despesa_operacional'
        AND newj->'contrato_id'='null'::jsonb AND newj->'parcela_id'='null'::jsonb
      RETURNING true INTO despesa_autorizada;
     IF NOT coalesce(despesa_autorizada,false) AND EXISTS(SELECT 1 FROM public.ciclo_despesas_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN
       RAISE EXCEPTION '0025: lançamento diferente da capability exata' USING ERRCODE='42501';
     END IF;
     autorizado:=autorizado OR coalesce(despesa_autorizada,false);
   END IF;
"""+anchor)
sql=sql.replace('@EXPENSE@',expense).replace('@GUARD@',guard)
(ROOT/'drizzle/0025_integrar_rpc_despesas_ciclo.sql').write_text(sql)
print('0025 gerada; SHA256='+hashlib.sha256(sql.encode()).hexdigest())
