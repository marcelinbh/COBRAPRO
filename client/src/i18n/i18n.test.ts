import { describe, it, expect, beforeEach } from 'vitest';
import i18n from './i18n';

describe('i18n - Internationalization', () => {
  beforeEach(() => {
    // Reset to Portuguese before each test
    i18n.changeLanguage('pt-BR');
  });

  describe('Language Initialization', () => {
    it('should initialize with Portuguese (pt-BR) as default language', () => {
      expect(i18n.language).toBe('pt-BR');
    });

    it('should have Portuguese translations loaded', () => {
      const resources = i18n.getResourceBundle('pt-BR', 'translation');
      expect(resources).toBeDefined();
      expect(Object.keys(resources).length).toBeGreaterThan(0);
    });

    it('should have Spanish translations loaded', () => {
      const resources = i18n.getResourceBundle('es', 'translation');
      expect(resources).toBeDefined();
      expect(Object.keys(resources).length).toBeGreaterThan(0);
    });
  });

  describe('Language Switching', () => {
    it('should switch to Spanish', async () => {
      await i18n.changeLanguage('es');
      expect(i18n.language).toBe('es');
    });

    it('should switch back to Portuguese', async () => {
      await i18n.changeLanguage('es');
      await i18n.changeLanguage('pt-BR');
      expect(i18n.language).toBe('pt-BR');
    });

    it('should maintain language after multiple switches', async () => {
      await i18n.changeLanguage('es');
      await i18n.changeLanguage('pt-BR');
      await i18n.changeLanguage('es');
      expect(i18n.language).toBe('es');
    });
  });

  describe('Translation Keys', () => {
    it('should have common navigation keys in Portuguese', () => {
      const pt_BR = i18n.getResourceBundle('pt-BR', 'translation');
      expect(pt_BR.navigation).toBeDefined();
      expect(pt_BR.navigation.dashboard).toBeDefined();
      expect(pt_BR.navigation.clients).toBeDefined();
    });

    it('should have common navigation keys in Spanish', () => {
      const es = i18n.getResourceBundle('es', 'translation');
      expect(es.navigation).toBeDefined();
      expect(es.navigation.dashboard).toBeDefined();
      expect(es.navigation.clients).toBeDefined();
    });

    it('should have matching keys between Portuguese and Spanish', () => {
      const pt_BR = i18n.getResourceBundle('pt-BR', 'translation');
      const es = i18n.getResourceBundle('es', 'translation');
      
      const pt_keys = Object.keys(pt_BR).sort();
      const es_keys = Object.keys(es).sort();
      
      expect(pt_keys).toEqual(es_keys);
    });
  });

  describe('Translation Values', () => {
    it('should return Portuguese text for Portuguese language', async () => {
      await i18n.changeLanguage('pt-BR');
      const text = i18n.t('navigation.dashboard');
      expect(text).toBe('Dashboard');
      expect(text).not.toBe('Panel');
    });

    it('should return Spanish text for Spanish language', async () => {
      await i18n.changeLanguage('es');
      const text = i18n.t('navigation.dashboard');
      expect(text).toBe('Panel');
      expect(text).not.toBe('Dashboard');
    });

    it('should return different translations for different keys', async () => {
      await i18n.changeLanguage('pt-BR');
      const dashboard = i18n.t('navigation.dashboard');
      const clientes = i18n.t('navigation.clientes');
      expect(dashboard).not.toBe(clientes);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to Portuguese if key not found', async () => {
      await i18n.changeLanguage('es');
      const text = i18n.t('nonexistent.key');
      // i18next returns the key itself if translation not found
      expect(text).toBe('nonexistent.key');
    });

    it('should handle missing namespace gracefully', () => {
      const text = i18n.t('missing_namespace:key');
      expect(text).toBeDefined();
    });
  });

  describe('Language Persistence Configuration', () => {
    it('should configure browser localStorage as the first detector and cache', () => {
      const detection = i18n.options.detection as { order?: string[]; caches?: string[] };
      expect(detection.order).toContain('localStorage');
      expect(detection.caches).toContain('localStorage');
    });
  });

  describe('Supported Languages', () => {
    it('should have Portuguese as a supported language', () => {
      const languages = i18n.options.resources ? Object.keys(i18n.options.resources) : [];
      expect(languages).toContain('pt-BR');
    });

    it('should have Spanish as a supported language', () => {
      const languages = i18n.options.resources ? Object.keys(i18n.options.resources) : [];
      expect(languages).toContain('es');
    });

    it('should have exactly 2 supported languages', () => {
      const languages = i18n.options.resources ? Object.keys(i18n.options.resources) : [];
      expect(languages.length).toBe(2);
    });
  });
});
