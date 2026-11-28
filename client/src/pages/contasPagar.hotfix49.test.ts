import { describe, expect, it, vi } from 'vitest';
import { code, compile, Hooks, source, text, treeNodes } from '../lib/r1BoundaryHarness';
import { DespesasIntentStore, diaCivilBrt, dinheiroDespesa, moedaDespesa, criarDespesaPayload, pagarDespesaPayload, estornarDespesaPayload } from '../../../shared/despesasIntent';
import { assertRecoveryEvidence, canCloseRejectedIntent } from '../../../shared/financialIntentRecovery';
import { edicao49Request, validarQuote49, validarRecibo49, validarRecovery49 } from '../../../shared/despesas49';
import { isOwnedKey38 } from '../../../shared/despesas38Original';
import { CancelamentoPendenteStore } from '../../../shared/despesaCancelamentoPendente';
import { Despesas49Journal } from '../lib/despesas49Journal';
import { hashKey } from '@tanstack/react-query';

// Transpila somente as fontes locais. Sem imports do app, DOM, rede ou execução SQL.
// Duas instâncias explícitas de hooks exercitam a fronteira parent -> painel49.
class Memory {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const uuid = '51000000-0000-4000-8000-000000000001';
const origin = '51000000-0000-4000-8000-000000000002';
async function turns() { for (let i = 0; i < 24; i++) await Promise.resolve(); }
function fixture() {
  const owner = 26011, memory = new Memory();
  const original = new DespesasIntentStore(owner, memory, vi.fn(), () => uuid).begin('pagar', { id: 64, contaCaixaId: 1, dataPagamento: '2030-02-01' });
  const hooks = new Hooks(), childHooks = new Hooks(), quote = vi.fn().mockResolvedValue({ contrato: 'despesas49_v1', userId: owner, despesaId: 64, origemOperationId: origin, estadoHash: 'a'.repeat(64), valor: '1.00', habilitado: true, semMovimentoCaixa: true, modo: 'sucessao20', original: { id: 64, user_id: owner, descricao: 'Fixture sem execução financeira', categoria: 'outros', data_vencimento: '2030-02-01', observacoes: null, status: 'pendente', data_pagamento: null, conta_caixa_id: null, recorrente: false, frequencia: null } });
  const writer = vi.fn(), reconciliation = vi.fn(), invalidation = vi.fn().mockResolvedValue(undefined);
  const utils = new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate: invalidation }) }) });
  const rows = [{ id: 64, descricao: 'Fixture sem execução financeira', valor: '1.00', categoria: 'outros', dataVencimento: '2030-02-01', status: 'pendente', podePagar: true, podeCancelarPendente: true, origemOperationId: origin }];
  const query = (data: any) => ({ useQuery: () => ({ data, isError: false, isLoading: false, isFetching: false }) });
  const trpc = {
    auth: { me: query({ id: owner }) }, useUtils: () => utils,
    caixa: { contasParaOperacao37: query({ empresaId: owner, contas: [] }) },
    contasPagar: {
      listar: query(rows), resumo: query({ totalPendente: '1.00', qtdPendente: 1, totalAtrasado: '0.00', qtdAtrasado: 0, totalPago: '0.00', qtdPago: 0 }), capacidades: query({ prospectivasHabilitadas: false }),
      criar: { useMutation: () => ({ mutateAsync: writer }) }, pagar: { useMutation: () => ({ mutateAsync: writer }) }, estornar: { useMutation: () => ({ mutateAsync: writer }) }, reconciliar: { useMutation: () => ({ mutateAsync: reconciliation }) },
    },
    despesas49: {
      capacidades: { useQuery: () => ({ data: { habilitado: true }, isError: false, isLoading: false, isFetching: false, refetch: vi.fn() }) },
      cotar: { useMutation: () => ({ mutateAsync: quote }) }, editar: { useMutation: () => ({ mutateAsync: writer }) }, recuperar: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  };
  const ui = Object.fromEntries(['Card', 'CardContent', 'Button', 'Input', 'Label', 'Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue', 'Badge', 'Dialog', 'DialogContent', 'DialogHeader', 'DialogTitle', 'Textarea', 'Receipt', 'Plus', 'Undo2', 'ConferenciaDespesasCaixa'].map(k => [k, k]));
  const panel = compile(`let generation49=0; const categories=['outros']; ${code(source('components/EdicaoDespesa49.tsx'), 'EdicaoDespesa49')}\nreturn EdicaoDespesa49;`, {
    ...childHooks.bindings(), ...ui, trpc, hashKey, Despesas49Journal, CancelamentoPendenteStore, isOwnedKey38, edicao49Request, validarQuote49, validarRecibo49, validarRecovery49,
    window: { sessionStorage: memory }, navigator: { locks: { request: async (_: string, fn: () => any) => fn() } },
  });
  const page = compile(`const despesasTrpc=trpc; const categorias={outros:'Outros'}; const statuses={pendente:'Pendente'}; const freshForm=()=>({descricao:'',categoria:'outros',valor:'',dataVencimento:diaCivilBrt(),observacoes:''}); const dataLabel=(d)=>d; const acoes=['criar','pagar','estornar']; let proximaSessaoCache=0; ${code(source('pages/ContasPagar.tsx'), 'ContasPagar')}\nreturn ContasPagar;`, {
    ...hooks.bindings(), ...ui, trpc, hashKey, DespesasIntentStore, diaCivilBrt, dinheiroDespesa, moedaDespesa, criarDespesaPayload, pagarDespesaPayload, estornarDespesaPayload, assertRecoveryEvidence, canCloseRejectedIntent,
    RecorrenciaDespesas68: 'Panel68', EdicaoDespesa69: 'Panel69', EdicaoDespesa49: 'Panel49', CancelamentoPendente: 'Panel38c', toast: { success: vi.fn(), error: vi.fn() }, window: { sessionStorage: memory },
  });
  let pageTree: any, panelTree: any;
  function render() {
    pageTree = hooks.render(page); hooks.flush(); pageTree = hooks.render(page);
    const p = treeNodes(pageTree, n => n.type === 'Panel49')[0];
    panelTree = childHooks.render(panel, p.props); childHooks.flush(); panelTree = childHooks.render(panel, p.props); childHooks.flush(); panelTree = childHooks.render(panel, p.props);
    return p;
  }
  function button(tree: any, label: string) { const n = treeNodes(tree, n => n.type === 'Button' && text(n).includes(label))[0]; expect(n).toBeDefined(); return n; }
  return { owner, memory, original, reconciliation, writer, quote, render, button, page: () => pageTree, panel: () => panelTree, close: () => { hooks.unmount(); childHooks.unmount(); } };
}

describe('hotfix49 parent -> painel real: liberação por prova20 no mesmo mount', () => {
  it.each(['confirmed', 'not_executed'] as const)('%s libera apenas após protocolo original; seleção de linha só cota sem writer', async status => {
    const h = fixture();
    try {
      h.render(); expect(text(h.panel())).toContain('Original20/38 retido');
      h.reconciliation.mockImplementation(async request => ({ ...request, userId: h.owner, payloadHash: 'b'.repeat(64), proof: 'uuid_fenced_v1', status, fenceId: status === 'not_executed' ? origin : null, result: status === 'confirmed' ? { operationId: origin } : null, quote: null }));
      h.button(h.page(), 'Reconciliar UUID').props.onClick(); await turns(); h.render();
      if (status === 'not_executed') { expect(text(h.panel())).toContain('Original20/38 retido'); h.button(h.page(), 'Encerrar após').props.onClick(); await turns(); h.render(); }
      expect(h.memory.getItem(`cobrapro:despesas:0020:v1:user:${h.owner}:action:pagar`)).toBeNull();
      expect(text(h.panel())).not.toContain('Original20/38 retido');
      h.button(h.page(), 'Editar').props.onClick(); h.render(); await turns(); h.render();
      expect(h.quote).toHaveBeenCalledWith({ despesaId: 64 }); expect(text(h.panel())).toContain('Valor preservado: R$ 1.00'); expect(h.writer).not.toHaveBeenCalled(); expect(h.memory.getItem(`cobrapro:despesas49:${h.owner}:pending`)).toBeNull();
    } finally { h.close(); }
  });
});
