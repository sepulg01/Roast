# Roast

Sitio estatico y flujo de pedido web para Cafe Roast. El cliente arma el pedido en `caferoast.cl`, el Worker calcula el total con Google Sheets, Flow genera el link de pago y Apps Script envia notificaciones operativas por email.

## Stack Operativo

- Website estatico: HTML publico, `assets/site.js` y `assets/checkout.js`.
- API: Cloudflare Worker en `worker/src/index.js`.
- Operacion: Google Sheets como fuente de configuracion y registro.
- Pagos: Flow mediante `/payment/create` y `/payment/getStatus`.
- Notificaciones: Apps Script como webhook de email; no escribe en Sheets.
- Soporte: `contacto@caferoast.cl` y WhatsApp `+56 9 9174 6361`.

## Rutas Del Worker

- `GET /api/public-catalog`: catalogo publico desde `Config`.
- `POST /api/order-drafts`: crea cliente, venta, lineas y evento. No es idempotente.
- `POST /api/payment-links`: crea o reutiliza link Flow para pedidos `link_sent` o `pending_payment`.
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

## Variables Y Secretos

Worker:

- `FLOW_API_KEY`
- `FLOW_SECRET_KEY`
- `FLOW_BASE_URL` opcional, default `https://www.flow.cl/api`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_SHEET_ID`
- `PUBLIC_BASE_URL`
- `APPS_SCRIPT_WEBHOOK_URL` opcional
- `APPS_SCRIPT_SHARED_SECRET` opcional, requerido si se activa Apps Script

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
