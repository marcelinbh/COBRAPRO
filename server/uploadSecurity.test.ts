import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validarUploadCliente } from "./uploadSecurity";

const pngBase64 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]).toString("base64");

const pdfBase64 = Buffer.from("%PDF-1.7\nconteudo de teste").toString("base64");

describe("validarUploadCliente", () => {
  it("aceita uma imagem PNG válida apenas em um destino permitido", () => {
    const upload = validarUploadCliente({
      base64: pngBase64,
      contentType: "image/png",
      filename: "documento da cliente.png",
      folder: "clientes/fotos",
    });

    expect(upload.pasta).toBe("fotos");
    expect(upload.nomeSeguro).toBe("documento_da_cliente.png");
    expect(upload.contentType).toBe("image/png");
  });

  it("aceita PDF válido para documentos de clientes", () => {
    const upload = validarUploadCliente({
      base64: pdfBase64,
      contentType: "application/pdf",
      filename: "contrato.pdf",
      folder: "clientes/documentos",
    });

    expect(upload.buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("rejeita conteúdo que não corresponde ao MIME declarado", () => {
    expect(() => validarUploadCliente({
      base64: pdfBase64,
      contentType: "image/png",
      filename: "parece-imagem.png",
      folder: "clientes/fotos",
    })).toThrow("O conteúdo não corresponde ao tipo de arquivo informado");
  });

  it("rejeita diretório arbitrário e extensão não confiável", () => {
    expect(() => validarUploadCliente({
      base64: pngBase64,
      contentType: "image/png",
      filename: "../../malicioso.png",
      folder: "blacklist/qualquer-coisa",
    })).toThrow("Destino de upload não permitido");
  });

  it("rejeita base64 inválido e arquivos acima do limite", () => {
    expect(() => validarUploadCliente({
      base64: "isto-não-é-base64",
      contentType: "application/pdf",
      filename: "teste.pdf",
      folder: "clientes/documentos",
    })).toThrow("Conteúdo do arquivo inválido");

    expect(() => validarUploadCliente({
      base64: "A".repeat(Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 12),
      contentType: "application/pdf",
      filename: "grande.pdf",
      folder: "clientes/documentos",
    })).toThrow("Arquivo ausente ou excede o limite de 10 MB");
  });
});
