import { getSupabaseClientAsync } from "../db";
import { enviarMensagemEvolution, normalizarTelefoneWhatsApp } from "./evolutionClient";
import { adicionarDiasData, dataHojeBrasilia, horarioBrasilia } from "./businessDate";

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
  if (vars.valor !== undefined) mensagem = mensagem.replace(/{valor}/g, vars.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  if (vars.data_vencimento) mensagem = mensagem.replace(/{data_vencimento}/g, vars.data_vencimento);
  if (vars.dias_atraso !== undefined) mensagem = mensagem.replace(/{dias_atraso}/g, String(Math.abs(vars.dias_atraso)));
  if (vars.empresa) mensagem = mensagem.replace(/{empresa}/g, vars.empresa);
  if (vars.parcela !== undefined) mensagem = mensagem.replace(/{parcela}/g, String(vars.parcela));
  if (vars.total_parcelas !== undefined) mensagem = mensagem.replace(/{total_parcelas}/g, String(vars.total_parcelas));
  return mensagem;
}

export const obterDataBrasilia = dataHojeBrasilia;
export function obterHorarioBrasilia(now: Date = new Date()): string { return horarioBrasilia(now).slice(0, 5); }
export function deveExecutarNoHorario(horario: string, now: Date = new Date()): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) return false;
  const atual = obterHorarioBrasilia(now);
  const [h, m] = atual.split(":").map(Number);
  const [agendadaH, agendadaM] = horario.split(":").map(Number);
  const agoraMin = h * 60 + m;
  const alvoMin = agendadaH * 60 + agendadaM;
  return agoraMin >= alvoMin && agoraMin < alvoMin + 5;
}
export function calcularDataAlvoBrasilia(diasAntes: number, now: Date = new Date()): string { return adicionarDiasData(dataHojeBrasilia(now), diasAntes); }
export function inicioDoDiaBrasilia(data: string): string { return new Date(`${data}T00:00:00-03:00`).toISOString(); }
export { normalizarTelefoneWhatsApp };

type ItemOutbox = {
  userId: number;
  tipo: string;
  telefone: string;
  mensagem: string;
  chaveDeduplicacao: string;
  dataReferencia: string;
  parcelaId?: number | null;
  clienteId?: number | null;
};

export async function enfileirarMensagemWhatsApp(item: ItemOutbox, dryRun = false): Promise<{ criada: boolean; chave: string }> {
  if (dryRun) return { criada: false, chave: item.chaveDeduplicacao };
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const telefone = normalizarTelefoneWhatsApp(item.telefone);
  const { data, error } = await sb.from("whatsapp_outbox").upsert({
    user_id: item.userId,
    tipo: item.tipo,
    telefone,
    mensagem: item.mensagem,
    chave_deduplicacao: item.chaveDeduplicacao,
    data_referencia: item.dataReferencia,
    parcela_id: item.parcelaId ?? null,
    cliente_id: item.clienteId ?? null,
    status: "pendente",
    proxima_tentativa_em: new Date().toISOString(),
  }, { onConflict: "chave_deduplicacao", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(error.message);
  return { criada: Boolean(data?.length), chave: item.chaveDeduplicacao };
}

export async function enfileirarLembretesAutomaticos(now: Date = new Date(), dryRun = false): Promise<{ usuariosNoHorario: number; elegiveis: number; enfileiradas: number }> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const { data: configsAtivos, error: configsError } = await sb.from("configuracoes")
    .select("user_id").eq("chave", "notificacoes_auto_ativo").eq("valor", "true");
  if (configsError) throw new Error(configsError.message);

  let usuariosNoHorario = 0;
  let elegiveis = 0;
  let enfileiradas = 0;
  const dataHoje = dataHojeBrasilia(now);
  for (const configAtiva of configsAtivos ?? []) {
    const userId = configAtiva.user_id as number;
    const [{ data: regras, error: regrasError }, { data: configuracoes, error: configuracoesError }] = await Promise.all([
      sb.from("notificacoes_automaticas").select("tipo, dias_antes, mensagem_template").eq("user_id", userId).eq("ativo", true),
      sb.from("configuracoes").select("chave, valor").eq("user_id", userId).in("chave", ["nomeEmpresa", "notificacoes_auto_horario"]),
    ]);
    if (regrasError || configuracoesError) throw new Error(regrasError?.message ?? configuracoesError?.message);
    if (!regras?.length) continue;
    const preferencias = Object.fromEntries((configuracoes ?? []).map((row: any) => [row.chave, row.valor])) as Record<string, string>;
    if (!deveExecutarNoHorario(preferencias.notificacoes_auto_horario || "09:00", now)) continue;
    usuariosNoHorario++;

    for (const regra of regras as { tipo: string; dias_antes: number; mensagem_template: string }[]) {
      const dataAlvo = calcularDataAlvoBrasilia(regra.dias_antes, now);
      const { data: parcelas, error: parcelasError } = await sb.from("parcelas")
        .select("id, valor, numero_parcela, contrato_id, contratos!inner(numero_parcelas, cliente_id, clientes!inner(id, nome, whatsapp, telefone))")
        .eq("user_id", userId).eq("data_vencimento", dataAlvo).in("status", ["pendente", "atrasada"]);
      if (parcelasError) throw new Error(parcelasError.message);

      for (const parcela of parcelas as any[] ?? []) {
        const cliente = parcela.contratos?.clientes;
        const telefone = cliente?.whatsapp || cliente?.telefone;
        if (!cliente || !telefone) continue;
        const mensagem = substituirVariaveis(regra.mensagem_template, {
          nome: cliente.nome,
          valor: Number(parcela.valor),
          data_vencimento: dataAlvo.split("-").reverse().join("/"),
          dias_atraso: regra.dias_antes < 0 ? Math.abs(regra.dias_antes) : 0,
          empresa: preferencias.nomeEmpresa || "Empresa",
          parcela: parcela.numero_parcela,
          total_parcelas: parcela.contratos?.numero_parcelas,
        });
        elegiveis++;
        const criada = await enfileirarMensagemWhatsApp({
          userId, tipo: regra.tipo, telefone, mensagem, dataReferencia: dataHoje,
          parcelaId: parcela.id, clienteId: cliente.id,
          chaveDeduplicacao: `lembrete:${userId}:${parcela.id}:${regra.tipo}:${dataHoje}`,
        }, dryRun);
        if (criada.criada) enfileiradas++;
      }
    }
  }
  return { usuariosNoHorario, elegiveis, enfileiradas };
}

function proximaTentativa(tentativas: number): string {
  const minutos = Math.min(60, 5 * Math.max(1, 2 ** Math.min(tentativas, 4)));
  return new Date(Date.now() + minutos * 60_000).toISOString();
}

const MAX_TENTATIVAS_ENVIO = 5;

/**
 * Um processo pode morrer após reservar uma mensagem. Antes de buscar novos
 * itens, devolvemos essas reservas vencidas à fila; assim a mensagem não fica
 * eternamente em "Enviando" e nenhum worker toma lease ainda válido.
 */
export async function recuperarLeasesExpiradosWhatsApp(): Promise<number> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const agora = new Date().toISOString();
  const { data, error } = await sb.from("whatsapp_outbox")
    .update({ status: "pendente", lease_expira_em: null, proxima_tentativa_em: agora, updated_at: agora })
    .eq("status", "enviando").lt("lease_expira_em", agora).select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function processarFilaWhatsApp(limite = 25, dryRun = false): Promise<{ processadas: number; enviadas: number; falhas: number; aguardandoReconexao: number; ambiguas: number }> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  if (dryRun) return { processadas: 0, enviadas: 0, falhas: 0, aguardandoReconexao: 0, ambiguas: 0 };
  await recuperarLeasesExpiradosWhatsApp();
  const { data: candidatas, error } = await sb.from("whatsapp_outbox")
    .select("id, user_id, tipo, telefone, mensagem, parcela_id, cliente_id, tentativas")
    .eq("status", "pendente").lte("proxima_tentativa_em", new Date().toISOString())
    .order("created_at", { ascending: true }).limit(limite);
  if (error) throw new Error(error.message);

  let processadas = 0, enviadas = 0, falhas = 0, aguardandoReconexao = 0, ambiguas = 0;
  for (const item of candidatas ?? []) {
    const { data: reservada, error: reservaErro } = await sb.from("whatsapp_outbox").update({
      status: "enviando", lease_expira_em: new Date(Date.now() + 90_000).toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", item.id).eq("status", "pendente").select("id").maybeSingle();
    if (reservaErro) throw new Error(reservaErro.message);
    if (!reservada) continue;
    processadas++;
    const inicio = new Date().toISOString();
    const result = await enviarMensagemEvolution(item.user_id, item.telefone, item.mensagem);
    const tentativas = Number(item.tentativas ?? 0) + 1;
    let status = "enviado";
    let proxima: string | null = null;
    if (!result.ok) {
      if (result.erroCodigo === "TIMEOUT") { status = "desconhecido"; ambiguas++; }
      else if (result.erroCodigo === "INVALID_PHONE") { status = "falhou"; falhas++; }
      else if (tentativas >= MAX_TENTATIVAS_ENVIO) { status = "falhou"; falhas++; }
      else { status = "pendente"; proxima = proximaTentativa(tentativas); aguardandoReconexao++; }
    } else enviadas++;

    const { error: updateErro } = await sb.from("whatsapp_outbox").update({
      status, tentativas, proxima_tentativa_em: proxima, lease_expira_em: null,
      provider_message_id: result.providerMessageId ?? null, ultimo_erro: result.erro ?? null,
      updated_at: new Date().toISOString(), enviado_em: result.ok ? new Date().toISOString() : null,
    }).eq("id", item.id).eq("status", "enviando");
    if (updateErro) throw new Error(updateErro.message);
    const { error: attemptError } = await sb.from("whatsapp_tentativas").insert({
      outbox_id: item.id, iniciou_em: inicio, terminou_em: new Date().toISOString(),
      sucesso: result.ok, provider_message_id: result.providerMessageId ?? null,
      codigo_erro: result.erroCodigo ?? null, erro: result.erro ?? null,
    });
    if (attemptError) throw new Error(attemptError.message);

    if (status === "enviado" || status === "falhou" || status === "desconhecido") {
      const { error: logErro } = await sb.from("notificacoes_log").upsert({
        outbox_id: item.id, user_id: item.user_id, parcela_id: item.parcela_id, cliente_id: item.cliente_id,
        tipo: item.tipo, telefone: item.telefone, mensagem: item.mensagem,
        status: status === "enviado" ? "enviado" : "erro", erro: result.erro ?? null,
      }, { onConflict: "outbox_id" });
      if (logErro) throw new Error(logErro.message);
    }
  }
  return { processadas, enviadas, falhas, aguardandoReconexao, ambiguas };
}

export async function obterSaudeNotificacoes(userId: number) {
  const sb = await getSupabaseClientAsync();
  if (!sb) return { pendentes: 0, enviando: 0, falhas: 0, ambiguas: 0, ultimoEnvioEm: null as string | null };
  const { data, error } = await sb.from("whatsapp_outbox").select("status, enviado_em").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const linhas = data ?? [];
  return {
    pendentes: linhas.filter((x: any) => x.status === "pendente").length,
    enviando: linhas.filter((x: any) => x.status === "enviando").length,
    falhas: linhas.filter((x: any) => x.status === "falhou").length,
    ambiguas: linhas.filter((x: any) => x.status === "desconhecido").length,
    ultimoEnvioEm: linhas.find((x: any) => x.enviado_em)?.enviado_em ?? null,
  };
}
