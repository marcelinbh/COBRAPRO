import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {cotacao37Schema,normalizarCotacao37,normalizarResultado37,normalizarRecovery37,request37Schema,recovery37Schema,type CotarCaixa37Input} from '../../shared/caixa37';
import {cotar37,aportar37,transferir37,reconciliar37} from './caixa37Rpc';

// Apenas fixtures JSON completos obtidos por RPC real no PG17 local descartável.
// Nenhuma chamada SQL real/financeira ocorre nesta integração SDK→adapter→shared.
const evidence=JSON.parse(readFileSync(new URL('../../tests/postgres-caixa37/synthetic-rpc-envelopes.json',import.meta.url),'utf8'));
const cases=evidence.cases as Array<{name:string;userId:number;idempotencyKey:string;request:any;quote?:any;result?:any;recovery:any}>;
function quoteInput(c:typeof cases[number]):CotarCaixa37Input{
 const q=c.request,common={contaDestinoId:q.contaDestinoId,valor:q.valor,...(q.descricao===null?{}:{descricao:q.descricao})};
 return q.acao==='aporte'?{acao:'aporte',...common}:{acao:'transferir',contaOrigemId:q.contaOrigemId,...common};
}
function writeInput(c:typeof cases[number]){
 const q=c.request;
 return {contaDestinoId:q.contaDestinoId,valor:q.valor,dataTransacao:q.dataTransacao,estadoHash:q.estadoHash,idempotencyKey:c.idempotencyKey,...(q.descricao===null?{}:{descricao:q.descricao}),...(q.acao==='transferir'?{contaOrigemId:q.contaOrigemId}:{})};
}
function sdk(data:unknown){
 const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));
 const client=createClient('https://synthetic.invalid','synthetic-only',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchMock}});
 return {client,fetchMock};
}
function captured(fetchMock:ReturnType<typeof vi.fn>){
 const call=fetchMock.mock.calls[0];return {url:String(call[0]),body:JSON.parse(String(call[1]?.body))};
}

describe('PostgreSQL37 real sintético → JSON → SDK real → adapter/shared',()=>{
 it('fonte explicitamente sintética com cinco casos e hash SHA256 da rodada, sem dados reais',()=>{
  expect(evidence.syntheticOnly).toBe(true);expect(evidence.sql37Sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(evidence.sql37Sha256).toBe(createHash('sha256').update(readFileSync(new URL('../../drizzle/0037_rpc_aporte_transferencia_caixa.sql',import.meta.url))).digest('hex'));
  expect(cases).toHaveLength(5);expect(new Set(cases.map(c=>c.name)).size).toBe(5);
  expect(cases.filter(c=>c.result)).toHaveLength(4);expect(cases.filter(c=>c.recovery.status==='not_executed')).toHaveLength(1);
 });
 it.each(cases)('$name request canônico e recovery completo/owner exato',c=>{
  const intent=recovery37Schema.parse({idempotencyKey:c.idempotencyKey,request:c.request});
  expect(request37Schema.parse(c.request)).toEqual(c.request);
  expect(normalizarRecovery37(c.recovery,c.userId,intent)).toEqual(c.recovery);
  expect(()=>normalizarRecovery37(c.recovery,c.userId+1,intent)).toThrow();
  if(c.result)expect(normalizarResultado37(c.result,intent)).toEqual(c.result);
  if(c.quote){expect(cotacao37Schema.parse(c.quote)).toEqual(c.quote);expect(normalizarCotacao37(c.quote,quoteInput(c))).toEqual(c.quote);}
 });
 it.each(cases.filter(c=>c.quote))('$name cotação SQL via SDK uma vez e parâmetros próprios sem ledger paralelo',async c=>{
  const {client,fetchMock}=sdk(c.quote);
  expect(await cotar37(client,c.userId,quoteInput(c))).toEqual(c.quote);expect(fetchMock).toHaveBeenCalledOnce();
  const call=captured(fetchMock);expect(call.url).toContain('/rest/v1/rpc/rpc_cotar_caixa37');
  expect(call.body).toEqual({p_user_id:c.userId,p_acao:c.request.acao,p_conta_origem_id:c.request.contaOrigemId,p_conta_destino_id:c.request.contaDestinoId,p_valor:c.request.valor,p_descricao:c.request.descricao});
 });
 it.each(cases.filter(c=>c.result))('$name execução histórica SQL via SDK uma vez, dinheiro textual sem arredondar',async c=>{
  const {client,fetchMock}=sdk(c.result),input=writeInput(c);
  const result=c.request.acao==='aporte'?await aportar37(client,c.userId,input):await transferir37(client,c.userId,input as any);
  expect(result).toEqual(c.result);expect(fetchMock).toHaveBeenCalledOnce();
  const call=captured(fetchMock);expect(call.url).toContain(c.request.acao==='aporte'?'/rpc_aportar_caixa37':'/rpc_transferir_caixa37');
  expect(call.body).toEqual({p_user_id:c.userId,p_chave_idempotencia:c.idempotencyKey,p_conta_destino_id:c.request.contaDestinoId,p_valor:c.request.valor,p_data_transacao:c.request.dataTransacao,p_estado_hash:c.request.estadoHash,p_descricao:c.request.descricao,...(c.request.acao==='transferir'?{p_conta_origem_id:c.request.contaOrigemId}:{})});
 });
 it.each(cases)('$name reconciliação SQL completa via SDK sem consultar capability/cotação',async c=>{
  const {client,fetchMock}=sdk(c.recovery),intent={idempotencyKey:c.idempotencyKey,request:c.request};
  expect(await reconciliar37(client,c.userId,intent)).toEqual(c.recovery);expect(fetchMock).toHaveBeenCalledOnce();
  const call=captured(fetchMock);expect(call.url).toContain('/rest/v1/rpc/rpc_reconciliar_caixa37');
  expect(call.body).toEqual({p_user_id:c.userId,p_chave_idempotencia:c.idempotencyKey,p_request:c.request});
 });
 it.each(cases.filter(c=>c.result))('$name resultado SQL adulterado em equação ou perna não vira confirmed',async c=>{
  const altered=structuredClone(c.recovery);altered.result.saldoDestinoApos='0.00';
  const a=sdk(altered);await expect(reconciliar37(a.client,c.userId,{idempotencyKey:c.idempotencyKey,request:c.request})).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});expect(a.fetchMock).toHaveBeenCalledOnce();
  const broken=structuredClone(c.recovery);broken.result.pernas[0].contaCaixaId=2147483647;
  expect(()=>normalizarRecovery37(broken,c.userId,{idempotencyKey:c.idempotencyKey,request:c.request})).toThrow();
 });
});
