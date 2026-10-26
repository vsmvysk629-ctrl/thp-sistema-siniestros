CREATE TABLE `aseguradoras` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`nombre` varchar(64) NOT NULL,
	`telefonoCabina` varchar(32),
	`activa` boolean NOT NULL DEFAULT true,
	CONSTRAINT `aseguradoras_id` PRIMARY KEY(`id`),
	CONSTRAINT `aseguradoras_nombre_unique` UNIQUE(`nombre`)
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`telefono` varchar(32),
	`email` varchar(255),
	`vendedorId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `polizas` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`numero` varchar(64) NOT NULL,
	`aseguradoraId` bigint unsigned NOT NULL,
	`clienteId` bigint unsigned NOT NULL,
	`vigenciaInicio` date,
	`vigenciaFin` date,
	`cobertura` enum('amplia','limitada','rc') NOT NULL DEFAULT 'amplia',
	`vehiculoMarca` varchar(64),
	`vehiculoModelo` varchar(64),
	`vehiculoAnio` int,
	`vehiculoPlacas` varchar(16),
	`vehiculoSerie` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `polizas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siniestro_eventos` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`siniestroId` bigint unsigned NOT NULL,
	`tipo` enum('alta','cambio_estado','edicion','nota','tercero') NOT NULL,
	`estadoAnterior` enum('reportado','ajustador_asignado','valuacion','orden_admision','en_reparacion','listo_entrega','entregado','pago_danos','perdida_total','documentos_indemnizacion','finiquito','pago_confirmado','cerrado','rechazado','cancelado'),
	`estadoNuevo` enum('reportado','ajustador_asignado','valuacion','orden_admision','en_reparacion','listo_entrega','entregado','pago_danos','perdida_total','documentos_indemnizacion','finiquito','pago_confirmado','cerrado','rechazado','cancelado'),
	`folio` varchar(128),
	`nota` text,
	`autorId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siniestro_eventos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siniestros` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`folio` varchar(32) NOT NULL,
	`polizaId` bigint unsigned NOT NULL,
	`clienteId` bigint unsigned NOT NULL,
	`aseguradoraId` bigint unsigned NOT NULL,
	`numeroReporte` varchar(64),
	`numeroSiniestro` varchar(64),
	`ajustadorNombre` varchar(128),
	`ajustadorTelefono` varchar(32),
	`tipo` enum('colision','robo_total','robo_parcial','cristales','rc_terceros','otro') NOT NULL,
	`fechaOcurrido` datetime NOT NULL,
	`lugar` varchar(255),
	`descripcion` text,
	`conductorNombre` varchar(128),
	`responsabilidad` enum('por_definir','asegurado','tercero','compartida') NOT NULL DEFAULT 'por_definir',
	`tallerNombre` varchar(128),
	`deducible` decimal(12,2),
	`montoEstimado` decimal(12,2),
	`montoAutorizado` decimal(12,2),
	`estado` enum('reportado','ajustador_asignado','valuacion','orden_admision','en_reparacion','listo_entrega','entregado','pago_danos','perdida_total','documentos_indemnizacion','finiquito','pago_confirmado','cerrado','rechazado','cancelado') NOT NULL DEFAULT 'reportado',
	`responsableId` bigint unsigned,
	`creadoPorId` bigint unsigned,
	`ultimoMovimiento` timestamp NOT NULL DEFAULT (now()),
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
	`passwordHash` varchar(255),
	`role` enum('admin','siniestros','vendedor') NOT NULL DEFAULT 'vendedor',
	`activo` boolean NOT NULL DEFAULT true,
	`debeCambiarPassword` boolean NOT NULL DEFAULT false,
	`intentosFallidos` int NOT NULL DEFAULT 0,
	`bloqueadoHasta` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE INDEX `cli_vend_idx` ON `clientes` (`vendedorId`);--> statement-breakpoint
CREATE INDEX `pol_cli_idx` ON `polizas` (`clienteId`);--> statement-breakpoint
CREATE INDEX `pol_num_idx` ON `polizas` (`aseguradoraId`,`numero`);--> statement-breakpoint
CREATE INDEX `evt_sin_idx` ON `siniestro_eventos` (`siniestroId`);--> statement-breakpoint
CREATE INDEX `sin_pol_idx` ON `siniestros` (`polizaId`);--> statement-breakpoint
CREATE INDEX `sin_cli_idx` ON `siniestros` (`clienteId`);--> statement-breakpoint
CREATE INDEX `sin_aseg_estado_idx` ON `siniestros` (`aseguradoraId`,`estado`);--> statement-breakpoint
CREATE INDEX `ter_sin_idx` ON `terceros` (`siniestroId`);