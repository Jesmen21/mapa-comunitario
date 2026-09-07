# La rutina diaria del Seguimiento Presidencial

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
3. Agregá las entradas nuevas AL PRINCIPIO del array `entradas` (orden: más reciente primero).
4. Si lo que encontraste es un CASO DE CORRUPCIÓN suyo o de su gobierno, o un CAMBIO DE POSTURA, va además en su sección propia (ver abajo).
5. Actualizá `actualizado` con la fecha de hoy y `proximaActualizacion` con la de MAÑANA (formato YYYY-MM-DD).

## LOS CASOS DE CORRUPCIÓN — `casos.lista`
Sección hermana de `contradicciones`. Es lo primero que ve el lector en la ficha, y lo único que puede tumbar el veredicto de golpe. Cada caso lleva `id`, `titulo`, `estado`, `queSeConfirmo`, `quienLoConfirmo`, `fecha`, `monto` (o null), `implicados` y `fuentes`.

Los cuatro estados, y qué exige cada uno:

  · `confirmado` — hay fallo judicial, sanción de un organismo de control, documento oficial o reconocimiento del propio implicado. Nombralo en `quienLoConfirmo`. **PESA AL MÁXIMO.** Si dudás, no es confirmado.
  · `en-investigacion` — una autoridad (Fiscalía, Procuraduría, Contraloría, Congreso, Corte) abrió proceso. Poné la autoridad en `quienLoConfirmo` y el número de radicado o la fecha de apertura en `queSeConfirmo`. **PESA, menos.** Una denuncia radicada que la autoridad todavía no abrió NO es esto: es un señalamiento.
  · `senalamiento` — lo dice un medio o un actor político y ninguna autoridad se ha pronunciado. Se muestra con su etiqueta y NO mueve el veredicto. Es el estado por defecto cuando dudes.
  · `por-documentar` — alguien lo nombró pero todavía no hay hecho ni fuente. No se pinta y no pesa.

Reglas que no se negocian:

  · **Un caso solo SUBE de estado con la fuente que lo sostiene.** Que un medio insista no convierte un señalamiento en investigación; que haya investigación no lo convierte en confirmado.
  · **Las denuncias que hace el propio Gobierno contra la administración anterior NO van acá.** Eso es un hecho de la categoría `corrupcion` de la línea de tiempo, no un caso suyo. Confundirlos invierte el sentido del módulo.
  · Si un caso que ya está en la lista avanza (se abrió proceso, salió fallo, lo archivaron), **actualizá el que existe** con su fuente nueva: no agregues uno repetido.
  · Si un caso se cae —la autoridad archivó, el verificador lo desmintió—, bajalo de estado y dejá dicho en `queSeConfirmo` qué pasó. No lo borres: borrar es esconder.

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
