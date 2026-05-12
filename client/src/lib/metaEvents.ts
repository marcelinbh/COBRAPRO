/**
 * Meta Events Helper — Client-Side
 *
 * Dispara eventos em paralelo para:
 * 1. Meta Pixel (fbq) — client-side, já carregado no index.html
 * 2. API de Conversões (CAPI) — via endpoint server-side /api/meta/event
 *
 * A deduplicação é feita pelo event_id único enviado para ambos.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match?.[2];
}

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface MetaEventOptions {
  /** Dados customizados (value, currency, content_name, etc.) */
  customData?: Record<string, unknown>;
  /** E-mail do usuário para matching (será hasheado server-side) */
  userEmail?: string;
  /** Telefone do usuário para matching (será hasheado server-side) */
  userPhone?: string;
}

/**
 * Dispara um evento Meta em paralelo: Pixel (client) + CAPI (server).
 *
 * @param eventName - Nome do evento padrão: PageView, Lead, Purchase, CompleteRegistration, etc.
 * @param options   - Dados customizados e informações do usuário
 */
export async function trackMetaEvent(
  eventName: string,
  options: MetaEventOptions = {}
): Promise<void> {
  const eventId = generateEventId();
  const eventSourceUrl = window.location.href;

  // 1. Pixel client-side (fbq)
  if (typeof window.fbq === "function") {
    window.fbq("track", eventName, options.customData ?? {}, { eventID: eventId });
  }

  // 2. CAPI server-side (via endpoint /api/meta/event)
  try {
    await fetch("/api/meta/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        event_source_url: eventSourceUrl,
        custom_data: options.customData,
        user_email: options.userEmail,
        user_phone: options.userPhone,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
      }),
    });
  } catch (err) {
    // Silencioso — não deve quebrar a UX
    console.warn("[MetaEvents] Falha ao enviar CAPI:", err);
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
