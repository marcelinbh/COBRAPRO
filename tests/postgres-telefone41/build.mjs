import {readFileSync as rf,writeFileSync as wf} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
const OUT=fileURLToPath(new URL('./',import.meta.url)),REPO=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>rf(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const frozen={'0036_rpc_multa_manual_fixa':'7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f','0036a_multa_metadata_estavel':'df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f','0037_rpc_aporte_transferencia_caixa':'2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334'};
for(const [name,sha] of Object.entries(frozen))if(hash(read(REPO+'/drizzle/'+name+'.sql'))!==sha)throw Error('Fonte congelada alterada '+name);
const arg=n=>process.argv[process.argv.indexOf(n)+1];
const source42=process.argv.includes('--baseline')?arg('--baseline'):REPO+'drizzle/0042_assinaturas_recebimento_atomico.sql';
const sql42=read(source42);
const expected42=process.argv.includes('--baseline')?arg('--sha256'):'0df0301ade56145681b721da149fc3048a46ed630cfe1be771c0bcfcf25c83fb';
if(!expected42 || hash(sql42)!==expected42)throw Error('Baseline fonte/hash divergente: fornecer --baseline PATH --sha256 SHA após revisão explícita');
const fns=functionsFromSQL(sql42),map=new Map(fns.map(f=>[f.proname,f]));
const names=['ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger'];
const changes=names.map(name=>{const f=map.get(name);if(!f||!f.body.includes('assinaturas42_consumir')||f.body.includes('telefone41_consumir'))throw Error('42 delta ausente '+name);return {original:f,ddl:f.ddl.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace('BEGIN',"BEGIN\n IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;")};});
const proof=map.get('caixa37_perna_comprovada');
if(!proof.body.includes('assinaturas42_validar') || !proof.body.includes('IF NOT FOUND THEN RETURN false; END IF;'))throw Error('Prova42 ausente');
changes.push({original:proof,ddl:proof.ddl.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace('IF NOT FOUND THEN RETURN false; END IF;', 'IF NOT FOUND THEN RETURN telefone41.perna_comprovada(tid,uid); END IF;')});
const meta=f=>({name:f.proname,args:f.types,hash:f.body_hash,config:f.proconfig});
const check=(expected,label)=>`DO $${label}$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('${JSON.stringify(expected).replaceAll("'","''")}'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0041 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0041 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $${label}$;\n`;
const shapes=JSON.parse(read(OUT+'physical-shape.json'));
const physical=Object.entries(shapes).map(([tab,expected])=>`SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.${tab}'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '${JSON.stringify(expected)}'::jsonb THEN RAISE EXCEPTION '0041 shape físico ${tab} desconhecido' USING ERRCODE='55000'; END IF;
 IF pg_get_serial_sequence('public.${tab}','id') IS NULL OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.${tab}'::regclass AND attnum>0 AND NOT attisdropped AND (attgenerated<>'' OR attidentity<>'')) THEN RAISE EXCEPTION '0041 sequence/geração incompatível ${tab}' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.${tab}'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION '0041 trigger telefone prévia não certificada' USING ERRCODE='55000'; END IF;`).join('\n');
const header=`-- 0041 sucessora certificada: aplicar APÓS 0042 exata (ordem intencional 42 -> 41).
-- Prospectiva; não reescreve dados/histórico nem reserva contas para um único módulo.
-- Aplicação integral em janela DDL exclusiva por owner. Sem schema PostgREST adicional.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.users,public.vendas_telefone,public.parcelas_venda_telefone,public.contas_caixa,public.transacoes_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $gate41$ DECLARE actual jsonb; BEGIN
 IF current_setting('server_version_num')::integer/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR current_user IN('service_role','anon','authenticated') OR to_regnamespace('telefone41') IS NOT NULL THEN RAISE EXCEPTION '0041 PG17/read committed/owner/one-shot' USING ERRCODE='55000'; END IF;
 PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();
 IF to_regclass('public.assinaturas42_operacoes') IS NULL THEN RAISE EXCEPTION '0042 deve preceder 0041' USING ERRCODE='55000'; END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated'))<>3 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('service_role','anon','authenticated') AND (rolsuper OR rolcreaterole OR pg_has_role(oid,(SELECT oid FROM pg_roles WHERE rolname=current_user),'MEMBER'))) THEN RAISE EXCEPTION 'Roles41 inseguras' USING ERRCODE='55000'; END IF;
 ${physical}
 IF NOT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid='public.status_venda_telefone'::regtype AND enumlabel='cancelado') OR NOT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid='public.status_parcela'::regtype AND enumlabel='paga') THEN RAISE EXCEPTION 'Enums41 incompatíveis' USING ERRCODE='55000'; END IF;
END $gate41$;
`;
const witness=`CREATE TEMP TABLE telefone41_witness ON COMMIT DROP AS SELECT oid,to_jsonb(p) snapshot,pg_get_functiondef(oid) definition FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname NOT IN(${changes.map(c=>`'${c.original.proname}'`).join(',')});
CREATE TEMP TABLE telefone41_triggers_witness ON COMMIT DROP AS SELECT oid,to_jsonb(t) snapshot FROM pg_trigger t;
`;
const post=`DO $post41$ DECLARE w record; BEGIN
 FOR w IN SELECT oid,snapshot,definition FROM telefone41_witness LOOP
 IF (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid=w.oid) IS DISTINCT FROM w.snapshot OR pg_get_functiondef(w.oid) IS DISTINCT FROM w.definition THEN RAISE EXCEPTION '0041 função fora da ponte alterada' USING ERRCODE='55000'; END IF; END LOOP;
 FOR w IN SELECT oid,snapshot FROM telefone41_triggers_witness LOOP
 IF (SELECT to_jsonb(t) FROM pg_trigger t WHERE t.oid=w.oid) IS DISTINCT FROM w.snapshot THEN RAISE EXCEPTION '0041 trigger predecessor alterada' USING ERRCODE='55000'; END IF; END LOOP;
END $post41$;
-- Selagem de instalação apenas, após fontes antes/depois e testemunho sem alterações externas.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
DO $verify41$ BEGIN PERFORM telefone41.verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar(); END $verify41$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;
const bridge=changes.map(c=>c.ddl).join('\n');
const output=header+check(changes.map(c=>meta(c.original)),'before41')+witness+read(OUT+'telefone41.body.sql')+'\n-- BEGIN PONTE41 COMPOSTA SOBRE42\n'+bridge+'\n-- END PONTE41\n'+check(changes.map(c=>meta(functionsFromSQL(c.ddl)[0])),'after41')+post;
const destination=REPO+'drizzle/0041_telefone_atomico.sql';
if(process.argv.includes('--check')){if(read(destination)!==output)throw Error('SQL41 não corresponde ao gerador versionado');}
else wf(destination,output);
console.log('41 gerado/verificado; preservadas oito extensões42; SHA256 '+hash(output));
