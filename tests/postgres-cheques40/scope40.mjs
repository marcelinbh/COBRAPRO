import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
export function scoped40(sql37){
 const get=name=>functionsFromSQL(sql37).find(f=>f.proname===name).ddl;
 const globalLedger='user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid)';
 let set=get('caixa37_conjunto').replace('caixa37_conjunto(uid integer)','cheques40_conjunto(aid integer)');
 set=set.replaceAll(globalLedger,'conta_caixa_id=aid').replace('FROM public.contas_caixa WHERE user_id=uid','FROM public.contas_caixa WHERE id=aid');
 let lock=get('caixa37_travar').replace('caixa37_travar(uid integer)','cheques40_travar_conta(uid integer,aid integer)');
 lock=lock.replaceAll('public.caixa37_conjunto(uid)','public.cheques40_conjunto(aid)').replace('WHERE user_id=uid OR conta_caixa_id=ANY(aids)','WHERE conta_caixa_id=aid');
 let validate=get('caixa37_validar_livro').replace('caixa37_validar_livro(uid integer)','cheques40_validar_conta(uid integer,aid integer)');
 validate=validate.replace('FROM public.contas_caixa WHERE user_id=uid LOOP','FROM public.contas_caixa WHERE id=aid AND user_id=uid LOOP').replace(globalLedger,'conta_caixa_id=aid');
 validate=validate.replace('SELECT id FROM public.caixa37_operacoes WHERE user_id=uid',"SELECT id FROM public.caixa37_operacoes o WHERE o.user_id=uid AND EXISTS(SELECT 1 FROM public.caixa37_pernas p JOIN public.transacoes_caixa l ON l.id=p.transacao_id WHERE p.operacao_id=o.id AND l.conta_caixa_id=aid)");
 validate=validate.replace('WHERE p.user_id=uid AND (ac.id IS NULL','WHERE p.conta_id=aid AND (p.user_id IS DISTINCT FROM uid OR ac.id IS NULL');
 validate=validate.replace('END $$;',()=>` FOR oid37 IN SELECT operacao_id FROM public.cheques40_operacoes WHERE ledger->>'conta_caixa_id'=aid::text LOOP PERFORM public.cheques40_validar(oid37); END LOOP;
 FOR oid37 IN SELECT id FROM public.assinaturas42_operacoes WHERE conta_id=aid LOOP PERFORM public.assinaturas42_validar(oid37); END LOOP;
END $$;`);
 if([set,lock,validate].some(s=>s.includes('WHERE user_id=uid OR')))throw Error('Escopo40 incompleto');
 return '-- Protocolo37 derivado, somente conta selecionada; não modifica helpers37.\n'+[set,lock,validate].join('\n')+'\nREVOKE ALL ON FUNCTION public.cheques40_conjunto(integer),public.cheques40_travar_conta(integer,integer),public.cheques40_validar_conta(integer,integer) FROM PUBLIC,anon,authenticated,service_role;\n';
}
