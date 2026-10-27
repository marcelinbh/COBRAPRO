import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getSupabaseClientAsync } from "../db";

export type TipoOperacaoFinanceira = "recebimento_parcela" | "renovacao_juros" | "pagamento_conta" | "estorno_conta" | "ajuste_manual" | "pagamento_assinatura";

type Reserva = {
  id: string;
  user_id: number;
  tipo: TipoOperacaoFinanceira;
  chave_idempotencia: string;
  hash_requisicao: string;
  status: "processando" | "concluida" | "falha";
  resultado: Record<string, unknown> | null;
};

export function criarChaveIdempotencia(): string {
  return randomUUID();
}

function hashRequest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * A migration de confiabilidade é aditiva. Enquanto uma base legada ainda não
 * a recebeu, não devemos impedir o recebimento ou a baixa de uma despesa. Os
 * fluxos usam atualizações condicionais da própria entidade como trava mínima
 * até que o livro de operações persistente esteja disponível.
 */
export function tabelaOperacionalAusente(error: unknown, tabela: string): boolean {
  const mensagem = String(
    typeof error === "object" && error && "message" in error
      ? (error as { message?: unknown }).message
      : error ?? ""
  ).toLowerCase();
  const tabelaNormalizada = tabela.toLowerCase();
  return (
    (mensagem.includes("could not find the table") && mensagem.includes(tabelaNormalizada)) ||
    (mensagem.includes("relation") && mensagem.includes(tabelaNormalizada) && mensagem.includes("does not exist"))
  );
}

export async function reservarOperacaoFinanceira(params: {
  userId: number;
  tipo: TipoOperacaoFinanceira;
  chaveIdempotencia: string;
  payload: unknown;
}): Promise<{ id: string; repetida: boolean; resultado?: Record<string, unknown> }> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

  const hash = hashRequest(params.payload);
  const operationId = randomUUID();
  const { data: criada, error: insertError } = await sb.from("operacoes_financeiras").insert({
    id: operationId,
    user_id: params.userId,
    tipo: params.tipo,
    chave_idempotencia: params.chaveIdempotencia,
    hash_requisicao: hash,
    status: "processando",
  }).select("id").maybeSingle();

  if (criada) return { id: criada.id, repetida: false };
  if (tabelaOperacionalAusente(insertError, "operacoes_financeiras")) {
    console.warn("[Operações financeiras] Tabela de idempotência ausente; usando a trava condicional da entidade até a migration ser aplicada.");
    return { id: operationId, repetida: false };
  }
  if (insertError && !String(insertError.message).toLowerCase().includes("duplicate")) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: insertError.message });
  }

  const { data: existente, error: existingError } = await sb.from("operacoes_financeiras")
    .select("id, user_id, tipo, chave_idempotencia, hash_requisicao, status, resultado")
    .eq("user_id", params.userId)
    .eq("chave_idempotencia", params.chaveIdempotencia)
    .maybeSingle();
  if (existingError || !existente) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: existingError?.message ?? "Não foi possível reservar a operação" });
  const reserva = existente as Reserva;
  if (reserva.tipo !== params.tipo || reserva.hash_requisicao !== hash) {
    throw new TRPCError({ code: "CONFLICT", message: "Esta chave de operação já foi usada para outro lançamento" });
  }
  if (reserva.status === "concluida") return { id: reserva.id, repetida: true, resultado: reserva.resultado ?? {} };
  if (reserva.status === "processando") throw new TRPCError({ code: "CONFLICT", message: "Este lançamento já está sendo processado. Aguarde alguns segundos antes de atualizar a tela." });
  throw new TRPCError({ code: "CONFLICT", message: "A operação anterior falhou. Inicie um novo lançamento para tentar novamente." });
}

export async function concluirOperacaoFinanceira(id: string, resultado: Record<string, unknown>): Promise<void> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const { error } = await sb.from("operacoes_financeiras").update({
    status: "concluida",
    resultado,
    concluida_em: new Date().toISOString(),
  }).eq("id", id).eq("status", "processando");
  if (tabelaOperacionalAusente(error, "operacoes_financeiras")) return;
  if (error) throw new Error(error.message);
}

export async function falharOperacaoFinanceira(id: string, erro: unknown): Promise<void> {
  const sb = await getSupabaseClientAsync();
  if (!sb) return;
  const { error } = await sb.from("operacoes_financeiras").update({
    status: "falha",
    erro: erro instanceof Error ? erro.message.slice(0, 500) : String(erro).slice(0, 500),
    concluida_em: new Date().toISOString(),
  }).eq("id", id).eq("status", "processando");
  if (error && !tabelaOperacionalAusente(error, "operacoes_financeiras")) {
    console.warn("[Operações financeiras] Não foi possível registrar a falha da operação:", error.message);
  }
}

export async function validarContaDoUsuario(userId: number, contaCaixaId: number): Promise<void> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  const { data, error } = await sb.from("contas_caixa").select("id, ativo")
    .eq("id", contaCaixaId).eq("user_id", userId).maybeSingle();
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data || data.ativo === false) throw new TRPCError({ code: "BAD_REQUEST", message: "A conta de caixa selecionada não está disponível para esta empresa" });
}

/**
 * O backend usa a chave de serviço do Supabase, portanto toda referência de
 * cliente recebida do navegador precisa ser vinculada ao assinante antes da
 * primeira escrita. Não confiar em RLS implícito neste caminho.
 */
export async function validarClienteDoUsuario(userId: number, clienteId: number): Promise<void> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  const { data, error } = await sb.from("clientes").select("id")
    .eq("id", clienteId).eq("user_id", userId).maybeSingle();
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado para esta empresa" });
}

export async function registrarAuditoriaFinanceira(params: {
  userId: number;
  operacaoId: string;
  acao: string;
  entidade: string;
  entidadeId: string | number;
  detalhes: Record<string, unknown>;
}): Promise<void> {
  const sb = await getSupabaseClientAsync();
  if (!sb) return;
  const { error } = await sb.from("auditoria_financeira").insert({
    id: randomUUID(),
    user_id: params.userId,
    operacao_id: params.operacaoId,
    acao: params.acao,
    entidade: params.entidade,
    entidade_id: String(params.entidadeId),
    detalhes: params.detalhes,
  });
  if (tabelaOperacionalAusente(error, "auditoria_financeira")) return;
  if (error) throw new Error(error.message);
}
