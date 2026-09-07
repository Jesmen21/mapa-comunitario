const E = require('../entorno.js');
/* Cuándo está viva la calle, según el LETRERO y no según el tipo de local.

   El motor ya repartía el flujo en cuatro franjas —mañana, mediodía, tarde,
   noche— suponiendo que un bar pesa de noche y una papelería de día. Es una
   estimación razonable y no es lo mismo que mirar el horario. `opening_hours`
   llegaba en los datos desde siempre y nadie lo leía.

   Dos cosas que esta suite vigila y que son la diferencia entre un dato y una
   cifra con cara de dato:

   · Lo que el lector NO entiende queda fuera y se dice. El formato de
     OpenStreetMap admite meses, semanas del año y «sunset»; interpretar a
     medias una cadena que no se supo leer daría un horario falso con la
     misma pinta de exacto que uno bueno.

   · Los porcentajes se calculan sobre los que SÍ declaran horario, y la
     cobertura viaja al lado. «El 50 % abre de noche» pueden ser tres locales
     de doscientos: sin la cobertura esa frase miente sin decir una sola
     palabra falsa.                                                        */
const MOTOR = require('../motor-local.js');

const C = { lat: 7.8939, lng: -72.5078 };

const ok = [], fallo = [];
const chk = (c, t) => (c ? ok : fallo).push(t);

/* ── El lector, cadena por cadena ────────────────────────────────────────
   Se prueba a través del análisis completo —un solo local por caso— porque
   el lector no se exporta: lo que importa no es la función suelta sino que
   el rasgo llegue al POI, que es lo que el cliente pinta. */
function rasgosDe(txt) {
  const el = { type: 'node', id: 1, lat: C.lat + 30 / 110540, lon: C.lng,
               tags: { name: 'Local', amenity: 'restaurant' } };
  if (txt != null) el.tags.opening_hours = txt;
  const out = MOTOR.analizarHeuristico({ elementos: [el], radioM: 500, centro: C });
  const poi = (out.stats.pois || [])[0] || {};
  // A la defensiva: contra el motor anterior `stats.horarios` no existe, y
  // una suite que revienta no reporta nada — solo se cae.
  return { rasgo: poi.horario || null, h: out.stats.horarios || {} };
}

const CADENAS = [
  { t: '24/7',                              esp: { siempre: true, deNoche: true, domingo: true } },
  { t: 'Mo-Fr 08:00-18:00',                 esp: { siempre: false, deNoche: false, domingo: false, soloEntreSemana: true } },
  { t: 'Mo-Sa 08:00-18:00',                 esp: { sabado: true, domingo: false, soloEntreSemana: false } },
  { t: 'Mo-Su 06:00-22:00',                 esp: { deNoche: true, domingo: true } },
  { t: 'Mo-Fr 08:00-12:00,14:00-18:00',     esp: { deNoche: false, soloEntreSemana: true } },
  { t: 'Mo-Sa 07:00-19:00; Su 09:00-13:00', esp: { domingo: true, deNoche: false } },
  // Cruza la medianoche: cierra a las 2 a.m. Es exactamente el caso que el
  // dato busca, y el que se pierde si el lector exige fin > inicio.
  { t: 'Tu-Su 18:00-02:00',                 esp: { deNoche: true, domingo: true, soloEntreSemana: false } },
  { t: 'Mo-Su 00:00-24:00',                 esp: { deNoche: true, domingo: true } },
  { t: 'Mo-Sa 08:00-20:00; Su off',         esp: { sabado: true, domingo: false } },
  // Lo que NO se sabe leer: ilegible entero, nunca a medias.
  { t: 'sunrise-sunset',                    esp: null },
  { t: 'Jan-Mar 08:00-18:00',               esp: null },
  { t: 'abierto todos los días',            esp: null },
  { t: '08:00-18:00 y a veces más',         esp: null }
];

console.log('\n── El horario, cadena por cadena ───────────────────────────');
CADENAS.forEach(c => {
  const r = rasgosDe(c.t);
  const leido = r.rasgo;
  console.log('  ' + JSON.stringify(c.t).padEnd(40) +
    (leido ? JSON.stringify(leido) : 'ilegible'));
  if (c.esp === null) {
    chk(!leido && r.h.ilegible === 1 && r.h.conDato === 0,
        JSON.stringify(c.t) + ' no se sabe leer, y se cuenta como ilegible');
  } else {
    const bien = leido && Object.keys(c.esp).every(k => leido[k] === c.esp[k]);
    chk(!!bien, JSON.stringify(c.t) + ' se lee bien' +
        (bien ? '' : ' → ' + JSON.stringify(leido)));
  }
});

// Un local sin `opening_hours` no es un ilegible: es un sin dato. Contarlos
// juntos escondería que a un sector le falta levantamiento de campo detrás
// de un problema de formato.
const sinTag = rasgosDe(null).h;
chk(sinTag.conDato === 0 && sinTag.ilegible === 0 && sinTag.sinDato === 1,
    'un local sin horario declarado es «sin dato», no «ilegible»');

/* ── El sector, con su cobertura ─────────────────────────────────────────
   Dieciséis usos: nueve con horario legible, uno ilegible, seis sin nada.
   Los números están escogidos para que ningún porcentaje sea redondo por
   casualidad. */
let id = 1;
const local = (h, d) => {
  const el = { type: 'node', id: id++, lat: C.lat + d / 110540, lon: C.lng,
               tags: { name: 'L' + id, amenity: 'restaurant' } };
  if (h) el.tags.opening_hours = h;
  return el;
};
const SECTOR = [
  '24/7', '24/7', 'Mo-Su 06:00-22:00', 'Tu-Su 18:00-02:00', 'Mo-Su 00:00-24:00',
  'Mo-Sa 07:00-19:00; Su 09:00-13:00', 'Mo-Sa 08:00-18:00',
  'Mo-Fr 08:00-17:00', 'Mo-Fr 09:00-18:00', 'sunrise-sunset'
].map((h, i) => local(h, 40 + i * 10))
 .concat([0, 1, 2, 3, 4, 5].map(i => local(null, 160 + i * 10)));

const S = MOTOR.analizarHeuristico({ elementos: SECTOR, radioM: 500, centro: C }).stats.horarios || {};
console.log('\n── El sector ───────────────────────────────────────────────');
console.log('  ' + S.conDato + ' de ' + S.total + ' con horario · cobertura ' + S.cobertura + ' %' +
            ' · ilegibles ' + S.ilegible + ' · sin dato ' + S.sinDato);
console.log('  ' + S.lectura);

chk(S.total === 16 && S.conDato === 9 && S.ilegible === 1 && S.sinDato === 6,
    'cuenta aparte los legibles, los ilegibles y los que no declaran nada (' +
    S.conDato + '/' + S.ilegible + '/' + S.sinDato + ')');
chk(S.cobertura === Math.round(100 * 9 / 16),
    'la cobertura se mide sobre el total de usos (' + S.cobertura + ' %)');
// El punto de todo el bloque: el denominador son los que declaran, no el
// sector entero. Con 16 usos y 5 nocturnos, sobre el total daría 31 %.
chk((S.pct || {}).deNoche === Math.round(100 * 5 / 9),
    'y los porcentajes se calculan sobre los que declaran horario, no sobre el sector (' +
    (S.pct || {}).deNoche + ' %, no ' + Math.round(100 * 5 / 16) + ' %)');
chk(S.siempre === 2 && (S.ejemplos24h || []).length === 2,
    'los que abren 24 h se cuentan y se nombran (' + S.siempre + ')');
chk(S.soloEntreSemana === 2, 'y los que solo abren de lunes a viernes (' + S.soloEntreSemana + ')');
chk(!!S.notaIlegible && /no se pudo leer/.test(S.notaIlegible),
    'el horario que no se supo leer se declara en vez de callarse');
chk(S.suficiente === true, 'con nueve horarios y 56 % de cobertura, la lectura se da por buena');

/* Poca cobertura: la lectura tiene que negarse a concluir. Un sector con dos
   horarios de cincuenta usos no describe nada, y el peligro no es la cifra
   sino que se lea como si describiera. */
const FLOJO = ['24/7', 'Mo-Fr 08:00-17:00'].map((h, i) => local(h, 40 + i * 10))
  .concat(Array.from({ length: 48 }, (_, i) => local(null, 120 + i)));
const F = MOTOR.analizarHeuristico({ elementos: FLOJO, radioM: 500, centro: C }).stats.horarios || {};
console.log('\n  con poca cobertura: ' + F.lectura);
chk(F.suficiente === false, 'con dos horarios de cincuenta usos, la lectura NO se da por buena');
chk(/muy poco para describir el sector/.test(F.lectura || ''),
    'y lo dice con todas las letras en vez de soltar el porcentaje');

// Sin ningún horario: se dice qué falta y cómo se consigue, que es lo que
// convierte un hueco en una tarea de campo.
const VACIO = MOTOR.analizarHeuristico({
  elementos: [local(null, 40), local(null, 60)], radioM: 500, centro: C }).stats.horarios || {};
chk(VACIO.conDato === 0 && /se levanta en campo/.test(VACIO.lectura || ''),
    'sin ningún horario, dice que es un dato de campo y no deja el hueco mudo');

console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
process.exit(fallo.length ? 1 : 0);
