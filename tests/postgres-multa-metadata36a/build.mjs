// Hotfix independente. Somente fontes versionadas pinadas; nenhum catálogo aprendido.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
import {additionalPreflight} from './preflight.mjs';
import {relationalPreflight} from './relational-preflight.mjs';
const read=p=>readFileSync(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
export const paths=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa'];
export const shas=['a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452','08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82','abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c','63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199','f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f','7ec52905fa260dc6d14af5fabcef74a2a1a7f0fa65874e15d3bd8358cadc5827','615d0b81fb1a41b5dd205214ebddc7e32f0d75576022df66905bc90396959ad0','6e5c11587d571e64a51585488c2fad7075f4d5dfeb9202a3a5dced795a9c0b03','7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f'];
paths.forEach((p,i)=>{if(hash(read(`drizzle/${p}.sql`))!==shas[i])throw Error(`Fonte congelada divergiu ${p}`);});
const s36=read(`drizzle/${paths.at(-1)}.sql`),t36=read('tests/postgres-multa/template.sql');
const clean=f=>Object.fromEntries(Object.entries(f).filter(([k])=>!['ddl','body'].includes(k)));
export const baseline36=new Map(JSON.parse(s36.match(/\$after36\$([\s\S]*?)\$after36\$/)[1]).map(f=>[`${f.proname}(${f.types})`,f]));
for(const f of functionsFromSQL(s36))baseline36.set(`${f.proname}(${f.types})`,clean(f));
const old=functionsFromSQL(s36).find(f=>f.proname==='multa36_metadata');
const from="'tables',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid)",to="'tables',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid)";
if(old.ddl.split(from).length!==2)throw Error('Seletor antigo não único');
export const fixedDDL=old.ddl.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace(from,to);
export const fixed=functionsFromSQL(fixedDDL)[0];
if(fixed.body!==old.body.replace(from,to))throw Error('Delta fora da única projeção');
let header=t36.slice(0,t36.indexOf('-- Witness do catálogo inteiro'));
header=header.replace(/\n IF EXISTS\(SELECT 1 FROM pg_proc WHERE proname LIKE 'multa36[\s\S]*?THEN RAISE EXCEPTION '0036 homônimo\/reapply recusado' USING ERRCODE='55000'; END IF;/,'');
if(header.includes('homônimo/reapply'))throw Error('Gate antigo de homônimo permaneceu');
header=header.replace('public.multimodal_manifesto,public.multimodal_origens','public.multa36_manifesto,public.multa36_operacoes,public.multa36_origens,public.multa36_estados,public.multa36_encargos,public.multa36_pernas,public.multa36_renovacoes,public.multa36_capacidades,public.multa36_fences,public.multa36_coexistencia,public.multimodal_coexistencia,public.contas_pagar,public.multimodal_manifesto,public.multimodal_origens');
header=header.replace('-- PREDECESSOR MANIFEST',()=>`expected := $known36a$${JSON.stringify([...baseline36.values()])}$known36a$::jsonb;`);
header=header.replace('-- ROW MANIFEST',()=>`expected := $rows36a$${s36.match(/\$rows36\$([\s\S]*?)\$rows36\$/)[1]}$rows36a$::jsonb;`);
header=header.replace('PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();','-- Não ressela manifesto original inválido, nem adota drift.\n PERFORM public.multa36_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();');
header=header.replaceAll('gate36','gate36a').replaceAll('0036 ','0036a ');
const stable="to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']";
const witness=`CREATE TEMP TABLE metadata36a_witness ON COMMIT DROP AS SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.oid<>'public.multa36_metadata()'::regprocedure),
 'relations',(SELECT jsonb_agg(${stable} ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace)) s;\n`;
const after=new Map(baseline36);after.set('multa36_metadata()',clean(fixed));
const post=`DO $post36a$ DECLARE expected jsonb; actual jsonb; w jsonb; obj jsonb; x jsonb; names text[]; BEGIN
 expected := $after36a$${JSON.stringify([...after.values()])}$after36a$::jsonb;
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(expected) f;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO actual FROM (
 SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO expected FROM jsonb_array_elements(expected) f;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Post36a fonte/config fora da alteração única' USING ERRCODE='55000'; END IF;
 SELECT s INTO STRICT w FROM metadata36a_witness;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(w->'functions','null'::jsonb),'[]'::jsonb)) LOOP SELECT to_jsonb(p) INTO obj FROM pg_proc p WHERE oid=(x->>'oid')::oid; IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Post36a função intocada divergiu' USING ERRCODE='55000'; END IF; END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(w->'relations','null'::jsonb),'[]'::jsonb)) LOOP SELECT ${stable} INTO obj FROM pg_class c WHERE oid=(x->>'oid')::oid; IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Post36a relação intocada divergiu' USING ERRCODE='55000'; END IF; END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(w->'attributes','null'::jsonb),'[]'::jsonb)) LOOP SELECT to_jsonb(a) INTO obj FROM pg_attribute a WHERE attrelid=(x->>'attrelid')::oid AND attnum=(x->>'attnum')::int; IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Post36a coluna intocada divergiu' USING ERRCODE='55000'; END IF; END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(w->'constraints','null'::jsonb),'[]'::jsonb)) LOOP SELECT to_jsonb(k) INTO obj FROM pg_constraint k WHERE oid=(x->>'oid')::oid; IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Post36a constraint intocada divergiu' USING ERRCODE='55000'; END IF; END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(w->'policies','null'::jsonb),'[]'::jsonb)) LOOP SELECT to_jsonb(p) INTO obj FROM pg_policy p WHERE oid=(x->>'oid')::oid; IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Post36a policy intocada divergiu' USING ERRCODE='55000'; END IF; END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(w->'triggers','null'::jsonb),'[]'::jsonb)) LOOP SELECT to_jsonb(t) INTO obj FROM pg_trigger t WHERE oid=(x->>'oid')::oid; IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Post36a trigger intocado divergiu' USING ERRCODE='55000'; END IF; END LOOP;
 END $post36a$;
-- Somente instalação, depois de verificar o selo ORIGINAL + fontes + catálogo.
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
SELECT public.multa36_verificar();
COMMIT;
`;
const out='-- Hotfix36a independente; único delta em multa36_metadata; fontes36 congeladas.\n'+header+additionalPreflight({read,paths,map:baseline36})+relationalPreflight({read,paths})+witness+fixedDDL+'\n'+post;
const target='drizzle/0036a_multa_metadata_estavel.sql';
if(process.argv.includes('--check')){if(read(target)!==out)throw Error('Hotfix36a diverge do builder');}else writeFileSync(target,out);
console.log(`0036a ${baseline36.size} funções conhecidas; delta único; SHA256 ${hash(out)}`);
