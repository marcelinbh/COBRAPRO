var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/const.ts
var COOKIE_NAME, ONE_YEAR_MS, AXIOS_TIMEOUT_MS, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG;
var init_const = __esm({
  "shared/const.ts"() {
    "use strict";
    COOKIE_NAME = "app_session_id";
    ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
    AXIOS_TIMEOUT_MS = 3e4;
    UNAUTHED_ERR_MSG = "Please login (10001)";
    NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
  }
});

// drizzle/schema.ts
import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  integer,
  decimal,
  date,
  timestamp,
  pgEnum
} from "drizzle-orm/pg-core";
var roleEnum, perfilEnum, categoriaClienteEnum, qualificacaoEnum, tipoChavePixEnum, tipoCaixaEnum, modalidadeEnum, statusContratoEnum, tipoTaxaEnum, statusParcelaEnum, tipoTransacaoEnum, categoriaTransacaoEnum, tipoTemplateEnum, categoriaContaPagarEnum, statusContaPagarEnum, periodicidadeEnum, tipoTaxaChequeEnum, statusChequeEnum, sexoEnum, estadoCivilEnum, users, koletores, clientes, contasCaixa, contratos, parcelas, transacoesCaixa, magicLinks, templatesWhatsapp, configuracoes, contasPagar, produtos, cheques, passwordResets, veiculos, parcelasVeiculo, statusVendaTelefoneEnum, vendas_telefone, parcelas_venda_telefone, statusAssinaturaEnum, assinaturas, pagamentosAssinatura;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    roleEnum = pgEnum("role", ["user", "admin"]);
    perfilEnum = pgEnum("perfil", ["admin", "gerente", "koletor"]);
    categoriaClienteEnum = pgEnum("categoria_cliente", ["bronze", "prata", "ouro", "prefeitura", "padrao"]);
    qualificacaoEnum = pgEnum("qualificacao", ["bom", "medio", "ruim"]);
    tipoChavePixEnum = pgEnum("tipo_chave_pix", ["cpf", "cnpj", "email", "telefone", "aleatoria"]);
    tipoCaixaEnum = pgEnum("tipo_caixa", ["caixa", "banco", "digital"]);
    modalidadeEnum = pgEnum("modalidade", [
      "emprestimo_padrao",
      "emprestimo_diario",
      "tabela_price",
      "venda_produto",
      "desconto_cheque",
      "reparcelamento"
    ]);
    statusContratoEnum = pgEnum("status_contrato", ["ativo", "quitado", "inadimplente", "cancelado"]);
    tipoTaxaEnum = pgEnum("tipo_taxa", ["diaria", "semanal", "quinzenal", "mensal", "anual"]);
    statusParcelaEnum = pgEnum("status_parcela", ["pendente", "paga", "atrasada", "vencendo_hoje", "parcial"]);
    tipoTransacaoEnum = pgEnum("tipo_transacao", ["entrada", "saida", "transferencia"]);
    categoriaTransacaoEnum = pgEnum("categoria_transacao", [
      "pagamento_parcela",
      "emprestimo_liberado",
      "despesa_operacional",
      "transferencia_conta",
      "ajuste_manual",
      "outros"
    ]);
    tipoTemplateEnum = pgEnum("tipo_template", [
      "cobranca_geral",
      "cobranca_vencida",
      "lembrete_vencimento",
      "confirmacao_pagamento",
      "boas_vindas",
      "pix_transferencia",
      "personalizado"
    ]);
    categoriaContaPagarEnum = pgEnum("categoria_conta_pagar", [
      "aluguel",
      "salario",
      "servicos",
      "impostos",
      "fornecedores",
      "marketing",
      "tecnologia",
      "outros"
    ]);
    statusContaPagarEnum = pgEnum("status_conta_pagar", ["pendente", "paga", "atrasada", "cancelada"]);
    periodicidadeEnum = pgEnum("periodicidade", ["mensal", "semanal", "anual", "unica"]);
    tipoTaxaChequeEnum = pgEnum("tipo_taxa_cheque", ["mensal", "diaria", "anual"]);
    statusChequeEnum = pgEnum("status_cheque", ["aguardando", "compensado", "devolvido", "cancelado"]);
    sexoEnum = pgEnum("sexo", ["masculino", "feminino", "outro"]);
    estadoCivilEnum = pgEnum("estado_civil", ["solteiro", "casado", "divorciado", "viuvo", "outro"]);
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      passwordHash: varchar("passwordHash", { length: 255 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: roleEnum("role").default("user").notNull(),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
      onboardingCompleto: boolean("onboarding_completo").default(false).notNull(),
      nomeEmpresa: varchar("nome_empresa", { length: 255 })
    });
    koletores = pgTable("koletores", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      nome: varchar("nome", { length: 255 }).notNull(),
      email: varchar("email", { length: 320 }),
      telefone: varchar("telefone", { length: 20 }),
      whatsapp: varchar("whatsapp", { length: 20 }),
      perfil: perfilEnum("perfil").default("koletor").notNull(),
      limiteEmprestimo: decimal("limite_emprestimo", { precision: 15, scale: 2 }).default("0.00"),
      comissaoPercentual: decimal("comissao_percentual", { precision: 8, scale: 4 }).default("0.00"),
      ativo: boolean("ativo").default(true).notNull(),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    clientes = pgTable("clientes", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      nome: varchar("nome", { length: 255 }).notNull(),
      cpfCnpj: varchar("cpf_cnpj", { length: 20 }),
      telefone: varchar("telefone", { length: 20 }),
      whatsapp: varchar("whatsapp", { length: 20 }),
      email: varchar("email", { length: 320 }),
      chavePix: varchar("chave_pix", { length: 255 }),
      tipoChavePix: tipoChavePixEnum("tipo_chave_pix"),
      endereco: text("endereco"),
      numero: varchar("numero", { length: 20 }),
      complemento: varchar("complemento", { length: 100 }),
      bairro: varchar("bairro", { length: 100 }),
      cidade: varchar("cidade", { length: 100 }),
      estado: varchar("estado", { length: 2 }),
      cep: varchar("cep", { length: 9 }),
      observacoes: text("observacoes"),
      score: integer("score").default(100),
      fotoUrl: varchar("foto_url", { length: 500 }),
      categoria: categoriaClienteEnum("categoria").default("padrao"),
      qualificacao: qualificacaoEnum("qualificacao").default("bom"),
      limiteCredito: decimal("limite_credito", { precision: 15, scale: 2 }).default("0.00"),
      limiteDisponivel: decimal("limite_disponivel", { precision: 15, scale: 2 }).default("0.00"),
      koletorId: integer("koletor_id"),
      banco: varchar("banco", { length: 100 }),
      agencia: varchar("agencia", { length: 20 }),
      numeroConta: varchar("numero_conta", { length: 30 }),
      ativo: boolean("ativo").default(true).notNull(),
      rg: varchar("rg", { length: 20 }),
      cnpj: varchar("cnpj", { length: 20 }),
      instagram: varchar("instagram", { length: 100 }),
      facebook: varchar("facebook", { length: 255 }),
      profissao: varchar("profissao", { length: 100 }),
      dataNascimento: date("data_nascimento"),
      sexo: sexoEnum("sexo"),
      estadoCivil: estadoCivilEnum("estado_civil"),
      nomeMae: varchar("nome_mae", { length: 255 }),
      nomePai: varchar("nome_pai", { length: 255 }),
      documentosUrls: text("documentos_urls"),
      tipoCliente: varchar("tipo_cliente", { length: 50 }).default("emprestimo"),
      isReferral: boolean("is_referral").default(false),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    contasCaixa = pgTable("contas_caixa", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      nome: varchar("nome", { length: 100 }).notNull(),
      tipo: tipoCaixaEnum("tipo").default("caixa").notNull(),
      banco: varchar("banco", { length: 100 }),
      agencia: varchar("agencia", { length: 20 }),
      numeroConta: varchar("numero_conta", { length: 30 }),
      saldoInicial: decimal("saldo_inicial", { precision: 15, scale: 2 }).default("0.00").notNull(),
      ativa: boolean("ativa").default(true).notNull(),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    contratos = pgTable("contratos", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      clienteId: integer("cliente_id").notNull(),
      koletorId: integer("koletor_id"),
      modalidade: modalidadeEnum("modalidade").notNull(),
      status: statusContratoEnum("status").default("ativo").notNull(),
      valorPrincipal: decimal("valor_principal", { precision: 15, scale: 2 }).notNull(),
      taxaJuros: decimal("taxa_juros", { precision: 8, scale: 4 }).notNull(),
      tipoTaxa: tipoTaxaEnum("tipo_taxa").default("mensal").notNull(),
      numeroParcelas: integer("numero_parcelas").notNull(),
      valorParcela: decimal("valor_parcela", { precision: 15, scale: 2 }).notNull(),
      totalContrato: decimal("total_contrato", { precision: 15, scale: 2 }).notNull(),
      multaAtraso: decimal("multa_atraso", { precision: 8, scale: 4 }).default("2.00"),
      jurosMoraDiario: decimal("juros_mora_diario", { precision: 8, scale: 4 }).default("0.033"),
      dataInicio: date("data_inicio").notNull(),
      dataVencimentoPrimeira: date("data_vencimento_primeira").notNull(),
      diaVencimento: integer("dia_vencimento"),
      descricao: text("descricao"),
      observacoes: text("observacoes"),
      contaCaixaId: integer("conta_caixa_id"),
      contratoOrigemId: integer("contrato_origem_id"),
      contratoAssinado: boolean("contrato_assinado").default(false),
      contratoUrl: varchar("contrato_url", { length: 500 }),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    parcelas = pgTable("parcelas", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      contratoId: integer("contrato_id").notNull(),
      clienteId: integer("cliente_id").notNull(),
      koletorId: integer("koletor_id"),
      numeroParcela: integer("numero_parcela").notNull(),
      valorOriginal: decimal("valor_original", { precision: 15, scale: 2 }).notNull(),
      valorPago: decimal("valor_pago", { precision: 15, scale: 2 }),
      valorJuros: decimal("valor_juros", { precision: 15, scale: 2 }).default("0.00"),
      valorMulta: decimal("valor_multa", { precision: 15, scale: 2 }).default("0.00"),
      valorDesconto: decimal("valor_desconto", { precision: 15, scale: 2 }).default("0.00"),
      multaManual: decimal("multa_manual", { precision: 15, scale: 2 }).default("0.00"),
      dataVencimento: date("data_vencimento").notNull(),
      dataPagamento: timestamp("data_pagamento", { withTimezone: true }),
      status: statusParcelaEnum("status").default("pendente").notNull(),
      contaCaixaId: integer("conta_caixa_id"),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    transacoesCaixa = pgTable("transacoes_caixa", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      contaCaixaId: integer("conta_caixa_id").notNull(),
      tipo: tipoTransacaoEnum("tipo").notNull(),
      categoria: categoriaTransacaoEnum("categoria").notNull(),
      valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
      descricao: text("descricao"),
      parcelaId: integer("parcela_id"),
      contratoId: integer("contrato_id"),
      clienteId: integer("cliente_id"),
      contaDestinoId: integer("conta_destino_id"),
      dataTransacao: timestamp("data_transacao", { withTimezone: true }).defaultNow().notNull(),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
    });
    magicLinks = pgTable("magic_links", {
      id: serial("id").primaryKey(),
      clienteId: integer("cliente_id").notNull(),
      token: varchar("token", { length: 128 }).notNull().unique(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      usado: boolean("usado").default(false).notNull(),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
    });
    templatesWhatsapp = pgTable("templates_whatsapp", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      nome: varchar("nome", { length: 100 }).notNull(),
      tipo: tipoTemplateEnum("tipo").notNull(),
      mensagem: text("mensagem").notNull(),
      ativo: boolean("ativo").default(true).notNull(),
      padrao: boolean("padrao").default(false).notNull(),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    configuracoes = pgTable("configuracoes", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      chave: varchar("chave", { length: 100 }).notNull(),
      valor: text("valor"),
      descricao: text("descricao"),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    contasPagar = pgTable("contas_pagar", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      descricao: varchar("descricao", { length: 255 }).notNull(),
      categoria: categoriaContaPagarEnum("categoria").default("outros").notNull(),
      valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
      dataVencimento: date("data_vencimento").notNull(),
      dataPagamento: timestamp("data_pagamento", { withTimezone: true }),
      status: statusContaPagarEnum("status").default("pendente").notNull(),
      contaCaixaId: integer("conta_caixa_id"),
      recorrente: boolean("recorrente").default(false).notNull(),
      periodicidade: periodicidadeEnum("periodicidade").default("unica"),
      observacoes: text("observacoes"),
      comprovante: varchar("comprovante", { length: 500 }),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    produtos = pgTable("produtos", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      nome: varchar("nome", { length: 255 }).notNull(),
      descricao: text("descricao"),
      preco: decimal("preco", { precision: 15, scale: 2 }).notNull(),
      estoque: integer("estoque").default(0).notNull(),
      ativo: boolean("ativo").default(true).notNull(),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
    });
    cheques = pgTable("cheques", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      clienteId: integer("cliente_id").notNull(),
      numeroCheque: varchar("numero_cheque", { length: 50 }),
      banco: varchar("banco", { length: 100 }),
      agencia: varchar("agencia", { length: 20 }),
      conta: varchar("conta", { length: 30 }),
      emitente: varchar("emitente", { length: 255 }).notNull(),
      cpfCnpjEmitente: varchar("cpf_cnpj_emitente", { length: 20 }),
      valorNominal: decimal("valor_nominal", { precision: 15, scale: 2 }).notNull(),
      dataVencimento: date("data_vencimento").notNull(),
      taxaDesconto: decimal("taxa_desconto", { precision: 8, scale: 4 }).notNull(),
      tipoTaxa: tipoTaxaChequeEnum("tipo_taxa_cheque").default("mensal").notNull(),
      valorDesconto: decimal("valor_desconto", { precision: 15, scale: 2 }).notNull(),
      valorLiquido: decimal("valor_liquido", { precision: 15, scale: 2 }).notNull(),
      status: statusChequeEnum("status_cheque").default("aguardando").notNull(),
      contaCaixaId: integer("conta_caixa_id"),
      dataCompensacao: timestamp("data_compensacao", { withTimezone: true }),
      motivoDevolucao: varchar("motivo_devolucao", { length: 255 }),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    passwordResets = pgTable("password_resets", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull(),
      token: varchar("token", { length: 128 }).notNull().unique(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      usado: boolean("usado").default(false).notNull(),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
    });
    veiculos = pgTable("veiculos", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      clienteId: integer("cliente_id").notNull(),
      placa: varchar("placa", { length: 10 }).notNull(),
      marca: varchar("marca", { length: 50 }),
      modelo: varchar("modelo", { length: 100 }),
      ano: integer("ano"),
      cor: varchar("cor", { length: 50 }),
      renavam: varchar("renavam", { length: 20 }),
      chassi: varchar("chassi", { length: 50 }),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    parcelasVeiculo = pgTable("parcelas_veiculo", {
      id: serial("id").primaryKey(),
      veiculoId: integer("veiculo_id").notNull(),
      numero: integer("numero").notNull(),
      valorOriginal: decimal("valor_original", { precision: 15, scale: 2 }).notNull(),
      juros: decimal("juros", { precision: 15, scale: 2 }).default("0.00"),
      vencimento: date("vencimento").notNull(),
      status: statusParcelaEnum("status").default("pendente").notNull(),
      pagamentoData: date("pagamento_data"),
      valorPago: decimal("valor_pago", { precision: 15, scale: 2 }),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    statusVendaTelefoneEnum = pgEnum("status_venda_telefone", [
      "ativo",
      "quitado",
      "inadimplente",
      "cancelado"
    ]);
    vendas_telefone = pgTable("vendas_telefone", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      // Produto
      marca: varchar("marca", { length: 100 }).notNull(),
      modelo: varchar("modelo", { length: 200 }).notNull(),
      imei: varchar("imei", { length: 20 }),
      cor: varchar("cor", { length: 50 }),
      armazenamento: varchar("armazenamento", { length: 20 }),
      custo: decimal("custo", { precision: 12, scale: 2 }).notNull(),
      preco_venda: decimal("preco_venda", { precision: 12, scale: 2 }).notNull(),
      // Financiamento
      entrada_percentual: decimal("entrada_percentual", { precision: 5, scale: 2 }).notNull(),
      entrada_valor: decimal("entrada_valor", { precision: 12, scale: 2 }).notNull(),
      num_parcelas: integer("num_parcelas").notNull(),
      juros_mensal: decimal("juros_mensal", { precision: 5, scale: 2 }).notNull(),
      valor_parcela: decimal("valor_parcela", { precision: 12, scale: 2 }).notNull(),
      total_juros: decimal("total_juros", { precision: 12, scale: 2 }).notNull(),
      total_a_receber: decimal("total_a_receber", { precision: 12, scale: 2 }).notNull(),
      lucro_bruto: decimal("lucro_bruto", { precision: 12, scale: 2 }).notNull(),
      roi: decimal("roi", { precision: 8, scale: 2 }),
      payback_meses: decimal("payback_meses", { precision: 5, scale: 2 }),
      // Comprador
      comprador_nome: varchar("comprador_nome", { length: 200 }).notNull(),
      comprador_cpf: varchar("comprador_cpf", { length: 14 }),
      comprador_rg: varchar("comprador_rg", { length: 20 }),
      comprador_telefone: varchar("comprador_telefone", { length: 20 }),
      comprador_email: varchar("comprador_email", { length: 320 }),
      comprador_estado_civil: varchar("comprador_estado_civil", { length: 30 }),
      comprador_profissao: varchar("comprador_profissao", { length: 100 }),
      comprador_instagram: varchar("comprador_instagram", { length: 100 }),
      comprador_cep: varchar("comprador_cep", { length: 9 }),
      comprador_cidade: varchar("comprador_cidade", { length: 100 }),
      comprador_estado: varchar("comprador_estado", { length: 2 }),
      comprador_endereco: varchar("comprador_endereco", { length: 300 }),
      comprador_local_trabalho: varchar("comprador_local_trabalho", { length: 200 }),
      // Status
      status: statusVendaTelefoneEnum("status").default("ativo").notNull(),
      data_venda: timestamp("data_venda", { withTimezone: true }).defaultNow().notNull(),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
    });
    parcelas_venda_telefone = pgTable("parcelas_venda_telefone", {
      id: serial("id").primaryKey(),
      venda_id: integer("venda_id").notNull(),
      numero: integer("numero").notNull(),
      valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
      vencimento: timestamp("vencimento", { withTimezone: true }).notNull(),
      status: statusParcelaEnum("status").default("pendente").notNull(),
      pago_em: timestamp("pago_em", { withTimezone: true }),
      valor_pago: decimal("valor_pago", { precision: 12, scale: 2 }),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
    });
    statusAssinaturaEnum = pgEnum("status_assinatura", [
      "ativa",
      "cancelada",
      "suspensa",
      "inadimplente"
    ]);
    assinaturas = pgTable("assinaturas", {
      id: serial("id").primaryKey(),
      userId: integer("user_id"),
      clienteId: integer("cliente_id").notNull(),
      servico: varchar("servico", { length: 200 }).notNull(),
      descricao: text("descricao"),
      valorMensal: decimal("valor_mensal", { precision: 15, scale: 2 }).notNull(),
      diaVencimento: integer("dia_vencimento").notNull().default(10),
      status: statusAssinaturaEnum("status").default("ativa").notNull(),
      dataInicio: date("data_inicio").notNull(),
      dataCancelamento: date("data_cancelamento"),
      contaCaixaId: integer("conta_caixa_id"),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
    });
    pagamentosAssinatura = pgTable("pagamentos_assinatura", {
      id: serial("id").primaryKey(),
      assinaturaId: integer("assinatura_id").notNull(),
      clienteId: integer("cliente_id").notNull(),
      valorPago: decimal("valor_pago", { precision: 15, scale: 2 }).notNull(),
      dataPagamento: timestamp("data_pagamento", { withTimezone: true }).defaultNow().notNull(),
      mesReferencia: varchar("mes_referencia", { length: 7 }).notNull(),
      contaCaixaId: integer("conta_caixa_id"),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
    });
  }
});

// server/_core/env.ts
var env_exports = {};
__export(env_exports, {
  ENV: () => ENV
});
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      supabaseUrl: process.env.SUPABASE_URL ?? "",
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      evolutionApiUrl: process.env.EVOLUTION_API_URL ?? "http://147.182.191.118:8080",
      evolutionApiKey: process.env.EVOLUTION_API_KEY ?? "cobrapro_evo_key_2024"
    };
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  findUserByEmail: () => findUserByEmail,
  findUserById: () => findUserById,
  findUserByOpenId: () => findUserByOpenId,
  getDb: () => getDb,
  getSupabaseClient: () => getSupabaseClient,
  getSupabaseClientAsync: () => getSupabaseClientAsync,
  getUserByOpenId: () => getUserByOpenId,
  getUserCount: () => getUserCount,
  resetDb: () => resetDb,
  updateUserLastSignedIn: () => updateUserLastSignedIn,
  upsertUser: () => upsertUser
});
import dns from "dns";
import { eq, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
async function getCustomFetch() {
  if (_customFetch) return _customFetch;
  try {
    const { fetch: undiciFetch, Agent } = await import("undici");
    const dnsResolver = new dns.Resolver();
    dnsResolver.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);
    const dnsCache = /* @__PURE__ */ new Map();
    const agent = new Agent({
      connect: {
        lookup: (hostname, _options, callback) => {
          const cached = dnsCache.get(hostname);
          if (cached && cached.expires > Date.now()) {
            return callback(null, [{ address: cached.address, family: 4 }]);
          }
          dnsResolver.resolve4(hostname, (err, addresses) => {
            if (err) {
              return callback(err);
            }
            const address = addresses[0];
            dnsCache.set(hostname, { address, expires: Date.now() + 6e4 });
            callback(null, [{ address, family: 4 }]);
          });
        }
      }
    });
    _customFetch = (url, init) => {
      return undiciFetch(url, { ...init, dispatcher: agent });
    };
    console.log("[Database] Custom fetch with public DNS resolver initialized");
  } catch (e) {
    console.log("[Database] undici not available, using native fetch");
    _customFetch = fetch;
  }
  return _customFetch;
}
async function getSupabaseClientAsync() {
  if (_supabase) return _supabase;
  if (_supabaseInitialized) return null;
  if (_supabaseInitializing) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return _supabase;
  }
  _supabaseInitializing = true;
  const url = ENV.supabaseUrl || process.env.SUPABASE_URL;
  const key = ENV.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const customFetch = await getCustomFetch();
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: customFetch }
    });
    console.log("[Database] Supabase REST client initialized with custom DNS fetch");
  }
  _supabaseInitialized = true;
  _supabaseInitializing = false;
  return _supabase;
}
function getSupabaseClient() {
  return _supabase;
}
async function getDb() {
  return null;
}
function resetDb() {
  _dbInitialized = false;
  _db = null;
  try {
    _client?.end();
  } catch (_) {
  }
  _client = null;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (db) {
    try {
      const values = { openId: user.openId };
      const updateSet = {};
      const textFields = ["name", "email", "loginMethod"];
      const assignNullable = (field) => {
        const value = user[field];
        if (value === void 0) return;
        values[field] = value;
        updateSet[field] = value;
      };
      textFields.forEach(assignNullable);
      if (user.role !== void 0) {
        values.role = user.role;
        updateSet.role = user.role;
      }
      updateSet.updatedAt = /* @__PURE__ */ new Date();
      await db.insert(users).values(values).onConflictDoUpdate({
        target: users.openId,
        set: updateSet
      });
      return;
    } catch (err) {
      console.error("[Database] Drizzle upsertUser failed, trying REST:", err.message);
    }
  }
  const supabase = await getSupabaseClientAsync();
  if (!supabase) throw new Error("No database connection available");
  const { error } = await supabase.from("users").upsert({
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, { onConflict: "openId" });
  if (error) throw new Error(`Supabase upsertUser failed: ${error.message}`);
}
async function findUserByEmail(email) {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0] || null;
    } catch (err) {
      console.error("[Auth] Drizzle findUserByEmail failed, trying REST:", err.message);
      console.error("[Auth] Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
  }
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return null;
  const { data, error } = await supabase.from("users").select("*").eq("email", email).limit(1);
  console.log(`[Auth] Supabase findUserByEmail - data: ${data ? "found" : "null"} error: ${error ? error.message || JSON.stringify(error) : "none"}`);
  if (error) return null;
  return data?.[0] || null;
}
async function findUserByOpenId(openId) {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      return result[0] || null;
    } catch (err) {
      console.error("[Database] Drizzle findUserByOpenId failed:", err.message);
    }
  }
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return null;
  const { data, error } = await supabase.from("users").select("*").eq("openId", openId).limit(1);
  if (error) return null;
  return data?.[0] || null;
}
async function updateUserLastSignedIn(openId) {
  const db = await getDb();
  if (db) {
    try {
      await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.openId, openId));
      return;
    } catch (err) {
      console.error("[Database] Drizzle updateUserLastSignedIn failed:", err.message);
    }
  }
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return;
  await supabase.from("users").update({ lastSignedIn: (/* @__PURE__ */ new Date()).toISOString() }).eq("openId", openId);
}
async function findUserById(id) {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0] || null;
    } catch (err) {
      console.error("[Database] Drizzle findUserById failed:", err.message);
    }
  }
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return null;
  const { data, error } = await supabase.from("users").select("*").eq("id", id).limit(1);
  if (error) return null;
  return data?.[0] || null;
}
async function getUserCount() {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select({ count: sql`count(*)` }).from(users);
      return Number(result[0]?.count || 0);
    } catch (err) {
      console.error("[Database] Drizzle getUserCount failed:", err.message);
    }
  }
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return 0;
  const { count, error } = await supabase.from("users").select("*", { count: "exact", head: true });
  if (error) return 0;
  return count || 0;
}
var _customFetch, _db, _client, _supabase, _dbInitialized, _supabaseInitializing, _supabaseInitialized, getUserByOpenId;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    dns.setDefaultResultOrder("ipv4first");
    _customFetch = null;
    _db = null;
    _client = null;
    _supabase = null;
    _dbInitialized = false;
    _supabaseInitializing = false;
    _supabaseInitialized = false;
    getUserByOpenId = findUserByOpenId;
  }
});

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t, router, publicProcedure, requireUser, protectedProcedure, adminProcedure;
var init_trpc = __esm({
  "server/_core/trpc.ts"() {
    "use strict";
    init_const();
    t = initTRPC.context().create({
      transformer: superjson
    });
    router = t.router;
    publicProcedure = t.procedure;
    requireUser = t.middleware(async (opts) => {
      const { ctx, next } = opts;
      if (!ctx.user) {
        throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }
      return next({
        ctx: {
          ...ctx,
          user: ctx.user
        }
      });
    });
    protectedProcedure = t.procedure.use(requireUser);
    adminProcedure = t.procedure.use(
      t.middleware(async (opts) => {
        const { ctx, next } = opts;
        if (!ctx.user || ctx.user.role !== "admin") {
          throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
        }
        return next({
          ctx: {
            ...ctx,
            user: ctx.user
          }
        });
      })
    );
  }
});

// server/routers/notificacoes.ts
var notificacoes_exports = {};
__export(notificacoes_exports, {
  TIPOS_NOTIFICACAO: () => TIPOS_NOTIFICACAO,
  notificacoesRouter: () => notificacoesRouter,
  substituirVariaveis: () => substituirVariaveis
});
import { z as z8 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
function substituirVariaveis(template, vars) {
  let msg = template;
  if (vars.nome) msg = msg.replace(/{nome}/g, vars.nome);
  if (vars.valor !== void 0) msg = msg.replace(/{valor}/g, vars.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  if (vars.data_vencimento) msg = msg.replace(/{data_vencimento}/g, vars.data_vencimento);
  if (vars.dias_atraso !== void 0) msg = msg.replace(/{dias_atraso}/g, String(Math.abs(vars.dias_atraso)));
  if (vars.empresa) msg = msg.replace(/{empresa}/g, vars.empresa);
  if (vars.parcela !== void 0) msg = msg.replace(/{parcela}/g, String(vars.parcela));
  if (vars.total_parcelas !== void 0) msg = msg.replace(/{total_parcelas}/g, String(vars.total_parcelas));
  return msg;
}
async function enviarWhatsApp(userId, telefone, mensagem) {
  const evolutionUrl = ENV.evolutionApiUrl.replace(/\/$/, "");
  const evolutionApiKey = ENV.evolutionApiKey;
  const instanceName = `user-${userId}`;
  try {
    const statusRes = await fetch(
      `${evolutionUrl}/instance/connectionState/${instanceName}`,
      { headers: { apikey: evolutionApiKey } }
    );
    const statusData = await statusRes.json();
    if (statusData?.instance?.state !== "open") {
      return { ok: false, erro: "WhatsApp desconectado" };
    }
  } catch {
    return { ok: false, erro: "Erro ao verificar status do WhatsApp" };
  }
  let phone = telefone.replace(/\D/g, "");
  if (!phone.startsWith("55")) phone = "55" + phone;
  try {
    const res = await fetch(
      `${evolutionUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone + "@s.whatsapp.net", textMessage: { text: mensagem } })
      }
    );
    const data = await res.json();
    if (data?.error) return { ok: false, erro: data.message || "Erro ao enviar" };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}
var TIPOS_NOTIFICACAO, MENSAGENS_PADRAO, notificacoesRouter;
var init_notificacoes = __esm({
  "server/routers/notificacoes.ts"() {
    "use strict";
    init_trpc();
    init_db();
    init_env();
    TIPOS_NOTIFICACAO = [
      { tipo: "antes_vencimento_3", label: "3 dias antes", descricao: "Lembrete 3 dias antes do vencimento", diasAntes: 3 },
      { tipo: "antes_vencimento_2", label: "2 dias antes", descricao: "Lembrete 2 dias antes do vencimento", diasAntes: 2 },
      { tipo: "antes_vencimento_1", label: "1 dia antes", descricao: "Lembrete 1 dia antes do vencimento", diasAntes: 1 },
      { tipo: "no_vencimento", label: "No vencimento", descricao: "Aviso no dia do vencimento", diasAntes: 0 },
      { tipo: "apos_vencimento_1", label: "1 dia em atraso", descricao: "Cobran\xE7a 1 dia ap\xF3s o vencimento", diasAntes: -1 },
      { tipo: "apos_vencimento_3", label: "3 dias em atraso", descricao: "Cobran\xE7a 3 dias ap\xF3s o vencimento", diasAntes: -3 },
      { tipo: "apos_vencimento_7", label: "7 dias em atraso", descricao: "Cobran\xE7a 7 dias ap\xF3s o vencimento", diasAntes: -7 },
      { tipo: "confirmacao_pagamento", label: "Confirma\xE7\xE3o de pagamento", descricao: "Mensagem ao confirmar pagamento", diasAntes: 0 }
    ];
    MENSAGENS_PADRAO = {
      antes_vencimento_3: "Ol\xE1 {nome}! \u{1F60A} Sua parcela de *R$ {valor}* vence em *3 dias* ({data_vencimento}). Qualquer d\xFAvida, estamos \xE0 disposi\xE7\xE3o! \u2014 {empresa}",
      antes_vencimento_2: "Ol\xE1 {nome}! Sua parcela de *R$ {valor}* vence em *2 dias* ({data_vencimento}). N\xE3o esque\xE7a! \u{1F609} \u2014 {empresa}",
      antes_vencimento_1: "Ol\xE1 {nome}! \u26A0\uFE0F Sua parcela de *R$ {valor}* vence *amanh\xE3* ({data_vencimento}). Por favor, efetue o pagamento para evitar juros. \u2014 {empresa}",
      no_vencimento: "Ol\xE1 {nome}! \u{1F4C5} Sua parcela de *R$ {valor}* vence *hoje* ({data_vencimento}). Efetue o pagamento para evitar juros. \u2014 {empresa}",
      apos_vencimento_1: "Ol\xE1 {nome}, sua parcela de *R$ {valor}* est\xE1 em atraso h\xE1 *1 dia*. Por favor, regularize o quanto antes. \u2014 {empresa}",
      apos_vencimento_3: "Ol\xE1 {nome}, sua parcela de *R$ {valor}* est\xE1 em atraso h\xE1 *3 dias*. Entre em contato para evitar maiores problemas. \u2014 {empresa}",
      apos_vencimento_7: "Ol\xE1 {nome}, sua parcela de *R$ {valor}* est\xE1 em atraso h\xE1 *7 dias*. Urgente: regularize sua situa\xE7\xE3o. \u2014 {empresa}",
      confirmacao_pagamento: "Ol\xE1 {nome}! \u2705 Recebemos seu pagamento de *R$ {valor}* referente \xE0 parcela {parcela}/{total_parcelas}. Obrigado! \u2014 {empresa}"
    };
    notificacoesRouter = router({
      // Listar todas as regras do usuário (com defaults para tipos não configurados)
      listar: protectedProcedure.query(async ({ ctx }) => {
        const sb2 = await getSupabaseClientAsync();
        if (!sb2) return TIPOS_NOTIFICACAO.map((t2) => ({ ...t2, id: null, ativo: false, mensagem_template: MENSAGENS_PADRAO[t2.tipo] }));
        const { data } = await sb2.from("notificacoes_automaticas").select("*").eq("user_id", ctx.user.id);
        const existentes = {};
        (data ?? []).forEach((r) => {
          existentes[r.tipo] = { id: r.id, ativo: r.ativo, mensagem_template: r.mensagem_template };
        });
        return TIPOS_NOTIFICACAO.map((t2) => ({
          ...t2,
          id: existentes[t2.tipo]?.id ?? null,
          ativo: existentes[t2.tipo]?.ativo ?? false,
          mensagem_template: existentes[t2.tipo]?.mensagem_template || MENSAGENS_PADRAO[t2.tipo]
        }));
      }),
      // Verificar se as mensagens automáticas estão habilitadas globalmente
      getGlobalAtivo: protectedProcedure.query(async ({ ctx }) => {
        const sb2 = await getSupabaseClientAsync();
        if (!sb2) return false;
        const { data } = await sb2.from("configuracoes").select("valor").eq("chave", "notificacoes_auto_ativo").eq("user_id", ctx.user.id).maybeSingle();
        return data?.valor === "true";
      }),
      // Ligar/desligar o sistema globalmente
      setGlobalAtivo: protectedProcedure.input(z8.object({ ativo: z8.boolean() })).mutation(async ({ ctx, input }) => {
        const sb2 = await getSupabaseClientAsync();
        if (!sb2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await sb2.from("configuracoes").upsert(
          { chave: "notificacoes_auto_ativo", valor: String(input.ativo), user_id: ctx.user.id },
          { onConflict: "chave,user_id" }
        );
        return { success: true };
      }),
      // Salvar/atualizar uma regra (mensagem + ativo)
      salvar: protectedProcedure.input(z8.object({
        tipo: z8.string(),
        ativo: z8.boolean(),
        mensagem_template: z8.string().min(1)
      })).mutation(async ({ ctx, input }) => {
        const sb2 = await getSupabaseClientAsync();
        if (!sb2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const tipoInfo = TIPOS_NOTIFICACAO.find((t2) => t2.tipo === input.tipo);
        if (!tipoInfo) throw new TRPCError8({ code: "BAD_REQUEST", message: "Tipo inv\xE1lido" });
        await sb2.from("notificacoes_automaticas").upsert(
          {
            user_id: ctx.user.id,
            tipo: input.tipo,
            ativo: input.ativo,
            dias_antes: tipoInfo.diasAntes,
            mensagem_template: input.mensagem_template,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          { onConflict: "user_id,tipo,dias_antes" }
        );
        return { success: true };
      }),
      // Toggle rápido de ativo/inativo para uma regra
      toggle: protectedProcedure.input(z8.object({ tipo: z8.string(), ativo: z8.boolean() })).mutation(async ({ ctx, input }) => {
        const sb2 = await getSupabaseClientAsync();
        if (!sb2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const tipoInfo = TIPOS_NOTIFICACAO.find((t2) => t2.tipo === input.tipo);
        if (!tipoInfo) throw new TRPCError8({ code: "BAD_REQUEST", message: "Tipo inv\xE1lido" });
        const { data: existing } = await sb2.from("notificacoes_automaticas").select("id, mensagem_template").eq("user_id", ctx.user.id).eq("tipo", input.tipo).maybeSingle();
        if (existing) {
          await sb2.from("notificacoes_automaticas").update({ ativo: input.ativo, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("user_id", ctx.user.id).eq("tipo", input.tipo);
        } else {
          await sb2.from("notificacoes_automaticas").insert({
            user_id: ctx.user.id,
            tipo: input.tipo,
            ativo: input.ativo,
            dias_antes: tipoInfo.diasAntes,
            mensagem_template: MENSAGENS_PADRAO[input.tipo] || ""
          });
        }
        return { success: true };
      }),
      // Histórico de envios recentes
      historico: protectedProcedure.input(z8.object({ limit: z8.number().default(50) }).optional()).query(async ({ ctx, input }) => {
        const sb2 = await getSupabaseClientAsync();
        if (!sb2) return [];
        const { data } = await sb2.from("notificacoes_log").select("*, clientes(nome)").eq("user_id", ctx.user.id).order("createdAt", { ascending: false }).limit(input?.limit ?? 50);
        return data ?? [];
      }),
      // Testar envio (envia para o WhatsApp do próprio usuário)
      testar: protectedProcedure.input(z8.object({
        tipo: z8.string(),
        mensagem_template: z8.string()
      })).mutation(async ({ ctx, input }) => {
        const sb2 = await getSupabaseClientAsync();
        if (!sb2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { data: wppConfig } = await sb2.from("configuracoes").select("valor").eq("chave", "whatsappEmpresa").eq("user_id", ctx.user.id).maybeSingle();
        const { data: empresaConfig } = await sb2.from("configuracoes").select("valor").eq("chave", "nomeEmpresa").eq("user_id", ctx.user.id).maybeSingle();
        const telefone = wppConfig?.valor;
        if (!telefone) throw new TRPCError8({ code: "BAD_REQUEST", message: "Configure o WhatsApp da empresa no Meu Perfil primeiro" });
        const mensagem = substituirVariaveis(input.mensagem_template, {
          nome: "Jo\xE3o Silva (teste)",
          valor: 250,
          data_vencimento: (/* @__PURE__ */ new Date()).toLocaleDateString("pt-BR"),
          dias_atraso: 2,
          empresa: empresaConfig?.valor || "Sua Empresa",
          parcela: 3,
          total_parcelas: 12
        });
        const resultado = await enviarWhatsApp(ctx.user.id, telefone, mensagem);
        if (!resultado.ok) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: resultado.erro || "Erro ao enviar" });
        return { success: true, mensagem };
      }),
      // Job: disparar notificações do dia para um usuário específico (chamado pelo cron)
      dispararDoDia: protectedProcedure.mutation(async ({ ctx }) => {
        const sb2 = await getSupabaseClientAsync();
        if (!sb2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { data: globalConfig } = await sb2.from("configuracoes").select("valor").eq("chave", "notificacoes_auto_ativo").eq("user_id", ctx.user.id).maybeSingle();
        if (globalConfig?.valor !== "true") return { enviados: 0, mensagem: "Notifica\xE7\xF5es autom\xE1ticas desativadas" };
        const { data: regras } = await sb2.from("notificacoes_automaticas").select("*").eq("user_id", ctx.user.id).eq("ativo", true);
        if (!regras || regras.length === 0) return { enviados: 0, mensagem: "Nenhuma regra ativa" };
        const { data: empresaConfig } = await sb2.from("configuracoes").select("valor").eq("chave", "nomeEmpresa").eq("user_id", ctx.user.id).maybeSingle();
        const nomeEmpresa = empresaConfig?.valor || "Empresa";
        const hoje = /* @__PURE__ */ new Date();
        hoje.setHours(0, 0, 0, 0);
        let enviados = 0;
        for (const regra of regras) {
          const dataAlvo = new Date(hoje);
          dataAlvo.setDate(dataAlvo.getDate() + regra.dias_antes);
          const dataAlvoStr = dataAlvo.toISOString().split("T")[0];
          const { data: parcelas2 } = await sb2.from("parcelas").select("id, valor, numero_parcela, contrato_id, contratos!inner(numero_parcelas, cliente_id, clientes!inner(id, nome, whatsapp, telefone))").eq("user_id", ctx.user.id).eq("data_vencimento", dataAlvoStr).in("status", ["pendente", "atrasada"]);
          if (!parcelas2 || parcelas2.length === 0) continue;
          for (const parcela of parcelas2) {
            const cliente = parcela.contratos?.clientes;
            if (!cliente) continue;
            const telefone = cliente.whatsapp || cliente.telefone;
            if (!telefone) continue;
            const { data: logExistente } = await sb2.from("notificacoes_log").select("id").eq("user_id", ctx.user.id).eq("parcela_id", parcela.id).eq("tipo", regra.tipo).gte("createdAt", hoje.toISOString()).maybeSingle();
            if (logExistente) continue;
            const mensagem = substituirVariaveis(regra.mensagem_template, {
              nome: cliente.nome,
              valor: parcela.valor,
              data_vencimento: dataAlvoStr.split("-").reverse().join("/"),
              dias_atraso: regra.dias_antes < 0 ? Math.abs(regra.dias_antes) : 0,
              empresa: nomeEmpresa,
              parcela: parcela.numero_parcela,
              total_parcelas: parcela.contratos?.numero_parcelas
            });
            const resultado = await enviarWhatsApp(ctx.user.id, telefone, mensagem);
            await sb2.from("notificacoes_log").insert({
              user_id: ctx.user.id,
              parcela_id: parcela.id,
              cliente_id: cliente.id,
              tipo: regra.tipo,
              telefone,
              mensagem,
              status: resultado.ok ? "enviado" : "erro",
              erro: resultado.ok ? null : resultado.erro
            });
            if (resultado.ok) enviados++;
          }
        }
        return { enviados, mensagem: `${enviados} mensagem(ns) enviada(s)` };
      })
    });
  }
});

// server/_core/index.ts
import "dotenv/config";
import compression from "compression";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/oauth.ts
init_const();
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/sdk.ts
init_const();

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/authRoutes.ts
init_schema();
init_const();
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq as eq2, gt, sql as sql2 } from "drizzle-orm";
init_db();

// server/storage.ts
init_env();
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

// server/authRoutes.ts
async function findUserByEmail2(email) {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq2(users.email, email)).limit(1);
      return result[0] ?? null;
    } catch (err) {
      console.warn("[Auth] Drizzle findUserByEmail failed, trying REST:", err.message);
      console.warn("[Auth] Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
  }
  const supabase = await getSupabaseClientAsync();
  if (!supabase) {
    console.error("[Auth] No Supabase client available");
    return null;
  }
  const { data, error } = await supabase.from("users").select("*").eq("email", email).limit(1).maybeSingle();
  console.log("[Auth] Supabase findUserByEmail - data:", data ? "found" : "null", "error:", error ? error.message : "none");
  if (error || !data) return null;
  return mapSupabaseUser(data);
}
function mapSupabaseUser(data) {
  return {
    id: data.id,
    openId: data.openId ?? "",
    name: data.name ?? null,
    email: data.email ?? null,
    passwordHash: data.passwordHash ?? null,
    loginMethod: data.loginMethod ?? null,
    role: data.role ?? "user",
    lastSignedIn: data.lastSignedIn ? new Date(data.lastSignedIn) : /* @__PURE__ */ new Date(),
    createdAt: data.createdAt ? new Date(data.createdAt) : /* @__PURE__ */ new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : /* @__PURE__ */ new Date(),
    onboardingCompleto: data.onboarding_completo ?? false,
    nomeEmpresa: data.nome_empresa ?? null
  };
}
async function createSessionForUser(user, req, res) {
  const sessionToken = await sdk.signSession(
    {
      openId: user.openId,
      appId: process.env.VITE_APP_ID ?? "cobrapro",
      name: user.name ?? user.email ?? ""
    },
    { expiresInMs: ONE_YEAR_MS }
  );
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}
function registerAuthRoutes(app) {
  app.get("/api/auth/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.redirect("/login");
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email e senha s\xE3o obrigat\xF3rios" });
        return;
      }
      const user = await findUserByEmail2(email);
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Email ou senha incorretos" });
        return;
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Email ou senha incorretos" });
        return;
      }
      try {
        const db = await getDb();
        if (db) {
          await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
        } else {
          const supabase = await getSupabaseClientAsync();
          if (supabase) {
            await supabase.from("users").update({ lastSignedIn: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", user.id);
          }
        }
      } catch (_) {
      }
      await createSessionForUser(user, req, res);
      res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      res.status(500).json({ error: "Erro interno ao processar login. Tente novamente." });
    }
  });
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        res.status(400).json({ error: "Nome, email e senha s\xE3o obrigat\xF3rios" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
        return;
      }
      const existing = await findUserByEmail2(email);
      if (existing) {
        res.status(409).json({ error: "Este email j\xE1 est\xE1 cadastrado" });
        return;
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const db = await getDb();
      let newUser = null;
      if (db) {
        const countResult = await db.select({ count: sql2`count(*)` }).from(users);
        const isFirstUser = (countResult[0]?.count ?? 0) === 0;
        await db.insert(users).values({
          openId,
          name,
          email,
          passwordHash,
          loginMethod: "email",
          role: isFirstUser ? "admin" : "user",
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        newUser = (await db.select().from(users).where(eq2(users.email, email)).limit(1))[0] ?? null;
      } else {
        const supabase = await getSupabaseClientAsync();
        if (!supabase) {
          res.status(500).json({ error: "Banco de dados indispon\xEDvel" });
          return;
        }
        const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
        const isFirstUser = (count ?? 0) === 0;
        const { data, error } = await supabase.from("users").insert({
          openId,
          name,
          email,
          passwordHash,
          loginMethod: "email",
          role: isFirstUser ? "admin" : "user",
          lastSignedIn: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (error || !data) {
          res.status(500).json({ error: "Erro ao criar usu\xE1rio" });
          return;
        }
        newUser = mapSupabaseUser(data);
      }
      if (!newUser) {
        res.status(500).json({ error: "Erro ao criar usu\xE1rio" });
        return;
      }
      await createSessionForUser(newUser, req, res);
      res.json({
        success: true,
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
      });
    } catch (err) {
      console.error("[Auth] Register error:", err);
      res.status(500).json({ error: "Erro interno ao registrar. Tente novamente." });
    }
  });
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "Email \xE9 obrigat\xF3rio" });
        return;
      }
      const user = await findUserByEmail2(email);
      if (!user) {
        res.json({ success: true, message: "Se o email existir, voc\xEA receber\xE1 as instru\xE7\xF5es." });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3);
      const db = await getDb();
      if (db) {
        await db.update(passwordResets).set({ usado: true }).where(eq2(passwordResets.userId, user.id));
        await db.insert(passwordResets).values({ userId: user.id, token, expiresAt });
      } else {
        const supabase = await getSupabaseClientAsync();
        if (supabase) {
          await supabase.from("password_resets").update({ usado: true }).eq("userId", user.id);
          await supabase.from("password_resets").insert({
            userId: user.id,
            token,
            expiresAt: expiresAt.toISOString(),
            usado: false
          });
        }
      }
      const origin = req.headers.origin || `https://cobrapro.online`;
      const resetUrl = `${origin}/reset-senha?token=${token}`;
      const brevoApiKey = process.env.BREVO_API_KEY ?? "";
      if (brevoApiKey) {
        try {
          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoApiKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sender: { name: "CobraPro", email: "noreply@cobrapro.online" },
              to: [{ email: user.email, name: user.name ?? user.email }],
              subject: "Recupera\xE7\xE3o de senha \u2014 CobraPro",
              htmlContent: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:40px;border-radius:12px">
                  <div style="text-align:center;margin-bottom:32px">
                    <h1 style="color:#22c55e;font-size:28px;margin:0">CobraPro</h1>
                    <p style="color:#6b7280;margin:8px 0 0">Sistema de Gest\xE3o de Cobran\xE7as</p>
                  </div>
                  <h2 style="color:#fff;font-size:20px">Recupera\xE7\xE3o de senha</h2>
                  <p style="color:#d1d5db;line-height:1.6">Recebemos uma solicita\xE7\xE3o para redefinir a senha da sua conta CobraPro.</p>
                  <p style="color:#d1d5db;line-height:1.6">Clique no bot\xE3o abaixo para criar uma nova senha. Este link \xE9 v\xE1lido por <strong style="color:#22c55e">1 hora</strong>.</p>
                  <div style="text-align:center;margin:32px 0">
                    <a href="${resetUrl}" style="background:#22c55e;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">Redefinir minha senha</a>
                  </div>
                  <p style="color:#6b7280;font-size:13px">Se voc\xEA n\xE3o solicitou a recupera\xE7\xE3o de senha, ignore este e-mail. Sua senha permanece a mesma.</p>
                  <hr style="border:1px solid #1f2937;margin:24px 0">
                  <p style="color:#4b5563;font-size:12px;text-align:center">CobraPro \u2014 cobrapro.online</p>
                </div>
              `
            })
          });
        } catch (err) {
          console.error("[Brevo] Erro ao enviar e-mail de recupera\xE7\xE3o:", err);
        }
      }
      res.json({
        success: true,
        message: "Se o e-mail estiver cadastrado, voc\xEA receber\xE1 as instru\xE7\xF5es em breve."
      });
    } catch (err) {
      console.error("[Auth] Forgot-password error:", err);
      res.status(500).json({ error: "Erro interno. Tente novamente." });
    }
  });
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        res.status(400).json({ error: "Token e nova senha s\xE3o obrigat\xF3rios" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
        return;
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const now = /* @__PURE__ */ new Date();
      const db = await getDb();
      if (db) {
        const resetResult = await db.select().from(passwordResets).where(
          and(
            eq2(passwordResets.token, token),
            eq2(passwordResets.usado, false),
            gt(passwordResets.expiresAt, now)
          )
        ).limit(1);
        const reset = resetResult[0];
        if (!reset) {
          res.status(400).json({ error: "Token inv\xE1lido ou expirado" });
          return;
        }
        await db.update(users).set({ passwordHash }).where(eq2(users.id, reset.userId));
        await db.update(passwordResets).set({ usado: true }).where(eq2(passwordResets.id, reset.id));
      } else {
        const supabase = await getSupabaseClientAsync();
        if (!supabase) {
          res.status(500).json({ error: "Banco de dados indispon\xEDvel" });
          return;
        }
        const { data: resetData, error: resetError } = await supabase.from("password_resets").select("*").eq("token", token).eq("usado", false).gt("expiresAt", now.toISOString()).limit(1).maybeSingle();
        if (resetError || !resetData) {
          res.status(400).json({ error: "Token inv\xE1lido ou expirado" });
          return;
        }
        await supabase.from("users").update({ passwordHash }).eq("id", resetData.userId);
        await supabase.from("password_resets").update({ usado: true }).eq("id", resetData.id);
      }
      res.json({ success: true, message: "Senha alterada com sucesso!" });
    } catch (err) {
      console.error("[Auth] Reset-password error:", err);
      res.status(500).json({ error: "Erro interno. Tente novamente." });
    }
  });
  app.post("/api/auth/seed-admin", async (req, res) => {
    try {
      const { secret } = req.body;
      if (secret !== "cobrapro-seed-2026") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const adminEmail = "koletor3@gmail.com";
      const passwordHash = await bcrypt.hash("97556511", 12);
      const db = await getDb();
      if (db) {
        const existing2 = await db.select().from(users).where(eq2(users.email, adminEmail)).limit(1);
        if (existing2.length > 0) {
          await db.update(users).set({ passwordHash, role: "admin", loginMethod: "email" }).where(eq2(users.email, adminEmail));
          res.json({ success: true, message: "Admin atualizado com sucesso (Drizzle)" });
          return;
        }
        const openId2 = `admin_cobrapro_${Date.now()}`;
        await db.insert(users).values({
          openId: openId2,
          name: "Administrador",
          email: adminEmail,
          passwordHash,
          loginMethod: "email",
          role: "admin",
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        res.json({ success: true, message: "Admin criado com sucesso (Drizzle)" });
        return;
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) {
        res.status(500).json({ error: "Banco de dados indispon\xEDvel" });
        return;
      }
      const { data: existing } = await supabase.from("users").select("id, email").eq("email", adminEmail).limit(1).maybeSingle();
      if (existing) {
        await supabase.from("users").update({
          passwordHash,
          role: "admin",
          loginMethod: "email"
        }).eq("email", adminEmail);
        res.json({ success: true, message: "Admin atualizado com sucesso (REST)" });
        return;
      }
      const openId = `admin_cobrapro_${Date.now()}`;
      await supabase.from("users").insert({
        openId,
        name: "Administrador",
        email: adminEmail,
        passwordHash,
        loginMethod: "email",
        role: "admin",
        lastSignedIn: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, message: "Admin criado com sucesso (REST)" });
    } catch (err) {
      console.error("[Auth] Seed-admin error:", err);
      res.status(500).json({ error: "Erro interno. Tente novamente." });
    }
  });
  app.post("/api/upload", async (req, res) => {
    try {
      const { base64, contentType, filename, folder } = req.body;
      if (!base64 || !contentType || !filename) {
        res.status(400).json({ error: "base64, contentType e filename s\xE3o obrigat\xF3rios" });
        return;
      }
      const buffer = Buffer.from(base64, "base64");
      const safeFolder = (folder || "clientes").replace(/[^a-zA-Z0-9_-]/g, "");
      const timestamp2 = Date.now();
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `${safeFolder}/${timestamp2}_${safeName}`;
      const { url } = await storagePut(key, buffer, contentType);
      res.json({ url, key });
    } catch (err) {
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: "Erro ao fazer upload do arquivo" });
    }
  });
}

// server/webhookRoutes.ts
init_db();
function registerWebhookRoutes(app) {
  app.post("/api/webhook/evolution", async (req, res) => {
    try {
      const payload = req.body;
      res.status(200).json({ received: true });
      await processWebhookEvent(payload);
    } catch (err) {
      console.error("[Webhook Evolution] Erro ao processar:", err);
      res.status(200).json({ received: true });
    }
  });
  app.get("/api/webhook/evolution", (_req, res) => {
    res.json({ status: "ok", service: "CobraPro Evolution Webhook", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
}
async function processWebhookEvent(payload) {
  try {
    const event = payload?.event;
    const instance = payload?.instance;
    const data = payload?.data;
    if (!event) return;
    console.log(`[Webhook Evolution] Evento: ${event} | Inst\xE2ncia: ${instance}`);
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) {
      console.error("[Webhook Evolution] Supabase indispon\xEDvel");
      return;
    }
    await sb2.from("whatsapp_eventos").insert({
      evento: event,
      instancia: instance || "cobrapro",
      payload: JSON.stringify(payload),
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
    }).then(({ error }) => {
      if (error) console.warn("[Webhook Evolution] Erro ao salvar evento:", error);
    });
    switch (event) {
      case "MESSAGES_UPDATE": {
        if (Array.isArray(data?.updates)) {
          for (const update of data.updates) {
            const msgId = update?.key?.id;
            const status = update?.update?.status;
            if (msgId && status) {
              await sb2.from("whatsapp_mensagens").update({ status_entrega: status, atualizado_em: (/* @__PURE__ */ new Date()).toISOString() }).eq("evolution_msg_id", msgId).then(({ error }) => {
                if (error) console.warn("[Webhook Evolution] Erro ao atualizar status:", error);
              });
            }
          }
        }
        break;
      }
      case "MESSAGES_UPSERT": {
        const msgs = Array.isArray(data?.messages) ? data.messages : [];
        for (const msg of msgs) {
          const fromMe = msg?.key?.fromMe;
          if (!fromMe) {
            const remoteJid = msg?.key?.remoteJid;
            const text2 = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "";
            console.log(`[Webhook Evolution] Mensagem recebida de ${remoteJid}: ${text2.substring(0, 50)}`);
            await sb2.from("whatsapp_eventos").insert({
              evento: "MENSAGEM_RECEBIDA",
              instancia: instance || "cobrapro",
              payload: JSON.stringify({ remoteJid, text: text2, timestamp: msg?.messageTimestamp }),
              criado_em: (/* @__PURE__ */ new Date()).toISOString()
            }).then(({ error }) => {
              if (error) console.warn("[Webhook Evolution] Erro ao salvar mensagem recebida:", error);
            });
          }
        }
        break;
      }
      case "CONNECTION_UPDATE": {
        const state = data?.instance?.state || data?.state;
        console.log(`[Webhook Evolution] Conex\xE3o: ${state}`);
        await sb2.from("configuracoes").upsert(
          { chave: "evolution_connection_state", valor: state || "unknown" },
          { onConflict: "chave,user_id" }
        ).then(({ error }) => {
          if (error) console.warn("[Webhook Evolution] Erro ao salvar estado:", error);
        });
        break;
      }
      case "QRCODE_UPDATED": {
        console.log("[Webhook Evolution] Novo QR Code gerado");
        break;
      }
      default:
        console.log(`[Webhook Evolution] Evento n\xE3o tratado: ${event}`);
    }
  } catch (err) {
    console.error("[Webhook Evolution] Erro no processamento:", err);
  }
}

// server/kiwifyWebhook.ts
init_schema();
init_db();
import bcrypt2 from "bcryptjs";
import { eq as eq3 } from "drizzle-orm";

// server/_core/email.ts
async function enviarEmail(params) {
  const brevoApiKey = process.env.BREVO_API_KEY ?? "";
  if (!brevoApiKey) {
    console.warn("[Email] BREVO_API_KEY n\xE3o configurada");
    return false;
  }
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "CobraPro", email: "noreply@cobrapro.online" },
        to: [{ email: params.to, name: params.toName ?? params.to }],
        subject: params.subject,
        htmlContent: params.htmlContent
      })
    });
    if (!response.ok) {
      const error = await response.json();
      console.error("[Email] Erro ao enviar email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Erro ao enviar email:", err.message);
    return false;
  }
}

// server/kiwifyWebhook.ts
var SENHA_PADRAO_KIWIFY = "12345678";
function gerarSenhaTemporaria() {
  return SENHA_PADRAO_KIWIFY;
}
function gerarHtmlBoasVindas(dados) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="color:#22c55e;font-size:32px;margin:0;letter-spacing:-1px">CobraPro</h1>
      <p style="color:#64748b;margin:8px 0 0;font-size:14px">Sistema de Gest\xE3o de Cobran\xE7as</p>
    </div>

    <!-- Card principal -->
    <div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155">
      <h2 style="color:#f1f5f9;margin:0 0 8px;font-size:22px">Bem-vindo(a), ${dados.nome}! \u{1F389}</h2>
      <p style="color:#94a3b8;margin:0 0 24px;font-size:15px">
        Sua compra de <strong style="color:#22c55e">${dados.produto}</strong> foi aprovada com sucesso.
        Seu acesso ao CobraPro j\xE1 est\xE1 ativo!
      </p>

      <!-- Credenciais -->
      <div style="background:#0f172a;border-radius:8px;padding:20px;margin-bottom:24px;border:1px solid #22c55e33">
        <p style="color:#64748b;margin:0 0 12px;font-size:12px;text-transform:uppercase;letter-spacing:1px">
          Suas credenciais de acesso
        </p>
        <div style="margin-bottom:12px">
          <span style="color:#64748b;font-size:13px">Login (e-mail)</span><br>
          <span style="color:#f1f5f9;font-size:16px;font-weight:bold">${dados.email}</span>
        </div>
        <div>
          <span style="color:#64748b;font-size:13px">Senha tempor\xE1ria</span><br>
          <span style="color:#22c55e;font-size:20px;font-weight:bold;letter-spacing:2px">${dados.senha}</span>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px">
        <a href="https://cobrapro.online/login"
           style="display:inline-block;background:#22c55e;color:#0f172a;text-decoration:none;
                  padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px">
          Acessar o CobraPro \u2192
        </a>
      </div>

      <!-- Aviso de seguran\xE7a -->
      <div style="background:#fbbf2415;border:1px solid #fbbf2440;border-radius:8px;padding:16px">
        <p style="color:#fbbf24;margin:0;font-size:13px">
          \u{1F512} <strong>Por seguran\xE7a:</strong> recomendamos que voc\xEA altere sua senha ap\xF3s o primeiro acesso.
          Acesse <strong>Configura\xE7\xF5es \u2192 Minha Conta</strong> para trocar.
        </p>
      </div>
    </div>

    <!-- Suporte -->
    <div style="text-align:center;margin-top:24px">
      <p style="color:#475569;font-size:13px;margin:0">
        D\xFAvidas? Entre em contato: <a href="mailto:contato@vitalfinanceira.com" style="color:#22c55e">contato@vitalfinanceira.com</a>
      </p>
      <p style="color:#334155;font-size:11px;margin:8px 0 0">
        Este e-mail foi enviado automaticamente. N\xE3o responda diretamente.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
async function logWebhook(dados) {
  try {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return;
    await supabase.from("kiwify_webhooks").upsert(
      {
        order_id: dados.orderId,
        email: dados.email,
        nome: dados.nome,
        status: dados.status,
        payload: dados.payload,
        user_criado: dados.userCriado ?? null,
        email_enviado: dados.emailEnviado ? 1 : 0,
        erro: dados.erro ?? null
      },
      { onConflict: "order_id" }
    );
  } catch (err) {
    console.error("[Kiwify] Erro ao salvar log:", err);
  }
}
async function processarCompraAprovada(payload) {
  const order = payload.order;
  const orderId = (order?.order_id ?? payload.order_id ?? "").trim();
  const customer = order?.Customer ?? payload.Customer ?? payload.customer ?? {};
  const email = (customer.email ?? "").trim().toLowerCase();
  const nome = (customer.full_name ?? customer.name ?? "Cliente").trim();
  const produto = (order?.Product?.product_name ?? payload.product_title ?? "CobraPro").trim();
  if (!email) {
    console.error("[Kiwify] Compra sem e-mail do cliente:", orderId);
    return;
  }
  console.log(`[Kiwify] Processando compra aprovada | order: ${orderId} | email: ${email}`);
  try {
    const supabase = await getSupabaseClientAsync();
    if (supabase) {
      const { data: existing } = await supabase.from("kiwify_webhooks").select("id, user_criado").eq("order_id", orderId).maybeSingle();
      if (existing) {
        console.log(`[Kiwify] order_id ${orderId} j\xE1 processado anteriormente \u2014 ignorando`);
        return;
      }
    }
  } catch (_) {
  }
  const db = await getDb();
  let userId;
  let senhaGerada = "";
  let erro;
  let emailEnviado = false;
  try {
    let usuarioExistente = null;
    if (db) {
      const result = await db.select().from(users).where(eq3(users.email, email)).limit(1);
      usuarioExistente = result[0] ?? null;
    } else {
      const supabase = await getSupabaseClientAsync();
      if (supabase) {
        const { data } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
        if (data) {
          usuarioExistente = {
            id: data.id,
            openId: data.openId ?? "",
            name: data.name ?? null,
            email: data.email ?? null,
            passwordHash: data.passwordHash ?? null,
            loginMethod: data.loginMethod ?? null,
            role: data.role ?? "user",
            lastSignedIn: data.lastSignedIn ? new Date(data.lastSignedIn) : /* @__PURE__ */ new Date(),
            createdAt: data.createdAt ? new Date(data.createdAt) : /* @__PURE__ */ new Date(),
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : /* @__PURE__ */ new Date(),
            onboardingCompleto: data.onboarding_completo ?? false,
            nomeEmpresa: data.nome_empresa ?? null
          };
        }
      }
    }
    if (usuarioExistente) {
      console.log(`[Kiwify] Usu\xE1rio ${email} j\xE1 existe (id: ${usuarioExistente.id}) \u2014 reenviando acesso`);
      userId = usuarioExistente.id;
      senhaGerada = gerarSenhaTemporaria();
      const novoHash = await bcrypt2.hash(senhaGerada, 12);
      if (db) {
        await db.update(users).set({ passwordHash: novoHash, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(users.id, usuarioExistente.id));
      } else {
        const supabase = await getSupabaseClientAsync();
        if (supabase) {
          await supabase.from("users").update({ passwordHash: novoHash }).eq("id", usuarioExistente.id);
        }
      }
    } else {
      senhaGerada = gerarSenhaTemporaria();
      const passwordHash = await bcrypt2.hash(senhaGerada, 12);
      const openId = `kiwify_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      if (db) {
        await db.insert(users).values({
          openId,
          name: nome,
          email,
          passwordHash,
          loginMethod: "kiwify",
          role: "user",
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        const created = await db.select().from(users).where(eq3(users.email, email)).limit(1);
        userId = created[0]?.id;
      } else {
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new Error("Banco de dados indispon\xEDvel");
        const { data, error: insertError } = await supabase.from("users").insert({
          openId,
          name: nome,
          email,
          passwordHash,
          loginMethod: "kiwify",
          role: "user",
          lastSignedIn: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (insertError) throw new Error(insertError.message);
        userId = data.id;
      }
      console.log(`[Kiwify] Usu\xE1rio criado: ${email} (id: ${userId})`);
    }
    const htmlContent = gerarHtmlBoasVindas({ nome, email, senha: senhaGerada, produto });
    emailEnviado = await enviarEmail({
      to: email,
      toName: nome,
      subject: `\u2705 Seu acesso ao CobraPro est\xE1 pronto!`,
      htmlContent
    });
    if (emailEnviado) {
      console.log(`[Kiwify] E-mail de boas-vindas enviado para ${email}`);
    } else {
      console.error(`[Kiwify] Falha ao enviar e-mail para ${email}`);
      erro = "Usu\xE1rio criado mas e-mail n\xE3o foi enviado";
    }
  } catch (err) {
    erro = err.message;
    console.error(`[Kiwify] Erro ao processar compra ${orderId}:`, erro);
  }
  await logWebhook({
    orderId,
    email,
    nome,
    status: payload.order_status ?? "paid",
    payload,
    userCriado: userId,
    emailEnviado,
    erro
  });
}
function registerKiwifyWebhookRoutes(app) {
  const KIWIFY_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN ?? "";
  app.post("/api/webhook/kiwify", async (req, res) => {
    try {
      const bodySignature = req.body?.signature ?? "";
      console.log("[Kiwify] Webhook recebido | signature:", bodySignature ? "presente" : "ausente");
      const payload = req.body;
      const orderData = payload.order;
      const payloadAny = payload;
      const status = (orderData?.order_status ?? payloadAny.order_status ?? "").toLowerCase();
      const eventType = (payloadAny.event ?? orderData?.webhook_event_type ?? "").toLowerCase();
      const orderId = orderData?.order_id ?? payload.order_id ?? "";
      console.log(`[Kiwify] status: ${status} | event: ${eventType} | order: ${orderId}`);
      res.status(200).json({ received: true });
      const isApproved = status === "paid" || status === "approved" || status === "complete" || eventType === "order_approved" || eventType === "compra_aprovada";
      if (isApproved) {
        await processarCompraAprovada(payload);
      } else {
        console.log(`[Kiwify] Evento ignorado (status: ${status}, event: ${eventType}) | order: ${orderId}`);
      }
    } catch (err) {
      console.error("[Kiwify] Erro no endpoint:", err);
    }
  });
  app.get("/api/webhook/kiwify", (_req, res) => {
    res.json({
      status: "ok",
      service: "CobraPro Kiwify Webhook",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
}

// server/routers.ts
init_const();

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/systemRouter.ts
init_trpc();
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/veiculos.ts
init_trpc();
init_db();
init_schema();
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { eq as eq4, desc, and as and2 } from "drizzle-orm";
var veiculosRouter = router({
  criar: protectedProcedure.input(z2.object({
    clienteId: z2.number(),
    placa: z2.string().min(1),
    marca: z2.string().optional(),
    modelo: z2.string().optional(),
    ano: z2.number().optional(),
    cor: z2.string().optional(),
    renavam: z2.string().optional(),
    chassi: z2.string().optional(),
    observacoes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const result = await db.insert(veiculos).values({ ...input, userId: ctx.user.id }).returning();
    return result[0];
  }),
  listar: protectedProcedure.input(z2.object({ clienteId: z2.number().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const allVeiculos = await db.select().from(veiculos).where(eq4(veiculos.userId, ctx.user.id)).orderBy(desc(veiculos.createdAt));
    if (input?.clienteId) {
      return allVeiculos.filter((v) => v.clienteId === input.clienteId);
    }
    return allVeiculos;
  }),
  deletar: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    await db.delete(parcelasVeiculo).where(eq4(parcelasVeiculo.veiculoId, input.id));
    await db.delete(veiculos).where(and2(eq4(veiculos.id, input.id), eq4(veiculos.userId, ctx.user.id)));
    return { success: true };
  }),
  pagarParcela: protectedProcedure.input(z2.object({
    parcelaId: z2.number(),
    valorPago: z2.number(),
    observacoes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const hoje = /* @__PURE__ */ new Date();
    const result = await db.update(parcelasVeiculo).set({
      status: "paga",
      valorPago: input.valorPago.toString(),
      pagamentoData: hoje.toISOString().split("T")[0],
      observacoes: input.observacoes,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(parcelasVeiculo.id, input.parcelaId)).returning();
    return result[0];
  })
});

// server/routers/assinaturas.ts
init_trpc();
init_db();
import { z as z3 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";
var assinaturasRouter = router({
  // Listar assinaturas com dados do cliente
  list: protectedProcedure.input(z3.object({
    status: z3.enum(["ativa", "cancelada", "suspensa", "inadimplente", "todas"]).optional().default("todas"),
    clienteId: z3.number().optional(),
    busca: z3.string().optional()
  })).query(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel" });
    let query = supabase.from("assinaturas").select("*, clientes!inner(id, nome, whatsapp, telefone)").order("createdAt", { ascending: false }).eq("user_id", ctx.user.id);
    if (input.status !== "todas") {
      query = query.eq("status", input.status);
    }
    if (input.clienteId) {
      query = query.eq("cliente_id", input.clienteId);
    }
    const { data, error } = await query;
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    let result = data || [];
    if (input.busca) {
      const busca = input.busca.toLowerCase();
      result = result.filter(
        (a) => a.servico?.toLowerCase().includes(busca) || a.clientes?.nome?.toLowerCase().includes(busca)
      );
    }
    return result;
  }),
  // KPIs do módulo de assinaturas
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel" });
    const { data: todas, error } = await supabase.from("assinaturas").select("id, status, valor_mensal").eq("user_id", ctx.user.id);
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    const ativas = (todas || []).filter((a) => a.status === "ativa");
    const inadimplentes = (todas || []).filter((a) => a.status === "inadimplente");
    const canceladas = (todas || []).filter((a) => a.status === "cancelada");
    const receitaMensal = ativas.reduce((acc, a) => acc + parseFloat(a.valor_mensal || "0"), 0);
    return {
      total: (todas || []).length,
      ativas: ativas.length,
      inadimplentes: inadimplentes.length,
      canceladas: canceladas.length,
      receitaMensal
    };
  }),
  // Criar nova assinatura
  criar: protectedProcedure.input(z3.object({
    clienteId: z3.number(),
    servico: z3.string().min(1),
    descricao: z3.string().optional(),
    valorMensal: z3.number().positive(),
    diaVencimento: z3.number().min(1).max(31).default(10),
    dataInicio: z3.string(),
    contaCaixaId: z3.number().optional(),
    observacoes: z3.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel" });
    const { data, error } = await supabase.from("assinaturas").insert({
      cliente_id: input.clienteId,
      servico: input.servico,
      descricao: input.descricao || null,
      valor_mensal: input.valorMensal.toFixed(2),
      dia_vencimento: input.diaVencimento,
      status: "ativa",
      data_inicio: input.dataInicio,
      conta_caixa_id: input.contaCaixaId || null,
      observacoes: input.observacoes || null,
      user_id: ctx.user.id
    }).select().single();
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data;
  }),
  // Atualizar assinatura
  atualizar: protectedProcedure.input(z3.object({
    id: z3.number(),
    servico: z3.string().min(1).optional(),
    descricao: z3.string().optional(),
    valorMensal: z3.number().positive().optional(),
    diaVencimento: z3.number().min(1).max(31).optional(),
    status: z3.enum(["ativa", "cancelada", "suspensa", "inadimplente"]).optional(),
    contaCaixaId: z3.number().optional(),
    observacoes: z3.string().optional()
  })).mutation(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel" });
    const updates = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (input.servico !== void 0) updates.servico = input.servico;
    if (input.descricao !== void 0) updates.descricao = input.descricao;
    if (input.valorMensal !== void 0) updates.valor_mensal = input.valorMensal.toFixed(2);
    if (input.diaVencimento !== void 0) updates.dia_vencimento = input.diaVencimento;
    if (input.status !== void 0) {
      updates.status = input.status;
      if (input.status === "cancelada") {
        updates.data_cancelamento = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      }
    }
    if (input.contaCaixaId !== void 0) updates.conta_caixa_id = input.contaCaixaId;
    if (input.observacoes !== void 0) updates.observacoes = input.observacoes;
    const { data, error } = await supabase.from("assinaturas").update(updates).eq("id", input.id).select().single();
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data;
  }),
  // Registrar pagamento de assinatura
  registrarPagamento: protectedProcedure.input(z3.object({
    assinaturaId: z3.number(),
    clienteId: z3.number(),
    valorPago: z3.number().positive(),
    mesReferencia: z3.string().regex(/^\d{4}-\d{2}$/),
    contaCaixaId: z3.number().optional(),
    observacoes: z3.string().optional()
  })).mutation(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel" });
    const { data: pagamento, error: pagErr } = await supabase.from("pagamentos_assinatura").insert({
      assinatura_id: input.assinaturaId,
      cliente_id: input.clienteId,
      valor_pago: input.valorPago.toFixed(2),
      mes_referencia: input.mesReferencia,
      conta_caixa_id: input.contaCaixaId || null,
      observacoes: input.observacoes || null
    }).select().single();
    if (pagErr) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: pagErr.message });
    if (input.contaCaixaId) {
      const { data: assinatura } = await supabase.from("assinaturas").select("servico, clientes!inner(nome)").eq("id", input.assinaturaId).single();
      const clienteNome = assinatura?.clientes?.nome || "Cliente";
      const servico = assinatura?.servico || "Assinatura";
      await supabase.from("transacoes_caixa").insert({
        conta_caixa_id: input.contaCaixaId,
        tipo: "entrada",
        categoria: "outros",
        descricao: `Assinatura ${servico} - ${clienteNome} (${input.mesReferencia})`,
        valor: input.valorPago.toFixed(2),
        data_transacao: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      });
    }
    await supabase.from("assinaturas").update({ status: "ativa", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", input.assinaturaId).eq("status", "inadimplente");
    return pagamento;
  }),
  // Listar pagamentos de uma assinatura
  pagamentos: protectedProcedure.input(z3.object({ assinaturaId: z3.number() })).query(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel" });
    const { data, error } = await supabase.from("pagamentos_assinatura").select("*").eq("assinatura_id", input.assinaturaId).order("data_pagamento", { ascending: false });
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data || [];
  }),
  // Deletar assinatura
  deletar: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel" });
    const { error } = await supabase.from("assinaturas").delete().eq("id", input.id);
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  })
});

// server/routers/backup.ts
init_trpc();
init_db();
import { z as z4 } from "zod";
async function sb() {
  const client = await getSupabaseClientAsync();
  if (!client) throw new Error("Supabase client not available");
  return client;
}
var backupRouter = router({
  exportarClientes: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await (await sb()).from("clientes").select("id, nome, cpf_cnpj, telefone, whatsapp, email, endereco, cidade, estado, cep, chave_pix, tipo_chave_pix, created_at").order("nome").eq("user_id", ctx.user.id);
    if (error) throw error;
    return { dados: data || [], total: (data || []).length };
  }),
  exportarContratos: protectedProcedure.input(z4.object({ modalidade: z4.string().optional() }).optional()).query(async ({ ctx, input }) => {
    let query = (await sb()).from("contratos").select("id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, data_vencimento_primeira, dia_vencimento, multa_atraso, juros_mora_diario, etiquetas, created_at, clientes(nome, cpf_cnpj, telefone, whatsapp)").order("created_at", { ascending: false }).eq("user_id", ctx.user.id);
    if (input?.modalidade && input.modalidade !== "todos") {
      query = query.eq("modalidade", input.modalidade);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { dados: data || [], total: (data || []).length };
  }),
  exportarParcelas: protectedProcedure.input(z4.object({ status: z4.string().optional(), dataInicio: z4.string().optional(), dataFim: z4.string().optional() }).optional()).query(async ({ ctx, input }) => {
    let query = (await sb()).from("parcelas").select("id, contrato_id, numero_parcela, valor, valor_juros, data_vencimento, data_pagamento, status, valor_pago, forma_pagamento, observacoes, created_at, contratos(modalidade, valor_principal, clientes(nome, cpf_cnpj, telefone))").order("data_vencimento", { ascending: false }).eq("user_id", ctx.user.id);
    if (input?.status && input.status !== "todos") {
      query = query.eq("status", input.status);
    }
    if (input?.dataInicio) {
      query = query.gte("data_vencimento", input.dataInicio);
    }
    if (input?.dataFim) {
      query = query.lte("data_vencimento", input.dataFim);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { dados: data || [], total: (data || []).length };
  }),
  exportarVendas: protectedProcedure.query(async ({ ctx }) => {
    const client = await sb();
    const { data: produtos2, error: errProd } = await client.from("vendas").select("id, produto, quantidade, valor_unitario, valor_total, status, forma_pagamento, data_venda, cliente_id, clientes(nome, cpf_cnpj, telefone)").order("data_venda", { ascending: false });
    if (errProd) throw errProd;
    const { data: veiculos2, error: errVeic } = await client.from("veiculos").select("id, marca, modelo, ano, placa, valor_venda, valor_entrada, status, data_venda, cliente_id, clientes(nome, cpf_cnpj, telefone)").order("created_at", { ascending: false });
    if (errVeic) throw errVeic;
    return {
      produtos: produtos2 || [],
      veiculos: veiculos2 || [],
      totalProdutos: (produtos2 || []).length,
      totalVeiculos: (veiculos2 || []).length
    };
  }),
  exportarTransacoes: protectedProcedure.input(z4.object({ dataInicio: z4.string().optional(), dataFim: z4.string().optional() }).optional()).query(async ({ ctx, input }) => {
    let query = (await sb()).from("transacoes_caixa").select("id, conta_caixa_id, tipo, categoria, descricao, valor, data_transacao, created_at, contas_caixa(nome)").order("data_transacao", { ascending: false }).eq("user_id", ctx.user.id);
    if (input?.dataInicio) {
      query = query.gte("data_transacao", input.dataInicio);
    }
    if (input?.dataFim) {
      query = query.lte("data_transacao", input.dataFim);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { dados: data || [], total: (data || []).length };
  })
});

// server/routers/whatsappEvolution.ts
init_trpc();
init_env();
import { z as z5 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";
function getGlobalConfig(userId) {
  return {
    url: ENV.evolutionApiUrl.replace(/\/$/, ""),
    apiKey: ENV.evolutionApiKey,
    instanceName: `user-${userId}`
  };
}
async function evolutionRequest(config, method, path2, body) {
  const fullPath = path2.replace("{instance}", config.instanceName);
  const res = await fetch(`${config.url}${fullPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": config.apiKey
    },
    body: body ? JSON.stringify(body) : void 0
  });
  const text2 = await res.text();
  try {
    return JSON.parse(text2);
  } catch {
    return { raw: text2, status: res.status };
  }
}
var whatsappEvolutionRouter = router({
  // Obter configurações (apenas retorna instanceName para o frontend)
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    return {
      url: config.url,
      instanceName: config.instanceName,
      configured: true
    };
  }),
  // Criar instância na Evolution API
  // Se já está conectado (open), retorna sem recriar.
  // Se está em estado inválido (close/connecting), deleta e recria para garantir QR fresco.
  createInstance: protectedProcedure.mutation(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    const existing = await evolutionRequest(config, "GET", "/instance/connectionState/{instance}");
    if (existing?.instance?.state === "open") {
      return { success: true, alreadyExists: true, state: "open" };
    }
    if (existing?.instance?.state) {
      await evolutionRequest(config, "DELETE", "/instance/delete/{instance}");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const result = await evolutionRequest(config, "POST", "/instance/create", {
      instanceName: config.instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS"
    });
    return result;
  }),
  // Obter QR Code da instância (cria automaticamente se não existir)
  getQRCode: protectedProcedure.query(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    try {
      const status = await evolutionRequest(config, "GET", "/instance/connectionState/{instance}");
      if (status?.instance?.state === "open") {
        return { connected: true, qrcode: null, state: "open", instanceName: config.instanceName };
      }
      if (!status?.instance?.state || status?.status === 404 || status?.error) {
        await evolutionRequest(config, "POST", "/instance/create", {
          instanceName: config.instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        });
        await new Promise((resolve) => setTimeout(resolve, 2e3));
      }
      const qrResult = await evolutionRequest(config, "GET", "/instance/connect/{instance}");
      return {
        connected: false,
        qrcode: qrResult?.base64 || qrResult?.qrcode?.base64 || null,
        state: status?.instance?.state || "disconnected",
        instanceName: config.instanceName
      };
    } catch (e) {
      return { connected: false, qrcode: null, error: String(e), state: "error" };
    }
  }),
  // Verificar status da conexão
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    try {
      const status = await evolutionRequest(config, "GET", "/instance/connectionState/{instance}");
      return {
        connected: status?.instance?.state === "open",
        configured: true,
        state: status?.instance?.state || "disconnected",
        instanceName: config.instanceName
      };
    } catch {
      return { connected: false, configured: true, state: "error" };
    }
  }),
  // Desconectar instância
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    const result = await evolutionRequest(config, "DELETE", "/instance/logout/{instance}");
    return result;
  }),
  // Deletar instância
  deleteInstance: protectedProcedure.mutation(async ({ ctx }) => {
    const config = getGlobalConfig(ctx.user.id);
    const result = await evolutionRequest(config, "DELETE", "/instance/delete/{instance}");
    return result;
  }),
  // Enviar mensagem de texto via Evolution API
  sendMessage: protectedProcedure.input(z5.object({
    phone: z5.string(),
    message: z5.string()
  })).mutation(async ({ ctx, input }) => {
    const config = getGlobalConfig(ctx.user.id);
    let phone = input.phone.replace(/\D/g, "");
    if (!phone.startsWith("55")) phone = "55" + phone;
    if (!phone.endsWith("@s.whatsapp.net")) phone = phone + "@s.whatsapp.net";
    const result = await evolutionRequest(config, "POST", "/message/sendText/{instance}", {
      number: phone,
      textMessage: { text: input.message }
    });
    if (result?.error || result?.status === 400) {
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: result?.message || "Erro ao enviar mensagem" });
    }
    return { success: true, result };
  }),
  // Verificar se um número está no WhatsApp
  checkNumber: protectedProcedure.input(z5.object({ phone: z5.string() })).query(async ({ ctx, input }) => {
    const config = getGlobalConfig(ctx.user.id);
    let phone = input.phone.replace(/\D/g, "");
    if (!phone.startsWith("55")) phone = "55" + phone;
    try {
      const result = await evolutionRequest(config, "POST", "/chat/whatsappNumbers/{instance}", {
        numbers: [phone]
      });
      const numberInfo = Array.isArray(result) ? result[0] : result;
      return { exists: numberInfo?.exists || false, jid: numberInfo?.jid };
    } catch {
      return { exists: false };
    }
  })
});

// server/routers/perfil.ts
init_trpc();
init_db();
import { z as z6 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
import bcrypt3 from "bcryptjs";
var perfilRouter = router({
  // Dados completos do perfil: user + configurações + estatísticas
  get: protectedProcedure.query(async ({ ctx }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: cfgRows } = await sb2.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id);
    const cfg = {};
    (cfgRows ?? []).forEach((r) => {
      cfg[r.chave] = r.valor ?? "";
    });
    const get = (camel, snake, fallback = "") => cfg[camel] ?? cfg[snake] ?? fallback;
    const { data: clientesData } = await sb2.from("clientes").select("id", { count: "exact" }).eq("user_id", ctx.user.id);
    const totalClientes = clientesData?.length ?? 0;
    const { data: contratosData } = await sb2.from("contratos").select("valor_principal").eq("user_id", ctx.user.id);
    const totalEmprestado = (contratosData ?? []).reduce((sum, c) => sum + parseFloat(c.valor_principal ?? "0"), 0);
    const { data: parcelasData } = await sb2.from("parcelas").select("valor_pago").eq("status", "paga").eq("user_id", ctx.user.id);
    const totalRecebido = (parcelasData ?? []).reduce((sum, p) => sum + parseFloat(p.valor_pago ?? "0"), 0);
    const assinaturaPlano = get("assinaturaPlano", "assinatura_plano", "Mensal");
    const assinaturaValidade = get("assinaturaValidade", "assinatura_validade", "");
    const assinaturaInicio = get("assinaturaInicio", "assinatura_inicio", ctx.user.createdAt?.toString() ?? "");
    let diasRestantes = 0;
    if (assinaturaValidade) {
      const validade = new Date(assinaturaValidade);
      const hoje = /* @__PURE__ */ new Date();
      diasRestantes = Math.max(0, Math.ceil((validade.getTime() - hoje.getTime()) / (1e3 * 60 * 60 * 24)));
    }
    return {
      // Dados do usuário
      id: ctx.user.id,
      nome: ctx.user.name,
      email: ctx.user.email,
      criadoEm: ctx.user.createdAt,
      role: ctx.user.role,
      // Dados da empresa (configurações)
      nomeEmpresa: get("nomeEmpresa", "nome_empresa"),
      whatsappEmpresa: get("whatsappEmpresa", "whatsapp_empresa"),
      cnpjEmpresa: get("cnpjEmpresa", "cnpj_empresa"),
      enderecoEmpresa: get("enderecoEmpresa", "endereco_empresa"),
      logoUrl: get("logoUrl", "logo_url"),
      pixKey: get("pixKey", "pix_key"),
      tipoPix: get("tipoPix", "tipo_pix", "cpf"),
      nomeCobranca: get("nomeCobranca", "nome_cobranca"),
      linkPagamento: get("linkPagamento", "link_pagamento"),
      // Estatísticas
      totalClientes,
      totalEmprestado,
      totalRecebido,
      // Assinatura
      assinaturaPlano,
      assinaturaValidade,
      assinaturaInicio,
      diasRestantes
    };
  }),
  // Atualizar dados da empresa no perfil
  update: protectedProcedure.input(z6.object({
    nomeEmpresa: z6.string().optional(),
    whatsappEmpresa: z6.string().optional(),
    cnpjEmpresa: z6.string().optional(),
    enderecoEmpresa: z6.string().optional(),
    nomeCobranca: z6.string().optional(),
    linkPagamento: z6.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const entries = Object.entries(input).filter(([, v]) => v !== void 0);
    for (const [chave, valor] of entries) {
      await sb2.from("configuracoes").upsert({ chave, valor: String(valor), user_id: ctx.user.id }, { onConflict: "chave,user_id" });
    }
    return { success: true };
  }),
  // Salvar chave PIX
  salvarPix: protectedProcedure.input(z6.object({
    pixKey: z6.string().min(1),
    tipoPix: z6.string().default("cpf")
  })).mutation(async ({ ctx, input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await sb2.from("configuracoes").upsert({ chave: "pixKey", valor: input.pixKey, user_id: ctx.user.id }, { onConflict: "chave,user_id" });
    await sb2.from("configuracoes").upsert({ chave: "tipoPix", valor: input.tipoPix, user_id: ctx.user.id }, { onConflict: "chave,user_id" });
    return { success: true };
  }),
  // Upload de logo da empresa
  uploadLogo: protectedProcedure.input(z6.object({
    base64: z6.string(),
    mimeType: z6.string().default("image/png")
  })).mutation(async ({ ctx, input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const ext = input.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const fileKey = `${ctx.user.id}-logo-${Date.now()}.${ext}`;
    const sbAdmin = await getSupabaseClientAsync();
    if (!sbAdmin) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Storage unavailable" });
    const { error: uploadError } = await sbAdmin.storage.from("logos").upload(fileKey, buffer, {
      contentType: input.mimeType,
      upsert: true
    });
    if (uploadError) {
      throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao fazer upload: ${uploadError.message}` });
    }
    const { data: publicData } = sbAdmin.storage.from("logos").getPublicUrl(fileKey);
    const url = publicData.publicUrl;
    await sb2.from("configuracoes").upsert({ chave: "logoUrl", valor: url, user_id: ctx.user.id }, { onConflict: "chave,user_id" });
    return { url };
  }),
  // Remover logo
  removerLogo: protectedProcedure.mutation(async ({ ctx }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await sb2.from("configuracoes").upsert({ chave: "logoUrl", valor: "", user_id: ctx.user.id }, { onConflict: "chave,user_id" });
    return { success: true };
  }),
  // Alterar senha
  alterarSenha: protectedProcedure.input(z6.object({
    novaSenha: z6.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmarSenha: z6.string().min(6)
  })).mutation(async ({ ctx, input }) => {
    if (input.novaSenha !== input.confirmarSenha) {
      throw new TRPCError6({ code: "BAD_REQUEST", message: "As senhas n\xE3o coincidem" });
    }
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const hash = await bcrypt3.hash(input.novaSenha, 12);
    const { error } = await sb2.from("users").update({ passwordHash: hash }).eq("id", ctx.user.id);
    if (error) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao alterar senha" });
    return { success: true };
  })
});

// server/routers/relatorioDiario.ts
init_trpc();
init_db();
init_env();
import { z as z7 } from "zod";
import { TRPCError as TRPCError7 } from "@trpc/server";
function getEvolutionConfig(userId) {
  return {
    url: ENV.evolutionApiUrl.replace(/\/$/, ""),
    apiKey: ENV.evolutionApiKey,
    instanceName: `user-${userId}`
  };
}
async function sendWhatsAppMessage(phone, text2, userId) {
  const config = getEvolutionConfig(userId);
  let p = phone.replace(/\D/g, "");
  if (!p.startsWith("55")) p = "55" + p;
  const res = await fetch(`${config.url}/message/sendText/${config.instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.apiKey },
    body: JSON.stringify({ number: p + "@s.whatsapp.net", textMessage: { text: text2 } })
  });
  return res.ok;
}
async function gerarMensagemRelatorio(userId) {
  const sb2 = await getSupabaseClientAsync();
  if (!sb2) return "";
  const hoje = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const { data: cfgData } = await sb2.from("configuracoes").select("chave, valor").eq("user_id", userId);
  const cfg = {};
  (cfgData || []).forEach((r) => {
    cfg[r.chave] = r.valor;
  });
  const nomeEmpresa = cfg["nomeEmpresa"] || cfg["assinaturaWhatsapp"] || "CobraPro";
  const { data: vencendoHoje } = await sb2.from("parcelas").select("id, valor, status, contratos(clientes(nome, telefone))").eq("data_vencimento", hoje).eq("user_id", userId).neq("status", "paga");
  const { data: emAtraso } = await sb2.from("parcelas").select("id, valor, data_vencimento, contratos(clientes(nome, telefone))").eq("status", "atrasada").eq("user_id", userId).order("data_vencimento", { ascending: true });
  const { data: contratosAtivos } = await sb2.from("contratos").select("id, valor_principal, status").eq("status", "ativo").eq("user_id", userId);
  const { data: clientesAtivos } = await sb2.from("clientes").select("id").eq("status", "ativo").eq("user_id", userId);
  const capitalNaRua = (contratosAtivos || []).reduce(
    (s, c) => s + parseFloat(c.valor_principal || "0"),
    0
  );
  const totalVencendoHoje = (vencendoHoje || []).reduce(
    (s, p) => s + parseFloat(p.valor || "0"),
    0
  );
  const totalEmAtraso = (emAtraso || []).reduce(
    (s, p) => s + parseFloat(p.valor || "0"),
    0
  );
  const dataObj = /* @__PURE__ */ new Date();
  const diasSemana = ["Domingo", "Segunda-feira", "Ter\xE7a-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "S\xE1bado"];
  const diaSemana = diasSemana[dataObj.getDay()];
  const dataFormatada = `${String(dataObj.getDate()).padStart(2, "0")}/${String(dataObj.getMonth() + 1).padStart(2, "0")}/${dataObj.getFullYear()}`;
  const fmt = (v) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const qtdVence = (vencendoHoje || []).length;
  const qtdAtraso = (emAtraso || []).length;
  let msg = `\u{1F4CA} *RELAT\xD3RIO COBRAPRO*
`;
  msg += `\u{1F5D3} ${dataFormatada} \u2022 ${diaSemana}
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
  msg += `\u{1F4B0} *RESUMO DO DIA*
`;
  msg += `\u25B8 A cobrar hoje: *${fmt(totalVencendoHoje)}* (${qtdVence} parcela${qtdVence !== 1 ? "s" : ""})
`;
  msg += `\u25B8 Total em atraso: *${fmt(totalEmAtraso)}* (${qtdAtraso} parcela${qtdAtraso !== 1 ? "s" : ""})
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
  if (qtdVence > 0) {
    msg += `\u23F0 *VENCE HOJE \u2014 ${fmt(totalVencendoHoje)}*
`;
    const grupos = {};
    (vencendoHoje || []).forEach((p) => {
      const nome = p.contratos?.clientes?.nome || "Cliente";
      if (!grupos[nome]) grupos[nome] = [];
      grupos[nome].push({ valor: parseFloat(p.valor || "0"), tipo: "Parcela" });
    });
    Object.entries(grupos).forEach(([nome, parcelas2]) => {
      parcelas2.forEach(({ valor }) => {
        msg += `  \u2022 ${nome} \u2014 ${fmt(valor)}
`;
        msg += `    \u2514 Mensal
`;
      });
    });
    msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
  }
  if (qtdAtraso > 0) {
    msg += `\u{1F534} *EM ATRASO \u2014 ${fmt(totalEmAtraso)}*
`;
    (emAtraso || []).slice(0, 8).forEach((p) => {
      const nome = p.contratos?.clientes?.nome || "Cliente";
      const venc = (/* @__PURE__ */ new Date(p.data_vencimento + "T00:00:00")).toLocaleDateString("pt-BR");
      msg += `  \u2022 ${nome} \u2014 ${fmt(parseFloat(p.valor || "0"))}
`;
      msg += `    \u2514 Venceu ${venc}
`;
    });
    if (qtdAtraso > 8) msg += `  ... e mais ${qtdAtraso - 8} em atraso
`;
    msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
  }
  msg += `\u{1F4C8} *SUA CARTEIRA*
`;
  msg += `\u25B8 Clientes ativos: ${(clientesAtivos || []).length}
`;
  msg += `\u25B8 Empr\xE9stimos ativos: ${(contratosAtivos || []).length}
`;
  msg += `\u25B8 Capital na rua: *${fmt(capitalNaRua)}*
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `_${nomeEmpresa}_`;
  return msg;
}
var relatorioDiarioRouter = router({
  // Obter configurações do relatório diário
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) return { ativo: false, horario: "08:00", telefone: "" };
    const { data } = await sb2.from("configuracoes").select("chave, valor").in("chave", [
      "relatorio_diario_ativo",
      "relatorio_diario_horario",
      "relatorio_diario_telefone"
    ]).eq("user_id", ctx.user.id);
    const cfg = {};
    (data || []).forEach((r) => {
      cfg[r.chave] = r.valor;
    });
    return {
      ativo: cfg["relatorio_diario_ativo"] === "true",
      horario: cfg["relatorio_diario_horario"] || "08:00",
      telefone: cfg["relatorio_diario_telefone"] || ""
    };
  }),
  // Salvar configurações do relatório diário
  saveConfig: protectedProcedure.input(z7.object({
    ativo: z7.boolean(),
    horario: z7.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
    telefone: z7.string()
  })).mutation(async ({ ctx, input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await sb2.from("configuracoes").upsert([
      { chave: "relatorio_diario_ativo", valor: String(input.ativo), user_id: ctx.user.id },
      { chave: "relatorio_diario_horario", valor: input.horario, user_id: ctx.user.id },
      { chave: "relatorio_diario_telefone", valor: input.telefone, user_id: ctx.user.id }
    ], { onConflict: "chave,user_id" });
    return { success: true };
  }),
  // Enviar relatório agora (manual)
  enviarAgora: protectedProcedure.input(z7.object({ telefone: z7.string().optional() }).optional()).mutation(async ({ ctx, input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: cfgData } = await sb2.from("configuracoes").select("chave, valor").in("chave", [
      "evolution_url",
      "evolution_api_key",
      "evolution_instance",
      "relatorio_diario_telefone"
    ]).eq("user_id", ctx.user.id);
    const cfg = {};
    (cfgData || []).forEach((r) => {
      cfg[r.chave] = r.valor;
    });
    const telefone = input?.telefone || cfg["relatorio_diario_telefone"] || "";
    if (!telefone) {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "Configure o n\xFAmero de telefone para receber o relat\xF3rio" });
    }
    const mensagem = await gerarMensagemRelatorio(ctx.user.id);
    if (!mensagem) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao gerar relat\xF3rio" });
    const enviado = await sendWhatsAppMessage(telefone, mensagem, ctx.user.id);
    if (!enviado) {
      throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao enviar mensagem. Verifique se o WhatsApp est\xE1 conectado." });
    }
    return { success: true, mensagem };
  }),
  // Preview da mensagem (sem enviar)
  preview: protectedProcedure.query(async ({ ctx }) => {
    const mensagem = await gerarMensagemRelatorio(ctx.user.id);
    return { mensagem };
  })
});

// server/routers.ts
init_notificacoes();
init_trpc();
init_db();
init_schema();
import { z as z9 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";
import { eq as eq5, and as and3, sql as sql3, desc as desc2, gte, lt, inArray, ne } from "drizzle-orm";
import { nanoid } from "nanoid";

// shared/finance.ts
function calcularJurosMora(valorOriginal, dataVencimento, dataPagamento, jurosMoraDiario = 0.033, multaAtraso = 2) {
  const hoje = dataPagamento;
  const venc = new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1e3 * 60 * 60 * 24)));
  if (diasAtraso === 0) {
    return { juros: 0, multa: 0, total: valorOriginal, diasAtraso: 0 };
  }
  const multa = valorOriginal * (multaAtraso / 100);
  const juros = valorOriginal * (jurosMoraDiario / 100) * diasAtraso;
  const total = valorOriginal + multa + juros;
  return {
    juros: Math.round(juros * 100) / 100,
    multa: Math.round(multa * 100) / 100,
    total: Math.round(total * 100) / 100,
    diasAtraso
  };
}
function calcularParcelasPrice(principal, taxaMensal, numParcelas) {
  if (taxaMensal === 0) return principal / numParcelas;
  const i = taxaMensal / 100;
  const parcela = principal * (i * Math.pow(1 + i, numParcelas)) / (Math.pow(1 + i, numParcelas) - 1);
  return Math.round(parcela * 100) / 100;
}
function calcularParcelaPadrao(principal, taxaMensal, numParcelas) {
  const jurosTotal = principal * (taxaMensal / 100) * numParcelas;
  return Math.round((principal + jurosTotal) / numParcelas * 100) / 100;
}
function getDiasModalidade(modalidade) {
  switch (modalidade) {
    case "diario":
      return 1;
    case "semanal":
      return 7;
    case "quinzenal":
      return 15;
    case "mensal":
      return 30;
    default:
      return 30;
  }
}

// server/routers.ts
var dashboardRouter = router({
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const supabase = await getSupabaseClientAsync();
    if (db) {
      const hoje2 = /* @__PURE__ */ new Date();
      hoje2.setHours(0, 0, 0, 0);
      const hojeStr2 = hoje2.toISOString().split("T")[0];
      const contas = await db.select().from(contasCaixa).where(and3(eq5(contasCaixa.ativa, true), eq5(contasCaixa.userId, ctx.user.id)));
      let saldoTotal2 = 0;
      for (const conta of contas) {
        const entradas = await db.select({ total: sql3`COALESCE(SUM(valor), 0)` }).from(transacoesCaixa).where(and3(eq5(transacoesCaixa.contaCaixaId, conta.id), eq5(transacoesCaixa.tipo, "entrada")));
        const saidas = await db.select({ total: sql3`COALESCE(SUM(valor), 0)` }).from(transacoesCaixa).where(and3(eq5(transacoesCaixa.contaCaixaId, conta.id), eq5(transacoesCaixa.tipo, "saida")));
        saldoTotal2 += parseFloat(conta.saldoInicial) + parseFloat(entradas[0]?.total ?? "0") - parseFloat(saidas[0]?.total ?? "0");
      }
      const capitalResult = await db.select({ total: sql3`COALESCE(SUM(valor_principal), 0)` }).from(contratos).where(and3(eq5(contratos.status, "ativo"), eq5(contratos.userId, ctx.user.id)));
      const capitalCirculacao2 = parseFloat(capitalResult[0]?.total ?? "0");
      const receberResult = await db.select({ total: sql3`COALESCE(SUM(valor_original), 0)` }).from(parcelas).where(and3(inArray(parcelas.status, ["pendente", "atrasada", "vencendo_hoje", "parcial"]), eq5(parcelas.userId, ctx.user.id)));
      const totalReceber2 = parseFloat(receberResult[0]?.total ?? "0");
      const inadResult = await db.select({ total: sql3`COALESCE(SUM(valor_original), 0)`, qtd: sql3`COUNT(DISTINCT cliente_id)` }).from(parcelas).where(and3(eq5(parcelas.status, "atrasada"), eq5(parcelas.userId, ctx.user.id)));
      const totalInadimplente2 = parseFloat(inadResult[0]?.total ?? "0");
      const qtdInadimplentes2 = inadResult[0]?.qtd ?? 0;
      const jurosResult = await db.select({ total: sql3`COALESCE(SUM(valor_juros), 0)` }).from(parcelas).where(and3(inArray(parcelas.status, ["atrasada", "parcial"]), eq5(parcelas.userId, ctx.user.id)));
      const jurosPendentes2 = parseFloat(jurosResult[0]?.total ?? "0");
      const hojeResult = await db.select({ total: sql3`COALESCE(SUM(valor_original), 0)`, qtd: sql3`COUNT(*)` }).from(parcelas).where(and3(
        eq5(sql3`DATE(data_vencimento)`, hojeStr2),
        inArray(parcelas.status, ["pendente", "vencendo_hoje"]),
        eq5(parcelas.userId, ctx.user.id)
      ));
      const qtdVenceHoje2 = hojeResult[0]?.qtd ?? 0;
      const valorVenceHoje2 = parseFloat(hojeResult[0]?.total ?? "0");
      const recebidoResult = await db.select({ total: sql3`COALESCE(SUM(valor), 0)` }).from(transacoesCaixa).where(and3(
        eq5(transacoesCaixa.tipo, "entrada"),
        eq5(transacoesCaixa.categoria, "pagamento_parcela"),
        gte(transacoesCaixa.dataTransacao, hoje2),
        eq5(transacoesCaixa.userId, ctx.user.id)
      ));
      const recebidoHoje2 = parseFloat(recebidoResult[0]?.total ?? "0");
      const contratosResult = await db.select({ qtd: sql3`COUNT(*)` }).from(contratos).where(and3(eq5(contratos.status, "ativo"), eq5(contratos.userId, ctx.user.id)));
      const contratosAtivos2 = contratosResult[0]?.qtd ?? 0;
      return {
        saldoTotal: saldoTotal2,
        capitalCirculacao: capitalCirculacao2,
        totalReceber: totalReceber2,
        totalInadimplente: totalInadimplente2,
        qtdInadimplentes: qtdInadimplentes2,
        jurosPendentes: jurosPendentes2,
        qtdVenceHoje: qtdVenceHoje2,
        valorVenceHoje: valorVenceHoje2,
        recebidoHoje: recebidoHoje2,
        contratosAtivos: contratosAtivos2
      };
    }
    if (!supabase) return { saldoTotal: 0, capitalCirculacao: 0, totalReceber: 0, totalInadimplente: 0, qtdInadimplentes: 0, jurosPendentes: 0, qtdVenceHoje: 0, valorVenceHoje: 0, recebidoHoje: 0, contratosAtivos: 0 };
    const hoje = /* @__PURE__ */ new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split("T")[0];
    const userId = ctx.user.id;
    const [contasRes, contratosRes, parcelasRes, transRes] = await Promise.all([
      supabase.from("contas_caixa").select("id, saldo, ativo").eq("ativo", true).eq("user_id", userId),
      supabase.from("contratos").select("valor_principal").eq("status", "ativo").eq("user_id", userId),
      supabase.from("parcelas").select("valor_original, valor_juros, status, data_vencimento, numero_parcela, cliente_id").eq("user_id", userId),
      supabase.from("transacoes_caixa").select("conta_caixa_id, valor, tipo, categoria, data_transacao").eq("user_id", userId)
    ]);
    let saldoTotal = 0;
    if (contasRes.data) {
      for (const conta of contasRes.data) {
        const transacoesConta = (transRes.data ?? []).filter((t2) => t2.conta_caixa_id === conta.id);
        const totalEntradas = transacoesConta.filter((t2) => t2.tipo === "entrada").reduce((s, t2) => s + parseFloat(t2.valor ?? "0"), 0);
        const totalSaidas = transacoesConta.filter((t2) => t2.tipo === "saida").reduce((s, t2) => s + parseFloat(t2.valor ?? "0"), 0);
        saldoTotal += parseFloat(conta.saldo ?? "0") + totalEntradas - totalSaidas;
      }
    }
    const capitalCirculacao = (contratosRes.data ?? []).reduce((s, c) => s + parseFloat(c.valor_principal ?? "0"), 0);
    const parcelasData = parcelasRes.data ?? [];
    const totalReceber = parcelasData.filter((p) => ["pendente", "atrasada", "vencendo_hoje", "parcial"].includes(p.status)).reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0);
    const atrasadas = parcelasData.filter((p) => p.status === "atrasada");
    const totalInadimplente = atrasadas.reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0);
    const qtdInadimplentes = new Set(atrasadas.map((p) => p.cliente_id)).size;
    const jurosPendentes = parcelasData.filter((p) => ["atrasada", "parcial"].includes(p.status)).reduce((s, p) => s + parseFloat(p.valor_juros ?? "0"), 0);
    const venceHoje = parcelasData.filter((p) => p.data_vencimento?.startsWith(hojeStr) && ["pendente", "vencendo_hoje"].includes(p.status));
    const qtdVenceHoje = venceHoje.length;
    const valorVenceHoje = venceHoje.reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0);
    const transacoes = transRes.data ?? [];
    const recebidoHoje = transacoes.filter((t2) => t2.tipo === "entrada" && t2.categoria === "pagamento_parcela" && t2.data_transacao?.startsWith(hojeStr)).reduce((s, t2) => s + parseFloat(t2.valor ?? "0"), 0);
    const contratosAtivos = (contratosRes.data ?? []).length;
    return {
      saldoTotal,
      capitalCirculacao,
      totalReceber,
      totalInadimplente,
      qtdInadimplentes,
      jurosPendentes,
      qtdVenceHoje,
      valorVenceHoje,
      recebidoHoje,
      contratosAtivos
    };
  }),
  parcelasHoje: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        const hoje2 = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const rows = await db.select({
          id: parcelas.id,
          clienteId: parcelas.clienteId,
          clienteNome: clientes.nome,
          numeroParcela: parcelas.numeroParcela,
          valorOriginal: parcelas.valorOriginal,
          dataVencimento: parcelas.dataVencimento,
          status: parcelas.status,
          totalParcelas: sql3`(SELECT COUNT(*) FROM parcelas p2 WHERE p2.contrato_id = ${parcelas.contratoId})`
        }).from(parcelas).innerJoin(clientes, eq5(parcelas.clienteId, clientes.id)).where(and3(eq5(sql3`DATE(${parcelas.dataVencimento})`, hoje2), inArray(parcelas.status, ["pendente", "vencendo_hoje"]), eq5(parcelas.userId, ctx.user.id))).orderBy(parcelas.dataVencimento).limit(20);
        return rows;
      } catch (err) {
        console.warn("[dashboard.parcelasHoje] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const hoje = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { data } = await supabase.from("parcelas").select("*, clientes(nome)").eq("data_vencimento", hoje).in("status", ["pendente", "vencendo_hoje"]).eq("user_id", ctx.user.id).order("data_vencimento").limit(20);
    return (data ?? []).map((r) => ({ id: r.id, clienteId: r.cliente_id, clienteNome: r.clientes?.nome ?? "", numeroParcela: r.numero, valorOriginal: r.valor_original, dataVencimento: r.data_vencimento, status: r.status, totalParcelas: 0 }));
  }),
  parcelasAtrasadas: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select({
          id: parcelas.id,
          clienteId: parcelas.clienteId,
          clienteNome: clientes.nome,
          numeroParcela: parcelas.numeroParcela,
          valorOriginal: parcelas.valorOriginal,
          dataVencimento: parcelas.dataVencimento,
          status: parcelas.status
        }).from(parcelas).innerJoin(clientes, eq5(parcelas.clienteId, clientes.id)).where(and3(eq5(parcelas.status, "atrasada"), eq5(parcelas.userId, ctx.user.id))).orderBy(parcelas.dataVencimento).limit(20);
        return rows.map((r) => {
          const { total, diasAtraso } = calcularJurosMora(parseFloat(r.valorOriginal), /* @__PURE__ */ new Date(r.dataVencimento + "T00:00:00"), /* @__PURE__ */ new Date());
          return { ...r, valorAtualizado: total, diasAtraso };
        });
      } catch (err) {
        console.warn("[dashboard.parcelasAtrasadas] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from("parcelas").select("*, clientes(nome)").eq("status", "atrasada").eq("user_id", ctx.user.id).order("data_vencimento").limit(20);
    return (data ?? []).map((r) => {
      const { total, diasAtraso } = calcularJurosMora(parseFloat(r.valor_original), /* @__PURE__ */ new Date(r.data_vencimento + "T00:00:00"), /* @__PURE__ */ new Date());
      return { id: r.id, clienteId: r.cliente_id, clienteNome: r.clientes?.nome ?? "", numeroParcela: r.numero, valorOriginal: r.valor_original, dataVencimento: r.data_vencimento, status: r.status, valorAtualizado: total, diasAtraso };
    });
  }),
  scoreNegocio: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { score: 0, taxaRecebimento: 0, inadimplencia: 0, totalRecebido: 0, emAtraso: 0 };
    const userId = ctx.user.id;
    const { data: all } = await supabase.from("parcelas").select("valor_original, status").eq("user_id", userId);
    const pagas = (all ?? []).filter((p) => p.status === "paga");
    const atrasadasP = (all ?? []).filter((p) => p.status === "atrasada");
    const totalRecebido = pagas.reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0);
    const emAtraso = atrasadasP.reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0);
    const totalGeral = (all ?? []).reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0);
    const taxaRecebimento = totalGeral > 0 ? totalRecebido / totalGeral * 100 : 0;
    const inadimplencia = totalGeral > 0 ? emAtraso / totalGeral * 100 : 0;
    const score = Math.max(0, Math.min(100, Math.round(taxaRecebimento - inadimplencia * 0.5)));
    return { score, taxaRecebimento, inadimplencia, totalRecebido, emAtraso };
  }),
  precisaAtencao: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { venceSemana: { qtd: 0, valor: 0 }, atrasados30: { qtd: 0, valor: 0 } };
    const userId = ctx.user.id;
    const hoje = /* @__PURE__ */ new Date();
    const em7Dias = new Date(hoje);
    em7Dias.setDate(hoje.getDate() + 7);
    const ha30Dias = new Date(hoje);
    ha30Dias.setDate(hoje.getDate() - 30);
    const hojeStr = hoje.toISOString().split("T")[0];
    const em7Str = em7Dias.toISOString().split("T")[0];
    const ha30Str = ha30Dias.toISOString().split("T")[0];
    const [semanaRes, atrasadosRes] = await Promise.all([
      supabase.from("parcelas").select("valor_original, cliente_id").eq("user_id", userId).in("status", ["pendente", "vencendo_hoje"]).gte("data_vencimento", hojeStr).lte("data_vencimento", em7Str),
      supabase.from("parcelas").select("valor_original, cliente_id").eq("user_id", userId).eq("status", "atrasada").lte("data_vencimento", ha30Str)
    ]);
    const semana = semanaRes.data ?? [];
    const atrasados = atrasadosRes.data ?? [];
    return {
      venceSemana: { qtd: semana.length, valor: semana.reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0) },
      atrasados30: { qtd: new Set(atrasados.map((p) => p.cliente_id)).size, valor: atrasados.reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0) }
    };
  }),
  tendenciaJuros: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const userId = ctx.user.id;
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = /* @__PURE__ */ new Date();
      d.setMonth(d.getMonth() - i);
      const ano = d.getFullYear();
      const mes = d.getMonth() + 1;
      const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fim = new Date(ano, mes, 0).toISOString().split("T")[0];
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      const { data } = await supabase.from("transacoes_caixa").select("valor").eq("user_id", userId).eq("tipo", "entrada").eq("categoria", "pagamento_parcela").gte("data_transacao", inicio + "T00:00:00").lte("data_transacao", fim + "T23:59:59");
      const total = (data ?? []).reduce((s, r) => s + parseFloat(r.valor ?? "0"), 0);
      meses.push({ mes: label, valor: total });
    }
    return meses;
  }),
  fluxoMensal: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        const dias2 = [];
        for (let i = 6; i >= 0; i--) {
          const now = /* @__PURE__ */ new Date();
          now.setDate(now.getDate() - i);
          const dStr = now.toISOString().split("T")[0];
          const diaLabel = `${dStr.slice(8, 10)}/${dStr.slice(5, 7)}`;
          const result = await db.select({ total: sql3`COALESCE(SUM(valor), 0)` }).from(transacoesCaixa).where(and3(eq5(transacoesCaixa.tipo, "entrada"), eq5(sql3`DATE(data_transacao)`, dStr), eq5(transacoesCaixa.userId, ctx.user.id)));
          dias2.push({ dia: diaLabel, valor: parseFloat(result[0]?.total ?? "0") });
        }
        return dias2;
      } catch (err) {
        console.warn("[dashboard.fluxoMensal] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const now = /* @__PURE__ */ new Date();
      now.setDate(now.getDate() - i);
      const dStr = now.toISOString().split("T")[0];
      const diaLabel = `${dStr.slice(8, 10)}/${dStr.slice(5, 7)}`;
      const { data } = await supabase.from("transacoes_caixa").select("valor").eq("tipo", "entrada").eq("user_id", ctx.user.id).gte("data_transacao", dStr + "T00:00:00").lte("data_transacao", dStr + "T23:59:59");
      const total = (data ?? []).reduce((s, r) => s + parseFloat(r.valor ?? "0"), 0);
      dias.push({ dia: diaLabel, valor: total });
    }
    return dias;
  })
});
var clientesRouter = router({
  list: protectedProcedure.input(z9.object({ busca: z9.string().optional(), ativo: z9.boolean().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    let rows;
    if (db) {
      try {
        rows = await db.select().from(clientes).where(and3(eq5(clientes.userId, ctx.user.id), input?.ativo !== void 0 ? eq5(clientes.ativo, input.ativo) : void 0)).orderBy(desc2(clientes.createdAt));
      } catch (err) {
        console.warn("[clientes.list] Drizzle failed, trying REST:", err.message);
        resetDb();
        rows = [];
      }
    } else {
      rows = [];
    }
    if (rows.length === 0) {
      const supabase = await getSupabaseClientAsync();
      if (supabase) {
        let query = supabase.from("clientes").select("*").order("createdAt", { ascending: false }).eq("user_id", ctx.user.id);
        if (input?.ativo !== void 0) query = query.eq("ativo", input.ativo);
        const { data, error } = await query;
        if (!error && data) rows = data;
      }
    }
    if (input?.busca) {
      const b = input.busca.toLowerCase();
      rows = rows.filter(
        (c) => (c.nome ?? "").toLowerCase().includes(b) || (c.cpfCnpj ?? c.cpf_cnpj ?? "").includes(b) || (c.telefone ?? "").includes(b)
      );
    }
    return { clientes: rows, total: rows.length };
  }),
  byId: protectedProcedure.input(z9.object({ id: z9.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select().from(clientes).where(and3(eq5(clientes.id, input.id), eq5(clientes.userId, ctx.user.id))).limit(1);
        if (rows.length > 0) return rows[0];
      } catch (err) {
        console.warn("[clientes.byId] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    const { data, error } = await supabase.from("clientes").select("*").eq("id", input.id).eq("user_id", ctx.user.id).single();
    if (error) return null;
    return data;
  }),
  create: protectedProcedure.input(z9.object({
    nome: z9.string().min(2),
    cpfCnpj: z9.string().optional(),
    cnpj: z9.string().optional(),
    rg: z9.string().optional(),
    telefone: z9.string().optional(),
    whatsapp: z9.string().optional(),
    email: z9.string().email().optional().or(z9.literal("")),
    chavePix: z9.string().optional(),
    tipoChavePix: z9.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).optional(),
    endereco: z9.string().optional(),
    numero: z9.string().optional(),
    complemento: z9.string().optional(),
    bairro: z9.string().optional(),
    cidade: z9.string().optional(),
    estado: z9.string().optional(),
    cep: z9.string().optional(),
    observacoes: z9.string().optional(),
    instagram: z9.string().optional(),
    facebook: z9.string().optional(),
    profissao: z9.string().optional(),
    dataNascimento: z9.string().optional(),
    sexo: z9.enum(["masculino", "feminino", "outro"]).optional(),
    estadoCivil: z9.enum(["solteiro", "casado", "divorciado", "viuvo", "outro"]).optional(),
    nomeMae: z9.string().optional(),
    nomePai: z9.string().optional(),
    fotoUrl: z9.string().optional(),
    documentosUrls: z9.string().optional(),
    tipoCliente: z9.string().optional(),
    isReferral: z9.boolean().optional(),
    banco: z9.string().optional(),
    agencia: z9.string().optional(),
    numeroConta: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const result = await db.insert(clientes).values({
          ...input,
          email: input.email || void 0,
          userId: ctx.user.id
        }).returning({ id: clientes.id });
        return { id: result[0].id };
      } catch (err) {
        console.warn("[clientes.create] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel" });
    const insertData = { nome: input.nome };
    if (input.cpfCnpj) insertData.cpf_cnpj = input.cpfCnpj;
    if (input.cnpj) insertData.cnpj = input.cnpj;
    if (input.rg) insertData.rg = input.rg;
    if (input.telefone) insertData.telefone = input.telefone;
    if (input.whatsapp) insertData.whatsapp = input.whatsapp;
    if (input.email) insertData.email = input.email;
    if (input.chavePix) insertData.chave_pix = input.chavePix;
    if (input.tipoChavePix) insertData.tipo_chave_pix = input.tipoChavePix;
    if (input.endereco) insertData.endereco = input.endereco;
    if (input.numero) insertData.numero = input.numero;
    if (input.complemento) insertData.complemento = input.complemento;
    if (input.bairro) insertData.bairro = input.bairro;
    if (input.cidade) insertData.cidade = input.cidade;
    if (input.estado) insertData.estado = input.estado;
    if (input.cep) insertData.cep = input.cep;
    if (input.observacoes) insertData.observacoes = input.observacoes;
    if (input.instagram) insertData.instagram = input.instagram;
    if (input.facebook) insertData.facebook = input.facebook;
    if (input.profissao) insertData.profissao = input.profissao;
    if (input.dataNascimento) insertData.data_nascimento = input.dataNascimento;
    if (input.sexo) insertData.sexo = input.sexo;
    if (input.estadoCivil) insertData.estado_civil = input.estadoCivil;
    if (input.nomeMae) insertData.nome_mae = input.nomeMae;
    if (input.nomePai) insertData.nome_pai = input.nomePai;
    if (input.fotoUrl) insertData.foto_url = input.fotoUrl;
    if (input.documentosUrls) insertData.documentos_urls = input.documentosUrls;
    if (input.tipoCliente) insertData.tipo_cliente = input.tipoCliente;
    if (input.isReferral !== void 0) insertData.is_referral = input.isReferral;
    if (input.banco) insertData.banco = input.banco;
    if (input.agencia) insertData.agencia = input.agencia;
    if (input.numeroConta) insertData.numero_conta = input.numeroConta;
    insertData.user_id = ctx.user.id;
    const { data, error } = await supabase.from("clientes").insert(insertData).select("id").single();
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { id: data.id };
  }),
  update: protectedProcedure.input(z9.object({
    id: z9.number(),
    nome: z9.string().min(2).optional(),
    cpfCnpj: z9.string().optional(),
    cnpj: z9.string().optional(),
    rg: z9.string().optional(),
    telefone: z9.string().optional(),
    whatsapp: z9.string().optional(),
    email: z9.string().optional(),
    chavePix: z9.string().optional(),
    tipoChavePix: z9.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).optional(),
    endereco: z9.string().optional(),
    numero: z9.string().optional(),
    complemento: z9.string().optional(),
    bairro: z9.string().optional(),
    cidade: z9.string().optional(),
    estado: z9.string().optional(),
    cep: z9.string().optional(),
    observacoes: z9.string().optional(),
    score: z9.number().min(0).max(1e3).optional(),
    instagram: z9.string().optional(),
    facebook: z9.string().optional(),
    profissao: z9.string().optional(),
    dataNascimento: z9.string().optional(),
    sexo: z9.enum(["masculino", "feminino", "outro"]).optional(),
    estadoCivil: z9.enum(["solteiro", "casado", "divorciado", "viuvo", "outro"]).optional(),
    nomeMae: z9.string().optional(),
    nomePai: z9.string().optional(),
    fotoUrl: z9.string().optional(),
    documentosUrls: z9.string().optional(),
    tipoCliente: z9.string().optional(),
    isReferral: z9.boolean().optional(),
    banco: z9.string().optional(),
    agencia: z9.string().optional(),
    numeroConta: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const { id, ...data } = input;
    if (db) {
      try {
        await db.update(clientes).set(data).where(eq5(clientes.id, id));
        return { success: true };
      } catch (err) {
        console.warn("[clientes.update] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const updateData = {};
    if (data.nome) updateData.nome = data.nome;
    if (data.cpfCnpj !== void 0) updateData.cpf_cnpj = data.cpfCnpj;
    if (data.cnpj !== void 0) updateData.cnpj = data.cnpj;
    if (data.rg !== void 0) updateData.rg = data.rg;
    if (data.telefone !== void 0) updateData.telefone = data.telefone;
    if (data.whatsapp !== void 0) updateData.whatsapp = data.whatsapp;
    if (data.email !== void 0) updateData.email = data.email;
    if (data.chavePix !== void 0) updateData.chave_pix = data.chavePix;
    if (data.tipoChavePix !== void 0) updateData.tipo_chave_pix = data.tipoChavePix;
    if (data.endereco !== void 0) updateData.endereco = data.endereco;
    if (data.numero !== void 0) updateData.numero = data.numero;
    if (data.complemento !== void 0) updateData.complemento = data.complemento;
    if (data.bairro !== void 0) updateData.bairro = data.bairro;
    if (data.cidade !== void 0) updateData.cidade = data.cidade;
    if (data.estado !== void 0) updateData.estado = data.estado;
    if (data.cep !== void 0) updateData.cep = data.cep;
    if (data.observacoes !== void 0) updateData.observacoes = data.observacoes;
    if (data.score !== void 0) updateData.score = data.score;
    if (data.instagram !== void 0) updateData.instagram = data.instagram;
    if (data.facebook !== void 0) updateData.facebook = data.facebook;
    if (data.profissao !== void 0) updateData.profissao = data.profissao;
    if (data.dataNascimento !== void 0) updateData.data_nascimento = data.dataNascimento;
    if (data.sexo !== void 0) updateData.sexo = data.sexo;
    if (data.estadoCivil !== void 0) updateData.estado_civil = data.estadoCivil;
    if (data.nomeMae !== void 0) updateData.nome_mae = data.nomeMae;
    if (data.nomePai !== void 0) updateData.nome_pai = data.nomePai;
    if (data.fotoUrl !== void 0) updateData.foto_url = data.fotoUrl;
    if (data.documentosUrls !== void 0) updateData.documentos_urls = data.documentosUrls;
    if (data.tipoCliente !== void 0) updateData.tipo_cliente = data.tipoCliente;
    if (data.isReferral !== void 0) updateData.is_referral = data.isReferral;
    if (data.banco !== void 0) updateData.banco = data.banco;
    if (data.agencia !== void 0) updateData.agencia = data.agencia;
    if (data.numeroConta !== void 0) updateData.numero_conta = data.numeroConta;
    const { error } = await supabase.from("clientes").update(updateData).eq("id", id).eq("user_id", ctx.user.id);
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),
  contratosByCliente: protectedProcedure.input(z9.object({ clienteId: z9.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        return db.select().from(contratos).where(and3(eq5(contratos.clienteId, input.clienteId), eq5(contratos.userId, ctx.user.id))).orderBy(desc2(contratos.createdAt));
      } catch (err) {
        console.warn("[clientes.contratosByCliente] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from("contratos").select("*").eq("cliente_id", input.clienteId).eq("user_id", ctx.user.id).order("createdAt", { ascending: false });
    return data ?? [];
  }),
  importarCSV: protectedProcedure.input(z9.object({
    registros: z9.array(z9.object({
      nome: z9.string().min(1),
      cpfCnpj: z9.string().optional(),
      telefone: z9.string().optional(),
      whatsapp: z9.string().optional(),
      email: z9.string().optional(),
      chavePix: z9.string().optional(),
      endereco: z9.string().optional(),
      cidade: z9.string().optional(),
      estado: z9.string().optional(),
      observacoes: z9.string().optional()
    }))
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const supabaseImport = !db ? await getSupabaseClientAsync() : null;
    if (!db && !supabaseImport) throw new Error("DB unavailable");
    let importados = 0;
    let erros = 0;
    const detalhesErros = [];
    for (const reg of input.registros) {
      try {
        if (!reg.nome || reg.nome.trim().length < 2) {
          erros++;
          detalhesErros.push(`Linha ignorada: nome inv\xE1lido ("${reg.nome}")`);
          continue;
        }
        if (db) {
          await db.insert(clientes).values({
            nome: reg.nome.trim(),
            cpfCnpj: reg.cpfCnpj?.trim() || void 0,
            telefone: reg.telefone?.trim() || void 0,
            whatsapp: reg.whatsapp?.trim() || reg.telefone?.trim() || void 0,
            email: reg.email?.trim() || void 0,
            chavePix: reg.chavePix?.trim() || void 0,
            endereco: reg.endereco?.trim() || void 0,
            cidade: reg.cidade?.trim() || void 0,
            estado: reg.estado?.trim() || void 0,
            observacoes: reg.observacoes?.trim() || void 0,
            userId: ctx.user.id
          });
        } else if (supabaseImport) {
          const { error: impErr } = await supabaseImport.from("clientes").insert({
            nome: reg.nome.trim(),
            cpf_cnpj: reg.cpfCnpj?.trim() || null,
            telefone: reg.telefone?.trim() || null,
            whatsapp: reg.whatsapp?.trim() || reg.telefone?.trim() || null,
            email: reg.email?.trim() || null,
            chave_pix: reg.chavePix?.trim() || null,
            endereco: reg.endereco?.trim() || null,
            cidade: reg.cidade?.trim() || null,
            estado: reg.estado?.trim() || null,
            observacoes: reg.observacoes?.trim() || null
          });
          if (impErr) throw new Error(impErr.message);
        }
        importados++;
      } catch (e) {
        erros++;
        detalhesErros.push(`Erro ao importar "${reg.nome}": ${e?.message ?? "erro desconhecido"}`);
      }
    }
    return { importados, erros, detalhesErros };
  }),
  listarComScore: protectedProcedure.input(z9.object({ ordenarPor: z9.enum(["score", "lucro", "nome"]).optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    let rows = [];
    if (db) {
      try {
        rows = await db.select().from(clientes).where(and3(eq5(clientes.ativo, true), eq5(clientes.userId, ctx.user.id)));
      } catch (err) {
        console.warn("[clientes.listarComScore] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    if (rows.length === 0) {
      const supabase = await getSupabaseClientAsync();
      if (supabase) {
        const { data, error } = await supabase.from("clientes").select("*").eq("ativo", true).eq("user_id", ctx.user.id);
        if (!error && data) rows = data;
      }
    }
    const clientesComScore = await Promise.all(rows.map(async (cliente) => {
      let parcelas_data = [];
      if (db) {
        try {
          parcelas_data = await db.select().from(parcelas).where(eq5(parcelas.clienteId, cliente.id));
        } catch (err) {
          resetDb();
        }
      }
      if (parcelas_data.length === 0) {
        const supabase = await getSupabaseClientAsync();
        if (supabase) {
          const { data } = await supabase.from("parcelas").select("*").eq("cliente_id", cliente.id);
          if (data) parcelas_data = data;
        }
      }
      let score = 100;
      let lucroGerado = 0;
      let parcelasEmDia = 0;
      let parcelasAtrasadas = 0;
      let parcelasQuitadas = 0;
      let pontosRecuperacao = 0;
      let capitalTotal = 0;
      let totalReceber = 0;
      const totalParcelas = parcelas_data.length;
      for (const parcela of parcelas_data) {
        const valorOriginalParcela = parseFloat(parcela.valor_original ?? parcela.valorOriginal ?? "0");
        capitalTotal += valorOriginalParcela;
        if (parcela.status !== "paga") totalReceber += valorOriginalParcela;
        if (parcela.status === "paga") {
          parcelasQuitadas++;
          score += 10;
          lucroGerado += parseFloat(parcela.juros || parcela.valor_juros || 0);
          const dataPag = parcela.data_pagamento || parcela.dataPagamento;
          const dataVenc = parcela.data_vencimento || parcela.dataVencimento;
          if (dataPag && dataVenc && new Date(dataPag) > new Date(dataVenc)) {
            pontosRecuperacao += 3;
            score += 3;
          }
        } else if (parcela.status === "pendente" || parcela.status === "vencendo_hoje") {
          parcelasEmDia++;
          score += 5;
        } else if (parcela.status === "atrasada") {
          parcelasAtrasadas++;
          score -= 5;
        }
      }
      score += Math.floor(lucroGerado / 100);
      if (totalParcelas > 0) {
        const taxaAdimplencia = (parcelasQuitadas + parcelasEmDia) / totalParcelas;
        if (taxaAdimplencia >= 0.9) score += 20;
        else if (taxaAdimplencia >= 0.8) score += 10;
      }
      score = Math.max(0, Math.min(200, score));
      let badge = "\u26A0\uFE0F Ruim";
      if (score >= 100) badge = "\u2B50 Excelente";
      else if (score >= 70) badge = "\u{1F44D} Bom";
      else if (score >= 40) badge = "\u{1F44C} Regular";
      return {
        ...cliente,
        score,
        badge,
        lucroGerado,
        parcelasEmDia,
        parcelasAtrasadas,
        parcelasQuitadas,
        pontosRecuperacao,
        totalParcelas,
        taxaAdimplencia: totalParcelas > 0 ? Math.round((parcelasQuitadas + parcelasEmDia) / totalParcelas * 100) : 0,
        capitalTotal,
        totalReceber
      };
    }));
    const ordenarPor = input?.ordenarPor || "score";
    if (ordenarPor === "score") {
      clientesComScore.sort((a, b) => b.score - a.score);
    } else if (ordenarPor === "lucro") {
      clientesComScore.sort((a, b) => b.lucroGerado - a.lucroGerado);
    } else if (ordenarPor === "nome") {
      clientesComScore.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    }
    return { clientes: clientesComScore, total: clientesComScore.length };
  }),
  deletar: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const contratosAtivos = await db.select().from(contratos).where(
          and3(eq5(contratos.clienteId, input.id), eq5(contratos.status, "ativo"))
        );
        if (contratosAtivos.length > 0) {
          throw new TRPCError9({
            code: "CONFLICT",
            message: `Nao eh possivel deletar cliente com ${contratosAtivos.length} contrato(s) ativo(s).`
          });
        }
        await db.delete(clientes).where(eq5(clientes.id, input.id));
        return { success: true };
      } catch (err) {
        if (err?.code === "CONFLICT") throw err;
        console.warn("[clientes.deletar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: ctAtivos } = await supabase.from("contratos").select("id").eq("cliente_id", input.id).eq("status", "ativo").eq("user_id", ctx.user.id);
    if (ctAtivos && ctAtivos.length > 0) {
      throw new TRPCError9({ code: "CONFLICT", message: `Nao eh possivel deletar cliente com ${ctAtivos.length} contrato(s) ativo(s).` });
    }
    const { error } = await supabase.from("clientes").delete().eq("id", input.id).eq("user_id", ctx.user.id);
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  })
});
var contratosRouter = router({
  // Lista contratos com dados agregados das parcelas para os cards de Empréstimos
  listComParcelas: protectedProcedure.input(z9.object({
    status: z9.string().optional(),
    modalidade: z9.string().optional(),
    busca: z9.string().optional()
  }).optional()).query(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    let myKoletorIdForList = null;
    try {
      const { data: koletorMe } = await supabase.from("koletores").select("id, perfil").eq("user_id", ctx.user.id).eq("ativo", true).maybeSingle();
      if (koletorMe?.perfil === "koletor") myKoletorIdForList = koletorMe.id;
    } catch (_) {
    }
    let cQuery = supabase.from("contratos").select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, data_vencimento_primeira, "createdAt", etiquetas, clientes!inner(id, nome, whatsapp, chave_pix, telefone)').order("createdAt", { ascending: false }).eq("user_id", ctx.user.id);
    if (myKoletorIdForList !== null) cQuery = cQuery.eq("koletor_id", myKoletorIdForList);
    if (input?.status && input.status !== "todos") cQuery = cQuery.eq("status", input.status);
    if (input?.modalidade) cQuery = cQuery.eq("modalidade", input.modalidade);
    const { data: contratosData, error: contratosErr } = await cQuery;
    if (contratosErr) {
      console.error("[contratos.listComParcelas] error:", contratosErr.message);
      return [];
    }
    const contratosList = contratosData ?? [];
    if (contratosList.length === 0) return [];
    const filtrados = input?.busca ? contratosList.filter((c) => {
      const nome = c.clientes?.nome ?? "";
      return nome.toLowerCase().includes(input.busca.toLowerCase());
    }) : contratosList;
    const contratoIds = filtrados.map((c) => c.id);
    const { data: parcelasData } = await supabase.from("parcelas").select("id, contrato_id, numero_parcela, valor_original, valor_pago, data_vencimento, data_pagamento, status").in("contrato_id", contratoIds).order("data_vencimento");
    const hoje = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const parcelasPorContrato = {};
    for (const p of parcelasData ?? []) {
      if (!parcelasPorContrato[p.contrato_id]) parcelasPorContrato[p.contrato_id] = [];
      let statusAtual = p.status;
      if (statusAtual !== "paga" && statusAtual !== "parcial") {
        if (p.data_vencimento < hoje) statusAtual = "atrasada";
        else if (p.data_vencimento === hoje) statusAtual = "vencendo_hoje";
      }
      parcelasPorContrato[p.contrato_id].push({ ...p, status: statusAtual });
    }
    let multaDiaria = 100;
    try {
      const { data: configRows } = await supabase.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id);
      if (configRows) {
        const configMap = {};
        for (const r of configRows) configMap[r.chave] = r.valor ?? "";
        if (configMap["multaDiaria"]) multaDiaria = parseFloat(configMap["multaDiaria"]) || 100;
        else if (configMap["jurosMoraDiario"]) {
        }
      }
    } catch (_) {
    }
    return filtrados.map((c) => {
      const cliente = c.clientes;
      const parcelasContrato = parcelasPorContrato[c.id] ?? [];
      const parcelasAbertas = parcelasContrato.filter((p) => !["paga"].includes(p.status));
      const parcelasPagas = parcelasContrato.filter((p) => p.status === "paga");
      const parcelasAtrasadas = parcelasContrato.filter((p) => p.status === "atrasada");
      const valorPrincipal = parseFloat(c.valor_principal ?? "0");
      const valorParcela = parseFloat(c.valor_parcela ?? "0");
      const taxaJuros = parseFloat(c.taxa_juros ?? "0");
      const valorJurosParcela = Math.round(valorPrincipal * (taxaJuros / 100) * 100) / 100;
      const totalReceber = parcelasAbertas.reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0);
      const totalPago = parcelasPagas.reduce((s, p) => s + parseFloat(p.valor_pago ?? p.valor_original ?? "0"), 0);
      const lucroPrevisto = valorJurosParcela * parcelasAbertas.length;
      const lucroRealizado = Math.max(0, totalPago - (parcelasPagas.length > 0 ? 0 : 0));
      const proximaParcela = parcelasAbertas.length > 0 ? parcelasAbertas[0] : null;
      const parcelasComAtraso = parcelasAtrasadas.map((p) => {
        const venc = /* @__PURE__ */ new Date(p.data_vencimento + "T00:00:00");
        const diasAtraso = Math.max(0, Math.floor(((/* @__PURE__ */ new Date()).getTime() - venc.getTime()) / (1e3 * 60 * 60 * 24)));
        const jurosDiarios = multaDiaria;
        const jurosAtraso = diasAtraso * jurosDiarios;
        return {
          ...p,
          diasAtraso,
          jurosAtraso,
          totalComAtraso: parseFloat(p.valor_original ?? "0") + jurosAtraso
        };
      });
      return {
        id: c.id,
        clienteId: cliente?.id ?? c.cliente_id,
        clienteNome: cliente?.nome ?? "",
        clienteWhatsapp: cliente?.whatsapp ?? null,
        clienteChavePix: cliente?.chave_pix ?? null,
        clienteTelefone: cliente?.telefone ?? null,
        modalidade: c.modalidade,
        status: c.status,
        valorPrincipal: c.valor_principal,
        valorParcela: c.valor_parcela,
        numeroParcelas: c.numero_parcelas,
        taxaJuros: c.taxa_juros,
        tipoTaxa: c.tipo_taxa,
        dataInicio: c.data_inicio,
        createdAt: c.createdAt,
        // KPIs calculados
        totalReceber,
        totalPago,
        lucroPrevisto,
        lucroRealizado,
        valorJurosParcela,
        // Parcelas
        parcelasAbertas: parcelasAbertas.length,
        parcelasAtrasadas: parcelasAtrasadas.length,
        parcelasPagas: parcelasPagas.length,
        proximaParcela,
        parcelasComAtraso,
        todasParcelas: parcelasContrato,
        etiquetas: (() => {
          try {
            return JSON.parse(c.etiquetas ?? "[]");
          } catch {
            return [];
          }
        })()
      };
    });
  }),
  obterDetalhes: protectedProcedure.input(z9.object({ id: z9.number() })).query(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    const { data: contratoData, error: contratoErr } = await supabase.from("contratos").select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, data_vencimento_primeira, "createdAt", etiquetas, clientes!inner(id, nome, whatsapp, chave_pix, telefone)').eq("id", input.id).eq("user_id", ctx.user.id).single();
    if (contratoErr || !contratoData) return null;
    const { data: parcelasData } = await supabase.from("parcelas").select("id, contrato_id, numero_parcela, valor_original, valor_pago, data_vencimento, data_pagamento, status").eq("contrato_id", input.id).order("data_vencimento");
    const hoje = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const cliente = contratoData.clientes;
    const parcelas2 = (parcelasData ?? []).map((p) => {
      let statusAtual = p.status;
      if (statusAtual !== "paga" && statusAtual !== "parcial") {
        if (p.data_vencimento < hoje) statusAtual = "atrasada";
        else if (p.data_vencimento === hoje) statusAtual = "vencendo_hoje";
      }
      return { ...p, status: statusAtual };
    });
    let multaDiaria = 100;
    try {
      const { data: configRows } = await supabase.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id);
      if (configRows) {
        const configMap = {};
        for (const r of configRows) configMap[r.chave] = r.valor ?? "";
        if (configMap["multaDiaria"]) multaDiaria = parseFloat(configMap["multaDiaria"]) || 100;
      }
    } catch (_) {
    }
    const parcelasAbertas = parcelas2.filter((p) => !["paga"].includes(p.status));
    const parcelasPagas = parcelas2.filter((p) => p.status === "paga");
    const parcelasAtrasadas = parcelas2.filter((p) => p.status === "atrasada");
    const valorPrincipal = parseFloat(contratoData.valor_principal ?? "0");
    const valorParcela = parseFloat(contratoData.valor_parcela ?? "0");
    const taxaJuros = parseFloat(contratoData.taxa_juros ?? "0");
    const valorJurosParcela = Math.round(valorPrincipal * (taxaJuros / 100) * 100) / 100;
    const totalReceber = parcelasAbertas.reduce((s, p) => s + parseFloat(p.valor_original ?? "0"), 0);
    const totalPago = parcelasPagas.reduce((s, p) => s + parseFloat(p.valor_pago ?? p.valor_original ?? "0"), 0);
    const lucroPrevisto = valorJurosParcela * parcelasAbertas.length;
    const lucroRealizado = Math.max(0, totalPago - (parcelasPagas.length > 0 ? 0 : 0));
    const parcelasComAtraso = parcelasAtrasadas.map((p) => {
      const venc = /* @__PURE__ */ new Date(p.data_vencimento + "T00:00:00");
      const diasAtraso = Math.max(0, Math.floor(((/* @__PURE__ */ new Date()).getTime() - venc.getTime()) / (1e3 * 60 * 60 * 24)));
      const jurosDiarios = multaDiaria;
      const jurosAtraso = diasAtraso * jurosDiarios;
      return {
        ...p,
        diasAtraso,
        jurosAtraso,
        totalComAtraso: parseFloat(p.valor_original ?? "0") + jurosAtraso
      };
    });
    return {
      id: contratoData.id,
      clienteId: cliente?.id ?? contratoData.cliente_id,
      clienteNome: cliente?.nome ?? "",
      clienteWhatsapp: cliente?.whatsapp ?? null,
      clienteChavePix: cliente?.chave_pix ?? null,
      clienteTelefone: cliente?.telefone ?? null,
      modalidade: contratoData.modalidade,
      status: contratoData.status,
      valorPrincipal: contratoData.valor_principal,
      valorParcela: contratoData.valor_parcela,
      numeroParcelas: contratoData.numero_parcelas,
      taxaJuros: contratoData.taxa_juros,
      tipoTaxa: contratoData.tipo_taxa,
      dataInicio: contratoData.data_inicio,
      dataVencimento: contratoData.data_vencimento_primeira,
      dataCriacao: contratoData.createdAt,
      totalReceber,
      totalPago,
      lucroPrevisto,
      lucroRealizado,
      valorJurosParcela,
      parcelasAbertas: parcelasAbertas.length,
      parcelasAtrasadas: parcelasAtrasadas.length,
      parcelasPagas: parcelasPagas.length,
      parcelasComAtraso,
      todasParcelas: parcelas2
    };
  }),
  list: protectedProcedure.input(z9.object({
    status: z9.string().optional(),
    modalidade: z9.string().optional(),
    clienteId: z9.number().optional()
  }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select({
          id: contratos.id,
          clienteId: contratos.clienteId,
          clienteNome: clientes.nome,
          modalidade: contratos.modalidade,
          status: contratos.status,
          valorPrincipal: contratos.valorPrincipal,
          valorParcela: contratos.valorParcela,
          numeroParcelas: contratos.numeroParcelas,
          taxaJuros: contratos.taxaJuros,
          tipoTaxa: contratos.tipoTaxa,
          dataInicio: contratos.dataInicio,
          createdAt: contratos.createdAt,
          koletorId: contratos.koletorId
        }).from(contratos).innerJoin(clientes, eq5(contratos.clienteId, clientes.id)).where(eq5(contratos.userId, ctx.user.id)).orderBy(desc2(contratos.createdAt));
        let myKoletorId2 = null;
        try {
          const supabaseForPerfil = await getSupabaseClientAsync();
          if (supabaseForPerfil) {
            const { data: koletorData } = await supabaseForPerfil.from("koletores").select("id, perfil").eq("user_id", ctx.user.id).single();
            if (koletorData?.perfil === "koletor") myKoletorId2 = koletorData.id;
          }
        } catch (_) {
        }
        return rows.filter((r) => {
          if (myKoletorId2 !== null && r.koletorId !== myKoletorId2) return false;
          if (input?.status && r.status !== input.status) return false;
          if (input?.modalidade && r.modalidade !== input.modalidade) return false;
          if (input?.clienteId && r.clienteId !== input.clienteId) return false;
          return true;
        });
      } catch (err) {
        console.warn("[contratos.list] Drizzle failed, trying REST:", err.message);
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    let myKoletorId = null;
    try {
      const { data: koletorData } = await supabase.from("koletores").select("id, perfil").eq("user_id", ctx.user.id).single();
      if (koletorData?.perfil === "koletor") myKoletorId = koletorData.id;
    } catch (_) {
    }
    let query = supabase.from("contratos").select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, koletor_id, "createdAt", clientes!inner(nome)').order("createdAt", { ascending: false }).eq("user_id", ctx.user.id);
    if (input?.status) query = query.eq("status", input.status);
    if (input?.modalidade) query = query.eq("modalidade", input.modalidade);
    if (input?.clienteId) query = query.eq("cliente_id", input.clienteId);
    if (myKoletorId !== null) query = query.eq("koletor_id", myKoletorId);
    const { data, error } = await query;
    if (error) {
      console.error("[contratos.list] REST error:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      clienteId: r.cliente_id,
      clienteNome: r.clientes?.nome ?? "",
      modalidade: r.modalidade,
      status: r.status,
      valorPrincipal: r.valor_principal,
      valorParcela: r.valor_parcela,
      numeroParcelas: r.numero_parcelas,
      taxaJuros: r.taxa_juros,
      tipoTaxa: r.tipo_taxa,
      dataInicio: r.data_inicio,
      createdAt: r.createdAt
    }));
  }),
  byId: protectedProcedure.input(z9.object({ id: z9.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select({
          contrato: contratos,
          clienteNome: clientes.nome,
          clienteWhatsapp: clientes.whatsapp,
          clienteChavePix: clientes.chavePix
        }).from(contratos).innerJoin(clientes, eq5(contratos.clienteId, clientes.id)).where(eq5(contratos.id, input.id)).limit(1);
        return rows[0] ?? null;
      } catch (err) {
        console.warn("[contratos.byId] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    const { data } = await supabase.from("contratos").select("*, clientes(nome, whatsapp, chave_pix)").eq("id", input.id).eq("user_id", ctx.user.id).single();
    if (!data) return null;
    return {
      contrato: { ...data, clienteId: data.cliente_id, valorPrincipal: data.valor_principal, taxaJuros: data.taxa_juros, tipoTaxa: data.tipo_taxa, numeroParcelas: data.numero_parcelas, dataInicio: data.data_inicio, dataVencimentoPrimeira: data.data_vencimento_primeira, diaVencimento: data.dia_vencimento, multaAtraso: data.multa_atraso, jurosMoraDiario: data.juros_mora_diario, contaCaixaId: data.conta_caixa_id, koletorId: data.koletor_id },
      clienteNome: data.clientes?.nome ?? "",
      clienteWhatsapp: data.clientes?.whatsapp ?? null,
      clienteChavePix: data.clientes?.chave_pix ?? null
    };
  }),
  create: protectedProcedure.input(z9.object({
    clienteId: z9.number(),
    modalidade: z9.enum(["mensal", "diario", "semanal", "quinzenal", "tabela_price", "reparcelamento", "venda", "cheque"]),
    valorPrincipal: z9.number().positive(),
    taxaJuros: z9.number().min(0),
    tipoTaxa: z9.enum(["diaria", "semanal", "quinzenal", "mensal", "anual"]).default("mensal"),
    numeroParcelas: z9.number().int().positive(),
    dataInicio: z9.string(),
    dataVencimentoPrimeira: z9.string(),
    diaVencimento: z9.number().int().min(1).max(31).optional(),
    descricao: z9.string().optional(),
    observacoes: z9.string().optional(),
    contaCaixaId: z9.number().optional(),
    multaAtraso: z9.number().optional(),
    jurosMoraDiario: z9.number().optional()
  })).mutation(async ({ ctx, input }) => {
    let valorParcela;
    if (input.modalidade === "tabela_price") {
      valorParcela = calcularParcelasPrice(input.valorPrincipal, input.taxaJuros, input.numeroParcelas);
    } else {
      valorParcela = calcularParcelaPadrao(input.valorPrincipal, input.taxaJuros, input.numeroParcelas);
    }
    let koletorId = null;
    try {
      const supabaseForKoletor = await getSupabaseClientAsync();
      if (supabaseForKoletor) {
        const { data: koletorData } = await supabaseForKoletor.from("koletores").select("id").eq("user_id", ctx.user.id).single();
        koletorId = koletorData?.id ?? null;
      }
    } catch (_) {
    }
    const db = await getDb();
    let contratoId;
    if (db) {
      try {
        const totalContrato = (valorParcela * input.numeroParcelas).toFixed(2);
        const result = await db.insert(contratos).values({
          clienteId: input.clienteId,
          koletorId: koletorId ?? void 0,
          userId: ctx.user.id,
          modalidade: input.modalidade,
          valorPrincipal: input.valorPrincipal.toFixed(2),
          taxaJuros: input.taxaJuros.toFixed(4),
          tipoTaxa: input.tipoTaxa,
          numeroParcelas: input.numeroParcelas,
          valorParcela: valorParcela.toFixed(2),
          totalContrato,
          multaAtraso: (input.multaAtraso ?? 0).toFixed(4),
          jurosMoraDiario: (input.jurosMoraDiario ?? 0).toFixed(4),
          dataInicio: input.dataInicio,
          dataVencimentoPrimeira: input.dataVencimentoPrimeira,
          diaVencimento: input.diaVencimento,
          descricao: input.descricao,
          observacoes: input.observacoes,
          contaCaixaId: input.contaCaixaId
        }).returning({ id: contratos.id });
        contratoId = result[0].id;
        const primeiraData2 = /* @__PURE__ */ new Date(input.dataVencimentoPrimeira + "T00:00:00");
        const hoje22 = /* @__PURE__ */ new Date();
        hoje22.setHours(0, 0, 0, 0);
        for (let i = 0; i < input.numeroParcelas; i++) {
          const dataVenc = new Date(primeiraData2);
          if (i > 0) {
            if (input.tipoTaxa === "diaria") dataVenc.setDate(dataVenc.getDate() + i);
            else if (input.tipoTaxa === "semanal") dataVenc.setDate(dataVenc.getDate() + i * 7);
            else if (input.tipoTaxa === "quinzenal") dataVenc.setDate(dataVenc.getDate() + i * 15);
            else dataVenc.setMonth(dataVenc.getMonth() + i);
          }
          dataVenc.setHours(0, 0, 0, 0);
          let status = "pendente";
          if (dataVenc.getTime() < hoje22.getTime()) status = "atrasada";
          else if (dataVenc.getTime() === hoje22.getTime()) status = "vencendo_hoje";
          await db.insert(parcelas).values({
            contratoId,
            clienteId: input.clienteId,
            numeroParcela: i + 1,
            valorOriginal: valorParcela.toFixed(2),
            dataVencimento: dataVenc.toISOString().split("T")[0],
            status,
            contaCaixaId: input.contaCaixaId
          });
        }
        if (input.contaCaixaId) {
          await db.insert(transacoesCaixa).values({
            contaCaixaId: input.contaCaixaId,
            tipo: "saida",
            categoria: "emprestimo_liberado",
            valor: input.valorPrincipal.toFixed(2),
            descricao: `Empr\xE9stimo liberado - Contrato #${contratoId}`,
            contratoId,
            clienteId: input.clienteId
          });
        }
        return { id: contratoId, valorParcela };
      } catch (err) {
        if (contratoId) {
          console.error("[contratos.create] Drizzle parcelas failed after contrato created:", err.message);
          return { id: contratoId, valorParcela };
        }
        console.error("[contratos.create] Drizzle failed, falling back to REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const totalContratoRest = parseFloat((valorParcela * input.numeroParcelas).toFixed(2));
    const _primeiraDataRest = /* @__PURE__ */ new Date(input.dataVencimentoPrimeira + "T00:00:00");
    const _ultimaDataRest = new Date(_primeiraDataRest);
    if (input.numeroParcelas > 1) {
      const _n = input.numeroParcelas - 1;
      if (input.tipoTaxa === "diaria") _ultimaDataRest.setDate(_ultimaDataRest.getDate() + _n);
      else if (input.tipoTaxa === "semanal") _ultimaDataRest.setDate(_ultimaDataRest.getDate() + _n * 7);
      else if (input.tipoTaxa === "quinzenal") _ultimaDataRest.setDate(_ultimaDataRest.getDate() + _n * 15);
      else _ultimaDataRest.setMonth(_ultimaDataRest.getMonth() + _n);
    }
    const _dataVencFinal = _ultimaDataRest.toISOString().split("T")[0];
    const { data: contratoData, error: contratoErr } = await supabase.from("contratos").insert({
      cliente_id: input.clienteId,
      koletor_id: koletorId,
      modalidade: input.modalidade,
      valor_principal: parseFloat(input.valorPrincipal.toFixed(2)),
      taxa_juros: parseFloat(input.taxaJuros.toFixed(4)),
      tipo_taxa: input.tipoTaxa,
      numero_parcelas: input.numeroParcelas,
      valor_parcela: parseFloat(valorParcela.toFixed(2)),
      total_contrato: totalContratoRest,
      multa_atraso: parseFloat((input.multaAtraso ?? 0).toFixed(4)),
      juros_mora_diario: parseFloat((input.jurosMoraDiario ?? 0).toFixed(4)),
      data_inicio: input.dataInicio,
      data_vencimento_primeira: input.dataVencimentoPrimeira,
      data_vencimento: _dataVencFinal,
      dia_vencimento: input.diaVencimento ?? null,
      descricao: input.descricao ?? null,
      observacoes: input.observacoes ?? null,
      conta_caixa_id: input.contaCaixaId ?? null,
      status: "ativo",
      user_id: ctx.user.id
    }).select("id").single();
    if (contratoErr || !contratoData) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: contratoErr?.message ?? "Erro ao criar contrato" });
    contratoId = contratoData.id;
    const primeiraData = /* @__PURE__ */ new Date(input.dataVencimentoPrimeira + "T00:00:00");
    const hoje2 = /* @__PURE__ */ new Date();
    hoje2.setHours(0, 0, 0, 0);
    const parcelasPayload = [];
    for (let i = 0; i < input.numeroParcelas; i++) {
      const dataVenc = new Date(primeiraData);
      if (i > 0) {
        if (input.tipoTaxa === "diaria") dataVenc.setDate(dataVenc.getDate() + i);
        else if (input.tipoTaxa === "semanal") dataVenc.setDate(dataVenc.getDate() + i * 7);
        else if (input.tipoTaxa === "quinzenal") dataVenc.setDate(dataVenc.getDate() + i * 15);
        else dataVenc.setMonth(dataVenc.getMonth() + i);
      }
      dataVenc.setHours(0, 0, 0, 0);
      let status = "pendente";
      if (dataVenc.getTime() < hoje2.getTime()) status = "atrasada";
      else if (dataVenc.getTime() === hoje2.getTime()) status = "vencendo_hoje";
      parcelasPayload.push({
        contrato_id: contratoId,
        cliente_id: input.clienteId,
        koletor_id: koletorId ?? null,
        numero: i + 1,
        numero_parcela: i + 1,
        valor: parseFloat(valorParcela.toFixed(2)),
        valor_original: parseFloat(valorParcela.toFixed(2)),
        data_vencimento: dataVenc.toISOString().split("T")[0],
        status,
        conta_caixa_id: input.contaCaixaId ?? null,
        user_id: ctx.user.id
      });
    }
    const { error: parcelasErr } = await supabase.from("parcelas").insert(parcelasPayload);
    if (parcelasErr) console.error("[contratos.create] Erro ao criar parcelas via REST:", parcelasErr.message);
    return { id: contratoId, valorParcela };
  }),
  updateStatus: protectedProcedure.input(z9.object({ id: z9.number(), status: z9.enum(["ativo", "quitado", "inadimplente", "cancelado"]) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(contratos).set({ status: input.status }).where(eq5(contratos.id, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[contratos.updateStatus] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { error } = await supabase.from("contratos").update({ status: input.status }).eq("id", input.id);
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),
  gerarPDF: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { data: ctData, error: ctErr } = await supabase.from("contratos").select("*, clientes!inner(nome, cpf_cnpj, telefone, whatsapp, chave_pix, endereco, cidade, estado)").eq("id", input.id).single();
      if (ctErr || !ctData) throw new TRPCError9({ code: "NOT_FOUND", message: "Contrato n\xE3o encontrado" });
      const { data: parcelasData2 } = await supabase.from("parcelas").select("*").eq("contrato_id", input.id).order("numero_parcela");
      const { data: configRows2 } = await supabase.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id);
      const configMap2 = {};
      (configRows2 ?? []).forEach((r) => {
        if (r.chave && r.valor) configMap2[r.chave] = r.valor;
      });
      const c2 = ctData;
      const cli2 = ctData.clientes;
      const dataInicio2 = c2.data_inicio ? new Date(c2.data_inicio).toLocaleDateString("pt-BR") : "-";
      const valorPrincipal2 = Number(c2.valor_principal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const valorTotalNum2 = (parcelasData2 ?? []).reduce((sum, p) => sum + Number(p.valor_original), 0);
      const valorTotal2 = valorTotalNum2 > 0 ? valorTotalNum2.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : valorPrincipal2;
      const valorParcela2 = Number(c2.valor_parcela).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const taxaJuros2 = `${c2.taxa_juros}% ${c2.tipo_taxa === "mensal" ? "ao m\xEAs" : "ao dia"}`;
      const nomeEmpresa2 = configMap2["nomeEmpresa"] ?? "CobraPro";
      const parcelasHTML2 = (parcelasData2 ?? []).slice(0, 24).map((p) => {
        const venc = p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString("pt-BR") : "-";
        const val = Number(p.valor_original).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        return `<tr><td>${p.numero_parcela}</td><td>${venc}</td><td>${val}</td><td>${p.status === "paga" ? "PAGA" : p.status === "atrasada" ? "ATRASADA" : "PENDENTE"}</td></tr>`;
      }).join("");
      const html2 = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0;padding:20px}h1{font-size:18px;text-align:center}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}.header{text-align:center;margin-bottom:20px}.empresa{font-size:14px;font-weight:bold}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px}.field{margin-bottom:4px}.label{font-weight:bold;color:#555}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#1a1a1a;color:white;padding:6px;text-align:left;font-size:10px}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:10px}.assinatura{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.ass-box{border-top:1px solid #333;padding-top:6px;text-align:center}.rodape{margin-top:20px;font-size:9px;color:#888;text-align:center}</style></head><body><div class="header"><div class="empresa">${nomeEmpresa2}</div><h1>CONTRATO DE CR\xC9DITO</h1><div>N\xBA ${String(c2.id).padStart(6, "0")} &bull; ${dataInicio2}</div></div><h2>DADOS DO CONTRATANTE</h2><div class="grid"><div class="field"><span class="label">Nome:</span> ${cli2?.nome ?? ""}</div><div class="field"><span class="label">CPF/CNPJ:</span> ${cli2?.cpf_cnpj ?? "-"}</div><div class="field"><span class="label">Telefone:</span> ${cli2?.telefone ?? "-"}</div><div class="field"><span class="label">Chave PIX:</span> ${cli2?.chave_pix ?? "-"}</div></div><h2>CONDI\xC7\xD5ES DO CONTRATO</h2><div class="grid"><div class="field"><span class="label">Modalidade:</span> ${c2.modalidade}</div><div class="field"><span class="label">Capital:</span> ${valorPrincipal2}</div><div class="field"><span class="label">Valor Total:</span> ${valorTotal2}</div><div class="field"><span class="label">Taxa:</span> ${taxaJuros2}</div><div class="field"><span class="label">Parcelas:</span> ${c2.numero_parcelas}x de ${valorParcela2}</div></div><h2>PLANO DE PAGAMENTO</h2><table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>${parcelasHTML2}</tbody></table><div class="assinatura"><div class="ass-box"><div>${nomeEmpresa2}</div><div style="font-size:9px;color:#888">Credor</div></div><div class="ass-box"><div>${cli2?.nome ?? ""}</div><div style="font-size:9px;color:#888">Devedor</div></div></div><div class="rodape">Documento gerado em ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR")} \u2014 CobraPro</div></body></html>`;
      return { html: html2, contratoId: c2.id, clienteNome: cli2?.nome ?? "" };
    }
    const rows = await db.select({
      contrato: contratos,
      clienteNome: clientes.nome,
      clienteCpfCnpj: clientes.cpfCnpj,
      clienteTelefone: clientes.telefone,
      clienteWhatsapp: clientes.whatsapp,
      clienteChavePix: clientes.chavePix,
      clienteEndereco: clientes.endereco,
      clienteCidade: clientes.cidade,
      clienteEstado: clientes.estado
    }).from(contratos).innerJoin(clientes, eq5(contratos.clienteId, clientes.id)).where(eq5(contratos.id, input.id)).limit(1);
    const row = rows[0];
    if (!row) throw new Error("Contrato n\xE3o encontrado");
    const parcelasData = await db.select().from(parcelas).where(eq5(parcelas.contratoId, input.id)).orderBy(parcelas.numeroParcela);
    const configRows = await db.select().from(configuracoes);
    const configMap = {};
    configRows.forEach((r) => {
      if (r.chave && r.valor) configMap[r.chave] = r.valor;
    });
    const c = row.contrato;
    const dataInicio = c.dataInicio ? new Date(c.dataInicio).toLocaleDateString("pt-BR") : "-";
    const valorPrincipal = Number(c.valorPrincipal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const valorTotalNum = parcelasData.reduce((sum, p) => sum + Number(p.valorOriginal), 0);
    const valorTotal = valorTotalNum > 0 ? valorTotalNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : valorPrincipal;
    const valorParcela = Number(c.valorParcela).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const taxaJuros = `${c.taxaJuros}% ${c.tipoTaxa === "mensal" ? "ao m\xEAs" : "ao dia"}`;
    const nomeEmpresa = configMap["nome_empresa"] ?? configMap["nomeEmpresa"] ?? "CobraPro";
    const cnpjEmpresa = configMap["cnpj"] ?? "";
    const enderecoEmpresa = configMap["endereco"] ?? "";
    const modalidadeLabel = {
      emprestimo_padrao: "Empr\xE9stimo Padr\xE3o",
      emprestimo_diario: "Empr\xE9stimo Di\xE1rio",
      tabela_price: "Parcela Fixa",
      venda_produto: "Venda de Produto",
      desconto_cheque: "Desconto de Cheque",
      reparcelamento: "Reparcelamento"
    };
    const parcelasHTML = parcelasData.slice(0, 24).map((p) => {
      const venc = p.dataVencimento ? new Date(p.dataVencimento).toLocaleDateString("pt-BR") : "-";
      const val = Number(p.valorOriginal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return `<tr><td>${p.numeroParcela}</td><td>${venc}</td><td>${val}</td><td>${p.status === "paga" ? "PAGA" : p.status === "atrasada" ? "ATRASADA" : "PENDENTE"}</td></tr>`;
    }).join("");
    const html = `
        <!DOCTYPE html><html lang="pt-BR"><head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 20px; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
          h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          .header { text-align: center; margin-bottom: 20px; }
          .empresa { font-size: 14px; font-weight: bold; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
          .field { margin-bottom: 4px; }
          .label { font-weight: bold; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #1a1a1a; color: white; padding: 6px; text-align: left; font-size: 10px; }
          td { padding: 5px 6px; border-bottom: 1px solid #eee; font-size: 10px; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .assinatura { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .ass-box { border-top: 1px solid #333; padding-top: 6px; text-align: center; }
          .rodape { margin-top: 20px; font-size: 9px; color: #888; text-align: center; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; }
          .badge-ativo { background: #dcfce7; color: #166534; }
          .badge-quitado { background: #dbeafe; color: #1e40af; }
        </style></head><body>
        <div class="header">
          <div class="empresa">${nomeEmpresa}</div>
          ${cnpjEmpresa ? `<div>CNPJ: ${cnpjEmpresa}</div>` : ""}
          ${enderecoEmpresa ? `<div>${enderecoEmpresa}</div>` : ""}
          <h1>CONTRATO DE ${(modalidadeLabel[c.modalidade ?? ""] ?? "CR\xC9DITO").toUpperCase()}</h1>
          <div>N\xBA ${String(c.id).padStart(6, "0")} &nbsp;&bull;&nbsp; ${dataInicio}</div>
        </div>
        <h2>DADOS DO CONTRATANTE</h2>
        <div class="grid">
          <div class="field"><span class="label">Nome:</span> ${row.clienteNome}</div>
          <div class="field"><span class="label">CPF/CNPJ:</span> ${row.clienteCpfCnpj ?? "-"}</div>
          <div class="field"><span class="label">Telefone:</span> ${row.clienteTelefone ?? "-"}</div>
          <div class="field"><span class="label">Chave PIX:</span> ${row.clienteChavePix ?? "-"}</div>
          ${row.clienteEndereco ? `<div class="field col-span-2"><span class="label">Endere\xE7o:</span> ${row.clienteEndereco}${row.clienteCidade ? ", " + row.clienteCidade : ""}${row.clienteEstado ? "/" + row.clienteEstado : ""}</div>` : ""}
        </div>
        <h2>CONDI\xC7\xD5ES DO CONTRATO</h2>
        <div class="grid">
          <div class="field"><span class="label">Modalidade:</span> ${modalidadeLabel[c.modalidade ?? ""] ?? c.modalidade}</div>
          <div class="field"><span class="label">Status:</span> <span class="badge badge-${c.status}">${c.status?.toUpperCase()}</span></div>
          <div class="field"><span class="label">Capital:</span> ${valorPrincipal}</div>
          <div class="field"><span class="label">Valor Total:</span> ${valorTotal}</div>
          <div class="field"><span class="label">Taxa de Juros:</span> ${taxaJuros}</div>
          <div class="field"><span class="label">N\xBA Parcelas:</span> ${c.numeroParcelas}x de ${valorParcela}</div>
          ${c.descricao ? `<div class="field" style="grid-column:span 2"><span class="label">Descri\xE7\xE3o:</span> ${c.descricao}</div>` : ""}
        </div>
        <h2>PLANO DE PAGAMENTO</h2>
        <table>
          <thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>${parcelasHTML}</tbody>
        </table>
        ${parcelasData.length > 24 ? `<p style="font-size:9px;color:#888">... e mais ${parcelasData.length - 24} parcelas</p>` : ""}
        <div class="assinatura">
          <div class="ass-box">
            <div>${nomeEmpresa}</div>
            <div style="font-size:9px;color:#888">Credor / Contratado</div>
          </div>
          <div class="ass-box">
            <div>${row.clienteNome}</div>
            <div style="font-size:9px;color:#888">Devedor / Contratante</div>
          </div>
        </div>
        <div class="rodape">
          Documento gerado em ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR")} \u2014 CobraPro Sistema de Gest\xE3o Financeira
        </div>
        </body></html>`;
    return { html, contratoId: c.id, clienteNome: row.clienteNome };
  }),
  deletar: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const parcelasNaoPagas = await db.select().from(parcelas).where(
          and3(eq5(parcelas.contratoId, input.id), ne(parcelas.status, "paga"))
        );
        if (parcelasNaoPagas.length > 0) {
          throw new TRPCError9({ code: "CONFLICT", message: `Nao eh possivel deletar contrato com ${parcelasNaoPagas.length} parcela(s) nao paga(s).` });
        }
        await db.delete(contratos).where(eq5(contratos.id, input.id));
        await db.delete(parcelas).where(eq5(parcelas.contratoId, input.id));
        return { success: true };
      } catch (err) {
        if (err?.code === "CONFLICT") throw err;
        console.warn("[contratos.deletar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: pNaoPagas } = await supabase.from("parcelas").select("id").eq("contrato_id", input.id).neq("status", "paga");
    if (pNaoPagas && pNaoPagas.length > 0) {
      throw new TRPCError9({ code: "CONFLICT", message: `Nao eh possivel deletar contrato com ${pNaoPagas.length} parcela(s) nao paga(s).` });
    }
    await supabase.from("parcelas").delete().eq("contrato_id", input.id);
    const { error } = await supabase.from("contratos").delete().eq("id", input.id).eq("user_id", ctx.user.id);
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),
  pagarTotal: protectedProcedure.input(z9.object({ id: z9.number(), valor: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(contratos).set({ status: "quitado" }).where(and3(eq5(contratos.id, input.id), eq5(contratos.userId, ctx.user.id)));
        await db.update(parcelas).set({ status: "paga", dataPagamento: /* @__PURE__ */ new Date() }).where(eq5(parcelas.contratoId, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[contratos.pagarTotal] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("contratos").update({ status: "quitado" }).eq("id", input.id).eq("user_id", ctx.user.id);
    await supabase.from("parcelas").update({ status: "paga", data_pagamento: (/* @__PURE__ */ new Date()).toISOString() }).eq("contrato_id", input.id);
    return { success: true };
  }),
  editarJuros: protectedProcedure.input(z9.object({ id: z9.number(), novaTaxa: z9.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(contratos).set({ taxaJuros: input.novaTaxa }).where(and3(eq5(contratos.id, input.id), eq5(contratos.userId, ctx.user.id)));
        return { success: true };
      } catch (err) {
        console.warn("[contratos.editarJuros] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { error } = await supabase.from("contratos").update({ taxa_juros: input.novaTaxa }).eq("id", input.id).eq("user_id", ctx.user.id);
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),
  aplicarMulta: protectedProcedure.input(z9.object({ id: z9.number(), multa: z9.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const hoje = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (db) {
      try {
        const parcelasAtraso = await db.select().from(parcelas).where(and3(
          eq5(parcelas.contratoId, input.id),
          eq5(parcelas.status, "pendente"),
          lt(sql3`DATE(${parcelas.dataVencimento})`, hoje)
        ));
        for (const parcela of parcelasAtraso) {
          const multaAtual = parcela.valorMulta ? parseFloat(parcela.valorMulta) : 0;
          await db.update(parcelas).set({ valorMulta: (multaAtual + parseFloat(input.multa)).toString() }).where(eq5(parcelas.id, parcela.id));
        }
        return { success: true };
      } catch (err) {
        console.warn("[contratos.aplicarMulta] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: pAtraso } = await supabase.from("parcelas").select("id, valor_multa").eq("contrato_id", input.id).eq("status", "pendente").lt("data_vencimento", hoje);
    for (const parcela of pAtraso ?? []) {
      const multaAtual = parcela.valor_multa ? parseFloat(parcela.valor_multa) : 0;
      await supabase.from("parcelas").update({ valor_multa: (multaAtual + parseFloat(input.multa)).toString() }).eq("id", parcela.id);
    }
    return { success: true };
  })
});
var parcelasRouter = router({
  list: protectedProcedure.input(z9.object({
    status: z9.string().optional(),
    clienteId: z9.number().optional(),
    contratoId: z9.number().optional(),
    dataInicio: z9.string().optional(),
    dataFim: z9.string().optional(),
    modalidade: z9.string().optional()
  }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    const hoje = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (db) {
      try {
        await db.update(parcelas).set({ status: "atrasada" }).where(and3(
          lt(sql3`DATE(data_vencimento)`, hoje),
          inArray(parcelas.status, ["pendente", "vencendo_hoje"])
        ));
        await db.update(parcelas).set({ status: "vencendo_hoje" }).where(and3(
          eq5(sql3`DATE(data_vencimento)`, hoje),
          eq5(parcelas.status, "pendente")
        ));
        const rows = await db.select({
          id: parcelas.id,
          contratoId: parcelas.contratoId,
          clienteId: parcelas.clienteId,
          clienteNome: clientes.nome,
          clienteWhatsapp: clientes.whatsapp,
          clienteChavePix: clientes.chavePix,
          numeroParcela: parcelas.numeroParcela,
          valorOriginal: parcelas.valorOriginal,
          valorPago: parcelas.valorPago,
          valorJuros: parcelas.valorJuros,
          valorMulta: parcelas.valorMulta,
          dataVencimento: parcelas.dataVencimento,
          dataPagamento: parcelas.dataPagamento,
          status: parcelas.status,
          modalidade: contratos.modalidade,
          numeroParcelas: contratos.numeroParcelas,
          taxaJuros: contratos.taxaJuros,
          tipoTaxa: contratos.tipoTaxa,
          valorPrincipal: contratos.valorPrincipal,
          koletorId: contratos.koletorId
        }).from(parcelas).innerJoin(clientes, eq5(parcelas.clienteId, clientes.id)).innerJoin(contratos, eq5(parcelas.contratoId, contratos.id)).orderBy(parcelas.dataVencimento);
        let myKoletorId2 = null;
        try {
          const supabaseForPerfil = await getSupabaseClientAsync();
          if (supabaseForPerfil) {
            const { data: koletorData } = await supabaseForPerfil.from("koletores").select("id, perfil").eq("user_id", ctx.user.id).single();
            if (koletorData?.perfil === "koletor") myKoletorId2 = koletorData.id;
          }
        } catch (_) {
        }
        return rows.filter((r) => {
          if (myKoletorId2 !== null) {
            const contratoDoKoletor = rows.some((row) => row.contratoId === r.contratoId && row.koletorId === myKoletorId2);
            if (!contratoDoKoletor) return false;
          }
          if (input?.status && r.status !== input.status) return false;
          if (input?.clienteId && r.clienteId !== input.clienteId) return false;
          if (input?.contratoId && r.contratoId !== input.contratoId) return false;
          if (input?.modalidade && r.modalidade !== input.modalidade) return false;
          return true;
        });
      } catch (err) {
        console.warn("[parcelas.list] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    let myKoletorId = null;
    try {
      const { data: koletorData } = await supabase.from("koletores").select("id, perfil").eq("user_id", ctx.user.id).single();
      if (koletorData?.perfil === "koletor") myKoletorId = koletorData.id;
    } catch (_) {
    }
    await supabase.from("parcelas").update({ status: "atrasada" }).lt("data_vencimento", hoje).in("status", ["pendente", "vencendo_hoje"]);
    await supabase.from("parcelas").update({ status: "vencendo_hoje" }).eq("data_vencimento", hoje).eq("status", "pendente");
    let pQuery = supabase.from("parcelas").select("id, contrato_id, cliente_id, numero_parcela, valor_original, valor_pago, valor_juros, valor_multa, data_vencimento, data_pagamento, status, contratos(koletor_id)").order("data_vencimento").eq("user_id", ctx.user.id);
    if (input?.status) pQuery = pQuery.eq("status", input.status);
    if (input?.clienteId) pQuery = pQuery.eq("cliente_id", input.clienteId);
    if (input?.contratoId) pQuery = pQuery.eq("contrato_id", input.contratoId);
    if (myKoletorId !== null) pQuery = pQuery.eq("contratos.koletor_id", myKoletorId);
    const { data: pData, error: pError } = await pQuery;
    if (pError) {
      console.error("[parcelas.list] REST error:", pError.message);
      return [];
    }
    const parcelasData = (pData || []).filter((p) => {
      if (myKoletorId !== null && p.contratos?.koletor_id !== myKoletorId) return false;
      return true;
    });
    const clienteIds = Array.from(new Set(parcelasData.map((r) => r.cliente_id).filter(Boolean)));
    const contratoIds = Array.from(new Set(parcelasData.map((r) => r.contrato_id).filter(Boolean)));
    const clientesMap = {};
    const contratosMap = {};
    if (clienteIds.length > 0) {
      const { data: cData } = await supabase.from("clientes").select("id, nome, whatsapp, chave_pix").in("id", clienteIds);
      (cData || []).forEach((c) => {
        clientesMap[c.id] = c;
      });
    }
    if (contratoIds.length > 0) {
      const { data: ctData } = await supabase.from("contratos").select("id, modalidade, numero_parcelas, taxa_juros, tipo_taxa, valor_principal").in("id", contratoIds);
      (ctData || []).forEach((c) => {
        contratosMap[c.id] = c;
      });
    }
    const resultData = input?.modalidade ? parcelasData.filter((r) => contratosMap[r.contrato_id]?.modalidade === input.modalidade) : parcelasData;
    return resultData.map((r) => ({
      id: r.id,
      contratoId: r.contrato_id,
      clienteId: r.cliente_id,
      clienteNome: clientesMap[r.cliente_id]?.nome ?? "",
      clienteWhatsapp: clientesMap[r.cliente_id]?.whatsapp ?? null,
      clienteChavePix: clientesMap[r.cliente_id]?.chave_pix ?? null,
      numeroParcela: r.numero_parcela,
      valorOriginal: r.valor_original,
      valorPago: r.valor_pago,
      valorJuros: r.valor_juros,
      valorMulta: r.valor_multa,
      dataVencimento: r.data_vencimento,
      dataPagamento: r.data_pagamento,
      status: r.status,
      modalidade: contratosMap[r.contrato_id]?.modalidade ?? null,
      numeroParcelas: contratosMap[r.contrato_id]?.numero_parcelas ?? null,
      taxaJuros: contratosMap[r.contrato_id]?.taxa_juros ?? null,
      tipoTaxa: contratosMap[r.contrato_id]?.tipo_taxa ?? null,
      valorPrincipal: contratosMap[r.contrato_id]?.valor_principal ?? null
    }));
  }),
  registrarPagamento: protectedProcedure.input(z9.object({
    parcelaId: z9.number(),
    valorPago: z9.number().positive(),
    contaCaixaId: z9.number().optional(),
    observacoes: z9.string().optional(),
    desconto: z9.number().default(0)
  })).mutation(async ({ input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel" });
    const { data: parcelaData, error: parcelaErr } = await sb2.from("parcelas").select("*").eq("id", input.parcelaId).single();
    if (parcelaErr || !parcelaData) throw new TRPCError9({ code: "NOT_FOUND", message: "Parcela n\xE3o encontrada" });
    const parcela = {
      id: parcelaData.id,
      contratoId: parcelaData.contrato_id,
      clienteId: parcelaData.cliente_id,
      numeroParcela: parcelaData.numero_parcela,
      valorOriginal: parcelaData.valor_original,
      dataVencimento: parcelaData.data_vencimento
    };
    const { juros, multa } = calcularJurosMora(
      parseFloat(parcela.valorOriginal),
      /* @__PURE__ */ new Date(parcela.dataVencimento + "T00:00:00"),
      /* @__PURE__ */ new Date()
    );
    const valorOriginal = parseFloat(parcela.valorOriginal);
    const novoStatus = input.valorPago >= valorOriginal ? "paga" : "parcial";
    const { error: updateErr } = await sb2.from("parcelas").update({
      valor_pago: input.valorPago.toFixed(2),
      valor_juros: juros.toFixed(2),
      valor_multa: multa.toFixed(2),
      valor_desconto: input.desconto.toFixed(2),
      data_pagamento: (/* @__PURE__ */ new Date()).toISOString(),
      status: novoStatus,
      conta_caixa_id: input.contaCaixaId ?? null,
      observacoes: input.observacoes ?? null
    }).eq("id", input.parcelaId);
    if (updateErr) console.error("[registrarPagamento] Update parcela error:", updateErr.message);
    if (input.contaCaixaId) {
      const { error: txErr } = await sb2.from("transacoes_caixa").insert({
        conta_caixa_id: input.contaCaixaId,
        tipo: "entrada",
        categoria: "pagamento_parcela",
        valor: input.valorPago.toFixed(2),
        descricao: `Pagamento parcela #${parcela.numeroParcela} - Contrato #${parcela.contratoId}`,
        parcela_id: input.parcelaId,
        contrato_id: parcela.contratoId,
        data_transacao: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      });
      if (txErr) console.error("[registrarPagamento] Insert transacao error:", txErr.message);
    }
    const { data: pendentes } = await sb2.from("parcelas").select("id").eq("contrato_id", parcela.contratoId).in("status", ["pendente", "atrasada", "vencendo_hoje", "parcial"]);
    if ((pendentes?.length ?? 0) === 0) {
      await sb2.from("contratos").update({ status: "quitado" }).eq("id", parcela.contratoId);
    }
    return { success: true, status: novoStatus };
  }),
  // Pagar apenas os juros do período e renovar a parcela por mais um período
  pagarJuros: protectedProcedure.input(z9.object({
    parcelaId: z9.number(),
    valorJurosPago: z9.number().positive(),
    contaCaixaId: z9.number().optional(),
    observacoes: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const fetchParcela = async () => {
      if (db) {
        const rows = await db.select().from(parcelas).where(eq5(parcelas.id, input.parcelaId)).limit(1);
        return rows[0] ?? null;
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return null;
      const { data } = await supabase.from("parcelas").select("*").eq("id", input.parcelaId).single();
      return data ? {
        id: data.id,
        contratoId: data.contrato_id,
        clienteId: data.cliente_id,
        numeroParcela: data.numero_parcela,
        valorOriginal: data.valor_original,
        dataVencimento: data.data_vencimento,
        status: data.status,
        contaCaixaId: data.conta_caixa_id,
        koletorId: data.koletor_id
      } : null;
    };
    const parcela = await fetchParcela();
    if (!parcela) throw new TRPCError9({ code: "NOT_FOUND", message: "Parcela n\xE3o encontrada" });
    const fetchContrato = async () => {
      if (db) {
        const rows = await db.select().from(contratos).where(eq5(contratos.id, parcela.contratoId)).limit(1);
        return rows[0] ?? null;
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return null;
      const { data } = await supabase.from("contratos").select("*").eq("id", parcela.contratoId).single();
      return data ? {
        id: data.id,
        modalidade: data.modalidade,
        tipoTaxa: data.tipo_taxa,
        taxaJuros: data.taxa_juros,
        valorPrincipal: data.valor_principal,
        numeroParcelas: data.numero_parcelas,
        clienteId: data.cliente_id,
        koletorId: data.koletor_id,
        contaCaixaId: data.conta_caixa_id,
        multaAtraso: data.multa_atraso,
        jurosMoraDiario: data.juros_mora_diario
      } : null;
    };
    const contrato = await fetchContrato();
    if (!contrato) throw new TRPCError9({ code: "NOT_FOUND", message: "Contrato n\xE3o encontrado" });
    const diasIntervalo = getDiasModalidade(contrato.tipoTaxa ?? contrato.modalidade);
    const dataVencAtual = /* @__PURE__ */ new Date(String(parcela.dataVencimento) + "T00:00:00");
    const novaDataVenc = new Date(dataVencAtual);
    novaDataVenc.setDate(novaDataVenc.getDate() + diasIntervalo);
    const novaDataVencStr = novaDataVenc.toISOString().split("T")[0];
    const hoje = /* @__PURE__ */ new Date();
    if (db) {
      await db.update(parcelas).set({
        valorPago: input.valorJurosPago.toFixed(2),
        dataPagamento: hoje,
        status: "paga",
        observacoes: input.observacoes ?? "Pagamento de juros - renovado",
        contaCaixaId: input.contaCaixaId ?? null
      }).where(eq5(parcelas.id, input.parcelaId));
      if (input.contaCaixaId) {
        await db.insert(transacoesCaixa).values({
          contaCaixaId: input.contaCaixaId,
          tipo: "entrada",
          categoria: "pagamento_parcela",
          valor: input.valorJurosPago.toFixed(2),
          descricao: `Juros pagos - Parcela #${parcela.numeroParcela} renovada - Contrato #${parcela.contratoId}`,
          parcelaId: input.parcelaId,
          contratoId: parcela.contratoId,
          clienteId: parcela.clienteId
        });
      }
      await db.insert(parcelas).values({
        contratoId: parcela.contratoId,
        clienteId: parcela.clienteId,
        koletorId: parcela.koletorId ?? void 0,
        numeroParcela: parcela.numeroParcela + 1,
        valorOriginal: String(parcela.valorOriginal),
        dataVencimento: novaDataVencStr,
        status: "pendente",
        contaCaixaId: input.contaCaixaId ?? null
      });
      await db.update(contratos).set({ numeroParcelas: sql3`numero_parcelas + 1` }).where(eq5(contratos.id, parcela.contratoId));
    } else {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await supabase.from("parcelas").update({
        valor_pago: parseFloat(input.valorJurosPago.toFixed(2)),
        data_pagamento: hoje.toISOString(),
        status: "paga",
        observacoes: input.observacoes ?? "Pagamento de juros - renovado",
        conta_caixa_id: input.contaCaixaId
      }).eq("id", input.parcelaId);
      await supabase.from("transacoes_caixa").insert({
        conta_caixa_id: input.contaCaixaId,
        tipo: "entrada",
        categoria: "pagamento_parcela",
        valor: parseFloat(input.valorJurosPago.toFixed(2)),
        descricao: `Juros pagos - Parcela #${parcela.numeroParcela} renovada - Contrato #${parcela.contratoId}`,
        parcela_id: input.parcelaId,
        contrato_id: parcela.contratoId,
        data_transacao: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      });
      const novoNumero = parcela.numeroParcela + 1;
      const novoValor = parseFloat(String(parcela.valorOriginal));
      await supabase.from("parcelas").insert({
        contrato_id: parcela.contratoId,
        koletor_id: parcela.koletorId ?? null,
        numero: novoNumero,
        numero_parcela: novoNumero,
        valor: novoValor,
        valor_original: novoValor,
        data_vencimento: novaDataVencStr,
        status: "pendente",
        conta_caixa_id: input.contaCaixaId
      });
      await supabase.from("contratos").update({ numero_parcelas: contrato.numeroParcelas + 1 }).eq("id", parcela.contratoId);
    }
    return { success: true, novaDataVencimento: novaDataVencStr };
  })
});
var caixaRouter = router({
  contas: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        const contas = await db.select().from(contasCaixa).where(and3(eq5(contasCaixa.ativa, true), eq5(contasCaixa.userId, ctx.user.id)));
        const result = [];
        for (const conta of contas) {
          const entradas = await db.select({ total: sql3`COALESCE(SUM(valor), 0)` }).from(transacoesCaixa).where(and3(eq5(transacoesCaixa.contaCaixaId, conta.id), eq5(transacoesCaixa.tipo, "entrada")));
          const saidas = await db.select({ total: sql3`COALESCE(SUM(valor), 0)` }).from(transacoesCaixa).where(and3(eq5(transacoesCaixa.contaCaixaId, conta.id), eq5(transacoesCaixa.tipo, "saida")));
          const saldo = parseFloat(conta.saldoInicial) + parseFloat(entradas[0]?.total ?? "0") - parseFloat(saidas[0]?.total ?? "0");
          result.push({ ...conta, saldoAtual: saldo });
        }
        return result;
      } catch (err) {
        console.warn("[caixa.contas] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data: contasData } = await supabase.from("contas_caixa").select("*").eq("ativo", true).eq("user_id", ctx.user.id);
    const { data: transData } = await supabase.from("transacoes_caixa").select("conta_caixa_id, tipo, valor");
    const result2 = [];
    for (const conta of contasData || []) {
      const transacoesConta = (transData ?? []).filter((t2) => t2.conta_caixa_id === conta.id);
      const totalEntradas = transacoesConta.filter((t2) => t2.tipo === "entrada").reduce((s, t2) => s + parseFloat(t2.valor ?? "0"), 0);
      const totalSaidas = transacoesConta.filter((t2) => t2.tipo === "saida").reduce((s, t2) => s + parseFloat(t2.valor ?? "0"), 0);
      const saldoAtual = parseFloat(conta.saldo ?? "0") + totalEntradas - totalSaidas;
      result2.push({
        id: conta.id,
        nome: conta.nome,
        tipo: conta.tipo,
        banco: conta.banco ?? null,
        saldoInicial: parseFloat(conta.saldo ?? "0"),
        saldoAtual,
        ativa: conta.ativo
      });
    }
    return result2;
  }),
  transacoes: protectedProcedure.input(z9.object({ contaCaixaId: z9.number().optional(), limit: z9.number().default(50) }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select({
          id: transacoesCaixa.id,
          contaCaixaId: transacoesCaixa.contaCaixaId,
          contaNome: contasCaixa.nome,
          tipo: transacoesCaixa.tipo,
          categoria: transacoesCaixa.categoria,
          valor: transacoesCaixa.valor,
          descricao: transacoesCaixa.descricao,
          clienteNome: clientes.nome,
          dataTransacao: transacoesCaixa.dataTransacao
        }).from(transacoesCaixa).innerJoin(contasCaixa, eq5(transacoesCaixa.contaCaixaId, contasCaixa.id)).leftJoin(clientes, eq5(transacoesCaixa.clienteId, clientes.id)).where(and3(eq5(transacoesCaixa.userId, ctx.user.id), input?.contaCaixaId ? eq5(transacoesCaixa.contaCaixaId, input.contaCaixaId) : void 0)).orderBy(desc2(transacoesCaixa.dataTransacao)).limit(input?.limit ?? 50);
        return rows;
      } catch (err) {
        console.warn("[caixa.transacoes] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    let txQuery = supabase.from("transacoes_caixa").select("id, conta_caixa_id, tipo, categoria, valor, descricao, data_transacao").order("data_transacao", { ascending: false }).limit(input?.limit ?? 50).eq("user_id", ctx.user.id);
    if (input?.contaCaixaId) txQuery = txQuery.eq("conta_caixa_id", input.contaCaixaId);
    const { data: txData, error: txQueryErr } = await txQuery;
    if (txQueryErr) {
      console.error("[caixa.transacoes] REST error:", txQueryErr.message);
      return [];
    }
    const contaIdsSet = new Set((txData ?? []).map((t2) => t2.conta_caixa_id).filter(Boolean));
    const contaIds = Array.from(contaIdsSet);
    const { data: contasData } = contaIds.length > 0 ? await supabase.from("contas_caixa").select("id, nome").in("id", contaIds) : { data: [] };
    const contasMap = Object.fromEntries((contasData ?? []).map((c) => [c.id, c.nome]));
    return (txData ?? []).map((t2) => ({
      id: t2.id,
      contaCaixaId: t2.conta_caixa_id,
      contaNome: contasMap[t2.conta_caixa_id] ?? "",
      tipo: t2.tipo,
      categoria: t2.categoria,
      valor: t2.valor,
      descricao: t2.descricao,
      clienteNome: null,
      dataTransacao: t2.data_transacao
    }));
  }),
  criarConta: protectedProcedure.input(z9.object({
    nome: z9.string().min(2),
    tipo: z9.enum(["caixa", "banco", "digital"]),
    banco: z9.string().optional(),
    saldoInicial: z9.number().default(0)
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const result = await db.insert(contasCaixa).values({
          nome: input.nome,
          tipo: input.tipo,
          banco: input.banco,
          saldoInicial: input.saldoInicial.toFixed(2),
          userId: ctx.user.id
        }).returning({ id: contasCaixa.id });
        return { id: result[0].id };
      } catch (err) {
        console.warn("[caixa.criarConta] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new Error("DB unavailable");
    const { data, error } = await supabase.from("contas_caixa").insert({
      nome: input.nome,
      tipo: input.tipo,
      saldo: input.saldoInicial,
      user_id: ctx.user.id
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  }),
  registrarTransacao: protectedProcedure.input(z9.object({
    contaCaixaId: z9.number(),
    tipo: z9.enum(["entrada", "saida"]),
    categoria: z9.enum(["pagamento_parcela", "emprestimo_liberado", "despesa_operacional", "transferencia_conta", "ajuste_manual", "outros"]),
    valor: z9.number().positive(),
    descricao: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.insert(transacoesCaixa).values({
          contaCaixaId: input.contaCaixaId,
          tipo: input.tipo,
          categoria: input.categoria,
          valor: input.valor.toFixed(2),
          descricao: input.descricao,
          userId: ctx.user.id
        });
        const delta2 = input.tipo === "entrada" ? input.valor : -input.valor;
        await db.execute(sql3`UPDATE contas_caixa SET saldo_inicial = COALESCE(saldo_inicial::numeric, 0) + ${delta2} WHERE id = ${input.contaCaixaId}`);
        return { success: true };
      } catch (err) {
        console.warn("[caixa.registrarTransacao] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new Error("DB unavailable");
    const { error: txErr } = await supabase.from("transacoes_caixa").insert({
      conta_caixa_id: input.contaCaixaId,
      tipo: input.tipo,
      categoria: input.categoria,
      valor: input.valor,
      descricao: input.descricao ?? null,
      data_transacao: (/* @__PURE__ */ new Date()).toISOString(),
      user_id: ctx.user.id
    });
    if (txErr) throw new Error(txErr.message);
    const delta = input.tipo === "entrada" ? input.valor : -input.valor;
    const { data: contaData } = await supabase.from("contas_caixa").select("saldo").eq("id", input.contaCaixaId).single();
    if (contaData) {
      const novoSaldo = parseFloat(contaData.saldo ?? "0") + delta;
      await supabase.from("contas_caixa").update({ saldo: novoSaldo }).eq("id", input.contaCaixaId);
    }
    return { success: true };
  })
});
var portalRouter = router({
  gerarLink: protectedProcedure.input(z9.object({ clienteId: z9.number(), origin: z9.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const token = nanoid(48);
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    if (db) {
      try {
        await db.insert(magicLinks).values({ clienteId: input.clienteId, token, expiresAt });
        return { url: `${input.origin}/portal/${token}`, token };
      } catch (err) {
        console.warn("[portal.gerarLink] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { error } = await supabase.from("magic_links").insert({
      cliente_id: input.clienteId,
      token,
      expires_at: expiresAt.toISOString()
    });
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { url: `${input.origin}/portal/${token}`, token };
  }),
  acessar: publicProcedure.input(z9.object({ token: z9.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (db) {
      try {
        const links = await db.select().from(magicLinks).where(eq5(magicLinks.token, input.token)).limit(1);
        const link = links[0];
        if (!link) throw new Error("Link inv\xE1lido");
        if (link.usado) throw new Error("Link j\xE1 utilizado");
        if (/* @__PURE__ */ new Date() > link.expiresAt) throw new Error("Link expirado");
        const clienteRows = await db.select().from(clientes).where(eq5(clientes.id, link.clienteId)).limit(1);
        const cliente = clienteRows[0];
        if (!cliente) throw new Error("Cliente n\xE3o encontrado");
        const parcelasCliente = await db.select().from(parcelas).where(and3(eq5(parcelas.clienteId, link.clienteId), inArray(parcelas.status, ["pendente", "atrasada", "vencendo_hoje", "parcial"]))).orderBy(parcelas.dataVencimento).limit(10);
        return { cliente: { nome: cliente.nome, chavePix: cliente.chavePix, tipoChavePix: cliente.tipoChavePix }, parcelas: parcelasCliente };
      } catch (err) {
        if (["Link inv\xE1lido", "Link j\xE1 utilizado", "Link expirado", "Cliente n\xE3o encontrado"].includes(err.message)) throw err;
        console.warn("[portal.acessar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new Error("DB unavailable");
    const { data: linkData } = await supabase.from("magic_links").select("*").eq("token", input.token).single();
    if (!linkData) throw new Error("Link inv\xE1lido");
    if (linkData.usado) throw new Error("Link j\xE1 utilizado");
    if (/* @__PURE__ */ new Date() > new Date(linkData.expires_at)) throw new Error("Link expirado");
    const { data: cliData } = await supabase.from("clientes").select("nome, chave_pix, tipo_chave_pix").eq("id", linkData.cliente_id).single();
    if (!cliData) throw new Error("Cliente n\xE3o encontrado");
    const { data: pData } = await supabase.from("parcelas").select("*").eq("cliente_id", linkData.cliente_id).in("status", ["pendente", "atrasada", "vencendo_hoje", "parcial"]).order("data_vencimento").limit(10);
    return { cliente: { nome: cliData.nome, chavePix: cliData.chave_pix, tipoChavePix: cliData.tipo_chave_pix }, parcelas: pData ?? [] };
  })
});
function aplicarVariaveisTemplate(template, vars) {
  let msg = template;
  for (const [key, val] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{${key}\\}`, "g"), val);
    msg = msg.replace(new RegExp(`\\{\\{${key.toLowerCase()}\\}\\}`, "g"), val);
  }
  return msg;
}
var whatsappRouter = router({
  templates: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from("templates_whatsapp").select("*").eq("ativo", true);
    return (data ?? []).map((r) => ({ ...r, ativo: r.ativo }));
  }),
  // Gerar mensagem a partir de contrato (para botão Cobrar no card de empréstimo)
  gerarMensagemContrato: protectedProcedure.input(z9.object({
    contratoId: z9.number(),
    tipo: z9.enum(["atraso", "preventivo", "vence_hoje"]).default("atraso")
  })).query(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new Error("DB unavailable");
    const { data: configRows } = await supabase.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id);
    const cfg = {};
    for (const r of configRows ?? []) cfg[r.chave] = r.valor ?? "";
    const pixEmpresa = cfg["pixKey"] ?? cfg["pix_key"] ?? cfg["chave_pix"] ?? "";
    const assinatura = cfg["assinaturaWhatsapp"] ?? cfg["assinatura_whatsapp"] ?? "";
    const fechamento = cfg["fechamentoWhatsapp"] ?? cfg["fechamento_whatsapp"] ?? "";
    const linkPagamento = cfg["linkPagamento"] ?? cfg["link_pagamento"] ?? "";
    const tipoTemplate = input.tipo === "atraso" ? "cobranca" : "lembrete";
    const { data: templates } = await supabase.from("templates_whatsapp").select("*").eq("ativo", true).eq("tipo", tipoTemplate).limit(1);
    const { data: contrato } = await supabase.from("contratos").select("*, clientes(nome, whatsapp, telefone, chave_pix)").eq("id", input.contratoId).single();
    if (!contrato) throw new Error("Contrato n\xE3o encontrado");
    const { data: parcelasArr } = await supabase.from("parcelas").select("*").eq("contrato_id", input.contratoId).order("numero_parcela", { ascending: true });
    const hoje = /* @__PURE__ */ new Date();
    const parcelasAtraso = (parcelasArr ?? []).filter((p) => {
      const venc = /* @__PURE__ */ new Date(p.data_vencimento + "T00:00:00");
      return p.status !== "paga" && venc < hoje;
    });
    const proximaParcela = (parcelasArr ?? []).find((p) => p.status !== "paga");
    const parcelaRef = parcelasAtraso[0] ?? proximaParcela;
    const diasAtraso = parcelaRef ? Math.max(0, Math.floor((hoje.getTime() - (/* @__PURE__ */ new Date(parcelaRef.data_vencimento + "T00:00:00")).getTime()) / 864e5)) : 0;
    const diasParaVencer = parcelaRef && diasAtraso === 0 ? Math.max(0, Math.floor(((/* @__PURE__ */ new Date(parcelaRef.data_vencimento + "T00:00:00")).getTime() - hoje.getTime()) / 864e5)) : 0;
    const totalParcelas = contrato.numero_parcelas ?? (parcelasArr ?? []).length;
    const parcelaNum = parcelaRef?.numero_parcela ?? 1;
    const valorOriginal = parseFloat(parcelaRef?.valor_original ?? contrato.valor_parcela ?? "0");
    const { juros, multa, total } = calcularJurosMora(valorOriginal, parcelaRef ? /* @__PURE__ */ new Date(parcelaRef.data_vencimento + "T00:00:00") : hoje, hoje);
    const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dataVenc = parcelaRef ? (/* @__PURE__ */ new Date(parcelaRef.data_vencimento + "T00:00:00")).toLocaleDateString("pt-BR") : "";
    const clienteNome = contrato.clientes?.nome ?? "";
    const clienteWhatsapp = contrato.clientes?.whatsapp ?? contrato.clientes?.telefone ?? null;
    const clienteChavePix = contrato.clientes?.chave_pix ?? pixEmpresa;
    const pagas = (parcelasArr ?? []).filter((p) => p.status === "paga").length;
    const progressoBar = `${pagas}/${totalParcelas} parcelas pagas`;
    const parcelasStatus = (parcelasArr ?? []).slice(0, 6).map((p) => {
      const v = /* @__PURE__ */ new Date(p.data_vencimento + "T00:00:00");
      const emoji = p.status === "paga" ? "\u2705" : v < hoje ? "\u{1F534}" : "\u{1F7E1}";
      return `${emoji} Parcela ${p.numero_parcela}/${totalParcelas} \u2014 ${fmt(parseFloat(p.valor_original ?? "0"))} \u2014 ${(/* @__PURE__ */ new Date(p.data_vencimento + "T00:00:00")).toLocaleDateString("pt-BR")}`;
    }).join("\n");
    const blocoMulta = multa > 0 ? `\u{1F4B8} *Multa:* ${fmt(multa)}
` : "";
    const blocoJuros = juros > 0 ? `\u{1F4C8} *Juros:* ${fmt(juros)}
` : "";
    const blocoTotal = multa > 0 || juros > 0 ? `\u{1F4B0} *Total com Juros:* ${fmt(total)}
` : "";
    const blocoPix = clienteChavePix ? `
\u{1F4B3} *PIX:* ${clienteChavePix}
` : "";
    const blocoLink = linkPagamento ? `\u{1F517} *Link:* ${linkPagamento}
` : "";
    const templatePadrao = input.tipo === "atraso" ? `\u26A0\uFE0F *Aten\xE7\xE3o {CLIENTE}* \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F6A8} *PARCELA EM ATRASO*
\u{1F4B5} *Valor:* {VALOR}
\u{1F4CA} *{PARCELA}*
\u{1F4C5} *Vencimento:* {DATA}
\u23F0 *Dias em Atraso:* {DIAS_ATRASO}
{MULTA}{JUROS}{TOTAL}{PROGRESSO}
{PIX}{LINK}{FECHAMENTO}
{ASSINATURA}` : `\u{1F7E2} *Ol\xE1 {CLIENTE}!* \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4CB} *LEMBRETE DE PARCELA*
\u{1F4B5} *Valor:* {VALOR}
\u{1F4CA} *{PARCELA}*
\u{1F4C5} *Vencimento:* {DATA}
\u23F3 *Faltam:* {DIAS_PARA_VENCER} dias
{PROGRESSO}
{PIX}{LINK}{FECHAMENTO}
{ASSINATURA}`;
    const templateMsg = templates?.[0]?.mensagem ?? templatePadrao;
    const vars = {
      CLIENTE: clienteNome,
      nome: clienteNome,
      VALOR: fmt(valorOriginal),
      valor: fmt(valorOriginal),
      PARCELA: `Parcela ${parcelaNum}/${totalParcelas}`,
      DATA: dataVenc,
      vencimento: dataVenc,
      DIAS_ATRASO: String(diasAtraso),
      DIAS_PARA_VENCER: String(diasParaVencer),
      JUROS_CONTRATO: `${contrato.taxa_juros}%`,
      MULTA: blocoMulta,
      JUROS: blocoJuros,
      JUROS_MULTA: multa + juros > 0 ? `\u{1F4B8} *Juros+Multa:* ${fmt(multa + juros)}
` : "",
      TOTAL: blocoTotal,
      PROGRESSO: progressoBar,
      PARCELAS_STATUS: parcelasStatus,
      PIX: blocoPix,
      chave_pix: clienteChavePix ?? "",
      LINK: blocoLink,
      ASSINATURA: assinatura ? `
${assinatura}` : "",
      FECHAMENTO: fechamento ? `${fechamento}
` : ""
    };
    const mensagem = aplicarVariaveisTemplate(templateMsg, vars);
    const whatsappUrl = clienteWhatsapp ? `https://wa.me/55${clienteWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}` : null;
    return { mensagem, whatsappUrl, whatsapp: clienteWhatsapp, clienteNome };
  }),
  // Gerar mensagem por parcela (legado)
  gerarMensagem: protectedProcedure.input(z9.object({
    templateId: z9.number(),
    parcelaId: z9.number()
  })).query(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new Error("DB unavailable");
    const { data: templateData } = await supabase.from("templates_whatsapp").select("*").eq("id", input.templateId).single();
    if (!templateData) throw new Error("Template n\xE3o encontrado");
    const { data: parcelaData } = await supabase.from("parcelas").select("*, clientes(nome, whatsapp, chave_pix), contratos(numero_parcelas)").eq("id", input.parcelaId).single();
    if (!parcelaData) throw new Error("Parcela n\xE3o encontrada");
    const { total, juros, multa } = calcularJurosMora(
      parseFloat(parcelaData.valor_original),
      /* @__PURE__ */ new Date(parcelaData.data_vencimento + "T00:00:00"),
      /* @__PURE__ */ new Date()
    );
    const dataFormatada = (/* @__PURE__ */ new Date(parcelaData.data_vencimento + "T00:00:00")).toLocaleDateString("pt-BR");
    const fmt2 = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const clienteNome = parcelaData.clientes?.nome ?? "";
    const clienteWhatsapp = parcelaData.clientes?.whatsapp ?? null;
    const clienteChavePix = parcelaData.clientes?.chave_pix ?? null;
    const vars2 = {
      CLIENTE: clienteNome,
      nome: clienteNome,
      VALOR: fmt2(parseFloat(parcelaData.valor_original)),
      valor: fmt2(parseFloat(parcelaData.valor_original)),
      valor_atualizado: fmt2(total),
      DATA: dataFormatada,
      vencimento: dataFormatada,
      data_vencimento: dataFormatada,
      PIX: clienteChavePix ? `\u{1F4B3} *PIX:* ${clienteChavePix}
` : "",
      chave_pix: clienteChavePix ?? "Consulte o credor",
      MULTA: multa > 0 ? `\u{1F4B8} *Multa:* ${fmt2(multa)}
` : "",
      JUROS: juros > 0 ? `\u{1F4C8} *Juros:* ${fmt2(juros)}
` : "",
      TOTAL: multa + juros > 0 ? `\u{1F4B0} *Total:* ${fmt2(total)}
` : "",
      numero_parcela: String(parcelaData.numero ?? parcelaData.numero_parcela ?? 1)
    };
    const mensagem = aplicarVariaveisTemplate(templateData.mensagem, vars2);
    const whatsappUrl = clienteWhatsapp ? `https://wa.me/55${clienteWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}` : null;
    return { mensagem, whatsappUrl, whatsapp: clienteWhatsapp };
  }),
  // Cobrança em lote
  cobrarLote: protectedProcedure.input(z9.object({
    contratoIds: z9.array(z9.number()),
    tipo: z9.enum(["atraso", "preventivo"]).default("atraso")
  })).mutation(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new Error("DB unavailable");
    const { data: configRows } = await supabase.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id);
    const cfg = {};
    for (const r of configRows ?? []) cfg[r.chave] = r.valor ?? "";
    const pixEmpresa = cfg["pixKey"] ?? cfg["pix_key"] ?? "";
    const assinatura = cfg["assinaturaWhatsapp"] ?? "";
    const resultados = [];
    for (const contratoId of input.contratoIds) {
      try {
        const { data: contrato } = await supabase.from("contratos").select("*, clientes(nome, whatsapp, telefone, chave_pix)").eq("id", contratoId).single();
        if (!contrato) {
          resultados.push({ contratoId, clienteNome: "", whatsappUrl: null, sucesso: false });
          continue;
        }
        const clienteNome = contrato.clientes?.nome ?? "";
        const clienteWhatsapp = contrato.clientes?.whatsapp ?? contrato.clientes?.telefone ?? null;
        const clienteChavePix = contrato.clientes?.chave_pix ?? pixEmpresa;
        const valorParcela = parseFloat(contrato.valor_parcela ?? "0");
        const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const msg = input.tipo === "atraso" ? `\u26A0\uFE0F *Aten\xE7\xE3o ${clienteNome}*
\u{1F6A8} Voc\xEA possui parcela(s) em atraso no valor de *${fmt(valorParcela)}*.
Por favor, regularize o quanto antes.${clienteChavePix ? `

\u{1F4B3} *PIX:* ${clienteChavePix}` : ""}${assinatura ? `

${assinatura}` : ""}` : `\u{1F7E2} *Ol\xE1 ${clienteNome}!*
\u{1F4CB} Lembrete: voc\xEA tem parcela vencendo em breve no valor de *${fmt(valorParcela)}*.
Fique em dia!${clienteChavePix ? `

\u{1F4B3} *PIX:* ${clienteChavePix}` : ""}${assinatura ? `

${assinatura}` : ""}`;
        const whatsappUrl = clienteWhatsapp ? `https://wa.me/55${clienteWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : null;
        resultados.push({ contratoId, clienteNome, whatsappUrl, sucesso: true });
      } catch {
        resultados.push({ contratoId, clienteNome: "", whatsappUrl: null, sucesso: false });
      }
    }
    return { resultados, total: resultados.length, sucesso: resultados.filter((r) => r.sucesso).length };
  }),
  // Recebimentos (histórico de pagamentos)
  recebimentos: protectedProcedure.input(z9.object({
    periodo: z9.enum(["hoje", "semana", "mes", "todos"]).default("mes")
  })).query(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { recebimentos: [], total: 0, totalValor: 0 };
    const hoje = /* @__PURE__ */ new Date();
    let dataInicio = null;
    if (input.periodo === "hoje") {
      dataInicio = hoje.toISOString().split("T")[0];
    } else if (input.periodo === "semana") {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 7);
      dataInicio = d.toISOString().split("T")[0];
    } else if (input.periodo === "mes") {
      const d = new Date(hoje);
      d.setDate(1);
      dataInicio = d.toISOString().split("T")[0];
    }
    let query = supabase.from("transacoes_caixa").select("*, contas_caixa(nome)").eq("tipo", "entrada").in("categoria", ["pagamento_parcela", "pagamento_juros", "pagamento_total"]).order("data_transacao", { ascending: false }).limit(100);
    if (dataInicio) query = query.gte("data_transacao", dataInicio);
    const { data } = await query;
    const recebimentos = (data ?? []).map((r) => ({
      id: r.id,
      descricao: r.descricao ?? "Pagamento",
      valor: parseFloat(r.valor ?? "0"),
      dataTransacao: r.data_transacao,
      categoria: r.categoria,
      contaNome: r.contas_caixa?.nome ?? "Caixa"
    }));
    const totalValor = recebimentos.reduce((s, r) => s + r.valor, 0);
    return { recebimentos, total: recebimentos.length, totalValor };
  }),
  relatorioDiario: protectedProcedure.input(z9.object({ telefone: z9.string().optional() }).optional()).mutation(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const hoje = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { data: parcelasHoje } = await supabase.from("parcelas").select("id, valor, valor_pago, status, data_vencimento, contratos(clientes(nome))").eq("data_vencimento", hoje).eq("user_id", ctx.user.id);
    const { data: pagamentosHoje } = await supabase.from("parcelas").select("id, valor_pago, data_pagamento, contratos(clientes(nome))").eq("data_pagamento", hoje).eq("status", "paga").eq("user_id", ctx.user.id);
    const { data: atrasadas } = await supabase.from("parcelas").select("id, valor, data_vencimento, contratos(clientes(nome))").eq("status", "atrasada").eq("user_id", ctx.user.id).order("data_vencimento", { ascending: true }).limit(10);
    const totalRecebidoHoje = (pagamentosHoje || []).reduce((s, p) => s + parseFloat(p.valor_pago || 0), 0);
    const totalVencendoHoje = (parcelasHoje || []).filter((p) => p.status !== "paga").length;
    const totalAtrasadas = (atrasadas || []).length;
    const { data: cfgData } = await supabase.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id);
    const cfg = {};
    (cfgData || []).forEach((r) => {
      cfg[r.chave] = r.valor;
    });
    const nomeEmpresa = cfg["nomeEmpresa"] || "CobraPro";
    const assinatura = cfg["assinaturaWhatsapp"] || nomeEmpresa;
    const dataFormatada = (/* @__PURE__ */ new Date()).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    let msg = `\u{1F4CA} *RELAT\xD3RIO DO DIA \u2014 ${dataFormatada.toUpperCase()}*
`;
    msg += `_${nomeEmpresa}_

`;
    msg += `\u{1F4B0} *RECEBIMENTOS HOJE*
`;
    msg += `Total recebido: *R$ ${totalRecebidoHoje.toFixed(2).replace(".", ",")}*
`;
    if ((pagamentosHoje || []).length > 0) {
      (pagamentosHoje || []).slice(0, 5).forEach((p) => {
        const nome = p.contratos?.clientes?.nome || "Cliente";
        msg += `  \u2705 ${nome}: R$ ${parseFloat(p.valor_pago || 0).toFixed(2).replace(".", ",")}
`;
      });
      if ((pagamentosHoje || []).length > 5) msg += `  ... e mais ${(pagamentosHoje || []).length - 5} pagamentos
`;
    } else {
      msg += `  Nenhum pagamento registrado hoje
`;
    }
    msg += `
\u{1F4C5} *VENCIMENTOS HOJE*
`;
    if (totalVencendoHoje > 0) {
      msg += `${totalVencendoHoje} parcela(s) vencem hoje
`;
      (parcelasHoje || []).filter((p) => p.status !== "paga").slice(0, 5).forEach((p) => {
        const nome = p.contratos?.clientes?.nome || "Cliente";
        msg += `  \u23F0 ${nome}: R$ ${parseFloat(p.valor || 0).toFixed(2).replace(".", ",")}
`;
      });
    } else {
      msg += `  Nenhum vencimento hoje
`;
    }
    if (totalAtrasadas > 0) {
      msg += `
\u{1F534} *INADIMPLENTES (${totalAtrasadas})*
`;
      (atrasadas || []).slice(0, 5).forEach((p) => {
        const nome = p.contratos?.clientes?.nome || "Cliente";
        const venc = new Date(p.data_vencimento).toLocaleDateString("pt-BR");
        msg += `  \u274C ${nome} \u2014 venceu ${venc}
`;
      });
      if (totalAtrasadas > 5) msg += `  ... e mais ${totalAtrasadas - 5} inadimplentes
`;
    }
    msg += `
_Enviado pelo ${assinatura}_`;
    const telefone = input?.telefone || cfg["telefoneEmpresa"] || "";
    const telefoneNumeros = telefone.replace(/\D/g, "");
    const whatsappUrl = telefoneNumeros ? `https://wa.me/55${telefoneNumeros}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    return { mensagem: msg, whatsappUrl, totalRecebidoHoje, totalVencendoHoje, totalAtrasadas, pagamentosCount: (pagamentosHoje || []).length };
  })
});
var relatoriosRouter = router({
  resumoGeral: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    const [{ count: totalContratos }, { count: contratosAtivos }, { count: totalClientes }] = await Promise.all([
      supabase.from("contratos").select("*", { count: "exact", head: true }).eq("user_id", ctx.user.id),
      supabase.from("contratos").select("*", { count: "exact", head: true }).eq("status", "ativo").eq("user_id", ctx.user.id),
      supabase.from("clientes").select("*", { count: "exact", head: true }).eq("user_id", ctx.user.id)
    ]);
    const { data: entradas } = await supabase.from("transacoes_caixa").select("valor").eq("tipo", "entrada");
    const totalRecebido = (entradas ?? []).reduce((s, r) => s + parseFloat(r.valor ?? "0"), 0);
    const { data: liberados } = await supabase.from("transacoes_caixa").select("valor").eq("tipo", "saida").eq("categoria", "emprestimo_liberado");
    const totalLiberado = (liberados ?? []).reduce((s, r) => s + parseFloat(r.valor ?? "0"), 0);
    const { data: inadimplentesData } = await supabase.from("parcelas").select("valor_original").eq("status", "atrasada");
    const totalInadimplente = (inadimplentesData ?? []).reduce((s, r) => s + parseFloat(r.valor_original ?? "0"), 0);
    return {
      totalContratos: totalContratos ?? 0,
      contratosAtivos: contratosAtivos ?? 0,
      totalClientes: totalClientes ?? 0,
      totalRecebido,
      totalLiberado,
      totalInadimplente,
      qtdInadimplentes: (inadimplentesData ?? []).length
    };
  })
});
var configuracoesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    let rows = [];
    if (db) {
      try {
        rows = await db.select().from(configuracoes).where(eq5(configuracoes.userId, ctx.user.id));
      } catch (err) {
        console.warn("[configuracoes.get] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    if (rows.length === 0) {
      const supabase = await getSupabaseClientAsync();
      if (supabase) {
        const { data } = await supabase.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id);
        if (data) rows = data;
      }
    }
    const map = {};
    for (const r of rows) map[r.chave] = r.valor ?? "";
    const get = (camel, snake, fallback = "") => map[camel] ?? map[snake] ?? fallback;
    return {
      nomeEmpresa: get("nomeEmpresa", "nome_empresa"),
      cnpjEmpresa: get("cnpjEmpresa", "cnpj_empresa"),
      telefoneEmpresa: get("telefoneEmpresa", "telefone_empresa"),
      enderecoEmpresa: get("enderecoEmpresa", "endereco_empresa"),
      assinaturaWhatsapp: get("assinaturaWhatsapp", "assinatura_whatsapp"),
      fechamentoWhatsapp: get("fechamentoWhatsapp", "fechamento_whatsapp"),
      multaPadrao: parseFloat(get("multaPadrao", "multa_padrao", "2")),
      jurosMoraDiario: parseFloat(get("jurosMoraDiario", "juros_mora_diario", "0.033")),
      diasLembrete: parseInt(get("diasLembrete", "dias_lembrete", "3")),
      multaDiaria: parseFloat(get("multaDiaria", "multa_diaria", "100")),
      pixKey: get("pixKey", "pix_key"),
      nomeCobranca: get("nomeCobranca", "nome_cobranca"),
      linkPagamento: get("linkPagamento", "link_pagamento"),
      logoUrl: get("logoUrl", "logo_url"),
      templateAtraso: get("templateAtraso", "template_atraso"),
      templateVenceHoje: get("templateVenceHoje", "template_vence_hoje"),
      templateAntecipada: get("templateAntecipada", "template_antecipada")
    };
  }),
  save: protectedProcedure.input(z9.object({
    nomeEmpresa: z9.string().optional(),
    cnpjEmpresa: z9.string().optional(),
    telefoneEmpresa: z9.string().optional(),
    enderecoEmpresa: z9.string().optional(),
    assinaturaWhatsapp: z9.string().optional(),
    fechamentoWhatsapp: z9.string().optional(),
    multaPadrao: z9.number().optional(),
    jurosMoraDiario: z9.number().optional(),
    diasLembrete: z9.number().optional(),
    multaDiaria: z9.number().optional(),
    pixKey: z9.string().optional(),
    nomeCobranca: z9.string().optional(),
    linkPagamento: z9.string().optional(),
    logoUrl: z9.string().optional(),
    templateAtraso: z9.string().optional(),
    templateVenceHoje: z9.string().optional(),
    templateAntecipada: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const entries = Object.entries(input).filter(([, v]) => v !== void 0);
    if (db) {
      try {
        for (const [chave, valor] of entries) {
          await db.insert(configuracoes).values({ chave, valor: String(valor), userId: ctx.user.id }).onConflictDoUpdate({ target: [configuracoes.chave, configuracoes.userId], set: { valor: String(valor) } });
        }
        return { success: true };
      } catch (err) {
        console.warn("[configuracoes.save] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    for (const [chave, valor] of entries) {
      await supabase.from("configuracoes").upsert({ chave, valor: String(valor), user_id: ctx.user.id }, { onConflict: "chave,user_id" });
    }
    return { success: true };
  }),
  templates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        return db.select().from(templatesWhatsapp).where(eq5(templatesWhatsapp.userId, ctx.user.id));
      } catch (err) {
        console.warn("[configuracoes.templates] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from("templates_whatsapp").select("*");
    return data ?? [];
  }),
  updateTemplate: protectedProcedure.input(z9.object({
    id: z9.number(),
    nome: z9.string().optional(),
    mensagem: z9.string().optional(),
    ativo: z9.boolean().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const db = await getDb();
    if (db) {
      try {
        await db.update(templatesWhatsapp).set(data).where(eq5(templatesWhatsapp.id, id));
        return { success: true };
      } catch (err) {
        console.warn("[configuracoes.updateTemplate] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("templates_whatsapp").update(data).eq("id", id);
    return { success: true };
  })
});
var cobradoresRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        return db.select().from(koletores).where(eq5(koletores.userId, ctx.user.id)).orderBy(desc2(koletores.createdAt));
      } catch (err) {
        console.warn("[koletores.list] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from("koletores").select("*").order("createdAt", { ascending: false }).eq("user_id", ctx.user.id);
    return data ?? [];
  }),
  me: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    try {
      const { data: koletor } = await supabase.from("koletores").select("*").eq("user_id", ctx.user.id).single();
      return koletor ?? null;
    } catch (_) {
      return null;
    }
  }),
  create: protectedProcedure.input(z9.object({
    nome: z9.string().min(2),
    email: z9.string().email().optional().or(z9.literal("")),
    telefone: z9.string().optional(),
    whatsapp: z9.string().optional(),
    perfil: z9.enum(["admin", "gerente", "koletor"]).default("koletor"),
    limiteEmprestimo: z9.number().default(0),
    comissaoPercentual: z9.number().default(0),
    observacoes: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const result = await db.insert(koletores).values({ nome: input.nome, email: input.email || null, telefone: input.telefone || null, whatsapp: input.whatsapp || null, perfil: input.perfil, limiteEmprestimo: input.limiteEmprestimo.toString(), comissaoPercentual: input.comissaoPercentual.toString(), observacoes: input.observacoes || null, userId: ctx.user.id }).returning({ id: koletores.id });
        return { id: result[0].id, success: true };
      } catch (err) {
        console.warn("[koletores.create] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data, error } = await supabase.from("koletores").insert({ nome: input.nome, email: input.email || null, telefone: input.telefone || null, whatsapp: input.whatsapp || null, perfil: input.perfil, limite_emprestimo: input.limiteEmprestimo, comissao_percentual: input.comissaoPercentual, observacoes: input.observacoes || null }).select("id").single();
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { id: data.id, success: true };
  }),
  update: protectedProcedure.input(z9.object({ id: z9.number(), nome: z9.string().optional(), email: z9.string().optional(), telefone: z9.string().optional(), whatsapp: z9.string().optional(), perfil: z9.enum(["admin", "gerente", "koletor"]).optional(), limiteEmprestimo: z9.number().optional(), comissaoPercentual: z9.number().optional(), ativo: z9.boolean().optional(), observacoes: z9.string().optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const { id, limiteEmprestimo, comissaoPercentual, ...rest } = input;
    if (db) {
      try {
        const updateData2 = { ...rest };
        if (limiteEmprestimo !== void 0) updateData2.limiteEmprestimo = limiteEmprestimo.toString();
        if (comissaoPercentual !== void 0) updateData2.comissaoPercentual = comissaoPercentual.toString();
        await db.update(koletores).set(updateData2).where(eq5(koletores.id, id));
        return { success: true };
      } catch (err) {
        console.warn("[koletores.update] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const updateData = { ...rest };
    if (limiteEmprestimo !== void 0) updateData.limite_emprestimo = limiteEmprestimo;
    if (comissaoPercentual !== void 0) updateData.comissao_percentual = comissaoPercentual;
    await supabase.from("koletores").update(updateData).eq("id", id);
    return { success: true };
  }),
  delete: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(koletores).set({ ativo: false }).where(eq5(koletores.id, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[koletores.delete] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("koletores").update({ ativo: false }).eq("id", input.id);
    return { success: true };
  }),
  performance: protectedProcedure.input(z9.object({ mes: z9.number().optional(), ano: z9.number().optional() })).query(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const ano = input.ano ?? (/* @__PURE__ */ new Date()).getFullYear();
    const mes = input.mes ?? (/* @__PURE__ */ new Date()).getMonth() + 1;
    const inicioMes = new Date(ano, mes - 1, 1).toISOString();
    const fimMes = new Date(ano, mes, 0, 23, 59, 59).toISOString();
    const { data: todosKoletores } = await supabase.from("koletores").select("*").eq("ativo", true);
    const resultado = await Promise.all((todosKoletores ?? []).map(async (k) => {
      const { data: contratosKoletor } = await supabase.from("contratos").select("valor_principal").eq("koletor_id", k.id).gte("createdAt", inicioMes).lte("createdAt", fimMes);
      const { data: recebidoKoletor } = await supabase.from("parcelas").select("valor_pago").eq("koletor_id", k.id).eq("status", "paga").gte("data_pagamento", inicioMes).lte("data_pagamento", fimMes);
      const { data: inadimplentesKoletor } = await supabase.from("parcelas").select("valor_original").eq("koletor_id", k.id).eq("status", "atrasada");
      const totalEmprestado = (contratosKoletor ?? []).reduce((s, r) => s + parseFloat(r.valor_principal ?? "0"), 0);
      const totalRecebido = (recebidoKoletor ?? []).reduce((s, r) => s + parseFloat(r.valor_pago ?? "0"), 0);
      const totalInadimplente = (inadimplentesKoletor ?? []).reduce((s, r) => s + parseFloat(r.valor_original ?? "0"), 0);
      const comissao = totalRecebido * (parseFloat(k.comissao_percentual ?? "0") / 100);
      return {
        koletor: k,
        qtdContratos: (contratosKoletor ?? []).length,
        totalEmprestado,
        totalRecebido,
        totalInadimplente,
        qtdInadimplentes: (inadimplentesKoletor ?? []).length,
        comissao,
        taxaInadimplencia: totalEmprestado > 0 ? totalInadimplente / totalEmprestado * 100 : 0
      };
    }));
    return resultado;
  })
});
var reparcelamentoRouter = router({
  preview: protectedProcedure.input(z9.object({
    contratoId: z9.number(),
    numeroParcelas: z9.number().min(1),
    taxaJuros: z9.number().min(0),
    tipoTaxa: z9.enum(["diaria", "semanal", "quinzenal", "mensal", "anual"]).default("mensal"),
    dataInicio: z9.string(),
    incluirMultas: z9.boolean().default(true)
  })).query(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new Error("DB unavailable");
    const { data: parcelasAbertas, error: parcelasErr } = await supabase.from("parcelas").select("*").eq("contrato_id", input.contratoId).in("status", ["pendente", "atrasada", "vencendo_hoje", "parcial"]);
    if (parcelasErr) throw new Error(parcelasErr.message);
    const hoje = /* @__PURE__ */ new Date();
    let saldoDevedor = 0;
    for (const p of parcelasAbertas ?? []) {
      const valorBase = parseFloat(p.valor_original) - parseFloat(p.valor_pago ?? "0");
      let multa = 0;
      let juros = 0;
      if (input.incluirMultas && p.status === "atrasada") {
        const vencDate = /* @__PURE__ */ new Date(String(p.data_vencimento) + "T00:00:00");
        const resultado = calcularJurosMora(valorBase, vencDate, hoje, 0.033, 2);
        multa = resultado.multa;
        juros = resultado.juros;
      }
      saldoDevedor += valorBase + multa + juros;
    }
    const valorNovaParcela = calcularParcelaPadrao(saldoDevedor, input.taxaJuros, input.numeroParcelas);
    const dataInicioDate = new Date(input.dataInicio);
    return {
      saldoDevedor,
      valorNovaParcela,
      totalNovo: valorNovaParcela * input.numeroParcelas,
      qtdParcelasAbertas: (parcelasAbertas ?? []).length,
      parcelas: Array.from({ length: input.numeroParcelas }, (_, i) => {
        const venc = new Date(dataInicioDate);
        venc.setMonth(venc.getMonth() + i);
        return {
          numero: i + 1,
          valor: valorNovaParcela,
          vencimento: venc.toISOString().split("T")[0]
        };
      })
    };
  }),
  executar: protectedProcedure.input(z9.object({
    contratoId: z9.number(),
    numeroParcelas: z9.number().min(1),
    taxaJuros: z9.number().min(0),
    tipoTaxa: z9.enum(["diaria", "semanal", "quinzenal", "mensal", "anual"]).default("mensal"),
    dataInicio: z9.string(),
    incluirMultas: z9.boolean().default(true),
    observacoes: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: contratoOriginalArr, error: contratoErr } = await supabase.from("contratos").select("*").eq("id", input.contratoId).eq("user_id", ctx.user.id).single();
    if (contratoErr || !contratoOriginalArr) throw new Error("Contrato n\xE3o encontrado");
    const contratoOriginal = contratoOriginalArr;
    const { data: parcelasAbertas } = await supabase.from("parcelas").select("*").eq("contrato_id", input.contratoId).in("status", ["pendente", "atrasada", "vencendo_hoje", "parcial"]);
    const hoje = /* @__PURE__ */ new Date();
    let saldoDevedor = 0;
    for (const p of parcelasAbertas ?? []) {
      const valorBase = parseFloat(p.valor_original) - parseFloat(p.valor_pago ?? "0");
      let multa = 0;
      let juros = 0;
      if (input.incluirMultas && p.status === "atrasada") {
        const vencDate = /* @__PURE__ */ new Date(String(p.data_vencimento) + "T00:00:00");
        const resultado = calcularJurosMora(valorBase, vencDate, hoje, 0.033, 2);
        multa = resultado.multa;
        juros = resultado.juros;
      }
      saldoDevedor += valorBase + multa + juros;
    }
    for (const p of parcelasAbertas ?? []) {
      await supabase.from("parcelas").update({ status: "paga", observacoes: "Reparcelado" }).eq("id", p.id);
    }
    await supabase.from("contratos").update({ status: "quitado" }).eq("id", input.contratoId);
    const valorNovaParcela2 = calcularParcelaPadrao(saldoDevedor, input.taxaJuros, input.numeroParcelas);
    const dataInicioDate = new Date(input.dataInicio);
    const { data: novoContrato, error: novoContratoErr } = await supabase.from("contratos").insert({
      cliente_id: contratoOriginal.cliente_id,
      koletor_id: contratoOriginal.koletor_id ?? null,
      modalidade: "reparcelamento",
      status: "ativo",
      valor_principal: saldoDevedor.toFixed(2),
      taxa_juros: input.taxaJuros.toFixed(4),
      tipo_taxa: input.tipoTaxa,
      numero_parcelas: input.numeroParcelas,
      valor_parcela: valorNovaParcela2.toFixed(2),
      total_contrato: (valorNovaParcela2 * input.numeroParcelas).toFixed(2),
      multa_atraso: contratoOriginal.multa_atraso ?? "2.00",
      juros_mora_diario: contratoOriginal.juros_mora_diario ?? "0.033",
      data_inicio: dataInicioDate.toISOString().split("T")[0],
      data_vencimento_primeira: dataInicioDate.toISOString().split("T")[0],
      contrato_origem_id: input.contratoId,
      observacoes: input.observacoes || `Reparcelamento do contrato #${input.contratoId}`,
      user_id: ctx.user.id
    }).select("id").single();
    if (novoContratoErr || !novoContrato) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: novoContratoErr?.message ?? "Failed to create reparcelamento" });
    const novoContratoId = novoContrato.id;
    for (let i = 0; i < input.numeroParcelas; i++) {
      const venc = new Date(dataInicioDate);
      venc.setMonth(venc.getMonth() + i);
      await supabase.from("parcelas").insert({
        contrato_id: novoContratoId,
        cliente_id: contratoOriginal.cliente_id,
        koletor_id: contratoOriginal.koletor_id ?? null,
        numero: i + 1,
        valor: valorNovaParcela2.toFixed(2),
        valor_original: valorNovaParcela2.toFixed(2),
        data_vencimento: venc.toISOString().split("T")[0],
        status: "pendente",
        user_id: ctx.user.id
      });
    }
    return { success: true, novoContratoId };
  })
});
var contasPagarRouter = router({
  listar: protectedProcedure.input(z9.object({
    status: z9.enum(["pendente", "paga", "atrasada", "cancelada", "todos"]).optional(),
    categoria: z9.string().optional()
  }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        let query = db.select().from(contasPagar).$dynamic();
        const conditions = [eq5(contasPagar.userId, ctx.user.id)];
        if (input?.status && input.status !== "todos") conditions.push(eq5(contasPagar.status, input.status));
        if (input?.categoria) conditions.push(eq5(contasPagar.categoria, input.categoria));
        query = query.where(and3(...conditions));
        return query.orderBy(desc2(contasPagar.dataVencimento));
      } catch (err) {
        console.warn("[contasPagar.listar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    let q = supabase.from("contas_pagar").select("*").order("data_vencimento", { ascending: false }).eq("user_id", ctx.user.id);
    if (input?.status && input.status !== "todos") q = q.eq("status", input.status);
    if (input?.categoria) q = q.eq("categoria", input.categoria);
    const { data, error } = await q;
    if (error) {
      console.error("[contasPagar.listar] REST error:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({ ...r, dataVencimento: r.data_vencimento, dataPagamento: r.data_pagamento, contaCaixaId: r.conta_caixa_id }));
  }),
  criar: protectedProcedure.input(z9.object({
    descricao: z9.string().min(1),
    categoria: z9.enum(["aluguel", "salario", "servicos", "impostos", "fornecedores", "marketing", "tecnologia", "outros"]),
    valor: z9.number().positive(),
    dataVencimento: z9.string(),
    recorrente: z9.boolean().optional().default(false),
    periodicidade: z9.enum(["mensal", "semanal", "anual", "unica"]).optional().default("unica"),
    observacoes: z9.string().optional(),
    contaCaixaId: z9.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const result = await db.insert(contasPagar).values({
          descricao: input.descricao,
          categoria: input.categoria,
          valor: String(input.valor),
          dataVencimento: input.dataVencimento,
          recorrente: input.recorrente ?? false,
          periodicidade: input.periodicidade ?? "unica",
          observacoes: input.observacoes,
          contaCaixaId: input.contaCaixaId,
          status: "pendente",
          userId: ctx.user.id
        }).returning({ id: contasPagar.id });
        return { success: true, id: result[0].id };
      } catch (err) {
        console.warn("[contasPagar.criar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data, error } = await supabase.from("contas_pagar").insert({
      descricao: input.descricao,
      categoria: input.categoria,
      valor: input.valor,
      data_vencimento: input.dataVencimento,
      recorrente: input.recorrente ?? false,
      periodicidade: input.periodicidade ?? "unica",
      observacoes: input.observacoes ?? null,
      conta_caixa_id: input.contaCaixaId ?? null,
      status: "pendente",
      user_id: ctx.user.id
    }).select("id").single();
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true, id: data.id };
  }),
  pagar: protectedProcedure.input(z9.object({
    id: z9.number(),
    contaCaixaId: z9.number().optional(),
    dataPagamento: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const dataPag = input.dataPagamento ? new Date(input.dataPagamento) : /* @__PURE__ */ new Date();
    if (db) {
      try {
        const conta = await db.select().from(contasPagar).where(eq5(contasPagar.id, input.id)).limit(1);
        if (!conta[0]) throw new Error("Conta n\xE3o encontrada");
        await db.update(contasPagar).set({ status: "paga", dataPagamento: dataPag, contaCaixaId: input.contaCaixaId }).where(eq5(contasPagar.id, input.id));
        if (input.contaCaixaId) {
          await db.insert(transacoesCaixa).values({ contaCaixaId: input.contaCaixaId, tipo: "saida", categoria: "despesa_operacional", valor: conta[0].valor, descricao: `Pagamento: ${conta[0].descricao}`, dataTransacao: dataPag });
        }
        return { success: true };
      } catch (err) {
        if (err.message === "Conta n\xE3o encontrada") throw err;
        console.warn("[contasPagar.pagar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: contaData } = await supabase.from("contas_pagar").select("valor, descricao").eq("id", input.id).single();
    if (!contaData) throw new Error("Conta n\xE3o encontrada");
    await supabase.from("contas_pagar").update({ status: "paga", data_pagamento: dataPag.toISOString(), conta_caixa_id: input.contaCaixaId ?? null }).eq("id", input.id);
    if (input.contaCaixaId) {
      await supabase.from("transacoes_caixa").insert({ conta_caixa_id: input.contaCaixaId, tipo: "saida", categoria: "despesa_operacional", valor: contaData.valor, descricao: `Pagamento: ${contaData.descricao}`, data_transacao: dataPag.toISOString() });
    }
    return { success: true };
  }),
  cancelar: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(contasPagar).set({ status: "cancelada" }).where(eq5(contasPagar.id, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[contasPagar.cancelar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("contas_pagar").update({ status: "cancelada" }).eq("id", input.id);
    return { success: true };
  }),
  excluir: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.delete(contasPagar).where(eq5(contasPagar.id, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[contasPagar.excluir] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("contas_pagar").delete().eq("id", input.id);
    return { success: true };
  }),
  resumo: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return { totalPendente: 0, qtdPendente: 0, totalAtrasado: 0, qtdAtrasado: 0, totalPago: 0, qtdPago: 0 };
      const { data: all } = await supabase.from("contas_pagar").select("status, valor").eq("user_id", ctx.user.id);
      const pendentes2 = (all ?? []).filter((r) => r.status === "pendente");
      const atrasadas2 = (all ?? []).filter((r) => r.status === "atrasada");
      const pagas2 = (all ?? []).filter((r) => r.status === "paga");
      return {
        totalPendente: pendentes2.reduce((s, r) => s + parseFloat(r.valor ?? 0), 0),
        qtdPendente: pendentes2.length,
        totalAtrasado: atrasadas2.reduce((s, r) => s + parseFloat(r.valor ?? 0), 0),
        qtdAtrasado: atrasadas2.length,
        totalPago: pagas2.reduce((s, r) => s + parseFloat(r.valor ?? 0), 0),
        qtdPago: pagas2.length
      };
    }
    if (false) throw new Error();
    const hoje = /* @__PURE__ */ new Date();
    const hojeStr = hoje.toISOString().split("T")[0];
    const pendentes = await db.select({ total: sql3`COALESCE(SUM(valor), 0)`, qtd: sql3`COUNT(*)` }).from(contasPagar).where(and3(eq5(contasPagar.status, "pendente"), eq5(contasPagar.userId, ctx.user.id)));
    const atrasadas = await db.select({ total: sql3`COALESCE(SUM(valor), 0)`, qtd: sql3`COUNT(*)` }).from(contasPagar).where(and3(eq5(contasPagar.status, "atrasada"), eq5(contasPagar.userId, ctx.user.id)));
    const pagas = await db.select({ total: sql3`COALESCE(SUM(valor), 0)`, qtd: sql3`COUNT(*)` }).from(contasPagar).where(and3(eq5(contasPagar.status, "paga"), eq5(contasPagar.userId, ctx.user.id)));
    return {
      totalPendente: parseFloat(pendentes[0]?.total ?? "0"),
      qtdPendente: pendentes[0]?.qtd ?? 0,
      totalAtrasado: parseFloat(atrasadas[0]?.total ?? "0"),
      qtdAtrasado: atrasadas[0]?.qtd ?? 0,
      totalPago: parseFloat(pagas[0]?.total ?? "0"),
      qtdPago: pagas[0]?.qtd ?? 0
    };
  })
});
var vendasRouter = router({
  listarProdutos: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        return db.select().from(produtos).where(and3(eq5(produtos.ativo, true), eq5(produtos.userId, ctx.user.id))).orderBy(desc2(produtos.createdAt));
      } catch (err) {
        console.warn("[vendas.listarProdutos] Drizzle failed:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("createdAt", { ascending: false });
    return data ?? [];
  }),
  criarProduto: protectedProcedure.input(z9.object({ nome: z9.string().min(1), descricao: z9.string().optional(), preco: z9.number().positive(), estoque: z9.number().int().min(0).default(0) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const result = await db.insert(produtos).values({ nome: input.nome, descricao: input.descricao, preco: input.preco.toFixed(2), estoque: input.estoque, userId: ctx.user.id }).returning({ id: produtos.id });
        return { success: true, id: result[0].id };
      } catch (err) {
        console.warn("[vendas.criarProduto] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data, error } = await supabase.from("produtos").insert({ nome: input.nome, descricao: input.descricao ?? null, preco: input.preco, estoque: input.estoque, user_id: ctx.user.id }).select("id").single();
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true, id: data.id };
  }),
  atualizarEstoque: protectedProcedure.input(z9.object({ id: z9.number(), estoque: z9.number().int().min(0) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(produtos).set({ estoque: input.estoque }).where(eq5(produtos.id, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[vendas.atualizarEstoque] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("produtos").update({ estoque: input.estoque }).eq("id", input.id);
    return { success: true };
  }),
  desativarProduto: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(produtos).set({ ativo: false }).where(eq5(produtos.id, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[vendas.desativarProduto] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("produtos").update({ ativo: false }).eq("id", input.id);
    return { success: true };
  })
});
var chequesRouter = router({
  listar: protectedProcedure.input(z9.object({
    status: z9.enum(["aguardando", "compensado", "devolvido", "cancelado", "todos"]).optional(),
    clienteId: z9.number().optional()
  }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select({
          id: cheques.id,
          clienteId: cheques.clienteId,
          clienteNome: clientes.nome,
          numeroCheque: cheques.numeroCheque,
          banco: cheques.banco,
          emitente: cheques.emitente,
          cpfCnpjEmitente: cheques.cpfCnpjEmitente,
          valorNominal: cheques.valorNominal,
          dataVencimento: cheques.dataVencimento,
          taxaDesconto: cheques.taxaDesconto,
          tipoTaxa: cheques.tipoTaxa,
          valorDesconto: cheques.valorDesconto,
          valorLiquido: cheques.valorLiquido,
          status: cheques.status,
          contaCaixaId: cheques.contaCaixaId,
          dataCompensacao: cheques.dataCompensacao,
          motivoDevolucao: cheques.motivoDevolucao,
          observacoes: cheques.observacoes,
          createdAt: cheques.createdAt
        }).from(cheques).leftJoin(clientes, eq5(cheques.clienteId, clientes.id)).where(eq5(cheques.userId, ctx.user.id)).orderBy(desc2(cheques.createdAt));
        return rows.filter((r) => {
          if (input?.status && input.status !== "todos" && r.status !== input.status) return false;
          if (input?.clienteId && r.clienteId !== input.clienteId) return false;
          return true;
        });
      } catch (err) {
        console.warn("[cheques.listar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    let q = supabase.from("cheques").select("*, clientes(nome)").order("createdAt", { ascending: false }).eq("user_id", ctx.user.id);
    if (input?.status && input.status !== "todos") q = q.eq("status", input.status);
    if (input?.clienteId) q = q.eq("cliente_id", input.clienteId);
    const { data } = await q;
    return (data ?? []).map((r) => ({
      ...r,
      clienteId: r.cliente_id,
      clienteNome: r.clientes?.nome ?? null,
      numeroCheque: r.numero_cheque,
      valorNominal: r.valor_nominal,
      dataVencimento: r.data_vencimento,
      taxaDesconto: r.taxa_desconto,
      tipoTaxa: r.tipo_taxa,
      valorDesconto: r.valor_desconto,
      valorLiquido: r.valor_liquido,
      contaCaixaId: r.conta_caixa_id,
      dataCompensacao: r.data_compensacao,
      motivoDevolucao: r.motivo_devolucao
    }));
  }),
  criar: protectedProcedure.input(z9.object({
    clienteId: z9.number(),
    numeroCheque: z9.string().optional(),
    banco: z9.string().optional(),
    agencia: z9.string().optional(),
    conta: z9.string().optional(),
    emitente: z9.string().min(1),
    cpfCnpjEmitente: z9.string().optional(),
    valorNominal: z9.number().positive(),
    dataVencimento: z9.string(),
    taxaDesconto: z9.number().positive(),
    tipoTaxa: z9.enum(["diaria", "semanal", "quinzenal", "mensal", "anual"]).default("mensal"),
    contaCaixaId: z9.number().optional(),
    observacoes: z9.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const dbAvailable = !!db;
    const dataVenc = /* @__PURE__ */ new Date(input.dataVencimento + "T00:00:00");
    const hoje = /* @__PURE__ */ new Date();
    const diasAteVencimento = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1e3 * 60 * 60 * 24));
    let taxaDiaria;
    if (input.tipoTaxa === "diaria") {
      taxaDiaria = input.taxaDesconto / 100;
    } else if (input.tipoTaxa === "mensal") {
      taxaDiaria = Math.pow(1 + input.taxaDesconto / 100, 1 / 30) - 1;
    } else {
      taxaDiaria = Math.pow(1 + input.taxaDesconto / 100, 1 / 365) - 1;
    }
    const fatorDesconto = Math.pow(1 + taxaDiaria, diasAteVencimento);
    const valorLiquido = input.valorNominal / fatorDesconto;
    const valorDesconto = input.valorNominal - valorLiquido;
    if (dbAvailable && db) {
      try {
        const result = await db.insert(cheques).values({
          clienteId: input.clienteId,
          numeroCheque: input.numeroCheque,
          banco: input.banco,
          agencia: input.agencia,
          conta: input.conta,
          emitente: input.emitente,
          cpfCnpjEmitente: input.cpfCnpjEmitente,
          valorNominal: input.valorNominal.toFixed(2),
          dataVencimento: dataVenc.toISOString().split("T")[0],
          taxaDesconto: input.taxaDesconto.toFixed(4),
          tipoTaxa: input.tipoTaxa,
          valorDesconto: valorDesconto.toFixed(2),
          valorLiquido: valorLiquido.toFixed(2),
          contaCaixaId: input.contaCaixaId,
          observacoes: input.observacoes,
          status: "aguardando"
        }).returning({ id: cheques.id });
        if (input.contaCaixaId) {
          await db.insert(transacoesCaixa).values({ contaCaixaId: input.contaCaixaId, tipo: "saida", categoria: "outros", valor: valorLiquido.toFixed(2), descricao: `Desconto de cheque - ${input.emitente}`, dataTransacao: /* @__PURE__ */ new Date() });
        }
        return { success: true, id: result[0].id, valorLiquido, valorDesconto };
      } catch (err) {
        console.warn("[cheques.criar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: chqData, error: chqErr } = await supabase.from("cheques").insert({
      user_id: ctx.user.id,
      cliente_id: input.clienteId,
      numero_cheque: input.numeroCheque ?? null,
      banco: input.banco ?? null,
      agencia: input.agencia ?? null,
      conta: input.conta ?? null,
      emitente: input.emitente,
      cpf_cnpj_emitente: input.cpfCnpjEmitente ?? null,
      valor_nominal: input.valorNominal,
      data_vencimento: dataVenc.toISOString().split("T")[0],
      taxa_desconto: input.taxaDesconto,
      tipo_taxa: input.tipoTaxa,
      valor_desconto: valorDesconto,
      valor_liquido: valorLiquido,
      conta_caixa_id: input.contaCaixaId ?? null,
      observacoes: input.observacoes ?? null,
      status: "aguardando"
    }).select("id").single();
    if (chqErr) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: chqErr.message });
    if (input.contaCaixaId) {
      await supabase.from("transacoes_caixa").insert({ conta_caixa_id: input.contaCaixaId, tipo: "saida", categoria: "outros", valor: valorLiquido, descricao: `Desconto de cheque - ${input.emitente}`, data_transacao: (/* @__PURE__ */ new Date()).toISOString() });
    }
    return { success: true, id: chqData.id, valorLiquido, valorDesconto };
  }),
  compensar: protectedProcedure.input(z9.object({ id: z9.number(), contaCaixaId: z9.number().optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const cheque = await db.select().from(cheques).where(eq5(cheques.id, input.id)).limit(1);
        if (!cheque[0]) throw new Error("Cheque n\xE3o encontrado");
        const contaId2 = input.contaCaixaId ?? cheque[0].contaCaixaId;
        await db.update(cheques).set({ status: "compensado", dataCompensacao: /* @__PURE__ */ new Date(), contaCaixaId: contaId2 }).where(eq5(cheques.id, input.id));
        if (contaId2) await db.insert(transacoesCaixa).values({ contaCaixaId: contaId2, tipo: "entrada", categoria: "outros", valor: cheque[0].valorNominal, descricao: `Cheque compensado - ${cheque[0].emitente}`, dataTransacao: /* @__PURE__ */ new Date() });
        return { success: true };
      } catch (err) {
        if (err.message === "Cheque n\xE3o encontrado") throw err;
        console.warn("[cheques.compensar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: chqData } = await supabase.from("cheques").select("valor_nominal, emitente, conta_caixa_id").eq("id", input.id).single();
    if (!chqData) throw new Error("Cheque n\xE3o encontrado");
    const contaId = input.contaCaixaId ?? chqData.conta_caixa_id;
    await supabase.from("cheques").update({ status: "compensado", data_compensacao: (/* @__PURE__ */ new Date()).toISOString(), conta_caixa_id: contaId }).eq("id", input.id);
    if (contaId) await supabase.from("transacoes_caixa").insert({ conta_caixa_id: contaId, tipo: "entrada", categoria: "outros", valor: chqData.valor_nominal, descricao: `Cheque compensado - ${chqData.emitente}`, data_transacao: (/* @__PURE__ */ new Date()).toISOString() });
    return { success: true };
  }),
  devolver: protectedProcedure.input(z9.object({ id: z9.number(), motivo: z9.string().min(1) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(cheques).set({ status: "devolvido", motivoDevolucao: input.motivo }).where(eq5(cheques.id, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[cheques.devolver] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("cheques").update({ status: "devolvido", motivo_devolucao: input.motivo }).eq("id", input.id);
    return { success: true };
  }),
  cancelar: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        await db.update(cheques).set({ status: "cancelado" }).where(eq5(cheques.id, input.id));
        return { success: true };
      } catch (err) {
        console.warn("[cheques.cancelar] Drizzle failed, trying REST:", err.message);
        resetDb();
      }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await supabase.from("cheques").update({ status: "cancelado" }).eq("id", input.id);
    return { success: true };
  }),
  resumo: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return { totalAguardando: 0, qtdAguardando: 0, totalCompensado: 0, qtdCompensado: 0, totalDevolvido: 0, qtdDevolvido: 0 };
      const { data: all } = await supabase.from("cheques").select("status, valor_nominal");
      const ag = (all ?? []).filter((r) => r.status === "aguardando");
      const co = (all ?? []).filter((r) => r.status === "compensado");
      const de = (all ?? []).filter((r) => r.status === "devolvido");
      return {
        totalAguardando: ag.reduce((s, r) => s + parseFloat(r.valor_nominal ?? 0), 0),
        qtdAguardando: ag.length,
        totalCompensado: co.reduce((s, r) => s + parseFloat(r.valor_nominal ?? 0), 0),
        qtdCompensado: co.length,
        totalDevolvido: de.reduce((s, r) => s + parseFloat(r.valor_nominal ?? 0), 0),
        qtdDevolvido: de.length
      };
    }
    const aguardando = await db.select({ total: sql3`COALESCE(SUM(valor_nominal), 0)`, qtd: sql3`COUNT(*)` }).from(cheques).where(eq5(cheques.status, "aguardando"));
    const compensados = await db.select({ total: sql3`COALESCE(SUM(valor_nominal), 0)`, qtd: sql3`COUNT(*)` }).from(cheques).where(eq5(cheques.status, "compensado"));
    const devolvidos = await db.select({ total: sql3`COALESCE(SUM(valor_nominal), 0)`, qtd: sql3`COUNT(*)` }).from(cheques).where(eq5(cheques.status, "devolvido"));
    return {
      totalAguardando: parseFloat(aguardando[0]?.total ?? "0"),
      qtdAguardando: aguardando[0]?.qtd ?? 0,
      totalCompensado: parseFloat(compensados[0]?.total ?? "0"),
      qtdCompensado: compensados[0]?.qtd ?? 0,
      totalDevolvido: parseFloat(devolvidos[0]?.total ?? "0"),
      qtdDevolvido: devolvidos[0]?.qtd ?? 0
    };
  }),
  simular: publicProcedure.input(z9.object({
    valorNominal: z9.number().positive(),
    dataVencimento: z9.string(),
    taxaDesconto: z9.number().positive(),
    tipoTaxa: z9.enum(["diaria", "semanal", "quinzenal", "mensal", "anual"]).default("mensal")
  })).query(({ input }) => {
    const dataVenc = /* @__PURE__ */ new Date(input.dataVencimento + "T00:00:00");
    const hoje = /* @__PURE__ */ new Date();
    const diasAteVencimento = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1e3 * 60 * 60 * 24));
    let taxaDiaria;
    if (input.tipoTaxa === "diaria") {
      taxaDiaria = input.taxaDesconto / 100;
    } else if (input.tipoTaxa === "mensal") {
      taxaDiaria = Math.pow(1 + input.taxaDesconto / 100, 1 / 30) - 1;
    } else {
      taxaDiaria = Math.pow(1 + input.taxaDesconto / 100, 1 / 365) - 1;
    }
    const fatorDesconto = Math.pow(1 + taxaDiaria, diasAteVencimento);
    const valorLiquido = input.valorNominal / fatorDesconto;
    const valorDesconto = input.valorNominal - valorLiquido;
    const taxaEfetivaTotal = valorDesconto / valorLiquido * 100;
    return {
      diasAteVencimento,
      valorLiquido,
      valorDesconto,
      taxaEfetivaTotal
    };
  })
});
var vendasTelefoneRouter = router({
  listar: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from("vendas_telefone").select("*").order("createdAt", { ascending: false }).eq("user_id", ctx.user.id);
      if (error) {
        console.error("[vendasTelefone.listar]", error);
        return [];
      }
      return data ?? [];
    } catch (e) {
      console.error("[vendasTelefone.listar]", e);
      return [];
    }
  }),
  buscarPorId: protectedProcedure.input(z9.object({ id: z9.number() })).query(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from("vendas_telefone").select("*").eq("id", input.id).eq("user_id", ctx.user.id).maybeSingle();
      if (error) return null;
      return data ?? null;
    } catch (e) {
      return null;
    }
  }),
  parcelas: protectedProcedure.input(z9.object({ vendaId: z9.number() })).query(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from("parcelas_venda_telefone").select("*").eq("venda_id", input.vendaId).order("numero", { ascending: true });
      if (error) return [];
      return data ?? [];
    } catch (e) {
      return [];
    }
  }),
  criar: protectedProcedure.input(z9.object({
    marca: z9.string().min(1),
    modelo: z9.string().min(1),
    imei: z9.string().optional(),
    cor: z9.string().optional(),
    armazenamento: z9.string().optional(),
    custo: z9.number().positive(),
    precoVenda: z9.number().positive(),
    entradaPercentual: z9.number().min(0).max(100),
    entradaValor: z9.number().min(0),
    numParcelas: z9.number().int().min(1).max(60),
    jurosMensal: z9.number().min(0),
    valorParcela: z9.number().min(0),
    totalJuros: z9.number().min(0),
    totalAReceber: z9.number().min(0),
    lucroBruto: z9.number(),
    roi: z9.number().optional(),
    paybackMeses: z9.number().optional(),
    compradorNome: z9.string().min(1),
    compradorCpf: z9.string().optional(),
    compradorRg: z9.string().optional(),
    compradorTelefone: z9.string().optional(),
    compradorEmail: z9.string().optional(),
    compradorEstadoCivil: z9.string().optional(),
    compradorProfissao: z9.string().optional(),
    compradorInstagram: z9.string().optional(),
    compradorCep: z9.string().optional(),
    compradorCidade: z9.string().optional(),
    compradorEstado: z9.string().optional(),
    compradorEndereco: z9.string().optional(),
    compradorLocalTrabalho: z9.string().optional(),
    dataPrimeiraParcela: z9.string().optional()
  })).mutation(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: venda, error } = await supabase.from("vendas_telefone").insert({
      marca: input.marca,
      modelo: input.modelo,
      imei: input.imei ?? null,
      cor: input.cor ?? null,
      armazenamento: input.armazenamento ?? null,
      custo: input.custo,
      preco_venda: input.precoVenda,
      entrada_percentual: input.entradaPercentual,
      entrada_valor: input.entradaValor,
      num_parcelas: input.numParcelas,
      juros_mensal: input.jurosMensal,
      valor_parcela: input.valorParcela,
      total_juros: input.totalJuros,
      total_a_receber: input.totalAReceber,
      lucro_bruto: input.lucroBruto,
      roi: input.roi ?? null,
      payback_meses: input.paybackMeses ?? null,
      comprador_nome: input.compradorNome,
      comprador_cpf: input.compradorCpf ?? null,
      comprador_rg: input.compradorRg ?? null,
      comprador_telefone: input.compradorTelefone ?? null,
      comprador_email: input.compradorEmail ?? null,
      comprador_estado_civil: input.compradorEstadoCivil ?? null,
      comprador_profissao: input.compradorProfissao ?? null,
      comprador_instagram: input.compradorInstagram ?? null,
      comprador_cep: input.compradorCep ?? null,
      comprador_cidade: input.compradorCidade ?? null,
      comprador_estado: input.compradorEstado ?? null,
      comprador_endereco: input.compradorEndereco ?? null,
      comprador_local_trabalho: input.compradorLocalTrabalho ?? null,
      status: "ativo"
    }).select().single();
    if (error || !venda) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Erro ao criar venda" });
    const primeiraParcela = input.dataPrimeiraParcela ? /* @__PURE__ */ new Date(input.dataPrimeiraParcela + "T00:00:00") : (() => {
      const d = /* @__PURE__ */ new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    })();
    const parcelasData = Array.from({ length: input.numParcelas }, (_, i) => {
      const venc = new Date(primeiraParcela);
      venc.setMonth(venc.getMonth() + i);
      return {
        venda_id: venda.id,
        numero: i + 1,
        valor: input.valorParcela,
        vencimento: venc.toISOString(),
        status: "pendente"
      };
    });
    await supabase.from("parcelas_venda_telefone").insert(parcelasData);
    if (input.entradaValor > 0) {
      try {
        const { data: contas } = await supabase.from("contas_caixa").select("id, nome, saldo").order("id", { ascending: true }).limit(1);
        if (contas && contas.length > 0) {
          const conta = contas[0];
          await supabase.from("transacoes_caixa").insert({
            conta_caixa_id: conta.id,
            tipo: "entrada",
            categoria: "outros",
            valor: input.entradaValor,
            descricao: `Entrada venda ${input.marca} ${input.modelo} - ${input.compradorNome}`,
            data_transacao: (/* @__PURE__ */ new Date()).toISOString()
          });
          const novoSaldo = parseFloat(conta.saldo ?? "0") + input.entradaValor;
          await supabase.from("contas_caixa").update({ saldo: novoSaldo }).eq("id", conta.id);
        }
      } catch (caixaErr) {
        console.warn("[vendasTelefone.criar] Erro ao registrar no caixa:", caixaErr);
      }
    }
    return venda;
  }),
  pagarParcela: protectedProcedure.input(z9.object({
    parcelaId: z9.number(),
    valorPago: z9.number().positive()
  })).mutation(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data: parcela } = await supabase.from("parcelas_venda_telefone").select("*, vendas_telefone(marca, modelo, comprador_nome)").eq("id", input.parcelaId).maybeSingle();
    const { error } = await supabase.from("parcelas_venda_telefone").update({ status: "paga", pago_em: (/* @__PURE__ */ new Date()).toISOString(), valor_pago: input.valorPago }).eq("id", input.parcelaId);
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    try {
      const { data: contas } = await supabase.from("contas_caixa").select("id, saldo").order("id", { ascending: true }).limit(1);
      if (contas && contas.length > 0) {
        const conta = contas[0];
        const venda = parcela?.vendas_telefone;
        const descricao = venda ? `Parcela ${parcela?.numero} - ${venda.marca} ${venda.modelo} - ${venda.comprador_nome}` : `Parcela venda telefone #${input.parcelaId}`;
        await supabase.from("transacoes_caixa").insert({
          conta_caixa_id: conta.id,
          tipo: "entrada",
          categoria: "pagamento_parcela",
          valor: input.valorPago,
          descricao,
          data_transacao: (/* @__PURE__ */ new Date()).toISOString()
        });
        const novoSaldo = parseFloat(conta.saldo ?? "0") + input.valorPago;
        await supabase.from("contas_caixa").update({ saldo: novoSaldo }).eq("id", conta.id);
      }
    } catch (caixaErr) {
      console.warn("[vendasTelefone.pagarParcela] Erro ao registrar no caixa:", caixaErr);
    }
    try {
      if (parcela) {
        const vendaId = parcela.venda_id;
        const { data: todasParcelas } = await supabase.from("parcelas_venda_telefone").select("id, status").eq("venda_id", vendaId);
        if (todasParcelas && todasParcelas.length > 0) {
          const todasPagas = todasParcelas.every(
            (p) => p.id === input.parcelaId ? true : p.status === "paga"
          );
          if (todasPagas) {
            await supabase.from("vendas_telefone").update({ status: "quitado" }).eq("id", vendaId);
            console.log(`[vendasTelefone] Venda #${vendaId} marcada como QUITADA automaticamente`);
          }
        }
      }
    } catch (quitadoErr) {
      console.warn("[vendasTelefone.pagarParcela] Erro ao verificar quitado:", quitadoErr);
    }
    return { success: true };
  }),
  deletar: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { error } = await supabase.from("vendas_telefone").delete().eq("id", input.id);
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { totalVendas: 0, capitalInvestido: 0, totalAReceber: 0, lucroBruto: 0, vendasAtivas: 0, vendasQuitadas: 0 };
    const { data } = await supabase.from("vendas_telefone").select("status, custo, total_a_receber, lucro_bruto, entrada_valor").eq("user_id", ctx.user.id);
    const all = data ?? [];
    return {
      totalVendas: all.length,
      capitalInvestido: all.reduce((s, v) => s + parseFloat(v.custo ?? 0), 0),
      totalAReceber: all.filter((v) => v.status === "ativo").reduce((s, v) => s + parseFloat(v.total_a_receber ?? 0), 0),
      lucroBruto: all.reduce((s, v) => s + parseFloat(v.lucro_bruto ?? 0), 0),
      vendasAtivas: all.filter((v) => v.status === "ativo").length,
      vendasQuitadas: all.filter((v) => v.status === "quitado").length
    };
  })
});
var etiquetasRouter = router({
  listar: protectedProcedure.query(async ({ ctx }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) return [];
    const { data } = await sb2.from("etiquetas_contratos").select("*").order("nome").eq("user_id", ctx.user.id);
    return data ?? [];
  }),
  criar: protectedProcedure.input(z9.object({ nome: z9.string().min(1), cor: z9.string().default("#6366f1") })).mutation(async ({ ctx, input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { data, error } = await sb2.from("etiquetas_contratos").insert({ nome: input.nome, cor: input.cor, user_id: ctx.user.id }).select().single();
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data;
  }),
  remover: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await sb2.from("etiquetas_contratos").delete().eq("id", input.id).eq("user_id", ctx.user.id);
    return { success: true };
  }),
  aplicarContrato: protectedProcedure.input(z9.object({ contratoId: z9.number(), etiquetas: z9.array(z9.string()) })).mutation(async ({ ctx, input }) => {
    const sb2 = await getSupabaseClientAsync();
    if (!sb2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { error } = await sb2.from("contratos").update({ etiquetas: JSON.stringify(input.etiquetas) }).eq("id", input.contratoId);
    if (error) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  })
});
var onboardingRouter = router({
  check: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { completo: false, nomeEmpresa: null };
    const { data: row, error } = await supabase.from("users").select("onboarding_completo, nome_empresa").eq("id", ctx.user.id).single();
    if (error || !row) return { completo: false, nomeEmpresa: null };
    return { completo: !!row.onboarding_completo, nomeEmpresa: row.nome_empresa };
  }),
  complete: protectedProcedure.input(z9.object({
    nomeEmpresa: z9.string().min(1),
    nomeConta: z9.string().min(1).optional().default("Caixa Principal"),
    tipoConta: z9.enum(["caixa", "banco", "digital"]).optional().default("caixa")
  })).mutation(async ({ ctx, input }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "DB indispon\xEDvel" });
    await supabase.from("users").update({ onboarding_completo: true, nome_empresa: input.nomeEmpresa }).eq("id", ctx.user.id);
    const { data: contas } = await supabase.from("contas_caixa").select("id").eq("user_id", ctx.user.id).limit(1);
    if (!contas || contas.length === 0) {
      await supabase.from("contas_caixa").insert({
        user_id: ctx.user.id,
        nome: input.nomeConta,
        tipo: input.tipoConta,
        saldo_inicial: 0,
        ativa: true
      });
    }
    return { success: true };
  })
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  dashboard: dashboardRouter,
  clientes: clientesRouter,
  contratos: contratosRouter,
  parcelas: parcelasRouter,
  caixa: caixaRouter,
  portal: portalRouter,
  whatsapp: whatsappRouter,
  relatorios: relatoriosRouter,
  configuracoes: configuracoesRouter,
  cobradores: cobradoresRouter,
  reparcelamento: reparcelamentoRouter,
  contasPagar: contasPagarRouter,
  vendas: vendasRouter,
  cheques: chequesRouter,
  veiculos: veiculosRouter,
  vendasTelefone: vendasTelefoneRouter,
  etiquetas: etiquetasRouter,
  assinaturas: assinaturasRouter,
  backup: backupRouter,
  whatsappEvolution: whatsappEvolutionRouter,
  perfil: perfilRouter,
  relatorioDiario: relatorioDiarioRouter,
  notificacoes: notificacoesRouter,
  onboarding: onboardingRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import path from "path";
async function setupVite(app, server) {
  const { createServer: createViteServer } = await import("vite");
  const { nanoid: nanoid2 } = await import("nanoid");
  const { default: viteConfig } = await import("../../vite.config");
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path.resolve(import.meta.dirname, "../..", "dist", "public") : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
    etag: false,
    lastModified: false
  }));
  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true,
    lastModified: true,
    index: false
    // não servir index.html aqui, deixar para o fallback abaixo
  }));
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(compression());
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  registerAuthRoutes(app);
  registerWebhookRoutes(app);
  registerKiwifyWebhookRoutes(app);
  app.get("/api/diag", async (req, res) => {
    const results = {};
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    try {
      const dns2 = await import("dns").then((m) => m.promises);
      const addresses = await dns2.lookup(new URL(supabaseUrl).hostname, { all: true });
      results.dns = addresses.map((a) => a.address).join(", ");
    } catch (e) {
      results.dns = "FAILED: " + e.message;
    }
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { "apikey": supabaseKey },
        signal: AbortSignal.timeout(5e3)
      });
      results.fetch = `${response.status} ${response.statusText}`;
    } catch (e) {
      results.fetch = "FAILED: " + e.message;
    }
    results.nodeVersion = process.version;
    results.nodeOptions = process.env.NODE_OPTIONS || "not set";
    results.platform = process.platform;
    results.version = "e7614a81-modal-clientes-v3";
    try {
      const evoUrl = (process.env.EVOLUTION_API_URL || "http://147.182.191.118:8080").replace(/\/$/, "");
      const evoKey = process.env.EVOLUTION_API_KEY || "cobrapro_evo_key_2024";
      results.evoUrl = evoUrl;
      const evoResp = await fetch(`${evoUrl}/instance/fetchInstances`, {
        headers: { apikey: evoKey },
        signal: AbortSignal.timeout(8e3)
      });
      const evoBody = await evoResp.text();
      results.evolutionApi = `${evoResp.status} - ${evoBody.substring(0, 200)}`;
    } catch (e) {
      results.evolutionApi = "FAILED: " + e.message;
    }
    try {
      const evoUrl = (process.env.EVOLUTION_API_URL || "http://147.182.191.118:8080").replace(/\/$/, "");
      const evoKey = process.env.EVOLUTION_API_KEY || "cobrapro_evo_key_2024";
      const sendResp = await fetch(`${evoUrl}/message/sendText/user-4682`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: "5511911145280@s.whatsapp.net", textMessage: { text: "Teste diagnostico producao" } }),
        signal: AbortSignal.timeout(1e4)
      });
      const sendBody = await sendResp.text();
      results.evolutionSend = `${sendResp.status} - ${sendBody.substring(0, 300)}`;
    } catch (e) {
      results.evolutionSend = "FAILED: " + e.message;
    }
    res.json(results);
  });
  app.post("/api/scheduled/notificacoes", async (req, res) => {
    try {
      const { parse: parseCookieHeader2 } = await import("cookie");
      const { jwtVerify: jwtVerify2 } = await import("jose");
      const { getSupabaseClientAsync: getSupabaseClientAsync2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { substituirVariaveis: substituirVariaveis2, TIPOS_NOTIFICACAO: TIPOS_NOTIFICACAO2 } = await Promise.resolve().then(() => (init_notificacoes(), notificacoes_exports));
      const { ENV: ENV2 } = await Promise.resolve().then(() => (init_env(), env_exports));
      const cookies = parseCookieHeader2(req.headers.cookie || "");
      const sessionCookie = cookies["app_session_id"];
      if (!sessionCookie) {
        return res.status(401).json({ error: "N\xE3o autenticado" });
      }
      const sb2 = await getSupabaseClientAsync2();
      if (!sb2) return res.status(500).json({ error: "DB indispon\xEDvel" });
      const { data: configsAtivos } = await sb2.from("configuracoes").select("user_id").eq("chave", "notificacoes_auto_ativo").eq("valor", "true");
      if (!configsAtivos || configsAtivos.length === 0) {
        return res.json({ processados: 0, mensagem: "Nenhum usu\xE1rio com notifica\xE7\xF5es ativas" });
      }
      let totalEnviados = 0;
      const hoje = /* @__PURE__ */ new Date();
      hoje.setHours(0, 0, 0, 0);
      for (const cfg of configsAtivos) {
        const userId = cfg.user_id;
        const { data: regras } = await sb2.from("notificacoes_automaticas").select("*").eq("user_id", userId).eq("ativo", true);
        if (!regras || regras.length === 0) continue;
        const { data: empresaConfig } = await sb2.from("configuracoes").select("valor").eq("chave", "nomeEmpresa").eq("user_id", userId).maybeSingle();
        const nomeEmpresa = empresaConfig?.valor || "Empresa";
        for (const regra of regras) {
          const dataAlvo = new Date(hoje);
          dataAlvo.setDate(dataAlvo.getDate() + regra.dias_antes);
          const dataAlvoStr = dataAlvo.toISOString().split("T")[0];
          const { data: parcelasData } = await sb2.from("parcelas").select("id, valor, numero_parcela, contrato_id, contratos!inner(numero_parcelas, cliente_id, clientes!inner(id, nome, whatsapp, telefone))").eq("user_id", userId).eq("data_vencimento", dataAlvoStr).in("status", ["pendente", "atrasada"]);
          if (!parcelasData || parcelasData.length === 0) continue;
          for (const parcela of parcelasData) {
            const cliente = parcela.contratos?.clientes;
            if (!cliente) continue;
            const telefone = cliente.whatsapp || cliente.telefone;
            if (!telefone) continue;
            const { data: logExistente } = await sb2.from("notificacoes_log").select("id").eq("user_id", userId).eq("parcela_id", parcela.id).eq("tipo", regra.tipo).gte("createdAt", hoje.toISOString()).maybeSingle();
            if (logExistente) continue;
            const mensagem = substituirVariaveis2(regra.mensagem_template, {
              nome: cliente.nome,
              valor: parcela.valor,
              data_vencimento: dataAlvoStr.split("-").reverse().join("/"),
              dias_atraso: regra.dias_antes < 0 ? Math.abs(regra.dias_antes) : 0,
              empresa: nomeEmpresa,
              parcela: parcela.numero_parcela,
              total_parcelas: parcela.contratos?.numero_parcelas
            });
            const evoUrl = ENV2.evolutionApiUrl.replace(/\/$/, "");
            const evoKey = ENV2.evolutionApiKey;
            const instanceName = `user-${userId}`;
            let phone = telefone.replace(/\D/g, "");
            if (!phone.startsWith("55")) phone = "55" + phone;
            try {
              const sendRes = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoKey },
                body: JSON.stringify({ number: phone + "@s.whatsapp.net", textMessage: { text: mensagem } }),
                signal: AbortSignal.timeout(1e4)
              });
              const ok = sendRes.ok;
              await sb2.from("notificacoes_log").insert({
                user_id: userId,
                parcela_id: parcela.id,
                cliente_id: cliente.id,
                tipo: regra.tipo,
                telefone,
                mensagem,
                status: ok ? "enviado" : "erro",
                erro: ok ? null : "Falha no envio"
              });
              if (ok) totalEnviados++;
            } catch (e) {
              console.error("[scheduled/notificacoes] Erro ao enviar:", e);
            }
          }
        }
      }
      res.json({ success: true, enviados: totalEnviados, processados: configsAtivos.length });
    } catch (err) {
      console.error("[scheduled/notificacoes] Erro:", err);
      res.status(500).json({ error: String(err) });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server] Unhandled rejection at:", promise, "reason:", reason);
});
startServer().catch(console.error);
