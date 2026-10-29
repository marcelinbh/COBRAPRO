import crypto from "node:crypto";
import type { Request } from "express";
import { UAParser } from "ua-parser-js";
import { getSupabaseClientAsync } from "./db";

/**
 * Logs de acesso servem para auditoria operacional, não para rastrear a pessoa.
 * Não enviamos IP a um terceiro nem persistimos IP bruto, geolocalização exata
 * ou user-agent completo. O identificador curto permite correlacionar tentativas
 * recorrentes somente enquanto o segredo da aplicação permanecer inalterado.
 */
export function pseudonimizarIp(ip: string, secret = process.env.JWT_SECRET ?? ""): string | null {
  if (!ip || ip === "unknown" || !secret) return null;
  return crypto.createHmac("sha256", secret).update(ip).digest("hex").slice(0, 24);
}

function extractIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp && typeof cfIp === "string") return cfIp;

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}

function parseUserAgent(ua: string): { dispositivo: string; navegador: string; os: string } {
  try {
    const result = new UAParser(ua).getResult();
    const dispositivo = result.device.type === "mobile" ? "Mobile"
      : result.device.type === "tablet" ? "Tablet" : "Desktop";
    const navegador = result.browser.name ?? "Desconhecido";
    const os = result.os.name ?? "Desconhecido";
    return { dispositivo, navegador, os };
  } catch {
    return { dispositivo: "Desconhecido", navegador: "Desconhecido", os: "Desconhecido" };
  }
}

/** Registrar log mínimo e não bloqueante de login. */
export async function registrarLoginLog(userId: number, req: Request, sucesso = true): Promise<void> {
  try {
    const userAgent = (req.headers["user-agent"] as string) || "";
    const { dispositivo, navegador, os } = parseUserAgent(userAgent);
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return;

    const { error } = await supabase.from("login_logs").insert({
      user_id: userId,
      ip: pseudonimizarIp(extractIp(req)),
      cidade: null,
      regiao: null,
      pais: null,
      pais_codigo: null,
      latitude: null,
      longitude: null,
      timezone: null,
      isp: null,
      user_agent: null,
      dispositivo,
      navegador,
      os,
      sucesso,
    });
    if (error) console.warn("[LoginLogger] Não foi possível gravar o log de login.", error.message);
  } catch {
    // A auditoria nunca deve quebrar o fluxo de login.
  }
}
