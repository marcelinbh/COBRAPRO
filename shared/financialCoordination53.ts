export type FinanceLocks53={request<T>(name:string,callback:()=>Promise<T>):Promise<T>};
export type FinanceStorage53=Pick<Storage,'getItem'> & Partial<Pick<Storage,'length'|'key'>>;
/** Per-owner is deliberately stronger than per-root: serializes unknown provenance before quote. */
export function financeiroLock53(owner:number){if(!Number.isSafeInteger(owner)||owner<=0)throw Error('Empresa inválida.');return `cobrapro:financeiro:owner:${owner}`;}
export function withFinance53<T>(locks:FinanceLocks53,owner:number,existingKey:string,fn:()=>Promise<T>|T){return locks.request(financeiroLock53(owner),()=>locks.request(existingKey,async()=>fn()));}
/** Names of other companies are not read. Pending formats remain byte-exact and are never adopted. */
export function assertNoOtherFinance53(storage:FinanceStorage53,owner:number,currentKey:string,requireInventory=false){
 if(typeof storage.length!=='number'||typeof storage.key!=='function'){if(requireInventory)throw Error('Inventário de pendências indisponível; nenhum pedido novo.');return;}
 const patterns=[new RegExp(`^cobrapro:(?:manutencao48|juros48|calendario46|calendario44):${owner}:(?:[a-f0-9]{64}:)?[0-9]+$`),new RegExp(`^cobrapro:obrigacoes51:v1:${owner}:[a-f0-9]{64}:[0-9]+$`),new RegExp(`^cobrapro:sucessores53:v1:${owner}:[a-f0-9]{64}:[0-9]+$`),new RegExp(`^cobrapro:reparcelar47:v2:empresa:${owner}$`)];
 for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k&&k!==currentKey&&patterns.some(p=>p.test(k))&&storage.getItem(k)!==null)throw Error(`Pendência financeira da mesma empresa preservada (${k}); confira o pedido original sem gerar UUID53.`);}
}
