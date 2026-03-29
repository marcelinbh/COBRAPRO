CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`cpf_cnpj` varchar(20),
	`telefone` varchar(20),
	`whatsapp` varchar(20),
	`email` varchar(320),
	`chave_pix` varchar(255),
	`tipo_chave_pix` enum('cpf','cnpj','email','telefone','aleatoria'),
	`endereco` text,
	`cidade` varchar(100),
	`estado` varchar(2),
	`cep` varchar(9),
	`observacoes` text,
	`score` int DEFAULT 100,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contas_caixa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(100) NOT NULL,
	`tipo` enum('caixa_fisico','banco','digital') NOT NULL DEFAULT 'caixa_fisico',
	`banco` varchar(100),
	`agencia` varchar(20),
	`numero_conta` varchar(30),
	`saldo_inicial` decimal(15,2) NOT NULL DEFAULT '0.00',
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contas_caixa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contratos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cliente_id` int NOT NULL,
	`modalidade` enum('emprestimo_padrao','emprestimo_diario','tabela_price','venda_produto','desconto_cheque') NOT NULL,
	`status` enum('ativo','quitado','inadimplente','cancelado') NOT NULL DEFAULT 'ativo',
	`valor_principal` decimal(15,2) NOT NULL,
	`taxa_juros` decimal(8,4) NOT NULL,
	`tipo_taxa` enum('mensal','diaria','anual') NOT NULL DEFAULT 'mensal',
	`numero_parcelas` int NOT NULL,
	`valor_parcela` decimal(15,2) NOT NULL,
	`multa_atraso` decimal(8,4) DEFAULT '2.00',
	`juros_mora_diario` decimal(8,4) DEFAULT '0.033',
	`data_inicio` date NOT NULL,
	`data_vencimento_primeira` date NOT NULL,
	`dia_vencimento` int,
	`descricao` text,
	`observacoes` text,
	`conta_caixa_id` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contratos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `magic_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cliente_id` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`usado` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `magic_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `magic_links_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `parcelas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contrato_id` int NOT NULL,
	`cliente_id` int NOT NULL,
	`numero_parcela` int NOT NULL,
	`valor_original` decimal(15,2) NOT NULL,
	`valor_pago` decimal(15,2),
	`valor_juros` decimal(15,2) DEFAULT '0.00',
	`valor_multa` decimal(15,2) DEFAULT '0.00',
	`valor_desconto` decimal(15,2) DEFAULT '0.00',
	`data_vencimento` date NOT NULL,
	`data_pagamento` timestamp,
	`status` enum('pendente','paga','atrasada','vencendo_hoje','parcial') NOT NULL DEFAULT 'pendente',
	`conta_caixa_id` int,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parcelas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templates_whatsapp` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(100) NOT NULL,
	`tipo` enum('cobranca','lembrete','confirmacao','boas_vindas') NOT NULL,
	`mensagem` text NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_whatsapp_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transacoes_caixa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conta_caixa_id` int NOT NULL,
	`tipo` enum('entrada','saida','transferencia') NOT NULL,
	`categoria` enum('pagamento_parcela','emprestimo_liberado','despesa_operacional','transferencia_conta','ajuste_manual','outros') NOT NULL,
	`valor` decimal(15,2) NOT NULL,
	`descricao` text,
	`parcela_id` int,
	`contrato_id` int,
	`cliente_id` int,
	`data_transacao` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transacoes_caixa_id` PRIMARY KEY(`id`)
);
