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

## 2026-04-11 - Ajuste de altura en productos y fix de quiz

- Se compacto la seccion de productos reduciendo altura visual de cards, acortando el copy descriptivo, poniendo los selectores en 2 columnas desde `560px` y bajando el padding general de `#products`.
- Se rehizo el binding del quiz para no depender de `onclick` inline: los pasos ahora se conectan por listeners en `assets/site.js`, se exponen los handlers en `window` por compatibilidad y la tercera pregunta queda verificada hacia `quizStep4`.
- Validacion realizada con `node --check assets/site.js`, `git diff --check`, parseo HTML via `python3`, respuesta `200` del home servido localmente y simulacion de DOM con `jsdom` confirmando que al elegir en la pregunta 3 se llena la recomendacion, se activa `quizStep4` y el progreso pasa a `100`.
- Pendiente/deferido: sigue faltando validacion visual real en navegador para revisar el nuevo alto percibido de la seccion en dispositivos concretos fuera de este entorno.

## 2026-04-11 - Hilo documental e ingreso de backlog

- Se registro `AGENTS.md` en la raiz para dejar explicito que, cuando el usuario marque un hilo como documental e investigacional, no se debe desarrollar codigo ni tocar archivos productivos salvo instruccion explicita.
- Se actualizo `Backlog.md` con 3 pendientes nuevos: flow para links de pago, configuracion de correo del dominio via Cloudflare con reenvio a Gmail personal y publicacion de `contacto@caferoast.cl` en la web.
- Validacion realizada con `git diff --check` y lectura puntual de `AGENTS.md` y `Backlog.md`; no se refresco stack local porque esta iteracion fue solo documental y no introdujo cambios ejecutables.
- Pendiente/deferido: los 3 items agregados permanecen en estado `pendiente` hasta que se definan alcance y ejecucion en un hilo de implementacion.

## 2026-04-11 - Compactacion final de productos y auditoria Playwright real

- Se rehizo la composicion superior de ambas cards en `#products` para que imagen y resumen convivan en un layout interno mas compacto; adicionalmente se redujeron paddings, densidad de chips, tipografia auxiliar y se adelantaron los selectores a 2 columnas desde `390px`.
- Se corrigio el reinicio del quiz en `assets/site.js` para limpiar tambien recomendacion, precio y CTA antes de volver a la pregunta 1.
- Se habilito auditoria real con Chromium desde Playwright resolviendo las dependencias faltantes en espacio de usuario y se ejecuto revision automatizada sobre `/`, las 4 URLs editoriales y los assets de producto, junto con screenshots y metricas del bloque `#products` en `390`, `540`, `768`, `1024` y `1280`.
- Validacion realizada con `node --check assets/site.js`, `git diff --check`, respuesta `200` para `/`, `/cafe-a-domicilio/`, `/cafe-de-especialidad/`, `/cafe-en-grano/`, `/cafe-molido/`, `/assets/products/Downtime-website.svg` y `/assets/products/modo-avion.svg`, mas una corrida Playwright que verifico: ausencia de overflow horizontal, cards balanceadas, controles de formato/molienda con precio y link de WhatsApp correctos, y los 3 caminos del quiz (`Downtime`, `Hiperfoco`, `ambos_250`) con progreso a `100`, resultado valido y `restart/back` operativos.
- Parcial: la resolucion de dependencias de Chromium quedo hecha a nivel usuario para esta sesion; no se instalaron librerias del sistema global porque el entorno no expone privilegios `sudo`.
- Pendiente/deferido: `Hiperfoco` sigue apoyandose en `assets/products/modo-avion.svg`; la siguiente mejora visual natural es crear su arte dedicado y volver a correr la misma auditoria con ese asset.

## 2026-04-11 - Reorden total del backlog operativo

- Se refresco el repo con `git pull --ff-only origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se reescribio `Backlog.md` completo para pasar de una lista corta acumulativa a un backlog ordenado por prioridad con escala `P0` a `P3`.
- Se dejo registrada la decision operativa vigente: seguir por ahora con `Flow + WhatsApp`, sin e-commerce, usando `Google Sheets` como primera opcion y `Airtable` solo si el plan gratuito alcanza y aporta algo real a la operacion.
- Se incorporaron y priorizaron las necesidades operativas discutidas para el modelo manual: pedidos estructurados, clientes/direcciones/estados, backoffice diario, links de pago Flow, confirmacion automatica de pago, inventario, despacho, recompra, recuperacion de leads, correo del dominio y suscripciones deferidas.
- Validacion realizada con `git diff --check`, lectura puntual de `Backlog.md`, `rg` para verificar decision operativa y prioridades, y refresh del stack local mediante `python3 -m http.server` con respuesta `200` para `/`, `/Backlog.md` y `/robots.txt`.
- Pendiente/deferido: la implementacion sigue en estado documental; el siguiente hilo deberia bajar los items `P0` a un esquema concreto de tablas, vistas y campos para `Google Sheets`, y reevaluar `Airtable` solo si el plan gratuito cubre una ventaja operativa clara.

## 2026-04-13 - Investigacion implementada para Flow links de pago

- Se refresco el repo con `git pull --ff-only origin main`; `main` ya estaba alineado con `origin/main` antes de editar.
- Se documento la investigacion completa en `FLOW_PAYMENT_LINK_RESEARCH.md`, cubriendo auditoria del funnel actual, evidencia del patron `WhatsApp`, ausencia de backend, comparativa entre link manual, `Flow /payment/create` y cobro por email, contrato minimo recomendado, gaps UX/e-commerce y plan de pruebas.
- Se bajo la recomendacion operativa a `Backlog.md`, dejando explicitado que la ruta recomendada es `Flow /payment/create + backend ligero + urlConfirmation + urlReturn + /payment/getStatus`, con `Google Sheets` como backoffice inicial y el link manual solo como fallback.
- Se actualizo `robots.txt` para bloquear el nuevo documento interno `FLOW_PAYMENT_LINK_RESEARCH.md` del rastreo publico.
- Validacion realizada con `git diff --check`, lectura puntual de `FLOW_PAYMENT_LINK_RESEARCH.md`, `Backlog.md` y `robots.txt`, mas busqueda de infraestructura server-side inexistente en el repo y verificacion documental de Flow/Stripe contra fuentes oficiales.
- Parcial: la investigacion deja recomendacion y contratos cerrados, pero no implementa aun el backend ligero, la captura minima en sitio ni la sincronizacion real con `Google Sheets`.
- Pendiente/deferido: definir el runtime exacto del backend, modelar las hojas `orders/customers/payments`, implementar los endpoints propuestos y reemplazar la salida directa a WhatsApp por `captura minima -> Flow -> confirmacion`.

## 2026-04-17 - Integracion operativa directa en `Roast_Control_Costos`

- Se implemento directamente en la planilla `Roast_Control_Costos` la capa operativa base sobre la estructura financiera existente, sin tocar archivos productivos del website ni refrescar stacks porque la instruccion final fue `none`.
- Se mantuvieron `Resumen`, `Costos por SKU`, `Gastos`, `Café` y se extendio `Gastos Fijos` con `Cloudflare Worker`, `Email Routing`, `Apps Script / Automatización` y `Otros operativos`, recalculando `% del total` y costo semanal con formulas derramadas.
- Se crearon y poblaron las hojas nuevas `Config`, `Clientes`, `Ventas`, `Lineas_Pedido`, `Pagos_Flow`, `Eventos` y `Operacion`, dejando headers, mapeos y formulas base para soportar captura de clientes, ventas, lineas, pagos Flow y trazabilidad operativa.
- En `Config` se dejaron las 4 secciones `SETTINGS`, `COMMUNES`, `CATALOG` y `STATUS_MAP`, incluyendo `contacto@caferoast.cl`, regla de despacho base, umbral de envio gratis, timeout Flow y catalogo inicial apoyado en `Costos por SKU`.
- `Pedidos` se convirtio en vista semanal derivada: `B3` ahora usa `week_key`, `E3` calcula fecha de inicio, `A4:J4` expone el layout operativo nuevo y `A5` consulta `Ventas` + `Lineas_Pedido` + `Pagos_Flow` para mostrar la semana seleccionada sin carga manual.
- `Flujo de Caja` paso a leer desde `Ventas`, `Lineas_Pedido` y `Pagos_Flow`, generando semanas dinamicas, ingresos por bucket `250g/500g/1kg`, costos variables, gastos fijos, resultado, acumulado, ticket promedio y margen promedio; tambien se ajusto la formula de margen semanal para no dejar `#DIV/0!` cuando no hay datos.
- `Resumen` quedo actualizado para leer el nuevo total de `Gastos Fijos` y sumar un bloque `OPERACIÓN ACTUAL` con conteos de `draft`, `manual_review`, `link_sent`, `pending_payment`, `paid`, `preparing` y `dispatched`.
- `Ventas` requirio expansion fisica de columnas por la derecha para alcanzar `AA:AH`; se insertaron columnas nuevas en la hoja y luego se completaron `flow_token`, `flow_checkout_url`, `flow_link_created_at`, `paid_at`, `preparing_at`, `dispatched_at`, `delivered_at` y `canceled_at`. Despues de esa expansion se reescribio `Operacion` para que volviera a leer `AB` y `AD` correctos.
- Validacion realizada exportando repetidamente la planilla a `.xlsx` y revisando headers, formulas y derrames en todas las hojas afectadas; no se implemento aun el Worker, los endpoints Flow ni el Apps Script de notificaciones en este paso.
- Parcial: la planilla ya soporta la estructura y vistas del plan, pero la automatizacion transaccional real sigue pendiente de backend y de la escritura efectiva desde `Cloudflare Worker` / Apps Script.
- Pendiente/deferido: conectar `POST /api/order-drafts`, `POST /api/payment-links`, `POST /api/flow/confirmation`, `POST /pago/retorno`, `GET /api/orders/:order_id`, persistencia hacia Google Sheets y notificaciones a `contacto@caferoast.cl`.

## 2026-04-17 - Ola completa v1: pedido web + Flow + Google Sheets

- Se implemento la ola completa del flujo transaccional en el repo productivo: se agrego el modulo `worker/` para `Cloudflare Worker` con endpoints `POST /api/order-drafts`, `POST /api/payment-links`, `POST /api/flow/confirmation`, `POST /pago/retorno` y `GET /api/orders/:order_id`, mas lectura/escritura operativa hacia Google Sheets, integracion Flow, notificaciones Apps Script y redireccion al resultado del pago.
- Se agrego `apps-script/` con el webhook minimo para notificaciones operativas por correo a `contacto@caferoast.cl`, con validacion por secreto compartido y ejecucion no bloqueante desde el Worker.
- Se creo el frontend transaccional nuevo: `pedido/index.html`, `pago/resultado/index.html` y `assets/checkout.js`; ademas `assets/site.css` se amplio con toda la capa visual del checkout, revision y resultado de pago para mobile y desktop.
- `assets/site.js` se reescribio para que el website deje de usar WhatsApp como accion primaria de compra: ahora serializa `drafts` hacia `/pedido/`, mantiene `WhatsApp` como fallback visible, actualiza tracking de `order_draft_started` / `whatsapp_fallback_clicked` y conserva compatibilidad con el quiz y las cards de producto.
- Se alineo el sitio publico con el nuevo funnel en `index.html`, `cafe-molido/`, `cafe-en-grano/`, `cafe-de-especialidad/` y `cafe-a-domicilio/`: los CTAs principales ahora llevan al pedido web, el copy deja de prometer cierre por WhatsApp, y el correo `contacto@caferoast.cl` queda visible como soporte en hero, footer o ambos segun contexto.
- Se actualizo el schema del home para incluir el email de contacto y se mantuvieron WhatsApp y telefono como soporte secundario.
- Se corrigieron los links de soporte para no depender de `href="#"`: incluso sin JavaScript cargado, los CTAs principales siguen llevando a `/pedido/` y los accesos de soporte conservan un destino generico funcional hacia WhatsApp.
- Se ajustaron los legales en `policies/terminos-y-condiciones.html`, `policies/politica-de-privacidad.html` y `policies/politica-de-reembolso.html` para declarar formulario web, Flow, Google Sheets, correo de contacto y WhatsApp como canal opcional de soporte.
- Se actualizo `sitemap.xml` para incluir `/pedido/` como URL indexable; `/pago/resultado/` y `/pago/retorno` quedaron fuera del sitemap y con proteccion `noindex` por `meta robots` y `X-Robots-Tag`.
- Validacion realizada con `node --check` sobre `assets/site.js`, `assets/checkout.js` y todos los JS de `worker/src`, parseo HTML via `python3` sobre home, landings, checkout, resultado y legales, `git diff --check`, servidor local `python3 -m http.server` y verificaciones HTTP `200` para `/`, `/pedido/`, `/pago/resultado/`, `/sitemap.xml` y `/robots.txt`.
- Completado totalmente: modulo Worker, Apps Script base, nuevas rutas publicas, rewire de CTAs, actualizacion de copy/SEO/legales, indexacion de `/pedido/` y soporte visible por correo + WhatsApp.
- Parcial: se dejo implementado el contrato completo con Flow y Google Sheets, pero no se pudo ejecutar una prueba end-to-end real contra servicios externos porque esta sesion no tiene secretos productivos ni credenciales de despliegue para Cloudflare / Flow / Google.
- Parcial: se refresco el stack `local` mediante servidor HTTP y verificacion directa de las rutas nuevas. Se intento localizar un mecanismo de refresh para `jaca`, pero no existe un comando, script ni ruta visible en este entorno para ejecutarlo de forma responsable.
- Pendiente/deferido: desplegar el Worker con secretos reales, conectar el Apps Script a sus `Script Properties`, probar el ciclo real `draft -> Flow -> webhook -> resultado`, y definir fuera de esta sesion como se refresca realmente `jaca`.

## 2026-04-17 - Refresh visual del home + hardening del checkout

- Se actualizo el home en `index.html` y `assets/site.css`: nuevo copy principal para dejar el cafe instantaneo, nuevos mensajes en los 2 pain points, `quiz` reubicado debajo de `products`, badge de `Hiperfoco` cambiado a `Más vendido`, CTA final reescrito y tagline del footer cambiado a `Café en grano o molido, a pedido a domicilio en Santiago`.
- Se mejoro la presentacion de productos con una vitrina superior que usa `assets/products/Downtime-bagvideo.mp4`, se elimino el video viejo `assets/products/freepik_3second-smooth-cinematic-_2770662398.mp4`, se hizo mas protagonista el arte de `Downtime` y `Hiperfoco` paso a usar el SVG dedicado `assets/products/Hiperfoco (9 x 12 cm).svg`.
- Se corrigio la alineacion del bloque `Soporte` en el footer compartido para home, checkout y resultado, dejando label, correo e iconos alineados a la izquierda tanto en mobile como en desktop.
- Se reforzo `assets/checkout.js` para que `POST /api/order-drafts`, `POST /api/payment-links` y `GET /api/orders/:order_id` no hagan `response.json()` a ciegas: ahora detectan HTML, JSON invalido y formatos inesperados, mostrando un mensaje explicito cuando `/api` devuelve hosting estatico en lugar del Worker.
- Se eliminaron el copy `Este flujo deja el pedido...` en `pedido/index.html` y el checkout/resultado quedaron preparados para una base de API configurable mediante `data-api-base`, manteniendo `same-origin` como default.
- Se dejo `worker/wrangler.toml` con rutas declaradas para `caferoast.cl/api/*` y `caferoast.cl/pago/retorno`, alineando el wiring esperado del Worker con el dominio productivo.
- Validacion realizada con `node --check assets/checkout.js`, parseo HTML via `python3` sobre `index.html`, `pedido/index.html` y `pago/resultado/index.html`, `git diff --check`, servidor local `python3 -m http.server` con respuesta `200` para `/`, `/pedido/`, `/pago/resultado/`, `assets/products/Downtime-bagvideo.mp4` y `assets/products/Hiperfoco%20%289%20x%2012%20cm%29.svg`, mas revision dirigida por `rg` sobre copys reemplazados.
- Completado totalmente: refresh UI del landing, reordenamiento real del DOM, nuevo uso del video de Downtime, mejora visual de cards, correccion del footer y hardening del checkout contra respuestas HTML en `/api`.
- Parcial: se intento descubrir/publicar el Worker con `CI=1 npx wrangler whoami` y `CI=1 npx wrangler deploy`, pero el entorno no tiene autenticacion Cloudflare activa; `whoami` pidio `wrangler login` y `deploy` fallo por falta de `CLOUDFLARE_API_TOKEN`.
- Pendiente/deferido: desplegar realmente el Worker con credenciales Cloudflare y secretos productivos para que `caferoast.cl/api/*` deje de responder HTML de GitHub Pages y pase a servir el backend transaccional en produccion.
