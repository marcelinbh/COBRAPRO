import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatarMoeda } from "../../../shared/finance";

interface ParcelaPdf {
  numero: number;
  dataVencimento: string | Date | null;
  valorParcela: string | number;
  status: string;
  valorPago?: string | number | null;
  dataPagamento?: string | Date | null;
}

interface ContratoPdf {
  id: number;
  clienteNome: string;
  clienteCpfCnpj?: string | null;
  clienteTelefone?: string | null;
  clienteEndereco?: string | null;
  modalidade: string;
  valorPrincipal: string | number;
  taxaJuros: string | number;
  tipoTaxa: string;
  numeroParcelas: number;
  valorParcela: string | number;
  totalPagar: string | number;
  dataInicio: string | Date | null;
  dataVencimentoPrimeira: string | Date | null;
  status: string;
  descricao?: string | null;
  observacoes?: string | null;
  multaAtraso?: string | number | null;
  jurosMoraDiario?: string | number | null;
  parcelas: ParcelaPdf[];
  empresaNome?: string;
  empresaTelefone?: string;
  empresaEndereco?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  paga: "Paga",
  atrasada: "Atrasada",
  vencendo_hoje: "Vence Hoje",
  parcial: "Parcial",
};

const MODALIDADE_LABELS: Record<string, string> = {
  emprestimo_padrao: "Empréstimo Padrão",
  emprestimo_diario: "Empréstimo Diário",
  tabela_price: "Tabela Price",
  venda_produto: "Venda de Produto",
  desconto_cheque: "Desconto de Cheque",
  produto: "Venda de Produto",
  cheque: "Desconto de Cheque",
  reparcelamento: "Reparcelamento",
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + (d.includes("T") ? "" : "T00:00:00")) : d;
  return date.toLocaleDateString("pt-BR");
}

export function gerarPdfContrato(contrato: ContratoPdf): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ─── Cabeçalho ───────────────────────────────────────────────────────────────
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageW, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(contrato.empresaNome ?? "CobraPro", margin, 14);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  if (contrato.empresaTelefone) doc.text(`Tel: ${contrato.empresaTelefone}`, margin, 20);
  if (contrato.empresaEndereco) doc.text(contrato.empresaEndereco, margin, 25);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`CONTRATO Nº ${String(contrato.id).padStart(5, "0")}`, pageW - margin, 14, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, 20, { align: "right" });
  doc.text(`Status: ${contrato.status.toUpperCase()}`, pageW - margin, 25, { align: "right" });

  let y = 38;

  // ─── Dados do Cliente ─────────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO CLIENTE", margin + 2, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(`Nome: ${contrato.clienteNome}`, margin, y);
  if (contrato.clienteCpfCnpj) doc.text(`CPF/CNPJ: ${contrato.clienteCpfCnpj}`, pageW / 2, y);
  y += 5;
  if (contrato.clienteTelefone) {
    doc.text(`Telefone: ${contrato.clienteTelefone}`, margin, y);
    y += 5;
  }
  if (contrato.clienteEndereco) {
    doc.text(`Endereço: ${contrato.clienteEndereco}`, margin, y);
    y += 5;
  }
  y += 3;

  // ─── Dados do Contrato ────────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text("DADOS DO CONTRATO", margin + 2, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);

  const col1 = margin;
  const col2 = pageW / 2;

  doc.text(`Modalidade: ${MODALIDADE_LABELS[contrato.modalidade] ?? contrato.modalidade}`, col1, y);
  doc.text(`Data de Início: ${formatDate(contrato.dataInicio)}`, col2, y);
  y += 5;
  doc.text(`Valor Principal: ${formatarMoeda(parseFloat(String(contrato.valorPrincipal)))}`, col1, y);
  doc.text(`1º Vencimento: ${formatDate(contrato.dataVencimentoPrimeira)}`, col2, y);
  y += 5;
  doc.text(`Taxa de Juros: ${parseFloat(String(contrato.taxaJuros)).toFixed(2)}% ${contrato.tipoTaxa}`, col1, y);
  doc.text(`Parcelas: ${contrato.numeroParcelas}x`, col2, y);
  y += 5;
  doc.text(`Valor da Parcela: ${formatarMoeda(parseFloat(String(contrato.valorParcela)))}`, col1, y);
  doc.text(`Total a Pagar: ${formatarMoeda(parseFloat(String(contrato.totalPagar)))}`, col2, y);
  y += 5;
  if (contrato.multaAtraso) {
    doc.text(`Multa por Atraso: ${parseFloat(String(contrato.multaAtraso)).toFixed(2)}%`, col1, y);
  }
  if (contrato.jurosMoraDiario) {
    doc.text(`Juros Mora Diário: ${parseFloat(String(contrato.jurosMoraDiario)).toFixed(3)}%`, col2, y);
  }
  y += 5;
  if (contrato.descricao || contrato.observacoes) {
    const obs = contrato.observacoes || contrato.descricao || "";
    const lines = doc.splitTextToSize(`Observações: ${obs}`, pageW - margin * 2);
    doc.text(lines, col1, y);
    y += lines.length * 4 + 2;
  }
  y += 3;

  // ─── Tabela de Parcelas ───────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text("TABELA DE PARCELAS", margin + 2, y);
  y += 4;

  const tableData = contrato.parcelas.map((p) => [
    String(p.numero),
    formatDate(p.dataVencimento),
    formatarMoeda(parseFloat(String(p.valorParcela))),
    STATUS_LABELS[p.status] ?? p.status,
    p.dataPagamento ? formatDate(p.dataPagamento) : "—",
    p.valorPago ? formatarMoeda(parseFloat(String(p.valorPago))) : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Vencimento", "Valor", "Status", "Pago em", "Valor Pago"]],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 28 },
      5: { cellWidth: 32, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const status = data.cell.text[0];
        if (status === "Atrasada") data.cell.styles.textColor = [220, 50, 50];
        else if (status === "Paga") data.cell.styles.textColor = [34, 197, 94];
        else if (status === "Vence Hoje") data.cell.styles.textColor = [234, 179, 8];
        else if (status === "Parcial") data.cell.styles.textColor = [249, 115, 22];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY ?? y + 40;

  // ─── Resumo financeiro ────────────────────────────────────────────────────────
  const parcelasPagas = contrato.parcelas.filter((p) => p.status === "paga" || p.status === "parcial").length;
  const parcelasPendentes = contrato.parcelas.filter((p) => p.status === "pendente" || p.status === "atrasada" || p.status === "vencendo_hoje").length;
  const totalPago = contrato.parcelas.reduce((acc, p) => acc + parseFloat(String(p.valorPago ?? 0)), 0);
  const totalRestante = parseFloat(String(contrato.totalPagar)) - totalPago;

  const summaryY = finalY + 6;
  if (summaryY + 25 < pageH - 20) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, summaryY - 4, pageW - margin * 2, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text("RESUMO FINANCEIRO", margin + 2, summaryY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(`Parcelas pagas: ${parcelasPagas}`, margin + 2, summaryY + 6);
    doc.text(`Parcelas pendentes: ${parcelasPendentes}`, margin + 50, summaryY + 6);
    doc.text(`Total pago: ${formatarMoeda(totalPago)}`, margin + 2, summaryY + 12);
    doc.text(`Total restante: ${formatarMoeda(Math.max(0, totalRestante))}`, margin + 50, summaryY + 12);
  }

  // ─── Rodapé ───────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Documento gerado em ${new Date().toLocaleString("pt-BR")} — ${contrato.empresaNome ?? "CobraPro"}`,
    pageW / 2,
    pageH - 8,
    { align: "center" }
  );

  // ─── Salvar ───────────────────────────────────────────────────────────────────
  doc.save(`contrato-${String(contrato.id).padStart(5, "0")}-${contrato.clienteNome.replace(/\s+/g, "_")}.pdf`);
}
