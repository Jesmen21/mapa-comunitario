const E = require('../entorno.js');
// MAPA DE CALOR Y FRANJA NOCTURNA
//
// Un mapa de calor es convincente aunque esté mal: pinta manchas bonitas
// pase lo que pase. Así que aquí no se comprueba que "salga algo", sino que
// el calor esté DONDE ESTÁ LA CAUSA, que la noche se comporte distinto del
// día, y que lo que rompe el andén reste de verdad.
/* El motor ya no se sirve al navegador: vive en el repo privado y acá se
   carga directamente en node (ver motor-local.js). La prueba es la misma; lo
   único que aportaba el navegador era la etiqueta <script>. */
const MOTOR = require('../motor-local.js');
(async () => {

  const r = (() => {
    const M = MOTOR;
    const centro = { lat: 7.9168, lng: -72.4727 };
    let id = 1;
    // ángulo 0 = norte, 90 = oriente
    const el = (tags, d, a) => { const rad = a * Math.PI / 180;
      return { type:'node', id: id++, lat: centro.lat + (d * Math.cos(rad)) / 110540,
               lon: centro.lng + (d * Math.sin(rad)) / (111320 * Math.cos(centro.lat * Math.PI / 180)), tags }; };
    const muchos = (t, n, d, a0, arco) => Array.from({length:n},
      (_, i) => el(t, d, (a0 || 0) + i * ((arco || 360) / n)));
    const correr = elementos => M.analizarHeuristico({ elementos, radioM: 500, centro,
      tipoEstudio:'completo', proyectoId:'cafe_paso' }).stats.movilidad.flujo;

    // ── 1. El calor tiene que aparecer donde está la causa ──────────────
    // Todo lo que genera peatón se pone al ORIENTE (rumbo 90°), lejos del lote.
    const alOriente = [].concat(
      muchos({ leisure:'fitness_centre', name:'Smart Fit' }, 1, 300, 90, 0),
      muchos({ shop:'supermarket', name:'D1' }, 1, 300, 95, 0),
      muchos({ amenity:'bus_station', name:'Terminalito' }, 1, 300, 85, 0),
      muchos({ shop:'clothes' }, 10, 320, 80, 25),
      muchos({ building:'apartments' }, 25, 400, 250, 40)
    );
    const fOriente = correr(alOriente);

    // ── 2. La noche NO puede verse igual que el día ─────────────────────
    // Mismo sitio, dos entornos: oficinas al norte contra bares al sur.
    const oficinasNorte = [].concat(
      muchos({ office:'company' }, 12, 250, 350, 25),
      muchos({ amenity:'bank' }, 3, 260, 5, 10),
      muchos({ building:'apartments' }, 20, 430, 180, 60)
    );
    const baresSur = [].concat(
      muchos({ amenity:'bar' }, 9, 250, 170, 25),
      muchos({ amenity:'restaurant' }, 5, 260, 185, 15),
      muchos({ building:'apartments' }, 20, 430, 350, 60)
    );
    const fOfi = correr(oficinasNorte);
    const fBar = correr(baresSur);

    // ── 3. Lo que rompe el andén tiene que restar ───────────────────────
    const calleViva = muchos({ shop:'clothes' }, 14, 200, 0, 360)
      .concat(muchos({ building:'apartments' }, 20, 380, 0, 360));
    const mismaConBodegas = calleViva.concat(
      muchos({ building:'warehouse' }, 5, 190, 40, 60),
      muchos({ shop:'vacant' }, 4, 200, 120, 40),
      muchos({ building:'ruins' }, 2, 210, 300, 20)
    );
    const fViva = correr(calleViva);
    const fRota = correr(mismaConBodegas);

    // ── 4. El calor vehicular sigue a la vía ────────────────────────────
    // La avenida entra por el occidente (rumbo 270°), con tramos mapeados.
    const conAvenida = muchos({ building:'apartments' }, 25, 300, 0, 360).concat(
      muchos({ highway:'trunk', name:'Anillo Vial' }, 6, 330, 255, 30));
    const fVia = correr(conAvenida);

    const resumen = f => ({
      peatonal: f.peatonal, vehicular: f.vehicular, franjas: f.franjas,
      franjaFuerte: f.franjaFuerte, vidaNocturna: f.vidaNocturna,
      resta: f.restaPeaton, bruta: f.sumaBruta,
      penalizadores: (f.penalizadores || []).map(p => p.sub + '×' + p.n),
      focoDia: f.mapaCalor.focoDia, focoNoche: f.mapaCalor.focoNoche,
      focoVeh: f.mapaCalor.focoVehicular,
      n: f.mapaCalor.n, fiable: f.mapaCalor.fiable,
      celdasDia: f.mapaCalor.peatonalDia.filter(v => v >= 0).length,
      fueraDia: f.mapaCalor.peatonalDia.filter(v => v < 0).length
    });
    return { oriente: resumen(fOriente), ofi: resumen(fOfi), bar: resumen(fBar),
             viva: resumen(fViva), rota: resumen(fRota), via: resumen(fVia) };
  })();

  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const d = (x, k) => x[k] ? (x[k].texto + ' · ' + x[k].valor) : '(sin foco)';

  console.log('── 1. El calor aparece donde está la causa ────────────────────');
  console.log('  anclas al oriente → foco de día : ' + d(r.oriente, 'focoDia'));
  console.log('  celdas dentro del círculo       : ' + r.oriente.celdasDia +
              ' de ' + (r.oriente.n * r.oriente.n) + ' (fuera: ' + r.oriente.fueraDia + ')');
  chk(/oriente/.test((r.oriente.focoDia || {}).rumbo || ''),
      'el foco peatonal cae al oriente, donde están las anclas (' + ((r.oriente.focoDia||{}).rumbo || '—') + ')');
  chk(r.oriente.fueraDia > 100, 'la malla recorta el círculo del radio y no pinta fuera');
  chk(r.oriente.fiable === true, 'con 38 puntos el mapa se marca como fiable');

  console.log('\n── 2. La noche no se ve igual que el día ──────────────────────');
  console.log('  oficinas al norte  · día ' + d(r.ofi, 'focoDia') + ' | noche ' + d(r.ofi, 'focoNoche'));
  console.log('     franjas: ' + JSON.stringify(r.ofi.franjas) + ' → fuerte: ' + r.ofi.franjaFuerte);
  console.log('  bares al sur       · día ' + d(r.bar, 'focoDia') + ' | noche ' + d(r.bar, 'focoNoche'));
  console.log('     franjas: ' + JSON.stringify(r.bar.franjas) + ' → fuerte: ' + r.bar.franjaFuerte);
  chk(r.ofi.franjas.noche < 40, 'un sector de oficinas se apaga de noche (' + r.ofi.franjas.noche + ')');
  chk(r.bar.franjas.noche >= 90, 'un sector de bares tiene su pico de noche (' + r.bar.franjas.noche + ')');
  chk(r.bar.franjaFuerte === 'la noche', 'y la franja fuerte es la noche, no la tarde');
  chk(r.bar.vidaNocturna === true && r.ofi.vidaNocturna === false,
      'solo el sector de bares queda marcado con vida nocturna');
  chk(/sur/.test((r.bar.focoNoche || {}).rumbo || ''),
      'el foco nocturno cae sobre los bares, al sur (' + ((r.bar.focoNoche||{}).rumbo || '—') + ')');
  chk(!/sur/.test((r.ofi.focoNoche || {}).rumbo || '') || r.ofi.franjas.noche < 40,
      'el de oficinas no inventa un foco nocturno fuerte');

  console.log('\n── 3. Lo que rompe el andén resta ─────────────────────────────');
  console.log('  calle viva          : ' + r.viva.peatonal + '/100  (bruto ' + r.viva.bruta +
              ', resta ' + r.viva.resta + ')');
  console.log('  la misma con bodegas: ' + r.rota.peatonal + '/100  (bruto ' + r.rota.bruta +
              ', resta ' + r.rota.resta + ')  ← ' + r.rota.penalizadores.join(', '));
  chk(r.viva.resta === 0, 'una calle sin fachada muerta no descuenta nada');
  chk(r.rota.resta > 0, 'las bodegas, los locales cerrados y la ruina sí descuentan');
  chk(r.rota.peatonal < r.viva.peatonal,
      'y el flujo baja respecto a la misma calle sin ellos (' + r.rota.peatonal +
      ' < ' + r.viva.peatonal + ')');
  chk(r.rota.penalizadores.length === 3, 'se reportan los tres tipos que restan, uno por uno');
  chk(r.rota.peatonal > r.viva.peatonal * 0.5,
      'pero no la borran: el tope impide que el descuento dé vuelta al resultado');

  console.log('\n── 4. El calor vehicular sigue a la vía ───────────────────────');
  console.log('  avenida al occidente → foco vehicular: ' + d(r.via, 'focoVeh'));
  console.log('  vehicular: ' + r.via.vehicular + '/100');
  chk(/occidente/.test((r.via.focoVeh || {}).rumbo || ''),
      'el foco vehicular cae sobre la avenida, al occidente (' + ((r.via.focoVeh||{}).rumbo || '—') + ')');
  chk((r.via.focoVeh || {}).valor === 100, 'la capa vehicular se normaliza contra su propio máximo');
  chk(r.viva.vehicular < r.via.vehicular,
      'una calle sin vía arteria mide menos tránsito vehicular que una con ella');

  console.log('\n' + ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
