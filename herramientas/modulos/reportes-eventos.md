# Módulo Reportes / Eventos · notas de la sesión

Rama `claude/ecstatic-curie-hufat8`. Lo común —las ocho reglas, el reparto de
archivos, quién numera— está en `CLAUDE.md` y en
`herramientas/COORDINACION-MODULOS.md`, y lo escribe la cabeza. Acá va solo lo
propio de este módulo.

Es el módulo con el que nació URBIS: georreferenciar, tomar foto y reportar.
Salió de una propuesta a una Junta de Acción Comunal —si un candidato ganaba
la presidencia de la junta, tendría un software para mapear y administrar el
barrio—, y de ahí viene que los eventos de junta estén al mismo nivel que un
robo o un accidente.

## Lo que es de este módulo, medido

Del registro `js/03h-registro-modulos.js`: **`reportes` es dueño de 19 tipos**
y **`eventos` de uno** (`🎪 Eventos Comunitarios`). Sus archivos declarados son
`js/11`, `js/12`, `js/20`, `js/06` y `js/50`; los eventos, `js/09`, `js/12` y
`js/20`. El catálogo ciudadano vive en `js/03c-reportes-rapidos.js` y la Matriz
en `js/04-marker-proximity.js`.

Tres que se usan y **no son de este módulo**, así que se piden y no se tocan:
`URBIS_SLOTS` (js/04, congelada en 23 casillas), `urbisGuardarFila` /
`urbisDBRead` / `urbisDBUpdate` (js/12) y el precaché de `service-worker.js`.
Y uno que **no tiene dueño declarado** y este módulo lee todo el tiempo:
`js/10-visible-markers.js`, donde viven el globo del marcador y la ficha.

## LA MATRIZ DE TIPOS · contrato compartido con Movilidad

**No se cambia sin avisar a Daniel.** Movilidad publica reportes con estos
mismos tipos —`js/06` anexa el AutoMapeo a estas categorías—, así que un tipo
renombrado deja sus reportes viejos sin icono y fuera de los recuentos.

Y tiene una forma que no se ve leyendo un solo archivo: **la Matriz tiene dos
capas.**

1. **La capa fija**, `dimensiones` en `js/04-marker-proximity.js`:
   **19 dimensiones y 157 ítems**, ninguno repetido entre dimensiones. Es lo
   que se lee abriendo el archivo.
2. **La capa inyectada**, en tiempo de ejecución. El catálogo ciudadano
   (`js/03c`) trae **7 secciones y 126 tipos**, cada uno con la dimensión de
   la Matriz a la que pertenece. De esos 126, **solo 27 son ítem fijo de su
   dimensión: los otros 99 se añaden a `dimensiones[dim].items` al vuelo**, en
   `ensureQuickReportItemsInDimensions` (`js/20:2476`), la primera vez que
   alguien abre el detalle de un reporte rápido.

Es decir: **leer `js/04` da 157 tipos y la aplicación corriendo tiene hasta
256.** Quien mida la Matriz sin saberlo va a contar mal, y quien renombre una
etiqueta de `js/03c` creyendo que es solo un rótulo está cambiando el contrato.

La inyección **solo la hace `js/20`**. Es correcta —la dimensión es el cajón y
la etiqueta el tipo concreto— y conviene saber que ningún otro consumidor la
reproduce.

| Dimensión | ítems fijos | tipos rápidos | de ellos inyectados | vigencias |
|---|---:|---:|---:|---|
| `🚨 Alertas y Riesgos Urbanos` | 13 | 80 | 77 | 8, 24, 72, 120, 168 h |
| `🚗 Reportes de Tráfico` | 8 | 14 | 10 | 8 h |
| `🎪 Eventos Comunitarios` | 8 | 0 | 0 | la elige quien publica |
| `Vivienda y Residencial` | 15 | 0 | 0 | permanente |
| `Comercio y Servicios` | 13 | 0 | 0 | permanente |
| `Grandes Equipamientos` | 7 | 0 | 0 | permanente |
| `Áreas Deportivas` | 9 | 0 | 0 | permanente |
| `Áreas Verdes y Ambiental` | 13 | 4 | 4 | 8 h |
| `Infraestructura y Peatonal` | 14 | 0 | 0 | permanente |
| `Servicios Ocultos` | 6 | 0 | 0 | permanente |
| `Salud y Emergencias` | 4 | 0 | 0 | permanente |
| `Patrimonio y Turismo` | 5 | 0 | 0 | permanente |
| `Industria y Logística` | 5 | 0 | 0 | permanente |
| `Animal y Bienestar` | 4 | 3 | 3 | 8 h |
| `Infraestructura Smart` | 5 | 0 | 0 | permanente |
| `Oficinas y Co-working` | 4 | 0 | 0 | permanente |
| `🛡️ Seguridad Nacional y Conflicto` | 17 | 17 | 2 | 24, 72, 168 h |
| `🌪️ Desastres Naturales y Clima` | 6 | 7 | 3 | 12, 48, 72, 168, 336 h |
| `⛰️ Riesgos del Terreno` | 1 | 1 | 0 | 120 h |
| **total** | **157** | **126** | **99** | |

«Permanente» quiere decir que esas 14 dimensiones están en `PRO_CITY_DIMS`:
son **inventario de la Matriz de Usos**, no alertas, y por eso no caducan
(v988). Las siete secciones del catálogo ciudadano:

| sección | rótulo | tipos | pide cuidado con datos personales |
|---|---|---:|---|
| `vial` | Vial y movilidad | 30 | no |
| `security` | Seguridad y emergencias | 20 | **sí** |
| `conflicto` | Seguridad nacional | 17 | **sí** |
| `natural` | Desastres y riesgo natural | 12 | no |
| `ambiental` | Ambiente y salud | 20 | no |
| `espacio` | Espacio público y accesibilidad | 15 | no |
| `servicios` | Servicios, vivienda y desarrollo | 12 | no |

**Si se agrega o se renombra un tipo** se le pide la entrada a la cabeza antes
de escribir: `revisar.js` se pone rojo con un tipo escrito que no esté
registrado en `js/03h`.

## Cuánto dura un reporte en el mapa

Ninguno de los 126 tipos rápidos es permanente: `enviarDatos` escribe la fila
con `asegurarCamposTemporalesPersonalizados`, que marca **«Temporal»** y una
fecha de vencimiento, y un reporte temporal vencido **desaparece** del mapa del
ciudadano (`visibleParaRol`, js/05).

Las horas salen de **`urbisHorasVigencia`, en `js/03c`, y de ningún otro
sitio** (v1163). Reparto medido sobre los 126: **8 h × 95 · 12 h × 1 ·
24 h × 2 · 48 h × 1 · 72 h × 15 · 120 h × 2 · 168 h × 8 · 336 h × 2.**

El orden de la cascada importa: atentado o artefacto explosivo 24 h → alerta
nacional del catálogo → conflicto que no pasa rápido 168 h → resto del
conflicto 72 h → cualquier otro 8 h. El paso del atentado va primero a
propósito, porque también está en la tabla de alertas.

## El flujo, de punta a punta

1. Mapa → se fija el punto (GPS o a dedo) → `pickCommunityPoint` (js/20).
2. Sección y tipo del catálogo → `openQuickReportDetails` arma
   `window.__urbisCurrentFormContext`, inyecta los tipos en la Matriz y pinta
   el panel con la vigencia real del tipo.
3. «Publicar» → `publishQuickReport` → `enviarDatosDesdeFormulario` →
   `enviarDatos` (js/12).
4. La fila se arma como una cadena partida por `' | '` con posiciones fijas:
   **`BASE_OFFSET = 6 + 37 usos = 43`**, la foto en `d[43]`, y el reparto del
   resto en `URBIS_SLOTS`.
5. `urbisGuardarFila` → `URBIS_AUTH.socialAPI` → **un solo Apps Script sobre un
   Google Sheet**. La lectura tiene caché de 3 minutos, y toda escritura la
   invalida.

La **foto** viaja como data URL dentro de la celda: techo **42.000
caracteres**, WebP si el navegador lo soporta, escalera de 1600 a 320 px y un
último recurso a 49.000 con calidad 0,15. No hay almacenamiento de imágenes
aparte: la celda es el límite.

## `tcorregir`: 5 rojas, causa medida, y NO es de la corrección

Estaba roja ya el 21-22 de octubre de 2026, con el motor presente. Medido el
23 de octubre en el navegador:

**La causa es `window.urbisSinDireccion`, que no existe todavía cuando
`mostrarDetalles` la llama.** Está asignada **dentro de
`crearMarcadorUrbano`** (`js/10:404`) y la lee **`mostrarDetalles`**
(`js/10:970`), que es otra función de primer nivel. Si `mostrarDetalles` corre
antes de que se haya dibujado un solo marcador, lanza
`window.urbisSinDireccion is not a function`.

Demostrado en el navegador, en la misma página:

| momento | `typeof window.urbisSinDireccion` | `mostrarDetalles` |
|---|---|---|
| antes de dibujar un marcador | `undefined` | **lanza** |
| después de dibujar uno | `function` | funciona, y pinta «Le piden corregir» |

**La función de pedir corrección está bien.** Con un marcador dibujado antes,
el autor y el moderador ven la petición y el resto se comporta. Las cinco
aserciones fallan porque la suite llama a `mostrarDetalles` directamente, sin
dibujar nada, así que su ayudante `detalle()` devuelve `null` — y las tres que
exigen que el texto **no** aparezca piden además `!== null`, así que caen por
la misma razón que las dos que piden que aparezca.

Y una que conviene saber: la aserción vecina que **sí** pasa —«y un vecino
cualquiera NO»— pasa por el motivo equivocado. Un vecino cualquiera sobre un
reporte pendiente sale por una rama temprana que nunca llega a la línea 970,
así que pasaría igual con la función rota. Es un verde que no mide.

**Qué le toca a quién:** `js/10` no tiene dueño declarado en `js/03h` y la cura
—mover la asignación fuera de `crearMarcadorUrbano`— es de una línea, pero no
es de este módulo. Va a la cabeza. Lo que no pude medir desde acá es si alguna
pantalla de producción llega a `mostrarDetalles` con cero marcadores dibujados;
en el mapa normal los marcadores se pintan antes de que nadie pueda tocar uno.

## Lo que está pedido a la cabeza o a Daniel

* **`js/10:1110` tiene un comentario viejo:** dice que
  `URBIS_QUICK_REPORT_SECTIONS` se define «en js/20», y se mudó a `js/03c`.
  Para integrar, no para arreglar acá.
* **`js/10:404`:** la asignación de `urbisSinDireccion`, de arriba.
* **La guarda de versión choca con el punto 4 del protocolo.** «La versión sube
  cuando cambia el código» se pone **roja en cuanto una rama de módulo toca un
  archivo precacheado y no numera** —que es exactamente lo que el protocolo
  manda hacer—. Solo muerde con el árbol sucio, así que se apaga al
  comprometer; es decir, mientras una sesión de módulo trabaja, su batería
  está en rojo por obedecer. Con la regla 2 —nada se publica en rojo— eso
  enseña a convivir con un rojo, que es lo que el repositorio lleva treinta
  tandas evitando.
