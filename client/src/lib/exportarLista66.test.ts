import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarExcelLista66, gerarPdfLista66, type RelatorioLista66 } from "./exportarLista66";

const LEGENDA = "Valores em branco = indisponíveis, não zero";
const AVISO = "AVISO: totais indisponiveis; ausencia nao significa zero.";
const FORMULA = '=HYPERLINK("https://evil.invalid/exfil";"Maria")';
const COLUNAS = [
  "ID", "Cliente", "Modalidade", "Situação", "Arquivado",
  "Capital histórico (R$)", "A receber (R$)", "Recebido (R$)",
  "Total parcelas", "Em aberto", "Pagas", "Canceladas", "Transferidas", "Arquivadas",
  "Próximo vencimento", "Data referência",
];

function fixture(overrides: Partial<RelatorioLista66> = {}): RelatorioLista66 {
  return {
    titulo: "Lista filtrada de empréstimos",
    parcial: false,
    avisos: ["Somente leitura do snapshot carregado."],
    metadados: [
      ["Empresa", "Cobrança São José"],
      ["Busca por cliente", "João"],
      ["Capital do escopo (R$)", "1234.5678"],
      ["Data referência", "2026-11-27"],
    ],
    cabecalho: [...COLUNAS],
    linhas: [
      [42, "João da Conceição", "Mensal", "ATIVO", "Não", 1234.5678, 1600.0123, 0, 12, 12, 0, 0, 0, 0, "2026-12-01", "2026-11-27"],
    ],
    ...overrides,
  };
}

async function lerExcel(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const book = new ExcelJS.Workbook();
  // ExcelJS aceita Uint8Array em runtime; sua declaração usa Buffer legado.
  await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
  return book;
}

function strings(sheet: ExcelJS.Worksheet): string[] {
  const result: string[] = [];
  sheet.eachRow(row => row.eachCell(cell => {
    if (typeof cell.value === "string") result.push(cell.value);
  }));
  return result;
}

function cabecalho(sheet: ExcelJS.Worksheet): number {
  let found = 0;
  sheet.eachRow(row => {
    if (row.getCell(1).value === "ID" && row.getCell(2).value === "Cliente") found = row.number;
  });
  expect(found).toBeGreaterThan(0);
  return found;
}

function pdfRaw(bytes: Uint8Array): string {
  return new TextDecoder("windows-1252").decode(bytes);
}

/** Extração de strings literais Tj da saída real não comprimida, sem mock/parser externo. */
function pdfText(bytes: Uint8Array): string {
  const result: string[] = [];
  const literals = /\(((?:\\[\s\S]|[^\\)])*)\)\s*Tj\b/g;
  for (const match of pdfRaw(bytes).matchAll(literals)) {
    result.push(match[1].replace(/\\([0-7]{1,3}|[\s\S])/g, (_, escape: string) => {
      if (/^[0-7]{1,3}$/.test(escape)) return String.fromCharCode(parseInt(escape, 8));
      return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" } as Record<string, string>)[escape] ?? escape;
    }));
  }
  return result.join("\n");
}

function numeroPaginas(bytes: Uint8Array): number {
  return [...pdfRaw(bytes).matchAll(/\/Type\s*\/Page\b/g)].length;
}

function congelar(report: RelatorioLista66): RelatorioLista66 {
  report.metadados.forEach(value => Object.freeze(value));
  report.linhas.forEach(value => Object.freeze(value));
  Object.freeze(report.avisos);
  Object.freeze(report.metadados);
  Object.freeze(report.cabecalho);
  Object.freeze(report.linhas);
  return Object.freeze(report);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("gerarExcelLista66 — binário real", () => {
  it("mantém duas abas, textos, números exatos, datas civis e cabeçalhos estilizados", async () => {
    const report = fixture();
    const bytes = await gerarExcelLista66(report);
    expect(bytes).toBeInstanceOf(Uint8Array);
    const book = await lerExcel(bytes);
    expect(book.worksheets.map(sheet => sheet.name)).toEqual(["Resumo", "Empréstimos"]);
    const summary = book.getWorksheet("Resumo")!;
    const loans = book.getWorksheet("Empréstimos")!;
    const head = cabecalho(loans);
    expect(strings(summary)).toContain(report.titulo);
    expect(strings(summary)).toContain("Cobrança São José");
    expect(strings(summary)).toContain("1234.5678"); // Metadado textual não vira nova conta.
    expect(strings(summary)).toContain(LEGENDA);
    expect(strings(loans)).toContain(LEGENDA);
    expect(loans.getRow(head).values).toEqual([undefined, ...report.cabecalho]);
    report.linhas[0].forEach((value, index) => {
      expect(loans.getCell(head + 1, index + 1).value).toBe(value);
    });
    expect(loans.getCell(head + 1, 6).numFmt).toContain('"R$"');
    expect(loans.getCell(head + 1, 9).numFmt).not.toContain("R$");
    expect(loans.getCell(head + 1, 2).numFmt).toBe("@");
    expect(loans.getCell(head + 1, 2).alignment.wrapText).toBe(true);
    expect(loans.getColumn(2).width).toBeGreaterThan(loans.getColumn(1).width!);
    expect(loans.getCell(head, 1).font).toMatchObject({ bold: true, color: { argb: "FFFFFFFF" } });
    expect(loans.getCell(head, 1).fill).toMatchObject({ type: "pattern", fgColor: { argb: "FF17365D" } });
    expect(loans.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: head });
    expect(loans.autoFilter).toBe(`A${head}:P${head + 1}`);
    expect(loans.pageSetup.printTitlesRow).toBe(`1:${head}`);
    expect(strings(summary).join("\n")).not.toMatch(/RELATÓRIO PARCIAL/);
  });

  it("usa texto escalar seguro em nomes, metadados, título, avisos e cabeçalho sem relações externas", async () => {
    const report = fixture({
      titulo: "=SUM(A1:A2)",
      metadados: [["@empresa", FORMULA], ["Filtro", "  +SUM(A1:A2)"]],
      avisos: ["\t@comando"],
      cabecalho: COLUNAS.map((header, index) => index === 2 ? "-HYPERLINK()" : header),
    });
    report.linhas[0][1] = FORMULA;
    report.linhas[0][2] = "\r\n =1+1";
    report.linhas[0][5] = -1234.5678;
    const bytes = await gerarExcelLista66(report);
    const book = await lerExcel(bytes);
    const loans = book.getWorksheet("Empréstimos")!;
    const summary = strings(book.getWorksheet("Resumo")!);
    const head = cabecalho(loans);
    expect(loans.getCell(head + 1, 2).value).toBe(`'${FORMULA}`);
    // XML normaliza CRLF para LF; o prefixo literal de segurança permanece.
    expect(loans.getCell(head + 1, 3).value).toBe("'\n =1+1");
    expect(loans.getCell(head + 1, 6).value).toBe(-1234.5678);
    expect(loans.getCell(head, 3).value).toBe("'-HYPERLINK()");
    expect(summary).toEqual(expect.arrayContaining(["'=SUM(A1:A2)", "'@empresa", `'${FORMULA}`, "'  +SUM(A1:A2)", "'\t@comando"]));
    for (const sheet of book.worksheets) {
      expect(sheet.state).toBe("visible");
      sheet.eachRow(row => row.eachCell(cell => {
        expect(["string", "number"]).toContain(typeof cell.value);
        expect(cell.formula).toBeUndefined();
        expect(cell.hyperlink).toBeUndefined();
      }));
    }
    const zip = unzipSync(bytes);
    expect(Object.keys(zip).some(name => /externalLinks/.test(name))).toBe(false);
    for (const [name, data] of Object.entries(zip)) {
      if (name.endsWith(".rels")) expect(strFromU8(data)).not.toMatch(/TargetMode="External"|relationships\/hyperlink/);
      if (/xl\/worksheets\/sheet\d+\.xml$/.test(name)) expect(strFromU8(data)).not.toMatch(/<f(?:\s|>)|<hyperlinks\b/);
    }
  });

  it("protege todos os prefixos de fórmula sem mudar textos comuns ou números negativos", async () => {
    const nomes = [FORMULA, "+SUM(A1:A2)", "-1+1", "@HYPERLINK()", "  =1+1", "\t+SUM(A1:A2)", "\r\n @comando", "José", "'texto"];
    const report = fixture({ cabecalho: ["ID", "Cliente", "Capital (R$)"], linhas: nomes.map((nome, index) => [index + 1, nome, -12.3456]) });
    const book = await lerExcel(await gerarExcelLista66(report));
    const loans = book.getWorksheet("Empréstimos")!;
    const head = cabecalho(loans);
    nomes.forEach((nome, index) => {
      const textoXml = nome.replace(/\r\n?/g, "\n");
      expect(loans.getCell(head + index + 1, 2).value).toBe(index < 7 ? `'${textoXml}` : textoXml);
      expect(loans.getCell(head + index + 1, 3).value).toBe(-12.3456);
      expect(loans.getCell(head + index + 1, 2).formula).toBeUndefined();
    });
  });

  it("preserva null vazio e zero numérico e exibe avisos parciais em ambas as abas", async () => {
    const report = fixture({ parcial: true, avisos: [AVISO] });
    report.linhas.push([99, null, null, "Indisponível", null, null, null, null, null, null, null, null, null, null, null, null]);
    const book = await lerExcel(await gerarExcelLista66(report));
    const loans = book.getWorksheet("Empréstimos")!;
    const head = cabecalho(loans);
    expect(loans.getCell(head + 1, 8).value).toBe(0);
    for (const column of [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      expect(loans.getCell(head + 2, column).value).toBeNull();
    }
    expect(loans.getCell(head + 2, 1).value).toBe(99);
    expect(loans.getCell(head + 2, 4).value).toBe("Indisponível");
    for (const sheet of book.worksheets) {
      expect(strings(sheet)).toContain(AVISO);
      expect(strings(sheet).join("\n")).toContain("RELATÓRIO PARCIAL");
      expect(sheet.headerFooter.oddFooter).toContain("RELATÓRIO PARCIAL");
    }
  });

  it("exporta lista apenas indisponível sem presumir dinheiro zero", async () => {
    const report = fixture({
      parcial: true, avisos: [AVISO],
      linhas: [[71, null, null, "Indisponível", null, null, null, null, null, null, null, null, null, null, null, null]],
    });
    const book = await lerExcel(await gerarExcelLista66(report));
    const loans = book.getWorksheet("Empréstimos")!;
    const row = loans.getRow(cabecalho(loans) + 1);
    expect(row.getCell(1).value).toBe(71);
    expect(row.getCell(4).value).toBe("Indisponível");
    for (const column of [6, 7, 8]) expect(row.getCell(column).value).toBeNull();
    expect(strings(loans)).toContain(AVISO);
  });

  it("gera a lista vazia sem fabricar linhas numéricas ou perder contexto", async () => {
    const report = fixture({ linhas: [], avisos: ["Nenhum empréstimo neste filtro; escopo preservado."] });
    const book = await lerExcel(await gerarExcelLista66(report));
    expect(book.worksheets).toHaveLength(2);
    const loans = book.getWorksheet("Empréstimos")!;
    cabecalho(loans);
    expect(strings(loans)).toContain("Nenhum empréstimo nesta lista.");
    expect(strings(book.getWorksheet("Resumo")!)).toContain("1234.5678");
    loans.eachRow(row => row.eachCell(cell => expect(typeof cell.value).not.toBe("number")));
  });
});

describe("gerarPdfLista66 — binário real", () => {
  it("gera PDF A4 paisagem com texto português, metadados e ausência distinta de zero", async () => {
    const report = fixture({ parcial: true, avisos: [AVISO] });
    report.linhas.push([99, null, null, "Indisponível", null, null, null, null, null, null, null, null, null, null, null, null]);
    const bytes = await gerarPdfLista66(report);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    const raw = pdfRaw(bytes);
    const text = pdfText(bytes);
    expect(text).toContain(report.titulo);
    expect(text).toContain(AVISO);
    expect(text).toContain("Empresa: Cobrança São José");
    expect(text).toContain(LEGENDA);
    expect(text.replace(/\s/g, "")).toContain("Indisponível");
    expect(text).toMatch(/R\$\s*0,00/);
    expect(text).toContain("João da Conceição");
    expect(text).toContain("2026-12-01");
    expect(text).toContain("2026-11-27");
    const box = raw.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    expect(box).not.toBeNull();
    expect(Number(box![1])).toBeCloseTo(841.89, 1);
    expect(Number(box![2])).toBeCloseTo(595.28, 1);
    expect(raw).not.toMatch(/\/Subtype\s*\/Link|\/URI\b|\/JavaScript\b|\/JS\b|\/FlateDecode/);
    expect(text).toContain("RELATÓRIO PARCIAL");
    expect(text).toContain(`Página 1 de ${numeroPaginas(bytes)}`);
  });

  it("não interpreta fórmula, markup ou URL como código, HTML ou hyperlink", async () => {
    const report = fixture({ cabecalho: ["ID", "Cliente"], linhas: [[1, FORMULA], [2, '<script>alert("x")</script>']] });
    const bytes = await gerarPdfLista66(report);
    const text = pdfText(bytes);
    expect(text).toContain(FORMULA);
    expect(text).toContain('<script>alert("x")</script>');
    expect(pdfRaw(bytes)).not.toMatch(/\/Subtype\s*\/Link|\/URI\b|\/JavaScript\b/);
  });

  it("pagina metadados e filtros longos antes da tabela, preserva nomes e repete cabeçalho/rodapé", async () => {
    const report = fixture({
      parcial: true,
      avisos: [AVISO],
      metadados: [["Filtro longo", `${"Filtro com São João e Conceição. ".repeat(430)}FIM_METADADOS_66`]],
      linhas: Array.from({ length: 55 }, (_, index) => [
        100 + index,
        `${"Cliente José da Conceição e Maria de São Paulo ".repeat(6)}NOME_${index}_FIM`,
        "Mensal", "ATIVO", "Não", 1250.50, 1400, 0, 12, 12, 0, 0, 0, 0, "2026-12-01", "2026-11-27",
      ]),
    });
    const bytes = await gerarPdfLista66(report);
    const pages = numeroPaginas(bytes);
    const text = pdfText(bytes);
    expect(pages).toBeGreaterThan(3);
    expect(text.replace(/\s/g, "")).toContain("FIM_METADADOS_66");
    for (let index = 0; index < report.linhas.length; index++) {
      expect(text.replace(/\s/g, "")).toContain(`NOME_${index}_FIM`);
    }
    const compact = text.replace(/\s/g, "");
    expect(compact.indexOf("FIM_METADADOS_66")).toBeLessThan(compact.indexOf("NOME_0_FIM"));
    expect((text.match(/RELATÓRIO PARCIAL/g) ?? []).length).toBeGreaterThanOrEqual(pages);
    expect((text.match(/CobraPro \| Lista de empréstimos/g) ?? []).length).toBe(pages);
    for (let page = 1; page <= pages; page++) expect(text).toContain(`Página ${page} de ${pages}`);
    expect((compact.match(/Modalidade/g) ?? []).length).toBeGreaterThan(1);
    // Um único conjunto de 16 colunas, sem quebra horizontal/colunas perdidas.
    expect(text.replace(/\s/g, "")).toContain("Capitalhistórico(R$)");
    expect(text.replace(/\s/g, "")).toContain("Datareferência");
  }, 30_000);

  it("mantém o contexto para lista vazia completa e lista apenas indisponível", async () => {
    const empty = await gerarPdfLista66(fixture({ linhas: [], avisos: [] }));
    expect(pdfText(empty)).toContain("Nenhum empréstimo nesta lista.");
    expect(pdfText(empty)).toContain("Lista filtrada — escopo validado");
    expect(pdfText(empty)).not.toContain("Relatório completo");
    expect(pdfText(empty)).not.toContain("RELATÓRIO PARCIAL");
    const onlyUnavailable = await gerarPdfLista66(fixture({
      parcial: true, avisos: [AVISO],
      linhas: [[71, null, null, "Indisponível", null, null, null, null, null, null, null, null, null, null, null, null]],
    }));
    expect(pdfText(onlyUnavailable)).toContain(AVISO);
    expect(pdfText(onlyUnavailable).replace(/\s/g, "")).toContain("Indisponível");
    expect(pdfText(onlyUnavailable)).not.toMatch(/R\$\s*0,00/);
  });
});

describe("contrato e fronteiras locais de exportação", () => {
  it.each([
    ["Excel", gerarExcelLista66],
    ["PDF", gerarPdfLista66],
  ] as const)("%s não muta snapshot congelado nem datas civis", async (_format, gerar) => {
    const report = congelar(fixture());
    const before = JSON.stringify(report);
    const date = new Date("2026-11-27T12:00:00.000Z");
    const timestamp = date.getTime();
    const bytes = await gerar(report);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(JSON.stringify(report)).toBe(before);
    expect(date.getTime()).toBe(timestamp);
    expect(report.linhas[0][14]).toBe("2026-12-01");
    expect(report.linhas[0][15]).toBe("2026-11-27");
  });

  it("copia o snapshot antes do await, sem ler modificações posteriores", async () => {
    const report = fixture();
    const excel = gerarExcelLista66(report);
    const pdf = gerarPdfLista66(report);
    report.titulo = "MUDADO DEPOIS";
    report.linhas[0][1] = "NOME MUDADO DEPOIS";
    report.metadados[0][1] = "EMPRESA MUDADA";
    report.avisos.push("AVISO MUDADO");
    const [excelBytes, pdfBytes] = await Promise.all([excel, pdf]);
    const book = await lerExcel(excelBytes);
    const loans = book.getWorksheet("Empréstimos")!;
    expect(loans.getCell(cabecalho(loans) + 1, 2).value).toBe("João da Conceição");
    expect(strings(book.getWorksheet("Resumo")!)).toContain("Cobrança São José");
    expect(pdfText(pdfBytes)).toContain("João da Conceição");
    expect(pdfText(pdfBytes)).not.toContain("MUDADO");
  });

  it("não acessa DOM, rede, storage, popup ou download", async () => {
    // Bibliotecas continuam reais; só as fronteiras proibidas são sentinelas.
    await Promise.all([import("exceljs"), import("jspdf"), import("jspdf-autotable")]);
    const forbidden = vi.fn(() => { throw new Error("Efeito externo proibido"); });
    const boundary = new Proxy({}, { get: forbidden, set: forbidden });
    vi.stubGlobal("window", boundary);
    vi.stubGlobal("document", boundary);
    vi.stubGlobal("localStorage", boundary);
    vi.stubGlobal("sessionStorage", boundary);
    vi.stubGlobal("fetch", forbidden);
    vi.stubGlobal("XMLHttpRequest", forbidden);
    vi.stubGlobal("WebSocket", forbidden);
    vi.stubGlobal("open", forbidden);
    vi.stubGlobal("Blob", forbidden);
    const createURL = vi.spyOn(URL, "createObjectURL").mockImplementation(forbidden);
    const revokeURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(forbidden);
    const [excel, pdf] = await Promise.all([gerarExcelLista66(fixture()), gerarPdfLista66(fixture())]);
    expect(excel).toBeInstanceOf(Uint8Array);
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(forbidden).not.toHaveBeenCalled();
    expect(createURL).not.toHaveBeenCalled();
    expect(revokeURL).not.toHaveBeenCalled();
  });

  it.each([
    ["Excel", gerarExcelLista66],
    ["PDF", gerarPdfLista66],
  ] as const)("%s rejeita tipos fora do contrato e números não finitos", async (_format, gerar) => {
    for (const invalid of [NaN, Infinity, -Infinity, undefined, true, new Date("2026-11-27"), { formula: "1+1" }, { text: "Maria", hyperlink: "https://evil.invalid" }]) {
      const report = fixture();
      (report.linhas[0] as unknown[])[1] = invalid;
      await expect(gerar(report)).rejects.toThrow(/Células/);
    }
    await expect(gerar(fixture({ linhas: [[1]] }))).rejects.toThrow(/Quantidade/);
    await expect(gerar(fixture({ cabecalho: [] }))).rejects.toThrow(/colunas/);
    await expect(gerar(fixture({ cabecalho: Array(17).fill("Coluna") }))).rejects.toThrow(/colunas/);
    await expect(gerar(fixture({ titulo: " " }))).rejects.toThrow(/Título/);
    await expect(gerar(fixture({ titulo: "a".repeat(32_768) }))).rejects.toThrow(/Texto inválido/);
    await expect(gerar({ ...fixture(), parcial: "sim" } as unknown as RelatorioLista66)).rejects.toThrow(/Indicador/);
    await expect(gerar({ ...fixture(), metadados: [["Só label"]] } as unknown as RelatorioLista66)).rejects.toThrow(/Metadado/);
    await expect(gerar(null as unknown as RelatorioLista66)).rejects.toThrow(/Relatório inválido/);
    const date = new Date("2026-11-27T00:00:00.000Z");
    const time = date.getTime();
    const report = fixture();
    (report.linhas[0] as unknown[])[14] = date;
    await expect(gerar(report)).rejects.toThrow(/Células/);
    expect(date.getTime()).toBe(time);
  });

  it("rejeita excesso de linhas ou texto antes de gerar, sem truncamento silencioso", async () => {
    const pdfTooLarge = fixture({ linhas: Array.from({ length: 10_001 }, () => [...fixture().linhas[0]]) });
    await expect(gerarPdfLista66(pdfTooLarge)).rejects.toThrow(/10000 linhas.*nenhum dado foi truncado/);
    const excelTooLarge = fixture({ linhas: Array(100_001).fill(fixture().linhas[0]) });
    await expect(gerarExcelLista66(excelTooLarge)).rejects.toThrow(/100000 linhas.*nenhum dado foi truncado/);
    const textTooLarge = fixture({ metadados: Array.from({ length: 62 }, () => ["Filtro", "x".repeat(32_767)]) });
    await expect(gerarPdfLista66(textTooLarge)).rejects.toThrow(/2000000 caracteres/);
    await expect(gerarExcelLista66(textTooLarge)).rejects.toThrow(/2000000 caracteres/);
    const hugeHeader = fixture({ cabecalho: ["Cabeçalho ".repeat(3000)], linhas: [[1]] });
    await expect(gerarPdfLista66(hugeHeader)).rejects.toThrow(/Cabeçalho muito longo/);
  });
});
