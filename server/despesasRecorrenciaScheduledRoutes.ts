import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { Request, Response, Router } from 'express';
import { sdk } from './_core/sdk';
import { callbackBody68 } from '../shared/despesasRecorrencia68';
import { fonte68, gerar68 } from './services/despesasRecorrencia68';
export const PATH_DESPESAS68 = '/api/scheduled/despesas-recorrentes';
export async function despesasRecorrenciaScheduled68(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  const runId = randomUUID();
  try {
    let actor;
    try { actor = await sdk.authenticateRequest(req); } catch { return res.status(403).json({ error: 'CRON68_NAO_AUTORIZADO', runId }); }
    if (actor.isCron !== true || typeof actor.taskUid !== 'string' || !/^[A-Za-z0-9_-]{1,65}$/.test(actor.taskUid)) return res.status(403).json({ error: 'CRON68_NAO_AUTORIZADO', runId });
    if (!callbackBody68.safeParse(req.body === undefined ? {} : req.body).success || Object.keys(req.query ?? {}).length !== 0) return res.status(400).json({ error: 'CORPO68_DEVE_SER_VAZIO', runId });
    const f = await fonte68();
    let geradas = 0, falhas = 0, backlog = false;
    // Transações pequenas, no máximo 12 séries / 96 ocorrências. Cada RPC valida
    // novamente vínculo UID e persiste fairness; falha de um owner não aborta os demais.
    const deadline = Date.now() + 90000;
    for (let n = 0; n < 12 && Date.now() < deadline; n++) {
      const r = await gerar68(f, actor.taskUid, runId);
      geradas += r.geradas; falhas += r.falhas; backlog = r.backlog;
      if (!r.selecionada || !backlog) break;
    }
    return res.status(falhas ? 503 : 200).json({ contrato: 'despesas68_callback_v1', runId, resultado: falhas || backlog ? 'parcial' : 'concluido', geradas, falhas, backlog });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'FORBIDDEN') return res.status(403).json({ error: 'AGENDA68_NAO_VINCULADA', runId });
    return res.status(503).json({ error: 'EXECUCAO68_INDISPONIVEL', runId });
  }
}
export function registerDespesasRecorrenciaScheduledRoutes(app: Router) { app.post(PATH_DESPESAS68, despesasRecorrenciaScheduled68); }
