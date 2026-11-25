import {defineConfig} from 'vitest/config';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
export default defineConfig({root,resolve:{alias:{'@':path.join(root,'client/src'),'@shared':path.join(root,'shared')}},cacheDir:path.resolve(root,'../evidence/vite46'),test:{environment:'node',include:['tests/calendario46/*.test.ts','tests/release-restantes/unit/44-service.test.ts','tests/release-restantes/unit/44-journal.test.ts','tests/release-restantes/unit/44-envelope.test.ts','tests/release-restantes/unit/44-surface.test.ts','server/calendario.operational.finance.test.ts'],fileParallelism:false,maxWorkers:1,minWorkers:1,cache:false}});
