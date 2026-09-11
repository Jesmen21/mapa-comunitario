/* URBIS · Dónde está cada cosa, para las pruebas de navegador
   ────────────────────────────────────────────────────────────────────────
   Las suites de pruebas vivían en el directorio temporal de la sesión que
   las escribió. Funcionaban, pero se iban con la sesión: cada vez que
   alguien retomaba el proyecto se encontraba con un `pruebas/` que solo
   tenía el revisor estático, y las cuarenta y tantas comprobaciones de
   comportamiento había que reescribirlas o darlas por perdidas.

   Ahora están en el repositorio. Lo único que no puede estar acá es lo que
   no es del proyecto: el navegador, los paquetes de terceros y las
   direcciones de los dos servidores locales. Todo eso se resuelve por
   variable de entorno, con los valores de una máquina de desarrollo como
   omisión, para que correrlas siga siendo `node pruebas/correr.js` y ya. */
'use strict';

const path = require('path');
const RAIZ = path.resolve(__dirname, '..');

/* El directorio de trabajo: de ahí salen los paquetes (playwright, leaflet,
   chart.js) y ahí van las capturas y los HTML que algunas pruebas dejan para
   poder mirarlos después. No se versiona: son artefactos, no fuentes. */
const TRABAJO = process.env.URBIS_PRUEBAS_TRABAJO ||
  path.join(RAIZ, '..', 'urbis-pruebas');

/* Esperar a que la aplicación esté ARMADA, en vez de a que pase un rato.

   Las suites arrancaban con un `waitForTimeout(3400)` y con eso alcanzaba
   casi siempre. «Casi siempre» es el problema: corriendo cuatro navegadores
   en paralelo, de vez en cuando Leaflet todavía no había puesto el mapa y la
   suite caía con «map.on is not a function» —un rojo que no era una
   regresión—. Una prueba que falla al azar enseña a ignorar los rojos, que
   es lo peor que le puede pasar a un banco de pruebas.

   Se espera a la condición: el mapa existe y responde. Y se le pone tope,
   porque una espera sin límite convierte un fallo en un cuelgue. */
async function esperarLaApp(pg, msTope) {
  await pg.waitForFunction(function () {
    /* La pantalla de bienvenida tapa TODO durante tres segundos y medio, y
       después se quita sola. Una suite que empiece antes toca el splash y no
       la aplicación: los clics no llegan, y lo que se ve es una prueba que
       falla por algo que no tiene nada que ver. Casi me manda a arreglar un
       botón de deshacer que estaba bien. */
    var sp = document.getElementById('urbis-beta-splash');
    if (sp && getComputedStyle(sp).pointerEvents !== 'none') return false;
    return !!(window.map && typeof window.map.on === 'function' &&
              window.URBIS_PC_RECON && window.URBIS_CONFIG);
  }, null, { timeout: msTope || 20000 });
  // Un respiro corto para los módulos que se enganchan al mapa recién creado.
  await pg.waitForTimeout(400);
}

/* ── El DANE de mentira, que contesta como el de verdad ─────────────────
   Cada suite se armaba su propia respuesta del censo, y casi todas la
   resolvían con `{ TOTAL: 3045, N: 42 }`. Eso alcanza para la población del
   sector y para nada más: la consulta de demografía pide `SEXO_M`, `SEXO_H` y
   los veintiún tramos de edad, y al no venir ninguno `demografia()` devuelve
   null. Resultado: **el panel «Quién vive acá» —la pirámide, el reparto por
   sexo, el índice de envejecimiento— no se dibujaba en ninguna prueba del
   pliego**, y lo que no se dibuja no se mide. Cincuenta y siete suites
   analizaban un sector sin una sola persona con edad.

   La clave de que esto sea un doble FIEL y no otro atajo: el servicio de Esri
   contesta SOLO los campos que la consulta pidió, en `outStatistics`. Acá se
   hace igual —se lee la consulta y se responde a la medida—, así que una
   petición mal armada por la aplicación sigue saliendo vacía, como saldría
   contra el servicio real. Un doble que contesta de más esconde justo el
   fallo que hay que ver. */
const PIRAMIDE = [
  /* Reparto por edad de un sector urbano colombiano corriente, en tanto por
     mil de la población: base ancha que se adelgaza, con el escalón de los
     veinte a los treinta y cuatro que dejan la migración y el estudio. Suma
     1.000; lo que sobre por redondeo se le da al tramo mayor. */
  ['0_4', 72], ['5_9', 76], ['10_14', 78], ['15_19', 82], ['20_24', 88],
  ['25_29', 85], ['30_34', 78], ['35_39', 71], ['40_44', 64], ['45_49', 58],
  ['50_54', 53], ['55_59', 46], ['60_64', 38], ['65_69', 29], ['70_74', 22],
  ['75_79', 15], ['80_84', 9], ['85_89', 4], ['90_94', 2], ['95_99', 1],
  ['100_O_MAS', 29]
];

/* El sector de censo por omisión. Se puede pisar entero desde la suite: lo
   que importa es que los campos existan y sean coherentes entre sí —la suma
   de los tramos tiene que dar la población, y mujeres más hombres también—,
   porque hay comprobaciones de coherencia en la lámina que justamente miran
   eso y con cifras inventadas a mano fallarían por el fixture y no por el
   código. */
const CENSO = { poblacion: 3045, manzanas: 42, viviendas: 880, pctMujeres: 51.1, estrato: 3 };

/* Los campos que la capa del censo DECLARA. Desde la v865 la aplicación se
   los pregunta (`?f=json`) en vez de suponer qué trae, así que el doble
   tiene que saber contestar esa pregunta: si no, el módulo cree que no pudo
   preguntar y lo dice, que es un tercer estado distinto de «no lo tiene».

   Por omisión se devuelve una capa CON escolaridad y alfabetismo y SIN
   hogares ni etnia: así una sola corrida ejercita los dos caminos —el que
   cuenta y el que declara la ausencia con la lista de campos como prueba—.
   `camposDane: []` simula una capa pelada y `camposDane: null`, un servicio
   que no contesta sus metadatos. */
const CAMPOS_DANE = [
  { name: 'OBJECTID', alias: 'OBJECTID', type: 'esriFieldTypeOID' },
  { name: 'SEXO_M', alias: 'Mujeres', type: 'esriFieldTypeInteger' },
  { name: 'SEXO_H', alias: 'Hombres', type: 'esriFieldTypeInteger' },
  { name: 'ESCOLARIDAD_NINGUNA', alias: 'Sin nivel educativo', type: 'esriFieldTypeInteger' },
  { name: 'ESCOLARIDAD_PRIMARIA', alias: 'Primaria', type: 'esriFieldTypeInteger' },
  { name: 'ESCOLARIDAD_SECUNDARIA', alias: 'Secundaria', type: 'esriFieldTypeInteger' },
  { name: 'ESCOLARIDAD_SUPERIOR', alias: 'Superior o posgrado', type: 'esriFieldTypeInteger' },
  { name: 'ALFABETISMO_SI', alias: 'Sabe leer y escribir', type: 'esriFieldTypeInteger' },
  { name: 'ALFABETISMO_NO', alias: 'No sabe leer ni escribir', type: 'esriFieldTypeInteger' }
];
/* Cuánta gente cae en cada uno, en tanto por mil, para que cuadre con la
   población igual que la pirámide. */
const REPARTO_CAMPOS = {
  ESCOLARIDAD_NINGUNA: 62, ESCOLARIDAD_PRIMARIA: 288, ESCOLARIDAD_SECUNDARIA: 431,
  ESCOLARIDAD_SUPERIOR: 219, ALFABETISMO_SI: 938, ALFABETISMO_NO: 62
};

function atributosDane(url, censo) {
  const c = Object.assign({}, CENSO, censo || {});
  const u = new URL(url, 'http://x');
  const crudo = u.searchParams.get('outStatistics');
  const campos = u.searchParams.get('outFields') || '';
  // La consulta de manzanas con su estrato: trae geometría, no agregados.
  if (/ESTRATO_PREDOMINANTE/.test(campos)) return null;
  if (!crudo) return {};
  let piden;
  try { piden = JSON.parse(crudo); } catch (e) { return {}; }
  // La capa de VIVIENDAS pide el mismo `TOTAL` que la de personas; lo que
  // cambia es de qué capa se pide. Sin esto, un sector salía con tantas
  // viviendas como habitantes y la razón personas/vivienda daba 1,0 —que es
  // uno de los siete chequeos de coherencia de la lámina—.
  const esVivienda = /viviendas/i.test(u.pathname);
  const mujeres = Math.round(c.poblacion * c.pctMujeres / 100);
  const out = {};
  piden.forEach(function (p) {
    const k = p.outStatisticFieldName, de = String(p.onStatisticField || '');
    if (k === 'TOTAL') out[k] = esVivienda ? c.viviendas : c.poblacion;
    else if (k === 'N') out[k] = c.manzanas;
    else if (k === 'MUJ') out[k] = mujeres;
    else if (k === 'HOM') out[k] = c.poblacion - mujeres;
    else if (REPARTO_CAMPOS[de] != null) out[k] = Math.round(c.poblacion * REPARTO_CAMPOS[de] / 1000);
    else if (/^EDAD_/.test(de)) {
      const t = de.replace(/^EDAD_/, '');
      const fila = PIRAMIDE.filter(function (x) { return x[0] === t; })[0];
      out[k] = fila ? Math.round(c.poblacion * fila[1] / 1000) : 0;
    } else out[k] = 0;
  });
  return out;
}

/* Instala la ruta en el contexto de Playwright. Una línea por suite:
     await E.rutaDane(ctx);                 // el sector por omisión
     await E.rutaDane(ctx, { poblacion: 12000, pctMujeres: 53 });
   Para el caso de «el censo no cubre acá», `{ vacio: true }`. */
async function rutaDane(ctx, censo) {
  await ctx.route(/ags\.esri\.co/, function (r) {
    /* La consulta de METADATOS: la capa sin `/query`, con `f=json`. Va
       primero porque no lleva `outStatistics`, y sin atenderla acá caería en
       la rama de agregados y devolvería un objeto vacío, que el módulo leería
       como «no se pudo preguntar» —otro estado, otra cosa—. */
    if (!/\/query/.test(r.request().url())) {
      const cs = (censo && censo.camposDane !== undefined) ? censo.camposDane : CAMPOS_DANE;
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(cs === null ? { error: { code: 500 } } : { fields: cs }) });
    }
    const cuerpo = (censo && censo.vacio)
      ? { features: [] }
      : (function () {
          const at = atributosDane(r.request().url(), censo);
          // Sin agregados pedidos es la consulta de manzanas con geometría:
          // se contesta sin rasgos, que es lo que hacía el mock de antes.
          return at === null ? { features: [] } : { features: [{ attributes: at }] };
        })();
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
  });
}

module.exports = {
  esperarLaApp: esperarLaApp,
  rutaDane: rutaDane,
  atributosDane: atributosDane,
  CAMPOS_DANE: CAMPOS_DANE,
  CENSO: CENSO,
  RAIZ: RAIZ,
  TRABAJO: TRABAJO.replace(/\/*$/, '/'),
  MODULOS: process.env.URBIS_PRUEBAS_MODULOS || path.join(TRABAJO, 'node_modules'),
  CHROMIUM: process.env.URBIS_CHROMIUM ||
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // El servidor estático que sirve el repositorio. El motor solo acepta
  // peticiones de orígenes conocidos y este es uno de ellos: cambiarlo de
  // puerto sin avisarle al motor deja los análisis sin respuesta.
  ESTATICO: process.env.URBIS_ESTATICO || 'http://localhost:8199',
  MOTOR: process.env.URBIS_MOTOR || 'http://localhost:8787',
  // El repositorio privado del motor, para las pruebas que cargan sus reglas
  // sin pasar por la red.
  MOTOR_REPO: process.env.URBIS_MOTOR_REPO || path.join(RAIZ, '..', 'urbis-motor')
};
