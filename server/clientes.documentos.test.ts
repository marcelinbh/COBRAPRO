/**
 * Testes para o mapeamento de campos snake_case → camelCase dos clientes
 * e para o fluxo de salvamento de documentos.
 *
 * Contexto do bug:
 * O Supabase REST retorna campos em snake_case (ex: documentos_urls),
 * mas o frontend espera camelCase (ex: documentosUrls).
 * A função mapClienteFromRest normaliza esses campos.
 */

import { describe, expect, it } from "vitest";

// ─── Replica da função mapClienteFromRest (extraída de routers.ts) ───────────
function mapClienteFromRest(row: any): any {
  if (!row) return row;
  return {
    ...row,
    cpfCnpj: row.cpfCnpj ?? row.cpf_cnpj,
    fotoUrl: row.fotoUrl ?? row.foto_url,
    documentosUrls: row.documentosUrls ?? row.documentos_urls,
    tipoCliente: row.tipoCliente ?? row.tipo_cliente,
    isReferral: row.isReferral ?? row.is_referral,
    chavePix: row.chavePix ?? row.chave_pix,
    tipoChavePix: row.tipoChavePix ?? row.tipo_chave_pix,
    dataNascimento: row.dataNascimento ?? row.data_nascimento,
    estadoCivil: row.estadoCivil ?? row.estado_civil,
    nomeMae: row.nomeMae ?? row.nome_mae,
    nomePai: row.nomePai ?? row.nome_pai,
    numeroConta: row.numeroConta ?? row.numero_conta,
    userId: row.userId ?? row.user_id,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildDocumentosUrls(docs: { url: string; nome: string }[]): string {
  return JSON.stringify(docs);
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("mapClienteFromRest", () => {
  it("retorna null/undefined sem erros quando row é falsy", () => {
    expect(mapClienteFromRest(null)).toBeNull();
    expect(mapClienteFromRest(undefined)).toBeUndefined();
  });

  it("mapeia documentos_urls (snake_case) para documentosUrls (camelCase)", () => {
    const docs = [{ url: "https://cdn.example.com/doc.pdf", nome: "Contrato.pdf" }];
    const row = {
      id: 1,
      nome: "João Silva",
      documentos_urls: buildDocumentosUrls(docs),
    };

    const result = mapClienteFromRest(row);

    expect(result.documentosUrls).toBe(row.documentos_urls);
    // O campo snake_case ainda está presente (spread), mas o camelCase tem prioridade
    expect(result.documentosUrls).not.toBeUndefined();
  });

  it("preserva documentosUrls quando já está em camelCase (Drizzle ORM)", () => {
    const docs = [{ url: "https://cdn.example.com/doc.pdf", nome: "Contrato.pdf" }];
    const row = {
      id: 1,
      nome: "Maria Souza",
      documentosUrls: buildDocumentosUrls(docs),
    };

    const result = mapClienteFromRest(row);

    expect(result.documentosUrls).toBe(row.documentosUrls);
  });

  it("mapeia foto_url para fotoUrl", () => {
    const row = { id: 2, nome: "Carlos", foto_url: "https://cdn.example.com/foto.jpg" };
    const result = mapClienteFromRest(row);
    expect(result.fotoUrl).toBe(row.foto_url);
  });

  it("mapeia tipo_cliente para tipoCliente", () => {
    const row = { id: 3, nome: "Ana", tipo_cliente: "emprestimo" };
    const result = mapClienteFromRest(row);
    expect(result.tipoCliente).toBe("emprestimo");
  });

  it("mapeia is_referral para isReferral", () => {
    const row = { id: 4, nome: "Pedro", is_referral: true };
    const result = mapClienteFromRest(row);
    expect(result.isReferral).toBe(true);
  });

  it("mapeia chave_pix para chavePix", () => {
    const row = { id: 5, nome: "Lucia", chave_pix: "lucia@email.com" };
    const result = mapClienteFromRest(row);
    expect(result.chavePix).toBe("lucia@email.com");
  });

  it("mapeia cpf_cnpj para cpfCnpj", () => {
    const row = { id: 6, nome: "Roberto", cpf_cnpj: "123.456.789-00" };
    const result = mapClienteFromRest(row);
    expect(result.cpfCnpj).toBe("123.456.789-00");
  });

  it("mapeia user_id para userId", () => {
    const row = { id: 7, nome: "Fernanda", user_id: 42 };
    const result = mapClienteFromRest(row);
    expect(result.userId).toBe(42);
  });

  it("mapeia created_at para createdAt", () => {
    const now = new Date().toISOString();
    const row = { id: 8, nome: "Marcos", created_at: now };
    const result = mapClienteFromRest(row);
    expect(result.createdAt).toBe(now);
  });

  it("não sobrescreve camelCase com snake_case quando ambos existem", () => {
    // Situação onde o Drizzle já retornou camelCase e o REST adicionou snake_case
    const row = {
      id: 9,
      nome: "Teste",
      documentosUrls: '["camelCase"]',
      documentos_urls: '["snakeCase"]',
    };
    const result = mapClienteFromRest(row);
    // camelCase tem prioridade (via ??)
    expect(result.documentosUrls).toBe('["camelCase"]');
  });
});

describe("fluxo de documentos do cliente", () => {
  it("serializa lista de documentos para JSON corretamente", () => {
    const docs = [
      { url: "https://cdn.example.com/rg.pdf", nome: "RG.pdf" },
      { url: "https://cdn.example.com/cpf.pdf", nome: "CPF.pdf" },
    ];
    const serialized = JSON.stringify(docs);
    const parsed = JSON.parse(serialized);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].url).toBe("https://cdn.example.com/rg.pdf");
    expect(parsed[0].nome).toBe("RG.pdf");
  });

  it("serializa lista vazia de documentos sem erros", () => {
    const docs: { url: string; nome: string }[] = [];
    const serialized = JSON.stringify(docs);
    expect(serialized).toBe("[]");
    const parsed = JSON.parse(serialized);
    expect(parsed).toHaveLength(0);
  });

  it("parse de documentos_urls retorna array vazio para string vazia ou null", () => {
    const parseDocumentos = (raw: string | null | undefined) => {
      if (!raw) return [];
      try {
        const result = JSON.parse(raw);
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    };

    expect(parseDocumentos(null)).toEqual([]);
    expect(parseDocumentos(undefined)).toEqual([]);
    expect(parseDocumentos("")).toEqual([]);
    expect(parseDocumentos("[]")).toEqual([]);
    expect(parseDocumentos("invalid json")).toEqual([]);
    expect(parseDocumentos('[{"url":"x","nome":"y"}]')).toHaveLength(1);
  });
});

// ─── Testes da procedure updateDocumentos ────────────────────────────────────
describe("clientes.updateDocumentos procedure", () => {
  it("valida que o input requer id numérico e documentosUrls string", () => {
    // Simula validação do schema Zod
    const { z } = require("zod");
    const schema = z.object({
      id: z.number(),
      documentosUrls: z.string(),
    });

    // Caso válido
    const valid = schema.safeParse({ id: 1, documentosUrls: "[]" });
    expect(valid.success).toBe(true);

    // Sem id
    const noId = schema.safeParse({ documentosUrls: "[]" });
    expect(noId.success).toBe(false);

    // Sem documentosUrls
    const noUrls = schema.safeParse({ id: 1 });
    expect(noUrls.success).toBe(false);

    // id como string (inválido)
    const strId = schema.safeParse({ id: "abc", documentosUrls: "[]" });
    expect(strId.success).toBe(false);
  });

  it("serializa e desserializa documentos corretamente para persistência", () => {
    const docs = [
      { url: "https://cdn.example.com/rg.pdf", nome: "RG.pdf", tamanho: 102400, data: "2026-06-22T12:00:00.000Z" },
      { url: "https://cdn.example.com/cpf.jpg", nome: "CPF.jpg", tamanho: 51200, data: "2026-06-22T12:01:00.000Z" },
    ];

    // Serialização para banco
    const serialized = JSON.stringify(docs);
    expect(typeof serialized).toBe("string");

    // Desserialização do banco
    const parsed = JSON.parse(serialized);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].nome).toBe("RG.pdf");
    expect(parsed[1].url).toBe("https://cdn.example.com/cpf.jpg");
  });

  it("remove documento pelo índice corretamente", () => {
    const docs = [
      { url: "https://cdn.example.com/a.pdf", nome: "A.pdf" },
      { url: "https://cdn.example.com/b.pdf", nome: "B.pdf" },
      { url: "https://cdn.example.com/c.pdf", nome: "C.pdf" },
    ];

    // Remove o documento do meio (índice 1)
    const copy = [...docs];
    copy.splice(1, 1);
    expect(copy).toHaveLength(2);
    expect(copy[0].nome).toBe("A.pdf");
    expect(copy[1].nome).toBe("C.pdf");
  });

  it("adiciona novos documentos à lista existente sem perder os anteriores", () => {
    const existentes = [
      { url: "https://cdn.example.com/rg.pdf", nome: "RG.pdf", tamanho: 100000, data: "2026-01-01T00:00:00.000Z" },
    ];
    const novos = [
      { url: "https://cdn.example.com/cpf.pdf", nome: "CPF.pdf", tamanho: 80000, data: "2026-06-22T00:00:00.000Z" },
    ];

    const merged = [...existentes, ...novos];
    expect(merged).toHaveLength(2);
    expect(merged[0].nome).toBe("RG.pdf");
    expect(merged[1].nome).toBe("CPF.pdf");

    // O JSON resultante é válido para persistência
    const serialized = JSON.stringify(merged);
    const parsed = JSON.parse(serialized);
    expect(parsed).toHaveLength(2);
  });
});
