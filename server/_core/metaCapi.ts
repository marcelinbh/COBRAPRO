/**
 * Meta Conversions API (CAPI) — Server-Side Helper
 *
 * Envia eventos diretamente do servidor para o Meta, garantindo rastreamento
 * mesmo com iOS 14+, bloqueadores de anúncio e navegação privada.
 *
 * Documentação: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { ENV } from "./env";

const PIXEL_ID = ENV.facebookPixelId;
const CAPI_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

export interface MetaUserData {
  /** IP do cliente (IPv4 ou IPv6) */
  client_ip_address?: string;
  /** User-Agent do navegador */
  client_user_agent?: string;
  /** E-mail em SHA-256 (lowercase, sem espaços) */
  em?: string;
  /** Telefone em SHA-256 (formato E.164 sem +) */
  ph?: string;
  /** fbp cookie (_fbp) */
  fbp?: string;
  /** fbc cookie (_fbc) */
  fbc?: string;
}

export interface MetaEventData {
  /** Nome do evento padrão: PageView, Lead, Purchase, CompleteRegistration, etc. */
  event_name: string;
  /** Unix timestamp em segundos */
  event_time?: number;
  /** URL da página onde o evento ocorreu */
  event_source_url?: string;
  /** ID único do evento para deduplicação com o Pixel client-side */
  event_id?: string;
  /** Dados do usuário para matching */
  user_data?: MetaUserData;
  /** Dados customizados do evento (valor, moeda, etc.) */
  custom_data?: Record<string, unknown>;
}

/**
 * Envia um ou mais eventos para a API de Conversões do Meta.
 * Retorna true em caso de sucesso, false em caso de falha (não lança exceção).
 */
export async function sendMetaEvent(events: MetaEventData[]): Promise<boolean> {
  const token = ENV.facebookCapiToken;
  if (!token) {
    console.warn("[MetaCAPI] FACEBOOK_CAPI_TOKEN não configurado — evento ignorado.");
    return false;
  }

  const payload = {
    data: events.map((ev) => ({
      event_name: ev.event_name,
      event_time: ev.event_time ?? Math.floor(Date.now() / 1000),
      event_source_url: ev.event_source_url,
      event_id: ev.event_id,
      action_source: "website",
      user_data: ev.user_data ?? {},
      custom_data: ev.custom_data,
    })),
    // test_event_code: "TEST12345", // Descomente para testar no Gerenciador de Eventos
  };

  try {
    const res = await fetch(`${CAPI_URL}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[MetaCAPI] Erro HTTP ${res.status}:`, body);
      return false;
    }

    const json = await res.json() as { events_received?: number };
    console.log(`[MetaCAPI] Eventos enviados: ${json.events_received ?? "?"}`);
    return true;
  } catch (err) {
    console.error("[MetaCAPI] Falha ao enviar evento:", err);
    return false;
  }
}

/**
 * Utilitário: hash SHA-256 de uma string (para e-mail e telefone).
 * Uso: await hashSha256("email@exemplo.com")
 */
export async function hashSha256(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
