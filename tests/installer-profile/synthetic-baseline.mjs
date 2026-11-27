import pg from 'pg';
export async function construct({profile,config,sql,financial,captureOrder,assert,save,result}){
 if(profile==='private')return;
 // Historical46's fixture233 is deliberately NOBYPASS-only. Consequently this
 // synthetic local fixture is first built byte-exact under its historical profile.
 // BEFORE51 and BEFORE all installer tests, construct the requested role-sealed
 // baseline; this is NOT runtime drift adoption, NOT production, NOT adapter SQL.
 // Exactly two preexisting mutable fixture signatures depend on BYPASS bits.
 const data=await financial(),catalog=await captureOrder();
 const seals=async()=>(await sql("SELECT 'multimodal' name,assinatura value FROM public.multimodal_manifesto WHERE id=1 UNION ALL SELECT 'caixa37',assinatura FROM public.caixa37_manifesto WHERE id=1 ORDER BY name LIMIT 2"));
 const before=await seals(),bootstrap=new pg.Client({...config,user:'bootstrap51'});await bootstrap.connect();
 try{await bootstrap.query('ALTER ROLE postgres NOSUPERUSER BYPASSRLS LOGIN; ALTER ROLE service_role NOSUPERUSER BYPASSRLS NOLOGIN');}finally{await bootstrap.end();}
 // Fail-closed old role-seal divergence must genuinely occur, before initializing
 // these two synthetic baseline signatures with the exact existing metadata code.
 let refused;try{await sql('SELECT public.multimodal_verificar()');}catch(e){refused={code:e.code,message:e.message};}
 assert.equal(refused?.code,'55000');assert.equal(refused.message,'Metadata/ACL/trigger multimodal incompatível');
 const updates=await sql("WITH m AS (UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1 RETURNING id),c AS (UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1 RETURNING id) SELECT (SELECT count(*)::int FROM m) multimodal,(SELECT count(*)::int FROM c) caixa37 LIMIT 1");assert.deepEqual(updates,[{multimodal:1,caixa37:1}]);
 const after=await seals();assert.notDeepEqual(after,before);assert.deepEqual(await financial(),data);assert.deepEqual(await captureOrder(),catalog);
 result.syntheticBaselineSetup={privateOnly:true,before51:true,reason:'historical46 fixture233 NONSUPER/NOBYPASS requires synthetic role-sealed baseline initialization',roleSealRefusedBeforeFixtureInitialization:refused,onlyFixtureSignaturesInitialized:['public.multimodal_manifesto.assinatura','public.caixa37_manifesto.assinatura'],before,after,financialByteEquivalent:true,completeCatalogEquivalent:true,sourceOwnersConfigACLUnchanged:true,production:false};save('synthetic-baseline-supabase.json',result.syntheticBaselineSetup);
}
