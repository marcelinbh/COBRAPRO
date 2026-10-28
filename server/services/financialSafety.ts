import { TRPCError } from "@trpc/server";

/**
 * Contenção temporária: operações que escrevem na entidade de negócio e no
 * livro de Caixa em chamadas REST separadas ficam bloqueadas. A futura RPC
 * transacional deverá substituir a mutação, e não reativar este caminho.
 */
export function bloquearOperacaoFinanceiraNaoAtomica(operacao: string): void {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: `${operacao} está temporariamente suspenso para proteção do Caixa. Use consulta e conferência enquanto a atualização de segurança financeira é concluída.`,
  });
}
