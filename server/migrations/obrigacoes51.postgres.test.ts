import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, realpathSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { relative, isAbsolute, join, sep } from 'node:path';
const repo = fileURLToPath(new URL('../../', import.meta.url));
it('PG17 LOCAL obrigações51: composição inteira31SQL, NOSUPERUSER NOBYPASSRLS, sem TCP e cleanup provado', () => {
  expect(process.env.NODE_ENV).toBe('test');
  const temp = realpathSync(tmpdir()), rel = relative(realpathSync(repo), temp);
  if (!(rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel))) throw new Error('TMPDIR dentro do repo proibido');
  const wrapperLogs = mkdtempSync(join(temp, 'cobrapro51-wrapper-'));
  console.log('WRAPPER_LOGS51 ' + wrapperLogs);
  const env: NodeJS.ProcessEnv = {
    PATH: '/usr/bin:/bin', HOME: wrapperLogs, TMPDIR: temp, LANG: 'C.UTF-8',
    NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null', R2_LOCAL_PG51: '1',
  };
  if (process.env.PG17_BIN) env.PG17_BIN = process.env.PG17_BIN;
  let output: string;
  try {
    output = execFileSync(process.execPath, ['tests/composition-obrigacoes/pg51.mjs'], {
      cwd: repo, env, encoding: 'utf8', timeout: 900000, maxBuffer: 16 * 1024 * 1024,
    });
    writeFileSync(join(wrapperLogs, 'stdout.log'), output);
  } catch (e: unknown) {
    const err = e as { stdout?: string | Buffer; stderr?: string | Buffer };
    writeFileSync(join(wrapperLogs, 'failure.log'), String(err.stdout ?? '') + '\n' + String(err.stderr ?? '') + '\n' + String(e));
    throw e;
  }
  const match = /^RESULT51 (.+)$/m.exec(output);
  if (!match) throw new Error('ResultadoSQL51 ausente; nunca fabricar GREEN');
  const report = JSON.parse(readFileSync(match[1], 'utf8'));
  expect(report.status).toBe('GREEN');
  expect(report.results).toHaveLength(31);
  expect(report.errors).toEqual([]);
  expect(report.ddlSha256).toBe('4df5a5b8fe7b3f0ed88be71e9376779e79a3c24f5a043fc64f7813dda6c18365');
  expect(report.role).toMatchObject({ current_user: 'postgres', session_user: 'postgres', rolsuper: false, rolbypassrls: false, listen: '' });
  expect(report.role.version).toMatch(/^17\./);
  expect(report.cleanup).toMatchObject({ stopped: true, status: 3, pidAbsent: true, privateSocket: true, socketMode: 0o700, rootRemoved: true });
  expect(existsSync(report.root)).toBe(false);
  const rootRel = relative(realpathSync(repo), report.root);
  expect(rootRel === '..' || rootRel.startsWith('..' + sep) || isAbsolute(rootRel)).toBe(true);
  expect(output).toContain('GREEN51 executable SQL scenarios; TS is tested separately by Vitest');
  expect(output).not.toContain('# tests 14');
  console.log('PG_RESULT51 ' + match[1]);
}, 960000);
