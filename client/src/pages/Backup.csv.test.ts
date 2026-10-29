import { describe, expect, it } from "vitest";
import { jsonToCsv } from "./Backup";

describe("exportação CSV do backup", () => {
  it("neutraliza valores textuais que planilhas poderiam executar como fórmula", () => {
    const csv = jsonToCsv([
      { nome: "=HYPERLINK(\"https://exemplo.invalid\")", observacao: "@comando" },
      { nome: "+123", observacao: "-10" },
    ]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@comando");
    expect(csv).toContain("'+123");
    expect(csv).toContain("'-10");
  });

  it("preserva números e escapa vírgula, aspas e quebra de linha", () => {
    const csv = jsonToCsv([{ valor: -10, texto: "a,b\"c\nd" }]);
    expect(csv).toContain("-10");
    expect(csv).toContain('"a,b""c\nd"');
  });
});
