// Inventário construído exclusivamente das DDLs versionadas pinadas pelo builder37.
export function additionalPreflight({read,paths,map}){
 const s35=read(`drizzle/${paths[7]}.sql`);
 const triggers=new Map();
 for(const p of paths){const s=read(`drizzle/${p}.sql`);for(const m of s.matchAll(/CREATE TRIGGER (\w+) (BEFORE|AFTER) ([\s\S]*?) ON public\.(\w+) FOR EACH ROW(?: WHEN\(([\s\S]*?)\))? EXECUTE FUNCTION public\.(\w+)\(\);/g)){
  const [,name,timing,events,table,qual,fn]=m;if(!/^(?:INSERT|UPDATE|DELETE)(?: OR (?:INSERT|UPDATE|DELETE))*$/.test(events))continue;
  const type=1+(timing==='BEFORE'?2:0)+(events.includes('INSERT')?4:0)+(events.includes('DELETE')?8:0)+(events.includes('UPDATE')?16:0);
  triggers.set(`${table}/${name}`,{table,name,fn,type,qual:qual??null});
 }}
 for(const table of ['users','clientes','koletores','contas_caixa','contratos','parcelas','transacoes_caixa','contrato_historico','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_estados','ciclo_operacoes'])triggers.set(`${table}/a_legados_protocolo_${table}`,{table,name:`a_legados_protocolo_${table}`,fn:'legados_guardar',type:31,qual:null});
 for(const table of ['contas_caixa','clientes','koletores','contratos','parcelas','transacoes_caixa','contrato_historico'])triggers.set(`${table}/multa36_guard_${table}`,{table,name:`multa36_guard_${table}`,fn:'multa36_guardar',type:31,qual:null});
 for(const suffix of ['operacoes','origens','encargos','pernas','renovacoes','fences'])triggers.set(`multa36_${suffix}/multa36_immutable`,{table:`multa36_${suffix}`,name:'multa36_immutable',fn:'multa36_imutavel',type:27,qual:null});
 const known=JSON.stringify([...triggers.values()].sort((a,b)=>`${a.table}/${a.name}`.localeCompare(`${b.table}/${b.name}`)));
 const sessionDecl=s35.slice(s35.indexOf(' session_body text :='),s35.indexOf('BEGIN\n IF current_setting'));
 const sessionCheck=s35.slice(s35.indexOf(" IF EXISTS(SELECT 1 FROM pg_proc WHERE proname='revogar_sessoes_ao_alterar_senha')"),s35.indexOf(' -- Guards legados continuam intocados.'));
 const privateTables=['ciclo_autorizacoes','ciclo_despesas_autorizacoes','ciclo_estados','ciclo_operacoes','ciclo_pernas','emprestimos_rpc_origens','emprestimos_rpc_operacoes','renovacao_capacidades','renovacao_operacoes','renovacao_provas','financial_intent_fences','legados_capacidades','legados_operacoes','legados_estados','legados_auditoria','legados_manifesto','multimodal_manifesto','multimodal_origens','multimodal_operacoes','multimodal_estados','multimodal_autorizacoes','multimodal_pernas','multimodal_renovacoes','multimodal_fences','multimodal_coexistencia','multa36_manifesto','multa36_operacoes','multa36_origens','multa36_estados','multa36_encargos','multa36_pernas','multa36_renovacoes','multa36_capacidades','multa36_fences','multa36_coexistencia'];
 return `DO $strict37$
DECLARE expected jsonb; x record; own oid; svc oid; n text; session_trigger oid; session_function oid; session_password text;${sessionDecl}
BEGIN
 SELECT oid INTO own FROM pg_roles WHERE rolname=current_user;
 SELECT oid INTO svc FROM pg_roles WHERE rolname='service_role';
 ${sessionCheck}
 IF EXISTS(SELECT 1 FROM pg_proc WHERE (proname LIKE 'ciclo\\_%' ESCAPE '\\' OR proname LIKE 'renovacao\\_%' ESCAPE '\\' OR proname LIKE 'financial\\_intent\\_%' ESCAPE '\\' OR proname LIKE 'legados\\_%' ESCAPE '\\' OR proname LIKE 'multimodal\\_%' ESCAPE '\\' OR proname LIKE 'multa36\\_%' ESCAPE '\\') AND NOT(proname=ANY(ARRAY[${[...new Set([...map.values()].map(f=>f.proname))].map(n=>`'${n}'`).join(',')}]))) THEN RAISE EXCEPTION '0037 função protegida extra desconhecida' USING ERRCODE='55000'; END IF;
 FOREACH n IN ARRAY ARRAY[${privateTables.map(n=>`'${n}'`).join(',')}] LOOP
 IF (SELECT count(*) FROM pg_class WHERE relname=n)<>1 THEN RAISE EXCEPTION '0037 tabela privada ausente/homônima %',n USING ERRCODE='55000'; END IF;
 SELECT * INTO x FROM pg_class WHERE relname=n;
 IF x.relowner<>own OR x.relnamespace<>'public'::regnamespace OR x.relkind<>'r' OR NOT x.relrowsecurity OR x.relforcerowsecurity OR EXISTS(SELECT 1 FROM aclexplode(coalesce(x.relacl,acldefault('r',own))) a WHERE a.grantee<>own) OR EXISTS(SELECT 1 FROM pg_attribute z,LATERAL aclexplode(z.attacl) a WHERE z.attrelid=x.oid AND a.grantee<>own) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=x.oid) THEN RAISE EXCEPTION '0037 tabela privada ACL/RLS/owner %',n USING ERRCODE='55000'; END IF;
 END LOOP;
 expected := $triggers37$${known}$triggers37$::jsonb;
 FOR x IN SELECT value e FROM jsonb_array_elements(expected) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.'||(x.e->>'table')) AND t.tgname=x.e->>'name' AND t.tgfoid=to_regprocedure('public.'||(x.e->>'fn')||'()') AND t.tgtype=(x.e->>'type')::int AND t.tgenabled='O' AND NOT t.tgisinternal AND t.tgconstraint=0 AND t.tgnargs=0 AND t.tgargs=''::bytea AND t.tgattr=''::int2vector AND NOT t.tgdeferrable AND NOT t.tginitdeferred AND t.tgparentid=0 AND (CASE WHEN x.e->>'name'='multimodal_ponte_legados' THEN replace(pg_get_triggerdef(t.oid),'EXECUTE FUNCTION public.','EXECUTE FUNCTION ')='CREATE TRIGGER multimodal_ponte_legados AFTER INSERT ON public.legados_capacidades FOR EACH ROW WHEN ((new.etapa = ''ledger''::text)) EXECUTE FUNCTION multimodal_ponte_legados()' ELSE t.tgqual IS NULL END)) THEN RAISE EXCEPTION '0037 trigger predecessor fora do DDL conhecido %',x.e USING ERRCODE='55000'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND c.relname IN(SELECT e->>'table' FROM jsonb_array_elements(expected) e) AND NOT t.tgisinternal AND t.oid IS DISTINCT FROM session_trigger AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(expected) e WHERE e->>'table'=c.relname AND e->>'name'=t.tgname)) THEN RAISE EXCEPTION '0037 trigger extra não certificado' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN('public.contas_caixa'::regclass,'public.transacoes_caixa'::regclass,'public.contas_pagar'::regclass) AND (NOT c.relrowsecurity OR c.relforcerowsecurity OR c.relowner<>own)) THEN RAISE EXCEPTION '0037 RLS físico predecessor desconhecido' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'caixa37\\_%' ESCAPE '\\') THEN RAISE EXCEPTION '0037 namespace homônimo' USING ERRCODE='55000'; END IF;
END $strict37$;
`;
}
