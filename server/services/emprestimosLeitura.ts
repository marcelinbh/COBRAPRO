import { TRPCError } from "@trpc/server";

export const falhaLeituraEmprestimos = () => new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar os empréstimos. Tente novamente." });
export const falhaVinculoEmprestimos = () => new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível confirmar os vínculos dos empréstimos desta conta." });

/** Somente consultas de escopo próprio. Para integridade, a projeção contém apenas metadados. */
export async function listarRegistrosEmprestimos(criarQuery: () => any, userId: number): Promise<any[]> {
  const registros: any[] = [];
  const identidades = new Set<string>();
  let total: number | undefined;
  for (let pagina = 0; pagina < 20; pagina++) {
    let resultado;
    try { resultado = await criarQuery().range(pagina * 1000, (pagina + 1) * 1000 - 1); }
    catch { throw falhaLeituraEmprestimos(); }
    if (!resultado || resultado.error || !Array.isArray(resultado.data) ||
        !Number.isSafeInteger(resultado.count) || resultado.count < 0 || resultado.count >= 20000 ||
        (total !== undefined && resultado.count !== total) ||
        resultado.data.length !== Math.min(1000, resultado.count - registros.length)) throw falhaLeituraEmprestimos();
    total = resultado.count;
    for (const r of resultado.data) {
      if (!r || r.user_id !== userId) throw falhaVinculoEmprestimos();
      const identidade = Number.isSafeInteger(r.id) && r.id > 0 ? `id:${r.id}` :
        r.id === undefined && typeof r.chave === "string" ? `chave:${r.chave}` : null;
      if (!identidade || identidades.has(identidade)) throw falhaVinculoEmprestimos();
      identidades.add(identidade);
    }
    registros.push(...resultado.data);
    if (registros.length === total) return registros;
  }
  throw falhaLeituraEmprestimos();
}
