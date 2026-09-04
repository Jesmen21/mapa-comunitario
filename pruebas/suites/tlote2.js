const E = require('../entorno.js');
/* Tanda J · el lote a intervenir.

   El área contesta «qué hay alrededor». El lote contesta «dónde voy a
   proponer algo». Son dos preguntas distintas, y hasta ahora solo existía la
   primera: la estudiante analizaba el sector y después tenía que medir su
   terreno a mano en el plano.

   La geometría está armada para poder comprobar cada cifra sin fórmulas:
   un lote RECTANGULAR de 40 × 20 m —800 m², 120 m de perímetro— con la
   Avenida 3 corriendo pegada a su lado largo del sur y la Calle 12 pegada a
   su lado corto del occidente. Así:
     · el frente sobre la Avenida 3 tiene que dar 40 m,
     · el de la Calle 12, 20 m,
     · es esquinero, y
     · la fachada que se calienta es la que mira al occidente.            */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));

// Usos del sector, y tres bien cerca del lote para que salgan como vecinos.
const usos=[]; let id=1;
for(let i=0;i<20;i++){ const a=i*18*Math.PI/180, d=(400+(i%3)*120)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'Lejano '+i, amenity:'restaurant'}}); }
usos.push({type:'node',id:id++,lat:C.lat+GLAT(40),lon:C.lng+GLNG(30),tags:{name:'Droguería La Esquina',amenity:'pharmacy'}});
usos.push({type:'node',id:id++,lat:C.lat+GLAT(-30),lon:C.lng+GLNG(60),tags:{name:'Colegio San José',amenity:'school'}});
usos.push({type:'node',id:id++,lat:C.lat+GLAT(70),lon:C.lng+GLNG(-40),tags:{name:'Panadería El Trigal',shop:'bakery'}});

/* El lote: rectángulo de 40 m de este a oeste por 20 m de sur a norte, con su
   esquina suroccidental en el centro del área. */
const LOTE=[
  {lat:C.lat,             lng:C.lng},
  {lat:C.lat,             lng:C.lng+GLNG(40)},
  {lat:C.lat+GLAT(20),    lng:C.lng+GLNG(40)},
  {lat:C.lat+GLAT(20),    lng:C.lng}
];

/* Las calles: la Avenida 3 pega al sur del lote (a 8 m), la Calle 12 pega al
   occidente (a 8 m). Las dos se alargan para que no haya duda de a cuál da
   cada lado. */
const geo=[
  { type:'way', id:id++, tags:{highway:'secondary', name:'Avenida 3'},
    geometry:[{lat:C.lat+GLAT(-8), lon:C.lng+GLNG(-200)},
              {lat:C.lat+GLAT(-8), lon:C.lng+GLNG(200)}] },
  { type:'way', id:id++, tags:{highway:'residential', name:'Calle 12'},
    geometry:[{lat:C.lat+GLAT(-200), lon:C.lng+GLNG(-8)},
              {lat:C.lat+GLAT(200),  lon:C.lng+GLNG(-8)}] }
];
for(let i=0;i<12;i++){
  const dx=(-300+i*30), d=0.00009;
  geo.push({type:'way',id:id++,tags:{building:'house','building:levels':'2'},geometry:[
    {lat:C.lat+GLAT(200),lon:C.lng+GLNG(dx)},{lat:C.lat+GLAT(200)+d,lon:C.lng+GLNG(dx)},
    {lat:C.lat+GLAT(200)+d,lon:C.lng+GLNG(dx)+d},{lat:C.lat+GLAT(200),lon:C.lng+GLNG(dx)+d},
    {lat:C.lat+GLAT(200),lon:C.lng+GLNG(dx)}]});
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
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}})}));
  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL,LOTE}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],19); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    let lamina=''; window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ lamina=h; };

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');

    /* Los frentes salen de la forma de las calles, y esa la trae el trazado.
       Sin medirlo, el lote sabe cuánto mide pero no a qué da — y el bloque lo
       dice así, que también se comprueba abajo. */
    o.sinTrazado=/hace falta medir el trazado/.test(txt(H()));
    await esperar(5200);
    H().querySelector('[data-pcr="trazado"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(400);

    o.hayLapiz=!!H().querySelector('[data-pcr="lote-dibujar"]');
    o.antesSinCifras=!/m² de lote/.test(txt(H()));

    // ── A dibujar: el lápiz abre la barra y encoge la hoja.
    o.zoomAntes=window.map.getZoom();
    H().querySelector('[data-pcr="lote-dibujar"]').click();
    await esperar(500);
    o.zoomDespues=window.map.getZoom();
    o.pxEntreEsquinas=(function(){ try{
      const a=window.map.latLngToContainerPoint(LOTE[0]);
      const b=window.map.latLngToContainerPoint(LOTE[3]);
      return Math.round(Math.hypot(a.x-b.x,a.y-b.y));
    }catch(e){ return 0; } })();
    o.hayBarra=!!document.getElementById('pcr-lote-barra');
    o.hojaEncogida=H().classList.contains('pcr-encogida');
    o.textoBarra=txt(document.getElementById('pcr-lote-barra'));

    // Tocar el mapa, esquina por esquina.
    const tocar=(p)=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}});
    LOTE.forEach(p=>tocar(p)); await esperar(400);
    o.esquinasPuestas=txt(document.getElementById('pcr-lote-barra'));
    o.dibujadoEnMapa=document.querySelectorAll('.leaflet-overlay-pane path').length;

    // Deshacer y volver a poner: la barra tiene que responder.
    document.querySelector('[data-lote="deshacer"]').click(); await esperar(250);
    o.trasDeshacer=txt(document.getElementById('pcr-lote-barra'));
    tocar(LOTE[3]); await esperar(250);

    document.querySelector('[data-lote="cerrar"]').click(); await esperar(600);
    o.barraSeFue=!document.getElementById('pcr-lote-barra');
    o.hojaVolvio=!H().classList.contains('pcr-encogida');

    const todo=txt(H());
    const i=todo.indexOf('El lote a intervenir');
    o.bloque=i>=0?todo.slice(i,i+2200):'';
    o.kpis=[...H().querySelectorAll('.pcr-kpi')].map(txt).filter(x=>/de lote|de perímetro|esquinas/.test(x));
    o.filas=[...H().querySelectorAll('.pcr-lote-fila')].map(txt);

    // A la lámina.
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='Sector con lote';
    const bl=H().querySelector('[data-pcr="lamina"]');
    if(bl){ bl.click(); await esperar(500); }
    o.lamina=lamina;

    // Guardar y reabrir: el lote no se pierde.
    const bg=[...H().querySelectorAll('button')].filter(x=>/Guardar ficha/i.test(x.textContent||''))[0];
    if(bg){ bg.click(); await esperar(700); }
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    // El panel de Pro City se arma aparte del mapa: se espera a que exista la
    // cabecera antes de tocarla, en vez de contar los milisegundos.
    for(let i=0;i<40 && !document.querySelector('.pcr-pest-cab');i++) await esperar(200);
    await esperar(400);
    const cabs=[...document.querySelectorAll('.pcr-pest-cab')];
    const cab=cabs.filter(x=>/Sector con lote/.test(x.textContent||''))[0]||cabs[0];
    if(cab){ cab.click(); await esperar(900); }
    /* Que la pestaña ABRA es media prueba en sí misma: una ficha guardada con
       lote no se abría porque las horas del sol vuelven de JSON como texto y
       el informe reventaba al pintarlas. El fallo no se veía —la pestaña
       simplemente no reaccionaba— así que se comprueba aparte. */
    o.pestanaAbrio=!!document.querySelector('.pcr-pest-cuerpo');
    const pest=document.querySelector('.pcr-pestana');
    o.enGuardada=pest?txt(pest):'';
    o.guardado=(function(){ try{
      const f=JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]')[0]||{};
      return { esquinas:(f.lote||[]).length, conAnalisis:!!f.loteAnalisis };
    }catch(e){ return {esquinas:0,conAnalisis:false}; } })();
    o.guardadaSinLapiz=!(pest && pest.querySelector('[data-pcr="lote-dibujar"]'));
    return o;
  },{C,POL,LOTE});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));

  // La lámina a tamaño real: con una caja más, hay que volver a mirar el papel.
  const medidor=await ctx.newPage();
  await medidor.setViewportSize({width:2268,height:3402});
  await medidor.setContent(r.lamina||'<i></i>',{waitUntil:'load'});
  await medidor.waitForTimeout(400);
  r.desbordes=await medidor.evaluate(()=>[...document.querySelectorAll('.caja')]
    .filter(c=>c.scrollHeight>c.clientHeight+2)
    .map(c=>(c.querySelector('h2')||{}).textContent||'?'));
  await medidor.close();
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const B=r.bloque||'', LAM=r.lamina||'';
  const kpi=re=>{
    const k=(r.kpis||[]).filter(x=>re.test(x))[0];
    if(!k) return null;
    const m=k.match(/^([\d.,]+)/);
    return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
  };
  const fila=re=>((r.filas||[]).filter(x=>re.test(x))[0]||'');

  console.log('\n  -- el lápiz del lote --');
  P('aparece cuando ya hay sector analizado', r.hayLapiz===true);
  P('y antes de dibujar no hay cifras del lote', r.antesSinCifras===true);
  P('al tocarlo sale la barra de dibujo', r.hayBarra===true, r.textoBarra.slice(0,60));
  P('y la hoja se encoge para poder ver el mapa', r.hojaEncogida===true);
  /* A la escala de un sector entero, un lote de veinte metros mide diez
     píxeles: la cuarta esquina caería encima de la primera y cerraría el lote
     sola. El lápiz acerca antes de dejar dibujar. */
  P('y el mapa se acerca para poder marcar esquinas', r.zoomDespues>=18 && r.zoomDespues>r.zoomAntes,
    'de zoom '+r.zoomAntes+' a '+r.zoomDespues+' · las esquinas quedan a '+r.pxEntreEsquinas+' px');
  P('la barra cuenta las esquinas', /4 esquinas/.test(r.esquinasPuestas||''),
    (r.esquinasPuestas||'').slice(0,60));
  P('deshacer quita la última', /3 esquinas/.test(r.trasDeshacer||''),
    (r.trasDeshacer||'').slice(0,60));
  P('el lote se dibuja en el mapa', r.dibujadoEnMapa>0, r.dibujadoEnMapa+' formas');
  P('al cerrar, la barra se va', r.barraSeFue===true);
  P('y la hoja vuelve a abrirse con el análisis', r.hojaVolvio===true);

  console.log('\n  -- las medidas del lote, contra la cuenta hecha a mano --');
  P('un rectángulo de 40 × 20 da 800 m²',
    Math.abs(kpi(/de lote/)-800)<15, 'esperado 800 · da '+kpi(/de lote/));
  P('y 120 m de perímetro',
    Math.abs(kpi(/de perímetro/)-120)<3, 'esperado 120 · da '+kpi(/de perímetro/));
  P('con cuatro esquinas', kpi(/esquinas/)===4, kpi(/esquinas/));

  console.log('\n  -- a qué calles da --');
  P('el lado largo da a la Avenida 3, con 40 m de frente',
    /Avenida 3/.test(fila(/Avenida 3/)) && /40 m de frente/.test(fila(/Avenida 3/)),
    fila(/Avenida 3/)||'no sale');
  P('y el corto a la Calle 12, con 20',
    /20 m de frente/.test(fila(/Calle 12/)), fila(/Calle 12/)||'no sale');
  P('lo reconoce como lote esquinero', /lote esquinero/i.test(B),
    (B.match(/Es un [^.]*\./)||['no lo dice'])[0]);
  P('y los lados sin calle enfrente se cuentan aparte',
    /no dan a ninguna calle registrada/.test(B),
    (B.match(/Otros \d+ m/)||['no lo dice'])[0]);

  console.log('\n  -- hacia dónde mira cada lado --');
  P('lista los cuatro lados con su rumbo',
    (r.filas||[]).filter(x=>/^Lado \d/.test(x)).length===4,
    (r.filas||[]).filter(x=>/^Lado \d/.test(x)).join(' | ').slice(0,140));
  P('y señala la fachada que se calienta, la del occidente',
    /fachada que se calienta/.test(B) && /occidente/.test(B),
    (B.match(/La fachada que se calienta[^.]*\./)||['no lo dice'])[0].slice(0,110));

  console.log('\n  -- qué tiene al lado --');
  P('nombra los usos más cercanos', /Droguería La Esquina/.test(B) && /Colegio San José/.test(B));
  P('con su distancia', /a \d+ m/.test(B), (B.match(/Droguería La Esquina.{0,12}/)||[''])[0]);
  P('y aclara que se mide desde el centro, no desde la puerta',
    /desde el centro, no desde la puerta/.test(B));

  console.log('\n  -- llega a la lámina --');
  P('la lámina trae la caja del lote', /El lote a intervenir<\/h2>/.test(LAM));
  P('y lo dibuja en el plano, en amarillo',
    /fill="#FFD54F" fill-opacity=".45" stroke="#7A5901"/.test(LAM));
  P('con su convención', /El lote a intervenir<\/span>|class="lote"/.test(LAM));
  P('y sigue cabiendo en la hoja', (r.desbordes||[]).length===0,
    (r.desbordes||[]).join(' · ')||'ninguna caja se sale');

  console.log('\n  -- el sector guardado no lo pierde --');
  P('el lote viaja con la ficha, con su análisis ya hecho',
    (r.guardado||{}).esquinas===4 && (r.guardado||{}).conAnalisis===true,
    JSON.stringify(r.guardado));
  P('y la pestaña de ese sector abre', r.pestanaAbrio===true,
    'una ficha con lote no abría: las horas del sol vuelven de JSON como texto');
  P('la ficha guardada trae el lote', /El lote a intervenir/.test(r.enGuardada||''));
  P('con sus frentes', /Avenida 3/.test(r.enGuardada||''));
  P('y sin ofrecer volver a dibujarlo ahí', r.guardadaSinLapiz===true);

  console.log('');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
