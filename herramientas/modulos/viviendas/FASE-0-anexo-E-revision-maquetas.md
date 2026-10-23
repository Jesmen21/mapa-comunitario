# Revisión de seis maquetas · URBIS Viviendas, Fase 0

23 de octubre de 2026. Revisé Mapa, Ficha y los cuatro paneles contra `ESPEC.md` y el prompt (secciones 2 a 7). Las corregí en `project/`. No toqué `Main`, `Home-B`, `Home-C` ni `canvas.json`; lo comprobé comparando el md5 antes y después.

**Método.** No me quedé en leer el código. Compuse cada maqueta en Chromium sin cabeza a su tamaño de marco, medí desbordes y alturas de bloque y leí las capturas antes y después de cada cambio. Recalculé cada cifra contra la especificación: embudo, netos, porcentajes, días al vencimiento, altura de las barras y distancias del mini mapa en píxeles. El contraste lo medí con la fórmula WCAG 2.x. Cada parche exigía que el texto a reemplazar apareciera una sola vez e imprimía su confirmación al terminar.

**Resultado de la validación:** `todas las maquetas pasan el formato`, con 0 fallos en los 9 marcos, y `canvas.json` restaurado (mismo md5).

| Maqueta | Correcciones |
|---|---|
| Mapa | 3 |
| Ficha | 4 |
| Panel-Resumen | 5 |
| Panel-Finanzas | 6 |
| Panel-Usuarios | 6 |
| Panel-Linea | 4 |
| **Total** | **28** |

---

## Mapa.dc.html · 3 correcciones

| # | Antes | Después | Por qué |
|---|---|---|---|
| 1 | Grupo de marcadores «4» (`aria-label="Grupo de 4 viviendas, acercar"`) | Eliminado | Ya se dibujan las 6 viviendas de ejemplo una por una. El grupo sumaba 4 que no existen, 10 en total. La especificación dice «usar estas y ninguna otra». |
| 2 | «7 viviendas en esta zona» | «6 viviendas en esta zona» | Es un conteo de la base y no cuadraba ni con los marcadores (10) ni con la base (6). Ahora coincide con los 6 marcadores. |
| 3 | «Foto 1 de 12» a 12 px | 13 px | La etiqueta mínima es de 13 px, y así está en la Home publicada. |

Medido después: sin cortes y sin desbordes.

## Ficha.dc.html · 4 correcciones

| # | Antes | Después | Por qué |
|---|---|---|---|
| 1 | Barra fija de precio con sombra `lg` (`0 -12px 28px …16`) | `md` (`0 -6px 16px …12, 0 -2px 4px …06`) | Para la «tarjeta fija de precio» la especificación pide `md`. |
| 2 | Texto de venta con interlineado 1,35 | 1,45 | La especificación pide 1,45 en párrafos, y el prompt entre 1,4 y 1,6. |
| 3 | v3 en «Similares»: «Foto 1 de 9» | «Foto 1 de 15» | La Home publicada dice 15 fotos para v3, y los datos tienen que coincidir entre pantallas. |
| 4 | 9 textos a 12 px: las etiquetas de foto (1 de 12, 2, 3, Render sala, 1 de 15, 1 de 10), las insignias «Ubicación 91» y «Ubicación 81» y el pie «Datos medidos…» | 13 px | Escala: la etiqueta mínima es de 13 px. |

Medido después: el párrafo crece 8 px. Los absorben los tres bloques decorativos que ceden (foto 240 → 237, 360° 168 → 166, mini mapa 148 → 146), todos por encima de su mínimo. Sin cortes. Verifiqué que el análisis coincide con la especificación: 86 = media de 95, 80, 90 y 78. Los colores de la escala están bien, y cada fortaleza tiene su punto en el mini mapa a su distancia, a la escala del radio (500 m = 55 px): colegio 44 px, bus 17, supermercado 33 y parque 49,5, todos dentro de ±1 px. El texto de venta es idéntico al de Daniel.

## Panel-Resumen.dc.html · 5 correcciones

| # | Antes | Después | Por qué |
|---|---|---|---|
| 1 | `h1` «Resumen» a 28 px | 33 px | El título principal en PC es de 33 px. |
| 2 | «Quien lo toca casi siempre llega hasta el final.» | «De quienes lo tocan, 14 de 41 (34 %) llegan hasta el final.» | La frase contradecía el embudo: de 41 que tocan «Agendar visita», 14 envían la solicitud (34 %). Eso no es «casi siempre». |
| 3 | «Solicitud de Julián Castro sin atender hace 2 h» | «Solicitud de Mariana Rojas sin atender hace 2 h» | Julián está «Pendiente de confirmar» y su única actividad es el registro. Sin correo confirmado no hay cuenta activa ni solicitud (prompt 2.2d). La solicitud de v1 en Caobos que describe la alerta es la de Mariana: enviada el 23 oct a las 14:17 y contactada el 24 oct a las 09:30. |
| 4 | Insignia «Ganancia» con tinte al 10 % | Al 7 % | Medido: el verde sobre el tinte al 10 % da 4,40:1, por debajo de AA. Al 7 % da 4,58:1. |
| 5 | 8 textos a 12 px («3 nuevas», «Ganancia», las notas del embudo) | 13 px | Escala. |

Verificado sin cambios: 1.240, 3.860, 14, 9 y 6. El resultado de $ 4.200.000 es 6.000.000 − 1.800.000. Septiembre dio $ 600.000. Embudo: 3,1 · 1,1 % · 3,3 % · 54 % · 1,8 % · 64 % · 1,1 %. Las flechas ya llevaban `role="img"` con «Sube», «Baja» o «Igual».

## Panel-Finanzas.dc.html · 6 correcciones

| # | Antes | Después | Por qué |
|---|---|---|---|
| 1 | `h1` a 28 px | 33 px | Escala de PC. |
| 2 | «Ganancia», «Pagada» ×2 y «Pendiente» con tinte al 10 % | Al 7 % | Medido: verde 4,40 → 4,58 y ámbar 4,38 → 4,57. |
| 3 | «Resultado neto: … jul −1,8 · …», sin color y sin palabra | `jul −1,8 (pérdida)` en `#C62828` | Un valor negativo va en rojo sobrio, con signo y con texto. |
| 4 | Lista de datos: «resultado −$ 1.800.000 (pérdida)» en gris | «resultado − $ 1.800.000 (pérdida)» en `#C62828` | La misma regla. |
| 5 | Lista de datos: «+$ 400.000», «+$ 1.800.000», «+$ 4.100.000», «+$ 600.000», «+$ 4.200.000» | «+ $ …» | Formato idéntico en toda la app: las tarjetas y la tabla usan «+ $ …» y «− $ …». |
| 6 | 37 textos a 11 o 12 px (etiquetas de barras, estados, «NOV», porcentajes, avisos) | 13 px | Escala. |

Verificado: +150 % (de 2,4 a 6,0), los seis netos y el desglose (900 + 675 + 120 + 105 = 1.800 mil; 50 · 37,5 · 6,7 · 5,8 %). Las 11 barras son proporcionales (2,0 → 67 px … 6,0 → 200 px). Los días al vencimiento son 9, 13 y 23 desde el 23 de octubre. La página crece 60 px y no corta nada.

## Panel-Usuarios.dc.html · 6 correcciones

| # | Antes | Después | Por qué |
|---|---|---|---|
| 1 | `h1` a 28 px | 33 px | Escala de PC. |
| 2 | «Ver teléfono» con `min-height: 32px` | 44 px | Área táctil mínima. |
| 3 | Tabla con `min-width: 960px` | 900 px | Medido a 1280: la tabla pedía 963 px en una envoltura de 929 y la columna «Contacto» salía cortada («••• solo adm» y el botón partido). |
| 4 | Píldora «formato provisional» sin poder partirse | Puede partirse | Era la celda que forzaba el ancho (149 px). Con este cambio y el 3, la tabla mide 921 px dentro de 929 y la columna se lee entera. |
| 5 | Rol «gerencia» en `#075E88` sobre `#D6E6F2` | `#222222` sobre `#F7F7F7` con borde `#DDDDDD` | `#075E88` es el acento de la paleta B dentro de una maqueta A, y el prompt pide un solo acento. Uso el mismo estilo de chip que ya tiene «formato provisional» en esta pantalla, todo con tokens A. Cuál neutro usar es elección mía y se revierte en una línea. |
| 6 | 2 textos a 12 px («3 nuevas», «formato provisional») | 13 px | Escala. |

Verificado: Todos (5) = Clientes (3) + Admin (1) + Gerencia (1), «Mostrando 5 de 5», orden por registro correcto, «solo admin» en todos los contactos y fecha y hora de Colombia en el registro.

## Panel-Linea.dc.html · 4 correcciones

| # | Antes | Después | Por qué |
|---|---|---|---|
| 1 | `h1` a 28 px | 33 px | Escala de PC. |
| 2 | «Abrió el enlace de confirmación que le llegó al correo» | «Escribió el código de 6 dígitos que le llegó al correo» | El prompt (2.2d) confirma el correo con un código de 6 dígitos, no con un enlace. |
| 3 | «Últimos 30 días: del 23 oct al 5 nov de 2026 · 11 eventos» | «Últimos 30 días: 11 eventos, del 23 oct (registro) al 5 nov de 2026» | Tal como estaba, decía que 30 días eran del 23 oct al 5 nov, que son 13. El rango es el de sus eventos, y así queda dicho. |
| 4 | 15 textos a 12 px (etiquetas de tipo de evento, «formato provisional», «solo admin») | 13 px | Escala. |

Verificado: 11 eventos = 2 de cuenta + 3 de navegación + 5 de solicitudes + 1 transacción. Los días de la semana son correctos (viernes 23, sábado 24, lunes 26, jueves 5). La búsqueda «Caobos 3 hab» da 1 resultado, que es lo que da la base (solo v1). Teléfono y correo van enmascarados con «solo admin». Contrastes de las etiquetas por tipo, todos AA: ≥4,6:1.

---

## Preguntas para Daniel (no las resolví: son decisiones de producto o editoriales)

1. **¿Qué día es «hoy» en el panel?** Finanzas dice «Hoy es 23 de octubre», y el Resumen y las alertas cuentan desde ahí. Pero Usuarios muestra «última actividad» del 4 y 5 de noviembre, y la línea de tiempo llega al 5 nov con «lo que haga de ahora en adelante aparece aquí abajo». Las dos cosas vienen de la especificación. Propongo dejar el panel el 23 oct y cortar la línea de Mariana en la solicitud de las 14:17, o bien mover todo al 5 nov.
2. **5 cuentas contra 9 registros nuevos y 22 registros completados en octubre.** Usuarios lista 5 cuentas («Mostrando 5 de 5», «Todas las personas registradas»), 4 de ellas de octubre. El Resumen dice 9 cuentas nuevas y el embudo 22 registros completados. Las tres cifras son de la especificación y no cuadran entre sí. ¿Se amplía la tabla («Mostrando 5 de N») o se bajan las cifras del resumen?
3. **El mapa filtra «Caobos · $ 150–350 M · 3+» y muestra v2 (2 habitaciones) y v4 (arriendo, $ 1,2 M/mes).** Con ese filtro, de las 6 pasarían v1, v3, v5 y v6 (sin contar el barrio). La Home publicada tiene el mismo filtro y cuenta por pestaña activa. ¿El mapa muestra todo, una pestaña o el filtro? De eso dependen los marcadores y el «6».
4. **«Ordenadas por puntaje de ubicación» y la primera tarjeta del mapa es v1 (86)**, cuando v3 tiene 91. Si la tarjeta es la de la vivienda seleccionada, el subtítulo engaña. ¿Se cambia el subtítulo o el orden?
5. **El precio de la ficha va a 19 px y el nombre a 23 px.** La especificación pide 28 px / 700 para «precio en ficha» y para «título de pantalla», y que el precio destaque más que cualquier otra cosa. Medido: a 28 px el precio no cabe en la barra fija junto a «Agendar visita» y WhatsApp (quedan unos 140 px). ¿Qué cede: el tamaño, el botón de WhatsApp o una barra de dos renglones?
6. **Lo que pide atención en el Resumen tiene dos alertas que no deberían dispararse.** El almacenamiento al 41 % dice «No hay nada que hacer», y el prompt fija la alerta en el 70 %. El Plan Supabase sale como alerta hoy, a 9 días, cuando Finanzas dice «Aviso 5 días antes: el 27 de octubre». ¿Se quitan, y el texto pasa a «Una cosa para revisar hoy»? ¿El aviso de 5 días es solo para la cuota mensual o para todos los pagos?
7. **«Ingresos del mes: lo que entró» suma $ 4.800.000 de una comisión «Pendiente».** ¿Una pendiente cuenta como ingreso del mes? Y si hay comisión de venta de v5, ¿v5 sigue entre las 6 publicadas?
8. **Datos de la ficha de v1 que no están en la especificación:** antigüedad «8 años», los seis ítems de «Lo que ofrece» (uno es «Cerca al colegio», que repite una fortaleza del análisis) y «3 espacios» en el 360°. ¿Se confirman?
9. **«formato provisional» solo marca el primer ID**, cuando los cinco son provisionales. ¿Va mejor en la cabecera de la columna («ID URBIS (formato provisional)»)? Eso, de paso, libera ancho en la tabla.
10. **Menores, sin corregir:** en el mapa, el rótulo «LA RIVIERA» queda junto a v3 y v5 (Prados del Este, Los Pinos) y no junto a v2. Los rótulos de la cartografía del mapa van a 12 px. Las píldoras «cliente» usan `#F0F0F0`, que no es token (es AA con `#222222`). Los chips usan radio 999, y la especificación reserva 8 para el chip.
