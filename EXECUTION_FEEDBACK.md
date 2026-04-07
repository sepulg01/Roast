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

## 2026-04-06 - Header, drawer, FAQ y favicon

- Se refresco el repo con `git pull --rebase`; `main` seguia alineado con `origin/main` antes de editar.
- Se reemplazo el wordmark textual del header por `assets/logos/roast-logo-01-core.svg` y se compacto la barra con un tratamiento mas delgado, semitransparente y con blur.
- Se corrigio el bug de stacking del drawer separando el estilo del header del selector global `nav`; el panel ahora abre debajo del header y con scrim mas consistente.
- Se reforzo la visibilidad del boton hamburguesa con mejor contraste, area tactil de 44x44 y estados abiertos/cerrados mas claros.
- Se aplico a las 8 FAQ un highlight consistente con el lenguaje del boton `Avisarme cuando este disponible`, incluyendo hover, focus y estado abierto.
- Se agrego `assets/favicon.svg` como favicon nuevo con monograma `R` sobre fondo carbon y acento naranja.
- Validacion realizada con `htmlhint` sin errores y revision manual del diff; se intento validacion visual con Playwright, pero el entorno no tiene las dependencias del sistema necesarias para ejecutar Chromium.

## 2026-04-06 - FAQ copy e Instagram en footer

- Se refresco el repo con `git fetch origin`; despues del fetch, `main` quedo alineado con `origin/main`.
- Se actualizaron 3 respuestas del FAQ y 1 pregunta de capsulas en `index.html` con el copy solicitado.
- Se agrego un acceso a Instagram en el footer como icono unico, con SVG inline, `aria-label`, apertura en nueva pestana, foco visible y area tactil de 44x44.
- Validacion realizada sirviendo `index.html` con `python3 -m http.server` y verificando por HTTP la presencia del nuevo copy, del enlace a `https://www.instagram.com/caferoast.cl` y de los estilos del icono social; no se ejecuto prueba visual automatizada en navegador.
