import {describe,it,expect,vi,beforeEach} from 'vitest';
import {readFileSync} from 'node:fs';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../../../server/db',()=>({getSupabaseClientAsync:async()=>({rpc})}));
import {reparcelamento43Router} from '../../../server/routers/reparcelamento43';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/synthetic-roundtrip43.json',import.meta.url),'utf8'));
const input={...fixture.q.request,estadoHash:fixture.q.estadoHash,cotacaoHash:fixture.q.cotacaoHash,idempotencyKey:fixture.k};
const caller=(id=1)=>reparcelamento43Router.createCaller({user:{id}} as never);
beforeEach(()=>rpc.mockReset());
describe('registered candidate43 tRPC real schemas',()=>{
 it('preview43 envia owner ctx e cotação fechada uma vez',async()=>{rpc.mockResolvedValue({data:fixture.q,error:null});expect(await caller().preview43(fixture.q.request)).toEqual(fixture.q);expect(rpc).toHaveBeenCalledWith('rpc_cotar_reparcelamento43',{p_user_id:1,p_request:fixture.q.request});});
 it('executar chama RPC43, sem gate artificial, owner de sessão',async()=>{rpc.mockResolvedValue({data:fixture.r,error:null});expect(await caller().executar(input)).toEqual(fixture.r);expect(rpc).toHaveBeenCalledTimes(1);expect(rpc.mock.calls[0][1].p_user_id).toBe(1);});
 it('owner spoof input extra rejeitado antes do adapter',async()=>{await expect(caller().executar({...input,userId:2} as never)).rejects.toMatchObject({code:'BAD_REQUEST'});expect(rpc).not.toHaveBeenCalled();});
 it('sem sessão é UNAUTHORIZED sem rede',async()=>{await expect(reparcelamento43Router.createCaller({user:null} as never).executar(input)).rejects.toMatchObject({code:'UNAUTHORIZED'});expect(rpc).not.toHaveBeenCalled();});
 it('RPC ausente recusa sem writer REST',async()=>{rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});await expect(caller().executar(input)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});expect(rpc).toHaveBeenCalledTimes(1);});
 it('reconciliar usa mesma UUID/payload e owner ctx, uma vez',async()=>{rpc.mockResolvedValue({data:{status:'not_executed',idempotencyKey:fixture.k},error:null});expect((await caller().reconciliar(input)).status).toBe('not_executed');expect(rpc.mock.calls[0][0]).toBe('rpc_reconciliar_reparcelamento43');expect(rpc.mock.calls[0][1].p_chave_idempotencia).toBe(fixture.k);});
});
