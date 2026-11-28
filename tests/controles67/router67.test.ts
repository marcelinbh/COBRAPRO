import { beforeEach, describe, expect, it, vi } from 'vitest';
const backend = vi.hoisted(()=>({ getSupabaseClientAsync:vi.fn() }));
vi.mock('../../server/db',()=>backend);
import { etiquetasLista67Router } from '../../server/routers/etiquetasLista67';
const caller=(user:any={id:41})=>etiquetasLista67Router.createCaller({user,req:{headers:{}},res:{}} as any);
beforeEach(()=>vi.resetAllMocks());
describe('67 facade real: tenant ctx.user.id e resultado confirmado',()=>{
 it('criar usa catálogo67 próprio, não endpoints antigos nem owner input',async()=>{
  const rpc=vi.fn(async()=>({data:{versao:'etiquetas_lista67_v1',userId:41,acao:'criar',id:'8',contratoId:null,revisao:null},error:null,status:200})),from=vi.fn();backend.getSupabaseClientAsync.mockResolvedValue({rpc,from});
  const r=await caller().criar({nome:'Própria',cor:'#abcdef'});expect(r.id).toBe('8');expect(rpc.mock.calls).toEqual([['rpc_etiquetas_criar67',{p_nome:'Própria',p_cor:'#abcdef',p_user_id:41}]]);expect(from).not.toHaveBeenCalled();
  await expect((caller().criar as any)({nome:'Própria',cor:'#abcdef',userId:99})).rejects.toMatchObject({code:'BAD_REQUEST'});expect(rpc).toHaveBeenCalledTimes(1);
 });
 it('sem sessão/inputs inválidos nunca alcança RPC',async()=>{
  await expect(caller(null).remover({id:'1'})).rejects.toMatchObject({code:'UNAUTHORIZED'});
  await expect((caller().aplicar as any)({contratoId:1,nomes:[],revisao:'00',estadoHash:'a'.repeat(64)})).rejects.toMatchObject({code:'BAD_REQUEST'});expect(backend.getSupabaseClientAsync).not.toHaveBeenCalled();
 });
 it('aplicar [] envia revisão/hash exatos; owner externo na resposta recusa',async()=>{
  const rpc=vi.fn(async()=>({data:{versao:'etiquetas_lista67_v1',userId:99,acao:'aplicar',id:null,contratoId:1,revisao:'1'},error:null}));backend.getSupabaseClientAsync.mockResolvedValue({rpc});
  await expect(caller().aplicar({contratoId:1,nomes:[],revisao:'0',estadoHash:'a'.repeat(64)})).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});
  expect(rpc.mock.calls).toEqual([['rpc_etiquetas_aplicar67',{p_contrato_id:1,p_nomes:[],p_revisao:'0',p_estado_hash:'a'.repeat(64),p_user_id:41}]]);
 });
});
