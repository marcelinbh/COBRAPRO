import { getSupabaseClientAsync } from "../db";
import {
  enviarMensagemEvolution,
  normalizarTelefoneWhatsApp,
  type ResultadoEnvioEvolution,
} from "./evolutionClient";
import {
  adicionarDiasData,
  dataHojeBrasilia,
  horarioBrasilia,
} from "./businessDate";
import {
  DIAS_LEMBRETE,
  chavePagamento,
  codigoResultadoSeguro,
  lerChavePagamento,
  obterProvaPagamento,
  horarioDiarioVencido,
  persistirHistoricoWhatsApp,
  referenciaVigente,
  type BancoWhatsApp,
  type FontePagamento,
} from "./notificacoes.operational.safe";
export type VariaveisMensagem = {
  nome?: string;
  valor?: number | string;
  data_vencimento?: string;
  dias_atraso?: number;
  empresa?: string;
  parcela?: number;
  total_parcelas?: number;
};
export function substituirVariaveis(
  template: string,
  vars: VariaveisMensagem
): string {
  let mensagem = template;
  if (vars.nome) mensagem = mensagem.replace(/{nome}/g, vars.nome);
  if (vars.valor !== undefined)
    mensagem = mensagem.replace(
      /{valor}/g,
      typeof vars.valor === "string"
        ? vars.valor.replace(/\B(?=(\d{3})+(?!\d))/g, "_").replace(".", ",").replaceAll("_", ".")
        : vars.valor.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
    );
  if (vars.data_vencimento)
    mensagem = mensagem.replace(/{data_vencimento}/g, vars.data_vencimento);
  if (vars.dias_atraso !== undefined)
    mensagem = mensagem.replace(
      /{dias_atraso}/g,
      String(Math.abs(vars.dias_atraso))
    );
  if (vars.empresa) mensagem = mensagem.replace(/{empresa}/g, vars.empresa);
  if (vars.parcela !== undefined)
    mensagem = mensagem.replace(/{parcela}/g, String(vars.parcela));
  if (vars.total_parcelas !== undefined)
    mensagem = mensagem.replace(
      /{total_parcelas}/g,
      String(vars.total_parcelas)
    );
  return mensagem;
}
export const obterDataBrasilia = dataHojeBrasilia;
export function obterHorarioBrasilia(now: Date = new Date()): string {
  return horarioBrasilia(now).slice(0, 5);
}
/** Utilitário público legado de janela curta. O produtor usa horarioDiarioVencido. */
export function deveExecutarNoHorario(
  horario: string,
  now: Date = new Date()
): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) return false;
  const minutos = (valor: string) =>
    Number(valor.slice(0, 2)) * 60 + Number(valor.slice(3, 5));
  const atual = minutos(obterHorarioBrasilia(now)),
    alvo = minutos(horario);
  return atual >= alvo && atual < alvo + 5;
}
export function calcularDataAlvoBrasilia(
  diasAntes: number,
  now: Date = new Date()
): string {
  return adicionarDiasData(dataHojeBrasilia(now), diasAntes);
}
export function inicioDoDiaBrasilia(data: string): string {
  return new Date(`${data}T00:00:00-03:00`).toISOString();
}
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
export async function enfileirarMensagemWhatsApp(
  item: ItemOutbox,
  dryRun = false
): Promise<{ criada: boolean; chave: string }> {
  const telefone = normalizarTelefoneWhatsApp(item.telefone);
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  if (item.tipo === "confirmacao_pagamento") {
    const chave = lerChavePagamento(item.chaveDeduplicacao, item.userId);
    const prova =
      chave &&
      (await obterProvaPagamento(
        sb,
        item.userId,
        chave.fonte,
        chave.operacaoId
      ));
    if (
      !prova ||
      prova.parcelaId !== item.parcelaId ||
      prova.clienteId !== item.clienteId
    )
      throw new Error("PAGAMENTO_SEM_PROVA_DURAVEL");
  }
  if (dryRun) return { criada: false, chave: item.chaveDeduplicacao };
  const { data, error } = await sb
    .from("whatsapp_outbox")
    .upsert(
      {
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
      },
      { onConflict: "chave_deduplicacao", ignoreDuplicates: true }
    )
    .select("id");
  if (error) throw new Error("OUTBOX_ENFILEIRAMENTO_FALHOU");
  return { criada: Boolean(data?.length), chave: item.chaveDeduplicacao };
}

/** Entrada específica pós-recebimento: só utiliza evidência concluída no banco.
 * Não desbloqueia nem invoca qualquer operação financeira. */
export async function enfileirarConfirmacaoPagamento(
  userId: number,
  fonte: FontePagamento,
  operacaoId: string,
  dryRun = false
) {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const prova = await obterProvaPagamento(sb, userId, fonte, operacaoId);
  if (!prova) throw new Error("PAGAMENTO_SEM_PROVA_DURAVEL");
  const [
    { data: regra, error: regraErro },
    { data: configs, error: configErro },
    { data: parcela, error: parcelaErro },
  ] = await Promise.all([
    sb
      .from("notificacoes_automaticas")
      .select("ativo, mensagem_template")
      .eq("user_id", userId)
      .eq("tipo", "confirmacao_pagamento")
      .eq("dias_antes", 0)
      .maybeSingle(),
    sb
      .from("configuracoes")
      .select("chave, valor")
      .eq("user_id", userId)
      .in("chave", ["notificacoes_auto_ativo", "nomeEmpresa"]),
    sb
      .from("parcelas")
      .select("id, cliente_id, contrato_id, numero_parcela")
      .eq("id", prova.parcelaId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (regraErro || configErro || parcelaErro)
    throw new Error("PAGAMENTO_VALIDACAO_INDISPONIVEL");
  const preferencias = Object.fromEntries(
    (configs ?? []).map((c: any) => [c.chave, c.valor])
  );
  if (!regra?.ativo || preferencias.notificacoes_auto_ativo !== "true")
    return { criada: false, chave: chavePagamento(userId, fonte, operacaoId) };
  if (
    !parcela ||
    parcela.cliente_id !== prova.clienteId ||
    parcela.contrato_id !== prova.contratoId
  )
    throw new Error("PAGAMENTO_PROPRIEDADE_DIVERGENTE");
  const [
    { data: cliente, error: clienteErro },
    { data: contrato, error: contratoErro },
  ] = await Promise.all([
    sb
      .from("clientes")
      .select("id, nome, whatsapp, telefone")
      .eq("id", prova.clienteId)
      .eq("user_id", userId)
      .maybeSingle(),
    sb
      .from("contratos")
      .select("id, cliente_id, numero_parcelas")
      .eq("id", prova.contratoId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (
    clienteErro ||
    contratoErro ||
    !cliente ||
    !contrato ||
    contrato.cliente_id !== cliente.id
  )
    throw new Error("PAGAMENTO_PROPRIEDADE_DIVERGENTE");
  return enfileirarMensagemWhatsApp(
    {
      userId,
      tipo: "confirmacao_pagamento",
      telefone: cliente.whatsapp || cliente.telefone || "",
      mensagem: substituirVariaveis(regra.mensagem_template, {
        nome: cliente.nome,
        valor: prova.valor,
        parcela: parcela.numero_parcela,
        total_parcelas: contrato.numero_parcelas,
        empresa: preferencias.nomeEmpresa || "Empresa",
      }),
      parcelaId: prova.parcelaId,
      clienteId: prova.clienteId,
      dataReferencia: dataHojeBrasilia(),
      chaveDeduplicacao: chavePagamento(userId, fonte, operacaoId),
    },
    dryRun
  );
}

export async function enfileirarLembretesAutomaticos(
  now: Date = new Date(),
  dryRun = false
): Promise<{
  usuariosNoHorario: number;
  elegiveis: number;
  enfileiradas: number;
  falhasItens: number;
}> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const { data: configsAtivos, error: configsError } = await sb
    .from("configuracoes")
    .select("user_id")
    .eq("chave", "notificacoes_auto_ativo")
    .eq("valor", "true");
  if (configsError) throw new Error("CONFIGURACOES_INDISPONIVEIS");
  let usuariosNoHorario = 0,
    elegiveis = 0,
    enfileiradas = 0,
    falhasItens = 0;
  const dataHoje = dataHojeBrasilia(now);
  for (const configAtiva of configsAtivos ?? []) {
    const userId = configAtiva.user_id as number;
    const [
      { data: regras, error: regrasError },
      { data: configuracoes, error: configuracoesError },
    ] = await Promise.all([
      sb
        .from("notificacoes_automaticas")
        .select("tipo, dias_antes, mensagem_template")
        .eq("user_id", userId)
        .eq("ativo", true),
      sb
        .from("configuracoes")
        .select("chave, valor")
        .eq("user_id", userId)
        .in("chave", ["nomeEmpresa", "notificacoes_auto_horario"]),
    ]);
    if (regrasError || configuracoesError) {
      falhasItens++;
      continue;
    }
    if (!regras?.length) continue;
    const preferencias = Object.fromEntries(
      (configuracoes ?? []).map((row: any) => [row.chave, row.valor])
    ) as Record<string, string>;
    if (
      !horarioDiarioVencido(
        preferencias.notificacoes_auto_horario || "09:00",
        now
      )
    )
      continue;
    usuariosNoHorario++;
    for (const regra of regras as {
      tipo: string;
      dias_antes: number;
      mensagem_template: string;
    }[]) {
      // Confirmação NÃO é regra de vencimento; tipos/deslocamentos desconhecidos falham fechado.
      if (
        !(regra.tipo in DIAS_LEMBRETE) ||
        DIAS_LEMBRETE[regra.tipo] !== regra.dias_antes
      )
        continue;
      const dataAlvo = calcularDataAlvoBrasilia(regra.dias_antes, now);
      const { data: parcelas, error: parcelasError } = await sb
        .from("parcelas")
        .select(
          "id, valor_original, numero_parcela, cliente_id, contrato_id, contratos!inner(user_id, numero_parcelas, cliente_id, clientes!inner(id, user_id, nome, whatsapp, telefone))"
        )
        .eq("user_id", userId)
        .eq("data_vencimento", dataAlvo)
        .in("status", ["pendente", "atrasada"]);
      if (parcelasError) {
        falhasItens++;
        continue;
      }
      for (const parcela of (parcelas as any[]) ?? []) {
        try {
          const cliente = parcela.contratos?.clientes;
          if (
            !cliente ||
            parcela.contratos.user_id !== userId ||
            cliente.user_id !== userId ||
            parcela.cliente_id !== cliente.id ||
            parcela.contratos.cliente_id !== cliente.id
          )
            throw new Error("PROPRIEDADE_DIVERGENTE");
          const telefone = cliente.whatsapp || cliente.telefone || "";
          elegiveis++;
          const valor = Number(parcela.valor_original);
          if (!Number.isFinite(valor) || valor <= 0)
            throw new Error("VALOR_INVALIDO");
          const mensagem = substituirVariaveis(regra.mensagem_template, {
            nome: cliente.nome,
            valor,
            data_vencimento: dataAlvo.split("-").reverse().join("/"),
            dias_atraso: regra.dias_antes < 0 ? Math.abs(regra.dias_antes) : 0,
            empresa: preferencias.nomeEmpresa || "Empresa",
            parcela: parcela.numero_parcela,
            total_parcelas: parcela.contratos?.numero_parcelas,
          });
          const criada = await enfileirarMensagemWhatsApp(
            {
              userId,
              tipo: regra.tipo,
              telefone,
              mensagem,
              dataReferencia: dataHoje,
              parcelaId: parcela.id,
              clienteId: cliente.id,
              chaveDeduplicacao: `lembrete:${userId}:${parcela.id}:${regra.tipo}:${dataHoje}`,
            },
            dryRun
          );
          if (criada.criada) enfileiradas++;
        } catch {
          falhasItens++; /* Sem PII em logs; um item inválido não aborta o lote. */
        }
      }
    }
  }
  return { usuariosNoHorario, elegiveis, enfileiradas, falhasItens };
}
function proximaTentativa(tentativas: number): string {
  return new Date(
    Date.now() +
      Math.min(60, 5 * Math.max(1, 2 ** Math.min(tentativas, 4))) * 60_000
  ).toISOString();
}
const MAX_TENTATIVAS_ENVIO = 5;
export function deveMarcarRelatorioDiarioComoConcluido(
  tipo: string,
  status: string,
  dataReferencia: unknown
): boolean {
  return (
    tipo === "relatorio_diario" &&
    status === "enviado" &&
    typeof dataReferencia === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dataReferencia)
  );
}
/** Lease expirado não prova que POST não ocorreu. Nunca retorna à fila. */
export async function recuperarLeasesExpiradosWhatsApp(): Promise<number> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const agora = new Date().toISOString();
  const { data, error } = await sb
    .from("whatsapp_outbox")
    .update({
      status: "desconhecido",
      lease_expira_em: null,
      proxima_tentativa_em: agora,
      ultimo_erro: "LEASE_EXPIRADO_RECONCILIACAO_MANUAL",
      updated_at: agora,
    })
    .eq("status", "enviando")
    .lt("lease_expira_em", agora)
    .select("id, user_id, tipo, parcela_id, cliente_id");
  if (error) throw new Error("RECUPERACAO_LEASE_FALHOU");
  for (const item of data ?? [])
    await persistirHistoricoWhatsApp(
      sb,
      item,
      "desconhecido",
      "LEASE_EXPIRADO_RECONCILIACAO_MANUAL"
    );
  return data?.length ?? 0;
}
export async function sincronizarMarcadoresDeRelatorioDiario(
  dataReferencia = dataHojeBrasilia(),
  limite = 200
): Promise<number> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const { data, error } = await sb
    .from("whatsapp_outbox")
    .select("user_id, data_referencia")
    .eq("tipo", "relatorio_diario")
    .eq("status", "enviado")
    .eq("data_referencia", dataReferencia)
    .order("data_referencia", { ascending: true })
    .limit(limite);
  if (error) throw new Error("RELATORIO_RECONCILIACAO_FALHOU");
  let atualizados = 0;
  for (const item of data ?? []) {
    if (!item.user_id || !item.data_referencia) continue;
    const { error: marcadorError } = await sb
      .from("configuracoes")
      .upsert(
        {
          chave: "relatorio_diario_ultimo_envio",
          valor: item.data_referencia,
          user_id: item.user_id,
        },
        { onConflict: "chave,user_id" }
      );
    if (marcadorError) throw new Error("RELATORIO_MARCADOR_FALHOU");
    atualizados++;
  }
  return atualizados;
}

/** Releitura de dívida/tenant/regra/ativação e validade logo antes do envio.
 * Teste manual não depende do toggle; relatório tem sua política própria. */
async function motivoItemObsoleto(
  sb: BancoWhatsApp,
  item: any,
  now = new Date()
): Promise<string | null> {
  if (item.tipo === "teste_envio") return "TESTE_MANUAL_NAO_REENVIAVEL";
  if (!referenciaVigente(item.data_referencia, now))
    return "VALIDADE_DIARIA_BRT_EXPIRADA";
  if (item.tipo === "relatorio_diario") {
    const { data, error } = await sb
      .from("configuracoes")
      .select("chave, valor")
      .eq("user_id", item.user_id)
      .in("chave", ["relatorio_diario_ativo", "relatorio_diario_telefone"]);
    if (error) throw new Error("REVALIDACAO_INDISPONIVEL");
    const cfg = Object.fromEntries(
      (data ?? []).map((c: any) => [c.chave, c.valor])
    );
    if (cfg.relatorio_diario_ativo !== "true") return "RELATORIO_DESATIVADO";
    try {
      if (
        normalizarTelefoneWhatsApp(cfg.relatorio_diario_telefone || "") !==
        item.telefone
      )
        return "DESTINATARIO_ALTERADO";
    } catch {
      return "DESTINATARIO_INVALIDO";
    }
    return null;
  }
  const dias =
    item.tipo === "confirmacao_pagamento" ? 0 : DIAS_LEMBRETE[item.tipo];
  if (dias === undefined) return "TIPO_NAO_AUTORIZADO";
  const [
    { data: global, error: globalErro },
    { data: regra, error: regraErro },
    { data: parcela, error: parcelaErro },
  ] = await Promise.all([
    sb
      .from("configuracoes")
      .select("valor")
      .eq("user_id", item.user_id)
      .eq("chave", "notificacoes_auto_ativo")
      .maybeSingle(),
    sb
      .from("notificacoes_automaticas")
      .select("ativo")
      .eq("user_id", item.user_id)
      .eq("tipo", item.tipo)
      .eq("dias_antes", dias)
      .maybeSingle(),
    sb
      .from("parcelas")
      .select("id, status, cliente_id, contrato_id, data_vencimento")
      .eq("user_id", item.user_id)
      .eq("id", item.parcela_id)
      .maybeSingle(),
  ]);
  if (globalErro || regraErro || parcelaErro)
    throw new Error("REVALIDACAO_INDISPONIVEL");
  if (global?.valor !== "true" || !regra?.ativo) return "AUTOMACAO_DESATIVADA";
  if (!parcela || parcela.cliente_id !== item.cliente_id)
    return "PROPRIEDADE_DIVERGENTE";
  if (item.tipo === "confirmacao_pagamento") {
    const chave = lerChavePagamento(item.chave_deduplicacao, item.user_id);
    const prova =
      chave &&
      (await obterProvaPagamento(
        sb,
        item.user_id,
        chave.fonte,
        chave.operacaoId
      ));
    if (
      !prova ||
      prova.parcelaId !== parcela.id ||
      prova.clienteId !== item.cliente_id ||
      prova.contratoId !== parcela.contrato_id
    )
      return "PAGAMENTO_SEM_PROVA_DURAVEL";
  } else {
    if (!["pendente", "atrasada"].includes(parcela.status))
      return "PARCELA_NAO_EXIGIVEL";
    if (
      parcela.data_vencimento !== adicionarDiasData(item.data_referencia, dias)
    )
      return "VENCIMENTO_ALTERADO";
  }
  const [
    { data: contrato, error: contratoErro },
    { data: cliente, error: clienteErro },
  ] = await Promise.all([
    sb
      .from("contratos")
      .select("id, cliente_id, status")
      .eq("user_id", item.user_id)
      .eq("id", parcela.contrato_id)
      .maybeSingle(),
    sb
      .from("clientes")
      .select("id, whatsapp, telefone")
      .eq("user_id", item.user_id)
      .eq("id", item.cliente_id)
      .maybeSingle(),
  ]);
  if (contratoErro || clienteErro) throw new Error("REVALIDACAO_INDISPONIVEL");
  if (!contrato || !cliente || contrato.cliente_id !== cliente.id)
    return "PROPRIEDADE_DIVERGENTE";
  if (item.tipo !== "confirmacao_pagamento" && contrato.status !== "ativo")
    return "CONTRATO_NAO_EXIGIVEL";
  try {
    if (
      normalizarTelefoneWhatsApp(cliente.whatsapp || cliente.telefone || "") !==
      item.telefone
    )
      return "DESTINATARIO_ALTERADO";
  } catch {
    return "DESTINATARIO_INVALIDO";
  }
  return null;
}

export async function processarFilaWhatsApp(
  limite = 25,
  dryRun = false
): Promise<{
  processadas: number;
  enviadas: number;
  falhas: number;
  aguardandoReconexao: number;
  ambiguas: number;
  relatoriosConcluidos: number;
  canceladas: number;
}> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  let processadas = 0,
    enviadas = 0,
    falhas = 0,
    aguardandoReconexao = 0,
    ambiguas = 0,
    relatoriosConcluidos = 0,
    canceladas = 0;
  if (!dryRun) {
    ambiguas += await recuperarLeasesExpiradosWhatsApp();
    await sincronizarMarcadoresDeRelatorioDiario();
  }
  const { data: candidatas, error } = await sb
    .from("whatsapp_outbox")
    .select(
      "id, user_id, tipo, telefone, mensagem, parcela_id, cliente_id, data_referencia, tentativas, chave_deduplicacao"
    )
    .eq("status", "pendente")
    .lte("proxima_tentativa_em", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limite, 200)));
  if (error) throw new Error("FILA_INDISPONIVEL");
  for (const item of candidatas ?? []) {
    if (dryRun) {
      processadas++;
      try {
        normalizarTelefoneWhatsApp(item.telefone);
        if (await motivoItemObsoleto(sb, item)) canceladas++;
      } catch {
        falhas++;
      }
      continue;
    }
    const inicio = new Date().toISOString(),
      lease = new Date(Date.now() + 90_000).toISOString();
    const { data: reservada, error: reservaErro } = await sb
      .from("whatsapp_outbox")
      .update({
        status: "enviando",
        lease_expira_em: lease,
        updated_at: inicio,
      })
      .eq("id", item.id)
      .eq("user_id", item.user_id)
      .eq("status", "pendente")
      .select("id")
      .maybeSingle();
    if (reservaErro) {
      falhas++;
      continue;
    }
    if (!reservada) continue;
    processadas++;
    let result: ResultadoEnvioEvolution;
    let motivo: string | null = null;
    let telefoneValido = true;
    try {
      normalizarTelefoneWhatsApp(item.telefone);
    } catch {
      telefoneValido = false;
    }
    try {
      if (!telefoneValido)
        result = {
          ok: false,
          disposition: "nao_solicitado",
          erroCodigo: "INVALID_PHONE",
        };
      else {
        motivo = await motivoItemObsoleto(sb, item);
        if (motivo)
          result = {
            ok: false,
            disposition: "nao_solicitado",
            erroCodigo: "OBSOLETO",
          };
        else
          result = await enviarMensagemEvolution(
            item.user_id,
            item.telefone,
            item.mensagem,
            async () => {
              motivo = await motivoItemObsoleto(sb, item);
              if (motivo) return false;
              const { data: owned, error: ownedErro } = await sb
                .from("whatsapp_outbox")
                .select("id")
                .eq("id", item.id)
                .eq("status", "enviando")
                .eq("lease_expira_em", lease)
                .gt("lease_expira_em", new Date().toISOString())
                .maybeSingle();
              if (ownedErro) throw new Error("LEASE_VALIDACAO_FALHOU");
              if (!owned) motivo = "LEASE_NAO_PERTENCE_AO_WORKER";
              return Boolean(owned);
            }
          );
      }
    } catch {
      result = {
        ok: false,
        disposition: "incerto",
        erroCodigo: "EXCECAO_ENVIO",
      };
    }
    const tentativas = Number(item.tentativas ?? 0) + 1;
    // Mocks/versões antigas sem disposition falham fechado; ok sem ID não é prova.
    const aceito = result.ok && Boolean(result.providerMessageId);
    const incerto = !aceito && result.disposition !== "nao_solicitado";
    let status = aceito
      ? "enviado"
      : incerto
        ? "desconhecido"
        : motivo
          ? "cancelado"
          : result.erroCodigo === "INVALID_PHONE" ||
              tentativas >= MAX_TENTATIVAS_ENVIO
            ? "falhou"
            : "pendente";
    const codigo =
      motivo ??
      codigoResultadoSeguro(aceito ? result : { ...result, ok: false });
    const proxima =
      status === "pendente"
        ? proximaTentativa(tentativas)
        : new Date().toISOString();
    const { data: persistida, error: updateErro } = await sb
      .from("whatsapp_outbox")
      .update({
        status,
        tentativas,
        proxima_tentativa_em: proxima,
        lease_expira_em: null,
        provider_message_id: result.providerMessageId ?? null,
        ultimo_erro: codigo,
        updated_at: new Date().toISOString(),
        enviado_em: aceito ? new Date().toISOString() : null,
      })
      .eq("id", item.id)
      .eq("user_id", item.user_id)
      .eq("status", "enviando")
      .eq("lease_expira_em", lease)
      .select("id")
      .maybeSingle();
    if (updateErro || !persistida) {
      // Não contabiliza enviado sem prova de persistência. Se até a compensação
      // falhar, o lease original será convertido em desconhecido na próxima execução.
      ambiguas++;
      await sb
        .from("whatsapp_outbox")
        .update({
          status: "desconhecido",
          proxima_tentativa_em: new Date().toISOString(),
          lease_expira_em: null,
          ultimo_erro: "PERSISTENCIA_POS_ENVIO_AMBIGUA",
          updated_at: new Date().toISOString(),
          provider_message_id: result.providerMessageId ?? null,
          tentativas,
        })
        .eq("id", item.id)
        .eq("user_id", item.user_id)
        .eq("status", "enviando")
        .eq("lease_expira_em", lease);
      try {
        await persistirHistoricoWhatsApp(
          sb,
          item,
          "desconhecido",
          "PERSISTENCIA_POS_ENVIO_AMBIGUA"
        );
      } catch {
        falhas++;
      }
      continue;
    }
    if (status === "enviado") enviadas++;
    else if (status === "desconhecido") ambiguas++;
    else if (status === "cancelado") canceladas++;
    else if (status === "falhou") falhas++;
    else aguardandoReconexao++;
    try {
      const { error: attemptError } = await sb
        .from("whatsapp_tentativas")
        .insert({
          outbox_id: item.id,
          iniciou_em: inicio,
          terminou_em: new Date().toISOString(),
          sucesso: aceito,
          provider_message_id: result.providerMessageId ?? null,
          codigo_erro: codigo,
          erro: codigo,
        });
      if (attemptError) throw new Error("TENTATIVA_PERSISTENCIA_FALHOU");
      if (status !== "pendente")
        await persistirHistoricoWhatsApp(
          sb,
          item,
          status === "enviado"
            ? "aceito_evolution"
            : status === "falhou"
              ? "erro"
              : status,
          codigo
        );
      if (
        deveMarcarRelatorioDiarioComoConcluido(
          item.tipo,
          status,
          item.data_referencia
        )
      ) {
        const { error: marcadorError } = await sb
          .from("configuracoes")
          .upsert(
            {
              chave: "relatorio_diario_ultimo_envio",
              valor: item.data_referencia,
              user_id: item.user_id,
            },
            { onConflict: "chave,user_id" }
          );
        if (marcadorError) throw new Error("RELATORIO_MARCADOR_FALHOU");
        relatoriosConcluidos++;
      }
    } catch {
      falhas++; /* Outbox terminal nunca volta a pendente por falha de histórico. */
    }
  }
  return {
    processadas,
    enviadas,
    falhas,
    aguardandoReconexao,
    ambiguas,
    relatoriosConcluidos,
    canceladas,
  };
}
export async function obterSaudeNotificacoes(userId: number) {
  const sb = await getSupabaseClientAsync();
  if (!sb)
    return {
      pendentes: 0,
      enviando: 0,
      falhas: 0,
      ambiguas: 0,
      ultimoEnvioEm: null as string | null,
    };
  const { data, error } = await sb
    .from("whatsapp_outbox")
    .select("status, enviado_em")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("SAUDE_NOTIFICACOES_INDISPONIVEL");
  const linhas = data ?? [];
  return {
    pendentes: linhas.filter((x: any) => x.status === "pendente").length,
    enviando: linhas.filter((x: any) => x.status === "enviando").length,
    falhas: linhas.filter((x: any) => x.status === "falhou").length,
    ambiguas: linhas.filter((x: any) => x.status === "desconhecido").length,
    ultimoEnvioEm: linhas.find((x: any) => x.enviado_em)?.enviado_em ?? null,
  };
}
