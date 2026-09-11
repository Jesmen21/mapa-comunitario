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
`URBIS_SECRETO` de pruebas para firmar licencias con territorio; el script
de reinicio de la sesión los exporta. Una licencia entra al módulo solo si
lleva `vt: { dane, rol }` (`emitir-licencia.js --dane 54001 --rol gobernante`).

### Lo que falta, y se dice en pantalla

* **Supabase real.** El esquema está escrito para Supabase (roles, RLS,
  PostGIS) pero el proyecto no existe todavía: hay que crearlo, correr
  `roles.sql` como `postgres`, `migrar.js` como `vt_migrador`, y poner
  `VT_DATABASE_URL` en el servidor. **Nunca la llave `service_role`**: salta
  la RLS y la volvería decorativa.
* **Isócronas por malla vial** (Tobler): no hay malla cargada. El método
  declarado es `radio_recto` y cada corrida lo dice.
* **Espacio público en m²/hab**: hace falta el polígono de cada parque.
* **Exportación PDF con marca de agua en el servidor**, cuentas por entidad
  con contraseña de nuevo al aprobar (hoy se confirma escribiendo APROBAR),
  ciclo de aprendizaje anual, SECOP.
* Los tres territorios cargados son **de desarrollo**: manzanas sintéticas,
  equipamientos de demostración. La única cifra real es la población de
  Cúcuta (ancla DANE 2024). La pantalla lo avisa en amarillo.

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
* **La pirámide de edades de la ciudad**, para sobreponerla a la del sector —
  el CNPV 2018 agregado por municipio; la consulta por manzana no lo trae.
  `ya: la pirámide del sector por tramos de edad, y la población del municipio proyectada al mismo año`
* **La densidad de la ciudad** — el área urbana del municipio (IGAC o el POT).
  `ya: la densidad del sector en habitantes por hectárea`
* **El recorrido de cada ruta y su frecuencia** — un GTFS, o el cuadro de la
  secretaría de tránsito. `ya: el nombre, la referencia y el tipo de cada ruta que recoge en las paradas del sector`
* **El aforo de hora pico** — un conteo en campo o el de la secretaría, con su
  fecha. `ya: el flujo modelado a partir de los usos y la jerarquía, rotulado como modelado y no como contado`
* **El perfil acotado de la calle**: andenes, antejardines, arborización — se
  levanta en campo. `ya: el ancho de vía leído de width con su cobertura, y qué parte de la red no tiene dato de andén`
* **La vulnerabilidad por manzana** — no hay fuente abierta a esa escala.
  `ya: el estrato predominante con su mínimo y su máximo y su mapa por manzana, y el nombre del barrio y la comuna del geocodificador`
* **Comprobar los nombres de campo del censo contra el servicio real** — desde
  la máquina de desarrollo el proxy bloquea `ags.esri.co`.
  `ya: escolaridad, hogares, alfabetismo y etnia no se suponen: se le preguntan a la capa, y lo que no expone se declara con su lista de campos`
* **Los cinco vacíos obligatorios** — riesgo oficial, servicios públicos,
  norma urbana del POT, movilidad real e información legal del predio. Cada uno
  pide su entidad y ninguno se deduce.
<!-- /LISTA-VIVA-PLIEGO -->

**Una tanda que mida algo que estaba en esta lista hace dos cosas**: mueve el
renglón a su cláusula `ya:` —o lo borra, si no quedó nada del tema— y agrega
su par a la tabla `PARES` de `tdoslaminas`. La v865 hizo lo primero a medias y
se saltó lo segundo; por eso lo segundo está escrito acá y comprobado allá.

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
