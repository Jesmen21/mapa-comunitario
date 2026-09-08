const E = require('../entorno.js');
/* EL HORARIO DEL LETRERO, ANOTADO POR EL CURSO

   El análisis leía `opening_hours` de OpenStreetMap y le decía al curso
   «anotá el horario del letrero» —lo pone en la hoja de campo y en «qué
   falta por levantar»— pero no había dónde escribirlo. La aplicación pedía
   un dato que no sabía recibir, y el estudiante volvía de la calle con una
   libreta que no cabía en ninguna parte.

   Lo que esta suite vigila, en el orden en que pasa:

     · el vocabulario: los días y dos horas se traducen al formato de
       OpenStreetMap, y lo que está a medias NO se escribe;
     · el registro: la casilla va al final, y un punto viejo sin ella se lee
       igual que siempre;
     · el formulario: las horas solo se piden cuando hacen falta, y al
       reabrir un punto vuelve lo que se anotó;
     · y la que sostiene todo lo demás: lo anotado en la calle llega al motor
       como `opening_hours` y entra a la MISMA cuenta que lo que ya venía del
       mapa. Si esa cadena se rompe, el curso puede anotar horarios toda la
       tarde y la cobertura seguirá diciendo que no hay ninguno.            */
const { chromium } = require(E.MODULOS + '/playwright-core');
const guionDelMotor = require('../motor-navegador.js');
const REPO = E.RAIZ;
const C = { lat: 7.8939, lng: -72.5078 };

const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.setContent('<div id="info-content"></div>');
  await pg.evaluate(() => {
    window.URBIS_CONFIG = { TEMP_REPORT_TTL_HOURS: 8 };
    const chain = new Proxy(function () {}, {
      get: (t, k) => (k === Symbol.toPrimitive || k === 'then') ? undefined : chain,
      apply: () => chain, construct: () => chain });
    window.L = chain; window.map = chain;
  });
  await pg.addScriptTag({ content: guionDelMotor() });
  for (const f of ['00-config', '00-app-shell', '01-audio-feedback', '02-auth-roles',
                   '03-map-data-config', '03b-edificio-vocabulario', '04-marker-proximity',
                   '05-helpers-temporal-security', '64-analisis-edu', '11-report-form']) {
    try { await pg.addScriptTag({ path: REPO + '/js/' + f + '.js' }); } catch (e) {}
  }

  const r = await pg.evaluate((C) => {
    const V = window.URBIS_EDIFICIO, EDU = window.URBIS_EDU, SL = window.URBIS_SLOTS;
    const o = {};
    // A la defensiva: contra el código anterior nada de esto existe, y una
    // suite que revienta no reporta, solo se cae.
    const cod = (d, a, c) => (V && V.codificarHorario) ? V.codificarHorario(d, a, c) : '(sin función)';
    const vuelta = t => (V && V.leerHorarioGuardado) ? V.leerHorarioGuardado(t) : {};

    // ── 1 · El vocabulario ────────────────────────────────────────────────
    o.dias = (V && V.DIAS_HORARIO) || [];
    o.codigos = {
      todos: cod('Todos los días', '06:00', '22:00'),
      sabado: cod('Lunes a sábado', '08:00', '20:00'),
      semana: cod('Lunes a viernes', '08:00', '18:00'),
      finde: cod('Solo fines de semana', '10:00', '18:00'),
      always: cod('Abierto 24 horas', '', ''),
      // Cruza la medianoche: el bar que cierra a las dos. Es el caso que el
      // dato busca, y el que se pierde si se exige que cierre > abre.
      noche: cod('Lunes a sábado', '18:00', '02:00')
    };
    o.aMedias = {
      sinHoras: cod('Lunes a sábado', '', ''),
      soloUna: cod('Lunes a sábado', '08:00', ''),
      horaMala: cod('Lunes a sábado', '8', '20:00'),
      igual: cod('Lunes a sábado', '08:00', '08:00'),
      sinDias: cod('Sin registrar', '08:00', '20:00'),
      noSabe: cod('No se sabe', '08:00', '20:00')
    };
    o.vueltas = {
      sabado: vuelta('Mo-Sa 08:00-20:00'),
      always: vuelta('24/7'),
      vacio: vuelta(''),
      // Una cadena que no compuso el formulario —traída del mapa abierto— no
      // se reinterpreta ni se pisa: vuelve como cruda.
      ajena: vuelta('Mo-Fr 08:00-12:00,14:00-18:00')
    };
    const enPalabras = t => (V && V.horarioEnPalabras) ? V.horarioEnPalabras(t) : '';
    o.palabras = {
      sabado: enPalabras('Mo-Sa 08:00-20:00'),
      noche: enPalabras('Mo-Sa 18:00-02:00'),
      always: enPalabras('24/7')
    };

    // ── 2 · El registro ───────────────────────────────────────────────────
    const usosMat = V.todosLosUsos().map(() => 'NO');
    const base = ['Comercio y Servicios · Local pequeño (tienda de barrio)', 'La 7', 'n', 'Bueno', 'Activo', 'N/A'].concat(usosMat)
      .concat(['N/A', 'Aprobado', 'A', 'edu', '0', 'a@b.c', '1', 'C'])
      .concat(['2026-09-01T10:00:00Z', 'N/A', 'Permanente', 'Activo', 'General']);
    const IDX_HOR = SL.edificioHorario || (SL.edificioUsosPorPiso + 1);
    const conHorario = (h, pisos) => {
      const d = base.concat([V.SIN_REGISTRAR, pisos || '1', '', '', '']);
      while (d.length <= IDX_HOR) d.push('');
      d[IDX_HOR] = h;
      return d.join(' | ');
    };
    // A la defensiva: contra el registro anterior la casilla no existe.
    o.slotAlFinal = SL.edificioHorario > SL.edificioUsosPorPiso && SL.edificioHorario > SL.victimas;
    o.leido = V.leer(conHorario('Mo-Sa 08:00-20:00')).horario;
    // «No se sabe» es una respuesta, y NO es un horario: se guarda, pero no
    // viaja como si el local abriera de lunes a sábado.
    o.leidoNoSabe = V.leer(conHorario('No se sabe')).horario;
    o.leidoVacio = V.leer(conHorario('')).horario;
    // Un punto viejo, de antes de que la casilla existiera, se lee igual.
    const viejo = base.concat([V.SIN_REGISTRAR, '2', '', '', '']).join(' | ');
    const fv = V.leer(viejo);
    o.viejo = { horario: fv.horario, pisos: fv.pisos, mat: fv.materialidad };

    // ── 3 · El formulario ─────────────────────────────────────────────────
    window.userRole = 'admin'; window.userBarrioGlobal = 'Centro';
    window.formPaso2('Comercio y Servicios', 7.9, -72.4, '');
    const cont = document.getElementById('info-content');
    const sel = cont.querySelector('#sel-horario-dias');
    const horas = cont.querySelector('#ins-horario-horas');
    o.form = {
      hay: !!sel, opciones: sel ? sel.options.length : 0,
      // Sin registrar: las dos horas no se piden. Dejarlas encendidas invita
      // a llenarlas y a contradecir lo que se acaba de elegir.
      ocultasAlAbrir: !!(horas && horas.hidden)
    };
    if (sel) {
      sel.value = 'Lunes a sábado'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      o.form.visiblesAlElegir = !!(horas && !horas.hidden);
      sel.value = 'Abierto 24 horas'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      o.form.ocultasEn24h = !!(horas && horas.hidden);
    }
    // Al reabrir un punto ya anotado vuelve lo que se escribió.
    window.formPaso2('Comercio y Servicios', 7.9, -72.4, conHorario('Mo-Fr 09:00-17:00'));
    const cont2 = document.getElementById('info-content');
    o.reabre = {
      dias: (cont2.querySelector('#sel-horario-dias') || {}).value || '',
      abre: (cont2.querySelector('#ins-horario-abre') || {}).value || '',
      cierra: (cont2.querySelector('#ins-horario-cierra') || {}).value || '',
      horasVisibles: !!(cont2.querySelector('#ins-horario-horas') && !cont2.querySelector('#ins-horario-horas').hidden)
    };

    // ── 4 · La cadena entera, hasta la cuenta del motor ───────────────────
    const punto = (h, i, pisos, porPiso) => {
      const d = conHorario(h, pisos).split(' | ');
      if (porPiso) d[SL.edificioUsosPorPiso] = porPiso;
      return { lat: String(7.8939 + i * 0.0004), lng: '-72.5078',
               tipo: 'Comercio y Servicios · Local pequeño (tienda de barrio)', descripcion: d.join(' | ') };
    };
    const els1 = EDU.puntoAElemento(punto('Mo-Sa 08:00-20:00', 1), 1) || [];
    o.tagPuesta = els1.length ? els1[0].tags.opening_hours : '(sin elemento)';
    // Un edificio con varios usos tiene UN letrero: el horario va una sola
    // vez, o un edificio de cuatro usos contaría cuatro horarios.
    const els4 = EDU.puntoAElemento(punto('24/7', 2, '4', '1:Comercio;2:Vivienda;3:Oficinas o servicios;4:Vivienda'), 2) || [];
    o.varios = { n: els4.length, conTag: els4.filter(e => e.tags.opening_hours).length };
    const elsSin = EDU.puntoAElemento(punto('', 3), 3) || [];
    o.sinTag = elsSin.length ? !('opening_hours' in elsSin[0].tags) : false;

    /* Y la cuenta del motor: cinco locales, tres con horario anotado por el
       curso y dos sin nada. La cobertura tiene que decir 3 de 5, con el
       mismo lector que cuenta los de OpenStreetMap. */
    const M = window.AIA_MOTOR;
    const elementos = [];
    [['Mo-Sa 08:00-20:00', 1], ['24/7', 2], ['Mo-Su 06:00-22:00', 3], ['', 4], ['', 5]]
      .forEach(function (par) {
        (EDU.puntoAElemento(punto(par[0], par[1]), par[1]) || []).forEach(e => elementos.push(e));
      });
    const out = M.analizarHeuristico({ elementos: elementos, radioM: 500, centro: C });
    const H = (out.stats || {}).horarios || {};
    o.motor = { total: H.total, conDato: H.conDato, sinDato: H.sinDato, cobertura: H.cobertura, siempre: H.siempre };

    // Y el contador propio del curso: cuántos de esos los consiguieron ellos.
    window.urbisDatosVisibles = function () {
      return [['Mo-Sa 08:00-20:00', 1], ['24/7', 2], ['', 3]].map(p => punto(p[0], p[1]));
    };
    o.conHorarioCurso = ((EDU.reunirElementos ? EDU.reunirElementos(C, 500) : {}).edificacion || {}).conHorario;
    return o;
  }, C);

  console.log('\n── El vocabulario ──────────────────────────────────────────');
  console.log('  ' + JSON.stringify(r.codigos));
  T('los días y dos horas se traducen al formato de OpenStreetMap',
    r.codigos.todos === 'Mo-Su 06:00-22:00' && r.codigos.sabado === 'Mo-Sa 08:00-20:00' &&
    r.codigos.semana === 'Mo-Fr 08:00-18:00' && r.codigos.finde === 'Sa-Su 10:00-18:00',
    r.codigos.sabado);
  T('«abierto 24 horas» es 24/7 y no pide horas', r.codigos.always === '24/7');
  T('y el que cierra pasada la medianoche se escribe igual', r.codigos.noche === 'Mo-Sa 18:00-02:00',
    'el bar que cierra a las dos');
  console.log('  a medias: ' + JSON.stringify(r.aMedias));
  T('lo que está a medias no se escribe: media respuesta daría un horario falso',
    Object.keys(r.aMedias).every(k => r.aMedias[k] === ''),
    Object.keys(r.aMedias).filter(k => r.aMedias[k] !== '').join(', ') || 'ninguno cuela');
  T('y vuelve entero al formulario',
    r.vueltas.sabado.dias === 'Lunes a sábado' && r.vueltas.sabado.abre === '08:00' &&
    r.vueltas.sabado.cierra === '20:00' && r.vueltas.always.dias === 'Abierto 24 horas' &&
    r.vueltas.vacio.dias === 'Sin registrar');
  T('una cadena que no compuso el formulario vuelve como cruda, sin reinterpretarse',
    r.vueltas.ajena.crudo === 'Mo-Fr 08:00-12:00,14:00-18:00' && !r.vueltas.ajena.abre,
    r.vueltas.ajena.crudo);
  T('y se puede leer en castellano, que es lo que ve el estudiante',
    /Lunes a sábado, de 08:00 a 20:00/.test(r.palabras.sabado) &&
    /del día siguiente/.test(r.palabras.noche) && /24 horas/.test(r.palabras.always),
    r.palabras.sabado);

  console.log('\n── El registro ─────────────────────────────────────────────');
  T('la casilla nueva va al final del registro', r.slotAlFinal);
  T('y se lee de vuelta tal cual', r.leido === 'Mo-Sa 08:00-20:00', r.leido);
  T('«no se sabe» no viaja como si fuera un horario', r.leidoNoSabe === '' && r.leidoVacio === '');
  T('un punto de antes de que la casilla existiera se lee igual que siempre',
    r.viejo.horario === '' && r.viejo.pisos === 2, JSON.stringify(r.viejo));

  console.log('\n── El formulario ───────────────────────────────────────────');
  T('el formulario pregunta a qué horas abre', r.form.hay && r.form.opciones === 7,
    r.form.opciones + ' opciones');
  T('las dos horas solo se piden cuando hacen falta',
    r.form.ocultasAlAbrir && r.form.visiblesAlElegir && r.form.ocultasEn24h);
  console.log('  reabre: ' + JSON.stringify(r.reabre));
  T('al reabrir un punto anotado vuelve lo que se escribió',
    r.reabre.dias === 'Lunes a viernes' && r.reabre.abre === '09:00' &&
    r.reabre.cierra === '17:00' && r.reabre.horasVisibles);

  console.log('\n── De la calle a la cuenta del motor ───────────────────────');
  T('lo anotado llega al motor como `opening_hours`, la misma etiqueta del mapa abierto',
    r.tagPuesta === 'Mo-Sa 08:00-20:00', r.tagPuesta);
  T('un edificio de cuatro usos tiene UN letrero, no cuatro',
    r.varios.n === 3 && r.varios.conTag === 1, r.varios.conTag + ' de ' + r.varios.n + ' elementos');
  T('y un punto sin horario no lleva la etiqueta en blanco', r.sinTag === true);
  console.log('  ' + JSON.stringify(r.motor));
  T('el motor cuenta lo anotado por el curso en su cobertura',
    r.motor.conDato === 3 && r.motor.total === 5 && r.motor.sinDato === 2 &&
    r.motor.cobertura === 60, r.motor.conDato + ' de ' + r.motor.total + ' · ' + r.motor.cobertura + ' %');
  T('con el mismo lector: el 24/7 anotado a mano cuenta como abierto siempre',
    r.motor.siempre === 1);
  T('y el panel puede decir cuántos consiguieron ellos caminando',
    r.conHorarioCurso === 2, r.conHorarioCurso + ' anotados por el curso');

  T('sin errores de página', errs.length === 0, errs[0] || 'ninguno');
  await b.close();
  console.log('\n  ' + (mal ? mal + ' fallo(s)' : 'todas las comprobaciones pasaron'));
  process.exit(mal ? 1 : 0);
})();
