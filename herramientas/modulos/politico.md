# Módulo Político · control de votos y territorio de voto

**Notas de la sesión del 23 de octubre de 2026.** Están acá para poder retomar
el módulo **sin volver a medir** lo que ya se midió. Cada cifra lleva su fecha
y cómo se obtuvo, para que la sesión que vuelva sepa qué puede creer y qué
tiene que re-medir.

> **Esta nota NO la vigila `revisar.js`.** `herramientas/` está excluida de su
> barrido (`pruebas/revisar.js:962`), así que ningún renglón de acá sale en
> rojo cuando envejezca. Es la trampa de la v868 —una lista honesta se vuelve
> vieja la primera vez que alguien implementa algo— y acá no hay guarda que
> la cace. Quien retome: **re-mide antes de creerle a esta nota**, empezando
> por «lo que existe hoy», que es lo que cambia primero.

## Estado: EN PAUSA

Lo decidió Daniel el 23 de octubre de 2026. **No se avanza al peldaño 1.** La
razón no es técnica: **no hay socio ni financiación todavía**. El modelo de
URBIS es un socio o inversionista por módulo, y para este se buscaba una
socia —una exsenadora— que financiara su terminación; la presentación de
octubre no se pudo dar y el módulo sigue buscando socio.

**Es el módulo menos avanzado de URBIS**, y eso es un hecho medido, no una
impresión: está en cero. La prioridad hasta ahora fue lo educativo, el centro
editorial, eventos y análisis.

**No se presenta como terminado en ningún material.**

## Las decisiones de Daniel del 23 de octubre de 2026

1. **El módulo queda en pausa.** No se avanza al peldaño 1.
2. **Regla 2, para todos los módulos:** se exige que la suite de la tanda esté
   en verde y que **no sume rojas nuevas**. Las 12 rojas heredadas las
   clasifica la **sesión general** —ambientales o reales—, y **el merge a
   `main` lo hace solo ella**, con la batería limpia. Es decir: una sesión de
   módulo no fusiona a `main`.
3. **Rama `claude/festive-shannon-rbqzwu`, sin salto de versión.** Esta tanda
   no publica, así que no toca los nueve archivos de versión.
4. **Datos personales reales de votantes: decisión de Daniel, cuando haya
   socio.** Mientras tanto **no se construye almacenamiento de esos datos.**
5. Dejar esta nota.

## Lo que existe hoy del módulo · medido el 23 de octubre de 2026

**CERO.** No es «poco»: no hay ni una línea. Ni código, ni datos, ni puerta
declarada en `js/70-modo-app.js`, ni renglón en la `LISTA-QUE-SIGUE`, ni
sección en `DECISIONES-PENDIENTES.md`.

Cómo se midió, para no repetirlo: búsqueda sobre todo el repositorio de
`votante`, `padrón`, `cédula`, `puesto de votación`, `censo electoral`,
`territorio de voto`, `control de votos`, `electoral`, `engativá`,
`aeropuerto`, `mockup`, `exsenadora` y `deck`. **Tres aciertos, los tres
falsos positivos**, y conviene dejarlos escritos para que la próxima no los
persiga otra vez:

| Dónde | Qué es de verdad |
|---|---|
| `urbisVotanteActual()` · `js/12-spa-ui.js:75` | quién vota si un reporte ciudadano sigue ahí; nada electoral |
| `votar()` · `js/70-seguimiento.js:11705` | una encuesta del centro editorial |
| «Engativá» · `js/41-email-registration-auth.js:156` y `pruebas/revisar.js:6678` | listas de localidades y de municipios, para el registro y el verificador de enlaces |

**Las puertas que sí existen son seis:** ciudadano, educativo (Pro City),
empresarial (`analisis-ia.html`), seguimiento presidencial (`seguimiento.html`),
Visión Territorial (`vision-territorial.html`) y el mapeo. El político sería
**la séptima**.

**El deck no está en el repositorio.** Cero archivos. El de octubre —vertical
para celular, con datos reales del sector Aeropuerto de Bogotá (Engativá) y
una lista de votantes **SIMULADA**— vive fuera de acá. **Hace falta para
arrancar** (ver más abajo).

## Lo reutilizable del educativo · la pieza que de verdad importa

Son 42.096 líneas en los ocho archivos del análisis, pero lo que este módulo
necesita está casi todo en **`js/61-analisis-ia-datos.js`** (1.682 líneas) y
sale por `window.AIA_DATOS`. **Tres capacidades ya resueltas:**

* **`manzanasEstrato(lat, lng, radioM)`** → devuelve **los polígonos de
  manzana** del DANE, ya convertidos a `[lat, lng]` para Leaflet, con su
  estrato, su etiqueta y su color. *Esto es el «barrio por barrio» de la
  visión del módulo, ya implementado.* Y trae la fila **«Sin estrato»**
  aparte a propósito —suelo industrial, dotacional y lotes—, que es
  exactamente la clase de distinción que este módulo va a necesitar.
* **`consultarDANE(lat, lng, radioM, municipio)`** → población, viviendas,
  pirámide por los veintiún tramos de edad, reparto por sexo y estrato,
  **por manzana**, con respaldo por sector y con la fuente declarada
  (`fuente: 'manzana'` o `'sector'`). Ese es el sustrato del territorio de
  voto: cuánta gente vive en cada manzana y de qué edades.
* **`censoAmpliado`** (escolaridad, hogares, alfabetismo) y
  **`proyeccionDe(municipio)`** (divipola y proyección DANE).
  Más el geocodificador: `buscarDireccion`, `ubicacionDe`,
  `parsearEnlaceMaps`.

**Y la cuarta, que es la que nadie esperaría y encaja perfecto: los TRAZOS
GUARDADOS.** `TRAZOS_KEY = 'pcr_trazos_v1'` en `js/68-procity-reconocimiento.js:418`,
con su suite `pruebas/suites/ttrazos.js`. Nació en la v871 para otra cosa
—«guardar el polígono que dibuje, sin análisis, y después analizarlo las
veces que yo quiera»— y es **literalmente lo que una campaña necesita**:
dibujar la zona de un líder una vez, guardarla, y medirla cuantas veces haga
falta. La forma es una cosa y lo que se midió sobre ella es otra, y ya están
separadas, con las dos direcciones probadas: borrar el trazo no borra los
análisis, y analizar no duplica el trazo.

**Lo que NO se puede reutilizar tal cual:** nada de `js/61` llega hoy al DANE
desde este contenedor (ver limitaciones). Un peldaño 1 honesto corre contra un
**fixture**, no contra el servicio.

## Lo reutilizable de Visión Territorial · el patrón, no el código

Son 1.573 líneas en cinco archivos (`js/90-vt-app.js` 965, `css/90-vt.css`
402, `vision-territorial.html` 126, `sw-vt.js` 58, `manifest-gobierno.json`
22). **El código no sirve** —mide déficits de equipamientos, que es otra
pregunta—, pero **la forma de módulo aparte sí**, y está ya probada y
vigilada por el bloque «Visión Territorial, aparte» de `revisar.js`:

* página propia con **service worker de ámbito propio** y manifiesto propio;
* **prefijo de almacenamiento** (`urbis_vt_`) y **un único global**
  (`window.VT`);
* comparte con `index.html` exactamente **dos** archivos de solo lectura:
  `js/00-config.js` y `js/71-iconos-urbis.js`;
* `?app=gobierno` declarado en `js/70` con `pantallas: []` y una `pagina`,
  para que nadie llegue a la aplicación entera por el parámetro;
* **cuatro estados por pantalla**: cargando, con datos, sin datos, error.

**Y el patrón que este módulo necesita más que ninguno, el de la v867: el
aviso viaja con la CIFRA, no con la pantalla.** En VT `enviar` le pega
`aviso_datos` a toda respuesta, y el cliente lo recoge en un solo sitio, así
que **una pantalla nueva lo hereda sin que su autor se acuerde**. Para un
módulo donde todo va rotulado `SIMULADO`, esa es la diferencia entre rotularlo
bien y acordarse cuatro veces — que es el fallo exacto que la v867 pagó, y que
estuvo veintitrés versiones en verde porque la comprobación miraba solo una
pantalla.

**Lo que de VT no está disponible acá:** su backend. `../urbis-motor` no está
en este contenedor, así que su esquema PostGIS, sus rutas `/vt/*` y sus
pruebas no se pueden correr ni leer desde una sesión como esta. Lo que se sabe
de él es lo que `CLAUDE.md` tiene escrito.

## El alcance mínimo de la v1 que se propuso · seis peldaños

Demostrable con **datos simulados**, en este orden, cada uno medido:

1. **La séptima puerta**, copiando el patrón de VT: `politico.html`,
   `sw-politico.js` con su ámbito, su manifiesto, prefijo `urbis_pol_`, único
   global `window.POL`, y `?app=politico` declarado en `js/70-modo-app.js` con
   `pantallas: []` y su `pagina`. Más su bloque de guardas en `revisar.js`,
   con la forma del de «Visión Territorial, aparte». **Y el salto de versión
   pasa a NUEVE + 2 archivos**: la página nueva y su service worker entran a
   la lista, como entraron los de VT — y `CLAUDE.md` ya advierte que **manda la
   guarda y no la lista escrita**.
2. **El territorio contra un FIXTURE**, no contra el DANE en vivo, porque el
   proxy lo niega: los polígonos de manzana del sector con la forma exacta que
   `manzanasEstrato` ya devuelve, de modo que el día que haya red el módulo no
   cambie.
3. **La lista simulada de votantes** en un archivo de datos propio, cada uno
   con su manzana, y **`SIMULADO` viajando pegado al dato** —patrón v867—, no
   escrito en cada pantalla.
4. **Tres pantallas**: el mapa (votantes por manzana, coropleta), la lista
   plana **al lado** —que es la hoja de Excel que el módulo viene a
   reemplazar, puesta ahí para que se vea la diferencia— y la ficha de
   manzana.
5. **Las dos redacciones escritas, la de cero y la de N** (v970), y
   **`SIN MEDIR`** donde no hay dato, distinguiendo cero de ausente (regla 6).
6. **Una suite `tpolitico.js`**, y cada aserción nueva **demostrada en rojo**
   con su inyección fiel (regla 3).

**Lo que esta v1 no haría, y es deliberado:** no guarda ningún dato personal
real, y **por construcción no puede** —vive en el navegador, sin base de
datos—, así que la decisión 4 de Daniel no se toca ni por accidente. Tampoco
se presenta como módulo terminado: el propio módulo lo diría en pantalla.

## Qué haría falta para arrancar el peldaño 1

Dos cosas, y ninguna depende de escribir código:

* **El socio.** Es la razón de la pausa.
* **El deck, o el volcado del sector Aeropuerto de Engativá.** Sin él los
  datos reales del sector no están acá y el proxy no deja traerlos, así que el
  fixture habría que fabricarlo — y entonces **el territorio también sería
  simulado**, no solo la lista. Eso cambia lo que el módulo puede decir de sí
  mismo, así que conviene conseguir el deck antes que fabricar el fixture.

## Las dos limitaciones del contenedor · medidas el 23 de octubre de 2026

* **El proxy niega los tres hosts que harían falta.** `ags.esri.co` (el censo
  por manzana del DANE), `registraduria.gov.co` y `datos.gov.co`: los tres
  contestan `000`. Es la misma limitación que `CLAUDE.md` midió el 2 de
  octubre sobre otros dominios, vigente el 23. **Consecuencia para este
  módulo:** todo peldaño se mide contra fixture, y ninguna cifra oficial se
  puede verificar desde acá (regla 7).
* **La batería de navegador no corre en un contenedor recién levantado**: no
  hay `node_modules` (falta Playwright) y falta `../urbis-motor`, que otra
  sesión adjuntó desde GitHub para correrla. Chromium sí está, en
  `/opt/pw-browsers/`.

**Línea base de la batería, para comparar:** `revisar.js` en **823 verdes,
0 rojos, 1 sin material, salida 0** (23 de octubre de 2026; el mismo conteo
antes y después de añadir las ocho reglas a `CLAUDE.md`, comprobado con
`git stash`). La de navegador, medida por otra sesión el 21-22 de octubre:
**108 verdes, 10 rojas, 2 caídas** sobre 120 suites de las 122 que hay
—`tvision` pide Postgres—. Las 12 las clasifica la sesión general (decisión 2).

## Lo que esta sesión dejó en el repositorio

Un solo cambio, y no es del módulo: **las ocho reglas de trabajo en
`CLAUDE.md`**, arriba, antes de `LISTA-QUE-SIGUE`. Daniel pidió dejarlas como
están.

**Y una consecuencia que conviene tener escrita:** la precisión de la decisión
2 —«tu suite en verde y ninguna roja nueva; el merge a `main` lo hace la sesión
general»— **vale para todos los módulos y vive solo en esta nota**, que
ninguna otra sesión lee. Mientras siga así, una sesión de otro módulo puede
leer la regla 2 como «la batería entera en verde» y bloquearse sola sobre 12
rojas que no son suyas. Subirla a `CLAUDE.md` es un renglón, y es decisión de
Daniel porque él pidió no tocar el bloque de las ocho.
