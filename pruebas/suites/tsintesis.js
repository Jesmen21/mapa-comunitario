const E = require('../entorno.js');
/* Tanda D · la mezcla de usos y la síntesis del sector.

   Dos cosas que se comprueban juntas porque una alimenta a la otra:

   · El ÍNDICE DE MEZCLA. Se corre el mismo sector dos veces con dos padrones
     de usos distintos: uno con un solo tipo de uso —solo droguerías— y otro
     con cinco tipos repartidos. El primero tiene que dar 0 y llamarse
     «monofuncional»; el segundo, alto. Es una medida relativa, así que lo que
     se comprueba es su comportamiento, no un decimal copiado de la fórmula.

   · La SÍNTESIS. Que cada frase nazca de un dato medido y se apague sola si
     ese dato no está: antes de medir el terreno, la síntesis no dice nada del
     terreno —ni bien ni mal— y en cambio lo pide en «lo que falta levantar».
     Es la regla que hace que la lámina se pueda defender. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
let id=1;
const nodo=(tags,i,n)=>{ const a=i*(360/n)*Math.PI/180, d=(150+(i%4)*80)/111320;
  return {type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,tags:tags}; };

// ── Padrón A: un solo tipo de uso. Índice de mezcla = 0.
const SOLO=[]; for(let i=0;i<24;i++) SOLO.push(nodo({name:'Droguería '+i, amenity:'pharmacy'},i,24));

// ── Padrón B: cinco tipos repartidos parejo. Índice alto.
const VARIOS=[]; const TIPOS=[
  {amenity:'pharmacy'},        // salud        → institucional
  {shop:'supermarket'},        // comercio     → comercial
  {amenity:'school'},          // cultura      → institucional
  {leisure:'park'},            // parque       → residencial
  {man_made:'works'},          // industria    → industrial
  {amenity:'fuel'}             // servicios    → servicios
];
for(let i=0;i<36;i++) VARIOS.push(nodo(Object.assign({name:'Uso '+i}, TIPOS[i%TIPOS.length]),i,36));

// La geometría del trazado, para la segunda vuelta.
const geo=[]; const N=6, paso=L*1.4/(N-1), ini=-L*0.7;
const xs=[], ys=[];
for(let i=0;i<N;i++){ xs.push(ini+i*paso); ys.push(ini+i*paso); }
xs.forEach((x,i)=>geo.push({type:'way',id:id++,tags:{highway:i===0?'primary':'residential',name:'Calle '+i},
  geometry:ys.map(y=>({lat:C.lat+y,lon:C.lng+x}))}));
ys.forEach((y,i)=>geo.push({type:'way',id:id++,tags:{highway:'residential',name:'Avenida '+i},
  geometry:xs.map(x=>({lat:C.lat+y,lon:C.lng+x}))}));
for(let i=0;i<40;i++){
  const dx=(-L*0.6+(i%8)*(L*0.17)), dy=(-L*0.6+Math.floor(i/8)*(L*0.24)), d=0.00009;
  geo.push({type:'way',id:id++,tags:{building:'house','building:levels':String(1+(i%4))},geometry:[
    {lat:C.lat+dy,lon:C.lng+dx},{lat:C.lat+dy+d,lon:C.lng+dx},
    {lat:C.lat+dy+d,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx}]});
}

// Una ladera fuerte: la síntesis tiene que salir con «pendiente fuerte».
const RAMPA={ lng0:C.lng-L, lng1:C.lng+L, z0:340, z1:454 };
const cotaDe=lng=>RAMPA.z0+(RAMPA.z1-RAMPA.z0)*((lng-RAMPA.lng0)/(RAMPA.lng1-RAMPA.lng0));

function climaSimulado(){
  const dias=[]; const ini2=new Date(Date.UTC(2021,0,1));
  for(let i=0;i<365*5;i++){
    const d=new Date(ini2.getTime()+i*86400000), mes=d.getUTCMonth();
    const lluvioso=(mes===3||mes===4||mes===9||mes===10);
    // Cúcuta es caliente: la media pasa de 26° y la síntesis debe decirlo.
    dias.push({ f:d.toISOString().slice(0,10), tMax:34, tMin:23,
      lluvia: lluvioso?(i%3===0?12:2):(i%9===0?3:0), viento:15, vientoDir:45 });
  }
  return dias;
}

let PADRON=SOLO;   // se cambia entre las dos vueltas

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
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : PADRON})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  await ctx.route(/archive-api\.open-meteo\.com/, r=>{
    const d=climaSimulado();
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      timezone:'America/Bogota',
      daily:{ time:d.map(x=>x.f), temperature_2m_max:d.map(x=>x.tMax), temperature_2m_min:d.map(x=>x.tMin),
        precipitation_sum:d.map(x=>x.lluvia), wind_speed_10m_max:d.map(x=>x.viento),
        wind_direction_10m_dominant:d.map(x=>x.vientoDir) }})});
  });
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elevation:lngs.map(cotaDe)})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  // ── Vuelta 1: un solo uso, sin medir nada más
  const r1=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
    const H=document.getElementById('pcr-hoja');
    const todo=txt(H);
    const i=todo.indexOf('Mezcla de usos');
    o.mezcla=i>=0?todo.slice(i,i+520):'';
    const j=todo.indexOf('Síntesis del sector');
    o.sintesis=j>=0?todo.slice(j,j+2000):'';
    /* La ficha ya es una matriz FODA. A favor = fortalezas más las
       oportunidades que vienen de afuera; en contra = debilidades más
       amenazas; falta levantar = las oportunidades marcadas como tarea. */
    const grupo=(cl,sel)=>[...H.querySelectorAll('.pcr-sintesis-'+cl+' li'+(sel||''))]
      .map(li=>txt(li.querySelector('span'))+' ‹'+txt(li.querySelector('b'))+'›');
    o.favor=grupo('bien').concat(grupo('oport',':not(.pcr-sx-tarea)'));
    o.contra=grupo('mal').concat(grupo('riesgo')); o.falta=grupo('oport','.pcr-sx-tarea');
    return o;
  },{C,POL});

  // ── Vuelta 2: cinco usos y todo medido
  PADRON=VARIOS;
  const r2=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    let lamina=''; window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ lamina=h; };

    // Otra área para que el análisis anterior se descarte, y a analizar.
    A.limpiarArea(); A.iniciarDibujo();
    const L2=0.0035;
    [[-L2,-L2],[L2,-L2],[L2,L2],[-L2,L2],[-L2,-L2]].forEach(([a,c])=>A.agregarPunto(C.lat+a,C.lng+c));
    R.cerrar(); await esperar(200); R.abrir(); await esperar(300);
    await esperar(5200);
    await R.analizar(); await esperar(1400);

    const H=()=>document.getElementById('pcr-hoja');
    const medir=async(acc, sel)=>{
      const b=H().querySelector('[data-pcr="'+acc+'"]');
      if(!b) return false;
      b.click();
      for(let i=0;i<70 && !document.querySelector(sel);i++) await esperar(400);
      await esperar(300); return !!document.querySelector(sel);
    };
    await esperar(5200);
    o.trz=await medir('trazado','.pcr-llenos');
    o.ter=await medir('terreno','.pcr-corte');
    o.cli=await medir('clima','.pcr-clima-lluvia');

    const todo=txt(H());
    const i=todo.indexOf('Mezcla de usos');
    o.mezcla=i>=0?todo.slice(i,i+520):'';
    const grupo=(cl,sel)=>[...H().querySelectorAll('.pcr-sintesis-'+cl+' li'+(sel||''))]
      .map(li=>txt(li.querySelector('span'))+' ‹'+txt(li.querySelector('b'))+'›');
    o.favor=grupo('bien').concat(grupo('oport',':not(.pcr-sx-tarea)'));
    o.contra=grupo('mal').concat(grupo('riesgo')); o.falta=grupo('oport','.pcr-sx-tarea');
    // Los cuatro cuadrantes tal como los muestra la ficha, para cotejarlos
    // uno a uno con las columnas del pliego.
    o.foda={ ok:grupo('bien'), tarea:grupo('oport'), no:grupo('mal'), riesgo:grupo('riesgo') };
    o.cuadrantesEnFicha=[...H().querySelectorAll('.pcr-lab')].map(txt).filter(t=>/^(Fortalezas|Oportunidades|Debilidades|Amenazas)/.test(t));

    const bl=H().querySelector('[data-pcr="lamina-ver"]');
    if(bl){ bl.click(); await esperar(500); }
    o.lamina=lamina;
    const bi=H().querySelector('[data-pcr="imprimir"]');
    if(bi){ bi.click(); await esperar(700); }
    o.pdf=lamina;
    return o;
  },{C,POL});

  const errs=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const idxDe=t=>{const m=(t||'').match(/Acá da ([\d,]+)/);return m?Number(m[1].replace(',','.')):null;};
  const i1=idxDe(r1.mezcla), i2=idxDe(r2.mezcla);
  const hay=(lista,re)=>(lista||[]).some(x=>re.test(x));

  console.log('\n  -- el índice de mezcla --');
  P('con un solo tipo de uso da cero', i1===0, 'índice '+i1);
  P('y se llama monofuncional', /monofuncional/i.test(r1.mezcla||''),
    (r1.mezcla||'').slice(0,90));
  P('con cinco tipos repartidos sube', i2!==null && i2>=0.55, 'índice '+i2);
  P('y deja de ser monofuncional', /mezclado/i.test(r2.mezcla||''),
    ((r2.mezcla||'').match(/Índice de mezcla · [\wá ]+/)||['—'])[0]);
  P('el segundo mezcla más que el primero', i2!==null && i1!==null && i2>i1, i1+' → '+i2);
  P('dice cuántos usos de cuántos hay', /\d+ de 7/.test(r2.mezcla||''),
    ((r2.mezcla||'').match(/\d+ de 7/)||['no lo dice'])[0]);
  P('y avisa del sesgo de OpenStreetMap con la vivienda',
    /comercio está mucho mejor registrado que la vivienda/.test(r2.mezcla||''));

  console.log('\n  -- la síntesis no habla de lo que no midió --');
  P('sin medir nada, no dice nada del terreno',
    !hay(r1.favor,/pendiente|ladera/i) && !hay(r1.contra,/pendiente|desnivel/i));
  P('ni del clima', !hay(r1.contra,/Clima cálido/i) && !hay(r1.favor,/viento/i));
  P('ni de los llenos y vacíos', !hay(r1.favor,/suelo sin construir/i));
  P('pero los pide en «lo que falta levantar»',
    hay(r1.falta,/Medir el trazado/) && hay(r1.falta,/Medir el terreno/) && hay(r1.falta,/Medir el clima/),
    (r1.falta||[]).join(' | ').slice(0,150));
  P('y marca el sector monofuncional en contra', hay(r1.contra,/monofuncional/i),
    (r1.contra||[]).join(' | ').slice(0,120));

  console.log('\n  -- y sí habla de lo que midió --');
  P('las tres mediciones se hicieron', r2.trz && r2.ter && r2.cli,
    'trazado '+r2.trz+' · terreno '+r2.ter+' · clima '+r2.cli);
  P('la ladera fuerte sale en contra, con su porcentaje',
    hay(r2.contra,/Pendiente fuerte.*‹.*%/), (r2.contra||[]).filter(x=>/Pendiente/.test(x))[0]||'no sale');
  P('el clima cálido también', hay(r2.contra,/Clima cálido.*‹.*°/),
    (r2.contra||[]).filter(x=>/Clima/.test(x))[0]||'no sale');
  P('la mezcla de usos sale a favor', hay(r2.favor,/Usos mezclados/),
    (r2.favor||[]).filter(x=>/mezclados/.test(x))[0]||'no sale');
  P('y ya no pide medir lo que ya se midió',
    !hay(r2.falta,/Medir el trazado|Medir el terreno|Medir el clima/),
    (r2.falta||[]).join(' | ').slice(0,150)||'nada pendiente');
  P('cada frase trae su número', (r2.favor.concat(r2.contra)).every(x=>/‹[^›]+›/.test(x)),
    (r2.favor.concat(r2.contra)).length+' frases');

  console.log('\n  -- llega a la lámina --');
  const LAM=r2.lamina||'';
  P('la lámina cierra con la síntesis', /Síntesis del sector<\/h2>/.test(LAM));
  /* Se pidió «la matriz FODA» por su nombre, y en el pliego real no salía
     ninguna síntesis —se había recortado por abajo—. Cuatro cuadrantes con su
     nombre, en la ficha y en los dos documentos. */
  const CUAD=['Fortalezas','Oportunidades','Debilidades','Amenazas'];
  P('como matriz FODA, con los cuatro cuadrantes',
    /Matriz FODA del sector/.test(LAM) && CUAD.every(c=>new RegExp('<h3>'+c+'<small>').test(LAM)),
    CUAD.filter(c=>new RegExp('<h3>'+c+'<small>').test(LAM)).join(' · ')||'ninguno');
  P('la ficha en pantalla trae los mismos cuatro', (r2.cuadrantesEnFicha||[]).length===4,
    (r2.cuadrantesEnFicha||[]).map(t=>t.split(' ')[0]).join(' · ')||'ninguno');
  P('y el informe en hojas también',
    /<h3>Matriz FODA<\/h3>/.test(r2.pdf||'') && CUAD.every(c=>new RegExp('<b>'+c+' · ').test(r2.pdf||'')));
  const colSint = c => (LAM.match(new RegExp('<div class="sn ' + c + '">[\\s\\S]*?<\\/div><\\/div>'))||[''])[0];
  P('la ladera fuerte es debilidad, no amenaza: lo interno y lo externo no se mezclan',
    /Pendiente fuerte/.test(colSint('no')) && !/Pendiente fuerte/.test(colSint('riesgo')),
    'debilidades: ' + (/Pendiente fuerte/.test(colSint('no'))?'sí':'no') + ' · amenazas: ' + (/Pendiente fuerte/.test(colSint('riesgo'))?'SÍ':'no'));
  /* Siete por columna, y antes eran cuatro. Se subió el tope porque se pidió
     —«mejorar el sistema FODA porque argumenta muy poquitas cosas»— y porque
     el corte de cuatro se había decidido cuando la síntesis sacaba ocho o
     nueve frases en total; ahora saca el doble y cortar en cuatro tiraba
     justo las de la red vial, la cobertura y el lote.

     Se comprueban los dos lados. Que no pase de siete: una columna de quince
     viñetas no la lee nadie frente a un pliego. Y que cuando corta lo DIGA:
     resumir es quedarse con siete y avisar que hay más; esconder es quedarse
     con siete y callarse, que es lo mismo que se ve y no es lo mismo que se
     hace. */
  const viñetas = c => colSint(c).split('class="sx"').length - 1;
  const CLASES=['ok','tarea','no','riesgo'];
  P('y como mucho siete por cuadrante',
    CLASES.every(c => viñetas(c) <= 7),
    CLASES.map(c => c + ':' + viñetas(c)).join(' · '));
  /* Y si corta, que lo diga —y solo si corta—. El aviso se compara contra la
     lista COMPLETA, no contra lo que se ve: mirando solo el papel, siete
     viñetas sin aviso pueden ser siete de siete o siete de doce, y son cosas
     distintas. Con la lista al lado, la comprobación es exacta en los dos
     sentidos: nada se esconde y no se avisa de nada que no falte. */
  const LISTA = r2.foda || { ok: [], tarea: [], no: [], riesgo: [] };
  const marca = c => (colSint(c).match(/sx-mas"><span>y (\d+) más/) || [])[1];
  P('y si corta, dice cuántas dejó fuera —y solo si corta—',
    CLASES.every(c => {
      const sobran = Math.max(0, (LISTA[c]||[]).length - 7);
      return sobran ? Number(marca(c)) === sobran : marca(c) === undefined;
    }),
    CLASES.map(c => c + ': ' + (LISTA[c]||[]).length + ' → ' +
      viñetas(c) + (marca(c) ? ' +' + marca(c) : '')).join(' · '));

  /* ── La rosa de los vientos, en la caja del clima ─────────────────
     «En el PDF falta el gráfico de la dirección de los vientos, en el mismo
     cuadro del clima». El motor manda el reparto por los ocho rumbos y solo
     se imprimía el dominante en una fila. Va la rosa, en la caja del clima
     del pliego y en el bloque del clima del informe. */
  console.log('\n  -- la rosa de los vientos, en la caja del clima --');
  const cajaClima = (LAM.split('<section class="caja').filter(x=>/<h2>El clima<\/h2>/.test(x))[0])||'';
  P('la caja del clima del pliego trae la rosa', /<div class="dib dib-rosa"><svg class="pcr-rosa-rumbos"/.test(cajaClima),
    cajaClima ? (/pcr-rosa-rumbos/.test(cajaClima)?'con rosa':'sin rosa') : 'no hay caja de clima');
  P('con los ocho rumbos dibujados', (cajaClima.match(/<path d="M100 100 L/g)||[]).length===8,
    (cajaClima.match(/<path d="M100 100 L/g)||[]).length+' rumbos');
  P('y dice de dónde viene el viento y qué parte del tiempo', /El viento viene del<\/span><b>[A-Za-z]+ \(\d+%\)/.test(cajaClima));
  const climaPdf = ((r2.pdf||'').split('<h2>').filter(x=>/^El clima del sitio</.test(x))[0])||'';
  P('el informe en hojas también la trae', /pcr-rosa-rumbos/.test(climaPdf),
    climaPdf ? (/pcr-rosa-rumbos/.test(climaPdf)?'con rosa':'sin rosa') : 'no hay bloque de clima');

  console.log('');
  P('sin errores de JavaScript', errs.length===0, errs.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
