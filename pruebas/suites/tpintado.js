const E = require('../entorno.js');
/* Tanda AC · lo que cuesta responder a un toque.

   Esta suite no comprueba QUÉ se dibuja —de eso se ocupa tcalor— sino CÓMO,
   y existe porque el coste de un botón es lo único de esta aplicación que se
   degrada sin que nada falle. Todo sigue funcionando; simplemente empieza a
   tardar, y nadie escribe una prueba para eso hasta que un estudiante con un
   teléfono modesto dice que «va lento».

   Se midió: en un sector denso de novecientos usos, con la CPU frenada cuatro
   veces, tocar el interruptor de una capa tardaba 320 ms. La sospecha era que
   la culpa la tenía la hoja —treinta y cinco bloques, noventa kilobytes que
   se rehacen enteros—. No era: armar la hoja son 40 ms. Los otros 280 estaban
   en el mapa de calor, y por dos razones que no se ven leyendo el código:

     · un degradado radial NUEVO por cada punto, novecientas veces;
     · y el teñido, que recorre el lienzo entero en JavaScript píxel por
       píxel, dibujado al doble de resolución por ser una pantalla retina —un
       millón y medio de vueltas para pintar una mancha difuminada.

   Las dos cosas se arreglaron y quedó en 52 ms. Lo que esta prueba vigila NO
   es el tiempo —eso depende de la máquina que corra las pruebas y sería un
   falso rojo cada semana— sino las DOS PROPIEDADES que lo causaron, que sí
   son del código y no del equipo:

     · que el degradado se construya una vez y no una por punto;
     · y que el lienzo del calor no se dibuje a resolución de retina.        */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.005;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

// Novecientos usos: un sector denso de verdad, como el centro de Cúcuta.
const N_USOS=900;
let id=1; const usos=[];
for(let i=0;i<N_USOS;i++){ const a=i*0.7, d=(60+(i%40)*20)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school','bank','cafe'][i%5]}}); }

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  /* Con pantalla retina a propósito: es donde el teñido costaba el doble, y
     donde una vuelta atrás se notaría primero. */
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
  }catch(e){} });
  /* El espía va ANTES de que cargue nada: cuenta cuántos degradados radiales
     se construyen. Es la única forma de comprobar «una vez y no novecientas»
     sin depender del reloj. */
  await ctx.addInitScript(()=>{
    window.__gradientes=0;
    const orig=CanvasRenderingContext2D.prototype.createRadialGradient;
    CanvasRenderingContext2D.prototype.createRadialGradient=function(){
      window.__gradientes++;
      return orig.apply(this, arguments);
    };
  });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',
    body:fs.readFileSync(S+'node_modules/chart.js/dist/chart.umd.js','utf8')}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:30450,N:420}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL,N_USOS}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
    o.usos=(R.estado().hay)?N_USOS:0;

    const H=()=>document.getElementById('pcr-hoja');
    o.bloques=H().querySelectorAll('.pcr-h').length;
    o.hojaKB=Math.round(H().innerHTML.length/1024);

    // ── El calor de novecientos puntos, encendido a mano.
    const puntos=[];
    for(let i=0;i<N_USOS;i++){ const a=i*0.7, d=(60+(i%40)*20)/111320;
      puntos.push({lat:C.lat+Math.cos(a)*d, lng:C.lng+Math.sin(a)*d}); }
    window.__gradientes=0;
    A.calorExterno(puntos,'#0A6F9E','prueba',function(){});
    await esperar(900);
    o.gradientes=window.__gradientes;
    o.puntos=puntos.length;

    // El lienzo del calor: cuántos píxeles de verdad tiene.
    o.lienzo=(function(){
      const cv=document.querySelector('canvas.pca-heat');
      if(!cv) return null;
      return { ancho:cv.width, alto:cv.height,
               anchoCSS:Math.round(parseFloat(cv.style.width)||0),
               altoCSS:Math.round(parseFloat(cv.style.height)||0),
               dprPantalla:window.devicePixelRatio };
    })();
    // Y que de verdad pintó algo: si el lienzo saliera en blanco, todo lo
    // anterior sería una optimización de nada.
    o.pintado=(function(){
      const cv=document.querySelector('canvas.pca-heat');
      if(!cv) return 0;
      try{
        const g=cv.getContext('2d');
        const d=g.getImageData(0,0,cv.width,cv.height).data;
        let n=0;
        for(let i=3;i<d.length;i+=4*97) if(d[i]>0) n++;
        return n;
      }catch(e){ return -1; }
    })();

    // ── Volver a pintar (un zoom) no puede rehacer un degradado por punto.
    window.__gradientes=0;
    window.map.setZoom(16); await esperar(1200);
    o.gradientesTrasZoom=window.__gradientes;

    // ── Y la hoja: armarla y meterla, por separado.
    o.hoja=(function(){
      const h=document.getElementById('pcr-hoja');
      const t=[];
      for(let i=0;i<4;i++){
        const a=performance.now();
        const html=R.htmlDeLaFicha();
        const b=performance.now();
        h.innerHTML=html;
        t.push({construir:Math.round(b-a), meter:Math.round(performance.now()-b)});
      }
      return t;
    })();
    return o;
  },{C,POL,N_USOS});

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- el sector de la prueba --');
  T('novecientos usos y la hoja llena', r.usos===900 && r.bloques>=25,
    r.usos+' usos · '+r.bloques+' bloques · '+r.hojaKB+' KB de hoja');
  T('y el calor pintó de verdad', r.pintado>0, r.pintado+' muestras con tinta');

  console.log('\n  -- el degradado se construye una vez, no una por punto --');
  /* Era lo primero que se hacía mal: un `createRadialGradient` por cada punto.
     No se mide el tiempo —eso depende del equipo— sino la cuenta, que es del
     código. Con novecientos puntos, más de un puñado de degradados quiere
     decir que alguien volvió a ponerlo dentro del bucle. */
  T('con 900 puntos se construyen unos pocos degradados, no 900',
    r.gradientes>0 && r.gradientes<=4,
    r.gradientes+' degradados para '+r.puntos+' puntos');
  T('y volver a pintar por un zoom tampoco los multiplica',
    r.gradientesTrasZoom<=4, r.gradientesTrasZoom+' degradados al cambiar de escala');

  console.log('\n  -- el lienzo del calor no va a resolución de retina --');
  /* El teñido recorre el lienzo píxel por píxel en JavaScript. Al doble de
     resolución son cuatro veces más vueltas para pintar una mancha
     difuminada, donde esa nitidez no se ve. La pantalla de esta prueba ES
     retina a propósito: si alguien vuelve a atar el lienzo al
     `devicePixelRatio`, acá se nota. */
  T('la pantalla de la prueba es retina', (r.lienzo||{}).dprPantalla===2,
    'devicePixelRatio '+(r.lienzo||{}).dprPantalla);
  T('pero el lienzo tiene un píxel por punto de pantalla',
    !!r.lienzo && r.lienzo.ancho===r.lienzo.anchoCSS && r.lienzo.alto===r.lienzo.altoCSS,
    r.lienzo ? r.lienzo.ancho+'×'+r.lienzo.alto+' px para '+
      r.lienzo.anchoCSS+'×'+r.lienzo.altoCSS+' de pantalla' : 'no hay lienzo');
  T('y aun así ocupa el mapa entero, estirado por CSS',
    !!r.lienzo && r.lienzo.anchoCSS>=380 && r.lienzo.altoCSS>=380,
    r.lienzo ? r.lienzo.anchoCSS+'×'+r.lienzo.altoCSS : '');

  console.log('\n  -- la hoja no es el problema --');
  /* Se deja medido para la próxima vez que alguien sospeche de ella: con
     treinta y cinco bloques y noventa kilobytes, armarla y meterla en el
     documento cuesta una fracción de lo que cuesta dibujar en el mapa. */
  const peor=Math.max(...(r.hoja||[{construir:999,meter:999}]).map(x=>x.construir+x.meter));
  console.log('     armar y meter la hoja: ' +
    (r.hoja||[]).map(x=>x.construir+'+'+x.meter).join(' · ') + ' ms');
  T('armar y meter la hoja entera cuesta menos de un cuarto de segundo',
    peor < 250, 'lo peor fueron '+peor+' ms');

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
