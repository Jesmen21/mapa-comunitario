# Módulo EMPRESAS (comercial) · notas de la sesión

Acá van las notas de este módulo, por el punto 4 de
`herramientas/COORDINACION-MODULOS.md`: **lo propio de un módulo no va en
`CLAUDE.md`**. Las ocho reglas comunes están allá, escritas una sola vez y por
la cabeza.

Rama: `claude/admiring-pasteur-32vzed`. **Esta sesión no sube el token de
versión** (punto 4 del protocolo): lo pone la cabeza al integrar.

## Qué es, y qué archivos son suyos

Análisis de viabilidad de proyectos para constructoras e inversionistas. La
idea es de **Miguel Peñaranda** (socio del lado de negocios); Daniel la puso a
prueba y sigue afinando la precisión. Es el módulo donde la lógica de «socio
por módulo» ya corre.

`analisis-ia.html` con `js/56`, `57`, `58`, `59`, `61`, `62`, `63`, `66`, `67`
y `69`.

**`js/61-analisis-ia-datos.js` es de este módulo y el educativo lo llama 28
veces** desde `js/68` y `js/64` (medido por la cabeza el 23 de octubre de
2026). Se puede cambiar **avisando antes**; el educativo no lo cambia.

Y hay una superficie del educativo DENTRO de un archivo propio: `js/63` compone
los dos informes —`cuerpoEmpresa()` y `cuerpoEdu()`— y varias funciones las
comparten. Un arreglo en una función compartida llega a los dos informes, y eso
se declara antes de hacerlo.

## La preocupación que decide los canjes

> **Si el informe se contradice con lo que se ve en el mapa, la gente que
> conoce la zona deslegitima el análisis.** Cualquier cifra o conclusión debe
> poder defenderse frente a alguien de la zona. Si un dato no es verificable,
> se marca así; no se maquilla.

## Decisiones vigentes de producto (de Daniel, 23 de octubre de 2026)

* Producto **aparte de DM Studio**; no se trata como parte del estudio.
* **Los POI se quedan en OpenStreetMap vía Overpass.** Google Places queda
  descartado por ahora. Medido antes de decidir: cero coincidencias de
  `Google Places`, `googleapis.com/place` y `places.googleapis` en el
  repositorio entero — el módulo nunca usó Places, así que no hay nada que
  reescribir. Importa para la credibilidad: todo el informe está redactado
  sobre «lo mapeado» («cero no es “no hay”»), y ese encuadre solo es honesto
  con OSM.
* **Marca de agua en salidas de versión paga: POSPUESTA** hasta que existan
  planes de pago definidos. Hoy el informe lleva logo en la cabecera
  (`js/63`, `cabecera()`), no marca de agua.
* **Supabase es el destino de la plataforma** y este módulo migra por etapas
  **después** de Visión Territorial. Medido: cero referencias a Apps Script o
  Supabase en los cinco archivos del núcleo (`js/61`, `62`, `63`, `66`, `67`),
  así que **este módulo no tiene base de datos propia que migrar**: sus cifras
  salen de Overpass, `ags.esri.co` (censo DANE por manzana), LocationIQ,
  Open-Meteo y `api.urbispro.city` (el motor). Lo único con estado de servidor
  son las licencias y el cupo, que viven en el motor.

## De dónde sale cada cifra, y qué no se puede verificar desde acá

Ya está declarado y vigilado por `revisar.js`, y conviene no volver a medirlo:

* `METODO_AIA` (v1045) declara tres campos —de dónde sale, quién la calcula,
  qué NO es— para **31 paneles**; 6 más no publican cifra. **37 identificadores
  en total.**
* Reparto: **19 los calcula el motor**, cuya fórmula vive en el repositorio
  privado y **no está en este contenedor**; **6 traen cuenta local comprobada
  contra su archivo**; el resto se toman tal cual de la consulta.
* `ESCALA_AIA` (v1043) rotula los 40 paneles con la escala a la que están
  medidos, y los 6 sin cifra dicen por qué no la llevan.
* **Cuatro vacíos obligatorios** con su trámite completo (`VACIOS_AIA`, v1046):
  uso del suelo, registro mercantil, aforo de tránsito y estratificación
  vigente.

## v1164 · el informe dejó de contradecirse consigo mismo

Lo pidió Daniel como primera tanda, con los tres defectos juntos y una
inyección fiel por aserción.

**El defecto.** La sección 1 del informe imprimía `SIN MEDIR` y se negaba a
publicar el score de viabilidad con la capa del radio vacía; la sección 2
—cuatro líneas después, en el MISMO papel— publicaba «Flujo peatonal 7/100».
El discriminante venía en el mismo objeto (`capaVaciaAIA` y `f.avisoDatos`, que
`bloqueFlujo` y `bloqueClave` ya leían) y `seisDatos` no lo miraba: **la clase
A**, y la cura no toca el motor.

Medido antes de cambiar, que es lo que Daniel pidió: **`seisDatos` tiene
exactamente dos llamadas**, las dos en `js/63` —`cuerpoEmpresa()` (línea 2276)
y `cuerpoEdu()` (2378)—, así que **el arreglo alcanza también al informe del
curso**. Se hizo en UNA función a propósito: con una rama por informe serían
dos verdades sobre el mismo hecho (clase B) y la mentira se quedaría en una de
las dos pantallas.

**Los tres estados, porque piden acciones distintas** (v899): la cifra está y
se publica; el campo no vino y sale `SIN MEDIR`; la capa está vacía y sale
`SIN MEDIR` con la razón que el propio discriminante devolvió.

**Y a quién NO se le aplica, que es la mitad que discrimina:** solo a los dos
flujos. `capaVaciaAIA` cuenta usos, comercio y competidores, y el flujo lo
modela el motor a partir de los usos. Las vías arterias y las paradas salen de
la **traza**, que es otra consulta: cero usos mapeados no implica cero vías, y
marcarlas sería un falso positivo. Habitantes sale del censo DANE, que tampoco
depende de los usos. Hay una aserción que se pone roja si alguien se las aplica.

**La contradicción interna de la misma función.** Protegía
`s.movilidad && s.movilidad.flujo` en una línea y dieciséis líneas después leía
`s.movilidad.nViasArterias` a pelo: dos codificaciones de «¿puede faltar?» en
la MISMA función. Cuál de las dos tenía razón **no se puede medir desde este
contenedor** —`stats.movilidad` lo produce enteramente el motor; cero
referencias en los archivos servidos— así que se resolvió por la v880: falla
cerrado.

### El papel, compuesto y leído

Obligatorio al cerrar. La banda se compuso en node sobre seis casos fabricados
(v970) y se leyó el texto que sale:

| Caso | Qué salió |
|---|---|
| todo puesto | `62 / 100 · Flujo peatonal · Alto` |
| **capa vacía** | **los dos flujos en `SIN MEDIR`** con su razón; usos `0` (es el dato) y vías `3` sin marcar |
| el motor avisa poco mapeada | la cifra **con su ⚠️ al lado**, como el panel de flujo |
| **sin `movilidad`** | **no revienta**: cuatro baldosas `SIN MEDIR` |
| flujo en **cero medido** | `0 / 100 · Muy bajo` — se publica, que es un hallazgo |
| campos de flujo **ausentes** | `SIN MEDIR` |

Leer el papel también evitó una falsa alarma: la primera lectura parecía
imprimir `4,521` habitantes —coma de miles, que en castellano está mal— y
medido directo `numEs(4521)` da `4.521`. Era un artefacto del medidor, no del
papel. **Se comprobó antes de reportarlo.**

### Demostrado en rojo

Nueve inyecciones, **todas ROJO**, con el arnés de tres estados (v1090):
`ROJO`, `VERDE` y `MURIO`, porque una inyección que mata la corrida no es una
guarda que mordió.

La primera es **el estado fiel de la v1163** —la función entera como estaba— y
puso rojas **siete** de las ocho aserciones a la vez. Las otras ocho son
quirúrgicas, una por aserción.

**Dos salieron mal la primera vez, y eso es lo que las hace servir:**

* la inyección del discriminante salió **VERDE**, y la guarda tenía razón:
  `const vacia = capaVaciaAIA(r);` existe **cinco veces** en `js/63` y el
  `replace` cambió la primera, que está en `bloqueEjecutivo` — otra función.
  Corregida con su **entorno** (v1116), muerde.
* la del falso positivo **MURIÓ**: su ancla iba sin tilde y el código la lleva.

Y de paso quedó comprobado que **la guarda ajena de la v1044 sí muerde**: con
el discriminante de `bloqueEjecutivo` roto, nombra el panel exacto
(`bloqueViabilidad`). No hacía falta tocarla.

### Lo que esta versión NO hace

* **No arregla los otros dos sitios de `js/63` que leen `movilidad` a pelo**, y
  son el mismo defecto de clase en otras dos funciones: `panelCalor`
  (línea 680, `r.stats.movilidad.flujo.mapaCalor`, tres niveles sin guarda) y
  `bloqueClave` (línea 1660, `const s = r.stats, m = s.movilidad, f = m.flujo
  || {}`, que revienta si `m` falta). **Con `movilidad` ausente el informe
  completo sigue cayéndose en `bloqueClave`**, así que el arreglo de esta tanda
  deja la banda en pie y no el informe entero. Se midió al componer el papel,
  no leyendo el código. Queda por decisión de Daniel y por la regla 5 —un
  cambio por peldaño, medido—. `pendiente`
* **No escribe la lista viva del módulo**, que es la tanda siguiente en el
  orden que Daniel fijó. Hoy solo hay dos listas vivas vigiladas
  (`LISTA-VIVA-PLIEGO` y `LISTA-VIVA-VT`) y Empresas no tiene la suya, así que
  lo que le falta vive en secciones de `BITACORA.md` que nada compara contra el
  código — que es exactamente cómo envejecieron las otras cinco veces.
  `pendiente`
* **No mide si los porcentajes del motor llegan fraccionarios.** Pendiente
  desde la v1038 y repetido en la v1042 y la v1044: el riesgo está cerrado
  —todo pasa por el formateador— y la medición pide el motor. `pendiente`

### Lo que NO se pudo correr

**Ninguna suite de navegador.** Faltan `node_modules` —npm sí alcanza el
registro: playwright 1.64.1— y falta `../urbis-motor`, que es el repositorio
privado y Daniel dejó dicho que **no se trae todavía**. Es una limitación de
medición del contenedor y no trabajo aplazado. Por la regla 2, **nada de este
módulo se publica** mientras la batería de navegador no corra.

De las diez suites rojas y dos caídas de la §18 de `DECISIONES-PENDIENTES.md`
—deuda heredada del educativo—, tres tocan este módulo: `tmasanalisis`,
`tpisos` y `tplantas`. Y de las tres que componen el informe ejecutivo
(`construirHTMLEjecutivo`), `tpdf` está entre las rojas.
