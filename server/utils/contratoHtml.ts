import { escapeHtml } from "./html";

type ParcelaContratoHtml = {
  numero: unknown;
  vencimento: unknown;
  valor: unknown;
  status?: unknown;
};

type ContratoHtmlInput = {
  empresa: { nome?: unknown; cnpj?: unknown; endereco?: unknown };
  cliente: {
    nome?: unknown;
    cpfCnpj?: unknown;
    telefone?: unknown;
    chavePix?: unknown;
    endereco?: unknown;
    cidade?: unknown;
    estado?: unknown;
  };
  contrato: {
    id: unknown;
    modalidade?: unknown;
    status?: unknown;
    capital: unknown;
    total: unknown;
    taxa: unknown;
    numeroParcelas: unknown;
    valorParcela: unknown;
    descricao?: unknown;
    dataInicio: unknown;
  };
  parcelas: ParcelaContratoHtml[];
  geradoEm: string;
};

const modalidades: Record<string, string> = {
  emprestimo_padrao: "Empréstimo Padrão",
  emprestimo_diario: "Empréstimo Diário",
  tabela_price: "Parcela Fixa",
  venda_produto: "Venda de Produto",
  desconto_cheque: "Desconto de Cheque",
  reparcelamento: "Reparcelamento",
};

function texto(value: unknown, padrao = "-") {
  const normalizado = String(value ?? "").trim();
  return escapeHtml(normalizado || padrao);
}

function statusParcela(status: unknown): string {
  if (status === "paga") return "PAGA";
  if (status === "atrasada") return "ATRASADA";
  if (status === "vencendo_hoje") return "VENCE HOJE";
  if (status === "parcial") return "PARCIAL";
  return "PENDENTE";
}

function statusContrato(status: unknown): { texto: string; classe: string } {
  if (status === "ativo") return { texto: "ATIVO", classe: "ativo" };
  if (status === "quitado") return { texto: "QUITADO", classe: "quitado" };
  if (status === "inadimplente") return { texto: "INADIMPLENTE", classe: "inadimplente" };
  if (status === "cancelado") return { texto: "CANCELADO", classe: "cancelado" };
  return { texto: "PENDENTE", classe: "pendente" };
}

/** Cria HTML de contrato usando somente texto codificado nos dados de negócio. */
export function montarHtmlContrato(input: ContratoHtmlInput): string {
  const empresa = {
    nome: texto(input.empresa.nome, "CobraPro"),
    cnpj: texto(input.empresa.cnpj, ""),
    endereco: texto(input.empresa.endereco, ""),
  };
  const cliente = {
    nome: texto(input.cliente.nome, ""),
    cpfCnpj: texto(input.cliente.cpfCnpj),
    telefone: texto(input.cliente.telefone),
    chavePix: texto(input.cliente.chavePix),
  };
  const enderecoCliente = [input.cliente.endereco, input.cliente.cidade, input.cliente.estado]
    .filter((value) => String(value ?? "").trim().length > 0)
    .map((value) => escapeHtml(value))
    .join(", ");
  const modalidadeOriginal = String(input.contrato.modalidade ?? "");
  const modalidade = escapeHtml((modalidades[modalidadeOriginal] ?? modalidadeOriginal) || "Crédito");
  const status = statusContrato(input.contrato.status);
  const parcelas = input.parcelas.slice(0, 24).map((parcela) => (
    `<tr><td>${texto(parcela.numero)}</td><td>${texto(parcela.vencimento)}</td><td>${texto(parcela.valor)}</td><td>${statusParcela(parcela.status)}</td></tr>`
  )).join("");
  const parcelasRestantes = Math.max(0, input.parcelas.length - 24);

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0;padding:20px}h1{font-size:18px;text-align:center;margin-bottom:4px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}.header{text-align:center;margin-bottom:20px}.empresa{font-size:14px;font-weight:bold}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px}.field{margin-bottom:4px}.label{font-weight:bold;color:#555}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#1a1a1a;color:#fff;padding:6px;text-align:left;font-size:10px}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:10px}tr:nth-child(even) td{background:#f9f9f9}.assinatura{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.ass-box{border-top:1px solid #333;padding-top:6px;text-align:center}.rodape{margin-top:20px;font-size:9px;color:#888;text-align:center}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:10px}.badge-ativo{background:#dcfce7;color:#166534}.badge-quitado{background:#dbeafe;color:#1e40af}.badge-pendente,.badge-inadimplente,.badge-cancelado{background:#f3f4f6;color:#374151}
  </style></head><body>
    <div class="header"><div class="empresa">${empresa.nome}</div>${empresa.cnpj ? `<div>CNPJ: ${empresa.cnpj}</div>` : ""}${empresa.endereco ? `<div>${empresa.endereco}</div>` : ""}<h1>CONTRATO DE ${modalidade.toUpperCase()}</h1><div>Nº ${texto(input.contrato.id).padStart(6, "0")} &nbsp;&bull;&nbsp; ${texto(input.contrato.dataInicio)}</div></div>
    <h2>DADOS DO CONTRATANTE</h2><div class="grid"><div class="field"><span class="label">Nome:</span> ${cliente.nome}</div><div class="field"><span class="label">CPF/CNPJ:</span> ${cliente.cpfCnpj}</div><div class="field"><span class="label">Telefone:</span> ${cliente.telefone}</div><div class="field"><span class="label">Chave PIX:</span> ${cliente.chavePix}</div>${enderecoCliente ? `<div class="field" style="grid-column:span 2"><span class="label">Endereço:</span> ${enderecoCliente}</div>` : ""}</div>
    <h2>CONDIÇÕES DO CONTRATO</h2><div class="grid"><div class="field"><span class="label">Modalidade:</span> ${modalidade}</div><div class="field"><span class="label">Status:</span> <span class="badge badge-${status.classe}">${status.texto}</span></div><div class="field"><span class="label">Capital:</span> ${texto(input.contrato.capital)}</div><div class="field"><span class="label">Valor Total:</span> ${texto(input.contrato.total)}</div><div class="field"><span class="label">Taxa de Juros:</span> ${texto(input.contrato.taxa)}</div><div class="field"><span class="label">Nº Parcelas:</span> ${texto(input.contrato.numeroParcelas)}x de ${texto(input.contrato.valorParcela)}</div>${input.contrato.descricao ? `<div class="field" style="grid-column:span 2"><span class="label">Descrição:</span> ${texto(input.contrato.descricao)}</div>` : ""}</div>
    <h2>PLANO DE PAGAMENTO</h2><table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>${parcelas}</tbody></table>${parcelasRestantes ? `<p style="font-size:9px;color:#888">... e mais ${parcelasRestantes} parcelas</p>` : ""}
    <div class="assinatura"><div class="ass-box"><div>${empresa.nome}</div><div style="font-size:9px;color:#888">Credor / Contratado</div></div><div class="ass-box"><div>${cliente.nome}</div><div style="font-size:9px;color:#888">Devedor / Contratante</div></div></div><div class="rodape">Documento gerado em ${texto(input.geradoEm)} — CobraPro Sistema de Gestão Financeira</div>
  </body></html>`;
}
