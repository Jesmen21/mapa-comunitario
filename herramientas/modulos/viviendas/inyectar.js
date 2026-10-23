/* Arnés de inyecciones del módulo de viviendas.
   Tres estados y no dos (v1090): ROJO = la guarda mordió, VERDE = la guarda
   NO vio el defecto, MURIO = la inyección mató la corrida y eso no es una
   guarda que mordió. Además compara el CONTEO de palomitas contra la corrida
   limpia, que es lo que delató el ReferenceError de la v1090. */
const fs = require('fs'), cp = require('child_process');
/* Se corre con `node herramientas/modulos/viviendas/inyectar.js` desde donde
   sea: la raíz sale de este archivo y no de un camino escrito, y el módulo se
   busca en las DOS rutas —la de espera y la de js/— igual que la guarda, para
   que el día que la cabeza lo mueva el arnés siga funcionando. */
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..', '..');
const MOD = [path.join(RAIZ, 'js', '83-viviendas.js'),
             path.join(RAIZ, 'herramientas', 'modulos', 'viviendas', '83-viviendas.js')]
  .find((r) => fs.existsSync(r));
if (!MOD) { console.error('no está el módulo en ninguna de las dos rutas'); process.exit(1); }
const original = fs.readFileSync(MOD, 'utf8');

function correr() {
  try {
    return cp.execSync('node pruebas/revisar.js', { cwd: RAIZ, stdio: ['ignore','pipe','pipe'] }).toString();
  } catch (e) { return (e.stdout || '').toString() + (e.stderr || '').toString(); }
}
const limpio = correr();
const VERDES_LIMPIO = (limpio.match(/✓/g) || []).length;
console.log('corrida limpia: ' + VERDES_LIMPIO + ' palomitas\n');

const CASOS = [
  ['MATERIAL · el módulo de viviendas se deja cargar',
   'el archivo no existe — el estado real de la v1161', null],

  ['todo tipo de vivienda que se publica existe en la Matriz',
   'un tipo que URBIS vende y la Matriz no mapea',
   [`    'VIS multifamiliar'\n  ];`, `    'VIS multifamiliar',\n    'Penthouse de lujo'\n  ];`]],

  ['cada clave del análisis que una fortaleza puede citar existe',
   'una clave con fuente inventada, que es lo que la regla 7 prohíbe',
   [`ancla: 'Horas de sol al año'`, `ancla: 'Índice de caminabilidad URBIS'`]],

  ['una cifra sin medir imprime SIN MEDIR',
   'el ausente impreso como cero, que es la confusión de la v875',
   [`    if (c.v === null) return 'SIN MEDIR';`, `    if (c.v === null) return '0 ' + (campo.unidad || '');`]],

  ['sin precisión declarada no publica',
   'el campo sin exigir: publica entregando la puerta sin que nadie lo decidiera',
   [`{ c: 'precisionPunto',   q: 'opcion', exigido: true,`, `{ c: 'precisionPunto',   q: 'opcion', exigido: false,`]],

  ['ningún campo que el esquema reserva sale',
   'paraPublicar deja de mirar `publico` y lo emite todo',
   [`      if (!campo.publico) continue;`, `      if (false) continue;`]],

  ['lo que la decisión de Daniel prohíbe publicar no se publica',
   'la dirección exacta marcada pública, que es la decisión 3 rota',
   [`{ c: 'direccionExacta',  q: 'texto',  exigido: false, publico: false }`,
    `{ c: 'direccionExacta',  q: 'texto',  exigido: false, publico: true }`]],

  ['una fortaleza dice de dónde sale',
   'sin la comprobación: «excelente ubicación» publica sin respaldo',
   [`      else if (!conBase && !conSin) errores.push(r + ' no dice de dónde sale: le falta base o sinBase con su razón');`,
    `      else if (false) errores.push(r);`]],

  ['toda vivienda publica su procedencia',
   'la procedencia fuera de lo publicado: el estado real de la v866',
   [`    fuera.procedencia = procedencia(viv);\n`, ``]],

  ['la vivienda va y vuelve del almacén igual · mitad A',
   'una clave del esquema que nombra el almacén',
   [`{ c: 'direccionPublica', q: 'texto',  exigido: true,  publico: true },`,
    `{ c: 'descripcionFila',  q: 'texto',  exigido: false, publico: false },\n    { c: 'direccionPublica', q: 'texto',  exigido: true,  publico: true },`]],

  ['la vivienda va y vuelve del almacén igual · mitad B',
   'el adaptador que pierde algo en la vuelta',
   [`      try { return nueva(JSON.parse(d.slice(PREFIJO.length))); } catch (e) { return null; }`,
    `      try { var o = JSON.parse(d.slice(PREFIJO.length)); delete o.banos; return nueva(o); } catch (e) { return null; }`]],

  ['el módulo calcula si tiene entrada en el registro',
   'el estado escrito a mano en vez de calculado, que es la v903',
   [`    if (reg[MODULO_ID]) {`, `    if (false) {`]],

  ['el arriendo está escrito con el mismo modelo',
   'el arriendo abierto sin que Daniel lo decidiera',
   [`      abierta: false,`, `      abierta: true,`]]
];

let ok = 0;
CASOS.forEach(([frag, que, par]) => {
  if (par === null) fs.unlinkSync(MOD);
  else {
    if (original.split(par[0]).length - 1 !== 1) {
      console.log('✗ ANCLA NO ÚNICA para «' + frag + '» (' + (original.split(par[0]).length - 1) + ' veces)');
      return;
    }
    fs.writeFileSync(MOD, original.replace(par[0], par[1]));
  }
  const salida = correr();
  if (par === null) fs.writeFileSync(MOD, original); else fs.writeFileSync(MOD, original);

  const verdes = (salida.match(/✓/g) || []).length;
  const linea = salida.split('\n').find(l => l.indexOf(frag.split(' · ')[0]) >= 0);
  let estado;
  const sinMat = /\?\s*MATERIAL · el módulo de viviendas/.test(salida);
  if (!salida.includes('comprobaciones')) estado = 'MURIO';
  else if (frag.startsWith('MATERIAL') && sinMat) estado = 'SIN MATERIAL';
  else if (!frag.startsWith('MATERIAL') && verdes < VERDES_LIMPIO - 6) estado = 'MURIO (' + verdes + ' palomitas)';
  else if (linea && linea.trim().startsWith('✗')) estado = 'ROJO';
  else if (!linea) estado = (frag.startsWith('MATERIAL') && salida.includes('?')) ? 'SIN MATERIAL' : 'VERDE (no se encontró la línea)';
  else estado = 'VERDE';

  const bien = estado === 'ROJO' || (frag.startsWith('MATERIAL') && estado === 'SIN MATERIAL');
  if (bien) ok++;
  console.log((bien ? '✓ ' : '✗ ') + estado.padEnd(14) + ' · ' + frag);
  console.log('                   inyección: ' + que);
});
fs.writeFileSync(MOD, original);
console.log('\n' + ok + ' de ' + CASOS.length + ' inyecciones mordieron');
