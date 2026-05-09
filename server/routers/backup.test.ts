import { describe, it, expect, beforeAll } from 'vitest';
import { getSupabaseClientAsync } from '../db';

describe('Backup Router - exportarVendas', () => {
  let supabaseClient: any;

  beforeAll(async () => {
    supabaseClient = await getSupabaseClientAsync();
  });

  it('should fetch vendas_telefone data without errors', async () => {
    if (!supabaseClient) {
      console.log('Supabase client not available, skipping test');
      return;
    }

    const { data, error } = await supabaseClient
      .from('vendas_telefone')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should fetch veiculos data without errors', async () => {
    if (!supabaseClient) {
      console.log('Supabase client not available, skipping test');
      return;
    }

    const { data, error } = await supabaseClient
      .from('veiculos')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
