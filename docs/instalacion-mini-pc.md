# Instalación en la mini PC de la oficina

El sistema corre en la mini PC con Docker: la app, la base de datos y un respaldo diario.
Arranca solo cuando se prende la PC. La oficina entra desde el navegador a `http://IP-de-la-mini-PC:3000`.

## 1. Preparar la mini PC
- Conéctala por cable de red al módem o switch de la oficina (más estable que WiFi).
- Configúrala para que **no se duerma ni se suspenda** y para que **encienda sola al volver la luz**
  (opción "Restore on AC power loss" / "Power On" en el BIOS).
- Pídele al proveedor de internet o configura en el módem una **IP fija** para la mini PC
  (reserva DHCP). Así la dirección del sistema no cambia.
- Recomendado: un no-break (UPS) pequeño.

## 2. Instalar Docker
- **Windows 11 / Mac:** instala Docker Desktop (docker.com) y activa "Start Docker Desktop when you sign in".
  En Windows, configura que la sesión inicie sola o usa Linux, que no necesita sesión abierta.
- **Linux (Ubuntu):** `curl -fsSL https://get.docker.com | sh` y `sudo systemctl enable docker`.

## 3. Descargar el sistema
Descarga el código desde GitHub (botón **Code → Download ZIP**) y descomprímelo en una carpeta, por
ejemplo `C:\THP\siniestros` o `~/thp-siniestros`.

## 4. Configurar
En esa carpeta, copia `.env.mini-pc.example` como `.env` y llena:

| Variable | Qué poner |
|---|---|
| DB_PASSWORD | Contraseña larga inventada (20+ letras y números) |
| DB_ROOT_PASSWORD | Otra distinta |
| APP_SECRET | 32 o más caracteres al azar |
| ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_NAME | Tu usuario de administrador; la contraseña es temporal |
| COOKIE_SECURE | `false` mientras se entre por `http://` |

## 5. Arrancar
Abre una terminal en la carpeta y corre:
```
docker compose up -d --build
```
La primera vez tarda unos minutos. Para revisar: `docker compose ps` (los tres servicios deben decir *running* / *healthy*).

Prueba en la mini PC: `http://localhost:3000`. Desde otra computadora de la oficina: `http://IP-de-la-mini-PC:3000`.

## 6. Primer día
1. Entra con tu usuario de administrador y cambia la contraseña.
2. En **Usuarios y permisos** crea a cada persona; cada una recibe una contraseña temporal.
3. Si alguien la olvida, usa **Restablecer contraseña**.

## Respaldos
Cada día se guarda `respaldos/siniestros-AAAA-MM-DD.sql.gz` en la carpeta del sistema (se guardan 30 días).
Incluye los archivos subidos. **Copia esa carpeta fuera de la mini PC** (USB o Google Drive/OneDrive) al menos
cada semana: si la mini PC se daña, ese es tu respaldo.

Restaurar un respaldo (solo si se perdió la base):
```
gunzip -c respaldos/siniestros-AAAA-MM-DD.sql.gz | docker compose exec -T db sh -c 'mysql -uthp -p"$MYSQL_PASSWORD" siniestros'
```

## Actualizar a una versión nueva
Descarga el código nuevo encima de la carpeta (sin borrar `.env` ni `respaldos/`) y corre otra vez
`docker compose up -d --build`. Los datos se conservan.

## Entrar desde fuera de la oficina (opcional)
No abras puertos del módem. Usa una de estas:
- **Tailscale** (gratis para pocas personas): se instala en la mini PC y en el celular o laptop de quien
  necesite entrar desde fuera; el sistema queda privado, solo para esos equipos.
- **Cloudflare Tunnel**: da una dirección `https://` propia (requiere un dominio). En ese caso pon `COOKIE_SECURE=true`.
