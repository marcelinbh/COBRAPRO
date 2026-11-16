// Manifesto derivado exclusivamente das fontes versionadas; nunca do catálogo do teste.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { baselineFunctions, renewalFunctions, functionsFromSQL } from '../../server/migrations/0033.preflight.sources.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const files=['drizzle/0020_rpc_despesas_prospectivas.sql','drizzle/0021_rpc_emprestimos_prospectivos.sql','drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql','drizzle/0025_integrar_rpc_despesas_ciclo.sql','drizzle/0031_rpc_renovacao_juros_prospectiva.sql','drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql','drizzle/0034_rpc_recebimento_legado_validado.sql'];
const map=new Map(baselineFunctions.map(f=>[`${f.proname}(${f.types})`,f]));
for(const f of renewalFunctions)map.set(`${f.proname}(${f.types})`,f);
const families={rpc_criar_emprestimo:'emprestimo_criar',rpc_receber_emprestimo_prospectivo:'emprestimo_receber',rpc_criar_despesa_prospectiva:'despesa_criar',rpc_pagar_despesa_prospectiva:'despesa_pagar',rpc_estornar_despesa_prospectiva:'despesa_estornar'};
for(const f of [...map.values()])if(families[f.proname]){
 const name='financial_intent_original_'+f.proname;
 map.set(`${name}(${f.types})`,{...f,proname:name});
 const body=` BEGIN PERFORM public.financial_intent_gate(p_user_id,p_chave_idempotencia,'${families[f.proname]}'); RETURN public.${name}(${f.args.split(', ').map(a=>a.split(' ')[0]).join(',')}); END `;
 map.set(`${f.proname}(${f.types})`,{...f,lang:'plpgsql',proconfig:['search_path=pg_catalog, pg_temp'],body_hash:hash(body)});
}
for(const file of files.slice(5))for(const f of functionsFromSQL(readFileSync(file,'utf8')))map.set(`${f.proname}(${f.types})`,f);
// 0034 adds DateStyle to this proof function, unlike the older parser's supported subset.
for(const f of map.values())if(f.proname==='legados_prova_pagamento')f.proconfig=['search_path=pg_catalog, pg_temp','TimeZone=UTC','DateStyle=ISO, YMD'];
const manifest=[...map.values()].map(({ddl,body,...f})=>f).sort((a,b)=>`${a.proname}(${a.types})`.localeCompare(`${b.proname}(${b.types})`,'en'));
const p='drizzle/0035_rpc_ciclo_emprestimos_multimodal.sql';
let sql=readFileSync(p,'utf8');
const block='-- MULTIMODAL SOURCE MANIFEST BEGIN\n'+files.map(f=>`-- ${f}: ${hash(readFileSync(f,'utf8'))}`).join('\n')+'\n expected := $known35$'+JSON.stringify(manifest)+'$known35$::jsonb;\n-- MULTIMODAL SOURCE MANIFEST END';
sql=sql.replace(/-- MULTIMODAL SOURCE MANIFEST BEGIN[\s\S]*?-- MULTIMODAL SOURCE MANIFEST END/,()=>block);
writeFileSync(p,sql);
console.log(`0035: ${manifest.length} corpos/assinaturas conhecidos de fontes locais`);
// Rowtypes conhecidos da fixture fiel ao baseline; não adota defaults do catálogo.
const fixture=readFileSync('tests/postgres-loans/fixture.sql','utf8');
const rows={};
for(const table of ['contratos','parcelas','transacoes_caixa','contrato_historico','contas_caixa','clientes','koletores']){
 const body=fixture.match(new RegExp(`CREATE TABLE public\\.\\"${table}\\" \\(([\\s\\S]*?)\\n\\);`))[1];
 rows[table]=body.trim().split('\n').map((line,i)=>{
  const m=line.trim().replace(/,$/,'').match(/^"([^"]+)" (.*)$/); let tail=m[2];
  const notnull=/ NOT NULL/.test(tail); const def=tail.match(/ DEFAULT (.*)$/)?.[1]??null;
  let type=tail.replace(/ NOT NULL/g,'').replace(/ DEFAULT .*$/,'');
  let d=def;
  if(type==='serial'){type='integer';d='serial';} if(type==='bigserial'){type='bigint';d='serial';}
  return [i+1,m[1],type,notnull,d];
 });
}
const rowBlock='-- ROWTYPE MANIFEST BEGIN\n expected := $rows35$'+JSON.stringify(rows)+'$rows35$::jsonb;\n FOREACH n IN ARRAY ARRAY[\'contratos\',\'parcelas\',\'transacoes_caixa\',\'contrato_historico\',\'contas_caixa\',\'clientes\',\'koletores\'] LOOP\n SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,CASE WHEN pg_get_expr(d.adbin,d.adrelid) LIKE \'nextval(%\' THEN \'serial\' ELSE pg_get_expr(d.adbin,d.adrelid) END) ORDER BY a.attnum) INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass(\'public.\'||n) AND a.attnum>0 AND NOT a.attisdropped;\n IF actual IS DISTINCT FROM expected->n THEN RAISE EXCEPTION \'0035: rowtype/default incompatível %\',n USING ERRCODE=\'55000\'; END IF;\n END LOOP;\n -- ROWTYPE MANIFEST END';
sql=sql.replace(/-- ROWTYPE MANIFEST BEGIN[\s\S]*?-- ROWTYPE MANIFEST END/,()=>rowBlock);
writeFileSync(p,sql);
