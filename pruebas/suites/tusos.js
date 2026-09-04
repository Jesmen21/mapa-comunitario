const E = require('../entorno.js');
// Los nueve patrones que URBIS acumuló sin categoría, tal como los reportó.
// Cada uno debe caer donde corresponde y NINGUNO puede volver a "otro".
/* El motor ya no se sirve al navegador: vive en el repo privado y acá se
   carga directamente en node. La prueba es la misma; lo que sobraba era el
   navegador. */
const MOTOR = require('../motor-local.js');
(async () => {

  const CASOS = [
    { n: 1, veces: 8, esperado: 'servicios',
      tags: { amenity:'bicycle_rental' } },
    { n: 2, veces: 6, esperado: 'institucional',
      tags: { building:'multiusos', 'building:levels':'1', height:'3' } },
    { n: 3, veces: 6, esperado: 'vivienda', sub: 'asentamiento',
      tags: { population:'300', tourism:'camp_site', name:'Asentamiento Indígena de Yukpa' } },
    { n: 4, veces: 4, esperado: 'comercio', sub: 'salon_eventos',
      tags: { amenity:'events_venue', internet_access:'no', 'not:building':'yes',
              operator:'Administración', name:'Salón de eventos' } },
    { n: 5, veces: 2, esperado: 'comercio', sub: 'camping',
      tags: { tourism:'camp_site' } },
    { n: 6, veces: 2, esperado: 'servicios',
      tags: { access:'yes', amenity:'waste_disposal', operator:'veolia', waste:'trash', name:'Veolia' } },
    { n: 7, veces: 2, esperado: 'comercio',
      tags: { building:'cabin', name:'Comercial La Ceiba' } },
    { n: 8, veces: 2, esperado: 'cultura',
      tags: { amenity:'events_venue', building:'yes', ele:'6',
              wikimedia_commons:'Category:Torre del Reloj, Cúcuta',
              name:'Centro Cultural Torre del Reloj' } },
    { n: 9, veces: 1, esperado: 'industria',
      tags: { building:'bakehouse', 'building:levels':'1', name:'Distribuidora Tochepan SAS' } }
  ];

  // Casos de control: lo que NO debe romperse al abrir la mano con el nombre.
  const CONTROL = [
    { que: 'un camping de verdad sigue siendo camping',
      tags: { tourism:'camp_site', name:'Camping El Lago' }, esperado:'comercio', sub:'camping' },
    { que: 'una cabaña sin nombre comercial sigue siendo vivienda',
      tags: { building:'cabin' }, esperado:'vivienda', sub:'residencial' },
    { que: 'una droguería con nombre raro sigue siendo droguería',
      tags: { amenity:'pharmacy', name:'Distribuidora de Medicamentos SAS' }, esperado:'salud', sub:'drogueria' },
    { que: 'un cicloparqueadero no se confunde con bici pública',
      tags: { amenity:'bicycle_parking' }, esperado:'servicios', sub:'transporte' },
    { que: 'Smart Fit sigue ganando por marca sobre la etiqueta débil',
      tags: { building:'yes', name:'Smart Fit Prados del Este' }, esperado:'vivienda', sub:'gimnasio' }
  ];

  const r = (({ CASOS, CONTROL }) => {
    const M = MOTOR;
    const cl = t => { const c = M.clasificarPOI(t); return { sub:c.sub, grupo:c.grupo, nombre:c.nombre }; };
    return { casos: CASOS.map(c => Object.assign({}, c, { got: cl(c.tags) })),
             control: CONTROL.map(c => Object.assign({}, c, { got: cl(c.tags) })),
             // La bici pública tiene que contar como generadora de peatones.
             generaPeaton: (function () {
               const centro = { lat: 7.9168, lng: -72.4727 };
               const el = (tags, d) => ({ type:'node', id: Math.random(), tags,
                 lat: centro.lat + d / 110540, lon: centro.lng });
               const sin = M.calcularStats([el({ building:'house' }, 100)], 500, centro);
               const con = M.calcularStats([el({ building:'house' }, 100),
                                            el({ amenity:'bicycle_rental' }, 120)], 500, centro);
               return { sin: sin.movilidad.flujo.peatonal, con: con.movilidad.flujo.peatonal };
             })() };
  })({ CASOS, CONTROL });

  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  console.log('#  veces  patrón                                    → grupo         subcategoría');
  console.log('─'.repeat(92));
  r.casos.forEach(c => {
    const clave = Object.keys(c.tags).filter(k => k !== 'name')[0];
    const etq = clave + '=' + c.tags[clave];
    console.log(String(c.n).padEnd(3) + String(c.veces).padEnd(7) +
                etq.padEnd(42) + '→ ' + c.got.grupo.padEnd(15) + c.got.nombre);
  });
  console.log();

  r.casos.forEach(c => {
    chk(c.got.grupo !== 'otro', 'el patrón ' + c.n + ' ya no cae en "otro"');
    chk(c.got.grupo === c.esperado,
        '  ' + c.n + ' → ' + c.esperado + (c.got.grupo === c.esperado ? '' :
        ' (dio ' + c.got.grupo + ')'));
    if (c.sub) chk(c.got.sub === c.sub,
        '  ' + c.n + ' como "' + c.sub + '"' + (c.got.sub === c.sub ? '' : ' (dio ' + c.got.sub + ')'));
  });

  console.log('\nControl — que abrir la mano con el nombre no rompa lo que ya andaba:');
  r.control.forEach(c => {
    const bien = c.got.grupo === c.esperado && (!c.sub || c.got.sub === c.sub);
    chk(bien, c.que + (bien ? '' : ' (dio ' + c.got.grupo + '/' + c.got.sub + ')'));
  });

  chk(r.generaPeaton.con > r.generaPeaton.sin,
      'la estación de bici pública suma flujo peatonal (' +
      r.generaPeaton.sin + ' → ' + r.generaPeaton.con + ')');

  console.log('\n' + ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));

  process.exit(fallo.length ? 1 : 0);
})();
