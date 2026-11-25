import {describe,it,expect,vi} from 'vitest';
import {identificarCalendario46,type ClienteOrigemCalendario46} from '../../server/services/calendario46';
function client(source:unknown={userId:77,contratoId:1001,parcelaId:9,trilho:'multimodal',status:'pendente'}) {
 const chain:any={eq:vi.fn(()=>chain),order:vi.fn(()=>chain),limit:vi.fn(()=>chain),then:(ok:any,bad:any)=>Promise.resolve({data:[{id:9}],error:null}).then(ok,bad)};
 const rpc=vi.fn().mockResolvedValue({data:source,error:null});
 const select=vi.fn(()=>chain),from=vi.fn(()=>({select}));return {value:{rpc,from} as ClienteOrigemCalendario46,rpc,from,select,chain};
}
describe('origem46 real service — mocks são contrato, não POSTreal',()=>{
 it('25 não vira21, limita consulta e owner vem servidor',async()=>{
  const c=client();expect(await identificarCalendario46(c.value,77,{contratoId:1001})).toEqual({empresaId:77,contratoId:1001,origem:'multimodal25',fluxo:'calendario46',codigo:'cotar46'});
  expect(c.from).toHaveBeenCalledWith('parcelas');expect(c.select).toHaveBeenCalledWith('id');expect(c.chain.eq.mock.calls).toEqual([['user_id',77],['contrato_id',1001]]);expect(c.chain.limit).toHaveBeenCalledWith(1);
  expect(c.rpc.mock.calls).toEqual([['rpc_identificar_emprestimo_multimodal',{p_user_id:77,p_contrato_id:1001,p_parcela_id:9}]]);
 });
 it('somente NULL verificado25 permite identificar21, não modalidade do request',async()=>{
  const c=client();c.rpc.mockResolvedValueOnce({data:null,error:null}).mockResolvedValueOnce({data:{userId:77,contratoId:1001,parcelaId:9,trilho:'prospectivo',status:'pendente'},error:null});
  expect((await identificarCalendario46(c.value,77,{contratoId:1001})).fluxo).toBe('calendario44');expect(c.rpc.mock.calls[1][0]).toBe('legados_identificar_trilho');
 });
 it.each(['42501','55000','PGRST202','23514'])('erro%s nunca autoriza outro writer',async code=>{
  const c=client();c.rpc.mockResolvedValue({data:null,error:{code}});await expect(identificarCalendario46(c.value,77,{contratoId:1001})).rejects.toBeDefined();expect(c.rpc).toHaveBeenCalledOnce();
 });
 it('timeout não identifica21 e replay não toca mutação',async()=>{
  const c=client();c.rpc.mockRejectedValue(Error('timeout'));await expect(identificarCalendario46(c.value,77,{contratoId:1001})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});expect(c.rpc).toHaveBeenCalledOnce();
 });
 it.each([{userId:78},{contratoId:1002},{parcelaId:10},{trilho:'prospectivo'}])('eco divergente não autoriza fluxo',async extra=>{
  const c=client({userId:77,contratoId:1001,parcelaId:9,trilho:'multimodal',status:'pendente',...extra});await expect(identificarCalendario46(c.value,77,{contratoId:1001})).rejects.toBeDefined();
 });
 it('owner/fluxo/body extras são recusados antes da consulta',async()=>{
  const c=client();for(const input of [{contratoId:1001,userId:2},{contratoId:1001,origem:'prospectivo21'},{contratoId:1001,modalidade:'mensal'}])await expect(identificarCalendario46(c.value,77,input as any)).rejects.toBeDefined();await expect(identificarCalendario46(c.value,0,{contratoId:1001})).rejects.toBeDefined();expect(c.from).not.toHaveBeenCalled();
 });
});
