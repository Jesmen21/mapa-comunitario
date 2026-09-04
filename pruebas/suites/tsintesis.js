const E = require('../entorno.js');
/* Tanda D · la mezcla de usos y la síntesis del sector.

   Dos cosas que se comprueban juntas porque una alimenta a la otra:

   · El ÍNDICE DE MEZCLA. Se corre el mismo sector dos veces con dos padrones
     de usos distintos: uno con un solo tipo de uso —solo droguerías— y otro
     con cinco tipos repartidos. El primero tiene que dar 0 y llamarse
     «monofuncional»; el segundo, alto. Es una medida relativa, así que lo que
     se comprueba es su comportamiento, no un decimal copiado de la fórmula.

   · La SÍNTESIS. Que cada frase nazca de un dato medido y se apague sola si
     ese dato no está: antes de medir el terreno, la síntesis no dice nada del
     terreno —ni bien ni mal— y en cambio lo pide en «lo que falta levantar».
     Es la regla que hace que la lámina se pueda defender. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
let id=1;
const nodo=(tags,i,n)=>{ const a=i*(360/n)*Math.PI/180, d=(150+(i%4)*80)/111320;
  return {type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,tags:tags}; };

// ── Padrón A: un solo tipo de uso. Índice de mezcla = 0.
const SOLO=[]; for(let i=0;i<24;i++) SOLO.push(nodo({name:'Droguería '+i, amenity:'pharmacy'},i,24));

// ── Padrón B: cinco tipos repartidos parejo. Índice alto.
const VARIOS=[]; const TIPOS=[
  {amenity:'pharmacy'},        // salud        → institucional
  {shop:'supermarket'},        // comercio     → comercial
  {amenity:'school'},          // cultura      → institucional
  {leisure:'park'},            // parque       → residencial
  {man_made:'works'},          // industria    → industrial
  {amenity:'fuel'}             // servicios    → servicios
];
for(let i=0;i<36;i++) VARIOS.push(nodo(Object.assign({name:'Uso '+i}, TIPOS[i%TIPOS.length]),i,36));

// La geometría del trazado, para la segunda vuelta.
const geo=[]; const N=6, paso=L*1.4/(N-1), ini=-L*0.7;
const xs=[], ys=[];
for(let i=0;i<N;i++){ xs.push(ini+i*paso); ys.push(ini+i*paso); }
xs.forEach((x,i)=>geo.push({type:'way',id:id++,tags:{highway:i===0?'primary':'residential',name:'Calle '+i},
  geometry:ys.map(y=>({lat:C.lat+y,lon:C.lng+x}))}));
ys.forEach((y,i)=>geo.push({type:'way',id:id++,tags:{highway:'residential',name:'Avenida '+i},
  geometry:xs.map(x=>({lat:C.lat+y,lon:C.lng+x}))}));
for(let i=0;i<40;i++){
  const dx=(-L*0.6+(i%8)*(L*0.17)), dy=(-L*0.6+Math.floor(i/8)*(L*0.24)), d=0.00009;
  geo.push({type:'way',id:id++,tags:{building:'house','building:levels':String(1+(i%4))},geometry:[
    {lat:C.lat+dy,lon:C.lng+dx},{lat:C.lat+dy+d,lon:C.lng+dx},
    {lat:C.lat+dy+d,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx}]});
}

// Una ladera fuerte: la síntesis tiene que salir con «pendiente fuerte».
const RAMPA={ lng0:C.lng-L, lng1:C.lng+L, z0:340, z1:454 };
const cotaDe=lng=>RAMPA.z0+(RAMPA.z1-RAMPA.z0)*((lng-RAMPA.lng0)/(RAMPA.lng1-RAMPA.lng0));

function climaSimulado(){
  const dias=[]; const ini2=new Date(Date.UTC(2021,0,1));
  for(let i=0;i<365*5;i++){
    const d=new Date(ini2.getTime()+i*86400000), mes=d.getUTCMonth();
    const lluvioso=(mes===3||mes===4||mes===9||mes===10);
    // Cúcuta es caliente: la media pasa de 26° y la síntesis debe decirlo.
    dias.push({ f:d.toISOString().slice(0,10), tMax:34, tMin:23,
      lluvia: lluvioso?(i%3===0?12:2):(i%9===0?3:0), viento:15, vientoDir:45 });
  }
  return dias;
}

let PADRON=SOLO;   // se cambia entre las dos vueltas

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
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : PADRON})});
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

  // ── Vuelta 1: un solo uso, sin medir nada más
  const r1=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
    const H=document.getElementById('pcr-hoja');
    const todo=txt(H);
    const i=todo.indexOf('Mezcla de usos');
    o.mezcla=i>=0?todo.slice(i,i+520):'';
    const j=todo.indexOf('Síntesis del sector');
    o.sintesis=j>=0?todo.slice(j,j+2000):'';
    const grupo=cl=>[...H.querySelectorAll('.pcr-sintesis-'+cl+' li')]
      .map(li=>txt(li.querySelector('span'))+' ‹'+txt(li.querySelector('b'))+'›');
    o.favor=grupo('bien'); o.contra=grupo('mal'); o.falta=grupo('falta');
    return o;
  },{C,POL});

  // ── Vuelta 2: cinco usos y todo medido
  PADRON=VARIOS;
  const r2=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    let lamina=''; window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ lamina=h; };

    // Otra área para que el análisis anterior se descarte, y a analizar.
    A.limpiarArea(); A.iniciarDibujo();
    const L2=0.0035;
    [[-L2,-L2],[L2,-L2],[L2,L2],[-L2,L2],[-L2,-L2]].forEach(([a,c])=>A.agregarPunto(C.lat+a,C.lng+c));
    R.cerrar(); await esperar(200); R.abrir(); await esperar(300);
    await esperar(5200);
    await R.analizar(); await esperar(1400);

    const H=()=>document.getElementById('pcr-hoja');
    const medir=async(acc, sel)=>{
      const b=H().querySelector('[data-pcr="'+acc+'"]');
      if(!b) return false;
      b.click();
      for(let i=0;i<70 && !document.querySelector(sel);i++) await esperar(400);
      await esperar(300); return !!document.querySelector(sel);
    };
    await esperar(5200);
    o.trz=await medir('trazado','.pcr-llenos');
    o.ter=await medir('terreno','.pcr-corte');
    o.cli=await medir('clima','.pcr-clima-lluvia');

    const todo=txt(H());
    const i=todo.indexOf('Mezcla de usos');
    o.mezcla=i>=0?todo.slice(i,i+520):'';
    const grupo=cl=>[...H().querySelectorAll('.pcr-sintesis-'+cl+' li')]
      .map(li=>txt(li.querySelector('span'))+' ‹'+txt(li.querySelector('b'))+'›');
    o.favor=grupo('bien'); o.contra=grupo('mal'); o.falta=grupo('falta');

    const bl=H().querySelector('[data-pcr="lamina"]');
    if(bl){ bl.click(); await esperar(500); }
    o.lamina=lamina;
    return o;
  },{C,POL});

  const errs=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const idxDe=t=>{const m=(t||'').match(/Acá da ([\d,]+)/);return m?Number(m[1].replace(',','.')):null;};
  const i1=idxDe(r1.mezcla), i2=idxDe(r2.mezcla);
  const hay=(lista,re)=>(lista||[]).some(x=>re.test(x));

  console.log('\n  -- el índice de mezcla --');
  P('con un solo tipo de uso da cero', i1===0, 'índice '+i1);
  P('y se llama monofuncional', /monofuncional/i.test(r1.mezcla||''),
    (r1.mezcla||'').slice(0,90));
  P('con cinco tipos repartidos sube', i2!==null && i2>=0.55, 'índice '+i2);
  P('y deja de ser monofuncional', /mezclado/i.test(r2.mezcla||''),
    ((r2.mezcla||'').match(/Índice de mezcla · [\wá ]+/)||['—'])[0]);
  P('el segundo mezcla más que el primero', i2!==null && i1!==null && i2>i1, i1+' → '+i2);
  P('dice cuántos usos de cuántos hay', /\d+ de 7/.test(r2.mezcla||''),
    ((r2.mezcla||'').match(/\d+ de 7/)||['no lo dice'])[0]);
  P('y avisa del sesgo de OpenStreetMap con la vivienda',
    /comercio está mucho mejor registrado que la vivienda/.test(r2.mezcla||''));

  console.log('\n  -- la síntesis no habla de lo que no midió --');
  P('sin medir nada, no dice nada del terreno',
    !hay(r1.favor,/pendiente|ladera/i) && !hay(r1.contra,/pendiente|desnivel/i));
  P('ni del clima', !hay(r1.contra,/Clima cálido/i) && !hay(r1.favor,/viento/i));
  P('ni de los llenos y vacíos', !hay(r1.favor,/suelo sin construir/i));
  P('pero los pide en «lo que falta levantar»',
    hay(r1.falta,/Medir el trazado/) && hay(r1.falta,/Medir el terreno/) && hay(r1.falta,/Medir el clima/),
    (r1.falta||[]).join(' | ').slice(0,150));
  P('y marca el sector monofuncional en contra', hay(r1.contra,/monofuncional/i),
    (r1.contra||[]).join(' | ').slice(0,120));

  console.log('\n  -- y sí habla de lo que midió --');
  P('las tres mediciones se hicieron', r2.trz && r2.ter && r2.cli,
    'trazado '+r2.trz+' · terreno '+r2.ter+' · clima '+r2.cli);
  P('la ladera fuerte sale en contra, con su porcentaje',
    hay(r2.contra,/Pendiente fuerte.*‹.*%/), (r2.contra||[]).filter(x=>/Pendiente/.test(x))[0]||'no sale');
  P('el clima cálido también', hay(r2.contra,/Clima cálido.*‹.*°/),
    (r2.contra||[]).filter(x=>/Clima/.test(x))[0]||'no sale');
  P('la mezcla de usos sale a favor', hay(r2.favor,/Usos mezclados/),
    (r2.favor||[]).filter(x=>/mezclados/.test(x))[0]||'no sale');
  P('y ya no pide medir lo que ya se midió',
    !hay(r2.falta,/Medir el trazado|Medir el terreno|Medir el clima/),
    (r2.falta||[]).join(' | ').slice(0,150)||'nada pendiente');
  P('cada frase trae su número', (r2.favor.concat(r2.contra)).every(x=>/‹[^›]+›/.test(x)),
    (r2.favor.concat(r2.contra)).length+' frases');

  console.log('\n  -- llega a la lámina --');
  const LAM=r2.lamina||'';
  P('la lámina cierra con la síntesis', /Síntesis del sector<\/h2>/.test(LAM));
  P('con las tres columnas', /A favor<\/h3>/.test(LAM) && /En contra<\/h3>/.test(LAM) && /Falta levantar<\/h3>/.test(LAM));
  P('y como mucho cuatro por columna',
    (LAM.match(/<div class="sn ok">[\s\S]*?<\/div><\/div>/)||[''])[0].split('class="sx"').length-1 <= 4);

  console.log('');
  P('sin errores de JavaScript', errs.length===0, errs.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
