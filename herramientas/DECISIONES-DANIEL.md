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

**Qué ata, y es lo más grande de las ocho:** parte el almacén en dos. La hoja
se queda con lo que ya tiene —ocho módulos— y **se congela para datos
nuevos**; todo módulo nuevo va a Postgres. Conviene decir entonces qué sigue
siendo «una sola capa», porque si no la frase deja de ser cierta sin que nadie
lo note: **lo compartido no es el almacén, es el REGISTRO** —quién es dueño de
qué y quién puede leerlo—, viva el dato donde viva.

`revisar.js` lo vigila con un trinquete: la lista de los ocho que usan la hoja
no crece. Y con su guarda de la guarda, porque si alguien saca uno de los ocho
sin decirlo, la lista congelada mediría un conjunto que ya no existe.

### 3 · Viviendas · el alcance

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

### 7 · Social es un paraguas

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

## Lo que estas ocho NO contestan

Va escrito para que no se lea como que todo quedó resuelto:

* **Viviendas** · si el arriendo usa el mismo formulario que la venta, y quién
  publica.
* **Reportes/Eventos** · la caducidad de los 23 tipos que no la tienen, y si
  Leaflet se vendoriza.
* **Social** · qué pasa con la donación de Patitas, si Patitas entra al APK, y
  si los 51 logros se implementan o se retiran.
* **Educativo** · el piso de 120 mm con la cifra de los doce mapas, y el punto
  del motor.
* **Empresas** · en qué salidas va la marca de agua, y si Google Places era
  plan a futuro.
* **Movilidad** · sigue bloqueada por acceso a `moviacode/movia`, que es otro
  repositorio y no lo desbloquea nada de acá.
