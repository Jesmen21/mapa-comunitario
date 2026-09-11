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
* **Un vacío no se guarda en el caché.** Un sector sin nada mapeado es un
  resultado legítimo y se muestra, pero guardarlo es apostar a que el vacío
  era de verdad. Repetir la consulta cuesta segundos; publicar un cero falso
  cuesta el análisis.
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

## Las pruebas se aprietan, no se aflojan

Cuando una falla por un cambio legítimo, se hace más precisa: se busca por la
acción y no por la clase, por la cabecera y no por el texto de toda la hoja.
Aflojar una aserción para que pase es perder la prueba entera y no enterarse
hasta meses después.
