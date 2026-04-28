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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Auth própria (email/senha)
  registerAuthRoutes(app);
  // Webhook da Evolution API (WhatsApp)
  registerWebhookRoutes(app);
  // Webhook da Kiwify (vendas → criação de usuário + e-mail)
  registerKiwifyWebhookRoutes(app);
  // Diagnostic endpoint to test Supabase connectivity
  app.get('/api/diag', async (req, res) => {
    const results: Record<string, string> = {};
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    // Test 1: DNS resolution
    try {
      const dns = await import('dns').then(m => m.promises);
      const addresses = await dns.lookup(new URL(supabaseUrl).hostname, { all: true });
      results.dns = addresses.map((a: {address: string}) => a.address).join(', ');
    } catch (e) { results.dns = 'FAILED: ' + (e as Error).message; }
    
    // Test 2: fetch with IPv4
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { 'apikey': supabaseKey },
        signal: AbortSignal.timeout(5000)
      });
      results.fetch = `${response.status} ${response.statusText}`;
    } catch (e) { results.fetch = 'FAILED: ' + (e as Error).message; }
    
    // Test 3: NODE_OPTIONS and dns order
    results.nodeVersion = process.version;
    results.nodeOptions = process.env.NODE_OPTIONS || 'not set';
    results.platform = process.platform;
    
    // Test 4: Evolution API connectivity
    try {
      const evoUrl = (process.env.EVOLUTION_API_URL || 'http://147.182.191.118:8080').replace(/\/$/, '');
      const evoKey = process.env.EVOLUTION_API_KEY || 'cobrapro_evo_key_2024';
      results.evoUrl = evoUrl;
      const evoResp = await fetch(`${evoUrl}/instance/fetchInstances`, {
        headers: { apikey: evoKey },
        signal: AbortSignal.timeout(8000)
      });
      const evoBody = await evoResp.text();
      results.evolutionApi = `${evoResp.status} - ${evoBody.substring(0, 200)}`;
    } catch (e) { results.evolutionApi = 'FAILED: ' + (e as Error).message; }
    
    // Test 5: Evolution API send test
    try {
      const evoUrl = (process.env.EVOLUTION_API_URL || 'http://147.182.191.118:8080').replace(/\/$/, '');
      const evoKey = process.env.EVOLUTION_API_KEY || 'cobrapro_evo_key_2024';
      const sendResp = await fetch(`${evoUrl}/message/sendText/user-4682`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({ number: '5511911145280@s.whatsapp.net', textMessage: { text: 'Teste diagnostico producao' } }),
        signal: AbortSignal.timeout(10000)
      });
      const sendBody = await sendResp.text();
      results.evolutionSend = `${sendResp.status} - ${sendBody.substring(0, 300)}`;
    } catch (e) { results.evolutionSend = 'FAILED: ' + (e as Error).message; }
    
    res.json(results);
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
