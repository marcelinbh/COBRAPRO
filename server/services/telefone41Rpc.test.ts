import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {intencaoTelefone41Schema,prepararIntencaoTelefone41} from '../../shared/telefone41';
import {executarTelefone41,type ClienteTelefone41} from './telefone41Rpc';
const key='9c5577be-ab41-41ca-b432-76a28fa33211';
const intent={idempotencyKey:key,request:{acao:'receber',vendaId:44,parcelaId:31,contaCaixaId:901,valorPago:'0.01'}} as const;
const proof={success:true,repetida:false,userId:901,idempotencyKey:key,acao:'receber',vendaId:44,parcelasIds:[],transacoesIds:[70],status:'quitado'};
const mock=(data:unknown=proof,error:unknown=null)=>{const rpc=vi.fn().mockResolvedValue({data,error});return {rpc,client:{rpc} as ClienteTelefone41};};
describe('telefone41: contrato e recovery',()=>{
 it('aceita centavos canônicos; rejeita owner/payload adicional e precisão solta',()=>{
  expect(intencaoTelefone41Schema.parse(intent)).toEqual(intent);
  for(const change of [{valorPago:1},{valorPago:'1.001'},{valorPago:'01.00'},{userId:902},{valorPago:'NaN'},{valorPago:'1e2'}]) expect(()=>intencaoTelefone41Schema.parse({...intent,request:{...intent.request,...change}})).toThrow();
 });
 it('mantém UUID E payload persistidos após timeout e edição dos campos',()=>{
  let saved:string|null=null;const storage={getItem:()=>saved,setItem:(_k:string,v:string)=>{saved=v;}};
  const first=prepararIntencaoTelefone41(storage,'tenant:901:parcela31',intent.request);
  const next=prepararIntencaoTelefone41(storage,'tenant:901:parcela31',{...intent.request,contaCaixaId:902});
  expect(next).toEqual(first);expect(next.request).toEqual(intent.request);
 });
 it('falha fechada se persistência corrompida ou sem storage, sem gerar outra intenção',()=>{
  expect(()=>prepararIntencaoTelefone41({getItem:()=>'{bad',setItem:vi.fn()},'key',intent.request)).toThrow();
  expect(()=>prepararIntencaoTelefone41({getItem:()=>null,setItem:()=>{throw Error('storage denied');}},'key',intent.request)).toThrow();
 });
 it('uma RPC pública transacional específica com owner da sessão, sem .from',async()=>{
  const m=mock();expect(await executarTelefone41(m.client,901,intent)).toEqual(proof);
  expect(m.rpc).toHaveBeenCalledTimes(1);expect(m.rpc).toHaveBeenCalledWith('rpc_executar_telefone41',{p_user_id:901,p_chave:key,p_request:intent.request});
 });
 it('timeout preserva intenção e não tenta fallback/retry oculto',async()=>{
  const m=mock();m.rpc.mockRejectedValue(Error('timeout'));
  await expect(executarTelefone41(m.client,901,intent)).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR',message:expect.stringContaining('MESMO UUID')});expect(m.rpc).toHaveBeenCalledTimes(1);
 });
 it('schema ausente não ativa writer antigo',async()=>{
  const m=mock(null,{code:'PGRST106'});await expect(executarTelefone41(m.client,901,intent)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});expect(m.rpc).toHaveBeenCalledTimes(1);
 });
 it('não aceita prova de outro owner, UUID, venda ou envelope',async()=>{
  for(const change of [{userId:902},{vendaId:45},{idempotencyKey:'836fd544-46de-46ca-b432-76a28fa33211'},{status:'pendente'},{success:false}]){const m=mock({...proof,...change});await expect(executarTelefone41(m.client,901,intent)).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});}
  const m=mock();m.rpc.mockResolvedValue({data:proof});await expect(executarTelefone41(m.client,901,intent)).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});
 });
 it('recovery confirmed valida a MESMA intenção e unknown não libera nova chave',async()=>{
  const m=mock({status:'confirmed',result:proof});expect(await executarTelefone41(m.client,901,intent,true)).toEqual({status:'confirmed',result:proof});expect(m.rpc.mock.calls[0][0]).toBe('rpc_reconciliar_telefone41');
  const u=mock({status:'unknown',result:null});expect(await executarTelefone41(u.client,901,intent,true)).toEqual({status:'unknown',result:null});
 });
 it('fence libera descarte apenas com owner/UUID exatos e estado not_executed',async()=>{
  const f=mock({status:'not_executed',result:null,userId:901,idempotencyKey:key});
  expect(await executarTelefone41(f.client,901,intent,false,true)).toEqual({status:'not_executed',result:null});
  expect(f.rpc).toHaveBeenCalledWith('rpc_abandonar_telefone41',{p_user_id:901,p_chave:key,p_request:intent.request});
  for(const extra of [{userId:902},{idempotencyKey:'836fd544-46de-46ca-b432-76a28fa33211'},{result:proof}]){
   const bad=mock({status:'not_executed',result:null,userId:901,idempotencyKey:key,...extra});
   await expect(executarTelefone41(bad.client,901,intent,false,true)).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});
  }
 });
 it('nenhum writer REST antigo permanece na cópia candidata do módulo',()=>{
  const router=readFileSync(new URL('../routers.ts',import.meta.url),'utf8');
  const sec=router.slice(router.indexOf('const vendasTelefoneRouter'),router.indexOf('// ─── ETIQUETAS ROUTER'));
  expect(sec).toContain('...telefone41Writers');expect(sec).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  const safety=readFileSync(new URL('./financialSafety.ts',import.meta.url),'utf8');expect(safety).toContain('throw new TRPCError');
 });
});
