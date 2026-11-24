// Somente leitura. Não calcula Caixa, lucro realizado ou ROI.
import type { SupabaseClient } from '@supabase/supabase-js';
type Linha = Record<string, unknown>;
export type ClienteLeituraTelefone41 = Pick<SupabaseClient, 'from'>;
const pagina = 500;
const statusVendas = new Set(['ativo', 'inadimplente', 'quitado', 'cancelado']);
const statusParcelas = new Set(['pendente', 'atrasada', 'vencendo_hoje', 'parcial', 'paga']);

function inteiro(valor: unknown): number {
  const n = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Identificador/quantidade de leitura inválido');
  return n;
}
function centavos(valor: unknown, negativo = false): number {
  if (typeof valor !== 'string' && typeof valor !== 'number') throw new Error('Valor monetário de leitura ausente');
  const texto = String(valor);
  if (!(negativo ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(texto)) throw new Error('Valor monetário de leitura inválido');
  const n = Math.round(Number(texto) * 100);
  if (!Number.isSafeInteger(n)) throw new Error('Valor monetário de leitura fora do limite');
  return n;
}
function somar(a: number, b: number): number {
  const n = a + b;
  if (!Number.isSafeInteger(n)) throw new Error('Total de leitura fora do limite');
  return n;
}

export function calcularIndicadoresTelefone41(vendas: Linha[], parcelas: Linha[]) {
  const porVenda = new Map<number, Linha>();
  let custo = 0, lucro = 0, saldo = 0, ativas = 0, quitadas = 0;
  for (const venda of vendas) {
    const id = inteiro(venda.id);
    if (porVenda.has(id) || !statusVendas.has(String(venda.status))) throw new Error('Venda duplicada/status desconhecido');
    porVenda.set(id, venda);
    if (venda.status === 'cancelado') continue;
    custo = somar(custo, centavos(venda.custo));
    lucro = somar(lucro, centavos(venda.lucro_bruto, true));
    if (venda.status === 'ativo' || venda.status === 'inadimplente') ativas++;
    if (venda.status === 'quitado') quitadas++;
  }
  const ids = new Set<number>();
  const contagens = new Map<number, number>();
  for (const parcela of parcelas) {
    const vendaId = inteiro(parcela.venda_id);
    const venda = porVenda.get(vendaId);
    // Históricos cancelados/quitados e parcelas sem venda do owner não compõem saldo.
    if (!venda || (venda.status !== 'ativo' && venda.status !== 'inadimplente')) continue;
    const id = inteiro(parcela.id);
    if (ids.has(id) || !statusParcelas.has(String(parcela.status))) throw new Error('Parcela duplicada/status desconhecido');
    ids.add(id);
    contagens.set(vendaId, (contagens.get(vendaId) ?? 0) + 1);
    if (parcela.status === 'paga') continue;
    const valor = centavos(parcela.valor);
    const pago = parcela.valor_pago == null ? 0 : centavos(parcela.valor_pago);
    // As parcelas já excluem a entrada. Não somar total_a_receber, nem subtrair entrada outra vez.
    saldo = somar(saldo, Math.max(0, valor - pago));
  }
  for (const [id, venda] of porVenda) {
    if (venda.status === 'ativo' || venda.status === 'inadimplente') {
      if ((contagens.get(id) ?? 0) !== inteiro(venda.num_parcelas)) throw new Error('Leitura de parcelas incompleta');
    }
  }
  return {
    totalVendas: vendas.filter(v => v.status !== 'cancelado').length,
    capitalInvestido: custo / 100, // Nome legado do contrato: custo cadastrado, não capital líquido/efetivo.
    totalAReceber: saldo / 100,
    lucroBruto: lucro / 100, // Projeção contratual de recebimentos menos custo, não realização.
    vendasAtivas: ativas,
    vendasQuitadas: quitadas,
  };
}

async function lerPaginas(cliente: ClienteLeituraTelefone41, owner: number, tabela: string, colunas: string) {
  const linhas: Linha[] = [];
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await cliente.from(tabela).select(colunas).eq('user_id', owner)
      .order('id', { ascending: true }).range(inicio, inicio + pagina - 1);
    if (error || !Array.isArray(data)) throw new Error('Leitura de indicadores indisponível');
    // Seleção dinâmica: cada campo utilizado é validado pelo modelo antes da agregação.
    linhas.push(...(data as unknown as Linha[]));
    if (data.length < pagina) return linhas;
  }
}
export async function lerIndicadoresTelefone41(cliente: ClienteLeituraTelefone41, owner: number) {
  const vendas = await lerPaginas(cliente, owner, 'vendas_telefone', 'id,status,custo,lucro_bruto,num_parcelas');
  const parcelas = await lerPaginas(cliente, owner, 'parcelas_venda_telefone', 'id,venda_id,status,valor,valor_pago');
  return calcularIndicadoresTelefone41(vendas, parcelas);
}
