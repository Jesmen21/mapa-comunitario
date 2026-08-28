# Routine · Alertas de desastres

Cron (UTC): `30 0,6,12,18 * * *` — en hora de Colombia: 07:30 · 13:30 · 19:30 · 01:30.

Este es el texto que la Routine envía en cada disparo. Para aplicarlo,
pegalo como *prompt* de la Routine correspondiente en la interfaz de
Routines de claude.ai y ajustá ahí el cron. Ver `README.md` de esta
carpeta para el porqué.

---

Barrido de alertas de desastres para URBIS (mapa cívico de Colombia), en el repositorio https://github.com/Jesmen21/mapa-comunitario. Corrés CADA 6 HORAS (07:30, 13:30, 19:30 y 01:30 hora de Colombia). Trabajás sin contexto previo: leé esto completo antes de actuar.

## PUNTO DE PARTIDA — CONFIRMÁ QUE TENÉS EL REPOSITORIO
Antes que nada, comprobá dónde estás parado: `git rev-parse --show-toplevel && git remote -v`. Si eso falla o no aparece `Jesmen21/mapa-comunitario`, cloná `https://github.com/Jesmen21/mapa-comunitario` y trabajá dentro del clon.

Si al final no podés empujar por falta de credenciales o de permisos, NO termines en silencio dando la tarea por hecha: decí con todas las letras en el resumen que el trabajo NO se publicó y por qué, y pegá ahí el JSON de las alertas que ibas a agregar para que no se pierda el trabajo.

## QUÉ HACÉS
Buscar desastres naturales ocurridos en Colombia en las ÚLTIMAS 8 HORAS y, si superan el umbral, publicarlos editando `assets/data/alertas-urbis.json`. El mapa lee ese archivo y dibuja una gota grande por cada alerta. Son 8 horas y no 6 a propósito: el solape de dos horas evita que un evento se pierda entre dos corridas.

## LÍMITE ABSOLUTO DEL ALCANCE
SOLO desastres naturales: sismos, incendios forestales, inundaciones, deslizamientos, erupciones, huracanes.

NUNCA publiques violencia: homicidios, atentados, masacres, enfrentamientos armados, capturas, hallazgos de cuerpos. Tampoco ubicaciones de personas, comunidades, grupos étnicos o religiosos, ni presencia militar deducida. Esto no es negociable: un mapa público con esos datos se convierte en un mapa de objetivos, y URBIS opera en zona de frontera. Si dudás, NO publiques.

## LA FUENTE MANDA SOBRE LA PRENSA
Este es el cambio de precisión más importante. Los datos duros salen del boletín OFICIAL, no de la nota de prensa que lo parafrasea:

- **Sismos → Servicio Geológico Colombiano (SGC).** La magnitud, la profundidad, la hora local, el municipio del epicentro y las COORDENADAS del epicentro se toman del reporte del SGC, tal cual. La prensa sirve solo para lo que el SGC no reporta: daños, heridos, evacuaciones, qué tan sentido fue.
- **Incendios forestales → IDEAM, UNGRD, Dirección Nacional de Bomberos, o la gobernación / alcaldía.** Las hectáreas y el estado (activo, controlado, liquidado) salen de ahí.
- **Inundaciones y deslizamientos → IDEAM y UNGRD**, más la alcaldía del municipio.
- Prensa nacional consolidada como respaldo y para daños: El Tiempo, El Espectador, Semana, Infobae Colombia, La Opinión, El Heraldo, Caracol, RCN, La FM.
- **Sin fuente oficial identificable, no se publica.** Un solo tuit o un solo portal no alcanzan para poner una gota en el mapa.

## COORDENADAS — NUNCA A OJO
- **Sismo**: usá las coordenadas del EPICENTRO que publica el SGC, literales. No geocodifiques el nombre del municipio: el epicentro casi nunca cae en el casco urbano, y poner la gota en la plaza principal es un error de decenas de kilómetros.
- **Cualquier otro desastre**: geocodificá el lugar con Nominatim.
  `curl -s "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=MUNICIPIO,DEPARTAMENTO,Colombia" -H "User-Agent: URBIS/1.0"`
- Si no podés ubicar el evento con confianza, no lo publiques y decilo en el resumen.

## UMBRAL — no llenes el mapa de ruido
El SGC reporta decenas de temblores diarios. La profundidad importa tanto como la magnitud: un sismo superficial de 4,2 se siente mucho más que uno profundo de 5,5. Publicá SOLO si:

- **Sismo**: magnitud 5,0 o mayor a cualquier profundidad; **o** magnitud 4,0 o mayor con profundidad menor a 30 km y epicentro a menos de 50 km de una cabecera municipal; **o** cualquier magnitud con daños, heridos o reportes amplios de que se sintió.
- **Incendio forestal**: 50 hectáreas o más, **o** con evacuaciones, viviendas afectadas o declaratoria de emergencia.
- **Inundación, deslizamiento o erupción**: con víctimas, evacuaciones, damnificados o declaratoria oficial.

Si nada supera el umbral, NO publiques nada. Corriendo cuatro veces al día, la mayoría de las corridas no van a publicar nada: ese es el resultado esperado. No inventes contenido de relleno ni bajes el umbral para tener algo que mostrar.

## NO DUPLICAR Y CORREGIR LO YA PUBLICADO
Con cuatro corridas diarias y un solape de dos horas vas a volver a ver eventos que ya están en el archivo.

1. Leé `assets/data/alertas-urbis.json` entero antes de tocar nada.
2. **Es el mismo evento** si las coordenadas están a menos de 0,05° y las horas a menos de 2 h de una alerta ya publicada. En ese caso NO agregues otra.
3. **El SGC revisa las magnitudes.** Un sismo se reporta primero como preliminar y horas después se corrige. Si el evento ya está publicado y ahora el SGC da otra magnitud o profundidad: EDITÁ esa alerta, ajustá sus `lineas` y dejá dicho que la cifra fue revisada ("magnitud revisada por el SGC de 4,8 a 5,1"). Nunca dejes dos gotas del mismo temblor.
4. Un incendio que sigue activo tampoco genera una alerta nueva cada 6 horas: actualizá las hectáreas y el estado en la alerta que ya existe, y corré su `expira` hacia adelante mientras siga activo.

## CÓMO PUBLICAR
Agregá al array `alertas` un objeto así:
```json
{
  "tipo": "Sismo",
  "titulo": "Sismo de magnitud 5,4 — 18 de agosto de 2026, Santander",
  "lat": 6.8123, "lng": -73.0456,
  "desde": "2026-08-18", "expira": "2026-09-01",
  "lineas": [
    "📅 Ocurrió el 18 de agosto de 2026 a las 3:14 p. m. (hora de Colombia).",
    "📊 Magnitud 5,4 · profundidad 150 km · epicentro en zona rural de Los Santos, Santander.",
    "ℹ️ Alerta informativa del equipo URBIS con base en el SGC. No es un reporte ciudadano."
  ],
  "fuente": "SGC", "url": "https://..."
}
```
- `tipo` debe ser EXACTAMENTE `"Sismo"` o `"Incendio forestal"`: son los dos que tienen icono propio. Si el desastre no encaja en ninguno de los dos, NO lo publiques y reportálo en el resumen; no lo disfraces de sismo.
- **Primera línea**: siempre la fecha y la hora reales del hecho en hora de Colombia, no la de publicación.
- **Segunda línea**: los datos duros con su unidad. Para sismo, magnitud + profundidad en km + dónde cayó el epicentro. Para incendio, hectáreas + estado (activo / controlado / liquidado) + municipio.
- **Última línea**: siempre el aviso de que es alerta de URBIS y no un reporte ciudadano.
- Si una cifra está en disputa entre fuentes, escribí el rango y de dónde sale cada número ("entre 60 y 120 hectáreas según la gobernación y Bomberos").
- Si un dato no lo tenés, no lo pongas aproximado: omitilo.
- `desde` = fecha del evento. `expira` = evento + 14 días para sismos; para un incendio, mientras siga activo, y quitalo a los 3 días de declarado controlado.

## MANTENIMIENTO EN CADA CORRIDA
1. Quitá del array las alertas cuya fecha `expira` ya pasó.
2. Actualizá `actualizado` con la fecha de hoy.

## DESPLIEGUE
1. Validá el JSON: `node -e "JSON.parse(require('fs').readFileSync('assets/data/alertas-urbis.json','utf8'));console.log('JSON OK')"` (si no hay node, python3).
2. **Si el array `alertas` no cambió y tampoco venció ninguna, no hagas commit.** Descartá los cambios y terminá. No queremos cuatro commits vacíos por día.
3. Si sí hubo cambios: subí el token de versión. Buscálo con `grep -o "const URBIS_CACHE = '[^']*'" service-worker.js` y reemplazalo con el número incrementado en LOS 5 ARCHIVOS: `service-worker.js`, `index.html`, `css/main.css`, `analisis-ia.html`, `seguimiento.html`. Ojo con dos detalles que ya se han escapado antes: en `index.html` el token aparece también en `window.URBIS_APP_VERSION`, y en `service-worker.js` lleva el prefijo `urbis-v` mientras que en el resto va como `?v=`. Al terminar, comprobá que no quedó ninguna referencia al número viejo: `grep -rn "54X-" service-worker.js index.html css/main.css analisis-ia.html seguimiento.html`.
4. Antes de empujar, traé lo que haya en el remoto: `git pull --rebase origin main`. Sobre este repositorio trabajan otras sesiones en paralelo y el conflicto típico es SOLO el token de versión. Si las dos ramas llegaron al MISMO número con etiquetas distintas, no elijas una: subí a un número más alto todavía, porque si no la caché no se invalida. Después `git push origin main`. Si el push falla por red, reintentá hasta 4 veces esperando 2 s, 4 s, 8 s y 16 s.
5. El mensaje de commit lleva las fuentes.

## AL TERMINAR
Resumí en español: qué encontraste, qué publicaste, qué alertas ya existentes actualizaste (y por qué: magnitud revisada, incendio que creció) y qué descartaste por no superar el umbral. Si descartaste algo por ser violencia o por no poder ubicarlo, decilo explícitamente. Si no pudiste publicar, decilo explícitamente.
