import { TRPCError } from "@trpc/server";
import { z } from "zod";

const id = z.number().int().positive().max(2147483647);
const nome = z.string().trim().refine(v => Array.from(v).length >= 1 && Array.from(v).length <= 255);
const tipo = z.string().trim().pipe(z.enum(["caixa", "banco", "digital"]));
/** Owner nunca faz parte do input. Defaults são somente os presets da tela existente. */
export const onboardingCompleteSchema = z.object({
  nomeEmpresa: nome,
  nomeConta: nome.optional().default("Caixa Principal"),
  tipoConta: tipo.optional().default("caixa"),
}).strict();
export type EntradaOnboarding = z.input<typeof onboardingCompleteSchema>;
const resultadoSchema = z.object({
  success: z.literal(true), id, conta_id: id, onboardingCompleto: z.literal(true),
  nomeEmpresa: nome, nomeConta: nome, tipoConta: tipo,
  repetida: z.boolean(), contaCriada: z.boolean(),
}).strict();
export type ResultadoOnboarding = z.infer<typeof resultadoSchema>;
export type ClienteOnboardingRpc = {
  rpc: (nome: string, parametros: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { code?: string | null } | null;
  }>;
};
function falhar(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}

/** Uma RPC, zero REST/fallback, zero feature flags. Instalar 0024 antes do deploy. */
export async function concluirOnboardingRpc(
  cliente: ClienteOnboardingRpc | null, userId: number, input: EntradaOnboarding,
): Promise<ResultadoOnboarding> {
  if (!id.safeParse(userId).success) falhar("BAD_REQUEST", "Usuário do servidor inválido.");
  const entrada = onboardingCompleteSchema.safeParse(input);
  if (!entrada.success) falhar("BAD_REQUEST", "Informe nomes de 1 a 255 caracteres e um tipo de conta válido.");
  if (!cliente || typeof cliente.rpc !== "function") {
    falhar("PRECONDITION_FAILED", "Onboarding indisponível. Instale a migração 0024 antes de liberar o fluxo.");
  }
  const i = entrada.data;
  let response: Awaited<ReturnType<ClienteOnboardingRpc["rpc"]>>;
  try {
    response = await cliente.rpc("rpc_concluir_onboarding", {
      p_user_id: userId, p_nome_empresa: i.nomeEmpresa, p_nome_conta: i.nomeConta, p_tipo_conta: i.tipoConta,
    });
  } catch {
    falhar("INTERNAL_SERVER_ERROR", "Conclusão não confirmada. Confira ou repita os mesmos dados, sem presumir rollback.");
  }
  if (!response || typeof response !== "object" || !("error" in response) || !("data" in response)) {
    falhar("INTERNAL_SERVER_ERROR", "Confirmação de onboarding inválida. Confira os mesmos dados antes de prosseguir.");
  }
  if (response.error !== null && (typeof response.error !== "object" || !response.error
      || (response.error.code !== undefined && response.error.code !== null && typeof response.error.code !== "string"))) {
    falhar("INTERNAL_SERVER_ERROR", "Confirmação de onboarding inválida. Confira os mesmos dados antes de prosseguir.");
  }
  if (response.error) {
    const code = response.error.code;
    if (["PGRST202", "PGRST203", "42883", "42P01", "42703"].includes(code ?? "")) {
      falhar("PRECONDITION_FAILED", "RPC de onboarding indisponível. Instale a migração 0024; não há fallback.");
    }
    if (["22023", "22P02", "22001"].includes(code ?? "")) falhar("BAD_REQUEST", "Dados de onboarding inválidos.");
    if (["23505", "23514", "40001", "40P01"].includes(code ?? "")) {
      falhar("CONFLICT", "Onboarding ou conta incompatível. Preserve os dados existentes e confira a mesma intenção.");
    }
    if (code === "42501") falhar("FORBIDDEN", "Usuário ou permissão de onboarding indisponível.");
    falhar("INTERNAL_SERVER_ERROR", "Conclusão não confirmada. Confira os mesmos dados antes de prosseguir.");
  }
  // Não coage IDs strings/bigint; JSONB da assinatura integer deve retornar números reais.
  const parsed = resultadoSchema.safeParse(response.data);
  if (!parsed.success) falhar("INTERNAL_SERVER_ERROR", "Confirmação de onboarding inválida. Confira os mesmos dados antes de prosseguir.");
  const r = parsed.data;
  const raw = response.data as Record<string, unknown>;
  if (r.id !== userId || r.nomeEmpresa !== i.nomeEmpresa || r.nomeConta !== i.nomeConta || r.tipoConta !== i.tipoConta
      || raw.nomeEmpresa !== r.nomeEmpresa || raw.nomeConta !== r.nomeConta || raw.tipoConta !== r.tipoConta
      || (r.repetida && r.contaCriada)) {
    falhar("INTERNAL_SERVER_ERROR", "Confirmação divergiu do usuário ou da intenção. Não conclua o fluxo sem conferir.");
  }
  return r;
}

/** Importar no pai: .input(onboardingCompleteSchema).mutation(criarOnboardingCompleteHandler(getSupabaseClientAsync)). */
export function criarOnboardingCompleteHandler(getCliente: () => Promise<ClienteOnboardingRpc | null>) {
  return async ({ ctx, input }: { ctx: { user: { id: number } | null }; input: EntradaOnboarding }) => {
    if (!ctx.user) falhar("UNAUTHORIZED", "Autenticação necessária.");
    let cliente: ClienteOnboardingRpc | null;
    try { cliente = await getCliente(); }
    catch { falhar("PRECONDITION_FAILED", "Serviço de onboarding indisponível."); }
    return concluirOnboardingRpc(cliente, ctx.user.id, input);
  };
}
