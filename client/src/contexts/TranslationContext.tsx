import React, { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { labelMap } from '@/lib/translate-labels';

interface TranslationContextType {
  t: (text: string) => string;
  translateLabel: (label: string) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const { t: i18nT, i18n } = useTranslation();

  const value = useMemo<TranslationContextType>(() => ({
    t: (text: string) => {
      // Se o texto está no mapa de tradução, usar a chave
      const key = labelMap[text];
      if (key) {
        return i18nT(key);
      }
      // Caso contrário, tentar traduzir diretamente
      return i18nT(text);
    },
    translateLabel: (label: string) => {
      const key = labelMap[label];
      if (key) {
        return i18nT(key);
      }
      return label;
    },
  }), [i18nT, i18n.language]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslationContext() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslationContext deve ser usado dentro de TranslationProvider');
  }
  return context;
}
