const E = require('../entorno.js');
// Informe en PDF: que el punto medio del análisis caiga EXACTAMENTE donde
// está, que las dos hojas no se desborden, y que el gimsanio cercano se
// resalte por su influencia en el flujo peatonal.
const { chromium } = require(E.MODULOS + '/playwright-core');
const guionDelMotor = require('../motor-navegador.js');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM });
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(e.message));

  // Sin red: el mapa estático se sustituye por una cuadrícula de referencia
  // con una cruz EXACTA en su centro, para poder medir el desfase en píxeles.
  await pg.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    if (/staticmap/.test(u)) {
      const W = 800, H = 600;
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
        '<rect width="100%" height="100%" fill="#e6ecf1"/>' +
        '<line x1="' + (W/2) + '" y1="0" x2="' + (W/2) + '" y2="' + H + '" stroke="#c0392b" stroke-width="2"/>' +
        '<line x1="0" y1="' + (H/2) + '" x2="' + W + '" y2="' + (H/2) + '" stroke="#c0392b" stroke-width="2"/></svg>';
      return route.fulfill({ contentType:'image/svg+xml', body: svg });
    }
    return route.fulfill({ status: 200, body: '' });
  });

  await pg.setContent('<div id="x"></div>');
  /* El motor se fue al repo privado: se inyecta su paquete —el mismo que
     corre en la API— y el informe se sigue leyendo del repo público, que es
     donde vive. */
  await pg.addScriptTag({ content: guionDelMotor() });
  await pg.addScriptTag({ path: REPO + '/js/63-analisis-ia-informe.js' });

  const datos = await pg.evaluate(() => {
    const M = window.AIA_MOTOR;
    const centro = { lat: 7.916795, lng: -72.472680 };
    let id = 1;
    const el = (tags, distM, ang) => {
      const rad = ang * Math.PI / 180;
      return { type:'node', id: id++,
               lat: centro.lat + (distM * Math.cos(rad)) / 110540,
               lon: centro.lng + (distM * Math.sin(rad)) / (111320 * Math.cos(centro.lat * Math.PI / 180)),
               tags };
    };
    const muchos = (tags, n, d) => Array.from({length:n}, (_, i) => el(tags, d, i * (360 / n)));

    const elementos = [].concat(
      [ el({ leisure:'fitness_centre', name:'Smart Fit Prados del Este' }, 130, 35) ],
      [ el({ shop:'supermarket', name:'D1' }, 95, 200) ],
      [ el({ shop:'supermarket', name:'Ara' }, 250, 100) ],
      [ el({ shop:'yes', name:'Cruz Verde' }, 160, 80) ],
      muchos({ shop:'convenience', name:'Tienda' }, 6, 180),
      muchos({ shop:'bakery', name:'Panadería La Espiga' }, 2, 210),
      muchos({ amenity:'restaurant', name:'Restaurante' }, 3, 230),
      [ el({ amenity:'school', name:'Colegio San José' }, 310, 260) ],
      [ el({ amenity:'place_of_worship', name:'Parroquia' }, 280, 300) ],
      [ el({ amenity:'pharmacy', name:'Droguería' }, 200, 45) ],
      [ el({ highway:'bus_stop', name:'Parada Prados' }, 140, 150) ],
      muchos({ building:'apartments', name:'' }, 12, 200),
      muchos({ building:'house', name:'' }, 20, 260),
      [ el({ highway:'secondary', name:'Avenida Libertadores' }, 70, 0) ]
    );

    const r = M.analizarHeuristico({ elementos, radioM: 500, centro,
                                     tipoEstudio:'comercial', proyectoId:'cafe_paso',
                                     direccionAprox:'Prados del Este, Cúcuta' });
    window.__r = r;
    const html = window.AIA_INFORME.construirHTMLEjecutivo(r, {}, { estilo:'institucional', horizontal:true });

    // El caso que reporto el usuario: radio 1 km, 512 usos, estudio completo.
    // Es el que dispara la franja roja de "contenido extenso".
    const TIPOS = [
      {shop:'clothes'}, {shop:'convenience'}, {amenity:'restaurant'}, {amenity:'cafe'},
      {office:'company'}, {amenity:'bank'}, {amenity:'pharmacy'}, {shop:'hairdresser'},
      {building:'apartments'}, {building:'house'}, {amenity:'school'}, {leisure:'park'},
      {amenity:'fuel'}, {amenity:'parking'}, {shop:'supermarket'}, {amenity:'place_of_worship'}
    ];
    const pesado = [];
    for (let i = 0; i < 512; i++) {
      const t = Object.assign({}, TIPOS[i % TIPOS.length], { name: 'Uso ' + i });
      pesado.push(el(t, 80 + (i % 40) * 22, (i * 37) % 360));
    }
    pesado.push(el({ highway:'trunk', name:'Anillo Vial Oriental' }, 70, 0));
    pesado.push(el({ highway:'primary', name:'Avenida 0' }, 120, 90));
    pesado.push(el({ highway:'secondary', name:'Calle 11' }, 150, 180));
    // Con censo y tasa de crecimiento: es el caso real, y es el único en que
    // el informe tiene que dibujar la curva de población.
    const rP = M.analizarHeuristico({ elementos: pesado, radioM: 1000, centro,
                                      tipoEstudio:'completo', proyectoId:'cafe_estancia',
                                      direccionAprox:'Cúcuta',
                                      dane: { poblacion: 14369, unidades: 120, nivel:'manzana',
                                              viviendas: 4100, censo: 2018,
                                              etiquetaFuente:'Censo DANE 2018 · manzana censal',
                                              tasaAnual: 0.004437, anioProyeccion: 2026,
                                              fuenteProyeccion:'DANE · Proyecciones de población municipal 2020-2035',
                                              advertenciaProyeccion:'La tasa es MUNICIPAL.' } });
    const htmlPesado = window.AIA_INFORME.construirHTMLEjecutivo(rP, {}, { estilo:'institucional', horizontal:true });

    return { html, htmlPesado, flujo: r.stats.movilidad.flujo,
             pois: (r.pois||[]).length, poisPesado: (rP.pois||[]).length, centro };
  });

  fs.writeFileSync('/tmp/informe.html', datos.html);

  // Se abre el informe tal cual, para medirlo con regla.
  const pg2 = await ctx.newPage();
  pg2.on('pageerror', e => errores.push('hoja: ' + e.message));
  await pg2.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    if (/staticmap/.test(u)) {
      const W = 800, H = 600;
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
        '<rect width="100%" height="100%" fill="#e6ecf1"/>' +
        '<line x1="' + (W/2) + '" y1="0" x2="' + (W/2) + '" y2="' + H + '" stroke="#c0392b" stroke-width="2"/>' +
        '<line x1="0" y1="' + (H/2) + '" x2="' + W + '" y2="' + (H/2) + '" stroke="#c0392b" stroke-width="2"/></svg>';
      return route.fulfill({ contentType:'image/svg+xml', body: svg });
    }
    return route.fulfill({ status: 200, body: '' });
  });
  await pg2.setViewportSize({ width: 1400, height: 1000 });
  await pg2.setContent(datos.html, { waitUntil:'load' });
  await pg2.waitForTimeout(1200);

  const m = await pg2.evaluate(() => {
    const wrap = document.querySelector('.mapa-wrap');
    const w = wrap.getBoundingClientRect();
    const centroMapa = { x: w.left + w.width / 2, y: w.top + w.height / 2 };
    // La punta de la gota es lo que señala el lote.
    const gota = document.querySelector('.mapa-pin span') || document.querySelector('.mapa-pin');
    const g = gota.getBoundingClientRect();
    const gotaC = { x: g.left + g.width / 2, y: g.top + g.height / 2 };
    // Desfase relativo al ancho del mapa, que es lo comparable entre tamaños.
    const desfaseX = (gotaC.x - centroMapa.x) / w.width * 100;
    const desfaseY = (gotaC.y - centroMapa.y) / w.height * 100;

    const img = document.querySelector('.mapa-img');
    const cs = img ? getComputedStyle(img) : null;

    // El informe se auto-diagrama escalando el contenido; hay que medir el
    // alto YA escalado, que es lo que de verdad ocupa en la hoja impresa.
    const hojas = Array.from(document.querySelectorAll('.hoja')).map(h => {
      const c = h.querySelector('.contenido');
      const esc = c ? (parseFloat((c.style.transform.match(/scale\(([\d.]+)\)/) || [0, 1])[1]) || 1) : 1;
      const crudo = c ? c.scrollHeight : 0;
      return { alto: h.clientHeight, crudo, escala: esc, real: Math.round(crudo * esc) };
    });

    const flujo = document.querySelector('.bloque.ancho h2') ?
      Array.from(document.querySelectorAll('.bloque h2')).map(h => h.textContent.trim()) : [];
    const bloqueFlujo = document.querySelector('.clave');
    const padreFlujo = bloqueFlujo ? bloqueFlujo.parentElement.className : '(no está)';
    const hermanos = bloqueFlujo ? bloqueFlujo.parentElement.children.length : 0;

    const padre = wrap.parentElement, abuelo = padre.parentElement;
    const cadena = [wrap, padre, abuelo].map(n => {
      const b = n.getBoundingClientRect(), st = getComputedStyle(n);
      return n.tagName + '.' + (n.className||'(sin clase)') + ' → ' +
             b.width.toFixed(0) + '×' + b.height.toFixed(0) +
             ' display:' + st.display + ' ar:' + st.aspectRatio +
             ' flex:' + st.flex + ' alignSelf:' + st.alignSelf;
    });
    return { cadena, desfaseX, desfaseY, objectFit: cs && cs.objectFit,
             hojas, padreFlujo, hermanos,
             mapaW: w.width, mapaH: w.height,
             gimnasioResaltado: !!document.querySelector('.hito-fila.fuerte'),
             // El aro NO puede quedar tapado por nada: ese fue el defecto que
             // motivó rehacer la diagramación. Se comprueba geométricamente.
             arosPisados: (function(){
               const malos = [];
               document.querySelectorAll('.aro-caja').forEach(a => {
                 const ra = a.getBoundingClientRect();
                 document.querySelectorAll('.cl-barra,.sub-barra,.comp-barra,.chip,.tbl-oport,.leer').forEach(o => {
                   const ro = o.getBoundingClientRect();
                   if (ra.left < ro.right - 1 && ra.right > ro.left + 1 &&
                       ra.top < ro.bottom - 1 && ra.bottom > ro.top + 1) {
                     malos.push((o.className || o.tagName) + ' pisa el aro');
                   }
                 });
               });
               return malos;
             })(),
             // Ningún texto puede salirse de su tarjeta.
             desbordanTarjeta: (function(){
               const malos = [];
               document.querySelectorAll('.tarjeta,.ejec,.clave,.transito').forEach(t => {
                 const rt = t.getBoundingClientRect();
                 t.querySelectorAll('*').forEach(h => {
                   const rh = h.getBoundingClientRect();
                   if (rh.height && (rh.bottom > rt.bottom + 1.5 || rh.right > rt.right + 1.5)) {
                     malos.push((h.className || h.tagName) + ' se sale de .' + t.className.split(' ')[0]);
                   }
                 });
               });
               return malos.slice(0, 4);
             })(),
             // Cabeceras de tabla ilegibles (texto del mismo color que el fondo).
             cabecerasCiegas: (function(){
               const malos = [];
               document.querySelectorAll('th').forEach(th => {
                 const cs = getComputedStyle(th);
                 if (cs.color.replace(/\s/g,'') === cs.backgroundColor.replace(/\s/g,'')) {
                   malos.push(th.textContent.trim().slice(0,20) || '(vacía)');
                 }
               });
               return malos;
             })(),
             secciones: Array.from(document.querySelectorAll('.sec b')).map(n => n.textContent.trim()),
             hitosEnMapa: document.querySelectorAll('.mapa-wrap .hito').length,
             // ¿Alguna etiqueta se sale del recuadro del mapa?
             desbordes: Array.from(document.querySelectorAll('.mapa-wrap .hito b')).map(n => {
               const r2 = n.getBoundingClientRect();
               const izq = w.left - r2.left, der = r2.right - w.right;
               return { txt: n.textContent.trim().slice(0, 26),
                        anchoPct: r2.width / w.width * 100,
                        sobra: Math.max(izq, der) };
             }).filter(d => d.sobra > 0.5),
             anchosReales: Array.from(document.querySelectorAll('.mapa-wrap .hito b')).map(n => {
               const r2 = n.getBoundingClientRect();
               return n.textContent.trim().length + ' car → ' + r2.width.toFixed(1) + ' px';
             }),
             nombresHito: Array.from(document.querySelectorAll('.hito-fila span')).map(n => n.textContent),
             filasGen: Array.from(document.querySelectorAll('.tbl-gente tr')).slice(1)
                            .map(t => t.innerText.replace(/\n/g, ' / ').trim()),
             textoFlujo: bloqueFlujo ? bloqueFlujo.innerText.slice(0, 400) : '' };
  });

  console.log('── Mapa ─────────────────────────────────────────');
  console.log('  tamaño en hoja      :', m.mapaW.toFixed(1) + '×' + m.mapaH.toFixed(1) + ' px');
  console.log('  object-fit          :', m.objectFit);
  console.log('  proporción real     :', (m.mapaW/m.mapaH).toFixed(3), '(debería ser 1.333)');
  m.cadena.forEach(c => console.log('    ' + c));
  console.log('  DESFASE del marcador: X ' + m.desfaseX.toFixed(2) + '%   Y ' + m.desfaseY.toFixed(2) + '%');
  console.log('  (0% = justo sobre el punto analizado)');
  console.log('\n── Hojas ────────────────────────────────────────');
  m.hojas.forEach((h, i) => console.log('  hoja ' + (i+1) + ': caben ' + h.alto +
    ' · ocupa ' + h.real + ' (crudo ' + h.crudo + ' × ' + h.escala.toFixed(3) + ')' +
    (h.real > h.alto + 2 ? '  ⚠️ SE DESBORDA' : '  ok') +
    (h.escala < 0.7 ? '  ⚠️ letra muy encogida' : '')));
  console.log('\n── Bloque de flujo ──────────────────────────────');
  console.log('  vive dentro de      :', m.padreFlujo, '(' + m.hermanos + ' hijos)');
  console.log('  gimnasio resaltado  :', m.gimnasioResaltado ? 'sí' : 'no');
  console.log('  hitos sobre el mapa :', m.hitosEnMapa);
  console.log('  anchos reales       :', m.anchosReales.join(' | '));
  console.log('  etiquetas desbordadas:', m.desbordes.length
    ? m.desbordes.map(d => d.txt + ' (se sale ' + d.sobra.toFixed(1) + ' px)').join(' | ')
    : 'ninguna');
  console.log('  hitos listados      :', m.nombresHito.join(' · ') || '(ninguno)');
  console.log('\n  filas de generadores:');
  m.filasGen.forEach(f => console.log('    ' + f));
  console.log('\n  ' + m.textoFlujo.replace(/\n/g, '\n  '));

  console.log('\nflujo peatonal:', datos.flujo.peatonal, datos.flujo.nivelPeatonal,
              '· vehicular:', datos.flujo.vehicular);
  if (errores.length) console.log('\nerrores:', errores.slice(0,3).join(' | '));

  // Recorte del mapa a buen tamaño, que es lo que hay que revisar a ojo.
  const wrap = await pg2.$('.mapa-marco');
  await wrap.screenshot({ path: '/tmp/mapa.png', scale: 'css' });
  const hojas2 = await pg2.$$('.hoja');
  for (let i = 0; i < hojas2.length; i++) {
    await hojas2[i].screenshot({ path: '/tmp/hoja' + (i+1) + '.png' });
  }
  await pg2.screenshot({ path: '/tmp/informe.png', fullPage: true });

  // ── El caso pesado, que es el que se queja ────────────────────────────
  const pgP = await ctx.newPage();
  await pgP.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    return route.fulfill({ status: 200, body: '' });
  });
  await pgP.setViewportSize({ width: 1400, height: 1000 });
  await pgP.setContent(datos.htmlPesado, { waitUntil:'load' });
  await pgP.waitForTimeout(1500);
  const pesado = await pgP.evaluate(() => {
    const hojas = Array.from(document.querySelectorAll('.hoja')).map(h => {
      const c = h.querySelector('.contenido');
      const e = c ? (parseFloat((c.style.transform.match(/scale\(([\d.]+)\)/) || [0,1])[1]) || 1) : 1;
      return { alto: h.clientHeight, crudo: c ? c.scrollHeight : 0, escala: e,
               real: Math.round((c ? c.scrollHeight : 0) * e),
               cortada: !!h.querySelector('.aviso-corte') };
    });
    // ¿Cuánto alto se va en aire vacío dentro de los KPI?
    const kpis = Array.from(document.querySelectorAll('.dato')).map(k => {
      const r = k.getBoundingClientRect();
      const usado = Array.from(k.children).reduce((a, c) => a + c.getBoundingClientRect().height, 0);
      return { alto: r.height, usado, aire: r.height - usado };
    });
    const aire = kpis.reduce((a, k) => a + k.aire, 0) / Math.max(1, kpis.length);
    const txt = document.body.innerText;
    const solapa = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 &&
                             a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const arosPisados = [];
    document.querySelectorAll('.aro-caja').forEach(a => {
      const ra = a.getBoundingClientRect();
      document.querySelectorAll('.cl-barra,.sub-barra,.comp-barra,.chip,.tbl-oport,.leer,.tbl-gente')
        .forEach(o => { if (solapa(ra, o.getBoundingClientRect()))
          arosPisados.push((o.className || o.tagName) + ' pisa el aro'); });
    });
    const desbordanTarjeta = [];
    document.querySelectorAll('.tarjeta,.ejec,.clave,.transito').forEach(t => {
      const rt = t.getBoundingClientRect();
      t.querySelectorAll('*').forEach(h => {
        const rh = h.getBoundingClientRect();
        if (rh.height && (rh.bottom > rt.bottom + 1.5 || rh.right > rt.right + 1.5))
          desbordanTarjeta.push((h.className || h.tagName) + ' se sale de .' + t.className.split(' ')[0]);
      });
    });
    const cabecerasCiegas = [];
    document.querySelectorAll('th').forEach(th => {
      const cs = getComputedStyle(th);
      if (cs.color.replace(/\s/g,'') === cs.backgroundColor.replace(/\s/g,''))
        cabecerasCiegas.push(th.textContent.trim().slice(0,20) || '(vacía)');
    });
    return { arosPisados, desbordanTarjeta, cabecerasCiegas,
             secciones: Array.from(document.querySelectorAll('.sec b')).map(n => n.textContent.trim()),
             numeracion: Array.from(document.querySelectorAll('header .sub b')).map(n => n.textContent.trim()),
             horas: Array.from(document.querySelectorAll('.hf:not(.voc-fila) span')).map(n => n.textContent.trim()),
             vocacion: Array.from(document.querySelectorAll('.voc-fila span')).map(n => n.textContent.trim()),
             resta: (function(){ const d = document.querySelector('.resta');
               return d ? d.textContent.replace(/\s+/g,' ').trim().slice(0,150) : ''; })(),
             anillos: Array.from(document.querySelectorAll('.anillo')).map(d =>
               Array.from(d.querySelectorAll('b')).pop().textContent.trim()),
             txtAnillos: (function(){ const t = document.querySelector('.anillo');
               return t ? t.closest('.tarjeta').textContent.replace(/\s+/g,' ') : ''; })(),
             competencia: (function(){
               const c = Array.from(document.querySelectorAll('.tarjeta'))
                 .find(t => /Competencia directa/.test(t.textContent));
               return c ? c.textContent.replace(/\s+/g,' ').trim() : ''; })(),
             poblacion: (function(){
               const d = document.querySelector('.pobl');
               if (!d) return null;
               const svg = d.querySelector('.pobl-svg');
               const trazos = svg ? svg.querySelectorAll('path').length : 0;
               const r2 = d.getBoundingClientRect();
               const padre = d.parentElement.getBoundingClientRect();
               return { txt: d.textContent.replace(/\s+/g, ' ').trim(),
                        trazos,
                        // Si el SVG se saliera de su tarjeta, la curva pisaría
                        // la columna de al lado en el PDF impreso.
                        dentro: r2.right <= padre.right + 1 && r2.bottom <= padre.bottom + 1,
                        alto: Math.round(r2.height) };
             })(),
             calor: Array.from(document.querySelectorAll('.calor-panel')).map(function(pn){
               const wrap = pn.querySelector('.mapa-wrap');
               const capa = pn.querySelector('.calor-capa');
               const rw = wrap.getBoundingClientRect();
               let desfase = 99, dentro = false;
               if (capa) {
                 const rc = capa.getBoundingClientRect();
                 // El círculo del radio se dibuja con el mismo % que la capa;
                 // se comparan centros y tamaño contra el recuadro del mapa.
                 const cxCapa = (rc.left + rc.width/2 - rw.left) / rw.width * 100;
                 const cyCapa = (rc.top + rc.height/2 - rw.top) / rw.height * 100;
                 desfase = Math.max(Math.abs(cxCapa - 50), Math.abs(cyCapa - 50));
                 dentro = rc.left >= rw.left - 1 && rc.right <= rw.right + 1 &&
                          rc.top >= rw.top - 1 && rc.bottom <= rw.bottom + 1;
               }
               return { titulo: pn.querySelector('h3').textContent.replace(/\s+/g,' ').trim(),
                        tieneCapa: !!(capa && /^data:image\/png/.test(capa.getAttribute('src')||'')),
                        desfase, dentroDelMapa: dentro,
                        tieneFoco: !!pn.querySelector('.calor-foco'),
                        pie: (pn.querySelector('.calor-foco-txt')||{textContent:''}).textContent.replace(/\s+/g,' ').trim() };
             }),
             hojas, kpis: kpis.length, aireMedioKpi: aire,
             kpisTxt: Array.from(document.querySelectorAll('.dato'))
               .map(n => n.textContent.replace(/\s+/g,' ').trim()).join(' | '),
             altoKpi: kpis.length ? kpis[0].alto : 0,
             flujoEnHoja: (function(){
               const bl = Array.from(document.querySelectorAll('.clave'))[0];
               if (!bl) return 0;
               const hs = Array.from(document.querySelectorAll('.hoja'));
               return hs.findIndex(h => h.contains(bl)) + 1;
             })(),
             traeCarros: /carros por día/i.test(txt),
             traeLitros: /litros \/ mes/i.test(txt),
             valores: Array.from(document.querySelectorAll('.tr-par b')).map(n => n.textContent),
             pieTraf: Array.from(document.querySelectorAll('.tr-notas small')).map(n => n.textContent),
             declara: /no mediciones ni cifras de ventas/.test(txt) };
  });
  console.log('\n══ CASO PESADO (1 km · 512 usos · estudio completo) ══');
  pesado.hojas.forEach((h,i)=>console.log('  hoja '+(i+1)+': caben '+h.alto+' · ocupa '+h.real+
    ' · escala '+h.escala.toFixed(3)+(h.cortada?'  🔴 FRANJA ROJA':'  ok')));
  console.log('  KPI: '+pesado.kpis+' cajas de '+pesado.altoKpi.toFixed(0)+
    ' px, con '+pesado.aireMedioKpi.toFixed(0)+' px de aire vacío cada una');
  console.log('  flujo va en la hoja: '+pesado.flujoEnHoja);
  console.log('  carros por día: '+(pesado.traeCarros?'sí':'NO')+
              ' · litros al mes: '+(pesado.traeLitros?'sí':'NO'));
  console.log('  valores: '+pesado.valores.join('  |  '));
  pesado.pieTraf.forEach(x => console.log('    · '+x));
  console.log('  declara que no son mediciones: '+(pesado.declara?'sí':'NO'));

  await pgP.screenshot({ path: '/tmp/pesado.png', fullPage: true });
  const h1 = await pgP.$$('.hoja');
  for (let i = 0; i < h1.length; i++) await h1[i].screenshot({ path: '/tmp/pesado'+(i+1)+'.png' });

  // ── Aserciones ───────────────────────────────────────────────────────
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  // 0. El caso pesado que reportó el usuario: sin franja roja y sin aire.
  chk(pesado.hojas.every(h => !h.cortada), 'ninguna hoja saca la franja roja de contenido extenso');
  chk(pesado.aireMedioKpi < 40, 'los KPI ya no se inflan (' + pesado.aireMedioKpi.toFixed(0) + ' px de aire)');
  chk(pesado.flujoEnHoja === 1, 'el flujo peatonal y vehicular va en la hoja 1');
  chk(pesado.traeCarros && pesado.traeLitros, 'el informe trae carros por día y litros al mes');
  chk(pesado.declara, 'y declara que son estimaciones, no mediciones ni ventas');
  chk(pesado.hojas.every(h => h.escala >= 0.7), 'sin encoger la letra hasta ser ilegible');

  // 1. El punto analizado tiene que caer EXACTAMENTE donde está.
  chk(Math.abs(m.desfaseX) < 0.5 && Math.abs(m.desfaseY) < 0.5,
      'la marca del lote cae sobre el punto analizado (desfase ' +
      m.desfaseX.toFixed(2) + '% / ' + m.desfaseY.toFixed(2) + '%)');
  chk(Math.abs(m.mapaW / m.mapaH - 4/3) < 0.02,
      'el recuadro del mapa conserva su proporción (' + (m.mapaW/m.mapaH).toFixed(3) + ')');
  chk(m.objectFit === 'fill',
      'la foto ocupa el recuadro sin recortarse (recortar descuadraba lo dibujado)');

  // 2. Las dos hojas tienen que entrar sin mutilarse.
  m.hojas.forEach((h, i) => {
    chk(h.real <= h.alto + 2, 'la hoja ' + (i+1) + ' entra completa');
    chk(h.escala >= 0.7, 'la hoja ' + (i+1) + ' no encoge la letra hasta ser ilegible (×' +
        h.escala.toFixed(2) + ')');
  });

  // 3. El bloque de flujo, en su propia franja y no como celda suelta.
  chk(!!m.padreFlujo, 'el flujo ocupa su propia franja a todo el ancho');

  // 4. El gimnasio, resaltado — influye mucho en la movilidad peatonal.
  chk(m.gimnasioResaltado, 'el gimnasio se resalta entre los hitos');
  chk(/Smart Fit/.test(m.nombresHito[0] || ''), 'y encabeza la lista de hitos');
  chk(m.hitosEnMapa >= 3, 'los hitos salen señalados en el mapa (' + m.hitosEnMapa + ')');
  chk(m.desbordes.length === 0, 'ninguna etiqueta se sale del mapa');

  // 5. Las filas nombran los establecimientos reales, sin repetirse.
  const filaD1 = m.filasGen.find(f => /Tienda de descuento/.test(f));
  chk(!!filaD1 && /D1/.test(filaD1), 'la fila del formato de descuento nombra el D1');
  const filaGym = m.filasGen.find(f => /Gimnasio/.test(f));
  chk(!!filaGym && /Smart Fit/.test(filaGym), 'la fila del gimnasio nombra el Smart Fit');
  // ── Lo que motivó rehacer la diagramación ───────────────────────────
  chk(pesado.arosPisados.length === 0,
      'ningún aro de porcentaje queda pisado por una barra' +
      (pesado.arosPisados.length ? ': ' + pesado.arosPisados[0] : ''));
  chk(pesado.desbordanTarjeta.length === 0,
      'ningún contenido se sale de su tarjeta' +
      (pesado.desbordanTarjeta.length ? ': ' + pesado.desbordanTarjeta[0] : ''));
  chk(pesado.cabecerasCiegas.length === 0,
      'ninguna cabecera de tabla queda del color de su fondo' +
      (pesado.cabecerasCiegas.length ? ': ' + pesado.cabecerasCiegas.join(', ') : ''));
  chk(pesado.secciones.length === 10,
      'el informe lleva las 10 secciones numeradas (' + pesado.secciones.length + ')');
  chk(pesado.hojas.length === 4, 'el informe sale en cuatro hojas (' + pesado.hojas.length + ')');
  chk(pesado.numeracion.length === pesado.hojas.length &&
      pesado.numeracion.every(t => new RegExp('/' + pesado.hojas.length + '$').test(t)),
      'la numeración del encabezado dice el total real de hojas (' +
      (pesado.numeracion.join(' ') || 'no se encontró ninguna') + ')');

  // ── Mapas de calor ─────────────────────────────────────────────────
  console.log('\n── Mapas de calor ───────────────────────────────');
  pesado.calor.forEach(c => console.log('  ' + c.titulo.padEnd(22) +
    ' capa ' + (c.tieneCapa ? 'sí' : 'NO') +
    ' · desfase c/círculo ' + c.desfase.toFixed(2) + '%' +
    ' · foco ' + (c.tieneFoco ? 'sí' : 'no') + ' · ' + c.pie));
  chk(pesado.calor.length === 3,
      'el informe trae las tres capas de calor (' + pesado.calor.length + ')');
  chk(pesado.calor.every(c => c.tieneCapa), 'las tres capas se pintan de verdad');
  // Es el error que ya costó una corrección en el mapa del entorno: si la
  // capa no coincide con el círculo del radio, el calor sale corrido y
  // señala una esquina que no es.
  chk(pesado.calor.every(c => c.desfase < 0.5),
      'el calor cae exactamente sobre el círculo del radio, sin desfase');
  chk(pesado.calor.every(c => c.dentroDelMapa),
      'ninguna capa de calor se sale de su recuadro');
  chk(pesado.calor.filter(c => c.tieneFoco).length === 3,
      'las tres capas señalan su punto más activo sobre el plano');
  chk(/noche/i.test(pesado.calor.map(c => c.titulo).join(' ')),
      'una de las capas es la de la noche');

  // ── Radio de importancia y competencia con nombre ──────────────────
  console.log('\n── Radio de importancia ─────────────────────────');
  console.log('  ' + (pesado.anillos.join(' · ') || '(no aparece)'));
  console.log('  competencia: ' + (pesado.competencia || '(no aparece)').slice(0, 150));
  chk(pesado.anillos.length >= 3,
      'el informe reparte el radio en anillos con su peso (' + pesado.anillos.length + ')');
  chk(pesado.anillos.every(a => /%$/.test(a)),
      'cada anillo con su porcentaje de influencia');
  chk(/Lo de cerca pesa más/.test(pesado.txtAnillos || ''),
      'y explica por qué lo de cerca pesa más');
  chk(/Competencia directa/.test(pesado.competencia || ''),
      'el informe trae el bloque de competencia directa');

  // ── Población: censo y proyección ──────────────────────────────────
  console.log('\n── Población ────────────────────────────────────');
  console.log('  ' + (pesado.poblacion ? pesado.poblacion.txt.slice(0, 190) : '(no aparece)'));
  chk(!!pesado.poblacion, 'el informe trae el bloque de crecimiento de población');
  if (pesado.poblacion) {
    chk(/14\.369/.test(pesado.poblacion.txt) && /14\.887/.test(pesado.poblacion.txt),
        'muestra las dos cifras: lo contado en 2018 y lo proyectado a hoy');
    chk(/contado/.test(pesado.poblacion.txt) && /proyectado/.test(pesado.poblacion.txt),
        'y dice cuál es cuál, en vez de dar una sola cifra sin origen');
    chk(/MUNICIPAL/.test(pesado.poblacion.txt),
        'arrastra la advertencia de que la tasa es del municipio, no del barrio');
    chk(pesado.poblacion.trazos >= 3, 'dibuja la curva (' + pesado.poblacion.trazos + ' trazos)');
    chk(pesado.poblacion.dentro, 'y la curva no se sale de su tarjeta');
    chk(pesado.poblacion.alto > 0, 'el bloque ocupa alto real, no queda colapsado');
  }
  chk(/DANE 2018 proyectado a 2026|proyectado a 2026/.test(pesado.kpisTxt || ''),
      'la caja de habitantes dice que la cifra está proyectada');

  // ── Lo que resta ───────────────────────────────────────────────────
  console.log('\n── Lo que rompe el recorrido ────────────────────');
  console.log('  ' + (pesado.resta || '(no aparece)'));
  chk(!!pesado.resta, 'el informe dice también qué RESTA, no solo qué suma');
  chk(pesado.horas.length === 4 && /Noche/.test(pesado.horas.join(' ')),
      'la gráfica de horas incluye la noche (' + pesado.horas.join(', ') + ')');
  console.log('\n── De qué vive la cuadra ────────────────────────');
  console.log('  ' + (pesado.vocacion.join(' · ') || '(sin vocación)'));
  chk(pesado.vocacion.length >= 2,
      'el informe dice de qué vive la cuadra, rubro por rubro');
  chk(!m.filasGen.some(f => { const p = f.split('/').map(x=>x.trim());
        return p.length > 1 && p[0] && p[0] === p[1]; }),
      'ninguna fila repite el nombre como si fuera su propio ejemplo');

  chk(errores.length === 0, 'el informe se arma sin errores' + (errores.length ? ': ' + errores[0] : ''));

  console.log('\n' + ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));

  await b.close();
  process.exit(fallo.length ? 1 : 0);
})();
