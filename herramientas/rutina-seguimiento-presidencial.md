# La rutina diaria del Seguimiento Presidencial

> ## ESTE ARCHIVO ESTÁ VIEJO, y lo de abajo también · medido el 23 oct 2026
>
> El texto de abajo es el de la v795 —dice «los siete archivos de versión» y
> son nueve desde la v1140— y la rutina **ya no se edita en la web**: el 22 de
> octubre de 2026 se reemplazó por dos tareas programadas creadas desde una
> sesión, que son las que corren hoy. Se conserva entero porque es el
> historial de qué pedía esta rutina y cuándo.
>
> ### Por qué la primera corrida de la rutina nueva no publicó nada
>
> **Las dos tareas dispararon el 23 de octubre y ninguna publicó.** Medido:
>
> | | Alertas | Seguimiento |
> |---|---|---|
> | disparó | 11:40 UTC | 12:36 UTC |
> | terminó | 11:42 | 12:38 |
> | duró | 1 min 40 s | 2 min 6 s |
> | estado de la corrida | SUCCEEDED | SUCCEEDED |
> | commits en `main` | ninguno | ninguno |
>
> **La causa está en la etiqueta de las dos sesiones que se crearon:
> `config:no-git-repo`.** Una tarea programada que crea una sesión nueva en
> cada disparo la crea **SIN repositorio adjunto**, y los repositorios de una
> sesión se eligen cuando arranca. Así que las dos corridas no tenían el
> archivo que vienen a editar: `git rev-parse` falla, y clonar tampoco sirve
> porque sin el repositorio adjunto no hay credenciales y el clon de un
> repositorio privado contesta 404, que se lee como que no existe.
>
> **Y conviene no confundir dos cosas**, porque es la trampa de los éxitos
> aparentes de `CLAUDE.md` y acá NO aplica: `SUCCEEDED` es el estado de la
> CORRIDA —el turno terminó sin reventar—, no una afirmación de que publicó.
> Las dos corridas pueden haber reportado honestamente que no pudieron
> publicar: su propio texto se lo exige en la primera sección. Lo que no se
> puede leer desde acá es su resumen.
>
> **El arreglo NO es el texto de la rutina.** El texto está bien y ya exige
> decirlo cuando no se puede publicar. El arreglo es de ENTORNO, y tiene dos
> caminos:
>
> 1. **el durable, y lo hace Daniel:** agregar `Jesmen21/mapa-comunitario`
>    bajo *Repositories* en los ajustes del entorno —el menú del entorno en la
>    barra de título de la sesión, «Edit»—. Desde ahí toda sesión nueva de ese
>    entorno arranca con el repositorio, rutinas incluidas, y ninguna otra
>    sesión programada vuelve a nacer ciega. Una llave o una variable guardada
>    NO lo trae;
> 2. **el de la propia rutina:** las sesiones que las tareas crean sí tienen
>    la herramienta `add_repo`, así que el texto podría adjuntarse el
>    repositorio solo antes de hacer nada. No se cambió acá a propósito: el
>    texto vivo son unos 10.000 caracteres y reescribirlo a mano para tocarle
>    la primera sección es justo donde se cae un párrafo sin que nadie lo
>    note. Si el camino 1 no alcanza, se hace el 2 con el texto delante.
>
> **Un dato más que salió al medir y que nadie pidió:** las dos corridas se
> sirvieron con **Sonnet 5.5**, no con Opus. La tarea no declara modelo, así
> que toma el de por defecto. No se cambió: el modelo de una tarea se cambia
> solo si Daniel lo pide con esas palabras.

Este es el texto que la Routine «URBIS · Seguimiento Presidencial (diaria)»
manda cada día a las 13:00 UTC (8 de la mañana en Colombia). Vive acá para
que no se pierda y para que se vea en el historial cuándo cambió y por qué:
la rutina misma no es parte del repositorio, se edita en la web de Claude y
solo la puede cambiar quien la creó.

Se actualizó el 7 de septiembre de 2026 con lo que entró entre la v791 y la
v795: la ficha del gobernante, la sección `casos` con estado probatorio, los
siete archivos de versión (eran cinco) y el paso por `revisar.js`.

---

Actualización DIARIA del módulo "Seguimiento Presidencial" de URBIS (app cívica colombiana). Trabajás sin contexto previo: leé esto completo.

## QUÉ ES
URBIS registra públicamente los actos del presidente de Colombia, Abelardo de la Espriella (posesión: 7 de agosto de 2026). Los datos viven en `assets/data/seguimiento-presidencial.json` y se renderizan en `seguimiento.html`. NO hay que tocar código: solo datos.

Desde la v791 el módulo abre en la FICHA DEL GOBERNANTE: una placa con un veredicto de fiabilidad que se calcula solo, a partir de lo que vos cargués. No la edites —no existe en el JSON—, pero entendé qué la mueve, porque es la consecuencia de tu trabajo:

  · Casos de corrupción CONFIRMADOS: uno baja a «Poco fiable», dos a «Nada fiable».
  · Casos EN INVESTIGACIÓN por una autoridad: uno baja a «Dudosa», dos a «Poco fiable».
  · Cambios de postura contados: 1 → «Fiable», 2 → «Dudosa», 3+ → «Poco fiable».
  · Porcentaje del registro verificado por terceros: <85 %, <70 %, <50 % bajan un peldaño cada vez.

El veredicto es el PEOR de esos techos. Es decir: un solo caso mal clasificado cambia en público el juicio sobre una persona real. Por eso las reglas de abajo no son burocracia.

## TU TAREA
Agregar los hechos de LAS ÚLTIMAS 24-48 HORAS y actualizar las fechas de control.

0. **Traé lo de arriba antes de empezar**: `git fetch origin && git merge origin/main --no-edit`. Hay más de una sesión escribiendo en este repositorio y empezar sin esto termina en un empujón rechazado.
1. Leé `assets/data/seguimiento-presidencial.json`. Mirá el campo `actualizado`: solo agregá lo posterior a esa fecha, y revisá las entradas recientes para NO DUPLICAR un hecho ya registrado.
2. Investigá con WebSearch qué hizo el presidente desde la última actualización. Cubrí: decretos y nombramientos; relación con Israel; EE. UU. y acceso militar; corrupción y contratación; créditos y deuda; emergencias; economía; política exterior; servicios públicos y bolsillo; desinformación y discurso público.

   **Y dos señales concretas que el módulo está esperando, hasta el 21 de noviembre de 2026.** Van en el mismo barrido de arriba y no cuestan una búsqueda aparte: (a) que el **Gobierno presente una vía alternativa para blindar los requisitos mínimos de los cargos directivos** del sector público; (b) que la **Corte Constitucional falle sobre la ley de mérito** (Proyecto de Ley 056 de 2024 Cámara — 345 de 2024 Senado, el que el presidente objetó el 21 de agosto de 2026).

   Si aparece alguna: **registrala como una entrada más, con su fuente, y decilo en el resumen del final.** Lo que **NO** hacés es tocar `mismoObjetoVerificado` del caso `contra-merito-empleo-publico` ni su bloque `revision`: de esas dos señales depende declarar la identidad de objeto de esa contradicción, y esa declaración la toma quien firma el módulo, no esta rutina. Mientras tanto el eje A no publica nivel y eso ya sale escrito en la ficha, con su fecha.

3. Agregá las entradas nuevas AL PRINCIPIO del array `entradas` (orden: más reciente primero).
4. Si lo que encontraste es un CASO DE CORRUPCIÓN suyo o de su gobierno, o un CAMBIO DE POSTURA, va además en su sección propia (ver abajo).
5. Actualizá `actualizado` con la fecha de hoy y `proximaActualizacion` con la de MAÑANA (formato YYYY-MM-DD). **Son fechas en HORA DE COLOMBIA, no en UTC** (v1135): si corrés de noche, `date -u` ya dice mañana y el registro quedaría sellado un día adelante de lo que ve el lector. Sacala con `TZ=America/Bogota date +%F`. El módulo ancla todas sus fechas de calendario a Colombia desde la v1135, así que el sello tiene que ir con la misma vara.

## LOS CASOS DE CORRUPCIÓN — `casos.lista`
Sección hermana de `contradicciones`. Es lo primero que ve el lector en la ficha, y lo único que puede tumbar el veredicto de golpe. Cada caso lleva `id`, `titulo`, `estado`, `queSeConfirmo`, `quienLoConfirmo`, `fecha`, `monto` (o null), `implicados` y `fuentes`.

Los cinco estados, y qué exige cada uno:

  · `confirmado` — hay fallo judicial, sanción de un organismo de control, documento oficial o reconocimiento del propio implicado. Nombralo en `quienLoConfirmo`. **PESA AL MÁXIMO.** Si dudás, no es confirmado.
  · `en-investigacion` — una autoridad (Fiscalía, Procuraduría, Contraloría, Congreso, Corte) abrió proceso. Poné la autoridad en `quienLoConfirmo` y el número de radicado o la fecha de apertura en `queSeConfirmo`. **PESA, menos.** Una denuncia radicada que la autoridad todavía no abrió NO es esto: es un señalamiento.
  · `senalamiento` — lo dice un medio o un actor político y ninguna autoridad se ha pronunciado. Se muestra con su etiqueta y NO mueve el veredicto. Es el estado por defecto cuando dudes.
  · `archivado` — una autoridad lo revisó y lo cerró sin hallazgo: orden de archivo, preclusión, resolución que cierra la actuación. Citala en `quienLoConfirmo` y contá en `queSeConfirmo` qué dijo. Se muestra con etiqueta verde y NO pesa. **No es lo mismo que un señalamiento** y no se cuenta como tal: uno es una acusación que nadie ha revisado, el otro es una acusación que ya se cayó. Buscá activamente estos desenlaces: la acusación siempre circula más que el archivo, y publicar solo la mitad que acusa es hacerle daño a una persona real.
  · `por-documentar` — alguien lo nombró pero todavía no hay hecho ni fuente. No se pinta y no pesa.

Reglas que no se negocian:

  · **Un caso solo SUBE de estado con la fuente que lo sostiene.** Que un medio insista no convierte un señalamiento en investigación; que haya investigación no lo convierte en confirmado.
  · **Las denuncias que hace el propio Gobierno contra la administración anterior NO van acá.** Eso es un hecho de la categoría `corrupcion` de la línea de tiempo, no un caso suyo. Confundirlos invierte el sentido del módulo.
  · Si un caso que ya está en la lista avanza (se abrió proceso, salió fallo, lo archivaron), **actualizá el que existe** con su fuente nueva: no agregues uno repetido.
  · Si un caso se cae —la autoridad archivó, el verificador lo desmintió—, pasalo a `archivado` con la orden de archivo como fuente y dejá dicho en `queSeConfirmo` qué pasó. No lo borres: borrar es esconder, y tampoco lo dejes en `senalamiento`, que es esconder el desenlace.

## LAS CONTRADICCIONES — `contradicciones.casos`
Solo si tenés LAS DOS declaraciones documentadas (`antes` y `despues`), cada una con su fuente. Estados: `documentada`, `tension`, `desmentida`. Un caso puede llevar `"cuenta": false`: queda visible pero no suma al veredicto, y se usa cuando el propio `matiz` dice que el giro no habla de su palabra (una conversión religiosa, por ejemplo). Si lo usás, explicá el motivo en `matiz`.

## SI NO HAY NOVEDADES
Corriendo a diario, lo NORMAL es que muchos días no haya nada nuevo. Eso es un resultado correcto, no un fallo.
Si no pasó nada relevante: actualizá solo `actualizado` y `proximaActualizacion`, hacé el commit con ese cambio mínimo y decilo en el mensaje. NUNCA inventes contenido de relleno ni infles un hecho menor para que parezca que hubo movimiento. Y NUNCA subas un caso de estado para que la ficha "se mueva".

## REGLAS EDITORIALES — SON OBLIGATORIAS
Este módulo es creíble porque es riguroso. Si lo aflojás, se cae.

- **Sin fuente no se publica.** Cada entrada lleva `fuentes: [{n, u}]` con enlaces https.
- **NO inventes.** Ni fechas, ni cifras, ni ubicaciones. Si no confirmás el día exacto, poné `"precision": "aproximada"`. Si no lo confirmás en absoluto, no lo publiques.
- **`tipoFuente`**: `verificado` (varios medios), `disputado` (versiones enfrentadas), `declaracion` (dicho por una sola parte, sin corroboración). Poneelo siempre: es una de las cuatro cuentas del veredicto, así que dejarlo vacío no es neutral, es ruido.
- **`contrapunto`**: si el hecho es controvertido, incluí la crítica. Cubrir las dos lecturas es lo que lo hace información y no propaganda.
- **Denuncias ≠ condenas.** Si algo está en investigación, decilo explícitamente en el contrapunto.
- **Verificá antes de acusar.** Antes de publicar una contradicción o un señalamiento, buscá si algún verificador (La Silla Vacía Detector de Mentiras, ColombiaCheck, AFP Factual) lo desmintió. Si está desmentido, agregalo a `contradicciones.casos` con `"estado": "desmentida"` en vez de publicarlo como cierto.
- **No mapees ubicaciones militares deducidas.** Solo lugares oficialmente anunciados.
- **Neutralidad**: registrá y citá. No editorialices ni uses adjetivos de valor.

## DESPLIEGUE
1. Validá que el JSON parsea: `node -e "JSON.parse(require('fs').readFileSync('assets/data/seguimiento-presidencial.json','utf8'));console.log('JSON OK')"` (si no hay node, usá python3).
2. Buscá el token de versión actual con: `grep -o "const URBIS_CACHE = '[^']*'" service-worker.js`
3. Reemplazalo por uno con el número incrementado en LOS SIETE ARCHIVOS, con un sed sobre los siete: `service-worker.js`, `index.html`, `css/main.css`, `analisis-ia.html`, `seguimiento.html`, `reportes.html` y `sw-reportes.js`. Si dejás uno viejo, un teléfono se queda con media aplicación vieja y media nueva, que es peor que no actualizar.
4. Corré `node pruebas/revisar.js`. Comprueba que los siete tokens coincidan, que la versión no choque con la publicada, y —desde la v792— que ningún caso que pese vaya sin quién lo confirmó, fecha y fuentes. Si falla, arreglalo antes de subir.
5. `git fetch origin && git merge origin/main --no-edit` otra vez (entre el principio y el final pueden haber entrado dos versiones más), y push a main. Nunca `--force`.

Al terminar, resumí en español: qué agregaste, con cuántas fuentes, en qué estado quedó cada caso nuevo o actualizado, si encontraste algo desmentido por verificadores, y qué peldaño da hoy la ficha. Si no hubo novedades, decilo en una línea.
