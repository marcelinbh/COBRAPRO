import "dotenv/config";
import compression from "compression";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerAuthRoutes } from "../authRoutes";
import { registerWebhookRoutes } from "../webhookRoutes";
import { registerNotificacoesScheduledRoutes } from "../notificacoesScheduledRoutes";
import { registerDespesasRecorrenciaScheduledRoutes } from "../despesasRecorrenciaScheduledRoutes";
import { registerKiwifyWebhookRoutes } from "../kiwifyWebhook";
import { registerBlackListPhotoRoutes } from "../blacklistPhotoRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { possuiSegredoDeAutomacaoValido, possuiTokenGithubActionsValido } from "../services/cronAuth";
import { LIMITE_CORPO_PADRAO, LIMITE_CORPO_UPLOAD, LIMITE_FORMULARIO } from "../requestLimits";
import { cabecalhosSeguranca } from "../securityHeaders";
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
  // Não exponha a tecnologia do servidor em cada resposta pública.
  app.disable("x-powered-by");
  // Compressão gzip/brotli para reduzir tamanho das respostas
  app.use(compression());
  app.use(cabecalhosSeguranca);
  // Somente o endpoint autenticado de documentos recebe o teto maior. O
  // restante da API (login, webhooks e tRPC) não deve aceitar corpos de upload.
  app.use("/api/upload", express.json({ limit: LIMITE_CORPO_UPLOAD }));
  app.use(express.json({
    limit: LIMITE_CORPO_PADRAO,
    // A assinatura Kiwify é HMAC-SHA1 dos bytes originais. Guardar apenas esse
    // corpo, antes do JSON.parse, evita aceitar uma serialização alterada.
    verify: (req, _res, buffer) => {
      if ((req.url ?? "").split("?")[0] === "/api/webhook/kiwify") {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      }
    },
  }));
  app.use(express.urlencoded({ limit: LIMITE_FORMULARIO, extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Auth própria (email/senha)
  registerAuthRoutes(app);
  // Webhook da Evolution API (WhatsApp)
  registerWebhookRoutes(app);
  // Webhook da Kiwify (vendas → criação de usuário + e-mail)
  registerKiwifyWebhookRoutes(app);
  // Fotos da Blacklist são bytes privados, com sessão e elegibilidade revalidadas.
  registerBlackListPhotoRoutes(app);

  // Liveness público: não autentica nem consulta dados de clientes. A rota é
  // deliberadamente leve para que App Platform, Cloudflare e monitoramento
  // externo não recebam o HTML do fallback SPA ao verificar a disponibilidade.
  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, service: 'cobrapro' });
  });

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

  // A rota existente agora resolve taskUid/owner e persiste observação sem PII.
  registerNotificacoesScheduledRoutes(app);
  registerDespesasRecorrenciaScheduledRoutes(app);

  // ─── Heartbeat de status: sem escrita financeira ───────────────────────────
  // O status civil é derivado na listagem. Este endpoint não altera parcelas
  // nem recebe capability para contornar os guards do ciclo prospectivo.
  app.post('/api/scheduled/atualizar-parcelas', async (req, res) => {
    try {
      if (!(await autenticarDisparadorDeAutomacao(req))) {
        return res.status(403).json({ error: 'Acesso exclusivo para automação autorizada' });
      }
      const { dataHojeBrasilia } = await import('../services/businessDate');
      const hoje = dataHojeBrasilia();
      console.log(`[heartbeat/atualizar-parcelas] status civil derivado na leitura (${hoje}); nenhuma parcela alterada`);
      return res.json({ success: true, atualizadas: 0, modo: 'somente_leitura', data: hoje });
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
