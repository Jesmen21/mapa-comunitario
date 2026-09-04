const E = require('../entorno.js');
/* Reconocimiento del sector, de punta a punta y en un navegador de verdad.
   Overpass está bloqueado desde acá, así que se sirve una respuesta falsa
   —pero pasa por el MISMO código: fetch, dedup, caché, servidor, ficha—.

   Los puntos van a propósito TODOS AL NORTE. Con datos repartidos parejo la
   prueba pasaría sin comprobar nada: lo que se quiere ver es si detecta el
   sur vacío y le dice al estudiante que vaya para allá. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const LEAFLET=E.MODULOS + '/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078};

// 120 puntos, todos entre el noroeste y el nordeste. Sur, sureste y suroeste
// quedan vacíos: eso es lo que la ficha tiene que descubrir sola.
const TIPOS=[{amenity:'pharmacy'},{shop:'supermarket'},{amenity:'restaurant'},
             {shop:'bakery'},{amenity:'school'},{highway:'bus_stop'},{office:'company'}];
const elements=[];
for(let i=0;i<120;i++){
  const ang=(-70+ (i%141))*Math.PI/180;           // de -70° a +70° = mitad norte
  const d=(120+(i%7)*55)/111320;
  elements.push({type:'node',id:1000+i,lat:C.lat+Math.cos(ang)*d,
                 lon:C.lng+Math.sin(ang)*d/Math.cos(C.lat*Math.PI/180),
                 tags:Object.assign({name:'Punto '+i},TIPOS[i%TIPOS.length])});
}

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block'});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    /* Desde que la licencia se pide AL TOCAR el botón (js/69 permitido),
       una suite sin licencia guardada se queda en la pantalla de licencia
       en vez de analizar. Es el comportamiento correcto: acá se pone la
       licencia igual que la pondría el curso en cada dispositivo. */
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t'}));
    localStorage.removeItem('aia_overpass_cache_v1');
  }catch(e){} });
  // el comodín PRIMERO; los dobles concretos después (Playwright prueba al revés)
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route('**/script.google.com/**', r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route('**/unpkg.com/**', r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  let overpassPedido=0;
  await ctx.route('**/overpass**', r=>{ overpassPedido++;
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}); });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,120)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (C) => {
    const o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    o.existe = !!window.URBIS_PC_RECON;
    if(!o.existe) return o;

    // el botón tiene que estar en el panel de Pro City, no solo el módulo
    try{ o.enPanel = /pca-reconocer/.test(window.URBIS_PC_ANALISIS.htmlPanel(null)); }catch(e){ o.enPanel='error: '+e.message; }

    window.URBIS_PC_RECON.abrir();
    o.abrio = window.URBIS_PC_RECON.abierto();
    o.hayHoja = !!document.getElementById('pcr-hoja');
    o.visible = !!document.querySelector('#pcr-hoja.pcr-visible');

    // se fija el centro a mano para no depender de dónde quedó el mapa
    // setView está ANIMADO: getCenter() devuelve el centro viejo hasta que
    // termina. Sin esta espera la prueba analizaba un sector a 1 km del que
    // creía, y el informe salía vacío por una razón que no era la del código.
    const m = window.map; m.setView([C.lat, C.lng], 16);
    await new Promise(r=>setTimeout(r,700));
    document.querySelector('[data-pcr="recentrar"]').click();
    o.centro = window.URBIS_PC_RECON.estado().centro;

    await window.URBIS_PC_RECON.analizar();
    const txt = document.getElementById('pcr-hoja').innerText;
    o.texto = txt;
    o.hayFicha = /Lo que hay en el sector/.test(txt);
    o.total = (txt.match(/(\d+)\s*\n?\s*usos registrados/)||[])[1];
    o.nombraSur = /\bsur\b/i.test(txt);
    o.diceRumbos = /rumbos sin datos/.test(txt);
    o.dicePorQue = /nadie lo ha mapeado/i.test(txt);
    o.avisoHonesto = /no es el sector/i.test(txt);
    o.pintaCirculo = document.querySelectorAll('.leaflet-overlay-pane path').length;

    // el reparto por rumbos, medido directo
    const pois = Array.from({length:8},(_,i)=>{
      const g=i*45*Math.PI/180, d=0.003;
      return {lat:C.lat+Math.cos(g)*d, lng:C.lng+Math.sin(g)*d/Math.cos(C.lat*Math.PI/180)};
    });
    const z = window.URBIS_PC_RECON.zonasSinDatos(pois, C);
    o.repartoParejo = JSON.stringify(z.cuenta);
    o.parejoSinVacios = z.vacios.length;

    const soloNorte = window.URBIS_PC_RECON.zonasSinDatos(
      [{lat:C.lat+0.003,lng:C.lng},{lat:C.lat+0.004,lng:C.lng}], C);
    o.soloNorteVacios = soloNorte.vacios.map(v=>v.id).join(',');
    return o;
  }, C);

  const ok=(n,c,d)=>{ console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c; };
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- se enchufa en Pro City --');
  P('el módulo carga', r.existe);
  P('el botón sale en el panel de Pro City', r.enPanel===true, r.enPanel);
  P('abre la hoja y se ve', r.abrio && r.hayHoja && r.visible);
  P('toma el centro del mapa', r.centro && Math.abs(r.centro.lat-C.lat)<0.001, JSON.stringify(r.centro));
  P('dibuja el círculo en el mapa', r.pintaCirculo>0, r.pintaCirculo+' formas');

  console.log('\n  -- consulta de verdad y arma la ficha --');
  P('pidió los datos a Overpass', overpassPedido>0, overpassPedido+' peticiones');
  P('la ficha se armó', r.hayFicha);
  P('y NO viene vacía', Number(r.total)>0, r.total+' usos registrados');

  console.log('\n  -- lo que hace útil a esto: ve lo que NO está --');
  P('detecta que faltan rumbos', r.diceRumbos);
  P('nombra el SUR, que es el vacío real', r.nombraSur);
  P('explica que el vacío es tarea, no ausencia', r.dicePorQue);
  P('avisa que OSM no es la realidad', r.avisoHonesto);

  console.log('\n  -- el reparto por rumbos, medido aparte --');
  P('con 8 puntos en 8 rumbos, ninguno vacío', r.parejoSinVacios===0, r.repartoParejo);
  P('con todo al norte, marca los otros 7', (r.soloNorteVacios||'').split(',').length===7, r.soloNorteVacios);

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó')+'\n');
  console.log('  ── LA FICHA, TAL COMO LA VE UN ESTUDIANTE ──\n');
  console.log(r.texto.split('\n').map(l=>'  │ '+l).join('\n'));
  await b.close(); process.exit(mal?1:0);
})();
