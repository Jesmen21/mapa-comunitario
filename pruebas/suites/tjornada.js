const E = require('../entorno.js');
/* Tanda AG · el día de campo entero, cronometrado.

   La pregunta que nadie había contestado con un número: ¿alcanza una clase de
   dos horas? Hasta acá cada pieza estaba probada por separado y el día
   completo no lo había corrido nadie de una sentada.

   Esto lo corre: llegar, analizar el sector, medirlo TODO —trazado, terreno,
   clima y amenaza, en serie, respetando el limitador de Overpass sin que
   nadie tenga que saber que existe—, marcar el lote, escribir los índices del
   POT, caminar y marcar lo intangible, juntar los recorridos del curso y
   llevárselo en un archivo.

   Lo que se afirma no son los minutos —eso mediría esta máquina, no la
   aplicación— sino lo que sí depende del código y le cuesta al estudiante en
   datos móviles: cuántas consultas hace el día entero, que ninguna se caiga
   por el limitador, y que la ficha termine completa. Los tiempos se imprimen
   como diagnóstico, para poder mirarlos cuando alguien pregunte.           */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs'); const path=require('path');
const S=E.TRABAJO; const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
const LOTE=[Q(-45,-35),Q(45,-35),Q(45,35),Q(-45,35)];

let id=1; const usos=[];
for(let i=0;i<220;i++){ const a=i*5*Math.PI/180, d=(110+(i%8)*45)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'Establecimiento '+i, amenity:['pharmacy','restaurant','school','bank','cafe'][i%5]}}); }
// Calles, para que el trazado tenga qué medir.
const vias=[]; for(let i=0;i<10;i++){
  const off=(i-5)*0.0008;
  vias.push({type:'way',id:9000+i,nodes:[],geometry:[
    {lat:C.lat+off,lon:C.lng-0.004},{lat:C.lat+off,lon:C.lng+0.004}],
    tags:{highway:'residential',name:'Calle '+i}});
}

// Dos recorridos del curso.
const DIR=path.join(S,'recorridos-jornada'); fs.mkdirSync(DIR,{recursive:true});
const archivos=['Ana','Luis'].map((autor,a)=>{
  const pts=[]; for(let v=0;v<8;v++){ const ang=v*45*Math.PI/180;
    pts.push(Q(100+Math.cos(ang)*35, 100+Math.sin(ang)*35)); }
  const f=path.join(DIR,autor+'.json');
  fs.writeFileSync(f, JSON.stringify({formato:'urbis-intangible-1',autor,sector:'El barrio',
    centro:{lat:C.lat,lng:C.lng},cuando:'2026-09-0'+(a+1)+'T20:00:00.000Z',
    marcas:[{id:'m'+a,tipo:'inseguro',geom:'zona',nota:'De noche no pasa nadie',
             ts:new Date().toISOString(),pts}]}),'utf8');
  return f;
});

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'martarojas',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
    localStorage.removeItem('pcr_trazo_vivo_v1');
  }catch(e){} });

  /* La cuenta de lo que costaría en datos móviles. Se mide por destino: lo
     que sale del teléfono a un servicio, no las hojas de estilo del propio
     sitio. */
  const red={ overpass:0, motor:0, geocodificacion:0, otros:0, bytes:0 };
  const cuenta=(u,n)=>{
    if(/overpass/.test(u)) red.overpass++;
    else if(/8787|api\.urbispro/.test(u)) red.motor++;
    else if(/locationiq|nominatim/.test(u)) red.geocodificacion++;
    else if(/8199/.test(u)) return;   // el propio sitio
    else red.otros++;
    red.bytes+=n||0;
  };

  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/locationiq\.com/, r=>{
    const cuerpo=JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}});
    cuenta(r.request().url(), cuerpo.length);
    r.fulfill({status:200,contentType:'application/json',body:cuerpo});});
  await ctx.route(/overpass/, r=>{
    const cuerpo=JSON.stringify({elements:usos.concat(vias)});
    cuenta(r.request().url(), cuerpo.length);
    r.fulfill({status:200,contentType:'application/json',body:cuerpo});});
  await ctx.route(/ags\.esri\.co/, r=>{
    const cuerpo=JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]});
    cuenta(r.request().url(), cuerpo.length);
    r.fulfill({status:200,contentType:'application/json',body:cuerpo});});
  /* Los tres servicios que faltaban para que el día se pueda correr entero:
     la elevación, el clima y el SGC. Se responden igual que en las suites que
     los prueban a fondo —`tterreno`, `tclima`, `tamenaza`—; acá lo que
     interesa no es lo que devuelven sino que la cadena los pida en serie, sin
     que el limitador de Overpass tumbe ninguno. */
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lats=(u.searchParams.get('latitude')||'').split(',').map(Number);
    const cuerpo=JSON.stringify({elevation:lats.map((la,i)=>320+(i%7)*4+(la-C.lat)*8000)});
    cuenta(r.request().url(), cuerpo.length);
    r.fulfill({status:200,contentType:'application/json',body:cuerpo});
  });
  await ctx.route(/archive-api\.open-meteo\.com/, r=>{
    const dias=[]; for(let i=0;i<365;i++){
      const d=new Date(2025,0,1+i);
      dias.push({f:d.toISOString().slice(0,10), tMax:28+(i%9)*0.5, tMin:19+(i%5)*0.4,
                 lluvia:(i%11===0)?12:0.4, viento:9+(i%6), vientoDir:(i*7)%360});
    }
    const cuerpo=JSON.stringify({timezone:'America/Bogota',
      daily:{ time:dias.map(d=>d.f), temperature_2m_max:dias.map(d=>d.tMax),
        temperature_2m_min:dias.map(d=>d.tMin), precipitation_sum:dias.map(d=>d.lluvia),
        wind_speed_10m_max:dias.map(d=>d.viento), wind_direction_10m_dominant:dias.map(d=>d.vientoDir) }});
    cuenta(r.request().url(), cuerpo.length);
    r.fulfill({status:200,contentType:'application/json',body:cuerpo});
  });
  await ctx.route(/srvags\.sgc\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    let cuerpo;
    if(/Zonas_amenaza_Sismica_NR10/.test(u)) cuerpo=[{attributes:{AMENAZA_SI:'Alta',AA:0.35,AV:0.30}}];
    else if(/Mov_Masa/.test(u)) cuerpo=[{attributes:{CATEGORIA:'Media'}}];
    else if(/Intensidad_Sismica_Esperada/.test(u)) cuerpo=[{attributes:{INTENSIDAD:'VIII'}}];
    else cuerpo=[{attributes:{MUNICIPIO:'Cúcuta',PGA:0.35}}];
    const b2=JSON.stringify({features:cuerpo});
    cuenta(r.request().url(), b2.length);
    r.fulfill({status:200,contentType:'application/json',body:b2});
  });
  await ctx.route(/visualizador\.ideam\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    const cuerpo=/MapServer\?f=json/.test(u)
      ? JSON.stringify({layers:[{id:1,name:'Amenaza Inundacion TR 2 Años Centros Poblados 2K'},
                                {id:5,name:'Amenaza Inundacion TR 100 Años Centros Poblados 2K'}]})
      : JSON.stringify({count:0});
    cuenta(r.request().url(), cuerpo.length);
    r.fulfill({status:200,contentType:'application/json',body:cuerpo});
  });

  // Lo que va al motor sí sale de verdad: se cuenta por su respuesta.
  ctx.on('response', async res=>{
    const u=res.url();
    if(/localhost:8787/.test(u)){
      let n=0; try{ n=(await res.body()).length; }catch(e){}
      cuenta(u,n);
    }
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,160)));
  const reloj={};
  const t0=Date.now();
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await E.esperarLaApp(pg);
  reloj.arrancar=Date.now()-t0;

  // ── 1 · Llegar y analizar el sector.
  let t=Date.now();
  const paso1=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(400);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(500); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(900);
    o.hay=R.estado().hay;
    return o;
  },{C,POL});
  reloj.analizar=Date.now()-t;

  // ── 2 · «Medir todo»: la cadena en serie, con el limitador adentro.
  t=Date.now();
  const paso2=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const bm=H().querySelector('[data-pcr="medir-todo"]');
    o.hayBoton=!!bm;
    if(bm) bm.click();
    // Se espera a que la cadena termine sola: el estudiante no tiene que
    // saber que hay un limitador de cinco segundos entre consultas.
    for(let i=0;i<90;i++){
      await esperar(1000);
      const t2=(H().textContent||'');
      if(!/Midiendo|Se está midiendo/i.test(t2)) break;
    }
    await esperar(1200);
    const R=window.URBIS_PC_RECON;
    o.terreno=!!R.terrenoDePrueba();
    const t3=(H().textContent||'').replace(/\s+/g,' ');
    o.rechazada=/Espera \d+ segundos/i.test(t3);
    o.midio=(t3.match(/(El trazado|El terreno|El clima|La amenaza)/g)||[]).length;
    return o;
  });
  reloj.medirTodo=Date.now()-t;

  // ── 3 · El lote, los índices, lo intangible y el curso.
  t=Date.now();
  const paso3=await pg.evaluate(async (D)=>{
    const {C,LOTE}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    await abrir();
    const bd=H().querySelector('[data-pcr="lote-dibujar"]');
    if(bd){ bd.click(); await esperar(400);
      LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
      await esperar(200);
      const c=document.querySelector('#pcr-lote-barra [data-lote="cerrar"]'); if(c){ c.click(); await esperar(700); }
    }
    o.lote=!!R.centroDelLoteDePrueba();
    // Los índices del POT y su procedencia.
    await abrir();
    const ids=[...H().querySelectorAll('[data-pcr-idx]')].map(c=>c.getAttribute('data-pcr-idx'));
    for(const idx of ids){
      await abrir();
      const c=H().querySelector('[data-pcr-idx="'+idx+'"]');
      if(!c) continue;
      c.value=String(Number(c.value)||1);
      c.dispatchEvent(new Event('change',{bubbles:true}));
      await esperar(90);
    }
    await abrir();
    const doc=H().querySelector('[data-pcr-fuente="documento"]');
    if(doc){ doc.value='Acuerdo 0089 · Planeación'; doc.dispatchEvent(new Event('change',{bubbles:true})); await esperar(250); }
    o.indices=ids.length;
    // Caminar y marcar.
    await abrir();
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="inseguro"]');
    if(lap){ lap.click(); await esperar(300);
      [[70,70],[130,70],[130,130],[70,130]].forEach(([x,y])=>{
        const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(200);
      const c=document.querySelector('#pcr-int-barra [data-int="cerrar"]'); if(c){ c.click(); await esperar(600); }
    }
    o.marcas=(R.intangibleDePrueba()||[]).length;
    return o;
  },{C,LOTE});
  await pg.setInputFiles('#pcr-int-archivo', archivos);
  await pg.waitForTimeout(1600);
  reloj.aMano=Date.now()-t;

  // ── 4 · Llevárselo: la ficha guardada y el respaldo del día.
  t=Date.now();
  const paso4=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const caja=document.getElementById('pcr-nombre');
    if(caja){ caja.value='La Playa, salida del jueves'; }
    const bg=[...H().querySelectorAll('button')].filter(x=>/Guardar ficha/i.test(x.textContent||''))[0];
    if(bg){ bg.click(); await esperar(700); }
    const f=(R.leerFichas()||[])[0]||{};
    o.completa={ nombre:!!f.nombre, trazado:!!f.trazado, terreno:!!f.terreno, clima:!!f.clima,
                 amenaza:!!f.amenaza, lote:!!f.lote, marcas:(f.intangible||[]).length,
                 curso:(f.intCurso||[]).length, indices:!!f.indices,
                 fuente:!!(f.indicesFuente&&f.indicesFuente.documento), usos:f.total||0 };
    o.fichaKB=Math.round(JSON.stringify(f).length/1024);
    const paq=JSON.stringify(R.respaldoDeTodo(R.leerFichas()));
    o.respaldoKB=Math.round(paq.length/1024);
    o.almacenKB=Math.round((localStorage.getItem('pcr_fichas_v1')||'').length/1024);
    return o;
  });
  reloj.llevarselo=Date.now()-t;
  reloj.total=Date.now()-t0;

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const seg=ms=>(ms/1000).toFixed(1)+' s';

  console.log('\n  -- el día, paso por paso --');
  console.log('   arrancar la app     '+seg(reloj.arrancar));
  console.log('   analizar el sector  '+seg(reloj.analizar));
  console.log('   medirlo todo        '+seg(reloj.medirTodo));
  console.log('   lote, POT y caminar '+seg(reloj.aMano));
  console.log('   guardar y llevarse  '+seg(reloj.llevarselo));
  console.log('   ────────────────────────────');
  console.log('   el día entero       '+seg(reloj.total));
  console.log('   consultas: overpass '+red.overpass+' · motor '+red.motor+
              ' · geocodificación '+red.geocodificacion+' · otras '+red.otros+
              '  ('+Math.round(red.bytes/1024)+' KB)');

  console.log('\n  -- que la cadena corra sola --');
  T('el sector se analiza', paso1.hay===true);
  T('«medir todo» existe y encadena las cuatro mediciones',
    paso2.hayBoton===true && paso2.midio>=4, paso2.midio+' nombradas');
  /* El limitador de Overpass rechaza dos consultas seguidas. La cadena las
     espacia sola: si esto falla, el estudiante ve «Espera 3 segundos» en
     mitad de una salida y no sabe qué hacer con eso. */
  T('sin que ninguna consulta la rechace el limitador', paso2.rechazada===false);
  T('y el terreno queda medido', paso2.terreno===true);

  console.log('\n  -- lo que hace la persona --');
  T('el lote marcado', paso3.lote===true);
  T('los índices del POT escritos', paso3.indices>=7, paso3.indices+' casillas');
  T('la marca de percepción dibujada', paso3.marcas===1);

  console.log('\n  -- y al final del día, la ficha completa --');
  const c=paso4.completa;
  T('con nombre, trazado, terreno, clima y amenaza',
    c.nombre && c.trazado && c.terreno && c.clima && c.amenaza, JSON.stringify(c));
  T('con el lote, los índices y de dónde salieron',
    c.lote && c.indices && c.fuente);
  T('y con lo que caminaron: la marca propia y los dos recorridos traídos',
    c.marcas===1 && c.curso===2);
  T('todo cabe en un archivo que se lleva del teléfono',
    paso4.respaldoKB>0 && paso4.respaldoKB<1024,
    paso4.fichaKB+' KB la ficha · '+paso4.respaldoKB+' KB el respaldo del día');

  /* El presupuesto de datos móviles. No se afirman los minutos —eso mediría
     esta máquina— pero sí las consultas, que es lo que le cuesta al
     estudiante y lo que se dispara sin que nadie lo note. */
  console.log('\n  -- lo que cuesta en datos --');
  T('el día entero cabe en 12 consultas a Overpass o menos',
    red.overpass<=12, red.overpass+' consultas');
  T('y en 40 al motor o menos', red.motor<=40, red.motor+' consultas');

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
