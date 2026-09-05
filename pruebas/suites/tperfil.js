const E = require('../entorno.js');
/* Tanda E · el perfil de la calle: lo alto que está construido contra lo ancho
   que es la calzada, y cuánta vía tiene andén.

   La geometría está armada para que las cifras se puedan comprobar a mano:
   todas las locales con 2 carriles (6 m), las arterias con 4 (12 m) y TODOS
   los edificios de 3 pisos (9 m). Así la altura media tiene que dar 9,0 m
   exactos, el ancho de la malla local 6,0 y el de la arterial 12,0, sin que
   importe cómo se ponderen las longitudes.

   Y se comprueba lo contrario también: sin etiquetas de ancho, el bloque NO
   inventa un perfil — dice que falta y manda a anotarlo en campo. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

const usos=[]; let id=1;
for(let i=0;i<24;i++){ const a=i*15*Math.PI/180, d=(150+(i%4)*80)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

const geo=[]; const N=6, paso=L*1.4/(N-1), ini=-L*0.7;
const xs=[], ys=[];
for(let i=0;i<N;i++){ xs.push(ini+i*paso); ys.push(ini+i*paso); }
/* Verticales: la primera es arterial de 4 carriles, las demás locales de 2.
   Todas con andén a lado y lado. */
xs.forEach((x,i)=>geo.push({type:'way',id:id++,
  tags:{highway:i===0?'primary':'residential', name:'Calle '+i,
        lanes:i===0?'4':'2', sidewalk:'both'},
  geometry:ys.map(y=>({lat:C.lat+y,lon:C.lng+x}))}));
/* Horizontales: locales de 2 carriles. Tres declaran que NO tienen andén y
   tres no dicen nada, que es el caso más común en OpenStreetMap. */
ys.forEach((y,i)=>{
  const t={highway:'residential', name:'Avenida '+i, lanes:'2'};
  if(i<3) t.sidewalk='no';
  geo.push({type:'way',id:id++,tags:t,geometry:xs.map(x=>({lat:C.lat+y,lon:C.lng+x}))});
});
// Todos los edificios de 3 pisos: la altura media tiene que dar 9,0 m.
for(let i=0;i<40;i++){
  const dx=(-L*0.6+(i%8)*(L*0.17)), dy=(-L*0.6+Math.floor(i/8)*(L*0.24)), d=0.00009;
  geo.push({type:'way',id:id++,tags:{building:'house','building:levels':'3'},geometry:[
    {lat:C.lat+dy,lon:C.lng+dx},{lat:C.lat+dy+d,lon:C.lng+dx},
    {lat:C.lat+dy+d,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx}]});
}

// La misma malla, pero SIN una sola etiqueta de ancho ni de andén.
const geoPelada=geo.map(w=>{
  const t=Object.assign({}, w.tags);
  delete t.lanes; delete t.width; delete t.sidewalk;
  return Object.assign({}, w, {tags:t});
});

let PELADA=false;

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
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
  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
    const esTrazado=/out(\+|%20|\s)geom/.test(q);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: esTrazado ? (PELADA?geoPelada:geo) : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const leer=async(D)=>pg.evaluate(async (D)=>{
    const {C,POL,primera}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    if(primera){
      window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
      window.map.setView([C.lat,C.lng],15); await esperar(500);
      const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
      if(bPC){ bPC.click(); await esperar(600); }
      A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    } else {
      A.limpiarArea(); A.iniciarDibujo();
      const L2=0.0035;
      [[-L2,-L2],[L2,-L2],[L2,L2],[-L2,L2],[-L2,-L2]].forEach(([a,c])=>A.agregarPunto(C.lat+a,C.lng+c));
    }
    R.cerrar(); await esperar(200); R.abrir(); await esperar(300);
    if(!primera) await esperar(5200);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    await esperar(5200);
    H().querySelector('[data-pcr="trazado"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(400);

    const todo=txt(H());
    const i=todo.indexOf('El perfil de la calle');
    o.bloque=i>=0?todo.slice(i,i+1500):'';
    o.kpis=[...H().querySelectorAll('.pcr-kpi')].map(txt);
    o.filas=[...H().querySelectorAll('.pcr-lote-fila')].map(txt);
    o.hayDibujo=!!H().querySelector('.pcr-seccion svg');
    o.edificios=H().querySelectorAll('.pcr-sec-edif').length;
    o.cifras=[...H().querySelectorAll('.pcr-llenos-cifras')].map(txt);
    const grupo=cl=>[...H().querySelectorAll('.pcr-sintesis-'+cl+' li')]
      .map(li=>txt(li.querySelector('span'))+' ‹'+txt(li.querySelector('b'))+'›');
    o.favor=grupo('bien'); o.contra=grupo('mal'); o.falta=grupo('falta');
    return o;
  },D);

  const con=await leer({C,POL,primera:true});
  PELADA=true;
  const sin=await leer({C,POL,primera:false});

  const errs=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const kpi=(o,re)=>{
    const k=(o.kpis||[]).filter(x=>re.test(x))[0];
    if(!k) return null;
    const m=k.match(/^([\d.,]+)/);
    return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
  };
  const fila=(o,re)=>((o.filas||[]).filter(x=>re.test(x))[0]||'');

  console.log('\n  -- las cifras, contra la cuenta hecha a mano --');
  const alt=kpi(con,/m de altura media/), anc=kpi(con,/m de calzada/), rel=kpi(con,/altura ÷ ancho/);
  P('todos los edificios de 3 pisos dan 9,0 m de altura media', alt===9,
    'esperado 9 · da '+alt);
  P('la malla local, de 2 carriles, da 6 m de calzada',
    /(^|\D)6(,0)? m/.test(fila(con,/Vías locales/)), fila(con,/Vías locales/)||'no sale');
  P('la arterial, de 4 carriles, da 12 m',
    /(^|\D)12(,0)? m/.test(fila(con,/Malla arterial/)), fila(con,/Malla arterial/)||'no sale');
  P('el ancho medio queda entre los dos', anc!==null && anc>6 && anc<12, anc+' m');
  P('y la relación es la altura dividida por el ancho',
    rel!==null && anc!==null && Math.abs(rel-alt/anc)<0.02,
    rel+' · esperado '+(anc?(alt/anc).toFixed(2):'?'));
  P('con 9 m sobre 6-7 de calzada, la calle es «contenida»',
    /Calle contenida/.test(con.bloque), (con.bloque.match(/Calle [\wa-z]+:/)||['no lo dice'])[0]);

  console.log('\n  -- la sección dibujada --');
  P('dibuja la sección', con.hayDibujo);
  P('con los dos edificios enfrentados', con.edificios===2, con.edificios+' volúmenes');
  P('y avisa de que es una sección tipo, no la de una calle concreta',
    /sección tipo/i.test(con.bloque) && /no es la de una calle concreta/.test(con.bloque));

  console.log('\n  -- los andenes --');
  const and=(con.cifras||[]).filter(x=>/andén/.test(x))[0]||'';
  P('reparte la vía en con andén, sin andén y sin dato',
    /con andén/.test(and) && /sin andén/.test(and) && /sin dato/.test(and), and);
  P('las tres partes suman el total',
    (function(){ const n=(and.match(/([\d,]+)%/g)||[]).map(x=>Number(x.replace('%','').replace(',','.')));
      return n.length===3 && Math.abs(n[0]+n[1]+n[2]-100)<0.5; })(),
    (and.match(/([\d,]+)%/g)||[]).join(' + '));
  P('la vía sin andén sale en contra en la síntesis',
    (con.contra||[]).some(x=>/sin andén/i.test(x)),
    (con.contra||[]).filter(x=>/andén/i.test(x))[0]||'no sale');

  console.log('\n  -- la cobertura del dato --');
  P('dice sobre qué parte de la vía hay ancho', /% de la vía/.test(con.bloque),
    (con.bloque.match(/en \d+% de la vía/)||['no lo dice'])[0]);
  P('y sobre qué parte de los edificios hay pisos', /% de los edificios/.test(con.bloque));
  P('aclara que el ancho es el de la calzada, no de fachada a fachada',
    /no de fachada a fachada/.test(con.bloque));

  console.log('\n  -- sin etiquetas, no inventa --');
  P('sin ancho registrado, no saca relación', !/altura ÷ ancho/.test(sin.bloque||''),
    (sin.bloque||'').slice(0,80));
  P('lo dice y manda a anotarlo en campo',
    /sin ancho no hay perfil/.test(sin.bloque||''),
    ((sin.bloque||'').match(/[^.]*sin ancho no hay perfil[^.]*\./)||['no lo dice'])[0]);
  P('y no dibuja una sección inventada', !sin.hayDibujo);
  P('la síntesis pide caminar el sector a anotar andenes',
    (sin.falta||[]).some(x=>/anotando dónde hay andén/.test(x)),
    (sin.falta||[]).filter(x=>/andén/.test(x))[0]||'no lo pide');

  console.log('');
  P('sin errores de JavaScript', errs.length===0, errs.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
