import { beforeEach, describe, expect, it, vi } from "vitest";
const { client } = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("../db", () => ({ getSupabaseClientAsync: client }));
import { BLACKLIST_PRIVATE_BUCKET as BUCKET, requirePrivateBlacklistBucket, uploadPrivateBlacklistPhoto, privateBlacklistKey, validatedBlacklistPhotoKey, downloadPrivateBlacklistPhoto, removePrivatePhotoReversibly } from "./blacklistPrivateStorage";
const scope = { userId: 7, blacklistId: 10 };
const key = "00000000-0000-4000-8000-000000000000/7/10.png";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2kY0AAAAASUVORK5CYII=", "base64");
function db() {
  const objects = { upload: vi.fn().mockResolvedValue({ error: null }), remove: vi.fn().mockResolvedValue({ error: null }), download: vi.fn().mockResolvedValue({ data: new Blob([png], { type: "image/png" }), error: null }) };
  const storage = { getBucket: vi.fn().mockResolvedValue({ data: { id: BUCKET, public: false }, error: null }), createBucket: vi.fn().mockResolvedValue({ error: null }), from: vi.fn().mockReturnValue(objects) };
  const sb = { storage }; client.mockResolvedValue(sb); return { sb, storage, objects };
}
beforeEach(() => vi.clearAllMocks());
describe("Blacklist private storage", () => {
  it("bucket privado existente nunca altera metadata", async () => {
    const { sb, storage } = db(); await requirePrivateBlacklistBucket(sb as any);
    expect(storage.createBucket).not.toHaveBeenCalled();
  });
  it("not-found comprovado cria privado e relê", async () => {
    const { sb, storage } = db(); storage.getBucket.mockResolvedValueOnce({ data: null, error: { statusCode: "404" } } as any);
    await requirePrivateBlacklistBucket(sb as any);
    expect(storage.createBucket).toHaveBeenCalledWith(BUCKET, { public: false, fileSizeLimit: 2097152, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
    expect(storage.getBucket).toHaveBeenCalledTimes(2);
  });
  it("corrida de criadores só aceita metadata privada relida", async () => {
    const { sb, storage } = db(); storage.getBucket.mockResolvedValueOnce({ data: null, error: { statusCode: "404" } } as any); storage.createBucket.mockResolvedValue({ error: { statusCode: "409" } } as any);
    await expect(requirePrivateBlacklistBucket(sb as any)).resolves.toBeUndefined();
  });
  it.each([403, 500, 400])("erro %s não permite criar bucket", async statusCode => {
    const { sb, storage } = db(); storage.getBucket.mockResolvedValue({ data: null, error: { statusCode } } as any);
    await expect(requirePrivateBlacklistBucket(sb as any)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(storage.createBucket).not.toHaveBeenCalled();
  });
  it("bucket público fail-closed e nunca público->privado silenciosamente", async () => {
    const { sb, storage } = db(); storage.getBucket.mockResolvedValue({ data: { id: BUCKET, public: true }, error: null });
    await expect(requirePrivateBlacklistBucket(sb as any)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(storage.createBucket).not.toHaveBeenCalled();
  });
  it("upload apenas service_role storage privado e referência sem URL", async () => {
    const { objects, storage } = db(); const result = await uploadPrivateBlacklistPhoto(scope, png.toString("base64"), "image/png");
    expect(result.reference).toBe(`storage://${BUCKET}/${result.key}`); expect(result.key).toMatch(/\/7\/10\.png$/);
    expect(objects.upload).toHaveBeenCalledWith(result.key, png, { contentType: "image/png", upsert: false, cacheControl: "0" });
    expect(storage.from).toHaveBeenCalledWith(BUCKET);
  });
  it.each([
    ["PHN2Zz4=", "image/svg+xml"], ["PHN2Zz4=", "image/png"], ["!invalid!", "image/png"],
    ["data:image/jpeg;base64," + png.toString("base64"), "image/png"], [png.toString("base64"), "image/jpeg"],
  ])("rejeita conteúdo/MIME malicioso", async (base64, mime) => {
    db(); await expect(uploadPrivateBlacklistPhoto(scope, base64, mime)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(client).not.toHaveBeenCalled();
  });
  it("rejeita imagem acima de 2MB antes de storage", async () => {
    db(); const large = Buffer.alloc(2097153); png.copy(large);
    await expect(uploadPrivateBlacklistPhoto(scope, large.toString("base64"), "image/png")).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(client).not.toHaveBeenCalled();
  });
  it("timeout upload storage remove UUID sem INSERT/URL pública", async () => {
    const { objects } = db(); objects.upload.mockRejectedValue(new Error("timeout"));
    await expect(uploadPrivateBlacklistPhoto(scope, png.toString("base64"), "image/png")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(objects.remove).toHaveBeenCalledWith([expect.stringMatching(/\/7\/10\.png$/)]);
  });
  it.each(["https://public.invalid/a.png", "//public/a", "data:image/png;base64,xxx", "storage://logos/anything", "../x", key.replace("/7/", "/8/"), key.replace("/10.", "/11.")])("reference %s recusada", ref => {
    expect(() => privateBlacklistKey(ref, scope)).toThrow();
  });
  it("duas colunas exigem mesmo objeto privado", () => {
    expect(validatedBlacklistPhotoKey({ file_key: key, url: `storage://${BUCKET}/${key}` }, scope)).toBe(key);
    expect(() => validatedBlacklistPhotoKey({ file_key: key, url: "https://public.invalid" }, scope)).toThrow();
  });
  it("download valida magic bytes e MIME sem signed/public URL", async () => {
    db(); const result = await downloadPrivateBlacklistPhoto(key, scope); expect(result.buffer).toEqual(png); expect(result.contentType).toBe("image/png");
  });
  it("download MIME fake/SVG falha fechado", async () => {
    const { objects } = db(); objects.download.mockResolvedValue({ data: new Blob(["<svg/>"], { type: "image/png" }), error: null });
    await expect(downloadPrivateBlacklistPhoto(key, scope)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("delete DB falha restaura bytes privados e propaga erro", async () => {
    const { objects } = db(); const commit = vi.fn().mockRejectedValue(new Error("DB failed"));
    await expect(removePrivatePhotoReversibly(key, scope, commit)).rejects.toThrow("DB failed");
    expect(objects.remove).toHaveBeenCalledWith([key]); expect(objects.upload).toHaveBeenCalledWith(key, png, { contentType: "image/png", upsert: true, cacheControl: "0" });
  });
  it("delete storage falha não chama DB e restaura", async () => {
    const { objects } = db(); objects.remove.mockResolvedValue({ error: { statusCode: "503" } } as any); const commit = vi.fn();
    await expect(removePrivatePhotoReversibly(key, scope, commit)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(commit).not.toHaveBeenCalled(); expect(objects.upload).toHaveBeenCalledTimes(1);
  });
  it("delete confirmado não restaura nem guarda backup em disco", async () => {
    const { objects } = db(); const commit = vi.fn().mockResolvedValue(undefined); await removePrivatePhotoReversibly(key, scope, commit); expect(commit).toHaveBeenCalledTimes(1); expect(objects.upload).not.toHaveBeenCalled();
  });
});
