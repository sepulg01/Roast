# Roast

Sitio estatico y flujo de pedido web para Cafe Roast. El cliente arma el pedido en `caferoast.cl`, completa el checkout en 2 pasos (`Pedido` y `Datos`) y el Worker calcula el total con Google Sheets. El cierre activo queda por `Transferencia Bancaria`, dejando el pedido en estado `pending_transfer`; Flow permanece como codigo legado/desactivado por defecto con `flow_enabled=false`.

## Stack Operativo

- Website estatico: HTML publico, `assets/site.js` y `assets/checkout.js`.
- API: Cloudflare Worker en `worker/src/index.js`.
- Operacion: Google Sheets como fuente de configuracion y registro.
- Cierre activo: `POST /api/checkout-orders` crea el pedido para `Transferencia Bancaria` y lo deja en `pending_transfer`.
- Pagos Flow: endpoints y codigo se mantienen como legado desactivado por defecto mediante `flow_enabled=false`; se reactivan solo con decision operativa explicita.
- Notificaciones: Apps Script como webhook de email; no escribe en Sheets.
- Soporte: `contacto@caferoast.cl` y WhatsApp `+56 9 9174 6361`.

## Rutas Del Worker

- `GET /api/public-catalog`: catalogo publico desde `Config`, incluyendo `shipping_fee_clp` y `communes`.
- `POST /api/checkout-orders`: crea pedido de checkout en 2 pasos y devuelve instrucciones de transferencia con estado `pending_transfer`.
- `POST /api/order-drafts`: crea cliente, venta, lineas y evento. No es idempotente.
- `POST /api/order-contact-requests`: ruta de contacto manual previa; no es el cierre activo mientras transferencia bancaria este vigente.
- `POST /api/payment-links`: codigo legado Flow; permanece desactivado por defecto con `flow_enabled=false` y solo debe operar si Flow se reactiva.
- `POST /api/flow/confirmation`: callback server-to-server de Flow.
- `POST /pago/retorno`: retorno del navegador desde Flow hacia `/pago/resultado/`.
- `GET /api/orders/:order_id`: estado publico por ID de pedido.

El frontend usa rutas relativas por defecto. Para apuntar a otro Worker se puede configurar `data-api-base` en el `<body>` o `window.ROAST_API_BASE`.

## Google Sheets

La planilla operativa se identifica con `GOOGLE_SHEET_ID`. El script `npm run sheets:readme` crea o actualiza la pestaña `README` con este contrato sin exponer secretos.

Hojas requeridas:

- `Config`: secciones `settings`, `communes`, `catalog`, `status_map`.
- `Clientes`: clientes normalizados.
- `Ventas`: pedidos y estados operativos.
- `Lineas_Pedido`: detalle de items por pedido.
- `Pagos_Flow`: links y estados de pago.
- `Eventos`: bitacora de eventos y notificaciones.

`Config.status_map` se parsea hoy, pero no debe considerarse contrato productivo hasta que el Worker lo use explicitamente.

## Transferencia Bancaria

El cierre activo muestra estos datos para pago por transferencia:

- Banco: BCI
- Tipo: Cuenta Corriente
- Numero: `61947059`
- Titular: Gonzalo Sepúlveda Hermosilla
- RUT: `17515638-0`
- Email: `contacto@caferoast.cl`

## Variables Y Secretos

Worker:

- `FLOW_API_KEY`
- `FLOW_SECRET_KEY`
- `FLOW_BASE_URL` opcional, default `https://www.flow.cl/api`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_SHEET_ID`
- `GOOGLE_MAPS_API_KEY`, requerido para validacion backend de direcciones mediante Google Geocoding
- `PUBLIC_BASE_URL`
- `APPS_SCRIPT_WEBHOOK_URL`, requerido solo para notificaciones o flujos de contacto manual que usen Apps Script
- `APPS_SCRIPT_SHARED_SECRET`, requerido junto al webhook de Apps Script

Apps Script:

- `APPS_SCRIPT_SHARED_SECRET`, igual al secreto del Worker.

No versionar `.dev.vars`, service accounts, claves Flow ni URLs privadas de webhook.

## Desarrollo Local

```bash
npm install
npm run test:static
npm --prefix worker run check
npx playwright install chromium
npm run test:functional -- --reporter=line
```

Para sincronizar la pestaña `README` de la planilla:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}' \
GOOGLE_SHEET_ID="..." \
npm run sheets:readme
```

Si Playwright no puede levantar Chromium en Linux/WSL por dependencias del sistema:

```bash
sudo npx playwright install-deps chromium
```

Sin sudo, se puede usar Chrome de Windows desde WSL:

```bash
ROAST_PLAYWRIGHT_CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
npm run test:functional -- --project=chromium-windows
```

Si el Chrome de Windows no abre desde WSL por el canal de depuracion, deja las librerias Linux faltantes en `.playwright-local-libs/`. El wrapper `scripts/run-playwright.mjs` detecta esa carpeta y antepone el `LD_LIBRARY_PATH` automaticamente al correr `npm run test:functional`.

```bash
npm run test:functional -- --reporter=line
```

## Validacion Antes De Cerrar

```bash
npm run test:static
npm --prefix worker run check
npm run test:functional -- --reporter=line
git diff --check
ROAST_OLD_SUPPORT_PATTERN='numero-antiguo-o-wa-me-antiguo'
rg "$ROAST_OLD_SUPPORT_PATTERN" --glob '!EXECUTION_FEEDBACK.md'
```
