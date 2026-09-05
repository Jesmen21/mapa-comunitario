const E = require('../entorno.js');
/* Miniaturas de mapa reales en las dos listas: áreas guardadas (js/24) y
   sectores guardados (js/68). La FORMA se tiene que ver, no un emoji. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
// Un polígono en L, para que la forma se distinga de un rectángulo.
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng},
           {lat:C.lat,lng:C.lng},{lat:C.lat,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const elements=[];
for(let i=0;i<30;i++){ const a=i*12*Math.PI/180, d=(80+(i%5)*30)/111320;
  elements.push({type:'node',id:6000+i,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'P'+i,amenity:i%2?'pharmacy':'restaurant'}}); }

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,
      session_token:'t',active:true,verified:true,nombre_completo:'D'}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1'); localStorage.removeItem('pc_areas_analisis_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({address:{city:'Cúcuta'}})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));
  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.stack||e.message).replace(/\s+/g,' ').slice(0,420)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    // 1) La miniatura como función pura.
    const svgPol=A.miniatura({pts:POL},{etiqueta:'x'});
    const svgCirc=A.miniatura({centro:C,radioM:500});
    o.polEsSvg=/^<svg/.test(svgPol) && /<path d="M[\d.]+ [\d.]+ L/.test(svgPol);
    o.polVertices=(svgPol.match(/<circle/g)||[]).length;
    o.polNorte=/>N<\/text>/.test(svgPol);
    o.polEscala=/(\d+ m|\d+(\.\d+)? km)<\/text>/.test(svgPol);
    o.escalaTxt=(svgPol.match(/>([\d.]+ (?:m|km))<\/text>/)||[])[1];
    o.circEsSvg=/^<svg/.test(svgCirc) && /<circle[^>]*r="\d/.test(svgCirc);
    o.vacia=A.miniatura({pts:[]})==='' && A.miniatura(null)==='';

    // 2) En la lista de áreas guardadas: entrar a Pro City como una persona,
    //    dibujar, guardar, mirar la tarjeta.
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    A.guardarAreaConNombre('Manzana en L', POL);
    A.limpiarArea();
    window.urbisProCityAbrirAnalisis(); await esperar(500);
    const card=document.querySelector('.pca-card-area');
    o.hayTarjetaArea=!!card;
    o.tarjetaTieneSvg=!!(card && card.querySelector('svg.pca-minimapa path'));
    o.tarjetaTexto=card?card.innerText.replace(/\s+/g,' ').slice(0,80):'';
    o.tarjetaSinEmoji=card?!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(card.innerText):false;
    const miniEl=card&&card.querySelector('svg.pca-minimapa');
    const miniRect=miniEl?miniEl.getBoundingClientRect():{width:0,height:0};
    o.miniAncho=Math.round(miniRect.width); o.miniAlto=Math.round(miniRect.height);
    o.hojaRect=(function(){ const h=document.querySelector('.u52-procity-sheet'); if(!h) return 'sin hoja';
      const r=h.getBoundingClientRect(); return Math.round(r.width)+'×'+Math.round(r.height)+' hidden:'+h.hidden+' display:'+getComputedStyle(h).display; })();
    o.cardRect=card?(function(){const r=card.getBoundingClientRect();return Math.round(r.width)+'×'+Math.round(r.height);})():'';
    window.urbisProCityCerrarStats(); await esperar(200);

    // 3) En la pestaña «Sector»: analizar (queda guardado solo) y mirar la tarjeta.
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.abrir(); await esperar(250); await R.analizar(); await esperar(500);
    R.cerrar(); await esperar(200);
    window.urbisProCityAbrirSector(); await esperar(500);
    const sec=document.querySelector('.pcr-pest-cab');
    o.haySector=!!sec;
    o.sectorTieneSvg=!!(sec && sec.querySelector('svg.pcr-pest-mini path'));
    o.sectorSinEmoji=sec?!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(sec.innerText):false;
    o.sectorTexto=sec?sec.innerText.replace(/\s+/g,' ').slice(0,80):'';
    o.sectorFlechaSvg=!!(sec && sec.querySelector('.pcr-pest-fl svg'));

    /* ── La tercera lista: «Reconocimientos guardados», dentro de la hoja ──
       Las otras dos ya tenían miniatura; esta no, y es la que se ve al
       volver a abrir la herramienta. Llegó reportado como que «solo sale
       texto». Con cuatro sectores parecidos —«La Playa», «La Playa 2»— un
       nombre y dos cifras no dicen cuál es cuál: lo que identifica un sector
       es su forma. */
    try{ window.urbisProCityCerrarStats(); }catch(e){}
    await esperar(250);
    const R2=window.URBIS_PC_RECON; R2.abrir(); await esperar(500);
    let H2=document.getElementById('pcr-hoja');
    let ag=H2 && H2.querySelector('[data-pcr="agrandar"]'); if(ag){ ag.click(); await esperar(400); }
    /* La lista vive en la pantalla ANTERIOR al análisis, que es donde uno
       vuelve para mirar otro sector. Con un resultado en pantalla se ve la
       ficha, no la lista. */
    const otro=[...H2.querySelectorAll('button')].filter(x=>/Analizar otro sector/.test(x.textContent||''))[0];
    if(otro){ otro.click(); await esperar(700); }
    H2=document.getElementById('pcr-hoja');
    ag=H2 && H2.querySelector('[data-pcr="agrandar"]'); if(ag){ ag.click(); await esperar(400); }
    const fila=H2 && H2.querySelector('.pcr-guardada');
    o.hayGuardada=!!fila;
    const mini=fila && fila.querySelector('.pcr-guardada-mini svg');
    o.listaTieneMini=!!mini;
    o.listaTienePuntos=!!(mini && mini.querySelectorAll('circle').length>0);
    o.listaCuantosPuntos=mini?mini.querySelectorAll('circle').length:0;
    o.listaMideAlgo=(function(){
      if(!mini) return '';
      const r=mini.getBoundingClientRect();
      return Math.round(r.width)+'×'+Math.round(r.height)+' px';
    })();
    /* La miniatura va ANTES del nombre en el orden del documento: es lo que
       se reconoce de un vistazo, y si va después ya se leyó el texto. */
    o.listaMiniPrimero=(function(){
      if(!fila) return false;
      /* En ORDEN DEL DOCUMENTO, no entre los hijos directos: desde que la
         fila entera es el botón que abre el informe, el plano y el nombre
         cuelgan de él y no de la fila. Lo que la prueba defiende es que el
         plano se lea primero, no de quién cuelga; mirando solo los hijos
         directos, cualquier envoltorio nuevo la hacía fallar sin que nada
         se hubiera movido de sitio. */
      const m=fila.querySelector('.pcr-guardada-mini');
      const t=fila.querySelector('.pcr-guardada-t');
      if(!m||!t) return false;
      return !!(m.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
    })();
    return o;
  },{C,POL});

  await pg.screenshot({path:S+'mini-sector.png'});
  await pg.evaluate(async()=>{ window.urbisProCityCerrarStats(); await new Promise(r=>setTimeout(r,200)); window.urbisProCityAbrirAnalisis(); });
  await pg.waitForTimeout(500);
  await pg.screenshot({path:S+'mini-areas.png'});

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  console.log('\n  -- la miniatura --');
  P('un polígono se dibuja como trazado', r.polEsSvg);
  P('con sus vértices', r.polVertices>=6, r.polVertices+' puntos');
  P('con el norte', r.polNorte);
  P('y una barra de escala redonda', r.polEscala, r.escalaTxt);
  P('un radio se dibuja como círculo', r.circEsSvg);
  P('sin forma no devuelve nada', r.vacia);
  console.log('\n  -- áreas guardadas (js/24) --');
  P('la tarjeta lleva el mapa', r.hayTarjetaArea && r.tarjetaTieneSvg, r.tarjetaTexto);
  P('y ocupa espacio real', r.miniAncho>=90 && r.miniAlto>=56, r.miniAncho+'×'+r.miniAlto+' px · tarjeta '+r.cardRect+' · hoja '+r.hojaRect);
  P('sin emojis', r.tarjetaSinEmoji);
  console.log('\n  -- sectores guardados (js/68) --');
  P('la tarjeta lleva el mapa', r.haySector && r.sectorTieneSvg, r.sectorTexto);
  P('la flecha es un icono lineal', r.sectorFlechaSvg);
  P('sin emojis', r.sectorSinEmoji);
  console.log('\n  -- la lista de reconocimientos guardados --');
  P('hay una ficha guardada en la lista', r.hayGuardada);
  P('y lleva su plano, no solo texto', r.listaTieneMini, r.listaMideAlgo);
  P('con los usos encontrados dibujados dentro',
    r.listaTienePuntos, r.listaCuantosPuntos+' puntos en el plano');
  P('el plano va antes del nombre: es lo que se reconoce primero',
    r.listaMiniPrimero);

  console.log('');
  const errReales=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  P('sin errores de JavaScript', errReales.length===0, errReales.slice(0,3).join(' / ')||'ninguno');
  console.log(mal? '\n  '+mal+' fallaron\n' : '\n  todo pasó\n');
  await b.close(); process.exit(mal?1:0);
})();
