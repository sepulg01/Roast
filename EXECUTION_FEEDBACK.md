## 2026-04-06

- Se refresco el repo con `git fetch origin`; `main` estaba alineado con `origin/main`.
- Se ajusto `coverage` para mantener una sola fila en desktop y conservar wrap en pantallas menores.
- Se elimino por completo la seccion `Como funciona` y sus estilos asociados.
- Se restauro la alternancia visual de fondos dejando `#products` sobre `var(--bg-primary)` y manteniendo cards sobre `var(--bg-surface)`.
- Se reemplazaron las imagenes genericas por imagenes de Unsplash relacionadas con cafe en hero y productos.
- Se restauro el CTA secundario del hero y todos los enlaces `Elegir mi cafe` ahora apuntan a `#products`.
- Validacion realizada con revision de diff y busquedas sobre anchors/URLs; no se ejecuto prueba visual automatizada en navegador.
- Se refresco el repo con `git pull --rebase`; `main` seguia alineado con `origin/main`.
- Se generaron tres propuestas nuevas de logo en `assets/logos/` tomando como base el footer actual y el uso de `Space Grotesk`.
- Se vectorizo el lettering para que los SVG no dependan de una fuente del sistema al momento de abrirlos.
- Se agrego `assets/logos/preview.html` para comparar rapidamente las tres opciones en contexto oscuro similar a una bolsa negra.
- Se genero `assets/logos/roast-logo-preview-strip.png` para revisar las tres opciones dentro de esta app, que no previsualiza SVG directamente.
- Validacion realizada mediante parseo XML de los SVG y revision visual del preview PNG sobre fondo negro.

## 2026-04-06 - Copy, quiz y politicas

- Se refresco el repo por SSH y `HEAD` quedo alineado con `origin/main` antes de editar.
- Se ajusto el hero con nuevo copy y se dio un estilo propio semitransparente al boton `Elegir mi cafe`.
- Se actualizaron los pain points para reforzar el contraste frente al cafe instantaneo.
- Se simplifico el quiz a solo 2 preguntas y se hizo coherente el progreso, la recomendacion y el mensaje de WhatsApp.
- Se eliminaron los selectores de origen en productos y los links de compra ahora usan solo formato y molienda.
- Se extrajeron los textos legales del footer a `policies/terminos-y-condiciones.html`, `policies/politica-de-privacidad.html` y `policies/politica-de-reembolso.html`.
- Se reemplazaron los acordeones legales del home por hipervinculos en footer y drawer hacia las nuevas paginas estaticas.
- Validacion realizada con `rg`, `git diff --check` y verificacion de presencia de los archivos creados; no se ejecuto prueba visual automatizada en navegador.
