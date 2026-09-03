/* URBIS · Revisión del sitio, sin navegador y sin instalar nada
       node pruebas/revisar.js        (desde la raíz del repositorio)

   Cada comprobación de acá corresponde a un error que YA PASÓ. Ninguna es
   hipotética, y todas comparten la misma forma: el sitio seguía funcionando
   igual de bien, así que nadie se iba a enterar.

     1. Se quitó js/60 de la carpeta y quedó en la lista de precarga del
        service worker. `cache.addAll` rechaza el lote entero si falta UN
        archivo, y el `.catch` se lo tragaba: el modo sin conexión moría
        entero y en silencio.
     2. js/62 llamaba al puente (js/66) en vez de al motor del navegador
        (js/67), saltándose el archivado de usos sin categoría. El análisis
        salía perfecto; la bandeja de pendientes no se llenaba nunca.
     3. js/67 se armó copiando trozos de js/60 y se quedaron atrás cuatro
        constantes. Cada una solo aparecía cuando alguien tocaba justo esa
        función, y un `catch` vacío escondía la primera.
     4. Las reglas de clasificación son el producto. Que no vuelvan al
        navegador por descuido.
     5. El token de versión va en cinco archivos. Si uno se queda viejo, los
        navegadores sirven una mezcla de dos versiones. */
'use strict';

const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const R = f => path.join(RAIZ, f);
const leer = f => fs.readFileSync(R(f), 'utf8');

let fallos = 0;
function comprobar(nombre, ok, detalle) {
  console.log('  ' + (ok ? '\u2713' : '\u2717') + ' ' + nombre + (detalle ? '  \u2014 ' + detalle : ''));
  if (!ok) fallos++;
}

// ── 1. la lista de precarga apunta a archivos que existen ────────────────
console.log('\n  -- el modo sin conexión --');
{
  const sw = leer('service-worker.js');
  const listados = [...new Set([...sw.matchAll(
    /['"]([^'"\s]+\.(?:html|js|css|json|png|svg|webmanifest))(?:\?[^'"]*)?['"]/g)].map(m => m[1]))];
  const faltan = listados.filter(f => !fs.existsSync(R(f.replace(/^\.?\//, ''))));
  comprobar('todo lo que se precarga existe',
    faltan.length === 0,
    faltan.length ? 'FALTAN: ' + faltan.join(', ') : listados.length + ' archivos');
}

// ── 2. una sola puerta al servidor ───────────────────────────────────────
console.log('\n  -- una sola puerta al servidor --');
{
  const PUERTA = '67-analisis-cliente.js';
  const cuelan = fs.readdirSync(R('js'))
    .filter(f => f.endsWith('.js') && f !== PUERTA)
    .filter(f => /AIA_REMOTO\s*\.\s*analizar/.test(leer('js/' + f)));
  comprobar('solo js/' + PUERTA + ' llama al puente (js/66)',
    cuelan.length === 0,
    cuelan.length ? 'también: ' + cuelan.join(', ') : 'ningún otro archivo');
}

// ── 3. identificadores que se usan y no se declaran ──────────────────────
console.log('\n  -- identificadores sueltos --');
{
  const globales = new Set(Object.getOwnPropertyNames(globalThis).concat(
    ('window localStorage sessionStorage document console navigator fetch setTimeout clearTimeout ' +
     'setInterval clearInterval AbortController performance CustomEvent Event location history ' +
     'alert confirm prompt crypto btoa atob requestAnimationFrame matchMedia innerWidth innerHeight ' +
     'addEventListener removeEventListener getComputedStyle FileReader Blob URL Image L Chart ' +
     // `map` es el mapa de Leaflet de URBIS, que se declara en el arranque de
     // la app y usan casi todos los módulos. Es un global de verdad, no un
     // olvido: si no estuviera acá, todo archivo que toque el mapa daría falso.
     'map').split(' '),
    ('get set var let const function return if else for while do break continue switch case default ' +
     'new typeof instanceof delete void in of try catch finally throw class extends super this null ' +
     'true false undefined async await yield static').split(' ')));

  /* Deja el código sin textos, comentarios ni expresiones regulares, en UNA
     pasada. Antes se hacía con varios `replace` encadenados y se rompía: una
     comilla doble dentro de una expresión regular —`.replace(/"/g, ...)`, que
     es código perfectamente normal— quedaba huérfana, y el borrado de textos
     se comía desde ahí hasta la siguiente comilla del archivo. El resultado
     eran cuarenta identificadores inventados. Reconocer qué es cada cosa
     exige leer de izquierda a derecha, así que se lee. */
  function despejar(src) {
    let out = '', i = 0;
    const n = src.length;
    // Lo que puede ir ANTES de una `/` que abre expresión regular. Si lo que
    // hay antes es un valor (nombre, número, paréntesis cerrado), la `/` es
    // una división.
    const ABRE = /[({[,;:!&|?+\-*%~^=<>]$/;
    const PALABRA = /\b(return|typeof|instanceof|case|in|of|new|delete|void|do|else|yield|await|throw)$/;

    function esRegex() {
      const prev = out.replace(/\s+$/, '');
      if (!prev) return true;
      return ABRE.test(prev) || PALABRA.test(prev);
    }

    while (i < n) {
      const c = src[i], d = src[i + 1];

      if (c === '/' && d === '/') {                       // comentario de línea
        while (i < n && src[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && d === '*') {                       // comentario de bloque
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
        i += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {           // texto
        const cierre = c;
        i++;
        while (i < n && src[i] !== cierre) {
          if (src[i] === '\\') i++;
          else if (src[i] === '\n') out += '\n';         // plantillas multilínea
          i++;
        }
        i++;
        out += '0';                                        // un valor cualquiera
        continue;
      }
      if (c === '/' && esRegex()) {                        // expresión regular
        i++;
        let enClase = false;
        while (i < n && (enClase || src[i] !== '/')) {
          if (src[i] === '\\') i++;
          else if (src[i] === '[') enClase = true;
          else if (src[i] === ']') enClase = false;
          else if (src[i] === '\n') break;                 // sin cerrar: era división
          i++;
        }
        i++;
        while (i < n && /[gimsuyd]/.test(src[i])) i++;
        out += '0';
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  function sueltos(rel) {
    const src = despejar(leer(rel));

    const decl = new Set();
    const add = n => { if (n) decl.add(n); };
    // var/let/const admiten varios declaradores y desestructuración; se parte
    // por comas de nivel cero para no cortar dentro de {} o ().
    for (const m of src.matchAll(/\b(?:var|let|const)\s+([^;\n]+)/g)) {
      let hondo = 0, buf = '';
      const partes = [];
      for (const ch of m[1]) {
        if ('([{'.includes(ch)) hondo++;
        if (')]}'.includes(ch)) hondo--;
        if (ch === ',' && hondo === 0) { partes.push(buf); buf = ''; } else buf += ch;
      }
      partes.push(buf);
      partes.forEach(p => (p.split('=')[0].match(/[A-Za-z_$][\w$]*/g) || []).forEach(add));
    }
    for (const m of src.matchAll(/\bfunction\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g)) {
      add(m[1]); (m[2].match(/[A-Za-z_$][\w$]*/g) || []).forEach(add);
    }
    for (const m of src.matchAll(/\(([^()]*)\)\s*=>/g)) (m[1].match(/[A-Za-z_$][\w$]*/g) || []).forEach(add);
    for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) add(m[1]);
    for (const m of src.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
    for (const m of src.matchAll(/\bfor\s*\(\s*(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s+(?:of|in)\b/g)) add(m[1]);

    const vistos = new Map();
    src.split('\n').forEach((ln, i) => {
      const s = ln.replace(/\.\s*([A-Za-z_$][\w$]*)/g, ' ')     // .propiedad
                  .replace(/([A-Za-z_$][\w$]*)\s*:/g, ' ');     // {clave:
      for (const m of s.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
        const n = m[1];
        if (decl.has(n) || globales.has(n) || vistos.has(n)) continue;
        vistos.set(n, i + 1);
      }
    });
    return [...vistos].map(([n, l]) => n + ' (línea ' + l + ')');
  }

  // Los archivos del análisis, que son los que se partieron en dos. El resto
  // del sitio queda fuera a propósito: da falsos positivos que enseñan a
  // ignorar la salida, y una revisión que se ignora no revisa nada.
  ['js/59-analisis-ia-catalogo.js', 'js/66-analisis-remoto.js', 'js/67-analisis-cliente.js',
   'js/61-analisis-ia-datos.js', 'js/64-analisis-edu.js', 'servidor/motor-reglas.js',
   'js/68-procity-reconocimiento.js']
  .forEach(f => {
    const s = sueltos(f);
    comprobar(f, s.length === 0, s.length ? s.join(', ') : 'ninguno');
  });
}

// ── 4. las reglas no volvieron al navegador ──────────────────────────────
console.log('\n  -- las reglas siguen del lado del servidor --');
{
  const servidos = [];
  (function recorrer(dir) {
    fs.readdirSync(R(dir), { withFileTypes: true }).forEach(e => {
      if (e.name === 'servidor' || e.name === 'pruebas' || e.name === '.git' || e.name === 'node_modules') return;
      const rel = dir ? dir + '/' + e.name : e.name;
      if (e.isDirectory()) recorrer(rel);
      else if (/\.(js|html)$/.test(e.name)) servidos.push(rel);
    });
  })('');

  const conClasificador = servidos.filter(f => /\bclasificarPOI\b|\bpuntajePOI\b/.test(leer(f)));
  comprobar('ningún archivo servido trae el clasificador',
    conClasificador.length === 0,
    conClasificador.length ? conClasificador.join(', ') : servidos.length + ' archivos revisados');

  const cat = leer('js/59-analisis-ia-catalogo.js');
  comprobar('el catálogo público no trae reglas de reconocimiento',
    !/\bm\s*:\s*\{/.test(cat), 'js/59');
}

// ── 5. el token de versión, el mismo en los cinco archivos ───────────────
console.log('\n  -- la versión --');
{
  const CINCO = ['service-worker.js', 'index.html', 'css/main.css', 'analisis-ia.html', 'seguimiento.html'];
  const tokens = new Map();
  CINCO.forEach(f => {
    const t = leer(f);
    const m = f === 'service-worker.js' ? t.match(/urbis-v([\w-]+)/) : t.match(/[?&]v=([\w-]+)/);
    tokens.set(f, m ? m[1] : '(ninguno)');
  });
  const distintos = [...new Set(tokens.values())];
  comprobar('los cinco archivos llevan la misma versión',
    distintos.length === 1,
    distintos.length === 1 ? distintos[0]
      : [...tokens].map(([f, v]) => f + '=' + v).join('  '));

  const idx = leer('index.html');
  const decl = (idx.match(/URBIS_APP_VERSION\s*=\s*'([\w-]+)'/) || [])[1];
  comprobar('y window.URBIS_APP_VERSION dice lo mismo',
    decl === tokens.get('index.html'), decl || '(no está)');
}

console.log('\n  ' + (fallos ? fallos + ' comprobaciones fallaron' : 'todas las comprobaciones pasaron') + '\n');
process.exit(fallos ? 1 : 0);
