import "dotenv/config";
import compression from "compression";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerAuthRoutes } from "../authRoutes";
import { registerWebhookRoutes } from "../webhookRoutes";
import { registerKiwifyWebhookRoutes } from "../kiwifyWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { possuiSegredoDeAutomacaoValido, possuiTokenGithubActionsValido } from "../services/cronAuth";
import { LIMITE_CORPO_PADRAO, LIMITE_CORPO_UPLOAD, LIMITE_FORMULARIO } from "../requestLimits";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Compressão gzip/brotli para reduzir tamanho das respostas
  app.use(compression());
  // Somente o endpoint autenticado de documentos recebe o teto maior. O
  // restante da API (login, webhooks e tRPC) não deve aceitar corpos de upload.
  app.use("/api/upload", express.json({ limit: LIMITE_CORPO_UPLOAD }));
  app.use(express.json({ limit: LIMITE_CORPO_PADRAO }));
  app.use(express.urlencoded({ limit: LIMITE_FORMULARIO, extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Auth própria (email/senha)
  registerAuthRoutes(app);
  // Webhook da Evolution API (WhatsApp)
  registerWebhookRoutes(app);
  // Webhook da Kiwify (vendas → criação de usuário + e-mail)
  registerKiwifyWebhookRoutes(app);

  async function autenticarDisparadorDeAutomacao(req: express.Request): Promise<boolean> {
    if (possuiSegredoDeAutomacaoValido(req)) return true;
    if (await possuiTokenGithubActionsValido(req)) return true;
    try {
      const cronUser = await sdk.authenticateRequest(req);
      return Boolean(cronUser.isCron && cronUser.taskUid);
    } catch {
      return false;
    }
  }

  app.post('/api/scheduled/notificacoes/health', async (req, res) => {
    if (!(await autenticarDisparadorDeAutomacao(req))) {
      return res.status(403).json({ ok: false, error: 'Acesso exclusivo para automação autorizada' });
    }
    const { getSupabaseClientAsync } = await import('../db');
    const sb = await getSupabaseClientAsync();
    if (!sb) return res.status(503).json({ ok: false, service: 'notificacoes-automaticas', database: 'indisponivel' });
    const { error } = await sb.from('whatsapp_outbox').select('id').limit(1);
    return res.status(error ? 503 : 200).json({ ok: !error, service: 'notificacoes-automaticas', database: error ? 'erro' : 'ok' });
  });


  // ─── Endpoint para tarefa agendada: disparar notificações automáticas do dia ───
  // Chamado a cada cinco minutos pelo agendamento externo e filtrado pelo horário
  // escolhido por cada assinante, no fuso horário de Brasília.
  app.post('/api/scheduled/notificacoes', async (req, res) => {
    try {
      const { getSupabaseClientAsync } = await import('../db');
      const { gerarMensagemRelatorio } = await import('../routers/relatorioDiario');
      const { dataHojeBrasilia } = await import('../services/businessDate');
      const { enfileirarLembretesAutomaticos, enfileirarMensagemWhatsApp, processarFilaWhatsApp } = await import('../services/notificacoesAutomaticas');
      const { deveEnviarRelatorioDiario } = await import('../services/relatorioDiarioAutomatico');

      if (!(await autenticarDisparadorDeAutomacao(req))) {
        return res.status(403).json({ error: 'Acesso exclusivo para automação autorizada' });
      }

      const dryRun = req.body?.dryRun === true;

      const sb = await getSupabaseClientAsync();
      if (!sb) return res.status(500).json({ error: 'DB indisponível' });

      const producaoLembretes = await enfileirarLembretesAutomaticos(new Date(), dryRun);
      let relatoriosElegiveis = 0;
      let relatoriosComErro = 0;
      const agora = new Date();
      const dataHoje = dataHojeBrasilia(agora);

      // Relatório diário do gestor: utiliza uma configuração própria e não depende
      // de as mensagens automáticas para clientes estarem habilitadas.
      const { data: configuracoesRelatorio } = await sb
        .from('configuracoes')
        .select('user_id, chave, valor')
        .in('chave', [
          'relatorio_diario_ativo',
          'relatorio_diario_horario',
          'relatorio_diario_telefone',
          'relatorio_diario_ultimo_envio',
        ]);

      const relatoriosPorUsuario = new Map<number, Record<string, string>>();
      for (const item of configuracoesRelatorio || []) {
        const configuracao = relatoriosPorUsuario.get(item.user_id) || {};
        configuracao[item.chave] = item.valor;
        relatoriosPorUsuario.set(item.user_id, configuracao);
      }

      for (const [userId, configuracao] of Array.from(relatoriosPorUsuario.entries())) {
        const deveEnviar = deveEnviarRelatorioDiario({
          ativo: configuracao.relatorio_diario_ativo,
          horario: configuracao.relatorio_diario_horario,
          telefone: configuracao.relatorio_diario_telefone,
          ultimoEnvio: configuracao.relatorio_diario_ultimo_envio,
        }, agora);
        if (!deveEnviar) continue;

        relatoriosElegiveis++;
        const mensagem = await gerarMensagemRelatorio(userId);
        if (!mensagem) {
          relatoriosComErro++;
          continue;
        }

        await enfileirarMensagemWhatsApp({
          userId, tipo: 'relatorio_diario', telefone: configuracao.relatorio_diario_telefone,
          mensagem, dataReferencia: dataHoje,
          chaveDeduplicacao: `relatorio:${userId}:${dataHoje}`,
        }, dryRun);
        if (!dryRun) {
          const { error: marcadorError } = await sb.from('configuracoes').upsert(
          {
            chave: 'relatorio_diario_ultimo_envio',
            valor: dataHoje,
            user_id: userId,
          },
          { onConflict: 'chave,user_id' }
        );
        if (marcadorError) {
          relatoriosComErro++;
          console.error(`[scheduled/notificacoes] Relatório enfileirado sem marcador para usuário ${userId}: ${marcadorError.message}`);
          continue;
        }
        }
      }

      const processamento = await processarFilaWhatsApp(25, dryRun);

      res.json({
        success: true,
        dryRun,
        enviados: processamento.enviadas,
        elegiveis: producaoLembretes.elegiveis,
        processados: producaoLembretes.usuariosNoHorario,
        enfileiradas: producaoLembretes.enfileiradas,
        fila: processamento,
        relatorios: {
          enviados: 0,
          elegiveis: relatoriosElegiveis,
          erros: relatoriosComErro,
        },
        data: dataHoje,
      });
    } catch (err) {
      console.error('[scheduled/notificacoes] Erro:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Heartbeat: atualizar status de parcelas vencidas ───────────────────────
  // Chamado pela scheduled task do Manus diariamente para manter status correto
  app.post('/api/scheduled/atualizar-parcelas', async (req, res) => {
    try {
      if (!(await autenticarDisparadorDeAutomacao(req))) {
        return res.status(403).json({ error: 'Acesso exclusivo para automação autorizada' });
      }
      const { getSupabaseClientAsync } = await import('../db');
      const { dataHojeBrasilia } = await import('../services/businessDate');
      const sb = await getSupabaseClientAsync();
      if (!sb) return res.status(500).json({ error: 'DB indisponível' });
      const hoje = dataHojeBrasilia();
      // Atualizar pendentes/vencendo_hoje com data < hoje → atrasada
      const { data: updated, error } = await sb
        .from('parcelas')
        .update({ status: 'atrasada' })
        .in('status', ['pendente', 'vencendo_hoje'])
        .lt('data_vencimento', hoje)
        .select('id');
      if (error) throw error;
      const count = updated?.length ?? 0;
      console.log(`[heartbeat/atualizar-parcelas] ${count} parcelas atualizadas para atrasada`);
      return res.json({ success: true, atualizadas: count });
    } catch (err: any) {
      console.error('[heartbeat/atualizar-parcelas] Erro:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Heartbeat: ping Supabase para evitar pause automático (a cada 3 dias) ───
  app.post('/api/scheduled/supabase-keepalive', async (req, res) => {
    try {
      if (!(await autenticarDisparadorDeAutomacao(req))) {
        return res.status(403).json({ error: 'Acesso exclusivo para automação autorizada' });
      }
      const { getSupabaseClientAsync } = await import('../db');
      const sb = await getSupabaseClientAsync();
      if (!sb) return res.status(500).json({ error: 'DB indisponível' });
      // Faz uma query leve só para manter o banco ativo
      const { error } = await sb.from('users').select('id').limit(1);
      if (error) throw error;
      console.log('[heartbeat/supabase-keepalive] Supabase ping OK -', new Date().toISOString());
      return res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.error('[heartbeat/supabase-keepalive] Erro:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// Global error handlers to prevent server crashes
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit - keep server running
});

startServer().catch(console.error);
