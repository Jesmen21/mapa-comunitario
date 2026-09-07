const E = require('../entorno.js');
/* Tanda · los gráficos y las estadísticas del análisis de sector.

   Lo que había antes de esta tanda, medido:

     · Tres gráficos, y dos dibujaban lo MISMO. Las barras y el radar hacían
       los dos `porGrupo.map(...)`. Además, un radar sobre conteos absolutos
       no significa nada: el área que pinta cambia de tamaño si se cambia el
       orden de los ejes, y el orden de los ejes lo daba `Object.keys` del
       catálogo, o sea el azar del archivo.

     · El donut repartía hasta siete porciones. Nadie compara la quinta
       porción de un anillo con la sexta. Y la paleta que usaba estaba
       escrita a mano DOS veces —en la pantalla y en el PNG del informe—,
       con una copia ordenada de mayor a menor y la otra sin ordenar.

     · `multiRadio` —cómo cambia el entorno al alejarse, el dato más
       analítico que produce el motor— era una tabla de seis columnas y
       ningún dibujo.

     · Y ningún número tenía contra qué compararse. «38 usos por hectárea»
       solo no dice nada; el usuario tiene sus propios sectores guardados y
       esa es la única referencia honesta que hay a la mano.

   Esta prueba no usa el motor ni Overpass: un análisis guardado lleva su
   `resultado` completo, así que se siembran cuatro en localStorage y se
   abre uno desde «Mis análisis». Así los números son conocidos y la
   referencia se puede recontar acá, en Node, en vez de creerle a la
   pantalla.                                                              */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 };

/* ── Los cuatro sectores de mentira ──────────────────────────────────────
   Las cifras están escogidas para que la posición del que se abre sea
   distinta en cada métrica: el más alto en una, el más bajo en otra, y en
   medio en las demás. Si la referencia estuviera cableada a un texto fijo,
   una de las tres fallaría.                                              */
const CIFRAS = [
  // nombre        total  dens  poblacion  arterias  paradas
  ['Centro',        420,  61.2,   9800,      7,        22],
  ['La Ceiba',      180,  24.0,   4100,      3,         9],
  ['Prados',         95,  12.4,   2600,      2,         4],
  // El que se abre: el más alto en densidad, el más bajo en arterias.
  ['El barrio',     240,  73.5,   5200,      1,        11]
];
const ABIERTO = 'El barrio';

function anillo(radioM, densidadPorHa, comercio, equipamientos, poblacionEstimada, esAnalizado) {
  return { radioM, densidadPorHa, comercio, equipamientos, poblacionEstimada,
           total: Math.round(densidadPorHa * (Math.PI * radioM * radioM) / 10000),
           esAnalizado: !!esAnalizado };
}

function resultado(nombre, total, densidadPorHa, poblacionEstimada, nViasArterias, paradasBus) {
  return {
    modo: 'simple',
    meta: { proyectoNombre: nombre, radioM: 500, direccionAprox: 'Calle de mentira 1' },
    conclusion: 'Análisis de prueba de ' + nombre + '.',
    pois: [],
    indicadores: null,
    stats: {
      total: total,
      manuales: 0,
      densidadPorHa: densidadPorHa,
      poblacionEstimada: poblacionEstimada,
      poblacionEsCensal: false,
      poblacionProyectada: false,
      movilidad: { nViasArterias: nViasArterias, paradasBus: paradasBus, flujo: null },
      /* El horario declarado, tal como lo devuelve el motor. Nueve de
         dieciséis usos con horario legible, uno ilegible, seis sin nada:
         los porcentajes tienen que salir sobre los NUEVE y no sobre los
         dieciséis, que es la única manera de que la cifra signifique algo. */
      horarios: { total: 16, conDato: 9, ilegible: 1, sinDato: 6, cobertura: 56,
                  siempre: 2, deNoche: 5, sabado: 7, domingo: 6, soloEntreSemana: 2,
                  pct: { siempre: 22, deNoche: 56, sabado: 78, domingo: 67, soloEntreSemana: 22 },
                  suficiente: true, ejemplos24h: ['Droguería La 7', 'Estación Terpel'],
                  lectura: 'La calle sigue viva de noche: 56 % de los locales con horario cierra después de las 8 p.m.',
                  notaIlegible: '1 horario declarado no se pudo leer y queda fuera de la cuenta.' },
      // Siete categorías a propósito: es el peor caso del donut que se quitó.
      usoPredominante: { residencial: 38, comercial: 27, servicios: 12,
                         institucional: 9, mixto: 7, industrial: 5, ambiental: 2 },
      porGrupo: { vivienda: 90, comercio: 140, salud: 12, cultura: 30, servicios: 55, ambiente: 4 },
      topPorGrupo: {}
    },
    /* Los anillos están armados para probar la trampa del área.
       Un anillo de 1 km tiene once veces la superficie de uno de 300 m, así
       que CUALQUIER conteo crudo sube al alejarse: contar más cosas en un
       círculo más grande no dice nada del sitio. Por eso el dibujo divide
       por hectárea, y acá los equipamientos van 4 → 9 → 34 —el conteo sube
       sin discusión— mientras su densidad baja: 0,14 → 0,11 → 0,11 por ha.
       Si alguien vuelve a graficar el conteo crudo, esta suite lo dice.

       El comercio hace lo contrario y también en densidad, para que la
       lectura no se pueda cablear a «baja» y seguir pasando.              */
    multiRadio: {
      lectura: 'Lectura de prueba.',
      anillos: [
        anillo(300,  96.0,   30,  4,  6200),
        anillo(500,  73.5,  240,  9,  9800, true),
        anillo(1000, 41.0, 1900, 34, 22000)
      ]
    },
    viabilidad: { score: 68, nivel: 'Media', argumentos: ['Argumento de prueba'], subscores: null },
    foda: { fortalezas: ['F'], debilidades: ['D'], oportunidades: ['O'], riesgos: ['R'] }
  };
}

const GUARDADOS = CIFRAS.map(function (c, i) {
  return { id: 'aia_prueba_' + i, nombre: c[0], ciudad: 'Cúcuta',
           fechaISO: '2026-09-0' + (i + 1) + 'T12:00:00.000Z',
           lat: C.lat, lng: C.lng, radioM: 500, modo: 'simple', usosMixto: [], config: {},
           resultado: resultado(c[0], c[1], c[2], c[3], c[4], c[5]) };
});

/* ── El recuento, hecho aparte ───────────────────────────────────────────
   La misma regla que la pantalla, escrita otra vez acá: la referencia sale
   de los guardados MENOS el que se está mirando, y solo se muestra con tres
   o más para comparar. Si mañana alguien afloja el mínimo o se le olvida
   excluir el actual, esto no cuadra.                                      */
const REF_MINIMO = 3;
function refEsperada(col) {
  const yo = CIFRAS.find(c => c[0] === ABIERTO)[col];
  const otros = CIFRAS.filter(c => c[0] !== ABIERTO).map(c => c[col]).sort((a, b) => a - b);
  if (otros.length < REF_MINIMO) return null;
  const min = otros[0], max = otros[otros.length - 1];
  if (yo > max) return 'el más alto de tus ' + (otros.length + 1);
  if (yo < min) return 'el más bajo de tus ' + (otros.length + 1);
  return 'por encima de ' + otros.filter(v => v < yo).length + ' de ' + otros.length;
}

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') }));
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/overpass|tile\./, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"elements":[]}' }));

  async function abrir(guardados) {
    await ctx.clearCookies();
    const pg = await ctx.newPage();
    const errores = [];
    pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
    await pg.addInitScript(g => {
      try {
        localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'urbisprocity', rol: 'admin', es_admin: true, session_token: 't' }));
        localStorage.setItem('aia_analisis_guardados_v1', JSON.stringify(g));
      } catch (e) {}
    }, guardados);
    await pg.goto(E.ESTATICO + '/analisis-ia.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2200);
    await pg.evaluate(() => document.querySelector('.aia-tab[data-tab="guardados"]').click());
    await pg.waitForTimeout(500);
    const abrio = await pg.evaluate(n => {
      const card = Array.from(document.querySelectorAll('.aia-guardado-card'))
        .find(c => (c.textContent || '').indexOf(n) === 0 || (c.querySelector('b') || {}).textContent === n);
      if (!card) return false;
      card.querySelector('[data-abrir]').click();
      return true;
    }, ABIERTO);
    await pg.waitForTimeout(900);
    return { pg, errores, abrio };
  }

  // ══ 1 · Con cuatro guardados: cada KPI con su referencia ═══════════════
  const A = await abrir(GUARDADOS);
  chk(A.abrio, 'el análisis guardado se abre desde «Mis análisis»');

  const r = await A.pg.evaluate(() => {
    const kpis = Array.from(document.querySelectorAll('#aia-kpis .aia-kpi')).map(k => ({
      valor: (k.querySelector('b') || {}).textContent || '',
      etq: (k.querySelector('small') || {}).textContent || '',
      ref: (k.querySelector('.urb-ref em') || {}).textContent || '',
      // Se lee a la defensiva: contra el código anterior nada de esto existe,
      // y una suite que revienta no reporta, solo se cae.
      marca: ((k.querySelector('.urb-ref-riel i') || {}).style || {}).left || ''
    }));
    const comp = document.getElementById('aia-composicion') || document.createElement('div');
    const tramos = Array.from(comp.querySelectorAll('.aia-comp-tramo')).map(t => ({
      uso: t.dataset.uso,
      ancho: parseFloat(t.style.width),
      color: getComputedStyle(t).backgroundColor
    }));
    const minis = Array.from(document.querySelectorAll('.urb-anillo-mini')).map(f => ({
      titulo: (f.querySelector('figcaption') || {}).textContent || '',
      cifra: ((f.querySelector('b') || {}).textContent || '').replace(/\/ha$/, ''),
      forma: (f.querySelector('.urb-anillo-forma') || {}).textContent || '',
      trazos: f.querySelectorAll('path').length,
      marcaActual: f.querySelectorAll('circle').length
    }));
    const cv = id => document.getElementById(id);
    // El orden en que Chart.js recibió las barras, leído del propio gráfico.
    let barras = null;
    try {
      const ch = Object.values(Chart.instances || {}).find(x => x.config.type === 'bar');
      if (ch) barras = ch.data.datasets[0].data.slice();
    } catch (e) {}
    return {
      kpis: kpis,
      tramos: tramos,
      leyenda: Array.from(comp.querySelectorAll('.aia-comp-leyenda li b')).map(x => x.textContent),
      minis: minis,
      hayDonut: !!cv('aia-chart-donut'), hayRadar: !!cv('aia-chart-radar'),
      hayBarras: !!cv('aia-chart-barras'),
      barras: barras,
      hayTablaRadios: !!document.querySelector('.aia-tbl-radios'),
      horarios: (function(){
        const c = document.getElementById('aia-flujo') || document.createElement('div');
        return {
          cobertura: (c.querySelector('.urb-cobertura') || {}).textContent || '',
          filas: Array.from(c.querySelectorAll('.urb-horarios li')).map(li => ({
            etq: (li.querySelector('span') || {}).textContent || '',
            n: (li.querySelector('em') || {}).textContent || '',
            pct: (li.querySelector('small') || {}).textContent || '',
            ancho: ((li.querySelector('i b') || {}).style || {}).width || ''
          })),
          txt: c.innerText
        };
      })(),
      txt: document.getElementById('aia-tab-nuevo').innerText
    };
  });

  console.log('\n── Los KPIs y su referencia ────────────────────────');
  r.kpis.forEach(k => console.log('  ' + k.valor + '  ' + k.etq + (k.ref ? '   → ' + k.ref : '')));

  const kpiDe = t => r.kpis.find(k => k.etq.indexOf(t) === 0) || {};
  [['Usos identificados', 1], ['Usos por hectárea', 2], ['Vías arterias', 4], ['Paradas transporte', 5]]
    .forEach(([etq, col]) => {
      const esperado = refEsperada(col);
      chk(kpiDe(etq).ref === esperado,
          'la referencia de «' + etq + '» coincide con el recuento (' + kpiDe(etq).ref + ' · esperado ' + esperado + ')');
    });

  // El sector no se compara consigo mismo: son cuatro guardados, así que la
  // referencia habla de TRES. Si se incluyera a sí mismo diría cuatro, y un
  // sector siempre empataría consigo mismo.
  chk(r.kpis.filter(k => k.ref).every(k => !/ de 4$/.test(k.ref)),
      'ninguna referencia se compara contra el propio sector abierto');
  chk(r.kpis.filter(k => k.ref).every(k => /^\d+(\.\d+)?%$/.test(k.marca)),
      'y cada una ubica el valor en el riel con un porcentaje');

  console.log('\n── De qué está hecho el sector ─────────────────────');
  console.log('  ' + r.tramos.map(t => t.uso + ' ' + t.ancho + '%').join(' · '));
  chk(r.tramos.length === 7, 'las siete categorías salen en una sola barra apilada (' + r.tramos.length + ')');
  chk(r.tramos.every((t, i) => !i || r.tramos[i - 1].ancho >= t.ancho),
      'ordenadas de mayor a menor, no en el orden del archivo');
  chk(Math.abs(r.tramos.reduce((a, t) => a + t.ancho, 0) - 100) < 0.5,
      'y los anchos suman el 100 % (' + r.tramos.reduce((a, t) => a + t.ancho, 0) + ')');
  chk(new Set(r.tramos.map(t => t.color)).size === r.tramos.length,
      'cada categoría con su propio color, ninguno repetido');
  chk(r.leyenda.length === 7 && r.leyenda[0] === 'Residencial',
      'con leyenda en el mismo orden (' + r.leyenda.join(', ') + ')');
  chk(!r.hayDonut, 'el donut de siete porciones ya no está');

  console.log('\n── El entorno según la distancia ───────────────────');
  r.minis.forEach(m => console.log('  ' + m.titulo + ' → ' + m.forma));
  chk(r.minis.length === 4, 'los anillos se dibujan, uno por métrica (' + r.minis.length + ')');
  chk(r.minis.every(m => m.trazos >= 2), 'cada uno con su área y su línea');
  chk(r.minis.every(m => m.marcaActual === 1), 'y con el anillo analizado marcado');
  const forma = t => (r.minis.find(m => m.titulo.indexOf(t) === 0) || {}).forma;
  chk(forma('Usos por hect') === 'baja al alejarse',
      'la densidad que cae al alejarse se lee como núcleo (' + forma('Usos por hect') + ')');
  chk(forma('Comercio') === 'sube al alejarse',
      'y la que crece se lee al revés, en el mismo panel (' + forma('Comercio') + ')');
  // La trampa del área: los equipamientos pasan de 4 a 34, y aun así por
  // hectárea BAJAN. Un gráfico de conteos crudos diría «sube» y estaría
  // describiendo el tamaño del círculo, no el barrio.
  chk(forma('Equipamientos') === 'baja al alejarse',
      'un conteo que sube pero se diluye por hectárea se lee como lo que es: baja (' +
      forma('Equipamientos') + ')');
  chk(r.hayTablaRadios, 'la tabla con los números exactos sigue debajo del dibujo');
  // Los equipamientos de este sector son 0,115 por hectárea. Con un solo
  // decimal se leen «0,1», que no distingue 0,05 de 0,14 — y es justo el
  // rango de lo escaso, donde el dato importa más.
  const cifra = t => (r.minis.find(m => m.titulo.indexOf(t) === 0) || {}).cifra;
  chk(/^0\.1[0-9]$/.test(cifra('Equipamientos')),
      'una densidad menor que 1 no se redondea hasta perderse (' + cifra('Equipamientos') + ')');

  /* ── El horario declarado (v804) ───────────────────────────────────────
     `opening_hours` llegaba en los datos desde siempre y nadie lo leía. Las
     franjas que ya existían son una ESTIMACIÓN por tipo de uso; esto es lo
     que dice el letrero, y las dos juntas son la mitad del ejercicio. */
  const H = r.horarios;
  console.log('\n── Lo que dice el letrero ──────────────────────────');
  console.log('  ' + H.cobertura);
  H.filas.forEach(f => console.log('  ' + f.etq.padEnd(30) + f.n.padStart(3) + '  ' + f.pct));
  chk(/9 de 16/.test(H.cobertura) && /56 %/.test(H.cobertura),
      'la cobertura va primero: cuántos declaran horario de cuántos (' + H.cobertura.slice(0, 40) + ')');
  const filaDe = t => H.filas.find(f => f.etq.indexOf(t) === 0) || {};
  chk(filaDe('Abren después').n === '5' && filaDe('Abren después').pct === '56%',
      'el porcentaje sale sobre los que declaran, no sobre el sector (5 de 9 = 56 %, no 31 %)');
  chk(filaDe('Abren domingo').n === '6' && filaDe('Solo de lunes').n === '2',
      'domingo y solo-entre-semana salen con su cuenta');
  chk(filaDe('Abren 24 horas').n === '2' && /Droguería La 7/.test(H.txt),
      'los de 24 horas se cuentan y se nombran');
  chk(filaDe('Abren después').ancho === '56%',
      'y la barra mide el porcentaje, no el conteo (' + filaDe('Abren después').ancho + ')');
  chk(/no se pudo leer/.test(H.txt),
      'el horario que el lector no entendió se declara en vez de callarse');
  chk(/declarado en el mapa/.test(H.txt),
      'y va rotulado como declarado, para no confundirlo con las franjas estimadas');
  /* Este análisis de prueba NO trae flujo —`movilidad.flujo` es null— y el
     bloque sale igual. No es un detalle del fixture: el horario y el flujo
     son datos distintos, y hasta la v804 el bloque colgaba del `if (!f)
     return` de renderFlujo, así que un sector sin flujo perdía también sus
     horarios por un dato que no tiene que ver con ellos. */
  chk(H.filas.length >= 4,
      'y sale aunque el análisis no traiga flujo: son dos datos distintos (' + H.filas.length + ' filas)');

  console.log('\n── Lo que se quitó ─────────────────────────────────');
  chk(!r.hayRadar, 'el radar que repetía las barras ya no está');
  chk(r.hayBarras && Array.isArray(r.barras) && r.barras.length === 6,
      'las barras siguen, con los seis grupos con datos');
  chk(r.barras && r.barras.every((v, i) => !i || r.barras[i - 1] >= v),
      'y ahora ordenadas de mayor a menor: ' + (r.barras || []).join(' ≥ '));

  chk(A.errores.length === 0, 'sin errores de página' + (A.errores.length ? ': ' + A.errores[0] : ''));
  await A.pg.close();

  // ══ 2 · Con dos guardados: la referencia se calla ══════════════════════
  // Con uno o dos, «por encima de 1 de 2» es ruido con forma de dato.
  const B = await abrir(GUARDADOS.slice(2));
  const pocos = await B.pg.evaluate(() => ({
    refs: document.querySelectorAll('#aia-kpis .urb-ref').length,
    kpis: document.querySelectorAll('#aia-kpis .aia-kpi').length
  }));
  console.log('\n── Con solo dos análisis guardados ─────────────────');
  console.log('  ' + pocos.kpis + ' KPIs · ' + pocos.refs + ' referencias');
  chk(B.abrio && pocos.kpis > 0, 'el análisis abre igual con pocos guardados');
  chk(pocos.refs === 0, 'y no se inventa una referencia con menos de tres para comparar (' + pocos.refs + ')');
  chk(B.errores.length === 0, 'sin errores de página con pocos guardados' + (B.errores.length ? ': ' + B.errores[0] : ''));
  await B.pg.close();

  await b.close();

  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
