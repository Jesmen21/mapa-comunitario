const E = require('../entorno.js');
/* Tanda M · cortes topográficos por el lote.

   El servicio de elevación se dobla con una ladera conocida: sube hacia el
   ORIENTE y hacia el NORTE, así que el agua baja al SUROCCIDENTE. Con la
   ladera definida por una fórmula, cada cifra que salga en pantalla se puede
   comprobar contra ella en vez de contra sí misma.

       z = 300 + 200·(x normalizado) + 100·(y normalizado)

   Lo que se comprueba: que la cota interpolada en el lote sea la de la
   fórmula, que los dos cortes crucen el sector entero marcando dónde cae el
   lote, que el dibujo declare su exageración vertical —un corte sin escala no
   es un corte— y que todo eso llegue a la lámina, al PDF y a la ficha
   guardada.                                                               */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const RAMPA={lng0:C.lng-L, lng1:C.lng+L, lat0:C.lat-L, lat1:C.lat+L, z0:300, dx:200, dy:100};
const cotaDe=(lat,lng)=> RAMPA.z0 +
  RAMPA.dx*((lng-RAMPA.lng0)/(RAMPA.lng1-RAMPA.lng0)) +
  RAMPA.dy*((lat-RAMPA.lat0)/(RAMPA.lat1-RAMPA.lat0));

const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<12;i++){ const a=i*30*Math.PI/180, d=(150+(i%3)*90)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, shop:'convenience'}}); }
const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Avenida 3','secondary',[P(-400,60),P(0,60),P(400,60)]),
  via('Calle 7','residential',[P(-30,-200),P(-30,60),P(-30,300)])
];

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
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lats=(u.searchParams.get('latitude')||'').split(',').map(Number);
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map((lng,i)=>cotaDe(lats[i],lng))})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    const trozo=(desde,largo)=>{
      const t=txt(H()); const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo);
    };

    // ── El lote ANTES de medir el terreno: el bloque tiene que pedirlo.
    const LOTE=[Q(120,60),Q(160,60),Q(160,100),Q(120,100)];
    const dibujarLote=async()=>{
      H().querySelector('[data-pcr="lote-dibujar"]').click(); await esperar(500);
      LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
      await esperar(400);
      document.querySelector('[data-lote="cerrar"]').click(); await esperar(700);
    };
    await dibujarLote();
    o.sinTerreno=/corte del terreno por el lote/.test(txt(H()));
    o.sinCortes=H().querySelectorAll('.pcr-corte').length;

    // ── Y ahora con el terreno medido.
    await esperar(5200);
    H().querySelector('[data-pcr="terreno"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-corte, .pcr-perfil');i++) await esperar(400);
    await esperar(800);

    o.cortes=[...H().querySelectorAll('.pcr-corte')].map(s=>({
      /* El rótulo no es el primer <text> del dibujo: antes van las cotas del
         eje. Se busca entre todos. */
      etq:([...s.querySelectorAll('text')].map(t=>t.textContent)
            .filter(t=>/–/.test(t))[0])||'',
      textos:[...s.querySelectorAll('text')].map(t=>t.textContent),
      banda:s.querySelectorAll('rect[fill="#FFD54F"]').length,
      etiqueta:s.getAttribute('aria-label')||''
    }));
    o.perfilesViejos=H().querySelectorAll('.pcr-perfil').length;
    o.bajo=trozo('El terreno bajo el lote',1100);

    // La cota que dice la ficha, contra la que dice la fórmula.
    o.cotaCentro=(function(){
      const m=(trozo('El terreno bajo el lote',200).match(/([\d.,]+)\s*msnm/)||[])[1];
      return m?Number(String(m).replace(',','.')):null;
    })();
    o.centroLote={ lat:(LOTE[0].lat+LOTE[2].lat)/2, lng:(LOTE[0].lng+LOTE[2].lng)/2 };

    // ── El papel.
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La ladera del oriente';
    H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(600);
    o.lamina=capturado; capturado='';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(600);
    o.pdf=capturado; capturado='';

    // ── La ficha guardada: la rejilla viaja con ella.
    const bg=[...H().querySelectorAll('button')].filter(b=>/Guardar ficha/i.test(b.textContent||''))[0];
    if(bg){ bg.click(); await esperar(800); }
    o.guardada=(function(){
      try{ const cru=localStorage.getItem('pcr_fichas_v1')||'';
        const f=JSON.parse(cru)[0]||{};
        const R2=f.terrenoRejilla||null;
        return { hay:!!R2, cotas:R2?(R2.z||[]).length:0, limites:!!(R2&&R2.limites),
                 bytes:cru.length };
      }catch(e){ return {error:String(e)}; }
    })();
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(800);
    const cab=[...document.querySelectorAll('.pcr-pest-cab')][0];
    if(cab){ cab.click(); await esperar(800); }
    const cuerpo=document.querySelector('.pcr-pest-cuerpo');
    o.reabierta={ cortes:cuerpo?cuerpo.querySelectorAll('.pcr-corte').length:0,
                  bajo:/El terreno bajo el lote/.test(cuerpo?cuerpo.textContent:'') };
    /* Desde el sector guardado la lámina BAJA un PDF y no pasa por la vista
       de impresión: se toma del armador del PDF, que recibe el mismo HTML, y
       se le corta la bajada para no llenar la carpeta de descargas. */
    if (window.URBIS_PLIEGO_PDF) {
      window.URBIS_PLIEGO_PDF.bajar = function () {};
      window.URBIS_PLIEGO_PDF.generar = function (h) { capturado = h;
        return Promise.resolve({ blob: new Blob(['x']), dpi: 120, bytes: 1, ancho: 1, alto: 1 }); };
    }
    const bl=[...document.querySelectorAll('[data-u52-call="pcr-lamina"]')][0];
    if(bl){ bl.click(); await esperar(700); }
    o.laminaGuardada=capturado; capturado='';
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));

  const medir=async(html,w,h)=>{
    const m=await ctx.newPage();
    await m.setViewportSize({width:w,height:h});
    await m.setContent(html||'<i></i>',{waitUntil:'load'});
    await m.waitForTimeout(400);
    const out=await m.evaluate(()=>({
      /* En columnas, la caja que no cabe no se recorta: se va a una columna
         que no existe y desaparece del papel sin dejar rastro. Se detecta
         mirando si alguna queda fuera del rectángulo de la rejilla. */
      perdidas: (function () {
        const rej = document.querySelector('.rej');
        if (!rej) return [];
        const R = rej.getBoundingClientRect();
        const fuera = [...rej.children].filter(c => {
          const b = c.getBoundingClientRect();
          return b.height === 0 || b.right > R.right + 2;
        }).map(c => (c.querySelector('h2') || {}).textContent || '?');
        // Y la hoja entera: si el contenido la pasó, lo de abajo se imprime
        // fuera del papel, que es la misma pérdida por otra puerta.
        const h = document.querySelector('.hoja');
        if (h && h.scrollHeight > h.clientHeight + 2) {
          fuera.push('(la hoja se pasa ' + (h.scrollHeight - h.clientHeight) + ' px de alto)');
        }
        return fuera;
      })(),
      cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?'),
      cortes:document.querySelectorAll('.pcr-corte').length
    }));
    await m.close(); return out;
  };
  r.medida=await medir(r.lamina,2268,3402);
  fs.writeFileSync(S+'cortes-lamina.html', r.lamina||'', 'utf8');
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- sin terreno medido no hay corte que inventar --');
  T('lo dice y manda a medir el terreno', r.sinTerreno===true);
  T('y no dibuja ningún corte mientras tanto', r.sinCortes===0, r.sinCortes+' cortes');

  console.log('\n  -- los dos cortes por el lote --');
  const cortes=r.cortes||[];
  T('salen los dos, más los dos del sector', cortes.length>=4, cortes.length+' cortes');
  const porLote=cortes.filter(c=>/por el lote/.test(c.etq));
  T('dos de ellos pasan POR EL LOTE', porLote.length===2,
    porLote.map(c=>c.etq).join(' · '));
  T('uno de occidente a oriente y otro de norte a sur',
    porLote.some(c=>/A–A′/.test(c.etq)) && porLote.some(c=>/B–B′/.test(c.etq)));
  T('con el lote marcado sobre el recorrido',
    porLote.every(c=>c.banda===1) && porLote.every(c=>c.textos.indexOf('el lote')>=0));
  T('ninguno usa ya el dibujo estirado de antes', r.perfilesViejos===0,
    r.perfilesViejos+' perfiles viejos');

  console.log('\n  -- un corte sin escala no es un corte --');
  T('cada uno declara su exageración vertical',
    cortes.every(c=>c.textos.some(t=>/^V ×\d+ · \d+ m de desnivel$/.test(t))),
    (cortes[0]&&cortes[0].textos.filter(t=>/V ×/.test(t))[0])||'no la dice');
  T('y rotula el eje de distancia',
    cortes.every(c=>c.textos.indexOf('metros de recorrido')>=0));
  T('con cotas en el eje vertical',
    cortes.every(c=>c.textos.filter(t=>/^\d{3,4}$/.test(t)).length>=2),
    (cortes[0]&&cortes[0].textos.filter(t=>/^\d{3,4}$/.test(t)).join(' '))||'');
  T('y una descripción para quien no ve el dibujo',
    cortes.every(c=>/metros sobre el nivel del mar/.test(c.etiqueta)));

  console.log('\n  -- la ladera de la maqueta, comprobada --');
  const esperada=cotaDe(r.centroLote.lat, r.centroLote.lng);
  T('la cota del lote es la de la fórmula, no otra',
    r.cotaCentro!=null && Math.abs(r.cotaCentro-esperada)<3,
    'dice '+r.cotaCentro+' y la ladera da '+Math.round(esperada*10)/10);
  T('y el agua baja al suroccidente, como la maqueta',
    /baja hacia el (suroeste|suroccidente)/.test(r.bajo),
    (r.bajo.match(/baja hacia el \w+/)||['no lo dice'])[0]);
  T('dice la pendiente del lote', /% de pendiente|de pendiente/.test(r.bajo));
  T('y advierte que el modelo no da la cota de una esquina',
    /cabe dentro de una sola celda|topografía en campo/.test(r.bajo));

  console.log('\n  -- en el papel --');
  const LAM=r.lamina||'', PDF=r.pdf||'', LG=r.laminaGuardada||'';
  T('la lámina cambia los cortes del centro por los del lote',
    /por el lote, de occidente a oriente/.test(LAM) && !/A–A′ \(de occidente/.test(LAM));
  T('el PDF los lleva también', /por el lote, de occidente a oriente/.test(PDF));
  T('y la lámina de un sector guardado', /por el lote, de occidente a oriente/.test(LG));
  T('ninguna caja se recorta', (r.medida.cajas||[]).length===0,
    (r.medida.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde fuera de la hoja', (r.medida.perdidas||[]).length===0,
    (r.medida.perdidas||[]).join(' · ')||'ninguna');

  console.log('\n  -- la ficha guardada --');
  T('guarda la rejilla de cotas', r.guardada.hay===true && r.guardada.limites===true,
    JSON.stringify(r.guardada));
  T('con todas sus cotas', r.guardada.cotas>=64, r.guardada.cotas+' cotas');
  T('y sin engordar el almacenamiento', r.guardada.bytes<400000, r.guardada.bytes+' bytes');
  T('reabierta, vuelve a cortar el terreno', r.reabierta.cortes>=2 && r.reabierta.bajo===true,
    r.reabierta.cortes+' cortes');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
