# Cómo trabajan juntas las sesiones de URBIS · `COORDINACION-MODULOS`

Daniel abrió **una sesión de Claude Code por módulo** el 23 de octubre de 2026,
y dejó dicho que **la sesión «Urbis project» (rama `main-r3g781`) es la cabeza**:
la que coordina y la que decide lo compartido. Este archivo es lo que la cabeza
dice. Se lee **antes de tocar nada** y manda sobre cualquier convención que una
sesión haya escrito por su cuenta.

Lo escribe la cabeza y **solo la cabeza**. Si una sesión no está de acuerdo con
un renglón, lo discute acá —escribiéndole a la cabeza o a Daniel— y no lo
reescribe en su rama.

---

## 0 · Lo que ya pasó, medido, y por qué existe este archivo

Al medir el 23 de octubre de 2026 las nueve ramas de módulo:

* **siete de ellas habían escrito su propia versión de «las ocho reglas» en
  `CLAUDE.md`** —entre 26 y 55 líneas cada una, todas al principio del
  archivo—. Las ocho reglas son las mismas en las siete; lo que cambia es la
  redacción y el título de la sección.
* las nueve estaban **bloqueadas esperando decisiones de Daniel**, y cinco
  preguntaban lo mismo («¿qué rama manda?») y cuatro otra misma cosa
  («¿los commits de solo documentación llevan salto de versión?»).

Eso es, exactamente, **siete codificaciones de un solo hecho** —la clase B que
este repositorio lleva treinta tandas persiguiendo— cometida en el archivo que
TODA sesión carga. Al fusionarlas serían siete conflictos en el mismo sitio, y
el resultado se parecería a las ocho reglas escritas ocho veces.

Nadie hizo nada mal: cada sesión oyó el dictado y lo anotó donde se anota lo
que vale para todos. **El fallo es de coordinación, y la cura es tener dónde
coordinar.** Este archivo es ese sitio.

---

## 1 · Las ocho reglas viven en UN solo sitio

Están en `CLAUDE.md`, al principio, escritas una vez. **Ninguna sesión las
vuelve a escribir.** Si su rama trae una copia, se retira así:

```bash
git fetch origin && git merge origin/main-r3g781 --no-edit   # con &&, no con ;
git log --oneline -1                                          # comprobar la HISTORIA, no el mensaje
# si el merge deja conflicto en CLAUDE.md, la versión que manda es la de la cabeza:
git checkout origin/main-r3g781 -- CLAUDE.md && git add CLAUDE.md
```

Lo de su módulo que no sea una de las ocho **no se pierde**: va a su propio
archivo (sección 4).

`revisar.js` se pone rojo si la lista de las ocho aparece más de una vez.

---

## 2 · Las tres preguntas que cinco sesiones hicieron a la vez

### ¿Qué rama manda?

**Cada módulo se queda en SU rama `claude/…`.** No se trabaja en
`main-r3g781`: esa es la rama de la cabeza, y nueve sesiones escribiendo en
ella sería el choque de la v788 multiplicado por nueve.

* Se empuja **solo a la rama propia**, con `git push -u origin <su rama>`.
* **Nadie empuja a `main`.** Empujar a `main` ES publicar: GitHub Pages sirve
  el sitio desde ahí, y además la rutina diaria escribe en `main` varias veces
  al día con su propio salto de versión.
* **Antes de empezar y antes de empujar**, se trae lo de arriba:
  `git fetch origin && git merge origin/main-r3g781 --no-edit`, encadenado con
  `&&`, y se comprueba la HISTORIA y no el mensaje (`git merge` con el árbol
  sucio **aborta** imprimiendo `Updating …`, que parece que funcionó; está en
  `CLAUDE.md`, y costó dos versiones publicadas).
* **Integra la cabeza**, una rama a la vez, y de ahí sale a `main` cuando
  Daniel diga «súbalo».

### ¿Una tanda de solo documentación lleva salto de versión?

**No, y en una rama de módulo NINGUNA tanda lo lleva.** Dos razones, y las dos
son medibles:

* el token de versión existe para **romper la caché del navegador**. Un cambio
  que el navegador no descarga —un `.md`, una nota, la bitácora— no tiene caché
  que romper, así que subirlo es un número sin hecho detrás;
* y el token vive en **nueve archivos que tienen que decir lo mismo**. Nueve
  sesiones subiéndolo en paralelo son nueve conflictos en nueve archivos, y la
  manera de resolverlos —subir por encima de las dos— no escala a nueve.

**El salto de versión lo pone la cabeza, una sola vez, al integrar**, por
encima de lo que `origin/main` tenga en ese momento. Si su módulo necesita que
el navegador descargue un archivo nuevo, se le dice a la cabeza y ella lo
numera; no lo numere usted.

### ¿Quién avisa a las otras sesiones?

**La cabeza.** Si al medir encuentra algo que es de otro módulo —una suite
ajena en rojo, un archivo compartido que habría que cambiar— **no lo arregle y
no le escriba a la otra sesión**: anótelo en su reporte a Daniel y dígaselo a
la cabeza. Dos sesiones arreglando lo mismo es peor que ninguna.

---

## 3 · Los archivos COMPARTIDOS, que nadie toca sin la cabeza

Un cambio en cualquiera de estos toca a todos los módulos. Se piden, no se
hacen:

| Archivo | Qué hay dentro |
|---|---|
| `CLAUDE.md` | las reglas comunes; lo escribe la cabeza |
| `js/00-config.js` | el endpoint, las llaves, `URBIS_FECHA` |
| `js/12-spa-ui.js` · `urbisGuardarFila`, `urbisDBRead`, `urbisDBUpdate` | el ÚNICO camino de escritura y lectura de la capa de mapeos |
| `js/04-marker-proximity.js` · `URBIS_SLOTS` | el reparto por posición de `descripcion`. **Congelado en 23 casillas** |
| `js/03h-registro-modulos.js` | quién es dueño de qué tipo, y qué comparte cada módulo |
| `index.html` · la lista de `<script>` | el orden de carga |
| `service-worker.js` · la lista de precaché | lo que el teléfono guarda |
| `css/main.css` | la hoja común |
| los **nueve** archivos del token de versión | `service-worker.js`, `index.html`, `css/main.css`, `analisis-ia.html`, `seguimiento.html`, `reportes.html`, `sw-reportes.js`, `vision-territorial.html`, `sw-vt.js` |
| `pruebas/revisar.js` | se AGREGA el bloque propio al final; no se tocan los bloques ajenos |

Y uno que no es de nadie y lo usan dos: **`js/61-analisis-ia-datos.js` es de
Empresas**, y el educativo lo llama **28 veces** desde `js/68` y `js/64`
(medido el 23 de octubre de 2026). Empresas lo cambia avisando; el educativo
no lo cambia.

---

## 4 · Dónde escribe cada sesión sus propias notas

**No en `CLAUDE.md`.** En `herramientas/modulos/<modulo>.md`, que es suyo y no
choca con nadie. Es la misma mudanza que el proyecto ya hizo con
`BITACORA.md`: lo que una sesión necesita leer ANTES de trabajar se queda en
`CLAUDE.md`, y el detalle vive aparte.

Lo que sí va a `CLAUDE.md` —y lo mete la cabeza, no la sesión— es **una regla
nueva que obligue a todos**.

---

## 5 · Un tipo nuevo en la capa de mapeos se pide, no se inventa

Desde la v1162 la capa tiene registro: `js/03h-registro-modulos.js`. Un módulo
que vaya a guardar puntos:

1. le pide a la cabeza su entrada en el registro: **id, tipos** (exactos, o un
   prefijo si los fabrica por fila), **qué comparte y qué es privado**;
2. **no abre casillas posicionales**. `URBIS_SLOTS` quedó congelada; los campos
   nuevos van por `URBIS_CAMPOS` en `espacioConNombre`, con nombre y con dueño;
3. `revisar.js` se pone rojo si dos módulos reclaman el mismo tipo, si un tipo
   escrito no está registrado, o si nace una casilla por posición.

---

## 6 · Lo que NINGUNA sesión decide sola

Va acá porque es la regla 8 de Daniel aplicada, y porque cada una de estas ya
costó algo:

* cambiar una **escala, un umbral o un criterio** que decida un nivel o un
  veredicto;
* **publicar o cambiar un dictamen** sobre una persona real;
* ponerle a un hecho una **calificación jurídica**;
* **retirar un pendiente** declarado, o marcar un contrargumento como ausente;
* **tocar un archivo compartido** de la sección 3;
* **empujar a `main`**.

---

## 7 · Cómo se cierra una tanda, y qué se reporta

Daniel lo fijó: **qué salió, qué mediste, qué queda pendiente y qué decisión
necesitas de él. Corto y con cifras.** Y acá se agrega una línea más, porque
con nueve sesiones hace falta:

> **qué archivo compartido habría que tocar, si alguno** — para que la cabeza
> lo vea antes de que dos sesiones lo toquen el mismo día.
