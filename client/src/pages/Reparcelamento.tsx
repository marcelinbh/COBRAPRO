import { useEffect,useRef,useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useSearch } from 'wouter';
import { contratoReparcelamentoDaBusca } from '@/lib/legacyFinanceNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RecebimentoValidado } from '@/components/RecebimentoValidado';
import {
  reparcelamento43PreviewSchema,conferirCotacao43,intencao43DaCotacao,
  type Reparcelamento43Cotacao,type Reparcelamento43Execucao,type Reparcelamento43Resultado,
} from '../../../shared/reparcelamento43';
import {ReparcelamentoAtual47} from '@/components/ReparcelamentoAtual47';
import {lerIntencao43} from '../../../shared/reparcelamento43Intencao';
import {enviarIntencao43,recuperarIntencao43} from '../../../shared/reparcelamento43Fluxo';

export default function Reparcelamento() {
  const contratoInicial = contratoReparcelamentoDaBusca(useSearch());
  const auth=trpc.auth.me.useQuery(undefined,{retry:false,refetchOnWindowFocus:true});
  const owner=!auth.isError&&!auth.isLoading&&!auth.isFetching ? auth.data?.id : undefined;
  const identity=useRef(owner),epoch=useRef(0),mounted=useRef(true);
  if(identity.current!==owner){identity.current=owner;epoch.current++;}
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
  const [contrato,setContrato]=useState(''),[n,setN]=useState('6'),[taxa,setTaxa]=useState('5.00');
  const [data,setData]=useState(''),[multas,setMultas]=useState(true);
  const [q,setQ]=useState<Reparcelamento43Cotacao>(),[pending,setPending]=useState<Reparcelamento43Execucao|null>(null);
  const [result,setResult]=useState<Reparcelamento43Resultado>(),[erro,setErro]=useState(''),[busy,setBusy]=useState(false);
  const click=useRef(false);
  const request={contratoId:Number(contrato),numeroParcelas:Number(n),taxaJuros:taxa,tipoTaxa:'mensal' as const,dataInicio:data,incluirMultas:multas};
  const requestKey=JSON.stringify(request),currentForm=useRef(requestKey);currentForm.current=requestKey;
  const quoteSource=trpc.reparcelamento.preview43.useQuery(request,{enabled:false,retry:false,staleTime:0});
  const execute=trpc.reparcelamento.executar.useMutation({retry:false});
  const recovery=trpc.reparcelamento.reconciliar.useMutation({retry:false});
  // Somente metadados sem validação global do Caixa; conta de origem não é trocada pelo reparcelamento.
  const accounts=trpc.caixa.contasParaOperacao37.useQuery(undefined,{enabled:!!owner,retry:false,staleTime:0});
  const accountValid=!!owner&&!accounts.isError&&!accounts.isFetching&&accounts.data?.empresaId===owner;
  const ownAccounts=accountValid ? accounts.data!.contas : [];
  const account=q&&accountValid ? ownAccounts.find(a=>a.id===q.contaCaixaId) : undefined;
  const [stateOwner,setStateOwner]=useState<number>();
  useEffect(()=>{
    setQ(undefined);setResult(undefined);setPending(null);setErro('');setBusy(false);setStateOwner(owner);
    if(owner)try{setPending(lerIntencao43(localStorage,owner));}catch{setErro('Intenção local inválida: não apagar nem enviar; preservar para conferência.');}
  },[owner]);
  useEffect(()=>{setQ(undefined);},[requestKey]);
  const visible=!!owner&&stateOwner===owner;
  const guard=(uid:number,version:number)=>()=>mounted.current&&identity.current===uid&&epoch.current===version;
  function refresh(uid:number){if(identity.current===uid)setPending(lerIntencao43(localStorage,uid));}
  async function cotar(){
    if(!owner||click.current||pending||erro)return;
    const uid=owner,version=epoch.current,atual=guard(uid,version),key=currentForm.current;
    click.current=true;setBusy(true);setErro('');setQ(undefined);
    try{const input=reparcelamento43PreviewSchema.parse(request);const response=await quoteSource.refetch();
      if(response.isError)throw new Error(response.error?.message??'Cotação indisponível; nenhuma execução enviada.');
      const quote=conferirCotacao43(response.data,uid,input);
      if(atual()&&currentForm.current===key)setQ(quote);
    }catch(error){if(atual())setErro(error instanceof Error?error.message:'Falha ao cotar.');}
    finally{click.current=false;if(atual())setBusy(false);}
  }
  async function enviar(){
    if(!owner||!visible||click.current||pending||!q||q.regra!=='reparcelamento43_v1'||!account||erro||JSON.stringify(q.request)!==requestKey)return;
    const uid=owner,version=epoch.current,atual=guard(uid,version);
    click.current=true;setBusy(true);setErro('');
    try{
      // Guardar/readback do payload FECHADO antes de mutateAsync; timeout jamais cria outra UUID.
      const input=intencao43DaCotacao(q,crypto.randomUUID());
      const value=await enviarIntencao43(localStorage,uid,input,atual,i=>execute.mutateAsync(i));
      if(atual()){setResult(value);setQ(undefined);}
    }catch(error){if(atual())setErro(error instanceof Error?error.message:'Resultado desconhecido. Confira a intenção preservada.');}
    finally{click.current=false;if(atual()){refresh(uid);setBusy(false);}}
  }
  async function conferir(){
    if(!owner||!visible||click.current)return;
    const uid=owner,version=epoch.current,atual=guard(uid,version);
    click.current=true;setBusy(true);setErro('');
    try{const value=await recuperarIntencao43(localStorage,uid,atual,i=>recovery.mutateAsync(i));
      if(atual()){if(value.status==='confirmed')setResult(value.result);else setErro('Não execução comprovada por fence durável. A UUID antiga está fechada; cote uma nova intenção.');setQ(undefined);}
    }catch(error){if(atual())setErro(error instanceof Error?error.message:'Conferência desconhecida; preserve a intenção.');}
    finally{click.current=false;if(atual()){refresh(uid);setBusy(false);}}
  }
  if(!visible)return <main className="p-6"><p>Conferindo sessão da empresa atual...</p></main>;
  return <main className="p-6 space-y-5 max-w-4xl">
    <h1 className="text-2xl font-semibold">Reparcelamento</h1>
    <ReparcelamentoAtual47 key={`${owner}:${contratoInicial ?? ""}`} owner={owner!} permitido={!pending} contratoInicial={contratoInicial}/>
    <h2 className="text-xl font-semibold">Legado43 — fluxo separado</h2>
    <p>O fluxo43 permanece restrito ao legado inteiramente aberto; nenhum fallback atual25 para origem21 ou43.</p>
    {erro&&<div role="alert"><p>{erro}</p>{!pending&&<Button variant="outline" disabled={busy} onClick={()=>setErro('')}>Voltar à conferência</Button>}</div>}
    {pending ? <section className="border p-4 space-y-3"><h2>Intenção preservada nesta empresa</h2><p>UUID: <code>{pending.idempotencyKey}</code> — origem #{pending.contratoId}</p><p>Não inicie outra execução. A conferência aguarda o mesmo lockUUID e confirma o commit ou grava fence permanente de não execução.</p><Button disabled={busy} onClick={()=>void conferir()}>Conferir mesma intenção no servidor</Button></section> : <>
      <fieldset disabled={busy} className="grid gap-3 border p-4">
        <label>Contrato de origem<Input value={contrato} onChange={e=>setContrato(e.target.value)} inputMode="numeric" /></label>
        <label>Número de parcelas (1–60)<Input value={n} onChange={e=>setN(e.target.value)} inputMode="numeric" /></label>
        <label>Taxa mensal decimal (ex.: 5.00)<Input value={taxa} onChange={e=>setTaxa(e.target.value)} inputMode="decimal" /></label>
        <label>Primeiro vencimento<Input type="date" value={data} onChange={e=>setData(e.target.value)} /></label>
        <label><input type="checkbox" checked={multas} onChange={e=>setMultas(e.target.checked)} /> Incluir multa/mora vencida uma única vez</label>
        <Button disabled={!!erro} onClick={()=>void cotar()}>Cotar no servidor</Button>
      </fieldset>
      {q&&<section className="border p-4 space-y-3"><h2>Cotação vinculada #{q.contratoId}</h2>
        <p>Saldo para nova agenda: R$ {q.saldoDevedor}; encargos incluídos: R$ {q.encargos}; juros novos: R$ {q.jurosNovos}; total: R$ {q.totalNovo}.</p>
        <p>Conta de origem preservada: #{q.contaCaixaId} {account?.nome??'— metadados desta empresa indisponíveis'}. Nenhum débito novo.</p>
        <table className="w-full"><thead><tr><th>Parcela</th><th>Vencimento</th><th>Principal</th><th>Juros</th><th>Total</th></tr></thead><tbody>{q.parcelas.map(p=><tr key={p.numero}><td>{p.numero}</td><td>{p.vencimento}</td><td>{p.principal}</td><td>{p.juros}</td><td>{p.valor}</td></tr>)}</tbody></table>
        <p>A última parcela pode diferir em centavos. Revise a tabela exata antes de confirmar.</p>
        <Button disabled={busy||!!erro||!account} onClick={()=>void enviar()}>Confirmar transferência43 sem desembolso</Button>
      </section>}
    </>}
    {result&&result.userId===owner&&<section className="border p-4 space-y-4"><h2>Sucessora #{result.contratoId} confirmada</h2><p>Origem #{result.contratoOrigemId}, raiz #{result.raizId}. Desembolso R$0,00. Receba cada parcela pelo fluxo transacional existente abaixo.</p>{result.parcelasIds.map(id=><div key={id}><h3>Parcela #{id}</h3><RecebimentoValidado contratoId={result.contratoId} parcelaId={id} permitirRenovacao={false} onSuccess={()=>{}} /></div>)}</section>}
  </main>;
}
