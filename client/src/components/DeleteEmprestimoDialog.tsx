import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Nunca chamar contratos.deletar: exclusão exige compensação auditada ainda não certificada. */
export function DeleteEmprestimoDialog({ clienteNome, open, onOpenChange }: {
  emprestimoId: number; clienteNome: string; open: boolean;
  onOpenChange: (open: boolean) => void; onSuccess?: () => void;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Exclusão financeira indisponível</DialogTitle></DialogHeader>
    <p>Cliente: <strong>{clienteNome}</strong></p>
    <p>O contrato, as parcelas e o livro-caixa não serão apagados. O cancelamento com estorno compensatório precisa de um fluxo transacional auditado ainda não certificado.</p>
    <p>Alterar o calendário não cancela a dívida nem desfaz pagamentos.</p>
    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
  </DialogContent></Dialog>;
}
