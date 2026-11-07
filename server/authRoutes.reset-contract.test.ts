import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { registerAuthRoutes } from "./authRoutes";
const mocks = vi.hoisted(() => ({
  client: vi.fn(), db: vi.fn(), hash: vi.fn(),
  env: { enableSessionRevocation: false },
}));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./db", () => ({ getDb: mocks.db, getSupabaseClientAsync: mocks.client }));
vi.mock("./_core/sdk", () => ({ sdk: {} }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));

function handler() {
  const app = { post: vi.fn() };
  registerAuthRoutes(app as any);
  const route = app.post.mock.calls.find(([path]) => path === "/api/auth/reset-password")!.at(-1);
  return async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
    await route({ body: { token: "token-local-sintetico", password: "senha-local-sintetica" }, headers: {} }, res);
    return res;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.enableSessionRevocation = false;
  mocks.hash.mockResolvedValue("hash-local-sintetica-00000001");
});

describe("reset com flag desligada — REST compatível sem fallback mutante", () => {
  function rest(column: string, reset: unknown = { user_id: 7 }, resetError: unknown = null) {
    const query: any = {
      eq: vi.fn(() => query), gt: vi.fn(() => query), select: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: reset, error: resetError }),
    };
    const usersQuery: any = {
      eq: vi.fn(() => usersQuery), select: vi.fn(() => usersQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 7 }, error: null }),
    };
    const resetUpdate = vi.fn(() => query);
    const userUpdate = vi.fn(() => usersQuery);
    const rpc = vi.fn();
    const from = vi.fn((table: string) => table === "password_resets" ? {
      select: (name: string) => ({ limit: async () => name === column
        ? { data: [], error: null } : { data: null, error: { code: "42703" } } }),
      update: resetUpdate,
    } : { update: userUpdate });
    mocks.db.mockResolvedValue(null);
    mocks.client.mockResolvedValue({ from, rpc });
    return { run: handler(), resetUpdate, userUpdate, rpc };
  }
  it.each(["used", "usado"])("contrato %s não exige session_version nem RPC enquanto desligado", async (column) => {
    const h = rest(column);
    const res = await h.run();
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Senha alterada com sucesso!" });
    expect(h.resetUpdate).toHaveBeenCalledWith({ [column]: true });
    expect(h.resetUpdate).toHaveBeenCalledTimes(1);
    expect(h.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: "hash-local-sintetica-00000001" }));
    expect(h.rpc).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });
  it("não altera senha se CAS perder a corrida ou token estiver expirado", async () => {
    const h = rest("used", null);
    expect((await h.run()).status).toHaveBeenCalledWith(400);
    expect(h.userUpdate).not.toHaveBeenCalled();
  });
  it("erro na mutação não tenta usado nem altera users", async () => {
    const h = rest("used", null, { code: "42703", message: "erro-sintetico" });
    expect((await h.run()).status).toHaveBeenCalledWith(500);
    expect(h.resetUpdate).toHaveBeenCalledTimes(1);
    expect(h.userUpdate).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("reset Drizzle — consumo e senha dentro da mesma transação", () => {
  function local(columns = [{ name: "used", valid: true }], consumed = [{ user_id: 7 }], updated: unknown[] = [{ id: 7 }]) {
    const returning = vi.fn().mockResolvedValue(updated);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const execute = vi.fn().mockResolvedValueOnce(columns).mockResolvedValueOnce(consumed);
    const tx = { execute, update };
    const transaction = vi.fn((fn: (value: unknown) => Promise<unknown>) => fn(tx));
    const outsideUpdate = vi.fn();
    mocks.db.mockResolvedValue({ transaction, update: outsideUpdate });
    return { run: handler(), transaction, execute, update, outsideUpdate };
  }
  it.each(["used", "usado"])("%s usa identificador escapado com CAS e update no tx", async (column) => {
    const h = local([{ name: column, valid: true }]);
    expect((await h.run()).json).toHaveBeenCalledWith({ success: true, message: "Senha alterada com sucesso!" });
    const dialect = new PgDialect();
    const statement = dialect.sqlToQuery(h.execute.mock.calls[1][0]);
    expect(statement.sql).toContain(`SET "${column}" = true`);
    expect(statement.sql).toContain(`AND "${column}" = false`);
    expect(statement.sql).toContain("RETURNING user_id");
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.outsideUpdate).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("falha de atualização propaga ao transaction para rollback, sem REST", async () => {
    const h = local(undefined, undefined, []);
    expect((await h.run()).status).toHaveBeenCalledWith(500);
    await expect(h.transaction.mock.results[0].value).rejects.toThrow("Usuário associado");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("CAS sem vencedor não atualiza usuário", async () => {
    const h = local(undefined, []);
    expect((await h.run()).status).toHaveBeenCalledWith(400);
    expect(h.update).not.toHaveBeenCalled();
  });
  it.each([{ columns: [] }, { columns: [{ name: "used", valid: true }, { name: "usado", valid: true }] }, { columns: [{ name: "used", valid: false }] }])("contrato inválido impede consumo dentro do tx", async ({ columns }) => {
    const h = local(columns);
    expect((await h.run()).status).toHaveBeenCalledWith(500);
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.update).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
