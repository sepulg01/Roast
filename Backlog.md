# Backlog

Documento interno para registrar ideas, decisiones y pendientes de futuras implementaciones.

- Estado: activo
- Apertura: 2026-04-11
- Ultima actualizacion: 2026-04-17
- Visibilidad: interno, no enlazar desde el sitio
- SEO: excluir de enlaces publicos, `sitemap.xml` y rastreo por `robots.txt`

## Decision operativa vigente

- Fecha: 2026-04-17
- Decision: la base activa deja de ser `Flow + WhatsApp` puro. El stack objetivo y ya implementado en codigo es `pedido web + Flow + Google Sheets`, con `WhatsApp` y `contacto@caferoast.cl` como soporte/fallback.
- Implementacion actual: checkout web, `Cloudflare Worker`, `Apps Script` base y planilla operativa ya existen en el repo. Falta activacion productiva con secretos reales y validacion end-to-end.
- Criterio: mantener un stack liviano, sin migrar aun a una plataforma e-commerce completa, hasta estabilizar operacion, pagos y despacho.

## Escala de prioridad

- `P0 critica`: bloquea activacion real o genera alto riesgo operativo inmediato.
- `P1 alta`: importante en el corto plazo para operar con menos friccion o menos trabajo manual.
- `P2 media`: mejora soporte, retencion o infraestructura secundaria.
- `P3 baja/deferida`: valiosa, pero no urgente en el modelo actual.

## Implementado recientemente

### Base operativa `pedido web + Flow + Google Sheets`

- Fecha: 2026-04-17
- Prioridad: P0 critica
- Estado: implementado en codigo, pendiente despliegue
- Contexto: ya existe el flujo `pedido -> pago -> resultado`, el `Worker` para pedidos/pagos, la integracion base con `Google Sheets` y el webhook de notificaciones por `Apps Script`.
- Siguiente paso: desplegar el `Worker` con secretos reales, conectar `Apps Script` y validar el primer ciclo real de compra.

### Registro estructurado de pedidos, clientes y estados

- Fecha: 2026-04-17
- Prioridad: P0 critica
- Estado: implementado en codigo, pendiente validacion real
- Contexto: la planilla `Roast_Control_Costos` ya tiene `Clientes`, `Ventas`, `Lineas_Pedido`, `Pagos_Flow`, `Eventos` y vistas operativas derivadas.
- Siguiente paso: confirmar con una compra real que `draft`, `link_sent`, `paid`, `payment_failed`, `manual_review` y los campos de cliente/direccion se escriben correctamente.

### `contacto@caferoast.cl` publicado en la web

- Fecha: 2026-04-17
- Prioridad: P2 media
- Estado: completado
- Contexto: el correo ya aparece en home, landings, checkout, resultado y legales como canal visible de soporte.
- Siguiente paso: ninguno en sitio; queda pendiente solo la parte de correo/alias si se decide reforzar la operacion en Cloudflare.

## Backlog activo por prioridad

### Desplegar `Cloudflare Worker` con secretos reales

- Fecha: 2026-04-17
- Prioridad: P0 critica
- Estado: pendiente
- Contexto: el codigo ya existe, pero sin `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`, `APPS_SCRIPT_WEBHOOK_URL`, `APPS_SCRIPT_SHARED_SECRET` y `PUBLIC_BASE_URL` cargados en Cloudflare no hay activacion real.
- Siguiente paso: cargar secretos, publicar el `Worker` y dejar las rutas productivas resolviendo bajo el dominio final.

### Conectar `Apps Script` y notificaciones operativas reales

- Fecha: 2026-04-17
- Prioridad: P0 critica
- Estado: pendiente
- Contexto: el webhook y el contrato ya estan implementados, pero falta desplegar el proyecto de Apps Script, cargar `Script Properties` y verificar entrega de correos a `contacto@caferoast.cl`.
- Siguiente paso: publicar el web app, configurar el secreto compartido y probar eventos `draft_created`, `payment_link_created`, `paid`, `payment_failed` y `manual_review`.

### Ejecutar prueba real end-to-end `draft -> Flow -> webhook -> resultado -> Sheets`

- Fecha: 2026-04-17
- Prioridad: P0 critica
- Estado: pendiente
- Contexto: la validacion actual es local y estructural. Todavia no existe una compra real o de sandbox con credenciales funcionales que confirme el recorrido completo.
- Siguiente paso: correr una prueba con credenciales de prueba o produccion controlada y verificar persistencia, estados, redireccion y notificaciones.

### Manejar inventario y quiebres de stock

- Fecha: 2026-04-11
- Prioridad: P1 alta
- Estado: pendiente
- Contexto: el flujo de venta ya esta encaminado, pero todavia no existe control operativo de disponibilidad por producto, formato o insumos.
- Siguiente paso: definir que nivel minimo de stock conviene modelar primero y donde viviria esa verdad operativa.

### Cerrar despacho y seguimiento operativo real

- Fecha: 2026-04-17
- Prioridad: P1 alta
- Estado: parcial
- Contexto: ya existen regla base de despacho, comunas, umbral de envio gratis y estados de pedido, pero falta cerrar la operacion real de seguimiento y entrega.
- Siguiente paso: documentar comunas finales, responsable del despacho, criterio de confirmacion de entrega y si hace falta un estado adicional para incidencias.

### Definir y documentar refresh/deploy de `jaca`

- Fecha: 2026-04-17
- Prioridad: P1 alta
- Estado: pendiente
- Contexto: el refresh `local` se pudo validar, pero `jaca` no tiene aun un comando, script o entrypoint visible en este entorno.
- Siguiente paso: documentar como se refresca `jaca`, donde vive y que comando exacto corresponde ejecutar en futuras implementaciones.

### Recompra sin cuenta de cliente (`buy again`)

- Fecha: 2026-04-11
- Prioridad: P2 media
- Estado: pendiente
- Contexto: ahora que ya existe estructura de pedidos/clientes, la siguiente mejora natural de conversion es repetir un pedido sin obligar a montar login o portal.
- Siguiente paso: definir si conviene un CTA `repetir pedido`, un link por email o un prefilling desde historial.

### Recuperacion de leads no cerrados desde quiz/WhatsApp

- Fecha: 2026-04-11
- Prioridad: P2 media
- Estado: pendiente
- Contexto: con el pedido web activo, la necesidad real pasa a ser recuperar recomendaciones del quiz, inicios de pedido no cerrados y conversaciones que quedaron tibias.
- Siguiente paso: definir que evento dispara seguimiento, despues de cuanto tiempo y desde que canal.

### Implementar Cloudflare MX para `@caferoast.cl` con reenvio a Gmail personal

- Fecha: 2026-04-11
- Prioridad: P2 media
- Estado: pendiente
- Contexto: el correo ya esta publicado en la web, pero sigue faltando la capa de infraestructura si se quiere manejar alias y reenvio del dominio con mas prolijidad.
- Siguiente paso: definir aliases, destinos y si el alcance incluye solo `contacto@` o tambien cuentas adicionales.

### Suscripciones autogestionables por el cliente

- Fecha: 2026-04-11
- Prioridad: P3 baja/deferida
- Estado: pendiente
- Contexto: sigue siendo una palanca interesante de LTV, pero no deberia entrar antes de estabilizar despliegue, pagos reales, despacho e inventario.
- Siguiente paso: reevaluar cuando exista recompra estable y suficiente frecuencia para justificar la experiencia.

## Formato sugerido para nuevas entradas

### Titulo del pendiente

- Fecha:
- Prioridad:
- Estado:
- Contexto:
- Siguiente paso:
