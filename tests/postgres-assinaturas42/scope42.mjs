// Derivação mecânica da fonte37 pinada: apenas escopo; nenhuma função predecessora é alterada.
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
export function scoped42(sql37) {
 const get=name=>functionsFromSQL(sql37).find(f=>f.proname===name).ddl;
 const oldLedger="user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid)";
 let conjunto=get('caixa37_conjunto').replace('caixa37_conjunto(uid integer)','assinaturas42_conjunto(aid integer)');
 conjunto=conjunto.replaceAll(oldLedger,'conta_caixa_id=aid').replace('FROM public.contas_caixa WHERE user_id=uid','FROM public.contas_caixa WHERE id=aid');
 let lock=get('caixa37_travar').replace('caixa37_travar(uid integer)','assinaturas42_travar_conta(uid integer,aid integer)');
 lock=lock.replaceAll('public.caixa37_conjunto(uid)','public.assinaturas42_conjunto(aid)').replace('WHERE user_id=uid OR conta_caixa_id=ANY(aids)','WHERE conta_caixa_id=aid');
 let validate=get('caixa37_validar_livro').replace('caixa37_validar_livro(uid integer)','assinaturas42_validar_conta(uid integer,aid integer)');
 validate=validate.replace('FROM public.contas_caixa WHERE user_id=uid LOOP','FROM public.contas_caixa WHERE id=aid AND user_id=uid LOOP');
 validate=validate.replace(oldLedger,'conta_caixa_id=aid');
 validate=validate.replace('SELECT id FROM public.caixa37_operacoes WHERE user_id=uid',"SELECT id FROM public.caixa37_operacoes o WHERE o.user_id=uid AND (o.request->>'contaOrigemId'=aid::text OR o.request->>'contaDestinoId'=aid::text OR EXISTS(SELECT 1 FROM public.caixa37_pernas p JOIN public.transacoes_caixa leg ON leg.id=p.transacao_id WHERE p.operacao_id=o.id AND leg.conta_caixa_id=aid))");
 validate=validate.replace('WHERE p.user_id=uid AND (ac.id IS NULL','WHERE p.conta_id=aid AND (p.user_id IS DISTINCT FROM uid OR ac.id IS NULL');
 validate=validate.replace("END $$;",()=>` FOR oid37 IN SELECT id FROM public.assinaturas42_operacoes WHERE conta_id=aid LOOP PERFORM public.assinaturas42_validar(oid37); END LOOP;
END $$;`);
 if([conjunto,lock,validate].some(s=>s.includes('WHERE user_id=uid OR')))throw Error('escopo não substituído');
 return '-- Helpers42 próprios, derivados da fonte37 pinada, sem alterar metadata37 ou função37.\n'+[conjunto,lock,validate].join('\n')+`\nREVOKE ALL ON FUNCTION public.assinaturas42_conjunto(integer),public.assinaturas42_travar_conta(integer,integer),public.assinaturas42_validar_conta(integer,integer) FROM PUBLIC,anon,authenticated,service_role;\n`;
}
