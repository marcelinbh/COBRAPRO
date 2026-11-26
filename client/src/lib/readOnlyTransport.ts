import type { Operation } from "@trpc/client";

// Isolar somente estas leituras; mutations e demais queries mantêm batching.
const isolatedReadOnlyPaths = new Set([
  "auth.me",
  "contratos.listComParcelas",
  "contratos.listLeituraSegura",
  "contratos.obterDetalhes",
]);

export function shouldIsolateReadOnlyQuery(
  op: Pick<Operation, "type" | "path">,
): boolean {
  return op.type === "query" && isolatedReadOnlyPaths.has(op.path);
}
