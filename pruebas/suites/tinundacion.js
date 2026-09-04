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

/* El catálogo del servicio, con la forma con la que contesta un ArcGIS
   MapServer. Los ids no son 0..4 y no están en orden de periodo: son los que
   tendría un servicio real al que le han ido agregando capas. Y hay tres
   capas que NO son de inundación, para comprobar que se descartan. */
const CATALOGO={
  documentInfo:{Title:'Amenaza Ambiental'},
  layers:[
    {id:3,  name:'Amenaza por incendio de cobertura vegetal'},
    {id:7,  name:'Amenaza Inundacion TR 100'},
    {id:12, name:'Amenaza Inundacion TR 2.33'},
    {id:15, name:'Susceptibilidad a la desertificacion'},
    {id:19, name:'Amenaza Inundacion TR 20'},
    {id:23, name:'Amenaza Inundacion TR 50'},
    {id:28, name:'Zonas inundables sin periodo'},   // sin TR: se descarta
    {id:31, name:'Amenaza Inundacion TR 10'}
  ]
};
// Dentro de cuáles cae el lote de la prueba. La de 2.33 NO: el sitio se moja
// cada diez años, no todos los años. Ese matiz es el que se comprueba.
const DENTRO={31:true, 19:true, 23:true, 7:true, 12:false};

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
  await ctx.route(/srvags\.sgc\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    const cuerpo=/Zonas_amenaza_Sismica_NR10/.test(u)?[{attributes:NSR}]
      :/Mov_Masa|Intensidad/.test(u)?[]:[{attributes:CUCUTA}];
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:cuerpo})});
  });

  /* El IDEAM. `modo` cambia cómo contesta sin tener que volver a montar todo:
     'bien' responde, 'cerrado' niega la lectura al navegador —que es lo que
     hace un CORS cerrado— y 'caido' se cae entero. */
  let modo='bien';
  const pedidas=[];
  const contestarIdeam=(u)=>{
    if(/MapServer\?f=json|MapServer\/\?f=json/.test(u) || /MapServer\?[^/]*f=json/.test(u)){
      return {catalogo:true, body:JSON.stringify(CATALOGO)};
    }
    const m=u.match(/MapServer\/(\d+)\/query/);
    if(m){ const capa=Number(m[1]); pedidas.push(capa);
      return {capa, body:JSON.stringify({count: DENTRO[capa]?1:0})}; }
    return {body:JSON.stringify({error:{message:'ruta no prevista'}})};
  };
  await ctx.route(/visualizador\.ideam\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    if(modo==='cerrado') return r.abort();          // el navegador no puede leerlo
    if(modo==='caido') return r.fulfill({status:503,contentType:'text/plain',body:'nope'});
    r.fulfill({status:200,contentType:'application/json',body:contestarIdeam(u).body});
  });
  /* El relevo del motor. En producción es la ruta /geo del servidor de URBIS;
     acá se simula para poder comprobar que la aplicación la usa cuando el
     camino directo falla, sin depender de que el motor de pruebas tenga
     salida a internet. */
  let relevos=0;
  await ctx.route(/localhost:8787\/geo/, r=>{
    relevos++;
    const u=decodeURIComponent(new URL(r.request().url()).searchParams.get('u')||'');
    if(modo==='caido') return r.fulfill({status:502,contentType:'application/json',
      body:JSON.stringify({ok:false,error:'El servicio de origen contestó 503.'})});
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({ok:true,de:'https://visualizador.ideam.gov.co',
        datos:JSON.parse(contestarIdeam(u).body)})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));

  /* Cada escenario parte de una página nueva, y no es capricho: una vez que
     la amenaza cargó, el botón «Ver la amenaza sísmica» ya no está —lo
     reemplaza el bloque con los datos—. Volver a pulsarlo desde una ficha ya
     cargada probaría un camino que ningún estudiante recorre. */
  const desdeCero=async()=>{
    await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
    await pg.waitForTimeout(3400);
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

  console.log('\n  -- el servicio contesta bien --');
  await desdeCero();
  let r=await pedirAgua();
  const dice=(s)=>r.txt.indexOf(s)!==-1;

  T('se descubren las capas, no se adivinan los índices',
    [7,12,19,23,31].every(c=>pedidas.indexOf(c)!==-1) && pedidas.indexOf(0)===-1,
    'capas consultadas: '+pedidas.slice().sort((a,b)=>a-b).join(', '));
  T('las que no son de inundación quedan fuera',
    pedidas.indexOf(3)===-1 && pedidas.indexOf(15)===-1,
    'no se consultó ni incendios ni desertificación');
  T('y la de inundación SIN periodo también, porque no se puede fechar',
    pedidas.indexOf(28)===-1);
  T('la gravedad sale del periodo MENOR que lo toca',
    dice('10 años') && dice('una vez cada diez años'),
    r.txt.slice(r.txt.indexOf('La inundación'), r.txt.indexOf('La inundación')+150));
  T('se avisa que está en la mancha de 100 años, la que usan los POT',
    dice('mancha de 100 años') && dice('suelo de protección'));
  T('la salvedad de la escala nacional está',
    dice('no es un certificado') && /quebradas/.test(r.txt));
  T('el sismo llegó igual, sin que el agua lo estorbe', dice('0,35'));

  console.log('\n  -- el navegador no puede leerlo: entra el motor --');
  modo='cerrado'; pedidas.length=0; relevos=0;
  await desdeCero();
  r=await pedirAgua();
  T('se pidió por el relevo del motor', relevos>0, relevos+' consultas relevadas');
  T('y el dato llegó igual de completo',
    r.txt.indexOf('10 años')!==-1 && r.txt.indexOf('una vez cada diez años')!==-1);

  console.log('\n  -- el servicio está caído: no se sabe, y se dice --');
  modo='caido'; pedidas.length=0;
  await desdeCero();
  r=await pedirAgua();
  /* La prueba entera de esta tanda. «No se pudo» y «no se inunda» son dos
     cosas distintas y la ficha no puede confundirlas. */
  T('NO se dice que quede fuera de las manchas',
    r.txt.indexOf('no cae') === -1 && r.txt.indexOf('No cae') === -1,
    'no aparece ningún «no cae» en la hoja');
  T('se dice explícitamente que no se sabe',
    /no se sabe/i.test(r.txt),
    (r.txt.match(/[^.]*no se sabe[^.]*\./i)||[''])[0].trim().slice(0,120));
  T('y el sismo sigue llegando, que es de otro servidor', r.txt.indexOf('0,35')!==-1);

  console.log('\n  -- el texto que se copia --');
  modo='bien';
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
  T('y la salvedad viaja con el dato',
    /no es un certificado/.test(copia));

  T('sin errores de JavaScript', err.length===0, err.join(' | ')||'ninguno');

  await b.close();
  console.log('\n'+(mal.length? '  FALLARON '+mal.length+':\n   · '+mal.join('\n   · ') : '  todo pasó'));
  process.exit(mal.length?1:0);
})().catch(e=>{ console.error('  ✗ se rompió la prueba:', e && e.message); process.exit(1); });
