const E = require('../entorno.js');
/* Qué FORMA tiene la traza: las cinco de los manuales de morfología urbana
   —ortogonal, radial, media naranja, lineal y plato roto— reconocidas por
   medida y no a ojo.

   Antes de esta tanda el motor solo distinguía cuadrícula / orientada /
   mixta / irregular con la entropía de orientación de la rosa de rumbos. Eso
   cubre ortogonal y plato roto, y con una radial se equivoca de la peor
   manera posible: una traza radial tiene rumbos repartidos por todo el
   abanico —cada calle apunta a un sitio distinto— así que la entropía la
   llama «irregular», que es exactamente lo contrario de lo que es. Una
   radial está ordenadísima; el orden está alrededor de un punto y no de dos
   ejes.

   La prueba corre contra trazas SINTÉTICAS, dibujadas acá, porque son las
   únicas de las que se sabe con certeza qué forma tienen. Con un pedazo de
   ciudad real la prueba mediría la opinión de quien la escribió.

   Las vías se parten cada ~50 m como llegan de OpenStreetMap. No es un
   detalle: la primera versión las dejaba de dos puntos y una cuadrícula daba
   92 % de metros «en anillo», que es una propiedad del fixture —el punto
   medio de cada calle caía justo al norte o al sur del centro— y no del
   damero. Con la geometría partida da 21 %, que es el azar puro.          */
const MOTOR = require('../motor-local.js');

const C = { lat: 7.8939, lng: -72.5078 }, R = 700;
const GLAT = m => m / 110540;
const GLNG = m => m / (111320 * Math.cos(C.lat * Math.PI / 180));
const P = (dx, dy) => ({ lat: C.lat + GLAT(dy), lng: C.lng + GLNG(dx) });
let id = 1;

function partir(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i];
    const dx = (b.lng - a.lng) * 111320 * Math.cos(C.lat * Math.PI / 180);
    const dy = (b.lat - a.lat) * 110540;
    const n = Math.max(1, Math.round(Math.hypot(dx, dy) / 50));
    for (let k = 1; k <= n; k++) {
      out.push({ lat: a.lat + (b.lat - a.lat) * k / n, lng: a.lng + (b.lng - a.lng) * k / n });
    }
  }
  return out;
}
const via = (pts, hw) => ({ type: 'way', id: id++,
  tags: { highway: hw || 'residential', name: 'V' + id }, geometry: partir(pts) });

// ── Cuadrícula: calles cada 100 m en dos direcciones ─────────────────────
function ortogonal() {
  const e = [];
  for (let i = -6; i <= 6; i++) {
    e.push(via([P(-600, i * 100), P(600, i * 100)]));
    e.push(via([P(i * 100, -600), P(i * 100, 600)]));
  }
  return e;
}

// ── Radial: 16 radios y 4 anillos. `hasta` recorta el abanico ────────────
function radial(hasta) {
  const e = [], n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    if (a > hasta) continue;
    e.push(via([P(Math.cos(a) * 60, Math.sin(a) * 60), P(Math.cos(a) * 650, Math.sin(a) * 650)]));
  }
  [180, 330, 480, 630].forEach(r => {
    const pts = [];
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * (hasta || 2 * Math.PI);
      pts.push(P(Math.cos(a) * r, Math.sin(a) * r));
    }
    e.push(via(pts));
  });
  return e;
}

// ── Lineal: un eje largo con calles transversales ────────────────────────
function lineal() {
  const e = [via([P(-650, 0), P(650, 0)], 'primary')];
  for (let i = -6; i <= 6; i++) e.push(via([P(i * 100, -90), P(i * 100, 90)]));
  e.push(via([P(-650, 60), P(650, 60)]));
  e.push(via([P(-650, -60), P(650, -60)]));
  return e;
}

// ── Plato roto: rumbos y posiciones al azar, con semilla fija ────────────
function platoRoto() {
  let x = 12345;
  const rnd = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
  const e = [];
  for (let i = 0; i < 90; i++) {
    const d = rnd() * 550, a = rnd() * 2 * Math.PI, ang = rnd() * 2 * Math.PI, L = 60 + rnd() * 120;
    const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
    e.push(via([P(cx - Math.cos(ang) * L / 2, cy - Math.sin(ang) * L / 2),
                P(cx + Math.cos(ang) * L / 2, cy + Math.sin(ang) * L / 2)]));
  }
  return e;
}

function girar(els, grados) {
  const a = grados * Math.PI / 180;
  return els.map(e => Object.assign({}, e, { geometry: e.geometry.map(p => {
    const x = (p.lng - C.lng) * 111320 * Math.cos(C.lat * Math.PI / 180);
    const y = (p.lat - C.lat) * 110540;
    return P(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
  }) }));
}
function correr(els, dx, dy) {
  return els.map(e => Object.assign({}, e, { geometry: e.geometry.map(p =>
    ({ lat: p.lat + GLAT(dy), lng: p.lng + GLNG(dx) })) }));
}

const CASOS = [
  { n: 'damero de calles cada 100 m', esperado: 'ortogonal', els: ortogonal() },
  { n: '16 radios y 4 anillos', esperado: 'radial', els: radial(2 * Math.PI) },
  { n: 'media circunferencia contra un borde', esperado: 'mediaNaranja', els: radial(Math.PI) },
  { n: 'un eje con calles transversales', esperado: 'lineal', els: lineal() },
  { n: 'noventa calles al azar', esperado: 'platoRoto', els: platoRoto() },
  /* Un damero GIRADO 30°. Si la clasificación mirara los rumbos absolutos
     en vez de su concentración, esto dejaría de ser ortogonal — y no hay
     ninguna razón para que la forma de una traza dependa de dónde queda el
     norte. */
  { n: 'el mismo damero, girado 30°', esperado: 'ortogonal', els: girar(ortogonal(), 30) },
  /* Una radial vista DESCENTRADA, que es el caso real: nadie analiza justo
     sobre la plaza. A 400 m del centro la convergencia no se ve, y lo
     honesto es dejar de llamarla radial. Lo que NO puede pasar —y es lo que
     esta prueba vigila— es que se llame ortogonal: eso sería inventarle al
     estudiante un damero donde hay una radial mal encuadrada. */
  { n: 'una radial mirada a 400 m de su centro', esperado: 'platoRoto',
    els: correr(radial(2 * Math.PI), 400, 0) }
];

const ok = [], fallo = [];
const chk = (c, t) => (c ? ok : fallo).push(t);

console.log('\n── Las cinco formas ────────────────────────────────────────');
CASOS.forEach(c => {
  const t = MOTOR.analizarTrazado({ elementos: c.els, centro: C, radioM: R });
  const f = (t.morfologia || {}).forma;
  const m = (f && f.medidas) || {};
  console.log('  ' + c.n.padEnd(38) + ' → ' + String(f && f.nombre).padEnd(15) +
    'orden ' + m.orden + ' · radial ' + m.pctRadial + '% · anillo ' + m.pctAnillo +
    '% · sectores ' + m.sectoresConVia + ' · elongación ' + m.elongacion);
  chk(f && f.id === c.esperado,
      c.n + ' → ' + c.esperado + ' (' + (f ? f.id : 'sin forma') + ')');
  chk(!!(f && f.porque && f.porque.length > 20),
      '  y dice con qué medida lo decidió, no solo la etiqueta');
});

// La advertencia no es opcional: sin ella un estudiante lee «ortogonal» y
// concluye algo sobre su ciudad que su sector no puede sostener.
const uno = MOTOR.analizarTrazado({ elementos: ortogonal(), centro: C, radioM: R });
// A la defensiva: contra el motor anterior `forma` no existe, y una suite
// que revienta no reporta nada — solo se cae.
const f1 = ((uno || {}).morfologia || {}).forma || {};
console.log('\n  ' + (f1.advertencia || '(sin advertencia)'));
chk(/dentro del radio analizado/.test(f1.advertencia || ''),
    'la forma viaja con la advertencia de que describe el radio, no la ciudad');
chk(!!(f1.descripcion && /damero|perpendicular/i.test(f1.descripcion)),
    'y con la descripción de qué implica esa forma, que es lo que se enseña');

// Sin vías no se inventa una forma.
const vacio = MOTOR.analizarTrazado({ elementos: [], centro: C, radioM: R });
chk(((vacio || {}).morfologia || {}).forma === null,
    'sin vías con geometría no se inventa ninguna forma');

// La lectura vieja sigue ahí: esto añade, no reemplaza.
chk(/cuadrícula/i.test(((uno || {}).morfologia || {}).lectura || ''),
    'la lectura de siempre sigue saliendo junto a la forma nueva');

console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
process.exit(fallo.length ? 1 : 0);
