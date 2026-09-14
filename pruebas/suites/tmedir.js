const E = require('../entorno.js');
/* Tanda X · medir todo de una vez.

   Analizar un sector deja la ficha a medias a propósito: cada medición cuesta
   una consulta a un servicio distinto. Pero en el uso real casi siempre se
   quieren todas, y pedirlas de a una son cinco botones repartidos por una
   hoja de treinta bloques, cada uno con su espera, y ninguno avisa de que
   existen los otros.

   Lo que esta prueba vigila —y es lo único que puede romperse sin que se
   note— es que la cadena NO MIENTA:

   · Que vaya en serie. El limitador de Overpass rechaza dos consultas
     seguidas: en paralelo, el trazado se caería siempre. Se comprueba mirando
     el orden real en el que llegaron las peticiones.
   · Que un paso caído no detenga a los demás. Acá el clima contesta 500 a
     propósito: los otros cuatro tienen que salir igual.
   · Y que al final diga la verdad de lo que midió. Casi todas estas funciones
     atrapan su propio error y resuelven igual, así que una cadena escrita por
     instinto reportaría cinco éxitos habiendo medido cuatro.               */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<12;i++){ const a=i*30*Math.PI/180, d=(160+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }
const via=(n,c,pts)=>({type:'way',id:id++,tags:{highway:c,name:n,lanes:'2'},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Calle 7','residential',[P(-300,-300),P(-300,0),P(-300,300)]),
  via('Avenida 3','secondary',[P(-400,0),P(0,0),P(400,0)]),
  {type:'way',id:id++,tags:{building:'yes','building:levels':'5'},
   geometry:[P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)].map(p=>({lat:p.lat,lon:p.lng}))}
];
const NSR={"NOMBRE_DEPARTAMENTO":"NORTE DE SANTANDER","NOMBRE_MUNICIPIO":"CÚCUTA",
  "AA":0.35,"AV":0.3,"ZONA_AMENAZA_SÍSMICA":"Alta","AE":0.25,"AD":0.1,
  "LONGITUD":-72.50559097,"LATITUD":7.90526712};
const PGA={"NOMDEPTO":"NORTE DE SANTANDER","NOMMUN":"Cúcuta","POINT_X":-72.507868,
  "POINT_Y":7.897548,"PGA75":170,"PGA225":270,"PGA475":360,"PGA975":460,"PGA2475":610,
  "NIVEL":"Alta","AA":0.35,"AV":0.25,"AE":0.25,"AD":0.1};
const MASA={"AREA_KM":1135.66,"DEPARTAMEN":"Norte de Santander","MUNICIPIO":"Cúcuta",
  "SUM_BAJA":0,"SUM_MEDIA":32.78,"SUM_ALTA":59.15,"SUM_MUY_AL":8.71};

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
  /* El doble del DANE contesta DOS cosas distintas (v907): la suma de siempre,
     y —cuando la consulta pide geometría— las manzanas con su estrato. Sin la
     segunda, el paso nuevo de «medir todo» caería SIEMPRE y la comprobación
     pasaría diciendo que lo intentó, que no es lo que dice medir. Es la
     lección de la v876 con `COD_DANE_MPIO`, otra vez: un doble que no sabe
     contestar la consulta nueva prueba la rama del fallo y nada más. */
  const anillo=(dx,dy,l)=>[[[P(dx,dy).lng,P(dx,dy).lat],[P(dx+l,dy).lng,P(dx+l,dy).lat],
    [P(dx+l,dy+l).lng,P(dx+l,dy+l).lat],[P(dx,dy+l).lng,P(dx,dy+l).lat],
    [P(dx,dy).lng,P(dx,dy).lat]]];
  const MANZANAS=[['Estrato 2',-200,-200],['Estrato 3',-60,-200],['Estrato 1',-200,-60],
                  ['Sin Estrato',-60,-60]].map(([e,dx,dy])=>({
    attributes:{ESTRATO_PREDOMINANTE:e}, geometry:{rings:anillo(dx,dy,120)}}));
  await ctx.route(/ags\.esri\.co/, r=>{
    const u=r.request().url()+(r.request().postData()||'');
    const pideGeo=/returnGeometry=true|returnGeometry%3Dtrue/i.test(u);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(pideGeo?{features:MANZANAS}
                                 :{features:[{attributes:{TOTAL:3045,N:42}}]})});
  });

  /* El orden REAL en el que llegan las peticiones. Es la única forma de
     comprobar que la cadena va en serie: en paralelo, todas llegarían juntas
     antes de que contestara la primera. */
  const orden=[];
  const marcar=(que)=>{ orden.push({que, t:Date.now()}); };

  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
    const esTrazado=/out(\+|%20|\s)geom/.test(q);
    marcar(esTrazado?'trazado':'usos');
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: esTrazado?geo:usos})});
  });
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    marcar('terreno');
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map((x,i)=>300+i*3)})});
  });
  // El clima se cae a propósito: es lo que hay que sobrevivir.
  await ctx.route(/archive-api\.open-meteo\.com/, r=>{
    marcar('clima');
    r.fulfill({status:500,contentType:'text/plain',body:'se cayó'});
  });
  await ctx.route(/srvags\.sgc\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    marcar('amenaza');
    let cuerpo;
    if(/Zonas_amenaza_Sismica_NR10/.test(u)) cuerpo=[{attributes:NSR}];
    else if(/Mov_Masa/.test(u)) cuerpo=[{attributes:MASA}];
    else cuerpo=[{attributes:PGA}];
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:cuerpo})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    /* La foto satelital se sustituye: el clasificador de verdad baja teselas
       de satélite, que en este entorno no salen, y lo que se está probando es
       la cadena y no el clasificador. */
    A.analizarRaster=function(avisar){
      if(typeof avisar==='function') avisar('Leyendo…');
      return new Promise(res=>setTimeout(()=>res({
        pixeles:1000, imagen:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        overlayImagen:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        overlayLimites:[[POL[0].lat,POL[0].lng],[POL[2].lat,POL[2].lng]],
        areaM2:790000, pctAmbiguo:10,
        clases:[{id:'construido',etq:'Superficie dura gris',color:'#94a3b8',pct:60,m2:474000,fiable:true,nota:'.'},
                {id:'verde',etq:'Vegetación viva',color:'#22c55e',pct:40,m2:316000,fiable:true,nota:'.'}]
      }), 300));
    };
    A.mostrarRaster=function(){};

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();

    // ── Antes: el botón está y dice qué falta.
    o.antes=(function(){
      const c=H().querySelector('.pcr-medir');
      return c?{ texto:(c.textContent||'').replace(/\s+/g,' ').trim(),
                 pasos:[...c.querySelectorAll('.pcr-medir-p')].map(p=>({
                   nombre:(p.textContent||'').trim(), on:p.classList.contains('on') })),
                 hayBoton:!!c.querySelector('[data-pcr="medir-todo"]') }:null;
    })();

    // ── Correr la cadena.
    const t0=Date.now();
    H().querySelector('[data-pcr="medir-todo"]').click();
    await esperar(600);
    // A mitad de camino tiene que verse la cuenta y el botón de parar.
    o.durante=(function(){
      const c=H().querySelector('.pcr-medir-va');
      return c?{ texto:(c.textContent||'').replace(/\s+/g,' ').trim(),
                 hayParar:!!c.querySelector('[data-pcr="medir-parar"]'),
                 hayBarra:!!c.querySelector('.pcr-medir-barra i') }:null;
    })();
    for(let i=0;i<160 && H().querySelector('.pcr-medir-va');i++) await esperar(500);
    o.segundos=Math.round((Date.now()-t0)/1000);
    await esperar(600);

    const asa=H().querySelector('[data-pcr="agrandar"]');
    if(asa){ asa.click(); await esperar(400); }
    /* El aviso GENERAL de la hoja, `.pcr-aviso`, y no el primer `.pcr-error`
       que aparezca: ese es el del bloque del clima, que se cayó a propósito, y
       leerlo en su lugar hacía pasar la prueba por el motivo equivocado. */
    o.aviso=(function(){
      const a=H().querySelector('.pcr-aviso');
      return a?(a.textContent||'').replace(/\s+/g,' ').trim():'';
    })();
    o.erroresDeBloque=[...H().querySelectorAll('.pcr-error')]
      .map(e=>(e.textContent||'').replace(/\s+/g,' ').trim());
    o.textoFinal=txt();
    o.estado=(function(){
      const e=R.estado?R.estado():{};
      /* Contra el ESTADO expuesto por el módulo y no contra el texto de la
         hoja: un bloque puede aparecer con su invitación —«pedí la foto»— y
         el texto diría que sí está cuando no está. */
      return { trazado:/El trazado del sector/.test(txt()),
               terreno:/pendiente media/i.test(txt()),
               clima:/de temperatura media/.test(txt()),
               amenaza:/0,35Aa|0,35 Aa/.test(txt().replace(/\s+/g,'')) ||
                       /disipación de energía/.test(txt()),
               cobertura:!!(R.cobertura && R.cobertura()) };
    })();
    o.despues=(function(){
      const c=H().querySelector('.pcr-medir');
      return c?(c.textContent||'').replace(/\s+/g,' ').trim():'';
    })();
    /* v907 · lo medido, PUESTO en el mapa. Se lee del estado y no del DOM:
       una polilínea de Leaflet dibujada en un lienzo no tiene nodo propio, así
       que «hay una capa» no se puede comprobar con un `querySelector`. */
    o.capas=(R.estado?R.estado():{}).capasEnMapa||{};
    o.estratosMedidos=(R.estado?R.estado():{}).estratos||0;

    /* Y «Analizar otro sector» tiene que dejar el mapa LIMPIO. Hasta la v906
       soltaba las cuentas y dejaba dibujado el sector anterior: quien tocaba
       el botón y no llegaba a correr el siguiente análisis se quedaba mirando
       el viejo sin saberlo, y peor, marcaba el centro nuevo encima. */
    const otro=H().querySelector('[data-pcr="otro"]');
    o.hayOtro=!!otro;
    if(otro){ otro.click(); await esperar(700); }
    o.capasTrasOtro=(R.estado?R.estado():{}).capasEnMapa||{};
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const idx=q=>orden.findIndex(x=>x.que===q);

  console.log('\n  -- antes de medir --');
  T('el bloque está arriba de la ficha', !!r.antes && r.antes.hayBoton===true);
  /* Cuántos son NO se escribe acá. Estaba puesto a 5 y la v907 añadió las
     manzanas por estrato: una constante del código copiada en la
     comprobación se pone roja por un cambio que no tiene nada que ver con lo
     que mide (la lección de la v890). Lo que sí es invariante: que los nombre
     uno por uno, que sean los de verdad, y que la cuenta de abajo cuadre con
     esta lista. */
  const PASOS=(r.antes.pasos||[]).map(p=>p.nombre);
  T('y dice qué falta, una por una', PASOS.length>=5 &&
    /trazado/i.test(PASOS.join(' ')) && /foto satelital/i.test(PASOS.join(' ')),
    PASOS.join(' · '));
  T('todas apagadas, porque no se ha medido nada',
    (r.antes.pasos||[]).every(p=>!p.on));
  T('avisa de lo que tarda y de que se puede parar',
    /cerca de un minuto/.test(r.antes.texto) && /se puede parar/.test(r.antes.texto));

  console.log('\n  -- mientras corre --');
  T('se ve el paso que va y de cuántos',
    !!r.durante && new RegExp('\\d+ de ' + PASOS.length).test(r.durante.texto),
    r.durante?r.durante.texto.slice(0,70):'no se vio');
  T('con barra y con botón de parar',
    !!r.durante && r.durante.hayBarra===true && r.durante.hayParar===true);

  console.log('\n  -- la cadena --');
  T('pidió las cinco cosas', ['trazado','terreno','clima','amenaza'].every(q=>idx(q)>=0),
    orden.map(x=>x.que).join(' → '));
  /* En serie y no en paralelo: si fueran a la vez, las peticiones llegarían
     todas antes de que contestara la primera y el orden sería otro. Además el
     limitador de Overpass mataría el trazado. */
  T('en serie, y en el orden que corresponde',
    idx('trazado')<idx('terreno') && idx('terreno')<idx('clima') &&
    idx('clima')<idx('amenaza'), orden.map(x=>x.que).join(' → '));
  /* El trazado pasa por Overpass, que rechaza dos consultas a menos de cinco
     segundos. Si la cadena arrancara sin esperar, se caería siempre. */
  T('esperando el limitador de Overpass antes del trazado',
    idx('usos')>=0 && (orden[idx('trazado')].t - orden[idx('usos')].t) >= 5000,
    Math.round((orden[idx('trazado')].t - orden[idx('usos')].t)/100)/10 + ' s entre las dos');
  T('y termina en menos de dos minutos', r.segundos < 120, r.segundos + ' s');

  console.log('\n  -- un paso caído no tumba la cadena --');
  T('el clima se cayó, como estaba previsto', r.estado.clima===false);
  T('pero el trazado salió', r.estado.trazado===true);
  T('y el terreno también', r.estado.terreno===true);
  T('y la amenaza', r.estado.amenaza===true);
  T('y la foto satelital, que va de última', r.estado.cobertura===true);

  console.log('\n  -- y lo dice como es --');
  /* Casi todas estas funciones atrapan su propio error y resuelven igual, así
     que una cadena escrita por instinto diría «medí cinco» habiendo medido
     cuatro. Se mira el ESTADO, no la promesa. */
  T('no se atribuye el clima que no midió',
    !/Listo: .*clima/i.test(r.aviso||'') , r.aviso);
  T('y nombra lo que sí midió', /El trazado/.test(r.aviso||''), r.aviso);
  T('diciendo que con el clima no se pudo', /No se pudo con .*clima/i.test(r.aviso||''),
    r.aviso);
  /* El panel de después. Se apretó en la v907: antes bastaba con que dijera
     «Todo medido» o «Falta medir», y con el clima caído lo que hay que ver es
     que NOMBRE lo que falta —si no, quien lo lee no sabe qué volver a pedir—. */
  T('después el panel nombra lo que falta, que es el clima',
    /Medir el sector entero|Todo medido/.test(r.despues||'') && /clima/i.test(r.despues||''),
    (r.despues||'').slice(0,110));

  console.log('\n  -- v907 · y queda DIBUJADO en el mapa --');
  /* «Que me analice todo, todo, todo» y «que me muestre una vez en el mapa la
     línea de los cortes topográficos». Medir sin dibujar deja cinco
     interruptores repartidos por la ficha, que es justo lo que el botón viene
     a quitar. */
  T('las manzanas por estrato entran en la cadena', r.estratosMedidos > 0,
    r.estratosMedidos + ' manzanas');
  T('los cortes topográficos quedan dibujados', r.capas.cortes===true,
    JSON.stringify(r.capas));
  T('y las curvas de nivel', r.capas.curvas===true);
  T('y los llenos y vacíos', r.capas.llenos===true);
  T('y la jerarquía de vías', r.capas.vias===true);
  /* Las manzanas por estrato se MIDEN y no se encienden a la vez: son un
     relleno de área como los llenos y vacíos y uno tapa al otro. Se dice, con
     su interruptor al lado —la decisión de la v880 con el ámbar y el verde—,
     y esta aserción es la que impide «arreglarlo» encendiéndolo todo. */
  T('y las manzanas por estrato, que van al fondo', r.capas.estratos===true,
    JSON.stringify(r.capas));
  T('y el panel nombra las cinco y dónde se apagan',
    /cortes topográficos/i.test(r.textoFinal||'') && /manzanas por estrato/i.test(r.textoFinal||'') &&
    /Capas del mapa/i.test(r.textoFinal||''),
    (/Al terminar quedan[^.]{0,190}/i.exec(r.textoFinal||'')||['no lo dice'])[0].slice(0,170));
  T('y el aviso nombra lo que quedó puesto', /En el mapa: .*cortes topogr/i.test(r.aviso||''),
    r.aviso);

  console.log('\n  -- v907 · analizar otro sector deja el mapa limpio --');
  T('el botón de analizar otro sector está', r.hayOtro===true);
  T('y al tocarlo no queda dibujada ninguna capa del sector anterior',
    !r.capasTrasOtro.cortes && !r.capasTrasOtro.curvas && !r.capasTrasOtro.llenos &&
    !r.capasTrasOtro.vias && !r.capasTrasOtro.estratos && !r.capasTrasOtro.puntos,
    JSON.stringify(r.capasTrasOtro));

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
