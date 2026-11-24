// Gera APENAS nova0036 de fontes locais certificadas; nunca lê catálogo/dados externos.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const read=p=>readFileSync(p,'utf8');
const certified={
 'drizzle/0031_rpc_renovacao_juros_prospectiva.sql':'f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f',
 'drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql':'7ec52905fa260dc6d14af5fabcef74a2a1a7f0fa65874e15d3bd8358cadc5827',
 'drizzle/0034_rpc_recebimento_legado_validado.sql':'615d0b81fb1a41b5dd205214ebddc7e32f0d75576022df66905bc90396959ad0',
 'drizzle/0035_rpc_ciclo_emprestimos_multimodal.sql':'6e5c11587d571e64a51585488c2fad7075f4d5dfeb9202a3a5dced795a9c0b03',
};
for(const [path,sha] of Object.entries(certified))if(hash(read(path))!==sha)throw Error(`Fonte certificada divergiu; não reseal: ${path}`);
const s35=read('drizzle/0035_rpc_ciclo_emprestimos_multimodal.sql');
const expected=JSON.parse(s35.match(/\$known35\$([\s\S]*?)\$known35\$/)[1]);
const map=new Map(expected.map(f=>[`${f.proname}(${f.types})`,f]));
// Parser baseline não reconhece RETURNS public.rowtype: remover a definição inteira
// antes de parsear; jamais deixar regex atravessar a função seguinte.
const special=s35.match(/CREATE FUNCTION public.multimodal_reservar\([\s\S]*?END \$\$;/)[0];
const parse35=text=>functionsFromSQL(text.replace('p_multa_atraso numeric DEFAULT 2,p_juros_mora_diario numeric DEFAULT 0.033','p_multa_atraso numeric DEFAULT NULL,p_juros_mora_diario numeric DEFAULT NULL')).map(f=>f.proname==='rpc_criar_emprestimo_multimodal'?{...f,defaults:'NULL::text, NULL::text, 2, 0.033'}:f);
for(const f of parse35(s35.replace(special,'')))map.set(`${f.proname}(${f.types})`,Object.fromEntries(Object.entries(f).filter(([k])=>!['ddl','body'].includes(k))));
const body=special.match(/AS \$\$([\s\S]*?)\$\$/)[1];
map.set('multimodal_reservar(integer, text, uuid, jsonb)',{proname:'multimodal_reservar',args:'p_user integer, p_family text, p_key uuid, p_request jsonb',types:'integer, text, uuid, jsonb',result:'public.multimodal_operacoes',lang:'plpgsql',prosecdef:true,provolatile:'v',proparallel:'u',proisstrict:false,proleakproof:false,prokind:'f',pronargdefaults:0,defaults:null,proconfig:['search_path=pg_catalog, pg_temp'],body_hash:hash(body)});
const pre=[...map.values()].sort((a,b)=>`${a.proname}(${a.types})`.localeCompare(`${b.proname}(${b.types})`));
const extensions=[];
for(const name of ['ciclo_guardar','legados_guardar','multimodal_guardar']){
 const text=name==='ciclo_guardar'?read('drizzle/0031_rpc_renovacao_juros_prospectiva.sql'):name==='legados_guardar'?read('drizzle/0034_rpc_recebimento_legado_validado.sql'):s35.replace(special,'');
 const f=parse35(text).find(f=>f.proname===name);
 const insertion=`\n IF public.multa36_consumir('${name}',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW; END IF;`;
 extensions.push(f.ddl.replace(/CREATE (?:OR REPLACE )?FUNCTION/,'CREATE OR REPLACE FUNCTION').replace('BEGIN','BEGIN'+insertion));
}
const rows=s35.match(/\$rows35\$([\s\S]*?)\$rows35\$/)[1];
const template=read('tests/postgres-multa/template.sql');
let sql=template.replace('-- PREDECESSOR MANIFEST',()=>`expected := $known36$${JSON.stringify(pre)}$known36$::jsonb;`).replace('-- ROW MANIFEST',()=>`expected := $rows36$${rows}$rows36$::jsonb;`).replace('-- GUARD EXTENSIONS',()=>extensions.join('\n'));
const finalFunctions=functionsFromSQL(sql);
const after=pre.map(f=>{const change=finalFunctions.find(x=>x.proname===f.proname&&x.types===f.types);return change?Object.fromEntries(Object.entries(change).filter(([k])=>!['ddl','body'].includes(k))):f;});
sql=sql.replace('-- POST MANIFEST',()=>`expected := $after36$${JSON.stringify(after)}$after36$::jsonb;`);
if(sql.includes('-- MUTATION FROM SOURCE35')||!sql.endsWith('COMMIT;\n'))throw Error('Template incompleto: jamais emitir stub executável');
if(/-- (?:PREDECESSOR MANIFEST|ROW MANIFEST|GUARD EXTENSIONS|POST MANIFEST)/.test(sql))throw Error('Manifesto/extensão não expandido: fail-closed');
const signatures=finalFunctions.map(f=>`${f.proname}(${f.types})`);
if(new Set(signatures).size!==signatures.length)throw Error('Definição duplicada: fail-closed');
const defined=new Set(finalFunctions.map(f=>f.proname));
const relations=new Set([...sql.matchAll(/CREATE TABLE public\.(multa36_\w+)\s*\(/g)].map(m=>m[1]));
for(const f of finalFunctions)for(const ref of f.body.matchAll(/public\.(multa36_\w+|rpc_\w*multa36)\s*\(/g))if(!defined.has(ref[1])&&!relations.has(ref[1]))throw Error(`Helper36 indefinido: ${ref[1]} em ${f.proname}`);
const changed=finalFunctions.filter(f=>map.has(`${f.proname}(${f.types})`)).map(f=>f.proname).sort();
if(JSON.stringify(changed)!==JSON.stringify(['ciclo_guardar','legados_guardar','multimodal_guardar']))throw Error('Extensão predecessora fora do recorte: fail-closed');
writeFileSync('drizzle/0036_rpc_multa_manual_fixa.sql','-- Gerado por tests/postgres-multa/build.mjs, fontes VERSIONADAS; não catálogo runtime.\n'+sql);
console.log(`0036 construída: ${pre.length} assinaturas predecessoras, três extensões exatas; nenhuma migration aplicada editada.`);
