import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chaveIntencao, dinheiroIntencao, guardarIntencao, lerIntencao, escopoFinanceiroAtual } from "./EmprestimoSeguroRpc";
const key = "11111111-1111-4111-8111-111111111111";
describe("intenção UI durável", () => {
  it("UUID e payload preservados em reload e tentativa após timeout", () => {
    const data = new Map<string,string>(); const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => { data.set(k,v); } };
    const k = chaveIntencao(1,"receber",2); const intent = { versao: 1 as const, payload: { idempotencyKey: key, valorRecebido: "50.00", dataPagamento: "2026-11-08" } };
    guardarIntencao(storage,k,intent); expect(lerIntencao(storage,k)).toEqual(intent);
    expect(chaveIntencao(2,"receber",2)).not.toBe(k); expect(chaveIntencao(1,"criar")).not.toBe(k);
    expect(lerIntencao(storage,k)).toEqual(lerIntencao(storage,k));
  });
  it("falha de sessão e intenção inválida bloqueiam em vez de fabricar chave", () => {
    expect(() => guardarIntencao({ setItem: () => { throw new Error("quota"); } },"x",{ versao: 1, payload: {} })).toThrow("quota");
    expect(() => lerIntencao({ getItem: () => '{"versao":1,"payload":{"idempotencyKey":"bad"}}' },"x")).toThrow(/inválida/);
    expect(lerIntencao({ getItem: () => null },"x")).toBeNull();
  });
  it.each(["0.001","NaN","Infinity","1e3","-1","1,23"])("dinheiro não sofre desconto/arredondamento %s", value => { expect(() => dinheiroIntencao(value)).toThrow(); });
  it("formata centavos sem precisão binária", () => { expect(dinheiroIntencao("50")).toBe("50.00"); expect(dinheiroIntencao("0001.2")).toBe("1.20"); });
  it("ignora resposta tardia após trocar tenant ou parcela e não aceita sessão vazia", async () => {
    const a = chaveIntencao(1, "receber", 2), b = chaveIntencao(2, "receber", 2);
    const ref = { current: a }; const aceitas: string[] = [];
    const resposta = Promise.resolve().then(() => { if (escopoFinanceiroAtual(ref, a)) aceitas.push(a); });
    ref.current = b; await resposta;
    expect(aceitas).toEqual([]); expect(escopoFinanceiroAtual(ref, a)).toBe(false);
    expect(escopoFinanceiroAtual(ref, b)).toBe(true);
    expect(escopoFinanceiroAtual(ref, chaveIntencao(2, "receber", 3))).toBe(false);
    expect(escopoFinanceiroAtual({ current: "" }, "")).toBe(false);
  });
  it("ambos formulários guardam o retorno RPC antes de publicar confirmação e escondem estado do escopo anterior", () => {
    for (const name of ["EmprestimoSeguroCriar.tsx", "EmprestimoSeguroReceber.tsx"]) {
      const s = readFileSync(new URL(name, import.meta.url), "utf8");
      const retorno = s.indexOf(".mutate(p.payload)");
      const guarda = s.indexOf("if (!escopoFinanceiroAtual", retorno);
      expect(guarda).toBeGreaterThan(retorno);
      expect(guarda).toBeLessThan(s.indexOf("guardarIntencao(sessionStorage, key, confirmed)"));
      expect(s).toContain("escopoDaTela !=="); expect(s).toContain("escopoAtual.current =");
    }
  });
  it("forms realmente usam RPC nova e salvam intenção antes da mutação", () => {
    for(const name of ["EmprestimoSeguroCriar.tsx","EmprestimoSeguroReceber.tsx"]){
      const s=readFileSync(new URL(name,import.meta.url),"utf8");
      expect(s).toContain("guardarIntencao(sessionStorage, key, p)");expect(s).toContain("p.payload");expect(s).toContain("useRef");
      expect(s).not.toContain("registrarPagamento");expect(s).not.toContain("pagarJuros");expect(s).not.toMatch(/\.from\(/);
      expect(s.indexOf("guardarIntencao(sessionStorage, key, p)")).toBeLessThan(s.indexOf(".mutate(p.payload)"));
    }
    const receive=readFileSync(new URL("EmprestimoSeguroReceber.tsx",import.meta.url),"utf8");
    expect(receive).toContain("cicloRpc.cotar.query");expect(receive).not.toContain("calcularJurosMora");expect(receive).toContain("Conta original fixa");
    const contratos=readFileSync(new URL("../pages/Contratos.tsx",import.meta.url),"utf8");
    const parcelas=readFileSync(new URL("../pages/Parcelas.tsx",import.meta.url),"utf8");
    expect(contratos).toContain("<EmprestimoSeguroCriar"); expect(parcelas).toContain("<EmprestimoSeguroReceber");expect(parcelas).not.toContain("<PagamentoDialog");
  });
});
