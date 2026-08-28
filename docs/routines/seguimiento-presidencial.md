# Routine · Seguimiento Presidencial

Cron (UTC): `0 3,9,15,21 * * *` — en hora de Colombia: 10:00 · 16:00 · 22:00 · 04:00.

Este es el texto que la Routine envía en cada disparo. Para aplicarlo,
pegalo como *prompt* de la Routine correspondiente en la interfaz de
Routines de claude.ai y ajustá ahí el cron. Ver `README.md` de esta
carpeta para el porqué.

---

Actualización del módulo "Seguimiento Presidencial" de URBIS (app cívica colombiana), en el repositorio https://github.com/Jesmen21/mapa-comunitario. Corrés CADA 6 HORAS (10:00, 16:00, 22:00 y 04:00 hora de Colombia). Trabajás sin contexto previo: leé esto completo antes de actuar.

## PUNTO DE PARTIDA — CONFIRMÁ QUE TENÉS EL REPOSITORIO
Antes que nada, comprobá dónde estás parado: `git rev-parse --show-toplevel && git remote -v`. Si eso falla o no aparece `Jesmen21/mapa-comunitario`, cloná `https://github.com/Jesmen21/mapa-comunitario` y trabajá dentro del clon.

Si al final no podés empujar por falta de credenciales o de permisos, NO termines en silencio dando la tarea por hecha: decí con todas las letras en el resumen que el trabajo NO se publicó y por qué, y pegá ahí el JSON de las entradas que ibas a agregar para que no se pierda el trabajo.

## QUÉ ES
URBIS registra públicamente los actos del presidente de Colombia, Abelardo de la Espriella (posesión: 7 de agosto de 2026). Los datos viven en `assets/data/seguimiento-presidencial.json` y se renderizan en `seguimiento.html`. NO hay que tocar código: solo datos.

## VENTANA DE BÚSQUEDA
Buscá hechos de las ÚLTIMAS 8 HORAS. Son 8 y no 6 a propósito: el solape de dos horas evita que un hecho se pierda entre dos corridas. Ese mismo solape hace que veas repetido lo que la corrida anterior ya publicó — por eso la regla de no duplicar es ahora lo más importante de esta tarea.

## LO PRIMERO: NO DUPLICAR
Corrés cuatro veces al día sobre el mismo ciclo noticioso. El riesgo número uno ya no es que se te escape un hecho: es que el mismo hecho quede registrado tres veces con tres redacciones distintas.

1. Leé `assets/data/seguimiento-presidencial.json` completo.
2. Antes de agregar CUALQUIER entrada, comparála contra TODAS las entradas de los últimos 10 días — por HECHO, no por redacción. Mismo decreto, mismo nombramiento, misma cifra, misma reunión = mismo hecho, aunque el titular que leíste esté escrito distinto.
3. Si el hecho YA ESTÁ registrado y aparece una fuente nueva: NO agregues una entrada. Agregá esa fuente al array `fuentes` de la entrada existente y, si con eso pasa a tener dos fuentes independientes, subí su `tipoFuente` a `verificado`.
4. Si el hecho ya está y ahora hay una cifra corregida o un desmentido: editá esa entrada (y su `contrapunto`), no agregues otra.
5. Solo si el hecho es genuinamente nuevo, agregalo AL PRINCIPIO del array `entradas` (orden: más reciente primero).

## QUÉ CUBRIR
Decretos y nombramientos; relación con Israel; EE. UU. y acceso militar; corrupción y contratación; créditos y deuda; emergencias; economía; política exterior; y todo lo relativo a la legitimidad de la posesión (firmas, demandas de nulidad).

## PRECISIÓN — CADA ENTRADA TIENE QUE SER VERIFICABLE
Una entrada que solo parafrasea un titular no sirve para nada. Cada entrada tiene que dejar constancia del ACTO CONCRETO, con el dato que permite ir a comprobarlo:

- **`titulo`**: nombra el acto y su identificador. "Decreto 1487 de 2026: se traslada la Dirección de Impuestos al Ministerio de Hacienda", no "el presidente reorganiza la DIAN". Si es un nombramiento, va el nombre completo y el cargo exacto. Si hay una cifra, va con su unidad y su moneda (COP o USD, explícito — nunca "millones" a secas).
- **`detalle`**: dos o tres frases con el número de decreto o resolución, la fecha de firma, la entidad, el monto o el plazo. Si el dato duro no existe todavía, decilo: "no se ha publicado el número del decreto".
- **`fecha`**: el día en que OCURRIÓ el hecho, no el día en que lo publicó el medio. Si no confirmás el día exacto, poné `"precision": "aproximada"`. Si no lo confirmás en absoluto, no publiques la entrada.
- **Anuncio ≠ acto ejecutado.** Decilo con esas palabras en el `detalle`: "anunció que", "firmó el", "quedó en firme el". Un anuncio que todavía no se ejecutó no se registra como hecho consumado.
- **Denuncias ≠ condenas.** Si algo está en investigación, tiene que decirlo explícitamente el `contrapunto`.

## FUENTES — SIN FUENTE NO SE PUBLICA
- Usá siempre el array `fuentes: [{n, u}]` (`n` = nombre del medio, `u` = URL https). El par suelto `fuente`+`url` es el formato viejo: usalo solo si de verdad hay una sola fuente.
- **`tipoFuente` es OBLIGATORIO en toda entrada nueva.** No lo dejes vacío. La regla es mecánica, contá las fuentes:
  - `verificado`: DOS O MÁS medios INDEPENDIENTES. Independiente = redacciones distintas con reportería propia. Cinco portales replicando el mismo cable de EFE o el mismo boletín de Presidencia son UNA sola fuente, no cinco.
  - `declaracion`: lo dice una sola parte (el Gobierno, un ministerio, un denunciante) y nadie más lo corroboró.
  - `disputado`: hay versiones enfrentadas sobre lo que pasó o sobre las cifras.
- Un boletín de Presidencia o de un ministerio nunca es por sí solo `verificado`: es `declaracion` hasta que un medio con reportería propia lo confirme.
- **`contrapunto`**: obligatorio si `tipoFuente` es `disputado`, y siempre que el hecho sea controvertido. Tiene que decir QUIÉN objeta y QUÉ objeta, con nombre. "Hay críticas" no es un contrapunto.
- **Verificá antes de acusar.** Antes de publicar una contradicción o un señalamiento, buscá si La Silla Vacía (Detector de Mentiras), ColombiaCheck o AFP Factual lo desmintieron. Si está desmentido, va a `contradicciones.casos` con `"estado": "desmentida"`, nunca al array de entradas como si fuera cierto.
- **Contradicciones**: solo si tenés LAS DOS declaraciones documentadas (`antes` y `despues`), cada una con su fuente. Estados: `documentada`, `tension`, `desmentida`.
- **No mapees ubicaciones militares deducidas.** Solo lugares oficialmente anunciados.
- **Neutralidad**: registrá y citá. No editorialices ni uses adjetivos de valor.
- **NO inventes.** Ni fechas, ni cifras, ni números de decreto, ni ubicaciones. Ante la duda, no se publica.

## SI NO HAY NOVEDADES
Corriendo cada 6 horas, lo NORMAL es que la mayoría de las corridas no encuentren nada nuevo. Eso es un resultado correcto, no un fallo. NUNCA inventes contenido de relleno ni infles un hecho menor para que parezca que hubo movimiento.

Para no dejar cuatro commits vacíos por día, la regla de commit es esta:
1. Actualizá siempre `actualizado` a la fecha de hoy (YYYY-MM-DD). Actualizá también `proximaActualizacion` a la fecha de la próxima corrida (las corridas son 10:00, 16:00, 22:00 y 04:00 hora de Colombia; si la próxima cae después de medianoche, es la fecha de mañana). Ese campo ya no se muestra en la interfaz —la portada anuncia la cadencia de 6 horas—, pero se mantiene al día como dato.
2. Hacé commit SOLO si (a) agregaste o editaste contenido, o (b) el campo `actualizado` que estaba en el archivo no era ya el de hoy.
3. Si no hubo contenido nuevo Y `actualizado` ya decía hoy, descartá los cambios (`git checkout -- assets/data/seguimiento-presidencial.json`) y no hagas commit ni push.

## DESPLIEGUE
1. Validá que el JSON parsea: `node -e "JSON.parse(require('fs').readFileSync('assets/data/seguimiento-presidencial.json','utf8'));console.log('JSON OK')"` (si no hay node, usá python3).
2. Buscá el token de versión actual con: `grep -o "const URBIS_CACHE = '[^']*'" service-worker.js`
3. Reemplazalo por uno con el número incrementado en LOS 5 ARCHIVOS: `service-worker.js`, `index.html`, `css/main.css`, `analisis-ia.html`, `seguimiento.html`. Ojo con dos detalles que ya se han escapado antes: en `index.html` el token aparece también en `window.URBIS_APP_VERSION`, y en `service-worker.js` lleva el prefijo `urbis-v` mientras que en el resto va como `?v=`. Al terminar, comprobá que no quedó ninguna referencia al número viejo: `grep -rn "54X-" service-worker.js index.html css/main.css analisis-ia.html seguimiento.html`.
4. Antes de empujar, traé lo que haya en el remoto: `git pull --rebase origin main`. Sobre este repositorio trabajan otras sesiones en paralelo y el conflicto típico es SOLO el token de versión. Si las dos ramas llegaron al MISMO número con etiquetas distintas, no elijas una: subí a un número más alto todavía, porque si no la caché no se invalida. Después `git push origin main`. Si el push falla por red, reintentá hasta 4 veces esperando 2 s, 4 s, 8 s y 16 s.
5. El mensaje de commit resume qué se agregó y con qué fuentes.

## AL TERMINAR
Resumí en español: qué agregaste, con cuántas fuentes independientes cada cosa, qué hechos ya estaban y solo enriqueciste con una fuente más, y si encontraste algo desmentido por verificadores. Si no hubo novedades, decilo en una línea. Si no pudiste publicar, decilo explícitamente.
