import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

it('PG17 LOCAL Assinaturas42: recebimento atômico, recovery, concorrência e coexistência financeira', () => {
  execFileSync('node', ['tests/postgres-assinaturas42/build.mjs', '--check'], {
    cwd: process.cwd(), stdio: 'pipe', timeout: 30_000,
  });
  const output = execFileSync('node', ['tests/postgres-assinaturas42/runner.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 300_000,
  });
  expect(output).toContain('GREEN pagamento+vigência/status+caixa atômicos');
  expect(output).toContain('mesma intenção concorrente');
  expect(output).toContain('nenhuma capacidade residual no commit');
}, 360_000);
