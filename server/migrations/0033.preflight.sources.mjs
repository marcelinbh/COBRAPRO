// Somente fontes SQL locais conhecidas; nunca consulta catálogo/banco ou gera 0031.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { operationalHeader, installPrivileges, witnessBefore, witnessAfter, applicationWitness, postflightFunctions, stripCatalogLocks, assertApplicationLocks } from './0031_0033.operational.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
export const sources = [
  'drizzle/0020_rpc_despesas_prospectivas.sql',
  'drizzle/0021_rpc_emprestimos_prospectivos.sql',
  'drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql',
  'drizzle/0025_integrar_rpc_despesas_ciclo.sql',
  'drizzle/0031_rpc_renovacao_juros_prospectiva.sql',
];
export const sourceSQL = Object.fromEntries(sources.map(path => [path, readFileSync(resolve(root, path), 'utf8')]));
export const sourceHashes = Object.fromEntries(sources.map(path => [path, createHash('sha256').update(sourceSQL[path]).digest('hex')]));
const certifiedBaselineHashes = [
  'a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452',
  '08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82',
  'abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c',
  '63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199',
];
for (const [i, hash] of certifiedBaselineHashes.entries()) {
  if (sourceHashes[sources[i]] !== hash) throw new Error(`Baseline SQL certificado divergiu: ${sources[i]}`);
}
export const renewalGuardInsertion = ` IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;\n IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;\n IF public.renovacao_consumir_capacidade(TG_TABLE_NAME,TG_OP,oldj,newj) THEN\n   IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;\n END IF;\n`;
const normalizeType = s => s.trim().toLowerCase().replace(/\btimestamptz\b/g, 'timestamp with time zone');
export function functionsFromSQL(sql) {
  return [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)\s*\(([\s\S]*?)\)\s*RETURNS\s+(\w+)\s+([\s\S]*?)\bAS\s+(\$\w*\$)([\s\S]*?)\5\s*;/g)].map(m => {
    const [, proname, signature, result, options, , body] = m;
    const args = signature.trim() ? signature.split(',').map(s => {
      const a = s.trim().match(/^(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i);
      if (!a) throw new Error(`Argumento não suportado: ${s}`);
      return { name: a[1], type: normalizeType(a[2]), default: a[3] ?? null };
    }) : [];
    const lang = options.match(/LANGUAGE\s+(\w+)/i)?.[1].toLowerCase();
    if (!lang || !/SET search_path\s*=\s*pg_catalog,\s*pg_temp/i.test(options)) throw new Error(`Opções não reconhecidas: ${proname}`);
    const timezone = /SET timezone\s*=\s*'UTC'/i.test(options);
    const defaults = args.filter(a => a.default !== null).map(a => {
      if (!/^NULL$/i.test(a.default)) throw new Error(`Default não reconhecido: ${proname}`);
      return `NULL::${a.type}`;
    });
    return { proname, args: args.map(a => `${a.name} ${a.type}`).join(', '), types: args.map(a => a.type).join(', '),
      result: result.toLowerCase(), lang, prosecdef: /SECURITY DEFINER/i.test(options),
      provolatile: /\bIMMUTABLE\b/i.test(options) ? 'i' : /\bSTABLE\b/i.test(options) ? 's' : 'v',
      proparallel: 'u', proisstrict: false, proleakproof: false, prokind: 'f',
      pronargdefaults: defaults.length, defaults: defaults.length ? defaults.join(', ') : null,
      proconfig: ['search_path=pg_catalog, pg_temp', ...(timezone ? ['TimeZone=UTC'] : [])],
      body_hash: createHash('sha256').update(body).digest('hex'),
      // Testes podem reinstalar o DDL conhecido em fixtures; não corpo coletado do catálogo.
      ddl: m[0], body };
  });
}
const parsed = sources.map(path => functionsFromSQL(sourceSQL[path]));
const map = new Map();
for (const fn of parsed.slice(0, 4).flat()) map.set(`${fn.proname}(${fn.types})`, fn);
const clean = fn => Object.fromEntries(Object.entries(fn).filter(([k]) => !['ddl', 'body'].includes(k)));
const sort = list => list.sort((a, b) => `${a.proname}(${a.types})`.localeCompare(`${b.proname}(${b.types})`, 'en'));
export const baselineManifest = sort([...map.values()]).map(clean);
export const baselineFunctions = sort([...map.values()]);
export const renewalFunctions = parsed[4];
const renewalMap = new Map(map);
for (const fn of renewalFunctions) renewalMap.set(`${fn.proname}(${fn.types})`, fn);
export const manifest = { baseline: baselineFunctions.map(clean), renewal: sort([...renewalMap.values()]).map(clean) };
export const manifestBlock = '-- 0033 SOURCE MANIFEST BEGIN\n-- SHA-256 de prosrc (bytes AS delimitados), metadados das DDLs; não do catálogo sob teste.\n'
  + Object.entries(sourceHashes).map(([path, hash]) => `-- ${path}: ${hash}`).join('\n')
  + `\n expected := $known0033$${JSON.stringify(manifest)}$known0033$::jsonb;\n-- 0033 SOURCE MANIFEST END`;
export function assertKnownRenewal() {
  const guard25 = baselineFunctions.find(f => f.proname === 'ciclo_guardar');
  const guard31 = renewalFunctions.find(f => f.proname === 'ciclo_guardar');
  if (guard31?.body !== guard25.body.replace('BEGIN\n', `BEGIN\n${renewalGuardInsertion}`)) {
    throw new Error('0031 guard deve preservar 0025 byte-a-byte exceto capacidade de renovação exata');
  }
  const receive22 = baselineFunctions.find(f => f.proname === 'rpc_receber_emprestimo_prospectivo');
  const receive31 = renewalFunctions.find(f => f.proname === 'rpc_receber_emprestimo_prospectivo');
  const original = "WHERE contrato_id=p_contrato_id AND status IS DISTINCT FROM 'paga'";
  if (receive31?.body !== receive22.body.replace(original, original + ' AND NOT public.renovacao_antecessor_transferido(p_user_id,p_contrato_id,id)')) {
    throw new Error('0031 receive deve preservar 0022 salvo antecessor com prova completa');
  }
}
export function operational33(input) {
  let sql = input.replace(/-- 0033 OPERATIONAL POST BEGIN[\s\S]*?-- 0033 OPERATIONAL POST END\n/, '');
  sql = sql.replace(/-- Janela de manutenção: locks das tabelas drenam writers antes dos locks de catálogo\.\n-- SHARE ROW EXCLUSIVE dos catálogos bloqueia CREATE\/ALTER\/DROP\/GRANT concorrentes,\n-- inclusive overloads e homônimos ainda inexistentes; advisory sozinho não faria isso\.\n/, '-- Janela de manutenção: locks de aplicação drenam writers; DDL externa exige governança exclusiva.\n');
  sql = stripCatalogLocks(sql);
  if (!sql.includes(operationalHeader)) sql = sql.replace("SET LOCAL lock_timeout='10s';", "SET LOCAL lock_timeout='10s';\n" + operationalHeader);
  sql = sql.replace(/DO \$privileges3133\$[\s\S]*?END \$privileges3133\$;\n/, '');
  sql = sql.replace('LOCK TABLE public.users,',installPrivileges+'\nLOCK TABLE public.users,');
  sql = sql.replace(/\$preflight0033\$;\n[\s\S]*?CREATE TABLE public\.financial_intent_fences/, '$preflight0033$;\nCREATE TABLE public.financial_intent_fences');
  sql = sql.replace('$preflight0033$;\n', '$preflight0033$;\n' + witnessBefore + '\n' + applicationWitness(true,33) + '\n');
  const additions = functionsFromSQL(sql);
  const families = { rpc_criar_emprestimo:'emprestimo_criar',rpc_receber_emprestimo_prospectivo:'emprestimo_receber',rpc_criar_despesa_prospectiva:'despesa_criar',rpc_pagar_despesa_prospectiva:'despesa_pagar',rpc_estornar_despesa_prospectiva:'despesa_estornar' };
  const profiles = {};
  for (const [profile, original] of Object.entries({baseline:baselineFunctions,renewal:[...renewalMap.values()]})) {
    const out = new Map();
    for (const f of original) {
      if (families[f.proname]) {
        const name = 'financial_intent_original_' + f.proname;
        out.set(`${name}(${f.types})`, {...f,proname:name});
        const args = f.args.split(', ').map(a=>a.split(' ')[0]).join(',');
        const body = ` BEGIN PERFORM public.financial_intent_gate(p_user_id,p_chave_idempotencia,'${families[f.proname]}'); RETURN public.${name}(${args}); END `;
        out.set(`${f.proname}(${f.types})`, {...f,lang:'plpgsql',proconfig:['search_path=pg_catalog, pg_temp'],body_hash:createHash('sha256').update(body).digest('hex')});
      } else out.set(`${f.proname}(${f.types})`,f);
    }
    for (const f of additions) out.set(`${f.proname}(${f.types})`,f);
    profiles[profile] = [...out.values()];
  }
  sql = sql.replace('COMMIT;\n',()=>'-- 0033 OPERATIONAL POST BEGIN\n'+postflightFunctions(profiles,33)+'\n'+applicationWitness(false,33)+'\n'+witnessAfter+'\n-- 0033 OPERATIONAL POST END\nCOMMIT;\n');
  assertApplicationLocks(sql);
  return sql;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assertKnownRenewal();
  const path = resolve(root, 'drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql');
  const sql = readFileSync(path, 'utf8');
  const actual = sql.match(/-- 0033 SOURCE MANIFEST BEGIN[\s\S]*?-- 0033 SOURCE MANIFEST END/)?.[0];
  if (!actual) throw new Error('Bloco de manifest 0033 ausente');
  if (process.argv.includes('--write')) {
    writeFileSync(path, operational33(sql.replace(actual, () => manifestBlock)));
    console.log('Manifest 0033 atualizado exclusivamente de SQL local conhecido.');
  } else {
    if (actual !== manifestBlock) throw new Error('Manifest 0033 divergiu das fontes SQL; revisar fontes e regenerar explicitamente.');
    if (sql !== operational33(sql)) throw new Error('Controles operacionais 0033 divergiram');
    console.log('Manifest 0033 coincide com fontes SQL conhecidas.');
  }
}
