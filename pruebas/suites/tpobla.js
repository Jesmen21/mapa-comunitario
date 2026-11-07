const E = require('../entorno.js');
// PROYECCIÓN DE POBLACIÓN
//
// El censo es de 2018 y el análisis lo leía como si fuera de hoy, lo que
// subestima la demanda. Aquí se comprueba que la proyección esté bien hecha
// —crecimiento compuesto, tasa sacada de dos años de la MISMA serie— y sobre
// todo que no se pase de lista: que el dato observado no desaparezca, que la
// gráfica distinga lo medido de lo estimado, y que si no hay tasa nada se
// invente.
//
// Desde la v1174 la tabla del repositorio trae la SERIE AÑO POR AÑO del DANE y
// no dos anclas, así que la tasa sale de dos años de esa serie —el del censo y
// el de la lectura— y la población del municipio se LEE. Lo que esta suite
// mide del lado del motor no cambió: el sector se sigue trayendo con interés
// compuesto sobre esa tasa.
/* El motor ya no se sirve al navegador: vive en el repo privado y acá se
   carga directamente en node (ver motor-local.js). La prueba es la misma; lo
   único que aportaba el navegador era la etiqueta <script>. */
const MOTOR = require('../motor-local.js');
const fs = require('fs');
const REPO = E.RAIZ;

(async () => {

  const tabla = JSON.parse(fs.readFileSync(REPO + '/assets/data/dane-proyecciones.json', 'utf8'));

  const r = ((tabla) => {
    const M = MOTOR;
    const cuc = tabla.municipios['san jose de cucuta'];
    /* La tasa SALE DE LA SERIE, entre el año del censo y el año que se lee, que
       es lo mismo que hace `proyeccionDe` en js/61. Se arma acá con
       `tasaAnualDe` sobre dos puntos de esa misma serie —no sobre dos anclas de
       un esquema que ya no existe— para medir la aritmética del motor con la
       cifra que de verdad le llega. */
    const ANIO_LECTURA = 2026;
    const tasa = M.tasaAnualDe([
      { anio: cuc.anioCenso, poblacion: cuc.serie[String(cuc.anioCenso)] },
      { anio: ANIO_LECTURA, poblacion: cuc.serie[String(ANIO_LECTURA)] }
    ]);

    // Escenario: mismo entorno, con y sin tasa de proyección.
    const centro = { lat: 7.9168, lng: -72.4727 };
    let id = 1;
    const el = (tags, d, a) => { const rad = a * Math.PI / 180;
      return { type:'node', id: id++, lat: centro.lat + (d * Math.cos(rad)) / 110540,
               lon: centro.lng + (d * Math.sin(rad)) / (111320 * Math.cos(centro.lat * Math.PI / 180)), tags }; };
    const muchos = (t, n, d) => Array.from({length:n}, (_, i) => el(t, d, i * (360 / n)));
    const elementos = [].concat(
      muchos({ building:'apartments' }, 40, 250),
      muchos({ shop:'convenience' }, 6, 200),
      [ el({ highway:'trunk', name:'Anillo Vial' }, 80, 0) ]
    );
    const daneBase = { poblacion: 14369, unidades: 120, nivel:'manzana', viviendas: 4100,
                       censo: 2018, etiquetaFuente: 'Censo DANE 2018 · manzana censal' };
    const correr = extra => M.analizarHeuristico({
      elementos, radioM: 600, centro, tipoEstudio:'completo', proyectoId:'cafe_paso',
      dane: Object.assign({}, daneBase, extra) });

    const con = correr({ tasaAnual: tasa, anioProyeccion: 2026,
                         fuenteProyeccion: tabla.fuente, advertenciaProyeccion: tabla.advertencia });
    const sin = correr({});

    return {
      tasa,
      // Aritmética pura, comprobable a mano.
      compuesto8: M.proyectarPoblacion(1000, 2018, 2026, 0.10),
      unAnio: M.proyectarPoblacion(1000, 2018, 2019, 0.10),
      sinTasa: M.proyectarPoblacion(1000, 2018, 2026, null),
      con: {
        censo: con.stats.poblacionCenso, proy: con.stats.poblacionProyectada,
        usada: con.stats.poblacionEstimada, pct: con.stats.crecimientoPct,
        anio: con.stats.anioProyeccion, censoAnio: con.stats.censoAnio,
        fuente: con.stats.poblacionFuente, aviso: con.stats.advertenciaProyeccion,
        serie: con.stats.serieProyeccion,
        demanda: con.viabilidad.subscores.demanda
      },
      sin: {
        censo: sin.stats.poblacionCenso, proy: sin.stats.poblacionProyectada,
        usada: sin.stats.poblacionEstimada, fuente: sin.stats.poblacionFuente,
        serie: sin.stats.serieProyeccion
      }
    };
  })(tabla);

  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  console.log('══ LA TASA ════════════════════════════════════════════════════');
  {
    const cuc = tabla.municipios['san jose de cucuta'];
    const anios = Object.keys(cuc.serie).map(Number).sort((a, b) => a - b);
    console.log('  serie DANE Cúcuta  : ' + anios[0] + '–' + anios[anios.length - 1] +
      ' (' + anios.length + ' años) · censo ' + cuc.anioCenso + '=' + cuc.serie[String(cuc.anioCenso)] +
      ' · 2026=' + cuc.serie['2026']);
  }
  console.log('  tasa anual         : ' + (r.tasa * 100).toFixed(3) + '%');
  chk(r.tasa > 0 && r.tasa < 0.05,
      'la tasa es plausible para una ciudad colombiana (' + (r.tasa * 100).toFixed(2) + '%)');
  /* La regla que más fácil se rompe: la tasa tiene que salir de DOS AÑOS DE LA
     MISMA SERIE. Hasta la v1173 esto se demostraba contra `censoCrudo2018`, que
     ya no está en el archivo —se retiró con las anclas—, así que la trampa que
     se mide es la que queda: tomar como base un año de la serie distinto del
     que el archivo declara como el del censo cambia la tasa, y la única tasa
     que el módulo puede publicar es la del tramo DECLARADO. Se comprueba
     reproduciéndola exactamente desde la serie. */
  {
    const cuc = tabla.municipios['san jose de cucuta'];
    const rehecha = Math.pow(cuc.serie['2026'] / cuc.serie[String(cuc.anioCenso)],
                             1 / (2026 - cuc.anioCenso)) - 1;
    console.log('  rehecha de la serie: ' + (rehecha * 100).toFixed(3) + '%');
    chk(Math.abs(rehecha - r.tasa) < 1e-12,
        'la tasa se reproduce exactamente desde la serie, entre el año del censo y el leído');
    const otroTramo = Math.pow(cuc.serie['2026'] / cuc.serie['2020'], 1 / 6) - 1;
    console.log('  (desde 2020 en vez del censo daría ' + (otroTramo * 100).toFixed(3) +
                '% — otro tramo, otra tasa)');
    chk(Math.abs(otroTramo - r.tasa) > 1e-6,
        'y el tramo importa: desde otro año base la tasa es distinta, así que el tramo se declara');
  }

  console.log('\n── La aritmética ──────────────────────────────────────────────');
  console.log('  1.000 al 10% durante 8 años → ' + r.compuesto8 + ' (compuesto: 2.144)');
  chk(r.compuesto8 === 2144, 'crece compuesto, no lineal (' + r.compuesto8 + ')');
  chk(r.unAnio === 1100, 'un año al 10% son 1.100 (' + r.unAnio + ')');
  chk(r.sinTasa === null, 'sin tasa no devuelve un número inventado');

  console.log('\n── Sobre el análisis ──────────────────────────────────────────');
  console.log('  censo ' + r.con.censoAnio + ': ' + r.con.censo +
              '  →  ' + r.con.anio + ': ' + r.con.proy + '  (+' + r.con.pct + '%)');
  console.log('  fuente: ' + r.con.fuente);
  chk(r.con.proy > r.con.censo, 'la proyección es mayor que el censo');
  chk(r.con.usada === r.con.proy,
      'el análisis trabaja con la población de hoy, no con la de 2018');
  chk(r.con.censo === 14369,
      'y el dato observado no desaparece: sigue disponible por separado');
  chk(r.con.pct > 0 && r.con.pct < 15,
      'el crecimiento acumulado es razonable para ocho años (+' + r.con.pct + '%)');
  chk(/proyectado a 2026/.test(r.con.fuente),
      'la etiqueta de fuente dice que está proyectado, no lo disimula');
  chk(/MUNICIPAL/.test(r.con.aviso || ''),
      'arrastra la advertencia de que la tasa es municipal, no del barrio');

  console.log('\n── La curva ───────────────────────────────────────────────────');
  const s = r.con.serie;
  console.log('  ' + s.map(x => x.anio + (x.observado ? '*' : x.futuro ? '·' : '')).join(' '));
  chk(s.length >= 9, 'la serie cubre del censo a hoy y algo más (' + s.length + ' años)');
  chk(s[0].anio === 2018 && s[0].observado === true && s[0].poblacion === 14369,
      'arranca en el dato observado, con su valor real');
  chk(s.filter(x => x.observado).length === 1,
      'solo un punto está marcado como observado: el resto es estimación');
  chk(s.filter(x => x.futuro).length === 4,
      'y marca aparte lo que va más allá de hoy (' + s.filter(x => x.futuro).length + ' años)');
  chk(s.every((x, i) => i === 0 || x.poblacion >= s[i-1].poblacion),
      'la curva no retrocede');

  console.log('\n── Sin tasa, no se inventa nada ───────────────────────────────');
  console.log('  usada: ' + r.sin.usada + ' · fuente: ' + r.sin.fuente);
  chk(r.sin.proy === null, 'sin tasa no hay proyección');
  chk(r.sin.usada === 14369, 'se sigue trabajando con el censo tal cual');
  chk(r.sin.serie.length === 0, 'y no se dibuja ninguna curva');
  chk(!/proyectado/.test(r.sin.fuente),
      'la etiqueta no promete una proyección que no existe');

  // La tabla del repo tiene que declarar de dónde salió.
  console.log('\n── La tabla del repo ──────────────────────────────────────────');
  chk(/dane\.gov\.co/.test(tabla.url || ''), 'la tabla enlaza el archivo original del DANE');
  chk(!!tabla.notaMetodo && /omisi[oó]n censal/i.test(tabla.notaMetodo),
      'y explica por qué no se mezcla el conteo crudo con la proyección');
  {
    const cuc = tabla.municipios['san jose de cucuta'];
    const anios = Object.keys(cuc.serie || {}).map(Number).sort((a, b) => a - b);
    chk(anios.length >= 20 && anios.every((x, i) => i === 0 || x === anios[i - 1] + 1),
        'la tabla trae la serie año por año y sin huecos (' + anios.length + ' años)');
    chk(cuc.anclas === undefined && cuc.censoCrudo2018 === undefined,
        'y ya no conserva el esquema de anclas, que eran dos codificaciones de lo mismo');
    /* LAS TRES CIFRAS QUE DANIEL PIDIÓ COMPROBAR, leídas del archivo oficial
       del DANE (PPED 2018-2042, serie «Total», divipola 54001) y verificadas
       una por una contra el original descargado. */
    chk(cuc.serie['2020'] === 765533, '2020 = 765.533 (' + cuc.serie['2020'] + ')');
    chk(cuc.serie['2024'] === 790984, '2024 = 790.984 (' + cuc.serie['2024'] + ')');
    chk(cuc.serie['2026'] === 792180, '2026 = 792.180 (' + cuc.serie['2026'] + ')');
    /* Y QUE LA SERIE BAJA, que es lo que una tasa constante no puede
       representar y la razón de fondo del cambio de esquema. */
    const pico = anios.reduce((b, a) => cuc.serie[String(a)] > cuc.serie[String(b)] ? a : b, anios[0]);
    console.log('  máximo de la serie : ' + pico + ' = ' + cuc.serie[String(pico)] +
                ' · último ' + anios[anios.length - 1] + ' = ' + cuc.serie[String(anios[anios.length - 1])]);
    chk(pico < anios[anios.length - 1] &&
        cuc.serie[String(anios[anios.length - 1])] < cuc.serie[String(pico)],
        'la serie tiene su máximo antes del final y baja después: eso es lo que las dos anclas no podían decir');
  }
  chk(/2018-2042/.test(tabla.fuente || '') && !/2020-2035/.test(tabla.fuente || ''),
      'y la fuente declarada es la serie vigente, no la que el DANE reemplazó');

  console.log('\n' + ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
