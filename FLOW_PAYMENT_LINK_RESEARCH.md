# Investigacion de links de pago con Flow para Roast

- Estado: completada
- Fecha: 2026-04-13
- Tipo: documental / investigacional
- Alcance: auditoria del funnel actual, comparativa de caminos Flow, gaps UX/e-commerce, contrato minimo y recomendacion de MVP

## 1. Resumen ejecutivo

- Roast hoy vende desde un sitio estatico que empuja al usuario a WhatsApp en home y paginas editoriales. No existe captura estructurada del pedido dentro del sitio ni backend para firmar llamadas a Flow.
- La ruta recomendada no es el link manual como solucion principal, sino `Flow /payment/create` desde un backend ligero con secreto protegido, `urlConfirmation`, `urlReturn` y consulta de estado via `/payment/getStatus`.
- El link manual de Flow sirve como baseline operativo o fallback mientras el volumen sea bajo, pero deja demasiado trabajo manual y poca trazabilidad para el modelo que Roast ya esta intentando ordenar.
- El cobro por email desde Flow existe como variante de distribucion del link, pero no calza como canal principal con una marca cuyo canal vigente es `Flow + WhatsApp`.
- Antes de integrar pago, el sitio necesita un paso minimo de captura y revision del pedido: cliente, email, telefono, direccion, comuna, subtotal, despacho, total y estado.

## 2. Estado actual auditado

### 2.1 Funnel actual del sitio

- Home:
  - Hero con CTA directo a WhatsApp en `index.html:170-176`.
  - Quiz con CTA directo a WhatsApp en `index.html:262-269`.
  - Cards de producto con CTA a WhatsApp en `index.html:336-345` y `index.html:400-409`.
  - CTA final a WhatsApp en `index.html:635-645`.
- Paginas editoriales:
  - `cafe-a-domicilio/index.html:151-157`, `cafe-en-grano/index.html:151-154`, `cafe-de-especialidad/index.html:151-154` y `cafe-molido/index.html:151-154` tambien cierran en WhatsApp.
  - El copy editorial refuerza que el canal de cierre es WhatsApp, por ejemplo `cafe-a-domicilio/index.html:176-177` y `cafe-en-grano/index.html:198-199`.
- Logica cliente:
  - El quiz arma recomendacion, precio y mensaje en frontend en `assets/site.js:184-212`.
  - Las cards de producto calculan precio y mensaje en frontend en `assets/site.js:236-292`.
- Legal/comercial:
  - Terminos ya declaran `transferencia bancaria o link de pago (Flow)` en `policies/terminos-y-condiciones.html:135-136`.
  - El backlog ya define la decision operativa `Flow + WhatsApp` en `Backlog.md:10-15`.

### 2.2 Lo que ya esta bien resuelto

- Descripcion de producto y propuesta de valor claras en home y articulos.
- Moneda visible en CLP tanto en cards como en terminos.
- Politicas visibles: terminos, privacidad y reembolso.
- Umbral de despacho gratis explicitado en home y contenido editorial.
- Telefono de contacto publicado por WhatsApp y `contactPoint` en schema del home.

### 2.3 Gaps actuales

- No existe `order_draft` en el sitio: faltan `order_id`, nombre, email, telefono, direccion, comuna, total consolidado y estado.
- El total se determina en frontend y no existe recalculo server-side.
- No existe infraestructura server-side en este repo. Se buscaron `package.json`, `api/`, `server/`, `functions/`, `wrangler.toml`, `vercel.json`, `netlify.toml` y no hay una capa backend disponible hoy.
- No existe resumen final del pedido antes de salir a WhatsApp.
- No existe calculo de despacho ni validacion de la regla `envio gratis sobre $36.000`.
- No existe superficie de estados de pago para `pendiente`, `pagado`, `rechazado`, `expirado` o `cancelado`.
- No existe embudo transaccional medible. Hoy solo se emiten `cta_click_hero`, `quiz_started`, `quiz_completed`, `whatsapp_click` y `subscription_interest`.
- El sitio tiene telefono y ciudad, pero no publica un email de soporte ni una direccion operativa mas especifica en la interfaz principal. Para una experiencia de pago eso debilita confianza y soporte.

## 3. Comparativa de caminos Flow

### 3.1 Opcion A: link manual desde dashboard Flow

- Evidencia:
  - El manual oficial indica que el comercio entra al dashboard, crea un "Nuevo link de pago", completa producto/moneda/monto y luego puede copiar el link, mostrar QR o enviarlo por email.
  - El mismo manual indica que el link es de pago unico: una vez pagado, caduca y debe crearse uno nuevo.
- Pros:
  - Cero desarrollo inicial.
  - Sirve para operar desde WhatsApp, Instagram o sitio como fallback.
  - Baja barrera para validar demanda.
- Contras:
  - Alta dependencia operativa manual.
  - Poco control sobre `commerceOrder` y conciliacion fina con el pedido real.
  - Mas riesgo de errores de monto, producto o cliente al crear links a mano.
  - No resuelve webhook, estados ni trazabilidad por si solo.
- Veredicto:
  - Sirve solo como baseline temporal o plan B. No deberia ser la ruta principal del MVP recomendado.

### 3.2 Opcion B: orden dinamica por API con `/payment/create`

- Evidencia:
  - Flow documenta que el comercio debe crear la orden via `POST /payment/create`, firmar los parametros, enviar `commerceOrder`, `subject`, `amount`, `email`, `urlConfirmation`, `urlReturn`, `optional` y opcionalmente `timeout`.
  - La respuesta devuelve `url`, `token` y `flowOrder`; el comercio debe redirigir al checkout concatenando `url + "?token=" + token`.
  - Flow confirma el pago via `POST` a `urlConfirmation`, exige `HTTP 200` en menos de 15 segundos y recomienda consultar `/payment/getStatus`.
  - Flow redirige despues al `urlReturn`; para pagos asincronos puede redirigir antes de confirmar, por lo que el comercio debe mostrar estado `pendiente` y consultar la API.
- Pros:
  - Trazabilidad completa entre pedido interno y transaccion Flow.
  - Total calculado del lado servidor.
  - Permite expirar links con `timeout`.
  - Soporta pagos sincronos y asincronos con un solo flujo.
  - Hace viable automatizar Google Sheets, estados y conciliacion.
- Contras:
  - Requiere backend ligero, manejo de secretos y endpoints publicos HTTPS.
  - Obliga a definir contrato interno de pedido y reglas de shipping.
- Veredicto:
  - Es la opcion recomendada para Roast.

### 3.3 Opcion C: cobro por email desde Flow

- Evidencia:
  - El manual de link de pago indica que, tras crear el link manual, Flow puede enviarlo por email al pagador.
- Pros:
  - Puede servir para seguimiento de cobros fuera de horario o recordatorios.
  - Reduce friccion si ya existe email confirmado del cliente.
- Contras:
  - No coincide con el canal principal actual de Roast.
  - Suma una dependencia de correo que la marca todavia no tiene publicada ni estabilizada.
  - Si el pedido sigue naciendo en WhatsApp, el email agrega una bifurcacion de soporte sin resolver la trazabilidad base.
- Veredicto:
  - Canal secundario, no camino principal.

## 4. Recomendacion de MVP

### 4.1 Decisiones cerradas

- Mantener `Flow + WhatsApp`; no montar un e-commerce completo ni cuentas de usuario.
- Crear una capa minima server-side para pedidos y pagos. No exponer `apiKey` ni `secretKey` de Flow al navegador.
- Usar `commerceOrder = order_id` interno y tratarlo como identificador idempotente.
- Usar `Google Sheets` como backoffice inicial, con sincronizacion desde el backend.
- Dejar el link manual de Flow solo como fallback operativo mientras se estabiliza el flujo automatizado.

### 4.2 Flujo recomendado

1. El usuario elige producto, formato y molienda desde home o quiz.
2. El sitio abre un paso minimo de captura con nombre, email, telefono, comuna, direccion y notas.
3. El backend crea un `order_draft`, recalcula subtotal, shipping y total, y guarda estado `draft`.
4. El backend llama `POST /payment/create` a Flow con `commerceOrder=order_id`, `amount=total`, `email`, `urlConfirmation`, `urlReturn` y `optional` serializado.
5. El backend guarda `flowOrder`, `token`, `payment_url` y mueve el pedido a `link_sent`.
6. El usuario es redirigido a Flow.
7. Flow envia `POST` a `urlConfirmation`; el backend responde `200`, consulta `/payment/getStatus` y actualiza el pedido.
8. Flow redirige al navegador a `urlReturn`; el sitio consulta el estado actualizado y muestra `pagado`, `pendiente` o `fallido`, con fallback a WhatsApp.
9. El backend sincroniza pedido y pago en Google Sheets para operacion diaria.

### 4.3 Interfaces internas recomendadas

- `POST /api/order-drafts`
  - Entrada: seleccion de producto, canal de origen y datos del cliente.
  - Salida: `order_id`, subtotal, shipping, total, estado `draft`.
- `POST /api/payment-links`
  - Entrada: `order_id`.
  - Salida: `payment_url`, `flowOrder`, `token`, estado `link_sent`.
- `POST /api/flow/confirmation`
  - Entrada: `token` enviado por Flow.
  - Accion: responder `200`, consultar `getStatus`, persistir el resultado e idempotencia.
- `POST /flow/return`
  - Entrada: `token` via browser.
  - Accion: resolver el estado visible al cliente o redirigir a una pagina final propia.
- `GET /api/orders/:order_id`
  - Uso: pagina de retorno y soporte operativo.

## 5. Contrato minimo recomendado

### 5.1 `order_draft`

```json
{
  "order_id": "roast_20260413_000123",
  "channel": "site_home_products",
  "origin": "index_products_downtime",
  "customer_name": "Nombre Apellido",
  "email": "cliente@example.com",
  "phone": "+56912345678",
  "commune": "Providencia",
  "address": "Calle 123, depto 4",
  "notes": "Conserjeria 24h",
  "items": [
    {
      "product": "downtime",
      "format": "500g",
      "grind": "prensa francesa",
      "quantity": 1,
      "unit_price": 16500,
      "line_total": 16500
    }
  ],
  "subtotal": 16500,
  "shipping": 3500,
  "shipping_rule": "rm_standard",
  "free_shipping_applied": false,
  "total": 20000,
  "currency": "CLP",
  "status": "draft",
  "created_at": "2026-04-13T18:45:00Z"
}
```

Notas:

- Aunque el backlog original hablaba de `producto`, `formato` y `molienda` en singular, Roast ya tiene un caso real de combo en el quiz (`Downtime + Hiperfoco 250g`). Por eso conviene cerrar desde ya `items[]` como contrato canonico.
- El backend debe derivar `subtotal`, `shipping` y `total`; el frontend no debe ser fuente de verdad para el monto.

### 5.2 `payment_link_request`

```json
{
  "commerceOrder": "roast_20260413_000123",
  "subject": "Pedido Roast - Downtime 500g",
  "amount": 20000,
  "email": "cliente@example.com",
  "urlConfirmation": "https://caferoast.cl/api/flow/confirmation",
  "urlReturn": "https://caferoast.cl/pago/retorno",
  "optional": "{\"order_id\":\"roast_20260413_000123\",\"channel\":\"site_home_products\",\"phone\":\"+56912345678\",\"commune\":\"Providencia\"}",
  "timeout": 86400
}
```

### 5.3 `payment_record`

```json
{
  "order_id": "roast_20260413_000123",
  "flowOrder": 8765456,
  "token": "33373581FC32576FAF33C46FC6454B1FFEBD7E1H",
  "payment_url": "https://www.flow.cl/app/web/pay.php?token=33373581FC32576FAF33C46FC6454B1FFEBD7E1H",
  "status": "pending_payment",
  "flow_status": 1,
  "expires_at": "2026-04-14T18:45:00Z",
  "paid_at": null,
  "last_checked_at": "2026-04-13T18:46:00Z"
}
```

### 5.4 Estados canonicos

```text
draft
link_sent
pending_payment
paid
payment_failed
expired
canceled
preparing
shipped
delivered
```

Mapeo minimo con Flow:

- `1` -> `pending_payment`
- `2` -> `paid`
- `3` -> `payment_failed`
- `4` -> `canceled`
- `expired` queda como estado interno cuando vence `timeout` sin pago confirmado.

## 6. Gaps UX y e-commerce contra best practices

### 6.1 Gaps prioritarios

- Falta progresion explicita:
  - El usuario pasa de descubrir producto a salir del sitio sin un paso visible tipo `Pedido -> Pago -> Confirmacion`.
  - Para una integracion Flow, esto es un hueco. Stripe recomienda que el usuario siempre sepa donde esta, que viene despues y cuantos pasos faltan.
- Falta resumen final del pedido:
  - Hoy no existe una vista de `items + despacho + total`.
  - Eso choca con la necesidad de mostrar costos por adelantado y reduce confianza antes de pagar.
- Falta captura minima sin friccion:
  - El sitio no recoge email, telefono ni direccion antes de crear la transaccion.
  - Flow necesita al menos el email del pagador para crear la orden.
- Falta soporte contextual en el momento de pago:
  - El sitio tiene politicas visibles, pero no presenta email de soporte ni una via alternativa clara justo donde ocurrira el pago.
- Falta manejo de estados:
  - No hay pagina ni modulo para `pagado`, `pendiente`, `rechazado` o `expirado`.
  - En pagos asincronos Flow puede redirigir antes de confirmar, por lo que un estado `pendiente` es obligatorio.
- CTA ambiguo en cards de producto:
  - En `index.html:338-343` y `index.html:402-407` el CTA principal de las cards es un icono de WhatsApp sin texto.
  - Para iniciar pago eso es insuficiente; la futura CTA debe ser textual y explicita.

### 6.2 Lo que Roast ya tiene a favor

- Descripcion clara del producto, formato y moneda.
- Umbral de despacho gratis visible.
- Politicas publicadas.
- Home y articulos reducen friccion y explican bien el valor del producto.

### 6.3 Ajustes UX minimos para el futuro paso previo a Flow

- Un mini checkout de 2 pasos visibles:
  - `1. Tus datos`
  - `2. Revisar y pagar`
- CTA textual:
  - `Continuar al pago`
  - `Pagar con Flow`
- Resumen fijo del pedido:
  - producto(s)
  - molienda
  - subtotal
  - despacho
  - total
- Ayuda visible:
  - `¿Tienes dudas? Escríbenos por WhatsApp`
- Estados de retorno:
  - `Pago recibido`
  - `Pago pendiente`
  - `Pago no completado`
- Soporte movil:
  - campos cortos
  - tipos de input adecuados
  - tap targets amplios
  - sin dropdowns innecesarios

## 7. Instrumentacion minima recomendada

Eventos a agregar:

- `order_draft_created`
- `order_draft_failed`
- `shipping_calculated`
- `payment_link_created`
- `payment_link_failed`
- `payment_link_opened`
- `flow_return_received`
- `payment_confirmed`
- `payment_pending`
- `payment_failed`
- `payment_expired`
- `whatsapp_support_clicked`

Dimensiones minimas:

- `order_id`
- `channel`
- `origin`
- `product_mix`
- `subtotal`
- `shipping`
- `total`
- `payment_status`

## 8. Plan de pruebas

- Normalizacion de origen:
  - hero, quiz, products y paginas editoriales deben producir el mismo `order_draft`.
- Calculo de total:
  - el backend debe ignorar cualquier monto manipulable desde frontend.
- Shipping:
  - probar monto bajo, monto sobre `$36.000`, comunas cubiertas y comunas fuera de cobertura.
- Flow sincronico:
  - pago con confirmacion inmediata y retorno exitoso.
- Flow asincronico:
  - retorno antes de confirmacion y pagina mostrando `pendiente`.
- Falla de pago:
  - rechazo y reintento sin duplicar el pedido.
- Expiracion:
  - link vencido por `timeout`.
- Idempotencia:
  - doble callback de confirmacion no debe duplicar estados ni registros.
- Conciliacion:
  - pedido y pago deben quedar vinculados en Google Sheets con el mismo `order_id`.
- UX movil:
  - revisar legibilidad, CTA, errores, resumen estable y soporte visible.

## 9. Siguientes pasos concretos

1. Definir la hoja `orders`, `customers` y `payments` en Google Sheets con el contrato de este documento.
2. Elegir el runtime del backend ligero mas compatible con el deploy actual del sitio.
3. Implementar `POST /api/order-drafts` y `POST /api/payment-links`.
4. Implementar `urlConfirmation` con consulta obligatoria a `/payment/getStatus`.
5. Implementar pagina propia de retorno con estados y fallback a WhatsApp.
6. Reemplazar la salida directa a WhatsApp desde home por `captura minima -> Flow -> confirmacion`.

## 10. Fuentes

- Flow Developers - Crear una orden de pago: <https://developers.flow.cl/docs/tutorial-basics/create-order>
- Flow Developers - Flujo de integracion: <https://developers.flow.cl/en/docs/tutorial-basics/integration-flow>
- Flow Developers - Confirmacion de orden: <https://developers.flow.cl/en/docs/tutorial-basics/order-confirmation>
- Flow Developers - Estado de orden: <https://developers.flow.cl/docs/tutorial-basics/status>
- Flow Developers - Finalizacion de orden: <https://developers.flow.cl/docs/tutorial-basics/order-finished>
- Flow - Manual Link de Pago: <https://web.flow.cl/manual-linkdepago-flowpagos.pdf>
- Stripe - Website checklist: <https://docs.stripe.com/get-started/checklist/website>
- Stripe - Checkout flow design strategies: <https://stripe.com/resources/more/checkout-flow-design-strategies-that-can-help-boost-conversion-and-customer-retention>
- Stripe - Checkout screen best practices: <https://stripe.com/resources/more/checkout-screen-best-practices>
