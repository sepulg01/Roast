# Roast

Sitio estatico y flujo de pedido web para Cafe Roast. El cliente arma el pedido en `caferoast.cl`, completa el checkout en 2 pasos (`Pedido` y `Datos`) y el Worker calcula el total con Google Sheets. El cierre activo queda por `Transferencia Bancaria`, dejando el pedido en estado `pending_transfer`; Flow permanece como codigo legado/desactivado por defecto con `flow_enabled=false`.

## Stack Operativo

- Website estatico: HTML publico, `assets/site.js` y `assets/checkout.js`.
- API: Cloudflare Worker en `worker/src/index.js`.
- Operacion: Google Sheets como fuente de configuracion y registro.
- Cierre activo: `POST /api/checkout-orders` crea el pedido para `Transferencia Bancaria`, devuelve un numero visible `DDMMRRR` y lo deja en `pending_transfer`.
- Pagos Flow: endpoints y codigo se mantienen como legado desactivado por defecto mediante `flow_enabled=false`; se reactivan solo con decision operativa explicita.
- Notificaciones: Resend desde el Worker; Apps Script queda como fallback legado si Resend no esta configurado.
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
- `GET /api/health`: healthcheck productivo con flags de `confirmation_number`, `terms_only_checkout` y `resend_notifications`.

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

El identificador interno `order_id` sigue siendo la llave relacional entre `Ventas`, `Lineas_Pedido`, `Pagos_Flow` y `Eventos`. El numero visible para clientes y soporte es `order_number` / `confirmation_number`, con formato `DDMMRRR` como texto para conservar ceros iniciales.

La regla vigente de envio gratis usa `free_shipping_threshold_clp` para todas las comunas listadas y despachables. El campo historico `free_shipping_eligible` puede venir en `Config.communes`, pero no decide el calculo de despacho gratis.

## Transferencia Bancaria

El cierre activo muestra estos datos para pago por transferencia:

- Banco: BCI
- Tipo: Cuenta Corriente
- Numero: `61947059`
- Titular: Gonzalo Sepúlveda Hermosilla
- RUT: `17515638-0`
- Email: `contacto@caferoast.cl`

Cuando `POST /api/checkout-orders` deja un pedido en `pending_transfer`, el Worker envia con Resend un email operativo a `contacto@caferoast.cl` y una confirmacion al cliente con:

- Subject: `Hemos recibido tu pedido {confirmation_number}`
- Numero visible de pedido y total del pedido.
- Canal de respuesta: `contacto@caferoast.cl` y WhatsApp `+56 9 9174 6361`.

Resend usa `RESEND_FROM`, `RESEND_REPLY_TO` e `Idempotency-Key` por email (`roast:{order_id}:operational` y `roast:{order_id}:customer`) para reducir duplicados si el Worker reintenta una notificacion. Apps Script se mantiene como fallback legado: si `RESEND_API_KEY` no existe y las variables de Apps Script estan presentes, el Worker sigue validando la respuesta JSON del webhook y registra como fallida una respuesta HTTP 200 con `{ "ok": false }`.

## Deploy Persistente

El deploy productivo del Worker no depende de variables locales. GitHub Actions usa el Environment `production`:

- `.github/workflows/worker-secrets-sync.yml`: manual; sincroniza secretos persistentes de GitHub hacia Cloudflare Worker con `wrangler secret put`.
- `.github/workflows/worker-deploy.yml`: automatico en push a `main` y manual; corre checks, funcionales, sincroniza secretos requeridos, ejecuta `wrangler deploy` y smoke productivo.
- `npm run smoke:worker-production`: valida `/api/health`, que Google/Resend esten configurados, `/api/public-catalog` y que `/api/checkout-orders` ya no exija `accept_total`.

## Variables Y Secretos

Worker:

- `FLOW_API_KEY`
- `FLOW_SECRET_KEY`
- `FLOW_BASE_URL` opcional, default `https://www.flow.cl/api`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_SHEET_ID`
- `GOOGLE_MAPS_API_KEY`, requerido para validacion backend de direcciones mediante Google Geocoding
- `PUBLIC_BASE_URL`
- `RESEND_API_KEY`, requerido para emails productivos
- `RESEND_FROM`, requerido; usar `Cafe Roast <contacto@caferoast.cl>`
- `RESEND_REPLY_TO`, requerido; usar `contacto@caferoast.cl`
- `APPS_SCRIPT_WEBHOOK_URL`, fallback legado opcional
- `APPS_SCRIPT_SHARED_SECRET`, fallback legado opcional junto al webhook de Apps Script

Apps Script:

- `APPS_SCRIPT_SHARED_SECRET`, igual al secreto del Worker solo si se usa el fallback legado.
- OAuth: el script usa `MailApp` y, si existe alias de Gmail, `GmailApp` para intentar enviar desde `contacto@caferoast.cl`; al desplegar puede requerir reautorizacion de envio de correo.

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
node scripts/smoke-worker-production.mjs --base-url https://caferoast.cl
git diff --check
ROAST_OLD_SUPPORT_PATTERN='numero-antiguo-o-wa-me-antiguo'
rg "$ROAST_OLD_SUPPORT_PATTERN" --glob '!EXECUTION_FEEDBACK.md'
```
