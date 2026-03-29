CREATE TABLE `contas_pagar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`descricao` varchar(255) NOT NULL,
	`categoria` enum('aluguel','salario','servicos','impostos','fornecedores','marketing','tecnologia','outros') NOT NULL DEFAULT 'outros',
	`valor` decimal(15,2) NOT NULL,
	`data_vencimento` date NOT NULL,
	`data_pagamento` timestamp,
	`status` enum('pendente','paga','atrasada','cancelada') NOT NULL DEFAULT 'pendente',
	`conta_caixa_id` int,
	`recorrente` boolean NOT NULL DEFAULT false,
	`periodicidade` enum('mensal','semanal','anual','unica') DEFAULT 'unica',
	`observacoes` text,
	`comprovante` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contas_pagar_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`preco` decimal(15,2) NOT NULL,
	`estoque` int NOT NULL DEFAULT 0,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `produtos_id` PRIMARY KEY(`id`)
);
