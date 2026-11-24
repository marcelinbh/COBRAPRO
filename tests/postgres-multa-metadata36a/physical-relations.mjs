// Preflight37 adicional: somente DDL versionado; catálogo não é fonte aprendida.
import {createHash} from 'node:crypto';
const FIXTURE='tests/postgres-loans/fixture.sql';
const FIXTURE_SHA='aff45b7950b2c458f172a06109ad3f7f0b9e56ef922bf7d5e52405acb3672f2d';
const NAMES=['clientes','contrato_historico','contratos','koletores','parcelas'];
export function physicalRelationsPreflight({read,paths}){
 const fixture=read(FIXTURE);
 if(createHash('sha256').update(fixture).digest('hex')!==FIXTURE_SHA)throw Error('Fixture físico versionado divergiu; não aprender catálogo/DDL novo');
 const expected=NAMES.map(relname=>({relname,constraints:[],indexes:[]}));
 const variants={};
 for(const m of fixture.matchAll(/ALTER TABLE public\."(\w+)" ADD CONSTRAINT "(\w+)" ([^\n]+);/g)){
  const [,table,name,ddl]=m,t=expected.find(t=>t.relname===table);if(!t)continue;
  let type,definition;
  if(ddl.startsWith('CHECK ')){
   type='c';
   const check=ddl.match(/^CHECK \((\w+)::text = ANY \(ARRAY\[([\s\S]*)\]::text\[\]\)\)$/);
   if(!check)throw Error(`CHECK físico não reconhecido: ${name}`);
   let values=check[2].split(', ').map(v=>{if(!/^'[a-z_]+'::character varying$/.test(v))throw Error(`Literal CHECK desconhecido ${name}`);return v;});
   if(table==='parcelas'&&name==='parcelas_status_check'){
    const source31=read(`drizzle/${paths[4]}.sql`);
    if(!source31.includes("'renovada'"))throw Error('Extensão CHECK31 não encontrada em fonte pinada');
    values.push("'renovada'::character varying");
   }
   definition=`CHECK (((${check[1]})::text = ANY ((ARRAY[${values.join(', ')}])::text[])))`;
   const cast=`CHECK (((${check[1]})::text = ANY (ARRAY[${values.map(v=>`(${v})::text`).join(', ')}])))`;
   variants[table]??={};variants[table][name]={[cast]:definition};
  }else if(ddl.startsWith('PRIMARY KEY ')){
   type='p';definition=ddl;
   t.indexes.push([name,true,true,true,true,`CREATE UNIQUE INDEX ${name} ON public.${table} USING btree (id)`]);
  }else if(ddl.startsWith('FOREIGN KEY ')){type='f';definition=ddl;}
  else throw Error(`Constraint física não reconhecida ${name}`);
  t.constraints.push([name,type,true,false,false,type!=='c','0',definition]);
 }
 for(const m of fixture.matchAll(/CREATE INDEX (\w+) ON public\.(\w+) USING btree \((\w+)\);/g)){
  const [,name,table,column]=m,t=expected.find(t=>t.relname===table);if(t)t.indexes.push([name,false,true,true,true,`CREATE INDEX ${name} ON public.${table} USING btree (${column})`]);
 }
 for(const t of expected){t.constraints.sort((a,b)=>a[0].localeCompare(b[0],'en'));t.indexes.sort((a,b)=>a[0].localeCompare(b[0],'en'));if(!t.constraints.length||!t.indexes.length)throw Error(`Manifesto físico incompleto ${t.relname}`);}
 return `-- Fonte fixture pinada SHA256 ${FIXTURE_SHA}; CHECK parcelas somente delta31.
DO $physical37$ DECLARE expected jsonb; actual jsonb; variants jsonb; own oid; BEGIN
 SELECT oid INTO own FROM pg_roles WHERE rolname=current_user;
 expected := $physicalKnown37$${JSON.stringify(expected)}$physicalKnown37$::jsonb;
 variants := $physicalCasts37$${JSON.stringify(variants)}$physicalCasts37$::jsonb;
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN(${NAMES.map(n=>`'public.${n}'::regclass`).join(',')}) AND (c.relowner<>own OR c.relkind<>'r' OR c.relpersistence<>'p' OR c.relispartition OR c.reloftype<>0)) THEN RAISE EXCEPTION '0037 owner/relação física desconhecida' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_object('relname',c.relname,
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,k.connoinherit,k.conparentid,coalesce(variants->c.relname->k.conname->>replace(pg_get_constraintdef(k.oid,false),'REFERENCES public.','REFERENCES '),replace(pg_get_constraintdef(k.oid,false),'REFERENCES public.','REFERENCES '))) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(x.relname,i.indisunique,i.indisvalid,i.indisready,i.indislive,pg_get_indexdef(i.indexrelid)) ORDER BY x.relname) FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=c.oid)) ORDER BY c.relname) INTO actual FROM pg_class c WHERE c.oid IN(${NAMES.map(n=>`'public.${n}'::regclass`).join(',')});
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0037 constraints/índices relacionais desconhecidos; não aprender drift' USING ERRCODE='55000',DETAIL=(SELECT jsonb_agg(jsonb_build_object('expected',e,'actual',a))::text FROM jsonb_array_elements(expected) e FULL JOIN jsonb_array_elements(actual) a ON e->>'relname'=a->>'relname' WHERE e IS DISTINCT FROM a); END IF;
END $physical37$;
`;
}
