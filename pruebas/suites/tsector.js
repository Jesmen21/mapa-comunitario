const E = require('../entorno.js');
/* Tanda AC · cambiar de sector sin llevarse el trabajo por delante.

   Tres cosas medidas antes de tocar nada:

     · El botón «Analizar otro sector» soltaba el resultado y dejaba la huella
       del área en blanco. Como la guarda pedía huella Y resultado, no volvía
       a dispararse nunca: la marca dibujada en un sector aparecía archivada
       en la ficha del siguiente, a trescientos metros, como si alguien la
       hubiera caminado ahí. Un dato de percepción atribuido a un barrio donde
       nadie estuvo es peor que no tener el dato.

     · Cuando sí se borraba, se borraba en silencio. Cuarenta recorridos del
       curso desaparecían de la pantalla sin una palabra; la ficha quedaba
       archivada, pero eso no se decía en ninguna parte y para quien lo estaba
       mirando era indistinguible de haberlo perdido.

     · Y al reabrir un sector archivado, el informe mostraba las marcas
       propias y ninguna de las demás. Los recorridos del curso estaban
       guardados —desde v705— y el informe no los nombraba.                */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs'); const path=require('path');
const S=E.TRABAJO; const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL =[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
// El área B, a unos trescientos metros: otro sector, no otro encuadre.
const POL2=POL.map(p=>({lat:p.lat-0.0030,lng:p.lng-0.0030}));
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1; const usos=[];
for(let i=0;i<40;i++){ const a=i*9*Math.PI/180, d=(140+(i%4)*50)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

// Ana y Luis, que caminaron la misma esquina que la estudiante.
const DIR=path.join(S,'recorridos-sector'); fs.mkdirSync(DIR,{recursive:true});
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
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  // ── El sector A, con una marca propia encima.
  await pg.evaluate(async (D)=>{
    const {C,POL}=D, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1400);
    const H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="inseguro"]');
    if(lap){ lap.click(); await esperar(300);
      [[70,70],[130,70],[130,130],[70,130]].forEach(([x,y])=>{
        const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(200);
      const c=document.querySelector('#pcr-int-barra [data-int="cerrar"]'); if(c){ c.click(); await esperar(600); }
    }
  },{C,POL});

  // Y los recorridos del curso.
  await pg.setInputFiles('#pcr-int-archivo', archivos);
  await pg.waitForTimeout(1600);

  const conTrabajo=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    o.marcas=(R.intangibleDePrueba()||[]).length;
    o.curso=(R.cursoDePrueba()||[]).length;
    const f=(R.leerFichas()||[])[0]||{};
    o.idA=f.id; o.enFicha={marcas:(f.intangible||[]).length, curso:(f.intCurso||[]).length};
    return o;
  });

  /* ── El mismo sector con otro encuadre NO es otro sector ───────────────
     Sobre un área dibujada, mover el radio no cambia la huella: las marcas
     siguen siendo de ese sitio. Una guarda demasiado celosa sería tan mala
     como ninguna. */
  const mismoSitio=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const bo=H().querySelector('[data-pcr="otro"]');
    if(bo){ bo.click(); await esperar(500); }
    R.cerrar(); await esperar(150); R.abrir(); await esperar(500);
    o.marcas=(R.intangibleDePrueba()||[]).length;
    o.curso=(R.cursoDePrueba()||[]).length;
    return o;
  });

  /* ── Otra área: eso sí es otro sector ─────────────────────────────────── */
  const otroSector=await pg.evaluate(async (D)=>{
    const {POL2}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    R.cerrar(); await esperar(150);
    A.iniciarDibujo(); POL2.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL2[0].lat,POL2[0].lng);
    await esperar(250);
    R.abrir(); await esperar(600);
    const ag=H().querySelector('[data-pcr="agrandar"]'); if(ag){ ag.click(); await esperar(400); }
    o.marcas=(R.intangibleDePrueba()||[]).length;
    o.curso=(R.cursoDePrueba()||[]).length;
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.loDice=/quedó guardado con/i.test(t) && /pestaña «Sector»/i.test(t);
    o.cuenta=/1 marca tuya/.test(t) && /2 recorridos traídos/.test(t);
    o.frase=(t.match(/[^.]{0,40}(quedó guardado con)[^.]{0,150}\./i)||[])[0]||'no dice nada';
    // Y se analiza el sector nuevo: nada del anterior puede colarse.
    await R.analizar(); await esperar(1500);
    o.marcasTrasAnalizar=(R.intangibleDePrueba()||[]).length;
    const fs2=R.leerFichas()||[];
    o.fichas=fs2.length;
    o.idB=(fs2[0]||{}).id;
    o.enFichaB={marcas:((fs2[0]||{}).intangible||[]).length, curso:((fs2[0]||{}).intCurso||[]).length};
    return o;
  },{POL2});

  /* ── Y la ficha de A sigue entera y se lee entera ─────────────────────── */
  const releida=await pg.evaluate(async (D)=>{
    const {idA}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON;
    const f=(R.leerFichas()||[]).filter(x=>x.id===idA)[0];
    o.sigue=!!f;
    o.guardaTodo=f?{marcas:(f.intangible||[]).length, curso:(f.intCurso||[]).length}:null;
    R.accion('ver',{getAttribute:function(){ return idA; }}); await esperar(300);
    const html=R.htmlPestana();
    o.nombraAlCurso=/Ana/.test(html) && /Luis/.test(html);
    o.cuentaRecorridos=/<b>3<\/b><small>recorridos/.test(html);
    o.hayAcuerdo=/coinciden/i.test(html);
    // Y sin los botones vivos: traer o quitar recorridos es del sector que se
    // está trabajando, no de uno archivado.
    o.sinBotonesVivos=!/data-pcr="int-importar"/.test(html) && !/data-pcr="int-curso-borrar"/.test(html);
    return o;
  },{idA:conTrabajo.idA});

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- el sector A, con trabajo a mano encima --');
  T('una marca propia y dos recorridos traídos, archivados',
    conTrabajo.marcas===1 && conTrabajo.curso===2 &&
    conTrabajo.enFicha.marcas===1 && conTrabajo.enFicha.curso===2,
    JSON.stringify(conTrabajo.enFicha));

  console.log('\n  -- reencuadrar no es cambiar de sector --');
  T('«Analizar otro sector» sobre la misma área no borra el trabajo',
    mismoSitio.marcas===1 && mismoSitio.curso===2,
    mismoSitio.marcas+' marcas · '+mismoSitio.curso+' recorridos');

  console.log('\n  -- otra área sí lo es --');
  T('el trabajo del sector anterior se suelta',
    otroSector.marcas===0 && otroSector.curso===0);
  T('y se dice adónde fue a parar', otroSector.loDice===true, otroSector.frase);
  T('con la cuenta de lo que llevaba', otroSector.cuenta===true);
  /* Lo que hacía el código de antes: la marca del sector A terminaba
     archivada en la ficha del B, a trescientos metros. */
  T('nada del sector anterior se cuela en el nuevo',
    otroSector.marcasTrasAnalizar===0 && otroSector.enFichaB.marcas===0 && otroSector.enFichaB.curso===0,
    JSON.stringify(otroSector.enFichaB));
  T('y el nuevo es otra ficha, no la de antes pisada',
    otroSector.idB!==conTrabajo.idA && otroSector.fichas>=2, otroSector.fichas+' fichas');

  console.log('\n  -- y la ficha de A se lee entera --');
  T('sigue guardada con todo lo que tenía',
    releida.sigue && releida.guardaTodo.marcas===1 && releida.guardaTodo.curso===2,
    JSON.stringify(releida.guardaTodo));
  /* Estaban guardados desde v705 y el informe no los nombraba: quien reabría
     un sector veía sus marcas y ninguna de las demás. */
  T('el informe nombra a quienes caminaron', releida.nombraAlCurso===true);
  T('y cuenta los tres recorridos, no solo el propio', releida.cuentaRecorridos===true);
  T('con el acuerdo recalculado', releida.hayAcuerdo===true);
  T('sin los botones de traer y quitar, que son del sector vivo',
    releida.sinBotonesVivos===true);

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
