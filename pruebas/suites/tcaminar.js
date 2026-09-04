const E = require('../entorno.js');
/* Tanda C · cobertura de equipamientos: qué parte del sector tiene un colegio,
   un servicio de salud, un parque o dónde mercar a distancia de caminar.

   Se arma a propósito una geometría de la que se puede calcular la respuesta a
   mano: un cuadrado de ~885 m de lado con UN colegio justo en el centro. Con
   radio de 400 m el área cubierta es el círculo entero —cabe dentro del
   cuadrado— así que el porcentaje tiene que dar π·400²/área. Un servicio de
   salud en el centro, con sus 800 m, cubre hasta las esquinas: 100 %. Y no se
   pone ningún parque, porque el caso de «no hay ninguno» es el que más se va a
   dar en el salón y es el que peor se rompe si nadie lo prueba. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

// Medio lado, en metros: de acá salen el área del cuadrado y las cuentas.
const SEMI_NS = L*110540, SEMI_EO = L*111320*Math.cos(C.lat*Math.PI/180);
const AREA_M2 = (2*SEMI_NS)*(2*SEMI_EO);
const AREA_CIRC = Math.PI*400*400;
const PCT_EDU = 100*AREA_CIRC/AREA_M2;          // el círculo cabe entero
const DIAGONAL = Math.sqrt(SEMI_NS*SEMI_NS + SEMI_EO*SEMI_EO);   // < 800 m

const usos=[]; let id=1;
// Relleno: comercio y restaurantes repartidos, para que el sector no salga vacío.
for(let i=0;i<24;i++){ const a=i*15*Math.PI/180, d=(150+(i%4)*80)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'Local '+i, amenity:'restaurant'}}); }
// UN colegio, en el centro exacto.
usos.push({type:'node',id:id++,lat:C.lat,lon:C.lng,tags:{amenity:'school',name:'Colegio San José'}});
// UNA droguería, también en el centro: con 800 m llega a las esquinas.
usos.push({type:'node',id:id++,lat:C.lat,lon:C.lng,tags:{amenity:'pharmacy',name:'Droguería La Salud'}});
// Un supermercado en una esquina: cubre un pedazo y nada más.
usos.push({type:'node',id:id++,lat:C.lat-L*0.9,lon:C.lng-L*0.9,tags:{shop:'supermarket',name:'Mercado El Ahorro'}});
// Y NINGÚN parque ni cancha, a propósito.

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
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    let lamina=''; window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ lamina=h; };

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const todo=txt(H());
    const i=todo.indexOf('A distancia de caminar');
    o.bloque=i>=0?todo.slice(i,i+1600):'';
    // Cada fila: rótulo, minutos y porcentaje.
    o.filas=[...H().querySelectorAll('.pcr-nivel')].map(n=>({
      nom:txt(n.querySelector('.pcr-nivel-nom')),
      pct:Number((txt(n.querySelector('.pcr-nivel-n'))||'').replace('%','').replace(',','.'))
    })).filter(f=>/Colegio|salud|Parque o cancha|mercar/i.test(f.nom));
    const m=todo.match(/Población estimada[^\d]*([\d.]+)/);
    o.hab=m?Number(m[1].replace(/\./g,'')):null;

    // El sector guardado tiene que conservarlo.
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='Sector de la cobertura';
    const bl=H().querySelector('[data-pcr="lamina"]');
    if(bl){ bl.click(); await esperar(400); }
    o.lamina=lamina;

    const bg=[...H().querySelectorAll('button')].filter(b=>/Guardar ficha/i.test(b.textContent||''))[0];
    if(bg){ bg.click(); await esperar(600); }
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(700);
    const cabs=[...document.querySelectorAll('.pcr-pest-cab')];
    const cab=cabs.filter(c=>/Sector de la cobertura/.test(c.textContent||''))[0]||cabs[0];
    if(cab){ cab.click(); await esperar(700); }
    const pest=document.querySelector('.pcr-pestana');
    o.enGuardada=!!(pest && /A distancia de caminar/.test(txt(pest)));
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const B=r.bloque||'', LAM=r.lamina||'';
  const fila=re=>(r.filas||[]).filter(f=>re.test(f.nom))[0]||null;

  console.log('\n  -- las cuatro cosas que se miden --');
  P('salen las cuatro categorías', (r.filas||[]).length===4,
    (r.filas||[]).map(f=>f.nom.replace(/\s+/g,' ')+' '+f.pct+'%').join(' | '));

  console.log('\n  -- los porcentajes, contra la cuenta hecha a mano --');
  const edu=fila(/Colegio/), sal=fila(/salud/), rec=fila(/Parque o cancha/), ab=fila(/mercar/);
  P('un colegio en el centro cubre el círculo de 400 m y nada más',
    edu && Math.abs(edu.pct - PCT_EDU) < 2,
    'esperado ' + PCT_EDU.toFixed(1) + '% · da ' + (edu?edu.pct:'—') + '%');
  P('con 800 m, la droguería del centro llega a las esquinas',
    sal && sal.pct === 100,
    'la esquina está a ' + Math.round(DIAGONAL) + ' m, menos de 800 · da ' + (sal?sal.pct:'—') + '%');
  P('sin ningún parque mapeado, la cobertura es cero', rec && rec.pct === 0, (rec?rec.pct:'—')+'%');
  P('el supermercado de la esquina cubre un pedazo, no todo',
    ab && ab.pct > 5 && ab.pct < 60, (ab?ab.pct:'—')+'%');

  console.log('\n  -- lo que se lee --');
  P('dice cuántos minutos a pie es cada radio', /5 min · 400 m/.test(B) && /10 min · 800 m/.test(B),
    (B.match(/\d+ min · \d+ m/g)||[]).join(' | '));
  P('señala lo que más falta', /Lo que más falta es/.test(B),
    (B.match(/Lo que más falta es [^.]*\./)||['no lo dice'])[0].slice(0,110));
  P('y cuando no hay ninguno lo dice así, sin porcentajes vacíos',
    /no hay ninguno registrado dentro del área/.test(B));

  console.log('\n  -- las tres advertencias --');
  P('la distancia es en línea recta', /en línea recta/.test(B));
  P('solo cuenta lo que está dentro del área', /dentro del área/.test(B) && /dibujá el área un poco más grande/.test(B));
  P('y solo lo mapeado', /mapeado/.test(B));
  P('dice con cuántos puntos lo midió', /puntos repartidos por el área/.test(B),
    (B.match(/Distancia en línea recta desde \d+ puntos[^.]*\./)||['no lo dice'])[0]);

  console.log('\n  -- llega a todas partes --');
  P('la lámina trae la banda', /A distancia de caminar<\/h2>/.test(LAM));
  P('con los cuatro porcentajes', (LAM.match(/class="cm"/g)||[]).length===4,
    (LAM.match(/class="cm"/g)||[]).length+' columnas');
  P('el sector guardado no lo pierde', r.enGuardada);

  console.log('');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
