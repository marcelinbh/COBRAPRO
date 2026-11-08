import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { EmprestimosProspectivosAppRouter } from "../../../server/routers/emprestimosProspectivos";

// Mesmo transporte autenticado da aplicação; só tipos server, sem credenciais no browser.
export const cicloRpc = createTRPCProxyClient<EmprestimosProspectivosAppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson,
    fetch(input, init) { return globalThis.fetch(input, { ...init, credentials: "include" }); },
  })],
}).emprestimosProspectivos;
export type IntencaoPersistida<T> = { versao: 1; payload: T; confirmacao?: unknown };
export function chaveIntencao(tenant: number, acao: "criar" | "receber", parcela?: number): string {
  return `cobrapro:ciclo:v1:${tenant}:${acao}:${parcela ?? "nova"}`;
}
/** A resposta de A não pode preencher a tela, toast ou callback da sessão B. */
export function escopoFinanceiroAtual(ref: { current: string }, esperado: string): boolean {
  return esperado.length > 0 && ref.current === esperado;
}
export function lerIntencao<T>(storage: Pick<Storage, "getItem">, key: string): IntencaoPersistida<T> | null {
  const text = storage.getItem(key);
  if (!text) return null;
  const value = JSON.parse(text);
  if (value?.versao !== 1 || !value.payload || typeof value.payload.idempotencyKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.payload.idempotencyKey)) {
    throw new Error("Intenção de sessão inválida. Não crie uma segunda operação: confira o histórico.");
  }
  return value as IntencaoPersistida<T>;
}
export function guardarIntencao<T>(storage: Pick<Storage, "setItem">, key: string, value: IntencaoPersistida<T>) {
  // Falha de storage impede envio: não ter UUID/payload durável torna timeout inseguro.
  storage.setItem(key, JSON.stringify(value));
}
export function dinheiroIntencao(value: string): string {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) throw new Error("Informe valor decimal com até duas casas, sem arredondamento.");
  const [inteiro, decimal = ""] = value.split(".");
  return `${BigInt(inteiro)}.${decimal.padEnd(2, "0")}`;
}
