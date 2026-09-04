const E = require('../entorno.js');
/* Tanda O · curvas de nivel y sombras de los vecinos.

   Dos maquetas con respuesta conocida:

   · El terreno es una rampa de fórmula que sube 200 m de occidente a oriente
     a lo largo del sector. Con una rampa, las curvas de nivel TIENEN que
     salir verticales (norte-sur), equiespaciadas, y en número igual al
     desnivel dividido por el intervalo. Si el algoritmo se equivoca de eje o
     de interpolación, eso se nota de inmediato.

   · Al OCCIDENTE del lote hay una torre de 10 pisos —30 m— y nada más. En
     Cúcuta, a las 15:00, el sol viene del occidente: la sombra de esa torre
     cae hacia el oriente, o sea SOBRE el lote. A las 9:00 el sol viene del
     oriente y la sombra se va para el otro lado, lejos del lote. Esa
     diferencia entre la mañana y la tarde es lo que la prueba mira.

       torre (10 pisos)        lote
            ▓▓▓                ▭
             │←── 40 m ──→│
       occidente                oriente                                    */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
// Rampa pura de occidente a oriente: la cota depende SOLO de la longitud.
const RAMPA={lng0:C.lng-L, lng1:C.lng+L, z0:300, z1:500};
const cotaDe=(lat,lng)=> RAMPA.z0 + (RAMPA.z1-RAMPA.z0)*((lng-RAMPA.lng0)/(RAMPA.lng1-RAMPA.lng0));

const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<10;i++){ const a=i*36*Math.PI/180, d=(140+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, shop:'convenience'}}); }
const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const edificio=(pts,pisos)=>({type:'way',id:id++,
  tags: pisos?{building:'yes','building:levels':String(pisos)}:{building:'yes'},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Calle 7','residential',[P(-200,-300),P(-200,0),P(-200,300)]),
  via('Avenida 3','secondary',[P(-400,80),P(0,80),P(400,80)]),
  // La torre: 20 × 20 m, centrada 40 m al occidente del lote, 10 pisos.
  edificio([P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)], 10),
  // Y un galpón sin pisos registrados, para que la ficha lo diga.
  edificio([P(60,-60),P(90,-60),P(90,-30),P(60,-30),P(60,-60)], null)
];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',
    body:fs.readFileSync(S+'node_modules/chart.js/dist/chart.umd.js','utf8')}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}})}));
  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map(lng=>cotaDe(0,lng))})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    const trozo=(desde,largo)=>{ const t=txt(); const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo); };

    // ── Trazado (huellas y pisos) y terreno (rejilla de cotas).
    await esperar(5200);
    H().querySelector('[data-pcr="trazado"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);
    await esperar(5200);
    H().querySelector('[data-pcr="terreno"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-corte');i++) await esperar(400);
    await esperar(800);

    // ── El lote, al oriente de la torre.
    const LOTE=[Q(-20,-15),Q(20,-15),Q(20,15),Q(-20,15)];
    H().querySelector('[data-pcr="lote-dibujar"]').click(); await esperar(500);
    LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);

    // ── Las curvas.
    o.curvasTexto=trozo('Curvas de nivel',420);
    H().querySelector('[data-pcr="curvas-mapa"]').click(); await esperar(600);
    o.curvasMapa=(function(){
      const out=[];
      window.map.eachLayer(l=>{ if(l instanceof L.Polyline && !(l instanceof L.Polygon) &&
        l.options && /^#(8A5A20|B08050)$/i.test(l.options.color||'')){
        const pts=l.getLatLngs();
        out.push({ maestra:l.options.color.toUpperCase()==='#8A5A20',
                   n:pts.length,
                   dLng:Math.abs(pts[0].lng-pts[pts.length-1].lng),
                   dLat:Math.abs(pts[0].lat-pts[pts.length-1].lat) });
      }});
      return out;
    })();
    o.barraCurvas=/Curvas de nivel/.test(txt());
    H().querySelector('[data-pcr="curvas-mapa"]').click(); await esperar(500);
    o.curvasApagadas=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.Polyline && l.options &&
        /^#(8A5A20|B08050)$/i.test(l.options.color||'')) n++; });
      return n; })();

    // ── Las sombras.
    const asa=H().querySelector('[data-pcr="agrandar"]');
    if(asa){ asa.click(); await esperar(500); }
    o.sombrasTexto=trozo('La sombra de los vecinos',700);
    o.kpis=[...H().querySelectorAll('.pcr-kpi')]
      .map(k=>(k.textContent||'').replace(/\s+/g,' ').trim())
      .filter(t=>/en sombra a las/.test(t));
    const svgS=H().querySelector('.pcr-sombras');
    o.dibujoSombras={ hay:!!svgS,
      manchas:svgS?svgS.querySelectorAll('g[fill-opacity=".22"] path').length:0,
      etq:svgS?svgS.getAttribute('aria-label'):'' };
    const bs=H().querySelector('[data-pcr="sombras-mapa"]');
    if(bs){ bs.click(); await esperar(600); }
    o.sombrasMapa=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.Polygon && l.options &&
        /^#(F2B441|7C4DFF|0A6F9E)$/i.test(l.options.fillColor||'')) n++; });
      return n; })();

    // ── El papel.
    const asa2=H().querySelector('[data-pcr="agrandar"]');
    if(asa2){ asa2.click(); await esperar(500); }
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La rampa del oriente';
    H().querySelector('[data-pcr="lamina"]').click(); await esperar(700);
    o.lamina=capturado; capturado='';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(700);
    o.pdf=capturado; capturado='';
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  const medir=async(html,w,h)=>{
    const m=await ctx.newPage();
    await m.setViewportSize({width:w,height:h});
    await m.setContent(html||'<i></i>',{waitUntil:'load'});
    await m.waitForTimeout(400);
    const out=await m.evaluate(()=>({
      cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?')
    }));
    await m.close(); return out;
  };
  r.medida=await medir(r.lamina,2268,3402);
  fs.writeFileSync(S+'curvas-lamina.html', r.lamina||'', 'utf8');
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- las curvas de nivel --');
  T('la ficha dice cuántas hay y cada cuánto',
    /curvas cada \d+ m/.test(r.curvasTexto), (r.curvasTexto.match(/\d+ curvas? cada \d+ m/)||['no lo dice'])[0]);
  /* La rejilla se pide con un margen alrededor del contorno —los bordes
     necesitan vecinos para tener pendiente—, así que la rampa se extrapola un
     poco por fuera de los 300–500 del área. Lo que tiene que cumplirse es que
     el rango cubra la rampa y no se dispare. */
  const rango=(r.curvasTexto.match(/entre los (\d+) y los (\d+) msnm/)||[]).slice(1).map(Number);
  T('cubre la rampa entera, con el margen de la rejilla',
    rango.length===2 && rango[0]<=300 && rango[1]>=500 && rango[0]>=270 && rango[1]<=530,
    rango.join(' a ')+' msnm');
  T('y advierte que el modelo no da detalle de manzana',
    /forma del sector/.test(r.curvasTexto) && /topografía de campo/.test(r.curvasTexto));
  const cur=r.curvasMapa||[];
  T('se dibujan sobre el mapa', cur.length>=6, cur.length+' curvas');
  /* La rampa sube de occidente a oriente, así que cada curva de nivel es una
     línea NORTE-SUR: su longitud está en latitud y no en longitud. Si el
     algoritmo confundiera los ejes, saldrían acostadas. */
  T('y una rampa de occidente a oriente las deja verticales',
    cur.length>0 && cur.every(c=>c.dLat>c.dLng*3),
    cur.slice(0,3).map(c=>'Δlat '+c.dLat.toFixed(4)+' vs Δlng '+c.dLng.toFixed(4)).join(' · '));
  T('las de cota redonda van más gruesas', cur.some(c=>c.maestra) && cur.some(c=>!c.maestra),
    cur.filter(c=>c.maestra).length+' maestras de '+cur.length);
  T('la barra de abajo dice qué capa está puesta', r.barraCurvas===true);
  T('y al apagarlas no queda ninguna', r.curvasApagadas===0, r.curvasApagadas+' curvas');

  console.log('\n  -- la sombra de los vecinos --');
  T('sale con las tres horas', (r.kpis||[]).length===3, (r.kpis||[]).join(' · '));
  const pct=h=>{ const k=(r.kpis||[]).filter(t=>t.indexOf(h+':00')>=0)[0]||'';
    const m=k.match(/^(\d+)%/); return m?Number(m[1]):null; };
  /* La torre está al OCCIDENTE del lote. El sol de la tarde viene de allá, así
     que a las 15:00 su sombra cae sobre el lote; el de la mañana viene del
     oriente y la manda para el otro lado. */
  /* La torre mide 30 m y su cara oriental está a 20 m del lote; con el sol de
     la tarde a media altura la sombra entra unos diez metros dentro de los
     cuarenta que mide el lote, y solo en la franja de veinte metros de ancho
     de la torre. Eso da del orden de un quinto del lote, no la mitad: la
     prueba pide que ENTRE, no que lo cubra. */
  T('a las 15:00 la torre del occidente le entra al lote',
    pct(15)>=10 && pct(15)>pct(9), pct(15)+'% del lote');
  T('a las 9:00 no, porque el sol viene del otro lado', pct(9)===0, pct(9)+'% del lote');
  T('el dibujo trae las manchas de las tres horas',
    r.dibujoSombras.hay===true && r.dibujoSombras.manchas>=2, r.dibujoSombras.manchas+' manchas');
  T('y una descripción para quien no lo ve',
    /Sombras de los edificios vecinos/.test(r.dibujoSombras.etq||''));
  T('dice a cuántos metros por piso está contando', /3 m por piso/.test(r.sombrasTexto));
  T('y avisa de los edificios sin pisos registrados',
    /no tienen pisos registrados/.test(r.sombrasTexto),
    (r.sombrasTexto.match(/Otros \d+ no tienen pisos/)||['no avisa'])[0]);
  T('sin árboles, sin muros y con el terreno supuesto plano',
    /árboles/.test(r.sombrasTexto) && /terreno se supone plano/.test(r.sombrasTexto));
  T('se pueden ver en el mapa', r.sombrasMapa>=2, r.sombrasMapa+' polígonos');

  console.log('\n  -- en el papel --');
  const LAM=r.lamina||'', PDF=r.pdf||'';
  T('la lámina dibuja las curvas dentro del plano del sector',
    /stroke="#B08050"/.test(LAM) || /stroke="#8A5A20"/.test(LAM));
  T('y trae la caja de sombras', /La sombra de los vecinos/.test(LAM) && /pcr-sombras/.test(LAM));
  T('el PDF también', /La sombra de los vecinos sobre el lote/.test(PDF) && /pcr-sombras/.test(PDF));
  T('y anota el intervalo de las curvas', /Curvas de nivel cada \d+ m/.test(PDF));
  T('ninguna caja se recorta', (r.medida.cajas||[]).length===0,
    (r.medida.cajas||[]).join(' · ')||'ninguna');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
