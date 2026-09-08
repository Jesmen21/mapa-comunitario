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
  const ARCHIVOS = ['service-worker.js', 'index.html', 'css/main.css', 'analisis-ia.html',
                    'seguimiento.html', 'reportes.html', 'sw-reportes.js'];
  const tokens = new Map();
  ARCHIVOS.forEach(f => {
    const t = leer(f);
    const m = /^sw-|^service-worker/.test(f) ? t.match(/urbis-(?:reportes-)?v([\w-]+)/)
                                            : t.match(/[?&]v=([\w-]+)/);
    tokens.set(f, m ? m[1] : '(ninguno)');
  });
  const distintos = [...new Set(tokens.values())];
  comprobar('los siete archivos llevan la misma versión',
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
    const m = /font-size:\s*(?!var\(--t-\d\))([^;}]+)/.exec(l);
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
  const REGISTROS = ['assets/data/seguimiento-presidencial.json', 'assets/data/seguimiento-petro.json'];
  const malos = [], cojos = [];
  let nCasos = 0;
  REGISTROS.forEach((ruta) => {
    const quien = ruta.split('-').pop().replace('.json', '');
    const lista = ((JSON.parse(leer(ruta)).casos || {}).lista) || [];
    nCasos += lista.length;
    lista.forEach((c) => {
      if (!ESTADOS.includes(c.estado)) malos.push(quien + '/' + c.id + ':' + c.estado);
      const conPeso = c.estado === 'confirmado' || c.estado === 'en-investigacion' || c.estado === 'archivado';
      if (conPeso && (!c.quienLoConfirmo || !(c.fuentes || []).length || !c.fecha)) cojos.push(quien + '/' + c.id);
    });
  });
  comprobar('los casos de corrupción de los dos registros llevan un estado probatorio conocido',
    malos.length === 0, malos.length ? malos.join(', ') : nCasos + ' casos en ' + REGISTROS.length + ' registros');
  comprobar('y ningún caso con consecuencia (confirmado, en investigación o archivado) va sin quién, fecha y fuentes',
    cojos.length === 0, cojos.length ? cojos.join(', ') : 'ningún caso con consecuencia va cojo');

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
  comprobar('ningún nombre de window es función en un archivo y lista en otro',
    chocan.length === 0,
    chocan.length
      ? chocan.map(n => 'window.' + n + ' (' +
          donde[n].map(x => x.archivo + ':' + x.linea + ' ' + x.forma).join(' · ') + ')').join(' | ')
      : Object.keys(donde).length + ' nombres revisados');
}

console.log('\n  ' + (fallos ? fallos + ' comprobaciones fallaron' : 'todas las comprobaciones pasaron') + '\n');
process.exit(fallos ? 1 : 0);
