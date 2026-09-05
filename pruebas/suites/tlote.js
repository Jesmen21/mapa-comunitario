const E = require('../entorno.js');
/* Tanda A · entrega 1: lo que la lámina de análisis urbano pide y la ficha no
   daba — las medidas del área (área en m² y perímetro), el reparto de alturas
   de lo construido, y los hitos numerados. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, LADO=0.006;
const POL=[{lat:C.lat-LADO,lng:C.lng-LADO},{lat:C.lat+LADO,lng:C.lng-LADO},
           {lat:C.lat+LADO,lng:C.lng+LADO},{lat:C.lat-LADO,lng:C.lng+LADO}];

const elements=[];
/* Edificios: 10 de un nivel, 5 de dos, 2 de tres, 3 de más de tres, y 8 sin el
   dato — que es el caso normal en OpenStreetMap y el que el bloque tiene que
   declarar en vez de esconder. */
const REPARTO=[[1,10],[2,5],[3,2],[6,3]];
let id=1000;
REPARTO.forEach(([niv,cuantos])=>{ for(let k=0;k<cuantos;k++){
  elements.push({type:'way',id:id++,center:{lat:C.lat+0.001+k*0.0002,lon:C.lng+0.001+niv*0.0003},
    tags:{building:'residential','building:levels':String(niv),name:'Edificio '+niv+'-'+k}});
}});
for(let k=0;k<30;k++) elements.push({type:'way',id:id++,center:{lat:C.lat-0.001,lon:C.lng-0.001+k*0.0002},
  tags:{building:'house'}});
/* Hitos: uno con ficha en Wikidata (tiene que salir primero), uno educativo,
   uno de comercio, uno de conservación, y un restaurante que NO es hito. */
const HITOS=[
  {tags:{historic:'monument',name:'Monumento Padre Rafael García Herreros',wikidata:'Q42'},dx:0.002,dy:0.002},
  {tags:{amenity:'school',name:'Colegio Santo Ángel de la Guarda'},dx:-0.002,dy:0.001},
  {tags:{shop:'mall',name:'Centro Comercial Pinar del Río'},dx:0.001,dy:-0.002},
  {tags:{leisure:'park',name:'Ecoparque San Mateo'},dx:-0.001,dy:-0.001},
  {tags:{amenity:'restaurant',name:'Donde Marta'},dx:0.0005,dy:0.0005}
];
HITOS.forEach(h=>elements.push({type:'node',id:id++,lat:C.lat+h.dy,lon:C.lng+h.dx,tags:h.tags}));
/* Paradas de bus y las rutas que recogen en ellas. La relación llega sin
   posición: si el motor la filtrara por área, desaparecería. */
for(let k=0;k<3;k++) elements.push({type:'node',id:id++,lat:C.lat+0.0008*k,lon:C.lng+0.0012,
  tags:{highway:'bus_stop',name:'Parada '+(k+1)}});
[['7','Ruta 7: Centro → Atalaya','#e5484d'],['7','Ruta 7: Atalaya → Centro','#e5484d'],
 ['12','Ruta 12: San Mateo → La Libertad','#0ea5e9'],['','Transguasimales',''] ].forEach(r=>{
  elements.push({type:'relation',id:id++,tags:{type:'route',route:'bus',ref:r[0],name:r[1],
    colour:r[2],operator:'Cootransunidos'}});
});

/* Y usos sueltos para que el informe tenga cuerpo. */
const TIPOS=[{amenity:'pharmacy'},{shop:'supermarket'},{amenity:'restaurant'},{amenity:'school'},{leisure:'park'}];
for(let i=0;i<40;i++){ const ang=i*9*Math.PI/180, d=(200+(i%6)*80)/111320;
  elements.push({type:'node',id:id++,lat:C.lat+Math.cos(ang)*d,
    lon:C.lng+Math.sin(ang)*d/Math.cos(C.lat*Math.PI/180),
    tags:Object.assign({name:'U'+i},TIPOS[i%TIPOS.length])}); }

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO'});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{
    /* Solo en el marco principal. `addInitScript` corre en TODOS los marcos, y
     la aplicación crea uno escondido para medir la lámina antes de imprimirla:
     sin esta guarda, ese marco volvía a ejecutar esto y borraba las fichas ya
     guardadas a mitad de la prueba. Costó encontrarlo porque el síntoma era
     «no se guardó» en suites que no tocan el guardado. */
    if (window.top !== window) return;
    try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
    localStorage.removeItem('pc_areas_analisis_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',
    body:fs.readFileSync(S+'node_modules/chart.js/dist/chart.umd.js','utf8')}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',city_district:'Comuna 2 · Centro Oriental',suburb:'La Rinconada',road:'Avenida 0'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42,HOM:1490,MUJ:1555}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3200);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(600);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(900);

    const h=document.getElementById('pcr-hoja');
    const sec=nombre=>{
      const hs=[...h.querySelectorAll('.pcr-h')].filter(x=>new RegExp(nombre,'i').test(txt(x)));
      return hs.length?hs[0]:null;
    };
    // ── Información del área
    o.hayLote=!!sec('Información del área');
    o.lote=[...h.querySelectorAll('.pcr-lote-fila')].map(f=>txt(f.querySelector('span'))+'='+txt(f.querySelector('b')));
    // ── Alturas
    o.hayAlturas=!!sec('Alturas de lo construido');
    o.niveles=[...h.querySelectorAll('.pcr-nivel')].filter(n=>/nivel/i.test(
        (n.querySelector('.pcr-nivel-nom')||{textContent:''}).textContent)).map(n=>{
      const c=n.querySelector('.pcr-nivel-n'), pct=c?c.querySelector('em'):null;
      const total=txt(c), p=txt(pct);
      return txt(n.querySelector('.pcr-nivel-nom'))+': '+(p?total.slice(0,total.length-p.length):total)+' ('+p+')';
    });
    o.avisoMuestra=[...h.querySelectorAll('.pcr-pista')].some(p=>/de \d+ edificios/.test(txt(p)));
    // ── Hitos
    o.hayHitos=!!sec('Hitos y nodos');
    o.hitos=[...h.querySelectorAll('.pcr-hito')].map(x=>txt(x.querySelector('.pcr-hito-n'))+'. '+txt(x.querySelector('.pcr-hito-nom'))+' · '+txt(x.querySelector('.pcr-hito-d')));
    o.categorias=[...h.querySelectorAll('.pcr-hito-cat .pcr-lab')].map(x=>txt(x));
    // Cuántos hitos hay por categoría, sin contar los registrados como
    // patrimonio, que a propósito no cuentan contra el tope.
    o.porCat={};
    [...h.querySelectorAll('.pcr-hito-cat')].forEach(g=>{
      const cat=txt(g.querySelector('.pcr-lab'));
      const n=[...g.querySelectorAll('.pcr-hito')].filter(x=>!/Wikidata|patrimonio/.test(txt(x))).length;
      if(n) o.porCat[cat]=n;
    });
    // ── Rutas de transporte
    o.rutas=[...h.querySelectorAll('.pcr-ruta')].map(x=>txt(x.querySelector('.pcr-ruta-n'))+' '+txt(x.querySelector('.pcr-ruta-nom')));

    // ── Ubicación
    o.hayUbic=!!sec('Ubicación');
    o.ubic=[...h.querySelectorAll('.pcr-ubic-paso')].map(x=>txt(x.querySelector('.pcr-lab'))+'='+txt(x.querySelector('b')));
    o.ubicFin=txt(h.querySelector('.pcr-ubic-fin b'));
    o.contexto=(function(){
      const c=[...h.querySelectorAll('.pcr-conc')].filter(p=>/El área analizada está en/.test(txt(p)))[0];
      return c?txt(c):'';
    })();

    // ── Asoleamiento
    o.haySol=!!sec('Asoleamiento');
    o.solHitos=[...h.querySelectorAll('.pcr-sol-hito')].map(x=>txt(x.querySelector('.pcr-lab'))+'='+txt(x.querySelector('b'))+' ('+txt(x.querySelector('small'))+')');
    o.solDestacado=txt(h.querySelector('.pcr-sol-alto .pcr-lab'));
    o.solCenital=[...h.querySelectorAll('.pcr-pista')].some(p=>/cenit dos veces al año/.test(txt(p)));
    o.solOccidente=[...h.querySelectorAll('.pcr-conc')].some(p=>/occidente/.test(txt(p)));
    // Lo mismo, calculado a mano para comparar: si el bloque y el módulo no
    // coinciden, es que el bloque está leyendo otra cosa.
    const SL=window.URBIS_SOLAR, dd=SL.dia(new Date(), D.C.lat, D.C.lng);
    o.solHora=dd.salida.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
    o.solAltura=dd.alturaMaxima;

    // ── El texto que se copia y el PDF
    const D2=window.URBIS_PC_RECON;
    o.texto=(typeof D2.textoDePrueba==='function')?D2.textoDePrueba():'';
    // ── Guardar y reabrir en la pestaña Sector
    o.guardada=!!(D2.guardarDePrueba?D2.guardarDePrueba('Sector de prueba'):null);
    return o;
  },{C,POL});

  // El texto y el PDF se comprueban desde fuera, generándolos como lo hace el
  // botón: sin API de prueba en el módulo, se leen del portapapeles simulado.
  const extra=await pg.evaluate(async()=>{
    const o={};
    // Guardar la ficha con nombre, como hace el botón, y abrir la pestaña.
    const bg=[...document.querySelectorAll('#pcr-hoja button')].filter(b=>/Guardar/i.test(b.textContent||''))[0];
    if(bg){ window.prompt=()=>'Sector de prueba'; bg.click(); await new Promise(r=>setTimeout(r,400)); }
    window.URBIS_PC_RECON.cerrar(); await new Promise(r=>setTimeout(r,200));
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await new Promise(r=>setTimeout(r,700));
    const cab=document.querySelector('.pcr-pest-cab'); if(cab){ cab.click(); await new Promise(r=>setTimeout(r,500)); }
    const p=document.querySelector('.pcr-pestana');
    const t=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    o.pestLote=!!(p&&[...p.querySelectorAll('.pcr-h')].some(x=>/Información del/i.test(t(x))));
    o.pestAlturas=!!(p&&[...p.querySelectorAll('.pcr-h')].some(x=>/Alturas/i.test(t(x))));
    o.pestHitos=!!(p&&[...p.querySelectorAll('.pcr-h')].some(x=>/Hitos/i.test(t(x))));
    o.pestSol=p?p.querySelectorAll('.pcr-sol-hito').length:0;
    o.pestUbic=p?p.querySelectorAll('.pcr-ubic-paso').length:0;
    o.pestNiveles=p?[...p.querySelectorAll('.pcr-nivel')].filter(n=>/nivel/i.test(
        (n.querySelector('.pcr-nivel-nom')||{textContent:''}).textContent)).length:0;
    o.pestHitosN=p?p.querySelectorAll('.pcr-hito').length:0;
    o.pestPerimetro=!!(p&&/Perímetro/.test(t(p)));
    return o;
  });
  Object.assign(r, extra);

  /* ── El panel encogido mientras se dibuja ────────────────────────────
     Esto salió de un fallo en campo, con captura: alguien analizó un sector,
     empezó a marcar un lote, y la aplicación se quedó «congelada». El panel
     de abajo mostraba los chips del MAPA DE CALOR y un botón «Volver al
     informe» que no volvía a ningún lado, el calor no se podía apagar, la
     ficha no aparecía —ni vegetación, ni DANE, ni movilidad— y cada toque en
     el mapa añadía otro vértice al polígono.

     Una sola causa para los cinco síntomas: `encoger` es verdadero mientras
     `loteDibujando` lo sea, así que bajar `S.encogida` no cambiaba nada. El
     botón estaba muerto y el oyente del mapa seguía puesto.

     Se prueba desde una página nueva porque el estado de arriba ya tiene un
     lote cerrado y una ficha guardada. */
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3200);
  const cong=await pg.evaluate(async (D)=>{
    const {C,POL}=D, esperar=ms=>new Promise(r=>setTimeout(r,ms)), o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],16); await esperar(500);
    const R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1500);
    const H=()=>document.getElementById('pcr-hoja');
    const bl=[...H().querySelectorAll('[data-pcr="lote-dibujar"]')][0];
    if(bl){ bl.click(); await esperar(700); }
    o.seEncoge=/pcr-encogida/.test(H().className);
    const t=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    // El panel tiene que hablar del LOTE, no del mapa de calor.
    o.panel=t().slice(0,140);
    o.hablaDelLote=/Marcando el lote/.test(t());
    o.sinChipsDeCalor=!/Todos los usos/.test(t());
    o.tieneSalida=!!H().querySelector('[data-pcr="lote-cancelar"]');
    // Marcar dos esquinas y comprobar que el panel las cuenta.
    window.map.fire('click',{latlng:{lat:C.lat+0.0004,lng:C.lng+0.0004}});
    window.map.fire('click',{latlng:{lat:C.lat+0.0004,lng:C.lng-0.0004}});
    await esperar(400);
    o.cuenta=/llevás 2 esquinas/.test(t());
    // Y ahora la salida: tiene que abrir la ficha de verdad.
    const salir=H().querySelector('[data-pcr="lote-cancelar"]');
    if(salir){ salir.click(); await esperar(700); }
    o.trasSalir=/pcr-encogida/.test(H().className);
    o.hayFicha=/usos registrados/.test(t());
    // El mapa ya no puede seguir marcando vértices.
    const antes=document.querySelectorAll('.leaflet-interactive').length;
    window.map.fire('click',{latlng:{lat:C.lat+0.0008,lng:C.lng+0.0008}});
    await esperar(300);
    o.mapaLibre=document.querySelectorAll('.leaflet-interactive').length===antes;
    return o;
  },{C,POL});
  r.cong=cong;

  /* ── Un lápiz a la vez ───────────────────────────────────────────────
     Sobre el mismo mapa se pueden dibujar tres cosas: el área del sector, el
     lote y las marcas de lo intangible. Cada una se armaba por su cuenta.
     Con dos armadas, un solo toque alimentaba los DOS dibujos: cuatro toques
     dejaban cuatro vértices de sector y un lote cerrado encima.

     Desde fuera eso no se lee como «tengo dos modos activos» —nadie sabe que
     existen dos—, se lee como «no me deja dibujar el área»: sale una cosa
     distinta de la que se pidió. Así llegó reportado, con captura. */
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3200);
  const lap = await pg.evaluate(async (D) => {
    const {C}=D, esperar=ms=>new Promise(r=>setTimeout(r,ms)), o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],17); await esperar(400);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    R.abrir(); await esperar(400);
    const H=()=>document.getElementById('pcr-hoja');
    // 1 · se arma el LOTE
    const bf=[...H().querySelectorAll('button')].filter(b=>/El lote y su entorno/.test(b.textContent||''))[0];
    if(bf){ bf.click(); await esperar(400); }
    const bd=H().querySelector('[data-pcr="lote-dibujar"]');
    if(bd){ bd.click(); await esperar(600); }
    o.loteArmado=!!document.getElementById('pcr-lote-barra');
    // 2 · y ahora el lápiz del SECTOR
    A.iniciarDibujo(); await esperar(500);
    o.sectorArmado=A.estaDibujando();
    o.loteSoltado=!document.getElementById('pcr-lote-barra');
    return o;
  },{C});

  /* 3 · los toques van a UN solo dibujo. Se disparan por el mapa y no con
     `touchscreen.tap` porque el choque ocurre en los oyentes de Leaflet —los
     dos escuchaban el mismo `click`—, no en el gesto; y este contexto no
     tiene pantalla táctil. */
  const conteo = await pg.evaluate(async (C) => {
    const esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const d=0.0004;
    for (const p of [[d,d],[d,-d],[-d,-d],[-d,d]]) {
      window.map.fire('click',{latlng:{lat:C.lat+p[0], lng:C.lng+p[1]}});
      await esperar(200);
    }
    return { verticesSector: document.querySelectorAll('.pca-vertice-root').length,
             hayBarraLote: !!document.getElementById('pcr-lote-barra') };
  }, C);

  // 4 · y al revés: armar el lote suelta el lápiz del sector
  const alReves = await pg.evaluate(async () => {
    const esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const A=window.URBIS_PC_ANALISIS;
    A.iniciarDibujo(); await esperar(300);
    const antes=A.estaDibujando();
    const H=document.getElementById('pcr-hoja');
    const bd=H.querySelector('[data-pcr="lote-dibujar"]');
    if(bd){ bd.click(); await esperar(600); }
    return { armadoAntes: antes, sectorSoltado: !A.estaDibujando(),
             loteArmado: !!document.getElementById('pcr-lote-barra') };
  });
  r.lap = Object.assign({}, lap, conteo, alReves);

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- información del área --');
  P('el bloque existe', r.hayLote);
  P('con área en hectáreas y en m²', r.lote.some(x=>/^Área=.*(ha|km²)/.test(x)) && r.lote.some(x=>/metros cuadrados=.*m²/.test(x)), r.lote.slice(0,2).join(' · '));
  P('y con el perímetro', r.lote.some(x=>/^Perímetro=/.test(x)), (r.lote.filter(x=>/Perímetro/.test(x))[0]||'no está'));
  P('y los vértices del contorno', r.lote.some(x=>/Vértices/.test(x)), (r.lote.filter(x=>/Vértices/.test(x))[0]||'no está'));

  console.log('\n  -- alturas de lo construido --');
  P('el bloque existe', r.hayAlturas);
  P('con las cuatro alturas del sector', r.niveles.length===4, r.niveles.join(' | '));
  P('el predominante es «1 nivel» con 50%', /^1 nivel: 10 \(50%\)$/.test(r.niveles[0]||''), r.niveles[0]);
  P('y avisa de cuántos edificios traen el dato', r.avisoMuestra, r.avisoMuestra?'lo dice':'NO lo dice');

  console.log('\n  -- hitos y nodos --');
  P('el bloque existe', r.hayHitos);
  const PLANTADOS=['Monumento Padre Rafael','Colegio Santo Ángel','Centro Comercial Pinar','Ecoparque San Mateo'];
  P('están los cuatro hitos del sector', PLANTADOS.every(n=>r.hitos.some(x=>x.indexOf(n)>=0)),
    PLANTADOS.filter(n=>!r.hitos.some(x=>x.indexOf(n)>=0)).join(', ')||'los cuatro');
  P('y el restaurante no entra', !r.hitos.some(x=>/Donde Marta/.test(x)), r.hitos.length+' hitos en total');
  P('como máximo nueve, y dos por categoría',
    r.hitos.length<=9 && Object.values(r.porCat||{}).every(n=>n<=2),
    JSON.stringify(r.porCat||{}));
  P('el registrado en Wikidata va primero', /^1\. Monumento/.test(r.hitos[0]||''), r.hitos[0]);
  P('van numerados y con su distancia', r.hitos.every(x=>/^\d+\. /.test(x) && /\d+ m$/.test(x)), r.hitos.join(' | ').slice(0,120));
  P('agrupados por categoría', r.categorias.length>=3, r.categorias.join(' · '));

  console.log('\n  -- rutas de transporte público --');
  P('aparecen las rutas que recogen en el área', r.rutas.length===3, r.rutas.length+' rutas');
  P('la misma ruta de ida y vuelta cuenta una vez', r.rutas.filter(x=>/^7 /.test(x)).length===1,
    r.rutas.filter(x=>/^7 /.test(x)).join(' | ')||'ninguna');
  P('cada una con su número y su nombre', /^7 Ruta 7/.test(r.rutas[0]||''), r.rutas.join(' · ').slice(0,120));
  P('y la que no tiene número no se pierde', r.rutas.some(x=>/Transguasimales/.test(x)),
    r.rutas.filter(x=>/Trans/.test(x))[0]||'no está');

  console.log('\n  -- ubicación --');
  P('el bloque existe', r.hayUbic);
  P('con la cadena completa hasta el barrio', r.ubic.length===5, r.ubic.join(' › '));
  P('y el barrio es el último paso', r.ubicFin==='La Rinconada', r.ubicFin);
  P('escribe el párrafo que sitúa el área', /La Rinconada/.test(r.contexto) && /Cúcuta/.test(r.contexto), (r.contexto||'—').slice(0,110));
  P('y ese párrafo dice el área y una referencia cercana', /ha|km²/.test(r.contexto) && /referencia/.test(r.contexto), (r.contexto||'').slice(-110));

  console.log('\n  -- asoleamiento --');
  P('el bloque existe', r.haySol);
  P('con amanecer, mediodía y atardecer', r.solHitos.length===3, r.solHitos.join(' | '));
  const limpio=x=>String(x).replace(/[\s\u00a0\u202f]+/g,' ').trim();
  const hhmm=x=>((String(x).match(/(\d{1,2}):(\d{2})/)||[])[0]||'').replace(/^0/,'');
  P('la hora del amanecer es la que calcula el módulo',
    hhmm(r.solHitos[0]) === hhmm(r.solHora) && !!hhmm(r.solHora),
    'ficha ' + hhmm(r.solHitos[0]) + ' · módulo ' + hhmm(r.solHora));
  P('y es hora de Cúcuta, no UTC', /^[4-7]:\d\d$/.test(hhmm(r.solHitos[0])),
    limpio(r.solHitos[0]||'').split(' (')[0]);
  P('el mediodía es el destacado', /Mediodía/.test(r.solDestacado||''), r.solDestacado);
  P('dice que la fachada de occidente es la que se protege', r.solOccidente);
  P('y que en el trópico el sol pasa dos veces por el cenit', r.solCenital);

  console.log('\n  -- el sector guardado no los pierde --');
  P('la pestaña trae información del área', r.pestLote && r.pestPerimetro, 'bloque '+r.pestLote+' · perímetro '+r.pestPerimetro);
  P('la pestaña trae las alturas', r.pestAlturas && r.pestNiveles===4, r.pestNiveles+' filas');
  P('la pestaña trae la ubicación', r.pestUbic===5, r.pestUbic+' pasos');
  P('la pestaña trae el asoleamiento', r.pestSol===3, r.pestSol+' momentos del día');
  P('la pestaña trae los hitos', r.pestHitos && r.pestHitosN===r.hitos.length,
    r.pestHitosN+' en la pestaña, '+r.hitos.length+' en la ficha');

  console.log('\n  -- dibujando el lote, la hoja no se puede quedar colgada --');
  P('el panel se encoge para dejar ver el mapa', r.cong.seEncoge);
  P('y habla del LOTE, no del mapa de calor',
    r.cong.hablaDelLote && r.cong.sinChipsDeCalor, r.cong.panel.slice(0,70));
  P('cuenta las esquinas que se van marcando', r.cong.cuenta);
  P('hay una salida visible sin buscarla', r.cong.tieneSalida);
  P('y esa salida SÍ abre la ficha', !r.cong.trasSalir && r.cong.hayFicha);
  P('después, tocar el mapa ya no dibuja vértices', r.cong.mapaLibre);

  console.log('\n  -- un lápiz a la vez sobre el mismo mapa --');
  P('armar el lote pone su barra', r.lap.loteArmado);
  P('armar el lápiz del sector SUELTA el del lote',
    r.lap.sectorArmado && r.lap.loteSoltado);
  P('y los toques alimentan un solo dibujo, no dos',
    r.lap.verticesSector===4 && !r.lap.hayBarraLote,
    r.lap.verticesSector+' vértices de sector, barra del lote: '+r.lap.hayBarraLote);
  P('la regla vale en los dos sentidos: armar el lote suelta el sector',
    r.lap.armadoAntes && r.lap.sectorSoltado && r.lap.loteArmado);

  console.log('');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
