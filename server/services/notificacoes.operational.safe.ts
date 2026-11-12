import type { getSupabaseClientAsync } from "../db";
import {
  adicionarDiasData,
  dataHojeBrasilia,
  horarioBrasilia,
} from "./businessDate";

export type BancoWhatsApp = NonNullable<
  Awaited<ReturnType<typeof getSupabaseClientAsync>>
>;
export const DIAS_LEMBRETE: Record<string, number> = {
  antes_vencimento_5: 5,
  antes_vencimento_4: 4,
  antes_vencimento_3: 3,
  antes_vencimento_2: 2,
  antes_vencimento_1: 1,
  no_vencimento: 0,
  apos_vencimento_1: -1,
  apos_vencimento_3: -3,
  apos_vencimento_7: -7,
};
const ORDEM: Record<string, number> = {
  erro: 0,
  desconhecido: 0,
  cancelado: 0,
  aceito_evolution: 1,
  enviado: 1,
  entregue: 2,
  lido: 3,
};
export function deveAvancarHistorico(atual: unknown, proximo: string): boolean {
  return (
    (ORDEM[proximo] ?? 0) >
    (typeof atual === "string" ? (ORDEM[atual] ?? 0) : 0)
  );
}

/** Sem ON CONFLICT(column): o índice real é parcial. Cada UPDATE de status é CAS.
 * Não copia telefone, mensagem ou texto bruto de erros para o histórico. */
export async function persistirHistoricoWhatsApp(
  sb: BancoWhatsApp,
  item: {
    id: string;
    user_id: number;
    tipo: string;
    parcela_id?: number | null;
    cliente_id?: number | null;
  },
  status: string,
  codigo: string | null = null
) {
  const metadados = {
    outbox_id: item.id,
    user_id: item.user_id,
    tipo: item.tipo,
    parcela_id: item.parcela_id ?? null,
    cliente_id: item.cliente_id ?? null,
  };
  const { data: criado, error: inserirErro } = await sb
    .from("notificacoes_log")
    .insert({ ...metadados, status, erro: codigo })
    .select("id, status, createdAt")
    .maybeSingle();
  if (!inserirErro && criado) return criado;
  if (inserirErro && inserirErro.code !== "23505")
    throw new Error("HISTORICO_INSERCAO_FALHOU");
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const { data: atual, error } = await sb
      .from("notificacoes_log")
      .select("id, status, createdAt")
      .eq("outbox_id", item.id)
      .eq("user_id", item.user_id)
      .maybeSingle();
    if (error || !atual) throw new Error("HISTORICO_CONFLITO_SEM_VINCULO");
    // Metadados canônicos são os mesmos no worker e callback; não alteram recibos.
    const { error: metadataError } = await sb
      .from("notificacoes_log")
      .update(metadados)
      .eq("id", atual.id)
      .eq("outbox_id", item.id)
      .eq("user_id", item.user_id);
    if (metadataError) throw new Error("HISTORICO_METADADOS_FALHOU");
    if (!deveAvancarHistorico(atual.status, status)) return atual;
    const { data: avancado, error: casError } = await sb
      .from("notificacoes_log")
      .update({ status, erro: codigo })
      .eq("id", atual.id)
      .eq("user_id", item.user_id)
      .eq("outbox_id", item.id)
      .eq("status", atual.status)
      .select("id, status, createdAt")
      .maybeSingle();
    if (casError) throw new Error("HISTORICO_CAS_FALHOU");
    if (avancado) return avancado;
  }
  throw new Error("HISTORICO_CONCORRENCIA_RETRY");
}

/** Catch-up do produtor diário: horário vencido no mesmo dia, com chave diária. */
export function horarioDiarioVencido(
  horario: string,
  now = new Date()
): boolean {
  return (
    /^([01]\d|2[0-3]):[0-5]\d$/.test(horario) &&
    horarioBrasilia(now).slice(0, 5) >= horario
  );
}
export function fimDeValidadeBrasilia(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
    throw new Error("DATA_REFERENCIA_INVALIDA");
  return new Date(`${adicionarDiasData(data, 1)}T00:00:00-03:00`).toISOString();
}
export function referenciaVigente(data: string, now = new Date()): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(data) &&
    data === dataHojeBrasilia(now) &&
    now.getTime() < new Date(fimDeValidadeBrasilia(data)).getTime()
  );
}

export type FontePagamento =
  | "operacoes_financeiras"
  | "ciclo_operacoes"
  | "legados_operacoes";
export function chavePagamento(
  userId: number,
  fonte: FontePagamento,
  operacaoId: string
): string {
  return `pagamento:${userId}:${fonte}:${operacaoId}`;
}
export function lerChavePagamento(
  chave: unknown,
  userId: number
): { fonte: FontePagamento; operacaoId: string } | null {
  const match =
    typeof chave === "string"
      ? /^pagamento:(\d+):(operacoes_financeiras|ciclo_operacoes|legados_operacoes):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
          chave
        )
      : null;
  return match && Number(match[1]) === userId
    ? { fonte: match[2].toLowerCase() as FontePagamento, operacaoId: match[3] }
    : null;
}

export type ProvaPagamento = {
  parcelaId: number;
  contratoId: number;
  clienteId: number;
  /** Decimal textual exato: nunca converter a prova financeira para float. */
  valor: string;
  dataPagamento: string;
};

/** Leitor service-only; tabelas de operação/pernas continuam privadas.
 * Ausência comprovada => null. Erro do banco/transporte/contrato => falha fechada.
 * Nenhum dado de navegador, vencimento, saldo acumulado ou renovação é prova. */
export async function obterProvaPagamento(
  sb: BancoWhatsApp,
  userId: number,
  fonte: FontePagamento,
  operacaoId: string
): Promise<ProvaPagamento | null> {
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !["operacoes_financeiras", "ciclo_operacoes", "legados_operacoes"].includes(
      fonte
    ) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      operacaoId
    )
  )
    return null;
  try {
    const { data, error } = await sb.rpc("legados_prova_pagamento", {
      p_user_id: userId,
      p_fonte: fonte,
      p_operacao_id: operacaoId,
    });
    if (error) throw new Error("PROVA_PAGAMENTO_INDISPONIVEL");
    if (data === null) return null;
    const r = data as Partial<ProvaPagamento>;
    const ids = [r?.parcelaId, r?.contratoId, r?.clienteId];
    if (
      !ids.every(
        id => typeof id === "number" && Number.isSafeInteger(id) && id > 0
      ) ||
      typeof r?.valor !== "string" ||
      !/^(0|[1-9][0-9]{0,12})\.[0-9]{2}$/.test(r.valor) ||
      r.valor === "0.00" ||
      typeof r?.dataPagamento !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.dataPagamento) ||
      !Number.isFinite(Date.parse(`${r.dataPagamento}T00:00:00Z`)) ||
      new Date(`${r.dataPagamento}T00:00:00Z`).toISOString().slice(0, 10) !==
        r.dataPagamento
    )
      throw new Error("PROVA_PAGAMENTO_INDISPONIVEL");
    return {
      parcelaId: r.parcelaId!,
      contratoId: r.contratoId!,
      clienteId: r.clienteId!,
      valor: r.valor,
      dataPagamento: r.dataPagamento,
    };
  } catch {
    // Não expor mensagens de transporte/banco com potencial PII.
    throw new Error("PROVA_PAGAMENTO_INDISPONIVEL");
  }
}

export function codigoResultadoSeguro(result: {
  ok: boolean;
  erroCodigo?: string;
  disposition?: string;
}): string | null {
  if (result.ok) return null;
  if (result.disposition !== "nao_solicitado")
    return "ENVIO_AMBIGUO_RECONCILIACAO_MANUAL";
  return [
    "INVALID_PHONE",
    "CONFIG",
    "DISCONNECTED",
    "TIMEOUT",
    "NETWORK",
  ].includes(result.erroCodigo ?? "")
    ? result.erroCodigo!
    : "PROVEDOR_INDISPONIVEL_ANTES_POST";
}
