const E = require('../entorno.js');
// PROYECCIÓN DE POBLACIÓN
//
// El censo es de 2018 y el análisis lo leía como si fuera de hoy, lo que
// subestima la demanda. Aquí se comprueba que la proyección esté bien hecha
// —crecimiento compuesto, tasa sacada de dos años de la MISMA serie— y sobre
// todo que no se pase de lista: que el dato observado no desaparezca, que la
// gráfica distinga lo medido de lo estimado, y que si no hay tasa nada se
// invente.
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
    const tasa = M.tasaAnualDe(cuc.anclas);

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
  console.log('  anclas DANE Cúcuta : ' +
    tabla.municipios['san jose de cucuta'].anclas.map(a => a.anio + '=' + a.poblacion).join('  →  '));
  console.log('  tasa anual         : ' + (r.tasa * 100).toFixed(3) + '%');
  chk(r.tasa > 0 && r.tasa < 0.05,
      'la tasa es plausible para una ciudad colombiana (' + (r.tasa * 100).toFixed(2) + '%)');
  // La regla que más fácil se rompe: la tasa NO puede salir de comparar el
  // conteo censal crudo con una proyección, porque entre los dos hay además
  // la corrección de omisión censal.
  const crudo = tabla.municipios['san jose de cucuta'].censoCrudo2018;
  const falsa = Math.pow(tabla.municipios['san jose de cucuta'].anclas[0].poblacion / crudo, 1 / 2) - 1;
  console.log('  (si se hubiera mezclado censo crudo con proyección: ' +
              (falsa * 100).toFixed(2) + '% — nueve veces más)');
  chk(r.tasa < falsa / 3,
      'no sale de mezclar el conteo crudo con la serie proyectada');

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
  chk((tabla.municipios['san jose de cucuta'].anclas || []).length >= 2,
      'con al menos dos anclas de la misma serie');

  console.log('\n' + ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
