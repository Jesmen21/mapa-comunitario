# Alertas de desastres (diaria) · dos cambios puntuales

El texto guardado de esta rutina está bien y es reciente — tiene los trece
tipos, el umbral, las coordenadas del SGC y el límite de alcance. **No hay que
reescribirlo.** Solo dos cosas, y la primera es un defecto que se cobra cada
día que corra.

---

## PARCHE 1 · en DESPLIEGUE, paso 3 · «LOS 5 ARCHIVOS» son NUEVE

**Buscar este párrafo** (empieza con «Si sí hubo cambios»):

> 3. Si sí hubo cambios: subí el token de versión. Buscálo con `grep -o "const URBIS_CACHE = '[^']*'" service-worker.js` y reemplazalo con el número incrementado en LOS 5 ARCHIVOS: `service-worker.js`, `index.html`, `css/main.css`, `analisis-ia.html`, `seguimiento.html`. Ojo con dos detalles que ya se han escapado antes: en `index.html` el token aparece también en `window.URBIS_APP_VERSION`, y en `service-worker.js` lleva el prefijo `urbis-v` mientras que en el resto va como `?v=`. Al terminar, comprobá que no quedó ninguna referencia al número viejo.

**Reemplazarlo por este:**

> 3. Si sí hubo cambios: subí el token de versión. Buscálo con `grep -o "const URBIS_CACHE = '[^']*'" service-worker.js` y reemplazalo con el número incrementado en LOS NUEVE ARCHIVOS, con un sed sobre los nueve: `service-worker.js`, `index.html`, `css/main.css`, `analisis-ia.html`, `seguimiento.html`, `reportes.html`, `sw-reportes.js`, `vision-territorial.html` y `sw-vt.js`. Los dos últimos son de Visión Territorial, que es una página propia con su propio service worker y por eso tiene su propia caché que romper. Ojo con dos detalles que ya se han escapado antes: en `index.html` el token aparece también en `window.URBIS_APP_VERSION`, y en `service-worker.js` lleva el prefijo `urbis-v` mientras que en el resto va como `?v=`. Al terminar, comprobá que no quedó ninguna referencia al número viejo, y corré `node pruebas/revisar.js`: comprueba que los nueve coincidan y que la versión no choque con la publicada. **Manda la guarda, no esta lista**: si se separan, la guarda lo dice y el número de acá es el que está mal.

**Por qué.** Son nueve desde la v1140. Con cinco de nueve, cuatro cachés quedan
viejas y un teléfono se queda con media aplicación de cada versión — que es
peor que no actualizar.

---

## PARCHE 2 · en «LA FUENTE MANDA SOBRE LA PRENSA» · el enlace observado

**Agregar un renglón al final de esa lista**, después de «Sin fuente oficial
identificable, no se publica»:

> - **El enlace del campo `url` sale de un resultado que VISTE**: el que devolvió la búsqueda, o la página que abriste. **Nunca lo armes por patrón** a partir del titular o del nombre de la entidad, aunque sepas cómo construye las URL ese sitio. Si no viste el enlace, poné el de la fuente que sí comprobaste, o dejá la alerta con la fuente nombrada y sin `url`. Un enlace inventado es peor que ninguno, porque se lee como fuente comprobable.

**Por qué.** Regla nueva, y la pagó la sesión del 22 de octubre: dos tandas
seguidas escribieron dos enlaces que parecían perfectamente plausibles y
estaban armados slugificando el titular. Los dos hubo que retirarlos.

---

## Lo que NO cambia, y conviene no tocar

El resto del texto está medido y correcto: los trece tipos con sus tildes, el
umbral por clase de evento, las coordenadas del epicentro del SGC en vez de
geocodificar el municipio, el límite absoluto de alcance —nunca violencia, que
en zona de frontera convierte un mapa público en un mapa de objetivos—, la
regla de no duplicar por coordenadas y fecha, y los plazos de `expira`.
