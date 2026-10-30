CREATE TABLE `siniestro_archivos` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`siniestroId` bigint unsigned NOT NULL,
	`documentoId` bigint unsigned,
	`nombre` varchar(255) NOT NULL,
	`tipo` varchar(128) NOT NULL,
	`tamano` int NOT NULL,
	`contenido` longtext NOT NULL,
	`subidoPorId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siniestro_archivos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `arch_sin_idx` ON `siniestro_archivos` (`siniestroId`);