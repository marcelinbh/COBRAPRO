import { useTranslation } from 'react-i18next';
import { labelMap } from '@/lib/translate-labels';

interface TProps {
  children: string;
  className?: string;
}

/**
 * Componente T (Text Traduzido)
 * Traduz automaticamente textos em português para o idioma selecionado
 * 
 * Uso:
 * <T>Novo Cliente</T>
 * <T className="text-lg font-bold">Empréstimos</T>
 */
export function T({ children, className }: TProps) {
  const { t } = useTranslation();
  
  // Procurar a chave de tradução no mapa
  const key = labelMap[children];
  
  // Se encontrar a chave, usar t() para traduzir
  // Caso contrário, retornar o texto original
  const translatedText = key ? t(key) : children;
  
  return <span className={className}>{translatedText}</span>;
}

/**
 * Hook para traduzir um texto em qualquer contexto (não apenas JSX)
 * 
 * Uso:
 * const { translateText } = useTranslateText();
 * const translated = translateText('Novo Cliente');
 */
export function useTranslateText() {
  const { t } = useTranslation();
  
  return {
    translateText: (text: string): string => {
      const key = labelMap[text];
      return key ? t(key) : text;
    },
  };
}
