// Utilitário para obter o locale correto baseado no idioma do i18n
export function getLocale(language: string): string {
  return language === 'es' ? 'es-ES' : 'pt-BR';
}

// Formatar data com locale dinâmico
export function formatDate(date: Date | string | number, language: string, options?: Intl.DateTimeFormatOptions): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(getLocale(language), options);
}

// Formatar data e hora com locale dinâmico
export function formatDateTime(date: Date | string | number, language: string, options?: Intl.DateTimeFormatOptions): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString(getLocale(language), options);
}

// Formatar moeda - sempre BRL mas com locale dinâmico
export function formatCurrency(value: number, language: string): string {
  return value.toLocaleString(getLocale(language), { style: 'currency', currency: 'BRL' });
}

// Formatar número com locale dinâmico
export function formatNumber(value: number, language: string, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(getLocale(language), options);
}
