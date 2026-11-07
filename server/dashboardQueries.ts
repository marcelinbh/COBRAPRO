import { TRPCError } from "@trpc/server";

export function exigirFonteDashboard<T>(fonte: T | null): T {
  if (!fonte) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Fonte do dashboard indisponível; valores não calculados." });
  return fonte;
}

export function dadosDashboard(resultado: { data: unknown; error: { message: string } | null }): any[] {
  if (resultado.error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha na consulta do dashboard; valores não calculados." });
  if (!Array.isArray(resultado.data)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resposta incompleta do dashboard; valores não calculados." });
  return resultado.data;
}

/** Paginação determinística para não exibir como total apenas a primeira página REST. */
export async function listarDashboard(
  supabase: any,
  tabela: "contas_caixa" | "contratos" | "parcelas" | "transacoes_caixa",
  colunas: string,
  userId: number,
  configurar?: (query: any) => any,
): Promise<any[]> {
  const registros: any[] = [];
  const tamanhoPagina = 1000;
  for (let pagina = 0; pagina < 100; pagina++) {
    let query = supabase.from(tabela).select(colunas).eq("user_id", userId).order("id")
      .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);
    if (configurar) query = configurar(query);
    const lote = dadosDashboard(await query);
    registros.push(...lote);
    if (lote.length < tamanhoPagina) return registros;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Limite de leitura do dashboard excedido; total incompleto não apresentado." });
}
