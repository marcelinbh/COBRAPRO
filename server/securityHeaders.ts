import type { RequestHandler } from "express";

const CSP_BASELINE = "base-uri 'self'; object-src 'none'; frame-ancestors 'none'";

function usaHttps(req: { secure?: boolean; headers?: Record<string, unknown> }): boolean {
  if (req.secure) return true;
  const forwarded = req.headers?.["x-forwarded-proto"];
  return typeof forwarded === "string" && forwarded.split(",")[0]?.trim() === "https";
}

/** Cabeçalhos que reduzem superfície de XSS, clickjacking e MIME sniffing. */
export const cabecalhosSeguranca: RequestHandler = (req, res, next) => {
  res.setHeader("Content-Security-Policy", CSP_BASELINE);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (usaHttps(req)) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
};
