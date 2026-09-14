# URBIS · cómo se trabaja en este repositorio

Notas para cualquier sesión que retome el proyecto. Están acá porque cada una
de ellas costó tiempo averiguarla o romper algo.

## Antes de tocar nada: traer lo de arriba

```bash
git fetch origin && git merge origin/main --no-edit
```

**Hay más de una sesión escribiendo en este repositorio.** Una publica alertas
y seguimiento noticioso a `assets/data/` y sube a `main` varias veces al día,
con su propio salto de versión. Empezar una tanda sin traer eso termina en un
empujón rechazado y en una fusión hecha con prisa, que es cuando se pierde
trabajo ajeno.

Hacerlo también **al terminar**, antes de subir: entre el principio y el final
de una tanda pueden haber entrado dos versiones más.

Nunca `--force` sobre `main`. Si el empujón se rechaza, se fusiona.

### Una fusión que falla y no se nota

Pasó el 9 de septiembre de 2026 y costó una versión publicada por debajo
de la que ya estaba en la calle. `git merge` con cambios sin guardar en el
árbol **aborta**, pero su PRIMERA línea dice `Updating a914a88..609550e`,
que parece que funcionó; el error viene después. Encadenado con `;` —o
mirando solo `| tail -1`— la tanda siguió como si se hubiera traído lo de
arriba, y se publicó una v839 cuando ya había una v840 afuera.

Dos reglas que lo evitan:

```bash
git fetch origin && git merge origin/main --no-edit   # con &&, no con ;
git log --oneline -1                                   # ¿está el commit de arriba en la historia?
```

Es decir: encadenar con `&&`, y **comprobar la historia, no el mensaje**.
Si el commit de `origin/main` no aparece en `git log`, la fusión no
ocurrió, diga lo que diga la primera línea.

Lo cazó `revisar.js` con la comprobación de que la versión no choque con
la publicada. Sin ella se habría subido con el número por debajo, que para
la caché de un teléfono es una versión que no existe.

### Cuando las dos tandas se llaman igual

Pasó el 7 de septiembre de 2026: las dos sesiones llamaron v788 a lo suyo.
Ninguna hizo nada mal —cada una miró el último commit de su rama y sumó uno—
y el choque salió al fusionar, con los siete archivos de versión en conflicto
por una sola cosa: el número.

Se resuelve **subiendo por encima de las dos**, nunca bajando la propia: para
la caché de un teléfono, una versión que no sube es una versión que no
existe, y quien ya tenga la del otro no se enteraría del cambio.

```bash
git diff <base> origin/main -- <los siete>   # comprobar que solo cambió el token
git checkout --ours -- <los siete> && git add <los siete>
sed -i 's/788-lo-mio/789-lo-mio/g' <los siete>
```

`revisar.js` lo avisa antes, comparando con la referencia de `origin/main`
que ya está en el disco: mismo número con otro nombre, o número menor que el
publicado. No hace `git fetch` —una comprobación estática que sale a la red
se cuelga sin señal—, así que ve el choque solo si se trajo lo de arriba
antes. Razón de más para el `git fetch` del principio.

## Las ramas

Se desarrolla en `main-r3g781`. Al terminar, `merge --ff-only` a `main` y se
suben las dos. Nada de trabajar directo sobre `main`.

## La versión va en siete archivos

`service-worker.js`, `index.html` (incluido `window.URBIS_APP_VERSION`),
`css/main.css`, `analisis-ia.html`, `seguimiento.html`, y los dos de la
entrada del APK URBIS_CO: `reportes.html` (que solo redirige a `index.html`;
el APK la lleva grabada como dirección de arranque y no se puede quitar) y
`sw-reportes.js` (un service worker de retiro que se da de baja solo).

Tienen que llevar exactamente el mismo texto. Es lo que rompe la caché del
navegador: con uno desactualizado, un teléfono se queda con la mitad de la
aplicación vieja y la otra mitad nueva, que es peor que no actualizar. Se
cambian de una vez:

```bash
sed -i 's/682-lo-que-sea/683-lo-nuevo/g' \
  service-worker.js index.html css/main.css analisis-ia.html seguimiento.html \
  reportes.html sw-reportes.js
```

`node pruebas/revisar.js` comprueba que los siete coincidan. Los dos últimos
entraron en la v780, cuando todavía eran una app ligera aparte: llevaban
desde la 597 congelados. En la v784 la app ligera se retiró —el APK abre la
misma interfaz que la web— y quedan como entrada y como retiro.

## Las pruebas

```bash
node pruebas/revisar.js     # sin navegador: versiones, llaves sin cerrar, reglas del motor
node pruebas/correr.js      # el navegador de verdad, ~58 suites
node pruebas/correr.js tlote tcurvas   # solo algunas
```

Hacen falta **dos servidores levantados**, y se caen entre sesiones:

```bash
# el estático, SIEMPRE desde la raíz del repositorio
(setsid python3 -m http.server 8199 &)
# el motor, en 8787
(cd /home/user/urbis-motor && setsid node servidor.js &)
```

Ojo con levantarlos con un `cd` encadenado: el directorio queda cambiado y el
estático termina sirviendo la carpeta del motor. Se nota porque
`curl localhost:8199/index.html` contesta 404 y todas las suites fallan
igual que si el motor estuviera caído.

**El puerto 8199 no es negociable.** El motor solo acepta peticiones de unos
orígenes conocidos y ese es uno; desde cualquier otro, el navegador se queda
sin respuesta y los análisis salen vacíos sin decir por qué.

Si de golpe fallan cuarenta suites con «Cannot read properties of null», casi
siempre es el motor caído, no una regresión.

## El motor

Vive en un repositorio privado aparte (`../urbis-motor`). Las reglas de
clasificación NO se sirven al navegador: eso es lo que se vende. Para
cambiarlas: editar `motor-reglas.js`, correr `node construir.js`, y
**reiniciar el servidor**. `revisar.js` comprueba que ninguna regla se haya
colado en un archivo servido.

## Secretos

Nunca en el repositorio, ni en capturas, ni en el chat: `URBIS_SECRETO`, las
licencias, el `.keystore`. La huella SHA-256 de firma sí es pública.

## El límite de Overpass

Cinco segundos entre consultas, y lo rechaza sin avisar bonito. Cualquier
cadena que pida dos cosas seguidas tiene que esperar. En las pruebas eso son
los `await esperar(5200)` que parecen de más y no lo son.

### Overpass avisa de sus fallos DENTRO de una respuesta correcta

La que más caro costó, y no se vio en meses. Cuando Overpass se queda sin
tiempo o sin memoria **no contesta con un código de error**: contesta 200,
con `elements: []` y una línea `remark` explicando por qué.

```json
{"version":0.6,"remark":"runtime error: Query timed out ...","elements":[]}
```

`fetchOverpass` solo miraba `res.ok`, así que eso entraba como un sector sin
un solo uso. Y peor: se **guardaba en el caché**, que dura 24 horas, así que
volver a analizar el mismo sector devolvía el mismo cero sin salir a la red.
Llegó en capturas (v851): un radio de 2 km sobre el centro de Cúcuta con
«Todos los usos 0» mientras la ficha decía 45.877 habitantes, y dos minutos
después un sector de 400 m al lado con 870 usos. «Al parecer al hacer un
análisis grande se buguea y dice que no había nada.»

Cuatro reglas, todas en `js/61`:

* **Un `remark` con la lista vacía es un fallo**, y el error dice qué pasó.
  Con la lista llena es una respuesta PARCIAL: se queda lo que trajo y se
  avisa.
* **Un vacío no se guarda en el caché, y uno guardado no se sirve.** Un
  sector sin nada mapeado es un resultado legítimo y se muestra, pero
  guardarlo es apostar a que el vacío era de verdad. Repetir la consulta
  cuesta segundos; publicar un cero falso cuesta el análisis. Las dos mitades
  hacen falta: no guardar arregla los teléfonos nuevos, y `leerCache`
  ignorando la lista vacía arregla el de quien ya sufrió el fallo y lo lleva
  guardado (v852). Sin la segunda, el arreglo servía para todos menos para
  quien lo reportó.
* **La consulta se escala con el área** (`escalaDeConsulta`): 60 s y 3.000
  elementos hasta 5 km², 90 s y 8.000 hasta 30 km², 180 s y 14.000 por
  encima. El corte del CLIENTE va siempre por encima del del servidor: con
  los 40 s fijos de antes, una consulta a la que el servidor le daba 90 se
  abortaba a los 40 y no podía terminar nunca.
* **Las capas de ÁREA** —`landuse`, `building`, `natural`, `waterway`— son
  las que revientan un radio grande: sobre 200 km² son decenas de miles de
  polígonos que hay que centrar uno por uno. Van en `capasDeArea`, aparte.
  Por encima de 50 km² la consulta sale directamente sin ellas; por debajo,
  son el respaldo si la completa no alcanza. Cuando se sueltan **se dice**,
  y el aviso llega a la ficha: un análisis al que le falta una capa no
  puede presentarse como completo.

El aviso viaja como propiedad `aviso` pegada a la lista de elementos —no
como elemento, para que quien la recorre no lo vea— y también por el caché.
Lo lee `js/68` y lo pinta en `S.aviso`.

Con esto el radio llega a **8 km** (`RADIOS` y las dos barras de `js/68`).
Lo mide `tconsulta.js`, contra un Overpass de mentira al que se le puede
pedir que se ponga de mal humor: es la única forma de provocar un tiempo
agotado sin depender de cómo esté el servidor de verdad hoy.

### Un corte por tiempo no se reintenta (v869)

Llegó en captura el 12 de septiembre de 2026: un lote de 92 ha con 2 km de
radio se quedaba en «Consultando…» y la aplicación se caía. El área —12,57
km²— está **por debajo** del corte de 50 km² que suelta las capas de área, así
que la consulta salía completa, con `building` y `landuse` de doce kilómetros
cuadrados de Cúcuta.

Pero el tamaño no era el fallo. El fallo era el bucle de intentos:

* Un `remark` rompe el bucle —«esta consulta es demasiado cara»—, pero un
  **aborto por tiempo del cliente no llevaba ninguna marca**: `fetch` lanza el
  mismo `AbortError` para un corte nuestro que para una conexión cortada. Así
  que se reintentaba la MISMA consulta pesada contra el MISMO servidor:
  110 + 3 + 110 + 3 + 110 + 3 + 110 ≈ **siete minutos y medio** antes de llegar
  al respaldo ligero. Nunca podía cambiar la respuesta.
* `fetchOverpass` marca ahora `err.porTiempo`, y el bucle rompe con las dos:
  son la misma respuesta dicha de otra manera. Los reintentos se quedan para
  lo que sí es un bache —un 504, una conexión cortada, el espejo—, que es lo
  único que cambia entre intentos.

**El tope de elementos no protege de esto.** Es un límite de `out`: acota la
SALIDA, no el trabajo del servidor. Overpass construye la unión entera antes de
aplicarlo, así que subir el tiempo o bajar el tope no evita que una consulta
cara no termine.

#### El techo se aprende, no se adivina

El corte de 50 km² estaba puesto a ojo y en una ciudad densa se queda largo.
Poner otro número a ojo sería repetir el error, y desde acá no se puede medir:
el proxy de la máquina de desarrollo bloquea Overpass. Así que se **aprende**:
cuando la completa se cae —por tiempo o por `remark`— se guarda el área en la
que se cayó (`urbis_overpass_techo_v1`), y a partir de ahí un área igual o
mayor sale directo en ligera, diciéndolo con esas palabras y no como una regla
de tamaño.

Dos cosas que costaron una vuelta, las dos cazadas por la prueba y no leyendo:

* **Se redondea hacia ABAJO.** Con `round`, los 12,566 km² del sector que
  reportó esto se guardaban como 12,57 y la MISMA consulta quedaba por debajo
  del techo que ella misma acababa de poner: se intentaba la pesada otra vez.
* **El techo CADUCA a las 24 h**, igual que el caché. Sin caducidad es
  autoconfirmante: una vez puesto, la pesada no se vuelve a intentar nunca, así
  que jamás llega la prueba de que ya alcanzaría, y un mal día de Overpass
  dejaría el teléfono en ligero para siempre sin que nadie supiera por qué.
  Cuando caduca y la completa vuelve a alcanzar, el techo se borra.

#### El doble no sabía colgarse

`tconsulta` tenía modo `remark` y no tenía modo **colgado**, y por eso esto
llegó a producción: el camino del aborto por tiempo no se ejercitaba en
ninguna prueba. Ahora la pesada nunca resuelve y la ligera contesta, que es
exactamente el sector de la captura. Se mide la DECISIÓN —cuántas veces se
pidió la pesada—, no el reloj: el corte del cliente se acota con
`corteMsMax`, un parámetro de verdad de `consultarEntorno` para quien no puede
esperar dos minutos, no una puerta trasera de pruebas.

**Lo que esto NO arregla, y hay que decirlo:** el primer análisis de un área
pesada sigue costando unos dos minutos —110 s de la completa que no alcanza,
más la ligera—. Lo que se quitó son los cinco minutos de reintentos inútiles.
Bajar más pide o medir contra el Overpass real, que desde acá no se puede, o
avisar en pantalla en qué va la espera, que sigue diciendo «Consultando…» sin
más.

### La barra de espera, y por qué no llega al 100 % (v870)

Pedido en la misma conversación del fallo anterior: «deberías dejarme como una
barrita y ver si está cargando o no». El botón decía «Consultando…» y nada
más, y una consulta grande puede tardar dos minutos: **desde afuera no se
distingue una espera larga de un cuelgue**, que es exactamente por qué el
reporte decía «se demora mucho y se cayó».

* `js/61` avisa de cada paso por `AIA_DATOS.alPaso`, y el aviso lleva el
  **presupuesto** de ese paso —los milisegundos que como mucho va a esperar—.
  Eso es lo que permite una barra que avanza contra un tope conocido en vez de
  inventarse un ritmo. Los pasos son los reales: `usos`, `reintento`,
  `respaldo`, `usos-ligera`.
* El aviso es opcional y **no puede tumbar una consulta**: si la función
  revienta, se traga el error. Un adorno de la pantalla no puede costar un
  análisis.

**La barra no llega nunca al 100 % mientras espera.** Se queda en el 96 %, y
si el paso se pasa de su presupuesto lo dice con letras —«va en 138 s, más de
lo previsto»— en vez de sentarse llena. Una barra llena que sigue esperando es
una mentira, y es la misma regla que el resto del proyecto: no se pinta una
precisión que no se tiene. El rayado que se mueve dice «sigue viva» aunque el
ancho no cambie, que es justo lo que pasa cuando un paso se pasa.

Dos cosas de implementación que cuesta recordar:

* **Se repinta tocando SOLO los nodos de la barra**, no llamando a `pintar()`.
  Recomponer la hoja entera cuatro veces por segundo mientras se espera es lo
  que convierte una espera en un teléfono caliente.
* **El latido se para en el `finally`, salga bien o mal.** Un `setInterval` que
  sobrevive al error se queda tocando el DOM para siempre, y eso no se ve: se
  nota en la batería dos horas después.

Y una del sitio: la barra se busca en el DOCUMENTO, no dentro de `hojaEl()`.
Sale en tres sitios —la hoja, el panel del lote y el del sector— y buscarla
solo en uno la dejaba muerta en los otros dos. Lo cazó la prueba con un
`H is not defined`, que era yo usando un ayudante de las suites dentro del
módulo.

### Guardar el TRAZO solo, sin análisis (v871)

Pedido tal cual: «una opción de guardar el polígono que dibuje, pero solo el
polígono, sin análisis, para no tener que dibujarlo varias veces… y después
analizarlo las veces que yo quiera y se guarda nuevamente pero con el
análisis, y así para hacer diferentes análisis». Es el lugar guardado de
Google Earth: **la forma es una cosa y lo que se midió sobre ella es otra.**

Los trazos viven en `pcr_trazos_v1`, **aparte de las fichas**, por tres
razones que se notan el día que no están:

* Un trazo es coordenadas y pesa unas décimas de kilobyte; una ficha es el
  trabajo de una tarde y pesa cientos. Juntos, el recorte por cupo de
  `escribirFichas` se llevaría trazos por delante para hacer sitio a un
  análisis — y redibujar noventa y dos hectáreas a mano en un teléfono no se
  le pide a nadie dos veces.
* Un trazo se guarda **antes** de analizar, que es justo cuando todavía no hay
  ninguna ficha que lo contenga.
* Un mismo trazo tiene **muchos** análisis —esa es la petición entera—, así
  que la forma no puede vivir dentro de uno de ellos.

Cada ficha guarda de qué trazo salió (`trazoId`), que es lo que permite que la
lista diga «3 análisis» sin abrir ninguno. Y las dos direcciones están
comprobadas: borrar el trazo **no** borra los análisis que salieron de él, y
analizar **no** duplica el trazo.

#### `R.estado()` es un objeto fabricado, no `S`

Costó media hora y una prueba que no fallaba por lo que decía. `estado()`
construye un objeto nuevo con lo que expone, así que `R.estado().lote = null`
escribe en una copia y no toca nada, y leer un campo que no expone da
`undefined` — que en una aserción se ve igual que «la función no hizo su
trabajo». La prueba parecía estar midiendo la función y estaba midiendo el
accesor.

Dos reglas: para CAMBIAR el estado desde una prueba se usa el botón de verdad
—`lote-borrar`, no una asignación—, y lo que una prueba necesite leer se
**agrega a `estado()`** en vez de alcanzarlo por un lado.

#### Dónde vive cada lista, y por qué

Las dos listas —reconocimientos y trazos— están en el panel de ANTES de
analizar, no en la barra encogida ni en la ficha. La barra encogida existe
para ver el mapa mientras se marca, y la ficha para leer el resultado:
ninguna de las dos es donde uno va a buscar algo guardado. Con el análisis
hecho se llega con «Analizar otro sector».

## El módulo presidencial: qué mueve el veredicto

Lo escribe una rutina diaria y lo lee cualquier sesión, así que las reglas
van acá y no solo en el texto de la rutina —ese se edita en la web y no
siempre se puede llegar a él—.

`assets/data/seguimiento-presidencial.json` alimenta una ficha del gobernante
que **se calcula sola**: no hay veredicto escrito en el JSON, sale de contar.
Cuatro cuentas ponen cada una un techo y manda el PEOR de los cuatro.

| Cuenta | Qué la baja |
|---|---|
| Casos de corrupción confirmados | 1 → «Poco fiable» · 2 → «Nada fiable» |
| Casos en investigación | 1 → «Dudosa» · 2 → «Poco fiable» |
| Cambios de postura contados | 1 → «Fiable» · 2 → «Dudosa» · 3+ → «Poco fiable» |
| Registro verificado por terceros | <85 %, <70 %, <50 %, un peldaño cada vez |

Es decir: **un caso mal clasificado cambia en público el juicio sobre una
persona real.** De ahí que `casos.lista` tenga cinco estados y que cada uno
exija su prueba:

* `confirmado` — fallo, sanción, documento oficial o reconocimiento del
  implicado, con quién lo confirmó escrito al lado. Si hay duda, no lo es.
* `en-investigacion` — una autoridad abrió proceso, con radicado o fecha de
  apertura. Una denuncia radicada que nadie abrió todavía **no** es esto.
* `senalamiento` — lo dice un medio o un actor político y ninguna autoridad
  se pronunció. Se ve, con su etiqueta, y no pesa. Es el estado por defecto.
* `archivado` — una autoridad lo miró y lo cerró sin hallazgo, con la orden de
  archivo o la preclusión citada. Se ve, con etiqueta verde, y no pesa. **No
  se cuenta como señalamiento**: leer igual lo que nadie ha revisado y lo que
  una autoridad ya revisó y cerró es injusto con el señalado. Un registro que
  solo publica lo que acusa no es un registro; el desenlace que exonera
  circula mucho menos que la acusación y por eso hay que escribirlo.
* `por-documentar` — nombrado sin hecho ni fuente. Ni se pinta ni pesa.

Tres cosas que es fácil hacer mal:

* **Las denuncias del propio Gobierno contra la administración anterior NO
  son casos suyos.** Van a la línea de tiempo, categoría `corrupcion`.
  Meterlas en `casos` invierte el sentido del módulo.
* Un caso que avanza **se actualiza**, no se duplica. Uno que se cae **baja
  de estado**, no se borra: borrar es esconder.
* `tipoFuente` vacío no es neutral. Es una de las cuatro cuentas, así que
  dejarlo en blanco mueve el veredicto igual, solo que sin querer.

`revisar.js` comprueba **en los dos registros** —el del gobernante actual y
el de Gustavo Petro— que los estados sean de los cinco conocidos y que ningún
caso con consecuencia (confirmado, en investigación o archivado) vaya sin
quién, fecha y fuentes. Los dos, porque la misma vara mide a los dos: aflojarla
en un registro sería la manera silenciosa de inclinar la comparación. Y un
archivado también exige papel: una exoneración sin fuente es tan falsa como
una acusación sin fuente.

## Visión Territorial: la cuarta puerta, aparte

El sexto módulo (v844): déficits de equipamientos, prioridades y propuestas
para alcaldes, gobernadores y presidentes. **URBIS recomienda, el humano
decide**: ninguna pantalla ni texto dice que el sistema decide. Todo texto
que genera va en tres tiempos —qué encontró, qué recomienda, qué pasa si no
se hace— y solo sobre datos que tiene.

### Hereda la interfaz y no comparte nada más

Es una página propia, `vision-territorial.html`, con `js/90-vt-app.js`,
`css/90-vt.css`, `sw-vt.js` (ámbito `/vision-territorial`) y
`manifest-gobierno.json`. Comparte con `index.html` exactamente dos archivos
de solo lectura: `js/00-config.js` y `js/71-iconos-urbis.js`. **Nada de
js/05, js/12 ni js/20; nada del Apps Script; nada del campo `descripcion`
separado por ` | `.** Sus claves de almacenamiento llevan `urbis_vt_`; su
único global es `window.VT`. `revisar.js` vigila cada una de estas cosas en
el bloque «Visión Territorial, aparte», y `tvision.js` comprueba en el
navegador que desde `?app=educativo` ninguna pantalla suya existe y que un
reporte ciudadano nunca aparece como propuesta.

`?app=gobierno` está declarado en `js/70` con `pantallas: []` y una
`pagina`: si alguien llega con ese parámetro a `index.html`, se lo lleva a
su página antes de pintar nada.

### Los datos viven en Postgres/PostGIS, no en la hoja

Esquema, motor y rutas están en el repositorio privado del motor, carpeta
`vt/`:

| Archivo | Qué es |
|---|---|
| `vt/esquema.sql` | 13 tablas, PostGIS 4326, uuid, DANE como llave, RLS en todas |
| `vt/roles.sql` | `vt_migrador` (dueño) y `vt_app` (el servidor, NOBYPASSRLS, sin DELETE) |
| `vt/analisis.js` | el motor de déficit por radio; umbrales leídos de la tabla |
| `vt/rutas.js` | `/vt/*`; ninguna respuesta trae pesos ni umbrales |
| `vt/semilla.js` | Cúcuta, El Zulia y Bogotá con datos **de desarrollo**, marcados |
| `vt/probar-vt.js` · `vt/probar-rutas.js` | las pruebas de la base y de las rutas |

Tres reglas del esquema que cuesta recordar:

* **La RLS filtra por el territorio de la sesión**, que el servidor pone por
  transacción (`set_config('vt.territorio', …, true)`). Sin ese ajuste una
  consulta devuelve cero filas: es el fallo seguro. `FORCE` aplica también al
  dueño, así que una función `SECURITY DEFINER` no cruza territorios; lo
  poco que cruza (el ranking) vive en `vt.ranking_cache`, una tabla que por
  construcción solo tiene agregados.
* **Nada se borra.** `vt_app` no tiene DELETE, y un disparador lo rechaza
  incluso al superusuario. Se pone `retirado_en`. Por eso la unicidad del
  código DANE es entre territorios *activos* (índice parcial).
* **Los umbrales no se editan**: se retira la fila y se inserta otra con
  fecha y autor. Cada corrida guarda una COPIA de los que usó.

El rol `sistema` es del propio servidor (crear territorios, catálogos,
umbrales generales, retirar propuestas viejas, anotar errores) y **no se
puede emitir por licencia**. Un administrador municipal no puede tocar un
umbral general: solo los de su territorio.

### Cómo se prueba en local

```bash
# una vez: Postgres 16 + PostGIS, base y roles
su postgres -c "psql -f vt/roles.sql"    # desde el repositorio del motor
su postgres -c "psql -c 'CREATE DATABASE urbis_vt_pruebas OWNER vt_migrador'"
su postgres -c "psql -d urbis_vt_pruebas -c 'CREATE EXTENSION postgis; CREATE EXTENSION pgcrypto;'"
VT_DATABASE_URL_MIGRADOR=postgres://vt_migrador:vt_migrador_local@127.0.0.1:5432/urbis_vt_pruebas \
  node vt/migrar.js && node vt/semilla.js
node vt/probar-vt.js && node vt/probar-rutas.js
```

El motor de 8787 necesita `VT_DATABASE_URL` (la de `vt_app`) y un
`URBIS_SECRETO` de pruebas para firmar licencias con territorio. En un
contenedor recién levantado no hay script que los exporte y **el motor
arranca igual**: las rutas `/vt/*` contestan 503 o 401 y `tvision` se cae
con «Cannot read properties of null (reading 'deficit')», que no se parece
en nada a «falta una variable de entorno». Cuesta media hora si no está
escrito, así que va escrito:

```bash
service postgresql start
cd /home/user/urbis-motor
VT_DATABASE_URL_MIGRADOR="postgres://vt_migrador:vt_migrador_local@127.0.0.1:5432/urbis_vt_pruebas" \
  node vt/migrar.js && node vt/semilla.js
VT_DATABASE_URL="postgres://vt_app:vt_app_local@127.0.0.1:5432/urbis_vt_pruebas" \
  URBIS_SECRETO="secreto-de-pruebas-locales-no-es-el-de-produccion" \
  nohup node servidor.js > /tmp/motor.log 2>&1 &
```

Y el mismo síntoma vuelve **con todo bien puesto**: Postgres se cae solo entre
tandas largas, y el motor no se entera —sigue en pie, sirviendo análisis, con
`[vt] la base no responde` en su registro de arranque y las rutas `/vt/*` en
401—. No se arregla levantando la base sola: **hay que reiniciar también el
motor**, porque su conexión se resolvió al arrancar y no se vuelve a intentar.
La pista es `service postgresql status`, que cuesta un segundo, antes de
sospechar de una regresión que no existe.

**El secreto tiene que ser EXACTAMENTE ese**: es el que `tvision.js` usa para
firmar sus licencias de prueba, y con otro la firma no valida —401— y el
cliente recibe null. No es el de producción y no es un secreto: está escrito
en la suite, que está en el repositorio. Una licencia entra al módulo solo si
lleva `vt: { dane, rol }` (`emitir-licencia.js --dane 54001 --rol gobernante`).

### Lo que falta, y se dice en pantalla

* **Supabase real.** El esquema está escrito para Supabase (roles, RLS,
  PostGIS) pero el proyecto no existe todavía: hay que crearlo, correr
  `roles.sql` como `postgres`, `migrar.js` como `vt_migrador`, y poner
  `VT_DATABASE_URL` en el servidor. **Nunca la llave `service_role`**: salta
  la RLS y la volvería decorativa.
<!-- LISTA-VIVA-VT -->
* **Isócronas por malla vial** (Tobler) — no hay malla cargada en el esquema,
  y toda corrida escribe `radio_recto`. `ya: el método va declarado como «radio recto · isócrona pendiente» en el tablero, en la hoja de déficit, en la ficha de propuesta y al evaluar una idea`
* **Espacio público en m²/hab** — hace falta el polígono de cada parque; con
  puntos solo se mide el radio. `ya: la cobertura por radio del espacio público, y el resultado se declara «pendiente» con esa razón escrita dentro`
* **Exportación PDF con marca de agua en el servidor** — no hay exportación
  ninguna todavía.
* **Cuentas por entidad con contraseña de nuevo al aprobar** — hoy la
  credencial es la del equipo. `ya: se confirma escribiendo APROBAR, queda escrito con nombre, rol y hora, y el propio diálogo dice en pantalla que la contraseña llega con las cuentas por entidad`
* **Ciclo de aprendizaje anual y SECOP** — sin empezar.
* **Los tres territorios cargados son de desarrollo** — manzanas sintéticas y
  equipamientos de demostración; la única cifra real es la población de Cúcuta
  (ancla DANE 2024). `ya: toda respuesta con cifras trae su aviso y toda pantalla lo pinta en amarillo, desde la v867`
<!-- /LISTA-VIVA-VT -->

### El aviso viaja con la cifra, no con la pantalla (v867)

Hasta la v866 el aviso «datos de desarrollo» lo mandaba **solo**
`/vt/tablero` y lo pintaba **solo** `pintarTablero`. Entonces la hoja de
déficit —la que se imprime y sale del edificio— decía «4.200 personas a más
de 500 m», declaraba su método (`radio recto · isócrona pendiente`) y su
fecha de corte, y **no decía que las manzanas fueran sintéticas**. La ficha
de propuesta, que es donde se aprueba una obra, tampoco.

**Declarar parte de la procedencia y callar esa parte es peor que no declarar
nada**: una hoja que nombra su método y su fecha se lee como plenamente
fundada. El aviso vivía en la pantalla de la que venías, no en el papel que
te llevabas.

Se arregló en los dos puntos por donde pasa TODO, no ruta por ruta ni
pantalla por pantalla:

* **Motor** — `enviar`, en `vt/rutas.js`, le pega `aviso_datos` a toda
  respuesta 200 con `ok`. El territorio se lee una vez por petición y se
  reparte (antes `/vt/sesion` y `/vt/tablero` lo pedían por su cuenta, así
  que para esas dos no cuesta nada). El texto del aviso vive en
  `avisoDeOrigen`, en un solo sitio: estaba escrito dentro de la ruta del
  tablero, y dos copias de una advertencia se separan.
* **Cliente** — `pedir` recoge `aviso_datos` de cualquier respuesta en
  `S.avisoDatos`, y `pintarHoja` lo antepone. Las dos pantallas que no pasan
  por `pintarHoja` —la lista de propuestas y la ficha— lo llevan explícito,
  y por eso `tvision` las recorre una por una.

**Una ruta o una pantalla nueva lo hereda sin que su autor se acuerde**, que
es lo único que impide que esto vuelva a pasar: el fallo no fue que alguien
decidiera callarlo, fue que había que acordarse cuatro veces.

Lo miden las dos suites, y las dos recorren TODAS las superficies:
`probar-rutas.js` comprueba que déficits, equipamientos y evaluar lleven el
aviso, y `tvision` que lo pinten las cuatro pantallas. Demostradas contra la
v866: tres rutas sin aviso y tres pantallas sin aviso. Una comprobación que
mirara solo el tablero habría pasado en verde todo el tiempo — que es
exactamente lo que pasó durante veintitrés versiones.

## El pliego educativo son DOS láminas (v853)

El módulo educativo entrega **dos hojas de 60 × 90 vertical**, no una:

| | Responde |
|---|---|
| **Lámina A** · sitio y medio físico | ¿Qué es este lugar y qué condiciones físicas manda el terreno? |
| **Lámina B** · gente, usos y movilidad | ¿Quién vive acá, qué le falta y cómo se mueve? |

Cada banda declara la suya con el campo `hoja` en `GRUPOS`. En la A van la
ubicación, el análisis ambiental, **riesgo y servicios** —banda propia desde
esta versión, separada del ambiental: una amenaza declarada no es una
condición de diseño, es una restricción—, la morfología urbana y el lote con
su norma. En la B van la demografía y los usos, la movilidad, el trabajo de
campo y el cierre de cinco propuestas.

Tres cosas que cuesta recordar:

* **`laminaDoble` arma el documento de dos páginas.** Ajusta cada hoja por
  separado —tienen contenidos distintos y no tienen por qué cerrar a la
  misma escala— y después mete el CUERPO de la B en el documento de la A.
  Se pega el cuerpo y no el documento entero porque las dos comparten la
  hoja de estilo: los pesos, los techos y la rejilla salen del mismo
  resultado y de la misma orientación.
* **La escala viaja en el elemento `.rej`, no en una regla.** Con las dos
  láminas en un documento, un `.rej{transform:scale(…)}` valdría para las
  dos y la primera le impondría su tamaño a la segunda.
* **Al componer una hoja se DESCARTAN las cajas de la otra**, marcándolas
  como ya puestas. Sin eso caían todas en «Otras mediciones», la bolsa que
  existe para que una caja nueva no se pierda en silencio.

### Una hoja a la que le sobra papel CRECE

`laminaQueQuepa` ya no se detiene en el 100 %: si la hoja cabe entera y
sobra papel, busca por bisección la mayor escala que siga cabiendo, hasta
`TOPE_CRECER` (1,6). Lo destapó el corte: la lámina A acostada cerraba al
100 % dejando el 56 % del papel en blanco, porque la mitad de las bandas se
habían ido a la B. Medio pliego vacío no es aire, es una hoja a medio
terminar. Los techos de los dibujos están en milímetros de papel y los
deshace `--k`, así que crecer no deforma nada: lo que crece es la letra.

### La escala de cada cifra, y los siete chequeos (v854)

**Cada panel declara a qué escala está medido**, con `ESCALA_PANEL` en
`js/68`: predio, sector, comuna, ciudad, municipio o departamento. Es el
error más caro de un análisis urbano y no se ve: la temperatura media
impresa al lado del área del lote no es la del lote, es la de una celda de
reanálisis que cubre media ciudad, y leídas juntas parecen la misma cosa.
Un panel sin entrada en la tabla imprime «escala sin declarar» en rojo:
callar deja que el lector suponga que es del sector.

**El rótulo va FUERA del `<h2>`.** Dentro parecía más limpio y rompió media
lámina: el título de cada caja se extrae en seis sitios con
`<h2>([^<]+)</h2>` —el reparto por bandas, el peso de cada caja, lo que se
declara fuera, tres suites—, y con una etiqueta adentro ese patrón deja de
casar. El síntoma no fue un error sino algo peor: las cajas dejaron de
reconocerse, se fueron todas a «Otras mediciones» y las de una lámina
aparecieron en la otra. **El `<h2>` de una caja lleva texto y nada más.**

**Los siete chequeos de coherencia** (`chequeosDeCoherencia`) se corren
antes de imprimir y el resultado se IMPRIME, en el panel «Coherencia de las
cifras» al cierre de la lámina B. Lo que falla sale en rojo con la cifra
real que encontró: *nunca se corrige en silencio*. Los que no se pueden
correr —jefes de hogar, tipos de hogar, nacimientos, empleo: el censo que
se lee da población y viviendas por manzana, no hogares— se imprimen como
«sin dato para comprobarlo» y nombran la fuente que haría falta, igual que
los vacíos obligatorios de la v849. Darlos por buenos sería mentir por
omisión.

El séptimo compara lo que cita el cierre contra lo que dice el panel. Ojo
con su extracción: los dos sitios imprimen la medición y la referencia con
la misma unidad y a un palmo una de otra —«6,1 m² por habitante … la meta
nacional son 15 m² por habitante» en el panel, «6,1 m²/hab frente a 15» en
el cierre—, así que pescar el primer «m²/hab» agarraba la medición en un
sitio y el estándar en el otro. Se descarta lo que venga detrás de «meta»,
«falta» o «frente a».

### La regla de neutralidad, impresa

Las dos láminas imprimen, en la cabecera, que el análisis se hizo **sin
propósito declarado**: se mide qué le hace falta al sector, no se justifica
un proyecto ya decidido. Va en la hoja y no solo en el instructivo del curso
porque es la regla que un estudiante rompe sin darse cuenta, y escrita en la
lámina cualquiera puede reclamarle que la cumpla.

La bibliografía va al pie de la **B** y no se repite en la A: es la de las
dos, y repetirla gasta en la lámina del sitio el papel de dos columnas para
decir lo mismo.

Lo mide `tdoslaminas.js`: que salgan dos hojas de 60 × 90, que cada una diga
cuál es y qué pregunta responde, que lo de una no aparezca en la otra, que
ninguna deje el papel a medio llenar y que ninguna mande cajas a «Otras
mediciones».

### Los paneles de la lámina A (v857)

Tres cosas nuevas en la hoja del sitio, y las tres existen para lo mismo: no
dejar que el lector rellene con una suposición lo que el módulo no midió.

* **«Dónde queda, escala por escala»** (`escalasAnidadas`): cinco siluetas en
  fila —país, departamento, municipio, comuna, sector— con la última
  resaltada. Un jurado que no conoce la ciudad no sabe si el sector que mira
  es el centro o un borde. Los **cuatro marcos de fuera van a trazos y la
  hoja dice que son esquemáticos**: este módulo no descarga los límites de
  Colombia, del departamento ni de la comuna. Lo real son los nombres —salen
  del geocodificador— y la última silueta, que es el área analizada dibujada
  a escala: el polígono si se dibujó, el círculo si se analizó por radio.
  Pintar un contorno inventado sin advertirlo sería exactamente lo que el
  pliego prohíbe.
* **La tabla de los tres radios cuenta EQUIPAMIENTOS aparte de usos.**
  Doscientos usos y ningún colegio no es un radio servido. Cuentan salud,
  cultura e institucional; el comercio y la vivienda no son equipamiento por
  más que sean la mayoría.
* **«Potencial edificatorio» y «Suelo disponible real»**, los dos con su
  vacío declarado. El primero mide lo construido y dice que la altura
  permitida **no la tiene**: haría falta la ficha normativa del POT. Lo que
  sí da es una cota por abajo —si acá ya hay un edificio de siete pisos,
  siete pisos caben— y la nombra como tal, que no es el potencial normativo.
  El segundo parte del suelo sin construir, le descuenta el agua vista desde
  el satélite y **no lo llama urbanizable**: nombra los dos descuentos que no
  pudo hacer —la ronda hídrica, que es suelo seco con restricción y no la
  lámina de agua; la pendiente no urbanizable y la amenaza— con la fuente que
  haría falta para cada uno.

#### La misma lista con dos nombres de clave

Costó una tarde y no se veía. El reparto de alturas por cajones llega con la
clave `nivel` cuando lo arma el motor —en `stats.alturas` y en
`trazado.alturas`, los dos— y con la clave `id` cuando sale de
`alturasDeCampo`, en `js/68`. Un panel nuevo que leyera solo `x.id` imprimía
la media de pisos como una raya, **y una raya no se ve como un error: se ve
como «no hay dato»**. Se leen las dos: `String(x.nivel || x.id || '')`.

De paso, la media que sale de esos cajones **no es una media**: el de arriba
agrupa todo lo de cuatro pisos o más, así que un edificio de diez suma cuatro
igual que uno de cuatro. Se calcula, se imprime con «al menos» y la hoja
explica por qué. Darla por exacta sería inventar precisión sobre un cajón.

#### Una caja nueva entra en DOS sitios

`cajasDelPliego` es el inventario: lo que no está ahí no se puede apagar, ni
desde la ficha ni desde «dejar solo el plano», que apaga recorriendo esa
lista. Una caja que el pliego imprime y el inventario no conoce se nota tarde
y de la peor manera —pidiendo una hoja limpia y recibiendo media lámina—. La
condición `listo` tiene que ser **la misma** que usa la caja para devolver
vacío; `tpliego` comprueba justamente que no se separen.

#### Dos cosas que se miden por hoja, no por documento

Las dos salieron de comprobaciones que pasaban por suerte y dejaron de pasar
en cuanto entraron tres cajas nuevas. Ninguna de las dos era un fallo del
papel: eran pruebas que medían otra cosa de la que decían medir.

* **El orden de las bandas lo decide el reparto por filas.** Cuando la
  siguiente banda no cabe en la fila, se busca una de más adelante que sí
  quepa, y el orden de lectura cambia. Así que `banda-x[^]*?<h2>Título</h2>`
  —«el título viene después de banda-x en el documento»— casa con la primera
  banda que aparezca, no con la que contiene la caja. Se mide partiendo por
  `<div class="banda banda-` y mirando **dentro** del trozo.
* **Cada lámina se ajusta a SU escala.** La A y la B cierran con `--k`
  distintos —0,36 y 0,63 en el sector de prueba— porque tienen contenidos
  distintos. Entonces los milímetros de papel de un mapa de la B no se
  comparan con los de la A: la hoja compuesta más suelta da mapas más altos
  sin haberle quitado nada a las figuras de la otra. «La foto y el plano son
  los más grandes» se comprueba **dentro de la hoja A**, que es donde están.

### Los paneles de la lámina B (v858)

* **«El sector dentro de la ciudad»** — la comparación obligatoria (§2.2).
  «1.200 habitantes» no dice nada hasta saber si eso es el 0,2 % o el 12 % de
  la ciudad. La referencia sale de la **misma serie del DANE** con la que se
  proyecta la población del sector (`dane-proyecciones.json`, anclas
  municipales), así que las dos cifras son del mismo año y de la misma
  fuente: comparar un censo de 2018 contra una proyección de hoy fabricaría
  una diferencia que no existe. Si el municipio **no está en la tabla**, la
  caja no compara: lo dice y nombra el archivo que le falta. Aplicarle a un
  municipio la cifra del vecino es peor que no comparar. Va rotulada como
  escala **municipio**, que es lo que es.
* **«Quién queda por fuera»** — la cobertura de equipamientos en PERSONAS.
  «El 38 % del área no tiene colegio a diez minutos» se mira y se pasa de
  página; «cuatrocientas personas no lo tienen» se discute. La tabla separa
  servidas de no servidas por equipamiento, y **el supuesto va dicho**: pasar
  de porcentaje de área a personas reparte la población del sector por igual
  sobre su superficie, y si la gente vive concentrada justo donde sí hay
  colegio, la cifra sobra. Afinarlo pide la población por manzana cruzada con
  cada radio.
* **«Cómo se mueve el sector»** — la red: kilómetros, densidad, porcentaje en
  un solo sentido y **las vías arterias con su nombre y su jerarquía**. Un
  plano de movilidad sin vías nombradas no se puede discutir en una mesa:
  «la vía principal» no es una vía, es una categoría. Declara lo que no
  tiene: las rutas de transporte (pide GTFS o el cuadro de la secretaría —OSM
  trae las paradas, no qué ruta para en cada una), el aforo de hora pico (el
  flujo que imprime está **modelado** a partir de los usos y la jerarquía, no
  contado) y los perfiles acotados e isócronas por malla.

#### La población del municipio viaja desde js/61

`proyeccionDe` devuelve ahora también `poblacionHoy`, proyectada desde el
ancla **más reciente** —no desde el censo: es la cifra que el DANE ya
corrigió— con la misma tasa. Va por `consultarDANE` → `dane` → el motor la
deja pasar a `stats` (`municipioNombre`, `poblacionMunicipio`) sin calcular
ni corregir nada. Tocar eso obliga a `node construir.js` y a **reiniciar el
servidor**.

#### Una suite que le sirve al motor menos de lo que sirve Overpass

`tdoslaminas` le devolvía a la consulta de USOS solo los POI, sin las vías.
Pero la consulta de usos real pide `out center` y de ahí saca el motor los
corredores arteriales, las paradas y el flujo: sirviéndole solo los POI, un
sector lleno de avenidas con nombre se analizaba como si no tuviera ninguna.
La suite pasaba igual porque hasta ahora nada miraba esa lista. Las vías van
en las DOS respuestas y llevan `center`, como en `tmasanalisis`.

### La morfología del tejido (v859)

Dos paneles en la banda de morfología de la lámina A. Los dos miden lo que no
se ve en la foto: dos sectores con el mismo porcentaje construido pueden
tener uno el triple de cruces que el otro.

* **«Continuidad del tejido»** — cruces por km², tramo medio entre ellos y
  fondos de saco, **con el umbral escrito al lado**: por debajo de 100
  cruces/km² el tejido deja de ser caminable y por encima de 150 es un damero
  fino (Marshall, 2005). Una cifra sin su referencia no es un dato, es un
  número. Cierra en un juicio —«trama fina», «trama de supermanzana»—, no en
  el número, y dice que un barrio a medio mapear sale con menos cruces de los
  que tiene, no con los que tiene.
* **«El grano: manzana y predio»** — el módulo de manzana que el trazado
  demuestra, **dibujado a escala contra dos referencias** (damero de centro
  de 80 m, supermanzana de 200 m). Los tres cuadrados van a la misma escala y
  la hoja lo dice: dibujarlos del mismo tamaño con la cifra al pie sería
  mentir sin escribir una palabra falsa, que es lo que un diagrama puede
  hacer. El **predio va declarado sin dato** —pide catastro del IGAC o
  municipal— y se explica por qué una huella de OpenStreetMap no es un lote:
  un predio puede traer tres construcciones o ninguna, y de cuántos lotes
  tiene una manzana depende quién puede construir qué.

#### Un porcentaje que se pasó de 100

Los **cruces y los fondos de saco son conjuntos disjuntos**: el motor cuenta
cruce el nodo que tocan dos vías (`cruces[k] >= 2`) y sin salida el que toca
una sola (`extremos[k] === 1 && cruces[k] === 1`). Dividir unos por otros dio
«750 % de los cruces no tienen salida». El denominador es la suma de los dos
—los remates de calle—, no las intersecciones. Lo que asusta no es el error
sino que **en un sector normal habría salido un número creíble** y nadie lo
habría mirado dos veces; salió a la vista solo porque el sector de prueba era
degenerado. `tdoslaminas` comprueba ahora que ningún porcentaje del panel
pase de 100.

#### Un sector de prueba sin una sola esquina

Las calles del sector de `tdoslaminas` se cruzaban en el plano pero **no
compartían vértice**, y el motor cuenta una intersección donde dos vías tocan
el mismo nodo. Overpass solo lista los vértices propios de cada vía, así que
la retícula tenía cuatro intersecciones y 5.766 m de tramo medio: una
supermanzana de casi seis kilómetros de lado. La continuidad del tejido se
estaba midiendo sobre una malla que no existe. Las calles de la retícula
comparten ahora el vértice donde se cruzan (7 × 13 nodos), y el sector sale
con 31 cruces/km² y 423 m de tramo, que son cifras de barrio.

### La manzana, cerrada de verdad (v860)

Hasta la v859 el tamaño de manzana se **deducía** del tramo medio entre cruces
y la hoja lo decía. Ahora se **cierra**: `manzanas` en `trazado.morfologia`
recorre el grafo de calles con la **regla de la mano izquierda** —parado en
una arista dirigida, en el nodo de llegada se toma siempre el giro más a la
izquierda; al volver al punto de partida se cerró una cara— y cada cara
acotada por vías es una manzana. El panel «El grano» las dibuja una por una,
con el tono según el tamaño, y da área mediana, media y el lado del cuadrado
equivalente.

Tres cosas del método:

* **La cara de AFUERA sale igual y hay que descartarla**: es la única que da
  la vuelta al revés, así que se reconoce por el signo de su área firmada.
* **Dos clases de cara no son manzanas y también salen**: las diminutas (bajo
  150 m², ruido del mapeo — dos vías que casi se tocan) y las mayores que
  media área analizada, que aparecen cuando el borde del sector corta la
  malla y deja el contorno abierto. Las dos se filtran y **se cuentan**: un
  sector del que se cerraron tres manzanas de cuarenta no puede presentarse
  como medido.
* **Las aristas se recogen en el MISMO recorrido que ya cuenta los nodos.**
  Una segunda pasada con su propio criterio de «dentro» daría un grafo
  parecido pero distinto, y las manzanas no coincidirían con los cruces
  contados.

Y lo que la manzana cerrada **no** es: el lindero catastral. Es la cara que
dejan las vías mapeadas — donde falte una calle por mapear, dos manzanas
salen como una; donde haya un pasaje peatonal mapeado como vía, una sale
partida en dos. Para el lindero que vale en una curaduría sigue haciendo
falta el catastro, y el panel lo dice.

Probado contra casos de respuesta conocida antes de conectarlo: retícula de
4 × 4 calles → 9 manzanas de 10.000 m²; con un fondo de saco dentro → las
mismas 9 (no inventa una cara); una sola calle y una cruz → 0; un triángulo
cerrado → 1 de 16.000 m².

Lo que al pliego de instrucciones todavía le falta no se lista acá: vive en
**la lista viva**, al final de estas secciones, porque una lista de carencias
escrita en el medio de una bitácora envejece sin que nadie la mire — y esta
envejeció.

### Declarar faltando algo que sí está medido (v861)

La v858 puso en la lista de carencias de «Cómo se mueve el sector» esto:
«lo que se alcanza a pie se mide en línea recta; para la isócrona real, la
malla vial con sus sentidos». **Es falso.** `caminataDesdeLote` recorre el
grafo de calles con Dijkstra —montón binario, enganche al nodo más cercano
con tope de 100 m, anillos de 5, 10 y 15 minutos— y pinta los tramos que se
alcanzan. La isócrona por malla existe desde antes, y otra línea de la misma
lámina lo decía bien: «la isócrona a pie por la red de calles sí está
medida». El archivo se contradecía consigo mismo.

**Declarar ausente algo medido es peor que un dato de menos.** En un módulo
que se sostiene sobre sus declaraciones, enseña a desconfiar de las que sí
son ciertas: si esta carencia era mentira, ¿por qué creerle a las otras
cinco?

Lo que sí había que decir es otra cosa, y es la que de verdad confunde:
**en esta lámina conviven las dos maneras de medir distancia.** Lo que se
alcanza desde el LOTE va por las calles; la cobertura de equipamientos del
SECTOR —«Quién queda por fuera», «A distancia de caminar»— va en línea
recta, porque se mide sobre una rejilla de puntos y no desde un origen. Una
manzana que en el mapa está a 200 m puede estar a 600 m de camino, así que
las dos cifras no son comparables y ahora la hoja lo advierte.

De paso, la segunda imprecisión de la misma frase: **el ancho de vía no «se
estima por número de carriles»**. El motor lee la etiqueta `width` de
OpenStreetMap donde está y cae a `lanes` × 3 m donde no, y sabe sobre qué
parte de los metros tiene dato (`perfil.anchoDe`, `perfil.coberturaAncho`).
Eso es lo que se imprime, con su cobertura: un ancho medio sacado de tres
calles de cien parece el del sector y no lo es. Lo que sigue faltando es el
perfil ACOTADO —andenes, antejardines, arborización—, que se mide en campo.

`tdoslaminas` comprueba ahora las dos direcciones: que las carencias reales
estén declaradas **y que ninguna declare faltando lo que sí está medido**.

### Las rutas sí están, y era la tercera vez (v863)

Auditando los cinco vacíos obligatorios uno por uno contra el código, cuatro
resultaron honestos —riesgo oficial, servicios públicos, norma urbana e
información legal del predio declaran bien lo que no tienen y lo que sí—. El
quinto destapó, otra vez, una carencia declarada que no lo era.

«Cómo se mueve el sector» decía: «Las rutas de transporte, dibujadas y con su
nombre. Haría falta el GTFS… **OpenStreetMap trae las paradas, no qué ruta
para en cada una**». Falso: la consulta de usos pide
`rel(bn.paradas)["route"~"^(bus|minibus|share_taxi|trolleybus)$"]` —las
relaciones de transporte que recogen en alguna parada del área—, la limpieza
de `js/61` las preserva a propósito, el motor las deduplica por ida y vuelta,
y **el informe en hojas ya las imprimía con su nombre**. Solo la lámina las
daba por ausentes.

Ahora la lámina las nombra —ruta, nombre y tipo— y la carencia dice lo que de
verdad falta: el **recorrido** (se piden sin geometría a propósito: traer el
trazado entero de cada una costaría la consulta) y la **frecuencia**, que
OpenStreetMap casi nunca lleva.

#### Tres carencias falsas, todas de la misma tanda

La isócrona (v861), el ancho de vía (v861) y las rutas (v863) se declararon
faltantes en la v858, y las tres estaban medidas. **El patrón: se escribieron
mirando lo que a una herramienta así suele faltarle, en vez de leer lo que
ESTA mide.** Antes de declarar que algo falta hay que buscarlo en el código,
no recordarlo.

Y una advertencia de método, por si sirve: en esta misma tanda sospeché que
`movilidad.rutas` estaba siempre vacío y estuve a punto de «arreglarlo»
añadiendo la consulta que ya existía. Lo salvó probarlo contra el motor con
tres relaciones de mentira antes de tocar nada. **Una sospecha sobre datos se
comprueba corriendo el código, no leyéndolo.**

### La hoja no se contradice a sí misma (v864)

Auditados los once cruces del cierre y los siete chequeos de coherencia. Los
siete chequeos salieron honestos: el censo que este módulo lee de verdad no
trae hogares, jefatura, nacimientos ni empleo, y cada uno nombra la tabla que
faltaría. De los cruces, uno estaba mal.

«Comparación con la ciudad» decía **«sin cifra municipal comparable en esta
hoja»**, y era verdad hasta la v858 — que puso en la lámina B justamente esa
cifra. El cruce se quedó viejo y la hoja pasó a contradecirse: un panel
comparando con el municipio y el cierre de la misma hoja diciendo que no hay
con qué.

Es la **cuarta** declaración de ausencia falsa, y la primera por quedarse
vieja en vez de nacer mal. Las otras tres (isócrona, ancho de vía, rutas)
nacieron mal en la v858; esta nació bien y la dejó obsoleta una tanda
posterior. Son dos fallos distintos y el segundo va a repetirse cada vez que
una tanda mida algo que antes faltaba.

Por eso la comprobación no persigue ese cruce, **persigue la clase**:
`tdoslaminas` lleva una tabla de pares «lo que la hoja mide / el texto que lo
daría por ausente», y falla si una hoja hace las dos cosas. Hoy cubre la
cifra municipal, la isócrona por malla, las rutas y las manzanas cerradas.
**Una tanda que mida algo que antes se declaraba faltante agrega su par acá**
— es más barato que volver a encontrarlo leyendo.

De paso, el cruce de predios: el PREDIO sigue sin dato —eso pide catastro—
pero desde la v860 la MANZANA está medida, así que ahora dice qué fracción de
una manzana mediana ocupa el lote, y deja la pregunta que sigue abierta:
cuántos predios tiene esa manzana, que es de cuántos vecinos hay que
negociar.

### El censo se pregunta qué trae (v865)

Escolaridad, hogares, alfabetismo y pertenencia étnica estaban en la lista de
«lo que falta» del pliego, y esa lista salía de un razonamiento que nadie
comprobó: el módulo pide los veintitrés campos que conoce —sexo y los
veintiún tramos de edad— y de ahí se concluía que el censo **no trae** lo
demás. Es un negativo sobre datos que nunca se miraron, la misma forma de las
cuatro carencias falsas anteriores.

ArcGIS publica la lista de campos de cada capa en su raíz (`?f=json`).
`camposDeCapa` la pregunta una vez por sesión y `censoAmpliado` busca ahí,
por patrón, los cuatro bloques. **Tres estados, separados a propósito porque
significan cosas distintas:**

| Estado | Qué imprime |
|---|---|
| La capa lo trae | Las barras, **con el nombre del campo** que se sumó |
| La capa no lo expone | Lo declara **con la lista de campos como prueba**: cuántos declara y una muestra de nombres |
| No se pudo preguntar | Lo dice, y aclara que **no es lo mismo que no tenerlo** |

El segundo estado es el que cambia la naturaleza de la afirmación: «la capa
declara 9 campos y ninguno corresponde a hogares» es **verificable** —
cualquiera abre el mismo enlace y lo lee—, mientras que «el censo no trae
hogares» era una creencia. Y la muestra de nombres está ahí para que, si el
campo existe con otro nombre del esperado, se vea en la lámina y se corrija
el patrón en vez de quedar en silencio.

**Lo que esto NO resuelve, y hay que decirlo:** los nombres de campo que
busca (`ESCOLARID`, `NIVEL_EDUC`, `HOGAR`, `ALFABET`, `ETNIA`…) son un
patrón, no una lectura del servicio real — desde la máquina de desarrollo el
proxy bloquea `ags.esri.co`, así que **no se pudo comprobar contra la capa de
verdad**. Si el DANE los deletrea de otra forma, el bloque saldrá como «la
capa no lo expone» **con la lista de nombres al lado**, y ahí se ve cuál es
el patrón que falta. Ese es justamente el diseño: fallar visible y con la
evidencia, no en silencio.

De paso, `E.rutaDane` contesta ahora también **los metadatos** —la capa sin
`/query`—, porque sin eso el módulo cree que no pudo preguntar y lo dice, que
es el tercer estado y no el que la suite quiere medir. La capa por omisión
trae escolaridad y alfabetismo y **no** trae hogares ni etnia, así que una
sola corrida ejercita los dos caminos: el que cuenta y el que declara la
ausencia con la lista de campos como prueba.

## Los defectos de impresión (v874)

Cuatro cosas que salieron impresas en el pliego real del 12 de septiembre de
2026 y que ninguna suite miraba. **Ninguna es un error de cálculo**: las
cuatro son cifras correctas dichas de una manera que no se puede leer, y por
eso ninguna comprobación de datos las veía. Una hoja que se imprime a 60 × 90
y se cuelga en una pared se lee a la primera o no se lee.

* **Una razón grande se dice en VECES.** «El lote ocupa cerca del 15978 % de
  una manzana mediana» es aritméticamente cierto y no significa nada: pasado
  cierto punto el porcentaje deja de ser una proporción y pasa a ser un número
  largo. Por encima del 300 % —que es donde el castellano cambia de forma
  solo: «el triple» se dice, «el 300 %» ya se calcula— `razonLegible` lo dice
  en veces.
* **La concordancia.** «1 piezas de servicios registradas.» Un texto generado
  que no concuerda se lee como un descuido de quien firma la hoja, no de quien
  la programó.
* **El nombre de campo no es una etiqueta.** Salieron impresos
  `NIVEL_EDUC_ESP_MAES_DOC` y `GRUPO_ETNICO_PALANQUERO` —con la falta de
  ortografía incluida, es palenquero— como rótulos de barra. Un nombre de
  columna es el identificador con el que se rastrea el dato y su sitio es el
  pie de fuente, donde sigue. `etiquetaDeCampo` en `js/61` usa el alias de la
  capa cuando lo hay y, cuando no, fabrica una etiqueta legible: quita el
  prefijo del bloque, separa las palabras y desata las abreviaturas conocidas
  (`ABREVIA`). **Lo que no puede desatar lo deja en minúsculas**: ilegible es
  mejor que inventado.
* **Un motel no es un hito.** De nueve hitos impresos, TRES eran moteles. Un
  hito urbano es un referente de ORIENTACIÓN COLECTIVA: aquello por lo que
  alguien explica cómo llegar. `alto_impacto` deja de ser categoría de hito en
  el motor y los ocho usos que la alimentaban —industria, bodega, gasolinera,
  hotel, bar, funerario, salón de eventos y transporte— **siguen contando como
  USOS**, que es donde les corresponde. Obliga a `node construir.js` y a
  **reiniciar el servidor**.

De paso sale la **pertenencia étnica** del censo ampliado (entró en la v865):
en el sector de la corrida real el 98,5 % contestó «ninguno», así que el
bloque gastaba una banda entera para no decir nada. No es que el dato no
exista ni que no importe — es que a esa escala no discrimina.

### El sector de prueba tenía que poder equivocarse

Las cuatro comprobaciones habrían pasado en verde contra el código viejo, y
cada una por la misma razón: **el sector de prueba era demasiado bueno.** Es
la tercera vez que pasa (v862, v866, y esta), así que vale la pena el patrón:
una comprobación sobre un defecto solo sirve si el material de prueba puede
producir ese defecto.

* **Los usos de alto impacto no existían en el sector.** «Ningún hito es un
  motel» se cumplía porque no había moteles. Ahora hay cinco, con nombre
  propio —`nombrePropio` es el primer filtro de la lista, así que un motel
  anónimo tampoco habría ejercitado nada—: antes de esta versión, tres
  ganaban puesto en la lista de nueve.
* **Todos los campos del censo traían alias escrito a mano**, así que la rama
  que fabrica la etiqueta no se ejercitaba. Ahora dos campos vienen como
  vienen muchos de verdad: uno con el alias repitiendo el nombre —lo que hace
  ArcGIS cuando nadie escribió una etiqueta— y otro sin alias ninguno.
* **El sector tenía DOS piezas de infraestructura**, así que siempre imprimía
  «2 piezas» y la rama del singular no se ejercitaba en ninguna prueba — que
  es exactamente cómo llegó a producción «1 piezas». Queda una; la lista de
  varias, con su orden por distancia y el tanque de agua, la cubre
  `tmasanalisis`, que trae tres.

La comprobación de la concordancia **persigue la clase**: en toda la hoja, un
«1» no puede ir seguido de un plural. Y valió la pena en el acto — encontró un
SEGUNDO sitio que el reporte no nombraba, «1 objetos de infraestructura
registrados» en el panel de servicios públicos. La lista de invariables
(`análisis`, `país`, `mes`, `bus`…) está para las palabras que en castellano
acaban en -s en singular; si aparece una nueva se agrega ahí y se ve por qué.

Dos cosas de las pruebas que cuesta recordar:

* **`.hit` la comparten dos cajas**: los hitos y los núcleos de «Dónde está la
  calle comercial». `querySelectorAll('.hit')` a secas devuelve las dos listas
  mezcladas, y un núcleo llamado como un motel habría hecho fallar la
  comprobación de los hitos por un motivo falso. Se busca dentro de la caja.
* **`correr.js` recorta su salida** a las líneas de alrededor de un fallo. Con
  cinco aserciones nuevas fallando en sitios distintos de la suite, enseñaba
  dos y las otras tres parecían estar pasando. Para ver una demostración
  entera se corre la suite directamente: `node pruebas/suites/tdoslaminas.js`.

### Una sospecha sobre el motor se comprueba leyendo el motor

Estuve a punto de rescatar `transporte` como hito institucional, razonando
que el terminal de transporte sí es un hito de ciudad. **No es eso**: en este
motor `transporte` son parqueaderos, taxis y alquiler de vehículos, y el
terminal cae en `parada_bus` junto con cada paradero. Un parqueadero no
orienta a nadie, y convertir `parada_bus` en hito metería los paraderos. Para
que el terminal entre haría falta distinguirlo de la parada, que es otra
tanda. El comentario equivocado alcanzó a quedar escrito en el archivo antes
de mirarlo; es la misma regla de la v863 dicha para el motor.

## Un dato no mapeado no genera propuesta (v875)

El pliego de ajustes lo llamó **«el error más grave de la lámina»**, y lo era.
Hasta la v874 la hoja imprimía, sobre un barrio a medio mapear:

> parque · necesidad **ALTA** · «sin parques ni plazas con forma registrada»
> Colegio o jardín: **0 hab. servidos · 3.155 lejos** — «ahí va el primer
> equipamiento»

Tres mil personas «lejos del colegio» en un sector donde nadie había mapeado
un colegio. **La cifra era correcta y la conclusión era falsa**, que es la
forma más cara de equivocarse porque no se ve: cero polígonos de espacio
público en OpenStreetMap es un hecho comprobable, y «este sector necesita un
parque» es una recomendación de proyecto. Entre las dos hay un salto que la
hoja daba sola.

**Cero mapeados y cero existentes son cosas distintas.** En un barrio
colombiano corriente los paraderos no están en OpenStreetMap y las canchas no
tienen polígono: es el caso normal, no el raro.

### No se arregla bajándole la necesidad

La primera idea —topar la necesidad, como la factibilidad se topa en «media»
sin norma— es **falsa por el otro lado**: si de verdad no hay parques, la
necesidad ES alta, y taparla cambia un error por otro. Un módulo que se
sostiene sobre sus declaraciones no puede resolver una exageración con una
mentira más pequeña.

Lo que sí distingue los dos casos es **quién tiene que hacer algo a
continuación**. Una propuesta es una recomendación para quien proyecta; esto
es una tarea para quien analiza. Así que el indicador sale de las cinco y
entra en un panel propio, **«Antes de proponer, comprobá esto»**, con tres
cosas por renglón: qué comprobar, por qué no se pudo medir, y cómo se
resuelve. Va en ámbar y a trazos, el mismo código visual que los cinco vacíos
obligatorios de la v849 — son lo mismo dicho en dos sitios.

### El discriminante ya existía y nadie lo miraba

`accesibilidad.categorias[].puntos` —cuántos equipamientos de esa clase hay
mapeados— lo devuelve el motor desde siempre. Con `puntos === 0` el
`pctSinCubrir` sale 100 y no mide una cobertura: mide una capa vacía. Con uno
solo mapeado la cifra ya dice algo defendible —hay un colegio y tanto del
sector le queda lejos—, que es una frase distinta. **No hizo falta tocar el
motor**, solo dejar de leer el 100 % como si fuera una medición.

### Los SEIS sitios, no los tres del reporte

El pliego nombraba la propuesta, la conclusión de banda y la síntesis. Al
correr la suite nueva aparecieron tres más del mismo molde, y esa es la razón
de tener el caso como sector de prueba y no como lista de parches:

| Dónde | Qué decía | Qué dice |
|---|---|---|
| Propuestas | «parque · necesidad alta» | va al panel de comprobar |
| Propuestas | «100 % a más de 5 min de colegio» | va al panel de comprobar |
| Conclusión de banda | «sin parques con forma registrada» | «…que es un dato del mapa y no del sector» |
| FODA · debilidad | «Sin parques ni plazas» | tarea, no debilidad |
| FODA · amenaza | «Sin paradas de transporte público» | tarea, no amenaza |
| FODA · debilidad | «Muy poca actividad registrada por hectárea» | tarea: bajo 3 usos/ha, un sector vacío y uno sin mapear se ven igual |
| Cruce del cierre | «Colegio: 0 servidos · 3.155 lejos» | solo las clases con un punto mapeado; las vacías se nombran y no deciden |

### §13 · la cobertura sin clasificar

La conclusión de la banda ambiental citaba «N % de vegetación viva en la
foto» sin mirar `pctAmbiguo`. Con un cuarto del raster en tonos cálidos que
el clasificador no separa, ese número no es del sector: es de los tres
cuartos que se pudieron leer, presentado como si fuera del todo. Por encima
del 25 % la frase lo dice entera o no se dice.

### `tsinmapear.js` · el otro sector real

Suite propia, y a propósito: el sector de `tdoslaminas` está **bien
mapeado** —parque con forma, tres rutas, paradas, equipamientos—, así que
estas ramas no se ejercitan ahí y la comprobación pasaría por no tener nada
que rechazar. Es la lección de la v874 escrita como suite.

El sector nuevo es el otro caso real: 180 usos de comercio y vivienda —corre
el análisis entero, no es «sector vacío»—, ningún colegio, ninguna salud,
ningún parque con forma, ninguna parada. Y **ejercita las dos ramas**: el
comercio sí tiene 60 puntos mapeados, así que la cobertura medida también
corre y se ve que la hoja sabe distinguir, en vez de que simplemente calle.

Demostrada contra la v874: nueve aserciones en rojo, con «100 % del sector a
más de 5 min de colegio o jardín · 3.155 hab. lejos» impreso en las
propuestas y «Colegio o jardín: 0 hab. servidos» en el cierre.

Y una del método de demostrar: `git stash` del archivo entero también se
lleva lo que la suite necesita para LEER —`R.sintesisDelSector`, el
`accesibilidad` de `estado()`—, así que dos de esas nueve fallan por «la
función no existe» y no por el defecto. Las que valen son las que enseñan el
texto viejo. Una demostración por stash completo es tosca; sirve cuando el
texto viejo sale impreso en el fallo, como acá.

## La ciudad entera como referencia fija (v876)

§9 del pliego de ajustes, y una de sus dos prioridades declaradas: «solo se
comparó el 9,67 % de población. Estrato, escolaridad, densidad y pirámide no
se compararon, y la lámina lo confiesa en tres líneas de "todavía no se puede
comparar". **Es justo donde el análisis gana o pierde**».

Tenía razón en lo de fondo: «1.200 habitantes» no se puede juzgar, y la
diferencia contra la ciudad es lo que se discute en una mesa.

### No hace falta radicar nada, ni pasar por Overpass

La solución del pliego —«correr el análisis del municipio UNA vez y guardar
esas cifras»— para la mitad que sale del censo es más barata de lo que
parece: es **la misma capa del DANE** que ya se consulta por radio, filtrada
por código de municipio en vez de por geometría. Una sola petición, y el
servidor agrega las catorce mil manzanas censales del municipio.

Lo que no se sabía es **cómo se llama el campo del código**. Se resuelve
igual que la v865 y por la misma razón: se le pregunta a la capa
(`camposDeCapa`) y se busca por patrón. Si ninguno corresponde, se declara
con la lista de campos como prueba. Nunca se supone.

`censoCiudad(divipola)` en `js/61` devuelve **siempre un objeto, nunca null**,
con su `estado`: `ok`, `sin-municipio`, `sin-preguntar`, `sin-campo`,
`sin-respuesta`. Son cinco cosas distintas que piden cinco acciones distintas
—repetir con señal, corregir el patrón, o nada— y un null las juntaría en
una. Se guarda por municipio y **dura 30 días**: el censo de 2018 no cambia,
pero una caché eterna es una que nadie puede corregir.

### El par, y por qué la diferencia se dice de dos maneras

Cada cifra se imprime como `SECTOR | CIUDAD | DIFERENCIA`, en cuatro columnas
fijas para que la de diferencia se lea en vertical de un golpe — es la
columna que un jurado recorre primero.

**La diferencia entre dos porcentajes va en PUNTOS porcentuales; la de dos
magnitudes, en porcentaje relativo.** «12 % contra 8 %» es +4 pp, no +50 %, y
confundirlas es de los errores que nadie revisa dos veces porque el número
sale creíble. `parConCiudad` lo decide con su parámetro `esPct` y la hoja lo
explica al pie.

### La pirámide va SOBREPUESTA, no al lado

El pliego lo pide con esas palabras: «sobrepuesta como silueta a la de la
ciudad, no en gráfico aparte». La barra gris de la ciudad va detrás, la azul
del sector encima, **las dos a la misma escala** — que es la misma regla de
«El grano»: dos siluetas del mismo tamaño con la cifra al pie mentirían sin
escribir una palabra falsa.

### El área CENSADA no es el área urbana

La densidad de la ciudad sale de `Shape__Area` sumada sobre sus manzanas
censales. Eso **no** es el perímetro urbano del POT, y por eso se llama «área
censada» y no «área urbana». Es lo que hace comparable la densidad del sector
con la de la ciudad —las dos sobre manzana censal—, y el POT sigue en la
lista viva para quien quiera la otra.

### La lista de carencias se ENCOGE sola

`faltanDeCiudad` arma la lista de lo que no se puede comparar mirando lo que
la referencia trajo de verdad. Un renglón que pida algo que ya está en la
columna de la derecha es la misma mentira de la v861 dicha en el panel en vez
de en la bitácora, y acá no puede quedarse viejo porque no está escrito: se
calcula.

Lo que sí sigue faltando se nombra por lo que es: espacio público, densidad
de usos y cobertura de equipamientos de la ciudad piden **una corrida de
OpenStreetMap sobre el municipio entero**, que es otra fuente y otra tanda.

### Dos comprobaciones que se dieron vuelta

`tdoslaminas` exigía que la hoja **declarara faltando** «la estructura de
edades» y «la densidad de la ciudad». Ahora las mide, así que las dos
aserciones se invirtieron: lo que tiene que fallar es declararlas ausentes. Y
**el par entra en `PARES`**, que es la regla de la v864 y justo lo que la
v865 se saltó.

### El doble del DANE tenía que saber contestar por municipio

Otra vez la lección de la v874. `CAMPOS_DANE` no traía ni `COD_DANE_MPIO` ni
`Shape__Area`, así que la consulta municipal no encontraba campo y la
comparación entera se habría probado contra el estado «la capa no lo expone»
— verde, y sin comparar nada.

Ahora los trae, y `atributosCiudad` contesta con las cifras del municipio.
**Deliberadamente distintas de las del sector**: 777.106 habitantes, 126,4
hab/ha y una pirámide más vieja. Si el doble contestara lo mismo para el
municipio que para el sector, todas las diferencias darían 0 % y una
comprobación sobre la comparación pasaría sin comparar nada — que es la forma
exacta de los verdes que este proyecto lleva tres tandas persiguiendo.

En el sector de prueba sale: densidad 17,8 contra 126,4 hab/ha (−85,9 %),
mayores +0,2 pp, menores de 15 +1,8 pp.

## La banda de forma: una mancha que se puede calcar (v877)

§4 del pliego de ajustes, la otra prioridad declarada. La frase que lo
resume: **«el degradado no se puede calcar; la línea sí. Con la línea, todos
los estudiantes trazan la misma geometría medida.»**

Es la diferencia entre un mapa que se mira y uno que se usa. Un degradado
dice «acá hay más» y cada quien lo lee donde quiere; una línea cerrada dice
DÓNDE, y dos personas que la calquen sacan el mismo polígono. Con eso la
banda deja de ser un inventario de usos y pasa a ser insumo de forma.

### Isolíneas de densidad, como una curva de nivel

`campoDeCalor` + `isolinea` en `js/24`, marching squares clásico de dieciséis
casos. El campo es **el que el degradado ya dibujaba, dicho en números**:
cuántos usos de esa categoría hay a menos del radio del núcleo. Por eso el
umbral se puede imprimir en palabras que significan algo —«2 usos o más»— en
vez de en un porcentaje del máximo, que cambia de sector a sector y no deja
comparar dos láminas entre sí.

Dos contornos por categoría, con grosor distinto: el borde (2 usos) y el
núcleo duro (4). **Los dos umbrales van impresos**, porque moviéndolos cambia
la forma: el umbral es parte del dato, no una decisión de dibujo.

Tres cosas del método que cuesta recordar:

* **Las dos sillas de montar (casos 5 y 10) se resuelven por el centro.** Sin
  eso, en un cuello entre dos núcleos la isolínea se cruza consigo misma y el
  dibujo sale con una equis que no existe en el terreno.
* **El área se cuenta por CELDAS sobre el umbral, no integrando el polígono.**
  Una isolínea puede salir partida en varios trozos o cortada por el borde del
  recuadro, y entonces el polígono da de menos; contar celdas da el área
  correcta igual.
* **Una nube redonda no tiene rumbo.** `ejeMayor` hace componentes
  principales y, por debajo de una razón de 1,25 entre los dos ejes, **no
  declara ninguno**: dice que está repartido parejo, que también es un dato.
  Un uso en corredor y uno repartido no se leen igual, y darle rumbo a una
  nube sería inventar una forma que no está.

### `Object.assign({}, base, extra)` arma una copia

Las medidas —el área de cada mancha y el rumbo— salen de recorrer el campo, y
volver a calcularlas afuera sería recorrerlo dos veces. Así que la miniatura
las escribe de vuelta en su objeto de opciones… que `mini()` fabricaba con
`Object.assign({}, base, extra)`. **Un objeto nuevo, no el que se le pasó**,
así que las medidas caían en la copia y el pie salía sin ellas.

Es exactamente el tropiezo de `R.estado()` en la v871, en otro sitio. Vale la
pena la regla general: **cuando algo tiene que volver, comprobar que el
objeto que lo recibe es el mismo que se mandó.**

### Los mapas de categoría, de 63 mm a 10 cm

Medían **63 × 63 mm** —seis centímetros y pico, con el círculo del sector en
siete— y a esa escala la mancha se ve pero el contorno no se puede calcar,
que es justo para lo que existe. Suben a dos columnas. El papel sale de donde
el pliego dice que salga: «esta banda crece, no se reduce… si algo tiene que
ceder espacio, que sean los paneles de texto explicativo, nunca esos dos».

Y el tope de categorías sube de seis a ocho parado (siete acostado), porque
el pliego pide que **los ocho se conserven todos**: separados se lee la forma
de cada uso, que en el mapa combinado se pierde.

### El método de la fila, una vez y no ocho

Iba repetido bajo cada mapa de categoría, palabra por palabra, cambiando solo
el conteo: ocho párrafos idénticos en la banda más grande de la hoja. Ahora
lo lleva el primero de la fila, que es el que la abre.

**La comprobación de `tlaminaedu` se hizo más precisa, no más laxa.** Exigía
las cinco etiquetas del método en TODA caja; ahora exige que la fila lo lleve
**exactamente una vez** y que sea el primero — si cayera en el último, el
lector se encuentra ocho manchas sin saber cómo leerlas y el método aparece
cuando ya pasó de página. La regla de la v848 era que ninguna caja quede sin
método declarado, no que se repita.

### El sector de prueba no tenía una sola calle comercial

Los 220 usos iban en un patrón circular parejo, así que **las cuatro
categorías salían «sin eje dominante»** y la comprobación del rumbo pasaba
por la mitad fácil: si el cálculo del eje estuviera roto, nadie se enteraría.
Es la cuarta vez que aparece el mismo agujero (v862, v866, v874, y esta).

Ahora las farmacias van sobre un corredor de 840 m, como se alinean de verdad
sobre una avenida, y las demás siguen repartidas: el sector ejercita **las dos
ramas**, y sale «eje a 44°» en una y «repartido parejo» en las otras tres.

Demostrada contra la v876: once aserciones en rojo, con los mapas de
categoría midiendo 63 × 63 mm y el método repetido cuatro veces.

## El idioma de lo que se imprime (v878)

§7 del pliego de ajustes: «Eliminar el voseo argentino que apareció: "la
sombra que arrojás", "medí el trazado", "escribilo acá", "con cuál te
quedás"». Español de Colombia, tercera persona o imperativo neutro.

Eran **253 casos en el texto que ve el usuario**. No es una cuestión de gusto:
una lámina que se defiende ante un jurado colombiano y le habla de vos se lee
como escrita por alguien de afuera, y eso le resta a todo lo demás.

### Lo que se cambia y lo que no

El alcance es **lo que sale impreso o en pantalla**, no los comentarios del
código. El voseo de un comentario lo lee quien programa; el de una cadena lo
lee un jurado en una hoja de 60 × 90. Obligar a reescribir la bitácora entera
del código habría sido mucho ruido para ningún lector.

De paso, «La sombra que **arrojás**» pasa a «La sombra que **proyecta**» —así
lo pide el pliego— y ese título es clave de diccionario en ocho sitios
(`METODO_PANEL`, `CARA`, `FUSIONAR`, `cajasDelPliego`, la caja, el mapa…), así
que se cambia en todos a la vez o no se cambia. El **identificador** sigue
siendo `la-sombra-que-arrojas`: un id no es texto, y cambiarlo rompería las
fichas ya guardadas.

### Dos trampas del detector, las dos costaron un inventario falso

* **En JavaScript `\b` trata las vocales acentuadas como NO-palabra.** Así que
  `/\btocá\b/` casa DENTRO de «tocándolo» —el límite cae entre la «á» y la
  «n»— y lo mismo con «medía», «pedía», «seguía» o «elegía», que son
  imperfectos y no voseo. El primer inventario dio 101 casos y la mitad eran
  humo. Los límites se ponen a mano, con una clase de letras que incluya los
  acentos.
* **Un comentario no es una cadena**, y se parecen lo suficiente como para que
  haga falta recorrer el archivo marcando cuál es cuál. Con eso el recuento
  real quedó en 253 en texto y 8 en comentarios.

### Lo que un reemplazo palabra a palabra no arregla

Cinco frases quedaron torcidas y hubo que escribirlas a mano: «los pusiste
vos» → «los **puso** usted» (el verbo también cambia de persona), «un punto
que vos **marques**» → «que usted **marque**», «lo que **ves** aquí decide por
vos», «creer que **coincidís con vos mismo**» → «que uno coincide consigo
mismo», y «guardalo **vos**» → «guárdelo **a mano**», que es lo que de verdad
se quiere decir.

**Cambiar el pronombre no conjuga los verbos de alrededor.** Después de un
reemplazo masivo hay que leer lo cambiado, no solo comprobar que compila.

### La guarda, en `revisar.js`

Una tanda saca los 253; la comprobación es lo que impide que vuelvan a entrar
**de a uno**, que es como entraron. Recorre todo lo que se sirve al navegador
—`js/` y las páginas, listados del disco y no de una lista escrita, para que
un archivo nuevo quede vigilado sin que su autor se acuerde— y busca solo
fuera de comentarios.

Demostrada devolviendo un solo «vos» a `js/78`: la comprobación lo señala con
archivo y línea.

#### La guarda se comió su propia lista

El reemplazo masivo se corrió también sobre `pruebas/`, y ahí adentro estaba
la lista de formas que la guarda busca. Se desvoseó a sí misma —«tocá» pasó a
«toque», «podés» a «puede»— y quedó **buscando las formas correctas** en los
101 archivos servidos: **4.731 falsos positivos**, una guarda denunciando
exactamente lo que existe para proteger.

Fue ruidoso y por eso se vio en el acto. Lo que asusta es la otra mitad de la
moneda: si el reemplazo hubiera **borrado** la lista en vez de traducirla, la
comprobación habría salido en verde para siempre sin vigilar una sola palabra.

Dos cosas, las dos baratas:

* La lista se escribe con **escapes `\uXXXX`**, así que ningún reemplazo que
  busque texto acentuado vuelve a encontrarla, y lleva su aviso encima: es la
  única del repositorio que debe llevar voseo.
* **Se defiende sola.** Una comprobación aparte exige que siga conteniendo
  `vos` y al menos treinta formas terminadas en tilde. Una guarda que puede
  quedarse vacía sin que nadie se entere no es una guarda: es un verde.

Es el mismo patrón de la v868 con las listas vivas —una comprobación que no
comprueba que ella misma sigue viva— y la misma lección de las cuatro tandas
de fixtures pobres: **el material sobre el que se mide tiene que poder
producir el fallo.** Acá el material es la propia lista.

### Catorce suites se cayeron, y una de ellas tenía razón

Trece citaban el texto viejo —«llevás N esquinas»— y se arreglaron con el
mismo reemplazo: una prueba que cita la interfaz tiene que citar la de ahora.

La catorceava era un fallo de verdad, y es el que la v857 dejó advertido.
`caja()` apaga comparando `slugPliego(titulo)` contra la lista de apagadas, y
el inventario declaraba `id: 'la-sombra-que-arrojas'`. Al cambiar el título,
**el slug y el id se separaron** y «dejar solo el plano» ya no podía apagar
esa caja. `tpliego` lo cazó.

**El id de una caja es el slug de su título, y cambiar el título lo cambia.**
Una ficha guardada antes lleva apagado el id viejo, así que se acepta como
sinónimo al leerla: quien apagó esa caja tiene que encontrarla como la dejó, y
no reencendida por un cambio de redacción que él no pidió.

## Las dos láminas no se contradicen entre sí (v879)

§6 del pliego de ajustes, y llegó con la contradicción impresa en la mano:

> Lámina A: «103 cruces por km², trama continua, en rango caminable».
> Lámina B, cierre: «continuidad del tejido 0 % del frente de la cuadra con
> fachada, frente roto».

Las dos cifras eran **correctas** y medían **cosas distintas** —la malla de
calles y la línea de fachada—. Lo que estaba mal era que se llamaban igual, y
un jurado que pone las dos hojas una al lado de otra encuentra una
contradicción donde hay dos mediciones. Los siete chequeos de la v854 no la
vieron porque **comparan cifras de un mismo cálculo**, nunca una hoja contra
la otra.

### Cuatro divergencias reales, no una

Auditando los dos documentos de frente salieron cuatro, todas del mismo molde
—el mismo nombre, o la misma cantidad, con dos valores—:

| Dónde | Qué pasaba |
|---|---|
| «Continuidad del tejido» | el panel de la A cuenta cruces por km²; el cruce del cierre medía el frente con fachada. Ahora el cruce se llama **«Continuidad del paramento»**, que es lo que mide |
| «Suelo disponible» | el panel de la A descuenta la superficie de agua; el cruce del cierre daba el bruto, y el del cierre es el que se cita. Ahora hacen **la misma resta** |
| «Potencial edificatorio» | el panel leía **solo** OpenStreetMap y el cruce prefería lo contado en campo: en un sector levantado, dos medias de pisos bajo el mismo nombre. Ahora las dos llaman a `mediaDePisos` |
| «Población» | la caja «El sitio» imprimía el total **sin decir de dónde sale**, y la B lo imprime proyectado con su año. Ahora la A lo rotula |

La tercera es la que más cuesta ver y la que peor envejece: **dos rutas de
cálculo para la misma cantidad no divergen el día que se escriben, divergen
la tanda siguiente**, cuando una de las dos mejora.

#### El rótulo tenía que decir la verdad, no sonar bien

Estuve a punto de rotular la población de «El sitio» como «contada por el
censo de 2018». **Es falsa.** El motor hace `poblacionEstimada` igual a la
proyectada cuando hay datos del DANE, y el conteo censal vive aparte en
`poblacionCenso`. Habría cambiado una omisión por una etiqueta falsa, que es
peor, y la comprobación habría pasado en verde encima.

Lo salvó ir a leer `motor-reglas.js` en vez de deducirlo del nombre de la
variable. Es la regla de la v863 otra vez: **una sospecha sobre datos se
comprueba corriendo o leyendo el código, no recordándolo.** `tdoslaminas`
persigue ahora las dos mitades: que el rótulo esté **y** que no diga «contada
por el censo» cuando es la proyectada.

### Los cinco cruzados se miden sobre el PAPEL, no sobre las variables

`chequeosCruzados` recorre **el texto ya compuesto de las dos hojas**. Es a
propósito: lo que hay que comprobar es lo que el lector ve, y un error de
unidad, de redondeo o de rótulo no existe en las variables —existe en el
papel—. Los cinco son los que el pliego nombra:

* la trama (A) contra el paramento (B);
* la población (B) contra la superficie y la densidad (A);
* el suelo disponible (A) contra lo que cita el cierre (B);
* la altura media construida (A) contra la del cierre (B);
* la cobertura vegetal (A) contra el espacio público efectivo.

Cuando dos se contradicen se imprimen **los dos valores lado a lado con la
palabra CONTRADICCIÓN**, en caja roja a trazos, y la cabecera dice que
**ninguno de los dos sostiene una conclusión** hasta que se resuelva cuál es
el bueno. Bajarle el tono a uno para que cuadre sería la mentira más pequeña
de las dos, y este módulo no la tiene permitida — es la misma decisión de la
v875 con la necesidad topada.

Tres cosas de implementación que costaron una vuelta cada una:

* **Se busca DENTRO de la caja, no en la hoja entera.** Es la lección de la
  v854: pescar el primer «m²/hab» del documento agarraba la medición en un
  sitio y el estándar en el otro. `cajaEn` corta del `<h2>` al siguiente
  `<section class="caja`, y `cruceEn` lee el cruce por su etiqueta.
* **Los MAPAS entran en el reparto por hoja, no solo las cajas de texto.** La
  cobertura del suelo lo obliga: cuando su raster va en la hoja, sus
  porcentajes se imprimen debajo del mapa y la caja de cifras desaparece a
  propósito. Mirando solo las cajas, el chequeo del verde decía «cobertura
  sin clasificar» sobre una hoja que la traía impresa — **un «sin dato» falso,
  que es la mitad mansa del error que este panel persigue.** Un mapa lleva su
  banda escrita en `data-g` y por ahí se reparte; por el título no se puede,
  porque un mapa se titula «X · el mapa» cuando comparte nombre con una caja.
* **Dos maneras de escribir un número conviven en la hoja.**
  `toLocaleString('es-CO')` pone el punto de MILES —«3.155» son tres mil— y
  `toFixed` pone el punto DECIMAL —«9.2 ha» son nueve hectáreas y pico—. Un
  solo lector para las dos convertía 9,2 ha en 92 y hacía fallar el cruce por
  un error del lector, no de la hoja. Y el área viene en tres unidades según
  su tamaño, así que buscar solo «ha» dejaba sin medir justo los sectores
  grandes, que son los que más se contradicen.

Y una de expresiones regulares que vale para cualquier ancla armada a mano:
**el ancla va siempre en grupo**. `'…(km²|ha)\s*' + 'Perímetro|En metros'`
no es lo que parece: el `|` parte el patrón ENTERO y la segunda rama casa
sola, sin número delante. Devolvía null, y el chequeo salía «sin dato» por un
error del lector.

### La guarda del voseo pasaba por paridad, no por funcionar

El hallazgo más caro de la tanda, y no era de la lámina. Al agregarle código a
`js/68`, `revisar.js` denunció de golpe cinco voseos **en comentarios de
siempre**. La guarda de la v878 no entiende las **expresiones regulares**, y
`js/68` lleva desde hace años un `.replace(/"/g, '&quot;')`: el recorrido ve
la comilla suelta, se cree dentro de una cadena, y a partir de ahí clasifica
mal **treinta mil líneas**.

**La v878 pasó en verde con ese error dentro.** No porque funcionara: porque
la paridad de las comillas que venían después dejaba, de casualidad, los
comentarios con voseo del lado de «cadena» —que la guarda tampoco mira—.
Bastó agregar código con comillas a ese archivo para que la paridad cambiara.

Una comprobación cuyo resultado depende de la paridad de las comillas de un
archivo no está comprobando lo que dice, y **el arreglo no es correr la
paridad de vuelta**: el recorrido entiende ahora las regex —una barra abre
expresión cuando lo último visto no puede terminar una, que no es perfecto
pero acierta en código como este—, no deja que una cadena de comillas cruce un
salto de línea, y se comprueba **contra el caso que lo rompió**: una regex con
una comilla dentro, midiendo dónde cae cada cosa y no que no reviente.

Demostrada en las dos direcciones: un «vos» en una cadena de `js/78` sale
denunciado con archivo y línea, y el del comentario de al lado no.

### Demostrado contra la v878

Nueve aserciones en rojo, con el texto viejo impreso: «Continuidad del
tejido» en el cierre de la B, «ha brutas» donde la A ya descontaba el agua,
siete chequeos donde tiene que haber doce, y ninguno con sus dos valores.

Dos de las aserciones nuevas **no** fallan contra la v878, y es a propósito:
que «Continuidad del tejido» siga siendo el panel de la A con sus cruces, y
que el error típico declarado —«dar por bueno un chequeo que no se pudo
correr»— siga escrito. Son guardas contra pasarse de renombrar y contra
callar, no afirmaciones nuevas.

## Un vacío que cierra en tarea, no en ausencia (v880)

§19 y §10 del pliego de ajustes, y una tercera cosa que salió al medir antes
de escribir.

### La guarda del voseo era un vocabulario, y por eso fallaba abierto

Antes de escribir seis paneles de prosa nueva convenía saber si la guarda de
la v878 servía. **No servía.** Medidas las palabras terminadas en tilde del
texto que se imprime, quedaban **veintisiete imperativos voseantes** que la
lista nunca tuvo: «recargá» once veces, «pegá», «preguntá», «esperá»,
«apuntá», «mapeá», «borrá», «apagá»… y uno lo había escrito yo mismo en la
v875 —«comprobá esto»— dentro de la lámina que se imprime.

Una lista de palabras prohibidas **solo caza lo que alguien se acordó de
escribir en ella**. Es una guarda que falla ABIERTO, y eso en una guarda no
es aceptable: el coste de un falso positivo es un renglón en una lista, y el
de un falso negativo es la lámina impresa.

Para las terminadas en **-á** la comprobación se dio vuelta: en vez de listar
lo prohibido se lista lo PERMITIDO —los futuros de tercera persona, los
topónimos, y «acá», «está», «quizá»— y se denuncia todo lo demás. Un
imperativo voseante nuevo sale denunciado solo; un futuro nuevo cuesta un
renglón y se ve en rojo hasta que alguien lo agregue.

#### La regla estructural que parecía buena y era falsa

Primero intenté deducirlo en vez de listarlo: «el futuro es el infinitivo MÁS
á —aparecerá = aparecer + á—, así que quitándole la tilde queda algo acabado
en -ar, -er o -ir». Es **falsa para los verbos cuya raíz termina en r**:
«esperá» deja «esper», que acaba en «er», y se leía como futuro. Lo mismo
mirá, pará, tirá, generá.

Lo cazó la prueba de respuesta conocida antes de que entrara, y por eso esos
cuatro están ahora DENTRO del caso de prueba: para que la idea no vuelva a
parecer buena.

#### Con -é y con -í no se puede, y decirlo importa más que tenerlo

«Asistí a uno» es el nombre de un logro en `js/16` —pretérito de primera
persona, perfectamente correcto— y «salí a un sitio abierto» en `js/20` es
voseo. La misma forma, sentidos opuestos, y ninguna regla las separa sin un
diccionario. Esas siguen una por una en la lista, y la lista dice por qué.

### §19 · qué se pide, ante quién, y cuánto tarda

Los paneles de vacío obligatorio terminaban en la ausencia: «sin dato
oficial», qué haría falta, y por qué lo que hay no es eso. Todo cierto y todo
inútil para quien tiene que ir a buscarlo. **Nombrar el documento y callar el
trámite convierte un vacío en un muro**; con el trámite escrito es una tarea
de una tarde.

Cada uno cierra ahora con seis renglones —qué se pide, ante quién, cómo se
radica, qué hay que llevar, cuánto tarda y qué se puede usar mientras llega—
en **verde y no en ámbar**: el ámbar de arriba dice «esto no lo tenemos» y
esto dice «así se consigue». Dos cosas distintas con el mismo color se leen
como una sola, y la segunda es la única del panel sobre la que alguien puede
actuar.

El «mientras llega» **no es un permiso para suponer**: es un sustituto
declarado con su límite escrito al lado —«la altura construida alrededor, que
es una cota medida de lo que cabe y NO lo que la norma permite»—. La suite
comprueba justamente eso: que ninguno nombre el sustituto a secas.

#### Servicios públicos sale de la lista, y no hizo falta código nuevo

El pliego lo pide con esas palabras —«el panel de servicios públicos ya se
puede llenar»— y tiene razón: es la **misma capa del censo por manzana** que
el módulo ya consulta para población y escolaridad.

Entra como un bloque más de `BLOQUES_CENSO` y **no como una consulta aparte**,
así que hereda los tres estados de la v865 sin volver a escribirlos: si la
capa lo trae, se cuenta con el nombre del campo al lado; si no lo expone, se
declara CON la lista de campos como prueba; si no se pudo preguntar, se dice
que eso no es lo mismo que no tenerlo. Escribir un `serviciosDelCenso` aparte
—que fue lo primero que hice— habría sido una segunda copia de una honestidad
que ya existía, y dos copias de una advertencia se separan.

Quedan **cuatro** vacíos obligatorios, no cinco.

Y una del reparto: el bloque se descuenta de «Lo que el censo trae además»,
porque el mismo cuadro impreso dos veces en la misma lámina es la repetición
que el pliego prohíbe.

### §10 · el potencial deja de estar vacío

El panel cerraba en «sin dato oficial» dos veces —altura construida y altura
permitida—. La norma no se consigue sin radicarla, pero **lo construido SÍ
está medido**, y es lo que un jurado puede discutir.

La media sola no lo cuenta: con la mayoría en un piso y unas torres sueltas,
«1,8 pisos de media» describe un sector que no existe. Van la **moda** —cómo
es la mayoría—, la **mediana** —por dónde parte el sector en dos—, el reparto
entero con sus porcentajes, y qué parte del sector no tiene altura
registrada. Las tres salen de los mismos cuatro cajones, así que **se dicen
como cajones y no como cifras exactas**: llamar «4» a la mediana de un sector
con torres de doce sería inventar precisión sobre una caja.

Y la frase que el pliego pide literal, **antes del vacío y no después**: una
advertencia que llega después del hueco llega tarde.

> Esto es lo que hay construido, no lo que la norma permite. La altura
> permitida la define la ficha normativa del POT y se solicita en la curaduría
> urbana.

### El sector de prueba no podía demostrar nada de esto

Quinta vez (v862, v866, v874, v877, y esta). Los treinta edificios tenían
`3 + (i % 5)` pisos, así que **todos caían en los dos cajones de arriba**: la
moda y la mediana daban lo mismo que la media y el panel pasaba en verde sin
enseñar para qué existe. Ahora se reparten como en la corrida real —casi seis
de cada diez de un piso, y tres torres—, y sale media 1,8 contra moda «1
nivel» y máximo 9, que es exactamente la diferencia que el pliego manda
imprimir. Una aserción fija ese reparto para que no vuelva a degenerar.

Lo mismo con el censo: el doble trae ahora cuatro campos de servicios —tres
con alias y **uno sin**, como vienen muchos de verdad— y sigue sin traer
hogares, así que una sola corrida recorre los dos caminos: el que cuenta y el
que declara la ausencia con la lista de campos como prueba.

### Dos lecturas mías equivocadas, las dos por medir mal

* **`todo en verde` no era verde.** Grepeé la salida de la suite por
  `✗|todo en verde|fallaron`, no salió nada, y lo leí como que había pasado.
  No: la suite había reventado con un `ReferenceError` y no imprimió ninguna
  de las tres cosas. **Una salida vacía no es una salida buena**, y una
  comprobación que busca señales de fallo tiene que buscar también la señal
  de éxito, o el silencio se lee como aprobación.
* **`echo $?` después de un `| tail` mide el `tail`.** Estuve a punto de
  «arreglar» `correr.js` creyendo que daba por buena una suite reventada.
  Corriéndola sin tubería sale 1, que es lo correcto y lo que el `catch` del
  final ya hacía. Es la regla de la v863 aplicada al arnés: **una sospecha se
  comprueba corriendo, no leyendo.**

## Los anillos, de ancho constante y medidos en densidad (v881)

§14 del pliego de ajustes. Los cortes del motor eran fijos:

```js
const CORTES = [0, 200, 400, 700, Math.max(701, radioM)];
```

Cuatro anchos distintos —200, 200, 300 y lo que sobre—, y el último se come el
resto: con 2.500 m de radio mide 1.800 m. Impreso salía «400–700 m: 6 usos ·
700–2.500 m: 2.637», que **no dice nada del sector**: dice que un anillo tiene
veinticinco veces el área del otro.

### Contar anillos es comparar áreas, no sectores

Un anillo de r1 a r2 tiene área π(r2²−r1²). Aun con el ancho constante, el
área **crece hacia afuera**: el anillo de 200 a 400 m tiene el triple que el
de 0 a 200. Así que el conteo sube solo, siempre, en cualquier sector, y leerlo
como «hacia afuera hay más actividad» es leer la geometría del anillo.

Lo único comparable entre dos anillos es la **densidad**. En el sector de
prueba la inversión sale sola y por eso es la aserción que manda:

| Anillo | Usos | Por hectárea |
|---|---|---|
| hasta 200 m | 76 | **6,0** |
| 200–400 m | 105 | 2,8 |
| 400–750 m | 63 | 0,5 |

**Contando, afuera hay más; midiendo, adentro hay el doble.** Hasta la v880 la
barra más larga era la del segundo anillo — el que menos densidad tiene de los
dos primeros.

### El paso se elige, y se dice

`PASOS = [200, 250, 500, 1000]`: el primero que deje ocho anillos o menos. Un
sector de 750 m sale de 200 en 200; uno de 8 km, de 1.000. Va **impreso**
—«Anillos de 200 m desde el centro»—, porque con el paso escrito dos láminas
de radios distintos se pueden comparar y sin él no.

### Un anillo flaco se junta con el siguiente, y lo dice

Por debajo de **20 usos** un anillo no mide densidad, mide ruido: tres usos en
una corona de 200 m dan una cifra que cambia de golpe si aparece un cuarto. Se
junta con el que sigue y el resultado **lleva la marca `agrupado`** y la razón
al pie. El último se pliega hacia **atrás**, porque no tiene siguiente — sin
eso, un sector cuyo borde queda flaco imprimía un anillo de dos usos.

Por eso la comprobación del ancho constante dice «salvo los que se agruparon»:
un agrupado mide dos pasos y eso es correcto, no una excepción a la regla.

### Agrupar no puede comerse el panel

Lo cazó `tmasanalisis` y es el hallazgo que más vale de la tanda. Su sector
tiene **47 usos**, así que con el paso de 200 m *todos* los anillos quedaban
por debajo de veinte y la agrupación los fundía en **uno solo**. Los dos
consumidores del dato —la sección del informe en hojas y el mapa de anillos—
piden dos anillos para existir, así que el panel **desaparecía de la hoja
entera**.

**Perder el panel es peor que el anillo ruidoso que la agrupación viene a
evitar.** Es la misma decisión de la v875 con la necesidad topada: no se
arregla una exageración con una mentira más pequeña, ni un ruido con un
silencio.

Así que el paso **se elige por el radio y por los datos**: se prueba cada
candidato de menor a mayor y se toma el primero que deje dos anillos o más.
Si ninguno lo deja —un sector con muy poco mapeado—, se parte en dos mitades
y **ahí no se agrupa**, porque agrupar es justamente lo que lo dejó en uno.
Dos anillos de nueve usos cada uno, con su cifra a la vista, se juzgan solos;
un panel ausente no se juzga.

En el sector de `tmasanalisis` sale con paso de 250 m y dos anillos.

**Y la comprobación vive ahí, no en `tdoslaminas`**: aquel sector es rico y
nunca se agruparía entero, así que la aserción habría pasado sin tener nada
que rechazar. Es la lección de la v874 otra vez — el material sobre el que se
mide tiene que poder producir el fallo—, y esta vez no hizo falta empobrecer
un fixture a propósito: ya había uno pobre, en otra suite.

### Dos tropiezos de implementación

* **Una propiedad puesta en el ARRAY desaparece.** `anillos.pasoM = paso` se
  lee perfecto en el motor y `JSON.stringify` de un array **no serializa sus
  propiedades**: llegaba `undefined` al navegador. Los `stats` cruzan
  motor→cliente como JSON, así que lo que tenga que viajar va dentro de cada
  elemento (`x.pasoM`), nunca colgado de la lista. Es primo del tropiezo de
  `Object.assign` de la v877 y del de `R.estado()` de la v871: **las tres son
  escribir en un sitio que no es el que se lee.**
* **El radio equivalente de un polígono no es entero.** Salió impreso
  «400–750.0842418048857 m». Se redondean los bordes a metros enteros **antes**
  de calcular el área, para que la etiqueta y la densidad hablen del mismo
  anillo.

Y una de nombres: `const paso` ya existía en ese ámbito de `motor-reglas.js`,
sesenta líneas más arriba. Obliga a `node construir.js` y a **reiniciar el
servidor**.

### Demostrado contra la v880

Seis aserciones en rojo, con el texto viejo impreso: anchos `200 · 200 · 300`
sin agrupar, ninguna densidad en la etiqueta, sin paso declarado, sin
conclusión — y **la barra al 100 % en el segundo anillo**, el de 105 usos,
mientras el primero tiene más del doble de densidad.

Para demostrarlo hay que devolver **las dos mitades**: el `git stash` de
`js/68` no toca `motor-reglas.js`, que vive en el otro repositorio, así que sin
deshacer también allá —y sin `node construir.js` y reiniciar— se mide la hoja
vieja contra el motor nuevo, que no es ninguna de las dos versiones.

Y una de las pruebas: la aserción de que la barra más larga es la del anillo
más denso tiene que **mirar la barra**. El lector de paneles sacaba solo el
`textContent`, así que midiendo por el texto la comprobación habría pasado
igual con las barras dibujadas por conteo. `anchoBarras` lee el ancho del `<u>`
de cada una.

## La banda ambiental cierra en decisión de proyecto (v882)

§12 del pliego de ajustes: «quedó a medias». Antes de escribir nada se
auditó qué había de verdad, que es la regla de la v863 y de la v879 —una
sospecha sobre datos se comprueba leyendo el código, no recordándolo—, y de
las cinco cosas que pedía, **una estaba, una a medias y tres no**:

| §12 pide | Lo que había |
|---|---|
| Carta solar con solsticios y equinoccios | La carta estaba, con los dos solsticios y **sin equinoccio** |
| Orientación de fachadas derivada de la carta | Una **frase fija** en la caja: «la fachada occidental… es la que hay que proteger» |
| Radiación y horas de sol por orientación | Nada, en ninguna parte |
| Sombra de la altura predominante medida, dos horas | Dos estudios de sombra, y ninguno servía (ver abajo) |
| Vientos cerrando en estrategia de ventilación | La rosa dibujada y una pista de un renglón |

### En el trópico la fachada que más horas suma no es la que más recibe

Es el hallazgo del que sale toda la tabla. `porOrientacion` en `js/73` recorre
el año —un día de cada cinco, cada quince minutos— y para cada uno de los ocho
rumbos suma dos cosas **distintas**: las horas con el sol por delante del plano
vertical, y el coseno del ángulo de incidencia, que es cuánta energía le llega.
A 7,9° de latitud da esto:

| Orientación | Horas al año | Directo |
|---|---|---|
| Norte | 1.970 | 30 |
| **Oriente** | 2.204 | **100** |
| **Sur** | **2.413** | 53 |
| Occidente | 2.179 | 99 |

**El sur suma más horas que ninguna y recibe la mitad**: cuando el sol está al
sur, acá está alto, y roza el plano vertical. Las que se calientan son la
oriental y la occidental. Es exactamente lo contrario de lo que dice un manual
europeo, y es la razón de imprimir la tabla en vez de una regla aprendida.

Dos comprobaciones de respuesta conocida antes de conectarlo: que oriente y
occidente salgan iguales por simetría (2.204 y 2.179 h, 100 y 99 — la
diferencia es del muestreo y va declarada), y que las horas de luz del año den
4.383, o sea 12,01 h al día, que es lo que le toca al trópico.

#### Una etiqueta que decía «la que más» y no decía de qué

La primera versión marcaba la fila del oriente con «la que más». En la misma
fila hay dos columnas, y el sur gana una y pierde la otra: un «la que más» a
secas se lee sobre la columna que el ojo tenga más cerca. Dice ahora **«más
directo»** y **«más horas»**, cada una sobre la suya. Es la clase de defecto de
la v874 —una cifra correcta dicha de una manera que no se puede leer— y salió
mirando el papel impreso, no el código.

### La radiación medida era un campo más de la consulta que ya se hacía

`shortwave_radiation_sum` viene del **mismo** archivo de Open-Meteo del que ya
salen la temperatura, la lluvia y el viento: un campo más en la misma petición,
sin una consulta aparte. Es el patrón de la v876 con el censo por municipio.

Se publica **al lado** de las horas por orientación y **no multiplicada por
ellas**: la radiación es global horizontal con las nubes de cinco años dentro,
y la geometría es el sol sin nubes. El producto se leería como si las dos
fueran medidas. Para kWh/m² sobre una fachada orientada hace falta una serie
**horaria** con su reparto directo/difuso —el atlas del IDEAM o un año
meteorológico tipo—, y eso va escrito en la hoja.

#### La clave del caché lleva versión de campos

`'clima|…|r1'`. Sin ese sufijo, un teléfono con el clima ya guardado habría
seguido sirviendo la respuesta vieja —sin radiación— durante toda la vida del
caché, y el panel nuevo habría dicho «no se pudo medir» justo a quien acababa
de actualizar. **Un campo nuevo en una consulta cacheada sube ese número.**

### La recomendación de fachada se deduce; la frase fija se imprimía igual en Bogotá

La caja cerraba en una sola frase escrita a mano. En Cúcuta es cierta; en otra
latitud se imprimía igual, sin haberla comprobado — la misma forma de las
cuatro carencias falsas de la v861 a la v864, dicha como afirmación en vez de
como negación. Ahora sale de `fachadaCritica` y de la tabla: qué orientación
recibe más, cuál menos, si manda la fachada o la cubierta, y **por qué el
occidente se protege primero aunque reciba lo mismo que el oriente** —le llega
a la tarde, con el aire ya caliente—, que es lo único de ahí que no lo dice la
geometría.

Lo mismo con la línea de decisión de la banda (`DECIDE`), que mandaba «los
espacios de estar al norte y al sur» de memoria.

#### Las tres lecturas salen de UNA cuenta memoizada

`orientacionDelSitio()` guarda el resultado y lo leen la tabla, la estrategia
de ventilación y la línea de decisión. No es solo ahorro —recorrer el año son
miles de posiciones de sol—: es lo que impide que la tabla diga que la
orientación menos expuesta es una y el pie de la banda mande los dormitorios a
otra, que es el fallo que la v879 persiguió entre las dos láminas.

**Se memoiza por COORDENADA.** La primera versión guardaba en `S.solOri` a
secas y leía `S.meta`, que al componer la lámina puede no estar puesto todavía:
la caja imprimió la carta solar y **nada debajo**, sin un solo error. Se vio
mirando el papel.

### El módulo tenía dos estudios de sombra y ninguno servía para esto

El de los **vecinos** pide un lote dibujado y las huellas medidas; el del
**volumen permitido** parte de una norma que no se tiene. Los dos hablan de un
proyecto. §12 pide el del **sector**: qué sombra echa la altura que el sector
ya demuestra.

`sombraDeLoConstruido` la calcula a las 9 y a las 15 —las dos horas que deciden
una calle; al mediodía la sombra es la más corta del día y no limita nada— y la
altura es la **moda** del reparto de la v880, no la media: con seis de cada diez
edificios de un piso y tres torres, la media describe un sector que no existe y
su sombra tampoco.

Y cierra **cruzándola con la calzada medida**: 3,4 m de sombra sobre 7,4 m de
calzada no alcanza la otra acera, así que la sombra del peatón hay que ponerla
con árboles porque el volumen no la da. Si la cruzara, la frase es la otra —la
planta baja de enfrente no ve el sol, que para vivienda es un problema y para
un andén comercial en clima cálido es lo que se busca—. **Las dos son ciertas y
la hoja no elige**: dice cuál es el caso y quién decide.

### El conflicto entre ventilar y protegerse del sol, dicho

La rosa de vientos cerraba en «el pétalo largo es el rumbo que ventila». Ahora
dice por dónde **entra** el aire, por dónde **sale** —una abertura sola no
ventila, ventila el par—, cómo se dimensionan con la temperatura medida, y qué
hacer cuando el viento es flojo.

Y lo que de verdad hacía falta: **cuando el aire entra justo por donde más pega
el sol, la hoja lo nombra**. Abrir para ventilar es abrir al sol, y eso pide
protección que deje pasar el aire y no la luz. Que lo descubra quien dibuja no
es una opción. El aviso **no sale cuando no hay conflicto** —si no, sería un
adorno— y hay una aserción para cada una de las dos ramas.

### Cuatro curvas del mismo gris sin decir cuál es cuál

La carta solar dibujaba hoy, el solsticio alto y el bajo, las dos últimas del
mismo gris a trazos y **sin leyenda**. Se veía que el sol se mueve entre dos
extremos y no cuál de los dos era junio. **De un dibujo del que no se sabe qué
curva es cuál no sale una fachada**, y decidir una fachada es para lo que
existe.

Lleva ahora el **equinoccio** —el caso medio, el único que sale exacto por el
oriente en cualquier latitud, y el que un estudiante calca— y una leyenda al
pie con las cuatro curvas y su fecha. La leyenda va **dentro del propio SVG**:
como texto de al lado, una lámina que encoge el dibujo la dejaría a otra escala
y el informe en hojas la separaría al partir la página.

### El sector de prueba, otra vez más pobre que uno real

Sexta vez (v862, v866, v874, v877, v880, y esta). El clima que `tdoslaminas`
inyecta traía `viento: {}` — sin rosa, sin dominante, sin velocidad — y ninguna
radiación. **La estrategia de ventilación y la radiación no se habrían
ejercitado en ninguna prueba**: el panel pasaba en verde por no tener nada que
decir.

Ahora trae la rosa de los ocho rumbos, el viento medio y la radiación. Y como
las ramas dicen cosas opuestas y una sola corrida no puede enseñar las dos, se
componen **tres** hojas A: la normal —viento del norte, que no choca con el
sol—, la del **choque** —viento del oriente y flojo— y la que viene **sin
radiación**, que es lo que pasa cuando el archivo no la trae en un punto.

### El fallo que no era de la hoja: un medidor que divide por la pista equivocada

Al entrar la caja nueva, `tpliegogrande` denunció que la banda ambiental
dejaba **«9 huecos en 2 renglones»**. Parecía una consecuencia de layout de
la caja nueva y no lo era.

`ocupa` contaba los renglones de cada caja **dividiendo su alto por el de la
PRIMERA pista**. Los renglones de una banda casi nunca miden lo mismo: en la
ambiental acostada son **1.417 px y 533**. Una caja que pisa los dos mide
1.964, y 1.964 ÷ 1.430 da 1,38, que redondea a **uno**. La banda ocupaba 17
de 20 celdas y la cuenta decía 11; con las siete cajas decía 15 de 24 cuando
eran **23 de 24, un hueco**.

Es la lección de la v854 —medir lo que la grilla hizo, no lo que se le
pidió— con un paso más que faltaba: **las pistas tampoco son todas iguales.**
Se cuentan ahora las pistas que la caja PISA de verdad, con sus alturas
reales, sus huecos y el factor de escala de la hoja.

**Y la parte que más cuesta contar:** creyendo el fallo, moví «La sombra de
los vecinos» a la banda del lote para descargar la ambiental. Con el medidor
arreglado, las siete cajas pasan con un hueco: **la mudanza no hacía falta y
se deshizo.** Un arreglo estructural hecho para callar una comprobación es un
arreglo sin causa, y el día que alguien busque por qué se movió no va a
encontrar ninguna.

Lo que sí quedó de esa vuelta es un hallazgo de verdad y aparte: **«La sombra
de los vecinos» declaraba escala `sector` y mide «% DEL LOTE en sombra»**, y
necesita un lote dibujado para existir. Es `predio`, y está corregido. Las
bandas agrupan por TEMA y no por escala —«El clima», que es de ciudad, vive
en la ambiental—, así que la banda nunca iba a desmentir el rótulo: por eso
cada panel tiene que declararlo por su cuenta.

#### La guarda del medidor, y por qué la primera no servía

La primera versión exigía que alguna banda de dos renglones tuviera
`ocupa > cols`. **Pasaba en verde con el medidor roto** —15 > 12—, así que no
guardaba nada: exactamente el verde que este proyecto lleva cinco tandas
persiguiendo.

La que quedó mide la causa y no un síntoma: una banda compuesta a dos
renglones y con un mapa **tiene** que reportar una caja que pisa los dos,
porque el CSS se lo da (`.bcuerpo.dos .mapa-caja{grid-row:span 2}`). Si
ninguna lo pisa, el recuento está roto otra vez y lo que diga esta sección no
vale. Y falla también si no hay ninguna banda así, que es el caso en que la
guarda se quedaría sin material.

Demostrada devolviendo la división vieja: sale «pisa 1» donde la caja pisa
dos.

### Demostrado contra la v881

Diecinueve aserciones en rojo de veinte, con el texto viejo impreso: «no lo
trae» por el equinoccio, «sin leyenda», «sin tabla», «no está» por la
radiación y por la sombra del sector, «la rosa se queda sola» y «lo calla» por
el conflicto.

La vigésima **no** falla, y es a propósito: que el conflicto no se imprima
cuando no lo hay era cierto antes y tiene que seguir siéndolo. Es una guarda
contra pasarse de avisar, no una afirmación nueva — igual que las dos de la
v879.

Como en la v881, hay que devolver **las dos mitades**: el `git stash` de los
tres archivos de `js/` no toca `motor-reglas.js`, que vive en el otro
repositorio.

## Seis plantillas para volver con números de la calle (v883)

§18 del pliego de ajustes: «la banda anuncia que trae tres paneles para
llenar a mano y se pidieron seis». Auditado antes de escribir, el reclamo era
más de fondo que un conteo: **los tres que había son de PERCEPCIÓN** —qué se
sintió, qué permanece, qué dice quien vive ahí— y los seis que pide el pliego
son de otra clase, **formularios de medición** con su cuadrícula y sus
casillas rotuladas.

Las seis, con su columna rotulada y su instrumento:

| Plantilla | Con qué | Dónde se pega |
|---|---|---|
| Conteo de alturas por manzana | a ojo desde la acera de enfrente | «Potencial edificatorio» y el mapa de alturas |
| Perfil vial acotado | cinta de 30 m, dos personas | «Cómo se mueve el sector», que hoy solo tiene la calzada |
| Estado de andenes por tramo | cinta y la vista, caminando | «Movilidad real», que hoy se declara sin dato oficial |
| Rutas observadas y su frecuencia | reloj, media hora en la parada | la frecuencia, que OpenStreetMap nunca lleva |
| Cupo real de equipamientos | la pregunta, en portería | «Quién queda por fuera» |
| Actividad en primer piso | cinta o pasos calibrados | «Continuidad del paramento» |

### «Dónde se pega» es lo que la separa de un anexo

Es el campo que hace el trabajo. Una plantilla que se llena, se archiva y no
cambia ningún panel es un anexo, y el pliego pidió lo contrario —«integrados,
no como anexo», con las mismas palabras de la v848—. Con el destino escrito
en la misma lámina, cada salida a la calle tiene a dónde llegar.

Va destacado y en verde, aparte de las otras tres instrucciones: es la misma
decisión de la v880 con «cómo se consigue», donde el ámbar dice «esto no lo
tenemos» y el verde dice «así se consigue».

### Una plantilla en blanco no mide nada

**Tres de las seis levantan justo lo que la hoja declara faltando** —la
frecuencia de las rutas, el perfil acotado, el cupo—, y ahí está el riesgo:
es fácil leer el formulario como si la carencia ya estuviera resuelta. No lo
está. El formulario es el camino, no el dato.

Por eso la conclusión de la banda lo dice entero, y la suite lo persigue en
las **dos** direcciones: que la advertencia esté, **y que la carencia de
frecuencia siga declarada en la hoja**. Si una tanda futura confundiera el
formulario con la medición y borrara la carencia, esa aserción se pone roja.

Lo mismo en la lista viva: los renglones del perfil acotado y de la frecuencia
**se quedan**, y su cláusula `ya:` nombra la plantilla diciendo qué es. Un
renglón que no la nombrara haría que la sesión siguiente la escribiera otra
vez; uno que la contara como medición sería la mentira de la v861.

### Banda propia, porque son otra pregunta

La banda de campo tenía ocho cajas —tres de percepción, los cuatro vacíos y
lo levantado—; con seis más serían catorce. Pero el motivo no es el cupo: los
de percepción dicen **qué se sintió** y estos dicen **qué hay que ir a
medir**. Es la misma separación que hizo la v853 con «riesgo y servicios», y
esta vez el contenido la justifica —a diferencia de la mudanza que la v882
deshizo, que la justificaba un medidor roto.

La banda nueva es «Qué medir en la calle», en la lámina B.

### La nota de desarrollo que salía impresa (§20)

El `default:` de `conclusionDeBanda` devolvía **«Mediciones que todavía no
tienen banda propia»**, y eso se imprimía en el pliego real. Es una nota que
le habla a quien programa, no a quien lee una hoja colgada en una pared.

Y no era un caso aislado esperando: **una banda nueva sin `case` propio cae
en ese `default`**, así que la banda de esta misma tanda la habría impreso.
El texto dice ahora lo que un lector necesita saber de la bolsa de «Otras
mediciones» —que van juntas para no perderse, no por tema, y que cada una
trae su método y su escala—, y hay una aserción de clase: ninguna hoja puede
imprimir la conclusión de emergencia.

### La comprobación se hizo más precisa, no más laxa

`tlaminaedu` exigía de todo panel de campo una instrucción en `.lee` y
casillas `.cf` o renglones. Una plantilla no tiene ninguna de las tres: tiene
cuatro etiquetas de instrucción y una cuadrícula. Aflojar la aserción para
que pasara habría sido perder la prueba entera.

Se partió en dos, y cada clase responde por lo suyo: **los de percepción**
por su instrucción en prosa y su sitio para escribir; **las plantillas** por
sus cuatro etiquetas, su «dónde se pega», sus columnas rotuladas y sus celdas
en blanco —de 40 a 50 por plantilla, contadas vacías—. Es más de lo que se
pedía antes, no menos.

### Demostrado contra la v882

Nueve aserciones en rojo de once, con «no lo dice» por el destino, «0» por
las columnas y «sin banda». Dos pasan a propósito y son guardas, no
afirmaciones nuevas: que la carencia de frecuencia siga declarada —cierto
antes y que tiene que seguir siéndolo— y que ninguna banda cierre con la
conclusión de emergencia.

Y la décima, la de la nota de desarrollo, **falló contra la v882**: confirma
que el pliego la venía imprimiendo.

## El suelo disponible, en cascada (v884)

§11 del pliego de ajustes: «reportó 95,5 % libre y 1.875 ha brutas,
incluyendo vías, rondas y pendientes imposibles. No sirve así». Pedía la
cascada con los tres descuentos y los tres números a la vista.

En el sector de prueba sale:

```
Suelo sin construir                              1,60 km²
  − Lámina de agua                                5,3 ha
  − Franja de 30 m a lado y lado de los cauces    7,4 ha
  − Superficie de vía existente                  17,3 ha
= Aprovechable estimado                          1,31 km²
```

Y cada resta dice de dónde sale —«1.233 m de cauce en 1 tramo mapeado»,
«23.264 m de calzada a 7,4 m de ancho medio»—, que es lo que permite
discutir el número en vez de creerlo. Un solo «95,5 % libre» no se puede
discutir; cuatro renglones con su procedencia, sí.

### Dos descuentos que el panel declaraba imposibles y no lo eran

La quinta declaración de ausencia falsa de este módulo, y las dos se
encontraron leyendo el código en vez de recordarlo:

* **La pendiente.** El panel decía «una media no dice cuánta superficie pasa
  del umbral: haría falta el modelo de elevación por celda». **El modelo por
  celda está**: `analizarTerreno` clasifica nodo por nodo con diferencias
  centradas y devuelve `pendiente.clases` con el porcentaje de cada una. Lo
  que falta es el umbral del POT, que es otra cosa y se dice aparte.
* **La franja hídrica.** Decía que solo estaba la lámina de agua del
  satélite. La consulta del trazado pide `way["waterway"]` con **`out
  geom`**, así que el RECORRIDO de los cauces llega, y de un recorrido sale
  una franja. El motor suma ahora los tramos que caen dentro del área —por
  el punto medio de cada segmento, igual que las vías— y publica
  `trazado.suelo`.

Lo que de verdad no se puede es **fijar el ancho de la ronda**: eso lo define
el POMCA. Los 30 m son una estimación de trabajo y la hoja lo dice con esas
palabras, que es lo que el pliego pide casi literal.

### Tres cosas del método, y las tres van impresas porque cambian el resultado

* **Los descuentos se aplican sobre lo que queda, en proporción.** Restarle
  al suelo libre el porcentaje de ladera del SECTOR supone que la pendiente
  se reparte igual dentro y fuera de lo construido. Es un supuesto.
* **Los tres pueden solaparse**: una vía junto a una quebrada en ladera se
  descuenta tres veces. Así que esto **resta de más y no de menos** — el
  aprovechable real es igual o mayor—, y así se nombra.
* **El umbral de pendiente es el de esta herramienta, 30 %**, que es donde
  `CLASES_PENDIENTE` deja de llamarla urbanizable. No es el del POT y va
  dicho.

### Una cascada a la que le falta una resta parece completa

Sin terreno medido no hay con qué descontar la pendiente, y la primera
versión simplemente **omitía el renglón**. El lector no tiene cómo saber que
ahí había una resta: una cascada sin huecos se lee como completa. Ahora se
declara, con el arreglo al lado —se mide con el botón del terreno y el
descuento entra solo—. Es la misma regla de toda la lámina dicha en un sitio
nuevo: un vacío se declara, no se calla.

### El cruce del cierre volvió a divergir, y la v879 lo había predicho

El cruce de la lámina B hacía **la misma resta copiada** del panel —«el suelo
sin construir menos el agua»—, y en cuanto el panel aprendió a descontar tres
cosas más, las dos hojas imprimieron dos hectáreas distintas bajo el mismo
nombre. Es exactamente el fallo que la v879 arregló, reaparecido una tanda
después.

Y es literalmente lo que aquella sección dejó escrito: **«dos rutas de
cálculo para la misma cantidad no divergen el día que se escriben, divergen
la tanda siguiente, cuando una de las dos mejora.»** Ahora el cierre llama a
`cascadaDeSuelo`, la misma función.

De paso, el ancla del chequeo cruzado: leía el rótulo del KPI «suelo libre
contado», que pasó a «aprovechable estimado». Se aceptan los dos, porque una
ficha guardada antes lleva el viejo y su lámina se vuelve a componer con este
código — la misma razón por la que la v878 aceptó el id viejo de una caja
renombrada.

### El sector de prueba no tenía ni una quebrada

Séptima vez (v862, v866, v874, v877, v880, v882, y esta). El fixture no traía
un solo `waterway`, así que el descuento de la franja **no se ejercitaba en
ninguna prueba**: el panel habría pasado en verde declarando «no hay ningún
cauce mapeado», que es la otra rama y la que ya cubre `tsinmapear`. Ahora
cruza una quebrada con su recorrido —no un punto: de un punto no sale una
franja—.

Y el terreno **no se inyecta con el botón**. Medirlo tarda casi medio minuto
—`tterreno` le da hasta 28 s— y cargárselo a una suite que es de las dos
láminas sería pagarlo en cada corrida de la batería. Se inyecta por opciones,
igual que el clima desde la v882, y se componen las **dos ramas**: con
pendiente fuerte medida y sin terreno medido. Cada una se comprueba por lo
que tiene que decir, que es lo que una sola corrida no puede enseñar.

### Demostrado contra la v883

Once aserciones en rojo, con el texto viejo impreso: «sin cascada», «no
está» por la franja y por la vía, «no lo declara» por la ronda, «no los
dice» por los supuestos, y las dos carencias falsas —«La ronda hídrica.
Haría falta el acuerdo…» y «La pendiente no urbanizable y la amenaza»—
todavía escritas como imposibles.

## Quién firma la lámina, y qué se lee a tres metros (v885)

§1 y §2 del pliego de ajustes, que son la misma cosa vista desde dos lados:
una hoja de 60 × 90 colgada en una pared se lee por capas —a tres metros, a
un metro, a treinta centímetros— y hasta la v884 la cabecera tenía puesto en
la franja de los tres metros lo que solo sirve a treinta.

### Los tres datos de identificación, y el hueco que se imprime

Al nombre del sector se le suman el **nombre del proyecto** y la **ubicación
administrativa**. Los tres se rellenan con lo que el geocodificador sepa —el
barrio, y comuna/municipio/departamento— y se corrigen a mano; el proyecto no
tiene de dónde caer, así que es el que de verdad puede quedar vacío.

**Un campo vacío se imprime.** Sale «SIN NOMBRAR» en rojo y en su propio
elemento, no en blanco. Es lo contrario de lo que hace un formulario, y a
propósito: en blanco, una lámina sin nombre de proyecto se ve igual que una
que no lo necesita, y sobre la pared de un salón nadie sabe cuál de las dos
es. El hueco tiene que verse para que alguien lo llene.

Los tres viajan a tres sitios: la cabecera de las dos láminas, **el nombre
del archivo exportado** —`URBIS-lamina-<proyecto>-<sector>-<fecha>-60x90.pdf`,
con `sin-nombrar` donde falte: veinte PDF en la carpeta de descargas de un
profesor se distinguen por ahí y por nada más— y **la ficha guardada**, que
si no los perdiera y reabrirla para reimprimir daría «SIN NOMBRAR» sobre un
trabajo que sí estaba nombrado.

El nombre del archivo lo arma **una sola función** para los dos caminos, el
de la lámina viva y el de una ficha archivada. Es la regla de la v879: dos
maneras de armar la misma cadena no divergen el día que se escriben, divergen
la tanda siguiente.

### La cabecera, por capas de distancia

De arriba abajo, y el orden es el que pide §2: el **sector** en la tipografía
mayor de la hoja (13 mm), su **ubicación administrativa** debajo, el
**proyecto** con qué lámina es, **una** cifra grande que resuma la hoja
(8,4 mm) y la **pregunta** que la abre.

La cifra es distinta en cada lámina y tiene que serlo: la A responde por el
sitio y el terreno —cuánto mide, qué pendiente tiene—, la B por la gente
—cuántos son, qué tan apretados—. Si las dos imprimieran la misma, dejaría de
resumir la lámina y pasaría a ser un membrete. Y **no se inventa cuando
falta**: sin terreno medido, la A dice el área y calla la pendiente.

Bajan al pie, en cuerpo pequeño (2,6 mm) y en tres columnas: la regla de
neutralidad, el «cómo se lee» y el alcance con su fecha de corte. **No se
borran** —la neutralidad es la regla que un estudiante rompe sin darse
cuenta— pero ninguno de los tres se lee a tres metros y los tres ocupaban la
franja que sí.

La jerarquía se comprueba **en milímetros de papel**, no en el orden del
HTML: el orden dice qué va antes, el tamaño dice a qué distancia se lee, y es
el segundo el que §2 pide. Y las dos aserciones del pie miran **en qué mitad
de la hoja** está cada párrafo, no solo que esté: «bajó» no es lo mismo que
«está».

### Dos cifras correctas que no se podían leer

Salieron al poner la cifra que resume la lámina: el resumen de la A imprimía
**«1.77 km²»**, que en castellano se lee como un punto de MILES. Es la clase
de defecto de la v874 —una cifra correcta dicha de una manera que no se puede
leer— y estaba a dos renglones de `formatearLargo`, que hace la sustitución
desde siempre. Con ella cayeron `fmtArea` de `js/24` y de `js/49`, y de la
misma frase de `js/78` salió la otra mitad: **«Meter 20881 personas»**, sin
separador de miles, que se cuenta con el dedo.

Las dos comprobaciones **persiguen la clase**, no el caso: en toda la hoja,
ninguna área con punto decimal y ninguna cifra de cinco dígitos sin separar.
Los dos patrones están acotados para no confundir las dos maneras de escribir
un número que conviven en la hoja (v879): el decimal pide una o dos cifras
detrás del punto, porque un separador de miles siempre trae tres; el de miles
empieza en cinco dígitos, porque por debajo caben los años, los números de
decreto y las coordenadas, que se escriben seguidos a propósito.

#### `textContent` pega lo de dos elementos vecinos

La primera versión de la comprobación de miles denunció «100100», «110500» y
«168321», y **ninguno estaba impreso**: eran un «100» y un «100» de dos cajas
contiguas que `h.textContent` junta sin nada en medio. Las comprobaciones
sobre cómo se ESCRIBE un número van sobre los nodos de texto uno por uno, no
sobre la tira de la hoja entera. Es la lección de la v874 con `.hit` —buscar
dentro de la caja— dicha para el texto: pegar dos cifras fabrica una tercera
que nadie escribió.

### Una función declarada dos veces, y nadie mirando

El hallazgo caro de la tanda, y no era de la lámina. Al conectar el nombre del
archivo apareció que `js/68` tenía **`bajarPliegoDeFicha` y `abrirImpresion`
declaradas dos veces**, letra por letra, con `marcaURBIS` metida en medio: un
trozo pegado dos veces. No da error en ninguna parte —la segunda pisa a la
primera— y lo que se lee arriba no es lo que corre.

Buscándolo en los demás archivos salieron **dos más, y las dos con cuerpos
DISTINTOS**:

* `bloqueOportunidad` en `js/63`: ganaba la maquetación nueva —`.tarjeta`,
  `aroXL`— y la vieja —`.bloque`, `gaugeSVG`— llevaba versiones muerta, con
  su propio HTML y su propia redacción. Quien la leyera creería estar leyendo
  el informe de empresas.
* `limpiarRuta` en `js/05`: la que gana llama a `limpiarRutaReal`, que hace lo
  mismo **y más** —limpia la capa, borra los puntos y apaga los botones—, así
  que ahí no había fallo de comportamiento; había código mintiendo sobre sí
  mismo. Comprobado leyendo `window.limpiarRutaReal` antes de borrar nada,
  que es la regla de la v863: borrar la primera copia es un no-op de verdad y
  no una suposición sobre cuál de las dos gana.

La guarda está en `revisar.js` y mira solo el **primer nivel del módulo** —dos
espacios de sangría—. Dentro de una función, dos ayudantes que se llamen igual
en dos ámbitos distintos son legítimos y corrientes —`fila`, `chip`, `pintar`—
y denunciarlos sería pedir que nadie repita un nombre en treinta mil líneas.
En el primer nivel, en cambio, las tres que había eran las tres un defecto.
Demostrada devolviendo los `js/`: los cuatro pares, con archivo y línea.

De paso, dos «Permití las ventanas emergentes» en texto que ve el usuario. Es
exactamente el agujero que la v880 dejó declarado: con **-í** no hay regla que
separe el voseo del pretérito de primera persona —«asistí a uno» es correcto—
y esas van una por una en la lista.

### Dos suites siguieron la mudanza, y las dos se apretaron

`tlaminaedu` buscaba el «cómo se lee» en `.cab`; ahora lo busca en `.pie` **y
exige que no se haya quedado también arriba**. `tpdfpliego` exigía
`URBIS-lamina-La-Playa-90x60.pdf`; ahora exige el proyecto, el sector y la
fecha, y —como su sector no tiene proyecto escrito— que el hueco salga
nombrado como tal en el propio nombre del archivo. Una prueba que falla por un
cambio legítimo se hace más precisa, no más laxa.

### Demostrado contra la v884

Trece aserciones en rojo de dieciséis, con el texto viejo impreso: la
cabecera sin ubicación ni proyecto, «cifra 0 mm», el «cómo se lee» arriba,
«1.77 km²», «20881» y `URBIS-lamina-La-Playa-60x90.pdf` sin proyecto ni
fecha.

Las tres que **no** fallan son a propósito, como las dos de la v879 y la de la
v882: que el `<h1>` siga siendo el nombre del sector, que la pregunta de la
lámina siga impresa, y que con los tres campos escritos no aparezca ningún
«SIN NOMBRAR». Son guardas contra perder lo que ya estaba y contra pasarse de
marcar, no afirmaciones nuevas.

## Los tamaños se comprueban antes de exportar (v886)

§21 del pliego de ajustes, y la única sección cuya respuesta honesta es un
número que no cumple. Pide comprobar contra la hoja de 60 × 90: el mapa
principal de cada banda a 12 cm, los de categoría a 10–11, **ninguno** por
debajo de 8, y «si no cabe a 8 cm, no se imprime».

### Primero medir, que es lo que no existía

Antes de tocar nada se midieron los veinte mapas del pliego de prueba por su
**lado menor** y en milímetros de papel, con la hoja ya compuesta. Eso último
es la mitad del asunto: el mismo mapa que la hoja de estilo tapa a 110 mm sale
impreso a **66** cuando la lámina cierra al 30 %, y es a 66 como se cuelga en
la pared. Es la regla de la v854 —medir lo que la grilla hizo, no lo que se le
pidió— aplicada al papel.

Y por el lado MENOR, no por el alto: un mapa de 18 × 6 cm es una cinta. Ese
detalle cambia el veredicto de nueve mapas.

| | Lado menor medido |
|---|---|
| Movilidad (4 mapas) | 64,9 mm |
| Ambiental: sombras, ruido | 65,4 mm |
| Hitos, comercial, anillos | 75,3 mm |
| Categorías de la banda de forma | 93,9 mm |
| Cobertura, llenos, alturas, sombra | 91 mm |
| Foto y plano | 112 mm |

**Nueve de veinte por debajo de los 8 cm, y ninguno en los 12.**

### Cinco geometrías probadas, y la que se quedó fue ninguna

La parte que vale de esta tanda es la que NO entró. Se midieron cinco
configuraciones contra la batería, no contra la intuición:

| Qué se cambió | Lado menor mínimo | Qué costó |
|---|---|---|
| Suelo de mapa 0,5 → 0,75 | **56,8** mm (peor) | — |
| Mapas a dos columnas | 66 mm | nada |
| Dos columnas + techos a 150 | 90 mm | tres mapas |
| Dos columnas + techos a 138 | 82,8 mm | los paneles de anillos y de hitos |
| Suelo 0,4 + dos columnas | 82,5 mm | la banda de comparación y el censo |

Dos cosas que costaron una vuelta cada una y no se deducen leyendo:

* **Subir el suelo del mapa los hace más CHICOS.** El alto sale de
  `techo / max(k, suelo)` y después todo se reduce por `k`: con la hoja al
  30 %, un suelo de 0,75 da 44 mm donde uno de 0,5 da 66. La intuición
  —«un suelo más alto protege al mapa»— está exactamente al revés.
* **Para los mapas chicos manda el ANCHO, no el alto.** Medían 64,9 × 65,6:
  el ancho es la columna, y la columna sale del reparto de la banda. Por eso
  tocar los techos de alto no movía nada hasta duplicar también el ancho.

La conclusión, medida y no supuesta: **cada milímetro por encima de ~66 cuesta
un panel medido.** Con veinte mapas en dos hojas de 60 × 90, los 8 cm de §21
no se alcanzan sin perder «Cómo cambia al alejarse» (la tanda entera de la
v881), «Hitos y nodos», la comparación con la ciudad o el bloque del censo.

### Por qué no se quita el mapa, que es la otra mitad de §21

§21 dice «si no cabe a 8 cm, no se imprime». Ahí choca con una instrucción
anterior del mismo lector, dicha dos veces y con el PDF delante: «que se
muestren todos los mapas que antes salían» (v850). Y choca con la regla que
este proyecto ya tomó dos veces: **perder el panel es peor que el defecto que
se quería evitar** (v875 con la necesidad topada, v881 con los anillos
agrupados).

Entre quitar un mapa y publicarlo diciendo cuánto mide, se publica diciendo
cuánto mide. La lámina pierde una promesa, no un dato, y quien la imprime
tiene el número para decidir. **Callarlo sí era inaceptable, y es lo que
pasaba hasta la v885**: la hoja salía con mapas de 6,5 cm y para saberlo había
que medirlos con una regla sobre el pliego.

Y la salida está escrita al lado del número: apagar paneles desde la ficha
—que ya se puede— sube la escala de composición y con ella todos los mapas.
Es una decisión de quien arma la lámina, no del programa.

#### Se intentó automatizar y se deshizo

La primera versión cedía texto sola, por bisección, hasta alcanzar los pisos.
Funcionaba: la lámina A llegaba. Y se llevaba por delante la banda de riesgo,
«Continuidad del tejido» y «El grano» —los dos paneles de la v859—. Lo cazó
`tdoslaminas` con seis aserciones en rojo.

Es el mismo error que la v882 cometió con la mudanza de «La sombra de los
vecinos»: **un arreglo estructural hecho para callar una comprobación**. Se
deshizo, y queda escrito acá por qué, para que la idea no vuelva a parecer
buena.

### Los dos niveles van separados, o la alarma se muere

El renglón del pie dice las dos cosas y NO las pinta igual:

* los **8 cm son el piso** —por debajo un mapa no se lee en la pared— y eso
  sale en rojo;
* los **12 y 10 son el objetivo** del pliego para el principal de cada banda y
  para los de categoría. Quedarse corto ahí no hace ilegible nada: dice cómo
  se repartió el papel.

Juntarlos en un «cumple / no cumple» pintaría de rojo una hoja legible y
enseñaría a ignorar el aviso, que es como muere una alarma. Es la misma
decisión que la v880 tomó con el ámbar y el verde de los vacíos.

### El principal de una banda no está en una lista

Es el mapa de más peso que la banda tiene; con dos iguales, el primero. No hay
una lista escrita a propósito: **una banda nueva hereda la regla sin que su
autor se acuerde**, que es lo único que impidió que el aviso de origen (v867)
volviera a perderse.

### La medida se imprime sobre la hoja que se imprime

El veredicto se calcula midiendo el documento ya maquetado, y ahí hay un
círculo: para escribir la medida hay que componer la hoja, y componerla otra
vez con la medida escrita cambiaría lo que se acaba de medir. Se resuelve
dejando una **marca** en el pie y sustituyendo el texto en la cadena, sin
volver a maquetar. `tdoslaminas` comprueba justamente eso: que la cifra
impresa y la que sale de medir los mapas de ESA hoja no se separen en más de
un milímetro. Un veredicto de otra maquetación sería una cifra correcta de una
hoja que no es esta, que es la clase de error de la v879.

### La acostada no se comprueba, y lo dice

Los pisos están escritos «contra la hoja de 60 × 90». La acostada es de
90 × 60, con 30 cm menos de alto, y su techo de foto son 58 mm — por debajo
del piso, siempre. Aplicarle unos pisos que el pliego no pidió para ella daría
un rojo permanente que no significa nada. Lo dice en la hoja, que es distinto
de callarlo.

### Una función que se quedó a medias de nombre

`laminaQueQuepa` pasó a llamarse `laminaAjustada` —lo que siempre hizo: caber
en su papel— y el nombre viejo es ahora el de la que además comprueba §21. Lo
que sale a imprimir tiene que pasar por las dos cosas, y un nombre que se
queda a medias se llama por error desde el sitio equivocado.

### El piso de la suite, apretado contra lo medido

`tlaminaedu` exigía 45 mm de ALTO. Este sector lo deja de tocar por veinte
milímetros: **un piso que nadie roza no vigila nada**. Pasa a 55 mm de lado
MENOR —que es lo que §21 mide— con dos milímetros de margen sobre lo que esa
hoja da hoy. En `tdoslaminas` el piso equivalente son 60: cada lámina se
ajusta a su propio papel desde la v853, y una hoja sola cierra más apretada
que dos.

### Demostrado contra la v885

Seis aserciones en rojo de siete: sin veredicto impreso, sin cifra, «A dice
null y mide 65,4», sin separar el piso del objetivo y sin el remedio escrito.
La séptima —que ningún mapa baje de 60 mm— pasa contra las dos versiones a
propósito: es una guarda contra encoger los mapas, no una afirmación nueva.

## Nunca un marco vacío con la palabra «esquemático» (v887)

§3 del pliego de ajustes, citado tal cual: «Hoy imprime cuatro marcos vacíos y
confiesa que son esquemáticos». Y cierra con una prohibición: **«Nunca
imprimir un marco vacío con la palabra esquemático.»**

Tenía razón en lo de fondo. Un rectángulo a trazos con «País» debajo no ubica
nada: ocupa el sitio de la figura que debería estar, y la confesión honesta
—«ubican, no miden»— no lo arregla, porque **declarar bien una figura que no
sirve sigue dejando la figura sin servir**. Es el caso raro en este proyecto:
una declaración correcta que no salva al dibujo.

### El país y el departamento, de geometría fija

`js/79-siluetas-co.js`: el contorno de Colombia y el de los 33 departamentos,
de **Natural Earth 1:10m**. La licencia fue el criterio de selección, no la
precisión: es de **dominio público**, y una silueta que se imprime en una
lámina que un estudiante entrega no puede depender de una atribución que nadie
va a poner.

Simplificado por Douglas-Peucker a **0,03°**, unos 3 km. A los quince
milímetros de papel que mide cada casilla, 3 km es menos de un décimo de
milímetro. El canje, medido:

| Tolerancia | Puntos | Bytes |
|---|---|---|
| 0,02° | 2.601 | 42 KB |
| **0,03°** | **1.921** | **31 KB** |
| 0,08° | 833 | 14 KB |

De 40 MB de origen a 31 KB, sin que se note en el dibujo. La tolerancia va
escrita en el archivo **y en la hoja**: un contorno simplificado sigue siendo
aproximado, y callarlo dejaría leer la silueta como un límite legal.

Lo que no está: las partes de menos del 2 % del área mayor. Para Colombia eso
deja fuera San Andrés, Providencia y Malpelo, que a esta escala serían un
punto de tinta — y la hoja dice que es el contorno **continental**.

Las áreas que salen del contorno simplificado se comprobaron contra las
publicadas antes de conectarlo: Colombia **1.142.131 km²** contra 1.141.748
reales (0,03 % de diferencia) y Norte de Santander **22.140** contra 21.658
(2 %). Es lo que cuesta simplificar a 3 km, y es la razón de imprimir la
tolerancia al lado.

### El nivel siguiente, resaltado dentro del anterior

Es lo que §3 pide y lo que convierte cinco dibujos sueltos en una cadena: el
departamento va **relleno dentro del país**, y el sitio del sector va marcado
dentro del departamento. Sin eso, cinco siluetas en fila no dicen que una está
metida en la otra.

### El salto de escala, en números

Cada casilla lleva su superficie al pie, **calculada sobre el mismo contorno
que dibuja** —no sobre una tabla aparte que podría envejecer por su cuenta—, y
su población donde el módulo la tiene de verdad: el municipio, que proyecta el
DANE, y el sector, que se mide.

El área va con la fórmula **esférica** y no la plana. Con Colombia entera
—doce grados de latitud— la plana se queda corta, y esta cifra se imprime en
la misma fila que las hectáreas del sector: dos números de la misma columna
tienen que salir del mismo método.

### La casilla que ubica no imprime un área que no es la suya

El hallazgo de la tanda, y salió **mirando el papel impreso**, no el código.
Con todo funcionando, la fila salía así:

```
País 1.142.131 km² · Departamento 22.140 km² · Municipio 22.140 km² · Comuna 22.140 km²
```

Las casillas del municipio y de la comuna dibujan el departamento —sus bordes
piden los límites administrativos de OpenStreetMap, que este módulo todavía no
descarga— y debajo salían **los 22.140 km² del departamento bajo el rótulo
«Municipio»**. Una cifra correcta de otra cosa, que es exactamente la clase de
error que la v879 persiguió entre las dos láminas, metida en una casilla de
quince milímetros.

Se quedan sin área, y la caja dice por qué con esas palabras: **«ubica, no
delimita»**. Localizar de verdad y decir que no se midió el borde es distinto
de pintar un rectángulo a trazos — y es lo que separa esta versión de la
anterior, no el dibujo.

La comprobación persigue la clase y no el caso: **ninguna superficie puede
repetirse entre casillas**. Dos casillas con el mismo número son dos figuras
distintas diciendo que miden lo mismo.

### Dos aserciones que se dieron vuelta

`tdoslaminas` exigía que **los cuatro marcos de fuera fueran rectángulos a
trazos** y que la hoja dijera «esquemáticos». Era la manera correcta de
declarar un dibujo que no medía; con el dibujo medido, lo que tiene que fallar
es justo lo que antes tenía que pasar. Es la misma vuelta que dio la v876 con
la estructura de edades y la densidad de la ciudad.

Y una guarda de clase: **la palabra «esquemático» no puede volver a la caja**.
No persigue esa frase concreta —persigue que la caja vuelva a presentar un
marco como un símbolo.

### Lo que §3 pide y esta versión NO hace

El contorno del **municipio** y el de la **comuna**. §3 los pide —el primero
como geometría fija, el segundo de OpenStreetMap— y Natural Earth no llega a
esa escala: no hay municipios en su cartografía. Traerlos pide una consulta de
límites administrativos a Overpass, que desde la máquina de desarrollo el
proxy bloquea, así que sería código que no se puede probar contra el servicio
de verdad.

Queda en la lista viva con su cláusula `ya:`, y las dos casillas **ubican con
un punto medido** mientras tanto. También queda la población por departamento
y por comuna: pide anclas del DANE como las municipales, y escribir treinta y
tres cifras de memoria es exactamente lo que la v863 y la v879 prohíben.

### Demostrado contra la v886

Siete aserciones en rojo de ocho, con el texto viejo impreso: «1 con figura de
5», «4 a trazos», ninguna superficie, sin fuente, sin simplificación
declarada, y **«esquemáticos»** todavía en la caja.

La octava —que ninguna casilla imprima un área que no es la suya— pasa contra
la v886 por no haber ninguna área que imprimir. Es una guarda contra el
defecto que esta misma tanda encontró en el papel, no una afirmación nueva.

## La presión de crecimiento, por sus proxies (v888)

§17 del pliego de ajustes, con el diagnóstico exacto: «se resolvió con pérdida
de cobertura verde, que es **consecuencia, no presión**». Y tiene razón —el
verde que se va mide que alguien ya construyó, no la fuerza que empuja a
construir—, pero el arreglo no era buscar otra fuente.

### Dos de los tres proxies ya estaban medidos

Auditado antes de escribir, que es la regla de la v863: de las tres fuentes
que §17 propone, **dos estaban en el código y nadie las miraba**.

* **La huella construida entre dos fechas de imagen.** `tendenciaDe`, en
  `js/80`, devuelve `duro`, `duroDesde` y `duroHasta` desde que existe —
  **al lado del verde que el cruce sí usaba**, en el mismo objeto y en la
  misma línea. Es exactamente el segundo proxy del pliego, medido con el
  mismo clasificador sobre las mismas fotos.
* **La variación de población.** `st.crecimientoPct` la proyecta el DANE desde
  el censo. El pliego la pide a escala de COMUNA y esta es MUNICIPAL, así que
  entra declarada por lo que es.
* **La obra pública contratada** (SECOP) es la única que de verdad falta.

Es la quinta declaración de ausencia falsa de este módulo (v861, v863, v864,
v884, y esta) y la primera en la que el dato estaba **en el mismo objeto** que
el que sí se leía. El patrón no cambia: se escribió mirando lo que a una
herramienta así suele faltarle, en vez de leer lo que ESTA mide.

### «Declarar cuál es proxy y de qué» es la instrucción, no un adorno

Cada renglón dice de qué es proxy, con esas palabras, porque **un indicador
indirecto sin esa frase se lee como una medición directa**:

| Proxy | De qué |
|---|---|
| Huella construida · 44,1 % → 53,5 % de superficie dura | de CUÁNTO se construyó |
| Población del municipio · +2,4 % desde el censo | de CUÁNTA gente hay que alojar |
| Obra pública contratada · sin consultar | de la INVERSIÓN comprometida |

Y cada uno lleva su límite. El de la población es el que más importa: aplicarle
al sector la tasa del municipio **supone que todos sus barrios crecen igual**,
y en una ciudad con borde en expansión eso es falso. Decirlo es la diferencia
entre un proxy y una suposición.

El de la obra contratada es el que mejor mediría la presión de verdad —un
contrato firmado precede a la obra en año y medio, así que empuja **antes** de
verse en la foto—, y es el que falta. SECOP II es una consulta abierta y sin
llave; desde la máquina de desarrollo el proxy la bloquea, igual que
`ags.esri.co` y Overpass.

### Un `ReferenceError` que dejó la hoja sin once cruces, en silencio

El hallazgo caro de la tanda, y no era del panel.

El bloque viejo de la presión declaraba `var ev, W, t` para leer la tendencia.
Al reescribirlo, esas tres variables se fueron — y **el cruce 11, el del
horizonte temporal, sesenta líneas más abajo, leía `t`**. Dos cruces acoplados
por un local que uno dejaba puesto y el otro encontraba, sin que nada lo
nombrara.

Lo que lo hace caro es lo que pasó después: la lista de cruces se arma dentro
de un `try { … } catch { cruces = []; }`, así que el `ReferenceError` se tragó
y **la lámina B salió sin sus once cruces y sin un solo aviso**. El `catch`
está bien puesto —un adorno no puede tumbar una hoja, que es la regla de la
v870— pero convierte un error de programación en una hoja incompleta que se
ve normal.

Tres cosas quedaron de ahí:

* El cruce 11 lee el tramo de años de `presionDeCrecimiento`, que es de donde
  sale, y no de un local que otro cruce dejó puesto.
* **La suite comprueba que el cierre imprima sus cruces.** Una lista vacía es
  un error tragado, no un resultado: sin esa aserción, la siguiente vez que
  algo reviente ahí la hoja volverá a salir muda.
* Y el método: la suite lo señaló con **tres aserciones que fallaban lejos de
  la causa** —el suelo disponible, el cruce de predios, los dos valores—.
  Encontrarlo pidió instrumentar el `catch` para ver qué se estaba tragando.
  Un `catch` que no deja rastro convierte media hora en una tarde.

### La caja cuesta 8 mm de mapa, y por eso va solo en la hoja parada

Medido, no supuesto, y es la lección de la v886 aplicada en la dirección
contraria: allá cada milímetro de mapa costaba un panel; acá un panel cuesta
milímetros de mapa.

En la hoja **acostada** —300 mm menos de alto, y que ya cierra en el piso de
letra— una caja más no hace ceder nada: le encoge los mapas. El mapa más chico
pasaba de **57,4 a 49,2 mm** de lado menor, por debajo del piso que la v886
dejó puesto.

Así que va en la hoja de 60 × 90 vertical, que es el pliego educativo —§21
escribe sus mínimos «contra la hoja de 60 × 90»— y donde el mapa más chico
sigue en 64,4 mm. La acostada ya carga menos por la misma razón: los paneles
de campo y los de vacío ceden ahí y no acá.

Y el texto de la caja se escribió **corto a propósito**: lo que no puede
faltar son las tres declaraciones de «proxy de»; el resto es prosa, y en este
pliego la prosa se paga en milímetros de mapa.

### La rama medida no existía en el sector de prueba

Octava vez (v862, v866, v874, v877, v880, v882, v884, y esta). `tdoslaminas`
no pide la serie de fotos —son diez descargas y esto es la lámina—, así que la
huella construida habría salido **siempre** «serie satelital no leída» y el
proxy que §17 pide de verdad no se habría ejercitado en ninguna prueba.

La tendencia se inyecta por opciones, igual que el clima desde la v882 y el
terreno desde la v884, y con ella sale la rama que importa: 44,1 % → 53,5 % de
superficie dura, +9,4 puntos en diez años, «el sector se está llenando».

### Dos suites siguieron el cambio, y las dos se apretaron

`tlaminaedu` aceptaba que el cruce dijera «puntos de verde» o «estable»; ahora
exige que **nombre el proxy que le falta** y que **no cite el verde** como si
midiera la presión. Una prueba que falla por un cambio legítimo se hace más
precisa, no más laxa.

### Demostrado contra la v887

Diez aserciones en rojo de doce, con el texto viejo impreso: «no está» por la
caja, «0 declaraciones proxy de», y el cruce diciendo «serie satelital no
leída · leer la evolución es lo que mide la presión» — que es justamente la
frase que §17 corrigió.

## Cada propuesta cita su propio dato (v889)

§20 del pliego de ajustes, en sus tres puntos que quedaban vivos. Auditado
antes de escribir —que es la regla de la v863— componiendo la hoja y leyendo
los cinco renglones impresos, y el reclamo se quedaba corto: además de la
repetición había dos cosas peores debajo.

Lo que salía impreso, cinco veces con un solo número cambiado en medio:

> «lote de 179.009 m² para 300 típicos · esquinero, 4 frentes · vía principal
> a 100 m · 1 pieza de servicios registrada · alta si la norma lo permite:
> sin dato oficial»

y tres de las cinco con la misma necesidad, palabra por palabra: «lo medido
no muestra déficit: necesidad baja».

### Lo que da el SITIO se dice una vez

Cuatro de las cinco cláusulas de la factibilidad son del sitio —el lote, sus
frentes, la vía, los servicios, la mancha de inundación, la norma sin
consultar—. **Valen lo mismo para cualquier uso que se proponga, por
construcción**, así que repetirlas en cada renglón no solo gasta papel: las
disfraza de hallazgo de esa propuesta y entierra la única cláusula que de
verdad cambia de una a otra, que es cómo le queda el lote al uso.

Van una vez, arriba de las cinco. Y cada propuesta lleva solo lo suyo:
«caben 596,7 veces los 300 m² típicos» contra «caben 119,3 veces los 1.500».

### El relleno adelantaba a lo medido

El hallazgo que no estaba en el reclamo. Las propuestas de relleno entraban
con **necesidad 8** —un número inventado, no una medición— y con él pasaban
por delante de los usos que sí tenían cobertura medida. En el sector de
prueba, «colegio o jardín · 0,7 % sin cubrir · 22 hab. lejos» y «salud ·
2,4 % · 76 hab. lejos» —las dos con cuarenta y cuatro equipamientos mapeados
y una cifra de verdad— **quedaban fuera de las cinco**, desplazadas por
cuatro rellenos que no citaban nada.

Un marcador de posición no puede rankear por encima de una medición. El
relleno entra con cero, y a igual necesidad lo medido va antes.

### Y afirmaba «sin déficit» sobre lo que la misma caja manda a comprobar

La otra mitad, y es la v875 volviendo a entrar por la puerta de atrás. Sobre
un uso cuya capa venía vacía, el relleno imprimía «lo medido no muestra
déficit» — sobre exactamente lo que dos centímetros más abajo aparece en
«Antes de proponer, compruebe esto». **La hoja se contradecía consigo misma
dentro de una sola caja**, que es la clase que la v879 persigue entre las dos
láminas.

Ahora hay tres clases y se dicen distinto, porque significan cosas distintas:

| | Qué imprime |
|---|---|
| **sin medir** | «sin medir: la capa de «colegio o jardín» no tiene un solo punto mapeado». **No lleva etiqueta de necesidad**: ponerle «baja» sería afirmar sobre una capa vacía |
| **medido** | la cifra propia de ese uso: «90 usos de esta clase entre 226 clasificados · 0,5 por hectárea» |
| **sin cuenta propia** | lo dice con esas palabras, en vez de suponer un cero |

La razón también: dos equipamientos distintos cerraban con «la cobertura a
pie es la primera cuenta de un equipamiento de barrio», idéntica. Ahora cita
cuántos hay mapeados y a qué distancia se midió.

### La factibilidad: separa, o no se imprime

§20 pide las dos mitades de la misma decisión: «si el método no discrimina
factibilidad, no imprimir la etiqueta; si se imprime, tiene que haber un
criterio declarado que produzca valores distintos».

Medido, el método no discriminaba **nunca**, y la causa no era la que parecía.
El nivel sumaba en un mismo montón las condiciones del sitio y el encaje del
uso; como el sitio vale lo mismo para los cinco, lo único que hacía era
empujarlos a todos por encima del corte, y con el tope de la norma en
«media» los cinco salían media siempre. Un lote de 601 m² —donde el comercio
sobra, la salud queda justa y el colegio queda corto— imprimía las mismas
cinco etiquetas que uno de dieciocho hectáreas.

El nivel sale ahora **del encaje del lote en el uso y de nada más** —sobra,
cabe, justo, corto—, topado en «media» mientras no se lea el POT. Es lo único
que se mide por uso, y es literalmente lo que «factibilidad del predio»
quiere decir. Con eso:

* lote de 18 ha → los cinco caen en el mismo peldaño. **No se imprime cinco
  veces la misma etiqueta**: se dice una vez, con el criterio escrito y con
  que no separa, y la columna de cada propuesta pasa a decir cómo le queda el
  lote.
* lote de 601 m² → sale «baja» para el colegio y «media» para los demás, y la
  etiqueta se imprime propuesta por propuesta.

**No se resolvió inventando un criterio que produjera diferencias.** Eso
habría sido la mentira más pequeña de las dos, que es la decisión que este
módulo ya tomó en la v875 con la necesidad topada y en la v881 con los
anillos agrupados.

### El sector de prueba no podía enseñar las dos ramas

Novena vez (v862, v866, v874, v877, v880, v882, v884, v888, y esta). El lote
de `tdoslaminas` son dieciocho hectáreas: ahí caben los ocho usos típicos y
la rama que imprime la etiqueta quedaba sin ejercitar, así que la
comprobación habría pasado por no tener nada que rechazar.

La suite dibuja ahora **un segundo lote** de 601 m² —un predio urbano
corriente— con los botones de verdad (borrar, dibujar, cerrar; la regla de la
v871, no escribirle a `S`) y compone una lámina B más. Las dos ramas se miden
en la misma corrida.

Y la rama «sin medir» se mide donde hay material: en `tsinmapear`, cuyo
sector no tiene ni colegio ni salud ni parque con forma.

### Los marcadores de plantilla, como clase

El tercer punto de §20 —«revisar que no quede ningún marcador de plantilla
sin reemplazar»— no se persigue por el marcador que hoy existe (`@@TAM@@`, de
la v886) sino por la clase: sobre los nodos de texto de las dos hojas, ni
`@@X@@`, ni `{{x}}`, ni `undefined`, ni `NaN`, ni `[object Object]`. Son
todos el mismo defecto —algo que el programa iba a reemplazar y no
reemplazó— y el lector los ve igual. Por nodo y no sobre la tira, que es la
lección de la v885.

### Dos suites siguieron el cambio, y las dos se apretaron

* `tsinmapear` exigía que ningún `necTexto` nombrara lo «registrado» o lo
  «mapeado». Palabra a palabra eso prohibía también la frase honesta que esta
  tanda vino a poner —«sin medir: la capa … no tiene un solo punto
  mapeado»—. Lo que la v875 quería impedir es que una NECESIDAD se apoye en
  una ausencia de mapeo, y una propuesta que declara que no se pudo medir no
  afirma ninguna. Se partió en dos, y **la segunda mitad es nueva**: las que
  no se pudieron medir tienen que llevar «sin medir» y no «baja». Sin ella,
  bastaría con dejar de decir la palabra para pasar.
* `tlaminaedu` pedía los dos niveles en alta/media/baja. Ahora acepta dos
  valores más —que significan algo que antes se callaba— y exige además que
  los cinco contrastes del lote sean distintos entre sí, que es lo que la de
  antes no miraba.

### Demostrado contra la v888

Nueve aserciones en rojo de catorce, con el texto viejo impreso: «3 textos
distintos de 5», «lo medido no muestra défic» tres veces en el cierre, el
renglón del sitio repetido dentro de cada propuesta, y
«media · media · media · media · media» en el lote de barrio. En
`tsinmapear`, «ninguna sin medir».

Cinco pasan a propósito y son guardas, no afirmaciones nuevas: que el cierre
siga imprimiendo cinco propuestas, que cada una siga citando el área típica
de su uso, que no haya marcadores sin reemplazar, y las dos que en este
sector no tienen material.

## A qué escala se analizó, dicho con una referencia medida (v890)

§8 del pliego de ajustes, la última sección que quedaba, y la que había que
auditar antes de tocar porque parecía que iba a mover cifras en media
batería:

> La corrida anterior usó radio de 2.500 m: 19,63 km², 77.145 habitantes. Eso
> no es un sector, es un tercio de Cúcuta. Y el «lote» tenía 871.935 m²
> (87 ha), que no es un lote. Correr las pruebas con: radio de 800 m; lote:
> un predio real de unos pocos miles de metros cuadrados.

Medido antes de cambiar nada, de las dos cosas que pide **una ya estaba y la
otra no**:

* El **sector** de `tdoslaminas` mide 1,77 km² — un radio equivalente de
  **750 m**, que es justo la escala que §8 pide. No había que tocarlo, y
  tocarlo habría movido cifras en una docena de suites para nada.
* El **lote** eran dieciocho hectáreas. Ahí sí: todo lo que la lámina mide
  sobre el predio se estaba probando a una escala a la que un predio no
  existe.

### Lo que el predio destapó, y no se veía a dieciocho hectáreas

Con el lote a escala de verdad —unos 3.000 m²— el cruce del cierre pasa de
**«el lote mide 9 veces el área de una manzana mediana»** a **«ocupa cerca
del 14 % de una manzana mediana»**. La primera frase es correcta y no
significa nada: describe un lote que no es un lote. Es la misma clase de la
v874 —una cifra correcta dicha de una manera que no se puede leer— y solo
aparece cuando el material de prueba puede producirla.

Y una del método, que costó una vuelta: **a escala de predio los vértices no
caben en el píxel**. El lote de veintidós lados no se puede conservar a 33 m
de radio: a zoom 15 los vértices quedan a dos píxeles unos de otros y el
dibujo los funde, así que el polígono ni siquiera se registra y la hoja sale
sin lote. Quedan ocho lados —suficientes para que el reparto por sol siga
teniendo algo que repartir— y **se marca con el mapa acercado**, que es lo
que hace cualquiera para dibujar un predio. Eso no es un arreglo para la
prueba: es lo que pasa en la aplicación de verdad.

### `tpliegogrande` NO baja de escala, y el motivo está escrito

Su lote de veintidós lados y 19 ha no es un descuido de escala: es la
regresión que esa suite existe para guardar. Su propia cabecera lo dice —«un
lote de 193.863 m² con veintidós lados… la fila entera crecía con ella: el
pliego acostado pedía 652 mm de los 600 que tiene»— y **«un lote de cuatro
esquinas no lo destapaba nunca»**.

Bajarlo a predio habría dejado esa suite sin material, que es exactamente la
manera silenciosa de perder una prueba. Se intentó, se midió lo que costaba,
y se deshizo. Las dos escalas hacen falta y cada una en su sitio: el predio
donde se mide el predio, el lote patológico donde se mide que el papel
aguanta.

### La otra mitad de §8, que no era de las pruebas

El reclamo no es sobre el fixture: es sobre **la corrida real del usuario**.
La hoja imprimía el radio —eso está desde la v848— y **nada sobre lo que ese
radio le hace a las cifras**. Un jurado que lee «6,1 m² de espacio público
por habitante» no tiene cómo saber si eso es de un barrio o de un tercio del
municipio, y todo indicador por habitante o por hectárea es un promedio sobre
el área analizada.

Lo difícil no era decirlo sino **con qué compararlo**. Una tabla de cortes a
ojo —«hasta N km² es un sector»— sería repetir el error del techo de Overpass
de la v869: un número inventado que después nadie puede defender. Así que se
usan dos referencias que la hoja YA mide:

* el **área censada del municipio**, que llega con la referencia de ciudad de
  la v876 (`stats.ciudad.areaCensadaM2`). «El 31 % del área censada de San
  José de Cúcuta» es verificable —cualquiera rehace la división— y dice lo
  que hay que decir sin inventar ningún umbral;
* los **tres radios que la propia hoja compara** —500, 800 y 1.000 m
  (`comparacionDeRadios`, v848)—, que es el rango en el que el módulo se
  declara capaz de leer un sector.

En el sector de prueba sale, en gris, como una declaración más:

> Escala del análisis: 1,77 km² · radio equivalente de 750 m · el 2,9 % del
> área censada de San José de Cúcuta. Está dentro del rango de sector que
> esta hoja compara —500, 800 y 1.000 m—.

Y en la corrida de 19,63 km², en rojo y a trazos —el mismo código visual que
la contradicción de la v879—, encabezado con **«Esto no es un sector.»**, con
qué le hace eso a las cifras y con el remedio al lado: volver a analizar con
un radio de unos 800 m.

**Se declara, no se topa ni se rechaza.** La hoja grande sale entera y el
aviso se suma al panel del radio en vez de quitarle una caja: es la decisión
de la v875 con la necesidad topada y la de la v886 con los mapas de 6,5 cm.
Quien analiza elige su escala; la hoja dice a cuál lo hizo.

### El área sale del RESULTADO, no del polígono en pantalla

`escalaDelAnalisis` lee `res.meta.areaM2` y deja `areaDelPoligono()` de
respaldo para un análisis que todavía no se guardó. No es lo mismo: una ficha
archivada se vuelve a componer con este código, y leyendo la pantalla
imprimiría la escala del trazo que esté dibujado ahora —o ninguna— en vez de
la del análisis que se está reimprimiendo. Es la regla de la v879 aplicada
antes de que divergiera, no después.

### El sector de prueba no podía enseñar la rama del aviso

Décima vez (v862, v866, v874, v877, v880, v882, v884, v888, v889, y esta).
Este sector mide 750 m de radio equivalente, así que la rama roja no se
ejercitaría nunca y la comprobación pasaría por no tener nada que rechazar.

La suite **vuelve a analizar de verdad** —con el botón, un polígono de 2.500 m
de radio equivalente y los 5,2 s del limitador de Overpass— y compone una
lámina A más. Las dos ramas se miden en la misma corrida: la gris y la roja.

Y una de las aserciones que hubo que corregir sobre la marcha: la primera
versión comparaba el número de cajas de la hoja grande contra el de la hoja
del sector y salía «12 contra 26». **No era un panel perdido**: esa segunda
corrida no volvió a medir el trazado, la cobertura ni el terreno, así que
estaba midiendo otra cosa de la que decía. Lo que sí se comprueba es dónde
CAE el aviso —dentro del bloque del radio, al lado de la tabla de los tres
radios— y que la hoja siga trayendo sus cajas. Un umbral absoluto habría
pasado o fallado por el motivo equivocado.

### Dos suites siguieron el cambio, y las dos se apretaron

* `tlaminaedu` exigía «el lote quedó de veintidós lados», que es una
  propiedad del dibujo y no del predio: un lote de dieciocho hectáreas la
  pasaba sin despeinarse. Ahora pide lados de sobra —para que el reparto por
  sol reparta algo— **y que la superficie que la hoja imprime sea la de un
  predio**, leída del papel.
* `tpliegogrande` llevaba el número de lados escrito DENTRO de una aserción
  de contenido: `\d+ de 22 lados`. Eso es una constante del fixture metida en
  la comprobación de un panel, y se ponía roja por un cambio que no tiene
  nada que ver con lo que mide. Pide la forma —cuántos de cuántos, y los
  metros— y que el total cuadre con los lados dibujados.

### Demostrado contra la v889

Ocho aserciones en rojo de once: «no la declara», «no lo dice» por el aviso
de escala grande, «no lo nombra» por la superficie, «no lo explica» y «sin
remedio».

Las tres que **no** fallan son guardas a propósito, como las de la v879, la
v882 y la v889: que una corrida de 19,6 km² se analice en vez de rechazarse
—cierto antes y que tiene que seguir siéndolo—, que la hoja salga entera, y
que la página no suelte errores.

Lo del lote no se demuestra con `git stash` de `js/`: es un cambio de
fixture, y contra la suite de la v889 lo que falla es la aserción vieja de
los veintidós lados. La demostración de que valía la pena es el cruce del
cierre, que pasa de «9 veces una manzana» a «el 14 % de una manzana».

## El punto decimal no es de este idioma (v891)

Hechas las veintiuna secciones del pliego de ajustes, esta tanda no sale de
un reclamo sino de **leer el papel impreso**, que es el método que más
defectos reales ha encontrado en este proyecto: la v874, la v882, la v885 y
la v887 salieron todas de mirar la hoja y no el código.

Compuestas las dos láminas y barridos sus 2.167 nodos de texto, salieron dos
cosas, y la primera no es de redacción.

### Una tasa impresa cien veces menor de lo que es

En el panel de presión de crecimiento, sobre el papel:

> +3,6 % desde el censo de 2018 · **0,004435050053115175 % al año**

`tasaAnualDe`, en el motor, devuelve una **fracción** —`Math.pow(…) − 1`, o
sea 0,004435 para un 0,44 % anual—. El informe en hojas lo sabía y hacía
`* 100` con `toFixed(2)`; el panel de la v888 la pasaba tal cual por
`conComa`. Dos defectos en la misma cifra, y el caro es el primero: **cien
veces menor**, con el signo de porcentaje al lado. El segundo es de la clase
de la v874 —dieciocho decimales en una hoja que se cuelga en una pared—.

Es literalmente lo que la v879 dejó escrito: **«dos rutas de cálculo para la
misma cantidad no divergen el día que se escriben, divergen la tanda
siguiente»**. Acá divergieron a la tanda siguiente, y el que se equivocó fue
el nuevo. Ahora hay una sola, `tasaAnualPct`, y las dos la llaman.

### Catorce cifras con punto decimal, y una guarda que miraba una unidad

La v885 puso una guarda contra «1.77 km²» y la acotó a las áreas —`ha` y
`km²`—. **Una guarda acotada a la unidad en la que apareció el defecto solo
caza la unidad en la que apareció**, y durante seis versiones pasó en verde
con catorce cifras de punto decimal impresas en el resto de la hoja:

| Dónde | Salía |
|---|---|
| Carta solar, leyenda y tabla | `Hoy · 85.9° al mediodía`, `sale 86° · se pone 273.9°`, `58.7° a 89.8°` |
| Llenos y vacíos, KPI y pie | `9.2% construido`, `90.8% libre` |
| «El sitio» | `1.4 por hectárea` |
| Coherencia de las cifras | `3.5 personas por vivienda`, `panel 6.1 m²/hab` |

La guarda persigue ahora la clase entera: **ninguna cifra de la hoja lleva
punto decimal**, venga detrás lo que venga. El acotado que sí hace falta se
queda donde estaba —una o dos cifras tras el punto, porque un separador de
miles siempre trae tres—, y de paso deja fuera los dominios y las
direcciones, donde tras el punto van letras.

#### `n1` servía para dos cosas con requisitos opuestos

La trampa de la tanda, y por poco. Los grados de la carta solar salen de
`n1()` en `js/74`, que redondea a un decimal. Lo obvio era arreglar `n1` para
que devolviera la coma — y habría **roto en silencio los cincuenta y pico
trazados del archivo**: el `d` de un `<path>` y el `x` de un `<text>`
necesitan el punto, así lo pide SVG, y `n1` se usa sobre todo para eso.

De sus cuarenta y tantos usos, **solo cuatro son rótulos que un lector ve**.
Esos pasan ahora por `gr()`, que es `n1` más la coma, y las coordenadas
siguen con `n1`. Lo salvó mirar para qué se usaba antes de tocarla, que es la
regla de la v863 dicha para un ayudante de tres líneas.

### Lo que el barrido descartó, y por qué también vale

Dos cosas que parecían defectos y no lo eran:

* **«caben 7,1 veces»** lo marcó mi propio barrido como un «1» seguido de
  plural. Es un falso positivo *del barrido*: en JavaScript `\b` cae entre la
  coma y el «1». La guarda de concordancia del proyecto —la de la v874— ya lo
  tenía resuelto con `(?<![\d.,])`, así que la que estaba mal era la mía. Es
  la trampa de la v878 otra vez, y conviene que quede escrito que la guarda
  buena la esquivó.
* **Tres frases repetidas en las dos hojas** —la cabecera, la regla de
  neutralidad y la conclusión de «Otras mediciones»— son una por lámina y
  están así a propósito desde la v853.

Comprobarlas costó dos minutos y evitó dos arreglos sin causa, que es lo que
la v882 y la v886 pagaron por no hacerlo.

### Demostrado contra la v890

Una aserción en rojo que enseña seis de las catorce cifras con su punto:
`1.4 · 85.9 · 273.9 · 89.8 · 58.7 · 85.9`. La tasa no tiene aserción propia
porque la guarda de la clase ya la cazaba por los dieciocho decimales; lo que
sí quedó es que las dos rutas son una sola, y eso se lee en el código.

## El trazo guardado tiene su propia ventana (v892)

Pedido con estas palabras: «cuando acceda a ese polígono guardado me deje
ajustar el radio con su barrita para poder dejar un radio de 2.5 kilómetros y
personalizarlo más, y una ventana exclusiva de eso porque sale mucha
información y confunde».

Las dos mitades eran ciertas y las dos se comprobaron leyendo el código antes
de escribir nada:

* **No había barrita.** `htmlAjustes` pinta el control de radio **solo en la
  rama del LOTE**. Con un polígono puesto —que es exactamente lo que deja un
  trazo guardado— la caja decía «N vértices · tanta área» y nada más. Así que
  un trazo guardado se podía volver a analizar, sí, pero **siempre a la misma
  escala**: justo lo contrario de lo que la v871 prometía cuando la pidieron,
  «analizarlo las veces que yo quiera… para hacer diferentes análisis».
* **Y 2,5 km no está en los botones.** `RADIOS` son 250, 500, 1.000, 2.000,
  4.000 y 8.000 m. La barrita va de 100 m a 8 km de 50 en 50, así que 2.500
  solo se alcanza con ella — por eso el pedido dice «con su barrita» y no
  «con los botones».

### Un trazo es un SITIO; cada análisis elige su escala

Esa es la separación que faltaba, y es la misma forma que la v871 le dio a los
trazos frente a las fichas. La forma dibujada es **una** manera de analizar el
sitio; un radio alrededor de su centro es **otra**, sobre el mismo sitio. Las
dos quedan enlazadas al mismo trazo, y **la lista de la ventana dice a qué
escala salió cada análisis** — sin eso, tres análisis del mismo trazo se ven
idénticos en la lista y la promesa no se puede usar. Es la regla de la v889
dicha acá: cada renglón cita su propio dato.

El centro del radio es el del trazo, y eso también se comprueba: si se moviera,
sería otro sector con el mismo nombre.

### La ventana se mide por lo que NO trae

El panel de antes de analizar trae, todo junto: los seis botones de radio, el
lote con su dibujo, los reconocimientos guardados y los trazos. Para alguien
que solo quiere volver a un sitio suyo y mirarlo a otra escala, eso es ruido
menos dos controles — y es literalmente lo que el pedido llamó «mucha
información».

Así que la aserción que vale es la negativa: en la ventana del trazo **no hay**
lista de reconocimientos, ni la otra lista de trazos, ni un solo botón de radio
suelto, ni el dibujo del lote. Medir solo lo que sí trae habría pasado en verde
con el panel general debajo.

### El aviso de escala, antes de analizar y no después

Por encima de 1 km la ventana dice, en ámbar, que eso deja de ser un sector y
que las cifras por habitante van a ser promedios de un área que mezcla barrios
distintos. Es el mismo aviso que la lámina imprime desde la v890 —y con la
misma decisión: **no impide analizar**, porque quien analiza elige su escala—
pero dicho donde todavía se puede cambiar de idea. En el papel ya no.

### El trazo queda dibujado dentro del círculo

La ventana promete que «la línea gris es el trazo guardado, que queda de
referencia». Eso obliga a `pintarCirculo`, que limpia la capa en cada
movimiento de la barrita: sin el contorno, elegir el radio sobre un mapa donde
la forma guardada desapareció es elegirlo a ciegas. Va en gris fino y sin
relleno para que no se confunda con lo que se va a analizar, que es el círculo.
Y hay una aserción que lo busca **en el mapa**, no en el texto: una promesa
escrita y no cumplida es peor que no hacerla.

### Dos errores míos, los dos cazados por guardas del propio proyecto

* **`trazoDe` ya existía.** Escribí `trazoDe(id)` para buscar un trazo
  guardado, y `trazoDe(anillos, enc)` —el constructor de rutas SVG de la
  v887— vive sesenta pantallas más abajo. Como la segunda declaración pisa a
  la primera, **mi ventana habría llamado al constructor de rutas SVG**. Lo
  denunció con archivo y línea la guarda que la v885 dejó puesta, que es
  exactamente para lo que se escribió. La mía se llama `trazoGuardado`.
* **La ficha guarda `forma` y `radioM` en el PRIMER NIVEL, no en `meta`.**
  Escribí `f.meta.forma` porque esa es la forma del resultado VIVO, y la
  guardada es otra: salían las dos indefinidas y todo análisis se listaba como
  «el trazo tal cual», incluido el de 2,5 km que se acababa de hacer. Es la
  regla de la v863 con el agravante de que las dos formas existen y se
  parecen — leer `guardarFicha` costó un minuto y la suposición costó dos
  aserciones en rojo.

### Demostrado contra la v891

Trece aserciones en rojo de dieciséis: «no hay ventana», el ruido del panel
general presente —«trazos true · lote true»—, «ninguna» por las dos escalas,
«0 contornos de referencia», y la ficha con `forma: undefined` porque lo que
corría era un análisis del lote.

Tres pasan a propósito y son guardas, no afirmaciones nuevas: que la barrita
llegue a 8 km de 50 en 50 y que 2.500 sea alcanzable —el control ya era así,
lo que faltaba era tenerlo para un trazo guardado— y que el centro no se mueva.

## Cuatro defectos de la ventana del trazo, y dos nombres (v895)

Llegaron en cuatro capturas al día siguiente de la v892. Son cuatro y **ninguno
es de cálculo**: dos de estado y dos de nombres de clase. Auditados uno por uno
antes de tocar nada, que es la regla de la v863, y la auditoría cambió la
historia: lo que el reporte contaba como cuatro fallos resultó ser **uno que
arrastraba a otro**.

| Lo que se vio | La causa |
|---|---|
| El radio de 2,5 km centrado FUERA del lote | el rebote de abajo lo dejaba en el panel general, donde el círculo sigue al mapa por diseño |
| «Me pasó otra ventana aparte… primero me retrocedió» | `trazo-analizar` borraba `S.trazoAbierto` ANTES de llamar a `analizar` |
| «Tampoco salía el botón de analizar grande» | `pcr-btn` y `pcr-btn-ir` **no existen en ninguna hoja de estilo** |
| «Volver» montado sobre «Análisis de este trazo» | `pcr-volver` **sí existe**: es la píldora flotante de §18, `position:fixed` |

### Un nombre que no existía y otro que existía de más

Son el mismo error visto por sus dos caras, y los dos los cometí en la misma
tanda:

* **Inventado.** `pcr-btn pcr-btn-ir` no estaba escrito en ninguna parte, así
  que la acción principal de una pantalla entera salió como texto suelto de
  **25 px de alto, sin fondo ni borde**. Un nombre de clase que no existe es
  HTML válido: ni un error, ni una consola, nada.
* **Reusado.** `pcr-volver` llevaba años siendo otra cosa —la píldora que
  vuelve al análisis, clavada abajo a la izquierda con `z-index` 2.147.483.200—,
  así que el botón de la cabecera se fue del encabezado a flotar encima de la
  lista de análisis, sesenta píxeles más abajo.

Es el tropiezo de `trazoDe` de la v892 —dos funciones con el mismo nombre—
dicho en CSS, y la guarda de la v885 no lo alcanza: mira funciones de
JavaScript.

#### La guarda, y por qué no persigue «clase sin regla»

La comprobación obvia —denunciar toda clase propia sin regla— da **28 casos** y
casi todos son legítimos: un asidero para `querySelector`, o una etiqueta
descriptiva sobre un SVG cuyos hijos sí se pintan. Una guarda con veintiocho
excepciones es una lista que envejece hasta no significar nada.

Lo que sí discrimina, y sin un solo falso positivo, es otra cosa: **un elemento
en el que NINGUNA de sus clases tiene regla en ninguna hoja**. Ese elemento no
lo pinta nada, y ese es el defecto. Quedan **13**, cada uno con su razón
escrita al lado —es la forma de la guarda del voseo en -á de la v880: se lista
lo permitido y se denuncia todo lo demás—. Demostrada devolviendo
`pcr-btn pcr-btn-ir`: sale con archivo y línea.

### El rebote era el defecto de verdad, y arrastraba al del centro

Lo que parecían dos cosas era una. Al tocar «Analizar», el manejador cerraba la
ventana y **entonces** consultaba, así que la hoja volvía al panel general y la
barra de espera aparecía allá: «primero me retrocedió y después apareció esa
ventana, y eso me enredó; que todo sea transitorio, que no salga en ventanas de
la nada». Y una vez en el panel general, el círculo **sigue al mapa a
propósito** —esa pantalla lo promete por escrito, «mueva el mapa: el círculo
sigue el centro»—, de modo que cualquier arrastre lo sacaba del lote amarillo.

Ahora la ventana se queda, la espera se pinta dentro de ella, y la cierra
`analizar` cuando ya hay resultado —que es cuando lo que hay que ver es la
ficha—. Y no se le cede a la barra encogida: `encoger` lleva `!S.trazoAbierto`.
Una ventana, dos puertas escritas para salir.

#### El ancla, y por qué se suelta en una puerta y no en la otra

El centro de un trazo queda marcado `S.centroDe = 'trazo'`, y `alMoverElMapa`
no lo mueve: **un trazo guardado es un SITIO, no una propuesta que se empuja
arrastrando el mapa.** Pero «Solo ponerlo en el mapa» **lo suelta**, porque esa
es la puerta explícita a trabajar sobre el mapa y el panel de destino promete
justamente lo contrario. Clavarlo también ahí habría convertido esa promesa
impresa en mentira — y el proyecto tiene una tanda entera (la v861) sobre lo
que cuesta que una pantalla afirme lo que no hace.

Por eso la suite mide **las dos ramas en la misma corrida**: soltado en el
panel general el círculo sigue al mapa, y al reabrir el trazo el centro vuelve
al trazo. Medir solo la primera habría pasado en verde clavando el centro en
todas partes.

**Y un origen nuevo entra en `ORIGEN_TEXTO` el mismo día que se inventa.** Sin
su renglón, `comoSeEligioElCentro('trazo')` caía en el texto por omisión y la
ficha imprimía «el centro del mapa, donde estaba la vista» sobre un centro que
no salió del mapa. Es lo único de los cuatro que sale **en rojo contra la
v892** por la vía del centro: el valor volvía bien por suerte y el rótulo se
quedaba viejo. Declarar mal la procedencia es peor que no declararla, que es la
regla de la v867.

### Dos lecturas mías equivocadas, las dos por medir mal

* **`estado()` no expone `cargando` ni `resultado`.** Escribí
  `R.estado().cargando` y `.resultado` y las dos daban `undefined`, o sea rojo
  por «la función no hizo su trabajo» cuando la función estaba bien. Los
  nombres que el accesor expone son `consultando` y `hay`. **Es exactamente la
  trampa que la v871 dejó escrita en este archivo, y volví a caer en ella.**
* **La primera versión de la aserción de la espera esperaba 900 ms.** El
  Overpass de mentira contesta al instante, así que medía el final y no la
  espera. Se mide sin esperar nada: `analizar` pone la bandera y repinta antes
  de su primer `await`.

### La ventana del trazo no tiene asa, y por eso una aserción sobraba

Escribí primero una aserción que bajaba la hoja con el dedo estando en la
ventana del trazo y comprobaba que el centro no se moviera. **Pasaba también
contra la v892**, y no porque el código estuviera bien: el arrastre de la hoja
arranca solo desde el asa, y la ventana del trazo no dibuja la cabecera que la
lleva. Estaba midiendo un gesto imposible.

Es la undécima vez que aparece el mismo agujero (v862, v866, v874, v877, v880,
v882, v884, v888, v889, v890, y esta) y la primera en que el material no era
pobre sino **inalcanzable**. Se sustituyó por el camino que sí se puede
recorrer —salir por «Solo ponerlo en el mapa», bajar la hoja, arrastrar lejos,
reabrir el trazo— y la aserción del valor del centro se declara en la suite
como lo que es: una **guarda**, como las de la v879, la v882 y la v890, no una
afirmación que la v892 rompa.

### Y se miró el papel

Las medidas decían que «Volver» estaba en su cabecera y no dijeron que su
contorno redondeado quedaba **recortado contra el canto** de la hoja: la caja
daba `l=0`, que no es lo mismo que «se ve entero». Salió en la captura, como
salieron los defectos de la v874, la v882, la v885 y la v887.

### Demostrado contra la v892

Cinco aserciones en rojo de catorce, con el texto viejo impreso: «ventana
false» y «botones de radio sueltos: true» por el rebote, «el centro del mapa,
donde estaba la vista» por el origen, «25 × 412 px» por el botón y «fixed ·
botón en y=773, cabecera en y=380» por el solape.

Y una de numeración: la otra sesión publicó una v893 y una v894 mientras esta
tanda se escribía, así que esto es la **v895**. Se sube por encima de las dos,
nunca bajando la propia — es la regla del 7 de septiembre.

## Una pantalla armada a mano dentro de la hoja (v896)

Llegó en captura al día siguiente de la v895, y con una frase que dice las
tres cosas: **«la ventana está estática y se sale de la pantalla, no puedo ni
bajar ni subir, tampoco la puedo minimizar».** Un trazo de 52 vértices con
tres análisis guardados: la lista de abajo quedaba fuera y no había cómo
alcanzarla.

### Lo que le faltaba no era CSS: era la estructura de la hoja

`htmlTrazoAbierto` devolvía su contenido **a pelo**, sin las dos piezas que
las otras tres vistas de esta hoja traen desde siempre:

* **`.pcr-cuerpo`** es el único elemento con `overflow-y:auto`. La hoja está
  topada en `max-height:86vh`, así que sin ese contenedor todo lo que pase de
  la pantalla **se recorta y no hay cómo llegar a ello**. No es que se saliera:
  es que estaba cortado, que desde afuera se ve igual.
* **`barra()`** trae el **asa** —el objetivo ancho que se arrastra para bajar
  la hoja— y la **X**. Sin ella no había gesto de minimizar ni de cerrar.

De paso, el recuerdo de por dónde iba leyendo cada vista (`h.querySelector('.pcr-cuerpo')`)
tampoco encontraba nada, así que esta pantalla era la única de las cuatro sin
esa memoria.

**Una pantalla nueva dentro de esta hoja se arma con `barra(...)` y con el
contenido dentro de `<div class="pcr-cuerpo">`.** Las otras tres lo hacen; la
mía no, y no lo dijo ningún error.

### La v895 prohibió encoger, y el remedio salió peor que el defecto

La v895 le puso `!S.trazoAbierto` a `encoger` para que bajar la hoja no la
cambiara por la barra encogida —que es el panel general, con sus seis botones
de radio y el lote—. El diagnóstico era correcto y **la solución estaba del
lado equivocado**: se llevó por delante el poder ver el mapa, que es
exactamente lo que uno hace mientras elige un radio.

Lo correcto no era prohibir el gesto sino **que el gesto no cambiara de
sitio**: `htmlEncogida` tiene ahora una rama propia para el trazo abierto —su
nombre, su barrita de radio y su botón de analizar, sin nada del panel
general—, igual que la que el lote ya tenía dos ramas más abajo. `S.trazoAbierto`
no se toca al encoger, así que subir la hoja devuelve la ventana entera.

Es la misma lección que la v882 y la v886 dejaron escritas por otros dos
caminos: **un arreglo que quita una capacidad para callar un defecto es un
arreglo a medias**, y se nota al día siguiente.

### El fixture tenía una sola ficha, y por eso nada desbordaba

Duodécima vez (v862, v866, v874, v877, v880, v882, v884, v888, v889, v890,
v895 y esta). Con un solo análisis el contenido cabía en la hoja: la aserción
de «se puede recorrer» habría pasado **sin tener nada que recorrer**, que es
el verde que este proyecto lleva doce tandas persiguiendo.

El trazo de la captura tenía **tres**, así que la suite siembra dos fichas más
sobre la real. Se siembran en el almacén y no se corren dos análisis más
—serían dos consultas y dos esperas de 5,2 s del limitador de Overpass— y es
lo que de verdad tiene quien vuelve días después: no se está cambiando el
estado por un lado, se está poniendo el material guardado que la ventana lee.
Con ellas sobran 163 px por debajo del borde, y la aserción mide que el último
botón se alcanza recorriendo.

De paso se apretó otra: «borrar el trazo no borra los análisis» comparaba
contra **una** ficha, donde no se distingue «no borró» de «no había más que
una». Ahora son tres.

### Demostrado contra la v895

Cinco aserciones en rojo, con el estado viejo impreso: «cuerpo false ·
overflow sin cuerpo», «0 px por debajo del borde», «sin cuerpo que recorrer»,
«asa false · cerrar false» y «encogida false» — que es no poder minimizarla.

## El botón acusa recibo, y lo que eso destapó (v897)

Pedido con estas palabras: **«cuando le dé guardar ojalá salga una animación
en el botón y que quede iluminado de un color para saber que quedó
guardado».** Hasta la v896 guardar solo dejaba una línea de aviso arriba del
todo, y el botón está abajo: quien lo toca no ve nada donde está mirando.

### Son DOS cosas, y viven en sitios distintos

Es la parte que cuesta ver y la que decide la implementación:

* **El destello** es del MOMENTO: dice «te oí». Se pone sobre el nodo ya
  repintado (`destelloDeGuardado`) y muere en el repintado siguiente. Si
  viajara en el HTML, el botón volvería a destellar cada vez que se repinta la
  hoja —encender una capa, mover la barrita— y **un botón que parpadea sin que
  nadie lo toque no dice nada**.
* **El iluminado** es del ESTADO: dice «esto que ves está guardado». Ese sí va
  en el HTML, porque tiene que seguir ahí al volver de otra pestaña, y se
  apaga solo cuando deja de ser cierto.

Dos detalles que costaron una vuelta: se lee `offsetWidth` antes de volver a
poner la clase, porque sin ese reflujo **guardar dos veces seguidas no vuelve
a destellar** —para el navegador la clase nunca se fue—; y el botón se busca
en el DOCUMENTO y no dentro de `hojaEl()`, porque sale también en el panel de
pestaña. Es la lección de la v870 con la barra de espera.

#### Qué significa «Guardada», que no es lo obvio

El análisis **ya se archiva solo** al terminar (`guardarFichaViva`), así que
«guardada» a secas sería cierto antes de tocar nada y el botón nacería verde
— que no dice nada, y encima haría que tocarlo no cambiara nada. Lo que el
botón hace de verdad desde la v871 es ponerle **nombre** a esa misma entrada.

Así que lo que se ilumina es eso: *esta ficha, con este nombre*. Cambiar el
nombre o analizar otro sector lo apaga, que es cuando vuelve a haber algo que
guardar. Se compara el OBJETO del resultado y no una bandera, que es el mismo
truco con el que el enrutador recuerda por dónde iba leyendo.

El del trazo no necesitó estado nuevo: `botonGuardarTrazo` ya sabía desde la
v871 si el trazo a la vista está en el almacén, y solo lo usaba para cambiar
el texto. Ahora además se ve.

### Lo que apareció leyendo esas cuatro líneas: la guarda del voseo fallaba

Al abrir el manejador de guardar, en el renglón de al lado estaba escrito
«Ficha guardada. **La encontrás** en la pestaña «Sector»». Voseo, en texto que
ve el usuario, con `revisar.js` en verde desde la v880.

Medido, eran **veintidós**, y no era mala suerte: era un agujero
**estructural**.

#### La tilde desaparece al pegar el pronombre

`pegá` + `lo` = **`pegalo`**. Sin tilde. Ninguna regla que mire acentos —que
es como están hechas las dos mitades de esta guarda— puede verlo. La lista
tenía cinco de esa familia escritos a mano (`guardalo`, `escribilo`,
`mirala`, `ponelo`) y le faltaban los demás, así que quedaban «Pegalo»,
«Pegala», «Copialo», «Copiala», «Marcalo», «Ponele», «Pedile», «Escribinos»,
«Avisale» impresos en avisos que el usuario lee.

**No se arregla escribiendo más.** Se DERIVAN de la lista base: cada forma que
acabe en vocal con tilde pierde la tilde y recibe cada pronombre, así que un
verbo nuevo en la lista trae su familia entera sin que su autor se acuerde. Y
la forma correcta en Colombia **siempre** lleva tilde —«péguelo», «márquelo»,
«guárdelo»—, así que denunciar la que no la lleva no puede confundirse con el
castellano bueno.

La derivación se validó sola en el acto: al agregar **un** verbo a la lista
base (`avisá`, que faltaba) aparecieron cuatro «Avisale» más que nadie había
visto. Eso es exactamente lo que una guarda derivada tiene que hacer y una
lista escrita a mano no hace.

Queda **una** excepción declarada con su razón: `leeme` sale de «leé»+«me»,
pero ahí no es una frase dirigida a nadie — es el nombre del archivo
`LEEME.txt` que acompaña una exportación.

#### Y una advertencia sobre mi propio barrido

Buscando esto escribí `/\bvé\b/` y me devolvió **«vértices»** treinta veces.
Es la trampa que la v878 dejó escrita en este mismo archivo —en JavaScript
`\b` trata las vocales acentuadas como NO-palabra— y volví a caer en ella. La
guarda del proyecto, que pone los límites a mano, no se equivocó: la que
estaba mal era la mía. **Antes de creerle a un barrido propio conviene
comprobarlo contra la guarda que ya existe.**

### Lo que NO se tocó, y por qué queda dicho

Quedan en el texto que ve el usuario **doce** formas de **tuteo** —«estás»
ocho veces, «llegarás», «verás», «podrás», «tendrás»— y alguna más suelta
(«Lo que no mediste no sale»). No son voseo: «estás» es igual en tuteo y en
voseo, y los futuros en -rás son de tú.

§7 pidió sacar el **voseo**, y eso está hecho y guardado. El tuteo es otra
familia y otra decisión —si la aplicación habla de usted en todas partes o
no—, toca ocho archivos que esta tanda no abre, y **darla por hecha de paso
sería tomar una decisión de producto que nadie tomó**. Va acá con su número
para que la próxima tanda la coja entera en vez de volver a descubrirla.

### Demostrado contra la v896

Dos aserciones en rojo de tres, con el estado viejo impreso: «destella false ·
animación none» y «Guardar ficha · rgb(255, 255, 255) sobre borde
rgb(207, 220, 230)».

La tercera **no** falla y es a propósito, como las guardas de la v879, la v882
y la v890: que el botón **no** nazca iluminado. Con el autoguardado detrás, esa
es la mitad que se puede romper sin darse cuenta — y un botón que ya está
verde cuando llegas no acusa nada.

## Cada glifo se dibuja una sola vez (v898)

§3 del pliego de ajustes v2, y el propio pliego lo puso primero: «es lo
primero que se ve de la lámina». Llegó con el síntoma escrito:

> «VVeerrddee nnaattuurraall», «CCuueerrppoo ddee aagguuaa»,
> «7744,,44 ddBB((AA))» … y, sobre todo, El lote a intervenir, donde las
> cotas de los 52 lados quedan completamente ilegibles.

Son **dos defectos distintos** con el mismo resultado —un rótulo que no se
puede leer— y con causas que no tienen nada que ver.

### El arreglo que el reporte proponía era lo que el código ya hacía

§3 cierra con: «si se quiere halo de legibilidad, usar stroke con
paint-order, no un segundo trazo de texto». Eso es **exactamente** lo que
`mini()` hacía desde siempre: un solo `<text>` con `stroke="#fff"`,
`stroke-width="2.4"` y `paint-order="stroke"`.

Así que leyendo el código el defecto no existía, y la tentación era
contestar que no se reproduce. Se midió sobre el PDF, que es donde el
lector lo ve: se genera el documento de las dos hojas con el mismo motor
que lo imprime, se descomprimen sus flujos y se leen los operadores de
texto. Un rótulo con halo sale así:

```
1 1 1 rg            ← blanco
BT /F4 12 Tf  1 0 0 -1 10 30 Tm   <2B> Tj  <24> Tj  <2F> Tj …   ← glifo a glifo
.0706 .1255 .1804 rg  ← tinta
BT /F5 12 Tf  1 0 0 -1 10 30 Tm   <002B0024002F> Tj …           ← otra vez
```

**Dos bloques de texto en la misma matriz**, con fuentes distintas. El de
al lado, sin halo, sale una sola vez. **`paint-order` no evita la segunda
pasada: la ordena.** Catorce rótulos así en una sola corrida de las dos
láminas.

Lo que sustituye al halo es una **plaquita opaca** detrás del rótulo y un
`<text>` liso encima. Se lee mejor sobre la foto —a 5 px de letra, un
contorno de 2,4 se come el glifo— y no puede duplicarse, porque no hay
segunda pasada que duplicar. El ancho de la plaquita se estima por
caracteres —el SVG no sabe medir texto sin montarlo— y el margen va del
lado seguro: una plaquita ancha de más tapa un poco más de mapa, una corta
deja el rótulo saliéndose.

### La cota que no cabe va al cuadro, y se dice

El plano del lote imprimía sus N cotas pasara lo que pasara. Con cuatro
lados eso está bien; con los cincuenta y dos del lote que reportó §3, en un
dibujo de 260 × 210, **no se lee ninguna** —ni las que sobraban ni las que
no—. Medido sobre la lámina compuesta con el lote de veintidós lados de
`tpliegogrande`: **18 solapes**.

Una cota que no se puede leer no es una medida: es tinta encima del plano.
Ahora se mide el sitio que cada rótulo pide y se reparte de lado más LARGO
a más corto —el lado largo es el que tiene sitio y el que manda en la
forma—; el que no alcanza se **numera**, y su medida va a un cuadro al pie
que dice cuántos son y por qué. **No se pierde un solo dato**: es lo que
hace un plano acotado de verdad cuando los linderos son muchos.

Dos cosas que costaron una vuelta cada una:

* **Una cota que se sale del papel se CORRE, no se rinde.** La primera
  versión la mandaba al cuadro, y un lote de cuatro lados con el nombre de
  una avenida perdía una cota por el ancho del rótulo y no por falta de
  sitio. Se prueban cuatro sitios antes de rendirse —el de siempre, más
  afuera, corrido para que quepa, y hacia adentro del lote—, que es lo que
  hace quien acota a mano. Con eso los lotes de cuatro y ocho lados
  imprimen **todas** sus cotas, como antes.
* **La caja estimada de menos deja pasar exactamente lo que mide.** Con
  0,52 em de avance y 9,5 px de alto —el primer intento— quedaban tres
  cotas pisándose en el lote de cincuenta y dos lados: el defecto volvía
  por la puerta de atrás. Los 0,58 em y 11 px que quedaron salen de leer el
  `getBBox` de estos mismos rótulos en el navegador, no de suponerlos.

### Tres guardas, y cada una mide algo distinto

* **`revisar.js`** · ningún `<text>` de lo que se sirve lleva trazo encima
  del glifo. Recorre el disco, no una lista escrita, así que **un
  renderizador nuevo queda vigilado sin que su autor se acuerde**. Y no
  persigue `paint-order`, que sería perseguir un síntoma: persigue el trazo,
  venga como venga.
* **`tdoslaminas`** · sobre el papel ya compuesto, ningún nodo de texto de
  las dos hojas tiene un trazo que pinte. Es la misma afirmación medida en
  el otro extremo, y las dos coincidieron en el número: catorce.
* **`tpliegogrande`** · las cotas del lote, con el `getBBox` de cada una en
  las dos orientaciones. Va ahí y no en `tdoslaminas` porque **aquel lote es
  un predio de ocho lados** (v890) y ahí no se pisa nada ni queriendo: la
  comprobación habría pasado por no tener nada que rechazar. Es el agujero
  que este proyecto lleva trece tandas persiguiendo, y esta vez no hizo
  falta empobrecer ningún material: ya había uno que lo destapa.

Y las dos mitades de esa última hacen falta. Sin la primera —«el plano
imprime las cotas que caben»— se podría «arreglar» la ilegibilidad mandando
todas al cuadro y dejando el plano mudo; sin la segunda, numerando lados
que no se pueden leer en ningún sitio.

### Demostrado contra la v897

Cuatro medidas en rojo, cada una con el estado viejo impreso: la guarda
estática señala `js/24:1352` con archivo y línea; `tdoslaminas` denuncia
**14 rótulos** y los nombra —«69,2 dB(A)», «Autopista Nacional»—;
`tpliegogrande` da **22 cotas · 18 solapes · 0 numerados · sin cuadro**; y
la sonda del PDF pasa de **14 bloques dobles a 0**.

Dos aserciones **no** fallan contra la v897 y es a propósito, como las
guardas de la v879, la v882 y la v890: que el plano siga imprimiendo cotas
—las imprimía todas, solo que ilegibles— y que cada lado numerado esté
medido en el cuadro, que con cero numerados se cumple sola. Son guardas
contra pasarse de corregir, no afirmaciones nuevas.

### Lo que se vio en el papel y NO se tocó

Mirando la lámina impresa —que es el método que encontró los defectos de la
v874, la v882, la v885 y la v887— se ve que en el mapa de hitos dos
rótulos de POI se montan uno sobre otro. Es el mismo defecto de clase que
la cota del lote y **no se arregló acá**, por dos razones: el sector de
prueba los apila porque tiene cinco hitos a veinte metros unos de otros,
que no es un sector real; y para el lote la solución es lossless —el número
remite al cuadro— mientras que para un rótulo de mapa sin lista al lado,
saltárselo perdería un nombre en silencio, que es justo lo que este módulo
tiene prohibido. Queda dicho acá para que la tanda que lo aborde no lo
descubra otra vez.

## Lo que no se midió y lo que no cupo, dichos distinto (v899)

§1 y §2 del pliego de ajustes v2, que son el mismo defecto visto desde dos
sitios: **la hoja declarando que no tiene algo, cuando lo tiene**. Los dos
llegaron con el texto impreso, y en los dos la causa que el pliego supone no
es la causa — que es la regla de la v863 y la v879: una sospecha sobre datos
se comprueba corriendo o leyendo el código, no recordándolo.

### §1 · el cero que era del mapa y salió como diagnóstico

> «CONTINUIDAD DEL PARAMENTO — 0 % del frente de la cuadra con fachada —
> frente roto: el proyecto puede cerrar la cuadra, y eso vale más que un
> retroceso»

El pliego dice que ese cero sale de la plantilla de campo «Actividad en
primer piso», que está en blanco. **No.** `laCuadraDelLote().pctLleno` es la
fracción del tramo de calle cubierta por **huellas de OpenStreetMap**
proyectadas sobre la vía; la plantilla no entra en la cuenta.

Pero el defecto sí es el que el pliego describe, y es exactamente el de la
v875 reaparecido en la síntesis: **con cero huellas mapeadas sobre esa
cuadra, `pctLleno` da cero siempre**. No mide un frente: mide una capa vacía.
Y el cero se convirtió en diagnóstico urbano y en recomendación de proyecto,
que es la forma más cara de equivocarse porque no se ve.

El discriminante ya existía y nadie lo miraba —`cu.edificios`, igual que
`puntos` en la v875—: no hizo falta tocar el motor, solo dejar de leer el
cero como si fuera una medición.

#### La regla, ampliada a las once casillas

§1 la pide sin excepciones, y tenía razón en que la v1 la escribió solo para
las propuestas: **ocho casillas del cierre imprimían una frase donde va la
cifra** —«sin trazado medido», «ninguna clase con un punto mapeado», «sin
ningún proxy medido»—, y a un palmo de «6,1 m²/hab» una frase en ese sitio
se lee como un valor.

Ahora hay dos formas y se distinguen a simple vista: la casilla medida trae
su cifra; la que no se pudo medir imprime **SIN MEDIR** en ámbar y a trazos
—el mismo código visual que los vacíos obligatorios de la v849, porque es lo
mismo dicho en otro sitio: una tarea para quien analiza, no una conclusión
para quien proyecta— y **dice qué la llena**. Sin esa segunda mitad la marca
sería un rótulo; con ella es una tarea de una tarde, que es la decisión de la
v880 con el «cómo se consigue».

### §2 · el chequeo no leía una variable vacía: el panel había cedido

> «SIN DATO — La altura media construida es la misma en las dos láminas ·
> ninguna altura registrada ni contada en campo»
> «SIN DATO — El suelo disponible es el mismo en las dos láminas · sin
> llenos y vacíos medidos»

El pliego concluye: «El chequeo está consultando una variable interna vacía
en vez de la cifra compuesta en el papel. El propio panel dice que lee del
papel y no de las variables: cúmplalo.» **Lo cumple desde la v879**:
`chequeosCruzados` recorre el texto ya compuesto de las dos hojas.

Lo que pasa es otra cosa, y se encontró reproduciéndola: **una caja que CEDIÓ
su sitio para que la hoja cerrara no está en ese texto**. El chequeo entonces
no la encuentra y la daba por no medida. Compuestas las dos hojas con esos
dos paneles apagados, salen las dos frases del reporte **palabra por
palabra** — que es lo que convierte una hipótesis en una causa.

Y el camino hasta ahí valió por lo que descartó, porque las dos primeras
sospechas eran falsas:

* **La escala.** A 177 ha la cascada imprime «131 ha» y a 19,6 km² imprimiría
  un área con separador de miles, que `nDec` no sabe leer —`haDe('… 1.627,1
  ha …')` devuelve `null`, comprobado—. Pero ningún sitio de la hoja imprime
  un área así: `formatearArea` da «19,23 km²» o «131 ha», y el cruce usa
  `num`, que tampoco separa miles. Es un lector frágil y queda dicho, pero no
  es este fallo.
* **El trazado sin medir.** La corrida grande de `tdoslaminas` no volvía a
  medir el trazado, así que los dos paneles no existían y los chequeos decían
  «sin dato» **con razón**. Medir la cosa equivocada habría sido peor que no
  medir: se añadió la medición del trazado a esa corrida antes de seguir.

#### «Sin dato» y «panel fuera» son dos acciones distintas

Un chequeo que no encuentra su cifra dice ahora cuál de las dos cosas pasó, y
en dos colores distintos:

| | Qué significa | Qué hay que hacer |
|---|---|---|
| **sin dato** (ámbar) | la cifra no está en ninguna de las dos hojas | conseguir la fuente que se nombra |
| **panel fuera** (azul) | el panel que la lleva cedió su sitio | apagar otro panel, o imprimir esa hoja suelta |

**Declarar ausente algo medido es peor que un dato de menos** —la lección de
la v861— y acá además desorienta: quien lee sale a buscar una fuente cuando
lo único que hace falta es apagar un panel. Juntarlos bajo el mismo rótulo
los leería como uno solo, que es la misma decisión que la v880 tomó con el
ámbar y el verde.

### El material no podía producir ninguno de los dos

Decimocuarta vez (v862, v866, v874, v877, v880, v882, v884, v888, v889,
v890, v895, v896, v898, y esta), y esta vez fueron dos a la vez:

* **El paramento.** El lote de `tsinmapear` está en el centro del sector,
  donde sí hay huellas, así que la rama medida se ejercitaba y la otra no.
  Se dibuja un **segundo lote** arriba del todo, donde la malla de calles
  llega y las treinta y seis huellas no: la cuadra que le toca no tiene una
  sola fachada mapeada. Las dos ramas se miden en la misma corrida —42 % con
  huellas, SIN MEDIR sin ellas—, y medir solo la segunda dejaría pasar un
  «SIN MEDIR» puesto en todas partes, que es la mentira contraria.
* **El panel que cede.** En la hoja normal los dos paneles están y los dos
  chequeos pasan, así que la comprobación habría pasado por no tener nada que
  rechazar. `tdoslaminas` compone ahora una hoja más con esos dos paneles
  apagados a propósito.

### Demostrado contra la v898

Siete aserciones en rojo, con el texto viejo impreso: **«0 % del frente de la
cuadra con fachada · frente roto: el proyecto puede cerrar la cuadra»** —la
frase exacta que §1 cita—, «sin ningún proxy medido» puesto donde va la
cifra, y los dos chequeos diciendo `sin-dato` sobre un panel que cedió.

Dos aserciones **no** fallan y son guardas, no afirmaciones nuevas: que con
los dos paneles puestos los chequeos se crucen —cierto antes y que tiene que
seguir siéndolo— y que ningún chequeo de la hoja normal se marque como
«panel fuera», que es la manera de pasarse de marcar.

## Una cuenta, una conclusión (v900)

§5 del pliego de ajustes v2, y llegó con la contradicción impresa:

> Lámina B, pie: lista dieciséis mapas por debajo del mínimo de 8 cm y en la
> frase siguiente afirma «Todos alcanzan el objetivo del pliego». Las dos
> cosas no pueden ser ciertas.

No era una contradicción de cálculo —por eso ninguna comprobación de datos
la veía— sino de redacción, y de una clase que vale la pena tener escrita:
**dos frases que salen de la misma cuenta y se deciden por separado.**

`veredictoDeTamanos` saca del recuento de OBJETIVO al mapa que ya cayó por el
PISO: `bajoPiso.push(...)` y `return`. Es correcto para no contar dos veces
el mismo defecto. Pero entonces, cuando TODO lo que se queda corto se quedó
corto por debajo del piso, la lista de objetivo queda vacía y la frase de
cumplimiento —que solo miraba esa lista— sale sola, a dos renglones de los
dieciséis mapas ilegibles.

Un mapa por debajo del piso está, por construcción, por debajo de su
objetivo. Así que la frase de cumplimiento solo se imprime cuando las **dos**
listas están vacías; con mapas caídos la hoja lo dice entero —«pero con los
de arriba por debajo del piso la hoja NO cumple el pliego»— y no agrega nada
que suene a que cumplió.

### El estado que lo produce hubo que construirlo

Decimoquinta vez. En el sector de prueba hay mapas en el tramo de en medio
—92 mm de un objetivo de 100—, así que la lista de objetivo nunca se vacía y
la contradicción no aparece: la comprobación habría pasado por no tener nada
que rechazar.

Se compone una hoja más con los mapas de categoría y los tres de la banda
demográfica apagados, que son justo los del tramo de en medio. Lo que queda
son los cuatro de movilidad, todos por debajo del piso, y la lista de
objetivo se vacía: es el estado exacto del reporte. No hizo falta inventar
un sector, solo apagar paneles con el mismo parámetro que ya existe.

### La guarda persigue la clase, no la frase

Tres aserciones, y cada una tapa un agujero distinto:

* ningún pie de ninguna de las hojas compuestas lista mapas bajo el piso y
  además dice que cumple —la contradicción, como clase—;
* en la hoja construida a propósito, el pie dice que NO cumple;
* y **cada pie que midió cierra en UNA conclusión, ni dos ni ninguna**. Sin
  esta tercera, el arreglo podría haber sido borrar la frase de cumplimiento,
  y entonces una hoja que sí cumple no lo diría: el silencio es la otra
  manera de fallar de un aviso.

### Demostrado contra la v899

Dos aserciones en rojo con el texto viejo impreso: «Por debajo del mínimo de
8 cm: Jerarquía vial 6,2 cm · … A ese tamaño un mapa no se lee en la pared.
**Todos alcanzan el objetivo del pliego.**»

La tercera pasa contra las dos versiones a propósito: es una guarda contra
quedarse sin conclusión, no una afirmación nueva.

### Lo que §4 pide y esta versión NO hace

§4 es la otra mitad del bloque y es una tanda de diagramación entera, no un
renglón: los mapas de categoría a 10 cm, el principal de cada banda a 12, y
—esto es nuevo— **el que no alcance 8 cm no se imprime: se apaga el panel y
se reporta en el pie**.

Eso invierte la decisión que la v886 dejó escrita («entre quitar un mapa y
publicarlo diciendo cuánto mide, se publica diciendo cuánto mide»), y la
invierte quien tiene el pliego impreso en la mano, que es quien decide. Pero
§4 le pone un ORDEN —primero crecer los de categoría cediendo bandas de
texto, después el principal, y apagar solo lo que aun así no llegue—, y
hacer el apagado antes que el crecimiento apagaría nueve de veinte mapas del
sector de prueba en vez de los pocos que quedarían después.

Medido hoy, antes de tocar nada:

| | Lámina A | Lámina B |
|---|---|---|
| mapas | 8 | 12 |
| por debajo de 8 cm | 2 | 7 |
| el más chico | 6,5 cm | 6,5 cm |
| los de categoría | — | 9,2 cm de 10 |

Queda como la tanda siguiente, con la medición hecha.

## El orden de cesión, declarado (v901)

§4 del pliego de ajustes v2, y la parte que faltaba de la v886. Aquella midió
los veinte mapas de las dos hojas y dio la respuesta honesta: nueve por debajo
del piso de 8 cm, el más chico en 6,5, y «cada milímetro por encima de ~66
cuesta un panel medido». §4 pide lo contrario —los de categoría a 10 cm, el
principal de cada banda a 12, ninguno bajo 8— y el reporte del usuario lo
resolvió por otro lado: **una banda puede ocupar varias filas.**

    v900          9 de 20 mapas bajo 8 cm · el más chico 6,5 cm · 0 paneles ceden
    v901          0 de 20 mapas bajo 8 cm · el más chico 8,2 cm · 2 paneles ceden

Los dos que ceden son de la banda de movilidad y van declarados por su nombre.

### El nudo: el ancho de la banda y sus pistas eran el mismo número

Hasta la v900 el ancho de un mapa salía de repartir la fila entre TODO lo que
la banda tiene, en una sola fila: con ocho mapas en la banda demográfica eso
da dieciséis pistas y cada mapa se queda con 65 mm. Y crecer la hoja no lo
arregla, lo **empeora**: al crecer entra más contenido por fila y la pista se
estrecha todavía más —medido, el mínimo baja de 75 a 67 mm entre el 34 % y el
100 %—.

Bajar las pistas tampoco servía, y ahí estaba el nudo: `bd.cols = pistas / 2`
y la rejilla se escribía con `repeat(cols × 2)`, así que **el ancho de la
banda en la fila y sus pistas por dentro eran el mismo número**. Bajar las
pistas para ensanchar los mapas estrechaba la banda en la misma proporción y
cada mapa se quedaba igual. Se separan: `bd.pistas` es lo de adentro, `bd.cols`
lo de afuera, y la banda se queda con la fila entera y crece hacia abajo, que
es donde la hoja de 90 cm tiene sitio.

### El peso de un mapa deja de valer ANCHO

Lo destapó mirar el papel, no el código. Con la banda a doce pistas, un mapa
de peso 2 se llevaba cuatro —184 mm de ancho— y su dibujo se quedaba en 97 mm
de alto: **el 47 % de esa caja era papel en blanco a los lados**, y el LADO
MENOR —que es lo que §21 mide— no sube ni un milímetro por ser más ancho.

Así que en la banda reflujada todos los mapas valen dos pistas menos el
PRINCIPAL de la banda, que conserva el suyo. El peso sigue estando en
`data-p`, de donde sale quién es el principal y a qué piso se lo mide; solo
deja de traducirse en pistas. Es lo que más papel devolvió de toda la tanda:
con la mitad del ancho por mapa, la banda demográfica pasó de cuatro renglones
a dos, y cada renglón que se ahorra son paneles que no tienen que ceder.

Y entonces **la pista ES el lado del mapa**, así que el mínimo de pista sube a
los 10 cm que §4 pide para los de categoría. No es un número nuevo: es el
mismo de §4, aplicado donde de verdad decide.

### La cuenta de la pista es la de la grilla, no una regla de tres

Costó una vuelta y es fácil volver a equivocarse: **un mapa no vale dos
pistas, vale el doble de su peso.** Con `2 · ancho / mínimo` —el primer
intento— un mapa de peso 2 se medía como si ocupara la mitad de lo que ocupa,
así que pedirle 10 cm a la banda de categorías la dejaba en diez pistas cuando
le caben veinte, y de ahí salían tres renglones de mapas y ocho paneles menos.
La buena:

    ancho de un mapa de peso w en p pistas
      = 2w · (útil − (p−1)·gap) / p  +  (2w−1)·gap

Se prueba pista por pista de mayor a menor y se toma la mayor que deje a TODOS
los mapas de la banda por encima de su mínimo. En par, porque una caja vale
dos pistas y una fila impar deja una suelta en cada renglón (v850).

Comprobada contra lo medido antes de conectarla: a doce pistas la fórmula da
90 mm y el papel da 89.

### Manda el número de RENGLONES, no el hueco

`pistasQueLlenan` elige, entre las anchuras que el mínimo permite, la que deja
menos papel en blanco — pero **primero la que deja menos renglones**. Medido al
revés, minimizando el hueco a secas, la banda se iba a tres y cuatro renglones
y la hoja pasaba de una cesión a dieciséis: un renglón de más son diez
centímetros de papel y, al final de la cadena, paneles que ceden.

### ORDEN DE CESIÓN, y por qué se declara

Pedido con estas palabras: «el reequilibrio se resuelve con jerarquía
explícita, no por lo que sobre». Cuando la hoja se llena, el sitio lo cede en
este orden:

1. los paneles de texto;
2. los mapas y gráficos de análisis **secundario** —los anillos, la serie
   temporal, la calle comercial—, que son los que no abren su banda;
3. los mapas **principales** de banda, al final;
4. **NUNCA**: las once casillas de la síntesis ni la banda de coherencia, y con
   ellas «Suelo disponible real» y «Potencial edificatorio».

La razón de la cuarta va escrita porque es la que cuesta: **la síntesis anuncia
once cruces, y publicarla con nueve es mentir por omisión sin escribir nada
falso.** Los dos paneles de la lámina A entran en la lista porque de ellos
salen dos de esas once: con el panel fuera, el cruce de la B se queda sin con
qué cruzarse, que es justo lo que la v899 acababa de aprender a decir.

**El peldaño 3 no tiene lista escrita.** El principal de una banda es el mapa
de más peso que esa banda trae; con dos iguales, el primero — la misma regla
con la que la v886 decide a qué piso se mide cada mapa. Se calcula sobre la
hoja YA compuesta, de donde salen el peso y la banda de cada mapa: deducirlo de
una tabla aparte sería una segunda ruta de cálculo para la misma cantidad, y
esas no divergen el día que se escriben (v879). En el sector de prueba reparte
solo: los anillos, los hitos y la calle comercial quedan en el peldaño 2, y la
jerarquía vial, la foto y el de todos los usos en el 3. Son exactamente los
tres que el pedido nombra como secundarios.

#### La bisección apagaba paneles de la OTRA hoja

Encontrado al medir la lista de lo que cedía: 34 renglones, y los nueve
primeros repetidos. `ordenDeSacrificio` recorría `cajasDelPliego`, que no sabe
de hojas, así que componiendo la B se apagaban cajas de la A —que no liberan un
milímetro— y después se declaraban fuera. El pie de la B nombraba paneles que
nunca habían estado en la B. Ahora los candidatos se leen del papel
(`cajasEnLaHoja`): lo que no está compuesto no puede ceder.

### El método extendido NO cede, y costó medirlo

El orden pone de primero «los paneles de texto explicativo y método extendido»,
y lo barato parecía acortar el pie de método de las treinta y pico cajas: dejar
la fórmula y la fuente, ceder confiabilidad, referencia y error típico. Medido,
devolvía **tres paneles**.

Y costaba dos declaraciones que la hoja tiene obligación de hacer, las dos
escondidas justo en los renglones que se iban: la **referencia** de
`calor:categoria` es donde la lámina explica por qué la línea y no solo el
degradado (v877), y el **error típico** es donde dice que dar por bueno un
chequeo que no se pudo correr es el error de esta hoja (v879). Las dos tienen
su aserción, y las dos se pusieron rojas.

No es una cesión, es un silencio: tres paneles a cambio de que treinta cajas
dejen de decir de qué se fían y en qué se suelen equivocar. Se deshizo —el
modo corto ni siquiera se quedó en el código, que es lo que la v885 enseñó
sobre dejar funciones que nadie llama— y queda escrito acá para que la idea no
vuelva a parecer buena.

#### Y no hay un solo panel de PROSA

De paso salió una medición que resuelve la ambigüedad del peldaño 1: de las 37
cajas de la lámina B, **ninguna es solo texto**. Todas traen una figura, una
tabla, una baldosa de cifra o una cuadrícula — los paneles de campo y los de
vacío incluidos. Así que «paneles de texto explicativo» no separa nada en este
pliego: el peldaño 1 son los paneles, y dentro de él sigue mandando el orden de
atrás hacia adelante. Comprobarlo costó dos minutos y evitó inventar un
criterio para repartir una lista vacía.

### Las once casillas, apretadas antes que perdidas

«Prefiero once casillas apretadas que nueve holgadas.» Si ni apagando todo lo
cedible cierra la hoja, lo que sigue no es tirar la síntesis: es componerla de
nuevo con las casillas en formato **compacto** —título, cifra y una línea— y
volver a buscar. La línea que queda es la primera frase y no un recorte por
caracteres: cortar por número de letras deja el renglón a media palabra, y un
«…» en mitad de una conclusión se lee como un dato incompleto en vez de como
una lectura corta.

### El control de cierre: la hoja no exporta si no cuadra

«Si el número de casillas compuestas es distinto del número de cruces que la
banda declara, la hoja no exporta y lo reporta.» Es el mismo principio del §5
que la v900 puso en el pie, aplicado a la síntesis, y **corta la exportación**
en vez de avisar al pie: un aviso al pie de una hoja incompleta se lee después
de haberla impreso.

Se cuenta sobre el HTML ya compuesto y no sobre la lista de cruces, que es la
regla de la v879: una casilla que se cayó por el camino —la caja apagada, la
rejilla recortando, un error tragado por un `catch`— no existe en la variable;
existe, o deja de existir, en el papel. Y se cuenta solo cuando la hoja TRAE la
síntesis: exigirle once casillas a la lámina A sería un rojo permanente que no
significa nada, la misma decisión que la v886 tomó con la hoja acostada.

### La acostada se queda como estaba

El reflujo es de la hoja PARADA. Los pisos de §21 están escritos «contra la
hoja de 60 × 90»; la acostada es de 90 × 60, con 30 cm menos de alto, así que
repartir sus bandas en varios renglones le quita justo el alto que no tiene.
Medido, le dejaba la banda demográfica con **22 celdas vacías** y once dibujos
al 45 % de su caja. Es la misma decisión de la v886 —no se le aplican unos
pisos que el pliego no pidió para ella—, dicha ahora para la diagramación y no
solo para el aviso.

### El punto decimal, otra vez, en el renglón nuevo

La guarda de la v885 cazó su propia clase en un sitio que no existía cuando se
escribió: el pie de tamaños imprimía el objetivo con `piso / 10` y salía
**«8,7 cm de 9.2»**, un punto decimal en una hoja en castellano, al lado de una
cifra bien escrita. Es exactamente para lo que la v891 amplió esa guarda a
todas las unidades. Ahora el objetivo pasa por el mismo `cm()` que la medición.

### Nada se cae en silencio

`tdoslaminas` compara ahora los títulos de la hoja SUELTA contra los de la
compuesta y exige que cada diferencia esté en `pliegoFuera`. La suite solo
miraba que los paneles que le interesaban estuvieran; la promesa de la v850
—«lo que cede se dice por su nombre»— no la vigilaba nadie.

Dos cosas de esa comparación:

* **Se compara por IDENTIDAD, no por título.** Una caja de mapa se titula «X ·
  el mapa» y se declara fuera por su identificador (`sombras`), así que el slug
  del título no la reconocía: la comprobación denunciaba un mapa caído en
  silencio que estaba declarado con todas las letras.
* **Contra una hoja compuesta con las MISMAS opciones.** La A suelta de esta
  suite lleva el clima inyectado y el documento no, así que «El clima» salía
  como panel perdido cuando nunca había estado. Se compone una A de referencia
  sin nada inyectado.

Y el lector de hojas se extrajo con nombre (`LECTOR`) porque ahora se aplica a
dos documentos: lo que un panel DICE se comprueba donde el panel existe; lo que
la hoja compuesta tiene que cumplir es otra cosa y se comprueba aparte. Dos
lectores para lo mismo divergirían a la tanda siguiente.

### La rama del reporte ya no se puede alcanzar, y eso también se mide

La contradicción de §5 —dieciséis mapas impresos bajo el piso y «todos alcanzan
el objetivo»— no se alcanza más en la hoja parada, y no por tolerancia: por
construcción. El reflujo garantiza que ninguna pista baje de 10 cm de ancho, y
el alto de un mapa al piso de composición del 30 % son 8,25 cm, así que el lado
menor no puede caer de 8. La aserción que lo medía se dio vuelta: ahora dice
que **ninguna composición tuvo que apagar un mapa**, y si un día una lo hace,
se pone roja. La otra mitad —que ese pie diría que la hoja NO cumple— se queda
escrita, declarada en la suite como una guarda sin material.

De paso quedó cerrada la misma contradicción con otra ropa: un pie que decía
haber apagado un mapa por no llegar a 8 cm y dos renglones después que todos
alcanzan el objetivo. Todos los que quedaron, que no es lo que el lector
entiende.

### Demostrado contra la v900

Los veinte mapas de las dos hojas, por su lado menor y sobre el papel ya
compuesto: **9 por debajo de 8 cm y el más chico en 6,5**, contra 0 y 8,2 de
esta versión. Y la lista de lo que cede, que la v900 no publicaba: dos
paneles, los dos nombrados en el pie.


## La ciudad, también de OpenStreetMap (v902)

§11 del pliego de ajustes v2, y la prioridad de contenido de la tanda. Desde
la v876 la lámina compara con la ciudad todo lo que sale del censo —población,
densidad, pirámide, reparto por sexo— y declaraba faltando, en un solo
renglón, las tres cosas que salen de OpenStreetMap: espacio público, densidad
de usos y cobertura de equipamientos.

Auditado antes de escribir, que es la regla de la v863, **las tres no son la
misma carencia**: dos salen de correr el análisis de siempre sobre el
municipio, y la tercera no puede salir de ahí ni queriendo. Escribirlas juntas
había escondido esa diferencia durante veintiséis versiones.

    v901          población · densidad de población · pirámide · sexo
    v902          + densidad de usos · + cobertura de los cuatro equipamientos

En el sector de prueba sale «6,6 usos por ha contra 0,2 · 28,9 veces» y la
cobertura de colegio, salud, parque y abastecimiento, categoría por categoría.

### Correr el análisis de siempre, no escribir una cuenta nueva

La corrida municipal le pide a Overpass el municipio y le pasa la lista al
motor **tal cual**, con `tipoEstudio: 'completo'`. Así la densidad de usos y
la cobertura de la ciudad salen de las mismas funciones que las del sector.
Escribir una cuenta «para la ciudad» habría sido comprar de antemano la
divergencia de la v879: dos rutas de cálculo para la misma cantidad no
divergen el día que se escriben, divergen la tanda siguiente.

Tres decisiones más, y las tres se notan el día que no están:

* **Solo cuando se pide.** Es una consulta de mil kilómetros cuadrados y quien
  abrió la ficha quería mirar un barrio. Va en un botón de la pestaña de
  ambiente, al lado del terreno y por la misma razón: las dos cuestan una
  consulta grande y las dos dicen en su pista qué van a traer **antes** de que
  alguien gaste dos minutos.
* **Se guardan las CIFRAS, no los elementos.** Catorce mil elementos son
  megabytes, y el recorte por cupo de `localStorage` se llevaría por delante
  las fichas, que son el trabajo de una tarde (v871). Lo guardado son ocho
  números y su fecha, por municipio y por medio año —el censo dura treinta
  días porque el DANE puede corregir una capa; esto dura más porque lo que
  cambia es OpenStreetMap, que se mapea de a poco—.
* **Se le pega al RESULTADO, no se lee desde la caja.** Es la regla de la v890
  con el área: una ficha archivada se vuelve a componer con este código, y
  leer el almacén desde el panel imprimiría la referencia que haya HOY sobre
  un análisis de hace un mes. Pegada al resultado viaja con la ficha y con su
  fecha.

### Dónde queda el municipio, que la v876 nunca necesitó saber

La referencia del censo sale de CONTAR manzanas por código, así que nunca hizo
falta ninguna geometría. Correrle un análisis encima sí: hace falta un centro
y un tamaño. `extensionCiudad` se lo pregunta a la misma capa con
`returnExtentOnly` —una petición barata, que no devuelve una sola geometría
sino el rectángulo que las contiene— y corrige el ancho por el coseno de la
latitud, porque un rectángulo de grados no es un rectángulo de metros.

**La clave del censo municipal sube a `_v2`.** El objeto guardado trae un
campo más, y sin subir el número un teléfono que ya tenía la referencia de la
v876 la seguiría sirviendo SIN extensión durante treinta días: el botón
contestaría «no se sabe dónde centrar la consulta» justo a quien ya usaba la
comparación. Es la regla de la v882 con la clave del clima, y la de la v852:
un arreglo que sirve para todos menos para quien ya sufrió el fallo no está
hecho.

### El área de la consulta y la del denominador son LA MISMA

Se pide un círculo del **área censada** del municipio centrado en su
envolvente, y la densidad se divide por esa misma área censada. Pedir el
rectángulo envolvente entero —que incluye suelo rural— y dividir por el área
censada urbana contaría usos de vereda contra hectáreas de ciudad, y la
densidad de la ciudad saldría inflada sin que nada lo dijera.

Y lo que el círculo no es va escrito **en la hoja**, no solo acá: tiene el
área correcta en el sitio correcto, pero deja fuera manzanas del borde y mete
suelo que no es manzana, así que la columna de ciudad es una referencia de
orden de magnitud y no un dato del perímetro urbano.

### El espacio público NO sale de ahí, y la razón es la misma que lo explica

A escala municipal la consulta sale **siempre en ligera** —por encima de
50 km² las capas de área no terminan (v851)—, así que llegan los usos con
puerta a la calle y no los polígonos. Para las dos cifras que se publican eso
no cambia nada: contar usos y medir cobertura de equipamientos se hace sobre
puntos. Pero el área de parques y plazas sale de **polígonos con su
geometría**, que son exactamente lo que la consulta suelta.

Publicar un espacio público municipal sin esas capas sería un cero disfrazado
de medición, que es el error de la v875 a escala de ciudad. Así que se queda
en la lista viva con su razón propia, y **las dos cosas se dicen juntas en la
hoja** o la segunda parece un capricho.

### El tope de salida ya estaba detectado, y mi cuenta estaba mal dos veces

El hallazgo de la tanda, y era mío. Un conteo que toca el tope de `out` no es
un conteo: Overpass recorta la salida y no avisa, así que una densidad sacada
de una lista recortada sale por debajo de la real y no hay manera de saber
cuánto. Escribí la detección a mano —`elementos.length >= escalaDeConsulta(área).tope`—
y estaba mal de las dos maneras que importan:

* **`js/61` ya lo detecta desde la v851** y lo manda pegado a la lista, en
  `aviso`, con el número dentro. La mía era la segunda ruta de cálculo que la
  v879 prohíbe, escrita en la misma tanda en que la cité.
* **Y medía después de la limpieza**, sobre una lista ya más corta que la que
  el servidor cortó, así que un tope tocado por poco se me escapaba en
  silencio.

Se lee del aviso. La densidad entonces **no se publica** —ni en la hoja ni en
el panel— y se dice por qué, con el tope y con la consecuencia; la cobertura
sí se compara igual, porque un porcentaje de área cubierta no se hunde porque
falte cola de lista. Son dos cosas distintas y se tratan distinto.

### Seis estados, nunca un null

`correrCiudadOSM` devuelve siempre un objeto con su `estado`: `sin-censo`,
`sin-area`, `sin-centro`, `sin-modulos`, `sin-respuesta`, `sin-motor`, `ok`.
Es la regla que la v876 escribió para `censoCiudad`: son situaciones que piden
acciones distintas —repetir con señal, corregir el patrón del campo, o nada— y
un null las juntaría en una. Sin área censada **ni siquiera se sale a la red**:
no hay sobre qué correr la consulta ni con qué dividir, y gastar dos minutos
para averiguarlo sería gastarlos para nada.

### Una razón grande se dice en VECES, también en la columna de diferencia

Salió mirando el papel. La densidad de usos de un barrio contra la de su
municipio imprimía **«+18.177,8 %»**: aritméticamente cierto y sin significado,
que es exactamente la clase de la v874 —pasado cierto punto un porcentaje deja
de ser una proporción y pasa a ser un número largo—. `parConCiudad` usa ahora
el mismo corte del 300 % que `razonLegible` y dice «28,9 veces».

La regla es de la columna, no de este par: vale para cualquier par de
magnitudes. Y por debajo hay la otra mitad, que el corte simétrico no
resuelve: menos del −90 % se dice «la 10.ª parte», porque una razón menor que
uno se lee peor que el porcentaje.

**La comprobación vive en `tciudad` y no en `tdoslaminas`**, y es la lección de
las trece tandas anteriores: sin la referencia municipal ningún par de la hoja
pasa del 300 %, así que allá habría pasado por no tener nada que rechazar.

### Dos errores míos, los dos de leer un nombre en vez del código

* **`paso.paso` no existe.** El aviso de js/61 llega como `{ id, etq,
  presupuestoMs }` desde la v870, así que el paréntesis del aviso de espera
  salía vacío en cada paso. Un «(…)» que no dice nada es peor que no ponerlo.
* **`parConCiudad` ya escapa su etiqueta**, y pasársela escapada imprimía
  «Colegio o jard&amp;iacute;n» en la hoja.

Los dos son la regla de la v863 en pequeño: se comprueba leyendo la función,
no recordando cómo se llama su campo.

### `tciudad.js` · tres ramas, tres contextos

Suite propia, y las tres ramas en corridas separadas porque **cada una
necesita un doble del DANE distinto**: el tope de salida se deduce del ÁREA del
municipio, que es justamente lo que las separa.

| Rama | Qué ejercita |
|---|---|
| `ok` | los pares se imprimen, la procedencia se dice, la lista de carencias se encoge |
| `truncada` | 3 km² censados, tope 3.000, 3.000 elementos servidos: la densidad no se publica y se dice por qué |
| `sin-area` | no hay referencia y **no se gastó una consulta** para averiguarlo |

Dos cosas del material, que son la enésima vez que aparece lo mismo:

* **El doble del DANE no sabía contestar por extensión.** Sin `extent`, la
  corrida municipal habría medido siempre el estado «no se sabe dónde
  centrarla» y la comparación entera se habría probado sin comparar nada — la
  lección de la v876 con `COD_DANE_MPIO`, otra vez y en el mismo doble. La
  extensión es **deliberadamente mayor** que el área censada, como pasa de
  verdad: si fueran iguales, la diferencia entre envolvente y área censada no
  se ejercitaría.
* **El municipio contesta cosas distintas del sector.** 1.400 usos repartidos
  por todo el círculo contra 208 en un cuadrado de 560 m: si contestara lo
  mismo, todas las diferencias darían cero.

Y una del arnés que costó una corrida entera: **la consulta viaja en el cuerpo
URL-codificada**, así que `around:4425` es `around%3A4425` y el patrón con el
que la suite distingue la consulta municipal de la del sector no casaba. El
doble le servía los usos del SECTOR a la consulta del municipio, la referencia
salía con 208 usos y la rama truncada medía un municipio que nunca se
consultó. Se decodifica antes de mirar.

De paso, el bloque de la ficha lleva `id="pcr-ciudad"` y no una clase nueva:
es el asidero con el que la suite lee **sus** pistas y no las del bloque de al
lado —medir las de la pestaña entera daba por buena la pista del terreno, que
es la lección de la v874 con `.hit`— y así no se le inventa a la hoja de
estilo una clase que nadie pinta (v895).

### Demostrado contra la v901

Veinte aserciones en rojo de veinticinco: «no está» por el bloque, «0
consultas», «no sale el par», «ninguna» por las cuatro coberturas, «lo calla»
por el círculo, y la corrida truncada sin marcar.

Cinco pasan a propósito y son guardas o vacíos, no afirmaciones nuevas: que
antes de correrla la hoja NO compare la densidad de usos —cierto en las dos
versiones—, que sin pares no haya nombres escapados dos veces, y las dos de la
rama `sin-area`, que en la v901 se cumplen por no haber referencia ninguna.

## Un volumen que nadie autorizó, y dos bandas mudas (v903)

§6 a §10 del pliego de ajustes v2. Cinco cosas de distinta clase con un solo
hilo: **la hoja afirmando por descuido lo que no puede sostener.**

### §6 · «el volumen de la norma» eran los valores de ejemplo

El pliego lo trajo impreso de la corrida real:

> LA SOMBRA QUE PROYECTA — 204.544 m² de sombra sobre 4 pisos y 523.161 m²
> de huella, «el volumen de la norma»

y dos palmos más abajo, en la misma hoja, el panel de norma urbana diciendo
SIN DATO OFICIAL. Los 4 pisos y el 0,6 de ocupación son `Q.porDefecto()`:
números de ejemplo con los que llega la herramienta, que la pantalla de «Qué
cabe en el lote» rotula como tales —«ejemplo», en gris— y que la lámina
imprimía como norma.

Es la falta de la v875 en su forma más cara: **una cuenta correcta sobre un
supuesto inventado, presentada como medición**. Y el discriminante existía y
nadie lo miraba —`S.indicesPuestos`, que marca los campos que una persona
escribió de verdad—, igual que `puntos` en la v875 y `cu.edificios` en la
v899. Tercera vez.

Sin los tres índices del POT —ocupación, construcción y altura; el tamaño de
vivienda no entra porque lo decide quien proyecta y no cambia la sombra— el
panel imprime el **vacío**, con el trámite del panel de norma urbana: es el
mismo documento el que llena a los dos. Y **el mapa tampoco se dibuja**: una
mancha de sombra se mira y se cree, así que dejarla mientras la caja dice que
no se puede calcular sería desmentir el aviso con la figura de al lado.

Vuelve solo el día que alguien escriba la ficha normativa, que es lo que §6
pide: no hay lista ni bandera, el panel se enciende solo cuando `indicesPuestos` los trae.

#### La clase de la caja se decide AFUERA del cuerpo

`caja(titulo, cuerpo, clase)` recibe la clase como tercer argumento, así que
desde dentro del cuerpo no se puede pedir el ámbar de los vacíos. `sp` se lee
una vez fuera y el cuerpo se arma en su propia función. De paso sale gratis
lo que más importa: `caja()` **ya suprime el pie de método en las cajas
`caja-vacio`** desde la v880, así que el método «sombra del volumen permitido
a las 9, 12 y 15 h» desaparece solo. La costura estaba puesta.

### §7 · dos bandas cerrando con el texto de la bolsa de sobras

«Riesgo y servicios» (lámina A) y «Coherencia de las cifras» (lámina B) no
tenían `case` en `conclusionDeBanda`, así que caían las dos en el `default` y
cerraban con «Estas mediciones no pertenecen a ninguna de las bandas
anteriores» — sobre dos bandas con tema, título y pregunta propios impresos
dos centímetros más arriba.

* **Riesgo** cierra en lo suyo —amenaza sísmica, mancha de inundación, piezas
  de infraestructura— y en lo que esta banda tiene que dejar dicho pase lo que
  pase: nada de eso es el estudio oficial. Sin esa frase, una amenaza «media»
  calculada se lee como una amenaza media declarada, que es justamente la
  confusión que la banda existe para deshacer (v853).
* **Coherencia** cierra en su recuento: cuántos pasan, cuántos fallan, cuántos
  no se pueden correr, cuántos se quedaron sin cruzar porque su panel cedió.
  Los números salen de `resumenCoherencia`, que **deja puesto el propio
  panel** al armarse; recalcular los chequeos para el pie sería la segunda
  ruta de cálculo de la v879.

Y una del método, que es la regla de la v863 en la frase que la cita: escribí
`inu.pctInundable` de memoria y **ese campo no existe** —lo que hay es
`cobertura`, `trPeor` y `dentroDe`—. La línea habría salido en blanco sin que
nada se pusiera rojo.

### §8 · «trae tres paneles» y eran siete

La conclusión de la banda de campo decía «tres paneles para llenar a mano»
desde la v848. Son tres de percepción **más** los vacíos obligatorios, que
eran cinco y la v880 dejó en cuatro. El renglón se quedó viejo el día que
cambió la lista, y lo habría vuelto a hacer la próxima vez.

Ahora los cuenta el programa —`PANELES_DE_CAMPO.length`, `PANELES_DE_VACIO.length`,
`PLANTILLAS_DE_CAMPO.length`—, con su singular y su plural. **Un conteo escrito
a mano dentro de un texto fijo es una cifra que envejece sola**: es la lista
viva de la v866 dicha dentro de la hoja.

### §9 · la hoja habla de usted

La v878 sacó el voseo. El TUTEO se quedó, y la v897 lo dejó escrito con su
número: «otra familia y otra decisión — si la aplicación habla de usted en
todas partes o no… darla por hecha de paso sería tomar una decisión de
producto que nadie tomó». §9 la toma: «unificar todo en usted».

Medido con el mismo recorrido de `revisar.js` —fuera de comentarios y fuera de
expresiones regulares— salieron **48 en el módulo educativo** y 209 más en el
resto de la aplicación. Se hicieron los 48 y los del panel de licencia, que es
la primera pantalla que ve un estudiante: **uno por uno y no con un reemplazo
masivo**, porque cambiar el pronombre no conjuga los verbos de alrededor y la
v878 dejó cinco frases torcidas por hacerlo al revés.

**Los 209 del resto de la aplicación no se tocaron**, y se dice acá con su
número: son módulos que este pliego no nombra —reportes, mascotas, deporte,
presencia— y unificarlos es una decisión de producto sobre toda la aplicación,
no sobre esta lámina. Queda medido para la tanda que la tome.

#### La guarda va sobre el PAPEL, no sobre los archivos

Y esto costó una vuelta averiguarlo. Recorriendo el código, «te» y «tu» casan
dentro de identificadores —`var te = ter.elevacion`— y una guarda con esa
clase de falso positivo termina con una lista de excepciones que envejece
hasta no significar nada, que es la razón por la que la v895 no persigue «clase
sin regla». Sobre los **nodos de texto de las dos hojas compuestas** no hay
identificadores: lo que está ahí es lo que el jurado lee. La guarda vive en
`tdoslaminas` y persigue la clase entera, no las tres frases del reporte.

#### Y mi propio barrido tenía el fallo de siempre

Escribí `/\s|$/.test(f.slice(-1))` para saltar la comprobación de la letra
siguiente cuando la forma acaba en espacio. **`$` casa la cadena vacía
siempre**, así que la guarda nunca corría y «puedes» casaba dentro de
«puedeSubir»: el primer inventario dio seis casos de humo. Es la trampa de la
v878 y de la v891, en mi propio barrido, por tercera vez. La guarda buena del
proyecto —la que pone los límites a mano— no se equivocó.

### §10a · un solo total en toda la hoja, o la diferencia dicha

«2.526 usos» en el encabezado, el plano y los anillos; «2.523» en «Qué hay,
por categoría» y en las propuestas. No es un error de cuenta: esa tabla
descarta a propósito el grupo «otro» —el uso que el motor no pudo
clasificar— porque una barra de «indefinido» no dice nada.

**No se arregla metiendo «otro» en la tabla ni cambiando el total del
encabezado**: los dos números son correctos y miden cosas distintas. Se
arregla diciéndolo, que es lo que el pliego pide con esas palabras —«si hay
registros descartados, decir cuántos y por qué»—. La tabla imprime ahora su
suma contra el total del sector y nombra la diferencia.

### Los cuatro sectores de prueba, y las dos ramas

La rama del vacío de §6 la mide `tdoslaminas`, cuyo lote es un predio de tres
mil metros que nadie ha normado —el caso de cualquier estudiante el primer
día—. La rama MEDIDA la miden `tlaminaedu`, `tpliegogrande` y `tmasanalisis`,
que escriben los tres índices **con los campos de verdad** (la regla de la
v871: para cambiar el estado desde una prueba se usa el botón).

Las dos hacen falta, y por razones opuestas: sin la primera la hoja vuelve a
inventarse una norma; sin la segunda, un «no se puede calcular» puesto en
todas partes pasaría por bueno. Es la decimosexta vez que esta tanda de
comprobaciones necesita las dos ramas para significar algo.

`tlaminaedu` además pide los quince mapas del sector, y uno de ellos es este:
sin los índices puestos, esa suite habría empezado a fallar por un cambio
legítimo. Se hizo más precisa —ahora exige que el cierre hable de usted— y no
más laxa.

### Lo que §10 pide y esta versión NO hace

Cuatro de las cinco cifras que §10 nombra no se pudieron perseguir desde acá,
y decirlo es más útil que un arreglo a ojo:

| | Por qué queda |
|---|---|
| b · dos tramos de edad con el mismo valor | pide reproducir el reparto del censo real; el doble del DANE no lo produce |
| c · 3.760 contra 3.673 edificios | son dos consultas distintas —`out center` y `out geom`— y los paneles que las imprimen eligen con el MISMO ternario: la divergencia no se reproduce con este material |
| d · 2014 y 2017 idénticos | pide la serie satelital real, que esta batería no descarga |
| e · 6,3 % contra 6,2 % de pendiente | un redondeo en dos sitios, y el sector de prueba no lo produce |

Las cuatro tienen la misma forma que §10a y el mismo arreglo posible —una
cuenta, un sitio— pero **arreglar a ojo lo que no se puede medir es lo que
este proyecto lleva cinco tandas deshaciendo** (la mudanza de la v882, la
bisección de la v886, la fila de texto de la v901). Quedan con lo que se
averiguó de cada una. §12 y §13 quedan enteras.

## La etiqueta y los ejemplos hablan de lo mismo (v904)

§12 y §13 del pliego de ajustes v2, que cierran el documento. Auditados antes
de tocar —la regla de la v863— y el primero salió a medias resuelto.

### §12 · los moteles ya estaban fuera de los hitos; el problema era otro

«En hitos y nodos, excluir alojamiento por hora» **está hecho desde la v874**:
`hotel` no está en `PESO_DE_HITO` y un motel solo entra si trae `wikidata`,
`wikipedia` o `heritage`, que es la señal más fuerte de que algo sí es un hito.
Lo que quedaba vivo del reclamo es lo de la calle comercial, y era peor de lo
que parecía.

**El rótulo de un núcleo y los nombres que lo acompañan salían de dos
subconjuntos distintos.** El rótulo, del rubro mayoritario del grupo; los
nombres, de los cuatro más cercanos que tuvieran nombre propio. En la corrida
real eso imprimió «Restaurante» sobre Tiendas D1, Yamaha y MaoTech.

La etiqueta era **cierta del grupo y falsa de los tres nombres que la
acompañan** — y los nombres son la única parte que el lector puede comprobar.
Ahora los del rubro dominante van primero y los demás completan por cercanía,
así que la etiqueta y los ejemplos hablan de lo mismo. Y va **cuántos de
cuántos**: «Restaurante (4 de 12)» es una mayoría relativa, y decirlo es la
diferencia entre un rótulo y una medición.

Obliga a `node construir.js` y a **reiniciar el servidor**.

#### «Hotel / Hospedaje» no describe lo que agrupa

El `sub` casa `motel` y `love_hotel` además de hotel, hostal y guest house.
En un corredor de Cúcuta el alojamiento por hora es la mayoría de esa clase, y
la etiqueta lo callaba. Pasa a **«Hotel, hostal o motel»**: nombra lo que hay.
Sacarlos de la lectura de usos sería otra cosa y no se hace — ahí cuentan,
que es lo que la v874 dejó decidido.

La etiqueta vive en `js/59`, que es el catálogo que el motor **reensambla**
con sus reglas: una sola edición y las dos mitades quedan de acuerdo, con la
comprobación de posición que ya salta si se desordenan.

### §13 · tres cosas menores y una que no lo era

* **«caben 1089,9 veces»** — la décima no significa nada y encima finge una
  precisión que un «área típica» no tiene. Entero. Es la clase de la v874.
* **Una frase incompleta** impresa en el pie de las propuestas: «cada
  propuesta cita la cifra que la suya». Dice ahora «la cifra que sostiene la
  suya».
* **«Sin nombre en el geocodificador: Comuna»** con el estudiante habiéndola
  escrito a mano dos pantallas antes. El campo de ubicación administrativa
  lleva su orden en el propio marcador de posición —«Comuna, municipio,
  departamento»— así que el primer segmento es la comuna, y con un solo
  segmento no se supone que lo sea.

  **Y la casilla dice que ese nombre lo escribió una persona.** Un nombre
  tecleado y uno consultado se ven igual impresos, y esta hoja no presenta lo
  uno como lo otro: es la regla del aviso de origen de la v867 en una casilla
  de quince milímetros. Solo la comuna se toma de lo escrito — el municipio y
  el departamento el geocodificador los acierta casi siempre, y
  sobrescribirlos cambiaría un dato consultado por uno tecleado sin ganar
  nada.

### Lo que §13 pide y esta versión NO hace

El **contorno de la comuna** desde los límites administrativos de Overpass.
§13 dice «se pueden descargar en la misma consulta que ya se hace. Intentarlo
antes de declarar que no se puede», y tiene razón en que hay que intentarlo:
la consulta de usos ya trae `relation["boundary"="administrative"]` por
`is_in` y `js/61` las preserva a propósito desde la v863. Lo que trae son sus
ETIQUETAS, no su geometría —se piden sin recorrido, igual que las rutas— así
que dibujar el contorno pide una consulta más.

Se deja sin hacer y no se declara imposible, que es la distinción que este
módulo lleva cinco tandas defendiendo: queda en la lista viva con lo que sí
hay —el punto medido dentro del departamento— y con lo que costaría.

## El PDF traía una hoja de las dos (v905)

Salió al exportar el PDF de las dos láminas para entregarlo y **mirarlo**, que
es el método que encontró los defectos de la v874, la v882, la v885 y la v887.
El archivo tenía una página. La cabecera decía «LÁMINA A DE 2» y ahí se
acababa: **la lámina B no estaba en el archivo.**

Desde la v853 el pliego educativo son dos hojas de 60 × 90. El botón «Lámina
60×90 · PDF» —que es como sale el entregable, no la vista de impresión— venía
bajando media entrega desde entonces.

### Por qué no se veía

`js/75` rasteriza la lámina metiendo el HTML en un `<foreignObject>` **del
tamaño exacto del papel** y dibujándolo en un lienzo. Con un documento de dos
hojas, la segunda queda debajo del recorte: no hay error, no hay aviso, y el
JPEG que sale es una hoja perfecta. Desde afuera un PDF de 1,2 MB con la
lámina A entera se ve exactamente como un PDF completo.

**Y la comprobación estaba escrita al revés.** `tpdfpliego` exigía «trae una
sola página» —cierto cuando se escribió, con el pliego de una hoja— y se quedó
vieja el día que el pliego pasó a dos. Cincuenta versiones dando por buena una
exportación recortada, en verde. Es la clase de la v864 —una afirmación que
nació bien y la dejó obsoleta una tanda posterior— dicha en el arnés en vez de
en la lámina, que es donde no la vigilaba nadie.

### Una página por hoja

`hojasDe` parte el documento por sus `.hoja` —por el elemento y no por una
marca en el texto— y le pone a cada trozo la hoja de estilo del documento
delante. `intentar` dibuja una a una, **soltando cada lienzo antes del
siguiente**: el pico de memoria sigue siendo el de una hoja, que es lo que
decide si un teléfono de gama media puede o no. Y `pdfConImagen` pasa a
`pdfConImagenes`: el PDF se escribe a mano, así que el árbol de páginas, los
objetos por hoja y la tabla `xref` se cuentan sobre `3 + 2n` en vez de sobre
los seis fijos de antes.

Un documento de una sola hoja —el informe, la lámina suelta— sale como estaba:
una hoja, una página. No hay rama nueva que mantener.

### La comprobación mide lo que el pliego ES

No «dos páginas», que sería la misma constante copiada un piso más arriba y se
quedaría vieja el día que el pliego pase a tres. La suite **cuenta las `.hoja`
del documento que el propio módulo compone** y exige tantas páginas como
hojas, cada una con su propia imagen —dos páginas apuntando al mismo dibujo
serían la misma hoja impresa dos veces, y desde el conteo se ven igual— y cada
una de 90 × 60 cm.

De paso, el lector del `xref` leía `xref\n0 7`: **el número de objetos del PDF
de una página, copiado en la prueba**. Ahora lee el que el archivo declara. Una
constante del formato escrita a mano en la comprobación es lo que hace que la
comprobación deje de mirar el archivo y empiece a mirarse a sí misma.

### Y el aviso dice cuántas hojas bajaron

«Lámina bajada: 2 hojas de 60 × 90 cm, 2,5 MB a 120 puntos por pulgada.» Sin
la cifra, un archivo al que le falte una hoja se ve igual que uno completo
hasta que alguien lo abre — que es exactamente cómo este defecto pasó cincuenta
versiones.

### Demostrado sobre el papel

El PDF exportado con el sector de prueba: **una página de 60 × 90 antes, dos
después**, la segunda con «LÁMINA B DE 2 · GENTE, USOS Y MOVILIDAD», sus
3.155 habitantes, la banda de movilidad, la comparación con la ciudad de la
v902, las seis plantillas de campo, la coherencia y las cinco propuestas.

## Una sola fuente por magnitud (v906)

§10 del pliego de ajustes v2, en las dos mitades que no piden material real:
«es el mismo dato contado dos veces en el mismo código. Elegí una sola fuente
por magnitud, que todos los paneles la citen, y si hay registros descartados,
imprimí cuántos y por qué».

### Los edificios llegan por dos consultas, y ninguna está mal

Auditado antes de escribir —la regla de la v863— y la causa no es un error de
cuenta:

* la consulta de **usos** pide `["building"!="yes"]` —deja fuera el valor
  genérico, que es el más común de todos— y trae el CENTRO de cada uno;
* la del **trazado** los pide todos, con su HUELLA, y el módulo se queda con
  los que tienen el centroide dentro del área dibujada.

Las dos son ciertas y cuentan cosas distintas. Lo que sí era un error es que
**cada panel eligiera por su cuenta**: la ficha se quedaba con la lista MAYOR
(`t.edificios > a.edificios`) y la lámina con la que trajera pisos
(`trz.alturas.conDato ? trz.alturas : st.alturas`). Dos reglas para una
magnitud, que es exactamente la divergencia de la v879 —dos rutas de cálculo
no divergen el día que se escriben, divergen la tanda siguiente—.

Ahora `conteoDeEdificios(st, trz)` decide una vez, y lo llaman los diez sitios
que imprimían la cifra: la caja de la lámina, «El grano», `mediaDePisos`, el
informe en hojas, el informe de texto, la conclusión de banda, las tareas de
campo, lo que falta del sector y las dos condiciones `listo` del inventario
—que tienen que ser la misma que usa la caja para devolver vacío (v857)—.

#### Manda el trazado, y no la mayor de las dos

Estuve a punto de poner «la mayor» y `tsinmapear` lo habría dejado pasar al
revés: su sector trae **sesenta casas como PUNTO** —que la consulta de usos ve
y la del trazado no pide, porque pide `way` y `relation`— y **treinta y seis
huellas con sus pisos**. Con «la mayor» ganaban las sesenta y la hoja perdía
las treinta y seis alturas medidas.

El trazado manda por CONTENIDO y no por tamaño: está recortado contra el área
dibujada —la de usos llega por el círculo de Overpass—, trae la huella y por
tanto el área construida, y no deja fuera `building=yes`. Sin trazado medido
queda la de usos, y se dice que es ella.

#### Y se imprime qué no vio la otra

`nota()` lo dice donde el conteo es el sujeto —no en cada panel, que es la
repetición que §20 prohíbe—: de qué consulta sale, cuántos ve la otra y por
qué son distintos. Cuando la de usos ve MENOS son los `building=yes`, «los que
no dicen de qué son»; cuando ve MÁS son los mapeados como punto, sin huella,
«y de un punto no sale superficie construida». Son dos frases porque son dos
situaciones, y un número sin procedencia es lo que la v867 prohíbe.

### Los usos: un total y dos subtotales con nombre

`st.total` lo citan el encabezado, el plano y los anillos; el reparto por
categoría, las propuestas y la FODA sumaban **por su cuenta** los grupos sin
«otro». `conteoDeUsos(st)` devuelve los tres —`total`, `clasificados`,
`sinClasificar`— con la razón pegada, y los tres sitios la llaman. La v903 ya
declaraba la diferencia en la tabla; lo que faltaba era que la cuenta fuera
una.

De paso, el subtotal de las propuestas se nombra CONTRA el total: «226
clasificados **de los 244 del sector**». Un «226 clasificados» a un palmo del
«244 usos» del encabezado se lee como dos cuentas que no cuadran.

### Dónde vive cada comprobación, y por qué

* **`tsinmapear`** es el único sector de la batería que puede producir el
  defecto —las sesenta casas punto contra las treinta y seis huellas—, así que
  ahí va la comprobación de que **la ficha y la lámina cuentan los mismos**.
  Demostrada contra la v905: **ficha 60 · lámina 36**, sobre el mismo sector.
* **`tdoslaminas`** lleva la guarda de CLASE sobre las dos hojas compuestas:
  de cada magnitud, un solo valor. Ahí las dos reglas coincidían, así que es
  una guarda contra que vuelvan a separarse y no una afirmación nueva — y va
  con su propia guarda de material: si no encuentra al menos dos citas de la
  magnitud, no está comprobando nada y lo dice.

#### El lector pegaba dos cifras y fabricaba una tercera

La primera versión de la guarda denunció **«1244»** donde el sector tiene 244
usos. No estaba impreso: `h.texto` es el `textContent` de la hoja, y un «1» de
la caja de al lado se pega al «244» del encabezado. Es exactamente la lección
de la v885 con «100100», encontrada otra vez y con el mismo aspecto —una cifra
falsa que se ve igual de bien que una buena—.

Se lee sobre los NODOS unidos por un separador que no es un dígito. Y las
anclas que cruzan de rótulo a valor —en un `fila` son dos nodos— llevan ese
separador escrito, que es lo que un `\s*` no puede hacer.

## El mapa se limpia, y un botón lo mide todo (v906)

Dos cosas pedidas con el teléfono en la mano, y las dos del mismo molde: la
aplicación deja trabajo a medio hacer donde el usuario espera que esté hecho.

### «Analizar otro sector» dejaba dibujado el anterior

> «cuando le dé analizar otro sector, quiero que el análisis anterior, todo lo
> que sea gráfico en el mapa, desaparezca, porque si no hago otro análisis, se
> suele confundir porque queda a la vista del anterior análisis».

`soltarElAnalisis` borraba las cuentas y apagaba dos capas —los llenos y el
ráster—, y dejaba dibujadas las otras cinco: las manzanas por estrato, las
curvas de nivel, los cortes topográficos, la jerarquía de vías y los puntos de
uso. `quitarDelMapa` ya existía **y solo se llamaba al ARRANCAR el análisis
siguiente**, que es tarde: entre las dos cosas hay una pantalla entera en la
que se elige el área, y quien no llega a correr el siguiente se queda mirando
el anterior sin saberlo — y peor, marcando el centro nuevo encima del dibujo
del viejo.

Lo que NO se toca es lo que puso una persona —el lote, las marcas de lo
intangible, los recorridos del curso—: eso es del lugar y no del análisis, que
es la regla que `soltarElAnalisis` ya tenía escrita para el estado y no para
el mapa.

Demostrado quitando esas tres líneas: `curvas true · cortes true · vias true ·
estratos true · puntos 12` después de tocar el botón.

### Un botón que mide y DIBUJA todo el sector

> «quiero de primerito un botón que me analice todo, todo llenos y vacíos, me
> analice los colores de las manzanas, me analice todo… que me muestre una vez
> en el mapa la línea de los cortes topográficos… Y si está cargando, que diga
> que está cargando».

El botón existía desde antes y ya está de primero en «General», con su barra y
su «Parar». Le faltaban las dos cosas que el pedido nombra:

* **las manzanas por estrato no estaban en la cadena.** Eran un interruptor
  suelto en otra pestaña, que es justo lo que el pedido dice que no quiere.
  Entran como un paso más de `PASOS_MEDIR`, al final, porque además de medir
  dibujan.
* **medir no dibujaba.** `dibujarLoMedido` enciende al terminar los cortes
  topográficos —los que el pedido nombra—, las curvas de nivel, la jerarquía
  de vías, los llenos y vacíos y las manzanas por estrato. Va DENTRO de la
  cadena y con su propio rótulo, para que la barra siga diciendo que la espera
  está viva; y devuelve la lista de lo que de verdad quedó puesto y no la de
  lo que se intentó, porque un aviso que nombra una capa que no está es peor
  que ninguno.

Y con todo medido el botón se queda, pero cambia: **«Dibujarlo todo en el
mapa»**. Un sector reanudado vuelve con sus cifras y con el mapa en blanco, y
ahí «ya está todo medido» sin un botón al lado es una pantalla que no deja
hacer nada.

#### Las manzanas por estrato SÍ se encienden, y eso hubo que medirlo

Estuve a punto de dejarlas medidas y apagadas, razonando que dos rellenos de
área se tapan uno al otro. **Es falso**: `pintarEstratos` las manda al fondo
con `bringToBack`, así que quedan de base y las huellas encima, que es el
dibujo urbano de toda la vida. Lo cazó la propia aserción que escribí para el
razonamiento equivocado, en rojo con `estratos: true`.

Es la regla de la v863 dicha para las capas de un mapa: **una sospecha se
comprueba corriendo, no razonando** — y la primera versión de la prosa del
panel ya explicaba con detalle un motivo que no existía.

#### Un detalle que no se ve hasta que pasa

`alternarEstratos` encogía la hoja para dejar ver las manzanas. Dentro de la
cadena eso se lleva por delante la barra de progreso, que es lo único que dice
que la espera sigue viva (v870). No encoge mientras `S.midiendoTodo`.

#### Las dos constantes del fixture que estaban dentro de las aserciones

`tmedir` exigía `pasos.length === 5` y `/\d+ de 5/`. Son el número de pasos
del código copiado en la comprobación, y se pusieron rojas por añadir un paso
—un cambio que no tiene nada que ver con lo que miden—. Es la lección de la
v890 con los veintidós lados. Ahora la cuenta de la barra se compara **contra
la lista que el propio panel imprime**, y lo que se exige es que los nombre
uno por uno.

#### El doble del DANE no sabía contestar por geometría

Undécima vez. `tmedir` devolvía `{TOTAL, N}` a todo, así que la consulta de
manzanas por estrato —que pide `returnGeometry`— no traía polígonos y el paso
nuevo habría caído SIEMPRE: la comprobación habría medido la rama del fallo y
pasado diciendo que lo intentó. Ahora contesta cuatro manzanas con su estrato
—una de ellas «Sin Estrato», que es lo que el DANE le pone al suelo industrial
y a los lotes— cuando la consulta pide geometría.

#### El defecto que destapó encender una capa

`tjornada` —el recorrido de un día entero— se cayó con esto, y no era la
cadena: era un fallo viejo que hasta ahora se tapaba solo.

`int-dibujar` encoge la hoja SOLA —no se marca una manzana sobre un mapa
tapado por un panel—, y al cerrar el dibujo esa contracción automática no se
deshacía. No se notaba **por casualidad**: `pintar` deja la hoja abajo solo si
`S.encogida` **y además** hay alguna capa encendida (`hayCapa`), y en ese
recorrido no había ninguna. Con «medir y dibujar todo» las hay, y entonces la
hoja se queda abajo con la marca recién hecha y sin el panel donde se le
escribe la nota —que es lo que convierte una mancha de color en un
testimonio—.

El arreglo es de una línea y usa la señal que ya existía: `encogidaAMano`
separa «la bajé yo» de «se bajó sola», y solo se deshace la segunda.

Y una del método: llegué a esto **bisecando las cuatro capas** —con los cortes
solos fallaba, con los llenos solos no—, no leyendo. Tres teorías seguidas
sobre quién encogía la hoja resultaron falsas; la cuarta medición dio el
`hayCapa`. Es la regla de la v863 otra vez, y esta vez la pagué en tiempo por
no aplicarla desde el principio.

### Demostrado contra la v905

Ocho aserciones en rojo con el estado viejo impreso: `0 manzanas` por el paso
que no existía, `{}` por las capas que nadie dibujaba, «no lo dice» por el
panel, y el aviso terminando en «pruebe esos de a uno» sin nombrar una sola
capa puesta.

## El historial satelital entra, y el botón acusa que terminó (v907)

Dos cosas pedidas sobre el botón de la v906: «en ese botón nuevo que me hizo
agrégale una animación de que ya todo está cargado» y «faltó que en ese botón
también cargue los del historial de imágenes satelitales 2014-2026».

### El historial, como un paso más

`pedirEvolucion('wayback')` es la serie de fotos HD, y va **después de la foto
satelital** por la misma razón por la que aquella iba última: es el paso más
caro de todos —son varias descargas de imagen y otras tantas pasadas del
clasificador, no una—, así que si se cae o alguien toca «Parar», todo lo
anterior ya está hecho. Y no lleva la espera previa de cinco segundos: va
contra el archivo de imágenes de Esri, no contra Overpass.

#### El tramo es 2014-2026, y son CINCO estampas

La primera aserción exigía diez años y salió roja con cinco. No era un fallo:
`aniosDe` usa **paso 3** para la fuente HD, así que de 2014 a 2026 salen 2014,
2017, 2020, 2023 y 2026. Contar años habría metido en la comprobación una
constante del módulo —la lección de la v890 con los veintidós lados— y encima
una equivocada, salida de leer el pedido en vez de correr el código.

Lo que se comprueba es el **tramo**: que la primera sea 2014 y la última 2026.
Un paso distinto mañana lo cumple igual; un historial que empiece en 2020 no.

### La animación es del MOMENTO, y el panel es del estado

Es la separación que la v897 dejó escrita para el acuse de guardado, y vale
igual acá: el panel verde con su marca **se queda** y dice «esto está medido»
—sigue ahí al volver de otra pestaña—; la animación dura un segundo y dice
«acaba de terminar». Si viajara en el HTML, el panel volvería a celebrar cada
vez que se repinta la hoja —encender una capa, mover la barrita— y algo que
festeja sin que nadie haya hecho nada deja de significar «terminamos».

Así que `destelloDeMedido` la pone sobre el nodo ya repintado, leyendo
`offsetWidth` para forzar el reflujo: sin eso, medir dos veces seguidas no
vuelve a animar porque para el navegador la clase nunca se fue.

**Y solo cuando de verdad quedó todo.** Con un paso caído la cadena termina
igual, pero celebrarlo diría que está cargado lo que no está — y el panel de
abajo, que nombra lo que falta, quedaría desmentido por la animación de al
lado. Se comprueban las dos condiciones: que ningún paso fallara **y** que no
quede ninguno pendiente.

El verde es `--edu-ok`, el mismo de los vacíos de la v880 y del acuse de la
v897: en esta aplicación el verde ya significa «esto está resuelto», y darle
un color nuevo a lo mismo sería enseñar dos códigos.

### El acuse se apaga al analizar otro sector

Es de ESTE sector. Sin apagarlo, la hoja del sector siguiente nacería
celebrando lo que se acaba de soltar — el mismo error que la v897 evitó
haciendo que el botón de guardar no naciera iluminado.

### La suite tenía el clima caído a propósito, y por eso no había qué medir

Decimoséptima vez que el material no puede producir lo que la comprobación
dice medir. `tmedir` tumba el clima **a propósito** desde siempre, para probar
que un paso caído no detiene la cadena — y con eso el acuse no sale nunca,
porque nunca queda todo.

El clima se cae ahora la PRIMERA vez y contesta la segunda. La primera pasada
mide lo de siempre; la segunda deja un solo paso pendiente, la cadena cierra
completa y el acuse aparece. Las dos ramas en la misma corrida.

Y el doble de las fotos históricas va en `entorno.js` —`E.rutaWayback`, con su
`E.pngLiso`— y no dentro de la suite: es el mismo razonamiento que `E.rutaDane`
de la v862, y cualquier suite que corra la cadena lo va a necesitar. Sin él el
paso nuevo caería SIEMPRE y la comprobación habría medido la rama del fallo
diciendo que mide la del éxito.

#### La suite encontró un defecto de impresión en la primera versión del panel

«Se midieron los **1 pasos**.» La segunda pasada recoge un solo paso, y el
resumen lo imprimía sin concordar — la clase exacta de la v874, en un panel
que acababa de escribir.

El arreglo no fue conjugar la frase: fue **cambiar lo que resume**. Lo que
quien mira quiere saber no es cuántos pasos corrió esta pasada sino que el
sector está completo, así que dice «Los 7 pasos están medidos y quedaron 4
capas dibujadas». Las capas sí conjugan, porque pueden ser una. Y hay una
aserción de clase sobre el panel entero: ningún «1» seguido de plural.

### Demostrado contra la v906

Siete aserciones en rojo de ocho: «undefined estampas, de undefined a
undefined», «0 teselas pedidas», el paso sin nombrar en la lista, y «no hay
panel de fin» por el acuse.

La octava —la concordancia— no falla contra la v906 por no existir el panel
que la produce. Es una guarda contra el defecto que esta misma tanda cometió,
no una afirmación nueva.

## Toda la aplicación habla de usted (v908)

§9 del pliego de ajustes v2, en la mitad que la v903 dejó pendiente con su
número: «Los 209 casos del resto de la aplicación… la decisión está tomada,
unificá todo en usted. Es producto colombiano y dejarlo mezclado se nota más
que cualquiera de las dos opciones. Hacelo en su propio commit, aparte de la
lámina.»

Medidos, eran **376 en 35 archivos**, no 209 — y la diferencia no es que la
v903 contara mal: contó **pronombres**, y el grueso del tuteo son los
imperativos («Pulsa», «Elige», «Ingresa»), los pretéritos («¿Olvidaste?»,
«Llegaste») y los enclíticos («Compártelo», «moverte»), que ningún barrido de
pronombres ve.

### Dónde mira la guarda, y por qué no es donde miraba la del voseo

La v903 dejó escrito que una guarda de tuteo sobre los ARCHIVOS no sirve:
«te» y «tu» casan dentro de `var te = ter.elevacion` y de un nombre de
variable, y una guarda con esa clase de falso positivo termina con una lista
de excepciones que envejece hasta no significar nada. Por eso allá la guarda
se puso sobre el PAPEL —los nodos de texto de las dos láminas compuestas—,
donde no hay identificadores.

El resto de la aplicación no tiene papel: son pantallas. Así que el recorrido
cambia de signo. La guarda del voseo marca lo que está **fuera de un
comentario**, que incluye el código; esta marca lo que está **dentro de una
cadena**, que lo excluye. Con eso los 28 falsos positivos de identificador
desaparecen sin una sola excepción escrita.

#### El `${…}` de una plantilla es CÓDIGO

El agujero del recorrido, y por poco. Un autómata que abre cadena en la
comilla invertida y la cierra en la siguiente marca como texto TODO lo de en
medio — incluido `${demoDias.has(dia)}` y `${hor.abre}`. El primer barrido
escribió `demoDias.ha(dia)` y `value="${hor.abra}"`: **dos roturas de código
hechas por un reemplazo de idioma**, y ninguna da error en ninguna parte
hasta que alguien abre esa pantalla.

Se cuentan las llaves para que un objeto literal adentro no cierre antes de
tiempo, y las comillas de adentro para que una cadena con `}` no descoloque la
cuenta. Y se comprueba contra el caso que lo rompió, que es la regla de la
v879 con la regex de `js/68`: se mide **dónde cae cada cosa** —el «te» de
código fuera, el `${}` fuera, el «tu» del texto dentro—, no que no reviente.

### De qué responde la guarda, dicho entero

Es la decisión de la v880 con las formas en -é y en -í del voseo: **decirlo
importa más que tenerlo.**

| Clase | Cómo se persigue |
|---|---|
| Pronombres: `tú`, `ti`, `contigo`, `tuyo/a/os/as`, `tu`, `tus`, `te` | **estructural**, falla cerrado — ninguno es otra cosa en castellano |
| Futuro en -ás: `podrás`, `verás`, `llegarás` | **estructural** con lista de permitidas, la misma forma que la guarda de -á |
| Presente, subjuntivo, pretérito e **imperativos** | **vocabulario**, y por tanto falla ABIERTO |

La tercera fila es la que importa y no tiene arreglo: **la forma de tú es
idéntica a la de tercera persona**, y a veces a un sustantivo. «Marca el
punto» y «la app marca el punto» se escriben igual; «Recarga la app» y
«Recarga de acuíferos» también. Los dos salieron en esta tanda, y los dos los
cazó leer el reemplazo, no una regla.

Queda **una** excepción declarada con su razón, como el `leeme` de la v897:
en la lista de palabras con las que se busca un oficio en la vitrina, «te» es
la infusión.

### Lo que un reemplazo automático deja a medias, otra vez

Es literalmente la lección de la v878 —«cambiar el pronombre no conjuga los
verbos de alrededor»— y salió en tres formas distintas, las tres solo
visibles leyendo lo cambiado:

* **`te` es «le» o «se» según el verbo**, y eso no se decide sin leer. «URBIS
  te ayudará» es «le ayudará»; «te saliste de la ruta» es «se salió». Se
  dejaron los 42 fuera del automático a propósito y se hicieron uno por uno.
* **El segundo imperativo de una frase coordinada.** El barrido solo toca el
  que ABRE la frase —un imperativo a media frase es indistinguible de una
  tercera persona—, así que quedaron 47 «Cierre sesión y **vuelve** a entrar»,
  «Seleccione Colombia o **escribe** su país», «Dibuje y **cierra** un
  polígono». Se buscan con un barrido propio: la forma ambigua precedida de
  «y», «o» o «luego».
* **El enclítico.** «Ponle nombre», «Búscalos», «Confírmalo», «Márcalos»,
  «Complétala», «Escríbele» — la tilde se mueve al pasar a usted
  («Póngale», «Búsquelos») y ninguna regla de terminación los ve.

### Una cadena que no es texto: tres clases, y las tres rompen algo

El riesgo que no tiene la guarda del voseo, porque el voseo solo aparece en
prosa: **dentro de una cadena hay cosas que no le hablan a nadie**, y un
reemplazo de idioma las reescribe igual. Las tres salieron leyendo el
reemplazo y las tres rompían algo que no da error:

* **Un nombre de clase.** `classList.toggle('activa', …)` pasó a `'active'`
  por el imperativo de «activar», en `js/90` y en `js/20`. En Visión
  Territorial eso es el conmutador de pantallas: la hoja de estilo pinta
  `.vt-pantalla.activa` y a partir de ahí **ninguna pantalla se mostraba**.
  Es el defecto de la v895 —una clase que ninguna regla pinta— creado por un
  cambio de idioma. Lo cazó `tvision` con un clic que esperaba 58 veces un
  botón invisible.
* **Un valor de formulario.** `<option value="TI">Tarjeta de identidad (TI)`
  pasó a `value="USTED"`. **TI es el código del tipo de documento** y viaja al
  servidor: la cuenta se habría creado con un tipo que no existe. Se devolvió,
  y como la guarda lo denuncia con razón, va en su lista de excepciones con la
  razón escrita — igual que el `leeme` de la v897.
* **Una clave guardada.** `sub: 'ganaste'` y `n.sub === 'ganaste'` cambiaron
  los dos a `'ganó'`, así que el código quedaba coherente consigo mismo… y
  mudo para los avisos que una persona ya tenía en `localStorage`. Es la regla
  de la v878 con el id de una caja renombrada: **el identificador no es texto,
  y cambiarlo rompe lo que ya está guardado.** Solo se cambió el título que se
  lee.

La comprobación que las encontró no fue leer el diff renglón a renglón: fue
buscar, entre las líneas cambiadas, **las cadenas que son UNA sola palabra**.
La prosa casi nunca lo es; un token siempre. Salieron cuatro candidatas y tres
eran defectos.

### Tres imperativos que no lo eran, y se vieron leyendo

Las tres son cifras correctas dichas por una forma que también es otra cosa,
que es la clase de la v874:

* **`'Recarga de acuíferos'`** — un uso del suelo en la lista de valores
  ambientales, convertido en «Recargue de acuíferos».
* **`'marca=' + tags.brand`** — el rótulo de la etiqueta de OpenStreetMap,
  convertido en «marque=».
* **`'✅ sigue ahí'` / `'🔄 Sigue activo'`** — el estado de un reporte que otro
  vecino confirma, convertido en una orden al lector. Y con él «El reporte NO
  se publica: sigue esperando», que es el reporte y no la persona.

Y una que sí lo era y parecía no serlo: **`<span>Convierte datos en
decisiones</span>`** en la portada. Leída sola parece tercera persona; leída
en su fila —«Mapea su barrio», «Reporta en vivo», «Analiza su ciudad», bajo un
`aria-label` que dice «Qué puede hacer en URBIS»— es un imperativo, y encima
mezclado con el «su» de usted en la misma frase. **Se vio mirando la pantalla
de la que sale, no la cadena.**

### Un futuro nuevo cuesta un renglón, y así tiene que ser

Al convertir `llegarás` en `llegará`, la guarda del VOSEO lo denunció: su
lista `FUTURO_3A` no lo traía. No es un fallo, es el contrato que la v880
dejó escrito —«un imperativo voseante nuevo sale denunciado solo; un futuro
nuevo cuesta un renglón y se ve en rojo hasta que alguien lo agregue»— y es
la primera vez que se cobra. Se agregó el renglón.

### La guarda encontró dos archivos que el barrido no miraba

`js/62` y `js/78` quedaron fuera de la lista de archivos por el filtro del
módulo educativo —que la v903 ya había hecho— pero la v903 solo tocó la
LÁMINA, no esos dos. La guarda los denunció al primer intento: «Agregado por
ti», «Tú no estás compartiendo», «Necesitas una sesión iniciada». Es
exactamente para lo que se escribe una guarda que recorre el disco y no una
lista escrita.

### Lo que NO se tocó

Los comentarios del código. El alcance es lo que sale en pantalla, que es la
misma decisión de la v878: el tuteo de un comentario lo lee quien programa; el
de una cadena lo lee un ciudadano en su teléfono. Y el nombre de una clase o
de un identificador tampoco se toca — `pcr-tu-*` no es texto.

### Ocho suites citaban el texto viejo

Como las catorce de la v878: `tcorregir` («Te piden corregir»), `tintentos`
(«te saliste del top»), `tpresencia` («Tú no estás compartiendo»), `tpremio`
(«Ganaste», «Tu premio»), `tvitrina` («no es tuyo»), y `tgraficos` y `tedu`,
que reimplementan a propósito la regla de la referencia —«el más alto de tus
N»— para cazar a quien afloje el mínimo o se olvide de excluir el sector
actual. Todas se actualizaron al texto de ahora.

La octava, `tvision`, **no citaba nada**: se cayó por el `activa` de arriba, y
es la única de las ocho que denunciaba un fallo de verdad.

### Demostrado contra la v907

**376 denuncias en 35 archivos**, con archivo y línea: «js/02-auth-roles.js:192
tu · …:195 Estás · js/05:385 TU…». Cero después. Y la comprobación del
recorrido pasa contra las dos versiones a propósito: es una guarda contra que
el autómata vuelva a perderse, no una afirmación nueva.

## La lista viva: lo que al pliego educativo todavía le falta (v866)

Esta lista se quedó vieja **cinco veces**. Cuatro dentro de la hoja —la
isócrona, el ancho de vía, las rutas, la cifra municipal— y la quinta acá
mismo, en la bitácora: la sección de la v860 seguía pidiendo «las rutas
dibujadas, los estratos, la escolaridad y las isócronas por malla vial»
cuando las cuatro estaban medidas. `tdoslaminas` persigue la clase dentro de
la hoja desde la v864; **dentro de la documentación no la perseguía nadie**,
y la documentación es lo que lee la sesión siguiente para decidir qué hacer.

Por eso la lista tiene ahora una FORMA que una comprobación puede leer, y
`revisar.js` la lee. Cada renglón es:

```
* **Lo que falta** — la fuente que lo resolvería. `ya: lo que de este mismo tema SÍ está medido`
```

La cláusula `ya:` no es cortesía: es la regla. **Un renglón que toque un tema
del que ya se mide algo tiene que decir qué se mide**, y `revisar.js` falla si
no lo dice. Así la trampa deja de depender de acertarle a la redacción de una
negación —que fue lo que falló cuatro veces— y pasa a depender de una cosa
que se ve a simple vista: la cláusula está o no está.

<!-- LISTA-VIVA-PLIEGO -->
* **El predio: tamaño y forma de cada lote** — cartografía catastral del IGAC
  o del catastro municipal. `ya: la manzana cerrada por las vías mapeadas, que no es el lindero catastral`
* **El ESPACIO PÚBLICO de la ciudad, en m²** — una consulta aparte de
  OpenStreetMap sobre el municipio, solo de parques y plazas CON su geometría.
  No sale de la corrida municipal y la razón es concreta: su área se calcula
  sobre polígonos, y los polígonos son justamente las capas que la consulta
  suelta por encima de 50 km² porque no terminan (v851), así que a escala de
  municipio la corrida sale siempre en ligera.
  `ya: la densidad de usos y la cobertura de equipamientos del municipio, de correr el MISMO análisis sobre un círculo de su área censada una sola vez y guardar las cifras, impresas como par sector · ciudad · diferencia; y la población, la densidad, la pirámide por tramos y el reparto por sexo, del censo por manzana`
* **El área URBANA del municipio** (IGAC o el POT), para una densidad contra
  el perímetro y no contra lo censado.
  `ya: la densidad de la ciudad sobre el área de sus manzanas censales, declarada con ese nombre y no como «área urbana»`
* **El recorrido de cada ruta y su frecuencia** — un GTFS, o el cuadro de la
  secretaría de tránsito. La plantilla de campo levanta la frecuencia parada
  por parada, pero **una plantilla en blanco no es una medición**: el renglón
  se queda hasta que alguien la llene.
  `ya: el nombre, la referencia y el tipo de cada ruta que recoge en las paradas del sector, y la plantilla de campo para anotar las horas de paso con su intervalo`
* **El aforo de hora pico** — un conteo en campo o el de la secretaría, con su
  fecha. `ya: el flujo modelado a partir de los usos y la jerarquía, rotulado como modelado y no como contado`
* **El perfil acotado de la calle**: andenes, antejardines, arborización — se
  levanta en campo, y la lámina ya trae con qué: el renglón se queda porque
  la plantilla es el camino y no el dato.
  `ya: el ancho de vía leído de width con su cobertura, qué parte de la red no tiene dato de andén, y las plantillas de campo del perfil acotado y del estado de andenes, con sus columnas y su instrumento`
* **El contorno del MUNICIPIO y el de la COMUNA** — los límites
  administrativos de OpenStreetMap, que este módulo todavía no descarga. Y la
  población por departamento y por comuna, que pide anclas del DANE como las
  municipales.
  `ya: el contorno real del país y del departamento, de geometría fija y dominio público, con el departamento resaltado dentro del país y el sitio del sector marcado dentro del departamento; la superficie de cada figura calculada sobre el mismo contorno que se dibuja, la población del municipio y la del sector, y el nombre de la comuna tomado de lo que quien analiza escribió en la ficha cuando el geocodificador no lo trae, declarado como escrito a mano`
* **La obra pública contratada y la variación de población POR COMUNA** — los
  contratos de SECOP II (datos.gov.co) por municipio y año con su monto, y las
  anclas del DANE a escala de comuna. Son los dos proxies de presión que el
  pliego pide y esta versión no tiene.
  `ya: la huella construida entre dos fechas de imagen —los puntos de superficie dura que el sector ganó, medidos con el mismo clasificador— y la variación de población del municipio, las dos declaradas como proxies y con su límite escrito`
* **La vulnerabilidad por manzana** — no hay fuente abierta a esa escala.
  `ya: el estrato predominante con su mínimo y su máximo y su mapa por manzana, y el nombre del barrio y la comuna del geocodificador`
* **Comprobar los nombres de campo del censo contra el servicio real** — desde
  la máquina de desarrollo el proxy bloquea `ags.esri.co`.
  `ya: escolaridad, hogares y alfabetismo no se suponen: se le preguntan a la capa, y lo que no expone se declara con su lista de campos`
* **La pertenencia étnica del sector, si alguna vez discrimina algo** — la
  capa del censo por manzana, preguntada como los demás bloques. Se retiró de
  la lámina en la v874 porque en el sector real el 98,5 % contestó «ninguno»
  y el bloque gastaba una banda para no decir nada; en un municipio con
  resguardo o consejo comunitario diría mucho.
  `ya: el bloque está escrito y probado —entra volviendo a poner su renglón en BLOQUES_CENSO—, y la capa se pregunta igual para los otros tres`
* **La radiación sobre una fachada ORIENTADA, en kWh/m²** — pide una serie
  horaria de irradiancia con su reparto directo/difuso: el atlas del IDEAM o
  un año meteorológico tipo. El archivo diario solo trae la global sobre plano
  horizontal.
  `ya: las horas de sol al año y el reparto del directo de las ocho orientaciones, calculados con la carta solar del sitio y declarados como geometría, junto a la radiación horizontal medida de cinco años con su fuente`
* **El viento DENTRO de la manzana** — se mide en el sitio: entre construcción
  la velocidad baja y la dirección se tuerce con las calles.
  `ya: la rosa de los ocho rumbos pesada por velocidad, el dominante, la media, y la estrategia de ventilación —por dónde entra, por dónde sale, cómo se dimensionan las aberturas— declarada a 10 m en campo abierto`
* **La sombra sobre terreno en PENDIENTE** — pide cruzar el modelo de alturas
  con cada proyección, que es otra tanda.
  `ya: la sombra de la altura que más se repite en el sector a las 9 y a las 15, cruzada con la calzada media medida, y declarada sobre terreno plano`
* **Los cuatro vacíos obligatorios** — riesgo oficial, norma urbana del POT,
  movilidad real e información legal del predio. Cada uno pide su entidad y
  ninguno se deduce; servicios públicos salió de la lista en la v880.
  `ya: cada uno cierra con qué se pide, ante quién, cómo se radica, qué llevar, cuánto tarda y qué sirve mientras llega con su límite escrito`
<!-- /LISTA-VIVA-PLIEGO -->

**Una tanda que mida algo que estaba en esta lista hace dos cosas**: mueve el
renglón a su cláusula `ya:` —o lo borra, si no quedó nada del tema— y agrega
su par a la tabla `PARES` de `tdoslaminas`. La v865 hizo lo primero a medias y
se saltó lo segundo; por eso lo segundo está escrito acá y comprobado allá.

### Hay más de una lista viva (v868)

Visión Territorial tiene la suya, marcada `LISTA-VIVA-VT`. Sus cinco
carencias se auditaron una por una contra el código antes de marcarlas y
**salieron honestas**: no hay tabla de malla vial en el esquema y toda corrida
escribe `radio_recto`; el espacio público se declara «pendiente» dentro del
propio resultado con la razón escrita; no hay exportación PDF de ninguna
clase; y el diálogo de aprobar dice **en pantalla** que la contraseña llega
con las cuentas por entidad.

Se marcó igual, y esa es la razón de fondo: **una lista honesta se vuelve
vieja la primera vez que alguien implementa algo**, y ese es el fallo que
nadie ve — es exactamente como se estropeó la del pliego. La lista de VT no
estaba mal; estaba sin guardar.

La comprobación de `revisar.js` recorre ahora **todas** las listas marcadas,
cada una con su propia tabla de capacidades, en vez de tener una dentro. Y la
primera comprobación de todas es que **no haya en CLAUDE.md un bloque marcado
que la tabla no conozca**: un módulo nuevo que escriba su lista y se olvide de
registrarla tendría una lista sin vigilar, que es peor que no tenerla, porque
parece vigilada.

Demostrada contra tres fallos distintos: el texto de VT de antes (dos
renglones tocando algo medido sin decirlo), un bloque marcado sin tabla, y una
marca de capacidad renombrada —`S.avisoDatos` → otro nombre—, que dejaría la
capacidad por no medida en silencio y permitiría que la lista volviera a
pedirla.

## La lámina educativa: todos los mapas, y lo que cede es texto

Entre la v847 y la v849 el pliego de 60 × 90 tuvo un piso de **120 mm de
lado corto por mapa**, y para guardarlo apagaba paneles. El pliego real que
salió de ahí traía cinco mapas de quince: sin los de calor por categoría,
sin hitos y nodos, sin alturas. La corrección llegó con ese PDF en la mano
—«me quitó todos los mapas que tanto me gustaban, las de alturas; que se
muestren todos los mapas que antes salían»— y **la v850 cambió el canje de
lado**:

* Los mapas **están todos** y se encogen con la hoja, como todo lo demás.
* Lo que cede cuando no cabe son **los paneles de texto**, y queda dicho:
  `S.pliegoFuera` (la ficha lo nombra) y entero en el informe en hojas.
* Los mapas ceden **los últimos**, y nunca la foto ni el de todos los usos.

Cómo funciona, en `js/68`:

* **Suelo propio para los dibujos de mapa**: `papelMapa` usa
  `max(var(--k), 0.5)` donde el resto usa `papel` con 0,62. Por debajo del
  50 % de composición un mapa baja la mitad de rápido que la letra; con el
  suelo común, una hoja acostada al 30 % dejaba mapas de 40 mm de alto, que
  es un icono. Los techos son los de siempre (`TOPE`).
* **La foto satelital y el plano del sector miden lo mismo** (se pidió así:
  «veo uno más grande que otro, para que los dos queden del mismo tamaño»):
  mismas columnas (`pesoPlano` y `PESO_MAPA.foto`, 3,5 parado y 4 acostado),
  el mismo techo de alto y el mismo recuadro a la proporción del sector —al
  plano se le quitó el margen del 15 % que la foto no tenía—. La foto lleva
  clase propia, `mapa-foto`, porque su peso no es un número entero de clase.
* **Usos del suelo**: el mapa grande (`calor:todos`) y **una mancha de calor
  por cada categoría** con tres usos o más, hasta seis parado y cinco
  acostado. `categoriasQueCambian` sigue existiendo, pero ahora solo escribe
  la razón en el pie de las dos que cambian la conclusión.
* **El orden de sacrificio depende del tamaño de letra**, porque depende de
  para qué se sacrifica:
  * «Cabe todo» sacrifica para que quepa → primero las cajas (las **baldosas
    de cifra** al final), después los mapas. Los tres paneles de campo y los
    cinco vacíos no ceden en la hoja parada.
  * «Equilibrio» y «Se lee de pie» sacrifican para que se LEA → primero los
    mapas que sobran del núcleo de cuatro (`PRIORIDAD_MAPA`), después las
    cajas —los paneles de campo y de vacío incluidos—, y el núcleo al final.
    Además las dos figuras protagonistas bajan al techo de un mapa de dos
    columnas. Sin esto, «Se lee de pie» no cerraba ni con todo apagado y
    caía al mínimo de 1,4 mm, que es lo contrario de lo que promete.
* `laminaQueQuepa` vuelve a **reducir la misma hoja** para medir, en vez de
  recomponerla en cada sondeo: con los mapas encogiéndose otra vez, reducir
  es medir, y es siete veces más barato.
* La rejilla de cada banda va en **medias columnas**: una caja son dos
  pistas, una baldosa de cifra una, un mapa el doble de su peso. En una
  banda donde mandan los mapas, las pistas por renglón se redondean a
  **número par**: con once, cada renglón dejaba una suelta y la grilla se
  partía en un renglón de más.
* Cada banda lleva su **pregunta** (`GRUPOS[].pregunta`) y su
  **conclusión** (`conclusionDeBanda`), y la cabecera dice cómo se lee.
* El cierre ya no es la FODA: son **cinco propuestas de uso**
  (`propuestasDeUso`), ordenadas por necesidad medida y factibilidad del
  predio, con la norma urbana declarada «sin dato oficial» —ninguna sube de
  factibilidad media hasta que se lea el POT—. La FODA sigue en la ficha y
  en el informe. URBIS recomienda, quien proyecta decide.

Lo mide `tlaminaedu.js` en milímetros de papel: que estén los quince mapas
del sector de prueba, que ninguno baje de 45 mm de alto, que la foto y el
plano midan lo mismo y que **ningún mapa aparezca en la lista de lo que
cedió**. Las demás suites del pliego (`tpliegogrande`, `tmapas`, `tpliego`,
`tlamina`, `tsintesis`) siguen aceptando «está, o está declarado fuera»
para las cajas de texto, que son las que ceden.

### La capa educativa (v848)

* **Método en cada panel.** `METODO_PANEL` en `js/68`, con clave por título
  de caja o identificador de mapa: fórmula, fuente (con «hoy» reemplazado
  por la fecha de la consulta), confiabilidad, referencia y error típico.
  Lo que no tenga entrada recibe `METODO_GENERICO` —«método no descrito
  todavía»— y nunca una fuente inventada; `tlaminaedu` exige que ninguna
  caja lo lleve. Una caja nueva necesita su entrada.
* **Radio elegible.** La ficha del sitio dice «Radio de análisis: N m,
  definido por quien analiza» (el equivalente si el área es un polígono) y
  lee la misma esquina a 500, 800 y 1.000 m (`comparacionDeRadios`). El
  mapa de lo que se alcanza a pie lleva el radio recto superpuesto a la
  isócrona.
* **Bibliografía** (`BIBLIOGRAFIA`) al pie de la hoja, no en el cierre:
  solo normas y autores que la hoja usa de verdad.
* **Lectura propia**: renglones en blanco al final de las cinco propuestas.
* **Paneles de campo** (`PANELES_DE_CAMPO`): «Percepción del lugar», «Lo
  que no cambia» y «Voces de quien vive acá», en blanco, en la banda del
  trabajo de campo. **Parada no ceden** (es el formato del pliego
  educativo); acostada ceden los últimos entre las cajas, porque con ellos
  intocables la letra bajaba al 34 %. Y ceden en los dos formatos cuando se
  pidió letra grande: «Se lee de pie» es justamente la petición de menos
  paneles a cambio de leerlos de lejos.

### Los vacíos obligatorios y los cruces (v849)

* **Cinco paneles de vacío obligatorio** (`PANELES_DE_VACIO`): riesgo
  oficial, servicios públicos, norma urbana, movilidad real e información
  legal del predio. Se imprimen siempre, como baldosas ámbar a trazos, con
  «Sin dato oficial disponible», la fuente que haría falta y qué es lo que
  sí hay (y por qué no es eso). Nunca en blanco, nunca una suposición: el
  riesgo no se deduce de la pendiente. Van en la banda del trabajo de
  campo —son datos por conseguir— porque en su banda de tema desplazaban
  al mapa de cobertura del núcleo. Parada no ceden; acostada, y con letra
  grande en cualquier formato, ceden con los de campo.
* **Lo que dicen juntas las cifras** (`crucesDelSector`): once cruces en
  el cierre, antes de las propuestas, cada uno con valor y una lectura que
  cierra en decisión. Lo que no está medido lo dice («sin dato oficial»,
  «serie satelital no leída») y nombra qué haría falta.
* **Cada dato ambiental cierra en decisión** (`DECIDE` en la
  composición): una línea «→ …» al pie de las cajas ambientales, salida de
  su propio número; la de la cobertura va en su mapa, porque con el raster
  en la hoja la caja no existe.

Con esto quedan hechas las seis secciones del pliego de instrucciones del
módulo educativo (v847 a v849).

## El sector de prueba tiene que parecerse a uno de verdad (v862)

Tres tandas seguidas encontraron que una suite medía menos de lo que decía, y
siempre por lo mismo: **el sector de mentira era más pobre que uno real.** Se
fue armando pieza a pieza para cada cosa nueva, y lo que ninguna comprobación
miraba se quedó sin construir. Esta tanda lo revisó de frente.

### El doble del DANE, compartido y fiel

`E.rutaDane(ctx, censo)` en `pruebas/entorno.js`. Antes cada suite se armaba
su respuesta del censo y casi todas la resolvían con `{ TOTAL: 3045, N: 42 }`.
Eso alcanza para la población y para nada más: la consulta de demografía pide
`SEXO_M`, `SEXO_H` y los **veintiún** tramos de edad, y al no venir ninguno
`demografia()` devuelve null. Resultado: **el panel «Quién vive acá» —la
pirámide, el reparto por sexo, el índice de envejecimiento— no se dibujaba en
ninguna prueba del pliego.** Entró en la v853 y llevaba nueve versiones sin
que nada lo mirara.

Dos cosas lo hacen un doble fiel y no otro atajo:

* **Contesta solo lo que la consulta pidió**, leyendo `outStatistics`, que es
  como responde Esri. Un doble que contesta de más esconde justo el fallo que
  hay que ver: una consulta mal armada por la aplicación seguiría saliendo
  vacía contra el servicio real y acá también.
* **Las cifras cuadran entre sí**: los veintiún tramos suman exactamente la
  población, mujeres más hombres también, y la capa de VIVIENDAS devuelve un
  número distinto del de personas. Ese último detalle importaba: con `TOTAL`
  igual en las dos capas, el sector salía con 1,0 personas por vivienda y el
  chequeo de coherencia de la lámina lo marcaba en rojo. **Fallaba por el
  fixture, no por el código**, y la suite estaba asertando sobre ese fallo.

### Tres etiquetas de vía que no se ejercitaban

El motor lee `oneway`, `width` y `sidewalk` de cada vía. El sector de prueba
solo traía `lanes`, así que la lámina imprimía «0 % en un solo sentido» y «del
andén no se sabe en el 100 % de la red» en todas las versiones, siempre, sin
que nada lo mirara. Ahora se reparten por jerarquía como en un barrio real
—troncales y principales con ancho y andén; locales en un solo sentido y
muchas sin andén— y salen 31,1 % y 51,8 %.

### El estrato, que tampoco se ejercitaba (v866)

La ruta del DANE contestaba `features: []` a la consulta AGRUPADA por estrato
—la que lleva `groupByFieldsForStatistics`—, así que `distribucionEstrato`
devolvía null y **el pliego no imprimía «Estrato predominante» en ninguna
prueba**: ni el peldaño ni el rango. Salió a la luz al agregarle su par a
`PARES`: el par pasaba diciendo «no la mide en este sector», que es el peor
verde que hay, porque parece una comprobación y no comprueba nada.

El reparto del doble suma exactamente `CENSO.manzanas` y **lleva una fila
«Sin Estrato» a propósito**: es lo que el DANE le pone al suelo industrial,
dotacional y a los lotes, y el código la cuenta aparte. Un reparto sin esa
fila dejaría esa rama sin ejercitar, que es exactamente cómo empezó esto.

Lo que sigue sin fixture es la consulta de **polígonos** por estrato —la que
pinta el mapa de manzanas—: pide geometría y cambiaría el recuento de mapas
de `tlaminaedu`. Queda dicho acá en vez de a medio hacer.

**Lo que sigue a oscuras, y por qué.** La rama `anchoDe === 'width'` no se
ejercita: el motor elige por mayoría de vías, y para que gane `width` habría
que darle ancho mapeado a casi todas las calles, que es un sector que en
Colombia no existe. Antes que inventar un barrio falso para iluminar una
rama, se deja dicho acá.

## Las pruebas se aprietan, no se aflojan

Cuando una falla por un cambio legítimo, se hace más precisa: se busca por la
acción y no por la clase, por la cabecera y no por el texto de toda la hoja.
Aflojar una aserción para que pase es perder la prueba entera y no enterarse
hasta meses después.
