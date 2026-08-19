import { describe, expect, it } from "vitest";
import { idsDuplicadosParaRemocao } from "./caixaDuplicidades";

describe("limpeza de transações duplicadas", () => {
  it("preserva o lançamento escolhido e elimina IDs repetidos", () => {
    expect(idsDuplicadosParaRemocao([813, 814, 815, 816, 817, 817], 813)).toEqual([814, 815, 816, 817]);
  });
});
