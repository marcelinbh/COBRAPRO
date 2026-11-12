// Gerador determinístico local; não conecta a nenhum banco. Fontes 20/21/22/25 fixadas por SHA.
import { readFileSync, writeFileSync } from 'node:fs';
import { baselineFunctions, baselineManifest, renewalGuardInsertion, functionsFromSQL } from '../../server/migrations/0033.preflight.sources.mjs';
import { operationalHeader, installPrivileges, witnessBefore, witnessAfter, applicationWitness, postflightFunctions, stripCatalogLocks, assertApplicationLocks } from '../../server/migrations/0031_0033.operational.mjs';
const root = new URL('../../', import.meta.url);
const guard = baselineFunctions.find(f => f.proname === 'ciclo_guardar').body;
const extended = guard.replace('BEGIN\n', `BEGIN\n${renewalGuardInsertion}`);
let sql = readFileSync(new URL('template.sql', import.meta.url), 'utf8');
const receive = baselineFunctions.find(f => f.proname === 'rpc_receber_emprestimo_prospectivo').ddl;
const updatedReceive = receive.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION').replace("WHERE contrato_id=p_contrato_id AND status IS DISTINCT FROM 'paga'", "WHERE contrato_id=p_contrato_id AND status IS DISTINCT FROM 'paga' AND NOT public.renovacao_antecessor_transferido(p_user_id,p_contrato_id,id)");
const fixture = readFileSync(new URL('tests/postgres-loans/fixture.sql', root), 'utf8');
const models = ['contratos', 'parcelas', 'transacoes_caixa', 'contrato_historico'].map(t => {
  const start = fixture.indexOf(`CREATE TABLE public."${t}" (`);
  const end = fixture.indexOf('\n);', start) + 3;
  if (start < 0 || end < 3) throw new Error(`Modelo ausente: ${t}`);
  return fixture.slice(start, end).replace(`CREATE TABLE public."${t}"`, `CREATE TEMP TABLE renovacao_modelo_${t}`);
}).join('\n');
sql = sql.replace('@@BASELINE@@', () => JSON.stringify(baselineManifest)).replace('@@GUARD@@', () => extended).replace('@@RECEIVE@@', () => updatedReceive).replace('@@MODELS@@', () => models);
if (/@@\w+@@/.test(sql)) throw new Error('Placeholder não resolvido');
sql = stripCatalogLocks(sql).replace("SET LOCAL lock_timeout='10s';", "SET LOCAL lock_timeout='10s';\n" + operationalHeader);
sql = sql.replace('LOCK TABLE public.contratos,',installPrivileges+'\nLOCK TABLE public.contratos,');
sql = sql.replace('$preflight$;\n', '$preflight$;\n' + witnessBefore + '\n' + applicationWitness(true,31) + '\n');
const post = new Map(baselineFunctions.map(f=>[`${f.proname}(${f.types})`,f]));
for (const f of functionsFromSQL(sql)) post.set(`${f.proname}(${f.types})`,f);
sql = sql.replace('COMMIT;\n', () => postflightFunctions([...post.values()],31) + '\n' + applicationWitness(false,31) + '\n' + witnessAfter + '\nCOMMIT;\n');
assertApplicationLocks(sql);
const path = new URL('drizzle/0031_rpc_renovacao_juros_prospectiva.sql', root);
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== sql) throw new Error('0031 divergiu do gerador conhecido');
  console.log('0031 coincide com baseline 0025 + duas extensões conhecidas.');
} else {
  writeFileSync(path, sql);
  console.log('Migration 0031 gerada localmente sobre 0025; nenhum SQL executado.');
}
