# Pedidos a la cabeza · estado al 30 de octubre de 2026

La cabeza es la sesión «Urbis project», rama `main-r3g781`. Este archivo
reúne los pedidos que las sesiones de módulo le hacen, **cada uno completo y
listo para pegar tal cual**, para que no haya que reconstruirlos de un chat.

> ## ESTE ARCHIVO ESTÁ INCOMPLETO, y es importante saber por qué
>
> La cabeza **no tiene el texto** de los pedidos 1 a 6 ni del token del motor.
> Fueron hechos en la sesión de **Pro City**, y entre sesiones no hay canal:
> se midió el 30 de octubre y no hay ninguna notificación en cola, ninguna
> rama con esa lista, y la rama del educativo/Pro City
> (`claude/laughing-turing-5kftp3`) está en `main` sin un solo commit propio.
>
> Lo que está **completo y verificado** abajo es el **#7**, que llegó textual.
> El **#1** tiene sus dos preguntas **contestadas** por Daniel el 30 de
> octubre, leídas del registro de decisiones de Pro City; **sigue sin
> aplicarse**, esperando su texto completo.
>
> **Los demás están como huecos con nombre, no rellenados.** Escribirlos de
> memoria sería inventar un pedido y dárselo por recibido, que es peor que no
> tenerlo: la cabeza lo trabajaría y el pedido de verdad se perdería.
>
> **Cómo se completa:** Pro City pega acá el texto de cada uno, o Daniel lo
> trae de ese chat. Un pedido pegado tal cual no hay que interpretarlo.

## Tabla de estado y dependencias

| # | Pedido | ¿Tengo el texto? | Depende de |
|---|---|---|---|
| 1 | Registro de módulos: entrada `procity` nueva, y `leeDe` en `viviendas` | **Respondido** — falta el texto completo | — |
| 2 | *(sin texto)* | **No** | ? |
| 3 | *(sin texto)* | **No** | ? |
| 4 | *(sin texto)* | **No** | ? |
| 5 | *(sin texto)* | **No** | ? |
| — | El token del motor | **No** | ? |
| 6 | Los dos defectos del módulo viejo | **No** | ? |
| 7 | `urbis-respaldo-2` con campo, trazos y conteos | **Sí, completo** | **del 1**, si la percepción se declara en el registro |

**La única dependencia que puedo afirmar** es la del 7 con el 1, y con las
respuestas del 30 de octubre quedó **más chica de lo que parecía**: el
respaldo del 7 rotula la percepción del módulo VIEJO —`educativo`, donde es
privada y sigue siéndolo—, mientras que la percepción que `procity` comparte
es la suya. Así que el 7 **no espera** al 1. Lo que sí sigue valiendo es de
dónde sale la lista: quien declara qué es privado de un módulo es el registro
(`js/03h-registro-modulos.js`), y el respaldo la lee de ahí en vez de repetirla
— dos listas de lo mismo se separan a la tanda siguiente (clase B).

Y queda una pregunta abierta que podría volver a juntarlos, anotada en el 1:
si `procity` leyera o heredara la percepción del almacén viejo, las dos
percepciones serían una y habría que decidir cuál manda.

Las demás dependencias **no las puedo marcar**: no sé qué piden el 2, el 3, el
4, el 5, el del token ni el 6.

---

## 1 · El registro de módulos · RESPONDIDO, sin aplicar

Daniel contestó las dos preguntas el 30 de octubre, leyéndolas del registro de
decisiones de Pro City. **No se aplicó nada**: el texto completo del pedido
llega aparte, y hasta entonces esto queda escrito y quieto.

### Las respuestas, tal como llegaron

1. **`procity` es un módulo NUEVO**, distinto de `educativo`. **`educativo`
   sigue vivo: no se toca ni se apaga.**
2. **Entrada `procity`:** `backend: 'postgres'`, **sin tipos propios**.
   * **Comparte:** el punto y sus campos, la percepción rotulada
     «percepción», y las medidas de campo.
   * **Privado:** sector, lote, geometrías, estructura de las plantillas,
     resultado del post-sector, lámina y rasters.
3. **Entrada `viviendas`:** `leeDe` con `{ modulo: 'procity', campo:
   'percepcion' }` y `{ modulo: 'procity', campo: 'medidas' }`.

### Lo que eso resuelve, cotejado contra el registro

* **Dos módulos y no un renombrado**, así que no hay nada que mudar: el
  reparto de `educativo` del 23 de octubre se queda como está, con su
  `backend: 'local'` y sus cuatro campos privados.
* **Sin tipos propios y en Postgres**, así que `procity` no toca la hoja: el
  trinquete sigue en los ocho de siempre y no hace falta ninguna exención.
  Un módulo sin tipos es una forma que el registro ya admite —`seguridad` es
  igual—, y la guarda del dueño único no tiene nada que repartir.
* **El `leeDe` resuelve**, que es lo que la guarda comprueba: `percepcion` y
  `medidas` están en el `comparte` de `procity`. Si alguno de los dos se
  moviera a privado, la guarda se pondría roja y diría cuál.

### DOS COSAS QUE LA CABEZA NO RESUELVE, y hay que mirar antes de aplicar

**La primera, y es la que importa: la percepción cambia de lado.** En
`educativo`, `panelPercepcion` es **PRIVADO** por decisión del 23 de octubre,
y la razón quedó escrita: un panel de percepción es *lo que alguien sintió*, y
leído desde otro módulo se vería como lo mapeado. En `procity` la percepción
va **COMPARTIDA**, y Viviendas la va a leer.

No es necesariamente una contradicción —son dos módulos y Daniel puede decidir
distinto en cada uno—, pero **el argumento que hizo privada a una aplica igual
a la otra**, así que vale decidirlo mirando y no de paso. Lo que la cabeza
puede ofrecer sin cambiar la decisión: que el campo compartido viaje **con su
rótulo pegado**, de modo que quien lo lea desde Viviendas no pueda confundir
una percepción con una medición. Eso es la regla de que el aviso viaja con la
cifra y no con la pantalla, y no le quita a nadie el acceso.

**La segunda: cómo se cruza esto con el pedido 7.** El 7 pide que la
percepción quede **rotulada PRIVADA en el archivo de respaldo**. La lectura de
la cabeza es que **no choca**, porque son dos percepciones distintas: la del
respaldo es la del **módulo VIEJO** —`pcr_campo_v1`, los tres paneles de
`educativo`, que son privados— y la que `procity` comparte es la **suya**, de
un módulo nuevo que guarda en Postgres. **Es una lectura, no un hecho**: si
`procity` va a leer o heredar la percepción del almacén viejo, entonces sí
chocan y hay que decidir cuál manda. **Confírmelo con el texto completo.**

### Lo que falta para poder aplicarlo, y es poco

Los nombres de los otros campos **llegaron en prosa y el registro necesita
claves**: «el punto y sus campos», «sector», «lote», «geometrías», «estructura
de las plantillas», «resultado del post-sector», «lámina», «rasters». Los dos
que importan hoy ya vienen como clave —`percepcion` y `medidas`, porque el
`leeDe` los nombra— así que el resto se puede cerrar con el texto completo sin
bloquear nada. La cabeza **no los va a inventar**: un nombre de campo escrito
de memoria es la falta que este proyecto tiene medida desde la v863.

## 2 · *(sin texto)*

**La cabeza no tiene este pedido.** Pegue acá su texto tal cual.

## 3 · *(sin texto)*

**La cabeza no tiene este pedido.** Pegue acá su texto tal cual.

## 4 · *(sin texto)*

**La cabeza no tiene este pedido.** Pegue acá su texto tal cual.

## 5 · *(sin texto)*

**La cabeza no tiene este pedido.** Pegue acá su texto tal cual.

## — · El token del motor · *(sin texto)*

**La cabeza no tiene este pedido.** Y conviene decir qué sí sabe del asunto,
por si ayuda a reconocerlo cuando llegue: el motor vive en el repositorio
privado `../urbis-motor`, que **este contenedor no tiene**; `node
pruebas/correr.js` no corre por eso. Daniel decidió el 23 de octubre que **el
motor no se trae hasta revisar que no tenga llaves**. Si el pedido es sobre un
secreto o una variable de entorno, eso toca esa decisión y no se puede
adelantar acá.

## 6 · Los dos defectos del módulo viejo · *(sin texto)*

**La cabeza no tiene este pedido**, y este es el que más pide pegarse tal cual:
«los dos defectos» no se puede adivinar sin nombrarlos, y un defecto mal
reconstruido se arregla donde no estaba.

Pegue de cada uno: **qué se ve**, **dónde** (archivo y línea), **qué lo
dispara** y **qué tendría que pasar en vez de eso**.

---

## 7 · `urbis-respaldo-2` · COMPLETO, listo para trabajar

### El pedido, tal como llegó

> Pro City necesita que el respaldo del módulo viejo lleve más datos.
> Hoy `urbis-respaldo-1` (`js/68:2757`) lleva solo las fichas. No viajan:
> - las plantillas y la percepción (`pcr_campo_v1`, hasta 120 por sector),
> - los trazos guardados sin analizar (`pcr_trazos_v1`),
> - los conteos (`pcr_conteos_v1`).
>
> Pedido: un `urbis-respaldo-2` que incluya esos tres, sin cambiar el formato
> de las fichas. La percepción debe quedar rotulada como PRIVADA en el
> archivo. El módulo viejo no se apaga ni se reescribe; solo se extiende su
> respaldo.

### Lo que la cabeza ya midió en el código (para que no haya que volver a leerlo)

| Cosa | Dónde | Forma | Tope |
|---|---|---|---|
| `RESPALDO_FORMATO` | `js/68:2757` | `'urbis-respaldo-1'` | — |
| `respaldoDeTodo(fichas)` | `js/68:2759` | `{formato, app, cuando, quien, fichas}` | — |
| `traerRespaldo(texto)` | `js/68:2774` | exige `formato === RESPALDO_FORMATO` y `fichas` array | `MAX_FICHAS` |
| `pcr_campo_v1` | `CAMPO_KEY`, `js/68:832` | objeto `{ <llaveDeSector>: { v:1, entradas:[…] } }` | `MAX_CAMPO_POR_SECTOR = 120` |
| `pcr_trazos_v1` | `TRAZOS_KEY`, `js/68:418` | array de `{id, nombre, ts, forma, pts, areaM2, centro}` | `MAX_TRAZOS = 40` |
| `pcr_conteos_v1` | `CONTEOS_KEY`, `js/68:635` | objeto `{ <llaveDeSector>: { total, ts } }` | `MAX_CONTEOS = 60` |
| La percepción | `PANELES_DE_PERCEPCION`, `js/68:20082` | los 3 slugs de `TITULOS_DE_PERCEPCION` | dentro de `campo` |
| El botón | `js/68:32752`, `name === 'respaldo'` | arma el paquete y lo baja | — |

**Cinco cosas que deciden el diseño y que salieron de medir, no de suponer:**

1. **La percepción NO es un almacén aparte.** Vive dentro de `pcr_campo_v1`,
   mezclada con las plantillas: se distingue porque su `hueco` está en
   `PANELES_DE_PERCEPCION`, que **se deriva de los títulos** y no es una
   lista escrita a mano. Así que el respaldo las separa al armarse, y el
   discriminante se lee de esa misma lista derivada — no se copia.
2. **El rótulo tiene que viajar CON el dato, no con el nombre de la clave**
   (v867). Una clave llamada `percepcionPrivada` es una convención que el
   lector siguiente tiene que adivinar; además va una lista legible por
   máquina —`privado: [...]`— y el texto del rótulo dentro del propio bloque.
3. **El formato de las fichas no se toca**, que es el pedido explícito: el
   array `fichas` se arma con la misma función y la misma forma.
4. **`traerRespaldo` tiene que seguir aceptando el formato 1**, porque el
   módulo viejo no se apaga: un archivo bajado la semana pasada tiene que
   entrar igual, trayendo solo fichas. Dos formatos aceptados, uno escrito.
5. **La fusión tiene que ser idempotente**, que es la regla que el propio
   `traerRespaldo` ya tiene escrita: traer dos veces el mismo archivo da lo
   mismo que traerlo una. Las identidades que el módulo YA usa, y que el
   respaldo reusa en vez de inventar:
   * trazos → por `id`, y el tope de 40 recorta lo más viejo;
   * campo → por **`hueco` + `sub` dentro de cada sector**, que es
     exactamente como `guardarCampo` actualiza en vez de duplicar; gana el de
     `ts` mayor;
   * conteos → por llave de sector; gana el de `ts` mayor.

### Lo que falta decidir, y es de Pro City o de Daniel

* **¿La percepción se restaura, o solo se archiva?** El respaldo sirve para
  dos cosas distintas: no perder el trabajo, y juntar los teléfonos de un
  curso. Para lo primero hay que poder traerla de vuelta; para lo segundo,
  meter en un teléfono lo que escribió otra persona sobre un barrio es
  justamente lo que el reparto llama privado. **La cabeza no decide esto.**
  Mientras no haya respuesta, lo honesto es: viaja en el archivo, rotulada, y
  al restaurar **se pregunta** en vez de entrar sola.
* **El tamaño.** Doce fichas pesan 522 KB medidos. Campo (hasta 120 entradas
  por sector), 40 trazos y 60 conteos suman poco al lado de eso, pero el
  número hay que medirlo con datos reales, no estimarlo — y el aviso del botón
  dice los KB, así que seguirá diciendo la verdad sola.

### Lo que la cabeza hará, cuando se le dé el visto bueno

`urbis-respaldo-2` con `fichas` intacto más `campo`, `percepcion` (rotulada),
`trazos` y `conteos`; `traerRespaldo` aceptando los dos formatos; la fusión
con las identidades de arriba; guardas en `pruebas/revisar.js` —que el rótulo
de privada esté y se derive de `PANELES_DE_PERCEPCION`, que el formato 1 siga
aceptándose, que la forma de las fichas no cambie— cada una demostrada en
rojo con su inyección fiel. **Nada de apagar ni reescribir el módulo viejo.**
