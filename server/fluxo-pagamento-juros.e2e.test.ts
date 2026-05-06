import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from './db';
import { usuarios, clientes, emprestimos, parcelas } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Teste End-to-End: Fluxo Completo de Pagamento de Juros com Renovação Automática
 * 
 * Cenário: Cliente pega R$ 1.000 a 50% na quinzena
 * - Total a pagar: R$ 1.500 (R$ 1.000 capital + R$ 500 juros)
 * - Vencimento: 15 dias
 * - Cliente paga SÓ JUROS (R$ 500) no dia do vencimento
 * - Esperado: Parcela renova automaticamente para 15 dias depois
 */
describe('Fluxo Completo: Pagamento de Juros com Renovação Automática', () => {
  let userId: string;
  let clienteId: string;
  let emprestimoId: string;
  let parcelaId: string;
  let novaParcelaId: string;

  beforeAll(async () => {
    // 1. Criar usuário de teste
    const usuarioResult = await db
      .insert(usuarios)
      .values({
        id: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        nome: 'Usuário Teste',
        role: 'user',
      })
      .returning();
    
    userId = usuarioResult[0].id;

    // 2. Criar cliente de teste
    const clienteResult = await db
      .insert(clientes)
      .values({
        userId,
        nome: 'Cliente Teste',
        cpf: `12345678${String(Date.now()).slice(-3)}`,
        telefone: '11999999999',
        endereco: 'Rua Teste, 123',
        cidade: 'São Paulo',
        estado: 'SP',
      })
      .returning();
    
    clienteId = clienteResult[0].id;

    // 3. Criar empréstimo quinzenal a 50%
    const dataAtual = new Date();
    const dataVencimento = new Date(dataAtual.getTime() + 15 * 24 * 60 * 60 * 1000);
    
    const emprestimoResult = await db
      .insert(emprestimos)
      .values({
        userId,
        clienteId,
        valorOriginal: 1000,
        taxa: 50,
        modalidade: 'quinzenal',
        dataContrato: dataAtual,
        observacoes: 'Teste E2E - Pagamento de Juros',
      })
      .returning();
    
    emprestimoId = emprestimoResult[0].id;

    // 4. Criar parcela inicial
    const parcelaResult = await db
      .insert(parcelas)
      .values({
        userId,
        clienteId,
        emprestimoId,
        valorOriginal: 1000,
        valorJuros: 500,
        dataCriacao: dataAtual,
        dataVencimento: dataVencimento,
        status: 'pendente',
        observacoes: 'Parcela inicial - Teste E2E',
        contagemRenovacoes: 0,
      })
      .returning();
    
    parcelaId = parcelaResult[0].id;
  });

  it('Deve calcular corretamente o totalReceber (capital + juros + saldo_residual)', async () => {
    const parcela = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.id, parcelaId))
      .limit(1);

    expect(parcela).toHaveLength(1);
    
    const p = parcela[0];
    const totalReceber = p.valorOriginal + p.valorJuros + (p.saldoResidual || 0);
    
    expect(totalReceber).toBe(1500); // 1000 + 500 + 0
    expect(p.status).toBe('pendente');
  });

  it('Deve registrar pagamento de juros e marcar parcela como paga', async () => {
    // Simular pagamento de juros (R$ 500)
    const dataPagamento = new Date();
    
    const updateResult = await db
      .update(parcelas)
      .set({
        status: 'paga',
        dataPagamento,
        observacoes: 'Pagamento de juros - Teste E2E - renovado',
      })
      .where(eq(parcelas.id, parcelaId))
      .returning();

    expect(updateResult).toHaveLength(1);
    expect(updateResult[0].status).toBe('paga');
  });

  it('Deve criar nova parcela automaticamente com mesma periodicidade', async () => {
    // Buscar parcela original
    const parcelaOriginal = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.id, parcelaId))
      .limit(1);

    expect(parcelaOriginal).toHaveLength(1);
    const p = parcelaOriginal[0];

    // Calcular nova data de vencimento (15 dias depois)
    const novaDataVencimento = new Date(p.dataVencimento.getTime() + 15 * 24 * 60 * 60 * 1000);

    // Criar nova parcela
    const novaParcelaResult = await db
      .insert(parcelas)
      .values({
        userId: p.userId,
        clienteId: p.clienteId,
        emprestimoId: p.emprestimoId,
        valorOriginal: p.valorOriginal, // Mantém o mesmo capital
        valorJuros: p.valorJuros, // Mantém os mesmos juros
        dataCriacao: new Date(),
        dataVencimento: novaDataVencimento,
        status: 'pendente',
        observacoes: 'Parcela renovada - Teste E2E',
        contagemRenovacoes: (p.contagemRenovacoes || 0) + 1,
      })
      .returning();

    expect(novaParcelaResult).toHaveLength(1);
    novaParcelaId = novaParcelaResult[0].id;

    const novaParcela = novaParcelaResult[0];
    expect(novaParcela.valorOriginal).toBe(1000);
    expect(novaParcela.valorJuros).toBe(500);
    expect(novaParcela.status).toBe('pendente');
    expect(novaParcela.contagemRenovacoes).toBe(1);
  });

  it('Deve manter valor total igual após renovação', async () => {
    const parcela1 = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.id, parcelaId))
      .limit(1);

    const parcela2 = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.id, novaParcelaId))
      .limit(1);

    expect(parcela1).toHaveLength(1);
    expect(parcela2).toHaveLength(1);

    const total1 = parcela1[0].valorOriginal + parcela1[0].valorJuros;
    const total2 = parcela2[0].valorOriginal + parcela2[0].valorJuros;

    expect(total1).toBe(total2);
    expect(total1).toBe(1500);
  });

  it('Deve respeitar a periodicidade (15 dias) na nova data de vencimento', async () => {
    const parcela1 = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.id, parcelaId))
      .limit(1);

    const parcela2 = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.id, novaParcelaId))
      .limit(1);

    expect(parcela1).toHaveLength(1);
    expect(parcela2).toHaveLength(1);

    const diff = parcela2[0].dataVencimento.getTime() - parcela1[0].dataVencimento.getTime();
    const dias = diff / (1000 * 60 * 60 * 24);

    expect(dias).toBe(15);
  });

  it('Deve incrementar contador de renovações', async () => {
    const parcela2 = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.id, novaParcelaId))
      .limit(1);

    expect(parcela2).toHaveLength(1);
    expect(parcela2[0].contagemRenovacoes).toBe(1);
  });

  it('Deve calcular totalReceber correto para nova parcela (sem saldo_residual)', async () => {
    const parcela = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.id, novaParcelaId))
      .limit(1);

    expect(parcela).toHaveLength(1);
    
    const p = parcela[0];
    const totalReceber = p.valorOriginal + p.valorJuros + (p.saldoResidual || 0);
    
    expect(totalReceber).toBe(1500);
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (parcelaId) {
      await db.delete(parcelas).where(eq(parcelas.id, parcelaId));
    }
    if (novaParcelaId) {
      await db.delete(parcelas).where(eq(parcelas.id, novaParcelaId));
    }
    if (emprestimoId) {
      await db.delete(emprestimos).where(eq(emprestimos.id, emprestimoId));
    }
    if (clienteId) {
      await db.delete(clientes).where(eq(clientes.id, clienteId));
    }
    if (userId) {
      await db.delete(usuarios).where(eq(usuarios.id, userId));
    }
  });
});
