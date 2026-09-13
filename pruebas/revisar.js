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
    'alej\u00e1','analiz\u00e1','copi\u00e1','export\u00e1','llev\u00e1','guardalo','escribilo','ped\u00edsela','mirala','ponelo'];


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
    'guardar\u00e1', 'marcar\u00e1', 'mostrar\u00e1', 'pedir\u00e1', 'pelear\u00e1',
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
    hallados.length ? hallados.slice(0, 6).join(' · ') + (hallados.length > 6 ? ' …y ' + (hallados.length - 6) + ' más' : '')
                    : 'revisados ' + archivos.length + ' archivos, solo fuera de comentarios');
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
  comprobar('ningún nombre de window es función en un archivo y lista en otro',
    chocan.length === 0,
    chocan.length
      ? chocan.map(n => 'window.' + n + ' (' +
          donde[n].map(x => x.archivo + ':' + x.linea + ' ' + x.forma).join(' · ') + ')').join(' | ')
      : Object.keys(donde).length + ' nombres revisados');
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
  const j68 = leer('js/68-procity-reconocimiento.js');
  const j61 = leer('js/61-analisis-ia-datos.js');
  const j73 = leer('js/73-solar.js');
  const j90 = leer('js/90-vt-app.js');

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
        prueba: () => /PLANTILLAS_DE_CAMPO/.test(j68) && /plantillaCampo/.test(j68) }
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
      { t: 'el método declarado en cada corrida', tema: /isócrona|radio_recto|método/i,
        prueba: () => /isócrona pendiente/.test(j90) },
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
