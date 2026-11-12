import { describe, expect, it } from "vitest";
import { clienteCreateInput, clienteUpdateInput, documentoClienteValido } from "../shared/clientesInput";
describe("documentos de clientes somente na entrada nova", () => {
  it.each(["52998224725", "529.982.247-25", "12345678000195", "12.345.678/0001-95", ""])("aceita exemplo verificável ou vazio %s", value => {
    expect(documentoClienteValido(value)).toBe(true);
    expect(clienteCreateInput.safeParse({ nome: "Fixture", cpfCnpj: value }).success).toBe(true);
  });
  it.each(["52998224724", "52998224715", "12345678000199", "11111111111", "00000000000000", "ABC52998224725", "52998224725script", "123"])("recusa documento inválido %s", value => {
    expect(documentoClienteValido(value)).toBe(false);
    expect(clienteUpdateInput.safeParse({ id: 7, cpfCnpj: value }).success).toBe(false);
  });
  it("atualização de outro campo não revalida nem transporta documento antigo", () => {
    const parsed = clienteUpdateInput.parse({ id: 7, nome: "Novo Nome" });
    expect(parsed).not.toHaveProperty("cpfCnpj");
  });
  it("limpar documento continua permitido", () => {
    expect(clienteUpdateInput.parse({ id: 7, cpfCnpj: "" })).toEqual({ id: 7, cpfCnpj: "" });
  });
  it.each(["(55) 91234-5678", "+55 (55) 91234-5678"])("preserva telefone nacional/internacional DDD55 %s", telefone => {
    expect(clienteCreateInput.safeParse({ nome: "Fixture", telefone }).success).toBe(true);
  });
});
