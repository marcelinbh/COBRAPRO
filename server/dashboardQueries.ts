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

/** A produção não possui FK parcelas.cliente_id: não depender de embed PostgREST. */
export async function vincularClientesDashboard(supabase: any, parcelas: any[], userId: number): Promise<any[]> {
  if (parcelas.length === 0) return [];
  const ids = Array.from(new Set(parcelas.map(p => p.cliente_id)));
  if (parcelas.length > 20 || ids.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Parcelas com vínculo de cliente inválido; revisão necessária." });
  }
  const clientes = dadosDashboard(await supabase.from("clientes").select("id, nome, user_id")
    .eq("user_id", userId).in("id", ids).limit(20));
  const porId = new Map<number, any>();
  for (const cliente of clientes) {
    if (!ids.includes(cliente.id) || cliente.user_id !== userId || typeof cliente.nome !== "string" || !cliente.nome.trim() || porId.has(cliente.id)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Resposta de clientes incompatível com a empresa; revisão necessária." });
    }
    porId.set(cliente.id, cliente);
  }
  if (porId.size !== ids.length) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Parcelas sem vínculo de cliente confirmado na empresa; revisão necessária." });
  }
  return parcelas.map(parcela => ({ ...parcela, clientes: { nome: porId.get(parcela.cliente_id).nome } }));
}
