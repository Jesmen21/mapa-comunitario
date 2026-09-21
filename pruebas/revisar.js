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
let sinMaterial = 0;
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

/* UNA COMPROBACION SIN MATERIAL NO SE CALLA Y NO SE PONE ROJA (v970).
   Es la quinta vez que este proyecto toma la misma decision y la primera
   dentro de este arnes: el arnes de suites la tomo en la v963 con su `?` NO
   CONCLUYENTE, y la ficha en la v964, la v965 y la v966.

   Lo que la hace distinta del `?` de `correr.js` es que ALLA hace fallar la
   corrida y aca NO, y el motivo hay que dejarlo escrito porque es la
   tentacion: una suite que no imprime nada es un defecto, siempre. Una
   guarda de MATERIAL se queda sin material cuando el registro MEJORA, y si
   eso pusiera la corrida en rojo, la salida barata seria dejar el registro
   torcido para que la guarda siga teniendo algo que rechazar. Es
   exactamente la presion que la v970 vino a quitar de la guarda de rol.

   Lo que si hace falta es que se VEA: sale con su `?`, con su nombre, con
   la razon, y el recuento del final la cuenta aparte de las que fallaron
   porque piden cosas distintas. */
function anotarSinMaterial(nombre, detalle) {
  console.log('  ? ' + nombre + '  \u2014 SIN MATERIAL HOY: ' + detalle);
  sinMaterial++;
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
    /* Lo que hay que vigilar NO es «js css index.html»: es TODO lo que el
       service worker precachea, porque eso es exactamente lo que un teléfono
       se queda sirviendo de su copia vieja mientras el token no suba.

       Salió midiendo en la v1003, al documentar las diecinueve entradas del
       registro presidencial: `assets/data/seguimiento-presidencial.json` está
       precacheado desde que existe y NO estaba en esta lista, así que un
       cambio de registro sin salto de versión pasaba en verde y un teléfono
       con la aplicación instalada seguía leyendo el registro anterior. La
       otra sesión sube la versión cuando escribe ahí —esa práctica es la
       correcta—, pero nada lo comprobaba.

       La lista se LEE del service worker y no se escribe acá: un archivo
       nuevo precacheado queda vigilado sin que su autor se acuerde, que es la
       regla del aviso de origen (v867). Y las carpetas se deducen de las
       rutas para que `git status` no reciba ciento setenta y cinco
       argumentos; la raíz se vigila entera con los archivos sueltos. */
    const pre = [...leer('service-worker.js').matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
    const carpetas = new Set();
    pre.forEach((ruta) => {
      const i = ruta.lastIndexOf('/');
      carpetas.add(i < 0 ? ruta : ruta.slice(0, i));
    });
    const vigiladas = [...carpetas].filter(Boolean).sort();
    const sucio = enGit('git status --porcelain -- ' + vigiladas.map((x) => JSON.stringify(x)).join(' '));
    if (sucio) {
      const anterior = (enGit('git show HEAD:index.html').match(/URBIS_APP_VERSION\s*=\s*'([\w-]+)'/) || [])[1];
      comprobar('la versión sube cuando cambia el código',
        !anterior || anterior !== decl,
        anterior === decl ? 'sigue en ' + decl + ' y hay cambios sin subir en ' +
                              sucio.split('\n').length + ' archivo(s) que el service worker precachea'
                          : (anterior || '(sin anterior)') + ' → ' + decl +
                              ', con ' + vigiladas.length + ' carpetas precacheadas vigiladas');
    }
    /* La guarda de la guarda: si lo vigilado volviera a escribirse a mano,
       todo lo de arriba seguiría en verde sin mirar el registro —que es
       justo el hueco que la v1003 encontró—. Se exige que la lista salga del
       service worker y que traiga las dos carpetas que se pueden cambiar sin
       tocar una línea de código: los datos y las hojas de estilo. */
    /* Se mide DENTRO del trozo que arma `vigiladas` y no sobre el archivo
       entero (v854): `leer('service-worker.js')` sale en once sitios más de
       esta misma comprobación, así que buscarlo suelto da por buena una
       derivación que ya no existe — pasó al demostrar esta guarda en rojo. */
    const yo = leer('pruebas/revisar.js');
    const iV = yo.indexOf('const vigiladas = [...carpetas]');
    const trozo = iV > 0 ? yo.slice(Math.max(0, iV - 700), iV) : '';
    const leeDelSw = /const pre = \[\.\.\.leer\('service-worker\.js'\)/.test(trozo) &&
                     /carpetas[\s\S]{0,200}pre\.forEach/.test(trozo);
    const cubre = ['assets/data', 'css'].filter((x) => vigiladas.indexOf(x) < 0);
    comprobar('y lo que vigila sale del service worker, no de una lista escrita a mano',
      leeDelSw && cubre.length === 0,
      !leeDelSw ? 'la lista volvió a estar escrita a mano: un archivo precacheado nuevo quedaría sin vigilar'
        : (cubre.length ? 'no vigila: ' + cubre.join(' · ') + ' — se podrían cambiar sin subir la versión'
          : 'sale de las ' + vigiladas.length + ' carpetas que el service worker precachea'));
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
     antes de que llegue al teléfono de nadie.

     BARRIDO DE TRINQUETES (v965), para que no haya que volver a medirlo.
     El del contrargumento tenía un techo ABSOLUTO sobre una cantidad que
     crece con el registro, así que la primera entrada nueva lo rompía sin
     que nadie hubiera dejado de revisar nada; pasó a medir lo revisado.
     Barridos los demás, en este proyecto hay DOS y este es el otro — y este
     NO tiene el defecto, medido y no supuesto:

       · los 19 en blanco son todos del 4 al 17 de agosto, la apertura del
         registro;
       · de las 25 entradas más recientes, CERO están sin tipo.

     O sea que lo pendiente acá no crece con el registro: crece solo si
     alguien añade una entrada sin decidir de qué fuente es, que es
     exactamente lo prohibido. El discriminador no es «¿mide un pendiente?»
     sino **¿puede ese pendiente crecer sin que nadie haga nada mal?**. Si
     puede, el techo absoluto está mal y hay que medir lo hecho; si no puede,
     el techo es lo correcto y cambiarlo a un piso lo DEBILITARÍA —una
     entrada nueva sin tipo dejaría de saltar—. */
  /* Bajó a CERO en la v1003, con las diecinueve del 4 al 17 de agosto
     documentadas. Un techo en cero es el que de verdad falla cerrado: la
     primera entrada que llegue sin naturaleza declarada salta en el acto,
     en vez de esconderse dentro de un cupo que nadie vuelve a mirar. */
  const TECHO_SIN_TIPO = 0;
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

  /* ── dos reglas que el registro se escribió a sí mismo y nadie medía (v1003) ──
     Las dos están en su `_comentario` desde que existe: «Cada entrada DEBE
     tener fuente verificable» y «si un dato es disputado, se incluye la
     crítica en contrapunto». Medidas al documentar las diecinueve del 4 al 17
     de agosto: las dos se cumplen en los DOS registros, cero violaciones. Así
     que entran como guardas que fallan CERRADO y arrancan limpias, no como
     trinquetes sobre una deuda: lo que impiden es que la primera entrada que
     las rompa pase sin que nadie se entere.

     Y van en los dos registros por el principio 1 del pliego: toda regla que
     se aplica a un gobierno se aplica a todos, y aflojarla en uno sería la
     manera silenciosa de inclinar la comparación. */
  {
    const sinFuente = [];
    const disSinCp = [];
    let nEnt = 0, nDis = 0;
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        nEnt++;
        if (!((e.fuentes || []).length)) sinFuente.push(quien + '/' + (e.fecha || '?'));
        if (String(e.tipoFuente || '') === 'disputado') {
          nDis++;
          if (!String(e.contrapunto || '').trim()) disSinCp.push(quien + '/' + (e.fecha || '?'));
        }
      });
    });

    /* MATERIAL primero (v920): sin entradas y sin disputadas, las dos de
       abajo pasarían por no tener nada delante. */
    if (!nEnt || !nDis) {
      anotarSinMaterial('MATERIAL · los dos registros traen entradas, y alguna disputada',
        nEnt + ' entradas · ' + nDis + ' disputadas');
    } else {
      comprobar('MATERIAL · los dos registros traen entradas, y alguna disputada',
        true, nEnt + ' entradas · ' + nDis + ' disputadas, que es contra lo que muerde la de abajo');

      comprobar('ninguna entrada se publica sin una sola fuente que la sostenga',
        sinFuente.length === 0,
        sinFuente.length === 0
          ? 'las ' + nEnt + ' traen al menos una'
          : sinFuente.length + ' sin ninguna fuente: ' + sinFuente.slice(0, 4).join(' · ') +
            ' — un hecho sobre una persona real sin con qué comprobarlo');

      comprobar('y toda entrada DISPUTADA lleva escrita la crítica, que es lo que la hace disputada',
        disSinCp.length === 0,
        disSinCp.length === 0
          ? 'las ' + nDis + ' dicen en su contrapunto cuáles son las versiones enfrentadas'
          : disSinCp.length + ' disputadas sin contrapunto: ' + disSinCp.slice(0, 4).join(' · ') +
            ' — se marca el conflicto y no se dice cuál es, que es peor que no marcarlo');
    }
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
    /* Sube a 1 con la v967: la entrada del recorte al deporte trae la
       justificación de la ministra, que es el primer contrargumento oficial
       revisado del registro. El trinquete existe para que no se pueda
       des-declarar. */
    const PISO_REVISADOS = 1;
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

    /* ── EL TECHO `palabra` NO PUBLICA PELDAÑO SIN SUS INSUMOS ───────────
       La tensión que la v959 dejó a nombre del usuario: el techo contaba
       TODAS las contradicciones documentadas y el eje A solo las que además
       tienen identidad de objeto verificada. La ficha publicaba «Poco
       fiable» sobre un presidente en ejercicio con esa identidad sin
       declarar.

       Esto NO es la Capa 3 escribiendo en el veredicto: `conIdentidad` no es
       una cantidad del eje A, es el mismo registro de contradicciones que el
       techo `palabra` siempre contó, leído por un solo sitio para que las dos
       lecturas no puedan separarse otra vez (v879). */
    const tramoV2 = tramoVeredicto;
    const c70niv = leer('css/70-seguimiento.css');
    comprobar('el techo de cambios de postura se lee del eje A, no de una cuenta propia',
      /var ea = ejeA\(dd\);/.test(j70c1) &&
      /TECHOS\.palabra\.f\(ea\.conIdentidad\)/.test(j70c1) &&
      /TECHOS\.palabra\.f\(ea\.conIdentidad \+ ea\.sinDeclarar\)/.test(j70c1),
      'palMin y palMax salen de ejeA(dd): una sola cuenta para las dos lecturas');

    comprobar('la ficha NO publica peldaño mientras el techo sea un intervalo',
      tramoV2.length > 0 &&
      /var determinado = peorMin === peorMax;/.test(tramoV2) &&
      /\} else if \(!determinado\) \{/.test(tramoV2) &&
      /id: 'sin-nivel'/.test(tramoV2),
      !tramoV2.length ? 'no se encontró el tramo del veredicto: la comprobación no vale'
        : 'con peorMin ≠ peorMax el veredicto es «Sin nivel» y dice entre qué dos peldaños queda');

    /* La guarda de la guarda: si `ejeA` dejara de devolver las dos cuentas,
       todo lo de arriba seguiría en verde sobre `undefined` —y `TECHOS.palabra.f`
       de `undefined` devuelve 0 en las dos cotas, o sea un techo determinado
       en el peldaño de arriba: el peor verde posible—. */
    comprobar('y `ejeA` sigue devolviendo las dos cuentas que el techo necesita',
      /conIdentidad: conId/.test(j70c1) && /sinDeclarar: sinDeclarar/.test(j70c1),
      'ejeA publica conIdentidad y sinDeclarar');

    /* La línea de la placa sigue la misma decisión, que es la regla de la
       v941: «N cambios de postura» al lado de «Sin nivel» se lee como un
       error de la ficha y no como una regla. */
    comprobar('la línea de cuentas dice cuántos no se pueden usar todavía',
      /sin identidad de objeto declarada/.test(j70c1),
      'cuentasDe nombra los que están sin declarar');

    /* Y que el peldaño nuevo esté pintado: una clase que ninguna regla pinta
       es HTML válido y no lo dice nadie (v895). Va en GRIS y no en rojo —una
       lectura pendiente nuestra no es un hallazgo sobre el gobierno—. */
    comprobar('el peldaño «Sin nivel» tiene su regla en la hoja de estilo, y en gris',
      /\.sp-fi-v-sin-nivel\{[^}]*--vc-claro:var\(--ink-2\)/.test(c70niv) &&
      /\.sp-fi-vfalta\{/.test(c70niv) && /\.sp-fi-falta\{/.test(c70niv),
      'sp-fi-v-sin-nivel, sp-fi-vfalta y sp-fi-falta pintadas');

    /* ── v977 · CUÁLES bloquean el veredicto, no solo cuántas ───────────
       El módulo sabía exactamente qué contradicciones dejan la fiabilidad sin
       publicar —las cuenta para decir «faltan N de M»— y NINGUNA pantalla
       decía cuáles son: la clase C, un dato presente que no alcanza a ningún
       lector. Desde afuera, «declare mismoObjetoVerificado» sin la lista es
       una instrucción que no se puede seguir.

       Las dos mitades hacen falta y miden cosas distintas: la ficha las
       NOMBRA todas juntas, y la lista de contradicciones marca cada caso
       donde el lector lo está mirando. Con solo la primera, quien entra por
       la lista no ve nada; con solo la segunda, hay que recorrer ocho casos
       para saber cuáles son los cuatro. */
    const cuerpoEjeA = (j70c1.match(/function ejeA\(dd\) \{[\s\S]*?\n  \}/) || [''])[0];
    const cuerpoCx = (j70c1.match(/function pintarContradicciones\(\) \{[\s\S]*?\n  \}/) || [''])[0];
    comprobar('MATERIAL · se leen ejeA y la lista de contradicciones',
      cuerpoEjeA.length > 0 && cuerpoCx.length > 0,
      'ejeA ' + cuerpoEjeA.length + ' car. · pintarContradicciones ' + cuerpoCx.length + ' car.');

    comprobar('la ficha NOMBRA las contradicciones que bloquean el veredicto, no solo las cuenta',
      /pendientes: pendientes/.test(cuerpoEjeA) &&
      /f\.ejeA\.pendientes/.test(j70c1) && /sp-fi-pend/.test(j70c1) && /\.sp-fi-pend\{/.test(c70niv),
      !/pendientes: pendientes/.test(cuerpoEjeA)
        ? 'ejeA no devuelve la lista de las que faltan'
        : !/f\.ejeA\.pendientes/.test(j70c1) || !/sp-fi-pend/.test(j70c1)
          ? 'ejeA las tiene y la ficha no las imprime: las cuenta y no dice cuáles'
          : !/\.sp-fi-pend\{/.test(c70niv)
            ? 'la lista se imprime y ninguna regla la pinta (v895)'
            : 'ejeA devuelve `pendientes` y la ficha las imprime una por una');

    comprobar('y cada contradicción documentada dice su identidad de objeto donde se lee',
      /identidadDe\(x\)/.test(cuerpoCx) && /sp-cx-ident/.test(cuerpoCx) &&
      /\.sp-cx-ident\{/.test(c70niv) && /\.sp-cx-ident-falta\{/.test(c70niv),
      !/identidadDe\(x\)/.test(cuerpoCx)
        ? 'la lista de contradicciones no lee la identidad: vuelve a ser un dato que no alcanza a nadie'
        : 'la lista marca cada caso, con su regla en la hoja de estilo');

    /* La guarda de la guarda: la cuenta y la pantalla tienen que leer la
       identidad por la MISMA función y filtrar por el MISMO predicado. Con
       dos lecturas volverían a separarse a la tanda siguiente (v879) —y la
       que se quedaría vieja sería la de la pantalla, porque la cuenta la
       mira una prueba y la lista no la miraba nadie—. */
    comprobar('y las dos leen la identidad por la misma función y el mismo filtro',
      /function identidadDe\(c\)/.test(j70c1) && /function cuentaEnEjeA\(c\)/.test(j70c1) &&
      /if \(!cuentaEnEjeA\(c\)\) return IDENT\.fuera;/.test(j70c1) &&
      /casosDeCx\(dd\)\.filter\(cuentaEnEjeA\)/.test(cuerpoEjeA) &&
      /identidadDe\(c\)/.test(cuerpoEjeA),
      'identidadDe y cuentaEnEjeA, leídas por ejeA y por la lista');

    /* ── v977 · lo que no se dibuja se pliega, PERO se cuenta a la vista ───
       Plegar un vacío está bien mientras el recuento se lea sin abrir nada: si
       tres gráficos desaparecen y nada lo dice, la exención se lee igual que
       un aprobado, que es lo que este proyecto lleva siete tandas evitando.
       Y el recuento se CALCULA de la lista, nunca tecleado (v903). */
    const cuerpoBg = (j70c1.match(/function bloqueDeGraficos\(cont\) \{[\s\S]*?\n  \}/) || [''])[0];
    const cuerpoPl = (j70c1.match(/function pliegueSinDato\(lista\) \{[\s\S]*?\n  \}/) || [''])[0];
    const sueltos = (cuerpoBg.match(/poner\(grafSinDato\(/g) || []).length;
    const recogidos = (cuerpoBg.match(/guardar\(grafSinDato\(/g) || []).length;

    comprobar('MATERIAL · hay gráficos que el registro no puede dibujar',
      recogidos + sueltos >= 2,
      (recogidos + sueltos) + ' llamadas a grafSinDato · ' + recogidos + ' recogidas · ' + sueltos + ' sueltas');

    comprobar('todo gráfico sin dato entra al pliegue, y ninguno queda suelto entre los que sí se dibujan',
      cuerpoBg.length > 0 && sueltos === 0 && recogidos >= 2 &&
      /poner\(pliegueSinDato\(sinDato\)\)/.test(cuerpoBg),
      sueltos ? sueltos + ' quedaron sueltos con poner(): dos maneras para una sola cosa (v940, v951)'
        : !/poner\(pliegueSinDato\(sinDato\)\)/.test(cuerpoBg)
          ? 'se recogen en `sinDato` y el pliegue no se pone: salen sueltos igual, o no salen'
          : 'las ' + recogidos + ' entran por guardar() y salen por el pliegue');

    comprobar('y el pliegue dice CUÁNTOS son sin abrirlo, contando su propia lista',
      cuerpoPl.length > 0 && /lista\.length/.test(cuerpoPl) &&
      /el\('summary'/.test(cuerpoPl) && /if \(!lista\.length\) return null;/.test(cuerpoPl) &&
      /\.sp-graf-falta-t\{/.test(c70niv),
      !cuerpoPl.length ? 'no se encontró pliegueSinDato: la comprobación no vale'
        : 'el resumen cuenta lista.length, y con cero no hay pliegue');
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

  /* ═══ LA PUERTA DE PUBLICACIÓN (v971) ══════════════════════════════════
     El registro guarda MÁS de lo que la pantalla publica, y esa diferencia
     es lo que puede costar una demanda si se invierte: un señalamiento que
     sale como hallazgo sin estar verificado, o un acto municipal contado
     dentro del score de un presidente.

     Las tres mitades, porque cada una falla por su lado:
       1 · la puerta EXISTE y devuelve su motivo, no un booleano (v876);
       2 · el registro no trae ninguna de las cuatro cifras a las que
           NOSOTROS le encontramos el defecto sin su marca `noPublicar`;
       3 · y la guarda de la guarda: que el tablero la SIGA llamando. Sin
           ella las dos de arriba quedarían en verde sobre una función que
           nadie usa, que es el patrón de la v878 con su propia lista. */
  {
    const j70p = soloCodigo(leer('js/70-seguimiento.js'));
    const reg = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));

    comprobar('la puerta de publicación devuelve su motivo, no un booleano',
      /function sePublica\(e\)/.test(j70p) &&
      /'defecto-propio'/.test(j70p) && /'otro-nivel'/.test(j70p) &&
      /'en-circulacion'/.test(j70p) && /'no-verificado'/.test(j70p) &&
      /'sin-fecha'/.test(j70p) &&
      /return \{ publica: false, motivo: m, texto: t \}/.test(j70p),
      'sePublica devuelve { publica, motivo, texto } con los cinco motivos');

    /* El filtro de nivel vive en `hechosDelMandato`, que es la ÚNICA puerta
       por la que los hechos entran al score. Si se escribiera en cada
       indicador serían siete sitios donde se puede olvidar uno (v867). */
    const tramoMandato = (j70p.match(/function hechosDelMandato\([\s\S]*?\n  \}/) || [''])[0];
    comprobar('el nivel de gobierno se filtra en la única puerta del score',
      /nivelGobierno && e\.nivelGobierno !== 'nacional'/.test(tramoMandato) &&
      /e\.noPublicar/.test(tramoMandato),
      tramoMandato ? 'hechosDelMandato deja fuera lo que no es nacional y lo marcado con defecto propio'
                   : 'no se encontró hechosDelMandato');

    /* Las cuatro cifras con defecto propio. Hoy ninguna está en el registro
       —se revisaron y no se entraron—, así que esto es PROSPECTIVO: existe
       para que la rutina diaria, que escribe acá sin leer la bitácora, no
       las entre mañana como hallazgos. Es la misma forma que la puerta de
       nivel de la v941. */
    const vet = ((reg.publicacion || {}).vetadasPorDefectoPropio || {}).lista || [];
    /* La pista se busca con el BORDE de la cifra delante, no como subcadena.
       En su primera corrida esta guarda denunció «Piden investigar un
       contrato directo de la UNP por $24.800 millones», que contiene
       «800 millones» y no tiene nada que ver: es la clase de la v895 —una
       guarda con falsos positivos termina siendo una lista de excepciones
       que envejece hasta no significar nada—, y se arregla en la forma y no
       con un renglón de exención. El borde es el mismo `(?<![\d.,])` que la
       guarda de concordancia de la v874 usa por la misma razón. */
    const bordeDePista = (p) => new RegExp(
      '(?<![\\d.,])' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const coladas = [];
    (reg.entradas || []).forEach((e) => {
      const txt = [e.titulo, e.detalle].join(' ');
      vet.forEach((v) => {
        if (v.pista && bordeDePista(v.pista).test(txt) && !e.noPublicar) {
          coladas.push((e.fecha || '?') + ' «' + v.pista + '»');
        }
      });
    });
    comprobar('ninguna de las cifras con defecto propio entra al registro sin su marca',
      vet.length >= 4 && coladas.length === 0,
      !vet.length ? 'la lista de vetadas está vacía: la guarda no vigila nada'
                  : coladas.length ? 'entró sin `noPublicar`: ' + coladas.join(' · ')
                                   : vet.length + ' pistas vigiladas, ninguna colada');

    comprobar('y el tablero sigue pasando las entradas por la puerta',
      /sePublica\(/.test(j70p) && /entradasPublicables/.test(j70p) &&
      /censoDePublicacion/.test(j70p) && /censoPublicacion/.test(j70p),
      'pintarTablero y la ficha leen sePublica y publican su recuento');

    /* El canal de rectificación: no es cosmético, es lo que cierra la
       mayoría de estos casos antes de llegar a juez. Y el registro de qué
       se corrigió y cuándo tiene que poder crecer: una lista que no existe
       no se puede llenar. */
    comprobar('el canal de rectificación existe, con su plazo y su registro',
      !!(reg.rectificaciones && reg.rectificaciones.correo &&
         reg.rectificaciones.plazoDias && Array.isArray(reg.rectificaciones.lista)) &&
      /bloqueRectificacion/.test(j70p),
      reg.rectificaciones ? 'correo, plazo de ' + reg.rectificaciones.plazoDias +
                            ' días y lista de ' + reg.rectificaciones.lista.length + ' correcciones'
                          : 'no hay bloque de rectificaciones');
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

    /* LA MARCA VA EN LOS CUATRO CRITERIOS, NO SOLO EN I-13 (v965). La v964
       razonó que ponerla en los siete la dejaría sin significar nada, y el
       razonamiento estaba mal por el otro lado: los criterios de I-04, I-05
       e I-07 también se escribieron leyendo este registro, así que tampoco
       están contrastados, y marcar solo a I-13 sugiere que los otros sí.

       Lo que salva la marca de morir por repetida no es ponérsela a uno: es
       que las dos no digan lo mismo. La gravedad va en `origenCategoria`. */
    const bloqueInd = (j70v.match(/var INDICADORES = \{[\s\S]*?\n  \};/) || [''])[0];
    const conCrit = (bloqueInd.match(/'(I-\d\d)': \{[^\n]*origenCategoria: '([\w-]+)'/g) || []);
    const todos = (bloqueInd.match(/'(I-\d\d)': \{/g) || []).length;
    const cats = (j70v.match(/var ORIGEN_CATEGORIA = \{[\s\S]*?\n  \};/) || [''])[0];
    const valores = (cats.match(/'([a-z-]+)': \{\n/g) || []).map((x) => x.replace(/[':{\n ]/g, ''));
    const usados = conCrit.map((x) => (x.match(/origenCategoria: '([\w-]+)'/) || [])[1]);

    comprobar('MATERIAL · hay dos categorías de origen y los indicadores con criterio las declaran',
      valores.length === 2 && conCrit.length >= 4 && todos >= 5,
      conCrit.length + ' de ' + todos + ' declaran · valores: ' + valores.join(' | '));

    comprobar('ninguna declara una categoría de origen que la tabla no tenga',
      usados.every((u) => valores.indexOf(u) >= 0),
      usados.filter((u) => valores.indexOf(u) < 0).join(', ') || usados.join(' · '));

    /* Y las dos se usan de verdad. Si todas cayeran en la misma, la
       distinción de gravedad sería decorativa y la marca volvería a decir lo
       mismo en los cuatro sitios. */
    comprobar('y las dos categorías se usan: la marca no dice lo mismo en los cuatro',
      valores.every((v) => usados.indexOf(v) >= 0),
      valores.map((v) => v + ': ' + usados.filter((u) => u === v).length).join(' · '));

    comprobar('un criterio sin `origenCategoria` declarada se toma por la GRAVE',
      /var cat = ind\.origenCategoria \|\| 'construida-para-el-caso';/.test(j70v),
      'el que se olvide nace marcado como construido para su caso: se falla cerrado');

    comprobar('la marca es de los indicadores que tienen CRITERIO, no de los siete',
      /if \(!CRITERIOS\[id\]\) return null;/.test(j70v),
      'los tres sin criterio salen directos de la Capa 1: no hay bordes que contrastar');

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

  /* ═══ UNA FUENTE DE EFECTO NO PRUEBA EL ACTO (v965) ═════════════════════
     La entrada de la Directiva Presidencial 01 tiene cuatro fuentes y solo
     UNA publica su texto; las otras tres son posteriores y documentan lo que
     produjo —la cancelación de las ruedas de prensa del Dane, el
     pronunciamiento de la FLIP del 9 de septiembre, la objeción de los
     exdirectores—. Sin decirlo, una cobertura de reacciones se lee como
     prueba de que el acto se expidió.

     ALCANCE, dicho y no disimulado: el rol está declarado donde importa y la
     guarda muerde donde está declarado. La v967 migró las veinte entradas con
     la forma antigua `fuente` + `url`, así que ya no hay ninguna que no PUEDA
     llevarlo; lo que queda son las que nadie ha mirado todavía, y esas salen
     `sin-declarar` en la cobertura que la ficha publica (v966) y son el primer
     renglón de la lista de prioridades. */
  {
    /* El vocabulario se LEE de js/70 y no se copia acá: con dos listas, la
       guarda acabaría comprobando que es igual a sí misma, y la que se
       quedaría vieja sería esta (v957). */
    const ROLES_FUENTE = (() => {
      const j70r = soloCodigo(leer('js/70-seguimiento.js'));
      const i = j70r.indexOf('var ROLES_DE_FUENTE = {');
      if (i < 0) return [];
      const c = j70r.slice(i, j70r.indexOf('\n  };', i));
      return [...c.matchAll(/^\s*'([a-z-]+)':/gm)].map((m) => m[1]);
    })();
    const malRol = [], soloEfecto = [];
    let conRol = 0;
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        const fs = e.fuentes || [];
        const roles = fs.map((f) => String(f.rol || '').trim()).filter(Boolean);
        if (!roles.length) return;
        conRol++;
        const donde = quien + '/' + (e.fecha || '?');
        roles.forEach((r) => { if (ROLES_FUENTE.indexOf(r) < 0) malRol.push(donde + ' rol «' + r + '»'); });
        if (roles.indexOf('acto') < 0) soloEfecto.push(donde);
      });
    });

    comprobar('MATERIAL · hay entradas que declaran el rol de sus fuentes',
      conRol > 0, conRol + ' entradas con rol declarado en sus fuentes');

    comprobar('MATERIAL · el vocabulario del rol se lee de js/70',
      ROLES_FUENTE.length >= 2,
      ROLES_FUENTE.length ? ROLES_FUENTE.join(' | ') : 'no se pudo leer: la lista de abajo no vigilaría nada');

    comprobar('ningún rol de fuente sale de la lista conocida',
      malRol.length === 0 && ROLES_FUENTE.length >= 2,
      malRol.length
        ? malRol.length + ' fuera de la lista, las primeras: ' + malRol.slice(0, 4).join(' · ')
        : ROLES_FUENTE.join(' | '));

    /* UNA ENTRADA DECLARA TODAS SUS FUENTES O NINGUNA (v998).
       `rolDeFuentes` da por comprobada la entrada en cuanto UNA de sus fuentes
       dice `acto`, así que una declarada a medias se lee como revisada entera
       mientras el resto de sus fuentes sigue sin mirar. Es la exención
       silenciosa de la v966 entrando por la puerta de al lado, y la había:
       la entrada del Decreto 1136 tenía una de cinco, que es justamente la
       fuente que la v967 rescató del campo viejo.

       Falla CERRADO (v880): declarar la primera fuente de una entrada obliga a
       declarar las demás, en vez de dejar cuatro sin mirar tres tandas. */
    const aMedias = [];
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        const fs = e.fuentes || [];
        if (!fs.length) return;
        const con = fs.filter((f) => String(f.rol || '').trim()).length;
        if (con > 0 && con < fs.length) {
          aMedias.push(quien + '/' + (e.fecha || '?') + ' (' + con + ' de ' + fs.length + ')');
        }
      });
    });
    comprobar('una entrada declara el rol de TODAS sus fuentes o de ninguna',
      aMedias.length === 0,
      aMedias.length === 0
        ? 'ninguna a medias: las que declaran, declaran enteras'
        : 'a medias: ' + aMedias.join(' · ') +
          ' — se leen como comprobadas con la mitad de sus fuentes sin mirar');

    /* Y LA INSTRUCCIÓN QUE LA RUTINA DIARIA LEE TIENE QUE NOMBRARLO.
       Acá estaba la causa de que 185 entradas nacieran sin rol: el campo
       existía, la guarda existía, y la nota del propio registro —que es lo
       único que lee quien escribe una entrada— no lo mencionaba. Es la
       lección de la v903 §8 y la v933: la instrucción dice lo que la guarda
       exige, o el material nace incumpliéndola. */
    const sinNota = REGISTROS.filter((ruta) => {
      const c = String(JSON.parse(leer(ruta))._comentario || '');
      return !ROLES_FUENTE.every((r) => c.indexOf('`' + r + '`') >= 0);
    });
    comprobar('y la nota del registro nombra el rol y sus valores',
      sinNota.length === 0 && ROLES_FUENTE.length >= 2,
      ROLES_FUENTE.length < 2
        ? 'sin vocabulario que exigir: la nota no se está comprobando contra nada'
        : sinNota.length === 0
          ? 'los ' + REGISTROS.length + ' registros explican los ' + ROLES_FUENTE.length + ' valores a quien escribe'
          : 'sin explicarlo: ' + sinNota.join(' · ') +
            ' — una entrada nueva nace sin rol y nadie se entera');

    /* `sin-acto` SE CUENTA Y SE NOMBRA, NO PONE ESTO EN ROJO (v970).
       La v965 lo escribió como fallo y eso empujaba a la salida peor: una
       entrada cuya única fuente documenta la reacción y no el acto se
       quedaba en `sin-declarar` para no poner la corrida en rojo — y eso
       MIENTE, porque dice «nadie escribió el rol» donde lo cierto es
       «ninguna fuente documenta el acto». Una exención disfrazada de dato
       ausente es peor que el rojo.

       Es el principio de arriba —si una comprobación no puede correr, lo
       dice y se cuenta— y además es lo que `js/70` ya hacía: `coberturaDeRol`
       suma `sin-acto` dentro de `corrio`, porque la comprobación CORRIÓ y su
       resultado fue que no hay fuente del acto. Los dos coinciden ahora.

       Lo que sigue siendo un fallo es un rol que la ficha no sabe leer: ahí
       no hay estado que contar, hay un valor inventado.

       Y un trinquete que NO se pone, con su razón, para que la sesión que lo
       piense no lo descubra midiendo: al cerrar la v1004 `sin-acto` quedó en
       CERO sobre las 212 entradas de los dos registros, y la tentación
       inmediata es fijarlo ahí. No se hace. El discriminador de la v965 es
       «¿puede ese pendiente crecer sin que nadie haga nada mal?», y acá la
       respuesta es SÍ: una entrada nueva cuya única fuente documenta la
       reacción y no el acto es un HALLAZGO legítimo —la v970 lo dejó escrito y
       cambió la guarda justamente para que no fuera un rojo—, y un techo en
       cero volvería a poner la salida barata en mentir sobre el rol. Lo que
       vigila esto es el recuento que llega a la pantalla, no un cupo. */
    comprobar('los roles declarados se cuentan, y «sin acto» es un estado y no un fallo',
      true,
      soloEfecto.length
        ? soloEfecto.length + ' con todas sus fuentes de efecto, contadas y nombradas en la ficha: ' +
          soloEfecto.join(' · ')
        : 'hoy ninguna entrada declara roles y se queda sin fuente del acto');

    /* LA GUARDA DE LA GUARDA. Contar acá no sirve de nada si el módulo deja
       de calcular el estado: las dos líneas de arriba seguirían en verde
       sobre un estado que ya no existe. Se exige que `rolDeFuentes` lo
       devuelva y que `coberturaDeRol` lo sume dentro de lo que SÍ corrió. */
    const j70rol = soloCodigo(leer('js/70-seguimiento.js'));
    comprobar('y la ficha sigue calculando «sin acto» y contándolo como corrido',
      /'sin-acto'/.test(j70rol) && /por\.ok \+ por\['sin-acto'\]/.test(j70rol),
      /por\.ok \+ por\['sin-acto'\]/.test(j70rol)
        ? 'rolDeFuentes lo devuelve y coberturaDeRol lo suma en `corrio`'
        : 'coberturaDeRol dejó de sumarlo: volvería a leerse como que no se pudo comprobar');
  }

  /* ═══ UNA COMPROBACIÓN DESACTIVADA NO ES SILENCIOSA (v966) ══════════════
     La guarda de rol de la v965 no puede correr sobre las entradas que usan
     la forma antigua `fuente` + `url`: no tienen dónde poner un rol. Eso
     estaba dicho en la bitácora y no en la ficha, así que desde la pantalla
     la exención se leía como que la comprobación había pasado.

     Es la cuarta vez que este proyecto toma la misma decisión —`NO
     CONCLUYENTE`, `sin-base-registrada`, `validado: no`— y va escrita una
     sola vez en CLAUDE.md, en «Ninguna comprobación desactivada es
     silenciosa». Acá se comprueba que se cumpla. */
  {
    const j70r = leer('js/70-seguimiento.js');

    /* Los cuatro estados existen y la ficha los puede nombrar. */
    const bloque = (j70r.match(/var ROL_FUENTE = \{[\s\S]*?\n  \};/) || [''])[0];
    const estados = (bloque.match(/'([a-z-]+)':/g) || []).map((x) => x.replace(/[':]/g, ''));
    comprobar('MATERIAL · la comprobación de rol de fuente tiene sus estados nombrados',
      estados.length === 4 && estados.indexOf('no-comprobable-esquema-antiguo') >= 0,
      estados.join(' | '));

    /* Y el recuento se PUBLICA: si `coberturaRol` no llegara a la ficha, los
       cuatro estados serían documentación y la exención volvería a ser
       silenciosa. Es la guarda de la guarda. */
    comprobar('la cobertura de la comprobación viaja con la cifra y la ficha la pinta',
      /coberturaRol: coberturaDeRol\(ent\)/.test(j70r) &&
      /ind\.coberturaRol/.test(j70r) && /sp-c2-cober/.test(j70r) &&
      /sp-c2-cober/.test(leer('css/70-seguimiento.css')),
      'se calcula, se pega al resultado, se pinta y tiene regla que la pinta');

    /* Y distingue POR QUÉ no pudo correr. Si dejara de mirar los campos
       viejos, una entrada con esquema antiguo caería en «roles sin declarar»
       y la ficha declararía mal la causa, que es la falta de la v867: una
       pide un renglón y la otra una migración. */
    comprobar('y distingue el esquema antiguo de los roles sin declarar',
      /var vieja = !!\(\(e && e\.fuente\) \|\| \(e && e\.url\)\);/.test(j70r) &&
      /return vieja \? 'no-comprobable-esquema-antiguo' : 'sin-declarar';/.test(j70r),
      'declarar mal por qué no se pudo comprobar es peor que no decirlo');

    /* LA PROPIEDAD QUE SOBREVIVE AL CERO (v970). Hasta la v967 acá se exigía
       que HUBIERA entradas en los estados que no son «ok», «porque así el
       recuento mide algo». La v970 migró las veinte y quitó la declaración
       de las emisoras, y con eso el registro se quedó en cero: la guarda se
       puso roja sobre un registro que había MEJORADO.

       Esa es la señal de que medía el número y no la propiedad. Lo que hay
       que guardar es que el recuento se calcule sobre TODAS las declarantes
       —no sobre una lista aparte que envejece— y que la ficha tenga ESCRITAS
       las dos redacciones: la de «corrió sobre todas» y la de «en N no pudo
       correr». Eso se puede comprobar con cero material, y es justo lo que
       hace falta el día que el material vuelva: sin la segunda redacción, una
       entrada sin fuente del acto entraría y la pantalla seguiría diciendo
       que la comprobación corrió sobre todas. */
    const j70cb = soloCodigo(leer('js/70-seguimiento.js'));
    comprobar('la cobertura se calcula sobre TODAS las que declaran indicador, y sobre ninguna más',
      /if \(!\(\(\(e && e\.indicadores\) \|\| \[\]\)\.length\)\) return;/.test(j70cb) &&
      /n: n, corrio: por\.ok \+ por\['sin-acto'\]/.test(j70cb),
      'el filtro es declarar indicador y el denominador es esa misma lista');

    comprobar('y la ficha tiene escritas las DOS redacciones, la de cero y la de N',
      /La comprobación corrió sobre todas/.test(j70cb) &&
      /la comprobación NO pudo correr/.test(j70cb) &&
      /cr\.sinCorrer \? /.test(j70cb),
      'sin la segunda, una entrada sin fuente del acto entraría y la pantalla diría que corrió sobre todas');

    /* Y el censo de hoy, que es un HECHO del registro y no una afirmación:
       se publica pase lo que pase. Con material, el recuento mide algo y se
       dice cuánto; sin material, se dice que se quedó sin él y por qué —que
       es lo único que distingue «todas corrieron» de «la función dejó de
       verlas», porque desde la pantalla se leen igual—. */
    const reg = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const declaran = ((reg.entradas) || []).filter((e) => ((e.indicadores) || []).length);
    const vieja = declaran.filter((e) => !((e.fuentes) || []).length && (e.fuente || e.url));
    const sinRol = declaran.filter((e) => ((e.fuentes) || []).length &&
      !((e.fuentes) || []).some((f) => String(f.rol || '').trim()));
    const censo = declaran.length + ' declaran · ' + vieja.length + ' con esquema antiguo · ' +
      sinRol.length + ' sin roles declarados';
    if (vieja.length + sinRol.length) {
      comprobar('MATERIAL · hay entradas declarantes sobre las que la comprobación NO corre', true, censo);
    } else {
      anotarSinMaterial('MATERIAL · entradas declarantes sobre las que la comprobación no corre',
        censo + '. Las dos redacciones se comprueban arriba; lo que hoy no se ejercita es el recuento');
    }
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
    'imprim\u00ed',
    /* `sal\u00ed` estaba NOMBRADO en la bit\u00e1cora desde la v880 —«y “sal\u00ed a un sitio
       abierto” en js/20 es voseo»— y nunca se agreg\u00f3 a esta lista, as\u00ed que la
       guarda no pod\u00eda morderlo y el caso sigui\u00f3 impreso noventa versiones.
       Una declaraci\u00f3n que da por cubierto lo que la lista no trae se lee como
       un aprobado: es la mitad de vocabulario de esta guarda fallando
       ABIERTO, que es lo que la v880 dej\u00f3 escrito que iba a pasar. */
    'sal\u00ed'];

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
    'realizar\u00e1', 'recibir\u00e1', 'recomendar\u00e1', 'reemplazar\u00e1', 'renombrar\u00e1',
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
  /* ── El `${…}` de una plantilla también lleva TEXTO (v985) ───────────
     La v909 dejó escrito que «el `${…}` de una plantilla es CÓDIGO», y es
     cierto — pero de ahí salió saltárselo ENTERO, y dentro de una
     interpolación vive media interfaz de esta aplicación:
     `${cond ? 'un texto' : 'otro'}`. Todo eso era invisible para las dos
     guardas de idioma.

     Medido al encontrar «Foto en revisión: solo la ves tú y el moderador»
     impreso en pantalla con `revisar.js` en verde: **once tuteos** escondidos
     ahí, en cinco archivos, desde la v909. Es la forma de la v879 con la
     regex de js/68 — una guarda que pasa en verde no porque funcione sino
     porque su recorrido no llega.

     Se BAJA a la interpolación en vez de saltarla: dentro se vuelve a modo
     código, así que un identificador sigue sin contar, y las cadenas que haya
     ahí adentro se marcan como lo que son. El `}` que cierra devuelve a la
     plantilla, y se cuenta la profundidad de llaves para que un objeto
     literal dentro de la interpolación no la cierre antes de tiempo. */
  function dentroDeCadena(txt) {
    const s = new Uint8Array(txt.length);
    const ANTES_REGEX = /[(,=:[!&|?{};+\-*%~^<>]$/;
    let i = 0, modo = 0;
    /* Cada interpolación abierta, con su profundidad de llaves propia: las
       plantillas se anidan («`a${ `b${c}` }`») y una pila plana las
       confundiría. */
    const interp = [];
    while (i < txt.length) {
      const c = txt[i], d = txt[i + 1];
      if (modo === 0) {
        if (interp.length) {
          if (c === '{') { interp[interp.length - 1].prof++; i++; continue; }
          if (c === '}') {
            if (interp[interp.length - 1].prof > 0) { interp[interp.length - 1].prof--; i++; continue; }
            interp.pop(); modo = 5; i++; continue;
          }
        }
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
        interp.push({ prof: 0 }); modo = 0; i += 2; continue;
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
    'monoposte',
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
    /* Sustantivo del vocabulario presupuestal, que entró con el tablero de
       la v971. Es el contrato de la v952: un nombre nuevo en -ías cuesta un
       renglón acá y se ve en rojo hasta que alguien lo agregue. */
    'regalías',
    /* `vacías` es de las dos: adjetivo —«cajas vacías»— y presente de tú de
       vaciar. Acá es siempre el adjetivo, y va listada con esa razón. */
    'vacías'];
  /* Lo que termina en -abas y no es un imperfecto de tú. La lista es corta de
     verdad: en castellano casi nada acaba así. */
  const NO_ES_IMPERFECTO = ['sílabas', 'habas', 'trabas', 'bravas', 'octavas'];

  /* Y la SEXTA familia estructural: el ENCLÍTICO `-te` pegado a un infinitivo
     o a un gerundio (v1012). «darte», «ubicarte», «moviéndote» solo pueden ser
     tú: hablando de usted son «darle», «ubicarse», «moviéndose». No hay una
     tercera lectura, así que la regla es estructural como las de -ste, -ías y
     -abas, y no un vocabulario que falla abierto (v880).

     Lo que colisiona no son otras personas: son SUSTANTIVOS acabados en -arte
     o -erte —arte, parte, fuerte, muerte— y los verbos en -artir y -ertir, que
     en TERCERA persona acaban igual: reparte, comparte, convierte, advierte.
     Esos se listan, que es la forma de siempre: se lista lo permitido y se
     denuncia todo lo demás.

     Medido antes de escribirla: 127 palabras del texto que ve el usuario caen
     en el patrón y 125 son de esta lista; las dos que no lo eran estaban las
     dos MEZCLADAS con usted en la misma frase —«Si solo necesita ubicarte,
     CAMBIE a un mapa», «Es lo que URBIS no pudo darte… PREGUNTE también»—, que
     es como se ven cuando alguien corrige medio aviso. */
  const NO_ES_ENCLITICO = [
    'arte', 'parte', 'aparte', 'reparte', 'comparte', 'imparte', 'departe',
    'estandarte', 'baluarte', 'descarte', 'recorte',
    'fuerte', 'muerte', 'suerte', 'inerte', 'vierte', 'convierte', 'advierte',
    'divierte', 'invierte', 'revierte', 'concierte', 'pierte'
  ];

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
    /* Y el ENCLÍTICO -te (v1012). Un `-te` pegado a un infinitivo o a un
       gerundio solo puede ser tú: de usted son `-le` y `-se`. Va con la misma
       regla de forma que las de arriba —una mayúscula dentro de la palabra es
       un identificador— y con su lista de sustantivos permitidos. */
    const reENC = /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*(?:arte|erte|irte|ándote|éndote)(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g;
    while ((m = reENC.exec(txt))) {
      if (!cad[m.index]) continue;
      if (NO_ES_ENCLITICO.some(w => w.toLowerCase() === m[0].toLowerCase())) continue;
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

    /* Y el caso que la rompió (v985): una CADENA dentro de la interpolación.
       El recorrido de la v909 se saltaba el `${…}` entero, así que media
       interfaz —`${cond ? 'un texto' : 'otro'}`— era invisible y la guarda
       salía verde con once tuteos impresos dentro. Se mide DÓNDE cae cada
       cosa y no que no reviente, que es la regla de la v879.

       Los dos casos de al lado son los que pueden descolocar el recorrido al
       bajar: un objeto literal dentro de la interpolación —su `}` no la
       cierra— y una plantilla anidada dentro de ella. */
    const N = 'var a = `x ${cond ? \'tu casa\' : \'la otra\'} y`;\n' +
              'var b = `p ${f({ k: 1 })} tu perro`;\n' +
              'var c = `q ${ `r ${z}` } tu gato`;\n';
    const n = dentroDeCadena(N);
    const iIn = N.indexOf('tu casa'), iCond = N.indexOf('cond ?'),
          iObj = N.indexOf('k: 1'), iTrasObj = N.indexOf('tu perro'),
          iTrasTpl = N.indexOf('tu gato');
    comprobar('el recorrido BAJA a la interpolación: su texto se ve y su código no',
      !!n[iIn] && !n[iCond] && !n[iObj] && !!n[iTrasObj] && !!n[iTrasTpl],
      'el texto del ternario ' + (n[iIn] ? 'se ve' : 'NO SE VERÍA') +
      ', la condición ' + (n[iCond] ? 'SE DENUNCIARÍA' : 'queda fuera') +
      ', el objeto literal ' + (n[iObj] ? 'SE DENUNCIARÍA' : 'queda fuera') +
      ', y tras él la plantilla sigue viva ' + (n[iTrasObj] ? 'sí' : 'NO') +
      ' · tras una plantilla anidada ' + (n[iTrasTpl] ? 'sí' : 'NO'));

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

    /* Y la del enclítico, que es la que más puede quedarse sin morder: su
       lista lleva palabras muy corrientes en esta aplicación —`parte` sale 48
       veces y `fuerte` 31—, así que un renglón de más ahí la callaría justo
       donde existe para hablar. */
    const oE = prueba(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*(?:arte|erte|irte|ándote|éndote)(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g,
      NO_ES_ENCLITICO);
    comprobar('la del enclítico -te caza el tuteo y deja pasar los sustantivos',
      oE('darte') && oE('ubicarte') && oE('moverte') && oE('moviéndote') &&
      !oE('arte') && !oE('parte') && !oE('fuerte') && !oE('convierte') && !oE('reparte'),
      'tuteo: darte ' + oE('darte') + ' · ubicarte ' + oE('ubicarte') +
      ' · moverte ' + oE('moverte') + ' · moviéndote ' + oE('moviéndote') +
      ' — no lo es: arte ' + oE('arte') + ' · parte ' + oE('parte') +
      ' · fuerte ' + oE('fuerte') + ' · convierte ' + oE('convierte') +
      ' · reparte ' + oE('reparte'));
  })();

  comprobar('ningún tuteo en el texto que ve el usuario (§9)', tuteos.length === 0,
    tuteos.length ? tuteos.slice(0, 40).join(' · ') + (tuteos.length > 40 ? ' …y ' + (tuteos.length - 40) + ' más' : '')
                  : 'revisados ' + arch.length + ' archivos; los pronombres, el futuro en -ás, el pretérito ' +
                    'en -ste, el condicional en -ías, el imperfecto en -abas y el enclítico -te son ' +
                    'estructurales; el presente y los imperativos NO se pueden separar de la ' +
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
/* ── El mapeo de Pro City: la matriz, sus grupos y el análisis (v973) ──────

   Un uso de la Matriz de Usos vive escrito en TRES sitios que hoy coinciden
   exactamente y que nada mantenía juntos:

     · `PROCITY_MATRIZ_USOS` (js/20) — el catálogo: el uso y sus tipos;
     · `MATRIZ_GRUPOS`       (js/20) — en qué grupo temático se navega;
     · `USO_A_SUB`           (js/64) — en qué casilla lo cuenta el análisis.

   Un uso que falte en el segundo no aparece navegando —solo buscándolo—, y
   uno que falte en el tercero se puede mapear y el análisis lo descarta: se
   puede pasar una tarde en la calle levantando algo que ninguna cifra
   recoge, y desde afuera eso se ve igual que no haberlo mapeado.

   Es la clase B de este proyecto —tres codificaciones de un hecho que
   coinciden el día que se escriben— y esta misma tanda es la que lo destapó:
   agregar «Arbolado Urbano» obliga a tocar los tres. Se comprueba en las dos
   direcciones, porque sobrar también rompe: un grupo que nombre un uso que
   ya no existe deja una tarjeta que no lleva a ninguna parte.

   La lista NO se escribe acá: se leen los tres inventarios de sus propios
   archivos, así que un uso nuevo queda vigilado sin que su autor se acuerde.  */
console.log('\n  -- el mapeo de Pro City --');
{
  const j20 = leer('js/20-mobile-functional-app.js');
  const j64 = leer('js/64-analisis-edu.js');
  const j10 = leer('js/10-visible-markers.js');
  const trozo = (src, desde, hasta) => {
    const i = src.indexOf(desde), j = src.indexOf(hasta, i + 1);
    return (i < 0 || j < 0) ? '' : src.slice(i + desde.length, j + hasta.length);
  };
  /* El literal, sin el punto y coma final: `eval('({…};)')` es un error de
     sintaxis, y como el extractor va dentro de un `try` el fallo se leería
     como «el inventario está vacío» en vez de como «no lo supe leer». Lo cazó
     la guarda de MATERIAL de abajo, que por eso va primero. */
  const objeto = (src, desde) => trozo(src, desde, '\n  };').replace(/;\s*$/, '');
  let USOS = [], GRUPOS = [], SUB = {}, SINON = {};
  try { USOS   = eval(trozo(j20, 'const PROCITY_MATRIZ_USOS = ', '\n  ];')); } catch (e) {}
  try { GRUPOS = eval(trozo(j20, 'const MATRIZ_GRUPOS = ',       '\n  ];')); } catch (e) {}
  try { SUB    = eval('(' + objeto(j64, 'const USO_A_SUB = ')       + ')'); } catch (e) {}
  try { SINON  = eval('(' + objeto(j20, 'const SINONIMOS_MATRIZ = ') + ')'); } catch (e) {}

  const nombres = (USOS || []).map(x => x && x.u);
  const tipos = [];
  (USOS || []).forEach(x => (x && x.t || []).forEach(t => tipos.push({ uso: x.u, tipo: t })));
  const enGrupo = [];
  (GRUPOS || []).forEach(g => (g && g.usos || []).forEach(u => enGrupo.push(u)));

  /* La guarda de la guarda, y va PRIMERO: si los extractores devolvieran
     vacío —porque alguien renombró una constante o cambió su forma—, todas
     las de abajo pasarían en verde sin vigilar un solo uso. */
  comprobar('los tres inventarios del mapeo se leen',
    nombres.length > 40 && tipos.length > 400 && (GRUPOS || []).length >= 8 &&
      Object.keys(SUB).length > 40 && Object.keys(SINON).length > 5,
    nombres.length + ' usos · ' + tipos.length + ' tipos · ' + (GRUPOS || []).length +
      ' grupos · ' + Object.keys(SUB).length + ' en el análisis · ' +
      Object.keys(SINON).length + ' sinónimos');

  const sinGrupo = nombres.filter(u => enGrupo.indexOf(u) < 0);
  const grupoFantasma = enGrupo.filter(u => nombres.indexOf(u) < 0);
  comprobar('todo uso de la matriz se navega por un grupo, y ningún grupo nombra uno que no existe',
    sinGrupo.length === 0 && grupoFantasma.length === 0,
    sinGrupo.length ? 'sin grupo: ' + sinGrupo.join(' · ')
      : grupoFantasma.length ? 'el grupo nombra lo que no existe: ' + grupoFantasma.join(' · ')
      : nombres.length + ' usos, todos en su grupo');

  const sinSub = nombres.filter(u => !SUB[u]);
  const subFantasma = Object.keys(SUB).filter(u => nombres.indexOf(u) < 0);
  comprobar('todo uso de la matriz llega al análisis, y el análisis no espera uno que no existe',
    sinSub.length === 0 && subFantasma.length === 0,
    sinSub.length ? 'se podría mapear y el análisis lo descartaría: ' + sinSub.join(' · ')
      : subFantasma.length ? 'el análisis espera lo que no existe: ' + subFantasma.join(' · ')
      : nombres.length + ' usos, todos con su casilla');

  /* ── El CUARTO inventario, que la v973 rompió sin que nada lo dijera ─────
     Un uso nuevo se escribe en tres sitios —el catálogo, su grupo y la
     casilla del análisis— y las tres las vigila lo de arriba. El cuarto es
     el vocabulario del edificio, y ahí `tienePisos` falla ABIERTO: lo
     que no esté en la lista de «sin pisos» cuenta como edificio. Así que
     «Arbolado Urbano» entró en la v973 y la ficha de una palma preguntaba
     «¿cuántos pisos tiene?», prellenando un piso con «No se sabe». No lo vio
     ninguna comprobación: salió mirando el papel.

     Y la propiedad que lo impide no estaba escrita en ninguna parte, aunque
     fuera cierta: las tres listas del vocabulario PARTEN el catálogo —cada
     uso en exactamente una—, y la v973 fue lo primero que la rompió. Acá se
     escribe, y por eso falla cerrado: un uso nuevo sale en rojo hasta que
     alguien decida de qué lado está, en vez de heredar «es un edificio» tres
     tandas sin que nadie se entere. */
  const j03b = leer('js/03b-edificio-vocabulario.js');
  let SIN_PISOS = [], PISO_DE = {}, MIXTOS = {};
  try { SIN_PISOS = eval('([' + trozo(j03b, 'const USOS_MATRIZ_SIN_PISOS = new Set([', '\n  ]);').replace(/\]\);\s*$/, '') + '])'); } catch (e) {}
  try { PISO_DE   = eval('({' + objeto(j03b, 'const USO_PISO_DE_MATRIZ = ').replace(/^\s*\{/, '').replace(/\}\s*$/, '') + '})'); } catch (e) {}
  try { MIXTOS    = eval('({' + objeto(j03b, 'const MIXTOS_DECLARADOS = ').replace(/^\s*\{/, '').replace(/\}\s*$/, '') + '})'); } catch (e) {}
  const conPisos = Object.keys(PISO_DE).concat(Object.keys(MIXTOS));

  comprobar('las tres listas del vocabulario del edificio se leen',
    SIN_PISOS.length > 10 && Object.keys(PISO_DE).length > 20 && Object.keys(MIXTOS).length >= 3,
    SIN_PISOS.length + ' sin pisos · ' + Object.keys(PISO_DE).length + ' con uso de piso · ' +
      Object.keys(MIXTOS).length + ' mixtos declarados');

  const sinLado = nombres.filter(u => SIN_PISOS.indexOf(u) < 0 && conPisos.indexOf(u) < 0);
  const dosLados = nombres.filter(u => SIN_PISOS.indexOf(u) >= 0 && conPisos.indexOf(u) >= 0);
  const ladoFantasma = SIN_PISOS.concat(conPisos).filter(u => nombres.indexOf(u) < 0);
  comprobar('todo uso de la matriz declara si tiene pisos o no, y solo una vez',
    sinLado.length === 0 && dosLados.length === 0 && ladoFantasma.length === 0,
    sinLado.length ? 'sin declarar, así que la ficha le preguntaría los pisos: ' + sinLado.join(' · ')
      : dosLados.length ? 'en los dos lados: ' + dosLados.join(' · ')
      : ladoFantasma.length ? 'el vocabulario nombra lo que no existe: ' + ladoFantasma.join(' · ')
      : nombres.length + ' usos, cada uno de un solo lado');

  /* Un sinónimo que no casa con ningún tipo es un no-op: se lee igual que uno
     que funciona, y quien escriba esa palabra seguirá sin encontrar nada. */
  const nrm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const huecos = Object.keys(SINON).filter(k => {
    const t = nrm(SINON[k]);
    return !tipos.some(x => nrm(x.tipo).indexOf(t) >= 0 || nrm(x.uso).indexOf(t) >= 0);
  });
  comprobar('ningún sinónimo del buscador apunta al vacío',
    huecos.length === 0,
    huecos.length ? huecos.map(k => k + ' → ' + SINON[k]).join(' · ')
      : Object.keys(SINON).length + ' sinónimos, todos con destino');

  /* Un árbol se podía reportar y no MAPEAR: buscar «arbol» o «palma» daba
     cero. Se persigue lo que la calle pidió y no el nombre del uso, para que
     un renombre no deje el hueco abierto en silencio. */
  const puedeMapear = t => tipos.some(x => nrm(x.tipo).indexOf(nrm(t)) >= 0);
  const faltan = ['arbol', 'palma', 'banca', 'caneca', 'juegos infantiles'].filter(t => !puedeMapear(t));
  comprobar('el árbol, la palma, la banca, la caneca y los juegos infantiles se pueden mapear',
    faltan.length === 0,
    faltan.length ? 'sin tipo: ' + faltan.join(' · ') : 'los cinco tienen su tipo');

  /* ── Qué árbol es (v975) ─────────────────────────────────────────────────
     Un campo nuevo sobre el arbolado, con tres cosas que guardar. La primera
     es la de siempre y va PRIMERO: si el extractor devolviera vacío, todo lo
     de abajo pasaría en verde sin vigilar una sola especie. */
  const j03c = leer('js/03c-arbol-especies.js');
  const j04 = leer('js/04-marker-proximity.js');
  let ESPECIES = [], USOS_ESPECIE = [];
  /* `trozo` DEVUELVE el terminador, así que el literal ya viene cerrado: es
     el mismo `eval(trozo(...))` con el que se leen los otros inventarios de
     este bloque, y envolverlo otra vez en corchetes es un error de sintaxis.
     Lo cazó la guarda de MATERIAL de abajo, que por eso va primero. */
  try { ESPECIES = eval(trozo(j03c, 'var ESPECIES = ', '\n  ];')); } catch (e) {}
  try { USOS_ESPECIE = eval(trozo(j03c, 'var USOS_CON_ESPECIE = ', '];')); } catch (e) {}

  const sinBinomio = (ESPECIES || []).filter(e => !e || !e.c || !/ /.test(String(e.c)));
  comprobar('la lista de especies se lee, y cada una trae su nombre científico',
    ESPECIES.length > 25 && sinBinomio.length === 0 && USOS_ESPECIE.length > 0,
    ESPECIES.length < 5 ? 'no se pudo leer la lista de especies'
      : sinBinomio.length ? 'sin binomio: ' + sinBinomio.map(e => e && e.n).join(' · ')
      : ESPECIES.length + ' especies · ' + ESPECIES.filter(e => e.p).length + ' palmas · ' +
        USOS_ESPECIE.length + ' uso(s) con especie');

  /* Un sinónimo que se normaliza igual que el nombre de su propia especie no
     aporta nada —el buscador ya quita los acentos— y uno que se normaliza
     como OTRA especie la secuestra. Los dos se leen exactamente igual que uno
     que funciona, que es el no-op que la v973 tuvo que perseguir. */
  const nrmE = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nombresE = (ESPECIES || []).map(e => nrmE(e.n));
  const repetidas = nombresE.filter((x, i) => nombresE.indexOf(x) !== i);
  const sinonimoInutil = [];
  (ESPECIES || []).forEach(e => {
    const vistos = [];
    (e.alt || []).forEach(a => {
      const k = nrmE(a);
      if (!k || k === nrmE(e.n) || vistos.indexOf(k) >= 0 || nombresE.indexOf(k) >= 0) {
        sinonimoInutil.push(e.n + ' → ' + a);
      }
      vistos.push(k);
    });
  });
  comprobar('ninguna especie se repite y ningún sinónimo es un no-op',
    repetidas.length === 0 && sinonimoInutil.length === 0,
    repetidas.length ? 'nombres repetidos: ' + repetidas.join(' · ')
      : sinonimoInutil.length ? 'sinónimos que no cambian nada: ' + sinonimoInutil.join(' · ')
      : (ESPECIES || []).reduce((n, e) => n + (e.alt || []).length, 0) + ' sinónimos, todos con trabajo');

  /* Las dos salidas se DERIVAN de js/03b y no se copian. Son un solo hecho
     —«se miró y no se pudo determinar» contra «no está en la lista»— y dos
     copias de una advertencia se separan a la tanda siguiente (v867).

     Y se mide CADA UNA por separado, no que el archivo nombre a js/03b en
     alguna parte. La primera versión buscaba `URBIS_EDIFICIO` en todo el
     archivo, y con eso copiar el literal en UNA de las dos salidas la dejaba
     en verde: la otra seguía derivando y el nombre seguía apareciendo. Se
     vio demostrándola en rojo —la inyección no la movió— y una guarda que no
     puede fallar es un verde (v878). Lo que se exige es que cada salida lea
     el campo del MISMO nombre del vocabulario, con el literal de respaldo. */
  const cuerpoDe = (src, nombre) => {
    const i = src.indexOf('function ' + nombre + '(');
    if (i < 0) return '';
    const j = src.indexOf('{', i);
    let d = 0;
    for (let k = j; k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}' && --d === 0) return src.slice(j + 1, k);
    }
    return '';
  };
  const j03cCod = soloCodigo(j03c);
  const salidaCopiada = ['NO_SE_SABE', 'OTRO'].filter(k =>
    !new RegExp('v\\s*&&\\s*v\\.' + k + '\\b').test(cuerpoDe(j03cCod, k)));
  /* Y su guarda de la guarda: si `voc()` dejara de leer el vocabulario, las
     dos seguirían diciendo `v && v.X` sobre un objeto propio y todo lo de
     arriba seguiría en verde sin vigilar una sola palabra. */
  const vocLee = /URBIS_EDIFICIO/.test(cuerpoDe(j03cCod, 'voc'));
  comprobar('las dos salidas del árbol salen del vocabulario, no de un literal propio',
    salidaCopiada.length === 0 && vocLee,
    salidaCopiada.length ? 'escribe su propio literal en: ' + salidaCopiada.join(' · ')
      : !vocLee ? 'voc() dejó de leer URBIS_EDIFICIO: las dos derivan de un objeto propio'
      : 'las dos derivadas de js/03b, y voc() lo lee');

  /* Y el uso que declara especie tiene que existir en el catálogo: un
     renombre allá dejaría el campo apagado en silencio, que es exactamente la
     forma de la v974 con el vocabulario del edificio. */
  const usoFantasmaEsp = (USOS_ESPECIE || []).filter(u => nombres.indexOf(u) < 0);
  comprobar('todo uso que declara especie existe en el catálogo de la matriz',
    USOS_ESPECIE.length > 0 && usoFantasmaEsp.length === 0,
    usoFantasmaEsp.length ? 'declara especie y no está en el catálogo: ' + usoFantasmaEsp.join(' · ')
      : USOS_ESPECIE.join(' · ') + ', en el catálogo');

  /* La casilla nueva se reparte desde URBIS_SLOTS y NUNCA se calcula aparte:
     tres funciones haciéndolo por su cuenta ya se pisaron los datos una vez,
     y por eso existe esa tabla. */
  comprobar('la especie tiene su casilla en URBIS_SLOTS y nadie la calcula por su lado',
    /especieArbol:\s*BASE_OFFSET/.test(j04) && /especieArbolOtro:\s*BASE_OFFSET/.test(j04) &&
      !/BASE_OFFSET\s*\+\s*TIMELINE_EXTRA_OFFSET\s*\+\s*1[78]/.test(soloCodigo(leer('js/12-spa-ui.js')) +
        soloCodigo(leer('js/20-mobile-functional-app.js')) + soloCodigo(leer('js/10-visible-markers.js'))),
    /especieArbol:\s*BASE_OFFSET/.test(j04) ? 'las dos casillas, repartidas desde la tabla'
      : 'la especie no está en URBIS_SLOTS');

  /* Y llega a una PANTALLA. Un dato que se guarda y que ninguna superficie
     enseña se ve, desde afuera, exactamente igual que un dato que no está —la
     clase que este proyecto tiene anotada con su censo—. Se busca el hueco de
     la plantilla y no el identificador, que es la lección de la v973: con la
     declaración en pie y el hueco quitado, el texto se calcula y no se pinta. */
  const dondeSaleEspecie = ['${especiePopup}', '${_especieDet}'].filter(x => j10.indexOf(x) >= 0);
  comprobar('la especie llega al globo y a la ficha, no solo al registro',
    /URBIS_ARBOL/.test(soloCodigo(j10)) && dondeSaleEspecie.length === 2,
    dondeSaleEspecie.length === 2 ? 'las 2 superficies la pintan'
      : 'solo la pintan ' + dondeSaleEspecie.length + ' de 2 superficies');

  /* ── Un bloque de foto pintado se CONECTA (v976) ──────────────────────
     El formulario de Pro City pintaba «\u{1F4F7} Tomar foto» y nadie lo conectaba, así
     que la foto tomada con la cámara no llegaba al campo que el publicado lee
     y se perdía EN SILENCIO. Es la clase de defecto que no se ve leyendo el
     formulario —el botón está ahí— y tampoco usando la galería, que sí
     guardaba.

     Se lee SIN comentarios (v926): los de js/20 nombran `conectarBloqueFoto`
     al explicar el arreglo, y una comprobación que cuenta menciones dentro de
     su propia explicación se comprueba a sí misma (v972).

     DE QUÉ RESPONDE, dicho entero (v945): caza una llamada AUSENTE, que es el
     defecto que ocurrió —demostrado retirando la de Pro City, el estado exacto
     de la v975—. NO caza una llamada escrita y desactivada: con un `if(0)`
     delante sigue contando, porque una comprobación estática cuenta menciones
     y no alcanzabilidad. Se descubrió inyectando ese `if(0)` y viéndola pasar
     en verde; se dice en vez de dejarla pareciendo completa. Esa mitad la
     vería una sonda de navegador, que en este contenedor no corre como suite.

     Y las DOS mitades de la condición hacen falta: el id `ins-foto-file` lo
     pintan dos formularios y el reporte ciudadano sí lo conectaba, así que
     `sinConectar` salía VACÍO sobre el defecto real. Lo que lo cazó es el
     conteo —tres pintan, dos conectan—. */
  {
    const j20c = soloCodigo(j20);
    const pinta = [...j20c.matchAll(/bloqueFotoHTML\(\s*'([^']+)'/g)].map(m => m[1]);
    const conecta = [...j20c.matchAll(/conectarBloqueFoto\(\s*\w+\s*,\s*'([^']+)'/g)].map(m => m[1]);

    /* MATERIAL primero (v920): si el extractor deja de encontrar las
       llamadas, todo lo de abajo pasaría en verde sobre la nada — que es lo
       que la v975 se cobró con su propia lista de especies. */
    if (!pinta.length) {
      comprobar('MATERIAL · se leen las llamadas que pintan el bloque de foto', false,
        'no se encontró ninguna: el patrón dejó de casar y las de abajo no vigilan nada');
    } else {
      comprobar('MATERIAL · se leen las llamadas que pintan el bloque de foto', true,
        pinta.length + ' pintan · ' + conecta.length + ' conectan');

      const sinConectar = pinta.filter(id => conecta.indexOf(id) < 0);
      comprobar('todo bloque de foto pintado queda conectado, o la cámara se pierde en silencio',
        sinConectar.length === 0 && conecta.length >= pinta.length,
        sinConectar.length ? 'pintado y sin conectar: ' + [...new Set(sinConectar)].join(' · ')
          : conecta.length < pinta.length
            ? 'se pinta en ' + pinta.length + ' formularios y solo se conecta en ' + conecta.length
              + ': uno de ellos tiene el botón muerto'
            : 'los ' + pinta.length + ' conectados');

      /* Y su guarda de la guarda: lo de arriba seguiría en verde si
         `conectarBloqueFoto` dejara de copiar lo tomado con la cámara al
         campo que `enviarDatos` lee. Las tres llamadas seguirían ahí y la
         foto volvería a perderse igual (v878). */
      const cuerpoCbf = trozo(j20c, 'function conectarBloqueFoto(', '\n  }\n');
      comprobar('y conectarBloqueFoto sigue copiando lo de la cámara al campo que se publica',
        /inp\s*===\s*camara/.test(cuerpoCbf) && /galeria\.files\s*=/.test(cuerpoCbf),
        /galeria\.files\s*=/.test(cuerpoCbf) ? 'la cámara escribe en el campo de la galería'
          : 'dejó de copiarla: conectarlo no bastaría y nada lo diría');
    }
  }

  /* ── La dirección dejó de ser obligatoria (v973) ─────────────────────────
     El campo se contestaba con relleno para poder publicar, que es conseguir
     un dato falso en vez de ninguno. Las dos mitades se guardan juntas: que
     no vuelva la puerta, y que lo que se publica sin dirección lo DIGA — sin
     la segunda, un reporte sin dirección se lee igual que uno con ella. */
  const pub = trozo(j20, 'function publishQuickReport(', '\n  }\n');
  const hayPuerta = pub.indexOf("alert('Ingrese la dirección") >= 0;
  comprobar('publicar no exige la dirección',
    pub.length > 200 && !hayPuerta,
    pub.length <= 200 ? 'no se pudo leer publishQuickReport'
      : hayPuerta ? 'la puerta volvió: publicar vuelve a exigirla'
      : 'sin puerta en publishQuickReport');
  /* Se busca el hueco de la PLANTILLA —`${…}`— y no el identificador suelto:
     con la declaración en pie y el hueco quitado, la advertencia se calcula y
     no se pinta, que desde la pantalla se ve igual que no tenerla. Lo cazó la
     demostración en rojo: la primera versión de esta guarda no se ponía roja
     al sacar el renglón del globo. */
  const dondeSeDice = ['${sinDirPopup}', '${_sinDirDet}'].filter(x => j10.indexOf(x) >= 0);
  comprobar('un reporte sin dirección lo declara en el globo y en la ficha',
    j10.indexOf('window.urbisSinDireccion = function') >= 0 && dondeSeDice.length === 2,
    dondeSeDice.length === 2 ? 'las 2 superficies lo pintan'
      : dondeSeDice.length + ' de 2 superficies lo pintan');
  /* Y la guarda de la guarda: las dos superficies tienen que seguir leyendo
     la MISMA función. Con dos redacciones de la advertencia, una se arregla y
     la otra no (v879). */
  const llamadas = (j10.match(/urbisSinDireccion\(/g) || []).length;
  comprobar('y las dos lo declaran por la misma función',
    llamadas >= 2,
    llamadas + ' llamadas a urbisSinDireccion');
}

console.log('\n  -- lo mapeado llega al análisis como lo que es (v984) --');
{
  const j64 = soloCodigo(leer('js/64-analisis-edu.js'));
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const claves = (src, desde) => {
    const i = src.indexOf(desde); if (i < 0) return [];
    const j = src.indexOf('\n  };', i); if (j < 0) return [];
    return (src.slice(i, j).match(/'([^']+)'\s*:/g) || []).map(x => x.slice(1, x.lastIndexOf("'")));
  };
  const VIA = claves(j64, 'const TIPO_A_VIA = {');
  const INFRA = claves(j64, 'const TIPO_INFRA_A_SUB = {');
  const tiposVia = (() => {
    const m = j20.match(/\{ u:'Vías e Infraestructura Vial'[^\n]*/);
    if (!m) return [];
    const t = m[0].match(/t:\[([^\]]*)\]/);
    return t ? (t[1].match(/'([^']+)'/g) || []).map(x => x.slice(1, -1)) : [];
  })();

  const mat = VIA.length > 8 && INFRA.length > 8 && tiposVia.length > 15;
  comprobar('MATERIAL · se leen las dos tablas y los tipos de vía',
    mat,
    mat ? VIA.length + ' en TIPO_A_VIA · ' + INFRA.length + ' en TIPO_INFRA_A_SUB · ' + tiposVia.length + ' tipos de vía'
        : 'no se pudieron leer: ' + [VIA.length <= 8 ? 'TIPO_A_VIA' : '', INFRA.length <= 8 ? 'TIPO_INFRA_A_SUB' : '',
            tiposVia.length <= 15 ? 'los tipos de vía' : ''].filter(Boolean).join(' · '));

  /* NINGÚN tipo de «Vías e Infraestructura Vial» puede caer por omisión.
     Lo que no esté en una de las dos tablas cae al `USO_A_SUB` de su uso,
     que es `via_arteria`: un puente peatonal, una trocha o una baranda
     entraban al análisis como vía principal e inflaban la jerarquía vial del
     sector con lo que nadie puede recorrer en carro. Falla CERRADO: un tipo
     de vía nuevo sale en rojo hasta que alguien diga qué es. */
  const porOmision = tiposVia.filter(t => VIA.indexOf(t) < 0 && INFRA.indexOf(t) < 0);
  comprobar('ningún tipo de vía cae en «arteria» por omisión',
    porOmision.length === 0 && tiposVia.length > 15,
    tiposVia.length <= 15 ? 'no se leyeron los tipos de vía'
      : porOmision.length ? porOmision.join(' · ') + ': entran al análisis como vía principal'
      : 'los ' + tiposVia.length + ' dicen qué son');

  /* `building:levels` SOLO donde el uso es un edificio, y por el MISMO
     discriminante que usa la ficha para decidir si pregunta los pisos. Con
     él emitido siempre, un árbol y un hidrante entran al motor como
     construcciones de un piso. */
  const cuerpo = (() => {
    const i = j64.indexOf('function puntoAElemento(');
    return i < 0 ? '' : j64.slice(i, j64.indexOf('\n  }\n', i));
  })();
  const condicionado = !!cuerpo
    && cuerpo.indexOf('tienePisos(') >= 0
    && /if\s*\(esEdificio\)\s*t\['building:levels'\]/.test(cuerpo)
    && !/'building:levels'\s*:/.test(cuerpo);
  comprobar('solo un edificio entra al análisis con pisos',
    condicionado,
    !cuerpo ? 'no se pudo leer puntoAElemento'
      : /'building:levels'\s*:/.test(cuerpo) ? 'los pisos se emiten siempre: un árbol y un hidrante cuentan como construcciones'
      : cuerpo.indexOf('tienePisos(') < 0 ? 'no usa el mismo discriminante que la ficha: la decisión queda en dos sitios'
      : 'los pisos van condicionados a tienePisos');

  /* Y la guarda contra pasarse: los pisos tienen que SEGUIR emitiéndose.
     Quitarlos del todo dejaría al motor sin alturas de lo levantado en
     campo, que es lo contrario de lo que esta tanda vino a arreglar. */
  /* Se mide la PROPIEDAD y no la forma: la primera versión citaba la línea
     exacta de la asignación y salía roja contra la inyección que emite los
     pisos SIEMPRE —donde sí viajan—. Es la v890 cometida en la guarda que la
     acompaña. Lo que tiene que seguir siendo cierto es que la etiqueta se
     emita y salga de la ficha. */
  const siguenViajando = !!cuerpo && cuerpo.indexOf("'building:levels'") >= 0
    && cuerpo.indexOf('ficha.pisos') >= 0;
  comprobar('y un edificio sigue entrando con sus pisos',
    siguenViajando,
    siguenViajando ? 'los pisos de la ficha siguen viajando'
      : 'ya no se emiten: el motor se queda sin las alturas levantadas en campo');
}

console.log('\n  -- el arte de la calle y la publicidad, que no son lo mismo (v983) --');
{
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j03b = soloCodigo(leer('js/03b-edificio-vocabulario.js'));
  const j03d = soloCodigo(leer('js/03d-mobiliario-material.js'));
  const j64 = soloCodigo(leer('js/64-analisis-edu.js'));
  const nrm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tipos = (() => {
    const i = j20.indexOf('const PROCITY_MATRIZ_USOS = [');
    if (i < 0) return [];
    const blk = j20.slice(i, j20.indexOf('\n  ];', i));
    return (blk.match(/'[^']+'/g) || []).map(x => x.slice(1, -1));
  })();
  const ARTE = 'Arte Urbano', PUB = 'Publicidad Exterior Visual';

  comprobar('MATERIAL · se lee el catálogo de tipos',
    tipos.length > 550,
    tipos.length > 550 ? tipos.length + ' cadenas en el catálogo' : 'no se pudo leer PROCITY_MATRIZ_USOS');

  const sePuede = t => tipos.some(x => nrm(x).indexOf(nrm(t)) >= 0);
  const pedidos = ['mural', 'grafiti', 'valla', 'escultura', 'placa', 'pasacalle', 'aviso'];
  const sinTipo = pedidos.filter(t => !sePuede(t));
  comprobar('el arte de la calle y la publicidad tienen su tipo',
    sinTipo.length === 0,
    sinTipo.length ? 'sin tipo: ' + sinTipo.join(' · ') : 'los ' + pedidos.length + ' se pueden mapear');

  /* LOS DOS USOS VAN SEPARADOS, y esta es la comprobación que sostiene la
     tanda. Una valla no es arte: en Colombia la regula la Ley 140 de 1994 y
     se inventaría para cobrarla y controlarla, no para protegerla. Juntarlas
     en un uso haría que el análisis contara las vallas de la avenida como
     equipamiento cultural del sector. */
  const artePub = (() => {
    const i = j20.indexOf("u:'" + ARTE + "'");
    const k = j20.indexOf("u:'" + PUB + "'");
    if (i < 0 || k < 0) return null;
    const corte = (p) => { const a = j20.indexOf("t:[", p); const b = j20.indexOf(']', a); return j20.slice(a, b); };
    return { arte: corte(i), pub: corte(k) };
  })();
  const mezclado = !artePub ? true
    : /valla|pasacalle|pantalla digital/i.test(artePub.arte) || /mural art|escultura|grafiti/i.test(artePub.pub);
  comprobar('el arte y la publicidad son DOS usos, y no se mezclan sus tipos',
    !mezclado,
    !artePub ? 'falta alguno de los dos usos'
      : mezclado ? 'hay publicidad dentro de Arte Urbano o arte dentro de Publicidad: el análisis contaría vallas como cultura'
      : 'cada uso con lo suyo');

  /* Y cuentan cosas distintas en el análisis. Si los dos cayeran en
     «cultural», separarlos en el catálogo no habría servido de nada. */
  const subArte = (j64.match(new RegExp("'" + ARTE + "':\\s*'([a-z_]+)'")) || [])[1];
  const subPub  = (j64.match(new RegExp("'" + PUB + "':\\s*'([a-z_]+)'")) || [])[1];
  comprobar('y el análisis los cuenta aparte',
    !!subArte && !!subPub && subArte !== subPub,
    (!subArte || !subPub) ? 'falta en USO_A_SUB: ' + [!subArte ? ARTE : '', !subPub ? PUB : ''].filter(Boolean).join(' · ')
      : subArte === subPub ? 'los dos caen en «' + subArte + '»: separarlos en el catálogo no sirvió de nada'
      : ARTE + ' → ' + subArte + ' · ' + PUB + ' → ' + subPub);

  /* Los cuatro inventarios, para los dos usos. Es la misma exigencia de la
     v982 y por la misma razón: basta olvidar uno para que quede roto sin que
     nada lo diga. */
  const faltanInv = [];
  [ARTE, PUB].forEach(u => {
    if (j20.indexOf("u:'" + u + "'") < 0) faltanInv.push(u + ': catálogo');
    if ((j20.match(new RegExp("'" + u + "'", 'g')) || []).length < 2) faltanInv.push(u + ': grupo');
    if (j64.indexOf("'" + u + "'") < 0) faltanInv.push(u + ': análisis');
    if (j03b.indexOf("'" + u + "'") < 0) faltanInv.push(u + ': sin pisos');
  });
  comprobar('los dos usos nuevos están en los CUATRO inventarios',
    faltanInv.length === 0,
    faltanInv.length ? 'falta ' + faltanInv.join(' · ') : 'catálogo · grupo · análisis · sin pisos, los dos');

  /* El nombre del tipo dice lo que SE VE, no lo que se supone. «Grafiti
     ilegal» o «mural no autorizado» meten en el catálogo un juicio sobre un
     permiso que nadie puede verificar desde la acera — y una vez escrito en
     el tipo, queda en el registro como si fuera una observación. */
  /* Acotada a ESTOS DOS usos, y se dice por qué. Sobre el catálogo entero
     denunciaba «Botadero a cielo abierto (ilegal)» y «Extracción ilegal», que
     NO son el mismo caso: ahí la ilegalidad ES la categoría —no existe un
     botadero a cielo abierto autorizado, eso es un relleno sanitario— y no
     una afirmación sobre el permiso de una pieza concreta. Una guarda con
     falsos positivos termina en una lista de excepciones que envejece hasta
     no significar nada (v895), así que se acota en vez de coleccionar
     excepciones. De qué NO responde: de que alguien escriba el juicio en
     otro uso. */
  const tiposDeLosDos = artePub ? (artePub.arte + artePub.pub).match(/'[^']+'/g) || [] : [];
  const juicios = tiposDeLosDos.map(x => x.slice(1, -1))
    .filter(t => /ilegal|no autorizad|sin permiso|vandalic|vandalis|permitid/i.test(t));
  /* Y con su propio material: sin los dos usos leídos, `tiposDeLosDos` sale
     vacío y esto pasaría en verde sin vigilar un solo nombre — pasó al
     demostrarla en rojo, y una guarda que no puede fallar es un verde
     (v878). */
  comprobar('ningún tipo de arte o publicidad encierra un juicio que no se ve desde la acera',
    juicios.length === 0 && tiposDeLosDos.length >= 15,
    tiposDeLosDos.length < 15 ? 'solo se leyeron ' + tiposDeLosDos.length + ' tipos de los dos usos: no hay sobre qué comprobar'
      : juicios.length ? juicios.join(' · ') + ': el permiso no se puede determinar mirando'
      : tiposDeLosDos.length + ' tipos, ninguno afirma un permiso');

  /* Y el material creció porque el uso nuevo lo necesitaba: un pasacalle es
     de lona y una escultura puede ser de bronce. */
  const mats = (j03d.match(/\{ n:'([^']+)'/g) || []).map(x => x.slice(5, -1));
  const nuevos = ['Lona o tela', 'Bronce o fundición'].filter(m => mats.indexOf(m) < 0);
  comprobar('el material cubre lo que los usos nuevos necesitan',
    nuevos.length === 0 && j03d.indexOf(ARTE) >= 0 && j03d.indexOf(PUB) >= 0,
    nuevos.length ? 'falta el material: ' + nuevos.join(' · ')
      : (j03d.indexOf(ARTE) < 0 || j03d.indexOf(PUB) < 0) ? 'los usos nuevos no llevan el campo de material'
      : mats.length + ' materiales, y los dos usos lo llevan');
}

console.log('\n  -- lo que se mapea mirando al suelo (v982) --');
{
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j03b = soloCodigo(leer('js/03b-edificio-vocabulario.js'));
  const j03d = soloCodigo(leer('js/03d-mobiliario-material.js'));
  const j64 = soloCodigo(leer('js/64-analisis-edu.js'));
  const nrm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tipos = (() => {
    const i = j20.indexOf('const PROCITY_MATRIZ_USOS = [');
    if (i < 0) return [];
    const blk = j20.slice(i, j20.indexOf('\n  ];', i));
    return (blk.match(/'[^']+'/g) || []).map(x => x.slice(1, -1));
  })();

  comprobar('MATERIAL · se lee el catálogo de tipos',
    tipos.length > 500,
    tipos.length > 500 ? tipos.length + ' cadenas en el catálogo' : 'no se pudo leer PROCITY_MATRIZ_USOS');

  /* Lo que el reporte pidió por su nombre, y lo que se midió faltando al
     lado. Se persigue la PALABRA de la calle y no el nombre del tipo: un
     renombre no puede dejar el hueco abierto en silencio, que es la forma de
     la guarda que la v973 dejó para el árbol y la banca. */
  const sePuede = t => tipos.some(x => nrm(x).indexOf(nrm(t)) >= 0);
  const pedidos = ['hidrante', 'alcantarillado', 'sumidero', 'polideportivo',
                   'medidor', 'valvula', 'paso peatonal', 'rampa de accesibilidad',
                   'baranda', 'muro de contencion', 'gaviones'];
  const sinTipo = pedidos.filter(t => !sePuede(t));
  comprobar('lo que se mapea mirando al suelo tiene su tipo',
    sinTipo.length === 0,
    sinTipo.length ? 'sin tipo: ' + sinTipo.join(' · ') : 'los ' + pedidos.length + ' se pueden mapear');

  /* Un uso NUEVO toca CUATRO inventarios y basta olvidar uno para que quede
     roto en silencio: sin grupo solo aparece buscándolo, sin casilla en el
     análisis se puede mapear y el análisis lo descarta, y sin declararlo en
     el vocabulario del edificio hereda «es un edificio» y la ficha de una
     tapa de alcantarillado pregunta cuántos pisos tiene. Es literalmente lo
     que costó la v974. */
  const REDES = 'Redes en Vía (tapas y registros)';
  const enCuatro = {
    'catálogo': j20.indexOf("u:'" + REDES + "'") >= 0,
    'grupo': j20.indexOf("'" + REDES + "'") >= 0 && (j20.match(new RegExp("'" + REDES.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'", 'g')) || []).length >= 2,
    'análisis': j64.indexOf(REDES) >= 0,
    'sin pisos': j03b.indexOf(REDES) >= 0
  };
  const faltanInv = Object.keys(enCuatro).filter(k => !enCuatro[k]);
  comprobar('el uso nuevo está declarado en los CUATRO inventarios',
    faltanInv.length === 0,
    faltanInv.length ? 'falta en: ' + faltanInv.join(' · ')
                     : 'catálogo · grupo · análisis · sin pisos');

  /* Y lleva material, que es lo que distingue una tapa de hierro de una de
     concreto. El nombre tiene que ser el MISMO que en el catálogo o el campo
     queda apagado sin decirlo (v974). */
  comprobar('y lleva el campo de material, con el nombre exacto del catálogo',
    j03d.indexOf(REDES) >= 0 && j20.indexOf("u:'" + REDES + "'") >= 0,
    j03d.indexOf(REDES) >= 0 ? 'declarado en USOS_CON_MATERIAL con el mismo nombre'
      : 'no lleva material: una tapa de hierro y una de concreto se registran igual');

  /* Una coincidencia en el TIPO vale más que una que solo está en el nombre
     del USO. Sin esto, «tapa» devuelve «Hidrante» de primero, porque el
     nombre del uso casa para sus doce tipos por igual. */
  comprobar('el buscador prefiere el tipo antes que el nombre del uso',
    j20.indexOf('const enTipo = (x, t)') >= 0 && /rango\s*=\s*\(x, t\)\s*=>\s*\(enTipo/.test(j20),
    (j20.indexOf('const enTipo = (x, t)') >= 0 && /rango\s*=\s*\(x, t\)\s*=>\s*\(enTipo/.test(j20))
      ? 'el rango suma 2 por el tipo y 1 por empezar palabra'
      : 'el nombre del uso pesa igual que el del tipo: «tapa» devuelve el hidrante primero');
}

console.log('\n  -- el mobiliario urbano: postes y de qué está hecho (v981) --');
{
  const j03d = soloCodigo(leer('js/03d-mobiliario-material.js'));
  const j04  = soloCodigo(leer('js/04-marker-proximity.js'));
  const j10  = soloCodigo(leer('js/10-visible-markers.js'));
  const j12  = soloCodigo(leer('js/12-spa-ui.js'));
  const j20  = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const idx  = leer('index.html');
  const sw   = leer('service-worker.js');

  const lista = (src, desde) => {
    const i = src.indexOf(desde); if (i < 0) return [];
    const j = src.indexOf('];', i); if (j < 0) return [];
    return (src.slice(i, j).match(/'([^']+)'/g) || []).map(x => x.slice(1, -1));
  };
  const USOS_MAT = lista(j03d, 'var USOS_CON_MATERIAL =');
  const mobTipos = (() => {
    const m = j20.match(/\{ u:'Mobiliario Urbano'[^\n]*\}/);
    if (!m) return [];
    const t = m[0].match(/t:\[([^\]]*)\]/);
    return t ? (t[1].match(/'([^']+)'/g) || []).map(x => x.slice(1, -1)) : [];
  })();
  const usosCat = (j20.match(/\{ u:'([^']+)'/g) || []).map(x => x.slice(5, -1));

  const material = USOS_MAT.length > 0 && mobTipos.length > 0 && usosCat.length > 10;
  comprobar('MATERIAL · se leen el vocabulario, los tipos y el catálogo',
    material,
    material ? USOS_MAT.length + ' usos con material · ' + mobTipos.length + ' tipos de mobiliario · ' + usosCat.length + ' usos'
             : 'no se pudo leer: ' + [!USOS_MAT.length ? 'USOS_CON_MATERIAL' : '',
                 !mobTipos.length ? 'los tipos de Mobiliario Urbano' : '',
                 usosCat.length <= 10 ? 'el catálogo' : ''].filter(Boolean).join(' · '));

  /* Todo uso que lleve material tiene que EXISTIR en el catálogo. Un renombre
     allá dejaría el campo apagado en silencio, que es la forma exacta de la
     v974 —y la misma guarda que la v975 le puso a la especie—. */
  const huerfanos = USOS_MAT.filter(u => usosCat.indexOf(u) < 0);
  comprobar('todo uso que lleva material existe en el catálogo',
    huerfanos.length === 0,
    huerfanos.length ? huerfanos.join(' · ') + ' no está en la Matriz: el campo queda apagado sin decirlo'
                     : USOS_MAT.join(' · ') + ' está en el catálogo');

  /* Los postes son TIPOS y no un campo: lo que los separa es qué cargan
     —alumbrado del municipio, red del operador, transformador con su
     servidumbre—, y eso es otro objeto, no otra propiedad del mismo. */
  const postes = mobTipos.filter(t => /^Poste/.test(t));
  comprobar('los postes están en el catálogo, con sus casos separados',
    postes.length >= 4,
    postes.length >= 4 ? postes.length + ' tipos de poste' : 'solo ' + postes.length + ': los casos que el reporte nombra no se pueden mapear');

  /* Y el material NO se codifica como tipo. «Caneca metálica» y «Caneca
     plástica» como tipos multiplican el catálogo y rompen el conteo por
     tipo: el análisis tendría que sumar cuatro entradas que alguien debe
     acordarse de mantener juntas. Es la clase B, y por eso el material es un
     campo. */
  const tipoConMaterial = mobTipos.filter(t => /met[aá]lic|pl[aá]stic|de madera|de concreto\b/i.test(t));
  comprobar('y el material no se coló como tipo',
    tipoConMaterial.length === 0,
    tipoConMaterial.length ? tipoConMaterial.join(' · ') + ': eso es el campo, no un tipo'
                           : 'ningún tipo codifica de qué está hecho');

  /* UN solo selector de lista cerrada. La segunda copia era el 80 % del
     mismo código con otros ids, y la que se quedaría vieja sería la nueva. */
  const unSelector = j20.indexOf('function pintarLista(clave, q)') >= 0
    && j20.indexOf('LISTAS_CERRADAS') >= 0
    && (j20.match(/function pintarListaEspecies\(q\)\{ pintarLista/) || []).length === 1;
  comprobar('las dos fichas usan el MISMO selector de lista cerrada',
    unSelector,
    unSelector ? 'especie y material salen de pintarLista'
      : j20.indexOf('LISTAS_CERRADAS') < 0 ? 'no existe la tabla de listas: hay dos selectores'
      : 'pintarListaEspecies dejó de delegar');

  /* Se escribe, se lee y se pinta: sin cualquiera de las tres, el campo es
     una casilla que nadie ve o un dato que nadie guarda. */
  const escribe = j12.indexOf('guardarMaterialMobiliario') >= 0;
  const leeSlot = j04.indexOf('mobiliarioMaterial:') >= 0 && j04.indexOf('URBIS_MOBILIARIO = Object.assign') >= 0;
  const pinta = (j10.match(/URBIS_MOBILIARIO\.leer\(/g) || []).length >= 2;
  comprobar('el material se guarda, se lee y se pinta en las dos superficies',
    escribe && leeSlot && pinta,
    (escribe && leeSlot && pinta) ? 'js/12 lo escribe · js/04 lo lee · js/10 lo pinta en globo y ficha'
      : !leeSlot ? 'no hay casilla ni lector en js/04'
      : !escribe ? 'el formulario lo pregunta y nadie lo guarda'
      : 'se guarda y ninguna pantalla lo enseña: un dato que nadie alcanza');

  /* Y el archivo nuevo entra por las dos puertas. Sin el service worker, un
     teléfono con la aplicación instalada no lo descarga y el campo no sale
     —sin un solo error—. */
  const enIndex = idx.indexOf('js/03d-mobiliario-material.js') >= 0;
  const enSW = sw.indexOf('js/03d-mobiliario-material.js') >= 0;
  comprobar('el archivo nuevo está en index.html y en el service worker',
    enIndex && enSW,
    (enIndex && enSW) ? 'en las dos listas'
      : !enIndex ? 'falta en index.html: no carga en ninguna parte'
      : 'falta en el service worker: no carga en un teléfono con la app instalada');

  /* El buscador ordena lo que empieza palabra por delante. Lo destapó el
     papel: «poste» salía debajo de «Panadería / repostería». */
  /* Se mide la PROPIEDAD y no la línea: la primera versión citaba
     `abre.concat(resto)` —la implementación de ese día— y se puso roja en la
     v982, que ordena por rango en vez de partir en dos. Es la constante del
     material metida dentro de la comprobación (v890), cometida en la guarda
     de un buscador. Lo que tiene que seguir siendo cierto es que el camino
     de la frase entera ORDENE, y que el orden mire el inicio de palabra. */
  const ordena = j20.indexOf('const inicio = (x, t)') >= 0
    && j20.indexOf('const rango = (x, t)') >= 0
    && /if\(hits\.length\)\{[\s\S]{0,700}?rango\(/.test(j20);
  comprobar('el buscador ordena lo que encuentra, y no lo deja en el orden del catálogo',
    ordena,
    ordena ? 'la frase entera se ordena por rango (inicio de palabra y tipo)'
      : j20.indexOf('const inicio = (x, t)') < 0 ? 'no existe el criterio de inicio de palabra'
      : j20.indexOf('const rango = (x, t)') < 0 ? 'no existe el rango'
      : 'volvió a devolver en el orden del catálogo: «poste» cae debajo de «repostería»');
}

console.log('\n  -- el botón de GPS del mapa (v980) --');
{
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j20crudo = leer('js/20-mobile-functional-app.js');
  const c52 = leer('css/52-urbis-pro-city.css');
  const trozo = (src, desde, hasta) => {
    const i = src.indexOf(desde), j = src.indexOf(hasta, i + 1);
    return (i < 0 || j < 0) ? '' : src.slice(i, j + hasta.length);
  };
  const afinar = trozo(j20, 'function afinarGpsDesdeElMapa(){', '\n  }\n');
  const pinta  = trozo(j20, 'function pintarBotonGps(estado){', '\n  }\n');
  const tramo  = trozo(j20, 'function tramoDeGps(acc){', '\n  }\n');

  const material = !!(afinar && pinta && tramo)
    && j20crudo.indexOf('data-u52-call="procity-gps-afinar"') >= 0;
  comprobar('MATERIAL · el botón está en el mapa y sus tres funciones se leen',
    material,
    material ? 'el botón, afinarGpsDesdeElMapa, pintarBotonGps y tramoDeGps'
             : 'falta: ' + [
                 j20crudo.indexOf('data-u52-call="procity-gps-afinar"') < 0 ? 'el botón' : '',
                 !afinar ? 'afinarGpsDesdeElMapa' : '', !pinta ? 'pintarBotonGps' : '',
                 !tramo ? 'tramoDeGps' : ''].filter(Boolean).join(' · '));

  /* UNA sola rutina de afinado. El botón afina llamando a `mejorLecturaGps`
     —la de la v978— y no escribiendo su propio bucle: dos rutinas para un
     hecho se separan a la tanda siguiente, y lo que divergiría son los
     cortes que aquella derivó uno por uno en vez de inventarlos. */
  const unaSola = !!afinar && afinar.indexOf('mejorLecturaGps(') >= 0
    && afinar.indexOf('watchPosition') < 0 && afinar.indexOf('getCurrentPosition') < 0;
  comprobar('el botón afina por la misma rutina y no escribe la suya',
    unaSola,
    unaSola ? 'llama a mejorLecturaGps'
      : !afinar ? 'no se pudo leer afinarGpsDesdeElMapa'
      : afinar.indexOf('mejorLecturaGps(') < 0
      ? 'no llama a mejorLecturaGps'
      : 'abre su propio watch: son dos rutinas de afinado para un solo hecho');

  /* Y NO pone ningún punto. Mirar en cuánto anda la señal y dejar caer un
     punto que nadie pidió son cosas distintas: poner el punto es el otro
     botón, «Mi ubicación». Mezclarlos haría que asomarse al GPS ensuciara
     el mapa. */
  const noPone = !!afinar && afinar.indexOf('pickProCityPoint(') < 0;
  comprobar('y mirar la señal no deja un punto que nadie pidió',
    noPone,
    noPone ? 'no llama a pickProCityPoint' : 'pone un punto al afinar: eso es el otro botón');

  /* La cifra no se inventa. Una lectura vieja presentada como la de ahora
     —«±8 m» de hace diez minutos, parado en otra cuadra— es declarar mal la
     procedencia de un número, que es la falta más cara de este proyecto. */
  const vigente = !!pinta && pinta.indexOf('lecturaVigente(') >= 0;
  comprobar('la cifra del botón es de una lectura vigente, no de cualquiera',
    vigente,
    vigente ? 'pasa por lecturaVigente' : 'lee la última lectura sin mirar su edad');

  /* Y los tramos son los de la v978. Un cuarto corte inventado para pintar
     un botón diría en verde lo que el resto del módulo llama dudoso. */
  const sinNumeros = !!tramo && !/[<>]=?\s*\d/.test(tramo)
    && tramo.indexOf('GPS_BUENO_M') >= 0 && tramo.indexOf('GPS_INSERVIBLE_M') >= 0;
  comprobar('los tres tramos salen de los cortes ya derivados, sin números nuevos',
    sinNumeros,
    sinNumeros ? 'compara contra GPS_BUENO_M y GPS_INSERVIBLE_M'
      : !tramo ? 'no se pudo leer tramoDeGps'
      : /[<>]=?\s*\d/.test(tramo)
      ? 'compara contra un número escrito a mano: es un cuarto corte que nadie derivó'
      : 'dejó de leer los cortes del módulo');

  /* El topbar tiene las columnas ESCRITAS A MANO. Con el botón adentro y sin
     declarar la quinta, la fila se parte y el botón de centrar se va a un
     segundo renglón: medido con la sonda, el topbar pasaba de 48 a 120 px. */
  const enLaFila = j20crudo.indexOf('u52-mapcentric-topbar') >= 0
    && trozo(j20crudo, '<header class="u52-mapcentric-topbar"', '</header>').indexOf('procity-gps-afinar') >= 0;
  const quinta = /u52-procity-mapscreen[^{]*u52-mapcentric-topbar\s*\{[^}]*grid-template-columns:[^;]*54px\s+1fr\s+54px\s+\d+px\s+54px/.test(c52);
  comprobar('si el botón va en la fila de arriba, la quinta columna está declarada',
    !enLaFila || quinta,
    (!enLaFila || quinta)
      ? (enLaFila ? 'la rejilla de Pro City declara sus cinco columnas' : 'el botón no va en la fila')
      : 'el botón está en el topbar y la rejilla sigue en cuatro columnas: la fila se parte');

  /* Guarda de la guarda: sin repintar con cada lectura del reloj del GPS, el
     botón se queda con la cifra del momento en que se entró al mapa — y una
     cifra vieja presentada como la de ahora es justo lo que las dos de
     arriba vienen a impedir (v878). */
  const alLlegar = trozo(j20, 'function onMobileGpsPoint(pos){', '\n  }\n');
  comprobar('y el botón se repinta con cada lectura que llega',
    !!alLlegar && alLlegar.indexOf('pintarBotonGps(') >= 0,
    (!!alLlegar && alLlegar.indexOf('pintarBotonGps(') >= 0)
      ? 'onMobileGpsPoint lo repinta'
      : 'onMobileGpsPoint dejó de repintarlo: la cifra se congela en la de al entrar');
}

console.log('\n  -- el árbol al que le falta la especie (v979) --');
{
  const j04 = soloCodigo(leer('js/04-marker-proximity.js'));
  const j10 = soloCodigo(leer('js/10-visible-markers.js'));
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const c83 = leer('css/83-moderacion-foto.css');

  const trozo = (src, desde, hasta) => {
    const i = src.indexOf(desde), j = src.indexOf(hasta, i + 1);
    return (i < 0 || j < 0) ? '' : src.slice(i, j + hasta.length);
  };
  const cuerpo = trozo(j04, 'pendiente: function (descripcion) {', '\n    },');

  /* MATERIAL primero (v920): sin la función, todo lo de abajo se cumpliría
     sobre la nada. */
  comprobar('MATERIAL · se lee la función que decide si a un árbol le falta la especie',
    !!cuerpo && j04.indexOf('pendientesDe: function') >= 0,
    !!cuerpo ? 'URBIS_ARBOL.pendiente y URBIS_ARBOL.pendientesDe'
             : 'no se pudo leer URBIS_ARBOL.pendiente');

  /* Las TRES superficies preguntan lo mismo. El globo, la ficha del punto y
     la lista de «Mis mapeos» tienen que marcar exactamente los mismos
     árboles: tres recorridos con su propio criterio se separan a la tanda
     siguiente, y el que se quedaría viejo sería el de la lista —que es
     justo el que permite volver días después—. */
  const usos = (j10.match(/URBIS_ARBOL\.pendiente\(/g) || []).length
             + (j20.match(/URBIS_ARBOL\.pendiente\(/g) || []).length;
  comprobar('las tres superficies preguntan por la misma función',
    usos >= 3,
    usos >= 3 ? usos + ' llamadas a URBIS_ARBOL.pendiente'
              : 'solo ' + usos + ': alguna superficie decide por su cuenta');

  /* Y NINGUNA marca se pinta sin haber preguntado. La primera versión de
     esta comprobación buscaba comparaciones contra «No se sabe» y denunció
     el formulario, que lo que hace es OFRECER esa opción —legítimo—: una
     guarda con falsos positivos termina en una lista de excepciones que
     envejece hasta no significar nada (v895). Lo que sí discrimina sin
     ninguno es atar la MARCA a la pregunta: quien pinte «sin especie» tiene
     que haber llamado a `pendiente` en el mismo archivo. Así, una cuarta
     superficie con su propio criterio sale en rojo — y ese criterio propio
     es donde se pierde que «No se sabe» es una respuesta y no un pendiente.

     De qué NO responde, dicho: caza una marca en un archivo que NUNCA
     pregunta. Una segunda criteriología DENTRO de un archivo que sí
     pregunta se le escapa —la de arriba, que cuenta las llamadas, es la que
     la caza—. Y el token va completo con su paréntesis: `pendientesDe`
     empieza igual, así que buscando `pendiente` a secas el recuento hacía
     pasar a la marca. */
  const MARCAS = [['popup-especie-falta', j10], ['detalle-especie-falta', j10],
                  ['u52-procity-mine-falta', j20], ['u52-procity-mine-faltan', j20]];
  const sinPreguntar = MARCAS
    .filter(([cls, src]) => src.indexOf(cls) >= 0
      && src.indexOf('URBIS_ARBOL.pendiente(') < 0 && src.indexOf('URBIS_ARBOL.pendientesDe(') < 0)
    .map(([cls]) => cls);
  const marcasPuestas = MARCAS.filter(([cls, src]) => src.indexOf(cls) >= 0).length;
  comprobar('ninguna marca de «sin especie» se pinta sin preguntarle a esa función',
    sinPreguntar.length === 0 && marcasPuestas === MARCAS.length,
    sinPreguntar.length ? sinPreguntar.join(' · ') + ' se pinta con criterio propio'
      : marcasPuestas < MARCAS.length
      ? 'faltan marcas por pintar: ' + marcasPuestas + ' de ' + MARCAS.length
      : 'las ' + marcasPuestas + ' marcas salen de preguntarle a pendiente');

  /* El recuento delega. Con su propio recorrido, la cifra del banner y las
     marcas de las tarjetas podrían no cuadrar en la misma pantalla. */
  const cuenta = trozo(j04, 'pendientesDe: function (lista) {', '\n    }\n  });');
  comprobar('el recuento cuenta lo mismo que se marca',
    !!cuenta && cuenta.indexOf('URBIS_ARBOL.pendiente(') >= 0,
    (!!cuenta && cuenta.indexOf('URBIS_ARBOL.pendiente(') >= 0)
      ? 'pendientesDe delega en pendiente'
      : 'pendientesDe lleva su propio criterio: el banner y las marcas pueden no cuadrar');

  /* Guarda de la guarda: si `pendiente` dejara de mirar el uso, marcaría una
     banca; si dejara de leer el registro, marcaría todo o nada. Las dos
     seguirían con todo lo de arriba en verde (v878). */
  /* Y desde la v994 mira el TIPO además del uso: un «Alcorque vacío» se
     marcaba «Sin especie anotada» sobre un hueco en el que no hay ningún
     árbol. La comprobación se aprieta, no se afloja: ahora exige los dos. */
  const cuerpoPend = trozo(j04, 'pendiente: function (descripcion) {', '\n    },');
  const miraUso = !!cuerpoPend && /tieneEspecie\(\s*uso\s*,\s*tipo\s*\)/.test(cuerpoPend);
  const miraReg = !!cuerpoPend && cuerpoPend.indexOf('.leer(') >= 0;
  comprobar('y la función sigue mirando el uso, el TIPO y lo guardado',
    miraUso && miraReg,
    (miraUso && miraReg) ? 'decide con los dos y lee el registro'
      : !cuerpoPend ? 'no se pudo leer pendiente'
      : !miraUso ? 'no decide con el uso y el tipo: marcaría una banca, o un alcorque vacío'
      : 'no lee el registro: marcaría todo o nada')

  /* El aviso de la FICHA va sobre fondo oscuro y con la misma especificidad
     que `.detalle-especie`: escrito antes, esa regla —más abajo en el
     archivo— se lo come sin decir nada, y el ámbar no se ve. Costó una
     vuelta y por eso queda medido. */
  const iBase  = c83.indexOf('.detalle-especie{');
  const iFalta = c83.indexOf('.detalle-especie.detalle-especie-falta{');
  comprobar('el aviso de la ficha se pinta después del verde que si no se lo come',
    iBase >= 0 && iFalta > iBase,
    (iBase >= 0 && iFalta > iBase) ? 'va después de .detalle-especie'
      : iFalta < 0 ? 'no existe la regla del aviso en la ficha'
      : 'va antes de .detalle-especie: misma especificidad, gana la de abajo y el ámbar no se ve');
}

console.log('\n  -- la precisión del GPS al ubicar un punto (v978) --');
{
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  /* `trozo` de los otros bloques está en SU ámbito. Se repite acá en vez de
     subirlo a nivel de módulo porque subir un ayudante que otros bloques ya
     tienen escrito de otra manera sería cambiar comprobaciones que no son
     de esta tanda. */
  const trozo = (src, desde, hasta) => {
    const i = src.indexOf(desde), j = src.indexOf(hasta, i + 1);
    return (i < 0 || j < 0) ? '' : src.slice(i, j + hasta.length);
  };
  const cuerpo = trozo(j20, 'function mejorLecturaGps(', '\n  }\n');
  const begin  = trozo(j20, 'function beginProCityLocationGps(', '\n  }\n');
  const pick   = trozo(j20, 'function pickProCityPoint(', '\n  }\n');
  const marca  = trozo(j20, 'function renderCommunityPickMarker(', '\n  }\n');

  /* MATERIAL primero (v920): sin los cuatro trozos, todo lo de abajo se
     cumpliría sobre la nada. */
  const material = !!(cuerpo && begin && pick && marca);
  comprobar('MATERIAL · se leen las cuatro funciones que ubican un punto',
    material,
    material ? 'mejorLecturaGps · beginProCityLocationGps · pickProCityPoint · renderCommunityPickMarker'
             : 'no se pudo leer: ' + ['mejorLecturaGps','beginProCityLocationGps','pickProCityPoint','renderCommunityPickMarker']
                 .filter((_, i) => ![cuerpo, begin, pick, marca][i]).join(' · '));

  /* 1 · EL PRIMER ARREGLO ES EL PEOR. Un teléfono devuelve una SECUENCIA de
     lecturas, no una posición: la primera suele ser de antena o de wifi y
     mejora en segundos. Tomar la primera es tomar la peor, que es el punto
     que «se va para otro lado». Así que el camino del GPS no puede volver a
     `getCurrentPosition`. Falla CERRADO: un camino nuevo que tome la primera
     sale en rojo en su primera corrida (v880). */
  comprobar('el botón de GPS no se queda con el PRIMER arreglo',
    begin.indexOf('getCurrentPosition') < 0 && begin.indexOf('mejorLecturaGps(') >= 0,
    begin.indexOf('getCurrentPosition') >= 0
      ? 'volvió a getCurrentPosition: eso publica la primera lectura, que es la peor'
      : begin.indexOf('mejorLecturaGps(') < 0
      ? 'no llama a mejorLecturaGps: nadie está afinando la lectura'
      : 'afina con mejorLecturaGps');

  /* 2 · UN ERROR TRANSITORIO NO CIERRA LA VENTANA. Es el corazón del
     arreglo y lo destapó la sonda: llega ±420, un POSITION_UNAVAILABLE, y
     detrás ±95 y ±7. Cerrando en el error se congela la PEOR. Lo único
     terminal es el permiso negado (código 1), que no puede resolverse solo. */
  /* Se mide el CUERPO de la rama de error, no que la línea del código 1 esté
     escrita en alguna parte: con una ventana de caracteres, un `terminar()`
     puesto delante y separado por el comentario se colaba —pasó al demostrar
     en rojo, y una guarda que no muerde es un verde (v878)—. La rama va de
     `}, function(err){` a las opciones del watch, y dentro de ella NINGÚN
     `terminar()` es aceptable: cerrar ahí congela la peor lectura. */
  const ramaErr = (() => {
    const i = cuerpo.indexOf('}, function(err){');
    if (i < 0) return '';
    const j = cuerpo.indexOf('}, { enableHighAccuracy', i);
    return j < 0 ? '' : cuerpo.slice(i, j);
  })();
  const soloPermiso = !!ramaErr && /\(\s*err\s*&&\s*err\.code\s*\)\s*!==\s*1\s*\)\s*return\s*;/.test(ramaErr);
  const cierraEnError = !ramaErr || ramaErr.indexOf('terminar(') >= 0;
  comprobar('un error transitorio no cierra la ventana: solo lo hace el permiso negado',
    soloPermiso && !cierraEnError,
    (soloPermiso && !cierraEnError) ? 'solo el código 1 la cierra'
      : !ramaErr
      ? 'no se pudo leer la rama de error de mejorLecturaGps'
      : !soloPermiso
      ? 'la rama de error no se limita al código 1: un bache de señal congela la peor lectura'
      : 'cierra con terminar() dentro de la rama de error: vuelve a congelar la peor lectura');

  /* 3 · LA FRESCURA ES UNA SOLA. `maximumAge:0` rechaza el arreglo que el
     teléfono ya tiene y espera uno nuevo: de pie y quieto puede no llegar
     ninguno, y se tira una lectura que servía. El número no se inventa: es
     el mismo con el que `beginProCityLocationGps` decide si la lectura
     guardada todavía vale. Dos constantes para un hecho se separan (v879). */
  const frescaOk = /maximumAge\s*:\s*GPS_FRESCA_MS/.test(cuerpo) && begin.indexOf('GPS_FRESCA_MS') >= 0;
  comprobar('la ventana no pide un arreglo recién hecho, y la frescura se lee de un solo sitio',
    frescaOk,
    frescaOk ? 'la ventana y el arreglo guardado usan el mismo GPS_FRESCA_MS'
      : /maximumAge\s*:\s*0/.test(cuerpo)
      ? 'maximumAge volvió a cero: tira la lectura que el teléfono ya tiene'
      : !/maximumAge\s*:\s*GPS_FRESCA_MS/.test(cuerpo)
      ? 'la ventana usa otra frescura que la del arreglo guardado: son dos números para un hecho'
      : 'beginProCityLocationGps dejó de leer GPS_FRESCA_MS');

  /* 4 · LA PRECISIÓN ENTRA CON EL PUNTO. Escrita después, la hoja de
     categorías —que `pickProCityPoint` abre en su último renglón— ya se
     compuso sin ella y la banda sale vacía: medido con la sonda. */
  const entraConElPunto = /function pickProCityPoint\(\s*lat\s*,\s*lng\s*,\s*acc\s*\)/.test(j20)
      && /proCity\.gpsAccuracy\s*=/.test(pick)
      && /pickProCityPoint\(\s*lat\s*,\s*lng\s*,\s*acc\s*\)/.test(begin);
  comprobar('la precisión entra con el punto, no se le pega después',
    entraConElPunto,
    entraConElPunto ? 'pickProCityPoint la recibe y la guarda antes de componer la hoja'
      : !/function pickProCityPoint\(\s*lat\s*,\s*lng\s*,\s*acc\s*\)/.test(j20)
      ? 'pickProCityPoint no recibe la precisión: la banda se compone antes de saberla'
      : !/proCity\.gpsAccuracy\s*=/.test(pick)
      ? 'pickProCityPoint no la guarda'
      : 'el camino del GPS no se la pasa');

  /* 5 · LA PROMESA IMPRESA SE CUMPLE. La banda manda a arrastrar el alfiler;
     un alfiler que no se arrastra convierte esa frase en mentira (v892). Y
     el arrastre tiene que ESCRIBIR el punto: mover el dibujo y dejar la
     coordenada vieja sería peor que no dejar arrastrarlo. */
  const arrastreOk = /draggable\s*:\s*true/.test(marca) && /on\(\s*'dragend'/.test(marca)
      && /proCity\.selected\s*=/.test(marca) && /proCity\.movidoAMano\s*=\s*true/.test(marca);
  comprobar('el alfiler se arrastra y el arrastre escribe el punto',
    arrastreOk,
    arrastreOk ? 'arrastrable, y al soltarlo escribe la coordenada y la marca de corregido a mano'
      : !/draggable\s*:\s*true/.test(marca)
      ? 'el alfiler no es arrastrable, y la banda dice que lo arrastre'
      : !/on\(\s*'dragend'/.test(marca)
      ? 'se arrastra y nadie escucha dónde quedó'
      : !/proCity\.selected\s*=/.test(marca)
      ? 'el arrastre mueve el dibujo y no el punto: la coordenada se queda vieja'
      : 'no marca que el punto se corrigió a mano');

  /* 6 · LA BANDA LLEGA A LAS DOS SUPERFICIES. La barra del mapa NO sirve:
     medido con la sonda, en cuanto se pone el punto la hoja de categorías la
     tapa. Un dato medido al que ninguna pantalla alcanza se ve igual que un
     dato ausente. */
  const bandas = (j20.match(/\$\{avisoDePrecisionHTML\(\)\}/g) || []).length;
  const pintaOk = bandas >= 2 && j20.indexOf('function avisoDePrecisionHTML(') >= 0;
  comprobar('la precisión se pinta donde el punto se ve, y por una sola función',
    pintaOk,
    pintaOk ? bandas + ' superficies la pintan, todas por avisoDePrecisionHTML'
      : bandas < 2
      ? 'solo ' + bandas + ' superficie la pinta: con la hoja encima, el aviso queda sin lector'
      : 'no existe avisoDePrecisionHTML: las dos redacciones se separan a la tanda siguiente');

  /* Y la guarda de la guarda: si la banda dejara de leer lo que el punto
     guarda, todo lo de arriba seguiría en verde sobre un aviso que no dice
     nada (v878). */
  const banda = trozo(j20, 'function avisoDePrecisionHTML(', '\n  }\n');
  const leeOk = !!banda && banda.indexOf('proCity.gpsAccuracy') >= 0 && banda.indexOf('proCity.movidoAMano') >= 0;
  comprobar('y la banda sigue leyendo la precisión y la corrección del punto',
    leeOk,
    leeOk ? 'lee las dos cosas del punto'
      : !banda ? 'no se pudo leer avisoDePrecisionHTML'
      : banda.indexOf('proCity.gpsAccuracy') < 0
      ? 'dejó de leer la precisión: imprimiría lo mismo siempre'
      : 'dejó de leer si el punto se corrigió a mano');
}

console.log('\n  -- lo que la fila guarda y el panel de Pro City enseña (v985) --');
{
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j12 = soloCodigo(leer('js/12-spa-ui.js'));
  const css = leer('css/52-urbis-pro-city.css');

  /* MATERIAL primero (v920): si no se leen las dos piezas, todo lo de abajo
     pasaría sobre la nada. */
  const hayPanel = j20.indexOf('function showProCitySelectedPanel(') !== -1;
  const hayFicha = j20.indexOf('function fichaDeProCity(') !== -1;
  comprobar('MATERIAL · se leen el panel del punto y la ficha que lo llena',
    hayPanel && hayFicha,
    'showProCitySelectedPanel ' + (hayPanel ? 'sí' : 'NO') + ' · fichaDeProCity ' + (hayFicha ? 'sí' : 'NO'));

  if (hayPanel && hayFicha) {
    const i = j20.indexOf('function fichaDeProCity('), j = j20.indexOf('\n  }', i);
    const cuerpo = j20.slice(i, j);

    /* Los puntos de Pro City NO pasan por el globo de js/10: `pintarPuntos`
       los salta y los dibuja `renderProCityPoints`, cuyo toque abre este
       panel. Así que lo que la fila guarda tiene que llegar ACÁ o no llega a
       ninguna parte — que desde afuera se ve igual que no estar (clase C). */
    const salta = /urbisEsCategoriaProCity\(p\.tipo\)\)\s*\{\s*return/.test(j12);
    comprobar('MATERIAL · el globo de js/10 no dibuja los puntos de Pro City',
      salta,
      salta ? 'pintarPuntos los salta, así que este panel es su única superficie'
            : 'pintarPuntos ya NO los salta: esta sección estaría midiendo otra cosa');

    const pinta = j20.indexOf('${fichaDeProCity(p, d)}') !== -1;
    comprobar('el panel del punto enseña lo que la fila guarda',
      pinta, pinta ? 'el panel llama a fichaDeProCity' : 'la ficha se calcula y NO se pinta');

    const faltan = [];
    if (!/urbisFotoDeReporte\(/.test(cuerpo)) faltan.push('la foto');
    if (!/d\[2\]/.test(cuerpo)) faltan.push('la nota');
    if (!/URBIS_ARBOL\.leer\(/.test(cuerpo)) faltan.push('la especie');
    if (!/URBIS_MOBILIARIO\.leer\(/.test(cuerpo)) faltan.push('el material');
    comprobar('las cuatro salen, y ninguna por un criterio propio',
      faltan.length === 0,
      faltan.length ? 'no llegan al panel: ' + faltan.join(' · ')
                    : 'foto por urbisFotoDeReporte · nota · especie por URBIS_ARBOL · material por URBIS_MOBILIARIO');

    /* La que de verdad guarda. La foto de un reporte Pendiente la ven solo su
       autor y el moderador (v829): leer la casilla en crudo acá publicaría sin
       moderar la foto de cualquiera, y el código se vería perfectamente bien. */
    const cruda = /d\[\s*BASE_OFFSET\s*\]/.test(cuerpo) || /URBIS_SLOTS\.foto/.test(cuerpo);
    comprobar('y la foto pasa por el portero, no por la casilla en crudo',
      !cruda && /urbisFotoDeReporte\(/.test(cuerpo),
      cruda ? 'lee la casilla directo: publicaría sin moderar la foto de un reporte Pendiente'
            : 'la decide urbisFotoDeReporte, que es quien sabe si está Pendiente');

    /* El árbol al que le falta la especie se marca solo a su autor (v979), y
       preguntándole a la misma función y no a un criterio nuevo. */
    const pend = /URBIS_ARBOL\.pendiente\(/.test(cuerpo) && /esAutorDelReporte\(/.test(cuerpo);
    comprobar('el «sin especie» se marca por la misma función y solo a su autor',
      pend, pend ? 'pregunta por URBIS_ARBOL.pendiente y por el autor'
                 : 'o no lo marca, o lo decide por su cuenta');

    /* Lo que salió mirando la captura y no leyendo el CSS: el aviso de «foto
       en revisión» lo escribe js/05 sin fijar color, y esta tarjeta es BLANCA
       —en el globo y en la ficha hereda claro sobre oscuro—. Sin una regla
       propia, el texto sale invisible y solo se ve la lupa. Es el mismo
       defecto de la v979 con el ámbar sobre fondo oscuro, por el otro lado. */
    const color = /\.u52-procity-selpanel-card\s+\.foto-en-revision\s*\{[^}]*color:/.test(css.replace(/\s+/g, ' '));
    comprobar('el aviso de foto en revisión tiene color en esta tarjeta clara',
      color,
      color ? 'la tarjeta le fija su propio color'
            : 'hereda: sobre fondo blanco el texto sale invisible y solo se ve la lupa');

    /* Y el aspecto de una foto que se está revisando lo decide UN sitio: dos
       tratamientos se separan y uno deja de distinguirse de una publicada. */
    const c83 = leer('css/83-moderacion-foto.css').replace(/\s+/g, ' ');
    const unSitio = /\.popup-foto-en-revision,[^{]*u52-procity-selpanel-foto\.en-revision/.test(c83);
    comprobar('la foto en revisión se marca igual en todas las superficies',
      unSitio,
      unSitio ? 'el panel entra en la misma regla de css/83'
              : 'el panel estrena un tratamiento propio: se separarán');
  }
}

console.log('\n  -- la foto que ya tenía el reporte, al editarlo (v986) --');
{
  const j05 = soloCodigo(leer('js/05-helpers-temporal-security.js'));
  const j11 = soloCodigo(leer('js/11-report-form.js'));
  const j12 = soloCodigo(leer('js/12-spa-ui.js'));
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));

  /* MATERIAL primero (v920): sin las dos piezas, todo lo de abajo pasaría
     sobre la nada. */
  const hayBloque = /function urbisBloqueFotoGuardada\(/.test(j05);
  const hayQuitar = /function urbisQuitarFotoGuardada\(/.test(j05);
  comprobar('MATERIAL · se leen el carrero de la foto guardada y su botón de quitar',
    hayBloque && hayQuitar,
    'urbisBloqueFotoGuardada ' + (hayBloque ? 'sí' : 'NO') + ' · urbisQuitarFotoGuardada ' + (hayQuitar ? 'sí' : 'NO'));

  if (hayBloque && hayQuitar) {
    /* Lo medido: al editar, ninguno de los dos formularios traía la foto
       guardada, `enviarDatos` la resolvía en «N/A» y la fusión la escribía
       encima de la que había. La foto no se escondía: se DESTRUÍA en la
       primera edición.

           origFoto   data:image/svg+xml;base64,PHN2…
           nuevaFoto  N/A
           salidaFoto N/A                                                */
    const idx = j12.indexOf("document.getElementById('ins-foto').value");
    const tramo = idx >= 0 ? j12.slice(idx, idx + 600) : '';
    const resuelve = /ins-foto-actual/.test(tramo);
    comprobar('la foto que ya había entra en la resolución de enviarDatos',
      resuelve,
      resuelve ? 'un archivo nuevo manda; después el enlace tecleado; después la que había'
        : idx < 0 ? 'no se pudo leer la resolución de la foto en enviarDatos'
        : 'no lee el carrero: al editar, la foto guardada se resuelve en «N/A» y se destruye');

    /* Falla CERRADO: un formulario de edición nuevo que no pinte el carrero
       pierde fotos en silencio, que es exactamente como llegó esto. Lo que
       no lo necesite lo dice con su marca, que es la forma de la guarda del
       voseo en -á (v880): se lista lo permitido y se denuncia lo demás. */
    const sinCarrero = [];
    [['js/11-report-form.js', j11], ['js/20-mobile-functional-app.js', j20]].forEach(function (par) {
      const arch = par[0], txt = par[1];
      let k = txt.indexOf('id="ins-foto"');
      while (k >= 0) {
        const linea = txt.slice(0, k).split('\n').length;
        const vecindad = txt.slice(k, k + 3000);
        /* La marca no es una palabra: vale solo si ese formulario DECLARA que
           no edita. El día que aprenda a editar, la excepción se cae sola. */
        const alrededor = txt.slice(Math.max(0, k - 4000), k + 3000);
        const pegada = txt.slice(Math.max(0, k - 500), k + 3000);
        const exento = /sin-carrero:/.test(pegada) && /isEdit:\s*false/.test(alrededor);
        if (!/urbisBloqueFotoGuardada/.test(vecindad) && !exento) {
          sinCarrero.push(arch + ':' + linea);
        }
        k = txt.indexOf('id="ins-foto"', k + 1);
      }
    });
    comprobar('todo formulario con foto trae la que ya había, o dice por qué no',
      sinCarrero.length === 0,
      sinCarrero.length ? 'pierde la foto al editar: ' + sinCarrero.join(' · ')
                        : 'los formularios de foto llevan el carrero o su marca');

    /* Quitar es un acto explícito, y por eso tiene que limpiar TODO lo que
       podría devolver la foto. Con cualquiera de esos campos vivo, «quitar»
       no quitaría nada y la pantalla diría que sí — la señal de éxito que no
       lo es. */
    const iq = j05.indexOf('function urbisQuitarFotoGuardada(');
    const cq = iq >= 0 ? j05.slice(iq, j05.indexOf('\n  }', iq)) : '';
    const olvida = [];
    if (!/ins-foto-actual/.test(cq)) olvida.push('el carrero');
    if (!/getElementById\('ins-foto'\)/.test(cq)) olvida.push('el enlace tecleado');
    if (!/ins-foto-file-cam/.test(cq)) olvida.push('la cámara');
    comprobar('quitar la foto limpia todo lo que podría devolverla',
      olvida.length === 0,
      olvida.length ? 'se le queda vivo: ' + olvida.join(' · ') + ' — diría que la quitó sin quitarla'
                    : 'limpia el carrero, el enlace y los dos campos de archivo');

    /* Con una foto nueva elegida, «si no toca nada se queda como está» es
       falso. Los dos caminos por los que entra un archivo lo dicen. */
    const avisa11 = /urbisFotoGuardadaAlElegir\(/.test(j05);
    const avisa20 = /urbisFotoGuardadaAlElegir\(/.test(j20);
    comprobar('el pie deja de decir «se queda como está» con una foto nueva',
      avisa11 && avisa20,
      (avisa11 && avisa20) ? 'lo avisan los dos caminos de archivo'
        : 'no lo avisa: ' + [!avisa11 ? 'el ciudadano' : '', !avisa20 ? 'Pro City' : ''].filter(Boolean).join(' · '));

    /* GUARDA DE LA GUARDA: si el id del carrero cambiara en un lado, todo lo
       de arriba seguiría en verde sobre un carrero que nadie lee. */
    const ib = j05.indexOf('function urbisBloqueFotoGuardada(');
    const cb = ib >= 0 ? j05.slice(ib, j05.indexOf('\n  }', ib)) : '';
    const mismoId = /id="ins-foto-actual"/.test(cb);
    comprobar('y el carrero que se pinta es el mismo que enviarDatos lee',
      mismoId,
      mismoId ? 'los dos hablan de ins-foto-actual'
              : 'el bloque pinta otro id: la resolución leería un campo que no existe');

    /* Guarda contra pasarse: un «ya tiene una foto» sobre un mapeo que no la
       tiene sería la mentira contraria. */
    const calla = /if\s*\(\s*!f\s*\|\|\s*f\s*===\s*'N\/A'\s*\)\s*return\s*''/.test(cb);
    comprobar('y sin foto guardada el bloque no se pinta',
      calla,
      calla ? 'sin foto devuelve vacío' : 'pintaría «ya tiene una foto» sobre un mapeo que no la tiene');
  }
}

console.log('\n  -- el zoom con el que se coloca un punto a mano (v987) --');
{
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j03 = soloCodigo(leer('js/03-map-data-config.js'));
  const c99 = leer('css/99-mobile-clean-core.css');

  /* MATERIAL primero (v920): las dos puertas que COLOCAN un punto para mapear
     existen y ponen el alfiler. Sin ellas, todo lo de abajo pasaría por no
     tener nada que mirar. */
  const puertas = ['pickProCityPoint', 'pickCommunityPoint'].filter(f =>
    new RegExp('function\\s+' + f + '\\s*\\(').test(j20));
  /* Con el paréntesis a secas, el patrón contaba también la DECLARACIÓN de la
     función —y como la puerta se define seiscientos caracteres antes, la
     comprobación de abajo la daba por buena—: una guarda pasando por un
     llamador que no existe. Se cierra con el punto y coma, que la declaración
     no tiene. */
  const LLAMADA = 'renderCommunityPickMarker(lat, lng);';
  const ponenAlfiler = j20.split(LLAMADA).length - 1;
  if (puertas.length !== 2 || ponenAlfiler < 2) {
    anotarSinMaterial('MATERIAL · las dos puertas que colocan un punto ponen el alfiler',
      'puertas: ' + puertas.join(', ') + ' · alfileres: ' + ponenAlfiler);
  } else {
    comprobar('MATERIAL · las dos puertas que colocan un punto ponen el alfiler',
      true, puertas.join(' y ') + ', con ' + ponenAlfiler + ' alfileres');

    /* ── El alfiler es la PROMESA de precisión, así que donde aparece el
       zoom tiene que hacerla posible (v978 lo hizo arrastrable; la v986 lo
       dejaba caer en z17, donde un andén mide 1,3 px). Falla CERRADO: una
       puerta nueva que ponga el alfiler y se quede en su propio zoom sale en
       rojo en su primera composición, no tres tandas después. */
    const sinPuerta = [];
    let k = -1;
    while ((k = j20.indexOf(LLAMADA, k + 1)) >= 0) {
      /* se mira el renglón de ANTES, que es donde el llamador encuadra */
      const antes = j20.slice(Math.max(0, k - 600), k);
      if (!/acercarParaColocar\s*\(/.test(antes)) {
        sinPuerta.push('en el carácter ' + k);
      }
    }
    comprobar('todo el que pone el alfiler encuadra por la puerta del zoom de trabajo',
      sinPuerta.length === 0,
      sinPuerta.length ? 'se queda en su propio zoom: ' + sinPuerta.join(', ') +
                         ' — el alfiler se puede arrastrar y no habría dónde ponerlo'
                       : ponenAlfiler + ' puertas por acercarParaColocar');

    /* Guarda de la guarda: sin esto, las dos seguirían llamando a la puerta y
       la puerta podría no mirar el zoom de trabajo (v878). */
    const ip = j20.indexOf('function acercarParaColocar(');
    const cuerpo = ip >= 0 ? j20.slice(ip, j20.indexOf('\n  }', ip)) : '';
    const lee = /ZOOM_TRABAJO/.test(cuerpo) && /Math\.max/.test(cuerpo);
    comprobar('y la puerta encuadra al MENOS en el zoom de trabajo, sin bajar el que ya haya',
      lee,
      lee ? 'Math.max(zoom actual, ZOOM_TRABAJO)'
          : 'la puerta no mira ZOOM_TRABAJO: encuadraría donde le parezca');

    /* ── El número no es a ojo, y esto lo MIDE en vez de leer su comentario
       (v890). El zoom de trabajo tiene que ser aquel en el que el círculo de
       una lectura BUENA de GPS —12 m, la cifra que la v978 derivó— sea MAYOR
       que el alfiler que se le pone encima, o la imprecisión que hay que
       corregir queda debajo del propio alfiler y no se ve. */
    const mz = j20.match(/const\s+ZOOM_TRABAJO\s*=\s*(\d+)/);
    const z = mz ? Number(mz[1]) : null;
    const LAT = 7.9;                                   // Cúcuta
    const mpp = zz => 156543.03392 * Math.cos(LAT * Math.PI / 180) / Math.pow(2, zz);
    const pxDeLos12 = zz => 12 / mpp(zz);
    const ALFILER = 58;                                 // iconSize del marcador
    const ok = z !== null && pxDeLos12(z) > ALFILER && pxDeLos12(z - 1) <= ALFILER;
    comprobar('el zoom de trabajo es el primero en el que los 12 m de una lectura buena NO caben bajo el alfiler',
      ok,
      z === null ? 'no se pudo leer ZOOM_TRABAJO'
                 : 'z' + z + ' → ' + pxDeLos12(z).toFixed(1) + ' px, y z' + (z - 1) +
                   ' → ' + pxDeLos12(z - 1).toFixed(1) + ' px contra un alfiler de ' + ALFILER);

    /* ── Y el alfiler no puede tapar el punto que señala. Con el núcleo
       opaco y los brazos cruzándose encima, a z22 quedaban 1,2 m de terreno
       escondidos justo donde hay que mirar: un andén entero. */
    const nucleo = /\.u52-community-pick-core\s*\{[^}]*background:\s*transparent/.test(c99);
    const brazos = (c99.match(/\.u52-community-pick-pin::(before|after)\s*\{[^}]*linear-gradient[^}]*transparent/g) || []).length;
    comprobar('el alfiler deja ver el suelo que hay justo bajo el punto',
      nucleo && brazos === 2,
      (nucleo ? '' : 'el núcleo sigue opaco; ') + (brazos === 2 ? 'núcleo en anillo y los dos brazos con hueco'
        : 'brazos con hueco: ' + brazos + ' de 2 — la cruz vuelve a taparlo'));
  }

  /* ── La escala va donde se ve. La franja de abajo del mapa la tapa entera
     la barra de navegación de Pro City (medido en la v987), así que un
     control ahí es un control invisible — que es lo que la v980 encontró con
     la esquina de arriba a la derecha. */
  const hayEscala = /L\.control\.scale\s*\(/.test(j03);
  const arriba = /L\.control\.scale\s*\(\s*\{[^}]*position\s*:\s*'top/.test(j03);
  comprobar('el mapa dice a qué escala va, y no debajo de la barra de navegación',
    hayEscala && arriba,
    !hayEscala ? 'sin barra de escala: «no puedo acercarme más» y «no sabía que se podía» se ven igual'
      : arriba ? 'escala en el rincón de arriba' : 'la escala va abajo, donde la tapa la barra de Pro City');

  /* ── Y los botones con los que se acerca se pueden tocar. Medidos en la
     v986 daban 28 × 29 px, por debajo del objetivo táctil mínimo de 44. */
  const enc = /body\.u52-real-map \.leaflet-control-zoom\s*\{[^}]*transform\s*:\s*scale\(/.test(c99);
  const mt = c99.match(/body\.u52-real-map \.leaflet-control-zoom a\s*\{[^}]*width\s*:\s*(\d+)px/);
  const lado = mt ? Number(mt[1]) : 0;
  comprobar('los botones de zoom llegan al objetivo táctil de 44 px',
    lado >= 44 && !enc,
    enc ? 'siguen encogidos con transform:scale()' :
    lado >= 44 ? lado + ' px de lado' : 'miden ' + (lado || '?') + ' px: se les falla con el dedo');
}

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

console.log('\n  -- el recuento de especies y materiales (v988) --');
{
  const j68 = soloCodigo(leer('js/68-procity-reconocimiento.js'));
  const j04 = soloCodigo(leer('js/04-marker-proximity.js'));
  const j03c = soloCodigo(leer('js/03c-arbol-especies.js'));
  const j03d = soloCodigo(leer('js/03d-mobiliario-material.js'));
  const c68 = leer('css/68-procity-reconocimiento.css');

  /* MATERIAL primero (v920): los dos vocabularios dicen qué usos llevan el
     campo y js/04 sabe leerlo. Sin eso, todo lo de abajo pasaría por no tener
     nada que contar — y el panel entero sería un verde. */
  const hayVoc = /esUsoDeArbol/.test(j03c) && /esUsoConMaterial/.test(j03d);
  const hayLect = /URBIS_ARBOL\s*=/.test(j04) && /URBIS_MOBILIARIO\s*=/.test(j04);
  if (!hayVoc || !hayLect) {
    anotarSinMaterial('MATERIAL · hay vocabulario y lector de especie y de material',
      'vocabularios: ' + hayVoc + ' · lectores: ' + hayLect);
  } else {
    comprobar('MATERIAL · hay vocabulario y lector de especie y de material', true,
      'los dos usos declarados y los dos lectores en js/04');

    /* El cuerpo del recorrido, acotado: de `function levantadoDeCampo(` a su
       cierre. Medir sobre el archivo entero daría por bueno un `leer(` de
       cualquier otro sitio, que es la lección de la v854. */
    const i0 = j68.indexOf('function levantadoDeCampo(');
    const cuerpo = i0 >= 0 ? j68.slice(i0, j68.indexOf('\n  }', i0)) : '';

    comprobar('el recuento existe y recorre los puntos del curso',
      !!cuerpo && /puntosDelCurso\(\)/.test(cuerpo),
      cuerpo ? 'levantadoDeCampo recorre puntosDelCurso()'
             : 'no hay recuento: la especie y el material se guardan y no los cuenta nadie');

    /* La clase B. La especie y el material viven en casillas cuyo ORDEN se
       resuelve en js/04 y en ningún otro sitio: un recuento que las indexara
       por su cuenta se separaría del globo y de la ficha la tanda siguiente,
       y la que se quedaría vieja sería la cuenta, porque nadie la mira dos
       veces. */
    /* Se mide la PROPIEDAD y no la forma de la llamada (v890): que el cuerpo
       ate los dos lectores del módulo y los use, sea cual sea el alias con el
       que los tenga a mano. Exigir `URBIS_ARBOL.leer(` literal se pondría
       rojo por guardar el objeto en una variable, que no cambia nada. */
    const ataLectores = /window\.URBIS_ARBOL\b/.test(cuerpo) && /window\.URBIS_MOBILIARIO\b/.test(cuerpo);
    const usaLeer = (cuerpo.match(/\.leer\(/g) || []).length >= 2;
    const porLector = ataLectores && usaLeer;
    const porCasilla = /URBIS_SLOTS\.(especieArbol|mobiliarioMaterial)/.test(cuerpo);
    comprobar('el recuento lee por URBIS_ARBOL/URBIS_MOBILIARIO, no por la casilla',
      porLector && !porCasilla,
      (porLector && !porCasilla) ? 'los dos lectores de js/04, y ninguna casilla indexada acá'
        : (!porLector ? 'no llama a los lectores de js/04'
                      : 'indexa la casilla por su cuenta: se separaría del globo a la tanda siguiente'));

    /* Sector, no dispositivo. Sin este filtro la cifra sería el inventario
       del teléfono publicado como si fuera del sector — que es lo que
       distingue una cifra de análisis de una lista de lo mío. */
    comprobar('el recuento es del SECTOR y no del dispositivo',
      /puntoDentroDelSector\(/.test(cuerpo),
      /puntoDentroDelSector\(/.test(cuerpo)
        ? 'filtra por puntoDentroDelSector'
        : 'cuenta todo el dispositivo: sería un inventario del teléfono con rótulo de sector');

    /* UN solo recorrido para las dos cuentas (v860). Dos paseos con su propio
       criterio de «está dentro» darían dos poblaciones parecidas y distintas,
       y nadie compararía nunca las dos cifras. */
    const paseos = (j68.match(/pts\.forEach\(|puntosDelCurso\(\)\.forEach\(/g) || []).length;
    const arbEnCuerpo = /esUsoDeArbol\(/.test(cuerpo), matEnCuerpo = /esUsoConMaterial\(/.test(cuerpo);
    comprobar('las dos cuentas salen del MISMO recorrido',
      arbEnCuerpo && matEnCuerpo,
      (arbEnCuerpo && matEnCuerpo) ? 'arbolado y mobiliario en el mismo paseo (' + paseos + ' paseos en el módulo)'
        : 'cada cuenta tiene su propio recorrido: dos poblaciones parecidas y distintas');

    /* El material se cuenta POR USO. Los cuatro que llevan el campo —una
       caneca, una tapa de alcantarillado, un mural y una valla de lona— son
       cuatro poblaciones, y «el 60 % es metálico» sobre las cuatro juntas no
       describe ninguna. Es la tabla de escalas de la v854 dicha sobre un
       reparto. */
    const iM = j68.indexOf('function resumenMobiliario(');
    const cM = iM >= 0 ? j68.slice(iM, j68.indexOf('\n  }', iM)) : '';
    comprobar('el material se cuenta por USO, no en una sola cifra',
      /usos:\s*lista/.test(cM) && /\.map\(function/.test(cM),
      cM ? 'resumenMobiliario devuelve una lista por uso'
         : 'una sola cifra sobre cuatro poblaciones distintas');

    /* Los mínimos de la regla 10-20-30 se DERIVAN del umbral y no se
       escriben a ojo: por debajo de 1/umbral individuos, uno solo ya lo pasa.
       La guarda los RECALCULA en vez de leer el comentario — un número
       tecleado acá sería el techo de Overpass de la v869. */
    const uE = (j68.match(/UMBRAL_ESPECIE\s*=\s*([\d.]+)/) || [])[1];
    const uG = (j68.match(/UMBRAL_GENERO\s*=\s*([\d.]+)/) || [])[1];
    const derivados = /MIN_ESPECIE\s*=\s*Math\.ceil\(1\s*\/\s*UMBRAL_ESPECIE\)/.test(j68) &&
                      /MIN_GENERO\s*=\s*Math\.ceil\(1\s*\/\s*UMBRAL_GENERO\)/.test(j68);
    const cuadran = !!uE && !!uG && Math.ceil(1 / Number(uE)) === 10 && Math.ceil(1 / Number(uG)) === 5;
    comprobar('los mínimos de la regla salen del propio umbral, no de un número a ojo',
      derivados && cuadran,
      derivados ? (cuadran ? 'umbral ' + uE + ' → ' + Math.ceil(1 / Number(uE)) + ' árboles · umbral ' +
                    uG + ' → ' + Math.ceil(1 / Number(uG))
                  : 'los umbrales no dan los mínimos que la regla necesita')
                : 'los mínimos van escritos a mano: un número puesto a ojo que nadie puede defender');

    /* La tercera mitad de la regla NO se puede correr y se dice. Darla por
       buena es el error típico que esta misma hoja declara desde la v879, y
       acá la familia botánica sencillamente no está en los datos. */
    const iP = j68.indexOf('function bloqueLevantado(');
    const cP = iP >= 0 ? j68.slice(iP, j68.indexOf('\n  }', iP)) : '';
    comprobar('la regla de la FAMILIA se declara sin correr, no se da por buena',
      /familia/i.test(cP) && /no se puede correr/.test(cP),
      cP ? (/familia/i.test(cP) ? 'la nombra y dice que no se puede correr'
                                : 'no nombra la familia: la regla saldría como si estuviera entera')
         : 'no hay panel');

    /* El denominador LLEGA a la pantalla (v943). Un reparto en porcentajes
       sin decir sobre cuántos se calculó se lee como si fuera el del sector,
       que es exactamente lo que este panel no puede afirmar. */
    const denom = /conEspecie/.test(cP) && /A\.arboles/.test(cP) &&
                  /u\.conMaterial\s*\+\s*' de '\s*\+\s*u\.n/.test(cP);
    comprobar('el denominador se imprime al lado del reparto',
      denom,
      denom ? 'los dos repartos dicen sobre cuántos se calcularon'
            : 'un porcentaje sin denominador se lee como si fuera el del sector');

    /* Y que no se extrapole: contar treinta árboles no dice cuántos hay. */
    comprobar('el panel dice que lo levantado no es el sector',
      /extrapolar/.test(cP),
      /extrapolar/.test(cP) ? 'lo acota con esa palabra'
                            : 'no lo acota: el reparto se leería como el del sector entero');

    /* Guarda de la guarda: si el panel no se compone, todo lo de arriba
       vigila un recuento que ninguna pantalla enseña — que es justamente la
       clase de la v984 que esta tanda vino a cerrar. */
    comprobar('el panel se compone en la ficha',
      /bloqueLevantado\(\)\s*\+/.test(j68),
      /bloqueLevantado\(\)\s*\+/.test(j68)
        ? 'bloqueLevantado entra en la composición'
        : 'se calcula y no se pinta: el dato seguiría sin alcanzar a ningún lector');

    /* Y las clases que estrena tienen regla: una clase que ninguna hoja
       pinta es HTML válido y un rótulo invisible (v895). */
    const clases = ['pcr-lab-sub'].filter(c => !new RegExp('\\.' + c + '\\b').test(c68));
    comprobar('las clases nuevas del panel están pintadas',
      clases.length === 0,
      clases.length ? 'sin regla: ' + clases.join(', ') : 'pcr-lab-sub tiene su regla');
  }
}

console.log('\n  -- un mapeo de la Matriz no caduca como una alerta (v988) --');
{
  const j05 = soloCodigo(leer('js/05-helpers-temporal-security.js'));
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));

  /* MATERIAL primero (v920): el catálogo TIENE tipos cuyo nombre contiene las
     palabras con las que el filtro temporal reconoce una alerta. Sin ellos no
     habría nada que esconder y la comprobación pasaría por no tener material
     — que es justamente como esto vivió sin verse. */
  const PAL = ['inund','drenaje','fuga','trafico','accidente','congest','reten','cerrada',
               'bloqueada','desvio','hueco','bache','derrumbe','alcantarilla','poste',
               'basura','incendio','animal'];
  const i0 = j20.indexOf('const PROCITY_MATRIZ_USOS = [');
  let tipos = [];
  if (i0 >= 0) {
    const j = j20.indexOf('[', i0);
    let k = j, d = 0;
    do { if (j20[k] === '[') d++; if (j20[k] === ']') d--; k++; } while (d > 0 && k < j20.length);
    try {
      const arr = eval(j20.slice(j, k).replace(/MATRIZ_USOS_KEY/g, "'x'"));
      arr.forEach(u => (u.t || []).forEach(t => {
        const tx = (u.u + ' ' + t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (PAL.some(p => tx.indexOf(p) >= 0)) tipos.push(u.u + ' · ' + t);
      }));
    } catch (e) { tipos = []; }
  }
  if (tipos.length < 5) {
    anotarSinMaterial('MATERIAL · el catálogo trae tipos que el filtro temporal reconocería',
      tipos.length + ' tipos con palabra de alerta en su nombre');
  } else {
    comprobar('MATERIAL · el catálogo trae tipos que el filtro temporal reconocería', true,
      tipos.length + ' tipos, entre ellos ' + tipos.slice(0, 2).join(' y '));

    /* El discriminante YA existía y no se miraba acá (clase A): un punto de la
       Matriz es un inventario permanente, nunca una alerta de ocho horas. Sin
       esta línea, esos tipos se guardan, se dibujan, y desaparecen del mapa de
       todo el mundo al día siguiente — y con ellos de `urbisDatosVisibles()`,
       así que ningún análisis los cuenta. */
    const i1 = j05.indexOf('function esReporteTemporal(');
    const cuerpo = i1 >= 0 ? j05.slice(i1, j05.indexOf('\n  }', i1)) : '';
    const sale = /urbisEsCategoriaProCity\s*\(\s*tipo\s*\)\s*\)\s*return false/.test(cuerpo);
    comprobar('un punto de la Matriz nunca se trata como alerta temporal',
      sale,
      sale ? 'esReporteTemporal sale en falso para lo de Pro City'
           : 'por el TEXTO del tipo: ' + tipos.length + ' tipos del catálogo se esconderían a las 8 h');

    /* Guarda de la guarda: si el ayudante desapareciera, la línea de arriba
       seguiría escrita y no haría nada — la condición cae al criterio viejo y
       los tipos vuelven a esconderse, en silencio. */
    const hayAyuda = /window\.urbisEsCategoriaProCity\s*=/.test(j20);
    comprobar('y el ayudante que lo decide sigue publicado',
      hayAyuda,
      hayAyuda ? 'urbisEsCategoriaProCity se publica en js/20'
               : 'sin el ayudante la condición cae al criterio viejo y no se nota');
  }
}

console.log('\n  -- el subtipo de cada piso (v989) --');
{
  const j03b = soloCodigo(leer('js/03b-edificio-vocabulario.js'));
  const j20b = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j68b = soloCodigo(leer('js/68-procity-reconocimiento.js'));
  const c01 = leer('css/01-base-layout.css');
  const c52 = leer('css/52-urbis-pro-city.css');

  /* MATERIAL primero (v920). Las dos mitades de la derivación tienen que
     poder leerse: la tabla que se invierte y el catálogo del que salen los
     tipos. Sin cualquiera de las dos, todo lo de abajo pasaría por no tener
     nada que ofrecer, que es el verde que este proyecto lleva veintisiete
     tandas persiguiendo. */
  const iMap = j03b.indexOf('const USO_PISO_DE_MATRIZ = {');
  const mapa = iMap >= 0 ? j03b.slice(j03b.indexOf('{', iMap), j03b.indexOf('\n  };', iMap)) : '';
  const nMapa = (mapa.match(/':\s*'/g) || []).length;
  const iCat = j20b.indexOf('const PROCITY_MATRIZ_USOS = [');
  const cat = iCat >= 0 ? j20b.slice(iCat, j20b.indexOf('\n  ];', iCat)) : '';
  const nUsos = (cat.match(/\{\s*u\s*:/g) || []).length;
  if (nMapa < 20 || nUsos < 40) {
    anotarSinMaterial('MATERIAL · la tabla que se invierte y el catálogo se dejan leer',
      'pares en USO_PISO_DE_MATRIZ: ' + nMapa + ' · usos del catálogo: ' + nUsos);
  } else {
    comprobar('MATERIAL · la tabla que se invierte y el catálogo se dejan leer', true,
      nMapa + ' pares y ' + nUsos + ' usos, que es de donde salen los subtipos');

    /* El catálogo es UNO. Si js/20 dejara de publicarlo, js/03b se quedaría
       sin tipos que ofrecer y el desplegable del subtipo desaparecería sin un
       solo error — y eso, desde afuera, se ve igual que «este uso no tiene
       subtipos». */
    const publica = /window\.PROCITY_MATRIZ_USOS\s*=\s*PROCITY_MATRIZ_USOS/.test(j20b);
    comprobar('el catálogo se publica, y es el MISMO array y no una copia',
      publica,
      publica ? 'js/20 publica PROCITY_MATRIZ_USOS tal cual'
              : 'sin publicarlo, js/03b se queda sin tipos y el desplegable desaparece en silencio');

    /* La lista NO se escribe: se deriva. Una segunda lista de los 584 tipos
       sería la clase B en su forma más cara, y la que se quedaría vieja sería
       la nueva. */
    const iFam = j03b.indexOf('function familiasDeUsoPiso(');
    const fam = iFam >= 0 ? j03b.slice(iFam, j03b.indexOf('\n  }', iFam)) : '';
    const deriva = !!fam && /USO_PISO_DE_MATRIZ/.test(fam) && /SUBTIPO_EXTRA/.test(fam);
    comprobar('los subtipos se DERIVAN del catálogo, no se escriben aparte',
      deriva,
      !fam ? 'no existe familiasDeUsoPiso: la lista estaría escrita a mano'
           : deriva ? 'invierte USO_PISO_DE_MATRIZ y le suma los extras declarados'
                    : 'no invierte la tabla: sería una segunda lista del mismo hecho');

    /* Y la otra mitad: TODO uso de piso real tiene de dónde sacar subtipos.
       Medido, «Deportivo o gimnasio» es el que no sale de la inversión —una
       cancha no tiene pisos, así que no está en la tabla que se invierte— y
       por eso existen los extras. Sin esta comprobación, un uso de piso nuevo
       nacería con cero subtipos y su desplegable simplemente no aparecería. */
    const iUP = j03b.indexOf('const USOS_PISO = [');
    const listaUP = iUP >= 0 ? j03b.slice(iUP, j03b.indexOf('\n  ];', iUP)) : '';
    const usosPiso = (listaUP.match(/'([^']+)'/g) || []).map(x => x.slice(1, -1));
    const iEx = j03b.indexOf('const SUBTIPO_EXTRA = {');
    const extra = iEx >= 0 ? j03b.slice(iEx, j03b.indexOf('\n  };', iEx)) : '';
    const sinFuente = usosPiso.filter(u =>
      !new RegExp("':\\s*'" + u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'").test(mapa) &&
      extra.indexOf("'" + u + "'") === -1);
    comprobar('todo uso de piso real tiene de dónde sacar subtipos',
      usosPiso.length >= 8 && sinFuente.length === 0,
      usosPiso.length < 8 ? 'no se pudo leer USOS_PISO'
        : sinFuente.length ? 'sin una sola familia: ' + sinFuente.join(' · ') +
            ' — su desplegable no aparecería, y eso se ve igual que «no tiene subtipos»'
        : usosPiso.length + ' usos de piso, todos con familia (los que no salen de la inversión, por los extras)');

    /* El subtipo se valida contra el uso al ESCRIBIR y al LEER. Sin lo
       segundo, un tipo renombrado o retirado del catálogo seguiría impreso y
       contado, y nadie podría abrir la cifra (v932). */
    const iCod = j03b.indexOf('function codificarPisos(');
    const cod = iCod >= 0 ? j03b.slice(iCod, j03b.indexOf('\n  }', iCod)) : '';
    const iLee = j03b.indexOf('function leerPisos(');
    const lee = iLee >= 0 ? j03b.slice(iLee, j03b.indexOf('\n  }', iLee)) : '';
    const valCod = /subtipoValido\(/.test(cod), valLee = /subtipoValido\(/.test(lee);
    comprobar('el subtipo se valida contra su uso al escribir Y al leer',
      valCod && valLee,
      (valCod && valLee) ? 'las dos puertas pasan por subtipoValido'
        : 'sin validar al ' + (!valCod ? 'escribir: un «Panadería» quedaría bajo «Vivienda»'
                                       : 'leer: un tipo retirado del catálogo seguiría contándose'));

    /* Texto libre no: con él, «panaderia», «Panadería» y «panaderia esquina»
       son tres valores y el recuento deja de contar. Es la decisión de la
       v932 con el `sub` de las puertas de vacío. */
    const iSub = j03b.indexOf('function htmlSubtipo(');
    const ctrl = iSub >= 0 ? j03b.slice(iSub, j03b.indexOf('\n  }', iSub)) : '';
    const cerrado = !!ctrl && /<select/.test(ctrl) && !/<input/.test(ctrl);
    comprobar('el control del subtipo es una lista cerrada, no texto libre',
      cerrado,
      !ctrl ? 'no existe htmlSubtipo'
            : cerrado ? 'un select con optgroups: solo entra lo que el catálogo tiene'
                      : 'admite texto libre, y entonces el reparto no se puede contar');

    /* Es OPCIONAL y su primera opción es vacía: un desplegable que arranque
       en el primer tipo le pondría «Bar» a todo comercio que nadie detalló,
       que es la falta de la v973 dicha al revés. */
    const vacia = /<option value="">/.test(ctrl);
    comprobar('el subtipo arranca sin detallar, no en el primer tipo de la lista',
      vacia, vacia ? 'la primera opción es vacía' : 'nace con un tipo elegido que nadie eligió');

    /* El subtipo se cuenta POR USO de piso y con su denominador al lado: una
       panadería y una clínica veterinaria no son la misma población (v988), y
       «el 50 % es panadería» sin decir sobre cuántas plantas detalladas se
       lee como una cifra del sector (v943). */
    const iAlt = j68b.indexOf('function alturasDeCampo(');
    const alt = iAlt >= 0 ? j68b.slice(iAlt, j68b.indexOf('\n  }\n', iAlt)) : '';
    const porUso = /subtipos:/.test(alt) && /uso:\s*k/.test(alt);
    const conDen = /conSub/.test(alt);
    comprobar('el subtipo se cuenta por uso de piso y con su denominador',
      porUso && conDen,
      !alt ? 'no se pudo leer alturasDeCampo'
        : (porUso && conDen) ? 'un grupo por uso, cada uno con conSub de total'
        : (!porUso ? 'una sola cifra para todos los usos: no describe ninguno'
                   : 'sin denominador: el reparto se lee como del sector entero'));

    /* Y que la cifra LLEGUE a la pantalla, que es la guarda de la guarda de
       esta familia: sin esto el recuento es documentación. Las dos
       superficies, porque son el mismo dato en dos documentos. */
    const enPliego = /Qué clase de/.test(j68b);
    const enInforme = j68b.indexOf('function alturasImpresas(') >= 0 &&
      /subtipos/.test(j68b.slice(j68b.indexOf('function alturasImpresas('),
        j68b.indexOf('function hitosImpresos(')));
    comprobar('el reparto llega a la lámina Y al informe',
      enPliego && enInforme,
      (enPliego && enInforme) ? 'las dos superficies lo imprimen'
        : 'falta en: ' + [!enPliego && 'la lámina', !enInforme && 'el informe'].filter(Boolean).join(' y '));

    /* Y a la pantalla del punto, que es donde lo ve quien lo acaba de mapear.
       Un dato guardado que ninguna superficie alcanza se ve igual que uno
       ausente — la clase C, y el defecto exacto que la v985 encontró en este
       mismo panel. */
    const iFi = j20b.indexOf('function fichaDeProCity(');
    const fi = iFi >= 0 ? j20b.slice(iFi, j20b.indexOf('\n  }', iFi)) : '';
    const enPanel = !!fi && /usosPorPiso/.test(fi) && /\.sub/.test(fi);
    comprobar('el panel del punto enseña el subtipo que la ficha guarda',
      enPanel,
      enPanel ? 'fichaDeProCity lo lee de usosPorPiso'
              : 'se guarda y no se ve: desde afuera es idéntico a no haberlo anotado');

    /* El desplegable nuevo está pintado en las DOS hojas de estilo —el
       formulario vive en dos superficies— o queda corto al lado de un hueco
       en la que falte (v895, v979: el color y el sitio se miden en SU
       superficie, no se copian del de al lado). */
    const css1 = /\.ins-sub-piso\s*\{/.test(c01), css5 = /\.ins-sub-piso\s*\{/.test(c52);
    comprobar('el desplegable del subtipo está pintado en las dos superficies',
      css1 && css5,
      (css1 && css5) ? 'con su renglón entero en css/01 y css/52'
        : 'sin regla en: ' + [!css1 && 'css/01', !css5 && 'css/52'].filter(Boolean).join(' y '));

    /* Guarda de la guarda: si el formulario dejara de llamar a htmlSubtipo,
       todo lo de arriba seguiría en verde sobre un control que nadie pinta. */
    const iHt = j03b.indexOf('function htmlUsosPorPiso(');
    const ht = iHt >= 0 ? j03b.slice(iHt, j03b.indexOf('\n  }', iHt)) : '';
    const llama = /htmlSubtipo\(/.test(ht);
    comprobar('y el formulario de pisos sigue llamando al control',
      llama,
      llama ? 'htmlUsosPorPiso lo monta en cada renglón'
            : 'el control existe y no se monta: el campo no aparecería');
  }
}

/* ── El informe archivado mide SU sector (v995) ────────────────────────────
   La v988 lo dejó medido y declarado: el informe de un sector guardado presta
   `S.trazado` y `S.terreno` pero NO el resultado, así que
   `puntoDentroDelSector` no tenía contra qué medir y lo levantado en campo
   salía vacío. Y la llave con la que ese recuento se memoiza era la de la
   ficha VIVA, así que al componer el informe de OTRO sector el memo servía las
   cifras del que estuviera en pantalla — una cifra correcta de otro sector,
   que es la clase que este proyecto persigue desde la v879. */
console.log('\n  -- el informe archivado mide SU sector (v995) --');
{
  const j68h = soloCodigo(leer('js/68-procity-reconocimiento.js'));
  const dentro = (txt, nom, fin) => {
    const i = txt.indexOf(nom); if (i < 0) return '';
    const j = txt.indexOf(fin, i); return j < 0 ? txt.slice(i) : txt.slice(i, j);
  };
  /* El bloque que presta: de donde guarda el estado anterior hasta donde lo
     devuelve. Se corta por sus dos extremos y no por un número de líneas: un
     corte por distancia envejece (v935). */
  const iPresta = j68h.indexOf('var trzAntes = S.trazado');
  const iVuelve = j68h.indexOf('S.trazado = trzAntes;', iPresta);
  const cPresta = (iPresta >= 0 && iVuelve >= 0) ? j68h.slice(iPresta, j68h.indexOf('return html;', iVuelve)) : '';

  if (!cPresta) {
    anotarSinMaterial('MATERIAL · el bloque que presta el sector archivado se deja leer',
      'sin él no se puede comprobar ni que preste ni que devuelva');
  } else {
    comprobar('MATERIAL · el informe archivado presta y devuelve estado',
      /S\.\w+ = \w+Antes;/.test(cPresta), 'el bloque de préstamo se deja leer entero');

    /* 1 · La llave del sector se calcula en UN sitio. Con la expresión
       repetida en veintisiete, arreglar de qué sector se habla se arregla en
       veintisiete o no se arregla. */
    const iF = j68h.indexOf('function llaveDelSectorActual()');
    const cF = iF >= 0 ? j68h.slice(iF, j68h.indexOf('\n  }', iF)) : '';
    /* Se cuenta FUERA del propio ayudante: dentro tiene que estar, y contarlo
       con los demás hacía que la cifra buena fuera 1 y la mala 0, que es un
       mensaje al revés. */
    const fuera = (j68h.slice(0, iF < 0 ? 0 : iF) + j68h.slice(iF < 0 ? 0 : iF + cF.length))
      .match(/llaveDeSector\(S\.resultado/g) || [];
    comprobar('la llave del sector se calcula en un solo sitio',
      fuera.length === 0 && !!cF,
      !cF ? 'no existe llaveDelSectorActual: la expresión vuelve a estar repetida'
      : fuera.length === 0 ? 'los ' + (j68h.match(/llaveDelSectorActual\(\)/g) || []).length +
        ' lectores pasan por la misma función'
      : fuera.length + ' sitios la vuelven a calcular por su cuenta: se separarían a la tanda siguiente');

    /* 2 · Y las dos memos de campo llavean por SECTOR, no por la ficha viva:
       es lo que impide que el informe de un sector archivado sirva las cifras
       del que está en pantalla. */
    const memos = ['function edificiosDeCampo(', 'function levantadoDeCampo('];
    const porFicha = memos.filter(n => {
      const c = dentro(j68h, n, 'memo');
      return /fichaActualId/.test(c) || !/llaveDelSectorActual\(\)/.test(c);
    });
    comprobar('las dos memos de campo llavean por el sector, no por la ficha viva',
      porFicha.length === 0,
      porFicha.length ? 'llavean por la ficha viva: ' + porFicha.join(' · ') +
        ' — el informe de un sector archivado serviría las cifras del que esté en pantalla'
      : 'las ' + memos.length + ' llavean por llaveDelSectorActual()');

    /* 3 · El informe archivado presta el resultado y su geometría. Sin ellas,
       `puntoDentroDelSector` cae a «todo dentro» o a un radio de otro sector. */
    const presta = ['S.resultado = comoResultado(f)', 'S.radioM = f.radioM',
                    'S.forma = f.forma', 'S.poligono = f.poligono'];
    const faltan = presta.filter(x => cPresta.indexOf(x) < 0);
    comprobar('el informe archivado presta el resultado y su geometría',
      faltan.length === 0,
      faltan.length ? 'no presta: ' + faltan.join(' · ') +
        ' — lo levantado en campo se filtraría contra el sector equivocado'
      : 'los ' + presta.length + ' se prestan por comoResultado, la misma función que el resto del informe');

    /* 4 · Y TODO lo que presta lo devuelve. Prestar sin devolver deja el
       estado vivo con el sector archivado dentro, que es peor que no prestar:
       el siguiente que mire la ficha viva vería las cifras de la guardada. */
    const prestadas = [...cPresta.matchAll(/\n\s*S\.(\w+) = (?:f\.|comoResultado)/g)].map(m => m[1]);
    const devueltas = [...cPresta.matchAll(/S\.(\w+) = \w+Antes/g)].map(m => m[1]);
    const sinDevolver = [...new Set(prestadas)].filter(k => devueltas.indexOf(k) < 0);
    comprobar('todo lo que el informe archivado presta lo devuelve',
      sinDevolver.length === 0 && prestadas.length > 0,
      sinDevolver.length ? 'se queda prestado: ' + sinDevolver.join(' · ') +
        ' — la ficha viva quedaría con el sector archivado dentro'
      : [...new Set(prestadas)].length + ' prestadas y todas devueltas');

    /* 5 · Y con el sector prestado, el informe archivado SÍ imprime lo
       levantado. Sin esta, todo lo de arriba sería una costura que no se usa. */
    const llama = cPresta.indexOf('bloqueLevantado()') >= 0;
    comprobar('el informe archivado imprime lo levantado en campo',
      llama,
      llama ? 'el detalle de especies, sitio, material y estado sale también del archivo'
            : 'no lo llama: el préstamo no serviría de nada');

    /* 6 · Guarda de la guarda: si la función dejara de leer el resultado,
       todo lo de arriba seguiría en verde sobre una llave constante (v878). */
    const mira = /S\.resultado && S\.resultado\.meta/.test(cF);
    comprobar('y la llave sigue saliendo del resultado que se esté mirando',
      mira,
      mira ? 'con el sector prestado, devuelve el del archivo'
           : 'dejó de leerlo: todos los sectores compartirían una llave');
  }
}

/* ── Hay tipos del arbolado que no tienen especie (v994) ───────────────────
   Medido en el navegador antes de tocar nada: un «Alcorque vacío (sitio de
   siembra sin árbol)» se preguntaba «¿Qué árbol es?» y la v979 lo marcaba
   «Sin especie anotada. Cuando sepa cuál es, toque Editar» — sobre un hueco
   en el que no hay ningún árbol. Es la clase de la v974 con la palma, viva
   dentro del archivo que la arregló.

   La excepción va por TIPO, que es la decisión de la v991, y lo que se guarda
   acá es que no se vuelva un no-op silencioso ni se olvide en uno de sus
   tres lectores. */
console.log('\n  -- hay tipos del arbolado que no tienen especie (v994) --');
{
  const j03g = soloCodigo(leer('js/03c-arbol-especies.js'));
  const j04g = soloCodigo(leer('js/04-marker-proximity.js'));
  const j20g = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j68g = soloCodigo(leer('js/68-procity-reconocimiento.js'));

  const tabla = (() => {
    const i = j03g.indexOf('var TIPOS_SIN_ESPECIE'); if (i < 0) return null;
    const a = j03g.indexOf('{', i), c = j03g.indexOf('\n  }', a);
    if (a < 0 || c < 0) return null;
    try { return eval('(' + j03g.slice(a, c + 4) + ')'); } catch (e) { return null; }
  })();
  const catG = (() => {
    const i = j20g.indexOf('const PROCITY_MATRIZ_USOS = [');
    if (i < 0) return null;
    const a = j20g.indexOf('[', i), c = j20g.indexOf('\n  ];', a);
    try { return eval(j20g.slice(a, c + 4)); } catch (e) { return null; }
  })();

  if (!tabla || !catG) {
    anotarSinMaterial('MATERIAL · la excepción por tipo y el catálogo se dejan leer',
      'no se pudo leer: ' + [!tabla && 'TIPOS_SIN_ESPECIE', !catG && 'el catálogo'].filter(Boolean).join(', '));
  } else {
    const tipos = Object.keys(tabla);
    comprobar('MATERIAL · la excepción tiene tipos que excluir',
      tipos.length >= 1, tipos.length + ' tipos del arbolado sin especie posible');

    /* 1 · Un tipo mal escrito es un no-op que se lee igual que uno que
       funciona (v973, v975, v991). */
    const fantasma = tipos.filter(t => !catG.some(u => (u.t || []).indexOf(t) >= 0));
    comprobar('todo tipo excluido existe en el catálogo',
      fantasma.length === 0,
      fantasma.length ? 'no está en ningún uso: ' + fantasma.join(' · ') +
        ' — la excepción no haría nada y se leería igual que si funcionara'
      : 'los ' + tipos.length + ' están');

    /* 2 · Y su uso tiene que ser uno de los que SÍ preguntan especie, o la
       excepción sobra: excluir de una pregunta que nadie hace es un no-op. */
    const conEspecie = (() => {
      const i = j03g.indexOf('var USOS_CON_ESPECIE'); if (i < 0) return [];
      const a = j03g.indexOf('[', i), c = j03g.indexOf(']', a);
      try { return eval(j03g.slice(a, c + 1)); } catch (e) { return []; }
    })();
    const sobra = tipos.filter(t => {
      const u = catG.find(x => (x.t || []).indexOf(t) >= 0);
      return u && conEspecie.indexOf(u.u) < 0;
    });
    comprobar('y su uso es de los que SÍ preguntan especie, o la excepción sobra',
      sobra.length === 0 && conEspecie.length > 0,
      sobra.length ? 'su uso no pregunta especie, así que excluirlo no hace nada: ' + sobra.join(' · ')
                   : 'los ' + tipos.length + ' excluyen de una pregunta que sí se hace');

    /* 3 · El valor es la RAZÓN y no un booleano: «no hay planta» y «sí la hay
       y la lista no la tiene» piden cosas distintas —la segunda es candidata a
       ampliar la lista y la primera no lo será nunca— y juntarlas mandaría a
       ampliarla para un caso que no la necesita. */
    const sinRazon = tipos.filter(t => typeof tabla[t] !== 'string' || tabla[t].trim().length < 20);
    comprobar('cada exclusión dice POR QUÉ, y no solo que sí',
      sinRazon.length === 0,
      sinRazon.length ? 'sin razón escrita: ' + sinRazon.join(' · ')
                      : 'las ' + tipos.length + ' distinguen «no hay planta» de «la lista no la tiene»');

    /* 4 · Los tres que deciden pasan el TIPO. Falla CERRADO: uno que solo
       pase el uso sigue compilando y vuelve a la respuesta de antes en
       silencio, que es como este defecto sobrevivió quince versiones. */
    const dentro = (txt, nom, fin) => {
      const i = txt.indexOf(nom); if (i < 0) return '';
      const j = txt.indexOf(fin, i); return j < 0 ? txt.slice(i) : txt.slice(i, j);
    };
    const lectores = [
      [dentro(j20g, 'let htmlEspecie', '</div>`;'), 'el formulario'],
      [dentro(j04g, 'pendiente: function (descripcion) {', '\n    },'), 'la marca de «sin especie»'],
      [dentro(j68g, 'function levantadoDeCampo(', '\n  }'), 'el recuento']
    ];
    const cojos = lectores.filter(([t]) => !/tieneEspecie\(\s*[^,)]+,\s*[^)]+\)/.test(t));
    comprobar('los tres que deciden lo hacen con el uso Y el tipo',
      cojos.length === 0,
      cojos.length ? 'deciden solo con el uso: ' + cojos.map(x => x[1]).join(' · ') +
        ' — un alcorque vacío volvería a que le preguntaran qué árbol es'
      : 'los ' + lectores.length + ' pasan los dos');

    /* 5 · Y el recuento los cuenta APARTE. Meterlos entre los «árboles
       mapeados» infla el denominador del reparto con cosas que nunca van a
       traer especie, que es la falta de denominador de la v943 al revés. */
    const cR = dentro(j68g, 'function resumenArbolado(', '\n  }');
    const aparte = /noAplica:\s*a\.noAplica/.test(cR) && /noAplicaTipos/.test(cR);
    comprobar('el recuento los cuenta aparte y los nombra',
      aparte && /noAplicaTipos\.map/.test(j68g),
      aparte ? 'no inflan el denominador del reparto y salen por su nombre'
             : 'entran entre los árboles mapeados: el reparto se leería sobre un denominador falso');

    /* 6 · Guarda de la guarda: si `tieneEspecie` dejara de mirar la tabla,
       todo lo de arriba seguiría en verde sobre una excepción que no se
       aplica (v878). */
    const cT = dentro(j03g, 'function tieneEspecie(', '\n  }');
    const mira = /TIPOS_SIN_ESPECIE/.test(cT) && /esUsoDeArbol\(/.test(cT);
    comprobar('y tieneEspecie sigue mirando la tabla y el uso',
      mira,
      mira ? 'la excepción se aplica, y solo dentro de los usos que preguntan'
           : 'dejó de mirar: ' + [!/TIPOS_SIN_ESPECIE/.test(cT) && 'la tabla',
           !/esUsoDeArbol\(/.test(cT) && 'el uso'].filter(Boolean).join(' y '));
  }
}

/* ── Dónde está sembrado el árbol (v993) ───────────────────────────────────
   Pedido en la calle: «que diga si el árbol tiene su propia jardinera o es un
   árbol normal». Lo que se guarda acá es que no se confunda con el TIPO
   «Árbol que levanta el andén» —que es otro hecho— y que el campo no quede
   colgado en alguna de las puertas por las que tiene que pasar. */
console.log('\n  -- dónde está sembrado el árbol (v993) --');
{
  const j03c = soloCodigo(leer('js/03c-arbol-especies.js'));
  const j04s = soloCodigo(leer('js/04-marker-proximity.js'));
  const j20s = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j10s = soloCodigo(leer('js/10-visible-markers.js'));
  const j12s = soloCodigo(leer('js/12-spa-ui.js'));
  const j68s = soloCodigo(leer('js/68-procity-reconocimiento.js'));

  const sacar = (txt, nom, ab, ce) => {
    const i = txt.indexOf(nom); if (i < 0) return null;
    const a = txt.indexOf(ab, i), c = txt.indexOf(ce, a);
    if (a < 0 || c < 0) return null;
    try { return eval('(' + txt.slice(a, c + ce.length) + ')'); } catch (e) { return null; }
  };
  const sitios = sacar(j03c, 'var SITIOS =', '[', '\n  ]');

  if (!sitios) {
    anotarSinMaterial('MATERIAL · la lista de sitios de siembra se deja leer',
      'sin ella nada de lo de abajo comprueba un campo, solo que un objeto existe');
  } else {
    comprobar('MATERIAL · la lista tiene sitios que ofrecer',
      sitios.length >= 4, sitios.length + ' sitios de siembra');

    /* 1 · Cada opción con su criterio, por lo mismo que la escala de estado:
       sin él, «jardinera» y «alcorque» se eligen a ojo y el reparto deja de
       ser comparable entre dos personas. */
    const sinD = sitios.filter(x => !x.d || String(x.d).trim().length < 25).map(x => x.n);
    comprobar('cada sitio de siembra lleva su criterio escrito',
      sinD.length === 0,
      sinD.length ? 'sin criterio: ' + sinD.join(' · ') + ' — se elegiría a ojo'
                  : 'los ' + sitios.length + ' dicen cómo se reconocen');

    /* 2 · Ningún sinónimo es un NO-OP. Van pegados a su fila, así que uno
       «muerto» es imposible por construcción y perseguirlo sería una guarda
       vacua —la primera versión lo era, y su inyección pasó en verde—. Lo que
       sí se estropea en silencio es un sinónimo que ya es subcadena del
       propio nombre: no añade nada y se lee igual que uno que funciona. Es el
       defecto que la v983 encontró con trece de golpe. */
    const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const noOp = [];
    sitios.forEach(x => (x.alt || []).forEach(a => {
      if (norm(x.n).indexOf(norm(a)) >= 0) noOp.push(x.n + ' → ' + a);
    }));
    comprobar('ningún sinónimo repite lo que el nombre ya dice',
      noOp.length === 0,
      noOp.length ? 'no añaden nada, y se leen igual que uno que funciona: ' + noOp.join(' · ')
                  : sitios.reduce((n, x) => n + (x.alt || []).length, 0) + ' sinónimos, todos con algo que aportar');

    /* 3 · La lista LLEVA «Otro», al revés que la escala de estado, y la
       razón importa: una enumeración del mundo nunca está completa, así que
       sin la salida quien tiene delante un caso raro elige «el más parecido»
       (v975). La escala de cuatro peldaños sí es exhaustiva y no lo lleva. */
    const iV = j03c.indexOf('window.URBIS_SITIO_VOC');
    const cV = iV >= 0 ? j03c.slice(iV, j03c.indexOf('\n  };', iV)) : '';
    comprobar('la lista de sitios lleva «Otro», y la escala de estado no',
      /OTRO:\s*OTRO/.test(cV) && !/OTRO/.test(soloCodigo(leer('js/03e-estado-urbano.js')).split('window.URBIS_ESTADO_VOC')[1] || ''),
      /OTRO:\s*OTRO/.test(cV) ? 'la enumeración tiene salida y la escala no la necesita'
        : 'sin salida: quien tenga un caso raro elegiría «el más parecido»');

    /* 4 · Los usos salen de la MISMA lista que la especie. Dos listas para
       «qué usos son de árbol» se separarían a la tanda siguiente. */
    const mismos = /USOS_CON_SITIO:\s*USOS_CON_ESPECIE/.test(cV)
                && /esUsoConSitio:\s*esUsoDeArbol/.test(cV);
    comprobar('los usos con sitio de siembra son los mismos que los de especie',
      mismos,
      mismos ? 'una sola lista: un uso que tenga árboles tiene dónde sembrarlos'
             : 'dos listas para el mismo hecho: se separarían a la tanda siguiente');

    /* 5 · El caso que de verdad se lee —«sin hueco»— se decide en UN sitio.
       Cada pantalla contándolo por su cuenta usaría su propio criterio (v879). */
    const enVoc = /SIN_SITIO:/.test(cV);
    const enLector = /sinSitio:\s*!!\(V && valor === V\.SIN_SITIO\)/.test(j04s);
    comprobar('«sin hueco» se decide en el vocabulario y lo lee el lector',
      enVoc && enLector,
      (enVoc && enLector) ? 'una pantalla nueva lo hereda sin volver a definirlo'
        : 'falta en: ' + [!enVoc && 'el vocabulario', !enLector && 'el lector'].filter(Boolean).join(' y '));

    /* 6 · Las cuatro superficies lo alcanzan, y DENTRO de la función que
       pinta cada una: js/20 lo lee dos veces —prellenar y panel— así que
       buscarlo suelto daría por buena una superficie muda (v992). */
    const dentro = (txt, nom, fin) => {
      const i = txt.indexOf(nom); if (i < 0) return '';
      const j = txt.indexOf(fin, i); return j < 0 ? txt.slice(i) : txt.slice(i, j);
    };
    const sup = [
      [j10s, 'el globo y la ficha'],
      [dentro(j20s, 'function fichaDeProCity(', '\n  }'), 'el panel del punto'],
      [dentro(j68s, 'function levantadoDeCampo(', '\n  }'), 'el recuento']
    ];
    const mudos = sup.filter(([t]) => !/URBIS_SITIO\s*\.\s*leer|LS\.leer/.test(t));
    comprobar('el globo, la ficha, el panel y el recuento leen el sitio de siembra',
      mudos.length === 0,
      mudos.length ? 'no lo alcanzan: ' + mudos.map(x => x[1]).join(' · ') +
        ' — un dato que se guarda y que ninguna pantalla enseña se ve igual que uno que no existe'
      : 'las ' + sup.length + ' pasan por URBIS_SITIO.leer');

    /* 7 · El guardado condicionado al bloque, o editar por otro camino
       borraría lo levantado (v986). */
    const iG = j12s.indexOf('function guardarSitioArbol(');
    const cG = iG >= 0 ? j12s.slice(iG, j12s.indexOf('})();', iG)) : '';
    const cond = !!cG && /if \(!insSit\) return;/.test(cG);
    comprobar('el guardado no toca las casillas si el bloque no está en pantalla',
      cond,
      cond ? 'editar por otro camino no borra el sitio levantado'
        : !cG ? 'no hay guardado: lo que se elige no se guarda'
              : 'escribe siempre: editar un punto por otro camino lo borraría');

    /* 8 · El texto libre SOLO acompaña a «Otro»: dejarlo pegado convertiría
       un descarte en un dato que nadie volvió a escribir. */
    const limpia = /esOtroSit && insOtroSit/.test(cG) && /: ''/.test(cG);
    comprobar('el texto libre solo acompaña a «Otro»',
      limpia,
      limpia ? 'con cualquier otro sitio elegido se limpia'
             : 'se queda pegado: un descarte se publicaría como el sitio');

    /* 9 · La distinción con el TIPO se DICE donde se lee la cifra. No es
       prosa de adorno: es lo que impide que alguien sume dos hechos. */
    /* Se busca DENTRO del sitio que la dice, no en el archivo: «Árbol que
       levanta el andén» es además un TIPO del catálogo, así que en js/20 el
       literal aparece igual aunque el formulario no lo explique. */
    const iP = j68s.indexOf('Dónde están sembrados');
    const cP = iP >= 0 ? j68s.slice(iP, iP + 3200) : '';
    const iF = j20s.indexOf('ins-sitio-bloque');
    const cF = iF >= 0 ? j20s.slice(iF, iF + 2400) : '';
    const dicho = /No es lo mismo que el tipo/.test(cP) && /levanta el andén/.test(cF);
    comprobar('la hoja dice que el sitio no es el tipo «Árbol que levanta el andén»',
      dicho,
      dicho ? 'el recuento y el formulario lo separan'
            : 'no lo dice: se leerían como un solo hecho');

    /* 10 · Guarda de la guarda: si el lector dejara de mirar su casilla,
       todo lo de arriba seguiría en verde sobre un campo que nadie lee. */
    const iL = j04s.indexOf('window.URBIS_SITIO = Object.assign');
    const cL = iL >= 0 ? j04s.slice(iL, j04s.indexOf('\n  });', iL)) : '';
    const mira = /crudo\s*=\s*String\(d\[URBIS_SLOTS\.arbolSitio\]/.test(cL)
              && /otro\s*=\s*String\(d\[URBIS_SLOTS\.arbolSitioOtro\]/.test(cL);
    comprobar('y el lector sigue mirando sus dos casillas',
      mira,
      mira ? 'las dos se resuelven en js/04 y en ningún otro sitio'
           : 'dejó de mirarlas: el campo sería documentación');
  }
}

/* ── En qué estado está lo que se mapea (v992) ─────────────────────────────
   Se puede mapear un hidrante, una tapa y una banca, y hasta la v991 no había
   manera de decir que están rotos —que es lo que un vecino quiere reportar—.

   Lo que la v942 objetó para el andén sigue siendo cierto y es lo que estas
   guardas protegen: contar un juicio solo vale si la escala está ACORDADA. La
   escala está escrita y cada peldaño lleva su criterio; sin el criterio,
   «regular» vuelve a ser una opinión y la cifra deja de significar algo. */
console.log('\n  -- en qué estado está lo que se mapea (v992) --');
{
  const j03e = soloCodigo(leer('js/03e-estado-urbano.js'));
  const j04e = soloCodigo(leer('js/04-marker-proximity.js'));
  const j20e = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j10e = soloCodigo(leer('js/10-visible-markers.js'));
  const j12e = soloCodigo(leer('js/12-spa-ui.js'));
  const j68e = soloCodigo(leer('js/68-procity-reconocimiento.js'));

  const bloque = (txt, nom, ab, ce) => {
    const i = txt.indexOf(nom); if (i < 0) return null;
    const a = txt.indexOf(ab, i), c = txt.indexOf(ce, a);
    if (a < 0 || c < 0) return null;
    try { return eval('(' + txt.slice(a, c + ce.length) + ')'); } catch (e) { return null; }
  };
  const escala = bloque(j03e, 'var ESTADOS =', '[', '\n  ]');
  const usosE = bloque(j03e, 'var USOS_CON_ESTADO =', '[', ']');
  const catE = (() => {
    const i = j20e.indexOf('const PROCITY_MATRIZ_USOS = [');
    if (i < 0) return null;
    const a = j20e.indexOf('[', i), c = j20e.indexOf('\n  ];', a);
    try { return eval(j20e.slice(a, c + 4)); } catch (e) { return null; }
  })();

  if (!escala || !usosE || !catE) {
    anotarSinMaterial('MATERIAL · la escala y sus usos se dejan leer',
      'no se pudo leer: ' + [!escala && 'ESTADOS', !usosE && 'USOS_CON_ESTADO',
        !catE && 'el catálogo'].filter(Boolean).join(', '));
  } else {
    comprobar('MATERIAL · la escala tiene peldaños y usos donde aplicarse',
      escala.length >= 3 && usosE.length >= 1,
      escala.length + ' peldaños sobre ' + usosE.length + ' usos');

    /* 1 · Lo que convierte el juicio en una vara: cada peldaño con SU
       criterio escrito. Sin él la v942 tiene razón y la cifra no se puede
       publicar. */
    const sinCriterio = escala.filter(e => !e.d || String(e.d).trim().length < 30).map(e => e.n);
    comprobar('cada peldaño lleva su criterio escrito, o la cifra no se puede contar',
      sinCriterio.length === 0,
      sinCriterio.length ? 'sin criterio: ' + sinCriterio.join(' · ') +
        ' — volvería a ser una opinión y no una observación contra una vara'
      : 'los ' + escala.length + ' dicen contra qué se califica');

    /* 2 · Dos peldaños del mismo color son un solo peldaño para quien mira,
       y dos del mismo peso no se pueden ordenar. */
    const cols = escala.map(e => String(e.c || '').toLowerCase());
    const pesos = escala.map(e => e.p);
    const colRep = cols.filter((c, i) => cols.indexOf(c) !== i);
    const pesRep = pesos.filter((v, i) => pesos.indexOf(v) !== i);
    comprobar('ningún peldaño repite color ni peso',
      colRep.length === 0 && pesRep.length === 0 && cols.every(c => /^#[0-9a-f]{6}$/.test(c)),
      (colRep.length || pesRep.length) ? 'repetidos — color: ' + (colRep.join(',') || '—') +
        ' · peso: ' + (pesRep.join(',') || '—') + ': dos peldaños iguales son uno solo'
      : 'los ' + escala.length + ' se distinguen por color y se ordenan por peso');

    /* 3 · Todo uso declarado existe en el catálogo. Un renombre allá dejaría
       el campo apagado en silencio, que es la forma de la v974. */
    const fantasmaU = usosE.filter(u => !catE.some(x => x.u === u));
    comprobar('todo uso con estado existe en el catálogo',
      fantasmaU.length === 0,
      fantasmaU.length ? 'no está en la Matriz: ' + fantasmaU.join(' · ') +
        ' — el campo quedaría apagado sin que nada lo dijera'
      : 'los ' + usosE.length + ' están');

    /* 4 · Y el arbolado NO lo lleva: «Árbol en riesgo (inclinado, seco o
       ahuecado)» ya es un TIPO del catálogo, así que tener las dos cosas
       serían dos maneras de codificar un solo hecho. */
    const arbol = usosE.indexOf('Arbolado Urbano') >= 0;
    comprobar('el arbolado NO lleva estado: su riesgo ya es un tipo del catálogo',
      !arbol,
      arbol ? 'lo lleva, y «Árbol en riesgo» ya es un tipo: dos codificaciones de un hecho'
            : 'el riesgo del árbol se dice por su tipo y en ningún otro sitio');

    /* 5 · El color vive en UN sitio. Escrito en cada hoja de estilo serían
       cuatro verdes que se separan, y el que se separaría es el que nadie
       vuelve a mirar. */
    /* Y se mide sobre las REGLAS DEL ESTADO, no sobre la hoja entera. La
       primera versión buscaba el hex en todo el archivo y denunció
       `css/72` por `--edu-ok:#1B9E6B` y `--edu-bad:#C2410C`, que son tokens
       de la paleta educativa y no tienen nada que ver: los dos coinciden
       porque la escala se pintó A PROPÓSITO con los colores que este
       proyecto ya usa para «resuelto» y «mal», y enseñar dos verdes para dos
       cosas parecidas sería peor. Que coincidan hoy no los hace una sola
       cosa —rebautizar la paleta educativa no debe repintar una escala de
       condición— así que se les deja coincidir, y lo que se vigila es que
       ninguna regla DEL ESTADO escriba el color por su cuenta.

       Una guarda con falsos positivos termina en una lista de excepciones
       que envejece hasta no significar nada (v895). */
    const hojas = ['css/52-urbis-pro-city.css', 'css/83-moderacion-foto.css',
                   'css/72-edu-diseno.css', 'css/68-procity-reconocimiento.css'];
    const coladas = [];
    hojas.forEach(f => {
      let c = '';
      try { c = leer(f); } catch (e) { return; }
      /* Cada regla por separado: del selector a su llave de cierre. Lo que
         importa es si una regla que pinta el estado trae un hex de la
         escala, no si el hex existe en algún otro sitio del archivo. */
      (c.match(/[^{}]*\{[^{}]*\}/g) || []).forEach(regla => {
        if (!/estado/i.test(regla.split('{')[0])) return;
        const cuerpo = regla.slice(regla.indexOf('{')).toLowerCase();
        cols.forEach(h => { if (cuerpo.indexOf(h) >= 0) coladas.push(f + ' → ' + h); });
      });
    });
    comprobar('ninguna regla del estado escribe el color de un peldaño',
      coladas.length === 0,
      coladas.length ? 'colado: ' + coladas.join(' · ') + ' — se separaría del vocabulario'
                     : 'las ' + hojas.length + ' lo reciben por --e desde js/03e');

    /* 6 · Las cuatro superficies lo leen, y TODAS por el lector: la casilla
       se resuelve en js/04 y en ningún otro sitio. Un dato que se guarda y
       que ninguna pantalla alcanza se ve igual que uno que no existe —la
       clase C, y el defecto que la v985 encontró en este mismo panel—. */
    /* Se mide DENTRO de la función que pinta cada superficie, no en el
       archivo entero: js/20 lee el estado dos veces —para prellenar el
       formulario al editar y para el panel del punto— así que buscarlo suelto
       daba por buena una superficie muda. Es la lección de la v854, y la
       inyección fiel fue la que lo enseñó. */
    const dentroDe = (txt, nom, fin) => {
      const i = txt.indexOf(nom); if (i < 0) return '';
      const j = txt.indexOf(fin, i); return j < 0 ? txt.slice(i) : txt.slice(i, j);
    };
    const superficies = [
      [j10e, 'el globo y la ficha'],
      [dentroDe(j20e, 'function fichaDeProCity(', '\n  }'), 'el panel del punto'],
      [dentroDe(j68e, 'function levantadoDeCampo(', '\n  }'), 'el recuento']
    ];
    const mudas = superficies.filter(([t]) => !/URBIS_ESTADO\s*\.\s*leer|LE\.leer/.test(t));
    comprobar('el globo, la ficha, el panel y el recuento leen el estado',
      mudas.length === 0,
      mudas.length ? 'no lo alcanzan: ' + mudas.map(x => x[1]).join(' · ')
                   : 'las ' + superficies.length + ' pasan por URBIS_ESTADO.leer');

    /* 7 · El guardado va condicionado a que el bloque esté en pantalla, o
       editar un punto por otro camino borraría el estado que alguien juzgó.
       Es literalmente el defecto que la v986 pagó con las fotos. */
    const iG = j12e.indexOf('function guardarEstadoUrbano(');
    const cG = iG >= 0 ? j12e.slice(iG, j12e.indexOf('})();', iG)) : '';
    const condicionado = !!cG && /getElementById\('ins-estado'\)/.test(cG) && /if \(!insEst\) return;/.test(cG);
    comprobar('el guardado no toca la casilla si el bloque no está en pantalla',
      condicionado,
      condicionado ? 'editar por otro camino no borra el estado levantado'
        : !cG ? 'no hay guardado del estado: lo que se elige no se guarda'
              : 'escribe siempre: editar un punto por otro camino borraría lo levantado');

    /* 8 · El recuento va POR USO. Una sola cifra sobre canecas, tapas,
       murales, vallas y vías no describe ninguna de las cinco (v854, v988). */
    const iR = j68e.indexOf('function resumenEstado(');
    const cR = iR >= 0 ? j68e.slice(iR, j68e.indexOf('\n  }', iR)) : '';
    const porUso = !!cR && /usos:\s*filas/.test(cR);
    comprobar('el recuento del estado va por uso y con su denominador',
      porUso && /cobertura/.test(cR),
      porUso ? 'un grupo por uso, cada uno con su cobertura'
             : 'una sola cifra para los cinco usos: no describiría ninguno');

    /* 9 · El aviso viaja con la CIFRA y no con la pantalla, que es la regla
       del aviso de origen (v867): una pantalla nueva lo hereda. */
    const avisoEnVoc = /AVISO\s*:/.test(j03e);
    const avisoEnCifra = /aviso:\s*\(VE && VE\.AVISO\)/.test(j68e);
    comprobar('el aviso de que es un juicio viaja con la cifra',
      avisoEnVoc && avisoEnCifra,
      (avisoEnVoc && avisoEnCifra) ? 'una pantalla nueva lo hereda sin que su autor se acuerde'
        : 'sin aviso en: ' + [!avisoEnVoc && 'el vocabulario', !avisoEnCifra && 'el recuento']
            .filter(Boolean).join(' y ') + ' — un juicio a secas se lee como una inspección');

    /* 10 · El archivo entra por las DOS puertas. Sin el service worker, un
       teléfono con la aplicación instalada no lo descarga y el campo no sale,
       sin un solo error (v981). */
    const enIndex = /03e-estado-urbano\.js/.test(leer('index.html'));
    const enSW = /03e-estado-urbano\.js/.test(leer('service-worker.js'));
    comprobar('el vocabulario entra por index.html y por el service worker',
      enIndex && enSW,
      (enIndex && enSW) ? 'las dos puertas'
        : 'falta en: ' + [!enIndex && 'index.html', !enSW && 'el service worker'].filter(Boolean).join(' y '));

    /* 11 · Guarda de la guarda: si el lector dejara de mirar la casilla, todo
       lo de arriba seguiría en verde sobre un campo que nadie lee. */
    const iL = j04e.indexOf('window.URBIS_ESTADO = Object.assign');
    const cL = iL >= 0 ? j04e.slice(iL, j04e.indexOf('\n  });', iL)) : '';
    /* El valor CRUDO tiene que salir de la casilla, no basta con nombrarla:
       la primera versión pasaba en verde con el índice cambiado, porque
       `idxEstado: URBIS_SLOTS.estadoUrbano` seguía ahí. */
    const mira = /crudo\s*=\s*String\(d\[URBIS_SLOTS\.estadoUrbano\]/.test(cL)
              && /estadoPorNombre/.test(cL);
    comprobar('y el lector sigue mirando su casilla y la escala',
      mira,
      mira ? 'la casilla se resuelve en js/04 y en ningún otro sitio'
           : 'dejó de mirarlas: el campo sería documentación');
  }
}

/* ── «Tiene pisos» es del TIPO y no del USO (v991) ─────────────────────────
   Hasta la v990 lo decidía el uso, y `Deportivo` estaba en la lista de «sin
   pisos» entera: una cancha no tiene plantas y un coliseo sí, y son tipos del
   mismo uso. El módulo se contradecía consigo mismo desde la v989, que hizo de
   «Deportivo o gimnasio» un uso de PISO válido.

   La excepción va por TIPO y no partiendo el uso, porque el tipo se guarda como
   texto dentro del registro (v982). Lo que se guarda acá es que la excepción no
   se vuelva un no-op silencioso ni se olvide en uno de sus cuatro lectores. */
console.log('\n  -- «tiene pisos» es del tipo y no del uso (v991) --');
{
  const j03b = soloCodigo(leer('js/03b-edificio-vocabulario.js'));
  const j20b = soloCodigo(leer('js/20-mobile-functional-app.js'));

  /* El terminador se INCLUYE: cortando en su primer carácter el objeto se
     queda sin cerrar y el eval revienta con «Unexpected token» — que desde la
     guarda de MATERIAL se ve igual que una tabla que no existe. */
  const NO_SE_SABE = 'No se sabe';
  const leerTabla = (txt, nom, ab, ce) => {
    const i = txt.indexOf(nom);
    if (i < 0) return null;
    const a = txt.indexOf(ab, i), c = txt.indexOf(ce, a);
    if (a < 0 || c < 0) return null;
    try { return eval('(' + txt.slice(a, c + ce.length) + ')'); } catch (e) { return null; }
  };
  const conPisos = leerTabla(j03b, 'const TIPOS_CON_PISOS', '{', '\n  }');
  const sinPisos = leerTabla(j03b, 'const USOS_MATRIZ_SIN_PISOS', '[', ']');
  const usosPiso = leerTabla(j03b, 'const USOS_PISO', '[', '\n  ]');
  const cat = (() => {
    const i = j20b.indexOf('const PROCITY_MATRIZ_USOS = [');
    if (i < 0) return null;
    const a = j20b.indexOf('[', i), c = j20b.indexOf('\n  ];', a);
    try { return eval(j20b.slice(a, c + 4)); } catch (e) { return null; }
  })();

  if (!conPisos || !sinPisos || !usosPiso || !cat) {
    anotarSinMaterial('MATERIAL · las cuatro listas de la excepción se dejan leer',
      'no se pudo leer: ' + [!conPisos && 'TIPOS_CON_PISOS', !sinPisos && 'USOS_MATRIZ_SIN_PISOS',
        !usosPiso && 'USOS_PISO', !cat && 'el catálogo'].filter(Boolean).join(', ') +
      ' — sin ellas nada de lo de abajo comprueba una excepción');
  } else {
    const tipos = Object.keys(conPisos);
    comprobar('MATERIAL · la excepción por tipo tiene contenido',
      tipos.length >= 1, tipos.length + ' tipos ganan plantas por su cuenta');

    /* 1 · Un tipo mal escrito es un no-op que se lee igual que uno que
       funciona. Es la lección de la v973 con los sinónimos y la de la v975
       con los de especie. */
    const fantasma = tipos.filter(t => !cat.some(u => (u.t || []).indexOf(t) >= 0));
    comprobar('todo tipo de la excepción existe en el catálogo',
      fantasma.length === 0,
      fantasma.length ? 'no está en ningún uso: ' + fantasma.join(' · ') +
        ' — la excepción no haría nada y se leería igual que si funcionara'
      : 'los ' + tipos.length + ' están en el catálogo');

    /* 2 · Y su uso tiene que ser de los que NO tienen pisos: si su uso ya los
       tiene, la excepción tampoco hace nada. */
    const sobra = tipos.filter(t => {
      const u = cat.find(x => (x.t || []).indexOf(t) >= 0);
      return u && sinPisos.indexOf(u.u) < 0;
    });
    comprobar('y su uso es de los que NO tienen pisos, o la excepción sobra',
      sobra.length === 0,
      sobra.length ? 'su uso ya tiene plantas, así que la excepción es un no-op: ' + sobra.join(' · ')
                   : 'los ' + tipos.length + ' son la excepción de un uso sin plantas');

    /* 3 · Con qué se prellena cada planta tiene que ser un uso de piso de
       verdad: un valor inventado dejaría el desplegable en blanco. */
    const malPre = tipos.filter(t => usosPiso.indexOf(conPisos[t]) < 0);
    comprobar('lo que prellena cada planta es un uso de piso del vocabulario',
      malPre.length === 0,
      malPre.length ? 'prellenan con algo que no está en USOS_PISO: ' + malPre.join(' · ')
                    : 'los ' + tipos.length + ' prellenan con un uso de piso real');

    /* 4 · Los cuatro lectores pasan el TIPO. Falla CERRADO: uno que solo pase
       el uso sigue compilando y vuelve a la respuesta de antes en silencio,
       que es exactamente como se perdió el discriminante hasta la v984. */
    const lectores = [
      ['js/20-mobile-functional-app.js', 'el formulario'],
      ['js/24-procity-analisis.js', 'el análisis por área'],
      ['js/64-analisis-edu.js', 'la cadena al motor'],
      ['js/68-procity-reconocimiento.js', 'el conteo de campo']
    ];
    const cojos = lectores.filter(([f]) =>
      !/\.tienePisos\(\s*[^,)]+,\s*[^)]+\)/.test(soloCodigo(leer(f))));
    comprobar('los cuatro lectores deciden con el uso Y el tipo',
      cojos.length === 0,
      cojos.length ? 'deciden solo con el uso: ' + cojos.map(x => x[1]).join(' · ') +
        ' — un coliseo volvería a no tener plantas ahí'
      : 'los ' + lectores.length + ' pasan los dos');

    /* 5 · Guarda de la guarda: si `tienePisos` dejara de mirar la tabla, todo
       lo de arriba seguiría en verde sobre una excepción que no se aplica. */
    const iT = j03b.indexOf('function tienePisos(');
    const cT = iT >= 0 ? j03b.slice(iT, j03b.indexOf('\n  }', iT)) : '';
    const mira = /TIPOS_CON_PISOS/.test(cT);
    const miraPre = /TIPOS_CON_PISOS/.test((() => {
      const i = j03b.indexOf('function usoPisoPorDefecto(');
      return i < 0 ? '' : j03b.slice(i, j03b.indexOf('\n  }', i));
    })());
    comprobar('y tienePisos y el prellenado siguen mirando la tabla',
      mira && miraPre,
      (mira && miraPre) ? 'la excepción se aplica en las dos puertas'
        : 'dejó de mirarla: ' + [!mira && 'tienePisos', !miraPre && 'usoPisoPorDefecto']
            .filter(Boolean).join(' y ') + ' — la tabla sería documentación');
  }
}

/* ── El texto de un gráfico se lee a su tamaño (v990) ──────────────────────
   El texto de un SVG con `viewBox` se escala con el dibujo. Con 720 unidades
   metidas en los 312 px de un teléfono, los 13,4 px de `--t-8` salían
   impresos a 5,8 en los ocho gráficos de barras y torta, y a 5,4 en las cinco
   series —la v972 midió los primeros y dio por buenas las segundas; medirlas
   otra vez desmintió esa mitad—. No se ve leyendo el CSS, donde el número
   está bien escrito.

   Todo lo de abajo persigue que ninguna de las dos maneras de recaer vuelva:
   un ancho escrito a mano, o un tamaño de letra escrito a mano. */
console.log('\n  -- el texto de un gráfico se lee a su tamaño (v990) --');
{
  const j70 = soloCodigo(leer('js/70-seguimiento.js'));
  const c70 = leer('css/70-seguimiento.css');

  const tieneMedida = /function medirLienzo\s*\(/.test(j70) &&
                      /function repartoDeBarras\s*\(/.test(j70) &&
                      /function altoDelPie\s*\(/.test(j70);
  if (!tieneMedida) {
    anotarSinMaterial('MATERIAL · la familia de gráficos se deja medir',
      'faltan medirLienzo, repartoDeBarras o altoDelPie: nada de lo de abajo significa algo');
  } else {
    /* 1 · Ningún gráfico fija su propio ancho.
       Falla CERRADO: un gráfico nuevo que escriba `var w = 720` sale en rojo
       en su primera composición, no tres tandas después. */
    const duros = [...j70.matchAll(/\bvar\s+[wW]\s*=\s*(\d{3})\b/g)].map(m => m[1]);
    comprobar('ningún gráfico fija su ancho a mano: todos lo miden',
      duros.length === 0,
      duros.length ? 'anchos escritos a mano: ' + duros.join(', ') +
        ' — su texto se encogería con el dibujo'
      : 'los ' + (j70.match(/anchoG\(\)|anchoHeroe\(\)/g) || []).length +
        ' sitios que dibujan leen el ancho medido');

    /* 2 · Y la medida se toma ANTES de dibujar nada. */
    const iB = j70.indexOf('function bloqueDeGraficos(');
    const cab = iB >= 0 ? j70.slice(iB, iB + 900) : '';
    const iMed = cab.indexOf('medirLienzo('), iPinta = cab.indexOf('pintarHeroe(');
    const mideAntes = iMed > 0 && (iPinta < 0 || iMed < iPinta);
    comprobar('la medida se toma antes de dibujar nada',
      mideAntes,
      mideAntes ? 'bloqueDeGraficos mide y después dibuja'
        : iMed < 0 ? 'dibuja sin medir: los gráficos saldrían al ancho de respaldo'
                   : 'mide DESPUÉS de dibujar el héroe: ese saldría al ancho de respaldo');

    /* 3 · La sonda sube al primer antepasado maquetado.
       Esto NO se ve leyendo, y por eso lleva su comprobación: la portada se
       pinta con su vista todavía en `display:none`, así que el contenedor
       mide cero y la sonda daría el tope. */
    const iM = j70.indexOf('function medirLienzo(');
    const cM = iM >= 0 ? j70.slice(iM, j70.indexOf('\n  }', iM)) : '';
    const sube = /while\s*\([^)]*clientWidth[\s\S]{0,60}parentElement/.test(cM);
    comprobar('la sonda sube al primer antepasado que sí esté maquetado',
      sube,
      sube ? 'no la engaña una vista todavía apagada'
           : 'mide donde le dicen: con la vista en display:none daría cero y caería al tope');

    /* 4 · Ningún texto del bloque lleva su tamaño escrito a mano.
       Los dos que había —11 y 12 en las series— son justamente los que se
       leían a 5,4 px, y venían de fuera de la escala tipográfica. */
    const fs = [...j70.matchAll(/'font-size':\s*'(\d+)'/g)].map(m => m[1]);
    comprobar('ningún texto de un gráfico lleva su tamaño escrito a mano',
      fs.length === 0,
      fs.length ? 'tamaños sueltos: ' + fs.join(', ') +
        ' — quedan fuera de la escala tipográfica del módulo'
      : 'todos salen de las clases sp-g-*, que son la misma escala del resto');

    /* 5 · Todo gráfico de barras con columna de rótulos pasa por el mismo
       reparto. Con dos maneras, la de la tanda siguiente volvería a escribir
       su `etq` a ojo y a tacharse el rótulo en un teléfono. */
    const conBarras = ['grafDivergentes', 'grafAgrupadas', 'grafBarras', 'grafOrganigrama'];
    const sinReparto = conBarras.filter(n => {
      const i = j70.indexOf('function ' + n + '(');
      if (i < 0) return true;
      const j = j70.indexOf('\n  }', i);
      return !/repartoDeBarras\(/.test(j70.slice(i, j < 0 ? i + 4000 : j));
    });
    comprobar('todo gráfico de barras reparte su ancho por la misma puerta',
      sinReparto.length === 0,
      sinReparto.length ? 'con su propio reparto: ' + sinReparto.join(', ')
                        : 'los ' + conBarras.length + ' llaman a repartoDeBarras');

    /* 6 · El pie mide su propio alto. Iba con un alto fijo de 34 y dos
       renglones a 13 de separación: con la letra en su tamaño de verdad los
       dos renglones se pisaban y el más largo se salía del lienzo. */
    const fijo = /\bPIE_ALTO\b/.test(j70);
    const nAlto = (j70.match(/altoDelPie\(/g) || []).length;
    comprobar('el pie de cada gráfico mide su propio alto',
      !fijo && nAlto >= 6,
      fijo ? 'queda un alto de pie fijo: el pie que no quepa se pisa con el dibujo'
           : nAlto + ' gráficos reservan el alto que el pie de verdad ocupa');

    /* 7 · Guarda de la guarda. Si `repartoDeBarras` dejara de medir con
       `anchoRotulo`, todo lo de arriba seguiría en verde sobre una regla que
       volvió a ser un número a ojo. */
    const iR = j70.indexOf('function repartoDeBarras(');
    const cR = iR >= 0 ? j70.slice(iR, j70.indexOf('\n  }', iR)) : '';
    const mide = /anchoRotulo/.test(cR);
    comprobar('y el reparto sigue midiendo con anchoRotulo, no con un corte a ojo',
      mide,
      mide ? 'la columna y la zona salen de lo que mide el texto'
           : 'dejó de medir: la regla volvió a ser un número escrito a mano');

    /* 8 · Las dos familias de gráfico comparten tope.
       Con anchos distintos, la misma letra saldría a dos tamaños en el mismo
       bloque: el dibujo se escala y el texto con él. */
    const topeG = /\.sp-g\{[^}]*max-width:\s*760px/.test(c70.replace(/\s+/g, ' ').replace(/\. sp/g, '.sp'));
    const topeL = /\.sp-graf \.sp-lienzo\{[^}]*max-width:\s*760px/.test(
      c70.replace(/\s+/g, ' ').replace(/\{\s+/g, '{'));
    comprobar('las dos familias de gráfico tienen el mismo tope de ancho',
      topeG && topeL,
      (topeG && topeL) ? 'sp-g y sp-lienzo caben en los mismos 760'
        : 'sin tope en: ' + [!topeG && '.sp-g', !topeL && '.sp-lienzo'].filter(Boolean).join(' y ') +
          ' — la misma letra saldría a dos tamaños en el mismo bloque');
  }
}

/* ── Un error de GPS dice CUÁL de los tres es (v996) ───────────────────────
   El navegador contesta un error de geolocalización con un código —1 permiso
   negado, 2 sin señal, 3 corte por tiempo— y son tres cosas con tres remedios
   distintos. Medido antes de escribir: de los diez sitios que leen el GPS,
   NUEVE reportaban cualquiera de los tres como un problema de permisos y uno
   solo miraba el código.

   La v978 ya lo había escrito para el botón de ubicar —«un corte por tiempo
   bajo techo NO es un problema de permisos, y mandar a alguien a la pantalla
   de ajustes nombra un remedio que no puede funcionar»— y lo arregló solo
   ahí. Es la falta de la v867 con el agravante de que el remedio es falso:
   quien va a los ajustes encuentra el permiso concedido y se queda igual. */
console.log('\n  -- un error de GPS dice cuál de los tres es (v996) --');
{
  const jsGps = ['js/05-helpers-temporal-security.js', 'js/12-spa-ui.js',
    'js/13i-vitrina.js', 'js/17-sport.js', 'js/20-mobile-functional-app.js',
    'js/21-mobile-mobility-pro.js', 'js/36-mobility-static-search.js',
    'js/37-mobility-state-controller.js', 'js/78-presencia.js'];
  const j05g = soloCodigo(leer('js/05-helpers-temporal-security.js'));

  /* El clasificador, cortado por sus dos extremos y no por un número de
     líneas: un corte por distancia envejece (v935). */
  const iC = j05g.indexOf('window.urbisRazonDeErrorGps = function');
  const cC = iC >= 0 ? j05g.slice(iC, j05g.indexOf('\n  };', iC)) : '';

  /* MATERIAL primero (v920): sin sitios que lean el GPS de verdad, todo lo
     de abajo pasaría por no tener nada que mirar. */
  const lectores = jsGps.filter(f => /geolocation\.(getCurrentPosition|watchPosition)/
    .test(soloCodigo(leer(f))));
  if (lectores.length < 5 || !cC) {
    anotarSinMaterial('MATERIAL · hay sitios que leen el GPS y un clasificador que leer',
      'lectores: ' + lectores.length + ' · clasificador: ' + (cC ? 'sí' : 'no'));
  } else {
    comprobar('MATERIAL · hay sitios que leen el GPS y un clasificador que leer',
      true, lectores.length + ' archivos leen el GPS, y el clasificador se deja cortar');

    /* 1 · El clasificador separa los TRES códigos. Con dos ramas, una de las
       tres situaciones se reportaría como otra, que es el defecto entero. */
    const tres = /=== 1/.test(cC) && /=== 2/.test(cC) && /=== 3/.test(cC);
    comprobar('el clasificador separa los tres códigos del navegador',
      tres,
      tres ? 'permiso negado, sin señal y corte por tiempo salen cada uno por su rama'
           : 'no los separa: ' + [!/=== 1/.test(cC) && '1', !/=== 2/.test(cC) && '2',
             !/=== 3/.test(cC) && '3'].filter(Boolean).join(' · ') +
             ' — una situación se reportaría como otra');

    /* 2 · Y cada rama dice QUÉ pasó y QUÉ hacer, que son dos cosas: un vacío
       que no dice cómo se llena es la mitad del trabajo (v880). */
    const ques = (cC.match(/\bque = /g) || []).length;
    const rems = (cC.match(/\bremedio = /g) || []).length;
    comprobar('cada rama dice qué pasó Y qué hacer',
      ques >= 4 && rems === ques,
      (ques >= 4 && rems === ques)
        ? ques + ' ramas, y cada una con su remedio'
        : ques + ' causas contra ' + rems + ' remedios: alguna rama nombraría un problema sin salida');

    /* 3 · Sin código NO se inventa uno. Un error que no viene del GPS
       —el catch de js/21 es de la función entera— clasificado como «permiso
       negado» sería la misma mentira por otra puerta. */
    const conCero = /codigo: c/.test(cC) && /c = err && typeof err\.code === 'number' \? err\.code : 0/.test(cC);
    comprobar('sin código no se inventa uno',
      conCero,
      conCero ? 'lo que no trae código sale con 0 y con la frase de lo que consta'
              : 'lo deduce: un error que no es del GPS saldría clasificado como uno de los tres');

    /* 4 · Ningún sitio servido nombra el permiso de ubicación fuera del
       clasificador. Falla CERRADO (v880): un sitio nuevo que escriba «revise
       los permisos» sale en rojo en su primera composición, no tres tandas
       después.

       Se persigue la FRASE del permiso de GPS y no la palabra «permiso» a
       secas: esta aplicación tiene decenas de permisos de ROL —dar permiso a
       un usuario, permisos de JAC— y una guarda con esa clase de falso
       positivo termina en una lista de excepciones que envejece hasta no
       significar nada (v895). */
    const frase = /permisos? de (ubicaci[oó]n|GPS|gps)/;
    const culpan = [];
    fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)
      .concat(fs.readdirSync(RAIZ).filter(f => f.endsWith('.html'))).forEach(f => {
      const txt = leer(f); if (!txt) return;
      soloCodigo(txt).split('\n').forEach((ln, i) => {
        if (!frase.test(ln)) return;
        if (f === 'js/05-helpers-temporal-security.js' && /remedio = /.test(ln)) return;
        culpan.push(f + ':' + (i + 1));
      });
    });
    comprobar('ningún sitio nombra el permiso de ubicación sin mirar el código',
      culpan.length === 0,
      culpan.length === 0
        ? 'el permiso solo se nombra donde el código dice que es el permiso'
        : 'lo nombra pase lo que pase: ' + culpan.join(' · ') +
          ' — un corte por tiempo mandaría a una pantalla de ajustes que no lo arregla');

    /* 5 · Guarda contra pasarse (v879, v882, v890): en el caso 1 el permiso
       SÍ es el remedio, y tiene que seguir nombrándose. Sin esta, el arreglo
       podría ser dejar de hablar de permisos en ninguna parte, y quien de
       verdad lo tiene negado se quedaría sin saber qué hacer. */
    const i1 = cC.indexOf('=== 1');
    const rama1 = i1 >= 0 ? cC.slice(i1, cC.indexOf('} else', i1)) : '';
    const nombra = /ajustes del navegador/.test(rama1) && /permiso de ubicaci/.test(rama1);
    comprobar('y con el permiso negado el remedio SIGUE siendo el permiso',
      nombra,
      nombra ? 'la rama del código 1 manda a los ajustes del navegador, que es donde se arregla'
             : 'dejó de nombrarlo: quien tiene el permiso negado se queda sin remedio');

    /* 6 · El calentamiento del módulo deportivo no cierra en un error
       transitorio. Es la regla que la v978 midió con la sonda —el chip se cae
       un segundo bajo un alero y vuelve MEJOR— y que acá seguía sin
       aplicarse: cualquier error abortaba un arranque que estaba a punto de
       conseguir señal. */
    const j20g6 = soloCodigo(leer('js/20-mobile-functional-app.js'));
    const iW = j20g6.indexOf('warmWatch = navigator.geolocation.watchPosition');
    const cW = iW >= 0 ? j20g6.slice(iW, j20g6.indexOf('warmTimer =', iW)) : '';
    const iE = cW.indexOf('}, err=>{');
    const cE = iE >= 0 ? cW.slice(iE) : '';
    const sale = /esPermiso\)\s*return;/.test(cE);
    comprobar('el calentamiento del deportivo solo aborta con el permiso negado',
      cE && sale,
      (cE && sale)
        ? 'un corte por tiempo o una caída de señal lo dejan seguir, y cierra el reloj con la mejor lectura'
        : (cE ? 'cierra con cualquier error: congela un arranque que iba a conseguir señal'
              : 'no se pudo leer su manejador de error'));

    /* 7 · Guarda de la guarda (v878): si `esPermiso` dejara de salir del
       código, lo de arriba seguiría en verde sobre una bandera constante y el
       calentamiento volvería a cerrarse con cualquier error. */
    const deriva = /esPermiso: c === 1/.test(cC);
    comprobar('y esPermiso sigue saliendo del código, no de una bandera',
      deriva,
      deriva ? 'se calcula del código que contestó el navegador'
             : 'dejó de calcularse: con una bandera fija, el calentamiento cerraría con cualquier error');
  }
}

/* ── Una vía es un TRAMO, no un punto (v1002) ──────────────────────────────
   «Una línea o polilínea para las vías». Es lo que le faltaba al estado
   (v992) y a la superficie (v1000) para describir algo: «asfalto, regular»
   sobre un punto no dice de qué cuadra se habla.

   El punto SE QUEDA, y eso es la mitad del diseño: es lo que dibuja el
   reporte, lo que lo encuentra una búsqueda por cercanía y lo que
   `proCity.editLat` usa para volver a abrirlo. Mover el punto al centro de la
   línea habría cambiado la identidad de la fila para ganar un detalle de
   dibujo.

   Y lo que de verdad hay que guardar es el MODO: intercepta los toques del
   mapa, así que si se filtrara, cada toque marcaría un vértice en vez de
   abrir el formulario de mapear — y eso es lo que se hace todos los días. */
console.log('\n  -- girar el teléfono vuelve a medir los gráficos (v1009) --');
{
  const j70 = soloCodigo(leer('js/70-seguimiento.js'));

  /* MATERIAL primero (v920): sin el medidor de la v995 no hay nada que
     rehacer, y todo lo de abajo pasaría por no tener nada delante. */
  const hayMedidor = /function medirLienzo\(/.test(j70) && /var _anchoG/.test(j70);
  if (!hayMedidor) {
    anotarSinMaterial('MATERIAL · el medidor del lienzo se deja leer',
      'sin medirLienzo no hay ancho que rehacer');
  } else {
    comprobar('MATERIAL · el medidor del lienzo se deja leer',
      true, 'medirLienzo y _anchoG, que es lo que el giro vuelve a calcular');

    /* El cuerpo del rehacer, de su declaración al cierre de su try/catch. Se
       mide DENTRO del trozo y no sobre el archivo entero (v854): `medirLienzo`
       sale también en `bloqueDeGraficos`, y buscarlo suelto daría por buena
       una función que ya no vuelve a medir. */
    const iR = j70.indexOf('function rehacerGraficosSiCambioElAncho()');
    const cR = iR >= 0 ? j70.slice(iR, j70.indexOf("window.addEventListener('resize'", iR)) : '';

    comprobar('el giro vuelve a MEDIR el ancho antes de rehacer nada',
      /medirLienzo\(/.test(cR),
      cR ? (/medirLienzo\(/.test(cR)
        ? 'lo vuelve a medir del sitio, no lo supone de la ventana'
        : 'no mide: repintaría con el ancho de antes y el texto seguiría a 32,7 px')
        : 'no se encontró la función que rehace los gráficos');

    /* Y SOLO si cambió. Sin esta condición, la barra de direcciones de un móvil
       —que dispara `resize` al desplazarse— recompondría trece dibujos por
       nada, con su salto visual. Es la regla de la v870. */
    comprobar('y solo rehace cuando el ancho CAMBIÓ de verdad',
      /Math\.abs\([\s\S]{0,60}\)\s*<\s*GIRO_MIN_PX/.test(cR) && /return;/.test(cR),
      /Math\.abs\([\s\S]{0,60}\)\s*<\s*GIRO_MIN_PX/.test(cR)
        ? 'por debajo del umbral se sale sin tocar el DOM'
        : 'rehace en todo resize: un desplazamiento con la barra de direcciones recompondría trece dibujos');

    /* El rebote: un giro dispara decenas de `resize` y repintar en cada uno es
       el teléfono caliente que la v870 nombra. */
    const iL = j70.indexOf('_giro = setTimeout');
    comprobar('y espera a que el gesto termine, no repinta en cada resize',
      iL > 0 && /clearTimeout\(_giro\)/.test(j70),
      iL > 0 && /clearTimeout\(_giro\)/.test(j70)
        ? 'rebote con clearTimeout: una sola recomposición por giro'
        : 'sin rebote: decenas de recomposiciones mientras se gira');

    /* No puede tumbar la vista: un ajuste de dibujo no cuesta una pantalla. */
    comprobar('y un fallo del rehacer no se lleva la página por delante',
      /try \{/.test(cR) && /catch \(e\)/.test(cR),
      /catch \(e\)/.test(cR) ? 'se traga el error, como el aviso de paso de la v870'
                              : 'sin catch: un ajuste de dibujo podría costar la vista');

    /* La guarda de la guarda: si `bloqueDeGraficos` dejara de anotar dónde se
       pintó, todo lo de arriba seguiría en verde y el rehacer no encontraría
       nunca su contenedor. */
    const iB = j70.indexOf('function bloqueDeGraficos(');
    const cB = iB >= 0 ? j70.slice(iB, iB + 300) : '';
    comprobar('y el bloque sigue anotando dónde se pintó, que es lo que el giro rehace',
      /_contGraf = cont/.test(cB),
      /_contGraf = cont/.test(cB)
        ? 'bloqueDeGraficos lo anota en su primera línea'
        : 'dejó de anotarlo: el rehacer no encontraría su contenedor y todo lo de arriba seguiría en verde');
  }
}

console.log('\n  -- una declaración de «otra tanda» lleva su estado (v1006) --');
{
  /* La sección «Una declaración de "otra tanda" también se queda vieja» dejó
     escrito el problema y una receta —un `grep`— que hay que LEER entera para
     saber cuál sigue abierta. Auditadas las catorce declaraciones, **seis
     estaban cumplidas y ninguna lo decía**: la columna «Quién informó» la hizo
     la v951, el borrador al rechazar la v954, la migración del esquema antiguo
     la v967, la lista de cedidas de la otra hoja la v920, y dos se midieron y
     se declinaron a propósito (la v936 con el mapa de afluencia y la v947 con
     la percepción impresa).

     Lo que faltaba no era la receta: era una MARCA que se pueda comprobar. Cada
     declaración cierra ahora con `pendiente` o con `cerrado en vNNNN`, y el
     grep pasa de ser un ejercicio de lectura a una lista con su estado al lado.

     De qué NO responde, dicho como la v945 y la v952 corrigieron a sus
     antecesoras: esto caza una declaración escrita con una de las tres frases
     conocidas y sin marca. Una escrita de otra manera —«queda para después»,
     «lo toma quien siga»— se le escapa, y esa mitad se sigue cazando leyendo.
     Lo que sí impide es que las catorce que hay se queden viejas otra vez. */
  const md = leer('CLAUDE.md');

  /* El texto se lee sin lo que NO es una declaración: los bloques de código
     —donde vive el propio grep de la receta—, las líneas de cita `>` y lo que
     va entre comillas angulares, que es como esta bitácora cita una frase de
     otra tanda. Sin eso, la receta se denunciaría a sí misma, que es el defecto
     que la v926 encontró con una capacidad demostrada por su comentario. */
  const fuera = [];
  let limpio = md.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length));
  /* Y el código EN LÍNEA, por lo mismo que el bloque: una frase escrita entre
     acentos graves se está NOMBRANDO, no usando —la lista de frases de esta
     misma guarda está escrita así—. Se vio al documentar la v1006: la sección
     que explica la convención se denunciaba a sí misma cinco veces. */
  limpio = limpio.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
  limpio = limpio.split('\n').map((l) => (/^\s*>/.test(l) ? ' '.repeat(l.length) : l)).join('\n');
  limpio = limpio.replace(/«[\s\S]{0,400}?»/g, (m) => ' '.repeat(m.length));

  /* Y la LISTA VIVA queda fuera a propósito: tiene su propia convención desde
     la v866 —la cláusula `ya:`, que revisar.js ya exige— y dos convenciones
     sobre la misma lista serían dos maneras de decir lo mismo (clase B). */
  const iLV = limpio.indexOf('## La lista viva: lo que al pliego educativo');
  if (iLV > 0) limpio = limpio.slice(0, iLV);

  /* Las frases se buscan por su NÚCLEO y no por la fórmula entera: al medirlo,
     «que es otra FUENTE y otra tanda» —la declaración de la v876 sobre la
     corrida municipal— se escapaba de `es otra tanda` por una palabra de por
     medio. Con el núcleo salen las catorce; con la fórmula, diez. */
  const FRASES = /(otra tanda|su propia tanda|no se hace acá)/g;
  const declaraciones = [];
  let m;
  while ((m = FRASES.exec(limpio))) {
    /* La frase se DETECTA sobre el texto recortado y la marca se LEE del
       original: los recortes sustituyen por espacios de la misma longitud, así
       que los desplazamientos coinciden. Leer la marca del recortado la
       borraría —va entre acentos graves, como todo lo que acá se nombra— y las
       catorce saldrían sin marca. Medido: las catorce, en la primera corrida
       después de añadir el recorte del código en línea. */
    const cola = md.slice(m.index, m.index + 500);
    const marca = /`pendiente`|`cerrado en v(\d+)([^`]*)`/.exec(cola);
    const linea = md.slice(0, m.index).split('\n').length;
    declaraciones.push({ linea: linea, frase: m[0], marca: marca });
    if (!marca) fuera.push('CLAUDE.md:' + linea);
  }

  /* MATERIAL primero (v920): sin declaraciones que mirar, todo lo de abajo
     pasaría por no tener nada delante. */
  if (declaraciones.length < 5) {
    anotarSinMaterial('MATERIAL · la bitácora declara trabajo aplazado',
      declaraciones.length + ' declaraciones encontradas');
  } else {
    comprobar('MATERIAL · la bitácora declara trabajo aplazado',
      true, declaraciones.length + ' declaraciones de «otra tanda», que es contra lo que muerde la de abajo');

    comprobar('toda declaración de trabajo aplazado dice si sigue abierta o quién la cerró',
      fuera.length === 0,
      fuera.length === 0
        ? 'las ' + declaraciones.length + ' llevan su marca'
        : fuera.length + ' sin marca: ' + fuera.slice(0, 5).join(' · ') +
          ' — hay que leerlas enteras para saber si ya están hechas, que es como envejecieron seis');

    /* ── Y la OTRA familia, que la v1006 dejó declarada como su punto ciego ──
       Aquella escribió que una declaración con otras palabras se le escapa. La
       v1007 midió cuántas eran y por dónde: **veintiocho secciones tituladas
       «Lo que … NO hace / NO cierra / sigue pendiente»**, con cincuenta y dos
       renglones dentro, y **siete de ellos ya estaban hechos** —el estado del
       mobiliario en la v992, el sitio de siembra del árbol en la v993, los
       murales en la v983, los teléfonos y buzones en la v994, la cuantificación
       de especies y materiales en la v988, §4 en la v901—.

       Acá el detector NO es la frase sino el ENCABEZADO, y por eso no tiene
       falsos positivos: una sección con ese título existe solo para declarar
       trabajo aplazado. Se exige la marca por RENGLÓN y no por sección, porque
       una sección de cuatro renglones con una sola marca deja tres sin estado —
       que es exactamente como envejecieron estos siete.

       Queda fuera «Lo que NO se pudo …», que es otra cosa: una limitación de
       medición del contenedor, no trabajo que alguien decidió aplazar. */
    const HSEC = /^#{2,4} Lo que .*(NO hace|NO cierra|sigue pendiente|NO se hace|sigue faltando)/;
    const lns = md.split('\n');
    const renglones = [];
    const sinEstado = [];
    for (let i = 0; i < lns.length; i++) {
      if (!HSEC.test(lns[i]) || /NO se pudo/.test(lns[i])) continue;
      let j = i + 1;
      while (j < lns.length && !/^#{2,4} /.test(lns[j])) j++;
      const cuerpo = '\n' + lns.slice(i + 1, j).join('\n');
      const trozos = /\n\* /.test(cuerpo)
        ? cuerpo.split(/\n(?=\* )/).filter((t) => /^\* /.test(t))
        : [cuerpo];
      trozos.forEach((t) => {
        renglones.push(t);
        if (!/`pendiente`|`cerrado en v\d+/.test(t)) {
          sinEstado.push('CLAUDE.md:' + (i + 1) + ' → ' + t.trim().replace(/\n/g, ' ').slice(0, 40));
        }
      });
    }
    /* La guarda de la guarda, y es de la clase de la v926: el convenio está
       ESCRITO en la bitácora —qué encabezados cuentan— y aplicado acá en una
       expresión regular. Dos sitios para un hecho se separan, y el que se
       quedaría viejo sería el escrito: nadie lo relee. Se comprueba que la
       lista del bloque `ENCABEZADOS-APLAZADOS` y las alternativas de HSEC sean
       la misma, en las dos direcciones.

       Lo destapó la v1008: una sección titulada «Un hueco del catálogo que
       quedó medido y NO tocado» declaraba trabajo aplazado —y lo tenía cerrado
       desde la v991— sin que la comprobación la mirara, porque su encabezado no
       era ninguna de las cinco formas. Se renombró a la canónica en vez de
       aflojar la expresión, que es la decisión de la v895. */
    {
      const iC = md.indexOf('`ENCABEZADOS-APLAZADOS`');
      const bloque = iC > 0 ? md.slice(iC, md.indexOf('\n#', iC + 10)) : '';
      const escritas = [...bloque.matchAll(/^\* `([^`]+)`$/gm)].map((x) => x[1]);
      const enRegex = (String(HSEC).match(/\(([^)]+)\)/) || ['', ''])[1].split('|');
      const faltan = escritas.filter((x) => enRegex.indexOf(x) < 0);
      const sobran = enRegex.filter((x) => escritas.indexOf(x) < 0);
      comprobar('y el convenio de encabezados escrito es el mismo que se aplica',
        escritas.length >= 4 && !faltan.length && !sobran.length,
        escritas.length < 4
          ? 'no se pudo leer el bloque ENCABEZADOS-APLAZADOS: ' + escritas.length + ' formas'
          : (faltan.length || sobran.length
            ? 'se separaron — escrito y no aplicado: ' + (faltan.join(' · ') || '(nada)') +
              ' · aplicado y no escrito: ' + (sobran.join(' · ') || '(nada)')
            : 'las ' + escritas.length + ' formas coinciden en la bitácora y en la comprobación'));
    }

    comprobar('y todo renglón de una sección «Lo que NO hace» dice su estado',
      renglones.length > 10 && sinEstado.length === 0,
      renglones.length <= 10
        ? 'solo ' + renglones.length + ' renglones: el lector no encuentra las secciones'
        : (sinEstado.length === 0
          ? 'los ' + renglones.length + ' renglones de las secciones de trabajo aplazado llevan su estado'
          : sinEstado.length + ' sin estado: ' + sinEstado.slice(0, 4).join(' · ') +
            ' — siete de estos ya estaban hechos y ninguno lo decía'));

    /* Y un PISO sobre cuántos se vigilan, que es lo único que caza el fallo
       que la v1008 no podía cazar de otra manera: renombrar un encabezado
       fuera del convenio hace que su sección deje de mirarse **y todo lo demás
       siga en verde**. Medido: con el encabezado viejo devuelto, el recuento
       baja de 54 a 53 y la comprobación de arriba pasa igual.

       Es un piso y no un techo porque la cantidad solo debe subir: cada tanda
       que declare trabajo aplazado agrega renglones. Baja cuando alguien saca
       una sección del convenio —que es el fallo— o cuando una se reescribe
       entera, que es raro y también vale mirarlo. Al bajarlo a propósito se
       baja también este número, y eso se ve en el diff. */
    const PISO_APLAZADOS = 54;
    comprobar('y ninguna sección se sale del convenio y deja de vigilarse',
      renglones.length >= PISO_APLAZADOS,
      renglones.length >= PISO_APLAZADOS
        ? renglones.length + ' renglones vigilados, sobre un piso de ' + PISO_APLAZADOS + ' — solo puede subir'
        : renglones.length + ' vigilados, ' + (PISO_APLAZADOS - renglones.length) +
          ' por debajo del piso: algún encabezado dejó de ser una de las cinco formas ' +
          'y su sección ya no se mira');

    /* Una marca que nombre una versión que todavía no existe sería una
       promesa, no un estado. Se compara con el token que este mismo archivo
       ya exige que coincida en los nueve sitios. */
    const token = (leer('index.html').match(/URBIS_APP_VERSION\s*=\s*'([\w-]+)'/) || [])[1] || '';
    const hoy = parseInt(String(token).split('-')[0], 10);
    const futuras = declaraciones
      .filter((d) => d.marca && d.marca[1] && parseInt(d.marca[1], 10) > hoy)
      .map((d) => 'v' + d.marca[1]);
    comprobar('y ninguna se declara cerrada por una versión que todavía no existe',
      !futuras.length,
      futuras.length ? 'cerradas por el futuro: ' + futuras.join(' · ') + ' — hoy va en v' + hoy
                     : 'las cerradas nombran versiones ya publicadas, hasta v' + hoy);
  }
}

console.log('\n  -- una vía es un tramo, no un punto (v1002) --');
{
  const j03t = soloCodigo(leer('js/03g-tramo-via.js'));
  const j04t = soloCodigo(leer('js/04-marker-proximity.js'));
  const j20t = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j12t = soloCodigo(leer('js/12-spa-ui.js'));
  const j10t = soloCodigo(leer('js/10-visible-markers.js'));

  const tieneModulo = /window\.URBIS_TRAMO = \{/.test(j03t) &&
    /codificar:/.test(j03t) && /decodificar:/.test(j03t) && /largoM:/.test(j03t);

  /* MATERIAL primero (v920): sin módulo, todo lo de abajo pasaría por no
     tener nada delante. */
  if (!tieneModulo) {
    anotarSinMaterial('MATERIAL · el módulo del tramo se deja leer',
      'sin él no hay nada que comprobar');
  } else {
    comprobar('MATERIAL · el módulo del tramo se deja leer',
      true, 'codifica, decodifica y mide');

    /* 1 · El modo gana el toque del mapa ANTES del flujo del punto. Sin esto,
       cada toque para marcar un vértice abriría además el formulario. Es la
       misma precedencia que el área de análisis ya tiene. */
    const iC = j20t.indexOf("map.on('click', function(ev){");
    const cC = iC >= 0 ? j20t.slice(iC, j20t.indexOf('});', j20t.indexOf("pickCommunityPoint", iC))) : '';
    const iTramo = cC.indexOf('URBIS_TRAMO');
    const iPick = cC.indexOf("proCity.pickMode === 'manual'");
    comprobar('el modo de dibujo gana el toque del mapa antes que el punto',
      cC && iTramo >= 0 && iPick >= 0 && iTramo < iPick,
      !cC ? 'no se pudo leer el manejador del toque'
        : (iTramo < 0 ? 'el manejador no mira el modo: cada vértice abriría el formulario'
          : (iTramo < iPick ? 'el tramo se ataja antes de abrir el formulario'
            : 'se ataja DESPUÉS: el primer toque abriría el formulario')));

    /* 2 · TODA función que reinicia el flujo de ubicar apaga el modo. Se mide
       POR FUNCIÓN y no contando apariciones (v890): lo que tiene que seguir
       siendo cierto es que el cuerpo que toca `pickMode` suelte el dibujo, no
       que dos recuentos cuadren. Falla cerrado (v880): un modo que sobreviva
       convierte cada toque del mapa en un vértice y el punto no se puede poner. */
    const reFn = /\n  function ([A-Za-z0-9_$]+)\(/g;
    const arranques = [];
    let mFn;
    while ((mFn = reFn.exec(j20t))) arranques.push({ i: mFn.index, n: mFn[1] });
    const sinSoltar = [];
    let tocanModo = 0;
    arranques.forEach(function (a, k) {
      const cuerpo = j20t.slice(a.i, k + 1 < arranques.length ? arranques[k + 1].i : j20t.length);
      if (!/proCity\.pickMode = '/.test(cuerpo)) return;
      tocanModo++;
      if (!/soltarTramo\(\)/.test(cuerpo)) sinSoltar.push(a.n);
    });
    comprobar('toda función que reinicia el flujo de ubicar apaga el modo de dibujo',
      tocanModo > 0 && sinSoltar.length === 0,
      tocanModo === 0
        ? 'no se encontró una sola función que toque pickMode: la medición no mira nada'
        : (sinSoltar.length === 0
          ? 'las ' + tocanModo + ' que escriben pickMode sueltan el dibujo'
          : 'no lo sueltan: ' + sinSoltar.join(' · ') + ' — el modo sobreviviría y cada toque del mapa sería un vértice'));

    /* 3 · Y las tres salidas apagan el modo de verdad, en el propio módulo:
       si `terminar` no llamara a `apagar`, lo de arriba seguiría en verde. */
    const iT = j03t.indexOf('function terminar()');
    const cT = iT >= 0 ? j03t.slice(iT, j03t.indexOf('function apagar', iT)) : '';
    const apaga = /apagar\(\);/.test(cT) && /function cancelar\(\)\{ apagar\(\); \}/.test(j03t.replace(/\s+/g, ' ').replace(/\{ /g, '{ '));
    comprobar('y las tres salidas del módulo apagan el modo',
      /apagar\(\)/.test(cT) && /cancelar[\s\S]{0,40}apagar\(\)/.test(j03t),
      (/apagar\(\)/.test(cT) && /cancelar[\s\S]{0,40}apagar\(\)/.test(j03t))
        ? 'terminar y cancelar apagan; iniciar es la única que enciende'
        : 'alguna salida no apaga: el modo se quedaría encendido sin que nada lo diga');

    /* 4 · Se dibuja sobre la MISMA capa que los puntos. Una capa aparte se
       quedaría con líneas de puntos que ya no están, porque esa es la que se
       limpia en cada repintado. */
    const iR = j20t.indexOf('function renderProCityPoints');
    const cR = iR >= 0 ? j20t.slice(iR, j20t.indexOf('window.urbisRenderProCityPoints', iR)) : '';
    const mismaCapa = /pintarGuardado\(layer,/.test(cR);
    comprobar('el tramo guardado se dibuja sobre la capa de los puntos',
      mismaCapa,
      mismaCapa ? 'la misma capa que se limpia en cada repintado'
                : 'en otra capa: se quedaría con líneas de puntos borrados');

    /* 5 · Y el color sale del vocabulario del estado, no de esta pantalla.
       Escrito acá serían dos verdes que se separan a la tanda siguiente. */
    const delEstado = /URBIS_ESTADO[\s\S]{0,200}pintarGuardado/.test(cR);
    comprobar('y el color del tramo sale del estado, no de la pantalla',
      delEstado,
      delEstado ? 'lo lee de URBIS_ESTADO, que es donde vive la escala'
                : 'lo escribe acá: dos escalas de color que se separan');

    /* 6 · Guarda contra pasarse: el punto NO se mueve. Cambiar `lat`/`lng` al
       centro de la línea rompería `proCity.editLat` y la identidad de la fila. */
    const mueve = /lat:\s*String\(centro|proCity\.selected\s*=\s*\{[^}]*centroTramo/.test(j20t);
    comprobar('y el punto del reporte no se mueve al centro del tramo',
      !mueve,
      !mueve ? 'la fila conserva su lat/lng: es su identidad y lo que la vuelve a abrir al editar'
             : 'lo mueve: se rompería editLat y la fila dejaría de encontrarse');

    /* 7 · Se guarda y se PINTA (clase C): un dato que ninguna pantalla alcanza
       se ve, desde afuera, igual que uno que no existe. Se buscan los HUECOS
       de la plantilla y no los identificadores, que es la lección de la v976
       cobrada en la v1000. */
    const guarda = /guardarTramoVia/.test(j12t) && /S\.viaTramo\b/.test(j12t);
    const pinta = /\$\{tramoPopup\}/.test(j10t) && /\$\{_tramoDet\}/.test(j10t) &&
                  /\+ tramo \+/.test(j20t);
    comprobar('el tramo se guarda y se pinta donde el punto se ve',
      guarda && pinta,
      (guarda && pinta) ? 'se guarda por el reparto y sale en el globo, la ficha y el panel del punto'
        : 'falta: ' + [!guarda && 'el guardado', !pinta && 'alguna pantalla'].filter(Boolean).join(' y '));

    /* 8 · Las acciones se despachan en UN solo sitio. Con dos, cada toque
       dentro de `app` dispararía la acción dos veces —y «deshacer» quitaría
       dos vértices—. */
    const despachos = (j20t.match(/data-u52-call\^="tramo-"/g) || []).length;
    comprobar('las acciones del tramo se despachan en un solo sitio',
      despachos === 1,
      despachos === 1 ? 'un solo manejador, sobre document, que es donde la barra vive'
        : despachos + ' manejadores: cada toque dentro de app dispararía la acción dos veces');

    /* 9 · El archivo entra por las DOS puertas (v981). */
    const enIndex = leer('index.html').indexOf('js/03g-tramo-via.js') >= 0;
    const enSW = leer('service-worker.js').indexOf('js/03g-tramo-via.js') >= 0;
    comprobar('el archivo del tramo está en index.html y en el service worker',
      enIndex && enSW,
      (enIndex && enSW) ? 'entra por las dos puertas'
        : 'falta en: ' + [!enIndex && 'index.html', !enSW && 'el service worker'].filter(Boolean).join(' y '));

    /* 10 · Guarda de la guarda (v878): la casilla está repartida y el lector
       delega la decodificación en el módulo. Con la decodificación escrita en
       js/04 habría dos maneras de leer la misma cadena. */
    const casilla = /viaTramo:\s*BASE_OFFSET/.test(j04t);
    const delega = /window\.URBIS_TRAMO_PUNTO/.test(j04t) && /T\.decodificar\(txt\)/.test(j04t);
    comprobar('la casilla está repartida y el lector delega la decodificación',
      casilla && delega,
      (casilla && delega) ? 'viaTramo sale del reparto y la cadena la lee js/03g'
        : 'falta: ' + [!casilla && 'la casilla', !delega && 'la delegación'].filter(Boolean).join(' y ') +
          ' — dos maneras de leer la misma cadena se separan (v879)');
  }
}

/* ── Nada de la raíz se copia dentro de js/ (v1001) ────────────────────────
   `js/service-worker.js` existió veinte versiones y no lo cargaba NADIE: ni
   `serviceWorker.register`, ni una página, ni el propio service worker, ni
   `revisar.js`. Era una copia del de la raíz congelada en la v980.

   Lo creó un `cp /tmp/.../*.js js/` en la v981 —el comodín encontró el
   `service-worker.js` que estaba guardado en esa carpeta de respaldo— y lo
   volvió a pisar el mismo idioma en la v1000. Es la familia de la v964 con el
   `io.open(p,'w')` que truncaba y de la v995 con el reemplazo global: una
   orden que hace MÁS de lo que se le pidió y no lo dice.

   Y lo que lo hacía peligroso no era ocupar sitio: era ser una TRAMPA. Un
   service worker con la lista de archivos de la v980 esperando a que alguien
   lo registrara por error deja media aplicación vieja en el teléfono, que es
   justo lo que el reparto de la versión en nueve archivos existe para evitar.

   La guarda persigue el ACCIDENTE y no el síntoma, y sale sin un solo falso
   positivo: ningún nombre de la raíz puede repetirse dentro de `js/`. Medido
   antes de escribirla, el único que lo hacía era este. */
console.log('\n  -- nada de la raíz se copia dentro de js/ (v1001) --');
{
  const raiz = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.js'));
  const enJs = fs.readdirSync(R('js')).filter((f) => f.endsWith('.js'));
  const repes = raiz.filter((f) => enJs.indexOf(f) >= 0);

  /* MATERIAL primero (v920): sin archivos en los dos sitios no hay nada que
     cruzar y la comprobación pasaría por no tener nada delante. */
  if (!raiz.length || !enJs.length) {
    anotarSinMaterial('MATERIAL · hay archivos en la raíz y en js/ que cruzar',
      raiz.length + ' en la raíz · ' + enJs.length + ' en js/');
  } else {
    comprobar('MATERIAL · hay archivos en la raíz y en js/ que cruzar',
      true, raiz.length + ' en la raíz y ' + enJs.length + ' en js/');

    comprobar('ningún archivo de la raíz está copiado dentro de js/',
      repes.length === 0,
      repes.length === 0
        ? 'los ' + raiz.length + ' de la raíz no se repiten en js/'
        : 'copiados: ' + repes.join(' · ') +
          ' — un comodín los dejó ahí y nadie los carga; un service worker viejo esperando a que lo registren');

    /* Y la otra mitad: un service worker se reconoce por lo que HACE, no por
       cómo se llama. Un `cp` que lo dejara en js/ con otro nombre pasaría la
       de arriba, así que se busca el ciclo de vida. Los tres de verdad viven
       en la raíz y están declarados. */
    const sw = enJs.filter((f) =>
      /self\.addEventListener\(\s*['"]install['"]/.test(leer('js/' + f)));
    comprobar('y ningún archivo de js/ se comporta como un service worker',
      sw.length === 0,
      sw.length === 0
        ? 'los tres service workers viven en la raíz: ' + raiz.filter((f) => /^sw-|^service-worker/.test(f)).join(' · ')
        : 'con ciclo de vida de service worker dentro de js/: ' + sw.join(' · ') +
          ' — registrarlo por error deja media aplicación vieja en el teléfono');

    /* Y LO QUE LA MEDICIÓN DESTAPÓ AL LADO: archivos que NADIE carga.

       La v1001 midió once en `js/` y no los borró, con su razón escrita: eran
       once que no había escrito yo, en una tanda que salió de un accidente
       con un comodín, y borrar de más por arreglar de menos era lo contrario
       de lo que aquella tanda vino a hacer. La v1005 los midió de frente y sí:
       ocho eran una sola línea de comentario —su propio texto dice «módulo
       legacy desactivado»— y los otros tres exponían cinco globales que NO
       aparecen en ninguna otra parte del repositorio. Ningún `<script>` los
       nombra, ningún service worker los precachea y este proyecto no inyecta
       scripts en ningún sitio, así que borrarlos es un no-op comprobado y no
       una suposición sobre cuál gana — que es la vara que la v885 usó antes de
       retirar `limpiarRuta`.

       Y la misma medición, corrida sobre `css/`, destapó DOCE más: hojas de
       estilo que ninguna página enlaza, ningún service worker precachea y
       ningún `@import` trae. Entre ellas `99-mobile-home-reset.css`, que
       `css/54-config-admin.css` nombraba en su comentario como si su regla
       estuviera en vigor.

       Por eso la comprobación mira ahora las DOS carpetas: el defecto no era
       de `js/`, era de archivos que nadie carga, y medir solo una mitad deja
       la otra creciendo. La cadena de carga incluye los `@import` porque una
       hoja puede traer a otra —`css/main.css` trae cuarenta y nueve— y una
       medición que solo mirara el HTML denunciaría como huérfanas casi todas.

       Los dos techos van en CERO, que es el que de verdad falla cerrado
       (v880): un archivo nuevo que nadie carga salta en su primera corrida,
       en vez de esconderse dentro de un cupo que nadie vuelve a mirar. Y el
       techo ABSOLUTO es lo correcto acá con la vara de la v965 —¿puede el
       pendiente crecer sin que nadie haga nada mal?—: no puede. Solo crece si
       alguien agrega un archivo que nadie carga, que es justo lo que hay que
       impedir. */
    const TECHO_HUERFANOS = 0;
    const paginas = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
      .map((f) => leer(f)).join('\n');
    const swTodos = fs.readdirSync(RAIZ)
      .filter((f) => /^sw-|^service-worker/.test(f) && f.endsWith('.js'))
      .map((f) => leer(f)).join('\n');
    const importes = (fs.readdirSync(R('css')).filter((f) => f.endsWith('.css'))
      .map((f) => leer('css/' + f)).join('\n').match(/@import[^;]+;/g) || []).join(' ');
    const enCss = fs.readdirSync(R('css')).filter((f) => f.endsWith('.css'));

    const huerfanos = enJs.filter((f) =>
      paginas.indexOf('js/' + f) < 0 && swTodos.indexOf('js/' + f) < 0)
      .map((f) => 'js/' + f)
      .concat(enCss.filter((f) =>
        paginas.indexOf('css/' + f) < 0 && swTodos.indexOf('css/' + f) < 0 &&
        importes.indexOf(f) < 0).map((f) => 'css/' + f));

    comprobar('ningún archivo de js/ o css/ se queda sin que nadie lo cargue',
      huerfanos.length <= TECHO_HUERFANOS,
      huerfanos.length <= TECHO_HUERFANOS
        ? 'los ' + (enJs.length + enCss.length) + ' que se sirven los carga alguien'
        : huerfanos.length + ' que no carga nadie: ' + huerfanos.slice(0, 8).join(' · ') +
          (huerfanos.length > 8 ? ' · …' : '') +
          ' — viajan en el repositorio y no llegan a un navegador');

    /* La guarda de la guarda: si la cadena de carga dejara de mirar los
       `@import`, casi toda `css/` saldría huérfana y la tentación sería subir
       el techo en vez de arreglar el lector; y si dejara de mirar `css/`, las
       doce de la v1005 podrían volver sin que nada lo dijera. Se mide que las
       dos mitades sigan puestas y que el lector encuentre material. */
    const cadenaViva = importes.length > 0 && enCss.length > 0;
    comprobar('y la cadena de carga mira las dos carpetas, con los @import dentro',
      cadenaViva && /enCss\.filter/.test(leer('pruebas/revisar.js')),
      !cadenaViva ? 'no se leyeron @import (' + importes.length + ' car.) ni hojas (' + enCss.length + '): el lector mediría la nada'
        : (/enCss\.filter/.test(leer('pruebas/revisar.js'))
          ? enCss.length + ' hojas y ' + (importes.match(/@import/g) || []).length + ' @import en la cadena'
          : 'dejó de mirar css/: una hoja que nadie carga volvería sin que nada lo diga'));
  }
}

/* ── De qué está hecha la vía (v1000) ──────────────────────────────────────
   La otra mitad de lo que se pidió con el estado: «verde está buena, naranja
   medio regular… y el tipo de pavimento». Sin la superficie, el estado no se
   puede leer —un «regular» sobre asfalto y uno sobre tierra no son el mismo
   problema ni los arregla la misma entidad—.

   Va en su propio vocabulario y NO en la lista de materiales de js/03d, y la
   prueba de la clase B lo dice en las dos direcciones: una banca puede ser de
   guadua y una vía no; una vía puede ser de afirmado y una banca no. El propio
   título de aquel archivo es «de qué está hecho el MOBILIARIO URBANO». */
console.log('\n  -- de qué está hecha la vía (v1000) --');
{
  const j03s = soloCodigo(leer('js/03f-superficie-via.js'));
  const j04s = soloCodigo(leer('js/04-marker-proximity.js'));
  const j20s = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const j12s = soloCodigo(leer('js/12-spa-ui.js'));
  const j10s = soloCodigo(leer('js/10-visible-markers.js'));
  const c83s = leer('css/83-moderacion-foto.css');

  const lista = (() => {
    const i = j03s.indexOf('var SUPERFICIES'); if (i < 0) return [];
    const c = j03s.slice(i, j03s.indexOf('\n  ];', i));
    return [...c.matchAll(/\{ n:'([^']+)'/g)].map((m) => m[1]);
  })();
  const usos = (() => {
    const i = j03s.indexOf('var USOS_CON_SUPERFICIE'); if (i < 0) return [];
    const c = j03s.slice(i, j03s.indexOf(';', i));
    return [...c.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  })();

  /* MATERIAL primero (v920): sin vocabulario que leer, todo lo de abajo
     pasaría por no tener nada delante. */
  if (lista.length < 4 || !usos.length) {
    anotarSinMaterial('MATERIAL · el vocabulario de superficie se deja leer',
      lista.length + ' superficies · ' + usos.length + ' usos');
  } else {
    comprobar('MATERIAL · el vocabulario de superficie se deja leer',
      true, lista.length + ' superficies y ' + usos.length +
        (usos.length === 1 ? ' uso que la lleva' : ' usos que la llevan'));

    /* 1 · Todo uso que lleva el campo existe en el catálogo. Un renombre allá
       dejaría el campo apagado en silencio, que es la forma de la v974. */
    const cat = leer('js/20-mobile-functional-app.js');
    const fuera = usos.filter((u) => cat.indexOf("'" + u + "'") < 0 && cat.indexOf('"' + u + '"') < 0);
    comprobar('todo uso que lleva superficie existe en el catálogo',
      fuera.length === 0,
      fuera.length === 0 ? (usos.length === 1 ? 'el uso que la lleva está en la Matriz'
                                             : 'los ' + usos.length + ' están en la Matriz')
        : 'no están en la Matriz: ' + fuera.join(' · ') + ' — el campo quedaría apagado sin que nada lo diga');

    /* 2 · Y la superficie no se coló en la lista de MATERIALES, ni al revés.
       Son dos vocabularios y el día que se mezclen, quien mapea una caneca
       tendría que pasar por «adoquín». */
    const j03m = soloCodigo(leer('js/03d-mobiliario-material.js'));
    const mats = (() => {
      const i = j03m.indexOf('var MATERIALES'); if (i < 0) return [];
      const c = j03m.slice(i, j03m.indexOf('\n  ];', i));
      return [...c.matchAll(/\{ n:'([^']+)'/g)].map((m) => m[1]);
    })();
    const cruce = lista.filter((x) => mats.indexOf(x) >= 0);
    comprobar('la superficie y el material siguen siendo dos vocabularios',
      mats.length >= 5 && cruce.length === 0,
      mats.length < 5 ? 'no se pudo leer la lista de materiales: no se está comprobando nada'
        : cruce.length === 0 ? lista.length + ' superficies y ' + mats.length + ' materiales, sin un valor repetido'
          : 'repetidos: ' + cruce.join(' · ') + ' — el conteo se partiría entre dos valores del mismo hecho');

    /* 3 · Las dos casillas están repartidas y AL FINAL. Reordenar una
       existente rompe lo que ya está guardado (js/04 lo dice desde siempre). */
    const slots = /viaSuperficie:\s*BASE_OFFSET/.test(j04s) && /viaSuperficieOtro:\s*BASE_OFFSET/.test(j04s);
    comprobar('las dos casillas están repartidas en URBIS_SLOTS',
      slots,
      slots ? 'viaSuperficie y viaSuperficieOtro salen del reparto único'
            : 'sin casilla: la superficie no tendría dónde guardarse');

    /* 4 · Quien LEE pregunta por el lector de js/04 y no corta la descripción
       por su cuenta; quien ESCRIBE toma la posición de `URBIS_SLOTS`, que es
       el reparto único. Son dos cosas distintas y por eso se miden aparte: el
       guardado necesita el índice y no el lector, y exigirle el lector sería
       medir otra cosa de la que se dice medir. */
    const lector = /window\.URBIS_SUPERFICIE = \{/.test(j04s);
    const leen = [['el formulario', j20s], ['el globo y la ficha', j10s]]
      .filter(([, t]) => !/URBIS_SUPERFICIE\b/.test(t)).map(([n]) => n);
    const escribePorSlots = /S\.viaSuperficie\b/.test(j12s) && !/\[\s*\d{2,}\s*\]\s*=/.test(
      j12s.slice(Math.max(0, j12s.indexOf('guardarSuperficieVia')), j12s.indexOf('guardarSuperficieVia') + 1400));
    comprobar('quien lee pregunta por el lector y quien escribe por el reparto',
      lector && leen.length === 0 && escribePorSlots,
      !lector ? 'no hay lector: cada pantalla cortaría la descripción por su cuenta'
        : leen.length ? 'no lo usan: ' + leen.join(' · ') + ' — se separarían a la tanda siguiente'
          : !escribePorSlots ? 'el guardado no toma la posición de URBIS_SLOTS: escribiría en una casilla de otro'
            : 'las dos pantallas leen por js/04 y el guardado escribe por el reparto único');

    /* 5 · Guarda contra el dato que nadie alcanza (clase C): se guarda y se
       PINTA. Un campo que se guarda y que ninguna pantalla enseña se ve, desde
       afuera, igual que uno que no existe — es el defecto que la v985
       encontró en este mismo panel. */
    const guarda = /guardarSuperficieVia/.test(j12s);
    /* Se buscan los HUECOS de la plantilla y no los identificadores: una
       comprobación estática cuenta menciones y no alcanzabilidad, así que
       calcular la cadena y no insertarla la dejaría en verde con el dato
       invisible. Es el defecto que la v977 encontró en su propia guarda y que
       la v976 dejó escrito. */
    const pinta = /\$\{superficiePopup\}/.test(j10s) && /\$\{_superficieDet\}/.test(j10s) &&
                  /\+ superficie \+/.test(j20s);
    comprobar('la superficie se guarda y se pinta donde el punto se ve',
      guarda && pinta,
      (guarda && pinta) ? 'se guarda en js/12 y sale en el globo, en la ficha y en el panel del punto'
        : 'falta: ' + [!guarda && 'el guardado', !pinta && 'alguna pantalla'].filter(Boolean).join(' y ') +
          ' — un dato que nadie alcanza se ve igual que uno que no existe');

    /* 6 · Las clases nuevas están pintadas (v895): una clase que ninguna regla
       pinta es HTML válido, sin error y sin aspecto. */
    const cls = ['popup-superficie', 'detalle-superficie'].filter((c) => c83s.indexOf('.' + c) < 0);
    comprobar('las clases nuevas tienen regla que las pinte',
      cls.length === 0,
      cls.length === 0 ? 'las dos se pintan en css/83'
        : 'sin regla: ' + cls.join(' · ') + ' — saldrían sin aspecto y sin error');

    /* 7 · El archivo entra por las DOS puertas (v981). Sin la del service
       worker, un teléfono con la aplicación instalada no lo descarga, el
       vocabulario no existe y el campo no sale, sin un solo error. */
    const enIndex = leer('index.html').indexOf('js/03f-superficie-via.js') >= 0;
    const enSW = leer('service-worker.js').indexOf('js/03f-superficie-via.js') >= 0;
    comprobar('el archivo nuevo está en index.html y en el service worker',
      enIndex && enSW,
      (enIndex && enSW) ? 'entra por las dos puertas'
        : 'falta en: ' + [!enIndex && 'index.html', !enSW && 'el service worker'].filter(Boolean).join(' y '));

    /* 8 · Guarda de la guarda (v878): el control de lista cerrada llama
       `V.buscar(q)`. Con otro nombre el control saldría VACÍO y sin un solo
       error, que es la forma de la v895. */
    const buscar = /buscar:\s*buscarSuperficie/.test(j03s);
    comprobar('y el vocabulario expone el nombre que el control llama',
      buscar,
      buscar ? 'expone `buscar`, que es lo que pintarLista pide a las cuatro'
             : 'no lo expone: el control saldría vacío y sin un solo error');
  }
}

/* ── Un ACTO de gobierno declara su nivel (v999) ───────────────────────────
   `hechosDelMandato` deja fuera del score lo que no es del gobierno nacional,
   y eso solo puede funcionar si el nivel está escrito. La v941 lo decidió para
   los casos de corrupción y la v971 lo aplicó a las entradas; lo que faltaba
   era declararlo, y 197 de 212 no lo traían.

   LA MEDICIÓN QUE CAMBIÓ EL ALCANCE, y por eso no se declararon las 197: el
   campo solo tiene sentido en las entradas que registran un ACTO DE GOBIERNO,
   que son las de `tipoMedicion: actividad`. Una cifra del país —la inflación,
   la pobreza— o un hecho de otro actor —un juez, la JEP, Human Rights Watch,
   un terremoto— no tiene nivel de gobierno, y escribirle `nacional` sería
   declarar algo falso sobre 91 entradas para que un recuento llegara a cero.

   Así que la exigencia va sobre las de `actividad` y falla CERRADO (v880): una
   entrada nueva que registre un acto sin decir de qué nivel sale en rojo en su
   primera composición. Sobre las demás no se exige nada —y tampoco se
   prohíbe: el Decreto 1012 es un acto de gobierno de OTRO gobierno y lleva su
   nivel con razón. */
console.log('\n  -- un acto de gobierno declara su nivel (v999) --');
{
  /* Los dos registros, por la misma vara: toda regla que se aplica a un
     gobierno se aplica a todos (principio 1 del pliego). */
  const REGISTROS = ['assets/data/seguimiento-presidencial.json', 'assets/data/seguimiento-petro.json'];
  const NIVELES = ['nacional', 'departamental', 'distrital', 'municipal'];
  const actos = [], sinNivel = [], malNivel = [];
  REGISTROS.forEach((ruta) => {
    const d = JSON.parse(leer(ruta));
    const quien = ruta.split('-').pop().replace('.json', '');
    (d.entradas || []).forEach((e) => {
      const n = String(e.nivelGobierno || '').trim();
      if (n && NIVELES.indexOf(n) < 0) malNivel.push(quien + '/' + (e.fecha || '?') + ' «' + n + '»');
      if (e.tipoMedicion !== 'actividad') return;
      actos.push(e);
      if (!n) sinNivel.push(quien + '/' + (e.fecha || '?'));
    });
  });

  /* MATERIAL primero (v920): sin entradas que registren un acto, todo lo de
     abajo pasaría por no tener nada que mirar. */
  if (actos.length < 10) {
    anotarSinMaterial('MATERIAL · hay entradas que registran un acto de gobierno',
      actos.length + ' de tipoMedicion «actividad»');
  } else {
    comprobar('MATERIAL · hay entradas que registran un acto de gobierno',
      true, actos.length + ' entradas de «actividad» en los dos registros');

    comprobar('toda entrada que registra un acto de gobierno declara su nivel',
      sinNivel.length === 0,
      sinNivel.length === 0
        ? 'las ' + actos.length + ' lo declaran: la puerta del score puede decidir sobre todas'
        : sinNivel.length + ' sin nivel, las primeras: ' + sinNivel.slice(0, 4).join(' · ') +
          ' — la puerta no puede dejar fuera un acto que no sea del gobierno nacional');

    comprobar('y ningún nivel sale de la lista conocida',
      malNivel.length === 0,
      malNivel.length ? malNivel.slice(0, 4).join(' · ') : NIVELES.join(' | '));

    /* Guarda contra pasarse (v879, v882, v890): a una cifra del país o a un
       hecho de otro actor NO se le inventa un nivel. Sin esta, el arreglo
       podría ser escribir `nacional` en las 212 y el recuento llegaría a cero
       declarando algo falso sobre 91 de ellas. */
    const noActos = [];
    REGISTROS.forEach((ruta) => {
      const d = JSON.parse(leer(ruta));
      (d.entradas || []).forEach((e) => {
        if (e.tipoMedicion === 'actividad') return;
        if (String(e.nivelGobierno || '').trim()) noActos.push((e.fecha || '?') + ' · ' + e.tipoMedicion);
      });
    });
    /* Uno se acepta y va con su nombre: el Decreto 1012 es un acto de gobierno
       del gobierno ANTERIOR, declarado en la v958 para la simetría que el
       pliego pide. Lo que la guarda impide es que se vuelva la costumbre. */
    comprobar('y a lo que no es un acto de gobierno no se le inventa un nivel',
      noActos.length <= 1,
      noActos.length <= 1
        ? (noActos.length ? 'uno solo, y es un acto de otro gobierno: ' + noActos[0]
                          : 'ninguna cifra del país lleva nivel de gobierno')
        : noActos.length + ' lo llevan sin ser actos: ' + noActos.slice(0, 4).join(' · ') +
          ' — una cifra del país no tiene nivel de gobierno');

    /* Y la nota del registro tiene que decirlo, que es la causa que la v998
       encontró para el rol: el campo existe, la guarda existe, y la
       instrucción que lee quien escribe una entrada no lo menciona. */
    const sinNota = REGISTROS.filter((ruta) =>
      String(JSON.parse(leer(ruta))._comentario || '').indexOf('EL NIVEL DE UN ACTO DE GOBIERNO') < 0);
    comprobar('y la nota del registro dice cuándo se declara y cuándo no',
      sinNota.length === 0,
      sinNota.length === 0
        ? 'los ' + REGISTROS.length + ' explican la regla a quien escribe'
        : 'sin explicarlo: ' + sinNota.join(' · ') + ' — una entrada nueva nace sin nivel');

    /* Guarda de la guarda (v878): si la puerta del score dejara de leer el
       campo, todo lo de arriba seguiría en verde sobre un dato que ya no
       decide nada. */
    const j70n = soloCodigo(leer('js/70-seguimiento.js'));
    const iH = j70n.indexOf('function hechosDelMandato');
    const cH = iH >= 0 ? j70n.slice(iH, j70n.indexOf('\n  }', iH)) : '';
    const lee = /e\.nivelGobierno && e\.nivelGobierno !== 'nacional'/.test(cH);
    comprobar('y la puerta del score sigue leyendo el nivel',
      lee,
      lee ? 'hechosDelMandato deja fuera lo que no es nacional'
          : 'dejó de leerlo: el campo estaría declarado y no decidiría nada');
  }
}

/* ── Una lista de prioridades también se queda vieja (v997) ────────────────
   La lista del principio de CLAUDE.md es lo PRIMERO que lee cualquier sesión y
   decide qué se hace, así que una que envejece manda a rehacer trabajo hecho.
   Se quedó vieja veinticinco versiones: pedía la migración del esquema antiguo
   —hecha en la v967— y decía que la pantalla presidencial no se implementaba
   todavía, cuando la v971 la implementó entera.

   Es exactamente el fallo que la v866 encontró en la lista viva y la v868 le
   guardó: una lista honesta se vuelve vieja la primera vez que alguien
   implementa algo, y ese es el fallo que nadie ve. La diferencia acá es que la
   condición no está en el código servido sino en los REGISTROS, así que la
   guarda lee los dos JSON y mide.

   Se denuncia el renglón CUMPLIDO, que es el que manda a rehacer lo hecho. Un
   renglón pendiente es lo normal y no se toca.

   Cómo se agrega un renglón a la lista: se escribe con su cláusula
   `hecho cuando: <id>` y se le pone acá su medición. Sin las dos, la guarda se
   queja —un id sin medición es un renglón sin vigilar, y una medición sin
   renglón es una medición muerta—. */
console.log('\n  -- una lista de prioridades también se queda vieja (v997) --');
{
  const md = leer('CLAUDE.md');
  const reg = f => { try { return JSON.parse(leer('assets/data/' + f)); } catch (e) { return null; } };
  const R = [reg('seguimiento-presidencial.json'), reg('seguimiento-petro.json')].filter(Boolean);
  const ents = R.reduce((a, d) => a.concat(d.entradas || []), []);
  const contr = R.reduce((a, d) => a.concat(((d.contradicciones || {}).casos) || []), [])
    .filter(c => c.estado === 'documentada');

  /* La medición de cada renglón: recibe el material y devuelve
     { hecho, cuanto }. Un renglón cuya medición dice `hecho` es el que hay que
     sacar de la lista.

     Recibe el material por PARÁMETRO y no lo lee de fuera, y eso es lo que
     permite medirlas contra un caso de respuesta conocida más abajo: una
     medición que siempre contestara «pendiente» dejaría la lista envejecer sin
     que nada lo dijera, y contra el registro de verdad eso no se ve (v970). */
  const MEDIDAS = {
    /* La fuente del acto de las seis `sin-acto` salió de esta lista en la
       v1004, y su medición con ella, como el nivel de gobierno en la v999 y
       las diecinueve por documentar en la v1003: lo que queda no es un
       pendiente sino un estado que la ficha cuenta y nombra —`sin-acto`, desde
       la v970— y que su propia comprobación ya vigila, más arriba, con las dos
       redacciones escritas. */
    /* El nivel de gobierno salió de esta lista en la v999, y su medición con
       él: lo que queda de aquel renglón no es un pendiente sino un INVARIANTE
       —toda entrada que registra un acto declara su nivel— y vive en su propia
       comprobación, más arriba. Una medición de esta tabla mide algo que
       todavía falta; una que mide algo que ya no falta es la que esta misma
       guarda denuncia dos renglones más abajo. */
    /* Documentar las diecinueve del 4 al 17 de agosto salió de esta lista en
       la v1003, y su medición con él, por la misma razón que el nivel de
       gobierno en la v999: lo que queda no es un pendiente sino un INVARIANTE
       —ninguna entrada se queda sin naturaleza de fuente declarada— y vive en
       su propia comprobación, arriba, con TECHO_SIN_TIPO en cero. */
    'identidad-declarada': (m) => {
      const sin = m.contr.filter(c => !('mismoObjetoVerificado' in c));
      return { hecho: sin.length === 0, cuanto: sin.length + ' de ' + m.contr.length + ' documentadas sin identidad' };
    }
  };

  /* Lo que hay en el disco hoy. */
  const HOY = {
    ents: ents,
    contr: contr,
    pend: R.reduce((a, d) => a.concat((((d._pendientesFuente || {}).lista) || [])), [])
  };

  const iL = md.indexOf('## Lo que sigue, y en este orden');
  const cL = iL >= 0 ? md.slice(iL, md.indexOf('\n## ', iL + 10)) : '';
  const pedidos = [...cL.matchAll(/`hecho cuando: ([a-z-]+)`/g)].map(m => m[1]);

  /* MATERIAL primero (v920): sin la lista, sin los dos registros o sin
     renglones que medir, todo lo de abajo pasaría por no tener nada delante. */
  if (!cL || R.length < 2 || !pedidos.length) {
    anotarSinMaterial('MATERIAL · la lista de prioridades y los dos registros se dejan leer',
      'lista: ' + (cL ? 'sí' : 'no') + ' · registros: ' + R.length + ' · renglones: ' + pedidos.length);
  } else {
    comprobar('MATERIAL · la lista de prioridades y los dos registros se dejan leer',
      true, pedidos.length + ' renglones con condición, y ' + ents.length + ' entradas que medir');

    /* 1 · Todo renglón declara su condición. Uno sin cláusula es un renglón
       que nadie puede saber cuándo sacar, que es como envejeció esta lista. */
    const numerados = (cL.match(/^\d+\. \*\*/gm) || []).length;
    comprobar('todo renglón de la lista declara cuándo está hecho',
      numerados > 0 && numerados === pedidos.length,
      numerados === pedidos.length
        ? 'los ' + numerados + ' renglones llevan su condición medible'
        : numerados + ' renglones y ' + pedidos.length + ' condiciones: alguno no dice cuándo sacarlo');

    /* 2 · Y cada condición tiene su medición acá. Un id sin medición es un
       renglón sin vigilar que PARECE vigilado, que es peor que no tenerla
       —es la primera comprobación de la v868 con las listas vivas—. */
    const huerfanos = pedidos.filter(k => !MEDIDAS[k]);
    comprobar('y cada condición tiene su medición en la guarda',
      huerfanos.length === 0,
      huerfanos.length === 0
        ? 'las ' + pedidos.length + ' se miden contra los registros'
        : 'sin medición: ' + huerfanos.join(' · ') + ' — parecerían vigiladas y no lo estarían');

    /* 3 · Y ninguna medición sobra. Una que no cuelga de ningún renglón es
       código muerto que un día se lee como si guardara algo (v885). */
    const sobran = Object.keys(MEDIDAS).filter(k => pedidos.indexOf(k) === -1);
    comprobar('y ninguna medición se quedó sin su renglón',
      sobran.length === 0,
      sobran.length === 0
        ? 'las ' + Object.keys(MEDIDAS).length + ' cuelgan de un renglón de la lista'
        : 'sin renglón: ' + sobran.join(' · ') + ' — el renglón se sacó y la medición se quedó');

    /* 4 · LA QUE IMPORTA: ningún renglón pedido está ya cumplido. Es la que
       habría cazado la lista de la v971, que seguía pidiendo una migración
       hecha en la v967. */
    const cumplidos = pedidos.filter(k => MEDIDAS[k]).map(k => [k, MEDIDAS[k](HOY)])
      .filter(([, m]) => m.hecho).map(([k]) => k);
    comprobar('ningún renglón de la lista está ya cumplido',
      cumplidos.length === 0,
      cumplidos.length === 0
        ? 'los ' + pedidos.length + ' siguen pendientes: ' +
          pedidos.filter(k => MEDIDAS[k]).map(k => k + ' (' + MEDIDAS[k](HOY).cuanto + ')').join(' · ')
        : 'ya está hecho y la lista lo sigue pidiendo: ' + cumplidos.join(' · ') +
          ' — la sesión siguiente rehace trabajo hecho');

    /* 5 · Guarda de la guarda (v878): una medición que contestara «pendiente»
       pase lo que pase dejaría la lista envejecer sin que nada lo dijera, y
       contra el registro de verdad eso no se ve —las cuatro dicen «pendiente»
       hoy con razón—. Se miden contra un caso FABRICADO con todo declarado, que
       es la regla de la v970: la rama con material se mide contra un caso
       fabricado y no contra el registro. */
    const LIMPIO = {
      ents: [{ fuentes: [{ rol: 'acto' }], nivelGobierno: 'nacional' }],
      contr: [{ estado: 'documentada', mismoObjetoVerificado: true }],
      pend: []
    };
    const mudas = Object.keys(MEDIDAS).filter(k => !MEDIDAS[k](LIMPIO).hecho);
    comprobar('y una medición sabe decir que SÍ, contra un registro fabricado',
      mudas.length === 0,
      mudas.length === 0
        ? 'las ' + Object.keys(MEDIDAS).length + ' contestan «hecho» sobre un registro con todo declarado'
        : 'nunca dirían que sí: ' + mudas.join(' · ') +
          ' — la lista podría envejecer sin que nada lo dijera');
  }
}

console.log('\n  -- un dibujo no se queda mas chico que su pie (v1010) --');
{
  const j68 = leer('js/68-procity-reconocimiento.js');
  const c72 = leer('css/72-edu-diseno.css');

  /* El trozo de cada funcion, para medir DENTRO y no en el archivo entero
     (v854): `getComputedStyle` sale cuarenta veces en js/68 y encontrarlo
     suelto no dice que lo use ESTA cuenta. */
  const trozo = (desde, hasta) => {
    const i = j68.indexOf(desde);
    if (i < 0) return '';
    const j = j68.indexOf(hasta, i + desde.length);
    return j < 0 ? j68.slice(i) : j68.slice(i, j);
  };
  const cuenta = trozo('function anchoQueLeeElDibujo(', '\n  function ajustarDibujos(');
  const pase  = trozo('function ajustarDibujos(', '\n  function pintar(');

  const hayPie = /pcr-dibujo-pie/.test(c72) && /pcr-dibujo-pie/.test(j68);
  if (!hayPie || !cuenta || !pase) {
    anotarSinMaterial('MATERIAL - la ficha pinta dibujos con su pie, y el ajuste existe',
      'sin pie declarado o sin la cuenta: lo de abajo no tendria que medir');
  } else {
    comprobar('MATERIAL - la ficha pinta dibujos con su pie, y el ajuste existe',
      true, 'el pie esta en la hoja de estilo y en el HTML, y las dos funciones estan escritas');

    /* 1 - el piso sale del PIE, medido, y no de un numero escrito. Un piso
       traido de otro modulo seria el numero a ojo de la v869, y uno escrito
       en la hoja de estilo se queda viejo en silencio el dia que alguien
       toque un font-size de js/74 (clase B). */
    const delPie = /getComputedStyle\(pie\)\.fontSize/.test(cuenta);
    const aOjo = /(>=|<=|<|>)\s*1[0-9](\.\d+)?\b/.test(cuenta) ||
                 /piso\s*=\s*\d/.test(cuenta);
    comprobar('el piso sale del pie del dibujo, medido, no de un numero escrito',
      delPie && !aOjo,
      delPie && !aOjo ? 'lee getComputedStyle(pie).fontSize y no compara contra ningun piso escrito'
        : (!delPie ? 'no mide el pie: el piso vendria de otra parte'
                   : 'compara contra un piso escrito a mano dentro de la cuenta'));

    /* 2 - el pie se busca dentro de la caja del dibujo. Subiendo por el
       documento se encuentra el pie de la figura de al lado, que explica
       otra cosa: es la trampa de la v854, y la sonda la produjo de verdad
       -el corte de calle encontraba el pie de la carta solar dos niveles
       arriba-. */
    const dentro = /var caja = sv\.parentElement;/.test(cuenta) &&
                   /caja\s*\?\s*caja\.querySelector\('\.pcr-dibujo-pie'\)/.test(cuenta) &&
                   !/closest\(/.test(cuenta);
    comprobar('y se busca en la caja que CONTIENE al dibujo, sin subir ni listar clases',
      dentro,
      dentro ? 'la caja es el elemento que lo contiene: una caja nueva la hereda sin que nadie la agregue'
             : (/closest\(/.test(cuenta)
                ? 'sube por el documento o lista clases de caja: encontraria el pie de la figura de al lado, y una caja nueva no la heredaria'
                : 'no toma la caja del elemento que contiene al dibujo'));

    /* 3 - el rotulo mas chico se lee del atributo Y de la clase. js/74 los
       escribe como atributo y la seccion de calle como clase css: mirando
       solo una de las dos, la mitad de los dibujos quedaria sin medir y el
       ajuste pasaria por no tener nada que ajustar. */
    const dosVias = /getAttribute\('font-size'\)/.test(cuenta) &&
                    /getComputedStyle\(ts\[i\]\)\.fontSize/.test(cuenta);
    comprobar('y el rotulo mas chico se lee del atributo Y de la clase',
      dosVias,
      dosVias ? 'las dos vias, que es como js/74 y la seccion de calle los escriben'
              : 'solo una via: los dibujos de la otra quedarian sin medir');

    /* 4 - un dibujo con su pie AL LADO no se estira. Lo dice la propia hoja
       de estilo: no puede crecer mas que su mitad de la fila o empuja al pie
       fuera de la caja. Se reconoce por el display de la caja y no por el
       nombre de la clase, para que una maquetacion nueva en fila lo herede. */
    const fila = /flex/.test(cuenta) && /flexDirection/.test(cuenta) &&
                 !/pcr-dibujo-fila/.test(cuenta);
    comprobar('y un dibujo con el pie AL LADO no se estira',
      fila,
      fila ? 'lo reconoce por el display de su caja, no por el nombre de la clase'
           : (/pcr-dibujo-fila/.test(cuenta)
              ? 'lo reconoce por el nombre de la clase: una fila nueva no lo heredaria'
              : 'no mira la maquetacion: estirarlo empujaria el pie fuera de la caja'));

    /* 5 - el pase corre al final de pintar, con el DOM ya puesto. El ancho
       que un rotulo necesita se MIDE sobre lo pintado; deducirlo del HTML es
       lo que la v990 ya pago en el modulo presidencial. */
    const iRep = j68.indexOf('reponerBorrador();\n    /* Y los dibujos');
    comprobar('y el pase corre al final de pintar, con el DOM ya puesto',
      iRep > 0 && /ajustarDibujos\(h\);/.test(j68),
      iRep > 0 ? 'va detras de reponerBorrador, que es donde el DOM ya esta'
               : 'no esta enganchado al final de pintar: mediria sobre lo de antes');

    /* 6 - la exencion se cuenta. Un dibujo sin pie propio no tiene de donde
       sacar su piso y NO se le inventa uno; lo que no puede pasar es que se
       salte en silencio, que se lee igual que un aprobado (v966). */
    const cola68 = j68.slice(j68.indexOf('estado: function'));
    const cuentaExen = /sinPie\+\+/.test(pase) && /enFila\+\+/.test(pase) &&
                       /S\.dibujosSinPie\s*=/.test(pase) && /S\.dibujosEnFila\s*=/.test(pase) &&
                       /dibujosSinPie/.test(cola68) && /dibujosEnFila/.test(cola68);
    comprobar('y las dos exenciones se cuentan APARTE, no se saltan en silencio',
      cuentaExen,
      cuentaExen ? 'sin pie y en fila van por separado y los dos se exponen: a uno hay que escribirle un pie, al otro no le falta nada'
                 : 'se saltan sin contarse, o las dos en la misma cifra: se leerian igual que un ajuste');

    /* Y la cuenta devuelve un objeto con su razon, nunca un cero pelado: con
       un solo numero, «no tiene pie» y «esta en una fila» se juntan en uno y
       el pase no puede contarlas aparte (v876). */
    const conRazon = /razon:\s*'sin-pie'/.test(cuenta) && /razon:\s*'en-fila'/.test(cuenta) &&
                     /r\.razon === 'en-fila'/.test(pase);
    comprobar('y la cuenta devuelve su razon, no un cero pelado',
      conRazon,
      conRazon ? 'devuelve { ancho, razon } y el pase reparte por ella'
               : 'devuelve un numero: las dos exenciones se leerian como una sola');

    /* La guarda de la guarda: si el pase dejara de llamar a la cuenta, todo
       lo de arriba seguiria en verde sobre una funcion que nadie usa (v878). */
    comprobar('y el pase sigue sacando el ancho de esa cuenta',
      /anchoQueLeeElDibujo\(sv\)/.test(pase),
      /anchoQueLeeElDibujo\(sv\)/.test(pase)
        ? 'ajustarDibujos lo pide ahi, asi que lo de arriba vigila lo que corre'
        : 'dejo de pedirlo: la cuenta quedaria sin usar y las comprobaciones de arriba, en verde sobre nada');
  }
}

console.log('\n  -- el pie de un dibujo es lo que el dibujo dice que es (v1011) --');
{
  const j68 = leer('js/68-procity-reconocimiento.js');
  const trozo = (desde, hasta) => {
    const i = j68.indexOf(desde);
    if (i < 0) return '';
    const j = j68.indexOf(hasta, i + desde.length);
    return j < 0 ? j68.slice(i) : j68.slice(i, j);
  };
  const ayud = trozo('function cajaSeccion(', '\n  function seccionDibujada(');
  const pase = trozo('function ajustarDibujos(', '\n  function pintar(');
  const cuenta = trozo('function anchoQueLeeElDibujo(', '\n  /* Un dibujo con su ancho ESCRITO');
  /* Cuantos dibujos de seccion hay de verdad: si un dia no queda ninguno, lo
     de abajo no tendria nada que vigilar y hay que mirarlo, no arreglarlo. */
  const usos = (j68.match(/cajaSeccion\(/g) || []).length - 1;

  if (!ayud || usos < 2) {
    anotarSinMaterial('MATERIAL - la ficha pinta dibujos de seccion por su ayudante',
      'el ayudante no esta, o ya casi nadie lo usa: ' + usos + ' dibujo(s)');
  } else {
    comprobar('MATERIAL - la ficha pinta dibujos de seccion por su ayudante',
      true, usos + ' dibujos de seccion salen de cajaSeccion');

    /* 1 - ninguno se escribe a mano. Con el div y el aria-label sueltos, el
       quinto dibujo nace otra vez sin pie, que es como estaban los cuatro. */
    const aMano = (j68.match(/'<div class="pcr-seccion/g) || []).length;
    comprobar('ningun dibujo de seccion se arma a mano',
      aMano === 1,
      aMano === 1 ? 'el unico que escribe el div es el propio ayudante'
                  : (aMano - 1) + ' lo escriben por su cuenta: naceria sin pie, como los cuatro de antes');

    /* 2 - el pie y el aria-label salen de la MISMA cadena. Dos copias de la
       misma frase se separan a la tanda siguiente (clase B), y la que se
       quedaria vieja seria la que nadie mira: la que oye la pagina. */
    const unaSola = /aria-label="' \+\s*\n?\s*esc\(etiqueta\)/.test(ayud) &&
                    /pcr-dibujo-pie">' \+ esc\(etiqueta\)/.test(ayud);
    comprobar('y el pie y el aria-label salen de la misma cadena',
      unaSola,
      unaSola ? 'una sola etiqueta: el que oye la pagina y el que la mira leen lo mismo'
              : 'son dos cadenas: se separarian, y la que envejece es la que nadie mira');

    /* 3 - solo se estira lo que trae su ancho ESCRITO. Ponerle tope a un
       dibujo que ya ocupa su caja lo haria MAS CHICO en una pantalla ancha, y
       la regla de la v1010 es un piso, no una meta. */
    const soloEscrito = /if \(anchoEscrito\(sv\)\)/.test(pase) &&
                        /getAttribute\('width'\)/.test(j68.slice(j68.indexOf('function anchoEscrito(')));
    comprobar('solo se estira el dibujo que trae su ancho escrito',
      soloEscrito,
      soloEscrito ? 'el que ya ocupa su caja se deja: un tope lo haria mas chico en una pantalla ancha'
                  : 'estira todo: el corte de calle pasaria de 720 a 501 px en una tableta');

    /* 4 - el que no alcanza se cuenta, y lo que no esta maquetado NO. Un
       dibujo de una pestaña cerrada mide cero, y cero no es corto: contarlo
       daria cinco cortos donde hay dos (la trampa de la v990). */
    const cuentaCortos = /salio > 0 && salio < r\.ancho - 1/.test(pase) &&
                         /S\.dibujosCortos\s*=/.test(pase) &&
                         /dibujosCortos/.test(j68.slice(j68.indexOf('estado: function')));
    comprobar('y el que no alcanza su pie se cuenta, pero no el que no esta maquetado',
      cuentaCortos,
      cuentaCortos ? 'se mide lo que el navegador maqueto, y un ancho cero no cuenta como corto'
                   : 'no lo cuenta, o cuenta como corto lo que todavia no se maqueto');

    /* La guarda de la guarda: si el pase dejara de preguntar por el ancho
       escrito, volveria a estirarlo todo y lo de arriba seguiria en verde. */
    comprobar('y el pase sigue preguntando por el ancho escrito',
      /anchoEscrito\(sv\)/.test(pase) && /function anchoEscrito\(/.test(j68),
      /anchoEscrito\(sv\)/.test(pase)
        ? 'ajustarDibujos lo pregunta ahi, asi que lo de arriba vigila lo que corre'
        : 'dejo de preguntarlo: la cuenta quedaria sin usar');
  }
}

console.log('\n  -- un small dentro de algo ya chico se encoge dos veces (v1013) --');
{
  const HOJAS = ['css/68-procity-reconocimiento.css', 'css/72-edu-diseno.css'];
  /* El tamaño que declara cada clase simple, para saber cual ya viene
     reducida. Se lee de las hojas y no se escribe aca: una lista copiada
     envejece a la tanda siguiente. */
  const chicas = {};
  const reglas = [];
  HOJAS.forEach(function (h) {
    let t2 = '';
    try { t2 = leer(h); } catch (e) { return; }
    t2 = t2.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
    const re = /([^{}]+)\{([^{}]*)\}/g; let m;
    while ((m = re.exec(t2))) {
      const sel = m[1].trim().replace(/\s+/g, ' ');
      reglas.push({ h: h, sel: sel, cuerpo: m[2], linea: t2.slice(0, m.index).split('\n').length });
      const g = m[2].match(/font-size:\s*([0-9.]+)rem/);
      if (!g || Number(g[1]) >= 1) continue;
      sel.split(',').forEach(function (s) {
        const c = (s.trim().match(/\.([a-z0-9-]+)$/) || [])[1];
        if (c) chicas[c] = Math.min(chicas[c] === undefined ? 9 : chicas[c], Number(g[1]));
      });
    }
  });

  /* Las reglas que REESTILIZAN un `small` —peso, caja, espaciado— dentro de
     una clase que ya declara un tamaño reducido. Esa es la condicion exacta
     del defecto: el `small{font-size:smaller}` del navegador se aplica encima
     de algo que ya venia chico, y nadie eligio el resultado. Una regla que
     solo cambia el color no entra, y una cuyo padre es de tamaño normal
     tampoco: medido, la condicion deja UN candidato y es el que fallaba.

     No se persigue «todo small sin font-size» —son trece en estas dos hojas y
     casi todas son overrides de color legitimos—, que seria la lista de
     excepciones que envejece de la v895. */
  const sospechosas = reglas.filter(function (r) {
    if (!/(^|[\s,>])small\s*(,|$)/.test(r.sel)) return false;
    if (/font-size\s*:/.test(r.cuerpo)) return false;
    if (!/font-weight|text-transform|letter-spacing|font-style/.test(r.cuerpo)) return false;
    return r.sel.split(',').some(function (s) {
      const c = (s.trim().match(/\.([a-z0-9-]+)\s+small$/) || [])[1];
      return c && chicas[c] !== undefined;
    });
  });

  const conSmall = reglas.filter((r) => /(^|[\s,>])small\s*(,|$)/.test(r.sel)).length;
  if (!conSmall || !Object.keys(chicas).length) {
    anotarSinMaterial('MATERIAL - las hojas del modulo declaran tamaños y estilan <small>',
      conSmall + ' reglas sobre <small> y ' + Object.keys(chicas).length + ' clases con tamaño reducido');
  } else {
    comprobar('MATERIAL - las hojas del modulo declaran tamaños y estilan <small>',
      true, conSmall + ' reglas sobre <small> y ' + Object.keys(chicas).length +
      ' clases que ya declaran un tamaño reducido');

    comprobar('ninguna regla reestiliza un <small> dentro de algo ya chico sin decir su tamaño',
      sospechosas.length === 0,
      sospechosas.length === 0
        ? 'las que reestilizan un <small> dentro de una clase reducida declaran su font-size'
        : sospechosas.map((r) => r.h + ':' + r.linea + ' «' + r.sel.slice(0, 60) + '»').join(' · ') +
          ' — el encogimiento del navegador quedaria encima de lo que ya venia chico');

    /* Y la guarda de la guarda: la de arriba solo mira las reglas de `X small`
       cuyo padre ya viene reducido. Si no quedara ninguna —porque se retiro la
       regla, o porque su padre dejo de declarar un tamaño chico— se quedaria
       sin nada sobre que morder y seguiria en verde (v878). */
    const padresChicos = [];
    reglas.forEach(function (r) {
      if (!/(^|[\s,>])small\s*(,|$)/.test(r.sel)) return;
      r.sel.split(',').forEach(function (s) {
        const c = (s.trim().match(/\.([a-z0-9-]+)\s+small$/) || [])[1];
        if (c && chicas[c] !== undefined && padresChicos.indexOf(c) === -1) padresChicos.push(c);
      });
    });
    comprobar('y sigue habiendo reglas de <small> dentro de una clase reducida que mirar',
      padresChicos.length > 0,
      padresChicos.length
        ? padresChicos.length + ' clases reducidas llevan un <small> con regla propia: ' +
          padresChicos.slice(0, 6).join(' · ')
        : 'ninguna: la comprobacion de arriba no tendria nada sobre que morder');
  }
}

/* Las dos cuentas van APARTE porque piden cosas distintas: una fallada hay
   que arreglarla, una sin material hay que mirarla —o se quedó sin él porque
   el registro mejoró, o porque la función dejó de ver lo que medía—. Sumarlas
   mandaría a revisar lo que está bien. */
console.log('\n  ' + (fallos ? fallos + ' comprobaciones fallaron' : 'todas las comprobaciones pasaron') +
  (sinMaterial ? ' · ' + sinMaterial + (sinMaterial === 1 ? ' se quedó sin material' : ' se quedaron sin material') : '') + '\n');
process.exit(fallos ? 1 : 0);
