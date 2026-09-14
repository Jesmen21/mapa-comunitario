# Pliegos de muestra

PDF de la lámina educativa exportados por la batería de pruebas, para poder
mirarlos sin montar el entorno. **No son un análisis de nadie**: salen del
sector de prueba de `pruebas/suites/tdoslaminas.js` —Cúcuta, datos de
fixture—, y están acá porque el papel impreso es el método que más defectos
reales ha encontrado en este módulo (v874, v882, v885, v887, v912).

| Archivo | Qué enseña |
|---|---|
| `pliego-v913-radio2500-normal.pdf` | Radio 2.500 m, letra por defecto. Cede dos paneles, los dos de peldaño 1. |
| `pliego-v913-radio2500-de-pie.pdf` | El mismo sector con «Se lee de pie». Composición apretada a propósito: se ven los renglones de banda entera fuera, la línea de «Cedió en esta composición» por banda, y la numeración fija del pliego. |

Se regeneran corriendo la sonda del scratchpad sobre `tdoslaminas`; no hay que
actualizarlos en cada versión — se reemplazan cuando hace falta mirar algo.
