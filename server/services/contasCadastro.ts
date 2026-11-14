import { TRPCError } from "@trpc/server";

const PAGE_SIZE = 100;
const MAX_CONTAS = 10000;
const PROJECAO = "id,nome,tipo,ativo,user_id";
export type FonteContasCadastro = { from: (tabela: string) => any };

/** Metadados do seletor, nunca certificação de saldo. A RPC revalida a conta ao gravar. */
export async function listarContasParaCadastro(fonte: FonteContasCadastro, userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão inválida." });
  }
  const contas: { id: number; nome: string; tipo: string }[] = [];
  let total: number | undefined;
  let ultimoId = 0;
  do {
    const { data, error, count } = await fonte.from("contas_caixa")
      .select(PROJECAO, { count: "exact" })
      .eq("user_id", userId).eq("ativo", true)
      .order("id", { ascending: true })
      .range(contas.length, contas.length + PAGE_SIZE - 1);
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0 || count > MAX_CONTAS ||
        (total !== undefined && count !== total) || data.length !== Math.min(PAGE_SIZE, count - contas.length)) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar todas as contas para cadastro. Tente novamente." });
    }
    total = count;
    for (const conta of data) {
      if (!Number.isSafeInteger(conta.id) || conta.id <= ultimoId || conta.user_id !== userId ||
          conta.ativo !== true || typeof conta.nome !== "string" || typeof conta.tipo !== "string") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível confirmar as contas desta empresa. Tente novamente." });
      }
      ultimoId = conta.id;
      contas.push({ id: conta.id, nome: conta.nome, tipo: conta.tipo });
    }
  } while (contas.length < total!);
  return { empresaId: userId, contas };
}
