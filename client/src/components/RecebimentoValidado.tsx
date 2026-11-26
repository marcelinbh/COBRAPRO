import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmprestimoSeguroReceber } from "./EmprestimoSeguroReceber";
import { EmprestimoSeguroRenovar } from "./EmprestimoSeguroRenovar";
import { ParcelaLegadaReceber } from "./ParcelaLegadaReceber";
import { EmprestimoMultimodalReceber, EmprestimoMultimodalRenovar } from "./EmprestimoMultimodalOperacoes";
import { MultaManualReceber, MultaManualRenovar } from "./MultaManualOperacoes";

export function RecebimentoValidado({ contratoId, parcelaId, onSuccess, permitirRenovacao = false, revalidarSessaoAoMontar = true }: {
  contratoId: number; parcelaId: number; onSuccess: () => void; permitirRenovacao?: boolean; revalidarSessaoAoMontar?: boolean;
}) {
  // A página47 já revalida a sessão; evitar refetch circular ao remontar seu resultado local.
  const auth = trpc.auth.me.useQuery(undefined, { refetchOnMount: revalidarSessaoAoMontar });
  const user = !auth.isError && !auth.isLoading && !auth.isFetching ? auth.data : undefined;
  const scope = `${user?.id ?? 0}:${contratoId}:${parcelaId}`;
  const currentScope = useRef(scope);
  const epoch = useRef(0);
  if (currentScope.current !== scope) { currentScope.current = scope; epoch.current++; }
  const screenScope = `${scope}:${epoch.current}`;
  const [openedScope, setOpenedScope] = useState("");
  const [contaSelecionada, setContaSelecionada] = useState({ scope: "", id: "" });
  const open = openedScope === screenScope;
  const conta = contaSelecionada.scope === screenScope ? contaSelecionada.id : "";
  const input = { contratoId, parcelaId, escopoUserId: user?.id ?? 0 };
  const origem = trpc.recebimentosLegados.origem.useQuery(input, { enabled: open && !!user, retry: false, staleTime: 0 });
  const atual = !!user && !origem.isError && origem.data?.userId === user.id && origem.data?.contratoId === contratoId && origem.data?.parcelaId === parcelaId;
  const value = atual ? origem.data : undefined;
  const contas = trpc.caixa.contas.useQuery(undefined, { enabled: open && value?.trilho === "legado" && !["paga", "pago", "renovada", "cancelada", "cancelado"].includes(value.status) });
  const encerrada = value && ["paga", "pago", "renovada", "cancelada", "cancelado"].includes(value.status);
  const contaValida = !contas.isError && !contas.isLoading && !!contas.data?.some((c: any) => c.id === Number(conta) && c.ativo !== false);
  const expectedEpoch = epoch.current;
  const concluir = () => {
    if (currentScope.current !== scope || epoch.current !== expectedEpoch) return;
    void origem.refetch(); onSuccess();
  };
  const renovacao = value?.trilho === "prospectivo" && permitirRenovacao && (!encerrada || value.status === "renovada")
    ? <EmprestimoSeguroRenovar key={`renovar:${scope}`} contratoId={contratoId} parcelaId={parcelaId} origemUserId={value.userId} somenteConferencia={!!encerrada} onSuccess={() => concluir()} />
    : null;
  const renovacaoMultimodal = value?.trilho === "multimodal" && permitirRenovacao
    ? <EmprestimoMultimodalRenovar key={`multimodal-renovar:${screenScope}`} contratoId={contratoId} parcelaId={parcelaId} origemUserId={value.userId} status={value.status} onSuccess={concluir} />
    : null;
  const multa = value?.trilho === "multa36" ? <div className="space-y-3">
    <p className="text-sm">Ciclo de multa comprovado. Recebimento integral ou parcial e renovação usam a mesma prova financeira; não convertem para trilhos anteriores.</p>
    <MultaManualReceber key={`multa36-receber:${screenScope}`} contratoId={contratoId} parcelaId={parcelaId} origemUserId={value.userId} status={value.status} onSuccess={concluir} />
    {permitirRenovacao && <MultaManualRenovar key={`multa36-renovar:${screenScope}`} contratoId={contratoId} parcelaId={parcelaId} origemUserId={value.userId} status={value.status} onSuccess={concluir} />}
  </div> : null;
  return <>
    <Button size="sm" onClick={e => { e.stopPropagation(); setOpenedScope(screenScope); }}>Receber / conferir</Button>
    <Dialog open={open} onOpenChange={v => setOpenedScope(v ? screenScope : "")}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Recebimento com validação de integridade</DialogTitle></DialogHeader>
      {!open ? null : !user || origem.isLoading || origem.isFetching ? <p>Conferindo a origem na sessão atual...</p> : !value ? <><p role="alert">Não foi possível comprovar a origem nesta sessão. Nenhum recebimento será executado.</p><Button variant="outline" onClick={() => void origem.refetch()}>Tentar novamente</Button></> : value.trilho === "multa36" ? <>{encerrada && <p>Esta parcela está {value.status}. Principal transferido não é cobrado novamente. Confira somente a intenção existente ou a parcela sucessora.</p>}{multa}</> : encerrada ? <div className="space-y-3"><p>Esta parcela está {value.status}. Principal transferido não é cobrado novamente. Consulte a parcela sucessora ou o histórico.</p>{renovacao}{value.trilho === "multimodal" && <EmprestimoMultimodalReceber key={`multimodal-receber:${screenScope}`} contratoId={contratoId} parcelaId={parcelaId} origemUserId={value.userId} status={value.status} onSuccess={concluir} />}{renovacaoMultimodal}</div> : value.trilho === "multimodal" ? <div className="space-y-3">
        <p className="text-sm">Origem multimodal comprovada. Conta, parcelas e encargos serão conferidos no mesmo ciclo financeiro; sem conversão para o legado.</p>
        <EmprestimoMultimodalReceber key={`multimodal-receber:${screenScope}`} contratoId={contratoId} parcelaId={parcelaId} origemUserId={value.userId} status={value.status} onSuccess={concluir} />
        {renovacaoMultimodal}
      </div> : value.trilho === "prospectivo" ? <div className="space-y-3">
        <p className="text-sm">Empréstimo criado pelo fluxo atômico. Conta e encargos serão conferidos pela cotação do banco; integral ou parcial sem descontos.</p>
        <EmprestimoSeguroReceber key={scope} contratoId={contratoId} parcelaId={parcelaId} onSuccess={concluir} />
        {renovacao}
      </div> : <div className="space-y-3">
        <p className="text-sm">Registro antigo: somente recebimento integral virgem e sem encargos ambíguos, mediante validação SQL. Valores divergentes não são corrigidos automaticamente.</p>
        {contas.isError ? <><p role="alert">Não foi possível conferir as contas do Caixa.</p><Button variant="outline" onClick={() => void contas.refetch()}>Retentar contas</Button></> : <label className="block text-sm">Escolha explicitamente a conta de destino<select className="w-full border rounded p-2 bg-background" value={conta} disabled={contas.isLoading} onChange={e => setContaSelecionada({ scope: screenScope, id: e.target.value })}><option value="">Selecionar conta</option>{contas.data?.filter((c: any) => c.ativo !== false).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
        {contaValida && <ParcelaLegadaReceber key={`legado:${scope}`} contratoId={contratoId} parcelaId={parcelaId} contaCaixaId={Number(conta)} onSuccess={concluir} />}
      </div>}
    </DialogContent></Dialog>
  </>;
}
