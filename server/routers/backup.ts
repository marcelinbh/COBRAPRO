import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';

async function sb() {
  const client = await getSupabaseClientAsync();
  if (!client) throw new Error('Supabase client not available');
  return client;
}

export const backupRouter = router({
  exportarClientes: protectedProcedure.query(async () => {
    const { data, error } = await (await sb())
      .from('clientes')
      .select('id, nome, cpf_cnpj, telefone, whatsapp, email, endereco, cidade, estado, cep, chave_pix, tipo_chave_pix, created_at')
      .order('nome');
    if (error) throw error;
    return { dados: data || [], total: (data || []).length };
  }),

  exportarContratos: protectedProcedure
    .input(z.object({ modalidade: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let query = (await sb())
        .from('contratos')
        .select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, data_vencimento_primeira, dia_vencimento, multa_atraso, juros_mora_diario, etiquetas, created_at, clientes(nome, cpf_cnpj, telefone, whatsapp)')
        .order('created_at', { ascending: false });

      if (input?.modalidade && input.modalidade !== 'todos') {
        query = query.eq('modalidade', input.modalidade);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { dados: data || [], total: (data || []).length };
    }),

  exportarParcelas: protectedProcedure
    .input(z.object({ status: z.string().optional(), dataInicio: z.string().optional(), dataFim: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let query = (await sb())
        .from('parcelas')
        .select('id, contrato_id, numero_parcela, valor, valor_juros, data_vencimento, data_pagamento, status, valor_pago, forma_pagamento, observacoes, created_at, contratos(modalidade, valor_principal, clientes(nome, cpf_cnpj, telefone))')
        .order('data_vencimento', { ascending: false });

      if (input?.status && input.status !== 'todos') {
        query = query.eq('status', input.status);
      }
      if (input?.dataInicio) {
        query = query.gte('data_vencimento', input.dataInicio);
      }
      if (input?.dataFim) {
        query = query.lte('data_vencimento', input.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { dados: data || [], total: (data || []).length };
    }),

  exportarVendas: protectedProcedure.query(async () => {
    const client = await sb();
    const { data: produtos, error: errProd } = await client
      .from('vendas')
      .select('id, produto, quantidade, valor_unitario, valor_total, status, forma_pagamento, data_venda, cliente_id, clientes(nome, cpf_cnpj, telefone)')
      .order('data_venda', { ascending: false });
    if (errProd) throw errProd;

    const { data: veiculos, error: errVeic } = await client
      .from('veiculos')
      .select('id, marca, modelo, ano, placa, valor_venda, valor_entrada, status, data_venda, cliente_id, clientes(nome, cpf_cnpj, telefone)')
      .order('created_at', { ascending: false });
    if (errVeic) throw errVeic;

    return {
      produtos: produtos || [],
      veiculos: veiculos || [],
      totalProdutos: (produtos || []).length,
      totalVeiculos: (veiculos || []).length,
    };
  }),

  exportarTransacoes: protectedProcedure
    .input(z.object({ dataInicio: z.string().optional(), dataFim: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let query = (await sb())
        .from('transacoes_caixa')
        .select('id, conta_caixa_id, tipo, categoria, descricao, valor, data_transacao, created_at, contas_caixa(nome)')
        .order('data_transacao', { ascending: false });

      if (input?.dataInicio) {
        query = query.gte('data_transacao', input.dataInicio);
      }
      if (input?.dataFim) {
        query = query.lte('data_transacao', input.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { dados: data || [], total: (data || []).length };
    }),
});
