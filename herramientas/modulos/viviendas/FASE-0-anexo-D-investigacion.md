# Módulo de viviendas · investigación de los cuatro huecos

Fecha de corte: 2026-10-23. Canal: WebSearch (25 búsquedas). WebFetch contestó
`ENOTFOUND developers.cloudflare.com` el único intento, así que **ninguna página
se abrió entera**: cada cifra sale del extracto que devolvió el buscador. Una
fila sale «verificada» solo si dos fuentes **de organizaciones distintas**
coinciden; dos páginas de la misma casa (p. ej. dos manuales de ECharts) cuentan
como una sola fuente.

Lo que no se encontró dice **SIN MEDIR**. Las licencias que conozco y no vi en un
resultado van marcadas aparte («sin fuente vista»), no rellenadas.

---

## 1 · Framework de cada app y monorepo

### 1a · La plataforma, que es lo que decide: los límites del plan gratis de Workers

| Opción | Cifra o hecho | Fuente 1 | Fuente 2 | Estado |
|---|---|---|---|---|
| Workers Free | 10 ms de CPU por petición HTTP; esperar `fetch()`, KV o la base **no cuenta** como CPU | [Limits · Workers docs](https://developers.cloudflare.com/workers/platform/limits/) | [fast.io · Workers limits](https://fast.io/resources/cloudflare-workers-limits/) | verificada |
| Workers Free | 100.000 peticiones al día | [Limits · Workers docs](https://developers.cloudflare.com/workers/platform/limits/) | [fast.io · Workers limits](https://fast.io/resources/cloudflare-workers-limits/) | verificada |
| Workers Free | 128 MB de memoria por isolate | [fast.io · Workers limits](https://fast.io/resources/cloudflare-workers-limits/) | [eastondev · límites gratis (mayo 2026)](https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/) | verificada (las dos son secundarias; la oficial no salió en el extracto) |
| Workers Free | 50 subpeticiones por invocación | [Limits · Workers docs](https://developers.cloudflare.com/workers/platform/limits/) | — | no verificada (falta la segunda) |
| Workers (todos los planes) | Tamaño del Worker: **64 MiB sin comprimir**, igual en Free y Paid, desde el 4 de septiembre de 2026; se retiró el control de 3 MB comprimido (Free) / 10 MB (Paid). Cuenta el «Total Upload» de Wrangler; el gzip es informativo | [Changelog · Deploy larger Workers](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/) | [Classmethod · prueba con wrangler](https://dev.classmethod.jp/en/articles/cloudflare-workers-64mib-size-limit/) (desplegó 8 MB en Free; 65 MB rechazado con error 10027) | verificada. **Contradicción con fuentes viejas**: la [guía de problemas de OpenNext](https://opennext.js.org/cloudflare/troubleshooting) todavía dice 3 MiB en Free, y [eastondev](https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/) dice 1 MB comprimido; las dos son anteriores al cambio |
| Workers | Un renderizado en servidor «típicamente usa 10-20 ms» de CPU, frente a ~2,2 ms del Worker medio | [Limits · Workers docs](https://developers.cloudflare.com/workers/platform/limits/) | — | no verificada (una sola fuente). **Es el dato que más pesa**: Cloudflare mismo dice que el SSR típico se pasa de los 10 ms del plan gratis |
| Workers | Al pasarse de la CPU sale el error 1102 («Exceeded CPU Time Limits», `exceededCpu` en registros); hay holgura para excesos ocasionales, no para constantes | [Error 1102](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102/) | [Limits · Workers docs](https://developers.cloudflare.com/workers/platform/limits/) | no verificada (las dos son de Cloudflare) |
| Static Assets | Si la URL coincide con un archivo estático, se sirve **sin invocar el Worker**; si no, pasa al Worker (salvo `run_worker_first`) | copia local de la documentación oficial de Static Assets (`cfdocs/docs_workers_static-assets_index.mdx`, línea 127; la URL no salió en ningún resultado y por eso no se enlaza) | [Astro · adaptador Cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) (primero los archivos del build, después el Worker) | verificada |

### 1b · Las tres candidatas para la plataforma pública

| Opción | Cifra o hecho | Fuente 1 | Fuente 2 | Estado |
|---|---|---|---|---|
| Astro + `@astrojs/cloudflare` | Astro 6 exige el adaptador v13 (13.1.0 en la doc); despliega rutas bajo demanda, server islands, actions y sessions en Workers | [Astro · adaptador Cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) | [Webflow Cloud · personalización](https://developers.webflow.com/webflow-cloud/environment/framework-customization.md) (usa ese adaptador para Astro; no dice versión) | no verificada (la versión solo la da Astro) |
| Astro | Páginas prerenderizadas se construyen por defecto en `workerd`; `prerenderEnvironment: 'node'` para las que piden APIs de Node | [Astro · adaptador Cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) | — | no verificada |
| Astro · mapa | `client:only="<framework>"` no renderiza en servidor y monta en el cliente al cargar; es la salida documentada para librerías que piden `window` (MapLibre lo pide) | [Astro · directivas](https://docs.astro.build/en/reference/directives-reference/) | [Astro · troubleshooting](https://docs.astro.build/en/guides/troubleshooting/) | no verificada (las dos son de Astro). Que MapLibre en concreto funcione así: SIN MEDIR |
| Astro · CPU de una ficha SSR en Workers | — | SIN MEDIR: no hay benchmark publicado por petición en Workers; los de CodSpeed de Astro son simulación en CI sobre Node y no traducen | — | SIN MEDIR |
| Next.js + OpenNext | `@opennextjs/cloudflare` va en la línea 1.x (1.20.13 última en npm); la 1.20.12 agregó Next.js 16.4; la doc dice que soporta todas las menores de Next 16 y las últimas de 14 y 15 | [npm · @opennextjs/cloudflare](https://www.npmjs.com/package/@opennextjs/cloudflare) | [Release 1.20.12](https://github.com/opennextjs/opennextjs-cloudflare/releases/tag/%40opennextjs/cloudflare%401.20.12) | no verificada (las dos son del mismo proyecto). **Contradicción**: la [portada de OpenNext Cloudflare](https://opennext.js.org/cloudflare) en una de sus copias todavía se dice «pre 1.0» y solo Next 15 |
| Next.js + OpenNext · madurez | Ritmo de parches de seguridad alto: 1.20.7 arregló 500 en todo el sitio con Next 16.3.x y subió el piso por un CVE de RCE en `next/og`; 1.20.8 volvió a subir el piso | [Release 1.20.7](https://github.com/opennextjs/opennextjs-cloudflare/releases/tag/%40opennextjs/cloudflare%401.20.7) | [Release 1.20.8](https://github.com/opennextjs/opennextjs-cloudflare/releases/tag/%40opennextjs/cloudflare%401.20.8) | no verificada (mismo proyecto) |
| Next.js + OpenNext · CPU | Hay reportes de «Script startup exceeded CPU time limit» (el arranque del script, no la petición) | [dev.to · feed de ricogr](https://dev.to/feed/ricogr) (solo se vio la introducción) | — | no verificada. CPU de una ficha: SIN MEDIR |
| Next.js + OpenNext · tamaño | El tope de 3 MiB que la doc de OpenNext da como bloqueo del plan gratis **ya no aplica** (ver 1a, 64 MiB) | [OpenNext · troubleshooting](https://opennext.js.org/cloudflare/troubleshooting) | [Changelog · 64 MiB](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/) | verificada (por las dos fuentes de la fila de 64 MiB); contradicción resuelta a favor del changelog, más nuevo. Tamaño real del Worker de una app Next: SIN MEDIR |
| SvelteKit + `adapter-cloudflare` | Soporta todas las funciones de SvelteKit y construye para Workers Static Assets y Pages; `adapter-cloudflare-workers` queda **deprecado** porque Workers Sites se retira | [SvelteKit · adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare) | [SvelteKit · adapter-cloudflare-workers](https://next.svelte.dev/docs/kit/adapter-cloudflare-workers) | no verificada (las dos son de svelte.dev) |
| SvelteKit · CPU de una ficha SSR | — | SIN MEDIR | — | SIN MEDIR |

### 1c · El panel y el monorepo

| Opción | Cifra o hecho | Fuente 1 | Fuente 2 | Estado |
|---|---|---|---|---|
| Vite + React 19 | Runtime mínimo ~42-45 KB gzip | [markaicode · Svelte 5 vs React 19](https://markaicode.com/vs/svelte-5-vs-react-19/) (42,2 KB) | [tech-insider · Svelte vs React 2026](https://tech-insider.org/svelte-vs-react-2026/) | no verificada: **contradicción** con [jisaku](https://jisaku.com/posts/svelte-vs-react-2026), que da ~4,5 KB para un contador en React (mide otra cosa) |
| Vite + Svelte 5 | App mínima 1,6-5 KB gzip | [markaicode](https://markaicode.com/vs/svelte-5-vs-react-19/) (1,6 KB) | [tech-insider](https://tech-insider.org/svelte-vs-react-2026/) (2-5 KB) | no verificada: las dos difieren y ninguna es medición primaria |
| pnpm workspaces solos | Es el punto de partida recomendado para pocos paquetes y builds cortos; su hueco es que no cachea tareas | [dev.to · elegir herramienta de monorepo 2026](https://dev.to/yobox/how-to-pick-a-monorepo-tool-in-2026-kko) | [codercops · Turborepo, Nx, pnpm 2026](https://blog.codercops.com/blog/monorepo-tooling-turborepo-nx-pnpm-2026) | verificada (es criterio de blogs, no medición) |
| Turborepo | Agrega caché y orquestación de tareas sobre los workspaces de pnpm (no los reemplaza); sumarlo después es un cambio pequeño | [codercops](https://blog.codercops.com/blog/monorepo-tooling-turborepo-nx-pnpm-2026) | [Nhost · pnpm + Turborepo](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo) | verificada (criterio) |
| Turborepo | Un build de ~30 s a 0,2 s desde caché | uno de los blogs del resultado (el extracto no dice cuál) | — | no verificada |

### Recomendación por defecto

**Pública: Astro con `@astrojs/cloudflare`**, porque es la única de las tres que por
defecto entrega HTML sin JavaScript y deja el mapa como isla `client:only`; y,
sobre todo, porque lo que mejor esquiva los 10 ms es **no ejecutar el Worker**:
un estático se sirve sin invocarlo y no gasta ni CPU ni de las 100.000
peticiones, así que conviene prerenderizar todo lo que se pueda (fichas
incluidas, si el ritmo de altas lo permite) y dejar el SSR para lo que no. Como
Cloudflare mismo dice que un SSR típico usa 10-20 ms, **antes de decidir hay que
medir la CPU de una ficha real con `wrangler tail`** en los tres, que hoy está
SIN MEDIR. **Panel: Vite + React por defecto**, por el ecosistema; Svelte gana en
peso, pero en un panel privado y con sesión ese peso pesa menos. La elección entre
las dos es de producto y la tiene que tomar Daniel. **Monorepo: pnpm workspaces
solos**, y Turborepo solo cuando el CI empiece a doler.

---

## 2 · Librería de gráficas para el panel

Dos hechos que valen para todas y conviene saber antes de leer la tabla:
**ninguna fuente vista dice que alguna de las cinco respete `prefers-reduced-motion`
por sí sola**. El media query no apaga nada: el código tiene que leerlo
(`matchMedia`) y pasar la animación apagada ([Josh Comeau](https://joshwcomeau.com/react/prefers-reduced-motion/), [W3C · técnica C39](https://w3.org/WAI/WCAG22/Techniques/css/C39)).
Y **ninguna trae la tabla de datos alternativa**, así que hay que construirla en
todos los casos. Los pesos gzip salen de mediciones de terceros con métodos
distintos, y algunas de las más pesadas se pueden podar por módulos ([ApexCharts · estado 2026](https://apexcharts.com/blog/state-of-javascript-charting-2026)).

| Opción | Cifra o hecho | Fuente 1 | Fuente 2 | Estado |
|---|---|---|---|---|
| Chart.js · peso | 44,7-58,2 KiB gzip | [TanStack · comparación](https://tanstack.com/charts/latest/docs/comparison) (página fría, base 2026-07-29) | [PkgPulse · chart.js vs recharts](https://www.pkgpulse.com/compare/chart.js-vs-recharts): 66,8 KB | no verificada: **contradicción** (44,7-58,2 frente a 66,8; ninguna dice qué importó) |
| Chart.js · accesibilidad | Dibuja en `<canvas>`: el lector de pantalla no ve nada y la doc deja la accesibilidad **al usuario** (ARIA en el canvas o contenido de reemplazo dentro de la etiqueta) | [Chart.js · Accessibility](https://www.chartjs.org/docs/latest/general/accessibility.html) | — | no verificada (una sola fuente) |
| Chart.js · animación | Anima por defecto; `options.animation = false` la apaga entera, y `update('none')` una sola actualización. `prefers-reduced-motion`: no lo menciona | [Chart.js · Animations](https://www.chartjs.org/docs/latest/configuration/animations.html) | — | no verificada |
| Chart.js · moneda | `locale` toma una etiqueta BCP 47 y usa `Intl.NumberFormat`; los ejes lineales aceptan `ticks.format` (`Intl.NumberFormatOptions`); el ejemplo de tooltip formatea con `Intl.NumberFormat(..., {style:'currency'})`. `es-CO` + `COP` es inferencia mía, por probar | [Chart.js · Locale](https://www.chartjs.org/docs/latest/configuration/locale.html) | [Chart.js · Tooltip](https://www.chartjs.org/docs/master/configuration/tooltip.html) | no verificada (mismo proyecto) |
| Chart.js · etiquetas directas | — | SIN MEDIR (no salió en ninguna búsqueda si va en el núcleo o por complemento) | — | SIN MEDIR |
| Chart.js · licencia | MIT | sin fuente vista en esta tanda | — | no verificada |
| Apache ECharts · peso | 153-173 KiB gzip | [TanStack · comparación](https://tanstack.com/charts/latest/docs/comparison) | — | no verificada; [ApexCharts](https://apexcharts.com/blog/state-of-javascript-charting-2026) advierte que es de las que se podan por módulos |
| Apache ECharts · accesibilidad | ARIA desde la 4.0: **genera una descripción del gráfico a partir de su configuración**; viene apagado (`aria.show: true`) y en la 5+ hay que importar `AriaComponent` a mano | [ECharts · Aria](https://echarts.apache.org/handbook/en/best-practices/aria/) | [ECharts · Features](https://echarts.apache.org/en/feature.html) | no verificada (las dos de Apache) |
| Apache ECharts · daltónicos | Texturas (`aria.decal.show`) como segunda señal además del color, desde la 5; tema por defecto rediseñado pensando en daltonismo y temas de alto contraste | [ECharts · Aria](https://echarts.apache.org/handbook/en/best-practices/aria/) | [ECharts 5 · novedades](https://echarts.apache.org/handbook/en/basics/release-note/v5-feature/) | no verificada (las dos de Apache) |
| Apache ECharts · reduced-motion, moneda, licencia | — | SIN MEDIR en esta tanda (Apache-2.0 sin fuente vista) | — | SIN MEDIR |
| uPlot · peso | ~50 KB minificado (README); 29.101 bytes gzip el IIFE y ~43 KB gzip el ESM tras un cambio de cadena de build | [uPlot · README](https://github.com/leeoniya/uPlot/blob/master/README.md) | [uPlot · PR #1152](https://github.com/leeoniya/uPlot/pull/1152) | no verificada (mismo proyecto, y el gzip del ESM está en discusión en un PR) |
| uPlot · alcance | Canvas 2D para series de tiempo, líneas, áreas, OHLC y barras; 166.650 puntos en 25 ms en frío | [uPlot · README](https://github.com/leeoniya/uPlot/blob/master/README.md) | — | no verificada. Accesibilidad incorporada: SIN MEDIR (es canvas, como Chart.js) |
| Observable Plot · peso | 83-92 KiB gzip | [TanStack · comparación](https://tanstack.com/charts/latest/docs/comparison) | — | no verificada |
| Observable Plot · licencia | ISC | [GitHub · observablehq/plot](https://github.com/observablehq/plot) | [Plot · Scales](https://observablehq.com/plot/features/scales) (pie de la doc) | no verificada (las dos de Observable) |
| Observable Plot · accesibilidad | SVG con `ariaLabel` y `ariaDescription` en la raíz, en los ejes y por marca, `ariaHidden` para lo decorativo (desde la 0.4.1) | [Plot · Scales](https://observablehq.com/plot/features/scales) | [GitHub · issue #361](https://github.com/observablehq/plot/issues/361) | no verificada (mismo proyecto) |
| Observable Plot · defecto conocido | Pone `aria-label` en `<g>` sin rol: axe lo marca como violación y el lector puede ignorarlo; seguía en la 0.6.17. Salida propuesta: un `role="img"` con resumen arriba y `ariaLabel: null` en las marcas | [findable-ui · issue #1067](https://github.com/DataBiosphere/findable-ui/issues/1067) | [Foro Observable · ¿cumple WCAG?](https://talk.observablehq.com/t/is-observable-plot-wcag-compliant/8103) | verificada (dos organizaciones; la segunda por el título del hilo, no se leyó entero) |
| Observable Plot · animación | — | SIN MEDIR (no salió que anime) | — | SIN MEDIR |
| Recharts · peso | 153-168 KiB gzip con React; 94,9-109,9 KiB con React fuera | [TanStack · comparación](https://tanstack.com/charts/latest/docs/comparison) | [PkgPulse](https://www.pkgpulse.com/compare/chart.js-vs-recharts): 141,7 KB | no verificada: **contradicción** (ninguna dice qué incluye) |
| Recharts · accesibilidad | Desde la 3.0 `accessibilityLayer` viene **encendido** en todos los gráficos cartesianos y polares: Tab entra al gráfico y las flechas recorren los puntos | [Recharts 3.0.0 · notas](https://newreleases.io/project/npm/recharts/release/3.0.0) | [Mantine Charts](https://mantine.dev/llms/charts-getting-started.md) (envoltorio de Recharts, también encendido por defecto) | no verificada: la segunda habla del envoltorio, no de Recharts. Qué `aria-*` pone: SIN MEDIR |
| Recharts · reduced-motion | — | SIN MEDIR (ninguna fuente dice que lea el media query; habría que pasar `isAnimationActive` a mano, y eso es inferencia) | — | SIN MEDIR |
| LayerChart (si el panel es Svelte) | Para Svelte 5 se instala con `@next`; el 1.x estable es solo Svelte 4; modos de tooltip band, bisect-x, quadtree | [skills.cat · layerchart-svelte5](https://skills.cat/skills/spences10/svelte-skills-kit/layerchart-svelte5) | — | no verificada (secundaria). Licencia y accesibilidad: SIN MEDIR |
| LayerCake (base de LayerChart) | MIT, Svelte 3 a 5, bajo nivel: el tooltip se construye a mano | [npm · layercake](https://npmjs.com/package/layercake) | [GitHub · layercake](https://github.com/ekzhang/layercake) | no verificada: el repositorio del resultado puede no ser el oficial |

### Recomendación por defecto

**Chart.js**, con dos piezas propias en el paquete compartido: la tabla de datos
alternativa (que ninguna trae) más el `aria-label` del canvas, y el apagado de la
animación leyendo `prefers-reduced-motion` (que ninguna hace sola). Es la más
liviana de las que traen tooltips, animación y formato `Intl` de serie, no
depende del framework del panel y la paleta apta para daltónicos se le pasa
nosotros. **Si Daniel prefiere que la accesibilidad venga hecha**, la alternativa
es ECharts, que es la única que **describe sola el gráfico** y trae texturas para
daltónicos, a cambio de unas tres veces el peso.

---

## 3 · Cuotas de Google Apps Script (web app `doGet`/`doPost` en `/exec`)

Una advertencia que pone el propio Google y se deja escrita: las cifras pueden
cambiar sin aviso ([Quotas](https://developers.google.com/apps-script/guides/services/quotas)).
Y otra del repositorio: **desde este contenedor el proxy rechaza `script.google.com`**,
así que nada de esto se pudo probar contra la web app real.

| Opción | Cifra o hecho | Fuente 1 | Fuente 2 | Estado |
|---|---|---|---|---|
| Personal y Workspace | Tiempo de ejecución: 6 min por ejecución | [Quotas · Apps Script](https://developers.google.com/apps-script/guides/services/quotas) | [ModelMonkey · cuotas oficiales 2026](https://modelmonkey.io/blog/apps-script-quotas-official) | verificada para la personal |
| Workspace | Tiempo de ejecución en Workspace | [Best practices · Apps Script](https://developers.google.com/apps-script/guides/support/best-practices): «6 min, o 30 min en algunas cuentas de Workspace» | [ModelMonkey](https://modelmonkey.io/blog/apps-script-quotas-official): los 30 min de Workspace «ya no aplican» | no verificada: **contradicción**, y la página de cuotas del mismo Google dice 6 min para las dos |
| Personal y Workspace | Ejecuciones simultáneas: 30 por usuario (sumando todos sus scripts) | [Quotas · Apps Script](https://developers.google.com/apps-script/guides/services/quotas) | [ModelMonkey](https://modelmonkey.io/blog/apps-script-quotas-official) | verificada |
| Personal y Workspace | Ejecuciones simultáneas: 1.000 por script | [Quotas · Apps Script](https://developers.google.com/apps-script/guides/services/quotas) | [ModelMonkey](https://modelmonkey.io/blog/apps-script-quotas-official) | verificada |
| Personal | UrlFetch: 20.000 llamadas al día | [Quotas · Apps Script](https://developers.google.com/apps-script/guides/services/quotas) | [AppScriptExpert · referencia 2026](https://appscriptexpert.com/blog/google-apps-script-quotas-and-limits) | verificada |
| Workspace | UrlFetch: 100.000 llamadas al día | [Quotas · Apps Script](https://developers.google.com/apps-script/guides/services/quotas) | [AppScriptExpert](https://appscriptexpert.com/blog/google-apps-script-quotas-and-limits) | verificada (una tercera fuente del mismo resultado decía ~20.000 para Workspace y parece error) |
| Las dos | Cuándo se reinicia la cuota diaria | [Quotas · Apps Script](https://developers.google.com/apps-script/guides/services/quotas): 24 h después de la primera petición | un blog del resultado: a medianoche hora del Pacífico | no verificada: **contradicción** |
| Las dos | UrlFetch: respuesta de hasta 50 MB por llamada, 100 cabeceras, URL de hasta 2 KB | [Quotas · Apps Script](https://developers.google.com/apps-script/guides/services/quotas) | — | no verificada. **Ojo**: es lo que el script puede DESCARGAR, no lo que la web app puede DEVOLVER |
| Las dos | Tamaño máximo de la respuesta de la web app (`ContentService`) | — | — | **SIN MEDIR**: ninguna fuente vista publica un tope |
| Las dos | `ContentService` no contesta directo: redirige a una URL de un solo uso en `script.googleusercontent.com`, así que el cliente tiene que seguir redirecciones (`curl -L`) | [Content Service · Apps Script](https://developers.google.com/apps-script/guides/content?hl=en) | — | no verificada (una sola fuente) |
| Las dos | Límite de llamadas ENTRANTES a una web app por día | — | — | **SIN MEDIR**: no hay cuota publicada de entrantes; el único techo que aplica es el de 30 simultáneas, y que una web app «ejecutar como yo» las cuente todas contra el dueño es inferencia, sin fuente |
| Personal / Workspace | Tiempo total de activadores: 90 min al día / 6 h al día (cuenta si la exportación a JSON se programa con un activador) | [ModelMonkey · cuotas 2026](https://modelmonkey.io/blog/google-apps-script-quotas-limits-2026) | — | no verificada |

Para leer desde afuera, conviene saber qué NO gasta UrlFetch: leer la web app
desde fuera **no** consume la cuota de UrlFetch del script; esa cuota solo se
gasta si el propio script sale a la red. Lo que sí aprieta es la simultaneidad y
los 6 minutos por llamada.

### Recomendación por defecto

No leer la web app en vivo desde la plataforma: **exportar la capa una vez a un
JSON** con una sola corrida que lea la hoja en bloque, quede bajo los 6 minutos y
siga las redirecciones, y servir ese archivo como estático o desde R2. Así las 30
ejecuciones simultáneas y el tope de respuesta que nadie publica dejan de
importar. Como Sheets está congelado para datos nuevos, lo que se exporta es lo
viejo y va a Postgres; la cuenta personal alcanza para eso y Workspace no cambia
los 6 minutos.

---

## 4 · Fuentes y estado

Cada fila de las tablas lleva sus dos fuentes y su estado; las URL son todas de
resultados vistos en esta tanda, salvo la documentación de Static Assets, que se
leyó de una copia local y por eso va sin enlace.

| Hueco | Verificadas | No verificadas | SIN MEDIR |
|---|---|---|---|
| 1 · Framework y monorepo | 8 | 13 | 2 |
| 2 · Gráficas | 1 | 17 | 4 |
| 3 · Apps Script | 5 | 5 | 2 |
| **Total** | **14** | **35** | **8** |

Las contradicciones que conviene tener a la vista:

* **Tamaño del Worker**: 64 MiB sin comprimir desde el 2026-09-04 (changelog de
  Cloudflare + Classmethod) frente a los 3 MiB que la doc de OpenNext sigue
  imprimiendo y el 1 MB de un blog de mayo. Gana el changelog, porque es más
  nuevo y tiene una prueba de despliegue.
* **Pesos de Chart.js y Recharts**: TanStack y PkgPulse no coinciden y ninguna
  dice qué importó. Hay que medir el build propio.
* **React vs Svelte**: las cifras de los blogs no coinciden entre sí.
* **Apps Script en Workspace**: Google dice 6 min en la página de cuotas y «30 min
  en algunas cuentas» en la de buenas prácticas.
* **Reinicio de la cuota diaria**: 24 h después de la primera petición (Google)
  frente a medianoche del Pacífico (un blog).
* **OpenNext**: el npm y los releases dicen 1.20.x con Next 16; una copia de su
  portada todavía dice «pre 1.0».

Y las decisiones que no son de esta sesión: el framework del panel (React o
Svelte) y si se acepta el peso de ECharts a cambio de que la accesibilidad venga
incorporada. Las dos son de Daniel.
