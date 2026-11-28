import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { mapearSnapshot67 } from '../../server/services/snapshot67-reader';
import { filtrarLista67 } from '../../client/src/lib/emprestimosListaControles67';
import { criarRelatorioLista66 } from '../../client/src/lib/relatorioLista66';
import { EmprestimosListaSegura } from '../../client/src/components/EmprestimosListaSegura';
// Parent injeta captura REAL PG67; não confunde fixture APP com teste SQL executado.
const capture=process.env.CONTROLES67_SQL_CAPTURE;
it.skipIf(!capture)('captura real PG17 integrada67 atravessa parser60/67, SSR e referência66',()=>{
 const raw=JSON.parse(readFileSync(capture!,'utf8')),data=mapearSnapshot67(raw,6701);
 expect(data.coverage.unavailableContracts).toBe(2);expect(data.organizacao67?.state).toBe('confirmed');
 const f={arquivo:'todos' as const,busca:'',modalidade:'todos',statusObrigacao:'todos',vencimento:'todos' as const,cobrador:'todos',etiqueta:'todos'},items=filtrarLista67(data,f);
 const report=criarRelatorioLista66(data,items,{...f,modo:'pastas'},6701);expect(report.cabecalho).toHaveLength(16);expect(report.linhas.map(l=>l[0])).toEqual(items.map(i=>i.id));
 for(const item of items)expect(data.items.find(i=>i.id===item.id)).toBe(item);
 const html=renderToStaticMarkup(React.createElement(EmprestimosListaSegura,{data,onRefresh:()=>{}}));expect(html).toContain('Empréstimo #67004');expect(html).not.toContain('EXTERNO67 não expor');
 expect(html).toContain('/emprestimos/67001#receber-conferir');expect(report.avisos.join(' ')).toContain('ALLscope');
});
