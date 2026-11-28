export const fixture67 = (): any => ({ versao: 'lista_emprestimos67_v1', userId: 41,
  lista60: { versao: 'lista_emprestimos60_v1', userId: 41, dataCalculo: '2026-11-27', configuracoes: [], items: [
    { kind: 'validated', id: 1, contrato: { id: 1, user_id: 41, cliente_id: 2, koletor_id: 7, modalidade: 'mensal', status: 'ativo', valor_principal: '100.00' },
      cliente: { id: 2, user_id: 41, nome: 'Homônimo sintético' },
      parcelas: [{ id: 3, user_id: 41, contrato_id: 1, cliente_id: 2, numero_parcela: 1, valor_original: '110.00', valor_juros: '10.00', valor_pago: '0.00', valor_multa: '0.00', multa_manual: '0.00', saldo_residual: '0.00', data_vencimento: '2026-11-26', data_pagamento: null, status: 'pendente' }],
      estado51: { versao: 'obrigacoes51_v1', userId: 41, contratoId: 1, statusObrigacao: 'ativo', arquivado: false, obrigacaoAdicional: '0.00', parcelas: [{ parcelaId: 3, statusFinanceiroOriginal: 'pendente', statusObrigacao: 'aberta', obrigacaoAtual: '110.00', componenteAdicional: '0.00', arquivada: false }] }, cotacoes36: null },
    { kind: 'unavailable', id: 9, reason: 'local_link_unconfirmed' },
  ] }, organizacao67: { state: 'confirmed', scope: 'ALLscope', catalogo: [{ id: '1', userId: 41, nome: 'Prioridade', cor: '#abcdef' }],
    cobradores: [{ id: 7, userId: 41, nome: 'Cobrador próprio' }], contratos: [{ id: 1, cobrador: { state: 'confirmed', id: 7 }, etiquetas: { state: 'confirmed', nomes: ['Prioridade', 'Histórico'], revisao: '0', estadoHash: 'a'.repeat(64) } }] } });
