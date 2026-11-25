import { mergeConfig, defineConfig } from 'vitest/config';
import base from './vitest.config';
export default mergeConfig(base, defineConfig({cacheDir:'../evidence/cache/vitest',test:{maxWorkers:1,minWorkers:1}}));
