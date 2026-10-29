import { describe, it, expect, beforeAll } from 'vitest';
import { getSupabaseClientAsync } from '../db';

describe('Backup Router - exportarVendas', () => {
  let supabaseClient: any;
  const liveDbTests = process.env.RUN_LIVE_DB_TESTS === '1';

  beforeAll(async () => {
    supabaseClient = await getSupabaseClientAsync();
  });

  it.skipIf(!liveDbTests)('should fetch vendas_telefone data without errors', async () => {
    if (!supabaseClient) {
      console.log('Supabase client not available, skipping test');
      return;
    }

    const { data, error } = await supabaseClient
      .from('vendas_telefone')
      .select('id, user_id, marca, modelo, imei, status')
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it.skipIf(!liveDbTests)('should fetch veiculos data without errors', async () => {
    if (!supabaseClient) {
      console.log('Supabase client not available, skipping test');
      return;
    }

    const { data, error } = await supabaseClient
      .from('veiculos')
      .select('id, user_id, cliente_id, placa, marca, modelo')
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
