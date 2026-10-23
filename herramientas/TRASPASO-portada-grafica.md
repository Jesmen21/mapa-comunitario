# Traspaso · la portada gráfica del módulo presidencial

Para la sesión que haga la **v1140**. Escrito el 21 de octubre de 2026 al
cerrar la v1139. Lo que sigue es lo que hace falta para no perder nada; lo
que no está acá, está en `CLAUDE.md` y en `BITACORA.md`.

---

## 1 · Dónde está el repositorio AHORA MISMO

**Esta sección estaba vieja y se reescribió el 23 de octubre de 2026.** Decía
que nada estaba publicado y que había que subir «solo hasta `3f6a7e1`»: las dos
cosas dejaron de ser ciertas. Se deja dicho porque es exactamente la forma que
este proyecto persigue —una lista honesta se vuelve vieja la primera vez que
alguien implementa algo (v868)— y porque una instrucción de publicación vieja
es de las que se obedecen sin volver a mirar.

**Lo medido hoy:**

* `3f6a7e1` (**v1138**, la paleta «Papel») **ya está en `origin/main`**, con
  todo lo anterior. Se publicó cuando Daniel dijo «súbalo».
* `b4e49f3` (**v1139**) y `c1978e0` (**v1140**, el texto en cinco pestañas)
  **también están en `origin/main`**.
* La rutina diaria —que es otra sesión y empuja varias veces al día— siguió
  encima y `origin/main` va por **v1161**.
* Lo único que la rama de trabajo tiene y `main` no son **tres commits de
  documentación**: la bitácora, la nota de la rutina y el texto para pegar.
  Ningún código.
* No hace falta ninguna rama nueva con «solo la paleta»: la paleta está
  publicada y la rama de trabajo nunca se fusionó en `main`.

> **LA REGLA DE PUBLICACIÓN, hoy:** se desarrolla en `main-r3g781` y se empuja
> a `main-r3g781`. **Nada va a `main` sin un «súbalo» explícito de Daniel**, y
> cuando lo diga, se trae `origin/main` primero —la rutina diaria escribe
> encima— y se comprueba la HISTORIA y no el mensaje de `git merge`.

**No se empuja sin un «súbalo» explícito.** Acá empujar ES publicar: `main`
sirve el sitio por GitHub Pages. El hook de git lo va a pedir en cada turno;
la respuesta es no, y se dice por qué.

---

## 2 · Las reglas de Daniel · no se negocian

Están todas en `CLAUDE.md` con su versión y su caso. Acá van las que esta
tanda va a tocar sí o sí:

* **Cero imputaciones penales sobre persona identificable.** Un tipo penal
  junto a alguien identificable solo va con su **estado procesal** al lado.
  La guarda cubre el eje D, el editorial y **los títulos de las entradas**
  (v1136) — y va a cubrir los títulos y etiquetas de los gráficos nuevos.
  Las exenciones son **por ítem**, con sus tres campos
  (`categoriaEstadistica`, `sinSujeto`, `razon`), nunca por regla, y se
  **nombran con su frase** en el panel de control.
* **Cero menores identificados.** Ni nombres, ni fotos, ni datos que los
  identifiquen. El cribado amplio y su guarda están en `revisar.js` (v1136),
  con seis clases de descarte declaradas. **Falla cerrado**: un nombre nuevo
  sale en rojo hasta que alguien lo lea y lo clasifique.
* **Sin trámites y sin abogados.** Una lista de pendientes registra
  **estados**, no tareas de terceros (v1122), y ningún pendiente espera una
  revisión de abogado: ese contenido no espera, sale (v1133).
* **Nada se borra.** Un caso que se cae **baja de estado**; borrar es
  esconder. Vale igual para el texto: moverlo a una pestaña no es quitarlo,
  y por eso existen las guardas del punto 4.
* **La regla de oro:** el sitio afirma **hecho, fecha, fuente y estado
  procesal**. Nada más.
* **Y el método:** toda tanda que cambie lo que se imprime **termina leyendo
  el papel** —componer la pantalla en el navegador y LEERLA—. Es el que más
  defectos reales ha encontrado acá, y ninguno se veía leyendo el código.

---

## 3 · Las decisiones ya tomadas · no se vuelven a abrir

* **Enlaces de pestaña con `#`**, no con `?`.
* **La portada NO recuerda la última pestaña.** El enlace abre lo que dice.
* **Por defecto abre los gráficos.**
* **Paleta «Papel»**, aplicada en la v1138: fondo blanco cálido, tinta casi
  negra, un acento azul pizarra. Sin ámbar ni naranja. La escala de niveles
  es **secuencial de un solo tono** y el peldaño va **escrito** al lado — el
  color nunca lleva el significado solo.

---

## 4 · Los seis conteos base, y cómo se miden

Medidos el 21 de octubre de 2026, **antes** de mover texto. Son el piso de la
guarda de la v1139 y **no pueden bajar**:

| Qué | Piso |
|---|---|
| Afirmaciones del editorial | **17** |
| Entradas (los dos registros) | **324** |
| Contrargumentos oficiales | **50** |
| Exenciones declaradas | **5** |
| Contradicciones | **15** |
| Casos | **14** |

Se miden así, y la guarda lo hace sola en cada corrida:

```js
afirmaciones    = analisisEditorial.afirmaciones.length
entradas        = A.entradas.length + B.entradas.length
contrargumentos = entradas con `contrargumentoOficial`, en los dos
exenciones      = entradas con `_noEsCalificacion` + afirmaciones con `_noEsCalificacion`
                  + bloques con `_noEsCalificacion`
contradicciones = A.contradicciones.casos + B.contradicciones.casos
casos           = A.casos.lista + B.casos.lista
```

Si alguno baja, `revisar.js` se pone **rojo**. Si bajó por una decisión
legítima —una entrada retirada—, el rojo es lo correcto: obliga a bajar el
piso a mano y a decir por qué. **Un piso que se actualizara solo no mediría
nada** (v903).

---

## 5 · El plan · tres versiones y qué comprueba cada una

### v1140 · Las pestañas, con el texto donde está
Se crean **«¿Qué ha pasado?», «Contradicciones», «Hoy», «Lo que yo leo» y
«Fuentes y método»**, cada una con enlace `#` compartible. El texto actual se
**mueve sin cambiar una palabra**. La portada sigue como hoy.

**Al cerrar comprueba:** los seis conteos **iguales**; la guarda de texto
inalcanzable en **verde**; y el papel leído en las cinco pestañas.

> **Acá es donde se pierde texto si se pierde.** Por eso va sola, sin
> gráficos, y con las guardas ya puestas.

### v1141 · La portada gráfica, solo con los datos que existen
Los gráficos que el registro sostiene, cada uno con **descripción para lector
de pantalla y tabla de datos**. El veredicto como **escala con su nivel y su
tope**, de un vistazo que es un **piso** y no el dictamen. Los sellos de
«falta evidencia» **sobre** su gráfico, no escondidos en una pestaña.

**Y pinta los cuatro bloques que hoy no alcanzan a nadie** (punto 6).

**Al cerrar comprueba:** los seis conteos; la guarda de inalcanzable con
**cero bloques** declarados sin pintar; la guarda penal sobre los títulos y
etiquetas de los gráficos; y el papel.

### v1142 · El cierre
Lo que la composición revele al leer el papel: densidad, celular, los sellos
que no se entiendan, y la cola de colores escritos a mano dentro de
`css/70-seguimiento.css` que la paleta no alcanza.

---

## 6 · Lo que está pendiente de pintar, y lo que NO se puede graficar

### Cuatro bloques declarados `_sinPintarTodavia`
Los encontró la guarda de la v1139 en su primera corrida. Cada uno lleva su
razón escrita en el registro; **el día que se pinten, el campo se retira** y
la guarda empieza a exigir que su texto llegue.

| Bloque | Qué texto no llega hoy |
|---|---|
| `presupuesto.deudaBruta` | `convergencia`, `noComparableCon`, `porQueLasOtrasCifrasDIFIEREN`, `fuenteCorta` |
| `publicacion.vetadasPorDefectoPropio` | el `defecto` de las **4** cifras que el módulo se vetó a sí mismo |
| `delitosAltoImpacto` | `salvedades` y las razones de la disputa de extorsión |
| `subsidios` | `salvedades` |

**Una precisión sobre la deuda, medida y no supuesta:** el «60,5 %» **sí se
publica hoy, y ya va con su medida y con su no-comparabilidad**, en la prosa
del eje C. Lo que no llega es el bloque **estructurado** que dice lo mismo.
Es por tanto **clase B** —dos codificaciones de un hecho— antes que clase C,
y lo correcto en la v1141 es que el pintor lea `deudaBruta` y **la prosa se
derive de él**, para que no puedan separarse. **No hay urgencia y no hay que
retirar ninguna cifra.**

### Gráficos que NO existen por falta de datos · no se inventan

| Pedido | Qué hay | Qué necesita |
|---|---|---|
| **Serie de deuda** | `deudaSerie` con **2 puntos** | ≥6 puntos trimestrales |
| **Aprobación como línea** | **una sola medición**, de una consultora que el registro marca con metodología cuestionada | ≥3 mediciones fechadas; con una sola, lo honesto es la cifra con su ficha |
| **Dólar** | 7 puntos | alcanza para una línea corta; cubre poco periodo |
| Bombardeos · cocaína | 2 puntos cada uno | ≥4 |

**Sí tienen datos desde la v1138:** delitos de alto impacto (6 filas +
acumulado, con la extorsión en disputa y sus **dos** cifras) y subsidios.

---

## 7 · Las trampas que ya se pagaron en esta tanda

* **Clases CSS que no existen.** Escribí la columna fija contra `.sp-esc`,
  `.sp-nav` e `.sp-indice`: **ninguna existe**. La rejilla real de la ficha es
  **`.sp-fi-rejilla`**. Un selector inventado no da error: simplemente no
  hace nada. **Se comprueba contra el DOM compuesto antes de usarlo.**
* **`--sp-amb` no estaba definido** y sus **ocho** usos caían al literal
  `#b26a00`, que sobre blanco da 4,24:1. Un `var(--x)` inexistente cae a su
  respaldo en silencio. **Un token se comprueba antes de usarlo** (v1050).
* **El ancho era `--max: 1120px`**, y por eso en un monitor de 1920 el módulo
  se veía como un celular estirado. La v1138 lo subió a **1320** en
  escritorio.
* **La columna recortaba el texto por la derecha** y no era el ancho: eran
  filas flex —`.sp-fi-firma`, `.sp-fi-placa-cab`— cuyos hijos nacen con
  `min-width:auto` y no pueden encoger. **Se midió el nodo que se desbordaba
  en vez de adivinar.**
* **`js/70-seguimiento.js` se sirve SOLO.** `seguimiento.html` no carga
  `js/00-config.js`, así que el módulo lleva su **propia copia** de los
  ayudantes de fecha (`FECHA_CO`). Son dos codificaciones de una decisión y
  hay una guarda que compara los dos cuerpos y se pone roja si se separan.
  **No se borra una sin la otra.**
* **Un medidor de contraste que ignora los degradados miente.** El primero
  miraba `backgroundColor` y un degradado vive en `backgroundImage`: daba
  falsos positivos sobre la tarjeta oscura. El bueno resuelve el degradado y
  normaliza el color dibujándolo en un canvas.
* **Las fechas de calendario se anclan a Colombia** (v1135): `hoyCO()` e
  `isoLocal()`. Ningún `toISOString().slice(0, 10)` nuevo — hay una guarda
  repo-ancha, con **una** exención nombrada (`js/61`, que habla con una API en
  UTC).

---

## 8 · Cómo se trabaja acá, en cuatro líneas

```bash
git fetch origin && git merge origin/main --no-edit   # con &&, y se comprueba la HISTORIA
(setsid python3 -m http.server 8199 >/tmp/srv.log 2>&1 &)   # SIEMPRE desde la raíz
node pruebas/revisar.js            # 794 verdes y 1 `?` al cerrar la v1139
```

`node pruebas/correr.js` **no corre** en este contenedor: falta
`../urbis-motor`. El proxy **niega todos los dominios**, así que el único
canal para datos es la búsqueda.

**El `?` es el mismo de siempre:** la guarda de rol de fuente de la v966, sin
material porque ya no quedan entradas con esquema antiguo. Es el estado bueno.

---

## 9 · El texto de arranque para la sesión nueva

> **GASTADO. El texto de abajo pedía la v1140 y la v1140 ya está hecha y
> publicada** (`c1978e0`, las cinco pestañas), igual que la v1139. Se conserva
> entero porque sus conteos base y su forma siguen valiendo, pero **no se pega
> tal cual**: los cinco commits que manda comprobar están hoy dentro de
> `origin/main`, y la rutina diaria siguió encima hasta la v1161.
>
> **Lo que de verdad sigue abierto es la v1141**, la portada gráfica, y
> necesita el visto bueno de Daniel antes de empezarse.

**La rama es `main-r3g781`.** Lo que tiene y `main` no son tres commits de
documentación; todo el código está publicado.

```
Continúo el módulo presidencial de URBIS.

ANTES DE TOCAR NADA, en este orden:

1. Cambia a la rama de trabajo y tráela:
      git fetch origin && git checkout main-r3g781 && git pull
2. Comprueba con `git log --oneline -5` que existen estos cinco commits,
   del más nuevo al más viejo:
      b35b979  Nota de traspaso para la v1140
      b4e49f3  v1139 · las guardas que se escriben antes de mover el texto
      3f6a7e1  v1138 · la paleta «Papel»
      f28b7b9  Guarda de contraste parametrizada y las tres paletas candidatas
      e0d3980  Registra los bloques de delitos de alto impacto y de subsidios
   Si alguno falta, PARA y dímelo: no sigas.
3. Lee COMPLETO herramientas/TRASPASO-portada-grafica.md. Tiene el estado
   del repositorio, mis reglas, las decisiones ya tomadas, los conteos
   base y las trampas que ya se pagaron.

Después haz la v1140 y SOLO la v1140: las cinco pestañas —«¿Qué ha
pasado?», «Contradicciones», «Hoy», «Lo que yo leo» y «Fuentes y
método»— con enlace #, sin memoria de pestaña, abriendo los gráficos por
defecto, y mueve a ellas todo el texto actual SIN CAMBIAR UNA PALABRA.
La portada se queda como está; los gráficos son la v1141 y no los
empieces sin mi visto bueno.

Al cerrar repórtame: los seis conteos antes y después (tienen que ser
iguales: 17 afirmaciones, 324 entradas, 50 contrargumentos, 5
exenciones, 15 contradicciones, 14 casos), la guarda de texto
inalcanzable en verde con su inyección, el papel leído en las cinco
pestañas, verdes y ?, y el veredicto en el piso.

No subas nada a main. Puedes subir a main-r3g781. Cuando yo diga
«súbalo» se publica lo que haya en main-r3g781, trayendo origin/main
primero.
```
