export type ContaConferencia = {
  id: number;
  nome: string;
  saldo: number | string | null;
  ativo?: boolean | null;
};

export type TransacaoConferencia = {
  id: number;
  conta_caixa_id: number;
  tipo: "entrada" | "saida";
  categoria: string;
  valor: number | string | null;
  parcela_id?: number | null;
  descricao?: string | null;
};

export type ParcelaConferencia = {
  id: number;
  conta_caixa_id?: number | null;
  valor_pago?: number | string | null;
  status: string;
};

export type DespesaConferencia = {
  id: number;
  conta_caixa_id?: number | null;
  descricao: string;
  valor: number | string | null;
  status: string;
};

export type DivergenciaCaixa = {
  tipo: "parcela_sem_entrada" | "valor_parcela_divergente" | "despesa_sem_saida" | "valor_despesa_divergente" | "movimentos_duplicados" | "movimento_sem_origem";
  severidade: "critica" | "atencao" | "revisar";
  contaCaixaId: number | null;
  referencia: string;
  esperado: number | null;
  encontrado: number | null;
  mensagem: string;
};

function dinheiro(valor: number | string | null | undefined): number {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  return Number.isFinite(numero) ? Math.round((numero + Number.EPSILON) * 100) / 100 : 0;
}

function diferenca(a: number, b: number): boolean {
  return Math.abs(a - b) > 0.009;
}

function descricaoPagamentoConta(id: number, descricao: string): string {
  return `Pagamento da conta #${id}: ${descricao}`;
}

function descricaoLegadaPagamentoConta(descricao: string): string {
  return `Pagamento: ${descricao}`;
}

function somar(transacoes: TransacaoConferencia[]): number {
  return Math.round((transacoes.reduce((total, transacao) => total + dinheiro(transacao.valor), 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Confere apenas dados já persistidos. Não cria, corrige ou remove movimentos;
 * qualquer divergência precisa ser revisada explicitamente pelo operador.
 */
export function gerarConferenciaCaixa(input: {
  contas: ContaConferencia[];
  transacoes: TransacaoConferencia[];
  parcelas: ParcelaConferencia[];
  despesas: DespesaConferencia[];
}) {
  const divergencias: DivergenciaCaixa[] = [];
  const parcelasPorId = new Map(input.parcelas.map((parcela) => [parcela.id, parcela]));
  const idsTransacaoVinculada = new Set<number>();

  for (const parcela of input.parcelas) {
    const esperado = dinheiro(parcela.valor_pago);
    if (esperado <= 0 || !parcela.conta_caixa_id) continue;

    const movimentos = input.transacoes.filter((transacao) =>
      transacao.tipo === "entrada"
      && transacao.categoria === "pagamento_parcela"
      && transacao.parcela_id === parcela.id,
    );
    movimentos.forEach((movimento) => idsTransacaoVinculada.add(movimento.id));
    const encontrado = somar(movimentos);

    if (movimentos.length === 0) {
      divergencias.push({
        tipo: "parcela_sem_entrada",
        severidade: "critica",
        contaCaixaId: parcela.conta_caixa_id,
        referencia: `Parcela #${parcela.id}`,
        esperado,
        encontrado: 0,
        mensagem: "Parcela baixada sem entrada correspondente no livro-caixa.",
      });
    } else if (movimentos.length > 1 && encontrado > esperado && diferenca(esperado, encontrado)) {
      divergencias.push({
        tipo: "movimentos_duplicados",
        severidade: "critica",
        contaCaixaId: parcela.conta_caixa_id,
        referencia: `Parcela #${parcela.id}`,
        esperado,
        encontrado,
        mensagem: "As entradas vinculadas à parcela superam o valor efetivamente pago; há indício de duplicidade.",
      });
    } else if (diferenca(esperado, encontrado)) {
      divergencias.push({
        tipo: "valor_parcela_divergente",
        severidade: "atencao",
        contaCaixaId: parcela.conta_caixa_id,
        referencia: `Parcela #${parcela.id}`,
        esperado,
        encontrado,
        mensagem: "O valor recebido na parcela difere do lançamento de entrada no caixa.",
      });
    }
  }

  const idsTransacaoDespesa = new Set<number>();
  for (const despesa of input.despesas) {
    const esperado = dinheiro(despesa.valor);
    if (esperado <= 0 || !despesa.conta_caixa_id) continue;

    const descricoesAceitas = new Set([
      descricaoPagamentoConta(despesa.id, despesa.descricao),
      descricaoLegadaPagamentoConta(despesa.descricao),
    ]);
    const movimentos = input.transacoes.filter((transacao) =>
      transacao.tipo === "saida"
      && transacao.categoria === "despesa_operacional"
      && transacao.conta_caixa_id === despesa.conta_caixa_id
      && descricoesAceitas.has(transacao.descricao ?? ""),
    );
    movimentos.forEach((movimento) => idsTransacaoDespesa.add(movimento.id));
    const encontrado = somar(movimentos);

    if (movimentos.length === 0) {
      divergencias.push({
        tipo: "despesa_sem_saida",
        severidade: "critica",
        contaCaixaId: despesa.conta_caixa_id,
        referencia: `Despesa #${despesa.id}`,
        esperado,
        encontrado: 0,
        mensagem: "Despesa marcada como paga sem saída correspondente no livro-caixa.",
      });
    } else if (movimentos.length > 1) {
      divergencias.push({
        tipo: "movimentos_duplicados",
        severidade: "critica",
        contaCaixaId: despesa.conta_caixa_id,
        referencia: `Despesa #${despesa.id}`,
        esperado,
        encontrado,
        mensagem: "Há mais de uma saída de caixa vinculada à mesma despesa.",
      });
    } else if (diferenca(esperado, encontrado)) {
      divergencias.push({
        tipo: "valor_despesa_divergente",
        severidade: "atencao",
        contaCaixaId: despesa.conta_caixa_id,
        referencia: `Despesa #${despesa.id}`,
        esperado,
        encontrado,
        mensagem: "O valor pago da despesa difere do lançamento de saída no caixa.",
      });
    }
  }

  for (const transacao of input.transacoes) {
    if (transacao.categoria === "pagamento_parcela" && !idsTransacaoVinculada.has(transacao.id)) {
      const parcela = transacao.parcela_id ? parcelasPorId.get(transacao.parcela_id) : undefined;
      divergencias.push({
        tipo: "movimento_sem_origem",
        severidade: "revisar",
        contaCaixaId: transacao.conta_caixa_id,
        referencia: `Entrada #${transacao.id}`,
        esperado: parcela ? dinheiro(parcela.valor_pago) : null,
        encontrado: dinheiro(transacao.valor),
        mensagem: transacao.parcela_id
          ? "A entrada aponta para uma parcela que não está paga/parcial ou não pertence à conferência atual."
          : "Entrada de pagamento sem parcela vinculada; pode ser um lançamento legado e exige revisão.",
      });
    }
    if (transacao.categoria === "despesa_operacional" && transacao.tipo === "saida" && !idsTransacaoDespesa.has(transacao.id)) {
      divergencias.push({
        tipo: "movimento_sem_origem",
        severidade: "revisar",
        contaCaixaId: transacao.conta_caixa_id,
        referencia: `Saída #${transacao.id}`,
        esperado: null,
        encontrado: dinheiro(transacao.valor),
        mensagem: "Saída operacional sem vínculo identificável com uma despesa paga; pode ser lançamento legado e exige revisão.",
      });
    }
  }

  const contas = input.contas.map((conta) => {
    const movimentos = input.transacoes.filter((transacao) => transacao.conta_caixa_id === conta.id);
    const entradas = somar(movimentos.filter((transacao) => transacao.tipo === "entrada"));
    const saidas = somar(movimentos.filter((transacao) => transacao.tipo === "saida"));
    const saldoBase = dinheiro(conta.saldo);
    return {
      id: conta.id,
      nome: conta.nome,
      ativa: conta.ativo ?? true,
      saldoBase,
      entradas,
      saidas,
      saldoLivro: Math.round((saldoBase + entradas - saidas + Number.EPSILON) * 100) / 100,
      divergencias: divergencias.filter((divergencia) => divergencia.contaCaixaId === conta.id).length,
    };
  });

  return {
    geradoEm: new Date().toISOString(),
    somenteLeitura: true,
    resumo: {
      contas: contas.length,
      movimentos: input.transacoes.length,
      parcelasConferidas: input.parcelas.length,
      despesasConferidas: input.despesas.length,
      divergencias: divergencias.length,
      criticas: divergencias.filter((divergencia) => divergencia.severidade === "critica").length,
      atencao: divergencias.filter((divergencia) => divergencia.severidade === "atencao").length,
      revisar: divergencias.filter((divergencia) => divergencia.severidade === "revisar").length,
    },
    contas,
    divergencias,
  };
}
