import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
it('PG17 LOCAL Telefone41: stack42, atomicidade, quitação, cancelamento, recovery e fence', () => {
  execFileSync('node', ['tests/postgres-telefone41/build.mjs', '--check'], { cwd: process.cwd(), stdio: 'pipe', timeout: 30000 });
  const output = execFileSync('node', ['tests/postgres-telefone41/runner.mjs'], { cwd: process.cwd(), encoding: 'utf8', timeout: 300000 });
  console.log(output);
  expect(output).toContain('PASS instalação/runtime postgres NOSUPERUSER BYPASSRLS');
  expect(output.match(/^PASS /gm)).toHaveLength(29);
  expect(output).toContain('PASS última parcela quita a venda');
  expect(output).toContain('PASS fence persistido');
  expect(output).toContain('PASS zero capacidades residuais');
}, 360000);
