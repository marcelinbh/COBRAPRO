import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";

// ─── EVOLUTION API GLOBAL CONFIG ─────────────────────────────────────────────
// A URL e API Key são globais do sistema (shared). Cada usuário tem sua própria
// instância nomeada como "user-{userId}" criada automaticamente.

function getGlobalConfig(userId: number): { url: string; apiKey: string; instanceName: string } {
  return {
    url: ENV.evolutionApiUrl.replace(/\/$/, ''),
    apiKey: ENV.evolutionApiKey,
    instanceName: `user-${userId}`,
  };
}

async function evolutionRequest(
  config: { url: string; apiKey: string; instanceName: string },
  method: string,
  path: string,
  body?: unknown
) {
  const fullPath = path.replace('{instance}', config.instanceName);
  const res = await fetch(`${config.url}${fullPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
export const whatsappEvolutionRouter = router({

  // Obter configurações (apenas retorna instanceName para o frontend)
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    return {
      url: config.url,
      instanceName: config.instanceName,
      configured: true,
    };
  }),

  // Criar instância na Evolution API (ou retornar existente)
  createInstance: protectedProcedure.mutation(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);

    // Verificar se a instância já existe
    const existing = await evolutionRequest(config, 'GET', '/instance/connectionState/{instance}');
    if (existing?.instance?.state) {
      return { success: true, alreadyExists: true, state: existing.instance.state };
    }

    // Criar nova instância
    const result = await evolutionRequest(config, 'POST', '/instance/create', {
      instanceName: config.instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });

    return result;
  }),

  // Obter QR Code da instância (cria automaticamente se não existir)
  getQRCode: protectedProcedure.query(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);

    try {
      // Verificar status da conexão
      const status = await evolutionRequest(config, 'GET', '/instance/connectionState/{instance}');

      if (status?.instance?.state === 'open') {
        return { connected: true, qrcode: null, state: 'open', instanceName: config.instanceName };
      }

      // Se instância não existe (404 ou erro), criar automaticamente
      if (!status?.instance?.state || status?.status === 404 || status?.error) {
        await evolutionRequest(config, 'POST', '/instance/create', {
          instanceName: config.instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        });
        // Aguardar um momento para a instância ser criada
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Obter QR Code
      const qrResult = await evolutionRequest(config, 'GET', '/instance/connect/{instance}');

      return {
        connected: false,
        qrcode: qrResult?.base64 || qrResult?.qrcode?.base64 || null,
        state: status?.instance?.state || 'disconnected',
        instanceName: config.instanceName,
      };
    } catch (e) {
      return { connected: false, qrcode: null, error: String(e), state: 'error' };
    }
  }),

  // Verificar status da conexão
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);

    try {
      const status = await evolutionRequest(config, 'GET', '/instance/connectionState/{instance}');
      return {
        connected: status?.instance?.state === 'open',
        configured: true,
        state: status?.instance?.state || 'disconnected',
        instanceName: config.instanceName,
      };
    } catch {
      return { connected: false, configured: true, state: 'error' };
    }
  }),

  // Desconectar instância
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    const result = await evolutionRequest(config, 'DELETE', '/instance/logout/{instance}');
    return result;
  }),

  // Deletar instância
  deleteInstance: protectedProcedure.mutation(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    const result = await evolutionRequest(config, 'DELETE', '/instance/delete/{instance}');
    return result;
  }),

  // Enviar mensagem de texto via Evolution API
  sendMessage: protectedProcedure
    .input(z.object({
      phone: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const config = getGlobalConfig(ctx.user.id);

      // Format phone number: remove non-digits, add 55 if needed
      let phone = input.phone.replace(/\D/g, '');
      if (!phone.startsWith('55')) phone = '55' + phone;
      if (!phone.endsWith('@s.whatsapp.net')) phone = phone + '@s.whatsapp.net';

      const result = await evolutionRequest(config, 'POST', '/message/sendText/{instance}', {
        number: phone,
        text: input.message,
      });

      if (result?.error || result?.status === 400) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result?.message || 'Erro ao enviar mensagem' });
      }

      return { success: true, result };
    }),

  // Verificar se um número está no WhatsApp
  checkNumber: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = getGlobalConfig(ctx.user.id);

      let phone = input.phone.replace(/\D/g, '');
      if (!phone.startsWith('55')) phone = '55' + phone;

      try {
        const result = await evolutionRequest(config, 'POST', '/chat/whatsappNumbers/{instance}', {
          numbers: [phone],
        });

        const numberInfo = Array.isArray(result) ? result[0] : result;
        return { exists: numberInfo?.exists || false, jid: numberInfo?.jid };
      } catch {
        return { exists: false };
      }
    }),
});
