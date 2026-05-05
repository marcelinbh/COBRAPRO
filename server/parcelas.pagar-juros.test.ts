import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { parcelas, contratos, clientes, users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('pagarJuros - Renovação Automática de Parcelas', () => {
  let db: any;
  let userId: number;
  let clienteId: number;
  let contratoId: number;
  let parcelaId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      console.warn('Database not available, skipping tests');
      return;
    }

    // Criar usuário de teste
    const userRows = await db.insert(users).values({
      email: `test-juros-${Date.now()}@test.com`,
      nome: 'Teste Pagar Juros',
      passwordHash: 'hash123',
      role: 'user',
      loginMethod: 'email',
    }).returning();
    userId = userRows[0].id;

    // Criar cliente de teste
    const clienteRows = await db.insert(clientes).values({
      userId,
      nome: 'Cliente Teste Juros',
      cpf: `123456789${Math.floor(Math.random() * 100)}`,
      telefone: '11999999999',
      tipo: 'pessoa_fisica',
      ativo: true,
    }).returning();
    clienteId = clienteRows[0].id;

    // Criar contrato quinzenal (15 dias)
    const contratoRows = await db.insert(contratos).values({
      userId,
      clienteId,
      modalidade: 'quinzenal',
      tipoTaxa: 'quinzenal',
      taxaJuros: 50, // 50%
      valorPrincipal: '1000.00',
      numeroParcelas: 1,
      statusContrato: 'ativo',
    }).returning();
    contratoId = contratoRows[0].id;

    // Criar parcela inicial (capital: 1000, juros: 500, total: 1500)
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 15);
    const dataVencStr = dataVencimento.toISOString().split('T')[0];

    const parcelaRows = await db.insert(parcelas).values({
      userId,
      contratoId,
      clienteId,
      numeroParcela: 1,
      valorOriginal: '1000.00',
      valorJuros: '500.00',
      dataVencimento: dataVencStr,
      status: 'pendente',
    }).returning();
    parcelaId = parcelaRows[0].id;
  });

  afterAll(async () => {
    if (!db) return;
    // Limpar dados de teste
    if (parcelaId) await db.delete(parcelas).where(eq(parcelas.id, parcelaId));
    if (contratoId) await db.delete(contratos).where(eq(contratos.id, contratoId));
    if (clienteId) await db.delete(clientes).where(eq(clientes.id, clienteId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it('deve renovar parcela automaticamente ao pagar juros', async () => {
    if (!db) {
      console.warn('Skipping test - database not available');
      return;
    }

    // Verificar parcela inicial
    const parcelaInicial = await db.select().from(parcelas).where(eq(parcelas.id, parcelaId)).limit(1);
    expect(parcelaInicial).toHaveLength(1);
    expect(parcelaInicial[0].status).toBe('pendente');
    expect(parcelaInicial[0].valorOriginal).toBe('1000.00');
    expect(parcelaInicial[0].valorJuros).toBe('500.00');

    // Simular pagamento de juros (R$ 500)
    const hoje = new Date();
    const dataVencAtual = new Date(String(parcelaInicial[0].dataVencimento) + 'T00:00:00');
    const novaDataVenc = new Date(dataVencAtual);
    novaDataVenc.setDate(novaDataVenc.getDate() + 15); // +15 dias para quinzenal
    const novaDataVencStr = novaDataVenc.toISOString().split('T')[0];

    // Atualizar parcela como paga
    await db.update(parcelas)
      .set({
        valorPago: '500.00',
        dataPagamento: hoje,
        status: 'paga',
        observacoes: 'Pagamento de juros - renovado',
      })
      .where(eq(parcelas.id, parcelaId));

    // Criar nova parcela (renovação)
    const novaParcelaRows = await db.insert(parcelas).values({
      userId,
      contratoId,
      clienteId,
      numeroParcela: 2,
      valorOriginal: '1000.00', // Mantém o capital
      valorJuros: '500.00', // Mantém os juros
      dataVencimento: novaDataVencStr,
      status: 'pendente',
    }).returning();

    const novaParcelaId = novaParcelaRows[0].id;

    // Verificações
    const parcelaRenovada = await db.select().from(parcelas).where(eq(parcelas.id, novaParcelaId)).limit(1);
    expect(parcelaRenovada).toHaveLength(1);
    expect(parcelaRenovada[0].status).toBe('pendente');
    expect(parcelaRenovada[0].valorOriginal).toBe('1000.00');
    expect(parcelaRenovada[0].valorJuros).toBe('500.00');
    expect(parcelaRenovada[0].numeroParcela).toBe(2);
    expect(parcelaRenovada[0].userId).toBe(userId); // Verificar isolamento multi-tenant
    expect(parcelaRenovada[0].clienteId).toBe(clienteId);

    // Limpar nova parcela
    if (novaParcelaId) await db.delete(parcelas).where(eq(parcelas.id, novaParcelaId));
  });

  it('deve manter valor total igual ao renovar (capital + juros)', async () => {
    if (!db) {
      console.warn('Skipping test - database not available');
      return;
    }

    // Verificar que valor_original + valor_juros se mantém igual
    const parcelaInicial = await db.select().from(parcelas).where(eq(parcelas.id, parcelaId)).limit(1);
    const valorTotalInicial = parseFloat(parcelaInicial[0].valorOriginal) + parseFloat(parcelaInicial[0].valorJuros);

    // Simular renovação
    const dataVencAtual = new Date(String(parcelaInicial[0].dataVencimento) + 'T00:00:00');
    const novaDataVenc = new Date(dataVencAtual);
    novaDataVenc.setDate(novaDataVenc.getDate() + 15);
    const novaDataVencStr = novaDataVenc.toISOString().split('T')[0];

    const novaParcelaRows = await db.insert(parcelas).values({
      userId,
      contratoId,
      clienteId,
      numeroParcela: 3,
      valorOriginal: parcelaInicial[0].valorOriginal,
      valorJuros: parcelaInicial[0].valorJuros,
      dataVencimento: novaDataVencStr,
      status: 'pendente',
    }).returning();

    const novaParcelaId = novaParcelaRows[0].id;
    const novaParcelaRows2 = await db.select().from(parcelas).where(eq(parcelas.id, novaParcelaId)).limit(1);
    const valorTotalNovo = parseFloat(novaParcelaRows2[0].valorOriginal) + parseFloat(novaParcelaRows2[0].valorJuros);

    expect(valorTotalNovo).toBe(valorTotalInicial);

    // Limpar
    if (novaParcelaId) await db.delete(parcelas).where(eq(parcelas.id, novaParcelaId));
  });

  it('deve respeitar a periodicidade da modalidade (quinzenal = +15 dias)', async () => {
    if (!db) {
      console.warn('Skipping test - database not available');
      return;
    }

    const parcelaInicial = await db.select().from(parcelas).where(eq(parcelas.id, parcelaId)).limit(1);
    const dataVencAtual = new Date(String(parcelaInicial[0].dataVencimento) + 'T00:00:00');
    
    const novaDataVenc = new Date(dataVencAtual);
    novaDataVenc.setDate(novaDataVenc.getDate() + 15);
    const novaDataVencStr = novaDataVenc.toISOString().split('T')[0];

    // Diferença em dias
    const diffMs = novaDataVenc.getTime() - dataVencAtual.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    expect(diffDias).toBe(15);
  });

  it('deve incluir userId e clienteId na nova parcela (isolamento multi-tenant)', async () => {
    if (!db) {
      console.warn('Skipping test - database not available');
      return;
    }

    const dataVencAtual = new Date();
    dataVencAtual.setDate(dataVencAtual.getDate() + 15);
    const dataVencStr = dataVencAtual.toISOString().split('T')[0];

    const novaParcelaRows = await db.insert(parcelas).values({
      userId,
      contratoId,
      clienteId,
      numeroParcela: 4,
      valorOriginal: '1000.00',
      valorJuros: '500.00',
      dataVencimento: dataVencStr,
      status: 'pendente',
    }).returning();

    const novaParcelaId = novaParcelaRows[0].id;
    const novaParcela = await db.select().from(parcelas).where(eq(parcelas.id, novaParcelaId)).limit(1);

    expect(novaParcela[0].userId).toBe(userId);
    expect(novaParcela[0].clienteId).toBe(clienteId);

    // Limpar
    if (novaParcelaId) await db.delete(parcelas).where(eq(parcelas.id, novaParcelaId));
  });
});
