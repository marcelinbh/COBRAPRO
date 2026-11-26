import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// TanStack chooses 0 retries on the server, 3 in the browser. This Node-only
// fixture needs the browser default, not an artificial `retry: 3` override.
// No DOM, app module, HTTP transport, server, auth, DB or .env is loaded.
vi.hoisted(() => vi.stubGlobal("window", {}));
import { isServer, QueryClient, QueryObserver } from "@tanstack/react-query";
import type { QueryObserverOptions, QueryObserverResult } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { deveUsarListaSegura } from "../../../shared/emprestimosListaSegura";

const source = readFileSync(new URL("./Emprestimos.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("Emprestimos.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = [];
  function walk(node: ts.Node) {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, walk);
  }
  walk(root);
  return found;
}
function exactlyOne<T extends ts.Node>(nodes: ts.Node[], label: string): T {
  if (nodes.length !== 1) throw new Error(`${label}: expected 1 AST node, found ${nodes.length}`);
  return nodes[0] as T;
}
const page = exactlyOne<ts.FunctionDeclaration>(find(ast, node =>
  ts.isFunctionDeclaration(node) && node.name?.text === "Emprestimos"), "page");
const strictQuery = exactlyOne<ts.CallExpression>(find(page, node =>
  ts.isCallExpression(node) && node.expression.getText(ast) === "trpc.contratos.listComParcelas.useQuery"), "strict query");
function evaluate(expression: ts.Expression, bindings: Record<string, unknown>): unknown {
  const javascript = ts.transpileModule(`(${expression.getText(ast)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(bindings), `return ${javascript}`)(...Object.values(bindings));
}
// The retry predicate comes from the actual useQuery options, not a test copy.
const productionOptions = (strictQuery.arguments[1]
  ? evaluate(strictQuery.arguments[1], { deveUsarListaSegura }) : {}) as Partial<QueryObserverOptions<unknown, unknown>>;
const fallback = exactlyOne<ts.IfStatement>(find(page, node => ts.isIfStatement(node) &&
  node.thenStatement.getText(ast).startsWith("return <EmprestimosListaSeguraFallback")), "safe fallback");
const fallbackElement = exactlyOne<ts.JsxSelfClosingElement>(find(fallback.thenStatement, node =>
  ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "EmprestimosListaSeguraFallback"), "fallback element");
const retryAttribute = exactlyOne<ts.JsxAttribute>(Array.from(fallbackElement.attributes.properties).filter(node =>
  ts.isJsxAttribute(node) && node.name.getText(ast) === "onRetryStrict"), "manual strict retry");
const retryExpression = (retryAttribute.initializer as ts.JsxExpression).expression!;
const readingGuard = exactlyOne<ts.VariableDeclaration>(find(page, node =>
  ts.isVariableDeclaration(node) && node.name.getText(ast) === "leituraEmAndamento"), "reading guard");
function safeAllowed(result: QueryObserverResult<unknown, unknown>): boolean {
  return evaluate(fallback.expression, { isError: result.isError, erroLista: result.error, deveUsarListaSegura }) as boolean;
}
function readingInProgress(result: QueryObserverResult<unknown, unknown>): boolean {
  return evaluate(readingGuard.initializer!, {
    isLoading: result.isLoading, isPending: result.isPending, isError: result.isError,
    isFetching: result.isFetching, emprestimos: result.data,
  }) as boolean;
}
function runManualRetry(refetch: () => unknown): void {
  (evaluate(retryExpression, { refetch }) as () => void)();
}
function precondition(): TRPCClientError<any> {
  // Real client error materialized from a synthetic tRPC wire-shaped fixture;
  // HTTP metadata 207 deliberately differs from the semantic error code.
  return TRPCClientError.from({ error: {
    code: -32012, message: "Offline fixture: strict relationship unavailable",
    data: { code: "PRECONDITION_FAILED", httpStatus: 412, path: "contratos.listComParcelas" },
  } }, { meta: { response: { status: 207 } } });
}
const RETRY_GATE_MS = 60_000;
const cleanups: (() => void)[] = [];
let sequence = 0;
function observe(queryFn: () => Promise<unknown>, options = productionOptions, client = new QueryClient(), queryKey: readonly unknown[] = ["offline-strict", ++sequence]) {
  const observer = new QueryObserver<unknown, unknown>(client, {
    queryKey, queryFn, gcTime: Infinity, retryDelay: RETRY_GATE_MS, ...options,
  });
  const snapshots: QueryObserverResult<unknown, unknown>[] = [];
  const unsubscribe = observer.subscribe(result => snapshots.push(result));
  cleanups.push(() => { unsubscribe(); client.clear(); });
  return { client, observer, snapshots };
}
async function microtasks() {
  // Bounded promise turns only: do not advance timers or sleep in wall time.
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
}
async function releaseRetryGate() {
  await vi.advanceTimersByTimeAsync(RETRY_GATE_MS);
  await microtasks();
}
function evidence(label: string, calls: number, result: QueryObserverResult<unknown, unknown>) {
  console.info(JSON.stringify({ label, calls, status: result.status, fetchStatus: result.fetchStatus,
    failureCount: result.failureCount, strictDataUnavailable: result.data === undefined,
    safeAllowed: safeAllowed(result) }));
}
beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(async () => {
  cleanups.splice(0).reverse().forEach(cleanup => cleanup());
  await microtasks();
  vi.clearAllTimers();
  vi.useRealTimers();
});
afterAll(() => vi.unstubAllGlobals());

describe("strict loan-list read-only retry policy (real TanStack observer, offline)", () => {
  it("uses installed TanStack 5.90.2 and the actual browser default, without setting global retry", () => {
    const require = createRequire(import.meta.url);
    const pkg = JSON.parse(readFileSync(require.resolve("@tanstack/react-query/package.json"), "utf8"));
    expect(pkg.version).toBe("5.90.2");
    expect(isServer).toBe(false);
    const client = new QueryClient();
    expect(client.getDefaultOptions()).toEqual({});
    expect(client.defaultQueryOptions({ queryKey: ["unconfigured"] }).retry).toBeUndefined();
  });

  it("control: unchanged browser defaults keep strict 412 pending after first error, then exhaust 4 attempts", async () => {
    const error = precondition();
    expect(error).toBeInstanceOf(TRPCClientError);
    expect(error.data?.code).toBe("PRECONDITION_FAILED");
    expect((error.meta?.response as { status: number }).status).toBe(207);
    const queryFn = vi.fn().mockRejectedValue(error);
    const { observer } = observe(queryFn, {});
    await microtasks();
    const first = observer.getCurrentResult();
    evidence("BASELINE_DEFAULT_412_FIRST_FAILURE", queryFn.mock.calls.length, first);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ status: "pending", fetchStatus: "fetching", isError: false,
      data: undefined, error: null, failureReason: error, failureCount: 1 });
    expect(safeAllowed(first)).toBe(false);
    expect(readingInProgress(first)).toBe(true);
    for (let attempt = 2; attempt <= 4; attempt++) {
      await releaseRetryGate();
      expect(queryFn).toHaveBeenCalledTimes(attempt);
    }
    expect(observer.getCurrentResult()).toMatchObject({ status: "error", fetchStatus: "idle", error });
    await vi.advanceTimersByTimeAsync(RETRY_GATE_MS * 10);
    expect(queryFn).toHaveBeenCalledTimes(4);
  });

  it("regression: real strict 412 reaches error after one call/microtasks, with no strict data and safe now allowed", async () => {
    const error = precondition();
    const queryFn = vi.fn().mockRejectedValue(error);
    const { observer, snapshots } = observe(queryFn);
    await microtasks();
    const result = observer.getCurrentResult();
    evidence("PRODUCTION_OPTIONS_412_FIRST_FAILURE", queryFn.mock.calls.length, result);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "error", fetchStatus: "idle", isError: true,
      isPending: false, data: undefined, error, failureCount: 1 });
    expect(safeAllowed(result)).toBe(true);
    expect(snapshots.filter(snapshot => !snapshot.isError).every(snapshot => !safeAllowed(snapshot))).toBe(true);
    await vi.advanceTimersByTimeAsync(RETRY_GATE_MS * 10);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("matching synthetic data.code follows the existing helper (it does not require instanceof)", async () => {
    const error = { data: { code: "PRECONDITION_FAILED" } };
    expect(deveUsarListaSegura(error)).toBe(true);
    const queryFn = vi.fn().mockRejectedValue(error);
    const { observer } = observe(queryFn);
    await microtasks();
    expect(observer.getCurrentResult()).toMatchObject({ status: "error", data: undefined });
    expect(safeAllowed(observer.getCurrentResult())).toBe(true);
    await vi.advanceTimersByTimeAsync(RETRY_GATE_MS * 10);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("does not enter safe before strict completion, or after strict success", async () => {
    let resolve!: (value: unknown) => void;
    const queryFn = vi.fn(() => new Promise<unknown>(done => { resolve = done; }));
    const { observer } = observe(queryFn);
    await microtasks();
    expect(observer.getCurrentResult()).toMatchObject({ status: "pending", error: null, data: undefined });
    expect(readingInProgress(observer.getCurrentResult())).toBe(true);
    expect(safeAllowed(observer.getCurrentResult())).toBe(false);
    resolve([]);
    await microtasks();
    expect(observer.getCurrentResult()).toMatchObject({ status: "success", data: [] });
    expect(safeAllowed(observer.getCurrentResult())).toBe(false);
    expect(readingInProgress(observer.getCurrentResult())).toBe(false);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("manual callback extracted from page still executes one further strict attempt after 412", async () => {
    const queryFn = vi.fn().mockRejectedValue(precondition());
    const { observer } = observe(queryFn);
    await microtasks();
    expect(observer.getCurrentResult().isError).toBe(true);
    const refetch = vi.fn(() => observer.refetch());
    runManualRetry(refetch);
    await microtasks();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult()).toMatchObject({ status: "error", fetchStatus: "idle", data: undefined });
    await vi.advanceTimersByTimeAsync(RETRY_GATE_MS * 10);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  const nearErrors: [string, unknown][] = [
    ["transient network Error", new Error("Offline synthetic transient")],
    ["plain HTTP status 412 without tRPC data.code", { status: 412 }],
    ["plain httpStatus 412", { httpStatus: 412 }],
    ["nested HTTP status but no semantic code", { data: { httpStatus: 412 } }],
    ["top-level semantic-looking code", { code: "PRECONDITION_FAILED" }],
    ["near code", { data: { code: "PRECONDITION_FAILED_EXTRA" } }],
    ["numeric code", { data: { code: 412 } }],
    ["tRPC unauthorized even if HTTP metadata says 412", TRPCClientError.from({ error: {
      code: -32001, message: "Offline unauthorized", data: { code: "UNAUTHORIZED", httpStatus: 412 },
    } })],
    ["tRPC internal server error", TRPCClientError.from({ error: {
      code: -32603, message: "Offline transient", data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
    } })],
  ];
  it.each(nearErrors)("keeps exactly 3 retries / 4 attempts, never safe or infinite: %s", async (_label, error) => {
    expect(deveUsarListaSegura(error)).toBe(false);
    const queryFn = vi.fn().mockRejectedValue(error);
    const { observer } = observe(queryFn);
    await microtasks();
    expect(observer.getCurrentResult()).toMatchObject({ status: "pending", failureCount: 1 });
    expect(queryFn).toHaveBeenCalledTimes(1);
    for (let attempt = 2; attempt <= 4; attempt++) {
      await releaseRetryGate();
      expect(queryFn).toHaveBeenCalledTimes(attempt);
    }
    expect(observer.getCurrentResult()).toMatchObject({ status: "error", fetchStatus: "idle", data: undefined, error });
    expect(safeAllowed(observer.getCurrentResult())).toBe(false);
    await vi.advanceTimersByTimeAsync(RETRY_GATE_MS * 10);
    expect(queryFn).toHaveBeenCalledTimes(4);
  });

  it("transient failure retries successfully without entering safe", async () => {
    const queryFn = vi.fn().mockRejectedValueOnce(new Error("Offline temporary"))
      .mockResolvedValueOnce([{ fixture: "strict-success" }]);
    const { observer, snapshots } = observe(queryFn);
    await microtasks();
    expect(observer.getCurrentResult().isPending).toBe(true);
    await releaseRetryGate();
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult()).toMatchObject({ status: "success", data: [{ fixture: "strict-success" }] });
    expect(snapshots.every(snapshot => !safeAllowed(snapshot))).toBe(true);
    await vi.advanceTimersByTimeAsync(RETRY_GATE_MS * 10);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("a 412 after a transient retry stops immediately at that second attempt", async () => {
    const error = precondition();
    const queryFn = vi.fn().mockRejectedValueOnce(new Error("Offline temporary")).mockRejectedValue(error);
    const { observer } = observe(queryFn);
    await microtasks();
    await releaseRetryGate();
    expect(observer.getCurrentResult()).toMatchObject({ status: "error", error, data: undefined });
    expect(safeAllowed(observer.getCurrentResult())).toBe(true);
    await vi.advanceTimersByTimeAsync(RETRY_GATE_MS * 10);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("strict and safe cache keys stay independent; per-query policy leaves neighbors at browser defaults", async () => {
    const client = new QueryClient();
    const strictKey = ["fixture", "contratos.listComParcelas"] as const;
    const safeKey = ["fixture", "contratos.listLeituraSegura"] as const;
    const safeCache = { fixture: "existing-safe-only" };
    client.setQueryData(safeKey, safeCache);
    const strictFn = vi.fn().mockRejectedValue(precondition());
    const { observer } = observe(strictFn, productionOptions, client, strictKey);
    await microtasks();
    expect(safeAllowed(observer.getCurrentResult())).toBe(true);
    expect(client.getQueryData(strictKey)).toBeUndefined();
    expect(client.getQueryData(safeKey)).toBe(safeCache);
    expect(client.getDefaultOptions()).toEqual({});
    const neighborFn = vi.fn().mockRejectedValue(precondition());
    const neighbor = observe(neighborFn, {}, client, ["fixture", "unmodified-neighbor"]);
    await microtasks();
    expect(neighbor.observer.getCurrentResult().isPending).toBe(true);
    for (let retry = 0; retry < 3; retry++) await releaseRetryGate();
    expect(neighborFn).toHaveBeenCalledTimes(4);
    expect(strictFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(safeKey)).toBe(safeCache);
  });

  it("cached strict data remains uncertified on 412; page error gate takes priority over normal cached view", async () => {
    const client = new QueryClient();
    const strictKey = ["fixture", "stale-strict"] as const;
    const cached = [{ fixture: "previous-strict-response" }];
    client.setQueryData(strictKey, cached);
    const queryFn = vi.fn().mockRejectedValue(precondition());
    const { observer } = observe(queryFn, productionOptions, client, strictKey);
    const before = observer.getCurrentResult();
    expect(before.isError).toBe(false);
    expect(safeAllowed(before)).toBe(false);
    await microtasks();
    const after = observer.getCurrentResult();
    // TanStack retains cached data on refetch error; the existing page gate
    // must win rather than pretending those cached values were revalidated.
    expect(after).toMatchObject({ status: "error", isRefetchError: true, data: cached });
    expect(safeAllowed(after)).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(RETRY_GATE_MS * 10);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("production query options are local: exact historical filter input and only retry; no additional query settings", () => {
    expect(strictQuery.arguments).toHaveLength(2);
    expect(evaluate(strictQuery.arguments[0], {})).toEqual({ arquivo: "todos" });
    expect(Object.keys(productionOptions)).toEqual(["retry"]);
    expect(typeof productionOptions.retry).toBe("function");
  });
});
