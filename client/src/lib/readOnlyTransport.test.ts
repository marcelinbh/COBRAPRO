import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTRPCUntypedClient, httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import superjson from "superjson";
import { z } from "zod";
import { shouldIsolateReadOnlyQuery } from "./readOnlyTransport";

const allowed = ["auth.me", "contratos.listComParcelas", "contratos.listLeituraSegura", "contratos.obterDetalhes"];
const source = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const marker = "const trpcClient = trpc.createClient(";
const configuration = source.slice(source.indexOf(marker) + marker.length, source.indexOf("\n// Remove splash"))
  .trim().replace(/\);$/, "");
const nativeFetch = globalThis.fetch.bind(globalThis);

async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Local fixture deadline")), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

describe("read-only tRPC transport isolation", () => {
  it.each(allowed)("isolates only query %s, never mutation or subscription", path => {
    expect(shouldIsolateReadOnlyQuery({ type: "query", path })).toBe(true);
    expect(shouldIsolateReadOnlyQuery({ type: "mutation", path })).toBe(false);
    expect(shouldIsolateReadOnlyQuery({ type: "subscription", path })).toBe(false);
  });

  it("keeps all nonallowlisted paths and near matches on the original transport", () => {
    for (const path of ["auth.logout", "auth.me.extra", "x.auth.me", "caixa.contas", "cobradores.list", "contratos.list", "contratos.obterDetalhesExtra", "reparcelamento47.confirmar"])
      expect(shouldIsolateReadOnlyQuery({ type: "query", path })).toBe(false);
    expect(source).toContain("const queryClient = new QueryClient();");
  });

  it("delivers authenticated 412, safe list and cancelled detail while unrelated batch is pending; writers stay batched", async () => {
    let release!: () => void;
    let slowStarted!: () => void;
    const slow = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { slowStarted = resolve; });
    const requests: { method: string | undefined; path: string; batch: string | null }[] = [];
    const t = initTRPC.context<{ owner: number | null }>().create({ transformer: superjson });
    const own = t.procedure.use(({ ctx, next }) => {
      if (ctx.owner === null) throw new TRPCError({ code: "UNAUTHORIZED" });
      return next({ ctx: { owner: ctx.owner } });
    });
    const router = t.router({
      auth: t.router({ me: own.input(z.void()).query(({ ctx }) => ({ id: ctx.owner })) }),
      contratos: t.router({
        listComParcelas: own.input(z.void()).query(() => { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Synthetic invalid link" }); }),
        listLeituraSegura: own.input(z.void()).query(({ ctx }) => ({ userId: ctx.owner, items: [{ id: 103, kind: "validated" }, { id: 102, kind: "unavailable" }], at: new Date("2025-01-01Z"), exact: 1234567890123456789n })),
        obterDetalhes: own.input(z.object({ id: z.number() }).strict()).query(({ input }) => input.id === 103 ? { id: 103, status: "cancelado" } : null),
      }),
      caixa: t.router({ contas: own.input(z.void()).query(async () => { slowStarted(); await slow; return ["synthetic"]; }) }),
      cobradores: t.router({ list: own.input(z.void()).query(() => ["synthetic-other"]) }),
      fixture: t.router({
        echo: own.input(z.object({ at: z.date(), exact: z.bigint() })).mutation(({ input }) => input),
        note: own.input(z.string()).mutation(({ input }) => input),
      }),
    });
    const server = createHTTPServer({ router, basePath: "/api/trpc/", createContext({ req }) {
      const url = new URL(req.url!, "http://127.0.0.1");
      requests.push({ method: req.method, path: url.pathname.slice("/api/trpc/".length), batch: url.searchParams.get("batch") });
      return { owner: req.headers.cookie === "fixtureOwner=17" ? 17 : null };
    } });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Local fixture missing port");
    const url = `http://127.0.0.1:${address.port}/api/trpc`;
    const fetcher: typeof fetch = (input, init) => {
      expect(new URL(String(input)).origin).toBe(new URL(url).origin);
      expect(init?.credentials).toBe("include");
      const headers = new Headers(init?.headers);
      headers.set("cookie", "fixtureOwner=17");
      return nativeFetch(input, { ...init, headers, signal: AbortSignal.timeout(5000) });
    };
    function client(useOriginalBatch: boolean) {
      const config = new Function("httpBatchLink", "httpLink", "splitLink", "superjson", "shouldIsolateReadOnlyQuery", "globalThis", `return (${configuration});`)(
        (options: any) => httpBatchLink({ ...options, url }),
        (options: any) => httpLink({ ...options, url }),
        useOriginalBatch ? (options: any) => options.false : splitLink,
        superjson, shouldIsolateReadOnlyQuery, { fetch: fetcher },
      );
      return createTRPCUntypedClient<typeof router>(config);
    }
    try {
      const original = client(true);
      let blockedSettled = false;
      const blocked = original.query("contratos.obterDetalhes", { id: 103 }).then(value => { blockedSettled = true; return value; });
      const blockedOther = original.query("caixa.contas");
      await bounded(started);
      const isolated = client(false);
      const auth = await bounded(isolated.query("auth.me"));
      expect(auth).toEqual({ id: 17 });
      let strictError: unknown;
      try { await bounded(isolated.query("contratos.listComParcelas")); } catch (error) { strictError = error; }
      expect(strictError).toBeInstanceOf(TRPCClientError);
      expect((strictError as TRPCClientError<any>).data?.code).toBe("PRECONDITION_FAILED");
      expect((strictError as TRPCClientError<any>).data?.httpStatus).toBe(412);
      const safe = await bounded(isolated.query("contratos.listLeituraSegura"));
      expect(safe.userId).toBe(17);
      expect(safe.items).toHaveLength(2);
      expect(safe.at).toBeInstanceOf(Date);
      expect(safe.exact).toBe(1234567890123456789n);
      expect(await bounded(isolated.query("contratos.obterDetalhes", { id: 103 }))).toEqual({ id: 103, status: "cancelado" });
      expect(await bounded(isolated.query("contratos.obterDetalhes", { id: 201 }))).toBeNull();
      await expect(bounded(isolated.query("contratos.listLeituraSegura", { userId: 28 }))).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
      expect(blockedSettled).toBe(false);
      for (const path of allowed) expect(requests.some(request => request.path === path && request.batch === null && request.method === "GET")).toBe(true);
      const value = { at: new Date("2025-04-04Z"), exact: 9876543210987654321n };
      const [echo, note] = await bounded(Promise.all([isolated.mutation("fixture.echo", value), isolated.mutation("fixture.note", "synthetic")]));
      expect(echo).toEqual(value); expect(note).toBe("synthetic");
      expect(requests.some(request => request.path === "fixture.echo,fixture.note" && request.method === "POST" && request.batch === "1")).toBe(true);
      const nonallowed = isolated.query("cobradores.list");
      expect(await bounded(nonallowed)).toEqual(["synthetic-other"]);
      expect(requests.some(request => request.path === "cobradores.list" && request.batch === "1")).toBe(true);
      release();
      expect(await bounded(blocked)).toEqual({ id: 103, status: "cancelado" });
      await bounded(blockedOther);
    } finally {
      release();
      await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    }
  }, 15000);
});
