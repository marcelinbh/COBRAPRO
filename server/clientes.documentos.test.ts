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
