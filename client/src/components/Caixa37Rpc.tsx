import { useEffect, useRef, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";
import type { AppRouter } from "../../../server/routers";
import {
  copiarJsonCaixa37,
  normalizarDescricao37,
  normalizarCotacao37,
  normalizarResultado37,
  normalizarRecovery37,
  request37Schema,
  congelarRecovery37,
  type Acao37,
  type CotarCaixa37Input,
  type Request37,
  type Cotacao37,
  type Result37,
  type Recovery37Input,
  type Recovery37Result,
} from "../../../shared/caixa37";

// Contrato local v1 congelado. O router tipado é integrado pelo responsável;
// nenhuma RPC ausente autoriza outro writer, retry ou transformação de ação.
export const caixa37Rpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, { ...init, credentials: "include" });
      },
    }),
  ],
}).caixa;
export type {
  Acao37,
  Request37,
  Cotacao37,
  Result37,
} from "../../../shared/caixa37";
export type Recovery37 = Recovery37Result;
export type RecoveryInput37 = Recovery37Input;
export type Form37 = Pick<
  Request37,
  "acao" | "contaOrigemId" | "contaDestinoId" | "valor" | "descricao"
>;
export const CAIXA37_RESPONSE_TIMEOUT_MS = 30000;
/** Prazo apenas da espera UI, nunca cancelamento de dinheiro. A primeira RPC pode
 * confirmar depois; sua resposta tardia não fecha a intenção. Recovery usa a
 * barreira autoritativa com o request original e é o único próximo envio permitido. */
export async function respostaCaixa37<T>(response: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      response,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error("Tempo de resposta esgotado; execução permanece ambígua")
            ),
          CAIXA37_RESPONSE_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
const id = z.number().int().positive().max(2147483647);
const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
export const capacidade37Schema = z.preprocess(
  copiarJsonCaixa37,
  z
    .object({
      disponivel: z.boolean(),
      regra: z.literal("caixa37_v1"),
      aporte: z.boolean(),
      transferencia: z.boolean(),
      recovery: z.boolean(),
    })
    .strict()
    .refine(v =>
      v.disponivel
        ? v.aporte && v.transferencia && v.recovery
        : !v.aporte && !v.transferencia && !v.recovery
    )
);
const savedSchema = z.preprocess(
  copiarJsonCaixa37,
  z
    .object({
      versao: z.literal(1),
      userId: id,
      idempotencyKey: uuid,
      request: request37Schema,
      confirmacao: z.unknown().optional(),
    })
    .strict()
);
export type Intencao37 = RecoveryInput37 & {
  versao: 1;
  userId: number;
  confirmacao?: Result37;
};
export function dinheiro37(v: string): string {
  if (!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(v))
    throw Error(
      "Informe valor positivo com até dois centavos, usando ponto, sem arredondamento."
    );
  const [whole, fraction = ""] = v.split(".");
  const canonical = `${whole}.${fraction.padEnd(2, "0")}`;
  if (canonical === "0.00") throw Error("O valor deve ser maior que zero.");
  return canonical;
}
export const descricao37 = normalizarDescricao37;
export function inputCotacao37(f: Form37): CotarCaixa37Input {
  const common = {
    contaDestinoId: f.contaDestinoId,
    valor: f.valor,
    ...(f.descricao === null ? {} : { descricao: f.descricao }),
  };
  if (f.acao === "aporte") return { acao: "aporte", ...common };
  if (f.contaOrigemId === null) throw Error("Selecione a conta de origem.");
  return { acao: "transferir", contaOrigemId: f.contaOrigemId, ...common };
}
export function validarCotacao37(value: unknown, expected: Form37): Cotacao37 {
  return normalizarCotacao37(value, inputCotacao37(expected));
}
export function validarResultado37(
  value: unknown,
  intent: RecoveryInput37
): Result37 {
  return normalizarResultado37(value, {
    idempotencyKey: intent.idempotencyKey,
    request: intent.request,
  });
}
export function validarRecovery37(
  value: unknown,
  userId: number,
  intent: RecoveryInput37
): Recovery37 {
  return normalizarRecovery37(value, userId, {
    idempotencyKey: intent.idempotencyKey,
    request: intent.request,
  });
}
export function qRequest(q: Cotacao37): Request37 {
  return Object.freeze(
    request37Schema.parse({
      acao: q.acao,
      contaOrigemId: q.contaOrigemId,
      contaDestinoId: q.contaDestinoId,
      valor: q.valor,
      descricao: q.descricao,
      dataTransacao: q.dataTransacao,
      estadoHash: q.estadoHash,
    })
  );
}
export function chaveCaixa37(userId: number | undefined, action: Acao37) {
  return id.safeParse(userId).success
    ? `cobrapro:caixa37:v1:${userId}:${action}`
    : "";
}
export async function executarCaixa37(intent: RecoveryInput37) {
  const r = intent.request;
  const common = {
    contaDestinoId: r.contaDestinoId,
    valor: r.valor,
    dataTransacao: r.dataTransacao,
    estadoHash: r.estadoHash,
    idempotencyKey: intent.idempotencyKey,
    ...(r.descricao === null ? {} : { descricao: r.descricao }),
  };
  if (r.acao === "aporte") return caixa37Rpc.aportar37.mutate(common);
  if (r.contaOrigemId === null) throw Error("Origem da transferência ausente.");
  return caixa37Rpc.transferir37.mutate({
    ...common,
    contaOrigemId: r.contaOrigemId,
  });
}
type Generation = { key: string; contexto: string; ativa: boolean };
export function useIntencaoCaixa37(
  userId: number | undefined,
  action: Acao37,
  onConfirmed: (result: Result37) => void,
  contexto = ""
) {
  const key = chaveCaixa37(userId, action),
    current = useRef<Generation>({ key, contexto, ativa: false });
  if (current.current.key !== key || current.current.contexto !== contexto) {
    current.current.ativa = false;
    current.current = { key, contexto, ativa: false };
  }
  const generation = current.current,
    cb = useRef(onConfirmed);
  cb.current = onConfirmed;
  const saved = useRef<Intencao37 | null>(null),
    disk = useRef<string | null>(null),
    flight = useRef(false);
  const blocked = useRef(false),
    evidence = useRef<Recovery37 | null>(null);
  const [ready, setReady] = useState<Generation>(),
    [pending, setPending] = useState<Intencao37 | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recovery, setRecovery] = useState<Recovery37 | null>(null);
  const atual = () =>
    !!key &&
    generation.ativa &&
    current.current === generation &&
    ready === generation;
  function checkDisk() {
    if (sessionStorage.getItem(key) !== disk.current)
      throw Error(
        "Intenção alterada em outra montagem. Reabra para conferir; não sobrescreva a chave."
      );
  }
  function persist(value: Intencao37) {
    const raw = JSON.stringify(value);
    sessionStorage.setItem(key, raw);
    if (sessionStorage.getItem(key) !== raw)
      throw Error("A intenção não foi preservada no armazenamento.");
    disk.current = raw;
    saved.current = value;
    setPending(value);
  }
  useEffect(() => {
    generation.ativa = true;
    saved.current = null;
    disk.current = null;
    flight.current = false;
    blocked.current = false;
    evidence.current = null;
    setReady(generation);
    setPending(null);
    setBusy(false);
    setError("");
    setRecovery(null);
    if (key)
      try {
        const raw = sessionStorage.getItem(key);
        disk.current = raw;
        if (raw !== null) {
          const s = savedSchema.parse(JSON.parse(raw));
          if (s.userId !== userId || s.request.acao !== action)
            throw Error("Intenção armazenada de outra empresa/ação.");
          const value: Intencao37 = {
            versao: 1,
            userId: s.userId,
            idempotencyKey: s.idempotencyKey,
            request: s.request,
          };
          saved.current = value;
          setPending(value);
          if (Object.hasOwn(s, "confirmacao")) {
            try {
              value.confirmacao = validarResultado37(s.confirmacao, value);
              setPending({ ...value });
            } catch {
              setError(
                "Confirmação local inválida: confira a intenção original no servidor."
              );
            }
          }
        }
      } catch {
        blocked.current = true;
        setError(
          "Armazenamento indisponível ou intenção corrompida. Nenhum novo envio autorizado; preserve os dados."
        );
      }
    return () => {
      generation.ativa = false;
    };
  }, [generation]);
  async function enviar(request: Request37) {
    if (!atual() || flight.current || blocked.current || saved.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      checkDisk();
      const canonical = request37Schema.parse(request);
      if (canonical.acao !== action || !userId)
        throw Error("Intenção não corresponde à empresa/ação atual.");
      const idempotencyKey = uuid.parse(crypto.randomUUID().toLowerCase());
      const frozen = congelarRecovery37({ idempotencyKey, request: canonical });
      const value: Intencao37 = { versao: 1, userId, ...frozen };
      // Persistência antes da única mutation. Falhar aqui não autoriza outra UUID.
      saved.current = value;
      setPending(value);
      persist(value);
      checkDisk();
      const response = await respostaCaixa37(executarCaixa37(value));
      if (!atual()) return;
      checkDisk();
      const result = validarResultado37(response, value);
      persist({ ...value, confirmacao: result });
      cb.current(result);
    } catch (e) {
      if (atual()) {
        blocked.current = true;
        setError(
          `${e instanceof Error ? e.message : "Falha inesperada"}. Resultado não confirmado. Confira a intenção original; não repita a operação.`
        );
      }
    } finally {
      if (atual()) {
        flight.current = false;
        setBusy(false);
      }
    }
  }
  async function reconciliar() {
    const value = saved.current;
    if (!atual() || flight.current || !value || value.confirmacao || !userId)
      return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      checkDisk();
      const input: RecoveryInput37 = {
        idempotencyKey: value.idempotencyKey,
        request: value.request,
      };
      const response = await respostaCaixa37(
        caixa37Rpc.reconciliar37.mutate(input)
      );
      if (!atual()) return;
      checkDisk();
      const proof = validarRecovery37(response, userId, input);
      if (proof.status === "confirmed") {
        const result = validarResultado37(proof.result, input);
        persist({ ...value, confirmacao: result });
        cb.current(result);
      }
      evidence.current = proof;
      setRecovery(proof);
    } catch (e) {
      if (atual())
        setError(
          `${e instanceof Error ? e.message : "Falha de conferência"}. Preserve a mesma intenção; ausência não foi comprovada.`
        );
    } finally {
      if (atual()) {
        flight.current = false;
        setBusy(false);
      }
    }
  }
  function encerrar(): Request37 | null {
    const value = saved.current;
    if (!atual() || flight.current || !value || !userId) return null;
    try {
      checkDisk();
      if (value.confirmacao) validarResultado37(value.confirmacao, value);
      else if (evidence.current?.status === "not_executed")
        validarRecovery37(evidence.current, userId, value);
      else return null;
      sessionStorage.removeItem(key);
      if (sessionStorage.getItem(key) !== null)
        throw Error("Não foi possível encerrar o registro local.");
      saved.current = null;
      disk.current = null;
      evidence.current = null;
      blocked.current = false;
      setPending(null);
      setRecovery(null);
      setError("");
      return value.request;
    } catch (e) {
      if (atual())
        setError(e instanceof Error ? e.message : "Falha no armazenamento");
      return null;
    }
  }
  return {
    generation,
    atual,
    pronta: atual(),
    pendente: atual() ? pending : null,
    busy: atual() && busy,
    erro: atual() ? error : "",
    recovery: atual() ? recovery : null,
    enviar,
    reconciliar,
    encerrar,
  };
}
