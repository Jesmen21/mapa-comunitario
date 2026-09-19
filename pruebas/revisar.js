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
     5. El token de versión va en siete archivos —los cinco de la app grande
        más los dos de la app ligera de reportes—. Si uno se queda viejo, los
        navegadores sirven una mezcla de dos versiones. */
'use strict';

const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const R = f => path.join(RAIZ, f);
const leer = f => fs.readFileSync(R(f), 'utf8');

let fallos = 0;
/* Dónde cae cada carácter de un archivo de JavaScript: 1 si está dentro de
   un comentario, 0 si no. Estaba dentro del bloque de la guarda del voseo y
   sube a nivel de módulo en la v926, porque hace falta en dos sitios y una
   segunda copia del recorrido divergiría a la tanda siguiente (v879). */
function fueraDeComentario(txt) {
  const com = new Uint8Array(txt.length);
  const ANTES_REGEX = /[(,=:[!&|?{};+\-*%~^<>]$/;
  let i = 0, modo = 0;   // 0 código · 1 // · 2 /* */ · 3 '…' · 4 "…" · 5 `…` · 6 /…/
  let ultimo = '';       // último carácter significativo visto en código
  while (i < txt.length) {
    const c = txt[i], d = txt[i + 1];
    if (modo === 0) {
      if (c === '/' && d === '/') { modo = 1; com[i] = com[i + 1] = 1; i += 2; continue; }
      if (c === '/' && d === '*') { modo = 2; com[i] = com[i + 1] = 1; i += 2; continue; }
      if (c === '/') {
        const prev = txt.slice(Math.max(0, i - 12), i).replace(/\s+$/, '');
        if (!prev || ANTES_REGEX.test(prev) || /\b(return|typeof|case|in|of|new|delete|void)$/.test(prev)) {
          modo = 6; i++; continue;
        }
        ultimo = '/'; i++; continue;
      }
      if (c === "'" ) { modo = 3; i++; continue; }
      if (c === '"' ) { modo = 4; i++; continue; }
      if (c === '`' ) { modo = 5; i++; continue; }
      if (!/\s/.test(c)) ultimo = c;
      i++; continue;
    }
    if (modo === 1) { com[i] = 1; if (c === '\n') modo = 0; i++; continue; }
    if (modo === 2) { com[i] = 1; if (c === '*' && d === '/') { com[i + 1] = 1; modo = 0; i += 2; continue; } i++; continue; }
    if (c === '\\') { i += 2; continue; }
    if (modo === 6) {
      /* Dentro de una clase `[...]` una barra no cierra la regex. */
      if (c === '[') { while (i < txt.length && txt[i] !== ']') { if (txt[i] === '\\') i++; i++; } i++; continue; }
      if (c === '/') { modo = 0; ultimo = ')'; i++; continue; }
      if (c === '\n') { modo = 0; i++; continue; }
      i++; continue;
    }
    if ((modo === 3 || modo === 4) && c === '\n') { modo = 0; i++; continue; }
    if ((modo === 3 && c === "'") || (modo === 4 && c === '"') || (modo === 5 && c === '`')) { modo = 0; ultimo = c; i++; continue; }
    i++;
  }
  return com;
}

/* El archivo SIN sus comentarios, para comprobar lo que el código HACE y no
   lo que alguien escribió que hace. Los caracteres de comentario se
   reemplazan por espacios y no se borran, para que las líneas sigan
   contando igual. */
function soloCodigo(txt) {
  const com = fueraDeComentario(txt);
  let out = '';
  for (let i = 0; i < txt.length; i++) out += com[i] ? (txt[i] === '\n' ? '\n' : ' ') : txt[i];
  return out;
}

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

  /* Y al revés, que es el fallo que de verdad ocurrió: nueve archivos que
     index.html carga —el módulo educativo entre ellos— no estaban en la
     lista. La app abría sin red y le faltaba media función, sin ningún
     error visible: en plena salida a campo, «Falta el módulo educativo».
     Este lado no se comprobaba porque todo lo listado sí existía. */
  const idx = leer('index.html');
  const cargados = [...new Set([...idx.matchAll(
    /(?:src|href)="((?:\.\/)?(?:js|css)\/[^"?]+)/g)].map(m => m[1].replace(/^\.\//, '')))];
  const sinCache = cargados.filter(f => !sw.includes(f));
  comprobar('y todo lo que index.html carga se precarga',
    sinCache.length === 0,
    sinCache.length ? 'SIN PRECACHE: ' + sinCache.join(', ') : cargados.length + ' archivos servidos');
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
    /* El motor vive en un repositorio PRIVADO desde que se sacó de acá
       (jesmen21/urbis-motor). Si no está clonado al lado, esta comprobación
       se salta diciéndolo: fallar por un archivo que a propósito no está
       enseñaría a ignorar la salida, y una revisión que se ignora no revisa
       nada. Con el repo clonado —o corriendo dentro de él— se comprueba
       igual que siempre. */
    const alterno = f.replace(/^servidor\//, '../urbis-motor/');
    const cual = fs.existsSync(R(f)) ? f : (fs.existsSync(R(alterno)) ? alterno : null);
    if (!cual) {
      console.log('  \u2013 ' + f + '  \u2014 no está acá (vive en el repositorio privado del motor)');
      return;
    }
    const s = sueltos(cual);
    comprobar(cual, s.length === 0, s.length ? s.join(', ') : 'ninguno');
  });
}

// ── 3d. dos funciones con el mismo nombre en el mismo archivo ────────────
/* Hermana de la comprobación 8 —dos cosas distintas con el mismo nombre en
   `window`— pero DENTRO de un archivo, que es donde nadie mira. Una función
   declarada dos veces en el mismo ámbito no da error en ninguna parte: la
   segunda pisa a la primera, y la primera queda de adorno. Quien la lee cree
   estar leyendo lo que corre.

   Salió al conectar el nombre del archivo exportado en la v885: `js/68`
   tenía `bajarPliegoDeFicha` y `abrirImpresion` declaradas DOS VECES, letra
   por letra, con `marcaURBIS` metida en medio —un trozo pegado dos veces—.
   Al buscarlo en los demás archivos aparecieron dos más, y las dos con
   cuerpos DISTINTOS: `bloqueOportunidad` en `js/63`, donde ganaba la
   maquetación nueva y la vieja se quedaba muerta, y `limpiarRuta` en
   `js/05`, donde la que gana llama a `limpiarRutaReal` —que hace lo mismo y
   más, así que ahí no había fallo, solo código que mentía sobre sí mismo—.

   Se mira solo el PRIMER nivel del módulo (dos espacios de sangría): dentro
   de una función, dos ayudantes que se llamen igual en dos ámbitos distintos
   son legítimos y corrientes —`fila`, `chip`—, y denunciarlos sería pedir
   que nadie repita un nombre en treinta mil líneas. */
console.log('\n  -- una función, un nombre --');
{
  const dobles = [];
  fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).sort().forEach(f => {
    const vistas = {};
    leer('js/' + f).split('\n').forEach((l, i) => {
      const m = /^  function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(l);
      if (m) (vistas[m[1]] = vistas[m[1]] || []).push(i + 1);
    });
    Object.keys(vistas).forEach(k => {
      if (vistas[k].length > 1) dobles.push('js/' + f + ' · ' + k + ' en ' + vistas[k].join(' y '));
    });
  });
  comprobar('ninguna función del primer nivel se declara dos veces en su archivo',
    dobles.length === 0,
    dobles.length ? dobles.slice(0, 5).join(' | ')
                  : fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).length + ' archivos revisados');
}

// ── 3e. una clase que no viste ninguna hoja de estilo ────────────────────
/* Hermana de la de arriba, y su espejo. Aquella caza un nombre que YA EXISTE
   y se reusa; esta caza un nombre que NO EXISTE y se inventa. Las dos son la
   misma equivocación —dar por sabido lo que significa un nombre— y las dos
   salieron el mismo día, de las capturas de la v892:

   * `.pcr-volver` existía: es la píldora flotante de «Volver al análisis»,
     `position:fixed` abajo a la izquierda. Reusarle el nombre al botón de la
     cabecera de la ventana del trazo lo sacó del panel y lo dejó encima de
     la lista de análisis. Eso lo caza la comprobación de duplicados, no esta.
   * `.pcr-btn` y `.pcr-btn-ir` no existían en ninguna parte. Me las inventé
     para el botón de analizar de esa misma ventana, así que la acción
     principal de toda una pantalla salió como texto suelto de 25 px de alto,
     sin fondo, sin borde. El reporte llegó así: «tampoco salía el botón de
     analizar grande». Ningún error, en ninguna consola: un nombre de clase
     que no existe es válido.

   Lo que se denuncia NO es «esta clase no tiene regla»: eso es corriente y
   legítimo —una clase puede ser un asidero para `querySelector`, o una
   etiqueta descriptiva sobre un SVG cuyos hijos sí están pintados—. Lo que
   se denuncia es un elemento en el que NINGUNA de sus clases tiene regla en
   ninguna hoja: ese elemento no está pintado por nada, y ese es el defecto.

   Los que hoy son así van en la lista de abajo, cada uno con su razón, que
   es la forma de la guarda del voseo en -á de la v880: se lista lo PERMITIDO
   y se denuncia todo lo demás. Uno nuevo cuesta un renglón y se ve en rojo
   hasta que alguien lo escriba; uno nuevo que sea un defecto se ve igual. */
console.log('\n  -- ningún elemento sin una sola clase pintada --');
{
  /* Asideros conocidos: elementos cuyas clases no pinta ninguna hoja a
     propósito. La razón va escrita porque es lo que permite juzgar si el que
     venga mañana pertenece acá o es un botón sin estilo. */
  const ASIDEROS = {
    'urbis-mobile-nav-btn': 'asidero de js/18 para encontrar los botones de la barra',
    'u52-games-ico': 'hueco donde js/20 mete el SVG; lo pinta el contenedor',
    'u52-procity-folder-pick-chk': 'la casilla de una fila ya pintada por su fila',
    'u52-app': 'el contenedor de la app móvil, pintado por su id #urbis-mobile-app',
    'pcr-detalle': '<details> nativo del navegador, sin estilo propio a propósito',
    'pcr-tab': 'nombre partido por concatenación: la clase real es pcr-tab-b',
    'pcr-carta': 'raíz de un SVG: lo que se pinta son sus trazos, no el marco',
    'pcr-rosa-rumbos': 'raíz de un SVG, igual que la carta solar',
    'pcr-plano-lote': 'raíz de un SVG, igual que la carta solar',
    'pcr-corte': 'raíz de un SVG, igual que la carta solar',
    'pcr-sombras': 'raíz de un SVG, igual que la carta solar',
    'urbis-pliego-raiz': 'la raíz del pliego, que lleva su propia hoja incrustada',
    'vt-fila-detalle': 'asidero de js/90 para leer data-sin; el texto lo pinta la fila'
  };
  const conRegla = new Set();
  fs.readdirSync(R('css')).filter(f => f.endsWith('.css')).forEach(f => {
    const s = leer('css/' + f).replace(/\/\*[\s\S]*?\*\//g, '');
    let m; const re = /\.(-?[A-Za-z_][\w-]*)/g;
    while ((m = re.exec(s)) !== null) conRegla.add(m[1]);
  });
  const PROPIA = /^(pcr|pca|vt|edu|u52|urbis)-/;
  const pelados = [];
  const archivos = fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)
    .concat(fs.readdirSync(RAIZ).filter(f => f.endsWith('.html')));
  archivos.forEach(f => {
    const s = leer(f);
    let m; const re = /class\s*=\s*(?:\\?["'])([^"'<>]*?)(?:\\?["'])/g;
    while ((m = re.exec(s)) !== null) {
      const cs = m[1].split(/\s+/).filter(c => c && !/[^\w-]/.test(c));
      if (!cs.length || !cs.some(c => PROPIA.test(c))) continue;
      if (cs.some(c => conRegla.has(c))) continue;
      if (cs.every(c => ASIDEROS[c])) continue;
      pelados.push(f + ':' + s.slice(0, m.index).split('\n').length + ' · ' + cs.join(' '));
    }
  });
  comprobar('todo elemento con clase propia tiene al menos una con regla',
    pelados.length === 0,
    pelados.length ? pelados.slice(0, 6).join(' | ')
                   : conRegla.size + ' clases con regla · ' +
                     Object.keys(ASIDEROS).length + ' asideros declarados');
}

// ── 3b bis. ningún glifo se dibuja dos veces ─────────────────────────────
/* §3 del pliego de ajustes v2, y la guarda que impide que vuelva a entrar.

   Un `<text>` de SVG con `stroke` no lleva un contorno alrededor del glifo:
   lleva una SEGUNDA PASADA DE PINTURA. Medido sobre el PDF de las dos
   láminas, cada rótulo así salía como dos bloques de texto en la MISMA
   matriz —uno blanco, glifo a glifo, y encima el de tinta—, y el lector los
   veía interlineados: «VVeerrddee nnaattuurraall», «7744,,44 ddBB((AA))».
   Catorce rótulos así en una sola corrida.

   Lo que más cuesta creer de esto es que el arreglo que el propio reporte
   proponía —«usar stroke con paint-order, no un segundo trazo de texto»— era
   EXACTAMENTE lo que el código ya hacía. `paint-order` no evita la segunda
   pasada: la ordena. Por eso la guarda no persigue `paint-order`, que sería
   perseguir un síntoma: persigue el trazo sobre el texto, venga como venga.

   Se recorre lo que se sirve al navegador —listado del disco, para que un
   archivo nuevo quede vigilado sin que su autor se acuerde— buscando la
   apertura de un `<text` y mirando hasta donde la etiqueta se cierra. El
   halo se pone SIEMPRE en la apertura, así que ahí es donde se ve.

   Lo que sustituye al halo es una plaquita opaca detrás del rótulo: se lee
   mejor sobre una foto —a cinco píxeles, un contorno de 2,4 se come el
   glifo— y no puede duplicarse, porque no hay segunda pasada que duplicar. */
console.log('\n  -- ningún glifo se dibuja dos veces --');
{
  const conHalo = [];
  const archivos = fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)
    .concat(fs.readdirSync(RAIZ).filter(f => f.endsWith('.html')));
  archivos.forEach(f => {
    const s = leer(f);
    let m; const re = /<text\b/g;
    while ((m = re.exec(s)) !== null) {
      /* Hasta donde la etiqueta de apertura se cierra. El `>` puede estar a
         varias concatenaciones de distancia, así que se mira una ventana y
         se corta en el primer `>` que no venga de un `=>` de JavaScript. */
      const trozo = s.slice(m.index, m.index + 700);
      const fin = (function () {
        for (let i = 5; i < trozo.length; i++)
          if (trozo[i] === '>' && trozo[i - 1] !== '=') return i;
        return trozo.length;
      })();
      const abre = trozo.slice(0, fin);
      if (/\bstroke\s*=|\bstroke-width\s*=|\bpaint-order\s*=/.test(abre))
        conHalo.push(f + ':' + s.slice(0, m.index).split('\n').length);
    }
  });
  comprobar('ningún <text> servido lleva trazo encima del glifo',
    conHalo.length === 0,
    conHalo.length ? conHalo.slice(0, 6).join(' | ')
                   : archivos.length + ' archivos revisados');
}

// ── 3c. los scripts sueltos de las páginas parsean ───────────────────────
/* Un `<script>` escrito dentro del HTML que no cierre bien no rompe la página:
   el navegador descarta ESE bloque y sigue como si nada. Lo que había adentro
   simplemente no existe, sin error visible en ningún lado salvo una consola
   que en un celular nadie abre.

   Se encontró así: un IIFE de index.html al que le faltaba el `})();` del
   final. Adentro estaba el código que distingue deslizar de tocar en pantalla
   táctil, y llevaba meses sin correr —en un teléfono, arrastrar el dedo por
   encima de un botón lo activaba igual—. Los archivos .js sí se revisan desde
   siempre; estos no, y por eso fue el único sitio donde algo así podía
   esconderse tanto tiempo. */
console.log('\n  -- los scripts escritos dentro de las páginas --');
{
  const { execFileSync } = require('child_process');
  const os = require('os');
  const paginas = fs.readdirSync(RAIZ).filter(f => f.endsWith('.html'));
  const rotos = [];
  let cuantos = 0;
  paginas.forEach(pag => {
    const html = leer(pag);
    const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      // Los que no son JavaScript —plantillas, JSON incrustado— no se parsean.
      if (/type\s*=\s*["']?(?!text\/javascript|module|application\/javascript)/i.test(m[1])) continue;
      cuantos++;
      const tmp = path.join(os.tmpdir(), 'urbis-suelto-' + process.pid + '-' + cuantos + '.js');
      fs.writeFileSync(tmp, m[2], 'utf8');
      try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
      catch (e) { rotos.push(pag + ':' + (html.slice(0, m.index).split('\n').length)); }
      finally { try { fs.unlinkSync(tmp); } catch (e) {} }
    }
  });
  comprobar('todos parsean', rotos.length === 0,
    rotos.length ? 'ROTOS: ' + rotos.join(', ') : cuantos + ' scripts en ' + paginas.length + ' páginas');
}

// ── 3b. las hojas de estilo no están rotas ───────────────────────────────
// Un comentario mal cerrado en CSS no da error en ninguna parte: el navegador
// se come el resto del archivo en silencio y las reglas de abajo dejan de
// existir. Pasó de verdad —una curva desapareció de la ficha— y solo se vio
// porque una prueba medía su altura.
console.log('\n  -- las hojas de estilo --');
{
  /* Los comentarios de CSS NO se anidan: dentro de uno, un `/*` es texto y
     nada más —«varios css/ *.css» aparece tal cual en un comentario de este
     repositorio—. La primera versión de esta comprobación contaba anidamiento
     y daba dos falsos positivos. Un comprobador que se equivoca enseña a
     ignorarlo, así que se lee como lee el navegador: se entra al comentario
     con el primer «/*» y se sale con el primer «* /».

     Las llaves se cuentan DESPUÉS de quitar comentarios y textos, porque un
     `content:"}"` es perfectamente legal y no desbalancea nada. */
  const hojas = fs.readdirSync(R('css')).filter(f => f.endsWith('.css'));
  const rotas = [];

  hojas.forEach(f => {
    const css = leer('css/' + f);
    let limpio = '', i = 0, enComentario = false, comentarioAbiertoEn = 0, linea = 1;
    let comilla = '';
    while (i < css.length) {
      if (css[i] === '\n') linea++;
      if (enComentario) {
        if (css.startsWith('*/', i)) { enComentario = false; i += 2; continue; }
        i++; continue;
      }
      if (comilla) {
        if (css[i] === '\\') { i += 2; continue; }
        if (css[i] === comilla) comilla = '';
        i++; continue;
      }
      if (css.startsWith('/*', i)) { enComentario = true; comentarioAbiertoEn = linea; i += 2; continue; }
      if (css[i] === '"' || css[i] === "'") { comilla = css[i]; i++; continue; }
      limpio += css[i];
      i++;
    }

    if (enComentario) { rotas.push(f + ': comentario abierto en la línea ' + comentarioAbiertoEn + ' y nunca cerrado'); return; }
    /* Un cierre de comentario suelto —sin su apertura delante— es tan grave
       como un comentario sin cerrar, y no se veía: el navegador se salta desde
       ahí hasta que logra reengancharse, y la regla que sigue desaparece sin
       que nada avise. Pasó de verdad: al partir un comentario en dos quedó un
       cierre huérfano y con él se cayó la regla que centraba los iconos. Las
       llaves seguían cuadrando, así que la comprobación de al lado no lo veía. */
    const huerfano = limpio.indexOf('*' + '/');
    if (huerfano >= 0) {
      const lineaH = css.slice(0, css.indexOf('*' + '/', huerfano)).split('\n').length;
      rotas.push(f + ': hay un cierre de comentario suelto cerca de la línea ' + lineaH +
                 ' (la regla que le sigue no se aplica)');
      return;
    }
    if (comilla) { rotas.push(f + ': hay un texto sin cerrar'); return; }
    const abre = (limpio.match(/{/g) || []).length;
    const cierra = (limpio.match(/}/g) || []).length;
    if (abre !== cierra) rotas.push(f + ': ' + abre + ' llaves abiertas y ' + cierra + ' cerradas');
  });

  comprobar('ninguna hoja tiene comentarios o llaves sin cerrar',
    rotas.length === 0, rotas.length ? rotas.join(' · ') : hojas.length + ' hojas revisadas');
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

// ── 4b. las huellas de firma de las apps de Android ──────────────────────
/* `assetlinks.json` es lo que le dice a Android que una app y este dominio son
   la misma cosa. Con una huella de mentira —el hueco que se deja al registrar
   un paquete antes de firmarlo— la app se instala y funciona, pero abre con la
   barra del navegador encima. Nadie recibe un error: simplemente se ve como
   una página web metida en un icono, que es justo lo que un APK viene a
   evitar. Por eso se comprueba acá, donde sí se ve. */
console.log('\n  -- las apps de Android --');
{
  const al = JSON.parse(leer('.well-known/assetlinks.json'));
  const HUELLA = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
  const filas = al.map(x => ({
    p: (x.target || {}).package_name || '(sin paquete)',
    h: ((x.target || {}).sha256_cert_fingerprints || [])[0] || ''
  }));
  comprobar('el JSON de enlace de activos es una lista de paquetes',
    filas.length > 0 && filas.every(f => f.p !== '(sin paquete)'),
    filas.map(f => f.p).join(', '));
  const sinFirmar = filas.filter(f => !HUELLA.test(f.h));
  comprobar('todas las apps declaradas tienen su huella real',
    sinFirmar.length === 0,
    sinFirmar.length ? sinFirmar.map(f => f.p + ' (' + (f.h.slice(0, 24) || 'vacía') + ')').join(' · ')
                     : filas.length + ' paquetes firmados');
}

// ── 5. el token de versión, el mismo en los cinco archivos ───────────────
console.log('\n  -- Visión Territorial, aparte --');
{
  /* El sexto módulo hereda la interfaz y no comparte nada más. Estas
     comprobaciones son la regla de aislamiento hecha código: si alguien
     enlaza js/12 en su página «para reusar una función», o guarda algo bajo
     una clave que ya usa otro módulo, esto lo ve antes que un usuario. */
  const pag = leer('vision-territorial.html');
  const scripts = [...pag.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
  const permitidos = /^(https:\/\/unpkg\.com\/leaflet|js\/00-config\.js|js\/71-iconos-urbis\.js|js\/90-vt-app\.js)/;
  const ajenos = scripts.filter(x => !permitidos.test(x));
  comprobar('vision-territorial.html no carga ningún módulo de index',
    scripts.length >= 3 && ajenos.length === 0, ajenos.length ? 'también: ' + ajenos.join(', ') : scripts.length + ' scripts, todos suyos');

  const vt = leer('js/90-vt-app.js');
  comprobar('js/90 no habla con el Apps Script ni toca la sesión ni los datos de los reportes',
    !/script\.google|socialAPI|URBIS_AUTH|urbis_auth_session|globalData|URBIS_SLOTS|BASE_OFFSET/.test(vt), 'js/90-vt-app.js');
  const literales = [...vt.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])([^'"]+)\1/g)].map(m => m[2]);
  const ls = (vt.match(/var LS = \{([^}]+)\}/) || [])[1] || '';
  const enLS = [...ls.matchAll(/'([^']+)'/g)].map(m => m[1]);
  const claves = literales.concat(enLS);
  const ajenas = claves.filter(k => k.indexOf('urbis_vt_') !== 0);
  comprobar('todas sus claves de almacenamiento llevan el prefijo urbis_vt_',
    claves.length >= 3 && ajenas.length === 0, ajenas.length ? 'sin prefijo: ' + ajenas.join(', ') : claves.length + ' claves');
  comprobar('un solo nombre global, el espacio del módulo (window.VT)',
    (vt.match(/window\.([A-Za-z_$][\w$]*)\s*=/g) || []).every(x => /window\.VT\s*=/.test(x)), 'js/90-vt-app.js');

  /* Umbrales, pesos y llaves: nunca en el navegador. Es lo que se vende, y
     la misma regla que ya protege al clasificador del motor de empresas. */
  const servidos = [];
  (function recorrer(dir) {
    fs.readdirSync(R(dir), { withFileTypes: true }).forEach(e => {
      if (['servidor', 'pruebas', '.git', 'node_modules', 'assets', 'herramientas'].indexOf(e.name) !== -1) return;
      const rel = dir ? dir + '/' + e.name : e.name;
      if (e.isDirectory()) recorrer(rel);
      else if (/\.(js|html|css|json)$/.test(e.name)) servidos.push(rel);
    });
  })('');
  const LLAVES = /service_role|SUPABASE_SERVICE|VT_DATABASE_URL|vt_app:|vt_migrador/;
  const UMBRALES = /peso_poblacion|peso_urgencia|peso_costo|urgencia_seguridad|costo_m2|m2_referencia|edad_verificacion_dias|cobertura_malla_min/;
  const conLlave = servidos.filter(f => LLAVES.test(leer(f)));
  const conUmbral = servidos.filter(f => UMBRALES.test(leer(f)));
  comprobar('ningún archivo servido trae la llave de la base ni sus roles',
    conLlave.length === 0, conLlave.length ? conLlave.join(', ') : servidos.length + ' archivos revisados');
  comprobar('ningún archivo servido trae las claves de umbrales ni de pesos',
    conUmbral.length === 0, conUmbral.length ? conUmbral.join(', ') : servidos.length + ' archivos revisados');
  comprobar('el esquema y el motor de Visión Territorial no están en el repositorio público',
    !fs.existsSync(R('vt')) && servidos.every(f => !/CREATE POLICY|ST_ClusterDBSCAN|enTerritorio\(/.test(leer(f))), 'carpeta vt/ ausente');

  // Ámbito propio: service worker y manifiesto suyos, y lo precargado existe.
  const sw = leer('sw-vt.js');
  const listados = [...new Set([...sw.matchAll(/['"](\.\/[^'"\s]+\.(?:html|js|css|json|png))['"]/g)].map(m => m[1]))];
  const faltan = listados.filter(f => !fs.existsSync(R(f.replace(/^\.\//, ''))));
  const locales = scripts.filter(x => !/^https?:/.test(x)).concat([...pag.matchAll(/href="(css\/[^"?]+)/g)].map(m => m[1]));
  const sinCache = locales.filter(f => !sw.includes('./' + f));
  comprobar('todo lo que sw-vt.js precarga existe, y todo lo local que la página carga está precargado',
    faltan.length === 0 && sinCache.length === 0, (faltan.length ? 'FALTAN: ' + faltan.join(', ') + ' ' : '') + (sinCache.length ? 'SIN PRECACHE: ' + sinCache.join(', ') : listados.length + ' archivos'));
  comprobar('se registra con su propio ámbito y no toca el del sitio',
    /register\(\s*'sw-vt\.js[^)]*scope:\s*'\/vision-territorial'/.test(vt)
    // Los ARCHIVOS, no la palabra: el token de versión puede llevarla.
    && !/vision-territorial\.html|sw-vt\.js|90-vt-app|90-vt\.css|manifest-gobierno/.test(leer('service-worker.js')), 'scope /vision-territorial');
  let man = null; try { man = JSON.parse(leer('manifest-gobierno.json')); } catch (e) {}
  comprobar('el manifiesto propio arranca en su página, en su ámbito y con su icono',
    !!man && man.start_url === '/vision-territorial.html' && man.scope === '/vision-territorial'
    && Array.isArray(man.icons) && man.icons.length >= 2 && man.icons.every(i => /gobierno\//.test(i.src) && fs.existsSync(R(i.src))), 'manifest-gobierno.json');

  // La cuarta puerta: declarada en js/70, sin pantallas de index y con su página.
  const m70 = leer('js/70-modo-app.js');
  comprobar('js/70 declara el modo gobierno sin pantallas de index y con su página',
    /gobierno:\s*\{[^}]*pantallas:\s*\[\][^}]*pagina:\s*'vision-territorial\.html'/.test(m70), 'js/70-modo-app.js');

  // Iconos de línea, nunca emojis: en el módulo no hay ni uno.
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
  comprobar('ni un emoji en el módulo (js/90, css/90, la página)',
    !EMOJI.test(vt) && !EMOJI.test(leer('css/90-vt.css')) && !EMOJI.test(pag), '3 archivos');

  // La regla rectora, escrita donde se lee: URBIS recomienda, el humano decide.
  comprobar('la regla rectora está en el código y en la pantalla',
    /URBIS recomienda, el humano decide/.test(vt) && /pondera y muestra/.test(vt), 'js/90-vt-app.js');
}

console.log('\n  -- la versión --');
{
  /* Siete, no cinco. `reportes.html` y su service worker quedaron fuera de
     esta lista cuando se creó la app ligera, y su versión se quedó congelada
     en la 597 durante casi doscientas tandas: un teléfono que hubiera abierto
     esa app alguna vez seguía sirviéndose los mismos js/12 y js/05 que
     descargó entonces, porque la dirección con la que los pide no cambiaba.
     La app ligera y la grande comparten archivos; si una los pide con una
     versión vieja, las dos se rompen de maneras distintas y difíciles de
     explicar. */
  /* Nueve desde la v844: Visión Territorial es una página aparte con su
     propio service worker (vision-territorial.html y sw-vt.js), y los dos
     tienen que subir con los demás. Un service worker propio con versión
     vieja serviría una cáscara de hace meses a un alcalde. */
  const ARCHIVOS = ['service-worker.js', 'index.html', 'css/main.css', 'analisis-ia.html',
                    'seguimiento.html', 'reportes.html', 'sw-reportes.js',
                    'vision-territorial.html', 'sw-vt.js'];
  const tokens = new Map();
  ARCHIVOS.forEach(f => {
    const t = leer(f);
    const m = /^sw-|^service-worker/.test(f) ? t.match(/urbis-(?:reportes-|vt-)?v([\w-]+)/)
                                            : t.match(/[?&]v=([\w-]+)/);
    tokens.set(f, m ? m[1] : '(ninguno)');
  });
  const distintos = [...new Set(tokens.values())];
  comprobar('los nueve archivos llevan la misma versión',
    distintos.length === 1,
    distintos.length === 1 ? distintos[0]
      : [...tokens].map(([f, v]) => f + '=' + v).join('  '));

  const idx = leer('index.html');
  const decl = (idx.match(/URBIS_APP_VERSION\s*=\s*'([\w-]+)'/) || [])[1];
  comprobar('y window.URBIS_APP_VERSION dice lo mismo',
    decl === tokens.get('index.html'), decl || '(no está)');

  /* Y que la versión HAYA CAMBIADO si cambió el código.

     Pasó: el `sed` que sube la versión en los cinco archivos murió a medias
     —se lo llevó por delante un `pkill` de la misma línea— y la tanda se
     subió con código nuevo y la versión de la anterior. Los cinco archivos
     coincidían entre sí, que es lo único que se comprobaba, así que nada
     avisó. Un teléfono que ya tenía la versión anterior en su caché no se
     habría enterado nunca del arreglo.

     Se compara con la versión del último commit y solo se exige el cambio
     cuando hay código sin comprometer: mientras se trabaja, repetir la
     comprobación no tiene por qué molestar. */
  try {
    const cp = require('child_process');
    const enGit = (orden) => cp.execSync(orden, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    const sucio = enGit('git status --porcelain -- js css index.html');
    if (sucio) {
      const anterior = (enGit('git show HEAD:index.html').match(/URBIS_APP_VERSION\s*=\s*'([\w-]+)'/) || [])[1];
      comprobar('la versión sube cuando cambia el código',
        !anterior || anterior !== decl,
        anterior === decl ? 'sigue en ' + decl + ' y hay cambios sin subir'
                          : (anterior || '(sin anterior)') + ' → ' + decl);
    }
  } catch (e) { /* sin git, no se puede comparar: no es motivo para fallar */ }

  /* Y que la versión no CHOQUE con la que ya está publicada.

     Pasó hoy: dos sesiones trabajando a la vez llamaron v788 a sus tandas.
     Ninguna hizo nada mal —cada una miró el último commit de SU rama y sumó
     uno— y el choque solo se vio al fusionar, con siete archivos en
     conflicto por una sola cosa: el número.

     La otra sesión escribe en `main` varias veces al día, así que basta con
     mirar la referencia de `origin/main` que ya está en el disco. No se hace
     `git fetch` acá a propósito: una comprobación estática que sale a la red
     se cuelga cuando no hay señal y deja de correrse. Si la referencia está
     vieja, esto no ve el choque —lo verá el `git fetch` de antes de subir—,
     pero cuando sí lo ve, lo dice antes de que cueste una fusión.

     El choque es el mismo número con OTRO nombre. Que coincidan número y
     nombre no es un choque: es que esta tanda ya está publicada, que es el
     estado normal justo después de subir. Y un número menor que el publicado
     tampoco se deja pasar: sería salir con una versión que los teléfonos ya
     descartaron por vieja. */
  try {
    const cp = require('child_process');
    const enGit = (orden) => cp.execSync(orden, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    const numeroDe = (t) => { const m = String(t || '').match(/^(\d+)/); return m ? parseInt(m[1], 10) : null; };
    const publicada = (enGit('git show origin/main:service-worker.js').match(/urbis-v([\w-]+)/) || [])[1];
    const nMio = numeroDe(distintos[0]);
    const nSuyo = numeroDe(publicada);
    if (nMio != null && nSuyo != null) {
      const choca = (nMio === nSuyo && publicada !== distintos[0]) || nMio < nSuyo;
      comprobar('y no choca con la versión ya publicada en origin/main',
        !choca,
        !choca
          ? (nMio === nSuyo ? 'esta tanda ya está publicada · ' + publicada
                            : 'publicada ' + publicada + ' · esta ' + distintos[0])
          : 'origin/main ya va en ' + publicada + ' y esta es ' + distintos[0] +
            ' — sube por encima de las dos antes de fusionar');
    }
  } catch (e) { /* sin origin/main a mano (clon nuevo, sin remoto): no aplica */ }
}

// ── 8. dos cosas distintas con el mismo nombre en `window` ───────────────
/* Los módulos de URBIS son scripts sueltos que se hablan por `window`, y el
   orden de carga decide quién gana. Un mismo nombre usado para dos cosas no
   da error en ninguna parte: el segundo pisa al primero y lo que lo lee se
   encuentra con algo que no esperaba.

   Pasó de verdad y tardó meses en verse. `window.urbisPermisos` era, en un
   archivo, la FUNCIÓN que dice qué puede hacer quien usa la aplicación y, en
   otro, la LISTA de permisos concedidos. Ganaba la función, así que dar un
   permiso guardaba la fila en la hoja y después decía que no se había
   podido —`.push` sobre una función—, y comprobar si alguien tenía permiso
   especial lanzaba. En pantalla parecía otra cosa: «no se pudo dar
   permiso».

   Se comprueba lo que se puede leer sin ejecutar nada: que ningún nombre de
   `window` se asigne como función en un archivo y como lista en otro. */
console.log('\n  -- la ficha del gobernante --');
{
  /* La escalera de fiabilidad se rehizo en la v791: cinco peldaños por cómo
     se ha mostrado, sin el intermedio de gracia. Los ids viejos no pueden
     quedar en ningún archivo servido: uno que sobreviva en una clase CSS o
     en una comparación deja una rama muerta que nadie ve fallar. Se buscan
     como identificadores —entre comillas o en la clase sp-fi-v-—, no como
     palabra suelta: «reparos» sigue siendo un campo legítimo de los
     indicadores y «sostiene» una palabra del castellano. */
  const viejos = /'(entredicho|reparos|sostiene)'|"(entredicho|reparos|sostiene)"|sp-fi-v-(entredicho|reparos|sostiene)\b/g;
  const servidos = ['js/70-seguimiento.js', 'css/70-seguimiento.css', 'seguimiento.html'];
  const restos = [];
  servidos.forEach(f => {
    leer(f).split('\n').forEach((l, i) => { if (viejos.test(l)) restos.push(f + ':' + (i + 1)); viejos.lastIndex = 0; });
  });
  comprobar('los peldaños viejos de la escalera no sobreviven en lo servido',
    restos.length === 0, restos.length ? restos.join(', ') : servidos.length + ' archivos revisados');

  /* Una sola escala tipográfica: todo font-size del módulo sale de --t-1…--t-9.
     Un tamaño suelto es el primero de una segunda escala. */
  const css = leer('css/70-seguimiento.css');
  const cuerpo = css.slice(css.indexOf('*{ box-sizing'));
  const sueltos = [];
  cuerpo.split('\n').forEach((l, i) => {
    /* La mirada negativa va pegada a los dos puntos y se traga ella misma
       el espacio: con `\s*` delante, el motor retrocede a cero espacios,
       la mirada pasa sobre « var(...)» y la guarda denuncia un tamaño que
       SÍ sale de la escala. Se vio escribiendo `font-size: var(--t-7)`. */
    const m = /font-size:(?!\s*var\(--t-\d\))\s*([^;}]+)/.exec(l);
    if (m) sueltos.push((i + 1) + ' → ' + m[1].trim());
  });
  comprobar('todo tamaño de letra del módulo sale de la escala --t-N',
    sueltos.length === 0, sueltos.length ? sueltos.slice(0, 5).join(' · ') : (cuerpo.match(/font-size:var\(--t-\d\)/g) || []).length + ' tamaños, todos de la escala');

  /* Los DOS registros y su sección de casos: estados solo los cinco conocidos,
     y un caso que pese sin quién lo confirmó, fecha ni fuentes no puede pesar.
     Se revisan los dos porque la misma regla mide a los dos gobernantes: un
     registro con la vara floja sería la manera silenciosa de inclinar la
     comparación. Y un 'archivado' también exige quién archivó y con qué
     fuente: no pesa, pero exonera, y una exoneración sin papel es igual de
     falsa que una acusación sin papel. */
  const ESTADOS = ['confirmado', 'en-investigacion', 'senalamiento', 'archivado', 'por-documentar'];
  const NIVELES = ['nacional', 'departamental', 'distrital', 'municipal'];
  const REGISTROS = ['assets/data/seguimiento-presidencial.json', 'assets/data/seguimiento-petro.json'];
  const malos = [], cojos = [], sinNivel = [], nivelRaro = [];
  let nCasos = 0;
  REGISTROS.forEach((ruta) => {
    const quien = ruta.split('-').pop().replace('.json', '');
    const lista = ((JSON.parse(leer(ruta)).casos || {}).lista) || [];
    nCasos += lista.length;
    lista.forEach((c) => {
      if (!ESTADOS.includes(c.estado)) malos.push(quien + '/' + c.id + ':' + c.estado);
      const conPeso = c.estado === 'confirmado' || c.estado === 'en-investigacion' || c.estado === 'archivado';
      if (conPeso && (!c.quienLoConfirmo || !(c.fuentes || []).length || !c.fecha)) cojos.push(quien + '/' + c.id);
      /* El nivel se le exige a los DOS estados que pesan, que son los que
         mueven el veredicto. Un `archivado` no lo necesita para no pesar —ya
         no pesa por su estado— y pedírselo sería una exigencia sin
         consecuencia. Un valor escrito con otra grafía se denuncia aparte: en
         la ficha ese caso NO pesa, así que un «Municipal» con mayúscula saca
         un caso de la cuenta sin que nadie lo haya decidido. */
      const pesa = c.estado === 'confirmado' || c.estado === 'en-investigacion';
      const niv = String(c.nivelGobierno || '').trim();
      if (pesa && !niv) sinNivel.push(quien + '/' + c.id);
      if (niv && !NIVELES.includes(niv)) nivelRaro.push(quien + '/' + c.id + ':' + niv);
    });
  });
  comprobar('los casos de corrupción de los dos registros llevan un estado probatorio conocido',
    malos.length === 0, malos.length ? malos.join(', ') : nCasos + ' casos en ' + REGISTROS.length + ' registros');
  comprobar('y ningún caso con consecuencia (confirmado, en investigación o archivado) va sin quién, fecha y fuentes',
    cojos.length === 0, cojos.length ? cojos.join(', ') : 'ningún caso con consecuencia va cojo');

  /* EL NIVEL DE GOBIERNO DE UN CASO QUE PESA.
     Es la puerta que impide que una decisión municipal mueva el veredicto de
     un gobierno nacional, y la única manera de que la puerta no falle abierta.
     `js/70` deja pesar el caso que no declara nivel —no le pone «nacional» por
     omisión, que sería afirmar de quién es una decisión sin que nadie lo haya
     escrito— así que lo que impide que un caso llegue a pesar sin declararlo
     es esta línea, no un valor por defecto.

     No hizo falta trinquete como el de `tipoFuente`: los trece casos de los
     dos registros se pudieron declarar leyendo su propio título y su propio
     «quién» —UNGRD, CNE, Fiscalía General, Corte Suprema, la campaña
     presidencial, una consejera presidencial, una ministra—, así que la
     exigencia arranca en cero y no en una deuda. */
  comprobar('todo caso que PESA declara su nivel de gobierno (sin él, una decisión municipal movería un veredicto nacional)',
    sinNivel.length === 0, sinNivel.length ? sinNivel.join(', ') : 'los que pesan lo declaran');
  comprobar('y ningún nivel de gobierno está escrito con un valor que la ficha no conoce',
    nivelRaro.length === 0, nivelRaro.length ? nivelRaro.join(', ') : 'los declarados son de los cuatro conocidos');

  /* La guarda de la guarda. Si `js/70` dejara de leer `nivelGobierno`, las dos
     comprobaciones de arriba seguirían en verde sobre un dato que ya no decide
     nada: estarían vigilando un campo muerto. Es el patrón de la v878 con su
     propia lista de voseo. */
  {
    const j70 = leer('js/70-seguimiento.js');
    comprobar('y la ficha sigue leyendo ese campo para decidir quién pesa',
      /nivelGobierno/.test(j70) && /entraAlVeredicto/.test(j70) && /puerta\.entra/.test(j70),
      'js/70 lee nivelGobierno y pasa los casos por entraAlVeredicto');
  }

  /* CORRECCIÓN de lo que decía acá ayer, que era falso y conviene dejar
     escrito para que nadie lo vuelva a suponer: una entrada sin tipo NO
     baja el porcentaje de «registro verificado». La ficha lo calcula sobre
     las entradas que SÍ declaran naturaleza —`100 * verificado / conTipo`,
     js/70— así que las que están en blanco quedan FUERA de la cuenta, no
     dentro del denominador.

     Lo que sí pasa es otra cosa, y es la que este trinquete cuida: una
     entrada sin tipo es una entrada de la que no se decidió nada, y si el
     registro se llena de ellas el porcentaje empieza a hablar de una parte
     cada vez más chica del registro sin decirlo. Un 100 % sobre tres
     hechos de cien no es un registro verificado: es un registro sin
     revisar con una cifra bonita encima.

     No se exige cero de golpe: hay entradas viejas sin clasificar y
     ponerles un tipo a ciegas sería inventar la verificación que falta.
     Se pone un TRINQUETE: el número de hoy es el techo y solo puede bajar.
     Toda entrada nueva nace con su tipo, y las viejas se van clasificando
     cuando alguien las mire de verdad. Si este número sube, alguien añadió
     una entrada sin decidir de qué fuente es, y esta comprobación lo dice
     antes de que llegue al teléfono de nadie. */
  const TECHO_SIN_TIPO = 19;
  const sinTipo = [];
  REGISTROS.forEach((ruta) => {
    const quien = ruta.split('-').pop().replace('.json', '');
    ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
      if (!String(e.tipoFuente || '').trim()) sinTipo.push(quien + '/' + (e.fecha || '?'));
    });
  });
  comprobar('ninguna entrada nueva se queda sin tipo de fuente (el porcentaje hablaría de una parte cada vez más chica)',
    sinTipo.length <= TECHO_SIN_TIPO,
    sinTipo.length + ' sin clasificar, techo ' + TECHO_SIN_TIPO +
    (sinTipo.length > TECHO_SIN_TIPO ? ' · sobran: ' + sinTipo.slice(TECHO_SIN_TIPO).join(', ') : ' · solo puede bajar'));

  /* Y la lista de pendientes tiene que decir la verdad sobre sí misma. Una
     lista de deudas que se queda vieja es peor que no tenerla: alguien
     documenta una entrada, la lista sigue diciendo diecinueve, y nadie
     vuelve a mirarla porque «ya estaba revisada». Los tres números —las
     entradas en blanco, lo que la lista dice tener, y el techo— tienen que
     ser el mismo, o algo se movió sin avisar. */
  {
    const reg = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const pend = reg._pendientesFuente || {};
    const enLista = ((pend.lista) || []).length;
    const dice = pend.cuantas;
    const enBlanco = ((reg.entradas) || []).filter((e) => !String(e.tipoFuente || '').trim()).length;
    comprobar('la lista de entradas por documentar cuadra con las que de verdad están en blanco',
      enLista === enBlanco && dice === enBlanco && enBlanco === TECHO_SIN_TIPO,
      'lista ' + enLista + ' · dice ' + dice + ' · en blanco ' + enBlanco + ' · techo ' + TECHO_SIN_TIPO);
    const sinQue = ((pend.lista) || []).filter((x) => !String(x.queFalta || '').trim()).length;
    comprobar('y cada pendiente dice QUÉ documento u organismo lo cerraría',
      sinQue === 0, sinQue ? sinQue + ' sin decir qué falta' : 'las ' + enLista + ' dicen qué falta');
  }

  /* ═══ CAPA 1 DEL PLIEGO PRESIDENCIAL ═══════════════════════════════════
     Tres campos por entrada, en los DOS registros. Los dos porque el
     principio 1 del pliego es la simetría: toda regla que se aplica a un
     gobierno se aplica a todos, y aflojarla en uno sería la manera
     silenciosa de inclinar la comparación.

     Las tablas de valores NO se copian acá: se leen de `js/70`. Una
     comprobación que lleve su propia copia de la lista deja de comprobar el
     código y pasa a comprobar que dos listas son iguales entre sí, y se
     separan la tanda siguiente. */
  {
    const j70c1 = leer('js/70-seguimiento.js');
    /* El troceo va por índice y no por una expresión regular armada a mano:
       una regex construida con `new RegExp` sobre una cadena se escapa dos
       veces y falla en silencio devolviendo la lista vacía, que es como esta
       comprobación pasó de largo en su primera corrida. Lo cazó su propia
       guarda de material. */
    const tablaDe = (nombre) => {
      const ini = j70c1.indexOf('var ' + nombre + ' = {');
      if (ini < 0) return [];
      const fin = j70c1.indexOf('\n  };', ini);
      if (fin < 0) return [];
      const cuerpo = j70c1.slice(ini, fin);
      return (cuerpo.match(/^\s*'([a-z-]+)':/gm) || []).map((x) => x.replace(/[^a-z-]/g, ''));
    };
    const VAL_PRUEBA = tablaDe('CATEGORIA_PROBATORIA');
    const VAL_MEDICION = tablaDe('TIPO_MEDICION');

    /* La guarda de la guarda, y va PRIMERO: si las tablas dejaran de
       encontrarse, todo lo de abajo pasaría en verde sin vigilar un solo
       valor. Es el patrón de la v878 con su propia lista de voseo. */
    comprobar('MATERIAL · las dos tablas de la Capa 1 se leen de js/70',
      VAL_PRUEBA.length === 4 && VAL_MEDICION.length === 3,
      VAL_PRUEBA.join('·') + ' / ' + VAL_MEDICION.join('·'));

    const malos = [];
    let sinCapa1 = 0, nEntradas = 0;
    const sinContra = [];
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        const donde = quien + '/' + (e.fecha || '?');
        const cp = String(e.categoriaProbatoria || '').trim();
        const tm = String(e.tipoMedicion || '').trim();
        if (cp && VAL_PRUEBA.indexOf(cp) < 0) malos.push(donde + ' categoriaProbatoria=' + cp);
        if (tm && VAL_MEDICION.indexOf(tm) < 0) malos.push(donde + ' tipoMedicion=' + tm);
        nEntradas++;
        if (!cp || !tm) sinCapa1++;
        if (!String(e.contrargumentoOficial || '').trim()) sinContra.push(donde);
      });
    });

    comprobar('ningún registro lleva un valor de Capa 1 que la ficha no sepa leer',
      malos.length === 0,
      malos.length ? malos.join(' · ') : 'los declarados son de las dos tablas');

    /* Éste NO lleva trinquete sino cero, y es a propósito: los dos campos se
       clasificaron enteros en esta versión, y la nota interna de cada
       registro le dice a la rutina diaria que una entrada nueva los trae. Un
       techo por encima de cero dejaría entrar la primera sin ellos y el
       pendiente empezaría a subir otra vez. Entre fallar abierto y fallar
       cerrado se falla cerrado — el canje de la v880. */
    comprobar('toda entrada de los dos registros declara su categoría probatoria y qué mide',
      sinCapa1 === 0,
      sinCapa1 ? sinCapa1 + ' sin declarar · una entrada nueva las trae: ' +
        'categoriaProbatoria (' + VAL_PRUEBA.join(' | ') + ') y tipoMedicion (' + VAL_MEDICION.join(' | ') + ')'
        : 'las ' + nEntradas + ' entradas de los dos registros las declaran');

    /* El contrargumento oficial SÍ lleva trinquete, y por la razón contraria:
       no se puede clasificar leyendo el registro. Escribir `ausente` sin
       haber buscado sería afirmar que el Gobierno no respondió, que es un
       señalamiento contra una persona real fabricado por comodidad nuestra.
       Así que el pendiente arranca completo y se ve en la ficha: el pliego
       manda publicar con la marca de la falla visible.

       PERO EL TRINQUETE VA SOBRE LO REVISADO, NO SOBRE LO PENDIENTE (v964).
       La v957 puso un techo absoluto de 200 sin revisar, y esa cifra CRECE
       sola: el registro se alimenta todos los días, así que la primera
       entrada nueva —de la rutina diaria o de una tanda— lo rompía sin que
       nadie hubiera dejado de revisar nada. Lo destapó entrar dos hechos y
       ver el techo en rojo con 202.

       Un trinquete tiene que medir la cosa que solo debe moverse en una
       dirección, y esa es lo REVISADO: puede subir y no puede bajar. Con eso
       un registro que crece no se castiga, y des-declarar un contrargumento
       —que es lo que había que impedir— sigue saliendo en rojo. */
    const revisados = nEntradas - sinContra.length;
    const PISO_REVISADOS = 0;
    comprobar('lo revisado del contrargumento oficial solo puede subir',
      revisados >= PISO_REVISADOS,
      revisados + ' revisados de ' + nEntradas + ' (piso ' + PISO_REVISADOS + ') · ' +
      sinContra.length + ' pendientes, que crecen con el registro y por eso no llevan techo');

    /* LA REGLA DE ORO DEL PLIEGO, comprobada sobre el código: ninguna capa
       escribe en la capa anterior. El veredicto sale de `techos` y de `peor`,
       y ninguno de los dos puede nombrar un campo de la Capa 1. Si un día
       alguien mete la categoría probatoria en la escalera, el juicio público
       sobre una persona cambiaría por un campo que se agregó para describir,
       y esta comprobación lo dice antes. */
    /* EL TRAMO VA HASTA `var capa1`, NO HASTA `var manda`, y esto costó una
       demostración: con el corte en `manda`, una contaminación escrita tres
       líneas más abajo —`techos.claridad.i = 3` a partir de la Capa 1— pasaba
       en verde acá y solo la cazaba la suite del navegador. Una guarda que no
       puede fallar es un verde (v878). Todo lo que puede tocar el veredicto
       vive entre el armado de los techos y el recuento de la Capa 1, que se
       calcula al final a propósito. */
    const tramoVeredicto = (j70c1.match(/var techos = \{[\s\S]*?(?=\n\s*\/\* El recuento de la Capa 1)/) || [''])[0];
    /* La lista incluye los AYUDANTES y no solo los campos: una contaminación
       real no escribe `categoriaProbatoria` en el tramo, llama a
       `capaUnoDe_conjunto`. Lo comprobé rompiéndolo a propósito y esta guarda
       pasó en verde con los cuatro nombres de campo solos.

       Y aun así, esta mitad no puede cazarlo todo —un alias con otro nombre se
       le escapa—. La que MIDE la propiedad es `tficha`, que compone la misma
       ficha con y sin los tres campos y exige el mismo veredicto y los mismos
       tres techos. Ésta es la barata, que corre sin navegador. */
    const contamina = ['categoriaProbatoria', 'tipoMedicion', 'contrargumentoOficial', 'capa1', 'capaUnoDe']
      .filter((k) => tramoVeredicto.indexOf(k) >= 0);
    comprobar('la Capa 1 no entra en el cálculo del veredicto (regla de oro del pliego)',
      tramoVeredicto.length > 0 && contamina.length === 0,
      !tramoVeredicto.length ? 'no se encontró el tramo del veredicto: la comprobación no vale'
                             : (contamina.length ? 'lo contamina: ' + contamina.join(', ')
                                                 : 'los tres techos salen de casos, palabra y claridad'));

    /* Y que la ficha de verdad los lea. Sin esto, todo lo de arriba seguiría
       en verde sobre tres campos que nadie usa. */
    comprobar('y la ficha lee los tres campos y los publica',
      /categoriaProbatoriaDe/.test(j70c1) && /tipoMedicionDe/.test(j70c1) &&
      /contrargumentoDe/.test(j70c1) && /capaUnoDe_conjunto/.test(j70c1),
      'js/70 resuelve los tres y cuenta el conjunto');
  }

  /* ═══ CAPA 2 DEL PLIEGO · LOS INDICADORES ══════════════════════════════
     Tres de los siete se DECLARAN por entrada, como el nivel de gobierno de
     la v941: decidir que un hecho es «un choque con un órgano autónomo» es
     una lectura sobre un gobierno real y no se deduce del texto. Deducirla de
     que el título nombre al DANE metería en la cuenta la entrada de la
     inflación, que lo cita como FUENTE.

     Acá se vigila que lo declarado sea de la tabla, y que solo se declaren
     los que de verdad se declaran: un `I-09` escrito a mano en una entrada
     estaría contando dos veces, porque ése sale de la Capa 1. */
  {
    const j70c2 = leer('js/70-seguimiento.js');
    const iniI = j70c2.indexOf('var INDICADORES = {');
    const cuerpoI = iniI < 0 ? '' : j70c2.slice(iniI, j70c2.indexOf('\n  };', iniI));
    const TODOS = (cuerpoI.match(/'(I-\d\d)':/g) || []).map((x) => x.replace(/[^I\d-]/g, ''));
    const DECLARABLES = (cuerpoI.match(/'(I-\d\d)': \{ t: '[^']*', dec: true/g) || [])
      .map((x) => x.slice(1, 5));

    /* Mide la FORMA y no el número: que las dos listas se lean, que las
       declarables sean un subconjunto propio de todas, y que los seis del
       pliego original sigan estando. Con el conteo escrito a mano, un
       indicador nuevo —I-13 en la v962— la ponía roja sin que nada estuviera
       mal, que es la constante metida en la aserción de la v890. */
    const DEL_PLIEGO = ['I-04', 'I-05', 'I-06', 'I-07', 'I-09', 'I-10'];
    const perdidos = DEL_PLIEGO.filter((k) => TODOS.indexOf(k) < 0);
    comprobar('MATERIAL · el catálogo de indicadores se lee de js/70',
      !perdidos.length && DECLARABLES.length > 0 && DECLARABLES.length < TODOS.length &&
      DECLARABLES.every((k) => TODOS.indexOf(k) >= 0),
      (perdidos.length ? 'faltan del pliego: ' + perdidos.join(', ') + ' · ' : '') +
      TODOS.join('·') + ' · declarables: ' + DECLARABLES.join('·'));

    const malos = [];
    let conInd = 0;
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        const lista = e.indicadores;
        if (lista === undefined) return;
        if (!Array.isArray(lista)) { malos.push(quien + '/' + e.fecha + ' indicadores no es una lista'); return; }
        conInd++;
        lista.forEach((k) => {
          if (TODOS.indexOf(k) < 0) malos.push(quien + '/' + e.fecha + ' indicador desconocido: ' + k);
          else if (DECLARABLES.indexOf(k) < 0) malos.push(quien + '/' + e.fecha + ' ' + k + ' no se declara: sale de la Capa 1');
        });
      });
    });
    comprobar('los indicadores declarados son de la tabla, y solo los que se declaran',
      malos.length === 0,
      malos.length ? malos.join(' · ') : conInd + ' entradas declaran indicador, todas con valores conocidos');

    /* La guarda de la guarda: si la ficha dejara de llamar a `indicadoresDe`
       o a `comparabilidad`, todo lo de arriba seguiría en verde sobre un
       campo que nadie lee y sobre una advertencia que nadie imprime. */
    comprobar('y la ficha calcula los indicadores y publica la no-comparabilidad',
      /indicadoresDe\(D, f\.corte\)/.test(j70c2) && /comparabilidad\(D, DA\)/.test(j70c2),
      'la ficha llama a las dos');

    /* La normalización es obligatoria: ningún indicador se puede publicar sin
       su tasa. Lo que se vigila acá es que la división exista y sea por 100
       —`por100` no puede ser una copia del crudo—, y `tficha` lo mide sobre
       una ficha compuesta de verdad. */
    comprobar('los indicadores salen normalizados por 100 días, no en crudo',
      /Math\.round\(1000 \* n \/ dias\) \/ 10/.test(j70c2) && /por100: por100\(crudo\[k\]\)/.test(j70c2),
      'la tasa se calcula sobre los días de gobierno');
  }

  /* ═══ LOS CRITERIOS, COMO DATOS (v961) ═════════════════════════════════
     «Los criterios van como DATOS, no como decisión caso por caso.»

     Un indicador declarable cuyo criterio no esté escrito es una cifra sobre
     un gobierno real que nadie puede rehacer ni discutir. Las dos mitades
     hacen falta: que el criterio exista, y que la cuenta lo APLIQUE — sin la
     segunda, la tabla sería documentación y el conteo seguiría siendo lo que
     alguien declaró a mano. */
  {
    const j70cr = leer('js/70-seguimiento.js');

    const bloqueCriterios = (j70cr.match(/var CRITERIOS = \{[\s\S]*?\n  \};/) || [''])[0];
    const idsCriterio = (bloqueCriterios.match(/^    '(I-\d\d)': \{/gm) || [])
      .map((x) => x.replace(/[^I\d-]/g, ''));

    /* La guarda de MATERIAL va primero: si el bloque dejara de encontrarse,
       todo lo de abajo pasaría en verde sin vigilar un solo criterio. */
    comprobar('MATERIAL · los criterios se leen de js/70, con sus dos listas',
      idsCriterio.length >= 3 &&
      (bloqueCriterios.match(/definicion:/g) || []).length === idsCriterio.length &&
      (bloqueCriterios.match(/incluye: \[/g) || []).length === idsCriterio.length &&
      (bloqueCriterios.match(/excluye: \[/g) || []).length === idsCriterio.length &&
      (bloqueCriterios.match(/requiere: function/g) || []).length === idsCriterio.length,
      idsCriterio.join(' · ') + ' — cada uno con definición, incluye, excluye y requiere');

    /* Las dos direcciones. Sin la primera, un indicador declarable nuevo
       nacería sin criterio y su cifra volvería a ser un juicio; sin la
       segunda, quedaría un criterio escrito que no cuenta para nada y que
       alguien leería como vigente. */
    const bloqueInd = (j70cr.match(/var INDICADORES = \{[\s\S]*?\n  \};/) || [''])[0];
    const declarables = (bloqueInd.match(/'(I-\d\d)': \{ t: '[^']*', dec: true/g) || [])
      .map((x) => x.slice(1, 5));
    const sinCriterio = declarables.filter((k) => idsCriterio.indexOf(k) < 0);
    const criterioHuerfano = idsCriterio.filter((k) => declarables.indexOf(k) < 0);
    comprobar('todo indicador que se declara a mano tiene su criterio escrito, y ninguno sobra',
      declarables.length > 0 && !sinCriterio.length && !criterioHuerfano.length,
      (sinCriterio.length ? 'sin criterio: ' + sinCriterio.join(', ') + ' ' : '') +
      (criterioHuerfano.length ? 'criterio sin indicador: ' + criterioHuerfano.join(', ') : '') ||
      'los ' + declarables.length + ' declarables (' + declarables.join(', ') + ') lo tienen');

    /* LA GUARDA DE LA GUARDA. Si el conteo dejara de pasar por la puerta,
       las dos de arriba seguirían en verde sobre una tabla que no decide
       nada — el patrón de la v878 con su propia lista. */
    const tramoConteo = (j70cr.match(/var fuera = \{[\s\S]*?\n    \}\);/) || [''])[0];
    comprobar('y la cuenta de indicadores APLICA el criterio, no solo lo publica',
      /pasaElCriterio\(e, k\b/.test(tramoConteo) && /if \(g\.cuenta\)[^;]*crudo\[k\]\+\+/.test(tramoConteo),
      tramoConteo ? 'cada declaración pasa por pasaElCriterio antes de contar'
                  : 'no se encontró el tramo del conteo');

    /* Y lo que el criterio deja fuera no desaparece: se cuenta aparte con su
       motivo. Es la desviación declarada respecto del motor de referencia,
       que filtra en silencio — y la razón es la de la v899: un conteo que
       baja sin decir por qué se lee como que el hecho no ocurrió. */
    comprobar('lo declarado que no pasa el criterio se cuenta aparte y con su motivo',
      /fuera\[k\]\.push\(\{[\s\S]{0,180}motivo: g\.motivo/.test(j70cr) &&
      /sp-c2-fuera/.test(j70cr),
      'la ficha imprime cuántas se declararon, cuántas cuentan y qué le falta a cada una');

    /* Los insumos del gate, en el registro. Trinquete en CERO y en los dos
       registros: solo se les exigen a las entradas que declaran indicador,
       así que no hay deuda vieja que perdonar y una entrada nueva que declare
       sin ellos se ve en el acto. */
    const VAL_PROC = (j70cr.match(/var ESTADO_PROCESAL = \{[\s\S]*?\n  \};/) || [''])[0]
      .match(/^    '([a-z-]+)':/gm) || [];
    const VAL_EVID = (j70cr.match(/var TIPO_EVIDENCIA = \{[\s\S]*?\n  \};/) || [''])[0]
      .match(/^    '([a-z-]+)':/gm) || [];
    const proc = VAL_PROC.map((x) => x.replace(/[^a-z-]/g, ''));
    const evid = VAL_EVID.map((x) => x.replace(/[^a-z-]/g, ''));
    comprobar('MATERIAL · las tablas de estado procesal y tipo de evidencia se leen de js/70',
      proc.length === 5 && evid.length === 5, proc.join('·') + ' / ' + evid.join('·'));

    const faltan = [], malos2 = [];
    let conIndicador = 0;
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        if (!((e.indicadores || []).length)) return;
        conIndicador++;
        const donde = quien + '/' + (e.fecha || '?');
        const nv = String(e.nivelGobierno || '').trim();
        const ep = String(e.estadoProcesal || '').trim();
        const te = String(e.tipoEvidencia || '').trim();
        if (!nv || !ep || !te) {
          faltan.push(donde + ' (' + [!nv && 'nivelGobierno', !ep && 'estadoProcesal',
            !te && 'tipoEvidencia'].filter(Boolean).join(', ') + ')');
        }
        if (ep && proc.indexOf(ep) < 0) malos2.push(donde + ' estadoProcesal=' + ep);
        if (te && evid.indexOf(te) < 0) malos2.push(donde + ' tipoEvidencia=' + te);
        (e.indicadores || []).forEach((k) => {
          if (idsCriterio.indexOf(k) < 0) malos2.push(donde + ' declara ' + k + ', que no tiene criterio');
        });
      });
    });

    comprobar('toda entrada que declara un indicador trae los tres insumos del criterio',
      conIndicador > 0 && faltan.length === 0,
      faltan.length ? faltan.join(' · ')
        : 'las ' + conIndicador + ' que declaran indicador traen nivel, estado procesal y tipo de evidencia');

    comprobar('y ninguna los escribe con un valor que la ficha no sepa leer',
      malos2.length === 0,
      malos2.length ? malos2.join(' · ')
        : 'estadoProcesal (' + proc.join(' | ') + ') y tipoEvidencia (' + evid.join(' | ') + ')');

    /* La constancia de búsqueda. `ausente` AFIRMA que el Gobierno no
       respondió, y una afirmación sobre una persona real necesita algo
       detrás: dónde se buscó y cuándo. Un `ausente` a secas se ve y no pesa,
       y esta guarda existe para que la forma con constancia no se pierda. */
    comprobar('un contrargumento «ausente» sin constancia de búsqueda no pesa, y lo dice',
      /ausente-sin-constancia/.test(j70cr) && /sinConstancia/.test(j70cr) &&
      /v\.busco/.test(j70cr),
      'se exige { ausente: true, busco: [...], fecha } para que cuente en el indicador I-06');
  }

  /* ═══ LA LISTA CERRADA DE ÓRGANOS AUTÓNOMOS, Y EL INDICADOR QUE NACIÓ
         DE NO CABER EN NINGUNO (v962) ══════════════════════════════════════
     La v961 encontró que mi descripción de I-05 listaba al DANE entre los
     órganos autónomos, y no lo es: es un departamento administrativo del
     Ejecutivo con independencia solo TÉCNICA. Meter una entidad del Ejecutivo
     en esa lista convierte un acto interno en un choque entre poderes, que es
     el señalamiento más caro que este módulo puede fabricar.

     Así que la lista va cerrada y vigilada en las DOS direcciones. */
  {
    const j70i13 = leer('js/70-seguimiento.js');

    const bloqueOrg = (j70i13.match(/var ORGANOS_AUTONOMOS = \[[\s\S]*?\n  \];/) || [''])[0];
    const organos = (bloqueOrg.match(/^    '([^']+)'/gm) || []).map((x) => x.replace(/^\s*'|'$/g, ''));

    comprobar('MATERIAL · la lista cerrada de órganos autónomos se lee de js/70',
      organos.length >= 12, organos.length + ' órganos');

    /* Los que TIENEN que estar: si alguien vacía la lista, lo de abajo pasaría
       en verde sin vigilar nada. */
    const imprescindibles = ['Corte Constitucional', 'Consejo Nacional Electoral (CNE)',
                             'Procuraduría General de la Nación', 'Banco de la República'];
    const ausentes = imprescindibles.filter((x) => organos.indexOf(x) < 0);
    comprobar('la lista trae los órganos de autonomía constitucional',
      ausentes.length === 0,
      ausentes.length ? 'faltan: ' + ausentes.join(', ') : imprescindibles.length + ' comprobados de ' + organos.length);

    /* Y los que NO pueden estar: entidades del propio Ejecutivo. Ésta es la
       que caza el error de la v958, y persigue la CLASE —cualquier entidad del
       Ejecutivo— y no solo el DANE. */
    const delEjecutivo = ['DANE', 'Departamento Administrativo Nacional de Estadística',
                          'Ministerio', 'Función Pública', 'Prosperidad Social', 'DNP',
                          'Presidencia', 'Superintendencia'];
    const colados = delEjecutivo.filter((x) => organos.some((o) => o.indexOf(x) >= 0));
    comprobar('y ninguna entidad del propio Ejecutivo se cuela en ella',
      colados.length === 0,
      colados.length ? 'coladas: ' + colados.join(', ') +
        ' · su independencia es técnica, no constitucional: van a I-13'
        : 'ninguna de las ' + delEjecutivo.length + ' formas vigiladas aparece en la lista');

    /* I-05 tiene que EXCLUIRLAS por escrito, no solo por omisión de la lista:
       quien declare un indicador lee el criterio, no la lista de al lado. */
    const exI05 = (j70i13.match(/'I-05': \{[\s\S]*?excluye: \[([\s\S]*?)\],/) || ['', ''])[1];
    comprobar('el criterio de I-05 excluye por escrito a las de independencia solo técnica',
      /independencia solo t[eé]cnica/.test(exI05) && /I-13/.test(exI05),
      'y manda esos casos a I-13 en vez de perderlos');

    /* Y la otra exclusión que un caso real obligó a escribir: un órgano que
       usa una facultad que el propio decreto le reconoce no está chocando. */
    comprobar('y excluye al órgano que ejerce una facultad que el propio acto le reconoce',
      /facultad que el propio acto del Ejecutivo le reconoce/.test(exI05),
      'de conformidad con no es en contra de: contarlo sería fabricar un choque');

    /* I-13 existe, tiene criterio, y NO entra al eje B. Lo último es lo que
       hay que vigilar: el eje mide desviación contra una media histórica y de
       I-13 no hay ninguna, así que meterlo compararía cuatro indicadores
       contra una referencia y el quinto contra nada. */
    const ejeBLista = (j70i13.match(/var IND_EJE_B = \[([^\]]*)\]/) || ['', ''])[1];
    comprobar('I-13 se publica como indicador propio',
      /'I-13': \{/.test(j70i13) && /'I-13': \{ t: 'Interferencia/.test(j70i13) &&
      /ORDEN_IND = \[[^\]]*'I-13'/.test(j70i13),
      'con su criterio, su fila y su puesto en el orden');

    comprobar('y NO entra al eje B, que no tiene media histórica suya',
      ejeBLista.length > 0 && ejeBLista.indexOf('I-13') < 0,
      ejeBLista ? 'el eje B mide I-04, I-05, I-06 e I-07 contra su media; I-13 no tiene media'
                : 'no se encontró IND_EJE_B');

    /* La guarda de la guarda: si el eje dejara de leer esa lista, la de arriba
       seguiría en verde sobre una constante que no decide nada. */
    comprobar('y el eje B sigue leyendo esa lista para armar sus filas',
      /IND_EJE_B\.indexOf\(f\.id\) >= 0/.test(j70i13),
      'ejeB filtra sus indicadores por IND_EJE_B');

    /* Y una guarda de clase sobre el registro: I-05 e I-13 son mutuamente
       excluyentes por construcción —una entidad es autónoma o no lo es—, así
       que un hecho que declare los dos está mal clasificado. */
    const dobles = [];
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        const ii = e.indicadores || [];
        if (ii.indexOf('I-05') >= 0 && ii.indexOf('I-13') >= 0) {
          dobles.push(quien + '/' + (e.fecha || '?'));
        }
      });
    });
    comprobar('ningún hecho declara I-05 e I-13 a la vez: una entidad es autónoma o no lo es',
      dobles.length === 0,
      dobles.length ? dobles.join(' · ') : 'los dos indicadores no se solapan en el registro');
  }

  /* ═══ LA VÍA: POR CUÁL RENGLÓN DEL CRITERIO ENTRA CADA HECHO (v963) ════
     La v962 escribió en su bitácora que el caso del DANE entraba por dos
     renglones del `incluye`, y uno de los dos era falso: la remoción que
     citaba era anterior a la controversia y ordinaria. Nadie lo habría visto,
     porque la declaración en el registro era solo `['I-13']` y la vía vivía
     en la prosa de la bitácora.

     Con la vía en la entrada y comprobada contra el texto EXACTO del
     criterio, una cita inventada se ve acá y no tres tandas después. */
  {
    const j70v = leer('js/70-seguimiento.js');

    /* Las listas de `incluye` de cada criterio, leídas del propio módulo: una
       comprobación que copiara los textos no comprobaría nada más que que dos
       listas son iguales entre sí. */
    const incluyeDe = {};
    const bloqueCr = (j70v.match(/var CRITERIOS = \{[\s\S]*?\n  \};/) || [''])[0];
    (bloqueCr.match(/'(I-\d\d)': \{[\s\S]*?incluye: \[([\s\S]*?)\],\n/g) || []).forEach((tr) => {
      const id = (tr.match(/'(I-\d\d)'/) || [])[1];
      const cuerpo = (tr.match(/incluye: \[([\s\S]*?)\],\n/) || ['', ''])[1];
      incluyeDe[id] = (cuerpo.match(/'((?:[^'\\]|\\.)*)'/g) || [])
        .map((x) => x.slice(1, -1).replace(/\\'/g, "'"));
    });

    comprobar('MATERIAL · las listas de «incluye» se leen de js/70, con sus renglones',
      Object.keys(incluyeDe).length >= 3 &&
      Object.keys(incluyeDe).every((k) => incluyeDe[k].length >= 1),
      Object.keys(incluyeDe).map((k) => k + ':' + incluyeDe[k].length).join(' · '));

    const sinVia = [], viaMala = [];
    let declarantes = 0;
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        const ii = e.indicadores || [];
        if (!ii.length) return;
        declarantes++;
        const donde = quien + '/' + (e.fecha || '?');
        const por = e.indicadoresPor || {};
        ii.forEach((k) => {
          const vv = por[k];
          const via = (vv && typeof vv === 'object') ? String(vv.via || '').trim()
                                                     : String(vv || '').trim();
          if (!via) { sinVia.push(donde + ' declara ' + k); return; }
          if (!incluyeDe[k]) { viaMala.push(donde + ' declara ' + k + ', sin criterio'); return; }
          if (incluyeDe[k].indexOf(via) < 0) {
            viaMala.push(donde + ' ' + k + ' cita «' + via.slice(0, 54) + '»');
          }
        });
      });
    });

    comprobar('toda declaración de indicador dice por cuál renglón del criterio entra',
      declarantes > 0 && sinVia.length === 0,
      sinVia.length ? sinVia.join(' · ')
        : 'las ' + declarantes + ' entradas que declaran indicador traen su `indicadoresPor`');

    /* Y la vía tiene que existir de verdad en el criterio. Un texto parecido
       pero no idéntico es una cita a algo que nadie escribió. */
    comprobar('y esa vía es un renglón EXACTO del «incluye» de ese indicador',
      viaMala.length === 0,
      viaMala.length ? viaMala.join(' · ')
        : 'ninguna cita apunta a un renglón que el criterio no tenga');

    /* La guarda de la guarda: si la puerta dejara de leer la vía, las dos de
       arriba seguirían en verde sobre un campo decorativo. */
    comprobar('y la puerta del criterio sigue leyendo la vía antes de contar',
      /function viaDeclarada\(/.test(j70v) &&
      /var via = viaDeclarada\(e, id\);/.test(j70v) &&
      /cr\.incluye\.indexOf\(via\) < 0/.test(j70v),
      'pasaElCriterio rechaza sin vía y con una vía que el criterio no tiene');
  }

  /* ═══ NINGÚN PARÁMETRO POR OMISIÓN MIDE UNA ESTRUCTURA VACÍA (v963) ═════
     `api.indicadores()` sin argumento caía en `{}` y devolvía ceros con la
     forma de una medición; `fichaDe()` hacía lo mismo y eso es peor —una
     ficha sobre la nada sale con «Confiabilidad inquebrantable» y cero casos,
     que es un veredicto sobre una persona sacado de un objeto vacío—.

     La regla: toda función de este módulo que reciba un REGISTRO lo toma del
     gobierno actual por omisión, nunca de un objeto vacío. Se mide sobre las
     firmas y no buscando una cadena, para que no se escape una escrita de
     otra forma. */
  {
    const j70d = leer('js/70-seguimiento.js');
    const conRegistro = [], malas = [];
    /* Por ÍNDICE y no con un cuantificador perezoso: `([\s\S]{0,400}?)\n`
       captura la cadena VACÍA —lo más corto que cumple— así que la primera
       versión de esta guarda denunció las diez funciones por no encontrar
       nada en ellas. Es la misma lección que la v961 con el extractor de
       tablas: se corta por posición. */
    const re = /\n  function ([A-Za-z_$][\w$]*)\(dd(?:,[^)]*)?\) \{/g;
    let m;
    while ((m = re.exec(j70d))) {
      const nombre = m[1];
      const cabeza = j70d.slice(m.index, m.index + 900);
      conRegistro.push(nombre);
      /* Vale cualquier forma de tomar el actual: `dd = dd || D`, leerlo con
         `(dd || D)` adentro, o delegar en otra que ya lo haga. Lo que no vale
         es caer en un objeto vacío. */
      const tomaActual = /dd = dd \|\| D\b/.test(cabeza) || /\(dd \|\| D\)/.test(cabeza) ||
                         /\(\(dd \|\| D\)/.test(cabeza) || /\(dd, /.test(cabeza) ||
                         /\(dd\)/.test(cabeza);
      const cae = /if \(!dd\)\s*dd = \{\}|dd = dd \|\| \{\}|dd = \{\}/.test(cabeza);
      if (cae || !tomaActual) malas.push(nombre + (cae ? ' (cae en {})' : ' (no toma el actual)'));
    }

    comprobar('MATERIAL · se encuentran las funciones que reciben un registro',
      conRegistro.length >= 5, conRegistro.join(', '));

    comprobar('ninguna cae en un registro vacío por omisión: ceros con forma de medición',
      malas.length === 0,
      malas.length ? malas.join(' · ') + ' · se toma `dd = dd || D`'
        : 'las ' + conRegistro.length + ' toman el registro del gobierno actual');

    /* Y el arnés: una suite que no imprime ni una aserción ni un conteo no se
       pinta verde. Va acá porque es la mitad estática de la regla —que el
       corredor sepa hacerlo— y la otra mitad la demuestra una suite muda. */
    const cj = leer('pruebas/correr.js');
    comprobar('el corredor marca NO CONCLUYENTE una suite que no imprime nada',
      /NO CONCLUYENTE/.test(cj) && /concluye:/.test(cj) &&
      /process\.exit\(mal\.length \+ mudas\.length \? 1 : 0\)/.test(cj),
      'una salida vacía cuenta como no verde y sale aparte de las que fallaron');
  }

  /* ═══ EL ACTO QUE CUENTA ESTÁ EN EL REGISTRO (v964) ═════════════════════
     La v963 hizo que cada declaración dijera por cuál renglón del criterio
     entra. Faltaba la otra mitad: la única vía sólida de I-13 apuntaba a la
     Directiva Presidencial 01, y ese acto NO estaba en el registro —vivía en
     el `contrapunto` de otra entrada—. Un indicador no puede contar lo que
     no está registrado, aunque el hecho sea cierto: la cifra publicada tiene
     que poder abrirse y leerse.

     La base es obligatoria incluso cuando el acto es el de la propia entrada.
     Con la base opcional esto no cazaría nada: el autor del caso del Dane
     simplemente la habría omitido. */
  {
    const j70b = leer('js/70-seguimiento.js');
    const sinBase = [], baseMala = [], idsRepe = [];
    let declarantes = 0, conId = 0;

    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      const ent = (JSON.parse(leer(ruta)).entradas) || [];
      const ids = {};
      ent.forEach((e) => {
        if (!e.id) return;
        conId++;
        if (ids[e.id]) idsRepe.push(quien + '/' + e.id);
        ids[e.id] = true;
      });
      ent.forEach((e) => {
        const ii = e.indicadores || [];
        if (!ii.length) return;
        declarantes++;
        const donde = quien + '/' + (e.fecha || '?');
        const por = e.indicadoresPor || {};
        ii.forEach((k) => {
          const v = por[k];
          const base = (v && typeof v === 'object') ? String(v.base || '').trim() : '';
          if (!base) { sinBase.push(donde + ' declara ' + k); return; }
          if (!ids[base]) baseMala.push(donde + ' ' + k + ' nombra «' + base + '», que no está en el registro');
        });
      });
    });

    comprobar('MATERIAL · hay entradas con identificador, que es lo que una base puede nombrar',
      conId > 0 && declarantes > 0,
      conId + ' entradas con id · ' + declarantes + ' declaran indicador');

    comprobar('ningún identificador de entrada se repite dentro de su registro',
      idsRepe.length === 0,
      idsRepe.length ? idsRepe.join(' · ') : 'los identificadores son únicos');

    comprobar('toda declaración dice en qué ENTRADA del registro está el acto que cuenta',
      sinBase.length === 0,
      sinBase.length ? sinBase.join(' · ') + ' · falta `indicadoresPor.<ind>.base`'
        : 'las ' + declarantes + ' declaraciones nombran su entrada base');

    comprobar('y esa entrada existe: no se cuenta un acto que no está registrado',
      baseMala.length === 0,
      baseMala.length ? baseMala.join(' · ')
        : 'ninguna base apunta a una entrada que el registro no tenga');

    /* La guarda de la guarda: si la puerta dejara de leer la base, las tres
       de arriba seguirían en verde sobre un campo decorativo. */
    comprobar('y la puerta del criterio sigue leyendo la base antes de contar',
      /function baseDeclarada\(/.test(j70b) &&
      /var base = baseDeclarada\(e, id\);/.test(j70b) &&
      /motivo: 'sin-base-registrada'/.test(j70b),
      'pasaElCriterio rechaza sin base y con una base que el registro no tiene');
  }

  /* ═══ UN INDICADOR PROPIO NACE MARCADO COMO NO VALIDADO (v964) ══════════
     I-13 lo inventó este proyecto después de ver el caso que necesitaba
     capturar, y no se ha podido correr contra ningún gobierno anterior: el
     material no existe. Mientras eso siga así se dice junto a la cifra, no
     en una nota.

     Lo que esta guarda protege es que la marca no dependa de acordarse:
     `origen` sin declarar se lee como PROPIO, así que un indicador nuevo
     nace marcado, y el conteo de gobiernos probados se CALCULA. */
  {
    const j70v = leer('js/70-seguimiento.js');

    const bloqueInd = (j70v.match(/var INDICADORES = \{[\s\S]*?\n  \};/) || [''])[0];
    const decl = (bloqueInd.match(/'(I-\d\d)': \{[^\n]*origen: '(\w+)'/g) || []).length;
    const todos = (bloqueInd.match(/'(I-\d\d)': \{/g) || []).length;

    comprobar('MATERIAL · los indicadores declaran de dónde vienen',
      todos >= 5 && decl === todos, decl + ' de ' + todos + ' con `origen`');

    comprobar('un indicador sin `origen` declarado se toma por PROPIO, no por del pliego',
      /var origen = ind\.origen \|\| 'propio';/.test(j70v),
      'el que se olvide nace marcado: se falla cerrado, no abierto');

    comprobar('el conteo de gobiernos anteriores probados se CALCULA, no se teclea',
      /function corridaHaciaAtras\(/.test(j70v) &&
      /gobiernosAnterioresProbados: probados/.test(j70v) &&
      !/gobiernosAnterioresProbados: 0/.test(j70v),
      'sale de correr el criterio contra el registro anterior, así que la marca se quita sola');

    /* Las dos mitades de «probado», que es la distinción que la v963 midió:
       sin registros clasificados, «no dispara» no significa que el criterio
       distinga — significa que no hay material. */
    comprobar('y «probado» exige registros clasificados Y que el criterio no dispare',
      /probado: clasificadas > 0 && disparos === 0/.test(j70v),
      'un registro sin clasificar no valida nada');

    comprobar('la marca se pinta junto a la cifra, no en una nota al pie',
      /sp-c2-noval/.test(j70v) && /validado: no · gobiernos anteriores probados: /.test(j70v) &&
      /sp-c2-noval/.test(leer('css/70-seguimiento.css')),
      'sale en la tabla de indicadores y tiene regla que la pinta');
  }

  /* ═══ CAPA 3 DEL PLIEGO · LOS EJES, NUNCA EN UN SOLO NÚMERO ════════════
     La regla que sostiene la capa entera: «se muestran lado a lado, nunca
     combinados en un número único». Es la invariante más fácil de romper sin
     darse cuenta —un promedio se escribe en una línea— y la más cara: un
     gobernante puede ser sincero sobre su intención de concentrar poder
     (confiabilidad alta, deterioro alto), y el promedio de los dos no
     contesta ninguna de las dos preguntas.

     `ejesDe` devuelve una LISTA, a propósito: quien quiera un número único
     tiene que escribirlo a mano, y esa línea se ve en el diff y acá. */
  {
    const j70c3 = leer('js/70-seguimiento.js');

    comprobar('MATERIAL · los tres ejes del pliego existen en js/70',
      /function ejeA\(/.test(j70c3) && /function ejeB\(/.test(j70c3) && /function ejeC\(/.test(j70c3) &&
      /function ejesDe\(/.test(j70c3),
      'ejeA · ejeB · ejeC · ejesDe');

    /* Se busca dentro del TRAMO de la Capa 3 y no en todo el archivo: el
       módulo promedia cosas legítimas en otros sitios, y una búsqueda suelta
       denunciaría media ficha. Es la lección de la v854. */
    const iniE = j70c3.indexOf('/* ── EJE A · CONFIABILIDAD');
    const finE = j70c3.indexOf('function casosDeCx');
    const tramoEjes = (iniE >= 0 && finE > iniE) ? j70c3.slice(iniE, finE) : '';
    const promedia = /\(\s*ejeA[^)]*\+|\bpromedio\b|indiceGeneral|\bejeA\([^)]*\)\s*\+|\/\s*3\b/.test(tramoEjes);
    comprobar('los ejes no se combinan en un número único',
      tramoEjes.length > 0 && !promedia && /return \[ejeA\(dd\), ejeB\(dd, corte\), ejeC\(\)\];/.test(tramoEjes),
      !tramoEjes.length ? 'no se encontró el tramo de los ejes: la comprobación no vale'
                        : (promedia ? 'hay algo que los suma o los promedia' : 'ejesDe devuelve los tres en una lista'));

    /* Y la otra mitad de la regla de oro: los ejes son Capa 3 y el veredicto
       es de otra cosa. Ninguno puede entrar en el cálculo de los techos. */
    const tramoVer = (j70c3.match(/var techos = \{[\s\S]*?(?=\n\s*\/\* El recuento de la Capa 1)/) || [''])[0];
    const sucio = ['ejeA', 'ejeB', 'ejeC', 'ejesDe'].filter((k) => tramoVer.indexOf(k) >= 0);
    comprobar('y ningún eje entra en el cálculo del veredicto',
      tramoVer.length > 0 && sucio.length === 0,
      !tramoVer.length ? 'no se encontró el tramo del veredicto' :
        (sucio.length ? 'lo contamina: ' + sucio.join(', ') : 'el veredicto sigue saliendo de sus tres techos'));

    /* El eje B no se puede publicar sin la media histórica, y el pliego lo
       pone como condición de validez. Lo que se vigila es que el código no
       publique un nivel: `publicable` tiene que ser false mientras la media
       no exista, y la razón tiene que nombrar a los tres gobiernos. */
    comprobar('el eje B no publica nivel sin la media histórica, y nombra lo que falta',
      /nivel: null, publicable: false/.test(tramoEjes) &&
      /Petro, Duque y Santos/.test(tramoEjes),
      'el nivel queda en null y la razón nombra la serie que hace falta');

    /* La guarda de la guarda: si la ficha dejara de pintar los ejes, todo lo
       de arriba seguiría en verde sobre tres funciones que nadie llama. */
    comprobar('y la ficha pinta los tres ejes',
      /ejesDe\(D, f\.corte\)/.test(j70c3),
      'la ficha los compone');
  }

  /* ═══ CAPA 4 DEL PLIEGO · LA OPINIÓN, FUERA DEL CÁLCULO ════════════════
     «No alimenta ningún cálculo y ningún cálculo la cita como evidencia.»

     Las dos mitades hacen falta y se rompen distinto. La primera —que el
     editorial no entre al cálculo— se vigila como las anteriores. La segunda
     —que ningún registro lo cite— se vigila en el REGISTRO: una entrada
     cuya fuente apunte al propio editorial sería el módulo citándose a sí
     mismo como evidencia sobre una persona, que es la definición de un
     argumento circular. */
  {
    const j70c4 = leer('js/70-seguimiento.js');

    comprobar('MATERIAL · el marco declarado y el editorial existen en js/70',
      /function marcoDeclarado\(/.test(j70c4) && /function editorialDe\(/.test(j70c4) &&
      /function controlDeCalidad\(/.test(j70c4),
      'marcoDeclarado · editorialDe · controlDeCalidad');

    /* Las dos listas del marco son del pliego palabra por palabra. Si alguien
       las edita, cambia la definición del módulo, y eso tiene que verse. */
    comprobar('el marco declara qué mide y qué NO mide, con los tres de cada uno',
      (j70c4.match(/var MARCO_MIDE = \[([\s\S]*?)\];/) || ['', ''])[1].split("',").length === 3 &&
      /var MARCO_NO_MIDE = \[[\s\S]*?intenciones[\s\S]*?rasgos de personalidad/.test(j70c4),
      'tres cosas que mide y tres que no, incluidas las intenciones y los rasgos de personalidad');

    const tramoVer4 = (j70c4.match(/var techos = \{[\s\S]*?(?=\n\s*\/\* El recuento de la Capa 1)/) || [''])[0];
    const sucio4 = ['editorialDe', 'analisisEditorial', 'marcoDeclarado']
      .filter((k) => tramoVer4.indexOf(k) >= 0);
    comprobar('el editorial no entra en el cálculo del veredicto',
      tramoVer4.length > 0 && sucio4.length === 0,
      !tramoVer4.length ? 'no se encontró el tramo del veredicto'
                        : (sucio4.length ? 'lo contamina: ' + sucio4.join(', ')
                                         : 'el veredicto no sabe que el editorial existe'));

    /* Y la otra mitad: ningún registro puede citar el editorial como fuente. */
    const circulares = [];
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      const reg = JSON.parse(leer(ruta));
      ((reg.entradas) || []).concat(((reg.casos || {}).lista) || []).forEach((e) => {
        ((e.fuentes) || []).forEach((fu) => {
          /* Se mira el DOMINIO y no la palabra «editorial». La primera
             versión buscaba esa palabra y denunció tres fuentes legítimas
             —un editorial de Vanguardia, una columna de El Espectador—:
             citar el editorial de un periódico es normal y bueno. Lo que no
             puede pasar es que el registro se cite A SÍ MISMO, y eso se ve
             en la dirección. Medido antes de cambiarlo: cero fuentes apuntan
             hoy a urbispro.city, así que la guarda arranca limpia y falla
             cerrado. Una guarda con falsos positivos termina siendo una lista
             de excepciones que envejece (v895). */
          if (/urbispro\.city|seguimiento-presidencial\.json|analisisEditorial/i.test(String(fu.u || '')) ||
              /an[aá]lisis editorial de urbis|opini[oó]n de urbis/i.test(String(fu.n || ''))) {
            circulares.push(quien + '/' + (e.fecha || '?') + ': ' + String(fu.n || '').slice(0, 40));
          }
        });
      });
    });
    comprobar('y ningún registro cita el editorial como fuente (sería un argumento circular)',
      circulares.length === 0,
      circulares.length ? circulares.join(' · ') : 'ninguna fuente apunta a la opinión del propio módulo');

    /* El control de calidad tiene que poder FALLAR. Una lista de casilleros
       en la que todos pasan siempre es un adorno: la del pliego trae hoy tres
       fallas reales y dos que no se pueden correr, y publicarlas es el punto
       —«no publica sin la marca»—. Si un día el código dejara de contar las
       fallas, esto se pone rojo. */
    comprobar('el control de calidad cuenta las fallas y las publica, no las esconde',
      /estado === 'falla'/.test(j70c4) && /estado === 'sin-correr'/.test(j70c4) &&
      /cc\.falla \+ ' fallan · '/.test(j70c4),
      'la ficha imprime cuántos pasan, cuántos fallan y cuántos no se pudieron correr');

    comprobar('y la ficha pinta el marco, el editorial y el control',
      /marcoDeclarado\(D\)/.test(j70c4) && /editorialDe\(D\)/.test(j70c4) &&
      /controlDeCalidad\(D, f\.corte\)/.test(j70c4),
      'los tres se componen en la ficha');
  }

  /* La regla que el propio módulo se puso: una contradicción exige LAS DOS
     declaraciones documentadas. Con una sola no es un cambio de postura, es
     una postura — y como cada cambio contado baja un peldaño, dejar entrar
     una a medias mueve en público el juicio sobre una persona con medio
     expediente. Se revisa en los dos registros, y también la fuente: una
     contradicción sin enlace no se puede comprobar. */
  {
    const flojas = [];
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      const cx = ((JSON.parse(leer(ruta)).contradicciones || {}).casos) || [];
      cx.forEach((c, i) => {
        if (c.estado !== 'documentada' || c.cuenta === false) return;
        const falta = [];
        if (!(c.antes || '').trim()) falta.push('antes');
        if (!(c.despues || '').trim()) falta.push('despues');
        if (!(c.fuentes || []).length) falta.push('fuentes');
        if (falta.length) flojas.push(quien + '/' + (c.tema || ('#' + i)).slice(0, 40) + ' sin ' + falta.join(' ni '));
      });
    });
    comprobar('toda contradicción que CUENTA trae las dos declaraciones y su fuente',
      flojas.length === 0, flojas.length ? flojas.join(' · ') : 'ninguna cuenta con medio expediente');
  }

  /* La nota de cobertura del registro cerrado dice tres números a mano —cuántos
     hechos hay, cuántos caen dentro del mandato y cuántos después—. Es la única
     prosa del módulo que afirma cifras sin contarlas, y basta agregar una
     entrada para que quede mintiendo. Acá se recuenta. */
  {
    const pe = JSON.parse(leer('assets/data/seguimiento-petro.json'));
    const tot = (pe.entradas || []).length;
    const dentro = (pe.entradas || []).filter(e => e.fecha && e.fecha <= pe.entrega).length;
    const dice = (pe.cobertura || '').match(/\d+/g) || [];
    const esperado = [String(tot), String(dentro), String(tot - dentro), String(dentro)];
    const cuadra = esperado.every(n => dice.includes(n)) &&
      new RegExp('son ' + tot + ' hechos').test(pe.cobertura || '') &&
      new RegExp('solo los ' + dentro + ' que ocurrieron').test(pe.cobertura || '') &&
      new RegExp('los ' + (tot - dentro) + ' posteriores').test(pe.cobertura || '');
    comprobar('la nota de cobertura del registro cerrado dice los números que de verdad tiene',
      cuadra, cuadra ? tot + ' hechos · ' + dentro + ' dentro del mandato · ' + (tot - dentro) + ' después'
                     : 'la nota dice ' + dice.join('/') + ' y el registro tiene ' + esperado.join('/'));
  }
}

/* ── La presencia: nadie comparte en silencio ─────────────────────────
   Hasta la v811 un «radar» llamaba urbisCompartirUbicacion(true) cada 45 s
   desde cualquier pantalla de mapa. Si vuelve a aparecer una llamada así
   en lo servido, esto lo dice antes de que llegue a un teléfono. */
/* ── El informe no fabrica imágenes que nadie mira ────────────────────
   `capturarChartsClaro` convertía cada gráfico en un PNG y se lo pasaba al
   informe en un parámetro `chartsPNG`. El informe dejó de leerlo cuando los
   gráficos pasaron a dibujarse en la propia hoja, en SVG. Quedó cobrando un
   segundo largo en cada exportación a cambio de nada, y eso no se ve: el
   PDF sale igual de bien. Por eso lo vigila una comprobación y no un ojo. */
console.log('\n  -- el informe --');
{
  const servidos = fs.readdirSync(R('js')).filter(f => /\.js$/.test(f));
  /* Se buscan las FORMAS DE CÓDIGO —una llamada, un parámetro, un uso— y no
     el nombre suelto: los comentarios que explican por qué se quitó son
     justamente lo que evita que alguien lo reponga sin saber, y una regla
     que los prohibiera empujaría a borrar la explicación. */
  const RASTRO = /function\s+capturarChartsClaro|capturarChartsClaro\s*\(|chartsPNG\s*(=[^=]|\)|\.|\|\|)|,\s*chartsPNG/;
  const conPNG = servidos.filter(f => RASTRO.test(leer('js/' + f)));
  comprobar('el informe no fabrica imágenes de los gráficos que luego no lee',
            conPNG.length === 0,
            conPNG.length ? 'todavía lo hacen: ' + conPNG.join(', ') : servidos.length + ' archivos revisados');
}

console.log('\n  -- la presencia --');
{
  const servidos = fs.readdirSync(R('js')).filter(f => /\.js$/.test(f));
  const silenciosos = servidos.filter(f => /urbisCompartirUbicacion\(\s*true\s*\)|_urbisActualizarRadar\s*\(/.test(leer('js/' + f)));
  comprobar('ningún archivo servido comparte la ubicación en silencio', silenciosos.length === 0,
            silenciosos.length ? 'lo hacen: ' + silenciosos.join(', ') : servidos.length + ' archivos revisados');
  const idx = leer('index.html'), sw = leer('service-worker.js');
  comprobar('el módulo de presencia (js/78) está enlazado y en la precaché',
            /js\/78-presencia\.js\?v=/.test(idx) && /'\.\/js\/78-presencia\.js'/.test(sw) && /'\.\/css\/78-presencia\.css'/.test(sw),
            'index.html y service-worker.js');
}

console.log('\n  -- el trabajo del curso --');
{
  const curso = leer('js/81-curso-servidor.js');
  /* El tipo de la fila TIENE que llevar «comentario». No es cosmética: es lo
     único que hace que el servidor aplique la regla de autoría —la edita
     quien la escribió, con su token— y que la aplicación no la pinte como un
     punto del mapa (`esFilaMetaUrbis`, js/05). Con cualquier otro prefijo la
     entrega se rechaza al corregirla y aparece como un marcador suelto en
     mitad del sector, que es el fallo del que se salió en la v812. */
  comprobar('la fila de una entrega se llama «comentario» (autoría y fuera del mapa)',
            /var\s+PREFIJO\s*=\s*'comentario de curso '/.test(curso),
            'js/81-curso-servidor.js');
  const meta = leer('js/05-helpers-temporal-security.js');
  comprobar('y «comentario» sigue en la lista que nunca se pinta',
            /esFilaMetaUrbis[\s\S]{0,400}?indexOf\('comentario'\)/.test(meta),
            'js/05-helpers-temporal-security.js');
  /* El campo 2 es el ÚNICO que el servidor deja cambiar a un tercero (es donde
     se denuncia un comentario ajeno). Si algún día la entrega guardara algo
     ahí, cualquiera podría reescribírselo a un grupo sin ser su autor. */
  comprobar('el campo denunciable de la descripción va vacío',
            /\[carga\.autor,\s*carga\.curso,\s*'',\s*carga\.titulo,\s*codificar\(carga\)\]/.test(curso),
            'js/81-curso-servidor.js');
  /* Una entrega que el servidor recorta se pierde sin avisar. Por eso el
     módulo mide antes y se niega, en vez de mandar y confiar. */
  comprobar('una entrega demasiado grande se rechaza en vez de recortarse',
            /b64\.length\s*>\s*TOPE_CARGA/.test(curso) && /ok:\s*false/.test(curso),
            'js/81-curso-servidor.js');
  const idx = leer('index.html'), sw = leer('service-worker.js');
  comprobar('el módulo del curso (js/81) está enlazado y en la precaché',
            /js\/81-curso-servidor\.js\?v=/.test(idx) && /'\.\/js\/81-curso-servidor\.js'/.test(sw) &&
            /'\.\/css\/81-curso-servidor\.css'/.test(sw),
            'index.html y service-worker.js');
}

console.log('\n  -- el ritmo del juego --');
{
  const j12 = leer('js/12-spa-ui.js');
  /* El arcade LIBRE tiene que seguir contando monedas. Su tabla lleva años
     guardando conteos; si alguien «unifica» el marcador para no repetir
     código, todos los récords viejos quedan al lado de puntajes veinte veces
     mayores y la tabla deja de significar nada, sin un solo error a la
     vista. El interruptor es `const RITMO = premium`. */
  comprobar('el ritmo es solo del evento premium, no del arcade libre',
            /const RITMO = premium;/.test(j12), 'js/12-spa-ui.js');
  /* Sin castigo al fallar, «más rápido = más monedas» premia machacar la
     pantalla, que es lo contrario del ritmo que se buscaba. */
  comprobar('fallar y dejar escapar una moneda rompen la racha',
            /romperRacha\('fallo'/.test(j12) && /romperRacha\('escape'/.test(j12),
            'js/12-spa-ui.js');
  /* Redondear CADA moneda tira la resolución que este cambio vino a comprar:
     se midió, y cuatro partidas al mismo ritmo daban 329 clavado. Se suma con
     decimales y se redondea una sola vez, al guardar. */
  comprobar('los puntos se suman con decimales y se redondean una sola vez',
            /const pts = Math\.max\(0\.5, PUNTOS_BASE \* m \* bono\);/.test(j12) &&
            /const puntos = Math\.round\(score\);/.test(j12),
            'js/12-spa-ui.js');
  comprobar('y lo que viaja al servidor es el entero, no el decimal',
            /urbisGuardarPuntaje\(puntos, juegoId\)/.test(j12), 'js/12-spa-ui.js');
}

console.log('\n  -- una sola manera de nombrar la tabla del evento --');
{
  /* Cinco archivos armaban el identificador de la tabla copiando la misma
     línea. Cinco copias de una regla es una regla que un día deja de serlo:
     basta que alguien cambie una y ese archivo empiece a leer o escribir en
     otra tabla, sin un solo error a la vista —el ranking simplemente sale
     vacío o incompleto—.

     El nombre lleva además la ESCALA del puntaje (`_r2`), que es lo que deja
     atrás la tabla vieja sin borrar nada a mano cuando cambia cómo se
     puntúa. */
  const h05 = leer('js/05-helpers-temporal-security.js');
  comprobar('el nombre de la tabla se arma en un solo sitio',
            /function urbisJuegoIdDeEvento\(lat\)/.test(h05) &&
            /window\.urbisJuegoIdDeEvento = urbisJuegoIdDeEvento;/.test(h05),
            'js/05-helpers-temporal-security.js');
  const servidos = fs.readdirSync(R('js')).filter(f => /\.js$/.test(f) && f !== '05-helpers-temporal-security.js');
  const copias = servidos.filter(f => /'aurea_'\s*\+/.test(leer('js/' + f)));
  comprobar('y ningún otro archivo se lo arma por su cuenta',
            copias.length === 0,
            copias.length ? 'se lo arman: ' + copias.join(', ') : servidos.length + ' archivos revisados');
  comprobar('la escala del puntaje va marcada en el nombre',
            /URBIS_ESCALA_JUEGO = '_r\d+';/.test(h05), 'js/05-helpers-temporal-security.js');
}

console.log('\n  -- el calendario del evento premium --');
{
  const cal = leer('css/82-calendario.css');
  /* Encargo explícito: el calendario va en el celeste del compositor premium.
     Se mide el color, no se confía en la palabra: verde es un hex donde el
     canal verde manda con holgura sobre los otros dos. */
  const verdes = (cal.match(/#[0-9a-fA-F]{6}/g) || []).filter(h => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return g > r + 25 && g > b + 25;
  });
  comprobar('el calendario no trae ni un color verde', verdes.length === 0,
            verdes.length ? verdes.join(', ') : 'celeste URBIS');
  comprobar('y usa la paleta del compositor premium, no una propia',
            ['#7FD8F5', '#0B5E86', '#0EA5E9'].every(c => cal.indexOf(c) !== -1),
            'css/82-calendario.css');
  /* Un <label> reenvía el clic a su primer control etiquetable. Los días del
     calendario son <button>, que lo son, así que envolverlo en un <label>
     hace que cada toque cuente dos veces y el rango se elija solo. Pasó, se
     vio en pantalla, y por eso está escrito. */
  const j20 = leer('js/20-mobile-functional-app.js');
  comprobar('el calendario del compositor no va dentro de un <label>',
            !/<label[^>]*u52-ev-fechas/.test(j20), 'js/20-mobile-functional-app.js');
  /* Dos maneras de decir cuánto dura el evento acabarían contradiciéndose:
     la que el usuario ve y la que el código lee. */
  comprobar('el campo viejo de horas ya no existe en ningún archivo servido',
            !/id="ev-horas"|#ev-horas/.test(j20), 'js/20-mobile-functional-app.js');
  const idx = leer('index.html'), sw = leer('service-worker.js');
  comprobar('el calendario (js/82) está enlazado y en la precaché',
            /js\/82-calendario\.js\?v=/.test(idx) && /'\.\/js\/82-calendario\.js'/.test(sw) &&
            /'\.\/css\/82-calendario\.css'/.test(sw),
            'index.html y service-worker.js');
}

console.log('\n  -- el FODA del curso --');
{
  const edu = leer('js/64-analisis-edu.js');
  /* Traducir el FODA es cambiar el idioma, no el contenido. Y la tabla tiene
     un orden que importa: si «competidores» se cambiara antes que
     «competidores directos», la segunda ya no existiría cuando le tocara el
     turno, y el texto del curso saldría a medio traducir. */
  const m = edu.match(/const FODA_EN_CURSO = \[([\s\S]*?)\n  \];/);
  comprobar('la tabla de traducción del FODA existe', !!m, 'js/64-analisis-edu.js');
  if (m) {
    const frases = [...m[1].matchAll(/\[\/([^/]+)\//g)].map(x => x[1]);
    const malas = [];
    frases.forEach((a, i) => {
      frases.slice(i + 1).forEach(b => {
        // b viene después de a y contiene a a: a se la comería antes.
        if (b.length > a.length && b.indexOf(a) !== -1) malas.push(a + ' antes que ' + b);
      });
    });
    comprobar('y ninguna regla corta se come a una larga que viene después',
              malas.length === 0, malas.length ? malas[0] : frases.length + ' reglas');
  }
  /* Una idea de proyecto sin la medida que la sostiene es una ocurrencia
     impresa con el logo de URBIS. Las tres partes van juntas o no van. */
  const ideas = edu.match(/const IDEAS_DISENO = \[([\s\S]*?)\n  \];/);
  const cuenta = (t, re) => (t.match(re) || []).length;
  comprobar('cada idea de proyecto trae medida, encargo y trabajo de campo',
            !!ideas && cuenta(ideas[1], /porque:/g) === cuenta(ideas[1], /\bid: '/g) &&
            cuenta(ideas[1], /disena:/g) === cuenta(ideas[1], /\bid: '/g) &&
            cuenta(ideas[1], /campo:/g) === cuenta(ideas[1], /\bid: '/g),
            ideas ? cuenta(ideas[1], /\bid: '/g) + ' ideas' : 'no está la lista');
  /* El informe del curso pide el FODA traducido; el de empresas, el del motor
     tal cual. Si el educativo perdiera ese `true` volvería a imprimir «mercado
     saturado» en una entrega de taller sin que nada lo avisara. */
  const inf = leer('js/63-analisis-ia-informe.js');
  comprobar('el informe del curso imprime el FODA traducido y el de empresas no',
            /bloqueFodaAncho\(r, true\)/.test(inf) && /bloqueFodaAncho\(r\),/.test(inf),
            'js/63-analisis-ia-informe.js');
}

/* ── §7 · El idioma de lo que se imprime (v878) ──────────────────────────
   El pliego de ajustes: «Eliminar el voseo argentino que apareció: "la sombra
   que proyecta", "mida el trazado", "escríbalo acá", "con cuál te queda".»

   Eran 253 casos en el texto que ve el usuario. Una tanda los saca; esta
   comprobación es la que impide que vuelvan a entrar de a uno, que es como
   entraron.

   DOS TRAMPAS, las dos costaron un inventario falso antes de acertar:

   1. **En JavaScript `\b` trata las vocales acentuadas como NO-palabra**, así
      que `/\btocá\b/` casa DENTRO de «tocándolo» —el límite cae entre la «á»
      y la «n»— y también dentro de «medía», «pedía» o «seguía», que son
      imperfectos y no voseo. Los límites se ponen a mano, con una clase de
      letras que incluya los acentos.
   2. **Un comentario no es una cadena.** El voseo de un comentario lo lee
      quien programa; el de una cadena sale impreso en una lámina de 60 × 90 y
      lo lee un jurado. Se recorre el archivo marcando qué es comentario y se
      busca solo fuera. Sin esa separación, la comprobación obligaría a
      reescribir la bitácora entera del código para nada. */
(function () {
  const LETRA = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/;
  /* ⚠ ESTA LISTA ES LA ÚNICA DEL REPOSITORIO QUE DEBE LLEVAR VOSEO. ⚠
     La v878 corrió su reemplazo masivo sobre `pruebas/` y se comió estas
     mismas palabras —«tocá» pasó a «toque», «podés» a «puede»— dejando la
     comprobación buscando las formas CORRECTAS: 4.731 falsos positivos y una
     guarda que denunciaba justo lo que quería proteger. La comprobación de
     autoconsistencia de abajo es la que impide que vuelva a pasar. */
  const VOSEO = ['vos','ten\u00e9s','pod\u00e9s','quer\u00e9s','sab\u00e9s','llev\u00e1s','qued\u00e1s','arroj\u00e1s','mir\u00e1s',
    'hac\u00e9s','ven\u00eds','dec\u00eds','pon\u00e9s','volv\u00e9s','segu\u00eds','coincid\u00eds','entr\u00e1s','le\u00e9s','cerr\u00e1s','sos',
    'mir\u00e1','med\u00ed','escrib\u00ed','pon\u00e9','and\u00e1','ten\u00e9','hac\u00e9','fijate','eleg\u00ed','eleg\u00eds','dibuj\u00e1','toc\u00e1',
    'marc\u00e1','prob\u00e1','sum\u00e1','agreg\u00e1','guard\u00e1','abr\u00ed','cerr\u00e1','busc\u00e1','cont\u00e1','anot\u00e1','compar\u00e1',
    'revis\u00e1','us\u00e1','llen\u00e1','mov\u00e9','segu\u00ed','dej\u00e1','volv\u00e9','ped\u00ed','le\u00e9','cambi\u00e1','ampli\u00e1','acerc\u00e1',
    'alej\u00e1','analiz\u00e1','copi\u00e1','export\u00e1','llev\u00e1','peg\u00e1','avis\u00e1','encontr\u00e1s','necesit\u00e1s','proyect\u00e1s','tap\u00e1s','manten\u00e9',
    'ped\u00edsela',
    /* Entraron en la v913, las dos mezcladas con usted en la MISMA frase
       —«Pruebe desde la ficha… o imprim\u00ed desde un computador»— que es como
       se ven cuando alguien corrige medio aviso. Van una por una porque
       terminan en -\u00ed y ah\u00ed no hay regla: «asist\u00ed a uno» es correcto. */
    'imprim\u00ed'];

  /* ── Los imperativos CON PRONOMBRE PEGADO, derivados y no listados ─────
     El agujero que destapó la v897, y es estructural: al pegarle el pronombre
     al imperativo **la tilde desaparece** —«peg\u00e1» + «lo» = «pegalo»—, así que
     ninguna regla que mire acentos puede verlos. La lista de arriba tenía
     cinco escritos a mano (`guardalo`, `escribilo`, `mirala`, `ponelo`) y le
     faltaban los demás: quedaban siete «Pegalo/Pegala/Marcalo» impresos en
     avisos que el usuario lee, con la guarda en verde.

     No se arregla escribiendo más: se DERIVAN de la lista de arriba. Cada
     forma que acabe en vocal con tilde pierde la tilde y recibe cada
     pronombre, así que un verbo nuevo en la lista base trae su familia
     entera sin que su autor se acuerde — que es lo único que ha impedido que
     estas guardas se queden viejas.

     Y la forma correcta en Colombia SIEMPRE lleva tilde —«péguelo»,
     «márquelo», «guárdelo»—, así que denunciar la que no la lleva no puede
     confundirse con el castellano bueno. */
  /* La única excepción de la familia derivada, y va escrita con su razón
     porque una excepción sin razón es una lista que crece sola: `leeme` sale
     de «le\u00e9»+«me», pero acá no es una frase dirigida a nadie — es el nombre
     del archivo `LEEME.txt` que acompaña a una exportación, y esa es una
     convención de archivo tan vieja como el README. */
  const NO_ES_VOSEO = ['leeme'];
  const SIN_TILDE = { '\u00e1': 'a', '\u00e9': 'e', '\u00ed': 'i' };
  const PRONOMBRES = ['lo', 'la', 'los', 'las', 'le', 'les', 'me', 'te', 'se', 'nos'];
  VOSEO.slice().forEach(f => {
    const fin = f.slice(-1);
    if (!SIN_TILDE[fin]) return;
    const raiz = f.slice(0, -1) + SIN_TILDE[fin];
    PRONOMBRES.forEach(pr => {
      const f2 = raiz + pr;
      if (NO_ES_VOSEO.indexOf(f2) < 0 && VOSEO.indexOf(f2) < 0) VOSEO.push(f2);
    });
  });


  /* ── El voseo terminado en -á: la guarda se da vuelta ──────────────────
     La lista de formas de arriba es un VOCABULARIO, y un vocabulario solo
     caza lo que alguien se acordó de escribir en él. La v880 midió el
     agujero: quedaban VEINTISIETE imperativos voseantes impresos que la v878
     no tenía en la lista —«recargá» once veces, «pegá», «preguntá»,
     «esperá», «apuntá»— y uno lo había escrito yo mismo en la v875,
     «comprobá esto», dentro de la lámina que se imprime. La guarda salía en
     verde mientras tanto.

     Para las terminadas en -á la comprobación se da vuelta: en vez de listar
     lo prohibido, se lista lo PERMITIDO y se denuncia todo lo demás. Es la
     diferencia entre fallar abierto y fallar cerrado, y en una guarda solo
     una de las dos es aceptable: una palabra voseante nueva sale denunciada
     sola, y un futuro nuevo —«completará»— cuesta un renglón en esta lista y
     se ve en rojo hasta que alguien lo agregue. Un falso positivo cuesta una
     línea; un falso negativo cuesta la lámina impresa.

     Intenté antes la regla estructural —«el futuro es el infinitivo MÁS á,
     así que quitándole la tilde queda un infinitivo»— y **es falsa** para los
     verbos cuya raíz termina en r: «esperá» deja «esper», que acaba en «er»,
     y se leía como futuro. Lo mismo mirá, pará, tirá, generá. La prueba de
     respuesta conocida lo cazó antes de que entrara.

     Con -é y con -í no se puede hacer ni lo uno ni lo otro, y decirlo importa
     más que tenerlo: «Asistí a uno» es el nombre de un logro en `js/16`
     —pretérito de primera persona, correcto— y «salí a un sitio abierto» en
     `js/20` es voseo. Misma forma, sentidos opuestos. Esas siguen una por una
     en la lista de arriba. */
  /* Futuro de tercera persona: infinitivo + á. Correcto. */
  const FUTURO_3A = ['aparecer\u00e1', 'avisar\u00e1', 'ayudar\u00e1', 'brillar\u00e1', 'cambiar\u00e1',
    'conservar\u00e1', 'contar\u00e1', 'crecer\u00e1', 'depender\u00e1',
    'desaparecer\u00e1', 'encajar\u00e1', 'enviar\u00e1', 'estar\u00e1', 'evaluar\u00e1',
    'guardar\u00e1', 'llegar\u00e1', 'marcar\u00e1', 'mostrar\u00e1', 'pedir\u00e1', 'pelear\u00e1',
    'perder\u00e1', 'podr\u00e1', 'pondr\u00e1', 'quedar\u00e1', 'quitar\u00e1',
    'realizar\u00e1', 'recibir\u00e1', 'recomendar\u00e1', 'renombrar\u00e1',
    'seguir\u00e1', 'ser\u00e1', 'tendr\u00e1', 'usar\u00e1', 'validar\u00e1', 'ver\u00e1',
    'volver\u00e1', 'habr\u00e1', 'har\u00e1', 'dir\u00e1', 'saldr\u00e1', 'vendr\u00e1',
    'querr\u00e1', 'sabr\u00e1', 'cabr\u00e1', 'valdr\u00e1'];
  /* Topónimos escritos en el repositorio. */
  const TOPONIMOS_A = ['alcal\u00e1', 'bogot\u00e1', 'boyac\u00e1', 'cachir\u00e1', 'calarc\u00e1',
    'caquet\u00e1', 'chinchin\u00e1', 'chiquinquir\u00e1', 'chitag\u00e1', 'engativ\u00e1',
    'facatativ\u00e1', 'fusagasug\u00e1', 'tulu\u00e1', 'zipaquir\u00e1', 'panam\u00e1',
    'canad\u00e1'];
  /* Palabras corrientes, y el token del par [a-á] de una regex. */
  const CORRIENTES_A = ['ac\u00e1', 'all\u00e1', 'est\u00e1', 'quiz\u00e1', 'sof\u00e1', 'ojal\u00e1',
    'a\u00e1'];
  function esVoseoEnA(p) {
    if (p.length < 4 || p.charAt(p.length - 1) !== '\u00e1') return false;
    return FUTURO_3A.indexOf(p) === -1 && TOPONIMOS_A.indexOf(p) === -1 &&
           CORRIENTES_A.indexOf(p) === -1;
  }

    /* ── Qué parte del archivo es comentario ────────────────────────────
     Un recorrido con estados. Tiene que entender también las EXPRESIONES
     REGULARES, y eso no es un refinamiento: `js/68` lleva desde siempre un
     `.replace(/"/g, '&quot;')`, y un recorrido que no sepa que eso es una
     regex ve la comilla suelta, se cree dentro de una cadena y a partir de
     ahí clasifica mal el resto del archivo —treinta mil líneas—.

     La v878 pasó en verde con ese error dentro. No porque funcionara: porque
     la PARIDAD de las comillas que venían después dejaba, de casualidad, los
     comentarios con voseo del lado de «cadena» —que la guarda tampoco mira—.
     Bastó agregarle código con comillas a ese archivo para que la paridad
     cambiara y salieran cinco denuncias contra comentarios de siempre. Una
     comprobación que depende de la paridad de las comillas de un archivo no
     está comprobando lo que dice. (v879)

     Distinguir una regex de una división no tiene solución perfecta sin un
     analizador de verdad, pero sí una regla que acierta en código como este:
     una barra ABRE regex cuando lo último que se vio no puede terminar una
     expresión —un operador, una coma, un paréntesis de apertura, `return`—.
     Después de un nombre, un número o un paréntesis cerrado, divide.

     Y una red de seguridad que acota cualquier despiste: una cadena de
     comillas simples o dobles no cruza un salto de línea. Si llega uno, es
     que el recorrido se perdió; se vuelve a código y el daño queda en esa
     línea en vez de comerse el archivo. */

  /* Todo lo que se sirve al navegador: los módulos de `js/` y las páginas.
     Se listan del disco y no de una lista escrita, para que un archivo nuevo
     quede vigilado sin que su autor se acuerde — que es la misma razón por la
     que el aviso de origen de VT vive en `enviar` (v867). */
  const archivos = fs.readdirSync(R('js')).filter(f => /\.js$/.test(f)).map(f => 'js/' + f)
    .concat(fs.readdirSync(RAIZ).filter(f => /\.html$/.test(f)));

  const hallados = [];
  archivos.forEach(function (rel) {
    let txt = '';
    try { txt = leer(rel); } catch (e) { return; }
    if (!txt) return;
    const com = fueraDeComentario(txt), bajo = txt.toLowerCase();
    VOSEO.forEach(function (f) {
      let k = 0;
      while ((k = bajo.indexOf(f, k)) !== -1) {
        const antes = k > 0 ? txt[k - 1] : ' ', dsp = txt[k + f.length] || ' ';
        if (!LETRA.test(antes) && !LETRA.test(dsp) && !com[k]) {
          const linea = txt.slice(0, k).split('\n').length;
          hallados.push(rel + ':' + linea + ' «' + txt.substr(k, f.length) + '»');
        }
        k += f.length;
      }
    });
    /* Y el barrido estructural de las terminadas en -á, que no depende de
       que nadie se haya acordado de escribirlas en una lista. */
    const reA = /[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1]+\u00e1/g;
    let mA;
    while ((mA = reA.exec(txt))) {
      const dsp = txt[mA.index + mA[0].length] || ' ';
      if (LETRA.test(dsp) || com[mA.index]) continue;
      if (!esVoseoEnA(mA[0].toLowerCase())) continue;
      const linea = txt.slice(0, mA.index).split('\n').length;
      hallados.push(rel + ':' + linea + ' \u00ab' + mA[0] + '\u00bb');
    }
  });
  /* La lista se defiende sola: si alguien la «corrige» —o un reemplazo
     masivo vuelve a pasarle por encima— estas formas dejan de ser voseo y la
     guarda pasaría en verde sin vigilar nada. Es el peor verde que hay, y acá
     se ve a simple vista. */
  /* El recorrido se comprueba contra un caso de respuesta conocida, y el
     caso es el que lo rompió: una regex con una comilla dentro. Sin esto, el
     recorrido puede volver a perderse y la guarda seguiría saliendo verde —
     que es como pasó la v878. Se mide dónde cae cada cosa, no que no
     reviente. */
  (function () {
    const M = 'var a = t.replace(/"/g, \'&quot;\');\n' +   // la regex que rompía todo
              '/* un comentario con vos adentro */\n' +
              'var b = \'aquí escribís vos\';\n';
    const c = fueraDeComentario(M);
    const iCom = M.indexOf('vos adentro'), iCad = M.indexOf('vos\';');
    comprobar('el recorrido distingue una regex de una cadena, y comentario de código',
      !!c[iCom] && !c[iCad],
      'el «vos» del comentario ' + (c[iCom] ? 'queda tapado' : 'SE DENUNCIARÍA') +
      ' y el de la cadena ' + (c[iCad] ? 'NO SE VERÍA' : 'se ve'));
  })();

  /* La regla de las -á, contra casos de respuesta conocida. Los tres grupos
     tienen que separarse, y el tercero es el que importa: una lista de
     vocabulario los habría dejado pasar a todos. */
    (function () {
    /* Los cuatro últimos son los que tumbaron la regla estructural: su raíz
       termina en r, así que quitándoles la tilde queda algo acabado en -ar,
       -er o -ir y se leían como futuro. Van acá para que esa idea no vuelva
       a parecer buena. */
    const VOSEANTES = ['recarg\u00e1', 'pregunt\u00e1', 'peg\u00e1', 'comprob\u00e1',
      'apag\u00e1', 'borr\u00e1', 'retom\u00e1', 'verific\u00e1', 'mape\u00e1', 'apunt\u00e1', 'tom\u00e1',
      'esper\u00e1', 'mir\u00e1', 'par\u00e1', 'gener\u00e1'];
    const FUTUROS = ['aparecer\u00e1', 'ser\u00e1', 'validar\u00e1', 'podr\u00e1', 'tendr\u00e1',
      'habr\u00e1', 'har\u00e1', 'dir\u00e1', 'pondr\u00e1', 'saldr\u00e1'];
    const NOMBRES = ['bogot\u00e1', 'fusagasug\u00e1', 'ac\u00e1', 'est\u00e1', 'quiz\u00e1', 'sof\u00e1'];
    const malV = VOSEANTES.filter(function (w) { return !esVoseoEnA(w); });
    const malF = FUTUROS.filter(esVoseoEnA);
    const malN = NOMBRES.filter(esVoseoEnA);
    comprobar('la regla de las -á separa voseo, futuro y topónimo',
      !malV.length && !malF.length && !malN.length,
      malV.length || malF.length || malN.length
        ? 'no caza ' + malV.join(', ') + ' · denuncia ' + malF.concat(malN).join(', ')
        : VOSEANTES.length + ' voseantes cazados, ' + (FUTUROS.length + NOMBRES.length) + ' correctos respetados');
  })();

  const sigueSiendoVoseo = VOSEO.indexOf('vos') !== -1 &&
    VOSEO.filter(function (f) { return /[\u00e1\u00e9\u00ed]$/.test(f); }).length >= 30;
  comprobar('la lista de formas voseantes no se desvoseó a sí misma',
    sigueSiendoVoseo,
    VOSEO.filter(function (f) { return /[\u00e1\u00e9\u00ed]$/.test(f); }).length + ' formas con tilde final');
  comprobar('ningún voseo en el texto que ve el usuario (§7)', hallados.length === 0,
    hallados.length ? hallados.slice(0, 40).join(' · ') + (hallados.length > 6 ? ' …y ' + (hallados.length - 6) + ' más' : '')
                    : 'revisados ' + archivos.length + ' archivos, solo fuera de comentarios');
})();

/* ── §9 · Y el TUTEO, que es la otra familia (v908) ──────────────────────
   La v878 sacó el voseo y dejó el tuteo escrito con su número: «otra familia
   y otra decisión — si la aplicación habla de usted en todas partes o no…
   darla por hecha de paso sería tomar una decisión de producto que nadie
   tomó». §9 la toma, y esta guarda es lo que impide que vuelva a entrar de a
   uno, que es como entró.

   DÓNDE MIRA, y es la diferencia con la guarda del voseo: `dentroDeCadena`
   marca lo que está DENTRO de una cadena, no lo que está fuera de un
   comentario. Sobre código, «te» y «tu» casan dentro de `var te = ter.x` y
   `tu` dentro de un nombre; una guarda con esa clase de falso positivo
   termina con una lista de excepciones que envejece hasta no significar nada,
   que es la razón por la que la v895 no persigue «clase sin regla». Y el
   `${…}` de una plantilla también es código: sin excluirlo, un
   `demoDias.has(dia)` cae dentro de una cadena.

   DE QUÉ RESPONDE, dicho entero porque importa más que tenerlo:

   · los PRONOMBRES son estructurales y fallan CERRADO. `tú`, `ti`, `contigo`,
     `tuyo/a/os/as`, `tu`, `tus` y `te` no son otra cosa en castellano.
   · el FUTURO en -ás es estructural con lista de permitidas, la misma forma
     que la guarda de -á del voseo (v880): se lista lo que no es segunda
     persona y se denuncia todo lo demás.
   · el PRESENTE, el subjuntivo, el pretérito y los imperativos NO se pueden
     separar por forma: la de tú es idéntica a la de tercera persona («la app
     marca el punto» / «Marca el punto»), y a veces a un sustantivo («una
     marca de agua», «Recarga de acuíferos» — los dos salieron en la tanda).
     Esa mitad es un VOCABULARIO y por tanto falla ABIERTO. Se dice acá en vez
     de fingir que está cubierta, que es la decisión de la v880 con las formas
     en -é y en -í del voseo. */
(function () {
  /* Marca lo que está dentro de una cadena de JavaScript —`${…}` de plantilla
     excluido— o, en un HTML, dentro del texto y de los atributos que se leen. */
  function dentroDeCadena(txt) {
    const s = new Uint8Array(txt.length);
    const ANTES_REGEX = /[(,=:[!&|?{};+\-*%~^<>]$/;
    let i = 0, modo = 0;
    while (i < txt.length) {
      const c = txt[i], d = txt[i + 1];
      if (modo === 0) {
        if (c === '/' && d === '/') { modo = 1; i += 2; continue; }
        if (c === '/' && d === '*') { modo = 2; i += 2; continue; }
        if (c === '/') {
          const prev = txt.slice(Math.max(0, i - 12), i).replace(/\s+$/, '');
          if (!prev || ANTES_REGEX.test(prev) || /\b(return|typeof|case|in|of|new|delete|void)$/.test(prev)) { modo = 6; i++; continue; }
          i++; continue;
        }
        if (c === "'") { modo = 3; i++; continue; }
        if (c === '"') { modo = 4; i++; continue; }
        if (c === '`') { modo = 5; i++; continue; }
        i++; continue;
      }
      if (modo === 1) { if (c === '\n') modo = 0; i++; continue; }
      if (modo === 2) { if (c === '*' && d === '/') { modo = 0; i += 2; continue; } i++; continue; }
      if (c === '\\') { if (modo >= 3 && modo <= 5) { s[i] = s[i + 1] = 1; } i += 2; continue; }
      if (modo === 6) {
        if (c === '[') { while (i < txt.length && txt[i] !== ']') { if (txt[i] === '\\') i++; i++; } i++; continue; }
        if (c === '/') { modo = 0; i++; continue; }
        if (c === '\n') { modo = 0; i++; continue; }
        i++; continue;
      }
      if ((modo === 3 || modo === 4) && c === '\n') { modo = 0; i++; continue; }
      if ((modo === 3 && c === "'") || (modo === 4 && c === '"') || (modo === 5 && c === '`')) { modo = 0; i++; continue; }
      if (modo === 5 && c === '$' && d === '{') {
        let prof = 1, j = i + 2;
        while (j < txt.length && prof > 0) {
          const e = txt[j];
          if (e === '{') prof++;
          else if (e === '}') prof--;
          else if (e === "'" || e === '"' || e === '`') { const q = e; j++; while (j < txt.length && txt[j] !== q) { if (txt[j] === '\\') j++; j++; } }
          j++;
        }
        i = j; continue;
      }
      s[i] = 1; i++;
    }
    return s;
  }
  function dentroDeTextoHtml(txt) {
    const s = new Uint8Array(txt.length);
    let i = 0;
    while (i < txt.length) {
      if (txt[i] === '<') {
        const cierra = txt.indexOf('>', i);
        if (cierra === -1) break;
        const etq = txt.slice(i, cierra + 1);
        const re = /\b(title|placeholder|alt|aria-label|value)\s*=\s*("([^"]*)"|'([^']*)')/gi;
        let m;
        while ((m = re.exec(etq))) {
          const val = m[3] !== undefined ? m[3] : m[4];
          if (!val) continue;
          const off = i + m.index + m[0].indexOf(val, m[0].indexOf('='));
          for (let k = 0; k < val.length; k++) s[off + k] = 1;
        }
        if (/^<script\b/i.test(etq)) {
          const fin = txt.toLowerCase().indexOf('</script', cierra);
          const cuerpo = txt.slice(cierra + 1, fin === -1 ? txt.length : fin);
          const sub = dentroDeCadena(cuerpo);
          for (let k = 0; k < sub.length; k++) if (sub[k]) s[cierra + 1 + k] = 1;
          i = fin === -1 ? txt.length : fin; continue;
        }
        if (/^<style\b/i.test(etq)) {
          const fin = txt.toLowerCase().indexOf('</style', cierra);
          i = fin === -1 ? txt.length : fin; continue;
        }
        i = cierra + 1; continue;
      }
      s[i] = 1; i++;
    }
    return s;
  }

  const LETRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;
  const PRONOMBRES = ['tú', 'ti', 'contigo', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'tu', 'tus', 'te'];
  /* Las DOS excepciones, cada una con su razón escrita —como el `leeme` de la
     guarda del voseo—: en la lista de palabras con las que se busca un oficio
     en la vitrina, «te» es la infusión y no el pronombre; y «TI» en el selector
     de documento es el código de Tarjeta de Identidad, un valor que viaja al
     servidor. Se miran por el CONTEXTO de alrededor y no por lo que sigue,
     porque ese código aparece dos veces en el mismo renglón —en el `value` y
     en el rótulo— y solo una de las dos lleva al lado lo que lo identifica. */
  const NO_ES_TUTEO = [['js/13i-vitrina.js', 'te aromatica'],
                       ['index.html', 'tarjeta de identidad (ti)'],
                       /* «ganaste» es la CLAVE con la que se guarda un aviso
                          de premio, no un texto: la v909 la dejó escrita como
                          lo que no se toca —cambiarla deja mudos los avisos
                          que una persona ya tiene guardados—. El título que
                          sí se lee ya habla de usted. */
                       ['js/13j-premio.js', "sub: 'ganaste'"],
                       ['js/13j-premio.js', "n.sub === 'ganaste'"]];
  /* Lo que termina en -ás y no es un futuro de tú. Corto a propósito: si
     entra una palabra nueva cuesta un renglón y se ve en rojo hasta que
     alguien la agregue, que es lo contrario de una guarda que falla abierto. */
  const NO_ES_FUTURO = ['quizás', 'jamás', 'además', 'atrás', 'detrás', 'demás',
    'compás', 'más', 'Tomás', 'Acacías'];
  /* Lo que termina en -ste y NO es un pretérito de tú: sustantivos,
     adjetivos, los puntos cardinales compuestos y los verbos en -sistir /
     -sestar, que en tercera persona acaban igual. Corto a propósito, como
     `NO_ES_FUTURO`: una palabra nueva cuesta un renglón y se ve en rojo
     hasta que alguien la agregue. */
  const NO_ES_PRETERITO = ['este', 'oeste', 'noreste', 'noroeste', 'sureste', 'suroeste',
    'sudeste', 'sudoeste', 'celeste', 'triste', 'chiste', 'poste', 'coste', 'ajuste',
    'desajuste', 'reajuste', 'contraste', 'desgaste', 'gaste', 'guste', 'liste', 'conteste',
    'existe', 'consiste', 'asiste', 'insiste', 'persiste', 'resiste', 'subsiste', 'desiste',
    'preste', 'reste', 'baste', 'aste', 'peste', 'agreste', 'hueste', 'este.', 'waste'];
  /* Lo que termina en -ías y NO es un condicional ni un imperfecto de tú. Es
     la lista más larga de las cuatro y a propósito: esta aplicación habla de
     VÍAS, de DÍAS, de CATEGORÍAS y de una docena de comercios en -ería. El
     canje se dice entero: un tipo de comercio nuevo —una cerrajería, una
     licorería— cuesta un renglón acá y se ve en rojo hasta que alguien lo
     agregue. Es el mismo contrato de la v880, y se paga porque la otra mitad
     —fallar abierto— es la que dejó pasar «pasarías» durante cincuenta
     versiones.

     Y NO hay regla de forma que las separe. El condicional es el infinitivo
     más -ías, así que su raíz acaba en -ar, -er o -ir… y «panadería» acaba en
     «er» igual que «comer». Es exactamente la regla que la v880 probó y
     descartó para el futuro en -á, vista por el otro lado. */
  const NO_ES_CONDICIONAL = ['vías', 'días', 'categorías', 'energías', 'alcaldías',
    'curadurías', 'notarías', 'droguerías', 'panaderías', 'cafeterías', 'cirugías',
    'acacías', 'policías', 'compañías', 'jerarquías', 'tecnologías', 'garantías',
    'secretarías', 'veedurías', 'contralorías', 'anomalías', 'fotografías', 'geografías',
    'topografías', 'cartografías', 'mensajerías', 'ferreterías', 'papelerías', 'librerías',
    'peluquerías', 'lavanderías', 'joyerías', 'licorerías', 'cerrajerías',
    /* `vacías` es de las dos: adjetivo —«cajas vacías»— y presente de tú de
       vaciar. Acá es siempre el adjetivo, y va listada con esa razón. */
    'vacías'];
  /* Lo que termina en -abas y no es un imperfecto de tú. La lista es corta de
     verdad: en castellano casi nada acaba así. */
  const NO_ES_IMPERFECTO = ['sílabas', 'habas', 'trabas', 'bravas', 'octavas'];

  const arch = fs.readdirSync(R('js')).filter(f => /\.js$/.test(f)).map(f => 'js/' + f)
    .concat(fs.readdirSync(RAIZ).filter(f => /\.html$/.test(f)));
  const tuteos = [];
  arch.forEach(function (rel) {
    let txt = '';
    try { txt = leer(rel); } catch (e) { return; }
    if (!txt) return;
    const cad = /\.html$/.test(rel) ? dentroDeTextoHtml(txt) : dentroDeCadena(txt);
    const bajo = txt.toLowerCase();
    const apunta = (k, largo) => {
      const ctx = txt.slice(Math.max(0, k - 45), k + 45).toLowerCase();
      if (NO_ES_TUTEO.some(e => rel.indexOf(e[0]) !== -1 && ctx.indexOf(e[1]) !== -1)) return;
      tuteos.push(rel + ':' + txt.slice(0, k).split('\n').length + ' «' + txt.substr(k, largo) + '»');
    };
    PRONOMBRES.forEach(function (f) {
      let k = -1;
      while ((k = bajo.indexOf(f, k + 1)) !== -1) {
        if (!cad[k]) continue;
        const antes = k > 0 ? txt[k - 1] : ' ', dsp = txt[k + f.length] || ' ';
        if (LETRA.test(antes) || LETRA.test(dsp) || antes === '-' || dsp === '-' || antes === '\\') continue;
        apunta(k, f.length);
      }
    });
    const reAS = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+ás(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g;
    let m;
    while ((m = reAS.exec(txt))) {
      if (!cad[m.index]) continue;
      if (NO_ES_FUTURO.some(w => w.toLowerCase() === m[0].toLowerCase())) continue;
      apunta(m.index, m[0].length);
    }
    /* Y el PRETÉRITO en -ste, que es la tercera mitad estructural (v945).
       En castellano `-ste` no es desinencia de ninguna otra persona: «fuiste»,
       «marcaste», «viste» solo pueden ser tú. Lo que colisiona no son otras
       personas sino SUSTANTIVOS y los verbos en -sistir/-sestar, y esos se
       listan —se lista lo permitido y se denuncia todo lo demás, que es la
       forma de la guarda del voseo en -á (v880)—. */
    const reSTE = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+ste(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g;
    while ((m = reSTE.exec(txt))) {
      if (!cad[m.index]) continue;
      if (NO_ES_PRETERITO.some(w => w.toLowerCase() === m[0].toLowerCase())) continue;
      /* Una mayúscula DENTRO de la palabra no existe en la prosa castellana:
         es un identificador dentro de una cadena —`urbisProCityGeoAjuste` en
         un `oninput`—, y esos no le hablan a nadie. Se descarta por la FORMA
         y no con un renglón de lista, que es lo que hace que un
         identificador nuevo no cueste una excepción. */
      if (/[A-ZÁÉÍÓÚÜÑ]/.test(m[0].slice(1))) continue;
      apunta(m.index, m[0].length);
    }
    /* Y las dos familias que la v952 midió, que son estructurales por la misma
       razón que `-ste`: en castellano `-ías` y `-abas` no son desinencia de
       ninguna otra persona. «pasarías» y «estabas» solo pueden ser tú —la
       primera y la tercera son «pasaría» y «estaba», sin ese -s—. Lo que
       colisiona no son otras personas sino SUSTANTIVOS, y esos se listan. */
    [[/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+ías(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, NO_ES_CONDICIONAL],
     [/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+abas(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, NO_ES_IMPERFECTO]]
      .forEach(function (par) {
        const re = par[0], permitidas = par[1];
        let z;
        while ((z = re.exec(txt))) {
          if (!cad[z.index]) continue;
          if (permitidas.some(w => w.toLowerCase() === z[0].toLowerCase())) continue;
          /* Misma regla de forma que en -ste: una mayúscula DENTRO de la
             palabra es un identificador y no le habla a nadie. */
          if (/[A-ZÁÉÍÓÚÜÑ]/.test(z[0].slice(1))) continue;
          apunta(z.index, z[0].length);
        }
      });
  });

  /* La guarda se comprueba contra casos de respuesta conocida, y los casos
     son los que la tumbaban: un `te` de código, un `${…}` de plantilla y un
     topónimo. Sin esto puede volver a perderse y seguiría saliendo verde,
     que es como pasó la v878. */
  (function () {
    const M = 'var te = ter.elevacion;\n' +
              'var a = `hay ${demoDias.has(dia)} y tu casa`;\n' +
              'var b = \'San Andrés\';\n';
    const c = dentroDeCadena(M);
    const iCod = M.indexOf('te = ter'), iTxt = M.indexOf('tu casa'), iHas = M.indexOf('.has(dia)');
    comprobar('la guarda del tuteo mira dentro de la cadena, no del código',
      !c[iCod] && !c[iHas] && !!c[iTxt],
      'el «te» de código ' + (c[iCod] ? 'SE DENUNCIARÍA' : 'queda fuera') +
      ', el `${}` ' + (c[iHas] ? 'SE DENUNCIARÍA' : 'queda fuera') +
      ' y el «tu» del texto ' + (c[iTxt] ? 'se ve' : 'NO SE VERÍA'));

    /* Y la regla del pretérito, contra su propio caso de respuesta conocida:
       sin esto podría quedarse sin morder —una lista de permitidas que se
       coma la regla, un `continue` de más— y todo seguiría en verde, que es
       como pasó la v878 con su propia lista. */
    const re = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+ste(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g;
    const ok = w => { re.lastIndex = 0; const x = re.exec(w); return !!x &&
      !NO_ES_PRETERITO.some(z => z.toLowerCase() === x[0].toLowerCase()) &&
      !/[A-ZÁÉÍÓÚÜÑ]/.test(x[0].slice(1)); };
    comprobar('la del pretérito en -ste caza el tuteo y deja pasar lo que no lo es',
      ok('fuiste') && ok('marcaste') && ok('leíste') &&
      !ok('este') && !ok('existe') && !ok('noreste') && !ok('urbisProCityGeoAjuste'),
      'tuteo: fuiste ' + ok('fuiste') + ' · marcaste ' + ok('marcaste') +
      ' · leíste ' + ok('leíste') + ' — no lo es: este ' + ok('este') +
      ' · existe ' + ok('existe') + ' · noreste ' + ok('noreste') +
      ' · urbisProCityGeoAjuste ' + ok('urbisProCityGeoAjuste'));

    /* Y las dos de la v952, contra sus propios casos de respuesta conocida.
       La de -ías es la que más puede quedarse sin morder, porque su lista de
       permitidas es la más larga: si alguien metiera ahí un verbo, la regla
       pasaría a callar justo lo que existe para cazar. */
    const prueba = (rx, lista) => w => {
      rx.lastIndex = 0; const x = rx.exec(w);
      return !!x && !lista.some(z => z.toLowerCase() === x[0].toLowerCase()) &&
             !/[A-ZÁÉÍÓÚÜÑ]/.test(x[0].slice(1));
    };
    const oI = prueba(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+ías(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, NO_ES_CONDICIONAL);
    comprobar('la del condicional en -ías caza el tuteo y deja pasar los sustantivos',
      oI('pasarías') && oI('tendrías') && oI('sabías') &&
      !oI('vías') && !oI('días') && !oI('categorías') && !oI('droguerías'),
      'tuteo: pasarías ' + oI('pasarías') + ' · tendrías ' + oI('tendrías') +
      ' · sabías ' + oI('sabías') + ' — no lo es: vías ' + oI('vías') +
      ' · días ' + oI('días') + ' · categorías ' + oI('categorías') +
      ' · droguerías ' + oI('droguerías'));
    const oA = prueba(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+abas(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, NO_ES_IMPERFECTO);
    comprobar('la del imperfecto en -abas caza el tuteo y deja pasar los sustantivos',
      oA('estabas') && oA('mirabas') && !oA('sílabas') && !oA('habas'),
      'tuteo: estabas ' + oA('estabas') + ' · mirabas ' + oA('mirabas') +
      ' — no lo es: sílabas ' + oA('sílabas') + ' · habas ' + oA('habas'));
  })();

  comprobar('ningún tuteo en el texto que ve el usuario (§9)', tuteos.length === 0,
    tuteos.length ? tuteos.slice(0, 40).join(' · ') + (tuteos.length > 40 ? ' …y ' + (tuteos.length - 40) + ' más' : '')
                  : 'revisados ' + arch.length + ' archivos; los pronombres, el futuro en -ás, el pretérito ' +
                    'en -ste, el condicional en -ías y el imperfecto en -abas son estructurales; el ' +
                    'presente y los imperativos NO se pueden separar de la ' +
                    'tercera persona y esa mitad no la cubre nadie');
})();

console.log('\n  -- un nombre, una cosa --');
{
  const ASIG = /\bwindow\.([A-Za-z_$][\w$]*)\s*(?<![=!<>])=(?!=)\s*(.*)/;
  const forma = (resto) => {
    const t = resto.trim();
    if (/^(function\b|async\b|\([^)]*\)\s*=>)/.test(t)) return 'función';
    if (t.startsWith('[')) return 'lista';
    if (/^[\w$.()\[\]]+\.(filter|map|slice|concat)\(/.test(t)) return 'lista';
    return null;   // lo demás no se puede clasificar leyendo una línea
  };
  const donde = {};
  fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).sort().forEach(f => {
    leer('js/' + f).split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
      const m = ASIG.exec(l);
      if (!m) return;
      const cual = forma(m[2]);
      if (!cual) return;
      (donde[m[1]] = donde[m[1]] || []).push({ archivo: f, linea: i + 1, forma: cual });
    });
  });
  const chocan = Object.keys(donde).filter(n => {
    const formas = new Set(donde[n].map(x => x.forma));
    const archivos = new Set(donde[n].map(x => x.archivo));
    return formas.size > 1 && archivos.size > 1;
  });
/* ── §10b · LOS TRAMOS DE EDAD REPARTEN EL CENSO, SIN REPETIR (v916) ─────
   El pliego v2 reportó que «30 a 44» y «45 a 64» traían el mismo valor exacto
   —15.787 · 22 %— y pidió revisar el mapeo de campos de edad.

   Revisado: el mapeo está bien. Los cinco tramos PARTEN los veintiún campos
   del censo —cada uno en exactamente un tramo, ninguno suelto— así que dos
   tramos no pueden compartir un sumando, y la coincidencia de la corrida real
   no sale de acá. Eso se midió antes de tocar nada y no se tocó nada.

   Lo que sí queda es esta guarda, porque la propiedad que hace imposible el
   defecto no está escrita en ninguna parte: es una coincidencia entre dos
   listas que alguien puede romper editando una sola. Un campo repetido daría
   exactamente el síntoma reportado —dos tramos con cifra idéntica— y un campo
   suelto perdería población sin que nada lo dijera, que es peor porque no se
   ve. Es la regla de la v879 puesta sobre dos listas en vez de sobre dos
   rutas de cálculo. */
{
  const F = 'js/61-analisis-ia-datos.js';
  const src = leer(F);
  const bloque = (src.match(/const EDADES = \[([^\]]*)\]/) || [])[1] || '';
  const edades = (bloque.match(/'[^']+'/g) || []).map(x => x.slice(1, -1));
  const tramos = [...src.matchAll(/campos:\s*\[([^\]]*)\]/g)]
    .map(m => (m[1].match(/'[^']+'/g) || []).map(x => x.slice(1, -1)));
  const repartidos = [].concat(...tramos);
  const repetidos = repartidos.filter((x, i) => repartidos.indexOf(x) !== i);
  const sinTramo = edades.filter(x => repartidos.indexOf(x) === -1);
  const inventados = repartidos.filter(x => edades.indexOf(x) === -1);
  comprobar('los tramos de edad no repiten un campo del censo',
    edades.length > 0 && tramos.length > 0 && repetidos.length === 0,
    repetidos.length
      ? 'en dos tramos: ' + [...new Set(repetidos)].join(', ') + ' — dos tramos con la misma cifra'
      : tramos.length + ' tramos sobre ' + edades.length + ' campos, ninguno repetido');
  comprobar('y no dejan ninguno afuera: la pirámide suma la población entera',
    sinTramo.length === 0 && inventados.length === 0,
    (sinTramo.length ? 'sin tramo: ' + sinTramo.join(', ') + ' ' : '') +
    (inventados.length ? 'en un tramo pero no en EDADES: ' + inventados.join(', ') : '') ||
      'los ' + edades.length + ' repartidos, sin sobrantes');
}

/* ── UN PANEL SE APAGA POR UN SOLO CAMINO (v915) ─────────────────────────
   «Había dos caminos de apagado y solo uno obedecía. Ese era el bug de fondo
   detrás de todo lo que veníamos persiguiendo. Queda como regla: un panel se
   apaga por un solo camino, y ese camino lee el peldaño.»

   El defecto de la v912: §21 apagaba mapas por TAMAÑO con su propia lista
   corta de protegidos, así que el peldaño 0 valía en la bisección y no ahí, y
   dos mapas de categoría —peldaño 0— se fueron de la hoja. Aquella tanda le
   puso la comprobación del peldaño al lado de la lista; la v915 retiró las
   dos listas derivadas —la de §21 y `PLIEGO_INTOCABLES`— y dejó una puerta,
   `puedeCeder`, que las tres decisiones llaman.

   ESTA GUARDA IMPIDE LA CUARTA. Persigue el caso en que alguien escriba otro
   camino de apagado y lo filtre leyendo el peldaño por su cuenta: eso es una
   segunda copia de la regla, y dos copias de una regla se separan (v879).

   De qué NO responde, y decirlo importa más que tenerlo (v880): un camino
   nuevo que no mire el peldaño EN ABSOLUTO no lo ve esta comprobación —falla
   abierto para ese caso—. Lo cierra la otra mitad, sobre el papel: en
   `tdoslaminas`, ningún panel del peldaño 0 puede faltar de una hoja
   compuesta. Un camino nuevo deja su huella ahí aunque no lea nada. */
{
  const F = 'js/68-procity-reconocimiento.js';
  const lineas = leer(F).split('\n');
  /* Lo PERMITIDO, con su razón, en vez de una lista de lo prohibido: es la
     forma de la guarda del voseo en -á (v880). Cada sitio dice para qué lee
     el peldaño, y lo que no esté acá sale denunciado. */
  const PERMITIDO = {
    // La puerta misma: es la única que decide si un panel puede ceder.
    puedeCeder: 'la puerta única',
    /* Y el ORDEN, que es otra pregunta: entre los que ya pueden ceder, cuál
       primero. Ahí el peldaño es un número que se compara y se corrige con
       la guarda de última caja (v913), no una autorización. */
    laminaAjustada: 'el orden de cesión y la guarda de última caja'
  };
  const sueltos = [];
  let dentro = '';
  lineas.forEach((ln, i) => {
    const m = ln.match(/^  function ([A-Za-z0-9_$]+)\s*\(/);
    if (m) dentro = m[1];
    if (!/\bpeldanoDe\s*\(/.test(ln)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;          // un comentario no llama a nada
    if (dentro === 'peldanoDe') return;                  // su propia definición
    if (PERMITIDO[dentro]) return;
    sueltos.push(F + ':' + (i + 1) + ' en ' + (dentro || 'el nivel del módulo'));
  });
  comprobar('el peldaño se lee solo desde la puerta de apagado y desde el orden',
    sueltos.length === 0,
    sueltos.length
      ? sueltos.join(' · ') + ' — hacelo pasar por puedeCeder()'
      : Object.keys(PERMITIDO).map(k => k + ' (' + PERMITIDO[k] + ')').join(' · '));
  /* Y la guarda de la guarda: si `puedeCeder` dejara de leer el peldaño, esta
     comprobación seguiría en verde sin vigilar nada — que es el patrón de la
     v878 con su propia lista y el de la v868 con las listas vivas. */
  const cuerpoPuerta = (leer(F).match(/function puedeCeder\([^]*?\n  \}/) || [''])[0];
  comprobar('y la puerta sigue leyéndolo: sin eso, esta comprobación sería un verde',
    /peldanoDe\s*\(/.test(cuerpoPuerta) && /return false/.test(cuerpoPuerta),
    cuerpoPuerta ? 'puedeCeder lee el peldaño' : 'NO se encontró puedeCeder');
}

/* ── UN HUECO ES DONDE SE TRAE UN PAPEL, Y ESO LO DICE `panelVacio` ────────
   El almacén de campo solo acepta un `hueco` que la lámina declare, porque un
   dato de campo cierra algo que la hoja dice que le falta; si no, no hay dónde
   pintarlo (v929). Pero la lista del almacén se derivaba de `PANELES_DE_VACIO`,
   que es la lista de MAQUETACIÓN —las baldosas que no ceden—, y esas dos cosas
   dejaron de coincidir en la v880, cuando «Servicios públicos» salió de los
   vacíos obligatorios porque la capa del censo lo llena.

   Nadie se enteró durante tres versiones, y no se podía ver: el panel sigue
   maquetado como baldosa ámbar. Lo que cambió es que su caja ya NO pasa por
   `panelVacio` —no dice «sin dato oficial disponible», imprime lo que la capa
   conteste—. O sea que el discriminante estaba en el código y nadie lo miraba,
   que es la forma de la v875 con `puntos` y de la v899 con `cu.edificios`.

   La guarda liga las dos listas en las DOS direcciones, que es lo que la hace
   servir: un panel que deja de pasar por `panelVacio` y se queda en la lista de
   huecos sale en rojo, y uno que empieza a pasar por ahí y no está, también.
   Así, la próxima vez que una fuente nueva llene un vacío, el almacén no se
   entera solo. */
{
  const F = 'js/68-procity-reconocimiento.js';
  const src = leer(F);
  const lista = (nombre) => {
    const m = src.match(new RegExp('var ' + nombre + ' = \\[([^\\]]*)\\]'));
    return m ? (m[1].match(/'([^']+)'/g) || []).map(x => x.slice(1, -1)) : [];
  };
  const maqueta = lista('TITULOS_DE_VACIO');
  const huecos  = lista('TITULOS_DE_HUECO');

  /* La guarda de material va PRIMERO (v920): si las listas no se pudieron
     leer, las de abajo pasarían por no tener nada que comparar. */
  comprobar('MATERIAL · las dos listas de vacío se leen del módulo',
    maqueta.length >= 2 && huecos.length >= 2 && huecos.length <= maqueta.length,
    'maqueta ' + maqueta.length + ' · huecos ' + huecos.length);

  /* Cada caja se mide DENTRO de su propio trozo y no sobre el archivo entero,
     que es la lección de la v854: buscar `panelVacio(` suelto encontraría el de
     la caja de al lado. Los cortes son las propias llamadas a `caja(`. */
  const marcas = maqueta
    .map(t => ({ t: t, i: src.indexOf("caja('" + t + "',") }))
    .filter(x => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  const conPanelVacio = marcas.filter(x => {
    const sig = src.indexOf("caja('", x.i + 6);
    return /panelVacio\s*\(/.test(src.slice(x.i, sig > 0 ? sig : x.i + 9000));
  }).map(x => x.t);

  comprobar('MATERIAL · las cinco cajas de vacío se encuentran en el módulo',
    marcas.length === maqueta.length,
    marcas.length + ' de ' + maqueta.length +
      (marcas.length === maqueta.length ? '' :
        ' — falta ' + maqueta.filter(t => !marcas.some(m => m.t === t)).join(', ')));

  const sobran = conPanelVacio.filter(t => huecos.indexOf(t) === -1);
  const faltan = huecos.filter(t => conPanelVacio.indexOf(t) === -1);
  comprobar('todo hueco de vacío lo pinta panelVacio, y todo lo que pinta es un hueco',
    sobran.length === 0 && faltan.length === 0,
    (sobran.length || faltan.length)
      ? (sobran.length ? 'pinta vacío y NO es hueco: ' + sobran.join(', ') + '. ' : '') +
        (faltan.length ? 'es hueco y NO lo pinta: ' + faltan.join(', ') +
          ' — si dejó de ser un vacío, sáquelo de TITULOS_DE_HUECO.' : '')
      : conPanelVacio.length + ' de ' + maqueta.length + ' pasan por panelVacio: ' +
        conPanelVacio.join(' · '));

  /* Y la guarda de la guarda: si `huecosDeCampo` dejara de leer la lista de
     huecos, todo lo de arriba seguiría en verde sin vigilar el almacén — el
     patrón de la v878 con su propia lista. */
  const cuerpoHuecos = (src.match(/function huecosDeCampo\([^]*?\n  \}/) || [''])[0];
  comprobar('y el almacén sigue leyendo la lista de huecos, no la de maquetación',
    /HUECOS_DE_VACIO/.test(cuerpoHuecos) && !/PANELES_DE_VACIO/.test(cuerpoHuecos),
    cuerpoHuecos ? 'huecosDeCampo lee HUECOS_DE_VACIO' : 'NO se encontró huecosDeCampo');

  /* ── LO QUE SE GUARDA Y LO QUE RECALCULA (v946) ────────────────────────
     Los tres paneles de percepción los ACEPTA el almacén y NO habilitan
     post-sector. Las dos mitades hacen falta y se miden por separado: sin la
     primera se pierde lo que alguien anotó caminando, y sin la segunda un
     sector se declara recalculado por tres frases que no mueven una cifra,
     que es la falta de la v867 en su forma más fácil de creer. */
  const perc = lista('TITULOS_DE_PERCEPCION');
  comprobar('MATERIAL · los tres paneles de percepción se leen del módulo',
    perc.length === 3, perc.join(' · ') || 'no se leyeron');

  comprobar('el almacén acepta los tres de percepción',
    /PANELES_DE_PERCEPCION/.test(cuerpoHuecos),
    /PANELES_DE_PERCEPCION/.test(cuerpoHuecos)
      ? 'huecosDeCampo los concatena'
      : 'huecosDeCampo NO los conoce: lo anotado no se podría guardar');

  const cuerpoCuenta = (src.match(/function cuentaParaPostSector\([^]*?\n  \}/) || [''])[0];
  const excluye = /PANELES_DE_PERCEPCION/.test(cuerpoCuenta) &&
                  /indexOf\(String\(id \|\| ''\)\) === -1/.test(cuerpoCuenta);
  comprobar('y NINGUNO de los tres habilita análisis post-sector', excluye,
    /* El detalle enseña lo que de verdad encontró: la primera versión
       imprimía «los excluye por la lista» también en rojo, que es un detalle
       que miente justo cuando hace falta leerlo. */
    excluye ? 'cuentaParaPostSector los excluye por la lista'
            : (cuerpoCuenta ? 'cuentaParaPostSector NO mira la lista: «' +
                 cuerpoCuenta.replace(/\s+/g, ' ').slice(0, 90) + '»'
                            : 'NO se encontró cuentaParaPostSector'));

  /* Y la guarda de la guarda: si `tieneCampo` dejara de llamar a la puerta,
     las dos de arriba seguirían en verde sobre una regla que nadie aplica. */
  const cuerpoTiene = (src.match(/function tieneCampo\([^]*?\n  \}/) || [''])[0];
  comprobar('y tieneCampo sigue pasando cada entrada por esa puerta',
    /cuentaParaPostSector\(/.test(cuerpoTiene),
    /cuentaParaPostSector\(/.test(cuerpoTiene)
      ? 'tieneCampo la llama' : 'tieneCampo NO la llama: la regla no mordería');

  /* ── QUIÉN MIDIÓ CADA FILA (v949) ──────────────────────────────────────
     Las cuatro plantillas que se CAMINAN llevan la atribución por fila, y
     las cuatro la resuelven por `quienesDeFilas`. La guarda es de clase y no
     del caso: lo que no puede volver es que un sitio imprima el `quien` de
     la ENTRADA sobre una plantilla repartida entre dos personas, que es
     media procedencia falsa sin que se vea (v867).

     Falla CERRADO: una plantilla caminada nueva que no llame al ayudante
     sale en rojo en su primera composición, en vez de tres tandas después
     (es el canje de la v880 con la guarda del voseo). */
  const CAMINADAS = ['actividadDeCampo', 'perfilDeCampo', 'andenesDeCampo', 'rutasDeCampo'];
  const sinResolver = CAMINADAS.filter(function (f) {
    const cuerpo = (src.match(new RegExp('function ' + f + '\\([^]*?\\n  \\}')) || [''])[0];
    return !/quienesDeFilas\(/.test(cuerpo);
  });
  comprobar('las cuatro plantillas caminadas resuelven quién midió CADA fila',
    sinResolver.length === 0,
    sinResolver.length
      ? sinResolver.join(', ') + ' no llama a quienesDeFilas: con la plantilla ' +
        'repartida imprimiría un solo nombre'
      : CAMINADAS.length + ' funciones, todas por quienesDeFilas');

  /* Y la guarda de la guarda: si el ayudante dejara de mirar el nombre de la
     fila, las cuatro seguirían llamándolo y la de arriba seguiría en verde
     sobre un ayudante que devuelve siempre el de la entrada. Es el patrón de
     la v878 con su propia lista. */
  const cuerpoQ = (src.match(/function quienesDeFilas\([^]*?\n  \}/) || [''])[0];
  const miraFila = /f && f\.quien/.test(cuerpoQ) && /quienEntrada/.test(cuerpoQ);
  comprobar('y quienesDeFilas sigue leyendo el nombre de la fila, no solo el de la entrada',
    miraFila,
    miraFila ? 'lee f.quien y cae en el de la entrada'
             : (cuerpoQ ? 'quienesDeFilas NO lee f.quien: la regla no mordería'
                        : 'NO se encontró quienesDeFilas'));

  /* ── EL BORRADOR DE UNA PUERTA (v954) ──────────────────────────────────
     Las cinco puertas de plantilla toman lo tecleado antes de validar nada,
     para que un rechazo no se lo lleve. Falla CERRADO: una puerta nueva que
     no lo tome pierde datos de campo en silencio, que es el fallo que la v940
     dejó declarado y la v951 volvió a medir. */
  const PREFIJOS = ['act', 'pvl', 'rut', 'and', 'cup'];
  const sinBorrador = PREFIJOS.filter(function (x) {
    return src.indexOf("ponerBorrador('" + x + "', tomarBorrador('" + x + "'))") === -1;
  });
  comprobar('las cinco puertas guardan lo tecleado antes de validar',
    sinBorrador.length === 0,
    sinBorrador.length
      ? sinBorrador.join(', ') + ' no toma el borrador: un rechazo se lleva lo escrito'
      : PREFIJOS.length + ' puertas, todas por tomarBorrador');

  /* Y la guarda de la guarda: si `pintar()` dejara de reponerlo, las cinco
     seguirían tomándolo y la de arriba seguiría en verde sobre un borrador
     que nadie devuelve a la pantalla (v878). */
  const cuerpoPintar = (src.match(/\n  function pintar\(\)[^]*?\n  \}/) || [''])[0];
  const repone = /reponerBorrador\(\)/.test(cuerpoPintar);
  comprobar('y pintar() sigue reponiéndolo en la pantalla',
    repone,
    repone ? 'pintar lo repone al final'
           : (cuerpoPintar ? 'pintar NO llama a reponerBorrador: la regla no mordería'
                           : 'NO se encontró pintar()'));

  /* ── SEGUIR ANOTANDO SOBRE LO GUARDADO (v955) ──────────────────────────
     Las cinco puertas dejan reabrir su formulario con lo guardado dentro. Sin
     esto, para anotar un tramo más hay que QUITAR lo anotado y volver a
     escribirlo todo, que es lo que la v951 midió al chocar con ello. Falla
     cerrado, como la del borrador. */
  const HUECOS_PUERTA = ['HUECO_ACTIVIDAD', 'HUECO_PERFIL', 'HUECO_RUTAS',
                         'HUECO_ANDENES', 'HUECO_CUPO'];
  const sinAmpliar = HUECOS_PUERTA.filter(function (h) {
    return src.indexOf('!ampliandoPuerta(' + h + ')') === -1 ||
           src.indexOf('botonAmpliar(' + h + ',') === -1;
  });
  comprobar('las cinco puertas dejan reabrir el formulario con lo guardado',
    sinAmpliar.length === 0,
    sinAmpliar.length
      ? sinAmpliar.join(', ') + ': para anotar uno más habría que quitarlo todo'
      : HUECOS_PUERTA.length + ' puertas, todas con su botón y su condición');

  /* Y la guarda de la guarda: si el manejador dejara de encender la bandera,
     las cinco seguirían con su botón y su condición, y el botón no haría nada
     (v878). */
  const enciende = /acc === 'campo-ampliar'[^]{0,200}ponerAmpliando\(/.test(src);
  comprobar('y el botón sigue encendiendo la bandera que la condición lee',
    enciende,
    enciende ? 'campo-ampliar llama a ponerAmpliando'
             : 'campo-ampliar NO enciende nada: el botón no haría nada');
}

  comprobar('ningún nombre de window es función en un archivo y lista en otro',
    chocan.length === 0,
    chocan.length
      ? chocan.map(n => 'window.' + n + ' (' +
          donde[n].map(x => x.archivo + ':' + x.linea + ' ' + x.forma).join(' · ') + ')').join(' | ')
      : Object.keys(donde).length + ' nombres revisados');
}

/* ── UN PANEL DE ORIGEN SE DECLARA POR UN NOMBRE QUE NOMBRA UNA COSA (v925)
   ────────────────────────────────────────────────────────────────────────
   Trece títulos del pliego los comparten un MAPA y una CAJA: «Cómo se llega»,
   «Llenos y vacíos», «Verde y agua», «Hitos y nodos»… La v925 hizo que los
   renglones de cesión digan de cuál de los dos hablan, porque el lector no
   tenía cómo saberlo — y eso se arregla en el papel.

   Lo que NO se ve en el papel es esto: `cedioPanel`, que es por donde una
   casilla de síntesis y una entrada de bibliografía declaran de qué panel
   dependen, resuelve el nombre con `slugPliego` del TÍTULO. El slug de una
   caja es el de su título; el identificador de un mapa es otra cosa
   —`llega`, `caminar`, `llenos`—. Así que una declaración que nombrara uno
   de los trece vería SOLO la caja y nunca el mapa, y lo haría en silencio:
   la casilla se quedaría citando un panel que no está, que es exactamente el
   §1 de la v910.

   Hoy las tres declaraciones que existen nombran «Cómo cambió el sitio» y
   «Presión de crecimiento», que no son de los trece. Esta guarda es para que
   la cuarta no nazca mal: si alguien declara uno de los nombres dobles, sale
   en rojo con archivo y línea, y lo que hay que hacer es declarar el
   identificador del mapa o dejar claro que se depende de la caja.

   Los trece NO se escriben acá: se cruzan los dos inventarios del propio
   archivo, así que un par nuevo queda vigilado sin que su autor se acuerde.
   Es la misma forma que la guarda del voseo en -á (v880): se calcula lo que
   se permite y se denuncia lo demás. */
{
  const F = 'js/68-procity-reconocimiento.js';
  const src = leer(F), lineas = src.split('\n');
  const trozo = (desde, hasta) => {
    const i = src.indexOf(desde), j = src.indexOf(hasta, i + 1);
    return (i < 0 || j < 0) ? '' : src.slice(i, j);
  };
  const titulos = t => {
    const out = {};
    (t.match(/\bt: '[^']+'/g) || []).forEach(x => { out[x.slice(4, -1)] = 1; });
    return out;
  };
  const cajas = titulos(trozo('function cajasDelPliego(', 'function mapasDisponibles('));
  const mapas = titulos(trozo('function mapasDisponibles(', '\n  function ',));
  const dobles = Object.keys(mapas).filter(t => cajas[t]);
  /* La guarda de la guarda: sin los dos inventarios leídos, `dobles` sale
     vacío y esta comprobación pasaría en verde sin vigilar una sola palabra.
     Es el patrón de la v878 con su propia lista de voseo. */
  comprobar('los dos inventarios del pliego se leen, y comparten títulos',
    Object.keys(cajas).length > 30 && Object.keys(mapas).length > 10 && dobles.length >= 5,
    Object.keys(cajas).length + ' cajas · ' + Object.keys(mapas).length + ' mapas · ' +
      dobles.length + ' títulos dobles');
  const malos = [];
  lineas.forEach((ln, i) => {
    /* Dónde se declara un panel de origen: el cuarto argumento de `F`/`SM`
       en las casillas, el `panel:` de una huérfana y el de una entrada de
       bibliografía. Los tres llegan a `cedioPanel` como título. */
    const m = ln.match(/panel: '([^']+)'/) ||
              ln.match(/^\s*(?:pres\.desde \? )?\['([^']+)'\]/);
    if (!m) return;
    if (dobles.indexOf(m[1]) >= 0) malos.push(F + ':' + (i + 1) + ' «' + m[1] + '»');
  });
  comprobar('ningún panel de origen se declara con un nombre que nombra dos paneles',
    malos.length === 0,
    malos.length
      ? malos.join(' · ') + ' — `cedioPanel` resuelve por el slug del título, así que ' +
        'solo vería la caja: declare el identificador del mapa o no lo nombre así'
      : dobles.length + ' títulos dobles, ninguno declarado como panel de origen');
}

// ── ninguna lista viva da por faltante lo que ya se mide ────────────────
/* Cinco veces se declaró ausente algo que estaba medido. Cuatro dentro de la
   hoja —la isócrona, el ancho de vía, las rutas, la cifra municipal—, y la
   quinta en CLAUDE.md, que siguió pidiendo «las rutas dibujadas, los
   estratos, la escolaridad y las isócronas por malla vial» varias tandas
   después de que las cuatro existieran. `tdoslaminas` persigue la clase
   dentro de la hoja desde la v864; acá se persigue dentro de la bitácora,
   que es lo que lee la sesión siguiente para decidir qué hacer.

   El intento obvio —buscar frases que nieguen— ya falló cuatro veces: hay
   que acertarle a la redacción, y la redacción cambia. Así que la trampa se
   pone en otro sitio. Cada renglón de una lista que TOQUE un tema del que ya
   se mide algo tiene que llevar su cláusula `ya: …` diciendo qué se mide. Eso
   no depende de adivinar cómo se escribió la negación: la cláusula está o no
   está, y se ve de lejos.

   La PRUEBA de que algo está medido es una marca en el código servido, no una
   creencia: si la marca desaparece porque se quitó la capacidad, la capacidad
   deja de exigir su cláusula y el renglón vuelve a ser legítimo.

   Desde la v868 hay MÁS DE UNA lista —el pliego educativo y Visión
   Territorial—, así que esto recorre todas las que estén marcadas en vez de
   mirar una. Un módulo nuevo con su lista entra agregando su entrada acá, y
   mientras no la agregue no se comprueba: por eso la última comprobación
   exige que no haya en CLAUDE.md un bloque marcado que esta tabla no conozca. */
console.log('\n  -- las listas vivas --');
{
  const md = leer('CLAUDE.md');
  const j61 = soloCodigo(leer('js/61-analisis-ia-datos.js'));
  const j73 = soloCodigo(leer('js/73-solar.js'));
  /* ── LAS MARCAS DE CAPACIDAD MIRAN EL CÓDIGO, NO LOS COMENTARIOS (v926) ──
     Se destapó en el acto y con mis propias manos: al mover la frase del
     método al servidor, la capacidad «el método declarado en cada corrida»
     siguió en verde — porque el COMENTARIO que explicaba la mudanza contiene
     la frase que la prueba busca. Una capacidad demostrada por un párrafo que
     habla de ella no está demostrada: es el verde que este proyecto lleva
     veinte tandas persiguiendo, y la lista viva entera se apoya en estas
     marcas.

     Los archivos se leen sin comentarios. Lo que la prueba busca tiene que
     estar en lo que corre. */
  const j68 = soloCodigo(leer('js/68-procity-reconocimiento.js'));
  const j90 = soloCodigo(leer('js/90-vt-app.js'));

  const LISTAS = [
    { marca: 'PLIEGO', que: 'el pliego educativo', capacidades: [
      { t: 'la isócrona a pie por la malla',   tema: /isócrona|se alcanza a pie/i,
        prueba: () => /caminataDesdeLote/.test(j68) },
      { t: 'las rutas que paran en el sector', tema: /\brutas?\b/i,
        prueba: () => /Las rutas que paran acá/.test(j68) },
      { t: 'la manzana cerrada',               tema: /manzana/i,
        prueba: () => /planoDeManzanas/.test(j68) },
      { t: 'la población del municipio',       tema: /municipio|de la ciudad/i,
        prueba: () => /poblacionMunicipio/.test(j68) },
      { t: 'el estrato del sector',            tema: /estrato/i,
        prueba: () => /estratoManzana/.test(j61) },
      { t: 'lo que el censo trae además',      tema: /escolarid|hogares|alfabet|etnia/i,
        prueba: () => /censoAmpliado/.test(j61) && /censoAmpliado/.test(j68) },
      { t: 'el ancho de vía',                  tema: /ancho de (la )?vía|andén|anden/i,
        prueba: () => /coberturaAncho/.test(j68) },
      { t: 'la pirámide del sector',           tema: /pirámide|edades/i,
        prueba: () => /tramoDominante/.test(j68) },
      /* §3 (v887). El país y el departamento son contorno de verdad, de
         geometría fija. El renglón que queda pide el del MUNICIPIO y el de la
         COMUNA, así que toca el mismo tema y su cláusula `ya:` tiene que
         nombrar lo que sí se dibuja — o la tanda siguiente vuelve a pedir la
         silueta del país, que ya está. */
      { t: 'la silueta del país y del departamento', tema: /silueta|contorno|escala por escala|l[ií]mites administrativos/i,
        prueba: () => /URBIS_SILUETAS_CO/.test(j68) && /areaDeAnilloM2/.test(j68) },
      /* §17 (v888). El renglón que queda pide SECOP y la comuna, así que toca
         el mismo tema que los dos proxies que sí se miden: su cláusula `ya:`
         tiene que nombrarlos o la tanda siguiente vuelve a pedir la huella
         construida, que ya está. */
      { t: 'los proxies de presión de crecimiento', tema: /presi[oó]n de crecimiento|SECOP|obra p[uú]blica|intercensal/i,
        prueba: () => /presionDeCrecimiento/.test(j68) && /duroDesde/.test(j68) },
      /* §12 (v882). Las tres de la banda ambiental. La del sol es la que más
         falta hacía: el módulo tiene TRES estudios de sombra —vecinos,
         volumen permitido y ahora el del sector— y es fácil que una tanda
         escriba que falta el que ya está. */
      { t: 'lo que recibe cada orientación',   tema: /orientaci[oó]n|asoleamiento|carta solar/i,
        prueba: () => /porOrientacion/.test(j73) && /tablaDeOrientacion/.test(j68) },
      { t: 'la radiación medida del sitio',    tema: /radiaci[oó]n|irradiancia/i,
        prueba: () => /shortwave_radiation_sum/.test(j61) && /Radiación medida/.test(j68) },
      { t: 'la sombra de lo construido',       tema: /sombra/i,
        prueba: () => /sombraDeLoConstruido/.test(j68) },
      { t: 'la estrategia de ventilación',     tema: /viento|ventilaci[oó]n/i,
        prueba: () => /estrategiaDeVentilacion/.test(j68) },
      /* §18 (v883). Tres renglones de esta lista —el perfil acotado, la
         frecuencia de las rutas, el aforo— piden justo lo que estas seis
         plantillas van a levantar. La plantilla NO es la medición, así que
         los renglones siguen; pero su cláusula `ya:` tiene que decir que el
         formulario existe, o la sesión siguiente lo escribe otra vez. */
      { t: 'las seis plantillas de campo',     tema: /campo|plantilla|se levanta en campo|conteo en campo/i,
        prueba: () => /PLANTILLAS_DE_CAMPO/.test(j68) && /plantillaCampo/.test(j68) },
      /* §11 (v902). Las tres carencias de la columna de ciudad iban en UN
         renglón —espacio público, densidad de usos y cobertura—; dos ya salen
         de la corrida municipal y la que queda es el espacio público, con su
         razón propia. La marca vigila que la tanda siguiente no las vuelva a
         escribir juntas: cualquier renglón que toque la densidad de usos o la
         cobertura de la ciudad tiene que decir en su `ya:` que están medidas. */
      { t: 'la referencia municipal de OpenStreetMap',
        tema: /espacio p[uú]blico de la ciudad|densidad de usos|cobertura de equipamientos de la ciudad|municipio entero/i,
        prueba: () => /correrCiudadOSM/.test(j68) && /extensionCiudad/.test(j61) }
    ] },
    /* Visión Territorial (v868). Sus cinco carencias se auditaron una por una
       contra el código y salieron honestas — no hay malla vial en el esquema,
       el espacio público se declara «pendiente» dentro del propio resultado,
       no hay exportación PDF y el diálogo de aprobar dice en pantalla que la
       contraseña llega con las cuentas por entidad—. Se marca igual: una lista
       honesta se vuelve vieja la primera vez que alguien implemente algo, y
       ese es el fallo que nadie ve. */
    { marca: 'VT', que: 'Visión Territorial', capacidades: [
      { t: 'el aviso de origen en toda pantalla', tema: /desarrollo|sintétic|demostración/i,
        prueba: () => /S\.avisoDatos/.test(j90) },
      /* La frase del método la escribe el SERVIDOR desde la v926 —estaba tres
         veces a mano acá y ya había divergido—, así que la marca de este lado
         es que la pantalla la lea y la imprima, no que la redacte. */
      { t: 'el método declarado en cada corrida', tema: /isócrona|radio_recto|método/i,
        prueba: () => /metodo_texto/.test(j90) && /function metodoDe/.test(j90) },
      { t: 'la hoja de déficit en PDF, con su marca de agua', tema: /PDF|exporta|marca de agua|imprim/i,
        prueba: () => /hoja\.pdf/.test(j90) && /function bajarHoja/.test(j90) },
      { t: 'las dos prioridades',                 tema: /prioridad/i,
        prueba: () => /prioridad_neutra/.test(j90) },
      { t: 'el motivo obligatorio al descartar',  tema: /descart|motivo/i,
        prueba: () => /vt-motivo/.test(j90) }
    ] }
  ];

  const marcadas = (md.match(/<!-- LISTA-VIVA-([A-Z]+) -->/g) || [])
    .map(x => x.replace(/<!-- LISTA-VIVA-|\s*-->/g, ''));
  comprobar('toda lista marcada en CLAUDE.md tiene su tabla de capacidades acá',
    marcadas.every(m => LISTAS.some(l => l.marca === m)),
    marcadas.length ? marcadas.join(', ') : 'ninguna lista marcada');

  LISTAS.forEach(L => {
    const m = new RegExp('<!-- LISTA-VIVA-' + L.marca + ' -->([\\s\\S]*?)<!-- /LISTA-VIVA-' + L.marca + ' -->').exec(md);
    comprobar('la lista viva de ' + L.que + ' está delimitada', !!m,
      m ? 'entre sus dos marcadores' : 'faltan los marcadores LISTA-VIVA-' + L.marca);
    if (!m) return;
    // Un renglón es una viñeta de primer nivel; lo indentado que le cuelga es
    // suyo, así que se corta por el siguiente «* » a comienzo de línea.
    const renglones = m[1].split(/\n(?=\* )/).map(x => x.trim()).filter(Boolean);
    const medidas = L.capacidades.filter(c => c.prueba());
    const sinYa = [];
    medidas.forEach(c => renglones.forEach((r, i) => {
      if (c.tema.test(r) && !/`ya:/.test(r)) {
        sinYa.push('renglón ' + (i + 1) + ' toca ' + c.t + ' sin decir qué ya se mide');
      }
    }));
    comprobar('en ' + L.que + ', ningún renglón toca algo ya medido sin su cláusula «ya:»',
      sinYa.length === 0,
      sinYa.length ? sinYa.join(' | ')
                   : renglones.length + ' renglones contra ' + medidas.length + ' capacidades medidas');
    /* Y la cláusula no puede ser un adorno vacío: si dice `ya:` tiene que
       decir algo. Un `ya:` en blanco pasaría la comprobación de arriba
       dejando el renglón tan mentiroso como estaba. */
    const vacias = renglones
      .map((r, i) => ({ i: i + 1, ya: (r.match(/`ya:([^`]*)`/) || [])[1] }))
      .filter(x => x.ya !== undefined && x.ya.trim().length < 20);
    comprobar('en ' + L.que + ', ninguna cláusula «ya:» está vacía o es de relleno',
      vacias.length === 0,
      vacias.length ? vacias.map(x => 'renglón ' + x.i).join(', ')
                    : renglones.filter(r => /`ya:/.test(r)).length + ' cláusulas con contenido');
    /* Las marcas del código que sostienen todo esto: si alguna se renombra,
       la capacidad se daría por no medida en silencio y la lista podría
       volver a pedirla. Que se note acá y no dentro de dos tandas. */
    const perdidas = L.capacidades.filter(c => !c.prueba()).map(c => c.t);
    comprobar('las marcas de capacidad de ' + L.que + ' siguen en el código servido',
      perdidas.length === 0,
      perdidas.length ? 'sin marca: ' + perdidas.join(', ')
                      : L.capacidades.length + ' capacidades con su marca');
  });
}

console.log('\n  ' + (fallos ? fallos + ' comprobaciones fallaron' : 'todas las comprobaciones pasaron') + '\n');
process.exit(fallos ? 1 : 0);
