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
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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
  modalidade: mysqlEnum("modalidade", [
    "emprestimo_padrao",
    "emprestimo_diario",
    "tabela_price",
    "venda_produto",
    "desconto_cheque",
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
  tipo: mysqlEnum("tipo", ["cobranca", "lembrete", "confirmacao", "boas_vindas"]).notNull(),
  mensagem: text("mensagem").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TemplateWhatsapp = typeof templatesWhatsapp.$inferSelect;
export type InsertTemplateWhatsapp = typeof templatesWhatsapp.$inferInsert;
