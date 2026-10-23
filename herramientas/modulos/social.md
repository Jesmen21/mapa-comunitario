# Módulo SOCIAL · notas de la sesión · rama `claude/dreamy-meitner-fc5txm`

Lo propio de este módulo. Lo que obliga a todas las sesiones está en
`CLAUDE.md` y lo escribe la cabeza; el reparto entre sesiones, en
`herramientas/COORDINACION-MODULOS.md`.

**Qué es el módulo.** Salió de Reportes/Eventos como complemento y es el
extremo más casual de URBIS: estética informal, con emojis. Lo componen el
modo runner (URBIS Rush), los minijuegos, Patitas URBIS, el chat de la
plataforma y la orientación comunal —que Daniel todavía no definió y por eso
NO se construye ni se enseña—.

## Qué hay, medido el 23 de octubre de 2026

| Pieza | Dónde vive | Estado |
|---|---|---|
| Modo runner (móvil) | `js/20` + `js/46` + `js/48` · 5 pantallas | completo: GPS en vivo, 4 actividades, recorte del tramo en carro, replay, foto compartible, récords, racha, mapa de calor, reto en km |
| Social Rush | `js/20:2104` | publica contra Apps Script; sus filas se apartan del mapa por `esMeta` en `js/12` |
| Amigos y ubicación | `js/12` + `js/78` | ID URBIS privado, búsqueda, ubicación solo con permiso y con vencimiento |
| Chat | `js/12:3305-3520` | Apps Script, hoja `chat_urbis`. Sondeo de **5 s** con conversación abierta y **15 s** el contador |
| Minijuegos | `js/12:2286+` | UN juego real, «Reflejos Urbanos» (30 s), con tabla de líderes global firmada con token |
| Patitas URBIS | `js/45` | escrito y funcionando, pero en «Próximamente» y fuera del APK ciudadano, por decisión de Daniel |
| Logros | `js/16` | 92 definidos · **34 alcanzables** · 58 en pausa |
| Orientación comunal | — | **no existe**, y no se construye hasta que Daniel la defina |

Peso del módulo: 5.427 líneas entre JS y CSS propios (medido antes de esta
tanda).

## Las llaves de almacenamiento del módulo

```
urbis_mobile_runner_history_v56   el runner MÓVIL, que es el que manda
urbis_runner_history_v2           el runner de ESCRITORIO, escondido desde el 23-oct
urbis_sport_profile_v1            perfil de la rutina deportiva (NO es el runner)
urbis_sport_activities_v1         actividades de la rutina deportiva
urbis_runner_reto_km              la meta en km de js/48
urbis_mascotas_animales_v2        Patitas: los peluditos
urbis_mascotas_mensajes_v2        Patitas: el muro
urbis_achievements_v1_<usuario>   logros desbloqueados
urbis_metrics_v1_<usuario>        los contadores de los logros
urbis_game_tap_best               récord del minijuego de reflejos
urbis_presencia_v1                ubicación compartida con amigos
```

Se retiró `urbis_mascotas_aportes_v2` con la donación. **No se borra del
teléfono de nadie**: simplemente dejó de leerse y de escribirse.

## Lo que esta tanda hizo, y por qué

Las cuatro correcciones que Daniel decidió el 23 de octubre.

### Patitas no cobra y no dice haber recaudado

«Confirmar mi donación» guardaba el monto en `localStorage` y contestaba *«Su
aporte de $X ayuda a un peludito»*. No había pasarela, ni cuenta, ni
transferencia: **agradecía un aporte que nadie cobró**. Salió la superficie
entera y no solo el botón, porque era mucho más que un botón: la sección de
donar con sus cuatro montos, los tres métodos de pago con números de relleno
(«3001234567 · configure su número»), la baldosa «Recaudado con usted», el
botón «Apadrinar» de cada ficha y la barra «recaudado / meta».

Dos cosas que la medición cambió respecto de lo que parecía: la barra de meta
**ya estaba muerta** —el formulario escribe siempre `meta: 0`— y `m.ayudados`
no lo leía nadie. 435 → 339 líneas.

No se marca como simulación y no se conecta ningún pago: las dos cosas las
dijo Daniel. **Volver a poner la donación es decisión suya, no de una tanda.**

### 58 de los 92 logros están en pausa

De 92 logros publicados, 58 leían un contador que **ninguna línea de la
aplicación incrementa**: hay siete sitios de escritura en todo `js/`. No
estaban rotos, eran imposibles, y el perfil prometía 92 premios teniendo 34.

Se ocultan y no se borran, y cada uno vuelve el día que exista su función. El
estado **se calcula**: se declara qué métricas tienen quien las escriba —eso
es un hecho del código— y de ahí se deriva qué logro es alcanzable, leyendo su
propia condición. Una bandera `oculto: true` por logro sería una cifra
tecleada envejeciendo sola, y habría que acordarse de bajarla 58 veces.

Y el escondite **se dice en pantalla**, con las dos redacciones: una
comprobación desactivada en silencio se lee igual que un aprobado.

**Corrección a lo que esta misma sesión reportó antes:** eran 92 y no 82. El
bloque `EXTRA_TIERS` añade diez logros con el nombre de la métrica en una
variable de cierre, así que un barrido por `make(` no los ve. Ahora ese nombre
viaja como dato (`metrica`), que es lo que permite medirlos.

### El runner de escritorio, escondido

Hay **dos** runners en la misma aplicación, cada uno con su historial, y nunca
se sincronizan. Peor: el replay de `js/46` y las estadísticas de `js/48` leen
**solo** el del móvil, por `window.urbisRunnerLoadHistory`. Quien corriera
desde el escritorio no aparecía en sus propias cifras.

Se esconde el RUNNER, no el módulo de Deporte: la rutina adaptativa, el perfil
y el registro de actividades **no están duplicados** y siguen igual.

Se cierran las **dos** puertas —la tarjeta con `hidden`, que también la saca
del foco del teclado y del lector de pantalla, y la función que la abría, que
se niega—, porque esconder solo el botón lo deja abierto por consola. Y se
esconde desde `js/17` y no desde `index.html`, que es un archivo compartido.

**No se borra nada.** Los recorridos de `urbis_runner_history_v2` siguen en el
teléfono de quien los hizo, y borrar el código que los lee los dejaría sin
lector antes de que nadie decida qué hacer con ellos. Borrar lo confirma
Daniel.

## Lo que sigue pendiente, con su estado

* **Orientación comunal** — Daniel no la ha definido. No se construye ni se
  enseña. `pendiente`
* **Agrupar las cuatro piezas bajo Social** — decidido por Daniel, y va
  DESPUÉS de las correcciones. `pendiente`
* **Borrar el runner de escritorio** — escondido y medido; borrarlo espera
  confirmación de Daniel. `pendiente`
* **Patitas vive entera en `localStorage`** — el muro, los peluditos y las
  fundaciones solo los ve el dueño del teléfono. Un «muro comunitario» que no
  comparte nada es una promesa que la pantalla no cumple, y arreglarlo es
  decidir dónde viven esos datos. `pendiente`
* **Un solo minijuego** — el arcade dice «Más juegos pronto» y hay uno.
  `pendiente`
* **Cero suites miden Patitas o el arcade libre** — las 121 suites no tocan
  ninguna de las dos. `pendiente`
* **El chat a Supabase** — Daniel lo puso de ÚLTIMO en el orden acordado, y
  antes hay que medir el límite de conexiones simultáneas del plan gratuito.
  **No se puede medir desde este contenedor**: no hay proyecto de Supabase en
  el repositorio —el único Postgres es el de Visión Territorial— y el proxy no
  sale a la red. `pendiente`

## Lo que es de OTRAS sesiones, y se reporta sin tocar

* **El precaché del service worker** (`service-worker.js`, compartido). El
  diagnóstico medido está en el reporte a Daniel y a la cabeza.
* **27 de los 58 logros en pausa no son de este módulo**: Eventos 11,
  Exploración 6, Perfil 6, Bienestar 3, Educativo 1. Quedan ocultos por la
  misma regla, y sus contadores los tiene que escribir el módulo dueño.

## Trampas de este módulo que ya costaron algo

* **`urbisRecordMetric` lleva R mayúscula.** Un `grep` de `recordMetric(` no
  ve seis de los siete sitios de llamada. Costó dos mediciones mal hechas el
  mismo día, y después una guarda que acusaba de inventadas a seis métricas
  que sí tienen quien las escriba.
* **Un `git checkout --` restaura a HEAD, no a tu trabajo.** Un arnés de
  inyecciones que restaure así **borra los cambios sin commitear**. Pasó el 23
  de octubre y costó rehacer tres archivos: `js/45`, `js/16` y `js/17`. La
  regla es de una línea: **se commitea ANTES de inyectar**, y la corrida con
  el árbol limpio va al final del arnés justamente para delatarlo —fue la que
  lo delató—.
* **Medir el nombre de una métrica recogiendo toda cadena de la llamada
  acusa al ternario.** En `urbisRecordMetric(userRole === 'gov' ? 'govMode…' :
  'eduMode…', 1)`, el `'gov'` es un rol y no un contador. Cuenta el primer
  argumento, y dentro de un ternario solo sus ramas.
