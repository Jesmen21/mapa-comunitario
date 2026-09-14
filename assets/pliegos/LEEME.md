# Pliegos de muestra

PDF de la lámina educativa exportados por la sonda de pruebas, para poder
mirarlos sin montar el entorno. **No son un análisis de nadie**: salen del
sector de prueba de `pruebas/suites/tdoslaminas.js` —Cúcuta, datos de
fixture—, y están acá porque el papel impreso es el método que más defectos
reales ha encontrado en este módulo (v874, v882, v885, v887, v912).

| Archivo | Qué enseña |
|---|---|
| `pliego-v914-radio2500-normal.pdf` | Radio 2.500 m, letra por defecto. Cede dos paneles, los dos de peldaño 1. |
| `pliego-v914-radio2500-de-pie.pdf` | El mismo sector con «Se lee de pie». Composición apretada a propósito: se ven los renglones de banda entera fuera, la línea de «Cedió en esta composición» por banda, y la numeración fija del pliego. |
| `…-liviano.pdf` | Los dos anteriores a 0,8 MB en vez de 2,55, para que quepan en un adjunto. |

## Los livianos son el MISMO papel

`pruebas/aligerar-pliego.py` rehace el archivo con la misma página de 60 × 90
y la misma imagen, con menos píxeles: de 120 a 84 puntos por pulgada. **El
tamaño del papel no cambia**, así que medir milímetros sobre ellos —que es
para lo que existen estos PDF— da exactamente lo mismo; lo único que baja es
la nitidez de la letra chica. Para leer un pie de método de 2,6 mm conviene el
pesado.

```bash
python3 pruebas/aligerar-pliego.py entrada.pdf salida.pdf 0.70 75
```

## Lo que este archivo NO puede hacer

Un PDF **viaja solo**. Reenviado por correo o por WhatsApp, este LEEME no lo
sigue, así que decirlo solo acá es decirlo donde el lector no está: es la
misma regla de toda la lámina —lo que no se puede leer del papel no está
dicho— aplicada al archivo en vez de a una cifra.

Por eso los dos llevan impresa, arriba del todo y en la franja que se lee a
tres metros (v885):

> SECTOR DE PRUEBA · DATOS DE FIXTURE · NO ES EL ANÁLISIS DE NINGÚN PREDIO REAL

La franja sale **solo** con `pruebaDeFixture` puesto, que es lo que pide la
sonda al exportar estos dos. El pliego normal no la lleva y no se deduce de
ninguna señal del entorno: marcar como prueba el análisis de un predio de
verdad sería la mentira contraria, y peor.

Se regeneran corriendo la sonda del scratchpad sobre `tdoslaminas`; no hay que
actualizarlos en cada versión — se reemplazan cuando hace falta mirar algo.
