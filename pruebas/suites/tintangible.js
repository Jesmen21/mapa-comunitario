const E = require('../entorno.js');
/* Tanda T · lo intangible.

   Todo lo demás que mide esta aplicación se puede bajar. Esto no: la
   inseguridad percibida, las esquinas oscuras, los predios donde no se puede
   vivir, el ruido, el olor, la basura, lo que corta el paso y lo que está
   bien solo lo tiene quien caminó. Esta prueba dibuja ese recorrido y le
   pide al análisis las conclusiones que solo salen de cruzarlo con lo medido.

   La maqueta está armada para que cada cruce tenga una respuesta conocida:

   · Una zona chica —60 × 60 m, o sea 0,36 ha— marcada como insegura con DIEZ
     locales adentro. Casi 28 usos por hectárea: por el conteo tendría que
     sentirse acompañada. Ahí el análisis tiene que decir que percepción y
     conteo no coinciden, y que hay que ir a mirar por qué.

   · Otra zona insegura de una hectárea SIN un solo uso. Ahí coinciden, y la
     conclusión es la contraria: no hay quién mire.

   · Un sitio marcado como agradable dentro de una zona sin luz. Es el mejor
     lugar del sector doce horas al día y no existe las otras doce.

   · Una barrera de cien metros al oriente del lote, y una zona de ruido que
     lo envuelve: una tiene que salir «cerca», la otra «dentro».           */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
const caja=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];

let id=1;
const nodo=(tags,dx,dy)=>({type:'node',id:id++,lat:P(dx,dy).lat,lon:P(dx,dy).lng,tags:tags});
const usos=[];
// Los diez del racimo, dentro de 40 × 40 m alrededor de (-210, 130).
for(let i=0;i<10;i++){
  usos.push(nodo({shop:'clothes',name:'Local '+i}, -230+(i%5)*10, 110+Math.floor(i/5)*20));
}
// Y algunos sueltos, lejos, para que el sector no sea solo el racimo.
for(let i=0;i<4;i++) usos.push(nodo({amenity:'restaurant',name:'Comida '+i}, 60+i*40, -140));
for(let i=0;i<3;i++) usos.push(nodo({amenity:'school',name:'Colegio '+i}, -120+i*60, 300));

const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const edificio=(pts,pisos)=>({type:'way',id:id++,
  tags:{building:'yes','building:levels':String(pisos)},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Calle 7','residential',[P(-300,-300),P(-300,0),P(-300,300)]),
  via('Avenida 3','secondary',[P(-400,0),P(0,0),P(400,0)]),
  via('Calle 9','residential',[P(0,-300),P(0,0),P(0,300)]),
  edificio([P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)], 6),
  edificio([P(120,120),P(160,120),P(160,160),P(120,160),P(120,120)], 4)
];

/* El recorrido que se va a dibujar. Cada entrada es un lápiz y una lista de
   puntos en metros desde el centro del sector. */
const RECORRIDO=[
  { t:'inseguro',   pts: caja(-240, 100, -180, 160) },   // 0,36 ha con 10 usos
  { t:'inseguro',   pts: caja( 200,-300,  300,-200) },   // 1 ha con ninguno
  { t:'oscuro',     pts: caja(-100,-300,   60,-180) },
  { t:'agradable',  pts: caja( -40,-260,    0,-220) },   // adentro de la oscura
  { t:'ruido',      pts: caja( -80, -80,   80,  80) },   // envuelve el lote
  { t:'barrera',    pts: [[100,-100],[100,100]] },       // a 100 m del lote
  { t:'basura',     pts: [[150,40]] }
];

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
  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map((lng,i)=>310+i*2)})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL,RECORRIDO}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON, I=window.URBIS_INTANGIBLE;
    o.hayModulo=!!I;
    o.tipos=I?I.TIPOS.map(t=>t.id):[];

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const btn=id=>H().querySelector('[data-pcr="'+id+'"]');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    const trozo=(desde,largo)=>{ const t=txt(); const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo); };

    // ── Antes de caminar: el bloque tiene que invitar, no decir «sin datos».
    o.vacio=trozo('Lo intangible',420);
    o.lapices=[...H().querySelectorAll('[data-pcr="int-dibujar"]')]
      .map(b=>b.getAttribute('data-t'));

    // ── El trazado, para tener calles y por lo tanto caminata.
    await esperar(5200);
    btn('trazado').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);

    // ── El lote.
    btn('lote-dibujar').click(); await esperar(500);
    [Q(-20,-15),Q(20,-15),Q(20,15),Q(-20,15)].forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);

    // ── El recorrido: un lápiz por marca.
    for (const m of RECORRIDO) {
      const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="'+m.t+'"]');
      if(!lap){ o.faltaLapiz=(o.faltaLapiz||[]).concat([m.t]); continue; }
      lap.click(); await esperar(350);
      m.pts.forEach(([x,y])=>{ const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(250);
      // Un sitio se cierra solo con el toque; los demás piden «Listo».
      const listo=document.querySelector('#pcr-int-barra [data-int="cerrar"]');
      if(listo) listo.click();
      await esperar(450);
    }
    o.barraSeFue=!document.getElementById('pcr-int-barra');

    // ── La ficha, ya con el recorrido adentro.
    const asa=H().querySelector('[data-pcr="agrandar"]');
    if(asa){ asa.click(); await esperar(500); }
    o.ficha=trozo('Lo intangible',2400);
    o.cuentas=[...H().querySelectorAll('.pcr-int-c')]
      .map(c=>(c.textContent||'').replace(/\s+/g,' ').trim());
    o.items=[...H().querySelectorAll('.pcr-int-item')]
      .map(c=>(c.querySelector('b')||{}).textContent||'?');
    o.desacuerdos=[...H().querySelectorAll('.pcr-int-des')]
      .map(c=>(c.textContent||'').replace(/\s+/g,' ').trim());

    /* ── Contraste, acá y no en tdiseno ────────────────────────────────
       La aplicación pinta de menta casi blanca TODO `small` y `span` sueltos,
       y este bloque está lleno de los dos. tdiseno no lo alcanza porque su
       recorrido nunca marca nada: sin marcas, la lista de testimonios y sus
       campos no existen. Así que la comprobación viaja con la maqueta que sí
       los tiene. */
    o.contraste=(function(){
      const lum=c=>{ const m=(String(c).match(/[\d.]+/g)||[255,255,255]).slice(0,3).map(Number);
        const lin=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); };
        return 0.2126*lin(m[0])+0.7152*lin(m[1])+0.0722*lin(m[2]); };
      const fondo=e=>{ let n=e;
        while(n && n!==document.documentElement){
          const f=getComputedStyle(n).backgroundColor;
          if(f && !/rgba\(0, 0, 0, 0\)|transparent/.test(f)) return f;
          n=n.parentElement;
        }
        return 'rgb(255,255,255)'; };
      const razon=(a,b)=>{ const A=lum(a),B=lum(b);
        return (Math.max(A,B)+.05)/(Math.min(A,B)+.05); };
      const flojos=[];
      // El texto de las tarjetas, la lista y los lápices.
      [...H().querySelectorAll('.pcr-int-c small,.pcr-int-c b,.pcr-int-c em,' +
        '.pcr-int-tx b,.pcr-int-tx small,.pcr-int-lapiz b,.pcr-int-lapiz small')]
        .filter(e=>(e.textContent||'').trim().length>1 && e.getBoundingClientRect().width>0)
        .forEach(e=>{
          const c=razon(getComputedStyle(e).webkitTextFillColor||getComputedStyle(e).color, fondo(e));
          if(c<4.5) flojos.push((e.className||e.tagName)+':'+
            (e.textContent||'').trim().slice(0,16)+'='+c.toFixed(1));
        });
      // Y la pregunta que invita a escribir la nota, que es texto de marcador
      // y por eso no lo ve ninguna comprobación que mire el contenido.
      const campo=H().querySelector('.pcr-int-nota');
      let marcador=null;
      if(campo){
        const cs=getComputedStyle(campo,'::placeholder');
        marcador=razon(cs.webkitTextFillColor||cs.color, fondo(campo));
        if(marcador<4.5) flojos.push('placeholder=' + marcador.toFixed(1));
      }
      return { flojos: flojos.slice(0,8), n: flojos.length,
               marcador: marcador===null?null:Math.round(marcador*10)/10 };
    })();

    // ── Una nota, que es lo que convierte la mancha en testimonio.
    const campoNota=H().querySelector('.pcr-int-nota');
    if(campoNota){
      campoNota.value='Acá me robaron el celular a las siete de la noche';
      campoNota.dispatchEvent(new Event('change',{bubbles:true}));
      await esperar(300);
    }

    // ── La capa. Recién dibujada tiene que estar YA en el mapa: nadie marca
    //    una zona para después tener que encenderla.
    const bm=H().querySelector('[data-pcr="int-mapa"]');
    o.hayBotonMapa=!!bm;
    o.botonDice=bm?(bm.textContent||'').replace(/\s+/g,' ').trim():'';
    const COLORES=/^#(E23D3D|3B3486|7A5C3E|F08A24|8A8A2B|6B4E2E|1F2A33|1E9E6A)$/i;
    const contarCapa=()=>{ let z=0,l=0;
      window.map.eachLayer(x=>{
        if(x instanceof L.Polygon && x.options && COLORES.test(x.options.fillColor||'')) z++;
        else if(x instanceof L.Polyline && !(x instanceof L.Polygon) && x.options &&
                COLORES.test(x.options.color||'')) l++;
      });
      return {zonas:z, lineas:l};
    };
    o.enMapa=contarCapa();
    if(bm){ bm.click(); await esperar(600); }
    o.apagada=contarCapa();
    // Y en la lista de capas, con su cuenta.
    o.capaEnLista=(function(){
      const c=[...H().querySelectorAll('.pcr-capa')]
        .filter(x=>/Lo intangible/.test(x.textContent||''))[0];
      return c?{ texto:(c.textContent||'').replace(/\s+/g,' ').trim(),
                 on:c.classList.contains('on'), gris:c.classList.contains('pcr-capa-gris') }:null;
    })();
    const bm2=H().querySelector('[data-pcr="int-mapa"]');
    if(bm2){ bm2.click(); await esperar(500); }
    o.reencendida=contarCapa();

    // ── Borrar una marca.
    const asa3=H().querySelector('[data-pcr="agrandar"]');
    if(asa3){ asa3.click(); await esperar(400); }
    const equis=[...H().querySelectorAll('[data-pcr="int-borrar"]')].pop();
    o.antesDeBorrar=o.items.length;
    if(equis){ equis.click(); await esperar(600); }
    o.despuesDeBorrar=[...H().querySelectorAll('.pcr-int-item')].length;

    // ── El papel.
    const nom=document.getElementById('pcr-nombre');
    if(nom) nom.value='El recorrido de la tarde';
    H().querySelector('[data-pcr="lamina"]').click(); await esperar(900);
    o.lamina=capturado; capturado='';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(900);
    o.pdf=capturado; capturado='';

    // ── Y que se haya guardado con la ficha.
    o.guardado=(function(){
      try{
        const f=(R.leerFichas()||[])[0];
        if(!f) return null;
        return { n:(f.intangible||[]).length,
                 tipos:(f.intangible||[]).map(m=>m.tipo),
                 nota:(f.intangible||[]).map(m=>m.nota).filter(Boolean)[0]||'' };
      }catch(e){ return null; }
    })();
    return o;
  },{C,POL,RECORRIDO});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  const medir=async(html,w,h)=>{
    const m=await ctx.newPage();
    await m.setViewportSize({width:w,height:h});
    await m.setContent(html||'<i></i>',{waitUntil:'load'});
    await m.waitForTimeout(450);
    const out=await m.evaluate(()=>({
      perdidas:(function(){
        const rej=document.querySelector('.rej');
        if(!rej) return [];
        const R=rej.getBoundingClientRect();
        const fuera=[...rej.children].filter(c=>{
          const b=c.getBoundingClientRect();
          return b.height===0 || b.right>R.right+2;
        }).map(c=>(c.querySelector('h2')||{}).textContent||'?');
        const h=document.querySelector('.hoja');
        if(h && h.scrollHeight>h.clientHeight+2)
          fuera.push('(la hoja se pasa '+(h.scrollHeight-h.clientHeight)+' px de alto)');
        return fuera;
      })(),
      cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?')
    }));
    await m.close(); return out;
  };
  r.medida=await medir(r.lamina,2268,3402);
  fs.writeFileSync(S+'intangible-lamina.html', r.lamina||'', 'utf8');
  fs.writeFileSync(S+'intangible-pdf.html', r.pdf||'', 'utf8');
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const LAM=r.lamina||'', PDF=r.pdf||'';

  console.log('\n  -- el lápiz --');
  T('el módulo está cargado', r.hayModulo===true);
  T('con los ocho tipos, y la percepción de seguridad entre ellos',
    (r.tipos||[]).length===8 && r.tipos.indexOf('inseguro')>=0 &&
    r.tipos.indexOf('oscuro')>=0 && r.tipos.indexOf('inhabitable')>=0,
    (r.tipos||[]).join(' '));
  T('vacío, el bloque no dice «sin datos» sino qué preguntar',
    /solo lo tiene quien caminó/.test(r.vacio) && /no pasarías de noche/i.test(r.vacio));
  T('y ofrece un lápiz por tipo', (r.lapices||[]).length===8, (r.lapices||[]).join(' '));
  T('ninguna marca se quedó sin lápiz', !r.faltaLapiz, (r.faltaLapiz||[]).join(' ')||'ninguna');
  T('la barra de dibujo se retira al terminar', r.barraSeFue===true);

  console.log('\n  -- lo que quedó marcado --');
  T('las siete marcas están en la lista', (r.items||[]).length===7,
    (r.items||[]).join(' · '));
  T('contadas por tipo', (r.cuentas||[]).length===6, (r.cuentas||[]).join(' | '));
  T('la barrera se mide en metros y no en m²',
    (r.cuentas||[]).some(c=>/pasar/i.test(c) && /\d+ m$/.test(c)),
    (r.cuentas||[]).filter(c=>/pasar/i.test(c))[0]||'no está');
  T('y se dice qué porción del sector quedó marcada',
    /% *<?\/?b?>? *de la superficie del sector|de la superficie del sector/.test(r.ficha) &&
    /\d+(\.\d+)?%/.test(r.ficha),
    (r.ficha.match(/sobre ([\d.]+%) de la superficie/)||['no lo dice'])[0]);

  console.log('\n  -- donde percepción y conteo no coinciden --');
  const des=(r.desacuerdos||[]).join(' ~ ');
  T('la zona insegura con diez locales sale señalada',
    /marcada como insegura tiene 10 usos/.test(des), (des.match(/tiene 10 usos[^.]*\./)||[''])[0]);
  T('y se dice que por el conteo debería sentirse acompañada',
    /debería sentirse acompañada/.test(des));
  T('la zona insegura vacía sale por lo contrario',
    /no tiene ni un uso registrado/.test(des));
  T('lo agradable dentro de lo oscuro sale como contradicción',
    /agradable dentro de una zona sin luz/.test(des));
  T('y la barrera avisa que el alcance a pie está de más',
    /barrera/i.test(des) && /minutos dibujados son menos/.test(des));

  console.log('\n  -- lo que le toca al lote --');
  T('el lote cae dentro de la zona de ruido',
    /El lote cae dentro de/.test(r.ficha) && /ruido/i.test(r.ficha),
    (r.ficha.match(/El lote cae dentro de[^.]{0,80}/)||['no lo dice'])[0]);
  T('y la barrera aparece cerca, con su distancia',
    /Cerca, sin tocarlo:.*pasar.*\d+ m/.test(r.ficha),
    (r.ficha.match(/Cerca, sin tocarlo:[^.]{0,90}/)||['no lo dice'])[0]);

  console.log('\n  -- en el mapa --');
  T('hay un botón para verlo', r.hayBotonMapa===true);
  T('recién marcado ya está puesto, sin encender nada',
    (r.enMapa||{}).zonas>=5, JSON.stringify(r.enMapa));
  T('y por eso el botón ofrece quitarlo', /Quitar del mapa/.test(r.botonDice||''), r.botonDice);
  T('las zonas llevan el color de su tipo y la barrera va de línea',
    (r.enMapa||{}).lineas>=1);
  T('al apagarla no queda nada',
    (r.apagada||{}).zonas===0 && (r.apagada||{}).lineas===0, JSON.stringify(r.apagada));
  T('y vuelve entera al encenderla otra vez',
    (r.reencendida||{}).zonas===(r.enMapa||{}).zonas &&
    (r.reencendida||{}).lineas===(r.enMapa||{}).lineas, JSON.stringify(r.reencendida));
  T('aparece en la lista de capas, ya lista y con su cuenta',
    !!r.capaEnLista && !r.capaEnLista.gris && /marcas/.test(r.capaEnLista.texto),
    r.capaEnLista?r.capaEnLista.texto:'no está');

  console.log('\n  -- se puede corregir y se guarda --');
  T('borrar una marca la quita', r.despuesDeBorrar===r.antesDeBorrar-1,
    r.antesDeBorrar+' → '+r.despuesDeBorrar);
  T('el recorrido viaja con la ficha', !!r.guardado && r.guardado.n===6,
    r.guardado?r.guardado.n+' marcas: '+r.guardado.tipos.join(' '):'no se guardó');
  T('y la nota escrita a mano también',
    !!r.guardado && /me robaron el celular/.test(r.guardado.nota||''),
    r.guardado?r.guardado.nota:'');

  console.log('\n  -- que se pueda leer --');
  T('todo el texto del bloque pasa 4.5:1',
    (r.contraste||{}).n===0,
    ((r.contraste||{}).flojos||[]).join(' ; ') || (r.contraste||{}).n + ' flojos');
  T('la pregunta del campo de la nota también',
    (r.contraste||{}).marcador >= 4.5, (r.contraste||{}).marcador + ':1');

  console.log('\n  -- en el papel --');
  T('la lámina trae la caja', /<h2>Lo intangible<\/h2>/.test(LAM));
  T('con el recuento por tipo y la conclusión del lote',
    /marcas de lo que no se mide/.test(LAM) && /El lote cae dentro de/.test(LAM));
  T('y dice que es un testimonio, no una medición',
    /no es una medición/.test(LAM) && /quien caminó/.test(LAM));
  T('el mapa de lo intangible entra en la banda del pliego',
    /<figcaption>Lo intangible<\/figcaption>/.test(LAM));
  T('el PDF trae la sección', /<h2>Lo intangible<\/h2>/.test(PDF));
  T('con los desacuerdos aparte', /Donde no coinciden la percepción y el conteo/.test(PDF));
  T('y las notas completas, en sus palabras',
    /En sus palabras/.test(PDF) && /me robaron el celular/.test(PDF));
  T('ninguna caja se recorta', (r.medida.cajas||[]).length===0,
    (r.medida.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde fuera de la hoja', (r.medida.perdidas||[]).length===0,
    (r.medida.perdidas||[]).join(' · ')||'ninguna');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
