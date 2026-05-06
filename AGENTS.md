# AGENTS.md

## Hilos documentales e investigacionales

- Cuando el usuario indique que el hilo actual es solo documental e investigacional, no desarrollar codigo.
- En ese modo, limitar cambios a documentacion interna, backlog, analisis, planes y registro de decisiones.
- No modificar archivos productivos del website ni configuraciones de infraestructura salvo instruccion explicita del usuario.

## Git

- Todos los `push` a GitHub deben hacerse via SSH.
- Asumir que existe una SSH key valida configurada para este repo; no usar HTTPS para `push` salvo instruccion explicita del usuario.

## Secretos y variables productivas

- Todas las variables sensibles o de configuracion productiva del `Worker` deben ser ingresadas por el usuario directamente en GitHub `Settings -> Environments -> production -> Environment secrets`.
- No pedir ni usar `export`, `.dev.vars`, variables locales de terminal ni archivos locales para cargar secretos productivos como `CLOUDFLARE_*`, `GOOGLE_*`, `RESEND_*`, `FLOW_*`, `WHATSAPP_*`, `ADMIN_ACTION_SECRET` o `APPS_SCRIPT_*`.
- Para llevar esos valores a Cloudflare, usar el workflow manual `Sync Worker Secrets`; para despliegues productivos, usar el workflow `Deploy Worker`.
- Si falta un secreto, indicar el nombre exacto que el usuario debe agregar en GitHub `production`, sin solicitar que pegue el valor en el chat.
