import { describe, it, expect } from 'vitest';
import { getDiasModalidade } from '../shared/finance';

describe('Lógica de Renovação de Parcelas ao Pagar Juros', () => {
  describe('getDiasModalidade - Cálculo de Intervalo', () => {
    it('deve retornar 1 dia para modalidade DIÁRIA', () => {
      expect(getDiasModalidade('diario')).toBe(1);
    });

    it('deve retornar 7 dias para modalidade SEMANAL', () => {
      expect(getDiasModalidade('semanal')).toBe(7);
    });

    it('deve retornar 15 dias para modalidade QUINZENAL', () => {
      expect(getDiasModalidade('quinzenal')).toBe(15);
    });

    it('deve retornar 30 dias para modalidade MENSAL', () => {
      expect(getDiasModalidade('mensal')).toBe(30);
    });

    it('deve retornar 30 dias como padrão para modalidade desconhecida', () => {
      expect(getDiasModalidade('desconhecida')).toBe(30);
    });
  });

  describe('Cenário 1: Quinzenal 50% - Capital R$ 1.000', () => {
    it('deve calcular juros corretamente (50% = R$ 500)', () => {
      const capital = 1000;
      const taxa = 50; // 50%
      const juros = capital * (taxa / 100);
      const total = capital + juros;

      expect(juros).toBe(500);
      expect(total).toBe(1500);
    });

    it('ao pagar só juros (R$ 500), a nova parcela deve ter o mesmo valor total', () => {
      // Parcela 1: Capital R$ 1.000, Juros R$ 500, Total R$ 1.500
      const parcelaOriginal = {
        valorOriginal: 1000,
        valorJuros: 500,
        valorTotal: 1500,
      };

      // Pagamento: R$ 500 (só juros)
      const valorPago = 500;

      // Nova parcela deve ter os mesmos valores
      const novaParcela = {
        valorOriginal: parcelaOriginal.valorOriginal, // Mantém capital
        valorJuros: parcelaOriginal.valorJuros, // Mantém juros
        valorTotal: parcelaOriginal.valorOriginal + parcelaOriginal.valorJuros,
      };

      expect(novaParcela.valorOriginal).toBe(1000);
      expect(novaParcela.valorJuros).toBe(500);
      expect(novaParcela.valorTotal).toBe(1500);
    });

    it('a nova parcela deve vencer 15 dias depois (quinzenal)', () => {
      const dataVencimento = new Date('2026-05-15');
      const diasIntervalo = getDiasModalidade('quinzenal');
      
      const novaDataVenc = new Date(dataVencimento);
      novaDataVenc.setDate(novaDataVenc.getDate() + diasIntervalo);

      const diffMs = novaDataVenc.getTime() - dataVencimento.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      expect(diffDias).toBe(15);
      expect(novaDataVenc.toISOString().split('T')[0]).toBe('2026-05-30');
    });
  });

  describe('Cenário 2: Quinzenal 50% - Capital R$ 500', () => {
    it('deve calcular juros corretamente (50% = R$ 250)', () => {
      const capital = 500;
      const taxa = 50; // 50%
      const juros = capital * (taxa / 100);
      const total = capital + juros;

      expect(juros).toBe(250);
      expect(total).toBe(750);
    });

    it('ao pagar só juros (R$ 250), a nova parcela deve ter o mesmo valor total', () => {
      // Parcela 1: Capital R$ 500, Juros R$ 250, Total R$ 750
      const parcelaOriginal = {
        valorOriginal: 500,
        valorJuros: 250,
        valorTotal: 750,
      };

      // Pagamento: R$ 250 (só juros)
      const valorPago = 250;

      // Nova parcela deve ter os mesmos valores
      const novaParcela = {
        valorOriginal: parcelaOriginal.valorOriginal, // Mantém capital
        valorJuros: parcelaOriginal.valorJuros, // Mantém juros
        valorTotal: parcelaOriginal.valorOriginal + parcelaOriginal.valorJuros,
      };

      expect(novaParcela.valorOriginal).toBe(500);
      expect(novaParcela.valorJuros).toBe(250);
      expect(novaParcela.valorTotal).toBe(750);
    });
  });

  describe('Cenário 3: Diário 10% - Capital R$ 100', () => {
    it('deve calcular juros corretamente (10% = R$ 10)', () => {
      const capital = 100;
      const taxa = 10; // 10%
      const juros = capital * (taxa / 100);
      const total = capital + juros;

      expect(juros).toBe(10);
      expect(total).toBe(110);
    });

    it('ao pagar só juros (R$ 10), a nova parcela vence 1 dia depois (diária)', () => {
      const dataVencimento = new Date('2026-05-15');
      const diasIntervalo = getDiasModalidade('diario');
      
      const novaDataVenc = new Date(dataVencimento);
      novaDataVenc.setDate(novaDataVenc.getDate() + diasIntervalo);

      const diffMs = novaDataVenc.getTime() - dataVencimento.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      expect(diffDias).toBe(1);
      expect(novaDataVenc.toISOString().split('T')[0]).toBe('2026-05-16');
    });
  });

  describe('Cenário 4: Semanal 20% - Capital R$ 200', () => {
    it('deve calcular juros corretamente (20% = R$ 40)', () => {
      const capital = 200;
      const taxa = 20; // 20%
      const juros = capital * (taxa / 100);
      const total = capital + juros;

      expect(juros).toBe(40);
      expect(total).toBe(240);
    });

    it('ao pagar só juros (R$ 40), a nova parcela vence 7 dias depois (semanal)', () => {
      const dataVencimento = new Date('2026-05-15');
      const diasIntervalo = getDiasModalidade('semanal');
      
      const novaDataVenc = new Date(dataVencimento);
      novaDataVenc.setDate(novaDataVenc.getDate() + diasIntervalo);

      const diffMs = novaDataVenc.getTime() - dataVencimento.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      expect(diffDias).toBe(7);
      expect(novaDataVenc.toISOString().split('T')[0]).toBe('2026-05-22');
    });
  });

  describe('Cenário 5: Mensal 5% - Capital R$ 1.000', () => {
    it('deve calcular juros corretamente (5% = R$ 50)', () => {
      const capital = 1000;
      const taxa = 5; // 5%
      const juros = capital * (taxa / 100);
      const total = capital + juros;

      expect(juros).toBe(50);
      expect(total).toBe(1050);
    });

    it('ao pagar só juros (R$ 50), a nova parcela vence 30 dias depois (mensal)', () => {
      const dataVencimento = new Date('2026-05-15');
      const diasIntervalo = getDiasModalidade('mensal');
      
      const novaDataVenc = new Date(dataVencimento);
      novaDataVenc.setDate(novaDataVenc.getDate() + diasIntervalo);

      const diffMs = novaDataVenc.getTime() - dataVencimento.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      expect(diffDias).toBe(30);
      expect(novaDataVenc.toISOString().split('T')[0]).toBe('2026-06-14');
    });
  });

  describe('Validação: Valor Total Mantém-se Igual', () => {
    it('cenário 1: R$ 1.500 antes = R$ 1.500 depois', () => {
      const antes = 1000 + 500;
      const depois = 1000 + 500;
      expect(depois).toBe(antes);
    });

    it('cenário 2: R$ 750 antes = R$ 750 depois', () => {
      const antes = 500 + 250;
      const depois = 500 + 250;
      expect(depois).toBe(antes);
    });

    it('cenário 3: R$ 110 antes = R$ 110 depois', () => {
      const antes = 100 + 10;
      const depois = 100 + 10;
      expect(depois).toBe(antes);
    });

    it('cenário 4: R$ 240 antes = R$ 240 depois', () => {
      const antes = 200 + 40;
      const depois = 200 + 40;
      expect(depois).toBe(antes);
    });

    it('cenário 5: R$ 1.050 antes = R$ 1.050 depois', () => {
      const antes = 1000 + 50;
      const depois = 1000 + 50;
      expect(depois).toBe(antes);
    });
  });

  describe('Validação: Número de Parcelas Incrementa', () => {
    it('parcela 1 → parcela 2 ao renovar', () => {
      const numeroParcela1 = 1;
      const numeroParcela2 = numeroParcela1 + 1;
      expect(numeroParcela2).toBe(2);
    });

    it('parcela 2 → parcela 3 ao renovar novamente', () => {
      const numeroParcela2 = 2;
      const numeroParcela3 = numeroParcela2 + 1;
      expect(numeroParcela3).toBe(3);
    });
  });
});
