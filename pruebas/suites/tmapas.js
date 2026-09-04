const E = require('../entorno.js');
/* Tanda S · la banda de mapas del pliego.

   El curso lo dijo con todas las letras: «en el PDF la diagramación de ese
   pliego es más importante mostrar los mapas con los raster que cualquier
   otra cosa, recuerda que somos visuales». Esta prueba es esa frase escrita
   en código.

   Se monta un sector con tres categorías bien pobladas —comercio, comida y
   educación—, calles y huellas de edificio, y se le da de comer una lectura
   de la foto satelital ya hecha (el clasificador de veras necesita bajar
   teselas, que acá no salen). Con eso, la banda tiene que traer:

     · un recuadro por capa con datos, encendida o apagada;
     · los dos rasters —la clasificación y la foto— PRIMEROS y al doble de
       ancho, con la imagen de verdad dentro del SVG;
     · la banda arriba del todo, antes del texto, en la lámina y en el PDF.

   Y nada de eso puede empujar una caja fuera de la hoja.                   */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
// Un PNG de un píxel: lo único que importa es que sea una imagen válida y
// que su URL viaje entera hasta el atributo href del <image>.
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const nodo=(tags,dx,dy)=>({type:'node',id:id++,lat:P(dx,dy).lat,lon:P(dx,dy).lng,tags:tags});
const usos=[];
// Comercio (6), comida (4) y educación (3): las tres pasan el umbral de tres
// y por lo tanto las tres merecen su propio mapa de calor.
for(let i=0;i<6;i++) usos.push(nodo({shop:'clothes',name:'Ropa '+i}, -180+i*40, 120));
for(let i=0;i<4;i++) usos.push(nodo({amenity:'restaurant',name:'Comida '+i}, 60+i*40, -140));
for(let i=0;i<3;i++) usos.push(nodo({amenity:'school',name:'Colegio '+i}, -120+i*60, -220));
// Y dos sueltos de un rubro flaco, que NO debe ganarse un recuadro.
usos.push(nodo({shop:'optician',name:'Óptica'}, 200, 200));

const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const edificio=(pts,pisos)=>({type:'way',id:id++,
  tags:{building:'yes','building:levels':String(pisos)},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Calle 7','residential',[P(-300,-300),P(-300,0),P(-300,300)]),
  via('Avenida 3','secondary',[P(-400,80),P(0,80),P(400,80)]),
  edificio([P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)], 10),
  edificio([P(60,-60),P(90,-60),P(90,-30),P(60,-30),P(60,-60)], 3),
  edificio([P(120,120),P(160,120),P(160,160),P(120,160),P(120,120)], 5)
];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
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
      body:JSON.stringify({elevation:lngs.map((lng,i)=>320+i*3)})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL,PNG}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    /* La lectura de la foto se sustituye entera: el clasificador de verdad
       baja teselas de satélite, que en este entorno no salen. Lo que la banda
       necesita de él son dos imágenes y sus límites, y eso se le da hecho. */
    const LIM=[[POL[0].lat,POL[0].lng],[POL[2].lat,POL[2].lng]];
    A.analizarRaster = function(avisar){
      if (typeof avisar==='function') avisar('Leyendo la foto…');
      return Promise.resolve({
        pixeles: 480000, imagen: PNG, overlayImagen: PNG, overlayLimites: LIM,
        areaM2: 790000, pctAmbiguo: 12.5,
        clases: [
          {id:'construido', etq:'Superficie dura gris', color:'#94a3b8', pct:52.0, m2:410000, fiable:true, nota:'.'},
          {id:'verde',      etq:'Vegetación viva',      color:'#22c55e', pct:24.5, m2:193000, fiable:true, nota:'.'},
          {id:'mixto',      etq:'Tonos cálidos (no separables)', color:'#c9a26a', pct:12.5, m2:99000, fiable:false, nota:'.'},
          {id:'agua',       etq:'Agua',                 color:'#3b82f6', pct:11.0, m2:87000, fiable:true, nota:'.'}
        ]
      });
    };
    A.mostrarRaster = function(){};

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const btn=id=>H().querySelector('[data-pcr="'+id+'"]');

    // ── Huellas de edificio, para el mapa de llenos y vacíos.
    await esperar(5200);
    btn('trazado').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);

    // ── La foto y su clasificación.
    const bc=btn('cobertura');
    o.hayBotonCobertura=!!bc;
    if(bc){ bc.click(); await esperar(1200); }
    o.cobertura=!!(R.cobertura() && R.cobertura().overlayImagen);

    // ── El lote, para que la lámina tenga también algo que decir del predio.
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    btn('lote-dibujar').click(); await esperar(500);
    [Q(-20,-15),Q(20,-15),Q(20,15),Q(-20,15)].forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);

    // ── El papel.
    const asa=H().querySelector('[data-pcr="agrandar"]');
    if(asa){ asa.click(); await esperar(500); }
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La banda de mapas';
    btn('lamina').click(); await esperar(900);
    o.lamina=capturado; capturado='';
    btn('imprimir').click(); await esperar(900);
    o.pdf=capturado; capturado='';
    return o;
  },{C,POL,PNG});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  const medir=async(html,w,h)=>{
    const m=await ctx.newPage();
    await m.setViewportSize({width:w,height:h});
    await m.setContent(html||'<i></i>',{waitUntil:'load'});
    await m.waitForTimeout(500);
    const out=await m.evaluate(()=>({
      perdidas: (function () {
        const rej = document.querySelector('.rej');
        if (!rej) return [];
        const R = rej.getBoundingClientRect();
        const fuera = [...rej.children].filter(c => {
          const b = c.getBoundingClientRect();
          return b.height === 0 || b.right > R.right + 2;
        }).map(c => (c.querySelector('h2') || {}).textContent || '?');
        const h = document.querySelector('.hoja');
        if (h && h.scrollHeight > h.clientHeight + 2) {
          fuera.push('(la hoja se pasa ' + (h.scrollHeight - h.clientHeight) + ' px de alto)');
        }
        return fuera;
      })(),
      cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?'),
      /* Lo que de veras importa: que el raster ocupe el doble que un mapa
         normal. Si el `span 2` se cae, esto lo caza aunque el HTML esté. */
      anchos: [...document.querySelectorAll('.mapas .mp')].map(f=>({
        grande: f.classList.contains('grande'),
        w: Math.round(f.getBoundingClientRect().width),
        alto: Math.round(f.getBoundingClientRect().height)
      }))
    }));
    await m.close(); return out;
  };
  r.medida=await medir(r.lamina,2268,3402);
  fs.writeFileSync(S+'mapas-lamina.html', r.lamina||'', 'utf8');
  fs.writeFileSync(S+'mapas-pdf.html', r.pdf||'', 'utf8');
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const LAM=r.lamina||'', PDF=r.pdf||'';
  const figuras=h=>(h.match(/<figure class="mp/g)||[]).length;
  const grandes=h=>(h.match(/<figure class="mp grande"/g)||[]).length;
  const titulos=h=>(h.match(/<figcaption>([^<]+)<\/figcaption>/g)||[])
    .map(t=>t.replace(/<[^>]+>/g,''));

  console.log('\n  -- lo que se midió antes de imprimir --');
  T('la foto satelital quedó leída', r.cobertura===true);

  console.log('\n  -- la banda en la lámina --');
  T('existe la banda de mapas', /<section class="caja mapas-banda">/.test(LAM));
  T('va arriba, antes de las columnas de texto',
    LAM.indexOf('mapas-banda')>0 && LAM.indexOf('mapas-banda') < LAM.indexOf('class="rej"'));
  T('trae un recuadro por capa con datos', figuras(LAM)>=6, figuras(LAM)+' recuadros');
  T('cada recuadro tiene su título y su pie',
    titulos(LAM).length===figuras(LAM) &&
    (LAM.match(/<div class="mp-dib">/g)||[]).length===figuras(LAM),
    titulos(LAM).slice(0,4).join(' · '));
  T('los usos salen todos juntos y por categoría',
    /Todos los usos/.test(LAM) && titulos(LAM).filter(t=>/ropa|comida|educa|comerc/i.test(t)).length>=2,
    titulos(LAM).join(' · '));
  T('y el rubro de un solo local no se gana un recuadro',
    !titulos(LAM).some(t=>/óptica/i.test(t)));

  console.log('\n  -- los rasters mandan --');
  T('la clasificación y la foto están las dos',
    /Cobertura del suelo/.test(LAM) && /La foto satelital/.test(LAM));
  T('van primeras de la banda',
    titulos(LAM)[0]==='Cobertura del suelo' && titulos(LAM)[1]==='La foto satelital',
    titulos(LAM).slice(0,2).join(' · '));
  T('marcadas para ocupar el doble', grandes(LAM)===2, grandes(LAM)+' de '+figuras(LAM));
  T('y la hoja les da ese doble ancho', (function(){
    const a=r.medida.anchos||[]; const g=a.filter(x=>x.grande), p=a.filter(x=>!x.grande);
    return g.length===2 && p.length>0 && g[0].w > p[0].w*1.6;
  })(), (r.medida.anchos||[]).map(x=>(x.grande?'▮':'▫')+x.w).join(' '));
  T('la imagen viaja de verdad dentro del dibujo',
    (LAM.match(/<image href="data:image\/png;base64,/g)||[]).length===2,
    (LAM.match(/<image href="data:image\/png/g)||[]).length+' imágenes');
  T('el pie dice con qué se quedó la clasificación',
    /Superficie dura gris 52%/.test(LAM));

  console.log('\n  -- la banda en el PDF --');
  T('el PDF también empieza por los mapas',
    /Los mapas del sector/.test(PDF) &&
    PDF.indexOf('Los mapas del sector') < PDF.indexOf('Qué hay, por categoría'));
  T('con los mismos recuadros', figuras(PDF)>=6, figuras(PDF)+' recuadros');
  T('los rasters primeros y al doble', grandes(PDF)===2 &&
    titulos(PDF)[0]==='Cobertura del suelo', titulos(PDF).slice(0,3).join(' · '));
  T('y la hoja sabe darles ese doble',
    /\.mp\.grande\{grid-column:span 2\}/.test(PDF));
  T('un recuadro no se parte entre dos páginas',
    /break-inside:avoid/.test(PDF));
  T('la imagen de la foto va dentro del PDF',
    (PDF.match(/<image href="data:image\/png;base64,/g)||[]).length===2);

  console.log('\n  -- y nada se cae de la hoja --');
  T('ninguna caja se recorta', (r.medida.cajas||[]).length===0,
    (r.medida.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde fuera de la hoja', (r.medida.perdidas||[]).length===0,
    (r.medida.perdidas||[]).join(' · ')||'ninguna');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
