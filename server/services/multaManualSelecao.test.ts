import { describe, expect, it, vi } from "vitest";
import { lerCotacoesApresentacaoMulta } from "./multaManualApresentacao";

const row = (id = 20) => ({ id, user_id: 7, contrato_id: 10, multa_manual: "7.50" });
const base = { contratoId: 10, parcelaId: 20, contaCaixaId: 40, elegivel: false, totalExigido: "0.00", multa: "7.50", mora: "1.25", jurosEmbutidos: "10.00", valorPagoAcumulado: "18.75", dataPagamento: "2026-11-23", vencimento: "2026-11-20", status: "renovada", estadoHash: "a".repeat(64), regra: "recebimento_multa36_brt_v1" };
function client(final = base) {
  let quotes = 0;
  return { rpc: vi.fn(async (name: string) => ({ data: name === "rpc_identificar_multa36" ? { userId: 7, contratoId: 10, parcelaId: 20, trilho: "multa36", status: "renovada" } : ++quotes === 1 ? base : final, error: null })) };
}
const ler = (c: ReturnType<typeof client>, reader?: () => Promise<any[]>) => lerCotacoesApresentacaoMulta(c, 7, 10, [row()], "2026-11-23", reader);
describe("Seleção36 reconferida — nunca publicar total sem sucessora", () => {
  it("renovação entre REST e identificação recusa a seleção antiga, mesmo com hash e status de todas quotes iguais", async () => {
    const c = client(), reader = vi.fn().mockResolvedValue([row(), row(21)]);
    await expect(ler(c, reader)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(reader).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledTimes(2);
  });
  it("sem reader explícito não certifica seleção36 por coincidência de hash", async () => {
    const c = client(); await expect(ler(c)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(c.rpc).toHaveBeenCalledOnce();
  });
  it("seleção completa estável faz a conferência final e preserva a cotação encerrada exata", async () => {
    const c = client(), reader = vi.fn().mockResolvedValue([row()]);
    const result = await ler(c, reader); expect(result!.get(20)).toEqual(base);
    expect(reader).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledTimes(3);
  });
  it.each([[], [row(21)], [row(), row()], [{ ...row(), user_id: 8 }], [{ ...row(), contrato_id: 11 }]])("seleção alterada ou estrangeira %j não produz mapa parcial", async rows => {
    await expect(ler(client(), async () => rows)).rejects.toBeInstanceOf(Error);
  });
  it("falha na reconferência não vira lista vazia nem quitação", async () => {
    await expect(ler(client(), async () => { throw Error("offline"); })).rejects.toThrow("offline");
  });
  it.each([{ estadoHash: "b".repeat(64) }, { dataPagamento: "2026-11-24" }, { contaCaixaId: 41 }, { vencimento: "2026-11-21" }])("mudança durante a reconferência %j recusa o snapshot", async patch => {
    await expect(ler(client({ ...base, ...patch }), async () => [row()])).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("getter da reconferência não é executado", async () => {
    let reads = 0; const r = row(); Object.defineProperty(r, "id", { enumerable: true, get() { reads++; return 20; } });
    await expect(ler(client(), async () => [r])).rejects.toBeInstanceOf(Error); expect(reads).toBe(0);
  });
  it("falha de transporte na última quote recusa sem repetir a consulta", async () => {
    const c = client(); let n = 0;
    c.rpc.mockImplementation(async name => {
      if (name === "rpc_identificar_multa36") return { data: { userId: 7, contratoId: 10, parcelaId: 20, trilho: "multa36", status: "renovada" }, error: null };
      if (++n === 2) throw Error("offline-final");
      return { data: base, error: null };
    });
    await expect(ler(c, async () => [row()])).rejects.toBeInstanceOf(Error);
    expect(c.rpc).toHaveBeenCalledTimes(3);
  });
  it("resposta hostil final recusa sem executar getter", async () => {
    let reads = 0; const final = { ...base };
    Object.defineProperty(final, "estadoHash", { enumerable: true, get() { reads++; return base.estadoHash; } });
    const c = client(final);
    await expect(ler(c, async () => [row()])).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(reads).toBe(0); expect(c.rpc).toHaveBeenCalledTimes(3);
  });
  it("mesmo conjunto reordenado não exige ordenação REST estável", async () => {
    const c = client();
    c.rpc.mockImplementation(async (name, ...rest: unknown[]) => {
      const args = rest[0] as { p_parcela_id: number };
      return { data: name === "rpc_identificar_multa36" ? { userId: 7, contratoId: 10, parcelaId: 20, trilho: "multa36", status: "renovada" } : { ...base, parcelaId: args.p_parcela_id }, error: null };
    });
    const result = await lerCotacoesApresentacaoMulta(c, 7, 10, [row(), row(21)], "2026-11-23", async () => [row(21), row()]);
    expect([...result!.keys()]).toEqual([20, 21]); expect(c.rpc).toHaveBeenCalledTimes(4);
  });
});
