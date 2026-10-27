export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 8;
export const MAX_BLACKLIST_FOTO_BYTES = 2 * 1024 * 1024;
const MAX_BLACKLIST_FOTO_BASE64_LENGTH = Math.ceil(MAX_BLACKLIST_FOTO_BYTES * 4 / 3) + 8;

const FOLDERS_PERMITIDOS: Record<string, string> = {
  "clientes/fotos": "fotos",
  "clientes/documentos": "documentos",
};

const MIME_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MIME_FOTO_BLACKLIST_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadValidado = {
  buffer: Buffer;
  contentType: string;
  nomeSeguro: string;
  pasta: string;
};

function iniciaCom(buffer: Buffer, bytes: number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function temCabecalhoEsperado(buffer: Buffer, contentType: string): boolean {
  switch (contentType) {
    case "image/jpeg":
      return iniciaCom(buffer, [0xff, 0xd8, 0xff]);
    case "image/png":
      return iniciaCom(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
    case "image/webp":
      return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    case "application/pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "application/msword":
    case "application/vnd.ms-excel":
      return iniciaCom(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return iniciaCom(buffer, [0x50, 0x4b, 0x03, 0x04]);
    case "text/plain":
    case "text/csv":
      return !buffer.includes(0);
    default:
      return false;
  }
}

function decodificarBase64(base64: unknown): Buffer {
  if (typeof base64 !== "string" || base64.length === 0 || base64.length > MAX_BASE64_LENGTH) {
    throw new Error("Arquivo ausente ou excede o limite de 10 MB");
  }
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("Conteúdo do arquivo inválido");
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo ausente ou excede o limite de 10 MB");
  }
  return buffer;
}

function decodificarBase64ComLimite(base64: unknown, limiteBytes: number, limiteBase64: number): Buffer {
  if (typeof base64 !== "string" || base64.length === 0 || base64.length > limiteBase64) {
    throw new Error(`Arquivo ausente ou excede o limite de ${limiteBytes / (1024 * 1024)} MB`);
  }
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("Conteúdo do arquivo inválido");
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > limiteBytes) {
    throw new Error(`Arquivo ausente ou excede o limite de ${limiteBytes / (1024 * 1024)} MB`);
  }
  return buffer;
}

function normalizarNomeArquivo(filename: unknown): string {
  if (typeof filename !== "string") throw new Error("Nome do arquivo inválido");
  const nome = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  if (!nome || nome.length > 160) throw new Error("Nome do arquivo inválido");
  return nome;
}

export function validarUploadCliente(body: unknown): UploadValidado {
  if (!body || typeof body !== "object") throw new Error("Dados de upload inválidos");
  const { base64, contentType, filename, folder } = body as Record<string, unknown>;
  if (typeof contentType !== "string" || !MIME_PERMITIDOS.has(contentType)) {
    throw new Error("Tipo de arquivo não permitido");
  }
  if (typeof folder !== "string" || !(folder in FOLDERS_PERMITIDOS)) {
    throw new Error("Destino de upload não permitido");
  }

  const buffer = decodificarBase64(base64);
  if (!temCabecalhoEsperado(buffer, contentType)) {
    throw new Error("O conteúdo não corresponde ao tipo de arquivo informado");
  }

  return {
    buffer,
    contentType,
    nomeSeguro: normalizarNomeArquivo(filename),
    pasta: FOLDERS_PERMITIDOS[folder],
  };
}

export type FotoBlacklistValidada = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extensao: "jpg" | "png" | "webp";
};

/**
 * Fotos compartilhadas da Blacklist aceitam somente formatos de imagem seguros,
 * com conteúdo Base64 canônico, assinatura binária e limite compatível com o
 * limite global de corpo HTTP da aplicação.
 */
export function validarFotoBlacklist(base64: unknown, contentType: unknown): FotoBlacklistValidada {
  if (typeof contentType !== "string" || !MIME_FOTO_BLACKLIST_PERMITIDOS.has(contentType)) {
    throw new Error("A foto deve ser JPEG, PNG ou WEBP");
  }

  const buffer = decodificarBase64ComLimite(base64, MAX_BLACKLIST_FOTO_BYTES, MAX_BLACKLIST_FOTO_BASE64_LENGTH);
  if (!temCabecalhoEsperado(buffer, contentType)) {
    throw new Error("O conteúdo da foto não corresponde ao tipo informado");
  }

  const extensaoPorMime: Record<string, FotoBlacklistValidada["extensao"]> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return {
    buffer,
    contentType: contentType as FotoBlacklistValidada["contentType"],
    extensao: extensaoPorMime[contentType],
  };
}
