const E = require('../entorno.js');
/* La lámina de 60 × 90 cm: la hoja vertical que se cuelga en el salón, con el
   plano del sector y todo lo que se midió. Se comprueba el HTML que se manda a
   imprimir —no se puede mirar una impresión— y sobre todo que NO invente: lo
   que no se midió no aparece rotulado como «sin datos», sencillamente no está.
   Se dobla Overpass (usos y geometría), la elevación y el archivo climático
   para que las tres mediciones de la tanda B estén disponibles. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

const usos=[]; let id=1;
for(let i=0;i<30;i++){ const a=i*12*Math.PI/180, d=(150+(i%5)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }
// Un hito con nombre para que el bloque de hitos tenga qué decir.
usos.push({type:'node',id:id++,lat:C.lat+0.0006,lon:C.lng+0.0006,
  tags:{name:'Centro Comercial Ventura', shop:'mall'}});

/* La geometría: cuadrícula de calles que comparten el nodo del cruce, y 40
   edificios de 10 × 10 m. Es lo que da llenos y vacíos y las huellas del
   plano. */
const geo=[]; const N=6, paso=L*1.4/(N-1), ini=-L*0.7;
const xs=[], ys=[];
for(let i=0;i<N;i++){ xs.push(ini+i*paso); ys.push(ini+i*paso); }
xs.forEach((x,i)=>geo.push({type:'way',id:id++,tags:{highway:i===0?'primary':'residential',name:'Calle '+i},
  geometry:ys.map(y=>({lat:C.lat+y,lon:C.lng+x}))}));
ys.forEach((y,i)=>geo.push({type:'way',id:id++,tags:{highway:i===1?'secondary':'residential',name:'Avenida '+i},
  geometry:xs.map(x=>({lat:C.lat+y,lon:C.lng+x}))}));
for(let i=0;i<40;i++){
  const dx=(-L*0.6+(i%8)*(L*0.17)), dy=(-L*0.6+Math.floor(i/8)*(L*0.24)), d=0.00009;
  geo.push({type:'way',id:id++,tags:{building:'house','building:levels':String(1+(i%4))},geometry:[
    {lat:C.lat+dy,lon:C.lng+dx},{lat:C.lat+dy+d,lon:C.lng+dx},
    {lat:C.lat+dy+d,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx}]});
}

const RAMPA={ lng0:C.lng-L, lng1:C.lng+L, z0:340, z1:454 };
const cotaDe=lng=>RAMPA.z0+(RAMPA.z1-RAMPA.z0)*((lng-RAMPA.lng0)/(RAMPA.lng1-RAMPA.lng0));

function climaSimulado(){
  const dias=[]; const ini2=new Date(Date.UTC(2021,0,1));
  for(let i=0;i<365*5;i++){
    const d=new Date(ini2.getTime()+i*86400000), mes=d.getUTCMonth();
    const lluvioso=(mes===3||mes===4||mes===9||mes===10);
    dias.push({ f:d.toISOString().slice(0,10), tMax: mes===2?34:31, tMin:22,
      lluvia: lluvioso?(i%3===0?12:2):(i%9===0?3:0), viento:15, vientoDir:45 });
  }
  return dias;
}

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
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',
      city_district:'Comuna 2', suburb:'La Playa', road:'Avenida 3'}})}));
  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  await ctx.route(/archive-api\.open-meteo\.com/, r=>{
    const d=climaSimulado();
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      timezone:'America/Bogota',
      daily:{ time:d.map(x=>x.f), temperature_2m_max:d.map(x=>x.tMax), temperature_2m_min:d.map(x=>x.tMin),
        precipitation_sum:d.map(x=>x.lluvia), wind_speed_10m_max:d.map(x=>x.viento),
        wind_direction_10m_dominant:d.map(x=>x.vientoDir) }})});
  });
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elevation:lngs.map(cotaDe)})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    // La lámina se manda a imprimir; acá se atrapa en vez de abrir ventana.
    let capturado='';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function(h){ capturado=h; };

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(900);
    const H=()=>document.getElementById('pcr-hoja');
    const bLam=()=>H().querySelector('[data-pcr="lamina"]');

    o.hayBoton=!!bLam();

    // ── Primero, SIN medir nada: la lámina no debe traer terreno ni clima
    bLam().click(); await esperar(300);
    o.pelada=capturado; capturado='';
    /* Y la misma, acostada. El pliego de 90 × 60 tiene 300 mm menos de alto y
       el plano crece para llenarlos: con un sector sin nada medido hay menos
       cajas que repartir, que es justo cuando el plano se puede pasar. */
    H().querySelector('[data-pcr="lamina-h"]').click(); await esperar(300);
    o.peladaH=capturado; capturado='';

    // ── Ahora las tres mediciones de la tanda B
    const medir=async(acc, sel)=>{
      const b=H().querySelector('[data-pcr="'+acc+'"]');
      if(!b) return false;
      b.click();
      for(let i=0;i<70 && !document.querySelector(sel);i++) await esperar(400);
      await esperar(250); return !!document.querySelector(sel);
    };
    await esperar(5200);   // el limitador de Overpass: se espera, como una persona
    o.midioTrazado=await medir('trazado','.pcr-llenos');
    o.avisoTrz=(function(){const e=H().querySelector('.pcr-error');return e?e.textContent.trim():'';})();
    o.midioTerreno=await medir('terreno','.pcr-corte');
    o.midioClima=await medir('clima','.pcr-clima-lluvia');

    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La Playa, entre calles 8 y 12';
    bLam().click(); await esperar(400);
    o.html=capturado; capturado='';

    /* ── Y la lámina de un sector GUARDADO. Para que la prueba valga de algo
       hay que ensuciar el estado primero: se guarda la ficha, se analiza OTRO
       sector con otro nombre y sin medirle nada, y recién ahí se imprime la
       guardada. Si la lámina leyera el estado en vez de la ficha, saldría con
       el nombre del sector nuevo y con el terreno del viejo mezclados. */
    const bg=[...H().querySelectorAll('button')].filter(b=>/Guardar ficha/i.test(b.textContent||''))[0];
    if(bg){ bg.click(); await esperar(600); }
    o.guardada=(function(){
      try{ const f=JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]')[0]||{};
        return { nombre:f.nombre||'', ter:!!f.terreno, cli:!!f.clima, trz:!!f.trazado }; }
      catch(e){ return {error:String(e)}; }
    })();

    A.limpiarArea(); A.iniciarDibujo();
    const L2=0.0018;
    [[-L2,-L2],[L2,-L2],[L2,L2],[-L2,L2],[-L2,-L2]].forEach(([a,c])=>A.agregarPunto(C.lat+a,C.lng+c));
    R.cerrar(); await esperar(200); R.abrir(); await esperar(300);
    await esperar(5200);
    await R.analizar(); await esperar(1200);
    const caja2=document.getElementById('pcr-nombre');
    if(caja2) caja2.value='Otro sector, sin medir nada';
    o.nombreEnPantalla='Otro sector, sin medir nada';

    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(700);
    /* Se abre la pestaña del sector CON NOMBRE, no la primera: el análisis
       se guarda solo, así que arriba está el sector nuevo. */
    const cabs=[...document.querySelectorAll('.pcr-pest-cab')];
    o.pestanas=cabs.map(c=>(c.textContent||'').replace(/\s+/g,' ').trim().slice(0,60));
    const cab=cabs.filter(c=>/La Playa/.test(c.textContent||''))[0]||cabs[0];
    if(cab){ cab.click(); await esperar(600); }
    const bg2=document.querySelector('[data-u52-call="pcr-lamina"]');
    o.hayBotonGuardado=!!bg2;
    if(bg2){ bg2.click(); await esperar(500); }
    o.htmlGuardado=capturado;
    /* El sector NUEVO —el que se analizó sin medirle nada— no puede haber
       heredado ni el nombre ni la climatología del anterior. */
    o.fichas=(function(){
      try{ return JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]')
        .map(f=>({ n:f.nombre||'(sin nombre)', ter:!!f.terreno, cli:!!f.clima, trz:!!f.trazado })); }
      catch(e){ return [{error:String(e)}]; }
    })();
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));

  /* La hoja mide 900 mm y no puede crecer: si el contenido se pasa, las
     últimas cajas se recortan en silencio —el bloque del clima perdía su
     lectura y en pantalla no se notaba, solo al imprimir—. Así que se monta
     la lámina a tamaño real y se mide si algo desborda su caja. */
  const medidorH=await ctx.newPage();
  await medidorH.setViewportSize({width:3402,height:2268});
  await medidorH.setContent(r.peladaH||'<i></i>',{waitUntil:'load'});
  await medidorH.waitForTimeout(400);
  r.desbordesH=await medidorH.evaluate(()=>{
    const h=document.querySelector('.hoja'), rej=document.querySelector('.rej');
    return { cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?'),
      papel:h?h.clientHeight:0, rej:rej?rej.clientHeight:0,
      /* Lo usado de la rejilla es hasta dónde baja la última caja, no la suma
         de los altos: las cajas de una misma fila se sumarían tres veces. */
      usado:rej?[...rej.children].reduce((a,c)=>Math.max(a,c.getBoundingClientRect().bottom),0)
                 - rej.getBoundingClientRect().top : 0 };
  });
  await medidorH.close();

  const medidor=await ctx.newPage();
  await medidor.setViewportSize({width:2268,height:3402});
  await medidor.setContent(r.html||'<i></i>',{waitUntil:'load'});
  await medidor.waitForTimeout(400);
  r.desbordes=await medidor.evaluate(()=>{
    const h=document.querySelector('.hoja');
    return {
      altoHoja: h?h.scrollHeight:0,
      cajas: [...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?')
    };
  });
  await medidor.close();
  await pg.close(); await b.close();

  fs.writeFileSync(S+'lamina-generada.html', r.html||'', 'utf8');
  fs.writeFileSync(S+'lamina-guardada.html', r.htmlGuardado||'', 'utf8');

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const h=r.html||'';
  const cajas=(h.match(/<section class="caja[^"]*"><h2>([^<]+)<\/h2>/g)||[])
    .map(x=>x.replace(/.*<h2>/,'').replace('</h2>',''));

  console.log('\n  -- el botón está donde se lo busca --');
  P('en la ficha en pantalla', r.hayBoton);
  P('y en el sector guardado', r.hayBotonGuardado);

  console.log('\n  -- el mismo pliego acostado, con un sector sin medir --');
  const DH=r.desbordesH||{};
  P('sale en 90 × 60', /@page\{ size:900mm 600mm; margin:0 \}/.test(r.peladaH||''));
  P('con las mismas cajas que el vertical',
    (r.peladaH||'').match(/<section class="caja/g).length===(r.pelada||'').match(/<section class="caja/g).length);
  P('ninguna caja se recorta', (DH.cajas||[]).length===0, (DH.cajas||[]).join(' · ')||'ninguna');
  P('y el plano llena el papel en vez de dejar una banda blanca',
    DH.rej>0 && DH.usado > DH.rej*0.8, Math.round(100*(DH.usado||0)/(DH.rej||1))+'% del alto usado');

  console.log('\n  -- el papel --');
  P('la hoja es de 60 × 90 cm, vertical, sin márgenes de impresora',
    /@page\{\s*size:600mm 900mm;\s*margin:0\s*\}/.test(h));
  P('y el cuerpo mide lo mismo', /width:600mm; height:900mm/.test(h));
  P('lleva la marca arriba a la izquierda',
    h.indexOf('<div class="marca"><b>URBIS</b>') < h.indexOf('<div class="tit">'));
  P('con el nombre que puso el estudiante', /<h1>La Playa, entre calles 8 y 12<\/h1>/.test(h));
  P('y la cadena de ubicación', /Colombia › Norte de Santander › Cúcuta/.test(h),
    (h.match(/<div class="cad">([^<]*)/)||[])[1]||'no sale');

  console.log('\n  -- el plano, que es lo que la hace una lámina --');
  P('dibuja el contorno del área', /class="plano"/.test(h) && /pca-minimapa/.test(h));
  const plano=(h.match(/<div class="plano">[\s\S]*?<\/svg>/)||[''])[0];
  const puntos=(plano.match(/<circle /g)||[]).length;
  const huellas=(plano.match(/fill="#3B4A5A"/g)||[]).length;
  P('con los usos mapeados dentro', puntos>=25, puntos+' círculos');
  P('y las huellas de los edificios', huellas>=35, huellas+' huellas');
  P('el contorno no los tapa con relleno', /stroke="#0A6F9E"/.test(plano) && !/fill="rgba\(52,204,254/.test(plano));
  P('lleva convenciones de color', /class="conv"/.test(h) && (h.match(/class="cv"/g)||[]).length>=2,
    (h.match(/class="cv"/g)||[]).length+' entradas');
  P('y escala y norte', /pca-minimapa/.test(plano) && />N</.test(plano));

  console.log('\n  -- lo que se midió, y solo eso --');
  console.log('   [diag] trazado '+r.midioTrazado+' · terreno '+r.midioTerreno+' · clima '+r.midioClima+
              (r.avisoTrz?'  aviso: '+r.avisoTrz:''));
  P('trae los nueve bloques', cajas.length>=9, cajas.join(' · '));
  ['Plano del sector','El sitio','Qué hay, por categoría','Alturas de lo construido',
   'Llenos y vacíos','El terreno','El clima','Asoleamiento','Hitos y nodos']
    .forEach(t=>P('  · '+t, cajas.indexOf(t)!==-1));
  P('el terreno trae los dos cortes', (h.match(/pcr-corte/g)||[]).length>=2);
  P('el clima trae el climograma', /pcr-clima-lluvia/.test(h) && /pcr-clima-temp/.test(h));
  P('el asoleamiento sale sin consultar nada', /amanecer/.test(h) && /atardecer/.test(h));

  console.log('\n  -- sin huecos rotulados «sin datos» --');
  const pel=r.pelada||'';
  const cajasPel=(pel.match(/<h2>([^<]+)<\/h2>/g)||[]).map(x=>x.replace(/<\/?h2>/g,''));
  P('antes de medir, el terreno no aparece', cajasPel.indexOf('El terreno')===-1);
  P('ni el clima', cajasPel.indexOf('El clima')===-1);
  P('ni los llenos y vacíos', cajasPel.indexOf('Llenos y vacíos')===-1);
  P('pero el plano y el sitio sí', cajasPel.indexOf('Plano del sector')!==-1 && cajasPel.indexOf('El sitio')!==-1,
    cajasPel.join(' · '));
  P('en ninguna de las dos aparece «sin datos»', !/sin datos/i.test(h) && !/sin datos/i.test(pel));

  console.log('\n  -- el sector guardado imprime lo SUYO --');
  console.log('   [diag] ficha guardada: '+JSON.stringify(r.guardada));
  console.log('   [diag] fichas: '+JSON.stringify(r.fichas)+'  pestañas: '+JSON.stringify(r.pestanas));
  const nueva=(r.fichas||[])[0]||{};
  P('el sector nuevo no hereda el nombre del anterior', !/La Playa/.test(nueva.n||''), nueva.n);
  P('ni su climatología, que es de otro sitio', nueva.cli===false && nueva.ter===false);
  const hg=r.htmlGuardado||'';
  P('sale la lámina del sector guardado', hg.length>2000, hg.length+' caracteres');
  P('con su propio nombre, no el del sector que está en pantalla',
    /<h1>La Playa, entre calles 8 y 12<\/h1>/.test(hg) && hg.indexOf(r.nombreEnPantalla)===-1,
    (hg.match(/<h1>([^<]*)<\/h1>/)||[])[1]||'sin título');
  P('y con el terreno y el clima que se le midieron', /El terreno<\/h2>/.test(hg) && /El clima<\/h2>/.test(hg));
  P('el plano no pierde el color de los usos', !/fill="#94a3b8"/.test((hg.match(/<div class="plano">[\s\S]*?<\/svg>/)||[''])[0]));

  console.log('\n  -- cabe en la hoja --');
  const dd=r.desbordes||{};
  P('ninguna caja se sale de su recuadro', (dd.cajas||[]).length===0,
    (dd.cajas||[]).join(' · ')||'ninguna');
  P('y la hoja no se pasa de los 900 mm', dd.altoHoja>0 && dd.altoHoja<=3404,
    dd.altoHoja+' px de 3402');

  console.log('\n  -- letra y tono --');
  P('tipografía Inter, como el resto de URBIS', /font-family:Inter/.test(h));
  P('sin un solo emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(h),
    (h.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu)||[]).join(' ')||'ninguno');
  P('el pie dice de dónde salió cada cosa',
    /OpenStreetMap/.test(h) && /DANE/.test(h) && /urbispro\.city/.test(h));
  P('y advierte que esto no es el sector', /no es el sector/.test(h));

  console.log('');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
