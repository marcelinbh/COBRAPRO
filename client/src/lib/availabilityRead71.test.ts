import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTRPCUntypedClient, httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import superjson from "superjson";
import { z } from "zod";
import { shouldIsolateReadOnlyQuery } from "./readOnlyTransport";
import { availabilityRead71Paths as paths, createAvailabilityRead71Fetch } from "./availabilityRead71";

const base = "http://127.0.0.1:7777";
const url = (path: string) => `${base}/api/trpc/${path}`;
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
async function flush() { for (let i=0;i<12;i++) await Promise.resolve(); }
function fixture() {
  const calls: { input: RequestInfo | URL; init?: RequestInit; work: ReturnType<typeof deferred<Response>> }[] = [];
  const native: typeof fetch = (input, init) => { const work = deferred<Response>(); calls.push({ input, init, work }); return work.promise; };
  return { calls, fetch: createAvailabilityRead71Fetch(native, base) };
}
const pass = () => new Response("synthetic", { status:200 });
async function releaseAll(f: ReturnType<typeof fixture>) { for (let i=0;i<20;i++) { f.calls.forEach(c=>c.work.resolve(pass())); await flush(); } }
const oldPaths = ["auth.me", "contratos.listComParcelas", "contratos.listLeituraSegura", "contratos.obterDetalhes"];

it.each([...oldPaths, ...paths])("isolates exact query %s, not writers or subscriptions", path => {
  expect(shouldIsolateReadOnlyQuery({ type:"query", path })).toBe(true);
  expect(shouldIsolateReadOnlyQuery({ type:"mutation", path })).toBe(false);
  expect(shouldIsolateReadOnlyQuery({ type:"subscription", path })).toBe(false);
});

it("four different reads share one FIFO with independent original Responses and no retry", async () => {
  const f=fixture();const promises=paths.map(p=>f.fetch(url(p)));await flush();
  expect(f.calls).toHaveLength(1);
  for(let i=0;i<4;i++) { expect(String(f.calls[i].input)).toBe(url(paths[i])); const r=pass();f.calls[i].work.resolve(r);expect(await promises[i]).toBe(r);await flush();expect(f.calls).toHaveLength(Math.min(4,i+2)); }
  expect(f.calls).toHaveLength(4);
});

it.each(oldPaths)("bypasses blocked availability FIFO for %s", async path => {
  const f=fixture();const first=f.fetch(url(paths[0]));await flush();const direct=f.fetch(url(path));expect(f.calls).toHaveLength(2);f.calls[1].work.resolve(pass());await direct;expect(f.calls[0].init?.credentials).toBe("include");f.calls[0].work.resolve(pass());await first;
});

it.each([
  ["/api/trpc/despesas69.capacidades.extra", "GET"], ["/api/trpc/x.despesas69.capacidades","GET"],
  ["/api/trpc/despesas69.capacidades?batch=1","GET"], ["/api/trpc/despesas69.capacidades?batch=0","GET"],
  ["/api/trpc/despesas49.capacidades,despesas69.capacidades","GET"], ["/api/trpc/despesas68.series","GET"],
  ["/api/trpc/despesas69.editar","POST"], ["/api/trpc/despesas69.capacidades","POST"],
  ["/api/trpc/despesas69.capacidades","HEAD"], ["/api/trpc/despesas69.capacidades","PUT"],
  ["https://other.invalid/api/trpc/despesas69.capacidades","GET"], ["http://%","GET"],
])("keeps nonselected request %s %s outside FIFO", async (input,method) => {
  const f=fixture();const head=f.fetch(url(paths[0]));await flush();const other=f.fetch(input,{method});expect(f.calls).toHaveLength(2);expect(f.calls[1].input).toBe(input);f.calls[1].work.resolve(pass());await other;f.calls[0].work.resolve(pass());await head;
});

it.each(["string", "URL", "Request"])("classifies %s GET with cursor without altering input semantics", async kind => {
  const f=fixture();const head=f.fetch(url(paths[0]));await flush();const address=url(paths[3])+"?input=%7B%22cursor%22%3A1%7D";
  const input=kind==="Request"?new Request(address,{headers:{"x-fixture":"own"}}):kind==="URL"?new URL(address):address;
  const next=f.fetch(input);await flush();expect(f.calls).toHaveLength(1);f.calls[0].work.resolve(pass());await head;await flush();expect(f.calls).toHaveLength(2);expect(input instanceof Request?f.calls[1].input===input:String(f.calls[1].input)===address).toBe(true);
  if(input instanceof Request) expect(input.headers.get("x-fixture")).toBe("own");f.calls[1].work.resolve(pass());await next;
});

it("snapshots URL and init headers; credentials include; preserves other init fields", async () => {
  const f=fixture();const head=f.fetch(url(paths[0]));await flush();const input=new URL(url(paths[1]));const headers=new Headers({"x-fixture":"before"});const init:RequestInit={headers,cache:"no-store",redirect:"error",mode:"cors",credentials:"omit",integrity:"",method:"get"};
  const next=f.fetch(input,init);input.pathname="/different";headers.set("x-fixture","after");init.method="POST";f.calls[0].work.resolve(pass());await head;await flush();const c=f.calls[1];expect(String(c.input)).toBe(url(paths[1]));expect(new Headers(c.init?.headers).get("x-fixture")).toBe("before");expect(c.init).toMatchObject({cache:"no-store",redirect:"error",mode:"cors",credentials:"include",integrity:"",method:"get"});c.work.resolve(pass());await next;
});

it("inherits Request POST method and never consumes its body while classifying", async () => {
  const f=fixture();const head=f.fetch(url(paths[0]));await flush();const request=new Request(url(paths[1]),{method:"POST",body:"synthetic",headers:{"x-r":"own"}});const p=f.fetch(request);expect(f.calls).toHaveLength(2);expect(request.bodyUsed).toBe(false);expect(f.calls[1].input).toBe(request);expect(f.calls[1].init?.headers).toBeUndefined();f.calls[1].work.resolve(pass());await p;f.calls[0].work.resolve(pass());await head;
});

it("explicit init GET wins over Request POST, without changing the original Request", async () => {
  const f=fixture();const head=f.fetch(url(paths[0]));await flush();const request=new Request(url(paths[1]),{method:"POST"});const p=f.fetch(request,{method:"GET"});await flush();expect(f.calls).toHaveLength(1);expect(request.method).toBe("POST");f.calls[0].work.resolve(pass());await head;await flush();expect(f.calls[1].init?.method).toBe("GET");f.calls[1].work.resolve(pass());await p;
});

it("already-aborted read rejects with original reason and zero native sends", async () => {
  const f=fixture();const c=new AbortController();const reason=new Error("synthetic abort");c.abort(reason);await expect(f.fetch(url(paths[0]),{signal:c.signal})).rejects.toBe(reason);expect(f.calls).toHaveLength(0);
});

it("queued abort rejects promptly, never sends later, survivors keep FIFO and listeners clean up", async () => {
  const f=fixture();const a=f.fetch(url(paths[0]));await flush();const c=new AbortController();const reason=new Error("old owner unmounted");const rejected=f.fetch(url(paths[1]),{signal:c.signal}).catch(e=>e);const b=f.fetch(url(paths[2]));c.abort(reason);expect(await rejected).toBe(reason);expect(f.calls).toHaveLength(1);f.calls[0].work.resolve(pass());await a;await flush();expect(f.calls).toHaveLength(2);expect(f.calls[1].input).toBe(url(paths[2]));f.calls[1].work.resolve(pass());await b;await flush();expect(f.calls).toHaveLength(2);
});

it("inflight abort does not release the slot until native fetch settles", async () => {
  const f=fixture();const c=new AbortController();const a=f.fetch(url(paths[0]),{signal:c.signal}).catch(e=>e);await flush();const b=f.fetch(url(paths[1]));c.abort();await flush();expect(f.calls).toHaveLength(1);expect(f.calls[0].init?.signal).toBe(c.signal);const error=new Error("native abort");f.calls[0].work.reject(error);expect(await a).toBe(error);await flush();expect(f.calls).toHaveLength(2);f.calls[1].work.resolve(pass());await b;
});

it.each(["inherit", "undefined", "override", "null"])("respects effective Request signal: %s", async kind => {
  const f=fixture();const a=f.fetch(url(paths[0]));await flush();const inherited=new AbortController(),override=new AbortController();const request=new Request(url(paths[1]),{signal:inherited.signal});
  const init=kind==="inherit"?undefined:kind==="undefined"?{signal:undefined}:kind==="override"?{signal:override.signal}:{signal:null};
  const result=f.fetch(request,init).then(()=>"sent",()=>"aborted");inherited.abort();await flush();if(kind==="inherit"||kind==="undefined") expect(await result).toBe("aborted");else {expect(f.calls).toHaveLength(1);f.calls[0].work.resolve(pass());await a;await flush();expect(f.calls).toHaveLength(2);expect(f.calls[1].init?.signal).toBe(kind==="null"?null:override.signal);f.calls[1].work.resolve(pass());expect(await result).toBe("sent");}f.calls[0].work.resolve(pass());await a;
});

it.each([401,412,500])("preserves Response%s without body read, replacement or retry", async status => {
  const f=fixture();const a=f.fetch(url(paths[0]));const b=f.fetch(url(paths[1]));await flush();const response=new Response("not json",{status});f.calls[0].work.resolve(response);expect(await a).toBe(response);expect(response.bodyUsed).toBe(false);await flush();expect(f.calls).toHaveLength(2);await expect(response.json()).rejects.toBeInstanceOf(SyntaxError);f.calls[1].work.resolve(pass());await b;expect(f.calls).toHaveLength(2);
});

it.each(["throw", "reject"])("releases FIFO on native %s preserving the exact error", async mode => {
  const error=new Error("native original");let n=0;const native:typeof fetch=()=>{n++;if(n===1){if(mode==="throw")throw error;return Promise.reject(error);}return Promise.resolve(pass());};const fetch=createAvailabilityRead71Fetch(native,base);const a=fetch(url(paths[0])).catch(e=>e),b=fetch(url(paths[1]));expect(await a).toBe(error);expect((await b).status).toBe(200);expect(n).toBe(2);
});

it("independent factories are not claimed to be a global lock", async () => {const a=fixture(),b=fixture();const pa=a.fetch(url(paths[0])),pb=b.fetch(url(paths[1]));await flush();expect(a.calls).toHaveLength(1);expect(b.calls).toHaveLength(1);await releaseAll(a);await releaseAll(b);await Promise.all([pa,pb]);});

it("three query lifecycle options propagate unmount abort; components otherwise remain generation guarded", () => {
  for(const file of ["CancelamentoPendente", "EdicaoDespesa49", "EdicaoDespesa69"]) {
    const s=readFileSync(new URL(`../components/${file}.tsx`,import.meta.url),"utf8");const line=s.split("\n").find(x=>x.startsWith("  const options = useMemo("))!;
    expect(line).toContain("trpc: { abortOnUnmount: true }");expect(line).toContain("gcTime: 0");expect(line).toContain("retry: false");expect(line).toContain("queryKeyHashFn");expect(s).toContain("session.closed = true");
  }
});

it("actual TanStack observer removal aborts queued A before B dispatch without sharing A result", async () => {
  const f=fixture();const head=f.fetch(url(paths[0]));await flush();const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  const observer=new QueryObserver(client,{queryKey:["synthetic-owner-A-generation-1"],queryFn:({signal})=>f.fetch(url(paths[1]),{signal})});const unsubscribe=observer.subscribe(()=>{});await flush();expect(f.calls).toHaveLength(1);unsubscribe();await flush();const b=f.fetch(url(paths[2]));f.calls[0].work.resolve(pass());await head;await flush();expect(f.calls).toHaveLength(2);expect(f.calls[1].input).toBe(url(paths[2]));f.calls[1].work.resolve(pass());await b;expect(client.getQueryData(["synthetic-owner-A-generation-1"])).toBeUndefined();client.clear();
});

it("real tRPC HTTP serialization keeps auth/contracts independent and writer POST batching unchanged", async () => {
  const native=globalThis.fetch.bind(globalThis);const started=deferred<void>(),release=deferred<void>();const seen:{method?:string;path:string;batch:string|null}[]=[];let active=0,max=0;const order:string[]=[];
  const t=initTRPC.context<{owner:number}>().create({transformer:superjson});const own=t.procedure.use(({ctx,next})=>next({ctx}));
  const heavy=(name:string)=>async()=>{active++;max=Math.max(max,active);order.push(name);if(name===paths[0]){started.resolve();await release.promise;}active--;if(name===paths[1])throw new TRPCError({code:"PRECONDITION_FAILED",message:"synthetic verifier failure"});return {name,at:new Date("2025-01-01Z"),exact:1234567890123456789n};};
  const router=t.router({contasPagar:t.router({capacidadesCancelamentoPendente:own.query(heavy(paths[0]))}),despesas49:t.router({capacidades:own.query(heavy(paths[1]))}),despesas69:t.router({capacidades:own.query(heavy(paths[2]))}),despesasRecorrencia68:t.router({listar:own.input(z.object({after:z.string().nullable()}).strict()).query(heavy(paths[3]))}),auth:t.router({me:own.query(({ctx})=>ctx.owner)}),contratos:t.router({listLeituraSegura:own.query(()=>"synthetic own list")}),fixture:t.router({a:own.mutation(()=>"a"),b:own.mutation(()=>"b")})});
  const server=createHTTPServer({router,basePath:"/api/trpc/",createContext({req}){const u=new URL(req.url!,base);seen.push({method:req.method,path:u.pathname.slice(10),batch:u.searchParams.get("batch")});return {owner:17};}});await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw Error("fixture port missing");const endpoint=`http://127.0.0.1:${address.port}/api/trpc`;
  const source=readFileSync(new URL("../main.tsx",import.meta.url),"utf8");const marker="const trpcClient = trpc.createClient(";const config=source.slice(source.indexOf(marker)+marker.length,source.indexOf("\n// Remove splash")).trim().replace(/\);$/,"");const serial=createAvailabilityRead71Fetch(native,endpoint);
  const configuration=new Function("httpBatchLink","httpLink","splitLink","superjson","shouldIsolateReadOnlyQuery","availabilityFetch","globalThis",`return (${config});`)((o:any)=>httpBatchLink({...o,url:endpoint}),(o:any)=>httpLink({...o,url:endpoint}),splitLink,superjson,shouldIsolateReadOnlyQuery,serial,{fetch:native});const client=createTRPCUntypedClient(configuration);
  try {
    const reads=paths.map((p,i)=>client.query(p,i===3?{after:null}:undefined).then(v=>({ok:true,v}),e=>({ok:false,e})));await started.promise;expect(order).toEqual([paths[0]]);expect(await client.query("auth.me")).toBe(17);expect(await client.query("contratos.listLeituraSegura")).toBe("synthetic own list");expect(await Promise.all([client.mutation("fixture.a"),client.mutation("fixture.b")])).toEqual(["a","b"]);expect(order).toEqual([paths[0]]);release.resolve();const results=await Promise.all(reads);expect(order).toEqual([...paths]);expect(max).toBe(1);expect(results[1]).toMatchObject({ok:false,e:{data:{code:"PRECONDITION_FAILED"}}});expect(results[2]).toMatchObject({ok:true,v:{exact:1234567890123456789n}});expect((results[2] as any).v.at).toBeInstanceOf(Date);
    for(const p of paths)expect(seen.filter(x=>x.path===p&&x.method==="GET"&&x.batch===null)).toHaveLength(1);expect(seen.some(x=>x.path==="fixture.a,fixture.b"&&x.method==="POST"&&x.batch==="1")).toBe(true);
  } finally {release.resolve();await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();});}
},15000);
