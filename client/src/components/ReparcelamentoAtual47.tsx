import {useEffect,useRef,useState} from 'react';
import {trpc} from '@/lib/trpc';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {RecebimentoValidado} from '@/components/RecebimentoValidado';
import {conferirCotacao47,intencao47DaCotacao,type Reparcelamento47Cotacao,type Reparcelamento47Resultado} from '../../../shared/reparcelamento47';
import {enviarIntencao47,recuperarIntencao47,lerIntencao47} from '../../../shared/reparcelamento47Fluxo';
export function ReparcelamentoAtual47({owner,permitido=true}:{owner:number;permitido?:boolean}){
 const [contrato,setContrato]=useState(''),[n,setN]=useState('3'),[taxa,setTaxa]=useState('5.00'),[data,setData]=useState('');
 const [q,setQ]=useState<Reparcelamento47Cotacao>(),[result,setResult]=useState<Reparcelamento47Resultado>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<ReturnType<typeof lerIntencao47>>(null);
 const session=useRef(crypto.randomUUID()),identity=useRef(owner),mounted=useRef(true),sending=useRef(false),generation=useRef(0),permission=useRef(permitido);permission.current=permitido;
 if(identity.current!==owner){identity.current=owner;generation.current++;}
 useEffect(()=>{mounted.current=true;try{setPending(lerIntencao47(localStorage,owner));}catch{setError('Journal47 inválido; preservar para conferência.');}return()=>{mounted.current=false;generation.current++;};},[owner]);
 const input={contratoId:Number(contrato),numeroParcelas:Number(n),taxaJuros:taxa,tipoTaxa:'mensal' as const,dataInicio:data,incluirMultas:false};
 const key=JSON.stringify(input),form=useRef(key);form.current=key;
 useEffect(()=>{setQ(undefined);},[key]);
 const preview=trpc.reparcelamentoAtual.preview47.useQuery(input,{enabled:false,retry:false,staleTime:0});
 const execute=trpc.reparcelamentoAtual.executar.useMutation({retry:false}),recovery=trpc.reparcelamentoAtual.reconciliar.useMutation({retry:false});
 const guard=(uid:number,epoch:number)=>()=>mounted.current&&identity.current===uid&&generation.current===epoch&&permission.current;
 function refresh(uid:number){if(identity.current===uid)setPending(lerIntencao47(localStorage,uid));}
 async function quote(){if(!permitido||sending.current||pending||error)return;const uid=owner,epoch=generation.current,valid=guard(uid,epoch),f=key;sending.current=true;setBusy(true);setQ(undefined);try{const response=await preview.refetch();if(response.isError)throw Error(response.error.message);const value=conferirCotacao47(response.data,uid,input);if(valid()&&form.current===f)setQ(value);}catch(e){if(valid())setError(e instanceof Error?e.message:'Cotação indisponível');}finally{sending.current=false;if(valid())setBusy(false);}}
 async function send(){if(!permitido||sending.current||pending||!q||error||JSON.stringify(q.request)!==key)return;const uid=owner,epoch=generation.current,valid=guard(uid,epoch);sending.current=true;setBusy(true);try{const i=intencao47DaCotacao(q,crypto.randomUUID());const value=await enviarIntencao47(localStorage,navigator.locks,uid,session.current,i,valid,x=>execute.mutateAsync(x));if(valid()){setResult(value);setQ(undefined);}}catch(e){if(valid())setError(e instanceof Error?e.message:'Resultado desconhecido; preserve intenção');}finally{sending.current=false;if(valid()){refresh(uid);setBusy(false);}}}
 async function recover(){if(!permitido||sending.current)return;const uid=owner,epoch=generation.current,valid=guard(uid,epoch);sending.current=true;setBusy(true);setError('');try{const value=await recuperarIntencao47(localStorage,navigator.locks,uid,session.current,valid,x=>recovery.mutateAsync(x));if(valid()){if(value.status==='confirmed')setResult(value.result);else setError('Não execução comprovada por fence47 permanente; cote nova intenção.');setQ(undefined);}}catch(e){if(valid())setError(e instanceof Error?e.message:'Recovery desconhecido; preserve journal');}finally{sending.current=false;if(valid()){refresh(uid);setBusy(false);}}}
 return <section className="space-y-4 border p-4"><h2 className="text-xl font-semibold">Atual25: reparcelamento mensal mínimo47</h2>
 <p>Somente mensal25 inteiramente aberto, sem multa/mora incorrida, pagamentos ou renovação. Criação25 genuína e cadeia completa auditada46/48: a cotação usa datas e valores atuais; saldo = principal original + juros líquidos atuais, com desconto48 já deduzido uma única vez. Antecessor cancelado auditadamente; sucessor genuíno47 sem saída ou entrada de Caixa. Outras modalidades e histórico parcial não estão liberados.</p>
 {!permitido&&<p role="alert">Journal legado43 pendente nesta empresa: conclua a conferência antes de iniciar47.</p>}
 {error&&<div role="alert">{error}{!pending&&<Button disabled={busy} onClick={()=>setError('')}>Voltar à cotação</Button>}</div>}
 {pending?<div><p>UUID47 preservada: <code>{pending.input.idempotencyKey}</code>. Somente recovery da mesma intenção; não criar outro UUID.</p><Button disabled={busy||!permitido} onClick={()=>void recover()}>Conferir commit ou fence47</Button></div>:<>
 <fieldset disabled={busy||!permitido} className="grid gap-3"><label>Contrato atual25<Input value={contrato} onChange={e=>setContrato(e.target.value)}/></label><label>Parcelas (1–60)<Input value={n} onChange={e=>setN(e.target.value)}/></label><label>Taxa mensal explícita<Input value={taxa} onChange={e=>setTaxa(e.target.value)}/></label><label>Primeiro vencimento<Input type="date" value={data} onChange={e=>setData(e.target.value)}/></label><Button disabled={!!error} onClick={()=>void quote()}>Simular e persistir cotação47</Button></fieldset>
 {q&&<div><p>Principal original R$ {q.principalOriginal}; juros líquidos atuais R$ {q.jurosEmbutidos}; saldo R$ {q.saldoDevedor}; juros novos R$ {q.jurosNovos}; total R$ {q.totalNovo}.</p><p>Cotação UUID {q.cotacaoId}; origem25 operação {q.origemOperationId}. Desembolso R$0,00.</p><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Principal</th><th>Juros</th><th>Valor</th></tr></thead><tbody>{q.parcelas.map(p=><tr key={p.numero}><td>{p.numero}</td><td>{p.vencimento}</td><td>{p.principal}</td><td>{p.juros}</td><td>{p.valor}</td></tr>)}</tbody></table><Button disabled={busy||!!error||!permitido} onClick={()=>void send()}>Confirmar reparcelar47 sem dinheiro recebido</Button><p>Execução depende de flag47 instalada e autorizada. OFF não apaga intenção; recovery continua permitido.</p></div>}
 </>}
 {result&&result.userId===owner&&<div><h3>Sucessor47 #{result.contratoId} confirmado</h3><p>Origem #{result.contratoOrigemId}; sem desembolso. Recebimentos abaixo geram entrada real pelo writer atual25/35, não renovação.</p>{result.parcelasIds.map(id=><RecebimentoValidado key={id} contratoId={result.contratoId} parcelaId={id} permitirRenovacao={false} onSuccess={()=>{}}/>)}</div>}
 </section>;
}
