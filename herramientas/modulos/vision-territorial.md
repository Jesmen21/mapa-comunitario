# Visión Territorial · notas de la sesión del módulo

Rama `claude/adoring-tesla-s7c5ea`. Este archivo es lo que pide el punto 2 del
protocolo (`herramientas/COORDINACION-MODULOS.md`): **lo propio del módulo no
va en `CLAUDE.md`.**

Lo que sí sigue en `CLAUDE.md` y **no se muda acá**: la sección «Visión
Territorial: la cuarta puerta, aparte» y su lista viva marcada
`LISTA-VIVA-VT`, que `revisar.js` vigila. Mudarlas dejaría una lista sin
guardar, que es peor que no tenerla porque parece vigilada (v868).

**Ningún valor de secreto se escribe acá.** Este repositorio se publica en
urbispro.city, así que lo que se teclee queda en internet (v1136). Van los
NOMBRES de las variables y nada más.

---

## El estado medido el 23 de octubre de 2026

| Qué | Medida |
|---|---|
| Cliente (este repositorio) | 1.939 líneas: `js/90-vt-app.js` 965 · `css/90-vt.css` 402 · `vision-territorial.html` 126 · `sw-vt.js` 58 · `manifest-gobierno.json`. 11 pintores de pantalla |
| Motor (repositorio privado `Jesmen21/urbis-motor`, carpeta `vt/`) | 3.284 líneas en 13 archivos · `esquema.sql` 572 líneas · **13 tablas** · 10 rutas `/vt/*` incluida `/vt/hoja.pdf` |
| Pruebas | `pruebas/suites/tvision.js` 388 líneas (navegador) + **111 aserciones** en las tres suites del motor: `probar-vt` 31, `probar-rutas` 51, `probar-hoja` 29 |
| Supabase | el proyecto de URBIS **todavía no existe**; medido: la organización está en plan `free`/`tier_free` con 1 proyecto activo, y la documentación de Supabase da **dos** proyectos en ese plan, así que el segundo es $0 |

Decisiones de producto vigentes (Daniel, 23 oct): nace en Supabase; geometría
PostGIS con sistema de coordenadas declarado; copia de umbrales por corrida;
DANE como llave; uuid al azar; fechas con zona; consultas parametrizadas;
fuentes SECOP y capas Esri del municipio con permiso; efectos visuales que
bajan de calidad en gama baja y no se eliminan.

Lo que de eso **ya estaba cumplido** al medir el esquema: `geography(…,4326)`
en 8 columnas, 10 `gen_random_uuid` y 0 `serial`, 26 `timestamptz` y 0 sin
zona, `umbrales_usados` con el `CHECK` que impide una corrida terminada sin
copia, FK al DANE con único por territorio activo, `set_config` con `$1`, y la
adaptación por capacidad del dispositivo en `js/90-vt-app.js` (tres niveles por
`prefers-reduced-motion`, `hardwareConcurrency` y `deviceMemory`).

Lo que **no existe, cero líneas**: lectura de capas ArcGIS/Esri del municipio,
ingesta de SECOP —solo hay una columna `secop_ref` en `vt.propuestas`—, y
carga de archivos del municipio (KMZ, shapefile, multipart).

---

## El bloqueo de Supabase, y por qué son DOS cosas y no una

Medido contra un proyecto Supabase real, leyendo el catálogo:

* el `search_path` que incluye el esquema `extensions` —donde Supabase pone
  PostGIS— está puesto **por ROL y no por base**: en `pg_db_role_setting`
  cuelga de `postgres` y de `supabase_admin`, y a nivel de base solo hay
  `app.settings.jwt_exp`. Un rol recién creado nace sin él;
* y el esquema `extensions` **no le da `USAGE` a PUBLIC**: sus permisos son
  explícitos rol por rol. Lo **posee `postgres`**, que es justo el rol con el
  que se corre `vt/roles.sql`, así que `postgres` sí puede concederlo.

**Demostrado en rojo contra una copia fiel** —PostGIS en `extensions`, los dos
roles sin `search_path`—: `migrar.js` muere con `type "geography" does not
exist` y deja **0 tablas**. Con la cura, la misma base y el mismo esquema dan
**13 tablas** con RLS habilitada y **forzada en las 13**.

La cura vive en `vt/roles.sql` y no en `esquema.sql`, por tres razones medidas:
un `SET search_path` dentro del esquema arreglaría la migración y no el
servidor —`vt_app` llama a `ST_*` en cada corrida—; `vt_migrador` no es
superusuario ni tiene `CREATEROLE`, así que no puede dárselo ni a sí mismo;
y un rol que nace sin su camino a PostGIS es una capacidad declarada que no
existe, mientras que naciendo juntos no pueden separarse (clase B).

Una cosa que quedó **verificada y conviene no volver a sospechar**:
`CREATE EXTENSION IF NOT EXISTS postgis` corrido por `vt_migrador`, que no es
superusuario, **pasa limpio** cuando la extensión ya está instalada en otro
esquema. La comprobación de existencia va antes que la de privilegio.

---

## La copia fiel a Supabase, en local

Sirve para medir el camino de Supabase sin tocar Supabase, y es lo único que
este contenedor puede hacer: el proxy **niega** `api.urbispro.city` y todo
dominio externo (`CONNECT tunnel failed, response 403`).

La diferencia con la receta de `CLAUDE.md` es una sola línea —PostGIS en el
esquema `extensions` y no en `public`— y es la que hace aparecer el fallo:

```bash
apt-get update && apt-get install -y postgresql-16-postgis-3   # no viene puesto
service postgresql start
su postgres -c "psql -c 'CREATE DATABASE urbis_vt_supabase_fiel OWNER vt_migrador'"
su postgres -c "psql -d urbis_vt_supabase_fiel -c \
  'CREATE SCHEMA extensions; CREATE EXTENSION postgis SCHEMA extensions; \
   CREATE EXTENSION pgcrypto SCHEMA extensions;'"
su postgres -c "psql -d urbis_vt_supabase_fiel -f vt/roles.sql"   # trae la cura
```

Y las suites se apuntan a esa base con `VT_PRUEBAS_URL_MIGRADOR` y
`VT_PRUEBAS_URL_APP`; el valor local de las contraseñas está en `vt/roles.sql`
y no acá.

### El defecto que esto encontró en la propia suite

`vt/probar-vt.js` leía la base de `VT_PRUEBAS_URL_APP` en todas sus consultas
**menos una**: la prueba del superusuario llevaba el nombre escrito como
literal, `psql -d urbis_vt_pruebas`. Dos codificaciones de un solo hecho
(clase B), que coinciden mientras nadie cambie de base y **se separan el día
que alguien apunta la suite a otra** — que es exactamente lo que hace la
migración a Supabase. El `DELETE` del literal caía en una base sin semilla,
borraba cero filas, el disparador no se disparaba y la aserción salía ROJA
sobre un esquema que estaba bien. Medido: 0 territorios en la base del
literal, 5 en la real. Ahora el nombre se deriva de la URL.

---

## Las variables de entorno, por dónde van

Ningún valor acá. Lo que hay que saber es **cuál va dónde**:

| Nombre | Quién la necesita |
|---|---|
| `VT_DATABASE_URL` | el **servidor** del motor. Conexión del rol `vt_app` |
| `URBIS_SECRETO` | el **servidor**, para firmar licencias con territorio |
| `VT_DATABASE_URL_MIGRADOR` | **solo** la máquina de quien migra. Rol `vt_migrador` |
| `VT_PRUEBAS_URL_MIGRADOR` · `VT_PRUEBAS_URL_APP` | solo las suites |
| `VT_BD_MAX` | opcional, tamaño del pozo de conexiones |

**Nunca la llave `service_role` de Supabase**: salta la RLS y la volvería
decorativa. Es la regla del esquema y hay dos comprobaciones que la vigilan.

---

## El motor ya sirve `/vt/*`: no hace falta un servidor nuevo

Medido en `servidor.js` del repositorio del motor: las rutas `/vt/*` las monta
el **mismo** servidor que sirve `/salud`, `/analizar` y `/geo`, y están
listadas en la respuesta de `/salud`. El `Dockerfile` ya copia `vt/` y la única
dependencia que VT añadió —`pg`— ya está en `package.json` y en el
`package-lock`. Es decir: el contenedor que se construye hoy **ya lleva Visión
Territorial**; lo que le falta es `VT_DATABASE_URL` en su entorno y un
redespliegue.

**Lo que no se pudo verificar desde acá, y queda anotado:** qué versión del
motor corre hoy en `api.urbispro.city` y si ya tiene esas variables. El proxy
de este contenedor niega el dominio, así que la comprobación es de quien pueda
abrirlo.
