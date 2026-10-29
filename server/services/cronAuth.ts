import { timingSafeEqual } from "crypto";
import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_AUDIENCE = "cobrapro-online-automation-v1";
const GITHUB_REPOSITORY = "marcelinbh/COBRAPRO";
const GITHUB_WORKFLOW_REF = `${GITHUB_REPOSITORY}/.github/workflows/disparar-lembretes-whatsapp.yml@refs/heads/main`;
const githubJwks = createRemoteJWKSet(new URL(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`));

export function possuiSegredoDeAutomacaoValido(req: Request): boolean {
  const esperado = process.env.AUTOMATION_CRON_SECRET;
  const recebido = req.get("x-automation-cron-secret");
  if (!esperado || !recebido) return false;

  const esperadoBuffer = Buffer.from(esperado);
  const recebidoBuffer = Buffer.from(recebido);
  return esperadoBuffer.length === recebidoBuffer.length && timingSafeEqual(esperadoBuffer, recebidoBuffer);
}

export function claimsGithubActionsSaoAutorizadas(payload: Record<string, unknown>): boolean {
  const eventName = payload.event_name;
  return (
    payload.repository === GITHUB_REPOSITORY &&
    payload.ref === "refs/heads/main" &&
    payload.workflow_ref === GITHUB_WORKFLOW_REF &&
    (eventName === "schedule" || eventName === "workflow_dispatch")
  );
}

export async function possuiTokenGithubActionsValido(req: Request): Promise<boolean> {
  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, githubJwks, {
      issuer: GITHUB_OIDC_ISSUER,
      audience: GITHUB_OIDC_AUDIENCE,
    });
    return claimsGithubActionsSaoAutorizadas(payload as Record<string, unknown>);
  } catch {
    return false;
  }
}
