# Módulo VIVIENDAS · notas de la sesión · rama `claude/fervent-allen-74qgwm`

Lo propio de este módulo. Las reglas comunes están en `CLAUDE.md` y el reparto
entre sesiones en `herramientas/COORDINACION-MODULOS.md`; acá no se repiten.

## Qué es

Las viviendas que Daniel va a vender —y después a arrendar—, publicadas para
el ciudadano. **El diferenciador es que cada vivienda muestra sus fortalezas y
el análisis de ubicación del sector**, apoyado en el análisis que URBIS ya
tiene. Un portal cualquiera dice «excelente ubicación»; acá cada fortaleza
tiene que decir de dónde sale.

## Decisiones de Daniel · 23 de octubre de 2026

1. **Módulo propio en los datos**, con la mecánica de la Vitrina: tipo de fila
   y permiso `viviendas` propios. Sin página ni service worker propios por
   ahora.
2. **Almacén: el de la Vitrina, transitorio.** El modelo no depende del
   almacén y tiene que poder pasar a Postgres sin rehacerse.
3. **Dirección pública aproximada** (cuadra o barrio); exacta solo tras
   contacto.
4. **Primero VENTA.** Arriendo después, con el mismo modelo (`operacion` más
   administración y depósito).
5. **Publica solo Daniel** y quien él autorice. Nada de terceros todavía.
6. Rama `claude/fervent-allen-74qgwm`, sin salto de versión.
7. Modelo de datos aprobado: puntero al análisis, fortalezas con `base` o
   `sinBase`, cada cifra con su origen, aviso de procedencia. Primer peldaño:
   el registro del módulo y el esquema, con pruebas y sin interfaz.

## Estado medido

| Qué | Dónde | Estado |
|---|---|---|
| El esquema de la vivienda | `herramientas/modulos/viviendas/83-viviendas.js` | escrito y medido |
| Su guarda | `pruebas/revisar.js`, bloque «El módulo de viviendas» | escrita, demostrada en rojo |
| El archivo en `js/` | `js/83-viviendas.js` | **pedido a la cabeza**, abajo |
| La entrada en el registro de la capa | `js/03h-registro-modulos.js` | **pedida a la cabeza**, abajo |
| Interfaz | — | no empieza; es el peldaño siguiente |
| Una sola vivienda cargada | — | ninguna, y es correcto: sin almacén enganchado no se carga nada |

## Lo que le pido a la cabeza

Son tres cosas y las tres son archivos compartidos, así que se piden
(`COORDINACION-MODULOS.md` §3 y §5).

### 1 · Mover el archivo a `js/` y engancharlo

```
git mv herramientas/modulos/viviendas/83-viviendas.js js/83-viviendas.js
```

y con él, las dos líneas que lo cargan: el `<script src="js/83-viviendas.js">`
en `index.html` y su ruta en el precaché de `service-worker.js`. **No está en
`js/` todavía justamente porque falta eso**: la guarda de archivos huérfanos
—techo CERO— se pone roja con un archivo de `js/` que ninguna página carga, y
tiene razón. La guarda del módulo lo busca en las dos rutas y dice en cuál lo
encontró, así que el movimiento no rompe nada.

Y lleva un salto de versión, porque el navegador tiene que descargar un
archivo nuevo: **el número lo pone la cabeza** (§2).

### 2 · La entrada en el registro de la capa de mapeos (`js/03h`)

Pedida con la forma que pide el protocolo —id, tipos, qué comparte y qué es
privado—. Medido antes de pedirla: ningún otro módulo reclama estos dos tipos,
y **no se pisan con los de la Vitrina** (`🛍️ Emprendimiento URBIS`,
`🛍️ Portafolio URBIS`, `🛍️ Logo URBIS`) ni con el tipo
`Vivienda y Residencial`, que es de `reportes` y es una categoría de la Matriz
de Usos, no un inmueble en venta.

```js
    viviendas: {
      titulo: 'Viviendas en venta y en arriendo',
      archivos: ['js/83-viviendas.js'],
      tipos: ['🏘️ Vivienda URBIS', '🏘️ Foto de vivienda URBIS'],
      prefijos: [],
      /* Lo que cualquier módulo puede leer: lo que ya está en la calle en el
         anuncio. Publicarlo y después negárselo a otro módulo no protegería
         nada. */
      comparte: ['tipo', 'operacion', 'precio', 'areaConstruida', 'habitaciones',
                 'banos', 'parqueaderos', 'direccionPublica'],
      /* PRIVADO por decisión de Daniel del 23 de octubre de 2026: la
         dirección exacta solo se entrega después del contacto, y el punto
         exacto ES la dirección —seis decimales son once centímetros—. Van las
         dos: taparle el texto a un lector y dejarle la coordenada sería
         declarar la mitad de la reserva, que es peor que no declarar ninguna. */
      privado: ['direccionExacta', 'puntoExacto', 'duenio'],
      nota: 'escribe solo Daniel y quien él autorice; el permiso propio es ' +
            '«viviendas», como «vitrina». Hoy el módulo no escribe ninguna fila: ' +
            'este renglón declara el reparto para cuando escriba.'
    },
```

### 3 · El permiso `viviendas` en el servidor

Igual que `vitrina`: sin candado, cualquiera podría publicar una vivienda con
la palabra URBIS avalándola. El servidor es el Apps Script y **no está en este
repositorio**, así que acá solo queda dicho.

## Decisiones que necesito de Daniel

### A · ¿Qué precisión lleva el punto publicado?

**Medido al escribir el esquema, y no lo decido sola.** La decisión 3 dice
dirección pública aproximada. Pero **el punto del mapa ES la dirección**:
`guardarTrazo` guarda seis decimales, que son once centímetros, así que
publicar `lat`/`lng` entrega la puerta de la casa aunque el texto diga «barrio
Caobos». Declarar la mitad de la reserva y callar la otra es el fallo de la
v867 en otro sitio.

El esquema no elige: `precisionPunto` es un campo **exigido sin valor por
omisión**, así que una vivienda sin esa declaración no pasa `validar` y por lo
tanto no publica. Las dos opciones están escritas y medidas:

| Valor | Decimales | Qué entrega |
|---|---|---|
| `manzana` | 3 | unos 110 m: ubica la cuadra, no la puerta |
| `exacto` | 6 | la puerta |

### B · ¿La administración también aplica en VENTA?

El esquema sigue tu decisión 4 al pie: `administracion` y `deposito` solo en
arriendo. Medido: un apartamento en **conjunto cerrado** en venta también paga
administración, y es de lo primero que pregunta un comprador. Cambiarlo es una
línea; no lo hago porque dijiste arriendo.

## Lo que este peldaño NO hace

* **Interfaz** — ninguna pantalla, ningún formulario, ninguna gota en el mapa.
  Es lo que pediste. `pendiente`
* **Escribir o leer del almacén** — el adaptador de la Vitrina está escrito y
  probado de ida y vuelta, pero nadie lo llama: llamar a `urbisGuardarFila`
  pide el permiso y la entrada del registro, que son los pedidos de arriba.
  `pendiente`
* **Comprobar que el análisis citado exista** — la guarda comprueba que la
  clave que cita una fortaleza sea una de las que el análisis produce, y que
  el ancla de esa clave exista de verdad en `js/68`. Lo que NO comprueba es
  que ESTA vivienda traiga ese dato: eso pide leer su ficha de
  `pcr_fichas_v1`, y la ficha llega con la interfaz. `pendiente`
* **Fotos** — declarado el tipo de fila (`🏘️ Foto de vivienda URBIS`) y nada
  más. La Vitrina ya midió por qué cada foto va en su propia fila: una foto
  comprimida casi llena una celda del Sheet. `pendiente`
* **El arriendo abierto** — el modelo está escrito y medido con un caso
  fabricado; lo que falta es tu decisión de abrirlo. `pendiente`
