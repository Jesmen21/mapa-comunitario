/* Comprueba, SIN Google de por medio, que el Apps Script hace cumplir de quién
   es cada emprendimiento (la regla de herramientas/regla-vitrina-servidor.md).

   Uso:  node herramientas/probar-regla-vitrina.js /ruta/al/urbis-auth.gs

   El .gs NO vive en este repositorio y no debe entrar nunca: lleva el secreto
   de administración dentro. Se exporta del editor de Apps Script a una carpeta
   de fuera, se le pasa la ruta a esto, y se borra. Esta prueba no imprime nada
   del archivo: solo carga sus funciones, les pone una hoja de mentira delante
   y les pregunta quién puede escribir qué.                                   */
const fs = require('fs'), vm = require('vm'), path = require('path');

const ruta = process.argv[2];
if (!ruta || !fs.existsSync(ruta)) {
  console.log('Falta la ruta al Apps Script exportado.\n' +
              '  node herramientas/probar-regla-vitrina.js /ruta/al/urbis-auth.gs');
  process.exit(2);
}

const ctx = { console };
vm.createContext(ctx);
try {
  vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx, { filename: path.basename(ruta) });
} catch (e) {
  console.log('Ese archivo no se pudo leer como JavaScript: ' + e.message);
  process.exit(2);
}
for (const f of ['dbWrite_', 'dbUpdate_', 'dbDelete_', '_esFilaVitrina_']) {
  if (typeof ctx[f] !== 'function') { console.log('No parece el Apps Script de URBIS: falta ' + f); process.exit(2); }
}
if (typeof ctx._vitPuedeConFila_ !== 'function') {
  console.log('El parche de la vitrina NO está puesto: falta _vitPuedeConFila_.\n' +
              'Está en herramientas/regla-vitrina-servidor.md, bloque 1.');
  process.exit(1);
}

// ── La hoja de mentira ────────────────────────────────────────────────────
const P = 'VITRINA_URBIS:';
const sobre = o => P + encodeURIComponent(JSON.stringify(o));
const base = { emoji:'🛍️', lema:'', descripcion:'', telefono:'', whatsapp:'',
               direccion:'', horario:'', color:'#e6b800', estado:'visible' };
const A = Object.assign({}, base, { id:'A', nombre:'Arepas', duenio:'uno' });
const B = Object.assign({}, base, { id:'B', nombre:'Bicis',  duenio:'dos' });
const HDR = ['tipo', 'lat', 'lng', 'descripcion', 'fecha'];
let filas;
const reset = () => { filas = [
  ['🛍️ Emprendimiento URBIS', '10', '-70', sobre(A), '2026-09-01'],
  ['🛍️ Emprendimiento URBIS', '11', '-71', sobre(B), '2026-09-01'],
  ['🛍️ Portafolio URBIS', 'A', '0', 'arepa~~~2000', '2026-09-01'],
  ['🛍️ Portafolio URBIS', 'B', '0', 'bici~~~500000', '2026-09-01']
]; };
ctx.reportesSheet_ = () => ({
  getLastRow: () => filas.length + 1,
  getLastColumn: () => 5,
  getRange: (r, c, nr, nc) => ({
    getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) {
      const f = (r + i === 1) ? HDR : filas[r + i - 2]; out.push(f.slice(c - 1, c - 1 + (nc || 1))); } return out; },
    setValues: v => { for (let i = 0; i < v.length; i++) { const t = r + i - 2;
      if (!filas[t]) filas[t] = ['', '', '', '', '']; for (let j = 0; j < v[i].length; j++) filas[t][c - 1 + j] = v[i][j]; } },
    setNumberFormat: () => {},
    setValue: v => { filas[r - 2][c - 1] = String(v); }
  }),
  deleteRow: r => { filas.splice(r - 2, 1); }
});
// Las sesiones, sin tocar la hoja de usuarios ni ningún token de verdad.
const QUIEN = {
  tuno:   { usuario:'uno',   correo:'', esAdmin:false, esDueno:false, permisos:['vitrina'] },
  tdos:   { usuario:'dos',   correo:'', esAdmin:false, esDueno:false, permisos:['vitrina'] },
  tadmin: { usuario:'admin', correo:'', esAdmin:true,  esDueno:true,  permisos:[] },
  tnadie: { usuario:'nadie', correo:'', esAdmin:false, esDueno:false, permisos:[] }
};
ctx._quienEscribe_ = b => QUIEN[String((b && b.session_token) || '')] || null;

// ── Las preguntas ─────────────────────────────────────────────────────────
let ok = 0, mal = 0;
const di = (t, cond, extra) => { if (cond) { ok++; console.log('  ✓ ' + t); }
  else { mal++; console.log('  ✗ ' + t + (extra ? '  → ' + JSON.stringify(extra) : '')); } };
const upd = (tok, col, value, set) => ctx.dbUpdate_({ session_token: tok, col, value, set });
const del = (tok, col, value) => ctx.dbDelete_({ session_token: tok, col, value });
const esc = (tok, fila) => ctx.dbWrite_({ session_token: tok, fila });
const con = (n, cambio) => sobre(Object.assign({}, n, cambio));
let r;

console.log('\nRegla de la vitrina en el servidor · ' + path.basename(ruta) + '\n');
reset(); di('@uno edita SU ficha', upd('tuno', 'descripcion', sobre(A), { descripcion: con(A, { telefono:'300' }) }).updated === 1);
reset(); r = upd('tuno', 'descripcion', sobre(B), { descripcion: con(B, { nombre:'Robado' }) });
di('@uno NO edita la de @dos', r.ok === false && filas[1][3] === sobre(B), r);
reset(); r = upd('tuno', 'descripcion', sobre(A), { descripcion: con(A, { duenio:'otro' }) });
di('@uno NO se traspasa el negocio', r.ok === false, r);
reset(); r = upd('tuno', 'descripcion', sobre(A), { descripcion: con(A, { estado:'borrador' }) });
di('@uno NO cambia el estado: publicar es de URBIS', r.ok === false, r);
reset(); r = esc('tuno', { tipo:'🛍️ Emprendimiento URBIS', lat:'12', lng:'-72', descripcion: sobre({ id:'C', duenio:'uno' }) });
di('@uno NO da de alta un emprendimiento', r.ok === false && filas.length === 4, r);
reset(); r = esc('tuno', { tipo:'🛍️ Portafolio URBIS', lat:'B', lng:'0', descripcion:'colado~~~1' });
di('@uno NO le añade productos al de @dos', r.ok === false && filas.length === 4, r);
reset(); r = esc('tuno', { tipo:'🛍️ Portafolio URBIS', lat:'A', lng:'0', descripcion:'empanada~~~1500' });
di('@uno SÍ le añade productos al suyo', r.ok === true && filas.length === 5, r);
reset(); r = del('tuno', 'descripcion', 'bici~~~500000');
di('@uno NO borra el producto de @dos', r.ok === false && filas.length === 4, r);
reset(); r = del('tuno', 'descripcion', 'arepa~~~2000');
di('@uno SÍ borra el suyo', r.deleted === 1 && filas.length === 3, r);
reset(); r = del('tuno', 'descripcion', sobre(A));
di('@uno NO borra el emprendimiento entero', r.ok === false && filas.length === 4, r);
reset(); di('el administrador edita cualquiera', upd('tadmin', 'descripcion', sobre(B), { descripcion: con(B, { estado:'pausado' }) }).updated === 1);
reset(); di('el administrador da de alta emprendimientos', esc('tadmin', { tipo:'🛍️ Emprendimiento URBIS', lat:'12', lng:'-72', descripcion: sobre({ id:'C', duenio:'uno' }) }).ok === true);
reset(); r = esc('tnadie', { tipo:'🛍️ Portafolio URBIS', lat:'A', lng:'0', descripcion:'x~~~1' });
di('sin el permiso de vitrina, nada', r.ok === false && filas.length === 4, r);
reset(); r = esc('', { tipo:'🛍️ Portafolio URBIS', lat:'A', lng:'0', descripcion:'x~~~1' });
di('sin sesión, nada', r.ok === false, r);
reset(); di('y un reporte normal sigue entrando sin sesión', esc('', { tipo:'🕳️ Hueco en la vía', lat:'1', lng:'2', descripcion:'algo' }).ok === true);

console.log('\n  ' + ok + '/' + (ok + mal) + '\n');
process.exit(mal ? 1 : 0);
