import {physicalRelationsPreflight} from './physical-relations.mjs';
export function relationalPreflight({read,paths}){
 const s=read(`drizzle/${paths[3]}.sql`);
 const blocks=[...s.matchAll(/ expected := '((?:[^']|'')*)'::jsonb;/g)].map(x=>JSON.parse(x[1].replaceAll("''","'")));
 const expected=blocks[1].map(t=>({relname:t.relname,relrowsecurity:t.relrowsecurity,relforcerowsecurity:t.relforcerowsecurity,relkind:t.relkind,relpersistence:t.relpersistence,relispartition:t.relispartition,columns:t.columns,constraints:t.constraints,indexes:t.indexes}));
 let source=s.slice(s.indexOf(' constraint_casts :='),s.indexOf(' -- Guardas habilitadas'));
 source=source.replaceAll('owner_oid','own').replaceAll("RAISE EXCEPTION '0025: schema/owner de tabela incompatível';", "RAISE EXCEPTION '0037 schema/owner físico incompatível' USING ERRCODE='55000';").replaceAll("RAISE EXCEPTION '0025: tabelas/defaults/CHECK/FK/índices incompatíveis';", "RAISE EXCEPTION '0037 tabelas/defaults/CHECK/FK/índices incompatíveis' USING ERRCODE='55000',DETAIL=(SELECT jsonb_agg(jsonb_build_object('expected',e,'actual',a))::text FROM jsonb_array_elements(expected) e FULL JOIN jsonb_array_elements(actual) a ON e->>'relname'=a->>'relname' WHERE e IS DISTINCT FROM a);").replace("RAISE EXCEPTION '0025: grants de tabela/coluna/policy incompatíveis: %',r.relname;", "RAISE EXCEPTION '0037 tabela ACL/coluna/policy incompatível %',r.relname USING ERRCODE='55000';");
 source=source.replaceAll('pg_get_expr(d.adbin,d.adrelid)',"replace(pg_get_expr(d.adbin,d.adrelid),'nextval(''public.','nextval(''')");
 // Search_path pg_catalog/pg_temp qualifica REFERENCES public no deparser: remover SÓ esta qualificação conhecida.
 source=source.replaceAll('pg_get_constraintdef(oid,false)',"replace(pg_get_constraintdef(oid,false),'REFERENCES public.','REFERENCES ')");
 const expected31="CHECK (((status)::text = ANY ((ARRAY['pendente'::character varying, 'paga'::character varying, 'pago'::character varying, 'atrasada'::character varying, 'atrasado'::character varying, 'cancelada'::character varying, 'cancelado'::character varying, 'parcial'::character varying, 'vencendo_hoje'::character varying, 'renovada'::character varying])::text[])))";
 const cast31="CHECK (((status)::text = ANY (ARRAY["+['pendente','paga','pago','atrasada','atrasado','cancelada','cancelado','parcial','vencendo_hoje','renovada'].map(v=>"('"+v+"'::character varying)::text").join(', ')+"])))";
 return `DO $relational37$ DECLARE expected jsonb; actual jsonb; constraint_casts jsonb; r record; own oid; BEGIN
 SELECT oid INTO own FROM pg_roles WHERE rolname=current_user;
 expected := $relations37$${JSON.stringify(expected)}$relations37$::jsonb;
 ${source}
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.parcelas'::regclass AND conname='parcelas_status_check' AND contype='c' AND convalidated AND NOT condeferrable AND NOT condeferred AND NOT connoinherit AND pg_get_constraintdef(oid,false) IN($parcelas31$${expected31}$parcelas31$,$parcelas31cast$${cast31}$parcelas31cast$)) OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.parcelas'::regclass AND contype='c' AND conname<>'parcelas_status_check') THEN RAISE EXCEPTION '0037 CHECK31 desconhecido' USING ERRCODE='55000',DETAIL=(SELECT pg_get_constraintdef(oid,false) FROM pg_constraint WHERE conrelid='public.parcelas'::regclass AND conname='parcelas_status_check'); END IF;
 END $relational37$;
`+physicalRelationsPreflight({read,paths});
}
