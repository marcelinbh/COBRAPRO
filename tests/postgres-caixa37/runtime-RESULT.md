# Certificação RUNTIME37 — GO somente subfrente runtime

Exclusivamente PG17 real local, duas bases fresh; TCP desabilitado, socket0700. SQL37 observado: `2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334`. SQL36 frozen: `7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f`. Nenhuma alteração em target, template, runner, builders, migrations antigas, shared/backend/client/docs; sem Git/browser/Supabase/rede produtiva.

## Comando

```sh
cd /home/ubuntu/cobrapro && node tests/postgres-caixa37/certification-runtime.mjs
```

O script relê SHA do target em cada execução e falha se SQL36 frozen mudou. Não executa builders. 56 grupos PASS; 0 grupos CASE_FAIL; os POINTs não são contabilizados como grupos independentes.
## Matriz executada

| IDs PLAN | Execução | Limite preciso |
|---|---|---|
| X01 | Antes/depois de cada perna (aporte/origem/destino), antes/depois proof de cada perna, antes/depois seal; probe sequence rollback-safe valida quantidades físicas/proof/seal; retry mesmoUUID após fonte/metadata originais restauradas + replay/recovery exatos | Variante de fonte explicitamente sintética, local resealed; não é bypass produtivo. |
| Q02 | Advisory UUID waiter observado em pg_locks; relógio determinístico muda BRT antes liberar espera; captura pós-lock40001. Mudança BRT induzida após origem e destino físicos40001; rollback e retry mesmoUUID | Clock test-only no schema runtime37_test; não depende de esperar meia-noite real. Fusos já cobertos runner, não duplicados. |
| X02 | Trigger altera NEW depois consumo oldguards e antes guard37 real:42501; depois todos consumers:23514 por row esperado×real. Extra ledger em terceira conta e rename detectados wholeowner. Residualcap após seal retorna resultado provisório mas COMMIT23514 | Guards antigos íntegros. Não afirma proteção de todos cohorts antigos: contas sintéticas7/8, sem origens21/35/36; convivência/corridas de oldwriters delegadas a outra frente. Metadata local resealed exclusivamente para trigger/fonte de teste. |
| S02 | Consumer original: sessão estrangeira, pid/xid/op/guard/perna errados, UPDATE/DELETE/contratos/anterior, alteração de todos11 campos rowtype com cap+proof+hash iguais ao row adulterado, exact consume e doubleconsume | Emissão manual superuser apenas synthetic, immutable pernas desativado antes INSERT e rollback no fim, permite testar helper privado; não prova acesso service_role, já escopo S01 runner. Cross-session não enxerga pending não commitado, além pid/xid adulterados. |
| S03 | Tamper request/hash/audit/result/proof/hash/pin owner/base/fence/owner físico; fonte/verificadores/guards restaurados após corrupção; snapshot negativo e zero resíduos; coherent result/pin primeira_op adversariais | Corrupção intencional via privilégio superuser local desativa todos triggers da tabela privada só para preparar fixture corrupta sem eventos diferidos e reativa antes RPC. Nunca produção. Achados abaixo impedem GO se aceitos. |
| I02/R04 | Append legítimo após original; alvos inativos; restart verdadeiro stop/start, ausência pid e novo PID; hashes preservados; replay/result histórico e fence antigo1900+hash expirado; fence impede execução tardia | Restart controlado fast, não simula perda de energia/FSync quebrado. Owner físico corrupto negativo testado antes restart. |

## Achados reprodutíveis

Nenhuma aceitação corrupta nos cenários efetuados.

## Instrumentação e resíduos

Cada variante local usa DDL do alvo lido em disco, replace exato/único, preserva guard original, reseal **apenas metadata**34/35/36/37 do banco synthetic. Variantes transacionais são ROLLBACK; variante clock para sessão concorrente é commitada e restaurada em finally. Probe independente via sequence não rollbacka e verifica contagem de ledger/proof/seal antes marcar; 55000 precoce não é contado como fault alcançado. Toda negativa compara snapshot wholeowner+oldproof/ops/fences, capacidades/witness37 zero. Fonte final no disco não é escrita.

Cluster próprio: `/tmp/caixa37-runtime-ad6xbZ`. Cleanup: PG17 parado, postmaster.pid ausente, apenas próprio pgdata removido. Log PostgreSQL preservado em runtime-postgres.log.

## Faltante / fora desta subfrente

Coexistência31/35/36, cohorts antigos, corridas oldwriters, suítes predecessoras e proteção global dos oldguards NÃO certificados aqui. Preflight/builder reforçados pelo pai podem alterar SHA final; obrigatório rerun deste comando sobre SHA final. Falhas restantes no relatório são NO-GO real desta subfrente, não certificação de desenho.
