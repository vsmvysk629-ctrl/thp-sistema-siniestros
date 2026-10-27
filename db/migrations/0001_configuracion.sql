CREATE TABLE `ajustes` (
	`clave` varchar(64) NOT NULL,
	`valor` varchar(500) NOT NULL,
	CONSTRAINT `ajustes_clave` PRIMARY KEY(`clave`)
);
--> statement-breakpoint
CREATE TABLE `plantillas_documento` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ramo` enum('autos','flot','gmmi','gmmc','ap','vida','danos','casa','rc','trans') NOT NULL,
	`tipo` varchar(64),
	`aseguradoraId` bigint unsigned,
	`nombre` varchar(255) NOT NULL,
	`orden` int NOT NULL DEFAULT 0,
	`activo` boolean NOT NULL DEFAULT true,
	CONSTRAINT `plantillas_documento_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tipos_siniestro` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ramo` enum('autos','flot','gmmi','gmmc','ap','vida','danos','casa','rc','trans') NOT NULL,
	`nombre` varchar(64) NOT NULL,
	`orden` int NOT NULL DEFAULT 0,
	`activo` boolean NOT NULL DEFAULT true,
	CONSTRAINT `tipos_siniestro_id` PRIMARY KEY(`id`),
	CONSTRAINT `tipo_ramo_nombre` UNIQUE(`ramo`,`nombre`)
);
--> statement-breakpoint
ALTER TABLE `aseguradoras` ADD `diasSinRespuesta` int;--> statement-breakpoint
ALTER TABLE `aseguradoras` ADD `notas` varchar(500);--> statement-breakpoint
CREATE INDEX `pla_ramo_idx` ON `plantillas_documento` (`ramo`);