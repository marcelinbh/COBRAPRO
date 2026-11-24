import { it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { relative, isAbsolute } from 'node:path';
import { cheque40IntentSchema } from '../../shared/cheques40';
import { executarCheque40 } from '../services/cheques40Rpc';
const repo = fileURLToPath(new URL('../../', import.meta.url));
it('PG17 LOCAL Cheques40: 42 -> 41 -> 40, owner NOSUPERUSER BYPASSRLS, 25 cenários reais', async () => {
  const temp = realpathSync(tmpdir()), rel = relative(realpathSync(repo), temp);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('TMPDIR dentro do repo proibido');
  const artifacts = mkdtempSync(temp + '/cobrapro-cheques40-vitest-');
  console.log('ARTIFACTS ' + artifacts);
  const env: NodeJS.ProcessEnv = { PATH: '/usr/bin:/bin', HOME: artifacts, LANG: 'C.UTF-8', TMPDIR: temp };
  if (process.env.PG17_BIN) env.PG17_BIN = process.env.PG17_BIN;
  function run(script: string, args: string[], timeout: number) {
    try {
      const output = execFileSync(process.execPath, [script, ...args], { cwd: repo, env, encoding: 'utf8', timeout });
      writeFileSync(artifacts + '/' + script.split('/').pop() + '.log', output);
      return output;
    } catch (error: any) {
      writeFileSync(artifacts + '/failure.log', String(error.stdout ?? '') + '\n' + String(error.stderr ?? '') + '\n' + String(error));
      throw error;
    }
  }
  expect(run('tests/postgres-cheques40/build.mjs', ['--check', '--artifacts', artifacts], 30000)).toContain('BYTE-EXACT');
  const output = run('tests/postgres-cheques40/runner.mjs', ['--artifacts', artifacts], 300000);
  console.log(output);
  expect(output.match(/^PASS /gm)).toHaveLength(25);
  expect(output).toContain('ROLE before fixtures postgres NOSUPERUSER BYPASSRLS');
  expect(output).toContain('ROLE after all25 scenarios postgres NOSUPERUSER BYPASSRLS');
  expect(output).toContain('CLEANUP cluster removed');
  const report = JSON.parse(readFileSync(artifacts + '/evidence/postgres-result.json', 'utf8'));
  expect(report.results).toHaveLength(25);
  expect(report.status).toBe('PASS_PG17_STACK20_37_42_41_THEN40_NOSUPERUSER_BYPASSRLS');
  for (const role of [...report.roleEvidence, ...report.definerOwners]) expect(role).toMatchObject({ rolsuper: false, rolbypassrls: true });
  const envelope = JSON.parse(readFileSync(artifacts + '/evidence/real-rpc-envelope.json', 'utf8'));
  const rpc = vi.fn(async () => envelope.response);
  expect(await executarCheque40({ rpc }, 1, cheque40IntentSchema.parse(envelope.intent))).toEqual(envelope.response.data);
  expect(rpc).toHaveBeenCalledTimes(1);
}, 360000);
