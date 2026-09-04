const E = require('../entorno.js');
/* Tanda V · la amenaza sísmica.

   La maqueta NO es inventada: es la respuesta literal que el Servicio
   Geológico Colombiano dio sobre el centro de Cúcuta el 4 de septiembre de
   2026, capturada con la sonda de herramientas/sonda-datos.html. Se conserva
   tal cual —con sus espacios en blanco, su `DESAGREGAC` vacío y su acentuación
   rota en las URL de las imágenes— porque de eso se trata: si el servicio
   cambia la forma de contestar, esta prueba tiene que fallar.

   Lo que vigila, en orden de gravedad:

   · Que Aa = 0,35 y Av = 0,25 lleguen a la ficha sin tocarse. Son los dos
     números con los que la NSR-10 arma el espectro; equivocarlos es el peor
     error que podría cometer esta aplicación.
   · Que «Alta» se traduzca a lo que la norma pide —disipación de energía
     especial— y no a otra cosa.
   · Que la conversión de gal a g sea la de la norma y no una regla de tres
     redondeada: 360 gal ÷ 981 = 0,37 g.
   · Que se elija el municipio MÁS CERCANO. La consulta barre cuarenta
     kilómetros y en esa redonda hay varias cabeceras; contestar la de Villa
     del Rosario cuando el sector es Cúcuta sería un error silencioso.
   · Y que en los tres sitios donde sale —ficha, lámina y PDF— se diga que es
     un valor del MUNICIPIO y no del lote. Sin esa frase, el dato es peor que
     no tenerlo.                                                            */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

// ── La respuesta de verdad del SGC, palabra por palabra ───────────────
const CUCUTA={"OBJECTID":875,"NOMDEPTO":"NORTE DE SANTANDER","NOMMUN":"Cúcuta","NOMCAB":" ",
  "POINT_X":-72.507868,"POINT_Y":7.897548,
  "PGA75":170,"PGA225":270,"PGA475":360,"PGA975":460,"PGA2475":610,
  "ESPECTRO_U":"http://criolita.sgc.gov.co/amenaza-sis/IMG_ESPECTRO/NORTE_DE_SANTANDER%20C%a3cuta.png",
  "CURVAS_DE":"http://criolita.sgc.gov.co/amenaza-sis/IMG_EXCEDENCIA/NORTE_DE_SANTANDER%20C%a3cuta.png",
  "DESAGREGAC":" ","NIVEL":"Alta","AA":0.35,"AV":0.25,"AE":0.25,"AD":0.1,
  "PROYECCION":643666,"TIPO_1":null,"RULEID":1};
/* Un vecino, para comprobar que se elige el más cercano y no el primero de la
   lista. Villa del Rosario está a unos 9 km del centro de Cúcuta, y la
   consulta barre cuarenta: si el código tomara el primero que llega, este
   contestaría por el sector equivocado. Va DE PRIMERO a propósito. */
const VECINO={"OBJECTID":880,"NOMDEPTO":"NORTE DE SANTANDER","NOMMUN":"Villa del Rosario",
  "NOMCAB":" ","POINT_X":-72.4736,"POINT_Y":7.8341,
  "PGA75":160,"PGA225":260,"PGA475":350,"PGA975":450,"PGA2475":600,
  "NIVEL":"Alta","AA":0.30,"AV":0.25,"AE":0.20,"AD":0.1};

const usos=[]; let id=1;
for(let i=0;i<14;i++){ const a=i*26*Math.PI/180, d=(160+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

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
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  // ── El SGC. Se guarda la consulta para poder mirarla después.
  let consulta=null, veces=0;
  await ctx.route(/srvags\.sgc\.gov\.co/, r=>{
    veces++; consulta=decodeURIComponent(r.request().url());
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({features:[{attributes:VECINO},{attributes:CUCUTA}]})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    o.hayModulo=!!window.URBIS_AMENAZA;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    const trozo=(desde,largo)=>{ const t=txt(); const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo); };
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };

    // ── Antes de pedirla: la invitación, no un «sin datos».
    o.antes=trozo('La amenaza sísmica',300);

    // ── Pedirla.
    H().querySelector('[data-pcr="amenaza"]').click();
    for(let i=0;i<50 && !/Aa/.test(txt());i++) await esperar(300);
    await esperar(400);
    await abrir();
    o.ficha=trozo('La amenaza sísmica',1500);
    o.kpis=[...H().querySelectorAll('.pcr-kpi')]
      .map(k=>(k.textContent||'').replace(/\s+/g,' ').trim())
      .filter(t=>/amenaza sísmica|^0,3|^0,2/.test(t));
    o.dibujo=(function(){
      const d=H().querySelector('.pcr-dibujo svg');
      return d?{ hay:true, etq:d.getAttribute('aria-label')||'',
                 puntos:d.querySelectorAll('circle').length }:{hay:false};
    })();
    // Lo que devolvió el módulo, crudo.
    o.crudo=(function(){
      try{ const e=R.estado(); return null; }catch(e){ return null; }
    })();
    o.copiado='';
    H().querySelector('[data-pcr="amenaza-texto"]').click(); await esperar(400);
    await abrir();
    o.copiado=(function(){
      const c=H().querySelector('.pcr-texto,textarea,pre');
      return c?(c.textContent||c.value||''):'';
    })();

    // ── El pliego la conoce.
    await abrir();
    o.enElPliego=(function(){
      const b=H().querySelector('[data-pcr="pliego-caja"][data-c="la-amenaza-sismica"]');
      return b?{ gris:b.classList.contains('pcr-capa-gris'),
                 pie:((b.querySelector('small')||{}).textContent||'').trim() }:null;
    })();

    // ── El papel.
    await abrir();
    H().querySelector('[data-pcr="lamina"]').click(); await esperar(900);
    o.lamina=capturado; capturado='';
    await abrir();
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(900);
    o.pdf=capturado; capturado='';

    // ── Y viaja con la ficha.
    o.guardado=(function(){
      try{ const f=(R.leerFichas()||[])[0];
        return f&&f.amenaza?{ municipio:f.amenaza.municipio, aa:f.amenaza.aa,
                              nivel:f.amenaza.nivel }:null;
      }catch(e){ return null; }
    })();
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const LAM=r.lamina||'', PDF=r.pdf||'', F=r.ficha||'';

  console.log('\n  -- la consulta --');
  T('el módulo está cargado', r.hayModulo===true);
  T('sin pedirla, el bloque invita en vez de decir «sin datos»',
    /coeficientes/.test(r.antes) && /NSR-10/.test(r.antes));
  T('se consulta una sola vez', veces===1, veces+' consultas');
  T('a la capa de 475 años, que es la de diseño',
    /Mapa_Amenaza_Sismica_Nacional_PGA475/.test(consulta||''));
  /* Sin `resultRecordCount`: varias capas de este servidor contestan
     «Pagination is not supported» y se caen enteras. Lo descubrió la sonda. */
  T('sin paginación, que es lo que tumba a este servidor',
    !/resultRecordCount/.test(consulta||''));
  T('pidiendo solo los campos que se usan, y no todo',
    /outFields=NOMDEPTO,NOMMUN/.test(consulta||'') && !/outFields=\*/.test(consulta||''));
  T('y barriendo cuarenta kilómetros, que es lo que separa una cabecera de su borde',
    /distance=40000/.test(consulta||''));

  console.log('\n  -- las cifras de la norma --');
  T('elige el municipio más cercano y no el primero de la lista',
    /Cúcuta/.test(F) && !/Villa del Rosario/.test(F),
    (F.match(/Referido a [^(]*/)||['no lo dice'])[0]);
  /* Contra los KPI y no contra el texto corrido de la hoja: ahí los valores
     salen pegados a su etiqueta —«0,35Aa»— y un límite de palabra entre la
     coma y la A no existe. Mirando la tarjeta se comprueba además que el
     número está donde el ojo lo va a buscar. */
  const kpi = n => (r.kpis||[]).filter(k=>k.indexOf(n)===0)[0]||'';
  T('Aa llega intacto y va en su tarjeta', kpi('0,35')==='0,35Aa', (r.kpis||[]).join(' · '));
  T('y Av también', kpi('0,25')==='0,25Av');
  T('el nivel es el que dijo el servicio', /Alta/.test(F));
  T('y se traduce a lo que la norma pide',
    /disipación de energía especial/.test(F),
    (F.match(/La norma pide[^.]*\./)||['no lo traduce'])[0]);
  /* 360 ÷ 981 = 0,367 → 0,37 g. Si alguien «simplificara» dividiendo por
     1000, saldría 0,36 y la prueba lo caza. */
  T('la conversión de gal a g es la de la norma',
    /Cada 475 años360 gal · 0,37 g/.test(F.replace(/\s+/g,' ').replace(/ (gal|·)/g,' $1')) ||
    /360 gal · 0,37 g/.test(F),
    (F.match(/Cada 475 años[\d]* gal · [\d,]+ g/)||['(no está tal cual)'])[0]);
  T('están los cinco periodos de retorno',
    ['75','225','475','975','2475'].every(t=>new RegExp('Cada '+t+' años').test(F)));
  T('y los coeficientes de los otros dos estados límite',
    /umbral de daño/.test(F) && /seguridad limitada/.test(F));

  console.log('\n  -- lo que hay que decir siempre --');
  T('la ficha avisa que es del municipio y no del lote',
    /valor del municipio, no del lote/i.test(F));
  T('y que una microzonificación mandaría sobre esto', /microzonificación/.test(F));
  T('y que no dimensiona nada: eso lo decide un ingeniero',
    /ingeniero/.test(F));
  T('la lámina lo repite', /no del lote/.test(LAM) && /microzonificación/.test(LAM));
  T('y el PDF también', /no al lote/.test(PDF) && /microzonificación/.test(PDF));
  T('los tres nombran la fuente',
    /Servicio Geológico Colombiano/.test(F) &&
    /Servicio Geológico Colombiano/.test(LAM) &&
    /Servicio Geológico Colombiano/.test(PDF));

  console.log('\n  -- dibujada --');
  T('la curva se dibuja en la ficha', r.dibujo.hay===true);
  T('con un punto por periodo de retorno', (r.dibujo.puntos||0)===5, r.dibujo.puntos+' puntos');
  T('y una descripción para quien no la ve',
    /periodo de retorno/.test(r.dibujo.etq||'') && /475 años, 360 gal/.test(r.dibujo.etq||''),
    r.dibujo.etq);
  T('la lámina la lleva también',
    /<h2>La amenaza sísmica<\/h2>/.test(LAM) && /años de periodo de retorno/.test(LAM));

  console.log('\n  -- en el resto de la aplicación --');
  T('el PDF trae la sección con Aa y Av',
    /<h2>La amenaza sísmica<\/h2>/.test(PDF) && /aceleración horizontal pico efectiva/.test(PDF));
  T('el pliego la ofrece, ya lista', !!r.enElPliego && r.enElPliego.gris===false,
    r.enElPliego?r.enElPliego.pie:'no está en el inventario');
  T('viaja con la ficha, para no volver a esperar al SGC',
    !!r.guardado && r.guardado.aa===0.35 && /Cúcuta/.test(r.guardado.municipio||''),
    r.guardado?JSON.stringify(r.guardado):'no se guardó');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
