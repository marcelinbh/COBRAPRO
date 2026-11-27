import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {capacidadeInclusao52} from '../shared/inclusao52';
import {cotar51,executar51,estado51} from './services/obrigacoes51Rpc';
import {validarProjecao51} from '../shared/obrigacoes51Projection';
const proof=(name:string)=>JSON.parse(readFileSync(new URL(`../tests/composition-obrigacoes/proofs52/${name}.json`,import.meta.url),'utf8'));
describe('provas SQL PG17 novas52, não objetos financeiros fabricados',()=>{
 it('catálogo52 SQL literal fechado',()=>{const p=proof('capacidade52');expect(capacidadeInclusao52.parse(p)).toEqual(p);expect(p.coortes).toHaveLength(5);});
 for(const cohort of ['21','semanal','quinzenal','diario','legado','legado_registrado']){
  it(`${cohort}: facade51 única owner derivado, closure/recovery original preservados`,async()=>{
   const p=proof('inclusao52-'+cohort),input={ownerId:1,sessionScope:'a'.repeat(64),idempotencyKey:p.k,...p.request};
   const rpc=vi.fn().mockResolvedValue({data:p.q,error:null});expect(await cotar51({rpc},1,{ownerId:1,sessionScope:input.sessionScope,contratoId:p.q.contratoId,proposta:p.q.proposta})).toEqual(p.q);expect(rpc).toHaveBeenCalledTimes(1);
   rpc.mockClear().mockResolvedValue({data:p.r,error:null});expect(await executar51({rpc},1,input)).toEqual(p.r);expect(rpc).toHaveBeenCalledWith('rpc_executar_obrigacoes51',{p_user_id:1,p_chave:p.k,p_request:p.request});expect(rpc).toHaveBeenCalledTimes(1);
   rpc.mockClear();expect(await executar51({rpc},1,input,true)).toEqual(p.r);expect(rpc).toHaveBeenCalledWith('rpc_conferir_obrigacoes51',{p_user_id:1,p_chave:p.k,p_request:p.request});await expect(executar51({rpc},2,input)).rejects.toThrow();expect(rpc).toHaveBeenCalledTimes(1);
   expect(p.r.resultado).toMatchObject({valorRecebido:'0.00',contaDestinoId:null,caixaPreservado:true});expect(p.after.ledger).toEqual(p.before.ledger);expect(p.after.contrato.valor_principal).toEqual(p.before.contrato.valor_principal);expect(p.receiptProofs).toHaveLength(2);
  });
  it(`${cohort}: seleção inteira inclui A; após baixa real nominal A não é dívida`,async()=>{
   const p=proof('inclusao52-'+cohort),ids=p.after.parcelas.map((x:{id:number})=>x.id),id=p.r.resultado.idsAfetados[0];
   expect(validarProjecao51(p.projection,1,p.q.contratoId,ids)).toEqual(p.projection);expect(()=>validarProjecao51(p.projection,1,p.q.contratoId,ids.filter((x:number)=>x!==id))).toThrow();
   const paidIds=p.secondAfter.parcelas.map((x:{id:number})=>x.id);expect(validarProjecao51(p.paid,1,p.q.contratoId,paidIds)).toEqual(p.paid);expect(p.paid.parcelas.find((x:{parcelaId:number})=>x.parcelaId===id)).toMatchObject({obrigacaoAtual:'0.00',componenteAdicional:'17.35',statusObrigacao:'paga'});
   const rpc=vi.fn().mockResolvedValue({data:p.paid,error:null});expect(await estado51({rpc},1,p.q.contratoId)).toEqual(p.paid);expect(rpc).toHaveBeenCalledTimes(1);
  });
 }
});
