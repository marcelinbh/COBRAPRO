import { ENV } from "../_core/env";

const TIME_ZONE = "America/Sao_Paulo";

export type VariaveisMensagem = {
  nome?: string;
  valor?: number;
  data_vencimento?: string;
  dias_atraso?: number;
  empresa?: string;
  parcela?: number;
  total_parcelas?: number;
};

export function substituirVariaveis(template: string, vars: VariaveisMensagem): string {
  let mensagem = template;
  if (vars.nome) mensagem = mensagem.replace(/{nome}/g, vars.nome);
  if (vars.valor !== undefined) {
    mensagem = mensagem.replace(/{valor}/g, vars.valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
  }
  if (vars.data_vencimento) mensagem = mensagem.replace(/{data_vencimento}/g, vars.data_vencimento);
  if (vars.dias_atraso !== undefined) mensagem = mensagem.replace(/{dias_atraso}/g, String(Math.abs(vars.dias_atraso)));
  if (vars.empresa) mensagem = mensagem.replace(/{empresa}/g, vars.empresa);
  if (vars.parcela !== undefined) mensagem = mensagem.replace(/{parcela}/g, String(vars.parcela));
  if (vars.total_parcelas !== undefined) mensagem = mensagem.replace(/{total_parcelas}/g, String(vars.total_parcelas));
  return mensagem;
}

function partesEmBrasilia(now: Date = new Date()): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );
}

export function obterDataBrasilia(now: Date = new Date()): string {
  const parts = partesEmBrasilia(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function obterHorarioBrasilia(now: Date = new Date()): string {
  const parts = partesEmBrasilia(now);
  return `${parts.hour}:${parts.minute}`;
}

export function deveExecutarNoHorario(horario: string, now: Date = new Date()): boolean {
  const [horaProgramada, minutoProgramado] = horario.split(":").map(Number);
  if (!Number.isInteger(horaProgramada) || !Number.isInteger(minutoProgramado)) return false;
  const parts = partesEmBrasilia(now);
  const minutoAtual = Number(parts.hour) * 60 + Number(parts.minute);
  const minutoAlvo = horaProgramada * 60 + minutoProgramado;
  return minutoAtual >= minutoAlvo && minutoAtual < minutoAlvo + 5;
}

export function calcularDataAlvoBrasilia(diasAntes: number, now: Date = new Date()): string {
  const [year, month, day] = obterDataBrasilia(now).split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + diasAntes));
  return utc.toISOString().slice(0, 10);
}

export function inicioDoDiaBrasilia(data: string): string {
  return new Date(`${data}T00:00:00-03:00`).toISOString();
}

export function normalizarTelefoneWhatsApp(telefone: string): string {
  let digits = telefone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

/** A Evolution API recebe somente dígitos no campo `number`, sem o sufixo JID. */
export function criarPayloadTextoEvolution(telefone: string, mensagem: string) {
  return {
    number: normalizarTelefoneWhatsApp(telefone),
    textMessage: { text: mensagem },
  };
}

export async function enviarWhatsAppAutomatico(
  userId: number,
  telefone: string,
  mensagem: string
): Promise<{ ok: boolean; erro?: string }> {
  const instanceName = `user-${userId}`;
  const evolutionUrl = ENV.evolutionApiUrl.replace(/\/$/, "");
  const evolutionApiKey = ENV.evolutionApiKey;

  try {
    const statusResponse = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: evolutionApiKey },
      signal: AbortSignal.timeout(8_000),
    });
    const status = (await statusResponse.json()) as { instance?: { state?: string } };
    if (status?.instance?.state !== "open") {
      return { ok: false, erro: "WhatsApp desconectado" };
    }

    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
      body: JSON.stringify(criarPayloadTextoEvolution(telefone, mensagem)),
      signal: AbortSignal.timeout(12_000),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok || body.error) {
      return { ok: false, erro: body.message || "Falha no envio pela Evolution API" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, erro: error instanceof Error ? error.message : "Erro ao enviar mensagem" };
  }
}
