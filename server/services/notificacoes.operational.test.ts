import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  horarioDiarioVencido,
  persistirHistoricoWhatsApp,
  referenciaVigente,
  fimDeValidadeBrasilia,
  obterProvaPagamento,
  chavePagamento,
  lerChavePagamento,
} from "./notificacoes.operational.safe";
import { substituirVariaveis } from "./notificacoesAutomaticas";

describe("WhatsApp operacional — SDK PostgREST real sem rede", () => {
  it("usa INSERT, lookup 23505 e UPDATE CAS sem on_conflict; nenhuma PII vai ao histórico", async () => {
    const calls: {
      url: URL;
      init: RequestInit;
      body: Record<string, unknown> | null;
    }[] = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.hostname).toBe("postgrest.invalid");
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url, init: init ?? {}, body });
        const headers = { "content-type": "application/json" };
        if (init?.method === "POST")
          return new Response(
            JSON.stringify({
              code: "23505",
              message: "synthetic partial unique duplicate",
              details: null,
              hint: null,
            }),
            { status: 409, headers }
          );
        if (init?.method === "GET")
          return new Response(
            JSON.stringify({
              id: 7,
              status: "aceito_evolution",
              createdAt: "2026-11-10T12:00:00Z",
            }),
            { status: 200, headers }
          );
        if (body?.status)
          return new Response(
            JSON.stringify({
              id: 7,
              status: "lido",
              createdAt: "2026-11-10T12:00:00Z",
            }),
            { status: 200, headers }
          );
        return new Response(null, { status: 204 });
      }
    );
    const sb = createClient("https://postgrest.invalid", "synthetic-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchMock },
    });
    const outboxId = "11111111-1111-4111-8111-111111111111";
    const result = await persistirHistoricoWhatsApp(
      sb,
      {
        id: outboxId,
        user_id: 42,
        tipo: "no_vencimento",
        parcela_id: 1,
        cliente_id: 3,
      },
      "lido"
    );
    expect(result.status).toBe("lido");
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.url.pathname).toBe("/rest/v1/notificacoes_log");
      expect(call.url.searchParams.has("on_conflict")).toBe(false);
      expect(call.body ?? {}).not.toHaveProperty("telefone");
      expect(call.body ?? {}).not.toHaveProperty("mensagem");
    }
    expect(calls[0].init.method).toBe("POST");
    expect(calls[1].url.searchParams.get("outbox_id")).toBe(`eq.${outboxId}`);
    expect(calls[1].url.searchParams.get("user_id")).toBe("eq.42");
    expect(calls[3].init.method).toBe("PATCH");
    expect(calls[3].url.searchParams.get("status")).toBe("eq.aceito_evolution");
    expect(calls[3].body).toEqual({ status: "lido", erro: null });
  });
  it("catch-up vence horário e validade encerra meia-noite BRT, não UTC", () => {
    expect(
      horarioDiarioVencido("09:00", new Date("2026-11-10T12:05:00Z"))
    ).toBe(true);
    expect(
      horarioDiarioVencido("09:00", new Date("2026-11-10T11:59:59Z"))
    ).toBe(false);
    expect(
      referenciaVigente("2026-11-10", new Date("2026-11-11T02:59:59Z"))
    ).toBe(true);
    expect(
      referenciaVigente("2026-11-10", new Date("2026-11-11T03:00:00Z"))
    ).toBe(false);
    expect(fimDeValidadeBrasilia("2026-11-10")).toBe(
      "2026-11-11T03:00:00.000Z"
    );
  });
  const uuid = "11111111-1111-4111-8111-111111111111";
  const prova = {
    parcelaId: 1,
    contratoId: 2,
    clienteId: 3,
    valor: "9999999999999.99",
    dataPagamento: "2026-11-11",
  };
  for (const fonte of [
    "ciclo_operacoes",
    "legados_operacoes",
    "operacoes_financeiras",
  ] as const)
    it(`prova ${fonte} usa apenas POST RPC service-only, sem SELECTs e sem float`, async () => {
      const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = new URL(String(input));
          expect(url.pathname).toBe("/rest/v1/rpc/legados_prova_pagamento");
          expect(url.search).toBe("");
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toEqual({
            p_user_id: 42,
            p_fonte: fonte,
            p_operacao_id: uuid,
          });
          return new Response(
            JSON.stringify({ ...prova, payload: "must not leak" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        }
      );
      const sb = createClient("https://postgrest.invalid", "synthetic-key", {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchMock },
      });
      expect(await obterProvaPagamento(sb, 42, fonte, uuid)).toEqual(prova);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const chave = chavePagamento(42, fonte, uuid);
      expect(lerChavePagamento(chave, 42)).toEqual({ fonte, operacaoId: uuid });
      expect(lerChavePagamento(chave, 99)).toBeNull();
    });
  it("RPC NULL é ausência; erros ou prova malformada falham fechados e não expõem PII", async () => {
    let response: unknown = null;
    let error = false;
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(response), {
          status: error ? 500 : 200,
          headers: { "content-type": "application/json" },
        })
    );
    const sb = createClient("https://postgrest.invalid", "synthetic-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchMock },
    });
    expect(
      await obterProvaPagamento(sb, 42, "legados_operacoes", uuid)
    ).toBeNull();
    for (const patch of [
      { valor: 123.45 },
      { valor: "1e2" },
      { valor: "0.00" },
      { parcelaId: null },
      { clienteId: 0 },
      { dataPagamento: "2026-02-30" },
    ]) {
      response = { ...prova, ...patch };
      await expect(
        obterProvaPagamento(sb, 42, "legados_operacoes", uuid)
      ).rejects.toThrow("PROVA_PAGAMENTO_INDISPONIVEL");
    }
    error = true;
    response = { code: "XX000", message: "raw secret PII" };
    await expect(
      obterProvaPagamento(sb, 42, "legados_operacoes", uuid)
    ).rejects.toThrow(/^PROVA_PAGAMENTO_INDISPONIVEL$/);
  });
  it("fonte renovação/tenant inválido/op inválida não consulta RPC; decimal textual formata sem float", async () => {
    const rpc = vi.fn();
    const sb = { rpc } as any;
    expect(
      await obterProvaPagamento(sb, 42, "renovacao_juros" as any, uuid)
    ).toBeNull();
    expect(
      await obterProvaPagamento(sb, 0, "legados_operacoes", uuid)
    ).toBeNull();
    expect(
      await obterProvaPagamento(sb, 42, "legados_operacoes", "wrong")
    ).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    expect(
      lerChavePagamento(`pagamento:42:renovacao_juros:${uuid}`, 42)
    ).toBeNull();
    expect(
      substituirVariaveis("Recebemos {valor}", { valor: prova.valor })
    ).toBe("Recebemos 9.999.999.999.999,99");
    expect(substituirVariaveis("{valor}", { valor: "123.45" })).toBe("123,45");
  });
});
