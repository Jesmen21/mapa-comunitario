const E = require('../entorno.js');
/* La pantalla de licencia, contra un servidor con el cobro ENCENDIDO de
   verdad (URBIS_EXIGIR_LICENCIA=1 y un secreto real). Probar esto con el
   portón apagado no comprobaría nada: todo pasaría igual sin licencia. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
/* Las licencias se emiten AQUÍ, en cada corrida. Leerlas de un archivo hacía
   que la segunda ejecución fallara: el cupo de esa licencia ya estaba gastado
   en el servidor, y la prueba parecía romperse cuando lo que pasaba es que
   había funcionado demasiado bien la vez anterior. Cada corrida estrena id, y
   por tanto estrena cupo. */
const L=require(E.MOTOR_REPO + '/licencias.js');
/* El secreto se inventa en cada corrida. Antes se leía de un archivo al lado
   de la prueba, y un archivo llamado «secreto» junto al código es exactamente
   lo que no debe existir: acá la prueba levanta su propio servidor, así que
   es la dueña de las dos puntas y no necesita que nadie le guarde nada. */
const SECRETO=require('crypto').randomBytes(24).toString('hex');
const sacar=v=>typeof v==='string'?v:(v&&v.licencia)||'';
const BUENA=sacar(L.emitir({cliente:'Constructora Demo',plan:'Pro',vence:'2027-12-31',cupo:3},SECRETO));
const VENCIDA=sacar(L.emitir({cliente:'Vencida SAS',vence:'2020-01-01',cupo:10},SECRETO));
const C={lat:7.8939,lng:-72.5078};
const elements=[{type:'node',id:1,lat:C.lat+0.0005,lon:C.lng,tags:{amenity:'pharmacy',name:'Drogas'}}];

/* Levanta SU PROPIO servidor con el cobro encendido, en un puerto aparte.
   Antes usaba el de 8787, que a veces está con el portón apagado según lo
   último que uno haya arrancado a mano: la prueba pasaba o fallaba según el
   estado de otra ventana, que es la peor clase de prueba. */
const {spawn}=require('child_process');
const PUERTO=8794;
function esperar(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async()=>{
  const srv=spawn(process.execPath,[E.MOTOR_REPO + '/servidor.js'],
    {env:Object.assign({},process.env,{PORT:String(PUERTO),URBIS_SECRETO:SECRETO,URBIS_EXIGIR_LICENCIA:'1',
      // MODO ESTRICTO. Desde la v614 hay cupo libre: sin él, el análisis sin
      // licencia ya no falla, la pantalla no se abre sola y esta prueba se
      // queda sin nada que mirar. El cupo libre se comprueba en
      // servidor/probar.js; acá se prueba la pantalla, que es lo que aparece
      // cuando de verdad hace falta una licencia.
      URBIS_LIBRE_CUPO:'0'}),
     stdio:'ignore'});
  process.on('exit',()=>{ try{srv.kill('SIGKILL');}catch(e){} });
  await esperar(2500);

  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block'});
  await ctx.addInitScript(()=>{
    /* Solo en el marco principal. `addInitScript` corre en TODOS los marcos, y
     la aplicación crea uno escondido para medir la lámina antes de imprimirla:
     sin esta guarda, ese marco volvía a ejecutar esto y borraba las fichas ya
     guardadas a mitad de la prueba. Costó encontrarlo porque el síntoma era
     «no se guardó» en suites que no tocan el guardado. */
    if (window.top !== window) return;
    try{
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t'}));
    localStorage.removeItem('urbis_licencia_analisis');
    localStorage.removeItem('aia_overpass_cache_v1');
  }catch(e){} });
  await ctx.route('**', r=>new RegExp('localhost:(8199|'+PUERTO+')').test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',
    body:fs.readFileSync(S+'node_modules/chart.js/dist/chart.umd.js','utf8')}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/analisis-ia.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2500);

  const r = await pg.evaluate(async (D) => {
    const {BUENA,VENCIDA,C}=D, o={};
    window.URBIS_CONFIG.ANALISIS.API='http://localhost:'+D.PUERTO;
    o.existe=!!window.URBIS_LICENCIA;
    if(!o.existe) return o;

    // 1. Sin licencia, un análisis debe fallar Y abrir la pantalla sola
    const entrada={elementos:[{type:'node',id:1,lat:C.lat+0.0005,lon:C.lng,tags:{amenity:'pharmacy'}}],
                   radioM:500, centro:C, proyectoId:'recomendar'};
    o.abiertaAntes=window.URBIS_LICENCIA.abierto();
    try { await window.AIA_MOTOR.analizar(entrada); o.analizoSinLicencia=true; }
    catch(e){ o.analizoSinLicencia=false; o.errorSin=String(e.message).slice(0,70); }
    await new Promise(r=>setTimeout(r,500));
    o.seAbrioSola=window.URBIS_LICENCIA.abierto();
    o.hayHoja=!!document.querySelector('#ulic-hoja.ulic-visible');

    // 2. Una licencia inventada NO se guarda
    const campo=document.getElementById('ulic-campo');
    campo.value='URBIS1.basura.basura';
    document.querySelector('[data-ulic="guardar"]').click();
    await new Promise(r=>setTimeout(r,600));
    o.textoMala=document.getElementById('ulic-hoja').innerText;
    o.noGuardoLaMala=!localStorage.getItem('urbis_licencia_analisis');

    // 3. Una vencida: lo dice, y tampoco se guarda
    document.getElementById('ulic-campo').value=VENCIDA;
    document.querySelector('[data-ulic="guardar"]').click();
    await new Promise(r=>setTimeout(r,600));
    o.textoVencida=document.getElementById('ulic-hoja').innerText;
    o.noGuardoLaVencida=!localStorage.getItem('urbis_licencia_analisis');

    // 4. La buena: se guarda y muestra el estado
    document.getElementById('ulic-campo').value=BUENA;
    document.querySelector('[data-ulic="guardar"]').click();
    await new Promise(r=>setTimeout(r,700));
    o.textoBuena=document.getElementById('ulic-hoja').innerText;
    o.guardada=(localStorage.getItem('urbis_licencia_analisis')||'').slice(0,10);

    // 5. Y ahora el análisis SÍ funciona
    try { const res=await window.AIA_MOTOR.analizar(entrada);
          o.analizoConLicencia=!!(res&&res.stats); }
    catch(e){ o.analizoConLicencia=false; o.errorCon=String(e.message).slice(0,70); }

    // 6. Gastar el cupo (3): dos análisis más y el cuarto debe dar 429
    for(let i=0;i<2;i++){ try{ await window.AIA_MOTOR.analizar(entrada); }catch(e){} }
    try { await window.AIA_MOTOR.analizar(entrada); o.cuartoPaso=true; }
    catch(e){ o.cuartoPaso=false; o.motivoCuarto=e.motivo; }
    await new Promise(r=>setTimeout(r,500));
    o.textoCupo=document.getElementById('ulic-hoja').innerText;

    // 7. El emisor: emitir una licencia desde el navegador, sin terminal
    document.querySelector('[data-ulic="modo-emitir"]').click();
    await new Promise(r=>setTimeout(r,200));
    o.hayEmisor=!!document.getElementById('ulic-secreto');

    // con el secreto equivocado no emite
    document.getElementById('ulic-secreto').value='no-es-el-secreto';
    document.getElementById('ulic-cliente').value='Constructora del Norte';
    document.getElementById('ulic-vence').value='2027-06-30';
    document.getElementById('ulic-cupo').value='200';
    document.querySelector('[data-ulic="emitir"]').click();
    await new Promise(r=>setTimeout(r,600));
    o.textoMalSecreto=document.getElementById('ulic-hoja').innerText;

    // con el correcto, sí
    document.getElementById('ulic-secreto').value=D.SECRETO;
    document.getElementById('ulic-cliente').value='Constructora del Norte';
    document.getElementById('ulic-vence').value='2027-06-30';
    document.getElementById('ulic-cupo').value='200';
    document.querySelector('[data-ulic="emitir"]').click();
    await new Promise(r=>setTimeout(r,700));
    o.textoEmitida=document.getElementById('ulic-hoja').innerText;
    /* El emisor muestra DOS cuadros: primero el enlace para mandar por
       WhatsApp y después la licencia en texto. El primero empieza por http, no
       por URBIS1., así que hay que pedir el que no es el del enlace. */
    const ta=document.querySelector('.ulic-emisor textarea:not(.ulic-enlace)');
    o.licEmitida=ta?ta.value:'';
    o.hayEnlace=!!document.querySelector('.ulic-emisor textarea.ulic-enlace');

    // y esa licencia recién emitida sirve de verdad
    if(o.licEmitida){
      const r2=await window.URBIS_LICENCIA.comprobar(o.licEmitida);
      o.emitidaSirve = !!(r2 && r2.ok && r2.cliente==='Constructora del Norte');
      o.emitidaCupo = r2 && r2.cupo;
    }
    document.querySelector('[data-ulic="modo-emitir"]').click();
    await new Promise(r=>setTimeout(r,200));

    // 7. Quitar la licencia
    document.querySelector('[data-ulic="quitar"]').click();
    await new Promise(r=>setTimeout(r,200));
    o.trasQuitar=localStorage.getItem('urbis_licencia_analisis');
    return o;
  }, {BUENA,VENCIDA,C,PUERTO,SECRETO});

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- sin licencia no se analiza, y hay adónde ir --');
  P('el módulo carga', r.existe);
  P('un análisis sin licencia falla', r.analizoSinLicencia===false, r.errorSin);
  P('y la pantalla se abre SOLA', !r.abiertaAntes && r.seAbrioSola && r.hayHoja);

  console.log('\n  -- no acepta lo que el servidor rechaza --');
  P('una licencia inventada no se guarda', r.noGuardoLaMala);
  P('y lo dice', /no es válida|no se pudo/i.test(r.textoMala||''));
  P('una vencida tampoco se guarda', r.noGuardoLaVencida);
  P('y dice que venció', /venció/i.test(r.textoVencida||''), (r.textoVencida||'').split('\n').filter(l=>/venci/i.test(l))[0]);

  console.log('\n  -- con la buena, funciona --');
  P('la guarda', (r.guardada||'').indexOf('URBIS1')===0, r.guardada);
  P('muestra el cliente y el cupo', /Constructora Demo/.test(r.textoBuena||'') && /Análisis de hoy/.test(r.textoBuena||''));
  P('y el análisis ya corre', r.analizoConLicencia===true, r.errorCon||'');

  console.log('\n  -- y el cupo se acaba --');
  P('el cuarto análisis se rechaza', r.cuartoPaso===false, 'motivo: '+r.motivoCuarto);
  P('la pantalla explica que se agotó', /agotó el cupo/i.test(r.textoCupo||''));

  console.log('\n  -- emitir sin terminal, desde el navegador --');
  P('el emisor está en la misma hoja', r.hayEmisor);
  P('con el secreto equivocado NO emite', /Secreto incorrecto/i.test(r.textoMalSecreto||''),
    (r.textoMalSecreto||'').split('\n').filter(l=>/secreto/i.test(l)).pop());
  P('con el correcto, emite', /Licencia emitida y verificada/.test(r.textoEmitida||''));
  P('y devuelve la licencia', (r.licEmitida||'').indexOf('URBIS1.')===0, (r.licEmitida||'').slice(0,24)+'…');
  P('con su enlace para mandarla por WhatsApp', r.hayEnlace===true);
  P('que el servidor acepta de verdad', r.emitidaSirve===true, 'cupo '+r.emitidaCupo);

  console.log('\n  -- se puede quitar --');
  P('quitar la borra del dispositivo', !r.trasQuitar);

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó')+'\n');
  if(r.textoBuena) console.log(r.textoBuena.split('\n').slice(0,16).map(l=>'  │ '+l).join('\n'));
  await b.close(); try{srv.kill('SIGKILL');}catch(e){}
  process.exit(mal?1:0);
})();
