import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularParcelaPadrao } from "../../shared/finance";
import { calcularEmprestimoProspectivo, criarEmprestimoProspectivoAtomico, dataEmprestimoValida, normalizarResultadoEmprestimoProspectivo, type EntradaEmprestimoProspectivo } from "./emprestimosRpc";

const entrada: EntradaEmprestimoProspectivo = {
  idempotencyKey: "a7987acf-84b2-46c5-a1d1-5fe094f7aa7a", clienteId: 1, contaCaixaId: 1,
  modalidade: "mensal", tipoTaxa: "mensal", valorPrincipal: 500, taxaJuros: 50, numeroParcelas: 3,
  dataInicio: "2026-01-01", dataDesembolso: "2026-01-01",
  vencimentos: ["2026-02-01", "2026-03-01", "2026-04-01"],
};
const result = () => ({
  success: true, repetida: false, id: 33, operationId: "46551afa-b25f-4c45-b898-b1a509cfc95d",
  parcelasIds: [41, 42, 43], transacaoCaixaId: "9223372036854775807",
  valorParcela: "416.67", totalContrato: "1250.00", jurosTotal: "750.00", numeroParcelas: 3,
  dataDesembolso: "2026-01-01", vencimentos: entrada.vencimentos, status: "ativo", regra: "mensal_simples_v1",
});
beforeEach(() => vi.stubEnv("ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS", "true"));
afterEach(() => vi.unstubAllEnvs());

describe("empréstimo prospectivo — cálculo e contrato", () => {
  it("importa helper real e conserva capital, juros e soma sem centavo perdido", () => {
    const c = calcularEmprestimoProspectivo(500, 50, 3);
    expect(Number(c.valorParcela)).toBe(calcularParcelaPadrao(500, 50, 3));
    expect(c.totalContrato).toBe("1250.00");
    expect(c.parcelas).toEqual([{ valor: "416.67", valorJuros: "250.00" }, { valor: "416.67", valorJuros: "250.00" }, { valor: "416.66", valorJuros: "250.00" }]);
    expect(calcularEmprestimoProspectivo(100, 0, 3).parcelas.map(p => p.valor)).toEqual(["33.33", "33.33", "33.34"]);
    expect(calcularEmprestimoProspectivo("0.03", "16.67", 3).parcelas.map(p => p.valorJuros)).toEqual(["0.01", "0.01", "0.00"]);
    expect(calcularEmprestimoProspectivo("0.01", 0, 1).totalContrato).toBe("0.01");
    expect(calcularEmprestimoProspectivo("0.05", 10, 1).jurosTotal).toBe("0.01");
  });
  it.each([[0,0,1], [0.001,0,1], [0.01,0,3], [0.01,33.33,3], [100,0.001,1], [100,1000,1], [100,0,61], [Infinity,0,1], ["9999999999.99",1,1], [100,-1,1]])("recusa extremos e rateios inviáveis %s/%s/%s", (p,t,n) => {
    expect(() => calcularEmprestimoProspectivo(p,t as number,n as number)).toThrow();
  });
  it("valida data civil bissexta sem normalizar datas inválidas", () => {
    expect(dataEmprestimoValida("2028-02-29")).toBe(true);
    for (const d of ["2026-02-29", "2026-04-31", "2026-01-01T00:00:00Z", "1800-01-01"]) expect(dataEmprestimoValida(d)).toBe(false);
  });
});

describe("empréstimo prospectivo — adaptador fail closed", () => {
  it("flag off default bloqueia sem transporte/fallback", async () => {
    vi.stubEnv("ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS", undefined);
    const rpc = vi.fn();
    await expect(criarEmprestimoProspectivoAtomico({rpc}, 1, entrada)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uma única rpc, tenant separado, strings exatas e sem encargos inventados", async () => {
    const rpc = vi.fn().mockResolvedValue({data:result(),error:null});
    const r = await criarEmprestimoProspectivoAtomico({rpc}, 17, {...entrada, descricao:"  proposta  "});
    expect(r.transacaoCaixaId).toBe("9223372036854775807");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rpc_criar_emprestimo", {
      p_user_id:17,p_chave_idempotencia:entrada.idempotencyKey,p_cliente_id:1,p_conta_caixa_id:1,
      p_modalidade:"mensal",p_tipo_taxa:"mensal",p_valor_principal:"500.00",p_taxa_juros:"50.00",p_numero_parcelas:3,
      p_data_inicio:"2026-01-01",p_data_desembolso:"2026-01-01",p_vencimentos:entrada.vencimentos,p_descricao:"proposta",p_observacoes:null,
    });
  });
  it.each([
    {modalidade:"diario"},{modalidade:"tabela_price"},{tipoTaxa:"anual"},{numeroParcelas:61},
    {idempotencyKey:""},{clienteId:1.5},{valorPrincipal:0.001},{taxaJuros:0.001},
    {userId:2},{valorParcela:5},{totalContrato:8},{multaAtraso:0},{jurosMoraDiario:0},{koletorId:2},
    {dataInicio:"2026-02-29"},{desconhecido:true},{dataDesembolso:"2026-01-02"},
    {vencimentos:["2026-01-31","2026-03-03","2026-03-31"]},
    {vencimentos:["2026-02-01","2026-04-01","2026-05-01"]},
    {vencimentos:["2026-02-01"]},
  ])("recusa intenção fora do recorte sem chamada %j", async changes => {
    const rpc = vi.fn();
    await expect(criarEmprestimoProspectivoAtomico({rpc},1,{...entrada,...changes} as EntradaEmprestimoProspectivo)).rejects.toMatchObject({code:"BAD_REQUEST"});
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([0,-1,NaN,1.5,2147483648])("recusa tenant inválido %s", async userId => {
    const rpc=vi.fn();await expect(criarEmprestimoProspectivoAtomico({rpc},userId,entrada)).rejects.toMatchObject({code:"BAD_REQUEST"});expect(rpc).not.toHaveBeenCalled();
  });
  it.each([["23505","CONFLICT"],["23514","CONFLICT"],["42501","NOT_FOUND"],["PGRST202","PRECONDITION_FAILED"],["42P01","PRECONDITION_FAILED"],["22023","BAD_REQUEST"],["XX000","INTERNAL_SERVER_ERROR"]])("mapeia %s sem fallback", async (code, expected) => {
    const rpc=vi.fn().mockResolvedValue({data:null,error:{code}});
    await expect(criarEmprestimoProspectivoAtomico({rpc},1,entrada)).rejects.toMatchObject({code:expected});expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("timeout não promete rollback nem troca chave", async () => {
    const rpc=vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(criarEmprestimoProspectivoAtomico({rpc},1,entrada)).rejects.toThrow("mesma chave");expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    {success:false},{repetida:"true"},{id:"33"},{operationId:"not-uuid"},{parcelasIds:[1,1,2]},
    {parcelasIds:[1,2]},{valorParcela:"416.68"},{totalContrato:"1250.01"},{jurosTotal:"1.00"},
    {valorParcela:null},{totalContrato:1250},{numeroParcelas:2},{dataDesembolso:"2026-01-02"},
    {vencimentos:["2026-02-02","2026-03-02","2026-04-02"]},{status:"quitado"},{regra:"inventada"},
    {transacaoCaixaId:"9223372036854775808"},{transacaoCaixaId:55},{extra:true},
  ])("recusa resposta malformada/divergente %j", changes => {
    expect(() => normalizarResultadoEmprestimoProspectivo({...result(),...changes},entrada)).toThrow();
  });
  it("recusa resposta vazia e aceita replay estrito", () => {
    for(const invalid of [null,{},[],"sucesso"]) expect(() => normalizarResultadoEmprestimoProspectivo(invalid,entrada)).toThrow();
    expect(normalizarResultadoEmprestimoProspectivo({...result(),repetida:true},entrada).repetida).toBe(true);
  });
});
