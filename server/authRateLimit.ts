import crypto from "crypto";
import type { Request } from "express";

type Janela = { tentativas: number; expiraEm: number };

export type ResultadoLimite = { permitido: boolean; aguardarSegundos: number };

/**
 * Limitador de janela fixa, propositalmente pequeno e sem dependência externa.
 * Ele protege os endpoints públicos mesmo se o banco estiver indisponível e não
 * armazena e-mails/IPs em claro: a chave em memória é uma hash descartável.
 */
export class LimitadorDeTentativas {
  private readonly janelas = new Map<string, Janela>();

  constructor(private readonly agora: () => number = () => Date.now()) {}

  consumir(chave: string, limite: number, janelaMs: number): ResultadoLimite {
    const agora = this.agora();
    const atual = this.janelas.get(chave);
    if (!atual || atual.expiraEm <= agora) {
      this.janelas.set(chave, { tentativas: 1, expiraEm: agora + janelaMs });
      return { permitido: true, aguardarSegundos: 0 };
    }
    if (atual.tentativas >= limite) {
      return { permitido: false, aguardarSegundos: Math.max(1, Math.ceil((atual.expiraEm - agora) / 1000)) };
    }
    atual.tentativas += 1;
    return { permitido: true, aguardarSegundos: 0 };
  }

  remover(chave: string): void {
    this.janelas.delete(chave);
  }
}

function enderecoDaRequisicao(req: Request): string {
  const cf = req.header("cf-connecting-ip");
  if (cf && cf.length <= 64) return cf.trim();
  // Só usa X-Forwarded-For como compatibilidade com o proxy da plataforma.
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && forwarded.length <= 64) return forwarded;
  return req.socket.remoteAddress ?? "unknown";
}

export function chaveDeLimitacao(req: Request, finalidade: "login" | "reset", email: string): string {
  const material = `${finalidade}|${enderecoDaRequisicao(req)}|${email.trim().toLowerCase()}`;
  return crypto.createHash("sha256").update(material).digest("hex");
}
