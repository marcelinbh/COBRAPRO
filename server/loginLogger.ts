/**
 * loginLogger.ts
 * Captura IP, geolocalização (ip-api.com) e user-agent no momento do login
 * e salva na tabela login_logs do Supabase.
 */

import type { Request } from "express";
import { UAParser } from "ua-parser-js";
import { getSupabaseClientAsync } from "./db";

interface GeoInfo {
  ip: string;
  cidade: string | null;
  regiao: string | null;
  pais: string | null;
  pais_codigo: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
}

// Extrair IP real da requisição (suporte a proxies / Cloudflare)
function extractIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp && typeof cfIp === "string") return cfIp;

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      .split(",")[0]
      .trim();
    if (first) return first;
  }

  return req.socket?.remoteAddress || req.ip || "unknown";
}

// Consultar ip-api.com para geolocalização (gratuito, sem API key)
async function fetchGeoInfo(ip: string): Promise<GeoInfo> {
  const fallback: GeoInfo = {
    ip,
    cidade: null,
    regiao: null,
    pais: null,
    pais_codigo: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: null,
  };

  // IPs locais / privados não têm geolocalização
  if (
    ip === "unknown" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.")
  ) {
    return { ...fallback, ip };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return fallback;

    const data = (await res.json()) as Record<string, unknown>;
    if (data.status !== "success") return fallback;

    return {
      ip,
      cidade: (data.city as string) || null,
      regiao: (data.regionName as string) || null,
      pais: (data.country as string) || null,
      pais_codigo: (data.countryCode as string) || null,
      latitude: typeof data.lat === "number" ? data.lat : null,
      longitude: typeof data.lon === "number" ? data.lon : null,
      timezone: (data.timezone as string) || null,
      isp: (data.isp as string) || null,
    };
  } catch {
    return fallback;
  }
}

// Parsear user-agent para dispositivo, navegador e OS
function parseUserAgent(ua: string): {
  dispositivo: string;
  navegador: string;
  os: string;
} {
  try {
    const parser = new UAParser(ua);
    const result = parser.getResult();

    const dispositivo =
      result.device.type === "mobile"
        ? "Mobile"
        : result.device.type === "tablet"
        ? "Tablet"
        : "Desktop";

    const navegador = result.browser.name
      ? `${result.browser.name} ${result.browser.version ?? ""}`.trim()
      : "Desconhecido";

    const os = result.os.name
      ? `${result.os.name} ${result.os.version ?? ""}`.trim()
      : "Desconhecido";

    return { dispositivo, navegador, os };
  } catch {
    return { dispositivo: "Desconhecido", navegador: "Desconhecido", os: "Desconhecido" };
  }
}

/**
 * Registrar log de login (chamada assíncrona não-bloqueante)
 */
export async function registrarLoginLog(
  userId: number,
  req: Request,
  sucesso: boolean = true
): Promise<void> {
  try {
    const ip = extractIp(req);
    const userAgent = (req.headers["user-agent"] as string) || "";
    const { dispositivo, navegador, os } = parseUserAgent(userAgent);
    const geo = await fetchGeoInfo(ip);

    const supabase = await getSupabaseClientAsync();
    if (!supabase) {
      console.warn("[LoginLogger] Supabase indisponível, log não registrado");
      return;
    }

    const { error } = await supabase.from("login_logs").insert({
      user_id: userId,
      ip: geo.ip,
      cidade: geo.cidade,
      regiao: geo.regiao,
      pais: geo.pais,
      pais_codigo: geo.pais_codigo,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone,
      isp: geo.isp,
      user_agent: userAgent,
      dispositivo,
      navegador,
      os,
      sucesso,
    });

    if (error) {
      console.warn("[LoginLogger] Erro ao inserir log:", error.message);
    } else {
      console.log(`[LoginLogger] Login registrado: user_id=${userId} ip=${ip} ${geo.cidade ?? ""}/${geo.pais_codigo ?? ""} ${dispositivo}`);
    }
  } catch (err) {
    // Nunca deixar o log quebrar o fluxo de login
    console.warn("[LoginLogger] Erro inesperado:", err);
  }
}
