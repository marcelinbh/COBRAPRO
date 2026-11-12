import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const outdir = path.join(root, "tests/postgres-whatsapp-safe/.build");
await mkdir(outdir, { recursive: true });
for (const [name, source] of Object.entries({
  worker: "server/services/notificacoesAutomaticas.ts",
  provider: "server/services/evolutionClient.ts",
  webhook: "server/webhookRoutes.ts",
  helper: "server/services/notificacoes.operational.safe.ts",
  router: "server/routers/notificacoes.ts",
})) {
  await build({
    entryPoints: [path.join(root, source)],
    outfile: path.join(outdir, name + ".mjs"),
    platform: "node",
    format: "esm",
    bundle: true,
    packages: "external",
    plugins: [
      {
        name: "database-only-test-double",
        setup(b) {
          b.onResolve({ filter: /(^|\/)db$/ }, args => ({
            path: "safe-db",
            namespace: "whatsapp-test",
          }));
          b.onLoad({ filter: /.*/, namespace: "whatsapp-test" }, () => ({
            contents:
              "export async function getSupabaseClientAsync(){ return globalThis.__whatsappSafeDb; }",
            loader: "js",
          }));
        },
      },
    ],
  });
}
console.log(
  "Módulos reais empacotados; acesso db substituído exclusivamente pelo adapter PostgreSQL privado."
);
