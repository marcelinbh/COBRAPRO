import { afterEach, describe, expect, it, vi } from 'vitest';
import { code, compile, deferred, Hooks, source, text, treeNodes } from '../lib/r1BoundaryHarness';
import { DespesasRecorrencia68Journal } from '../lib/despesasRecorrencia68Journal';
import { dataOcorrencia68, template68, validarProof68 } from '../../../shared/despesasRecorrencia68';
import { dinheiroDespesa, moedaDespesa } from '../../../shared/despesasIntent';
const key = '10000000-0000-4000-8000-000000000001';
class Memory { m = new Map<string,string>();getItem(k:string){return this.m.get(k)??null;}setItem(k:string,v:string){this.m.set(k,v);}removeItem(k:string){this.m.delete(k);} }
function harness() {
  const memory=new Memory(),hooks=new Hooks(),write=vi.fn(),recover=vi.fn(),refetch=vi.fn().mockResolvedValue(undefined),invalidate=vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('window',{sessionStorage:memory,confirm:()=>true});vi.stubGlobal('navigator',{locks:{request:async(_:string,fn:()=>any)=>fn()}});vi.spyOn(crypto,'randomUUID').mockReturnValue(key);
  let owner=7,token=0;
  const query:any={data:{contrato:'despesas68_v1',userId:7,hoje:'2030-01-01',agenda:{vinculada:false,ativa:false,ultimaExecucao:null,resultado:'aguardando'},series:[],ocorrencias:[],hasMore:false},isError:false,refetch};
  const trpc={despesasRecorrencia68:{listar:{useQuery:()=>query},configurar:{useMutation:()=>({mutateAsync:write})},recuperar:{useMutation:()=>({mutateAsync:recover})}},useUtils:()=>({contasPagar:{listar:{invalidate},resumo:{invalidate}}})};
  const component=compile(`let generation68=0;\n${code(source('components/RecorrenciaDespesas68.tsx'),'RecorrenciaDespesas68')}\nreturn RecorrenciaDespesas68;`,{...hooks.bindings(),trpc,hashKey:JSON.stringify,Button:'button',Input:'input',Textarea:'textarea',diaCivilBrt:()=> '2030-01-01',dinheiroDespesa,moedaDespesa,dataOcorrencia68,template68,validarProof68,DespesasRecorrencia68Journal,categories:['aluguel','energia','agua','internet','telefone','salario','imposto','fornecedor','outros'],fresh:()=>({descricao:'',categoria:'outros',valor:'',observacoes:''})});
  let tree:any;
  const render=()=>{tree=hooks.render(component,{userId:owner,refreshToken:token});hooks.flush();tree=hooks.render(component,{userId:owner,refreshToken:token});return tree;};
  const flush=async()=>{for(let i=0;i<30;i++){await Promise.resolve();render();}};
  const field=(id:string)=>treeNodes(tree,n=>n.props?.id===id)[0];
  const change=(id:string,value:string)=>{field(id).props.onChange({target:{value}});render();};
  const button=(s:string)=>treeNodes(tree,n=>n.type==='button'&&text(n).includes(s))[0];
  const click=async(s:string)=>{const b=button(s);expect(b).toBeDefined();expect(b.props.disabled).toBeFalsy();b.props.onClick();render();await flush();};
  const fill=()=>{change('serie68-descricao','Aluguel');change('serie68-valor','100,01');change('serie68-ancora','2030-01-31');};
  const proof=(input:any,status='confirmed')=>({contrato:'despesas68_v1',userId:7,idempotencyKey:input.idempotencyKey,request:input.request,status,serieId:status==='confirmed'?'20000000-0000-4000-8000-000000000001':null,revision:status==='confirmed'?1:null,effectiveOrdinal:status==='confirmed'?0:null,fenceId:key,instante:'2026-11-27T12:00:00Z'});
  render();return {memory,hooks,write,recover,refetch,invalidate,render,flush,change,button,click,fill,proof,query,text:()=>text(tree),transition:(n:number)=>{owner=n;query.data={...query.data,userId:n};render();},refresh:()=>{token++;render();}};
}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('UI68 funcional sem agenda provisionada',()=>{
 it('render/listar não gera; cadastroagenda ausente persiste antesPOST e prova fechaCAS',async()=>{
  const h=harness();expect(h.text()).toContain('aguardando vínculo');expect(h.write).not.toHaveBeenCalled();h.write.mockImplementation(async input=>{expect(h.memory.getItem('cobrapro:despesas68:7:pending')).toBe(JSON.stringify(input));return h.proof(input);});h.fill();expect(h.text()).toContain('2030-02-28 → 2030-03-31');await h.click('Cadastrar série');expect(h.write).toHaveBeenCalledTimes(1);expect(h.write.mock.calls[0][0].request).not.toHaveProperty('userId');expect(h.memory.getItem('cobrapro:despesas68:7:pending')).toBeNull();expect(h.text()).toContain('confirmada');h.hooks.unmount();
 });
 it('erro formulário é corrigível no mesmo mount sem UUID/trava de mensagem',async()=>{
  const h=harness();h.change('serie68-descricao','A');h.change('serie68-valor','0.00');await h.click('Cadastrar série');expect(h.write).not.toHaveBeenCalled();expect(h.button('Cadastrar série').props.disabled).toBe(false);h.write.mockImplementation(async input=>h.proof(input));h.fill();await h.click('Cadastrar série');expect(h.write).toHaveBeenCalledTimes(1);
 });
 it('prepare write-then-throw descobre original e oferece recovery semPOST',async()=>{
  const h=harness();h.memory.setItem=(k,v)=>{h.memory.m.set(k,v);throw Error('readback failure');};h.fill();await h.click('Cadastrar série');expect(h.write).not.toHaveBeenCalled();expect(h.text()).toContain('UUID original68');expect(h.button('Recuperar').props.disabled).toBe(false);
 });
 it('timeout não trocaUUID e retryexato funciona apesar mensagem; fence terminalfecha sem novoPOST',async()=>{
  const h=harness();h.write.mockRejectedValueOnce(Error('timeout'));h.fill();await h.click('Cadastrar série');const input=h.write.mock.calls[0][0];expect(h.text()).toContain('Original68 mantido');h.write.mockImplementation(async i=>h.proof(i));await h.click('Reenviar configuração');expect(h.write.mock.calls[1][0]).toEqual(input);
  const f=harness();f.write.mockRejectedValue(Error('timeout'));f.fill();await f.click('Cadastrar série');f.recover.mockImplementation(async i=>f.proof(i,'not_executed'));await f.click('Recuperar');expect(f.write).toHaveBeenCalledTimes(1);expect(f.memory.getItem('cobrapro:despesas68:7:pending')).toBeNull();
 });
 it('post A→B→A descarta resposta tardia sem invalidar/fecharjournal novoA',async()=>{
  const h=harness(),d=deferred();h.write.mockReturnValue(d.promise);h.fill();await h.click('Cadastrar série');const input=h.write.mock.calls[0][0];h.transition(8);h.transition(7);const calls=h.invalidate.mock.calls.length;d.resolve(h.proof(input));await h.flush();expect(h.invalidate).toHaveBeenCalledTimes(calls);expect(h.memory.getItem('cobrapro:despesas68:7:pending')).toBe(JSON.stringify(input));expect(h.text()).toContain('UUID original68');
 });
 it('template futuro envia revisão/ordinal do snapshot selecionado mesmo com refetchconcorrente',async()=>{
  const h=harness(),sid='20000000-0000-4000-8000-000000000001';
  h.query.data.series=[{serieId:sid,userId:7,revision:4,estado:'ativa',frequencia:'mensal',ancora:'2030-01-31',termino:null,template:{descricao:'Original',categoria:'outros',valor:'100.01',observacoes:''},nextOrdinal:1,nextDate:'2030-02-28',futureOrdinal:2,backlog:false,failure:false,skipped:[]}];h.render();await h.click('Alterar próximas');h.change('serie68-valor','200.02');
  h.query.data.series=[{...h.query.data.series[0],revision:5,futureOrdinal:3}];h.render();h.write.mockRejectedValue(Error('CAS stale'));
  await h.click('Confirmar template');expect(h.write.mock.calls[0][0].request).toMatchObject({action:'alterar',expectedRevision:4,effectiveOrdinal:2,template:{valor:'200.02'}});expect(h.memory.getItem('cobrapro:despesas68:7:pending')).not.toBeNull();
 });
 it('refreshToken49 só consulta, não configura nem gera despesas',()=>{
  const h=harness();const old=h.refetch.mock.calls.length;h.refresh();expect(h.refetch.mock.calls.length).toBeGreaterThan(old);expect(h.write).not.toHaveBeenCalled();expect(h.recover).not.toHaveBeenCalled();
 });
});
