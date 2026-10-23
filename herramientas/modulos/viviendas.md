# Módulo VIVIENDAS · notas de la sesión · rama `claude/fervent-allen-74qgwm`

Lo propio de este módulo. Las reglas comunes están en `CLAUDE.md` y el reparto
entre sesiones en `herramientas/COORDINACION-MODULOS.md`; acá no se repiten.

## Qué es

Las viviendas que Daniel va a vender —y después a arrendar—, publicadas para
el ciudadano. **El diferenciador es que cada vivienda muestra sus fortalezas y
el análisis de su ubicación**. Un portal cualquiera dice «excelente
ubicación»; acá cada fortaleza dice de dónde sale.

## Dónde vive desde el 2026-10-23

**Fuera de este repositorio.** Daniel decidió que los datos van en Supabase,
proyecto `urbis-viviendas`, y el código en un repositorio privado nuevo,
`urbis-viviendas`, con dos aplicaciones y un paquete compartido.

Mientras ese repositorio no exista, lo del módulo se prepara en
`herramientas/modulos/viviendas/` de esta rama:

| Qué | Dónde |
|---|---|
| El registro de decisiones, con fecha y razón | `herramientas/modulos/viviendas/decisiones.md` (va a `docs/` en el repositorio nuevo) |
| La propuesta de la Fase 0, con la verificación de costos en su anexo C | `herramientas/modulos/viviendas/FASE-0-propuesta.md` |
| Las migraciones y las pruebas de la Fase 1 | `herramientas/modulos/viviendas/supabase/` |

**Todo eso se muda al repositorio nuevo en su primer commit**, y de acá se
retira. En `mapa-comunitario` el módulo no deja código.

## El primer peldaño se retiró

El esquema `83-viviendas.js`, su arnés de inyecciones y su bloque de
`pruebas/revisar.js` estaban escritos para la hoja de la Vitrina. Con la
decisión de Supabase sobraban, y se retiraron el 2026-10-23. La batería
estática pasó de 853 a 840 comprobaciones, todas en verde: las 13 que bajaron
eran las del bloque retirado. Sus cuatro reglas pasan a SQL en las migraciones
005, 010 y 011.

## Lo que le pido a la cabeza

Los pedidos anteriores (mover el archivo a `js/`, el tipo de la foto, `lat` y
`lng` en privado, los nombres de `comparte`) **ya no aplican**: el módulo no
escribe en la hoja. Queda uno, y son tres archivos compartidos:

* **Retirar la excepción de Viviendas en la hoja.** Es la decisión 9 de
  `herramientas/DECISIONES-DANIEL.md`, la entrada `viviendas` de
  `js/03h-registro-modulos.js` con `backend: 'hoja'` y sus dos tipos de fila,
  y el renglón `viviendas` de `TRANSITORIOS` en `pruebas/revisar.js`. Hoy no
  rompen nada, pero declaran un dueño de la hoja que ya no la va a usar.

Lo que sí sigue siendo de la capa de URBIS es la **lectura de los mapeos**,
por un archivo de intercambio y en un solo sentido. El contrato está en la
sección 8 de la propuesta.
