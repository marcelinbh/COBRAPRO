import { describe,it,expect,vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  cotarReparcelamento43,executarReparcelamento43,reconciliarReparcelamento43,
  intencao43DaCotacao,conferirCotacao43,reparcelamento43PreviewSchema,
} from '../../../server/services/reparcelamento43Rpc';
import {guardarIntencao43,lerIntencao43,concluirIntencao43} from '../../../shared/reparcelamento43Intencao';
const physical=JSON.parse(readFileSync(new URL('../fixtures/synthetic-roundtrip43.json',import.meta.url),'utf8'));
const q=physical.q;
const input={...q.request,estadoHash:q.estadoHash,cotacaoHash:q.cotacaoHash,idempotencyKey:physical.k};
const result=physical.r;
const client=(data:unknown,error:unknown=null)=>({rpc:vi.fn().mockResolvedValue({data,error})});
describe('Reparcelamento43: fixture realmente produzido por PostgreSQL17 local',()=>{
 it('valida simulação exata, datas e sobra de um centavo',()=>{
  expect(conferirCotacao43(q,1,q.request)).toEqual(q);
  expect(q.parcelas.map((p:any)=>p.valor)).toEqual(['33.33','33.33','33.34']);
  expect(intencao43DaCotacao(q,physical.k)).toEqual(input);
 });
 it('preview envia apenas fonte explícita, owner servidor e request fechado',async()=>{
  const c=client(q);expect(await cotarReparcelamento43(c,1,q.request)).toEqual(q);
  expect(c.rpc).toHaveBeenCalledTimes(1);expect(c.rpc).toHaveBeenCalledWith('rpc_cotar_reparcelamento43',{p_user_id:1,p_request:q.request});
 });
 it('execução envia UM RPC e confere UUID/hash/owner da MESMA intenção',async()=>{
  const c=client(result);expect(await executarReparcelamento43(c,1,input)).toEqual(result);
  const {idempotencyKey,...request}=input;
  expect(c.rpc).toHaveBeenCalledTimes(1);expect(c.rpc).toHaveBeenCalledWith('rpc_executar_reparcelamento43',{p_user_id:1,p_chave_idempotencia:idempotencyKey,p_request:request});
 });
 it('não aceita spoof de owner, campos extras nem dinheiro numérico/ambíguo',async()=>{
  for(const modified of [{...input,userId:2},{...input,taxaJuros:5},{...input,taxaJuros:'1.001'},{...input,dataInicio:'2026-02-30'}]){
   const c=client(result);await expect(executarReparcelamento43(c,1,modified)).rejects.toMatchObject({code:'BAD_REQUEST'});expect(c.rpc).not.toHaveBeenCalled();
  }
  const c=client(result);await expect(executarReparcelamento43(c,0,input)).rejects.toMatchObject({code:'UNAUTHORIZED'});expect(c.rpc).not.toHaveBeenCalled();
 });
 it('recusa confirmação trocada, desembolso e IDs repetidos',async()=>{
  for(const mutation of [{userId:2},{idempotencyKey:randomUUID()},{estadoHash:'a'.repeat(64)},{cotacaoHash:'a'.repeat(64)},{contratoOrigemId:1},{desembolso:'100.00'},{totalNovo:'100.01'},{parcelasIds:[1,1,1]}]){
   const c=client({...result,...mutation});await expect(executarReparcelamento43(c,1,input)).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});expect(c.rpc).toHaveBeenCalledTimes(1);
  }
 });
 it('recusa cotação com parcela/datas/total divergentes, sem floating point',()=>{
  for(const mutation of [{userId:2},{totalNovo:'100.01'},{saldoDevedor:'100.01'},{parcelas:q.parcelas.map((p:any,i:number)=>({...p,valor:i===2?'33.33':p.valor}))},{parcelas:q.parcelas.map((p:any,i:number)=>({...p,vencimento:i===2?'2027-03-28':p.vencimento}))}])
   expect(()=>conferirCotacao43({...q,...mutation},1,q.request)).toThrow();
 });
 it('timeout não faz retry/fallback nem inventa sucesso; conserva input',async()=>{
  const before=JSON.stringify(input);const c={rpc:vi.fn().mockRejectedValue(new Error('timeout'))};await expect(executarReparcelamento43(c,1,input)).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});expect(c.rpc).toHaveBeenCalledTimes(1);expect(JSON.stringify(input)).toBe(before);
 });
 it('recovery confirma o MESMO recibo; não-executado exige UUID correto',async()=>{
  const c=client({status:'confirmed',result});expect(await reconciliarReparcelamento43(c,1,input)).toEqual({status:'confirmed',result});expect(c.rpc).toHaveBeenCalledTimes(1);
  const absent=client({status:'not_executed',idempotencyKey:input.idempotencyKey});expect(await reconciliarReparcelamento43(absent,1,input)).toEqual({status:'not_executed',idempotencyKey:input.idempotencyKey});
  await expect(reconciliarReparcelamento43(client({status:'not_executed',idempotencyKey:randomUUID()}),1,input)).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});
 });
 it('RPC ausente nunca retorna ao writer REST antigo',async()=>{
  const c=client(null,{code:'PGRST202'});await expect(executarReparcelamento43(c,1,input)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});expect(c.rpc).toHaveBeenCalledTimes(1);
 });
 it('rejeita tenant mismatch no preview e contrato estritamente mensal',async()=>{
  await expect(cotarReparcelamento43(client(q),2,q.request)).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});
  expect(reparcelamento43PreviewSchema.safeParse({...q.request,tipoTaxa:'diaria'}).success).toBe(false);
 });
});

describe('persistência de intenção43 após timeout',()=>{
 function store(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:(k:string)=>{map.delete(k)}};}
 it('preserva o mesmo objeto antes de enviar e sobrevive nova leitura sem trocar UUID',()=>{const s=store();guardarIntencao43(s,1,input);expect(lerIntencao43(s,1)).toEqual(input);guardarIntencao43(s,1,input);expect(()=>guardarIntencao43(s,1,{...input,idempotencyKey:randomUUID()})).toThrow();expect(lerIntencao43(s,1)).toEqual(input);});
 it('não lê nem apaga intenção de outro tenant; não limpa em timeout/erro comum',()=>{const s=store();guardarIntencao43(s,1,input);expect(lerIntencao43(s,2)).toBeNull();expect(()=>concluirIntencao43(s,2,input,{status:'confirmed',result})).toThrow();expect(()=>concluirIntencao43(s,1,input,{status:'not_executed',idempotencyKey:randomUUID()})).toThrow();expect(lerIntencao43(s,1)).toEqual(input);});
 it('somente confirmação mesma UUID/owner ou fence durável remove pendência',()=>{const s=store();guardarIntencao43(s,1,input);concluirIntencao43(s,1,input,{status:'confirmed',result});expect(lerIntencao43(s,1)).toBeNull();guardarIntencao43(s,1,input);concluirIntencao43(s,1,input,{status:'not_executed',idempotencyKey:input.idempotencyKey});expect(lerIntencao43(s,1)).toBeNull();});
 it('falha no armazenamento impede gerar confirmação de persistência',()=>{const s={getItem:()=>null,setItem:()=>{throw new Error('quota')},removeItem:()=>{}};expect(()=>guardarIntencao43(s,1,input)).toThrow('quota');});
});
