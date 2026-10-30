CREATE TABLE `aseguradoras` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`nombre` varchar(64) NOT NULL,
	`telefonoCabina` varchar(32),
	`activa` boolean NOT NULL DEFAULT true,
	CONSTRAINT `aseguradoras_id` PRIMARY KEY(`id`),
	CONSTRAINT `aseguradoras_nombre_unique` UNIQUE(`nombre`)
);
--> statement-breakpoint
CREATE TABLE `siniestro_conceptos` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`siniestroId` bigint unsigned NOT NULL,
	`concepto` varchar(255) NOT NULL,
	`importe` decimal(14,2) NOT NULL,
	`noProcedente` decimal(14,2) NOT NULL DEFAULT '0',
	`dictamen` enum('pendiente','procedente','parcial','no_procedente','por_corregir') NOT NULL DEFAULT 'pendiente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siniestro_conceptos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contratantes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`tipoPersona` enum('fisica','moral') NOT NULL DEFAULT 'fisica',
	`rfc` varchar(16),
	`contacto` varchar(255),
	`telefono` varchar(32),
	`email` varchar(255),
	`ejecutivoId` bigint unsigned,
	`clienteDesde` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contratantes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siniestro_documentos` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`siniestroId` bigint unsigned NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`estado` enum('pendiente','recibido','en_revision','validado','correccion') NOT NULL DEFAULT 'pendiente',
	`orden` int NOT NULL DEFAULT 0,
	`nota` varchar(500),
	`actualizadoPorId` bigint unsigned,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siniestro_documentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siniestro_eventos` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`siniestroId` bigint unsigned NOT NULL,
	`tipo` enum('alta','estatus','nota','documento','pago','financiero','edicion','accion','tercero') NOT NULL,
	`estadoAnterior` enum('reportado','recopilacion','documentacion_completa','ingresado','en_revision','info_adicional','autorizado','pago_parcial','pagado','rechazado','cerrado'),
	`estadoNuevo` enum('reportado','recopilacion','documentacion_completa','ingresado','en_revision','info_adicional','autorizado','pago_parcial','pagado','rechazado','cerrado'),
	`folio` varchar(128),
	`nota` text,
	`autorId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siniestro_eventos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siniestro_pagos` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`siniestroId` bigint unsigned NOT NULL,
	`concepto` varchar(255) NOT NULL,
	`fecha` date NOT NULL,
	`monto` decimal(14,2) NOT NULL,
	`forma` enum('transferencia','cheque','pago_directo','otro') NOT NULL DEFAULT 'transferencia',
	`referencia` varchar(128) NOT NULL,
	`registradoPorId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siniestro_pagos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `polizas` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`numero` varchar(64) NOT NULL,
	`aseguradoraId` bigint unsigned NOT NULL,
	`contratanteId` bigint unsigned NOT NULL,
	`ramo` enum('autos','flot','gmmi','gmmc','ap','vida','danos','casa','rc','trans') NOT NULL,
	`descripcion` varchar(255),
	`vigenciaInicio` date,
	`vigenciaFin` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `polizas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siniestros` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`folio` varchar(32) NOT NULL,
	`contratanteId` bigint unsigned NOT NULL,
	`polizaId` bigint unsigned,
	`polizaTexto` varchar(64),
	`aseguradoraId` bigint unsigned NOT NULL,
	`ramo` enum('autos','flot','gmmi','gmmc','ap','vida','danos','casa','rc','trans') NOT NULL,
	`tipo` varchar(64) NOT NULL,
	`afectado` varchar(255) NOT NULL,
	`descripcion` text,
	`numeroSiniestro` varchar(64),
	`fechaOcurrido` date NOT NULL,
	`fechaReporte` date NOT NULL,
	`fechaIngreso` date,
	`estado` enum('reportado','recopilacion','documentacion_completa','ingresado','en_revision','info_adicional','autorizado','pago_parcial','pagado','rechazado','cerrado') NOT NULL DEFAULT 'reportado',
	`ejecutivoId` bigint unsigned NOT NULL,
	`proximaAccion` varchar(500),
	`fechaCompromiso` date,
	`gastado` decimal(14,2),
	`reclamado` decimal(14,2),
	`noProcedente` decimal(14,2),
	`deducible` decimal(14,2),
	`coaseguro` decimal(14,2),
	`autorizado` decimal(14,2),
	`numeroReporte` varchar(64),
	`ajustadorNombre` varchar(128),
	`ajustadorTelefono` varchar(32),
	`tallerNombre` varchar(128),
	`lugar` varchar(255),
	`conductorNombre` varchar(128),
	`responsabilidad` enum('por_definir','asegurado','tercero','compartida') NOT NULL DEFAULT 'por_definir',
	`ultimoMovimiento` timestamp NOT NULL DEFAULT (now()),
	`creadoPorId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siniestros_id` PRIMARY KEY(`id`),
	CONSTRAINT `siniestros_folio_unique` UNIQUE(`folio`)
);
--> statement-breakpoint
CREATE TABLE `terceros` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`siniestroId` bigint unsigned NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`telefono` varchar(32),
	`vehiculo` varchar(128),
	`placas` varchar(16),
	`aseguradora` varchar(64),
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `terceros_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`nombre` varchar(128) NOT NULL,
	`puesto` varchar(128),
	`passwordHash` varchar(255),
	`role` enum('admin','ejecutivo','consulta') NOT NULL DEFAULT 'ejecutivo',
	`activo` boolean NOT NULL DEFAULT true,
	`debeCambiarPassword` boolean NOT NULL DEFAULT false,
	`intentosFallidos` int NOT NULL DEFAULT 0,
	`bloqueadoHasta` timestamp,
	`ultimoAcceso` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE INDEX `con_sin_idx` ON `siniestro_conceptos` (`siniestroId`);--> statement-breakpoint
CREATE INDEX `con_nombre_idx` ON `contratantes` (`nombre`);--> statement-breakpoint
CREATE INDEX `doc_sin_idx` ON `siniestro_documentos` (`siniestroId`);--> statement-breakpoint
CREATE INDEX `evt_sin_idx` ON `siniestro_eventos` (`siniestroId`);--> statement-breakpoint
CREATE INDEX `pag_sin_idx` ON `siniestro_pagos` (`siniestroId`);--> statement-breakpoint
CREATE INDEX `pol_con_idx` ON `polizas` (`contratanteId`);--> statement-breakpoint
CREATE INDEX `pol_num_idx` ON `polizas` (`numero`);--> statement-breakpoint
CREATE INDEX `sin_con_idx` ON `siniestros` (`contratanteId`);--> statement-breakpoint
CREATE INDEX `sin_pol_idx` ON `siniestros` (`polizaId`);--> statement-breakpoint
CREATE INDEX `sin_estado_idx` ON `siniestros` (`estado`);--> statement-breakpoint
CREATE INDEX `sin_ejec_idx` ON `siniestros` (`ejecutivoId`);--> statement-breakpoint
CREATE INDEX `ter_sin_idx` ON `terceros` (`siniestroId`);