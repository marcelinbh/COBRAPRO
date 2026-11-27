import { textoSeguroParaPlanilha } from "./spreadsheetSafety";
import type { Cell, Row, Worksheet } from "exceljs";
import type { UserOptions } from "jspdf-autotable";
import type { RelatorioLista66 } from "./relatorioLista66";
export type { RelatorioLista66 } from "./relatorioLista66";

const LEGENDA = "Valores em branco = indisponíveis, não zero";
const NAVY = "17365D";
const BLUE = "245A81";
const MAX_TEXTO = 32_767; // Limite de texto de uma célula XLSX.
const MAX_CARACTERES = 2_000_000;
const MAX_LINHAS_EXCEL = 100_000;
const MAX_LINHAS_PDF = 10_000;
const FORMATO_BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';

/** Valida e copia antes do primeiro await, preservando o snapshot da chamada. */
function snapshot(relatorio: RelatorioLista66, maxLinhas: number): RelatorioLista66 {
  if (!relatorio || typeof relatorio !== "object") {
    throw new TypeError("Relatório inválido.");
  }
  let caracteres = 0;
  const texto = (value: unknown): string => {
    if (typeof value !== "string" || value.length > MAX_TEXTO) {
      throw new TypeError(`Texto inválido: máximo de ${MAX_TEXTO} caracteres por campo.`);
    }
    caracteres += value.length;
    if (caracteres > MAX_CARACTERES) {
      throw new RangeError(`Relatório excede ${MAX_CARACTERES} caracteres de texto.`);
    }
    return value;
  };
  if (typeof relatorio.parcial !== "boolean") {
    throw new TypeError("Indicador de relatório parcial inválido.");
  }
  const titulo = texto(relatorio.titulo);
  if (!titulo.trim()) throw new TypeError("Título do relatório não pode ser vazio.");
  if (!Array.isArray(relatorio.cabecalho) || relatorio.cabecalho.length < 1 || relatorio.cabecalho.length > 16) {
    throw new RangeError("O relatório deve conter entre 1 e 16 colunas.");
  }
  const cabecalho = Array.from(relatorio.cabecalho, texto);
  if (cabecalho.some(value => !value.trim())) throw new TypeError("Cabeçalho vazio.");
  if (!Array.isArray(relatorio.avisos) || relatorio.avisos.length > 1_000 ||
      !Array.isArray(relatorio.metadados) || relatorio.metadados.length > 1_000) {
    throw new RangeError("Máximo de 1.000 avisos e 1.000 metadados.");
  }
  const avisos = Array.from(relatorio.avisos, texto);
  const metadados = Array.from(relatorio.metadados, item => {
    if (!Array.isArray(item) || item.length !== 2) throw new TypeError("Metadado inválido.");
    return [texto(item[0]), texto(item[1])] as [string, string];
  });
  if (!Array.isArray(relatorio.linhas) || relatorio.linhas.length > maxLinhas) {
    throw new RangeError(`Exportação limitada a ${maxLinhas} linhas; nenhum dado foi truncado.`);
  }
  const linhas = Array.from(relatorio.linhas, linha => {
    if (!Array.isArray(linha) || linha.length !== cabecalho.length) {
      throw new TypeError("Quantidade de células diferente do cabeçalho.");
    }
    return Array.from(linha, value => {
      if (value === null) return null;
      if (typeof value === "string") return texto(value);
      if (typeof value === "number" && Number.isFinite(value)) return value;
      // Não aceitar datas, objetos de fórmula, hyperlinks ou coerções implícitas.
      throw new TypeError("Células devem conter somente texto, número finito ou null.");
    });
  });
  return { titulo, parcial: relatorio.parcial, avisos, metadados, cabecalho, linhas };
}

function normalizarCabecalho(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function colunaMonetaria(cabecalho: string): boolean {
  const nome = normalizarCabecalho(cabecalho);
  if (/\b(id|codigo|numero|quantidade|qtd|parcelas|dias|taxa|percentual)\b|%/.test(nome)) return false;
  return /valor|capital|principal|juros|saldo|recebid|receber|pago|pagar|multa|desconto|total|lucro|retorno/.test(nome);
}

function larguraColuna(cabecalho: string): number {
  const nome = normalizarCabecalho(cabecalho);
  if (/cliente|nome|empresa|filtro|observa/.test(nome)) return 36;
  if (/status|situacao|modalidade|frequencia/.test(nome)) return 21;
  if (/data|vencimento|inicio|fim/.test(nome)) return 19;
  if (colunaMonetaria(cabecalho)) return 19;
  if (/\bid\b|codigo|numero|qtd|quantidade/.test(nome)) return 12;
  return 18;
}

function textoExcel(cell: Cell, value: string): void {
  // Valor escalar de texto, nunca { formula }, { hyperlink } ou richText.
  const seguro = textoSeguroParaPlanilha(value);
  if (seguro.length > MAX_TEXTO) throw new RangeError("Texto protegido excede o limite de uma célula XLSX.");
  cell.value = seguro;
  cell.numFmt = "@";
  cell.alignment = { vertical: "top", wrapText: true };
}

function alturaTexto(value: string, width: number): number {
  const linhas = value.split(/\r\n|\r|\n/).reduce((total, linha) =>
    total + Math.max(1, Math.ceil(linha.length / Math.max(1, width))), 0);
  return Math.min(409, Math.max(23, linhas * 13 + 8));
}

function cabecalhoExcel(row: Row, color = NAVY): void {
  row.height = Math.max(row.height ?? 0, 30);
  row.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function faixaExcel(sheet: Worksheet, value: string, columns: number, warning = false): Row {
  const row = sheet.addRow([]);
  if (columns > 1) sheet.mergeCells(row.number, 1, row.number, columns);
  textoExcel(row.getCell(1), value);
  row.height = alturaTexto(value, columns === 2 ? 94 : columns * 15);
  row.getCell(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: warning ? "FFFFE5B4" : "FFEAF1F8" },
  };
  row.getCell(1).font = {
    name: "Calibri", size: 11, bold: warning, color: { argb: warning ? "FF7A3E00" : `FF${NAVY}` },
  };
  return row;
}

function estado(relatorio: RelatorioLista66): string {
  return relatorio.parcial ? "RELATÓRIO PARCIAL — dados indisponíveis; consulte os avisos." : "Lista filtrada — escopo validado";
}

/** Só gera bytes locais. A UI é responsável pelo owner/stale guard e pelo download. */
export async function gerarExcelLista66(relatorio: RelatorioLista66): Promise<Uint8Array> {
  const report = snapshot(relatorio, MAX_LINHAS_EXCEL);
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "CobraPro";
  book.title = report.titulo;
  const resumo = book.addWorksheet("Resumo");
  resumo.columns = [{ width: 28 }, { width: 78 }];
  cabecalhoExcel(faixaExcel(resumo, report.titulo, 2));
  faixaExcel(resumo, estado(report), 2, report.parcial);
  faixaExcel(resumo, LEGENDA, 2);
  resumo.addRow([]);
  const metaHead = resumo.addRow([]);
  textoExcel(metaHead.getCell(1), "Informação");
  textoExcel(metaHead.getCell(2), "Valor");
  cabecalhoExcel(metaHead, BLUE);
  resumo.views = [{ state: "frozen", ySplit: metaHead.number }];
  for (const [label, value] of report.metadados) {
    const row = resumo.addRow([]);
    textoExcel(row.getCell(1), label);
    textoExcel(row.getCell(2), value);
    row.height = Math.max(alturaTexto(label, 26), alturaTexto(value, 76));
  }
  if (report.avisos.length) {
    resumo.addRow([]);
    cabecalhoExcel(faixaExcel(resumo, "Avisos", 2), BLUE);
    report.avisos.forEach(aviso => faixaExcel(resumo, aviso, 2, true));
  }

  const loans = book.addWorksheet("Empréstimos");
  loans.columns = report.cabecalho.map(header => ({
    width: larguraColuna(header), style: { font: { name: "Calibri", size: 11 } },
  }));
  const count = report.cabecalho.length;
  cabecalhoExcel(faixaExcel(loans, report.titulo, count));
  faixaExcel(loans, estado(report), count, report.parcial);
  faixaExcel(loans, LEGENDA, count);
  report.avisos.forEach(aviso => faixaExcel(loans, aviso, count, true));
  const head = loans.addRow([]);
  report.cabecalho.forEach((value, index) => textoExcel(head.getCell(index + 1), value));
  head.height = Math.max(30, ...report.cabecalho.map(value => alturaTexto(value, 17)));
  cabecalhoExcel(head);
  loans.views = [{ state: "frozen", xSplit: count > 1 ? 1 : 0, ySplit: head.number }];
  report.linhas.forEach((values, index) => {
    const row = loans.addRow([]);
    let height = 23;
    values.forEach((value, column) => {
      const cell = row.getCell(column + 1);
      cell.alignment = { vertical: "top", wrapText: true };
      if (typeof value === "string") {
        textoExcel(cell, value);
        height = Math.max(height, alturaTexto(value, larguraColuna(report.cabecalho[column]) - 2));
      } else {
        cell.value = value; // null é célula vazia; zero permanece um número zero.
        if (typeof value === "number") {
          cell.numFmt = colunaMonetaria(report.cabecalho[column]) ? FORMATO_BRL : "0.###############";
          cell.alignment = { vertical: "top", horizontal: "right", wrapText: true };
        }
      }
      if (index % 2 === 1) cell.fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F5FA" },
      };
    });
    row.height = height;
  });
  loans.autoFilter = {
    from: { row: head.number, column: 1 },
    to: { row: Math.max(head.number, loans.rowCount), column: count },
  };
  if (!report.linhas.length) faixaExcel(loans, "Nenhum empréstimo nesta lista.", count);
  loans.pageSetup = {
    orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: `1:${head.number}`,
  };
  resumo.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  for (const sheet of [resumo, loans]) {
    sheet.headerFooter.oddFooter = `&L${report.parcial ? "RELATÓRIO PARCIAL" : "Lista filtrada — escopo validado"}&RPágina &P de &N`;
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}

/** PDF A4 paisagem, sem DOM, fontes remotas, imagens, HTML ou download. */
export async function gerarPdfLista66(relatorio: RelatorioLista66): Promise<Uint8Array> {
  const report = snapshot(relatorio, MAX_LINHAS_PDF);
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  // Sem compressão: permite auditar conteúdo textual do binário com ferramentas simples.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: false, putOnlyUsedFonts: true });
  doc.setProperties({ title: report.titulo, creator: "CobraPro" });
  doc.setFont("helvetica", "normal");
  doc.setLineHeightFactor(1.18);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const top = 20;
  const bottom = pageHeight - 18;
  let y = top;

  function novaPagina(): void {
    doc.addPage();
    y = top;
  }

  // Cada parágrafo é medido e repartido em linhas/páginas; não há corte silencioso.
  function paragrafo(text: string, options: { size?: number; bold?: boolean; warning?: boolean; gap?: number } = {}): void {
    const size = options.size ?? 9;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lineHeight = size / doc.internal.scaleFactor * 1.18;
    const padding = options.warning ? 2 : 0;
    const lines: string[] = doc.splitTextToSize(text || " ", contentWidth - padding * 2);
    let index = 0;
    while (index < lines.length) {
      const available = Math.floor((bottom - y - padding * 2) / lineHeight);
      if (available < 1) { novaPagina(); continue; }
      const chunk = lines.slice(index, index + available);
      if (options.warning) {
        doc.setFillColor(255, 229, 180);
        doc.rect(margin, y, contentWidth, chunk.length * lineHeight + padding * 2, "F");
        doc.setTextColor(122, 62, 0);
      } else doc.setTextColor(23, 54, 93);
      chunk.forEach((line, offset) => doc.text(line, margin + padding, y + padding + lineHeight * (offset + 0.82)));
      y += chunk.length * lineHeight + padding * 2;
      index += chunk.length;
      if (index < lines.length) novaPagina();
    }
    y += options.gap ?? 2;
  }

  paragrafo(report.titulo, { size: 14, bold: true, gap: 3 });
  paragrafo(estado(report), { bold: true, warning: report.parcial });
  paragrafo(LEGENDA, { size: 8 });
  if (report.avisos.length) {
    paragrafo("Avisos", { bold: true });
    report.avisos.forEach(aviso => paragrafo(aviso, { warning: true, size: 8 }));
  }
  paragrafo("Resumo", { size: 10, bold: true });
  report.metadados.forEach(([label, value]) => paragrafo(`${label}: ${value}`, { size: 8.5 }));

  if (y > bottom - 26) novaPagina();
  paragrafo("Empréstimos", { size: 10, bold: true });
  const weights = report.cabecalho.map(larguraColuna);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const columnStyles: NonNullable<UserOptions["columnStyles"]> = {};
  report.cabecalho.forEach((header, index) => {
    columnStyles[index] = {
      cellWidth: contentWidth * weights[index] / sum,
      halign: colunaMonetaria(header) ? "right" : "left",
    };
  });
  // autoTable não divide um cabeçalho repetido maior que a página: rejeitar,
  // em vez de causar overflow ou reentrância infinita no renderer.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const headLines = Math.max(...report.cabecalho.map((header, index) =>
    (doc.splitTextToSize(header, contentWidth * weights[index] / sum - 2) as string[]).length));
  const headHeight = headLines * 7 / doc.internal.scaleFactor * 1.18 + 2;
  if (headHeight > bottom - top - 15) {
    throw new RangeError("Cabeçalho muito longo para uma página PDF; nenhum dado foi truncado.");
  }
  if (y + headHeight + 10 > bottom) novaPagina();
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 20 });
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top, bottom: pageHeight - bottom },
    tableWidth: contentWidth,
    head: [report.cabecalho],
    body: report.linhas.map(row => row.map((value, index) => {
      if (value === null) return "Indisponível";
      if (typeof value === "number") return colunaMonetaria(report.cabecalho[index]) ? brl.format(value) : number.format(value);
      return value;
    })),
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "auto", // Permite nomes maiores que uma página sem overflow.
    horizontalPageBreak: false,
    styles: { font: "helvetica", fontSize: 6.8, cellPadding: 1, overflow: "linebreak", valign: "top", lineColor: [213, 225, 237], lineWidth: 0.15 },
    headStyles: { fontSize: 7, fillColor: [23, 54, 93], textColor: 255, fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [240, 245, 250] },
    columnStyles,
  });
  if (!report.linhas.length) {
    // O cabeçalho é preservado, sem fabricar uma linha de empréstimo.
    const last = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable;
    y = last?.finalY ?? y;
    y += 3;
    paragrafo("Nenhum empréstimo nesta lista.", { size: 8 });
  }

  // Desenha depois da paginação para incluir resumo multipágina e total correto.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(23, 54, 93);
    doc.text("CobraPro | Lista de empréstimos", margin, 11);
    doc.setDrawColor(36, 90, 129);
    doc.line(margin, 14, pageWidth - margin, 14);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFontSize(7);
    doc.setTextColor(report.parcial ? 122 : 23, report.parcial ? 62 : 54, report.parcial ? 0 : 93);
    doc.text(report.parcial ? "RELATÓRIO PARCIAL — consulte os avisos" : "Lista filtrada — escopo validado", margin, pageHeight - 9);
    doc.setTextColor(23, 54, 93);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 9, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
