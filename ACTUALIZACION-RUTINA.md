# Actualización de la rutina diaria · para pegar en la web

Preparada el 22 de octubre de 2026, medida contra el código de la v1161.
**No toqué la rutina ni su copia del repositorio.** Esto es el texto para que
Daniel lo pegue él.

El bloque de la cabecera de `herramientas/rutina-seguimiento-presidencial.md`
dice que la última actualización fue «el 7 de septiembre de 2026 con lo que
entró entre la v791 y la v795». Han pasado **366 versiones**.

---

## 0 · LO PRIMERO, Y NO ES EL ICONO · LAS DOS RUTINAS ESTÁN PAUSADAS

Medido el 22 de octubre de 2026 sobre las tareas programadas de la cuenta, sin
tocar ninguna. Las cuatro están en `enabled: false`:

| Tarea | Estado | Última corrida |
|---|---|---|
| URBIS · Seguimiento Presidencial (diaria) | **PAUSADA** | 17 oct 2026, 13:13 UTC |
| URBIS · Alertas de desastres (diaria) | **PAUSADA** | 17 oct 2026, 12:10 UTC |
| URBIS · Seguimiento Presidencial 6 h | apagada a propósito (duplicada) | 1 sep 2026 |
| URBIS · Alertas de desastres 6 h | apagada a propósito (duplicada) | 1 sep 2026 |

Las dos diarias se modificaron el **17 de octubre a las 20:49 UTC, con dos
segundos de diferencia**, y las dos quedaron con `ended_reason` y
`suspension_reason` VACÍOS — que es lo que el sistema deja cuando las pausa una
persona, no cuando las desactiva él por un fallo o por suscripción.

**Y esto explica algo que ya habíamos visto sin entenderlo.** El 22 de octubre
Daniel notó que el encabezado decía «17 oct 2026» con hechos del 20 y del 21
adentro. Lo atribuí a que el sello `actualizado` se escribe a mano y nadie lo
había movido. La causa de fondo es ésta: **la rutina diaria dejó de correr el 17
de octubre**, así que desde ese día nadie movió el sello ni cargó nada — lo que
entró después lo cargamos a mano en esta sesión.

Lo del icono no se puede medir desde acá: la rutina se edita en la web de
Claude y este contenedor no la ve. Lo que sí consta es que **las tareas siguen
existiendo**, con su texto y su historial intactos. Si el icono no aparece pero
las tareas están, es la interfaz; reactivarlas es una decisión de Daniel y no
se toca desde acá.

---

## 1 · CORRECCIÓN URGENTE · el texto VIVO dice CINCO archivos, y son NUEVE

En la sección DESPLIEGUE, paso 3. **Y es peor de lo que yo había reportado.**

El texto que está GUARDADO en la tarea programada dice **«LOS 5 ARCHIVOS»** y
nombra cinco. La copia del repositorio —`herramientas/rutina-seguimiento-presidencial.md`—
dice SIETE, y su cabecera afirma que se actualizó el 7 de septiembre «con los
siete archivos de versión (eran cinco)». **Esa actualización nunca llegó al
texto vivo.** Son dos codificaciones de una misma cosa que se separaron: la
copia del repositorio va por delante de la rutina que de verdad corre, que es
la clase B de este proyecto en el peor sitio posible.

Y la verdad de hoy es NUEVE, desde la v1140. Con cinco de nueve, cuatro cachés
quedan viejas y un teléfono se queda con media aplicación de cada versión.

**Reemplazar el paso 3 entero por:**

> 3. Reemplazalo por uno con el número incrementado en LOS NUEVE ARCHIVOS, con
>    un sed sobre los nueve: `service-worker.js`, `index.html`, `css/main.css`,
>    `analisis-ia.html`, `seguimiento.html`, `reportes.html`, `sw-reportes.js`,
>    `vision-territorial.html` y `sw-vt.js`. Los dos últimos son de Visión
>    Territorial, que es una página propia con su propio service worker y por
>    eso tiene su propia caché que romper. Si dejás uno viejo, un teléfono se
>    queda con media aplicación vieja y media nueva, que es peor que no
>    actualizar. **Manda `revisar.js`, no esta lista**: si se separan, la
>    guarda lo dice y el número de acá es el que está mal.

**Y el paso 4**, donde dice «Comprueba que los siete tokens coincidan»:

> 4. Corré `node pruebas/revisar.js`. Comprueba que los NUEVE tokens coincidan,
>    que la versión no choque con la publicada, que ningún caso que pese vaya
>    sin quién lo confirmó, fecha y fuentes, y unas doscientas cosas más. Si
>    falla, arreglalo antes de subir: **no aflojes la guarda**.

---

## 2 · `rol` es obligatorio en cada fuente, y son TRES valores

La rutina dice `fuentes: [{n, u}]` y nunca menciona `rol`. Existe desde la
v998 y en esta sesión aparecieron **siete fuentes con un rol inventado**
—`dato` y `dato-de-apoyo`—, que no existen y que la pantalla pinta sin
etiqueta.

**Agregar a REGLAS EDITORIALES:**

> - **Cada fuente lleva `rol`, y solo puede ser uno de tres:**
>   · `acto` — documenta el ACTO de la entrada: el documento oficial, o la
>     cobertura del hecho mismo.
>   · `efecto` — documenta lo que vino DESPUÉS: una reacción, un
>     pronunciamiento, una consecuencia.
>   · `contexto` — ni una ni la otra: antecedente, perfil o cobertura anterior
>     que ayuda a entender. **No prueba el acto.**
>   No existe `dato`, ni `dato-de-apoyo`, ni ningún otro. Y **toda entrada
>   necesita al menos una fuente con rol `acto`**: si ninguna documenta el
>   acto, no se inventa — la entrada se queda sin esa fuente y eso se dice.

---

## 3 · El enlace tiene que haberse VISTO

Regla nueva de la v1160, y la pagó esta sesión: dos tandas seguidas
escribieron dos enlaces que parecían perfectamente plausibles y estaban
**construidos slugificando el titular**. Un enlace inventado es peor que
ninguno, porque se lee como fuente comprobable.

**Agregar a REGLAS EDITORIALES:**

> - **Todo enlace sale de un resultado que viste.** El que devolvió la
>   búsqueda, o la página que abriste. **Nunca lo armes por patrón** a partir
>   del titular, aunque sepas cómo construye las URL ese medio. Si no viste el
>   enlace, la fuente se deja fuera: la entrada se publica con las que sí
>   tenés.

---

## 4 · El sello `actualizado` no puede ir por detrás de su contenido

El paso 5 dice actualizar `actualizado` a hoy, y eso está bien. Lo que falta
es la restricción, que se cobró en la v1148: se cargó una entrada del 20 y el
sello se quedó en el 17, así que la portada firmaba con una fecha ANTERIOR a
un hecho que ya estaba dentro, y el aviso de rezago de cada serie restaba
contra ella y publicaba números falsos.

**Agregar al final del paso 5:**

> **Y nunca antes de la entrada más nueva que cargaste.** Un sello por detrás
> de su propio contenido no es un dato viejo: es una afirmación falsa sobre
> hasta cuándo se miró. `revisar.js` lo comprueba desde la v1150. Mover el
> sello arrastra el encabezado de la portada, la firma de la ficha, el pie de
> los gráficos sin corte propio, la fila «Fecha de corte del registro» del
> tablero y **el aviso de rezago de cada serie** — y es correcto que los mueva.

---

## 5 · Toda entrada nueva lleva `id`

No está pedido en la rutina, y sin `id` una entrada **no puede ser citada por
una opinión firmada ni por el punto de una serie** (v1127), y el ancla por
título se rompe en silencio el día que alguien la retitula.

**Agregar al paso 3 de TU TAREA:**

> Cada entrada nueva lleva un `id` en minúsculas con guiones, descriptivo y
> único —`congreso-aprueba-presupuesto-2027`—. Sin id la entrada no puede
> sostener una afirmación firmada ni ser el ancla de un punto de serie, y
> anclar por título se rompe en silencio cuando alguien retitula.

---

## 6 · Dos vocabularios más, si los escribís

Opcionales —`revisar.js` solo los valida si están— pero **un valor inventado
sale en rojo**:

> - `categoriaProbatoria`: `hecho-probado` | `correlacion` |
>   `atribucion-causal` | `en-circulacion`
> - `tipoMedicion`: `actividad` | `resultado` | `contexto-estructural`

---

## 7 · «NO SE HALLÓ», nunca «NO RESPONDIÓ»

De la v961 y la v1123, y es de las que más importa porque es una afirmación
sobre la conducta de una persona.

**Agregar a REGLAS EDITORIALES:**

> - **«No se halló», nunca «no respondió».** Lo primero es un hecho sobre
>   nuestra búsqueda; lo segundo es una afirmación sobre la conducta del
>   Gobierno, y no la podemos hacer: pudo haber respondido en un canal que no
>   miramos. Y si escribís que no se halló, decí **qué buscaste**: sin eso, «no
>   se halló» no dice nada, se pudo buscar la cosa equivocada.

---

## 8 · La autoría no se afirma: se dice QUIÉN la atribuye

Lo pagó la carga de Santa Marta de esta sesión.

**Agregar a REGLAS EDITORIALES:**

> - **No afirmes autoría que la fuente no afirma.** Si las notas dicen que «las
>   autoridades atribuyen» un hecho a un grupo, eso es lo que se escribe, con
>   quién lo atribuye. Si ninguna fuente identifica a quién lo ejecutó, se dice
>   que no lo identifican. Y a una persona capturada no se le atribuye delito:
>   **captura no es condena**, y si no consta decisión judicial, eso se escribe.

---

## 9 · Dos trampas de FECHA que costaron dos correcciones

> - **No infieras una fecha desde fechas de publicación.** Que dos notas se
>   publiquen el 14 dice cuándo publicaron, no cuándo ocurrió ni cuándo lo
>   anunció nadie. Si querés decir que se publicaron el 14, escribí eso.
> - **No cambies la fecha de una entrada ya publicada por una nota que no
>   abriste.** Si las fuentes no coinciden en una fecha, la discrepancia va al
>   `contrapunto` —quién fecha qué, y qué documento la dirimiría— y la fecha de
>   la entrada se queda. Cambiar el número antes de contestar «¿de qué mide
>   cada una?» es arreglar la contradicción destruyendo la medida (v1085).

---

## 10 · Dos cosas prácticas que ahorran una vuelta

> - **El `contrapunto` no se ve en la lista.** `#/linea-de-tiempo/todos` pinta
>   el `detalle` y solo agrega «· con contrapunto» al pie. Para LEER un
>   contrapunto en pantalla hay que abrir la ficha del hecho, `#/hecho/<i>`.
>   Costó dos vueltas en esta sesión: texto cargado que «no aparecía».
> - **Desde el contenedor no se abre ninguna página.** Medido el 22 de octubre
>   sobre seis medios y cinco dominios oficiales: todos devuelven código 000.
>   El único canal es la BÚSQUEDA, y su estándar sostiene **que** un hecho
>   ocurrió, no que se leyó la página. Si una cifra necesita la página abierta
>   para dirimirse —una serie numérica, por ejemplo—, se dice que no se pudo y
>   no se publica el número.
