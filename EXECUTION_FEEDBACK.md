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

## 2026-04-06 - Drawer, quiz, productos y footer

- Se refresco el repo con `git pull --rebase origin main`; `main` siguio alineado con `origin/main` antes de editar.
- Se limpio el drawer dejando solo navegacion primaria, se elimino el bloque legal, se elimino el CTA final y se corrigio `¿Por qué Café Roast?` tambien en el footer.
- Se agrando ligeramente el logotipo del header, se convirtio el WhatsApp del footer a icono con el mismo lenguaje visual de Instagram y hover verde, y se dejo el link directo a `https://wa.me/56951172813`.
- Se redujo el peso visual de los CTA de producto cambiandolos a iconos de WhatsApp, se agrego una imagen stock nueva al quiz y se llevo el fondo de `#subscription` al mismo naranja de `#final-cta`.
- Validacion realizada con parseo HTML via `python3`, `git diff --check` y verificacion por HTTP con `python3 -m http.server` de los enlaces, el nuevo asset del quiz, la limpieza del drawer y los cambios de estilo; no se ejecuto prueba visual automatizada en navegador.

## 2026-04-06 - CTA del header

- Se refresco el repo con `git pull --rebase origin main`; `main` siguio alineado con `origin/main` antes de editar.
- Se elimino el CTA de WhatsApp del header y se limpio el CSS asociado a `nav-cta` para no dejar estilos muertos.
- Validacion realizada con parseo HTML via `python3`, `git diff --check` y revision por busqueda de referencias para confirmar que el CTA solo se removio del header y no de otros bloques donde sigue en uso.

## 2026-04-07 - Altura fija del quiz y nuevo logo textual en header

- Se refresco el repo con `git pull --rebase origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se reemplazo el logo del header por un wordmark textual `Roast.` con punto en acento naranja, manteniendo el enlace al inicio y una alineacion limpia con el boton hamburguesa.
- Se envolvieron los pasos del quiz en un contenedor persistente y se agrego `syncQuizPanelHeight()` para fijar la altura del panel derecho en escritorio usando como referencia visual el paso de recomendacion.
- La altura minima del quiz se recalcula al cargar, al cambiar de paso, al redimensionar la ventana y al terminar de cargar las fuentes; bajo `900px` vuelve a altura automatica.
- Validacion realizada con parseo HTML via `python3`, `git diff --check` y verificacion por HTTP con `python3 -m http.server` de la presencia del nuevo wordmark, del contenedor `quizStepStack` y de la logica `syncQuizPanelHeight`; no se ejecuto prueba visual automatizada en navegador.

## 2026-04-08 - Eliminacion del CTA sticky mobile

- Se refresco el repo con `git fetch origin`; `main` sigue alineado con `origin/main` y se mantuvieron intactas las eliminaciones existentes en `assets/logos/`.
- Se elimino por completo el bloque CSS de `#sticky-cta` y su markup al final de `index.html`, dejando la landing sin CTA persistente en mobile.
- Validacion realizada con `rg` sobre `index.html` para confirmar que ya no queda markup ni CSS de `sticky-cta`, y con `git diff --check`; no se ejecuto prueba visual automatizada en navegador.

## 2026-04-08 - Fusion de Subscription Teaser y Coverage

- Se refresco el repo con `git pull --rebase origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se fusionaron las secciones `Subscription Teaser` y `Coverage` en un solo bloque `#coming-next`, con un heading comun y dos paneles lado a lado desde desktop que conservan todo el contenido previo.
- Se ajusto el CSS para reemplazar los estilos de seccion independientes por una sola composicion responsive, manteniendo el CTA de suscripcion y los badges de cobertura dentro del nuevo layout.
- Validacion realizada con `rg` sobre `index.html` para confirmar la presencia de `#coming-next` y la eliminacion de las secciones `#subscription` y `#coverage`, con parseo HTML via `python3` y `git diff --check`; no se ejecuto prueba visual automatizada en navegador.

## 2026-04-08 - Drawer, footer y ajustes de Proximamente

- Se refresco el repo con `git pull --rebase origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se eliminaron del footer los 4 links internos a secciones y se recompuso el grid para dejar solo marca, redes y links legales.
- Se actualizo el menu hamburguesa para cubrir las secciones vigentes de la landing: inicio, pain points, quiz, productos, resenas, `Próximamente en Roast`, FAQ y CTA final.
- Se reemplazo el heading `Coming Next` por `Próximamente en Roast`, se ajusto el subcopy, se reordeno el contenido del panel de suscripciones a una secuencia mas natural y se paso la cobertura a grid para evitar que las ciudades se salgan del recuadro.
- Validacion realizada con `rg` para confirmar la eliminacion de `footer-links`, la presencia del nuevo copy `Próximamente en Roast` y las nuevas anchors del drawer; tambien con parseo HTML via `python3` y `git diff --check`; no se ejecuto prueba visual automatizada en navegador.

## 2026-04-08 - Reorden del footer

- Se refresco el repo con `git pull --rebase origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se reorganizo el footer en cuatro bloques de izquierda a derecha: wordmark `Roast.`, descriptor de marca y sitio, legales en columna y redes sociales.
- Se redujo el espacio desperdiciado recomponiendo el grid para desktop y manteniendo un stack limpio en mobile, sin mezclar legales, redes y logo dentro del mismo bloque.
- Validacion realizada con parseo HTML via `python3`, `git diff --check` y verificacion estructural del orden del footer para confirmar la secuencia wordmark, descriptor, legales y redes sociales; no se ejecuto prueba visual automatizada en navegador.
