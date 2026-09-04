const E = require('../entorno.js');
// COBERTURA DE LA MATRIZ DE USOS
//
// No se puede bajar Cúcuta desde este entorno (el proxy bloquea todos los
// hosts de OpenStreetMap), pero el problema de fondo no es tener LOS datos:
// es si la taxonomía sabe clasificar todo lo que puede venir en ellos. Una
// descarga muestra lo que hay hoy en un radio; esto recorre el vocabulario
// completo, y por eso es la prueba más dura de las dos.
//
// Si alguien añade una regla que se come a otra, este test lo caza.
/* El motor ya no se sirve al navegador: vive en el repo privado y acá se
   carga directamente en node (ver motor-local.js). La prueba es la misma; lo
   único que aportaba el navegador era la etiqueta <script>. */
const MOTOR = require('../motor-local.js');
const VOCAB = require('./vocab-osm.js');

(async () => {

  const r = ((VOCAB) => {
    const M = MOTOR;
    const filas = [];
    Object.keys(VOCAB).forEach(clave => VOCAB[clave].forEach(valor => {
      const tags = {}; tags[clave] = valor;
      const c = M.clasificarPOI(tags);
      filas.push({ clave, valor, sub: c.sub, grupo: c.grupo, nombre: c.nombre });
    }));
    // Y los usos que el cliente nombró uno por uno, tal como se mapean de
    // verdad: lo de adentro de un centro comercial, y el espacio público.
    const PUNTUALES = [
      { q:'almacén de ropa del centro comercial', t:{ shop:'clothes', name:'Studio F' },        esp:'ropa' },
      { q:'cajero dentro del centro comercial',   t:{ amenity:'atm', name:'Cajero Bancolombia' }, esp:'banco' },
      { q:'cine del centro comercial',            t:{ amenity:'cinema', name:'Cinemark' },      esp:'cultural' },
      { q:'zapatería',                            t:{ shop:'shoes' },                            esp:'ropa' },
      { q:'el centro comercial en sí',            t:{ shop:'mall', name:'Ventura Plaza' },      esp:'centro_comercial' },
      { q:'plaza / espacio público',              t:{ place:'square', name:'Plaza Colón' },     esp:'plaza' },
      { q:'parque',                               t:{ leisure:'park', name:'Parque Santander' },esp:'parque' },
      { q:'Juan Valdez',                          t:{ amenity:'cafe', name:'Juan Valdez Café' },esp:'cafeteria' },
      { q:'Tostao (cafetería de barrio)',         t:{ shop:'coffee', name:'Tostao Café & Pan' },esp:'cafeteria' },
      { q:'gimnasio de cadena',                   t:{ leisure:'sports_centre', name:'Smart Fit' }, esp:'gimnasio' },
      { q:'estudio de yoga sin leisure',          t:{ sport:'yoga', name:'Shanti' },            esp:'gimnasio' },
      { q:'cancha de fútbol',                     t:{ sport:'soccer' },                          esp:'deportivo' },
      { q:'almacén deportivo (shop manda)',       t:{ shop:'sports', sport:'soccer' },           esp:'tienda_deportes' },
      { q:'peluquería',                           t:{ shop:'hairdresser' },                      esp:'belleza' },
      { q:'ferretería',                           t:{ shop:'hardware' },                         esp:'ferreteria' },
      { q:'taller de motos',                      t:{ shop:'motorcycle_repair' },                esp:'automotriz' },
      { q:'óptica',                               t:{ shop:'optician' },                         esp:'optica' },
      { q:'papelería',                            t:{ shop:'stationery' },                       esp:'papeleria' },
      { q:'local desocupado',                     t:{ shop:'vacant' },                           esp:'local_vacio' },
      { q:'edificación en ruina',                 t:{ building:'ruins' },                        esp:'ruina' },
      { q:'hogar geriátrico',                     t:{ amenity:'nursing_home' },                  esp:'hogar_cuidado' }
    ];
    const puntuales = PUNTUALES.map(c => ({ q: c.q, esp: c.esp, got: M.clasificarPOI(c.t).sub }));

    // Una calle de almacenes de ropa tiene que medirse como calle con
    // vitrinas. Abrir el comercio en rubros no puede dejarla en cero.
    const centro = { lat: 7.9168, lng: -72.4727 };
    let id = 1;
    const el = (tags, d, a) => { const rad = a * Math.PI / 180;
      return { type:'node', id: id++, lat: centro.lat + (d * Math.cos(rad)) / 110540,
               lon: centro.lng + (d * Math.sin(rad)) / (111320 * Math.cos(centro.lat * Math.PI / 180)), tags }; };
    const muchos = (t, n, d) => Array.from({length:n}, (_, i) => el(t, d, i * (360 / n)));
    const calleRopa = [].concat(
      muchos({ shop:'clothes' }, 9, 120),
      muchos({ shop:'shoes' }, 5, 150),
      muchos({ shop:'hairdresser' }, 3, 170),
      muchos({ building:'apartments' }, 30, 240),
      [ el({ highway:'secondary', name:'Avenida 5' }, 60, 0) ]
    );
    const res = M.analizarHeuristico({ elementos: calleRopa, radioM: 1000, centro,
                                       tipoEstudio:'completo', proyectoId:'cafe_paso' });
    const aglo = (res.stats.movilidad.flujo.generadores || [])
      .find(g => g.sub === 'aglomeracion');

    return {
      filas,
      puntuales,
      flujoCalleRopa: res.stats.movilidad.flujo.peatonal,
      vitrinas: aglo ? aglo.n : 0,
      // Los rubros nuevos deben seguir contando como oferta comercial.
      comercioPrograma: (M.USOS_PROGRAMA.find(u => u.id === 'comercio').subs || []).length
    };
  })(VOCAB);

  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  const sinCat = r.filas.filter(f => f.grupo === 'otro');
  const pct = ((r.filas.length - sinCat.length) / r.filas.length * 100);
  console.log('══ COBERTURA ══════════════════════════════════════════════════');
  console.log('  valores del vocabulario OSM probados: ' + r.filas.length);
  console.log('  sin categoría                       : ' + sinCat.length +
              '   (' + pct.toFixed(1) + '% cubierto)');
  Object.keys(VOCAB).forEach(k => {
    const dela = r.filas.filter(f => f.clave === k);
    const mal = dela.filter(f => f.grupo === 'otro');
    console.log('    ' + k.padEnd(11) + String(dela.length).padStart(4) + ' valores · ' +
                String(mal.length).padStart(3) + ' sin categoría' +
                (mal.length ? '  ← ' + mal.map(f => f.valor).join(', ') : ''));
    chk(mal.length === 0, mal.length ? k + ' queda sin cubrir en ' + mal.length + ' valores'
                                     : k + ' cubierto por completo (' + dela.length + ' valores)');
  });
  const subs = new Set(r.filas.map(f => f.sub));
  console.log('  subcategorías distintas en uso      : ' + subs.size);
  chk(sinCat.length === 0, 'quedan ' + sinCat.length + ' valores sin categoría');
  chk(subs.size >= 60, 'la matriz distingue al menos 60 usos (distingue ' + subs.size + ')');

  console.log('\n── Los usos que el cliente nombró ─────────────────────────────');
  r.puntuales.forEach(x => {
    const bien = x.got === x.esp;
    console.log((bien ? '  ✔ ' : '  ✘ ') + x.q.padEnd(38) + '→ ' + x.got +
                (bien ? '' : '   (esperado ' + x.esp + ')'));
    chk(bien, bien ? x.q + ' → ' + x.got : x.q + ' cae en ' + x.got + ' y no en ' + x.esp);
  });

  console.log('\n── Una calle de almacenes de ropa ─────────────────────────────');
  console.log('  vitrinas contadas : ' + r.vitrinas);
  console.log('  flujo peatonal    : ' + r.flujoCalleRopa + '/100');
  chk(r.vitrinas >= 17, 'las 17 vitrinas se cuentan (cuenta ' + r.vitrinas + ')');
  chk(r.flujoCalleRopa >= 25, 'y la calle no queda medida como si estuviera vacía (' +
      r.flujoCalleRopa + ')');
  chk(r.comercioPrograma >= 18, 'el programa "Comercio" mide la oferta de todos los rubros');

  console.log('\n' + ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
