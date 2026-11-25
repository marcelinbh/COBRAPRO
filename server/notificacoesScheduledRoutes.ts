import { randomUUID } from "node:crypto";
import type { Request, Response, Router } from "express";
import { z } from "zod";
import { sdk } from "./_core/sdk";
import { getSupabaseClientAsync } from "./db";
import { possuiSegredoDeAutomacaoValido, possuiTokenGithubActionsValido } from "./services/cronAuth";
import { dataHojeBrasilia } from "./services/businessDate";
import { gerarMensagemRelatorio } from "./routers/relatorioDiario";
import { deveEnviarRelatorioDiario } from "./services/relatorioDiarioAutomatico";
import { enfileirarLembretesAutomaticos, enfileirarMensagemWhatsApp, processarFilaWhatsApp } from "./services/notificacoesAutomaticas";
import type { BancoWhatsApp } from "./services/notificacoes.operational.safe";

export const AGENDA_PROJECT_ID = "BkqW4WQ4ndZHJQHLtTMfxv";
export const AGENDA_PROJECT_TASK_UID = "cGt8wArds2oGUEpKbRJZo8";
export const AGENDA_PROJECT_REGISTRY_KEY = `__notificacoes_project_task_uid:${AGENDA_PROJECT_ID}`;
export const AGENDA_TENANT_REGISTRY_KEY = "notificacoes_cron_task_uid";
export type EscopoAgenda =
  { escopo: "global"; origem: "github_actions" | "http_secret"; userId?: undefined } |
  { escopo: "project"; origem: "manus_task"; projectId: typeof AGENDA_PROJECT_ID; userId?: undefined } |
  { escopo: "tenant"; origem: "manus_task"; userId: number };
const bodySchema = z.object({ dryRun: z.boolean().default(false) }).strict();
const validOwner = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;

/** GitHub/HTTP preservam a capability global preexistente. A identidade Manus
 * é autenticada pelo SDK; somente seu taskUid procura um registro durável.
 * Projeto exige UID exato + chave reservada + NULL, nunca owner sintético. */
export async function resolverEscopoAgenda(req: Request): Promise<EscopoAgenda | null> {
  if (req.get("x-automation-cron-secret") !== undefined)
    return possuiSegredoDeAutomacaoValido(req) ? { escopo: "global", origem: "http_secret" } : null;
  if (req.get("authorization") !== undefined)
    return await possuiTokenGithubActionsValido(req) ? { escopo: "global", origem: "github_actions" } : null;
  let actor;
  try { actor = await sdk.authenticateRequest(req); } catch { return null; }
  if (actor.isCron !== true || typeof actor.taskUid !== "string" ||
      !/^[A-Za-z0-9_-]{1,65}$/.test(actor.taskUid)) return null;
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("AGENDA_DATABASE_INDISPONIVEL");
  // Mesma leitura detecta duplicatas e colisões entre os dois contratos.
  const { data, error } = await sb.from("configuracoes").select("user_id, chave, valor")
    .in("chave", [AGENDA_TENANT_REGISTRY_KEY, AGENDA_PROJECT_REGISTRY_KEY])
    .eq("valor", actor.taskUid).limit(2);
  if (error) throw new Error("AGENDA_VINCULO_INDISPONIVEL");
  if (data?.length !== 1 || data[0].valor !== actor.taskUid) return null;
  const row = data[0];
  if (actor.taskUid === AGENDA_PROJECT_TASK_UID) {
    if (row.chave !== AGENDA_PROJECT_REGISTRY_KEY || row.user_id !== null) return null;
    // NULL não é unique no índice legado: recusar também chave duplicada com
    // OUTRO valor, sem converter outro UID em autorização de projeto.
    const { data: projectRows, error: projectError } = await sb.from("configuracoes")
      .select("user_id, chave, valor").eq("chave", AGENDA_PROJECT_REGISTRY_KEY).limit(2);
    if (projectError) throw new Error("AGENDA_VINCULO_INDISPONIVEL");
    if (projectRows?.length !== 1 || projectRows[0].user_id !== null ||
        projectRows[0].chave !== AGENDA_PROJECT_REGISTRY_KEY || projectRows[0].valor !== actor.taskUid) return null;
    return { escopo: "project", origem: "manus_task", projectId: AGENDA_PROJECT_ID };
  }
  if (row.chave !== AGENDA_TENANT_REGISTRY_KEY || !validOwner(row.user_id)) return null;
  return { escopo: "tenant", origem: "manus_task", userId: row.user_id };
}

async function ownersDaAgenda(sb: BancoWhatsApp, scope: EscopoAgenda): Promise<number[]> {
  if (scope.userId !== undefined) return [scope.userId];
  const owners = new Set<number>();
  // Também observa OFF: heartbeat não significa ativação, fila nem entrega.
  for (let start = 0; ; start += 500) {
    const { data, error } = await sb.from("configuracoes").select("user_id")
      .in("chave", ["notificacoes_auto_ativo", "relatorio_diario_ativo"])
      .order("id", { ascending: true }).range(start, start + 499);
    if (error || (data ?? []).some(row => !validOwner(row.user_id))) throw new Error("AGENDA_OWNERS_INDISPONIVEIS");
    for (const row of data ?? []) owners.add(row.user_id);
    if ((data ?? []).length < 500) return [...owners];
  }
}

export async function registrarHeartbeatAgenda(
  sb: BancoWhatsApp, owners: number[], scope: EscopoAgenda, runId: string, dryRun: boolean,
  fase: "iniciada" | "concluida" | "falhou", resultado: "iniciada" | "ok" | "parcial" | "falhou", now: Date
): Promise<void> {
  if (owners.some(id => !validOwner(id) || (scope.userId !== undefined && id !== scope.userId)))
    throw new Error("AGENDA_OWNER_INVALIDO");
  // Projeto/global persiste mesmo sem tenants; não cria user-0 ou vínculo fake.
  const targets = scope.escopo === "tenant" ? owners.map(userId => ({ userId, instancia: `user-${userId}` })) :
    [{ userId: undefined, instancia: `project-${AGENDA_PROJECT_ID}` }, ...owners.map(userId => ({ userId, instancia: `user-${userId}` }))];
  for (const target of targets) {
    const { error } = await sb.from("whatsapp_eventos").insert({
      evento: "SCHEDULED_NOTIFICACOES", instancia: target.instancia, criado_em: now.toISOString(),
      payload: JSON.stringify({ version: 1, ...(target.userId === undefined ? { projectId: AGENDA_PROJECT_ID } : { userId: target.userId }),
        runId, origem: scope.origem, escopo: scope.escopo, dryRun, fase, resultado, observedAt: now.toISOString() }),
    });
    if (error) throw new Error("AGENDA_HEARTBEAT_INDISPONIVEL");
  }
}

export function registerNotificacoesScheduledRoutes(app: Router) {
  app.post("/api/scheduled/notificacoes/health", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try {
      const scope = await resolverEscopoAgenda(req);
      if (!scope) return res.status(403).json({ ok: false, error: "Acesso exclusivo para automação autorizada" });
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new Error("AGENDA_DATABASE_INDISPONIVEL");
      let query = sb.from("whatsapp_outbox").select("id, user_id");
      if (scope.userId !== undefined) query = query.eq("user_id", scope.userId);
      const { data, error } = await query.limit(1);
      if (error || (data ?? []).some(row => !validOwner(row.user_id) || (scope.userId !== undefined && row.user_id !== scope.userId)))
        throw new Error("AGENDA_DIAGNOSTICO_INDISPONIVEL");
      return res.json({ ok: true, service: "notificacoes-automaticas", database: "ok", escopo: scope.escopo, cadencia: "nao_verificada" });
    } catch { return res.status(503).json({ ok: false, error: "Diagnóstico da agenda indisponível" }); }
  });
  app.post("/api/scheduled/notificacoes", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const runId = randomUUID();
    let sb: BancoWhatsApp | null = null, scope: EscopoAgenda | null = null, owners: number[] = [];
    let dryRun = false, iniciou = false;
    try {
      scope = await resolverEscopoAgenda(req);
      if (!scope) return res.status(403).json({ error: "Acesso exclusivo para automação autorizada" });
      const body = bodySchema.safeParse(req.body ?? {});
      if (!body.success) return res.status(400).json({ error: "Corpo inválido; somente dryRun booleano é permitido" });
      dryRun = body.data.dryRun;
      sb = await getSupabaseClientAsync();
      if (!sb) throw new Error("AGENDA_DATABASE_INDISPONIVEL");
      owners = await ownersDaAgenda(sb, scope);
      const agora = new Date(), dataHoje = dataHojeBrasilia(agora);
      await registrarHeartbeatAgenda(sb, owners, scope, runId, dryRun, "iniciada", "iniciada", agora);
      iniciou = true;
      const producao = await enfileirarLembretesAutomaticos(agora, dryRun, scope.userId);
      let relatoriosElegiveis = 0, relatoriosComErro = 0;
      const porUsuario = new Map<number, Record<string, string>>();
      for (let start = 0; ; start += 500) {
        let query = sb.from("configuracoes").select("user_id, chave, valor");
        if (scope.userId !== undefined) query = query.eq("user_id", scope.userId);
        const { data: configs, error } = await query.in("chave", ["relatorio_diario_ativo", "relatorio_diario_horario", "relatorio_diario_telefone", "relatorio_diario_ultimo_envio"])
          .order("id", { ascending: true }).range(start, start + 499);
        if (error) throw new Error("AGENDA_RELATORIOS_INDISPONIVEIS");
        for (const item of configs ?? []) {
          if (!validOwner(item.user_id) || (scope.userId !== undefined && item.user_id !== scope.userId)) throw new Error("AGENDA_OWNER_DIVERGENTE");
          const config = porUsuario.get(item.user_id) ?? {};
          if (Object.hasOwn(config, item.chave)) throw new Error("AGENDA_CONFIG_AMBIGUA");
          config[item.chave] = item.valor;
          porUsuario.set(item.user_id, config);
        }
        if ((configs ?? []).length < 500) break;
      }
      for (const [userId, config] of porUsuario) {
        if (!deveEnviarRelatorioDiario({ ativo: config.relatorio_diario_ativo, horario: config.relatorio_diario_horario, telefone: config.relatorio_diario_telefone, ultimoEnvio: config.relatorio_diario_ultimo_envio }, agora)) continue;
        relatoriosElegiveis++;
        try {
          const mensagem = await gerarMensagemRelatorio(userId);
          if (!mensagem) { relatoriosComErro++; continue; }
          await enfileirarMensagemWhatsApp({ userId, tipo: "relatorio_diario", telefone: config.relatorio_diario_telefone, mensagem, dataReferencia: dataHoje, chaveDeduplicacao: `relatorio:${userId}:${dataHoje}` }, dryRun);
        } catch { relatoriosComErro++; }
      }
      const fila = await processarFilaWhatsApp(25, dryRun, scope.userId);
      const resultado = producao.falhasItens || relatoriosComErro || fila.falhas || fila.ambiguas ? "parcial" : "ok";
      await registrarHeartbeatAgenda(sb, owners, scope, runId, dryRun, "concluida", resultado, new Date());
      return res.json({ success: true, runId, escopo: scope.escopo, resultado, dryRun, enviados: fila.enviadas, elegiveis: producao.elegiveis, processados: producao.usuariosNoHorario, enfileiradas: producao.enfileiradas, falhasItens: producao.falhasItens, fila, relatorios: { enviados: fila.relatoriosConcluidos, elegiveis: relatoriosElegiveis, erros: relatoriosComErro }, data: dataHoje });
    } catch {
      if (iniciou && sb && scope) {
        try { await registrarHeartbeatAgenda(sb, owners, scope, runId, dryRun, "falhou", "falhou", new Date()); } catch { /* ausência de terminal permanece observável como iniciada */ }
      }
      console.error("[scheduled/notificacoes] AGENDA_EXECUCAO_FALHOU", runId);
      return res.status(503).json({ error: "Agenda indisponível; consulte o histórico antes de repetir. Resultados ambíguos não autorizam reenvio.", runId });
    }
  });
}
