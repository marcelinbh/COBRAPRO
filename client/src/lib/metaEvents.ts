/**
 * Meta Events Helper — Client-Side (Pixel Only)
 *
 * Dispara eventos via Meta Pixel (fbq) já carregado no index.html.
 * Pixel ID: 2748566625524880
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface MetaEventOptions {
  /** Dados customizados (value, currency, content_name, etc.) */
  customData?: Record<string, unknown>;
}

/**
 * Dispara um evento Meta via Pixel client-side.
 *
 * @param eventName - Nome do evento padrão: PageView, Lead, Purchase, InitiateCheckout, etc.
 * @param options   - Dados customizados
 */
export function trackMetaEvent(
  eventName: string,
  options: MetaEventOptions = {}
): void {
  const eventId = generateEventId();

  if (typeof window.fbq === "function") {
    window.fbq("track", eventName, options.customData ?? {}, { eventID: eventId });
  }
}

/** Atalho: PageView */
export const trackPageView = () => trackMetaEvent("PageView");

/** Atalho: Lead (ex: clicou em "Quero Testar") */
export const trackLead = (opts?: MetaEventOptions) => trackMetaEvent("Lead", opts);

/** Atalho: CompleteRegistration (ex: criou conta) */
export const trackCompleteRegistration = (opts?: MetaEventOptions) =>
  trackMetaEvent("CompleteRegistration", opts);

/** Atalho: Purchase (ex: assinou plano) */
export const trackPurchase = (value: number, currency = "BRL", opts?: MetaEventOptions) =>
  trackMetaEvent("Purchase", { ...opts, customData: { value, currency, ...opts?.customData } });
