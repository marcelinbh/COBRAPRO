import {TRPCError} from '@trpc/server';
import {capacidadeInclusao52} from '../../shared/inclusao52';
export type ClientInclusao52={rpc(name:'rpc_capacidade_inclusao52',args:Record<string,unknown>):PromiseLike<{data:unknown;error:{code?:string}|null}>};
export async function capacidade52(client:ClientInclusao52){
 let r;try{r=await client.rpc('rpc_capacidade_inclusao52',{});}catch{throw new TRPCError({code:'PRECONDITION_FAILED',message:'Inclusão expandida indisponível. Conferência51 preservada; sem fallback.'});}
 const parsed=capacidadeInclusao52.safeParse(r.data);
 if(r.error||!parsed.success)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Catálogo52 exato indisponível; inclusão expandida não autorizada.'});
 return parsed.data;
}
