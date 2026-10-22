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
/* ── Y EL REGISTRO, QUE TAMBIÉN SE PUBLICA (v1017) ────────────────────
   La guarda leía `js/` y las páginas, y ahí se acababa. Pero la prosa de
   `assets/data/*.json` —el título, el detalle y el contrapunto de cada
   hecho, las líneas de cada alerta— se PINTA en `seguimiento.html` y en el
   mapa igual que cualquier cadena de `js/`: es texto que ve el usuario, y
   no pasaba por ninguna comprobación de idioma.

   En un JSON todo lo entrecomillado es contenido, menos las CLAVES. Una
   clave se reconoce por lo que viene después de cerrar: si es `:`, es una
   clave. Sin esa distinción, `tipoFuente` y `titulo` se leen como prosa y
   el primer barrido da miles de falsos «ti». */
function dentroDeValorJson(txt) {
  const s = new Uint8Array(txt.length);
  let i = 0;
  while (i < txt.length) {
    if (txt[i] !== '"') { i++; continue; }
    const ini = i + 1;
    let j = ini;
    while (j < txt.length) {
      if (txt[j] === '\\') { j += 2; continue; }
      if (txt[j] === '"') break;
      j++;
    }
    if (j >= txt.length) break;
    let k = j + 1;
    while (k < txt.length && /\s/.test(txt[k])) k++;
    const esClave = txt[k] === ':';
    /* Y una URL tampoco es prosa: la dirección de una fuente lleva el
       titular del medio dentro —«…que-parte-de-que-me-converti-no-entendiste/»—
       y eso no lo escribimos nosotros ni se lee como texto. Se reconoce por
       la forma y no con un renglón de lista, que es lo que hace que una
       dirección nueva no cueste una excepción. */
    const valor = txt.slice(ini, j);
    const esUrl = /^(https?:|www\.|\/\/)/.test(valor);
    if (!esClave && !esUrl) for (let q = ini; q < j; q++) s[q] = 1;
    i = j + 1;
  }
  return s;
}

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

/* UNA GUARDA DE FUGA FALLA EN VERDE (v1024).
   Las que vigilan que algo NO se haya colado a lo servido -la propiedad del
   motor, la llave de la base, la ubicacion de alguien- comparten una forma
   peligrosa: afirman `encontrados.length === 0`. Si la lista de archivos sale
   vacia por un error de ruta, o si el patron deja de reconocer lo que busca
   porque al otro lado le cambiaron el nombre, `[].length === 0` pasa IGUAL y
   nadie se entera de que ya no se vigila nada. Es el verde que este proyecto
   persigue desde la v878, en las cuatro comprobaciones donde mas caro sale.

   Por eso las cuatro pasan por aqui, que hace las tres cosas de una vez:
   busca, comprueba que MIRO algo, y comprueba que el patron TODAVIA reconoce
   un caso de respuesta conocida. El caso es un IDENTIFICADOR -un nombre de
   variable, una clave de configuracion-, nunca un valor: un secreto no se
   escribe en el repositorio ni para probar una guarda. */
function guardaDeFuga(nombre, archivos, patron, ejemplo, minimo) {
  /* Sin la bandera `g`: un patron global guarda su posicion entre llamadas y
     `test` empieza a devolver false una vez de cada dos. */
  const p = new RegExp(patron.source, patron.flags.replace('g', ''));
  const bastantes = archivos.length >= (minimo || 20);
  const reconoce = p.test(ejemplo);
  /* Y aqui va la ROJA, no un `?` SIN MATERIAL, que es donde esta guarda se
     aparta de la regla de la v970. Aquella dice que una guarda sin material
     no se pone roja porque se queda sin el cuando los DATOS mejoran, y un
     rojo ahi presiona a dejar el registro torcido. Una guarda de fuga no
     tiene ese incentivo: su material es el CODIGO SERVIDO, que no puede
     quedarse legitimamente vacio, y su caso conocido es una cadena escrita
     aqui mismo, que no puede dejar de reconocerse por si sola. Que no pueda
     correr es un defecto, siempre — como la suite muda de la v963. */
  if (!bastantes || !reconoce) {
    comprobar(nombre, false,
      !bastantes
        ? 'NO PUDO CORRER: la lista trae ' + archivos.length + ' archivo(s), asi que no vigilaria nada'
        : 'NO PUDO CORRER: el patron ya no reconoce su caso conocido, asi que vigila un nombre que al otro lado ya no existe');
    return;
  }
  const encontrados = archivos.filter((f) => p.test(leer(f)));
  comprobar(nombre, encontrados.length === 0,
    encontrados.length
      ? 'lo traen: ' + encontrados.join(', ')
      : archivos.length + ' archivos revisados, y el patron sigue reconociendo su caso');
}

// ── 1. la lista de precarga apunta a archivos que existen ────────────────
console.log('\n  -- el modo sin conexión --');
{
  const sw = leer('service-worker.js');
  const listados = [...new Set([...sw.matchAll(
    /['"]([^'"\s]+\.(?:html|js|css|json|png|svg|webmanifest))(?:\?[^'"]*)?['"]/g)].map(m => m[1]))];
  const faltan = listados.filter(f => !fs.existsSync(R(f.replace(/^\.?\//, ''))));
  /* `listados` ya contaba lo que hace falta —lo que el barrido ENCONTRÓ en el
     service worker, no los archivos que abrió— y lo decía en el MENSAJE, que
     es donde un cero sale con su palomita: «0 archivos» se lee igual de bien
     que «175 archivos». El número pasa a la CONDICIÓN. Un service worker cuya
     lista de precarga se quede vacía no es este: es el patrón que dejó de
     reconocerla. */
  comprobar('todo lo que se precarga existe',
    faltan.length === 0 && listados.length >= 20,
    faltan.length ? 'FALTAN: ' + faltan.join(', ')
      : listados.length < 20
        ? 'NO PUDO CORRER: el barrido solo sacó ' + listados.length + ' archivos de la lista de precarga'
        : listados.length + ' archivos');

  /* Y al revés, que es el fallo que de verdad ocurrió: nueve archivos que
     index.html carga —el módulo educativo entre ellos— no estaban en la
     lista. La app abría sin red y le faltaba media función, sin ningún
     error visible: en plena salida a campo, «Falta el módulo educativo».
     Este lado no se comprobaba porque todo lo listado sí existía. */
  /* Y esto valía para index.html y para `js/` y `css/`, nada más (v1016).
     Las otras páginas que este service worker gobierna —su ámbito es la raíz—
     nunca pasaban por acá, y los iconos y los manifiestos tampoco: medido,
     faltaban el `apple-touch-icon` de index y de analisis-ia, y el manifiesto
     y los dos iconos de `reportes.html`, que es la dirección de arranque que
     el APK lleva grabada.

     `vision-territorial.html` queda fuera a propósito: tiene service worker
     propio, con ámbito más específico, y su propia comprobación más abajo. */
  const PAGINAS = fs.readdirSync(RAIZ)
    .filter((f) => /\.html$/.test(f) && f !== 'vision-territorial.html').sort();
  const sinCache = [];
  let refs = 0;
  PAGINAS.forEach(function (h) {
    const t2 = leer(h);
    const locales = [...new Set(
      [...t2.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]))]
      .map((r) => r.split('?')[0].replace(/^\.\//, ''))
      .filter((r) => r && !/^(https?:|data:|#|\/\/)/.test(r));
    refs += locales.length;
    locales.forEach(function (r) {
      if (!sw.includes("'./" + r + "'")) sinCache.push(h + ' → ' + r);
    });
  });
  comprobar('y todo lo que sus páginas cargan se precarga',
    sinCache.length === 0 && refs >= 20,
    sinCache.length ? 'SIN PRECACHE: ' + sinCache.join(' · ')
      : refs < 20
        ? 'NO PUDO CORRER: el barrido solo vio ' + refs + ' referencias locales en ' + PAGINAS.length + ' páginas'
        : refs + ' referencias locales en ' + PAGINAS.length + ' páginas: ' + PAGINAS.join(', '));

  /* La guarda de la guarda: lo de arriba se apoya en mirar TODAS las páginas
     que este service worker gobierna, no una. Si volviera a mirar solo
     index.html, el hueco de las otras tres no lo vería nadie (v878). */
  comprobar('y se miran todas las páginas del ámbito, no una sola',
    PAGINAS.length >= 3 && PAGINAS.indexOf('index.html') !== -1,
    PAGINAS.length >= 3
      ? 'son ' + PAGINAS.length + ' y se leen del disco, así que una página nueva queda vigilada sin que su autor se acuerde'
      : 'se está mirando ' + PAGINAS.length + ': las demás quedarían sin comprobar');

  /* Un manifiesto declara su propia PUERTA DE ARRANQUE, y la superficie que lo
     usa tiene que alcanzarlo: sin eso, instalar la app abre OTRA. Medido, dos
     lo estaban — `manifest-empresarial.json` declara `/analisis-ia.html` y esa
     página enlazaba el general, que arranca en «/», así que quien instalaba
     URBIS Empresas terminaba en la aplicación ciudadana; y el educativo igual.
     Es la clase C: el archivo existe, el mecanismo para usarlo existe, y nada
     los conecta — desde afuera se ve igual que si el manifiesto no existiera.

     Se alcanza por DOS caminos y los dos cuentan: el `<link>` de una página, o
     la tabla de identidades de js/70-modo-app.js, que lo intercambia cuando
     index.html arranca en un modo. La lista de manifiestos se lee del disco,
     así que uno nuevo queda vigilado sin que su autor se acuerde (v867). */
  const MANIFIESTOS = fs.readdirSync(RAIZ)
    .filter((f) => /^manifest.*\.json$/.test(f)).sort();
  const alcanzados = new Set();
  PAGINAS.concat(['vision-territorial.html']).forEach(function (h) {
    [...leer(h).matchAll(/rel="manifest"[^>]*href="([^"?]+)"/g)]
      .forEach((m) => alcanzados.add(m[1].replace(/^\.\//, '')));
  });
  const modoApp = soloCodigo(leer('js/70-modo-app.js'));
  const IDENTS = [...modoApp.matchAll(/\{[^{}]*manifiesto:\s*'([^']+)'[^{}]*\}/g)];
  IDENTS.forEach((m) => alcanzados.add(m[1]));
  const sinAlcanzar = MANIFIESTOS.filter((m) => !alcanzados.has(m));
  comprobar('todo manifiesto lo alcanza una página o la tabla de identidades',
    sinAlcanzar.length === 0 && MANIFIESTOS.length >= 3,
    sinAlcanzar.length
      ? 'no lo alcanza nadie: ' + sinAlcanzar.join(' · ') +
        ' — instalar esa app abriría otra, porque su página enlaza un manifiesto cuyo start_url no es el suyo'
      : MANIFIESTOS.length < 3
        ? 'NO PUDO CORRER: solo ' + MANIFIESTOS.length + ' manifiesto(s) leído(s)'
        : 'los ' + MANIFIESTOS.length + ' se alcanzan: ' + MANIFIESTOS.join(', '));

  /* Y lo que la tabla de identidades escribe SALE del manifiesto, no de
     memoria: el nombre y el color de la app están declarados en dos sitios, y
     al escribir la entrada del modo educativo puse un tema y un nombre que el
     manifiesto no dice. Es la clase B cometida en la tanda que la cita, y la
     cazó medir el archivo en vez de leer el renglón. */
  const desajuste = [];
  IDENTS.forEach(function (m) {
    let j;
    try { j = JSON.parse(leer(m[1])); } catch (e) { desajuste.push(m[1] + ': no se pudo leer'); return; }
    const nom = /nombre:\s*'([^']*)'/.exec(m[0]);
    const tem = /tema:\s*'([^']*)'/.exec(m[0]);
    if (nom && j.short_name && nom[1] !== j.short_name) {
      desajuste.push(m[1] + ': nombre «' + nom[1] + '» contra short_name «' + j.short_name + '»');
    }
    if (tem && j.theme_color && tem[1].toLowerCase() !== String(j.theme_color).toLowerCase()) {
      desajuste.push(m[1] + ': tema ' + tem[1] + ' contra theme_color ' + j.theme_color);
    }
  });
  comprobar('y el nombre y el color de cada identidad salen de SU manifiesto',
    desajuste.length === 0 && IDENTS.length >= 2,
    desajuste.length ? 'escritos de memoria: ' + desajuste.join(' · ')
      : IDENTS.length < 2
        ? 'NO PUDO CORRER: la tabla de identidades trae ' + IDENTS.length + ' entrada(s), así que no habría dos hechos que atar'
        : 'las ' + IDENTS.length + ' coinciden con su manifiesto');
}

// ── 2. una sola puerta al servidor ───────────────────────────────────────
console.log('\n  -- una sola puerta al servidor --');
{
  const PUERTA = '67-analisis-cliente.js';
  /* Pasa por `guardaDeFuga` (v1024) y no por un filtro suelto: es la misma
     forma —una lista de archivos y un patrón— y lo que gana es la mitad que
     le faltaba, su CASO CONOCIDO. Sin él, el día que el puente cambie de
     nombre esta afirmación sale en verde diciendo «ningún otro archivo»
     sobre un patrón que ya no reconoce a nadie. */
  guardaDeFuga('solo js/' + PUERTA + ' llama al puente (js/66)',
    fs.readdirSync(R('js')).filter(f => f.endsWith('.js') && f !== PUERTA).map(f => 'js/' + f),
    /AIA_REMOTO\s*\.\s*analizar/, 'AIA_REMOTO.analizar(peticion);');
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
    /* Cuántos nombres llegó a MIRAR el lector. Es el material, y no había
       ninguno: la afirmación decía «ninguno» a secas, que es lo mismo que
       dice el día que `despejar` devuelva la cadena vacía por un error de
       lectura —entonces no hay tokens, no hay sueltos, y sale en verde—. */
    let mirados = 0;
    src.split('\n').forEach((ln, i) => {
      const s = ln.replace(/\.\s*([A-Za-z_$][\w$]*)/g, ' ')     // .propiedad
                  .replace(/([A-Za-z_$][\w$]*)\s*:/g, ' ');     // {clave:
      for (const m of s.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
        const n = m[1];
        mirados++;
        if (decl.has(n) || globales.has(n) || vistos.has(n)) continue;
        vistos.set(n, i + 1);
      }
    });
    return { nombres: [...vistos].map(([n, l]) => n + ' (línea ' + l + ')'), mirados: mirados };
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
    /* El mínimo lo pone el miembro MÁS CHICO que es legítimo, no el más
       grande. La primera versión pidió 50 y puso en rojo a
       js/59-analisis-ia-catalogo.js, que tiene 29 y está perfectamente: es un
       catálogo de datos, casi todo cadenas, y `despejar` se las quita. Un
       mínimo que denuncia a un miembro sano es la trampa de la v895 —una
       guarda con falsos positivos acaba siendo una lista de excepciones que
       envejece— así que baja a 10. Con eso caza la rotura ENTERA, que es la
       que deja el lector en cero, y no la parcial; y eso se dice, en vez de
       dejarla pareciendo más de lo que es. */
    comprobar(cual, s.nombres.length === 0 && s.mirados >= 10,
      s.nombres.length ? s.nombres.join(', ')
        : s.mirados < 10
          ? 'NO PUDO CORRER: el lector solo sacó ' + s.mirados + ' nombres de este archivo'
          : 'ninguno, de ' + s.mirados + ' nombres mirados');
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
  /* El barrido sale a una función con nombre para poder medirlo contra un
     caso conocido, que es la mitad que le faltaba. La que tenía contaba los
     ARCHIVOS QUE ABRIÓ —«105 archivos revisados»— y ese número no se mueve
     el día que el repositorio cambie de sangría: el patrón dejaría de ver una
     sola declaración y la afirmación saldría en verde igual. Lo que hay que
     contar es lo que el barrido ENCONTRÓ, que es lo que sí baja a cero. */
  const declaradasEn = (txt) => {
    const vistas = {};
    txt.split('\n').forEach((l, i) => {
      const m = /^  function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(l);
      if (m) (vistas[m[1]] = vistas[m[1]] || []).push(i + 1);
    });
    return vistas;
  };
  /* Las dos direcciones en un solo caso: ve las dos del primer nivel y calla
     la de adentro, que es legítima y corriente —dos ayudantes que se llamen
     igual en dos ámbitos distintos no son un defecto (v885)—. */
  const CASO_FN = '  function pintar(a) {\n    function pintar(b) {}\n  }\n  function pintar(c) {}\n';
  const vistoFN = declaradasEn(CASO_FN);
  comprobar('el barrido ve las del primer nivel y calla las de adentro',
    Object.keys(vistoFN).length === 1 && (vistoFN.pintar || []).length === 2,
    'del caso conocido saca ' + JSON.stringify(vistoFN));

  const dobles = [];
  let declaraciones = 0;
  fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).sort().forEach(f => {
    const vistas = declaradasEn(leer('js/' + f));
    Object.keys(vistas).forEach(k => {
      declaraciones += vistas[k].length;
      if (vistas[k].length > 1) dobles.push('js/' + f + ' · ' + k + ' en ' + vistas[k].join(' y '));
    });
  });
  /* El mínimo no es un número de gusto. Un extractor roto da CERO, así que
     cualquier mínimo por encima de cero caza la rotura entera; se pone un
     orden de magnitud por debajo de lo que hay hoy (2.742) para que cace
     además una rotura PARCIAL sin ponerse rojo porque el repositorio encoja. */
  comprobar('ninguna función del primer nivel se declara dos veces en su archivo',
    dobles.length === 0 && declaraciones >= 200,
    dobles.length ? dobles.slice(0, 5).join(' | ')
      : declaraciones < 200
        ? 'NO PUDO CORRER: el barrido solo vio ' + declaraciones + ' declaraciones de primer nivel'
        : declaraciones + ' declaraciones de primer nivel revisadas');
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
  /* Los dos lados del barrido tienen que contarse, y solo uno se contaba: el
     mensaje decía «3.549 clases con regla», que es el lado del CSS. El lado
     de los ELEMENTOS no decía nada — y es el que se rompe callado, porque el
     día que el marcado se escriba con `classList.add` en vez de con un
     atributo `class="…"`, este barrido deja de encontrar un solo elemento y
     la afirmación sale en verde sin haber mirado ninguno. */
  let conClasePropia = 0;
  archivos.forEach(f => {
    const s = leer(f);
    let m; const re = /class\s*=\s*(?:\\?["'])([^"'<>]*?)(?:\\?["'])/g;
    while ((m = re.exec(s)) !== null) {
      const cs = m[1].split(/\s+/).filter(c => c && !/[^\w-]/.test(c));
      if (!cs.length || !cs.some(c => PROPIA.test(c))) continue;
      conClasePropia++;
      if (cs.some(c => conRegla.has(c))) continue;
      if (cs.every(c => ASIDEROS[c])) continue;
      pelados.push(f + ':' + s.slice(0, m.index).split('\n').length + ' · ' + cs.join(' '));
    }
  });
  comprobar('todo elemento con clase propia tiene al menos una con regla',
    pelados.length === 0 && conRegla.size >= 200 && conClasePropia >= 100,
    pelados.length ? pelados.slice(0, 6).join(' | ')
      : (conRegla.size < 200 || conClasePropia < 100)
        ? 'NO PUDO CORRER: ' + conRegla.size + ' clases con regla y ' + conClasePropia +
          ' elementos con clase propia'
                   : conRegla.size + ' clases con regla · ' + conClasePropia + ' elementos · ' +
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
  /* Cuántas aperturas `<text` llegó a MIRAR el barrido. Es lo que hay que
     contar, y no los archivos que abrió: aquel número no se mueve el día que
     los rótulos de un SVG se armen con `createElementNS` en vez de con
     marcado, y entonces esta afirmación saldría en verde sin haber mirado un
     solo glifo. Hoy son 76, así que el mínimo va un orden de magnitud por
     debajo: un extractor roto da cero y eso es lo que tiene que cazar. */
  let aperturas = 0;
  /* La decisión sale del bucle para poder medirla contra casos de respuesta
     conocida. Son tres y cada uno tapa algo distinto: que el trazo se vea,
     que un rótulo limpio NO se denuncie —sin esa mitad, el arreglo podría ser
     denunciarlos todos—, y que un `=>` de JavaScript dentro de un atributo no
     cierre la etiqueta antes de tiempo, que es la razón por la que el corte
     salta los `>` precedidos de `=`. */
  const aperturaDeTexto = (txt, i) => {
    const trozo = txt.slice(i, i + 700);
    for (let k = 5; k < trozo.length; k++)
      if (trozo[k] === '>' && trozo[k - 1] !== '=') return trozo.slice(0, k);
    return trozo;
  };
  const llevaTrazo = (abre) => /\bstroke\s*=|\bstroke-width\s*=|\bpaint-order\s*=/.test(abre);
  {
    const conT = '<text x="1" y="2" stroke="#fff" paint-order="stroke">a</text>';
    const sinT = '<text x="1" y="2" class="rot">a</text>';
    const conFlecha = '<text x="' + "' + (n => n) + '" + '" stroke="#fff">a</text>';
    comprobar('el barrido ve el trazo, calla el rótulo limpio y no se corta en un =>',
      llevaTrazo(aperturaDeTexto(conT, 0)) && !llevaTrazo(aperturaDeTexto(sinT, 0)) &&
      llevaTrazo(aperturaDeTexto(conFlecha, 0)),
      've el trazo, calla el limpio y pasa de largo el => del atributo');
  }
  archivos.forEach(f => {
    const s = leer(f);
    let m; const re = /<text\b/g;
    while ((m = re.exec(s)) !== null) {
      aperturas++;
      /* Hasta donde la etiqueta de apertura se cierra. El `>` puede estar a
         varias concatenaciones de distancia, así que se mira una ventana y
         se corta en el primer `>` que no venga de un `=>` de JavaScript. */
      if (llevaTrazo(aperturaDeTexto(s, m.index)))
        conHalo.push(f + ':' + s.slice(0, m.index).split('\n').length);
    }
  });
  comprobar('ningún <text> servido lleva trazo encima del glifo',
    conHalo.length === 0 && aperturas >= 8,
    conHalo.length ? conHalo.slice(0, 6).join(' | ')
      : aperturas < 8
        ? 'NO PUDO CORRER: el barrido solo vio ' + aperturas + ' aperturas <text'
        : aperturas + ' aperturas <text revisadas en ' + archivos.length + ' archivos');
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
  /* Y aquí el conteo NO se pone rojo, que es donde esta afirmación se aparta
     de las tres de arriba. La frontera es la de la v1024: una guarda de fuga
     va en rojo sin material porque el suyo es CÓDIGO SERVIDO, que no puede
     quedarse legítimamente vacío. El material de esta es otra cosa —un
     `<script>` escrito DENTRO del HTML—, y que no quede ninguno es
     exactamente lo que pasaría si alguien los sacara todos a sus archivos,
     que es mejor práctica y no un defecto. Ponerlo en rojo sería la guarda
     que se pone roja cuando el repositorio MEJORA (v970): un rojo que empuja
     a dejar un script suelto adentro para tener algo que revisar. */
  if (!cuantos) {
    anotarSinMaterial('todos parsean',
      'ninguna página trae ya un <script> escrito adentro, así que no hay cuál parsear — ' +
      'puede ser que se sacaran a sus archivos, y puede ser que el extractor dejara de verlos');
  } else {
    comprobar('todos parsean', rotos.length === 0,
      rotos.length ? 'ROTOS: ' + rotos.join(', ') : cuantos + ' scripts en ' + paginas.length + ' páginas');
  }
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
  let llavesVistas = 0;

  /* El lector sale a una función con nombre para poder medirlo contra casos
     de respuesta conocida, y de paso devuelve CUÁNTAS llaves llegó a contar.
     Ese es el material: la afirmación decía «55 hojas revisadas», y ese
     número no se mueve si el lector deja de leer —se queda en 55 aunque no
     haya mirado un solo carácter—. Las llaves sí bajan a cero. */
  const revisarHoja = (css) => {
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

    if (enComentario) return { mal: 'comentario abierto en la línea ' + comentarioAbiertoEn + ' y nunca cerrado', llaves: 0 };
    /* Un cierre de comentario suelto —sin su apertura delante— es tan grave
       como un comentario sin cerrar, y no se veía: el navegador se salta desde
       ahí hasta que logra reengancharse, y la regla que sigue desaparece sin
       que nada avise. Pasó de verdad: al partir un comentario en dos quedó un
       cierre huérfano y con él se cayó la regla que centraba los iconos. Las
       llaves seguían cuadrando, así que la comprobación de al lado no lo veía. */
    const huerfano = limpio.indexOf('*' + '/');
    if (huerfano >= 0) {
      const lineaH = css.slice(0, css.indexOf('*' + '/', huerfano)).split('\n').length;
      return { mal: 'hay un cierre de comentario suelto cerca de la línea ' + lineaH +
                    ' (la regla que le sigue no se aplica)', llaves: 0 };
    }
    if (comilla) return { mal: 'hay un texto sin cerrar', llaves: 0 };
    const abre = (limpio.match(/{/g) || []).length;
    const cierra = (limpio.match(/}/g) || []).length;
    return { mal: abre !== cierra ? abre + ' llaves abiertas y ' + cierra + ' cerradas' : '', llaves: abre };
  };

  /* Los cuatro defectos que el lector existe para ver, y —la mitad que de
     verdad guarda— una hoja sana que NO se denuncia: sin ella, el arreglo
     podría ser denunciarlas todas. La sana lleva adentro el `content:"}"`
     que es legal y no desbalancea nada, que es justo por lo que las llaves se
     cuentan después de quitar comentarios y textos. */
  {
    const SANA = 'a{color:#fff}\n.b::after{content:"}"}\n/* nota */\n.c{top:0}\n';
    const sana = revisarHoja(SANA);
    const pruebas = [
      ['un comentario sin cerrar', revisarHoja('.a{top:0}\n/* y aquí se acaba\n.b{top:1}\n').mal],
      ['un cierre de comentario suelto', revisarHoja('.a{top:0}\n*' + '/\n.b{top:1}\n').mal],
      ['un texto sin cerrar', revisarHoja('.a{content:"sin cerrar}\n').mal],
      ['una llave de más', revisarHoja('.a{top:0\n.b{top:1}\n').mal]
    ];
    const ciegas = pruebas.filter(x => !x[1]).map(x => x[0]);
    comprobar('el lector ve los cuatro defectos y deja pasar una hoja sana',
      ciegas.length === 0 && !sana.mal && sana.llaves === 3,
      ciegas.length ? 'no ve: ' + ciegas.join(', ')
        : sana.mal ? 'denuncia una hoja sana: ' + sana.mal
        : 've los cuatro, y de la sana cuenta sus ' + sana.llaves + ' llaves');
  }

  hojas.forEach(f => {
    const r = revisarHoja(leer('css/' + f));
    llavesVistas += r.llaves;
    if (r.mal) rotas.push(f + ': ' + r.mal);
  });

  /* Hoy cuenta 8.367 llaves; el mínimo va un orden de magnitud por debajo. */
  comprobar('ninguna hoja tiene comentarios o llaves sin cerrar',
    rotas.length === 0 && llavesVistas >= 800,
    rotas.length ? rotas.join(' · ')
      : llavesVistas < 800
        ? 'NO PUDO CORRER: el lector solo contó ' + llavesVistas + ' llaves en ' + hojas.length + ' hojas'
        : llavesVistas + ' llaves contadas en ' + hojas.length + ' hojas');
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

  guardaDeFuga('ningún archivo servido trae el clasificador', servidos,
    /\bclasificarPOI\b|\bpuntajePOI\b/,
    'function clasificarPOI(p) { return 1; }');

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
  /* Los dos casos conocidos son NOMBRES —una variable de entorno, una clave
     de configuración—, no valores: un secreto no se escribe acá ni para
     probar la guarda que lo vigila. */
  guardaDeFuga('ningún archivo servido trae la llave de la base ni sus roles', servidos,
    LLAVES, 'const u = process.env.VT_DATABASE_URL;');
  guardaDeFuga('ningún archivo servido trae las claves de umbrales ni de pesos', servidos,
    UMBRALES, '{ "peso_poblacion": 0.4 }');
  comprobar('el esquema y el motor de Visión Territorial no están en el repositorio público',
    !fs.existsSync(R('vt')) && servidos.every(f => !/CREATE POLICY|ST_ClusterDBSCAN|enTerritorio\(/.test(leer(f))), 'carpeta vt/ ausente');

  // Ámbito propio: service worker y manifiesto suyos, y lo precargado existe.
  const sw = leer('sw-vt.js');
  const listados = [...new Set([...sw.matchAll(/['"](\.\/[^'"\s]+\.(?:html|js|css|json|png))['"]/g)].map(m => m[1]))];
  const faltan = listados.filter(f => !fs.existsSync(R(f.replace(/^\.\//, ''))));
  const locales = scripts.filter(x => !/^https?:/.test(x)).concat([...pag.matchAll(/href="(css\/[^"?]+)/g)].map(m => m[1]));
  const sinCache = locales.filter(f => !sw.includes('./' + f));
  comprobar('todo lo que sw-vt.js precarga existe, y todo lo local que la página carga está precargado',
    faltan.length === 0 && sinCache.length === 0 && listados.length >= 3 && locales.length >= 2,
    (faltan.length ? 'FALTAN: ' + faltan.join(', ') + ' ' : '') +
    (sinCache.length ? 'SIN PRECACHE: ' + sinCache.join(', ')
      : (listados.length < 3 || locales.length < 2)
        ? 'NO PUDO CORRER: el barrido sacó ' + listados.length + ' archivos del service worker y ' +
          locales.length + ' de la página'
        : listados.length + ' archivos'));
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

    /* LA AFIRMACIÓN SE DIO VUELTA EN LA v1050, y lo que tiene que fallar es
       justo lo que antes tenía que pasar —la misma vuelta que dieron las dos
       de la v876 y las dos de la v887—.

       Lo que la v972 guardaba sigue guardado y no se aflojó: el intervalo se
       sigue calculando de las dos cotas, y el peldaño que se publica sigue
       siendo el que el cálculo respalda. Lo que cambió es cuál de los dos
       extremos se publica y cómo se rotula: `peorMin` es el que sostiene lo
       confirmado, y como los tres techos solo empeoran con más material, ese
       extremo es un PISO. Lo pendiente no se esconde: va con su nombre bajo
       su propio rótulo. Las siete comprobaciones del bloque v1050, al final
       de este archivo, son las que vigilan que no se publique la mitad. */
    comprobar('con el techo indeterminado el peldaño se publica marcado, no se calla',
      tramoV2.length > 0 &&
      /var determinado = peorMin === peorMax;/.test(tramoV2) &&
      /\} else if \(!determinado\) \{/.test(tramoV2) &&
      !/id: 'sin-nivel'/.test(tramoV2),
      !tramoV2.length ? 'no se encontró el tramo del veredicto: la comprobación no vale'
        : /id: 'sin-nivel'/.test(tramoV2)
          ? 'volvió a callar el peldaño: hay uno que lo confirmado sí sostiene'
          : 'con peorMin ≠ peorMax publica peorMin marcado como provisional');

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

    /* Y que el peldaño esté pintado: una clase que ninguna regla pinta es
       HTML válido y no lo dice nadie (v895). «Sin datos suficientes» va en
       GRIS y no en rojo —que falte material es deuda nuestra, no un hallazgo
       sobre el gobierno—.

       v1050 · `sp-fi-v-sin-nivel` se retiró con la rama que lo emitía, así
       que lo que se vigila es el gris que SÍ queda vivo más las dos clases
       del texto de lo pendiente. */
    comprobar('el peldaño gris tiene su regla en la hoja de estilo, y las de lo pendiente',
      /\.sp-fi-v-sin-datos\{[^}]*--vc-claro:var\(--ink-2\)/.test(c70niv) &&
      !/\.sp-fi-v-sin-nivel\{/.test(c70niv) &&
      /\.sp-fi-vfalta\{/.test(c70niv) && /\.sp-fi-falta\{/.test(c70niv),
      /\.sp-fi-v-sin-nivel\{/.test(c70niv)
        ? 'sp-fi-v-sin-nivel sigue en la hoja y ya no la emite nadie'
        : 'sp-fi-v-sin-datos, sp-fi-vfalta y sp-fi-falta pintadas');

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

    /* ── v1060 · lo pendiente se nombra aunque ya no mueva el veredicto ──
       Son dos hechos distintos y la v1057 los tenía colgados del mismo `if`:
       «el veredicto es provisional» y «quedan lecturas sin declarar». Al
       declarar tres identidades el intervalo se cerró y la lista de lo que
       falta desapareció con la marca de provisional, con una lectura todavía
       pendiente — y desde afuera «ya están todas» y «queda una que no mueve el
       veredicto» se leen igual (v966).

       Y van las DOS redacciones escritas (v970): la que hace falta es
       justamente la que no existía, la del día en que otro techo ya fija el
       veredicto por encima del intervalo entero. */
    comprobar('lo que falta por declarar se nombra aunque el veredicto ya no sea provisional',
      /if \(f\.ejeA && f\.ejeA\.sinDeclarar\) \{/.test(j70c1) &&
      !/if \(f\.determinado === false && f\.ejeA && f\.ejeA\.falta\)/.test(j70c1),
      /if \(f\.determinado === false && f\.ejeA && f\.ejeA\.falta\)/.test(j70c1)
        ? 'la lista cuelga de que el veredicto sea provisional: en cuanto deje de serlo, lo que falte desaparece sin que nada lo diga'
        : 'se pinta por `sinDeclarar`, que es el hecho que de verdad la decide');

    comprobar('y están escritas las DOS redacciones, la de hoy y la del día que deje de bloquear',
      /y por eso el peldaño es provisional/.test(j70c1) &&
      /y ya no mueve este veredicto/.test(j70c1) &&
      /sigue bloqueando es el eje A/.test(j70c1),
      !/y ya no mueve este veredicto/.test(j70c1)
        ? 'falta la redacción de cuando otro techo ya fija el veredicto: es la que hace falta hoy'
        : !/y por eso el peldaño es provisional/.test(j70c1)
          ? 'falta la redacción de cuando sí lo bloquea: es la que hace falta el día que entre una contradicción nueva'
          : 'las dos escritas, y la segunda dice qué sigue bloqueando el eje A');

    /* ── v1134 · UNA ESPERA DECIDIDA NO ES TRABAJO SIN HACER ─────────────
       El eje A no publica nivel porque una contradicción no declara su
       identidad de objeto, y eso salía en la ficha bajo el encabezado
       «Falta para poder publicarlo» con el hueco descrito y nada más. Desde
       afuera —y esa pantalla juzga a una persona con nombre— se leía como
       trabajo que nadie ha hecho; y es lo contrario: está DECIDIDO esperar,
       la prueba está escrita desde la v971 y tiene fecha. Son la distinción
       de la v899 dentro de un solo estado, otra vez (v1093, v1116): uno pide
       no volver a mirar hasta su fecha, el otro pide ponerse.

       LA FECHA SALE DEL REGISTRO y nunca del código (v903): tecleada acá
       envejecería sola y moverla no se vería en ningún dato. Por eso la
       guarda comprueba las dos mitades — que `ejeA` lea `revision` del caso,
       y que no haya ninguna fecha escrita a mano en su cuerpo.

       LAS TRES REDACCIONES van escritas (v970, v1094): todas las pendientes
       en espera, ALGUNAS, y ninguna. La del medio es la que hará falta el día
       que se documente otra contradicción sin resolver, y es justo la que no
       existiría si se escribiera solo para el caso de hoy.

       DE QUÉ NO RESPONDE (v945): de que la razón escrita en `revision.que`
       sea cierta, que no lo puede comprobar nadie (v1008); ni de que la fecha
       sea la correcta. Comprueba que la espera se distinga del descuido. */
    {
      const regEA = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
      const casosEA = ((regEA.contradicciones || {}).casos || []);
      /* EL MISMO PREDICADO QUE EL MÓDULO, y no uno parecido (v879, v906): una
         declarada en NO lleva `mismoObjetoVerificado: false`, que un `!c.x`
         cuenta como sin declarar, y las que van con `cuenta: false` no
         entran al eje. Con el filtro flojo el detalle decía «1 de 3» donde
         el módulo publica «1 de 5 · 1 sin declarar»: dos cuentas de un mismo
         hecho, separadas, que es justo lo que esta guarda vigila en otros. */
      const sinDecl = casosEA.filter((c) => c.estado === 'documentada' && c.cuenta !== false &&
                                            c.mismoObjetoVerificado === undefined);
      const conRev = sinDecl.filter((c) => (c.revision || {}).fecha && (c.revision || {}).que);

      /* VA CON `?` Y NO EN ROJO (v970, v1097): su material lo ponen los DATOS
         y llega a cero el día que se declare la identidad, que es el estado
         BUENO. Un rojo ahí pondría la salida barata en dejar la contradicción
         sin declarar para que la guarda siguiera teniendo algo que medir. */
      if (conRev.length) {
        comprobar('MATERIAL · alguna contradicción sin declarar trae su fecha de revisión', true,
          conRev.length + ' de ' + sinDecl.length + ' sin declarar traen `revision` con fecha y qué se mira: ' +
          conRev.map((c) => (c.id || c.tema || '?') + ' → ' + c.revision.fecha).join(' · '));
      } else {
        anotarSinMaterial('MATERIAL · alguna contradicción sin declarar trae su fecha de revisión',
          sinDecl.length
            ? 'hay ' + sinDecl.length + ' sin declarar y ninguna trae `revision`: no hay espera que distinguir'
            : 'ninguna contradicción sin declarar: el eje A ya no espera nada, que es el estado BUENO. Las ' +
              'tres redacciones se comprueban abajo contra el código y siguen mordiendo');
      }

      const leeRev = /var rv = c\.revision \|\| null;/.test(cuerpoEjeA) &&
                     /esperas\.push\(\{ tema: c\.tema \|\| '', fecha: rv\.fecha, que: rv\.que \}\);/.test(cuerpoEjeA) &&
                     /fechaLarga\(e\.fecha\)/.test(cuerpoEjeA);
      /* La fecha a mano, buscada en el CÓDIGO y no en los comentarios (v926):
         `cuerpoEjeA` sale de `j70c1`, que ya pasó por `soloCodigo`. */
      const fechaAMano = /20\d\d-\d\d-\d\d/.test(cuerpoEjeA) ||
                         /de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) de 20\d\d/.test(cuerpoEjeA);
      comprobar('el eje A lee la fecha de revisión del REGISTRO, y ninguna va escrita en su código',
        leeRev && !fechaAMano,
        !leeRev ? 'ejeA no deriva la espera de `revision`: la fecha tendría que estar en otro sitio'
          : fechaAMano ? 'hay una fecha escrita a mano en el cuerpo de ejeA: envejece sola y moverla no se ve en ningún dato (v903)'
          : 'la espera sale de `c.revision` y se imprime con `fechaLarga`, así que la fecha vive en el registro');

      const tresRed = [
        ['todas en espera', /esperas\.length && esperas\.length === sinDeclarar/.test(cuerpoEjeA) &&
                            /Y no es trabajo sin hacer/.test(cuerpoEjeA)],
        ['algunas', /Y las que faltan no son todas lo mismo/.test(cuerpoEjeA) &&
                    /esas sí son trabajo/.test(cuerpoEjeA)],
        ['ninguna', /ninguna de las que faltan declara una fecha de revisión/.test(cuerpoEjeA)]
      ];
      const sinRed = tresRed.filter((x) => !x[1]).map((x) => x[0]);
      comprobar('y están escritas las TRES redacciones: todas en espera, algunas y ninguna',
        cuerpoEjeA.length > 0 && sinRed.length === 0 &&
        /Declararla antes sería resolver a conveniencia/.test(cuerpoEjeA),
        !cuerpoEjeA.length ? 'no se encontró el cuerpo de ejeA: la guarda se quedó sin material'
          : sinRed.length ? 'falta la redacción de «' + sinRed.join('» y «') +
            '»: con una sola, el día que cambie el registro la pantalla dice lo que no es'
          : !/Declararla antes sería resolver a conveniencia/.test(cuerpoEjeA)
            ? 'ya no dice por qué no se adelanta: sin esa frase, la espera se lee como una excusa'
            : 'las tres, y la de «algunas» es la que hará falta el día que entre otra contradicción sin resolver');
    }

    /* ── v1060 · la razón de cada caso llega a la pantalla ─────────────
       El campo lo vigila una guarda de registro más abajo; esta vigila la otra
       mitad, que es la que lo vuelve útil: un campo que ninguna superficie
       alcanza se ve, desde afuera, igual que uno que no existe (clase C). */
    comprobar('y la razón de CADA caso se pinta, no solo la definición del estado',
      /x\.identidadRazon/.test(cuerpoCx) && /sp-cx-ident-r/.test(cuerpoCx) &&
      /\.sp-cx-ident-r\{/.test(c70niv.replace(/\s+/g, '')) ,
      !/x\.identidadRazon/.test(cuerpoCx)
        ? 'la lista no lee la razón: declarar que dos frases hablan del mismo objeto sería una marca que nadie puede abrir'
        : !/\.sp-cx-ident-r\{/.test(c70niv.replace(/\s+/g, ''))
          ? 'la razón se imprime y ninguna regla la pinta (v895)'
          : 'la lista pinta la razón del caso, con su regla en la hoja');

    /* Y gana la del hilo: escrita antes de `.sp-cx-ident p`, o con un punto
       menos de especificidad, la regla general le pasa por encima y el hilo no
       se pinta — que es el defecto exacto que la v1056 pagó con
       `.sp-fi-terceros`, y que leyendo el CSS se ve perfectamente bien. */
    {
      const plano = c70niv.replace(/\s+/g, '');
      const iGen = plano.indexOf('.sp-cx-identp{');
      const iRaz = plano.indexOf('.sp-cx-identp.sp-cx-ident-r{');
      comprobar('y la regla de la razón gana a la general: va después y con su misma forma',
        iGen >= 0 && iRaz > iGen,
        iGen < 0
          ? 'NO PUDO CORRER: no se encontró la regla general de los párrafos del bloque'
          : iRaz < 0
            ? 'la regla no lleva el `p.` delante: la general le gana por especificidad y el hilo no se pinta'
            : iRaz < iGen
              ? 'va ANTES que la general: con la misma especificidad manda el orden, y el hilo no se pinta'
              : 'declarada después de la general y con un punto más de especificidad');
    }

    /* ── v977, REHECHA EN LA v1143 · el sello va EN SU SITIO y se cuenta ───
       La v977 pedía que lo que no se dibuja fuera PLEGADO al final, con su
       recuento a la vista. La mitad del recuento sigue valiendo entera —si
       tres gráficos desaparecen y nada lo dice, la exención se lee igual que
       un aprobado—; la del pliegue se cambió, y conviene decir por qué el
       cambio no es aflojar: plegado, un hueco obliga a ABRIR algo para
       enterarse de que falta, así que desde la rejilla se ve exactamente
       igual que un gráfico que nunca se pensó. En su sitio y con el sello
       impreso, la carencia se lee donde el dato tendría que estar. Lo que se
       pierde es espacio; lo que se gana es que no haya que acordarse.

       Así que esta guarda mide ahora TRES cosas, y las tres se pueden
       romper: que haya UNA sola puerta —ninguno suelto por `poner`—, que esa
       puerta lo cuelgue en la rejilla Y lo cuente, y que el recuento salga
       del contador y no de un número tecleado, con las dos redacciones
       escritas (v970). */
    const cuerpoBg = (j70c1.match(/function bloqueDeGraficos\(cont\) \{[\s\S]*?\n  \}/) || [''])[0];
    const cuerpoRc = (j70c1.match(/function recuentoSinDato\(n\) \{[\s\S]*?\n  \}/) || [''])[0];
    const cuerpoSd = (j70c1.match(/function grafSinDato\(titulo, queMide, queFalta\) \{[\s\S]*?\n  \}/) || [''])[0];
    const sueltos = (cuerpoBg.match(/poner\(grafSinDato\(/g) || []).length;
    const recogidos = (cuerpoBg.match(/guardar\(grafSinDato\(/g) || []).length;
    /* La puerta: `guardar` tiene que CONTAR y COLGAR en la rejilla. Las dos
       mitades, porque si solo cuenta el sello no sale y si solo cuelga el
       recuento se queda en cero mintiendo. */
    const puerta = (cuerpoBg.match(/var guardar = function \(n\) \{[^\n]*\n?[^\n]*/) || [''])[0];
    const puertaCuenta = /nSinDato\+\+/.test(puerta);
    const puertaCuelga = /g\.appendChild\(n\)/.test(puerta);

    comprobar('MATERIAL · hay gráficos que el registro no puede dibujar',
      recogidos + sueltos >= 2,
      (recogidos + sueltos) + ' llamadas a grafSinDato · ' + recogidos + ' recogidas · ' + sueltos + ' sueltas');

    comprobar('todo gráfico sin dato pasa por UNA puerta, que lo cuelga en su sitio y lo cuenta',
      cuerpoBg.length > 0 && sueltos === 0 && recogidos >= 2 && puertaCuenta && puertaCuelga,
      !cuerpoBg.length ? 'NO PUDO CORRER: no se encontró bloqueDeGraficos'
        : sueltos ? sueltos + ' quedaron sueltos con poner(): dos maneras para una sola cosa (v940, v951)'
        : !puertaCuelga
          ? 'la puerta los cuenta y NO los cuelga en la rejilla: el recuento diría un número de gráficos que nadie ve'
          : !puertaCuenta
            ? 'la puerta los cuelga y NO los cuenta: el recuento se quedaría en cero con sellos a la vista'
            : 'las ' + recogidos + ' entran por guardar(), que las cuelga en la rejilla y las cuenta');

    /* El SELLO, que es lo que hace visible la carencia en su sitio: su marca
       impresa y su regla en la hoja —una clase que ninguna regla pinta es
       HTML válido y no lo dice nadie (v895)—. */
    comprobar('y cada uno lleva el sello de «falta evidencia» impreso, con su regla en la hoja',
      cuerpoSd.length > 0 && /'sp-sello'/.test(cuerpoSd) && /Falta evidencia/.test(cuerpoSd) &&
      /\.sp-sello-m\{/.test(c70niv),
      !cuerpoSd.length ? 'NO PUDO CORRER: no se encontró grafSinDato'
        : !/Falta evidencia/.test(cuerpoSd)
          ? 'el gráfico sin dato no imprime el sello: en la rejilla se lee como uno más'
          : !/\.sp-sello-m\{/.test(c70niv)
            ? 'el sello se imprime y ninguna regla lo pinta (v895)'
            : 'imprime «Falta evidencia» y la hoja tiene su regla');

    /* ── v1145 · EL TONO DE UNA FIGURA ────────────────────────────────
       Tres papeles de color y una regla: lo que no declara tono queda
       NEUTRO. Lo que esta guarda impide es la deriva que haría inútil al
       rojo — que empiece a aparecer como color por defecto de algún gráfico
       y deje de señalar lo adverso, que es lo único para lo que está y lo
       que le da su fuerza al latido del tope. */
    {
      const regT = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
      const nota = String(regT._notaTono || '');
      const j70t = soloCodigo(leer('js/70-seguimiento.js'));

      comprobar('MATERIAL · el registro declara qué es el tono de una figura',
        nota.length > 400,
        nota.length ? 'la nota del esquema son ' + nota.length + ' caracteres'
                    : 'no hay `_notaTono`: el esquema del color no está escrito en ninguna parte');

      /* LA NOTA DICE LAS TRES COSAS QUE HACEN FALTA para no repetir los
         errores que este esquema estuvo a punto de cometer: que `tono` es una
         clave NUEVA y no toca `sentido` —que ya tiene dos vocabularios—, que
         lo no declarado queda neutro, y que el rojo está reservado. Se mide
         que las tres estén, no cómo se redacten. */
      const DICE = [
        ['que `tono` no toca `sentido`', /`sentido`/.test(nota) && /clase B|NUEVA/.test(nota)],
        ['que lo no declarado queda NEUTRO', /NEUTRO/.test(nota)],
        ['que el rojo está reservado', /reserva/i.test(nota) && /latido/.test(nota)]
      ];
      const faltan = DICE.filter((x) => !x[1]).map((x) => x[0]);
      comprobar('y la nota del esquema dice las tres cosas que lo hacen comprobable',
        nota.length > 400 && faltan.length === 0,
        !nota.length ? 'NO PUDO CORRER: no hay `_notaTono`'
          : faltan.length ? 'le falta decir ' + faltan.join(' · ')
          : 'dice que la clave es nueva, que lo no declarado queda neutro y que el rojo está reservado');

      /* Y EL CÓDIGO LA CUMPLE. Dos cosas que se pueden romper por separado:
         que el valor por defecto sea el neutro —no el rojo—, y que ningún
         gráfico pinte el rojo sin que el registro lo declare adverso. */
      /* SE BUSCA DENTRO DEL TROZO, y esto lo arregló una inyección que salió
         VERDE: el patrón corría sobre TODO js/70, así que al cambiar el valor
         por defecto de `claseDeTono` a 'adv' la guarda seguía pasando porque
         encontraba el `|| 'neu'` de `tintaDeTono`, que no se había tocado. Un
         patrón suelto encuentra el de la función de al lado (v854), y acá la
         función de al lado es casi idéntica. */
      const cuerpoDe70 = (n) => {
        const i = j70t.indexOf('function ' + n + '(');
        if (i < 0) return '';
        const j = j70t.indexOf('\n', i);
        return j < 0 ? j70t.slice(i) : j70t.slice(i, j + 1);
      };
      const cuerpoClase = cuerpoDe70('claseDeTono');
      const cuerpoTinta = cuerpoDe70('tintaDeTono');
      /* LAS DOS, porque las dos reparten color y las dos tienen que caer al
         neutro: si solo `claseDeTono` lo hiciera, un tono mal escrito pintaría
         la barra gris y le pondría encima la tinta del rojo. */
      const porDefectoNeutro = /\|\| 'neu'\)/.test(cuerpoClase) && /\|\| 'neu'\)/.test(cuerpoTinta);
      /* EL ROJO NO PUEDE ESCRIBIRSE A MANO EN NINGÚN GRÁFICO. La clase
         `sp-g-adv` no existe como literal en js/70 —se arma en `claseDeTono`
         con `'sp-g-' + …`—, así que CUALQUIER aparición escrita a mano es
         alguien saltándose la puerta del tono para encender el rojo donde el
         registro no lo declara. Por eso lo que se exige es CERO, y la cuenta
         se dice tal cual: la primera redacción decía «0 usos, todos por la
         puerta del tono», que presentaba un cero como si fuera un recuento de
         usos correctos. */
      const rojoSuelto = (j70t.match(/'sp-g-adv'|"sp-g-adv"|--sp-tono-adv\)/g) || []).length;
      comprobar('y el código falla al NEUTRO y nunca al rojo',
        porDefectoNeutro && /function claseDeTono/.test(j70t) && rojoSuelto === 0,
        !cuerpoClase || !cuerpoTinta ? 'NO PUDO CORRER: no se encontró claseDeTono o tintaDeTono'
          : !porDefectoNeutro
            ? 'el tono desconocido NO cae en neutro: un tono mal escrito encendería un color que el registro no declara'
            : rojoSuelto
              ? rojoSuelto + ' sitio(s) escriben el rojo a mano, saltándose la puerta del tono'
              : 'un tono que no esté en la tabla cae en neutro, y NINGÚN sitio escribe el rojo a mano: ' +
                'solo sale de `claseDeTono`, que lo da cuando el registro declara adverso');

      /* ── v1146 · NINGÚN ADVERSO SOBRE UN PERIODO QUE CRUZA LA POSESIÓN ──
         Decisión de Daniel, 22 de octubre de 2026. El acumulado de delitos
         iba de enero a agosto y el cálculo lo daba ADVERSO porque la cifra
         sube — pero de esos ocho meses a este Gobierno le corresponden unos
         seis días. Pintarlo rojo le atribuía lo ocurrido bajo el anterior,
         que es lo mismo que este módulo prohíbe en prosa y estaba haciendo
         con el color.

         LA REGLA, dicha para que una cuente: si una cifra declara un periodo
         que EMPIEZA antes de la posesión, su tono no puede ser adverso. Y el
         dato no se retira: lo que se quita es el color, no el hecho. */
      {
        const pos = String(regT.posesion || '');
        const conPeriodo = [];
        const caminaP = (o, ruta) => {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) { o.forEach((x, i) => caminaP(x, ruta + '[' + i + ']')); return; }
          if (o.periodoDesde) conPeriodo.push({ ruta, desde: String(o.periodoDesde), tono: o.tono || '(calculado)' });
          Object.keys(o).forEach((k) => caminaP(o[k], ruta + '.' + k));
        };
        caminaP(regT, '');
        const cruzan = conPeriodo.filter((x) => pos && x.desde < pos);
        const malos2 = cruzan.filter((x) => x.tono === 'adverso');

        comprobar('MATERIAL · hay cifras cuyo periodo empieza antes de la posesión',
          cruzan.length >= 1,
          cruzan.length ? cruzan.length + ' cifra(s) de periodo cruzan el ' + pos + ': ' +
            cruzan.map((x) => x.ruta).join(' · ')
          : 'ninguna cifra declara un periodo anterior a la posesión: la comprobación no tiene qué mirar');

        comprobar('y ninguna de ellas se pinta ADVERSA: el color no atribuye lo del gobierno anterior',
          cruzan.length >= 1 && malos2.length === 0,
          !cruzan.length ? 'NO PUDO CORRER: no hay cifras de periodo que crucen la posesión'
            : malos2.length
              ? malos2.length + ' va(n) en rojo sobre un periodo que empieza antes de la posesión: ' +
                malos2.map((x) => x.ruta + ' desde ' + x.desde).join(' · ')
              : cruzan.length + ' cifra(s) cruzan la posesión y ninguna va en rojo. La regla está ' +
                'escrita en `delitosAltoImpacto._notaPeriodo`');

        /* Y LA SALVEDAD SE IMPRIME. Sin esto el gris no se explica: un lector
           no sabría por qué esa barra no tiene color, y el +1,9 % se leería
           como una variación de este Gobierno. */
        comprobar('y la salvedad de periodo se imprime en la línea visible',
          /el acumulado es casi todo del gobierno anterior/.test(j70t) &&
          /periodoDesde/.test(j70t),
          !/periodoDesde/.test(j70t)
            ? 'el código no lee `periodoDesde`: la salvedad no podría salir del dato'
            : !/el acumulado es casi todo del gobierno anterior/.test(j70t)
              ? 'el gris quedaría sin explicar: nadie sabría por qué esa barra no tiene color'
              : 'la línea visible dice que el acumulado es casi todo del gobierno anterior');
      }

      /* LO QUE DECLARA TONO, LO DECLARA DE LA TABLA. Un `tono: "adversa"` mal
         escrito caería en neutro sin decirlo, y eso se lee igual que una
         decisión. */
      const VALIDOS = ['favorable', 'adverso', 'neutro'];
      const tonos = [];
      const camina = (o, ruta) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach((x, i) => camina(x, ruta + '[' + i + ']')); return; }
        Object.keys(o).forEach((k) => {
          if (k === 'tono' || k === 'tonoDelFaltante') tonos.push([ruta + '.' + k, o[k]]);
          else if (k === 'tonoPorEstado' && o[k] && typeof o[k] === 'object') {
            Object.keys(o[k]).forEach((e) => tonos.push([ruta + '.tonoPorEstado.' + e, o[k][e]]));
          } else camina(o[k], ruta + '.' + k);
        });
      };
      camina(regT, '');
      const malos = tonos.filter((x) => VALIDOS.indexOf(x[1]) < 0);
      comprobar('y todo tono declarado es uno de los tres de la tabla',
        tonos.length >= 10 && malos.length === 0,
        tonos.length < 10 ? 'solo ' + tonos.length + ' tonos declarados: la comprobación casi no mira nada'
          : malos.length ? malos.length + ' fuera de la tabla: ' +
              malos.map((x) => x[0] + ' = «' + x[1] + '»').join(' · ')
          : tonos.length + ' tonos declarados —' +
            [...new Set(tonos.map((x) => x[1]))].sort().join(' · ') + '—, todos de la tabla. ' +
            'NO aparece ninguno «favorable» y es correcto: el favorable no se declara, se CALCULA ' +
            'del movimiento real de cada fila de delitos, así que el registro solo escribe lo que ' +
            'el cálculo no puede dar');
    }

    /* ── v1144 · EL NOMBRE DEL HTML ATADO AL REGISTRO ─────────────────
       El `<title>`, `og:title` y `twitter:title` llevan el nombre ESCRITO en
       el HTML, y es la única excepción a «sale del registro». La razón es de
       mecánica: WhatsApp, Telegram, Slack y X no ejecutan JavaScript —traen
       el HTML suelto—, así que un og:title pintado por js/70 saldría vacío
       en la tarjeta, que es justo donde más se comparte el módulo.

       Son dos codificaciones de un hecho (clase B) y se separan el día que
       cambie el gobierno: el h1 diría un nombre y la tarjeta de WhatsApp
       otro, sin que nada falle. Como no se pueden DERIVAR —derivarlas es
       precisamente lo que el rastreador no puede hacer—, se ATAN (v879). */
    {
      const html70 = leer('seguimiento.html');
      const regTit = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
      const nomReg = String(regTit.presidente || '');
      const campos = [
        ['el <title>', (html70.match(/<title>([^<]*)<\/title>/) || [])[1] || ''],
        ['og:title', (html70.match(/property="og:title" content="([^"]*)"/) || [])[1] || ''],
        ['twitter:title', (html70.match(/name="twitter:title" content="([^"]*)"/) || [])[1] || '']
      ];
      const sinNombre = campos.filter((c) => !nomReg || c[1].indexOf(nomReg) < 0);

      comprobar('MATERIAL · el registro declara de quién es el seguimiento',
        nomReg.length > 3,
        nomReg ? 'el registro nombra a «' + nomReg + '»'
               : 'el registro no trae `presidente`: no hay nombre que atar');

      comprobar('y las tres etiquetas estáticas del HTML llevan EL MISMO nombre que el registro',
        nomReg.length > 3 && sinNombre.length === 0,
        !nomReg ? 'NO PUDO CORRER: el registro no trae `presidente`'
          : sinNombre.length
            ? sinNombre.length + ' no lo llevan: ' + sinNombre.map((c) => c[0]).join(' · ') +
              ' — la tarjeta de WhatsApp diría un nombre y el h1 otro'
            : 'las tres citan a «' + nomReg + '», igual que el registro');

      /* Y el CARGO y el PERÍODO viven en el registro y NO en el HTML: si
         alguien los teclea en la plantilla, vuelven a ser un hecho que
         envejece sin que nadie lo note (v903). */
      const cargoReg = String(regTit.cargo || '');
      comprobar('y el cargo sale del registro, no del HTML',
        cargoReg.length > 3 && html70.indexOf(cargoReg) < 0,
        !cargoReg ? 'el registro no trae `cargo`: el subtítulo no tendría de dónde salir'
          : html70.indexOf(cargoReg) >= 0
            ? 'el cargo está TECLEADO en seguimiento.html: dos copias de un hecho que cambia con el gobierno'
            : '«' + cargoReg + '» vive solo en el registro, y js/70 lo pinta');
    }

    /* ── v1143b · LA LÍNEA VISIBLE DE SALVEDAD ────────────────────────
       La tarjeta pliega la descripción larga, la nota, la caja, la tabla y
       las fuentes, y deja visible UNA línea. Plegar está bien —`details` es
       nativo, alcanzable por teclado y por lector de pantalla, y nada se
       borra— MIENTRAS la salvedad que cambia la lectura del gráfico se
       quede arriba. Si se pliega también, el lector se lleva una conclusión
       que el propio registro no sostiene y hay que desplegar algo para no
       equivocarse, que es ponerle precio a no equivocarse.

       Se vigilan las CUATRO que el lector nombró, cada una por el CAMPO del
       que sale y no por su frase —una frase se reescribe y la guarda se
       queda verde sobre nada (v935)—: el carácter del dato, la fila en
       disputa, los días del mes que son del gobierno anterior y la medida de
       la deuda. */
    const cuerpoTj = (j70c1.match(/function tarjetaGrafica\([^)]*\) \{[\s\S]*?\n  \}/) || [''])[0];
    const AVISOS = [
      ['el carácter del dato (preliminar)', /b\.caracter/, 'avisosDeDelitos'],
      ['la fila en disputa entre fuentes oficiales', /f\.disputa/, 'avisosDeDelitos'],
      ['los días del mes que son del gobierno anterior', /\.posesion/, 'avisosDeDelitos'],
      ['la medida de la deuda contra un ancla de otra medida', /b\.noComparableCon/, 'avisosDeDeudaBruta']
    ];
    /* El cuerpo se recorta por ÍNDICE y no con una expresión armada por
       concatenación: la primera versión escapaba mal los paréntesis y daba
       cuatro de cuatro «no lee su campo» sobre código que sí los lee — un
       rojo sobre código correcto, que es lo que enseña a ignorar la salida
       (v895). Lo delató saber que las cuatro estaban escritas. */
    const cuerpoDe = (n) => {
      const i = j70c1.indexOf('function ' + n + '(');
      if (i < 0) return '';
      const j = j70c1.indexOf('\n  }', i);
      return j < 0 ? '' : j70c1.slice(i, j);
    };
    const sinSalida = AVISOS.filter((x) => !x[1].test(cuerpoDe(x[2])));

    comprobar('MATERIAL · hay salvedades que cambian la lectura de un gráfico',
      AVISOS.length >= 4,
      AVISOS.length + ' vigiladas, cada una por el campo del registro del que sale');

    comprobar('las cuatro salvedades que cambian la lectura salen de su CAMPO, no de una frase',
      sinSalida.length === 0,
      sinSalida.length
        ? sinSalida.length + ' ya no lee su campo: ' + sinSalida.map((x) => x[0]).join(' · ')
        : 'las cuatro se calculan del registro, así que se caen solas el día que el campo cambie');

    /* Y QUE LLEGUEN A LA PANTALLA, que es la guarda de la guarda (v878):
       sin esto, los cuatro constructores pueden estar perfectos y la tarjeta
       no pintar la línea, que es exactamente la clase C. */
    comprobar('y la línea VISIBLE se pinta fuera del pliegue, con su regla en la hoja',
      cuerpoTj.length > 0 &&
      /datos\.avisos/.test(cuerpoTj) && /'sp-graf-sal'/.test(cuerpoTj) &&
      cuerpoTj.indexOf("'sp-graf-sal'") < cuerpoTj.indexOf("el('details', 'sp-graf-mas')") &&
      /\.sp-graf-sal\{/.test(c70niv),
      !cuerpoTj.length ? 'NO PUDO CORRER: no se encontró tarjetaGrafica'
        : !/datos\.avisos/.test(cuerpoTj) ? 'la tarjeta no lee los avisos: la línea no se pintaría nunca'
        : !/'sp-graf-sal'/.test(cuerpoTj) ? 'los avisos se leen y no se pintan'
        : cuerpoTj.indexOf("'sp-graf-sal'") > cuerpoTj.indexOf("el('details', 'sp-graf-mas')")
          ? 'la línea se pinta DENTRO del pliegue: habría que desplegar para enterarse de la salvedad'
          : !/\.sp-graf-sal\{/.test(c70niv) ? 'la línea se pinta y ninguna regla la pinta (v895)'
          : 'se pinta antes del pliegue y la hoja tiene su regla');

    /* Y QUE NADA SE HAYA BORRADO AL PLEGAR. «Se plegó» y «se borró» se leen
       igual desde la portada, y la diferencia es todo: lo plegado sigue en
       el DOM y sale al tabular. Se comprueba que las cinco piezas sigan
       colgando de la tarjeta, y que el dibujo conserve su `aria-label` —que
       es lo que hace que quien no ve el gráfico reciba la descripción SIN
       abrir nada—. */
    const PIEZAS = [
      ['la descripción larga', /mas\.appendChild\(el\('p', 'sp-graf-desc', dsc\)\)/],
      ['la nota', /mas\.appendChild\(el\('p', 'sp-graf-nota', nota\)\)/],
      ['la caja de declaraciones', /mas\.appendChild\(declara\)/],
      ['la tabla accesible', /mas\.appendChild\(tb\)/],
      ['las fuentes con sus enlaces', /mas\.appendChild\(f\)/]
    ];
    const perdidas = PIEZAS.filter((x) => !x[1].test(cuerpoTj));
    comprobar('y al plegar no se borró nada: las cinco piezas siguen colgando, y el dibujo conserva su aria-label',
      cuerpoTj.length > 0 && perdidas.length === 0 &&
      /setAttribute\('aria-label', dsc\)/.test(cuerpoTj) &&
      /el\('details', 'sp-graf-mas'\)/.test(cuerpoTj),
      !cuerpoTj.length ? 'NO PUDO CORRER: no se encontró tarjetaGrafica'
        : perdidas.length ? perdidas.length + ' dejaron de colgar de la tarjeta: ' +
            perdidas.map((x) => x[0]).join(' · ') + ' — plegar es esconder solo si además se borra'
        : !/setAttribute\('aria-label', dsc\)/.test(cuerpoTj)
          ? 'el dibujo perdió su aria-label: quien no lo ve tendría que desplegar para saber qué dice'
          : !/el\('details', 'sp-graf-mas'\)/.test(cuerpoTj)
            ? 'el pliegue no es un `details`: un acordeón de divs no sale al tabular'
            : 'las cinco cuelgan del `details` nativo y el dibujo mantiene su descripción en el aria-label');

    comprobar('y el recuento dice CUÁNTOS son, del contador y con las dos redacciones',
      cuerpoRc.length > 0 && /if \(!n\) return null;/.test(cuerpoRc) && /\bcn\(n,/.test(cuerpoRc) &&
      /\.sp-graf-falta-t\{/.test(c70niv) && /recuentoSinDato\(nSinDato\)/.test(cuerpoBg),
      !cuerpoRc.length ? 'no se encontró recuentoSinDato: la comprobación no vale'
        : !/recuentoSinDato\(nSinDato\)/.test(cuerpoBg)
          ? 'el recuento no se pone: los sellos saldrían sin que nada diga cuántos son'
          : !/\bcn\(n,/.test(cuerpoRc)
            ? 'el recuento no ramifica su cifra: con uno imprimiría «1 gráficos»'
            : 'sale de `cn(n, …)` sobre el contador, y con cero no se pinta');
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

    /* ═══ LA CIFRA DE UN INDICADOR DECLARA SU UNIDAD (v1097) ═══════════════
       La cuenta suma ENTRADAS del registro, no actos. Mientras cada entrada
       fue un acto las dos cosas coincidieron; en el registro actual no
       coinciden: una entrada es «el Gobierno firma 11 decretos de
       reconstrucción» y otra «un paquete adicional de 15 decretos». Así que
       «I-04 · 5 · 7,8 por 100 días» se leía como cinco actos excepcionales y
       son cinco entradas que agrupan veintinueve decretos.

       El discriminante estaba EN EL TÍTULO de la propia entrada —clase A de
       CLAUDE.md— y la cifra sale mecánicamente bien, que es lo que la hace
       cara. Y la regla que se rompía es la de la v1093: una cifra lleva su
       MEDIDA, o el lector le pone la que espera.

       Lo que esta guarda NO exige, y va dicho (v945, v952): no exige que
       todas las entradas DECLAREN su unidad. Si lo exigiera, `sinUnidad`
       sería cero por construcción y la rama del PISO quedaría muerta — y una
       rama que solo se alcanza cuando el módulo empeora es la gemela de la
       que la v1089 tuvo que retirar. Una entrada sin declarar se cuenta como
       UNA, que es el mínimo, se dice en pantalla y la suma se publica como
       piso. Así la rutina diaria —que es otra sesión y no conoce el campo—
       puede seguir escribiendo entradas sin romper nada. */
    const j70u = leer('js/70-seguimiento.js');
    let conUnidad = 0, agrupanDatos = 0, actosDatos = 0, malUnidad = [];
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      ((JSON.parse(leer(ruta)).entradas) || []).forEach((e) => {
        if (!((e.indicadores || []).length)) return;
        const v = e.actosQueAgrupa;
        if (v === undefined) return;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 1 || Math.floor(n) !== n) {
          malUnidad.push(quien + '/' + (e.id || e.fecha) + ' declara `actosQueAgrupa` = ' + v); return;
        }
        conUnidad++; actosDatos += n;
        if (n > 1) agrupanDatos++;
      });
    });
    /* DOS COMPROBACIONES Y NO UNA, y la razón se midió en esta misma tanda
       (v970, v1097). La primera versión pedía `agrupanDatos > 0` en ROJO, y
       una inyección que quitaba la unidad a las dos entradas del registro
       actual la dejó en verde porque la del anterior seguía agrupando. Al
       hacerla fiel —quitársela a las tres— se vio que el rojo estaba mal
       puesto por otro motivo: que NINGUNA entrada agrupe es una mejora
       legítima del registro —alguien parte el paquete de 15 decretos en 15
       entradas— y un rojo ahí pondría la salida barata en dejar los paquetes
       juntos para que la guarda siga teniendo algo que rechazar.

       Lo que sobrevive al cero va en ROJO: que ninguna unidad esté escrita
       con un valor imposible, y que el recuento se calcule. Lo que lo pone
       los DATOS va con su `?`. */
    comprobar('ninguna unidad declarada es un valor imposible',
      !malUnidad.length,
      malUnidad.length ? malUnidad.join(' · ')
        : 'las ' + conUnidad + ' que la declaran traen un entero de uno o más · ' +
          actosDatos + ' actos en total');
    if (!agrupanDatos) {
      anotarSinMaterial('MATERIAL · alguna entrada agrupa más de un acto',
        'ninguna de las ' + conUnidad + ' que declaran su unidad agrupa más de uno. No es un fallo: ' +
        'es lo que pasa si alguien parte los paquetes de decretos en una entrada por acto, y entonces ' +
        'entradas y actos coinciden. Las tres redacciones se comprueban arriba');
    } else {
      comprobar('MATERIAL · alguna entrada agrupa más de un acto',
        conUnidad > 0,
        conUnidad + ' declaran su unidad · ' + agrupanDatos + ' agrupan más de un acto · ' +
        actosDatos + ' actos en total');
    }

    /* El recuento se CALCULA y sobre las que CUENTAN y ninguna más: va dentro
       de la rama de `g.cuenta`, así que una entrada declarada que el criterio
       rechaza no suma actos. Sin esto la cifra de actos sería de otra
       población que la de entradas y las dos se publicarían juntas. */
    const trozoCnt = (j70u.split('if (g.cuenta) {')[1] || '').split('else fuera[k]')[0];
    const dentro = [
      ['la suma de actos', /actosDe\[k\] \+= u\.n;/.test(trozoCnt)],
      ['cuántas agrupan', /if \(u\.agrupa\) agrupan\[k\]\+\+;/.test(trozoCnt)],
      ['cuántas no declaran', /if \(!u\.declarada\) sinUnidad\[k\]\+\+;/.test(trozoCnt)]
    ];
    const fueraCnt = dentro.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('las tres cuentas de la unidad se calculan sobre las entradas que CUENTAN y ninguna más',
      !!trozoCnt && !fueraCnt.length,
      !trozoCnt ? 'no se encontró la rama de `g.cuenta` en indicadoresDe'
        : fueraCnt.length ? 'quedó fuera de la rama que cuenta: ' + fueraCnt.join(' · ') +
                            ' — mediría una población distinta de la de la cifra'
        : 'las tres dentro de `if (g.cuenta)`, así que una declarada que el criterio rechaza no suma actos');

    /* LAS TRES REDACCIONES, escritas (v970, v1091). La de cero y la de N se
       ven hoy las dos en la misma página —I-07 y I-14 en cero, I-04 con
       cinco—; la del PISO no se ejercita con el registro de hoy porque las
       diecinueve declarantes declaran su unidad, y por eso se comprueba que
       esté ESCRITA y se mide aparte contra un caso fabricado. */
    const trozoTxt = (j70u.split('function textoDeUnidad(')[1] || '').split('\n  }\n')[0];
    const tres = [
      ['la de cero', /La cuenta está en cero/.test(trozoTxt)],
      ['la de N', /y no actos: una entrada puede agrupar varios/.test(trozoTxt)],
      ['la del piso', /es un PISO y no un/.test(trozoTxt) && /!f\.unidadExacta/.test(trozoTxt)]
    ];
    const faltanTxt = tres.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('la unidad tiene sus TRES redacciones: cero, N, y el piso cuando alguna no declara',
      !!trozoTxt && !faltanTxt.length,
      !trozoTxt ? 'no se encontró `textoDeUnidad`'
        : faltanTxt.length ? 'falta la redacción: ' + faltanTxt.join(' · ') +
                             ' — ese caso saldría sin decir en qué se mide la cifra'
        : 'las tres escritas, y el texto se arma en una sola función');

    /* LA GUARDA DE LA GUARDA: que la unidad LLEGUE a la pantalla. Sin esto
       todo lo de arriba sería documentación y la cifra seguiría publicándose
       sin su medida, que es el patrón de la v878 y la clase C de CLAUDE.md. */
    const llega = /lc\.appendChild\(el\('p', 'sp-c2-unidad', fi\.unidad\)\)/.test(j70u);
    const pegada = /' entrada en total' : ' entradas en total'/.test(j70u);
    const conRegla = /\.sp-c2-unidad\{/.test(leer('css/70-seguimiento.css'));
    comprobar('y la unidad llega a la pantalla: pegada al número y explicada debajo del criterio',
      llega && pegada && conRegla,
      !llega ? 'la ficha ya no pinta `fi.unidad`: la cifra vuelve a publicarse sin su medida'
        : !pegada ? 'el número crudo volvió a decir «N en total» sin la palabra que dice de qué son'
        : !conRegla ? 'falta la regla de `.sp-c2-unidad` en el CSS: el párrafo sale sin acotar'
        : 'el crudo dice «N entradas» y el párrafo explica la unidad y el piso');

    /* Y LA TERCERA RAZÓN DE `comparabilidad`, aparte de las dos de FORMA.
       Las dos viejas son del registro —uno es bitácora diaria y el otro una
       selección— y se arreglarían con otro registro. Esta es de la UNIDAD y
       sobreviviría a eso, así que pide otra acción y se cuenta aparte
       (v899). */
    const trozoCmp = (j70u.split('function comparabilidad(')[1] || '').split('\n  }\n')[0];
    const razTres = [
      ['registro-no-exhaustivo', /'registro-no-exhaustivo'/.test(trozoCmp)],
      ['muestra-insuficiente', /'muestra-insuficiente'/.test(trozoCmp)],
      ['unidad-no-igualada', /'unidad-no-igualada'/.test(trozoCmp) && /f\.agrupan > 0/.test(trozoCmp)]
    ];
    const faltanRaz = razTres.filter((x) => !x[1]).map((x) => x[0]);
    /* La frase se busca DENTRO de un solo literal y no a caballo de dos: la
       primera versión de esta guarda buscó «las cuentas de los indicadores
       miden ENTRADAS y no actos» y salió roja teniendo el texto delante,
       porque en el código la frase está cortada por el `' +` de la
       concatenación. Es el barrido propio contra el código real (v1000,
       v1053), y la cura es medir por contenido que de verdad existe (v935). */
    const loDice = /miden ENTRADAS y no actos/.test(trozoCmp) &&
                   /igualar la unidad es condición para comparar/.test(trozoCmp);
    comprobar('la no-comparabilidad separa la razón de la UNIDAD de las dos de la forma del registro',
      !!trozoCmp && !faltanRaz.length && loDice,
      !trozoCmp ? 'no se encontró `comparabilidad`'
        : faltanRaz.length ? 'falta la razón: ' + faltanRaz.join(' · ')
        : !loDice ? 'la razón está en la lista y el TEXTO no la dice, así que el lector no se entera'
        : 'tres razones, y la de la unidad dicha en el texto que la pantalla publica');

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
    /* La lista del eje B dejó de ser una constante en la v1124: I-06 entra
       solo cuando pasa su umbral de cobertura, así que la base se lee de
       `IND_EJE_B_BASE` y lo que se vigila es que I-13 no esté en ninguna de
       las dos formas. */
    const ejeBLista = (j70i13.match(/var IND_EJE_B_BASE = \[([^\]]*)\]/) || ['', ''])[1];
    const ejeBArma = (j70i13.match(/function indEjeB\(c1\) \{[\s\S]*?\n  \}/) || [''])[0];
    comprobar('I-13 se publica como indicador propio',
      /'I-13': \{/.test(j70i13) && /'I-13': \{ t: 'Interferencia/.test(j70i13) &&
      /ORDEN_IND = \[[^\]]*'I-13'/.test(j70i13),
      'con su criterio, su fila y su puesto en el orden');

    comprobar('y NO entra al eje B, que no tiene media histórica suya',
      ejeBLista.length > 0 && ejeBLista.indexOf('I-13') < 0 &&
      !!ejeBArma && ejeBArma.indexOf('I-13') < 0,
      !ejeBLista ? 'no se encontró IND_EJE_B_BASE'
        : !ejeBArma ? 'no se encontró indEjeB(c1), que es quien arma la lista'
        : ejeBLista.indexOf('I-13') >= 0 ? 'I-13 está en la base del eje B'
        : ejeBArma.indexOf('I-13') >= 0 ? 'I-13 se le agrega a la lista al armarla'
        : 'el eje B mide I-04, I-05 e I-07 contra su media, y I-06 solo si pasa su umbral; ' +
          'I-13 no tiene media y no entra por ninguna de las dos vías');

    /* La guarda de la guarda: si el eje dejara de leer esa lista, la de arriba
       seguiría en verde sobre una constante que no decide nada. */
    comprobar('y el eje B sigue leyendo esa lista para armar sus filas',
      /var listaB = indEjeB\(/.test(j70i13) && /listaB\.indexOf\(f\.id\) >= 0/.test(j70i13),
      'ejeB filtra sus indicadores por la lista que `indEjeB` arma, no por una constante');

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


  /* ═══ CADA PENDIENTE PROPIO, SOBRE SU PROPIO DENOMINADOR (v1064) ════════
     El bloque «Lo que nos falta a nosotros» publicaba «Entradas sin nivel de
     gobierno declarado · 75 de 218». De esas 75 ni una era un acto: 50 son
     contexto estructural y 25 resultados, y a una cifra del país no se le
     puede declarar de qué nivel es «la decisión» porque no es una decisión.
     Medido sobre los actos —el denominador honesto que la v999 ya había
     escrito dos mil líneas antes, en la puerta del indicador— el pendiente
     era CERO: hecho, y publicado como falta durante sesenta y cinco
     versiones.

     Es la cuarta vez. v999 con `nivelGobierno`, v1060 con la identidad,
     v1061 con el indicador, y esta. La regla está en CLAUDE.md: todo
     recuento de lo que FALTA declarar corre sobre las entradas a las que ese
     campo se les puede exigir, y ninguna más. Un pendiente que nadie puede
     bajar nunca es el trinquete que la v965 prohibió, dicho al revés: no
     crece solo, es que nace arriba y no baja.

     Y el de los criterios tenía el mismo defecto LATENTE: contaba «tiene
     criterio escrito» en vez de «su criterio no está validado». El día que
     uno valide contra un gobierno anterior el renglón seguiría diciendo
     cuatro, porque la cifra estaba escrita en el predicado y no calculada
     (v903) — teniendo `validacionDe` al lado, que ya la calcula.

     Las cuatro mitades, porque cada una falla por su lado:
       1 · las cinco comprobaciones existen y cada una trae su DENOMINADOR;
       2 · la del nivel se mide sobre los actos y no sobre las entradas;
       3 · la de los criterios lee el estado CALCULADO;
       4 · y las dos redacciones (v970) LLEGAN a la pantalla: sin la de cero
           un renglón que desaparece deja «ya está hecho» con la misma cara
           que «nadie lo ha mirado». */
  {
    const j70q = soloCodigo(leer('js/70-seguimiento.js'));
    const iQ = j70q.indexOf('function comprobacionesPropias(dd) {');
    const trozoQ = iQ < 0 ? '' : j70q.slice(iQ, j70q.indexOf('\n  function pendientesPropios(', iQ));
    const claves = [...trozoQ.matchAll(/\{ k: '([a-zA-Z]+)', n: /g)].map((m) => m[1]);

    comprobar('MATERIAL · las comprobaciones propias son una lista de objetos con su clave',
      claves.length >= 5 && trozoQ.length > 400,
      claves.length ? claves.join(' · ') : 'no se encontró comprobacionesPropias');

    /* El denominador es obligatorio en TODAS, no solo en la que falló: se
       persigue la clase y no el caso (v874, v885). Una comprobación sin `de`
       no se puede leer como fracción, y es por donde volvería a entrar un
       recuento sobre el conjunto equivocado. */
    /* Cada comprobación se trocea por SU PROPIO BORDE —el `{ k: '…'` de la
       siguiente— y no por un terminador de indentación: la primera versión de
       esta guarda buscaba `\n      }` y ninguna de las cinco cierra así, así
       que las cinco salieron «no encontradas» y las aserciones imprimieron el
       texto del verde estando en rojo. Es la clase de la v973 (v1051), y la
       cazó la corrida, no la lectura. */
    const piezas = trozoQ.split(/\n      \{ k: '/).slice(1)
      .map((t) => ({ k: (t.match(/^([a-zA-Z]+)'/) || [, ''])[1], t: t }));
    const conDe = piezas.map((x) => ({ k: x.k, ok: /, de: /.test(x.t.split('\n')[0]) }));
    const sinDe = conDe.filter((x) => !x.ok).map((x) => x.k);
    comprobar('las cinco traen su denominador escrito, no solo su numerador',
      conDe.length >= 5 && sinDe.length === 0,
      sinDe.length ? 'sin `de`: ' + sinDe.join(', ') : conDe.length + ' con numerador y denominador');

    /* LAS DOS REDACCIONES (v970). La de cero es justo la que hace falta el
       día que el material se arregle, y es la que faltaba acá. */
    const sinCero = piezas.filter((x) => !/\n\s+cero: /.test(x.t)).map((x) => x.k);
    comprobar('cada una lleva SUS DOS REDACCIONES: la de N y la de cero',
      conDe.length >= 5 && sinCero.length === 0,
      sinCero.length ? 'sin redacción de cero: ' + sinCero.join(', ')
                     : 'las ' + conDe.length + ' tienen `cero:` escrita');

    /* La del nivel, sobre los ACTOS. Se mide dentro del trozo y no sobre el
       archivo (v854): `tipoMedicion` aparece en veinte sitios más. */
    const pieza = (k) => (piezas.filter((x) => x.k === k)[0] || { t: '' }).t;
    const tramoNivel = pieza('nivel');
    /* EL DETALLE DICE QUÉ MITAD FALLÓ (v973, v1051). Las tres se miden
       aparte: sin eso, el rojo imprime el texto del verde y la tanda
       siguiente no sabe por dónde empezar. */
    const mitadesNivel = [
      ['`actos` se define por tipoMedicion',
       /var actos = ent\.filter\(function \(e\) \{ return e\.tipoMedicion === 'actividad'; \}\);/.test(trozoQ)],
      ['el numerador sale de `actos`',
       /n: actos\.filter\(function \(e\) \{ return !e\.nivelGobierno; \}\)\.length/.test(tramoNivel)],
      ['el denominador sale de `actos`', /de: actos\.length/.test(tramoNivel)]
    ];
    const malNivel = mitadesNivel.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('el pendiente de nivel de gobierno se cuenta sobre los ACTOS',
      !!tramoNivel && malNivel.length === 0,
      !tramoNivel ? 'no se encontró la comprobación de nivel en la lista'
                  : malNivel.length ? 'falla: ' + malNivel.join(' · ')
                                    : 'numerador y denominador salen de `actos`, no de `ent`');

    const razonNivel = /no se le puede declarar de qu[eé] nivel es la decisi[oó]n/.test(tramoNivel);
    const porqueNivel = /no es una decisi[oó]n/.test(tramoNivel);
    comprobar('y dice en pantalla POR QUÉ ese es el denominador y no las entradas',
      razonNivel && porqueNivel,
      razonNivel && porqueNivel
        ? 'la razón viaja con la cifra: quien la lee no tiene que buscarla en la bitácora'
        : 'falta' + (razonNivel ? '' : ' qué no se le puede exigir') +
          (porqueNivel ? '' : ' por qué no se le puede exigir'));

    /* La de los criterios, sobre el estado CALCULADO (v903). */
    const tramoCrit = pieza('criterios');
    const mitadesCrit = [
      ['se le pregunta a `validacionDe` con el registro anterior',
       /validacionDe\(k, d0 === D \? DA : null\)/.test(trozoQ)],
      ['y se filtra por `validado`', /return !v \|\| !v\.validado;/.test(trozoQ)],
      ['y la cifra sale de ese filtro', /n: sinVal\.length/.test(tramoCrit)]
    ];
    const malCrit = mitadesCrit.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('el pendiente de criterios lee la validación CALCULADA, no «tiene criterio»',
      !!tramoCrit && malCrit.length === 0,
      !tramoCrit ? 'no se encontró la comprobación de criterios en la lista'
                 : malCrit.length ? 'falla: ' + malCrit.join(' · ')
                                  : 'baja sola el día que un criterio se valide contra el gobierno anterior');

    /* UNA SOLA CODIFICACIÓN (clase B). `pendientesPropios` se DERIVA de la
       lista en vez de armar la suya: con dos listas, la que se quedaría
       vieja es la que nadie mira. */
    const tramoPend = (j70q.match(/function pendientesPropios\(dd\) \{[\s\S]*?\n  \}/) || [''])[0];
    const deriva = /comprobacionesPropias\(dd\)\.filter/.test(tramoPend);
    const propia = /out\.push/.test(tramoPend);
    comprobar('`pendientesPropios` se DERIVA de la lista, no arma la suya',
      !!tramoPend && deriva && !propia,
      !tramoPend ? 'no se encontró pendientesPropios'
                 : propia ? 'volvió a armar su propia lista con `out.push`: son dos codificaciones'
                 : !deriva ? 'ya no deriva de `comprobacionesPropias`'
                 : 'una sola codificación: las dos no pueden separarse');

    /* LA GUARDA DE LA GUARDA (v878): que la redacción de cero LLEGUE a la
       pantalla. Sin esto todo lo de arriba queda en verde sobre un campo que
       ningún lector alcanza, que es la clase C de CLAUDE.md. */
    const tramoBloque = (j70q.match(/function bloquePendientes\(dd\) \{[\s\S]*?\n    return s;/) || [''])[0];
    const mitadesOk = [
      ['bloquePendientes llama a comprobadasEnCero', /comprobadasEnCero\(dd\)/.test(tramoBloque)],
      ['y le pone su clase', /sp-pend-ok/.test(tramoBloque)],
      ['y la clase tiene regla en el css', /\.sp-pend-ok\{/.test(leer('css/70-seguimiento.css'))]
    ];
    const malOk = mitadesOk.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('y la redacción de cero LLEGA a la pantalla, con su regla que la pinta',
      !!tramoBloque && malOk.length === 0,
      !tramoBloque ? 'no se encontró bloquePendientes'
                   : malOk.length ? 'falla: ' + malOk.join(' · ')
                                  : 'bloquePendientes la pinta y `.sp-pend-ok` tiene regla');

    comprobar('las dos funciones se publican para que una prueba las pueda leer',
      /comprobacionesPropias: comprobacionesPropias/.test(j70q) &&
      /comprobadasEnCero: comprobadasEnCero/.test(j70q),
      'van en URBIS_SEG_FICHA, no se alcanzan por un lado (v871)');

    /* Y LA MEDICIÓN QUE MOTIVÓ TODO, impresa: de las entradas sin nivel
       declarado, cuántas son actos. Si alguna vez un acto entra sin nivel,
       el pendiente del panel lo dice solo —esta línea solo deja escrito el
       reparto, que es lo que hacía falta para ver que el 75 no era una
       falta. */
    const regQ = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const entQ = regQ.entradas || [];
    const porTipo = {};
    entQ.filter((e) => !e.nivelGobierno).forEach((e) => {
      const k = e.tipoMedicion || '(sin tipo)';
      porTipo[k] = (porTipo[k] || 0) + 1;
    });
    const actosQ = entQ.filter((e) => e.tipoMedicion === 'actividad');
    comprobar('el reparto de las entradas sin nivel va medido y no supuesto',
      entQ.length > 0 && actosQ.length > 0,
      'sin nivel declarado: ' + Object.keys(porTipo).map((k) => porTipo[k] + ' ' + k).join(' · ') +
      ' · de los ' + actosQ.length + ' actos, ' +
      actosQ.filter((e) => !e.nivelGobierno).length + ' sin declarar');
  }


  /* ═══ UN VACÍO SIN SU TRÁMITE ES UN MURO (v1065, v1076) ════════════════
     El eje C nombraba las dos reglas del pliego que le faltan y callaba cómo
     se consiguen. Por la regla de este proyecto (v849, v880) eso no es un
     vacío declarado sino un muro: quien lo lee no puede saber si es trabajo
     de una tarde, de un derecho de petición, o de esperar a que pase un año.

     La v1076 lo extendió a los ejes B y D y movió los tres a UN SOLO bloque
     del registro, `tramites`, con la clave del eje. Con uno en `presupuesto`,
     otro en `fuerza` y el del B sin casa, esta guarda necesitaría una tabla
     de dónde mirar — y esa tabla es exactamente lo que se queda viejo el día
     que alguien agregue un eje (v867: dos copias de una advertencia se
     separan).

     Y la lista de a quién se le exige NO se teclea: sale de `PESO_EJE`,
     filtrando los que miden la REALIDAD. Así un eje de realidad nuevo nace
     con el trámite exigido sin que su autor se acuerde, que es lo único que
     impide que esto vuelva a pasar.

     DE QUÉ NO RESPONDE, dicho y no disimulado (v945): al eje A no se le
     exige. Lo que le falta es un HECHO con fecha de revisión escrita —el 21
     de noviembre de 2026—, no un documento que alguien pueda ir a pedir, y
     pedirle una declaración de prueba faltante mandaría a declarar lo que no
     falta.

     EL CUARTO CAMPO CAMBIÓ EN LA v1122, y con él lo que esta guarda mide.
     Era `como` —cómo se consigue el documento—, y para el eje D eso era un
     derecho de petición con su término legal: una TAREA asignada a una
     entidad que no está en esta mesa. Ahora es `porQueLimita`: por qué su
     ausencia limita lo que el módulo puede publicar. Las dos mitades de esa
     regla se miden aparte, más abajo, en «ningún pendiente reparte deberes». */
  {
    const j70t = soloCodigo(leer('js/70-seguimiento.js'));
    const regT = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const tramites = regT.tramites || null;

    /* A QUIÉN SE LE EXIGE: derivado de PESO_EJE, no copiado. */
    const bloquePeso = (j70t.match(/var PESO_EJE = \{[\s\S]*?\n  \};/) || [''])[0];
    const deRealidad = [...bloquePeso.matchAll(/'?([A-Z])'?: \{ mide: 'realidad'/g)].map((m) => m[1]);

    comprobar('MATERIAL · los trámites viven en UN bloque del registro, con la clave del eje',
      !!tramites && Object.keys(tramites).filter((k) => k[0] !== '_').length >= 2 && deRealidad.length >= 2,
      !tramites ? 'no hay bloque `tramites` en el registro'
                : 'trámites: ' + Object.keys(tramites).filter((k) => k[0] !== '_').join(' · ') +
                  ' · ejes de realidad según PESO_EJE: ' + deRealidad.join(' '));

    /* FALLA CERRADO: todo eje que mide la realidad tiene el suyo. */
    const sinTramite = deRealidad.filter((e) => !((tramites || {})[e] || {}).reglas);
    comprobar('todo eje que mide la REALIDAD tiene su trámite, y la lista sale de PESO_EJE',
      deRealidad.length > 0 && sinTramite.length === 0,
      !deRealidad.length ? 'no se pudo leer PESO_EJE: la lista de a quién exigirle quedaría vacía'
        : sinTramite.length ? 'sin trámite: eje ' + sinTramite.join(', eje ')
        : 'los ' + deRealidad.length + ' ejes de realidad (' + deRealidad.join(' ') + ') lo traen');

    /* Los cuatro campos, en TODAS las reglas de TODOS los ejes, y el detalle
       dice en cuál regla de cuál eje falla (v973). */
    const CAMPOS = ['que', 'quien', 'porQueLimita', 'cuando'];
    const incompletas = [];
    let nReglas = 0;
    Object.keys(tramites || {}).filter((k) => k[0] !== '_').forEach((e) => {
      ((tramites[e] || {}).reglas || []).forEach((r) => {
        nReglas++;
        const fal = CAMPOS.filter((c) => !String((r || {})[c] || '').trim());
        if (fal.length) incompletas.push(e + '/' + (r.k || '?') + ' sin ' + fal.join(' ni '));
      });
    });
    comprobar('cada regla dice QUÉ falta, DÓNDE vive, POR QUÉ limita y CUÁNDO puede existir',
      nReglas > 0 && incompletas.length === 0,
      !nReglas ? 'no hay reglas que medir'
               : incompletas.length ? 'falla: ' + incompletas.join(' · ')
               : 'las ' + nReglas + ' reglas de los ' +
                 Object.keys(tramites).filter((k) => k[0] !== '_').length + ' ejes, con sus cuatro campos');

    /* El intento: cuando está, va FECHADO. Y cuando NO está, la pantalla
       tiene que decirlo igual — las dos redacciones (v970, v1076). */
    const conIntento = Object.keys(tramites || {}).filter((k) => k[0] !== '_')
      .map((e) => ({ e: e, u: (tramites[e] || {}).ultimoIntento }))
      .filter((x) => x.u);
    const malIntento = conIntento.filter((x) =>
      !(/^\d{4}-\d{2}-\d{2}$/.test(x.u.fecha || '') && x.u.canal && (x.u.resultado || '').length > 80));
    comprobar('todo intento registrado va FECHADO, con su canal y su resultado',
      malIntento.length === 0,
      malIntento.length ? 'intento sin fecha, canal o resultado: eje ' + malIntento.map((x) => x.e).join(', ')
        : conIntento.length ? conIntento.map((x) => 'eje ' + x.e + ' el ' + x.u.fecha).join(' · ')
        : 'ninguno de los ejes registra un intento todavía');

    const dosRedacciones = /Nadie lo ha intentado todav[ií]a desde este registro/.test(j70t) &&
                           /'[ÚU]ltimo intento: ' \+ fechaCorta\(u\.fecha\)/.test(j70t);
    comprobar('y la pantalla escribe LAS DOS: la del intento y la de que nadie lo ha intentado',
      dosRedacciones,
      dosRedacciones ? 'sin intento, el renglón se escribe igual: no desaparece'
        : 'falta una de las dos: un renglón que desaparece deja «nadie lo buscó» con la cara de «no hay nada que decir»');

    /* El código lo LEE por la clave del eje y no lo teclea. */
    const tramoT = (j70t.match(/function tramiteDe\(dd, eje\) \{[\s\S]*?\n  \}/) || [''])[0];
    const leePorEje = /\(\(\(dd \|\| \{\}\)\.tramites\) \|\| \{\}\)\[eje\]/.test(tramoT);
    const descartaAMedias = /r\.que && r\.quien && r\.porQueLimita && r\.cuando/.test(tramoT);
    comprobar('el eje LEE del registro por su clave lo que le falta, y descarta lo que venga a medias',
      !!tramoT && leePorEje && descartaAMedias,
      !tramoT ? 'no se encontró tramiteDe(dd, eje)'
              : !leePorEje ? 'no lo lee de `tramites` por la clave del eje'
              : !descartaAMedias ? 'acepta una regla a medias: media declaración se lee peor que ninguna'
              : 'sale del registro por su clave, y una regla incompleta no se pinta');

    /* UNA SOLA CODIFICACIÓN (clase B): la copia vieja no se quedó. */
    comprobar('no queda la copia vieja dentro de `presupuesto`',
      !((regT.presupuesto || {}).tramite) && !/tramiteDe\(P\)/.test(j70t),
      (regT.presupuesto || {}).tramite ? 'sigue `presupuesto.tramite`: dos sitios para la misma convención'
                                       : 'un solo bloque, y el lector ya no mira dentro del dato del eje');

    /* Y LOS TRES EJES LO PIDEN de verdad: sin esta mitad, el bloque podría
       estar completo en el registro y ningún eje leerlo (clase C). */
    const piden = deRealidad.filter((e) => new RegExp("tramiteDe\\(dd \\|\\| D, '" + e + "'\\)").test(j70t));
    comprobar('y cada eje de realidad PIDE el suyo en su propio objeto',
      piden.length === deRealidad.length,
      piden.length === deRealidad.length
        ? 'los ' + piden.length + ' lo piden por su clave'
        : 'no lo piden: eje ' + deRealidad.filter((e) => piden.indexOf(e) < 0).join(', eje '));

    /* LA GUARDA DE LA GUARDA (v878): que llegue al papel. */
    const mitadesT = [
      ['el pintor de ejes lo pinta', /if \(ej\.tramite\) li\.appendChild\(bloqueTramite\(ej\.tramite\)\);/.test(j70t)],
      ['bloqueTramite imprime los cuatro campos',
       /D[oó]nde vive esa prueba: /.test(j70t) && /Por qu[eé] limita lo que se publica: /.test(j70t) &&
       /Cu[aá]ndo puede existir: /.test(j70t)],
      ['y la clase tiene regla en el css', /\.sp-c3-tram\{/.test(leer('css/70-seguimiento.css'))]
    ];
    const malT = mitadesT.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('y el trámite LLEGA a la pantalla, con su regla que lo pinta',
      malT.length === 0,
      malT.length ? 'falla: ' + malT.join(' · ') : 'se pinta bajo la caja de lo que falta, y tiene css');

    /* Se persigue la CLASE y no el caso: el pintor es de cualquier eje que
       traiga trámite, no del eje C. */
    const tramoPint = (j70t.match(/if \(!ej\.publicable\) \{[\s\S]*?\n      \}/) || [''])[0];
    const pintaAlgo = /if \(ej\.tramite\)/.test(tramoPint);
    const atadoAC = /ej\.eje === 'C'/.test(tramoPint);
    comprobar('el trámite se pinta por EJE y no solo para uno',
      !!tramoPint && pintaAlgo && !atadoAC,
      !tramoPint ? 'no se encontró el trozo que pinta la falta'
                 : !pintaAlgo ? 'ya no pinta ningún trámite: no hay qué atar a una clase'
                 : atadoAC ? 'atado al eje C: los otros siguen siendo un muro'
                 : 'cualquier eje que traiga trámite lo publica');


    /* ═══ NINGÚN PENDIENTE REPARTE DEBERES (v1122) ═════════════════════════
       La regla que la paga, dicha por el usuario: **las listas de pendientes
       de este proyecto registran ESTADOS, no TAREAS DE TERCEROS.** Un
       pendiente válido dice qué falta y por qué eso limita lo que el módulo
       puede publicar. Uno inválido le asigna un deber a alguien que no está
       en esta mesa — y entonces el módulo queda esperando un plazo legal que
       nadie de acá controla, con la lista creciendo sola.

       Lo que la pagó: el cuarto campo del bloque se llamaba `como` —«cómo se
       pide»—, y para el eje D decía «se pide por derecho de petición,
       gratuito, con término de quince días hábiles». Eso estaba IMPRESO en la
       ficha, bajo el encabezado «Cómo se consigue».

       LA SEÑAL, Y POR QUÉ LA GUARDA ES DE SUPERFICIE Y NO DE PALABRAS. El
       vocabulario del trámite —«derecho de petición», «radicar», «días
       hábiles»— aparece 30 veces en el registro, y 26 de esas son CONTENIDO:
       un representante radicó un derecho de petición ante MinDefensa, un
       decreto dura doce meses prorrogables. Son hechos registrados, no
       pendientes, y una guarda que los persiguiera sería la lista de
       excepciones que envejece hasta no significar nada (v895), como el
       cribado de menores de la v1116. Medido sobre las superficies de
       PENDIENTE y solo sobre ellas, los aciertos eran 2 de 4. **El
       discriminante es la SUPERFICIE, no la palabra.**

       Dos mitades que no se implican, y por eso van aparte (v899):
       la ESTRUCTURAL —ninguna regla puede traer un campo cuyo oficio sea
       decir cómo se consigue algo— y la de TEXTO sobre esas superficies.

       DE QUÉ NO RESPONDE (v945): de las entradas del registro, donde esas
       mismas palabras son el hecho que se documenta; y de que `porQueLimita`
       diga la verdad, que no lo puede comprobar nadie (v1008). Comprueba que
       el campo del deber no esté y que las superficies de pendiente no
       repartan uno.

       VA EN ROJO Y NO CON `?` (v970, v1097): mide ESQUEMA y CÓDIGO, no
       material del registro, así que no puede vaciarse por una mejora. */
    const ejesT = Object.keys(tramites || {}).filter((k) => k[0] !== '_');
    const conComo = [];
    ejesT.forEach((e) => {
      ((tramites[e] || {}).reglas || []).forEach((r) => {
        if (Object.prototype.hasOwnProperty.call(r || {}, 'como')) conComo.push(e + '/' + (r.k || '?'));
      });
    });
    comprobar('ninguna regla de pendiente trae el campo que dice CÓMO se consigue',
      ejesT.length > 0 && conComo.length === 0,
      !ejesT.length ? 'no hay reglas que medir: la guarda se quedó sin material'
        : conComo.length ? 'vuelve el campo `como`, que es una tarea de tercero: ' + conComo.join(' · ')
        : 'las ' + nReglas + ' reglas de los ' + ejesT.length + ' ejes declaran `porQueLimita` y ninguna `como`');

    /* LA MITAD DE TEXTO, sobre las superficies de PENDIENTE y ninguna más.
       La lista de superficies se DERIVA —los ejes salen de PESO_EJE, arriba—
       en vez de tecleárse eje por eje (v1091). */
    const DEBER = /derecho de petici[oó]n(?! vencido)|radicar (un|una|el|la) (derecho|solicitud|petici)|d[ií]as h[aá]biles|prorrogable con|Ley 1755|se pide por derecho|t[eé]rmino de (quince|diez|cinco|\d+)/i;
    const supT = [];
    ejesT.forEach((e) => {
      const b = tramites[e] || {};
      ((b.reglas || []).forEach((r) => {
        ['que', 'quien', 'porQueLimita', 'cuando'].forEach((c) => {
          supT.push(['registro · tramites.' + e + '/' + (r.k || '?') + '.' + c, String((r || {})[c] || '')]);
        });
      }));
      if (b._nota) supT.push(['registro · tramites.' + e + '._nota', String(b._nota)]);
      if (b.ultimoIntento) supT.push(['registro · tramites.' + e + '.ultimoIntento',
                                      String(b.ultimoIntento.resultado || '')]);
    });
    /* El control del módulo: sus casilleros llevan lo que los cerraría, y eso
       es la otra lista de pendientes que el módulo publica. Se acota a
       `controlDeCalidad` para no barrer los criterios, donde «derecho de
       petición vencido» es la VÍA de I-07 y es correcta. */
    const cuerpoCtrl = (j70t.match(/function controlDeCalidad\(dd, corte\) \{[\s\S]*?\n  \}\n/) || [''])[0];
    if (cuerpoCtrl) supT.push(['js/70 · controlDeCalidad', cuerpoCtrl]);
    const hayDec = fs.existsSync(R('DECISIONES-PENDIENTES.md'));
    if (hayDec) supT.push(['DECISIONES-PENDIENTES.md', leer('DECISIONES-PENDIENTES.md')]);

    const reparten = supT.filter((x) => DEBER.test(x[1])).map((x) => x[0]);
    comprobar('y ninguna superficie de pendiente le asigna un deber a un tercero',
      supT.length >= 10 && !!cuerpoCtrl && reparten.length === 0,
      !cuerpoCtrl ? 'no se encontró controlDeCalidad: la lista de casilleros quedaría sin barrer'
        : supT.length < 10 ? 'solo ' + supT.length + ' superficies: la guarda se quedó sin material'
        : reparten.length ? 'reparte un deber: ' + reparten.join(' · ')
        : supT.length + ' superficies de pendiente barridas —las ' + nReglas + ' reglas con sus cuatro ' +
          'campos, las notas, los intentos, los casilleros del control y DECISIONES-PENDIENTES.md— y ' +
          'ninguna pide un trámite. No cubre las entradas del registro, donde esas mismas palabras son ' +
          'el hecho documentado: medido, 26 de 30 apariciones son contenido y no pendiente');

    /* Y LA TERCERA MITAD: NINGÚN PENDIENTE ESPERA UNA REVISIÓN DE ABOGADO.
       Va aparte del deber de arriba porque pide otra ACCIÓN (v899). Un
       trámite espera la respuesta de una entidad y mientras tanto el módulo
       publica lo que tiene; una condición de asesoría legal dice que hay
       contenido escrito que NO se publica hasta que alguien de afuera lo
       apruebe — y eso no es un pendiente, es un veto puesto en una lista.
       La decisión del usuario, el 21 de octubre de 2026, es que ese
       contenido no espera: sale del módulo. Lo que queda en su lugar no
       cuesta nada y ya está en pie: el sitio afirma hecho, fecha, fuente y
       estado procesal; no le atribuye un delito a una persona identificada;
       y la guarda penal con su asimetría de exención siguen igual.

       MEDIDO ANTES DE ESCRIBIRLA: el vocabulario del abogado aparece 48
       veces fuera de esta guarda y las 48 son CONTENIDO —la firma
       privada del presidente, el abogado de Monsalve, la abogada designada a
       Colpensiones, el emoji de «servicios profesionales» de otro módulo—.
       Ninguna es un requisito de proceso, así que esta guarda nace sin nada
       que rechazar y su verde dice eso. Por la misma razón el barrido va
       sobre las superficies de PENDIENTE y ninguna más (v895, v1116): sobre
       el repositorio entero serían 48 excepciones y la lista que envejece.

       DE QUÉ NO RESPONDE (v945): de las entradas del registro ni del
       documento de divulgación, donde un abogado es el hecho que se
       documenta; y de que alguien escriba la condición con otras palabras.
       Comprueba que las superficies de pendiente no la declaren.

       VA EN ROJO Y NO CON `?` (v970): mide esquema y código sobre una lista
       de superficies derivada, no material del registro. */
    const ASESORIA = /abogad[oa]|asesor[ií]a (legal|jur[ií]dica)|asesor(ar|ía)se (legal|jur)|revisi[oó]n (legal|jur[ií]dica)|concepto jur[ií]dico|aval (legal|jur[ií]dico)|visto bueno (legal|jur[ií]dico)|apoderad[oa]/i;
    const conAsesoria = supT.filter((x) => ASESORIA.test(x[1])).map((x) => x[0]);
    comprobar('y ninguna condiciona lo que se publica a una revisión de abogado',
      supT.length >= 10 && !!cuerpoCtrl && conAsesoria.length === 0,
      !cuerpoCtrl ? 'no se encontró controlDeCalidad: la lista de casilleros quedaría sin barrer'
        : supT.length < 10 ? 'solo ' + supT.length + ' superficies: la guarda se quedó sin material'
        : conAsesoria.length ? 'condiciona la publicación a una asesoría legal: ' + conAsesoria.join(' · ') +
          ' — ese contenido no espera a un tercero, sale del módulo'
        : 'las mismas ' + supT.length + ' superficies, y ninguna condiciona lo publicado a un abogado. ' +
          'No cubre las entradas del registro ni la carpeta de divulgación, donde un abogado es el hecho ' +
          'documentado: medido, las 48 apariciones de fuera de esta guarda son contenido y ninguna es un ' +
          'requisito de proceso');
  }


  /* ═══ EL INDICADOR DEL EJE D, Y DE DÓNDE SALEN SUS BORDES (v1077) ═══════
     El eje D publicaba un CONTEO —un piso confirmado operación por
     operación— y un conteo no da nivel por mucho que crezca. Lo que faltaba
     era un criterio con incluye y excluye, y llevaba cinco versiones sin
     escribirse por una razón buena: un criterio redactado mirando los hechos
     que tiene que clasificar nace `construida-para-el-caso` y sin validar
     (v965), y entonces el nivel quedaría asignado y no calculado.

     I-14 se escribió contra DOS instrumentos anteriores a este proyecto —el
     Protocolo de Minnesota de la ONU y los Principios Básicos sobre el
     empleo de la fuerza (ONU, 1990)— y por eso declara
     `juridica-preexistente`. Esta guarda vigila justamente eso: que sus
     renglones no sean casos de este registro.

     Y vigila el resultado de su primera corrida, que es la prueba de que no
     se escribió a conveniencia: **2 entradas lo declaran y NINGUNA cuenta**,
     porque el criterio pide confirmación forense u oficial y lo que hay es
     el relato de los medios. Un criterio escrito para que algo pasara habría
     salido con la vara más floja. */
  {
    const j70n = soloCodigo(leer('js/70-seguimiento.js'));
    const regN = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));

    const tramo14 = (j70n.match(/'I-14': \{\n      definicion:[\s\S]*?\n    \}/) || [''])[0];
    const incluye14 = [...tramo14.matchAll(/^\s+'([^']{20,})',?$/gm)].map((m) => m[1]);

    comprobar('MATERIAL · I-14 existe, con su definición y sus renglones',
      !!tramo14 && incluye14.length >= 6,
      tramo14 ? incluye14.length + ' renglones entre incluye y excluye'
              : 'no se encontró el criterio I-14');

    /* La categoría es PREEXISTENTE y lo dice, que es lo que separa este
       criterio de uno tallado a la medida del caso. */
    const catPre = /'I-14': \{ t: '[^']+', dec: true,\n\s+origenCategoria: 'juridica-preexistente'/.test(j70n);
    comprobar('I-14 declara que su categoría existe sin este proyecto', catPre,
      catPre ? 'se escribió contra un estándar externo, no contra este registro'
             : 'ya no declara `juridica-preexistente`: si sus bordes salen de este registro, el nivel se asigna y no se calcula');

    /* Y la referencia externa va NOMBRADA en el código, no solo en la
       bitácora: sin el nombre, la próxima sesión no puede comprobar de dónde
       salieron los bordes (v926, la guarda lee el código). */
    const refs = ['Protocolo de Minnesota', 'Principios Básicos', 'Principios BÁSICOS'];
    const nombradas = refs.filter((r) => j70n.indexOf(r) >= 0);
    comprobar('y nombra en el CÓDIGO la referencia externa de la que salen sus bordes',
      nombradas.length >= 2,
      nombradas.length >= 2 ? 'cita ' + nombradas.slice(0, 2).join(' y ')
                            : 'no nombra la referencia: no hay cómo comprobar de dónde salieron los bordes');

    /* LA VARA NO SE AFLOJÓ PARA QUE ALGO PASARA (v882, v1075). Es la misma
       de I-04: acto ocurrido y evidencia dura. */
    const tramoReq = (tramo14.match(/requiere: function \(c\) \{[\s\S]*?\}/) || [''])[0];
    const mitadesReq = [
      ['exige un acto ocurrido', /c\.procesal\.id !== 'anunciado-sin-acto'/.test(tramoReq)],
      ['y evidencia dura', /EVIDENCIA_DURA\[c\.evidencia\.id\]/.test(tramoReq)]
    ];
    const malReq = mitadesReq.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('I-14 pide la misma vara dura que I-04: acto ocurrido y evidencia dura',
      !!tramoReq && malReq.length === 0,
      !tramoReq ? 'no se encontró el `requiere` de I-14'
        : malReq.length ? 'la vara se aflojó, ya no ' + malReq.join(' ni ')
        : 'una muerte a manos del Estado no se cuenta con el relato de un medio');

    /* EL RESULTADO DE LA PRIMERA CORRIDA, medido sobre el registro. No es un
       trinquete: si mañana llega el documento forense, esta línea lo dice y
       no se pone roja — mide el reparto, no exige que sea cero. */
    const declaran14 = (regN.entradas || []).filter((e) => (e.indicadores || []).indexOf('I-14') >= 0);
    const sinVia = declaran14.filter((e) => !(((e.indicadoresPor || {})['I-14'] || {}).via));
    comprobar('toda entrada que declara I-14 dice por cuál renglón entra',
      declaran14.length > 0 && sinVia.length === 0,
      !declaran14.length ? 'ninguna entrada declara I-14: el criterio no tiene nada que clasificar'
        : sinVia.length ? sinVia.length + ' la declaran sin `indicadoresPor`'
        : declaran14.length + ' la declaran, todas con su vía citada');

    /* Y la vía citada es un renglón EXACTO del `incluye` de I-14, no una
       paráfrasis: una cita inventada se ve acá y no tres tandas después. */
    const inc14 = (tramo14.match(/incluye: \[[\s\S]*?\]/) || [''])[0];
    const malVia = declaran14.filter((e) => inc14.indexOf(((e.indicadoresPor || {})['I-14'] || {}).via || '\u0000') < 0);
    comprobar('y esa vía es un renglón exacto del «incluye» de I-14',
      declaran14.length > 0 && malVia.length === 0,
      malVia.length ? 'cita un renglón que el criterio no tiene: ' +
                      malVia.map((e) => e.id).join(', ')
                    : 'ninguna cita apunta a un renglón que no exista');

    /* Las tres cuentas DERIVADAS (clase B): con las listas escritas a mano,
       agregar un criterio y olvidar una de las tres dejaba el indicador
       nuevo contando cero sin un solo error. */
    const mitadesDer = [
      ['la lista sale de CRITERIOS', /var CON_CRITERIO = Object\.keys\(CRITERIOS\);/.test(j70n)],
      ['crudo se deriva', /CON_CRITERIO\.forEach\(function \(k\) \{ crudo\[k\] = 0; \}\);/.test(j70n)],
      ['fuera se deriva', /CON_CRITERIO\.forEach\(function \(k\) \{ fuera\[k\] = \[\]; \}\);/.test(j70n)],
      ['porVia se deriva', /CON_CRITERIO\.forEach\(function \(k\) \{ porVia\[k\] = \{\}; \}\);/.test(j70n)],
      ['y ninguna quedó tecleada', !/\{ 'I-04': \[\], 'I-05': \[\]/.test(j70n)]
    ];
    const malDer = mitadesDer.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('las tres cuentas por criterio se DERIVAN, no se teclean',
      malDer.length === 0,
      malDer.length ? 'falla: ' + malDer.join(' · ')
                    : 'un criterio nuevo entra en las tres sin que nadie se acuerde');

    /* LA GUARDA DE LA GUARDA: que el eje D lo LEA y llegue al papel. */
    const mitades14 = [
      ['el eje D declara su lista de indicadores', /var IND_EJE_D = \['I-14'\];/.test(j70n)],
      ['y filtra sus filas por ella', /IND_EJE_D\.indexOf\(f\.id\) >= 0/.test(j70n)],
      ['y su `falta` ya no dice que el indicador no existe',
       !/La segunda es el INDICADOR: ninguno de los criterios/.test(j70n)],
      ['y lo que falta se CALCULA de la fila, no se teclea', /var fi14 = \(r\.filas \|\| \[\]\)\[0\]/.test(j70n)],
      /* Y QUE EL PINTOR NO ESTÉ ATADO AL EJE B. Faltaba esta mitad: con el
         pintor en `ej.eje === 'B'` la fila de I-14 viaja en el objeto del eje
         D y ninguna pantalla la alcanza —clase C—, y la inyección no ponía
         nada en rojo. Cuando una inyección fiel no muerde, lo que falta es la
         aserción y no la inyección (v1029). */
      ['y el pintor de filas no está atado a un eje',
       /if \(ej\.filas && ej\.filas\.length\) \{/.test(j70n) && !/if \(ej\.eje === 'B' && ej\.filas\)/.test(j70n)],
      ['y el cero declarado lleva su discriminante al lado',
       /fi\.declaradas && fi\.declaradas > fi\.n/.test(j70n) && /\.sp-c3-ind-nota\{/.test(leer('css/70-seguimiento.css'))]
    ];
    const mal14 = mitades14.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('el eje D lee su indicador y su «falta» sale de la corrida',
      mal14.length === 0,
      mal14.length ? 'falla: ' + mal14.join(' · ')
                   : 'la fila llega al eje y el texto se recalcula con ella');

    /* ── UN TRÁMITE NO PIDE LO QUE EL REGISTRO YA TIENE (v1006, v1078) ────
       La v1077 cerró el renglón del indicador y puso en su lugar
       `operacion-como-acto`; la v1078 lo cerró también, veinte minutos
       después de escribirlo. Un renglón cumplido que se queda es peor que
       ninguno, porque manda a hacer lo que ya está hecho.

       Y la condición NO se recuerda: se MIDE. Cada muerte confirmada del
       bloque `fuerza` nombra el acto que la produjo, ese acto existe en el
       registro, es de tipo `actividad` y declara el indicador. El día que
       entre una operación nueva sin su acto, esta guarda se pone roja y el
       renglón del trámite tiene que volver. */
    const reglasD = ((regN.tramites || {}).D || {}).reglas || [];
    const claves = reglasD.map((r) => r.k);
    const cerradas = (((regN.tramites || {}).D || {})._cerradas || []).map((r) => r.k);

    const porId = {};
    (regN.entradas || []).forEach((e) => { if (e.id) porId[e.id] = e; });
    const muertes = ((regN.fuerza || {}).menoresMuertos) || [];
    const malActo = [];
    muertes.forEach((m) => {
      const a = m.acto && porId[m.acto];
      if (!m.acto) malActo.push((m.op || '?') + ': no nombra su acto');
      else if (!a) malActo.push((m.op || '?') + ': nombra «' + m.acto + '» y el registro no la tiene');
      else if (a.tipoMedicion !== 'actividad') malActo.push((m.op || '?') + ': su acto no es de tipo actividad');
      else if ((a.indicadores || []).indexOf('I-14') < 0) malActo.push((m.op || '?') + ': su acto no declara I-14');
    });
    comprobar('MATERIAL · toda muerte confirmada nombra el ACTO que la produjo, y ese acto declara I-14',
      muertes.length > 0 && malActo.length === 0,
      !muertes.length ? 'el bloque `fuerza` no registra ninguna muerte: no hay qué atar'
        : malActo.length ? 'falla: ' + malActo.join(' · ')
        : 'las ' + muertes.length + ' operaciones con muertos confirmados tienen su acto registrado');

    /* El trámite y el registro no se contradicen: lo que la medición de
       arriba da por hecho NO puede seguir pedido abajo. */
    const yaHecho = muertes.length > 0 && malActo.length === 0;
    const sobra = [];
    if (claves.indexOf('indicador') >= 0) sobra.push('indicador (lo escribió la v1077)');
    if (yaHecho && claves.indexOf('operacion-como-acto') >= 0) sobra.push('operacion-como-acto (ya está hecho y medido)');
    comprobar('y el trámite del eje D no pide nada que el registro ya tenga',
      sobra.length === 0 && reglasD.length > 0,
      !reglasD.length ? 'el trámite del eje D se quedó sin reglas: un vacío sin trámite vuelve a ser un muro'
        : sobra.length ? 'sigue pidiendo: ' + sobra.join(' · ')
        : 'reglas: ' + claves.join(' · ') + ' · cerradas y dichas: ' + (cerradas.join(' · ') || 'ninguna'));

    /* Y lo cerrado queda ESCRITO, con su versión y su razón: sin eso, una
       regla que desaparece se lee igual que una que nunca se escribió. */
    const malCerr = (((regN.tramites || {}).D || {})._cerradas || [])
      .filter((r) => !(r.k && /^v\d+$/.test(r.cerrada || '') && (r.razon || '').length > 40)).map((r) => r.k || '?');
    comprobar('y lo que se cerró queda escrito, con su versión y su razón',
      cerradas.length > 0 && malCerr.length === 0,
      !cerradas.length ? 'ninguna cerrada: una regla que desaparece se lee igual que una que nunca existió'
        : malCerr.length ? 'sin versión o sin razón: ' + malCerr.join(', ')
        : cerradas.length + ' cerradas, cada una con su versión y su razón');
  }


  /* ═══ UN DEFLACTOR ENVEJECE, Y SU VEJEZ SE MIDE (v1082) ═════════════════
     El eje C descuenta la inflación con una cifra del DANE, y el DANE la
     reemplaza todos los meses. Su vejez vivía en la PROSA de
     `deflactorNota` —«inflación anual de agosto»— y nada la comparaba con
     nada: el día que saliera la de septiembre el panel seguiría declarando
     la de agosto sin que ninguna pantalla lo notara. Es la cifra que
     envejece sola (v903) con el agravante de la v867: declarar el método y
     la fecha de corte y callar que el insumo ya tiene reemplazo se lee como
     plenamente al día.

     Y la cura NO es subir el número. Las variaciones reales por sector están
     calculadas con el 6,24 % y el registro no guarda el monto del año
     anterior por sector, así que no se pueden rehacer acá: cambiar solo la
     etiqueta dejaría los porcentajes calculados con una cifra y declarados
     con otra, que es peor que quedarse viejo. La cura es que se DIGA, y que
     la comparación sea una FECHA contra otra y no una lectura de prosa. */
  {
    const j70f = soloCodigo(leer('js/70-seguimiento.js'));
    const regF = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const Pf = regF.presupuesto || {};
    const serie = ((regF.indicadores || {}).inflacion) || {};
    const pts = (serie.puntos || []).filter((x) => x && x.f && x.v != null);

    comprobar('MATERIAL · la inflación es una SERIE con fechas, no una frase en una nota',
      pts.length >= 2 && !!Pf.deflactorDesde,
      !pts.length ? 'no hay serie `indicadores.inflacion` con puntos'
        : !Pf.deflactorDesde ? 'el deflactor no declara `deflactorDesde`: su vejez solo se puede leer en prosa'
        : pts.length + ' lecturas, de ' + pts[0].f + ' a ' + pts[pts.length - 1].f +
          ' · el deflactor es de ' + Pf.deflactorDesde);

    /* La comparación se CALCULA y las DOS redacciones están escritas (v970):
       la del día que esté al día y la de hoy, que no lo está. */
    const mitadesD = [
      ['el eje compara las dos fechas', /alDia: !\(ult\.f > P\.deflactorDesde\)/.test(j70f)],
      ['y la redacción de «hay una más reciente» existe',
       /El DANE ya public[oó] una m[aá]s reciente/.test(j70f)],
      ['y la de «es la última» también', /que es la [uú]ltima que el DANE public[oó]/.test(j70f)],
      ['y dice POR QUÉ no se rehicieron las variaciones',
       /no guarda el monto de ' \+ \(\(r\.anio \|\| 2027\) - 1\) \+/.test(j70f)]
    ];
    const malD = mitadesD.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('el eje C compara la fecha del deflactor con la última lectura, y escribe las dos redacciones',
      malD.length === 0,
      malD.length ? 'falla: ' + malD.join(' · ')
                  : 'la vejez del deflactor se mide contra la serie, no se lee en una nota');

    /* Y LA MEDICIÓN DE HOY, impresa. No es un trinquete: el día que alguien
       rehaga las variaciones con la cifra nueva, esta línea lo dice y sigue
       en verde — mide el estado, no exige que esté viejo. */
    const ultF = pts.length ? pts[pts.length - 1].f : null;
    const ultV = pts.length ? pts[pts.length - 1].v : null;
    const alDia = !!(ultF && Pf.deflactorDesde && !(ultF > Pf.deflactorDesde));
    comprobar('y el estado del deflactor va medido y dicho, no supuesto',
      pts.length > 0,
      !pts.length ? 'sin serie no hay con qué comparar'
        : alDia ? 'al día: el deflactor (' + Pf.deflactorPct + ' %) es la última lectura del registro'
        : 'VIEJO y declarado: deflacta con ' + Pf.deflactorPct + ' % de ' + Pf.deflactorDesde +
          ' y la última lectura es ' + ultV + ' % de ' + ultF);

    /* La trampa que esto evita: que alguien suba el número y deje los
       porcentajes calculados con el viejo. Si el deflactor coincide con la
       última lectura, los `realPct` tienen que poder rehacerse —y hoy no
       pueden, porque falta el monto del año anterior—, así que coincidir sin
       esa base sería la etiqueta mintiendo. */
    const sec = ((Pf.sectores || {}).lista) || [];
    const conBase = sec.filter((x) => x.bnAnterior != null).length;
    const coincide = !!(ultV != null && Pf.deflactorPct === ultV);
    comprobar('y si el deflactor se actualiza, las variaciones tienen que poder rehacerse',
      !coincide || conBase === sec.length,
      !coincide
        ? 'el deflactor no se movió, y la pantalla dice por qué: sin el monto del año anterior no hay cómo rehacer los ' + sec.length + ' sectores'
        : conBase === sec.length ? 'coincide con la última lectura y los ' + sec.length + ' sectores traen su base para rehacerse'
        : 'el deflactor se actualizó a la última lectura pero ' + (sec.length - conBase) +
          ' sectores no traen el monto del año anterior: los porcentajes quedaron calculados con otra cifra');

    /* GUARDA DE LA GUARDA (v878): que llegue al papel. */
    comprobar('y el aviso LLEGA a la pantalla, dentro de las unidades del eje',
      /r\.deflactor = defl;/.test(j70f) && /defl && !defl\.alDia/.test(j70f),
      'va en `unidades`, que es el renglón que la ficha pinta debajo del título del eje');
  }

  /* ═══ DÓNDE ESTÁ ESCRITO CADA PUNTO DE SERIE · EL ANCLAJE (v1085) ══════
     `deudaSerie` publicó durante setenta y dos versiones 750 millones de
     dólares «activados» desde la posesión, con la etiqueta «Banco Mundial
     (450) + BID (300)». Las dos entradas del registro que documentan ese día
     dicen otra cosa: el Banco Mundial GIRÓ 200, primer desembolso de una
     línea contingente de HASTA 450. El techo estaba sumado como si estuviera
     girado, y la serie se contradecía con su propia leyenda —que dice
     «activados»— y con el nombre de su única fuente, que decía 200.

     Es la clase B: una serie trae sus propias fuentes y vive APARTE de las
     entradas, así que el punto y la entrada son dos codificaciones de un
     mismo hecho. Coincidían el día que se escribieron. Y es también la razón
     de que nadie lo viera: no había ni un enlace entre las dos, así que
     comprobarlas una contra otra pedía acordarse de hacerlo.

     DE QUÉ NO RESPONDE ESTA GUARDA (v945, v952), y va dicho porque declarar
     cubrir más de lo que se cubre es tan engañoso como cubrir menos: NO
     comprueba que el número del punto coincida con el de la entrada. El valor
     de un punto es a veces la cifra publicada (6,29 % de inflación) y a veces
     un acumulado que ninguna entrada escribe (el primer bombardeo vale 1 y
     ninguna entrada dice «1»); una marca a mano para distinguirlos sería
     exactamente la cifra que envejece sola que la v903 prohibió. Lo que esta
     guarda sostiene es que el ENLACE exista —o que su ausencia esté
     razonada—, y que llegue a la pantalla, que es lo que faltaba. */
  {
    const j70a = soloCodigo(leer('js/70-seguimiento.js'));
    const cssA = leer('css/70-seguimiento.css');
    const regA = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const indA = regA.indicadores || {};
    const idsA = {};
    (regA.entradas || []).forEach((e) => { if (e && e.id) idsA[e.id] = true; });

    /* El MATERIAL va primero (v920), y es lo que sobrevive al cero (v1022):
       no es «hay puntos sin anclar» —eso se vacía el día que se anclen todos—
       sino que HAYA series con puntos sobre las que preguntar. */
    /* LAS TRES FORMAS que este módulo publica, y las tres cuentan: una serie
       de puntos, una comparación por fuente —cuyas `medidas` son los puntos— y
       el bloque de deuda, cuyas `lineas` lo son. Si la cuenta mirara solo
       `puntos`, dos de las ocho formas se quedarían sin anclaje EN SILENCIO y
       la guarda pasaría en verde sobre ellas, que es la cuarta trampa de
       CLAUDE.md: la exención sin aviso se lee igual que un aprobado. Lo cazó
       el papel: «Aprobación del presidente» y «Créditos activados» salían sin
       la línea y nada lo decía. */
    const puntosDe = (b) => {
      const pp = (b.puntos || []).filter((p) => p && p.f && p.v != null);
      if (pp.length) return pp;
      const mm = [];
      (b.grupos || []).forEach((g) => (g.medidas || []).forEach((m) => {
        if (m && m.f && m.v != null) mm.push(m);
      }));
      if (mm.length) return mm;
      return (b.lineas || []).filter((l) => !!l);
    };
    const seriesA = Object.keys(indA).filter((k) => indA[k] && typeof indA[k] === 'object' &&
      puntosDe(indA[k]).length > 0);
    const puntosA = [];
    seriesA.forEach((k) => puntosDe(indA[k])
      .forEach((p) => puntosA.push({ k: k, p: p, serie: indA[k] })));

    comprobar('MATERIAL · el registro trae series con puntos sobre los que preguntar dónde están escritos',
      seriesA.length >= 3 && puntosA.length >= 8,
      !seriesA.length ? 'ninguna serie del registro tiene puntos: sin eso el anclaje no tiene de qué responder'
        : seriesA.length + ' series con puntos · ' + puntosA.length + ' puntos en total: ' + seriesA.join(' · '));

    /* FALLA CERRADO (v880): todo punto declara una de las dos cosas. Lo que no
       se declara sale en rojo; nada pasa por omisión. */
    const sinDeclarar = puntosA.filter((x) => {
      const b = (x.p.base || []).length;
      return !b && !x.p.sinBase && !x.serie.sinBase;
    }).map((x) => x.k + ' ' + (x.p.f || x.p.n || '?'));
    comprobar('todo punto de serie declara la entrada donde su hecho está escrito, o la razón de que no haya ninguna',
      sinDeclarar.length === 0 && puntosA.length > 0,
      sinDeclarar.length
        ? 'sin declarar ni lo uno ni lo otro: ' + sinDeclarar.join(' · ') +
          ' — y un punto que no remite a nada se lee igual que uno comprobado'
        : puntosA.length + ' puntos, cada uno con su entrada o con su razón');

    /* Y el enlace tiene que LLEVAR a algún sitio: un id que no resuelve es un
       anclaje que parece anclaje. */
    const idsMalos = [];
    puntosA.forEach((x) => (x.p.base || []).forEach((b) => {
      if (!idsA[b]) idsMalos.push(x.k + ' ' + (x.p.f || x.p.n || '?') + ' → ' + b);
    }));
    const conBaseA = puntosA.filter((x) => (x.p.base || []).length);
    comprobar('y cada id declarado resuelve a una entrada real del registro',
      idsMalos.length === 0 && conBaseA.length > 0,
      idsMalos.length ? 'ids que no existen en el registro: ' + idsMalos.join(' · ')
        : !conBaseA.length ? 'ningún punto remite a una entrada: sin eso el enlace no se ejercita'
        : conBaseA.length + ' de ' + puntosA.length + ' puntos remiten a una entrada, y las ' +
          Object.keys(conBaseA.reduce((a, x) => { (x.p.base || []).forEach((b) => { a[b] = 1; }); return a; }, {})).length +
          ' entradas nombradas existen');

    /* Y una razón tiene que ser una razón. «no aplica» no explica nada, y un
       vacío se declara con QUÉ falta y por qué (v849, v880). */
    const razonesCortas = [];
    puntosA.forEach((x) => {
      if ((x.p.base || []).length) return;
      const r = x.p.sinBase || x.serie.sinBase || '';
      if (String(r).length < 80) razonesCortas.push(x.k + ' ' + (x.p.f || x.p.n || '?') + ': «' + r + '»');
    });
    comprobar('y la razón de que un punto no remita a ninguna entrada es una razón, no una palabra',
      razonesCortas.length === 0,
      razonesCortas.length ? 'razones que no explican nada: ' + razonesCortas.join(' · ')
        : (puntosA.length - conBaseA.length) + ' puntos sin entrada, cada uno con su razón escrita y comprobable');

    /* Las DOS redacciones (v970): la de hoy y la del día que todos los puntos
       remitan a una entrada. La segunda es justo la que hace falta entonces. */
    const mitadesA = [
      ['la función del anclaje existe y lee el registro', /function anclajeDeSerie\(d, dd\)/.test(j70a)],
      ['y la redacción de «todos remiten» está escrita',
       /pts\.length === conBase\.length[\s\S]{0,200}a una entrada del registro, donde el hecho est/.test(j70a)],
      ['y la de «ninguno remite» también',
       /Ning[uú]n punto de esta serie remite a una entrada del registro/.test(j70a)],
      ['y la del caso mixto, que es el de hoy', /de ' \+ pts\.length \+/.test(j70a)],
      ['y un punto sin declarar lo DICE en la pantalla, no pasa en silencio',
       /ni la entrada que lo documenta ni la raz[oó]n de que no haya ninguna/.test(j70a)]
    ];
    const malA = mitadesA.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('y las tres redacciones del anclaje están escritas, con la del punto sin declarar',
      malA.length === 0,
      malA.length ? 'falla: ' + malA.join(' · ')
                  : 'las tres redacciones y el aviso de lo no declarado, escritos antes de hacer falta');

    /* GUARDA DE LA GUARDA (v878): que LLEGUE al papel, en los tres sitios
       donde se pinta una serie. Si deja de llegar, todo lo de arriba sigue en
       verde sobre documentación — y el dato existiría sin que ninguna
       pantalla lo alcanzara, que es la clase C de CLAUDE.md. */
    /* CINCO sitios, no tres: las series se pintan en tres y el bloque de
       deuda en dos más. Contar solo `anclajeDeSerie(d, D)` dejaba los dos
       del bloque de deuda sin vigilar, y es justo el bloque del hallazgo. */
    const sitios = (j70a.match(/anclajeDeSerie\((?:d|ind\.deuda), D\)/g) || []).length;
    /* DÓNDE lo pinta la tarjeta cambió en la v1143: el anclaje pasó al
       `<details>` de «Salvedades y método», con el resto del método. PLEGADO
       CUENTA COMO ALCANZABLE —`details` es nativo, sale al tabular y un
       lector de pantalla lo anuncia y lo abre— y lo que la guarda sigue
       exigiendo es lo mismo de antes: que la tarjeta lo CUELGUE. Si se cae,
       vuelve a ser un dato que ninguna pantalla alcanza.

       Lo que NO se afloja: el patrón sigue pidiendo un `appendChild` sobre
       el anclaje, así que quitarlo pone la guarda en rojo igual que antes.
       Lo único que cambió es el nodo del que cuelga. */
    const pintaAncla = /if \(anclaje\) mas\.appendChild\(anclaje\);/.test(j70a) ||
                       /if \(anclaje\) c\.appendChild\(anclaje\);/.test(j70a);
    comprobar('y el anclaje LLEGA a la pantalla, en los cinco sitios donde se pinta una cifra de `indicadores`',
      sitios >= 5 && pintaAncla &&
      /\.sp-graf-ancla\{/.test(cssA) && /\.sp-graf-ancla-mal\{/.test(cssA),
      sitios < 5 ? 'solo ' + sitios + ' de los 5 sitios lo pasan: en los otros la serie se publicaría sin decir dónde está escrita'
        : !pintaAncla ? 'la tarjeta recibe el anclaje y no lo pinta'
        : !/\.sp-graf-ancla\{/.test(cssA) ? 'la clase `.sp-graf-ancla` no tiene regla en el css: se pintaría sin forma'
        : !/\.sp-graf-ancla-mal\{/.test(cssA) ? 'la clase del punto sin declarar no tiene regla: el aviso se pintaría como texto normal'
        : 'los 5 sitios lo pasan, la tarjeta lo cuelga —hoy dentro del pliegue, que es alcanzable— y las dos clases tienen regla');

    /* Y DE QUÉ NO RESPONDE, escrito donde el lector lo ve y no en un
       comentario (v926, v945, v952): el registro lo dice en su propia nota. */
    const notaA = String(indA._notaAnclaje || '');
    comprobar('y el registro declara que el anclaje NO promete que el número coincida',
      notaA.length > 300 && /no promete|NO promete/.test(notaA) && /v903/.test(notaA),
      !notaA ? 'falta `indicadores._notaAnclaje`: sin ella, el anclaje se lee como si comprobara la cifra'
        : notaA.length <= 300 ? 'la nota del anclaje tiene ' + notaA.length + ' caracteres: no alcanza para decir qué cubre y qué no'
        : !/v903/.test(notaA) ? 'la nota no dice POR QUÉ no se comprueba el número (la marca a mano que envejece)'
        : 'la nota dice qué promete el anclaje y qué no, y por qué no puede prometerlo');

    /* LA ATADURA, que es la cura de la clase B y no el anclaje: el anclaje
       deja comprobar, esto impide separarse. El punto de `deudaSerie` y el
       bloque `deuda` dicen el mismo hecho con dos codificaciones, y el bloque
       ya traía las DOS columnas —`comprometido` y `desembolsado`— a dos claves
       de distancia. El defecto no era el número: era que el título decía
       «comprometida» y la leyenda «activados», así que 750 estaba publicado
       sin decir de qué era, y 200 y 450 estaban ahí al lado sin leerse. Eso es
       la clase A dentro de la clase B.

       Lo que se ata es la DERIVACIÓN: el último punto de la serie tiene que
       ser la suma de lo comprometido del bloque. Si mañana el BID amplía su
       línea y alguien toca un solo sitio, esto se pone rojo. Y es la
       derivación CORRECTA de las dos que CLAUDE.md distingue, porque no existe
       un cambio razonable que deba mover una y no la otra. */
    const deuB = indA.deuda || {};
    const lineasB = (deuB.lineas || []).filter((l) => l && l.comprometido != null);
    const sumaB = lineasB.reduce((a, l) => a + l.comprometido, 0);
    const serB = (indA.deudaSerie || {});
    const ptsB = (serB.puntos || []).filter((p) => p && p.f && p.v != null);
    const ultB = ptsB.length ? ptsB[ptsB.length - 1] : null;

    comprobar('MATERIAL · el bloque de deuda trae las dos columnas, que es lo que hacía falta leer',
      lineasB.length >= 2 && lineasB.some((l) => l.desembolsado != null),
      lineasB.length < 2 ? 'menos de dos líneas con `comprometido`: sin eso no hay suma que atar'
        : !lineasB.some((l) => l.desembolsado != null)
          ? 'ninguna línea distingue lo desembolsado: sin las dos columnas el número vuelve a no decir de qué es'
          : lineasB.length + ' líneas · comprometido ' + sumaB + ' · con desembolso informado ' +
            lineasB.filter((l) => l.desembolsado != null).length);

    comprobar('y el último punto de `deudaSerie` SALE de la suma de lo comprometido del bloque, no de otra cuenta',
      !!ultB && ultB.v === sumaB,
      !ultB ? 'la serie de deuda no tiene puntos: no hay qué atar'
        : ultB.v !== sumaB ? 'la serie publica ' + ultB.v + ' y el bloque suma ' + sumaB +
          ': dos codificaciones del mismo hecho, separadas'
        : 'los dos dicen ' + sumaB + ', y la serie declara en su leyenda que es lo COMPROMETIDO');

    comprobar('y la serie dice de QUÉ es su número, con lo girado al lado y dicho aparte',
      /lo COMPROMETIDO/.test(String(serB.leyenda || '')) &&
      /Lo GIRADO es menos y es otra cifra/.test(String(serB.leyenda || '')) &&
      /no se puede sumar/.test(String(serB.leyenda || '')),
      !/lo COMPROMETIDO/.test(String(serB.leyenda || ''))
        ? 'la leyenda no dice que el número sea lo comprometido: vuelve a ser una cifra sin decir de qué es'
        : !/Lo GIRADO es menos y es otra cifra/.test(String(serB.leyenda || ''))
          ? 'la leyenda no dice lo girado al lado: el lector no puede distinguir las dos medidas'
          : !/no se puede sumar/.test(String(serB.leyenda || ''))
            ? 'la leyenda no dice que lo girado NO se puede sumar porque falta el del BID'
            : 'la leyenda nombra la medida que publica, la que no, y por qué la otra no se puede sumar');

    /* Y LA MEDICIÓN DE HOY, impresa. Mide el estado y no exige un pendiente:
       el día que todos los puntos remitan a una entrada, esta línea lo dice y
       sigue en verde (v965). */
    comprobar('y el estado del anclaje va medido y dicho, no supuesto',
      puntosA.length > 0,
      (conBaseA.length === puntosA.length
        ? 'los ' + puntosA.length + ' puntos remiten a una entrada del registro'
        : conBaseA.length + ' de ' + puntosA.length + ' puntos remiten a una entrada; los otros ' +
          (puntosA.length - conBaseA.length) + ' declaran por qué no hay ninguna') +
      ' · ' + seriesA.length + ' bloques de `indicadores` cubiertos, y FUERA quedan los gráficos' +
      ' que salen de `presupuesto` y de contar el propio registro: esos no son dos codificaciones' +
      ' de un hecho, son el registro mismo, y esta guarda no responde por ellos');
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

    /* EL MATERIAL DE LA VALIDACIÓN ES LO QUE SE REVISÓ, NO LO QUE DECLARA
       (v1075). La guarda anterior pedía `clasificadas > 0`, y `clasificadas`
       contaba entradas con `nivelGobierno` + `estadoProcesal` +
       `tipoEvidencia` — tres campos que este mismo módulo declara exigibles
       SOLO a las que declaran indicador. Un registro anterior cuyos actos se
       revisaron y no cayeron en ninguna vía no declara ninguno, así que daba
       CERO por construcción y las cuatro fichas publicaban que el registro
       «no pasó por esta clasificación». Falso desde la v1061.

       La prueba no se afloja: se hace MÁS PRECISA. Mide lo que de verdad
       discrimina —que alguien haya CORRIDO los criterios y dejado escrito el
       resultado, aunque sea la lista vacía— y además exige el piso, que
       antes no existía: con `clasificadas > 0` bastaba UNA entrada para dar
       por validado un criterio. */
    const mitadesProb = [
      ['el material es lo REVISADO, no lo que declara',
       /if \(e && e\.indicadores !== undefined\) revisadas\+\+;/.test(j70v)],
      ['y «probado» exige el piso Y que no dispare',
       /probado: revisadas >= MIN_ACTOS_VALIDACION && disparos === 0/.test(j70v)],
      ['el piso NO es un número elegido para este caso',
       /var MIN_ACTOS_VALIDACION = FICHA_MIN_HECHOS;/.test(j70v)],
      ['y ya no se cuenta por los tres campos',
       !/e\.nivelGobierno && e\.estadoProcesal && e\.tipoEvidencia\) clasificadas\+\+/.test(j70v)]
    ];
    const malProb = mitadesProb.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('«probado» mide lo REVISADO contra un piso declarado, no tres campos no exigibles',
      malProb.length === 0,
      malProb.length ? 'falla: ' + malProb.join(' · ')
                     : 'cuenta lo que la v1061 dejó escrito, y el piso es el mismo FICHA_MIN_HECHOS');

    /* LOS CUATRO ESTADOS, y que el nuevo EXISTA. Sin el de «corrió y es
       poco», el módulo vuelve a decir «no hay material» sobre un registro
       que sí se revisó, que es el defecto que esta tanda vino a arreglar.
       Se mide dentro del trozo de `validacionDe` y no sobre el archivo. */
    const tramoVal = (j70v.match(/function validacionDe\(id, anterior\) \{[\s\S]*?\n  \}/) || [''])[0];
    const estadosVal = [
      ['sin registro en mano', /No hay en mano ning[uú]n registro/.test(tramoVal)],
      ['sin revisar', /\} else if \(!revisadas\) \{/.test(tramoVal)],
      ['disparó', /\} else if \(disparos\) \{/.test(tramoVal)],
      ['corrió y es poco', /para concluir que distingue: este m[oó]dulo pide al menos/.test(tramoVal)]
    ];
    const malEst = estadosVal.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('la razón distingue los CUATRO estados, no tres',
      !!tramoVal && malEst.length === 0,
      !tramoVal ? 'no se encontró validacionDe'
                : malEst.length ? 'falta el estado: ' + malEst.join(' · ')
                : 'sin registro · sin revisar · disparó · corrió y es poco');

    /* Y LA MEDICIÓN, impresa: cuántas entradas del registro anterior están
       revisadas. Es lo que deja ver de un vistazo que el «no hay material»
       era falso, y lo que sube solo cuando el registro de Petro crezca. */
    const regAnt = JSON.parse(leer('assets/data/seguimiento-petro.json'));
    const entAnt = regAnt.entradas || [];
    const revAnt = entAnt.filter((e) => e.indicadores !== undefined).length;
    const tresAnt = entAnt.filter((e) => e.nivelGobierno && e.estadoProcesal && e.tipoEvidencia).length;
    const declAnt = entAnt.filter((e) => (e.indicadores || []).length);
    comprobar('el registro anterior tiene entradas REVISADAS, aunque ninguna declare indicador',
      revAnt > 0,
      revAnt + ' de ' + entAnt.length + ' revisadas · ' + declAnt.length + ' declaran indicador · ' +
      tresAnt + ' con los tres campos (lo que la guarda vieja contaba)');

    /* Y la otra mitad de la regla, la que protege a las que SÍ declaran: a
       esas los tres campos se les siguen exigiendo, y es `pasaElCriterio`
       quien lo hace. Sin esto, «no se cuentan los tres campos» se podría
       leer como que ya no se piden nunca. */
    const faltanTres = declAnt.filter((e) => !(e.nivelGobierno && e.estadoProcesal && e.tipoEvidencia));
    comprobar('y a las que SÍ declaran indicador se les siguen exigiendo los tres campos',
      faltanTres.length === 0 && /if \(!nv\) return \{ cuenta: false/.test(j70v),
      faltanTres.length ? faltanTres.length + ' declaran indicador sin los tres campos'
                        : 'la puerta del indicador los sigue pidiendo donde la regla dice que se piden');

    /* El NOMBRE del gobierno anterior, que estaba en el registro y la carta
       no alcanzaba (clase C, en la misma línea). */
    /* Y EL CIERRE DE LA CARTA SE CALCULA (v903, v1075). Iba escrito a mano
       —«el día que se pueda correr contra el registro clasificado»— debajo de
       una razón que dice que YA se corrió: las dos frases de la misma caja se
       contradecían. Lo vio el papel compuesto, no el código. */
    /* APRETADA EN LA v1094, no aflojada. Mirábamos la expresión
       `corridas.length && !disparo` escrita dentro del pintor, y eso
       demostraba DOS redacciones. El día que I-04 e I-05 dispararon sobre
       el registro anterior se vio que dos no alcanzan: el `else` juntaba
       «corrió y disparó» con «no se pudo correr» y publicaba la frase del
       segundo debajo de la razón del primero. Ahora se mide DENTRO del
       trozo de `cierreDeValidacion` (v854, v935: por contenido y dentro
       del trozo, no por distancia) que estén los TRES estados, y que el
       pintor delegue en esa función en vez de armar el cierre por su
       cuenta —que es lo que permitió que un estado nuevo se quedara sin
       cierre (v880, v1090)—. */
    const trozoCie = (j70v.split('function cierreDeValidacion(')[1] || '').split('\n  }\n')[0];
    const tresCie = [
      ['disparó', /if \(v\.disparo\)/.test(trozoCie) && /disparó ' \+ cn\(v\.disparos/.test(trozoCie)],
      ['corrió y es poco', /if \(v\.corridas\.length\)/.test(trozoCie) && /pisoRevisadas/.test(trozoCie)],
      ['no se pudo correr', /se pueda correr contra un registro/.test(trozoCie)]
    ];
    const faltaCie = tresCie.filter((x) => !x[1]).map((x) => x[0]);
    const delega = /el\('p', null, cierreDeValidacion\(fi\.validacion\)\)/.test(j70v);
    const sinTeclear = !/se pueda correr contra el registro clasificado/.test(j70v);
    comprobar('el cierre de la carta se CALCULA, con un estado por cada acción distinta',
      !!trozoCie && !faltaCie.length && delega && sinTeclear,
      !trozoCie ? 'no se encontró `cierreDeValidacion`: el cierre volvió a armarse dentro del pintor'
        : faltaCie.length ? 'falta el cierre del estado: ' + faltaCie.join(' · ') +
                            ' — ese estado publicaría la frase de otro debajo de su propia razón'
        : !delega ? 'el pintor ya no delega en `cierreDeValidacion`, así que un estado nuevo puede ' +
                    'quedarse sin cierre en esta pantalla y tenerlo en otra'
        : !sinTeclear ? 'sigue la frase del modelo viejo («registro clasificado») debajo de una razón que dice que ya se corrió'
        : 'tres cierres —dejar crecer, mirar lo que cayó, conseguir un registro— y el pintor delega en uno solo');

        const loAlcanza = /quien: dd\.presidente \|\| dd\.gobernante/.test(j70v);
    comprobar('la corrida nombra al gobernante anterior, que el registro trae',
      loAlcanza && !!regAnt.presidente,
      !regAnt.presidente ? 'el registro anterior no declara presidente'
        : !loAlcanza ? 'el registro trae «' + regAnt.presidente + '» y la ficha NO lo alcanza: ' +
                       'la carta diría «gobierno anterior» teniendo el nombre al lado'
        : 'el registro trae «' + regAnt.presidente + '» y la ficha lo alcanza');

    /* SE APRIETA, NO SE AFLOJA (v1106). La aserción buscaba el literal
       `validado: no · gobiernos anteriores probados: `, que era el contenido
       de la marca mientras la tarjeta solo existía en el caso NO validado.
       Desde que se pinta en los dos casos ese literal ya no está, y aflojar
       la guarda a «existe la clase» sería perderla. Mide ahora tres cosas
       más precisas: la clase, su regla de CSS, y que el rótulo nombre las dos
       propiedades por separado en vez de un solo sí/no. */
    const marcaClase = /sp-c2-noval/.test(j70v) && /sp-c2-noval/.test(leer('css/70-seguimiento.css'));
    const marcaDosProps = /no tallado a este caso: /.test(j70v) && / · distingue: /.test(j70v);
    const marcaDosRedacciones = /indicador validado/.test(j70v) && /indicador no validado/.test(j70v);
    comprobar('la marca se pinta junto a la cifra, no en una nota al pie',
      marcaClase && marcaDosProps && marcaDosRedacciones,
      !marcaClase ? 'falta la clase o su regla de CSS: la marca no se pintaría'
      : !marcaDosProps ? 'el rótulo volvió a un solo sí/no: «no está tallado al caso» y «distingue» son ' +
                         'dos propiedades y ninguna implica la otra'
      : !marcaDosRedacciones ? 'falta una de las dos redacciones: con una sola, el indicador validado ' +
                               'desaparece de la pantalla con la revisión que lo validó dentro'
      : 'sale en la tabla de indicadores, con regla que la pinta, las dos propiedades nombradas aparte ' +
        'y las dos redacciones escritas');

    /* ═══ UNA LISTA DE INDICADORES VACÍA DICE POR QUÉ (v1094) ══════════════
       `indicadores: []` significa «lo corrí contra los cinco criterios y
       ninguno aplica», y es la marca que la v1061 inventó justamente para que
       eso no se viera igual que «nadie lo ha mirado».

       Pero la marca sola es GRATIS: son dos corchetes, y `corridaHaciaAtras`
       cuenta como revisada cualquier entrada que los lleve. Es decir, la
       salida barata para acercar el registro anterior al piso de validación
       es escribir corchetes vacíos sin haber corrido nada — y eso se lee
       exactamente igual que haberlo corrido. Es la exención silenciosa de
       CLAUDE.md entrando por la puerta del recuento.

       La guarda es contra la tentación PROPIA y no contra una hipotética:
       esta misma tanda documentó nueve actos del registro anterior con el
       piso de 20 a la vista.

       DE QUÉ NO RESPONDE, dicho al lado (v945, v952): no comprueba que la
       razón sea CIERTA —eso una guarda no lo puede hacer (v1008)—, comprueba
       que ESTÉ. Y corre sobre el registro del gobierno ANTERIOR y no sobre el
       actual, con su razón: es en el anterior donde cuelga la validación de
       los criterios, y las entradas del actual con la lista vacía las corrió
       la v1061 en bloque, así que su razón POR ENTRADA es trabajo pendiente y
       va declarado como tal en la bitácora. Ponerla en rojo acá mandaría a
       revisar ciento sesenta y ocho entradas que están bien revisadas. */
    const vacias = entAnt.filter((e) => Array.isArray(e.indicadores) && !e.indicadores.length);
    const sinRazon = vacias.filter((e) => !String(e._porQueListaVacia || '').trim());
    comprobar('MATERIAL · el registro anterior trae entradas corridas con la lista VACÍA',
      vacias.length > 0,
      vacias.length + ' entradas declaran «lo corrí y ninguno aplica»');
    comprobar('y ninguna de ellas deja sin escribir por qué ninguno aplica',
      vacias.length > 0 && sinRazon.length === 0,
      !vacias.length ? 'no hay ninguna con la lista vacía: lo dice la de arriba'
        : sinRazon.length ? sinRazon.length + ' de ' + vacias.length + ' sin razón escrita: ' +
            sinRazon.slice(0, 3).map((e) => (e.fecha || '') + ' · ' +
                                            String(e.titulo || '').slice(0, 44)).join(' | ')
        : 'las ' + vacias.length + ' llevan su razón en `_porQueListaVacia`');
    /* LA GUARDA DE LA GUARDA (v878): lo de arriba solo vale mientras el
       módulo siga contando como revisada una entrada con la lista vacía. Si
       dejara de contarla, la comprobación pasaría en verde sobre nada. */
    const cuentaVacia = /e\.indicadores !== undefined\) revisadas\+\+/.test(j70v);
    comprobar('y vigila justo lo que el módulo cuenta como corrido',
      cuentaVacia,
      !cuentaVacia ? '`corridaHaciaAtras` dejó de contar la lista vacía como revisada, así que la ' +
                     'comprobación de arriba pasaría en verde sobre entradas que ya no cuentan' :
      '`corridaHaciaAtras` cuenta como revisada toda entrada con `indicadores` declarado, ' +
      'lista vacía incluida: es eso lo que la de arriba protege');

    /* ═══ EL DENOMINADOR DEL CONTRARGUMENTO (v1109) ═══════════════════════
       El campo pregunta «¿respondió el Gobierno al reproche?», y lo contaba
       sobre TODAS las entradas del mandato — incluidas aquellas en las que el
       Gobierno es el ACUSADOR y no el acusado, como la auditoría forense a la
       DNI. A esas no hay respuesta oficial que pedirles, así que el pendiente
       subía cuando el registro crecía y no bajaba cuando alguien trabajaba:
       la señal que CLAUDE.md tiene escrita CINCO veces (v999, v1060, v1061,
       v1064, v1075).

       Y esto BAJA el número, así que pide la misma justificación que un
       umbral nuevo (v882, v1075). Lo que impide el atajo es que la exención
       **va por ENTRADA y con su razón escrita**, nunca por una regla en el
       código: una regla exime doscientas de una vez, una razón hay que
       pensarla una por una, que es la forma de `_porQueListaVacia` (v1094).
       Por eso el número baja solo tanto como entradas se examinen.

       DE QUÉ NO RESPONDE (v945, v952, v1008): de que la razón sea CIERTA.
       Comprueba que ESTÉ, que la entrada eximida no traiga ADEMÁS
       contrargumento —si lo trae, una de las dos cosas está mal escrita—, que
       el módulo cuente sobre el denominador exigible, y que las eximidas se
       PUBLIQUEN con su recuento en vez de desaparecer. */
    const regAct1109 = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    /* SE LEE `.razon` Y NO EL CAMPO ENTERO (v1029, v1117). La v1117 le dio
       forma de objeto al campo —causa y razón— y `String({})` devuelve
       «[object Object]», que es verdadero: la guarda habría dado por buena
       una exención con la razón EN BLANCO, en verde sobre el defecto que
       vigila. Lo cazó leer el detalle del verde, no una inyección. */
    const razonSR = (e) => {
      const v = (e && e._sinReprocheAlGobierno) || null;
      if (!v) return '';
      return String((typeof v === 'object' ? v.razon : v) || '').trim();
    };
    const exim = ((regAct1109.entradas) || []).filter((e) => razonSR(e));
    const eximSinRazon = ((regAct1109.entradas) || []).filter(
      (e) => e && e._sinReprocheAlGobierno !== undefined && !razonSR(e));
    const eximMal = exim.filter((e) => String(e.contrargumentoOficial || '').trim());
    /* EL `?` Y NO EL ROJO (v970, v1097). Que no haya ninguna eximida es un
       estado legítimo del registro —puede que toda entrada le reproche algo
       al Gobierno—, así que ponerlo en rojo empujaría a inventar exenciones
       para tener material, que es justo la salida barata que estas guardas
       cierran. Lo que SÍ va en rojo es lo que sobrevive al cero: que ninguna
       eximida vaya sin razón, y que el módulo cuente sobre el exigible. */
    if (!exim.length) {
      anotarSinMaterial('MATERIAL · entradas eximidas del contrargumento',
        'ninguna entrada declara hoy que no le reproche nada al Gobierno, y eso es un estado legítimo: ' +
        'lo que no se ejercita es el recuento, no las reglas de abajo');
    } else {
      comprobar('MATERIAL · hay entradas eximidas del contrargumento, con su razón',
        true,
        exim.length + (exim.length === 1 ? ' entrada declara que no le reprocha nada al Gobierno'
                                         : ' entradas declaran que no le reprochan nada al Gobierno'));
    }
    comprobar('y ninguna eximida va sin razón ni se contradice con su propio contrargumento',
      !eximSinRazon.length && !eximMal.length,
      (!exim.length && !eximSinRazon.length) ? 'no hay ninguna eximida, y la regla sigue valiendo: ' +
          'el día que aparezca una, sin razón o con contrargumento al lado, esta comprobación muerde'
      : eximSinRazon.length ? eximSinRazon.length + ' con el campo puesto y la razón en blanco: una ' +
          'exención sin razón es gratis, y gratis es exactamente lo que no puede ser'
      : eximMal.length ? eximMal.length + ' eximida(s) traen ADEMÁS contrargumento oficial, y una de las ' +
          'dos cosas está mal escrita'
      : 'las ' + exim.length + ' traen su razón y ninguna trae además contrargumento');

    /* ═══ EL EDITORIAL: NINGUNA AFIRMACIÓN SIN REGISTRO, NINGÚN TIPO PENAL,
           Y EL CIERRE SIEMPRE VISIBLE (v1125) ══════════════════════════════
       El editorial es CAPA 4 —opinión firmada, rotulada, aparte del cálculo—
       y no alimenta ningún eje ni indicador. Lo que esta guarda vigila son
       las cuatro condiciones que lo separan de un panfleto:

       1 · CADA AFIRMACIÓN ENLAZA A SU REGISTRO. No una lista suelta al lado
           del texto —esa decía sobre qué se apoyaba el editorial entero y no
           QUÉ sostenía cada frase, así que una afirmación sin respaldo se
           escondía detrás de las que sí lo tenían—. Y la base tiene que
           EXISTIR: cuatro de las diecisiete de esta tanda apuntaban a ids que
           yo había supuesto y no estaban en el registro.
       2 · NINGÚN TIPO PENAL, la misma clase de la v1118 y la misma lista, en
           un solo sitio para los dos lectores (v879). Que el texto vaya
           rotulado como opinión no lo salva: encadena hecho → tipo penal →
           juicio público igual que lo hacía la escala del eje D.
       3 · EL CIERRE VA VISIBLE Y AL MISMO NIVEL. «También encontré lo que no
           esperaba» no puede quedar plegado ni en letra chica: es lo que
           separa esto de un panfleto, y el atajo de la tanda siguiente es
           mandarlo a un <details> «para ahorrar espacio».
       4 · NO ALIMENTA NADA. Ningún eje ni indicador lo lee.

       DE QUÉ NO RESPONDE (v945): de que la opinión sea correcta, ni de que el
       registro que cita diga lo que el autor cree que dice. Comprueba que
       cada afirmación tenga un registro que EXISTE, que ninguna nombre un
       tipo penal, y que el cierre llegue a la pantalla.

       VA EN ROJO (v970): el material es el editorial mismo, y su cero no es
       una mejora — un editorial sin afirmaciones es un editorial retirado, y
       para eso está la rama de «no hay», que se mide aparte. */
    {
      const edReg = (regAct1109 || {}).analisisEditorial || null;
      const afs = (edReg || {}).afirmaciones || [];
      const idsAct = new Set(((regAct1109 || {}).entradas || []).map((e) => e.id).filter(Boolean));
      const idsCon = new Set(((((regAct1109 || {}).contradicciones) || {}).casos || [])
        .map((c) => c.id).filter(Boolean));
      const regAnt1125 = JSON.parse(leer('assets/data/seguimiento-petro.json'));
      const idsAnt = new Set((regAnt1125.entradas || []).map((e) => e.id).filter(Boolean));
      const existe = (r) => idsAct.has(r) || idsCon.has(r) || idsAnt.has(r);

      if (!afs.length) {
        anotarSinMaterial('MATERIAL · el editorial declara sus afirmaciones',
          'no hay editorial escrito hoy, y eso es un estado legítimo: el módulo lo publica diciendo que ' +
          'no lo hay. Las reglas de abajo se miden contra el código y siguen mordiendo');
      } else {
        comprobar('MATERIAL · el editorial declara sus afirmaciones, una por una',
          true, afs.length + ' afirmaciones declaradas, firmadas por ' +
          ((edReg || {}).autor || '(sin autor)') + ', ' + ((edReg || {}).fecha || '(sin fecha)'));
      }

      /* 1 · cada afirmación con su base, y la base EXISTE. */
      const malBase = afs.filter((a) => !((a.base || []).length) ||
                                        (a.base || []).some((r) => !existe(r)))
        .map((a) => a.k + (!(a.base || []).length ? ' (sin base)'
          : ' → ' + (a.base || []).filter((r) => !existe(r)).join(' ')));
      comprobar('ninguna afirmación del editorial se publica sin un registro que la sostenga',
        !afs.length || malBase.length === 0,
        !afs.length ? 'no hay editorial: nada que medir'
          : malBase.length ? 'sin registro: ' + malBase.join(' · ')
          : 'las ' + afs.length + ' anclan en un registro que existe —entradas de este gobierno, del ' +
            'anterior y contradicciones—, así que si el registro cambia y una deja de estar sostenida, ' +
            'esta comprobación lo dice');

      /* 1b · y ningún trozo del texto cita una afirmación que no existe. */
      const kk = new Set(afs.map((a) => a.k));
      const rotas = [];
      ['corta', 'cortaCierre', 'larga', 'largaCierre'].forEach((q) => {
        ((edReg || {})[q] || []).forEach((par) => (par || []).forEach((ch) => {
          if (ch.a && !kk.has(ch.a)) rotas.push(q + '/' + ch.a);
        }));
      });
      const huerf = afs.filter((a) => {
        let v = false;
        ['corta', 'cortaCierre', 'larga', 'largaCierre'].forEach((q) => {
          ((edReg || {})[q] || []).forEach((par) => (par || []).forEach((ch) => {
            if (ch.a === a.k) v = true; }));
        });
        return !v;
      }).map((a) => a.k);
      comprobar('y el texto y las afirmaciones no se separan: ninguna cita rota, ninguna declarada sin usar',
        !afs.length || (rotas.length === 0 && huerf.length === 0),
        !afs.length ? 'no hay editorial: nada que medir'
          : rotas.length ? 'el texto cita afirmaciones que no existen: ' + rotas.join(' · ')
          : huerf.length ? 'afirmaciones declaradas que ningún trozo cita: ' + huerf.join(' · ')
          : 'las ' + afs.length + ' se declaran y las ' + afs.length + ' se citan: la lista y el texto no ' +
            'pueden quedarse una sin la otra (clase B)');

      /* 2 · ningún tipo penal, con la MISMA lista del eje D. */
      const listaPenal = (j70v.match(/var ETIQUETA_PENAL = \[([\s\S]*?)\];/) || ['', ''])[1];
      const PEN = [...listaPenal.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      const conPenal = [], exentas = [];
      afs.forEach((a) => PEN.forEach((px) => {
        if (!new RegExp(px, 'i').test(String(a.dice || ''))) return;
        /* LA EXENCIÓN VA POR AFIRMACIÓN Y CON SU RAZÓN ESCRITA (v1094, v1109,
           v1125), nunca como una regla del código. La diferencia que la
           justifica: la prohibición de la v1118 es contra encadenar hecho →
           tipo penal → juicio público SOBRE ALGUIEN, y una serie estadística
           de la Policía no tiene sujeto. Pero esa distinción no se puede
           automatizar sin falsos positivos (v895), así que no se automatiza:
           se declara una por una, se cuenta y se publica.
           Y NO ALCANZA AL EJE D: su guarda mide con la lista entera y sin
           exención posible, así que esto no abre allá ninguna puerta. */
        /* LAS TRES PARTES, declaradas y no en prosa suelta (v1128). En un
           solo párrafo, «tiene razón escrita» se cumple con cualquier cosa;
           en tres campos hay que decir las tres cosas que la hacen válida y
           cada una se discute por separado. */
        const ex = a._noEsCalificacion;
        const faltan = ['categoriaEstadistica', 'sinSujeto', 'razon']
          .filter((q) => String((ex || {})[q] || '').trim().length < 40);
        if (ex && !faltan.length) exentas.push(a.k + ' → ' + px);
        else conPenal.push(a.k + ' → ' + px +
          (ex ? ' (su exención no declara ' + faltan.join(' ni ') + ')' : ' (sin exención declarada)'));
      }));
      comprobar('ninguna afirmación del editorial califica penalmente, o declara por qué no lo hace',
        PEN.length >= 6 && conPenal.length === 0,
        PEN.length < 6 ? 'la lista de etiquetas penales se encogió: ' + PEN.length + ' de 6'
          : conPenal.length ? 'califica penalmente y sin razón escrita: ' + conPenal.join(' · ')
          : 'las ' + PEN.length + ' etiquetas vigiladas sobre las ' + afs.length + ' afirmaciones' +
            (exentas.length
              ? ' · ' + exentas.length + ' nombra una categoría penal con su razón escrita de por qué no ' +
                'es una calificación: ' + exentas.join(' · ') + '. La exención va por afirmación y no por ' +
                'regla, y NO alcanza al eje D'
              : ' y ninguna la nombra') +
            '. Es la MISMA lista que lee el eje D, en un solo sitio (v879)');

      /* ══ 2b · Y LA MISMA VARA SOBRE LOS TÍTULOS DE LAS ENTRADAS (v1136) ══
         La guarda penal nació sobre el eje D (v1118) y creció al editorial
         (v1127). Los TÍTULOS quedaban fuera, y son la superficie que más se
         lee: la del muro, la de la línea de tiempo, la que se copia a
         WhatsApp. Medido antes de escribirla, cuatro títulos nombraban un
         tipo penal sobre una persona identificable —tres con su estado
         procesal al lado y uno sin él—, y ninguno pasaba por ninguna guarda.

         Se reescribieron al HECHO PROCESAL y el tipo penal se quedó en
         `detalle` con su fuente, que es la salida que la regla manda: a una
         afirmación que atribuye conducta a alguien no se le concede exención
         nunca (v1128).

         LA EXENCIÓN ES LA MISMA DE SIEMPRE: por ÍTEM, nunca por regla, con
         sus TRES partes declaradas en el propio título —`categoriaEstadistica`,
         `sinSujeto` y `razon`— y nombrada en el detalle de esta guarda, para
         que se discuta frase por frase y no por un contador.

         LA MISMA LISTA, en un solo sitio (v879): `ETIQUETA_PENAL` de `js/70`,
         la que ya leen el eje D y el editorial. Si alguien la encoge, las
         tres guardas se enteran a la vez.

         DE QUÉ NO RESPONDE (v945): de `detalle`, `contrapunto` y las demás
         superficies largas, donde el tipo penal con su estado procesal es
         justamente lo que hay que publicar; y de que la razón de una exención
         sea cierta, que no lo puede comprobar nadie (v1008). */
      {
        const PARTES = ['categoriaEstadistica', 'sinSujeto', 'razon'];
        const malos = [], exentosT = [];
        [['assets/data/seguimiento-presidencial.json', 'actual'],
         ['assets/data/seguimiento-petro.json', 'anterior']].forEach(([arch, cual]) => {
          const reg = JSON.parse(leer(arch));
          const items = (reg.entradas || []).map((e) => ['entrada', e])
            .concat((((reg.casos || {}).lista) || []).map((c) => ['caso', c]));
          items.forEach(([clase, it]) => {
            const t = String(it.titulo || '');
            PEN.forEach((px) => {
              if (!new RegExp(px, 'i').test(t)) return;
              const ex = it._noEsCalificacion || null;
              const faltan = PARTES.filter((q) => String((ex || {})[q] || '').trim().length < 40);
              if (ex && !faltan.length) exentosT.push(cual + ' · «' + t.slice(0, 70) + '…» → ' + px);
              else malos.push(cual + ' · ' + clase + ' · «' + t.slice(0, 80) + '…» → ' + px +
                (ex ? ' (su exención no declara ' + faltan.join(' ni ') + ')' : ' (sin exención declarada)'));
            });
          });
        });
        comprobar('ningún TÍTULO del registro califica penalmente, o declara por qué no lo hace',
          PEN.length >= 6 && malos.length === 0,
          PEN.length < 6 ? 'la lista de etiquetas penales se encogió: ' + PEN.length + ' de 6'
            : malos.length ? 'título que nombra un tipo penal sin su exención completa: ' + malos.join(' · ') +
              ' — la salida es reescribirlo al HECHO PROCESAL y dejar el tipo penal en `detalle` con su ' +
              'fuente; a un título que atribuye conducta a alguien NO se le concede exención nunca'
            : 'las ' + PEN.length + ' etiquetas sobre los títulos de los DOS registros' +
              (exentosT.length
                ? ' · ' + exentosT.length + ' eximido' + (exentosT.length === 1 ? '' : 's') +
                  ' por ítem, cada uno con sus tres partes: ' + exentosT.join(' · ')
                : ' y ninguno la nombra') +
              '. No cubre `detalle` ni `contrapunto`, donde el tipo penal con su estado procesal es lo ' +
              'que hay que publicar');
      }

      /* 3 y 4 · el cierre llega visible, y nada lo alimenta. */
      /* LA EXENCIÓN ES POR AFIRMACIÓN, NUNCA POR PALABRA (v1128). Una palabra
         exenta deja pasar TODO lo que venga después —cada afirmación futura
         que la use entra gratis—; una afirmación exenta solo se aplica a sí
         misma. Esta aserción existe para que nadie convierta lo segundo en lo
         primero: si aparece una lista de palabras exentas, o si la exención
         se lee de algo que no sea la propia afirmación, se pone roja.

         Y LA ASIMETRÍA, que es lo que impide que sea una grieta: la exención
         solo se le concede a una afirmación SIN SUJETO. A una acusatoria no
         se le concede nunca, ni con razón escrita, y ahí el único camino es
         reescribirla en hecho y estado procesal. Por eso `sinSujeto` es un
         campo exigido y no un comentario.

         Y SIN LAS TRES PARTES NO PUBLICA: la afirmación se RETIENE y en su
         lugar sale la marca que dice qué falta. Eso convierte la exención en
         un costo. Retirarla en silencio sería la clase C. */
      const mitadesEx = [
        ['la exención se lee de la propia afirmación', /var ex = a\._noEsCalificacion \|\| null;/.test(j70v)],
        ['y exige sus TRES partes, `sinSujeto` entre ellas',
         /PARTES_EX = \['categoriaEstadistica', 'sinSujeto', 'razon'\]/.test(j70v)],
        ['y sin las tres la afirmación se RETIENE', /retenida: !!\(penal\.length && faltanEx\.length\)/.test(j70v)],
        ['y el pintor no imprime el texto de una retenida', /if \(ch\.af\.retenida\) \{/.test(j70v)],
        /* Y NINGUNA LISTA DE PALABRAS EXENTAS, por ningún nombre. Se persigue
           la FORMA —una constante de palabras junto a la lista penal— y no un
           nombre concreto (v874, v895). */
        ['y no existe ninguna lista de PALABRAS exentas',
         !/(EXENT|EXCEP|PERMITID|BLANCA|WHITELIST)[A-Z_]*\s*=\s*\[/.test(j70v)]
      ];
      const malEx = mitadesEx.filter((x) => !x[1]).map((x) => x[0]);
      comprobar('la exención penal es por AFIRMACIÓN y nunca por palabra, y sin sus tres partes no publica',
        malEx.length === 0,
        malEx.length ? 'falla: ' + malEx.join(' · ')
          : 'se lee de la propia afirmación, exige categoría estadística, SIN SUJETO y razón, retiene la que no ' +
            'las traiga, y no hay ninguna lista de palabras exentas — una palabra exenta dejaría pasar todo lo ' +
            'que venga después, una afirmación exenta solo se aplica a sí misma');

      /* Y EL CONTROL NOMBRA CADA EXENTA CON SU FRASE, no con un número
         (v1128). Un contador que diga «1 exención» se ignora; una lista que
         diga QUÉ frase se exceptuó y POR QUÉ se puede discutir, que es el
         punto de concederla en público. La aserción lo mide sobre el
         CASILLERO —que su detalle se arme con `a.dice` y con las partes de
         la exención— y no sobre su título, que es texto y se renombra.
         Lo delató una inyección que renombró el casillero y salió VERDE: lo
         que faltaba no era la inyección, era lo que esto mide (v1029). */
      const cajaEx = (j70v.match(/caja\('Toda exenci[^']*',[\s\S]*?'archivo-aqui',[\s\S]*?\);/) || [''])[0];
      const mitadesCx = [
        ['el casillero de exenciones existe', !!cajaEx],
        ['y su detalle imprime la FRASE de cada exenta', /\(ed\.exentas \|\| \[\]\)\.map/.test(cajaEx) &&
         /'«' \+ a\.dice \+ '»/.test(cajaEx)],
        ['y las tres partes de su exención', /categoriaEstadistica/.test(cajaEx) && /sinSujeto/.test(cajaEx)],
        ['y nombra también las RETENIDAS con lo que les falta',
         /\(ed\.retenidas \|\| \[\]\)\.map/.test(cajaEx) && /faltanEx/.test(cajaEx)],
        ['y trae la redacción de CERO, para el día que no haya ninguna',
         /ninguna afirmaci[oó]n del editorial nombra una categor[ií]a penal/.test(cajaEx)]
      ];
      const malCx = mitadesCx.filter((x) => !x[1]).map((x) => x[0]);
      comprobar('y el control NOMBRA cada exención con su frase, no solo con su cuenta',
        malCx.length === 0,
        malCx.length ? 'falla: ' + malCx.join(' · ')
          : 'el casillero imprime la frase exceptuada, sus tres partes, las retenidas con lo que les falta, y ' +
            'la redacción de cero — un número se ignora, una frase se discute');

      const mitadesEd = [
        ['el cierre lo pinta la misma función que el cuerpo', /var cierre = larga \? ed\.cuerpo\.largaCierre/.test(j70v)],
        ['y va en el mismo <section>, sin plegar', /cj = el\('div', 'sp-edit-cierre'\)/.test(j70v) &&
         !/sp-edit-cierre[\s\S]{0,400}<?details/.test(j70v)],
        /* El selector del cierre se busca con su llave PEGADA y con espacio:
           `.sp-edit-cierre{` y `.sp-edit-cierre {` son el mismo selector y el
           patrón de la primera versión solo veía el segundo, así que la
           inyección que le ponía `font-size` salió VERDE (v1029). Y se
           compara contra el tamaño del CUERPO, no contra un número escrito
           acá, para que subir la escala del módulo no deje esto mintiendo. */
        ['y su letra no es más chica que la del cuerpo', (function () {
          const css = leer('css/70-seguimiento.css');
          const cuerpo = (css.match(/\.sp-edit-txt\s*\{[^}]*font-size:\s*var\(--t-(\d)\)/) || [])[1];
          const cierre = (css.match(/\.sp-edit-cierre\s*\{[^}]*font-size:\s*var\(--t-(\d)\)/) || [])[1];
          const h = (css.match(/\.sp-edit-cierre-h\s*\{[^}]*font-size:\s*var\(--t-(\d)\)/) || [])[1];
          /* La escala es al revés: --t-9 es MÁS chico que --t-7. */
          return !!cuerpo && !!h && Number(h) <= 8 && (cierre === undefined || Number(cierre) <= Number(cuerpo));
        })()],
        ['el enlace al texto completo sale solo desde la corta', /if \(!larga\) \{[\s\S]{0,260}sp-edit-mas/.test(j70v)],
        ['y un pintor solo para los dos textos', (j70v.match(/function bloqueEditorial\(/g) || []).length === 1 &&
         /bloqueEditorial\(true\)/.test(j70v) && /bloqueEditorial\(false\)/.test(j70v)]
      ];
      const malEd = mitadesEd.filter((x) => !x[1]).map((x) => x[0]);
      comprobar('y el cierre «lo que no esperaba» va visible, al mismo nivel y sin plegar',
        malEd.length === 0,
        malEd.length ? 'falla: ' + malEd.join(' · ')
          : 'lo pinta la misma función que el cuerpo, en el mismo bloque y sin <details>, así que una ' +
            'tanda futura no lo puede mandar a un desplegable sin romper esto');

      comprobar('y el editorial no alimenta ningún eje ni ningún indicador',
        !/analisisEditorial/.test((j70v.match(/function ejeB\([\s\S]*?\n  \}/) || [''])[0] +
                                  (j70v.match(/function indicadoresDe\([\s\S]*?\n  \}/) || [''])[0]) &&
        !/editorialDe\(/.test((j70v.match(/function veredictoGeneral\([\s\S]*?\n  \}/) || [''])[0]),
        'ni los ejes ni los indicadores ni el veredicto lo leen: es capa 4 y el dictamen sería el mismo ' +
        'si el editorial no existiera');
    }

    /* ═══ I-06 ES UNA TASA SOBRE LO REVISADO, Y NO ALIMENTA UN EJE HASTA SU
           UMBRAL DE COBERTURA (v1124) ═════════════════════════════════════
       La v1123 retiró la afirmación «el Gobierno no respondió» y con ella
       dejó a I-06 sin fuente escribible. El usuario autorizó cambiar lo que
       cuenta —a «posición oficial buscada y no hallada», que es simétrico y
       comprobable— con DOS condiciones, y esta guarda es cada una de ellas:

       (a) SE PUBLICA COMO TASA SOBRE LO REVISADO, con su cobertura en el
           MISMO renglón. «1 de 46» y «1 de 243» son juicios muy distintos
           sobre lo mismo, y sin la cobertura al lado no se pueden separar.

       (b) NO ALIMENTA EL EJE B hasta pasar su umbral. Con una parte del
           registro revisada, la tasa mide nuestro RITMO DE TRABAJO y no al
           Gobierno: revisar cien entradas más la haría saltar sin que
           cambiara nada afuera.

       Y EL UMBRAL NO PUEDE ESTAR TALLADO, que es lo que el usuario pidió
       comprobar. Tres mitades, y la tercera es la que lo impide:
       la mitad es un BORDE DEGENERADO —el punto exacto donde lo no revisado
       deja de poder mandar sobre la tasa—, va con su razón escrita en el
       código, y **el sesgo por conveniencia se declara y no se calcula**, así
       que la segunda condición falla cerrado (v880): mientras los lotes se
       escojan por dónde era fácil hallar la posición, ninguna cobertura
       alcanza.

       DE QUÉ NO RESPONDE (v945): de que el 0,5 sea el mejor umbral posible
       —es el borde donde la propiedad cambia, no un óptimo—, y de que la
       declaración de sesgo sea cierta, que no lo puede comprobar nadie
       (v1008). Comprueba que el umbral esté escrito con su razón, que la
       lista del eje salga de él, y que la cobertura llegue a la pantalla.

       VA EN ROJO (v970, v1097): mide CÓDIGO, no material del registro. */
    {
      const umb = (j70v.match(/var UMBRAL_I06 = \{[\s\S]*?\n  \};/) || [''])[0];
      const mitadesU = [
        ['el umbral existe con su razón escrita', !!umb && /porQue:/.test(umb) && /cobertura: 0\.5/.test(umb)],
        /* La frase se busca DENTRO de un literal (v1097): «el borde exacto
           donde lo no revisado deja de poder mandar» está cortada por el
           `' +` de la concatenación, y un patrón que cruza dos literales
           mide cómo quedó partida la línea y no el contenido. */
        ['y nombra el borde degenerado, no un número escogido',
         /La mitad no es un n[uú]mero escogido/.test(umb) && /es el borde exacto donde/.test(umb)],
        ['y la segunda condición —el sesgo por conveniencia— va declarada aparte',
         /ySinSesgo:/.test(umb) && /lotes de fuente com[uú]n/.test(umb)],
        ['y el sesgo se DECLARA, no se calcula, así que falla cerrado',
         /var sesgo = true;/.test(j70v)]
      ];
      const malU = mitadesU.filter((x) => !x[1]).map((x) => x[0]);
      comprobar('el umbral de cobertura de I-06 está escrito, con su razón y su segunda condición',
        malU.length === 0,
        malU.length ? 'falla: ' + malU.join(' · ')
          : 'la mitad con su razón de borde degenerado, el sesgo por conveniencia declarado aparte, ' +
            'y el sesgo como declaración y no como cálculo — así ninguna cobertura lo abre sola');

      /* LA LISTA DEL EJE SALE DEL UMBRAL (clase B): si la condición viviera
         escrita en un sitio y aplicada en otro, se separarían. */
      const armaB = (j70v.match(/function indEjeB\(c1\) \{[\s\S]*?\n  \}/) || [''])[0];
      const sale = !!armaB && /cob\.alimenta \? IND_EJE_B_BASE\.concat\(\['I-06'\]\)/.test(armaB) &&
                   !/var IND_EJE_B = \[/.test(j70v);
      comprobar('y la lista del eje B sale de ese umbral, no de una constante con I-06 dentro',
        sale,
        !armaB ? 'no se encontró indEjeB(c1)'
          : /var IND_EJE_B = \[/.test(j70v) ? 'quedó la constante vieja con I-06: dos codificaciones de la regla'
          /* El detalle dice QUÉ mitad falló (v973, v1051). Sin este renglón,
             una lista que concatena I-06 sin preguntar por el umbral salía
             con el texto del verde impreso estando en rojo — la octava vez de
             esa familia, y la cazó la inyección y no la lectura. */
          : !/cob\.alimenta \? IND_EJE_B_BASE\.concat\(\['I-06'\]\)/.test(armaB)
            ? 'la lista no consulta el umbral: I-06 entra pase lo que pase con la cobertura'
          : 'I-06 entra solo cuando `coberturaI06` dice que alimenta');

      /* LA GUARDA DE LA GUARDA (v878): que la cobertura y el piso LLEGUEN a
         la pantalla, y que el eje diga que I-06 existe y no lo usa. Sin esto
         las dos condiciones del usuario quedan incumplidas en silencio — que
         es el defecto que el papel encontró en esta misma tanda. */
      const mitadesP6 = [
        ['la razón se pinta siempre que exista, no solo en `sinCalcular`',
         /if \(fi\.razon\) mid\.appendChild/.test(j70v)],
        ['la cobertura va en el MISMO renglón que la cifra',
         /' · cobertura ' \+/.test(j70v) && /' exigibles'/.test(j70v)],
        ['la tasa se declara PISO mientras el muestreo sea por conveniencia',
         /es un PISO: lo revisado se escoge por lotes de fuente/.test(j70v)],
        ['por qué no alimenta su eje va en renglón propio',
         /if \(fi\.porQueNoAlimenta\) mid\.appendChild/.test(j70v)],
        ['y el eje dice que existe un indicador que no usa',
         /retenidos: ind\.filas\.filter/.test(j70v) &&
         /existe, se calcula y este eje NO lo usa todav[ií]a/.test(j70v)]
      ];
      const malP6 = mitadesP6.filter((x) => !x[1]).map((x) => x[0]);
      comprobar('y la cobertura, el piso y el «existe y no lo uso» LLEGAN a la pantalla',
        malP6.length === 0,
        malP6.length ? 'falla: ' + malP6.join(' · ')
          : 'las cinco: la razón sin depender de `sinCalcular`, la cobertura pegada a la cifra, el ' +
            'piso con su causa, el porqué del eje en renglón propio, y el retenido calculado de la ' +
            'resta —así un indicador nuevo que quede fuera aparece sin que su autor se acuerde');

      /* Y QUE I-06 CUENTE `noHallado` Y NO `ausente`: sin esto el indicador
         vuelve a quedarse sin fuente escribible, que es el pendiente que
         nadie puede bajar por octava vez. */
      comprobar('y I-06 cuenta lo que SÍ se puede declarar, no la afirmación retirada',
        /'I-06': c1\.contra\.noHallado/.test(j70v) &&
        /t: 'Posici[oó]n oficial buscada y no hallada'/.test(j70v),
        /'I-06': c1\.contra\.ausente/.test(j70v)
          ? 'sigue contando `ausente`, que ya no es declarable: un pendiente que nadie puede bajar'
          : !/t: 'Posici[oó]n oficial buscada y no hallada'/.test(j70v)
            ? 'el indicador no se renombró: su título sigue afirmando algo sobre el Gobierno'
            : 'cuenta `noHallado`, y su título dice que habla de la búsqueda y no de la conducta');
    }

    /* ═══ «BUSCADO Y NO HALLADO» NO ES «NO RESPONDIÓ» (v961, v1123) ════════
       La regla, dicha por el usuario y citada: *«no hallado», nunca «no
       respondió». Lo primero es un hecho sobre nuestra búsqueda. Lo segundo
       es una afirmación sobre la conducta del Gobierno, y no la podemos
       hacer: puede haber respondido en un canal que no miramos.*

       La v961 ya exigía la CONSTANCIA —dónde y cuándo—. La constancia estaba
       bien; lo que estaba mal era lo que respaldaba: `ausente` publicaba «El
       Gobierno no respondió». Esta guarda tiene TRES mitades que no se
       implican:

       1 · ESTRUCTURAL, en rojo: el módulo ya no publica esa afirmación. Mide
           CÓDIGO, así que no puede vaciarse por una mejora de los datos.
       2 · LOS TRES CAMPOS, en rojo: el estado no se declara sin dónde, cuándo
           y QUÉ se buscó. El tercero es el que la v961 no pedía, y es el que
           separa una búsqueda de un gesto: sin saber qué se preguntó, «no se
           halló» no dice nada.
       3 · MATERIAL, con `?` y no en rojo (v970, v1097): que HAYA alguna
           entrada en ese estado lo ponen los DATOS, y que no haya ninguna es
           el estado bueno —querría decir que toda posición oficial se halló—.
           Un rojo ahí pondría la salida barata en dejar entradas sin buscar.

       DE QUÉ NO RESPONDE (v945): de que la búsqueda declarada se haya hecho
       de verdad, que no lo puede comprobar nadie (v1008); y de I-06, que
       sigue contando `ausente` a propósito — ascender un «no hallado» a I-06
       sería recuperar por la puerta de atrás la afirmación retirada. */
    {
      const noPubl = !/t: 'El Gobierno no respondi[oó]'/.test(j70v);
      const hayEstado = /estado: 'no-hallado', t: 'Buscado y no hallado'/.test(j70v);
      const niegaConducta = /NO sobre la conducta del Gobierno/.test(j70v);
      const malE = [];
      if (!noPubl) malE.push('sigue publicando «El Gobierno no respondió»');
      if (!hayEstado) malE.push('no existe el estado «Buscado y no hallado»');
      if (!niegaConducta) malE.push('el estado no dice que NO habla de la conducta del Gobierno');
      comprobar('el módulo NO afirma que el Gobierno no respondió: afirma que no se halló',
        malE.length === 0,
        malE.length ? 'falla: ' + malE.join(' · ')
          : 'el estado es «Buscado y no hallado», dice que es un hecho sobre la búsqueda y no sobre ' +
            'la conducta del Gobierno, y la afirmación contraria ya no se publica');

      /* LOS TRES CAMPOS, exigidos en el código y no de palabra. */
      const tramoC = (j70v.match(/if \(v && typeof v === 'object' && \(v\.noHallado \|\| v\.ausente\)\) \{[\s\S]*?\n    \}/) || [''])[0];
      const pideTres = /fu\.length && ff && fq/.test(tramoC) &&
                       /v\.busco/.test(tramoC) && /v\.fecha/.test(tramoC) && /v\.que/.test(tramoC);
      comprobar('y no se declara sin los TRES campos: dónde, cuándo y qué se buscó',
        !!tramoC && pideTres,
        !tramoC ? 'no se encontró la rama de «no hallado»'
          : !pideTres ? 'acepta el estado sin alguno de los tres campos: una búsqueda sin constancia no ' +
                        'se distingue de no haber buscado'
          : 'los tres se exigen juntos, y lo que falte se nombra uno por uno en el detalle');

      /* Y QUE LLEGUE A LA PANTALLA (v878): sin este renglón, el estado es
         documentación y la entrada se sigue viendo como una sin revisar. */
      /* Se mide la PROPIEDAD y no la redacción (v890, v935): que el renglón
         nuevo viaje con su cuenta, que el viejo viaje marcado `cero: true`
         —sin eso el pintor lo esconde y el texto de abajo, que dice «ese
         renglón está en cero y se deja a la vista», queda mintiendo— y que
         el pintor respete esa marca. Las tres juntas, porque cualquiera de
         las tres sola deja el cero invisible. */
      const mitadesP = [
        ['el renglón nuevo viaja con su cuenta', /t: 'Buscado y no hallado', n: c1\.contra\.noHallado/.test(j70v)],
        ['el de «no respondió» viaja marcado para pintarse en cero',
         /n: c1\.contra\.ausente, cero: true/.test(j70v)],
        ['y el pintor de la fila respeta esa marca', /if \(!p\.n && !p\.cero\) return;/.test(j70v)]
      ];
      const malP = mitadesP.filter((x) => !x[1]).map((x) => x[0]);
      comprobar('y el estado LLEGA a la fila de la Capa 1, con el cero de «no respondió» a la vista',
        malP.length === 0,
        malP.length ? 'falla: ' + malP.join(' · ')
          : 'los dos renglones se pintan: el nuevo con su cuenta, y el viejo en cero y visible, ' +
            'para que se vea que el módulo PUDO decirlo y decidió no decirlo (v1064, v970)');

      /* EL MATERIAL, con `?`: su cero es el estado BUENO. */
      /* Los dos registros se leen ACÁ y no se toman de otro bloque: la v1116
         y la v1090 costaron una corrida cada una por usar una variable de un
         bloque vecino, y un ReferenceError mata el resumen entero. */
      const regNH = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
      const regNHa = JSON.parse(leer('assets/data/seguimiento-petro.json'));
      const nh = [], nhMal = [];
      [['actual', regNH], ['anterior', regNHa]].forEach(([q, rg]) => {
        ((rg || {}).entradas || []).forEach((e) => {
          const c = e.contrargumentoOficial;
          if (!c || typeof c !== 'object' || !(c.noHallado || c.ausente)) return;
          const ok = (c.busco || []).filter((x) => String(x || '').trim()).length &&
                     String(c.fecha || '').trim() && String(c.que || '').trim();
          (ok ? nh : nhMal).push(q + '/' + (e.id || '?'));
        });
      });
      if (!nh.length && !nhMal.length) {
        anotarSinMaterial('MATERIAL · entradas con la posición oficial buscada y no hallada',
          'ninguna entrada lo declara hoy, y ese es el estado BUENO: querría decir que toda posición ' +
          'oficial buscada se halló. Las reglas de arriba se miden contra el código y siguen mordiendo');
      } else {
        comprobar('MATERIAL · toda entrada «no hallada» trae su constancia completa',
          nhMal.length === 0,
          nhMal.length ? 'sin los tres campos: ' + nhMal.join(' · ')
            : nh.length + (nh.length === 1 ? ' entrada declara su búsqueda con dónde, cuándo y qué: '
                                           : ' entradas declaran su búsqueda con dónde, cuándo y qué: ') +
              nh.join(' · '));
      }
    }
    /* LA GUARDA DE LA GUARDA (v878): que el módulo use el denominador
       exigible en los DOS sitios donde cuenta —el casillero y la puerta de
       I-06—, que la exención NO pueda escribirse como una regla de código, y
       que las eximidas lleguen a la pantalla. */
    /* ATADOS A UNA FUNCIÓN, no copiados (v879, v1109). Estaban en tres sitios
       y se separaron en la misma tanda que los escribió: la fila de la Capa 1
       publicaba «233 de 255» mientras el casillero decía «233 de 251». La
       guarda exige la función Y que ninguna copia sobreviva. */
    const hayFn = /function exigiblesContra\(c1\)/.test(j70v);
    const usos = (j70v.match(/exigiblesContra\(c1\)/g) || []).length;
    const copias = (j70v.match(/c1\.n - c1\.contra\.noAplica/g) || []).length;
    const usaExigible = hayFn && usos >= 4 && copias === 0;
    const porEntrada = /e && e\._sinReprocheAlGobierno/.test(j70v);
    /* SE APRIETA, NO SE AFLOJA (v1117). La guarda buscaba el rótulo literal
       «Sin reproche al Gobierno», y la v1117 lo partió en dos causas con sus
       nombres. Lo que pide ahora es más fuerte que el literal: que la fila se
       CONSTRUYA recorriendo `CAUSA_SIN_REPROCHE`, de modo que una causa nueva
       aparezca en la pantalla sin que su autor se acuerde (v867, v1091). */
    const llegaExim = /Object\.keys\(CAUSA_SIN_REPROCHE\)\.map/.test(j70v) &&
                      /ninguna entrada está eximida de la cuenta/.test(j70v);
    comprobar('y el módulo cuenta sobre el denominador exigible, exime por ENTRADA y lo publica',
      usaExigible && porEntrada && llegaExim,
      !usaExigible ? (copias ? copias + ' copia(s) del cálculo del denominador fuera de `exigiblesContra`: ' +
                        'tres sitios contando lo mismo ya se separaron una vez'
                      : !hayFn ? 'desapareció `exigiblesContra`, así que el denominador vuelve a estar copiado'
                      : 'alguno de los tres recuentos dejó de usar la función, y el pendiente vuelve a ' +
                        'incluir lo que nadie puede bajar')
      : !porEntrada ? 'la exención dejó de leerse de la entrada: si se calcula con una regla del código, ' +
                      'exime doscientas de una vez y deja de costar trabajo'
      : !llegaExim ? 'las eximidas no llegan a la pantalla, o falta la redacción de cero: una exención ' +
                     'callada se lee igual que un aprobado'
      : 'cuenta sobre los exigibles en los dos sitios, lee la exención de cada entrada, y publica el ' +
        'recuento de eximidas con sus dos redacciones');

    /* ═══ LAS DOS CAUSAS DE LA EXENCIÓN, APARTE (v899, v1117) ══════════════
       La v1109 eximió a las entradas en las que el Gobierno es el ACUSADOR.
       Bajando por las que faltaban apareció una causa distinta: entradas en
       las que **no acusa nadie** —un atentado de un grupo armado cuyo
       contrapunto dice que los medios no coinciden en el número de heridos—.
       Sumadas en un solo renglón se leen como una sola cosa, y dicen cosas
       distintas: la primera, sobre lo que el Gobierno hace; la segunda,
       sobre qué clase de hecho se registró.

       DE QUÉ NO RESPONDE (v945, v952, v1008): de que la causa esté bien
       elegida. Comprueba que la causa esté DECLARADA en la tabla, que la
       tabla del código y la de acá sean la misma (v926), y que cada causa
       llegue a la pantalla por construcción y no por un rótulo escrito a
       mano — para que una causa nueva aparezca sin que su autor se acuerde. */
    const CAUSAS_SR = ['gobierno-acusador', 'sin-reproche-al-ejecutivo'];
    const conCausa = {}; let causaMala = 0;
    ((regAct1109.entradas) || []).forEach((e) => {
      const v = (e && e._sinReprocheAlGobierno) || null;
      if (!v) return;
      const c = (typeof v === 'object') ? String(v.causa || '').trim() : '';
      if (CAUSAS_SR.indexOf(c) >= 0) conCausa[c] = (conCausa[c] || 0) + 1;
      else causaMala++;
    });
    const tablaOK = CAUSAS_SR.every((c) => new RegExp("'" + c + "': \\{ t:").test(j70v));
    comprobar('la tabla de causas de la exención del código y la de esta comprobación son la misma',
      tablaOK,
      tablaOK ? 'las ' + CAUSAS_SR.length + ' causas están declaradas en `CAUSA_SIN_REPROCHE` con su ' +
                'rótulo y su lectura'
        : 'faltan en el código: ' + CAUSAS_SR.filter((c) => !new RegExp("'" + c + "': \\{ t:").test(j70v)).join(', ') +
          ' — el convenio escrito acá y el aplicado allá se separaron');
    comprobar('y toda eximida declara una causa que la tabla conoce',
      causaMala === 0,
      causaMala === 0
        ? (exim.length ? 'las ' + exim.length + ' la declaran: ' +
            CAUSAS_SR.map((c) => (conCausa[c] || 0) + ' ' + c).join(' · ')
          : 'no hay ninguna eximida, y la regla muerde el día que aparezca la primera')
        : causaMala + ' con una causa que la tabla no conoce, o sin causa: una exención cuya causa no ' +
          'se puede leer es gratis, y gratis es exactamente lo que no puede ser');

    /* ═══ ¿ESTÁ TERMINADO? SE CONTESTA, NO SE CUENTA (v1107) ═══════════════
       La v1098 dejó el control publicando el estado del módulo y escribió al
       lado, en prosa, que parte de lo que falta no depende de nadie acá. Esa
       frase era documentación: en la pantalla los cinco rojos se leían IGUAL
       —volumen de archivo, un documento que el proxy niega, una decisión de
       quien firma, una capacidad por escribir—, y son cuatro cosas que piden
       acciones opuestas. Un recuento no contesta «¿está terminado?».

       FALLA CERRADO (v880): el trámite se le exige a TODOS los casilleros y no
       solo a los que hoy fallan, porque uno que hoy pasa puede fallar mañana y
       aparecería sin trámite. Un abierto sin clasificar lo denuncia el propio
       control, con su estado `sin-clasificar`.

       DE QUÉ NO RESPONDE (v945, v952): de que el trámite sea el correcto ni de
       que la clasificación sea honesta — un casillero de archivo marcado como
       «fuera del alcance» es la salida barata y ninguna guarda la puede ver
       (v1008). Lo que se comprueba es que ESTÉ, que el tipo sea de los
       declarados, que el estado se CALCULE y que llegue a la pantalla. */
    const CIERRA_OK = /var CIERRA = \{/.test(j70v);
    const TIPOS = ['archivo-aqui', 'fuera-del-alcance', 'quien-firma', 'capacidad', 'hecho-de-afuera'];
    const cajas = j70v.match(/caja\(\s*'/g) || [];
    /* SE MIDE EL ARGUMENTO, NO EL TOKEN EN TODO EL ARCHIVO (v1029, v1107).
       Contar apariciones del tipo contaba también las cinco de la tabla
       `CIERRA` y las de la pantalla, así que sobraban de largo: una inyección
       que dejaba un casillero en `null` la dejó en VERDE. Lo que falta no era
       la inyección — era lo que la aserción medía. Ahora cuenta el ARGUMENTO,
       con su sangría, que es como lo escribe la llamada. */
    const conCierre = (j70v.match(new RegExp("\\n         '(" + TIPOS.join('|') + ")',\\n", 'g')) || []).length;
    comprobar('MATERIAL · el control tiene casilleros y una tabla de quién los cierra',
      cajas.length >= 18 && CIERRA_OK,
      !CIERRA_OK ? 'no existe la tabla `CIERRA`: no habría con qué clasificar'
        : cajas.length + ' casilleros y la tabla de cierre declarada');
    comprobar('y cada casillero declara con cuál de los tipos se cierra',
      cajas.length >= 18 && conCierre >= cajas.length,
      conCierre < cajas.length
        ? 'hay ' + cajas.length + ' casilleros y solo ' + conCierre + ' cierres declarados: el que falte ' +
          'saldría en pantalla sin trámite, que se lee como que nadie sabe qué hacer con él'
        : 'los ' + cajas.length + ' llevan su tipo de cierre, de los ' + TIPOS.length + ' declarados');
    /* LA GUARDA DE LA GUARDA (v878), en sus tres mitades: que el estado del
       módulo se CALCULE y no se teclee, que estén escritas TODAS sus
       redacciones —incluida la de «no queda nada», que es la que hace falta el
       día que llegue (v970)—, y que el trámite LLEGUE a la pantalla. */
    const calcula = /var estado = sinCierre\.length \? 'sin-clasificar'/.test(j70v) &&
                    /abiertos\.forEach/.test(j70v);
    /* SE MIDE POR CONTENIDO, NO CONTANDO EL TOKEN (v935). Contar apariciones
       del id medía cómo quedó escrito el `if`, no que la redacción exista: el
       estado al que se llega por descarte aparece UNA vez y pasaba por
       faltante. Lo que tiene que estar es la FRASE que cada estado publica. */
    const redacciones = [
      /no declaran quién puede cerrarlo/, /No queda ningún casillero abierto/,
      /Queda trabajo que una sesión de acá puede hacer/,
      /Nada de lo que falta lo puede cerrar una sesión de acá/
    ].every((r) => r.test(j70v));
    const llega = /sp-c4-fin/.test(j70v) && /cb2\.appendChild\(mb\)/.test(j70v) &&
                  /sp-c4-cctr/.test(j70v) && /SIN TRÁMITE DECLARADO/.test(j70v);
    comprobar('y el estado del módulo se calcula, tiene sus cuatro redacciones y llega a la pantalla',
      calcula && redacciones && llega,
      !calcula ? 'el estado del módulo dejó de calcularse sobre los casilleros abiertos: un estado escrito ' +
                 'a mano es una afirmación que nadie vuelve a medir (v903, v1098)'
      : !redacciones ? 'falta una de las cuatro redacciones; la de «no queda nada» es justo la que hace ' +
                       'falta el día que el módulo llegue ahí, y sin ella el renglón desaparecería'
      : !llega ? 'el bloque no se engancha a la pantalla, o el trámite no se pinta: el reparto sería un ' +
                 'dato que ninguna superficie alcanza, que es la clase C'
      : 'se calcula repartiendo los abiertos por quién puede cerrarlos, con sus cuatro redacciones, y se ' +
        'pinta con el trámite de cada casillero abierto');

    /* ═══ EL BORRADOR DEL MARCO NO CIERRA EL CASILLERO (v1107) ═════════════
       Los supuestos de valor del módulo estaban aplicados en su código y no
       había superficie donde un lector los viera: clase C en el sitio donde
       más importa, porque lo que se esconde ahí no es un dato sino un juicio.
       Publicarlos como BORRADOR lo cierra sin fingir nada — pero la tentación
       de la tanda siguiente es obvia y por eso va una guarda: **que el
       borrador cuente como declaración y ponga el casillero en verde.** Firmar
       es la decisión de quien pone su nombre, y ningún texto derivado la
       reemplaza. */
    const regAct1107 = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const marcoB = (regAct1107.marcoBorrador || {});
    const sup = Array.isArray(marcoB.supuestos) ? marcoB.supuestos : [];
    const supMal = sup.filter((x) => !String((x && x.s) || '').trim() ||
                                     !String((x && x.deDonde) || '').trim());
    comprobar('MATERIAL · el módulo publica un borrador de sus supuestos de valor',
      sup.length > 0,
      sup.length + (sup.length === 1 ? ' supuesto en el borrador' : ' supuestos en el borrador'));
    comprobar('y cada supuesto dice de qué regla del módulo sale',
      sup.length > 0 && !supMal.length,
      !sup.length ? 'no hay borrador: lo dice la de arriba'
        : supMal.length
          ? supMal.length + (supMal.length === 1 ? ' supuesto sin su regla nombrada'
                                                 : ' supuestos sin su regla nombrada') +
            ': un supuesto sin origen es un valor inventado, que es lo contrario de lo que el borrador hace'
        : 'los ' + sup.length + ' nombran la regla del módulo de la que salen');
    const noCierra = /completo: !!\(sup\.length && m\.autor && m\.fecha\)/.test(j70v) &&
                     !/completo:[^\n]*borrador/.test(j70v);
    const pintaB = /sp-c4-borr/.test(j70v) && /s4\.appendChild\(bb\)/.test(j70v) &&
                   /BORRADOR · sin firmar/.test(j70v);
    comprobar('y el borrador NO cuenta como marco declarado, y se rotula como borrador',
      noCierra && pintaB,
      !noCierra ? '`completo` empezó a contar el borrador: un texto derivado no es una firma, y con eso el ' +
                  'casillero pasaría a verde sin que nadie haya declarado nada'
      : !pintaB ? 'el borrador no llega a la pantalla o perdió su rótulo: sin el rótulo primero se lee ' +
                  'como el marco firmado, que es justo lo que no es'
      : '`completo` sigue pidiendo supuestos firmados con autor y fecha, y el borrador se pinta rotulado');

    /* ═══ MIRAR LOS CASOS QUE CAYERON (v1106) ══════════════════════════════
       `probado = revisadas >= 20 && disparos === 0` preguntaba dos cosas con
       una cuenta, y en cuanto un criterio disparaba se quedaba sin poder
       contestar ninguna: la marca `construida-para-el-caso` no había trabajo
       que la quitara. **Un pendiente que nadie puede bajar** es la señal que
       este proyecto ya tiene escrita tres veces (v999, v1075, v1088).

       Las dos propiedades son independientes y ninguna implica la otra:
       disparar sobre un registro escrito ANTES demuestra que los bordes no se
       dibujaron mirando este caso; RECHAZAR demuestra que distingue. Un
       criterio anchísimo que dispare en todo cumpliría la primera y ninguna
       otra, y esa es la salida barata que estas guardas cierran.

       DE QUÉ NO RESPONDE (v945, v952, v1008): de que el veredicto de cada
       disparo sea CIERTO. Comprueban que ESTÉ escrito, que cubra TODOS los
       disparos, que traiga su razón, y que el módulo exija las tres cosas
       antes de dar por validado un criterio que disparó. */
    const revD = regAnt._revisionDeDisparos || {};
    const casosRev = Array.isArray(revD.casos) ? revD.casos : [];
    const disparosReales = [];
    entAnt.forEach((e) => {
      ((e && e.indicadores) || []).forEach((k) => { disparosReales.push(k + '·' + (e.id || '«sin id»')); });
    });
    const revPorClave = {};
    casosRev.forEach((c) => { if (c) revPorClave[c.criterio + '·' + c.entrada] = c; });
    const sinRevisar = disparosReales.filter((k) => !revPorClave[k]);
    const revSinRazon = casosRev.filter((c) => !String((c && c.porQue) || '').trim() ||
                                               !String((c && c.veredicto) || '').trim() ||
                                               !String((c && c.via) || '').trim());
    const VERED = { 'hecho-buscado': 1, 'cauce-normal': 1 };
    const revVeredictoRaro = casosRev.filter((c) => !VERED[(c && c.veredicto) || '']);
    comprobar('MATERIAL · el registro anterior tiene disparos que revisar',
      disparosReales.length > 0,
      disparosReales.length + (disparosReales.length === 1 ? ' disparo' : ' disparos') + ' sobre el registro anterior');
    comprobar('y cada disparo está revisado, con su vía, su veredicto y su razón',
      disparosReales.length > 0 && !sinRevisar.length && !revSinRazon.length && !revVeredictoRaro.length,
      !disparosReales.length ? 'no hay disparos: lo dice la de arriba'
      : sinRevisar.length ? sinRevisar.length + (sinRevisar.length === 1 ? ' disparo sin revisar: ' : ' disparos sin revisar: ') +
                            sinRevisar.slice(0, 4).join(' ')
      : revSinRazon.length ? revSinRazon.length + (revSinRazon.length === 1 ? ' caso revisado' : ' casos revisados') +
                             ' sin vía, sin veredicto o sin razón escrita'
      : revVeredictoRaro.length ? 'hay un veredicto que no es de los dos conocidos: ' +
                                  revVeredictoRaro.map((c) => String(c.veredicto)).join(' ')
      : 'los ' + disparosReales.length + ' revisados, cada uno con su vía, su veredicto y su razón');
    /* LA GUARDA DE LA GUARDA (v878), en sus cuatro mitades: que el módulo LEA
       la revisión, que exija las TRES condiciones antes de validar por
       disparo, que publique las dos propiedades POR SEPARADO, y que la
       revisión LLEGUE a la pantalla — sin lo último sería un dato que ninguna
       superficie alcanza, estrenando la clase C en la tanda que lo produjo. */
    const leeRev = /_revisionDeDisparos\b/.test(j70v);
    const exigeTres = /rechazos > 0 &&/.test(j70v) && /rev && rev\.completa/.test(j70v) &&
                      /rev && rev\.cauceNormal\.length/.test(j70v);
    const dosProps = /noTalladoAlCaso: noTallado/.test(j70v) && /distingue: distinguePorDisparo/.test(j70v) &&
                     /validado: noTallado && \(distinguePorDisparo \|\| probados > 0\)/.test(j70v);
    const pintaRev = /sp-c2-rev/.test(j70v) && /lv\.appendChild\(rc\)/.test(j70v);
    comprobar('y el módulo la lee, exige las tres condiciones, separa las dos propiedades y la pinta',
      leeRev && exigeTres && dosProps && pintaRev,
      !leeRev ? '`js/70` dejó de leer `_revisionDeDisparos`: la de arriba vigilaría un bloque que nadie consume'
      : !exigeTres ? 'validar por disparo dejó de exigir las tres —que rechace, que la revisión esté ' +
                     'completa y que ninguno sea el cauce normal—, así que un criterio anchísimo que ' +
                     'dispare en todo se validaría solo'
      : !dosProps ? 'las dos propiedades volvieron a una sola bandera —o `validado` dejó de exigir las ' +
                    'dos—, y no disparar sobre otro registro es justamente lo que haría un criterio ' +
                    'tallado a la medida del propio: validar con eso es validar con la evidencia contraria'
      : !pintaRev ? 'la revisión no llega a la pantalla: el trabajo que valida el criterio sería un dato ' +
                    'que ninguna superficie alcanza'
      : 'la lee, exige las tres, publica «no tallado al caso» y «distingue» aparte, y pinta la revisión ' +
        'caso por caso');

    /* ═══ EL TERCER RESULTADO DE CORRER UN CRITERIO (v1101) ════════════════
       Correr los criterios da TRES resultados y hasta acá tenía forma para
       dos: la entrada cae en una vía, o no cae en ninguna y lleva la lista
       vacía con su razón. El tercero lo encontró el Decreto 0639 de 2025 —la
       consulta popular convocada por decreto y suspendida—: un hecho
       documentado que no cae en ninguno porque el UNIVERSO del criterio no lo
       contempla, no porque el criterio lo haya mirado y lo descarte.

       Dentro de la lista vacía los dos últimos se leen idénticos, y piden
       acciones distintas (v899): «lo miré y no aplica» no pide nada, y «el
       criterio no alcanza a este hecho» pide un criterio nuevo escrito contra
       referencia externa y ANTES de mirar el registro (v1077).

       DE QUÉ NO RESPONDE (v945, v952): no busca vacíos. Comprueba que los
       vacíos ESCRITOS estén completos, nombren una entrada que exista y no
       contradigan su propia entrada, y que las DOS redacciones —la de cero y
       la de N— estén escritas y lleguen a la pantalla. Un vacío que nadie
       notó no lo puede encontrar ninguna guarda, y eso va dicho en la propia
       pantalla. */
    const vcDecl = Array.isArray(regAnt._vaciosDeCriterio) ? regAnt._vaciosDeCriterio : [];
    const idsAnt = {};
    entAnt.forEach((e) => { if (e && e.id) idsAnt[e.id] = e; });
    const vcMal = vcDecl.filter((v) => {
      const e = idsAnt[v && v.entrada];
      return !e || ((e.indicadores || []).length > 0) ||
             !String((v && v.hecho) || '').trim() ||
             !String((v && v.porQueNingunoAplica) || '').trim() ||
             !String((v && v.queLoCERRARIA) || '').trim() ||
             !String((v && v.porQueNoSeCierraAhora) || '').trim();
    });
    comprobar('MATERIAL · el registro anterior declara algún vacío de criterio hallado al correr',
      vcDecl.length > 0,
      vcDecl.length + ' declarado(s): ' + vcDecl.map((v) => v.entrada).join(' '));
    comprobar('y cada vacío está completo y nombra una entrada que lo sostiene',
      vcDecl.length > 0 && vcMal.length === 0,
      !vcDecl.length ? 'no hay ninguno declarado: lo dice la de arriba'
        : vcMal.length ? vcMal.length + ' de ' + vcDecl.length + ' incompleto(s) o sobre una entrada ' +
            'que no existe o que SÍ declara indicador: ' + vcMal.map((v) => (v && v.entrada) || '«sin entrada»').join(' ')
        : (vcDecl.length === 1 ? 'el declarado trae hecho, por qué ninguno aplica, qué lo cerraría y por qué no '
            : 'los ' + vcDecl.length + ' traen hecho, por qué ninguno aplica, qué los cerraría y por qué no ') +
          (vcDecl.length === 1 ? 'se cierra acá, y su entrada existe y lleva la lista vacía'
            : 'se cierran acá, y sus entradas existen y llevan la lista vacía'));
    /* LA GUARDA DE LA GUARDA (v878), en sus tres mitades: que el módulo LEA el
       bloque, que escriba las DOS redacciones, y que el bloque LLEGUE a la
       pantalla. Sin la tercera, el vacío sigue siendo un dato que ninguna
       superficie alcanza, que es la clase C que esta tanda vino a cerrar. */
    const leeVacios = /_vaciosDeCriterio\b/.test(j70v);
    const dosRedacciones = /Un vacío que nadie notó no aparece acá/.test(j70v) &&
                           /no caben en NINGUNO de los criterios escritos/.test(j70v);
    /* Y la tercera mitad mide el ENGANCHE y no la construcción: la inyección
       que borró solo el `appendChild` dejó esta comprobación en verde con el
       bloque calculado y sin llegar a ninguna pantalla —que es exactamente la
       clase C que la tanda vino a cerrar—, así que lo que falta no era la
       inyección sino lo que la aserción medía (v1029). DE QUÉ NO RESPONDE: de
       que el bloque se VEA. Eso lo mediría una suite de navegador, y en este
       contenedor no corre ninguna. */
    const pintaVacios = /sp-c2-vacio/.test(j70v) && /textoDeVacios\(vcs\.length\)/.test(j70v) &&
                        /s2\.appendChild\(vx\)/.test(j70v);
    comprobar('y el módulo lee el bloque, escribe las dos redacciones y lo pinta',
      leeVacios && dosRedacciones && pintaVacios,
      !leeVacios ? '`js/70` dejó de leer `_vaciosDeCriterio`, así que la de arriba vigila un bloque ' +
                   'que nadie consume'
      : !dosRedacciones ? 'falta una de las dos redacciones: con una sola, el día que el vacío se cierre ' +
                          'el renglón desaparece y «ninguno» vuelve a leerse como «nadie lo ha mirado»'
      : !pintaVacios ? 'el bloque no llega a la pantalla de indicadores: el vacío volvería a ser un dato ' +
                       'que ninguna superficie alcanza'
      : 'lo lee, tiene la redacción de cero y la de N, y lo pinta en la Capa 2 de la ficha');

    /* ═══ I-05 NO CUENTA EL CONTROL AUTOMÁTICO (v1094) ═════════════════════
       El artículo 214.6 obliga al Ejecutivo a mandar el decreto de excepción
       a la Corte al día siguiente de expedirlo. Contar cada revisión
       automática como un choque institucional convertiría I-05 en sinónimo de
       «declaró una emergencia», que es lo que I-04 ya cuenta: dos
       codificaciones de un solo hecho (clase B de CLAUDE.md).

       La referencia va DENTRO del texto de la exclusión y no en el comentario
       de al lado, porque `soloCodigo` quita los comentarios y una guarda no
       puede comprobarla ahí (v926, v1077). Las dos mitades aparte, que es lo
       que dice qué falló cuando falla (v973, v1051). */
    const trozoI05 = (j70v.split("'I-05': {")[1] || '').split("'I-13'")[0];
    const sinComentar = soloCodigo(trozoI05);
    const hayExcl = /control autom[aá]tico de constitucionalidad de un decreto de excepci[oó]n/.test(trozoI05);
    const hayNorma = /214\.6/.test(sinComentar);
    comprobar('I-05 excluye el control automático de un decreto de excepción, con la norma donde se lee',
      !!trozoI05 && hayExcl && hayNorma,
      !trozoI05 ? 'no se encontró el criterio I-05'
        : !hayExcl ? 'I-05 volvió a contar el control automático del art. 214.6 como un choque: ' +
                     'cada decreto de emergencia contaría dos veces, en I-04 y en I-05'
        : !hayNorma ? 'la exclusión está y NO nombra el artículo en el texto —solo en un comentario—, ' +
                      'así que el lector de la ficha no lo ve'
        : 'excluido, y el art. 214.6 nombrado en el texto que la pantalla pinta');

    /* ═══ NINGÚN CAMPO DEL REGISTRO SE QUEDA SIN LECTOR (v1115) ════════════
       Veinticuatro hallazgos —un fallo revocado, una designación reversada,
       seis cifras precisadas— estaban escritos en el registro bajo TRECE
       claves distintas con guion bajo, y ninguna línea de código las leía.
       Desde afuera eso se ve exactamente igual que no haberlos encontrado,
       que es la clase C de CLAUDE.md, en el registro que este módulo
       publica sobre personas con nombre.

       Y trece nombres para una sola cosa es además la clase B: la cura es
       un campo, `revisionPosterior`, con el TIPO como dato.

       LA GUARDA PERSIGUE LA CLASE Y NO EL CASO (v874, v885): no busca los
       trece nombres —una lista así envejece hasta no significar nada
       (v895)—, busca la FORMA. Un campo con guion bajo es, por convenio de
       este registro, una nota que no es un dato publicable; si además
       ninguna línea de código lo nombra, nadie lo lee nunca.

       DE QUÉ NO RESPONDE (v945, v952): de que la nota sea cierta —eso no lo
       puede comprobar nadie (v1008)—, ni de los campos SIN guion bajo que
       tampoco tengan lector: perseguir «campo del registro que ninguna
       pantalla lee» daría docenas de falsos positivos, que es la razón por
       la que CLAUDE.md deja la clase C anotada y sin guarda. Esta muerde
       sobre el subconjunto en el que el convenio hace que el falso positivo
       no exista.

       Y UN LÍMITE MÁS, que va dicho porque es la puerta de atrás: «tener
       lector» se mide como que el nombre de la clave aparezca en el módulo
       o en esta misma comprobación. Las dos cuentan a propósito —hay claves
       que son material de una guarda y no de una pantalla, como
       `_pendientesFuente`—, pero eso deja abierto que alguien «cierre» una
       huérfana nombrándola dentro del texto de un fallo. No se puede cerrar
       sin una lista de excepciones que envejecería (v895), así que se
       declara en vez de taparse. */
    const REG1115 = ['assets/data/seguimiento-presidencial.json',
                     'assets/data/seguimiento-petro.json'];
    /* La única excepción, con su razón escrita (v895): `_comentario` es la
       nota de cabecera del archivo —dice cómo se edita el registro, no
       afirma ningún hecho—, así que no tiene por qué llegar a una pantalla. */
    const SIN_LECTOR_OK = [['_comentario', 'es la nota de cabecera del archivo sobre cómo se edita, ' +
                            'y no afirma ningún hecho que un lector deba ver']];
    /* SE BUSCA EN EL CÓDIGO Y NO EN LOS COMENTARIOS (v926, v1115). La
       primera versión de esta guarda miraba el archivo entero, y su propia
       inyección fiel la dejó a medias: tres de las ocho claves de la v1114
       aparecían en el comentario que acabo de escribir aquí arriba, así que
       contaban como «leídas». Un nombre citado en una explicación no es un
       lector. Cuando una inyección fiel no consigue poner algo en rojo, lo
       que falta no es la inyección — es lo que la aserción mide (v1029). */
    const rvr = soloCodigo(leer('pruebas/revisar.js'));
    const j70c = soloCodigo(j70v);
    const clavesBajas = {};
    REG1115.forEach((ruta) => {
      const dd = JSON.parse(leer(ruta));
      Object.keys(dd).filter((k) => k[0] === '_').forEach((k) => { clavesBajas[k] = (clavesBajas[k] || 0) + 1; });
      ((dd.entradas) || []).forEach((e) => {
        Object.keys(e || {}).filter((k) => k[0] === '_').forEach((k) => { clavesBajas[k] = (clavesBajas[k] || 0) + 1; });
      });
    });
    const todasBajas = Object.keys(clavesBajas).sort();
    const huerfanas = todasBajas.filter((k) => !SIN_LECTOR_OK.some((x) => x[0] === k))
                                .filter((k) => j70c.indexOf(k) < 0 && rvr.indexOf(k) < 0);
    /* EL `?` Y NO EL ROJO para el material (v970, v1097): que no quede
       ninguna clave con guion bajo es el estado BUENO, y una guarda que se
       pusiera roja al llegar a cero empujaría a dejar notas sueltas en el
       registro para tener algo que contar. Lo que va en rojo es la
       propiedad, que sobrevive al cero: ninguna huérfana. */
    if (!todasBajas.length) {
      anotarSinMaterial('MATERIAL · el registro trae campos con guion bajo',
        'los dos registros no traen ninguno, así que no hay sobre qué morder: la regla de abajo sigue ' +
        'valiendo y muerde el día que alguien escriba el primero');
    } else {
      comprobar('MATERIAL · el registro trae campos con guion bajo, que es donde vive la clase C',
        true, todasBajas.length + (todasBajas.length === 1 ? ' clave distinta: ' : ' claves distintas: ') +
        todasBajas.join(', '));
    }
    comprobar('y ninguna se queda sin un lector en el código',
      !huerfanas.length,
      huerfanas.length ? huerfanas.length + ' clave(s) que ninguna línea de código nombra —' +
          huerfanas.join(', ') + '—: lo escrito ahí no llega a ninguna pantalla, y desde afuera se ' +
          'lee igual que si nadie lo hubiera encontrado'
        : (todasBajas.length ? (todasBajas.length === 1 ? 'la única tiene lector' :
             'las ' + todasBajas.length + ' tienen lector') + ' —el módulo o esta misma ' +
            'comprobación, que para una clave de guarda es el lector correcto—, y la exenta lo ' +
            'está con su razón: ' + SIN_LECTOR_OK[0][0] + ' ' + SIN_LECTOR_OK[0][1]
          : 'no hay ninguna, y el día que aparezca una sin lector esta comprobación muerde'));

    /* Y UNA CLAVE NUMERADA A MANO ES LA MISMA CLASE B (v879, v1115).
       `_revisionCriterios` y `_revisionCriterios2` eran dos corridas en dos
       claves: la tercera habría sido `3`. Una lista es una lista. */
    const numeradas = todasBajas.filter((k) => /\d$/.test(k));
    comprobar('y ninguna clave del registro lleva un número de orden pegado al nombre',
      !numeradas.length,
      numeradas.length ? numeradas.join(', ') + ': eso es una lista escrita a mano, y la siguiente ' +
          'entrada nace sin lector porque nadie se acuerda de añadir el caso'
        : 'ninguna; las corridas de criterios viven en un array y no en claves numeradas');

    /* LA TABLA DE TIPOS, Y QUE EL CONVENIO ESCRITO Y EL APLICADO SEAN EL
       MISMO (v926). La lista va acá, al lado, porque una guarda que leyera
       los tipos del propio código no podría fallar nunca: comprobaría que la
       tabla es igual a sí misma. */
    const TIPOS_REV = ['precision', 'actualizacion', 'contradiccion', 'divergencia',
                       'comprobacion', 'intento', 'vacio', 'procedencia'];
    const enCodigo = TIPOS_REV.filter((t) => new RegExp('\\n    ' + t + ': \\{ t:').test(j70v));
    const notas = [];
    REG1115.forEach((ruta) => {
      const dd = JSON.parse(leer(ruta));
      ((dd.entradas) || []).forEach((e) => {
        (((e || {}).revisionPosterior) || []).forEach((v) => { notas.push(v); });
      });
    });
    const malTipo = notas.filter((v) => TIPOS_REV.indexOf(String((v || {}).que || '')) < 0);
    const sinTexto = notas.filter((v) => !String((v || {}).texto || '').trim());
    if (!notas.length) {
      anotarSinMaterial('MATERIAL · hay revisiones posteriores escritas',
        'ninguna entrada trae `revisionPosterior`, así que la tabla de tipos no se ejercita');
    } else {
      comprobar('MATERIAL · hay revisiones posteriores escritas, con su tipo',
        true, notas.length + ' hallazgo(s) en los dos registros');
    }
    comprobar('la tabla de tipos del código y la de esta comprobación son la misma',
      enCodigo.length === TIPOS_REV.length,
      enCodigo.length === TIPOS_REV.length
        ? 'los ' + TIPOS_REV.length + ' tipos están declarados en `TIPO_REVISION` con su texto y su lectura'
        : 'faltan en el código: ' + TIPOS_REV.filter((t) => enCodigo.indexOf(t) < 0).join(', ') +
          ' — el convenio escrito acá y el aplicado allá se separaron');
    comprobar('y toda revisión escrita lleva un tipo conocido y un texto',
      !malTipo.length && !sinTexto.length,
      malTipo.length ? malTipo.length + ' con un tipo que la tabla no conoce: ' +
          malTipo.map((v) => String(v.que || '(vacío)')).join(', ')
        : sinTexto.length ? sinTexto.length + ' con el tipo puesto y el texto en blanco, que no dice nada'
        : (notas.length ? 'los ' + notas.length + ' traen tipo conocido y texto'
                        : 'no hay ninguna, y la regla muerde el día que aparezca la primera'));

    /* LA GUARDA DE LA GUARDA (v878, v1029, v1101): que el bloque se
       CONSTRUYA no basta —una aserción que mide la construcción se queda en
       verde con el `appendChild` borrado, en verde sobre exactamente el
       defecto que vigila—. Se exige el ENGANCHE de las tres superficies: la
       ficha del hecho, el recuento de la Capa 1 y las corridas de criterios. */
    const engRev = /cc\.appendChild\(rb\)/.test(j70v);
    const engRec = /s1\.appendChild\(rd\)/.test(j70v);
    const engCor = /s2\.appendChild\(cx\)/.test(j70v);
    comprobar('y los tres bloques se ENGANCHAN al documento, no solo se arman',
      engRev && engRec && engCor,
      (engRev && engRec && engCor)
        ? 'la ficha del hecho, el recuento de la Capa 1 y las corridas de criterios se cuelgan de su ' +
          'sección: un bloque calculado y sin enganchar es el mismo dato que nadie alcanza'
        : 'sin enganchar: ' + [!engRev ? 'la ficha del hecho' : null, !engRec ? 'el recuento' : null,
                               !engCor ? 'las corridas' : null].filter(Boolean).join(', '));

    /* LAS DOS REDACCIONES, LA DE CERO Y LA DE N (v970, v1064). La de cero es
       la que no se puede escribir después: un renglón que desaparece al
       llegar a cero deja «ya está revisado» con la cara de «nadie lo ha
       mirado». */
    const ceroRev = /Ninguna entrada lleva todav[ií]a una revisi[oó]n posterior/.test(j70v);
    const ceroCor = /Los criterios NO se han corrido contra el registro del gobierno anterior/.test(j70v);
    const nRev = /hallazgo', 'hallazgos'\) \+ ' en '/.test(j70v);
    comprobar('y las dos redacciones están escritas, la de cero y la de N',
      ceroRev && ceroCor && nRev,
      (ceroRev && ceroCor && nRev)
        ? 'el recuento y las corridas tienen las dos: la de cero dice que nadie ha vuelto, y no que el ' +
          'registro esté comprobado'
        : 'falta: ' + [!ceroRev ? 'la de cero del recuento' : null, !ceroCor ? 'la de cero de las corridas' : null,
                       !nRev ? 'la de N del recuento' : null].filter(Boolean).join(', '));

    /* Y EL ESTADO DE HOY SE CALCULA, NO SE LEE DEL TEXTO DE LA CORRIDA
       (v903). Las cifras de cada corrida son las de su fecha —la de la v1087
       ya había envejecido—, así que al lado va una contada en cada carga. */
    const hoyCalc = /corridaHaciaAtras\(DA, 'I-04'\)/.test(j70v) && /Medido hoy sobre el registro anterior/.test(j70v);
    comprobar('y al lado de las corridas va el estado de HOY, contado y no escrito',
      hoyCalc,
      hoyCalc ? 'sale de `corridaHaciaAtras` en cada carga, así que no puede quedarse vieja como la de la v1087'
              : 'desapareció la medida de hoy: las cifras de una corrida son las de su fecha, y sin una ' +
                'contada al lado un lector no puede saber si siguen valiendo');
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

  /* ═══ UNA CIFRA DEL REGISTRO NO SE CONCATENA EN CRUDO (v1054) ══════
     Salió barriendo la ficha compuesta: «Monto: 282585333». El registro
     escribe `monto` de dos maneras —un NÚMERO en el caso del FENOGE y una
     cadena ya formateada («1.299 millones de pesos») en el de Nova— y el
     impresor los concatenaba igual, así que el número salía sin separador de
     miles, que en castellano es lo que vuelve ilegible una cifra grande
     (v885). No se arregla en el registro: ahí un número es una forma
     legítima del dato y lo escribe una rutina diaria que no lee esta
     bitácora. Se arregla en el ÚNICO sitio que lo imprime, que es donde no
     puede olvidarse —y de qué NO responde esta guarda va dicho: vigila el
     monto, no los demás campos del caso; los otros los escribe el registro
     como prosa ya formateada. */
  {
    const j70m = soloCodigo(leer('js/70-seguimiento.js'));
    const sitio = /'Monto: '\s*\+\s*([^;]{0,200})/.exec(j70m);

    /* MATERIAL · falla en ROJO y no con su `?`: es código servido, y que el
       impresor deje de pintar el monto no es una mejora del dato sino una
       regresión —la frontera que la v1026 dejó escrita—. */
    comprobar('MATERIAL · el impresor de casos pinta el monto', !!sitio,
      sitio ? 'lo pinta, y se puede leer con qué lo formatea'
            : 'NO PUDO CORRER: no se encontró el sitio que imprime el monto, así que lo de abajo no vigila nada');

    if (sitio) {
      const pasa = /miles\s*\(/.test(sitio[1]);
      comprobar('la cifra del monto pasa por el formateador, no se concatena en crudo', pasa,
        pasa ? 'un número sale con su separador de miles'
             : 'se concatena en crudo: un monto numérico saldría «Monto: 282585333»');

      const dist = /typeof\s+c\.monto\s*===\s*'number'/.test(sitio[1]);
      comprobar('y distingue el número de la cadena ya formateada', dist,
        dist ? 'una cadena se imprime tal cual y no se vuelve a formatear'
             : 'formatearía también la cadena, y «1.299 millones de pesos» saldría «NaN»');
    }

    /* La guarda de la guarda: sin esto, todo lo de arriba seguiría en verde
       sobre un formateador que dejó de poner el separador. */
    /* La firma y no la línea: `function miles(n)` literal se puso roja en la
       v1055 al añadirle sus decimales, que es un cambio legítimo (v890). Lo
       que tiene que seguir siendo cierto es que escriba en castellano. */
    const mil = /function miles\(n[^)]*\)\s*\{([\s\S]{0,320}?)\n  \}/.exec(j70m);
    const esCO = !!mil && /toLocaleString\('es-CO'/.test(mil[1]);
    comprobar('y el formateador sigue escribiendo la cifra en castellano', esCO,
      esCO ? "miles() sigue pasando por toLocaleString('es-CO')"
           : 'miles() dejó de escribir en es-CO: el monto volvería a salir sin separador');
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
    /* Los dos lados se LEEN del archivo: cuántas funciones de eje declara el
       módulo, y cuántas devuelve `ejesDe`. Escribir el número acá sería
       comprobar que la guarda es igual a sí misma. */
    const ejesDeclarados = [...j70c3.matchAll(/function (eje[A-Z])\s*\(/g)].map((m) => m[1]);
    /* DENTRO del `return [...]` y no en el tramo entero: el tramo trae el
       comentario que explica la regla, y ahí los nombres de los ejes salen
       nombrados. Contarlos ahí dio nueve de cuatro en la v1055. */
    const devuelve = (tramoEjes.match(/return \[([^\]]*)\]/) || ['', ''])[1];
    const ejesEnLista = [...devuelve.matchAll(/(eje[A-Z])\s*\(/g)].map((m) => m[1]);
    comprobar('los ejes no se combinan en un número único',
      /* La FORMA y no la línea: `return [ejeA(dd), ejeB(dd, corte), ejeC()];`
         literal era la constante del código metida dentro de la comprobación
         (v890), y se puso roja en la v1055 por añadir un cuarto eje, que es
         un cambio legítimo. Lo que tiene que seguir siendo cierto es que
         devuelva una LISTA con todos los ejes que el módulo declara. */
      tramoEjes.length > 0 && !promedia && ejesEnLista.length === ejesDeclarados.length &&
        ejesDeclarados.every((f) => ejesEnLista.indexOf(f) >= 0),
      !tramoEjes.length ? 'no se encontró el tramo de los ejes: la comprobación no vale'
                        : (promedia ? 'hay algo que los suma o los promedia'
                          : (ejesEnLista.length !== ejesDeclarados.length
                             ? 'ejesDe devuelve ' + ejesEnLista.length + ' de los ' + ejesDeclarados.length +
                               ' ejes que el módulo declara: el que falta no se pinta en ninguna parte'
                             : 'ejesDe devuelve los ' + ejesEnLista.length + ' en una lista')));

    /* Y la otra mitad de la regla de oro: los ejes son Capa 3 y el veredicto
       es de otra cosa. Ninguno puede entrar en el cálculo de los techos. */
    const tramoVer = (j70c3.match(/var techos = \{[\s\S]*?(?=\n\s*\/\* El recuento de la Capa 1)/) || [''])[0];
    /* La lista sale de las funciones de eje que el módulo declara, más
       `ejesDe`: escrita a mano se habría quedado vieja con el cuarto eje y la
       guarda seguiría en verde vigilando tres de cuatro. */
    const sucio = ejesDeclarados.concat(['ejesDe']).filter((k) => tramoVer.indexOf(k) >= 0);
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
       de arriba seguiría en verde sobre unas funciones que nadie llama. */
    comprobar('y la ficha pinta los ejes',
      /ejesDe\(D, f\.corte\)/.test(j70c3),
      'la ficha los compone');

    /* ── v1055 · NINGÚN EJE DECLARA FALTAR LO QUE EL REGISTRO TRAE ──────
       El eje C decía «el módulo no tiene ninguna de esas cifras» sobre un
       registro que trae el reparto por sector deflactado desde la v972, con
       su IPC del DANE, su corte y sus fuentes. Es la sexta declaración de
       ausencia falsa de este proyecto (v861, v863, v864, v884, v888) y la
       primera del módulo presidencial — y era clase A y clase C a la vez:
       el dato estaba en el MISMO registro que los otros dos ejes reciben,
       `ejeC()` no recibía ni el parámetro, y ninguna superficie lo alcanzaba.

       La guarda falla CERRADO: un eje que no lea el registro sale en rojo en
       su primera corrida, en vez de tres tandas después. */
    const firmas = [...j70c3.matchAll(/function (eje[A-Z])\s*\(([^)]*)\)/g)]
      .map((m) => ({ id: m[1], args: m[2].trim() }));
    const ciegos = firmas.filter((f) => !f.args);
    comprobar('todo eje recibe el registro, y no declara faltar lo que el registro trae',
      firmas.length > 0 && ciegos.length === 0,
      !firmas.length ? 'NO PUDO CORRER: no se encontró ninguna función de eje'
        : (ciegos.length
            ? ciegos.map((f) => f.id).join(', ') + ' no recibe el registro, así que no puede saber ' +
              'qué trae: es como el eje C afirmó durante 83 versiones que no tenía cifras que sí tenía'
            : 'los ' + firmas.length + ' lo reciben'));

    /* Y la mitad que lo hace comprobable: el eje C tiene que leer el bloque
       que el registro trae. Sin esto la firma sería decorativa — recibir el
       parámetro y no mirarlo se lee igual desde fuera. */
    const tramoC = (j70c3.match(/function ejeC\(dd\) \{[\s\S]*?\n  \}/) || [''])[0];
    const leeC = /\.presupuesto/.test(tramoC) && /sectores/.test(tramoC) && /realPct/.test(tramoC);
    comprobar('y el eje C lee el reparto por sector que el registro trae',
      tramoC.length > 0 && leeC,
      !tramoC.length ? 'NO PUDO CORRER: no se encontró el cuerpo del eje C'
        : (leeC ? 'lo lee del registro: `presupuesto.sectores` con su variación real'
                : 'no lo lee: volvería a declarar que no tiene unas cifras que el registro sí trae'));

    /* Que publique sus cifras NO puede convertirse en publicar un nivel. Las
       dos reglas que faltan son de fuente —el ejecutado y la serie de los
       gobiernos anteriores— y el pliego las pone como condición de validez:
       el nivel se calcula, no se asigna. */
    comprobar('y el eje C publica sus cifras sin publicar un nivel',
      /nivel: null, publicable: false/.test(tramoC) &&
      /EJECUTADO/.test(tramoC) && /gobiernos anteriores/.test(tramoC),
      'el nivel queda en null y la razón nombra las dos reglas que faltan');

    /* ── EL EJE D YA PUBLICA NIVEL (v1088) — y la comprobación se hace
       MÁS PRECISA, no más laxa.

       La de la v1055 exigía que NO lo publicara, y su razón era buena para
       lo que entonces se sabía: no había criterio escrito, y uno redactado
       mirando este registro nacería construido para el caso. Eso cambió —
       I-14 existe desde la v1077 con sus bordes tomados de instrumentos
       anteriores a este proyecto— así que la aserción falla por un cambio
       legítimo y aflojarla sería perder la prueba entera.

       Lo que se mide ahora es la propiedad que de verdad importaba detrás de
       aquella: que el nivel se CALCULE y no se asigne. Cuatro mitades:

         · la escala está escrita y nombra su referencia EXTERNA donde el
           lector la ve, no en un comentario (v926);
         · su umbral es PRESTADO y no escrito para esta pregunta (v882, v1075);
         · el nivel sale de contar y vuelve a null sin material, porque cero
           medido no es cero ocurrido (v875);
         · y declara SOBRE QUÉ evidencia descansa (v1085). */
    const tramoD = (j70c3.match(/function ejeD\(dd\) \{[\s\S]*?\n  \}/) || [''])[0];
    const escD = (j70c3.match(/var ESCALA_EJE_D = \{[\s\S]*?\n  \};/) || [''])[0];
    const nivD = (j70c3.match(/function nivelEjeD\(mue, F, reg\) \{[\s\S]*?\n  \}\n/) || [''])[0];
    const mitD = [
      ['la escala del eje D está escrita, aparte del eje', escD.length > 0],
      /* SE APRIETA, NO SE AFLOJA (v1118). La aserción pedía el artículo 135
         del Código Penal, y esa referencia se RETIRÓ porque era una
         calificación penal que este módulo no puede hacer: Medicina Legal
         confirma muertes y edades, no confirma que alguien sea «persona
         protegida», que es una categoría del DIH que determina un juez. La
         aserción pide ahora la referencia que SÍ corresponde —el deber de
         investigar— y, además, lo que la anterior no pedía: que ningún
         texto del eje nombre un tipo penal. */
      ['y nombra su referencia externa donde el lector la ve',
       /Protocolo de Minnesota/.test(escD) && /Principios B[áa]sicos/.test(escD)],
      ['y declara en la propia escala qué NO mide', /queNOMide:/.test(escD) &&
       /no dice que esas muertes sean/i.test(escD)],
      ['y declara que su categoría es preexistente, no construida acá',
       /origenCategoria: 'juridica-preexistente'/.test(escD)],
      ['y dice de dónde tomó PRESTADO su umbral', /umbralPrestadoDe:/.test(escD)],
      /* v1090: el nivel ya no se arma a mano en el eje — lo arma
         `nivelDeEje`, que le pone el NOMBRE del peldaño y su LECTURA en este
         eje. La aserción se hace más precisa: ya no mide la forma del objeto
         literal, mide que el eje pase por la función y le dé la lectura de
         su propio corte. */
      ['el nivel se CALCULA de las muertes confirmadas', /function nivelEjeD/.test(j70c3) &&
       /r\.nivel = nd\.nivel[\s\S]{0,120}nivelDeEje\(nd\.nivel, nd\.corte && nd\.corte\.d/.test(tramoD)],
      ['y no se publica sin su lectura por eje',
       /r\.publicable = !!\(r\.nivel && r\.nivel\.lectura\)/.test(tramoD)],
      /* SE APRIETA (v1121): la v1121 juntó las dos salidas en un bloque
         común, así que el `return` literal cambió. La aserción pide ahora
         las DOS cosas que importan: que siga volviendo a null, y que
         distinga las dos razones de cero —sin material, o con material que
         no pasa la puerta—, que piden acciones contrarias (v899). */
      ['y vuelve a null sin material, no al peldaño bueno',
       /if \(!n\) \{[\s\S]{0,900}nivel: null/.test(nivD) &&
       /porNoPublicar: nSinPuerta \? 'puerta-de-evidencia' : 'sin-material'/.test(nivD)],
      ['y aplica al bloque `fuerza` la MISMA puerta de evidencia que el indicador',
       /EVIDENCIA_DURA\[b\.tipoEvidencia\]/.test(nivD) && /sinPuerta\.push/.test(nivD)],
      ['y declara sobre qué evidencia descansa', /descansaEn:/.test(nivD)],
      /* LO QUE ACOTA EL NÚMERO VIAJA CON ÉL (v867, v1088, v1118): la
         respuesta del Gobierno y el estado procesal estaban en el
         contrapunto de dos entradas, y la placa que publica la cifra no los
         alcanzaba — clase C en el sitio donde el módulo califica en público
         a una persona. */
      ['y la respuesta del Gobierno viaja con el nivel', /contraOficial:/.test(nivD) &&
       /sinContra:/.test(nivD)],
      ['y el estado procesal también, con su redacción de cuando falta',
       /procesal:/.test(nivD) && /sinProcesal:/.test(nivD)],
      /* Sobre el CÓDIGO y no sobre los comentarios (v926): mi propio
         comentario cita la frase vieja para explicar por qué se corrigió, y
         la aserción cruda tropezaba con ella. `soloCodigo` deja las cadenas
         y quita los comentarios, que es exactamente la distinción que hace
         falta acá. */
      ['y la razón del eje ya no dice que el nivel dependa de la serie',
       !/un nivel no sale/.test(soloCodigo(tramoD)) && /no necesita contra/.test(tramoD)]
    ];
    /* ═══ NINGÚN TEXTO DEL EJE D CALIFICA PENALMENTE UN HECHO (v1118) ═════
       Hasta la v1117 la escala de este eje estaba escrita contra el
       **artículo 135 del Código Penal —homicidio en persona protegida—**, y
       sus textos de pantalla contaban «muertes de persona protegida
       confirmadas por autoridad forense». Eso encadenaba hecho forense →
       tipo penal → dictamen público **sin investigación, sin imputación y
       sin fallo**, y el artículo 135 es un crimen de guerra.

       El defecto de fondo: Medicina Legal confirma MUERTES y EDADES. No
       confirma que alguien sea «persona protegida», que es una categoría del
       Derecho Internacional Humanitario y depende de si la persona
       participaba directamente en hostilidades — lo determina un juez. Y hay
       contrargumento registrado: el Ministerio de Defensa invoca «función
       continua de combate». Puede perder, pero existe.

       El hecho se sostiene solo. La etiqueta penal era lo único refutable.

       LA GUARDA PERSIGUE LA CLASE Y NO EL CASO (v874, v885): no busca el
       artículo 135, busca **cualquier tipo penal o calificación de
       responsabilidad en los textos del eje que salen a pantalla**. Y se
       busca sobre el CÓDIGO y no sobre los comentarios (v926): el comentario
       que explica por qué se retiró cita la frase vieja a propósito, y una
       aserción cruda tropezaría con ella — que es exactamente la trampa que
       la v1116 pagó con un patrón sin su entorno.

       DE QUÉ NO RESPONDE (v945, v952): de los otros ejes. El eje B nombra
       artículos de la Constitución y el C el artículo 350, y eso es correcto
       —son normas de competencia y de prioridad del gasto, no tipos penales—.
       Esta guarda cubre el eje que cuenta muertes, que es donde la etiqueta
       penal califica a una persona. */
    const PENAL_PROHIBIDO = [
      ['persona protegida', 'es la categoría del DIH que define el tipo penal, y la determina un juez'],
      ['C[óo]digo Penal', 'nombrar el Código Penal es calificar el hecho como delito'],
      ['homicidio', 'es un tipo penal'],
      ['crimen', 'afirma que el hecho es un crimen, que es lo que decide un juez'],
      ['tipifica', 'tipificar es exactamente la operación que este módulo no puede hacer'],
      ['falso positivo', 'es una calificación de responsabilidad, no un hecho forense']
    ];
    const textoD = soloCodigo(escD) + '\n' + soloCodigo(nivD);
    const penalD = PENAL_PROHIBIDO.filter((p) => new RegExp(p[0], 'i').test(textoD));
    comprobar('ningún texto del eje D que sale a pantalla califica penalmente el hecho',
      escD.length > 0 && penalD.length === 0,
      !escD.length ? 'NO PUDO CORRER: no se encontró la escala del eje D'
        : penalD.length
          ? penalD.length + ' calificación(es) penal(es) de vuelta en los textos del eje: ' +
            penalD.map((p) => '«' + p[0] + '» — ' + p[1]).join(' · ') +
            '. El hecho —menores muertos en operaciones militares, con confirmación forense— se ' +
            'sostiene solo; la etiqueta penal es lo único que se puede tumbar.'
          : 'los textos cuentan un HECHO: ' + PENAL_PROHIBIDO.length + ' etiquetas penales vigiladas ' +
            'y ninguna presente. Lo que el eje NO mide va dicho en la propia escala y llega a la placa.');

    /* Y LA GUARDA DE LA GUARDA (v878, v1029, v1101): que lo que acota el
       número se ENGANCHE a la placa, no solo que se calcule. Un bloque
       construido y sin colgar deja el número publicado solo, que es el
       defecto entero. */
    const engQN = /placa\.appendChild\(el\('p', 'sp-fi-vlim'/.test(j70c3);
    /* SE APRIETA (v1121). La v1121 sacó el pintado a UNA función, llamada
       desde los dos sitios —el eje que manda y el eje que NO publica—, así
       que el `placa.appendChild(cb)` literal ya no está. La aserción pide
       ahora lo que de verdad importa y es más fuerte: que la función exista,
       que se cuelgue de su destino, y que se llame TAMBIÉN para los ejes que
       no fijan peldaño — que es el caso en el que el hecho desaparecería. */
    const engCO = /\(dest \|\| placa\)\.appendChild\(cb\)/.test(j70c3) &&
                  /mandan\.forEach\(pintarLoQueAcota\)/.test(j70c3) &&
                  /pintarLoQueAcota\(h, hb\)/.test(j70c3);
    const viajaU = /queNOMide: \(e\.nivelCalc/.test(j70c3) && /contraOficial: \(e\.nivelCalc/.test(j70c3);
    comprobar('y lo que acota el número llega a la placa, enganchado y viajando con el veredicto',
      engQN && engCO && viajaU,
      (engQN && engCO && viajaU)
        ? 'qué no mide, la respuesta del Gobierno y el estado procesal viajan dentro de `usados` y se ' +
          'cuelgan de la placa: un eje nuevo que publique nivel los hereda sin que su autor se acuerde'
        : 'falta: ' + [!viajaU ? 'viajar con el veredicto' : null, !engQN ? 'el enganche de «qué no mide»' : null,
                       !engCO ? 'el enganche de la respuesta del Gobierno' : null].filter(Boolean).join(', '));

    /* ═══ NINGUNA BASE ALIMENTA UN EJE SIN DECLARAR SU EVIDENCIA (v1121) ══
       Medido el 14 de octubre de 2026: de las tres bases del bloque
       `fuerza`, **dos no declaraban `tipoEvidencia`**. No les costaba nada,
       porque el eje contaba con su propia vara y no miraba ese campo — y un
       camino que no mira el campo es **peor que uno laxo: es ciego**. Un
       campo sin declarar y un campo declarado débil se leían igual, y solo
       el segundo se puede discutir.

       Va en ROJO y no con `?`: el bloque puede quedarse sin material
       legítimamente, y para eso está la línea de arriba; lo que no puede
       pasar nunca es que una base que SÍ está no declare de qué clase es su
       prueba.

       DE QUÉ NO RESPONDE (v945, v952): de que la clase declarada sea la
       correcta. Eso lo decide quien escribe la entrada mirando sus fuentes.
       Comprueba que ESTÉ y que la base exista en el registro. */
    const reg1121 = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const porId1121 = {};
    ((reg1121.entradas) || []).forEach((e) => { if (e && e.id) porId1121[e.id] = e; });
    const basesF = [].concat(((reg1121.fuerza || {}).menoresMuertos) || [],
                             ((reg1121.fuerza || {}).menoresRecuperados) || [],
                             ((reg1121.fuerza || {}).fueraDelConteo) || []);
    const sinBase = basesF.filter((m) => !porId1121[m && m.base]);
    const sinClase = basesF.filter((m) => {
      const b = porId1121[m && m.base];
      return b && (b.tipoEvidencia === undefined || b.tipoEvidencia === null || b.tipoEvidencia === '');
    });
    if (!basesF.length) {
      anotarSinMaterial('MATERIAL · el bloque `fuerza` trae operaciones con su base',
        'el bloque está vacío hoy, así que no hay ninguna base que mirar; la regla de abajo muerde el ' +
        'día que vuelva a haber una');
    } else {
      comprobar('MATERIAL · el bloque `fuerza` trae operaciones con su base',
        true, basesF.length + ' operacion(es) con `base` declarada');
    }
    comprobar('y ninguna base alimenta el eje sin declarar su clase de evidencia',
      !sinBase.length && !sinClase.length,
      sinBase.length ? sinBase.length + ' operacion(es) cuya entrada base NO está en el registro: ' +
          sinBase.map((m) => m.base || '(sin base)').join(' · ') + ' — una cifra apoyada en una ' +
          'entrada que no existe no se puede ir a comprobar'
        : sinClase.length ? sinClase.length + ' base(s) sin `tipoEvidencia`: ' +
            sinClase.map((m) => m.base).join(' · ') + '. La puerta de evidencia del eje no tiene qué ' +
            'mirar, y un camino que no mira el campo es peor que uno laxo: es ciego'
        : (basesF.length ? 'las ' + basesF.length + ' declaran su clase de evidencia y su base está en ' +
            'el registro, así que la puerta las puede evaluar una por una'
          : 'no hay ninguna, y la regla muerde el día que aparezca la primera'));

    /* Y LA UNIFICACIÓN MISMA: que el eje use la MISMA puerta que el
       indicador que nombra el mismo hecho. Dos varas para un hecho es la
       clase B, y el dictamen salía de la menos exigente — un control que el
       dictamen puede rodear no es un control. */
    const mismaPuerta = /EVIDENCIA_DURA\[b\.tipoEvidencia\]/.test(nivD);
    const i14Dura = /requiere: function \(c\) \{[\s\S]{0,200}EVIDENCIA_DURA\[c\.evidencia\.id\]/.test(
      (j70c3.split("'I-14': {")[1] || '').split('\n  };')[0]);
    comprobar('y el eje D mide con la MISMA puerta de evidencia que su indicador',
      mismaPuerta && i14Dura,
      (mismaPuerta && i14Dura)
        ? 'las dos leen `EVIDENCIA_DURA`: el eje no puede publicar un peldaño sobre una prueba que su ' +
          'propio indicador rechaza'
        : !i14Dura ? 'el indicador I-14 dejó de exigir evidencia dura, así que ya no hay vara alta que igualar'
        : 'el eje volvió a contar con su propia vara: un control que el dictamen puede rodear no es un control');

    const malD = mitD.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('el eje D publica nivel CALCULADO, con su escala contra referencia externa y su umbral prestado',
      tramoD.length > 0 && malD.length === 0,
      !tramoD.length ? 'NO PUDO CORRER: el eje D no existe, así que el uso de la fuerza no lo mide nada ' +
                       'y ninguna pantalla lo dice'
        : malD.length ? 'falla: ' + malD.join(' · ')
        : 'el nivel sale de contar contra una escala escrita antes y afuera, con el umbral de la ' +
          'cuenta de corrupción, y declara su evidencia');

    /* Y EL PISO LLEGA A LA PLACA CON SU BASE (v1088). Lo vio el papel: la
       placa publicaba el peldaño más grave de la escalera sin un dato al
       lado, y el dato estaba calculado dos pantallas adentro — clase C en el
       sitio más caro del módulo, que es el juicio público sobre una persona
       con nombre. Y se arma de los ejes que PUSIERON el piso, así que un eje
       nuevo lo hereda sin que su autor se acuerde (v867). */
    const plD = [
      ['la placa dice de dónde sale el piso', /'De dónde sale: ' \+ deDonde\.join/.test(j70c3)],
      /* v1092 · MÁS PRECISA, no más laxa. Con un solo eje publicando daba
         igual de qué lista saliera; con tres, la placa concatenaba las
         lecturas de los tres bajo un titular al que solo UNO corresponde —las
         otras dos eran las definiciones de otros peldaños presentadas como si
         fueran la de este—. Así que ahora se exige que salga de los que
         PUSIERON el peldaño, y que los otros se nombren en vez de callarse. */
      ['y lo arma de los ejes que PUSIERON el peldaño, no de todos',
       /var mandan = \(vg\.usados \|\| \[\]\)\.filter/.test(j70c3) &&
       /var deDonde = mandan\.map/.test(j70c3)],
      ['y los otros ejes que publican se nombran, no se callan',
       /sp-fi-votros/.test(j70c3) && /no fija el '/.test(j70c3)],
      ['y dice aparte sobre qué evidencia descansa', /sp-fi-vbase sp-fi-vbase-2/.test(j70c3)],
      ['y la clase tiene regla en el css', /\.sp-fi-vbase\{/.test(leer('css/70-seguimiento.css'))]
    ];
    const malPl = plD.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('y el piso LLEGA a la placa diciendo de qué sale y sobre qué descansa',
      malPl.length === 0,
      malPl.length ? 'falla: ' + malPl.join(' · ')
        : 'el peldaño no se publica solo: va con las muertes que lo producen y con la clase de ' +
          'evidencia que lo sostiene');

    /* Y la cifra que hace comprobable el «no lo resume» de la placa: cuánto
       del registro queda fuera de TODOS los ejes. Sin ella, un lector no
       tiene manera de saber que el 97 % de los hechos —los bombardeos, las
       muertes confirmadas, los desplazamientos— no entra en ningún nivel.
       Se calcula del registro (v903) y lleva sus dos redacciones (v970). */
    const cuentaD = /hechosDelMandato\(reg\)/.test(tramoD) && /indicadores \|\| \[\]/.test(tramoD);
    comprobar('y cuenta del registro los hechos que ningún eje recoge',
      cuentaD,
      cuentaD ? 'sale de hechosDelMandato y baja sola a medida que el registro se clasifica'
              : 'dejó de contarlo del registro: la cifra se quedaría vieja o desaparecería');

    const placaD = /ejeFuerza/.test(j70c3) && /no los mide ning\u00fan eje|no los mide ningún eje/.test(j70c3);
    comprobar('y la placa la publica, con sus dos redacciones',
      placaD && /Todos los hechos registrados de este mandato alimentan/.test(j70c3),
      placaD ? 'la placa la publica, y la otra redacción está escrita para el día que llegue a cero'
             : 'la placa no la publica: la exención volvería a ser silenciosa (v966)');

    /* ── El eje D publica su CIFRA sin publicar nivel (v1062) ────────────
       La v1057 lo dejó medido: «como el C publica sus recortes desde la
       v1055: el registro ya trae seis menores muertos con confirmación de
       Medicina Legal. No pide fuente nueva, pide contar lo que ya está.»

       Lo que hay que guardar no es la cifra: es DE DÓNDE sale. Medido, un
       barrido por palabras del título devuelve 33 entradas y mezcla los 331
       muertos del terremoto con las muertes en operaciones del Estado, así
       que su cifra contaría víctimas de un sismo como muertes en
       operaciones. Por eso las cifras salen de un bloque ESTRUCTURADO del
       registro —como el eje C lee `presupuesto` y no las menciones
       presupuestales de la línea de tiempo— y cada renglón trae su `base`,
       el id de la entrada que lo documenta (v964), y su `confirma`. */
    const regF = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
    const F = regF.fuerza || {};
    const filasF = [...(F.menoresMuertos || []), ...(F.menoresRecuperados || [])];
    const idsF = new Set((regF.entradas || []).map(e => e.id).filter(Boolean));
    const porId = {};
    (regF.entradas || []).forEach(e => { if (e.id) porId[e.id] = e; });

    const dosListas = (F.menoresMuertos || []).length > 0 && (F.menoresRecuperados || []).length > 0;
    comprobar('MATERIAL · el bloque `fuerza` del registro se deja leer, con sus dos listas',
      filasF.length >= 2 && dosListas,
      filasF.length >= 2 && dosListas
        ? filasF.length + ' renglones en dos listas separadas'
        : 'NO PUDO CORRER: ' + (F.menoresMuertos || []).length + ' renglón(es) de muertos y ' +
          (F.menoresRecuperados || []).length + ' de recuperados, así que la comprobación de que ' +
          'las dos listas no se confunden pasaría sin nada que mirar');

    /* La base es obligatoria y tiene que EXISTIR: una cifra sobre menores
       muertos que apunte a una entrada que el registro no tiene es una cifra
       que no se puede abrir, y es la falta que la v964 cerró para los
       indicadores —allá el acto estaba cierto y no registrado, y el
       indicador contaba 1 sobre nada—. */
    const sinBaseF = filasF.filter(f => !f.base || !idsF.has(f.base));
    comprobar('todo renglón del bloque nombra una entrada que existe',
      filasF.length > 0 && !sinBaseF.length,
      !filasF.length ? 'sin renglones que mirar'
        : (sinBaseF.length
            ? sinBaseF.length + ' no se pueden abrir: ' +
              sinBaseF.map(f => f.op + ' → «' + (f.base || '(sin base)') + '»').join(' · ')
            : 'las ' + filasF.length + ' apuntan a una entrada del registro'));

    /* Y la entrada base tiene que ser VERIFICADA. Un piso forense apoyado en
       una declaración de una parte no es un piso: es la afirmación de esa
       parte con una cifra delante, y este módulo publica cifras sobre
       muertes de menores. */
    const baseFloja = filasF.filter(f => porId[f.base] && porId[f.base].tipoFuente !== 'verificado');
    comprobar('y la entrada que la documenta está verificada',
      filasF.length > 0 && !baseFloja.length,
      !filasF.length ? 'sin renglones que mirar'
        : (baseFloja.length
            ? baseFloja.length + ' se apoyan en una entrada no verificada: ' +
              baseFloja.map(f => f.base + ' (' + porId[f.base].tipoFuente + ')')
                      .filter((v, i, a) => a.indexOf(v) === i).join(' · ')
            : 'las ' + filasF.length + ' se apoyan en una entrada verificada')); 

    /* Quién confirmó. Sin ese campo, «seis menores muertos» es un
       señalamiento sin respaldo —exactamente lo que la v961 le exigió al
       contrargumento `ausente` con su constancia de búsqueda— y encima las
       dos listas dejan de distinguirse: lo que las separa no es la cifra,
       es que una se apoya en confirmación forense y la otra en el reporte
       de la operación. */
    const sinConf = filasF.filter(f => !f.confirma || String(f.confirma).trim().length < 12);
    comprobar('y dice quién lo confirmó, que es lo que separa las dos listas',
      filasF.length > 0 && !sinConf.length,
      !filasF.length ? 'sin renglones que mirar'
        : (sinConf.length
            ? sinConf.length + ' sin decir quién confirma: ' + sinConf.map(f => f.op).join(' · ')
            : 'los ' + filasF.length + ' lo dicen, y el eje nunca suma las dos listas'));

    /* La que de verdad guarda: las cifras salen del BLOQUE y no de un
       barrido por el texto de las entradas. Un `filter` sobre el título o el
       detalle del eje D es el defecto entero —mezclaría el terremoto— y en
       el código se lee perfectamente bien. */
    const barridoD = /(titulo|detalle)[\s\S]{0,80}(test|match|indexOf|includes)/.test(tramoD);
    const bloqueD = /reg\.fuerza/.test(tramoD) && /menoresMuertos/.test(tramoD);
    comprobar('y la cifra sale del bloque, no de un barrido por el título',
      bloqueD && !barridoD,
      !bloqueD ? 'dejó de leer el bloque: volvería a no publicar ninguna cifra, o a sacarla de otro sitio'
        : (barridoD ? 'barre el texto de las entradas: un barrido por «muertos» mezcla los 331 muertos ' +
                      'del terremoto con las muertes en operaciones del Estado'
                    : 'lee reg.fuerza, como el eje C lee reg.presupuesto'));

    /* Publicar una cifra no es publicar un nivel, y el eje tiene que seguir
       sin publicarlo: un nivel pide un criterio, y escribirlo mirando este
       registro nacería construido para el caso (v965). */
    comprobar('y publicar la cifra no le da nivel',
      /nivel: null, publicable: false/.test(tramoD),
      /nivel: null, publicable: false/.test(tramoD)
        ? 'sigue sin nivel: la cifra es un conteo y no un criterio con incluye y excluye'
        : 'publica nivel: un conteo no da dictamen, y el nivel de un eje se calcula, no se asigna');

    /* El denominador honesto. «Seis menores muertos» sobre un registro con
       veinte hechos de operaciones se lee como el total de muertes, que es
       falso: los totales de cada operación no se reconcilian —Azarías fue 8,
       23, 24 y 20— así que el registro no los totaliza y lo dice. Es la
       regla del denominador de la v943 sobre una cifra de muertes. */
    const denF = (F.noTotaliza || '').length > 200 && (F.distingue || '').length > 200;
    const pintaF = /ej\.noTotaliza/.test(j70c3) && /ej\.distingue/.test(j70c3);
    comprobar('y el bloque dice qué NO totaliza y qué no se debe confundir, y el eje lo pinta',
      denF && pintaF,
      !denF ? 'el bloque no lo declara: la cifra se leería como el total de muertes en operaciones'
        : (pintaF ? 'las dos frases están en el bloque y las dos llegan a la pantalla'
                  : 'el eje no las pinta: estarían en el registro y ninguna pantalla las alcanzaría (clase C)'));

    /* Y las dos listas no se netean. Una recuperación no compensa una
       muerte, y restarlas publicaría una cifra que ninguna fuente sostiene.

       El prefijo de objeto va DENTRO del patrón, y no es un detalle: la vista
       lee sus campos como `ej.nMuertos`, así que un patrón que solo acepte
       los dos nombres pegados al signo no caza la forma que el código
       escribe de verdad —medido: con `ej.` en medio, la primera versión de
       esta guarda pasó en verde sobre la inyección—. Es la trampa de la
       v1019 y la v1020, y por eso lleva su caso de respuesta conocida. */
    const PRE = '(?:[A-Za-z_$][\\w$]*\\.)?';
    const RE_NETO = new RegExp(
      'n(?:Muertos|Recuperados)\\s*[-+]\\s*' + PRE + 'n(?:Recuperados|Muertos)\\b');
    const neto = RE_NETO.test(j70c3);
    comprobar('y las dos listas nunca se suman ni se restan entre sí',
      !neto,
      neto ? 'las netea: una recuperación no compensa una muerte, y la cifra no la sostiene nadie'
           : 'cada lista publica su propia cifra, con su propia calidad de evidencia');

    /* La guarda de la guarda: el patrón tiene que cazar el neteo COMO LO
       ESCRIBE la vista y dejar pasar los dos usos separados, que son los
       legítimos. Sin este caso, un patrón que no case nada deja la de arriba
       en verde para siempre (v878). */
    const cazaNeto = RE_NETO.test("'Saldo: ' + (ej.nMuertos - ej.nRecuperados)") &&
                     RE_NETO.test('var x = nMuertos + nRecuperados;');
    const callaSep = !RE_NETO.test("cn(ej.nMuertos, 'menor', 'menores')") &&
                     !RE_NETO.test('ej.nRecuperados, ej.opsRecuperados];');
    comprobar('y el patrón del neteo caza la forma que la vista escribe',
      cazaNeto && callaSep,
      !cazaNeto ? 'no caza «ej.nMuertos - ej.nRecuperados»: la de arriba quedaría en verde sobre el neteo'
        : (callaSep ? 'caza el neteo con y sin prefijo de objeto, y deja pasar los dos usos separados'
                    : 'denuncia los dos usos separados, que son los legítimos: daría rojo sobre lo que está bien'));

    /* MEDIR y NIVELAR son dos cosas, y al entrar el bloque la frase de la
       placa dejó de ser exacta: cuatro entradas que el eje D ahora SÍ cuenta
       seguían dentro de «no los mide ningún eje». Es la exención que deja de
       ser exacta porque algo mejoró (v966), y la cifra se queda vieja sola
       en cuanto el bloque crezca. Así que `sinEje` descuenta las entradas
       que el bloque cuenta, y la placa dice las DOS cosas: cuántos no los
       mide nadie, y que de los que sí se miden tampoco sale un nivel. */
    const descD = /bases\[e\.id\]/.test(tramoD) && /enFuerza/.test(tramoD);
    comprobar('y lo que ningún eje mide descuenta lo que este bloque ya cuenta',
      descD,
      descD ? 'descuenta por la base de cada renglón, así que la cifra baja sola cuando el bloque crece'
            : 'no lo descuenta: la placa diría que no mide unos hechos que el eje acaba de contar');

    const dosPl = /tampoco sale un nivel/.test(j70c3) &&
                  /de ninguno sale todav\u00eda un nivel|de ninguno sale todavía un nivel/.test(j70c3);
    comprobar('y la placa separa «no lo mide nadie» de «no sale un nivel», con sus dos redacciones',
      dosPl,
      dosPl ? 'dice las dos, y la redacción del día que no quede ninguno sin medir está escrita'
            : 'las junta: un hecho medido sin nivel se leería como un hecho que nadie mide');

    /* Y la nota del registro, que es lo ÚNICO que lee la rutina diaria que
       escribe las entradas: sin ella, una operación nueva con menores
       confirmados no entra al bloque y el eje se queda viejo sin que nada lo
       diga (v998). */
    const notaF = (F._nota || '');
    comprobar('y la nota del registro dice qué entra al bloque y qué no',
      notaF.length > 400 && /base/.test(notaF) && /confirm/i.test(notaF) && /barrido/i.test(notaF),
      notaF.length > 400 && /base/.test(notaF) && /confirm/i.test(notaF) && /barrido/i.test(notaF)
        ? 'nombra la base, quién confirma y por qué no se saca de un barrido'
        : 'sin explicarlo: una operación nueva con menores confirmados no entraría al bloque');
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
    /* UNO POR EJE, y no «tres»: el tres era el número de ejes de ese día
       metido dentro de la comprobación, y con el cuarto eje la guarda se
       puso roja por un cambio legítimo. Lo que tiene que seguir siendo
       cierto es que el marco declare lo que el módulo mide: un renglon por
       eje, ni uno de más. Los ejes se cuentan del propio archivo. */
    const nEjesDecl = [...j70c4.matchAll(/function eje[A-Z]\s*\(/g)].length;
    const nMide = (j70c4.match(/var MARCO_MIDE = \[([\s\S]*?)\];/) || ['', ''])[1].split("',").length;
    comprobar('el marco declara qué mide y qué NO mide, un renglón por eje',
      nEjesDecl > 0 && nMide === nEjesDecl &&
      /var MARCO_NO_MIDE = \[[\s\S]*?intenciones[\s\S]*?rasgos de personalidad/.test(j70c4),
      nMide === nEjesDecl
        ? nMide + ' cosas que mide, una por eje, y las que NO mide incluyen las intenciones y los rasgos'
        : 'el módulo declara ' + nEjesDecl + ' ejes y el marco nombra ' + nMide +
          ': el lector no sabría que hay un eje que el marco no menciona');

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
       en la que todos pasan siempre es un adorno: la del pliego trae hoy
       varias fallas reales y varios casilleros que no se pueden correr, y
       publicarlas es el punto —el recuento exacto NO va acá, porque un número
       en un comentario envejece igual que uno en el código (v903, v1098)—
       y «no publica sin la marca». Si un día el código dejara de contar las
       fallas, esto se pone rojo. */
    comprobar('el control de calidad cuenta las fallas y las publica, no las esconde',
      /estado === 'falla'/.test(j70c4) && /estado === 'sin-correr'/.test(j70c4) &&
      /cc\.falla \+ ' fallan · '/.test(j70c4),
      'la ficha imprime cuántos pasan, cuántos fallan y cuántos no se pudieron correr');

    comprobar('y la ficha pinta el marco, el editorial y el control',
      /marcoDeclarado\(D\)/.test(j70c4) && /editorialDe\(D\)/.test(j70c4) &&
      /controlDeCalidad\(D, f\.corte\)/.test(j70c4),
      'los tres se componen en la ficha');

    /* ═══ NINGÚN ESTADO DEL CONTROL SE ESCRIBE A MANO (v1098) ══════════════
       El renglón «El eje B se recalculó para los gobiernos anteriores» tenía
       su estado escrito a mano —`caja(..., 'falla', '...')`— con una frase
       que decía «así que el eje B no publica nivel». El eje B publica
       «Dudosa» desde la v1092, así que ese renglón estuvo IMPRESO EN EL PAPEL
       afirmando algo falso durante seis versiones. Es la cifra que envejece
       sola de la v903, en la superficie que el módulo publica como su
       control de calidad: el sitio donde más caro sale.

       La regla que lo evita es una y es comprobable: **un estado literal solo
       puede ser `'sin-correr'`**. `'sin-correr'` es una declaración
       permanente —este módulo no puede computar este casillero— y envejece
       solo si el módulo adquiere la capacidad, que es un cambio de código y
       se ve. `'pasa'` y `'falla'` son afirmaciones sobre el estado de HOY, y
       esas se calculan o mienten.

       DE QUÉ NO RESPONDE, dicho al lado (v945, v952): no comprueba que el
       cálculo sea el correcto —eso lo miden las guardas de cada cosa que el
       renglón lee— ni que el texto del `sin-correr` sea cierto. Comprueba
       que ningún casillero afirme «pasa» o «falla» sin haberlo medido. */
    const trozoCtl = (j70c4.split('function controlDeCalidad(')[1] || '').split('\n  function ')[0];
    /* El patrón pide la comilla: `caja(` a secas casaba también con
       `function caja(t, estado, det)`, y el recuento salía 19 donde la
       página imprime 18. Un token sin su contexto casa por prefijo (v1053). */
    const llamadas = trozoCtl.match(/caja\(\s*'/g) || [];
    const literales = [];
    let re = /caja\(\s*('(?:[^'\\]|\\.)*')\s*,\s*('(?:[^'\\]|\\.)*')/g, m;
    while ((m = re.exec(trozoCtl))) {
      if (m[2] !== "'sin-correr'") literales.push(m[1].slice(1, 44) + '… → ' + m[2]);
    }
    comprobar('ningún casillero del control afirma «pasa» o «falla» sin calcularlo',
      !!trozoCtl && llamadas.length > 0 && literales.length === 0,
      !trozoCtl ? 'no se encontró `controlDeCalidad`'
        : !llamadas.length ? 'no se encontró ningún `caja(` dentro: el control se quedó sin casilleros'
        /* El plural va escrito a mano y NO con `cn()`: `cn` es de js/70 y acá no
           existe, así que esta rama tiraba un `ReferenceError` — y solo se
           alcanza cuando la guarda FALLA, que es justo cuando hace falta. Lo
           cazó el arnés de tres estados con su `MURIO`, no la corrida verde: es
           la trampa que CLAUDE.md tiene escrita desde la v1090, cometida otra
           vez por el mismo archivo. */
        : literales.length ? literales.length +
                             (literales.length === 1 ? ' casillero lleva su estado escrito a mano'
                                                     : ' casilleros llevan su estado escrito a mano') +
                             ', y solo `sin-correr` puede serlo: ' + literales.join(' | ')
        : llamadas.length + ' casilleros · los estados salen de una comparación, salvo los `sin-correr`, ' +
          'que son la declaración de que el módulo no puede computarlos');

    /* ═══ UN `sin-correr` DICE SI ALGUIEN LO INTENTÓ (v1116) ══════════════
       `sin-correr` es la única afirmación que este control puede escribir a
       mano, y dice «el módulo no puede computar esto». Lo que NO decía es si
       alguien lo había intentado. Las dos cosas se leían idénticas —un
       casillero medido a fondo y uno que nadie ha mirado nunca— y piden
       acciones contrarias (v899): el segundo pide intentarlo, el primero
       pide leer la medición antes de repetirla. Es la regla que la v1076
       escribió para los trámites de los ejes, en el control del módulo.

       MATERIAL: los casilleros `sin-correr` que el código declara. Van en
       ROJO y no con `?` porque son CÓDIGO y no datos: no pueden vaciarse por
       una mejora del registro, y si un día no queda ninguno, eso es que el
       módulo adquirió las tres capacidades, lo cual se ve en el diff (v965,
       v970, v1097).

       DE QUÉ NO RESPONDE (v945, v952, v1008): de que el intento sea cierto,
       ni de que fuera un buen intento. Comprueba que esté escrito con sus
       cuatro partes —fecha, canal, qué se midió y qué salió— o que se diga
       que no lo hay, y que las dos redacciones lleguen a la pantalla. */
    const sinCorrer1116 = [];
    let reSC = /caja\(\s*('(?:[^'\\]|\\.)*')\s*,\s*'sin-correr'/g, mSC;
    while ((mSC = reSC.exec(trozoCtl))) sinCorrer1116.push(mSC[1].slice(1, 46));
    /* El intento es el SEXTO argumento de `caja`, así que se cuenta por la
       forma con la que el código lo escribe: un objeto con sus cuatro
       claves, o `null` con su redacción de cero en la pantalla. Se mide por
       CONTENIDO y no por distancia (v935). */
    const conIntento = (trozoCtl.match(/\{ fecha: '20\d\d-\d\d-\d\d',\n\s+canal:/g) || []).length;
    const conNull = (trozoCtl.match(/\n\s+null\);/g) || []).length;
    const declarados = conIntento + conNull;
    comprobar('MATERIAL · el control declara casilleros que el módulo no puede computar',
      sinCorrer1116.length > 0,
      sinCorrer1116.length ? sinCorrer1116.length + ' `sin-correr`: ' + sinCorrer1116.join(' | ')
        : 'ninguno, y eso querría decir que el módulo adquirió las tres capacidades — que se vería en ' +
          'el diff y no acá');
    comprobar('y cada uno declara su intento, o que no lo hay',
      sinCorrer1116.length > 0 && declarados >= sinCorrer1116.length,
      declarados >= sinCorrer1116.length && sinCorrer1116.length
        ? 'los ' + sinCorrer1116.length + ' lo declaran: ' + conIntento + ' con un intento fechado y ' +
          conNull + ' diciendo que nadie lo ha intentado'
        : (sinCorrer1116.length - declarados) + ' sin declararlo, y un `sin-correr` mudo se lee igual ' +
          'tanto si se midió a fondo como si nadie lo ha mirado nunca');
    /* UN INTENTO LLEVA SUS CUATRO PARTES. Sin la fecha no se puede saber si
       envejeció; sin el canal, si se intentó por donde la respuesta estaría;
       sin qué salió, no es un intento sino una intención (v1055, v1065). */
    const partes = (trozoCtl.match(/canal:/g) || []).length === conIntento &&
                   (trozoCtl.match(/\n\s+que:/g) || []).length === conIntento &&
                   (trozoCtl.match(/\n\s+salio:/g) || []).length === conIntento;
    comprobar('y un intento escrito trae sus cuatro partes: fecha, canal, qué se midió y qué salió',
      conIntento === 0 || partes,
      conIntento === 0 ? 'no hay ningún intento escrito hoy, y la regla muerde el día que aparezca el primero'
        : partes ? 'los ' + conIntento + ' las traen: sin la fecha no se sabe si envejeció, y sin qué ' +
                   'salió no es un intento sino una intención'
        : 'alguno va incompleto: `canal`, `que` y `salio` tienen que venir los tres con la fecha');
    /* LA GUARDA DE LA GUARDA (v878, v1029, v1101): que las DOS redacciones
       lleguen a la pantalla, y que el bloque se ENGANCHE. Una aserción que
       midiera solo que se construye se queda en verde sobre el defecto que
       vigila. */
    /* El patrón lleva su ENTORNO y no el texto suelto: la misma frase ya
       estaba escrita desde la v1076 para el trámite de un eje, así que un
       patrón suelto se quedaba verde con la redacción del casillero
       borrada — en verde sobre el defecto que vigila. Se busca DENTRO del
       trozo que importa (v854, v1029). */
    const redCero = /el\('b', null, 'Nadie lo ha intentado todav[ií]a'\)/.test(j70c4);
    const redN = /'Se intent[oó] · ' \+ fechaCorta\(fi\.intento\.fecha\)/.test(j70c4);
    const engIn = /d2\.appendChild\(ib\)/.test(j70c4);
    comprobar('y las dos redacciones llegan a la pantalla, enganchadas al casillero',
      redCero && redN && engIn,
      (redCero && redN && engIn)
        ? 'la de cero y la de N están escritas y el bloque se cuelga del casillero: sin la de cero, ' +
          '«nadie lo ha mirado» vuelve a leerse como «se midió y no se puede»'
        : 'falta: ' + [!redCero ? 'la redacción de cero' : null, !redN ? 'la redacción del intento' : null,
                       !engIn ? 'el enganche del bloque' : null].filter(Boolean).join(', '));

    /* EL PISO DE CASILLEROS. Son código, no datos, así que no pueden
       desaparecer por una mejora del registro: un trinquete absoluto es
       legítimo acá (v965). Lo que protege es que nadie borre el renglón
       incómodo — y el que esta tanda corrigió era justamente el que decía
       que algo faltaba. */
    comprobar('el control no pierde casilleros: mide el registro Y el módulo',
      llamadas.length >= 18,
      llamadas.length + ' casilleros (piso 18): los que miden el REGISTRO —fecha, fuente, nivel, ' +
      'contrargumento— y los que miden el MÓDULO —el veredicto, el nivel de cada eje, los peldaños sin ' +
      'lectura, la validación, la unidad de las cuentas, el deflactor, los trámites y el marco—');

    /* Y QUE LOS CASILLEROS DEL MÓDULO LEAN EL MÓDULO (v878). Si dejaran de
       llamar a las funciones que calculan el estado, lo de arriba seguiría en
       verde sobre comparaciones contra constantes. */
    const lee = [
      ['los ejes', /ejesDe\(dd, corte\)/.test(trozoCtl)],
      ['el veredicto', /veredictoGeneral\(ejesC\)/.test(trozoCtl)],
      ['la validación', /validacionDe\(k, dd === D \? DA : null\)/.test(trozoCtl)],
      ['la unidad de las cuentas', /f\.unidadExacta/.test(trozoCtl)],
      ['el deflactor', /deflactorAlDia\(dd\)/.test(trozoCtl)],
      ['los trámites', /e\.tramite && \(\(e\.tramite\.reglas \|\| \[\]\)\.length\)/.test(trozoCtl)],
      ['el marco', /marcoDeclarado\(dd\)/.test(trozoCtl)]
    ];
    const noLee = lee.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('y los casilleros del módulo leen el módulo, no una constante',
      !!trozoCtl && !noLee.length,
      noLee.length ? 'el control dejó de leer: ' + noLee.join(' · ') +
                     ' — ese casillero pasaría sobre nada'
        : 'lee los ejes, el veredicto, la validación, la unidad, el deflactor, los trámites y el marco');
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

  /* ── v1060 · declarar la identidad de objeto es una lectura, y se abre ──
     `mismoObjetoVerificado: true` baja en público el peldaño de un gobernante
     en ejercicio, y como booleano no se puede ni abrir ni discutir: desde
     afuera, una declaración medida y una puesta a ojo se ven idénticas. Así
     que la declaración va con su razón escrita, y la razón nombra el objeto
     de las dos frases — que es lo único que el criterio del pliego mira.

     Falla CERRADO (v880): una contradicción nueva que cuente sale en rojo
     hasta que alguien escriba por qué. Y vale también para la que se deja SIN
     declarar: ahí la razón dice por qué está pendiente y qué la decide, que
     es la distinción de la v899 —«sin dato» y «panel fuera» piden cosas
     distintas— dicha sobre una lectura en vez de sobre un panel. */
  {
    const sinRazon = [], flacas = [], sobran = [];
    /* El mínimo NO se pone a ojo (v869): sale de la propia definición del
       estado que la razón acompaña. Una razón más corta que el texto genérico
       de `IDENT` no está añadiendo la lectura de ESTE caso — está repitiendo
       con otras palabras lo que la marca ya dice. */
    const minimo = Math.min.apply(null,
      (soloCodigo(leer('js/70-seguimiento.js')).match(/d: '[^']{40,}'/g) || ['d: \'' + 'x'.repeat(80) + '\''])
        .map(t => t.length));
    REGISTROS.forEach((ruta) => {
      const quien = ruta.split('-').pop().replace('.json', '');
      const cx = ((JSON.parse(leer(ruta)).contradicciones || {}).casos) || [];
      cx.forEach((c, i) => {
        if (c.estado !== 'documentada') return;
        const nom = quien + '/' + (c.tema || ('#' + i)).slice(0, 44);
        const r = (c.identidadRazon || '').trim();
        /* Contra pasarse (v879, v882, v890): la que el registro deja FUERA de
           la cuenta a propósito no tiene identidad que declarar, y su motivo
           ya lo da su matiz. Pedirle una razón de identidad ensuciaría un caso
           que no aplica (v925) y dejaría dos explicaciones del mismo hecho. */
        if (c.cuenta === false) { if (r) sobran.push(nom); return; }
        if (!r) sinRazon.push(nom + (('mismoObjetoVerificado' in c) ? ' (declarada y muda)' : ' (pendiente y muda)'));
        else if (r.length < minimo) flacas.push(nom + ' (' + r.length + ' car.)');
      });
    });
    comprobar('toda contradicción que cuenta dice POR QUÉ se declaró su identidad',
      sinRazon.length === 0,
      sinRazon.length
        ? sinRazon.length + ' sin razón escrita, así que su marca no se puede abrir: ' + sinRazon.join(' · ')
        : 'cada una con su razón, declarada o pendiente');

    comprobar('y la razón añade sobre la definición del estado, no la repite',
      flacas.length === 0 && minimo > 40,
      minimo <= 40
        ? 'NO PUDO CORRER: no se pudo leer la definición de los estados de IDENT, así que el mínimo sale de la nada'
        : flacas.length
          ? 'más cortas que la definición genérica (' + minimo + ' car.): ' + flacas.join(' · ')
          : 'todas por encima de los ' + minimo + ' caracteres de la definición genérica');

    comprobar('y la que el registro deja fuera de la cuenta no lleva razón de identidad',
      sobran.length === 0,
      sobran.length
        ? 'la lleva sin tener identidad que declarar, y su matiz ya da el motivo: ' + sobran.join(' · ')
        : 'la exenta se explica por su matiz, como estaba');
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
  guardaDeFuga('el informe no fabrica imágenes de los gráficos que luego no lee',
    servidos.map(f => 'js/' + f), RASTRO, 'const chartsPNG = capturarChartsClaro();');
}

console.log('\n  -- la presencia --');
{
  const servidos = fs.readdirSync(R('js')).filter(f => /\.js$/.test(f));
  guardaDeFuga('ningún archivo servido comparte la ubicación en silencio',
    servidos.map((f) => 'js/' + f),
    /urbisCompartirUbicacion\(\s*true\s*\)|_urbisActualizarRadar\s*\(/,
    'urbisCompartirUbicacion(true);');
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
  guardaDeFuga('y ningún otro archivo se lo arma por su cuenta',
    servidos.map(f => 'js/' + f), /'aurea_'\s*\+/, "const t = 'aurea_' + idEvento;");
  comprobar('la escala del puntaje va marcada en el nombre',
            /URBIS_ESCALA_JUEGO = '_r\d+';/.test(h05), 'js/05-helpers-temporal-security.js');
}

console.log('\n  -- el calendario del evento premium --');
{
  const cal = leer('css/82-calendario.css');
  /* Encargo explícito: el calendario va en el celeste del compositor premium.
     Se mide el color, no se confía en la palabra: verde es un hex donde el
     canal verde manda con holgura sobre los otros dos. */
  const esVerde = (h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return g > r + 25 && g > b + 25;
  };
  comprobar('el barrido reconoce un verde y deja pasar el celeste',
    esVerde('#22c55e') && !esVerde('#7FD8F5') && !esVerde('#0B5E86'),
    'reconoce el verde y calla los dos celestes de la paleta');
  /* Cuántos colores llegó a LEER, no «celeste URBIS» a secas. De las
     afirmaciones de esta clase es la que se rompe más fácil: esta hoja está
     escrita hoy en hexadecimal, y una reescritura corriente a `oklch()`, a
     `color-mix()` o a variables de color deja el barrido con CERO colores que
     mirar — y entonces «el calendario no trae ni un color verde» sale en
     verde para siempre sin haber mirado ninguno. Hoy lee 45. */
  const hexes = cal.match(/#[0-9a-fA-F]{6}/g) || [];
  const verdes = hexes.filter(esVerde);
  comprobar('el calendario no trae ni un color verde',
            verdes.length === 0 && hexes.length >= 5,
            verdes.length ? verdes.join(', ')
              : hexes.length < 5
                ? 'NO PUDO CORRER: el barrido solo leyó ' + hexes.length + ' colores en hexadecimal'
                : hexes.length + ' colores leídos, ninguno verde (celeste URBIS)');
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
    /* Sin el conteo en la condición, el día que el patrón deje de sacar las
       reglas de la tabla esto sale en verde sobre CERO reglas comparadas: no
       hay pares que mirar, luego no hay ninguno malo. */
    comprobar('y ninguna regla corta se come a una larga que viene después',
              malas.length === 0 && frases.length >= 5,
              malas.length ? malas[0]
                : frases.length < 5
                  ? 'NO PUDO CORRER: el barrido solo sacó ' + frases.length + ' reglas de la tabla'
                  : frases.length + ' reglas');
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
    .concat(fs.readdirSync(RAIZ).filter(f => /\.html$/.test(f)))
    /* Y los registros que se publican (v1017). A `assets/data/` le escribe una
       rutina diaria que no lee esta bitácora, así que es justo donde una
       forma nueva puede entrar sin que nadie la mire. */
    .concat(fs.readdirSync(R('assets/data')).filter(f => /\.json$/.test(f)).map(f => 'assets/data/' + f));

  const hallados = [];
  archivos.forEach(function (rel) {
    let txt = '';
    try { txt = leer(rel); } catch (e) { return; }
    if (!txt) return;
    /* En un JSON no hay comentarios: lo que hace de «fuera de comentario» es
       estar dentro de un VALOR de prosa —ni una clave ni una dirección—. */
    const com = /\.json$/.test(rel) ? dentroDeValorJson(txt) : fueraDeComentario(txt);
    const bajo = txt.toLowerCase();
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

  /* Lo que el REGISTRO trae y no es tuteo (v1017): nombres propios de personas
     y entidades, y sustantivos corrientes en un texto de gobierno. Salen de
     medir los dos registros publicados, no de imaginarlos. */
  const DEL_REGISTRO_AS = ['Nicolás', 'Tomás', 'Andrés'];
  const DEL_REGISTRO_IAS = ['Invías', 'Azarías', 'Matías', 'Elías', 'Farías',
                            'economías', 'cesantías', 'metodologías', 'estadías',
                            'garantías', 'mayorías', 'minorías', 'anomalías',
                            'compañías', 'alcaldías', 'veedurías', 'auditorías'];
  /* «Duarte» acaba en -arte y cae en la familia del enclítico, no en la del
     pretérito: la terminación manda, no el parecido. */
  const DEL_REGISTRO_ENC = ['Duarte'];

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
    .concat(fs.readdirSync(RAIZ).filter(f => /\.html$/.test(f)))
    /* Los registros que se publican. Se leen del disco, así que un archivo de
       datos nuevo queda vigilado sin que su autor se acuerde (v867) — y eso
       importa acá más que en otros sitios: a `assets/data/` le escribe una
       rutina diaria que no lee esta bitácora. */
    .concat(fs.readdirSync(R('assets/data')).filter(f => /\.json$/.test(f)).map(f => 'assets/data/' + f));
  const tuteos = [];
  arch.forEach(function (rel) {
    let txt = '';
    try { txt = leer(rel); } catch (e) { return; }
    if (!txt) return;
    const cad = /\.json$/.test(rel) ? dentroDeValorJson(txt)
              : /\.html$/.test(rel) ? dentroDeTextoHtml(txt)
              : dentroDeCadena(txt);
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
      if (NO_ES_FUTURO.concat(DEL_REGISTRO_AS).some(w => w.toLowerCase() === m[0].toLowerCase())) continue;
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
      if (NO_ES_ENCLITICO.concat(DEL_REGISTRO_ENC).some(w => w.toLowerCase() === m[0].toLowerCase())) continue;
      if (/[A-ZÁÉÍÓÚÜÑ]/.test(m[0].slice(1))) continue;
      apunta(m.index, m[0].length);
    }
    /* Y las dos familias que la v952 midió, que son estructurales por la misma
       razón que `-ste`: en castellano `-ías` y `-abas` no son desinencia de
       ninguna otra persona. «pasarías» y «estabas» solo pueden ser tú —la
       primera y la tercera son «pasaría» y «estaba», sin ese -s—. Lo que
       colisiona no son otras personas sino SUSTANTIVOS, y esos se listan. */
    [[/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+ías(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, NO_ES_CONDICIONAL.concat(DEL_REGISTRO_IAS)],
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
    /* Y el recorrido del JSON, contra sus tres casos de respuesta conocida:
       una CLAVE que contiene «ti» —`tipoFuente` es el que llenó de falsos el
       primer barrido—, una URL con el titular dentro, y la prosa, que es lo
       único que debe verse. Sin esto puede quedarse sin morder y seguiría en
       verde, que es como pasó la v878 con su propia lista. */
    const J = '{ "tipoFuente": "verificado",\n' +
              '  "u": "https://x.co/no-entendiste/",\n' +
              '  "matiz": "Si te la comparten, es falso" }';
    const cj = dentroDeValorJson(J);
    const iClave = J.indexOf('tipoFuente'), iUrl = J.indexOf('no-entendiste'),
          iProsa = J.indexOf('te la comparten'), iVal = J.indexOf('verificado');
    comprobar('el recorrido del JSON ve la prosa, y no la clave ni la dirección',
      !cj[iClave] && !cj[iUrl] && !!cj[iProsa] && !!cj[iVal],
      'la clave ' + (cj[iClave] ? 'SE DENUNCIARÍA' : 'queda fuera') +
      ', la dirección ' + (cj[iUrl] ? 'SE DENUNCIARÍA' : 'queda fuera') +
      ', la prosa ' + (cj[iProsa] ? 'se ve' : 'NO SE VERÍA') +
      ' y un valor corto ' + (cj[iVal] ? 'también' : 'NO'));

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

console.log('\n  -- la coma decimal y el separador de miles en el informe de empresas (v1042) --');
{
  /* EN CASTELLANO EL PUNTO ES EL SEPARADOR DE MILES, asi que «12480» sin
     separar y «8.5 km» con punto son las dos maneras de escribir mal una
     cifra en un papel que se le entrega a un cliente. La lamina lo tiene
     guardado sobre el papel desde la v874/v885; el informe de empresas no lo
     tenia, y su panel tenia TRES formateadores -uno global, uno dentro de una
     funcion y uno escrito a mano- mas las cifras que no pasaban por ninguno:
     en la tabla de comparacion, «Poblacion estimada» salia con separador y
     «Usos identificados», la fila de al lado, en crudo.

     La regla exacta es la de la v1022: LA UNIDAD es lo que vuelve guardable el
     resto. Una propiedad concatenada con «%», «km», «m²», «ha», «/100» o
     «habitantes» es un ROTULO y no puede ser otra cosa -no hay regla de CSS ni
     camino de SVG que lleve esas letras detras-, asi que se le puede exigir el
     formateador SIN UNA SOLA EXCEPCION. Medido antes de escribirla: sobre los
     dos archivos da 17 casos, de los que 5 son geometria dentro de un
     `style="width:"` y 12 son rotulos de verdad; con la geometria descartada,
     cero falsos positivos. Una regla mas ancha -«todo campo del resultado que
     se imprima»- da 37 falsos positivos, que son los textos y los anios, o sea
     la lista de excepciones que envejece hasta no significar nada (v895). */
  const j62 = soloCodigo(leer('js/62-analisis-ia-app.js'));
  const j63 = soloCodigo(leer('js/63-analisis-ia-informe.js'));
  const enLinea = (src, i) => src.slice(0, i).split('\n').length;

  const UNI = "(?:%|\\s*km\\b|\\s*m²|\\s*ha\\b|\\s*/\\s*100|\\s*pts\\b|\\s*min\\b|\\s*m\\b|\\s*habitantes\\b)";
  const RE_ROT = new RegExp("\\+\\s*([A-Za-z_$][\\w$]*(?:\\.[\\w$]+)+)\\s*\\+\\s*'" + UNI, 'g');
  /* La misma «%» pegada a un `width:` es un ancho: ahi el punto es
     obligatorio y convertirlo romperia el dibujo en silencio (v891 con n1). */
  const RE_GEO = /(?:width|height|left|top|right|bottom|stroke-width|font-size|transform|translate|cx|cy|viewBox)\s*:?\s*['"]?\s*$/;

  function rotulosPelados(src) {
    const fuera = [];
    const re = new RegExp(RE_ROT.source, 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      const antes = src.slice(Math.max(0, m.index - 90), m.index);
      if (RE_GEO.test(antes)) continue;
      fuera.push(enLinea(src, m.index) + ' ' + m[1]);
    }
    return fuera;
  }
  function geometriaVista(src) {
    let n = 0;
    const re = new RegExp(RE_ROT.source, 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      if (RE_GEO.test(src.slice(Math.max(0, m.index - 90), m.index))) n++;
    }
    return n;
  }

  /* MATERIAL, y va primero (v920): sin el formateador no hay por donde pasar,
     y sin geometria a la vista el descarte no se estaria ejercitando. */
  /* Se pide la FUNCION, no su lista de parametros: la primera version exigia
     `numEs(n)` exacto y al agregarle los decimales se quedo sin material sin
     que nada estuviera roto. Un ancla por forma envejece igual que una por
     distancia (v935). */
  const declara = /function\s+numEs\s*\(/.test(j63);
  /* El objeto que se expone se corta de su llave a su cierre, no por una
     ventana de caracteres: un ancla por distancia envejece (v935). */
  const iExp = j63.indexOf('AIA_INFORME');
  const objExp = iExp < 0 ? '' : j63.slice(iExp, j63.indexOf('\n  };', iExp) + 1);
  const expone = /(^|[\s,{])numEs\s*[,}\n]/.test(objExp);
  const geoVista = geometriaVista(j62) + geometriaVista(j63);
  if (!declara || !expone || geoVista < 3) {
    anotarSinMaterial('MATERIAL · el informe declara su formateador y hay geometria que descartar',
      'declara=' + declara + ' expone=' + expone + ' geometria=' + geoVista);
  } else {
    const pelados = rotulosPelados(j62).concat(rotulosPelados(j63));
    comprobar('toda cifra con unidad pasa por el formateador del informe',
      pelados.length === 0,
      pelados.length === 0
        ? geoVista + ' de geometria descartada, y ningun rotulo sin formatear'
        : pelados.length + ' saldrian con punto o sin separar, que en castellano ' +
          'es el separador de MILES: ' + pelados.slice(0, 6).join(' · '));

    /* Y el formateador es UNO. Tres copias es lo que habia, y la que se queda
       vieja es siempre la que nadie vuelve a mirar (v879). La fecha es otra
       cosa: `new Date(...).toLocaleDateString` es legitimo y no se persigue. */
    const copias = [];
    /* El CUERPO del propio formateador se corta de su llave a su cierre, no
       por una ventana de caracteres: la primera version lo miraba a 60 y
       denunciaba a numEs por usar toLocaleString, que es lo que hace (v935). */
    const iNum = j63.indexOf('function numEs');
    const cuerpoNum = iNum < 0 ? [0, 0] : [iNum, j63.indexOf('\n  }', iNum)];
    [['js/62', j62], ['js/63', j63]].forEach(function (par) {
      const re = /([A-Za-z_$][\w$.]*)\s*\.\s*toLocaleString\s*\(\s*'es-CO'/g;
      let m;
      while ((m = re.exec(par[1])) !== null) {
        if (par[0] === 'js/63' && m.index > cuerpoNum[0] && m.index < cuerpoNum[1]) continue;
        const antes = par[1].slice(Math.max(0, m.index - 60), m.index);
        if (/Date\s*\([^)]*\)\s*\.?\s*$/.test(antes)) continue;
        copias.push(par[0] + ':' + enLinea(par[1], m.index));
      }
      const re2 = /toFixed\s*\(\s*\d\s*\)\s*\.\s*replace\s*\(\s*'\.'\s*,\s*','/g;
      while ((m = re2.exec(par[1])) !== null) copias.push(par[0] + ':' + enLinea(par[1], m.index) + ' (a mano)');
    });
    comprobar('el formateador es UNO, y no hay una segunda copia',
      copias.length === 0,
      copias.length === 0
        ? 'una sola ruta para escribir una cifra en castellano'
        : copias.length + ' copias del formateador: ' + copias.join(' · ') +
          ' — se separan a la tanda siguiente');

    /* QUIEN LO USA LO PRESTA, no lo copia: con una copia propia, el dia que el
       formateador cambie de criterio la pantalla y el papel divergen. Y se
       pregunta por los archivos que USAN el nombre, leidos del disco, no por
       una lista escrita: el tercero -la hoja del curso, que tenia la CUARTA
       copia- entro en esta version, y el cuarto entra sin que su autor se
       acuerde (v867). El unico que puede declararlo es quien lo escribe. */
    const usan = fs.readdirSync(R('js')).filter((f) => /\.js$/.test(f))
      .map((f) => ['js/' + f, soloCodigo(leer('js/' + f))])
      .filter((par) => /\bnumEs\b/.test(par[1]));
    const declaran = usan.filter((par) => /function\s+numEs\s*\(/.test(par[1])).map((par) => par[0]);
    const copian = usan
      .filter((par) => declaran.indexOf(par[0]) < 0)
      .filter((par) => !/numEs\s*=\s*[^;]*AIA_INFORME\s*\.\s*numEs/.test(par[1]))
      .map((par) => par[0]);
    comprobar('quien usa el formateador lo toma del informe, no escribe el suyo',
      declaran.length === 1 && copian.length === 0,
      declaran.length !== 1
        ? declaran.length + ' archivos lo declaran: ' + declaran.join(' \u00b7 ') +
          ' \u2014 «como se escribe un numero en castellano» es UN hecho'
        : copian.length
          ? copian.length + ' lo escriben por su cuenta: ' + copian.join(' \u00b7 ') +
            ' \u2014 se separan a la tanda siguiente'
          : 'lo declara solo js/63, y los otros ' + (usan.length - 1) + ' lo leen de AIA_INFORME');

    /* GUARDA CONTRA PASARSE (v879, v882, v890). Un ANIO no es una cantidad:
       «2.018» no es una fecha. El paper lo midio -censoAnio y anioProyeccion
       salen sin separar, a proposito- y esto impide que una tanda futura los
       enrute «por completar». */
    const anios = [];
    [['js/62', j62], ['js/63', j63]].forEach(function (par) {
      const re = /numEs\s*\(\s*[^)]*[Aa]nio/g;
      let m;
      while ((m = re.exec(par[1])) !== null) anios.push(par[0] + ':' + enLinea(par[1], m.index));
    });
    comprobar('y un ANIO no pasa por el formateador',
      anios.length === 0,
      anios.length === 0
        ? 'los anios salen sin separador, que es lo correcto'
        : anios.length + ' anios enrutados: imprimirian «2.018», que no es una fecha: ' + anios.join(' · '));

    /* GUARDA DE LA GUARDA (v878): si el barrido deja de reconocer la forma,
       todo lo de arriba sigue en verde vigilando nada. Tres casos de respuesta
       conocida, sacados de estos mismos archivos: el rotulo pelado que tiene
       que denunciar, el ya enrutado y la geometria que tiene que callar. */
    const CASO_MAL  = "'</b> · ' + r.meta.radioM + ' m'";
    const CASO_BIEN = "'</b> · ' + numEs(r.meta.radioM) + ' m'";
    const CASO_GEO  = "'<i style=\"width:' + d.score + '%;background:' + color + '\"></i>'";
    const veMal  = rotulosPelados(CASO_MAL).length === 1;
    const veBien = rotulosPelados(CASO_BIEN).length === 0;
    const veGeo  = rotulosPelados(CASO_GEO).length === 0 && geometriaVista(CASO_GEO) === 1;
    comprobar('el barrido ve el rotulo pelado, y calla el enrutado y la geometria',
      veMal && veBien && veGeo,
      veMal && veBien && veGeo
        ? 'distingue las tres formas contra casos de respuesta conocida'
        : !veMal ? 'no ve el rotulo pelado: no vigilaria nada'
                 : !veBien ? 'denuncia uno ya enrutado: daria rojo sobre lo que esta bien'
                           : 'toma la geometria por un rotulo: convertirla romperia el dibujo');
  }
}

console.log('\n  -- a que escala esta medido cada panel del informe de empresas (v1043) --');
{
  const j63 = soloCodigo(leer('js/63-analisis-ia-informe.js'));

  /* Las dos tablas se LEEN del modulo y no se copian aca: una copia acabaria
     comprobando que es igual a si misma (v957). Se cortan de su llave de
     apertura al `};` de su propia sangria, que es una extension real y no una
     ventana de caracteres (v935). */
  const tabla = (nombre) => {
    const i = j63.indexOf('const ' + nombre + ' = {');
    if (i < 0) return null;
    const j = j63.indexOf('\n  };', i);
    if (j < 0) return null;
    const cuerpo = j63.slice(i + ('const ' + nombre + ' = {').length, j);
    const out = {};
    /* La clave puede ir entrecomillada o no —`'hora-fuerte':` lleva un guion
       y `predio:` no—, y una sola de las dos formas dejaba la tercera tabla
       vacia sin que nada lo dijera: la guarda de MATERIAL de abajo no la
       contaba, asi que el fallo salio tres aserciones mas abajo y con el
       nombre equivocado. Las dos formas, y las tres tablas en el MATERIAL. */
    const re = /(?:'([^']+)'|([A-Za-z][\w-]*))\s*:\s*'([^']*)'/g;
    let m;
    while ((m = re.exec(cuerpo)) !== null) out[m[1] || m[2]] = m[3];
    return out;
  };
  const CON = tabla('ESCALA_AIA');
  const SIN = tabla('SIN_ESCALA_AIA');
  const VOC = tabla('ESCALA_TEXTO_AIA');

  /* Un PANEL de este modulo es una `.tarjeta` o un `.bloque`: es la convencion
     del propio informe y es la que la sonda cuenta sobre el papel. El trozo de
     cada uno va de su apertura a la apertura del SIGUIENTE panel o al final de
     su funcion, lo que llegue antes — una extension real, no N caracteres. */
  const panelesDe = (src) => {
    const re = /class="(?:tarjeta|bloque)[^"]*"/g;
    const ini = [];
    let m;
    while ((m = re.exec(src)) !== null) ini.push(m.index);
    return ini.map((i, k) => {
      const sigPanel = k + 1 < ini.length ? ini[k + 1] : src.length;
      const sigFn = src.indexOf('\n  function ', i);
      const fin = Math.min(sigPanel, sigFn < 0 ? src.length : sigFn);
      const linea = src.slice(0, i).split('\n').length;
      return { linea: linea, trozo: src.slice(i, fin) };
    });
  };
  const paneles = panelesDe(j63);

  if (!CON || !SIN || !VOC || Object.keys(CON).length < 20 ||
      /* Los minimos son «el lector devolvio algo», no una cifra a ojo: si
         se rompe, una tabla sale VACIA y eso es lo que hay que cazar. El
         vocabulario tiene hoy dos valores y crece o encoge con los paneles,
         asi que pedirle tres seria un techo puesto a ojo que se pone rojo
         cuando el modulo mejora (v970). */
      Object.keys(SIN).length < 1 || Object.keys(VOC).length < 1 || paneles.length < 20) {
    anotarSinMaterial('MATERIAL · las tablas de escala y los paneles se dejan leer',
      'CON=' + (CON ? Object.keys(CON).length : 'no') + ' · SIN=' + (SIN ? Object.keys(SIN).length : 'no') +
      ' · VOC=' + (VOC ? Object.keys(VOC).length : 'no') + ' · paneles=' + paneles.length);
  } else {
    /* Falla CERRADO: un panel nuevo sin su llamada sale en rojo en su primera
       composicion, en vez de imprimir sus cifras sin decir sobre que extension
       se midieron — que es como salian los 16 del informe hasta la v1042. */
    const pelados = paneles.filter((p) => !/escalaAIA\(/.test(p.trozo));
    comprobar('todo panel del informe declara a que escala esta medido', pelados.length === 0,
      pelados.length === 0
        ? paneles.length + ' paneles, todos con su rotulo'
        : pelados.length + ' publicarian cifras sin decir sobre que extension se midieron: ' +
          pelados.slice(0, 6).map((p) => 'js/63:' + p.linea).join(' · '));

    const usados = [];
    let mu;
    const reU = /escalaAIA\(\s*'([^']+)'\s*\)/g;
    while ((mu = reU.exec(j63)) !== null) usados.push(mu[1]);

    /* Un identificador que no esta en ninguna de las dos tablas imprime
       «escala sin declarar» en rojo: se ve. Pero verlo en el papel es tarde,
       asi que la guarda lo caza antes. */
    const fantasma = usados.filter((id) => !(id in CON) && !(id in SIN));
    comprobar('y todo identificador usado existe en una de las dos tablas', fantasma.length === 0,
      fantasma.length === 0
        ? usados.length + ' identificadores, todos declarados'
        : 'imprimirian «escala sin declarar» en rojo: ' + fantasma.slice(0, 6).join(' · '));

    /* Y ninguno sobra: una entrada que no usa nadie es un no-op que se lee
       igual que una que funciona (v973). */
    const sobran = Object.keys(CON).concat(Object.keys(SIN)).filter((id) => usados.indexOf(id) < 0);
    comprobar('y ninguna entrada de las tablas se quedo sin panel', sobran.length === 0,
      sobran.length === 0 ? 'ninguna sobra' : 'no las usa nadie: ' + sobran.slice(0, 6).join(' · '));

    /* Toda escala declarada sale del vocabulario del propio modulo: un valor
       suelto imprimiria su literal crudo en el rotulo. */
    const fuera = Object.keys(CON).filter((id) => !(CON[id] in VOC));
    comprobar('y toda escala declarada esta en el vocabulario del modulo', fuera.length === 0,
      fuera.length === 0
        ? Object.keys(VOC).length + ' valores: ' + Object.keys(VOC).join(' · ')
        : 'fuera del vocabulario: ' + fuera.map((id) => id + '=' + CON[id]).slice(0, 6).join(' · '));

    /* Y ningun valor del vocabulario se queda sin panel: una escala declarada
       que no rotula nada es vocabulario que no llama nadie (v885), y el dia
       que alguien la crea en uso el rotulo saldria con su literal crudo. */
    const vocSobra = Object.keys(VOC).filter((v) => Object.keys(CON).every((id) => CON[id] !== v));
    comprobar('y ningun valor del vocabulario se quedo sin usar',
      vocSobra.length === 0,
      vocSobra.length === 0
        ? 'los ' + Object.keys(VOC).length + ' se usan'
        : 'no rotula nada: ' + vocSobra.join(' · '));

    /* La mitad que impide el atajo: sin ella, el arreglo barato seria meterlos
       todos en SIN_ESCALA y el rotulo dejaria de significar algo. Cada razon
       se escribe, como las etiquetas exentas de la v1029. */
    const mudas = Object.keys(SIN).filter((id) => String(SIN[id]).trim().length < 20);
    comprobar('y cada panel sin escala dice POR QUE no la lleva', mudas.length === 0,
      mudas.length === 0
        ? Object.keys(SIN).length + ' sin escala, cada uno con su razon escrita'
        : 'sin razon escrita: ' + mudas.slice(0, 6).join(' · '));

    /* La guarda de la guarda: si `escalaAIA` dejara de leer las tablas, todo
       lo de arriba seguiria en verde sobre dos tablas que son documentacion
       (v878). Se mide el CUERPO de la funcion, cortado a su cierre. */
    const iF = j63.indexOf('function escalaAIA(');
    const cuerpoF = iF < 0 ? '' : j63.slice(iF, j63.indexOf('\n  }', iF));
    comprobar('y el rotulador sigue leyendo las tres tablas', /ESCALA_AIA\[/.test(cuerpoF) && /SIN_ESCALA_AIA\[/.test(cuerpoF) && /ESCALA_TEXTO_AIA\[/.test(cuerpoF),
      /ESCALA_AIA\[/.test(cuerpoF) && /SIN_ESCALA_AIA\[/.test(cuerpoF) && /ESCALA_TEXTO_AIA\[/.test(cuerpoF)
        ? 'lee las tres'
        : 'dejo de leer alguna: las tablas serian documentacion y el rotulo no cambiaria');
  }

  /* La otra mitad del peldano: el informe que va al CLIENTE dice con cuantos
     usos se hizo. El del curso lo declara desde siempre; el de empresas no
     llamaba a ese bloque una sola vez —medido sobre el papel—. */
  const iEmp = j63.indexOf('function cuerpoEmpresa()');
  const cuerpoEmp = iEmp < 0 ? '' : j63.slice(iEmp, j63.indexOf('function cuerpoEdu()', iEmp));
  comprobar('el informe de empresas dice con cuantos usos se hizo el analisis', iEmp > 0 && /bloqueBaseAIA\(r\)/.test(cuerpoEmp),
    iEmp < 0 ? 'no se encontro cuerpoEmpresa'
             : (/bloqueBaseAIA\(r\)/.test(cuerpoEmp)
                 ? 'la franja va en la hoja 1, antes de la primera cifra'
                 : 'no lo dice: publicaria sus paneles sin decir sobre cuantos usos se hicieron'));

  /* Y el umbral es UNO solo: con dos numeros, el dia que alguien mueva el del
     curso el del cliente se queda viejo y nadie lo ve (v879). */
  const iBase = j63.indexOf('function bloqueBaseAIA(');
  const cuerpoBase = iBase < 0 ? '' : j63.slice(iBase, j63.indexOf('\n  }', iBase));
  const iEdu = j63.indexOf('function bloqueBaseInforme(');
  const cuerpoEdu2 = iEdu < 0 ? '' : j63.slice(iEdu, j63.indexOf('\n  }', iEdu));
  const dosUsan = /MIN_USOS_FIABLE/.test(cuerpoBase) && /MIN_USOS_FIABLE/.test(cuerpoEdu2);
  comprobar('y las dos advertencias de «pocos usos» salen del mismo umbral', dosUsan && /const MIN_USOS_FIABLE\s*=\s*\d+/.test(j63),
    dosUsan ? 'las dos leen MIN_USOS_FIABLE'
            : 'una escribe su propio numero: el dia que se mueva, la otra se queda vieja');
}

console.log('\n  -- con la capa vacia el informe no publica score ni recomendacion (v1044) --');
{
  const j63 = soloCodigo(leer('js/63-analisis-ia-informe.js'));

  /* El cuerpo de una funcion, cortado a su cierre de dos espacios: una
     extension real y no una ventana de caracteres (v935). */
  const cuerpo = (nombre) => {
    const i = j63.indexOf('function ' + nombre + '(');
    if (i < 0) return null;
    const j = j63.indexOf('\n  }', i);
    return j < 0 ? null : j63.slice(i, j);
  };

  const disc = cuerpo('capaVaciaAIA');
  /* Los cuatro paneles que publican un juicio sobre la capa: los tres del
     score —el aro grande de la hoja 1, el detalle de la hoja 2 y el del
     listado— y el de oportunidad, que es el mismo molde dos paneles abajo. */
  const PANELES = ['bloqueEjecutivo', 'bloqueViabilidadDetalle', 'bloqueViabilidad', 'bloqueOportunidad'];
  const cuerpos = PANELES.map((n) => [n, cuerpo(n)]);

  if (!disc || cuerpos.some((c) => !c[1])) {
    anotarSinMaterial('MATERIAL · el discriminante y los paneles del score se dejan leer',
      'discriminante=' + (disc ? 'si' : 'no') + ' · sin cuerpo: ' +
      (cuerpos.filter((c) => !c[1]).map((c) => c[0]).join(' · ') || 'ninguno'));
  } else {
    /* Falla CERRADO: un panel que publique el juicio sin pasar por el
       discriminante vuelve a publicar un score sobre una capa vacia. */
    const pelados = cuerpos.filter((c) => !/capaVaciaAIA\(/.test(c[1])).map((c) => c[0]);
    comprobar('los paneles que publican el juicio pasan por el discriminante',
      pelados.length === 0,
      pelados.length === 0
        ? 'los ' + PANELES.length + ' lo consultan antes de publicar'
        : 'publicarian un puntaje sobre una capa vacia: ' + pelados.join(' · '));

    /* El discriminante mira los TRES contadores que el resultado deja leer,
       que es lo que lo hace auditable: sin uno, la capa que ese cuenta se
       publicaria vacia igual. */
    /* Se mide el `push` de cada capa y no la mención del contador: la primera
       version buscaba la variable `comercio` y quitando su renglon entero
       SEGUIA en verde —la variable sigue nombrada en la condicion del par de
       abajo—. Una guarda que pasa por una mencion no vigila nada (v878). */
    const CONTADORES = [
      /* El `if (` va DENTRO del patron: sin el, la condicion del par de abajo
         —`nComp === 0 && comercio === 0)`— satisface sola la de locales, y
         quitar el renglon de locales seguia en verde. Lo destapo la
         inyeccion, que es para lo que se demuestra en rojo. */
      ['usos',         /if\s*\(total === 0\)\s*faltan\.push/,    /Number\(s\.total\)/],
      ['locales',      /if\s*\(comercio === 0\)\s*faltan\.push/, /porGrupo[^;]*\.comercio/],
      ['competidores', /if\s*\(nComp === 0 && comercio === 0\)\s*faltan\.push/, /nCompetidores/]
    ];
    const faltaCont = CONTADORES.filter((c) => !(c[1].test(disc) && c[2].test(disc))).map((c) => c[0]);
    comprobar('y mira los tres contadores de capa que el resultado trae',
      faltaCont.length === 0,
      faltaCont.length === 0
        ? 'usos, locales y competidores'
        : 'no los mira: ' + faltaCont.join(' · ') + ' — esa capa se publicaria vacia igual');

    /* CERO es cero y AUSENTE no es cero (v875, v899). Con `Number(undefined)`
       el `=== 0` da falso, que es lo correcto; la guarda exige que la
       comparacion siga siendo estricta contra cero y no un `!x`, que daria
       verdadero para `undefined` y declararia vacia una capa que no se pudo
       leer — la misma confusion en la otra direccion. */
    comprobar('y distingue CERO de AUSENTE: un campo que no viene no dispara',
      /===\s*0/.test(disc) && !/if\s*\(\s*!\s*(total|comercio|nComp)\b/.test(disc),
      /===\s*0/.test(disc) && !/if\s*\(\s*!\s*(total|comercio|nComp)\b/.test(disc)
        ? 'compara contra cero, asi que un campo ausente no declara la capa vacia'
        : 'con un `!x` un campo que no vino se leeria como capa vacia');

    /* La mitad que sostiene el caso honesto: cero competidores CON comercio
       mapeado es un hallazgo —y el panel de competencia ya lo dice asi desde
       antes—, no una capa vacia. El par es lo que lo separa. */
    comprobar('y cero competidores con comercio mapeado NO es capa vacia',
      /nComp === 0 && comercio === 0/.test(disc),
      /nComp === 0 && comercio === 0/.test(disc)
        ? 'exige el par: sin el, un hallazgo real se leeria como capa vacia'
        : 'le basta el cero de competidores: taparia un hallazgo del propio informe');

    /* Una sola redaccion para los cuatro: con cuatro, la que se quedara vieja
       seria la que nadie vuelve a mirar (v879). */
    const usanTexto = cuerpos.filter((c) => /sinMedirAIA\(/.test(c[1])).length;
    comprobar('y los cuatro escriben el «sin medir» por la misma funcion',
      usanTexto === PANELES.length,
      usanTexto === PANELES.length
        ? 'una redaccion, no cuatro'
        : usanTexto + ' de ' + PANELES.length + ': las otras escriben la suya y se separan');

    /* Y dice COMO se llena: un vacio que no dice como se resuelve es la mitad
       del trabajo (v880). */
    const cTexto = cuerpo('sinMedirAIA') || '';
    comprobar('y el «sin medir» dice que falta y como se llena',
      /Cómo se llena/.test(cTexto) && /Cero usos mapeados y cero usos/.test(cTexto) && /existentes no son lo mismo/.test(cTexto),
      /Cómo se llena/.test(cTexto) && /Cero usos mapeados y cero usos/.test(cTexto) && /existentes no son lo mismo/.test(cTexto)
        ? 'nombra la capa vacia, dice la distincion y da el camino'
        : 'se queda en la marca: sin el camino es un rotulo, no una tarea');
  }
}

console.log('\n  -- de donde sale la cifra de cada panel del informe (v1045) --');
{
  const j63 = soloCodigo(leer('js/63-analisis-ia-informe.js'));

  const tabla3 = (nombre) => {
    const i = j63.indexOf('const ' + nombre + ' = {');
    if (i < 0) return null;
    const j = j63.indexOf('\n  };', i);
    if (j < 0) return null;
    const cuerpo = j63.slice(i, j);
    const out = {};
    const re = /'([^']+)':\s*\{\s*\n\s*f:\s*'([^']*)',\s*\n\s*c:\s*'([^']*)',\s*\n\s*l:\s*'([^']*)'/g;
    let m;
    while ((m = re.exec(cuerpo)) !== null) out[m[1]] = { f: m[2], c: m[3], l: m[4] };
    return out;
  };
  const tablaTxt = (nombre) => {
    const i = j63.indexOf('const ' + nombre + ' = {');
    if (i < 0) return null;
    const j = j63.indexOf('\n  };', i);
    if (j < 0) return null;
    const out = {};
    const re = /'([^']+)'\s*:\s*'([^']*)'/g;
    let m;
    const cuerpo = j63.slice(i, j);
    while ((m = re.exec(cuerpo)) !== null) out[m[1]] = m[2];
    return out;
  };

  const MET = tabla3('METODO_AIA');
  const SINM = tablaTxt('SIN_METODO_AIA');
  const SINT = tablaTxt('SIN_TITULO_AIA');
  /* Los identificadores que los paneles usan de verdad, leidos del codigo:
     la tabla de metodo se mide contra ellos y no contra una lista escrita. */
  const usados = [];
  let mu;
  const reU = /escalaAIA\(\s*'([^']+)'\s*\)/g;
  while ((mu = reU.exec(j63)) !== null) if (usados.indexOf(mu[1]) < 0) usados.push(mu[1]);

  if (!MET || !SINM || !SINT || Object.keys(MET).length < 20 || usados.length < 20) {
    anotarSinMaterial('MATERIAL · las tablas de metodo y los identificadores se dejan leer',
      'METODO=' + (MET ? Object.keys(MET).length : 'no') + ' · SIN_METODO=' + (SINM ? Object.keys(SINM).length : 'no') +
      ' · SIN_TITULO=' + (SINT ? Object.keys(SINT).length : 'no') + ' · ids=' + usados.length);
  } else {
    /* Falla CERRADO: un panel nuevo sin su metodo sale en rojo, en vez de
       publicar una cifra sin decir de donde sale. */
    const pelados = usados.filter((id) => !(id in MET) && !(id in SINM));
    comprobar('todo panel declara de donde sale su cifra',
      pelados.length === 0,
      pelados.length === 0
        ? usados.length + ' identificadores: ' + Object.keys(MET).length + ' con metodo y ' +
          Object.keys(SINM).length + ' sin cifra que calcular'
        : 'publicarian una cifra sin decir de donde sale: ' + pelados.slice(0, 6).join(' · '));

    const sobran = Object.keys(MET).concat(Object.keys(SINM)).filter((id) => usados.indexOf(id) < 0);
    comprobar('y ninguna entrada de metodo se quedo sin panel',
      sobran.length === 0,
      sobran.length === 0 ? 'ninguna sobra' : 'no las usa nadie: ' + sobran.slice(0, 6).join(' · '));

    /* Los tres campos con algo escrito. Sin esto, el atajo seria dejarlos en
       blanco y la tabla saldria con filas vacias que se leen como «no se
       sabe» en vez de como «nadie lo escribio». */
    const flojas = Object.keys(MET).filter((id) => {
      const d = MET[id];
      return String(d.f).trim().length < 15 || String(d.c).trim().length < 20 || String(d.l).trim().length < 20;
    });
    comprobar('y los tres campos dicen algo: de donde sale, como se calcula y que NO es',
      flojas.length === 0,
      flojas.length === 0
        ? 'los ' + Object.keys(MET).length + ' con sus tres campos escritos'
        : 'con algun campo en blanco: ' + flojas.slice(0, 6).join(' · '));

    /* La cuenta que la tabla ESCRIBE se comprueba contra el codigo que dice
       tenerla. Es lo unico de esta familia que se puede verificar desde aca,
       y hay que decir lo que NO cubre: `js/67` declara que el analisis lo
       hace SIEMPRE el servidor, asi que la formula de los paneles del motor
       vive en el repositorio del motor y ninguna guarda de este contenedor
       puede compararla con nada. Lo que si se impide es lo contrario —que un
       panel afirme una cuenta que su archivo no tiene— y que la tabla deje
       de nombrar al motor donde le toca.

       La primera version contaba cuantas entradas nombraban al motor y
       cuantas escribian su cuenta, y una inyeccion la dejo en VERDE: cambiar
       una entrada de «lo calcula el motor» a «se calcula en este archivo» no
       movia ninguno de los dos recuentos. Contar no es comprobar (v878). */
    const CUENTAS = [
      ['composicion',      'js/63-analisis-ia-informe.js', /100 \* n \/ Math\.max\(s\.total, 1\)/],
      ['composicion-tabla','js/63-analisis-ia-informe.js', /100 \* n \/ Math\.max\(s\.total, 1\)/],
      ['poblacion',        'js/67-analisis-cliente.js',    /Math\.pow\(1 \+ tasaAnual, anios\)/],
      ['caminabilidad',    'js/64-analisis-edu.js',        /0\.75 \+ 0\.35 \* indice/],
      ['edificacion',      'js/64-analisis-edu.js',        /edif\.porEpoca\[ficha\.epoca\]/],
      ['caminabilidad-vacia','js/64-analisis-edu.js',       /indice === null \? 1/]
    ];
    const rotas = CUENTAS.filter((c) => {
      const d = MET[c[0]];
      if (!d) return true;
      /* La entrada tiene que SEGUIR diciendo que su cuenta esta en lo
         servido —si pasa a «lo calcula el motor», ya no hay que comprobar
         nada y la fila sobra de esta lista—, y el codigo tiene que tenerla. */
      if (!/se (?:cuenta|calcula|proyecta) en (?:este mismo archivo|js\/6\d)/.test(d.c)) return true;
      return !c[2].test(soloCodigo(leer(c[1])));
    });
    /* Y la otra direccion, que es la que lo hace fallar CERRADO: una entrada
       que dice calcularse en un archivo SERVIDO tiene que estar en la lista
       de arriba. Sin esto queda el agujero que la primera version dejaba —un
       panel del motor pasa a afirmar una cuenta local y nadie la comprueba—,
       y de hecho lo tenia vivo: `caminabilidad-vacia` afirmaba su cuenta en
       js/64 y no estaba en la lista.

       De que NO responde, dicho: caza la entrada que NOMBRA un archivo
       servido o «este mismo archivo». Una escrita de otra manera —«se cuenta
       de las manzanas censales», que es lo que dice `indicadores`— se le
       escapa, porque ahi no hay ningun archivo contra el que comprobar. Esa
       mitad es vocabulario y falla abierto, como la del voseo (v880). */
    const locales = Object.keys(MET).filter((id) =>
      /se (?:cuenta|calcula|proyecta) en (?:este mismo archivo|js\/6\d)/.test(MET[id].c));
    const sinVerificar = locales.filter((id) => !CUENTAS.some((c) => c[0] === id));
    comprobar('y toda entrada que dice calcularse en lo servido esta en esa lista',
      sinVerificar.length === 0,
      sinVerificar.length === 0
        ? locales.length + ' afirman una cuenta local, y las ' + locales.length + ' se comprueban'
        : 'afirman una cuenta local que nadie comprueba: ' + sinVerificar.slice(0, 6).join(' · '));

    const servidor = /Análisis: siempre por el servidor/.test(leer('js/67-analisis-cliente.js'));
    const delMotor = Object.keys(MET).filter((id) => /motor de URBIS/.test(MET[id].c)).length;
    comprobar('y la cuenta que la tabla escribe esta de verdad en el archivo que nombra',
      rotas.length === 0 && servidor && delMotor > 0,
      rotas.length
        ? 'la afirman y su archivo no la tiene: ' + rotas.map((c) => c[0]).join(' · ')
        : !servidor
          ? 'js/67 ya no declara que el analisis lo hace el servidor: hay que volver a medir de donde sale cada cifra'
          : !delMotor
            ? 'ninguna entrada nombra al motor: o se invento una formula, o se callo quien la calcula'
            : CUENTAS.length + ' cuentas comprobadas contra su archivo, y ' + delMotor +
              ' paneles declaran que los calcula el motor — cuya regla no se sirve al navegador');

    /* Un nombre escrito a mano solo se admite para el panel que NO tiene
       titulo propio en el papel: los demas se leen del `<h2>`, y una tabla
       de nombres al lado seria la primera que se queda vieja al renombrar. */
    const conTitulo = Object.keys(SINT).filter((id) => {
      const i = j63.indexOf("escalaAIA('" + id + "')");
      if (i < 0) return false;
      return /<\/h[23]>'?\s*\+\s*$|<\/h[23]>/.test(j63.slice(Math.max(0, i - 120), i));
    });
    comprobar('y solo lleva nombre a mano el panel sin titulo propio',
      conTitulo.length === 0,
      conTitulo.length === 0
        ? Object.keys(SINT).length + ' sin titulo en el papel: ' + Object.keys(SINT).join(' · ')
        : 'tienen titulo y aun asi lo escriben a mano: ' + conTitulo.join(' · '));

    /* La guarda de la guarda: la hoja sale de lo COMPUESTO. Si dejara de
       leer los identificadores del cuerpo, listaria otra cosa —o nada— y
       todo lo de arriba seguiria en verde sobre una tabla que no se
       imprime (v878). */
    const iH = j63.indexOf('function hojaMetodoAIA(');
    const cH = iH < 0 ? '' : j63.slice(iH, j63.indexOf('\n  }', iH));
    const leeCuerpo = /data-m="\(\[\^"\]\+\)"/.test(cH) || /data-m="\(/.test(cH);
    comprobar('y la hoja de metodo sale de lo que el informe COMPUSO',
      leeCuerpo && /METODO_AIA\[/.test(cH),
      leeCuerpo && /METODO_AIA\[/.test(cH)
        ? 'recorre el cuerpo por los identificadores del rotulo'
        : 'dejo de leer el cuerpo o la tabla: listaria una lista escrita al lado, que se separa');

    /* Y el rotulo sigue llevando el identificador, que es lo que lo hace
       posible: sin el, la hoja de metodo sale vacia sin que nada lo diga. */
    const iE = j63.indexOf('function escalaAIA(');
    const cE = iE < 0 ? '' : j63.slice(iE, j63.indexOf('\n  }', iE));
    comprobar('y el rotulo de escala sigue llevando el identificador',
      /data-m="/.test(cE),
      /data-m="/.test(cE)
        ? 'el rotulo lo lleva, asi que la hoja lo encuentra'
        : 'dejo de llevarlo: la hoja de metodo saldria vacia sin decir por que');
  }

  /* La celda de la tabla es PROSA —frases enteras que se leen a treinta
     centimetros— asi que va al tamano de prosa del propio modulo y no a uno
     mas chico. El tamano se LEE de `.nota-pie`, que es esa clase, en vez de
     escribirse aca: si un dia se mueve, la tabla tiene que seguirla o la
     guarda lo dice (v890). Los rotulos en mayusculas —la cabecera de la
     tabla y el de escala— son otra clase y van aparte, que es la vara que
     este proyecto usa desde la v791.

     Medido: 6,3px eran 1,33 mm de papel contra los 1,46 de la prosa del
     modulo, y subirlos cuesta CERO en las otras cuatro hojas —la del metodo
     pasa de 376 a 417px de 756—. */
  const cssI = leer('js/63-analisis-ia-informe.js');
  const px = (sel) => { const m = new RegExp("'" + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    "\\{[^']*font-size:([\\d.]+)px").exec(cssI); return m ? parseFloat(m[1]) : null; };
  const pxProsa = px('.nota-pie');
  const pxMet = px('.tbl-met td');
  /* Y si el lector se queda sin material, esto FALLA y no sale con su `?`:
     la frontera de la v1026 es si el material puede llegar a cero por una
     MEJORA, y el CSS de una tabla que se imprime no puede quedarse vacio
     legitimamente. Un renombre de la clase deja la guarda sin mirar nada, y
     eso es un defecto, no una mejora. */
  if (pxProsa === null || pxMet === null) {
    comprobar('y la celda de la tabla va al tamano de prosa del modulo',
      false,
      'NO PUDO CORRER: prosa=' + pxProsa + ' · tabla=' + pxMet +
        ' — alguna clase se renombro, asi que el tamano de la tabla ya no se vigila');
  } else {
    comprobar('y la celda de la tabla va al tamano de prosa del modulo',
      pxMet >= pxProsa,
      pxMet >= pxProsa
        ? 'la tabla en ' + pxMet + 'px, la prosa del modulo en ' + pxProsa + 'px'
        : 'la tabla en ' + pxMet + 'px por debajo de los ' + pxProsa + 'px de la prosa del modulo: ' +
          'frases enteras impresas mas chicas que el resto del texto corrido');
  }

  /* El informe de empresas compone su hoja de metodo, y el del curso no la
     necesita: declara el suyo en la lectura del grupo. Las dos hojas se
     cuentan aparte para que la paginacion no mienta. */
  /* La paginacion se comprueba CONTANDO las hojas que el informe compone, no
     contra un numero escrito en la guarda: asi una hoja nueva sin subir
     `N_HOJAS` sale en rojo, y subir las dos juntas no cuesta tocar esto.
     Son las cuatro de `cuerpoEmpresa` mas las dos de anexo —metodo y
     vacios—, que van en funciones aparte. */
  const iEmp = j63.indexOf('function cuerpoEmpresa()');
  const cuerpoEmp = iEmp < 0 ? '' : j63.slice(iEmp, j63.indexOf('function cuerpoEdu()', iEmp));
  const iEdu = j63.indexOf('function cuerpoEdu()');
  const cuerpoEdu3 = iEdu < 0 ? '' : j63.slice(iEdu, iEdu + 400);
  const cuenta = (txt) => (txt.match(/<div class="hoja">/g) || []).length;
  const iMet = j63.indexOf('function hojaMetodoAIA(');
  const iVac = j63.indexOf('function hojaVaciosAIA(');
  const anexos = (iMet < 0 ? 0 : cuenta(j63.slice(iMet, j63.indexOf('\n  }', iMet)))) +
                 (iVac < 0 ? 0 : cuenta(j63.slice(iVac, j63.indexOf('\n  }', iVac))));
  const nDeclara = (/N_HOJAS = (\d+)/.exec(cuerpoEmp) || [])[1];
  const nCompone = cuenta(cuerpoEmp) + anexos;
  const llama = /hojaMetodoAIA\(/.test(cuerpoEmp) && /hojaVaciosAIA\(/.test(cuerpoEmp);
  const ok5 = String(nCompone) === String(nDeclara) && llama && anexos === 2 &&
    /N_HOJAS = 4/.test(cuerpoEdu3);
  comprobar('el informe de empresas compone sus dos anexos y los pagina',
    ok5,
    ok5 ? nCompone + ' hojas compuestas y ' + nDeclara + ' declaradas en el de empresas, ' +
            'con el metodo y los vacios de anexo; cuatro en el del curso'
        : !llama
          ? 'no compone alguno de los dos anexos: el metodo o los vacios con su tramite'
          : anexos !== 2
            ? 'los anexos no son dos hojas, son ' + anexos
            : String(nCompone) !== String(nDeclara)
              ? 'compone ' + nCompone + ' hojas y pagina «de ' + nDeclara + '»'
              : 'el informe del curso dejo de declarar sus cuatro hojas');
}

console.log('\n  -- los vacios del informe, con su tramite (v1046) --');
{
  const j63 = soloCodigo(leer('js/63-analisis-ia-informe.js'));
  const cssI = leer('js/63-analisis-ia-informe.js');

  /* La lista de vacios, leida del codigo: un vacio nuevo queda vigilado sin
     que su autor se acuerde (v867), y la guarda no comprueba que una lista
     escrita aca sea igual a si misma (v957). */
  const iV = j63.indexOf('const VACIOS_AIA = [');
  const cV = iV < 0 ? '' : j63.slice(iV, j63.indexOf('\n  ];', iV));
  /* Se parte por el `{ id:` de cada entrada y no por su llave de cierre: la
     sangria del cierre es lo primero que cambia al reformatear, y un ancla
     por forma envejece (v935). */
  const VAC = [];
  cV.split(/\n    \{ id: /).slice(1).forEach((trozo) => {
    const enc = /^'([^']+)',\s*t:\s*'([^']*)',\s*panel:\s*'([^']*)'/.exec(trozo);
    if (!enc) return;
    const campos = {};
    let mc;
    const reC = /\n\s+(falta|hay|que|quien|como|llevar|tarda|mientras|ojo):\s*'((?:[^'\\]|\\.)*)'/g;
    while ((mc = reC.exec(trozo)) !== null) campos[mc[1]] = mc[2];
    VAC.push({ id: enc[1], t: enc[2], panel: enc[3], c: campos });
  });

  /* Y la tabla de metodo, que es contra la que se comprueba que el limite de
     cada vacio lo declare de verdad un panel del informe. */
  const iM = j63.indexOf('const METODO_AIA = {');
  const cM = iM < 0 ? '' : j63.slice(iM, j63.indexOf('\n  };', iM));
  const IDS_MET = [];
  let mm2;
  const reM = /'([^']+)':\s*\{\s*\n\s*f:/g;
  while ((mm2 = reM.exec(cM)) !== null) IDS_MET.push(mm2[1]);

  /* Cuantos vacios hay de verdad, contados por OTRA marca: cada entrada trae
     exactamente un `mientras:`. Con un solo criterio, una entrada que el
     lector no sepa parsear —un `id:` renombrado— se cae de TODAS las
     comprobaciones de abajo sin que nada lo diga, y eso se lee igual que un
     aprobado. Lo encontro una inyeccion que no imprimio nada: una salida
     vacia no es una salida buena (v880). */
  const nMarcas = (cV.match(/\n\s+mientras:/g) || []).length;

  if (!VAC.length || IDS_MET.length < 20 || VAC.length !== nMarcas) {
    comprobar('los vacios del informe se dejan leer',
      false,
      'NO PUDO CORRER: el lector ve ' + VAC.length + ' de ' + nMarcas + ' vacios · metodos=' +
        IDS_MET.length + ' — los que no ve se caen de todas las comprobaciones de abajo');
  } else {
    /* Falla CERRADO: un vacio nuevo sin su ventanilla sale en rojo. Nombrar
       el documento y callar el tramite es lo que la v880 llamo un muro: con
       el tramite escrito es una tarea de una tarde. */
    const CAMPOS = ['falta', 'hay', 'que', 'quien', 'como', 'llevar', 'tarda'];
    const cojos = VAC.filter((v) => CAMPOS.some((k) => String(v.c[k] || '').trim().length < 15));
    comprobar('todo vacio dice que se pide, ante quien, como, que llevar y cuanto tarda',
      cojos.length === 0,
      cojos.length === 0
        ? 'los ' + VAC.length + ' con su ventanilla escrita'
        : 'nombran el documento y callan el tramite, que es un muro: ' +
          cojos.map((v) => v.id).join(' · '));

    /* `mientras` y `ojo` son DOS campos y no uno, para que el limite del
       sustituto no se pueda perder al redactar: la v880 lo dejo escrito —«el
       mientras llega NO es un permiso para suponer»— y su suite persigue
       justamente que ninguno nombre el sustituto a secas. */
    const sueltos = VAC.filter((v) => String(v.c.mientras || '').trim().length < 15 ||
                                      String(v.c.ojo || '').trim().length < 15);
    comprobar('y el sustituto va con su limite escrito en su propio campo',
      sueltos.length === 0,
      sueltos.length === 0
        ? 'los ' + VAC.length + ' dicen que sirve mientras llega Y hasta donde'
        : 'nombran el sustituto a secas, que es un permiso para suponer: ' +
          sueltos.map((v) => v.id).join(' · '));

    /* Cada vacio cierra un limite que el informe DECLARA, y lo dice con el id
       de ese panel. Sin esto se puede inventar un vacio sin nada medido
       detras, que es justo lo que este modulo no hace. */
    const huerfanos = VAC.filter((v) => IDS_MET.indexOf(v.panel) < 0);
    comprobar('y cada uno cierra un limite que un panel del informe declara',
      huerfanos.length === 0,
      huerfanos.length === 0
        ? 'los ' + VAC.length + ' apuntan a su panel: ' + VAC.map((v) => v.panel).join(' · ')
        : 'apuntan a un panel que no existe: ' +
          huerfanos.map((v) => v.id + '→' + v.panel).join(' · '));

    /* El tramite en VERDE y el vacio en AMBAR, leidos de los tokens del
       modulo: dos cosas distintas con el mismo color se leen como una sola
       (v880). Los tokens no se escriben aca, se leen — si el modulo mueve su
       paleta, la regla tiene que seguirla (v890). */
    const rg = (sel) => {
      const i = cssI.indexOf("'" + sel + "{");
      if (i < 0) return '';
      const j = cssI.indexOf("}'", i);
      return j < 0 ? '' : cssI.slice(i, j);
    };
    const rVac = rg('.vacio-aia .vacio-tag');
    const rOk = rg('.vacio-aia .vacio-tag-ok');
    const dosColores = /T\.warn/.test(rVac) && /T\.ok/.test(rOk) && !/T\.warn/.test(rOk);
    comprobar('y el tramite va en verde y el vacio en ambar, de los tokens del modulo',
      dosColores,
      dosColores
        ? 'el vacio con T.warn y el tramite con T.ok, sin un color escrito al lado'
        : 'los dos del mismo color, o con un hex escrito en la hoja: «esto no lo tenemos» ' +
          'y «asi se consigue» se leerian como una sola cosa');

    /* Y el conteo se CALCULA. Escrito a mano dentro del subtitulo es una
       cifra que envejece sola el dia que entre o salga un vacio (v903). */
    const iH = j63.indexOf('function hojaVaciosAIA(');
    const cH = iH < 0 ? '' : j63.slice(iH, j63.indexOf('\n  }', iH));
    comprobar('y el subtitulo cuenta los vacios en vez de llevar el numero escrito',
      /VACIOS_AIA\.length/.test(cH),
      /VACIOS_AIA\.length/.test(cH)
        ? 'sale de VACIOS_AIA.length'
        : 'lleva el numero escrito: el dia que entre o salga un vacio, el subtitulo miente');

    /* La linea de «siguiente paso» de la hoja 4 manda a la hoja del tramite.
       Sin eso, quien pare ahi sigue contra el muro que esta tanda vino a
       quitar: nombraba el POT y callaba la ventanilla. */
    const iP = j63.indexOf('SIGUIENTE PASO RECOMENDADO');
    const cP = iP < 0 ? '' : j63.slice(iP, iP + 420);
    comprobar('y la linea de siguiente paso manda a la hoja del tramite',
      /ltima hoja/.test(cP),
      /ltima hoja/.test(cP)
        ? 'nombra la hoja donde estan las ventanillas'
        : 'nombra el documento y calla la ventanilla, que es el muro de la v880');

    /* La guarda de la guarda: el bloque sigue saliendo de la lista. Sin esto,
       una lista escrita al lado dejaria todo lo de arriba en verde sobre algo
       que el papel no imprime (v878). */
    const iB = j63.indexOf('function bloqueVaciosAIA(');
    const cB = iB < 0 ? '' : j63.slice(iB, j63.indexOf('\n  }', iB));
    comprobar('y el bloque sigue componiendose de esa lista',
      /VACIOS_AIA\.map/.test(cB),
      /VACIOS_AIA\.map/.test(cB)
        ? 'recorre VACIOS_AIA'
        : 'dejo de recorrerla: lo de arriba vigilaria una lista que el papel no imprime');
  }
}

console.log('\n  -- la foto del panel de Pro City se ve entera, y a su tamano (v1039) --');
{
  const c52 = leer('css/52-urbis-pro-city.css');
  const c99 = leer('css/99-mobile-clean-core.css');
  const j05 = soloCodigo(leer('js/05-helpers-temporal-security.js'));

  /* La regla de un selector, SIN sus comentarios: se corta del selector a su
     llave de cierre y se le quitan los `/* *\/`. Las dos mitades hacen
     falta: sin quitarlos, un `top:` citado dentro de un comentario se leeria
     como una declaracion —que es el defecto de la v926 en CSS— y, al reves,
     un comentario entre dos declaraciones rompe el `;` que las separa y la
     de abajo deja de encontrarse. Se busca la ULTIMA, que es la que gana. */
  const reglaDe = (css, sel) => {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
    let m, ult = null;
    while ((m = re.exec(css)) !== null) ult = m[1];
    return ult === null ? null : ult.replace(/\/\*[\s\S]*?\*\//g, ' ');
  };

  const rPanel = reglaDe(c52, '#urbis-mobile-app .u52-procity-selpanel');
  const rCard  = reglaDe(c52, '#urbis-mobile-app .u52-procity-selpanel-card');
  const rFoto  = reglaDe(c52, '#urbis-mobile-app .u52-procity-selpanel-foto');

  /* MATERIAL primero (v920): sin las tres reglas no hay nada que mirar y
     todo lo de abajo pasaria sobre la nada. */
  const hayCss = !!(rPanel && rCard && rFoto);
  comprobar('MATERIAL · se leen las tres reglas del panel del punto',
    hayCss,
    hayCss ? 'panel, tarjeta y foto'
           : 'no se pudieron leer: ' + [!rPanel && 'panel', !rCard && 'tarjeta', !rFoto && 'foto'].filter(Boolean).join(' · '));

  if (hayCss) {
    /* La foto de un mapeo es EVIDENCIA. Con `cover` y un techo en px se
       tiraba el 57,1 % del alto de una foto 3:4 y el 67,8 % de una 9:16
       —medido en el panel de verdad—, y lo que se tira es justo lo que se
       fotografio. El techo que hace falta lo pone la tarjeta, que ademas se
       recorre; uno aqui volveria a decidir por el lector que parte de su
       foto le toca ver. */
    const recorta = [];
    if (/object-fit\s*:\s*cover/.test(rFoto)) recorta.push('object-fit:cover');
    const mh = /max-height\s*:\s*([^;]+)/.exec(rFoto);
    if (mh && !/none/i.test(mh[1])) recorta.push('max-height:' + mh[1].trim());
    comprobar('la foto del panel se ve entera, sin recortar',
      recorta.length === 0,
      recorta.length ? 'la recorta: ' + recorta.join(' · ') + ' — se tira lo que se fotografio'
                     : 'ancho completo y alto libre, con object-fit:contain de red');

    /* Y la otra mitad: sin techo NI recorrido en la tarjeta, una foto alta la
       empuja fuera de la pantalla por arriba —medido, 182 px de cabecera
       fuera con una foto 9:16—, que es el defecto de la v896. El
       `box-sizing` va porque el techo se cuenta CON el relleno: sin el se
       sale 29 px. */
    const faltaCard = [];
    if (!/max-height\s*:/.test(rCard)) faltaCard.push('el techo');
    if (!/overflow-y\s*:\s*auto/.test(rCard)) faltaCard.push('el recorrido');
    if (!/box-sizing\s*:\s*border-box/.test(rCard)) faltaCard.push('el box-sizing');
    comprobar('y la tarjeta tiene techo, recorrido y box-sizing',
      faltaCard.length === 0,
      faltaCard.length ? 'le falta ' + faltaCard.join(' · ') + ': una foto alta la sacaria de la pantalla'
                       : 'topa contra su contenedor y se recorre, asi que nada queda inalcanzable');

    /* El techo de la tarjeta solo resuelve si el panel tiene ALTO definido,
       y eso lo da su `top`. Con `top:auto` el panel mide lo que mida su
       contenido y un `max-height:100%` no topa contra nada. */
    const panelTop = /(^|;)\s*top\s*:\s*([^;]+)/.exec(rPanel);
    comprobar('y el panel declara su top, que es contra lo que la tarjeta topa',
      !!panelTop && !/auto/i.test(panelTop[2]),
      panelTop ? 'top:' + panelTop[2].trim() : 'sin top: el techo de la tarjeta no resolveria contra nada');

    /* Y arranca por DEBAJO de la barra de arriba, que va en un z-index mas
       alto y le tapaba el titulo y la X —lo unico que cierra el panel—. No
       se compara con un numero escrito aqui: se compara con el top que la
       propia barra declara, asi que moverla pone esto en rojo. */
    /* La barra la declaran VARIAS reglas y cual gana depende de la
       especificidad, que desde aqui no se resuelve. Se toma la MAYOR de las
       declaradas, que es el peor caso: ser mas estricto que la realidad es
       la direccion segura. */
    const topsBarra = [...c99.replace(/\s+/g, ' ')
      .matchAll(/\.u52-mapcentric-topbar\s*\{[^}]*top\s*:\s*calc\(env\(safe-area-inset-top,0px\)\s*\+\s*(\d+)px\)/g)]
      .map(m => Number(m[1]));
    const rBarra = topsBarra.length ? [null, String(Math.max.apply(null, topsBarra))] : null;
    const px = panelTop ? /\+\s*(\d+)px/.exec(panelTop[2]) : null;
    const debajo = !!(rBarra && px && Number(px[1]) > Number(rBarra[1]));
    comprobar('y arranca por debajo de la barra de arriba, no en el borde',
      debajo,
      !rBarra ? 'no se pudo leer el top de la barra: esta comprobacion no vigila nada'
        : !px ? 'el top del panel no se cuenta desde el mismo env(): no se pueden comparar'
        : debajo ? 'panel en +' + px[1] + 'px contra la barra en +' + rBarra[1] + 'px'
                 : 'panel en +' + px[1] + 'px y la barra en +' + rBarra[1] + 'px: la barra le taparia el titulo y la X');

    /* Con `top` puesto el panel cubre la pantalla, asi que los toques se
       reparten o el mapa deja de recibirlos donde la tarjeta no esta. */
    const pnNone = /pointer-events\s*:\s*none/.test(rPanel);
    const pnAuto = /pointer-events\s*:\s*auto/.test(rCard);
    comprobar('y los toques se reparten: el panel los deja pasar y la tarjeta no',
      pnNone && pnAuto,
      !pnNone ? 'el panel los atrapa: el mapa dejaria de recibir el toque encima de la tarjeta'
        : !pnAuto ? 'la tarjeta los deja pasar tambien: sus botones no responderian'
        : 'panel en none, tarjeta en auto');
  }

  /* Y el cuelgue que aparecio midiendo este mismo panel: se repintaba a si
     mismo «cuando terminen de cargar las carpetas», y `loadProCityFolders`
     no pone su bandera ni cuando no hay usuario ni cuando la red falla, asi
     que el repintado se volvia a llamar sin parar. Medido: sin sesion, y con
     sesion pero sin red, tocar un punto CONGELA la pestana. */
  const j20 = soloCodigo(leer('js/20-mobile-functional-app.js'));
  const iPanel = j20.indexOf('function showProCitySelectedPanel(');
  const cuerpoPanel = iPanel < 0 ? '' : j20.slice(iPanel, j20.indexOf('\n  }', iPanel));
  const seRepinta = /loadProCityFolders\(\)\.then\(\(\)\s*=>\s*\{([^}]*)\}/.exec(cuerpoPanel);

  comprobar('MATERIAL · el panel se repinta cuando llegan las carpetas',
    !!seRepinta,
    seRepinta ? 'el repintado esta ahi, y es el que puede volverse un bucle'
              : 'ya no se repinta: esta comprobacion no vigilaria nada');

  if (seRepinta) {
    /* La bandera es lo unico que distingue «llegaron» de «se intento y no
       llegaron»: sin mirarla, el repintado vuelve a esperar lo que ya se
       sabe que no va a llegar. */
    const mira = /proCity\.foldersLoaded/.test(seRepinta[1]);
    comprobar('y solo si LLEGARON, o vuelve a llamarse a si mismo sin parar',
      mira,
      mira ? 'comprueba foldersLoaded antes de repintar'
           : 'repinta pase lo que pase: sin sesion o sin red, tocar un punto congela la pestana');

    /* Y la guarda de la guarda, que es la que dice por que hace falta: si
       `loadProCityFolders` pusiera SIEMPRE su bandera, lo de arriba seguiria
       siendo correcto y ya no protegeria de nada. */
    const iCarga = j20.indexOf('function loadProCityFolders(');
    const cuerpoCarga = iCarga < 0 ? '' : j20.slice(iCarga, j20.indexOf('\n  }', iCarga));
    const salidaSinBandera = /if\(!usuario\)\s*return Promise\.resolve\(\);/.test(cuerpoCarga)
                          || /\.catch\(function\(\)\{\}\)/.test(cuerpoCarga);
    comprobar('MATERIAL · y la carga tiene caminos que no ponen esa bandera',
      salidaSinBandera,
      salidaSinBandera ? 'sale sin ponerla si no hay usuario o si la red falla: por eso hay que mirarla'
                       : 'ya la pone siempre: lo de arriba sigue bien y dejo de proteger de algo');
  }

  /* El piso de calidad de la escalera de compresion. Sale de medir el error
     contra el original a los dos anchos a los que la foto SE VE —996 px de
     dispositivo en este panel y 1746 en el visor—, y el minimo cae en 1600
     px de lado; 2000 ya empeora. */
  const piso = /const URBIS_FOTO_PISO_Q\s*=\s*([\d.]+)\s*;/.exec(j05);
  comprobar('MATERIAL · el piso de calidad de la foto se lee del modulo',
    !!piso, piso ? 'URBIS_FOTO_PISO_Q = ' + piso[1] : 'no se pudo leer: lo de abajo no vigilaria nada');

  if (piso) {
    const lados = /const lados = \[([^\]]+)\]/.exec(j05);
    const tiene1600 = !!(lados && lados[1].split(',').map(x => x.trim()).indexOf('1600') === 0);
    comprobar('la escalera empieza en el tamano de menor error medido',
      tiene1600,
      lados ? (tiene1600 ? 'arranca en 1600, que es el minimo medido' : 'arranca en ' + lados[1].split(',')[0].trim() + ': se queda por debajo del minimo medido')
            : 'no se pudo leer la escalera');

    /* Y el piso tiene que dejar pasar ese tamano: con 0,45 —lo de antes—
       1600 necesitaba 0,289 y quedaba fuera, asi que la escalera caia a
       1080 con MAS error. El corte medido esta entre 0,107 (2000, que ya
       empeora) y 0,289 (1600, el minimo). */
    const q = Number(piso[1]);
    comprobar('y el piso deja pasar ese tamano sin admitir el que ya empeora',
      q > 0.107 && q <= 0.289,
      'piso ' + q + (q > 0.289 ? ': 1600 no cabria y la escalera caeria a uno con mas error'
        : q <= 0.107 ? ': admitiria 2000, que medido sale peor' : ', entre el giro medido y el minimo'));

    /* El ultimo recurso tiene un piso MAS BAJO a proposito: su criterio es
       otro —alli se elige entre dos fotos buenas y aqui entre una pobre y
       ninguna evidencia—. Con uno mas alto que el de la escalera, el
       respaldo pediria mas calidad que el camino normal. */
    const ult = /_mejorCalidadQueQuepa\(img, 320, 49000, ([\d.]+)\)/.exec(j05);
    comprobar('y el ultimo recurso pide MENOS calidad que la escalera, no mas',
      !!ult && Number(ult[1]) < q,
      !ult ? 'no se pudo leer el ultimo recurso'
           : Number(ult[1]) < q ? 'respaldo en ' + ult[1] + ' contra el piso en ' + q
                                : 'respaldo en ' + ult[1] + ' y piso en ' + q + ': el respaldo seria mas exigente que el camino normal');

    /* Y la guarda de la guarda: sin esto, el piso seria una constante que
       nadie lee y todo lo de arriba seguiria en verde. */
    const lee = /const piso = pisoQ == null \? URBIS_FOTO_PISO_Q : pisoQ;/.test(j05);
    comprobar('y la escalera sigue leyendo esa constante',
      lee, lee ? '_mejorCalidadQueQuepa la usa como su piso'
               : 'dejo de leerla: el piso volveria a estar escrito suelto y esto no vigilaria nada');
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
    /* Con la tabla vacía no hay nada que buscar y `perdidas` sale vacía: la
       afirmación pasaría en verde sobre una lista viva sin una sola capacidad
       vigilada, que es justo lo que la v868 escribió esta comprobación para
       impedir. El conteo entra en la condición. */
    comprobar('las marcas de capacidad de ' + L.que + ' siguen en el código servido',
      perdidas.length === 0 && L.capacidades.length >= 1,
      perdidas.length ? 'sin marca: ' + perdidas.join(', ')
        : !L.capacidades.length
          ? 'NO PUDO CORRER: la tabla de ' + L.que + ' se quedó sin una sola capacidad'
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
  /* ── Y desde la v1063 la bitácora son DOS archivos ───────────────────────
     Las 172 secciones por versión se mudaron a `BITACORA.md`: eran 24.155 de
     las 25.092 líneas de `CLAUDE.md`, el 96 %, y se inyectaban enteras en cada
     sesión —el `/compact` dejó de poder bajar del límite—. La convención no
     cambió de sitio con ellas, así que esta guarda lee los DOS y el nombre del
     archivo va en el mensaje, para que se pueda ir a mirar.

     Y el archivo no se puede perder en silencio: si falta, la lectura lo dice
     con su nombre y en ROJO —no con su `?`—, porque es un archivo del
     repositorio y no puede quedarse vacío por una mejora (v1026); y si alguien
     lo renombra, el piso de renglones de más abajo se desploma, que es la misma
     propiedad con la que la v1008 cazó un encabezado fuera del convenio. */
  const ARCHIVOS = [];
  ['CLAUDE.md', 'BITACORA.md'].forEach((nom) => {
    try { ARCHIVOS.push({ n: nom, t: leer(nom) }); } catch (e) { ARCHIVOS.push({ n: nom, t: null }); }
  });
  const faltantes = ARCHIVOS.filter((a) => a.t === null).map((a) => a.n);
  comprobar('los dos archivos de la bitácora están donde la convención dice',
    faltantes.length === 0,
    faltantes.length
      ? 'falta: ' + faltantes.join(' · ') +
        ' — las declaraciones que viven ahí dejarían de vigilarse y todo lo de abajo pasaría'
      : 'CLAUDE.md con las reglas y BITACORA.md con ' +
        ((ARCHIVOS[1].t || '').match(/^## /gm) || []).length + ' secciones por versión');
  const md = ARCHIVOS[0].t || '';

  /* ── Y que el reparto no se deshaga solo ────────────────────────────────
     El archivo existe y hay que poder LLEGAR a él: un archivo al que ninguna
     lectura alcanza se ve, desde afuera, igual que uno que no está —la clase C
     de este proyecto, cometida justo en la tanda que lo partió—. Así que
     `CLAUDE.md` tiene que nombrarlo.

     Y la otra mitad, que es la que impide que vuelva a crecer: **ninguna
     sección de `CLAUDE.md` lleva número de versión en su título.** Es el
     discriminante estructural de una entrada de bitácora —una tanda titula
     `## Lo que sea (vNNNN)`— así que una sección de versión escrita acá por
     costumbre sale en rojo en su primera corrida, en vez de a las veinte
     tandas y con el archivo otra vez en 25.000 líneas.

     Dos excepciones, con su razón escrita cada una, que es la regla de la
     v895: son REGLAS que citan la versión que las pagó y que toda sesión tiene
     que leer antes de trabajar. */
  const REGLAS_CON_VERSION = [
    { t: 'La lista viva: lo que al pliego educativo todavía le falta (v866)',
      por: 'es la lista que revisar.js lee, y su cláusula ya: es la convención' },
    { t: 'El sector de prueba tiene que parecerse a uno de verdad (v862)',
      por: 'es la regla del material de prueba, que se cita en cada tanda' }
  ];
  if (md) {
    comprobar('CLAUDE.md nombra el archivo donde está el resto de la bitácora',
      /BITACORA\.md/.test(md),
      /BITACORA\.md/.test(md)
        ? 'lo nombra, así que una sesión sabe dónde buscar el detalle de una versión'
        : 'no lo nombra: el archivo estaría en el repositorio y ninguna sesión llegaría a él');

    const conVersion = (md.match(/^## .*\(v\d+\)\s*$/gm) || []).map((x) => x.replace(/^## /, '').trim());
    const noDeclaradas = conVersion.filter((t) => !REGLAS_CON_VERSION.some((r) => r.t === t));
    comprobar('y ninguna sección de versión se escribe en CLAUDE.md en vez de en la bitácora',
      noDeclaradas.length === 0,
      noDeclaradas.length === 0
        ? conVersion.length + ' secciones citan su versión y las ' + REGLAS_CON_VERSION.length +
          ' son reglas declaradas: lo demás vive en BITACORA.md'
        : noDeclaradas.length + ' sección(es) de versión acá: ' + noDeclaradas.slice(0, 3).join(' · ') +
          ' — así volvió a 25.092 líneas, y es lo que se inyecta en cada sesión');

    const sinRazon = REGLAS_CON_VERSION.filter((r) => !r.por || r.por.length < 20);
    const perdidas = REGLAS_CON_VERSION.filter((r) => md.indexOf('## ' + r.t) < 0).map((r) => r.t);
    comprobar('y las dos excepciones siguen estando, cada una con su razón',
      !sinRazon.length && !perdidas.length,
      sinRazon.length ? 'sin razón escrita: ' + sinRazon.map((r) => r.t).join(' · ')
        : (perdidas.length
          ? 'declaradas y no están: ' + perdidas.join(' · ') + ' — la lista se quedó vieja'
          : 'las ' + REGLAS_CON_VERSION.length + ' están y dicen por qué son reglas y no bitácora'));
  }


  /* El texto se lee sin lo que NO es una declaración: los bloques de código
     —donde vive el propio grep de la receta—, las líneas de cita `>` y lo que
     va entre comillas angulares, que es como esta bitácora cita una frase de
     otra tanda. Sin eso, la receta se denunciaría a sí misma, que es el defecto
     que la v926 encontró con una capacidad demostrada por su comentario. */
  const fuera = [];
  const recortar = (txt) => {
  let limpio = txt.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length));
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
  return limpio;
  };

  /* Las frases se buscan por su NÚCLEO y no por la fórmula entera: al medirlo,
     «que es otra FUENTE y otra tanda» —la declaración de la v876 sobre la
     corrida municipal— se escapaba de `es otra tanda` por una palabra de por
     medio. Con el núcleo salen las catorce; con la fórmula, diez. */
  const FRASES = /(otra tanda|su propia tanda|no se hace acá)/g;
  const declaraciones = [];
  ARCHIVOS.filter((a) => a.t !== null).forEach((A) => {
  const limpio = recortar(A.t);
  const md = A.t;
  let m;
  FRASES.lastIndex = 0;
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
    if (!marca) fuera.push(A.n + ':' + linea);
  }
  });

  /* MATERIAL primero (v920): sin declaraciones que mirar, todo lo de abajo
     pasaría por no tener nada delante.

     Y acá va en ROJO y no con su `?`, que es la frontera de la v1026: el
     material es la PROSA de dos archivos del repositorio, y no puede llegar a
     cero por una mejora —una sección cerrada se queda con su marca, no se
     borra—. Lo midió la demostración del reparto de la v1063: con la guarda
     leyendo un solo archivo, las dieciséis declaraciones y los ciento ocho
     renglones caían a cero y la corrida salía con un `?` que se lee como «no
     hay nada que reportar», que es justo lo que este proyecto tiene escrito
     que no se lee así (v880). */
  if (declaraciones.length < 5) {
    comprobar('MATERIAL · la bitácora declara trabajo aplazado',
      false,
      'solo ' + declaraciones.length + ' declaraciones en ' +
        ARCHIVOS.filter((a) => a.t !== null).map((a) => a.n).join(' + ') +
        ' — o la bitácora se partió y la guarda no siguió al archivo nuevo, ' +
        'o el recorte se come lo que tenía que detectar: en los dos casos no vigila nada');
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
    const renglones = [];
    const sinEstado = [];
    /* Los dos archivos, por lo mismo que arriba: casi todas estas secciones
       viven en `BITACORA.md` desde la v1063, y el nombre del archivo va en el
       mensaje porque es a dónde hay que ir. */
    ARCHIVOS.filter((a) => a.t !== null).forEach((A) => {
    const lns = A.t.split('\n');
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
          sinEstado.push(A.n + ':' + (i + 1) + ' → ' + t.trim().replace(/\n/g, ' ').slice(0, 40));
        }
      });
    }
    });
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

console.log('\n  -- qué indicador alimenta un acto de gobierno (v1061) --');
{
  /* Los dos registros, por la misma vara (principio 1 del pliego).

     TRES estados y no dos, que es la distinción de la v899 dicha sobre la
     clasificación: la lista de indicadores que el acto alimenta, la lista
     VACÍA —se corrieron los criterios escritos y ninguno aplica— y la
     AUSENCIA del campo, que es «nadie lo ha mirado». Las dos últimas se
     veían iguales, así que un acto ya revisado se contaba como pendiente
     para siempre y el cero de un indicador se leía como «falta clasificar»
     cuando podía significar «ninguno entra por una vía del criterio».

     Falla CERRADO (v880): una entrada nueva de la rutina diaria nace sin el
     campo y sale en rojo en su primera corrida, que es como se consigue que
     el pendiente no vuelva a crecer solo. */
  const REGISTROS = ['assets/data/seguimiento-presidencial.json', 'assets/data/seguimiento-petro.json'];
  const actos = [], sinRevisar = [], revisados = [], declaran = [], impropios = [];
  REGISTROS.forEach((ruta) => {
    const d = JSON.parse(leer(ruta));
    const quien = ruta.split('-').pop().replace('.json', '');
    (d.entradas || []).forEach((e) => {
      const tiene = Object.prototype.hasOwnProperty.call(e, 'indicadores');
      if (e.tipoMedicion !== 'actividad') {
        if (tiene) impropios.push(quien + '/' + (e.fecha || '?') + ' · ' + e.tipoMedicion);
        return;
      }
      actos.push(e);
      if (!tiene) sinRevisar.push(quien + '/' + (e.fecha || '?'));
      else if ((e.indicadores || []).length) declaran.push(e);
      else revisados.push(e);
    });
  });

  /* MATERIAL primero (v920). Y mide lo que SOBREVIVE al cero (v1022): no
     cuántos quedan sin revisar —que es el defecto y baja a cero al
     arreglarlo— sino que los registros sigan trayendo actos de gobierno. */
  if (actos.length < 10) {
    anotarSinMaterial('MATERIAL · los registros traen actos de gobierno',
      actos.length + ' de tipoMedicion «actividad»');
  } else {
    comprobar('MATERIAL · los registros traen actos de gobierno',
      true, actos.length + ' actos en los dos registros');

    comprobar('todo acto de gobierno declara qué indicador alimenta, o que ninguno',
      sinRevisar.length === 0,
      sinRevisar.length === 0
        ? 'los ' + actos.length + ' lo declaran: ' + declaran.length + ' alimentan alguno y ' +
          revisados.length + ' pasaron por los criterios y no caen en ninguna vía'
        : sinRevisar.length + ' sin revisar, los primeros: ' + sinRevisar.slice(0, 4).join(' · ') +
          ' — mientras falten, un 0 en un indicador se lee como «no hubo» y puede ser «nadie lo miró»');

    /* Guarda contra pasarse (v879, v882, v890): a una cifra del país o a un
       hecho de otro actor NO se le asigna un indicador de gestión, igual que
       no se le inventa un nivel (v999). Sin esta, el arreglo barato sería
       escribirle `[]` a las 218 y el recuento llegaría a cero declarando
       algo falso sobre las que no son actos. */
    comprobar('y a lo que no es un acto de gobierno no se le asigna indicador',
      impropios.length === 0,
      impropios.length === 0
        ? 'ninguna cifra del país ni hecho de otro actor declara indicador'
        : impropios.length + ' lo llevan sin ser actos: ' + impropios.slice(0, 4).join(' · '));

    /* Y la nota de cada registro tiene que decirlo: es la causa que la v998
       encontró para el rol y la v999 para el nivel —el campo existe, la
       guarda existe, y la instrucción que lee quien escribe una entrada no
       lo menciona—, así que cada entrada nueva nacía incumpliéndola. */
    const sinNota = REGISTROS.filter((ruta) =>
      String(JSON.parse(leer(ruta))._comentario || '').indexOf('QUÉ INDICADOR ALIMENTA UN ACTO DE GOBIERNO') < 0);
    comprobar('y la nota de cada registro dice las DOS maneras de declararlo',
      sinNota.length === 0,
      sinNota.length === 0
        ? 'los ' + REGISTROS.length + ' explican la regla a quien escribe'
        : 'sin explicarlo: ' + sinNota.join(' · ') + ' — una entrada nueva nace sin el campo');

    /* Guarda de la guarda (v878), en sus dos mitades. Si el recuento dejara
       de separar la lista vacía de la ausencia, o volviera a contar sobre
       los hechos del mandato en vez de sobre los ACTOS, todo lo de arriba
       seguiría en verde sobre una distinción que nadie usa. */
    const j70i = soloCodigo(leer('js/70-seguimiento.js'));
    const iI = j70i.indexOf('function indicadoresDe');
    const cI = iI >= 0 ? j70i.slice(iI, j70i.indexOf('\n  }', iI)) : '';
    const separa = /else if \(e\.indicadores\) revisadosSinInd\+\+;/.test(cI) &&
                   /else sinRevisar\+\+;/.test(cI);
    const porActos = /e\.tipoMedicion === 'actividad'/.test(cI) && /actos\+\+;/.test(cI);
    comprobar('y el recuento separa la lista vacía de la ausencia del campo',
      separa,
      separa ? 'indicadoresDe cuenta los tres estados aparte'
             : 'dejó de separarlos: un acto revisado volvería a contarse como pendiente');
    comprobar('y los cuenta sobre los ACTOS, no sobre todos los hechos del mandato',
      porActos,
      porActos ? 'el denominador son las entradas de «actividad»'
               : 'cuenta sobre todos los hechos: infla un pendiente que nadie puede bajar (v999)');

    const iB = j70i.indexOf('function ejeB');
    const cB = iB >= 0 ? j70i.slice(iB, j70i.indexOf('\n  }', iB)) : '';
    const leeB = /ind\.sinRevisar/.test(cB) && !/ind\.sinDeclarar/.test(cB);
    comprobar('y el eje B explica su cero con los actos sin revisar',
      leeB,
      leeB ? 'ejeB lee ind.sinRevisar'
           : 'dejó de leerlo: el eje volvería a decir que falta clasificar lo que ya se clasificó');
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
    /* El denominador son las que CUENTAN en el eje A, no todas las
       documentadas: a una que el registro deja fuera a propósito —`cuenta:
       false`, una conversión religiosa— no se le declara identidad de objeto
       sin ensuciar un caso que no aplica (v925). Con el denominador ancho este
       renglón no podría llegar a cero nunca, que es el mismo error que la v999
       corrigió con el nivel de gobierno. */
    'identidad-declarada': (m) => {
      const cuentan = m.contr.filter(c => c.cuenta !== false);
      const sin = cuentan.filter(c => !('mismoObjetoVerificado' in c));
      return { hecho: cuentan.length > 0 && sin.length === 0,
               cuanto: sin.length + ' de ' + cuentan.length + ' documentadas que cuentan, sin identidad' };
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
      /* «Todo declarado» crece con la tabla: el dia que entra una medicion
         nueva, este caso tiene que traer SU material o la guarda de la guarda
         la denuncia por muda —que es exactamente lo que paso al entrar
         `indicador-declarado` en la v1051, y es lo que tenia que pasar—. */
      ents: [{ fuentes: [{ rol: 'acto' }], nivelGobierno: 'nacional',
               tipoMedicion: 'actividad', indicadores: ['I-04'] }],
      /* Con una EXENTA sin declarar dentro, que es el caso real: a la que el
         registro deja fuera de la cuenta a propósito no se le declara identidad
         de objeto. Sin ella, el día que alguien ensanche el denominador a todas
         las documentadas, este renglón no podría llegar a cero nunca y nada lo
         diría — contra el registro de verdad eso no se ve, porque el renglón
         sigue pendiente por otra razón (v970). */
      contr: [{ estado: 'documentada', mismoObjetoVerificado: true },
              { estado: 'documentada', cuenta: false }],
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

console.log('\n  -- lo que se toca, y lo que el marcado dice que es (v1014) --');
{
  const c68 = leer('css/68-procity-reconocimiento.css');
  const c72 = leer('css/72-edu-diseno.css');
  const j68 = leer('js/68-procity-reconocimiento.js');

  /* El piso NO se escribe aca: sale del control que este modulo ya hizo alto
     a proposito —el deslizador del radio, con su `height` declarado y su
     comentario al lado: «el control se toca con el dedo, asi que va alto».
     Un numero traido de otra pantalla seria el numero a ojo de la v869. */
  const gRango = c72.match(/\.pcr-hoja \.pcr-rango\{[^}]*height:\s*(\d+)px/);
  const PISO = gRango ? Number(gRango[1]) : 0;

  /* Los objetivos de toque propios del modulo: los que se tocan para ACTUAR,
     no los rotulos que apuntan a un campo —ahi el objetivo es el campo, que
     mide 41 px—. Son tres, y los tres salieron medidos por debajo del piso:
     las dos asas (19 y 21 px) y la fila que decide cual es la cuadra del
     lote (19 px), que no es una molestia sino publicar la cuadra de otro. */
  const TOCABLES = ['.pcr-asa', '.pcr-asa-abierta', '.pcr-act-r'];
  const sinAlto = TOCABLES.filter(function (sel) {
    const esc2 = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc2 + '\\s*\\{[^}]*\\}', 'g');
    let m, ok = false;
    while ((m = re.exec(c68))) {
      const g = m[0].match(/min-height:\s*(\d+)px/);
      if (g && Number(g[1]) >= PISO) ok = true;
    }
    return !ok;
  });

  if (!PISO) {
    anotarSinMaterial('MATERIAL - el modulo declara su piso de toque',
      'no se pudo leer el alto del deslizador: lo de abajo no tendria contra que medir');
  } else {
    comprobar('MATERIAL - el modulo declara su piso de toque', true,
      'el deslizador del radio declara ' + PISO + ' px, que es «lo minimo que no se falla»');

    comprobar('los objetivos de toque del modulo llegan a ese piso',
      sinAlto.length === 0,
      sinAlto.length === 0
        ? 'las dos asas y la fila de la cuadra del lote declaran min-height >= ' + PISO + ' px'
        : sinAlto.join(' · ') + ' — se quedan por debajo de los ' + PISO +
          ' px que el propio modulo llama el minimo que no se falla');

    /* Y el alto va en la REGLA y no en un comentario: el asa de la hoja
       abierta decia «24 px de zona tocable» y la regla daba 19 —9 + 5 + 5—,
       que es una propiedad afirmada y no cumplida (v926). */
    const iAsa = c68.indexOf('.pcr-asa-abierta{');
    const comentario = iAsa > 0 ? c68.slice(Math.max(0, iAsa - 700), iAsa) : '';
    const prometeOtro = /(\d+)\s*px de zona tocable/.exec(comentario);
    comprobar('y el alto de un asa no se promete en un comentario',
      !prometeOtro || Number(prometeOtro[1]) === PISO,
      !prometeOtro ? 'el comentario no afirma una cifra: la cifra esta en la regla'
        : (Number(prometeOtro[1]) === PISO
            ? 'el comentario dice los mismos ' + PISO + ' px que la regla'
            : 'el comentario promete ' + prometeOtro[1] + ' px y la regla declara ' + PISO));

    /* Una etiqueta que no etiqueta nada anuncia un control que no existe. El
       modulo tenia siete: tres encabezaban un GRUPO de botones —eso es
       `role="group"` con `aria-labelledby`, no un `<label>`— y cuatro eran
       rotulos sobre una cifra. */
    const re = /<label\b[^>]*>/g; let m; const malos = [];
    while ((m = re.exec(j68))) {
      if (/\bfor=/.test(m[0])) continue;
      const hasta = j68.slice(m.index, m.index + 900);
      const cierra = hasta.indexOf('</label>');
      const cuerpo = cierra > 0 ? hasta.slice(0, cierra) : hasta;
      if (/<(input|select|textarea)\b/.test(cuerpo)) continue;
      malos.push(j68.slice(0, m.index).split('\n').length + ' ' + m[0].slice(0, 46));
    }
    comprobar('ninguna etiqueta del modulo etiqueta la nada',
      malos.length === 0,
      malos.length === 0
        ? 'las ' + (j68.match(/<label\b[^>]*>/g) || []).length +
          ' etiquetas llevan su `for` o su control dentro'
        : malos.slice(0, 6).join(' · ') + ' — anuncian un control que no existe');

    /* La guarda de la guarda: todo lo de arriba se mide contra el piso que
       declara el deslizador. Si dejara de declararlo, el piso caeria a cero y
       las comprobaciones pasarian sin mirar nada (v878). */
    /* La razon va partida en dos renglones en la hoja, asi que se busca la
       mitad que cabe en uno: es la que dice POR QUE son esos pixeles. */
    const conRazon = /lo m[ií]nimo que no se falla/i.test(c72);
    comprobar('y el piso sigue saliendo del control que el modulo hizo alto',
      PISO >= 24 && conRazon,
      (PISO >= 24 && conRazon)
        ? 'sale de .pcr-rango (' + PISO + ' px), con su razon escrita al lado'
        : (PISO < 24
            ? 'el deslizador declara ' + PISO + ' px: el piso saldria de la nada'
            : 'el deslizador perdio la razon escrita: el numero quedaria sin de donde'));
  }
}

console.log('\n  -- el piso de texto vale en toda la pagina, no solo en la ficha (v1015) --');
{
  const j70 = leer('js/70-seguimiento.js');
  const c70 = leer('css/70-seguimiento.css').replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  const h70 = leer('seguimiento.html');

  /* El modulo declara la regla en su propio :root: «--t-9 son solo etiquetas
     en mayusculas y sellos; el texto corrido mas pequeño es --t-8». Se lee de
     ahi y no se escribe aca (v869). */
  const declara = /--t-9 son solo etiquetas/.test(leer('css/70-seguimiento.css')) &&
                  /el texto\s*\n?\s*corrido m[aá]s pequeño es --t-8/.test(leer('css/70-seguimiento.css'));

  /* Que clases pone el modulo en un <p> o un <li>. Los dos caminos: el
     ayudante `el()` que arma el DOM, y el HTML de la pagina —`.sp-nextup`
     vive ahi, y mirando solo el JS se escapaba—. */
  const enParrafo = new Set();
  let m;
  const reEl = /\bel\(\s*'(p|li)'\s*,\s*'([^']*)'/g;
  while ((m = reEl.exec(j70))) m[2].split(/\s+/).forEach((x) => { if (x) enParrafo.add(x); });
  const reHtml = /<(p|li)\b[^>]*class="([^"]+)"/g;
  while ((m = reHtml.exec(h70))) m[2].split(/\s+/).forEach((x) => { if (x) enParrafo.add(x); });

  /* Y que declara la regla de cada clase. */
  const reglas = {};
  const reCss = /([^{}]+)\{([^{}]*)\}/g;
  while ((m = reCss.exec(c70))) {
    const cuerpo = m[2];
    m[1].split(',').forEach(function (s) {
      const g = s.trim().match(/\.([a-z0-9-]+)$/);
      if (!g) return;
      if (!reglas[g[1]]) reglas[g[1]] = { t9: false, may: false };
      if (/--t-9/.test(cuerpo)) reglas[g[1]].t9 = true;
      if (/text-transform:\s*uppercase/.test(cuerpo)) reglas[g[1]].may = true;
    });
  }

  /* El defecto: una clase que el modulo pone en un parrafo —o sea, texto
     corrido por su propia definicion, la que su suite usa desde la v791— y
     que lleva el tamaño que el modulo reserva para las ETIQUETAS. Las que
     ademas van en versalitas quedan fuera: ahi la regla las admite. */
  /* La definicion del modulo tiene tres partes —parrafo, mas de 40
     caracteres, y no ser una etiqueta— y una comprobacion estatica solo
     puede ver dos. La tercera cuesta esta excepcion, con su razon escrita:
     `.sp-count` es un CONTADOR —«184 hechos registrados»— que nunca pasa de
     cuarenta caracteres, asi que por la propia definicion no es texto
     corrido. Es una sola y se ve; una lista larga aca seria la que envejece
     hasta no significar nada (v895). */
  const NO_ES_CORRIDO = [['sp-count', 'es un contador de una linea, nunca pasa de 40 caracteres']];
  const malas = [...enParrafo]
    .filter((x) => reglas[x] && reglas[x].t9 && !reglas[x].may)
    .filter((x) => !NO_ES_CORRIDO.some((e) => e[0] === x))
    .sort();

  if (!declara || !enParrafo.size) {
    anotarSinMaterial('MATERIAL - el modulo declara para que es cada tamaño',
      !declara ? 'la regla de --t-9 ya no esta escrita en la hoja'
               : 'no se leyo ninguna clase de parrafo');
  } else {
    comprobar('MATERIAL - el modulo declara para que es cada tamaño', true,
      'la hoja dice que --t-9 es solo para etiquetas, y el modulo pone ' + enParrafo.size +
      ' clases distintas en un parrafo');

    comprobar('ningun texto corrido lleva el tamaño que el modulo reserva a las etiquetas',
      malas.length === 0,
      malas.length === 0
        ? 'las ' + Object.keys(reglas).filter((k) => reglas[k].t9).length +
          ' reglas con --t-9 son etiquetas o sellos, ninguna es un parrafo'
        : malas.map((x) => '.' + x).join(' · ') +
          ' — el modulo las pinta en un <p> y las mide como etiqueta');

    /* Y la guarda de la guarda: lo de arriba se apoya en saber que clases
       van en un parrafo. Si se dejaran de leer los dos caminos, la lista
       quedaria corta y pasaria sin mirar lo que falta. */
    /* Se mide sobre la LISTA que la comprobacion de arriba usa, no sobre los
       archivos: que contenga al menos una clase que solo existe en el HTML.
       Medido contra los archivos, la aserción pasaba igual con el camino del
       HTML retirado — medía el material y no el mecanismo (v890). */
    const soloJs = new Set();
    let z; const reEl2 = /\bel\(\s*'(p|li)'\s*,\s*'([^']*)'/g;
    while ((z = reEl2.exec(j70))) z[2].split(/\s+/).forEach((x) => { if (x) soloJs.add(x); });
    const dePagina = [...enParrafo].filter((x) => !soloJs.has(x));
    comprobar('y la lista trae los parrafos que solo existen en el HTML de la pagina',
      dePagina.length > 0,
      dePagina.length
        ? dePagina.length + ' clases de parrafo vienen solo del HTML, entre ellas .' + dePagina[0]
        : 'ninguna: se estaria leyendo solo el JS, y asi se escapaba .sp-nextup');
  }

  /* ══ UN TOKEN QUE NO EXISTE NO PINTA NADA ═════════════════════════
     `color: var(--tinta)` con `--tinta` declarado en ninguna parte es CSS
     valido y no pinta nada: la propiedad queda invalida al calcular, asi que
     un color se hereda y un fondo sale transparente. En el codigo se lee
     perfecto, y nadie lo dice.

     Lo cometí dos veces —la v1050 con `--papel` por `--marfil` y la v1056 con
     `--tinta` por `--ink`— y al medirlo había SIETE mas de antes, entre ellos
     una cifra de la ficha presidencial que heredaba el gris de la prosa de al
     lado en vez de la tinta fuerte, medido en el navegador.

     EL DISCRIMINANTE ES EL RESPALDO, y eso se midio antes de escribirlo:
       · «todo var() declarado en css»            → 44 denuncias, casi todas
         legitimas: 33 tokens los pone el JS con `setProperty`
       · «… ni declarado ni puesto por el JS»      → 13, y la mayoria llevan su
         respaldo literal al lado, que es defensivo y correcto
       · «… y SIN respaldo»                       → 7, cero falsos positivos
     Sobre 3.001 usos de `var()`, y sin una sola excepcion escrita —que es la
     lista que envejece hasta no significar nada (v895)—. */
  {
    const sincom = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const hojas = fs.readdirSync(path.join(RAIZ, 'css')).filter((f) => f.endsWith('.css')).sort();
    const declarados = new Set();
    const usos = [];
    hojas.forEach((f) => {
      const t = sincom(leer(path.join('css', f)));
      let m;
      const reD = /(--[A-Za-z0-9_-]+)\s*:/g;
      while ((m = reD.exec(t))) declarados.add(m[1]);
      /* El respaldo se reconoce por la coma que sigue al nombre: `var(--x, #fff)`
         pinta aunque `--x` no exista, asi que no es el defecto. */
      const reU = /var\(\s*(--[A-Za-z0-9_-]+)\s*(,?)/g;
      while ((m = reU.exec(t))) {
        usos.push({ f: f, v: m[1], resp: !!m[2], ln: t.slice(0, m.index).split('\n').length });
      }
    });
    /* Un token que el JS pone con `setProperty` no se declara en el CSS y es
       correcto: es como este modulo le pasa el color de cada serie a su
       dibujo. Se leen los dos caminos o la guarda denunciaria 33 sitios
       sanos. */
    const puestos = new Set();
    fs.readdirSync(path.join(RAIZ, 'js')).filter((f) => f.endsWith('.js')).forEach((f) => {
      const t = leer(path.join('js', f));
      let m;
      const reP = /setProperty\(\s*['"](--[A-Za-z0-9_-]+)/g;
      while ((m = reP.exec(t))) puestos.add(m[1]);
      const reI = /(--[A-Za-z0-9_-]+)\s*:/g;
      while ((m = reI.exec(t))) puestos.add(m[1]);
    });
    /* Las paginas se listan del disco y no de una lista escrita, para que una
       nueva quede vigilada sin que su autor se acuerde (v867). */
    fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html')).forEach((f) => {
      const t = sincom(leer(f));
      let m; const reD = /(--[A-Za-z0-9_-]+)\s*:/g;
      while ((m = reD.exec(t))) declarados.add(m[1]);
    });

    comprobar('MATERIAL · las hojas se dejan leer, con sus tokens y sus usos',
      hojas.length > 10 && declarados.size > 50 && usos.length > 500,
      hojas.length > 10 && declarados.size > 50 && usos.length > 500
        ? hojas.length + ' hojas · ' + declarados.size + ' tokens declarados · ' +
          usos.length + ' usos de var(), de los que ' + usos.filter((u) => u.resp).length +
          ' llevan respaldo'
        : 'NO PUDO CORRER: ' + hojas.length + ' hojas · ' + declarados.size +
          ' tokens · ' + usos.length + ' usos, asi que no vigilaria nada');

    const huerfanos = usos.filter((u) => !u.resp && !declarados.has(u.v) && !puestos.has(u.v));
    comprobar('ningun var() sin respaldo apunta a un token que no existe',
      huerfanos.length === 0,
      huerfanos.length === 0
        ? 'los ' + usos.filter((u) => !u.resp).length + ' usos sin respaldo apuntan a un token ' +
          'declarado en el CSS o puesto por el JS'
        : huerfanos.length + ' no pintan nada, y en el codigo se leen bien: ' +
          huerfanos.slice(0, 6).map((u) => 'css/' + u.f + ':' + u.ln + ' var(' + u.v + ')').join(' · '));

    /* La guarda de la guarda: si se dejara de leer lo que el JS pone, la de
       arriba seguiria en verde y denunciaria 33 sitios sanos —o, al reves,
       quitando el respaldo del discriminante denunciaria 13 mas—. Se mide que
       los dos filtros sigan teniendo material que descartar. */
    const porJs = usos.filter((u) => !u.resp && !declarados.has(u.v) && puestos.has(u.v));
    const porResp = usos.filter((u) => u.resp && !declarados.has(u.v) && !puestos.has(u.v));
    comprobar('y los dos filtros que la acotan siguen descartando algo',
      porJs.length > 0 && porResp.length > 0,
      porJs.length > 0 && porResp.length > 0
        ? porJs.length + ' los pone el JS y ' + porResp.length + ' llevan su respaldo literal: ' +
          'sin esos dos filtros la guarda daria rojo sobre lo que esta bien'
        : 'un filtro se quedo sin nada que descartar (js=' + porJs.length +
          ', respaldo=' + porResp.length + '), asi que ya no acota y puede haberse vuelto vacuo');
  }
}

console.log('\n  -- un plural no se fabrica pegando «es» (v1018) --');
{
  /* Regla de ortografia, estructural y SIN EXCEPCIONES: una palabra aguda
     terminada en vocal con tilde + n pierde la tilde al pasar al plural
     -edificacion→edificaciones, capitan→capitanes, jardin→jardines,
     almacen→almacenes, atun→atunes-. Asi que pegarle «es» produce siempre
     una falta de ortografia.

     Y la falta NO SE PUEDE BUSCAR EN EL CODIGO: «edificaciónes» no esta
     escrito en ninguna parte, se fabrica al componer. Por eso llevaba
     versiones impresa en el informe de empresas y en la hoja del curso sin
     que nada la viera: lo unico que la ensena es un documento compuesto, y
     la unica suite que compone un documento mira la lamina.

     DE QUE NO RESPONDE, dicho (v945, v952): de las palabras terminadas en
     vocal con tilde + s, porque ahi no hay regla estructural -ingles→ingleses
     pierde la tilde y pais→paises la conserva, que es hiato y no
     acentuacion-; y de un plural mal escrito ENTERO, que ese si se puede
     grepear y hoy no hay ninguno. Tampoco de pegar «s» a secas, que en las
     acabadas en vocal con tilde es lo correcto: cafe→cafes, sofa→sofas. */
  const archivos = fs.readdirSync(R('js')).filter((f) => /\.js$/.test(f)).map((f) => 'js/' + f)
    .concat(fs.readdirSync(RAIZ).filter((f) => /\.html$/.test(f)));

  /* El barrido, en una funcion: la comprobacion de abajo lo corre contra
     casos de respuesta conocida, asi que tiene que ser EL MISMO y no una
     copia -una copia se separaria a la tanda siguiente (v879)-. */
  const CON_TILDE = /[áéíóú]n$/;
  function pegados(txt) {
    const re = /([A-Za-zÁÉÍÓÚÑáéíóúñ]+)'\s*\+\s*[^;\n]{0,80}?'es'/g;
    const out = [];
    let m;
    while ((m = re.exec(txt))) {
      out.push({ palabra: m[1], en: m.index, mal: CON_TILDE.test(m[1]) });
    }
    return out;
  }

  const todos = [], malos = [];
  archivos.forEach((rel) => {
    const crudo = leer(rel);
    /* Se mira el CODIGO y no el archivo: un ejemplo dentro de un comentario
       -como los de este mismo bloque- no imprime nada. `soloCodigo` conserva
       las posiciones, asi que el numero de linea sigue siendo el de verdad. */
    const txt = /\.js$/.test(rel) ? soloCodigo(crudo) : crudo;
    pegados(txt).forEach((p) => {
      const linea = txt.slice(0, p.en).split('\n').length;
      const sitio = rel + ':' + linea + ' «' + p.palabra + '»';
      todos.push(sitio);
      if (p.mal) malos.push(sitio + ' → «' + p.palabra + 'es»');
    });
  });

  /* MATERIAL primero (v920): sin sitios que fabriquen plurales, lo de abajo
     pasaria por no tener nada que rechazar. */
  if (todos.length < 3) {
    anotarSinMaterial('MATERIAL - hay sitios que fabrican un plural pegando «es»',
      'solo ' + todos.length + ': el barrido no tendria casi nada que mirar');
  } else {
    comprobar('MATERIAL - hay sitios que fabrican un plural pegando «es»',
      true, todos.length + ' sitios pegan «es» a una palabra escrita aparte');

    /* Falla CERRADO (v880): un sitio nuevo con una palabra acentuada sale en
       rojo en su primera corrida, no cuando alguien lea el papel. */
    comprobar('ninguno se lo pega a una palabra que termina en vocal con tilde',
      malos.length === 0,
      malos.length
        ? malos.length + ' fabrican una falta que no esta escrita en ningun sitio: ' +
          malos.slice(0, 4).join(' · ')
        : 'los ' + todos.length + ' pegan «es» a palabras sin tilde, donde es correcto');
  }

  /* LA GUARDA DE LA GUARDA (v878). Si el barrido dejara de reconocer la
     forma, todo lo de arriba seguiria en verde sin vigilar una palabra. Se
     mide contra casos de respuesta conocida, como la de -ste en la v945. */
  const DENUNCIA = [
    "' edificación' + (e.total === 1 ? '' : 'es')",
    "' construcción' +\n  (n === 1 ? '' : 'es')",
    "'jardín' + (n === 1 ? '' : 'es')"
  ];
  const NO_DENUNCIA = [
    "' corredor' + (n === 1 ? '' : 'es')",     // sin tilde: corredores
    "' anterior' + (n === 1 ? '' : 'es')",     // sin tilde: anteriores
    "(n === 1 ? 'edificación' : 'edificaciones')",  // los dos literales, que es el arreglo
    "' café' + (n === 1 ? '' : 's')"           // pega «s», no «es»: cafés
  ];
  const fallaAlDenunciar = DENUNCIA.filter((c) => !pegados(c).some((p) => p.mal));
  const fallaAlCallar = NO_DENUNCIA.filter((c) => pegados(c).some((p) => p.mal));
  comprobar('el barrido reconoce la forma, y solo esa',
    fallaAlDenunciar.length === 0 && fallaAlCallar.length === 0,
    fallaAlDenunciar.length
      ? 'no denuncia: ' + fallaAlDenunciar[0]
      : fallaAlCallar.length
        ? 'denuncia lo que esta bien: ' + fallaAlCallar[0]
        : 'denuncia los ' + DENUNCIA.length + ' malos y calla los ' + NO_DENUNCIA.length + ' buenos');

  /* Y que el barrido siga mirando el CODIGO. Comparar los dos recuentos del
     archivo de verdad no comprueba nada -uno es siempre menor o igual que el
     otro-, asi que va contra un caso de respuesta conocida: la misma falta,
     una vez en codigo y otra dentro de un comentario. */
  const enCodigo = "var s = ' edificación' + (n === 1 ? '' : 'es');";
  const enComentario = '// ' + enCodigo;
  const veLaDeCodigo = pegados(soloCodigo(enCodigo)).some((p) => p.mal);
  const veLaDelComentario = pegados(soloCodigo(enComentario)).some((p) => p.mal);
  comprobar('el barrido lee el codigo y no el comentario',
    veLaDeCodigo && !veLaDelComentario,
    !veLaDeCodigo
      ? 'no ve la que esta en codigo: no vigilaria nada'
      : veLaDelComentario
        ? 've la que esta en un comentario: denunciaria los ejemplos de este mismo bloque'
        : 've la falta en codigo y no la del comentario');
}

console.log('\n  -- una cifra de 1 no lleva un plural detras (v1019) --');
{
  /* La regla es la de la v874 -«1 piezas de servicios registradas» se lee
     como un descuido de quien firma la hoja- y se persigue desde entonces
     SOBRE EL PAPEL COMPUESTO, que es donde el defecto existe. La unica suite
     que compone un documento compone la lamina, asi que el informe de
     empresas y la hoja del curso se escapaban.

     Esta es la version estatica de esa regla: todo sitio que pegue un plural
     detras de una cifra tiene que tener su rama de singular.

     POR QUE SOLO ESTOS ARCHIVOS, y no el repositorio entero: la clase esta en
     todas partes -medido, 460 sitios sin rama en 33 archivos, con 108
     palabras distintas- y arreglarla es varias tandas. Estos tres son los que
     esta tanda MIDIO SOBRE EL PAPEL: se compuso el informe con las hojas
     valiendo 1 de verdad y se barrio el documento. Un archivo que entre aqui
     tiene que venir con su papel medido, no con una promesa. */
  const ARCHIVOS = ['js/62-analisis-ia-app.js', 'js/63-analisis-ia-informe.js',
                    'js/65-analisis-edu-ui.js', 'js/70-seguimiento.js',
                    /* js/26 entra con su PAPEL medido, que es el contrato de
                       arriba: se dibujo un area en Pro City con UN solo
                       elemento mapeado -el analisis de ese modulo es local y
                       no sale a la red-, se compusieron las cuatro piezas del
                       diagnostico y se barrio el documento. Salian «1
                       elementos» dos veces, una de ellas en la frase que
                       existe PARA el sector de pocos elementos. */
                    'js/26-procity-diagnostico.js', 'js/24-procity-analisis.js'];

  /* Palabras que acaban en «s» y no son plurales, con su razon al lado. Es la
     misma forma que la lista de invariables de `tdoslaminas` y que el `leeme`
     de la v897: se declara una por una y se ve por que. */
  const NO_ES_PLURAL = [
    ['ms', 'simbolo de milisegundo: un simbolo de unidad no se pluraliza'],
    ['billones', 'magnitud del presupuesto en decenas o centenas, no una cardinalidad'],
    ['más', 'comparativo: «1 más» es correcto y no lleva plural detras'],
  ];

  /* El barrido, en una funcion, para que la guarda de la guarda corra EL
     MISMO y no una copia (v879). */
  function sinRama(txt) {
    const re = /\+\s*'((?:<\/[a-z]+>)?[ ·]+([a-záéíóúñ]+s))\b/g;
    const out = [];
    let m;
    while ((m = re.exec(txt))) {
      const antes = txt.slice(Math.max(0, m.index - 160), m.index);
      /* `\s*` y no ` *`: el ternario parte de linea a menudo -`n === 1\n ? …`-
         y con el espacio simple la guarda daba por pelado un sitio que si
         tiene su rama. Lo destapo js/70, donde esa forma es la corriente. */
      /* `[?)]` y no solo `?`: la rama puede ser un `if (d === 1) return
         'ayer';` y no un ternario. Lo destapo js/24, donde esa es la forma
         corriente, y sin esto la guarda denunciaba un sitio que SI la tiene
         -un rojo sobre codigo correcto ensena a ignorar la salida (v895). */
      const tieneRama = /===\s*1\s*[?)]|!==\s*1\s*[?)]|plural\(|\bpl\(|\bcn\(/.test(antes);
      /* Una cifra que es una CONSTANTE del modulo no puede valer 1 sin que
         alguien edite la constante, asi que no hay rama que escribir. */
      const deConstante = /\b([A-Z][A-Z0-9_]{3,})\s*$/.test(antes);
      out.push({ palabra: m[2], en: m.index, sinRama: !tieneRama && !deConstante });
    }
    return out;
  }

  /* El MATERIAL no puede ser «cuantos sitios usan la forma mala»: arreglarlos
     lo deja en cero y la guarda se quedaria sin material por haber MEJORADO
     el codigo, que es la trampa de la v970. Lo que sobrevive al cero es otra
     cosa: que estos archivos sigan imprimiendo sustantivos contados. Se
     cuentan los de las dos formas -con rama y sin ella-. */
  /* `cn(` entra en el MATERIAL: es la forma con la que js/24 y js/26
     escriben hoy casi todos sus contados, y sin ella el recuento no se movia
     al entrar dos archivos enteros -o sea que decia mirar mas de lo que
     miraba-. */
  const CON_RAMA = /\?\s*'[ ·]*[a-záéíóúñ]+'\s*:\s*'[ ·]*[a-záéíóúñ]+s'|\b(?:plural|pl|cn)\(/g;
  const exentas = new Set(NO_ES_PLURAL.map((x) => x[0]));
  let sitios = 0;
  const pelados = [];
  ARCHIVOS.forEach((rel) => {
    const txt = soloCodigo(leer(rel));
    sitios += (txt.match(CON_RAMA) || []).length;
    sinRama(txt).forEach((s) => {
      sitios++;
      if (!s.sinRama || exentas.has(s.palabra)) return;
      pelados.push(rel.slice(3, 5) + ':' + txt.slice(0, s.en).split('\n').length + ' «' + s.palabra + '»');
    });
  });

  /* MATERIAL primero (v920). */
  if (sitios < 10) {
    anotarSinMaterial('MATERIAL - los ' + ARCHIVOS.length + ' archivos imprimen sustantivos contados',
      'solo ' + sitios + ' sitios: el barrido no tendria casi nada que mirar');
  } else {
    comprobar('MATERIAL - los ' + ARCHIVOS.length + ' archivos imprimen sustantivos contados',
      true, sitios + ' sitios ponen un sustantivo detras de una cifra');

    comprobar('todos llevan su rama de singular',
      pelados.length === 0,
      pelados.length
        ? pelados.length + ' imprimirian «1 cosas» en el papel: ' + pelados.slice(0, 5).join(' · ')
        : 'los ' + sitios + ' la llevan, salvo ' + NO_ES_PLURAL.length +
          (NO_ES_PLURAL.length === 1 ? ' declarada aparte: ' : ' declaradas aparte: ') + NO_ES_PLURAL.map((x) => '«' + x[0] + '» ' + x[1]).join(' · '));
  }

  /* LA GUARDA DE LA GUARDA (v878): el barrido reconoce la forma y la rama. */
  /* El caso «con rama» tiene que SER UNO QUE EL BARRIDO ENCUENTRE, o la
     comprobacion pasa por no casar el patron y no por reconocer el ternario
     -asi estaba escrita la primera version, y una inyeccion lo destapo-. Este
     sale de js/62: el patron casa en «+ ' usos de este analisis'» y el
     ternario esta a la vista, unas palabras antes. */
  const SIN = "'<p>' + n + ' usos identificados</p>'";
  const CON = "(n === 1 ? 'Un uso' : n + ' usos de este analisis') + ' y no viene'";
  const CON_PL = "plural(n, 'uso', 'usos') + ' de ' + m + ' usos totales'";
  const CON_SALTO = "x.n === 1\n      ? 'un uso' : x.n + ' usos del sector'";
  const DE_CONSTANTE = "'faltan ' + FICHA_MIN_CASOS + ' casos de postura'";
  const CON_IF = "if (d === 1) return 'ayer';\n    return 'hace ' + d + ' días';";
  /* El caso de `cn` tiene que ser uno que el barrido ENCUENTRE, o pasa por no
     casar el patron y no por reconocer la rama -la trampa de la v1019, en la
     que ya cai una vez-. Este casa en «+ ' triangulos'» y tiene el `cn(` unas
     palabras antes, que es la forma de js/24. */
  const CON_CN = "S.geo.ultimoDato = cn(hilos.length, 'hilo', 'hilos') + ' y ' + tris.length + ' triángulos';";
  const veSin = sinRama(SIN).some((s) => s.sinRama);
  const veCon = sinRama(CON).some((s) => s.sinRama);
  const veConPl = sinRama(CON_PL).some((s) => s.sinRama);
  const veSalto = sinRama(CON_SALTO).some((s) => s.sinRama);
  const veCte = sinRama(DE_CONSTANTE).some((s) => s.sinRama);
  const veIf = sinRama(CON_IF).some((s) => s.sinRama);
  const veCn = sinRama(CON_CN).some((s) => s.sinRama);
  comprobar('el barrido distingue el sitio con rama del que no la tiene',
    veSin && !veCon && !veConPl && !veSalto && !veCte && !veIf && !veCn,
    !veSin ? 'no ve el que NO tiene rama: no vigilaria nada'
      : veCon ? 'denuncia un ternario que si esta: daria rojo sobre lo que esta bien'
        : veConPl ? 'no reconoce plural(): denunciaria los sitios de js/67 y js/68'
          : veSalto ? 'no reconoce el ternario partido de linea: es la forma corriente en js/70'
            : veCte ? 'denuncia una cifra que es una constante del modulo'
              : veIf ? 'no reconoce la rama escrita como `if (n === 1) return`: es la forma corriente en js/24'
                : veCn ? 'no reconoce cn(): denunciaria los sitios de js/24 y js/26'
                  : 've el pelado, y calla los cinco que SI la tienen: el ternario en una linea, el partido, el `if`, plural(), cn() y la constante');

  /* Y que la lista de exentas siga siendo lo que dice: una palabra sin su
     razon escrita es una excepcion que envejece hasta no significar nada
     (v895). */
  comprobar('cada palabra exenta lleva su razon escrita',
    NO_ES_PLURAL.every((x) => x[0] && x[1] && x[1].length > 20),
    NO_ES_PLURAL.length + ' exenta(s), cada una con el motivo por el que no es un plural');
}

console.log('\n  -- un grado impreso lleva coma, no punto (v1021) --');
{
  /* La regla es la de la v885 y la v891 -en castellano el punto es de MILES,
     asi que «89.1°» se lee como ochenta y nueve mil-. Se persigue desde
     entonces SOBRE EL PAPEL de la lamina, en `tdoslaminas`, y la ficha no la
     tenia: imprimia «89.1°», «270.8°», «58.7°» y «9.2 %» en pantalla.

     POR QUE SOLO LOS GRADOS. Medido, la misma forma sobre el por ciento da
     153 candidatos en js/68 y casi todos son enteros -`Math.round(pct)`,
     constantes, cuentas-: una guarda asi termina en una lista de excepciones
     que envejece hasta no significar nada (v895). El grado es la unica unidad
     de este modulo que SIEMPRE puede salir fraccionaria -sale de una cuenta
     astronomica- y por eso es la unica que se puede exigir entera. */
  const archivos = fs.readdirSync(R('js')).filter((f) => /\.js$/.test(f)).map((f) => 'js/' + f)
    .concat(fs.readdirSync(RAIZ).filter((f) => /\.html$/.test(f)));

  /* El barrido, en una funcion: la guarda de la guarda corre EL MISMO (v879). */
  const CONVIERTE = /conComa|replace\(|toLocaleString|\bgr\(|nDec|Math\.round|\bn1\(/;
  function gradosPelados(txt) {
    const re = /\+\s*([A-Za-z_$][\w$.[\]()]*)\s*\+\s*'°/g;
    const out = [];
    let m;
    while ((m = re.exec(txt))) out.push({ expr: m[1], en: m.index, pelado: !CONVIERTE.test(m[1]) });
    return out;
  }

  let total = 0;
  const pelados = [];
  archivos.forEach((rel) => {
    const txt = /\.js$/.test(rel) ? soloCodigo(leer(rel)) : leer(rel);
    gradosPelados(txt).forEach((g) => {
      total++;
      if (g.pelado) pelados.push(rel.slice(3, 5) + ':' + txt.slice(0, g.en).split('\n').length + ' ' + g.expr);
    });
  });

  /* MATERIAL primero (v920): sin sitios que impriman grados no hay nada que
     vigilar, y el verde seria vacio. */
  if (total < 10) {
    anotarSinMaterial('MATERIAL - lo servido imprime grados',
      'solo ' + total + ' sitios: el barrido no tendria casi nada que mirar');
  } else {
    comprobar('MATERIAL - lo servido imprime grados',
      true, total + ' sitios concatenan un valor con el signo de grado');

    /* Falla CERRADO (v880): un rotulo nuevo en grados sale en rojo en su
       primera corrida, no cuando alguien mire la pantalla. */
    comprobar('todo grado impreso pasa por un convertidor de coma',
      pelados.length === 0,
      pelados.length
        ? pelados.length + ' saldrian con punto, que en castellano es el separador de MILES: ' +
          pelados.slice(0, 5).join(' · ')
        : 'los ' + total + ' pasan por conComa, gr, n1 o Math.round');
  }

  /* LA GUARDA DE LA GUARDA (v878), contra casos de respuesta conocida. */
  const PELADO = "'a ' + d.alturaMaxima + '°'";
  const CON_COMA = "'a ' + conComa(d.alturaMaxima) + '°'";
  const CON_GR = "'a ' + gr(x.alt) + '°'";
  const REDONDEADO = "'a ' + Math.round(x.alt) + '°'";
  const vePelado = gradosPelados(PELADO).some((g) => g.pelado);
  const veComa = gradosPelados(CON_COMA).some((g) => g.pelado);
  const veGr = gradosPelados(CON_GR).some((g) => g.pelado);
  const veRedondeo = gradosPelados(REDONDEADO).some((g) => g.pelado);
  comprobar('el barrido ve el grado pelado y calla el convertido',
    vePelado && !veComa && !veGr && !veRedondeo,
    !vePelado ? 'no ve el pelado: no vigilaria nada'
      : veComa ? 'denuncia un conComa que si esta'
        : veGr ? 'no reconoce gr(): denunciaria los rotulos de js/74'
          : veRedondeo ? 'denuncia un Math.round, que no puede dar decimales'
            : 've el pelado y calla los tres convertidos');

  /* Y que el barrido siga mirando el CODIGO: en un comentario, un grado
     pelado no imprime nada -los ejemplos de este bloque, sin ir mas lejos-. */
  const enCodigo = "var s = 'a ' + d.alturaMaxima + '°';";
  const veElDeCodigo = gradosPelados(soloCodigo(enCodigo)).some((g) => g.pelado);
  const veElDelComentario = gradosPelados(soloCodigo('// ' + enCodigo)).some((g) => g.pelado);
  comprobar('el barrido lee el codigo y no el comentario',
    veElDeCodigo && !veElDelComentario,
    !veElDeCodigo
      ? 'no ve el que esta en codigo: no vigilaria nada'
      : veElDelComentario
        ? 've el de un comentario: denunciaria los ejemplos de este mismo bloque'
        : 've el grado pelado en codigo y no el del comentario');
}

console.log('\n  -- una distancia no se escribe con punto (v1022) --');
{
  /* La misma regla de la v885 y la v891 que la v1021 llevo a los grados: en
     castellano el punto es el separador de MILES, asi que «5.00 km» se lee
     como cinco mil. Lo que la hace guardable aqui es la UNIDAD: un `toFixed`
     pegado a «km», «km/h», «min/km», «ha» o «%» no puede ser geometria -no
     hay CSS ni camino de SVG que lleve esas letras detras-, asi que es
     siempre un rotulo.

     POR QUE NO TODO `toFixed`. Medido: 307 en lo servido, y separando a ojo
     los que van a un `style=` o a un camino de SVG quedan 123 candidatos con
     una precision mala -la mitad siguen siendo geometria que el patron no
     supo ver-. Eso es la lista de excepciones que envejece (v895). Con la
     unidad pegada, los falsos positivos medidos son CERO.

     Y por que no el metro a secas: «m» es tambien el comando `moveto` de un
     camino de SVG, y el patron no los distingue. Queda fuera, dicho. */
  /* El «%» se acota por lo que le SIGUE, no por lo que tiene delante. Un «%»
     de geometria cierra su declaracion -«'%;background:» o «'%"»- y uno de
     rotulo sigue con texto: «'% al ano», «'% de la oferta». Pedir un espacio
     DELANTE, que es lo que decia esta regla, era una exclusion de geometria
     implicita y por eso se le escapaban los dos rotulos que dicen «% al ano»
     -uno en el informe de empresas y otro en su panel, con la tasa del DANE-.
     Medido con la forma nueva: los dos aparecen y los 16 de geometria no. */
  const UNIDAD = /^\s*(?:\}|\+)?\s*['"`]?\s*(km\/h|min\/km|km|ha|m²|m2|°C|%<|\s%|%(?=[\s\p{L}]))/u;
  const YA_CONVIERTE = /^\s*\.replace\(/;
  const ENVUELTO = /conComa\(\s*$|\bgr\(\s*$|num\(\s*$|numEs\(\s*$/;

  function unidadesPeladas(txt) {
    const re = /\.toFixed\(\s*([12])\s*\)/g;
    const out = [];
    let m;
    while ((m = re.exec(txt))) {
      const fin = m.index + m[0].length;
      const desp = txt.slice(fin, fin + 40);
      /* La unidad se busca PASADO el convertidor: si se mirara solo lo que
         sigue al `toFixed`, un sitio ya arreglado dejaria de contar y el
         MATERIAL se iria a cero por haber mejorado el codigo, que es la
         trampa de la v970 -y la que la v1019 ya pago una vez-. */
      const yaVa = YA_CONVIERTE.test(desp);
      const trasConv = yaVa ? desp.replace(/^\s*\.replace\([^)]*\)/, '') : desp;
      if (!UNIDAD.test(trasConv)) continue;
      const antes = txt.slice(Math.max(0, m.index - 40), m.index);
      out.push({ en: m.index, pelado: !yaVa && !ENVUELTO.test(antes) });
    }
    return out;
  }

  const archivos = fs.readdirSync(R('js')).filter((f) => /\.js$/.test(f)).map((f) => 'js/' + f)
    .concat(fs.readdirSync(RAIZ).filter((f) => /\.html$/.test(f)));
  let total = 0;
  const pelados = [];
  archivos.forEach((rel) => {
    const txt = /\.js$/.test(rel) ? soloCodigo(leer(rel)) : leer(rel);
    unidadesPeladas(txt).forEach((u) => {
      total++;
      if (u.pelado) pelados.push(rel.slice(3, 5) + ':' + txt.slice(0, u.en).split('\n').length);
    });
  });

  if (total < 20) {
    anotarSinMaterial('MATERIAL - lo servido imprime cifras con unidad',
      'solo ' + total + ' sitios: el barrido no tendria casi nada que mirar');
  } else {
    comprobar('MATERIAL - lo servido imprime cifras con unidad',
      true, total + ' sitios pegan un toFixed a km, km/h, min/km, ha o %');

    /* Falla CERRADO (v880): un rotulo nuevo con unidad sale en rojo en su
       primera corrida, no cuando alguien mire la pantalla. */
    comprobar('toda cifra con unidad pasa por la coma',
      pelados.length === 0,
      pelados.length
        ? pelados.length + ' saldrian con punto, que en castellano es el separador de MILES: ' +
          pelados.slice(0, 6).join(' · ')
        : 'los ' + total + ' llevan su .replace o su envoltorio');
  }

  /* LA GUARDA DE LA GUARDA (v878), contra casos de respuesta conocida. */
  const PELADO = "`${d.toFixed(2)} km`";
  const CONVERTIDO = "`${d.toFixed(2).replace('.', ',')} km`";
  const ENVUELTO_OK = "'a ' + conComa(d.toFixed(2)) + ' km'";
  const CAMINO_SVG = "'M' + x.toFixed(2) + ' ' + y.toFixed(2) + 'Z'";
  const vePelado = unidadesPeladas(PELADO).some((u) => u.pelado);
  const veConvertido = unidadesPeladas(CONVERTIDO).some((u) => u.pelado);
  const veEnvuelto = unidadesPeladas(ENVUELTO_OK).some((u) => u.pelado);
  const veCamino = unidadesPeladas(CAMINO_SVG).length > 0;
  comprobar('el barrido ve la unidad pelada y calla la geometria',
    vePelado && !veConvertido && !veEnvuelto && !veCamino,
    !vePelado ? 'no ve la pelada: no vigilaria nada'
      : veConvertido ? 'denuncia un .replace que si esta'
        : veEnvuelto ? 'denuncia un conComa que si esta'
          : veCamino ? 'toma un camino de SVG por un rotulo: daria rojo sobre geometria'
            : 've la pelada, y calla el .replace, el conComa y el camino de SVG');
}

/* UNA CIFRA DEL DIAGNOSTICO PASA POR SU UNICO FORMATEADOR (v1027).
   La guarda de la v1022 caza un `toFixed` pegado a una unidad. En js/26 el
   decimal no viene de un `toFixed` sino de un `Math.round(x * 10) / 10`
   guardado en un campo -`densidad`, `areaHa`, `riesgoPorHa`- y despues
   impreso, asi que aquella no lo ve. Medido sobre el PAPEL -el diagnostico
   compuesto con un solo elemento mapeado- salian «0.1 elem./ha», «0.1
   elementos por hectarea» y «7.07 ha»: el punto decimal de la v885, vivo en
   un modulo que no vigilaba nadie.

   Perseguir «variable + unidad» en todo el repositorio daria falsos
   positivos a montones -la trampa de la v895-. Aqui se puede ser preciso por
   una razon del modulo: js/26 tiene UN solo formateador, `num`, y un solo
   contador, `cn`, que pasa por el. Asi que la regla es exacta: ningun campo
   del objeto de indicadores se imprime sin pasar por uno de los dos.

   Falla CERRADO (v880): un campo nuevo impreso en crudo sale en rojo en su
   primera composicion. Si alguna vez hace falta imprimir un campo de TEXTO,
   va en la lista de abajo con su razon; hoy no hay ninguno. */
/* LA BALDOSA DE CIFRA LLEVA SU SINGULAR (v1028).
   El numero y su rotulo viven en DOS elementos hermanos -`<b>1</b>` y
   `<small>puntos mapeados</small>`-, asi que no los ve ninguna de las reglas
   que este proyecto ya tiene: ni la del papel por NODO de texto -son dos
   nodos- ni la del codigo, que busca una cifra pegada a un plural dentro de
   una misma cadena. Y el lector si los lee juntos: «1 puntos mapeados».

   Se vio componiendo el panel de Pro City con UN punto mapeado. Aqui se puede
   vigilar con precision porque la baldosa se arma en un solo sitio desde la
   v1028: toda llamada cuyo rotulo traiga una palabra en plural pasa tambien
   su forma en singular. Las que no traen ninguna -«por hectarea», «de uso
   mixto»- no la necesitan y no se les pide. */
/* LA BALDOSA, EN TODO LO SERVIDO (v1029).
   La v1028 vigilo la baldosa de js/24, que se arma en un solo sitio. En el
   resto del repositorio se escriben a mano, asi que se persigue la FORMA:
   una cifra en un elemento y su rotulo en el hermano de al lado, sin nada en
   medio. Ese es el caso que no ve ninguna otra regla -ni la del papel por
   nodo de texto, porque son dos nodos, ni la del codigo, porque el rotulo es
   una cadena aparte- y el lector si lo lee junto: «1 usos registrados».

   Una baldosa YA RAMIFICADA no tiene rotulo literal: su `<small>` es una
   expresion con `pl(`. Asi que basta mirar las que conservan el literal, y
   eso hace la comprobacion exacta -sin ventanas de contexto, que es lo que
   me escondio tres baldosas al medir: un `pl(` de la baldosa de al lado
   caia dentro de la ventana y las daba por ramificadas-.

   Lo que queda con rotulo literal tiene que estar declarado aqui, con su
   razon. Falla CERRADO (v880): una baldosa nueva sale en rojo hasta que
   alguien diga si su rotulo concuerda con la cifra o no. */
console.log('\n  -- la baldosa de cifra, en todo lo servido (v1029) --');
{
  /* Rotulos que NO concuerdan con la cifra, con su razon. */
  const NO_CONCUERDA = [
    ['m entre cruces', 'unidad: el metro no se pluraliza con la cifra'],
    ['m al más cercano', 'unidad: el metro no se pluraliza con la cifra'],
    ['m construidos', 'unidad: el plural es de lo construido, no del metro'],
    ['m² construibles', 'unidad: el plural es de lo construible, no del metro'],
    ['m² verdes por hab.', 'unidad: el plural es del verde, no del metro'],
    ['msnm, lo más alto', 'unidad y superlativo'],
    ['msnm, lo más bajo', 'unidad y superlativo'],
    ['dB(A) estimados', 'unidad: el decibelio no se pluraliza con la cifra'],
    ['el más alto', 'superlativo: el valor no es una cuenta'],
    ['el más alto, en pisos', 'superlativo'],
    ['la altura que más se repite', 'el valor es un cajón de alturas, no una cuenta'],
    ['lo que más se repite', 'el valor es una etiqueta, no una cuenta'],
    ['parte el sector en dos', 'el valor es una etiqueta, no una cuenta'],
    ['los encontró el curso', 'el plural es de lo encontrado, no de la cifra'],
    ['sin pisos', 'el plural es del atributo que falta, no de la cifra'],
    ['sin sus plantas', 'el plural es del atributo que falta, no de la cifra'],
    ['años de retorno', 'periodo de retorno: la NSR-10 los da en 475, 975 y 2.475'],
    ['en los últimos 7 días', 'el plural es de la ventana de tiempo, no de la cifra'],
    ['Con pesos neutros (⅓ · ⅓ · ⅓)', 'rótulo fijo: no acompaña a una cuenta']
  ];
  const exentos = new Set(NO_CONCUERDA.map((x) => x[0]));
  const RE_BALDOSA = /<(b|strong|span)[^>]*>\s*'\s*\+\s*([^<]{1,90}?)\s*\+\s*'\s*<\/\1>\s*<(small|span|em|i)[^>]*>([^<{']{2,60})<\/\3>/g;
  const baldosas = (txt) => {
    const out = []; const re = new RegExp(RE_BALDOSA.source, 'g'); let m;
    while ((m = re.exec(txt))) {
      const rot = m[4].trim();
      if (!/\b[a-záéíóúñ]+s\b/.test(rot)) continue;
      out.push({ rot: rot, en: m.index });
    }
    return out;
  };

  const servidos = fs.readdirSync(R('js')).filter((f) => /\.js$/.test(f));
  let conRama = 0;
  const pelados = [];
  servidos.forEach((f) => {
    const txt = soloCodigo(leer('js/' + f));
    conRama += (txt.match(/<(?:small|span|em|i)[^>]*>'\s*\+\s*pl\(/g) || []).length;
    baldosas(txt).forEach((b) => {
      if (exentos.has(b.rot)) return;
      pelados.push('js/' + f.slice(0, 2) + ':' + txt.slice(0, b.en).split('\n').length + ' «' + b.rot + '»');
    });
  });

  /* El MATERIAL es lo que sobrevive al cero (v1022): no «cuantas baldosas
     peladas quedan» -arreglarlas lo deja en cero- sino que lo servido siga
     armando baldosas con su rama. */
  if (conRama < 20) {
    comprobar('MATERIAL · lo servido arma baldosas con su rama de singular', false,
      'NO PUDO CORRER: solo ' + conRama + ' baldosas con rama, así que el barrido no vigilaría casi nada');
  } else {
    comprobar('MATERIAL · lo servido arma baldosas con su rama de singular', true,
      conRama + ' baldosas eligen su rótulo con pl()');
    comprobar('toda baldosa con rótulo literal en plural está declarada',
      pelados.length === 0,
      pelados.length
        ? pelados.length + ' imprimirían «1 cosas» en dos elementos: ' + pelados.slice(0, 5).join(' · ')
        : 'las ' + conRama + ' ramifican, y ' + NO_CONCUERDA.length + ' rótulos van declarados por no ser cuentas');
  }

  /* LA GUARDA DE LA GUARDA: el barrido ve una baldosa pelada y calla la
     ramificada. Sin la segunda mitad denunciaría las que están bien. */
  const PELADA = "'<div><b>' + x.n + '</b><small>parques</small></div>'";
  const RAMIF  = "'<div><b>' + x.n + '</b><small>' + pl(x.n, 'parque', 'parques') + '</small></div>'";
  /* Un rotulo SIN palabra en plural no concuerda con nadie: «1 del sector» y
     «5 del sector» se escriben igual, asi que el barrido tiene que callarlo.
     Sin este caso, quitarle el filtro del plural dejaria la guarda en verde
     denunciando rotulos que estan bien. */
  const SINPL  = "'<div><b>' + x.n + '</b><small>del sector</small></div>'";
  const vePelada = baldosas(PELADA).length === 1;
  const veRamif = baldosas(RAMIF).length === 0;
  const veSinPl = baldosas(SINPL).length === 0;
  comprobar('el barrido ve la baldosa pelada y calla la que ya ramifica',
    vePelada && veRamif && veSinPl,
    !vePelada ? 'no ve la pelada: no vigilaría nada'
      : !veRamif ? 'denuncia una que ya ramifica: daría rojo sobre lo que está bien'
        : !veSinPl ? 'denuncia un rótulo sin plural: no hay nada que concordar ahí'
          : 've la pelada, calla la que elige su rótulo con pl() y la que no lleva plural');

  /* Y que la lista de exentos siga diciendo por que (v895). */
  const sinRazon = NO_CONCUERDA.filter((x) => !x[1] || x[1].length < 8).map((x) => x[0]);
  comprobar('cada rótulo exento lleva su razón',
    sinRazon.length === 0,
    sinRazon.length ? 'sin razón: ' + sinRazon.join(', ')
      : NO_CONCUERDA.length + ' declarados, cada uno con por qué no concuerda');
}

console.log('\n  -- la letra de los dibujos, en milímetros de papel (v1035) --');
{
  /* §21 mide el TAMAÑO DE LOS MAPAS en milimetros de papel desde la v886.
     La letra de dentro de los dibujos no la medía nadie, y medida sobre la
     lamina compuesta salia asi:

         escalera 1,06 mm · curva sismica 1,59 · el grano 1,59
         lo que cabe 1,85 · rosa de vientos 2,65

     El piso NO se inventa: es 2,1 mm, el texto mas chico que la hoja
     imprime a proposito -medido sobre sus 24 tamanos declarados en mm-.
     Tres de los cinco lo pasan ahora; los otros dos quedan declarados.

     La medida es de LAYOUT, asi que no se puede repetir sin navegador. Lo
     que si se puede vigilar es que las cifras que la produjeron no bajen:
     un trinquete sobre las constantes, con los milimetros escritos al lado
     para que quien las cambie sepa contra que se midieron. */
  const j68 = soloCodigo(leer('js/68-procity-reconocimiento.js'));
  const j74 = soloCodigo(leer('js/74-dibujos-analisis.js'));
  const trozo = (txt, nom) => {
    /* Con el parentesis: `indexOf('function curvaDeAmenaza')` casa tambien
       con `curvaDeAmenazaX`, asi que renombrar la funcion dejaba la guarda
       en verde leyendo la de al lado. Lo cazo la inyeccion. */
    const i = txt.indexOf('function ' + nom + '(');
    if (i < 0) return '';
    const j = txt.indexOf('\n  function ', i + 20);
    return txt.slice(i, j < 0 ? txt.length : j);
  };

  /* [ que, texto, patron, minimo, mm medidos ] */
  const PISOS = [
    ['la escalera · el nombre de cada casilla', trozo(j68, 'escalasAnidadas'),
     /font-size="([\d.]+)" fill="' \+ \(ultimo/, 5.4, '2,38 mm'],
    ['la escalera · las dos líneas del pie', trozo(j68, 'escalasAnidadas'),
     /font-size="([\d.]+)" fill="#0A6F9E"/, 4.6, '2,38 mm'],
    ['el grano · el lado de cada cuadrado', trozo(j68, 'granoDeManzana'),
     /text-anchor="middle" font-size="([\d.]+)"/, 4.2, '2,38 mm'],
    ['la curva sísmica · los rótulos de los ejes', trozo(j74, 'curvaDeAmenaza'),
     /font-size="([\d.]+)" fill="' \+ GRIS/, 9, '1,85 mm · sigue bajo el piso'],
  ];

  const leidos = PISOS.map(([q, txt, re, min, mm]) => {
    const m = txt ? re.exec(txt) : null;
    return { q: q, v: m ? +m[1] : null, min: min, mm: mm };
  });
  const sinLeer = leidos.filter((x) => x.v == null);

  if (sinLeer.length) {
    comprobar('MATERIAL · los tamaños de letra de los dibujos se pueden leer', false,
      'NO PUDO CORRER: ' + sinLeer.length + ' de ' + leidos.length +
      ' cambiaron de forma (' + sinLeer.map((x) => x.q).join(' · ') + ')');
  } else {
    comprobar('MATERIAL · los tamaños de letra de los dibujos se pueden leer', true,
      leidos.map((x) => x.v).join(' · ') + ' unidades');
    const bajos = leidos.filter((x) => x.v < x.min);
    comprobar('ningún dibujo achica su letra por debajo de lo medido',
      bajos.length === 0,
      bajos.length
        ? bajos.map((x) => x.q + ': ' + x.v + ' contra ' + x.min + ' (dio ' + x.mm + ')').join(' · ')
        : leidos.map((x) => x.q.split(' · ')[0] + ' ' + x.mm).filter((v, i, a) => a.indexOf(v) === i).join(' · '));
  }

  /* Y el piso, que es lo que hace que los numeros de arriba signifiquen algo:
     sale del texto mas chico que la hoja imprime a proposito. Si la hoja
     bajara de 2,1 mm, el piso seria otro y habria que volver a medir. */
  const mms = (j68.match(/font-size:\s*([\d.]+)mm/g) || [])
    .map((s) => +(/([\d.]+)mm/.exec(s)[1])).sort((a, b) => a - b);
  comprobar('el piso sale de la hoja y no de un número a ojo',
    mms.length > 20 && mms[0] >= 2 && mms[0] <= 2.2,
    mms.length <= 20 ? 'NO PUDO CORRER: solo ' + mms.length + ' tamaños leídos de la hoja'
      : (mms[0] < 2 || mms[0] > 2.2)
        ? 'la hoja bajó su texto más chico a ' + mms[0] + ' mm: el piso de 2,1 hay que volver a medirlo'
        : 'el texto más chico que la hoja imprime a propósito son ' + mms[0] + ' mm, de ' + mms.length + ' tamaños');
}

console.log('\n  -- los otros dos dibujos caben en su caja (v1034) --');
{
  /* Misma aritmetica que la v1033, en los dos dibujos que el barrido de
     rotulos encontro despues: la escalera de las cinco siluetas (v887) y la
     carta solar (v882). Las cifras se LEEN del codigo; las cajas de texto
     estan MEDIDAS con `getBoundingClientRect` sobre la lamina compuesta. */
  const j68 = soloCodigo(leer('js/68-procity-reconocimiento.js'));
  const j74 = soloCodigo(leer('js/74-dibujos-analisis.js'));

  /* 1 · LA ESCALERA. Tres renglones en el pie de cada casilla: el nombre, la
     superficie y la poblacion. Caja medida: 4,5 unidades; el trazo baja 0,7
     por debajo de la linea base. */
  const mEsc = /var ESC_W = \d+, ESC_H = (\d+), ESC_GAP = \d+, ESC_PIE = (\d+);/.exec(j68);
  const mL = [/\(ESC_H - ([\d.]+)\)[\s\S]{0,120}?text-anchor="middle"/g]
    .flatMap(() => [...j68.matchAll(/y="' \+ \(ESC_H - ([\d.]+)\) \+ '" text-anchor="middle"/g)])
    .map((x) => +x[1]);

  if (!mEsc || mL.length !== 3) {
    comprobar('MATERIAL · las cifras de la escalera se pueden leer', false,
      'NO PUDO CORRER: cambió de forma (ESC ' + !!mEsc + ' · ' + mL.length + ' renglones de 3)');
  } else {
    const H = +mEsc[1], lineas = mL.slice().sort((a, b) => b - a).map((d) => H - d);
    const CAJA = 4.5, BAJO = 0.7;
    comprobar('MATERIAL · las cifras de la escalera se pueden leer', true,
      'ESC_H=' + H + ' · pie=' + mEsc[2] + ' · renglones en ' + lineas.join(', '));
    const gaps = [lineas[1] - lineas[0], lineas[2] - lineas[1]];
    const sueltos = gaps.every((g) => g >= CAJA);
    comprobar('los tres renglones del pie de la escalera no se pisan',
      sueltos,
      sueltos ? 'holgura de ' + gaps.map((g) => Math.round(g * 10) / 10).join(' y ') +
                ' unidades, sobre una caja de ' + CAJA
        : 'se pisan: ' + gaps.map((g) => Math.round(g * 10) / 10).join(' y ') +
          ' de holgura para una caja de ' + CAJA);
    const cabe = lineas[2] + BAJO <= H;
    comprobar('y el último renglón cabe dentro de la casilla',
      cabe, cabe ? 'cierra en ' + (lineas[2] + BAJO) + ' de ' + H
        : 'se sale: ' + (lineas[2] + BAJO) + ' sobre ' + H);
  }

  /* 2 · LA CARTA SOLAR. La leyenda son cuatro renglones al pie, DENTRO del
     propio SVG (v882), y su ultima linea base tiene que caber. */
  /* Se busca DENTRO de `cartaSolar` y no en el archivo entero: `js/74` tiene
     otra figura con las MISMAS constantes -la rosa de vientos, `var R = 78,
     cx = 100, cy = 100`- y con el archivo entero la guarda media esa. Lo
     cazo la inyeccion: con la carta rota, seguia en verde leyendo «leyenda
     desde 216». Es la leccion de la v854 dicha para un extractor. */
  const iCS = j74.indexOf('function cartaSolar');
  const fCS = iCS < 0 ? -1 : j74.indexOf('\n  function ', iCS + 20);
  const carta = iCS < 0 ? '' : j74.slice(iCS, fCS < 0 ? j74.length : fCS);
  const mVB = /viewBox="0 0 240 (\d+)"/.exec(carta);
  const mC = /var R = (\d+), cx = \d+, cy = (\d+);/.exec(carta);
  const mLey = /var yy = cy \+ R \+ (\d+) \+ i \* (\d+);/.exec(carta);
  const mTxt = /'<text x="31" y="' \+ \(yy \+ (\d+)\)/.exec(carta);

  if (!mVB || !mC || !mLey || !mTxt) {
    comprobar('MATERIAL · las cifras de la carta solar se pueden leer', false,
      'NO PUDO CORRER: cambió de forma (viewBox ' + !!mVB + ' · centro ' + !!mC +
      ' · leyenda ' + !!mLey + ' · texto ' + !!mTxt + ')');
  } else {
    const H = +mVB[1], R = +mC[1], cy = +mC[2];
    const ini = +mLey[1], paso = +mLey[2], base = +mTxt[1];
    const BAJO = 2;                 // el trazo de un rotulo de 8,5px baja 2
    const ULT = 3;                  // cuatro renglones: hoy, alto, bajo, equinoccio
    comprobar('MATERIAL · las cifras de la carta solar se pueden leer', true,
      'viewBox ' + H + ' · leyenda desde ' + (cy + R + ini) + ' cada ' + paso);
    const ultima = cy + R + ini + ULT * paso + base;
    const cabe = ultima + BAJO <= H;
    comprobar('la leyenda de la carta solar cabe dentro del dibujo',
      cabe,
      cabe ? 'el último renglón cierra en ' + (ultima + BAJO) + ' de ' + H
        : 'se sale: ' + (ultima + BAJO) + ' sobre un viewBox de ' + H +
          ' — el equinoccio queda fuera y lo recorta el contenedor');
  }
}

console.log('\n  -- el corte de la calle cabe en su caja (v1033) --');
{
  const j68 = soloCodigo(leer('js/68-procity-reconocimiento.js'));
  const i = j68.indexOf('function seccionDibujada');
  /* El tramo va hasta la siguiente funcion de primer nivel y no a N
     caracteres: con un corte fijo, un comentario nuevo empuja las cifras
     fuera de la ventana y la guarda se queda «sin material» sobre un
     dibujo que no cambio. Es la leccion de la v935 otra vez. */
  const fin = i < 0 ? -1 : j68.indexOf('\n  function ', i + 20);
  const tramo = i < 0 ? '' : j68.slice(i, fin < 0 ? i + 12000 : fin);

  /* Las tres cifras que deciden si los rotulos caben. Se LEEN del codigo:
     escribirlas acá seria comprobar que la guarda es igual a si misma. */
  const mWH = /var W = (\d+), H = (\d+), base/.exec(tramo);
  const mRy = /var ry = H - (\d+),/.exec(tramo);
  const mL1 = /\(ry \+ (\d+)\)[\s\S]{0,60}?m\[0\]/.exec(tramo);
  const mL2 = /\(ry \+ \(i % 2 \? (\d+) : (\d+)\)\)/.exec(tramo);

  if (!mWH || !mRy || !mL1 || !mL2) {
    comprobar('MATERIAL · las cifras del corte se pueden leer', false,
      'NO PUDO CORRER: el dibujo cambió de forma (W/H ' + !!mWH + ' · ry ' + !!mRy +
      ' · línea 1 ' + !!mL1 + ' · línea 2 ' + !!mL2 + '), así que la aritmética de abajo no vigila nada');
  } else {
    const H = +mWH[2], ry = H - +mRy[1];
    const l1 = +mL1[1], l2a = +mL2[2], l2b = +mL2[1];
    comprobar('MATERIAL · las cifras del corte se pueden leer', true,
      'H=' + H + ' · ry=' + ry + ' · líneas a +' + l1 + ', +' + l2a + ' y +' + l2b);

    /* ALTO DE UN ROTULO: 10 unidades, MEDIDO con getBBox sobre la lámina
       compuesta -no supuesto-, para los 9px en negrita de `.pcr-sec-t`. La
       caja va de la línea base menos 8 a la línea base más 2. */
    const CAJA = 10, BAJO = 2;

    const cabe = ry + l2b + BAJO <= H;
    comprobar('el rótulo más bajo del corte cabe dentro del viewBox',
      cabe,
      cabe ? 'el más bajo cierra en ' + (ry + l2b + BAJO) + ' de ' + H
        : 'se sale: ' + (ry + l2b + BAJO) + ' sobre un viewBox de ' + H +
          ' — el contenedor lo recorta y nadie se entera');

    const entreLineas = l2a - l1 >= CAJA;
    const entreMarcas = l2b - l2a >= CAJA;
    comprobar('ningún rótulo de la regla se pisa con el de al lado',
      entreLineas && entreMarcas,
      !entreLineas ? 'la primera línea toca la segunda: ' + (l2a - l1) + ' de holgura para una caja de ' + CAJA
        : !entreMarcas ? 'dos marcas vecinas se pisan: ' + (l2b - l2a) + ' de escalonado para una caja de ' + CAJA
          : 'holgura de ' + (l2a - l1) + ' y ' + (l2b - l2a) + ' unidades, sobre una caja de ' + CAJA);
  }
}

console.log('\n  -- la cifra en PROSA y su plural: el trinquete (v1032) --');
{
  /* La baldosa la vigila la v1029; esto es la otra mitad, la prosa:
     `+ n + ' usos'`, donde el numero y el plural van en la MISMA cadena y
     el «1» no es literal, asi que ni la regla del papel (v1023/v1025) ni la
     del codigo lo ven.

     Son 307 sitios en 25 archivos, y arreglarlos de una tanda seria un
     reemplazo masivo sobre treinta mil lineas, que es como la v909 rompio
     dos pantallas en silencio. Asi que va de TRINQUETE y no de cero: lo que
     hay se declara con su numero, y un sitio NUEVO sale en rojo.

     El trinquete es legitimo acá por la vara de la v965: este pendiente NO
     crece solo -solo sube si alguien escribe una cifra nueva sin su rama,
     que es justo lo prohibido-, asi que un techo absoluto es lo correcto y
     no hay que convertirlo en un piso sobre lo hecho. */
  const CON_RAMA = /\?\s*'[ ·]*(?:1 )?[a-záéíóúñ]+'\s*:\s*'[ ·]*[a-záéíóúñ]+s'|===\s*1\s*\?|!==\s*1\s*\?|\b(?:plural|pl|cn)\(/;
  /* Palabras que en castellano acaban en -s en singular: no concuerdan. Es
     la misma lista que la guarda de la concordancia lleva desde la v874. */
  const INVAR = /^(an[aá]lisis|m[aá]s|es|lejos|lunes|martes|mi[eé]rcoles|jueves|viernes|paraguas|crisis|dosis|atlas|bus|pa[ií]s|mes|virus)$/;
  const RE_PROSA = /\+\s*'([ ·(]{0,3})([a-záéíóúñ]+s)\b/g;
  const prosaEn = (txt) => {
    const out = []; const re = new RegExp(RE_PROSA.source, 'g'); let m;
    while ((m = re.exec(txt))) {
      /* La mirada hacia atras se RECORTA en el ultimo `;`, `{` o `}`: con
         una ventana de caracteres a secas, la rama de la caja de al lado cae
         dentro y esconde el sitio de esta. Medido: escondia uno -«Cada una
         de las N paradas», detras de un `e.n === 1 ?` de la fila anterior-.
         Es la leccion de la v935 -un ancla por distancia envejece- dicha
         para un barrido, y la misma que la v1029 ya escribio para la
         baldosa. */
      let antes = txt.slice(Math.max(0, m.index - 160), m.index);
      const corte = Math.max(antes.lastIndexOf(';'), antes.lastIndexOf('{'), antes.lastIndexOf('}'));
      if (corte >= 0) antes = antes.slice(corte + 1);
      if (CON_RAMA.test(antes)) continue;
      if (/'\s*$/.test(antes)) continue;     // dos literales pegados, no una cifra
      if (INVAR.test(m[2])) continue;
      out.push({ n: m[2], en: m.index });
    }
    return out;
  };

  const TECHO = 307;   // v1032 · medido. Solo puede BAJAR.
  const servidos = fs.readdirSync(R('js')).filter((f) => /\.js$/.test(f));
  let sinRama = 0, conRama = 0;
  const peores = {};
  servidos.forEach((f) => {
    const txt = soloCodigo(leer('js/' + f));
    conRama += (txt.match(/\b(?:pl|cn|plural)\(/g) || []).length;
    const n = prosaEn(txt).length;
    if (n) { sinRama += n; peores[f] = n; }
  });

  if (conRama < 30) {
    anotarSinMaterial('lo servido ramifica sus cifras en prosa',
      'solo ' + conRama + ' llamadas a pl()/cn(): el barrido no distinguiría nada');
  } else {
    comprobar('MATERIAL · lo servido ramifica sus cifras en prosa', true,
      conRama + ' llamadas a pl()/cn(), y ' + sinRama + ' sitios todavía sin rama');
    const top = Object.entries(peores).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map((x) => x[0].slice(0, 2) + ':' + x[1]).join(' · ');
    comprobar('ninguna cifra en prosa NUEVA sin su plural',
      sinRama <= TECHO,
      sinRama > TECHO
        ? 'subió de ' + TECHO + ' a ' + sinRama + ': una cifra nueva imprimiría «1 cosas» (' + top + ')'
        : sinRama + ' de un techo de ' + TECHO + ' — el trinquete solo baja (' + top + ')');
  }

  /* LA GUARDA DE LA GUARDA: el barrido ve la prosa pelada y calla la que ya
     ramifica y la invariable. Sin las tres mitades el techo no dice nada. */
  const PELADA = "'hay ' + n + ' usos'";
  /* La ramificada se toma con la FORMA que el codigo usa de verdad -el
     ternario cuya rama larga concatena el plural-, no con una inventada:
     mi primera version puso `pl(n,'uso','usos')`, donde el plural va detras
     de una coma y el barrido no lo ve NUNCA, asi que el caso pasaba con el
     filtro puesto y quitado. Es la trampa de la v1019 otra vez. */
  const RAMIF  = "x === 1 ? 'un uso' : n + ' usos'";
  const INVARC = "'hay ' + n + ' análisis'";
  const vePelada = prosaEn(PELADA).length === 1;
  const veRamif = prosaEn(RAMIF).length === 0;
  const veInvar = prosaEn(INVARC).length === 0;
  comprobar('el barrido ve la prosa pelada, y calla la ramificada y la invariable',
    vePelada && veRamif && veInvar,
    !vePelada ? 'no ve la pelada: el techo no vigilaría nada'
      : !veRamif ? 'denuncia una que ya ramifica: el techo no podría bajar nunca'
        : !veInvar ? 'denuncia «análisis», que no concuerda con nadie'
          : 've la pelada, y calla la que ramifica y la que acaba en -s en singular');
}

console.log('\n  -- una hoja que no se compone deja rastro (v1032) --');
{
  const j68 = soloCodigo(leer('js/68-procity-reconocimiento.js'));

  /* EL MATERIAL: el `catch` por PANEL es lo correcto -un adorno no puede
     tumbar una hoja (v870)- y hay decenas. Lo que esta guarda vigila es el
     UNICO que envuelve la composicion entera, y si no hubiera ninguno no
     habria nada que vigilar. */
  const porPanel = (j68.match(/catch\s*\(\s*\w*\s*\)\s*\{[^{}]{0,80}\}/g) || []).length;
  if (porPanel < 50) {
    anotarSinMaterial('la hoja se compone dentro de un `catch`',
      'solo ' + porPanel + ' catch en js/68: la guarda no tendría de dónde distinguir');
  } else {
    comprobar('MATERIAL · la hoja se compone dentro de un `catch`', true,
      porPanel + ' catch en js/68, de los que uno envuelve la composición entera');

    /* El cuerpo de `laminaAjustada` hasta su primer `if`: ahi vive el catch
       que decide si hay hoja o no. */
    const i = j68.indexOf('function laminaAjustada');
    const tramo = i < 0 ? '' : j68.slice(i, i + 1400);
    const traga = /catch\s*\([^)]*\)\s*\{\s*return\s*''\s*;\s*\}/.test(tramo);
    const rastro = /S\.laminaError\s*=/.test(tramo) && /console\.error/.test(tramo);
    comprobar('el `catch` que se come la hoja entera deja rastro',
      !!tramo && !traga && rastro,
      !tramo ? 'no se encontró `laminaAjustada`: la guarda no está mirando nada'
        : traga ? 'vuelve a tragárselo a secas: una hoja vacía y «no hay resultado» se leen igual'
          : !rastro ? 'no deja rastro ni en S ni en la consola: media hora cada vez (v888)'
            : 'deja el motivo en S.laminaError y en la consola, y sigue sin tumbar la aplicación');

    /* LA GUARDA DE LA GUARDA: el rastro no sirve si nadie puede leerlo. Una
       prueba lo lee por `estado()`/la API, que es la regla de la v871. */
    comprobar('y el rastro se puede leer desde fuera',
      /laminaError:\s*function/.test(j68),
      /laminaError:\s*function/.test(j68)
        ? 'la API lo expone, así que una prueba distingue «reventó» de «no hay resultado»'
        : 'el rastro se guarda y ninguna prueba lo alcanza: vuelve a ser un dato que no llega a nadie');
  }
}

console.log('\n  -- una cifra sin medir no se imprime en crudo (v1030) --');
{
  /* LA CLASE: un `|| {}` o un `|| 0` puesto para que no reviente, y la otra
     mitad abierta. El primero deja pasar el `undefined` al papel -«Tome una
     muestra de undefined», «undefined%»- y el segundo es PEOR, porque un
     «0 %» se lee como una medicion: cero medido y cero sabido son cosas
     distintas, que es la clase de la v875.

     Se persiguen las dos formas por separado porque piden cosas distintas:
     la primera se ve y alguien la reporta; la segunda no se ve nunca. */
  const servidos = fs.readdirSync(R('js')).filter((f) => /\.js$/.test(f));

  /* 1 · el `|| {}` cuya propiedad va DIRECTO a una cadena, sin respaldo.
     No se persigue «todo `|| {}`» -hay 177 y casi todos llevan su `||` o
     son un metodo-, que seria la lista de excepciones que envejece de la
     v895. Se persigue el que concatena. */
  const RE_MEDIO = /\|\|\s*\{\s*\}\s*\)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[[^\]]+\])\s*\+\s*'/g;
  const mediosEn = (txt) => {
    const out = []; const re = new RegExp(RE_MEDIO.source, 'g'); let m;
    while ((m = re.exec(txt))) out.push({ prop: m[1] || '[..]', en: m.index });
    return out;
  };

  const medios = [];
  let conGuarda = 0;
  servidos.forEach((f) => {
    const txt = soloCodigo(leer('js/' + f));
    conGuarda += (txt.match(/\|\|\s*\{\s*\}\s*\)/g) || []).length;
    mediosEn(txt).forEach((x) => {
      medios.push('js/' + f.slice(0, 2) + ':' + txt.slice(0, x.en).split('\n').length + ' .' + x.prop);
    });
  });

  /* El MATERIAL es lo que sobrevive al cero (v1022): no «cuantos medios
     quedan» -arreglarlos lo deja en cero- sino que lo servido siga usando
     el `|| {}`, que es lo que el barrido mira. */
  if (conGuarda < 50) {
    anotarSinMaterial('lo servido usa el `|| {}` defensivo',
      'solo ' + conGuarda + ' usos, así que el barrido no vigilaría casi nada');
  } else {
    comprobar('MATERIAL · lo servido usa el `|| {}` defensivo', true,
      conGuarda + ' usos del respaldo vacío, de los que ' + medios.length + ' concatenan');
    comprobar('ningún `|| {}` manda su propiedad al texto sin respaldo',
      medios.length === 0,
      medios.length
        ? medios.length + ' imprimirían «undefined»: ' + medios.slice(0, 5).join(' · ')
        : 'los ' + conGuarda + ' llevan su `||`, o son un método, o se comprueban antes');
  }

  /* 2 · la cobertura del perfil, que es donde la clase salio impresa. Las
     dos cifras se resuelven en `perfilDeLaCalle` -el punto unico que la
     v939 creo- y ningun consumidor las lee en crudo. */
  const j68 = soloCodigo(leer('js/68-procity-reconocimiento.js'));
  const crudas = [];
  const reC = /\.\s*cobertura(Ancho|Altura)\b/g;
  let mc;
  while ((mc = reC.exec(j68))) {
    /* El UNICO sitio legitimo es el punto unico: `cobDe(pf.coberturaX, ...)`
       es quien la lee del motor. Cualquier otro la leeria por su cuenta. */
    const antes = j68.slice(Math.max(0, mc.index - 30), mc.index);
    if (/cobDe\(\s*[A-Za-z_$][\w$]*$/.test(antes)) continue;
    crudas.push('js/68:' + j68.slice(0, mc.index).split('\n').length + ' cobertura' + mc[1]);
  }
  comprobar('la cobertura del perfil se lee por el punto único, no en crudo',
    crudas.length === 0,
    crudas.length
      ? crudas.length + ' la leen por su cuenta: ' + crudas.slice(0, 4).join(' · ')
      : 'solo la lee `perfilDeLaCalle`, y los once sitios que la imprimen la reciben resuelta');

  comprobar('y ninguna cobertura se imprime con `|| 0`',
    !/cobertura(Ancho|Altura)\s*\|\|\s*0/.test(j68),
    /cobertura(Ancho|Altura)\s*\|\|\s*0/.test(j68)
      ? 'vuelve el «0 %»: un cero inventado se lee como una medición (v875)'
      : 'sin dato dice que no se midió, que no es lo mismo que cero');

  /* LA GUARDA DE LA GUARDA: el barrido ve el `|| {}` que concatena y calla
     el que lleva su respaldo. Sin la segunda mitad denunciaria los 177. */
  const MALO = "'x ' + (a.b() || {}).nombre + ' y'";
  const CON_OR = "'x ' + ((a.b() || {}).nombre || 'sin nombre') + ' y'";
  const METODO = "(a.b || {}).forEach(function (k) { return k; })";
  const veMalo = mediosEn(MALO).length === 1;
  const veOr = mediosEn(CON_OR).length === 0;
  const veMet = mediosEn(METODO).length === 0;
  comprobar('el barrido ve el `|| {}` que concatena y calla al que se respalda',
    veMalo && veOr && veMet,
    !veMalo ? 'no ve el que concatena: no vigilaría nada'
      : !veOr ? 'denuncia uno que lleva su `||`: daría rojo sobre lo que está bien'
        : !veMet ? 'denuncia una llamada a método, que no imprime nada'
          : 've el que concatena, y calla el que se respalda y el método');

  /* Y que el formateador siga diciendo «sin medir» en vez de un cero. */
  comprobar('el formateador escribe «sin medir», no un cero',
    /function pctDicho\(v\)[\s\S]{0,200}'sin medir'/.test(j68),
    /function pctDicho\(v\)[\s\S]{0,200}'sin medir'/.test(j68)
      ? 'pctDicho dice que no se midió cuando no hay cifra'
      : 'pctDicho dejó de distinguir: un cero volvería a leerse como una medición');
}

console.log('\n  -- la baldosa de cifra lleva su singular (v1028) --');
{
  const j24 = soloCodigo(leer('js/24-procity-analisis.js'));
  /* Las llamadas: `kpi(<valor>, '<rotulo>'[, '<singular>'])`. El valor puede
     traer parentesis -`String(x).replace(...)`- asi que se corta contando. */
  const llamadas = [];
  const re = /\bkpi\(/g;
  let m;
  while ((m = re.exec(j24))) {
    let i = m.index + 4, d = 1, buf = '';
    for (; i < j24.length && d > 0; i++) {
      const ch = j24[i];
      if (ch === '(') d++;
      else if (ch === ')') { d--; if (!d) break; }
      buf += ch;
    }
    llamadas.push({ txt: buf, en: m.index });
  }
  const conPlural = llamadas.filter((l) => {
    const rot = /,\s*'([^']+)'/.exec(l.txt);
    return rot && /\b[a-záéíóúñ]+s\b/.test(rot[1]);
  });
  const sinSingular = conPlural.filter((l) => (l.txt.match(/'/g) || []).length < 4)
    .map((l) => 'js/24:' + j24.slice(0, l.en).split('\n').length + ' ' +
                (/,\s*'([^']+)'/.exec(l.txt) || [])[1]);

  if (llamadas.length < 8 || !/function kpiHTML\(/.test(j24)) {
    comprobar('MATERIAL · el panel arma baldosas de cifra por un solo sitio', false,
      !/function kpiHTML\(/.test(j24)
        ? 'NO PUDO CORRER: ya no hay un armador único de baldosas'
        : 'NO PUDO CORRER: solo ' + llamadas.length + ' baldosas');
  } else {
    comprobar('MATERIAL · el panel arma baldosas de cifra por un solo sitio', true,
      llamadas.length + ' baldosas, ' + conPlural.length + ' con un rótulo en plural');
    /* LA GUARDA DE LA GUARDA: que el armador USE el singular que se le pasa.
       Sin esto, volver a la baldosa de dos argumentos deja las llamadas
       intactas -siguen pasando su tercer argumento- y todo lo de arriba sigue
       en verde mientras la pantalla imprime «1 puntos mapeados». */
    comprobar('y el armador usa el singular que se le pasa',
      /singular\s*&&\s*n\s*===\s*1/.test(j24),
      /singular\s*&&\s*n\s*===\s*1/.test(j24)
        ? 'kpiHTML elige el rótulo con el singular'
        : 'kpiHTML ignora su singular: las llamadas lo pasarían y la baldosa imprimiría el plural igual');
    comprobar('toda baldosa con rótulo en plural lleva su singular',
      sinSingular.length === 0,
      sinSingular.length
        ? sinSingular.length + ' imprimirían «1 cosas» en dos elementos: ' + sinSingular.slice(0, 4).join(' · ')
        : 'las ' + conPlural.length + ' lo llevan');
  }
}

console.log('\n  -- una cifra del diagnóstico pasa por su formateador (v1027) --');
{
  const j26 = soloCodigo(leer('js/26-procity-diagnostico.js'));
  /* Campos de TEXTO que se imprimen sin formatear, con su razon. Vacia hoy. */
  const DE_TEXTO = [];
  const crudos = (txt) => {
    const re = /(?<!num\()(?<!cn\()(?<!pl\()\b(?:i|ind|d)\.([A-Za-z][\w.]*)\s*\+\s*'/g;
    const out = []; let m;
    while ((m = re.exec(txt))) {
      if (DE_TEXTO.indexOf(m[1]) !== -1) continue;
      out.push(m[1] + ' (línea ' + txt.slice(0, m.index).split('\n').length + ')');
    }
    return out;
  };
  /* El MATERIAL es lo que sobrevive al cero (v1022): no «cuantos crudos hay»
     -arreglarlos lo deja en cero y la guarda se quedaria sin material por
     haber MEJORADO el codigo- sino que el modulo siga imprimiendo cifras por
     su formateador. */
  const pasados = (j26.match(/\b(?:num|cn)\(\s*(?:i|ind|d)\./g) || []).length;
  const declara = /const num = /.test(j26) && /const cn = /.test(j26);
  if (pasados < 20 || !declara) {
    comprobar('MATERIAL · el diagnóstico imprime cifras por num() y cn()', false,
      !declara ? 'NO PUDO CORRER: el módulo ya no declara num o cn'
        : 'NO PUDO CORRER: solo ' + pasados + ' campos pasan por el formateador');
  } else {
    comprobar('MATERIAL · el diagnóstico imprime cifras por num() y cn()', true,
      pasados + ' campos pasan por num() o cn()');

    const sueltos = crudos(j26);
    comprobar('ninguna cifra del diagnóstico se imprime sin formatear',
      sueltos.length === 0,
      sueltos.length
        ? sueltos.length + ' saldrían con punto decimal o sin separador de miles: ' + sueltos.slice(0, 5).join(' · ')
        : 'los ' + pasados + ' pasan por num() o cn()' +
          (DE_TEXTO.length ? ', y ' + DE_TEXTO.length + ' de texto van declarados aparte' : ', y no hay ninguno de texto declarado aparte'));
  }

  /* LA GUARDA DE LA GUARDA (v878), en sus dos mitades: que el barrido vea un
     campo crudo y calle uno envuelto -sin la segunda, denunciaria los 33 que
     estan bien-, y que `cn` siga pasando por `num`, porque si dejara de
     hacerlo los contados volverian a salir sin separador y todo lo de arriba
     seguiria en verde. */
  const CRUDO = "texto: 'Densidad de ' + i.densidad + ' por hectárea'";
  const ENVUELTO = "texto: 'Densidad de ' + num(i.densidad) + ' por hectárea'";
  const CONTADO = "texto: 'Son ' + cn(i.total, 'elemento', 'elementos') + ' en total'";
  comprobar('el barrido ve el campo crudo y calla el que pasa por el formateador',
    crudos(CRUDO).length === 1 && crudos(ENVUELTO).length === 0 && crudos(CONTADO).length === 0,
    !crudos(CRUDO).length ? 'no ve el crudo: no vigilaría nada'
      : crudos(ENVUELTO).length ? 'denuncia un num() que sí está'
        : crudos(CONTADO).length ? 'denuncia un cn() que sí está'
          : 've el crudo, y calla el num() y el cn()');
  const cnPorNum = /const cn = \([^)]*\) => num\(/.test(j26);
  comprobar('y cn() sigue escribiendo su cifra con num()', cnPorNum,
    cnPorNum ? 'cn pasa la cifra por num'
      : 'cn dejó de pasar por num: los contados volverían a salir sin separador ' +
        'de miles y todo lo de arriba seguiría en verde');
}

console.log('\n  -- el texto que la página trae escrito (v1023) --');
{
  /* Las cuatro reglas del papel -la concordancia de la v874, el punto decimal
     y el separador de miles de la v885 y la v891, y los marcadores sin
     reemplazar de la v889- se persiguen sobre lo que el JAVASCRIPT genera.
     El texto que la PÁGINA trae escrito no lo miraba nadie, y por ahí se
     coló «0.00 km» en el marcador de posición del corredor: la lectura salía
     con punto hasta la primera actualización y con coma después, o sea las
     dos ortografías en el mismo elemento.

     Es la superficie mas facil de olvidar porque no es codigo: ninguna guarda
     que recorra `js/` la ve, y la que recorre las paginas busca etiquetas y
     atributos, no prosa. */
  const paginas = fs.readdirSync(RAIZ).filter((f) => /\.html$/.test(f)).sort();

  /* Lo que el navegador PINTA: fuera de <script>, de <style>, de los
     comentarios y de los atributos. Se sustituye por espacios en vez de
     borrar, para que el numero de linea siga siendo el de verdad. */
  function soloTexto(html) {
    const hueco = (m) => ' '.repeat(m.length);
    return html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, hueco)
      .replace(/<!--[\s\S]*?-->/g, hueco)
      .replace(/<[^>]*>/g, hueco);
  }

  /* La lista de invariables se LEE de la suite que ya la tiene: dos copias de
     una lista de palabras se separan a la tanda siguiente (v879). */
  const suite = leer('pruebas/suites/tdoslaminas.js');
  const iL = suite.indexOf('const INVARIABLES = /^(');
  const crudo = iL < 0 ? '' : suite.slice(suite.indexOf('/^(', iL), suite.indexOf('/;', iL) + 1).slice(1, -1);
  const INV = crudo ? new RegExp(crudo) : null;

  const REGLAS = [
    ['punto decimal', /(?<![\d.,:/])(\d+)\.(\d{1,2})(?![\d.])/g],
    ['miles sin separar', /(?<![\d.,:/-])(\d{5,})(?![\d.,])/g],
    ['marcador sin reemplazar', /(@@[A-Z_]+@@|\{\{[^}]+\}\}|\bundefined\b|\bNaN\b|\[object Object\])/g],
    ['«1» con plural', /(?<![\d.,])1 ([a-záéíóúüñ]+)\b/g],
  ];

  let letras = 0;
  const hallazgos = [];
  paginas.forEach((f) => {
    const t = soloTexto(leer(f));
    letras += t.replace(/\s+/g, '').length;
    REGLAS.forEach(([nombre, re]) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(t))) {
        if (nombre === '«1» con plural' && (!/s$/.test(m[1]) || !INV || INV.test(m[1]))) continue;
        hallazgos.push(f + ':' + t.slice(0, m.index).split('\n').length + ' ' + nombre + ' «' + m[0].trim() + '»');
      }
    });
  });

  /* MATERIAL primero (v920): sin la lista de invariables la regla de la
     concordancia no se puede correr, y sin texto no hay nada que mirar. */
  if (!INV || letras < 2000) {
    anotarSinMaterial('MATERIAL - las paginas traen prosa escrita, y la lista de invariables se pudo leer',
      !INV ? 'no se encontro INVARIABLES en tdoslaminas: la regla de concordancia no correria'
           : 'solo ' + letras + ' letras de texto: no habria casi nada que mirar');
  } else {
    comprobar('MATERIAL - las paginas traen prosa escrita, y la lista de invariables se pudo leer',
      true, paginas.length + ' paginas con ' + letras + ' letras de texto propio');

    comprobar('el texto escrito en las paginas cumple las cuatro reglas del papel',
      hallazgos.length === 0,
      hallazgos.length
        ? hallazgos.length + ' hallazgo(s): ' + hallazgos.slice(0, 5).join(' · ')
        : 'ninguna de las ' + paginas.length + ' trae punto decimal, miles sin separar, marcador ni «1» con plural');
  }

  /* LA GUARDA DE LA GUARDA (v878): el extractor tiene que quitar el script,
     el estilo y los atributos, o la guarda denunciaria el codigo de la propia
     pagina -y conservar las posiciones, o el numero de linea mentiria-. */
  const MUESTRA = '<p>uno</p>\n<script>var x = 1.25;</script>\n<div data-v="9.99">dos</div>\n<p>3.50 km</p>';
  const limpio = soloTexto(MUESTRA);
  const veElTexto = /3\.50/.test(limpio);
  const veElScript = /1\.25/.test(limpio);
  const veElAtributo = /9\.99/.test(limpio);
  const mismaLargo = limpio.length === MUESTRA.length;
  comprobar('el extractor deja la prosa y quita el script, el estilo y los atributos',
    veElTexto && !veElScript && !veElAtributo && mismaLargo,
    !veElTexto ? 'se come la prosa: no vigilaria nada'
      : veElScript ? 've dentro de <script>: denunciaria el codigo de la pagina'
        : veElAtributo ? 've dentro de un atributo: denunciaria un data-* o un style'
          : !mismaLargo ? 'no conserva las posiciones: el numero de linea mentiria'
            : 'deja la prosa, quita script, estilo y atributos, y conserva las posiciones');
}

console.log('\n  -- el marcado que vive dentro del JavaScript (v1025) --');
{
  /* Tercera forma de escribir lo mismo, y la que no veia nadie. Las cuatro
     reglas del papel se persiguen sobre lo que el JavaScript GENERA (la
     lamina, en `tdoslaminas`), sobre lo que la pagina trae escrito (v1023) y
     sobre las cifras pegadas a una unidad (v1022). Falta el marcado que se
     escribe DENTRO de un literal de JavaScript, con el numero en un `<b>` y
     su unidad en el `<span>` de al lado:

       '<div class="rush-live-metric"><b id="u52-speed">0.0</b><span>km/h</span></div>'

     Ni la guarda de las paginas lo alcanza -no esta en un .html- ni la de la
     unidad -el `0.0` no toca la palabra «km/h»-. */
  const arch = fs.readdirSync(R('js')).filter((f) => /\.js$/.test(f)).map((f) => 'js/' + f);

  /* El cierre tiene que ser un elemento de HTML de verdad. Dos motivos, los
     dos medidos: sin exigir `</tag>`, un `h >= 6.4 && h < 12` del codigo
     entra como si fuera texto -ocho falsos positivos-; y sin acotar a
     elementos conocidos entra el `<scale>1.0</scale>` de un KML, que es un
     valor de maquina donde el punto es obligatorio. */
  const MARCADO = /(?<=[A-Za-z0-9"'/])>([^<>{}`'"\n]{1,80})<\/(b|strong|span|em|small|div|p|td|th|li|a|h[1-6])>/g;

  /* La lista de invariables se LEE de la suite que ya la tiene (v879). */
  const suite = leer('pruebas/suites/tdoslaminas.js');
  const iL = suite.indexOf('const INVARIABLES = /^(');
  const crudo = iL < 0 ? '' : suite.slice(suite.indexOf('/^(', iL), suite.indexOf('/;', iL) + 1).slice(1, -1);
  const INV = crudo ? new RegExp(crudo) : null;

  const REGLAS = [
    ['punto decimal', /(?<![\d.,:/])(\d+)\.(\d{1,2})(?![\d.])/g],
    ['miles sin separar', /(?<![\d.,:/-])(\d{5,})(?![\d.,])/g],
    ['marcador sin reemplazar', /(@@[A-Z_]+@@|\{\{[^}]+\}\}|\bundefined\b|\bNaN\b|\[object Object\])/g],
    ['«1» con plural', /(?<![\d.,])1 ([a-záéíóúüñ]+)\b/g],
  ];

  /* Lo declarado, con su razon. `@@TAM@@` es la marca que la v886 deja en el
     pie para sustituirla en la CADENA, sin volver a maquetar: nunca llega al
     papel, y sobre el papel ya la vigila `tdoslaminas`. */
  const DECLARADOS = [
    ['@@TAM@@', 'la marca de la v886: se sustituye en la cadena antes de emitir la hoja'],
  ];
  const exento = (q) => DECLARADOS.some((d) => d[0] === q);

  function hallazgosEn(txt) {
    const out = [];
    MARCADO.lastIndex = 0;
    let m;
    while ((m = MARCADO.exec(txt))) {
      const dentro = m[1];
      REGLAS.forEach(([nombre, re]) => {
        re.lastIndex = 0;
        let d;
        while ((d = re.exec(dentro))) {
          if (nombre === '«1» con plural' && (!/s$/.test(d[1]) || !INV || INV.test(d[1]))) return;
          if (exento(d[0].trim())) continue;
          out.push({ en: m.index, nombre: nombre, q: d[0].trim() });
        }
      });
    }
    return out;
  }

  let trozos = 0;
  const hallazgos = [];
  arch.forEach((rel) => {
    const txt = leer(rel);
    MARCADO.lastIndex = 0;
    while (MARCADO.exec(txt)) trozos++;
    hallazgosEn(txt).forEach((h) => {
      hallazgos.push(rel.slice(3, 5) + ':' + txt.slice(0, h.en).split('\n').length + ' ' + h.nombre + ' «' + h.q + '»');
    });
  });

  if (!INV || trozos < 100) {
    anotarSinMaterial('MATERIAL - js/ escribe marcado con texto dentro',
      !INV ? 'no se encontro INVARIABLES en tdoslaminas: la regla de concordancia no correria'
           : 'solo ' + trozos + ' trozos de marcado: no habria casi nada que mirar');
  } else {
    comprobar('MATERIAL - js/ escribe marcado con texto dentro',
      true, trozos + ' trozos de texto entre etiquetas, en ' + arch.length + ' archivos');

    comprobar('el marcado escrito en js/ cumple las cuatro reglas del papel',
      hallazgos.length === 0,
      hallazgos.length
        ? hallazgos.length + ' hallazgo(s): ' + hallazgos.slice(0, 5).join(' · ')
        : 'ninguno, salvo ' + DECLARADOS.length + ' declarado(s): ' +
          DECLARADOS.map((d) => '«' + d[0] + '» ' + d[1]).join(' · '));
  }

  /* LA GUARDA DE LA GUARDA (v878): los tres casos de respuesta conocida que
     decidieron la forma del patron. */
  const ROTULO = "'<b id=\"x\">0.00</b>'";
  const KML = "'<scale>1.0</scale>'";
  const COMPARACION = "if (h >= 6.4 && h < 12) { }";
  const veRotulo = hallazgosEn(ROTULO).length > 0;
  const veKml = hallazgosEn(KML).length > 0;
  const veComparacion = hallazgosEn(COMPARACION).length > 0;
  comprobar('el patron ve el rotulo y calla el KML y la comparacion',
    veRotulo && !veKml && !veComparacion,
    !veRotulo ? 'no ve el rotulo: no vigilaria nada'
      : veKml ? 'toma un <scale> de KML por un rotulo: ahi el punto es obligatorio'
        : veComparacion ? 'toma un «h >= 6.4 && h <» del codigo por texto'
          : 've el rotulo, y calla el valor de KML y la comparacion del codigo');

  /* Y que lo declarado lleve su razon escrita (v895). */
  const sinRazon = DECLARADOS.filter((d) => !d[0] || !d[1] || d[1].length <= 20);
  comprobar('cada marcador declarado lleva su razon',
    sinRazon.length === 0,
    sinRazon.length
      ? sinRazon.length + ' sin motivo escrito: «' + sinRazon[0][0] + '» — una excepcion sin razon envejece hasta no significar nada'
      : DECLARADOS.length + ' declarado(s), cada uno con el motivo por el que no llega al papel');
}

/* ═══════════════════════════════════════════════════════════════════════
   EL PELDAÑO PROVISIONAL, Y LA INTERFAZ DEL MÓDULO PRESIDENCIAL (v1050)

   Hasta la v1048 la ficha imprimía «Sin nivel» cuando la identidad de objeto
   de las contradicciones no estaba declarada. Ahora publica el extremo del
   intervalo que sostiene lo confirmado, y lo pendiente va con su nombre bajo
   su propio rótulo. Lo que estas comprobaciones impiden es que se publique
   la MITAD: un peldaño sin decir que es provisional, o un «aún no se
   confirma» sin decir hasta dónde puede bajar.
   ═══════════════════════════════════════════════════════════════════════ */
{
  const j70 = leer('js/70-seguimiento.js');
  const c70 = leer('css/70-seguimiento.css');

  /* El tramo del veredicto: del cálculo del peor techo al `return` de la
     ficha. Se corta por contenido y no a N caracteres, que es un ancla que
     envejece (v935). */
  const iVer = j70.indexOf('var peorMin = Math.max(');
  const iFin = j70.indexOf('capa1: capa1', iVer);
  const ver = iVer >= 0 && iFin > iVer ? j70.slice(iVer, iFin) : '';

  const iPlaca = j70.indexOf('function placaDe(');
  const fPlaca = iPlaca >= 0 ? j70.indexOf('\n  }', iPlaca) : -1;
  const placa = iPlaca >= 0 && fPlaca > iPlaca ? j70.slice(iPlaca, fPlaca) : '';

  if (!ver || !placa) {
    anotarSinMaterial('MATERIAL - el veredicto y la placa se dejan leer',
      'no se encontró ' + (!ver ? 'el cálculo del peor techo' : 'placaDe') +
      ': las comprobaciones de abajo no vigilarían nada');
  } else {
    comprobar('MATERIAL - el veredicto y la placa se dejan leer', true,
      ver.length + ' y ' + placa.length + ' caracteres');

    /* 1 · CON EL TECHO INDETERMINADO SE PUBLICA PELDAÑO. Es lo que el lector
       pidió: que la ficha diga el nivel. La rama que antes devolvía
       «sin-nivel» tiene que salir de la ESCALERA. */
    const iRama = ver.indexOf('} else if (!determinado) {');
    const rama = iRama >= 0 ? ver.slice(iRama, ver.indexOf('} else {', iRama)) : '';
    comprobar('con el techo indeterminado se publica el peldaño que sostiene lo confirmado',
      /ESCALERA\[peorMin\]/.test(rama) && !/'sin-nivel'/.test(rama),
      /'sin-nivel'/.test(rama)
        ? 'vuelve a no publicar nivel: la ficha diría «Sin nivel» donde hay un peldaño que sí se sostiene'
        : !/ESCALERA\[peorMin\]/.test(rama)
          ? 'no sale de la escalera: publicaría un peldaño que el cálculo no respalda'
          : 'sale de ESCALERA[peorMin], que es el extremo que lo confirmado sostiene');

    /* 2 · Y EL EXTREMO ES EL MÍNIMO, NO EL MÁXIMO. Publicar `peorMax` sería
       publicar el peor caso como si estuviera medido: afirmar sobre una
       persona real algo que depende de una lectura que nadie hizo. Y el
       mínimo solo es defendible porque los tres techos son monótonos —más
       material nunca sube el peldaño—, así que es un PISO. */
    comprobar('y es el extremo mínimo, con su techo declarado al lado',
      /ESCALERA\[peorMin\]/.test(rama) && /hasta: ESCALERA\[peorMax\]/.test(rama) &&
      !/id: ESCALERA\[peorMax\]/.test(rama),
      !/hasta: ESCALERA\[peorMax\]/.test(rama)
        ? 'no declara hasta dónde puede bajar: un piso sin su techo se lee como firme'
        : /id: ESCALERA\[peorMax\]/.test(rama)
          ? 'publica el PEOR caso: afirmaría lo que nadie ha leído'
          : 'publica el mínimo y declara el máximo');

    /* 3 · LA MARCA VIAJA CON EL VEREDICTO, no la deduce la pantalla. Con la
       pantalla decidiendo, la placa y la ficha se separarían a la tanda
       siguiente y la que se quedaría vieja sería la que nadie mira (v879). */
    /* Se CUENTAN los sitios de la placa que deciden si el peldaño es firme,
       no se busca uno: la placa lo usa dos veces —el rótulo y el bloque de
       lo que falta— y con un solo `test` uno de los dos podía pasar a
       decidir por su cuenta sin que nada lo dijera. Lo destapó una
       inyección que dejó la guarda en verde. */
    /* Se mide por CONTENIDO y no por cercanía: la versión de antes cogía
       los `if` cuya ventana de 220 caracteres rozara un `sp-fi-vfalta`, y en
       la v1057 eso empezó a contar dos que no deciden nada de la marca —el
       que parte las dos ramas del titular y el que nombra los ejes que
       faltan—. Un ancla por distancia envejece; una por contenido no (v935).

       Lo que tiene que seguir siendo cierto: TODO bloque que diga hasta
       dónde puede bajar el peldaño va guardado por un `if` que LEE la marca.
       Se cuentan los bloques y los que están guardados. */
    const bloquesHasta = (placa.match(/\.hasta\.t/g) || []).length;
    const guardados = [...placa.matchAll(/\.hasta\.t/g)].filter((m) =>
      /if \([^)]*\.provisional\b[^)]*\)/.test(placa.slice(Math.max(0, m.index - 700), m.index))).length;
    const decidePlaca = new Array(bloquesHasta);
    const porMarcaN = guardados;
    /* La marca se LEE del objeto del veredicto, venga por el nombre que
       venga: desde la v1057 la placa la lee dos veces de `f.veredicto` y una
       de `vg.palabra`, que es el mismo peldaño viajando dentro del veredicto
       general. Lo que tiene que seguir siendo cierto no es el nombre sino
       que la marca venga del veredicto y no se calcule acá — por eso el
       patrón pide `.provisional` leído de algo, y la mitad de abajo rechaza
       que la placa la deduzca por su cuenta. Es la lección de la v890: una
       guarda que cita la línea envejece con el primer cambio legítimo. */
    const porMarca = porMarcaN;
    /* Y la placa NO recalcula si el peldaño es firme: con `peorMin`,
       `peorMax` o `determinado` acá, la marca sería una segunda ruta y las
       dos se separarían a la tanda siguiente (v879). */
    const deduce = /peorMin|peorMax|\bdeterminado\b/.test(placa);
    comprobar('la marca de provisional viaja con el veredicto',
      /provisional: true/.test(rama) && decidePlaca.length > 0 &&
        porMarca === decidePlaca.length && !deduce,
      !/provisional: true/.test(rama) ? 'el veredicto no la lleva'
        : !decidePlaca.length ? 'la placa no dice en ninguna parte hasta dónde puede bajar el peldaño'
          : deduce ? 'la placa recalcula si el peldaño es firme en vez de leer la marca: dos rutas ' +
                     'para un mismo hecho, y la que se quedaría vieja es la de la placa'
          : porMarca < decidePlaca.length
            ? (decidePlaca.length - porMarca) + ' de ' + decidePlaca.length +
              ' bloques dicen hasta dónde baja el peldaño sin leer la marca: se pintarían sobre un ' +
              'peldaño firme'
            : 'los ' + decidePlaca.length + ' bloques de «hasta dónde baja» van guardados por la marca, ' +
              'y la placa no la recalcula');

    /* 4 · LA PLACA DICE LAS DOS COSAS. Esta placa se fotografía y la captura
       circula sola: un peldaño sin su rótulo se lee como firme, y un rótulo
       sin el techo deja al lector sin saber qué está en juego. Las dos
       mitades o la marca es un adorno. */
    /* DENTRO de la rama que pinta el peldaño y no en la placa entera: desde
       la v1057 el primer `sp-fi-vval` de la placa es el del titular («Sin
       dictamen»), que va antes de esta rama y no lleva rótulo de
       provisional. Medido sobre la placa entera, el orden salía al revés y
       la guarda daba rojo sobre lo que está bien. Es la v854: se busca
       dentro de la caja. */
    /* v1089 · ESTA RAMA YA NO EXISTE, y la guarda se hace MÁS precisa.
       Hasta la v1088 la placa tenía DOS caminos: uno titulaba con el país y
       el otro —el anterior a la v1056— titulaba con el peldaño de la palabra.
       El segundo era código muerto (su condición salía de comparar contra un
       estado que `veredictoGeneral` nunca devuelve) y el día que apareció un
       dictamen de verdad se despertó y la placa volvió a titular con la
       palabra. Se retiró, porque una rama que solo se alcanza cuando el
       módulo mejora es una regresión esperando.

       Estas dos aserciones medían ESE camino: la clase `sp-fi-vprov` y el
       orden del rótulo dentro de él. Aflojarlas sería perder la prueba; lo
       que medían de verdad es otra cosa y sigue siendo exigible: que el
       peldaño de la palabra NO se publique como firme cuando es provisional,
       y que el acotamiento se lea ANTES del peldaño. En la rama que queda eso
       se cumple de otra manera —el «con lo confirmado hasta hoy» va dentro de
       la misma frase, delante del peldaño— así que se mide así. */
    const ramaPal = (function () {
      const i = placa.indexOf("'sp-fi-vpal'");
      return i < 0 ? '' : placa.slice(i, i + 1400);
    }());
    const iAcot = ramaPal.indexOf('con lo confirmado hasta hoy');
    const iPeld = ramaPal.indexOf('confiabilidad de la palabra');
    const mitProv = [
      ['la placa publica el peldaño de la palabra por su propia rama', !!ramaPal],
      ['y cuando es provisional lo dice', iAcot > 0 && /palabra\.provisional/.test(ramaPal)],
      ['y dice hasta dónde puede bajar', /palabra\.hasta\.t/.test(placa)],
      ['y el camino viejo que titulaba con la palabra ya no existe',
       !/'sp-fi-vlabel', 'Fiabilidad de la palabra'/.test(placa)]
    ];
    const malProv = mitProv.filter((x) => !x[1]).map((x) => x[0]);
    comprobar('la placa dice que el peldaño de la palabra es provisional y hasta dónde baja',
      malProv.length === 0,
      malProv.length ? 'falla: ' + malProv.join(' · ')
        : 'lo publica acotado, con su techo, y sin el camino que lo titulaba');

    /* 5 · Y EL ACOTAMIENTO VA ANTES DEL PELDAÑO. El peldaño se lee en el
       color de su escalón y en una captura ese color domina: leído en orden,
       quien llega al peldaño ya sabe que es con lo confirmado. */
    comprobar('y el acotamiento va ANTES del peldaño, no después',
      iAcot > 0 && iPeld > 0 && iAcot < iPeld,
      iAcot < 0 ? 'no acota el peldaño de la palabra'
        : iPeld < 0 ? 'no se encontró el peldaño en su rama'
        : iAcot > iPeld ? 'va detrás: el peldaño afirma antes de que el texto lo acote'
        : 'va antes, así que el peldaño se lee ya acotado');

    /* 6 · LA GUARDA DE LA GUARDA: que el intervalo se siga calculando de las
       dos cotas. Con `palMax` sin usar, todo lo de arriba seguiría en verde
       sobre un veredicto que volvió a ser un número solo (v878). */
    const dosCotas = /peorMin = Math\.max\(techos\.casos\.i, palMin/.test(ver) &&
                     /peorMax = Math\.max\(techos\.casos\.i, palMax/.test(ver);
    comprobar('y el intervalo sigue saliendo de las dos cotas', dosCotas,
      dosCotas ? 'peorMin y peorMax salen de palMin y palMax'
        : 'dejaron de calcularse: el peldaño provisional sería un peldaño firme mal rotulado');
  }

  /* 7 · LA BARRA PEGAJOSA TAPA. Medido sobre el papel, con rgba(…,.88) el
     texto de la página se leía A TRAVÉS y al bajar quedaba montado con el
     contenido de la barra. Y el blur lo empeoraba: la franja hueca pesa
     4.898 bytes comprimida con él, 4.661 sin él y 2.927 opaca. */
  const iBar = c70.indexOf('.sp-bar{');
  const bar = iBar >= 0 ? c70.slice(iBar, c70.indexOf('}', iBar)) : '';
  const fondoBar = /background:\s*([^;]+);/.exec(bar);
  comprobar('la barra pegajosa tapa lo que pasa por debajo',
    !!bar && !!fondoBar && !/rgba|hsla|transparent/.test(fondoBar[1]),
    !bar ? 'no se encontró la regla de la barra'
      : !fondoBar ? 'la barra no declara fondo: la página se leería entera a través'
        : /rgba|hsla|transparent/.test(fondoBar[1])
          ? 'vuelve a ser translúcida (' + fondoBar[1].trim() + '): el texto de debajo se lee'
          : 'opaca: ' + fondoBar[1].trim());

  /* 8 · UN TÍTULO NO SE PINTA MÁS CHICO QUE EL CUERPO QUE ENCABEZA.
     Se miden los pares que el CSS declara juntos —`.X h4` contra `.X li` o
     `.X p`—, que es donde un descuido de escala se puede ver sin navegador.
     Encontró `.sp-falta h4` en --t-8 sobre una lista de --t-7: el título
     medía menos que sus propios renglones, y no se veía porque el registro
     no trae hoy el bloque que lo pinta.

     DE QUÉ NO RESPONDE: del ORDEN, no de la proporción. Un título que supera
     a su cuerpo por un píxel pasa, y eso no tiene vara medible en este
     módulo. Y solo ve los pares que comparten prefijo en la misma hoja. */
  const ESC = {};
  const mEsc = /--t-(\d):\s*(?:clamp\([^)]*\)|([\d.]+)rem)/g;
  let me;
  while ((me = mEsc.exec(c70))) if (me[2]) ESC['--t-' + me[1]] = parseFloat(me[2]);

  /* SIN LOS COMENTARIOS, y esto costó una inyección que se quedó en verde.
     Una línea intermedia de un comentario de varias líneas empieza por
     espacios, así que casa como selector y se TRAGA la regla que viene
     detrás: al escribirle un comentario a `.sp-prose h3` su par desapareció
     de la lista y la comprobación pasó a mirar cinco pares en vez de seis,
     sin decir nada. Es la lección de la v926 en CSS. Se sustituyen por
     espacios de la misma longitud para no mover las posiciones. */
  const c70s = c70.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  const TIT = {}, CUE = {};
  const mR = /^([^{}@\/\n][^{}]*)\{([^}]*)\}/gm;
  let mr;
  while ((mr = mR.exec(c70s))) {
    const sel = mr[1].trim(), cuerpo = mr[2];
    const ft = /font-size:\s*var\((--t-\d)\)/.exec(cuerpo);
    if (!ft) continue;
    if (/text-transform:\s*uppercase/.test(cuerpo)) continue;   // una versalita es un rótulo, no un título
    sel.split(',').forEach((uno) => {
      const t = uno.trim();
      const mt = /^(\.[\w-]+)\s+(h[1-6])$/.exec(t);
      const mc = /^(\.[\w-]+)\s+(li|p|dd)$/.exec(t);
      if (mt) TIT[mt[1]] = { px: ESC[ft[1]], tok: ft[1], sel: t };
      if (mc && (!CUE[mc[1]] || ESC[ft[1]] > CUE[mc[1]].px)) CUE[mc[1]] = { px: ESC[ft[1]], tok: ft[1], sel: t };
    });
  }
  const pares = Object.keys(TIT).filter((k) => CUE[k] && TIT[k].px != null && CUE[k].px != null);
  const chicos = pares.filter((k) => TIT[k].px < CUE[k].px);
  if (!Object.keys(ESC).length || pares.length < 2) {
    anotarSinMaterial('MATERIAL - la hoja declara su escala y pares de título y cuerpo',
      Object.keys(ESC).length + ' tamaños y ' + pares.length + ' pares: no habría casi nada que comparar');
  } else {
    comprobar('MATERIAL - la hoja declara su escala y pares de título y cuerpo', true,
      Object.keys(ESC).length + ' tamaños y ' + pares.length + ' pares de título/cuerpo');
    comprobar('ningún título se pinta más chico que el cuerpo que encabeza',
      chicos.length === 0,
      chicos.length
        ? chicos.length + ' con el título por debajo de su cuerpo: ' +
          chicos.map((k) => TIT[k].sel + ' en ' + TIT[k].tok + ' sobre ' + CUE[k].sel + ' en ' + CUE[k].tok).join(' · ')
        : 'los ' + pares.length + ' pares tienen el título por encima de su cuerpo');
  }

  /* 9 · NINGÚN GRÁFICO REPITE EL HÉROE. Hasta la v1048 `grafDeudaInversion`
     dibujaba las MISMAS dos barras del mismo `p.heroe`, con la misma fuente
     y la misma nota, dos dedos debajo del héroe: 598 px de repetición a
     390 px de ancho, y los dos dependían de la misma `p`, así que nunca
     había uno sin el otro. */
  const iBloq = j70.indexOf('function bloqueDeGraficos(');
  const bloq = iBloq >= 0 ? j70.slice(iBloq, j70.indexOf('\n  }\n', iBloq)) : '';
  const repiten = [];
  (bloq.match(/poner\((\w+)\(p\)\)/g) || []).forEach((ll) => {
    const nom = /poner\((\w+)\(p\)\)/.exec(ll)[1];
    const i = j70.indexOf('function ' + nom + '(');
    if (i < 0) return;
    const cuerpo = j70.slice(i, j70.indexOf('\n  }', i));
    if (/p\.heroe/.test(cuerpo) && /interesesBn/.test(cuerpo) && /inversionBn/.test(cuerpo))
      repiten.push(nom);
  });
  if (!bloq) {
    anotarSinMaterial('MATERIAL - el bloque de gráficos se deja leer',
      'no se encontró bloqueDeGraficos: no se vigilaría la repetición del héroe');
  } else {
    comprobar('MATERIAL - el bloque de gráficos se deja leer', true,
      (bloq.match(/poner\(/g) || []).length + ' llamadas a poner()');
    comprobar('ningún gráfico del bloque repite el héroe',
      repiten.length === 0,
      repiten.length
        ? repiten.length + ' dibujan el mismo p.heroe que el héroe: ' + repiten.join(' · ') +
          ' — dos paneles idénticos seguidos'
        : 'ninguno: el héroe es el único que dibuja esas dos barras');
  }
}

  /* ── EL PELDAÑO DICE QUÉ MIDE, Y QUÉ NO (v1051) ───────────────────────
     La placa se fotografía y la captura circula sola. Con el rótulo
     diciendo «Fiabilidad» a secas, un «Fiable» en verde a 32 px se lee
     como un veredicto sobre el gobierno entero — y no lo es: mide UN eje
     de tres, y los otros dos no publican nivel. Es la clase de la v879
     (un rótulo que nombra la familia y mide una parte) con la exención
     silenciosa de la v966 encima (lo que no se publica no se dice). */
  (function () {
    const j70 = leer('js/70-seguimiento.js'), c70 = leer('css/70-seguimiento.css');
    const cod = soloCodigo(j70);
    const trozo = function (a, b) {
      const i = cod.indexOf(a); if (i < 0) return '';
      const j = cod.indexOf(b, i); return j < 0 ? cod.slice(i) : cod.slice(i, j);
    };
    const placa = trozo('function placaDe(', 'function pintarPlacaPortada');
    const ejeb  = trozo('function ejeB(', 'EJE C');

    // MATERIAL primero (v920): sin la placa y sin el eje B no hay nada que mirar.
    if (!placa || !ejeb) {
      anotarSinMaterial('el peldaño dice qué mide y qué no',
        'no se pudieron leer placaDe o ejeB');
    } else {
      // 1 · El rótulo nombra lo que mide, no la familia.
      /* v1089: el rótulo de la placa es ahora SIEMPRE «Cómo está el país»,
         porque el camino que titulaba con la palabra se retiró. Lo que esta
         aserción protegía sigue vigente y cambió de sitio: que el peldaño de
         la palabra no se publique como si midiera el gobierno entero. Ahora
         eso lo dice su propia frase, que empieza nombrando lo que mide. */
      const r1 = /'sp-fi-vlabel', 'Cómo está el país'/.test(placa) &&
                 /mide sus palabras, no el país/.test(placa) &&
                 !/'sp-fi-vlabel',\s*'Fiabilidad'\s*\)/.test(placa);
      comprobar('el rótulo del peldaño dice QUÉ mide, no la familia entera', r1,
        r1 ? 'la placa titula con el país, y el peldaño de la palabra dice que mide sus palabras'
           : (!/'sp-fi-vlabel', 'Cómo está el país'/.test(placa)
              ? 'la placa no titula con el país: un peldaño de titular se lee como un veredicto sobre el gobierno entero'
              : !/mide sus palabras, no el país/.test(placa)
                ? 'el peldaño de la palabra se publica sin decir que mide sus palabras'
                : 'volvió a «Fiabilidad» a secas'));

      // 2 · Y la placa dice qué NO mide.
      /* La PROPIEDAD y no dos palabras: «deterioro institucional» y «rumbo
         del gasto» literales se pusieron rojas en la v1055 al pasar la
         enumeración a calcularse de `enLista`, que es justo lo que impide
         que se quede vieja. Lo que tiene que seguir siendo cierto es que la
         placa NOMBRE los otros ejes, salgan de donde salgan. */
      const enListaDecl = [...cod.matchAll(/enLista: '([^']+)'/g)].map((m) => m[1]);
      const r2 = /sp-fi-alcance/.test(placa) && /mayus\(listaN\)/.test(placa) && enListaDecl.length > 1;
      comprobar('y la placa dice qué NO mide, donde se lee la cifra', r2,
        r2 ? 'nombra los otros ejes en la placa misma, con la enumeración calculada de sus nombres declarados'
           : (!/sp-fi-alcance/.test(placa)
              ? 'no lo dice: el alcance solo estaría en el bloque de los ejes, a seis pantallas de la placa'
              : 'lo dice sin nombrar los otros ejes, así que el lector no sabe qué queda fuera'));

      // 3 · Y cuántos de los otros dos publican nivel se CALCULA (v903).
      const r3 = /ejesDe\([^)]*\)[\s\S]{0,160}?publicable/.test(placa);
      comprobar('y cuántos de los otros ejes publican nivel se calcula, no se escribe', r3,
        r3 ? 'sale de ejesDe y de su propio publicable'
           : 'lo lleva escrito a mano: el día que el eje B publique nivel, la placa seguiría diciendo que no');

      // 4 · Las DOS redacciones escritas (v970): la de hoy y la del día que vuelva.
      const r4 = /ninguno[\s\S]{0,80}publica nivel/.test(placa) && /cada uno con/.test(placa);
      comprobar('y están escritas las dos redacciones, la de ninguno y la de alguno', r4,
        r4 ? 'las dos escritas: la de hoy y la del día que un eje publique el suyo'
           : 'solo está la de hoy: el día que un eje publique su nivel, la frase no existiría');

      // 5 · El eje B declara su SEGUNDA razón, y sale del registro.
      //     Mide la PROPIEDAD y no el nombre de la variable del día (v890):
      //     la v1061 partió aquel `sinDeclarar` en tres estados y esta
      //     comprobación se puso roja por un cambio legítimo.
      const r5 = /sinRevisar/.test(ejeb) && /NADIE LO HA CLASIFICADO/.test(ejeb);
      comprobar('el eje B dice que su cero puede ser falta de clasificación, no de hechos', r5,
        r5 ? 'declara sus dos razones: la media histórica y lo que falta por clasificar'
           : (!/sinDeclarar/.test(ejeb)
              ? 'solo declara la media histórica: un «I-05 · 0» se leería como que no hubo choques, cuando casi ninguna entrada declara indicador'
              : 'nombra la clasificación sin decir qué significa el cero'));

      // 6 · …y la cifra se calcula, con sus dos redacciones (v970).
      const calcula = /ind\.sinRevisar[\s\S]{0,500}?ind\.actos/.test(ejeb);
      const r6 = calcula && /ya NO quiere decir que falte clasificar/.test(ejeb);
      comprobar('y esa cifra se calcula del registro, con sus dos redacciones', r6,
        r6 ? 'sale de ind.sinRevisar sobre ind.actos, y baja sola al clasificar'
           : (calcula
              ? 'falta la redacción del día que llegue a cero: la frase no existiría'
              : 'la cifra está escrita a mano y envejecería sola'));

      // 7 · La regla de CSS existe, o el párrafo sale sin pintar (v895).
      const r7 = /\.sp-fi-alcance\s*\{/.test(c70);
      comprobar('y la clase del alcance tiene su regla', r7,
        r7 ? 'pintada, con el hilo y el gris de acotación de la placa'
           : 'sin regla: el párrafo saldría sin el hilo ni el color de acotación de la placa');
    }

    /* ══ v1057 · LA REALIDAD MANDA, Y LA PALABRA NO FIJA NADA ════════════
       Hasta la v1056 el titular de la página era el peldaño de la escalera
       de fiabilidad, y esa escalera cuenta casos con proceso abierto,
       cambios de postura y qué parte de NUESTRO registro está verificada.
       Ninguna de las tres mide cómo está el país, así que la página
       publicaba «Fiable» en verde a 32 px sobre un gobierno cuyos tres ejes
       de realidad no publican nivel ninguno.

       Y no era solo de lectura: `ejeA.publicable` es false desde la v959
       —«la confiabilidad no se puede dictaminar»— y la v1050 publicó su
       peldaño igual, once versiones después. Las dos rutas daban respuestas
       opuestas sobre el mismo hecho: la clase B en el sitio más caro. */
    (function () {
      const j70 = leer('js/70-seguimiento.js'), c70 = leer('css/70-seguimiento.css');
      const cod = soloCodigo(j70);
      const trozo = function (a, b) {
        const i = cod.indexOf(a); if (i < 0) return '';
        const j = cod.indexOf(b, i); return j < 0 ? cod.slice(i) : cod.slice(i, j);
      };
      const vg    = trozo('function veredictoGeneral(', 'function ejesDe(');
      /* `peorNivelDe` e `indiceEnEscalera` viven FUERA de
         `veredictoGeneral` —son la escala, no el veredicto—, así que
         buscarlas dentro del trozo no las encontraría. Se busca dentro
         del trozo de la TABLA, que es donde están escritas (v854). */
      const vg0   = trozo('var PESO_EJE = {', 'function veredictoGeneral(');
      /* El corte es `dichoDelVeredicto` y no `pintarPlacaPortada`: esa
         función vive entre las dos y nombra «Cómo está el país» por su
         cuenta, así que con el corte de abajo el trozo la incluía y la
         comprobación del titular pasaba en verde con el titular devuelto al
         peldaño. Lo destapó la inyección fiel, no leer el patrón — es la
         v854: el trozo no era el que se creía. */
      const placa = trozo('function placaDe(', 'function dichoDelVeredicto(');
      const tabla = trozo('var PESO_EJE = {', '};');
      /* Los ejes que el módulo compone de verdad, leídos de `ejesDe` y no de
         una lista escrita acá: con dos listas, la guarda acabaría
         comprobando que es igual a sí misma (v957). */
      const compone = (trozo('function ejesDe(', '}').match(/eje([A-Z])\(/g) || [])
        .map((s) => s.replace(/eje|\(/g, ''));
      const declara = [...tabla.matchAll(/^\s*([A-Z]):\s*\{([^}]*)\}/gm)]
        .map((m) => ({ eje: m[1], cuerpo: m[2] }));

      // MATERIAL primero (v920): sin la tabla, sin el cálculo o sin los ejes
      // compuestos no hay nada que mirar, y todo lo de abajo pasaría solo.
      if (!vg || !placa || !declara.length || !compone.length) {
        anotarSinMaterial('la realidad manda sobre la palabra',
          'no se pudieron leer PESO_EJE (' + declara.length + '), veredictoGeneral o ejesDe (' +
          compone.length + ')');
      } else {
        // 1 · El veredicto de la página sale de los ejes de REALIDAD.
        const g1 = /mide\s*===\s*'realidad'/.test(vg);
        comprobar('el veredicto de la página sale de los ejes que miden la realidad', g1,
          g1 ? 'filtra por mide === realidad: la palabra no entra en el cálculo'
             : 'no filtra por lo que mide cada eje: el peldaño de la palabra volvería a ser el veredicto ' +
               'de la página, que es lo que publicaba «Fiable» sobre tres ejes de realidad sin nivel');

        // 2 · Y la PALABRA no puede fijarlo ni subirlo: ni siquiera se
        //     consulta para decidir el estado, solo viaja para publicarse.
        const g2 = g1 && !/mide\s*===\s*'palabra'/.test(vg) && /palabra:\s*palabra/.test(vg);
        comprobar('y la palabra viaja con él, pero no decide su estado', g2,
          g2 ? 'el estado sale solo de los ejes de realidad; la palabra se pasa para publicarla debajo'
             : (/mide\s*===\s*'palabra'/.test(vg)
                ? 'la palabra entró en la decisión: podría fijar o subir el veredicto, y lo que dice un ' +
                  'gobernante no mejora el país'
                : 'la palabra no viaja con el veredicto: la placa tendría que ir a buscarla por su cuenta'));

        // 3 · Todo eje que el módulo compone declara su peso. Falla CERRADO
        //     (v880): un eje nuevo sin declararlo no puede colarse de
        //     «realidad» ni de «palabra» por omisión.
        const sinPeso = compone.filter((e) => !declara.some((d) => d.eje === e));
        const sobra   = declara.filter((d) => compone.indexOf(d.eje) === -1).map((d) => d.eje);
        const g3 = !sinPeso.length && !sobra.length;
        comprobar('y los cuatro ejes que se componen declaran su peso, sin sobrar ninguno', g3,
          g3 ? compone.length + ' ejes compuestos y los mismos ' + declara.length + ' en la tabla'
             : (sinPeso.length
                ? 'sin declarar su peso: ' + sinPeso.join(' · ') + ' — no se sabría si fija el veredicto'
                : 'declarados y sin componerse: ' + sobra.join(' · ') + ' — la tabla vigila un eje que no existe'));

        // 4 · Cada uno declara los TRES campos, y la dirección de su escala
        //     no se omite: las dos que existen van al revés una de la otra
        //     —A sube a mejor, B sube a peor— y comparar niveles crudos
        //     publicaría un «B5 · Crítico» como el mejor de los dos.
        const flojos = declara.filter((d) =>
          !/mide:\s*'(realidad|palabra)'/.test(d.cuerpo) ||
          !/dir:\s*[+-]?1/.test(d.cuerpo) ||
          !/escala:\s*(true|false)/.test(d.cuerpo)).map((d) => d.eje);
        const g4 = !flojos.length;
        comprobar('y cada uno declara qué mide, hacia dónde va su escala y si la tiene', g4,
          g4 ? 'los ' + declara.length + ' con sus tres campos: mide, dir y escala'
             : 'incompletos: ' + flojos.join(' · ') + ' — sin la dirección, comparar niveles crudos ' +
               'publicaría un B5 crítico como si fuera el mejor de los dos');

        // 5 · LA ESCALA COMÚN, QUE YA ESTÁ DECLARADA (v1086) — y la
        //     comprobación se hace MÁS PRECISA, no más laxa.
        //
        //     Hasta la v1085 esto exigía que el módulo se PARARA diciendo que
        //     le faltaba la escala. Quien firma el módulo la decidió, así que
        //     esa aserción falla por un cambio legítimo y aflojarla sería
        //     perder la prueba entera. Lo que se mide ahora es la propiedad
        //     que de verdad importaba detrás de aquella: que la escala NO se
        //     haya inventado para esto.
        //
        //     Tres cosas, y las tres son comprobables:
        //       · el orden sale de `ESCALERA`, la escalera de cinco peldaños
        //         que este módulo ya tenía escrita para el eje de la palabra,
        //         y NO de números sueltos ni de una tabla nueva;
        //       · la composición es «manda el peor» y no un promedio: ninguna
        //         función promedia, que es la regla de oro del pliego;
        //       · un nivel que no corresponda a un peldaño no compone nada
        //         —falla cerrado (v880)— y lo dice con un estado propio.
        const usaEscalera = /function indiceEnEscalera/.test(vg0) &&
                            /ESCALERA\[k\]\.id === id/.test(vg0);
        const peorNoPromedia = /function peorNivelDe/.test(vg0) &&
                               /if \(j > i\) \{ i = j; cual = e; \}/.test(vg0) &&
                               !/\/ *real\.length/.test(vg) && !/promedi[oa]\(/.test(vg0);
        const fallaCerrado = /nivel-fuera-de-escala/.test(vg) && /return -1;/.test(vg0);
        const mitades5 = [
          ['el orden sale de ESCALERA y no de una tabla nueva', usaEscalera],
          ['manda el peor, y ninguna función promedia', peorNoPromedia],
          ['un nivel fuera de la escalera no compone nada y lo dice', fallaCerrado],
          ['y el PISO lleva estado propio, distinto del dictamen', /'piso'/.test(vg) && /'dictamen'/.test(vg)]
        ];
        const mal5 = mitades5.filter((x) => !x[1]).map((x) => x[0]);
        /* ── UN PELDAÑO TIENE DOS TEXTOS, Y NO SON INTERCAMBIABLES (v1090)
           `ESCALERA` es la escala de gravedad común y sus descripciones
           hablan de casos de corrupción y cambios de postura, porque de ahí
           salió: es la escalera del eje de la PALABRA. Eso es correcto donde
           se usa —la caja de la ficha va rotulada— y es FALSO en cuanto un
           eje de realidad aterriza en el mismo peldaño: «Nada fiable» con la
           definición de los casos de corrupción debajo, sobre un eje que
           cuenta muertes en operaciones del Estado, le atribuye al gobernante
           algo que ese eje no midió.

           Así que el peldaño tiene DOS textos: el NOMBRE, común a los cuatro
           ejes y por eso comparable, y la LECTURA, que la pone cada eje y es
           distinta en cada uno. Cinco cosas, y las cinco son comprobables:

             · los dos textos viven en campos distintos, y la definición de la
               escalera NO se llama `d` dentro del nivel de un eje, para que
               ninguna pantalla la pinte creyendo que es la lectura;
             · el nivel de un eje se arma en UNA función, así que un eje nuevo
               no puede armarlo de otra manera (clase B);
             · un eje no es `publicable` sin su lectura — falla cerrado (v880);
             · la ficha pinta el NOMBRE y no el id, que es el defecto que esto
               encontró: imprimía «nada-fiable · undefined»;
             · y la lectura VIAJA con el veredicto y llega a la placa, con su
               redacción para cuando falte (v867, v970). */
        /* ── UNA CIFRA NO SE COMPARA CONTRA UN UMBRAL DE OTRA MEDIDA (v1093)
           La v1092 dejó los dos peldaños de deuda del eje C sin declarar y
           escribió que la razón era que las menciones del registro «se
           contradicen entre sí —60 %, 64 % y 66 %—». Era FALSO, y es el error
           que este proyecto tiene escrito desde la v1085: dos números que no
           cuadran piden la MEDIDA antes que el arreglo. Medidas una por una,
           las tres son cosas distintas y ninguna contradice a otra.

           La razón de verdad es más precisa y es la que esta guarda protege:
           el umbral de la Ley 2155 está definido sobre deuda NETA y la cifra
           verificable es la BRUTA. Comparar una contra la otra es un error de
           categoría, así que:

             · la cifra se publica con su MEDIDA declarada —`medida: 'bruta'`—
               y no como «la deuda», que es lo que permite confundirlas;
             · declara CONTRA QUÉ no se puede comparar, y por qué;
             · y el peldaño sin declarar trae su razón, para que «el eje
               llegaría y falta el dato» no se lea igual que «nadie lo ha
               mirado» (v899, otra vez). */
        const regD = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
        const dB = ((regD.presupuesto || {}).deudaBruta) || {};
        const escC = (cod.match(/var ESCALA_EJE_C = \{[\s\S]*?\n  \};/) || [''])[0];
        const med = [
          ['la cifra de deuda declara su MEDIDA, no se publica como «la deuda»',
           dB.medida === 'bruta' && dB.pct != null && !!dB.fecha],
          ['y declara contra qué NO se puede comparar, y por qué',
           /deuda NETA/.test(String(dB.noComparableCon || '')) &&
           /error de categor[ií]a/.test(String(dB.noComparableCon || ''))],
          ['y dice por qué las otras cifras DIFIEREN, en vez de llamarlas contradicción',
           /DENOMINADOR/.test(String(dB.porQueLasOtrasCifrasDIFIEREN || '')) &&
           /de qué mide cada una/.test(String(dB.porQueLasOtrasCifrasDIFIEREN || ''))],
          ['y su convergencia va declarada, con el estándar que la v1082 fijó',
           String(dB.convergencia || '').length > 80 && (dB.fuentes || []).length >= 3],
          ['la escala del eje C dice por qué sus dos peldaños de deuda siguen sin lectura',
           /sinDeclararPorque: \{/.test(escC) && /deuda NETA/.test(escC)],
          ['y esa razón NO vive solo en un comentario (v926)',
           /sinDeclararPorque/.test(escC)],
          ['y la ficha la pinta junto al peldaño sin declarar',
           /Por qué falta: ' \+ x\.texto/.test(cod)],
          ['y el intento del eje C queda FECHADO, con lo que sí consiguió y lo que no',
           (function () {
             const t = ((regD.tramites || {}).C || {}).ultimoIntento || {};
             return !!t.fecha && t.canal === 'búsqueda' && /PARCIAL/.test(String(t.resultado || '')) &&
                    /deuda NETA/.test(String(t.resultado || ''));
           }())]
        ];
        const malMed = med.filter((x) => !x[1]).map((x) => x[0]);
        comprobar('una cifra lleva su MEDIDA y declara contra qué umbral NO se puede comparar',
          malMed.length === 0,
          malMed.length ? 'falla: ' + malMed.join(' · ')
            : 'la bruta se publica como bruta, con lo que no se puede comparar y por qué las otras ' +
              'cifras difieren; y el peldaño que falta dice por qué falta');

        /* ── LOS CINCO PELDAÑOS DE UN EJE, NINGUNO EN SILENCIO (v1091)
           La v1090 le dio lectura al peldaño que el eje PUBLICA. Faltaban los
           otros cuatro, y el hueco vivía en la prosa de una bitácora —«no son
           alcanzables, medido y declinado»—, que es justo la forma en que una
           declaración envejece sin que nada la mida.

           Y hay DOS causas que se leían igual y piden acciones distintas
           (v899): que el eje no PUEDA alcanzar un peldaño es un límite suyo y
           un lector debería saberlo; que pueda y nadie haya escrito la
           lectura es trabajo pendiente. La primera va declarada con su razón,
           la segunda sale en ámbar.

           Lo que hace que esto FALLE CERRADO (v880) es que la escalera del
           eje se calcula recorriendo `ESCALERA` y no las claves de la escala:
           un peldaño nuevo nace `sin-declarar` y aparece, en vez de quedarse
           sin fila y desaparecer. Y por eso la cuenta se mide contra el largo
           de `ESCALERA` (v903) y no contra un número escrito. */
        const escD = (vg0.match(/var ESCALA_EJE_D = \{[\s\S]*?\n  \};/) || [''])[0] ||
                     (cod.match(/var ESCALA_EJE_D = \{[\s\S]*?\n  \};/) || [''])[0];
        const nEsc = (cod.match(/var ESCALERA = \[[\s\S]*?\n  \];/) || [''])[0]
                       .split(/\{ id: '/).length - 1;
        const idsEsc = ((cod.match(/var ESCALERA = \[[\s\S]*?\n  \];/) || [''])[0]
                        .match(/\{ id: '([a-z-]+)'/g) || []).map((x) => x.replace(/.*'([a-z-]+)'/, '$1'));
        const cubiertos = idsEsc.filter((id) =>
          new RegExp("id: '" + id + "'").test(escD) || new RegExp("'" + id + "':").test(escD));

        /* LA ATADURA (v1091): `PESO_EJE[k].escala` es una bandera escrita a
           mano y la existencia de la escala es un hecho del código. Eran dos
           codificaciones de «¿este eje tiene escala?» y YA se habían
           separado: la tabla decía `true` para los ejes A y B y ninguno tenía
           objeto de escala. Se ata, así que poner la bandera sin escribir la
           escala —o al revés— sale en rojo. */
        const escalasEje = (cod.match(/var ESCALA_EJE_[A-D] = \{/g) || [])
          .map((x) => x.replace(/.*ESCALA_EJE_([A-D]).*/, '$1'));
        const banderas = {};
        ((vg0.match(/var PESO_EJE = \{[\s\S]*?\n  \};/) || [''])[0]
          .match(/([A-D]): \{[^}]*escala: (true|false)/g) || []).forEach((x) => {
            const m = x.match(/([A-D]): \{[^}]*escala: (true|false)/);
            banderas[m[1]] = m[2] === 'true';
          });
        const desatados = Object.keys(banderas).filter((k) =>
          banderas[k] !== (escalasEje.indexOf(k) >= 0));
        comprobar('la bandera `escala` de cada eje coincide con que su escala EXISTA',
          Object.keys(banderas).length >= 4 && desatados.length === 0,
          Object.keys(banderas).length < 4
            ? 'no se leyeron las cuatro banderas de PESO_EJE: ' + Object.keys(banderas).join(' · ')
            : desatados.length
              ? 'la tabla y el código no coinciden en: ' + desatados.map((k) =>
                  k + ' (tabla ' + banderas[k] + ', escala escrita ' + (escalasEje.indexOf(k) >= 0) + ')').join(' · ')
              : 'las cuatro coinciden · con escala escrita: ' + (escalasEje.join(' · ') || 'ninguna'));

        /* Y las dos mitades por separado, con el detalle diciendo cuál
           falló (v973): la primera versión de esto era un booleano con un
           `=== false ||` en medio que la dejaba casi incapaz de fallar, y una
           guarda que no puede fallar es un verde (v878). */
        const mitSin = [
          ['la ficha dice que el eje no tiene escala escrita', /no tiene escala escrita/.test(cod)],
          ['y distingue eso de «falta un dato»', /no un dato que falte/.test(cod)],
          ['y denuncia la contradicción si la tabla dice que sí la tiene',
           /la tabla de peso declara que SÍ la tiene/.test(cod)],
          ['y la clase tiene regla en el css', /\.sp-c3-sin-escala\{/.test(c70)]
        ];
        const malSin = mitSin.filter((x) => !x[1]).map((x) => x[0]);
        comprobar('y un eje SIN escala lo dice en la ficha, no desaparece',
          malSin.length === 0,
          malSin.length ? 'falla: ' + malSin.join(' · ')
            : 'lo dice, distingue «no hay escala» de «falta un dato» —pide una decisión, no ' +
              'archivo— y denuncia la contradicción con la tabla');

        const esc = [
          ['la escalera de un eje se recorre sobre ESCALERA, no sobre sus propias claves',
           /function escaleraDeEje\(escala\) \{\s*\n\s*return ESCALERA\.map/.test(vg0)],
          ['y la lectura de un peldaño tiene TRES estados',
           /estado: 'lectura'/.test(vg0) && /estado: 'no-alcanzable'/.test(vg0) &&
           /estado: 'sin-declarar'/.test(vg0)],
          ['el eje D declara los peldaños que NO alcanza, con su razón',
           /noAlcanza: \{/.test(escD) && /no puede certificar que un gobierno esté bien/.test(escD)],
          ['y los ' + nEsc + ' peldaños de la escalera están cubiertos por un corte o por una razón',
           nEsc > 0 && cubiertos.length === nEsc],
          ['y el eje publica su escalera entera en su objeto',
           /escaleraEje: escaleraDeEje\(ESCALA_EJE_D\)/.test(cod)],
          ['la ficha la pinta, con el peldaño publicado marcado',
           /sp-c3-esc-i e-' \+ x\.estado/.test(cod) && /es el que publica/.test(cod)],
          ['y el recuento de los SIN DECLARAR llega al resumen sin desplegar',
           /SIN DECLARAR/.test(cod) && /sm\.className \+= ' mal'/.test(cod)],
          ['y los tres estados tienen regla propia en el css',
           /\.sp-c3-esc-i\.e-no-alcanzable span\{/.test(c70) &&
           /\.sp-c3-esc-i\.e-sin-declarar\{/.test(c70)]
        ];
        const malEsc = esc.filter((x) => !x[1]).map((x) => x[0]);
        comprobar('los ' + nEsc + ' peldaños de un eje llevan su lectura, o la razón de que el eje no los alcance',
          malEsc.length === 0,
          malEsc.length ? 'falla: ' + malEsc.join(' · ')
            : 'cubiertos ' + cubiertos.length + ' de ' + nEsc + ': los que el eje alcanza con su ' +
              'lectura y los que no con su razón, y un peldaño nuevo nace «sin declarar» y se ve');

        const pel = [
          ['el nivel de un eje se arma en UNA función', /function nivelDeEje\(id, lectura, deDonde\)/.test(vg0)],
          /* POR CONTENIDO Y NO POR DISTANCIA (v935). La primera versión de
             esta aserción exigía que las dos líneas estuvieran a menos de 200
             caracteres, y un ancla de N caracteres envejece a la primera
             línea que se mete en medio. Se buscan las dos cosas DENTRO del
             trozo de la función, que es lo que de verdad importa. */
          ['y lleva el NOMBRE del peldaño aparte de su lectura',
           (function () {
             const fn = (vg0.match(/function nivelDeEje\(id, lectura, deDonde\) \{[\s\S]*?\n  \}/) || [''])[0];
             return /t: ESCALERA\[i\]\.t/.test(fn) && /lectura: lectura \|\| null/.test(fn);
           }())],
          ['y la definición de la escalera NO se llama `d` ahí dentro',
           /defEscalera: ESCALERA\[i\]\.d/.test(vg0)],
          ['y sin lectura no devuelve nivel publicable',
           /r\.publicable = !!\(r\.nivel && r\.nivel\.lectura\)/.test(cod)],
          ['la ficha pinta el NOMBRE del peldaño y no su id',
           /ej\.nivel && ej\.nivel\.t \? ej\.nivel\.t : 'sin nivel'/.test(cod) &&
           !/ej\.nivel\.id \+ ' · '/.test(cod)],
          ['y pinta la lectura de ese peldaño en ese eje',
           /Qué significa «' \+ ej\.nivel\.t \+ '» en este eje/.test(cod)],
          ['y lo DICE cuando un eje publica nivel sin lectura',
           /no declara qué significa en '/.test(cod)],
          ['la lectura viaja con el veredicto, no se reconstruye en la placa',
           /lectura: \(e\.nivel && e\.nivel\.lectura\) \|\| ''/.test(vg0)],
          ['y la placa la imprime junto al titular',
           /'Qué significa «' \+ \(\(vg\.nivel && vg\.nivel\.t\)/.test(cod)],
          ['y la clase tiene regla en el css', /\.sp-fi-vlect\{/.test(c70) &&
           /\.sp-c3-eje-lectura\{/.test(c70)]
        ];
        const malPel = pel.filter((x) => !x[1]).map((x) => x[0]);
        comprobar('un peldaño lleva su NOMBRE común y su LECTURA por eje, y la lectura llega al papel',
          malPel.length === 0,
          malPel.length ? 'falla: ' + malPel.join(' · ')
            : 'el nombre se compara entre ejes y la lectura la pone cada eje, con su redacción para ' +
              'cuando falte y sin que la definición de la escalera de la palabra pueda colarse');

        /* ── EL PISO SATURADO CIERRA EL DICTAMEN (v1089) ───────────────
           Con el piso en el ÚLTIMO peldaño, el veredicto está determinado:
           lo que falta solo puede empeorarlo y por debajo no hay peldaño, así
           que el intervalo se cierra sobre un punto. Tres cosas que lo hacen
           honesto y no un atajo, y las tres son comprobables:

             · la saturación se CALCULA contra el largo de la escalera y no
               contra el id del último peldaño (v903): agregar un peldaño peor
               reabre el intervalo solo, sin que nadie se acuerde — y escribir
               `'nada-fiable'` acá sería la cifra que envejece sola;
             · el piso NO saturado sigue siendo piso, que es lo que impide que
               esto se lea como «cualquier piso vale como dictamen»;
             · y el texto dice que los ejes que faltan SIGUEN sin medir, y que
               si el eje que lo sostiene bajara, volvería a quedar abierto. Un
               dictamen determinado por saturación no es un dictamen completo,
               y confundirlos sería publicar más de lo que se sabe. */
        const sat = [
          ['la saturación se calcula contra el largo de la escalera',
           /peor\.i === ESCALERA\.length - 1/.test(vg)],
          ['y NO se escribe el id del último peldaño a mano',
           !/saturado[\s\S]{0,80}'nada-fiable'/.test(vg)],
          ['el piso saturado devuelve dictamen y se marca como tal',
           /porSaturacion: true/.test(vg)],
          ['y el piso NO saturado sigue siendo piso',
           /if \(sin\.length && saturado\)[\s\S]*?if \(sin\.length && peor\.i >= 0\) \{[\s\S]{0,120}estado: 'piso'/.test(vg)],
          ['y dice que lo que falta SIGUE sin medir', /y no porque se haya medido todo/.test(vg)],
          ['y que si el eje que lo sostiene bajara, volvería a quedar abierto',
           /volver[ií]a a quedar abierto/.test(vg)],
          /* DENTRO del trozo de la rama saturada y no en todo
             `veredictoGeneral` (v854): `faltan: sin.map` también está en la
             rama del piso y en la de «sin dictamen», así que un patrón suelto
             seguía encontrándolo con la rama saturada ya sin él. Lo descubrió
             una inyección fiel que NO mordía, que es la señal de que lo que
             falta es la aserción y no la inyección (v1029). */
          ['y nombra los ejes que faltan igual que el piso',
           /faltan: sin\.map/.test((vg.match(/if \(sin\.length && saturado\) \{[\s\S]*?\n    \}/) || [''])[0])]
        ];
        const malSat = sat.filter((x) => !x[1]).map((x) => x[0]);
        comprobar('y un piso en el ÚLTIMO peldaño cierra el dictamen, calculado y no escrito',
          malSat.length === 0,
          malSat.length ? 'falla: ' + malSat.join(' · ')
            : 'la saturación sale del largo de la escalera, el piso alto sigue siendo piso, y el ' +
              'texto no vende el dictamen como completo');

        comprobar('y la escala común es la ESCALERA que ya estaba declarada, con «manda el peor» y sin promediar',
          mal5.length === 0,
          mal5.length ? 'falla: ' + mal5.join(' · ')
                      : 'la escala no se escribió para esto: es la de los cinco peldaños del eje de la ' +
                        'palabra, la composición es el peor de los que publican, y un id fuera de la ' +
                        'escalera no compone nada');

        // 6 · La placa lee ESE veredicto y no el peldaño.
        const g6 = /f\.general/.test(placa) && /Cómo está el país/.test(placa);
        comprobar('la placa titula con el veredicto de la página, no con el peldaño', g6,
          g6 ? 'el titular sale de f.general y dice de qué habla'
             : 'la placa volvió a titular con el peldaño de la palabra, que es lo que publicaba ' +
               '«Fiable» sobre un país sin medir');

        // 7 · Y el COLOR no se pone cuando no hay dictamen. Es la mitad que
        //     de verdad hace el trabajo: el ojo llega al verde antes que al
        //     texto, así que un «Fiable» acotado en tres líneas pero pintado
        //     de verde a pantalla completa sigue afirmando (lo vio el papel).
        const g7 = /sp-fi-v-sin-dictamen/.test(placa) && /\.sp-fi-v-sin-dictamen\s*\{/.test(c70);
        comprobar('y no se pinta con el color de un peldaño que no publica', g7,
          g7 ? 'clase propia en gris, del mismo token que «sin datos»: es deuda nuestra, no un hallazgo'
             : (!/sp-fi-v-sin-dictamen/.test(placa)
                ? 'la placa se sigue pintando con el color del peldaño: saldría en verde bajo un ' +
                  '«Sin dictamen»'
                : 'sin regla de CSS: la clase no pintaría nada y el valor saldría casi en blanco'));

        // 8 · La escalera de la ficha dice de qué es antes de su color.
        const ficha = trozo("var ver = el('section', 'sp-fi-ver-box", 'var esc =');
        const g8 = /sp-fi-ver-rot/.test(ficha) && /\.sp-fi-ver-rot\s*\{/.test(c70);
        comprobar('y la escalera de la ficha dice de qué es antes de su color', g8,
          g8 ? 'lleva su rótulo, y dice que no fija el veredicto de la página'
             : 'arranca sin rótulo: la escalera con «Fiable» marcado en verde sale sin decir de qué es');

        // 9 · LA GUARDA DE LA GUARDA. Sin esto, `veredictoGeneral` podría
        //     dejar de leer la tabla y todo lo de arriba seguiría en verde
        //     sobre una tabla que es documentación (v878).
        const g9 = /PESO_EJE\[/.test(vg);
        comprobar('y el cálculo sigue leyendo la tabla de peso', g9,
          g9 ? 'la lee: cambiar un eje de lado en la tabla mueve el veredicto'
             : 'dejó de leerla: la tabla sería documentación y el reparto entre realidad y palabra ' +
               'volvería a estar escrito dentro del cálculo');
      }
    })();

    /* ══ v1056 · TODO GRÁFICO DECLARA HASTA CUÁNDO LLEGAN SUS CIFRAS ══════
       El registro se sella «actualizado» con la fecha de hoy y sus series
       pueden llevar meses sin un dato nuevo —medido: la deuda 48 días, los
       bombardeos 50, la cocaína 638—. Una línea que se detiene en su último
       punto se lee como la de hoy, y ahí no hace falta que nadie mienta:
       basta que nadie lo diga. */
    {
      const trozo = (n) => {
        const i = j70.indexOf('function ' + n + '(');
        return i < 0 ? '' : j70.slice(i, j70.indexOf('\n  }', i));
      };
      const tTar = trozo('tarjetaGrafica');
      const tLin = trozo('lineaDeCorte');
      const tPie = trozo('pieDentro');
      const hay = /function conCorte\(/.test(j70) && /function sinFechaPropia\(/.test(j70) &&
                  tTar && tLin && tPie;
      /* Falla en ROJO y no con su `?`: el material es codigo de un archivo
         servido, que no puede quedarse vacio por una mejora (v1026). */
      comprobar('MATERIAL · las tres marcas de corte y la tarjeta se dejan leer', !!hay,
        hay ? 'conCorte · sinFechaPropia · lineaDeCorte · tarjetaGrafica · pieDentro'
            : 'NO PUDO CORRER: falta alguna de las marcas o de las dos funciones');
      if (hay) {
        /* La tarjeta es la ÚNICA puerta por la que pasan los nueve gráficos, y
           por eso el corte lo pinta ella y no cada sitio de llamada: con la
           declaración repartida, el décimo es el que se olvida (v867). */
        const pinta = /lineaDeCorte\(cuerpo\)/.test(tTar);
        comprobar('la tarjeta pinta la linea de corte de lo que acaba de dibujar', pinta,
          pinta ? 'la pinta debajo del cuerpo, que es donde va la procedencia de lo que se miró'
                : 'no la pinta: cada serie tendria que declararlo en su sitio de llamada, y ahi se olvida');

        /* Y la marca de «ya lo imprime el pie» va DONDE se imprime, no en cada
           llamada: un grafico nuevo que use ese pie la hereda solo. */
        const heredada = /data-sp-corte-dentro/.test(tPie);
        comprobar('y el pie que imprime el corte adentro pone su propia marca', heredada,
          heredada ? 'pieDentro la pone, asi que los cinco graficos del presupuesto la heredan'
                   : 'no la pone: la tarjeta repetiria afuera el corte que el SVG ya trae dentro');

        /* Falla CERRADO: un dibujo nuevo que no declare su corte sale en rojo
           en su primera corrida, no cuando alguien mire el papel (v880). */
        /* Se mide CADA salida y no «que el cuerpo mencione conCorte en alguna
           parte». Mi primera version hacia lo segundo, y `grafSerie` tiene DOS
           returns —la serie y el punto unico—: quitandole la anotacion a uno
           la guarda seguia en verde por el otro. Lo cazo la inyeccion. */
        const mudos = [];
        let m; const reG = /\n  function (graf[A-Za-z]+)\(/g;
        while ((m = reG.exec(j70))) {
          const cuerpo = trozo(m[1]);
          if (!cuerpo) continue;
          if (/pieDentro\(/.test(cuerpo)) continue;      // lo hereda del pie
          if (/sp-graf-falta/.test(cuerpo)) continue;     // no dibuja cifras: nada que fechar
          /* Solo los `return` que devuelven un NODO, y el nodo se reconoce
             por como se construye: `el(...)` o `svgEl(...)`. Sin eso, el
             barrido tomaba los `return` de los callbacks de `.map` y `.filter`
             —«return p.v», «return x.n»— y denunciaba once sitios sanos, que
             es la lista de excepciones que envejece (v895). */
          const nodos = new Set();
          let a2; const reA = /\b(?:var|const|let)\s+(\w+)\s*=\s*(?:el|svgEl)\(/g;
          while ((a2 = reA.exec(cuerpo))) nodos.add(a2[1]);
          let r; const reR = /return\s+([^;]+);/g;
          while ((r = reR.exec(cuerpo))) {
            const q = r[1].trim();
            const base = (/^(\w+)/.exec(q) || [])[1];
            if (!base || !nodos.has(base)) continue;      // no devuelve un nodo
            mudos.push(m[1] + ' (return ' + q.slice(0, 26) + ')');
          }
        }
        comprobar('todo dibujo declara su corte, o de donde lo hereda', mudos.length === 0,
          mudos.length === 0
            ? 'los dibujos de este modulo declaran su corte, lo heredan del pie o no dibujan cifras'
            : mudos.join(' · ') + ' — su tarjeta saldria diciendo que no declara hasta cuando llega');

        /* La diferencia contra el corte del propio registro NO lleva umbral:
           el registro declara su fecha y el grafico la suya, asi que se dice
           cuando no son la misma. Un corte a ojo seria el numero que nadie
           puede defender (v869). */
        /* Comparar contra CERO no es un umbral: es «las dos fechas no son la
           misma», que es justo la version sin numero a ojo. Lo que se denuncia
           es una comparacion contra un numero de dias de VERDAD. Mi primer
           patron cazaba `dias > 0` y daba rojo sobre lo correcto. */
        const sinUmbral = /actualizado/.test(tLin) &&
                          !/dias\s*[<>]=?\s*[1-9]/.test(tLin);
        comprobar('y la diferencia sale del corte del registro, no de un umbral de dias', sinUmbral,
          sinUmbral ? 'compara contra `actualizado` y se dice cuando no coinciden, sin numero a ojo'
                    : 'compara contra un numero de dias escrito: un umbral que nadie puede defender');

        /* El corte de una comparacion entre fuentes es su medida MAS RECIENTE,
           y sobre TODOS los grupos: en la portada solo se pinta el primero, y
           declarar el corte de lo que cupo seria declarar el de otra cosa. */
        /* Se mide el trozo que ALIMENTA a conCorte y no una ventana de
           caracteres detras de la palabra `visibles`: con la ventana, cambiar
           `grupos.reduce` por `visibles.reduce` pasaba en verde porque la
           distancia era mayor. Un ancla por distancia envejece (v935). */
        const tPF = trozo('grafPorFuente');
        const iCC = tPF.indexOf('conCorte(');
        /* Se mira la ASIGNACION de la variable que alimenta a conCorte, no una
           ventana de caracteres: es la unica forma de que cambiar `grupos` por
           `visibles` salga en rojo. */
        const arg = iCC < 0 ? '' : (/conCorte\([^,]+,\s*(\w+)/.exec(tPF.slice(iCC)) || [])[1] || '';
        const asig = arg ? (new RegExp('(?:var|const|let)\\s+' + arg +
          '\\s*=([\\s\\S]*?);\\n').exec(tPF) || [])[1] || '' : '';
        const todos = iCC > 0 && /\bgrupos\b/.test(asig) && !/\bvisibles\b/.test(asig);
        comprobar('y el corte de la comparacion entre fuentes sale de todos sus grupos', todos,
          todos ? 'de grupos y no de `visibles`, que en la portada es solo el primero'
                : 'lo saca de los grupos visibles: en la portada declararia el corte de lo que cupo');
      }
    }

    /* ══ v1056 · QUIÉNES SON LOS TERCEROS QUE VERIFICAN ══════════════════
       El techo de claridad dice «registro verificado por terceros: 78 %» y no
       decía por QUIÉNES. Medido, cuatro medios son la mitad de las mil y pico
       fuentes y uno solo es una de cada cinco. Es la clase C: el dato está en
       la dirección de cada fuente y ninguna pantalla lo alcanzaba. */
    {
      const iC = j70.indexOf('function composicionDeFuentes(');
      const tC = iC < 0 ? '' : j70.slice(iC, j70.indexOf('\n  }', iC));
      const iF = j70.indexOf('function fichaDe(');
      const tF = iF < 0 ? '' : j70.slice(iF, j70.indexOf('\n  }\n', iF));
      const hay = tC && tF && /function dominioDe\(/.test(j70);
      comprobar('MATERIAL · la composicion de fuentes y la ficha se dejan leer', !!hay,
        hay ? 'composicionDeFuentes · dominioDe · fichaDe'
            : 'NO PUDO CORRER: falta la composicion, el lector de dominios o la ficha');
      if (hay) {
        /* Pegada a la ficha y no leida del panel: una ficha rehecha a una
           fecha anterior trae la composicion de ESE registro (v890). */
        const viaja = /fuentesComp:\s*composicionDeFuentes\(dd\)/.test(tF);
        comprobar('la composicion viaja con la ficha, no se lee de la pantalla', viaja,
          viaja ? 'sale de composicionDeFuentes(dd) dentro de la ficha, con el registro que se mira'
                : 'la pantalla la calcularia por su cuenta: una ficha de hace un mes traeria la de hoy');

        /* El dominio se saca de la DIRECCION y no de un campo nuevo: un campo
           escrito a mano seria una segunda codificacion de un hecho que ya
           esta en el dato (clase B), y la que se separa es la escrita. */
        const delDato = /dominioDe\(o\.u\)/.test(tC);
        comprobar('y el medio se saca de la direccion de cada fuente', delDato,
          delDato ? 'de `u`, que es donde ya esta, y no de un campo que alguien tenga que escribir'
                  : 'lo lee de otro campo: dos codificaciones de un hecho se separan a la tanda siguiente');

        /* CUANTOS medios hacen la mitad se CALCULA: con un numero escrito, la
           frase se queda vieja el dia que el registro se ensanche y seguiria
           pareciendo medida (v903). */
        const calcula = /acum \* 2 < n/.test(tC) && !/mitad\s*=\s*[1-9]\b/.test(tC);
        comprobar('y cuantos medios hacen la mitad se calcula, no va escrito', calcula,
          calcula ? 'sale de acumular hasta pasar la mitad, asi que baja solo si el registro se ensancha'
                  : 'lleva el numero escrito: la frase quedaria vieja y seguiria pareciendo medida');

        /* Se publica AL LADO de la cifra que acota, no en otra pantalla. */
        /* Cuelga del MISMO `li` del techo. Medirlo como «hay un
           sp-fi-techo-den cerca» pasaba en verde al colgarlo de otro nodo:
           el denominador seguia estando cerca. */
        const alLado = /li\.appendChild\(el\('span', 'sp-fi-techo-den sp-fi-terceros'/.test(j70) &&
                       /li\.appendChild\(dt\)/.test(j70);
        comprobar('y se publica al lado del porcentaje que acota', alLado,
          alLado ? 'en el mismo renglon del techo de claridad, con la lista de medios plegada'
                 : 'no esta junto al techo: el lector veria el 78 % sin saber de cuantos terceros sale');

        /* Y la guarda contra pasarse: lo que se publica es la CONCENTRACION,
           que cualquiera rehace dividiendo. Que esos medios tengan una linea
           editorial o un dueno comun seria OTRA medicion y el registro no la
           tiene, asi que afirmarlo seria pasar de un hecho a una conclusion
           sin decirlo. */
        const iT = j70.indexOf("'sp-fi-techo-den sp-fi-terceros'");
        const frase = iT < 0 ? '' : j70.slice(iT, iT + 1400);
        const acota = /no clasifica la/.test(frase) && /l\u00ednea editorial|línea editorial/.test(frase);
        comprobar('y dice que el registro NO clasifica la linea editorial de nadie', acota,
          acota ? 'publica la concentracion, que es comprobable, y nombra lo que no mide'
                : 'no lo dice: la concentracion se leeria como una afirmacion sobre el encuadre de esos medios');
      }
    }
  })();

console.log('\n  -- antes de mover el texto a pestanas: conteos y alcance (v1139) --');
/* ══ LAS DOS GUARDAS QUE SE ESCRIBEN ANTES DE MOVER NADA ════════════════════
   La v1140 mueve TODO el texto del módulo a pestañas y la v1141 cambia la
   portada por gráficos. Ese es el momento en que un módulo pierde texto sin
   que nadie lo note: no se borra nada: simplemente deja de haber una
   superficie que lo alcance, y desde afuera eso se lee IGUAL que si nunca
   hubiera existido (la clase C de CLAUDE.md).

   Por eso estas dos se escriben ANTES, con el estado de hoy medido, y no
   después: una guarda escrita el día siguiente mide el mundo ya movido y da
   por bueno lo que se haya perdido en el camino.

   SON DOS Y NO UNA porque piden cosas distintas (v899): una cuenta CUÁNTO
   hay, la otra si lo que hay LLEGA a alguien. Un texto puede seguir en el
   archivo —y contar— sin que ninguna pantalla lo pinte. */
(() => {
  const regA = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
  const regB = JSON.parse(leer('assets/data/seguimiento-petro.json'));
  const ed = regA.analisisEditorial || {};

  /* ── 1 · LOS SEIS CONTEOS NO BAJAN ──────────────────────────────────────
     PISO MEDIDO EL 21 DE OCTUBRE DE 2026, con el texto todavía en su sitio
     de siempre. Es un trinquete ABSOLUTO y acá es legítimo (v965): la
     pregunta de esa regla es si el pendiente puede crecer sin que nadie haga
     nada mal, y esto no es un pendiente — es cuánto material publica el
     módulo, que solo baja si alguien lo quita.

     Y SI BAJA LEGÍTIMAMENTE —una entrada retirada, una afirmación que el
     autor saca—, el rojo es lo correcto: obliga a que esa decisión sea
     visible y a bajar el piso a mano, con su razón. Un piso que se
     actualizara solo no mediría nada (v903). */
  const PISO = { afirmaciones: 17, entradas: 324, contrargumentos: 50,
                 exenciones: 5, contradicciones: 15, casos: 14 };
  const nContra = (r) => (r.entradas || []).filter((e) => e.contrargumentoOficial).length;
  const nExEnt = (r) => (r.entradas || []).filter((e) => e._noEsCalificacion).length;
  const hoy = {
    afirmaciones: (ed.afirmaciones || []).length,
    entradas: (regA.entradas || []).length + (regB.entradas || []).length,
    contrargumentos: nContra(regA) + nContra(regB),
    exenciones: nExEnt(regA) + nExEnt(regB) +
      (ed.afirmaciones || []).filter((a2) => a2._noEsCalificacion).length +
      ['delitosAltoImpacto', 'subsidios'].filter((k) => (regA[k] || {})._noEsCalificacion).length,
    contradicciones: ((regA.contradicciones || {}).casos || []).length +
                     ((regB.contradicciones || {}).casos || []).length,
    casos: ((regA.casos || {}).lista || []).length + ((regB.casos || {}).lista || []).length
  };
  const bajaron = Object.keys(PISO).filter((k) => hoy[k] < PISO[k])
    .map((k) => k + ': ' + hoy[k] + ' < ' + PISO[k]);
  comprobar('ninguno de los seis conteos del módulo bajó de su piso',
    bajaron.length === 0,
    bajaron.length ? 'BAJÓ, y mover texto a una pestaña no puede bajar ninguno: ' + bajaron.join(' · ')
      : Object.keys(PISO).map((k) => k + ' ' + hoy[k] + (hoy[k] > PISO[k] ? ' (+' + (hoy[k] - PISO[k]) + ')' : ''))
        .join(' · ') + ' — piso medido el 21 de octubre de 2026, antes de las pestañas');

  /* ── 2 · NINGÚN TEXTO PUBLICADO QUEDA SIN SUPERFICIE ────────────────────
     Mide las claves del registro que llevan TEXTO LARGO y pregunta si alguna
     línea de `js/70` las nombra. Una clave que ningún consumidor lee es un
     texto que no llega a ningún lector.

     EL DISCRIMINANTE, medido y no elegido: de 77 claves con texto largo, 15
     no las nombra nadie, y la mayoría son NOTAS INTERNAS con guion bajo
     —`_comentario`, `_notaAnclaje`, `_notaMenores`—, que la v1115 ya vigila
     con su propia guarda y su `?`. Perseguirlas acá sería contarlas dos
     veces. Así que esta mira las claves SIN guion bajo, que son las que el
     módulo publica.

     Y LO QUE TODAVÍA NO SE PINTA VA DECLARADO POR ÍTEM, con su razón
     (v1094): los dos bloques de datos de la v1138 se registraron para
     graficarse en la v1141, así que su texto hoy no llega a nadie. Eso es un
     ESTADO —`_sinPintarTodavia`— y no un descuido: se cuenta aparte, se
     nombra, y el día que el bloque se pinte el campo se retira y su texto
     pasa a exigirse como el de todos.

     VA EN ROJO (v970): mide el registro contra el CÓDIGO servido, y el
     estado bueno es cero. No puede vaciarse por una mejora de los datos. */
  const cod = soloCodigo(leer('js/70-seguimiento.js'));
  /* `_sinPintarTodavia` se reconoce A CUALQUIER PROFUNDIDAD y no solo en los
     bloques de primer nivel: dos de los hallazgos de la primera corrida
     —`presupuesto.deudaBruta` y `publicacion.vetadasPorDefectoPropio`— viven
     dentro de bloques que SÍ se pintan, y exigirlos al bloque entero habría
     eximido de paso todo lo que ese bloque publica. */
  const sinPintar = [];
  const claves = {}, enBloqueSinPintar = {};
  (function w(o, r, exento) {
    if (typeof o === 'string') {
      if (o.length >= 40) {
        const k = r.split('.').pop().replace(/\[\]/g, '');
        if (k[0] === '_') return;
        if (exento) { enBloqueSinPintar[k] = (enBloqueSinPintar[k] || 0) + 1; return; }
        claves[k] = (claves[k] || 0) + 1;
      }
      return;
    }
    if (Array.isArray(o)) return o.forEach((x) => w(x, r + '[]', exento));
    if (o && typeof o === 'object') {
      const aqui = exento || !!o._sinPintarTodavia;
      if (!exento && o._sinPintarTodavia) sinPintar.push(r || '(raíz)');
      return Object.keys(o).forEach((k) => w(o[k], r ? r + '.' + k : k, aqui));
    }
  })(regA, '', false);

  const lee = (k) => new RegExp('\\.' + k + '\\b|[\'"]' + k + '[\'"]').test(cod);
  const huerfanas = Object.keys(claves).filter((k) => !lee(k));
  const nSinPintar = sinPintar.length;

  comprobar('MATERIAL · hay texto del registro que medir y código que lo lea',
    Object.keys(claves).length >= 40 && cod.length > 10000,
    Object.keys(claves).length + ' claves con texto largo · js/70 con ' + cod.length + ' car. de código');

  comprobar('ningún texto publicado del registro queda sin superficie que lo alcance',
    Object.keys(claves).length >= 40 && huerfanas.length === 0,
    huerfanas.length
      ? 'ninguna línea de js/70 nombra: ' + huerfanas.join(' · ') +
        ' — o se pinta, o el bloque declara `_sinPintarTodavia` con su razón'
      : Object.keys(claves).length + ' claves con texto largo y todas tienen quien las lea' +
        (nSinPintar
          ? ' · ' + nSinPintar + ' bloque(s) declarados SIN PINTAR todavía y contados aparte: ' +
            sinPintar.join(', ') + ', con ' +
            Object.keys(enBloqueSinPintar).length + ' claves de texto que hoy no alcanzan a nadie'
          : ' · ningún bloque declarado sin pintar') +
        '. No cubre las notas internas con guion bajo, que vigila la guarda de la v1115');
})();

console.log('\n  -- toda entrada apunta a una categoria declarada (v1141) --');
/* ══ NINGUNA ENTRADA APUNTA A UNA CATEGORÍA QUE SU REGISTRO NO DECLARA ══════
   `tseg` ya lo medía en el NAVEGADOR, y por eso el defecto estuvo publicado:
   las suites de navegador no corren en este contenedor —falta el motor— así
   que su rojo no llegaba a nadie antes de empujar. Cuatro entradas apuntaban
   a `seguridad` y a `politica`, que no estaban entre las 13 declaradas, y se
   publicaron en la v1137 y en la v1138 sin que ninguna comprobación estática
   lo dijera. Esta corre SIEMPRE, sin navegador y sin motor.

   LO QUE SE VE EN EL PAPEL cuando esto pasa, medido en la v1141 antes de
   arreglarlo: la ficha del hecho lee el identificador crudo en minúscula
   —«seguridad»— donde las demás leen «Corrupción y contratación»; los chips
   del muro pintan «•seguridad» con el punto del respaldo; y el filtro
   desplegable de la línea de tiempo NO las ofrece, porque se construye con
   `Object.keys(D.categorias)` mientras los chips cuentan sobre las entradas
   —dos codificaciones de una lista, clase B, ya separadas—, así que anunciaba
   «Todos los temas · 278» y sus opciones sumaban 274: cuatro entradas
   inalcanzables por esa ruta.

   LOS DOS REGISTROS, porque la misma vara mide a los dos (v1118): el del
   gobierno anterior trae sus propias categorías —Paz Total, Reformas— y su
   lista se lee de su propio archivo, no de la del vivo.

   VA EN ROJO y no con `?` (v970, v1026): su material son las ENTRADAS y la
   lista de CATEGORÍAS DECLARADAS, y arreglar el defecto no vacía ninguna de
   las dos. El estado bueno es cero huérfanas con el material intacto, así
   que esta guarda no puede quedarse sin nada que rechazar por una mejora.

   LA GUARDA DE LA GUARDA es el MATERIAL de arriba: la lista de válidas sale
   del propio archivo y nunca de una constante escrita acá, así que si alguien
   vaciara `categorias` —o la guarda dejara de leerla— el recuento se cae por
   debajo del piso y el MATERIAL sale en rojo antes que la comprobación. */
(function () {
  const REGS = [
    ['gobierno actual', 'assets/data/seguimiento-presidencial.json'],
    ['Petro', 'assets/data/seguimiento-petro.json']
  ];
  const huerfanas = [];
  let nEntradas = 0, nCats = 0;
  REGS.forEach(([quien, ruta]) => {
    const reg = JSON.parse(leer(ruta));
    const cats = Object.keys(reg.categorias || {});
    nCats += cats.length;
    (reg.entradas || []).forEach((e) => {
      nEntradas++;
      const quees = e.id || String(e.titulo || '(sin título)').slice(0, 44);
      const c = String(e.categoria || '').trim();
      /* Las dos causas se dicen aparte porque piden acciones distintas
         (v899): una entrada SIN categoría es un campo que falta, y una con
         categoría no declarada es una lista que hay que ampliar o un dato
         que hay que corregir. */
      if (!c) huerfanas.push(quien + ' · SIN categoría · ' + quees);
      else if (!cats.includes(c)) huerfanas.push(quien + ' · «' + c + '» no declarada · ' + quees);
    });
  });

  comprobar('MATERIAL · los dos registros traen entradas y su propia lista de categorías declaradas',
    nEntradas >= 50 && nCats >= 10,
    nEntradas + ' entradas · ' + nCats + ' categorías declaradas entre los dos registros');

  comprobar('ninguna entrada apunta a una categoría que su registro no declara',
    nEntradas >= 50 && nCats >= 10 && huerfanas.length === 0,
    huerfanas.length
      ? huerfanas.length + ' huérfana(s) — o se declara la categoría, o se corrige la entrada: ' +
        huerfanas.slice(0, 6).join('  |  ') + (huerfanas.length > 6 ? '  |  …' : '')
      : 'las ' + nEntradas + ' entradas de los dos registros caen en una de las ' + nCats +
        ' categorías que esos mismos archivos declaran. No cubre que la categoría sea la ACERTADA ' +
        '—eso lo decide quien escribe la entrada— ni exige que toda categoría declarada se use: ' +
        'una categoría sin entradas no es un defecto, solo no se pinta');
})();

console.log('\n  -- el contraste de las paletas propuestas (v1138) --');
/* ══ NINGÚN PAR TEXTO/FONDO DE UNA PALETA BAJA DE 4,5:1 ═════════════════════
   Medido sobre la página compuesta antes de escribirla: la portada tenía
   **17 pares por debajo del mínimo**, y el peor era 1,09:1 —tinta casi
   blanca sobre un fondo casi blanco— en el cuadro «Un hecho que este módulo
   registra y que NO fija peldaño». La causa no era un color mal elegido: era
   una superficie CLARA pintada dentro de una tarjeta OSCURA, heredando su
   tinta. Por eso la cura va en los tokens y no caja por caja.

   QUÉ MIDE ESTA GUARDA, y qué no. Mide los PARES DECLARADOS en cada paleta
   candidata: cada tinta contra cada superficie sobre la que esa paleta dice
   que se lee. Es una comprobación estática y no sustituye al barrido del
   navegador —que recorre los 140 pares REALES de la página compuesta y es el
   que encontró el 1,09—: lo que esta impide es que una paleta se escriba o se
   edite con un par que ya nace por debajo del mínimo.

   ESTÁ PARAMETRIZADA: corre sobre las tres candidatas, y el día que se elija
   una basta con que su archivo se quede. `--paleta A` limita la corrida a
   una sola.

   VA EN ROJO Y NO CON `?` (v970, v1026): mide archivos de estilo del
   repositorio, no material del registro, así que no puede vaciarse por una
   mejora de los datos. Su material es que existan las paletas.

   DE QUÉ NO RESPONDE (v945): de los colores escritos a mano DENTRO de
   `css/70-seguimiento.css`, que no son de la paleta y solo se ven componiendo
   la página —son los doce que la C todavía arrastra—; ni del objetivo de 7:1
   para el cuerpo, que se declara aparte y se mide en el navegador. */
(() => {
  /* LA PALETA APLICADA VA PRIMERO, y las candidatas solo si quedan. Hasta la
     v1138 esta guarda medía únicamente `css/paletas-propuestas/`; al elegir
     la «Papel» esa carpeta se retiró, y una guarda que solo mira candidatas
     se habría quedado SIN MATERIAL justo cuando empezó a haber una paleta de
     verdad que proteger — en verde, o en rojo, sobre nada. Ahora mide la que
     está en pie y las que estén a prueba. */
  const DIR = 'css/paletas-propuestas';
  const soloUna = (process.argv.find((x) => x.startsWith('--paleta=')) || '').split('=')[1] || '';
  const archivos = [];
  if (!soloUna || soloUna === 'aplicada') archivos.push(['APLICADA', 'css/70-seguimiento.css']);
  if (fs.existsSync(R(DIR))) {
    fs.readdirSync(R(DIR)).filter((f) => /^[A-Z]\.css$/.test(f))
      .filter((f) => !soloUna || f === soloUna + '.css')
      .forEach((f) => archivos.push([f.replace('.css', ''), DIR + '/' + f]));
  }

  comprobar('MATERIAL · hay una paleta aplicada que medir',
    archivos.length > 0 && archivos.some((x) => x[0] === 'APLICADA'),
    !archivos.length ? 'no hay ninguna paleta que medir'
      : archivos.map((x) => x[0]).join(' · ') +
        (soloUna ? ' (limitado con --paleta=' + soloUna + ')' : ''));

  const hex = (c) => {
    const m = String(c).trim().match(/^#([0-9a-fA-F]{6})$/);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a2, b2) => { const x = L(a2), y = L(b2);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  /* Qué se lee sobre qué, declarado y no adivinado: las tintas son `tx`,
     `tx2` y el acento como texto; las superficies, las tres del tema. Los
     cinco peldaños se miden contra SU PROPIA tinta, que cada uno declara. */
  const TINTAS = ['--sp-tx', '--sp-tx2', '--sp-ac-tx'];
  const FONDOS = ['--sp-s1', '--sp-s2', '--sp-s3'];
  const malos = [], medidos = [];
  /* ── DOS UMBRALES, NO UNO (v1145) ────────────────────────────────────────
     Un TEXTO sobre un fondo pide 4,5:1. Una FIGURA —una barra, una línea, un
     punto— solo tiene que separarse del papel, y la norma pide 3:1: exigirle
     4,5 dejaría fuera cualquier color vivo y empujaría a una paleta apagada,
     que es justo lo que había que arreglar.

     Los dos se miden, y cada par dice con cuál se mide. Un par de figura que
     ADEMÁS lleve texto encima se mide con los dos, y por eso los tonos
     declaran su tinta: el azul vivo contra blanco da 3,68:1 y contra la tinta
     casi negra 5,16:1, así que el rótulo interior va en la segunda. */
  const figuras = [];
  const parFigura = (kFig, kFondo, nombre, tok, hexf, ratiof) => {
    const f = hexf(tok[kFig]), b3 = hexf(tok[kFondo]);
    if (!f || !b3) return;
    const r = ratiof(f, b3);
    figuras.push({ nombre, k: kFig, r });
    if (r < 3) malos.push(nombre + ' · FIGURA ' + kFig + ' sobre ' + kFondo + ' = ' + r.toFixed(2) + ':1 (mínimo 3)');
  };
  archivos.forEach(([nombre, ruta]) => {
    const css = leer(ruta);
    const tok = {};
    [...css.matchAll(/(--sp-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)]
      .forEach((m) => { if (!(m[1] in tok)) tok[m[1]] = m[2]; });
    const par = (kt, kf) => {
      const t = hex(tok[kt]), b2 = hex(tok[kf]);
      if (!t || !b2) return;
      const r = ratio(t, b2);
      medidos.push(1);
      if (r < 4.5) malos.push(nombre + ' · ' + kt + ' sobre ' + kf + ' = ' + r.toFixed(2) + ':1');
    };
    TINTAS.forEach((t) => FONDOS.forEach((b2) => par(t, b2)));
    for (let i = 1; i <= 5; i++) par('--sp-n' + i + '-tx', '--sp-n' + i);
    /* La paleta de FIABILIDAD de la escala del veredicto (v1144), con sus
       DOS estados: el pleno —que es el que pinta el tope y el que sigue
       posible— y el tenue del descartado. Los dos se miden, porque los dos
       llevan texto encima: medir solo el pleno dejaría el tenue sin
       comprobar, y es justo el que la tanda estuvo a punto de publicar con
       la tinta apagada a 4,47:1. */
    for (let i = 1; i <= 5; i++) {
      par('--sp-fi' + i + '-tx', '--sp-fi' + i);
      par('--sp-fi-te-tx', '--sp-fi' + i + '-te');
    }
    /* Los TONOS de figura (v1145): cada uno con sus DOS medidas —la figura
       contra el papel del sitio, y su rótulo interior contra la figura—. */
    ['fav', 'adv', 'neu', 'neu2'].forEach((t) => {
      par('--sp-tono-' + t + '-tx', '--sp-tono-' + t);          // el rótulo, 4,5:1
      parFigura('--sp-tono-' + t, '--sp-s1', nombre, tok, hex, ratio);  // la figura, 3:1
    });
  });

  /* EL MARGEN MÁS JUSTO, DICHO Y NO ESCONDIDO. El azul favorable está en
     3,47:1 contra marfil: pasa el umbral de figura por cuatro décimas, y es
     el borde de lo que se puede aclarar. Queda anotado acá y no en un
     comentario suelto, porque es el dato que la próxima tanda necesita antes
     de tocar ese color: **no se puede aclarar más**. Medido: desde #3D9BE9 la
     figura cae por debajo de 3:1 y el azul deja de separarse del papel. */
  {
    const flojo = figuras.slice().sort((a2, b2) => a2.r - b2.r)[0];
    comprobar('y toda FIGURA se separa del papel al menos 3:1, con su margen más justo dicho',
      figuras.length >= 4 && figuras.every((f) => f.r >= 3),
      figuras.length < 4 ? 'solo ' + figuras.length + ' figuras medidas: faltan tonos por declarar'
        : figuras.some((f) => f.r < 3)
          ? 'por debajo de 3:1: ' + figuras.filter((f) => f.r < 3)
              .map((f) => f.k + ' = ' + f.r.toFixed(2)).join(' · ')
          : figuras.length + ' figuras medidas · la más justa es ' + flojo.k + ' con ' +
            flojo.r.toFixed(2) + ':1 — pasa por poco y NO se puede aclarar más: desde #3D9BE9 ' +
            'el azul cae por debajo de 3:1 y deja de separarse del marfil');
  }

  comprobar('ningún par declarado de una paleta baja de 4,5:1',
    archivos.length > 0 && medidos.length >= 12 && malos.length === 0,
    !archivos.length ? 'sin paletas que medir'
      : medidos.length < 12 ? 'solo ' + medidos.length + ' pares medidos: una paleta dejó tokens sin declarar ' +
        'y los pares que faltan no se comprueban, que se lee igual que si pasaran'
      : malos.length ? 'por debajo del mínimo: ' + malos.join(' · ')
      : medidos.length + ' pares de ' + archivos.length + ' paleta(s) —' +
        archivos.map((x) => x[0]).join(', ') + '—, todos en 4,5:1 o más. ' +
        'No cubre los colores escritos a mano dentro de css/70-seguimiento.css, que solo se ven ' +
        'componiendo la página en el navegador');
})();

console.log('\n  -- ningun menor identificado en el registro (v1136) --');
/* ══ NI UN NOMBRE DE MENOR EN EL REGISTRO ═══════════════════════════════════
   Lo que la pagó: una víctima menor de edad estaba NOMBRADA con nombre
   completo en dos campos —el `detalle` de una entrada y el título de una de
   sus fuentes—, y el cribado de la v1116 no la vio porque exigía una EDAD en
   la misma oración y ahí decía «una estudiante». Treinta y nueve oraciones
   marcadas, treinta y nueve falsas, y la que importaba fuera del barrido.

   EL CRIBADO AMPLIO no pide edad: pide una palabra que nombre a un menor
   —estudiante, niña, niño, joven, adolescente, menor, reclutada, asesinada y
   las demás— con un NOMBRE PROPIO en la misma oración. Medido al escribirlo:
   51 coincidencias brutas, 14 tras descontar instituciones, lugares y alias,
   y 2 reales — las dos, la misma persona.

   LAS DOCE QUE NO SON, Y POR QUÉ NO SE AUTOMATIZAN: son adultos con cargo
   —dos ministros, un alcalde, dos magistradas, un experto— junto a una
   palabra del contexto. Distinguir «ministro» de «víctima» por código daría
   la lista de excepciones que envejece (v895, v1116), así que lo que se
   descuenta es lo comprobable —el nombre de una institución, de un lugar o de
   un alias— y lo que queda se LEE. La lista de descartes va acá, con su
   razón, y cada entrada nueva que caiga se mira a mano.

   VA EN ROJO Y NO CON `?` (v970): su material no son los datos sino la lista
   de descartes y el propio cribado, y el estado BUENO es cero coincidencias.
   Un `?` acá diría «no hay nada que mirar» el día que alguien borre el
   cribado.

   DE QUÉ NO RESPONDE (v945): de un menor identificado sin nombre propio —por
   su colegio, su barrio y su edad juntos, por ejemplo—, que este cribado no
   ve; y de las URL de las fuentes, donde el nombre puede ir en el `slug` y
   retirarlo rompería el enlace. */
(() => {
  const CTX = /\b(estudiante|colegial|escolar|ni[ñn]a|ni[ñn]o|ni[ñn]os|ni[ñn]as|joven|j[óo]venes|adolescent\w*|menor|menores|beb[ée]|infante|reclutad\w*|asesinad\w*|secuestrad\w*|abusad\w*|v[íi]ctima)\b/i;
  const NOM = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){1,2})\b/g;
  /* NO es una lista de excepciones de CASOS: son clases de cosa que no son una
     persona —institución, lugar, medio, alias, norma—, más los adultos con
     cargo público que el registro nombra, cada uno con su razón de una línea. */
  const NO_ES_MENOR = [
    [/^(Corte|Fiscal|Procuradur|Contralor|Ministerio|Polic|Ej[ée]rcito|Armada|Fuerza|Instituto|Medicina|Consejo|Sala|Casaci|Congreso|C[áa]mara|Senado|Gobierno|Presidencia|Naciones|Estados|Banco|Departamento|Agencia|Comisi|Unidad|Direcci|Alcald|Gobernaci|Secretar|Universidad|Defensor|Nacional|Tribunal|Rama|Human |Observatorio|Bloque|Operaci|Subestructura|Estructura|Comandos|Autodefensas|Clan|Frente|Batall)/, 'institución u organización'],
    [/^(Nueva|Norte|Sur|Villa|Barrio|Calle|Avenida|Parque|Puerto|R[íi]o|Sierra|Catatumbo|Guaviare|Cauca|Antioquia|Bogot|Medell|Cali|Barranquilla|Cartagena|Bucaramanga|C[úu]cuta|Tib[úu]|Riohacha|Sincelejo|Miraflores|G[óo]mez Plata|Costa Rica|La Guajira|San |Santa |El |La |Los |Las )/, 'lugar'],
    [/^(Seg[úu]n|Revista|Semana|Infobae|Blu|Caracol|RCN|Noticias|Radio|El Tiempo|El Espectador|La Naci|Presidente)/, 'medio o muletilla de cita'],
    [/^(Decreto|Ley|Resoluci|Sentencia|Protocolo|Principios|Derecho|Acuerdo|Tratado|Programa|Plan|Reclusi|Alimentaci)/, 'norma o programa'],
    [/^(Bendito|Na[íi]n|Iv[áa]n Mordisco|Carolina Ram|Juan Carlos)/, 'alias o cabecilla, no un menor'],
    [/^(Yahir Acu[ñn]a|Javier Rinc[óo]n|Jorge Eduardo Mora|Jorge Mora|Indalecio Dangond|Andr[ée]s Barreto|Ana Mar[íi]a Saavedra|Diana Fajardo|Jos[ée] Fernando Reyes|Rosa Ang[ée]lica Tarazona|Nova Soporte|Iv[áa]n Cepeda)/, 'persona adulta con cargo o parte del hecho, leída una por una']
  ];
  const descarta = (x) => NO_ES_MENOR.some(([re]) => re.test(x));

  const hallados = [];
  let oraciones = 0;
  ['assets/data/seguimiento-presidencial.json', 'assets/data/seguimiento-petro.json'].forEach((arch) => {
    const d = JSON.parse(leer(arch));
    const campos = [];
    (function w(o, r) {
      if (typeof o === 'string') { campos.push([r, o]); return; }
      if (Array.isArray(o)) return o.forEach((x, i) => w(x, r + '[]'));
      if (o && typeof o === 'object') return Object.keys(o).forEach((k) => w(o[k], r ? r + '.' + k : k));
    })(d, '');
    campos.forEach(([r, s2]) => {
      /* Las URL quedan fuera a propósito: el nombre puede ir en el `slug` y
         tocarlo rompe el enlace, que es la prueba. */
      if (/fuentes\[\]\.u$/.test(r)) return;
      s2.split(/(?<=[.;:])\s+/).forEach((or) => {
        if (!CTX.test(or)) return;
        oraciones++;
        let m; NOM.lastIndex = 0; const vistos = {};
        while ((m = NOM.exec(or))) {
          const x = m[1];
          if (vistos[x] || descarta(x)) continue;
          vistos[x] = 1;
          hallados.push(arch.split('/').pop().replace('seguimiento-', '') + ' · ' + r + ' · «' + x + '»');
        }
      });
    });
  });

  comprobar('MATERIAL · el cribado amplio recorre las oraciones que hablan de menores',
    oraciones >= 50, oraciones + ' oraciones con una palabra que nombra a un menor, en los dos registros');

  comprobar('ningún menor queda identificado con nombre propio en el registro',
    oraciones >= 50 && hallados.length === 0,
    hallados.length
      ? 'nombre propio junto a una palabra de menor: ' + hallados.join(' · ') +
        ' — si es una víctima menor de edad, se retira el nombre y se deja la nota; si es un adulto o una ' +
        'institución, entra en la lista de descartes CON su razón'
      : 'cero en ' + oraciones + ' oraciones, con ' + NO_ES_MENOR.length + ' clases de descarte declaradas ' +
        '—institución, lugar, medio, norma, alias y adulto con cargo—. No cubre a un menor identificado sin ' +
        'nombre propio, ni las URL de las fuentes, donde el nombre puede ir en el slug y retirarlo rompería ' +
        'el enlace');

  /* LA GUARDA DE LA GUARDA (v878): que la cita abreviada DIGA que lo está. Un
     título de fuente recortado en silencio es una cita alterada; con su marca
     y su nota, es una abreviatura declarada. */
  const regM = JSON.parse(leer('assets/data/seguimiento-presidencial.json'));
  const conNota = (regM.entradas || []).filter((e) => e._notaMenores);
  /* Se cuentan las CITAS marcadas y no las apariciones del texto: la propia
     nota lo menciona al explicarse, y contarla inflaría el número publicado
     (v1054 — una cifra del registro no se concatena en crudo). */
  let marcadas = 0;
  (regM.entradas || []).forEach((e) => (e.fuentes || []).forEach((f) => {
    if (String(f.n || '').indexOf('[nombre omitido]') >= 0) marcadas++;
  }));
  comprobar('y toda cita abreviada por esta regla lo declara, con su marca y su nota',
    marcadas === 0 ? conNota.length === 0 : conNota.length > 0,
    marcadas === 0 && !conNota.length ? 'ninguna cita abreviada y ninguna nota: nada que declarar'
      : marcadas && conNota.length ? marcadas + ' cita(s) marcadas con «[nombre omitido]» y ' +
        conNota.length + ' entrada(s) con su `_notaMenores`, que dice por qué se abrevió y que el enlace sigue intacto'
      : marcadas ? 'hay ' + marcadas + ' cita(s) abreviadas y ninguna entrada lo declara: una cita recortada en ' +
        'silencio es una cita alterada'
      : 'hay nota de abreviatura y ninguna cita marcada: la nota sobró o la marca se perdió');
})();

console.log('\n  -- la tarjeta del enlace, que es la unica superficie que viaja sola (v1136) --');
/* ══ TODA PÁGINA PUBLICADA LLEVA SU TARJETA ════════════════════════════════
   Medido antes de escribirla: las CINCO páginas tenían 0 etiquetas Open
   Graph, así que un enlace pegado en WhatsApp salía sin miniatura y cuatro de
   cinco sin descripción.

   POR QUÉ NECESITA GUARDA, que es lo que no se ve: estas etiquetas **no se
   notan desde el sitio**. Nadie las ve navegando, no hay pantalla que las
   enseñe y romperlas no rompe nada — es la clase C de CLAUDE.md aplicada a lo
   que el sitio dice de sí mismo cuando lo comparten. Sin esto, la primera
   edición de un <head> se las lleva y nos enteramos por una captura.

   TRES COSAS QUE SE MIDEN Y NO UNA:
   · que las cinco llevan las cinco etiquetas pedidas;
   · que las URL son ABSOLUTAS — quien arma la tarjeta no es el navegador que
     está en la página, es un servidor que trae el HTML suelto, y una ruta
     relativa ahí no resuelve;
   · que la imagen EXISTE en el disco y mide 1200×630, porque una etiqueta que
     apunta a un archivo que no está se lee igual que no tenerla.

   DE QUÉ NO RESPONDE (v945): de que la descripción sea buena, ni de que la
   tarjeta se vea bien en cada aplicación —eso pide pegar el enlace, y este
   contenedor no tiene red—. */
(() => {
  const PAGS = ['index.html', 'seguimiento.html', 'analisis-ia.html',
                'vision-territorial.html', 'reportes.html'];
  const PIDE = ['og:title', 'og:description', 'og:url', 'og:image'];
  comprobar('MATERIAL · se leen las cinco páginas publicadas',
    PAGS.every((f) => fs.existsSync(R(f))), PAGS.join(' · '));

  const sinEtiqueta = [], relativas = [];
  PAGS.forEach((f) => {
    const h = leer(f);
    PIDE.forEach((e) => { if (!new RegExp('property="' + e + '"').test(h)) sinEtiqueta.push(f + ' → ' + e); });
    if (!/name="twitter:card"\s+content="summary_large_image"/.test(h)) sinEtiqueta.push(f + ' → twitter:card');
    [...h.matchAll(/property="og:(url|image)"\s+content="([^"]*)"/g)]
      .forEach((m) => { if (!/^https:\/\/urbispro\.city\//.test(m[2])) relativas.push(f + ' → og:' + m[1] + ' = ' + m[2]); });
  });
  comprobar('las cinco páginas llevan su tarjeta, con URL absolutas de urbispro.city',
    sinEtiqueta.length === 0 && relativas.length === 0,
    sinEtiqueta.length ? 'sin etiqueta: ' + sinEtiqueta.join(' · ')
      : relativas.length ? 'URL que no es absoluta de urbispro.city: ' + relativas.join(' · ') +
        ' — quien arma la tarjeta trae el HTML suelto y no puede resolverla'
      : 'las ' + PAGS.length + ' con ' + (PIDE.length + 1) + ' etiquetas cada una, y sus URL absolutas');

  /* LA GUARDA DE LA GUARDA (v878): que la imagen que las cinco nombran EXISTA
     y tenga la medida que declaran. Se leen los dos enteros del encabezado
     IHDR del PNG, que es donde viven el ancho y el alto. */
  const rel = (leer('seguimiento.html').match(/property="og:image"\s+content="https:\/\/urbispro\.city\/([^"]+)"/) || [])[1];
  let w = 0, h2 = 0, hay = false;
  if (rel && fs.existsSync(R(rel))) {
    const b = fs.readFileSync(R(rel)); hay = true;
    w = b.readUInt32BE(16); h2 = b.readUInt32BE(20);
  }
  comprobar('y la imagen que nombran está en el disco y mide 1200×630',
    hay && w === 1200 && h2 === 630,
    !rel ? 'ninguna página declara og:image: no hay imagen que comprobar'
      : !hay ? 'la etiqueta apunta a ' + rel + ' y ese archivo no está: se lee igual que no tener tarjeta'
      : (w === 1200 && h2 === 630) ? rel + ' · ' + w + '×' + h2
      : rel + ' mide ' + w + '×' + h2 + ' y declara 1200×630');
})();

console.log('\n  -- las fechas de calendario se anclan a Colombia (v1135) --');
/* ══ NINGUNA FECHA DE CALENDARIO SE SERIALIZA EN UTC ════════════════════════
   `toISOString().slice(0, 10)` da la fecha en UTC, y URBIS se lee en Colombia
   (UTC−5, sin horario de verano). Entre las 19:00 y la medianoche de acá eso
   daba MAÑANA: cinco horas al día en que una fecha publicada iba un día
   adelantada para su único público. Medido el 21 de octubre de 2026: quince
   sitios en siete archivos servidos.

   LA GUARDA ES REPO-ANCHA sobre `js/` y va en ROJO, no con `?` (v970, v1026):
   mide CÓDIGO servido y no material del registro, así que no puede vaciarse
   por una mejora de los datos. Su material es que haya archivos que leer.

   LA EXENCIÓN VA POR ÍTEM, CON SU ARCHIVO Y SU RAZÓN, y nunca por regla
   (v1094, v1109, v1127). Una regla del tipo «no cuentan las que hablan con
   una API» eximiría a todas las futuras de una vez; una razón hay que
   pensarla una por una, y por eso el panel la NOMBRA en vez de contarla.

   DE QUÉ NO RESPONDE (v945): de `toISOString()` entero, que es un INSTANTE y
   no una fecha de calendario —ahí UTC es lo correcto y hay decenas—; de las
   suites de `pruebas/`; y de que la razón de la exención sea cierta, que no
   lo puede comprobar nadie (v1008). */
(() => {
  const EXENTOS = [{
    archivo: 'js/61-analisis-ia-datos.js',
    linea: 'const iso = d => d.toISOString().slice(0, 10);',
    razon: 'esas dos fechas no las lee nadie: viajan como `start_date` y `end_date` al archivo ' +
           'histórico de Open-Meteo, que trabaja en UTC. Anclarlas a Colombia correría el rango un ' +
           'día y podría pedirle al archivo una fecha que todavía no publicó'
  }];

  const PAT = /toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/;
  const archivos = fs.readdirSync(R('js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
  comprobar('MATERIAL · se leen los archivos servidos de js/', archivos.length > 40,
    archivos.length + ' archivos de js/ barridos');

  const conUTC = [];
  archivos.forEach((f) => {
    /* Sobre el CÓDIGO y no sobre los comentarios (v926): los tres bloques que
       explican esta decisión citan el patrón, y un patrón citado en su propia
       explicación no es una llamada. */
    const cod = soloCodigo(leer(f));
    cod.split('\n').forEach((ln, i) => { if (PAT.test(ln)) conUTC.push({ archivo: f, n: i + 1, ln: ln.trim() }); });
  });
  const exentoDe = (x) => EXENTOS.some((e) => e.archivo === x.archivo && x.ln.indexOf(e.linea) >= 0);
  const sobran = conUTC.filter((x) => !exentoDe(x));
  const exentosVistos = conUTC.filter(exentoDe);

  comprobar('ninguna fecha de calendario se serializa en UTC, salvo las eximidas una por una',
    archivos.length > 40 && sobran.length === 0,
    sobran.length
      ? 'quedan ' + sobran.length + ' sin anclar a Colombia: ' +
        sobran.map((x) => x.archivo + ':' + x.n).join(' · ') +
        ' — se anclan con `URBIS_FECHA.hoyCO()` si calculan HOY, o se componen con ' +
        '`URBIS_FECHA.isoLocal(d)` si convierten una fecha que ya existe'
      : 'ninguna en ' + archivos.length + ' archivos de js/, y ' +
        (exentosVistos.length
          ? exentosVistos.length + ' eximida' + (exentosVistos.length === 1 ? '' : 's') + ' con su razón: ' +
            exentosVistos.map((x) => {
              const e = EXENTOS.filter((y) => y.archivo === x.archivo)[0];
              return x.archivo + ':' + x.n + ' — ' + e.razon;
            }).join(' · ')
          : 'ninguna exención en pie'));

  /* LA GUARDA DE LA GUARDA (v878), en dos mitades. La primera: una exención
     escrita acá cuyo sitio ya no exista es una excepción que envejece, y
     quedaría tapando lo que entre en su lugar (v895). */
  const huerfanas = EXENTOS.filter((e) => !conUTC.some((x) => x.archivo === e.archivo && x.ln.indexOf(e.linea) >= 0));
  comprobar('y ninguna exención escrita se quedó sin su sitio',
    EXENTOS.length > 0 && huerfanas.length === 0,
    !EXENTOS.length ? 'no hay exenciones: nada que envejecer'
      : huerfanas.length ? 'sobra' + (huerfanas.length === 1 ? '' : 'n') + ': ' +
        huerfanas.map((e) => e.archivo).join(' · ') + ' — el sitio ya no está y la exención taparía al que entre después'
      : (EXENTOS.length === 1 ? 'la única exención apunta' : 'las ' + EXENTOS.length + ' exenciones apuntan') +
        ' a un sitio que existe, y su razón va escrita también donde vive el código');

  /* La segunda: `js/70-seguimiento.js` se sirve SOLO, así que no alcanza el
     `window.URBIS_FECHA` de `js/00-config.js` y lleva su propia copia. Son dos
     codificaciones de una decisión (clase B) y lo que impide que se separen es
     atarlas: se comparan los dos cuerpos, normalizados. */
  const cuerpo = (txt, nom) => {
    const i = txt.indexOf(nom);
    if (i < 0) return '';
    /* El cierre va con una sangría en `js/70` —vive dentro del módulo— y sin
       ella en `js/00-config.js`, donde es un global. Se toma el primero de
       los dos que aparezca: buscar solo uno cortaba el objeto de config por
       un `};` posterior y los cuerpos salían distintos sin estarlo. */
    const a1 = txt.indexOf('\n  };', i), a2 = txt.indexOf('\n};', i);
    const fin = a1 < 0 ? a2 : (a2 < 0 ? a1 : Math.min(a1, a2));
    if (fin < 0) return '';
    return soloCodigo(txt.slice(i, fin))
      .replace(/window\.URBIS_FECHA/g, 'FECHA_CO').replace(/\s+/g, ' ').trim();
  };
  const cCfg = cuerpo(leer('js/00-config.js'), 'window.URBIS_FECHA = {');
  const c70 = cuerpo(leer('js/70-seguimiento.js'), 'var FECHA_CO = {');
  comprobar('y las dos copias del ancla —la compartida y la del módulo presidencial— dicen lo mismo',
    !!cCfg && !!c70 && cCfg.slice(cCfg.indexOf('hoyCO')) === c70.slice(c70.indexOf('hoyCO')),
    !cCfg || !c70 ? 'no se encontró una de las dos: ' + (cCfg ? 'falta la de js/70' : 'falta la de js/00-config')
      : cCfg.slice(cCfg.indexOf('hoyCO')) === c70.slice(c70.indexOf('hoyCO'))
        ? 'idénticas: `seguimiento.html` carga solo su módulo, así que la copia es inevitable y queda atada'
        : 'se separaron: una de las dos cambió y la otra no, que es como la clase B se cobra siempre');

  /* Y LA RUTINA DIARIA, que es la que SELLA `actualizado`: si ella sigue
     sacando la fecha en UTC, el registro queda un día adelante aunque el
     módulo lea bien. Es la mitad que no está en el código servido. */
  const rut = fs.existsSync(R('herramientas/rutina-seguimiento-presidencial.md'))
    ? leer('herramientas/rutina-seguimiento-presidencial.md') : '';
  comprobar('y la rutina diaria sella `actualizado` en hora de Colombia, no en UTC',
    !!rut && /HORA DE COLOMBIA/.test(rut) && /TZ=America\/Bogota/.test(rut),
    !rut ? 'no está el texto de la rutina: no se puede comprobar con qué vara sella'
      : !/TZ=America\/Bogota/.test(rut)
        ? 'no dice cómo sacar la fecha de Colombia: corriendo de noche sellaría el día siguiente'
        : 'lo dice en el paso 5, con la orden exacta para sacarla');
})();

/* Las dos cuentas van APARTE porque piden cosas distintas: una fallada hay
   que arreglarla, una sin material hay que mirarla —o se quedó sin él porque
   el registro mejoró, o porque la función dejó de ver lo que medía—. Sumarlas
   mandaría a revisar lo que está bien. */
console.log('\n  ' + (fallos ? fallos + ' comprobaciones fallaron' : 'todas las comprobaciones pasaron') +
  (sinMaterial ? ' · ' + sinMaterial + (sinMaterial === 1 ? ' se quedó sin material' : ' se quedaron sin material') : '') + '\n');
process.exit(fallos ? 1 : 0);
