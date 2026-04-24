# Backlog

Documento interno para registrar ideas, decisiones y pendientes de futuras implementaciones.

- Estado: activo
- Apertura: 2026-04-11
- Ultima actualizacion: 2026-04-18
- Visibilidad: interno, no enlazar desde el sitio
- SEO: excluir de enlaces publicos, `sitemap.xml` y rastreo por `robots.txt`

## Decision operativa vigente

- 2026-04-17: el stack objetivo y ya implementado en codigo es `pedido web + Flow + Google Sheets`, con `WhatsApp` y `contacto@caferoast.cl` como soporte/fallback. Falta activacion productiva, secretos reales y validacion end-to-end.

## Backlog ordenado por prioridad

| Prioridad | Iniciativa | Estado | Fecha | Contexto esencial | Siguiente paso |
| --- | --- | --- | --- | --- | --- |
| `P0 critica` | Desplegar `Cloudflare Worker` con secretos reales | `pendiente` | 2026-04-17 | El codigo ya existe, pero sin `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`, `APPS_SCRIPT_WEBHOOK_URL`, `APPS_SCRIPT_SHARED_SECRET` y `PUBLIC_BASE_URL` cargados en Cloudflare no hay activacion real. | Cargar secretos, publicar el `Worker` y dejar las rutas productivas resolviendo bajo el dominio final. |
| `P0 critica` | Conectar `Apps Script` y notificaciones operativas reales | `pendiente` | 2026-04-17 | El webhook y el contrato ya estan implementados, pero falta desplegar el proyecto de Apps Script, cargar `Script Properties` y verificar entrega de correos a `contacto@caferoast.cl`. | Publicar el web app, configurar el secreto compartido y probar eventos `draft_created`, `payment_link_created`, `paid`, `payment_failed` y `manual_review`. |
| `P0 critica` | Ejecutar prueba real end-to-end `draft -> Flow -> webhook -> resultado -> Sheets` | `pendiente` | 2026-04-17 | La validacion actual es local y estructural. Todavia no existe una compra real o de sandbox con credenciales funcionales que confirme el recorrido completo. | Correr una prueba con credenciales de prueba o produccion controlada y verificar persistencia, estados, redireccion y notificaciones. |
| `P0 critica` | Base operativa `pedido web + Flow + Google Sheets` | `implementado en codigo, pendiente despliegue` | 2026-04-17 | Ya existe el flujo `pedido -> pago -> resultado`, el `Worker` para pedidos/pagos, la integracion base con `Google Sheets` y el webhook de notificaciones por `Apps Script`. | Desplegar el `Worker` con secretos reales, conectar `Apps Script` y validar el primer ciclo real de compra. |
| `P0 critica` | Registro estructurado de pedidos, clientes y estados | `implementado en codigo, pendiente validacion real` | 2026-04-17 | La planilla `Roast_Control_Costos` ya tiene `Clientes`, `Ventas`, `Lineas_Pedido`, `Pagos_Flow`, `Eventos` y vistas operativas derivadas. | Confirmar con una compra real que `draft`, `link_sent`, `paid`, `payment_failed`, `manual_review` y los campos de cliente/direccion se escriben correctamente. |
| `P1 alta` | Manejar inventario y quiebres de stock | `pendiente` | 2026-04-11 | El flujo de venta ya esta encaminado, pero todavia no existe control operativo de disponibilidad por producto, formato o insumos. | Definir que nivel minimo de stock conviene modelar primero y donde viviria esa verdad operativa. |
| `P1 alta` | Cerrar despacho y seguimiento operativo real | `parcial` | 2026-04-17 | Ya existen regla base de despacho, comunas, umbral de envio gratis y estados de pedido, pero falta cerrar la operacion real de seguimiento y entrega. | Documentar comunas finales, responsable del despacho, criterio de confirmacion de entrega y si hace falta un estado adicional para incidencias. |
| `P2 media` | Recompra sin cuenta de cliente (`buy again`) | `pendiente` | 2026-04-11 | Ahora que ya existe estructura de pedidos/clientes, la siguiente mejora natural de conversion es repetir un pedido sin obligar a montar login o portal. | Definir si conviene un CTA `repetir pedido`, un link por email o un prefilling desde historial. |
| `P2 media` | Recuperacion de leads no cerrados desde quiz/WhatsApp | `pendiente` | 2026-04-11 | Con el pedido web activo, la necesidad real pasa a ser recuperar recomendaciones del quiz, inicios de pedido no cerrados y conversaciones que quedaron tibias. | Definir que evento dispara seguimiento, despues de cuanto tiempo y desde que canal. |
| `P2 media` | `contacto@caferoast.cl` publicado en la web | `completado` | 2026-04-17 | El correo ya aparece en home, landings, checkout, resultado y legales como canal visible de soporte. | Ninguno en sitio; solo reevaluar si se refuerza operacion de correo. |
| `P2 media` | Cloudflare MX para `@caferoast.cl` con reenvio a Gmail personal | `completado` | 2026-04-11 | La capa de infraestructura de correo del dominio ya fue resuelta y no requiere seguir como pendiente operativo. | Ninguno por ahora; solo mantener configuracion documentada si cambia el esquema de aliases. |
| `P3 baja/deferida` | Suscripciones autogestionables por el cliente | `pendiente` | 2026-04-11 | Sigue siendo una palanca interesante de LTV, pero no deberia entrar antes de estabilizar despliegue, pagos reales, despacho e inventario. | Reevaluar cuando exista recompra estable y suficiente frecuencia para justificar la experiencia. |
