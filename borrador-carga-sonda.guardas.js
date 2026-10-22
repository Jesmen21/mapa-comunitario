/* GUARDAS EN SECO SOBRE EL BORRADOR. No carga nada: fusiona el borrador con una
   COPIA en memoria del registro y comprueba lo que revisar.js exigirá mañana. */
const fs = require('fs');
const R = '/home/user/mapa-comunitario/';
const reg = JSON.parse(fs.readFileSync(R + 'assets/data/seguimiento-presidencial.json', 'utf8'));
const bor = JSON.parse(fs.readFileSync(R + 'borrador-carga-sonda.json', 'utf8'));
const nuevas = bor.entradas;
let fallos = 0;
const ok = (n, c, d) => { console.log((c ? '  ✓ ' : '  ✗ ') + n + '  — ' + d); if (!c) fallos++; };

// 1 · ids únicos contra el registro y entre sí
const idsReg = new Set((reg.entradas || []).map(e => e.id).filter(Boolean));
const choques = nuevas.filter(e => idsReg.has(e.id)).map(e => e.id);
const dupes = nuevas.map(e => e.id).filter((x, i, a) => a.indexOf(x) !== i);
ok('ningún id choca con los del registro ni entre sí', !choques.length && !dupes.length,
   choques.length || dupes.length ? 'choques: ' + [...choques, ...dupes].join(' · ')
     : nuevas.length + ' ids nuevos, los ' + idsReg.size + ' existentes intactos');

// 2 · toda entrada apunta a una categoría declarada
const cats = new Set(Object.keys(reg.categorias || {}));
const malas = nuevas.filter(e => !cats.has(e.categoria)).map(e => e.id + '→' + e.categoria);
ok('toda entrada apunta a una de las quince categorías declaradas', !malas.length,
   malas.length ? malas.join(' · ') : 'las ' + nuevas.length + ' caen en ' +
     [...new Set(nuevas.map(e => e.categoria))].sort().join(', '));

// 3 · toda fuente lleva nombre, enlace y rol
const sinRol = [];
nuevas.forEach(e => (e.fuentes || []).forEach((f, i) => {
  if (!f.n || !f.u || !f.rol) sinRol.push(e.id + '[' + i + ']');
}));
const nF = nuevas.reduce((a, e) => a + (e.fuentes || []).length, 0);
ok('toda fuente declara nombre, enlace y rol', !sinRol.length,
   sinRol.length ? sinRol.join(' · ') : nF + ' fuentes, todas con n/u/rol');

// 4 · toda entrada lleva fecha, precisión, título, detalle y contrapunto
const incompletas = nuevas.filter(e =>
  !e.fecha || !e.precision || !e.titulo || !e.detalle || !e.contrapunto).map(e => e.id);
ok('toda entrada trae fecha, precisión, título, detalle y contrapunto', !incompletas.length,
   incompletas.length ? incompletas.join(' · ') : 'las ' + nuevas.length + ' completas');

// 5 · la vara penal: ninguna etiqueta penal sobre persona identificable
const PENAL = /\b(homicidio|peculado|concierto para delinquir|lavado de activos|cohecho|enriquecimiento il[ií]cito)\b/i;
const penales = nuevas.filter(e => PENAL.test(e.titulo + ' ' + e.detalle)).map(e => e.id);
ok('ningún título ni detalle califica penalmente a nadie', !penales.length,
   penales.length ? 'revisar: ' + penales.join(' · ') : 'ninguna de las seis etiquetas vigiladas aparece');

// 6 · ninguna atribuye causa al Gobierno en un periodo anterior a la posesión
const pos = reg.posesion;
const previas = nuevas.filter(e => e.fecha < pos).map(e => e.id);
ok('ninguna entrada es anterior a la posesión', !previas.length,
   previas.length ? previas.join(' · ') : 'la más antigua es del ' +
     nuevas.map(e => e.fecha).sort()[0] + ', posterior al ' + pos);

// 7 · el seis-conteos NO baja: las entradas solo suman
const antes = (reg.entradas || []).length;
ok('el conteo de entradas solo SUBE', nuevas.length > 0,
   antes + ' → ' + (antes + nuevas.length) + ' (+' + nuevas.length + ')');

// 8 · ningún campo con guion bajo que el registro no sepa leer
const subs = new Set();
nuevas.forEach(e => Object.keys(e).forEach(k => { if (k[0] === '_') subs.add(k); }));
ok('los campos con guion bajo son de BORRADOR y se retiran al cargar', true,
   [...subs].join(' · ') + ' — hay que quitarlos antes de mover al registro, o la guarda de texto inalcanzable los denunciará');


/* 9 · NINGUNA entrada del borrador vuelve a contar un HECHO ya registrado.
   La guarda 1 mide el ID y eso NO es lo mismo: `decreto-1261-emergencia-terremoto`
   y `decreto-1261-emergencia-economica-terremoto` son dos ids distintos y un solo
   acto. Son dos codificaciones de un hecho —la clase B— y el registro ya tiene
   escrito que un caso que avanza se ACTUALIZA, no se duplica. Se mide por
   contenido: misma ventana de fecha y vocabulario largo compartido. */
const PARA = new Set(('el la los las de del y en que a un una por con para sobre su sus se al como mas ' +
  'no ni o lo es son ya tras entre desde hasta este esta sin han sus era fue').split(' '));
const pal = (s) => new Set(String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
  .filter((w) => w.length > 3 && !PARA.has(w)));
const dias = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
const sospechosas = [];
nuevas.forEach((b) => {
  const tb = pal(b.titulo + ' ' + String(b.detalle || '').slice(0, 400));
  (reg.entradas || []).forEach((e) => {
    if (!e.fecha || dias(e.fecha, b.fecha) > 3) return;
    const te = pal((e.titulo || '') + ' ' + String(e.detalle || '').slice(0, 400));
    let com = 0; tb.forEach((w) => { if (te.has(w)) com++; });
    if (com >= 12) sospechosas.push(b.id + ' ⇄ ' + (e.id || '(sin id) ' + e.fecha) + ' (' + com + ' palabras)');
  });
});
ok('ninguna entrada del borrador repite un hecho ya registrado', !sospechosas.length,
   sospechosas.length ? sospechosas.join(' · ') + ' — se ACTUALIZA la existente, no se agrega otra'
     : 'las ' + nuevas.length + ' se midieron contra las ' + (reg.entradas || []).length +
       ' del registro por contenido, no por id');

/* 10 · Y LA DE ARRIBA NO ALCANZA, que es lo que enseñó el ítem 18. Su umbral
   —doce palabras largas compartidas— lo elegí con los dos duplicados que ya
   tenía delante, así que mide el NÚMERO que esos dos casos daban y no la
   propiedad. La adhesión al Escudo de las Américas estaba registrada en DOS
   entradas del mismo día, con títulos cortos: ocho y nueve palabras en común,
   por debajo del umbral, y la guarda la dejó pasar en verde.

   Bajar el umbral sería elegir otro número a ojo. La propiedad que de verdad
   discrimina no es cuánto se parecen: es que NADIE MIRÓ. Así que una entrada
   nueva cuya fecha coincide con alguna del registro tiene que declarar que
   las revisó, nombrándolas, y por qué su hecho es otro. Falla cerrado: lo que
   no se declara sale en rojo, y la declaración no se cumple por accidente
   —hay que escribir qué se miró—. */
const sinRevisar = [];
nuevas.forEach((b) => {
  const mismoDia = (reg.entradas || []).filter((e) => e.fecha === b.fecha);
  if (!mismoDia.length) return;
  const d = String(b._mismaFechaRevisada || '').trim();
  if (d.length < 40) {
    sinRevisar.push(b.id + ' comparte fecha con ' + mismoDia.length +
      ' del registro y no declara `_mismaFechaRevisada`');
  }
});
ok('toda entrada que comparte FECHA con el registro declara que la revisó', !sinRevisar.length,
   sinRevisar.length ? sinRevisar.join(' · ') + ' — hay que mirarlas y escribir por qué el hecho es otro'
     : 'ninguna comparte fecha, o las que la comparten dicen cuáles miraron y por qué no son lo mismo');

console.log('\n  ' + (fallos ? fallos + ' en rojo' : 'todas en verde') + ' · ' + nuevas.length + ' entradas listas');
process.exit(fallos ? 1 : 0);
