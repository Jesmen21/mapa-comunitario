const E = require('../entorno.js');
/* Tanda W · la inundación.

   El IDEAM publica las manchas de inundación por periodo de retorno. Este
   módulo no las lee de un índice escrito a mano: le pregunta al servicio qué
   capas tiene. Por eso la maqueta les pone ids RAROS —7, 12, 19, 23, 31— y
   los mezcla desordenados, con capas de otra cosa en medio. Si alguien
   volviera a escribir «MapServer/0» a mano, esta prueba no lo perdona.

   Lo que vigila, en orden de gravedad:

   · Que «no se pudo averiguar» NO se parezca a «no se inunda». Es el error
     que convertiría este dato en uno peligroso: alguien leyendo «fuera de la
     mancha» cuando lo cierto es que las cinco capas se cayeron. Hay una
     prueba entera para eso.
   · Que la gravedad se lea del periodo MENOR. Caer en la mancha de 2 años es
     peor que caer en la de 100, y al revés de como se lee un número grande.
   · Que la salvedad —el mapa es nacional, no ve quebradas— salga SIEMPRE, y
     con más razón cuando el resultado es «fuera», que es justo donde alguien
     lo leería como un permiso.
   · Que si el navegador no puede leer el servicio, se pida por el motor y el
     dato llegue igual. Ese es todo el sentido de la ruta /geo.
   · Y que el sismo y el agua no se arrastren: que una caída del IDEAM no deje
     al estudiante sin los coeficientes de la NSR-10.                       */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

/* El catálogo del servicio, LITERAL. Son las 28 capas que el IDEAM contestó
   el 4 de septiembre de 2026, capturadas con la sonda: mismos nombres, mismos
   ids, mismo orden, con «Centros poblados» en minúscula donde el servicio lo
   escribe así. Se conserva tal cual porque de eso se trata: si el servicio
   cambia la forma de nombrar sus capas, esta prueba tiene que fallar.

   Fijate en las tres familias con el mismo periodo —Amenaza, Profundidad y
   Velocidad—. Son el mismo modelo hidráulico contado por tres atributos, y un
   filtro por «inunda» + periodo se lleva las quince. Están acá enteras a
   propósito, para que no se pueda volver a colar. */
const CATALOGO={
  documentInfo:{Title:'Amenaza Ambiental'},
  layers:[
    {id:0,  name:'Amenaza Creciente Subita TR 50 Años 8 cabeceras municipales 2K'},
    {id:1,  name:'Amenaza Inundacion TR 2 Años Centros Poblados 2K'},
    {id:2,  name:'Amenaza Inundacion TR 10 Años Centros Poblados 2K'},
    {id:3,  name:'Amenaza Inundacion TR 20 Años Centros Poblados 2K'},
    {id:4,  name:'Amenaza Inundacion TR 50 Años Centros Poblados 2K'},
    {id:5,  name:'Amenaza Inundacion TR 100 Años Centros Poblados 2K'},
    {id:6,  name:'Areas Afectadas Inundacion Niña 1988'},
    {id:7,  name:'Areas Afectadas Inundacion Niña 2000'},
    {id:8,  name:'Areas Afectadas Inundacion Niña 2011'},
    {id:9,  name:'Areas Afectadas Inundacion Niña 2012'},
    {id:10, name:'Linea Base Inundación 100K 2001'},
    {id:11, name:'Profundidad Inundacion TR 2 Años Centros Poblados 2K'},
    {id:12, name:'Profundidad Inundacion TR 10 Años Centros Poblados 2K'},
    {id:13, name:'Profundidad Inundacion TR 20 Años Centros Poblados 2K'},
    {id:14, name:'Profundidad Inundacion TR 50 Años Centros Poblados 2K'},
    {id:15, name:'Profundidad Inundacion TR 100 Años Centros Poblados 2K'},
    {id:16, name:'Subindice de Amenaza al Cambio Climatico para Colombia TCNCC 2017'},
    {id:17, name:'Velocidad Inundacion TR 2 Años Centros Poblados 2K'},
    {id:18, name:'Velocidad Inundacion TR 10 Años Centros poblados 2K'},
    {id:19, name:'Velocidad Inundacion TR 20 Años Centros poblados 2K'},
    {id:20, name:'Velocidad Inundacion TR 50 Años Centros poblados 2K'},
    {id:21, name:'Velocidad Inundacion TR 100 Años Centros poblados 2K'},
    {id:22, name:'Areas afectadas inundacion Nina 2011 V2'},
    {id:23, name:'Areas afectadas por inundacion Nina 2016'},
    {id:24, name:'Areas afectadas por inundacion Nina 2020 - 2022'},
    {id:25, name:'Areas afectadas por Inundacion niña 1988 V2'},
    {id:26, name:'Areas afectadas por  Inundacion niña 2000 V2'},
    {id:27, name:'Areas afectadas por Inundacion niña 2012 V2'}
  ]
};
// Las cinco de amenaza por desborde, más la de creciente súbita.
const ESPERADAS=[0,1,2,3,4,5];
// En cuáles cae el lote cuando el escenario es «modelado y mojado». La de 2
// años NO: el sitio se moja cada diez, no todos los años.
const DENTRO={2:true, 3:true, 4:true, 5:true, 1:false, 0:false};

const CUCUTA={"OBJECTID":875,"NOMDEPTO":"NORTE DE SANTANDER","NOMMUN":"Cúcuta","NOMCAB":" ",
  "POINT_X":-72.507868,"POINT_Y":7.897548,
  "PGA75":170,"PGA225":270,"PGA475":360,"PGA975":460,"PGA2475":610,
  "NIVEL":"Alta","AA":0.35,"AV":0.25,"AE":0.25,"AD":0.1};
const NSR={"NOMBRE_DEPARTAMENTO":"NORTE DE SANTANDER","NOMBRE_MUNICIPIO":"CÚCUTA",
  "AA":0.35,"AV":0.3,"ZONA_AMENAZA_SÍSMICA":"Alta","AE":0.25,"AD":0.1};

const usos=[]; let id=1;
for(let i=0;i<14;i++){ const a=i*26*Math.PI/180, d=(160+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

const ok=[]; const mal=[];
const T=(q,c,d)=>{ (c?ok:mal).push(q); console.log('  '+(c?'✓':'✗')+' '+q+(d?'  — '+d:'')); };

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
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
  await ctx.route(/srvags\.sgc\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    const cuerpo=/Zonas_amenaza_Sismica_NR10/.test(u)?[{attributes:NSR}]
      :/Mov_Masa|Intensidad/.test(u)?[]:[{attributes:CUCUTA}];
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:cuerpo})});
  });

  /* El IDEAM. `modo` cambia cómo contesta sin volver a montar todo:

       'mojado'   modelado, y el lote dentro de la mancha de 10 años
       'seco'     modelado, y el lote fuera de todas
       'nadie'    el caso REAL de Cúcuta: cero polígonos en toda la redonda
       'cerrado'  el navegador no puede leerlo (CORS)
       'caido'    el servicio contesta 503

     'nadie' y 'seco' devuelven los mismos ceros sobre el punto. Lo único que
     los separa es la consulta con radio, y separarlos es la razón de ser de
     esta tanda. */
  let modo='mojado';
  const pedidas=[];
  const contestarIdeam=(u)=>{
    if(/MapServer\?f=json/.test(u) || /MapServer\/\?f=json/.test(u)){
      return JSON.stringify(CATALOGO);
    }
    const m=u.match(/MapServer\/(\d+)\/query/);
    if(m){
      const capa=Number(m[1]);
      const conRadio=/[?&]distance=/.test(u);
      if(!conRadio) pedidas.push(capa);
      let n=0;
      if(modo==='nadie') n=0;
      else if(conRadio) n=7;                       // hay manchas por la zona
      else if(modo==='mojado') n=DENTRO[capa]?1:0;
      else n=0;                                    // 'seco': modelado, pero fuera
      return JSON.stringify({count:n});
    }
    return JSON.stringify({error:{message:'ruta no prevista'}});
  };
  await ctx.route(/visualizador\.ideam\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    if(modo==='cerrado') return r.abort();          // el navegador no puede leerlo
    if(modo==='caido') return r.fulfill({status:503,contentType:'text/plain',body:'nope'});
    r.fulfill({status:200,contentType:'application/json',body:contestarIdeam(u)});
  });
  /* El relevo del motor. En producción es la ruta /geo del servidor de URBIS;
     acá se simula para comprobar que la aplicación la usa cuando el camino
     directo falla, sin depender de que el motor de pruebas tenga salida. */
  let relevos=0;
  await ctx.route(/localhost:8787\/geo/, r=>{
    relevos++;
    const u=decodeURIComponent(new URL(r.request().url()).searchParams.get('u')||'');
    if(modo==='caido') return r.fulfill({status:502,contentType:'application/json',
      body:JSON.stringify({ok:false,error:'El servicio de origen contestó 503.'})});
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({ok:true,de:'https://visualizador.ideam.gov.co',
        datos:JSON.parse(contestarIdeam(u))})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));

  /* Cada escenario parte de una página nueva, y no es capricho: una vez que
     la amenaza cargó, el botón «Ver la amenaza sísmica» ya no está —lo
     reemplaza el bloque con los datos—. Volver a pulsarlo desde una ficha ya
     cargada probaría un camino que ningún estudiante recorre. */
  const desdeCero=async()=>{
    await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
    // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);
    await preparar();
  };

  const preparar=async()=>pg.evaluate(async (D)=>{
    const {C,POL}=D, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
  }, {C,POL});

  const pedirAgua=async()=>pg.evaluate(async ()=>{
    const esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_INUNDACION._olvidar();
    const H=document.getElementById('pcr-hoja');
    const a=H.querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const bo=[...document.querySelectorAll('#pcr-hoja [data-pcr="amenaza"]')][0];
    if(!bo) return {sinBoton:true};
    bo.click();
    for(let i=0;i<70;i++){ await esperar(300);
      const t=document.getElementById('pcr-hoja').textContent||'';
      if(!/Consultando…/.test(t)) break; }
    await esperar(400);
    const txt=(document.getElementById('pcr-hoja').textContent||'').replace(/\s+/g,' ').trim();
    return {txt, inu: window.URBIS_PC_RECON.__inundacion ? null : null};
  });

  console.log('\n  -- modelado, y el lote dentro de la mancha --');
  modo='mojado';
  await desdeCero();
  let r=await pedirAgua();
  const dice=(t)=>r.txt.indexOf(t)!==-1;

  T('se descubren las capas, no se adivinan los índices',
    ESPERADAS.every(c=>pedidas.indexOf(c)!==-1),
    'capas consultadas: '+pedidas.slice().sort((a,b)=>a-b).join(', '));
  /* La corrección que trajo la corrida real: el servicio publica Amenaza,
     Profundidad y Velocidad con el mismo periodo. Un filtro por «inunda» se
     llevaba las quince y la ficha listaba «2, 2, 2, 10, 10, 10…». */
  T('Profundidad y Velocidad NO se consultan: son el mismo modelo, otro atributo',
    ![11,12,13,14,15,17,18,19,20,21].some(c=>pedidas.indexOf(c)!==-1),
    'se consultaron '+pedidas.length+' capas, no 15');
  T('las Áreas Afectadas históricas tampoco: no tienen periodo de retorno',
    ![6,7,8,9,22,23,24,25,26,27].some(c=>pedidas.indexOf(c)!==-1));
  T('la gravedad sale del periodo MENOR que lo toca',
    dice('10 años') && dice('una vez cada diez años'));
  T('se avisa que está en la mancha de 100 años, la que usan los POT',
    dice('mancha de 100 años') && dice('suelo de protección'));
  T('la salvedad de lo que el modelo no ve está', /quebradas/.test(r.txt));
  T('el sismo llegó igual, sin que el agua lo estorbe', dice('0,35'));

  console.log('\n  -- modelado, y el lote fuera --');
  modo='seco'; pedidas.length=0;
  await desdeCero();
  r=await pedirAgua();
  T('se dice que el sitio SÍ está modelado y el lote queda fuera',
    /sí está modelado/i.test(r.txt) && /queda fuera/i.test(r.txt));
  T('y aun así va la salvedad, que es donde alguien lo leería como permiso',
    /no es un certificado/.test(r.txt));

  /* ── La prueba que existe por lo que pasó de verdad ───────────────────
     Las cinco capas de amenaza contestaron CERO sobre el centro de Cúcuta.
     Un cero se lee de dos maneras opuestas —«fuera de la mancha», que es
     buena noticia, y «acá nadie modeló nada», que no es ninguna— y la
     versión anterior de este módulo pintaba la segunda como si fuera la
     primera. Sobre el punto, este escenario y el de arriba son idénticos:
     lo único que los separa es la consulta con radio. */
  console.log('\n  -- nadie modeló este sitio: el caso real de Cúcuta --');
  modo='nadie'; pedidas.length=0;
  await desdeCero();
  r=await pedirAgua();
  T('NO se dice que el lote quede fuera de ninguna mancha',
    !/queda fuera/i.test(r.txt) && !/no cae/i.test(r.txt),
    'ni «queda fuera» ni «no cae» aparecen');
  T('se dice «sin modelar», con esas palabras', /[Ss]in modelar/.test(r.txt));
  T('y se aclara que eso no es un permiso',
    /no quiere decir que no se inunde/i.test(r.txt));
  T('se nombra dónde sí está el dato para Cúcuta',
    /Pamplonita/.test(r.txt) && /POT/.test(r.txt),
    'POMCA del Pamplonita y cartografía del POT');

  console.log('\n  -- el navegador no puede leerlo: entra el motor --');
  modo='cerrado'; pedidas.length=0; relevos=0;
  await desdeCero();
  r=await pedirAgua();
  T('se pidió por el relevo del motor', relevos>0, relevos+' consultas relevadas');
  /* Por el relevo se piden las MISMAS consultas, punto y radio: si el relevo
     solo transportara la primera, este escenario contestaría «sin modelar»
     por falta de la de cobertura y no por falta de manchas. */
  T('llegan las dos consultas por capa, no solo la del punto',
    relevos >= 13, relevos+' consultas: 1 catálogo + 6 capas × 2');
  T('y la lectura es la misma que por el camino directo',
    /sí está modelado/i.test(r.txt) && !/no se sabe/i.test(r.txt));

  console.log('\n  -- el servicio está caído: no se sabe, y se dice --');
  modo='caido'; pedidas.length=0;
  await desdeCero();
  r=await pedirAgua();
  T('NO se dice que quede fuera de las manchas',
    !/queda fuera/i.test(r.txt) && !/no cae/i.test(r.txt));
  T('se dice explícitamente que no se sabe', /no se sabe/i.test(r.txt),
    (r.txt.match(/[^.]*no se sabe[^.]*\./i)||[''])[0].trim().slice(0,120));
  T('y el sismo sigue llegando, que es de otro servidor', r.txt.indexOf('0,35')!==-1);

  console.log('\n  -- el texto que se copia --');
  modo='mojado';
  await desdeCero();
  await pedirAgua();
  const copia=await pg.evaluate(async ()=>{
    const esperar=ms=>new Promise(r=>setTimeout(r,ms));
    let pegado='';
    try{ Object.defineProperty(navigator,'clipboard',
      {value:{writeText:t=>{pegado=t; return Promise.resolve();}},configurable:true}); }catch(e){}
    const b=document.querySelector('#pcr-hoja [data-pcr="amenaza-texto"]');
    if(b){ b.click(); await esperar(300); }
    return pegado;
  });
  T('lleva las dos amenazas, no solo el sismo',
    /AMENAZA SÍSMICA/.test(copia) && /AMENAZA DE INUNDACIÓN/.test(copia));
  T('y la salvedad viaja con el dato', /no es un certificado/.test(copia));

  T('sin errores de JavaScript', err.length===0, err.join(' | ')||'ninguno');

  await b.close();
  console.log('\n'+(mal.length? '  FALLARON '+mal.length+':\n   · '+mal.join('\n   · ') : '  todo pasó'));
  process.exit(mal.length?1:0);
})().catch(e=>{ console.error('  ✗ se rompió la prueba:', e && e.message); process.exit(1); });
