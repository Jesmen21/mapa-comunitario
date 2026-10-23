# Fase 0 · Propuesta del módulo de viviendas · BORRADOR para aprobación

Sesión del módulo Viviendas · rama `claude/fervent-allen-74qgwm` · 23 de
octubre de 2026. **Sin código.** Lo que está medido lleva su medición; lo que
no se pudo verificar desde este contenedor lo dice. Las cifras de proveedores
externos salen de la investigación con verificación adversarial (anexo B);
donde todavía dice `[INVESTIGACIÓN]` es porque esa corrida no ha terminado.

**Estado de la investigación al escribir esto:** Supabase, R2/Cloudflare,
mapas, 360° y correo/avisos tienen investigación hecha con fuentes primarias
(cada cifra con su URL en el anexo B) y **la verificación adversarial está
corriendo**: lo que un escéptico corrija se corrige acá. Stack/hosting,
cuentas, gráficas/pruebas y las cuotas de Apps Script siguen en
investigación. Donde una cifra es un SUPUESTO de cálculo propio lo dice.

Las maquetas están en el lienzo
**https://claude.ai/artifact/54iJvXtrCgqhniP9U9S2WE** (Home en las tres
paletas, mapa, ficha, y el panel: resumen, finanzas, usuarios, línea de
tiempo, más la lámina de paletas con su contraste medido).

---

## 0 · Antes de la propuesta: cuatro choques con lo que ya existe

El prompt v3 dice «si algo choca con lo que ya existe, pregúntame; no adivines».
Choca en cuatro cosas con lo que la cabeza dejó escrito hoy en
`herramientas/DECISIONES-DANIEL.md` y en el registro `js/03h`. Cada una con
su recomendación por defecto; **la propuesta de abajo está escrita bajo la
recomendación, y si eliges otra cosa cambian las secciones que se indican.**

| # | Choque | Qué dice el repositorio | Qué dice el prompt v3 | Recomendación por defecto |
|---|---|---|---|---|
| C1 | **Almacén** | Decisión 9: la hoja de la Vitrina, transitorio, con exención única en el trinquete «Sheets no se extiende» | Proyecto Supabase propio `urbis-viviendas`, **ya creado y con esquema aplicado** | **Manda el prompt v3.** Es además la regla general de la decisión 2. La cabeza cambia `viviendas.backend` a `postgres` y retira la exención. Mi primer peldaño (`83-viviendas.js`, escrito para la hoja) **se retira**; sus cuatro reglas se trasladan al paquete compartido (§4.3). |
| C2 | **Repositorio** | Todo en `mapa-comunitario` bajo el protocolo de la cabeza | Repositorio **nuevo y privado** con dos aplicaciones | **Repo nuevo `urbis-viviendas`.** En `mapa-comunitario` queda solo lo compartido: la entrada del registro `js/03h` y el contrato de intercambio. Lo crea Daniel o me da acceso (el alcance de GitHub de esta sesión es solo `mapa-comunitario`). |
| C3 | **Análisis de ubicación** | Decisión 3: Viviendas **lee** `empresas.analisisUbicacion` por el registro, sin copiar el cálculo | §4: tabla `puntos_interes` + fórmula de puntaje **en Postgres**, por radio | **Son dos cosas y conviven.** El análisis de Empresas es el análisis de SECTOR (Overpass, sesenta paneles, pliego); lo que el prompt pide es un **puntaje por radio sobre la capa de mapeos**, que tiene que correr en milisegundos por cada vivienda. El puntaje vive en Postgres; la ficha **enlaza** al análisis completo de Empresas como «ver el análisis de sector» (si no, es la clase C: un dato que ninguna pantalla alcanza). Fórmula declarada en tablas, no en código (§4.4). |
| C4 | **Modelo de datos** | El aprobado hoy: `estado` borrador/visible/pausada/cerrada, cifras `{v, origen}`, fortalezas con `base`/`sinBase` | El SQL aplicado: `estado` disponible/apartada/vendida + `publicada`, `precio_cop bigint` | **Se adopta el SQL como base** (ya está en la base de datos) y se le llevan las cuatro reglas sin cambiar su forma: NULL = SIN MEDIR y 0 = cero medido (Postgres ya los distingue); tabla `vivienda_fortalezas` con `CHECK (poi_id IS NOT NULL OR sin_base_razon IS NOT NULL)`; la procedencia es la fila de `analisis_ubicacion` con su versión de fórmula y su fecha; la precisión del punto es `ocultar_ubicacion_exacta` + la vista pública. |

Y una quinta cosa que no es choque sino **falta de acceso**: el conector de
Supabase de esta sesión ve únicamente `vayayvuelva` (el de movilidad, que el
prompt prohíbe tocar) y `urbis-viviendas` contesta «sin permiso». **El esquema
real no se inspeccionó**; esta propuesta se escribió contra el
`urbis_viviendas.sql` adjunto. Para la Fase 1 hace falta uno de dos:
reconectar el conector con la cuenta de la organización URBISPROCITY, o un
token personal de solo lectura (pendiente P14).

---

## 1 · Qué se construye, en diez líneas

Dos aplicaciones sobre una sola base de datos Supabase (`urbis-viviendas`):
la **plataforma pública** —explorar sin cuenta, mapa con marcadores de precio,
ficha con galería, texto de venta, análisis de ubicación por radio y recorrido
360°; cuenta solo al pedir visita, con correo + usuario + contraseña y código
de seis dígitos— y el **panel de control** —aplicación aparte, `noindex`,
contraseña + TOTP, roles `admin` y `gerencia`; viviendas, fotos y panorámicas a
R2, solicitudes, usuarios, línea de tiempo, finanzas manuales, calendario de
pagos, salud y cuotas al 70 %—. Los puntos de interés son un **espejo de solo
lectura** de la capa de mapeos de URBIS, importado por archivo con una clave
única, detrás de un adaptador. Nada personal viaja a URBIS. Primero venta;
arriendo con el mismo modelo.

## 2 · Stack y hosting

`[INVESTIGACIÓN · framework por aplicación y monorepo: en curso]`

Lo que la investigación de Cloudflare ya fijó del **hosting**: Cloudflare
manda los proyectos nuevos a **Workers con Static Assets** y no a Pages
(«Start new projects with Workers», portada de la doc de Pages); las
peticiones a archivos estáticos son **gratis e ilimitadas**; solo cuentan las
que ejecutan código: **100.000 al día** en Free con 10 ms de CPU por
invocación (el HTML con Open Graph por vivienda cabe ahí; si se pasa, Workers
Paid son **US$5/mes** con 10 millones incluidas). Pages Functions comparten
esa misma cuota. No se encontró prohibición de uso comercial en los planes
gratuitos de Workers/Pages/R2 (términos leídos por extracto, no en vivo: ver
anexo B). Turnstile es gratis y su propia página dice «most production
applications».

Lo que ya está decidido por restricción y no por gusto: la plataforma pública
**tiene que entregar título, foto y precio dentro del HTML** (WhatsApp y
Facebook no ejecutan JavaScript), así que no puede ser una SPA pura; el panel
sí puede serlo. Monorepo con `apps/publica`, `apps/panel` y
`packages/compartido` (tipos, cliente de Supabase, formato COP, adaptadores
de mapas, de puntos de interés y de cuentas).

## 3 · Estructura del repositorio (`urbis-viviendas`, privado)

```
urbis-viviendas/
  apps/publica/            la plataforma pública (SSR/prerender por vivienda)
  apps/panel/              el panel de control (SPA, noindex, TOTP)
  packages/compartido/     tipos, cliente Supabase, formato COP, adaptadores
  supabase/migrations/     migraciones versionadas (§4)
  supabase/functions/      Edge Functions: subida firmada a R2, aviso de solicitud,
                           usuario→correo, borrar cuenta, uso de cuotas
  herramientas/            importador de mapeos, respaldo programado
  docs/decisiones.md       cada decisión con fecha y razón
  docs/contrato-mapeos.md  el contrato de intercambio con la sesión URBIS
  CLAUDE.md                las reglas de este prompt (idioma, secretos, técnicas)
  .env.example             sin valores; .env.local ignorado por git
```

Commits pequeños en español, una rama por fase. El merge lo hace la sesión
general con la suite en verde y sin rojas nuevas (decisión 21).

## 4 · Base de datos: lo que hay, lo que falla, las migraciones

### 4.1 Lo que el SQL adjunto tiene (leído, no inspeccionado en vivo)

Cinco tablas con RLS (`viviendas`, `vivienda_fotos`, `puntos_interes`,
`analisis_ubicacion`, `interesados`), PostGIS 4326 en `geography(Point)`,
índices GiST, UUID, `timestamptz`, la función `calcular_analisis_ubicacion`
con `revoke execute` a `anon`/`authenticated`, un bucket público
`viviendas-fotos`, dos casas y cinco puntos de ejemplo.

### 4.2 Lo que falla hoy, medido sobre el archivo

1. **La ubicación exacta sale al público.** `grant select on viviendas to anon`
   + política `using (publicada)` entregan `ubicacion` con seis decimales a
   cualquiera. Seis decimales son once centímetros: es la puerta de la casa.
   La vista pública con desplazamiento (4.3) es lo primero de la Fase 1.
2. **`interesados` acepta inserciones de cualquiera** (`with check (true)` a
   `anon`): datos personales sin dueño y sin límite. Pasa a `user_id =
   auth.uid()` con límite de envíos.
3. **La fórmula no deja rastro de sí misma**: `analisis_ubicacion.detalle`
   guarda puntajes y no la fórmula ni los umbrales con que se calcularon.
4. **`categoria` es un `check` rígido de cuatro valores**; la capa de URBIS
   tiene más y cada una debe decir si cuenta o no.
5. **Las viviendas de ejemplo no están marcadas** (los puntos sí, con
   `fuente='ejemplo'`): no se pueden borrar con un solo comando.
6. **`actualizada_en` no se actualiza sola** (sin disparador).
7. **`estado`** (disponible/apartada/vendida) **y `publicada`** son dos campos
   para lo que el lector lee como uno: se conservan, y la vista pública
   deriva «se muestra» de los dos.

### 4.3 Migraciones propuestas (en este orden)

| # | Migración | Qué hace |
|---|---|---|
| 001 | `viviendas_campos` | `operacion` (`venta`/`arriendo`), `slug` único, `descripcion`, `por_que_comprar`, `administracion_cop`, `estrato`, `antiguedad_anios`, `destacada`, `direccion_aproximada`, `ocultar_ubicacion_exacta` (default `true`), `vistas`, `es_ejemplo`; disparador de `actualizada_en`; `precio_cop` significa canon mensual en arriendo |
| 002 | `roles` | `roles_usuario(user_id, rol, asignado_por, creada_en)`, funciones `es_admin()`, `es_gerencia()`, `es_anunciante()` sobre `auth.uid()`; **toda** escritura exige rol; el público solo inserta en `interesados` |
| 003 | `perfiles_favoritos` | `perfiles` (usuario único sin mayúsculas, `urbis_id` nulo, teléfono con código de país y validación, `es_mayor_de_edad`, `fecha_nacimiento` opcional, `acepto_datos_en`), `favoritos`; RLS: cada quien lo suyo; admin lee perfiles de quien pidió visita |
| 004 | `interesados_seguros` | `user_id` obligatorio = `auth.uid()`, `estado`, `atendida_en`, límite de envíos por usuario (función + política) |
| 005 | `vista_publica` | `viviendas_publicas`: cuando `ocultar_ubicacion_exacta`, el punto se desplaza con `ST_Project` en un ángulo y distancia **deterministas por id** (entre 80 y 150 m) para que no se pueda promediar entre recargas; expone solo columnas públicas; la app y el mapa leen de la vista, nunca de la tabla |
| 006 | `mapa_por_area` | funciones `viviendas_en_area(bbox, filtros)` y `pois_en_area(bbox, categorias, zoom)` que devuelven solo lo visible |
| 007 | `caracteristicas_panoramas` | `vivienda_caracteristicas`, `vivienda_panoramas` (clave y URL en R2, orden, ángulo inicial, `es_inicio`), `vivienda_panorama_enlaces` (desde, hacia, yaw, pitch, etiqueta) |
| 008 | `fotos_en_r2` | `vivienda_fotos`: `ruta` → `clave_r2`, `url_miniatura`, `url_mediana`, `url_grande`, ancho, alto, peso |
| 009 | `categorias_y_espejo` | `categorias_poi` (clave, nombre, icono, `cuenta_para_analisis`, peso), y en `puntos_interes`: `urbis_mapeo_id` único, `modulo_origen`, `subcategoria`, `descripcion`, `miniatura_url`, `geometria`, `activo`, `sincronizado_en`, `hash_contenido`, `pendiente_enviar_a_urbis`; quita el `check` rígido; `sincronizaciones_mapeos` |
| 010 | `formula_puntaje` | `formulas_puntaje` versionadas (pesos por categoría, decaimiento, tope); `analisis_ubicacion` guarda `formula_id` y la copia de los umbrales; se reescribe `calcular_analisis_ubicacion` para leerlos |
| 011 | `fortalezas` | `vivienda_fortalezas(texto, poi_id, distancia_m, sin_base_razon)` con `CHECK (poi_id IS NOT NULL OR sin_base_razon IS NOT NULL)`: una fortaleza dice de dónde sale, o no se publica |
| 012 | `panel` | `transacciones`, `pagos_programados`, `eventos` (sin IP ni datos personales), `interacciones`, `metricas_diarias`, `bitacora` (alimentada por disparadores, sin UPDATE ni DELETE desde la app); gerencia solo lectura |
| 013 | `anunciantes_base` | en `viviendas`: `propietario_id`, `estado_revision`, `motivo_rechazo`, `revisada_por`, `revisada_en` (solo la base; la versión se construye en la Fase 7) |
| 014 | `retiro_bucket` | elimina el bucket `viviendas-fotos` **tras comprobar que está vacío** |

Reglas técnicas que ya decidiste y que cada migración cumple: PostGIS con
SRID declarado, UUID, `timestamptz`, consultas parametrizadas, validación de
archivos, copia de umbrales por corrida, ningún secreto en el navegador ni en
el repositorio.

### 4.4 La fórmula del puntaje: propuesta, configurable

Hoy: 25 puntos por punto cercano, tope 100 por categoría, promedio simple.
Falla de dos maneras: cuatro tiendas pegadas valen lo mismo que una a 490 m y
un supermercado a 50 m vale lo mismo que uno a 490 m; y el promedio castiga
igual una categoría irrelevante que una importante.

Propuesta (todo en `formulas_puntaje`, nada en código):
`puntaje_cat = min(tope, Σ_i peso_cat × f(d_i))`, con decaimiento lineal
`f(d) = max(0, 1 − d / radio)` y un tope por categoría (por defecto 100, con
tres puntos a distancia media ya se llega); total = media **ponderada** por
`peso_cat` (educación 1,0 · transporte 1,0 · comercio 0,8 · zonas verdes 0,8;
salud y seguridad entran cuando haya datos, con peso 0 mientras no cuenten).
Cada corrida guarda `formula_id`, radio, fecha y el detalle por punto, así
que el texto «Colegio a 400 m» sale de la misma fila que el número (regla de
credibilidad). Se valida con el caso de v1 de la especificación de maquetas.

## 5 · Mapa

**Recomendación por defecto:** **MapLibre GL JS** (BSD-3) + mapa base
**Protomaps en PMTiles autoalojado en el mismo bucket R2** de las fotos,
servido directo con dominio propio y regla «Cache Everything» (sin Worker);
estilo propio derivado del tema claro de Protomaps con la paleta elegida;
clusters nativos de MapLibre; puntos de interés por área visible desde
PostGIS a partir del zoom 13; satélite como capa raster de **Esri World
Imagery** por ArcGIS Location Platform (2 millones de teselas/mes gratis,
uso comercial permitido con llave y «Powered by Esri»); geocodificación
**solo en el panel** (Photon público para ubicar una vivienda, resultado
guardado) y en el sitio público búsqueda contra la tabla propia de barrios.

**Por qué:** es la única pila comercialmente legal a **US$0 de teselas** en
los tres escenarios. Las trampas, medidas en fuente primaria: el plan Free de
**MapTiler es solo no comercial** y exige su logo; y con MapLibre puro
MapTiler **cobra por tesela** (≈40 por visita) y no por sesión, de modo que a
100.000 visitas son **US$555/mes** (US$217 con su SDK); **Stadia Free y la
API de Protomaps también son solo no comerciales**; **Mapbox** cobra desde la
carga 50.001 (US$5 por 1.000) y su licencia desde v2 no es BSD; **Google**
dejó el crédito de US$200 en marzo de 2025 por 10.000 cargas gratis por SKU y
después US$7 por 1.000 (≈US$630 a 100.000); el contenido de **Google Places
no se puede pintar sobre un mapa que no sea de Google** ni guardarse más de
30 días; el satélite «libre» de EOX Sentinel-2 es **CC BY-NC-SA** (no
comercial); Nominatim público prohíbe el autocompletar y limita a 1 petición
por segundo para toda la aplicación.

**Costo (supuesto propio: 1 visita ≈ 1 carga ≈ 40 teselas):** PMTiles en R2
→ **US$0 / US$0 / US$0** a 1.000 / 10.000 / 100.000 visitas (4 millones de
GET al mes a 100.000, dentro de los 10 millones gratis de R2). Alternativa
con proveedor comercial: OpenFreeMap (US$0, un solo mantenedor, sin SLA)
mientras se construye y **MapTiler Flex US$30/mes** con su SDK desde el
primer cliente.

**Dos mediciones que la Fase 1 hace primero** (desde acá no se pudieron):
el tamaño del extracto PMTiles de Colombia o de Norte de Santander
(`pmtiles extract … --dry-run`; si no cabe en los 10 GB gratis, se baja el
zoom máximo o se pasa a la alternativa) y que R2 con dominio propio sirva
peticiones de rango (HTTP 206) desde la caché (`curl -H 'Range: bytes=0-127'`
y leer `Cf-Cache-Status`). Si cualquiera falla, se usa la alternativa sin
rediseñar nada: el proveedor vive en un solo módulo.

Decidido por diseño: el mapa va detrás de `AdaptadorMapa` (crear, marcadores,
clusters, capas por área, volar a un punto, dibujar radio), de modo que
cambiar de proveedor sea un día y no una reescritura. Las ubicaciones
públicas son las de la **vista** (desplazadas); el punto exacto nunca llega al
navegador del público.

## 6 · Recorrido 360°

**Recomendación por defecto:** **Photo Sphere Viewer v5** (5.15.1, MIT,
último commit 22 de octubre de 2026) con los plugins virtual-tour, markers,
gyroscope, gallery y map; estéreo opcional; empaquetado con Vite/esbuild
(**≈190–200 kB gz con three incluido**; nunca por el importmap de CDN de su
guía, que carga 417 kB de three sin minificar). Es el único de los cuatro con
tour con flechas, galería, plano, giroscopio con el permiso de iOS y estéreo
ya escritos y mantenidos; hacerlo a mano con three.js no ahorra peso (un
three mínimo ya pesa 131 kB gz) y sí semanas. **Marzipano queda descartado**
(archivado el 20 de abril de 2026). **Pannellum** (MIT, 18 kB gz, WebGL 1)
es la alternativa si PSV falla en iPhone: funciona, pero está congelado
desde 2019 salvo seguridad y no trae galería ni minimapa.

**Resoluciones y peso (medidos):** por habitación una base 1024×512 (~0,05
MB) que se muestra primero y una completa **4096×2048** JPEG q80–85 (~0,6–0,8
MB; WebP ~0,5 MB); el máster 8192 se guarda en R2 y se sirve solo por
teselas en escritorio. Precarga limitada a la habitación vecina. Formato
WebP: todo iPhone que pueda abrir PSV lo decodifica.

**Riesgo principal, y su mitigación:** PSV v5 exige **WebGL 2 (iOS 15+)** y
sube la equirectangular entera a la GPU: una 8192×4096 son **134 MB** de
memoria (268 con precarga), y Safari mata la pestaña por memoria y la recarga
en bucle sin avisar al código. Por eso el tope en móvil es 4096 (33,6 MB).
**Prueba obligatoria en un iPhone real antes del plan Pro**, porque desde este
contenedor no se pudo: permiso de giroscopio, memoria con dos 4096 y el modo
estéreo.

**Costo:** licencia US$0; el peso cae en R2 (US$0 en los tres escenarios).
Lo que sí cuesta es la experiencia: 3–7 MB por visita de tour en datos
móviles.

## 7 · Imágenes en Cloudflare R2

**Cuotas vigentes (fuente primaria, developers.cloudflare.com/r2/pricing):**
gratis **10 GB-mes** de almacenamiento, **1 millón** de operaciones clase A
(subidas) y **10 millones** de clase B (lecturas) al mes, solo en clase
Standard; después US$0,015/GB-mes, US$4,50 y US$0,36 por millón. **El egreso
es gratis de verdad** al salir por R2, por un Worker o por el dominio propio;
lo que cuenta es la lectura que llega al bucket. Trampa: el uso se redondea
hacia arriba a la unidad de facturación. Activar R2 pide una «R2
subscription» por el flujo de pago (si exige tarjeta lo dicen terceros, no la
doc: sin verificar).

**Estimación (supuestos propios):** 50 viviendas × 12 fotos × 3 tamaños WebP
≈ 0,3 GB (+2,4 GB si se guardan los originales) + 50 panorámicas × 8 MB =
0,4 GB → **≈0,7–3,1 GB, dentro de los 10 GB**; lecturas a 100.000 visitas
≈2,6 millones de clase B → **US$0** en los tres escenarios.

**Lo que no se negocia:** (1) **nunca `r2.dev` en producción**: tiene límite
de tasa variable, responde 429 y no permite caché ni WAF; (2) **dominio
propio** (tiene que ser una zona en la misma cuenta de Cloudflare, o entrar
por CNAME parcial) **con una Cache Rule «Cache Everything»** y Smart Tiered
Cache, porque sin ella cada vista de cada foto es una operación contra el
bucket; (3) subidas con **URL prefirmada PUT** de 10–15 minutos, con el
`Content-Type` fijado en la firma y CORS del bucket restringido al origen del
panel, firmada en una Edge Function de Supabase con `npm:aws4fetch` (las
prefirmadas solo funcionan contra el endpoint S3, no contra el dominio
propio; las lecturas públicas van por el dominio); (4) **R2 no tiene
versionado ni Object Lock**: un `PutObject` sobre la misma clave destruye la
foto anterior → **bucket lock** indefinido sobre el prefijo de originales,
token de API acotado al bucket y de solo escritura para el subidor, y un
`rclone sync` semanal a otro destino.

**Pasos para la cuenta (P12):** crear la cuenta de Cloudflare → añadir el
dominio como zona (o CNAME parcial) → activar la suscripción de R2 → crear el
bucket privado → conectar `img.<dominio>` como dominio propio del bucket →
Cache Rule «Cache Everything» → token de API acotado al bucket → CORS del
bucket al origen del panel → bucket lock sobre `originales/`.

Decidido por diseño: el navegador genera en WebP miniatura, mediana y grande
antes de subir; una Edge Function verifica el rol y entrega una URL firmada de
corta duración; en la base solo van claves y URL; al borrar una vivienda o
foto se borran sus objetos.

## 8 · Espejo de mapeos y adaptador (sin duplicar la capa de URBIS)

**Lo medido en el repositorio** (anexo A): la capa vive en una hoja de Google
Sheets detrás del Apps Script «URBIS Auth Backend»; se lee con un POST a
`/exec` con `{action:'db_read'}` **sin token** y devuelve todas las filas; cada
fila es `{tipo, lat, lng, descripcion, fecha}` y `descripcion` lleva 23
casillas por posición más un espacio con nombre; las fotos van como
`data:image` base64 dentro de la celda; el registro de dueños es `js/03h`.

**Etapa 1 (espejo por archivo):** un script `importar-mapeos` lee el JSON del
contrato, hace `upsert` por `urbis_mapeo_id`, calcula `hash_contenido` y solo
toca filas cuyo hash cambió; registra la corrida en `sincronizaciones_mapeos`
(cuántos nuevos, cambiados, iguales, inactivados). Reimportar no duplica.
**Etapa 2 (conexión directa):** el mismo adaptador con `ApiUrbis`, cuando la
sesión URBIS confirme cuotas y autenticación (P2).

**Adaptador `FuentePuntosInteres`:** `listarEnArea(limites, categorias,
zoom)`, `listarCercanos(punto, radio, categorias)`, `obtener(id)`,
`proponerNuevo(punto)`. `proponerNuevo` busca coincidencias a menos de 25 m
(`ST_DWithin`) con nombre parecido (`pg_trgm`, `similarity > 0,4`) y las
devuelve para que Daniel decida; lo nuevo queda `pendiente_enviar_a_urbis`.

**Lo que NO viaja a URBIS:** usuarios, solicitudes, teléfonos, correos,
viviendas privadas. Solo puntos de interés.

**Contrato de intercambio** (va a `docs/contrato-mapeos.md`): el JSON del
prompt §7.3 tal cual. Dos ajustes medidos: (a) el `urbis_mapeo_id` hoy **no
existe en la hoja** —las filas no tienen id; se identifican por `lat` o por
el sobre de `descripcion`—, así que la sesión URBIS tiene que acordar cómo se
deriva uno estable (propuesta: hash de `tipo + fecha + lat + lng` hasta que la
hoja tenga columna de id); (b) la miniatura es base64 dentro de la celda, de
modo que el contrato la recibe como `miniatura_url` **solo si la sesión URBIS
la sube a un sitio con URL**; mientras tanto el espejo la deja vacía y lo
dice.

## 9 · Cuentas

**Flujo** (como lo pediste): explorar libre; cuenta solo al pedir visita;
crear cuenta pide correo + usuario + contraseña; código de seis dígitos al
correo; al confirmar, sigue la acción que había empezado. Supabase Auth con
correo y contraseña; el código de seis dígitos se envía con la plantilla
`{{ .Token }}` y se verifica con `verifyOtp(type: 'email')`, expiración
configurable hasta 86.400 s (fuente primaria: docs de Supabase). Entrar con
usuario resuelve usuario→correo en una función `SECURITY DEFINER` que
responde igual exista o no. TOTP para admin y gerencia con políticas RLS
`as restrictive` que exigen `aal2` en las tablas del panel (fuente primaria).
Límites por defecto medidos en la documentación: 360 OTP/hora, 360
verificaciones/hora por IP, 15 intentos de MFA por minuto; con SMTP propio
**30 correos/hora** hasta que se suba el límite. Captcha: Turnstile tiene
integración nativa en Auth. **Protección contra contraseñas filtradas: solo
en Pro** (fuente primaria) — una razón más para pasar a Pro antes de clientes.

**Unificar la cuenta entre módulos** (P4, decisión tuya con la sesión URBIS):

| Opción | Qué es | Costo | Riesgo |
|---|---|---|---|
| (a) **Cuentas separadas ligadas por `urbis_id`** — *recomendada para empezar* | cada módulo con su cuenta; `perfiles.urbis_id` nulo hasta que URBIS lo entregue | cero | hoy **no existe un ID URBIS aparte**: el identificador es el nombre de usuario (`js/02:131`); hay que acordar uno |
| (b) Third-Party Auth | Supabase verifica JWT **asimétricos** de Clerk, Firebase, Auth0, Cognito o WorkOS (fuente primaria); un JWT genérico emitido por Apps Script **no está en la lista** | US$0,00325 por usuario activo de terceros sobre cuota | obliga a cambiar la autenticación de todo URBIS; no sirve con el Apps Script de hoy |
| (c) Migrar cuentas | traer usuarios y pedirles restablecer contraseña (nunca copiar contraseñas) | trabajo + fricción | no aplica mientras el resto de URBIS siga en Apps Script |

## 10 · Correo, avisos, respaldos, monitoreo

- **Correo transaccional — el SMTP propio es obligatorio desde el día uno, y
  no por gusto:** el correo integrado de Supabase entrega **solo a miembros
  del equipo** y **2 correos por hora**, en Free y en Pro por igual; y
  **desde el 3 de junio de 2026 los proyectos gratis nuevos no pueden editar
  las plantillas de Auth** con el correo integrado — el código de 6 dígitos
  exige `{{ .Token }}` en la plantilla. **Recomendación: Resend Free** (3.000
  correos/mes con **tope de 100 al día**, 3 dominios, SMTP + API, 30 días de
  registro, sin tarjeta, con guía propia para Supabase) con dominio propio en
  Cloudflare y SPF + DKIM + DMARC `p=none` (exigidos por Gmail y Outlook).
  Descartados con fuente: Brevo Free sella «Sent with Brevo» en cada código;
  Postmark Free son 100 **al mes**; SendGrid retiró su gratis en mayo de
  2025; Amazon SES ya no tiene capa gratis para cuentas nuevas desde el 21 de
  julio de 2026; Mailgun Free guarda registros un solo día. Costo: **US$0** a
  1.000 y 10.000 visitas (≈4 y 40 correos/día, supuesto propio); a 100.000,
  Resend Pro US$20. Regla escrita de antemano: dos días seguidos por encima de
  70 correos (el 70 % del tope diario) → se pasa a Pro.
- **Aviso de solicitud (no negociable):** **correo a Daniel + notificación
  push del navegador al panel** (Web Push con claves VAPID propias desde una
  Edge Function, gratis; en iPhone solo desde iOS 16.4 y con el panel
  instalado en la pantalla de inicio), más el contador de nuevas. El disparo:
  Database Webhook (`pg_net`) sobre el INSERT → Edge Function `avisar-
  solicitud` → fila en una tabla `avisos` con estado; como `pg_net` **no
  reintenta**, un `pg_cron` cada 5 minutos reenvía los avisos sin confirmar
  (o el patrón `pgmq` + `pg_cron` que Supabase documenta). Las Edge Functions
  tienen bloqueados los puertos 25 y 587: el correo sale por la API HTTP del
  proveedor, no por SMTP.
- **WhatsApp a Daniel: segunda fase, y ya no es gratis.** Desde el **1 de
  octubre de 2026** cada número de negocio tiene 1.000 mensajes de servicio
  gratis al mes y las plantillas `utility` dentro de la ventana de 24 h
  vuelven a cobrarse; la tarifa exacta de Colombia **no se pudo verificar**
  (fuentes secundarias: US$0,0008–0,0034 por mensaje; Twilio añade US$0,005).
  Si se hace: **Meta Cloud API directo**, plantilla `utility` aprobada,
  método de pago; **nunca una API no oficial** (los términos de WhatsApp las
  sancionan con bloqueo, y el número de ventas es justo el que no se puede
  perder).
- **Respaldos:** el plan gratis **no tiene respaldos automáticos**; Pro,
  diarios con 7 días; PITR es un añadido de US$100/mes por 7 días (fuente
  primaria). Mientras estemos en gratis: una acción programada semanal que
  haga `supabase db dump` y lo guarde en R2 (bucket privado), más la lista de
  objetos de R2.
- **Pausa por inactividad:** el plan gratis se pausa tras 7 días de poca
  actividad y da 90 días para restaurar (fuente primaria). Antes de una demo:
  pasar a Pro o, como mínimo, una consulta diaria programada.
- **Qué cuesta Pro de verdad:** **US$25/mes por ORGANIZACIÓN** + cómputo por
  proyecto, con un crédito de US$10 que cubre exactamente **un** proyecto
  Micro; una organización tiene un solo plan, así que si `urbis-viviendas`
  compartiera organización con otro proyecto la factura sería ≥US$35.
  Verificado el 23 de octubre: el conector ve `vayayvuelva` en **otra**
  organización, así que no comparten. Spend Cap activado por defecto (bloquea
  en vez de cobrar; no cubre cómputo ni PITR). Al subir a Pro el proyecto
  **no se redimensiona solo** de Nano a Micro: es manual y con una pausa
  corta. Desde mayo de 2026 Supabase cobra impuestos indirectos «donde la ley
  lo exija» (si aplica a Colombia: ~US$29,75 con IVA; se ve en la factura
  próxima). **Cuándo subir: al menos 7 días antes de la primera demo** (una
  ventana completa de pausa + el cambio de cómputo + ver el primer respaldo
  diario + probar el SMTP con su límite de 30/hora).
- **Monitoreo al 70 %:** función `SECURITY DEFINER` que lee
  `pg_database_size` (solo admin y gerencia) + Edge Function con token de
  solo lectura de Cloudflare para R2; tarjeta en Salud con barra y
  porcentaje; alerta en pantalla y por correo al 70 % y crítica al 90 %.
  Límite del gratis: 500 MB de base → solo lectura; 10 GB de ancho de banda.

## 11 · Sistema visual

- **Tokens medidos** (contraste WCAG calculado con node, no declarado): la
  lámina «Paletas» del lienzo. Hallazgo: el rango coral que pediste
  (`#F0506E`–`#E8445F`) da **3,5–3,9:1** con texto blanco y no alcanza AA; A
  usa `#D1364F` (4,8:1). B usa el **azul de marca** que ya está en los
  manifiestos de URBIS, `#075E88` (7,1:1), y deja el celeste `#34CCFE` solo
  como realce (1,9:1, nunca texto). C usa `#0F766E` (5,5:1). Los bordes
  decorativos (`#DDDDDD`, 1,4:1) no sirven para campos de formulario: hay un
  token aparte `--color-borde-campo` ≥3:1. Escala del puntaje propia, sobria,
  cinco peldaños, todos AA con blanco. Modo oscuro preparado con las mismas
  variables.
- **Sombras:** cinco niveles, dos capas (contacto + difusa), tinte azulado
  `rgba(20,30,50,…)`, nunca negro puro. Tarjetas `sm`; barra, filtros y
  flotantes `md`; marcador seleccionado `lg`; hojas y modales `xl`.
- **Animación:** solo `transform` y `opacity`; variables `--dur-rapida` 120 ms,
  `--dur-media` 220 ms, `--dur-lenta` 400 ms, curva `cubic-bezier(.2,.8,.2,1)`;
  `prefers-reduced-motion` reduce o quita; catálogo del prompt §2.2c
  implementado con CSS y la Web Animations API; librería solo si una
  transición concreta lo exige, y con su peso justificado.
- **Capas (`z-index`) por variables:** contenido 0 · mapa 50 · barra fija 100
  · tarjeta de precio 200 · hoja inferior 300 · modal 400 · aviso 500.
- **Gráficas:** `[INVESTIGACIÓN · librería]`; paleta categórica Okabe-Ito,
  etiquetas directas, texto además de color, tabla alternativa.

## 12 · Pruebas (la suite en verde o no se publica)

| Qué | Con qué | Cuándo corre |
|---|---|---|
| Fórmula del puntaje | pruebas unitarias con el caso v1 y casos de borde (cero puntos, punto en el límite del radio) | cada commit |
| RLS por rol | `supabase test db` (pgTAP) + cliente JS con llave anon y una sesión por rol: qué lee y escribe cada uno, ubicación oculta, perfiles, transacciones, aal2 | cada commit |
| Importador de mapeos | reimportar igual no duplica; un cambio actualiza; un nuevo queda pendiente y avisa coincidencias | cada commit |
| Extremo a extremo | Playwright: explorar → Agendar visita → cuenta → código (buzón local de Supabase) → solicitud; entrar con usuario y con correo; recuperar; en 390 y 1280 | cada rama |
| Visual | Playwright en 360/390/768/1024/1280/1920, ambas apps: sin desbordamiento horizontal, sin consola con errores, capturas | cada rama |
| Accesibilidad y rendimiento | axe-core (AA) y Lighthouse móvil en home, mapa, ficha y panel | cada rama |
| Casos de acceso | sesión vencida, código incorrecto, usuario ocupado, vivienda despublicada, recarga en cualquier ruta | cada rama |
| Giroscopio | prueba manual en Android y, si se puede, iPhone, documentada con fecha | antes de cerrar la Fase 4 |

## 13 · Decisiones pendientes (no adivinadas), con recomendación

| # | Pendiente | Quién | Recomendación por defecto |
|---|---|---|---|
| C1–C4 | los cuatro choques de la sección 0 | Daniel (+ cabeza para el registro) | las de la tabla |
| P1 | Dónde vive la capa y cómo la lee cada módulo | sesión URBIS | **Contestado desde el repositorio** (anexo A); falta solo cuántos puntos hay |
| P2 | `callAuthAPI` desde afuera y cuotas | sesión URBIS | se puede (es un POST HTTPS); cuotas `[INVESTIGACIÓN]`; etapa 1 por archivo |
| P3 | Formato del ID de usuario | sesión URBIS | **no existe uno aparte del nombre de usuario**; `urbis_id` nulo y `generarIdUrbis()` reemplazable |
| P4 | Unificar cuentas | URBIS + Daniel | opción (a) |
| P5 | Quién entra al panel además de Daniel | Daniel | solo `admin`; `gerencia` construido y sin asignar |
| P6 | Mayoría de edad: casilla o fecha | Daniel | casilla; columna lista y vacía |
| P7 | Conservación de `interacciones` | Daniel | 12 meses y consolidar |
| P8 | A quién se cobra la cuota mensual | Daniel | calendario genérico |
| P9 | Anunciantes: pago, identidad, legal | Daniel | no construir hasta decidir |
| P10 | Dominios, nombre, logo, WhatsApp, correo | Daniel | un archivo de configuración con marcadores |
| P11 | Cuándo pasar a Pro | Daniel | **al menos 7 días antes de la primera demo**; US$25/mes en organización propia |
| P12 | Cuenta de Cloudflare R2 y dominio | Daniel | crearla ya, con los nueve pasos de §7; el dominio tiene que ser zona de esa cuenta |
| P13 | Paleta A, B o C | Daniel | **ver el lienzo**; mi recomendación: `[se escribe al cerrar las maquetas]` |
| P14 | Acceso al proyecto `urbis-viviendas` para inspeccionar el esquema real | Daniel | token personal de solo lectura o reconectar el conector con URBISPROCITY |
| P15 | Crear el repositorio `urbis-viviendas` | Daniel | privado; esta sesión solo alcanza `mapa-comunitario` |

---

## Anexo A · Lo que el repositorio contesta de los cinco pendientes de «sesión URBIS»

Medido el 23 de octubre de 2026 sobre `mapa-comunitario` (rama de la cabeza
fusionada):

1. **Dónde vive la capa.** Una hoja de Google Sheets detrás del Apps Script
   «URBIS Auth Backend» (V163 según `herramientas/regla-vitrina-servidor.md`;
   endpoint `APPS_SCRIPT_ENDPOINT` en `js/00-config.js`). Puerta única en
   `js/12-spa-ui.js`: `urbisGuardarFila`, `urbisDBRead`, `urbisDBUpdate`,
   `urbisDBDelete` → `URBIS_AUTH.socialAPI({action, session_token, …})`.
   `db_read` es **abierto** (sin token; decisión 22b pendiente de Daniel).
   Cada fila: `{tipo, lat, lng, descripcion, fecha}`; `descripcion` lleva 23
   casillas por posición (`URBIS_SLOTS`, congelada) y la última es
   `espacioConNombre` (`modulo:campo=valor`). Los dueños de cada `tipo` están
   en `js/03h-registro-modulos.js`. **Cuántos puntos hay: SIN MEDIR** desde
   este contenedor (el proxy niega `script.google.com`); se mide abriendo
   `herramientas/medir-duplicados.html` en un navegador.
2. **Cómo lee cada módulo.** Todos hacen `urbisDBRead()` entero y filtran por
   `tipo`. No hay lectura incremental: para el espejo hace falta `hash` o
   `actualizado_en`.
3. **`callAuthAPI` desde afuera.** Sí: es un POST HTTPS al `/exec`, con JSON y
   `session_token` para escribir; el navegador ya lo hace así. Cuotas de Apps
   Script: `[INVESTIGACIÓN]`.
4. **Fotos de los mapeos.** Viajan como `data:image` base64 **dentro de la
   celda** (reportes en `js/11`; la vitrina guarda una fila por foto porque
   una sola casi llena una celda). No están en Drive. Se pueden mostrar como
   miniatura sin abrir nada, pero su peso obliga a subirlas a un sitio con URL
   antes de ponerlas en el contrato.
5. **ID de usuario.** **No existe un ID aparte**: el identificador es el
   nombre de usuario, `/^[a-z0-9._-]{5,30}$/` (`js/02-auth-roles.js:131`);
   `urbisIdentidadActual()` devuelve `{rol, correo, cedula, nombre, usuario}`.
   El registro actual pide **12 campos** (nombre, apellido, usuario, cédula,
   teléfono, correo, género, país, departamento, ciudad, barrio), lo que
   confirma que «pide demasiado».

## Anexo B · Fuentes primarias ya verificadas

- Supabase · límites del plan gratis, pausa, restauración, tamaño de base:
  `supabase.com/docs/guides/platform/database-size`,
  `…/platform/free-project-pausing`, `…/storage/serving/bandwidth`.
- Supabase · respaldos y PITR: `…/platform/backups`.
- Supabase · contraseñas filtradas solo Pro: `…/auth/password-security`.
- Supabase · OTP por correo con `{{ .Token }}`: `…/auth/auth-email-passwordless`.
- Supabase · MFA y `aal2` en RLS: `…/auth/auth-mfa`; Phone MFA de pago:
  `…/platform/manage-your-usage/advanced-mfa-phone`.
- Supabase · límites de tasa y SMTP: `…/deployment/going-into-prod`,
  `…/auth/auth-smtp`.
- Supabase · captcha nativo (hCaptcha, Turnstile): `…/auth/auth-captcha`.
- Supabase · Third-Party Auth (Clerk, Firebase, Auth0, Cognito, WorkOS; JWT
  asimétricos; US$0,00325/MAU): `…/auth/third-party/overview`.
- Supabase · Image Transformations (Pro, 100 imágenes origen, US$5/1.000):
  `…/platform/manage-your-usage/storage-image-transformations`.
- Supabase · facturación por organización, cómputo y crédito, Spend Cap:
  `…/platform/billing-on-supabase`, `…/platform/manage-your-usage/compute`,
  `…/platform/cost-control`; SMTP integrado (2/h, solo equipo):
  `…/auth/auth-smtp`; plantillas no editables en Free desde 2026-06-03:
  `supabase.com/changelog/46599-…`; límites de Edge Functions (puertos 25 y
  587 bloqueados): `…/functions/limits`; webhooks y `pg_net` sin reintentos:
  `…/database/webhooks`, `…/database/extensions/pg_net`.
- Cloudflare · precios y cuotas de R2: `developers.cloudflare.com/r2/pricing/`;
  límites de `r2.dev` y dominio propio: `…/r2/buckets/public-buckets/`,
  `…/r2/platform/limits/`; prefirmadas: `…/r2/api/s3/presigned-urls/`; sin
  versionado: `…/r2/api/s3/api/`; bucket locks: `…/r2/buckets/bucket-locks/`;
  caché sobre R2: `…/cache/interaction-cloudflare-products/r2/`; Workers:
  `…/workers/platform/limits/`, `…/workers/platform/pricing/`; Pages:
  `…/pages/platform/limits/`, `…/pages/functions/pricing/`; Turnstile:
  `…/turnstile/plans/`.
- Mapas · MapTiler: `maptiler.com/cloud/pricing/`, `maptiler.com/terms/cloud/`,
  `docs.maptiler.com/guides/account/sessions-vs-requests/`; OpenFreeMap:
  `github.com/hyperknot/openfreemap`; Protomaps: `github.com/protomaps/docs`,
  `protomaps.com/api`; Stadia: `stadiamaps.com/pricing/`; Mapbox:
  `mapbox.com/pricing`, `docs.mapbox.com/help/glossary/map-loads/`, LICENSE
  de `mapbox-gl-js`; Google: `developers.google.com/maps/billing-and-pricing/
  march-2025`, `…/pricing`, `cloud.google.com/maps-platform/terms/
  maps-service-terms`; Esri: `location.arcgis.com/pricing/`; EOX:
  `eox.at/2025/03/sentinel-2-cloudless-2024/`; Nominatim:
  `operations.osmfoundation.org/policies/nominatim/`; Photon:
  `github.com/komoot/photon`.
- 360° · npm (`@photo-sphere-viewer/core`, `pannellum`, `marzipano`, `three`),
  código fuente de PSV (`system.ts`, `GyroscopePlugin.ts`), MDN
  `DeviceOrientationEvent.requestPermission`, caniuse `webgl2` y `webp`,
  Apple Metal Feature Set Tables, `github.com/google/marzipano` (archivado),
  `github.com/mrdoob/three.js/pull/22654`; pesos medidos con esbuild por el
  investigador.
- Correo y avisos · `resend.com/pricing`, `resend.com/docs/send-with-supabase-smtp`;
  `help.brevo.com` (límites del plan Free y sello); `postmarkapp.com/pricing`;
  `static1.twilio.com/en-us/changelog/sendgrid-free-plan`;
  `aws.amazon.com/ses/pricing/`; `mailgun.com/pricing/`; Gmail:
  `support.google.com/a/answer/81126`; WhatsApp:
  `developers.facebook.com/documentation/business-messaging/whatsapp/pricing`
  (y `…/non-template-messages`), `whatsapp.com/legal/messaging-guidelines`;
  Twilio WhatsApp: `twilio.com/en-us/whatsapp/pricing`; Web Push en Apple:
  `developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers`.
- `[INVESTIGACIÓN · stack/hosting, cuentas, gráficas/pruebas y Apps Script se
  agregan con su corrida]`
