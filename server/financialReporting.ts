import { TRPCError } from "@trpc/server";
import {
  abertoCentavosRelatorio, adicionarDiasRelatorio, atrasadaRelatorio, centavosRelatorio,
  dataRelatorio, formatarDataRelatorio, hojeRelatorio, leituraValidada,
  reaisRelatorio, resumirDividasRelatorio, resumirLedgerRelatorio, scoreRelatorio, somarCentavosRelatorio,
  STATUS_ABERTOS_RELATORIO, type LeituraRelatorio,
} from "../shared/reporting";

export const REPORTING_PAGE_SIZE = 500;
export const REPORTING_MAX_PAGES = 200;
const COLUNAS_PARCELAS = "id, user_id, contrato_id, cliente_id, numero_parcela, valor, valor_original, saldo_residual, valor_multa, status, data_vencimento";
const COLUNAS_LEDGER = "id, user_id, conta_caixa_id, tipo, categoria, valor, data_transacao, parcela_id, contrato_id";

function exigirFonte(fonte: any) {
  if (!fonte) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Fonte de relatórios indisponível; valores não calculados." });
  return fonte;
}

/** REST físico: DATE e ativo:boolean. Sem embeds/FKs inferidas ou writes. */
export async function listarFinancialReporting(fonte: any, tabela: string, colunas: string, userId: number, configurar?: (q: any) => any): Promise<any[]> {
  return listarPaginasFinancialReporting(fonte, tabela, colunas, q => {
    q = q.eq("user_id", userId);
    return configurar ? configurar(q) : q;
  }, row => row.user_id === userId);
}

async function listarPaginasFinancialReporting(fonte: any, tabela: string, colunas: string, configurar: (q: any) => any, validar: (row: any) => boolean): Promise<any[]> {
  exigirFonte(fonte);
  const registros: any[] = [];
  const ids = new Set<number>();
  let esperado: number | undefined;
  for (let pagina = 0; pagina < REPORTING_MAX_PAGES; pagina++) {
    let q = fonte.from(tabela).select(colunas, { count: "exact" }).order("id", { ascending: true })
      .range(pagina * REPORTING_PAGE_SIZE, (pagina + 1) * REPORTING_PAGE_SIZE - 1);
    q = configurar(q);
    const resposta = await q;
    if (resposta.error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha na consulta de relatórios; valores não calculados." });
    if (!Array.isArray(resposta.data) || !Number.isSafeInteger(resposta.count) || resposta.count < 0 || resposta.data.length > REPORTING_PAGE_SIZE) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Completude da leitura não confirmada; relatório indisponível." });
    }
    if (esperado == null) esperado = resposta.count;
    if (resposta.count !== esperado) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A fonte mudou durante a paginação; atualize o relatório." });
    for (const row of resposta.data) {
      if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id) || !validar(row)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Leitura duplicada ou vínculo de empresa inválido; revisão necessária." });
      ids.add(row.id);
      registros.push(row);
    }
    if (esperado === undefined || registros.length > esperado) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Contagem divergente; relatório indisponível." });
    if (resposta.data.length < REPORTING_PAGE_SIZE) {
      if (registros.length !== esperado) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Leitura truncada; total incompleto não apresentado." });
      return registros;
    }
  }
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Limite de leitura excedido; total incompleto não apresentado." });
}

/** Não filtrar user_id aqui: isso esconderia lançamentos de outro tenant na
 * conta alvo. Ler somente metadados, restritos a IDs de contas já autorizadas;
 * nenhum valor, descrição ou identificador divergente é devolvido ao caller.
 * A conferência cobre o livro inteiro, antes dos filtros de período/categoria. */
export async function validarIntegridadeLedgerFinancialReporting(fonte: any, userId: number, contaIds: readonly number[]): Promise<void> {
  if (contaIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(contaIds).size !== contaIds.length) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Contas sem vínculo validado; revisão necessária." });
  }
  // Lotes pequenos evitam URLs REST excessivas, mantendo cada lote paginado.
  for (let inicio = 0; inicio < contaIds.length; inicio += 100) {
    const lote = contaIds.slice(inicio, inicio + 100);
    await listarPaginasFinancialReporting(fonte, "transacoes_caixa", "id, user_id, conta_caixa_id",
      q => q.in("conta_caixa_id", lote), row => row.user_id === userId && lote.includes(row.conta_caixa_id));
  }
}

function mapParcela(p: any) {
  dataRelatorio(p.data_vencimento);
  return { id: p.id, contratoId: p.contrato_id, clienteId: p.cliente_id, numeroParcela: p.numero_parcela,
    status: p.status, valor: p.valor, valorOriginal: p.valor_original, saldoResidual: p.saldo_residual,
    valorMulta: p.valor_multa, dataVencimento: p.data_vencimento };
}
const mapMovimento = (m: any) => ({ ...m, dataTransacao: m.data_transacao });

async function seguro<T>(ler: () => Promise<T>): Promise<LeituraRelatorio<T>> {
  try { return { status: "validado", completo: true, dados: await ler() }; }
  catch (erro) {
    return { status: "indisponivel", completo: false, motivo: erro instanceof Error ? erro.message : "Leitura indisponível; revisão necessária." };
  }
}

export async function lerLedgerFinancialReporting(fonte: any, userId: number, inicio?: string, fim?: string, configurar?: (q: any) => any) {
  if (inicio != null) dataRelatorio(inicio);
  if (fim != null) dataRelatorio(fim);
  if (inicio && fim && inicio > fim) throw new TRPCError({ code: "BAD_REQUEST", message: "Período inválido." });
  const contas = await listarFinancialReporting(fonte, "contas_caixa", "id, user_id", userId);
  const contaIds = contas.map(c => c.id);
  await validarIntegridadeLedgerFinancialReporting(fonte, userId, contaIds);
  const rows = await listarFinancialReporting(fonte, "transacoes_caixa", COLUNAS_LEDGER, userId, q => {
    // data_transacao é DATE no schema físico versionado. Filtro antes da paginação.
    if (inicio) q = q.gte("data_transacao", inicio);
    if (fim) q = q.lte("data_transacao", fim);
    return configurar ? configurar(q) : q;
  });
  const contasProprias = new Set(contaIds);
  if (rows.some(row => !contasProprias.has(row.conta_caixa_id))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Livro-caixa sem conta confirmada na empresa; revisão necessária." });
  }
  const movimentos = rows.map(mapMovimento);
  return { ...resumirLedgerRelatorio(movimentos), movimentos };
}

export async function lerDividasFinancialReporting(fonte: any, userId: number, hoje: string, configurar?: (q: any) => any) {
  const rows = await listarFinancialReporting(fonte, "parcelas", COLUNAS_PARCELAS, userId, configurar);
  const parcelas = rows.map(mapParcela);
  return { ...resumirDividasRelatorio(parcelas, hoje), parcelas };
}

export async function lerScoreFinancialReporting(fonte: any, userId: number, hoje = hojeRelatorio()) {
  const [ledger, dividas] = await Promise.all([
    lerLedgerFinancialReporting(fonte, userId, undefined, undefined, q => q.eq("tipo", "entrada").eq("categoria", "pagamento_parcela")),
    lerDividasFinancialReporting(fonte, userId, hoje, q => q.in("status", [...STATUS_ABERTOS_RELATORIO])),
  ]);
  return { ...scoreRelatorio(ledger.recebidoCentavos, dividas.abertoCentavos, dividas.atrasoCentavos), dataReferencia: hoje };
}

export async function lerRelatorioFinancialReporting(fonte: any, userId: number, input: { inicio: string; fim: string; modalidade?: string; clienteId?: number }, hoje = hojeRelatorio()) {
  exigirFonte(fonte);
  dataRelatorio(input.inicio); dataRelatorio(input.fim); dataRelatorio(hoje);
  if (input.inicio > input.fim) throw new TRPCError({ code: "BAD_REQUEST", message: "Data inicial deve ser anterior à data final." });
  const contratosLeitura = seguro(async () => {
    const contratos = await listarFinancialReporting(fonte, "contratos", "id, user_id, cliente_id, modalidade, status, valor_principal, data_inicio", userId);
    const clientes = await listarFinancialReporting(fonte, "clientes", "id, user_id, nome, ativo", userId);
    const clientesMap = new Map(clientes.map(c => [c.id, c]));
    for (const c of clientes) if (typeof c.nome !== "string" || !c.nome.trim() || typeof c.ativo !== "boolean") throw new Error("Cliente inválido; revisão necessária.");
    for (const c of contratos) {
      if (!clientesMap.has(c.cliente_id) || typeof c.modalidade !== "string" || !c.modalidade || !["ativo", "quitado", "inadimplente", "cancelado"].includes(c.status)) throw new Error("Contrato sem vínculo validado; revisão necessária.");
      centavosRelatorio(c.valor_principal); dataRelatorio(c.data_inicio);
    }
    return { contratos, clientes };
  });
  const enriquecer = async (ler: () => ReturnType<typeof lerDividasFinancialReporting>) => {
    const vinculos = await contratosLeitura;
    if (!leituraValidada(vinculos)) throw new Error("Vínculos da carteira indisponíveis; revisão necessária.");
    const dados = await ler();
    const contratos = new Map(vinculos.dados.contratos.map(c => [c.id, c]));
    const clientes = new Map(vinculos.dados.clientes.map(c => [c.id, c]));
    const parcelas = dados.parcelas.map(p => {
      const contrato = contratos.get(p.contratoId);
      const cliente = clientes.get(p.clienteId);
      if (!contrato || !cliente || contrato.cliente_id !== p.clienteId) throw new Error("Parcela sem vínculo validado; revisão necessária.");
      return { ...p, modalidade: contrato.modalidade as string, clienteNome: cliente.nome as string };
    }).filter(p => !input.modalidade || p.modalidade === input.modalidade);
    return { ...resumirDividasRelatorio(parcelas, hoje), parcelas };
  };
  const [ledger, fluxo, dividas, projecao, extrato, vinculos] = await Promise.all([
    seguro(() => lerLedgerFinancialReporting(fonte, userId, input.inicio, input.fim)),
    seguro(() => lerLedgerFinancialReporting(fonte, userId, adicionarDiasRelatorio(hoje, -6), hoje)),
    seguro(() => enriquecer(() => lerDividasFinancialReporting(fonte, userId, hoje, q => q.gte("data_vencimento", input.inicio).lte("data_vencimento", input.fim)))),
    seguro(() => enriquecer(() => lerDividasFinancialReporting(fonte, userId, hoje, q => q.in("status", [...STATUS_ABERTOS_RELATORIO]).gte("data_vencimento", hoje).lte("data_vencimento", adicionarDiasRelatorio(hoje, 30))))),
    input.clienteId ? seguro(async () => {
      const [divida, caixa] = await Promise.all([
        enriquecer(() => lerDividasFinancialReporting(fonte, userId, hoje, q => q.eq("cliente_id", input.clienteId))),
        lerLedgerFinancialReporting(fonte, userId, input.inicio, input.fim),
      ]);
      const vinculos = await contratosLeitura;
      if (!leituraValidada(vinculos)) throw new Error("Vínculos do extrato indisponíveis; revisão necessária.");
      const contratos = new Map(vinculos.dados.contratos.map(c => [c.id, c]));
      const pagamentos = caixa.movimentos.filter(m => m.tipo === "entrada" && m.categoria === "pagamento_parcela");
      // O ledger físico não possui cliente_id. Evento sem contrato confirmado não
      // permite afirmar recebimento zero de um cliente nem inferir por status.
      for (const m of pagamentos) if (!contratos.has(m.contrato_id)) throw new Error("Recebimento sem contrato confirmado no ledger; extrato requer revisão.");
      const movimentosPeriodo = pagamentos.filter(m => contratos.get(m.contrato_id)?.cliente_id === input.clienteId);
      return { ...divida, recebidoPeriodo: resumirLedgerRelatorio(movimentosPeriodo).recebido, movimentosPeriodo };
    }) : Promise.resolve(null),
    contratosLeitura,
  ]);
  const completo = [ledger, fluxo, dividas, projecao, vinculos, ...(extrato ? [extrato] : [])].every(l => l.status === "validado" && l.completo === true);
  return { inicio: input.inicio, fim: input.fim, hoje, completo, ledger, fluxo, dividas, projecao, extrato, vinculos,
    base: "Entradas e saídas exclusivamente do livro-caixa, sem somar contas pagas novamente. Dívida aberta por vencimento, no estado atual; não reconstrói saldo histórico nem pagamentos por status. Modalidade filtra somente dívida/projeção." };
}

/** Preview confiável e compartilhado; esta camada não envia nem configura WhatsApp. */
export async function gerarPreviewRelatorioDiario(fonte: any, userId: number, hoje = hojeRelatorio()) {
  exigirFonte(fonte);
  const [ledger, dividas, contratos, clientes, config] = await Promise.all([
    lerLedgerFinancialReporting(fonte, userId, hoje, hoje),
    lerDividasFinancialReporting(fonte, userId, hoje, q => q.in("status", [...STATUS_ABERTOS_RELATORIO])),
    listarFinancialReporting(fonte, "contratos", "id, user_id, cliente_id, valor_principal, status", userId, q => q.eq("status", "ativo")),
    listarFinancialReporting(fonte, "clientes", "id, user_id, ativo", userId, q => q.eq("ativo", true)),
    listarFinancialReporting(fonte, "configuracoes", "id, user_id, chave, valor", userId, q => q.in("chave", ["nomeEmpresa", "assinaturaWhatsapp", "telefoneEmpresa"])),
  ]);
  for (const c of clientes) if (c.ativo !== true) throw new Error("Atividade do cliente inválida; revisão necessária.");
  const capitalCentavos = somarCentavosRelatorio(contratos.map(c => centavosRelatorio(c.valor_principal)));
  const venceHoje = dividas.parcelas.filter(p => p.dataVencimento === hoje && abertoCentavosRelatorio(p) > 0);
  const totalVencendoHoje = reaisRelatorio(somarCentavosRelatorio(venceHoje.map(abertoCentavosRelatorio)));
  const cfg: Record<string, string> = {};
  for (const r of config) {
    if (typeof r.chave !== "string" || typeof r.valor !== "string" || r.chave in cfg) throw new Error("Configuração de relatório inválida; revisão necessária.");
    cfg[r.chave] = r.valor;
  }
  const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  const nomeEmpresa = cfg.nomeEmpresa || cfg.assinaturaWhatsapp || "CobraPro";
  const mensagem = `*RELATÓRIO COBRAPRO — ${formatarDataRelatorio(hoje)} (Brasília)*\n_${nomeEmpresa}_\n\n` +
    `*RESUMO DO DIA*\nRecebido hoje (ledger / pagamento_parcela): *${fmt(ledger.recebido)}* (${ledger.pagamentosCount} movimento(s))\n` +
    `Entradas no Caixa: ${fmt(ledger.entradas)}\nSaídas no Caixa: ${fmt(ledger.saidas)}\nSaldo do período: ${fmt(ledger.saldo)}\n` +
    `A cobrar hoje: *${fmt(totalVencendoHoje)}* (${venceHoje.length} parcela(s))\n` +
    `Total em atraso (dívida aberta validada): *${fmt(dividas.emAtraso)}* (${dividas.quantidadeAtrasadas} parcela(s))\n\n` +
    `*CARTEIRA*\nClientes ativos: ${clientes.length}\nEmpréstimos ativos: ${contratos.length}\nCapital contratual ativo (não saldo de Caixa): ${fmt(reaisRelatorio(capitalCentavos))}\n` +
    `Leituras completas e validadas. Não infere pagamentos por status nem reconstrói legado.\n_${cfg.assinaturaWhatsapp || nomeEmpresa}_`;
  return { mensagem, completo: true as const, totalRecebidoHoje: ledger.recebido,
    totalVencendoHoje: venceHoje.length, valorVencendoHoje: totalVencendoHoje,
    totalAtrasadas: dividas.parcelas.filter(p => atrasadaRelatorio(p, hoje)).length,
    pagamentosCount: ledger.pagamentosCount, telefoneEmpresa: cfg.telefoneEmpresa || "" };
}
