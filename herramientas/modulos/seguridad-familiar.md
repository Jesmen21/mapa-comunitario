# Módulo Seguridad familiar · notas de la sesión

Rama: `claude/beautiful-fermi-pbwars`. Lo común (las ocho reglas, ramas,
versión, archivos compartidos) está en `CLAUDE.md` y en
`herramientas/COORDINACION-MODULOS.md`; acá va solo lo de este módulo.

## Lo que había antes de este módulo (medido el 23 de octubre de 2026)

* **No había módulo Seguridad**: ni código, ni pantalla, ni tarjeta en el
  inicio. `pánico`, `panic` y `SOS` dan cero coincidencias en el código
  servido, y Movilidad está como «Próximamente».
* **Reportes de seguridad**, del módulo Reportes/Eventos (`js/03c`): pestaña
  `security` con 20 tipos, pestaña `conflicto` con 17 (123 y 165 visibles,
  anónimo por defecto) y `traffic-crash` dentro de la pestaña de tráfico (30
  tipos). Vigencia de 8 h; 11 tipos preguntan por víctimas.
* **Presencia** (`js/78`): ubicación en vivo de contactos mutuos, con
  interruptor de duración. **No distingue familia de amigo**: `amigos()` no
  lee el tipo de relación.
* **`db_read` es abierto** según el propio cliente (`js/12`, comentario sobre
  `_dbToken`): las filas `ubicacion_<usuario>` llegarían a cualquier teléfono
  y el filtro de contactos mutuos se aplicaría en el teléfono. **No se puede
  comprobar desde acá**: el Apps Script no está en este repositorio. Lo
  verifica Daniel (decisión A).

## Decisiones de Daniel (23 de octubre de 2026)

| | Decisión |
|---|---|
| A | Daniel verifica el filtro del servidor. **Nada familiar sobre la ubicación hasta entonces.** |
| B | La v1 no lleva botón de pánico con avisos. A lo sumo «Llamar al 123», enlace de marcado, sin servidor. |
| C | Reportes/Eventos es dueño de las pestañas de seguridad. Este módulo las LEE; no crea tipos. |
| D | Sin salto de versión en commits de documentación (y, por el protocolo de la cabeza, en ninguno de una rama de módulo). |
| E | Primer peldaño aprobado: la pantalla que lee lo ya existente, con «SIN MEDIR» donde no haya, y el 123 y el 165 siempre a la vista. |

## Peldaño 1 · la pantalla de Seguridad (`js/83-seguridad.js`, `css/83-seguridad.css`)

Una hoja (`window.URBIS_SEGURIDAD.abrir()`) que lee y no escribe:

* **Qué cuenta**: lo que `urbisDatosVisibles()` (js/05) devuelve —lo mismo
  que muestra el mapa, con moderación y vigencia— cuyo tipo es del módulo
  `reportes` en el registro (js/03h) y cuya etiqueta está en las pestañas
  `security` o `conflicto`, o es `traffic-crash`. La lista **se lee del
  catálogo**, no se copia.
* **Dónde**: a menos de `RADIO_M` = 1.000 m del punto de referencia, que es
  el centro del mapa o, si la persona toca «Usar mi ubicación», su posición
  (una sola lectura, `getCurrentPosition`, que no sale del teléfono).
* **SIN MEDIR y cero, aparte**: SIN MEDIR con su causa si el catálogo no
  cargó, si los reportes no se leyeron, si la lectura falló sin copia
  guardada o si no hay punto de referencia; «0 · ninguno vigente» solo si se
  leyó. Un reporte sin fecha dice «antigüedad SIN MEDIR».
* **Los teléfonos**: `tel:123` y `tel:165` en la cabecera de la hoja, en
  todos los estados.

Lo miden `pruebas/suites/tseguridad.js` (20 aserciones, sobre la aplicación
entera con un barrio fabricado) y el bloque «seguridad (js/83)» al final de
`pruebas/revisar.js` (5 comprobaciones). Las dos demostradas en rojo con
inyecciones fieles: 6 en `revisar.js` y 5 en la suite, todas ROJO, ninguna
MURIÓ.

### Lo que esta versión NO hace

* No es alcanzable por la gente todavía: falta el `<script>` y el `<link>` en
  `index.html`, la precaché en `service-worker.js` y un botón de entrada.
  Son archivos COMPARTIDOS y se le pidieron a la cabeza. Mientras tanto,
  `revisar.js` marca en rojo «ningún archivo de js/ o css/ se queda sin que
  nadie lo cargue» por js/83 y css/83. `pendiente`
* No muestra reportes vencidos: el mapa los retira y la pantalla también.
  Si hiciera falta un histórico, es una decisión de Daniel. `pendiente`
* No reconoce reportes guardados con una etiqueta que el catálogo ya no
  tiene: no se cuentan. Cuántos son en la hoja real es SIN MEDIR desde acá.
  `pendiente`
* El radio (1 km) y el orden (el más cercano primero) los eligió esta sesión
  y son decisión de producto de Daniel. `pendiente`

## Arreglado de paso, a pedido de Daniel · quitar un familiar de los contactos

`urbisEliminarContacto` (js/12) borraba solo «…~~~amigo». Medido con
`pruebas/suites/tcontactofamilia.js` contra el código anterior: **6/10**;
quedaban 5 filas de familia en la hoja y los familiares volvían al recargar.
Ahora borra la descripción exacta de lo que había en memoria y los dos tipos
en los dos sentidos: **10/10**. Tres inyecciones en rojo (borrar de más,
solo lo de memoria, solo «amigo»).

No se pudo comprobar desde acá si `db_delete` en el Apps Script borra TODAS
las filas que casan o solo la primera: si es solo la primera, una relación
duplicada en la hoja dejaría una copia.

## Para la cabeza (protocolo, punto 7)

* **El registro (js/03h)** declara `seguridad` con `archivos: []`: ahora
  existe `js/83-seguridad.js`. Y `backend: 'postgres'` vale para lo que este
  módulo ESCRIBA algún día; hoy no escribe nada y LEE la hoja por
  `urbisDatosVisibles`, que es como `leeDe: reportes.*` se cumple.
* **Archivos compartidos que harían falta**: `index.html` (`<script
  src="js/83-seguridad.js">` y `<link href="css/83-seguridad.css">`), la
  precaché de `service-worker.js`, el token de versión, y un botón de entrada
  (la portada vive en `js/20`, que el registro da a Reportes).
* **Hallazgo de otro módulo (Reportes), sin tocar**: `cargarPuntos` (js/12,
  `asegurarCamposTemporales(..., parseFechaReporte(p))`) le escribe en
  memoria, en cada carga, la HORA DE LA CARGA como fecha de creación a todo
  reporte que no traiga fecha, porque `parseFechaReporte` (js/05) cae en
  `new Date()`. Efecto medido en tseguridad con un reporte sin fecha: el mapa
  lo muestra como recién creado y **no vence nunca**, porque vuelve a nacer en
  cada carga. Cuántos hay así en la hoja real: SIN MEDIR desde acá.
* El arreglo de contactos tocó `js/12` en `urbisEliminarContacto`, que no es
  ninguna de las tres funciones compartidas de la tabla, pero sí es del
  módulo Social. Lo pidió Daniel directamente; ninguna rama de módulo había
  tocado esa función al medir.
