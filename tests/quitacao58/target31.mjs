export async function targets({sql,rpc,reject,scenario,assert,save,financial,verify,result,captureOrder}){
 const full=async()=>{
  const rels=await sql("SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p') AND n.nspname IN('public','caixa_manutencao45','calendario46','despesa_cancelamento_v1','despesas49','inclusao52','manutencao44','manutencao48','obrigacoes51','private47','sucessores53','telefone41') ORDER BY n.nspname,c.relname LIMIT 1000");
  const snap={};for(const r of rels){const q='"'+r.schema.replaceAll('"','""')+'"."'+r.name.replaceAll('"','""')+'"';snap[r.schema+'.'+r.name]=(await sql(`SELECT coalesce(jsonb_agg(x.j ORDER BY x.j::text),'[]'::jsonb) rows FROM (SELECT to_jsonb(a) j FROM ${q} a) x LIMIT 1`))[0].rows;}return snap;
 };
 const before=await full(),cat=await captureOrder();
 for(const [aid,cid,caseName] of [[16,95860,'foreign physical account target'],[17,95861,'NULL owner physical account target'],[18,95862,'own physical account wrong contract cash'],[19,95863,'foreign physical contract target othercash'],[20,95864,'foreign physical childparcel target NULL contract'],[21,95865,'NULL owner physical childparcel target crosscash']]){
  await scenario('TARGET27 '+caseName,async()=>{
   await sql('BEGIN');let e;try{await sql('SELECT pg_advisory_xact_lock(22022,$1),pg_advisory_xact_lock(34034,1),pg_advisory_xact_lock(34035,$2) LIMIT 1',[aid,cid]);e=await reject(()=>rpc('obrigacoes51.validar_livro_recebimento',[1,aid,cid]),'23514');assert.equal(e.message,'Ledger37 whole-owner crossowner/estrutura inválida');}finally{await sql('ROLLBACK');}
   result.target27??=[];result.target27.push({aid,cid,caseName,code:e.code,message:e.message,physicalAllOwnersExact:true});
  });
 }
 assert.deepEqual(await full(),before);assert.deepEqual(await captureOrder(),cat);await verify();
 const scope97=JSON.parse((await import('node:fs')).readFileSync(new URL('../calendario46/physical-frozen.json',import.meta.url),'utf8'))[0].table_shape.filter(x=>['r','p'].includes(x.kind)).map(x=>x.relation);
 const present=Object.keys(before),missing=scope97.filter(x=>!present.includes(x));
 result.completeFinancial27={scope:'all physical local user tables, every row/column/owner, including private journals',tables:present.length,present,scope97Tables:scope97.length,missing97:missing,real97NotAccessed:true,snapshot:'complete-physical27-before.json',readOnlyTargetChecksExact:true};
 save('complete-physical27-before.json',before);save('targets27.json',{cases:result.target27,financial:result.completeFinancial27});
}
