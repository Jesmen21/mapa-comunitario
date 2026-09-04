# URBIS · cómo se trabaja en este repositorio

Notas para cualquier sesión que retome el proyecto. Están acá porque cada una
de ellas costó tiempo averiguarla o romper algo.

## Antes de tocar nada: traer lo de arriba

```bash
git fetch origin && git merge origin/main --no-edit
```

**Hay más de una sesión escribiendo en este repositorio.** Una publica alertas
y seguimiento noticioso a `assets/data/` y sube a `main` varias veces al día,
con su propio salto de versión. Empezar una tanda sin traer eso termina en un
empujón rechazado y en una fusión hecha con prisa, que es cuando se pierde
trabajo ajeno.

Hacerlo también **al terminar**, antes de subir: entre el principio y el final
de una tanda pueden haber entrado dos versiones más.

Nunca `--force` sobre `main`. Si el empujón se rechaza, se fusiona.

## Las ramas

Se desarrolla en `main-r3g781`. Al terminar, `merge --ff-only` a `main` y se
suben las dos. Nada de trabajar directo sobre `main`.

## La versión va en cinco archivos

`service-worker.js`, `index.html` (incluido `window.URBIS_APP_VERSION`),
`css/main.css`, `analisis-ia.html`, `seguimiento.html`.

Tienen que llevar exactamente el mismo texto. Es lo que rompe la caché del
navegador: con uno desactualizado, un teléfono se queda con la mitad de la
aplicación vieja y la otra mitad nueva, que es peor que no actualizar. Se
cambian de una vez:

```bash
sed -i 's/682-lo-que-sea/683-lo-nuevo/g' \
  service-worker.js index.html css/main.css analisis-ia.html seguimiento.html
```

`node pruebas/revisar.js` comprueba que las cinco coincidan.

## Las pruebas

```bash
node pruebas/revisar.js     # sin navegador: versiones, llaves sin cerrar, reglas del motor
node pruebas/correr.js      # el navegador de verdad, ~58 suites
node pruebas/correr.js tlote tcurvas   # solo algunas
```

Hacen falta **dos servidores levantados**, y se caen entre sesiones:

```bash
# el estático, SIEMPRE desde la raíz del repositorio
(setsid python3 -m http.server 8199 &)
# el motor, en 8787
(cd /home/user/urbis-motor && setsid node servidor.js &)
```

Ojo con levantarlos con un `cd` encadenado: el directorio queda cambiado y el
estático termina sirviendo la carpeta del motor. Se nota porque
`curl localhost:8199/index.html` contesta 404 y todas las suites fallan
igual que si el motor estuviera caído.

**El puerto 8199 no es negociable.** El motor solo acepta peticiones de unos
orígenes conocidos y ese es uno; desde cualquier otro, el navegador se queda
sin respuesta y los análisis salen vacíos sin decir por qué.

Si de golpe fallan cuarenta suites con «Cannot read properties of null», casi
siempre es el motor caído, no una regresión.

## El motor

Vive en un repositorio privado aparte (`../urbis-motor`). Las reglas de
clasificación NO se sirven al navegador: eso es lo que se vende. Para
cambiarlas: editar `motor-reglas.js`, correr `node construir.js`, y
**reiniciar el servidor**. `revisar.js` comprueba que ninguna regla se haya
colado en un archivo servido.

## Secretos

Nunca en el repositorio, ni en capturas, ni en el chat: `URBIS_SECRETO`, las
licencias, el `.keystore`. La huella SHA-256 de firma sí es pública.

## El límite de Overpass

Cinco segundos entre consultas, y lo rechaza sin avisar bonito. Cualquier
cadena que pida dos cosas seguidas tiene que esperar. En las pruebas eso son
los `await esperar(5200)` que parecen de más y no lo son.

## Las pruebas se aprietan, no se aflojan

Cuando una falla por un cambio legítimo, se hace más precisa: se busca por la
acción y no por la clase, por la cabecera y no por el texto de toda la hoja.
Aflojar una aserción para que pase es perder la prueba entera y no enterarse
hasta meses después.
