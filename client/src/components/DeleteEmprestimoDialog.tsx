import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OperacoesObrigacao51 } from '@/components/OperacoesObrigacao51';

/** Não exclui base financeira: o mesmo protocolo exato cancela obrigação ou arquiva alvo encerrado. */
export function DeleteEmprestimoDialog({ emprestimoId, clienteNome, open, onOpenChange, onSuccess }: {
  emprestimoId: number; clienteNome: string; open: boolean;
  onOpenChange: (open: boolean) => void; onSuccess?: () => void | Promise<void>;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>Cancelar obrigação / arquivar contrato encerrado</DialogTitle></DialogHeader>
    <p>Cliente: <strong>{clienteNome}</strong>. Contrato #{emprestimoId}.</p>
    <p>Não é exclusão: histórico, dinheiro pago e caixa permanecem. Cancelar é renúncia à obrigação aberta, sem estorno. Para ocultar contrato já encerrado, escolha Arquivar.</p>
    {open && <OperacoesObrigacao51 key={emprestimoId} inline contratoId={emprestimoId}
      alvoInicial={{ tipo: 'contrato' }} acaoInicial="cancelar" onSuccess={onSuccess} />}
    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar (não cancela pedido enviado)</Button>
  </DialogContent></Dialog>;
}
