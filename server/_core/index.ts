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
    results.version = 'e7614a81-modal-clientes-v3';
    
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

  // ─── Endpoint para tarefa agendada: disparar notificações automáticas do dia ───
  // Chamado pela scheduled task do Manus diariamente
  // Autentica via cookie app_session_id (injetado automaticamente pela plataforma)
  app.post('/api/scheduled/notificacoes', async (req, res) => {
    try {
      const { parse: parseCookieHeader } = await import('cookie');
      const { jwtVerify } = await import('jose');
      const { getSupabaseClientAsync } = await import('../db');
      const { substituirVariaveis, TIPOS_NOTIFICACAO } = await import('../routers/notificacoes');
      const { ENV } = await import('./env');

      // Verificar autenticação via cookie
      const cookies = parseCookieHeader(req.headers.cookie || '');
      const sessionCookie = cookies['app_session_id'];
      if (!sessionCookie) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const sb = await getSupabaseClientAsync();
      if (!sb) return res.status(500).json({ error: 'DB indisponível' });

      // Buscar todos os usuários com notificações ativas globalmente
      const { data: configsAtivos } = await sb
        .from('configuracoes')
        .select('user_id')
        .eq('chave', 'notificacoes_auto_ativo')
        .eq('valor', 'true');

      if (!configsAtivos || configsAtivos.length === 0) {
        return res.json({ processados: 0, mensagem: 'Nenhum usuário com notificações ativas' });
      }

      let totalEnviados = 0;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      for (const cfg of configsAtivos) {
        const userId = cfg.user_id;

        // Buscar regras ativas do usuário
        const { data: regras } = await sb
          .from('notificacoes_automaticas')
          .select('*')
          .eq('user_id', userId)
          .eq('ativo', true);

        if (!regras || regras.length === 0) continue;

        // Pegar nome da empresa
        const { data: empresaConfig } = await sb
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'nomeEmpresa')
          .eq('user_id', userId)
          .maybeSingle();
        const nomeEmpresa = empresaConfig?.valor || 'Empresa';

        for (const regra of regras as { tipo: string; dias_antes: number; mensagem_template: string }[]) {
          const dataAlvo = new Date(hoje);
          dataAlvo.setDate(dataAlvo.getDate() + regra.dias_antes);
          const dataAlvoStr = dataAlvo.toISOString().split('T')[0];

          const { data: parcelasData } = await sb
            .from('parcelas')
            .select('id, valor, numero_parcela, contrato_id, contratos!inner(numero_parcelas, cliente_id, clientes!inner(id, nome, whatsapp, telefone))')
            .eq('user_id', userId)
            .eq('data_vencimento', dataAlvoStr)
            .in('status', ['pendente', 'atrasada']);

          if (!parcelasData || parcelasData.length === 0) continue;

          for (const parcela of (parcelasData as any[])) {
            const cliente = parcela.contratos?.clientes;
            if (!cliente) continue;
            const telefone = cliente.whatsapp || cliente.telefone;
            if (!telefone) continue;

            // Verificar se já enviamos hoje
            const { data: logExistente } = await sb
              .from('notificacoes_log')
              .select('id')
              .eq('user_id', userId)
              .eq('parcela_id', parcela.id)
              .eq('tipo', regra.tipo)
              .gte('createdAt', hoje.toISOString())
              .maybeSingle();
            if (logExistente) continue;

            const mensagem = substituirVariaveis(regra.mensagem_template, {
              nome: cliente.nome,
              valor: parcela.valor,
              data_vencimento: dataAlvoStr.split('-').reverse().join('/'),
              dias_atraso: regra.dias_antes < 0 ? Math.abs(regra.dias_antes) : 0,
              empresa: nomeEmpresa,
              parcela: parcela.numero_parcela,
              total_parcelas: parcela.contratos?.numero_parcelas,
            });

            // Enviar via Evolution API
            const evoUrl = ENV.evolutionApiUrl.replace(/\/$/, '');
            const evoKey = ENV.evolutionApiKey;
            const instanceName = `user-${userId}`;
            let phone = telefone.replace(/\D/g, '');
            if (!phone.startsWith('55')) phone = '55' + phone;

            try {
              const sendRes = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: evoKey },
                body: JSON.stringify({ number: phone + '@s.whatsapp.net', textMessage: { text: mensagem } }),
                signal: AbortSignal.timeout(10000),
              });
              const ok = sendRes.ok;

              await sb.from('notificacoes_log').insert({
                user_id: userId,
                parcela_id: parcela.id,
                cliente_id: cliente.id,
                tipo: regra.tipo,
                telefone,
                mensagem,
                status: ok ? 'enviado' : 'erro',
                erro: ok ? null : 'Falha no envio',
              });

              if (ok) totalEnviados++;
            } catch (e) {
              console.error('[scheduled/notificacoes] Erro ao enviar:', e);
            }
          }
        }
      }

      res.json({ success: true, enviados: totalEnviados, processados: configsAtivos.length });
    } catch (err) {
      console.error('[scheduled/notificacoes] Erro:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Endpoint temporário para migration da tabela contrato_historico ───
  app.post('/api/admin/migration-historico', async (req, res) => {
    try {
      const { getSupabaseClientAsync } = await import('../db');
      const sb = await getSupabaseClientAsync();
      if (!sb) return res.status(500).json({ error: 'DB indisponível' });
      // Verificar se a tabela já existe
      const { data: tableCheck } = await sb.from('contrato_historico').select('id').limit(1);
      if (tableCheck !== null) {
        return res.json({ success: true, message: 'Tabela contrato_historico já existe' });
      }
      return res.json({ success: false, message: 'Tabela não existe - use o Supabase Dashboard para criar' });
    } catch (err: any) {
      if (err?.message?.includes('relation') || err?.code === '42P01') {
        return res.json({ success: false, message: 'Tabela não existe', error: err.message });
      }
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
