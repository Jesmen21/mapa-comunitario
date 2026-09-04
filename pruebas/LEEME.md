# Las pruebas de URBIS

Dos cosas distintas, que se corren distinto.

## 1 · El revisor estático

    node pruebas/revisar.js

Mira el código sin ejecutarlo: que los cinco archivos de versión digan lo
mismo, que ninguna hoja de estilo tenga una llave o un comentario sin cerrar,
que la precarga del *service worker* y las etiquetas `<script>` coincidan en
las dos direcciones, y que **el clasificador no se sirva nunca al navegador**
—las reglas de reconocimiento viven en el repositorio privado del motor y
salir de ahí sería regalar el producto—.

No necesita nada: ni red, ni navegador, ni servidores.

## 2 · Las pruebas de comportamiento

    python3 -m http.server 8199          # en la raíz de este repositorio
    node servidor.js                     # en el repositorio del motor
    node pruebas/correr.js               # acá

Abren la aplicación en un navegador de verdad, la usan como la usaría una
persona —dibujan el área, tocan los botones, esperan a que el análisis
vuelva— y comprueban lo que queda en pantalla, en el mapa y en el papel.

    node pruebas/correr.js tcurvas tlote     # solo esas
    node pruebas/correr.js --lista           # qué hay

**El puerto 8199 no es negociable** sin tocar el motor: es uno de los
orígenes que acepta, y desde cualquier otro el navegador se queda esperando
una respuesta que nunca llega.

Unas pocas no necesitan navegador: las que vigilan las reglas de
reconocimiento cargan el motor directamente en node (`motor-local.js`) y
tardan menos de un segundo. Las que sí lo necesitan y además necesitan las
reglas dentro de la página le inyectan el mismo paquete que corre en la API
(`motor-navegador.js`), no una copia.

### Lo que no está en el repositorio

El navegador, los paquetes de terceros y las capturas que algunas pruebas
dejan para poder mirarlas. Todo eso vive fuera y se configura en
`pruebas/entorno.js`, que trae los valores de una máquina de desarrollo como
omisión y acepta variables de entorno para cambiarlos:

| Variable | Para qué |
|---|---|
| `URBIS_PRUEBAS_TRABAJO` | carpeta con `node_modules` y donde se dejan capturas |
| `URBIS_PRUEBAS_MODULOS` | `node_modules` si está en otro lado |
| `URBIS_CHROMIUM` | el ejecutable del navegador |
| `URBIS_ESTATICO` | dónde se sirve este repositorio (por omisión `:8199`) |
| `URBIS_MOTOR` | dónde escucha el motor (por omisión `:8787`) |
| `URBIS_MOTOR_REPO` | el repositorio privado del motor |
| `URBIS_PRUEBAS_PARALELO` | cuántas a la vez (4) |

Los paquetes son tres: `playwright-core`, `leaflet` y `chart.js`.

### Cómo se lee una suite

Cada archivo empieza explicando **qué maqueta arma y por qué**. Las maquetas
tienen respuesta conocida a propósito: una rampa cuyas curvas de nivel tienen
que salir verticales, un callejón sin salida donde caminar cuesta el doble
que la línea recta, una torre al occidente que a las tres de la tarde le tapa
el lote y a las nueve de la mañana no. Así una prueba en verde dice algo, en
vez de decir que el programa sigue haciendo lo que hacía.
