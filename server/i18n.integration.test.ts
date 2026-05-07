import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('i18n Integration Tests', () => {
  const localesPath = path.join(process.cwd(), 'client/src/i18n/locales');

  describe('Translation Files Exist', () => {
    it('should have Portuguese translation file', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      expect(fs.existsSync(ptBRPath)).toBe(true);
    });

    it('should have Spanish translation file', () => {
      const esPath = path.join(localesPath, 'es.json');
      expect(fs.existsSync(esPath)).toBe(true);
    });
  });

  describe('Translation File Structure', () => {
    it('should have valid JSON in Portuguese file', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      const content = fs.readFileSync(ptBRPath, 'utf-8');
      const json = JSON.parse(content);
      expect(json).toBeDefined();
      expect(typeof json).toBe('object');
    });

    it('should have valid JSON in Spanish file', () => {
      const esPath = path.join(localesPath, 'es.json');
      const content = fs.readFileSync(esPath, 'utf-8');
      const json = JSON.parse(content);
      expect(json).toBeDefined();
      expect(typeof json).toBe('object');
    });
  });

  describe('Translation Keys Matching', () => {
    it('should have same top-level keys in both languages', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      const esPath = path.join(localesPath, 'es.json');
      
      const ptBR = JSON.parse(fs.readFileSync(ptBRPath, 'utf-8'));
      const es = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
      
      const ptKeys = Object.keys(ptBR).sort();
      const esKeys = Object.keys(es).sort();
      
      expect(ptKeys).toEqual(esKeys);
    });

    it('should have navigation keys in both languages', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      const esPath = path.join(localesPath, 'es.json');
      
      const ptBR = JSON.parse(fs.readFileSync(ptBRPath, 'utf-8'));
      const es = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
      
      expect(ptBR.navigation).toBeDefined();
      expect(es.navigation).toBeDefined();
    });

    it('should have dashboard key in navigation', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      const esPath = path.join(localesPath, 'es.json');
      
      const ptBR = JSON.parse(fs.readFileSync(ptBRPath, 'utf-8'));
      const es = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
      
      expect(ptBR.navigation.dashboard).toBeDefined();
      expect(es.navigation.dashboard).toBeDefined();
    });
  });

  describe('Translation Content', () => {
    it('should have Portuguese translations for common terms', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      const ptBR = JSON.parse(fs.readFileSync(ptBRPath, 'utf-8'));
      
      expect(ptBR.navigation.dashboard).toBe('Dashboard');
      expect(ptBR.clients).toBeDefined();
      expect(ptBR.loans).toBeDefined();
    });

    it('should have Spanish translations for common terms', () => {
      const esPath = path.join(localesPath, 'es.json');
      const es = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
      
      expect(es.navigation.dashboard).toBe('Panel de Control');
      expect(es.clients).toBeDefined();
      expect(es.loans).toBeDefined();
    });

    it('should have different translations between Portuguese and Spanish', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      const esPath = path.join(localesPath, 'es.json');
      
      const ptBR = JSON.parse(fs.readFileSync(ptBRPath, 'utf-8'));
      const es = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
      
      // Dashboard should be different
      expect(ptBR.navigation.dashboard).not.toBe(es.navigation.dashboard);
      
      // Loans should be different
      expect(ptBR.loans.title).not.toBe(es.loans.title);
    });
  });

  describe('i18n Configuration', () => {
    it('should have i18n.ts configuration file', () => {
      const i18nPath = path.join(process.cwd(), 'client/src/i18n/i18n.ts');
      expect(fs.existsSync(i18nPath)).toBe(true);
    });

    it('should have LanguageSwitcher component', () => {
      const componentPath = path.join(process.cwd(), 'client/src/components/LanguageSwitcher.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should have i18n imported in main.tsx', () => {
      const mainPath = path.join(process.cwd(), 'client/src/main.tsx');
      const content = fs.readFileSync(mainPath, 'utf-8');
      expect(content).toContain("import './i18n/i18n'");
    });
  });

  describe('Translation Completeness', () => {
    it('should have all navigation items translated', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      const esPath = path.join(localesPath, 'es.json');
      
      const ptBR = JSON.parse(fs.readFileSync(ptBRPath, 'utf-8'));
      const es = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
      
      const navItems = [
        'dashboard', 'meuPerfil', 'clientes', 'emprestimos', 'scores',
        'veiculos', 'vendaTelefone', 'backup', 'analiseRisco', 'contratos',
        'parcelas', 'reparcelamento', 'simulador', 'contasPagar', 'vendas',
        'cheques', 'caixa', 'calendario', 'relatorios', 'cobradores',
        'configuracoes', 'assinaturas', 'whatsapp', 'relatorioDiario',
        'inadimplencia', 'notificacoes', 'instalarApp'
      ];
      
      const navKeys = Object.keys(ptBR.navigation);
      expect(navKeys.length).toBeGreaterThan(0);
      navKeys.forEach(item => {
        expect(ptBR.navigation[item]).toBeDefined();
        expect(es.navigation[item]).toBeDefined();
      });
    });

    it('should not have empty translation values', () => {
      const ptBRPath = path.join(localesPath, 'pt-BR.json');
      const esPath = path.join(localesPath, 'es.json');
      
      const ptBR = JSON.parse(fs.readFileSync(ptBRPath, 'utf-8'));
      const es = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
      
      const checkEmpty = (obj: any) => {
        for (const key in obj) {
          if (typeof obj[key] === 'string') {
            expect(obj[key].trim().length).toBeGreaterThan(0);
          } else if (typeof obj[key] === 'object') {
            checkEmpty(obj[key]);
          }
        }
      };
      
      checkEmpty(ptBR);
      checkEmpty(es);
    });
  });
});
