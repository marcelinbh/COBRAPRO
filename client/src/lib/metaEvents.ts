/**
 * Meta Events Helper — Pixel Client-Side Only
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
  customData?: Record<string, unknown>;
}

export function trackMetaEvent(eventName: string, options: MetaEventOptions = {}): void {
  const eventId = generateEventId();
  if (typeof window.fbq === "function") {
    window.fbq("track", eventName, options.customData ?? {}, { eventID: eventId });
  }
}

export const trackPageView = () => trackMetaEvent("PageView");
export const trackLead = (opts?: MetaEventOptions) => trackMetaEvent("Lead", opts);
export const trackCompleteRegistration = (opts?: MetaEventOptions) => trackMetaEvent("CompleteRegistration", opts);
export const trackPurchase = (value: number, currency = "BRL", opts?: MetaEventOptions) =>
  trackMetaEvent("Purchase", { ...opts, customData: { value, currency, ...opts?.customData } });
