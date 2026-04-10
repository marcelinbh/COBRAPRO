import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function DeleteEmprestimoDialog({
  emprestimoId,
  clienteNome,
  open,
  onOpenChange,
  onSuccess,
}: {
  emprestimoId: number;
  clienteNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const deleteEmprestimo = trpc.contratos.deletar.useMutation({
    onSuccess: () => {
      toast.success("Empréstimo deletado com sucesso");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message || "Erro ao deletar empréstimo"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Deletar Empréstimo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Tem certeza que deseja deletar este empréstimo?</p>
              <p className="text-sm text-muted-foreground mt-1">Cliente: <strong>{clienteNome}</strong></p>
              <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita. Todas as parcelas serão removidas.</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteEmprestimo.mutate({ id: emprestimoId })}
              disabled={deleteEmprestimo.isPending}
            >
              {deleteEmprestimo.isPending ? "Deletando..." : "Deletar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
