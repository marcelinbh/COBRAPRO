ALTER TABLE `clientes` ADD `rg` varchar(20);--> statement-breakpoint
ALTER TABLE `clientes` ADD `cnpj` varchar(20);--> statement-breakpoint
ALTER TABLE `clientes` ADD `instagram` varchar(100);--> statement-breakpoint
ALTER TABLE `clientes` ADD `facebook` varchar(255);--> statement-breakpoint
ALTER TABLE `clientes` ADD `profissao` varchar(100);--> statement-breakpoint
ALTER TABLE `clientes` ADD `foto_url` varchar(500);--> statement-breakpoint
ALTER TABLE `clientes` ADD `bairro` varchar(100);--> statement-breakpoint
ALTER TABLE `clientes` ADD `numero` varchar(20);--> statement-breakpoint
ALTER TABLE `clientes` ADD `complemento` varchar(100);--> statement-breakpoint
ALTER TABLE `clientes` ADD `data_nascimento` date;--> statement-breakpoint
ALTER TABLE `clientes` ADD `sexo` enum('masculino','feminino','outro');--> statement-breakpoint
ALTER TABLE `clientes` ADD `estado_civil` enum('solteiro','casado','divorciado','viuvo','outro');--> statement-breakpoint
ALTER TABLE `clientes` ADD `nome_mae` varchar(255);--> statement-breakpoint
ALTER TABLE `clientes` ADD `nome_pai` varchar(255);