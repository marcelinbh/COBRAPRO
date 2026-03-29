import {
  bigint,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  date,
} from "drizzle-orm/mysql-core";

// ─── USERS (auth) ────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── KOLETORES (usuários internos do sistema) ─────────────────────────────────
export const koletores = mysqlTable("koletores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  perfil: mysqlEnum("perfil", ["admin", "gerente", "koletor"]).default("koletor").notNull(),
  limiteEmprestimo: decimal("limite_emprestimo", { precision: 15, scale: 2 }).default("0.00"),
  comissaoPercentual: decimal("comissao_percentual", { precision: 8, scale: 4 }).default("0.00"),
  ativo: boolean("ativo").default(true).notNull(),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Koletor = typeof koletores.$inferSelect;
export type InsertKoletor = typeof koletores.$inferInsert;

// ─── CLIENTES ────────────────────────────────────────────────────────────────
export const clientes = mysqlTable("clientes", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cpfCnpj: varchar("cpf_cnpj", { length: 20 }),
  telefone: varchar("telefone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  email: varchar("email", { length: 320 }),
  chavePix: varchar("chave_pix", { length: 255 }),
  tipoChavePix: mysqlEnum("tipo_chave_pix", ["cpf", "cnpj", "email", "telefone", "aleatoria"]),
  endereco: text("endereco"),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  cep: varchar("cep", { length: 9 }),
  observacoes: text("observacoes"),
  score: int("score").default(100),
  // Fase 2: novos campos
  categoria: mysqlEnum("categoria", ["bronze", "prata", "ouro", "prefeitura", "padrao"]).default("padrao"),
  qualificacao: mysqlEnum("qualificacao", ["bom", "medio", "ruim"]).default("bom"),
  limiteCredito: decimal("limite_credito", { precision: 15, scale: 2 }).default("0.00"),
  limiteDisponivel: decimal("limite_disponivel", { precision: 15, scale: 2 }).default("0.00"),
  koletorId: int("koletor_id"),
  banco: varchar("banco", { length: 100 }),
  agencia: varchar("agencia", { length: 20 }),
  numeroConta: varchar("numero_conta", { length: 30 }),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

// ─── CONTAS DE CAIXA ─────────────────────────────────────────────────────────
export const contasCaixa = mysqlTable("contas_caixa", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: mysqlEnum("tipo", ["caixa_fisico", "banco", "digital"]).default("caixa_fisico").notNull(),
  banco: varchar("banco", { length: 100 }),
  agencia: varchar("agencia", { length: 20 }),
  numeroConta: varchar("numero_conta", { length: 30 }),
  saldoInicial: decimal("saldo_inicial", { precision: 15, scale: 2 }).default("0.00").notNull(),
  ativa: boolean("ativa").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContaCaixa = typeof contasCaixa.$inferSelect;
export type InsertContaCaixa = typeof contasCaixa.$inferInsert;

// ─── CONTRATOS ───────────────────────────────────────────────────────────────
export const contratos = mysqlTable("contratos", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("cliente_id").notNull(),
  koletorId: int("koletor_id"),
  modalidade: mysqlEnum("modalidade", [
    "emprestimo_padrao",
    "emprestimo_diario",
    "tabela_price",
    "venda_produto",
    "desconto_cheque",
    "reparcelamento",
  ]).notNull(),
  status: mysqlEnum("status", ["ativo", "quitado", "inadimplente", "cancelado"]).default("ativo").notNull(),
  valorPrincipal: decimal("valor_principal", { precision: 15, scale: 2 }).notNull(),
  taxaJuros: decimal("taxa_juros", { precision: 8, scale: 4 }).notNull(),
  tipoTaxa: mysqlEnum("tipo_taxa", ["mensal", "diaria", "anual"]).default("mensal").notNull(),
  numeroParcelas: int("numero_parcelas").notNull(),
  valorParcela: decimal("valor_parcela", { precision: 15, scale: 2 }).notNull(),
  multaAtraso: decimal("multa_atraso", { precision: 8, scale: 4 }).default("2.00"),
  jurosMoraDiario: decimal("juros_mora_diario", { precision: 8, scale: 4 }).default("0.033"),
  dataInicio: date("data_inicio").notNull(),
  dataVencimentoPrimeira: date("data_vencimento_primeira").notNull(),
  diaVencimento: int("dia_vencimento"),
  descricao: text("descricao"),
  observacoes: text("observacoes"),
  contaCaixaId: int("conta_caixa_id"),
  // Fase 2: reparcelamento
  contratoOrigemId: int("contrato_origem_id"),
  // Fase 2: contrato digital
  contratoAssinado: boolean("contrato_assinado").default(false),
  contratoUrl: varchar("contrato_url", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contrato = typeof contratos.$inferSelect;
export type InsertContrato = typeof contratos.$inferInsert;

// ─── PARCELAS ────────────────────────────────────────────────────────────────
export const parcelas = mysqlTable("parcelas", {
  id: int("id").autoincrement().primaryKey(),
  contratoId: int("contrato_id").notNull(),
  clienteId: int("cliente_id").notNull(),
  koletorId: int("koletor_id"),
  numeroParcela: int("numero_parcela").notNull(),
  valorOriginal: decimal("valor_original", { precision: 15, scale: 2 }).notNull(),
  valorPago: decimal("valor_pago", { precision: 15, scale: 2 }),
  valorJuros: decimal("valor_juros", { precision: 15, scale: 2 }).default("0.00"),
  valorMulta: decimal("valor_multa", { precision: 15, scale: 2 }).default("0.00"),
  valorDesconto: decimal("valor_desconto", { precision: 15, scale: 2 }).default("0.00"),
  dataVencimento: date("data_vencimento").notNull(),
  dataPagamento: timestamp("data_pagamento"),
  status: mysqlEnum("status", ["pendente", "paga", "atrasada", "vencendo_hoje", "parcial"]).default("pendente").notNull(),
  contaCaixaId: int("conta_caixa_id"),
  observacoes: text("observacoes"),
  // Fase 2: multa manual
  multaManual: decimal("multa_manual", { precision: 15, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Parcela = typeof parcelas.$inferSelect;
export type InsertParcela = typeof parcelas.$inferInsert;

// ─── TRANSAÇÕES DE CAIXA ─────────────────────────────────────────────────────
export const transacoesCaixa = mysqlTable("transacoes_caixa", {
  id: int("id").autoincrement().primaryKey(),
  contaCaixaId: int("conta_caixa_id").notNull(),
  tipo: mysqlEnum("tipo", ["entrada", "saida", "transferencia"]).notNull(),
  categoria: mysqlEnum("categoria", [
    "pagamento_parcela",
    "emprestimo_liberado",
    "despesa_operacional",
    "transferencia_conta",
    "ajuste_manual",
    "outros",
  ]).notNull(),
  valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
  descricao: text("descricao"),
  parcelaId: int("parcela_id"),
  contratoId: int("contrato_id"),
  clienteId: int("cliente_id"),
  // Fase 2: conta destino para transferências
  contaDestinoId: int("conta_destino_id"),
  dataTransacao: timestamp("data_transacao").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TransacaoCaixa = typeof transacoesCaixa.$inferSelect;
export type InsertTransacaoCaixa = typeof transacoesCaixa.$inferInsert;

// ─── MAGIC LINKS (Portal do Cliente) ─────────────────────────────────────────
export const magicLinks = mysqlTable("magic_links", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("cliente_id").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usado: boolean("usado").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MagicLink = typeof magicLinks.$inferSelect;
export type InsertMagicLink = typeof magicLinks.$inferInsert;

// ─── TEMPLATES WHATSAPP ───────────────────────────────────────────────────────
export const templatesWhatsapp = mysqlTable("templates_whatsapp", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: mysqlEnum("tipo", [
    "cobranca_geral",
    "cobranca_vencida",
    "lembrete_vencimento",
    "confirmacao_pagamento",
    "boas_vindas",
    "pix_transferencia",
    "personalizado",
  ]).notNull(),
  mensagem: text("mensagem").notNull(),
  // Fase 2: variáveis suportadas e múltiplos templates
  ativo: boolean("ativo").default(true).notNull(),
  padrao: boolean("padrao").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TemplateWhatsapp = typeof templatesWhatsapp.$inferSelect;
export type InsertTemplateWhatsapp = typeof templatesWhatsapp.$inferInsert;

// ─── CONFIGURAÇÕES DO SISTEMA ─────────────────────────────────────────────────
export const configuracoes = mysqlTable("configuracoes", {
  id: int("id").autoincrement().primaryKey(),
  chave: varchar("chave", { length: 100 }).notNull().unique(),
  valor: text("valor"),
  descricao: text("descricao"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Configuracao = typeof configuracoes.$inferSelect;
export type InsertConfiguracao = typeof configuracoes.$inferInsert;
