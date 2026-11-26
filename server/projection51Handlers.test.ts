import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { listarRegistrosEmprestimos, falhaLeituraEmprestimos, falhaVinculoEmprestimos } from './services/emprestimosLeitura';
import { lerProjecaoVinculada51, lerCobrancaExigivel51 } from './services/obrigacoes51Leitura';
import { apresentarEmprestimo } from './services/emprestimosApresentacao';
import { lerCotacoesApresentacaoMulta } from './services/multaManualApresentacao';
import { dataHojeBrasilia, adicionarDiasData } from './services/businessDate';
import { DIAS_LEMBRETE, referenciaVigente, lerChavePagamento, obterProvaPagamento, chavePagamento } from './services/notificacoes.operational.safe';
import { source51Test, projection51Test } from './services/projection51TestSource';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function parse(file: string) { return ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); }
/** Executa somente a função extraída da fonte INTEGRADA, não uma cópia/manual
 * nem uma asserção textual. Nenhum import da fonte é avaliado. */
function compile(node: ts.Node, source: ts.SourceFile, deps: Record<string, unknown>) {
  const js = ts.transpileModule(`const extracted = (${node.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(deps), `${js}; return extracted;`)(...Object.values(deps));
}
function queryHandler(router: string, name: string, deps: Record<string, unknown>) {
  const source = parse('server/routers.ts'); let init: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === router && node.initializer && ts.isCallExpression(node.initializer)) {
      const object = node.initializer.arguments[0];
      if (object && ts.isObjectLiteralExpression(object)) {
        const property = object.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(source) === name);
        if (property && ts.isPropertyAssignment(property)) init = property.initializer;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!init || !ts.isCallExpression(init) || !init.arguments[0] || !ts.isArrowFunction(init.arguments[0])) throw new Error('Handler real não encontrado');
  return compile(init.arguments[0], source, deps);
}
function notificationHandler(name: string, deps: Record<string, unknown>) {
  const source = parse('server/services/notificacoesAutomaticas.ts');
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  if (!fn || !ts.isFunctionDeclaration(fn)) throw new Error('Função real não encontrada');
  // Retira apenas o modificador export; declaração é preservada integralmente.
  const node = ts.factory.updateFunctionDeclaration(fn, fn.modifiers?.filter(m => m.kind !== ts.SyntaxKind.ExportKeyword), fn.asteriskToken, fn.name, fn.typeParameters, fn.parameters, fn.type, fn.body);
  const text = ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, source);
  const js = ts.transpileModule(`${text}; const extracted = ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(deps), `${js};return extracted;`)(...Object.values(deps));
}
function readDeps(f: ReturnType<typeof source51Test>) { return { getSupabaseClientAsync: async () => f, listarRegistrosEmprestimos, falhaLeituraEmprestimos, falhaVinculoEmprestimos, lerProjecaoVinculada51, apresentarEmprestimo, lerCotacoesApresentacaoMulta, dataHojeBrasilia: () => '2026-11-26' }; }
describe('Handlers reais51 extraídos por AST e dependências inertes', () => {
  it('obterDetalhes projeta cancelamento sem perder o pago nem zerar capital', async () => {
    const p = projection51Test(); p.statusObrigacao = 'encerrado_por_cancelamento'; p.parcelas[0].statusObrigacao = 'cancelada'; p.parcelas[0].obrigacaoAtual = '0.00';
    const f = source51Test(p); f.tables.parcelas[0].valor_pago = '30.00';
    const handler = queryHandler('contratosRouter', 'obterDetalhes', readDeps(f));
    const result = await handler({ ctx: { user: { id: 41 } }, input: { id: 1 } });
    expect(result).toMatchObject({ status: 'encerrado_por_cancelamento', statusFinanceiroOriginal: 'ativo', valorPrincipal: '100.00', totalPago: 30, totalReceber: 0, obrigacaoAtual: '0.00' });
    expect(result.todasParcelas[0]).toMatchObject({ status: 'cancelada', statusFinanceiroOriginal: 'pendente', valor_pago: '30.00' });
  });
  it('listComParcelas filtra status efetivo e arquivo depois de provas completas', async () => {
    const p = projection51Test(); p.statusObrigacao = 'encerrado_por_cancelamento'; p.arquivado = true; p.parcelas[0] = { ...p.parcelas[0], statusObrigacao: 'cancelada', obrigacaoAtual: '0.00', arquivada: true };
    const f = source51Test(p), handler = queryHandler('contratosRouter', 'listComParcelas', readDeps(f));
    const ctx = { user: { id: 41 } };
    expect(await handler({ ctx, input: { arquivo: 'operacional' } })).toEqual([]);
    expect(await handler({ ctx, input: { arquivo: 'historico', status: 'encerrado_por_cancelamento' } })).toHaveLength(1);
    expect(f.calls.filter(c => c.table === 'contratos').every(c => c.filters.every(([k]) => k !== 'status'))).toBe(true);
  });
  it('enfileiramento real rejeita cobrança renunciada antes de qualquer upsert', async () => {
    const p = projection51Test(); p.statusObrigacao = 'encerrado_por_cancelamento'; p.parcelas[0].statusObrigacao = 'cancelada'; p.parcelas[0].obrigacaoAtual = '0.00';
    const f = source51Test(p);
    const handler = notificationHandler('enfileirarMensagemWhatsApp', { getSupabaseClientAsync: async () => f, normalizarTelefoneWhatsApp: (v: string) => v, DIAS_LEMBRETE, lerCobrancaExigivel51, lerChavePagamento, obterProvaPagamento });
    expect(await handler({ userId: 41, tipo: 'no_vencimento', telefone: '5531999999999', mensagem: 'fixture', chaveDeduplicacao: 'fixture', dataReferencia: '2026-11-26', parcelaId: 3, clienteId: 2 })).toEqual({ criada: false, chave: 'fixture' });
    expect(f.calls.some(c => c.table === 'whatsapp_outbox')).toBe(false);
  });
  it('confirmação real já provada ignora estado atual51 cancelado/indisponível', async () => {
    const f = source51Test(), rpc = vi.fn(async (name: string) => {
      if (name !== 'legados_prova_pagamento') throw new Error('Estado51 não deve bloquear evidência');
      return { data: { parcelaId: 3, contratoId: 1, clienteId: 2, valor: '30.00', dataPagamento: '2026-11-26' }, error: null };
    });
    const handler = notificationHandler('enfileirarMensagemWhatsApp', { getSupabaseClientAsync: async () => ({ ...f, rpc }), normalizarTelefoneWhatsApp: (v: string) => v, DIAS_LEMBRETE, lerCobrancaExigivel51, lerChavePagamento, obterProvaPagamento });
    const op = '11111111-1111-4111-8111-111111111111';
    await handler({ userId: 41, tipo: 'confirmacao_pagamento', telefone: '5531999999999', mensagem: 'fixture', chaveDeduplicacao: chavePagamento(41, 'legados_operacoes', op), dataReferencia: '2026-11-26', parcelaId: 3, clienteId: 2 }, true);
    expect(rpc).toHaveBeenCalledTimes(1); expect(rpc.mock.calls[0][0]).toBe('legados_prova_pagamento');
  });
  it('pré-envio real reconfirma exigibilidade51; confirmação de pagamento segue evidência', async () => {
    const p = projection51Test(); p.statusObrigacao = 'encerrado_por_cancelamento'; p.parcelas[0].statusObrigacao = 'cancelada'; p.parcelas[0].obrigacaoAtual = '0.00';
    const f = source51Test(p), original = f.from;
    const db = { ...f, from(table: string) {
      const q = original(table);
      const one = table === 'configuracoes' ? { user_id: 41, valor: 'true' }
        : table === 'notificacoes_automaticas' ? { user_id: 41, ativo: true }
        : table === 'parcelas' ? f.tables.parcelas[0]
        : table === 'contratos' ? f.tables.contratos[0] : f.tables.clientes[0];
      // Fluent methods return q; attach the terminal operation to q itself.
      return Object.assign(q, { maybeSingle: async () => ({ data: one, error: null }) });
    } };
    const handler = notificationHandler('motivoItemObsoleto', { DIAS_LEMBRETE, referenciaVigente, adicionarDiasData, lerCobrancaExigivel51, lerChavePagamento, obterProvaPagamento, normalizarTelefoneWhatsApp: (v: string) => v, ownerValido: (v: { user_id: number } | null, owner?: number) => Boolean(v && v.user_id > 0 && (owner === undefined || v.user_id === owner)) });
    const item = { user_id: 41, tipo: 'no_vencimento', parcela_id: 3, cliente_id: 2, data_referencia: '2026-11-26', telefone: '5531999999999' };
    expect(await handler(db, item, new Date('2026-11-26T12:00:00Z'))).toBe('OBRIGACAO51_NAO_EXIGIVEL');
    const op = '11111111-1111-4111-8111-111111111111';
    const confirmed = { ...db, rpc: async (name: string) => { if (name !== 'legados_prova_pagamento') throw new Error('51 desnecessário'); return { data: { parcelaId: 3, contratoId: 1, clienteId: 2, valor: '30.00', dataPagamento: '2026-11-26' }, error: null }; } };
    expect(await handler(confirmed, { ...item, tipo: 'confirmacao_pagamento', chave_deduplicacao: chavePagamento(41, 'legados_operacoes', op) }, new Date('2026-11-26T12:00:00Z'))).toBeNull();
  });
});
