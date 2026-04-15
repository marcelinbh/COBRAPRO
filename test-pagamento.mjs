import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(supabaseUrl, supabaseKey);

// Simular a procedure registrarPagamento
const input = {
  parcelaId: 52,
  valorPago: 566.67,
  contaCaixaId: 1,
  observacoes: undefined,
  desconto: 0,
};

console.log('Testing registrarPagamento with input:', input);

// Buscar parcela
const { data: parcelaData, error: parcelaErr } = await sb.from('parcelas').select('*').eq('id', input.parcelaId).single();
if (parcelaErr || !parcelaData) {
  console.error('Error fetching parcela:', parcelaErr?.message);
  process.exit(1);
}
console.log('Parcela found:', parcelaData.id, parcelaData.status);

// Calcular juros
const dataVencimento = new Date(parcelaData.data_vencimento + 'T00:00:00');
const hoje = new Date();
const diasAtraso = Math.max(0, Math.floor((hoje - dataVencimento) / (1000 * 60 * 60 * 24)));
const juros = diasAtraso > 0 ? parseFloat(parcelaData.valor_original) * 0.01 * diasAtraso : 0;
const multa = diasAtraso > 0 ? parseFloat(parcelaData.valor_original) * 0.02 : 0;
console.log('Juros:', juros, 'Multa:', multa);

const valorOriginal = parseFloat(parcelaData.valor_original);
const novoStatus = input.valorPago >= valorOriginal ? 'paga' : 'parcial';

// Atualizar parcela
const { error: updateErr } = await sb.from('parcelas').update({
  valor_pago: input.valorPago.toFixed(2),
  valor_juros: juros.toFixed(2),
  valor_multa: multa.toFixed(2),
  valor_desconto: input.desconto.toFixed(2),
  data_pagamento: new Date().toISOString(),
  status: novoStatus,
  conta_caixa_id: input.contaCaixaId,
  observacoes: input.observacoes ?? null,
}).eq('id', input.parcelaId);

if (updateErr) {
  console.error('Error updating parcela:', updateErr.message);
} else {
  console.log('Parcela updated successfully! Status:', novoStatus);
}

// Registrar transação
const { error: txErr } = await sb.from('transacoes_caixa').insert({
  conta_caixa_id: input.contaCaixaId,
  tipo: 'entrada',
  categoria: 'pagamento_parcela',
  valor: input.valorPago.toFixed(2),
  descricao: `Pagamento parcela #${parcelaData.numero_parcela} - Contrato #${parcelaData.contrato_id}`,
  parcela_id: input.parcelaId,
  contrato_id: parcelaData.contrato_id,
  cliente_id: parcelaData.cliente_id,
});

if (txErr) {
  console.error('Error inserting transacao:', txErr.message);
} else {
  console.log('Transacao inserted successfully!');
}

console.log('Result:', { success: true, status: novoStatus });
