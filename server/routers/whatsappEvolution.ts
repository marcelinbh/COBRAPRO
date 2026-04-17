import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSupabaseClientAsync } from "../db";

// ─── EVOLUTION API HELPER ─────────────────────────────────────────────────────
async function getEvolutionConfig(): Promise<{ url: string; apiKey: string; instanceName: string } | null> {
  const sb = await getSupabaseClientAsync();
  if (!sb) return null;
  
  const { data } = await sb.from('configuracoes').select('chave, valor').in('chave', [
    'evolution_url', 'evolution_api_key', 'evolution_instance'
  ]);
  
  if (!data || data.length < 3) return null;
  
  const config: Record<string, string> = {};
  data.forEach((row: { chave: string; valor: string }) => { config[row.chave] = row.valor; });
  
  if (!config.evolution_url || !config.evolution_api_key || !config.evolution_instance) return null;
  
  return {
    url: config.evolution_url.replace(/\/$/, ''),
    apiKey: config.evolution_api_key,
    instanceName: config.evolution_instance,
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
  
  // Salvar configurações da Evolution API
  saveConfig: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      apiKey: z.string().min(1),
      instanceName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      
      const configs = [
        { chave: 'evolution_url', valor: input.url },
        { chave: 'evolution_api_key', valor: input.apiKey },
        { chave: 'evolution_instance', valor: input.instanceName },
      ];
      
      for (const cfg of configs) {
        const { data: existing } = await sb.from('configuracoes').select('id').eq('chave', cfg.chave).eq('user_id', ctx.user.id).single();
        if (existing) {
          await sb.from('configuracoes').update({ valor: cfg.valor }).eq('chave', cfg.chave).eq('user_id', ctx.user.id);
        } else {
          await sb.from('configuracoes').insert({ ...cfg, user_id: ctx.user.id });
        }
      }
      
      return { success: true };
    }),

  // Obter configurações salvas
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const sb = await getSupabaseClientAsync();
    if (!sb) return null;
    
    const { data } = await sb.from('configuracoes').select('chave, valor').in('chave', [
      'evolution_url', 'evolution_api_key', 'evolution_instance'
    ]).eq('user_id', ctx.user.id);
    
    if (!data) return null;
    
    const config: Record<string, string> = {};
    data.forEach((row: { chave: string; valor: string }) => { config[row.chave] = row.valor; });
    
    return {
      url: config.evolution_url || '',
      apiKey: config.evolution_api_key || '',
      instanceName: config.evolution_instance || 'cobrapro',
    };
  }),

  // Criar instância na Evolution API
  createInstance: protectedProcedure.mutation(async () => {
    const config = await getEvolutionConfig();
    if (!config) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Configurações da Evolution API não encontradas' });
    
    const result = await evolutionRequest(config, 'POST', '/instance/create', {
      instanceName: config.instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });
    
    return result;
  }),

  // Obter QR Code da instância
  getQRCode: protectedProcedure.query(async () => {
    const config = await getEvolutionConfig();
    if (!config) return { connected: false, qrcode: null, error: 'Configurações não encontradas' };
    
    try {
      // First check connection status
      const status = await evolutionRequest(config, 'GET', '/instance/connectionState/{instance}');
      
      if (status?.instance?.state === 'open') {
        return { connected: true, qrcode: null, state: 'open', instanceName: config.instanceName };
      }
      
      // Get QR Code
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
  getStatus: protectedProcedure.query(async () => {
    const config = await getEvolutionConfig();
    if (!config) return { connected: false, configured: false };
    
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
  disconnect: protectedProcedure.mutation(async () => {
    const config = await getEvolutionConfig();
    if (!config) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Configurações não encontradas' });
    
    const result = await evolutionRequest(config, 'DELETE', '/instance/logout/{instance}');
    return result;
  }),

  // Deletar instância
  deleteInstance: protectedProcedure.mutation(async () => {
    const config = await getEvolutionConfig();
    if (!config) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Configurações não encontradas' });
    
    const result = await evolutionRequest(config, 'DELETE', '/instance/delete/{instance}');
    return result;
  }),

  // Enviar mensagem de texto via Evolution API
  sendMessage: protectedProcedure
    .input(z.object({
      phone: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      const config = await getEvolutionConfig();
      if (!config) throw new TRPCError({ code: 'BAD_REQUEST', message: 'WhatsApp não configurado' });
      
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
    .query(async ({ input }) => {
      const config = await getEvolutionConfig();
      if (!config) return { exists: false };
      
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
