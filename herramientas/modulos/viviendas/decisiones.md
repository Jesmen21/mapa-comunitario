# URBIS Viviendas · registro de decisiones

Lo que Daniel decidió, con su fecha, su razón y lo que ata. **Lo decidido acá
no se vuelve a preguntar**; si una sesión cree que algo debe cambiar, lo anota
con su medición y se lo pregunta a Daniel (regla 8).

**Dónde vive este archivo.** Su lugar es `docs/decisiones.md` del repositorio
privado `urbis-viviendas`, que todavía no existe. Mientras tanto está en la
rama `claude/fervent-allen-74qgwm` de `mapa-comunitario`, en
`herramientas/modulos/viviendas/decisiones.md` (sin la carpeta `docs/`,
porque el `.gitignore` de `mapa-comunitario` ignora toda carpeta con ese
nombre). **Es el primer archivo
que se copia al repositorio nuevo**, tal cual, en su primer commit. Desde ese
commit la copia de acá se retira, porque dos copias de un registro de
decisiones se separan solas (clase B).

Cómo se agrega una decisión: fecha (hora de Colombia), qué se decidió, por
qué, qué ata en el código o en los datos, y qué queda abierto. Lo que reemplaza
a una decisión anterior lo dice, y la anterior se marca como reemplazada; no se
borra.

---

## 2026-10-23 · Primera tanda (antes del prompt v3)

| # | Decisión | Estado |
|---|---|---|
| 1-01 | Módulo propio, con tipo de fila y permiso `viviendas` en la hoja de la Vitrina | **reemplazada** por 3-01 |
| 1-02 | Almacén: la hoja de la Vitrina, transitorio | **reemplazada** por 3-01 |
| 1-03 | Dirección pública aproximada (cuadra o barrio); exacta solo tras contacto | vigente; la implementa la migración 005 |
| 1-04 | Primero VENTA; arriendo después con el mismo modelo | vigente; `operacion` entra en la migración 001 |
| 1-05 | Publica solo Daniel y quien él autorice; nada de terceros | vigente; la migración 002 exige rol para toda escritura |
| 1-06 | Rama `claude/fervent-allen-74qgwm`, sin salto de versión de URBIS | vigente para lo que quede en `mapa-comunitario` |
| 1-07 | Modelo: puntero al análisis, fortalezas con base o razón sin base, cada cifra con su origen, aviso de procedencia | vigente; pasa a SQL en las migraciones 010 y 011 |

## 2026-10-23 · Segunda tanda: el prompt v3 y la Fase 0

El prompt v3 pide un proyecto aparte, sobre Supabase, con dos aplicaciones.
La Fase 0 es solo planear. La propuesta está en
`herramientas/modulos/viviendas/FASE-0-propuesta.md` de `mapa-comunitario`.

## 2026-10-23 · Respuestas de Daniel a la Fase 0

### 3-01 · Los datos van en Supabase, proyecto `urbis-viviendas`

**Decisión.** Supabase, proyecto `urbis-viviendas` (ref
`nwquxpzrwvsrptfvarhi`, us-east-1, organización URBISPROCITY). **No** la hoja
de la Vitrina.

**Razón (de Daniel).** Hace falta PostGIS para las distancias por radio,
permisos por fila y la ubicación oculta. Una hoja no da ninguna de las tres.

**Qué ata.**
- Reemplaza 1-01 y 1-02.
- El primer peldaño, escrito para la hoja, **se retiró** el 2026-10-23: el
  esquema `83-viviendas.js`, su arnés de inyecciones y su bloque de
  `pruebas/revisar.js`. Sus cuatro reglas (SIN MEDIR, procedencia, fortaleza
  con base, punto público aproximado) pasan a SQL en las migraciones 005,
  010 y 011.
- **Pedido a la cabeza de URBIS**, porque son archivos compartidos: retirar la
  excepción de Viviendas en la hoja (decisión 9 de
  `herramientas/DECISIONES-DANIEL.md`, la entrada `viviendas` de
  `js/03h-registro-modulos.js` con `backend: 'hoja'`, y su renglón en
  `TRANSITORIOS` de `pruebas/revisar.js`).
- Nunca se envía información personal a la capa de mapeos de URBIS.

### 3-02 · Las imágenes van en Cloudflare R2

**Decisión.** Fotos, miniaturas y panorámicas en R2, servidas por dominio
propio. Nunca `r2.dev` en producción.

**Razón.** El egreso de R2 es gratis. Las transformaciones de imagen de
Supabase son solo del plan Pro. El bucket `viviendas-fotos` de Supabase se
retira (migración 014, después de comprobar que está vacío).

**Qué ata.** Las llaves de R2 viven solo en funciones del servidor, jamás en
el navegador ni en el repositorio. Las subidas usan URL prefirmadas.

### 3-03 · Acceso a Supabase: un token personal, guardado fuera de git

**Decisión.** Daniel crea un token de acceso personal con los permisos
mínimos. En su máquina va en `.env.local`, ignorado por git. El repositorio
lleva un `.env.example` con los nombres y sin valores. **Nunca se piden claves
por el chat.**

**Lo que midió la sesión al preparar los pasos, y que cambia el cómo:**
- **Un token personal de Supabase no se puede limitar** a un proyecto ni a
  solo lectura: alcanza toda la cuenta, según dos guías independientes. El
  límite por proyecto y la solo lectura se ponen en el servidor MCP, no en el
  token. Por eso el token se crea **en la cuenta que tiene URBISPROCITY y
  nada más**, con vencimiento si el formulario lo ofrece, y se revoca al
  terminar la Fase 1.
- **El contenedor de la nube no lee un `.env.local`.** El secreto entra como
  secreto o variable del entorno de la nube, con el nombre
  `SUPABASE_ACCESS_TOKEN`, y lo ve una sesión nueva, no la que está abierta.
- **La red del entorno rechaza hoy** `api.supabase.com` y
  `nwquxpzrwvsrptfvarhi.supabase.co` (medido: el proxy contesta 403 a los
  dos). Sin agregarlos a los dominios permitidos, el token no sirve.
- El conector de Supabase de las sesiones está autorizado en **otra cuenta**,
  la de `vayayvuelva`, que no se toca. Ese conector no sirve para este
  proyecto.

**Cómo quedó, el mismo día.** Daniel conectó el conector de Supabase de la
sesión a la cuenta de URBISPROCITY. Medido después: el conector ve **un solo
proyecto, `urbis-viviendas`**, y ya no ve `vayayvuelva`. La Fase 1 trabaja por
ese conector, así que **no hay ningún token en el contenedor ni en el
repositorio**. El token personal queda solo para la máquina de Daniel, en su
`.env.local`, si algún día corre la CLI de Supabase desde ahí.

**Medido al entrar por primera vez a la base viva** (solo lectura), lo que el
archivo SQL no mostraba:
- `anon` y `authenticated` tienen **todos** los permisos de tabla en las cinco
  tablas, incluidos TRUNCATE, TRIGGER y REFERENCES, que la seguridad por fila
  no frena. Es el permiso por defecto de Supabase. Lo cierra la migración 002,
  que ya estaba aprobada con la regla «toda escritura exige rol».
- La función `rls_auto_enable()` corre con los privilegios de su dueño y
  `anon` la puede ejecutar. Devuelve `event_trigger`, así que no se puede
  invocar por la API, pero el auditor de Supabase la marca. Se le quita el
  permiso de ejecución.
- Las dos casas de ejemplo están **publicadas hoy** con su coordenada abierta:
  una con 4 decimales (unos 11 m) y otra con 3 (unos 110 m). Son de ejemplo,
  pero es la falla 1 viva. La cierra la migración 005.
- Ninguna migración registrada: el esquema entró por el editor de SQL. La
  Fase 1 empieza el historial de migraciones.

### 3-04 · Repositorio nuevo `urbis-viviendas`

**Decisión.** Lo crea Daniel en GitHub, privado y vacío. Lleva la plataforma
pública, el panel de control y un paquete compartido.

**Qué ata.** La estructura de la sección 3 de la propuesta. El primer commit
lleva este archivo, `.env.example`, `.gitignore` con `.env.local`, y el
contrato de intercambio con la capa de mapeos.

**Cuándo se conecta la sesión.** Al empezar la Fase 1, que es cuando hay que
escribir las migraciones. Para eso la aplicación de GitHub de Claude tiene que
estar instalada en ese repositorio.

### 3-05 · La cifra de la Home se cuenta, nunca se escribe

**Decisión.** La frase de la Home sale de contar en la base las viviendas
publicadas de la pestaña activa. Por ejemplo, «5 viviendas en venta en Cúcuta»
en Comprar y «1 vivienda en arriendo en Cúcuta» en Arrendar.

**Razón.** La maqueta decía «7 viviendas en venta» con 5 en venta y 1 en
arriendo en los datos de ejemplo: una cifra escrita a mano que ya no cuadraba
con su propio contenido.

**Qué ata.** La cuenta la hace la misma consulta que llena la lista, sobre la
vista pública (migración 005). El singular y el plural se escriben los dos, y
también la redacción de cero («Todavía no hay viviendas en arriendo»). Las
tres maquetas de la Home se corrigieron el 2026-10-23.

### 3-06 · Aprobación parcial de la Fase 0

**Aprobado:**
- La parte de base de datos de la propuesta: las migraciones 001 a 014.
- Los arreglos de las siete fallas del SQL adjunto, con sus migraciones:
  1. la ubicación exacta abierta al público (migración 005, vista pública con
     el punto desplazado entre 80 y 150 m, determinista por id);
  2. la inserción sin control en `interesados` (migración 004);
  3. la fórmula del puntaje sin rastro (migración 010);
  4. la categoría como lista rígida de cuatro (migración 009);
  5. las viviendas de ejemplo sin marcar (migración 001, `es_ejemplo`);
  6. `actualizada_en` sin disparador (migración 001);
  7. `estado` y `publicada` leídos como uno (migración 005).

**Condición antes de gastar más en la Fase 1:** verificar con una segunda
fuente las cifras de costos y cuotas de Supabase (Free y Pro), Cloudflare R2
y el correo. El resultado está en el anexo C de la propuesta.

**La Fase 1 empieza cuando haya acceso a Supabase** y la verificación esté
hecha. Su reporte es un resumen de cinco líneas.

### 3-07 · Pendientes que se cierran antes de la Fase 2, no ahora

| Pendiente | Estado al 2026-10-23 |
|---|---|
| Framework de cada aplicación | sin investigar del todo |
| Librería de gráficas | sin investigar |
| Cuotas de Apps Script | sin investigar |
| Revisar las 6 maquetas que faltan (mapa, ficha, panel: resumen, finanzas, usuarios, línea de tiempo) | escritas, pasan el formato, sin revisar contra la especificación |
| Las tres paletas lado a lado, con recomendación | por hacer; el coral oscurecido a `#D1364F` está aprobado |
| Resumen de tres páginas de la propuesta, con el detalle como anexo | por hacer |

### Decisiones de la primera tanda que siguen abiertas

- **¿La administración aplica también en VENTA?** Un apartamento en conjunto
  cerrado paga administración aunque se venda. La migración 001 crea
  `administracion_cop` sin atarla a la operación, así que la columna sirve
  para las dos respuestas. Falta que Daniel diga si se muestra en venta.
