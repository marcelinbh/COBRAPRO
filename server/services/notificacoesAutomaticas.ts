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

function validarEscopoUsuario(userId?: number): void {
  if (userId !== undefined && (!Number.isSafeInteger(userId) || userId <= 0))
    throw new Error("USUARIO_ESCOPO_INVALIDO");
}

function ownerValido(item: any, userId?: number): boolean {
  return (
    Number.isSafeInteger(item?.user_id) &&
    item.user_id > 0 &&
    (userId === undefined || item.user_id === userId)
  );
}

export async function enfileirarLembretesAutomaticos(
  now: Date = new Date(),
  dryRun = false,
  userId?: number
): Promise<{
  usuariosNoHorario: number;
  elegiveis: number;
  enfileiradas: number;
  falhasItens: number;
}> {
  validarEscopoUsuario(userId);
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  let consultaAtivos = sb.from("configuracoes").select("user_id");
  if (userId !== undefined)
    consultaAtivos = consultaAtivos.eq("user_id", userId);
  const { data: configsAtivos, error: configsError } = await consultaAtivos
    .eq("chave", "notificacoes_auto_ativo")
    .eq("valor", "true");
  if (configsError) throw new Error("CONFIGURACOES_INDISPONIVEIS");
  let usuariosNoHorario = 0,
    elegiveis = 0,
    enfileiradas = 0,
    falhasItens = 0;
  const dataHoje = dataHojeBrasilia(now);
  for (const configAtiva of configsAtivos ?? []) {
    // Defesa contra resposta contraditória; o escopo já foi aplicado no banco.
    if (!ownerValido(configAtiva, userId)) {
      falhasItens++;
      continue;
    }
    const tenantId = configAtiva.user_id as number;
    const [
      { data: regras, error: regrasError },
      { data: configuracoes, error: configuracoesError },
    ] = await Promise.all([
      sb
        .from("notificacoes_automaticas")
        .select("user_id, tipo, dias_antes, mensagem_template")
        .eq("user_id", tenantId)
        .eq("ativo", true),
      sb
        .from("configuracoes")
        .select("user_id, chave, valor")
        .eq("user_id", tenantId)
        .in("chave", ["nomeEmpresa", "notificacoes_auto_horario"]),
    ]);
    if (
      regrasError ||
      configuracoesError ||
      (regras ?? []).some((row: any) => !ownerValido(row, tenantId)) ||
      (configuracoes ?? []).some((row: any) => !ownerValido(row, tenantId))
    ) {
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
          "id, user_id, valor_original, numero_parcela, cliente_id, contrato_id, contratos!inner(user_id, numero_parcelas, cliente_id, clientes!inner(id, user_id, nome, whatsapp, telefone))"
        )
        .eq("user_id", tenantId)
        .eq("contratos.user_id", tenantId)
        .eq("contratos.clientes.user_id", tenantId)
        .eq("data_vencimento", dataAlvo)
        .in("status", ["pendente", "atrasada", "vencendo_hoje"]);
      if (parcelasError) {
        falhasItens++;
        continue;
      }
      for (const parcela of (parcelas as any[]) ?? []) {
        try {
          const cliente = parcela.contratos?.clientes;
          if (
            !cliente ||
            !ownerValido(parcela, tenantId) ||
            !ownerValido(parcela.contratos, tenantId) ||
            !ownerValido(cliente, tenantId) ||
            parcela.cliente_id !== cliente.id ||
            parcela.contratos.cliente_id !== cliente.id
          )
            throw new Error("PROPRIEDADE_DIVERGENTE");
          const telefone = cliente.whatsapp || cliente.telefone || "";
          elegiveis++;
          const valorBruto = String(parcela.valor_original);
          if (!/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$/.test(valorBruto) ||
              /^0(?:\.0{1,2})?$/.test(valorBruto))
            throw new Error("VALOR_INVALIDO");
          const [inteiro, fracao = ""] = valorBruto.split(".");
          const valor = `${inteiro}.${fracao.padEnd(2, "0")}`;
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
              userId: tenantId,
              tipo: regra.tipo,
              telefone,
              mensagem,
              dataReferencia: dataHoje,
              parcelaId: parcela.id,
              clienteId: cliente.id,
              chaveDeduplicacao: `lembrete:${tenantId}:${parcela.id}:${regra.tipo}:${dataHoje}`,
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
export async function recuperarLeasesExpiradosWhatsApp(
  userId?: number
): Promise<number> {
  validarEscopoUsuario(userId);
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  const agora = new Date().toISOString();
  let recuperacao = sb.from("whatsapp_outbox").update({
    status: "desconhecido",
    lease_expira_em: null,
    proxima_tentativa_em: agora,
    ultimo_erro: "LEASE_EXPIRADO_RECONCILIACAO_MANUAL",
    updated_at: agora,
  });
  if (userId !== undefined) recuperacao = recuperacao.eq("user_id", userId);
  const { data, error } = await recuperacao
    .eq("status", "enviando")
    .lt("lease_expira_em", agora)
    .select("id, user_id, tipo, parcela_id, cliente_id");
  if (error) throw new Error("RECUPERACAO_LEASE_FALHOU");
  if ((data ?? []).some((item: any) => !ownerValido(item, userId)))
    throw new Error("PROPRIEDADE_DIVERGENTE");
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
  limite = 200,
  userId?: number
): Promise<number> {
  validarEscopoUsuario(userId);
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco de dados indisponível");
  let consultaMarcadores = sb
    .from("whatsapp_outbox")
    .select("user_id, data_referencia");
  if (userId !== undefined)
    consultaMarcadores = consultaMarcadores.eq("user_id", userId);
  const { data, error } = await consultaMarcadores
    .eq("tipo", "relatorio_diario")
    .eq("status", "enviado")
    .eq("data_referencia", dataReferencia)
    .order("data_referencia", { ascending: true })
    .limit(limite);
  if (error) throw new Error("RELATORIO_RECONCILIACAO_FALHOU");
  if ((data ?? []).some((item: any) => !ownerValido(item, userId)))
    throw new Error("PROPRIEDADE_DIVERGENTE");
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
  if (!ownerValido(item)) return "PROPRIEDADE_DIVERGENTE";
  if (item.tipo === "teste_envio") return "TESTE_MANUAL_NAO_REENVIAVEL";
  if (!referenciaVigente(item.data_referencia, now))
    return "VALIDADE_DIARIA_BRT_EXPIRADA";
  if (item.tipo === "relatorio_diario") {
    const { data, error } = await sb
      .from("configuracoes")
      .select("user_id, chave, valor")
      .eq("user_id", item.user_id)
      .in("chave", ["relatorio_diario_ativo", "relatorio_diario_telefone"]);
    if (error) throw new Error("REVALIDACAO_INDISPONIVEL");
    if ((data ?? []).some((row: any) => !ownerValido(row, item.user_id)))
      return "PROPRIEDADE_DIVERGENTE";
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
      .select("user_id, valor")
      .eq("user_id", item.user_id)
      .eq("chave", "notificacoes_auto_ativo")
      .maybeSingle(),
    sb
      .from("notificacoes_automaticas")
      .select("user_id, ativo")
      .eq("user_id", item.user_id)
      .eq("tipo", item.tipo)
      .eq("dias_antes", dias)
      .maybeSingle(),
    sb
      .from("parcelas")
      .select("id, user_id, status, cliente_id, contrato_id, data_vencimento")
      .eq("user_id", item.user_id)
      .eq("id", item.parcela_id)
      .maybeSingle(),
  ]);
  if (globalErro || regraErro || parcelaErro)
    throw new Error("REVALIDACAO_INDISPONIVEL");
  if (
    [global, regra, parcela].some(row => row && !ownerValido(row, item.user_id))
  )
    return "PROPRIEDADE_DIVERGENTE";
  if (global?.valor !== "true" || !regra?.ativo) return "AUTOMACAO_DESATIVADA";
  if (
    !parcela ||
    parcela.id !== item.parcela_id ||
    parcela.cliente_id !== item.cliente_id
  )
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
    if (!["pendente", "atrasada", "vencendo_hoje"].includes(parcela.status))
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
      .select("id, user_id, cliente_id, status")
      .eq("user_id", item.user_id)
      .eq("id", parcela.contrato_id)
      .maybeSingle(),
    sb
      .from("clientes")
      .select("id, user_id, whatsapp, telefone")
      .eq("user_id", item.user_id)
      .eq("id", item.cliente_id)
      .maybeSingle(),
  ]);
  if (contratoErro || clienteErro) throw new Error("REVALIDACAO_INDISPONIVEL");
  if (
    !contrato ||
    !cliente ||
    !ownerValido(contrato, item.user_id) ||
    !ownerValido(cliente, item.user_id) ||
    contrato.id !== parcela.contrato_id ||
    cliente.id !== item.cliente_id ||
    contrato.cliente_id !== cliente.id
  )
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
  dryRun = false,
  userId?: number
): Promise<{
  processadas: number;
  enviadas: number;
  falhas: number;
  aguardandoReconexao: number;
  ambiguas: number;
  relatoriosConcluidos: number;
  canceladas: number;
}> {
  validarEscopoUsuario(userId);
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
    ambiguas += await recuperarLeasesExpiradosWhatsApp(userId);
    await sincronizarMarcadoresDeRelatorioDiario(undefined, undefined, userId);
  }
  let consultaFila = sb
    .from("whatsapp_outbox")
    .select(
      "id, user_id, tipo, telefone, mensagem, parcela_id, cliente_id, data_referencia, tentativas, chave_deduplicacao"
    );
  if (userId !== undefined) consultaFila = consultaFila.eq("user_id", userId);
  const { data: candidatas, error } = await consultaFila
    .eq("status", "pendente")
    .lte("proxima_tentativa_em", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limite, 200)));
  if (error) throw new Error("FILA_INDISPONIVEL");
  for (const item of candidatas ?? []) {
    if (!ownerValido(item, userId)) {
      falhas++;
      continue;
    }
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
      .select("id, user_id")
      .maybeSingle();
    if (reservaErro) {
      falhas++;
      continue;
    }
    if (!reservada) continue;
    if (reservada.id !== item.id || !ownerValido(reservada, item.user_id)) {
      falhas++;
      continue;
    }
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
                .select("id, user_id")
                .eq("id", item.id)
                .eq("user_id", item.user_id)
                .eq("status", "enviando")
                .eq("lease_expira_em", lease)
                .gt("lease_expira_em", new Date().toISOString())
                .maybeSingle();
              if (ownedErro) throw new Error("LEASE_VALIDACAO_FALHOU");
              const pertence =
                owned?.id === item.id && ownerValido(owned, item.user_id);
              if (!pertence) motivo = "LEASE_NAO_PERTENCE_AO_WORKER";
              return pertence;
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
      .select("id, user_id")
      .maybeSingle();
    if (
      persistida &&
      (persistida.id !== item.id || !ownerValido(persistida, item.user_id))
    ) {
      // Resposta contraditória não é prova para histórico ou marcador.
      ambiguas++;
      falhas++;
      continue;
    }
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
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("USUARIO_ESCOPO_INVALIDO");
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("SAUDE_NOTIFICACOES_INDISPONIVEL");
  const observabilidade = await obterObservabilidadeNotificacoes(sb, userId);
  const { data, error } = await sb
    .from("whatsapp_outbox")
    .select("user_id, status, enviado_em")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("SAUDE_NOTIFICACOES_INDISPONIVEL");
  const linhas = data ?? [];
  if (linhas.some((row: any) => row.user_id !== userId)) throw new Error("SAUDE_NOTIFICACOES_OWNER_DIVERGENTE");
  return {
    ...observabilidade,
    pendentes: linhas.filter((x: any) => x.status === "pendente").length,
    enviando: linhas.filter((x: any) => x.status === "enviando").length,
    falhas: linhas.filter((x: any) => x.status === "falhou").length,
    ambiguas: linhas.filter((x: any) => x.status === "desconhecido").length,
    ultimoEnvioEm: linhas.find((x: any) => x.enviado_em)?.enviado_em ?? null,
  };
}


export type HeartbeatNotificacoes = {
  observedAt: string; runId: string; origem: "github_actions" | "http_secret" | "manus_task";
  escopo: "global" | "project" | "tenant" | "legado";
  dryRun: boolean; fase: "iniciada" | "concluida" | "falhou";
  resultado: "iniciada" | "ok" | "parcial" | "falhou";
};
function parseHeartbeat(raw: unknown, owner: number): HeartbeatNotificacoes | null {
  try {
    if (typeof raw !== "string") return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || value.userId !== owner ||
      typeof value.runId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.runId) ||
      !["github_actions", "http_secret", "manus_task"].includes(value.origem) ||
      (value.escopo !== undefined && (!["global", "project", "tenant"].includes(value.escopo) ||
        (value.origem === "manus_task" ? value.escopo === "global" : value.escopo !== "global"))) ||
      typeof value.dryRun !== "boolean" ||
      !["iniciada", "concluida", "falhou"].includes(value.fase) ||
      !["iniciada", "ok", "parcial", "falhou"].includes(value.resultado) ||
      typeof value.observedAt !== "string" || !Number.isFinite(Date.parse(value.observedAt)) ||
      new Date(value.observedAt).toISOString() !== value.observedAt ||
      (value.fase === "iniciada" && value.resultado !== "iniciada") ||
      (value.fase === "concluida" && !["ok", "parcial"].includes(value.resultado)) ||
      (value.fase === "falhou" && value.resultado !== "falhou")) return null;
    return { observedAt: value.observedAt, runId: value.runId, origem: value.origem, escopo: value.escopo ?? "legado", dryRun: value.dryRun, fase: value.fase, resultado: value.resultado };
  } catch { return null; }
}

/** Observabilidade não enfileira, não envia, não certifica cron. Snapshot
 * limitado é explicitamente uma amostra, e erro de banco nunca vira zero. */
export async function obterObservabilidadeNotificacoes(sb: BancoWhatsApp, userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("USUARIO_ESCOPO_INVALIDO");
  const [{ data: events, error: eventError }, { data: receipts, error: receiptError }] = await Promise.all([
    sb.from("whatsapp_eventos").select("instancia, payload, criado_em")
      .eq("instancia", `user-${userId}`).eq("evento", "SCHEDULED_NOTIFICACOES")
      .order("criado_em", { ascending: false, nullsFirst: false }).limit(100),
    sb.from("notificacoes_log").select("user_id, status")
      .eq("user_id", userId).order("createdAt", { ascending: false }).limit(200),
  ]);
  if (eventError || receiptError) throw new Error("OBSERVABILIDADE_NOTIFICACOES_INDISPONIVEL");
  if ((events ?? []).some(row => row.instancia !== `user-${userId}`) ||
    (receipts ?? []).some(row => row.user_id !== userId)) throw new Error("OBSERVABILIDADE_OWNER_DIVERGENTE");
  const heartbeats = (events ?? []).map(row => parseHeartbeat(row.payload, userId)).filter((value): value is HeartbeatNotificacoes => Boolean(value))
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt) || (a.fase === "iniciada" ? 1 : -1));
  return {
    heartbeat: heartbeats[0] ?? null,
    cadencia: "nao_verificada" as const,
    recibos: {
      aceitosSemRecibo: (receipts ?? []).filter(row => ["enviado", "aceito_evolution"].includes(row.status)).length,
      entregues: (receipts ?? []).filter(row => row.status === "entregue").length,
      lidos: (receipts ?? []).filter(row => row.status === "lido").length,
      limiteAmostra: 200,
    },
    limiteEventos: 100,
  };
}
