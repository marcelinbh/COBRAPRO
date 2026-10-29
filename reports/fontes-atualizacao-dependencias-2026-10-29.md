# Fontes verificadas — atualização de dependências

- **tRPC** — O advisory GHSA-43p4-m455-4f4j informa correção para a linha 11 na versão `11.8.0`; o projeto foi atualizado acima desse mínimo. A vulnerabilidade afeta especificamente os adaptadores experimentais Next.js que transformam `FormData`, não utilizados pelo CobraPro, mas a atualização elimina a exposição da versão dependente. [1]
- **Vite** — O advisory GHSA-93m4-6634-74q7 informa correção `7.1.11` para a linha 7.1; o projeto foi atualizado para uma versão posterior. [2]
- **SheetJS (`xlsx`)** — O advisory GHSA-4r6h-8v6p-xvw6 informa que as versões no npm até 0.19.2 são vulneráveis e que não há versão corrigida publicada pelo npm. Como o CobraPro exportava planilhas de parcelas, a dependência foi substituída por ExcelJS e a exportação passou a neutralizar textos interpretáveis como fórmula. [3]

## Referências

[1]: https://osv.dev/vulnerability/GHSA-43p4-m455-4f4j "tRPC prototype pollution advisory"
[2]: https://osv.dev/vulnerability/GHSA-93m4-6634-74q7 "Vite file access advisory"
[3]: https://osv.dev/vulnerability/GHSA-4r6h-8v6p-xvw6 "SheetJS prototype pollution advisory"

## Resultado da atualização — 29 de outubro

- **Atualizados:** AWS SDK S3, Supabase, tRPC, Vite e Streamdown. As cadeias vulneráveis de `fast-xml-parser`, `dompurify`, `lodash`, `lodash-es`, `postcss`, `source-map-js`, `ws` e `fflate` foram atualizadas para versões corrigidas. O patch local do Wouter foi removido; a lista de rotas do preview passou a ser declarada pelo próprio `App.tsx`, evitando alteração de dependência de terceiros.
- **Exportações:** SheetJS foi removido em favor de ExcelJS. CSV e XLSX neutralizam células iniciadas por `=`, `+`, `-` ou `@`, inclusive quando há espaço ou tab antes do marcador.
- **Auditoria de produção:** `pnpm audit --prod` encerrou sem vulnerabilidades críticas ou altas. Resta uma vulnerabilidade moderada em `uuid@8.3.2`, transitiva de ExcelJS 4.4.0 (a versão mais recente disponível). O advisory afeta exclusivamente UUID v3/v5/v6 quando o chamador fornece um buffer; o CobraPro importa ExcelJS somente para `workbook.xlsx.writeBuffer()` e o único uso interno de UUID do ExcelJS é `v4` em formatação condicional. Não há caminho de entrada do usuário para o parâmetro vulnerável. A troca do gerador de XLSX continuará rastreada até existir versão corrigida do ExcelJS ou substituto compatível.
