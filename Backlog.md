# Backlog

Documento interno para registrar ideas, decisiones y pendientes de futuras implementaciones.

- Estado: activo
- Apertura: 2026-04-11
- Visibilidad: interno, no enlazar desde el sitio
- SEO: excluir de enlaces publicos, `sitemap.xml` y rastreo por `robots.txt`

## Decision operativa vigente

- Fecha: 2026-04-11
- Decision: mantener por ahora el modelo minimo `Flow + WhatsApp`, sin migrar a una plataforma e-commerce.
- Implementacion inicial definida: montar la operacion interna en `Google Sheets` como primera opcion; evaluar `Airtable` solo si el plan gratuito cubre la operacion sin costo y aporta vistas/automatizaciones utiles.
- Criterio: primero ordenar pedidos, pagos y despacho; despues evaluar una capa e-commerce si el volumen o la complejidad lo justifican.

## Escala de prioridad

- `P0 critica`: bloquea operacion basica o genera alto riesgo de error manual.
- `P1 alta`: importante en el corto plazo para escalar sin friccion.
- `P2 media`: mejora soporte, retencion o canales secundarios.
- `P3 baja/deferida`: valiosa, pero no urgente en el modelo actual.

## Backlog ordenado por prioridad

### Base operativa minima manual (`Flow + WhatsApp + Google Sheets/Airtable`)

- Fecha: 2026-04-11
- Prioridad: P0 critica
- Estado: pendiente
- Contexto: Definir y montar la capa operativa minima sin e-commerce. La referencia vigente es `Flow + WhatsApp`, con `Google Sheets` como primera opcion y `Airtable` solo si el plan gratuito alcanza para operar sin costo.
- Siguiente paso: decidir la herramienta base y modelar una unica fuente de verdad para pedidos, clientes y estados operativos.

### Registrar pedidos de forma estructurada

- Fecha: 2026-04-11
- Prioridad: P0 critica
- Estado: pendiente
- Contexto: WhatsApp no puede seguir siendo el registro principal del negocio. Cada pedido necesita quedar trazado en una base estructurada para poder prepararlo, cobrarlo, despacharlo y revisarlo despues sin depender del chat.
- Siguiente paso: definir campos obligatorios como `order_id`, fecha, cliente, telefono, producto, tueste, formato, molienda, total, medio de pago, estado, direccion, ventana de entrega y notas.

### Guardar cliente, direccion y estado del pedido

- Fecha: 2026-04-11
- Prioridad: P0 critica
- Estado: pendiente
- Contexto: Sin ficha minima de cliente y sin estados claros, se vuelve facil repetir errores de direccion, perder contexto de recompra y confundir pedidos pagados con pedidos solo conversados.
- Siguiente paso: definir estados canonicos (`pendiente`, `link enviado`, `pagado`, `en preparacion`, `despachado`, `entregado`, `cancelado`) y vincularlos a una ficha basica de cliente.

### Backoffice para operacion diaria

- Fecha: 2026-04-11
- Prioridad: P0 critica
- Estado: pendiente
- Contexto: Aunque sea manual, Roast necesita una vista unica para operar el dia: que entro, que se pago, que se prepara, que se despacha y que sigue atrasado.
- Siguiente paso: disenar una vista operativa simple con filtros por estado, fecha, comuna y responsable usando la misma base elegida para pedidos.

### Implementacion de Flow para ofrecer links de pago

- Fecha: 2026-04-11
- Prioridad: P1 alta
- Estado: pendiente
- Contexto: El modelo actual pide mantener `Flow` como pasarela de pago dentro del flujo conversacional. El link de pago tiene que integrarse al proceso comercial y quedar asociado a un pedido real.
- Siguiente paso: definir en que momento se genera el link, quien lo envia, como se referencia contra el pedido y que texto comercial se usara al compartirlo.

### Confirmar pago automaticamente con webhook/API

- Fecha: 2026-04-11
- Prioridad: P1 alta
- Estado: pendiente
- Contexto: Mientras el volumen sea muy bajo puede revisarse Flow manualmente, pero la confirmacion automatica pasa a ser importante apenas sube la cantidad de pedidos o se quiere evitar conciliacion manual.
- Siguiente paso: evaluar integracion minima de Flow via webhook/API para actualizar el estado del pedido cuando el pago quede confirmado.

### Manejar inventario y quiebres de stock

- Fecha: 2026-04-11
- Prioridad: P1 alta
- Estado: pendiente
- Contexto: Aunque el catalogo sea corto, hace falta control basico de disponibilidad por tueste, formato y materiales operativos para no vender algo que no se puede cumplir.
- Siguiente paso: definir stock minimo a controlar al inicio y el nivel de detalle necesario para operar sin sobrecargar el sistema manual.

### Calcular despacho y seguimiento

- Fecha: 2026-04-11
- Prioridad: P1 alta
- Estado: pendiente
- Contexto: La promesa de despacho en Santiago requiere reglas claras de cobertura, costo, envio gratis, fecha comprometida y confirmacion de entrega.
- Siguiente paso: documentar comunas cubiertas, reglas de cobro, responsable del despacho y el estado minimo de seguimiento necesario dentro del registro de pedidos.

### Recompra sin cuenta de cliente (`buy again`)

- Fecha: 2026-04-11
- Prioridad: P2 media
- Estado: pendiente
- Contexto: Para Roast la recompra importa mas que una cuenta de cliente formal. En el modelo actual conviene resolver primero historial, recordatorios y repeticion de pedido sin obligar a montar login o portal de cliente.
- Siguiente paso: definir una ficha resumida de historial por cliente y un flujo simple para repetir ultimo pedido o una variante cercana.

### Recuperacion de leads no cerrados desde quiz/WhatsApp

- Fecha: 2026-04-11
- Prioridad: P2 media
- Estado: pendiente
- Contexto: En este modelo no hay `checkout abandonado` tradicional. La necesidad real es recuperar conversaciones iniciadas, recomendaciones del quiz y pedidos no cerrados que quedaron en pausa.
- Siguiente paso: definir que eventos cuentan como lead tibio, cuanto tiempo esperar antes de retomar y que mensaje de seguimiento usar sin volverlo invasivo.

### Implementar Cloudflare MX para `@caferoast.cl` con reenvio a Gmail personal

- Fecha: 2026-04-11
- Prioridad: P2 media
- Estado: pendiente
- Contexto: Configurar recepcion de correo del dominio en Cloudflare y redireccionar alias del dominio a cuentas Gmail personales para profesionalizar el canal sin sumar complejidad operativa innecesaria.
- Siguiente paso: definir aliases a publicar, correos destino y alcance exacto del reenvio.

### Agregar informacion de `contacto@caferoast.cl` en la web

- Fecha: 2026-04-11
- Prioridad: P2 media
- Estado: pendiente
- Contexto: Publicar el correo de contacto en puntos visibles del sitio una vez definido el canal operativo real del dominio y confirmado que habra alguien leyendolo con continuidad.
- Siguiente paso: decidir ubicaciones, copy y dependencia exacta con la configuracion de correo en Cloudflare.

### Suscripciones autogestionables por el cliente

- Fecha: 2026-04-11
- Prioridad: P3 baja/deferida
- Estado: pendiente
- Contexto: Es una palanca importante de LTV, pero no deberia implementarse antes de ordenar pedidos, pagos, inventario y despacho. Primero hay que estabilizar la operacion base.
- Siguiente paso: reevaluar una vez que el flujo manual este ordenado y haya suficiente frecuencia de recompra para justificar una experiencia autogestionada.

## Formato sugerido para nuevas entradas

### Titulo del pendiente

- Fecha:
- Prioridad:
- Estado:
- Contexto:
- Siguiente paso:
