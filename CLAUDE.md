# URBIS · cómo se trabaja en este repositorio

Notas para cualquier sesión que retome el proyecto. Están acá porque cada una
de ellas costó tiempo averiguarla o romper algo.

## Lo que sigue, y en este orden · `LISTA-QUE-SIGUE`

**El registro es hoy el cuello de botella, no el código**, y sigue siéndolo:
endurecer guardas sobre material que no está solo aumenta la distancia.

Esta lista **se quedó vieja veinticinco versiones** —pedía una migración hecha
en la v967 y decía que la pantalla presidencial no se implementaba todavía,
cuando la v971 la implementó entera—, así que ahora cada renglón lleva su
**condición medible** y `revisar.js` denuncia el que ya esté cumplido. Es la
forma que la v868 le dio a las listas vivas, aplicada a la lista que toda
sesión lee primero. Cómo se agrega un renglón: la sección **«Una lista de
prioridades también se queda vieja (v997)»**, más abajo.

Medido el 1 de octubre de 2026 sobre los dos registros —218 entradas del
gobierno actual y 32 de Petro—:

1. **Declarar la identidad de objeto de la contradicción del mérito.**
   Queda UNA, y la v1060 declaró las otras siete de los dos registros con el
   criterio escrito del pliego —el ejemplo del Fonpet—, cada una con su razón
   publicada al lado. Con tres declaradas **el intervalo del peldaño de la
   palabra se cerró**: dejó de ser provisional y quedó firme en «Poco fiable»,
   así que la que falta **ya no mueve el veredicto**. Lo que sí sigue
   bloqueando es el **eje A**, que no publica nivel mientras falte.
   Y la que queda no está pendiente por descuido: su prueba está escrita de
   antemano desde la v971 —si el Gobierno presenta una vía alternativa para
   blindar los requisitos mínimos, el reparo era de mecanismo— con **fecha de
   revisión el 21 de noviembre de 2026**. Declararla antes sería resolver a
   conveniencia justo lo que ese párrafo existe para impedir.
   `hecho cuando: identidad-declarada`

**Queda UN renglón, y espera un HECHO que no depende de esta sesión** —si el
Gobierno presenta esa vía alternativa para blindar los requisitos mínimos—, con
su fecha de revisión. Endurecer guardas alrededor no lo adelanta ni un día.

Y conviene decir qué NO es eso: que la lista tenga un solo renglón no quiere
decir que no quede trabajo. Quiere decir que lo que queda no cabe en la forma
de esta lista —una condición que se mide contra el registro y baja sola—. Lo
demás vive en las secciones **«Lo que esta versión NO hace»** de cada tanda,
que desde la v1008 llevan su estado y `revisar.js` las vigila.

Y una corrección que la v1050 midió y la v1060 confirmó: **son CINCO, no
ocho.** Las documentadas que cuentan en el registro actual son cinco —la sexta
lleva `cuenta: false` con su motivo, y a esa no se le declara identidad porque
no la tiene— y tres de Petro más, que la v1060 declaró con la misma vara. El
número de esta lista se lee del registro, no de acá.

Una precisión que la lista vieja traía y sigue valiendo: si al declarar el rol
aparece una entrada cuyas fuentes **ninguna documenta el acto**, no se inventa
y no se deja pasar. Se queda en `sin-acto` —que desde la v970 es un estado que
se cuenta y se nombra, no un fallo— y se sigue. **Es hallazgo, no obstáculo.**

**Lo que ya NO está en la lista, y por qué:** **correr los criterios escritos
sobre el resto del registro**, que era el renglón 2, lo hizo la v1061 sobre los
148 actos de gobierno de los dos registros, y el resultado fue UNO: la carta
del presidente de la JEP a la Corte Penal Internacional entra por I-05, que
deja de estar en cero. Los otros 141 pasaron por los cuatro criterios y no caen
en ninguna vía, y eso también se marca —con la lista vacía— porque «revisado y
ninguno aplica» y «nadie lo ha mirado» se veían iguales. Y la migración del esquema antiguo
`fuente` + `url` la hizo la v967 —cero entradas quedan con esa forma en los dos
registros— y la pantalla del módulo presidencial la implementó la v971, con sus
diecisiete gráficos. Las dos seguían pedidas acá hasta la v996. Y el **rol de
las fuentes**, que era el renglón 1 de esta misma lista, lo declaró la v998
sobre las 212 entradas y las 562 fuentes: lo denunció la guarda que la v997
acababa de escribir, en la primera tanda que la puso a prueba. Y el
**`nivelGobierno`**, que era el renglón siguiente, lo declaró la v999 sobre las
120 entradas que registran un acto de gobierno — que es el denominador honesto:
a una cifra del país o a un hecho de otro actor no se le puede declarar un
nivel sin mentir, y el renglón pedía las 212. Y **documentar las diecinueve
entradas del 4 al 17 de agosto**, que era el renglón 1 de esta misma lista, lo
hizo la v1003: diecisiete verificadas y dos disputadas, con el canal declarado
—la búsqueda, que es el único que este contenedor tiene— y el techo de
`TECHO_SIN_TIPO` en cero. Y **la fuente del ACTO de las seis `sin-acto`**, que
era el renglón siguiente, la consiguió la v1004: una la cerró de paso la v1003
al documentar el Decreto 1012, y las cinco restantes —la suspensión de las
emisoras de paz, y cuatro del registro de Petro— quedaron con su acto
documentado, dos de ellas con el texto de la ley en el Diario Oficial y con la
Presidencia.

Lo demás del módulo presidencial —los cuatro criterios sin validar, la media
histórica del eje B, la fuente del eje C— pide archivo y fuente, no código, y
vive en las secciones de la v964 y la v965. Lo del módulo educativo y del
mapeo vive en **la lista viva**, al final.

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

## La bitácora por versiones vive aparte · `BITACORA.md`

Las **secciones por versión** —de la v840 en adelante, con su medición, su
demostración en rojo y lo que cada tanda declaró pendiente— están en
`BITACORA.md`, en la raíz. Ahí se busca el detalle de una versión, el precio
medido de una decisión, y por qué una idea que parece buena ya se deshizo.

**No se inyecta**, y eso es la razón de la mudanza: eran 24.155 de las 25.092
líneas de este archivo, el 96 %, y se cargaban enteras en cada sesión. El
último `/compact` no pudo bajar del límite por eso. Lo que se queda acá es lo
que sigue obligando: la `LISTA-QUE-SIGUE`, las reglas de fusión, versión y
ramas, las tres clases de error, las convenciones de guarda de abajo y las
listas vivas del final.

Lo que esto NO es: un archivo muerto. `revisar.js` lo lee junto con este
—los marcadores de trabajo aplazado y el piso de renglones vigilados corren
sobre los dos— así que una declaración que envejezca allá sale en rojo igual.
Si el archivo falta, la guarda lo dice con su nombre.

**Una tanda nueva escribe su sección en `BITACORA.md`**, al final, con el
mismo formato. Solo sube a este archivo lo que una sesión necesita leer
ANTES de trabajar: una regla, una convención, un renglón de la
`LISTA-QUE-SIGUE`.

## Las reglas que las tandas anteriores dejaron escritas

Destiladas acá porque son las que se citan todos los días. Cada una lleva su
versión: el caso que la pagó está en `BITACORA.md`.

### Cómo se escribe una guarda acá

* **Falla cerrado** (v880). Lo que no se declara sale en rojo; nada pasa por
  omisión. El coste de un falso positivo es un renglón en una lista, y el de
  un falso negativo es lo que se publica.
* **El MATERIAL va primero** (v920). Sin algo sobre lo que morder, todo lo de
  abajo pasa por no tener nada delante. Y el material es **lo que sobrevive al
  cero** (v1022): una cuenta que describe el DEFECTO se queda sin material el
  día que el defecto se arregla, y entonces la guarda se pone roja sobre un
  módulo que mejoró.
* **La guarda de la guarda** (v878). Si la comprobación deja de LEER lo que
  decide, todo lo de arriba sigue en verde sobre documentación. **Una guarda
  que no puede fallar es un verde**, y es el patrón que este proyecto lleva
  treinta tandas persiguiendo.
* **Se demuestra en rojo, con una inyección FIEL** (v993). El estado real de
  la versión anterior, entero y no medio: una inyección a medias deja la
  guarda en verde con razón. Cuando una inyección fiel no consigue poner algo
  en rojo, lo que falta no es la inyección — es lo que la aserción mide
  (v1029). Y **toda inyección lleva su aserción**, o un parche que no entró se
  lee como una guarda floja.
* **El `?` SIN MATERIAL y el rojo no son lo mismo** (v970, v1026). El `?` es
  para la guarda cuyo material lo ponen los DATOS y puede llegar a cero por
  una mejora: un rojo ahí pone la salida barata en dejar el registro torcido
  para que siga habiendo algo que rechazar. El rojo es para la que se mide
  contra sí misma o contra código servido, que no puede vaciarse
  legítimamente.
* **Un trinquete absoluto solo vale si el pendiente no crece solo** (v965). La
  pregunta es: *¿puede ese pendiente crecer sin que nadie haga nada mal?* Si
  puede, el techo está mal y hay que medir lo HECHO, que solo sube.
* **Se persigue la clase y no el caso** (v874, v885), con el discriminante que
  de verdad discrimina —medido contra sus falsos positivos, no elegido—. Una
  guarda con falsos positivos termina en una lista de excepciones que envejece
  hasta no significar nada (v895), y **cada excepción lleva su razón escrita**.
* **Se mide por contenido, no por distancia** (v935). Un ancla de N caracteres
  envejece: se corta por el `<h2>`, por la función, por el punto y coma.
* **Se busca DENTRO del trozo** (v854). Un patrón suelto encuentra el de la
  caja de al lado, y un extractor que casa por prefijo lee la figura vecina.
* **El detalle del fallo dice qué mitad falló** (v973, v1051). Seis veces una
  aserción de este repositorio imprimió el texto del verde estando en rojo.
* **La guarda lee el CÓDIGO y no los comentarios** (v926). Una capacidad
  demostrada por el párrafo que habla de ella no está demostrada.
* **Y de qué NO responde va escrito al lado** (v945, v952). Declarar cubrir
  más de lo que se cubre es tan engañoso como cubrir menos; las dos veces hubo
  que corregir el mensaje de éxito de una guarda anterior.

### El material tiene que poder producir el fallo

Pasó **veintiocho veces** y siempre igual: la comprobación en verde por no
tener nada que rechazar. Dos reglas:

* **Las dos ramas se miden en la misma corrida.** Sin la que tiene que
  CALLAR, un aviso puesto en todas partes pasa igual, y eso es la mentira
  contraria.
* **La rama con material se mide contra un caso FABRICADO** (v970), no contra
  el registro: medirla contra el registro es volver a medir el número.

Y antes de empobrecer un fixture conviene mirar las otras suites: tres veces
(v881, v898, v936) ya había uno pobre en otra. El sector de prueba tiene su
sección al final de este archivo.

### Cómo se mide una premisa

* **Medir antes de actuar** (v916). El diagnóstico del síntoma suele servir y
  el de la causa no siempre. Vale para las premisas del usuario, para las de
  un informe verificado y **para las propias de una tanda anterior** (v925).
* **Una sospecha sobre datos se comprueba corriendo o leyendo el código**
  (v863), nunca recordando cómo se llama un campo.
* **Un barrido propio se comprueba contra la guarda que ya existe** (v878,
  v891, v897, v903, v1000, v1053). En JavaScript `\b` trata las vocales
  acentuadas como NO-palabra; una cota `[^)]` sobre código con paréntesis es
  un recorte silencioso; y un token sin su paréntesis casa por prefijo.
* **Mirar el papel.** Componer el documento o la pantalla y LEERLO es el
  método que más defectos reales ha encontrado acá (v874, v882, v885, v887,
  v974, v978, v985, v987, v1031, v1055). Ninguno se veía leyendo el código.
* **Una decisión de espacio se juzga midiendo las dos composiciones** (v919),
  no leyendo la lista: un panel en la lista de lo que cedió no siempre pagó
  por lo que se salvó.
* **Un arreglo estructural hecho para callar una comprobación es un arreglo
  sin causa** (v882, v886, v901). Se deshace y se deja escrito por qué, para
  que la idea no vuelva a parecer buena.
* **Y un token o un nombre se comprueba antes de usarlo** (v1050, v1056): un
  `var(--x)` que no existe no pinta nada, y una colisión de nombre hace que
  una función llame a otra sin un solo error.

### Lo que se declara, y no se calla

* **Un vacío se declara con qué falta y cómo se consigue** (v849, v880,
  v1065). Nombrar el documento y callar el trámite convierte un vacío en un
  muro. Son **cuatro campos y ninguno sobra** —qué, quién lo tiene, cómo se
  pide y **cuándo puede existir**—, y el último es el que más se olvida: sin
  él, un vacío que solo cierra el calendario (el EJECUTADO de un presupuesto
  cuyo año no ha empezado) se lee como archivo que alguien no fue a buscar.
* **Y los trámites viven en UN solo bloque del registro, con la clave del
  eje** (v1076), no dentro del dato de cada uno: con tres sitios, la guarda
  necesita una tabla de dónde mirar y esa tabla es lo que envejece. **La
  lista de a quién se le exige sale de `PESO_EJE`**, así que un eje nuevo
  nace con el trámite exigido sin que su autor se acuerde.
* **Un intento que falla se FECHA, con su canal y su razón** (v1055, v1065).
  Y **cuando NO se ha intentado, eso también se escribe** (v1076): la v1065
  imprimía la línea solo si había intento, así que en los ejes sin ninguno
  desaparecía — y «nadie lo ha buscado» volvía a tener la cara de «no hay
  nada que decir», que es justo lo que esa versión escribió acá para
  prohibirlo. Las dos redacciones, siempre (v970).
  Desde afuera, «nadie lo ha buscado» y «se buscó y no se pudo» se leen
  igual. Y conviene saberlo antes de salir: **desde este contenedor el proxy
  niega TODOS los dominios** —medido el 2 de octubre de 2026 sobre
  minhacienda.gov.co, dane.gov.co, dnp.gov.co y cinco medios—, así que el
  único canal es la BÚSQUEDA, y su estándar está escrito en
  `_pendientesFuente` desde la v1003: sostiene **que** un hecho ocurrió, no
  que se leyó la página. **Una serie numérica cae del otro lado de esa raya**
  — la v1065 midió por qué: la búsqueda sola devolvió Defensa 2023 en $32,9 y
  en $37,2 billones, y sin abrir la página no hay cómo dirimirlo.
* **«Cero medido» y «cero mapeado» son cosas distintas** (v875), y el
  discriminante casi siempre viene en el MISMO objeto —seis veces—.
* **«Sin dato» y «el panel cedió» piden acciones distintas** (v899), así que
  se cuentan y se dicen aparte.
* **Declarar ausente algo que SÍ está medido es peor que un dato de menos**
  (v861): seis declaraciones de ausencia falsa, y la regla que las evita es
  buscarlo en el código antes de declararlo.
* **Un estado se CALCULA, nunca se escribe a mano** (v903). Una cifra tecleada
  dentro de un texto fijo envejece sola, y una bandera que alguien tiene que
  acordarse de bajar es una cifra vieja esperando.
* **Y un INSUMO que la fuente reemplaza cada mes lleva su FECHA, no su
  descripción** (v1082). El eje C deflactaba con «la inflación anual de
  agosto» escrito en prosa: el día que el DANE publicó la de septiembre, el
  panel siguió declarando la vieja y ninguna pantalla lo notó. Una fecha se
  compara contra la última lectura; una frase no. Y **la cura no es subir el
  número**: los porcentajes estaban calculados con el viejo y el registro no
  guarda la base para rehacerlos, así que cambiar solo la etiqueta deja los
  porcentajes calculados con una cifra y declarados con otra — peor que
  quedarse viejo. La cura es decirlo, con las dos redacciones, y que la
  guarda se ponga roja si alguien actualiza la etiqueta sin la base.
* **Dos números que se contradicen piden la MEDIDA antes que el arreglo**
  (v1085). Ante una cifra que no cuadra con otra parte del registro, la
  pregunta no es cuál de las dos está mal: es **de qué mide cada una**. La
  serie de deuda publicaba 750 y las entradas decían 200 girados, así que bajé
  el punto a 500 —200 girados más 300 activados— y eso era peor que el 750:
  mezclaba las dos medidas en un total. El bloque `deuda` del mismo registro
  traía las dos columnas, `comprometido` y `desembolsado`, a dos claves de
  distancia, y con ellas los 750 eran exactos. **El defecto era que el número
  estaba publicado sin decir de qué era** —el título decía «comprometida» y la
  leyenda «activados»—, que es la clase A dentro de la clase B. Cambiar el
  número antes de contestar la pregunta es arreglar la contradicción
  destruyendo la medida. Lo cazó componer la página y LEERLA, no el código.
* **Y una serie vive APARTE de las entradas, así que declara dónde está
  escrito su hecho** (v1085). Una serie trae sus propias fuentes, de modo que
  su punto y la entrada que documenta el mismo hecho son dos codificaciones
  que coinciden el día que se escriben. Cada punto lleva `base` —los ids de
  las entradas cuyo texto lo documenta— o `sinBase` con su razón, y el enlace
  llega a la pantalla. Son **dos cosas distintas y conviene no confundirlas**:
  la **atadura** impide separarse —el último punto de `deudaSerie` SALE de la
  suma del bloque— y el **anclaje** deja comprobar. Y el anclaje no promete
  que el número coincida, porque el valor de un punto es a veces la cifra
  publicada y a veces un acumulado que ninguna entrada escribe: eso va escrito
  donde el lector lo ve (v945, v952).
* **Y la cuenta tiene que mirar TODAS las formas en que el módulo publica**
  (v1085). La del anclaje miraba solo `puntos` y decía «16 puntos, todos
  cubiertos» cuando eran 22: dos tarjetas guardan sus cifras en
  `grupos[].medidas` y en `lineas`, devolvían `null`, y salían sin la línea —
  **que desde afuera se lee igual que una anclada**. Es la exención silenciosa
  de arriba, entrando por la puerta de la forma del dato y no por la del
  estado.
* **Las dos redacciones se escriben, la de cero y la de N** (v970): la segunda
  es justo la que hace falta el día que el material vuelva.
* **Un dato que ninguna pantalla alcanza se ve igual que uno ausente** — es la
  clase C de arriba, y no tiene guarda a propósito.
* **Y todo recuento de lo que FALTA declarar corre sobre las entradas a las
  que ese campo se les puede exigir, y ninguna más** (v999, v1060, v1061,
  v1064, v1075). **Cinco veces** se midió un pendiente que nadie podía bajar nunca,
  y la cuarta estuvo publicada sesenta y cinco versiones: el tablero decía
  «entradas sin nivel de gobierno declarado · 75 de 218» cuando ni una de
  esas 75 era un acto —son cifras del país y resultados— y medido sobre los
  142 actos el pendiente era CERO. El denominador correcto estaba escrito dos
  mil líneas antes, en la puerta del indicador: dos codificaciones de una
  regla, que es la clase B. **La señal para buscarla: un pendiente cuyo
  número sube cuando el registro CRECE y no baja cuando alguien trabaja.**
* **Y la quinta tiene una forma propia que conviene saber buscar** (v1075):
  no es un recuento sino un **DISCRIMINANTE** que exige campos que el propio
  módulo declara inaplicables. `corridaHaciaAtras` contaba como «registro
  clasificado» las entradas con `nivelGobierno` + `estadoProcesal` +
  `tipoEvidencia`, tres campos que ese mismo archivo declara exigibles solo a
  las que DECLARAN indicador — así que un registro revisado en el que ningún
  criterio aplica daba **cero por construcción**, y cuatro fichas publicaban
  que el registro anterior «no pasó por esta clasificación». **La señal: una
  condición que el material correcto no puede satisfacer nunca.** Se busca
  preguntando *¿qué tendría que traer una entrada para contar acá, y este
  módulo se lo exige?* Y la cura no es aflojar la cuenta: es contar lo que de
  verdad discrimina —acá, que alguien la haya REVISADO y dejado el resultado
  escrito, aunque sea la lista vacía (v1061)—.
* **Un criterio se escribe contra una referencia EXTERNA, y primero** (v965,
  v1077). Redactarlo mirando los hechos que tiene que clasificar lo deja
  `construida-para-el-caso` y sin validar, y entonces el nivel del eje queda
  asignado y no calculado. Dos reglas que lo hacen comprobable: **el orden**
  —se escribe, y después se corre; mirar antes qué entradas hay es cómo se
  dibujan bordes a conveniencia sin darse cuenta— y que **la referencia vaya
  nombrada donde el lector la ve**, no en un comentario: `soloCodigo` los
  quita, así que una guarda no puede comprobarla ahí (v926, y mordió a la
  propia v1077). La señal de que no se escribió a conveniencia es que su
  primera corrida **no cuente nada**: I-14 salió con 2 entradas declaradas y
  0 contadas, porque la vara pedía más de lo que el registro traía.
* **Un umbral nuevo no se elige para que algo pase** (v882, v1075). Si al
  ponerlo el módulo mejora de estado, el umbral está midiendo la conveniencia.
  El de la v1075 se tomó prestado de `FICHA_MIN_HECHOS`, que ya estaba
  declarado, y la señal de que no era interesado es que **dejó los cuatro
  criterios sin validar igual que antes**: lo único que cambió fue que la
  razón publicada pasó a ser cierta.
* **Y la escala que ya está declarada en otra parte del módulo vale más que
  una nueva** (v1086). La escala de gravedad común entre ejes no se escribió:
  es `ESCALERA`, los cinco peldaños que el eje de la palabra usa desde el
  principio, y la composición es «manda el peor», que es la regla que las
  cuatro cuentas del registro ya aplicaban. Una escala escrita para la
  pregunta que la necesita se puede acomodar; una escrita para otra cosa y
  antes de que la pregunta existiera, no. **La señal de que no es interesada:
  aplicada no mejora el estado de nada** —el eje C siguió sin escala y el B sin
  su media—; lo único que cambió es que lo ya medido se publica.
* **Y un PISO se publica cuando lo que falta solo puede empeorar** (v1086).
  Con alguno de los ejes de realidad publicando nivel, callar el peor de ellos
  era publicar menos de lo que se sabe: el propio módulo ya tenía escrito que
  «lo que falta por medir podría ser peor y nunca mejor», así que el peor de
  los que publican es una cota inferior. Lleva **estado propio** —`piso`, no
  `dictamen`—, porque «no puede ser mejor que X» y «es X» dicen cosas distintas
  a quien lee (v876), y promete una sola cosa comprobable: que el dictamen
  final no quedará por encima de ese peldaño.
* **Y antes de aceptar un bloqueo de una tanda anterior, se mide** (v925,
  v1088). La v1087 cerró diciendo que el eje D no podía publicar nivel hasta
  documentar 13 actos más del gobierno anterior. Era falso y el bloqueo era
  mío: la validación contra otro gobierno es del INDICADOR —marca su
  `origenCategoria` y su bandera, y no impide nada—, mientras que el nivel de
  un eje solo pide **una escala escrita contra referencia externa y antes de
  mirar el registro**, que I-14 ya tenía desde la v1077. Y el propio eje traía
  un segundo bloqueo escrito: que sin la serie histórica «un nivel no sale».
  También falso para una escala de **cortes ABSOLUTOS**: la serie sirve para
  COMPARAR con otros gobiernos, no para poner el nivel. **La señal: un
  pendiente que nadie puede bajar y que ninguna regla escrita exige.**
* **Y un peldaño publicado dice DE QUÉ SALE, en la misma superficie** (v1088).
  La placa publicaba «No puede ser mejor que "Nada fiable"» —el peldaño más
  grave— sin un dato al lado, y es el juicio público sobre una persona con
  nombre: un lector no podía distinguir seis muertes confirmadas de un umbral
  puesto a ojo. El dato estaba calculado dos pantallas adentro, que es la clase
  C en el sitio más caro del módulo. Y va con **dos renglones y no uno**,
  porque piden acciones distintas: de qué sale el nivel, y **sobre qué
  evidencia descansa** —incluida la frase que evita la lectura falsa, que el
  documento que falta no movería el nivel—.
* **Y lo que la pantalla necesita VIAJA con el dato, no se reconstruye allí**
  (v867, v1088). El pintor de la placa buscaba la razón del nivel en `f.ejes`,
  que la ficha no expone. La cura no fue exponerla: fue meter `porque` y
  `descansaEn` dentro de `usados`, donde el veredicto ya los lleva. Así un eje
  nuevo que publique nivel lo hereda **sin que su autor se acuerde**, que es lo
  único que impide que vuelva a pasar.
* **Y un piso en el ÚLTIMO peldaño CIERRA el dictamen** (v1089). Si lo que
  falta solo puede empeorar el veredicto y el piso ya está en el peldaño más
  bajo de la escalera, no hay hacia dónde: el intervalo se cierra sobre un
  punto y el veredicto **es** ese peldaño, sin suponer nada sobre lo que falta.
  Es la monotonía de la v1048 aplicada a los ejes. Tres cosas lo hacen honesto
  y no un atajo: la saturación **se calcula contra el largo de la escalera** y
  no contra el id del último peldaño (v903), de modo que agregar un peldaño
  peor reabre el intervalo solo; un piso NO saturado **sigue siendo piso**; y
  el texto dice que está determinado «y no porque se haya medido todo», nombra
  los ejes que siguen sin medir y dice que si el eje que lo sostiene bajara,
  volvería a quedar abierto.
* **Un peldaño tiene DOS textos y no son intercambiables** (v1090). El
  NOMBRE —«Nada fiable»— es común a los cuatro ejes: es la escala de gravedad,
  y por eso se puede comparar entre ejes. La **LECTURA** —qué significa ese
  peldaño EN ESTE EJE— la pone cada eje y es distinta en cada uno.
  `ESCALERA[].d` habla de casos de corrupción porque es la escalera del eje de
  la PALABRA: correcta donde va rotulada, y **falsa** en cuanto un eje de
  realidad aterriza en el mismo peldaño, porque le atribuye al gobernante algo
  que ese eje no midió. La definición de la escalera se guarda con nombre
  propio (`defEscalera`) y nunca como `d` dentro del nivel de un eje, para que
  ninguna pantalla la pinte creyendo que es la lectura. Y **un eje no es
  `publicable` sin su lectura** (v880): el nivel se arma en UNA función, así
  que un eje nuevo no puede armarlo de otra manera.
* **Y el conteo de palomitas es parte de la lectura de una corrida** (v1090).
  Una guarda nueva con una variable de otro bloque tiró un `ReferenceError`
  que **mató la corrida antes del resumen**; el `grep` de `✗` no encontró nada
  y lo leí como verde — la trampa que este archivo ya tiene escrita como «una
  salida vacía no es una salida buena». Lo delató el NÚMERO: 683 donde la
  corrida anterior tenía 701. Dos reglas: **se compara el conteo contra el de
  la corrida anterior**, y un arnés de inyecciones distingue **tres** estados
  —`ROJO`, `VERDE` y `MURIO`—, porque una inyección que mata la corrida no es
  una guarda que mordió.
* **Una condición que compara contra un estado que nadie devuelve es siempre
  verdadera, y su rama muerta despierta el día que el módulo mejora** (v1089).
  Tres sitios preguntaban «¿hay dictamen?» con `estado !== 'ok'`, y
  `veredictoGeneral` nunca devuelve `'ok'`. Mientras no hubo dictamen nadie lo
  notó; el día que apareció, la placa lo pintó con el gris de «no hay», el
  texto accesible leyó «sin dictamen todavía» encima de uno publicado, y un
  `else` muerto desde la v1056 despertó y volvió a titular con el peldaño de la
  PALABRA. **Una rama que solo se alcanza cuando el módulo MEJORA es una
  regresión esperando**, así que se RETIRA en vez de arreglarse —antes de
  retirarla se comprueba que no pierda ninguna capacidad— y la pregunta queda
  en UNA función. La señal para buscarla: un estado comparado contra un valor
  que no está en la lista de los que la función devuelve.
* **Un ayudante de prosa que ANTEPONE el número no se anida** (v1086). `cn`
  imprime la cifra y el plural, así que `cn(a, 'uno de ' + cn(b, …))` sale como
  «1 Un eje de 3 los 3 que miden la realidad». Pasó **tres veces en una sola
  tanda** y ninguna se ve leyendo el código ni leyendo el papel, porque esas
  ramas no se ejecutan con el registro de hoy: las vio el **caso fabricado**.
  Para contar se usa `cn`; dentro de una frase ya contada, `pl`.
* **Un estado al que solo se llega cuando TODO está mal es un estado
  inalcanzable** (v1086). `nivel-fuera-de-escala` pedía que los tres ejes
  trajeran un id malo; con uno malo y dos sin medir, la placa decía «2 de 3 no
  publican» y el que publicaba basura desaparecía. Es la exención silenciosa,
  y la causa pide otra acción —un id mal escrito, no un archivo que falte—, así
  que se cuenta aparte y se dice en TODAS las ramas, incluida la del éxito.
* **Y una comprobación que llega a cero se DICE, no desaparece** (v1064). Un
  renglón que se borra solo deja «ya está hecho» con la misma cara que
  «nadie lo ha mirado» —la regla de arriba, dicha en una pantalla—. Tres de
  las cinco comprobaciones del tablero estaban en cero sin que nadie lo
  supiera. Es la forma de la v970 aplicada al papel: las dos redacciones se
  escriben, y la de cero LLEGA.

### Al cerrar una tanda

* **El token de versión se escribe cuando la tanda CIERRA**, no cuando empieza
  (v948): una tanda cuyo resultado es una medición y una decisión de no hacer
  necesita un nombre que diga eso.
* **Una tanda que cierre algo declarado en otra sección vuelve a ese renglón y
  lo marca** (v1006), y el que no lo haga sale en rojo.
* **«Cerrado» y «se midió y se declinó» no son lo mismo** para quien lee: la
  primera invita a buscar el resultado, la segunda a no volver a medir lo
  mismo. Por eso la marca tiene tres formas:

```
`pendiente`                                sigue abierta
`cerrado en vNNNN`                         la hizo esa versión
`cerrado en vNNNN · medido y declinado`    se midió y se decidió no hacerla
```

* **Una prueba que falla por un cambio legítimo se hace más precisa, no más
  laxa.** Aflojar una aserción para que pase es perder la prueba entera, y la
  constante del día metida dentro de una comprobación (v890) es la forma en
  que una guarda envejece sin que nada esté mal.

#### Los encabezados que la comprobación mira · `ENCABEZADOS-APLAZADOS`

Una sección que declare trabajo aplazado se titula con una de estas cinco
formas, o la comprobación no la mira y sus renglones se quedan sin estado. Y
`revisar.js` comprueba que esta lista y la suya sean la misma, que es lo que
impide que el convenio escrito y el aplicado se separen (v926):

* `NO hace`
* `NO cierra`
* `sigue pendiente`
* `NO se hace`
* `sigue faltando`

Y una que NO cuenta: `NO se pudo`. Eso es una limitación de medición del
contenedor —«ninguna suite de navegador»— y no trabajo que alguien decidió
aplazar; pedirle un estado mandaría a cerrar lo que no depende de nadie acá.

**La marca va por RENGLÓN y no por sección** (v1007): una sección de cuatro
renglones con una sola marca deja tres sin estado, que es como envejecieron
siete. Y la marca **se pone midiendo** (v1008): comprobar que la marca ESTÉ es
lo que una guarda puede hacer; que sea CIERTA no, y un `pendiente` sobre algo
hecho es peor que ninguna marca, porque invita a no volver a mirar.

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
