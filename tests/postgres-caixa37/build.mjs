// Somente arquivos novos37. Não executa builders predecessores nem lê catálogo runtime.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
import {additionalPreflight} from './preflight.mjs';
import {relationalPreflight} from './relational-preflight.mjs';
const read=p=>readFileSync(p,'utf8'), hash=s=>createHash('sha256').update(s).digest('hex');
const paths=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa'];
const shas=['a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452','08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82','abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c','63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199','f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f','7ec52905fa260dc6d14af5fabcef74a2a1a7f0fa65874e15d3bd8358cadc5827','615d0b81fb1a41b5dd205214ebddc7e32f0d75576022df66905bc90396959ad0','6e5c11587d571e64a51585488c2fad7075f4d5dfeb9202a3a5dced795a9c0b03','7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f'];
paths.forEach((p,i)=>{if(hash(read(`drizzle/${p}.sql`))!==shas[i])throw Error(`Fonte congelada divergiu ${p}`);});
const s36=read(`drizzle/${paths.at(-1)}.sql`), t36=read('tests/postgres-multa/template.sql');
const clean=f=>Object.fromEntries(Object.entries(f).filter(([k])=>!['ddl','body'].includes(k)));
const map=new Map(JSON.parse(s36.match(/\$after36\$([\s\S]*?)\$after36\$/)[1]).map(f=>[`${f.proname}(${f.types})`,f]));
const effective=new Map(functionsFromSQL(s36).map(f=>[f.proname,f]));
const hotfix36a=read('drizzle/0036a_multa_metadata_estavel.sql');
execFileSync('node',['tests/postgres-multa-metadata36a/build.mjs','--check'],{stdio:'inherit'});
if(hash(hotfix36a)!=='df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f')throw Error('Hotfix36a pinado divergiu');
const hotfixFunctions=functionsFromSQL(hotfix36a);
if(hotfixFunctions.length!==1||hotfixFunctions[0].proname!=='multa36_metadata')throw Error('36a fora da alteração única');
effective.set('multa36_metadata',hotfixFunctions[0]);
const validator=functionsFromSQL(read(`drizzle/${paths[6]}.sql`)).find(f=>f.proname==='legados_validar');
for(const f of effective.values())map.set(`${f.proname}(${f.types})`,clean(f));
effective.set(validator.proname,validator);
const whitelist=['ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','legados_validar'];
const extensions=whitelist.map(name=>{
 const f=effective.get(name);if(!f)throw Error(`Corpo efetivo ausente ${name}`);
 let ddl=f.ddl.replace(/CREATE (?:OR REPLACE )?FUNCTION/,'CREATE OR REPLACE FUNCTION');
 if(name==='legados_validar'){
  const line=f.body.split('\n').find(l=>l.includes("IF (t.tipo='entrada' AND t.parcela_id IS NULL)"));
  if(!line)throw Error('Exceção34 não localizada');
  ddl=ddl.replace(line,line.replace('IF (t.tipo=',"IF NOT public.caixa37_perna_comprovada(t.id,uid) AND ((t.tipo=").replace("THEN RAISE EXCEPTION", ") THEN RAISE EXCEPTION"));
 }else{
  const slot=name==='multa36_ponte'?"TG_NAME":"TG_NAME";
  const insert=`\n IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.caixa37_consumir(${slot},TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;`;
  ddl=ddl.replace('BEGIN','BEGIN'+insert);
 }
 return ddl;
});
let header=t36.slice(0,t36.indexOf('CREATE TABLE public.multa36_operacoes'));
header=header.replaceAll('36','37').replace("'ciclo_guardar','legados_guardar','multimodal_guardar'",whitelist.map(n=>`'${n}'`).join(','));
// A transformação de namespace não pode alterar nomes36 reais da baseline.
header=header.replace('public.multimodal_manifesto,public.multimodal_origens','public.multa36_manifesto,public.multa36_operacoes,public.multa36_origens,public.multa36_estados,public.multa36_encargos,public.multa36_pernas,public.multa36_renovacoes,public.multa36_capacidades,public.multa36_fences,public.multa36_coexistencia,public.multimodal_manifesto,public.multimodal_origens');
header=header.replace('PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();','PERFORM public.multa36_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();');
header=header.replace(/-- PREDECESSOR MANIFEST/,()=>`expected := $known37$${JSON.stringify([...map.values()])}$known37$::jsonb;`);
header=header.replace(/-- ROW MANIFEST/,()=>`expected := $rows37$${s36.match(/\$rows36\$([\s\S]*?)\$rows36\$/)[1]}$rows37$::jsonb;`);
header=header.replace(/proname LIKE 'multa37\\_%' ESCAPE '\\' OR proname LIKE 'rpc\\_%multa37' ESCAPE '\\'/g,"proname LIKE 'caixa37\\_%' ESCAPE '\\' OR proname LIKE 'rpc\\_%caixa37' ESCAPE '\\'").replaceAll("relname LIKE 'multa37\\_%'","relname LIKE 'caixa37\\_%'").replaceAll("typname LIKE 'multa37\\_%'","typname LIKE 'caixa37\\_%'").replaceAll("tgname LIKE 'multa37\\_%'","tgname LIKE '%caixa37%'");
let bridge=effective.get('multa36_ponte').ddl.replace('public.multa36_ponte()','public.caixa37_ponte()');
bridge=bridge.replace('PERFORM public.multa36_verificar();','PERFORM public.caixa37_verificar();').replace('public.multa36_origens WHERE conta_id=NEW.conta_caixa_id','public.caixa37_contas WHERE conta_id=NEW.conta_caixa_id');
bridge=bridge.replace(" IF EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid OR contrato_id IN(SELECT contrato_id FROM public.parcelas WHERE id=pid0)) THEN RETURN NEW; END IF;", " IF EXISTS(SELECT 1 FROM public.caixa37_capacidades cap JOIN public.caixa37_operacoes o ON o.id=cap.operacao_id WHERE cap.xid=txid_current() AND cap.pid=pg_backend_pid() AND cap.posterior=b AND cap.guard='z_caixa37_ledger' AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress') THEN RETURN NEW; END IF;");
bridge=bridge.replace(' ok:=EXISTS(SELECT 1 FROM public.multimodal_autorizacoes'," ok:=EXISTS(SELECT 1 FROM public.multa36_capacidades a JOIN public.multa36_operacoes o ON o.id=a.operacao_id WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.tabela='transacoes_caixa' AND a.evento='INSERT' AND a.anterior IS NULL AND a.posterior=b AND o.user_id=uid AND o.contrato_id=cid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND o.hash_payload=encode(extensions.digest(o.request::text,'sha256'),'hex'));\n ok:=ok OR EXISTS(SELECT 1 FROM public.multimodal_autorizacoes");
bridge=bridge.replace('INSERT INTO public.multa36_coexistencia VALUES(txid_current(),pg_backend_pid(),b);',"INSERT INTO public.caixa37_coexistencia VALUES(txid_current(),pg_backend_pid(),b,'predecessor_exact_v1');");
bridge=bridge.replaceAll('Ponte36','Ponte37');
let sql=header+additionalPreflight({read,paths,map})+relationalPreflight({read,paths})+read('tests/postgres-caixa37/template.sql').replace('-- SIX EXTENSIONS',()=>extensions.join('\n')).replace('-- BRIDGE FROM SOURCE36',()=>bridge);
const funcs=functionsFromSQL(sql), changed=funcs.filter(f=>map.has(`${f.proname}(${f.types})`)).map(f=>f.proname).sort();
if(JSON.stringify(changed)!==JSON.stringify([...whitelist].sort()))throw Error('Extensão fora das seis autorizadas');
const after=[...map.values()].map(f=>{const x=funcs.find(x=>x.proname===f.proname&&x.types===f.types);return x?clean(x):f;});
let post=t36.slice(t36.indexOf('DO $post36$'),t36.indexOf('-- Somente instalação'));
post=post.replaceAll('post36','post37').replaceAll('Postflight36','Postflight37').replaceAll('multa36_ddl_witness','multa37_ddl_witness');
post=post.replace('-- POST MANIFEST',()=>`expected := $after37$${JSON.stringify(after)}$after37$::jsonb;`);
sql=sql.replace('-- POSTFLIGHT',()=>post);
if(sql.includes('-- SIX EXTENSIONS')||sql.includes('-- POSTFLIGHT')||!sql.endsWith('COMMIT;\n'))throw Error('Template incompleto');
const names=new Set(funcs.map(f=>f.proname));
for(const f of funcs)for(const x of f.body.matchAll(/public\.(caixa37_\w+)\s*\(/g))if(!names.has(x[1])&&!sql.includes(`CREATE TABLE public.${x[1]}(`))throw Error(`Helper indefinido ${x[1]}`);
const target='drizzle/0037_rpc_aporte_transferencia_caixa.sql';
const output='-- Gerado de fontes versionadas pinadas por tests/postgres-caixa37/build.mjs; NÃO CERTIFICADO.\n'+sql;
if(process.argv.includes('--check')){if(read(target)!==output)throw Error('SQL37 diverge do build');}else writeFileSync(target,output);
console.log(`0037: ${map.size} predecessoras, seis extensões exatas, SHA256 ${hash(output)}`);
export {paths,shas};
