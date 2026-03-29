CREATE TABLE `configuracoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chave` varchar(100) NOT NULL,
	`valor` text,
	`descricao` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoes_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuracoes_chave_unique` UNIQUE(`chave`)
);
--> statement-breakpoint
CREATE TABLE `koletores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`nome` varchar(255) NOT NULL,
	`email` varchar(320),
	`telefone` varchar(20),
	`whatsapp` varchar(20),
	`perfil` enum('admin','gerente','koletor') NOT NULL DEFAULT 'koletor',
	`limite_emprestimo` decimal(15,2) DEFAULT '0.00',
	`comissao_percentual` decimal(8,4) DEFAULT '0.00',
	`ativo` boolean NOT NULL DEFAULT true,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `koletores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contratos` MODIFY COLUMN `modalidade` enum('emprestimo_padrao','emprestimo_diario','tabela_price','venda_produto','desconto_cheque','reparcelamento') NOT NULL;--> statement-breakpoint
ALTER TABLE `templates_whatsapp` MODIFY COLUMN `tipo` enum('cobranca_geral','cobranca_vencida','lembrete_vencimento','confirmacao_pagamento','boas_vindas','pix_transferencia','personalizado') NOT NULL;--> statement-breakpoint
ALTER TABLE `clientes` ADD `categoria` enum('bronze','prata','ouro','prefeitura','padrao') DEFAULT 'padrao';--> statement-breakpoint
ALTER TABLE `clientes` ADD `qualificacao` enum('bom','medio','ruim') DEFAULT 'bom';--> statement-breakpoint
ALTER TABLE `clientes` ADD `limite_credito` decimal(15,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `clientes` ADD `limite_disponivel` decimal(15,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `clientes` ADD `koletor_id` int;--> statement-breakpoint
ALTER TABLE `clientes` ADD `banco` varchar(100);--> statement-breakpoint
ALTER TABLE `clientes` ADD `agencia` varchar(20);--> statement-breakpoint
ALTER TABLE `clientes` ADD `numero_conta` varchar(30);--> statement-breakpoint
ALTER TABLE `contratos` ADD `koletor_id` int;--> statement-breakpoint
ALTER TABLE `contratos` ADD `contrato_origem_id` int;--> statement-breakpoint
ALTER TABLE `contratos` ADD `contrato_assinado` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contratos` ADD `contrato_url` varchar(500);--> statement-breakpoint
ALTER TABLE `parcelas` ADD `koletor_id` int;--> statement-breakpoint
ALTER TABLE `parcelas` ADD `multa_manual` decimal(15,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `templates_whatsapp` ADD `padrao` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `transacoes_caixa` ADD `conta_destino_id` int;