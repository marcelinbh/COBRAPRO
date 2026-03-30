import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("Supabase REST API Connection", () => {
  it("should connect to Supabase and query users table", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(url, "SUPABASE_URL must be set").toBeTruthy();
    expect(key, "SUPABASE_SERVICE_ROLE_KEY must be set").toBeTruthy();

    const supabase = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("users")
      .select("id, email")
      .limit(1);

    expect(error, `Supabase query error: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  }, 15000);

  it("should be able to read from clientes table", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("clientes")
      .select("id")
      .limit(1);

    // Table may be empty but should not error
    expect(error, `Supabase clientes error: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  }, 15000);
});
