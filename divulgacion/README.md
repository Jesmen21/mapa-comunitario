# Divulgación · explicar el módulo sin tecnicismos

Documentos para quien NO lee el módulo: un hijo, un vecino, alguien que
discute por WhatsApp y no tiene por qué saber qué es un deflactor.

No son un resumen de la ficha. Son otra cosa, y conviene decir cuál: la ficha
publica el estado con su método al lado, y esto explica **cómo se lee** ese
estado. El módulo contesta «qué pasa»; esto contesta «cómo sé de quién es».

## Lo que hay

| Archivo | Qué es |
|---|---|
| `de-quien-es-la-culpa.html` | 7 páginas A4, sin un solo gráfico: la regla de la fecha |
| `nada-fiable.html` | 10 páginas A4 con gráficos: de dónde sale el dictamen, y los números del presupuesto |
| `expediente.html` | 12 páginas A4: TODO lo documentado como reproche, por tema, con el nivel de prueba por hecho |
| `hacer-pdf.js` | arma el PDF, y **se niega a escribirlo** si alguna hoja se desborda |

```bash
node divulgacion/hacer-pdf.js     # el PDF sale acá al lado
```

El generador arma el primero; para el segundo se cambia el nombre del archivo
dentro. Que no esté parametrizado es deliberado mientras sean dos.

## El expediente lleva el grado de prueba POR HECHO, y eso no es timidez

Un pliego que mete todo en el mismo saco se desarma con un solo golpe: quien
no quiere creerlo busca el renglón más flojo y con ese descarta los otros
treinta. Por eso cada hecho dice **probado / anunciado / en disputa**, y los
«en disputa» llevan escrito que no sirven para acusar.

Tres cosas que ese documento hace a propósito y que conviene no «mejorar»:

* **Avisa cuándo un reproche que circula NO se sostiene.** La derogatoria de
  las once circulares laborales se cuenta como hecho, y debajo va que
  «les tumbaron las extras a los vigilantes» es falso: una circular interpreta,
  no crea ni quita derechos de ley. Quien use la versión de redes pierde la
  discusión con razón, y el documento se lo dice antes.
* **Una página entera de lo que NO es culpa suya** —inflación, desempleo de
  agosto, deuda heredada, Decreto 1012 del gobierno saliente, decretos de
  emergencia—, más el 88 % de gasto inflexible del CARF. Es lo que hace
  creíbles las otras diez.
* **Y lo que está a su favor**, con su propia página: cero casos de corrupción
  confirmados, los 60 contratos revocados, los siete menores rescatados.

## Los gráficos, y por qué están hechos así

Van en **SVG escrito a mano**, sin librería: el PDF se imprime y se manda por
WhatsApp, así que no puede depender de que un script corra. Y tres reglas que
no son de gusto:

* **El color nunca lleva el significado solo.** Cada barra trae su número y la
  palabra «sube» o «baja»; cada peldaño, su nombre. Quien no distingue rojo de
  azul lee lo mismo.
* **La pareja de colores está validada**, no escogida a ojo: azul `#256abf` y
  rojo `#d03b3b` pasan las seis comprobaciones del validador de paletas —
  separación para daltonismo ΔE 20,4 y contraste sobre el papel por encima de
  3:1—. El verde y el rojo juntos, que es lo que uno escogería, no pasan.
* **La escalera va en gris con UN acento.** Un degradado de cinco colores
  insinuaría una gravedad continua que el módulo no publica: lo que publica es
  un peldaño, y el gris con el acento rojo es exactamente eso.

Y una colisión que solo se vio mirando el papel: en el gráfico del presupuesto,
la etiqueta «−43,5 %» de Deporte se montaba encima de la palabra «Deporte».
Quedó DENTRO de la barra, en blanco. El validador mide color, no geometría.

**El PDF no se sube**, y `.gitignore` lo deja fuera por dos razones. Se
regenera en un segundo desde el HTML, así que versionar el binario solo
duplica; y este repositorio publica urbispro.city, de modo que subirlo sería
PUBLICAR el documento en el sitio — una decisión aparte de escribirlo, y de
quien firma el módulo.

## Las dos reglas con las que está escrito

**Primero lo que exonera.** Las páginas de «esto NO es suyo» van antes que las
de «esto SÍ». No es cortesía: quien llega a la defensiva deja de leer en el
primer reproche, y las dos cosas son igual de ciertas. La del 7 de octubre de
2026 sobre la papa estaba en el registro antes de que nadie la reclamara, y
eso es lo que hace creíble el resto.

**Una sola regla para todo el documento.** «Mira la fecha»: el 7 de agosto de
2026 parte el antes del después. Con esa regla sola se resuelven la papa, la
deuda, las tres operaciones y el presupuesto, sin explicar ni una vez qué es
la inflación. Un documento de divulgación con tres ideas no se recuerda.

## Lo que costó, y para que no se repita

**Ninguna cifra se escribe acá a mano.** Todas salen del registro y de la
ficha compuesta, leídas el día que se escribió el documento. Un número tecleado
dentro de un texto fijo envejece solo (v903) — y acá, además, nadie lo vuelve
a mirar, porque el PDF ya se mandó por WhatsApp. **Si se corrige el documento,
se vuelven a leer las cifras contra el registro antes de regenerarlo.**

**Se dice «operación militar» y no «bombardeo».** De las tres operaciones del
eje D, el registro documenta como bombardeo solo la Operación Beta. El
borrador decía «seis niños muertos en bombardeos» y era más de lo que el
registro sostiene: es exactamente el error que el módulo le señala a otras
narrativas, cometido al explicarlo.
