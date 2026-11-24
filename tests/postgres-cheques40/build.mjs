import {scoped40} from './scope40.mjs';
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
const HERE=fileURLToPath(new URL('./',import.meta.url)),REPO=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFileSync(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){if(args[i]==='--check')continue;if(args[i]==='--artifacts'&&args[i+1]){i++;continue;}throw Error('Usage: node tests/postgres-cheques40/build.mjs [--check] [--artifacts OUTSIDE_REPO]');}
const baselines=[`${REPO}drizzle/0042_assinaturas_recebimento_atomico.sql`,`${REPO}drizzle/0041_telefone_atomico.sql`];
const expected=['0df0301ade56145681b721da149fc3048a46ed630cfe1be771c0bcfcf25c83fb','dead49422eecd04c18b241dd0f4c4421f0e8edc1e5ccc9ecebda10adfc76bb6d'];
for(const [i,path] of baselines.entries())if(hash(read(path))!==expected[i])throw Error('Predecessor42/41 hash divergente: '+path);
const baseline=baselines.join(' -> ');
const frozen={'0036_rpc_multa_manual_fixa':'7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f','0036a_multa_metadata_estavel':'df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f','0037_rpc_aporte_transferencia_caixa':'2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334'};
for(const [n,h] of Object.entries(frozen))if(hash(read(`${REPO}/drizzle/${n}.sql`))!==h)throw Error('Fonte publicada alterada: '+n);
const source=baselines.map(read).join('\n'), fmap=new Map();for(const path of baselines)for(const f of functionsFromSQL(read(path)))fmap.set(f.proname,f);const funcs=[...fmap.values()],changes=[];
const names=['ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger'];
for(const name of names){
 const matches=funcs.filter(x=>x.proname===name);if(matches.length!==1)throw Error(`Baseline42 deve conter uma definição final de ${name}`);
 const f=matches[0];if(!f.ddl.includes('public.assinaturas42_consumir(')||f.ddl.includes('public.cheques40_consumir('))throw Error('Baseline42 incompleto/40 já composto: '+name);
 const ddl=f.ddl.replace(/CREATE (OR REPLACE )?FUNCTION/,'CREATE OR REPLACE FUNCTION').replace('BEGIN',"BEGIN\n IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;");
 if(!ddl.includes(f.ddl.slice(f.ddl.indexOf('BEGIN')+5)))throw Error('Delta não aditivo');changes.push({original:f,ddl});
}
const proof=funcs.filter(f=>f.proname==='caixa37_perna_comprovada');if(proof.length!==1)throw Error('Baseline42 proof ausente/duplicada');
const f=proof[0];if(!f.ddl.includes('public.assinaturas42_validar('))throw Error('Prova42 ausente; não sobrescrever');
const addition="BEGIN\n SELECT o.operacao_id INTO oid37 FROM public.cheques40_operacoes o WHERE o.transacao_id=tid AND o.user_id=uid;\n IF FOUND THEN PERFORM public.cheques40_validar(oid37); RETURN true; END IF;";
changes.push({original:f,ddl:f.ddl.replace(/CREATE (OR REPLACE )?FUNCTION/,'CREATE OR REPLACE FUNCTION').replace('BEGIN',addition)});
const meta=f=>({name:f.proname,args:f.types,hash:f.body_hash,config:f.proconfig});
const check=(expected,label)=>`DO $${label}$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('${JSON.stringify(expected).replaceAll("'","''")}'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0040 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0040 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $${label}$;\n`;
const shape=[['id','integer',true],['cliente_id','integer',false],['numero_cheque','character varying(50)',true],['banco','character varying(100)',false],['agencia','character varying(20)',false],['conta','character varying(30)',false],['valor_nominal','numeric(15,2)',true],['data_emissao','date',true],['data_vencimento','date',true],['taxa_desconto','numeric(5,2)',false],['valor_descontado','numeric(15,2)',false],['valor_liquido','numeric(15,2)',false],['status','character varying(20)',false],['conta_caixa_id','integer',false],['observacoes','text',false],['createdAt','timestamp with time zone',true],['updatedAt','timestamp with time zone',true],['user_id','integer',false]];
const header=`-- 0040 após0042 FINAL. Gerado deterministicamente; baseline42 SHA256 ${hash(source)}.
-- Uma extensão exata40 por guarda, sem copiar capacidades42 ou alterar fontes publicadas36/36a/37.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.cheques,public.users,public.clientes,public.contas_caixa,public.contratos,public.parcelas,public.transacoes_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $gate40$ DECLARE actual jsonb; BEGIN
 PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR current_user IN('service_role','anon','authenticated')
 OR to_regclass('public.assinaturas42_operacoes') IS NULL OR to_regclass('public.cheques40_operacoes') IS NOT NULL
 THEN RAISE EXCEPTION '0040 one-shot/owner/PG17/baseline42 inválido' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.cheques'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '${JSON.stringify(shape)}'::jsonb THEN RAISE EXCEPTION '0040 shape físico informado divergente; sem inferência/backfill' USING ERRCODE='55000'; END IF;
 IF (SELECT relowner FROM pg_class WHERE oid='public.cheques'::regclass)<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.cheques'::regclass)
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.cheques'::regclass AND NOT tgisinternal)
 OR pg_get_serial_sequence('public.cheques','id') IS NULL THEN RAISE EXCEPTION '0040 owner/RLS/trigger/sequence divergente' USING ERRCODE='55000'; END IF;
END $gate40$;
`;
const changed=changes.map(c=>`'${c.original.proname}'`).join(',');
const witness=`CREATE TEMP TABLE cheques40_witness ON COMMIT DROP AS SELECT oid,to_jsonb(p) snapshot,pg_get_functiondef(oid) definition FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname NOT IN(${changed});\n`;
const post=`DO $post40$ DECLARE w record; BEGIN
 FOR w IN SELECT oid,snapshot,definition FROM cheques40_witness LOOP
 IF (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid=w.oid) IS DISTINCT FROM w.snapshot OR pg_get_functiondef(w.oid) IS DISTINCT FROM w.definition THEN RAISE EXCEPTION '0040 função fora da ponte alterada' USING ERRCODE='55000'; END IF; END LOOP;
END $post40$;
-- Selos de metadata apenas na instalação, após checks exatos; sem reseal runtime/financeiro.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
DO $verify40$ BEGIN PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar(); END $verify40$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;
const bridge=changes.map(x=>x.ddl).join('\n');
const output=header+check(changes.map(x=>meta(x.original)),'before40')+witness+read(`${HERE}cheques40.body.sql`)+scoped40(read(`${REPO}/drizzle/0037_rpc_aporte_transferencia_caixa.sql`))+'\n-- BEGIN PONTE40 EXATA\n'+bridge+'\n-- END PONTE40\n'+check(changes.map(x=>meta(functionsFromSQL(x.ddl)[0])),'after40')+post;
const destination=REPO+'drizzle/0040_cheques_transacionais.sql';
const actual=readFileSync(destination),generated=Buffer.from(output,'utf8');
if(!actual.equals(generated))throw Error('SQL40 não é BYTE-IDÊNTICO ao gerador versionado; não sobrescrito');
if(hash(output)!=='d829fa99f81b3ec0f023480cad0cdb80a5c704e58c6aed532fc2ad10ec91d1af')throw Error('SHA256 final40 divergente');
if(args.includes('--artifacts')){
 const dest=resolve(args[args.indexOf('--artifacts')+1]);
 let ancestor=dest;while(true){try{ancestor=realpathSync(ancestor);break;}catch{const parent=dirname(ancestor);if(parent===ancestor)throw Error('artifact ancestor missing');ancestor=parent;}}
 const inside=p=>{const rel=relative(realpathSync(REPO),p);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));};
 if(inside(dest)||inside(ancestor))throw Error('Artifacts devem ficar fora do repo');
 mkdirSync(dest,{recursive:true,mode:0o700});if(inside(realpathSync(dest)))throw Error('Artifacts symlink dentro do repo');
 writeFileSync(dest+'/0040_cheques_bridge.delta.sql',bridge+'\n');
 writeFileSync(dest+'/build.json',JSON.stringify({baselines:baselines.map((path,i)=>({path:relative(REPO,path),sha256:expected[i]})),baseline42Sha256:hash(source),outputSha256:hash(output),byteExact:true,frozen,changed:changes.map(x=>x.original.proname)},null,2)+'\n');
}
console.log('PASS SQL40 --check BYTE-EXACT SHA256 '+hash(output));
