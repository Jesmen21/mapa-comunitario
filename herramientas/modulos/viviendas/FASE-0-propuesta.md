# Fase 0 · Propuesta del módulo de viviendas · BORRADOR para aprobación

Sesión del módulo Viviendas · rama `claude/fervent-allen-74qgwm` · 23 de
octubre de 2026. **Sin código.** Lo que está medido lleva su medición; lo que
no se pudo verificar desde este contenedor lo dice. Las cifras de proveedores
externos salen de la investigación con verificación adversarial (anexo B);
donde todavía dice `[INVESTIGACIÓN]` es porque esa corrida no ha terminado.

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

`[INVESTIGACIÓN · se llena con la corrida verificada: framework por aplicación,
hosting gratuito sin trampa de uso comercial, monorepo]`

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

`[INVESTIGACIÓN · librería y proveedor de teselas con cuotas y costo a 1k /
10k / 100k visitas; satélite; geocodificación]`

Decidido por diseño: el mapa va detrás de `AdaptadorMapa` (crear, marcadores,
clusters, capas por área, volar a un punto, dibujar radio), de modo que
cambiar de proveedor sea un día y no una reescritura. Las ubicaciones
públicas son las de la **vista** (desplazadas); el punto exacto nunca llega al
navegador del público.

## 6 · Recorrido 360°

`[INVESTIGACIÓN · Photo Sphere Viewer vs Pannellum vs Marzipano: licencia,
peso, giroscopio en iOS, tours, resoluciones recomendadas]`

## 7 · Imágenes en Cloudflare R2

`[INVESTIGACIÓN · cuotas vigentes, egreso, dominio propio vs r2.dev, URL
prefirmadas, respaldo]`

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

- **Correo transaccional:** `[INVESTIGACIÓN · proveedor con cuota gratis,
  SPF/DKIM/DMARC]`. Decidido: SMTP propio en Supabase Auth desde el día uno
  (el SMTP por defecto no sirve para producción) y plantillas en español.
- **Aviso de solicitud (no negociable):** disparador en `interesados` →
  Database Webhook → Edge Function → correo a Daniel en menos de un minuto +
  contador en el panel. WhatsApp: `[INVESTIGACIÓN · costo de plantilla
  utility en Colombia y requisitos]`.
- **Respaldos:** el plan gratis **no tiene respaldos automáticos**; Pro,
  diarios con 7 días; PITR es un añadido de US$100/mes por 7 días (fuente
  primaria). Mientras estemos en gratis: una acción programada semanal que
  haga `supabase db dump` y lo guarde en R2 (bucket privado), más la lista de
  objetos de R2.
- **Pausa por inactividad:** el plan gratis se pausa tras 7 días de poca
  actividad y da 90 días para restaurar (fuente primaria). Antes de una demo:
  pasar a Pro o, como mínimo, una consulta diaria programada.
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
| P11 | Cuándo pasar a Pro | Daniel | antes de la primera demo; el gratis se pausa a los 7 días |
| P12 | Cuenta de Cloudflare R2 | Daniel | crearla en la Fase 0 (pasos en §7 cuando llegue la investigación) |
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
- `[INVESTIGACIÓN · el resto se agrega con la corrida verificada]`
