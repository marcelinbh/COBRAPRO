import {scoped42} from './scope42.mjs';
import {readFileSync as readFile,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
const OUT=fileURLToPath(new URL('./',import.meta.url)), REPO=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFile(p,'utf8'), hash=s=>createHash('sha256').update(s).digest('hex');
const frozen={
 '0037_rpc_aporte_transferencia_caixa':'2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334',
 '0036_rpc_multa_manual_fixa':'7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f',
 '0036a_multa_metadata_estavel':'df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f',
};
for(const [name,sha] of Object.entries(frozen))if(hash(read(`${REPO}/drizzle/${name}.sql`))!==sha)throw Error(`Fonte publicada alterada ${name}`);
const sql37=read(`${REPO}/drizzle/0037_rpc_aporte_transferencia_caixa.sql`);
const funcs=functionsFromSQL(sql37), changes=[];
const bridgeNames=['ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger'];
for(const name of bridgeNames){
 const f=funcs.find(f=>f.proname===name); if(!f)throw Error(`Fonte ausente ${name}`);
 const ddl=f.ddl.replace(/CREATE (OR REPLACE )?FUNCTION/,'CREATE OR REPLACE FUNCTION').replace('BEGIN',"BEGIN\n IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;");
 changes.push({name,original:f,ddl});
}
const proof=funcs.find(f=>f.proname==='caixa37_perna_comprovada');
changes.push({name:proof.proname,original:proof,ddl:proof.ddl.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace('IF NOT FOUND THEN RETURN false; END IF;',"IF NOT FOUND THEN\n SELECT o.id INTO oid37 FROM public.assinaturas42_operacoes o WHERE o.transacao_id=tid AND o.user_id=uid;\n IF NOT FOUND THEN RETURN false; END IF; PERFORM public.assinaturas42_validar(oid37); RETURN true; END IF;")});
const metadata=f=>({name:f.proname,args:f.types,hash:f.body_hash,config:f.proconfig});
const before=changes.map(x=>metadata(x.original));
const after=changes.map(x=>metadata(functionsFromSQL(x.ddl)[0]));
const check=(expected,label)=>`DO $${label}$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('${JSON.stringify(expected).replaceAll("'","''")}'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0042 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0042 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $${label}$;\n`;
const header=`-- 0042: recebimento operacional, sem Kiwify/legado/rest writer.
-- Aplicar integralmente em janela DDL exclusiva, após backup e validação do shape físico.
-- Nenhum selo é relaxado; original verificado ANTES, reseal SOMENTE na instalação.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.users,public.clientes,public.contas_caixa,public.assinaturas,public.pagamentos_assinatura,public.transacoes_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $gate42$ DECLARE actual jsonb; BEGIN
 PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();
 IF current_user IN('service_role','anon','authenticated') OR to_regclass('public.assinaturas42_operacoes') IS NOT NULL THEN RAISE EXCEPTION '0042 instalação one-shot/owner inválido' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.transacoes_caixa'::regclass AND attname='pagamento_assinatura_id' AND NOT attisdropped) THEN RAISE EXCEPTION '0042 shape0014 incompatível com baseline37 certificado; não adaptar silenciosamente' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.assinaturas'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '[["id","integer",true],["cliente_id","integer",true],["servico","character varying(200)",true],["descricao","text",false],["valor_mensal","numeric(15,2)",true],["dia_vencimento","integer",true],["status","public.status_assinatura",true],["data_inicio","date",true],["data_cancelamento","date",false],["conta_caixa_id","integer",false],["observacoes","text",false],["createdAt","timestamp with time zone",true],["updatedAt","timestamp with time zone",true],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '0042 shape físico assinaturas desconhecido; sem adaptação automática' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.pagamentos_assinatura'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '[["id","integer",true],["assinatura_id","integer",true],["cliente_id","integer",true],["valor_pago","numeric(15,2)",true],["data_pagamento","timestamp with time zone",true],["mes_referencia","character varying(7)",true],["conta_caixa_id","integer",false],["observacoes","text",false],["createdAt","timestamp with time zone",true],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '0042 shape físico pagamentos desconhecido; sem adaptação automática' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM public.assinaturas WHERE user_id IS NULL) OR EXISTS(SELECT 1 FROM public.pagamentos_assinatura WHERE user_id IS NULL) THEN RAISE EXCEPTION '0042 tenant histórico ausente; sem saneamento automático' USING ERRCODE='55000'; END IF;
END $gate42$;
`;
// Snapshot fonte/ACL de TODAS funções públicas: só os oito nomes da ponte podem mudar.
const witness=`CREATE TEMP TABLE assinaturas42_witness ON COMMIT DROP AS SELECT oid,to_jsonb(p) snapshot,pg_get_functiondef(oid) definition FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname NOT IN(${changes.map(x=>`'${x.name}'`).join(',')});\n`;
const post=`DO $post42$ DECLARE w record; BEGIN
 FOR w IN SELECT oid,snapshot,definition FROM assinaturas42_witness LOOP
 IF (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid=w.oid) IS DISTINCT FROM w.snapshot OR pg_get_functiondef(w.oid) IS DISTINCT FROM w.definition THEN RAISE EXCEPTION '0042 função fora da ponte alterada' USING ERRCODE='55000'; END IF; END LOOP;
END $post42$;
-- Atualização controlada de selos, só após verificar original e delta de fontes exato.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
DO $verify42$ BEGIN PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar(); END $verify42$;
COMMIT;
`;
const body=read(`${OUT}/assinaturas42.body.sql`),bridge=changes.map(x=>x.ddl).join('\n');
const output=header+check(before,'before42')+witness+body+'\n'+scoped42(sql37)+'\n-- BEGIN PONTE42 EXATA\n'+bridge+'\n-- END PONTE42\n'+check(after,'after42')+post;
const target=`${REPO}/drizzle/0042_assinaturas_recebimento_atomico.sql`;
if(process.argv.includes('--check')) {
 if(read(target)!==output)throw Error('SQL0042 não corresponde ao gerador versionado');
} else writeFileSync(target,output);
console.log(`0042 gerado/verificado: 8 extensões exatas, SHA256 ${hash(output)}`);
