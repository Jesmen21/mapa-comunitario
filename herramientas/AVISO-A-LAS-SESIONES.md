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

---

## LAS DECISIONES DE DANIEL DEL 23 DE OCTUBRE · qué pegarle a cada chat

Van **después** del bloque común. Las ocho completas están en
`herramientas/DECISIONES-DANIEL.md`, que cada sesión lee al traer la rama;
esto es lo que le toca a cada una.

### Para TODOS los chats

```
DOS DECISIONES DE DANIEL QUE OBLIGAN A TODAS LAS SESIONES:

1. SHEETS NO SE EXTIENDE A NADA NUEVO. La hoja se congeló para datos nuevos
   el 23 de octubre de 2026: se queda con los ocho módulos que ya tiene, y
   todo módulo nuevo va a Postgres. Lo compartido deja de ser el almacén y
   pasa a ser el REGISTRO (js/03h): quién es dueño de qué y quién puede
   leerlo, viva el dato donde viva. revisar.js tiene un trinquete: la lista
   de los ocho no crece.
2. NINGÚN SECRETO EN EL REPOSITORIO. Contraseñas y llaves van en variables de
   entorno o en un gestor. Y para cualquier cosa de Supabase: nunca la llave
   service_role.

Las ocho decisiones completas están en herramientas/DECISIONES-DANIEL.md.
Lo que ya está decidido NO se vuelve a preguntar.
```

### Viviendas — `claude/fervent-allen-74qgwm`

```
Tus seis decisiones están contestadas. De Daniel:
- DIRECCIÓN: en público va la aproximada (cuadra/barrio). La exacta solo para
  Daniel o tras contacto con el interesado. En el registro ya quedó así:
  ubicacionAproximada en comparte, direccionExacta en privado. DOS campos y no
  uno con bandera: un campo con bandera se publica entero el día que alguien
  lee mal la bandera.
- DATOS: Postgres (Supabase), no el Sheet.
- ALCANCE: módulo propio. Leés el análisis de ubicación de Empresas A TRAVÉS
  DEL REGISTRO, sin copiarlo. Ya está declarado:
  viviendas.leeDe = [{ modulo:'empresas', campo:'analisisUbicacion' }], y
  empresas lo comparte. La guarda comprueba que esa puerta resuelva.
- RAMA: la tuya.
Siguen abiertas: si el arriendo usa el mismo formulario que la venta, y quién
publica. Esas dos sí son de Daniel y todavía no las contestó.
Tu entrada en el registro ya existe aunque no tengas archivos: está para que
el reparto esté declarado ANTES de la primera línea.
```

### Político — `claude/festive-shannon-rbqzwu`

```
Decisión de Daniel: la v1 va SIN datos reales de votantes. Solo datos
simulados y rotulados SIMULADO. Guardar datos personales reales es una
decisión aparte y NO se construye hasta que él la tome.
Ya quedó en el registro: politico lleva soloSimulado: true, y hay una guarda
que ata esa bandera a que la nota lo diga — para que la declaración llegue a
quien lea el registro y no se quede en una bandera que ninguna pantalla pinta.
Tu decisión 4 queda contestada y es la más dura de las cuatro: no la relajes.
```

### Seguridad familiar — `claude/beautiful-fermi-pbwars`

```
Tus decisiones B y C están contestadas por Daniel:
- BOTÓN DE PÁNICO (tu B): la v1 es SOLO mapa y reportes. No se construye un
  botón que prometa respuesta de emergencia hasta que haya convenio real con
  la Policía o el 123. La razón va con la decisión porque es la que impide que
  vuelva a proponerse: un botón que promete respuesta y no la tiene es peor
  que no tenerlo. (Precedente ya decidido en Movilidad: con convenio, directo
  a la Policía; sin convenio, a la central de la cooperativa.)
- REPORTES (tu C): NO. Reportes/Eventos es dueño de la matriz de tipos y del
  flujo. Seguridad los MUESTRA y los analiza, y no crea tipos duplicados. Ya
  quedó en el registro: seguridad tiene tipos: [] y declara
  leeDe: reportes.categoria y reportes.subtipo.
Tu A —si el servidor filtra las filas de ubicación— sigue abierta, y además es
del Apps Script, que no está en este repositorio.
Y ojo con el almacén: sos módulo nuevo, así que vas a Postgres, no al Sheet.
```

### Social — `claude/dreamy-meitner-fc5txm`

```
Decisión de Daniel: SOCIAL ES UN PARAGUAS de runner, minijuegos, Patitas URBIS
y orientación comunal. NO son módulos separados. Tu decisión 2 queda
contestada.
Eso trajo dos cambios en el registro que te tocan:
- `rush` y `premio` eran dos entradas y ahora son UNA: `social`, con los tipos
  «🏃 Social Rush» y «🏆 Premio URBIS» y los archivos js/20, js/13j, js/16 y
  js/17. Patitas y la orientación comunal entran AHÍ cuando tengan tipos
  propios, no en una entrada nueva.
- lo que ANTES se llamaba `social` en el registro —comentarios, relaciones y
  permisos de js/12— se renombró a `interaccion`. Dos cosas distintas con un
  solo nombre es la clase B por la puerta del vocabulario. Se renombró ya
  porque hoy no cuesta nada (el espacio con nombre no tiene lectores) y mañana
  sí.
Siguen abiertas: la donación de Patitas, si Patitas entra al APK, y si los 51
logros se implementan o se retiran.
```

### Visión Territorial — `claude/adoring-tesla-s7c5ea`

```
Decisión de Daniel sobre tus dos preguntas abiertas:
- PROYECTO SUPABASE NUEVO, separado del de vayayvuelva. No se mezclan datos de
  taxistas con datos de municipios.
- Las contraseñas y llaves van en variables de entorno o en un gestor, NUNCA
  en el repositorio.
- Y lo que decide tu próximo paso: NO CREES NADA hasta que Daniel confirme que
  el proyecto nuevo cabe en el plan gratuito. La decisión es esperar, no
  avanzar con cuidado.
Sigue valiendo lo que ya estaba escrito para VT: nunca la llave service_role,
que salta la RLS y la volvería decorativa.
```

### Empresas — `claude/admiring-pasteur-32vzed`

```
Te toca una decisión que no pediste y que te suma trabajo futuro: Viviendas es
un módulo propio y va a LEER tu análisis de ubicación a través del registro,
sin copiarlo.
Por eso entrás al registro de módulos aunque no escribas en la hoja:
`empresas` declara analisisUbicacion, densidadDeUsos y
coberturaEquipamientos en COMPARTE, y reglasDeClasificacion y pesosDelMotor en
PRIVADO —las reglas no se sirven al navegador: eso es lo que se vende—.
Si cambiás la forma de analisisUbicacion, avisame: hay una guarda que
comprueba que la puerta de Viviendas resuelva, y se pone roja si el campo deja
de compartirse.
Y lo de js/61 sigue igual: es tuyo, el educativo lo llama 28 veces, y lo
cambiás avisando.
```

### Reportes/Eventos — `claude/ecstatic-curie-hufat8`

```
Decisión de Daniel que te confirma dueño: LA MATRIZ DE TIPOS Y EL FLUJO DE
REPORTE SON TUYOS. Seguridad familiar solo los muestra y los analiza, y no
crea tipos duplicados; ya quedó en el registro con tipos: [] y leyendo los
tuyos.
Eso te da una responsabilidad nueva: si cambiás o renombrás un tipo, hay otro
módulo leyéndolo. Pedímelo antes.
Siguen abiertas tus dos de producto: la caducidad de los 23 tipos y si Leaflet
se vendoriza.
```

### Educativo — `claude/laughing-turing-5kftp3`

```
Ninguna de las ocho decisiones nuevas te cambia nada, y eso también se dice.
Lo tuyo del registro sigue igual que en la v1162: compartís lo medido en campo
y es privado lo de intención de diseño, percepción, no confirmado y
borradores.
Dos cosas que sí te rozan: Empresas entró al registro, así que js/61 ahora
tiene dueño declarado por escrito; y si alguna vez escribís datos fuera de
pcr_fichas_v1, van a Postgres y no al Sheet.
Tus dos puntos —el motor y el piso de 120 mm con la cifra de los doce mapas—
siguen esperando a Daniel.
```
