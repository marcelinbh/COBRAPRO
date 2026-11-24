import { TRPCError } from "@trpc/server";
import {
  schemaCaixa45, idCaixa45, intencaoCaixa45, consultarCaixa45, consultaCaixa45,
  conferirRecoveryCaixa45, conferirResultadoCaixa45, type IntencaoCaixa45,
} from "../../shared/caixaManutencao45";
export * from "../../shared/caixaManutencao45";
type Rpc = { rpc(name: string, params: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export type ClienteCaixa45 = { schema(name: string): Rpc };
function erro(message: string): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}
async function chamar(client: ClienteCaixa45, name: "consultar" | "corrigir" | "reconciliar", params: Record<string, unknown>) {
  let raw: unknown;
  try { raw = await client.schema(schemaCaixa45).rpc(`rpc_${name}_observacao45`, params); }
  catch { erro("Resultado45 não confirmado. Preserve a mesma intenção/UUID e use Conferir envio; nenhum fallback foi executado."); }
  if (!raw || typeof raw !== "object" || !("data" in raw) || !("error" in raw)) erro("Envelope45 inválido; preserve UUID/intenção.");
  const response = raw as { data: unknown; error: unknown };
  if (response.error !== null) erro("Correção45 não confirmada ou indisponível. Preserve UUID/intenção e confira o envio; erro não prova ausência de execução.");
  return response.data;
}
export async function consultar45(client: ClienteCaixa45, userId: number, input: { transacaoId: number }) {
  idCaixa45.parse(userId);
  const i = consultarCaixa45.parse(input);
  const r = consultaCaixa45.parse(await chamar(client, "consultar", { p_user_id: userId, p_transacao_id: i.transacaoId }));
  if (r.empresaId !== userId || r.transacaoId !== i.transacaoId || (r.ultimaCorrecao &&
    (r.ultimaCorrecao.empresaId !== userId || r.ultimaCorrecao.transacaoId !== i.transacaoId || r.ultimaCorrecao.originalHash !== r.originalHash))) {
    erro("Prévia45 não corresponde à empresa/movimento atual.");
  }
  return r;
}
export async function corrigir45(client: ClienteCaixa45, userId: number, input: IntencaoCaixa45) {
  idCaixa45.parse(userId);
  const i = intencaoCaixa45.parse(input);
  return conferirResultadoCaixa45(await chamar(client, "corrigir", { p_user_id: userId, p_chave: i.idempotencyKey, p_request: i.request }), userId, i);
}
export async function reconciliar45(client: ClienteCaixa45, userId: number, input: IntencaoCaixa45) {
  idCaixa45.parse(userId);
  const i = intencaoCaixa45.parse(input);
  return conferirRecoveryCaixa45(await chamar(client, "reconciliar", { p_user_id: userId, p_chave: i.idempotencyKey, p_request: i.request }), userId, i);
}
