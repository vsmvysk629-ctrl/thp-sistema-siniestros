# THP · Sistema de siniestros

Sistema propio de THP Seguros para dar seguimiento a los siniestros de **autos** dentro de Quálitas, Atlas y Potosí, de principio a fin. Es independiente de SIGA (que no maneja siniestros) y de THP OS.

## Qué hace hoy (Etapa 1A)
- **Usuarios y roles**: administrador, siniestros (oficina) y vendedor (solo ve los siniestros de sus clientes, puede reportar y agregar notas).
- **Clientes y pólizas de autos** con datos del vehículo (captura mínima; la cartera completa sigue en SIGA).
- **Siniestro**: folio interno (SIN-2026-0001), número de reporte de cabina, número de siniestro, ajustador, tipo, responsabilidad, taller, deducible, monto estimado y monto autorizado, terceros.
- **Flujo de autos** (`contracts/flujo.ts`) con tres rutas:
  - Reparación: reportado → ajustador → valuación → orden de admisión → en reparación → listo → entregado → cerrado.
  - Pago de daños: … valuación → pago de daños autorizado → pago confirmado → cerrado.
  - Pérdida total: … → dictamen → documentos para indemnización → finiquito → pago confirmado → cerrado.
  - Más rechazado y cancelado (con motivo obligatorio).
- **Regla clave**: orden de admisión, pago de daños, pérdida total, finiquito y pago confirmado **exigen el folio o referencia de la aseguradora**. El monto autorizado solo se captura en esos pasos.
- **Historial completo** por siniestro: alta, cambios de estado (con folio), ediciones (qué campos), notas y terceros, con autor y hora.
- **Bandeja** con filtros (estado, aseguradora, tipo, búsqueda por folio/cliente/póliza/placas) y marca de "sin movimiento 7+ días".

## Desarrollo
```bash
npm install
cp .env.example .env          # pon DATABASE_URL de una base de desarrollo
npm run db:migrate
npm run db:seed               # datos FICTICIOS: admin / oficina / vendedor
npm run dev                   # http://localhost:3000
```

## Pruebas
```bash
npm test     # usa TEST_DATABASE_URL o mysql://sin:sin@localhost:3306/siniestros_test
```
Las pruebas borran y recrean la base, así que solo corren contra una base cuyo nombre termina en `_test`. Se usan solo datos ficticios.

## Producción
`npm run build && npm start` (o el `Dockerfile`). Al arrancar aplica migraciones, crea Quálitas, Atlas y Potosí si faltan y crea el primer administrador con `ADMIN_USERNAME`/`ADMIN_PASSWORD` (deberá cambiar la contraseña al entrar). Variables en `.env.example`.

## Siguientes etapas
- 1B Expediente: checklist de documentos y archivos.
- 1C Seguimiento: próxima acción, fecha compromiso y alertas diarias (tareas y borradores por aprobar; nada se envía al cliente).
- 1D Tablero por aseguradora y tiempos por etapa.
