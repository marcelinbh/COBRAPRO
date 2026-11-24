import { conferirResultado43, type Reparcelamento43Execucao, type Reparcelamento43Resultado } from './reparcelamento43';
import { guardarIntencao43,lerIntencao43,concluirIntencao43,type Armazenamento43 } from './reparcelamento43Intencao';
export type Recovery43 = {status:'confirmed';result:Reparcelamento43Resultado}|{status:'not_executed';idempotencyKey:string};
/** A tela captura owner/geração no clique; troca de tenant nunca limpa nem publica resposta antiga. */
export async function enviarIntencao43(storage:Armazenamento43,owner:number,input:Reparcelamento43Execucao,
  atual:()=>boolean,send:(i:Reparcelamento43Execucao)=>Promise<Reparcelamento43Resultado>) {
  if (!atual()) throw new Error('Sessão43 mudou; nenhum envio.');
  const persisted=guardarIntencao43(storage,owner,input);
  if (!atual()) throw new Error('Sessão43 mudou após persistência; reconciliar na empresa original.');
  const value=await send(persisted);
  const result=conferirResultado43(value,owner,persisted);
  if (!atual()) throw new Error('Resposta de sessão anterior preservada para conferência.');
  concluirIntencao43(storage,owner,persisted,{status:'confirmed',result});
  return result;
}
export async function recuperarIntencao43(storage:Armazenamento43,owner:number,atual:()=>boolean,
  recover:(i:Reparcelamento43Execucao)=>Promise<Recovery43>) {
  if (!atual()) throw new Error('Sessão43 mudou; nenhuma conferência.');
  const input=lerIntencao43(storage,owner);
  if (!input) throw new Error('Nenhuma intenção43 persistida nesta empresa.');
  const value=await recover(input);
  if (!atual()) throw new Error('Conferência de sessão anterior preservada.');
  if (value.status==='confirmed') {
    const result=conferirResultado43(value.result,owner,input);
    concluirIntencao43(storage,owner,input,{status:'confirmed',result});
    return {status:'confirmed' as const,result};
  }
  concluirIntencao43(storage,owner,input,value);
  return value;
}
