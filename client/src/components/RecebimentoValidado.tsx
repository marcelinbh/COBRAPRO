import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmprestimoSeguroReceber } from "./EmprestimoSeguroReceber";
import { EmprestimoSeguroRenovar } from "./EmprestimoSeguroRenovar";
import { ParcelaLegadaReceber } from "./ParcelaLegadaReceber";

export function RecebimentoValidado({ contratoId, parcelaId, onSuccess, permitirRenovacao = false }: {
  contratoId: number; parcelaId: number; onSuccess: () => void; permitirRenovacao?: boolean;
}) {
  const { data: user } = trpc.auth.me.useQuery();
  const [open, setOpen] = useState(false), [conta, setConta] = useState("");
  const input = { contratoId, parcelaId, escopoUserId: user?.id ?? 0 };
  const origem = trpc.recebimentosLegados.origem.useQuery(input, { enabled: open && !!user, retry: false, staleTime: 0 });
  const contas = trpc.caixa.contas.useQuery(undefined, { enabled: open && origem.data?.trilho === "legado" });
  const atual = !origem.isError && origem.data?.userId === user?.id && origem.data?.contratoId === contratoId && origem.data?.parcelaId === parcelaId;
  const value = atual ? origem.data : undefined;
  const encerrada = value && ["renovada", "cancelada", "cancelado"].includes(value.status);
  const contaValida = !contas.isError && !contas.isLoading && !!contas.data?.some((c: any) => c.id === Number(conta) && c.ativo !== false);
  const concluir = () => { void origem.refetch(); onSuccess(); };
  return <>
    <Button size="sm" onClick={e => { e.stopPropagation(); setOpen(true); }}>Receber / conferir</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Recebimento com validação de integridade</DialogTitle></DialogHeader>
      {!user || origem.isLoading || origem.isFetching ? <p>Conferindo a origem na sessão atual...</p> : !value ? <><p role="alert">Não foi possível comprovar a origem nesta sessão. Nenhum recebimento será executado.</p><Button variant="outline" onClick={() => void origem.refetch()}>Tentar novamente</Button></> : encerrada ? <p>Esta parcela está {value.status}. Principal transferido não é cobrado novamente. Consulte a parcela sucessora ou o histórico.</p> : value.trilho === "prospectivo" ? <div className="space-y-3">
        <p className="text-sm">Empréstimo criado pelo fluxo atômico. Conta e encargos serão conferidos pela cotação do banco; integral ou parcial sem descontos.</p>
        <EmprestimoSeguroReceber key={`${user.id}:${contratoId}:${parcelaId}`} contratoId={contratoId} parcelaId={parcelaId} onSuccess={concluir} />
        {permitirRenovacao && <EmprestimoSeguroRenovar key={`renovar:${user.id}:${contratoId}:${parcelaId}`} contratoId={contratoId} parcelaId={parcelaId} onSuccess={() => concluir()} />}
      </div> : <div className="space-y-3">
        <p className="text-sm">Registro antigo: somente recebimento integral virgem e sem encargos ambíguos, mediante validação SQL. Valores divergentes não são corrigidos automaticamente.</p>
        {contas.isError ? <><p role="alert">Não foi possível conferir as contas do Caixa.</p><Button variant="outline" onClick={() => void contas.refetch()}>Retentar contas</Button></> : <label className="block text-sm">Escolha explicitamente a conta de destino<select className="w-full border rounded p-2 bg-background" value={conta} disabled={contas.isLoading} onChange={e => setConta(e.target.value)}><option value="">Selecionar conta</option>{contas.data?.filter((c: any) => c.ativo !== false).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
        {contaValida && <ParcelaLegadaReceber key={`legado:${user.id}:${contratoId}:${parcelaId}`} contratoId={contratoId} parcelaId={parcelaId} contaCaixaId={Number(conta)} onSuccess={concluir} />}
      </div>}
    </DialogContent></Dialog>
  </>;
}
