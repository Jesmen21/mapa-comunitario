/* URBIS · EL TRABAJO DEL CURSO, GUARDADO EN EL SERVIDOR (js/81)
   ─────────────────────────────────────────────────────────────────────────
   Hasta la v817, lo que un grupo escribía en el modo educativo —la lectura
   de cada bloque y la conclusión— vivía SOLO en `localStorage` del teléfono
   que lo escribió. Cinco teléfonos eran cinco memorias separadas, y el
   profesor no veía ninguna: para calificar había que pedirle a cada grupo
   que abriera su informe y lo enseñara. Un trabajo de curso que no se puede
   recoger no es un trabajo de curso.

   Esto lo recoge. El grupo escribe un nombre de curso una vez, y desde ahí
   puede ENTREGAR: su lectura y sus cifras viajan al mismo servidor donde
   viven los reportes, y cualquiera que sepa el nombre del curso —el
   profesor, el grupo de al lado— las abre desde un solo sitio.

   ── Por qué la fila es un «comentario» ──────────────────────────────────
   La entrega va a la hoja de siempre, con `tipo` = «comentario de curso …».
   No es un capricho de nombre: el servidor (Apps Script) trata cualquier
   fila cuyo tipo contenga «comentario» como TEXTO DE ALGUIEN, y a esas les
   aplica exactamente la regla que esta función necesita y que no existe
   para ninguna otra: la edita quien la escribió, demostrado con el token de
   sesión, comparando el campo 0 de la descripción con el usuario firmado.
   Cualquier otro tipo caería en la rama de reportes, donde la autoría se
   busca en el campo 43 de un formato «a | b | c» que una entrega no tiene,
   y el servidor la rechazaría. Y una entrega ES el texto de alguien.

   Eso también deja fuera del mapa a estas filas: «comentario» está en la
   lista de `esFilaMetaUrbis` (js/05), así que ni se pintan ni entran en los
   análisis. Una entrega no es un punto del sector.

   ── El formato de la descripción ────────────────────────────────────────
       usuario ~~~ curso ~~~ (vacío) ~~~ título ~~~ carga

   · campo 0 · el autor. Es lo que el servidor mira para dejar reescribir.
   · campo 1 · el curso, en minúsculas y sin tildes: la llave de búsqueda.
   · campo 2 · VACÍO A PROPÓSITO. Es el único campo que el servidor deja
               cambiar a quien no es el autor —ahí es donde se denuncia un
               comentario ajeno—, así que no puede llevar nada de la
               entrega. Dejarlo vacío es lo que hace que el resto sea
               inmodificable por un tercero.
   · campo 3 · el título legible del sector, para poder listar sin decodificar.
   · campo 4 · la carga: el JSON de la entrega en base64.

   La carga va en base64 y no en JSON crudo por tres razones concretas, las
   tres cosas que le pasan a un texto libre en esta tubería: el `~~~` que un
   estudiante puede escribir partiría los campos; el « | » que el servidor
   usa para localizar el correo del autor en los reportes lo haría cortar
   por donde no es; y el limpiador de datos personales borra del texto
   cualquier cosa con forma de correo. En base64 no hay `~`, ni `|`, ni `@`.

   ── Lo que esto NO es ───────────────────────────────────────────────────
   El nombre del curso es la única llave. Quien lo sepa, lee lo entregado.
   Es un tablón de clase, no una caja fuerte, y la interfaz lo dice con esas
   palabras: prometer privacidad que no hay sería peor que no tenerla.   */
(function () {
  'use strict';

  var CLAVE_CURSO = 'edu_curso_v1';
  var PREFIJO = 'comentario de curso ';
  /* Una celda de Google Sheets admite 50 000 caracteres. El tope se deja por
     debajo para que quepan los cuatro campos de cabecera y sobre margen: una
     entrega que el servidor recorta a la mitad se pierde en silencio, y
     perder en silencio lo que un grupo escribió es lo que vinimos a
     arreglar. Por eso, pasado el tope, se avisa y NO se envía. */
  var TOPE_CARGA = 45000;

  /* Dependencias por nombre, para poder probar el módulo sin la aplicación
     entera. En producción todas salen de `window`. */
  var dep = {
    ahora: function () { return Date.now(); },
    usuario: function () { return (window.urbisUsuarioActual && window.urbisUsuarioActual()) || ''; },
    haySesion: function () {
      try {
        var s = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null;
        return !!(s && s.session_token);
      } catch (e) { return false; }
    },
    actualizar: function (tipo, campos) { return window.urbisDBUpdate('tipo', tipo, campos); },
    crear: function (fila) { return window.urbisGuardarFila(fila); },
    leerTodo: function () { return window.urbisDBRead ? window.urbisDBRead({ forzar: true }) : Promise.resolve([]); },
    guardar: function (v) { try { localStorage.setItem(CLAVE_CURSO, String(v || '')); } catch (e) {} },
    cargar: function () { try { return localStorage.getItem(CLAVE_CURSO) || ''; } catch (e) { return ''; } }
  };
  function configurar(d) { Object.keys(d || {}).forEach(function (k) { dep[k] = d[k]; }); }

  // ── Normalizar y firmar ───────────────────────────────────────────────
  function sinTildes(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  /* La llave del curso. Dos grupos que escriben «Taller 5B» y «taller 5b»
     son el mismo curso: si no lo fueran, el profesor tendría que adivinar
     con qué mayúsculas lo escribió cada uno. */
  function normCurso(s) {
    return sinTildes(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }
  /* El nombre del autor, normalizado EXACTAMENTE como lo hace el servidor.
     No es una copia por comodidad: es la firma con la que el Apps Script
     decide si esta entrega es tuya, comparando el campo 0 de la descripción
     contra el usuario de la sesión. Su `normUser_` NO quita las tildes, las
     BORRA —«Peña» queda en «pea», no en «pena»—, porque la ñ y las vocales
     acentuadas no están en su lista de caracteres permitidos. Quitarlas
     «bien» acá produciría una firma que no coincide con la suya: el servidor
     negaría la corrección por «no eres el autor», y cada vez que el grupo
     corrigiera se crearía una fila nueva en vez de reescribir la suya. Sin
     un solo mensaje de error. */
  function normUsuario(s) {
    return String(s == null ? '' : s).trim().toLowerCase()
      .replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
  }
  /* Una firma corta y estable del sector (FNV-1a). No es criptografía: solo
     tiene que caber en el `tipo` y no chocar entre los sectores de un curso. */
  function firma(s) {
    var h = 2166136261;
    var t = String(s == null ? '' : s);
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  /* El tipo de la fila. Lleva curso, autor y sector: por eso una segunda
     entrega del MISMO grupo sobre el MISMO sector reescribe la suya en vez
     de acumular filas, y la del grupo de al lado nunca la pisa. */
  function tipoDe(curso, usuario, clave) {
    return PREFIJO + normCurso(curso) + ' ' + normUsuario(usuario) + ' ' + firma(clave);
  }

  // ── La carga: JSON ⇄ base64 ───────────────────────────────────────────
  function codificar(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function decodificar(b64) {
    try {
      var bin = atob(String(b64 || ''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { return null; }
  }

  // ── Armar la entrega ──────────────────────────────────────────────────
  function claveDe(centro, radioM) {
    return (centro ? Number(centro.lat).toFixed(4) + ',' + Number(centro.lng).toFixed(4) : '?') + '|' + radioM;
  }
  function tituloDe(r, centro, radioM) {
    var e = (r && r.edu) || {};
    var donde = e.barrio || e.ciudad || (centro ? Number(centro.lat).toFixed(4) + ', ' + Number(centro.lng).toFixed(4) : 'el sector');
    var radio = (radioM >= 1000) ? (radioM / 1000) + ' km' : radioM + ' m';
    return String(donde) + ' · radio ' + radio;
  }
  /* La entrega es lo que el grupo ESCRIBIÓ más las cifras que sostienen lo
     escrito. Sin las cifras, «el sector tiene poco comercio» no se puede
     revisar; sin lo escrito, las cifras no son de nadie. */
  function armar(r, lecturas, centro, radioM, curso, usuario) {
    return {
      v: 1,
      curso: normCurso(curso),
      cursoTexto: String(curso || '').trim(),
      autor: normUsuario(usuario),
      clave: claveDe(centro, radioM),
      titulo: tituloDe(r, centro, radioM),
      centro: centro ? { lat: Number(centro.lat), lng: Number(centro.lng) } : null,
      radio: Number(radioM) || 0,
      ts: new Date(dep.ahora()).toISOString(),
      lecturas: lecturas || {},
      resumen: (window.URBIS_EDU && r) ? window.URBIS_EDU.resumen(r) : null
    };
  }
  /* Cuál es la lectura más larga. Se dice por su nombre y no por su id
     («la de Población», no «poblacion»): el estudiante tiene que saber
     cuál caja abrir para acortarla. */
  function laMasLarga(lecturas) {
    var L = ((window.URBIS_EDU || {}).LECTURAS) || [];
    var peor = null;
    Object.keys(lecturas || {}).forEach(function (k) {
      var n = String(lecturas[k] || '').length;
      if (!peor || n > peor.n) {
        var def = L.find(function (x) { return x.id === k; });
        peor = { id: k, n: n, t: (def && def.t) || (k === 'general' ? 'Conclusión del grupo' : k) };
      }
    });
    return peor;
  }
  function filaDe(carga) {
    var desc = [carga.autor, carga.curso, '', carga.titulo, codificar(carga)].join('~~~');
    return {
      tipo: tipoDe(carga.curso, carga.autor, carga.clave),
      lat: carga.centro ? carga.centro.lat.toFixed(7) : '0',
      lng: carga.centro ? carga.centro.lng.toFixed(7) : '0',
      descripcion: desc,
      fecha: carga.ts
    };
  }
  function leerFila(f) {
    if (!f) return null;
    var t = sinTildes(f.tipo || '');
    if (t.indexOf(PREFIJO.trim()) !== 0 && t.indexOf('comentario de curso') !== 0) return null;
    var p = String(f.descripcion || '').split('~~~');
    var carga = decodificar(p[4] || '');
    if (!carga) return null;
    return {
      autor: normUsuario(p[0] || carga.autor || ''),
      curso: normCurso(p[1] || carga.curso || ''),
      cursoTexto: carga.cursoTexto || p[1] || '',
      titulo: p[3] || carga.titulo || '',
      clave: carga.clave || '',
      ts: carga.ts || f.fecha || '',
      ms: Date.parse(carga.ts || f.fecha || '') || 0,
      centro: carga.centro || null,
      radio: carga.radio || 0,
      lecturas: carga.lecturas || {},
      resumen: carga.resumen || null,
      escritas: Object.keys(carga.lecturas || {}).length,
      tipo: String(f.tipo || '')
    };
  }

  // ── Entregar ──────────────────────────────────────────────────────────
  function entregar(r, lecturas, centro, radioM, curso) {
    var nombre = String(curso == null ? dep.cargar() : curso).trim();
    if (!nombre) {
      return Promise.resolve({ ok: false, message: 'Falta el nombre del curso: sin él no hay dónde recoger la entrega.' });
    }
    var usuario = dep.usuario();
    if (!usuario || !dep.haySesion()) {
      return Promise.resolve({ ok: false, message: 'Para entregar hace falta la sesión iniciada: el servidor tiene que saber de qué grupo es el trabajo.' });
    }
    var escritas = Object.keys(lecturas || {}).filter(function (k) { return String(lecturas[k] || '').trim(); });
    if (!escritas.length) {
      return Promise.resolve({ ok: false, message: 'Todavía no hay nada escrito. Llenen al menos una lectura antes de entregar.' });
    }
    var carga = armar(r, lecturas, centro, radioM, nombre, usuario);
    var b64 = codificar(carga);
    if (b64.length > TOPE_CARGA) {
      var peor = laMasLarga(lecturas);
      return Promise.resolve({ ok: false, message: 'La entrega ocupa ' + b64.length.toLocaleString('es-CO') +
        ' caracteres y el máximo son ' + TOPE_CARGA.toLocaleString('es-CO') + '. Acorten la lectura más larga' +
        (peor ? ' —la de «' + peor.t + '», con ' + peor.n.toLocaleString('es-CO') + ' caracteres—' : '') + ' y vuelvan a entregar.' });
    }
    var fila = filaDe(carga);
    var campos = { lat: fila.lat, lng: fila.lng, descripcion: fila.descripcion, fecha: fila.fecha };
    // Reescribir la propia entrega primero; crearla solo si no había ninguna.
    // Al revés se acumularía una fila por cada vez que el grupo corrige.
    return Promise.resolve(dep.actualizar(fila.tipo, campos))
      .then(function (res) {
        if (res && res.updated > 0) return { ok: true, actualizada: true, carga: carga };
        return Promise.resolve(dep.crear(fila)).then(function () { return { ok: true, actualizada: false, carga: carga }; });
      })
      .catch(function () {
        // El servidor niega la reescritura cuando no hay fila que reescribir
        // y la sesión no coincide; en ese caso queda intentar crearla.
        return Promise.resolve(dep.crear(fila))
          .then(function () { return { ok: true, actualizada: false, carga: carga }; })
          .catch(function (e2) { return { ok: false, message: (e2 && e2.message) || String(e2) }; });
      });
  }

  // ── Recoger ───────────────────────────────────────────────────────────
  /* Lo entregado por un curso, lo más nuevo primero y UNA entrega por
     (grupo, sector): si un grupo entregó tres veces el mismo sector porque
     el servidor le creó filas en vez de reescribirlas, el profesor tiene
     que ver la última, no las tres. */
  function traer(curso) {
    var llave = normCurso(curso == null ? dep.cargar() : curso);
    if (!llave) return Promise.resolve([]);
    return Promise.resolve(dep.leerTodo()).then(function (filas) {
      var por = {};
      (filas || []).forEach(function (f) {
        var e = leerFila(f);
        if (!e || e.curso !== llave) return;
        var k = e.autor + '|' + e.clave;
        if (!por[k] || e.ms > por[k].ms) por[k] = e;
      });
      return Object.keys(por).map(function (k) { return por[k]; })
        .sort(function (a, b) { return b.ms - a.ms; });
    });
  }

  function curso() { return dep.cargar(); }
  function fijarCurso(nombre) {
    var n = String(nombre || '').trim().slice(0, 60);
    dep.guardar(n);
    return { ok: !!normCurso(n), curso: n, llave: normCurso(n) };
  }

  window.URBIS_CURSO = {
    configurar: configurar,
    curso: curso, fijarCurso: fijarCurso,
    normCurso: normCurso, normUsuario: normUsuario, firma: firma,
    tipoDe: tipoDe, claveDe: claveDe, tituloDe: tituloDe,
    codificar: codificar, decodificar: decodificar,
    armar: armar, filaDe: filaDe, leerFila: leerFila, laMasLarga: laMasLarga,
    entregar: entregar, traer: traer,
    TOPE_CARGA: TOPE_CARGA, PREFIJO: PREFIJO
  };
})();
