import { it, expect } from 'vitest';

it('PG17 hotfix36a: duas freshDB, old seal obrigatório, delta único, manutenção real e autovacuum ON', async () => {
  // Runner independente; não invoca suítes/builders antigos nem migration37.
  const { certify } = await import('../../tests/postgres-multa-metadata36a/runner.mjs');
  const result = await certify();
  expect(result.failures).toEqual([]);
  expect(result.sql36aSha256Current).toBe(result.sql36aSha256);
  expect(result.sql36Sha256).toBe('7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f');
  expect(result.databases).toHaveLength(2);
  expect(result.environment.autovacuum).toBe('on');
  for (const db of result.databases) {
    expect(db.oldAnalyze.originalReject.code).toBe('55000');
    expect(db.oldAnalyze.hotfixReject.code).toBe('55000');
    expect(db.installDelta.functionsChanged).toEqual(['multa36_metadata']);
    expect(db.installDelta.financialChangedRows).toBe(0);
    expect(db.installDelta.proofChangedRows).toBe(0);
    expect(db.negatives).toHaveLength(22);
    expect(db.maintenance).toHaveLength(2);
    expect(db.autovacuum.sealUnchanged).toBe(true);
    const before = db.autovacuum.before.find((s: { relname: string }) => s.relname === 'multa36_capacidades');
    const after = db.autovacuum.after.find((s: { relname: string }) => s.relname === 'multa36_capacidades');
    expect(after.last_autovacuum).toBeTruthy();
    expect(after.autovacuum_count).toBeGreaterThan(before.autovacuum_count);
  }
  expect(result.cleanup).toMatchObject({stopExit: 0, status: 3, pidAbsent: true, ownRootRemoved: true});
}, 360000);
