# URBIS · cómo se trabaja en este repositorio

Notas para cualquier sesión que retome el proyecto. Están acá porque cada una
de ellas costó tiempo averiguarla o romper algo.

## Lo que sigue, y en este orden

**El registro es hoy el cuello de botella, no el código**, así que endurecer
guardas sobre material que no está solo aumenta la distancia: la guarda de rol
corre en 1 de 5 entradas que declaran, cuatro criterios siguen sin validar, y
los ejes B y C no tienen base histórica. Por eso estas dos van antes que
cualquier otra cosa, y por eso no se abre frente nuevo hasta que estén:

1. **Migrar las veinte entradas con la forma antigua `fuente` + `url`** a
   `fuentes[]` con su `rol`, para que la guarda de «al menos una fuente
   documenta el acto» corra sobre todas.
2. **Entrar como registros los casos del dossier que faltan** — veintidós
   verificados con fuente, la mayoría todavía sin entrada.

Y una precisión sobre la primera: si al migrar aparece una entrada cuyo rol de
fuente **no se puede establecer porque ninguna fuente documenta el acto**, no
se inventa y no se deja pasar. Se queda en `sin-acto` y se sigue. **Es
hallazgo, no obstáculo.**

Después de esas dos está la **especificación de pantalla del módulo
presidencial**, recibida el 19 de septiembre y medida en su propia sección más
abajo. No se implementa antes, y la medición dice por qué: de sus siete
gráficos, cero se pueden dibujar hoy leyendo del registro.

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

#### Se cobró otra vez, y por eso queda como regla (v924)

El 14 de septiembre de 2026, con el árbol sucio, `git merge origin/main`
imprimió `Updating beeaf36..ade17e5` y **abortó**. Yo leí esa primera línea
como que había funcionado. No había ningún commit nuevo, y solo se vio
comprobando `git status` y `git log`; el `git push` de la línea siguiente
—que no estaba encadenado con `&&`— salió igual y lo rechazó el servidor.
Es la segunda vez en dos semanas, así que va como regla y no como anécdota:

* **Se guarda primero y se fusiona después.** Con el árbol sucio la fusión
  aborta, y ese es el caso que imprime el mensaje engañoso.
* **Se encadena con `&&`, nunca con `;` ni en líneas sueltas.** Un empujón
  en su propio renglón sale aunque la fusión no haya ocurrido.
* **Se comprueba la HISTORIA, no el mensaje**: `git log --oneline -1` o
  `git merge-base --is-ancestor origin/main HEAD`. Si el commit de arriba no
  está en la historia, la fusión no ocurrió, diga lo que diga `Updating`.

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

## Una señal de éxito que no lo es

La familia de trampas que más caro sale en este contenedor no son los fallos:
son los **éxitos aparentes**. Una orden que no hizo su trabajo y no lo dice, y
la tanda que sigue creyendo que sí. Ya se cobró cuatro veces y las cuatro por
lo mismo, así que van juntas y arriba, donde se leen antes de trabajar y no
dentro de la bitácora de la versión que las pagó.

### Un parche por anclas o escribe entero o no escribe

Lo último, y lo más barato de evitar. Un `python3` de tres anclas abortó en la
tercera —un parche anterior había separado dos líneas que esperaba juntas—, así
que **no escribió nada**. La corrida siguiente repitió el mismo rojo de antes, yo
lo leí como el fallo conocido, y **reporté el arreglo como aplicado**. El
`AssertionError` estaba impreso encima de los resultados.

Que el parche no escriba a medias es lo CORRECTO: medio archivo parcheado es
mucho peor. El fallo es de lectura, así que la regla es de lectura:

* **todo parche por anclas termina imprimiendo su confirmación** —`print('ok
  parcheado')` después del último `write`—;
* y **esa confirmación se comprueba antes de creerle a la corrida siguiente**.
  Sin ella, «la prueba sigue roja» y «el parche no entró» se ven idénticos.

### Las otras tres de la misma familia

* **`git merge` con el árbol sucio ABORTA**, y su primera línea dice
  `Updating a914a88..609550e`. Se comprueba la HISTORIA y no el mensaje
  (`git merge-base --is-ancestor origin/main HEAD`). Está entera arriba, en
  «Una fusión que falla y no se nota», porque costó dos versiones publicadas.
* **Una salida vacía no es una salida buena.** Grepear la salida de una suite
  por `✗|fallaron` y no encontrar nada se leyó como verde; la suite había
  reventado con un `ReferenceError` y no imprimió ninguna de las dos cosas. Una
  comprobación que busca señales de FALLO tiene que buscar también la señal de
  ÉXITO, o el silencio pasa por aprobación.
* **`echo $?` después de un `| tail` mide el `tail`.** Casi cuesta «arreglar»
  `correr.js` por un código de salida que no era el suyo.

### Por qué esto no es una comprobación de `revisar.js`

Porque no hay nada en el repositorio que mirar: el fallo está en la orden que se
teclea, no en el código que queda. Y este proyecto tiene escrito desde la v878
que una guarda que no puede fallar es un verde, así que conviene decir qué hace
que esta muerda de verdad: **la confirmación impresa**. Sin ese renglón la regla
es un buen propósito; con él, saltársela se ve en el acto.

## Ninguna comprobación desactivada es silenciosa

Va arriba y una sola vez porque este proyecto ya la tomó **cuatro veces por
separado**, cada una creyendo que era un caso particular. No lo es: es la
misma regla, y enunciada es más barata que descubrirla una quinta.

> **Si una comprobación no puede correr, lo dice y se cuenta. No queda
> ausente.**

Lo que la hace necesaria es que una exención silenciosa **se lee igual que un
aprobado**. Nadie miente: simplemente no hay nada escrito donde tendría que
estar la advertencia, y el lector completa el hueco con lo que espera.

| Dónde | Qué se decía antes | Qué dice |
|---|---|---|
| El arnés (v963) | una suite que no imprime nada salía con su palomita | `?` **NO CONCLUYENTE**, aparte de las que fallaron, y hace fallar la corrida |
| La puerta del indicador (v964) | una declaración cuyo acto no está registrado contaba | `sin-base-registrada`, con sus dos causas dichas aparte |
| El indicador (v965) | un criterio sin contrastar salía como una medición más | `validado: no`, con su gravedad y su recuento |
| La procedencia (v966) | las entradas con esquema antiguo no pasaban por la guarda de rol y no se notaba | `no-comprobable-esquema-antiguo`, contado y con el caso por su nombre |

Tres cosas que las cuatro tienen en común y conviene copiar:

* **El estado se CALCULA, no se escribe a mano.** Una marca que alguien tiene
  que acordarse de poner —o de quitar— es una cifra que envejece sola (v903).
* **Las causas se separan si piden acciones distintas.** «No se pudo
  comprobar porque falta un campo» y «porque haría falta migrar el esquema»
  se ven iguales y son dos tareas; juntarlas manda a revisar lo que está
  bien. Es la distinción de la v899 entre «sin dato» y «panel fuera».
* **Y lleva su guarda de la guarda**: que el recuento LLEGUE a la pantalla.
  Sin eso los estados son documentación y la exención vuelve a ser
  silenciosa, que es el patrón de la v878 con su propia lista.

## Una guarda que se pone roja cuando los datos MEJORAN

La gemela de la de arriba, y va aparte porque su síntoma es el contrario:
aquella se lee como un aprobado, esta grita.

> **Una comprobación que se pone roja cuando el registro MEJORA está midiendo
> el número y no la propiedad.**

**La señal para detectarla es que ARREGLAR LOS DATOS rompa la suite.** Nadie
tocó el código, nadie quitó una comprobación: alguien migró una entrada,
consiguió una fuente, retiró una declaración que no se sostenía — y la guarda
se quedó sin nada que rechazar. Eso no es una regresión, es la guarda
diciendo que medía el material y no lo que el material debía demostrar.

Y lo que la hace cara es la presión que ejerce, que es la misma que el rojo
de la v965 ejercía sobre `sin-acto`: **la salida barata de una guarda mal
puesta es dejar el registro torcido para que siga teniendo algo que
rechazar.** Un rojo que empuja a no arreglar los datos es peor que no tener
la guarda.

**Se rehace sobre lo que sobrevive al cero.** La pregunta no es «¿hay
material?» sino «¿qué tiene que seguir siendo cierto cuando no lo haya?». En
la v970 eran dos cosas: que el recuento se calcule sobre TODAS las que
declaran y sobre ninguna más, y que la pantalla tenga **escritas las dos
redacciones** —la de cero y la de N—, porque la segunda es justo la que hace
falta el día que el material vuelva. Las dos se comprueban con el registro
limpio.

Y la rama con material se mide **contra un caso fabricado**, no contra el
registro: medirla contra el registro es volver a medir el número.

El censo va en uno: **v970**, la guarda de rol de la v966. Si aparece otra, se
agrega acá — y la señal es siempre la misma, que la corrida se ponga roja
detrás de una tanda que solo tocó datos.

## Tres clases de error que se repiten, y no son la misma

Cada una lleva ya tres o más casos. Van nombradas y con su censo para que la
próxima se busque **por la forma y no por el caso**, que es lo que no pasó
ninguna de las veces anteriores: cada tanda la encontró de nuevo, leyendo.

Se parecen lo suficiente como para confundirlas —esta misma sección nació de
confundirlas— y piden cosas distintas, así que conviene tener claro cuál es
cuál antes de buscar.

### A · El discriminante estaba al lado y nadie lo leía

**La forma:** una cifra sale mecánicamente bien y **no significa lo que
parece**, porque su sentido depende de una condición que nadie comprobó — y el
campo que resuelve esa condición **ya venía en el mismo objeto**.

Es la más cara de las dos, porque la cifra es defendible una por una: cero
polígonos de espacio público es un hecho comprobable, y «este sector necesita
un parque» es una recomendación de proyecto. El salto entre las dos no se ve.

| | La cifra | El discriminante que ya estaba |
|---|---|---|
| v875 | `pctSinCubrir` = 100 % sin cubrir | `categorias[].puntos` = 0: no mide cobertura, mide una capa vacía |
| v899 | `pctLleno` = 0 % de frente con fachada | `cu.edificios` = 0: el cero es del mapa, no del frente |
| v903 | 204.544 m² de sombra «del volumen de la norma» | `S.indicesPuestos`: nadie escribió esos índices, son el ejemplo |

Y una variante con la misma cura, donde lo que estaba al lado no era una
condición sino **el dato mismo**: la v888 declaraba faltar la huella construida
entre dos fechas teniendo `duro`, `duroDesde` y `duroHasta` en el mismo objeto
y en la misma línea que el verde que sí se leía.

**Cómo se busca:** ante un 0 % o un 100 %, la pregunta no es si la división está
bien — es **sobre cuántos elementos se calculó**. Si el conjunto de partida
puede estar vacío, esa cifra tiene dos lecturas y hay que separarlas.

**Cuánto cuesta arreglarla:** nada. En las cuatro **no hizo falta tocar el
motor**: el campo ya llegaba. Lo único que cambió fue dejar de leer la cifra
como si fuera una medición.

### B · Dos cosas que codifican un solo hecho

**La forma:** dos listas, o dos rutas de cálculo, dicen lo mismo. Coinciden el
día que se escriben — a veces porque una **se deriva** de la otra, y la
derivación es válida entonces— y **se separan la tanda siguiente**, cuando una
de las dos mejora o una decisión cambia el sentido de una sola.

Es la que la v879 dejó enunciada y la que más veces ha vuelto:

| | Las dos cosas | Qué las separó |
|---|---|---|
| v878 | el `id` de una caja y el slug de su título | renombrar el título |
| v884 | la cascada de suelo, copiada en el cierre | el panel aprendió a descontar tres cosas más |
| v906 | dos reglas para elegir el conteo de edificios | cada panel elegía por su cuenta |
| v915 | tres listas derivadas del peldaño | §21 apagaba por su lista corta |
| v933 | `huecosDeCampo` derivado de `PANELES_DE_VACIO` | la v880 sacó un panel de los vacíos y la lista de maquetación no cambió |

**Cómo se busca:** cuando dos nombres distintos significan lo mismo hoy, la
pregunta es **qué decisión futura los separaría**. Si hay alguna, no pueden
derivarse uno del otro sin una guarda que los ate.

**Cuánto cuesta arreglarla:** una función, y retirar la copia. Lo que NO se hace
es dejar las dos y «acordarse» de tocar ambas; eso es lo que falló todas las
veces.

**Y el canje que hay que decir:** derivar una lista de otra es normalmente lo
CORRECTO y este proyecto lo hace a propósito en varios sitios —el id de una
plantilla sale de su título (v883), los slugs de los vacíos salen de sus
títulos (v931)— justamente para que no puedan separarse. La derivación es mala
solo cuando las dos listas **significan cosas distintas** y coinciden por
accidente. La prueba para distinguirlo es una pregunta: *¿existe un cambio
razonable que deba mover una y no la otra?* Si la respuesta es sí, son dos
cosas y hay que atarlas con una guarda, no derivarlas.

### C · El dato está y ninguna pantalla lo alcanza

**La forma:** el dato existe en el sistema —está escrito en el archivo, o se
calcula en cada corrida— y **ninguna superficie lo enseña**. Desde afuera se
ve **exactamente igual que un dato ausente**, y por eso la tanda siguiente lo
declara faltante o lo vuelve a levantar.

La nombró el usuario al leer la v967, sobre el hallazgo del Decreto 1136, y
tiene razón en que es aparte: la A es una cifra que se lee mal porque no se
miró su discriminante, la B son dos codificaciones de un hecho; esta es **un
hecho con una sola codificación, correcta, que no llega a ningún lector**.

| | El dato | Por qué no llegaba |
|---|---|---|
| v929 | el análisis post-sector entero, que `compararConCampo` ya calculaba | usaba `res.pois` para el diff y **descartaba el resto en la línea siguiente** |
| v935 | la malla de flujo, calculada por el motor en cada corrida | el pliego la recibía y la botaba: cero `mapaCalor` en `js/68` |
| v967 | la única fuente que documenta el acto del Decreto 1136 | vivía en `fuente`+`url` y `fuentesDe` prefiere `fuentes[]` cuando existe |

**Cómo se busca:** al revés que las otras dos. En la A y la B se parte de una
cifra impresa; acá hay que partir de **lo que el sistema produce** —lo que el
motor devuelve, lo que el archivo guarda— y preguntar qué superficie lo
enseña. Un campo que ningún consumidor lee, y un cálculo cuyo resultado se
descarta a la línea siguiente, son los dos síntomas.

**Y no tiene guarda, a propósito.** Perseguir «campo del registro que ninguna
pantalla lee» daría docenas de falsos positivos —campos internos, campos que
solo alimentan una cuenta— y terminaría en una lista de excepciones que
envejece hasta no significar nada, que es la razón por la que la v895 no
persigue «clase sin regla». Queda **anotada con su censo**, que es lo que el
usuario pidió: la próxima se busca por la forma.

### No se confundan: una corrección de esta misma sesión

Al cerrar la v933 escribí que era «la tercera vez que el discriminante estaba
en el código y nadie lo miraba, como `puntos` en la v875 y `cu.edificios` en la
v899». **Está mal de dos maneras**, y como cambia por dónde buscaría la sesión
siguiente, se corrige acá y no se deja pasar:

* la v933 es de la clase **B** y no de la A. Lo que falló es una lista derivada
  que dejó de coincidir; que `panelVacio` fuera el discriminante sin leer es
  cómo se ENCONTRÓ el arreglo, no cómo se produjo el fallo;
* y el contador de la A ya iba en tres desde la v903, así que «tercera vez»
  estaba repetido.

Las dos clases se tocan justo ahí —el fallo fue de B y la cura vino de A— y es
la razón de que se confundan. Por eso van juntas, con sus censos separados.

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

#### Y a veces no es que se cayera: es que el esquema no está

Peor que la base caída, porque se parece. En un contenedor recién levantado la
BASE puede existir y el ESQUEMA no, y entonces `migrar.js` hay que correrlo
otra vez —no es solo `service postgresql start`—. La señal en `tvision` es la
misma de siempre, «Cannot read properties of null (reading 'deficit')», así que
antes de sospechar de una regresión se miran las dos cosas:

```bash
service postgresql status                                   # ¿está en pie?
su postgres -c "psql -d urbis_vt_pruebas -tc \
  'select count(*) from vt.territorios'"                    # ¿tiene datos?
```

Y `semilla.js` es idempotente: sobre una base ya sembrada contesta «ya estaba»
y no es un error.

#### Contar filas sin el territorio puesto da CERO, y parece una base vacía

La trampa de arriba tiene una gemela que cuesta más. La RLS filtra por el
territorio de la sesión, así que una consulta sin `set_config` devuelve cero
filas —es el fallo seguro y está dicho más arriba—, pero al diagnosticar se lee
como «la semilla no entró». Dos detalles que lo empeoran y conviene tener
escritos:

* **lo que la RLS espera es el `territorio_id`, no el código DANE.** Poner
  `'54001'` donde va el uuid devuelve cero con la misma cara que ponerlo bien;
* **las tablas son PLURALES** —`vt.territorios`, `vt.equipamientos`,
  `vt.manzanas`—, y con el nombre en singular el error sí se ve, que es lo de
  menos.

Para diagnosticar de verdad se cuenta como `postgres`, que **sí** salta la RLS
por ser superusuario. `FORCE` alcanza al DUEÑO de la tabla (`vt_migrador`), que
es lo que impide que una función `SECURITY DEFINER` cruce territorios; no
alcanza al superusuario.

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
* **La ficha de propuesta en PDF, y un mapa dentro de la hoja** — la ficha es
  el papel con el que se aprueba una obra y todavía no se baja; y la hoja de
  déficit sale sin mapa, porque el servidor no descarga teselas y un recuadro
  vacío rotulado «mapa» sería el marco esquemático que la v887 prohibió.
  `ya: la hoja de déficit se compone en el SERVIDOR y se baja en PDF con su marca de agua de origen —que el navegador no puede quitar—, el aviso entero, el método, la fecha de corte, quién la generó y la misma cifra que la pantalla, de la misma consulta`
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

## Toda la aplicación habla de usted (v909)

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

### Demostrado contra la v907 (publicada como v909)

**376 denuncias en 35 archivos**, con archivo y línea: «js/02-auth-roles.js:192
tu · …:195 Estás · js/05:385 TU…». Cero después. Y la comprobación del
recorrido pasa contra las dos versiones a propósito: es una guarda contra que
el autómata vuelva a perderse, no una afirmación nueva.

## Una cita no sobrevive al panel que la sostiene (v910)

Cinco cosas medidas sobre el PDF de la v905, con las dos hojas en la mano.
Tres eran defectos y se arreglaron; **dos eran preguntas, y la respuesta
honesta a las dos es una medición, no un parche**. Las cinco tienen el mismo
hilo que la v899 y la v879: la hoja afirmando por descuido lo que no puede
sostener.

### §1 · un panel cedió y la síntesis siguió citándolo

Llegó con las dos casillas impresas:

> PRESIÓN DE CRECIMIENTO · «2,6 puntos de superficie dura de menos entre 2014
> y 2026» · HORIZONTE TEMPORAL · «medido de 2014 a 2026»

y la banda de la que salen esas cifras —«Cómo cambió el sitio», las estampas
de 2014 a 2026— **no estaba en la lámina A**. La bibliografía seguía citando
Planetary Computer «para la serie temporal».

Es justo lo que el ORDEN DE CESIÓN de la v901 tenía que impedir, y no lo
impedía: aquella tanda guardó el **recuento** —que las once casillas se
compongan— y no las **citas**. Una casilla puede componerse perfectamente y
estar hablando de un panel que ya no está en el papel.

#### La dependencia se declara en la casilla, no se adivina

`crucesDelSector` recibe un parámetro más por casilla: de qué panel depende.

```js
var F  = function (k, v, l, p) { filas.push({ k: k, v: v, l: l, p: p || null }); };
var SM = function (k, l, p)    { filas.push({ k: k, v: 'SIN MEDIR', l: l, sm: true, p: p || null }); };
```

Las dos de la serie declaran `['Cómo cambió el sitio']`. Al componer, con la
MISMA señal que la v899 usa para saber que un panel cedió, la casilla se da
vuelta: pasa a **SIN MEDIR**, nombra el panel ausente y dice el remedio
—apagar otro panel desde la ficha, o imprimir esa hoja suelta, que sube la
escala y la devuelve con su banda—.

Y dice **cuál de las dos cosas pasó**, que es la distinción que la v899
estrenó y acá se hereda: *la cifra está medida*, lo que falta es la banda que
la sostiene. No es un dato de menos, es un panel fuera. Confundirlos manda al
lector a buscar una fuente cuando lo único que hace falta es apagar un panel.

#### La bibliografía también cita, y también tenía que encogerse

Una entrada de bibliografía es una cita como cualquier otra. La de la serie
temporal pasó a ser un objeto con las dos redacciones:

```js
{ t: 'Esri World Imagery; Microsoft Planetary Computer (Sentinel-2, Landsat) para la serie temporal.',
  panel: 'Cómo cambió el sitio', sinPanel: 'Esri World Imagery.' },
```

Es la regla de `faltanDeCiudad` de la v876 —**una lista que se encoge sola no
puede quedarse vieja, porque no está escrita: se calcula**— dicha al pie de la
hoja en vez de en un panel.

**Y se auditaron las doce entradas, no solo la que falló.** Es la única cuya
justificación entera es un panel: las demás nombran una fuente que la hoja usa
en varios sitios —la NSR-10 aparece trece veces, el IDEAM doce, el Decreto 1504
diez— o que sostiene el CIERRE, que no cede nunca; la Ley 388 sale una sola vez
en la bibliografía, pero el POT lo citan siete sitios más, entre ellos la
factibilidad de las cinco propuestas. El mecanismo queda genérico —`panel` y
`sinPanel` en cualquier entrada, una línea— para el día que una entrada nueva
sí dependa de un solo panel.

#### La respuesta al «qué peldaño y por qué»

Cedió, no se cayó, y el peldaño es el **1**. «Cómo cambió el sitio» se arma con
`caja(...)`, y el peldaño 1 del orden de cesión son las cajas; los anillos y la
calle comercial son mapas, y los mapas secundarios son el peldaño 2. Así que
salió antes que ellos **por construcción**, no por un fallo.

Lo que sí queda dicho, porque es una tensión real de la regla: el orden que el
pliego pide empieza por «los paneles de texto explicativo», y esta caja **no
es texto** —son cinco estampas de satélite—. Lo mismo «Asoleamiento», que es
una carta solar. La v901 midió que en la lámina B ninguna caja es solo texto y
concluyó que el peldaño 1 son *los paneles*; en la lámina A hay cuatro cajas
que llevan un dibujo de verdad (`CAJAS_DIBUJO`), y esas discuten el peldaño.

**No se movieron, y la razón es de método, no de opinión:** el sector de
prueba compone las dos láminas **sin ceder nada** —los dos paneles salen
enteros, comprobado sobre el papel guardado—, así que un cambio de peldaño no
se podría medir desde acá y entraría a ciegas. Es la decimosexta vez que este
proyecto tropieza con material que no puede producir el caso, y la primera en
que la conclusión es **no tocarlo** en vez de enriquecer el material: enriquecerlo
aquí significa fabricar una lámina que no cierra, que es otra tanda.

Queda escrito acá y **no en la lista viva**, a propósito: esa lista es de
fuentes que faltan, y esto no es una fuente — es una decisión de diagramación
pendiente, con su medición hecha para que la tanda que la tome no empiece por
averiguar lo mismo.

**Lo tomó la tanda siguiente, y con una lista en vez de una regla:** ver «El
peldaño se declara, y la banda dice lo que perdió» (v911). Esta sección se
queda como está porque su medición es la que valió —el sector de prueba no
cede— y porque la solución no fue mover peldaños a ojo sino que el usuario
dictara la lista panel por panel. La rama que sí cede se ejercita ahora con la
corrida de 19,6 km² y la letra de colgar.

### §2 · un chequeo pasaba contra SIN MEDIR

> PASA · La trama y el paramento no se llaman igual … 103 cruces por km²
> (lámina A) · **SIN MEDIR** (lámina B)

La v899 enseñó a las casillas a imprimir **SIN MEDIR** donde va la cifra. Lo
que no se hizo entonces es enseñarle al lector de chequeos que eso **no es un
valor**: `cruceEn` devolvía la cadena, los dos lados existían, y el chequeo se
daba por pasado. Es literalmente el error típico que el propio panel declara
dos renglones más abajo —«dar por bueno un chequeo que no se pudo correr»—,
cometido por el panel que lo declara.

El arreglo va **en el único sitio por donde pasan los doce**, que es la regla
de la v867:

```js
/* Una casilla «SIN MEDIR» no es un valor: es la marca de que no se pudo
   medir. Devolverla dejaba pasar el chequeo con un lado vacío. */
return (v && !/^\s*SIN MEDIR\s*$/i.test(plano(v))) ? v : null;
```

Con eso el chequeo sale **SIN DATO**, que es lo que ya sabía decir, y —esto es
lo que lo vuelve una tarea— **nombra la plantilla que lo llena**: «Actividad en
primer piso», de las seis de la v883. Un «sin dato» que no dice cómo se
consigue es la mitad del trabajo, que es la decisión de la v880 con el ámbar y
el verde.

La guarda persigue **la clase y no ese chequeo**: sobre las dos hojas
compuestas, ninguno marcado «pasa» puede tener un lado en SIN MEDIR.

### §4 · la v904 conectó la ubicación escrita a mano y nunca corrió

«Dónde queda, escala por escala» seguía imprimiendo «Sin nombre en el
geocodificador: Comuna» con el estudiante habiéndola escrito dos pantallas
antes, y la cabecera de la misma hoja sí la usaba.

La conexión existía desde la v904. Lo que no existía era el campo:

```js
var partes = String((escrito && escrito.t) || '').split(',')   // era escrito.valor
```

`escrito.valor` es `undefined` siempre, así que `partes` quedaba vacío, la
guarda de «menos de dos segmentos» disparaba y la función devolvía la ubicación
del geocodificador intacta. **Ni un error ni una consola: una mejora escrita,
probada a ojo y desconectada.**

Es la regla de la v863 en su forma más barata de evitar —se comprueba leyendo
la función que devuelve el objeto, no recordando cómo se llama su campo— y la
misma que costó dos aserciones en la v895 con `f.meta.forma`. Ahora hay una
aserción que lo lee **del papel**: que ninguna casilla salga sin nombre, y que
la que toma lo escrito **declare que ese nombre lo escribió una persona** —un
nombre tecleado y uno consultado se ven igual impresos (v867)—.

### §3 · los tamaños impresos SÍ son los medidos

La pregunta era si el reflujo de la v901 se aplica en la exportación a PDF o
si el pie miente. Medido: **el pie dice lo que el papel mide**. La
comprobación de la v886 lo cruza en cada corrida —«A dice 95 y mide 94,6 · B
dice 83 y mide 82,5»— y por construcción no puede separarse más de un
milímetro, porque la cifra se sustituye en la cadena sobre la hoja **ya
maquetada**.

Lo que cambió es el **sector**, no el código: aquella medición del reflujo salió
del sector de prueba —1,77 km², radio equivalente de 750 m (v890)— y el PDF
medido es una corrida de radio 2.500. Con más área entran más cajas por banda,
`pistasQueLlenan` elige otra anchura y el reparto es otro. Los ocho de
categoría bajan de 9,7 a 8,3 cm por eso, no por una regresión.

**Y es exactamente lo que §21 no alcanza y la v886 dejó escrito**: los 10 cm de
los de categoría no se sostienen a cualquier escala de análisis sin perder
paneles medidos. La salida sigue siendo la de siempre y está impresa al lado de
la cifra: apagar paneles desde la ficha sube la escala de composición y con ella
todos los mapas.

### §5 · la banda ambiental no está incompleta: cedió

Las tres cosas que §5 da por faltantes —carta solar con solsticios y
equinoccios, recomendación de orientación de fachadas derivada de ella, y horas
de sol y radiación por orientación— están **las tres en la v882** y **las tres
en la misma caja**, `Asoleamiento`: la carta la dibuja `dib('cartaSolar', …)` y
la tabla de las ocho orientaciones es `tablaDeOrientacion()`, llamada dentro de
esa misma caja.

Así que no falta ninguna: **cedió la caja que las lleva**, por lo mismo que la
serie temporal y en el mismo peldaño. La hoja lo dice —lo que cede se nombra en
el pie desde la v850— pero se lee como una lista de paneles y no como «le falta
la carta solar a la banda ambiental», que es como se leyó.

Es la otra cara de §1 y vale escribirla: **cuando un panel cede, lo que el
lector ve no es un hueco rotulado, es una banda que parece terminada.** §1 se
podía arreglar porque algo la citaba; acá no cita nadie, y lo único que queda
es el pie. Subirlo de peldaño es la discusión de §1, con la misma medición
encima: desde el sector de prueba no se puede probar.

### Demostrado contra la v909

`tdoslaminas`, con la banda cedida a propósito (`pliegoOff: ['como-cambio-el-sitio']`):

* con la banda puesta, las dos casillas citan sus años —«medido de 2014 a
  2026», «9,4 puntos de superficie dura»—;
* con la banda cedida, **la v909 las sigue imprimiendo igual** y la
  bibliografía **la sigue citando**;
* y el chequeo de la trama sale «pasa» contra un lado vacío.

`tsinmapear` lo enseña donde vive el material —su segundo lote, el de la v899,
no tiene una sola fachada mapeada—:

```
✗ ningún chequeo marcado «pasa» tiene un lado en SIN MEDIR
    — pasa La trama y el paramento no se llaman igual · miden cosas distintas …
✗ el de la trama sale sin dato y nombra la plantilla que lo llena
```

Y una del método de demostrar, que ya está escrita en la v875 y se volvió a
cobrar: el `git stash` del archivo entero se lleva también lo que la suite
necesita para LEER, así que dos de las aserciones fallan por «la función no
existe» y no por el defecto. Las que valen son las que enseñan el texto viejo
impreso — acá, la bibliografía citando la serie de una banda que no está.

## El peldaño se declara, y la banda dice lo que perdió (v911)

La v910 arregló cinco cosas del PDF y destapó una sexta que vale más que las
cinco: **el ORDEN DE CESIÓN de la v901 no hacía lo que decía.**

El peldaño 1 estaba escrito como «los paneles de texto explicativo». La misma
v901 midió, dos secciones más abajo, que **de las 37 cajas de la lámina B
ninguna es solo texto** — y de ahí concluyó que el peldaño 1 «son los
paneles». Con eso el criterio que quedó operando no era cuánto vale un panel
sino **cómo está construido**: todo lo que sale de `caja()` cedía primero.

Por eso cedieron, las dos veces que la v910 encontró, una carta solar y cinco
estampas de satélite — antes que un anillo de distancia, que es un mapa.

    v910          Asoleamiento cede en el puesto 5 · El grano en el 10
    v911          Asoleamiento en el 17 · El grano en el 7

### Una lista, y por qué no es un retroceso

Se reemplaza por `PELDANO_PLIEGO`: cada panel —caja o mapa— declara su
peldaño. El 0 no cede nunca; el 1 cede primero; el 3, último.

Cambiar una regla por una lista parece ir para atrás, y hay que decir por qué
no lo es: **una regla estructural que no separa lo que dice separar es peor
que una lista**, porque se lee como un criterio y nadie la vuelve a mirar. La
lista se ve entera en veinte renglones y se discute.

Lo que sí se pierde es lo que la regla daba gratis —que una banda nueva quede
protegida sin que su autor se acuerde, la propiedad que salvó al aviso de
origen de la v867—. A cambio, **el que no declare su peldaño cae en el 1 y
cede PRIMERO**: lo que se olvida se nota en la primera composición apretada,
no tres tandas después. Es el mismo canje de la v880 con la guarda del voseo:
entre fallar abierto y fallar cerrado, se elige fallar cerrado.

Cajas y mapas llevan el mismo número, porque un mapa y su caja de conteo son
el mismo panel para quien lee la hoja.

#### Tres cosas que la lista dictada no decía, y cómo se resolvieron

* **`calor:todos` se queda en el peldaño 0** sin estar en la lista. Lo pone la
  v850, dicha dos veces y con el PDF en la mano —«nunca la foto ni el de todos
  los usos»—. Sumarlo honra las dos instrucciones; quitarlo habría sido dejar
  caer una por no estar repetida en la última.
* **Los mapas de categoría van por PATRÓN y no uno por uno.** Sus
  identificadores salen de las categorías que el sector tenga —`calor:comercio`,
  `calor:salud`…—, así que una categoría nueva quedaría fuera de una lista
  escrita y cedería sin que nadie lo decidiera.
* **«Verde y agua (el mapa; la caja de conteo se queda)»** es el único renglón
  ambiguo: el único nivel que no cede es el 0 y la caja no está en el 0. Se lee
  «se queda» como «cede la última» —el peldaño 3—, que es donde están las demás
  cajas de su banda. Queda dicho por si la lectura era otra.

Y dos deltas contra lo que protegía la v901, las dos a propósito: `el-sitio` y
`los-mapas-del-sector` ya no son intocables —la lista no los nombra, así que
ceden en el 1 por omisión— y `suelo-disponible-real` y `potencial-edificatorio`
bajaron de «nunca» a «último», que es lo que la v910 hizo posible: con el panel
fuera su casilla dice SIN MEDIR nombrándolo, en vez de quedarse sin con qué
cruzarse.

### Una tercera lista de la misma forma, razonada y NO medida

Buscando si había una tercera con la forma de las dos anteriores apareció
esta: las casillas de síntesis y la bibliografía viven en la lámina **B** y
citan paneles de la **A**, y cada hoja se compone con su propio `apagadas`.
La v910 hizo que una casilla dejara de citar un panel ausente y lo probó
apagándolo a mano —`pliegoOff` viaja en las opciones y llega a las dos
hojas—; pero si el panel lo cede la BISECCIÓN de la A, su lista muere ahí y
la B no se entera.

`laminaDoble` le pasa ahora a la B lo que cedió la A (`pliegoCedidasOtraHoja`),
y las citas leen las dos listas.

**Y hay que decir que esto está RAZONADO y no medido.** Creí haberlo medido:
compuse la serie con la hoja apretada, la caja no estaba en la A y la casilla
de la B seguía diciendo «medido de 2014 a 2026». Pero al buscar la caja en la
lista de lo que cedió **no estaba**, y en un documento sin apretar tampoco se
compone: la caja lee `S.evo` y la suite inyecta la serie por opciones, que es
de donde la casilla sí la toma. O sea que el panel nunca estuvo en la hoja, y
lo que yo leí como «cedió y la B no se enteró» era el caso corriente de un
panel sin dato.

Así que el arreglo se queda —el razonamiento se sostiene solo: en producción
`S.evo` está puesto, la caja se compone, y si la A la cede la B no tiene cómo
saberlo— pero **sin una prueba que lo ejercite**, y eso vale decirlo entero en
vez de dejar una aserción que pase por otra razón. Para ejercitarlo hay que
correr la serie de fotos de verdad en la suite (`E.rutaWayback` existe desde la
v907) y después apretar la hoja: son diez descargas y otras tantas pasadas del
clasificador, y es otra tanda.

#### La divergencia que lo destapó se cerró en el acto

`crucesDelSector` y el CUERPO de la caja leían `o.evo !== undefined ? o.evo :
S.evo`; el **inventario** —el que decide si la caja está `listo`— leía solo
`S.evo`. Es la clase de la v879 y no se dejó para después: hay una sola
función, `evoDe(o)`, y la llaman las cuatro lecturas.

Lo que costó fue averiguar **qué se veía de verdad**, y la primera respuesta
era falsa. Dije que con la serie por opciones la caja no se componía: no es
eso. El cuerpo siempre leyó `o.evo`, así que la caja sale en las dos
versiones; lo que el inventario decide es otra cosa —quién entra en la lista
de candidatos a ceder—, y con él leyendo `S.evo` la caja se componía y
quedaba **inmune por accidente**: `ordenDeSacrificio` la daba por no lista y
no podía cederla nunca.

Es una consecuencia más chica que la que anuncié y hay que decirlo así. La
aserción que quedó es la que distingue las dos versiones —contra la v911 sin
unificar sale «inmune por accidente: el inventario la da por no lista»— y al
lado va su guarda, declarada como tal: que la caja siga componiéndose, que es
lo que pasaba en las dos y no podía romperse al unificar.

De paso, el fixture: `EVO_SERIE` traía la tendencia y **no los pasos**, y el
inventario cuenta pasos medidos. Sin ellos la caja nunca era candidata por
falta de material y no por el código, así que la comprobación habría pasado
por no tener nada que rechazar. Es la decimoséptima vez.

### El papel solo no distingue «cedió» de «nunca tuvo dato»

La regla que salió de la foto satelital, y vale para toda comprobación de
cesión que venga después.

Medir sobre el papel es lo correcto —lo que hay que comprobar es lo que el
lector no encuentra— pero un panel ausente lo está por dos razones que se ven
IGUAL en la hoja: cedió el sitio, o nunca tuvo dato que imprimir. La primera
versión de la aserción del peldaño 0 denunció la foto satelital como cedida, y
lo que pasaba es que esa corrida no midió la cobertura.

**Toda aserción de cesión necesita la misma corrida SIN apretar como base.**
No una lista de lo que debería existir —que envejece— sino el mismo documento
compuesto sin la presión: lo que está en la base y no en la apretada, cedió;
lo que no está en ninguna de las dos, nunca estuvo. Es la distinción de la
v899 entre «sin dato» y «panel fuera», dicha para las pruebas.

### El bug que salió al medir: los mapas de la OTRA hoja también cedían

`mapasDisponibles` es el inventario del SECTOR y no sabe de hojas. Así que
componiendo la lámina A sus candidatos incluían los mapas de la B: apagar uno
que no está no libera un milímetro, y después se declaraba fuera — **el pie de
la A nombraba mapas que nunca estuvieron en la A**.

Es exactamente el fallo que la v901 encontró y arregló para las cajas —«lo que
no está compuesto no puede ceder»— y que quedó vivo para los mapas, donde no lo
miraba nadie. Se vio porque la lista de lo que cede salía con `anillos`,
`hitos`, `sombras` y `alturas` **repetidos**, no leyendo el código.

### Una banda que pierde su caja principal PARECE TERMINADA

Es el hallazgo de la v910 y vale más que el arreglo que lo destapó. Cuando
cedió la serie temporal, la síntesis siguió citándola y por ahí se pudo
detectar. Cuando cedió la carta solar **no la citaba nadie**: la banda
ambiental salió con su título, su pregunta y su conclusión, y sin la caja que
responde la pregunta. Se lee como una banda entera.

Cada banda declara ahora su caja principal y **qué lleva**, y si esa caja cedió
la banda lo imprime debajo de su pregunta, en rojo y a trazos:

> **Falta en esta banda:** Asoleamiento (carta solar y orientación de fachadas).
> Es la caja que responde la pregunta de arriba, y cedió el sitio en esta
> composición para que la hoja cerrara. Está medida: para verla, apague otro
> panel desde la ficha o imprima esta hoja suelta.

Va DENTRO de la banda y no en el pie a propósito: lo que cede se nombra en el
pie desde la v850, pero el pie es una lista de paneles y se lee después de
haber leído la hoja. Esto va donde el lector está mirando cuando le falta la
respuesta. El rojo a trazos es el de la contradicción de la v879 y el del aviso
de escala de la v890 —«no le crea a esta parte todavía»—, y no el ámbar de la
v849, que significa «esto no lo tenemos»: esto sí lo tenemos, solo que no cupo.

#### `pliegoOff` junta dos cosas que no son la misma

La trampa de la tanda, y por poco. La primera versión leía `apagadas` para
saber si el panel había cedido — y `apagadas` es `pliegoOff`, que junta **lo
que cedió la bisección** con **lo que apagó una persona desde la ficha**. A
quien apaga Asoleamiento a propósito, decirle que «cedió el sitio para que la
hoja cerrara» es declararle mal la causa —la falta de la v867— sobre una
decisión que tomó él. Y habría salido en la hoja de cualquiera que use «dejar
solo el plano».

La bisección pasa ahora `pliegoCedidas` aparte, y el renglón lee esa. Hay una
aserción para cada rama, y la de la caja apagada a mano es la que de verdad
guarda.

#### Y se calla cuando el MAPA responde la pregunta

Medido sobre el papel: en la composición apretada cedió la caja
«Llenos y vacíos» y **no salió renglón** en la banda de morfología. No es un
fallo: el mapa del mismo nombre seguía puesto y la pregunta de la banda
—«¿qué tan lleno está el sector?»— quedaba respondida. La comprobación es que
el TÍTULO esté en la banda, no que esté la caja, y eso cubre las dos formas.

Lo que sí queda sin renglón es una banda que se va ENTERA: ahí no hay banda
donde imprimirlo, y tampoco hace falta —una banda que no está no aparenta estar
terminada—. Queda dicho.

#### La banda de las plantillas no declara principal

Sus seis cajas son formularios en blanco intercambiables, ninguno responde la
pregunta solo, y la conclusión los CUENTA desde la v903 —«trae N plantillas»—,
así que una que ceda ya se ve en el propio cierre. Declarar una como principal
sería inventar una jerarquía que la banda no tiene.

### El material: la corrida de 19,6 km² con la letra de colgar

A 1,77 km² las dos láminas cierran **sin ceder un solo panel** — es lo que la
v910 midió y la razón por la que no tocó el orden. Así que estas comprobaciones
habrían pasado por no tener nada que rechazar: es el agujero que este proyecto
lleva dieciséis tandas persiguiendo.

La corrida de 19,6 km² que la v890 ya hace cede **dos** paneles, los dos cajas
de movilidad. Con la letra de colgar —«Se lee de pie», una opción de verdad de
la aplicación, no una puerta trasera— cede **54**, y ahí se ve el orden entero:
los peldaños 1, después el 2, después el 3.

Tres cosas del método que costaron una vuelta cada una:

* **`laminaA` no corre la bisección.** Llama a `laminaImprimible` directo, así
  que mi primera sonda con `letra: 'grande'` midió exactamente lo mismo que sin
  ella y yo lo leí como «cede igual». La que bisecta es `laminaDoble`.
* **`pliegoFuera` es la CONCATENACIÓN de las dos hojas.** La primera aserción
  comparaba la posición de Asoleamiento (lámina A) contra la de los anillos
  (lámina B) y salió roja: no medía un orden, medía en qué hoja está cada uno.
  El par que vale es de la misma hoja — Asoleamiento contra El grano.
* **El peldaño 0 se reescribe en la suite y no se importa del módulo.** Una
  comprobación que lea la misma tabla que el código no comprueba nada: solo que
  la tabla es igual a sí misma.

### Demostrado contra la v910

Cinco aserciones, tres en rojo con el estado viejo impreso:

```
✗ ningún panel del peldaño 0 cede  — calor:comercio · calor:institucional (dos veces cada uno)
✗ la carta solar no cede antes que un panel de la MISMA hoja con peldaño menor
    — Asoleamiento en 5 · El grano en 10
✗ la banda que perdió su caja principal lo imprime  — ningún renglón
```

Los duplicados de la primera son el bug de los mapas de la otra hoja, impreso.

Las dos que **no** fallan son guardas, no afirmaciones nuevas —como las de la
v879, la v882 y la v890—: que una hoja que no cedió nada no imprima ningún
renglón, y que una caja apagada a mano no se declare como cedida. Contra la
v910 se cumplen por no existir el renglón; existen para que esta tanda no se
pase de avisar.

## Una banda no cede en silencio, y el peldaño 1 es lo hipotético (v912)

El PDF de la v911 llegó medido y con un reclamo que valía más que los cinco
puntos anteriores: **la lámina A pasó de SEIS bandas a cuatro**. Desaparecieron
enteras «Riesgo y servicios» y «Cómo cambió el sitio», y la hoja no dijo una
palabra.

### Primero medir cuál de las tres era

El reporte planteaba tres hipótesis y pedía medir. Con la misma corrida sin
apretar como base —la regla que la tanda anterior acababa de escribir— sale
sola:

```
riesgo       base=1  apretada=0  ← perdió: Infraestructura de servicios
movilidad    base=5  apretada=0  ← perdió las cinco
medir        base=6  apretada=0  ← perdió las seis
campo        base=8  apretada=0  ← perdió las ocho
```

No es que la bisección apague por banda: **apaga panel por panel, y la banda
se evapora cuando cedieron todos los suyos**. Y cedieron porque de los ~56
paneles del inventario, `PELDANO_PLIEGO` solo nombraba los ~20 de la lista
dictada: todo lo demás caía al peldaño 1 por omisión y la regla de fallar
cerrado los barrió en bloque. Era **(a) con (c) encima**, no (b).

### El peldaño 1 no es «lo secundario»: es LO HIPOTÉTICO

Completar la lista destapó que el criterio con el que estaba escrita era el
equivocado, y el que la corrigió fue el propio lector:

> «Un anillo de distancia es una medición del territorio y una sombra sobre un
> lote sin norma es una suposición con buena pinta. Entre perder una medición
> y perder una suposición, se pierde la suposición.»

Así que el peldaño 1 es **lo que descansa sobre un polígono trazado a mano o
sobre índices que no existen**: las tres sombras de proyecto, «Qué cabe en el
lote», «La cuadra del lote», «Qué le pide el sitio», lo que se alcanza a pie
desde el lote y las marcas de lo intangible. Los anillos, los hitos, la calle
comercial, las manzanas por estrato, «El grano» y el mapa de verde y agua
bajan al 2.

**Se midió lo que costaba la primera versión**, y por eso se corrigió: con los
anillos y los hitos en el peldaño 1, CUALQUIER hoja que tuviera que ceder algo
empezaba por ahí — también la de 750 m, que solo necesitaba soltar un panel.
Pasó de 60 cajas a 56 y perdió los dos mapas que el lector nombra como los que
más le importan. Con el criterio corregido vuelve a sus 60.

Es la lección de la v886 y la v901 otra vez: **una decisión de orden no se
juzga leyéndola, se juzga midiendo qué se lleva por delante.**

### Una banda completa nunca cede en silencio

La regla nueva, y es la que de verdad cierra el agujero: perder un panel se ve
—la caja no está—; **perder la banda entera es invisible**, porque no queda ni
el hueco donde estaba.

`if (!suyas.length) return;` tiraba la banda con su encabezado, su pregunta y
su número. Ahora la banda se queda y imprime un renglón único:

> **Banda completa fuera de esta composición.** Llevaba Cómo se llega · Cómo
> se mueve el sector · El perfil de la calle · A distancia de caminar.
> Cedió entera para que la hoja cerrara, y está medida: apague paneles desde
> la ficha o imprima esta hoja suelta y vuelve con todo.

Y **solo cuando de verdad cedió**: si ninguno de sus paneles llegó a
componerse por falta de dato, la banda no existe y decir que cedió sería
declarar mal la causa, que es la falta de la v867. Se lee de `pliegoCedidas`,
la señal que la v911 separó de «lo apagó una persona».

### La numeración es del pliego, no de lo que sobrevivió

Era `i + 1` sobre las bandas compuestas, así que al caer dos la lámina A
imprimía «01 → 04» y el lector no tenía forma de saber que faltaban. Sale
ahora del orden declarado en `GRUPOS`, corrido por las dos hojas —la A y la B
son el mismo pliego—: si la 03 cede, la siguiente sigue siendo la 04 y la 03
aparece con su renglón. **Un número que se corre solo borra la prueba de que
algo falta.**

Medido sobre el papel apretado: `01 02 03 04 07 08 05 09 10 11 06 12`.

### §21 apagaba mapas del peldaño 0 por su cuenta

Salió al completar la lista: dos mapas de CATEGORÍA quedaron bajo los 8 cm y
el camino de §21 —que apaga por tamaño con su propia lista corta de
protegidos— los apagó. Ese camino no pasaba por el orden de cesión, así que el
peldaño 0 valía en la bisección y no valía ahí. **El peldaño manda en los dos
caminos o no manda en ninguno.**

### Lo que el reporte daba por perdido y solo había cedido

La lista de «Hitos y nodos» —cada hito con su categoría y su distancia— no
cambió de formato: está entera («Sitio 21 · Educativo · 119 m»). En el pliego
real cedió **la caja** y quedó el **mapa**, que imprime los nombres corridos.
Con la lista corregida las dos son peldaño 2 y ceden juntas, mucho más tarde.

### Lo que §10 pide y esta versión NO hace, con la premisa corregida

Las dos cifras de edificios —3.760 contra 3.673, 848 contra 747— **no son dos
consultas distintas**, que es lo que se venía suponiendo desde la v906. Son
`trazado.llenos.edificios` y `trazado.alturas.edificios`: **dos conteos dentro
de la MISMA consulta de trazado**, uno el de las huellas que entran al
porcentaje de lleno y otro el de las que traen altura.

`conteoDeEdificios` unificó la elección entre la consulta de usos y la de
trazado (v906) y no toca esta otra, porque cuando se escribió nadie había
mirado de dónde salía cada número. Unificarlas es del motor y es otra tanda:
queda con la premisa corregida, que es lo que le faltaba para poder hacerse
bien.

**Y con la premisa corregida se midió, en la v915: no había nada que
unificar.** Las dos son la MISMA variable del motor —43 y 43 sobre un fixture
con 43 edificios, 40 con forma y 3 solo punto—, así que lo que entró fue la
guarda de que no se separen, en `ttrazado`, con su propia guarda de material.
Este renglón se quedó declarando pendiente algo ya hecho.

## La secuencia crece, y la última caja de una banda se protege (v913)

Tres cosas del PDF de la v912, y la primera es un bug que introdujo la v912
misma.

### El número quedó fijo y se rompió la secuencia

La v912 clavó el número al pliego y con eso destapó algo que antes no se veía:
el reparto por filas empaqueta las bandas por lo que CABE, y cuando la
siguiente no cabía **buscaba una de más adelante** (v857). Con la numeración
renumerada sobre lo empaquetado eso era invisible; con el número fijo salió
impreso como un salto hacia atrás —la lámina A en «01 02 03 04 08 07»—.

**Las dos cosas tienen que ser ciertas a la vez**, y ahora lo son: el número
sale del pliego y las bandas se imprimen ordenadas por ese número. Se cierra
la fila en la primera banda que no quepa, sin mirar hacia adelante.

Cuesta algo de papel en blanco cuando a una banda chica le sigue una grande
—es el caso que la v857 resolvió al revés— y se paga: **un número fijo no
sirve de nada si la secuencia no crece.** Un índice que retrocede se lee como
un error de armado, no como una ausencia.

Medido sobre las dos hojas: `01 02 03 04 07 08` y `05 06 09 10 11 12`.

### La guarda de última caja: la fragilidad no estaba considerada

El peldaño protege panel por panel y **no ve el tamaño de la banda**. Una
banda de dos paneles muere completa al ceder dos; una de ocho pierde uno y
sigue viva. Medido en el pliego real: cedió entera la banda «Cómo cambió el
sitio» mientras sobrevivían Verde y agua, Curvas de nivel y El sitio, que son
paneles sueltos de bandas grandes.

**El último panel en pie de una banda sube un peldaño.** Así, antes de matar
una banda entera, la hoja cede otro panel de una banda que sí puede
permitírselo. Si aun así no cierra, la banda cede y se imprime su renglón, que
es el que la v912 dejó puesto.

«En pie» se calcula sobre la lista de CANDIDATOS y no sobre la banda entera:
los paneles de peldaño 0 y los ya apagados no cuentan, porque la banda no los
puede perder por este camino.

Medido: con la guarda, la banda «Cómo cambió el sitio» **sobrevive**
—`base=1 apretada=1`— donde antes caía entera.

### Un panel que cede en una banda que sobrevive se iba en silencio

El renglón de la v912 solo dispara cuando cae la banda completa. Un panel
suelto que cede en una banda que sigue en pie no dejaba rastro: la banda queda
con sus otras cajas y lo único que lo decía era el pie, mezclado con la lista
de medidas de toda la hoja. Así desapareció «Susceptibilidad por pendiente»
sin que nadie lo notara.

Cada banda imprime ahora, debajo de su conclusión y en cuerpo pequeño, una
línea: «Cedió en esta composición: …». Un apunte y no una alarma —la banda
sigue en pie—, y se lee donde se lo busca en vez de al final de la hoja.

### El conteo de usos que cambió entre dos PDF

Reportado: 1.380 en la v911 contra 1.320 en la v912, sin explicación. Medido
sobre el diff: **la v912 no toca una sola línea de conteo** —solo comentarios,
la tabla de peldaños y el manejo de bandas—, así que la diferencia no puede
venir del cambio de versión: viene de la consulta. Dos exportaciones a 2.500 m
son dos respuestas de Overpass distintas, y a esa escala la consulta puede
salir recortada.

Lo que sí hay que decir es que el recorte YA se declara desde la v851 —el
aviso viaja pegado a la lista— así que si hubiera sido truncamiento, la hoja
lo diría. Queda como la comprobación que falta: que dos corridas del mismo
sector con el mismo radio impriman el mismo total, o que la hoja diga por qué
no. Eso pide guardar el total de la corrida anterior, que es otra tanda.

**Esa tanda fue la v915**, que guarda el total por sector en `pcr_conteos_v1`
y compara con la corrida anterior, con el umbral sacado de lo que la hoja
imprime —0,05 usos por hectárea, el redondeo de la densidad— en vez de puesto
a ojo. Este renglón se quedó declarando pendiente algo ya hecho.

## El PDF de prueba lo dice en el papel (v914)

Pedido con estas palabras, sobre los dos pliegos de muestra que la v913
publicó en `assets/pliegos/`: «Bien pensado el LEEME. Y agregale lo que el
LEEME no puede hacer: **el PDF viaja solo y el archivo de al lado no lo
sigue**. Que estos dos exports lleven una franja impresa en la propia lámina,
arriba y visible.»

Es la regla de toda esta hoja —lo que no se puede leer del papel no está
dicho— aplicada al ARCHIVO en vez de a una cifra. Un LEEME al lado de un PDF
no lo acompaña cuando alguien lo reenvía por correo o por WhatsApp; y un
pliego de 60 × 90 lleno de cifras de Cúcuta, sin nada que lo desmienta, se
lee como el análisis de un predio.

La franja va arriba del todo y en cuerpo de 5,2 mm, que es la franja de los
tres metros de la v885: quien mire la lámina de lejos tiene que saber, antes
que nada, que no es un análisis. No comparte el rojo de las alarmas de la
hoja —una contradicción y «esto no es real» no son la misma cosa— ni el ámbar
de los vacíos.

### Solo con la opción puesta, y NUNCA deducida

`o.pruebaDeFixture`, y no hay ninguna señal del entorno que la encienda sola.
La tentación era deducirla —del origen `localhost`, del nombre del sector, de
que haya un doble del DANE contestando— y todas tienen el mismo defecto: el
día que acierten de más, **marcan como prueba el análisis de un predio de
verdad**. Esa es la mentira contraria y es peor: un pliego real desmentido por
su propia cabecera no se puede defender ante nadie, mientras que un pliego de
prueba sin franja solo vuelve al estado de la v913.

Por eso tampoco se le abre una costura al botón de exportar. El botón compone
con las opciones de la aplicación y ahí no hay dónde meterla; la sonda hace lo
que hace `bajarPliegoPDF` —compone la lámina y se la pasa al armador de PDF—
con la opción puesta a propósito por quien exporta. Es la misma decisión de la
v869 con `corteMsMax`: un parámetro de verdad, no una puerta trasera de
pruebas.

### Las dos ramas, y la guarda vale más que la afirmación

`tdoslaminas` mide las dos en la misma corrida: el pliego normal con **cero**
franjas y el export marcado con **dos**, una por hoja. La primera es la que
hay que proteger — es la que se rompe sin que nadie se entere si algún día la
franja pasa a deducirse.

Demostrada contra la v913: «0 franjas de 2 hojas» y «sin texto». La guarda no
falla, que es a propósito, como las de la v879, la v882 y la v890.

### Y se miró el papel

Las dos páginas de cada PDF, recortando la franja superior de la imagen
rasterizada: la banda sale entera y legible encima de la cabecera en las
cuatro. Medir el HTML habría dicho que la etiqueta está; lo que hacía falta
saber es que **se lee**, y eso solo lo dice el papel — que es el método que
encontró los defectos de la v874, la v882, la v885 y la v887.

### Dos voseos que la guarda no podía ver, y el renglón que cuesta

Al abrir `js/68` aparecieron dos, los dos en texto que ve el usuario y los dos
**mezclados con usted en la MISMA frase**: «Pruebe desde la ficha del sector,
o imprimí desde un computador» y «La prueba tardó demasiado. Imprimí y mire el
papel». Así es como se ven cuando alguien corrige medio aviso.

`imprimí` termina en -í, y ahí no hay regla: la v880 dejó escrito que con -é y
con -í el voseo es indistinguible del pretérito de primera persona —«asistí a
uno» es correcto— y que esas van una por una en la lista. Se corrigieron y se
agregó el renglón, que es el contrato: la mitad estructural de esa guarda caza
sola, la mitad de vocabulario cuesta una línea cada vez que aparece una forma
nueva.

## Una cuenta por magnitud, y una sola puerta de apagado (v915)

Las tres cosas que quedaron de la v913, en el orden pedido. Dos salieron
distintas de como estaban planteadas, y las dos por lo mismo: **la premisa se
midió antes de tocar nada** (v863).

### El total de usos, contra la corrida anterior del mismo sector

Reportado con dos PDF del mismo sector y el mismo radio: 1.380 usos en uno y
1.320 en el otro, sin una palabra. Medido sobre el diff, la v912 no toca una
línea de conteo: la diferencia es de la FUENTE. Pero eso el lector no tiene
cómo saberlo, y dos cifras distintas bajo el mismo rótulo se leen como un
error de la herramienta — la v879 entre dos corridas en vez de entre dos
hojas.

Se guarda el total por sector en `pcr_conteos_v1`, **aparte de las fichas** y
por la razón de la v871: son cuatro números y una ficha es el trabajo de una
tarde; juntos, el recorte por cupo se llevaría uno para hacerle sitio al otro.
La llave del sector es el centro a cinco decimales —un metro— más el radio, o
el área a la hectárea para un polígono: con más precisión, mover el mapa un
píxel fabricaría un sector nuevo y la comparación no se haría nunca.

Y se le PEGA al resultado, no se lee después desde el panel: es la regla de la
v890 con el área y la de la v902 con la referencia municipal. Una ficha
archivada se vuelve a componer con este código, y leer el almacén desde la
caja imprimiría la comparación de hoy sobre un análisis de hace un mes.

#### El umbral no se inventa: sale de lo que la hoja imprime

«Con un umbral», decía el pedido. Poner «avisa si cambia más del 5 %» sería
repetir el error del techo de Overpass de la v869 — un número a ojo que
después nadie puede defender.

Lo que la hoja imprime del total es la DENSIDAD, en usos por hectárea y con un
decimal. Así que una diferencia importa exactamente cuando alcanza a mover esa
cifra: 0,05 usos por hectárea para cruzar el redondeo, o sea **0,05 × las
hectáreas del sector**. En el de prueba —177 ha— son 9 usos; en la corrida de
19,6 km², 98. Por debajo de eso la diferencia no cambia una sola cifra
impresa, y anunciarla sería ruido que enseña a ignorar el aviso.

#### `tconteo.js` · el mismo sector dos veces, que no lo tenía nadie

Suite propia, y la razón es el material: hace falta correr EL MISMO sector dos
veces con totales distintos. `tdoslaminas` vuelve a analizar, sí, pero con
otro radio —que es otro sector para esta comparación, y con razón—. Sin las
dos corridas la comprobación habría pasado por no tener nada que rechazar; es
la decimoctava vez.

Y **el caché de Overpass la dejó sin material al primer intento**: dura 24 h a
propósito (v851), así que las tres corridas leían la misma respuesta guardada
y el total no se movía — medido, 116 · 116 · 116. Se limpia entre corridas,
que es exactamente lo que le pasa a quien vuelve al día siguiente o desde otro
teléfono, o sea el caso que el reporte describe.

Las tres ramas: sin corrida anterior la hoja **no** inventa un aviso; con 24
usos de diferencia lo dice con las dos cifras y la procedencia; con uno se
calla. La tercera es la que de verdad guarda — sin ella el arreglo podría
haber sido avisar de toda diferencia, y el aviso saldría en cada corrida por
un uso de más.

### §10 · no había nada que unificar, y eso también se mide

El pliego v2 reportó «3.760 contra 3.673 edificios» y lo atribuyó a dos
consultas distintas; la v912 lo corrigió a «dos conteos dentro de la MISMA
consulta de trazado» y lo dejó como tarea de motor.

**Las dos premisas eran falsas**, y la segunda la escribí yo. Llamando al
motor con material que puede distinguirlas —cuarenta edificios con huella y
tres mapeados solo como punto— salen `llenos.edificios = 43` y
`alturas.edificios = 43`: son **la misma variable**. Y del lado del cliente,
la v906 ya había unificado la elección entre la consulta de usos y la del
trazado en `conteoDeEdificios`, que llaman los diez sitios que imprimen la
cifra.

Así que no se unificó nada. **Inventar un cambio para cerrar la tarea es lo
que este proyecto lleva cinco tandas deshaciendo** — la mudanza de la v882, la
bisección de la v886, la fila de texto de la v901.

Lo que sí faltaba es la guarda: que hoy salgan iguales es un hecho de cómo
está escrito el motor, no algo que nada impida cambiar. `ttrazado` lo
comprueba **con su propia guarda de material**: las tres cifras del fixture
—43 edificios, 40 con forma, 3 solo punto— son distintas entre sí, así que la
igualdad de las dos primeras no pasa por coincidencia de un sector donde todo
vale lo mismo.

### Una sola puerta de apagado, y el peldaño detrás de ella

«Había dos caminos de apagado y solo uno obedecía. Queda como regla: un panel
se apaga por un solo camino, y ese camino lee el peldaño.»

La v912 arregló el caso —le puso la comprobación del peldaño al lado de la
lista corta de §21— y dejó el defecto: **dos listas para un solo hecho**,
esperando a la tanda siguiente. Y no eran dos sino TRES, porque
`PLIEGO_INTOCABLES` era otra lista derivada del peldaño 0 que el filtro de
cajas leía por su cuenta.

Ahora hay una función, `puedeCeder(id, yaApagados)`, y las tres decisiones la
llaman: los candidatos de caja, los de mapa y el apagado por tamaño de §21.
Las dos listas derivadas se retiraron — ninguna decía nada que el peldaño no
dijera, y una lista que repite un hecho es la forma de la v885 con las
funciones declaradas dos veces.

**Lo que una PERSONA apaga no pasa por la puerta**, y es a propósito: quien
arma la lámina puede apagar lo que quiera, incluida la síntesis. El peldaño
ordena lo que el programa cede cuando no le cabe; no le dice a nadie qué puede
mirar. Es la distinción que la v911 hizo entre `pliegoCedidas` y `pliegoOff`.

#### La guarda tiene dos mitades porque una sola falla abierto

* **En `revisar.js`**, sobre el código: el peldaño se lee **solo** desde la
  puerta y desde el orden, y cada sitio permitido dice para qué —es la forma
  de la guarda del voseo en -á (v880): se lista lo permitido y se denuncia
  todo lo demás—. Demostrada escribiendo un cuarto camino que filtra por su
  cuenta: sale con archivo y línea, y con qué hacer.
* **En `tdoslaminas`**, sobre el papel: ningún panel del peldaño 0 puede
  faltar de una hoja compuesta. Esa es la que cierra el caso que la primera
  no ve —un camino nuevo que **no mire el peldaño en absoluto**—, porque su
  huella queda en la hoja aunque no lea nada.

Y la guarda de la guarda: si `puedeCeder` dejara de leer el peldaño, la
primera seguiría en verde sin vigilar nada. Hay una comprobación aparte que
exige que lo siga leyendo — el patrón de la v878 con su propia lista y el de
la v868 con las listas vivas.

#### Medido: el cambio es neutro

Las cuatro suites del pliego pasan sin tocar una aserción, que es lo que tenía
que pasar: las tres listas coincidían, así que retirarlas no cambia una sola
composición. Lo que cambia es que ya no pueden separarse.

### Y una de numeración

El usuario llamó «v914» a esta tanda, pero la v914 se la llevó la franja de
los PDF de prueba, que se publicó primero. Esto es la **v915**. Se sube por
encima, nunca bajando la propia — la regla del 7 de septiembre.

## Dos premisas medidas, y la pirámide guardada (v916)

Con las trece secciones del pliego v2 cerradas, quedaban cuatro cosas que la
v903 dejó escritas como «no se pudieron perseguir desde acá». Dos de ellas
—§10(b) y §10(e)— se auditaron de frente, y **las dos vuelven con la premisa
no confirmada**. Queda escrito lo que se midió, que es más útil que un arreglo
a ojo.

Es la regla que el usuario fijó en esta tanda: *«cuando yo te dé una premisa
técnica sobre el código, medila antes de actuar. Yo veo el papel, vos ves el
repositorio; mi diagnóstico del síntoma suele servir y mi diagnóstico de la
causa no siempre.»*

### §10(e) · la pendiente media no tiene dos rutas de redondeo

«6,3 % en el encabezado, 6,2 % bajo el corte topográfico. Una sola cifra.»

Buscados los sitios que la imprimen: el resumen de cabecera, la caja del
terreno, la conclusión de banda ambiental y la FODA leen **todos**
`terreno.pendiente.media`, y los cuatro la formatean con la misma línea
—`String(x).replace('.', ',')`—. El motor la publica ya redondeada a un
decimal (`Math.round(pendMedia * 10) / 10`), y su `lectura` **no lleva
número**: es una frase de grado.

La única segunda ruta candidata está en `js/64`, que arma su propia `lectura`
con `toLocaleString('es-CO', { maximumFractionDigits: 1 })` sobre el valor
crudo, mientras devuelve `pendientePct` con `Math.round(x * 10) / 10`. Parecía
el defecto: dos redondeos distintos sobre una cantidad. **Medido, no lo es**:
sobre diez valores de media tabla —6,35 · 2,45 · 8,15 · 11,45…— las dos rutas
coinciden en valor. La única diferencia que aparece es de escritura —«10»
contra «10,0»— y no es la reportada.

Así que no se tocó nada. Y hay que decir lo que esto NO descarta: el sector de
prueba no imprime la cifra —su terreno no está medido en la corrida guardada—
así que **desde acá no se puede reproducir el papel del reporte**. Si vuelve a
salir, lo que hay que mirar es de dónde sale el 6,2: no de un redondeo, porque
los cuatro sitios leen el mismo campo ya redondeado.

### §10(b) · los tramos de edad no comparten un sumando

«30–44 y 45–64 traen el mismo valor exacto, 15.787 · 22 %. Revisar el mapeo de
campos de edad del censo.»

Revisado, y el mapeo está bien: los cinco tramos **parten** los veintiún
campos del censo —`30_34, 35_39, 40_44` contra `45_49, 50_54, 55_59, 60_64`—,
cada campo en exactamente un tramo y ninguno suelto. Comprobado contando:
21 campos, 5 tramos, 21 repartidos, cero repetidos. Dos tramos no pueden
compartir un sumando, así que la coincidencia de la corrida real no sale de
ahí.

Lo que sí faltaba es la guarda, y es la parte que vale. **La propiedad que
hace imposible el defecto no estaba escrita en ninguna parte**: es una
coincidencia entre dos listas que alguien rompe editando una sola. `revisar.js`
la persigue en las dos direcciones:

* un campo **repetido** da exactamente el síntoma del reporte —dos tramos con
  cifra idéntica—;
* un campo **suelto** pierde población de la pirámide sin que nada lo diga,
  que es peor porque no se ve.

Demostrada contra las dos: metiendo `40_44` también en el tramo de 45–64 sale
«en dos tramos: 40_44 — dos tramos con la misma cifra», y quitándolo del suyo
sale «sin tramo: 40_44».

### Las dos que siguen sin poderse perseguir

* **§10(c)** quedó resuelta en la v915 y por la vía contraria: no había dos
  cuentas.
* **§10(d)** —2014 y 2017 idénticos en la serie satelital— pide la serie real,
  que esta batería no descarga.

## La tira de estampas, medida, y lo que el apretón le hace (v917)

Llegó midiendo el PDF de la v914, y con una corrección que ordena todo lo
anterior: **la BANDA «Cómo cambió el sitio» y el PANEL de las cinco estampas
son dos cosas distintas, y se venían mezclando.** La banda compone y sobrevive
—en la composición de pie tiene título, pregunta y sus tres medidas: huella
construida, población del municipio y obra pública contratada—. Lo que no
salía es la tira de fotos.

La pregunta era cuál de tres: si el panel cede, si no llegan las imágenes, o
si no está cableado a la banda. Se midió, y la respuesta son dos hechos
distintos.

### El fixture no podía contestar, y por eso la pregunta llevaba tres tandas

`evolucionImpresa` dibuja la tira con `pasos.filter(p => p.ok && p.imagen)`. El
`EVO_SERIE` de `tdoslaminas` —que la v911 completó con `pasos` para que el
inventario la diera por lista— traía `ok` y `medida` y **ninguna imagen**, así
que el filtro devolvía vacío y salían la tabla y las frases sin una sola foto.
Medido sobre las cuatro hojas guardadas: la caja presente en las cuatro, con
**cero `<img>`**.

Es la vigesimosegunda vez que el material no puede producir lo que la
comprobación dice medir, y acá costaba el doble: la pregunta sobre la mesa era
justamente si el panel está cableado, y con ese fixture no se podía contestar
ni que sí ni que no.

Con las estampas puestas —un PNG liso por paso, como el que `E.rutaWayback`
sirve desde la v907— la tira sale: **5 figuras, 5 imágenes, cada una con su
año**. El panel está cableado y la duda queda cerrada por medición.

### Y lo segundo, que es lo que el reporte necesitaba

Con las cinco estampas la caja **pesa**, y en el documento apretado la
bisección la cede — declarada en `pliegoFuera`, como corresponde. Eso no es una
regresión: es la máquina funcionando, y es la explicación del papel real.

En el export de la v912 la banda entera salió con el renglón de «banda
completa fuera», así que la tira no podía estar. La guarda de última caja de la
v913 impide que la banda muera entera; **pero la caja de las estampas puede
seguir cediendo sola**, y con imágenes de verdad pesa lo suficiente para que
sea el caso probable a esa escala.

Queda medido en las dos direcciones, que es lo que faltaba:

* en la hoja SUELTA la caja se compone con su tira;
* en el documento apretado cede, **y queda declarada**.

### Dos cosas mías, las dos por medir mal

* **El cortador de caja anclaba en el título pelado.** `indexOf('Cómo cambió
  el sitio')` encuentra el nombre antes en el pie de método, en la línea de lo
  que cedió y en el inventario de la banda, así que el trozo que cortaba no
  era la caja y la tira salía vacía con las imágenes puestas. Es la lección de
  la v854 —buscar DENTRO de la caja, con el ancla en el `<h2>`— y la volví a
  cometer. Se vio instrumentando, no leyendo: la caja estaba en el documento y
  mi lector no la encontraba.
* **Una aserción que se puso roja por material más rico.** «Y sigue
  componiéndose» miraba el documento apretado; con estampas la caja cede ahí
  con todo derecho. Se apunta a la hoja suelta, que es donde vive su
  afirmación, **y se agrega la medición del apretón**, que es información
  nueva. Más precisa, no más laxa.

### Lo que sigue sin poderse medir desde acá

Si en una corrida REAL —sector de verdad y serie satelital descargada— las
imágenes llegan. El proxy de esta máquina bloquea la descarga, igual que
Overpass y `ags.esri.co`. Lo que sí queda cerrado es que, si llegan, el panel
las dibuja; y que si no aparecen en el papel con datos buenos, la causa a
mirar es la cesión y no el cableado.

## La tira sube de peldaño, y se degrada antes de ceder (v918)

Dos cosas pedidas sobre lo que la v917 midió, y la primera trae un canje que
hay que dejar escrito porque no es gratis.

### El peldaño ordena por lo que cuesta recuperar, no por lo que ocupa

«La caja de estampas está donde está por peso, no por valor. De todo lo que la
lámina imprime, esa tira es de lo menos reconstruible: una cobertura se
recalcula en segundos, una década de imágenes satelitales hay que
descargarla.»

`como-cambio-el-sitio` pasa del peldaño 2 al 3. `presion-de-crecimiento` se
queda en el 2: son tres cifras del mismo análisis, y se vuelven a tener
corriendo la hoja otra vez.

**El canje, medido en el sector de 2.500 m con letra normal:**

| | Ceden | La tira |
|---|---|---|
| peldaño 2 | 11 paneles | **cede** |
| peldaño 3 | 13 paneles | se queda |

Los dos que entran en su lugar son **«El grano: manzana y predio»** y
**«Continuidad del tejido»** —los dos paneles de morfología de la v859— más el
mapa de ruido. No es gratis y no se presenta como si lo fuera: se cambian dos
mediciones del tejido por una serie de fotos que no se puede reconstruir. La
decisión es de quien tiene el pliego en la mano y está tomada; lo que queda
acá es el precio, para que la tanda que quiera revisarla no lo mida otra vez.

### Tres estampas antes que ninguna

«Tres fotos siguen diciendo la dirección del cambio; ninguna no dice nada.»

`estampasMax` recorta la tira a la **primera, la del medio y la última**, y la
composición lo intenta antes de dar la caja por perdida. Se quedan los
EXTREMOS y no las tres primeras: el cambio se lee entre la más vieja y la más
nueva, y una serie cortada por el final diría que el sector dejó de cambiar en
2020.

Y se dice en el papel, que es la mitad que lo separa de un recorte silencioso:

> Se muestran **3 de 5 estampas** por espacio: la primera, la del medio y la
> última. Las 5 están en la hoja suelta y en el informe. El verde año por año,
> acá al lado, sí sale entero: lo que se recortó son las fotos, no las cifras.

Es la decisión de la v901 con las once casillas —apretadas antes que
perdidas— y la de la v881 con los anillos: un problema de espacio no se
arregla con un silencio.

**Solo se acepta si la caja SE QUEDA.** Degradarla y perderla igual sería
pagar el recorte por nada. Y es un intento, no una escalera de topes: cada
intento es una composición entera, y eso en un teléfono se paga en segundos.

### Lo que NO se pudo ejercitar, y hay que decirlo

**El escalón del degradado no llega a dispararse con provecho en este
sector.** Medido en las tres letras:

* letra normal → la caja se queda entera con sus cinco estampas: no hace falta;
* «Equilibrio» → ceden **51** paneles y la caja entre ellos. El degradado SÍ se
  intenta —se comprobó que la caja está en la lista— y no la rescata;
* «Se lee de pie» → ceden **60**. Lo mismo.

O sea que a esta escala el comportamiento es binario: o cabe entera, o la hoja
está tan apretada que dos fotos de menos no cambian nada. El caso que el
pedido imagina —la caja que no cabe *por poco*— no se produce acá.

Así que lo que queda demostrado es la mitad que sí se puede: **cómo se
dibuja**. Con `estampasMax: 3` salen tres figuras, los años 2014 · 2020 · 2026,
el aviso impreso, y las cinco cifras del verde intactas. El escalón de la
escalera queda escrito y sin ejercitar sobre el camino real, y eso es lo que
hay que saber de él: no es código muerto —se llama— pero su rama útil no la
produce ningún material de la batería.

Fabricar una composición que quede corta *por poco* para ejercitarlo es lo que
la v910 declinó como «otra tanda», y por la misma razón: pedir una lámina que
no cierra es un material que hay que diseñar, no ajustar.

## «El grano» también se queda, y no cuesta un panel más (v919)

La v918 midió el precio de salvar la tira de estampas y lo dejó escrito: dos
paneles de morfología —«El grano: manzana y predio» y «Continuidad del
tejido»— más el mapa de ruido. Con ese número en la mano, la decisión de qué
vale más se revisó, y la revisión fue del lector, no mía:

> «El grano» se queda. La manzana de 73 m decide si una propuesta puede abrir
> un paso nuevo o tiene que entrar por donde ya se entra, y los tres cuadrados
> a la misma escala son de lo poco que enseña a leer una escala sin escribir
> una palabra falsa. «Continuidad del tejido» y el mapa de ruido pueden ceder:
> el primero ya vive en el chequeo cruzado de la banda de coherencia, y el
> segundo es un modelo estimado, no una medición.

### Y medido, salió mejor de lo que el precio anunciaba

`el-grano-manzana-y-predio` sube al peldaño 3. A radio 2.500 con letra normal:

| | Ceden | Tira | El grano |
|---|---|---|---|
| v917 · tira en el 2 | 11 | cede | se queda |
| v918 · tira en el 3 | 13 | se queda | **cede** |
| v919 · los dos en el 3 | **12** | se queda | se queda |

**Ceden MENOS paneles que en la v918, no más.** Y no entra ninguno nuevo: la
lista de doce es la de trece sin El grano.

La explicación es del mecanismo y conviene tenerla escrita, porque cambia cómo
se lee un precio medido: **la bisección cede un PREFIJO de la lista ordenada**,
así que un panel puede irse por venir temprano en el orden y no porque la hoja
necesite su espacio. En la v918 El grano estaba noveno; moviéndolo al final,
la hoja cierra sin él y sin nada en su lugar.

O sea que el precio real de salvar la tira, contra la corrida de la v917, son
**dos paneles y no tres**: «Continuidad del tejido» y el mapa de ruido —
exactamente los dos que se aceptaron. El tercero era un efecto del orden.

**Un panel en la lista de lo que cedió no siempre pagó por lo que se salvó.**
Para saber cuánto cuesta de verdad una decisión de peldaño hay que medir las
dos composiciones y comparar, que es lo que la v918 hizo bien y lo que su
lectura del resultado se apresuró a interpretar.

### La aserción nombra el precio, no solo el resultado

Dos, y la segunda es la que guarda: que los dos se queden, **y que lo que cede
a cambio sean los dos que se aceptaron**. Sin la segunda, la primera se
cumpliría igual el día que ceda media hoja.

## La tercera lista deja de estar razonada y pasa a estar medida (v920)

La v911 arregló tres listas de la misma forma —**un dato de alcance de
DOCUMENTO leído de una variable de alcance de HOJA**— y de las tres, dos
quedaron con su prueba y una sin ella. Aquella sección lo dice con todas las
letras y con la razón:

> **Y hay que decir que esto está RAZONADO y no medido.** […] Para
> ejercitarlo hay que correr la serie de fotos de verdad en la suite y
> después apretar la hoja: son diez descargas y otras tantas pasadas del
> clasificador, y es otra tanda.

Esa tanda es esta, y salió mucho más barata de lo previsto: **no hacía falta
descargar nada**. La v917 puso las estampas en el fixture como `data:` en
línea —un PNG liso por paso, que es lo que `evolucionImpresa` necesita para
dibujar la tira— y la v918 midió que con esa tira la caja **pesa**. Con las
dos cosas puestas, el material que faltaba ya existía sin que nadie lo
notara.

**Una deuda de prueba puede quedar saldada por una tanda posterior que venía
a otra cosa.** Vale revisarlas cuando el material cambia, en vez de dar por
buena la estimación con que se aplazaron.

### Qué se mide, y por qué en la letra de colgar

`pliegoOff` viaja en las opciones y llega a las dos hojas, así que apagar un
panel a mano —que es como la v910 lo probó— **no ejercita el mecanismo**: la
B se entera por su cuenta. Lo que hay que producir es que la **bisección de
la A** lo ceda, porque esa lista muere en la composición de la A.

Con letra normal la caja se queda (v919), así que la corrida que sirve es la
de «Se lee de pie», donde ceden 60 paneles y la caja está entre ellos.
Medido sobre el documento de las dos hojas:

| | Con la lista | Sin ella |
|---|---|---|
| la casilla de la B | SIN MEDIR, nombra el panel y da el remedio | **sigue diciendo «medido de 2014 a 2026»** |
| la bibliografía | «Esri World Imagery.» | **sigue citando Planetary Computer** |

O sea: es exactamente el defecto de §1 de la v910, vivo por la otra puerta,
tal como aquella sección lo predijo. **El razonamiento era correcto y ahora
además está demostrado**, que no es lo mismo.

### La guarda de material va PRIMERO, y sobre la precondición

Las tres aserciones de arriba pasarían en verde el día que la caja deje de
ceder en esa composición —por un peldaño nuevo, por un fixture más rico, por
cualquier cosa— y nadie se enteraría: no tendrían nada que rechazar. Es el
agujero que este proyecto lleva dieciocho tandas persiguiendo.

Así que la primera aserción del bloque no mide el resultado sino **la
precondición**: que con la letra de colgar la caja de verdad ceda en la
lámina A. Si eso deja de ser cierto se pone roja ella, y las tres de abajo
ni siquiera se corren. Es la regla de la v911 —toda aserción de cesión
necesita su base sin apretar— dicha sobre lo que la hace posible en vez de
sobre lo que produce.

Y al lado, la guarda contra pasarse de marcar, como las de la v879, la v882
y la v890: con la caja PUESTA —letra normal— la B no puede declararla cedida
ni encoger su bibliografía. Esa no falla contra la v919 y no es una
afirmación nueva.

### Demostrado contra la v919

Neutralizando el paso de la lista —`pliegoCedidasOtraHoja: []` en
`laminaDoble`— salen tres en rojo con el texto viejo impreso: la casilla sin
marcar, «medido de 2014 a 2026» citando una banda que no está en el papel, y
«Planetary Computer» al pie de una hoja cuya serie temporal cedió. La guarda
de material y la de no pasarse siguen en verde, que es lo que tenían que
hacer.

## Dos estampas que leen igual pueden ser la misma foto (v921)

Aplicada la práctica que la v920 dejó fijada —**revisar las deudas aplazadas
cuando cambia el material, no dar por buena la estimación con que se
aplazaron**— la primera que se cae es §10(d) del pliego v2:

> d · 2014 y 2017 idénticos — pide la serie satelital real, que esta batería
> no descarga.

**La batería sí la descarga desde la v907**, contra el doble de
`E.rutaWayback`. Lo que faltaba no era la serie: era que el doble pudiera
cambiar.

### El doble servía UNA tesela para las cinco entregas

`rutaWayback` contestaba `pngLiso(256, 60, 110, 70)` a toda petición, así que
2014, 2017, 2020, 2023 y 2026 daban **la misma cifra** — y la comprobación de
la v907 mira el TRAMO (`n`, `desde`, `hasta`), donde eso no se ve. Es la
decimonovena vez que el material no puede producir lo que la comprobación
dice medir, y la primera en que el fixture producía **exactamente el defecto
del reporte** sin que nadie lo notara.

Ahora la proporción de suelo duro sube con la entrega —44 · 44 · 48 · 51 · 54—
y **2014 y 2017 sirven la misma tesela a propósito**, que es lo que Esri hace
de verdad. Con eso una sola corrida ejercita las dos ramas: cuatro años que
cambian y un par que no.

De paso, el escritor de PNG salió de dentro de `pngLiso` a `pngPorFilas`, con
el color de cada fila decidido afuera: la serie necesita una tesela de dos
clases mezcladas, y una segunda copia del escritor habría divergido a la
tanda siguiente (v879). Y las medidas por año entran en `estado()`, que es la
regla de la v871 — lo que una prueba necesita leer se agrega ahí.

### La cifra era correcta y la conclusión del lector, falsa

Con el material puesto, la hoja imprime:

```
2014   2014-12-30 · 59,8% verde
2017   2017-11-16 · 59,8% verde
```

Dos fechas distintas, cifra idéntica, presentadas como dos mediciones. La
caja ya advertía que «una diferencia menor de 3 puntos cabe en el error»:
eso cubre el RUIDO y no cubre esto.

Porque no es un error de cuenta. **Esri publica ENTREGAS, y una entrega sobre
la que no volvió a volar sirve la imagen anterior.** El par no mide tres años
de cambio: mide una foto contada dos veces. Es la clase de la v875 y la v899
en la serie temporal — **cero cambio medido y ninguna foto nueva son cosas
distintas**, y la cifra no las separa.

Lo que sí las separa está impreso al lado —las dos fotos—, así que la hoja
**nombra el par y manda a mirarlas** en vez de elegir por el lector. No dice
«es la misma imagen», que no lo puede probar; dice qué es lo corriente, cuál
es la otra posibilidad y cómo se distinguen.

Tres decisiones, y las tres cambian lo que el lector hace:

* **Se comparan las CUATRO clases**, no solo el verde. Que dos fotos
  distintas coincidan en una es corriente; que coincidan en las cuatro hasta
  la décima, no.
* **La marca va en la FILA**, donde el lector compara, además de en la nota.
  Sin eso las dos cifras iguales se leen como dos mediciones que coincidieron.
* **Se acota el alcance**: la tendencia va del primer año al último y no se
  apoya en el par. Comprobado leyendo `tendenciaDe` —`buenos[0]` y
  `buenos[buenos.length - 1]`— y no recordándolo, que es la regla de la v863
  aplicada a una frase que se iba a imprimir.

### Dónde viven las comprobaciones

En `tmedir`, que es la única suite de la batería que corre la cadena de fotos
de verdad. Y con su guarda de material **primero**, como la v920: si el doble
volviera a servir una tesela constante, las tres de abajo pasarían por no
tener nada que rechazar.

La última —que marque **exactamente una vez**— no es una guarda pura y se
nombra por lo que mide: contra la v920 falla por el cero. Llamarla guarda
habría sido presentar una afirmación como una protección.

### Demostrado contra la v920

Cuatro en rojo con el texto viejo impreso: «no lo dice» por la fila, «lo
calla» por la nota, «no acota el alcance» y «0 marcas para 1 par».

Y la demostración se hace **revirtiendo solo el hunk de la caja**: el fixture
nuevo y lo que `estado()` expone se quedan, porque son lo que la suite
necesita para LEER. Es la lección de la v875 sobre el `git stash` completo,
aplicada por el otro lado — acá lo viejo es el código y lo nuevo es el
material.

## Una declaración sin hogar la arrastra su casilla (v924)

Dos puntos medidos del PDF de la v921, y **los dos cambiaron de diagnóstico al
medirlos**. Es la regla que el usuario fijó en la v916 cobrándose dos veces en
la misma tanda: el síntoma reportado era real, la causa supuesta no.

### §1 · la guarda no falló, y marcarla habría sido la v861

Reportado: la banda 04 de la A imprime «Cedió en esta composición: Presión de
crecimiento» y la casilla de la B sigue imprimiendo su cifra. Parecía el
defecto de la v910 vivo en un caso concreto.

Medido, la casilla declara `['Cómo cambió el sitio']` y **no se declara a sí
misma**. Y esa declaración es la CORRECTA: la casilla no cita el panel,
**recalcula** —sale de `presionDeCrecimiento`, la misma función— y su dato es
la serie satelital, que está impresa en la lámina A. La cifra es comprobable
en el papel.

Así que agregarle la autodeclaración la mandaría a **SIN MEDIR sobre una cifra
medida cuya fuente sí está en la hoja**, que es exactamente la v861: declarar
ausente algo medido es peor que un dato de menos. Se retiró el punto.

### Lo que sí se perdía, y es otra clase

Reproducido el estado —panel fuera, serie dentro— y leídas las dos hojas:

| | ¿sobrevive? |
|---|---|
| «Es un proxy de cuánto se construyó, no una medida de la presión» | **sí**, la casilla la lleva |
| «Ninguna mide la presión directamente… son proxies, y cada uno dice de qué» | **no** |
| La población es del **municipio entero** (el pliego la pide por comuna) | **no** |
| Falta la obra pública contratada | **no** |

No es una cita huérfana: es **un panel que era el único hogar de tres
declaraciones**. Cuando cede, se van del pliego entero y nada las nombra.

`F` recibe un quinto campo, `hu`, y al componer la casilla **arrastra** ese
texto cuando su panel cede. Va antes del corte de `p` y no toca el estado: una
casilla sin dependencias puede tener huérfanas igual, y arrastrarlas no la
convierte en SIN MEDIR.

**`p` y `hu` son dos cosas distintas y por eso son dos campos.** `p` dice «mi
cifra se queda sin con qué comprobarse» y da vuelta la casilla; `hu` dice «lo
que este panel declaraba no está en ninguna otra parte» y solo agrega texto.
Juntarlos habría sido justo el error que este punto vino a no cometer.

Medido: **no cuesta un panel** —ceden 12 antes y 12 después—, que es lo que
hace que la decisión sea barata. Es texto.

### §2 · los dos mapas ya estaban en el peldaño 3

Reportado: la banda 05 abre la lámina B preguntando «¿cómo se llega, por dónde
se entra y qué se alcanza a pie?», perdió los dos mapas que responden esa
pregunta y conservó la caja de texto. Pedido: subirlos al peldaño 3.

**Ya estaban.** La tabla tiene `'llega': 3, 'caminar': 3` para los MAPAS, y
`'como-se-llega': 2, 'a-distancia-de-caminar': 2` para las CAJAS del mismo
nombre. Lo que cede primero es la caja, y **el pie la nombra con un título que
también es el de un mapa** — de ahí la lectura de que habían cedido los mapas.

Medido en las tres letras del sector de prueba:

| | ceden | mapa `llega` | caja «Cómo se llega» | mapas en la banda |
|---|---|---|---|---|
| normal | 12 | — | — | **4** |
| media | 51 | — | **cede** | **4** |
| grande | 60 | **cede** | cede | **0** |

A `media` la banda **conserva sus cuatro mapas**: lo que se fue son las dos
cajas. A `grande` ceden los mapas también, pero ahí ya cedieron sesenta
paneles y el 3 es el techo — no hay peldaño por encima con el que protegerlos.

#### La tabla se contradecía a sí misma, y eran tres pares

La propia v911 escribió la regla: **«cajas y mapas llevan el mismo número,
porque un mapa y su caja de conteo son el mismo panel para quien lee la
hoja.»** Medidos los trece pares que comparten nombre, **diez están alineados
y tres no**:

```
Cómo se llega            mapa 'llega'=3    caja 'como-se-llega'=2
A distancia de caminar   mapa 'caminar'=3  caja 'a-distancia-de-caminar'=2
Verde y agua             mapa 'agua'=2     caja 'verde-y-agua'=3
```

El tercero es **deliberado** y está escrito: la lista dictada decía «Verde y
agua (el mapa; la caja de conteo se queda)». Los otros dos no los separó
nadie: son un descuido de la tabla.

#### Y alinearlos cuesta tres paneles sin salvar ninguno

Aquí la regla de la v919 —medir las dos composiciones y comparar, no leer la
lista— devolvió lo contrario de lo esperado. Subiendo las dos cajas al 3:

```
ENTRAN a ceder:  servicios-publicos · riesgo-oficial · como-se-mueve-el-sector
SALEN:           (ninguno)
```

A `media` pasa de 51 a 54 y **las cajas ceden igual**. El cambio se lleva dos
vacíos obligatorios y el texto principal de la propia banda 05, y no protege
lo que venía a proteger.

**Se deshizo.** Es la decisión de la v882 con la mudanza y la de la v886 con la
bisección: un arreglo estructural que no produce lo que promete es un arreglo
sin causa. Queda el desalineamiento medido y escrito, con su precio, para que
la tanda que quiera corregirlo no empiece por averiguar lo mismo.

### Y una de numeración: la otra sesión sacó dos mientras tanto

Esta tanda se escribió como v922 y al ir a subir ya había en `main` una v922
—barrido de alertas— y una v923 —seguimiento presidencial—. Sube por encima de
las dos, nunca bajando la propia: es la **v924**, la regla del 7 de septiembre.

Y se cobró, en el mismo empujón, la otra regla de la casa: **`git merge` con
cambios sin guardar ABORTA**, y su primera línea dice `Updating beeaf36..ade17e5`
como si hubiera funcionado. El commit no ocurrió y solo se vio comprobando
`git log`, no el mensaje. El orden correcto es el escrito: guardar primero,
fusionar después.

Los nueve archivos de versión salieron en conflicto por una sola cosa —el
token— comprobado con `git diff <base> origin/main` sobre los nueve antes de
resolver, y se resolvió con `--ours`, que ya venía en 924.

### Demostrado contra la v921

Una en rojo con el estado viejo impreso —«se pierden del pliego»— revirtiendo
solo el hunk del arrastre.

Las otras dos son guardas, como las de la v879, la v882 y la v920: que la
casilla **no** se marque SIN MEDIR y siga imprimiendo su cifra, y que con el
panel PUESTO —la hoja B suelta, que no bisecta— no repita lo que él ya dice
dos palmos más arriba. La segunda es la que de verdad guarda.

## Trece títulos nombran dos cosas (v925)

Salió del papel y de una lectura equivocada antes que de un reclamo. En el
export de la v912, la lámina A imprimía:

> Banda completa fuera de esta composición. Llevaba **Cómo se llega** · Cómo
> se mueve el sector · El perfil de la calle · **A distancia de caminar** ·
> Hasta dónde se camina desde el lote.

y quien tenía el PDF en la mano leyó que la banda de movilidad había perdido
sus mapas. No: conservaba los cuatro y había perdido dos CAJAS del mismo
nombre — eso lo midió la v924 y por eso la alineación de peldaños no se
hizo. **Pero la lectura equivocada no fue un descuido del lector: la hoja no
da con qué distinguirlos.** Un estudiante que quiera recuperar lo que cedió
apagando paneles desde la ficha tampoco sabría cuál de los dos buscar.

    v924   Cedió en esta composición: Cómo se llega
    v925   Cedió en esta composición: Cómo se llega (la caja)

### Los trece se calculan, no se escriben

Son el cruce de los dos inventarios —`cajasDelPliego` y `mapasDisponibles`—,
que hoy da 56 cajas, 20 mapas y **13 títulos que llevan los dos**: «Cómo se
llega», «A distancia de caminar», «Llenos y vacíos», «Verde y agua», «Hitos y
nodos», «Alturas de lo construido», «Cobertura del suelo», «Cómo cambia al
alejarse», «Dónde está la calle comercial», «El ruido del tránsito», «La
sombra de los vecinos», «La sombra que proyecta» y «Lo intangible».

Escribir la lista sería la forma que este proyecto ya deshizo dos veces: un
par nuevo —una caja que estrene el nombre de un mapa— nacería sin marca y
nadie se enteraría. Calculada, la hereda sin que su autor se acuerde, que es
lo único que impidió que el aviso de origen de la v867 volviera a perderse.

Y la otra mitad, que es la que hace falta declarar: **un título que nombra
una sola cosa no se aclara, se ensucia.** Hay una aserción para cada
dirección; sin la segunda, el arreglo podría haber sido marcarlos todos.

#### Dice «la caja», no «la caja de conteo»

Es la única palabra que hubo que pensar. El caso que lo destapó es una caja
de conteo, pero de los trece varios no cuentan nada —«La sombra de los
vecinos» es un estudio de sombra—, y un rótulo que es falso para la mitad de
los casos es justo lo que este pliego no imprime. «La caja» es además el
vocabulario que la hoja ya usa: el renglón de banda incompleta dice desde la
v911 «Es la caja que responde la pregunta de arriba».

#### La hoja ya sabía decirlo, en otro sitio

Desde la v879 un mapa que se llama como una caja se titula **«X · el
mapa»** en su encabezado (`titulosDeCaja`, en la composición). O sea que la
ambigüedad estaba resuelta donde los dos paneles se ven juntos, y sin
resolver donde uno de los dos ya no está —que es justo cuando el lector no
tiene con qué comparar—.

Eso da además el contraste que la comprobación necesitaba: la suite no se
fía de la lista que el módulo calcula, la cruza contra los títulos que el
papel marca con el sufijo. Son dos preguntas distintas —el PLIEGO tiene dos
paneles con ese nombre / ESTA hoja compuso los dos— así que no son la
divergencia de la v879 y el contraste va en una sola dirección: un título
marcado en el papel que la lista no conociera sería la lista rota. En este
sector marca uno, «La sombra de los vecinos», y con uno alcanza.

### Y el tercer sitio salió midiendo, no razonando

Auditados los sitios que nombran un panel cedido, dos son los renglones de
banda y el tercero es el pie de §21. Mi primer juicio sobre el pie fue que no
hacía falta marcarlo: el párrafo se titula «Tamaños de impresión», dice
«mapas» arriba y cada entrada lleva su medida en centímetros. Al medirlo
imprime esto:

> No alcanzan el objetivo del pliego: **Cobertura del suelo** 11,2 cm de
> 12 cm · **Llenos y vacíos** 11,2 cm de 12 cm.

Dos de los trece, pelados, en una lista que el lector recorre sin volver a
leer la cabecera del párrafo. Se marcan, con «(el mapa)», que es el lado que
el pie nombra. **El razonamiento sonaba bien y la medición lo desmintió**, y
es la misma regla que el usuario fijó en la v916 dicha para mis propios
juicios: medir antes de actuar, también cuando el que razona soy yo.

Lo que NO nombra títulos es el renglón de los mapas apagados por tamaño —solo
los cuenta— y por eso no se tocó.

### Lo que NO cambia, y por qué

* **El renglón de banda incompleta** (`b-falta`, v911) nombra la caja
  principal y sigue con «Es la caja que responde la pregunta de arriba»: la
  prosa ya dice cuál es. Marcarla daría «Llenos y vacíos (la caja) (cuánto
  del sector está construido y cuánto libre)», dos paréntesis seguidos para
  decir dos veces lo mismo.
* **El pie de la FICHA** ya lo distinguía desde siempre: resuelve un
  identificador cedido contra las dos listas y para un mapa imprime «el mapa
  de …». La ambigüedad era del PAPEL, no de la aplicación.

### Las casillas de origen: latente, no viva, y con guarda

`cedioPanel` —por donde una casilla de síntesis y una entrada de bibliografía
declaran de qué panel dependen— resuelve el nombre con `slugPliego` del
TÍTULO. El slug de una caja es el de su título; el identificador de un mapa
es otra cosa (`llega`, `caminar`, `llenos`). Así que **una declaración que
nombrara uno de los trece vería solo la caja y nunca el mapa**, y lo haría en
silencio: la casilla seguiría citando un panel que no está, que es el §1 de
la v910 exacto.

Medidas las declaraciones que existen, son tres y ninguna es de los trece:
«Cómo cambió el sitio» dos veces y «Presión de crecimiento» una. Así que esto
**no está vivo hoy** y no se arregló nada — inventar un cambio para cerrar un
punto es lo que este proyecto lleva cinco tandas deshaciendo.

Lo que sí entra es la guarda, en `revisar.js`, para que la cuarta no nazca
mal. Cruza los dos inventarios del propio archivo —así un par nuevo queda
vigilado— y denuncia con archivo y línea cualquier panel de origen declarado
con uno de los trece. Y lleva **su propia guarda**: si los inventarios
dejaran de leerse, `dobles` saldría vacío y la comprobación pasaría en verde
sin vigilar una palabra, que es el patrón de la v878 con su propia lista.

Demostrada en las dos direcciones: cambiando una declaración a «Llenos y
vacíos» sale en rojo con `js/68-procity-reconocimiento.js:18503`, y
devolviéndola vuelve al verde.

### Demostrado contra la v924

Dos aserciones en rojo de cinco, con el texto viejo impreso: los once nombres
sin decir cuál son —«La sombra de los vecinos · Verde y agua · … · Cómo se
llega · A distancia de caminar»— y la banda de movilidad con la línea que se
leyó mal, palabra por palabra.

Las otras tres son material y guardas, no afirmaciones nuevas: que la lista
no esté vacía y el papel la respalde, que los renglones nombren varios de los
trece —sin eso no habría nada que rechazar— y que ninguno que nombra una sola
cosa lleve la aclaración de más.

Y la demostración se hace revirtiendo **solo los sitios que imprimen**: el
ayudante y lo que `estado()` expone se quedan, porque son lo que la suite
necesita para LEER. Es la lección de la v875 sobre el `git stash` completo.

## La hoja de déficit se compone en el servidor (v926)

Con el pliego v2 cerrado y la lámina quieta, lo que quedaba abierto en la
bitácora era **la lista viva de Visión Territorial**, sin tocar desde la v868.
De sus seis renglones, cinco piden algo de afuera que esta máquina no alcanza
—un proyecto de Supabase, la malla vial, SECOP, datos reales de tres
municipios— y **uno se podía cerrar entero**:

> **Exportación PDF con marca de agua en el servidor** — no hay exportación
> ninguna todavía.

Medido antes de escribir, que es la regla de la v863: era cierto. Ni cliente
ni servidor tenían una sola línea de exportación.

### Por qué en el servidor, que es lo que el renglón pide con esas palabras

La hoja de déficit es «la que se imprime y sale del edificio» —las palabras
son de la v867—. Una marca de agua puesta en el navegador la quita cualquiera
con el inspector antes de imprimir; puesta en el servidor viaja dentro del
archivo. Esa es la mitad del renglón, y es la que decide dónde vive el código.

### Las dos guardas que una respuesta en BYTES deja atrás

Y esta es la razón de fondo de que la tanda valga más que un botón.

`enviar`, en `vt/rutas.js`, hace dos cosas por TODA respuesta JSON: le pega el
`aviso_datos` (v867) y la pasa por `limpiar`, que corta si se coló una clave
de umbrales o pesos. Las dos existen exactamente para que «una ruta nueva lo
herede sin que su autor se acuerde».

**Un PDF no es JSON.** No pasa por `enviar`, así que las dos protecciones se
pierden **en silencio**: la respuesta sale bien formada y sin advertencia, que
es el fallo de la v867 reaparecido por una puerta que en la v867 no existía.
Se reponen, y las dos de manera estructural y no por costumbre:

* **`aviso` es obligatorio y no tiene valor por omisión.** O es el texto de la
  advertencia, o es `false` —«los datos son del municipio y no hay nada que
  advertir», que es una decisión—. `undefined` y `null` revientan con un error
  que explica por qué. Quien escriba la segunda ruta en bytes no puede
  olvidarlo: no compone una hoja sin decidirlo.
* **El compositor no recibe la fila del análisis**, solo los campos que
  `/vt/deficits` ya publica. Que la hoja no lleve pesos no es una comprobación
  que haya que acordarse de correr: es que no los tiene. Y hay una aserción
  que le mete umbrales y pesos por la entrada y exige que no lleguen al papel,
  para el día que alguien «enriquezca» la hoja volcándole el resultado entero.

La misma decisión, en pequeño: `aviso` y `marca` van juntos o no va ninguno.
Son la misma advertencia dicha a treinta centímetros y a tres metros, y una
hoja con el aviso al pie y sin marca es la que se fotocopia y pierde la mitad
que se lee de lejos. `probar-rutas` exige además que **todo origen que produzca
aviso produzca marca**, recorriendo los cuatro: un origen nuevo con aviso y sin
marca se vería solo al imprimir.

### Una consulta, dos salidas

`/vt/deficits` y `/vt/hoja.pdf` llaman a la MISMA función, `deficitDe`. Copiar
la consulta para el PDF habría sido comprar de antemano la divergencia de la
v879 — y entre una pantalla y un papel que dicen cifras distintas bajo el
mismo nombre, el que se defiende en una mesa es el papel. La prueba lo cruza:
la cifra impresa es la que la pantalla publicó.

### El método estaba escrito tres veces, y ya había divergido

Salió al ir a imprimirlo. `js/90` tenía la frase a mano en tres sitios, y dos
redacciones:

```
línea 284   radio recto · isócrona pendiente      (tablero)
línea 489   radio recto (isócrona pendiente)      (hoja de déficit)
línea 669   radio recto · isócrona pendiente      (ficha de propuesta)
```

La hoja en PDF habría sido la **cuarta** copia, y en el otro repositorio —
donde una divergencia ya no se ve al leer. Ahora el servidor manda
`metodo_texto` pegado a la cifra, como el aviso de origen: es el único que
sabe con qué método corrió el análisis. La pantalla y el papel imprimen lo que
llega, y el respaldo del cliente imprime el identificador crudo y **no una
frase reescrita**: volver a redactarla sería recrear la copia que esto vino a
quitar.

### La guarda de capacidades pasaba en verde por un COMENTARIO

El hallazgo de la tanda, y lo cometí yo en el acto.

Las listas vivas se sostienen sobre «marcas de capacidad»: un renglón puede
declarar algo faltante solo mientras el código servido no lo haga, y la PRUEBA
de que lo hace es una expresión que `revisar.js` busca en el archivo. La de
Visión Territorial era `/isócrona pendiente/.test(j90)`.

Al mover la frase al servidor, la capacidad **siguió en verde** — porque el
comentario que explicaba la mudanza contiene la frase que la prueba busca. Una
capacidad demostrada por un párrafo que habla de ella no está demostrada, y de
estas marcas cuelga la lista viva entera.

Los archivos se leen ahora **sin sus comentarios** (`soloCodigo`), reusando el
recorrido que la guarda del voseo ya tenía —subido a nivel de módulo, porque
una segunda copia divergiría a la tanda siguiente—. Lo que una prueba busca
tiene que estar en lo que corre.

Medido al aplicarlo: **las 16 capacidades del pliego siguen en verde** —no
había más falsos verdes— y la de Visión Territorial se pone roja sobre el caso
real. Demostrado en las dos direcciones: con el lector viejo, la capacidad
pasa con la frase solo en un comentario; con el de la v926, no.

### Y se miró el papel

Que es el método que más defectos reales ha encontrado en este proyecto (v874,
v882, v885, v887). Renderizado el PDF con los datos de la semilla de verdad,
tres cosas que ninguna aserción veía:

* **«15 min ? 1.200 m».** La norma del radio de caminata dice «15 min ≈
  1.200 m» y `≈` no está en WinAnsi. Lo cazó el contador de caracteres no
  escritos —por eso el contador se devuelve en vez de tragarse—, y salió
  justo en el renglón que justifica el radio. Los signos que CP1252 no tiene y
  sí tienen escritura exacta en ASCII (`≈`→`~`, `≤`→`<=`, `≥`→`>=`) se
  translitera; el contador queda para lo demás, y la prueba exige cero.
* **La hoja cerraba a media página.** Llenarla con adorno habría sido lo
  contrario de lo que hace este módulo. Lo que faltaba de verdad es lo que la
  lámina imprime desde la v849 —un vacío se declara, no se calla—: **«Lo que
  esta hoja no trae»**, con el mapa y por qué (el servidor no descarga teselas,
  y un recuadro vacío rotulado «mapa» sería el marco esquemático que la v887
  prohibió), la distancia caminada contra la línea recta, y el cupo de cada
  equipamiento —un colegio lleno cubre en el mapa y no en la práctica—.
* **La firma estaba en mitad de la hoja**, entre la procedencia y las
  carencias, y se leía como parte del bloque de arriba. La firma de un papel
  va al pie, y hay una aserción sobre el ORDEN y no sobre su presencia.

Y una cuarta de la misma clase, salida del volcado y no de la imagen: la frase
de la cifra decía **«a más de 1.200 m de colegio oficial primaria público»**.
El catálogo trae veinticinco tipos con géneros distintos, así que cualquier
artículo escrito ahí sale mal en la mitad. La frase no concuerda con el nombre
del tipo a propósito —el tipo ya está en el título—, que es la única manera de
que sea correcta para los veinticinco.

### Tres veces el mismo error de lector, y vale anotarlo

Las tres aserciones que se pusieron rojas en esta tanda fueron **de mi lector
de prueba y no del papel**, y las tres por el mismo descuido: leer el PDF como
una tira de texto.

* La prosa que se parte al llegar al borde: `No son datos del municipio` cae
  en dos renglones, y buscarla en un solo literal es exigir que no se parta.
* Los renglones medidos todos al mismo tamaño: cada uno se compuso al suyo, y
  medirlos con un número fijo mide otra cosa de la que dice (v854).
* El `·` que el propio texto del método lleva dentro es el mismo separador que
  la línea usa entre campos, así que cortar por `·` parte la frase en dos.

Los tres se arreglaron leyendo el trío **(fuente, tamaño, texto)** del flujo y
no el archivo entero, con dos maneras declaradas de juntarlo: separados para
buscar un literal, seguidos para rehacer la prosa. Juntar con espacio para
buscar una cifra fabricaría una que nadie escribió (v885).

### Lo que la hoja NO es, y queda en la lista viva

Sin mapa, y por la razón escrita arriba. Y sin la **ficha de propuesta**, que
es el papel con el que se aprueba una obra: esa sigue sin bajarse. El renglón
de la lista viva quedó reescrito con lo que falta de verdad y su cláusula
`ya:`, que es lo que la v866 dejó como contrato.

### Medido

`probar-hoja` (nueva, sin base ni red) **29**, `probar-rutas` **51**,
`probar-vt` **31**, `tvision` **48**, y la batería del repositorio público
**120/120**.

## Análisis de sector y análisis post-sector (v929)

Pedido para la vista de escritorio y resuelto como lo que era: **lógica de
negocio nueva, no un cableado de vista.** Hasta la v928 `tipoEstudio` valía
siempre `'completo'` y la aplicación no distinguía entre lo que se sabe de un
sector ANTES de pisarlo y lo que se sabe después.

* **Análisis de sector** — solo fuentes publicadas: OpenStreetMap, el DANE, el
  satélite. La fotografía de arranque.
* **Análisis post-sector** — el MISMO sector, recalculado, cuando hay al menos
  un dato de campo levantado. Lo que el campo no cerró sigue marcado SIN MEDIR
  con su trámite.

### Media corrida ya estaba escrita, y se estaba botando

Auditado antes de tocar nada —la regla de la v863—, `compararConCampo`
(js/68) hacía ya tres cuartas partes de esto desde hace tandas: toma los
puntos del curso, los convierte a elementos con forma de OpenStreetMap
(`URBIS_EDU.puntoAElemento`) y **los corre por el MISMO motor** con la misma
petición —mismo polígono o mismo radio—. Eso es, literalmente, un análisis
completo del sector hecho solo con lo levantado en campo.

Y lo **tiraba**: usaba `res.pois` para el diff y descartaba el resto en la
línea siguiente. Así que el post-sector se venía calculando y botando.

### No se fusionan dos resultados: se corre el motor una vez sobre la unión

El plan con el que se abrió la tanda decía «fusionar las dos corridas», y al
escribirlo se ve que es falso: sumar dos `stats` sería aritmética sobre
cantidades **derivadas** —la densidad, el índice de mezcla, la cobertura de
equipamientos— y ninguna se puede promediar. Dos sectores con mezcla 0,4 y 0,3
no dan uno con 0,35.

Así que el post-sector es lo que su nombre dice: la misma corrida, con la
misma petición, sobre una lista de elementos que además trae el campo. Una
sola ruta de cálculo (v879), y la misma decisión que la v902 tomó con la
referencia municipal.

**La petición no se vuelve a armar, se reusa.** `analizar` guarda la que usó
en `S.peticionSector` y el post-sector la clona cambiando solo los elementos.
Armar una segunda con el mismo polígono, el mismo censo y la misma dirección
sería la divergencia de la v879 comprada por adelantado — y pediría repetir
las consultas de ubicación y censo.

#### La unión no es una concatenación

Un punto que el curso mapeó y que además está publicado es UN punto: sumarlo
dos veces infla la densidad y no se ve en ninguna parte, que es la peor forma
de equivocarse. Se deja fuera el elemento de campo con uno publicado a menos
de `MISMO_SITIO_M` —**la misma constante que usa `compararListas`**, no una
segunda— y se cuenta cuántos se omitieron, porque un sector donde el campo no
agregó nada tiene que poder decirlo.

Lo que esa regla NO hace es resolver las discrepancias: cuando los dos están y
dicen cosas distintas, decidir cuál gana en silencio sería inventar. Esa sigue
declarada donde ya estaba.

### El almacén: `pcr_campo_v1`, colgado de la llave de la v915

Aparte de las fichas por la razón de la v871 —una entrada son décimas de
kilobyte y una ficha es el trabajo de una tarde— y, sobre todo, porque **el
campo es del SITIO y no de un análisis**, que es lo que permite recalcular el
mismo trazo las veces que haga falta.

**La identidad es `llaveDeSector`, la que la v915 ya escribió.** Un sector
analizado sin trazo guardado no tiene `trazoId` —se puede analizar un radio
sin guardar nada— así que colgar el campo del trazo dejaría fuera el caso más
común. Usar una segunda identidad habría sido la v879 otra vez.

Cinco decisiones, cada una con su precedente:

* **`hueco` sale del inventario que ya existe** —los cuatro vacíos
  obligatorios y las seis plantillas— y no de una lista nueva. *(Esta versión
  le sumó además «los tres índices del POT» como familia aparte, con tres
  claves que no existen en el módulo. Lo corrigió la v931: son el `valor` del
  hueco `norma-urbana`, no tres huecos.)* Una entrada cuyo hueco la lámina no declara **se rechaza al
  guardar**: un dato de campo cierra algo que la hoja dice que le falta; si no,
  no hay dónde pintarlo.
* **`estado: 'confirmado'` es lo único que cuenta.** Un borrador no convierte
  el sector en post-sector. Es la escalera del módulo presidencial: un
  señalamiento no pesa.
* **`fuente` es obligatoria y sin valor por omisión** —cómo, quién y cuándo, o
  la entrada no se guarda—. *(La v931 partió ese «cuándo» en tres fechas que
  no significan lo mismo, y dejó que un borrador se guarde a medias: solo el
  confirmado pide la procedencia entera.)* Es la regla que la v926 le puso al PDF: no hay
  silencio por omisión. Un dato de campo sin procedencia es indistinguible de
  uno inventado, y la lámina lo va a imprimir como medido.
* **Un hueco se actualiza, no se duplica.** Dos entradas del mismo hueco
  dejarían a la hoja eligiendo a cuál creerle.
* **Los edificios mapeados NO se guardan por llave.** Son puntos del
  dispositivo y se filtran por geometría al leer, que es lo que
  `edificiosDeCampo` hace desde la v754. Son dos clases de dato de campo con
  dos relaciones distintas con el sector, y meterlas en la misma tabla sería
  forzar una de las dos.

### `tieneCampo` no es lo que yo había supuesto, y la corrección vale la tanda

El plan decía que el post-sector se habilita cuando el campo cierra alguno de
los SIN MEDIR de la lámina. **Medidas las diez casillas que los imprimen, casi
ninguna es un hueco de campo**: «sin trazado medido», «sin red vial medida»,
«sin referencia de ciudad» se cierran pulsando un botón dentro de la
aplicación, sin que nadie pise el sitio.

Con esa regla el post-sector se habilitaría desde un computador, que es
exactamente lo contrario de lo que significa. Los huecos que de verdad cierra
el campo son los cuatro vacíos obligatorios y las seis plantillas.

Así que `tieneCampo` cuenta dos cosas y solo dos: una entrada **confirmada** de
un hueco del inventario, o **al menos un edificio levantado con sus pisos
contados** dentro del área. Pedirle una plantilla a quien ya levantó cuarenta
edificios sería absurdo.

Y devuelve **siempre un objeto, nunca un booleano** —`{ hay, fuentes, razon }`—
porque el interruptor deshabilitado tiene que decir POR QUÉ, y un `false` no lo
dice. Es la regla de la v876 con `censoCiudad`.

**Consecuencia asumida a propósito:** con esa regla, varios sectores ya
existentes nacen siendo post-sector. El dato está ahí y es real; lo que no
puede pasar es que se presente igual que uno donde alguien llenó una
plantilla, y de eso responde la procedencia.

### La procedencia viaja con la cifra, no con la pantalla

`res.campoProcedencia` se le pega al resultado y no se lee después desde el
panel: es la regla de la v890 con el área y la de la v902 con la referencia
municipal. Un post-sector archivado se vuelve a componer con este código.

Dice **qué lo cerró y de dónde salió**: «3 edificios levantados en campo, con
sus pisos contados entre el 2026-09-02 y el 2026-09-09», no «3 edificios». Y
lleva `aporto`, que es lo que impide leer de más: **con cero elementos
sumados, el post-sector tiene las mismas cifras de usos que el sector**, y la
pantalla lo dice —«lo levantado ya estaba todo publicado»— en vez de
presentarse como una medición nueva.

Donde la cifra no cambió no se declara nada: declarar procedencia de campo
sobre un dato que sigue siendo de OpenStreetMap es la falta de la v867 al
revés.

### El interruptor se MUESTRA apagado, no se esconde

Sin campo levantado, el botón de post-sector sale deshabilitado y con la razón
impresa debajo, en ámbar y a trazos —el código visual de los vacíos de la
v849—. Esconderlo sería esconder el vacío, que es lo contrario de lo que hace
este módulo entero; y además es lo único que le dice a un estudiante que hay
algo que se gana saliendo a la calle.

**El interruptor cambia `S.resultado` en vez de hacer que cada lector elija.**
El módulo tiene treinta mil líneas leyendo de ahí, y meterles a todas un
ternario serían treinta mil sitios donde se puede olvidar uno. Las dos
corridas viven en `S.corridas` y la activa es la que está puesta.

Y **las dos se sueltan al cambiar de sector**. Sin eso, el post-sector del
anterior sobreviviría al siguiente y el interruptor mostraría lo levantado en
otro barrio como si fuera de acá — el defecto que la v897 evitó con el acuse
de guardado.

### `tpostsector.js` · las dos ramas del interruptor en la misma corrida

Suite propia, y la razón es el material: hacen falta **sin campo y con campo**
en la misma corrida, y ninguna suite de la batería puede darlas —las que
siembran puntos del curso los tienen desde el principio, y las de la lámina no
siembran ninguno—. Sin las dos, la comprobación pasaría por no tener nada que
rechazar. Es la vigésima vez.

El sector de prueba trae un uso publicado **exactamente donde después se pone
un punto de campo**: sin ese solapamiento, la regla de no contar dos veces
pasaría sin tener nada que descartar.

Veintiuna aserciones: las dos ramas del interruptor, las tres guardas del
almacén —hueco desconocido, entrada sin procedencia, borrador que no
habilita—, la unión medida aparte sobre listas de mentira, la procedencia con
sus fechas, y que volver al sector devuelva exactamente las cifras de antes.

#### La cabecera de un punto es «Uso · Tipo», y el Tipo tiene que existir

Costó una aserción en rojo y no se deduce leyendo. El fixture inventaba
`'Farmacia de la esquina · Comercial'`, y con un tipo que no está en el
catálogo de js/64 `puntoAElemento` devuelve **null**: el punto no entra al
motor. Lo que despistaba es que `edificiosDeCampo` **sí** los contaba —mira
otra cosa— así que la procedencia decía «3 edificios» mientras la unión daba
`0 sumados · 0 omitidos`.

Dos partes del mismo módulo leen el mismo punto con criterios distintos, y una
puede estar bien mientras la otra falla en silencio. La aserción que lo cazó
es la que mide la unión APARTE del conteo total: sobre sesenta usos, un error
de dos no se ve.

#### La demostración contra la v928 es tosca, y se dice

Con `git stash` de js/68 y css/68 la suite no enseña texto viejo: revienta con
`R.huecosDeCampo is not a function`. Para una capacidad que no existía no hay
texto viejo que imprimir — es el mismo caso de la v844 y la v871, y es la
lección de la v875 sobre el stash completo vista por el otro lado.

### Lo que esta versión NO hace, y queda para después

Las **trece puertas de entrada** que faltan: las seis plantillas de campo de la
v883, los cuatro vacíos con trámite de la v880 y los tres paneles de
percepción. Cada una tiene una forma de dato distinta —un perfil vial son
tramos con medidas, una frecuencia son horas de paso, el riesgo oficial es un
documento con su número— y son una tanda por familia.

Lo que esta versión deja listo es el otro lado: el almacén las acepta con su
`hueco` y su procedencia, `tieneCampo` las cuenta, y el precedente de cómo se
conecta una está escrito desde la v903 con `S.indicesPuestos` y la norma
urbana.

**Y la vista de escritorio tampoco entra acá.** El interruptor vive en la
ficha que existe hoy; cuando llegue la vista de dos columnas leerá el mismo
`S.corrida` en vez de tener el suyo.

## La procedencia no inventa un autor (v930)

Pregunta del usuario sobre la v929, antes de dar por cerrada la puerta de los
puntos mapeados: para un edificio que ya estaba en OpenStreetMap, ¿de dónde
sale el `quien` y el `cuando` que la procedencia exige?

### La premisa no se sostiene, y medirla valió igual

**Un elemento de OpenStreetMap nunca llega a `edificiosDeCampo`.** Los dos
caminos no se cruzan en ningún punto:

```
OSM      Overpass → consultarEntorno → peticion.elementos → res.pois
campo    la hoja de reportes → globalData → urbisDatosVisibles()
                             → puntosDelCurso() → edificiosDeCampo()
```

Así que no existe el caso de una edificación publicada rotulada «contada en
campo»: si está en esa lista, alguien la registró desde la aplicación.

### Pero apuntaba a un hueco que sí estaba

**La procedencia de los edificios no llevaba `quien`, y nada lo denunciaba.**
El almacén rechaza una entrada de hueco sin autor —es la regla que la v926 le
puso al PDF: no hay silencio por omisión— y el camino de los edificios **no
pasa por el almacén**, así que se saltaba la exigencia entera. Es la forma de
la v867: la guarda existe en un camino y el otro la esquiva.

### El autor no viaja, y no se deriva

Medido antes de elegir qué decir, que es la regla de la v863:

* una fila de reporte tiene **exactamente** `tipo · lat · lng · descripcion ·
  fecha`;
* ninguna de las **trece ranuras** de la descripción guarda quién lo hizo —
  todas son del edificio o del reporte.

Y no se saca de otro campo. La sesión abierta dice quién MIRA, no quién
levantó; y este proyecto **quita a propósito** los identificadores personales
de los reportes. Derivar un nombre sería inventar procedencia, que es peor que
no tenerla.

Así que se declara lo que sí se sabe y se nombra lo que falta:

> 43 edificios **reportados en la aplicación**, con sus pisos contados entre
> el 2 y el 9 de septiembre — **sin autor declarado**: la fila de un reporte
> no guarda quién lo registró.

**De paso se corrigió una segunda sobreafirmación.** Decía «levantados en
campo», y eso reclama dos cosas que no se saben: que alguien estuviera en el
sitio —un punto se puede poner sobre el mapa desde cualquier parte— y que
fuera este curso —la aplicación la usa cualquiera—. «Reportados en la
aplicación» es exactamente lo que consta.

### La guarda persigue la clase

`tpostsector` gana tres aserciones y la que de verdad protege es la última:
**ninguna fuente de edificios puede traer un autor, venga de donde venga**.
Sin ella, bastaría con que una tanda futura rellenara el campo desde la sesión
para que la lámina volviera a afirmar quién sin saberlo, y el texto seguiría
viéndose correcto.

Demostrado contra la v929: tres en rojo con el texto viejo impreso —«3
edificios levantados en campo…» y `sinAutor: false`—.

## La fecha de un dato no es una sola fecha (v931)

El esquema de procedencia de la v929 y la primera de las cuatro puertas de
vacío: la **norma urbana**. Y como en la v916 y la v924, lo que más valió fue
medir las premisas antes de escribir — dos de las tres con las que se abrió la
tanda eran falsas, y una de ellas era **un defecto que yo mismo había dejado
en la v929**.

### El inventario de huecos tenía tres claves que no existen

`INDICES_POT = ['ocupacion', 'construccion', 'altura']`. Las de verdad son
`io`, `ic` y `pisos`: así las nombra `Q.CAMPOS` en js/78, así las lee
`sombraDeLoPermitido` y así las escribe el manejador de las casillas. **Las
escribí de memoria en vez de leerlas**, que es exactamente la falta de la
v863, dentro del mismo archivo cuyo comentario dice que el inventario «no es
una lista nueva».

No lo cazó nadie porque `tpostsector` entraba por `norma-urbana` y esas tres
nunca se ejercitaron: **el material no podía producir el fallo**, por vigésima
primera vez.

Y aunque hubieran sido las correctas, sobraban. **La ficha normativa del POT
es UN documento que se pide UNA vez y trae los tres números**, así que tres
huecos con tres procedencias serían tres copias de una misma declaración —y
dos copias de una advertencia se separan—. El hueco es `norma-urbana`, el que
la lámina ya declara, y los tres índices son su `valor`. Es la decisión que el
usuario tomó para toda esta tanda: *«valor libre por hueco, fuente común.»*

De paso, los cinco vacíos van por su TÍTULO y el id se deriva, como las
plantillas de campo dos listas más arriba. Escritos a mano eran dos listas de
lo mismo —los slugs en `PANELES_DE_VACIO`, los títulos en sus `caja(...)`— y
bastaba renombrar una caja para separarlos, que es el fallo de la v878.
Comprobado antes de cambiarlo: **la derivación da exactamente los cinco slugs
de hoy**, así que no mueve nada; lo que hace es que no puedan divergir. Y de
ahí sale el nombre legible de un hueco, que se venía deshaciendo del slug a
mano e imprimía «Informacion legal del predio», sin tilde.

### `cuando` juntaba tres cosas que se contradicen

La v929 guardaba una sola fecha. Al conectar la primera puerta de verdad se ve
que ese campo es tres:

| | Qué es | |
|---|---|---|
| `fechaDoc` | la del ACTO que declara el hecho | **obligatoria** en confirmado |
| `fechaObtencion` | cuándo se consiguió el papel | opcional |
| `vigenciaHasta` | hasta cuándo sirve | `null` donde no caduca |

Con una sola, **un Acuerdo de 2011 conseguido ayer se guardaba con la fecha de
ayer** y la lámina lo leía como norma de este año. Es la falta de la v867 —una
procedencia mal declarada es peor que ninguna— con el agravante de que el
número sale creíble.

`quien` es una **entidad** y no una persona: quien responde por el dato. La
Curaduría Segunda responde por una resolución; «Ana» no responde por un
Acuerdo municipal. Donde el dato sí lo levantó una persona —una plantilla de
campo— es su nombre, que es quien responde por ese conteo.

#### La vigencia vencida DECLARA, no bloquea

Se guarda igual, cuenta igual, y sale impreso «VENCIDO desde el … , hay que
volver a pedirlo». Es la decisión de la v886 con los mapas de 6,5 cm y la de
la v890 con el aviso de escala: quien analiza decide, la hoja dice. Hay una
aserción para cada rama —un «VENCIDO» puesto en todas partes pasaría igual con
una sola—.

#### La precisión se acepta como venga; la FORMA no

Un POT que solo se conoce por su año entra como `2011`. Lo que no entra es
texto libre: con «hace tiempo» adentro, `vigenciaHasta` no se compara contra
nada y **el vencimiento falla en silencio**, que es lo que este módulo lleva
veinte tandas evitando. Y al comparar, una fecha sin mes o sin día se lleva a
su ÚLTIMO instante: un documento vigente «hasta 2026» lo está hasta el 31 de
diciembre. Al revés se declararía vencido un papel que todavía sirve, que es
la mitad cara del error.

#### El borrador admite procedencia a medias; el confirmado no

La v929 la exigía entera en los dos estados, y con eso **el borrador no servía
para nada** —nadie puede guardar lo que lleva de una plantilla a medio llenar
sin haber ido todavía por el papel— y los dos estados significaban lo mismo,
cuando la mitad del diseño de este almacén es que solo el confirmado cuenta.
Cada estado exige lo suyo: el borrador, poder volver a él; el confirmado,
poder defenderse.

#### Y una entrada de la v929 no se asciende

Las guardadas antes traen `cuando` a secas, y cuál de las dos fechas escribió
su autor no consta en ninguna parte. Promoverla a `fechaDoc` sería **afirmar
la procedencia de la procedencia** — la falta que la v930 no cometió con el
autor de los edificios. Se lee por lo que es, `fechaSinDistinguir`, y la
lámina lo dice con esas palabras. El dato no se pierde ni se degrada; lo que
no se hace es ponerle una etiqueta que nadie escribió.

### La puerta: la norma urbana no se cierra sola

La condición que el usuario puso antes de esta tanda:

> que la migración de `indicesPuestos` existentes a norma urbana quede
> protegida con su propia aserción — que un índice ya guardado en una ficha
> vieja NUNCA se promueva solo a confirmado sin procedencia, igual que hiciste
> con el autor de los edificios en la v930. No solo dicho en la bitácora, sino
> demostrado en rojo contra el caso viejo antes de estar en verde.

**Y mi premisa sobre `indicesPuestos` también era falsa, a medias.** Yo había
dicho que no tiene procedencia ninguna. Sí la tiene: `S.indicesFuente` guarda
`documento`, `fecha` —texto libre, «2011, revisado en 2019»— y `tratamiento`
desde hace tandas, y el panel ya declara honestamente cuando está vacío. Lo
que **no** tiene, y ninguna ficha anterior a esta versión puede producir, es
**quién responde por el dato**.

Eso hace la invariante más fuerte de lo que yo la había planteado: no es que
la migración deba tener cuidado, es que **ninguna ficha pre-v931 puede
ascender, por construcción**. Y es exactamente lo que la segunda aserción
mide: con documento y año escritos —lo máximo que el esquema viejo podía
llevar— sigue sin poder, porque derivar el `quien` del nombre del documento
sería la falta de la v930.

`normaDesdeIndices` propone y no asciende: devuelve `puede: false` con la
lista de qué falta, la entrada que arma va **sin `quien`** y **nunca nace
confirmada**. La `fecha` libre se PREFILLA si tiene forma de fecha y se deja
vacía si no — prefilar no es afirmar: lo que la convierte en la fecha del
documento es que alguien la confirme.

Y la otra mitad, porque **una guarda sola falla abierto**: si alguien fuerza
la entrada propuesta por el almacén, el almacén la rechaza igual por falta de
`quien`. Las dos están medidas.

#### La puerta se abre, y eso también se mide

Sin la rama contraria, un «falta» puesto en todas partes pasaría en verde y la
puerta no serviría. Escrito quién expidió el documento, aparece el botón, y
al pulsarlo la norma queda como dato de trámite con su procedencia entera —
y el sector pasa a tener análisis post-sector. La corrida post anterior **se
suelta**: se calculó sin ese dato, y servirla ahora sería presentar como
post-sector una cuenta que no lo incluye (v897).

El campo de fecha pasa a pedir una fecha y no una frase, y el panel gana el de
quién expidió. Una ficha vieja con la frase adentro no se pierde: se queda
escrita y el panel dice que hay que ponerla en forma de fecha para que la
norma cuente.

### Un post-sector cerrado por papel no es uno cerrado por puntos

Salió al abrir la puerta, y es una consecuencia que la v929 no podía tener:
hasta ahora el post-sector solo se encendía con puntos levantados, y el panel
decía, cuando el campo no agregaba elementos nuevos, *«lo levantado en campo
ya estaba todo publicado… lo que sí cambia son los pisos contados edificio por
edificio»*. Con la norma urbana adentro, un sector puede pasar a post-sector
**sin un solo punto**: el estudiante fue a la curaduría y no ha salido a
mapear. Ahí esa frase es falsa por los dos lados — no se levantó nada y no hay
pisos contados.

Es la clase de la v874: una cifra correcta dicha de una manera que no se
sostiene. `porPuntos` viaja con la procedencia, pegado al resultado (v867), y
el panel dice cuál de los dos post-sectores es. Las dos ramas se miden en la
misma corrida: con los edificios puestos y con los puntos quitados, que es
literalmente el sector de quien tiene el papel y no el mapeo.

### Demostrado en rojo contra el caso viejo, antes de estar en verde

Se escribió primero la versión **ingenua** —«el estudiante ya escribió los
índices, luego tiene la ficha normativa»—, que es lo que una tanda futura
haría sin pensarlo, y se corrió la suite contra ella:

```
✓ MATERIAL · los tres índices quedaron escritos por sus casillas — indicesPuestos=ic,io,pisos
✗ una ficha vieja sin fuente anotada no puede ascender, y dice qué falta — true · falta:
✗ ni con documento y año anotados, porque el QUIÉN no existía en ese esquema — true · falta:
✗ y forzarla por el almacén tampoco pasa — ok=true
```

Con la versión guardada, las tres en verde y la última enseñando el rechazo
del almacén con todas las letras. **La guarda de material va primero y a
propósito**: sin los tres índices escritos por el camino de verdad —lote
dibujado con sus botones, casillas escritas y su evento— no hay caso viejo que
rechazar, y las tres de abajo pasarían por no tener nada delante. Es la regla
de la v920.

### Dos aserciones mías que medían otra cosa de la que decían

Las dos salieron del primer rojo y ninguna era del código:

* **`estado()` no expone `indices`.** Eso vive en `trabajoAMano()`. Leí
  `R.estado().indices` y daba `undefined`, o sea la guarda de material en rojo
  con el material puesto. Lo que una prueba necesita leer se agrega a
  `estado()` —la regla de la v871— y va la LISTA y no un booleano, porque la
  guarda tiene que poder decir cuáles faltan.
* **El borrador se medía contra `tieneCampo().hay`**, y a esa altura de la
  corrida el sector ya tiene campo por los edificios: la aserción habría
  pasado o fallado por un motivo ajeno. Lo que se mide es que el borrador **no
  entre en la lista de fuentes**, o sea que no sostenga ninguna cifra.

Y una tercera, que sí era legítima: la aserción de la v929 citaba «falta
quién, falta cuándo» y el texto de ahora dice «quién responde por el dato, la
fecha del documento». Se apretó al texto de ahora, no se aflojó (v878).

## Una puerta, varias declaraciones (v932)

Las tres puertas de vacío que faltaban —riesgo oficial, movilidad real e
información legal del predio— y una corrección del esquema de la v931 que el
usuario vio antes que yo:

> riesgo oficial puede tener más de una amenaza —inundación, remoción,
> sísmica— y el esquema guarda un solo `fechaDoc` por entrada. Si cada amenaza
> puede venir declarada por un acto distinto, una sola fecha por hueco no
> alcanza. Que lo mida antes de escribir el formulario.

### Medido, y resultó más general que la pregunta

El módulo ya distingue TRES amenazas, cada una en su archivo y con su `fuente`
declarada: la **sísmica** y los **movimientos en masa** en `js/76` (SGC, citada
contra la NSR-10, que es un decreto NACIONAL), y la **inundación** en `js/79`
(IDEAM — y el propio código ya nombra el **POMCA del río** para Cúcuta, que lo
adopta la CAR y no el municipio).

Y la vara para saber cuándo una puerta se declara por partes salió de los
`quien` que los propios paneles ya escriben, donde conviven dos patrones que se
parecen y no son lo mismo:

* **«o»**, o «donde no hay curaduría, la Secretaría» — dos sitios donde pedir
  el MISMO papel. Una entrada basta.
* **«y»** — dos papeles distintos. Cada uno necesita el suyo.

Con esa vara, **las tres puertas de esta tanda son multi-declaración**, por tres
razones distintas:

| Puerta | Se multiplica por | Y por eso difieren |
|---|---|---|
| riesgo oficial | **amenaza** | sísmica (NSR-10, nacional) · masa (SGC) · inundación (POT o POMCA de la CAR) |
| movilidad real | **artefacto** | el cuadro de rutas tiene fecha de publicación; un aforo, el día y la hora en que se contó |
| información legal | **documento** | el certificado de tradición lo expide Registro; el boletín catastral, el IGAC |

Nótese que la multiplicidad de riesgo **no está en su `quien`**: ahí dice «en
algunos municipios, la oficina de gestión del riesgo», que son alternativas. Está
en las amenazas, que el texto del panel no revelaba — que es justamente lo que el
usuario vio y la vara sola no habría encontrado.

### Lo que salva no es la fecha, es el RESPONSABLE

Con una entrada por puerta, una zona de inundación declarada por POMCA se
guardaría a nombre de **Planeación Municipal, que no la adoptó**. Declarar mal
quién responde es la falta de la v867, y sale más cara que una fecha equivocada:
una fecha se corrige mirando el papel; un responsable falso se defiende en una
mesa hasta que alguien llama a la entidad.

### `sub`, y por qué es una lista cerrada

El hueco sigue siendo `riesgo-oficial` —el panel que la lámina declara— y `sub`
nombra la parte. Con hueco compuesto (`riesgo-oficial:inundacion`) habría que
aflojar `esHuecoConocido`, que es el guardián que impide que el almacén sea un
cajón; con `sub` validado aparte, la guarda del hueco queda intacta.

La condición del usuario, y es la que lo sostiene: **texto libre en `sub` no
protege nada**. Se valida como el hueco y en las DOS direcciones:

* donde el hueco declara partes, **falta** decir cuál;
* donde no las declara, traer una es un **error** y no un campo que se ignore en
  silencio — una entrada con un `sub` que nadie lee se guardaría creyendo que
  quedó dicho de qué mitad habla.

Y se valida **al leer**, no solo al guardar: una entrada con una parte que la
lista ya no declara no se puede pintar en ninguna fila, así que contarla haría al
sector post-sector por un dato que la hoja no sabe enseñar.

La deduplicación llavea sobre `hueco + sub`, así que la tercera amenaza no pisa
a la primera y la misma amenaza sí se actualiza.

#### Una entrada anterior a la v932 no se tira

La primera versión de ese filtro al leer **descartaba** las guardadas antes de
esta tanda: no tienen `sub` porque la puerta era una sola. Lo cazó la aserción de
la v931 sobre la entrada vieja, que se puso roja con «(ninguna)».

Es la decisión de la v931 con la fecha sin distinguir, dicha para la parte: no se
asciende a una parte que nadie escribió, y **tampoco se pierde**. Se lee como
«parte sin distinguir», se cuenta, y la fila lo dice con esas palabras. Tirar un
dato real con procedencia completa por no saber a cuál mitad corresponde es peor
que la ambigüedad.

### Avenidas torrenciales: declarada, no rellenada

El Decreto 1807 pide tres estudios básicos y acá hay dos. `avenidas
torrenciales` no aparece en una sola línea del módulo —medido: cero menciones—
así que no se mide, no se pinta y **no tiene casilla**.

Agregarle el renglón «para completar el decreto» sería escribir de memoria una
lista que el módulo no sostiene, que es exactamente el defecto que la v931
encontró en `INDICES_POT`. Se declara como vacío del propio módulo, en el bloque
y con su razón, y entra el día que algo lo mida. La instrucción fue literal: «no
es tuyo para resolver en esta tanda».

### La puerta vive en la ficha, no en la lámina

Un formulario con casillas no se imprime en una hoja de 60 × 90. La lámina sigue
declarando el vacío con su trámite (v880); la puerta es donde alguien anota lo
que trajo de la ventanilla. Y es **un** bloque para las tres, no tres: quien
vuelve de radicar derechos de petición vuelve con varios papeles el mismo día, y
tenerlos repartidos por tres pestañas es lo que hace que se anote uno y se
olviden dos.

### La guarda de la v885 se cobró otra vez

Llamé `nombreDeSub` a un ayudante, y ese nombre ya lo tiene —sesenta pantallas
más abajo— el buscador de la TAXONOMÍA de usos, donde «sub» es la subcategoría de
un uso. Como la segunda declaración pisa a la primera, **mis filas habrían
buscado una parte de vacío en el catálogo de usos**. Salió con archivo y línea al
primer `revisar.js`. Es el tropiezo de `trazoDe` de la v892 y se llama ahora
`nombreDeParte`.

### Tres vueltas por medir mal, y la regla que queda

La aserción del panel salió «0 anotadas» con las tres entradas guardadas. El
detalle de la aserción llevaba las dos llaves y lo que el almacén devolvía, y eso
lo resolvió en una corrida: **misma llave a los dos lados, y el almacén
devolviendo las cuatro entradas**. O sea que no era ni la llave ni el filtro.

Era el DOM sin repintar: el manejador de pestañas es `if (pes !== S.pestanaFicha)`
y «general» YA es la activa, así que el clic no repinta. Yo había guardado
llamando al almacén directo, y el que repinta es el manejador.

De ahí sale la división que vale la pena tener escrita:

* **lo que la INTERFAZ posee se prueba con el botón** —la regla de la v871—, y
  de paso se ejercita el manejador;
* **lo que el ALMACÉN posee se prueba contra el almacén**, como las tres
  aserciones de rechazo. Probar la deduplicación por la puerta no se puede: una
  fila ya anotada se pinta como anotada, con «Quitar» y sin casillas, así que no
  hay dónde reescribirla —el intento dejó la fecha vieja y la aserción en rojo—;
  y hacerlo con Quitar y volver a anotar crearía una entrada nueva sin nada con
  qué chocar, o sea sin ejercitar la regla.

Y va **después** de leer el panel, para no dejar el DOM viejo en medio.

El detalle de las dos llaves se queda en la aserción a propósito: es lo que
distinguió «la llave no coincide» de «el DOM no se repintó» en una sola corrida.

#### Y un parche que falló en silencio

Un `python3` con tres anclas abortó en la tercera —un parche anterior había
separado dos líneas que esperaba juntas— así que **no escribió nada**, y la
corrida siguiente repitió el mismo rojo. Lo reporté como arreglado. El
`AssertionError` estaba impreso encima de los resultados y lo leí por encima
hasta el rojo conocido de abajo.

La lección no es «mirar mejor»: es que **un parche por anclas o escribe entero o
no escribe**, y hay que comprobar su señal de éxito antes de creerle a la corrida
que viene después. Es la misma regla de la v880 —«una salida vacía no es una
salida buena»— dicha para el parche en vez de para la suite.

## Un hueco es donde se trae un papel (v933)

Salió de una pregunta del usuario sobre el inventario de puertas, y de medir su
premisa antes de actuar, que es la regla de la v916. La premisa era: «si la v880
ya decidió que servicios públicos no es un vacío obligatorio, sácalo de
`huecosDeCampo`». Se sostiene, y el discriminante que él nombró resultó ser
exactamente el correcto.

### Dos listas que significaban cosas distintas y se derivaban una de otra

`huecosDeCampo()` salía de `PANELES_DE_VACIO`, que es la lista de
**MAQUETACIÓN**: las baldosas que no ceden en ningún formato y que en la hoja
acostada van entre las cifras. Un **HUECO** es otra cosa: el sitio donde alguien
anota el papel que trajo de una ventanilla.

Coincidieron hasta la v880, cuando «Servicios públicos» dejó de ser un vacío
obligatorio —lo llena la misma capa del censo por manzana que el módulo ya
consulta—. La lista de maquetación no cambió, porque el panel sigue maquetado
igual, así que el almacén siguió aceptando un papel para él **tres versiones sin
que nadie se enterara**.

### El discriminante estaba en el código y nadie lo miraba

Es `panelVacio`, y medido separa los cinco sin ninguna ambigüedad:

| Caja | ¿pasa por `panelVacio`? |
|---|---|
| Riesgo oficial · Norma urbana · Movilidad real · Información legal | **sí** |
| Servicios públicos | **no** |

`panelVacio` es lo que imprime «Sin dato oficial disponible», que es la forma de
declarar que ningún dato publicado lo trae. La caja de servicios públicos no pasa
por ahí: arma su propio cuerpo —las barras que la capa conteste, o la declaración
con la lista de campos como prueba— y llama a `comoSeConsigue` como respaldo.

Y acá hay que separar dos cosas que es fácil juntar —las junté yo al cerrar
esta tanda—. El FALLO es de la clase B, «dos cosas que codifican un solo
hecho»: una lista derivada que dejó de coincidir. Que `panelVacio` fuera un
discriminante que nadie leía es cómo se ENCONTRÓ el arreglo, no cómo se produjo
el fallo — la clase A es otra, y su contador ya iba en tres desde la v903. Las
dos están nombradas arriba, en «Tres clases de error que se repiten».

Como en las demás de la clase B, **no hizo falta tocar nada más**: solo dejar de
derivar una lista de la otra.

`TITULOS_DE_HUECO` son ahora los cuatro, al lado de los cinco de maquetación, y
la guarda las liga.

### Lo que cuesta, dicho

El trámite de servicios públicos —derecho de petición a la empresa prestadora, o
el SUI de la Superservicios— **se queda sin dónde anotarse**. Es el precio y es
chico: ese trámite es el respaldo para cuando la capa del censo no contesta, no
un vacío, y ninguna puerta lo ofrecía nunca —las únicas cuatro son las de la v931
y la v932—, así que no hay una sola entrada guardada que se pierda.

### La guarda va en las DOS direcciones, o no sirve

En `revisar.js`, y es lo que el usuario pidió con estas palabras: «para que la
próxima vez que algo deje de ser vacío, el almacén no se entere solo».

* un panel que **deja de pasar** por `panelVacio` y se queda en la lista de
  huecos sale en rojo, con el remedio escrito;
* y uno que **empieza a pasar** por ahí y no está en la lista, también.

Sin la segunda, el arreglo podría ser vaciar `TITULOS_DE_HUECO` y la guarda
pasaría sin vigilar nada. Cada caja se mide **dentro de su propio trozo** —los
cortes son las propias llamadas a `caja(`—, que es la lección de la v854: un
`panelVacio(` buscado suelto encontraría el de la caja de al lado.

Y lleva su guarda de guarda: si `huecosDeCampo` volviera a leer la lista de
maquetación, todo lo de arriba seguiría en verde sin vigilar el almacén. Es el
patrón de la v878 con su propia lista.

Demostrada en las dos direcciones: devolviendo «Servicios públicos» a
`TITULOS_DE_HUECO` sale «es hueco y NO lo pinta»; quitando «Riesgo oficial» sale
«pinta vacío y NO es hueco».

### Lo que salió al medir y NO se tocó

La caja de servicios públicos cierra con `'g3 caja-vacio'` **sin condición**,
mientras su comentario dice que «sigue siendo una caja ámbar mientras la capa no
conteste». O sea que cuando la capa SÍ contesta, sus barras se imprimen dentro de
una caja ámbar a trazos —que en esta hoja significa «esto no lo tenemos»— y
además **pierde su pie de método**, porque `caja()` lo suprime en las
`caja-vacio` desde la v880. Son dos afirmaciones falsas sobre un dato medido, o
sea la clase de la v861.

El arreglo es una línea —el ternario que «Norma urbana» ya tiene— pero cambia el
aspecto y el pie de un panel en las hojas compuestas, así que mueve aserciones de
`tdoslaminas` y `tlaminaedu` y pide su propia medición. Queda declarado acá con
lo que se midió, en vez de hecho a ojo de paso: es la decisión de la v903 con las
cuatro cifras de §10.

**Hecho en la v953**, y la medición destapó que no era una línea sino dos: al
volverla una caja normal apareció que el panel nunca había tenido entrada en
`METODO_PANEL` — el `caja-vacio` suprime el pie de método, así que la regla que
exige que ninguna caja quede sin método no podía morderla.

## El paramento se camina (v934)

La primera de las seis plantillas de campo de la v883 conectada al almacén. No
se eligió por gusto: medido, **«Actividad en primer piso» es la única que la
hoja se nombra a sí misma como su relleno**, y lo hace tres veces —las otras
cinco suman una entre todas—. Las tres son casillas que hoy imprimen SIN MEDIR,
y una de ellas promete con todas las letras que **«esta casilla se calcula
sola»** cuando alguien la llene. Hasta la v933 nada podía cumplirlo.

    v933   Continuidad del paramento · SIN MEDIR · «el cero es del mapa y no del frente»
    v934   43 % del frente de la cuadra con fachada · medido en campo entre el 12 y el 14

Lo que cierra es el defecto de la v899: con cero huellas mapeadas sobre la
cuadra, `pctLleno` da cero siempre y no mide un frente — mide una capa vacía.
Caminar la cuadra con una cinta lo mide de verdad.

### La forma se midió antes de elegirla, y la premisa con la que se abrió era falsa

Yo había planteado la duda como «¿una entrada por cuadra, ya que `sub` no
aplica?». Medido, la pregunta estaba mal puesta:

* **La casilla necesita UNA cuadra, no varias.** `laCuadraDelLote` exige el
  lote, busca la vía más cercana a su centroide y se queda con **un solo
  tramo**; los cuatro consumidores del paramento leen esa misma cuadra.
  Partir por cuadra resolvería un problema que la casilla no tiene.
* **Las cuadras no son una lista cerrada**, así que `sub` no aplica — y
  aflojarlo para que aceptara texto libre volvería a abrir el cajón que la
  v932 cerró. La condición del usuario era correcta y acá se sostiene sola.
* **El proyecto ya había decidido dónde va la atribución cuando varía por
  fila, y es una COLUMNA.** De las seis plantillas, una sola lleva «Quién
  informó»: «Cupo real de equipamientos», donde cada cupo lo dice una portería
  distinta. Las otras cinco no la llevan porque el levantamiento es de una
  persona. Eso es una decisión de la v883, no un descuido.
* **Y ya existía un precedente para varias fechas sin `sub`:** los edificios
  de campo imprimen «entre el 2 y el 9 de septiembre» desde la v929.

Así que: **una entrada por plantilla**, con las filas en `valor`; `fechaDoc`
más `fechaHasta` para el rango; y `quien` como **persona**, que es lo que la
v931 dejó dicho para un dato que alguien levantó caminando.

#### El rango se escribe en UN solo sitio

`cuandoTexto(desde, hasta)` lo usan la procedencia de los edificios de campo y
la de esta plantilla. Estaba escrito en línea dentro de `textoDeProcedencia`, y
copiarlo habría sido comprar de antemano la **clase B** —dos maneras de
escribir la misma frase se separan a la tanda siguiente— en la misma tanda en
que se nombró la clase.

Y un rango al revés **no se guarda**: saldría impreso «entre el 14 y el 12»,
que es una cifra correcta dicha de una manera que no se puede leer (v874) y que
se lee como un descuido de quien firma la hoja. Se valida como fecha por lo
mismo que las otras tres de la v931: con texto libre adentro la comparación no
compara nada y el fallo sería silencioso.

### La fila marcada es la del lote, y eso es una regla de ESCALA

La casilla «Continuidad del paramento» está declarada a escala **predio**. Con
varias cuadras anotadas, promediarlas publicaría una cifra de **sector** en esa
casilla — que es exactamente el error que `ESCALA_PANEL` existe para impedir
(v854), y el más caro de un análisis urbano porque no se ve.

Así que con una sola fila no hay que marcar nada; con varias, hay que decir
cuál es la del lote, y si nadie lo dijo **la casilla no se calcula** y el aviso
dice por qué. Falla cerrado, que es la decisión de la v880.

### Entra por el punto único, no consumidor por consumidor

Lo levantado en campo se pega dentro de `laCuadraDelLote()`, que es por donde
pasan los cuatro sitios que imprimen el paramento. Es la regla del aviso de
origen (v867): **una casilla nueva lo hereda sin que su autor se acuerde**, que
es lo único que impide que esto se pierda otra vez.

Y manda sobre las huellas porque mide otra cosa y la mide mejor: una huella de
OpenStreetMap dice que hay un edificio, no que tenga puerta o vitrina a la
calle, que es lo que hace un paramento activo. La cifra **lleva su procedencia
pegada** —«medido en campo entre el … y el …»— porque un post-sector archivado
se vuelve a componer con este código, y sin el origen una medida de campo y una
de OpenStreetMap se leen igual.

De paso, `pctLlenoMapa` se conserva al lado: las dos cifras existen y son
distintas —43 % contra 0 %—, y tirar la del mapa sería perder con qué
contrastar.

### La puerta va en un bloque aparte

Un papel se pide en una ventanilla; una plantilla se camina. Es la misma
separación que la v883 hizo en la lámina entre los tres paneles de percepción y
los seis formularios de medición, y acá el contenido la justifica: nadie radica
nada, sale con una cinta. Verde y no ámbar, por la razón de la v880.

### Dónde vive la comprobación, y por qué no en `tpostsector`

En **`tsinmapear`**, y no fue una preferencia: `tpostsector` **no mide el
trazado**, así que `laCuadraDelLote` devuelve null ahí y las nueve aserciones
habrían pasado por no tener nada que rechazar — el agujero que este proyecto
lleva veintidós tandas persiguiendo. `tsinmapear` ya tiene, desde la v899, un
segundo lote sobre una cuadra con calles y **sin una sola huella**: es
exactamente el sector de quien tiene que salir a medirla. Como en la v881, no
hizo falta empobrecer ningún material — ya había uno en otra suite.

La guarda de MATERIAL va primero (v920): que esa cuadra esté medida, con cero
huellas, y que la puerta se pinte. Si eso deja de ser cierto, se pone roja ella
y lo de abajo no significa nada.

Y cada rechazo **dice su propia causa**, que es lo que los hace distinguibles:
la primera versión daba el mismo mensaje a «falta una medida» y a «la medida no
cuadra», así que las dos aserciones pasaban por la misma frase y no medían dos
cosas. Son distintas para quien está escribiendo, y un solo mensaje manda a
revisar lo que está bien.

### Lo que esta plantilla NO cierra, medido

La hoja la nombra en tres sitios y solo cierra **dos**. El tercero es «Mezcla de
usos», que pide cuánto de cada edificio es vivienda — y las columnas de esta
plantilla son frente total, con puerta o vitrina, muro ciego y cerrado ese día.
Ninguna dice vivienda. Esa casilla la cierra el mapeo por edificio, que es lo
que el propio texto nombra al lado; la mención de la plantilla ahí es una
inferencia, no una medición, y **no se tocó para no afirmar de más**.

### Y lo que la forma no distingue, declarado

Si dos personas caminan cuadras distintas, la entrada guarda **un solo
`quien`**. El remedio con precedente está identificado y no se hace acá: sería
una columna «Quién informó», como la que «Cupo real de equipamientos» ya lleva
desde la v883 justamente porque cada cupo lo dice una portería distinta.
Cambiar las columnas cambia la plantilla impresa y sus aserciones en
`tlaminaedu`, así que es su propia tanda.

Quedan **cinco** plantillas por conectar, y las tres de percepción — que además
necesitan entrar en `huecosDeCampo` antes de tener formulario, porque hoy el
almacén no las acepta.

## La afluencia se pinta donde se mide (v935)

Pedido como «agregar al módulo educativo el análisis de aglomeración y flujo
de personas que ya existe en el empresarial, con su mapa de calor». Medido
antes de escribir —la regla de la v916— la premisa resultó **medio falsa**, y
la mitad falsa es la que decide la tanda.

### Las palabras no existían, y el análisis sí

`aglomeración`, `flujo de personas`, `afluencia` y `footfall`: **cero
apariciones** en el repositorio público. Lo que existe se llama `flujo`, lo
calcula `motor-reglas.js` y lo publica en `stats.movilidad.flujo`.

Y **el educativo ya lo tiene**. `js/56-calor.js` lo dice en su propia
cabecera: existe para que no haya tres copias de la rampa, porque lo pintan
**empresas (js/62), el curso (js/65) y el informe en papel (js/63)**.

Lo que pasa es que hay **dos superficies educativas**, y solo una lo tenía:

| | flujo | mapa de calor |
|---|---|---|
| `js/64` + `js/65` — el panel de `?app=educativo` | sí | **sí**, capa sobre el mapa incluida |
| `js/68` — el pliego, la ficha y la lámina | sí, en 6 sitios | **no**: cero `mapaCalor` |

O sea: **el pliego venía calculando la malla en cada corrida y botándola.**

### `calor` ya estaba tomado, y significa otra cosa

`S.calor` y `alternarCalor` existen en js/68 desde la v877 y son el calor de
**densidad de usos** —cuántos usos de una categoría hay cerca—. Llamar `calor`
a la malla de flujo habría sido el tropiezo de `trazoDe` (v892) y
`nombreDeParte` (v932) por tercera vez, con un agravante: **la guarda de la
v885 no lo habría visto**, porque no serían dos declaraciones del mismo nombre
sino dos nombres para un concepto — que es la clase B y no tiene guarda.

Se llama **`afluencia`**, medido libre en todo el repositorio antes de usarlo.

### El dibujo no se reimplementa, y hay una razón concreta

`js/56` usa la **misma conversión metros→grados** que el motor usó para armar
la malla. Su propio comentario dice por qué importa: *«si acá se usara otra
fórmula, la mancha caería una cuadra corrida del dato y nadie lo notaría,
porque una mancha de calor se ve igual de convincente en cualquier parte»*.

Escribir una cuarta copia de la rampa habría sido la clase B otra vez, en la
misma tanda en que se nombró.

### Tres declaraciones que el panel no puede callar

Un mapa de calor es de lo más convincente que hay, así que es de lo que más
hay que declarar. Cada una tiene su aserción porque las tres se pierden por
separado:

* es un **potencial modelado, no un conteo** — el motor lo declara de sí
  mismo, y la hoja lo repite desde la v858 para el flujo de hora pico;
* cada capa se normaliza contra **su propio máximo**, así que dice **dónde
  más**, nunca cuántos: un sector tranquilo también tiene su punto más rojo;
* y el **aforo de hora pico** sigue en la lista viva. Si en este panel
  apareciera un número de personas, sería inventado.

El **foco en palabras** es lo que convierte la mancha en algo que se puede ir
a mirar: «lo más concurrido a pie, de día, cae a unos 76 m hacia el oriente».
Lo calcula el motor; acá no se deduce.

### El recorte: se declara, no se borra

`flujoLigero` guarda las dos mallas peatonales y suelta la vehicular — 676
números que el pliego no dibuja. Dos decisiones:

* **se recorta al GUARDAR, no al leer**: una ficha anterior la trae y se
  respeta, que es la regla de la v932 con las entradas sin parte;
* y lo que no se guarda queda **declarado** —`vehicular: null`,
  `recortado: ['vehicular']` y su razón— en vez de desaparecido. Sin eso, un
  lector no puede distinguir «el motor no la calculó» de «se recortó a
  propósito», que es la distinción que la v899 estrenó.

Medido antes de recortar que nada la lee desde una ficha guardada: js/62 y
js/63 son otra página, y js/65 pinta desde una corrida viva
(`URBIS_EDU.analizar`), no desde `pcr_fichas_v1`.

### Una ventana de caracteres no es un bloque

`tmasanalisis` capturaba el flujo con `Quién pasa por acá[^]{0,240}` — o sea
medía «los próximos 240 caracteres», no «lo que dice el bloque». Al meter el
panel nuevo entre el título y las cifras, las dos aserciones se pusieron rojas
sin que nada estuviera mal.

Se ancló a la primera cifra del bloque y **el panel nuevo se mide aparte**:
así, si uno de los dos crece, el otro no queda fuera de cuadro. Es la regla de
siempre —una prueba que falla por un cambio legítimo se hace más precisa— y la
lección concreta es que **un ancla por distancia envejece; un ancla por
contenido no**.

### Lo que esta versión NO hace

El mapa en la **lámina B**. Toca `mapasDisponibles`, `METODO_PANEL`,
`ESCALA_PANEL`, `PELDANO_PLIEGO` y los pisos de §21 —cada uno con su regla— y
va en su propia tanda. La pantalla primero, el papel después.

Y no se tocó `?app=educativo`: ahí ya está y funciona.

## La malla dice de sí misma si es fiable (v936)

Salió midiendo para lo anterior, y es un defecto de verdad que la v935 dejó:
`mapaCalor.fiable` lo pone el motor en false con menos de 25 usos mapeados, y
su propio comentario dice por qué —«sin datos suficientes un mapa de calor es
una mancha bonita que no dice nada, y se ve igual de convincente»—.

**Los otros TRES módulos que pintan esta malla lo declaran** —empresas
(`js/62`), el curso (`js/65`) y el informe en papel (`js/63`)—. El panel de la
v935 era el único que lo callaba, y es el único que además iba camino de una
hoja de 60 × 90.

Es la **clase A** en su forma más limpia: el discriminante venía en el MISMO
objeto, al lado de `focoDia`, que el panel sí leía. Como `puntos` en la v875,
`cu.edificios` en la v899 y `S.indicesPuestos` en la v903. Cuarta vez.

No hizo falta tocar el motor: solo dejar de leer la mancha como si fuera una
medición.

El aviso vive en una función con nombre aunque hoy lo llame un solo sitio,
porque el día que la malla llegue al papel esa frase tiene que salir de ahí y
no escribirse otra vez. Y usa la clase ámbar con la que este módulo ya dice
«OpenStreetMap no tiene nada registrado»: es la misma advertencia, y darle una
clase nueva sería enseñar dos códigos para un significado, además de inventar
una que nadie pinta (v895).

### Las dos ramas, y ninguna hizo falta empobrecer

Otra vez el material decide si una comprobación significa algo. Y la tercera
—como en la v881 y la v898— en que **no hizo falta empobrecer nada: ya había
un fixture pobre en otra suite**:

* **`tmedir`** tiene **doce usos**, por debajo del corte del motor: ahí se mide
  que el panel avisa, y que dice qué hacer con la malla y no solo que es poco
  fiable (v880).
* **`tmasanalisis`** tiene usos de sobra: ahí se mide que el aviso **NO** sale.
  Esa es la que de verdad guarda — sin ella, el arreglo podría ser imprimirlo
  en todas partes, y un aviso que sale siempre deja de significar algo, que es
  como muere una alarma (v886).

Las dos llevan su guarda de material primero (v920), leyendo `afluenciaFiable`
de `estado()` —lo que una prueba necesita leer se agrega ahí (v871)—: si el
sector de cualquiera de las dos cambiara de lado del corte, se pone roja la
guarda y no la afirmación.

### Demostrado contra la v935

Revirtiendo **solo el hunk que imprime** —el `estado()` y las capturas se
quedan, porque son lo que la suite necesita para LEER, que es la lección de la
v875 sobre el `git stash` completo vista por el otro lado—: dos en rojo con el
estado viejo impreso, «lo calla» y «no lo dice», sobre un sector cuya malla el
propio motor marcó como poco fiable.

## La banda de movilidad está llena, y eso se midió (v936)

El punto 3 del plan aprobado era el mapa de afluencia en la lámina B, después
de la capa viva y del panel de la ficha (v935). Se escribió entero —inventario,
compositor, método, peldaño— y **no se publica**, porque medirlo devolvió un
precio que no se puede pagar en silencio.

    v935                   ceden 2 paneles
    v936 con el mapa      ceden 12, y la afluencia entre ellos

Diez paneles medidos a cambio de un potencial modelado que **cede igual**. La
hoja paga por un mapa que no imprime.

### La cuarta medición fue la que explicó las tres primeras

Es la regla de la v919 —una decisión de espacio se juzga midiendo las dos
composiciones, no leyendo la lista— llevada hasta encontrar la causa:

| Banda de movilidad | Ceden |
|---|---|
| 4 mapas (v935) | 2 |
| 5 mapas, la afluencia en el peldaño 2 | 12, la afluencia entre ellos |
| 5 mapas, la afluencia en el peldaño 3 | 12, y cede el MAPA de anillos |
| la afluencia en otra banda, 4 en movilidad | **2** |
| 4 en movilidad, uno de ellos la afluencia | **2** |

Las dos últimas son las que cierran el caso: **no es un mapa de más en la
hoja, es un mapa de más en ESA banda.** La misma figura en otra banda cuesta
cero —lista de cesión idéntica al punto de partida—, y la banda con cuatro
mapas cuesta cero sea cual sea el cuarto. El corte está exactamente en el
quinto.

Y el peldaño no lo mueve: con el 2 cede la afluencia, con el 3 cede el mapa de
anillos, y en los dos casos se van los mismos diez paneles. **El peldaño ordena
QUÉ se pierde; no cambia CUÁNTO.**

### La bisección cede global cuando el desborde es local

Esa es la causa de fondo y vale más que este mapa. La banda de movilidad se
desborda, y para devolverla a cuatro mapas la bisección recorre **un prefijo
de la lista ordenada** (v919) que empieza lejos de ahí: se lleva diez cajas de
otras bandas antes de llegar a un mapa de movilidad.

Arreglarlo —que la bisección sepa qué banda se desbordó— es su propia tanda y
no se toca acá. Hacerlo de paso, para que el mapa quepa, sería el arreglo
estructural que este proyecto ya deshizo tres veces: la mudanza de la v882, la
bisección de la v886 y la fila de texto de la v901.

### Lo que NO se hizo, y por qué queda escrito

Se encontró una salida y no se tomó, porque el motivo no aguanta ser leído.
**«Hasta dónde se camina desde el lote» declara escala PREDIO** en
`ESCALA_PANEL` —se mide desde el lote y necesita un lote dibujado— y su mapa
vive en una banda de SECTOR. Mudarlo a la banda del lote dejaría cuatro mapas
en movilidad y el problema desaparecería.

El argumento de contenido es real y está ahí desde antes. Pero lo encontré
**buscando una salida**, después de medir el precio, y ese es exactamente el
orden que produce la mudanza de la v882 —«un arreglo estructural hecho para
callar una comprobación es un arreglo sin causa»—. Queda medido y nombrado
para quien quiera tomarlo por su propio motivo, no aplicado por el mío.

### La afluencia no se pierde

Sigue donde la v935 la puso: la capa sobre el mapa vivo y el panel de la ficha,
con sus tres declaraciones. Lo que no llega es el papel.

## El perfil se acota con cinta, y el andén dibujado dice que es supuesto (v939)

La segunda de las seis plantillas de campo de la v883. Se eligió por lo mismo
que la primera —cuál cierra más de lo que la hoja declara faltando— y lo que
destapó al medirla vale más que la puerta.

### No había punto único, y por eso lo primero fue crearlo

Para el paramento (v934) `laCuadraDelLote()` ya existía y bastó pegarle lo de
campo ahí. Acá no: **ocho consumidores leen `trz.perfil` directo** —la sombra
de lo construido, el informe en hojas, la carencia, la caja de la lámina, las
tareas de campo, el inventario, la FODA y el bloque de la ficha—. Conectar uno
solo habría dejado los otros siete imprimiendo la cifra del mapa bajo el mismo
nombre: la divergencia de la v879 comprada por adelantado.

`perfilDeLaCalle(trz)` es ese punto, y los ocho pasan por él. Es la regla del
aviso de origen (v867): un consumidor nuevo lo hereda sin que su autor se
acuerde, que es lo único que impide que esto se pierda otra vez.

#### `llaveDeSector()` sin argumento devuelve cadena vacía

Y eso no se ve: el almacén simplemente **nunca encuentra nada**, así que la
puerta guarda, la entrada queda escrita y el perfil sigue saliendo del mapa.
Lo cazó la suite con `sin-sector` sobre un sector analizado. Los otros catorce
sitios del módulo escriben `llaveDeSector(S.resultado && S.resultado.meta)`, y
los dos míos no; es catorce veces la misma expresión, que es su propia clase B
y no se tocó en esta tanda.

### Acá la media sí es legítima, y por qué

En el paramento (v934) había que marcar la fila del lote, porque su casilla
está rotulada a escala de **predio** y promediar cuadras habría publicado una
cifra de sector donde va una de predio (v854). Acá la casilla —«El perfil de la
calle»— está rotulada a **sector**, y el ancho medio del motor es exactamente
eso. Promediar tramos publica una cifra de sector en una casilla de sector.

Lo que sí hay que decir, y va impreso en la ficha y en la lámina: **la media de
campo es SIMPLE y la del mapa pesa por metros de vía**. Comprobado leyendo
`motor-reglas.js`, que acumula `ancho * metros`. Son dos promedios distintos de
la misma cantidad, y callarlo presentaría dos tramos como si fueran la red.

La del mapa **se conserva al lado** (`anchoMedioMapaM`): las dos existen y son
distintas —6 m contra 8,1 en el sector de prueba—, y tirar una sería perder con
qué contrastar (v934). La ALTURA sigue siendo del mapa, así que `relacion` pasa
a ser una cifra de dos orígenes y eso también va dicho.

### Una casilla en blanco no es un cero, y tampoco es «sin medir»

Primero escribí `sinMedir`. Es falso a medias: el formulario dice «se deja vacío
si no hay», así que una casilla en blanco puede ser **que la pieza no exista**
—muchas calles no tienen separador— o que nadie la midiera, y las dos se ven
igual. Se llama `sinMedir` en el código y se imprime **«sin anotar en ningún
tramo — no existe, o no se midió»**, y no entra como cero al total de paramento
a paramento, que por eso queda corto y lo dice.

### El defecto que estaba impreso: una constante acotada como medida

Salió mirando el papel, que es el método que encontró los de la v874, la v882,
la v885 y la v887. En la hoja B suelta del sector de prueba:

```
7,4 m de calzada + andenes de 1,5 m
```

El 7,4 sale de `width`; **el 1,5 es una constante**. El motor no publica ancho
de andén —`anden` trae los tres porcentajes y nada más— así que `seccionDibujada`
caía siempre al respaldo y lo acotaba, en el mismo renglón que la calzada medida
y sin distinguirse de ella.

Son dos cosas distintas y por eso se separan:

* **dibujar** pide un número —una calle con andenes y sin andén dibujado sería
  peor—, así que el supuesto se conserva para el trazo, y va **a trazos y hueco**:
  dos cosas al mismo peso, una medida y la otra no, mienten sin escribir una
  palabra falsa (v859);
* **acotar** es afirmar una medida, y eso solo se hace con el ancho que alguien
  midió con cinta. Sin él la cota dice «el andén va dibujado a 1,5 m de
  supuesto, sin medir» y el rótulo, «andén (sin medir)».

### El método del panel decía dos cosas falsas del propio panel

Leídas contra `motor-reglas.js` (v863): decía «carriles × **3,3 m** más
andenes», y el motor hace `car * 3` y `anchoMedioM` es **calzada sola** —los
andenes no entran, como la carencia de al lado ya decía—. Las dos corregidas, y
la fuente nombra la cinta cuando la plantilla está levantada.

### La carencia se encoge, y conserva la arborización

Dejarla entera sería declarar ausente lo que está medido (v861). Borrarla sería
la mentira contraria por dos razones que van impresas: la plantilla **no tiene
columna de arborización** —un formulario en blanco no es una medición (v883)— y
mide unos pocos tramos, no la red.

Lo mismo en la cascada de suelo, cuyo renglón decía «no hay con qué estimar
cuánto suelo ocupa la calzada». Con la plantilla llena eso es falso, así que lo
dice de otra manera — **y el descuento no se hace igual**: llevar el ancho de
dos tramos a todos los metros de vía del sector es extrapolar, no medir. Se
declara con su razón en vez de moverse de paso.

### Dónde vive cada rama, y por qué no en la misma suite

* **`tmasanalisis`** · sus vías traen `lanes: '2'`, así que el motor publica un
  ancho de calzada y la sección se dibuja: ahí se mide que lo de campo MANDA. En
  `tsinmapear` ninguna vía trae ancho ni carriles, así que no habría contra qué
  mandar. Y su `conAndenPct` es 0, de modo que con la cinta adentro el andén
  dibujado es el MEDIDO: esa es la rama que se ejercita allá.
* **`tdoslaminas`** · sus vías traen `sidewalk` sin ancho, que es la única
  combinación que produce el defecto del papel: andenes registrados y ninguno
  con medida. La guarda de material va primero (v920).

Las dos hacen falta. Con solo la primera, un «medido en campo» puesto en todas
partes pasaría; con solo la segunda, un «supuesto» puesto siempre.

### Demostrado contra la v938

Ocho aserciones en rojo, en dos tandas y **revirtiendo solo lo que imprime** —el
núcleo, la puerta y lo que `estado()` expone se quedan, porque son lo que la
suite necesita para LEER (v875)—:

* con los ocho consumidores devueltos a `trz.perfil`: la ficha imprimiendo
  **«6 m de calzada»** mientras la cinta dice 8,1, sin una palabra de quién la
  midió, y la carencia todavía en «El perfil acotado, medido en campo» como si
  nada se hubiera medido;
* con la cota vieja devuelta: **«m de calzada + andenes de 1,5 m»**, el rótulo
  sin «(sin medir)» y el andén relleno como la calzada.

### Lo que esta plantilla NO cierra, medido

Si dos personas miden tramos distintos, la entrada guarda **un solo `quien`**.
El remedio con precedente está identificado y no se hace acá: una columna «Quién
informó», como la que «Cupo real de equipamientos» lleva desde la v883
justamente porque cada cupo lo dice una portería distinta. Cambiar las columnas
cambia la plantilla impresa y sus aserciones en `tlaminaedu`, así que es su
propia tanda.

Quedan **cuatro** plantillas por conectar, y las tres de percepción — que además
necesitan entrar en `huecosDeCampo` antes de tener formulario, porque hoy el
almacén no las acepta.

## El intervalo se resta, y una ruta sin mapear es un hallazgo (v940)

La tercera de las seis plantillas de campo. La elección no fue por gusto: con
la misma medición de la v934 —cuántas veces la hoja se nombra a sí misma como
relleno de una plantilla— **las cuatro que quedaban empatan en cero**, porque
sus únicas menciones son las cuatro casillas del inventario. Así que decidió
el criterio de fondo, que es cuál cierra más de lo que la hoja declara
faltando:

| Plantilla | ¿Otro camino ya lo hace? | ¿Cierra una carencia declarada? |
|---|---|---|
| Conteo de alturas por manzana | **sí** — `building:levels` por el mapeo por edificio, que ya cuenta para post-sector desde la v754 | no |
| Estado de andenes por tramo | a medias — `sidewalk` es una etiqueta de mapeo | el vacío ya tiene su puerta de papel (v932) |
| **Rutas observadas y su frecuencia** | **no** | **sí** — «cada cuánto pasan no está en ninguna parte» |
| Cupo real de equipamientos | no | no: «Quién queda por fuera» declara OTRO refinamiento —la población por manzana cruzada con cada radio— y no el cupo |

Las tres que se apartan quedan con su razón medida, que es lo que le falta a
la tanda que las tome. Y la primera fila es la que más vale como aviso:
conectar el conteo de alturas como hueco aparte sería **una segunda ruta para
un hecho que ya tiene la suya**, o sea la clase B comprada a sabiendas.

### El dato no es del sector: es de cada RUTA

Es en lo que esta plantilla se separa de las dos anteriores, y decide todo lo
demás. El paramento (v934) mide UNA cuadra y hay que marcarla; el perfil
(v939) promedia tramos y publica una media de sector. Acá **no se promedia
nada**: cada observación se engancha a su ruta por el letrero, y las rutas ya
existen como entidad en `movilidad.rutas`.

Y el enganche tiene un caso que es el más valioso de todos: **una ruta
observada que OpenStreetMap no lista entra igual**, marcada `solo-campo`. Es
literalmente lo que la carencia anuncia desde la v863 —«no dice que no pasen
busetas, dice que nadie las mapeó»— y descartarla por no estar en el mapa
habría tirado el hallazgo por el que se va a la parada.

### El intervalo SE CALCULA, y por eso no tiene casilla

El método de la plantilla lo dice desde la v883: «el intervalo sale de restar
pasos consecutivos». La plantilla impresa lleva su columna «Intervalo» y eso
está bien —en la parada se resta a mano para tenerlo ahí—, pero ofrecerla
**escribible en la puerta** habría dejado dos rutas de cálculo para la misma
cantidad (v879), y la escrita a mano no se puede comprobar contra nada. Se
teclean los pasos y la resta la hace el programa.

**Dos pasos son el mínimo.** Con uno se sabe que la ruta pasa y no cada
cuánto: llamarle frecuencia a un solo paso sería la clase de la v875, una
cifra que no mide lo que su rótulo dice. Se guarda igual —que una ruta pase
por acá ya es un hallazgo— y se imprime «un solo paso: no da intervalo».

#### La franja se dice con el reloj y NO se clasifica

El error típico que la v883 declaró es que «media hora en una sola franja no
da la frecuencia del día». La tentación era rotular la observación como «hora
pico» u «hora valle» — y qué es hora pico lo define cada municipio, así que
sería un juicio disfrazado de medición. Se imprime **«entre las 06:40 y las
07:14»**, que cualquiera comprueba.

#### Las horas al revés no se arreglan suponiendo la medianoche

Un paso a las 23:50 y otro a las 00:07 es real y daría −1.423 minutos.
Suponer el cruce de medianoche convertiría un error de tecleo en una cifra
creíble, así que se rechaza **nombrando ese caso**: quien lo tenga lo anota
como dos observaciones. Y es un mensaje distinto del de «eso no es una hora»,
porque son dos cosas distintas para quien está escribiendo (v934).

### Tampoco había punto único, y son seis consumidores

Como en la v939: el informe en hojas, la tabla de la lámina, la carencia, la
síntesis, el bloque de la ficha y lo que falta del sector leían
`movilidad.rutas` directo. `rutasDelSector(st)` es el punto, y los seis pasan
por él — un consumidor nuevo hereda lo observado sin que su autor se acuerde
(v867).

De paso, `bloqueRutas` pasa a recibir `st` y no `mv`: leer `S.resultado.stats`
adentro habría sido una segunda ruta al mismo objeto que el llamador ya tiene
en la mano.

### La carencia se encoge, y conserva el recorrido

Con lo observado, «cada cuánto pasan no está en ninguna parte» es **falso** y
dejarlo sería la falta de la v861. Borrarlo sería la mentira contraria por dos
razones que van impresas: media hora en una parada **no es el cuadro del día**
—para eso sigue haciendo falta la secretaría o un GTFS— y el **recorrido** no
lo levanta nadie sentado en un paradero.

### Dónde vive cada rama, y otra vez sin empobrecer nada

* **`tmasanalisis`** · cuatro paradas y **ninguna relación de ruta** en
  OpenStreetMap: es exactamente el sector donde lo observado encuentra rutas
  que nadie mapeó. Ahí viven la puerta, los tres rechazos y el `solo-campo`.
* **`tdoslaminas`** · tres rutas registradas y ningún campo: ahí vive la
  guarda —sin plantilla la tabla no inventa una columna de intervalo, ninguna
  ruta se marca «solo observada» y la carencia sigue entera—.

Sin la segunda, un «observado» puesto en todas partes pasaría igual. La guarda
de material va primero en las dos (v920).

### El defecto que salió al medir, y que NO se arregla acá

Una fila desapareció entre el rechazo y el guardado, y la causa no era la
suite: **un rechazo repinta la hoja y el formulario vuelve vacío**, así que
quien tecleó ocho filas y se equivocó en una hora las pierde todas. Medido, es
de **las tres puertas** —la v934 y la v939 tienen la misma forma— y solo se vio
acá porque el campo obligatorio de esta plantilla está entre los que la prueba
no reescribía.

No se arregla en esta tanda, y la razón es que arreglarlo en una sola puerta
crearía justo lo que este proyecto lleva veinte tandas evitando: tres puertas
con dos comportamientos. El camino con precedente está identificado —el estado
`borrador` que la v931 diseñó existe para exactamente esto: poder volver a un
formulario a medio llenar— y es su propia tanda. Queda medido y escrito, como
la v933 hizo con el `caja-vacio` de servicios públicos.

### Demostrado contra la v939

Tres aserciones en rojo, revirtiendo **solo los consumidores** —el núcleo, la
puerta y lo que `estado()` expone se quedan, porque son lo que la suite
necesita para LEER (v875)—: la ficha sin una palabra de que los intervalos
están observados, sin acotar la franja y sin nombrar las rutas que no están en
OpenStreetMap.

Quedan **tres** plantillas por conectar y las tres de percepción, que además
necesitan entrar en `huecosDeCampo` antes de tener formulario.

## Una decisión municipal no mueve un veredicto nacional (v941)

Primera tanda del módulo presidencial a partir del **pliego maestro** y del
**dossier de análisis** que llegaron el 18 de septiembre de 2026. Los dos
describen un motor de cuatro capas —extracción, indicadores, dos ejes,
editorial— que el módulo de hoy no tiene. Antes de escribir nada se midió qué
había, que es la regla de la v863 y la que el usuario fijó en la v916, y de
las diez cosas que el pliego marca obligatorias **ninguna existía en el
registro**: ni `nivel_de_gobierno`, ni la categoría probatoria, ni
`tipo_medicion`, ni `contrargumento_oficial`, ni la normalización por 100 días.

De las diez, esta tanda hace **una**: el Principio 8, que es el único que
cambia hoy quién pesa en un veredicto sobre una persona real.

### Lo que la medición encontró, incluido lo que NO era un defecto

Tres premisas se midieron y **dos resultaron falsas**, que es exactamente por
lo que la regla de medir antes de actuar está escrita:

| Premisa | Medido |
|---|---|
| «hay registros municipales colándose al score» | **no hoy**: los 25 hechos que nombran Medellín, Barranquilla o Cúcuta son actos del Gobierno nacional ocurridos allá, y los 13 casos de los dos registros son nacionales |
| «la comparación entre gobiernos compara períodos desiguales» | **ya está resuelto**: `comparacion.filas` lleva `comparable` desde antes y dice «un mes no da una cifra anual» |
| «el veredicto no debería contar hechos anteriores a la posesión» | **contradice el alcance declarado del propio módulo** — ver abajo |

O sea que la puerta de esta tanda es **prospectiva**, y hay que decirlo así:
no arregla un registro torcido, impide que el que viene lo tuerza. El dossier
trae cuatro registros —un desalojo en Manrique, el predial de Bogotá, una
emergencia hospitalaria anterior a este gobierno, unas desapariciones— que
**sí** entrarían mal, y son los que el usuario va a pegar.

### La puerta, y por qué el nivel se declara y no se deduce

`entraAlVeredicto(c)` es el único sitio que decide, y devuelve un **objeto con
su razón, nunca un booleano**: «no pesa porque es municipal» y «no pesa porque
su nivel está mal escrito» piden cosas distintas a quien lee la ficha, y un
`false` las juntaría en una. Es la regla que la v876 escribió para
`censoCiudad`.

**No se deduce del texto.** Deducir el nivel de si el título nombra una ciudad
habría sacado de la cuenta esos 25 hechos nacionales que ocurrieron en una
ciudad. Se declara en el registro, caso por caso, y los trece se pudieron
declarar leyendo su propio título y su propio «quién» —UNGRD, CNE, Fiscalía
General, Corte Suprema, la campaña presidencial de 2022, una consejera
presidencial, una ministra—, así que no hizo falta trinquete como el de
`tipoFuente` y la exigencia arranca en cero.

#### Sin declarar, el caso SIGUE pesando, y eso es deliberado

Un valor por omisión sería una afirmación que nadie escribió, y acá afirmaría
**de quién es una decisión**. Y poner «no pesa» por omisión habría cambiado en
silencio el veredicto publicado sobre dos personas el día del despliegue.

Así que la rama del campo ausente **no cambia nada** respecto de la v940 —hay
una aserción dedicada a eso, y las veinte aserciones anteriores de `tficha`
corren por esa rama porque su `caso()` no declara nivel— y la ficha **cuenta
cuántos están así** en vez de suponerles uno.

Lo que impide que esa rama fallida abierta la alcance un caso que pesa no es
un valor por defecto: es `revisar.js`, que le exige el nivel a todo caso
`confirmado` o `en-investigacion` —la misma guarda que ya les exige quién,
fecha y fuentes—. **Se falla cerrado estructuralmente, no por omisión**, que es
la decisión de la v926 con el `aviso` del PDF.

Y un nivel escrito con otra grafía —un «Municipal» con mayúscula— **no pesa** y
la tarjeta imprime el valor literal. Las dos direcciones son malas y hay que
elegir la visible: un caso que sale de la cuenta en silencio es peor que uno
que sale con el motivo escrito encima.

#### Dos pares de cuentas, porque no son la misma

`confirmados`/`enInvestigacion` es cuántos se MUESTRAN en cada grupo;
`pesanConf`/`pesanInv` es cuántos entran al techo. Con un solo par, un caso
municipal desaparecería del panel o pesaría igual, y las dos cosas son falsas:
se muestra entero, con su estado probatorio, y no cuenta. Es la decisión de la
v798 con `archivado` —«se ve, con etiqueta, y no pesa: borrar es esconder»—
aplicada a otro motivo.

#### Y la línea de la placa tenía que seguirlas

Salió al revisar quién más lee esas cuentas: `cuentasDe` —la línea que va
DEBAJO del veredicto en la placa, la que se lee de un vistazo— imprimía las
mostradas. Con un caso municipal confirmado habría dicho **«1 caso confirmado»
al lado de «Confiabilidad inquebrantable»**, que un lector lee como un error de
la ficha y no como una regla. Cuenta ahora las que pesan y, cuando difieren,
dice cuántas quedaron fuera y por qué: callarlo sería la mitad mansa del mismo
defecto. Es la clase de la v879 cazada antes de que divergiera.

### Lo que se midió y NO se hizo, con su precio

El pliego pide también que un hecho anterior al mandato no alimente el score.
**No se hizo, y el motivo es que el módulo declara lo contrario de sí mismo**:
el `_nota` de `casos` dice, desde que la sección existe, «casos atribuidos al
gobernante **o a su gobierno**», y el de Petro añade «o a su campaña».
Aplicarle la puerta del mandato sería cambiar el alcance del módulo, no
arreglar un defecto.

Y tiene precio medido: de los seis casos que pesan en el registro de Petro,
`cne-topes-campana` es sobre la campaña de 2022 —anterior a su posesión del 7
de agosto de 2022—, así que la puerta lo sacaría y su veredicto pasaría de
**«nada fiable» a «poco fiable»**. Eso cambia en público el juicio sobre una
persona real, y no es una decisión que se tome de paso a las cuatro de la
mañana. Queda medida, con su número, para quien la tome.

#### Y de ahí salió la otra mitad: `fecha` son dos fechas

Auditando eso apareció que `fecha` carga dos significados que coinciden en
casi todos los casos y **divergen justo donde importa**: es «cuándo una
autoridad se pronunció» —es lo que ordena y recorta la serie, o sea lo que
contesta «¿qué se sabía en esta fecha?»— y se venía leyendo también como
«cuándo pasó». El CNE ratificó en **2026** el exceso de topes de una campaña
de **2022**.

Hoy eso no rompe nada, porque nada compara esa fecha con la posesión. Rompería
el día que alguien escriba la puerta del mandato leyendo el campo equivocado.
Así que se separa antes: `fechaHecho` es opcional, se imprime solo cuando está
declarada y difiere, y el `_nota` de los dos registros dice cuál es cuál.

**No se rellenó en el registro**, y por la razón de siempre: la fuente fecha el
hecho de `cne-topes-campana` en «la campaña de 2022», sin día, y escribir uno
sería inventarlo. El precedente para cuando alguien lo llene ya está en el
propio registro: `lavado-tuso-sierra` usa `fecha` + `fechaTexto` + `_fechaAprox`
justamente para no afirmar un día que nadie publicó.

### La guarda de la guarda

Si `js/70` dejara de leer `nivelGobierno`, las dos comprobaciones nuevas
seguirían en verde sobre un campo muerto: estarían vigilando un dato que ya no
decide nada. Hay una tercera que exige que la ficha siga pasando los casos por
`entraAlVeredicto`. Es el patrón de la v878 con su propia lista de voseo.

### El material no existía, y el que sí existe es la guarda

Vigesimotercera vez. Los trece casos publicados son nacionales, así que contra
el registro de verdad la puerta **no tiene nada que rechazar** y las
aserciones pasarían sin medir nada. El fixture de `tficha` trae las cinco
ramas, y la primera aserción es de MATERIAL: que el caso municipal de prueba
sea un `confirmado` y **se muestre entero**, para que «no pesa» no pase por no
existir o por tener un estado que no pesaba de todas formas.

Y la del DOM es la guarda contra pasarse de avisar —como las de la v879, la
v882 y la v890—: con los trece declarados nacionales, la ficha real no imprime
el aviso ni marca ninguna tarjeta. Contra la v940 se cumple sola.

#### La aserción del DOM cazó mi propio lector

Salió roja con `aviso false · 0 tarjetas fuera`, o sea con las dos mitades que
nombra en verde. Lo que fallaba era la tercera: buscaba «decisión de nivel» en
**toda la ficha**, y la introducción del panel explica la regla con esas
mismas palabras. Estaba midiendo el párrafo que explica, no un caso rechazado.
Es la lección de la v854 —se busca DENTRO de la caja— y la volví a cometer.
Se corrigió mirando solo los pies de las tarjetas: más precisa, no más laxa.

### Demostrado contra la v940

Devolviendo **solo la decisión** —la puerta se queda declarada, porque es lo
que la suite necesita para LEER, que es la lección de la v875 sobre el `git
stash` completo—: cuatro en rojo con el estado viejo impreso.

```
✗ el mismo caso, declarado MUNICIPAL, no mueve el veredicto  — poco-fiable · fuera 0
✗ la razón que devuelve es la del nivel, no un false          — (vacía)
✗ un nivel con un valor que la ficha no conoce no pesa        — (vacía)
✗ uno nacional y uno municipal: se muestran dos y pesa uno    — 2 mostrados · 2 pesan · nada-fiable
```

La última es la que enseña lo que estaba en juego: contra la v940, **un caso
municipal empujaba el veredicto de «poco fiable» a «nada fiable»**.

Tres pasan a propósito y son guardas: el material, que un caso nacional siga
pesando, y que uno sin declarar siga pesando igual que antes.

### Lo que el pliego pide y esta versión NO hace

Queda escrito para que la tanda siguiente no vuelva a medirlo:

* **La categoría probatoria** —`hecho_probado` · `correlacion` ·
  `atribucion_causal` · `afirmacion_en_circulacion`—. No existe, y `tipoFuente`
  **no es eso**: mide la calidad de la FUENTE, no la clase de la afirmación.
  Son dos ejes y meterlos en uno es lo que el pliego prohíbe.
* **`tipo_medicion`** —actividad contra resultado—. «Cuatro operativos en un
  día» y «la criminalidad bajó» hoy son la misma clase de entrada.
* **`contrargumento_oficial`**, con `ausente` explícito. Ojo: `contrapunto` ya
  existe en 112 entradas y **es otra cosa** —es la advertencia metodológica de
  URBIS, no la respuesta del Gobierno—. Usarlo sería la homonimia que este
  proyecto persigue.
* **Los ejes B (deterioro institucional) y C (orientación del gasto)**, la
  normalización por 100 días y la capa editorial firmada. El propio pliego dice
  que el eje B no se puede publicar sin la media histórica de Petro, Duque y
  Santos: es trabajo de archivo, no de código.

## El ancho libre no es el ancho del andén (v942)

La cuarta de las seis plantillas de campo. La elección la decidió la misma
medición de siempre y esta vez separó limpio, porque las tres que quedaban no
empatan en lo que de verdad importa:

| Plantilla | ¿Otro camino ya lo hace? |
|---|---|
| **Estado de andenes por tramo** | **no** — el motor publica del andén EXACTAMENTE tres cifras |
| Conteo de alturas por manzana | **sí** — `building:levels` por el mapeo por edificio (v754) |
| Cupo real de equipamientos | no, pero no cierra ninguna carencia declarada |

Medido en `motor-reglas.js`: del andén salen `conAndenPct`, `sinAndenPct` y
`sinDatoPct`, y las tres dicen lo mismo —si OpenStreetMap REGISTRA un andén en
cada metro de vía—. **Ninguna dice cuánto mide, de qué es, cómo está ni qué lo
tapa.** Caminarlo con cinta es el único camino.

### El hallazgo: el destino de la plantilla estaba mal

La plantilla declara desde la v883 que se pega en «Movilidad real». Medido
contra el `panelVacio` de esa caja, **ese vacío pide rutas, paraderos,
frecuencias y aforos, y no dice una palabra de andenes**. Donde de verdad
aterriza es «El perfil de la calle», que es la caja que hoy imprime los tres
porcentajes.

No es un detalle de redacción: «Dónde se pega» es el campo que separa esta
plantilla de un anexo (v883), y apuntando al panel equivocado manda a quien
vuelve de la calle a buscar su dato donde no está.

### Dos medidas del mismo andén, y la segunda es siempre la menor

Es la distinción que decide todo lo demás. La plantilla del perfil (v939) mide
la **pieza de la sección** —de la cuneta al paramento—; esta mide **lo que
queda para caminar** después de los postes, las materas y las vitrinas.
Publicar una como la otra sería la clase de la v934, así que las dos se
guardan, las dos se imprimen y cada una dice cuál es.

Y el **mínimo** va al lado de la media, no como adorno: un andén se camina al
ancho de su punto más estrecho. En el sector de prueba sale 0,9 m de media con
un tramo de 0,6, y una media de 0,9 sin ese 0,6 describe un andén que no
existe — es la misma razón por la que la v880 imprime la moda al lado de la
media de pisos.

### Lo que NO se hace: llevar lo caminado a la red

Caminar dos tramos no dice nada de los otros noventa y ocho, así que los tres
porcentajes **no se tocan** y hay una aserción dedicada a que no se muevan.
Es lo mismo que la v939 declinó para el descuento de la calzada, y acá es más
tentador porque el número quedaría más redondo.

La carencia tampoco se borra, **y esa es la mitad que cuesta**: el porcentaje
de red sin dato sigue siendo cierto. Se SUMA lo caminado en vez de
sustituirlo — borrarlo sería la mentira contraria a la de la v861.

#### La frase vive en un solo sitio, porque la carencia tiene dos ramas

Salió al primer rojo y vale escribirlo: la carencia del perfil tiene una rama
para cuando la plantilla del perfil está levantada y otra para cuando no, y la
suite corre por la PRIMERA. Escribí el añadido solo en la segunda, así que la
aserción se puso roja midiendo una rama que no corre.

Las dos ramas llaman ahora a `anchoLibreDicho(pf)`. Y la primera es donde más
importa: es la única donde conviven las dos medidas del mismo andén, en metros
y a un palmo una de otra.

### Entra por el punto único que la v939 creó

No se abrió uno nuevo. `perfilDeLaCalle(trz)` ya es por donde pasan los siete
sitios que imprimen algo del andén, así que lo caminado va dentro de `anden` y
lo heredan sin que su autor se acuerde (v867). Un segundo punto habría sido la
clase B comprada a sabiendas, en la misma tanda en que se cita.

### La rampa es sí / no / en blanco, y el blanco no es un no

Lista **cerrada**, por la misma razón que el `sub` de la v932: con texto libre,
«no hay», «NO» y «ninguna» son tres valores distintos y el conteo deja de
contar. Lo que no case se lee como sin anotar, que es un estado y no un cero —
la decisión de la v939 con las piezas sin anotar de la sección.

Lo que obstruye y el material se listan **sin taxonomía**: son texto de quien
caminó, y agruparlos en categorías sería inventar una clasificación que la
plantilla impresa no tiene.

### Dónde vive cada rama

* **`tmasanalisis`** · sus vías traen `sidewalk`, así que el motor publica los
  tres porcentajes de red y se puede medir que lo caminado NO los mueve. En un
  sector sin una sola vía con andén registrado, «no los mueve» pasaría por no
  haber nada que mover. Ahí van la puerta, los tres rechazos y las cifras.
* **`tdoslaminas`** · sin plantilla caminada: la guarda de que la hoja no
  inventa un ancho libre donde nadie caminó.

Cada rechazo dice **su** causa —falta el ancho, eso no es un número, falta el
nombre del tramo—, que es la regla de la v934: un solo mensaje manda a revisar
lo que está bien.

#### Y la guarda cazó una ambigüedad de verdad

La primera versión buscaba «ancho libre» en toda la hoja B y salió roja. No
era un fallo del código: **la plantilla EN BLANCO describe con esas mismas
palabras lo que va a medir**. Lo que no puede aparecer sin material es la
CIFRA —el rótulo de la fila y la prosa de la ficha—, así que la guarda busca
la forma medida y no la palabra. Es la lección de la v854 otra vez.

### Demostrado contra la v941

Revirtiendo **solo lo que imprime** —la puerta y el almacén se quedan, porque
son lo que la suite necesita para LEER (v875)—: seis en rojo con el estado
viejo impreso.

```
✗ dos tramos caminados quedan con su ancho libre  — undefined tramos · undefined m
✗ y el MÁS ESTRECHO va al lado de la media        — mínimo undefined
✗ la rampa se cuenta en sí / no                   — con undefined · sin undefined
✗ la ficha imprime el ancho libre                 — no lo dice
✗ y el papel lleva el ancho libre                 — no está
✗ el papel dice que extrapolar sería extrapolar   — no lo dice
```

### Lo que esta plantilla NO cierra, medido

El **estado** del andén —bueno, regular, malo— se guarda y se imprime, pero es
un JUICIO y el propio método de la plantilla lo dice desde la v883: «dos
personas califican distinto el mismo andén». No se cuenta ni se promedia, y no
se convierte en una cifra de sector: eso pediría una escala acordada antes de
salir, que es trabajo de curso y no de código.

Quedan **dos** plantillas por conectar —«Conteo de alturas por manzana», que
tiene otro camino, y «Cupo real de equipamientos»— y las tres de percepción,
que además necesitan entrar en `huecosDeCampo` antes de tener formulario.

## El cupo se pregunta en portería, y no se extrapola (v943)

La quinta de las seis plantillas de campo, y la elección **corrigió una nota
mía de la v940**. Aquella tabla decía que «Cupo real de equipamientos» no
cierra ninguna carencia declarada, porque «Quién queda por fuera» nombra otro
refinamiento —la población por manzana cruzada con cada radio—. Falso: la
conclusión de la banda de campo nombra el cupo con todas las letras, al lado
de las dos que ya están hechas:

> las carencias que cierran —la frecuencia de las rutas, el perfil acotado,
> **el cupo**— siguen abiertas hasta que alguien las llene en la calle.

O sea que era la única que quedaba de esas tres, y la nota que la apartaba se
escribió mirando un panel y no la hoja entera. Es la misma forma de las cinco
declaraciones de ausencia falsas (v861 a v888): **se midió un sitio y se
concluyó sobre todos**.

### Llegar y tener puesto son dos preguntas, y no se suman

`pctSinCubrir` mide si se puede **llegar** caminando; el cupo, si hay
**puesto** al llegar. Un colegio a 300 m y lleno cubre en el mapa y no en la
práctica — que es la frase que la hoja de déficit de Visión Territorial ya usa
desde la v926, por el mismo motivo y en otro módulo.

Sumarlas daría una tercera cifra que no mide ninguna de las dos. Así que el
cupo se imprime **al lado** de la tabla de cobertura, con su propia frase, y
la tabla no cambia una sola celda. Es la decisión de la v934 con el paramento
y la de la v939 con el perfil: las dos cifras existen, cada una se nombra, y
ninguna se tira.

### El denominador es lo que impide leerlo como una medición del sector

Preguntarle el cupo a **dos de cuarenta** y a **dos de dos** son cosas
distintas, y sin el denominador se leen igual. Sale de
`accesibilidad.categorias[].puntos` —el mismo campo con el que la v875
descubrió que un 100 % podía ser una capa vacía—, así que no hizo falta tocar
el motor.

Con N de M preguntados la frase dice, con esas palabras, que **no se puede
decir cuánta gente tiene puesto**: llevar el cupo de dos equipamientos al
sector entero sería extrapolar. Y con todos preguntados dice la otra mitad,
que también hay que decir: la suma es la del sector y **sigue sin ser la de
quien de verdad los usa**, que puede venir de otro barrio.

Es la misma acotación que la v942 escribió para el ancho libre y la v939 para
el perfil. La regla, ya en tres tandas: **lo levantado en campo se publica con
su denominador y ahí para.**

### La única plantilla con atribución POR FILA

Las otras cinco guardan un solo `quien` —quien caminó la cuadra, quien midió
los tramos, quien se sentó en la parada—. Esta no, y no es un capricho de esta
tanda: la v883 le puso columna «Quién informó» **a esta sola de las seis**,
justamente porque cada cupo lo dice una portería distinta.

Así que la entrada guarda las dos cosas y significan cosas distintas:

| | Qué es |
|---|---|
| `quien` de la entrada | quien hizo la ronda y responde por la plantilla |
| `informo` de cada fila | quién contestó en ESA portería |

Y las filas que no lo traen **se cuentan y se dicen**: «2 filas no dicen quién
informó, y sin eso el cupo no se puede volver a preguntar». Un cupo sin su
fuente no se puede verificar ni actualizar, que es lo que lo separa de un
número recordado.

Este es el precedente que la v934 y la v939 dejaron identificado para el día
que dos personas se repartan una plantilla — y ahora está escrito y probado en
una de ellas, en vez de solo nombrado.

### Tres rechazos, cada uno con su causa

Como en la v934 y la v940: un solo mensaje manda a revisar lo que está bien.
Falta el nombre —sin él no se puede volver a preguntar—, el cupo no es un
número mayor que cero, o no hay ni una fila. Son tres cosas distintas para
quien está escribiendo.

### Dónde vive cada rama

* **`tmasanalisis`** · tiene equipamientos mapeados, así que el denominador
  existe y la frase puede decir «2 de N». Ahí viven la puerta, los tres
  rechazos y la atribución por fila.
* **`tdoslaminas`** · ningún cupo preguntado: ahí vive la guarda —sin
  plantilla, la hoja no inventa una cifra de puestos ni dice quién informó—.

Sin la segunda, un «preguntado en portería» puesto en todas partes pasaría
igual. La guarda de material va primero en las dos (v920).

### Demostrado contra la v942

Revirtiendo **solo lo que imprime** —la puerta y el almacén se quedan, porque
son lo que la suite necesita para LEER (v875)—: tres en rojo con el estado
viejo impreso.

```
✗ el papel imprime los puestos al lado de la cobertura        — no está
✗ y dice que llegar caminando y tener puesto son DOS preguntas — no lo dice
✗ con 2 de N preguntados NO afirma cuánta gente tiene puesto   — lo declara
```

### Lo que esta plantilla NO cierra, medido

La carencia de «Quién queda por fuera» **se queda entera**, y no por descuido:
lo que declara faltando es la población por manzana cruzada con cada radio —el
supuesto de que la gente se reparte por igual sobre la superficie—, y eso el
cupo no lo toca. Encogerla porque llegó una plantilla de otra cosa sería la
mentira contraria a la v861.

Queda **una** plantilla por conectar —«Conteo de alturas por manzana», que
tiene otro camino ya medido— y las tres de percepción, que además necesitan
entrar en `huecosDeCampo` antes de tener formulario.

## La sexta plantilla no se conecta, y eso se declara (v944)

La última de las seis, y la medición dice que **NO se conecte**. Es la primera
vez en esta serie que el resultado de medir es no escribir la puerta, y por eso
vale escribir por qué.

### Cuatro de las cinco columnas ya tienen sitio, con más precisión

Leído `EDIF.leer` en `js/04` en vez de recordarlo (v863), la ficha del mapeo
por edificio devuelve `pisos`, `pisosRegistrados`, `usosPorPiso` y
**`plantaBaja`**, cada uno con su punto y su fecha, y `edificiosDeCampo` los
cuenta para post-sector desde la v754. Contra las cinco columnas de la
plantilla:

| Columna | Dónde ya vive |
|---|---|
| Manzana · Lado o dirección | el punto, que ubica mejor que «lado de la manzana» |
| Pisos | `pisos` + `pisosRegistrados` |
| Uso en planta baja | `plantaBaja`, y de ahí sale `frenteActivo` |
| **Observación** | **en ninguna parte** |

Así que una puerta propia sería una segunda ruta para el mismo hecho — la
**clase B** a sabiendas, en la misma serie de tandas en que se nombró. Y la
prueba de la clase lo confirma: *no existe un cambio razonable que deba mover
el conteo de pisos de una manera en el mapeo y de otra en la plantilla.*

Las notas de la v940 y la v942 ya lo decían. Lo que ninguna de las dos hizo es
lo que faltaba de verdad.

### La plantilla no decía CÓMO entra su dato

«Dónde se pega» dice a qué panel llega la cifra —«Potencial edificatorio» y el
mapa de alturas— y eso es cierto. Lo que no dice es dónde se teclea, y para
esta plantilla la respuesta no es la de las otras cinco.

Quien la llena caminando busca un formulario, no lo encuentra, y la hoja se
queda en la carpeta — que es exactamente lo que la v883 quiso evitar al
separarla de un anexo. Ahora la hoja lo dice:

> Lo levantado se teclea en la ficha del sector, pestaña General, en «Lo que se
> levanta en la calle»: 5 tienen ahí su formulario. «Conteo de alturas por
> manzana» no: entra punto por punto, con el mapeo por edificio.

Y en la ficha, la sexta aparece **entre las otras cinco** con su renglón en
verde en vez de faltar: verde y no ámbar, porque no es un vacío, es otra ruta
(v880).

### El conteo iba TECLEADO debajo de un comentario que decía que se calculaba

`var conectadas = 5`, y encima:

> El conteo de puertas SE CALCULA y no se teclea: escrito a mano dentro de la
> frase es una cifra que envejece sola.

Es la falta de la v926 con la marca de capacidad: **un comentario que afirma
una propiedad que el código no tiene**, y que se lee como si la tuviera.

Ahora hay un registro, `PUERTAS_DE_PLANTILLA`, donde cada `htmlPuertaX` se
apunta al declararse, y de él salen **el conteo y el render**. Una puerta nueva
sube la cifra sin que su autor se acuerde, y no puede haber una que se pinte y
no se cuente — que es lo que pasa con dos listas (v879). El bloque de la ficha
recorre la LISTA en vez de llamar a cinco funciones escritas a mano.

### La frase va donde no cuesta papel, y eso se midió

Aquí la medición cambió el diseño tres veces, y cada vuelta está en el número.
La regla de la v919 —una decisión de espacio se juzga midiendo las dos
composiciones— con el piso de 45 mm de `tlaminaedu` como vara:

| Dónde va «dónde se teclea» | Parada | Acostada |
|---|---|---|
| v943, sin decirlo | 50,7 · 48,7 | 50 · **45,1** |
| celda propia bajo las SEIS | 57,1 · **40,8** | — |
| celda propia bajo la sexta | 52,4 · 45,5 | 50,7 · **44,3** |
| dentro de «dónde se pega» de la sexta | 52,4 · 45,5 | 50,7 · **44,3** |
| **en la conclusión de la banda** | **50 · 47,9** | **50 · 45,1** |

La última fila es **exactamente el baseline**: cuesta cero. Las otras bajan
tres plantillas por debajo del piso, y una plantilla que no se lee no se llena.

Dos cosas que la tabla enseña y no se deducen leyendo:

* **la hoja acostada tenía 0,1 mm de margen** en ese piso antes de esta tanda.
  Cualquier renglón nuevo bajo una caja de campo la rompe, y eso no lo
  introdujo la v944: estaba así desde antes y ahora está medido;
* **repetir la misma frase bajo las seis cuesta más que decirla una vez**, que
  es la regla de la v877 con el método de los mapas de categoría —ocho párrafos
  idénticos en la banda más grande de la hoja—, ahora con su precio en
  milímetros.

Y lo que **no** llega al papel es `noCarga` —que la columna de observación no
tiene dónde aterrizar—: gana un renglón en la acostada y se lleva las tres
plantillas a 44,4. Su lector es quien TECLEA, y ahí sí está impresa, en el
bloque de la ficha, donde no cuesta papel.

De paso salió una regla de CSS muerta: la clase que se escribió para la celda
propia se quedó sin un solo elemento al mover la frase. Se retiró, que es lo
que la v885 enseñó sobre dejar código que nadie llama.

### Demostrado contra la v943

Revirtiendo **solo lo que imprime** —el registro, `via` y lo que `estado()`
expone se quedan, porque son lo que la suite necesita para LEER (v875)—:

```
✗ el bloque cuenta las que tienen puerta, y no dice un número tecleado  — conectadas 5
✗ y nombra la que entra por otro camino, con dónde se teclea            — la deja sin nombrar
✗ parada: la banda dice dónde se teclea y nombra la que entra por otro  — no lo dice
✗ acostada: la banda dice dónde se teclea y nombra la que entra por otro — no lo dice
```

Tres pasan a propósito y son guardas o material, no afirmaciones nuevas: que
las seis se lean con cinco puertas registradas, que ninguna de las cinco se
declare como de otro camino, y que la frase **no** se repita bajo cada
plantilla — sin esa última, el arreglo podría ser imprimirla seis veces, que
es justo lo que la tabla de arriba desaconseja.

### Las seis, cerradas

Quedan los **tres paneles de percepción**, que además necesitan entrar en
`huecosDeCampo` antes de tener formulario: hoy el almacén no los acepta.

## El pretérito en -ste es tuteo, y nadie lo miraba (v945)

Salió abriendo `js/68` para medir los tres paneles de percepción, que es la
tanda siguiente. En la caja «Percepción del lugar», impresa en la lámina de
60 × 90:

> A la hora que **fuiste**, con los cinco sentidos: anote día y hora…

Tuteo y usted en la MISMA frase, que es como se ven las cosas cuando alguien
corrigió medio aviso. Es el mismo hallazgo de la v914 con los dos `imprimí`, y
por la misma vía: se abre un archivo para otra cosa y el defecto está ahí.

### Y la guarda no podía verlo, por construcción

La de la v909 cubre **dos** familias estructurales —los pronombres y el futuro
en -ás— y su propio mensaje de éxito lo declara: *«el presente y los
imperativos NO se pueden separar de la tercera persona y esa mitad no la cubre
nadie»*.

Lo que ninguna de las dos tandas midió es que hay una **tercera** familia que
sí se puede separar: **en castellano `-ste` no es desinencia de ninguna otra
persona.** «Fuiste», «marcaste», «viste» solo pueden ser tú; la primera es
«fui», «marqué», «vi», y la tercera «fue», «marcó», «vio». No hay ambigüedad
que resolver.

Lo que colisiona no son otras personas: son **sustantivos y adjetivos** —este,
oeste, celeste, chiste, poste, ajuste— y los verbos en **-sistir / -sestar**,
que en tercera persona acaban igual: existe, consiste, insiste, persiste. Esos
se listan, como `NO_ES_FUTURO`: se lista lo permitido y se denuncia todo lo
demás, que es la forma de la guarda del voseo en -á (v880).

### Un identificador se descarta por la FORMA, no con un renglón de lista

El primer barrido denunció `urbisProCityGeoAjuste`, que vive dentro de un
`oninput` y por tanto dentro de una cadena. Meterlo en la lista habría sido
empezar a coleccionar identificadores.

**Una mayúscula DENTRO de la palabra no existe en la prosa castellana.** Así
que se descarta por eso, y un identificador nuevo no cuesta una excepción. Va
después de la lista de permitidas y antes de denunciar.

La única excepción que sí quedó es `'ganaste'`, y con su razón escrita al lado:
es la **clave** con la que se guarda un aviso de premio —la v909 la dejó
anotada como lo que no se toca, porque cambiarla deja mudos los avisos que una
persona ya tiene guardados—. El título que sí se lee ya hablaba de usted.

### Diez en el módulo educativo, corregidos uno por uno

Medidos dentro de cadenas: quince denuncias, y de ellas **diez son texto que
ve el usuario**, todas en `js/68`:

| Salía | Dice |
|---|---|
| el centro del trazo guardado que **abriste** | que **abrió** |
| A la hora que **fuiste** | A la hora en la que **estuvo** |
| lo que **trazaste**. Si lo **redibujas**, vuelve a tocar | lo que **trazó**. Si lo **vuelve a dibujar**, **toque** otra vez |
| De dónde los **sacaste** | De dónde los **sacó** |
| si **leíste** la foto | si **leyó** la foto |
| Seguir donde **quedaste** (×2) | Seguir donde **quedó** |
| **Cambiaste** de área | **Cambió** de área |
| Todavía no **analizaste** ningún sector | Todavía no **ha analizado** ningún sector |
| Cada sector que **analizaste** | Cada sector que **analizó** |

**Uno por uno y no con un reemplazo masivo**, que es la lección de la v878: la
tercera fila no se arregla cambiando una palabra —«redibujas» es presente de tú
y «vuelve a tocar» es un imperativo que también cambia—, y un barrido que solo
mirara el `-ste` habría dejado media frase en tuteo.

Una suite citaba el texto viejo (`torigen`, «De dónde los sacaste») y se
actualizó, como las catorce de la v878 y las ocho de la v909.

### La guarda se defiende sola

Si la regla nueva se quedara sin morder —una lista de permitidas que se coma el
caso, un `continue` de más— todo seguiría en verde y nadie se enteraría. Hay
una comprobación aparte, contra casos de respuesta conocida: que `fuiste`,
`marcaste` y `leíste` se denuncien, y que `este`, `existe`, `noreste` y
`urbisProCityGeoAjuste` no. Es el patrón de la v878 con su propia lista de
voseo.

Y el mensaje de éxito se corrigió: ahora dice que son **tres** las familias
estructurales, no dos. Una guarda que declara cubrir menos de lo que cubre es
tan engañosa como una que declara cubrir más.

### Lo que sigue sin cubrirse, y queda dicho

El **presente** y los **imperativos** de tú siguen sin regla, y por la razón
que la v909 ya escribió: la forma de tú es idéntica a la de tercera persona, y
a veces a un sustantivo. «Marca el punto» y «la app marca el punto» se escriben
igual. Esa mitad se caza leyendo, como se cazó «redibujas» acá.

## La percepción se guarda y no recalcula (v946)

Los tres paneles de percepción —«Percepción del lugar», «Lo que no cambia»,
«Voces de quien vive acá»—, que eran lo último que quedaba de la banda de
campo. La instrucción era clara: **primero al almacén, después el
formulario.** Y la medición partió la tanda en dos mitades que hay que
separar, porque una sola de ellas es una mentira en cada dirección.

### Lo que se GUARDA y lo que RECALCULA no son lo mismo

Hasta la v945, `huecosDeCampo` decidía las dos cosas a la vez: lo que el
almacén acepta y lo que habilita análisis post-sector. Para las seis
plantillas y los cuatro vacíos eso era correcto — los diez levantan una cifra.
Para estos tres no, y el propio mensaje de `tieneCampo` lo dice desde la v929:

> El análisis post-sector se habilita con el primer dato de campo: **un
> edificio mapeado con sus pisos, una plantilla llena o un vacío cerrado con
> su trámite.**

Una percepción no es ninguna de las tres. No suma un elemento, no cierra un
hueco de cifra y no mueve un solo número: **la corrida post sería idéntica a
la del sector en todas sus cifras.** Declararla post-sector sería declarar una
procedencia que no está (v867) — y la más fácil de creer de todas, porque el
rótulo suena a que algo se midió.

Lo que sí cambia es la HOJA, que pasa de una caja en blanco a lo que alguien
anotó con su nombre y su fecha. Son dos cosas distintas, así que hay dos
puertas: `esHuecoConocido` dice **qué acepta el almacén**,
`cuentaParaPostSector` dice **qué recalcula**.

Y no guardarlas tampoco era opción: hasta acá, lo que un estudiante anotaba
caminando vivía en el papel y se perdía al cerrar la ficha.

#### El mensaje distingue las dos ausencias

Con SOLO percepción anotada, decir lo mismo que cuando no hay nada juntaría
dos situaciones que piden cosas distintas (v876, v899). La razón lo dice
entero:

> Lo anotado acá —Voces de quien vive acá— se guarda y sale en la hoja, y no
> habilita post-sector: no cambia ninguna cifra, así que la corrida volvería a
> dar exactamente lo mismo.

### «9 paneles de percepción» sobre una banda que trae tres

Salió al abrir la lista, y estaba impreso. La conclusión de la banda de campo
contaba `PANELES_DE_CAMPO` —que son los tres de percepción **más las seis
plantillas**— bajo la frase «N paneles de percepción».

Es exactamente la clase de la v903 §8 —«trae tres paneles» y eran siete— y
esta vez la causa es más fina: **una lista cuyo nombre sugiere una de las dos
cosas que contiene.** El conteo se calculaba, que es lo que la v903 pidió; lo
que no se había medido es qué cuenta.

La comprobación vive en `tdoslaminas` y **no** en `tlaminaedu`: esa frase solo
se imprime cuando el sector no tiene campo comparado, y el sector de
`tlaminaedu` sí lo tiene — allá la aserción habría pasado por no tener nada
que rechazar. Es el agujero que este proyecto lleva veintitrés tandas
persiguiendo, y esta vez se vio antes de escribirla, no después. Con su guarda
de material primero (v920).

### Los tres slugs eran una segunda lista

`PANELES_DE_CAMPO` los traía escritos a mano —`'percepcion-del-lugar'`…— y sus
títulos vivían en sus `caja(...)`. Dos listas de lo mismo, y bastaba renombrar
una caja para separarlas: es el fallo de la v878 y lo que la v933 corrigió
para los cinco vacíos. Ahora van por su TÍTULO y el id se deriva.

Eso destapó de paso la cola del mismo defecto: `nombreDeHueco` no conocía los
tres, así que deshacía el slug a mano e imprimía **«Voces de quien vive aca»**,
sin tilde — la misma falta que la v933 encontró con «Informacion legal del
predio». El título es el que manda; el slug sale de él y no al revés.

### La puerta: un bloque para los tres

Por lo mismo que la v932 juntó las tres puertas de vacío: quien vuelve de una
salida vuelve con las tres cosas anotadas el mismo día, y repartirlas en tres
sitios es lo que hace que se guarde una y se olviden dos.

Los campos son **los mismos renglones que la lámina imprime en blanco**, no
una lista nueva: lo que se llena caminando es lo que se teclea después, y dos
listas para eso se separarían a la tanda siguiente (v879).

Y el panel lo dice con todas las letras, donde alguien lo va a leer antes de
escribir: *«No habilita análisis post-sector, y no es un descuido: una
percepción no cambia ninguna cifra, así que volver a correr el análisis daría
exactamente lo mismo.»*

#### `.pcr-vac-f` la cuentan dos bloques

La primera versión reusó la clase de los vacíos y `tpostsector` saltó en el
acto: **10 filas donde espera 7**. Es la lección de la v874 con `.hit` —dos
cajas comparten una clase y `querySelectorAll` mezcla las dos listas—, cazada
por una prueba que existía desde la v932. Los renglones de percepción llevan
`pcr-perc-f`; el verde de «ya quedó anotado» sí es el mismo, porque significa
lo mismo.

### Las guardas, en las dos direcciones

Sin la primera se pierde lo que alguien anotó caminando; sin la segunda, un
sector se declara recalculado por tres frases. En `revisar.js`:

* el almacén acepta los tres —`huecosDeCampo` los concatena—;
* ninguno habilita post-sector —`cuentaParaPostSector` los excluye por la
  lista—;
* y la guarda de la guarda: `tieneCampo` sigue pasando cada entrada por esa
  puerta. Sin ella, las dos de arriba seguirían en verde sobre una regla que
  nadie aplica (v878).

En `tpostsector`, las dos ramas en la misma corrida: que una percepción se
acepte y quede legible, que ninguna de las tres cuente, y —la que de verdad
guarda— que un sector con **solo** percepción no tenga post-sector y que la
razón diga por qué. Más una contra el código muerto: que los tres se pinten en
la ficha, porque un almacén que acepta algo sin manera de escribirlo es código
que nadie llama (v885).

De paso, un detalle de aserción que mentía: el de «ninguno habilita
post-sector» imprimía «los excluye por la lista» **también en rojo**, que es
justo cuando hace falta leerlo. Ahora enseña lo que encontró.

### Demostrado contra la v945

Revirtiendo **solo lo que decide** —el inventario, la puerta y lo que
`estado()` expone se quedan, porque son lo que la suite necesita para LEER
(v875)—: ocho en rojo con el estado viejo impreso.

```
✗ el almacén acepta una percepción   — El hueco «percepcion-del-lugar» no está en el inventario
✗ queda anotada y legible            — 0 anotadas
✗ y NINGUNA cuenta para post-sector  — [true,true,true]
✗ un sector con SOLO percepción…     — hay=false · fuentes=0 · percepción=0
✗ y la razón dice que no cambia…     — «…una plantilla llena o un vacío cerrado con su trámite.»
✗ el conteo de paneles de percepción — 9 paneles de percepción
✗ el almacén acepta los tres          — huecosDeCampo NO los conoce
✗ y NINGUNO habilita post-sector      — cuentaParaPostSector NO mira la lista
```

Dos pasan a propósito y son material o guarda: que los tres estén en el
inventario y que se pinten en la ficha.

### Lo que esta versión NO hace

**La lámina no imprime todavía lo anotado**: las tres cajas siguen saliendo en
blanco. Es otra tanda y por una razón medida, no por olvido — la v944 dejó
escrito que la hoja acostada tiene **0,1 mm de margen** en el piso de 45 mm de
las cajas de campo, y llenar tres cajas de texto donde había renglones vacíos
cambia su alto. Eso hay que medirlo contra las dos orientaciones antes de
publicarlo, con la corrida completa, y no de paso.

Con esto cierran las seis plantillas y los tres paneles de percepción; queda
la vista de escritorio, que leerá el mismo `S.corrida` en vez de tener el suyo.

## Lo que cuesta imprimir en la hoja lo anotado (v947)

La v946 dejó la mitad que faltaba escrita como tarea: las tres cajas de
percepción se guardan en la ficha y **la lámina las sigue imprimiendo en
blanco**. Esta tanda la midió entera, y el resultado es un precio que no me
toca pagar a mí: queda escrito con su número, y la decisión es de quien tiene
el pliego en la mano.

**No se publicó el cambio.** Lo único que queda de la tanda es el accesor que
la medición necesitó.

### El precio, medido en las dos orientaciones

Con una sola de las tres cajas llena, y el piso de 45 mm de las cajas de campo
como vara:

| | Parada | Acostada |
|---|---|---|
| v946, las tres en blanco | 50 · **47,9** | 50 · **45,1** |
| con UNA caja llena | 45,9 · **42,1** | 43,9 · **38,9** |

Las tres plantillas de la segunda fila —«Rutas observadas», «Cupo real»,
«Actividad en primer piso»— caen **por debajo del piso**, en las dos
orientaciones. Una plantilla bajo ese piso no se puede llenar a mano, que es
para lo único que existe.

### Y no hay una versión barata: se probaron cuatro

Cada una se midió por separado, que es la regla de la v919 —una decisión de
espacio se juzga midiendo las dos composiciones—:

| Qué se probó | Resultado |
|---|---|
| Tres renglones anotados | 42,1 · 38,9 |
| **Un solo** renglón anotado | 42,1 · 38,9 — **idéntico** |
| Sin la línea de procedencia | 42,1 · 38,9 — idéntico |
| Conservando la forma de la caja (el texto sobre el renglón que le toca, en vez de un bloque aparte) | 42,1 · 38,9 — idéntico |
| La entrada guardada y la caja impresa en blanco | 47,9 · 45,1 — **el baseline exacto** |

La última fila es la que cierra el caso: **guardar no cuesta nada; imprimir
sí.** Y las tres de arriba dicen por qué no hay atajo: no es el texto, no es
la procedencia y no es la forma de la caja. **Es que un renglón escrito es más
alto que un renglón en blanco**, y basta con que una fila crezca lo suficiente
para que la banda se recomponga. Pasado ese umbral, escribir más no cuesta
más — el precio es un escalón, no una pendiente.

### Por qué no lo tomé yo

Las dos salidas son reales y las dos pierden algo:

* **imprimirlo** y aceptar tres plantillas ilegibles — y la hoja se imprime
  justamente para llenarlas;
* **no imprimirlo** y que el papel que sale del edificio no diga lo que
  alguien fue a anotar, mientras la ficha sí lo tiene.

Aflojar el piso para que quepa no es una tercera salida: es la aserción que se
afloja para que pase, y este repositorio tiene escrito desde el principio que
eso es perder la prueba entera. Tampoco lo es recortar la frase anotada: el
precio es el mismo con un renglón.

Hay una tercera posibilidad que no se midió porque inventarla sola sería
justamente lo que la v882 y la v886 deshicieron —un arreglo estructural sin
causa—: que la hoja se pueda componer **como registro** en vez de como
formulario, y que en ese modo las plantillas en blanco cedan su sitio. Eso es
una opción de producto, no un ajuste, y la decide quien usa el pliego.

### Lo que sí quedó

`estado()` expone `llaveSector`. Lo necesitó la medición para escribirle al
almacén desde una suite, y reconstruir la llave afuera habría sido la segunda
ruta de cálculo de la v879 — que ya se cobró en la v939, con un
`llaveDeSector()` sin argumento que devolvía cadena vacía y no lo decía: el
almacén simplemente no encontraba nada, y la puerta parecía guardar.

## El nombre de una versión dice lo que hizo (v948)

Corrección de la tanda anterior, y de las baratas que conviene no dejar pasar.

La v947 se publicó con el token `947-la-caja-llena-imprime-lo-anotado` — el
nombre con el que se empezó a trabajar— y esa versión hace exactamente lo
contrario: **midió lo que costaba imprimirlo y decidió no publicarlo.** El
nombre se quedó del plan y no del resultado.

Es la clase que este repositorio persigue desde la v926: **un rótulo que
afirma una propiedad que el código no tiene**, y que se lee como si la
tuviera. Acá con dos lectores: la sesión siguiente, que lee los tokens para
saber qué se hizo, y el caché de un teléfono, que los usa como llave.

Y no se arregla renombrando dentro del mismo número: `revisar.js` lo rechaza
con razón —«origin/main ya va en 947-…»— porque esa versión ya está en la
calle. Se sube por encima, nunca bajando la propia, que es la regla del 7 de
septiembre.

**La lección para la próxima:** el token se escribe cuando la tanda cierra, no
cuando empieza. Una tanda cuyo resultado es una medición y una decisión de no
hacer necesita un nombre que diga eso.

## Quién midió CADA fila (v951)

La columna que la v934 y la v939 dejaron anotada como «su propia tanda», con
su razón escrita: *«si dos personas miden tramos distintos, la entrada guarda
un solo `quien`… cambiar las columnas cambia la plantilla impresa y sus
aserciones en `tlaminaedu`»*.

**Medida antes de tocar nada, esa razón no se sostenía.** La séptima columna
cuesta **cero milímetros de papel**, y las aserciones de `tlaminaedu` ni se
mueven —piden `columnas >= 5` y `celdas >= 35`, y pasan de 6/48 a 7/56—:

| | Parada | Acostada |
|---|---|---|
| v948, seis columnas | 50 · 50 · 50 · 47,9 · 47,9 · 47,9 | 50 · 50 · 50 · 45,1 · 45,1 · 45,1 |
| con la columna en UNA plantilla | **idéntico** | **idéntico** |
| con la columna en las CUATRO | **idéntico** | **idéntico** |

Lo que sí cuesta es hacerlo en las cuatro. Y se hace en las cuatro.

### Son cuatro puertas, no una, y el precedente ya estaba

El usuario nombró el perfil vial. Medido, **las cuatro plantillas que se
CAMINAN tienen la misma forma**: el perfil, los andenes, las rutas y el
paramento. La quinta —el cupo— la tiene desde la v883, y la sexta no tiene
puerta (v944).

Arreglar una sola habría dejado **cinco puertas con dos comportamientos**, que
es exactamente lo que la v940 declinó hacer por esa misma razón. Y las rutas
son el caso más claro de todos: con «30 minutos por parada y por franja», ocho
filas son cuatro horas — repartirlas no es el caso raro, es el normal.

### No es el `informo` del cupo, aunque la columna se parezca

La distinción decide el texto y las cuentas, así que va escrita en el
ayudante:

* en el **cupo**, el nombre es la **FUENTE** de la cifra —la portería que la
  dijo— y una fila sin él es un hueco: la cifra queda sin a quién volver a
  preguntarle, y por eso el cupo las cuenta y lo dice;
* en las cuatro caminadas es quien la **MIDIÓ**, y una fila en blanco **no es
  un hueco**: significa que la midió quien responde por la plantilla, que es
  lo que el propio formulario declara al lado de la casilla.

Por eso `quienesDeFilas` devuelve **nombres y no una frase**, y por eso el
campo del pie pasó a llamarse «Quién responde por la plantilla»: sigue siendo
obligatorio y sigue siendo el respaldo, pero ya no afirma haber medido las
ocho filas.

**Una entrada guardada antes de esta versión no pierde nada ni se asciende a
lo que nadie escribió** (v931): sus filas no traen nombre, así que todas caen
en el `quien` de la entrada — que es exactamente lo que esa entrada afirmaba.

### La asimetría que apareció al escribir la prueba

Tres de las cuatro publican una cifra que sale de TODAS las filas —el perfil y
los andenes promedian, las rutas dan una cifra por fila—, así que su
procedencia es la lista entera.

**El paramento no.** Su casilla está rotulada a escala de **predio** y publica
la cifra de UNA fila, la cuadra del lote (v854). Atribuirle la lista le
pondría a los 43 % que midió Marta el nombre de Luis, que midió otra cuadra:
es la falta de la v867 —declarar mal la procedencia— con la ropa de una
mejora. Su `quienTexto` sale de la fila marcada, y la lista se conserva al
lado para que la puerta pueda decir que la plantilla se repartió.

No se vio leyendo: se vio al escribir la aserción.

### La guarda, en las dos mitades

En `revisar.js`, y falla CERRADO: una plantilla caminada nueva que no llame al
ayudante sale en rojo en su primera composición, en vez de tres tandas después
(es el canje de la v880 con la guarda del voseo).

* las cuatro `*DeCampo` resuelven la atribución por `quienesDeFilas`;
* y la guarda de la guarda: `quienesDeFilas` sigue leyendo `f.quien`. Sin
  ella, las cuatro seguirían llamándolo y la de arriba seguiría en verde sobre
  un ayudante que devuelve siempre el de la entrada (v878).

Demostradas en las dos direcciones, con archivo y renglón.

### De paso, un enlace que se iba a escribir dos veces

`conComaY` escapa lo que une, y la frase de la procedencia la escapa el
llamador. Escribir el enlace otra vez habría sido la clase B en la misma tanda
en que se cita, y una de las dos copias escaparía dos veces — que es el
«Colegio o jard&amp;iacute;n» de la v902. Se partió en `unirConY` (une) y
`conComaY` (escapa y une).

### El material tuvo que rehacerse dos veces, y las dos por medir

Vigesimocuarta vez, y las dos veces lo cazó la guarda de MATERIAL:

* **el botón de la pestaña estaba desprendido.** `pintar()` rehace el panel,
  así que el nodo guardado veinte líneas antes ya no estaba en el documento y
  hacerle clic no hacía nada. Salió como «1 filas» donde la aserción esperaba
  dos.
* **y la aserción del paramento pasaba por el motivo equivocado.** Con el
  `quien` de la entrada igual al de la fila marcada, «firmado por Ana Ruiz»
  salía bien con el código viejo y con el nuevo. Se arregló el MATERIAL y no
  la aserción: la cuadra marcada la mide **Marta**, que no es quien responde
  por la plantilla, y así los dos errores posibles se distinguen —la lista
  entera da «Marta Peña y Luis Ortega», el de la entrada da «Ana Ruiz»—.

### Y un defecto que salió al medir, declarado y no arreglado

**Una plantilla ya guardada no se puede ampliar.** Con la entrada en estado
«ok» la puerta muestra el resumen y el botón de quitar, sin formulario; y un
rechazo no guarda nada, así que desde una plantilla recién vaciada no se pasa
de los dos renglones que ofrece. Para anotar una cuadra más hay que quitar lo
anotado y volver a escribir todo.

Es la misma familia del defecto que la v940 dejó declarado —el formulario que
se vacía al rechazar— y tiene el mismo camino con precedente: el estado
`borrador` que la v931 diseñó justamente para poder volver a un formulario a
medio llenar. **No se arregla acá y por la misma razón que entonces**:
arreglarlo en una puerta dejaría cinco puertas con dos comportamientos. Queda
medido.

Por eso la rama del respaldo —una fila en blanco que cae en quien responde—
se mide en `tmasanalisis`, donde el primer tramo del perfil va en blanco, y no
en `tsinmapear`, donde no se llega a tres filas.

### Dos capturas que envejecieron, y se apretaron

Las cuatro capturas de puerta de `tmasanalisis` leían «los N caracteres
siguientes al título». Al crecer un renglón la instrucción de arriba, el
resumen se salió de la ventana y la aserción se puso roja **por el lector y no
por la puerta**. Es la lección de la v935: **un ancla por distancia envejece;
una por contenido no.** Ahora se saltan hasta la primera cifra del resumen.

### Demostrado contra la v948

Revirtiendo **solo lo que imprime y decide** —el almacén y lo que `estado()`
expone se quedan, porque son lo que la suite necesita para LEER (v875)—: tres
en rojo con el estado viejo impreso.

```
✗ dos tramos caminados quedan con su ancho libre y su procedencia — 2 tramos · 0.9 m de media · Cleri Rodríguez
✗ y la ficha imprime los DOS nombres, no solo el de quien responde — perfil NO · rutas NO · andenes NO
✗ la cifra de la cuadra del lote la firma quien midió ESA cuadra   — 43 % firmado por «Ana Ruiz»
```

Y la del paramento se puso roja también por el otro lado —con la lista entera,
«43 % firmado por Marta Peña y Luis Ortega»—, que es la mitad que la asimetría
de arriba existe para impedir.

## Dos desinencias más que solo pueden ser de tú (v952)

Auditoría por la misma vía que encontró el pretérito en -ste: buscar si queda
otra familia **estructural** —una desinencia que en castellano no sea de
ninguna otra persona— sin guarda.

Quedaban dos, y las dos tenían casos vivos en texto impreso:

| Familia | Por qué es estructural | Lo que había |
|---|---|---|
| **-ías** · condicional e imperfecto | la primera y la tercera son «pasaría» y «sabía», sin la -s | `pasarías` ×3 |
| **-abas** · imperfecto | la primera y la tercera son «estaba» | `estabas` ×3 |

Seis casos, todos en texto que ve el usuario, y ninguna guarda los veía: la
v909 cubre los pronombres y el futuro en -ás, la v945 el pretérito en -ste.
Corregidos uno por uno —«el trazo que estabas dibujando» → «que estaba
dibujando», «¿Por dónde no pasarías de noche?» → «no pasaría»—, que es la
regla de la v878: cambiar la persona no conjuga los verbos de alrededor.

### La lista de -ías es la más larga de las cuatro, y se dice por qué

Esta aplicación habla de **vías** (78 veces), de **días** (52), de
**categorías** y de una docena de comercios en -ería. El canje va escrito
entero: un tipo de comercio nuevo —una cerrajería, una licorería— cuesta un
renglón en la lista y se ve en rojo hasta que alguien lo agregue. Es el
contrato de la v880, y se paga porque la otra mitad —fallar abierto— es
justamente la que dejó pasar «pasarías».

**Y no hay regla de forma que las separe.** El condicional es el infinitivo
más -ías, así que su raíz acaba en -ar, -er o -ir… y «panadería» acaba en
«er» igual que «comer». Es exactamente la regla que la v880 probó y descartó
para el futuro en -á, vista por el otro lado — y por eso queda escrita acá en
vez de volver a parecer buena.

`vacías` va en la lista con su razón: es adjetivo —«cajas vacías»— y también
presente de tú de vaciar. Acá es siempre el adjetivo.

La de -abas es corta de verdad: en castellano casi nada acaba así.

### Las dos se defienden solas

Como la de -ste (v945), cada una tiene su comprobación de respuesta conocida:
`pasarías` · `tendrías` · `sabías` se denuncian, `vías` · `días` ·
`categorías` · `droguerías` no. Sin eso, una lista de permitidas que se comiera
la regla dejaría todo en verde sin vigilar una palabra — y la de -ías es la
que más puede quedarse sin morder, porque su lista es la más larga.

### Y el mensaje de éxito decía menos de lo que cubre

Nombraba tres familias estructurales. Ahora nombra cinco. **Una guarda que
declara cubrir menos de lo que cubre es tan engañosa como una que declara
cubrir más**, y es la misma corrección que la v945 tuvo que hacerle a la v909.

Lo que sigue sin cubrirse es lo de siempre y por la razón de siempre: el
presente y los imperativos de tú son idénticos a los de tercera persona, y a
veces a un sustantivo. Esa mitad se caza leyendo.

### Demostrado

Devolviendo un solo «estabas» a `js/68`: la guarda lo señala con archivo y
línea. Dos suites citaban el texto viejo y se actualizaron —`trespaldo` y
`tintangible`—; las dos de `tsinsenal` son nombres de aserción, que las lee
quien corre la batería y no un ciudadano en su teléfono, así que quedan fuera
del alcance declarado desde la v878.

## Una caja con barras no es una caja vacía (v953)

Lo que la v933 dejó escrito al medir y no tocó, con su razón: *«la caja de
servicios públicos cierra con `'g3 caja-vacio'` **sin condición**, mientras su
comentario dice que “sigue siendo una caja ámbar mientras la capa no
conteste”… El arreglo es una línea pero cambia el aspecto y el pie de un panel
en las hojas compuestas, así que mueve aserciones y pide su propia medición.»*

Esa medición es esta tanda, y destapó que no era una línea sino dos.

### Dos afirmaciones falsas sobre un dato medido

Medido sobre el papel compuesto, con el doble del censo contestando sus cuatro
campos de servicios:

```
v952   caja-vacio: true   ·  4 barras impresas  ·  pie de método: NO
v953   caja-vacio: false  ·  4 barras impresas  ·  pie de método: sí
```

Las barras salían **dentro de una caja ámbar a trazos** —que en toda esta hoja
significa «esto no lo tenemos» (v849)— y **sin su pie de método**, porque
`caja()` lo suprime en las `caja-vacio` desde la v880. Dos afirmaciones falsas
sobre un dato que sí está medido, que es la clase de la v861.

La clase se decide AFUERA del cuerpo, que es la costura que la v903 dejó
puesta: `caja(titulo, cuerpo, clase)` recibe la clase como tercer argumento y
desde dentro del cuerpo no se puede pedir.

### Y el panel nunca había tenido método, escondido por su propia clase

Al volverlo una caja normal apareció que **`METODO_PANEL` no tiene entrada para
«Servicios públicos»**, así que habría impreso «método no descrito todavía» en
rojo.

No es un descuido de quien lo escribió: la caja iba siempre con `caja-vacio`,
que suprime el pie, así que la regla de la v848 —ninguna caja sin su método
declarado, y `tlaminaedu` la persigue— **no podía morderla**. La aserción mira
las cajas que TIENEN pie de método, y esta no tenía ninguno.

Es el patrón que este proyecto lleva persiguiendo desde la v878: **una guarda
que no puede fallar es un verde**, y acá el que la desarmaba era el propio
panel vigilado.

La entrada se escribió con lo que el panel ya declara y nada más. La
referencia es la caja de al lado —«la presencia de infraestructura de
OpenStreetMap, que es presencia y no cobertura»—, que es exactamente lo que
«Infraestructura de servicios» declara de vuelta sobre esta. Inventar una cifra
nacional de cobertura para llenar ese campo habría sido lo que la v863
prohíbe.

### Las dos ramas, en dos suites

* **`tlaminaedu`** · el doble del censo expone los cuatro campos de servicios
  desde la v880, así que la caja se llena: ahí se mide que **no** se presenta
  como un vacío y que sí trae su método.
* **`tsinmapear`** · su capa pasa a NO exponerlos —`camposDane` filtrado, que
  es el caso que el panel existe para declarar—: ahí se mide que **sí** es un
  vacío, que no declara un método sobre una cifra que no tiene, y que nombra la
  lista de campos como prueba (v865).

La segunda es la que de verdad guarda: sin ella, quitar el ternario y dejar la
caja siempre normal pasaría en verde, y el panel declararía una fórmula sobre
una cifra que no existe. Es la mentira contraria.

Las dos con su guarda de MATERIAL primero (v920).

### Demostrado contra la v952

Devolviendo solo el `caja-vacio` incondicional: dos en rojo con el estado viejo
impreso —«sigue en caja-vacio con 4 barras» y «método false»—. `tsinmapear`
sigue en verde, que es lo que tenía que hacer: es la guarda contra pasarse de
corregir, no una afirmación nueva.

## Un rechazo ya no se lleva lo tecleado (v954)

El defecto que la v940 dejó declarado y la v951 volvió a medir: **las cinco
puertas de plantilla perdían lo escrito al rechazar.** El manejador pone el
aviso y llama a `pintar()`, que rehace el formulario desde lo GUARDADO — y en
un rechazo no hay nada guardado. Quien tecleó ocho filas y se equivocó en una
hora las perdía todas.

La propia suite lo tenía escrito como método: *«El letrero y la parada se
vuelven a escribir, y NO es un descuido de la prueba: es literalmente lo que le
toca hacer a una persona.»*

### Se toma del DOM y se repone después, sin entrar a los dos sitios caros

El arreglo no toca **ni el render ni el camino de guardado**, que son los dos
sitios donde un error cuesta datos de campo. `tomarBorrador(pref)` fotografía
los valores por selector antes de validar; `pintar()` los repone al final, una
vez y para las cinco puertas. Si la puerta no está en pantalla ningún selector
casa y no pasa nada.

Tres decisiones, cada una con su precedente:

* **Se guarda lo que la persona ESCRIBIÓ, no lo que el manejador parseó.** El
  renglón que hay que devolverle es justamente el que dice «ancho normal»
  donde va un número, y el parseo ya lo había descartado. Medido: el paso 1
  vuelve como «temprano», que es lo que se va a corregir.
* **Vive en `S`, NO en el almacén.** Lo tecleado que no pasó la validación no
  es un dato de campo —no tiene procedencia y no pasó por
  `guardarEntradaCampo`—, así que meterlo ahí lo haría contar para
  post-sector. Es la separación de la v946 entre lo que se guarda y lo que
  recalcula, dicha para un formulario a medio llenar. Se pierde al recargar la
  página, y eso es lo correcto: un borrador que sobreviviera a la recarga
  sería un dato guardado sin decirlo.
* **Uno por PUERTA y no uno solo.** Quien rechaza en el perfil, se va a las
  rutas y rechaza ahí también, perdería el primero con un borrador único — y
  los dos son suyos. Los selectores llevan el prefijo de su puerta, así que no
  pueden pisarse.

Y se suelta con el análisis: sin eso, el formulario del sector siguiente
nacería con lo que alguien tecleó en otro barrio, que es el error que la v897
evitó con el acuse de guardado.

### En las cinco, y por la razón de siempre

Arreglarlo en una sola habría dejado cinco puertas con dos comportamientos,
que es exactamente lo que la v940 declinó hacer y por lo que lo dejó
declarado.

La guarda de `revisar.js` falla CERRADO: una puerta nueva que no tome el
borrador pierde datos en silencio. Y lleva su guarda de la guarda —que
`pintar()` siga reponiéndolo—, porque sin ella las cinco seguirían tomándolo
y todo quedaría en verde sobre un borrador que nadie devuelve a la pantalla.

### Y una prueba que se apoyaba en el defecto

`tsinmapear` se puso roja en cuatro aserciones, y no era una regresión: su
paso (d) escribía UNA cuadra encima de las dos que el paso anterior había
dejado rechazadas, y contaba con que el repintado hubiera vaciado la segunda.
Con el formulario acordándose, guardaba dos cuadras sin marcar ninguna y el
paramento salía SIN MEDIR.

**La prueba tenía razón en lo que medía y estaba apoyada en el fallo para
llegar ahí.** Ahora borra la segunda fila a mano, que es lo que hace una
persona que decide quedarse con una sola — la otra salida, igual de real, es
marcar cuál es la del lote, y esa la ejercita el paso (e) desde la v951.

Vale anotarlo porque es la forma en que un defecto viejo se defiende: cuando
algo lleva versiones roto, hay pruebas escritas alrededor de lo roto, y al
arreglarlo se ponen rojas sin que nada esté mal.

### Lo que esto NO arregla, y sigue declarado

**Una plantilla ya guardada sigue sin poderse ampliar.** Con la entrada en
estado «ok» la puerta muestra el resumen y el botón de quitar, sin
formulario, así que para anotar una cuadra más hay que quitar lo anotado y
volver a escribir todo. El borrador no lo alcanza: no hay campos en pantalla
que fotografiar.

Es el otro síntoma del mismo hecho —el formulario no tiene memoria— y pide
otra cosa: que la puerta sepa volver a abrir el formulario **con lo guardado
dentro**. **Hecho en la v955**, y salió más barato de lo previsto: el render ya
arma los renglones desde las filas guardadas, así que lo único que sobraba era
la condición que no dejaba llegar ahí.

### Demostrado contra la v953

Quitando solo el `reponerBorrador()` del final de `pintar()`: dos en rojo con
el estado viejo impreso —`{"ref":"","parada":"","p1":""}`— sobre un formulario
en el que se acababan de escribir las tres cosas.

## Seguir anotando sobre lo guardado (v955)

El otro síntoma del mismo hecho que la v954 —el formulario no tenía memoria— y
el que la v951 midió chocando con él: **con la entrada guardada, la puerta
mostraba el resumen y el botón de quitar, sin formulario.** Para anotar un
tramo más había que QUITAR lo anotado y volver a escribirlo todo.

La v951 lo encontró intentando llegar a tres filas y no pudiendo: la puerta
ofrece dos renglones de sobra, y un rechazo no guarda nada, así que desde una
plantilla recién vaciada no se pasa de dos.

### No hizo falta cargar nada

El render ya arma los renglones desde `X.filas`, que **son las guardadas**. Lo
único que sobraba era la condición que no dejaba llegar ahí. Así que el botón
enciende una bandera por hueco y la condición del estado «ok» la lee:

```js
if (act.estado === 'ok' && !ampliandoPuerta(HUECO_ACTIVIDAD)) { … resumen … }
```

Medido: el formulario vuelve con las dos cuadras y sus dos nombres dentro, con
cuatro renglones —dos guardados y dos de sobra— y la tercera cuadra se guarda.
Es exactamente lo que la v951 no pudo hacer.

**Los renglones de sobra son la mitad que hace falta decir**: sin ellos el
botón devolvería lo guardado y seguiría sin dejar agregar nada, que es el
defecto con otra ropa. Tiene su aserción propia.

### Un manejador para las cinco, y el hueco en el botón

`campo-ampliar` con `data-h`, no cinco acciones. Una puerta nueva lo hereda sin
manejador propio, que es la regla del aviso de origen (v867). Y el renglón que
lo ofrece se escribe una vez (`botonAmpliar`): dos redacciones de la misma
frase se separan a la tanda siguiente (v879).

La bandera se apaga al guardar bien, y se suelta con el análisis — como el
borrador de la v954 y por la misma razón.

### La guarda, cerrada y con su guarda

En `revisar.js`: las cinco puertas tienen su botón **y** su condición. Y la
guarda de la guarda: que `campo-ampliar` siga encendiendo la bandera que la
condición lee — sin ella, las cinco seguirían con su botón y el botón no haría
nada (v878).

### Demostrado contra la v954

Quitando solo el `!ampliandoPuerta(…)` de la condición de una puerta: tres en
rojo con el estado viejo impreso —el formulario devuelto en `null`, cero
renglones y la plantilla quedándose en dos filas—.

Con esto cierran los dos síntomas que la v940 y la v951 dejaron declarados.

## Una declaración de «otra tanda» también se queda vieja

Auditadas las doce declaraciones de trabajo pendiente que la bitácora lleva
escritas —«es otra tanda», «es su propia tanda», «no se hace acá»—, **dos
declaraban pendiente algo que ya estaba hecho**:

| Dónde | Lo que declaraba | Dónde se hizo |
|---|---|---|
| v913 | «guardar el total de la corrida anterior, que es otra tanda» | **v915**, en `pcr_conteos_v1` |
| v912 | «unificar `llenos.edificios` y `alturas.edificios` es del motor y es otra tanda» | **v915**, que midió que son la MISMA variable y puso la guarda |

Es la clase de la v864 —una afirmación que nació bien y la dejó obsoleta una
tanda posterior— **dentro de la documentación**, que es donde ya se cobró en
la v866 y la razón de que las listas vivas tengan su guarda.

### Por qué acá no hay guarda, y qué hay en su lugar

La lista viva se puede vigilar porque tiene FORMA: cada renglón lleva su
cláusula `ya:` y `revisar.js` la exige. Una declaración de «otra tanda» es
prosa suelta: no hay nada que comparar contra el código sin adivinar a qué se
refiere, y una guarda que adivine sería ruido.

Lo que sí es barato es el barrido, y queda escrito porque es como se
encontraron estas dos:

```bash
grep -n "es su propia tanda\|es otra tanda\|no se hace acá\|queda medido" CLAUDE.md
```

**Una tanda que cierre algo declarado así vuelve al renglón que lo declaró y
lo dice ahí**, como se hizo con la nota de la v933 en la v953 y con la de la
v951 en la v955. Cuando no se hace, la sesión siguiente lee la bitácora y
vuelve a medir lo que ya estaba medido — que es exactamente el tiempo que esta
corrección se ahorra.

### No sube la versión, y eso también es una decisión

Solo cambia `CLAUDE.md`, que no se sirve al navegador. Subir el token
rompería la caché de todos los teléfonos para no cambiarles una sola línea de
lo que ven, y `revisar.js` lo deja pasar con razón: su regla es que la versión
suba cuando cambia **el código**.

## La clase de una afirmación no es quién la cuenta (v957)

Primera de las cuatro capas del **pliego maestro del módulo presidencial**, que
hasta la v956 estaba hecho en una décima parte: de las diez cosas que marca
obligatorias existía **una**, el nivel de gobierno de la v941. Medido antes de
escribir —`categoriaProbatoria` 0, `tipoMedicion` 0, `contrargumentoOficial` 0,
ejes B y C 0, normalización por 100 días 0—.

El pliego tiene **una regla de oro** que manda sobre todo lo demás y decide el
diseño de esta tanda entera:

> ninguna capa puede escribir en la capa anterior. El editorial no mueve el
> score. El score no cita el editorial como evidencia.

Así que **ninguno de los tres campos nuevos mueve el veredicto**. La escalera de
fiabilidad sigue saliendo de lo mismo que salía —casos, contradicciones y
registro verificado— y los tres se publican al lado. Un campo agregado para
describir que cambiara en silencio el juicio público sobre una persona real es
exactamente lo que el pliego prohíbe, y hay dos guardas dedicadas a que no pase.

### Los tres campos, y la trampa que comparten

La trampa es la misma en los tres: **parecerse a un campo que ya existe**.

| Campo | Con qué se confunde | Por qué no es lo mismo |
|---|---|---|
| `categoriaProbatoria` | `tipoFuente` | uno mide la calidad de la FUENTE —quién lo cuenta y si está corroborado—; el otro la naturaleza de la AFIRMACIÓN —si hay documento, si son dos hechos que coinciden, o si alguien está afirmando que uno causó el otro— |
| `tipoMedicion` | nada, y ese es el problema | «cuatro operativos en un día» y «la criminalidad bajó» entraban como la misma clase de cosa |
| `contrargumentoOficial` | `contrapunto`, que ya existe en 114 entradas | uno es la respuesta del GOBIERNO; el otro es la advertencia metodológica de URBIS sobre la propia entrada |

El pliego nombra la primera con todas las letras —son dos ejes y meterlos en uno
deja el módulo sin servir para ninguna de las dos preguntas— y la tercera es la
homonimia que este proyecto persigue desde la v885, cazada antes de cometerla.

### La categoría probatoria NO se deriva del estado del caso

Es lo primero que se le ocurre a cualquiera, porque hoy coincidirían casi
siempre: un caso `confirmado` parece un `hecho-probado` y un `senalamiento`
parece una afirmación en circulación. La prueba de la clase B lo descarta:
*¿existe un cambio razonable que deba mover una y no la otra?* Sí — un caso
puede estar **`en-investigacion`, que es un estado PROCESAL**, y que lo que se
le imputa sea una atribución causal que nadie ha probado. Derivarlas las ataría
el día que se separen.

### El tercer valor que el pliego no trae, y por qué hace falta

`tipoMedicion` tiene dos valores en el pliego, y alimentan los indicadores I-09
e I-10. Pero **43 de las 168 entradas del registro no son ninguna de las dos**:
un juzgado que tumba un decreto, la JEP, Human Rights Watch, un expresidente que
responde, un aliado extranjero que anuncia algo. Ahí el sujeto no es el Gobierno
nacional y no hay una magnitud medida del país.

Con solo dos valores esas entradas tendrían que entrar forzadas en una de las
dos —y contaminar justo los dos indicadores que el principio 5 existe para no
mezclar— o quedarse sin declarar, que las confunde con las que nadie ha
revisado. Así que se nombra: **`no-aplica`**, con su razón escrita. Es una
desviación del pliego y va dicha, no disimulada.

### El contrargumento tiene TRES estados, y juntar dos sería un señalamiento

El principio 12 del pliego dice que un campo vacío es un dato: significa que el
Gobierno no respondió, no que no hubiera respuesta. Pero eso vale para el vacío
que alguien **buscó**:

| | Qué significa | Qué pide |
|---|---|---|
| un texto | el Gobierno respondió | nada |
| `ausente` | se buscó y no respondió | es un DATO, y alimenta el indicador I-06 |
| sin declarar | nadie lo ha revisado | es una deuda NUESTRA |

Juntar los dos últimos convertiría nuestra propia deuda en un señalamiento
contra el Gobierno. Es la distinción de la v899 entre «sin dato» y «panel
fuera», con más en juego.

Y por eso **el contrargumento arranca en 200 de 200 sin revisar**, con trinquete
que solo puede bajar, mientras los otros dos se clasificaron enteros. La
asimetría no es pereza: los otros dos se pueden clasificar LEYENDO el registro,
y éste no. Escribir `ausente` sin haber buscado sería afirmar que el Gobierno no
respondió — un señalamiento contra una persona real fabricado por comodidad
nuestra. El pliego contempla exactamente este caso en su control de calidad: *si
algún casillero falla, el módulo publica el resultado con la marca de la falla
visible*. La ficha la publica.

### La clasificación, y la vara para los dos registros

Los 168 registros del gobierno actual y los 32 de Petro, clasificados por
criterios escritos en el código y no de memoria:

```
actual   hecho-probado 147 · atribucion-causal 9 · en-circulacion 8 · correlacion 4
         actividad 103 · no-aplica 43 · resultado 22
Petro    hecho-probado  25 · atribucion-causal 3 · en-circulacion 3 · correlacion 1
         no-aplica 16 · resultado 10 · actividad 6
```

**Los dos, por el principio 1 del pliego**: toda regla que se aplica a un
gobierno se aplica a todos, y aflojarla en uno sería la manera silenciosa de
inclinar la comparación. Es la misma razón por la que `revisar.js` ya medía los
estados probatorios en los dos registros.

Y la nota interna de cada archivo lo dice, porque la rutina diaria escribe ahí
sin leer esta bitácora: sin ese renglón, la primera entrada nueva nace sin los
campos y el pendiente empieza a subir en vez de bajar.

#### El trinquete de estos dos es CERO, no un techo

Los otros trinquetes del módulo arrancan del número de hoy porque hay deuda
vieja. Éstos no: se clasificaron enteros, así que el techo es cero y **una
entrada nueva sin ellos se pone roja en el acto**, con el mensaje diciendo qué
valores admite cada campo. Entre fallar abierto y fallar cerrado se falla
cerrado, que es el canje de la v880.

### Dos guardas para la regla de oro, y la primera nació siendo un verde

La que MIDE la propiedad está en `tficha`: compone **la misma ficha dos veces**,
una con los tres campos vacíos y otra con los valores más dañinos que se pueden
escribir, y exige el mismo veredicto y los mismos tres techos. Demostrada
contaminando el cálculo a propósito: sale **«inquebrantable» contra «poco
fiable»**, que es exactamente el daño que la regla impide.

La barata está en `revisar.js` y corre sin navegador — y **la primera versión
pasó en verde sobre esa misma contaminación**, por dos motivos que vale tener
escritos porque son la forma de la v878:

* **el tramo vigilado se cortaba en `var manda`**, y la contaminación estaba
  tres líneas más abajo. Ahora llega hasta el recuento de la Capa 1, que se
  calcula al final a propósito para que se vea en el código que no lo toca;
* **la lista de contaminantes tenía solo los cuatro nombres de campo**, y una
  contaminación real no escribe `categoriaProbatoria`: llama a
  `capaUnoDe_conjunto`. La lista incluye ahora los ayudantes.

Aun así la estática no puede cazarlo todo —un alias con otro nombre se le
escapa— y eso va escrito al lado de la comprobación en vez de dejarla
pareciendo completa.

#### Y la guarda de material se cobró en su primera corrida

Las dos tablas de valores no se copian en `revisar.js`: se leen de `js/70`, para
que la comprobación no acabe comprobando que dos listas son iguales entre sí. El
primer extractor las buscaba con un `new RegExp` armado sobre una cadena, se
escapó dos veces y devolvió la lista vacía — con lo que **los 200 valores
salieron denunciados como desconocidos**. Lo cazó la guarda de MATERIAL, que va
primero y exige encontrar las cuatro categorías y los tres tipos. Sin ella, la
comprobación habría pasado en verde sin vigilar un solo valor el día que las
tablas se renombren.

El troceo va ahora por índice y no por expresión regular armada a mano.

### El material tuvo que construirse, y una aserción mía estaba mal

Vigesimoquinta vez. Contra el registro publicado las ramas del valor desconocido
y las dos del contrargumento no existen —allá está todo clasificado y nada tiene
contrargumento—, así que las aserciones habrían pasado por no tener nada que
rechazar. El fixture de `tficha` trae los cuarenta hechos repartidos en las
cuatro categorías, dos con un valor que la tabla no conoce, cinco sin declarar,
cuatro con respuesta del Gobierno y seis con `ausente`.

Y la aserción del reparto por tipo de medición esperaba 17 actividades donde hay
**23**: la suma estaba mal, no el código. Se arregló la aserción y de paso se
apretó —ahora exige también las cinco sin declarar y las dos desconocidas—, que
es lo que este proyecto hace cuando una prueba falla por un motivo legítimo.

### Lo que el pliego pide y esta versión NO hace

Las tres capas que faltan, con lo que cada una necesita:

* **Capa 2 · los indicadores contables** (I-04 a I-10) normalizados por 100 días
  de gobierno, con `poder_predictivo` según días transcurridos. Se puede
  calcular de los dos registros: `fichaDe` ya cuenta los días desde la posesión.
* **Capa 3 · los ejes A, B y C**, lado a lado y nunca combinados en un número.
  El eje B no se puede publicar sin la media histórica de Petro, Duque y Santos
  —lo dice el propio pliego— y eso es trabajo de archivo. El eje C pide datos
  presupuestales deflactados que el módulo no tiene.
* **Capa 4 · el marco declarado y el editorial firmado**, con autor y fecha,
  rotulado como opinión y enlazado a los registros que lo sustentan. Necesita
  las palabras de quien opera URBIS: los supuestos de valor los declara una
  persona, no se deducen.

## La tasa existe; la comparación entre gobiernos, no (v958)

Capa 2 del pliego presidencial: los indicadores contables, normalizados por 100
días de gobierno. La normalización es **obligatoria** y el pliego dice por qué:
*«sin esto, comparar un mes contra cuatro años reproduce exactamente el error de
períodos desiguales que este módulo existe para detectar»*.

Se hizo. Y al medirla salió lo que decide la tanda entera.

### 378,6 contra 1 no es una diferencia entre dos gobiernos

Medido sobre los dos registros de verdad, con el del gobierno anterior recortado
a los **mismos 42 días** desde su posesión:

| | Hechos en la ventana | Por 100 días |
|---|---|---|
| Gobierno actual | 159 | **378,6** |
| Gobierno anterior, misma ventana | **1** | — |
| Gobierno anterior, cuatrienio entero | 32 | 2,2 |

Acotar el período es la mitad fácil y se hace. Lo que no se arregla recortando
es que **los dos registros no son la misma clase de objeto**: uno es una
bitácora diaria llevada en tiempo real, el otro son treinta y dos hechos
escogidos de cuatro años. Lo dice el propio campo `cobertura` del archivo desde
que existe —*«Este registro NO es exhaustivo»*— y **hasta hoy no lo leía nadie**.

Publicar «378,6 contra 2,2 hechos por 100 días» sería la `comparacion_invalida`
que este módulo existe para detectar, cometida por el módulo. Así que la tasa se
publica —dentro de un registro sí significa algo— y la comparación **no**, con
las dos cifras impresas al lado de la razón. El pliego lo pide con esas
palabras: *«marca `no_comparable` y NO publiques la tasa — ni cuando favorezca
tu lectura ni cuando la contradiga»*.

`comparabilidad()` devuelve el par con sus razones y el texto armado en un solo
sitio: dos copias de una advertencia se separan (v867).

### Tres de los siete se declaran, y cuatro salen solos

| | De dónde sale |
|---|---|
| I-04 mecanismos excepcionales · I-05 choques con órganos autónomos · I-07 información obtenida por tutela | **se declaran** por entrada, como el nivel de gobierno de la v941 |
| I-09 actividad · I-10 resultados | de `tipoMedicion`, la Capa 1 |
| I-06 sin respuesta oficial | de `contrargumentoOficial`, la Capa 1 |
| I-08 días de gobierno | de la posesión |

**Los tres primeros no se deducen del texto, y la razón es concreta**: decidir
que un hecho es «un choque con un órgano autónomo» es una lectura sobre un
gobierno real. Y deducirlo de que el título nombre al DANE metería en la cuenta
la entrada de la inflación, que lo cita como **fuente**. Lo declarado es lo que
el propio pliego clasifica en su anexo —los concursos de mérito, el DANE, el
paquete de once decretos— más los mecanismos que el título enuncia sin lectura
de por medio: una emergencia económica declarada, un desastre nacional
declarado, la suspensión de la programación de veinte emisoras.

Siete entradas declaran indicador. Las otras 161 no, y la ficha lo dice: sin ese
renglón, un I-04 de seis se lee como «el Gobierno usó seis mecanismos
excepcionales» cuando lo que consta es que seis están declarados.

Que la Capa 1 fuera primero no fue orden alfabético: **tres de los siete
indicadores no existirían sin ella.**

#### I-06 no se puede publicar como cero

Es el único indicador que sale marcado «no se puede calcular todavía», y es la
misma distinción de los tres estados del contrargumento: con 200 hechos sin
revisar, un cero ahí diría **que el Gobierno respondió a todo**, cuando lo que
pasa es que nadie lo ha mirado. Un cero que miente es peor que un guion.

#### El Decreto 1012 se declara y no cuenta, que es lo correcto

Es del gobierno anterior —6 de agosto, víspera de la posesión— y el pliego lo
nombra como la simetría obligatoria del caso de los concursos. Se declara I-04 y
`hechosDelMandato` lo deja fuera de la cuenta por su fecha. La puerta que ya
existía hace el trabajo sin que nadie se acuerde.

### El poder predictivo se calcula, no se opina

*«Con menos de 180 días de gobierno, los indicadores describen un arranque, no
una tendencia»*, y el pliego obliga a publicarlo siempre. Sale de los días
transcurridos —bajo por debajo de 180, medio hasta 540, alto por encima— y va
pegado al resultado, no en una nota al pie. Hoy son 42 días: **bajo**.

### El material tenía que poder distinguir una tasa buena de una mala

Con un solo registro, `por100` mal calculado y bien calculado se ven igual. La
prueba compone **dos registros con los mismos 20 hechos y distinta duración** —20
días y 365— y exige 100 contra 5,5. Demostrada devolviendo `por100` al crudo:
sale **«20 contra 20 por 100 días»**.

Y la no-comparabilidad, demostrada quitándole sus dos razones: sale
**«las dos tasas NO se declaran comparables, y se dice por qué ()»** con el
paréntesis vacío, que es exactamente el módulo publicando una comparación que no
puede sostener.

### Una colisión de nombre que el arnés cazó en el acto

`const cmp` ya existía sesenta líneas más abajo en `tficha`, y el módulo tiene
desde la v885 la guarda de las funciones declaradas dos veces — pero eso es para
`js/`, no para una suite. Acá lo cazó el propio JavaScript: `Identifier 'cmp'
has already been declared`. Se llama `cpb`.

### Lo que el pliego pide y esta versión NO hace

* **I-01, I-02 e I-03 —las promesas—** necesitan `mismo_objeto_verificado`, que
  no existe: el pliego es explícito en que una contradicción retórica sin
  identidad de objeto NO baja el eje A, y sin ese campo las contradicciones del
  registro no se pueden separar en las dos clases.
* **El bloque D de alerta temprana** pide series de Medicina Legal, Procuraduría
  y Defensoría, y el propio pliego dice que sin serie histórica de gobiernos
  anteriores esos indicadores no significan nada.
* **Los ejes** (Capa 3) y **el marco declarado con el editorial** (Capa 4).

## Tres ejes lado a lado, y ninguno con nivel (v959)

Capa 3 del pliego presidencial. Y el resultado honesto de la tanda es que
**los tres ejes se calculan y ninguno publica un nivel**, cada uno diciendo qué
le falta. No es una tanda a medias: es lo que el pliego manda para el eje B con
todas las letras —*«sin ella el eje B no tiene contra qué comparar y no se puede
publicar»*— y lo que los otros dos piden por la misma razón cuando se miden.

Publicar un nivel sobre una persona real con el cálculo a medias es exactamente
lo que este módulo existe para no hacer.

### La regla que sostiene la capa: nunca un número único

> Se muestran LADO A LADO, nunca combinados en un número único.

Y no es una preferencia de diagramación. Confiabilidad mide si lo que dice
coincide con lo que hace; deterioro institucional mide qué le pasa a las reglas
del juego. **Un gobernante puede ser muy sincero sobre su intención de
concentrar poder** —confiabilidad alta, deterioro alto— y puede mentir mucho sin
tocar una sola institución. Metidos en la misma escala, el módulo deja de servir
para cualquiera de las dos preguntas.

`ejesDe` devuelve una **lista**, a propósito: quien quiera un número único tiene
que escribirlo a mano, y esa línea se ve en el diff. Hay dos guardas —una
estática sobre el tramo de la capa y otra en el navegador sobre los objetos que
devuelve—, y las dos se demostraron en rojo metiendo un «índice general»:
`4 · ABCG` y `ninguno trae un total: 1`.

### Eje A · la identidad de objeto, que no es el estado probatorio

El pliego lo pide así: el eje se calcula **solo** con registros donde
`mismo_objeto_verificado: true`, y una contradicción retórica sin identidad de
objeto **no baja el eje** — se registra aparte y es publicable, pero no es lo
mismo que incumplir.

El propio pliego trae el ejemplo y es el que explica por qué importa: el Fonpet
NO alimenta el eje A, porque lo prometido y lo hecho no son el mismo objeto, y
publicarlo como prueba de incumplimiento **«hunde los cuatro registros que sí
aguantan»**. Una acusación floja al lado de cuatro sólidas no suma: resta.

`mismoObjetoVerificado` se declara por contradicción, y **no se deriva de
`estado: 'tension'`**, que es lo primero que uno piensa. La prueba de la clase B
lo descarta: aquél es un estado PROBATORIO —todavía no está documentada— y éste
es de IDENTIDAD —está documentada y aun así las dos frases no hablan de lo
mismo—. El Fonpet es justamente una contradicción bien documentada sin identidad
de objeto.

Hoy: **4 documentadas en el registro actual, 0 con identidad declarada**, así que
el eje A no publica nivel. Y no se declararon acá a propósito: leer si «de negar
la adopción a prometer respaldo» habla del mismo objeto es una lectura sobre la
honestidad de una persona real, y esa la toma quien firma el módulo.

### Eje B · la mitad que sí está hecha, y la que es trabajo de archivo

Los cuatro indicadores —I-04, I-05, I-06 e I-07— están normalizados por 100 días
desde la v958. Lo que no existe es la **media histórica de Petro, Duque y
Santos**, y sin ella no hay contra qué comparar. El pliego lo pone como condición
de validez y no como sugerencia: *«el nivel se CALCULA, no se asigna»*, *«se
recalcula hacia atrás para todos los gobiernos con los mismos criterios»*, y —la
que más cuesta— *«si el cálculo arroja B5 para un gobierno anterior, se publica
igual»*.

Lo que sí se publica son los cuatro números, con la frase que el eje obliga a
decir: **se lee en las dos direcciones** —un uso intensivo de figuras
excepcionales puede ser una respuesta eficaz a una emergencia real, o una
concentración de poder— y el módulo muestra el número sin elegir la lectura.

### Eje C · acá no falta una media, falta la fuente entera

Las siete reglas de cálculo del pliego piden ejecución presupuestal por sector
deflactada por IPC, con aprobado, radicado y ejecutado separados, la agregación
de «gasto militar» declarada en sus dos formas, porcentaje del PIB y del
presupuesto, y la misma serie para los gobiernos anteriores.

El módulo no tiene una sola de esas cifras. Y la tentación concreta era sacar el
eje de las menciones presupuestales que sí hay en la línea de tiempo: **eso
serían titulares, no ejecución**, y el eje saldría con la forma de un dato y el
contenido de una rueda de prensa.

### La tensión que queda declarada y NO resuelta

La escalera de fiabilidad tiene un techo, `palabra`, que cuenta las
contradicciones documentadas. El eje A cuenta las que además tienen identidad de
objeto. **Son dos lecturas de la misma familia con reglas distintas**, y la
prueba de la clase B dice que eso se separa la tanda siguiente.

No se unificó, y la razón es la de la v947: **unificarlas cambia un veredicto
publicado sobre una persona real**. Con las cuatro contradicciones documentadas
del registro actual, pasar el techo `palabra` a contar solo las que tienen
identidad de objeto lo movería —hoy, a cero declaradas, lo movería hasta arriba—.
Esa decisión es de quien firma el módulo, no mía. Queda medida y escrita, con la
ficha diciendo en su propio pie que el veredicto **no** es el promedio de los
tres ejes.

### Un fallo de la prueba que era un fallo del papel

`tficha` vigila desde la v791 que ningún texto corrido baje de 13 px en teléfono,
y el panel nuevo salió con **12,48**: la línea que explica cómo se lee el eje B
iba en la escala más chica, que es de etiquetas y no de prosa. Subida. La
aserción tenía razón y no se aflojó.

### Lo que el pliego pide y esta versión NO hace

* **I-01, I-02 e I-03** —el conteo de promesas verificables y cumplidas— siguen
  sin fuente: el registro tiene contradicciones, no un inventario de promesas
  con su estado.
* **El bloque D de alerta temprana**, que pide series de Medicina Legal,
  Procuraduría y Defensoría, y que el propio pliego declara sin sentido sin la
  serie histórica.
* **Los cinco gráficos** (G-1 a G-5) con sus reglas de honestidad gráfica: los
  cinco son del eje C y ninguno tiene datos que dibujar.
* **La Capa 4**: el marco declarado y el editorial firmado.

## La opinión va firmada y fuera del cálculo (v960)

Capa 4 del pliego presidencial, y con ella el pliego maestro queda con sus
cuatro capas montadas. Es la capa donde va la postura de quien opera URBIS, y
la regla que la hace legítima es la regla de oro dicha en la otra dirección:
**no alimenta ningún cálculo y ningún cálculo la cita como evidencia**.

El pliego lo argumenta mejor de lo que yo podría:

> Una opinión firmada y enlazada a evidencia se defiende. Un juicio metido
> dentro de un algoritmo solo se desacredita. Si la postura es fuerte, el
> formato firmado la hace más fuerte, no menos.

### Lo que este código NO escribe, y no es un olvido

El texto del editorial, su autor, su fecha y los supuestos de valor del marco
**no los pone el código y no los pone quien programa**. Firmar una opinión sobre
un presidente en ejercicio con el nombre de otra persona sería lo más grave que
este módulo podría hacer, y lo sería aunque la opinión fuera buena. Se leen del
registro; si no están, la sección lo dice y ahí para.

Por eso `editorialDe` devuelve **siempre un objeto con su estado**: «no hay
editorial» y «hay editorial sin firmar» piden cosas distintas, y el segundo es
el que hay que poder ver. Hoy no hay ninguno, y la ficha lo dice nombrando lo
que **no** sería legítimo: una opinión sin firma, o una opinión metida dentro
del cálculo.

### El marco: las dos listas son del pliego, los supuestos son de la persona

«Qué mide este módulo» y «qué NO mide» van en el código, palabra por palabra del
pliego, porque no son una opinión: son la definición del módulo, y si cambian
cambia el módulo. Los **supuestos de valor** viven en el registro, porque son de
quien lo opera.

Y su ausencia se pinta, no se calla. El pliego lo dice con todas las letras:

> Elegir qué indicadores rastrear ya es una decisión de valores. Eso es
> inevitable y no es un defecto. Lo que sí sería un defecto es esconderlo.

Un marco sin supuestos declarados es la **neutralidad falsa**, que es peor que
un marco con el que se puede discrepar.

### La marca que el pliego pide en la interfaz

Si el editorial se apoya en un registro cuya categoría probatoria es
`atribucion-causal` o `en-circulacion`, **se marca**. No lo descalifica —una
opinión puede apoyarse en lo que quiera— pero el lector tiene que poder ver
sobre qué se apoya. Eso lo hace posible la Capa 1 de la v957: sin la categoría
probatoria no habría con qué marcar.

### El control de calidad se calcula y se publica CON sus fallas

> Si algún casillero falla, el módulo publica el resultado con la marca de la
> falla visible. No publica sin la marca.

Eso es lo que convierte la lista en algo distinto de un buen propósito: no es
una lista para repasar antes de publicar, es una cuenta que se hace sola y sale
impresa al lado del registro. Hoy da **seis que pasan, tres que fallan y dos que
no se pueden correr**:

| | |
|---|---|
| **Falla** | el contrargumento oficial sin revisar (200 de 200) |
| **Falla** | el eje B sin la media histórica de Petro, Duque y Santos |
| **Falla** | lo que en cada corrida no cuadre de los otros casilleros |
| **No se puede correr** | el balance de la muestra: el registro no clasifica la calidad del encuadre de cada pieza |
| **No se puede correr** | menores identificados: se revisa a mano al escribir cada entrada, el módulo no tiene cómo comprobarlo |

Los dos últimos se dicen como tales y no se dan por buenos. **Dar por bueno un
casillero que no se pudo correr** es el error típico que la lámina educativa
declara desde la v879, y acá vale igual: sobre una persona real, más.

### La guarda circular denunció tres editoriales de prensa

El invariante es que ningún registro cite el editorial del propio módulo como
fuente — sería el módulo citándose a sí mismo como evidencia sobre una persona,
que es la definición de un argumento circular.

La primera versión lo buscaba por la palabra «editorial» y denunció **tres
fuentes legítimas**: un editorial de Vanguardia, una columna de Cecilia Orozco
en El Espectador. Citar el editorial de un periódico es normal y bueno.

Se mide el **dominio**, que es donde de verdad se ve: cero fuentes apuntan hoy a
`urbispro.city`, así que la guarda arranca limpia y falla cerrado. Es la lección
de la v895: una guarda con falsos positivos termina siendo una lista de
excepciones que envejece hasta no significar nada.

### Demostrado en rojo

* metiendo el editorial en el cálculo del veredicto → la guarda estática:
  **«lo contamina: editorialDe»**;
* dando el control de calidad por limpio → la suite del navegador:
  **«0 fallan de 10»** y **«0 casilleros sin correr»**.

La segunda no la caza la guarda estática, y eso va escrito al lado: la estática
comprueba que el código sepa contar fallas, y la del navegador que las cuente de
verdad. Es la misma división de trabajo que la regla de oro de la v957.

### El pliego, capa por capa, al cerrar

| Capa | Estado |
|---|---|
| 1 · Extracción | los tres campos declarados en los dos registros, 200 entradas clasificadas |
| 2 · Indicadores | seis por 100 días, con el poder predictivo y la no-comparabilidad dicha |
| 3 · Ejes | los tres calculados, **ninguno con nivel**, cada uno diciendo qué le falta |
| 4 · Editorial | la estructura, la marca de apoyo flojo y el control de calidad; el texto lo firma una persona |

Y lo que sigue faltando, que es de archivo y de fuente y no de código: la media
histórica de I-04 a I-07 para Petro, Duque y Santos; la ejecución presupuestal
deflactada por sector; el inventario de promesas con su estado; y las series de
Medicina Legal, Procuraduría y Defensoría del bloque D.

## Los criterios van como datos, y rechazaron tres declaraciones mías (v961)

Llegó un **motor de referencia en TypeScript** —las cuatro capas del pliego
presidencial escritas como código— sin una palabra de acompañamiento. No es
código para el repositorio: este proyecto no tiene TypeScript ni paso de
compilación, y un archivo que nadie carga es lo que la v885 enseñó a no
dejar. Es una **especificación escrita como código**, que es la forma más
difícil de malinterpretar.

Medido contra `js/70-seguimiento.js` antes de tocar nada —la regla de la
v863 y la que el usuario fijó en la v916—, de lo que el motor trae:

| Lo que trae | Estado |
|---|---|
| contrargumento con TRES estados | **ya estaba** (v957), convergente sin habernos hablado |
| `atribuible` = fechado ∧ nacional | **ya estaba**, partido entre `hechosDelMandato` y `entraAlVeredicto` |
| `constanciaBusqueda` en el «ausente» | no estaba |
| los **criterios como datos**, con `requiere` | no estaba: 7 de 168 declaradas a mano |
| `estadoProcesal` y `tipoEvidencia` | no estaban (0 de 200) |
| `tipoMedicion` con `contexto_estructural` | yo tenía `no-aplica`, 59 entradas |
| triangulación, encuadre, signo político, eje C | no estaban |

Esta tanda hace las cinco primeras. Las de la última fila piden lecturas
sobre el encuadre de cada pieza y una fuente presupuestal entera, y van
aparte.

### El hallazgo: el criterio escrito es más estricto que mi lectura

Es lo que el motor de referencia dice con todas las letras —*«los criterios
van como DATOS, no como decisión caso por caso»*— y se cobró en el acto.
Aplicados a las siete entradas que ya declaraban indicador:

    v960   I-04 = 6 declaradas a mano · I-05 = 2
    v961   I-04 = 3 que cumplen el criterio · I-05 = 0

Tres declaraciones mías caen, y dos de ellas son de la misma entrada:

* **«Declara insubsistente al director del DANE» · I-04 y I-05.** Retirar a
  alguien de un cargo de libre nombramiento **es el régimen ordinario**, no
  una facultad extraordinaria. Y el DANE **no es un órgano de autonomía
  constitucional**: es un departamento administrativo del propio Ejecutivo,
  así que un choque con él no es un choque entre poderes. Lo segundo destapó
  además que mi propia descripción de I-05, escrita en la v958, listaba al
  DANE entre los órganos autónomos. Corregida.
* **«El Gobierno aplaza los concursos por decreto» · I-05.** El aplazamiento
  sí es I-04. El choque no: el `excluye` nombra exactamente este caso —«anuncio
  del Ejecutivo que el órgano aún no ha respondido»— y no consta acto de la
  CNSC en esa entrada.

  **Y la razón de verdad era otra, más fuerte: la v962 la corrige.** La CNSC
  SÍ actuó —las Resoluciones 10537 y 10543 de 2026— pero lo hizo «en ejercicio
  de la autonomía del art. 130 **y de conformidad con** el Decreto 1384». De
  conformidad con, no en contra: es discrecionalidad que el propio decreto le
  otorgó. Así que el retiro de I-05 estaba bien y por un motivo que yo no
  tenía; queda escrito como renglón del `excluye` para que la próxima no
  dependa de que alguien lo recuerde.

**La dirección del error importa y hay que decirla:** el criterio escrito
produce MENOS señalamientos, no más. Un conteo de mecanismos excepcionales
que baja de seis a tres sobre un gobierno en ejercicio es prudencia, y es la
razón por la que aplicarlo no necesita la firma de nadie: no es mi opinión
sustituyendo a otra, es un criterio público sustituyendo a una lectura que
no estaba escrita en ninguna parte.

### `excluye` y `requiere` no son lo mismo, y por eso son dos campos

Es la distinción que decide qué se toca en el registro:

* **`excluye`** dice QUÉ NO ES de esta clase. Si un hecho cae ahí, la
  declaración está mal y **se quita**.
* **`requiere`** dice QUÉ PRUEBA HACE FALTA. El hecho sí es de esta clase y
  le falta el papel: la declaración **se queda** y el indicador no la cuenta,
  diciendo qué falta.

Juntarlos borraría la diferencia entre «esto no va acá» y «esto va acá y
todavía no se puede sostener», que para quien mantiene el registro son dos
tareas opuestas. Por eso quedan dos entradas declaradas que no cuentan —las
emisoras de paz, sin acto identificado; la emergencia «anunciada», cuyo
decreto está en otra entrada— y ninguna de las dos se borró.

### La desviación del motor de referencia, declarada

El motor filtra en silencio: `declara(r, id) && requiere(r)`. Acá no.

**Un conteo que baja sin decir por qué se lee como que el hecho no ocurrió.**
La ficha imprime, debajo de cada indicador, su definición, sus dos listas y
—cuando las hay— las declaraciones que el criterio no deja contar, cada una
con su motivo propio: le faltan los insumos, es de otro nivel de gobierno, o
los tiene y no cumple. Es la distinción de la v899 entre «sin dato» y «panel
fuera», aplicada a una cuenta en vez de a un panel.

Los cuatro motivos son cuatro salidas de `pasaElCriterio`, que devuelve un
objeto y nunca un booleano (v876): un `false` mandaría a revisar lo que está
bien.

### Los dos campos nuevos son de otra clase que los tres de la v957

Y eso es lo que permite declararlos sin la firma de nadie. Los tres de la
Capa 1 son lecturas sobre la AFIRMACIÓN —qué clase de cosa es, qué mide, qué
contestó el Gobierno—. `estadoProcesal` y `tipoEvidencia` se leen de la
propia entrada: un decreto es un documento primario, un «anuncia» sin acto es
un anuncio sin acto.

**No se exigen en las 200 entradas**, y es deliberado: solo las que declaran
un indicador pasan por el gate, así que solo esas los necesitan. Pedírselos a
todas sería un trinquete que nadie puede bajar y que no protege nada.

Y una regla que hubo que escribir porque sin ella el campo se vuelve una
opinión: **es documento primario cuando el acto está identificado por su
número o su radicado** —«Decreto 1384 de 2026»—, aunque la copia haya llegado
por prensa; es reporte periodístico cuando el hecho solo consta en el relato
del medio. Que el enlace al documento falte es otra cosa, y la vigila el
control de calidad por su cuenta.

### `no-aplica` decía lo que no es

El motor lo llama `contexto_estructural` y tiene razón por la misma regla con
la que la v879 renombró «Continuidad del tejido»: un rótulo que solo niega
deja que el lector suponga qué hay debajo. Son 59 entradas —un juez que tumba
un decreto, un órgano de control, un tercero, un aliado extranjero— y el
hecho existe, está fechado y es del país; lo que no es, es una cuenta del
Gobierno.

El renombre es limpio y **sin sinónimo**: el valor viejo pasa a ser
desconocido, y `revisar.js` lo denuncia con el literal impreso. Es fallar
cerrado, que es el canje de la v880.

### «Ausente» sin constancia es un señalamiento sin respaldo

El motor exige, para un contrargumento ausente, **dónde se buscó y cuándo**.
La razón es la misma por la que ese campo tiene tres estados y no dos:
`ausente` **afirma** que el Gobierno no respondió, y esa afirmación sobre una
persona real necesita algo detrás. Sin constancia, «ausente» y «no lo miré»
se escriben igual de fácil y se leen igual de mal — y el primero pesa en el
indicador I-06.

Así que son **cuatro estados y el cuarto es la guarda**: un `ausente` a secas
se ve, con su literal impreso, y no pesa. No se tira ni se asciende a lo que
nadie escribió, que es la decisión de la v931 con la fecha sin distinguir.

Hoy no hay ninguno en los dos registros, así que el trinquete arranca limpio.

### Las guardas, y la de la guarda

En `revisar.js`, y las dos mitades hacen falta:

* que **el criterio exista** —todo indicador declarable tiene el suyo, y no
  sobra ninguno—;
* y que **la cuenta lo APLIQUE**. Sin esta segunda, la tabla sería
  documentación y el conteo seguiría siendo lo que alguien declaró a mano: la
  guarda de la guarda, el patrón de la v878.

Más el trinquete en cero de los tres insumos, en los dos registros por el
principio 1 del pliego, y la comprobación de que un `ausente` sin constancia
no pese.

### El material tuvo que enseñar las cuatro salidas

Vigesimosexta vez. Contra el registro de verdad la rama «otro nivel» no
existe —las siete entradas con indicador son nacionales— así que la aserción
habría pasado por no tener nada que rechazar. El fixture de `tficha` trae las
cuatro declaraciones: una que cuenta, una sin insumos, una municipal y una
anunciada sin acto. Con su guarda de MATERIAL primero (v920).

Y una aserción vieja se puso roja por un motivo legítimo: su fixture escribía
`'ausente'` a secas para medir los tres estados, y eso ahora es el cuarto.
**Se apretó el fixture, no la aserción** — las seis entradas llevan su
constancia, los tres estados siguen medidos, y el cuarto tiene la suya.

### Demostrado contra la v960

Neutralizando **solo la puerta** —los criterios y lo que `estado()` expone se
quedan, porque son lo que la suite necesita para LEER (v875)—: cuatro en rojo
con el estado viejo impreso.

```
✗ una declaración sin los insumos del criterio no cuenta   — I-04 2 de 2
✗ MATERIAL · las cuatro ejercitan las cuatro salidas       — 4 declaradas · 0 fuera
✗ solo la que cumple el criterio escrito cuenta            — 4 de 4
✗ y las otras tres salen con SU motivo                     — (vacío)
```

### Lo que este motor pide y esta versión NO hace

Queda medido para que la tanda siguiente no empiece por averiguarlo:

* **Aplicar los criterios al resto del registro.** Hoy 154 de 159 hechos del
  mandato no declaran indicador. Escribir los criterios no los clasifica: los
  hace clasificables. Ese pase es la tanda que sigue, y ahora se puede hacer
  contra una lista y no de memoria.
* **`calidadDelEncuadre` y `signoPolitico`**, que son los que vuelven
  computables los dos casilleros QC que hoy salen «no se pueden correr». Son
  lecturas sobre el encuadre de cada pieza, no sobre el registro.
* **`solidezPorTriangulacion`** con `fuentes[].pais` y `confirma` —confirmar
  el HECHO no es compartir el ENCUADRE—, y **`decisionNacionalHabilitante`**
  con su `implicaOrdenDirecta` siempre en falso salvo prueba.
* **El eje C entero**, que sigue sin fuente, y la media histórica del eje B,
  que sigue siendo trabajo de archivo.

## El caso que no cabía en ningún indicador tiene el suyo (v962)

El motor de referencia volvió con una respuesta directa a lo que la v961
encontró. Aquella tanda quitó las dos declaraciones de la entrada del DANE
porque los criterios escritos las rechazaban, y dejó el caso **sin ningún
indicador**. El motor dice que eso está mal por el otro lado:

> Existe porque estos casos no caben en I-05 y perderlos sería perder un hecho
> real.

Es la decisión de la v875 —no se arregla una exageración con un silencio— y la
de la v881 con los anillos agrupados, aplicadas a un indicador. Entre forzar un
caso en un indicador que no es el suyo y tirarlo, se hace la tercera cosa: se
nombra lo que es.

    v961   el DANE queda sin indicador · I-05 = 0 · el hecho se pierde de la cuenta
    v962   I-13 = 1 · I-05 sigue en 0 · el hecho cuenta como lo que es

### I-13 · interferencia en la independencia técnica

No está en el pliego original. Cuenta actos del Ejecutivo sobre entidades que
**no** son autónomas constitucionalmente pero tienen independencia técnica de
ley: el DANE (Ley 2335), las agencias reguladoras.

Y lo que lo hace publicable sin convertirse en un señalamiento va en su propia
definición: **cuenta una coincidencia documentada, no una causa probada.** Que
una remoción coincida con una controversia sobre difusión es comprobable; que
la haya causado es una atribución que el registro no sostiene — y el
`tipoFuente` de esa entrada es `disputado` justamente porque el motivo está en
disputa. La aserción persigue esa palabra en la definición.

Medido antes de declararlo, el caso encaja por **una** vía del `incluye`: la
**directriz presidencial** que exige autorización del Gobierno para que las
entidades hablen con la prensa, por la que se canceló treinta minutos antes la
rueda de prensa de la inflación de agosto (documentado por Semana).

**Esta sección decía «las dos vías» y la segunda era falsa. La v963 la
corrige**, y el detalle está allá: no hay ninguna remoción coincidente con la
controversia —el relevo que existe es anterior a ella y es ordinario—. Sin la
directriz, el caso habría caído en el `excluye` y lo honesto habría sido
dejarlo sin indicador.

### I-13 no entra al eje B, y esa es la parte que hay que vigilar

El eje B mide **desviación respecto de una media histórica**, y de I-13 no hay
ninguna: nació hoy y nadie ha recalculado los gobiernos anteriores con este
criterio. Meterlo compararía cuatro indicadores contra una referencia y el
quinto contra nada.

Así que el indicador se publica y el eje no lo usa, con su guarda y su guarda
de la guarda —que `ejeB` siga leyendo `IND_EJE_B`—. Sin la segunda, la primera
seguiría en verde sobre una constante que no decide nada.

### La lista cerrada, y la guarda que caza el error de la v958

`ORGANOS_AUTONOMOS`, trece entradas, **y el DANE no está**. Es lo que faltaba
en la v958, cuando escribí su descripción de memoria y lo listé entre los
autónomos.

La guarda va en las dos direcciones y la segunda persigue la CLASE:

* los de autonomía constitucional **tienen** que estar —si alguien vacía la
  lista, todo lo demás pasaría en verde—;
* y **ninguna entidad del propio Ejecutivo** puede colarse: se vigilan ocho
  formas (DANE, Ministerio, Función Pública, Superintendencia, DNP…), no solo
  la que falló.

Meter una entidad del Ejecutivo en esa lista convierte un acto interno en un
choque entre poderes, que es el señalamiento más caro que este módulo puede
fabricar.

Y el criterio de I-05 **las excluye por escrito**, no solo por omisión de la
lista de al lado: quien declara un indicador lee el criterio.

### Dos exclusiones que un caso real obligó a escribir

La segunda es la que corrige mi propia razón de la v961. La CNSC **sí** expidió
actos sobre el aplazamiento de los concursos —Resoluciones 10537 y 10543 de
2026— y lo hizo «de conformidad con el Decreto 1384». Un órgano que ejerce una
facultad que el propio acto del Ejecutivo le reconoce **no está chocando con
él**, y contarlo sería fabricar un choque. Yo había escrito que «no consta acto
de la CNSC»: la conclusión era correcta y el motivo era más débil que el real.
Corregido en su renglón de la v961, que es lo que esta sesión dejó como
práctica —una tanda que cierra algo declarado en otra vuelve a ese renglón.

### La demostración salió vacía, y una salida vacía no es un verde

Al quitar I-13 del catálogo y del orden para demostrar en rojo, dejé su clave
en `crudo`, así que `INDICADORES['I-13'].dec` lanzó un TypeError y **la suite no
imprimió nada**. Leerlo como pase o como fallo habría sido igual de falso: es
la trampa que este archivo tiene arriba desde la v880, y volvió a aparecer.

Retirado entero, la demostración sale limpia: tres en rojo —«undefined de
undefined», el criterio sin su palabra y la fila sin publicar—. Las otras dos
pasan a propósito: que I-05 siga en cero era cierto en la v961, y que el eje B
no lo absorba se cumple solo cuando el indicador no existe. Son guardas contra
pasarse de corregir.

### Y una costumbre que no era uniforme

`api.indicadores()` sin argumento caía en `{}` y medía un registro **vacío** —
ceros con la forma de una medición—, mientras `comparabilidad()` sí toma el
registro actual por omisión. Lo destapó la aserción nueva, que salió roja con
«0 de 0» sobre un registro que tiene el caso. Ahora las dos hacen lo mismo.

### Lo que sigue faltando del motor de referencia

* **`entidadResponsable` por entrada**, que es lo que permitiría exigir que un
  I-05 nombre un órgano de la lista cerrada. Hoy hay cero declaraciones de
  I-05, así que la guarda no tendría nada que comprobar y no se escribió a
  medias.
* **`calidadDelEncuadre` y `signoPolitico`**, los dos casilleros QC que siguen
  en «no se pueden correr».
* **`solidezPorTriangulacion`** con `fuentes[].pais` y `confirma`, y
  **`decisionNacionalHabilitante`** con su `implicaOrdenDirecta`.
* **Aplicar los criterios al resto del registro**: 153 de 159 hechos del
  mandato siguen sin declarar indicador.
* **El eje C entero** y la media histórica del eje B.

## Una vía inventada, y dos guardas que no dependen de acordarse (v963)

Tres cosas, y la primera es una corrección de la v962 que llegó con la
secuencia de hechos en la mano.

### La segunda vía del caso DANE no existía

La v962 escribió que el caso entraba por **dos** renglones del `incluye` de
I-13. El segundo —«remoción o bloqueo de nombramientos coincidente con una
controversia sobre difusión»— es falso, y la secuencia real lo enseña:

| | |
|---|---|
| 19 de agosto | Valencia es nombrado por Decreto 1260, reemplazando a Urdinola |
| 3 de septiembre | directiva general que exige autorización previa para hablar con prensa |
| 7 de septiembre | se cancela la rueda de prensa de la inflación |

**El relevo de Urdinola es ANTERIOR a la controversia y es un cambio ordinario
de gobierno**: cae en el `excluye` —«nombramiento o remoción ordinarios sin
controversia documentada»—. Yo había leído la remoción de Valencia del 14 de
septiembre como la coincidencia, y eso confunde dos cosas: que un hecho
posterior exista no lo vuelve «coincidente» con la controversia en el sentido
que el criterio pide.

Lo que sí existe, y no es lo mismo: **la Presidencia frenó nombramientos que
Valencia quería hacer** (La Silla Vacía). Eso es bloqueo y el criterio lo
contempla — pero el motivo reportado es la cercanía de esas personas con
Oviedo, que es **una tensión distinta de la de difusión**: la coincidencia es
con el clima general, no con el hecho específico. Así que no se cuenta como
vía, y queda escrito para que nadie lo vuelva a leer como una.

**I-13 = 1 se mantiene, por UNA vía sólida.** La cifra no cambia; lo que
cambia es que ahora dice cuál es.

### Y de ahí sale el arreglo de fondo: la vía se declara en la entrada

El defecto no fue equivocarme al leer: fue que **la declaración en el registro
era solo `['I-13']`**, así que la vía vivía en la prosa de una bitácora y nadie
podía auditarla. Un criterio con seis renglones de `incluye` y una declaración
que no dice por cuál entra es medio criterio.

Ahora cada entrada lleva `indicadoresPor`, con el texto **exacto** del renglón:

```json
"indicadores": ["I-13"],
"indicadoresPor": { "I-13": "instrucción sobre contenido, oportunidad o forma de difusión de información técnica" }
```

Y se comprueba contra el criterio. **Citar por número sería la trampa de la
v878** —el id que se separa de su título—: reordenar la lista repuntaría todas
las citas en silencio. Con el texto, reescribir un renglón rompe las entradas
que lo citan, que es lo correcto — hay que volver a mirarlas.

Dos salidas nuevas de la puerta, cada una con su motivo: `sin-via` y
`via-desconocida`. Y la ficha imprime, al lado de cada renglón del `incluye`,
cuántos hechos entraron por él — más un aviso cuando todos entran por el mismo:
«la cifra mide una sola clase de acto, no la variedad que el criterio
describe».

#### Dos declaraciones más caen, ahora por el `excluye`

Aplicando la regla de la v961 —`excluye` quita, `requiere` deja sin contar—
al escribir las vías aparecieron dos que no tenían ninguna posible:

* **«Anuncia emergencia económica»** → «anuncio sin acto administrativo
  expedido». El acto es el decreto 1261, que va en la entrada del 9 de
  septiembre.
* **Decreto 1012** → «acto de un gobierno anterior». La v958 lo dejó declarado
  como simetría y el primer renglón del `excluye` lo rechaza.

I-04 sigue en 3: las dos estaban fuera de la cuenta por otra vía.

### 2 · La corrida hacia atrás NO se puede correr, y hay que decirlo

El encargo era validar I-13 sobre Petro, Duque y Santos, empezando por el
episodio de Urdinola «que ya está en el registro». Medido:

* **el relevo de Urdinola NO está en el registro.** No hay entrada, ni Decreto
  1260, ni fuentes. Lo único que consta es que Valencia «había asumido el 19 de
  agosto», dentro de otra entrada;
* **la directiva del 3 de septiembre tampoco tiene entrada propia.** Vive en el
  `contrapunto` de la entrada del 14. O sea que **la única vía sólida de I-13
  se apoya en un hecho que no es un registro** — eso es un hueco real y va
  nombrado, no tapado;
* **en el registro de Petro, cero candidatos.** El único que el patrón
  encuentra es la Procuraduría destituyendo a los responsables de los
  carrotanques de la UNGRD: eso es un órgano AUTÓNOMO actuando sobre
  funcionarios, la dirección contraria a la que I-13 mide;
* **no existen registros de Duque ni de Santos.**

Así que el aviso que se pidió, tal cual: **I-13 no dispara ni una vez en
ningún gobierno anterior, y eso NO demuestra que el criterio distinga.**
Demuestra que no hay material. El registro de Petro son 32 hechos escogidos de
cuatro años —su propio campo `cobertura` dice que no es exhaustivo— así que
«no dispara» ahí es evidencia débil, y de los otros dos gobiernos no hay nada.

Lo único que sí se pudo medir es la discriminación **dentro del registro
actual**: el patrón encuentra 5 entradas con entidad técnica y acto del
Ejecutivo, y el criterio deja pasar 1. Es una señal, no una validación.

Para validarlo de verdad haría falta entrar los tres episodios que el
diagnóstico nombra —el relevo de Urdinola, la directiva del 3 de septiembre y
el freno de nombramientos— cada uno con su fuente, y después correr el
criterio sobre ellos. Eso es trabajo de registro, no de código.

### 3 · Las dos guardas permanentes

#### Una salida vacía nunca es verde

`correr.js` medía el código de salida, que dice si el proceso terminó bien —no
si la suite **comprobó** algo. Ahora cuenta las marcas de aserción (`✓ ✅ ✗ ❌`,
porque las suites de este repositorio usan las dos familias) y el conteo final
`N/M`; sin ninguna de las dos, la suite sale con `?` **NO CONCLUYENTE**, se
lista aparte de las que fallaron —piden cosas distintas— y **hace fallar la
corrida**.

Demostrada con una suite que solo hace `process.exit(0)`: sale «? NO
CONCLUYENTE · no imprimió ni una aserción ni un conteo» y la corrida termina
en 1. Es el caso exacto de la v962, donde un TypeError dejó la salida muda y
leerla como pase o como fallo habría sido igual de falso.

#### Ningún parámetro por omisión mide una estructura vacía

Barridas las doce funciones de `js/70` que reciben un registro, quedaba **una**
de la familia: `fichaDe`, que es la que produce el veredicto. Las demás ya
tomaban el registro actual.

Y acá **medir desmintió mi propia afirmación**, que es lo que la regla existe
para hacer: escribí que una ficha sobre `{}` saldría con «Confiabilidad
inquebrantable», y la aserción devolvió **`sin-datos`** — los mínimos de la
v791 ya impiden dictaminar sin casos ni hechos. Así que el peligro era menor
del que declaré: una ficha muda, no un veredicto falso. Se arregla igual
—medir la nada teniendo el registro al lado es medir otra cosa de la que se
dice medir— pero el motivo queda escrito como es, y el comentario del código
también se corrigió.

La guarda se mide sobre las FIRMAS y no buscando una cadena. Y su primera
versión estaba mal de una manera que vale anotar: `([\s\S]{0,400}?)\n` con
cuantificador perezoso captura **la cadena vacía** —es lo más corto que
cumple—, así que denunció las doce funciones por no encontrar nada en ninguna.
Se corta por índice, que es la lección de la v961 con el extractor de tablas.
Demostrada devolviendo el `{}`: sale con los cuatro nombres.

### Una guarda de la v961 citaba una línea literal

«La cuenta APLICA el criterio» exigía `if (g.cuenta) crudo[k]++;` palabra por
palabra, y esta tanda le añadió el conteo por vía dentro de ese bloque. Se
puso roja por un cambio legítimo. Ahora pide la forma —que `g.cuenta` guarde
el conteo— y no el renglón exacto. Es la lección de la v890 otra vez.

## Un indicador no cuenta lo que no está en el registro (v964)

Tres cosas, y la primera es la consecuencia de lo que la v963 midió: la única
vía sólida de I-13 —la Directiva Presidencial 01 del 3 de septiembre— **no
era una entrada del registro**. Vivía en el `contrapunto` de otra.

> Mientras eso siga así, I-13 no cuenta 1: cuenta `sin_base_registrada`. Un
> indicador no puede contar lo que no está en el registro, aunque el hecho
> sea cierto.

### La declaración dice en qué ENTRADA está el acto

La v963 hizo que cada declaración dijera **por cuál renglón** del criterio
entra. Faltaba la otra mitad, y es la que se cobró: la vía puede apuntar a un
acto que nadie registró, y entonces la cifra publicada no se puede abrir.

Así que `indicadoresPor` pasa de una cadena a un objeto con las dos cosas:

```json
"indicadoresPor": {
 "I-13": { "via": "instrucción sobre contenido, oportunidad o forma de difusión de información técnica",
           "base": "directiva-presidencial-01-comunicaciones" }
}
```

Y la base tiene que **existir**: `sin-base-registrada` es una salida nueva de
la puerta, con dos causas dichas aparte —falta el campo, o falta el hecho—,
porque para quien escribe son dos tareas distintas (v934).

**La base es obligatoria incluso cuando el acto es el de la propia entrada**,
donde se nombra a sí misma. Con la base opcional esto no cazaría nada: el
autor del caso del Dane simplemente la habría omitido, que es lo que pasó.
Entre fallar abierto y fallar cerrado se falla cerrado (v880).

Las entradas no tenían identificador y **40 fechas se repiten**, así que una
base no se podía referenciar por fecha. Seis entradas ganan `id` —las cinco
que son base de una declaración y el caso de control—, con la unicidad
comprobada.

### Las dos entradas, con sus fuentes

Medidas contra prensa antes de escribirlas, que es la regla de la v863
aplicada a un registro sobre una persona real:

| | |
|---|---|
| **Directiva Presidencial 01**, 3 de septiembre de 2026 | lineamientos de comunicación: ministros, directores y representantes legales del orden nacional deben consultar y coordinar previamente sus participaciones en medios. Su aplicación al Dane quedó documentada el 7 de septiembre, con la rueda de prensa de la inflación cancelada treinta minutos antes |
| **Decreto 1260**, 19 de agosto de 2026 | Valencia reemplaza a Piedad Urdinola en el Dane |

De la directiva se confirmaron **el número y la fecha** contra varios medios
antes de escribirla, y no se citó una nota de la FLIP fechada el 2 de
septiembre cuya relación con este acto no se pudo establecer: citar lo que no
se puede fechar contra el hecho es fabricar respaldo.

#### El relevo entra como CASO DE CONTROL, y eso es media tanda

No cuenta para ningún indicador, y su `contrapunto` dice por qué: es un
cambio ordinario de gobierno en un cargo de libre nombramiento y remoción, y
cae en el renglón de exclusión. Es **quince días anterior** a la directiva y
a la controversia por la difusión, así que leerlo como coincidente con ella
sería invertir el orden de los hechos.

Está en el registro precisamente porque **un registro que solo guarda lo que
cuenta no permite comprobar que el criterio distingue**: sin este hecho, que
el indicador no dispare acá no se puede ver. Es la lección de las veinticinco
tandas de material pobre, dicha sobre datos reales en vez de sobre un
fixture.

#### Y la declaración se mudó de entrada

Estaba en la entrada de la **remoción** del 14 de septiembre, cuyo acto es
justamente lo que el `excluye` rechaza. El acto que I-13 cuenta es la
instrucción de difusión, así que la declaración vive ahora en la entrada de
la directiva. La de la remoción lo dice en su `contrapunto`, para que nadie
lo lea como un descuido.

**I-13 = 1, y ahora su cifra se puede abrir.**

### La marca de no validado, junto a la cifra y calculada

`validado: false` y `gobiernos anteriores probados: 0`, en la tabla de
indicadores y no en una nota al pie — un indicador de un solo caso que no se
puede contrastar se parece demasiado a una medición.

Tres decisiones, cada una con su razón:

* **El conteo se CALCULA.** Un número escrito a mano dentro de un texto es
  una cifra que envejece sola (v903), y acá además es la que tiene que
  quitarse cuando el trabajo de archivo entre. No hay bandera que nadie tenga
  que acordarse de bajar.
* **«Probado» exige las dos mitades**: que el registro anterior haya pasado
  por la misma clasificación —así el criterio se pudo evaluar ahí— **y** que
  no dispare. Sin la primera, «no dispara» no significa que distinga:
  significa que no hay material, que es exactamente lo que la v963 midió.
* **La marca es solo para los indicadores de origen PROPIO**, y `origen` sin
  declarar se lee como propio. Un indicador nuevo nace marcado; y ponérsela a
  los siete la dejaría sin significar nada, que es como muere una alarma
  (v886).

Queda medido y **no hecho**, para la tanda que lo quiera: los criterios de
I-04, I-05 e I-07 también se escribieron mirando este registro (v961), así
que cargan una versión más débil del mismo riesgo. Lo que el pliego fija es
el indicador, no su `incluye`.

### La corrida hacia atrás no se investiga desde acá

Instrucción literal: *«no investigues los gobiernos anteriores por tu cuenta.
Eso es trabajo de fuente y de archivo, no de código.»* Queda como pendiente
medido, con lo que la v963 dejó averiguado: el registro de Petro son 32
hechos escogidos de cuatro años, ninguno clasificado con los insumos de la
Capa 1, y de Duque y Santos no hay registros. Por eso `probados` da 0 y la
razón lo dice con esas palabras.

### El trinquete del contrargumento medía una cifra que crece sola

Salió al entrar las dos entradas: el techo de la v957 se puso en rojo con
**202 sin revisar sobre un techo de 200**, y nadie había dejado de revisar
nada — el registro creció.

Es un defecto de construcción y valía encontrarlo: **un trinquete absoluto
sobre una cantidad que crece con el registro se rompe con la primera entrada
nueva**, incluida la que escribe la rutina diaria. Un trinquete tiene que
medir la cosa que solo debe moverse en una dirección, y esa es lo REVISADO,
que puede subir y no bajar. Con eso un registro que crece no se castiga y
des-declarar un contrargumento —que es lo que había que impedir— sigue
saliendo en rojo.

### La guarda de la escala tipográfica daba rojo sobre código correcto

`font-size: var(--t-7)` salía denunciado. La causa es un agujero de
retroceso: con `/font-size:\s*(?!var\(--t-\d\))/` el motor cede el espacio
que `\s*` ya había tomado, la mirada negativa se evalúa sobre « var(...)» y
pasa. La mirada va **pegada a los dos puntos y se traga ella misma el
espacio**.

No es una guarda aflojada: sigue denunciando `.92rem` y `13px`, comprobado
contra los cuatro casos. Una guarda con falsos positivos termina siendo una
lista de excepciones que envejece (v895).

### Y un parche mío que truncó una suite entera

El más caro de la tanda y enteramente mío:

```python
io.open(p, 'w', encoding='utf-8').write(io.open(p, encoding='utf-8').read().replace(A, B, 1))
```

`io.open(p, 'w')` se evalúa **antes** que el argumento, así que trunca el
archivo y lo que se lee después son cero bytes. `tficha.js` quedó **vacío**.

Y lo que lo hace de esta familia: **no falló nada**. El comprobador de
sintaxis pasó —un archivo vacío es JavaScript válido—, la suite salió con
código **0** y no imprimió una sola línea. Es exactamente el caso que la
v963 acababa de enseñar a no leer como verde, cobrado en la tanda siguiente
y contra su propio autor; sin `correr.js` marcando NO CONCLUYENTE, esto entra
a `main` como una suite en verde que no comprueba nada.

Dos reglas de las baratas:

* **un parche lee en una variable y escribe una vez al final**, nunca
  leyendo dentro del `write`;
* y **después de un parche se mira el TAMAÑO del archivo**, no solo que
  compile. `wc -c` cuesta un segundo.

Se recuperó con `git checkout --` y se rehízo el parche entero, que es lo
correcto: reconstruirlo a mano habría dejado un archivo parecido y no el
mismo.

### Demostrado contra la v963

Tres demostraciones, cada una revirtiendo **solo lo que decide**:

* con el registro de la v963 —el acto sin registrar— I-13 sale
  **`n13: 0` con motivo `sin-base-registrada`**, que es literalmente lo que
  se pidió;
* neutralizando la comprobación de la base, las dos declaraciones sin acto
  registrado cuentan: «8 declaradas · 5 fuera» donde van 7, y «3 de 8»
  contadas donde va 1;
* neutralizando la validación, «sin declarar», «null» y **0 marcas en el
  papel**.

`tficha` cierra en 176/176.

## La marca va en los cuatro criterios, con su gravedad (v965)

La v964 marcó como no validado solo a I-13, razonando que ponerle la marca a
los siete la dejaría sin significar nada — la regla de la v886 sobre las
alarmas que mueren por repetidas. **El razonamiento estaba mal por el otro
lado**, y la corrección es del usuario:

> Que solo I-13 lleve la marca sugiere que los otros están validados, y no lo
> están.

Los criterios de I-04, I-05 e I-07 —sus listas de `incluye` y `excluye`— los
escribió la v961 **leyendo este mismo registro**. El pliego fija el
indicador; los bordes los dibujamos nosotros. Así que tampoco están
contrastados, y no marcarlos es una afirmación tácita de que sí.

**Lo que salva la marca de morir por repetida no es ponérsela a uno: es que
las cuatro no digan lo mismo.**

### La gravedad va en su propio campo

`origenCategoria`, con dos valores y su texto:

| | Qué significa |
|---|---|
| `juridica-preexistente` (I-04, I-05, I-07) | la categoría existe sin este proyecto —un decreto de emergencia, el artículo 113, una tutela—. Lo que se dibujó mirando el registro son sus **bordes** |
| `construida-para-el-caso` (I-13) | acá se inventó **la categoría misma**. Es la que más urge contrastar |

Los cuatro llevan `validado: no` hasta que su criterio corra contra un
gobierno anterior con material suficiente.

Tres decisiones de forma, cada una con su razón:

* **La marca es de los indicadores que tienen CRITERIO escrito**, no de los
  siete. Los otros tres —I-06, I-09, I-10— salen directos de la clasificación
  de la Capa 1: no hay bordes dibujados por nadie que contrastar. Hay una
  aserción para eso, porque sin ella la marca sí se extendería a todo.
* **Sin declarar se toma por la GRAVE.** Un criterio nuevo nace marcado como
  construido para su caso: es el canje de la v880 otra vez.
* **`origen` se retiró.** Ya no decidía nada —la marca la decide tener
  criterio, y la gravedad la decide `origenCategoria`— y un campo que no
  decide es lo que la v885 enseña a no dejar.

Y hay una guarda contra que la distinción se vuelva decorativa: **las dos
categorías tienen que estar en uso**. Si un día todas cayeran en la misma, la
marca volvería a decir lo mismo en los cuatro sitios y la guarda lo dice.

### Una fuente de EFECTO no prueba el acto

El usuario dio por buena la nota de la FLIP del 9 de septiembre —posterior al
hecho— con una condición: *«entra como fuente de efecto de la directiva, no
de su expedición»*. Verificada: es del 9 de septiembre, seis días después de
la directiva, y la nombra entre lo que objeta. **Ya estaba citada desde la
v964**; lo que faltaba era que el dato lo dijera.

La entrada de la directiva tiene cuatro fuentes y **solo una publica su
texto**. Las otras tres documentan lo que produjo: la cancelación de las
ruedas de prensa del Dane, el pronunciamiento de la FLIP y la objeción de los
exdirectores. Sin decirlo, una cobertura de reacciones se lee como prueba de
que el acto se expidió — que es el mismo defecto de la v964 una capa más
abajo.

Cada fuente lleva ahora su `rol`, y la guarda es la que importa: **donde los
roles se declaran, al menos una fuente tiene que documentar el ACTO**.

**El alcance va dicho y no disimulado:** el rol está declarado donde importa
y la guarda muerde donde está declarado. Al medirlo apareció que **veinte
entradas usan todavía la forma antigua `fuente` + `url`**, que no puede
llevarlo — dos maneras de codificar las fuentes, o sea la clase B, que queda
medida para su propia tanda.

#### Y medir evitó un hallazgo falso

La entrada del Decreto 1171 declara I-04, cuenta, y su `fuentes` está vacío:
parecía una cifra publicada sin una sola fuente. No lo es — usa la forma
antigua. Una guarda escrita leyendo solo `fuentes` habría denunciado veinte
entradas sanas.

### El barrido de trinquetes: hay dos, y el segundo NO tiene el defecto

Lo pedido: *«cualquier trinquete sobre una cantidad que crece con el registro
tiene el mismo defecto. Los que midan pendientes deben pasar a medir lo
hecho.»*

Barridos `revisar.js` y las 122 suites, en este proyecto hay **dos**
trinquetes. El del contrargumento es el que la v964 arregló. El otro es el de
`tipoFuente`, y medido no tiene el defecto:

* los **19 en blanco son todos del 4 al 17 de agosto**, la apertura del
  registro;
* de las **25 entradas más recientes, cero** están sin tipo.

O sea que ese pendiente **no crece con el registro**: crece solo si alguien
añade una entrada sin decidir de qué fuente es, que es exactamente lo
prohibido. Convertirlo a un piso sobre lo hecho lo **debilitaría** — una
entrada nueva sin tipo dejaría de saltar.

**El discriminador no es «¿mide un pendiente?» sino «¿puede ese pendiente
crecer sin que nadie haga nada mal?».** Si puede, el techo absoluto está mal
y hay que medir lo hecho; si no puede, el techo es lo correcto. Queda escrito
al lado del trinquete, con la medición, para que la próxima tanda no la
repita.

### Demostrado contra la v964

Devolviendo **solo la regla de a quién se marca**: «un criterio del pliego
también sale sin validar» en rojo con `null`, **una marca en el papel donde
van cuatro**, y la distinción de gravedad en «1 · 0».

`tficha` cierra en 178/178.

## La exención de la guarda de rol se ve (v966)

La v965 dejó escrito, con todas las letras, que su guarda —«al menos una
fuente documenta el acto»— no corre sobre las veinte entradas que usan la
forma antigua `fuente` + `url`. **Estaba en la bitácora y no en la ficha**, y
el usuario lo señaló por lo que es: la cuarta vez que aparece el mismo
patrón, ahora en su forma más mansa.

Desde la pantalla, una comprobación que no corre y no lo dice se lee como una
que pasó. El principio queda enunciado arriba, en «Ninguna comprobación
desactivada es silenciosa», y acá está su cuarta aplicación.

### Cuatro estados, no dos

El estado se **calcula** de la forma de la entrada —no se escribe en el
registro, que sería una segunda codificación de un hecho que ya está en los
datos—:

| | Qué significa | Qué pide |
|---|---|---|
| `ok` | declara sus roles y al menos uno documenta el acto | nada |
| `sin-acto` | declara los roles y ninguno es del acto | el fallo que la v965 persigue |
| `sin-declarar` | sus fuentes podrían llevar rol y nadie lo escribió | **un renglón por fuente** |
| `no-comprobable-esquema-antiguo` | guarda su fuente en `fuente` + `url`, que no tiene dónde ponerlo | **una migración** |

Los dos últimos son «la comprobación no corrió acá» por razones distintas, y
por eso se cuentan aparte: confundirlos manda a migrar un esquema cuando lo
que falta es teclear una palabra. Es la distinción de la v899.

Hoy, sobre las cinco entradas que declaran indicador: **corrió en 1, no corrió
en 4** —3 sin roles declarados y 1 con esquema antiguo—.

### El Decreto 1171 sale por su nombre

Es el caso que el usuario puso a la vista: declara I-04, **cuenta en la
cifra**, y su rol de fuente no se puede verificar. La ficha lo nombra, con su
fecha y su razón, porque un recuento sin los casos deja al lector sin poder
ir a mirar cuál es.

**No se migraron las veinte**, que es lo que se pidió: lo que se hizo es que
su exención se vea.

### Y lo que salió de paso

* **Una colisión de nombre más**, la tercera en estas tandas: `cx` ya estaba
  declarada en ese ámbito de `tficha`. Lo cazó el propio JavaScript. Las
  otras dos fueron `cmp` (v958) y `nombreDeParte` (v932).
* **Mi propio `<p>` de la lista bajaba a 12,48 px** y la guarda de texto
  corrido de la v791 lo denunció con razón. Subido, no aflojada.
* **La captura de la prueba cortaba a 600 caracteres** y el caso que la
  aserción persigue es el cuarto de la lista: medía el principio del bloque y
  decía medir el bloque. Es la lección de la v935 —un ancla por distancia
  envejece— dicha para una captura.

### Demostrado contra la v965

Dos demostraciones, cada una revirtiendo solo lo que decide:

* sin pintar el recuento, «la ficha lo dice con su recuento» sale en rojo con
  la cadena vacía, que es exactamente la exención silenciosa;
* sin distinguir el esquema antiguo, el Decreto 1171 sale como
  **`sin-declarar`** y el recuento da «4 sin declarar · 0 con esquema
  antiguo»: declarar mal por qué no se pudo comprobar es la falta de la v867.

`tficha` cierra en 183/183.

## La pantalla del módulo presidencial: la especificación, medida y NO hecha

Llegó el 19 de septiembre de 2026 como una página HTML de muestra, con la
instrucción explícita de **no implementarla todavía**: las dos tareas del
handoff siguen primero. Lo que sigue es la medición contra lo que el módulo
pinta hoy, para que la tanda que la tome no empiece por averiguar lo mismo.

**El resumen en una línea: de los siete gráficos que pide, CERO se pueden
dibujar hoy leyendo del registro.** No por falta de código de dibujo —hay
cuatro funciones y la infraestructura de series ya existe— sino por falta de
datos. Es exactamente la razón por la que el handoff pone el registro
primero.

### 1 · Dos rojos distintos

Lo pedido: el rojo solo para hallazgo verificado con fuente; los pendientes
internos en gris y en su propio bloque al final.

Medido, el defecto es **de posición más que de color**:

| | Hoy |
|---|---|
| Casos confirmados, contradicciones, FODA·amenaza | `--rojo:#C95A55` |
| Control de calidad · casillero que **falla** | `#9A3C38` con una ✕ — misma familia |
| Marcas de `validado: no` y cobertura de rol (v965, v966) | ámbar `#b26a00`, **no** rojo |
| Bloque gris de pendientes al final | **no existe** |

O sea que los pendientes ya están medio separados por color —el ámbar de la
v965 y la v966 no es el rojo de un caso— y **la ✕ roja del control de calidad
sí colisiona**: «202 contrargumentos sin revisar» es deuda nuestra y sale con
la misma marca que un hallazgo.

Lo que de verdad los mezcla es el ORDEN. Medido, la ficha va así:

```
placa · Capa 1 · Capa 2 (con las marcas ámbar y la cobertura de rol)
      · Capa 3 · Capa 4 (marco + editorial + CONTROL DE CALIDAD)
      · Casos de corrupción · Contradicciones · Rasgos
```

Los pendientes están **repartidos por toda la página**, y el control de
calidad se lee ANTES que los casos de corrupción. Juntarlos en un bloque al
final es mudanza de tres sitios, no un cambio de color.

### 2 · Un hallazgo como héroe

Hoy lo primero es **el veredicto**, en `--t-1` (máximo 2,9 rem, «el texto más
grande del módulo» según su propio comentario). La spec quiere una **cifra**
a 5,2 rem.

Y el cambio de fondo no es el tamaño: es que **hoy lo primero es un juicio
sobre una persona y la spec pone un hecho con fuente**. Eso va en la
dirección de lo que este módulo ya defiende —una cifra comprobable se sostiene
donde un veredicto calculado se discute— así que la spec es más conservadora
que la pantalla, no menos.

**Pero la cifra del héroe no está en el registro.** Medido: `94,42`, `86,96`,
`PGN` e «inversión pública» dan **cero coincidencias** en las 170 entradas.

### 3 · La opinión firmada en serif

Medido: **cero reglas serif en `css/70`** — el módulo entero es la pila del
sistema. Y el editorial se pinta en `--t-8` (.84 rem), que es **el tamaño de
texto corrido más pequeño de la escala**, dentro de una caja gris a trazos.

O sea que hoy no es que la opinión no se distinga de los datos: es que **se
pinta más chica que los datos**, que es lo contrario de lo que la spec pide.
La spec la pone en 1,18 rem serif. El cambio es barato y no toca ningún
cálculo — la regla de oro de la v957 se cumple igual.

### 4 · Los siete gráficos, uno por uno

Hoy hay cuatro funciones de dibujo: `grafPorFuente` (barras horizontales),
`grafSerie` (línea de una serie), `grafContradicciones` y `grafDeuda`. Las
series viven en `indicadores` del JSON —`dolar`, `deudaSerie`, `aprobacion`,
`consulta`, `bombardeos`, `deuda`, `cocaina`— así que **el molde de «leer del
registro» ya es el correcto**: lo que falta son las series.

| # | Gráfico | ¿Hay dato? |
|---|---|---|
| 1 | Torta · composición del presupuesto | **no** — ninguna serie de PGN |
| 2 | Barras divergentes · variación real por sector | **no** |
| 3 | Agrupadas · Defensa sola contra Defensa+Policía | **no** |
| 4 | Serie · presupuestado contra pagado | **no** — 0 entradas nombran Huila |
| 5 | Cadena · decisión nacional → herramienta → uso municipal | **no** — 0 ESMAD, 0 Manrique |
| 6 | Organigrama · filtro por nivel de gobierno | **la cuenta sí, el material no** |
| 7 | Barras · frecuencia de técnicas de distorsión | **no** — `calidadDelEncuadre` 0 de 170 |

El **6** es el que más vale explicar, porque parece el fácil y no lo es: la
cuenta existe desde la v941 (`fueraPorNivel`, `sinNivel`) y está probada. Lo
que no existe es material que dibujar — el registro tiene **7 casos, los
siete nacionales, ninguno municipal y ninguno sin fecha**, mientras la spec
dibuja 22 / 13 / 5 / 4. Un organigrama de un filtro que no rechaza nada es el
verde que este proyecto lleva veintiséis tandas persiguiendo: pasaría por no
tener nada que rechazar.

El **7** ya está declarado como pendiente en la v961 y la v962, con su nombre:
`calidadDelEncuadre` y `signoPolitico` son los dos campos que volverían
computables los dos casilleros de control de calidad que hoy salen «no se
pueden correr».

**Las cinco reglas de los siete, medidas aparte:**

* **leen del registro** — el patrón ya es ese, y es lo que hace que la tabla
  de arriba sea una lista de datos que faltan y no de código que falta;
* **eje desde cero** — ya se cumple: `grafPorFuente` calcula su tope con
  `ceil(max/10)*10` desde cero;
* **trama distinta para lo que está en trámite** — el mecanismo existe:
  `.dudosa` raya la barra de una encuestadora sin metodología publicada. Se
  reusa, no se inventa otro;
* **fuente y fecha DENTRO del gráfico** — hoy no: `tarjetaGrafica` las pinta
  en `sp-graf-src`, **debajo** del cuerpo (9 llamadas a `pintarFuentes`). Es
  el único de los cinco que pide trabajo de dibujo;
* **nunca números escritos a mano** — es la regla de la v903 dicha para un
  gráfico, y la razón por la que la tabla de arriba no se puede saltar
  metiendo las cifras en el código.

### Y una pregunta que queda abierta

La muestra trae **una identidad visual entera** —Archivo + Source Serif 4,
señal `#B8112E`, papel `#EDEFF2`, y modo oscuro completo— distinta de la del
módulo, que va con la pila del sistema, celeste `#34CCFE`, amarillo `#FABD0A`
y marfil `#F7F6F1`, y que **no tiene modo oscuro** (0 reglas
`prefers-color-scheme` en `css/70`).

No se supone cuál de las dos cosas es: si la muestra es la identidad nueva de
esta pantalla, o si es una maqueta para enseñar las reglas y la paleta se
queda como está. Adoptarla entera cambiaría la marca de un módulo que
comparte hoja de estilo con el resto, así que lo decide quien la escribió.

## Las veinte migradas, y el caso que no se pudo cerrar (v967)

Las dos tareas del traspaso, en su orden, y con una regla que las gobierna:
**el registro es el cuello de botella, no el código.** Ninguna de las dos
escribe una línea de `js/`.

    v966   1 de 5 declarantes con la guarda de rol corriendo · 20 entradas con esquema antiguo
    v967   5 de 6 · 0 con esquema antiguo · 4 casos del dossier entrados

### 1 · La migración, y lo que había debajo

Las veinte entradas con la forma antigua `fuente` + `url` pasan a `fuentes[]`
con su `rol`. Al hacerlo salieron tres cosas que no estaban a la vista:

* **Cuatro entradas llevaban las DOS formas a la vez.** Tres eran la misma
  dirección repetida y se quitaron. La cuarta no: «Nombra su gabinete: 18
  ministros por el Decreto 1136» tenía en el campo viejo **la única fuente que
  documenta el acto**, y `fuentesDe` prefiere `fuentes[]` cuando existe, así
  que esa dirección **no se enseñaba en ninguna pantalla**. Estaba en el
  archivo y no en la ficha, que es la forma de la v966 en los datos en vez de
  en una comprobación. Se recuperó, con su rol.
* **El parche abortó la primera vez y no escribió nada**, que es lo correcto:
  la aserción de que no quedara ninguna entrada con el campo viejo se cayó
  sobre esas cuatro. Medio archivo migrado habría sido mucho peor, y la
  confirmación impresa es lo que separó «no entró» de «la prueba sigue roja».
* **Cinco se migraron sin rol.** No se les inventó: una fuente cuyo papel no
  se puede establecer se queda `sin-declarar`, que es un estado que la ficha
  cuenta y nombra desde la v966.

#### `rol` no es el eje anuncio/acto, y conviene no confundirlos

Se parecen y piden cosas distintas. El `excluye` de la v963 —«anuncio sin acto
administrativo expedido»— decide si un hecho CUENTA en un indicador. El `rol`
dice si una fuente documenta **el acto de esta entrada o lo que vino después**.
Una cobertura del mismo día, con el verbo que use, es `acto`; la reacción de
un tercero es `efecto`. Juntarlos empujaría a `efecto` toda la cobertura
contemporánea y dejaría la guarda de la v965 sin significar nada.

### 2 · Cuatro casos del dossier, con sus fuentes buscadas una por una

El dossier trae los NOMBRES de los medios y **no sus direcciones**, y las 206
fuentes de los dos registros llevan una: entrar un caso con una fuente sin
dirección habría sido una fuente que nadie puede comprobar. Así que cada una
se buscó y se confirmó antes de escribirla. Lo que entró:

| Caso | Qué añade |
|---|---|
| **PGN 2027** (14 sep) | el reparto por sector, la variación **real** deflactada y la agregación Defensa+Policía. La entrada del 7 de septiembre ya traía el monto |
| **Vuelos presidenciales** (9 sep) | 103 trayectos y $1.117 millones en 18 días, del reporte de la FAC entregado tras una tutela. Declara **I-07** |
| **Tarifas de energía** (8 sep) | «la tarifa tiene que subir» en la Comisión Quinta, clasificada como contexto estructural y no como medida |
| **Recorte al deporte 2027** (14 sep) | ~40 % menos, con el **primer contrargumento oficial revisado** del registro |

**La aritmética del dossier se comprobó antes de publicarla**, porque una
cifra deflactada mal es indistinguible de una bien: los seis sectores dan
exactamente lo que el dossier dice, y el 6,24 % con el que se deflacta **es
una entrada del propio registro** (7 de septiembre, DANE). No hay ningún
número que venga de fuera y no se pueda abrir.

Tres se apartaron con su razón medida, y una **no se duplicó**: el FENOGE ya
está en `casos` como señalamiento con todas sus cifras. Lo que sí le faltaba
era la dirección del artículo —sus dos fuentes eran **la portada del medio**,
que no prueba nada— y que dijera que el 32,2 % tiene dos lecturas en la
prensa: unos lo cuentan contra los honorarios del antecesor y otros contra lo
previsto para el cargo. Van las dos, sin elegir.

### El trinquete del contrargumento sube por primera vez

De 0 a 1 revisado, y el piso sube con él. Es la primera vez que ese pendiente
baja desde que se abrió en la v957, y el trinquete existe para que no se pueda
des-declarar.

### Lo que NO se cerró, y es el hallazgo de la tanda

**«El Gobierno suspende la programación de las 20 emisoras de paz»** (18 ago)
declara I-04 y su única fuente es la alerta de la FLIP: **documenta la
reacción, no el acto.** Es exactamente el caso que el traspaso anticipó, y
debería quedar en `sin-acto`. No puede:

> `revisar.js` exige `soloEfecto.length === 0`, así que una entrada cuyos
> roles sean todos `efecto` pone la comprobación en **rojo**. Y `rolDeFuentes`
> en `js/70` trata `sin-acto` como uno de sus cuatro estados, lo cuenta y lo
> nombra en la ficha.

**Los dos no dicen lo mismo**: el módulo dice «cuéntalo y nómbralo», la guarda
dice «esto es un fallo». Con la guarda como está, el único camino para
registrar honestamente ese caso es dejarlo `sin-declarar` —que es donde
está—, y ahí se ve igual que las 151 entradas que nadie ha mirado. La
exención dejó de ser silenciosa en la v966; lo que falta es que el estado que
la v967 necesita sea **registrable**. Esa decisión no se tomó acá.

Y la razón de no forzarlo con una fuente: la candidata a documentar el acto
—una nota que por su título sí lo hace— **no se pudo abrir desde esta
máquina**, el proxy bloquea ese dominio. Apoyar un cambio de estado de la
guarda en un titular que no se leyó es lo que este proyecto llama inventar.
De paso queda dicho que, según la prensa, la instrucción se impartió **por
WhatsApp desde Inravisión**, lo que pone en duda la vía que la entrada
declara —«directiva que altera el régimen ordinario de difusión»—. Es la
segunda decisión que queda abierta.

**El Decreto 1171 sí se cerró**, y por la diferencia que importa: su acto es
un decreto **identificado por su número**, descrito de forma concordante por
varias fuentes independientes, mientras su única fuente era un medio español
escribiendo sobre empresas españolas en la reconstrucción — que es lo que
vino después. Ahora tiene tres fuentes de acto y la que tenía queda declarada
como lo que es.

### Una aserción que citaba un caso por su nombre

`tficha` exigía que el recuento nombrara **«Decreto 1171»**. Al resolverlo se
puso roja por un cambio legítimo: es la constante del material metida dentro
de la comprobación, que es la lección de la v890. Ahora mide la **forma** —que
el recuento nombre uno por uno los casos que no se pudieron comprobar, sean
los que sean, y que los nombre **en la pantalla**—, así que sirve para el caso
de hoy y para el de mañana. Más precisa, no más laxa.

### Y una de método que se cobró dos veces en la misma noche

`curl` a cualquiera de esos medios devuelve `000`: el proxy de esta máquina
los bloquea, igual que a Overpass y a `ags.esri.co`. Así que **la dirección de
una fuente no se puede verificar abriéndola desde acá**, y el único canal es
la búsqueda. Queda escrito porque la tentación de dar por buena una dirección
que uno mismo compuso es exactamente lo que produce una fuente falsa con
aspecto correcto.

## Un estado que se cuenta, y la guarda que se quedó sin material (v970)

Las cinco respuestas al informe de la v967. Tres cambian el registro o las
guardas; una no se hace por decisión del usuario y otra confirma tres
apartados. Y la primera **corrige una decisión mía de la v967**.

### 1 · `sin-acto` es un estado y no un fallo, y manda el módulo

La v965 escribió la guarda de rol como un fallo: `soloEfecto.length === 0`. La
v967 se topó con el primer caso real —las emisoras de paz, cuya única fuente
documenta la reacción de la FLIP y no el acto— y lo dejó en `sin-declarar`
para no poner la corrida en rojo.

El usuario lo cortó por lo sano, y tiene razón:

> Como está hoy nos empuja a declarar `sin-declarar`, que MIENTE: dice «nadie
> escribió el rol» cuando lo cierto es «ninguna fuente documenta el acto». Es
> peor que el rojo.

**Y el módulo ya lo tenía bien desde la v966.** `coberturaDeRol` calcula
`corrio: por.ok + por['sin-acto']`: la comprobación SÍ corrió, y su resultado
fue que ninguna fuente documenta el acto. Los que no corrieron son los otros
dos —roles sin declarar, esquema antiguo—. O sea que la guarda y el módulo
decían cosas distintas del mismo estado, y la que estaba mal era la guarda.

Es el mismo principio que este proyecto lleva cinco tandas aplicando y que
está arriba en «Ninguna comprobación desactivada es silenciosa», con un
agravante que conviene tener escrito: **una guarda que se pone roja sobre un
hallazgo empuja a esconder el hallazgo.** El coste de un rojo mal puesto no es
un renglon en una lista: es que la salida barata sea mentir en el registro.

`revisar.js` cuenta ahora las entradas sin fuente del acto y las nombra, con
su guarda de la guarda: que `rolDeFuentes` lo siga devolviendo y que
`coberturaDeRol` lo siga sumando en `corrio`. Demostrada quitando ese sumando:
sale «coberturaDeRol dejó de sumarlo: volvería a leerse como que no se pudo
comprobar».

### La guarda de MATERIAL se quedó sin material, y eso es lo interesante

Con la declaración de las emisoras retirada (punto 2), las cinco entradas que
declaran indicador tienen su fuente del acto. La guarda de la v966 —«MATERIAL
· hay entradas declarantes sobre las que la comprobación NO corre»— se puso
**roja sobre un registro que había MEJORADO**.

Esa es la señal de que medía el número y no la propiedad. Lo que hay que
guardar sobrevive al cero:

* el recuento se calcula sobre TODAS las que declaran indicador y sobre
  ninguna más —el filtro y el denominador son la misma lista—;
* y la ficha tiene **escritas las dos redacciones**, la de «corrió sobre
  todas» y la de «en N no pudo correr». Sin la segunda, la primera entrada
  sin fuente del acto entraría y la pantalla seguiría diciendo que corrió
  sobre todas.

#### El tercer estado del arnés, y por qué aquí NO hace fallar

`anotarSinMaterial` imprime `?` con su nombre y su razón, y el recuento final
lo cuenta **aparte** de las que fallaron: una fallada hay que arreglarla, una
sin material hay que mirarla —o se quedó sin él porque el registro mejoró, o
porque la función dejó de ver lo que medía—. Sumarlas mandaría a revisar lo
que está bien.

Es el `?` NO CONCLUYENTE que la v963 le puso a `correr.js`, y **la diferencia
con aquel hay que dejarla escrita porque es la tentación**: allá hace fallar
la corrida, porque una suite que no imprime nada es un defecto siempre. Una
guarda de MATERIAL se queda sin material cuando el registro mejora, y si eso
pusiera la corrida en rojo, la salida barata sería dejar el registro torcido
para que la guarda siga teniendo algo que rechazar — exactamente la presión
que el punto 1 vino a quitar.

#### Y la rama con material se mide contra un registro de mentira

Medirla contra el real sería volver a medir el número. `tficha` compone
cuatro entradas fabricadas, **una por estado**, y sobre ellas afirma la pieza
que decide: `n: 4 · corrio: 2 · sinCorrer: 2`, con `sin-acto` DENTRO de lo que
corrió. Una quinta entrada sin indicador comprueba que el denominador son las
declarantes y no el registro entero.

Lo que **no** se puede medir ahí es la redacción del DOM de esa rama: la ficha
se pinta una vez, con el registro real, y abrirle una costura para repintarla
con otro sería una puerta trasera de pruebas (v869). Eso lo cubre
`revisar.js`, exigiendo que las dos redacciones estén escritas — y queda
dicho como reparto de trabajo y no como cobertura completa.

Sobre el registro real se mide la otra mitad, que es la que la v970 compró:
que la ficha diga «corrió sobre todas», que **no** se marque en falta y que
**no nombre a nadie**. Esa última es la guarda contra pasarse de avisar: un
nombre ahí sería una entrada señalada por una exención que ya no tiene.

Demostradas contra el registro de la v967: las cuatro en rojo con el texto
viejo impreso —«5 de 6», y «El Gobierno suspende la programación de las 20
emisoras de paz» nombrado como «roles sin declarar»—.

### 2 · La declaración de las emisoras se cae, por dos motivos

La v967 dejó abiertas dos dudas sobre esa entrada y el usuario las cerró las
dos, la segunda de las cuales yo no había identificado:

* **la vía no encaja**: si la instrucción se impartió por WhatsApp desde
  Inravisión, eso no es «una directiva que altera el régimen ordinario de
  difusión»;
* **y no pasa el `requiere` de I-04**, que pide un acto expedido con documento
  primario o dato oficial y no admite `anunciado-sin-acto`. Solo consta el
  relato del medio.

La entrada **se queda** como hecho registrado sin indicador, con los dos
motivos escritos en su `contrapunto` y con la puerta abierta: si aparece el
acto —con su número o su radicado— la declaración vuelve. Borrar la entrada
habría sido esconder un hecho; dejarle la declaración, sostener una cifra
sobre un acto que nadie ha visto.

**Y medido, la cifra publicada no se mueve**: I-04 iba en 3 contadas de 4
declaradas y queda en 3 de 3. La declaración de las emisoras **ya estaba
fuera de la cuenta**, rechazada por el `requiere` del criterio —su
`tipoEvidencia` es `reporte-periodistico`—, o sea que el gate de la v961
estaba haciendo su trabajo y lo que se retira es la declaración, no la
cuenta. Eso confirma por medición el segundo motivo del usuario, y hay que
decirlo porque yo había anunciado que I-04 bajaría uno: **no baja**.

### 3 · Los $22 y los $44 billones no se contradicen: son dos componentes

La v967 entró la Ley de Rescate Social con una cifra y dejó la contradicción
anotada sin elegir, que es lo que se había pedido. El usuario la resolvió:

| | Qué es |
|---|---|
| $22 billones | recorte **ya ejecutado** en el presupuesto de 2026 |
| $21,4 billones | austeridad **dentro del** presupuesto de 2027 |

22 + 21 = 43, que es el «más de 43 billones entre 2026 y 2027» de Pulzo. Se
escriben como dos componentes con su año y su estado, y **no como un total**:
un solo número perdería que uno está ejecutado y el otro proyectado, que es
justamente lo que los distingue.

Lo que **sí** queda en `valores_en_disputa` es una sola cosa, y la palabra que
la produce va señalada: El Nuevo Siglo dice «$44 a $45 billones
**ADICIONALES**», y «adicionales» es incompatible con la suma. Las dos
lecturas se registran sin elegir.

De paso, la entrada gana su `id` y **sus siete fuentes quedan con rol** —dos
del acto, tres de efecto, y las dos nuevas del acto—, que es lo que la
migración de la v967 dejó como forma.

### 4 y 5 · Lo que no se hace, por decisión de quien firma

* **Alex Saab se queda fuera** hasta que el usuario decida la v941. No se
  entra.
* **Los tres apartados de la v967 eran correctos**, y Manrique en particular:
  el pendiente 18 sigue abierto y sin el decreto confirmado no se puede
  sostener la cadena de habilitación.

### 6 · Y una clase de error que se anota y no se persigue

Del hallazgo del Decreto 1136 —una fuente que existe en los datos y que
ninguna pantalla enseña— sale una tercera clase, con tres casos ya. Va
nombrada arriba, con su censo, en «Tres clases de error que se repiten»:
**dato presente e inalcanzable se ve igual que dato ausente.** No lleva
guarda, y por qué no está escrito ahí.

### La otra sesión publicó una v969 mientras tanto

Esto se escribió como v968 y al ir a subir `origin/main` ya iba en
**969-seguimiento-presidencial-ecopetrol-onu-decretos-terremoto**. Los nueve
archivos de versión salieron en conflicto por una sola cosa —el token,
comprobado con `git diff` antes de resolver— y se resuelve subiendo **por
encima de las dos**: es la **v970**, la regla del 7 de septiembre.

El registro sí se fusionó solo, y hubo que mirarlo entrada por entrada en vez
de creerle al «Auto-merging». La comparación por título daba una entrada suya
«perdida», y era la de la Ley de Rescate —la misma que yo había reescrito, con
otro título—: un falso positivo de mi propio barrido. Comprobado, la otra
sesión **no tocó** esa entrada, mi párrafo de `valores_en_disputa` sobrevive,
y su declarante nuevo —`decretos-emergencia-terremoto-18sep`— llega con su
vía, su base, su nivel y sus roles.

### El registro al cerrar

179 entradas, **6 declarantes y los seis con su fuente del acto**; cero con
esquema antiguo. I-04 en 4 contadas de 4 declaradas —las tres mías más la de
la otra sesión—, I-13 en 1, I-05 en 0, e **I-07 en 0 contadas de 1
declarada**. `tficha` 188/188, la batería 121/121, y `revisar.js` en verde con
un `?`.

#### El I-07 en cero está BIEN, y no se toca

Lo dejé escrito como «un estado anterior a esta tanda, medido y no tocado»,
que es tibio. El usuario lo dijo por su nombre y vale tenerlo:

> El documento de la FAC existe, pero nosotros no lo tenemos — lo conocemos
> por lo que la prensa publicó sobre él. El criterio está distinguiendo
> «existe un documento» de «tenemos el documento», que es justo lo que debe
> hacer.

Por eso su `tipoEvidencia` es `reporte-periodistico` y el `requiere` lo deja
fuera de la cuenta. **Es un pendiente de FUENTE y no de código**: conseguir el
reporte de la FAC —el pendiente 9 del dossier— y con él la declaración cuenta
sola, sin tocar una línea. Aflojar el criterio para que la cifra suba sería
exactamente la salida barata que la sección de arriba nombra.

## El tablero publica hechos, y dice cuánto retiene (v971)

La pantalla del módulo presidencial, con los siete gráficos, y la puerta de
publicación que decide qué de las 180 entradas sale como hallazgo. El orden
lo cambió el usuario a mitad de tanda —«implementamos la pantalla ahora, es
lo primero»— pero las dos mitades resultaron ser una: **la pantalla no se
puede escribir sin decidir antes qué publica.**

    v970   la ficha abre en el veredicto · 180 entradas, todas a la vista del mismo modo
    v971   el tablero abre en un HECHO con fuente · 116 publicadas, 64 retenidas y contadas

### La puerta: cinco motivos, nunca un booleano

`sePublica(e)` es el único sitio que decide, y devuelve su motivo porque «no
se publica por municipal» y «no se publica porque nadie declaró su
naturaleza» **piden cosas distintas**: la primera es del hecho, la segunda es
deuda nuestra. Un `false` las juntaría en una (v876).

| Motivo | Cuántas hoy |
|---|---|
| `no-verificado` · su naturaleza no está declarada como verificada | 56 |
| `en-circulacion` · es una afirmación en circulación, no un hecho probado | 8 |
| `otro-nivel` · municipal, distrital o departamental | 0 |
| `sin-fecha` · un hecho que no se puede situar no se puede contrastar | 0 |
| `defecto-propio` · le encontramos el defecto a la cifra al revisarla | 0 |

**Y el recuento se PUBLICA.** Si 64 entradas desaparecen de la pantalla sin
que nada lo diga, la exención se lee igual que un aprobado — que es lo que
este proyecto lleva seis tandas evitando. Lo que **no** se publica son sus
títulos: nombrarlas en pantalla sería publicarlas, que es justo lo que la
puerta viene a impedir, y hay una aserción que lo mide sobre las 64.

#### Tres de los cinco motivos son prospectivos, y hay que decirlo

Medido antes de escribir: de las cuatro cifras a las que **nosotros** le
encontramos el defecto —los $800 millones del festival, los «1.300 niños», el
«+400 %» de soldados, los $719.000 millones del SENA— **ninguna está hoy en
el registro.** Se revisaron y no se entraron, que es lo correcto.

Así que esa puerta no arregla un registro torcido: **impide que el que viene
lo tuerza.** Es exactamente la forma de la puerta de nivel de la v941, y vale
decirlo porque la rutina diaria escribe en ese archivo sin leer esta
bitácora. La lista de pistas vive en el propio registro y `revisar.js` la
cruza contra las entradas.

##### La guarda denunció un contrato que no tiene nada que ver

En su primera corrida salió en rojo sobre «Piden investigar un contrato
directo de la UNP por **$24.800 millones**», que contiene «800 millones».

Es la clase de la v895 —una guarda con falsos positivos termina siendo una
lista de excepciones que envejece hasta no significar nada— y **se arregla en
la forma, no con un renglón de exención**: la pista se busca con el borde de
la cifra delante, `(?<![\d.,])`, que es el mismo que la guarda de
concordancia de la v874 usa por la misma razón. Comprobada contra siete casos
de respuesta conocida: distingue «$800 millones» de «$24.800 millones» y
«1.300 niños» de «21.300 niños».

### El nivel se filtra en la puerta del score, y eso movió una cuenta

`hechosDelMandato` es por donde pasa TODO lo que cuenta —los indicadores, las
tasas por 100 días, los rasgos y la comparación— así que el filtro de nivel y
la marca `noPublicar` van ahí y no en cada consumidor (v867).

Eso destapó algo que hay que dejar escrito, porque parecía un fallo y no lo
es: `pasaElCriterio` **también** rechaza por nivel, y con mi cambio esa rama
dejó de dispararse desde los indicadores. Parecía la clase B —dos rutas para
un hecho— y medido no lo es: **`corridaHaciaAtras` llama a `pasaElCriterio`
sobre listas que NO pasan por esa puerta**, que es justamente la corrida sobre
el registro de un gobierno anterior. Ahí sigue siendo la única que lo
rechaza. Son dos caminos de entrada distintos, no dos copias.

Lo que sí cambia es lo que la suite mide, y **se apretó**: la declaración
municipal ya no llega al criterio, y hay una aserción que lo afirma por su
nombre en vez de contarla entre las siete de antes.

### Los siete gráficos, y los tres que NO se dibujan

La regla que el usuario fijó para los siete es la que decide la tanda:
**«leen del registro, nunca números escritos a mano»**. Con esa vara, medido:

| | Estado |
|---|---|
| Héroe · intereses de deuda contra inversión | **dibujado** |
| Composición del PGN 2027 | **dibujado** |
| Variación real por sector | **dibujado** |
| La misma plata, dos agregaciones | **dibujado** |
| Organigrama por nivel de gobierno | **dibujado** |
| Serie Huila: presupuestado contra pagado | declarado sin dato |
| Cadena decisión nacional → uso municipal | declarado sin dato |
| Frecuencia de técnicas de distorsión | declarado sin dato |

Los tres últimos componen una tarjeta que **nombra la fuente que le falta**
—la regla de la v849 y de la v880: un vacío se declara, no se calla—. El de
Huila se buscó dos veces y ninguna fuente publica las dos columnas para
2022-2024; escribir esas seis cifras en el código sería exactamente lo que la
regla del usuario prohíbe.

Las cuatro cifras del presupuesto no se acarrean: viven en un bloque
`presupuesto` del registro, con su `base` —la entrada que lo soporta—, su
`corte`, su `estadoProcesal` y sus fuentes. **La suma Defensa + Policía se
CALCULA de sus sumandos**: da 54,7 exacto, que es la cifra del pliego, y no
hay un total escrito que se pueda separar de lo que suma.

#### El organigrama es honesto sobre no tener nada que rechazar

Hoy el registro tiene 15 entradas con nivel declarado, **0 de otro nivel** y
165 sin declarar. Un filtro que no rechaza nada es el verde que este proyecto
lleva veintisiete tandas persiguiendo, así que el gráfico lo dice en su propia
nota en vez de presentarse como una medición.

### Los dos rojos, y por qué es de diseño y no de después

Dicho por el usuario mejor de lo que yo lo habría dicho: *«si implementa los
gráficos sin esto, la pantalla nueva muestra nuestra deuda técnica en rojo
como si fueran faltas del gobierno. Se ve mal y además es falso.»*

El rojo queda para hallazgo verificado con fuente. Los 201 contrargumentos
sin revisar, los criterios sin validar y el censo de lo retenido van en
**gris**, en su propio bloque y al final. Demostrado pintando ese bloque con
el rojo de hallazgo: la aserción se pone roja.

### El reset de iconos se hereda, y salió en el papel

El hallazgo que solo da mirar la hoja, que es el método que encontró los
defectos de la v874, la v882, la v885 y la v887. El módulo tiene desde siempre
`svg{ fill:none; stroke:currentColor; stroke-width:1.9 }` para sus iconos de
20 px — y **`stroke` y `stroke-width` se HEREDAN en SVG**, así que cada
`<text>` de mis gráficos salía con un contorno de 1,9 y cada tajada de la
torta con un borde encima de su relleno.

Lo leí como «una tipografía distinta de la de la página» y **estaba
equivocado**: la sonda dio `stroke: rgb(21, 34, 41)` sobre un `font-family`
correcto. La regla de la v863 otra vez —se mide, no se deduce de cómo se ve—
y la línea que lo arregla es la misma que `.sp-graf .sp-lienzo` ya tenía desde
antes, y que esta clase no heredaba por ser otra.

#### Una cota que no cabe va dentro de la barra

También del papel: la fila de Deporte imprimía **«De43,5e»** —el rótulo de
−43,5 % encima de su propia etiqueta—, porque la barra la dibuja el dato y
ninguna canal fija de etiquetas alcanza siempre. El valor va afuera mientras
quepa y dentro cuando no, con la clase blanca que ya existía. Es la decisión
de la v898 con las cotas del lote, y el ancho del rótulo se estima por
caracteres **del lado seguro**: estimar de más mete el rótulo dentro, que
sigue leyéndose; estimar de menos lo deja pisando al de al lado.

Y dos columnas que se leen en vertical pasan a un decimal fijo: salían
«+10 %» junto a «+34,4 %» y «$78,77» junto a «$54,7». Es la clase de la v874
—una cifra correcta escrita de una manera que se lee como otra precisión— y
**redondear para imprimir no es redondear para sumar**: la suma sigue
saliendo de sus sumandos.

### El número de sección se calcula, y ya se había envejecido

Al abrir el tablero en 00, la ficha bajó a 01 y **las contradicciones se
quedaron también en 01**. Los diez números estaban escritos a mano en `SECS`,
que es la cifra que envejece sola de la v903 — y nada lo dijo: lo cazó la
aserción de `tficha` que pide la numeración corrida, después de haberla
apretado por un cambio legítimo.

Ahora el número sale del puesto en `ORDEN_SECS`. Reordenar renumera solo.

### El canal de rectificación

Un botón que abre el correo con el asunto y el cuerpo ya escritos, el plazo
de quince días, y el registro de **qué decía, qué dice y cuándo se corrigió**.
El usuario lo pidió con su razón: *«no es cosmético, es lo que cierra la
mayoría de estos casos antes de que lleguen a juez.»* La lista arranca vacía y
`revisar.js` exige que exista: una lista que no existe no se puede llenar.

### Y el registro: la objeción a la ley de mérito

La entrada del 21 de agosto de 2026 —la primera objeción presidencial de este
gobierno, sobre el proyecto que prohibía bajar los requisitos mínimos de los
cargos directivos— con sus seis fuentes buscadas una por una y su rol
declarado, y con el **primer contrargumento oficial sustantivo del registro**:
las cuatro razones de Andrés Barreto, Secretario Jurídico de Presidencia.

Entra como contradicción con las cuatro piezas fechadas de la promesa, y
`mismoObjetoVerificado` **queda sin resolver a propósito**, con su fecha de
revisión —21 de noviembre de 2026— y la prueba que lo decide escrita al lado:
si el Gobierno presenta una vía alternativa para blindar los requisitos, el
reparo era de mecanismo; si no la presenta, el objeto es el mismo. Esa la
decide quien firma el módulo, no yo.

**No declara ningún indicador**, y medido es lo correcto: el `excluye` de
I-04 nombra «proyecto de ley ordinaria (es el cauce normal, no una
excepción)».

#### Dos premisas del usuario que la medición desmintió

Es la regla de la v916, y se cobró dos veces:

* **el número del proyecto.** El encargo decía «056 de 2024 Cámara / **245**
  de 2024 Senado». Cinco fuentes independientes —El Tiempo, Portafolio,
  Infobae, Cambio, El Nuevo Siglo— dicen **345 de 2024 Senado**. En el
  registro quedó 345.
* **«los casos donde nosotros encontramos el defecto».** Medido, ninguno de
  los cuatro está en el registro, así que esa mitad de la puerta es
  prospectiva y no correctiva. Va dicho arriba con su número.

### Lo que esta versión NO hace

* **La identidad visual de la muestra** —Archivo + Source Serif 4, señal
  `#B8112E`, papel `#EDEFF2`, modo oscuro completo— no se adoptó. El módulo va
  con la pila del sistema y su propia paleta, y **no tiene modo oscuro**: cero
  reglas `prefers-color-scheme` en `css/70`. Adoptarla entera cambiaría la
  marca de un módulo que comparte hoja de estilo con el resto, así que lo
  decide quien la escribió. La serif sí entró, pero **solo en el editorial**,
  que es donde el pliego la pide para separar la opinión del dato.
* **El texto del editorial, su autor y su fecha**, que el usuario dijo que
  escribe él. Va con marcador de posición y el bloque dice qué le falta.
* **Los tres gráficos sin dato**, cada uno con la fuente que necesita.
* **`calidadDelEncuadre` y `signoPolitico`**, que son los dos casilleros de
  control de calidad que siguen en «no se pueden correr».

### Demostrado contra la v970

Revirtiendo **solo lo que decide** —la puerta y lo que `estado()` expone se
quedan, porque son lo que la suite necesita para LEER (v875)—:

```
✗ MATERIAL · las declaraciones que llegan al criterio ejercitan sus seis salidas  — 8 declaradas · 7 fuera
✗ y las otras seis salen con SU motivo  — no-cumple · otro-nivel · sin-base-registrada · …
✗ la declaración municipal no llega siquiera al criterio: la para la puerta del score
✗ el nivel de gobierno se filtra en la puerta del score: un acto municipal no entra  — 5 hechos
```

Y pintando el bloque de pendientes con el rojo de hallazgo: **«y va en gris:
nuestra deuda interna no se pinta con el rojo de un hallazgo del gobierno»**
en rojo, que es literalmente el defecto que el usuario nombró antes de que
existiera.

`tficha` cierra en 203/203, la batería en 121/121 y `revisar.js` en verde con
un `?` —el SIN MATERIAL de la v970, que sigue sin material porque el registro
sigue limpio—.


## La ficha no publica peldaño sin sus insumos (v972)

Tres cosas, y la primera la vio el usuario en la pantalla y la puso primera
con su razón: **la ficha mostraba «FIABILIDAD · Poco fiable» con «0 casos
confirmados · 0 en investigación · 4 cambios de postura»**, o sea publicando
un nivel sobre un presidente en ejercicio con uno de sus tres insumos sin
declarar.

    v971   Poco fiable
    v972   Sin nivel · falta declarar, en 4 de 4 contradicciones documentadas,
           si las dos frases hablan del mismo objeto verificado

### La tensión de la v959, resuelta por quien la tenía a su nombre

La v959 dejó escrito, con todas las letras, que el techo `palabra` y el eje A
son **dos lecturas de la misma familia con reglas distintas**: el techo
contaba TODAS las contradicciones documentadas y el eje A solo las que además
tienen identidad de objeto verificada. Y dejó dicho por qué no se unificaba:
*«unificarlas cambia un veredicto publicado sobre una persona real… Esa
decisión es de quien firma el módulo, no mía.»*

El usuario la resuelve: **mientras el eje A no publique nivel, la ficha
tampoco publica etiqueta de fiabilidad.**

### El techo deja de ser un número y pasa a ser un intervalo

Lo que baja el peldaño es una contradicción documentada **con identidad de
objeto**. Mientras esa identidad no esté declarada, `TECHOS.palabra` no es un
valor: es el tramo entre lo que ya se sabe que cuenta y lo que contaría si
todas las pendientes resultaran serlo.

```js
var ea = ejeA(dd);                                   // una sola cuenta
var palMin = TECHOS.palabra.f(ea.conIdentidad);
var palMax = TECHOS.palabra.f(ea.conIdentidad + ea.sinDeclarar);
```

Se lee de `ejeA(dd)` y no de una cuenta propia, y esa es la unificación: con
dos cuentas volverían a separarse a la tanda siguiente (v879).

**El veredicto es el PEOR de los tres techos, así que con uno indeterminado el
veredicto también lo es** — y se calcula comparando las dos cotas, sin ninguna
bandera que alguien tenga que acordarse de bajar el día que la identidad se
declare (v903). Hoy: `peorMin = 1`, `peorMax = 3`, así que no hay nivel.

#### La desviación de la lectura literal, medida y no escondida

Hay un caso en el que el peldaño **sí** se publica con la identidad sin
declarar: cuando los otros dos techos ya lo fijan por encima del intervalo
entero, o sea cuando el dato que falta no puede cambiar la respuesta. Con dos
casos confirmados el veredicto es «nada fiable» lo que sea que se declare
después.

Es la única rama en la que esta versión se aparta de la lectura literal
«mientras el eje A no publique nivel, la ficha tampoco», y va **medida en su
propia aserción** en vez de disimulada: retener un veredicto que los casos de
corrupción ya fijan solos sería callar por un motivo que no es suyo. Hoy esa
rama no se alcanza con el registro real —los dos techos dan 0 y 1— así que la
decisión del usuario y esta implementación producen exactamente lo mismo en
pantalla.

#### Y no es la Capa 3 escribiendo en el veredicto

La regla de oro del pliego prohíbe que una capa escriba en la anterior, y
`ejeA` es Capa 3. No es el caso: `conIdentidad` **no es una cantidad del eje
A**, es el mismo registro de contradicciones que el techo `palabra` siempre
contó, leído por un solo sitio. La guarda de la v957 sigue en verde porque lo
que prohíbe es que la Capa 1 —la categoría probatoria, el tipo de medición, el
contrargumento— toque el cálculo, y ninguno de los tres entra.

### Qué falta, dicho en los cuatro sitios donde se lee

* **la placa**, que circula recortada como captura: «Falta declarar, en 4 de 4
  contradicciones documentadas, si las dos frases hablan del mismo objeto
  verificado». Sin ese renglón, un «Sin nivel» pelado se lee como que el
  módulo no supo, cuando lo que pasa es que hay una lectura pendiente y se
  sabe exactamente cuál;
* **la línea de cuentas**, que es la regla de la v941: «4 cambios de postura,
  4 sin identidad de objeto declarada». La cifra sola, al lado de «Sin nivel»,
  se lee como un error de la ficha;
* **el techo**, que se dibuja como intervalo —«entre «Confiabilidad
  inquebrantable» y «Poco fiable», según cómo se declare la identidad»— y no
  como «como mucho X», que afirmaría sobre una de las dos cotas;
* **la ficha**, con qué falta **y cómo se consigue**: un «no se puede
  calcular» que no dice cómo se resuelve es la mitad del trabajo (v880).

«Sin nivel» va en **gris** y no en rojo: un peldaño que no se puede calcular
es una lectura pendiente nuestra, no un hallazgo sobre el gobierno. Es la
regla de los dos rojos de la v971 aplicada al veredicto.

### La aserción que se dio vuelta, y las que hubo que apretar

`tficha` exigía desde la v960 que **declarar la identidad de objeto NO moviera
el veredicto**. Era cierto, y era el defecto. Ahora lo que tiene que fallar es
justo lo que antes tenía que pasar — la misma vuelta que dieron las dos de la
v876.

Con ella se apretaron tres más, todas por un cambio legítimo:

* las tres del techo `palabra` —un cambio, dos, tres— usaban contradicciones
  sin identidad declarada, así que medían la escalera con material que ya no
  la mide. Ahora la declaran: **lo que baja el peldaño es una contradicción
  CON identidad**, que es la afirmación de esta versión;
* la de la escalera exigía **un** peldaño marcado siempre. Ahora exige uno
  cuando hay nivel y **ninguno** cuando no se publica: exigir siempre uno
  obligaría a marcar un peldaño que la ficha se niega a publicar, y exigir
  siempre ninguno dejaría pasar una escalera muerta el día que el nivel vuelva;
* la reimplementación aparte del veredicto —la que el suite hace con la misma
  regla escrita por su cuenta, para cazar a quien afloje el criterio— lleva
  ahora el intervalo. Va reimplementada y no importada: una prueba que llamara
  a la misma función no comprobaría más que que es igual a sí misma.

Las cuatro ramas se miden contra **registros fabricados** y no contra el real,
que es la regla de la v970: allá no hay una sola contradicción con identidad
declarada, así que solo se ejercitaría la primera.

Demostrado contra la v971 revirtiendo solo la decisión: siete en rojo, con
**«Poco fiable»** impreso en la placa y en la escalera.

## El bloque de gráficos sube a la portada (v972)

Pedido con el orden escrito: ficha del gobernante · bloque de gráficos ·
enlace a la ficha completa · feed de noticias. *«Hoy los gráficos están en la
sección 00 y el feed arranca de una.»*

    v971   ficha · muro · título · 4 miniaturas de serie · secciones
    v972   ficha · 17 gráficos · enlace a la ficha · muro · título · secciones

### Una función, dos superficies

`bloqueDeGraficos(cont)` arma el héroe y todas las tarjetas, y la llaman la
portada y el tablero. Es lo que `placaDe` hace desde la v791 y por la misma
razón: dos listas de gráficos se separarían a la tanda siguiente, y la que se
quedaría vieja sería la de la portada — la que casi nadie revisa porque es la
que todos ven.

El editorial se movió **después** de los gráficos: una opinión en medio del
bloque se lee como el pie de la tarjeta de arriba, y el pedido es «solo
gráficos, sin texto entre gráfico y gráfico más allá del título y el pie
obligatorio de fuente y fecha de corte».

### Las cuatro miniaturas de la portada se retiraron

Repetían en pequeño, y mandando a otra sección, cuatro de las series que ahora
salen enteras dos dedos más arriba. Con ellas se fueron sus reglas de CSS: una
regla sin un solo elemento es código que nadie llama (v885).

### Una serie que ninguna pantalla dibujaba

El hallazgo de la tanda, y salió midiendo qué trae el registro contra qué lee
cada pantalla. La lista de series estaba escrita a mano —`HERO_SERIES`, cuatro
claves— y el registro trae **cinco**: `cocaina` está ahí con su título, su
unidad, sus puntos y su fuente desde hace tandas, y **no la dibujaba nadie**.

Es la **clase C** —un dato que existe y no alcanza a ningún lector— y su cura
es la de siempre: la lista se deriva del registro (`seriesGraficas`), con un
orden declarado y lo que no esté en él detrás. Una serie nueva se grafica sin
que su autor se acuerde (v867).

La aserción es **por su nombre** y no por el conteo, que no la distinguiría.

### Tres gráficos nuevos, y el bloque `fiscal`

Las cifras del CARF y del crédito de 2027 **no son actos de este gobierno**:
son el contexto contra el que se leen sus decisiones. Van en un bloque
`fiscal` del registro, con su `corte`, su `estadoProcesal` y sus fuentes, y no
en `entradas` — metidas ahí contarían en los indicadores por 100 días, y un
pronunciamiento del CARF anterior a la posesión no es una decisión del
presidente.

| Gráfico | Qué enseña |
|---|---|
| Intereses de la deuda contra inversión pública | los $94,42 contra $86,96 billones del héroe, dibujados |
| Con cuánta deuda nueva se financia 2027 | crédito interno $150,88 · externo $87,72 · **los dos juntos, calculados** |
| Déficit primario 2026 | lo que proyecta el Gobierno (2,1 % del PIB) contra lo que estima el CARF (3,7 %) |

**La aritmética se comprobó antes de publicarla**, que es la regla de la v967:
150,88 + 87,72 = 238,60, y 238,60 / 634,95 = 37,6 %, que es la cifra que la
prensa publica. La suma y el porcentaje **se calculan de las barras** y no van
escritos aparte: un total separado de sus sumandos diverge a la tanda
siguiente.

Y lo que NO está va dicho dentro del propio gráfico: el déficit **total**
proyectado para 2027 no lo publica el CARF en una forma que se pueda citar, y
la única cifra de déficit total con fuente es la de 2025 ejecutado —6,4 % del
PIB—, que es otra cosa y no se dibuja junto a estas.

Las tres comparaciones van por **una** función, `grafBarras`: tres copias del
mismo trazado divergen, y la que divergiera lo haría en el eje o en el
formato, que es donde no se ve.

Y una del papel: la barra decía **«$94,4»** dos dedos debajo de un héroe que
dice **«$94,42»**. El mismo número con dos precisiones a un palmo es la clase
de la v874, y `bn` tampoco servía —deja «$238,6» al lado de «$150,88» en una
columna que se lee en vertical, que es lo que la v971 arregló con `un`—. Las
cifras en billones van con **dos decimales fijos**; las del déficit, que son
porcentajes del PIB, siguen con uno.

### La serie del Huila sigue declarada sin dato, y ahora se dice por qué

Se volvió a buscar, que era la instrucción. Aparecen las seis cifras en la
prensa regional —1.468/1.151 · 1.379/0.974 · 1.585/0.653, y hasta las de 2025
que nadie había pedido, lo que confirma que la fuente existe— pero **el
artículo que las publica no se pudo abrir desde esta máquina** y el medio que
aparece no es el que el dossier nombra.

Citar una dirección que no se pudo leer es fabricar una fuente con buena
apariencia, que es exactamente lo que la v967 dejó escrito. El gráfico se
queda declarado, con la búsqueda y su resultado escritos dentro.

### El defecto que salió mirando el papel, medido y NO arreglado

**El texto de los ocho gráficos de barras y torta sale a 5,7–6,4 px en un
teléfono.** El módulo tiene un piso de 13 px para texto corrido desde la v791,
y estos lo incumplen a menos de la mitad.

| Ventana | Texto de `svg.sp-g` |
|---|---|
| 390 px | **5,7 px** |
| 420 px | **6,4 px** |
| 768 px | 12,5 px |
| 1200 px | 14,2 px |

**Y son solo esos ocho, no todos**, que es la precisión que da mirar el papel:
las cinco series temporales se dibujan con `.sp-lienzo`, que tiene su propio
dimensionado, y se leen bien en el mismo teléfono.

La causa: el texto de un SVG con `viewBox` **se escala con el dibujo**. Con
720 unidades de ancho metidas en 342 px de pantalla, los 13,4 px de `--t-8`
salen impresos a 6,4. No se ve leyendo el CSS —el número está bien escrito— y
se ve mirando el papel, que es como se encontró (v874, v885).

**No se arregla acá, y el motivo es que no es un cambio de CSS.** Subir el
tamaño de la fuente rompe la geometría: `pieDentro` pone sus dos renglones a
13 y 26 unidades, las cotas van a `y + 13` de una barra de 20, y todo eso
supone un texto de ~13 unidades. La cura es dibujar con un `viewBox` que
dependa del ancho, y eso toca las funciones de la familia `sp-g` con su propia
medición cada una. Hacerlo de paso, al final de una tanda larga, es el arreglo
estructural que este proyecto ya deshizo tres veces (v882, v886, v901).

Queda medido, con los cuatro números, para que la tanda que lo tome no empiece
por averiguar lo mismo. **Es un defecto anterior a esta versión**: lo que la
v972 cambió es que ahora lo ve todo el que abre la portada, no solo quien
entraba a la sección 00.

### Las tarjetas de fuente van plegadas, y eso resuelve dos instrucciones que chocan

«Sin texto entre gráfico y gráfico más allá del título y el pie obligatorio»
contra «todo lo publicado lleva visible su fuente con enlace», las dos del
mismo lector. Medido el bloque por partes, en un teléfono de 420 px:

| | Alto |
|---|---|
| Los enlaces de fuente | **2.265 px** |
| Las notas | 2.231 px |
| **Los gráficos mismos** | **1.719 px** |
| Títulos y unidades | 973 px |
| El bloque entero | **10.899 px** |

Los gráficos son el 16 % de su propio bloque y el texto de alrededor el 41 %.
Y con diecisiete tarjetas, la misma lista de tres o cuatro medios se repite
hasta seis veces.

Se pliegan los ENLACES y se quedan las NOTAS, y cada mitad por su razón:
plegar los enlaces no esconde nada —los NOMBRES de las fuentes y la fecha de
corte siguen impresos dentro del SVG desde la v971, que es lo que viaja en una
captura, y el enlace queda a un toque—, mientras que la nota lleva el estado
procesal —«NO es todavía ley»— y eso no puede depender de que alguien
despliegue.

Medido después: **9.027 px**, con los enlaces en 396. El bloque encoge un 17 %
sin perder una sola fuente ni una sola advertencia.

### Cuatro colisiones de nombre en la misma tanda

`nd`, `cxId`, `nivelDom` contra `nivelDOM`, y un `assert` que se denunció a sí
mismo por buscar `HERO_SERIES` en un comentario que explicaba por qué se
retiró. Las tres primeras las cazó el propio JavaScript o la suite; la cuarta
es la lección de la v926 en pequeño —**una comprobación que lee el archivo con
sus comentarios se comprueba a sí misma**— y se arregló mirando el USO y no la
palabra.

`nivelDom` contra `nivelDOM` merece su renglón: dos claves que se distinguen
**solo por mayúsculas**, una del peldaño de fiabilidad y otra del nivel de
gobierno. Es la homonimia que este proyecto persigue desde la v885, con la
agravante de que ninguna guarda la ve. La mía se llama ahora `peldanoDom`.

## Un campo obligatorio que se contesta con relleno (v973)

Llegó mapeando, y las dos mitades del reporte pedían medirse antes de tocar
nada (v916):

> «cuando va a publicar me dice que obligatoriamente tengo que ponerle
> descripción y dirección… ya estoy poniendo de vivienda como por rellenar
> para poderlo publicar» · «iba a mapear un árbol, una palma, un árbol grande
> de más de 3 metros, y no vi por ningún lado esa opción; tampoco para mapear
> una banca, un punto de basuras, un parque de niños. ¿Qué está pasando ahí?»

    v972   la dirección bloquea · «árbol» da 0 resultados · «basura» da 0 · «niños» da 0
    v973   la dirección es opcional y su ausencia se declara · las cuatro se encuentran

### La descripción NUNCA fue obligatoria, y eso cambia el arreglo

Medido: `publishQuickReport` tiene **una sola** puerta y es la de la
dirección; el `placeholder` de la nota dice, literalmente, «Descripción corta
opcional» y nada la valida. Lo que bloquea es el campo rotulado «Dirección o
punto de referencia \*», cuyo aviso dice «Ingrese la dirección **o punto de
referencia**» — y de ahí sale la lectura de que pedía las dos cosas.

Vale anotarlo porque cambia dónde se mira: de haber creído la premisa, la
tanda habría empezado buscando una validación de la nota que no existe.

### Y no costaba nada tenerla: el análisis nunca la leyó

El otro hallazgo de medir antes de escribir. La descripción de un reporte es
una cadena de posiciones fijas, y el análisis educativo lee la casilla **[0]**
—el tipo, por `partirEtiqueta` en js/64— y **nunca la [1]**, que es donde vive
el nombre con la dirección dentro.

Así que la dirección no alimenta ninguna cuenta: es para el lector humano. Un
campo obligatorio que no entra en ningún cálculo y que se contesta con relleno
no consigue el dato — **consigue un dato falso que después nadie distingue de
uno bueno**, que es exactamente la razón por la que `js/03b` tiene «No se
sabe» y «Otro» desde que existe.

### No se escribe «NN» en el registro

Era lo pedido —«que se deje NN o NA»— y hacerlo habría sido escribir en el
registro un valor que nadie tecleó, que es la falta de la v930 con el autor de
los edificios y la de la v931 con la fecha sin distinguir. El campo se queda
**vacío** y son las PANTALLAS las que declaran que no se anotó. Con eso, el
día que alguien la agregue editando no hay nada que des-escribir.

**Y el estado se calcula, no se marca** (v903). La dirección vive dentro del
nombre como «⟨dirección⟩ — ⟨tipo⟩», así que sin ella el nombre queda siendo
**exactamente el tipo**: `urbisSinDireccion` reconoce «no la anotaron» por esa
igualdad, sin una bandera que alguien tenga que acordarse de poner ni de
quitar. Una sola función para las dos superficies —el globo y la ficha—, que
es la regla de la v867: dos redacciones de la misma advertencia se separan a
la tanda siguiente.

Va en **gris y no en ámbar**: el ámbar de este módulo dice «esto todavía no
está confirmado», y esto dice otra cosa —el reporte es válido y le falta un
dato de referencia que cualquiera puede agregar editándolo—. Dos cosas
distintas con el mismo color se leen como una sola (v880).

#### La edición habría prefillado el tipo como si fuera una dirección

`dirPrefill = nomOrig.split(' — ')[0]` era correcto mientras la dirección
fuera obligatoria. Sin ella, ese `split` devuelve el TIPO entero y lo mete en
la casilla de la dirección: al día siguiente, editar un punto sin dirección la
habría «rellenado» con «Casa de un piso», convirtiendo un vacío honesto en un
dato inventado por el propio formulario.

El discriminante no hay que escribirlo: el tipo guardado es la casilla [0] del
mismo registro. Se lee de ahí y **no del `label` de ahora**, que puede estar
cambiándose en esa misma edición.

#### Lo que NO se tocó

La dirección del **evento** (`#ev-direccion`) sigue siendo obligatoria, y va
dicho para que no se lea como un descuido: un evento con fecha y hora del que
nadie sabe dónde es no sirve para nada, así que ahí el campo carga un
propósito que en el mapeo no tiene. El reporte era sobre el mapeo y no se
amplía solo.

## Tres que sí estaban y no se podían encontrar, y una que no estaba (v973)

La segunda mitad, y la medición separó limpio lo que el reporte juntaba:

| Lo que fue a mapear | ¿Está en el catálogo? | ¿Lo encontraba? |
|---|---|---|
| **Árbol · palma** | **NO** — de 520 tipos, ninguno | «arbol» → **0** · «palma» → **0** |
| Banca | sí · Mobiliario Urbano | solo escribiendo «banca» |
| Punto de basuras | sí · «Caneca / punto ecológico» | «basura» → **0** |
| Parque de niños | sí · «Juegos infantiles públicos» | «niños» → **0** |

Tres de las cuatro **existían y ninguna superficie las alcanzaba**: es la
**clase C** de este proyecto —un dato presente e inalcanzable se ve, desde
afuera, exactamente igual que uno ausente—, y por eso se reportaron como
faltantes. Y la navegación tampoco ayudaba: la banca y la caneca viven bajo
«Servicios e infraestructura» y los juegos bajo «Vivienda y ocio», que son los
dos últimos sitios donde alguien las buscaría.

### El árbol NO entra en «Forestal»

Era lo más parecido y habría sido el error que `js/03b` existe para evitar:
los tipos de `Forestal` son todos **masas de terreno** —un bosque, una
plantación, una zona de reforestación—, y meter ahí un árbol suelto es
«elegir lo más parecido para salir del paso», que mete un dato falso que
después nadie distingue de uno bueno.

Entra como uso propio, `Arbolado Urbano`, en el grupo «Ambiente y zona rural»,
con doce tipos que se determinan **desde la acera**: el árbol grande de más de
tres metros que el reporte nombra, la palma, el que levanta el andén, el que
está en riesgo, y el **alcorque vacío** —el sitio de siembra sin árbol, que es
un dato de planeación y no la ausencia de uno—.

Cuenta como `verde_natural` y no como `mobiliario`: una banca es mobiliario y
un árbol no lo es. Y una consecuencia que conviene tener escrita antes de que
alguien la descubra: **cada árbol mapeado es UN uso**, así que una cuadra con
cincuenta árboles suma cincuenta. No es nuevo —cincuenta bancas suman
cincuenta de mobiliario desde siempre— y **no toca la cobertura vegetal de la
lámina**, que sale del raster satelital y no de contar puntos.

### El buscador casa subcadenas, así que solo encuentra lo que él mismo se llama

Ahí está la causa de los tres ceros: el catálogo se llama «Caneca» y la calle
dice «basura»; se llama «Juegos infantiles» y la calle dice «niños».
`SINONIMOS_MATRIZ` traduce una a la otra.

**De qué NO responde, dicho:** es una LISTA, así que falla abierto — la
palabra que no esté sigue pidiendo el término literal. Lo que sí está
guardado es que ninguna entrada apunte al vacío: un sinónimo que no casa con
ningún tipo es un no-op que **se lee igual que uno que funciona**, y
`revisar.js` lo denuncia.

#### Una frase entera no casa nunca, y encontrarla enterrada es no encontrarla

«parque de niños» daba **cero**: ninguna frase de dos palabras aparece tal
cual en un nombre del catálogo. Se reintenta palabra por palabra, y solo
cuando la frase entera no encontró nada —para que una frase que sí acierta no
se ahogue entre los resultados sueltos de sus palabras—.

Y ahí estaba la vuelta que costó medir: por palabras sueltas la consulta
devolvía **veintidós resultados con veinte parques y parqueaderos encima de
los juegos infantiles**. Encontrar lo que se busca y enterrarlo, desde el dedo
de quien está mapeando en la calle, se ve igual que no encontrarlo.

Así que cada palabra pesa según **lo rara que sea en el catálogo**: «parque»
casa 22 tipos y no dice casi nada; «niños» casa 3 y decide. Medido después,
las cuatro consultas del reporte ponen la respuesta correcta **de primera**.

### La guarda: tres listas que hoy coinciden y nada las ataba

Un uso vive escrito en tres sitios —el catálogo `PROCITY_MATRIZ_USOS`, el
grupo por el que se navega `MATRIZ_GRUPOS`, y la casilla del análisis
`USO_A_SUB` en js/64—. Medidos antes de tocar nada: **los 48 coincidían
exactamente en los tres**, y no había nada que los mantuviera juntos.

Es la **clase B**, y esta misma tanda es la que lo destapa: agregar un uso
obliga a tocar los tres. Lo que se pierde por olvidar uno no es lo mismo:

* sin grupo, el uso **solo aparece buscándolo** y no navegando;
* sin casilla en el análisis, se puede **mapear y el análisis lo descarta** —
  una tarde en la calle levantando algo que ninguna cifra recoge, que desde
  afuera se ve igual que no haberlo mapeado.

Se comprueba en las **dos direcciones**, porque sobrar también rompe: un grupo
que nombre un uso que ya no existe deja una tarjeta que no lleva a ninguna
parte. Y la lista no se escribe en la guarda: se leen los tres inventarios de
sus propios archivos, así que un uso nuevo queda vigilado sin que su autor se
acuerde (v867).

### Dos defectos de mis propias guardas, los dos cazados al demostrarlas en rojo

Y los dos de la familia que este proyecto persigue: una guarda que no puede
fallar es un verde.

* **Un rojo que se describía a sí mismo como verde.** El detalle de «publicar
  no exige la dirección» era un ternario sobre `pub.length > 200`, no sobre la
  condición de verdad: con la puerta devuelta, la comprobación salía en rojo
  imprimiendo «sin puerta en publishQuickReport». Dice ahora «la puerta
  volvió».
* **Una guarda que no cazaba lo que nombra.** «Lo declara en el globo y en la
  ficha» buscaba el identificador `sinDirPopup` en el archivo. Quitando el
  hueco `${sinDirPopup}` de la plantilla —dejando la declaración en pie— la
  advertencia se calculaba y **no se pintaba**, y la guarda seguía en verde.
  Se busca el hueco de la plantilla, que es lo que llega a la pantalla.

Ninguno de los dos se ve leyendo. Los dos salieron de **demostrar en rojo**,
que es para lo que esa práctica existe.

### Y un error mío que costó rehacer la tanda entera

Para demostrar en rojo escribí un bucle que parcheaba, corría `revisar.js` y
restauraba con `git checkout -- js/ pruebas/revisar.js`. **Todo el trabajo
estaba sin confirmar**, así que la primera restauración no deshizo el parche
de la demostración: deshizo la tanda.

La regla, barata: **una demostración en rojo se hace contra una base que ya
está guardada**, o copiando los archivos aparte y restaurando de la copia —
nunca con `git checkout --` sobre trabajo sin confirmar. Lo que se restaura
tiene que ser algo que se pueda volver a perder.

### Lo que NO se pudo correr, y se dice

**Ninguna suite de navegador**: este contenedor no tiene el repositorio del
motor (`../urbis-motor`) ni el `node_modules` del banco de pruebas
(`../urbis-pruebas`), así que ni `playwright-core` ni el motor empaquetado
existen. `tpisos` —que es la que mapea de punta a punta en Pro City y llena
`#ins-direccion`— **no se pudo ejercitar**, y es donde vivirían las
aserciones de la rama sin dirección: mapear sin ella, comprobar que se guarda,
que el globo lo declara, y que al editar la casilla vuelve **vacía** y no con
el tipo dentro.

Lo que sí corrió es la comprobación estática entera —`revisar.js`, con las
ocho comprobaciones nuevas— y la medición del buscador y de los tres
inventarios contra los archivos de verdad. Queda dicho por lo que es: una
comprobación que no puede correr lo dice y se cuenta, no queda ausente.

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
* **El RECORRIDO de cada ruta, y el cuadro de horarios del DÍA** — un GTFS,
  o el cuadro de la secretaría de tránsito. Lo observado en una parada da lo
  que pasó en esa franja, no el horario completo, y un recorrido no se levanta
  sentado en un paradero: el renglón se queda por eso y no porque falte el
  camino.
  `ya: el nombre, la referencia y el tipo de cada ruta que recoge en las paradas del sector, y la frecuencia observada con reloj en la parada entra al análisis por su puerta en la ficha —el intervalo sale de restar pasos consecutivos, se dice en qué franja se observó, y una ruta que pasa y que OpenStreetMap no lista entra marcada como solo observada—, con quién la observó y qué día`
* **El aforo de hora pico** — un conteo en campo o el de la secretaría, con su
  fecha. `ya: el flujo modelado a partir de los usos y la jerarquía, rotulado como modelado y no como contado`
* **La ARBORIZACIÓN de la calle, y el perfil acotado del RESTO de la red** —
  la plantilla del perfil no tiene columna de arborización, y los tramos que
  se levanten son unos pocos: llevar su ancho a todos los metros de vía del
  sector sería extrapolar. El renglón se queda por eso y no porque falte el
  camino.
  `ya: el ancho de vía leído de width con su cobertura, qué parte de la red no tiene dato de andén, y el perfil acotado que se levanta con cinta tramo a tramo entra al análisis por su puerta en la ficha —calzada, separador, andenes y antejardín— y manda sobre el del mapa, que se conserva al lado para contrastar, con quién lo midió y entre qué fechas`
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
