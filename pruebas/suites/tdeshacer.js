const E = require('../entorno.js');
/* Tanda AH · poder arreglar un punto que salió mal.

   Vino como una idea —«un control zeta, pero táctil»— y al ir a mirar dónde
   ponerlo resultó que el botón ya existía. Lo que no existía era la
   posibilidad de tocarlo.

   MEDIDO, en un teléfono de 412 px: los tres botones de la barra del área
   caían en y 855-892 y los de la barra de navegación en 827-894, con la
   navegación ganando por z-index —2.147.483.270 contra 100.000—. Los del
   lote, tapados de lado a lado por el cuerpo de la hoja encogida. Seis
   botones que existían desde siempre y ninguno se podía tocar con el dedo:
   cerrar un área solo se podía tocando el primer punto en el mapa, y
   arreglar un error, de ninguna manera.

   Encima, el «Deshacer» del área era un icono suelto entre un aspa y un
   «Cerrar área»: aunque se hubiera podido tocar, no se lee como deshacer.

   Lo que esta prueba vigila: que los seis botones se puedan tocar, que digan
   lo que hacen, que un vértice se quite tocándolo, y que deshacer deshaga lo
   ÚLTIMO —incluido un borrado—, que es lo que significa un control zeta. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs'); const S=E.TRABAJO; const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
const LOTE=[Q(-45,-35),Q(45,-35),Q(45,35),Q(-45,35)];
let id=1; const usos=[];
for(let i=0;i<30;i++){ usos.push({type:'node',id:id++,lat:C.lat+i*1e-4,lon:C.lng+i*1e-4,
  tags:{name:'U'+i,amenity:'school'}}); }

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'martarojas',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.removeItem('pcr_fichas_v1'); localStorage.removeItem('pcr_trazo_vivo_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',suburb:'La Playa'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL,LOTE}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    /* El retrato de una barra: qué dicen sus botones, qué miden, y —lo que
       importa— si el dedo llegaría. `elementFromPoint` en el centro del botón
       contesta lo que un dedo contestaría. */
    function retrato(sel){
      const bar=document.querySelector(sel);
      if(!bar || bar.hidden) return {existe:false};
      return { existe:true, botones:[...bar.querySelectorAll('button')].map(function(bt){
        const rc=bt.getBoundingClientRect();
        const arriba=document.elementFromPoint(Math.round(rc.left+rc.width/2), Math.round(rc.top+rc.height/2));
        return { texto:(bt.textContent||'').replace(/\s+/g,' ').trim(),
                 alto:Math.round(rc.height), ancho:Math.round(rc.width),
                 sePuedeTocar: !!(arriba && (arriba===bt || bt.contains(arriba))),
                 loTapa: (arriba && !(arriba===bt||bt.contains(arriba)))
                   ? ((arriba.className&&typeof arriba.className==='string'?arriba.className:'')||arriba.tagName) : '',
                 apagado: bt.disabled };
      })};
    }
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(400);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(500); }

    // ── El área amarilla, a medio dibujar.
    A.iniciarDibujo();
    POL.slice(0,3).forEach(p=>A.agregarPunto(p.lat,p.lng));
    await esperar(400);
    o.area=retrato('#pca-barra');
    o.areaPuntos=A.puntosDelArea().length;
    const txtBarra=(document.querySelector('#pca-barra')||{textContent:''}).textContent.replace(/\s+/g,' ');
    o.areaDice=/se quita tocándolo|quitarlo/i.test(txtBarra);

    // Tocar un vértice del medio lo quita.
    const antes=A.puntosDelArea().length;
    A.agregarPunto(POL[1].lat, POL[1].lng);       // el segundo, ya puesto
    await esperar(300);
    o.trasTocarVertice=A.puntosDelArea().length;
    o.antesDeTocar=antes;
    const bd=document.querySelector('#pca-barra [data-u52-call="pca-deshacer"]');
    o.hayDeshacerArea=!!bd;
    o.deshacerApagado=bd?bd.disabled:null;
    o.barraEnLaApp=!!(document.querySelector('#pca-barra')||{}).closest('#urbis-mobile-app');
    // Se cuenta cuántas veces llega la acción: dos enrutadores distintos
    // atendiendo el mismo toque es un fallo real, no ruido de la prueba.
    window.__acciones=[];
    const orig=A.accion.bind(A);
    A.accion=function(n,el){ window.__acciones.push(n); return orig(n,el); };
    window.__puntosAntesDelToque=A.puntosDelArea().length;
    return o;
  },{C,POL,LOTE});

  /* El toque de verdad, desde fuera de la página. Un `.click()` de JavaScript
     no es un dedo: en un contexto táctil el enrutador de la aplicación escucha
     el gesto y no el evento sintético, así que la primera versión de esta
     prueba daba «no deshace» cuando lo que pasaba era que nadie había tocado
     nada. Y tocar de verdad es justamente lo que esta suite vino a comprobar. */
  /* Con tope y atrapado: si el botón está tapado, Playwright se queda
     esperando a que se despeje y termina lanzando. Sin esto la suite revienta
     con una traza de veinte líneas en vez de decir qué pasó —y lo que pasa es
     justo lo que esta prueba vino a medir, así que tiene que salir escrito. */
  let porQueNoSePudoTocar = '';
  try {
    await pg.tap('#pca-barra [data-u52-call="pca-deshacer"]', { timeout: 4000 });
  } catch (e) {
    porQueNoSePudoTocar = (String(e.message).match(/<[^>]+>[^\n]*intercepts pointer events/) ||
                           [String(e.message).split('\n')[0]])[0];
  }
  await pg.waitForTimeout(400);

  const r2=await pg.evaluate(async (D)=>{
    const {C,LOTE,POL2}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    function retrato(sel){
      const bar=document.querySelector(sel);
      if(!bar || bar.hidden) return {existe:false};
      return { existe:true, botones:[...bar.querySelectorAll('button')].map(function(bt){
        const rc=bt.getBoundingClientRect();
        const arriba=document.elementFromPoint(Math.round(rc.left+rc.width/2), Math.round(rc.top+rc.height/2));
        return { texto:(bt.textContent||'').replace(/\s+/g,' ').trim(),
                 alto:Math.round(rc.height), ancho:Math.round(rc.width),
                 sePuedeTocar: !!(arriba && (arriba===bt || bt.contains(arriba))),
                 loTapa: (arriba && !(arriba===bt||bt.contains(arriba)))
                   ? ((arriba.className&&typeof arriba.className==='string'?arriba.className:'')||arriba.tagName) : '',
                 apagado: bt.disabled };
      })};
    }
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    /* Si el módulo no expone los vértices que se están dibujando, esta prueba
       tiene que FALLAR diciéndolo, no reventar: una suite que explota no dice
       qué se rompió, y la siguiente persona la borra por ruidosa. */
    o.faltanLosAccesores = !(R.loteDePrueba && R.trazoDePrueba);
    o.trasDeshacer=A.puntosDelArea().length;
    o.acciones=(window.__acciones||[]).join(',');
    o.antesDelToque=window.__puntosAntesDelToque;
    // Si el toque no llegó, se prueba la acción directa: separa «no deshace»
    // de «el toque no llegó», que son dos fallos distintos.
    if(o.trasDeshacer!==3){ A.accion('deshacer', null); await esperar(200);
      o.trasAccionDirecta=A.puntosDelArea().length; }
    A.cancelar();
    await esperar(300);
    o.navVuelve=!document.body.classList.contains('urbis-dibujando-area');

    // ── El lote, con la hoja encogida encima.
    R.abrir(); await esperar(500);
    const H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    await abrir();
    const bf=H().querySelector('[data-pcr="forma"][data-f="lote"]');
    if(bf){ bf.click(); await esperar(400); }
    const bl=H().querySelector('[data-pcr="lote-dibujar"]');
    if(bl){ bl.click(); await esperar(500);
      LOTE.slice(0,3).forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
      await esperar(400);
    }
    o.lote=retrato('#pcr-lote-barra');
    const txtLote=(document.querySelector('#pcr-lote-barra')||{textContent:''}).textContent.replace(/\s+/g,' ');
    o.loteDice=/se quita tocándola|quitarla/i.test(txtLote);
    o.loteAntes=(R.loteDePrueba?R.loteDePrueba().length:-1);
    window.map.fire('click',{latlng:{lat:LOTE[1].lat,lng:LOTE[1].lng}});
    await esperar(300);
    o.loteTrasTocar=(R.loteDePrueba?R.loteDePrueba().length:-1);
    const bdl=document.querySelector('#pcr-lote-barra [data-lote="deshacer"]');
    if(bdl) bdl.click();
    await esperar(300);
    o.loteTrasDeshacer=(R.loteDePrueba?R.loteDePrueba().length:-1);
    const bcl=document.querySelector('#pcr-lote-barra [data-lote="cancelar"]');
    if(bcl) bcl.click();
    await esperar(400);

    /* ── Y el lápiz de lo intangible, que solo existe con la ficha en
       pantalla: es una marca sobre un sector, no sobre el mapa vacío. */
    const A2=window.URBIS_PC_ANALISIS;
    A2.limpiarArea(); A2.iniciarDibujo();
    POL2.forEach(p=>A2.agregarPunto(p.lat,p.lng)); A2.agregarPunto(POL2[0].lat,POL2[0].lng);
    R.cerrar(); await esperar(200); R.abrir(); await esperar(400);
    await abrir();
    /* Se elige la forma a mano: venimos de cancelar el lote, así que la hoja
       sigue en modo «lote» y sin lote no hay nada que analizar. */
    const bfp=H().querySelector('[data-pcr="forma"][data-f="poligono"]');
    if(bfp){ bfp.click(); await esperar(400); }
    await R.analizar(); await esperar(1500);
    await abrir();
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="inseguro"]');
    if(lap){ lap.click(); await esperar(400);
      [[70,70],[130,70],[130,130]].forEach(([x,y])=>{
        const p={lat:C.lat+y/110540, lng:C.lng+x/(111320*Math.cos(C.lat*Math.PI/180))};
        window.map.fire('click',{latlng:p}); });
      await esperar(400);
    }
    o.hayFicha=R.estado().hay;
    o.hayLapiz=!!H().querySelector('[data-pcr="int-dibujar"][data-t="inseguro"]');
    o.int=retrato('#pcr-int-barra');
    o.intAntes=(R.trazoDePrueba?R.trazoDePrueba().length:-1);
    const p2={lat:C.lat+70/110540, lng:C.lng+130/(111320*Math.cos(C.lat*Math.PI/180))};
    window.map.fire('click',{latlng:p2});
    await esperar(300);
    o.intTrasTocar=(R.trazoDePrueba?R.trazoDePrueba().length:-1);
    const bdi=document.querySelector('#pcr-int-barra [data-int="deshacer"]');
    if(bdi) bdi.click();
    await esperar(300);
    o.intTrasDeshacer=(R.trazoDePrueba?R.trazoDePrueba().length:-1);
    return o;
  },{C,LOTE,POL2:POL});
  Object.assign(r, r2);

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const pinta=b=>(b.botones||[]).map(x=>'«'+(x.texto||'(sin palabra)')+'» '+x.ancho+'×'+x.alto+
    (x.sePuedeTocar?'':' TAPADO por '+x.loTapa)).join(' · ');

  [['el área amarilla','area'],['el lote','lote'],['el lápiz de percepción','int']].forEach(function(par){
    const d=r[par[1]]||{};
    console.log('\n  -- '+par[0]+' --');
    T('la barra está en pantalla', d.existe===true,
      par[1]==='int' ? ('ficha: '+r.hayFicha+' · lápiz: '+r.hayLapiz) : undefined);
    /* Lo que fallaba: existían y ninguno se podía tocar. */
    T('y sus botones se pueden tocar con el dedo',
      (d.botones||[]).length>0 && (d.botones||[]).every(x=>x.sePuedeTocar), pinta(d));
    T('con blanco suficiente y una palabra que diga qué hacen',
      (d.botones||[]).every(x=>x.alto>=44 && /[a-záéíóúñ]/i.test(x.texto)), pinta(d));
  });

  console.log('\n  -- quitar el punto que salió mal --');
  T('en el área, tocar un vértice lo quita',
    r.antesDeTocar===3 && r.trasTocarVertice===2,
    r.antesDeTocar+' → '+r.trasTocarVertice+' puntos');
  T('y la barra lo dice, en vez de dejarlo escondido', r.areaDice===true);
  T('en el lote, igual', r.loteAntes===3 && r.loteTrasTocar===2,
    r.loteAntes+' → '+r.loteTrasTocar);
  T('y con el lápiz de percepción, igual', r.intAntes===3 && r.intTrasTocar===2,
    r.intAntes+' → '+r.intTrasTocar);

  console.log('\n  -- y deshacer deshace lo último, no «el último punto» --');
  /* La diferencia importa: si `deshacer` quitara el último punto, deshacer un
     BORRADO quitaría otro punto en vez de devolver el que se borró. */
  /* Un solo toque tiene que dar un solo paso atrás. Antes daba dos: el
     manejador de dentro de la aplicación repintaba la barra, el botón tocado
     quedaba desprendido, y la guarda del manejador de documento —que pregunta
     por el árbol de ahora y no por el camino del evento— dejaba pasar la
     segunda. Con «cerrar» no se notaba; con «deshacer», saltaba dos pasos. */
  T('en el área, un toque en «Deshacer» devuelve el vértice borrado —uno, no dos—',
    r.hayDeshacerArea===true && r.trasDeshacer===3 && r.acciones==='deshacer',
    porQueNoSePudoTocar
      ? 'no se pudo ni tocar: ' + porQueNoSePudoTocar
      : r.trasTocarVertice+' → '+r.trasDeshacer+' · acciones: ['+r.acciones+']');
  T('en el lote también', r.loteTrasDeshacer===3, r.loteTrasTocar+' → '+r.loteTrasDeshacer);
  T('y con el lápiz de percepción también', r.intTrasDeshacer===3,
    r.intTrasTocar+' → '+r.intTrasDeshacer);

  console.log('\n  -- y la navegación vuelve al soltar el lápiz --');
  T('el borde de abajo se devuelve al terminar', r.navVuelve===true);

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
