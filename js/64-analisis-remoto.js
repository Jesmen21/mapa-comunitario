/* URBIS · Puente al servidor de análisis (fase 04, primera mitad)
   Hace que el módulo de empresas pida el análisis al servidor en vez de
   calcularlo en el navegador.

   POR QUÉ ESTE ARCHIVO EXISTE
   El motor (js/60) lleva las 148 reglas que traducen una etiqueta de
   OpenStreetMap a una categoría urbanística. Mientras el navegador las
   descargue, cualquiera las tiene. Sacarlas de ahí es el punto de todo el
   plan, y esto es el paso que hace posible el siguiente: primero el cliente
   aprende a pedirle el resultado al servidor; después —y solo cuando esto
   esté probado— se le quita la copia local.

   POR QUÉ TODAVÍA CAE AL MOTOR LOCAL
   Hoy el servidor corre en un plan gratuito que se duerme: la primera visita
   tras un rato de inactividad tarda entre 15 y 40 segundos en despertarlo. Si
   esto no tuviera respaldo, un análisis en ese momento simplemente fallaría.
   Así que si el servidor no contesta, se calcula localmente Y SE DICE: el
   resultado trae de dónde salió. Un respaldo silencioso sería peor que
   ninguno, porque nadie sabría que el servidor está caído.

   Cuando se quite el motor del navegador (la otra mitad de la fase 04) este
   respaldo desaparece por sí solo, porque no habrá a qué caer. Ese día el
   servidor deja de ser una mejora y pasa a ser un requisito. */
(function () {
  'use strict';

  function cfg() {
    var c = (window.URBIS_CONFIG && window.URBIS_CONFIG.ANALISIS) || {};
    return {
      api: String(c.API || '').replace(/\/+$/, ''),
      remoto: c.REMOTO !== false,
      esperaMs: Number(c.ESPERA_MS || 70000)   // el arranque en frío puede tardar
    };
  }

  /* La licencia NO se guarda en el repositorio. Este sitio es público: una
     licencia escrita acá la tendría cualquiera, y entonces no sería una
     licencia. Cada cliente pega la suya en su propio navegador. */
  function licencia() {
    try { return String(localStorage.getItem('urbis_licencia_analisis') || '').trim(); }
    catch (e) { return ''; }
  }

  var estado = { donde: null, ms: null, aviso: null, motivo: null };

  function disponible() {
    var c = cfg();
    return !!(c.remoto && c.api);
  }

  // Mensajes claros por código. El servidor ya manda su propio texto en
  // español; esto es el respaldo por si algún día responde otra cosa.
  function mensajeDe(codigo, cuerpo) {
    if (cuerpo && cuerpo.error) return String(cuerpo.error);
    if (codigo === 401) return 'Falta la licencia de URBIS para Empresas, o no es válida.';
    if (codigo === 403) return 'La licencia venció o fue revocada.';
    if (codigo === 429) return 'Se agotó el cupo de análisis de hoy para esta licencia.';
    return 'El servidor de análisis respondió con un error (' + codigo + ').';
  }

  function pedir(ruta, entrada, alAvisar) {
    var c = cfg();
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var reloj = null, despierta = null;

    var p = new Promise(function (resolve, reject) {
      // Si tarda más de cuatro segundos casi seguro es el arranque en frío
      // del plan gratuito. Decirlo evita que parezca que se colgó.
      despierta = setTimeout(function () {
        if (typeof alAvisar === 'function') {
          alAvisar('Despertando el servidor de análisis… puede tardar medio minuto.');
        }
      }, 4000);

      reloj = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error('el servidor no respondió a tiempo'));
      }, c.esperaMs);

      var cab = { 'Content-Type': 'application/json' };
      var lic = licencia();
      if (lic) cab.Authorization = 'Bearer ' + lic;

      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      fetch(c.api + ruta, {
        method: 'POST', headers: cab, body: JSON.stringify(entrada),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (r) {
          return r.json().catch(function () { return null; })
            .then(function (j) { return { codigo: r.status, cuerpo: j }; });
        })
        .then(function (r) {
          if (r.codigo !== 200 || !r.cuerpo || r.cuerpo.ok !== true || !r.cuerpo.datos) {
            var e = new Error(mensajeDe(r.codigo, r.cuerpo));
            e.codigo = r.codigo;
            // 401, 403 y 429 son decisiones del servidor, no fallas: caer al
            // motor local ahí sería saltarse la licencia desde el propio
            // producto. Se marcan para que el llamador NO haga respaldo.
            e.esDecision = (r.codigo === 401 || r.codigo === 403 || r.codigo === 429);
            throw e;
          }
          var ms = ((window.performance && performance.now) ? performance.now() : Date.now()) - t0;
          resolve({ datos: r.cuerpo.datos, ms: Math.round(ms), servidorMs: r.cuerpo.ms });
        })
        .catch(reject);
    });

    return p.then(function (v) {
      clearTimeout(reloj); clearTimeout(despierta); return v;
    }, function (e) {
      clearTimeout(reloj); clearTimeout(despierta); throw e;
    });
  }

  /* Punto único que usa la interfaz. `modo` es 'simple' o 'mixto'.
     Devuelve el informe, venga de donde venga, y deja en AIA_REMOTO.estado
     de dónde vino para que la pantalla lo pueda mostrar. */
  function analizar(modo, entrada, alAvisar) {
    var local = function () {
      estado = { donde: 'local', ms: null, aviso: estado.aviso, motivo: estado.motivo };
      return modo === 'mixto'
        ? Promise.resolve(window.AIA_MOTOR.analizarMixto(entrada))
        : Promise.resolve(window.AIA_MOTOR.analizar(entrada));
    };

    if (!disponible()) {
      estado = { donde: 'local', ms: null, aviso: null, motivo: 'servidor no configurado' };
      return local();
    }

    var ruta = modo === 'mixto' ? '/analizar-mixto' : '/analizar';
    return pedir(ruta, entrada, alAvisar).then(function (r) {
      estado = { donde: 'servidor', ms: r.ms, aviso: null, motivo: null };
      return r.datos;
    }, function (e) {
      // Una decisión del servidor se respeta: sin licencia no hay análisis.
      if (e && e.esDecision) throw e;
      estado = {
        donde: 'local', ms: null, motivo: String((e && e.message) || e),
        aviso: 'No se pudo conectar con el servidor de análisis; el informe se calculó en este dispositivo.'
      };
      return local();
    });
  }

  window.AIA_REMOTO = {
    analizar: analizar,
    disponible: disponible,
    licencia: licencia,
    guardarLicencia: function (txt) {
      try { localStorage.setItem('urbis_licencia_analisis', String(txt || '').trim()); return true; }
      catch (e) { return false; }
    },
    get estado() { return estado; }
  };
})();
