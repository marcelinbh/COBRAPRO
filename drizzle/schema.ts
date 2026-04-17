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
  pgEnum,
} from "drizzle-orm/pg-core";

// ─── ENUMS ───────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const perfilEnum = pgEnum("perfil", ["admin", "gerente", "koletor"]);
export const categoriaClienteEnum = pgEnum("categoria_cliente", ["bronze", "prata", "ouro", "prefeitura", "padrao"]);
export const qualificacaoEnum = pgEnum("qualificacao", ["bom", "medio", "ruim"]);
export const tipoChavePixEnum = pgEnum("tipo_chave_pix", ["cpf", "cnpj", "email", "telefone", "aleatoria"]);
export const tipoCaixaEnum = pgEnum("tipo_caixa", ["caixa", "banco", "digital"]);
export const modalidadeEnum = pgEnum("modalidade", [
  "emprestimo_padrao", "emprestimo_diario", "tabela_price",
  "venda_produto", "desconto_cheque", "reparcelamento",
]);
export const statusContratoEnum = pgEnum("status_contrato", ["ativo", "quitado", "inadimplente", "cancelado"]);
export const tipoTaxaEnum = pgEnum("tipo_taxa", ["diaria", "semanal", "quinzenal", "mensal", "anual"]);
export const statusParcelaEnum = pgEnum("status_parcela", ["pendente", "paga", "atrasada", "vencendo_hoje", "parcial"]);
export const tipoTransacaoEnum = pgEnum("tipo_transacao", ["entrada", "saida", "transferencia"]);
export const categoriaTransacaoEnum = pgEnum("categoria_transacao", [
  "pagamento_parcela", "emprestimo_liberado", "despesa_operacional",
  "transferencia_conta", "ajuste_manual", "outros",
]);
export const tipoTemplateEnum = pgEnum("tipo_template", [
  "cobranca_geral", "cobranca_vencida", "lembrete_vencimento",
  "confirmacao_pagamento", "boas_vindas", "pix_transferencia", "personalizado",
]);
export const categoriaContaPagarEnum = pgEnum("categoria_conta_pagar", [
  "aluguel", "salario", "servicos", "impostos", "fornecedores", "marketing", "tecnologia", "outros",
]);
export const statusContaPagarEnum = pgEnum("status_conta_pagar", ["pendente", "paga", "atrasada", "cancelada"]);
export const periodicidadeEnum = pgEnum("periodicidade", ["mensal", "semanal", "anual", "unica"]);
export const tipoTaxaChequeEnum = pgEnum("tipo_taxa_cheque", ["mensal", "diaria", "anual"]);
export const statusChequeEnum = pgEnum("status_cheque", ["aguardando", "compensado", "devolvido", "cancelado"]);
export const sexoEnum = pgEnum("sexo", ["masculino", "feminino", "outro"]);
export const estadoCivilEnum = pgEnum("estado_civil", ["solteiro", "casado", "divorciado", "viuvo", "outro"]);

// ─── USERS (auth) ────────────────────────────────────────────────────────────
export const users = pgTable("users", {
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
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── KOLETORES ────────────────────────────────────────────────────────────────
export const koletores = pgTable("koletores", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Koletor = typeof koletores.$inferSelect;
export type InsertKoletor = typeof koletores.$inferInsert;

// ─── CLIENTES ────────────────────────────────────────────────────────────────
export const clientes = pgTable("clientes", {
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
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

// ─── CONTAS DE CAIXA ─────────────────────────────────────────────────────────
export const contasCaixa = pgTable("contas_caixa", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ContaCaixa = typeof contasCaixa.$inferSelect;
export type InsertContaCaixa = typeof contasCaixa.$inferInsert;

// ─── CONTRATOS ───────────────────────────────────────────────────────────────
export const contratos = pgTable("contratos", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Contrato = typeof contratos.$inferSelect;
export type InsertContrato = typeof contratos.$inferInsert;

// ─── PARCELAS ────────────────────────────────────────────────────────────────
export const parcelas = pgTable("parcelas", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Parcela = typeof parcelas.$inferSelect;
export type InsertParcela = typeof parcelas.$inferInsert;

// ─── TRANSAÇÕES DE CAIXA ─────────────────────────────────────────────────────
export const transacoesCaixa = pgTable("transacoes_caixa", {
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
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type TransacaoCaixa = typeof transacoesCaixa.$inferSelect;
export type InsertTransacaoCaixa = typeof transacoesCaixa.$inferInsert;

// ─── MAGIC LINKS ─────────────────────────────────────────────────────────────
export const magicLinks = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usado: boolean("usado").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type MagicLink = typeof magicLinks.$inferSelect;
export type InsertMagicLink = typeof magicLinks.$inferInsert;

// ─── TEMPLATES WHATSAPP ───────────────────────────────────────────────────────
export const templatesWhatsapp = pgTable("templates_whatsapp", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: tipoTemplateEnum("tipo").notNull(),
  mensagem: text("mensagem").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  padrao: boolean("padrao").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type TemplateWhatsapp = typeof templatesWhatsapp.$inferSelect;
export type InsertTemplateWhatsapp = typeof templatesWhatsapp.$inferInsert;

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
export const configuracoes = pgTable("configuracoes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  chave: varchar("chave", { length: 100 }).notNull(),
  valor: text("valor"),
  descricao: text("descricao"),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Configuracao = typeof configuracoes.$inferSelect;
export type InsertConfiguracao = typeof configuracoes.$inferInsert;

// ─── CONTAS A PAGAR ───────────────────────────────────────────────────────────
export const contasPagar = pgTable("contas_pagar", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ContaPagar = typeof contasPagar.$inferSelect;
export type InsertContaPagar = typeof contasPagar.$inferInsert;

// ─── PRODUTOS ────────────────────────────────────────────────────────────────
export const produtos = pgTable("produtos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  preco: decimal("preco", { precision: 15, scale: 2 }).notNull(),
  estoque: integer("estoque").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Produto = typeof produtos.$inferSelect;
export type InsertProduto = typeof produtos.$inferInsert;

// ─── CHEQUES ─────────────────────────────────────────────────────────────────
export const cheques = pgTable("cheques", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Cheque = typeof cheques.$inferSelect;
export type InsertCheque = typeof cheques.$inferInsert;

// ─── RESET DE SENHA ───────────────────────────────────────────────────────────
export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usado: boolean("usado").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type PasswordReset = typeof passwordResets.$inferSelect;
export type InsertPasswordReset = typeof passwordResets.$inferInsert;

// ─── VEÍCULOS ─────────────────────────────────────────────────────────────────
export const veiculos = pgTable("veiculos", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Veiculo = typeof veiculos.$inferSelect;
export type InsertVeiculo = typeof veiculos.$inferInsert;

// ─── PARCELAS DE VEÍCULOS ─────────────────────────────────────────────────────
export const parcelasVeiculo = pgTable("parcelas_veiculo", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ParcelaVeiculo = typeof parcelasVeiculo.$inferSelect;
export type InsertParcelaVeiculo = typeof parcelasVeiculo.$inferInsert;

// ─── VENDA DE TELEFONE ────────────────────────────────────────────────────────
export const statusVendaTelefoneEnum = pgEnum("status_venda_telefone", [
  "ativo", "quitado", "inadimplente", "cancelado"
]);

export const vendas_telefone = pgTable("vendas_telefone", {
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
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const parcelas_venda_telefone = pgTable("parcelas_venda_telefone", {
  id: serial("id").primaryKey(),
  venda_id: integer("venda_id").notNull(),
  numero: integer("numero").notNull(),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
  vencimento: timestamp("vencimento", { withTimezone: true }).notNull(),
  status: statusParcelaEnum("status").default("pendente").notNull(),
  pago_em: timestamp("pago_em", { withTimezone: true }),
  valor_pago: decimal("valor_pago", { precision: 12, scale: 2 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

// ─── ASSINATURAS / IPTV ───────────────────────────────────────────────────────
export const statusAssinaturaEnum = pgEnum("status_assinatura", [
  "ativa", "cancelada", "suspensa", "inadimplente"
]);

export const assinaturas = pgTable("assinaturas", {
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
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Assinatura = typeof assinaturas.$inferSelect;
export type InsertAssinatura = typeof assinaturas.$inferInsert;

export const pagamentosAssinatura = pgTable("pagamentos_assinatura", {
  id: serial("id").primaryKey(),
  assinaturaId: integer("assinatura_id").notNull(),
  clienteId: integer("cliente_id").notNull(),
  valorPago: decimal("valor_pago", { precision: 15, scale: 2 }).notNull(),
  dataPagamento: timestamp("data_pagamento", { withTimezone: true }).defaultNow().notNull(),
  mesReferencia: varchar("mes_referencia", { length: 7 }).notNull(),
  contaCaixaId: integer("conta_caixa_id"),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type PagamentoAssinatura = typeof pagamentosAssinatura.$inferSelect;
export type InsertPagamentoAssinatura = typeof pagamentosAssinatura.$inferInsert;
