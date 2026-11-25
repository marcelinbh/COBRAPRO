import { defineConfig } from 'vitest/config';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
export default defineConfig({
  root,
  cacheDir: path.resolve(import.meta.dirname, 'artifacts/vite-cache-private'),
  resolve: { alias: { '@': path.join(root, 'client/src'), '@shared': path.join(root, 'shared'), '@assets': path.join(root, 'attached_assets') } },
  test: { environment: 'node', cache: false, include: [
    'server/routers/despesas49.test.ts', 'client/src/lib/despesas49Journal.test.ts',
    'client/src/components/edicaoDespesa49.ui.test.ts',
    'server/contasPagarStatus.test.ts', 'server/contasPagarSchemaFallback.test.ts',
    'server/routers/contasPagar.b1b2.offline.test.ts',
    'tests/release-restantes/unit/38c-cancelamento.test.ts',
  ] },
});
