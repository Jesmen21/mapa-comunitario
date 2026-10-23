# Las decisiones de producto, escritas una vez · `DECISIONES-DANIEL`

Lo que Daniel ya decidió **no se vuelve a preguntar**. Acá va cada decisión
con su fecha, textual donde importa, y **qué ata en el código**, que es la
parte que una sesión necesita antes de tocar nada.

Lo escribe la cabeza. Una sesión que crea que una decisión está mal la
discute con Daniel; no la reinterpreta en su rama.

**Por qué existe este archivo:** el 23 de octubre de 2026 las nueve sesiones
de módulo quedaron bloqueadas pidiendo decisiones, y **cinco preguntaban lo
mismo**. Una decisión que vive solo en un chat no la hereda nadie: la sesión
siguiente la vuelve a preguntar, o peor, la resuelve sola.

---

## 23 de octubre de 2026

### 1 · Viviendas · la dirección

> En público, ubicación **aproximada** (cuadra/barrio). La exacta solo para
> Daniel o tras contacto con el interesado.

**Qué ata:** en el registro de módulos, `viviendas` declara
`ubicacionAproximada` en `comparte` y `direccionExacta` en `privado`. Son
**dos campos y no uno con una bandera**: un campo con bandera se publica
entero el día que alguien lee mal la bandera.

### 2 · Viviendas · dónde viven los datos

> Postgres (Supabase), no Sheet. Ya está decidido que **Sheets no se extiende
> a nada nuevo**.

**Vigente y sin excepciones.** La 2.ª tanda la corrigió durante unas horas
—Viviendas iba a usar la hoja de la vitrina de forma transitoria— y Daniel
**retiró esa corrección el mismo día**: Viviendas usa Supabase. Queda escrito
en la decisión 9, abajo, en vez de borrarse, porque la excepción llegó a estar
escrita en el código y quien lea esa historia tiene que poder saber por qué
apareció y por qué se fue.

**Qué ata, y es lo más grande de las ocho:** parte el almacén en dos. La hoja
se queda con lo que ya tiene —ocho módulos— y **se congela para datos
nuevos**; todo módulo nuevo va a Postgres. Conviene decir entonces qué sigue
siendo «una sola capa», porque si no la frase deja de ser cierta sin que nadie
lo note: **lo compartido no es el almacén, es el REGISTRO** —quién es dueño de
qué y quién puede leerlo—, viva el dato donde viva.

`revisar.js` lo vigila con un trinquete: la lista de los ocho que usan la hoja
no crece. Y con su guarda de la guarda, porque si alguien saca uno de los ocho
sin decirlo, la lista congelada mediría un conjunto que ya no existe.

### 3 · Viviendas · el alcance  ·  **AMPLIADA**

> Módulo propio. Lee el análisis de ubicación de Empresas **a través del
> registro de módulos, sin copiarlo**.

**Qué ata:** `empresas` entra al registro —no estaba, porque no escribe en la
hoja— declarando `analisisUbicacion` en `comparte`, y `viviendas` declara
`leeDe: [{ modulo: 'empresas', campo: 'analisisUbicacion' }]`. La guarda
comprueba que esa puerta **resuelva**: una lectura declarada contra un campo
que el otro no comparte es una puerta que no abre, y desde afuera se lee igual
que una que sí (clase C). Copiar el cálculo sería la clase B con dos dueños.

### 4 · Político · los datos de la v1

> SIN datos reales de votantes. Solo datos simulados rotulados **SIMULADO**.
> Guardar datos personales reales es decisión aparte, y **no se construye
> hasta que yo la tome**.

**Qué ata:** `politico` lleva `soloSimulado: true` y su nota lo dice con esa
palabra. La guarda ata la bandera a la nota, para que la declaración llegue a
quien lea el registro y no se quede en una bandera que ninguna pantalla pinta.

### 5 · Seguridad · el botón de pánico

> La v1 es **solo mapa y reportes**. No se construye un botón que prometa
> respuesta de emergencia hasta que haya convenio real con la Policía/123.

Y el precedente, ya decidido en Movilidad: con convenio, directo a la Policía;
sin convenio, a la central de la cooperativa.

**Qué ata:** queda escrito en la nota de `seguridad`. La razón va con la
decisión porque es la que impide que vuelva a proponerse: **un botón que
promete respuesta y no la tiene es peor que no tenerlo.**

### 6 · Seguridad · los reportes

> **Reportes/Eventos es dueño** de la matriz de tipos y del flujo de reporte.
> Seguridad solo los muestra y analiza; **no crea tipos duplicados**.

**Qué ata:** `seguridad` tiene `tipos: []` y declara
`leeDe: reportes.categoria` y `reportes.subtipo`. Un tipo duplicado ahí serían
dos dueños para un hecho, que es exactamente lo que la guarda del registro
rechaza — y queda escrito en vez de confiar en que alguien se acuerde.

### 7 · Social es un paraguas  ·  **CORREGIDA EN PARTE**

> Es paraguas de runner, minijuegos, Patitas URBIS y orientación comunal.
> **No son módulos separados.**

**Qué ata, y trajo una corrección:** `rush` y `premio` estaban como dos
entradas y ahora son una sola, `social`. Y hubo que **renombrar** lo que antes
se llamaba `social` —la infraestructura de comentarios, relaciones y permisos
de js/12— a `interaccion`: dos cosas distintas con un solo nombre es la clase
B entrando por la puerta del vocabulario. Se renombró el mismo día porque hoy
no cuesta nada —el espacio con nombre no tiene un solo lector todavía— y
mañana sí.

### 8 · Visión Territorial · Supabase

> Proyecto **NUEVO**, separado del de vayayvuelva (no mezclar datos de
> taxistas con datos de municipios). Las contraseñas y llaves van en variables
> de entorno / gestor de contraseñas, **nunca en el repo**. **No crear nada
> hasta que yo confirme que el proyecto nuevo cabe en el plan gratuito.**

**Qué ata:** nada en el código todavía, y esa es la decisión: VT **no crea el
proyecto** hasta la confirmación. Las llaves siguen bajo la regla de secretos
que ya está en `CLAUDE.md`, y la del esquema de VT sigue valiendo: **nunca la
llave `service_role`**, que salta la RLS y la volvería decorativa.

---

## 23 de octubre de 2026 · segunda tanda

Diecisiete decisiones más. Dos **corrigen** decisiones de la primera tanda y
se marcan arriba en el renglón que corrigen, para que nadie lea la vieja sin
enterarse — que es como una decisión escrita hace daño.

### 9 · ~~CORRECCIÓN · Viviendas usa la hoja, transitoriamente~~  ·  **RETIRADA**

> **Retirada por Daniel el mismo 23 de octubre de 2026:** *«Viviendas usa
> Supabase, no la hoja.»*

La corrección había dicho que Viviendas usaría el almacén de la Vitrina —la
hoja— de forma transitoria, con el modelo independiente del almacén. **Ya no.**
La decisión 2 vuelve a valer entera: Viviendas va a Supabase y **la hoja no
tiene ninguna excepción**.

**Qué se deshizo, en los tres sitios donde la excepción había quedado escrita:**

| Sitio | Qué decía | Qué dice |
|---|---|---|
| `js/03h-registro-modulos.js` | `backend: 'hoja'` + `transitorio` | `backend: 'postgres'`, sin `transitorio` |
| `pruebas/revisar.js` | `TRANSITORIOS = { viviendas: … }` | `TRANSITORIOS = {}` |
| este archivo | la 2 marcada «corregida en parte» | la 2 vigente y sin excepciones |

**Por qué se deja escrita en vez de borrarla, y qué se aprende:** la excepción
estuvo en el código, con su guarda y con su inyección en rojo. Borrarla sin
rastro dejaría a quien lea el historial preguntándose por qué el trinquete
tiene un mecanismo de exenciones que nadie usó nunca.

Y el mecanismo **se queda, vacío**: `TRANSITORIOS = {}`. Eso no es un resto
olvidado — es lo que obliga a que la próxima excepción se escriba ahí, por
ítem y con su razón, en vez de inventar un camino nuevo. Además pone a correr
la **redacción de CERO** de esa guarda, que es justamente la que hace falta el
día que una excepción desaparece (v970), y hoy imprime «los 8 de siempre y
ninguno más».

**Lo que sí sobrevive de la 2.ª tanda:** la decisión 10 no se tocó. Viviendas
sigue siendo módulo propio en datos, con **tipo de fila y permiso propios** —
solo que ahora son sus clases de fila en su propia tabla de Postgres y no
valores del campo `tipo` de la hoja, a la que no escribe.

### 10 · Viviendas · qué es y qué no

> Módulo propio **en datos** (tipo de fila y permiso propios), **sin página ni
> service worker propios** por ahora. Primero **venta**; arriendo después con
> el mismo modelo. **Publica solo Daniel** (o quien él autorice).

**Qué ata:** `viviendas` declara dos tipos propios. **Y acá va una cosa que la
cabeza propuso y no decidió:** el texto exacto de esos tipos —`🏠 Vivienda
URBIS` y `🏠 Permiso Vivienda URBIS`— lo escribió la cabeza para que el
registro no quedara vacío, y lleva `tipoPropuesto: true`. **La sesión de
Viviendas lo confirma o lo cambia antes de escribir la primera fila.**

### 11 · CORRECCIÓN · Social: el paraguas cambia de contenido

> Paraguas de runner, minijuegos, **Patitas y chat**. «Orientación comunal»:
> **pendiente de Daniel, no se construye.**

La decisión 7 decía «runner, minijuegos, Patitas y orientación comunal». La
orientación comunal **sale** del paraguas y queda sin construir.

**Y una pregunta que la cabeza NO resuelve sola:** «chat» entra al paraguas, y
en el registro ya existe `interaccion` —comentarios, relaciones y permisos de
js/12—, que es infraestructura y no producto. Si el chat de Social es ese
mismo `💬 Comentario` o uno nuevo **cambia quién es su dueño**, y eso lo
decide Daniel o la sesión de Social. Hasta entonces **no se movió nada**:
mover un tipo de dueño por una suposición es exactamente el choque que el
registro existe para impedir.

### 12 · Social · Patitas URBIS

> **Sin botón de donar ni «total donado».** Se queda en **Próximamente** y
> **fuera del APK**.

### 13 · Social · logros y runners

> Logros inalcanzables: **ocultar, no borrar.** Runners: **unificar hacia el
> móvil**, escondiendo primero el de escritorio.

«Ocultar y no borrar» es la misma regla que el módulo presidencial ya tiene
escrita para un caso que se cae: **borrar es esconder**, y lo que se oculta
se puede volver a mirar.

### 14 · Reportes/Eventos · la caducidad, tipo por tipo

> El letrero muestra **la vigencia real por tipo**. Los **16 de conflicto
> armado no caducan**. **Animal callejero/herido y maltrato animal** caducan o
> tienen estado «resuelto». **Falta de sombra, permanente.**
> **Contaminación: pendiente** de elegir.

### 15 · Reportes/Eventos · la matriz es un contrato compartido

> La matriz de tipos (**126 tipos, 99 inyectados en js/20**) se documenta como
> **contrato compartido para Movilidad**.

**Qué ata:** la matriz entra a la lista de lo compartido de
`COORDINACION-MODULOS.md`. Un contrato compartido no lo cambia su dueño en
silencio: Reportes/Eventos sigue siendo el dueño y avisa a la cabeza antes de
renombrar o retirar un tipo.

### 16 · Reportes/Eventos · `tcorregir`

> **Diagnosticar sin cambiar código.**

### 17 · Empresas

> **POIs de OpenStreetMap; Google Places descartado.** Marca de agua
> **pospuesta**. **El motor no se trae hasta revisar que no tenga llaves.**
> Bugs **1, 2 y 3 de `seisDatos()` en una sola tanda.**

«No se trae hasta revisar que no tenga llaves» es la regla de secretos
aplicada antes de clonar, y no después: un secreto que entra al contenedor ya
entró.

### 18 · Visión Territorial

> Proyecto **Supabase nuevo**, sin tocar `vayayvuelva`; el motor en el
> servidor de **api.urbispro.city** si es posible. **Primer peldaño aprobado:
> esquema `vt` con el `search_path` medido.**

Esto **levanta en parte** la espera de la decisión 8: el primer peldaño está
aprobado. Lo que sigue esperando es todo lo que cueste plan.

### 19 · Seguridad · precisión sobre la v1

> La v1 **no lleva botón de pánico con avisos** (a lo sumo «Llamar al 123»);
> **pantalla que lee lo existente**.

Precisa la decisión 5 sin contradecirla: «Llamar al 123» es marcar un número,
no prometer una respuesta.

### 20 · Político · EN PAUSA

> **En pausa.**

**Qué ata:** el registro lo declara con `enPausa` y su fecha. Una pausa
escrita no es lo mismo que un módulo que nadie mira: la diferencia es
exactamente la que este proyecto persigue desde la v899.

### 21 · La regla 2, aplicada a un módulo

> **Suite propia en verde y sin rojas nuevas.** La cabeza clasifica las **12
> rojas heredadas** y **solo la cabeza hace merge a `main`.**

**Qué ata:** entra a `COORDINACION-MODULOS.md`. Resuelve la pregunta que el
módulo político hizo —si «batería en verde» bloquea publicar o basta con
«ninguna roja nueva»— y la respuesta es **las dos cosas**: la suite propia en
verde, y ninguna roja nueva en las demás.

### 22 · Infraestructura, y le toca a la cabeza

> **(a)** Service worker: `respondWith(undefined)` y **vendorizar Leaflet y
> Chart.js**. Lo midieron Social y Reportes de forma independiente.
> **(b)** `db_read` abierto: Daniel verificará el Apps Script y pasará la
> función. **Hasta entonces no se construye nada familiar sobre la ubicación.**

El `respondWith(undefined)` **está arreglado** (v1165), en los dos service
workers con caché y con su guarda. **Vendorizar NO se pudo**: el proxy de este
contenedor niega `unpkg.com` y `cdn.jsdelivr.net` —medido, código 000 en los
dos—, así que los archivos no se pueden descargar desde acá. Queda pendiente y
con su razón, que es lo contrario de quedar sin hacer y sin decirlo.

### 23 · Movilidad

> Bloqueada por el acceso a `moviacode/movia`; **Daniel abrirá una sesión
> nueva con ese repo.**

---

## Lo que estas ocho NO contestan

Va escrito para que no se lea como que todo quedó resuelto:

**Casi todas quedaron cerradas por la segunda tanda**, y conviene decir cuáles
siguen abiertas para que la lista no se lea como que todo se resolvió:

* **Reportes/Eventos** · qué hacer con **contaminación**: Daniel lo dejó
  «pendiente de elegir».
* **Social** · qué es «chat» dentro del paraguas, y si es el mismo
  `💬 Comentario` que hoy es de `interaccion` (decisión 11).
* **Social** · «orientación comunal»: pendiente de Daniel, sin construir.
* **Viviendas** · confirmar los dos tipos que la cabeza propuso (decisión 10).
* **Educativo** · el piso de 120 mm con la cifra de los doce mapas, y el punto
  del motor. **Son las únicas dos de la primera lista que nadie ha tocado.**
* **Seguridad** · si el servidor filtra las filas de ubicación. Depende de la
  decisión 22(b): Daniel verifica el Apps Script.
* **Movilidad** · sigue bloqueada por acceso a `moviacode/movia`, que es otro
  repositorio y no lo desbloquea nada de acá.
