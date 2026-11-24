import {beforeEach,it,expect,vi} from 'vitest';
import {assinaturasRouter} from './assinaturas';
const {rpc42,getSupabaseClientAsync}=vi.hoisted(()=>{const rpc42=vi.fn();return {rpc42,getSupabaseClientAsync:vi.fn(async()=>({rpc:rpc42}))};});
vi.mock('../db',()=>({getSupabaseClientAsync}));
const input={assinaturaId:42,clienteId:1,contaCaixaId:7,valorPago:'29.90',mesReferencia:'2026-11',observacoes:null,idempotencyKey:'bd9f84c1-d188-43ba-861a-b8e9fba984be'};
const {idempotencyKey,...request}=input;
const proof={estado:'fenced',regra:'assinaturas42_fence_v1',idempotencyKey,request};
const caller=(user:any)=>assinaturasRouter.createCaller({user,req:{},res:{}} as any);
beforeEach(()=>{rpc42.mockReset();getSupabaseClientAsync.mockClear();rpc42.mockResolvedValue({data:proof,error:null});});
it('caller protegido real recusa anonimato sem chamar RPC',async()=>{await expect(caller(null).conferirPagamento(input)).rejects.toMatchObject({code:'UNAUTHORIZED'});expect(rpc42).not.toHaveBeenCalled();});
it('caller real usa owner ctx, não clienteId nem campo forjado',async()=>{expect(await caller({id:4682}).conferirPagamento(input)).toEqual(proof);expect(rpc42).toHaveBeenCalledTimes(1);expect(rpc42.mock.calls[0][0]).toBe('rpc_conferir_assinatura42');expect(rpc42.mock.calls[0][1].p_user_id).toBe(4682);});
it.each(['conferirPagamento','registrarPagamento'] as const)('caller%s rejeita owner e params extras via schema strict antes da RPC',async(method)=>{await expect(caller({id:4682})[method]({...input,userId:1} as any)).rejects.toMatchObject({code:'BAD_REQUEST'});expect(rpc42).not.toHaveBeenCalled();});
it('writer caller real usa ctx owner e somente writer42',async()=>{rpc42.mockResolvedValue({data:{success:true,regra:'assinaturas42_v1',repetida:false,operationId:'d28c81de-13db-40be-bf2d-e7f438fe4972',idempotencyKey,...request,pagamentoId:'15',transacaoCaixaId:'20',vigenciaAte:'2026-11-30',status:'ativa'},error:null});
 // Resultado não contém observacoes, campo deliberadamente removido do envelope de sucesso.
 const response=await rpc42.getMockImplementation()!();delete response.data.observacoes;
 rpc42.mockResolvedValue(response);await caller({id:4682}).registrarPagamento(input);
 expect(rpc42).toHaveBeenCalledTimes(1);expect(rpc42.mock.calls[0][0]).toBe('rpc_receber_assinatura42');expect(rpc42.mock.calls[0][1].p_user_id).toBe(4682);
});
