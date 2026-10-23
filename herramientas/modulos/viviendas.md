# Módulo VIVIENDAS · notas para las sesiones de URBIS

El módulo de viviendas **vive en su propio repositorio privado,
`Jesmen21/urbis-viviendas`**, desde el 2026-10-23. Sus datos van en un proyecto
propio de Supabase, `urbis-viviendas`, con PostGIS, y sus imágenes en
Cloudflare R2. Lo decidió Daniel, y la razón quedó escrita en el
`docs/decisiones.md` de ese repositorio.

En `mapa-comunitario` el módulo no deja código. El trabajo que se hizo acá, en
la rama `claude/fervent-allen-74qgwm`, se mudó con su historia (diez commits,
extraídos con `git subtree split`) y la copia de acá se retiró en el mismo
paso.

## Lo que una sesión de URBIS necesita saber

* **Viviendas no escribe en la hoja.** El primer peldaño, escrito para la hoja
  de la Vitrina, se retiró cuando Daniel decidió Supabase.
* **Lee la capa de mapeos en un solo sentido**, por un archivo JSON de
  intercambio exportado de la hoja una sola vez. El contrato está en la
  sección 8 de `docs/fase-0/propuesta.md` de `urbis-viviendas`. **Nunca viaja
  información personal hacia URBIS.**

## Lo que le pido a la cabeza

* **Retirar la excepción de Viviendas en la hoja.** Son tres sitios
  compartidos: la decisión 9 de `herramientas/DECISIONES-DANIEL.md`, la entrada
  `viviendas` de `js/03h-registro-modulos.js` con `backend: 'hoja'` y sus dos
  tipos de fila, y el renglón `viviendas` de `TRANSITORIOS` en
  `pruebas/revisar.js`. Hoy no rompen nada, pero declaran un dueño de la hoja
  que ya no la va a usar.
