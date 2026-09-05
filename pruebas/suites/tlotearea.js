const E = require('../entorno.js');
/* Tanda N · empezar por el lote.

   Hasta ahora había dos maneras de decir qué analizar: un radio desde el
   centro del mapa, o el área dibujada en Pro City. Ninguna de las dos es la
   que corresponde al trabajo real del curso, que empieza al revés: primero se
   sabe cuál es el lote a intervenir y después se estudia lo que tiene
   alrededor.

   Esta prueba comprueba la tercera manera: marcar el lote amarillo, y que del
   propio lote salga el círculo azul —centrado en él, con el radio que uno
   ajusta— que define el sector a analizar.                                 */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078};
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<18;i++){ const a=i*20*Math.PI/180, d=(120+(i%4)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, shop:'convenience'}}); }
const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[ via('Calle 7','residential',[P(-40,-300),P(-40,0),P(-40,300)]),
            via('Avenida 3','secondary',[P(-400,40),P(0,40),P(400,40)]) ];

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
  let radiosPedidos=[];
  await ctx.route(/overpass/, r=>{
    /* La consulta viaja como POST con el cuerpo urlencodeado: sin decodificar,
       «around:800» llega como «around%3A800» y no se encuentra nunca. */
    let q=(r.request().postData()||'')+r.request().url();
    try{ q=decodeURIComponent(q); }catch(e){}
    const m=q.match(/around:(\d+)/); if(m) radiosPedidos.push(Number(m[1]));
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],16); await esperar(500);
    const R=window.URBIS_PC_RECON;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    R.cerrar(); await esperar(150); R.abrir(); await esperar(400);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();

    // ── Las tres maneras de decir qué analizar.
    o.formas=[...H().querySelectorAll('[data-pcr="forma"]')].map(b=>({
      f:b.getAttribute('data-f'), t:(b.textContent||'').trim()
    }));

    // ── La tercera: empezar por el lote.
    const bLote=H().querySelector('[data-pcr="forma"][data-f="lote"]');
    if(bLote){ bLote.click(); await esperar(500); }
    o.pideLote=/Marcar el lote en el mapa/.test(txt());
    o.sinRango=!H().querySelector('[data-pcr="radio-rango"]');
    /* Elegir «el lote y su entorno» encoge la hoja —hay que ver el mapa para
       marcarlo—, y en esa barra no hay botón de analizar hasta que el lote
       existe: no se ofrece analizar la nada. */
    o.botonBloqueado=(function(){
      const b2=H().querySelector('[data-pcr="analizar"]');
      return b2 ? b2.disabled : 'no hay botón';
    })();

    // El círculo del mapa, leído del propio Leaflet.
    const circulos=()=>{
      const out=[];
      window.map.eachLayer(l=>{ if(l instanceof L.Circle && l.getRadius)
        out.push({r:l.getRadius(), lat:l.getLatLng().lat, lng:l.getLatLng().lng}); });
      return out;
    };

    // ── Marcarlo. El mapa se deja LEJOS del predio a propósito: es lo que
    //    pasa de verdad —se busca el lote en el mapa y se marca donde esté—,
    //    y es lo que dejaba al círculo dibujado en otro barrio.
    /* El predio NO está donde estaba el mapa al abrir la hoja: está a un
       kilómetro y medio, que es lo que pasa siempre —se abre la lupa mirando
       una parte de la ciudad y el lote a estudiar está en otra—. Así se
       reprodujo la captura que trajo esto: seis esquinas marcadas al sur y el
       círculo punteado sobre el centro de Cúcuta. */
    const LOTE=[Q(1500-15,-1200-15),Q(1500+15,-1200-15),Q(1500+15,-1200+15),Q(1500-15,-1200+15)];
    const bDib=H().querySelector('[data-pcr="lote-dibujar"]');
    if(bDib){ bDib.click(); await esperar(600); }
    o.antesDeMarcar=circulos();
    o.lejosDelLote=(function(){ const c=circulos()[0], m=(LOTE[0].lat+LOTE[2].lat)/2, n=(LOTE[0].lng+LOTE[2].lng)/2;
      return c ? Math.round(Math.hypot((c.lat-m)*110540,
        (c.lng-n)*111320*Math.cos(m*Math.PI/180))) : -1; })();
    window.map.fire('click',{latlng:{lat:LOTE[0].lat,lng:LOTE[0].lng}});
    await esperar(300);
    o.conUnaEsquina={ circulos:circulos(), esquina:{lat:LOTE[0].lat,lng:LOTE[0].lng} };
    LOTE.slice(1).forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    o.antesDeCerrar=circulos();
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(800);
    const poligonos=()=>{
      const out=[];
      window.map.eachLayer(l=>{ if(l instanceof L.Polygon && l.options && /FFD54F/i.test(l.options.fillColor||''))
        out.push(l.getLatLngs()[0].length); });
      return out;
    };
    o.trasCerrar={ circulos:circulos(), lotes:poligonos() };
    o.centroLote={ lat:(LOTE[0].lat+LOTE[2].lat)/2, lng:(LOTE[0].lng+LOTE[2].lng)/2 };

    // Abrir la hoja entera para ver los ajustes.
    const asa=H().querySelector('[data-pcr="agrandar"]');
    if(asa){ asa.click(); await esperar(500); }
    o.conLote=txt().slice(0,600);
    const rango=H().querySelector('[data-pcr="radio-rango"]');
    o.rango=rango?{min:rango.min,max:rango.max,paso:rango.step,valor:rango.value}:null;

    // ── Mover el deslizador: el círculo se mueve, la hoja no se repinta.
    if(rango){
      rango.value='800';
      rango.dispatchEvent(new Event('input',{bubbles:true}));
      await esperar(250);
    }
    o.trasMover={ circulos:circulos(),
                  eco:(document.getElementById('pcr-radio-eco')||{}).textContent||'',
                  siguePuesto:document.activeElement===rango || !!H().querySelector('[data-pcr="radio-rango"]') };
    if(rango){ rango.dispatchEvent(new Event('change',{bubbles:true})); await esperar(400); }

    // ── Y analizar: lo que se consulta es el radio desde el lote.
    const bAn=H().querySelector('[data-pcr="analizar"]');
    o.botonListo=bAn?!bAn.disabled:null;
    await R.analizar(); await esperar(1400);
    o.ficha=txt();
    o.hayLoteEnFicha=/El lote a intervenir/.test(o.ficha);
    o.meta=(function(){ try{
      const f=JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]')[0]||{};
      return { forma:f.forma||'', radio:f.radioM||null,
               centro:f.centro||null, lote:(f.lote||[]).length };
    }catch(e){ return {error:String(e)}; } })();
    o.trasAnalizar={ circulos:circulos(), lotes:poligonos() };

    return o;
  },{C});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  r.radiosPedidos=radiosPedidos;
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const met=(a,b)=>Math.round(Math.hypot((a.lat-b.lat)*110540,
    (a.lng-b.lng)*111320*Math.cos(a.lat*Math.PI/180)));

  console.log('\n  -- tres maneras de decir qué analizar --');
  T('están las tres', (r.formas||[]).length===3,
    (r.formas||[]).map(f=>f.f+':'+f.t).join(' · '));
  T('la nueva se llama por lo que hace',
    (r.formas||[]).some(f=>f.f==='lote' && /lote y su entorno/i.test(f.t)));

  console.log('\n  -- primero el lote --');
  T('sin lote, pide marcarlo', r.pideLote===true);
  T('y no ofrece un radio de algo que no existe', r.sinRango===true);
  T('y no ofrece analizar la nada',
    r.botonBloqueado==='no hay botón' || r.botonBloqueado===true, String(r.botonBloqueado));

  /* El círculo tiene que seguir a las esquinas MIENTRAS se marcan, y no
     esperar a que el lote se cierre. Marcar seis esquinas viendo el círculo
     punteado a dos kilómetros —sobre donde estaba el mapa al empezar— es
     marcar a ciegas: la pantalla dice que se va a estudiar un sitio mientras
     el dedo está señalando otro. */
  console.log('\n  -- mientras se marca, el círculo va detrás --');
  T('buscar el predio en el mapa deja el círculo lejos, para empezar',
    r.lejosDelLote>=1500, r.lejosDelLote+' m del predio');
  const cu=(r.conUnaEsquina.circulos||[])[0];
  T('con la primera esquina puesta, el círculo ya está ahí',
    !!cu && met(cu, r.conUnaEsquina.esquina)<=5,
    cu ? met(cu, r.conUnaEsquina.esquina)+' m de la esquina' : 'no hay círculo');
  const ca=(r.antesDeCerrar||[])[0];
  T('y con las cuatro, en el centro del predio, sin haber cerrado nada',
    !!ca && met(ca, r.centroLote)<=5,
    ca ? met(ca, r.centroLote)+' m del centro del lote' : 'no hay círculo');

  console.log('\n  -- al cerrarlo, el círculo sale del lote --');
  const c1=(r.trasCerrar.circulos||[])[0];
  T('aparece un círculo azul', (r.trasCerrar.circulos||[]).length===1,
    JSON.stringify(r.trasCerrar.circulos));
  T('centrado en el lote, no donde quedó el mapa',
    !!c1 && met(c1, r.centroLote)<=5, c1?met(c1,r.centroLote)+' m de diferencia':'no hay círculo');
  T('y el lote amarillo sigue dibujado encima', (r.trasCerrar.lotes||[])[0]===4,
    JSON.stringify(r.trasCerrar.lotes));
  T('la hoja muestra el lote medido', /m² · 4 esquinas|4 esquinas/.test(r.conLote),
    (r.conLote.match(/[\d.,]+ m² · \d esquinas/)||['no lo dice'])[0]);

  console.log('\n  -- el radio se ajusta a mano --');
  T('hay un deslizador de 100 m a 2 km', !!r.rango && r.rango.min==='100' && r.rango.max==='2000',
    JSON.stringify(r.rango));
  T('de 50 en 50 metros', !!r.rango && r.rango.paso==='50');
  const c2=(r.trasMover.circulos||[])[0];
  T('moverlo mueve el círculo del mapa', !!c2 && Math.round(c2.r)===800,
    c2?Math.round(c2.r)+' m':'no hay círculo');
  T('sin arrancarle el control de la mano', r.trasMover.siguePuesto===true);
  T('y la cifra de al lado lo dice en cristiano', /800 m/.test(r.trasMover.eco), r.trasMover.eco);

  console.log('\n  -- y se analiza ese círculo --');
  T('el botón se habilita con el lote marcado', r.botonListo===true);
  T('lo consultado es el radio elegido', (r.radiosPedidos||[]).indexOf(800)>=0,
    (r.radiosPedidos||[]).join(' · ')||'ninguno');
  T('la ficha sale con el análisis del lote dentro', r.hayLoteEnFicha===true);
  T('la ficha guardada anota el radio y el lote',
    r.meta && r.meta.radio===800 && r.meta.lote===4, JSON.stringify(r.meta));
  T('el centro guardado es el del lote',
    !!(r.meta && r.meta.centro) && met(r.meta.centro, r.centroLote)<=5);
  T('y en el mapa siguen el círculo y el lote encima',
    (r.trasAnalizar.lotes||[])[0]===4);

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
