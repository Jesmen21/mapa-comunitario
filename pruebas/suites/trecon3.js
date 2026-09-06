const E = require('../entorno.js');
/* Fase 3: la ficha como herramienta de campo.
   Los puntos van desbalanceados (mitad norte) para que «dónde se concentra»
   tenga algo real que encontrar, y para que la lista de tareas no salga vacía. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const LEAFLET=E.MODULOS + '/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078};

const TIPOS=[{amenity:'pharmacy'},{shop:'supermarket'},{amenity:'restaurant'},{shop:'bakery'},
             {amenity:'school'},{highway:'bus_stop'},{amenity:'grit_bin'}];
// `grit_bin` se comprobó contra el motor: no tiene regla y cae en «otro».
// La primera versión usaba shop=trade suponiendo lo mismo, y resultó que sí
// se clasifica (ferretería): la prueba fallaba por una suposición mía, no
// por el código. Lo que no está comprobado no se supone.
const elements=[];
for(let i=0;i<140;i++){
  const ang=(-60+(i%121))*Math.PI/180;
  const d=(150+(i%8)*50)/111320;
  elements.push({type:'node',id:5000+i,lat:C.lat+Math.cos(ang)*d,
    lon:C.lng+Math.sin(ang)*d/Math.cos(C.lat*Math.PI/180),
    tags:Object.assign({name:'R'+i},TIPOS[i%TIPOS.length])});
}

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block', permissions:['clipboard-read','clipboard-write']});
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
    /* Desde que la licencia se pide AL TOCAR el botón (js/69 permitido),
       una suite sin licencia guardada se queda en la pantalla de licencia
       en vez de analizar. Es el comportamiento correcto: acá se pone la
       licencia igual que la pondría el curso en cada dispositivo. */
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t'}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route('**/script.google.com/**', r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route('**/unpkg.com/**', r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route('**/overpass**', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,120)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (C) => {
    const o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],16);
    await new Promise(r=>setTimeout(r,700));
    window.URBIS_PC_RECON.abrir();
    document.querySelector('[data-pcr="recentrar"]').click();
    await window.URBIS_PC_RECON.analizar();

    const h=document.getElementById('pcr-hoja');
    /* La ficha se lee entera, pestaña por pestaña. Desde que se repartió,
       `innerText` solo devuelve la pestaña abierta —lo que se VE— y estas
       comprobaciones son sobre lo que la ficha DICE, esté en la pestaña que
       esté. Que se pueda llegar a cada una es cosa de tpestanas. */
    const textoFicha=()=>{ const h2=document.getElementById('pcr-hoja');
      if(!h2) return '';
      /* `textContent` y no `innerText`: incluye las pestañas cerradas, que
         es donde vive casi todo. La cabecera y las cifras del sector están
         fuera de las pestañas, así que se lee la hoja entera. */
      return h2.querySelector('.pcr-tab') ? h2.textContent : h2.innerText; };
    o.texto=textoFicha();
    o.diceConcentracion=/Dónde se concentra/.test(o.texto);
    o.nombraLado=/(norte|noreste|noroeste|sur|oriente|occidente)/i.test(o.texto);
    o.hayCheck=/Qué verificar en campo/.test(o.texto);
    o.checkItems=h.querySelectorAll('.pcr-check li').length;
    o.mencionaSinCategoria=/sin categoría/.test(o.texto);
    o.hayBotones=!!h.querySelector('[data-pcr="guardar"]') && !!h.querySelector('[data-pcr="copiar"]');

    // guardar
    h.querySelector('[data-pcr="guardar"]').click();
    await new Promise(r=>setTimeout(r,150));
    o.avisoGuardado=(document.querySelector('.pcr-aviso')||{}).textContent||'';
    const fichas=JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]');
    o.nFichas=fichas.length;
    o.fichaTienePuntos=fichas[0] ? fichas[0].pois.length : 0;
    o.fichaTieneRumbos=fichas[0] ? Object.keys(fichas[0].rumbos||{}).length : 0;
    o.fichaTieneTotal=fichas[0] ? fichas[0].total : 0;
    o.pesoKB=Math.round(JSON.stringify(fichas).length/1024);

    /* Guardar otra vez el MISMO análisis. Antes se esperaba que acumulara,
       y acumulaba: dos copias idénticas del mismo sector. Desde que la ficha
       se guarda sola al terminar el análisis, el botón «Guardar ficha» lo
       que hace es ponerle nombre a esa entrada, así que dos clics dejan UNA
       ficha. Acumular era el defecto, no el requisito. */
    document.getElementById('pcr-hoja').querySelector('[data-pcr="guardar"]').click();
    await new Promise(r=>setTimeout(r,150));
    o.nFichas2=JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]').length;

    // copiar
    document.getElementById('pcr-hoja').querySelector('[data-pcr="copiar"]').click();
    await new Promise(r=>setTimeout(r,350));
    try { o.portapapeles=await navigator.clipboard.readText(); } catch(e){ o.portapapeles='(no se pudo leer: '+e.message+')'; }
    return o;
  }, C);

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- la ficha dice qué hacer, no solo qué hay --');
  P('dice dónde se concentra', r.diceConcentracion);
  P('y nombra un lado concreto', r.nombraLado);
  P('tiene lista de verificación', r.hayCheck && r.checkItems>=2, r.checkItems+' puntos que tachar');
  P('manda a mirar los usos sin categoría', r.mencionaSinCategoria);

  console.log('\n  -- se la puede llevar --');
  P('los dos botones están', r.hayBotones);
  P('guardar guarda de verdad', r.nFichas===1, r.nFichas+' ficha, '+r.pesoKB+' KB');
  P('y avisa que quedó guardada', /guardada/i.test(r.avisoGuardado), r.avisoGuardado.slice(0,60));
  P('guarda los puntos, no solo los totales', r.fichaTienePuntos>0, r.fichaTienePuntos+' puntos');
  P('y el reparto por rumbos', r.fichaTieneRumbos===8, r.fichaTieneRumbos+' rumbos');
  P('guardar dos veces el mismo análisis no lo duplica', r.nFichas2===1, r.nFichas2+' ficha');

  console.log('\n  -- el texto para llevarse sin señal --');
  const t=r.portapapeles||'';
  P('se copió algo', t.length>100, t.length+' caracteres');
  P('trae el encabezado', /RECONOCIMIENTO DEL SECTOR/.test(t));
  P('trae las categorías', /POR CATEGORÍA/.test(t));
  P('trae las tareas como casillas', /\[ \] Al /.test(t), (t.match(/\[ \] Al [a-zé]+/g)||[]).slice(0,3).join(' · '));
  P('y el aviso de que OSM no es la realidad', /no el sector/.test(t));
  // «otro» es la falta de clasificación, no un uso. Si aparece entre lo más
  // repetido, la lista miente sobre lo que hay en la calle.
  const bloque=(t.split('LO MÁS REPETIDO')[1]||'').split('A DÓNDE IR')[0];
  P('«otro» NO figura entre los usos más repetidos', !/^\s*otro:/m.test(bloque),
    bloque.trim().split('\n').length+' usos listados');

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó')+'\n');
  if(!mal){ console.log('  ── EL TEXTO QUE SE LLEVA ──\n'); console.log(t.split('\n').map(l=>'  │ '+l).join('\n')); }
  await b.close(); process.exit(mal?1:0);
})();
