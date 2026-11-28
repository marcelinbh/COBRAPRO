// Importar pelo harness isolado do parent APÓS composição20..51→54→52→53→58→60.
// Carregar fixtures67.sql ANTES dos selos predecessores. Não inicia PG/rede/credenciais.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export async function controles67(ctx) {
 const { sql,rpc,reject,financial,verify,save,db,makePeer,coortes=[] }=ctx;
 assert.equal(typeof makePeer,'function','parent must supply local peer for concurrency gate');
 assert.ok(coortes.length>=10,'parent must supply all financial cohorts20/22/25/34/35/36/48/51/52/53');
 assert.equal((await sql("SELECT current_setting('server_version_num')::int/10000 v,current_setting('transaction_isolation') isolation,current_setting('listen_addresses') listen LIMIT 1"))[0].v,17);
 assert.equal((await sql("SELECT current_setting('listen_addresses') listen LIMIT 1"))[0].listen,'');
 for(const f of ['obrigacoes51.verificar','inclusao52.verificar','sucessores53.verificar','emprestimos_lista60.verificar'])await rpc(f);
 const ddl=readFileSync(new URL('../../drizzle/0067_lista_controles_organizacao.sql',import.meta.url),'utf8');
 const before=await financial(),functions=await sql("SELECT oid,to_jsonb(p) row,pg_get_functiondef(oid) definition FROM pg_proc p WHERE prokind IN('f','p') ORDER BY oid LIMIT 20000");
 const seals=await sql("SELECT assinatura FROM public.caixa37_manifesto WHERE id=1 LIMIT 1");
 // Drift nunca gera reseal e nenhuma DDL parcial sobrevive ao rollback.
 await sql('BEGIN');await sql('ALTER FUNCTION emprestimos_lista60.lista(integer) SET search_path=public');await reject(()=>sql(ddl),'55000');await sql('ROLLBACK');
 assert.equal((await sql("SELECT to_regnamespace('lista_controles67') n LIMIT 1"))[0].n,null);assert.deepEqual(await financial(),before);assert.deepEqual(await sql("SELECT assinatura FROM public.caixa37_manifesto WHERE id=1 LIMIT 1"),seals);
 const tampered=ddl.replace('SELECT n IS NOT NULL AND coalesce(array_ndims(n),1)=1','SELECT n IS NOT NULL /* new source tamper */ AND coalesce(array_ndims(n),1)=1');assert.notEqual(tampered,ddl);
 await reject(()=>sql(tampered),'55000');await sql('ROLLBACK');assert.equal((await sql("SELECT to_regnamespace('lista_controles67') n LIMIT 1"))[0].n,null);assert.deepEqual(await financial(),before);assert.deepEqual(await sql("SELECT assinatura FROM public.caixa37_manifesto WHERE id=1 LIMIT 1"),seals);
 await sql(ddl);assert.deepEqual(await financial(),before);await verify();await rpc('lista_controles67.verificar');await rpc('emprestimos_lista60.verificar');
 const afterFunctions=await sql("SELECT oid,to_jsonb(p) row,pg_get_functiondef(oid) definition FROM pg_proc p WHERE prokind IN('f','p') ORDER BY oid LIMIT 20000");
 for(const f of functions)assert.deepEqual(afterFunctions.find(x=>x.oid===f.oid),f,'67 changed predecessor '+f.oid);
 assert.equal((await sql("SELECT count(*)::int n FROM pg_constraint WHERE connamespace='lista_controles67'::regnamespace AND contype='f' LIMIT 1"))[0].n,0);
 const acl=await sql("SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN('rpc_lista_emprestimos67','rpc_etiquetas_criar67','rpc_etiquetas_remover67','rpc_etiquetas_aplicar67') ORDER BY proname LIMIT 4");
 assert.equal(acl.length,4);for(const a of acl){assert.equal(a.anon,false);assert.equal(a.authenticated,false);assert.equal(a.service,true);}
 assert.equal((await sql("SELECT has_table_privilege('service_role','lista_controles67.catalogo','INSERT,UPDATE,DELETE') writable LIMIT 1"))[0].writable,false);
 const list=()=>rpc('public.rpc_lista_emprestimos67',[6701]),meta=(s,id)=>s.organizacao67.contratos.find(c=>c.id===id);
 let s=await list();assert.deepEqual(s.lista60,await rpc('public.rpc_lista_emprestimos60',[6701]));assert.equal(s.organizacao67.state,'confirmed');
 assert.equal(s.organizacao67.cobradores.some(k=>k.id===6703),false);assert.equal(s.organizacao67.cobradores.find(k=>k.id===6702).nome,'Coletor67 próprio');
 assert.equal(meta(s,67004),undefined);assert.deepEqual(s.lista60.items.find(i=>i.id===67004),{kind:'unavailable',id:67004,reason:'local_link_unconfirmed'});
 assert.deepEqual(meta(s,67003).cobrador,{state:'confirmed',id:null});assert.equal(meta(s,67006),undefined);assert.equal(s.lista60.items.find(i=>i.id===67006).kind,'unavailable');assert.equal(meta(s,67003).etiquetas.state,'unavailable');assert.deepEqual(meta(s,67002).etiquetas.nomes,[]);
 assert.deepEqual(meta(s,67001).etiquetas.nomes,['Histórico67']);assert.equal(JSON.stringify(s).includes('EXTERNO67 não expor'),false);
 const own=await rpc('public.rpc_etiquetas_criar67',[6701,'Prioridade67','#abcdef']),foreign=await rpc('public.rpc_etiquetas_criar67',[6702,'Prioridade67','#112233']);assert.notEqual(own.id,foreign.id);
 assert.equal((await list()).organizacao67.catalogo.length,1);await reject(()=>rpc('public.rpc_etiquetas_remover67',[6701,foreign.id]),'42501');
 await reject(()=>rpc('public.rpc_etiquetas_criar67',[6701,'Prioridade67','#abcdef']),'23505');await reject(()=>rpc('public.rpc_etiquetas_criar67',[6701,'Inválida','red']),'22023');
 const old=meta(s,67001).etiquetas;
 await reject(()=>rpc('public.rpc_etiquetas_aplicar67',[6702,67001,[],old.revisao,old.estadoHash]),'42501');
 await reject(()=>rpc('public.rpc_etiquetas_aplicar67',[6701,67004,[],old.revisao,old.estadoHash]),'42501');
 await reject(()=>rpc('public.rpc_etiquetas_aplicar67',[6701,67003,[],0,'a'.repeat(64)]),'23514');
 await reject(()=>rpc('public.rpc_etiquetas_aplicar67',[6701,67001,['Não próprio67'],old.revisao,old.estadoHash]),'22023');
 const read60=s.lista60;
 const applied=await rpc('public.rpc_etiquetas_aplicar67',[6701,67001,['Prioridade67','Histórico67'],old.revisao,old.estadoHash]);assert.equal(applied.revisao,'1');
 await reject(()=>rpc('public.rpc_etiquetas_aplicar67',[6701,67001,[],old.revisao,old.estadoHash]),'40001');
 await rpc('public.rpc_etiquetas_remover67',[6701,own.id]);s=await list();assert.deepEqual(meta(s,67001).etiquetas.nomes,['Prioridade67','Histórico67']);
 const current=meta(s,67001).etiquetas;await rpc('public.rpc_etiquetas_aplicar67',[6701,67001,[],current.revisao,current.estadoHash]);s=await list();assert.deepEqual(meta(s,67001).etiquetas.nomes,[]);assert.deepEqual(s.lista60,read60);assert.deepEqual(await financial(),before);
 // Runtime drift sobre superfície67 também falha, mantendo60 financeiro íntegro.
 await sql('BEGIN');await sql('ALTER FUNCTION lista_controles67.etiquetas(integer,integer,text,text[],bigint) SET search_path=public');await reject(()=>list(),'55000');await sql('ROLLBACK');await rpc('lista_controles67.verificar');
 if(makePeer){
  const peer=await makePeer();try{
   // Mesma revisão em duas sessões: exatamente um commit, outro conflito, sem overwrite.
   const race=meta(await list(),67001).etiquetas;
   const outcomes=await Promise.allSettled([db.query('SELECT public.rpc_etiquetas_aplicar67($1,$2,$3,$4,$5)',[6701,67001,[],race.revisao,race.estadoHash]),peer.query('SELECT public.rpc_etiquetas_aplicar67($1,$2,$3,$4,$5)',[6701,67001,[],race.revisao,race.estadoHash])]);
   assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected'&&['40001','55P03'].includes(x.reason.code)).length,1);
   await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(670067,6701)');await reject(()=>peer.query("SELECT public.rpc_etiquetas_criar67(6701,'Concorrente67','#abcdef')"),'55P03');await db.query('ROLLBACK');
   await db.query('BEGIN');await db.query('SELECT id FROM public.contratos WHERE id=67001 FOR UPDATE');const labels=meta(await list(),67001).etiquetas;
   await reject(()=>peer.query('SELECT public.rpc_etiquetas_aplicar67($1,$2,$3,$4,$5)',[6701,67001,[],labels.revisao,labels.estadoHash]),'55P03');await db.query('ROLLBACK');
  }finally{await db.query('ROLLBACK').catch(()=>{});await peer.end();}
 }
 // Restrição própria do koletor revalidada no writer, não só no filtro UI.
 await sql('BEGIN');
 await sql("UPDATE public.koletores SET perfil='koletor' WHERE id=6701");
 await reject(()=>rpc('public.rpc_etiquetas_aplicar67',[6701,67002,[],0,'a'.repeat(64)]),'42501');
 await sql('ROLLBACK');
 // O parent fornece IDs próprios das coortes20/22/25/34/35/36/48/51/52/53.
 // Cada escrita overlay preserva snapshot60 e as pós-verificações da coorte.
 for(const {userId,contratoId,conferirWriter} of coortes){
  const snap=await rpc('public.rpc_lista_emprestimos67',[userId]),labels=meta(snap,contratoId)?.etiquetas;assert.equal(labels?.state,'confirmed');
  const financialBefore=await financial();await rpc('public.rpc_etiquetas_aplicar67',[userId,contratoId,labels.nomes,labels.revisao,labels.estadoHash]);assert.deepEqual(await financial(),financialBefore);
  assert.deepEqual((await rpc('public.rpc_lista_emprestimos67',[userId])).lista60,snap.lista60);await conferirWriter();await verify();
 }
 await verify();await rpc('lista_controles67.verificar');await rpc('emprestimos_lista60.verificar');
 save?.('controles67-snapshot.json',await list());
 save?.('controles67-pg.json',{installed:true,predecessorFunctionsExact:true,financialRowsExact:true,driftRollback:true,privateCatalog:true,legacyNullExplicitEmpty:true,legacyMalformedUnavailable:true,casConflict:true,coortes:coortes.length,concurrency:!!makePeer});
}
