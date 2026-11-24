import {readFileSync,writeFileSync} from 'node:fs';
const out='tests/postgres-multa-metadata36a';
export function report36a(result){
 const r=result??JSON.parse(readFileSync(`${out}/results36a.json`,'utf8'));
 const counts=['users','clientes','contas_caixa','contratos','parcelas','transacoes_caixa','contrato_historico','multimodal_operacoes','multimodal_pernas','multa36_operacoes','multa36_origens','multa36_estados','multa36_encargos','multa36_pernas','multa36_renovacoes','multa36_capacidades','multa36_coexistencia','multa36_fences'];
 const md=`# Hotfix36a — certificação preventiva PG17

**${r.failures.length?'NO-GO':'PASS local36a; não é GO produtivo nem certificação37'}.** SHA36a testado e final: \`${r.sql36aSha256}\` / \`${r.sql36aSha256Current}\`. SHA36 frozen: \`${r.sql36Sha256}\`.

## Execução e isolamento

\`cd /home/ubuntu/cobrapro && node tests/postgres-multa-metadata36a/build.mjs --check\`

\`cd /home/ubuntu/cobrapro && node tests/postgres-multa-metadata36a/runner.mjs\`

\`cd /home/ubuntu/cobrapro && pnpm exec vitest run server/migrations/multaMetadata36a.postgres.test.ts\`

Duas freshDB preventivas e duas bases adicionais negativas de ANALYZE original. Somente fixtures sintéticas e migrations20/21/22/25/31/33/34/35/36 frozen; nenhum builder antigo, runtime37, produção, Git, rede, browser, mensagem ou corrupção privilegiada. Hashes frozen e comandos exatos initdb/pg_ctl constam em results36a.json.

PG17 local: \`${JSON.stringify(r.environment)}\`. Socket0700, listen_addresses vazio, autovacuum ON sempre/naptime1s. Thresholds padrão50/0.2/50 durante instalação original/preventiva. Após36a, ALTER SYSTEM do cluster próprio define vacuum threshold1/scale_factor0 e analyze threshold1000000 para observar autovacuum sem ALTER reloptions; reloptions NULL preservadas. Antes de montar a segunda freshDB, configuração global volta aos defaults. ANALYZE e VACUUM(FREEZE,ANALYZE) todas10 tables36 são reais e fora de transação. Nenhum selo foi atualizado fora da migration36a.

## Resultado agregado

${r.passed} checks registrados, ${r.failures.length} falhas. Em cada freshDB: 11 negativos preflight, 1 reapply55000 e 10 negativos runtime55000; total44 negativos além de4 recusas original/hotfix nas duas bases negativas. Controle original34/35/36 positivo logo após instalação36 e imediatamente antes36a.

Delta36a: uma função antiga alterada (apenas prosrc de multa36_metadata), 97 funções públicas intocadas, uma assinatura na linha manifesto36 id1 alterada. Todas as demais linhas de todas as tabelas públicas permanecem idênticas na instalação. Zero linhas money/proof alteradas pela instalação, manutenção e recusas; ACL/owner/RLS/rowtypes/colunas/constraints/triggers/policies/sequences intactos. O corpo metadata recebe exclusivamente a subtração dos seis campos pg_class relpages/reltuples/relallvisible/relallfrozen/relfrozenxid/relminmxid. Verificadores34/35/36 passam depois de ANALYZE, VACUUM/FREEZE e autovacuum sem reseal.

${r.databases.map(d=>`## fresh${d.fresh}

Checks: ${d.checks.length}; negativos: ${d.negatives.length}; manutenção: ${d.maintenance.length}×10 comandos. ${d.historicalRows?`${d.historicalRows.rows} linhas históricas em ${d.historicalRows.tables.length} tabelas comparadas por ID, zero alteradas.`:''}

Baseline preventiva não vazia: ${JSON.stringify(d.preHotfixLegitimate)}. Um criar35/apply36/receive36 parcial legítimo antes36a, ainda nos thresholds padrão, com verifier original válido. ${d.historicalProofRows?`${d.historicalProofRows.rows} provas anteriores em ${d.historicalProofRows.tables.length} tabelas permaneceram exatamente intactas até fim.`:''} Operações para observar autovacuum abaixo são adicionais a essa baseline.

Original ANALYZE em base dedicada ${d.oldAnalyze?.database}: \`${JSON.stringify(d.oldAnalyze)}\`. A mudança reltuples -1→0 não foi revertida por rollback; por isso a base negativa jamais recebe36a e não contamina o teste preventivo.

Autovacuum REAL: antes \`${JSON.stringify(d.autovacuum?.before)}\`; depois \`${JSON.stringify(d.autovacuum?.after)}\`. Timestamp last_autovacuum não nulo e contador de capacidades36 aumenta. Não basta espera presumida.

Operações legítimas service_role: 8criar35, 8apply36, 4receive36parcial, 4renew36, 8receive36integral; 8 contratos quitados. Alocação total \`${JSON.stringify(d.autovacuum?.allocation)}\` (16pernas, principal800.00, juros120.00, multa60.00, mora0.32). São efeitos financeiros legítimos, não delta da manutenção; snapshot após operações e durante espera autovacuum idêntico. Capacidades/coexistência/fences resíduos zero.

| Tabela | Linhas finais | SHA256 snapshot |
|---|---:|---|
${counts.map(n=>`| ${n} | ${d.finalSnapshot?.[n]?.count??'não obtido'} | \`${d.finalSnapshot?.[n]?.sha256??''}\` |`).join('\n')}

Diferenças pg_class por manutenção, com valores antes/depois, estão em results36a.json/maintenance e autovacuum.diffs; são exclusivamente campos voláteis autorizados.
`).join('\n')}
## Matriz

${r.results.filter(x=>/^(PASS|FAIL)/.test(x)).map(x=>'- '+x).join('\n')}

## Falhas e limites

${r.failures.length?r.failures.map(x=>`- fresh${x.fresh??''} ${x.id}: ${x.code??''} ${x.message}`).join('\n'):'Nenhuma falha final.'}

A primeira tentativa foi inválida por contaminação ANALYZE original/rollback na própria base preventiva. Seus logs são attempt1-*; não contam como negativos certificados nem falha SQL36a. Primeira falha de ambiente foi caminho do Node, corrigida apenas no runner novo.

Não extrapolar cobertura runtime: índices/CHECK/FK físicos de bases antigas são verificados pelo preflight36a, enquanto runtime cobre metadata36 e verificadores34/35. O negativo runtime índice privado remove PK/constraint+index; não prova cobertura geral de pg_index. N_dead_tup estimado pode permanecer >0 por novas operações posteriores ao último autovacuum; last_autovacuum e contador provam worker real, não necessariamente esvaziamento físico completo. Estatísticas e UUID/timestamps sintéticos podem variar entre execuções.

## Limpeza e artefatos

\`${JSON.stringify(r.cleanup)}\`. STOP0/STATUS3/PIDausente; removidos só root/pgdata/socket próprios após parar. results36a.json registra evidências completas, runner36a.log/console36a.log e postgres36a.log registram execução; Vitest em vitest36a.log. SQL final deve continuar no SHA testado; qualquer alteração exige rerun.
`;
 writeFileSync(`${out}/RESULT36a.md`,md.trimEnd()+'\n');return md;
}
if(process.argv[1]?.endsWith('/report36a.mjs'))report36a();
