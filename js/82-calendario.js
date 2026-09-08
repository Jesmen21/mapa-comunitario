/* URBIS · CALENDARIO DE RANGO (js/82)
   ─────────────────────────────────────────────────────────────────────────
   Hasta la v818, para publicar un evento de Juegos URBIS había que contestar
   «¿en cuántas HORAS termina la competencia?». Nadie piensa así. Quien
   organiza un torneo piensa «del viernes al domingo», y para escribir «72»
   tiene que abrir el calendario del teléfono, contar, y confiar en que contó
   bien. Un error de un día en ese número es un evento que se cierra antes de
   que termine el juego, y el premio es dinero real.

   Esto es el calendario que faltaba: se toca el día en que empieza y el día
   en que termina, como en la página de una aerolínea, y las horas las cuenta
   la máquina.

   ── Por qué el rango COMPLETO, y no solo el final ────────────────────────
   Porque el modelo temporal ya lo soporta y nadie se había dado cuenta.
   `visibleParaRol` (js/05) pinta un reporte temporal solo si
   `creado <= ahora <= expira`: un evento con fecha de creación futura ya
   queda escondido hasta que llega su día. Así que elegir «del 12 al 15»
   escribe `creado` el 12 a las 00:00 y `expira` el 15 a las 23:59, y el
   evento aparece en el mapa el 12 solo. Un evento programado no es una
   función nueva del servidor: es la que ya existía, sin manera de pedirla.

   ── Lo que este módulo NO hace ───────────────────────────────────────────
   No conoce eventos, ni premios, ni el mapa. Recibe un rango de días y
   devuelve dos fechas y las horas entre ellas. Quien lo llama decide qué
   significan. Por eso lo pueden usar el compositor del móvil y el flujo de
   escritorio sin que ninguno sepa del otro.

   ── La estética ──────────────────────────────────────────────────────────
   Celeste URBIS, el mismo del compositor premium: fondo #EAF9FF, borde
   #7FD8F5, tinta #0B5E86, y el tramo seleccionado en el degradado
   #7FE3FF → #0EA5E9 que ya usa el botón de publicar. Está en css/82.     */
(function () {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // Lunes primero: es como se lee un calendario en Colombia.
  var DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var MAX_MESES = 12;          // hasta un año adelante; más no lo pide nadie
  var MAX_DIAS_RANGO = 60;     // un evento premium más largo que esto es otra cosa

  var dep = { ahora: function () { return Date.now(); } };
  function configurar(d) { Object.keys(d || {}).forEach(function (k) { dep[k] = d[k]; }); }

  // ── Fechas, sin librería ──────────────────────────────────────────────
  function inicioDeDia(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function finDeDia(d)    { var x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
  function hoy()          { return inicioDeDia(new Date(dep.ahora())); }
  function mismoDia(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function sumarDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  /* Los días completos entre dos fechas. Se cuenta sobre los días del
     calendario y no dividiendo milisegundos: entre el 12 y el 13 hay un día
     aunque el horario de verano le quite una hora al 12. Colombia no lo
     tiene, pero el mismo módulo puede acabar en otra ciudad y una cuenta que
     depende de que nunca lo tenga es una cuenta que espera no viajar. */
  function diasEntre(a, b) {
    var x = inicioDeDia(a), y = inicioDeDia(b), n = 0;
    while (x.getTime() < y.getTime() && n < 400) { x = sumarDias(x, 1); n++; }
    return n;
  }

  /* Las horas que hay que guardar. El evento empieza cuando empieza el día
     elegido —o AHORA, si ese día es hoy: publicar algo con fecha de creación
     a las 00:00 de hoy lo dejaría vivo «desde esta madrugada», que no es
     verdad— y termina al acabar el último día del rango. */
  function ventana(inicio, fin) {
    var ahora = new Date(dep.ahora());
    var i = inicioDeDia(inicio);
    var arranca = mismoDia(i, hoy()) ? ahora : i;
    var termina = finDeDia(fin || inicio);
    var horas = Math.max(1, Math.ceil((termina.getTime() - arranca.getTime()) / 3600000));
    return { inicio: arranca, fin: termina, horas: horas, dias: diasEntre(inicio, fin || inicio) + 1 };
  }

  function fechaCorta(d) {
    if (!d) return '';
    return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
  }
  function fechaLarga(d) {
    if (!d) return '';
    return d.getDate() + ' de ' + MESES[d.getMonth()];
  }
  /* La frase que va a la ficha del evento y que lee el jugador. Un rango de
     un solo día se dice como un solo día: «del 12 al 12» se lee como un
     error de la aplicación, no como una competencia de un día. */
  function textoRango(inicio, fin) {
    var v = ventana(inicio, fin);
    var hora = v.fin.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    if (v.dias <= 1) return fechaLarga(inicio) + ', hasta las ' + hora;
    return 'del ' + fechaLarga(inicio) + ' al ' + fechaLarga(fin) + ', hasta las ' + hora;
  }
  function textoDuracion(inicio, fin) {
    var v = ventana(inicio, fin);
    return v.dias + (v.dias === 1 ? ' día' : ' días') + ' · ' + v.horas + ' h';
  }

  // ── El dibujo del mes ─────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function mesHTML(anio, mes, sel, limite) {
    var primero = new Date(anio, mes, 1);
    // getDay() da 0 para domingo; acá la semana empieza el lunes.
    var hueco = (primero.getDay() + 6) % 7;
    var ultimo = new Date(anio, mes + 1, 0).getDate();
    var celdas = '';
    for (var h = 0; h < hueco; h++) celdas += '<span class="urb-cal-hueco"></span>';
    for (var d = 1; d <= ultimo; d++) {
      var dia = new Date(anio, mes, d);
      var t = dia.getTime();
      var antes = t < limite.min.getTime(), despues = t > limite.max.getTime();
      var cls = [];
      if (antes || despues) cls.push('fuera');
      if (mismoDia(dia, limite.hoy)) cls.push('hoy');
      if (sel.inicio && mismoDia(dia, sel.inicio)) cls.push('inicio');
      if (sel.fin && mismoDia(dia, sel.fin)) cls.push('fin');
      if (sel.inicio && sel.fin && t > sel.inicio.getTime() && t < sel.fin.getTime()) cls.push('entre');
      celdas += '<button type="button" class="urb-cal-dia ' + cls.join(' ') + '"' +
        (antes || despues ? ' disabled' : '') +
        ' data-fecha="' + anio + '-' + (mes + 1) + '-' + d + '"' +
        ' aria-label="' + esc(d + ' de ' + MESES[mes] + ' de ' + anio) + '">' + d + '</button>';
    }
    return '<div class="urb-cal-mes"><h4>' + esc(MESES[mes]) + ' ' + anio + '</h4>' +
      '<div class="urb-cal-sem">' + DIAS.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
      '<div class="urb-cal-rejilla">' + celdas + '</div></div>';
  }

  /* ── El calendario montado sobre un contenedor ────────────────────────
     Devuelve un controlador con `valor()`. El estado vive acá dentro y no en
     el DOM: leer la selección de las clases CSS funciona hasta que alguien
     cambia una clase por estética y se lleva por delante la lógica. */
  function montar(caja, opciones) {
    if (!caja) return null;
    var o = opciones || {};
    var H = hoy();
    var limite = { hoy: H, min: H, max: sumarDias(H, MAX_MESES * 31) };
    var sel = { inicio: o.inicio ? inicioDeDia(o.inicio) : H,
                fin: o.fin ? inicioDeDia(o.fin) : (o.inicio ? inicioDeDia(o.inicio) : H) };
    var eligiendo = 'inicio';   // el siguiente toque fija el inicio o el fin
    var alCambiar = typeof o.alCambiar === 'function' ? o.alCambiar : function () {};
    var meses = Math.min(MAX_MESES, Math.max(2, o.meses || 3));

    function pintar() {
      var v = ventana(sel.inicio, sel.fin);
      var cabeza =
        '<div class="urb-cal-patas">' +
          '<button type="button" class="urb-cal-pata' + (eligiendo === 'inicio' ? ' activa' : '') + '" data-pata="inicio">' +
            '<small>Empieza</small><b>' + esc(fechaCorta(sel.inicio)) +
            (mismoDia(sel.inicio, H) ? ' <em>hoy</em>' : '') + '</b></button>' +
          '<span class="urb-cal-flecha" aria-hidden="true">→</span>' +
          '<button type="button" class="urb-cal-pata' + (eligiendo === 'fin' ? ' activa' : '') + '" data-pata="fin">' +
            '<small>Termina</small><b>' + esc(fechaCorta(sel.fin)) + '</b></button>' +
        '</div>' +
        '<p class="urb-cal-resumen"><b>' + esc(textoDuracion(sel.inicio, sel.fin)) + '</b>' +
          '<span>' + esc(eligiendo === 'inicio' ? 'Toca el día en que empieza' : 'Ahora toca el día en que termina') + '</span></p>';
      var cuerpo = '';
      var m = new Date(H.getFullYear(), H.getMonth(), 1);
      for (var i = 0; i < meses; i++) {
        cuerpo += mesHTML(m.getFullYear(), m.getMonth(), sel, limite);
        m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      }
      /* El aviso de que un evento con fecha futura no se ve hasta su día no
         es letra chica: quien publica el lunes un evento para el viernes y no
         lo encuentra en el mapa, cree que no se guardó y lo publica otra vez. */
      var aviso = mismoDia(sel.inicio, H) ? '' :
        '<p class="urb-cal-aviso">Empieza el ' + esc(fechaLarga(sel.inicio)) +
        ': hasta ese día el evento no aparece en el mapa. Está guardado, esperando.</p>';
      caja.innerHTML = '<div class="urb-cal">' + cabeza +
        '<div class="urb-cal-meses">' + cuerpo + '</div>' + aviso + '</div>';
      alCambiar(v);
    }

    function tocar(fecha) {
      if (eligiendo === 'inicio') {
        sel.inicio = fecha;
        // Elegir un inicio posterior al fin dejaría un rango al revés: el fin
        // se arrastra con él y se pasa a pedir el final, que es lo que sigue.
        if (sel.fin.getTime() < fecha.getTime()) sel.fin = fecha;
        eligiendo = 'fin';
      } else {
        if (fecha.getTime() < sel.inicio.getTime()) {
          // Tocar antes del inicio no es un error: es querer empezar antes.
          sel.inicio = fecha; sel.fin = fecha; eligiendo = 'fin';
        } else if (diasEntre(sel.inicio, fecha) + 1 > MAX_DIAS_RANGO) {
          sel.fin = sumarDias(sel.inicio, MAX_DIAS_RANGO - 1);
          eligiendo = 'inicio';
        } else {
          sel.fin = fecha; eligiendo = 'inicio';
        }
      }
      pintar();
    }

    caja.addEventListener('click', function (ev) {
      var pata = ev.target.closest('[data-pata]');
      if (pata && caja.contains(pata)) { eligiendo = pata.getAttribute('data-pata'); pintar(); return; }
      var b = ev.target.closest('.urb-cal-dia');
      if (!b || b.disabled || !caja.contains(b)) return;
      var p = String(b.getAttribute('data-fecha') || '').split('-').map(Number);
      if (p.length !== 3) return;
      tocar(new Date(p[0], p[1] - 1, p[2]));
    });

    pintar();
    return {
      valor: function () { return ventana(sel.inicio, sel.fin); },
      texto: function () { return textoRango(sel.inicio, sel.fin); },
      dias: function () { return sel; },
      repintar: pintar
    };
  }

  /* ── El calendario en una ventana propia ──────────────────────────────
     Para los flujos que hoy preguntan con `prompt()` y no tienen dónde meter
     un calendario. Devuelve una promesa con el rango, o null si cancelan. */
  function pedirRango(opciones) {
    var o = opciones || {};
    return new Promise(function (resolver) {
      var fondo = document.createElement('div');
      fondo.className = 'urb-cal-fondo';
      fondo.innerHTML =
        '<div class="urb-cal-ventana" role="dialog" aria-modal="true" aria-label="' + esc(o.titulo || 'Elegir fechas') + '">' +
          '<div class="urb-cal-cabeza"><b>' + esc(o.titulo || '📅 ¿Cuándo es la competencia?') + '</b>' +
            '<button type="button" class="urb-cal-x" aria-label="Cerrar">×</button></div>' +
          '<div class="urb-cal-caja"></div>' +
          '<div class="urb-cal-pie"><button type="button" class="urb-cal-cancelar">Cancelar</button>' +
            '<button type="button" class="urb-cal-ok">Listo</button></div>' +
        '</div>';
      (document.body || document.documentElement).appendChild(fondo);
      var ctrl = montar(fondo.querySelector('.urb-cal-caja'), o);
      function cerrar(v) { try { fondo.remove(); } catch (e) {} resolver(v); }
      fondo.addEventListener('click', function (ev) {
        if (ev.target === fondo || ev.target.closest('.urb-cal-x, .urb-cal-cancelar')) { cerrar(null); return; }
        if (ev.target.closest('.urb-cal-ok')) { cerrar(ctrl ? ctrl.valor() : null); }
      });
      fondo.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') cerrar(null); });
      try { fondo.querySelector('.urb-cal-ok').focus(); } catch (e) {}
    });
  }

  window.URBIS_CALENDARIO = {
    configurar: configurar,
    montar: montar, pedirRango: pedirRango,
    ventana: ventana, textoRango: textoRango, textoDuracion: textoDuracion,
    fechaCorta: fechaCorta, fechaLarga: fechaLarga,
    inicioDeDia: inicioDeDia, finDeDia: finDeDia, diasEntre: diasEntre, sumarDias: sumarDias,
    MAX_DIAS_RANGO: MAX_DIAS_RANGO, MESES: MESES
  };
})();
