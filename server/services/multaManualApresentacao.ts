import { TRPCError } from "@trpc/server";
import type { ClienteEmprestimosRpc } from "./emprestimosRpc";
import { identificarMulta, cotarMulta } from "./multaManualRpc";
import { normalizarOrigemMulta, normalizarCotacaoMulta, type CotacaoMulta } from "../../shared/multaManual";
import { dataMultimodalValida, jsonMultimodalSeguro } from "../../shared/emprestimosMultimodalCalculo";

/** Apenas metadados de seleção; nenhuma linha REST certifica origem, saldo ou quitação. */
export type ParcelaMultaApresentacao = {
  id: unknown;
  user_id: unknown;
  contrato_id: unknown;
  multa_manual?: unknown;
};

function falhar(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
function idValido(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647;
}
function entradaInvalida(): never {
  return falhar("BAD_REQUEST", "Seleção de parcelas ou marcador de multa inválido.");
}
function provaInvalida(): never {
  return falhar("PRECONDITION_FAILED", "Não foi possível confirmar as cotações de multa deste empréstimo.");
}

/** NUMERIC(15,2) legado: strings SQL e números canônicos, sem coerção/arredondamento. */
function marcadorPositivo(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "string" && typeof value !== "number") return entradaInvalida();
  if (typeof value === "number" && (!Number.isFinite(value) || Object.is(value, -0))) return entradaInvalida();
  const texto = String(value);
  if (!/^(0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(texto)) return entradaInvalida();
  const [inteiro, fracao = ""] = texto.split(".");
  const centavos = BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, "0"));
  if (centavos > BigInt(Number.MAX_SAFE_INTEGER)) return entradaInvalida();
  return centavos > BigInt(0);
}

/** Valida o array sem ler accessors e captura uma seleção imutável antes de qualquer await. */
function selecionar(parcelas: ParcelaMultaApresentacao[], userId: number, contratoId: number) {
  let descriptors: Record<string, PropertyDescriptor>;
  let quantidade: number;
  try {
    if (!Array.isArray(parcelas) || Object.getPrototypeOf(parcelas) !== Array.prototype) return entradaInvalida();
    descriptors = Object.getOwnPropertyDescriptors(parcelas);
    quantidade = descriptors.length.value;
    // Mesmo teto da leitura íntegra anterior; não bloquear legado pela fronteira36.
    if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade >= 20000 ||
      Reflect.ownKeys(descriptors).length !== quantidade + 1) return entradaInvalida();
  } catch { return entradaInvalida(); }
  const ids: number[] = [];
  const vistos = new Set<number>();
  let primeiraPositiva: number | null = null;
  for (let index = 0; index < quantidade; index++) {
    const d = descriptors[String(index)];
    if (!d || !d.enumerable || !("value" in d)) return entradaInvalida();
    const row: unknown = d.value;
    let dados: Record<string, unknown>;
    try {
      if (row === null || typeof row !== "object" || Array.isArray(row) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(row))) return entradaInvalida();
      const props = Object.getOwnPropertyDescriptors(row);
      dados = Object.create(null) as Record<string, unknown>;
      for (const key of Reflect.ownKeys(props)) {
        if (typeof key !== "string") return entradaInvalida();
        const prop = props[key];
        if (!prop.enumerable || !("value" in prop)) return entradaInvalida();
        // Ausências legadas não certificam nada; IDs null continuam inválidos abaixo.
        dados[key] = prop.value === undefined ? null : prop.value;
      }
    } catch { return entradaInvalida(); }
    // Por linha, não pelo array inteiro: o orçamento JSON compartilhado é de 2048 nós.
    const p = dados as ParcelaMultaApresentacao;
    if (!["id", "user_id", "contrato_id"].every(k => Object.hasOwn(p, k)) ||
      !idValido(p.id) || !idValido(p.user_id) || !idValido(p.contrato_id) || vistos.has(p.id)) return entradaInvalida();
    if (p.user_id !== userId || p.contrato_id !== contratoId)
      falhar("NOT_FOUND", "Contrato ou parcela indisponível para esta empresa.");
    const positiva = marcadorPositivo(p.multa_manual);
    // Dados financeiros adicionais não viram erro de intenção: apresentação falha fechada.
    if (!jsonMultimodalSeguro(dados)) return provaInvalida();
    vistos.add(p.id);
    ids.push(p.id);
    if (positiva && primeiraPositiva === null) primeiraPositiva = p.id;
  }
  return { ids, primeiraPositiva };
}

/**
 * Leitura somente via SDK estrito. multa_manual > 0 é apenas sinal para consultar a
 * primeira origem, nunca prova ou autorização para adotar um contrato no trilho36.
 * Não filtra parcelas por estado REST: inclusive paga precisa da prova SQL.
 */
export async function lerCotacoesApresentacaoMulta(
  cliente: ClienteEmprestimosRpc,
  userId: number,
  contratoId: number,
  parcelas: ParcelaMultaApresentacao[],
  hoje: string,
  relerParcelas?: () => Promise<ParcelaMultaApresentacao[]>,
): Promise<Map<number, CotacaoMulta> | null> {
  if (!idValido(userId)) falhar("UNAUTHORIZED", "Sessão financeira inválida.");
  if (!idValido(contratoId) || !dataMultimodalValida(hoje)) return entradaInvalida();
  const { ids, primeiraPositiva } = selecionar(parcelas, userId, contratoId);
  if (primeiraPositiva === null) return null;
  const consultaOrigem = { contratoId, parcelaId: primeiraPositiva };
  const respostaOrigem = await identificarMulta(cliente, userId, consultaOrigem);
  // Revalidação também cobre adapters/mocks: undefined, getters e herança não são NULL SQL.
  let origem: ReturnType<typeof normalizarOrigemMulta>;
  try { origem = normalizarOrigemMulta(respostaOrigem, userId, consultaOrigem); }
  catch { return provaInvalida(); }
  if (origem === null) return null;
  if (typeof relerParcelas !== "function") return provaInvalida();

  const cotacoes = new Map<number, CotacaoMulta>();
  let proxima = 0;
  let falhou = false;
  let erro: unknown;
  let hash: string | undefined;
  let conta: number | undefined;
  async function worker(): Promise<void> {
    while (!falhou && proxima < ids.length) {
      const parcelaId = ids[proxima++];
      try {
        const consulta = { contratoId, parcelaId };
        const resposta = await cotarMulta(cliente, userId, consulta);
        let cotacao: CotacaoMulta;
        try { cotacao = normalizarCotacaoMulta(resposta, consulta); }
        catch { return provaInvalida(); }
        if (cotacao.dataPagamento !== hoje ||
          (hash !== undefined && cotacao.estadoHash !== hash) ||
          (conta !== undefined && cotacao.contaCaixaId !== conta) ||
          (parcelaId === primeiraPositiva && cotacao.status !== origem!.status)) return provaInvalida();
        hash = cotacao.estadoHash;
        conta = cotacao.contaCaixaId;
        // Status físico da RPC: não inferir paga, parcial ou atraso pelo calendário.
        cotacoes.set(parcelaId, cotacao);
      } catch (e) {
        if (!falhou) { falhou = true; erro = e; }
        return;
      }
    }
  }
  // Aguarda as leituras já iniciadas; após falha, não agenda outras nem devolve mapa parcial.
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, () => worker()));
  if (falhou) throw erro;
  // Hash igual entre quotes não prova que o REST incluiu a sucessora recém-criada.
  // Reconfere TODOS os IDs próprios depois das quotes; nunca devolve total parcial.
  const revisao = selecionar(await relerParcelas(), userId, contratoId);
  const esperados = new Set(ids);
  if (revisao.ids.length !== ids.length || revisao.ids.some(id => !esperados.has(id))) return provaInvalida();
  // Uma renovação durante a própria reconferência também invalida este snapshot.
  const respostaFinal = await cotarMulta(cliente, userId, consultaOrigem);
  let final: CotacaoMulta;
  try { final = normalizarCotacaoMulta(respostaFinal, consultaOrigem); }
  catch { return provaInvalida(); }
  const primeira = cotacoes.get(primeiraPositiva)!;
  if (final.estadoHash !== hash || final.contaCaixaId !== conta || final.dataPagamento !== hoje ||
    final.status !== primeira.status || final.totalExigido !== primeira.totalExigido ||
    final.valorPagoAcumulado !== primeira.valorPagoAcumulado || final.multa !== primeira.multa ||
    final.mora !== primeira.mora || final.jurosEmbutidos !== primeira.jurosEmbutidos || final.vencimento !== primeira.vencimento)
    return provaInvalida();
  return new Map(ids.map(id => [id, cotacoes.get(id)!]));
}
