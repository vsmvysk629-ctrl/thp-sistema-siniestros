CREATE TABLE `borradores` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`siniestroId` bigint unsigned NOT NULL,
	`motivo` enum('documentos','info_adicional','sin_respuesta','pago') NOT NULL,
	`para` enum('cliente','aseguradora') NOT NULL,
	`texto` text NOT NULL,
	`estado` enum('pendiente','aprobado','enviado','descartado') NOT NULL DEFAULT 'pendiente',
	`revisadoPorId` bigint unsigned,
	`revisadoAt` timestamp,
	`enviadoPorId` bigint unsigned,
	`enviadoAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `borradores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bor_sin_idx` ON `borradores` (`siniestroId`);--> statement-breakpoint
CREATE INDEX `bor_estado_idx` ON `borradores` (`estado`);