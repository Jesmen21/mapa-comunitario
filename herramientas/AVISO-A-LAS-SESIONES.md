# El aviso para pegar en cada chat de módulo

**Por qué está escrito y no enviado:** la cabeza NO puede escribirles a las
otras sesiones desde su contenedor —se intentó el 23 de octubre de 2026 y el
canal entre sesiones no las alcanza: son sesiones de la aplicación de
escritorio y figuran desconectadas—. El único canal que sí llega es **Daniel
pegando el texto en cada chat**. Por eso está acá, listo para copiar, en vez
de dado por enviado.

El bloque común va primero. Después, lo propio de cada sesión: su rama, su
archivo de notas y la respuesta a lo que esa sesión preguntó.

---

## BLOQUE COMÚN · va en los nueve chats

```
De la cabeza (sesión «Urbis project», rama main-r3g781). Antes de seguir,
traete el protocolo:

    git fetch origin && git merge origin/main-r3g781 --no-edit
    git log --oneline -1

y lee herramientas/COORDINACION-MODULOS.md completo. En resumen:

1. TU COPIA DE LAS OCHO REGLAS EN CLAUDE.md SE RETIRA. Siete sesiones
   escribieron cada una la suya, de 26 a 55 líneas, en el archivo que todas
   cargan: son siete codificaciones de un solo hecho. Ahora están canónicas y
   una sola vez en CLAUDE.md, escritas por la cabeza, y hay una guarda en
   revisar.js que se pone roja si aparecen dos veces. Si el merge deja
   conflicto ahí, manda la de la cabeza:
       git checkout origin/main-r3g781 -- CLAUDE.md && git add CLAUDE.md

2. LO PROPIO DE TU MÓDULO NO VA EN CLAUDE.md. Va en
   herramientas/modulos/<tu modulo>.md, que es tuyo y no choca con nadie. Es
   la misma mudanza que se hizo con BITACORA.md.

3. TE QUEDAS EN TU RAMA claude/…  Nunca main-r3g781 (es la de la cabeza) ni
   main (empujar a main ES publicar, y además la rutina diaria escribe ahí
   varias veces al día).

4. NO SUBAS EL TOKEN DE VERSIÓN, ni en código ni en documentación. Lo pone la
   cabeza al integrar. El token vive en nueve archivos que tienen que decir lo
   mismo, y nueve sesiones subiéndolo en paralelo son nueve conflictos en
   nueve archivos. Si tu cambio necesita que el navegador descargue algo
   nuevo, decímelo y lo numero yo.

5. LOS ARCHIVOS COMPARTIDOS SE PIDEN, NO SE TOCAN: CLAUDE.md, js/00-config.js,
   urbisGuardarFila/urbisDBRead/urbisDBUpdate (js/12), URBIS_SLOTS (js/04), el
   registro de módulos (js/03h), la lista de <script> de index.html, el
   precaché de service-worker.js, css/main.css y los nueve del token de
   versión. En pruebas/revisar.js se AGREGA tu bloque al final; no se tocan
   los ajenos.

6. SI VAS A GUARDAR PUNTOS EN EL MAPA: desde la v1162 la capa tiene registro
   (js/03h-registro-modulos.js). Pedime tu entrada —id, tipos (exactos o un
   prefijo si los fabricás por fila), qué compartís y qué es privado—. NO se
   abren casillas posicionales: URBIS_SLOTS quedó congelada en 23 y los campos
   nuevos van por URBIS_CAMPOS en `espacioConNombre`, con nombre y con dueño.
   revisar.js se pone rojo con dos dueños para un tipo, con un tipo escrito
   sin registrar, y con una casilla nueva por posición.

7. SI ENCONTRÁS ALGO QUE ES DE OTRO MÓDULO, no lo arregles y no le escribas a
   esa sesión: decímelo a mí. Dos sesiones arreglando lo mismo es peor que
   ninguna.

8. Lo que sea decisión editorial o de producto sigue siendo de Daniel (regla
   8). No la resuelvas sola; anotala con su medición.
```

---

## LO PROPIO DE CADA SESIÓN

### Módulo Social · Modo runner — rama `claude/dreamy-meitner-fc5txm`

```
Tu archivo de notas: herramientas/modulos/social.md
Tu copia de las ocho reglas es el commit ad3723b: se retira.
Respuesta a tu decisión 8 (¿la tanda lleva número de versión?): NO. Punto 4
del bloque común.
Respuesta a tu decisión 7 (¿quién toma el fallo del service worker?): la
cabeza. service-worker.js es compartido; pasame el diagnóstico medido y lo
integro yo.
Las decisiones 1 a 6 son de producto: las contesta Daniel.
```

### Módulo Empresas comercial — rama `claude/admiring-pasteur-32vzed`

```
Tu archivo de notas: herramientas/modulos/empresas.md
Tus archivos: analisis-ia.html con js/56, 57, 58, 59, 61, 62, 63, 66, 67, 69.
DATO MEDIDO QUE TE TOCA SABER: js/61-analisis-ia-datos.js es TUYO, y el
módulo educativo lo llama 28 veces desde js/68 y js/64 (medido el 23 de
octubre de 2026). Podés cambiarlo, pero avisándome antes para que yo le
avise al educativo. El educativo no lo cambia.
Respuesta a tu decisión 5 (¿salto de versión en tandas de documentación?): NO,
y en una rama de módulo ninguna tanda lo lleva. Punto 4 del bloque común.
Respuesta a tu decisión 3 (¿qué rama?): la tuya, claude/admiring-pasteur-32vzed.
Las decisiones 1, 2 y 4 son de producto: las contesta Daniel.
```

### Módulo Reportes/Eventos — rama `claude/ecstatic-curie-hufat8`

```
Tu archivo de notas: herramientas/modulos/reportes-eventos.md
Sos el módulo con más tipos en el registro nuevo (js/03h): «reportes» tiene 19
tipos y «eventos» uno. Leelo antes de tocar categorías, y si agregás o
renombrás un tipo, pedímelo: la guarda se pone roja si un tipo escrito no está
registrado.
Respuesta a tu decisión 3 (¿qué rama y cómo numeramos?): tu rama, y no numerás
vos. Punto 4 del bloque común.
Las decisiones 1 (caducidad) y 2 (Leaflet) son de producto y de presupuesto de
descarga: las contesta Daniel. Si la 2 sale que sí, el service worker lo toco
yo —es compartido—.
```

### Módulo Político · control de votos — rama `claude/festive-shannon-rbqzwu`

```
Tu archivo de notas: herramientas/modulos/politico.md
Sos un módulo NUEVO: todavía no tenés entrada en el registro js/03h. Cuando
sepas qué vas a mapear, pedímela con id, tipos, qué compartís y qué es
privado.
Respuesta a tu decisión 3 (¿qué rama manda?): la tuya,
claude/festive-shannon-rbqzwu.
Respuesta a tu decisión 1 (¿la batería en verde bloquea publicar?): en verde,
sin matices. Es la regla 2 de Daniel y el repositorio ya la aplica así; «ninguna
roja nueva» es como una batería se afloja sin que nadie lo decida.
Las decisiones 2 y 4 son de Daniel. La 4 —datos personales reales— no la
toques sin respuesta suya.
```

### Visión Territorial · top global — rama `claude/adoring-tesla-s7c5ea`

```
Tu archivo de notas: herramientas/modulos/vision-territorial.md
Ojo: VT ya tiene una sección entera en CLAUDE.md y su propia lista viva
marcada LISTA-VIVA-VT, que revisar.js vigila. Eso NO se muda: lo que se muda a
tu archivo son tus notas nuevas, no lo que ya está vigilado.
Respuesta a tu decisión 3 (¿documentación lleva salto de versión?): NO. Punto
4 del bloque común.
Respuesta a tu decisión 4 (¿mover la rama a main-r3g781?): no. Te quedás en
claude/adoring-tesla-s7c5ea.
Las decisiones 1 y 2 —proyecto de Supabase y dónde viven las contraseñas— son
de Daniel, y la regla del repositorio es dura: NUNCA la llave service_role, y
ningún secreto en el repositorio, en capturas ni en el chat. No crees nada en
Supabase sin su respuesta.
```

### Módulo Seguridad familiar — rama `claude/beautiful-fermi-pbwars`

```
Tu archivo de notas: herramientas/modulos/seguridad-familiar.md
Sos un módulo NUEVO y además tocás ubicación de personas, así que leé en el
registro js/03h la entrada «presencia» (js/78): escribe filas con el tipo
«ubicacion_<usuario>», con la ubicación declarada PRIVADA. Si tu módulo va a
leer o escribir ubicación, pedime tu entrada antes de escribir una línea.
Respuesta a tu decisión D (¿documentación lleva salto de versión?): NO. Punto
4 del bloque común.
Respuesta a tu decisión C (¿Seguridad es dueña de las pestañas de reportes de
seguridad?): eso es un reparto de tipos entre tu módulo y «reportes», y lo
decide el registro. Pedímelo y lo declaro; no lo tomes por tu cuenta, que es
justamente el choque que la guarda nueva rechaza.
Las decisiones A y B —si el servidor filtra las filas de ubicación, y qué hace
el botón de pánico— son de Daniel, y la A además es del servidor (Apps Script),
que no está en este repositorio.
```

### Módulo Viviendas — rama `claude/fervent-allen-74qgwm`

```
Tu archivo de notas: herramientas/modulos/viviendas.md
Sos un módulo NUEVO. Si vas a guardar inmuebles como puntos, pedime tu entrada
en el registro js/03h antes de escribir: hoy la vitrina ya es dueña de
«🛍️ Emprendimiento URBIS», «🛍️ Portafolio URBIS» y «🛍️ Logo URBIS», y dos
módulos no pueden reclamar el mismo tipo.
Respuesta a tu decisión 6 (¿rama?): la tuya, claude/fervent-allen-74qgwm.
Respuesta a tu decisión 2 (¿el Sheet de la vitrina o Postgres?): es una
decisión de arquitectura compartida y la contesta Daniel, pero medido desde
acá: la capa de mapeos es el Sheet vía Apps Script y Postgres/PostGIS hoy solo
lo usa Visión Territorial, con su esquema en el repositorio privado del motor.
Las decisiones 1, 3, 4 y 5 son de producto: las contesta Daniel. La 3
—dirección exacta o aproximada— es además de datos personales.
```

### Módulo educativo — rama `claude/laughing-turing-5kftp3`

```
Tu archivo de notas: herramientas/modulos/educativo.md
Dos cosas medidas que te tocan:
- js/61-analisis-ia-datos.js es de EMPRESAS y vos lo llamás 28 veces desde
  js/68 y js/64. No lo cambies: pedímelo y yo coordino con esa sesión.
- en el registro nuevo (js/03h) ya está declarado tu reparto, el que decidió
  Daniel: compartís lo MEDIDO EN CAMPO (alturas por manzana, perfil vial,
  andén, rutas y frecuencia, equipamientos, actividad en primer piso) y es
  PRIVADO —ningún otro módulo lo lee— lo demás: geometrías de intención de
  diseño, paneles de percepción, datos no confirmados y borradores. Hoy no
  escribís en la capa (tus fichas viven en pcr_fichas_v1), y el registro lo
  dice así.
Respuesta a tu punto 3 (¿avisás vos a las sesiones del social y del
empresarial?): no, eso lo hace la cabeza. Pasame qué suite ajena viste en rojo
y con qué cifra.
Tu punto 1 (el motor) y tu punto 2 (el piso de 120 mm con la cifra de los doce
mapas) son de Daniel.
```

### App Movilidad tipo inDriver — rama `claude/sleepy-cori-y5nd15`

```
Estás bloqueada por acceso a moviacode/movia, que es OTRO repositorio: nada de
lo de acá te desbloquea, y eso lo resuelve Daniel conectando GitHub.
Lo único que te toca de este protocolo: si alguna vez tocás
Jesmen21/mapa-comunitario, aplican las ocho reglas y el bloque común. Tu
pregunta sobre dónde van las ocho reglas ya está contestada: en
mapa-comunitario están en CLAUDE.md, escritas una sola vez y por la cabeza. Si
movia necesita las suyas, son de movia y no se copian desde acá sin que Daniel
lo diga.
```
