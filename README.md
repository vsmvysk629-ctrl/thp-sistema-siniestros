# THP · Sistema de siniestros

Sistema propio de THP Seguros para dar seguimiento a los siniestros de **autos** dentro de Quálitas, Atlas y Potosí, de principio a fin. Es independiente de SIGA (que no maneja siniestros) y de THP OS.

## Qué hace hoy (Etapa 1A, rehecha con base en el prototipo de la oficina)
- **Usuarios y roles**: administrador (todo), ejecutivo (ve todo; modifica solo los siniestros a su cargo) y solo consulta (lectura y reportes). La matriz está en la pantalla *Usuarios y permisos* y la aplica la API.
- **Contratantes y pólizas** de cualquier ramo (autos, flotillas, GMM, AP, vida, daños, casa, RC, transportes). Captura mínima; no se carga la cartera real.
- **Siniestro**: folio interno THP-S-AA-NNNN, contratante, póliza, compañía, ramo y tipo, asegurado/afectado, fechas, número de siniestro de la aseguradora, ejecutivo responsable, próxima acción y fecha compromiso. En autos además: reporte de cabina, ajustador, taller, conductor, lugar, responsabilidad, deducible y terceros.
- **Trámite en 11 estatus** (`contracts/flujo.ts`): reportado → recopilación de documentos → documentación completa → ingresado a aseguradora → en revisión → (info. adicional) → autorizado → pago parcial → pagado → cerrado, más rechazado (con apelación).
- **Reglas**: documentación completa solo sin faltantes; ingresado exige número o folio de la aseguradora; autorizado exige folio del dictamen y monto; pago parcial y pagado **solo** se alcanzan registrando pagos con referencia y sin pasar de lo autorizado; rechazo, info. adicional y cierre piden motivo.
- **Expediente** con pestañas: datos generales, documentación (checklist por ramo y tipo con estados), financiero (gastado, reclamado, no procedente, deducible, coaseguro, autorizado, pagado, saldo; conceptos con dictamen; pagos) y bitácora (todo cambio con autor y hora, más notas).
- **Tablero**: 10 indicadores, alertas (compromiso vencido, info. pedida, rechazado, documentos pendientes, listo para ingresar, 15+ días sin respuesta, pago pendiente), abiertos por ramo y próximos compromisos.
- **Bandeja** con filtros (búsqueda, estatus, ejecutivo, compañía, ramo) y **reportes** por ramo, compañía, ejecutivo y tiempos. Exporta a Excel (CSV) y a PDF (impresión); el expediente también se imprime completo.

## Personalización (sin tocar código)
- **Configuración** (solo administrador): documentos por ramo, por tipo y extra por aseguradora; tipos de siniestro por ramo; aseguradoras (teléfono de cabina, días de aviso propios, notas); ajustes generales (primera acción, días para el compromiso, días sin respuesta).
- **Vista por usuario**: cada ejecutivo ve primero lo suyo (*Míos / Todo el despacho*) y el sistema recuerda sus últimos filtros.
- **Atajos**: `/` busca, `N` abre un siniestro nuevo.
- Imagen de THP Seguros: logo, azul de la marca, tipografías Montserrat e Inter.

## Desarrollo
```bash
npm install
cp .env.example .env          # pon DATABASE_URL de una base de desarrollo
npm run db:migrate
npm run db:seed               # datos FICTICIOS: admin, laura, oscar, marta, consulta · Demo2026demo
npm run dev                   # http://localhost:3000
```

## Pruebas
```bash
npm test     # usa TEST_DATABASE_URL o mysql://sin:sin@localhost:3306/siniestros_test
```
Las pruebas borran y recrean la base, así que solo corren contra una base cuyo nombre termina en `_test`. Se usan solo datos ficticios.

## Producción
En la mini PC de la oficina: `docker compose up -d --build` (guía completa en `docs/instalacion-mini-pc.md`).

`npm run build && npm start` (o el `Dockerfile`). Al arrancar aplica migraciones, crea Quálitas, Atlas y Potosí si faltan (y las demás aseguradoras de México como inactivas) y crea el primer administrador con `ADMIN_USERNAME`/`ADMIN_PASSWORD` (deberá cambiar la contraseña al entrar). Variables en `.env.example`.

Los archivos del expediente (PDF, fotos, Word, Excel; hasta 10 MB) se guardan en MySQL, así que el respaldo de la base los incluye.

## Seguimiento (1C)
Cada hora el servidor (y al abrir Seguimiento) propone mensajes para siniestros detenidos: documentos que faltan, información que pide la aseguradora, aseguradora sin respuesta y pagos pendientes. Solo un administrador los aprueba; el responsable los envía desde su WhatsApp o correo y marca "Ya lo envié". El sistema no envía nada.

## Siguientes etapas
- Ajustes que pida la oficina al usar esta versión.
