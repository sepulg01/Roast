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

## 2026-04-08 - Diagnostico SEO de caferoast.cl

- Se refresco el repo con `git pull --ff-only`; `main` ya estaba alineado con `origin/main` antes de revisar.
- Se audito el sitio publicado `https://caferoast.cl` y el markup local para revisar indexabilidad, metadatos, enlazado, datos estructurados y activos compartibles.
- Se confirmo que el home responde `200`, que las paginas legales existen y que faltan `robots.txt` y `sitemap.xml`.
- Se detecto ausencia de `canonical`, ausencia de metadatos `twitter:*`, `og:image` roto en `https://caferoast.cl/assets/og-image.jpg` y uso de `Organization` schema minimo sin `Product` ni `FAQPage`.
- Se detecto que la propuesta de valor SEO esta concentrada en una sola landing: el `title` y el `h1` priorizan branding/copy por sobre keywords transaccionales como `cafe de especialidad`, `cafe molido`, `cafe en grano` y cobertura geografica.
- Validacion realizada con `curl`, `rg`, inspeccion directa de `index.html` y comprobacion HTTP de assets y endpoints publicados; no se ejecuto PageSpeed Insights porque la API respondio `429 quota exceeded`.

## 2026-04-08 - Evaluacion de logos raster en assets/logos

- Se refresco el repo con `git fetch --all --prune`; `main` sigue alineado con `origin/main` antes de revisar.
- Se inspeccionaron visualmente `assets/logos/logo_black.png`, `assets/logos/logo_white.png` y `assets/logos/favicon.png` para evaluar su uso como logotipo sobre version negra y como favicon.
- Se detecto que los tres archivos usan extension `.png`, pero tecnicamente contienen imagen JPEG raster sin transparencia; en su estado actual sirven para mockup o revision, no como assets finales de marca.
- `logo_black.png` funciona mejor como referencia visual sobre fondo oscuro, pero no como logotipo productivo porque trae el fondo negro horneado dentro del archivo.
- `logo_white.png` es la variante mas cercana a wordmark para fondos claros, aunque el tono del lettering se ve cafe oscuro y no negro puro.
- `favicon.png` es la mejor base conceptual para favicon porque simplifica a monograma `R` mas grano, pero conviene vectorizarlo o exportarlo con transparencia y simplificarlo un punto mas para 16x16.
- Validacion realizada con revision visual directa en esta app, lectura de metadatos binarios y comparacion contra el favicon actual `assets/favicon.svg`; no se ejecuto prueba en navegador a tamanos reales de 16x16/32x32.

## 2026-04-08 - Preparacion de logo oscuro final

- Se refresco el repo con `git pull --rebase origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se recupero del historial el lettering vectorial de Roast y se simplifico a una version final sin adornos secundarios, manteniendo una sola marca oscura en `assets/logos/roast-logo-dark.svg`.
- Se construyo el acento del logotipo como grano naranja separado del wordmark para acercarlo a la propuesta visual aprobada y dejar el asset con fondo transparente.
- Se reemplazo el wordmark textual del header y del footer por el nuevo SVG oscuro, manteniendo el favicon actual sin cambios.
- Validacion realizada con `git diff --check`, busqueda de referencias viejas con `rg` y parseo XML del SVG con `python3`; no se ejecuto validacion visual automatizada porque el entorno no tiene herramientas locales para rasterizar o previsualizar SVG.

## 2026-04-08 - SEO v1 con 4 URLs comerciales y base tecnica

- Se refresco el repo con `git pull --ff-only`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se extrajo el CSS y JS compartidos a `assets/site.css` y `assets/site.js` para sostener la landing principal y las nuevas paginas SEO sin introducir framework ni build step.
- Se reescribio `index.html` como hub SEO con nuevo `title`, `meta description`, `canonical`, Open Graph, Twitter Cards, `Organization` + `WebSite` + `FAQPage`, y enlaces visibles hacia `/cafe-molido/`, `/cafe-en-grano/`, `/cafe-de-especialidad/` y `/cafe-a-domicilio/`.
- Se crearon las 4 nuevas URLs limpias con `index.html` propio, cada una con hero especifico, copy distinto, bloque de formatos, FAQ especifica, `canonical`, OG, Twitter y schema `WebPage` + `BreadcrumbList` + `FAQPage`.
- Se creo `assets/og-image.jpg` como asset social real y se agregaron `robots.txt` y `sitemap.xml`; `robots.txt` permite el sitio, bloquea `/policies/` y publica el sitemap con solo las 5 URLs indexables.
- Se mantuvieron las paginas legales publicas y enlazadas desde el footer, pero fuera de `sitemap.xml` y bloqueadas por `robots.txt` conforme al alcance definido.
- Se mejoro la generacion de mensajes de WhatsApp para productos, dejando frases legibles para molienda y grano entero.
- Validacion realizada con `git diff --check`, `rg` sobre metadatos SEO y schema, servidor local `python3 -m http.server`, verificacion HTTP `200` de `/`, las 4 nuevas URLs, `/robots.txt`, `/sitemap.xml` y `/assets/og-image.jpg`; no se ejecuto prueba visual automatizada en navegador ni validacion externa en Rich Results Test desde este entorno.

## 2026-04-08 - Ajuste del hero y reconversion editorial del home

- Se refresco el repo antes de editar y se confirmo que el worktree contenia otros cambios ya presentes en archivos ajenos a esta iteracion; se preservaron sin tocar.
- Se restauro en `index.html` el hero anterior con el eyebrow `Tu primer cafe real.` y el H1 `Tu desayuno merece mas que agua tibia con colorante.`, manteniendo intacto el `hero-proof`.
- Se reemplazo el subcopy del hero con la version acordada sobre dejar el cafe instantaneo y pedir formato + molienda por domicilio.
- Se elimino la linea visible `Si ya sabes lo que quieres...` y se movio el `seo-hub` al tramo final del `main`, justo antes del CTA final, con tono de articulos educativos en lugar de categorias de producto.
- Se redujo la seccion de productos a 2 cards: `Se cayo el sistema` y `Modo Avion`, cada una con `Formato`, `Molienda`, precio dinamico y CTA de WhatsApp conectado al contrato compartido ya existente en `assets/site.js`.
- Se cambio el wordmark del header y footer a la version tipografica `Roast.` usando las clases solicitadas, sin modificar la estructura de wrappers circundante.
- Se incorporaron ilustraciones SVG inline como reemplazo temporal de imagenes de producto dentro de `index.html`, porque el generador de imagenes no estuvo disponible en esta sesion.
- Validacion realizada con `git diff --check`, inspeccion puntual de `index.html`, confirmacion de atributos `data-product-*` y lectura del contrato ya existente en `assets/site.js`; no se ejecuto render visual automatizado en navegador desde este entorno.

## 2026-04-08 - Integracion final de home, articulos y selector dinamico

- Se refresco `main`, se integraron los commits intermedios empujados por subagentes y se normalizo el estado local antes del cierre final.
- Se pulio `index.html` para dejar el home coherente con la nueva navegacion editorial, el wordmark textual `Roast.` y la nueva seccion de 2 productos basada en `Se cayo el sistema` y `Modo Avion`.
- Se extendio `assets/site.css` con soporte para wordmark tipografico, cards de producto orientadas a coleccion y nuevos bloques de metadata, manteniendo el resto del layout existente.
- Se reescribio `assets/site.js` para que el home deje de depender de ids por tamano y pase a usar cards semanticas por producto con `Formato`, `Molienda`, precio dinamico y CTA de WhatsApp construido por `data-product-*`.
- Se corrigieron y limpiaron las 4 paginas articulo: `cafe-molido/`, `cafe-en-grano/`, `cafe-de-especialidad/` y `cafe-a-domicilio/`, dejando fuera cards de producto, precios y selectores, y cerrando errores estructurales que habian quedado durante la transicion.
- En `cafe-a-domicilio/` se rehizo por completo el cuerpo principal para dejarlo como guia editorial sobre cobertura, tiempos y logica de despacho en Santiago, sin residuos de la landing transaccional anterior.
- Validacion realizada con `git diff --check`, `node --check assets/site.js`, parseo HTML via `python3`, busqueda de `products-note` y de secciones `#products` en las paginas articulo, y servidor local `python3 -m http.server` con respuesta `200` para `/`, `/cafe-molido/`, `/cafe-en-grano/`, `/cafe-de-especialidad/` y `/cafe-a-domicilio/`.
- Limitacion registrada: el tool integrado `image_gen` no estuvo disponible y tampoco habia `OPENAI_API_KEY` para el fallback CLI del skill `imagegen`, por lo que las visuales de producto quedaron resueltas con ilustraciones SVG personalizadas dentro del home como solucion practica de esta sesion.

## 2026-04-09 - SEO v2: indexacion, articulos y señales de frescura

- Se refresco el repo con `git pull --ff-only origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se corrigio la estrategia de indexacion de legales: `robots.txt` dejo de bloquear `/policies/` y las 3 paginas legales ahora exponen `meta name="robots" content="noindex,follow"` junto con self-canonical absoluto.
- Se actualizo `sitemap.xml` para mantener solo las 5 URLs indexables y agregar `lastmod` manual en todas.
- Se alineo el schema del home con la identidad visual actual cambiando `Organization.logo` a `assets/logos/roast-wordmark.png`, y se genero ese asset PNG transparente a partir de `Space Grotesk Bold`.
- Se extrajeron las 2 ilustraciones inline del home a `assets/products/se-cayo-el-sistema.svg` y `assets/products/modo-avion.svg`, dejando `index.html` con referencias a assets fisicos en vez de `data:image/svg+xml`.
- Se reconvirtieron las 4 landings editoriales a una capa SEO mas clara: `cafe-molido/`, `cafe-en-grano/`, `cafe-de-especialidad/` y `cafe-a-domicilio/` ahora declaran `Article` + `BreadcrumbList` + `FAQPage`, mantienen un solo `H1`, agregan interlinking contextual dentro del cuerpo y suman un bloque `Que te conviene pedir ahora?` antes del CTA final.
- Se corrigio por completo la ortografia y acentuacion de `cafe-a-domicilio/` en `title`, `description`, Open Graph, Twitter, headings, FAQ, body copy y JSON-LD.
- Validacion realizada con `git diff --check`, parseo HTML via `python3`, inspeccion de tipos JSON-LD, busqueda dirigida para confirmar ausencia de residuos ASCII en `cafe-a-domicilio/`, servidor local `python3 -m http.server` y verificacion HTTP `200` para `/`, las 4 URLs editoriales, `robots.txt`, `sitemap.xml`, los 2 SVG de producto y `assets/logos/roast-wordmark.png`.

## 2026-04-11 - Backlog interno y control de rastreo

- Se refresco el repo con `git pull --ff-only origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se creo `Backlog.md` en la raiz como documento interno para registrar ideas y pendientes de futuras implementaciones, con estructura minima reutilizable.
- Se actualizo `robots.txt` para bloquear `/Backlog.md` sin alterar las URLs indexables actuales ni el `Sitemap`.
- Se mantuvo `Backlog.md` fuera de `sitemap.xml` y sin enlaces desde el website, para que no figure dentro de la navegacion publica ni de los assets SEO declarados.
- Validacion realizada con `git diff --check`, `rg` para confirmar ausencia de referencias publicas a `Backlog.md`, servidor local `python3 -m http.server` y verificacion HTTP `200` para `/`, `/robots.txt` y `/Backlog.md`.
- Pendiente/deferido: `robots.txt` evita rastreo, pero no restringe acceso directo; si se requiere privacidad real del backlog, habra que excluir este archivo del deploy publico o bloquear `*.md` desde el hosting.

## 2026-04-11 - Rename de productos, quiz v3 y refresh del home

- Se renombro la narrativa activa del home y de marca: `Se cayó el sistema` pasa a `Downtime` y `Modo Avión` pasa a `Hiperfoco`, actualizando `index.html`, `assets/site.js` y la tabla de colección en `BRAND_CONTEXT.md`.
- Se rehizo el quiz a 3 preguntas, se elimino la visual lateral y se reemplazo por un contenedor texturizado gris carbon con acentos naranja; la recomendacion ahora define formato, molienda y tueste, incluyendo la opcion `250g de Downtime + 250g de Hiperfoco`.
- Se incorporo `assets/products/Downtime-website.svg` a la card de `Downtime`, se alineo su copy al eje `balance + versatilidad`, se corrigio el subtitulo de productos y se actualizaron reseñas y articulos para el nuevo recorrido editorial.
- Validacion realizada con `node --check assets/site.js`, parseo HTML via `python3`, `rg` para residuos de nombres antiguos y servidor local `python3 -m http.server` con respuesta `200` para `/`, las 4 URLs editoriales y los assets de producto. Se intento validacion responsive con Playwright en 375/768/1024/1280, pero el entorno no tiene las librerias del sistema requeridas por Chromium (`libnss3`, `libnspr4`, `libgbm1`, `libasound2`), por lo que no se pudo completar inspeccion visual en navegador desde esta sesion.
- Parcial: `Hiperfoco` sigue reutilizando `assets/products/modo-avion.svg`; el rename visual del segundo producto queda incompleto hasta contar con un arte dedicado.
- Pendiente/deferido: generar un asset propio para `Hiperfoco` y reevaluar recien ahi si conviene renombrar tambien el archivo fisico `modo-avion.svg`.
