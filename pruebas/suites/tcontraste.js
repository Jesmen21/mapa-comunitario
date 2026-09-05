const E = require('../entorno.js');
/* Tanda AF · que el texto se lea, medido en vez de mirado.

   Llegaron dos capturas de campo con texto ilegible. La causa no era la
   pantalla de las capturas: es una regla que pinta `p`, `small`, `span` y
   `label` de color menta con `!important` en TODA la aplicación, y cada
   pantalla la contradice a mano cuando alguien se da cuenta. Se puso un piso
   legible en la hoja de reconocimiento; el resto quedó a merced de la regla,
   y esperar la próxima foto no es un método.

   Esto lo mide: recorre lo que hay en pantalla, calcula el contraste real
   —el de WCAG, con los colores que el navegador terminó aplicando— y falla
   si algo baja de 4,5:1.

   Dos cosas que aprendió esta prueba a fuerza de inventar fallos:

     · Un fondo con degradado o con transparencia no se puede comparar con
       esta cuenta. La primera versión midió el botón «Ver el análisis» en
       1:1 —lee el color del padre porque el degradado no es un
       `backgroundColor`— y estuve a punto de arreglar algo que no estaba
       roto. Ahora esos se saltan y se dicen aparte.
     · Un icono no es texto: WCAG le pide 3:1, no 4,5:1. El ⚠ del mapa de
       percepción da 4,23 sobre su rojo y no es un defecto.             */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs'); const S=E.TRABAJO; const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
let id=1; const usos=[];
for(let i=0;i<120;i++){ const a=i*3*Math.PI/180, d=(120+(i%9)*40)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'Establecimiento '+i, amenity:['pharmacy','restaurant','school','bank','cafe'][i%5]}}); }

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
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    // ── El medidor.
    function lum(c){
      const m=String(c).match(/[\d.]+/g)||[0,0,0];
      const v=m.slice(0,3).map(x=>{ x=Number(x)/255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); });
      return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
    }
    function ratio(a,b){ const l1=lum(a),l2=lum(b), hi=Math.max(l1,l2), lo=Math.min(l1,l2);
      return Math.round(((hi+0.05)/(lo+0.05))*100)/100; }
    /* El fondo sólido de atrás, o null si no se puede saber. Ver la cabecera:
       un degradado o una transparencia no se comparan con esta cuenta. */
    function fondoDe(el){
      let n=el;
      while(n && n!==document.documentElement){
        const cs=getComputedStyle(n);
        if(cs.backgroundImage && cs.backgroundImage!=='none') return null;
        const c=cs.backgroundColor;
        if(c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)){
          const al=(c.match(/rgba\([^)]*,\s*([\d.]+)\)/)||[])[1];
          if(al!==undefined && Number(al)<0.98) return null;
          return c;
        }
        n=n.parentElement;
      }
      return 'rgb(255,255,255)';
    }
    // Los iconos no son texto: WCAG les pide 3:1. Se miden aparte.
    const ICONO=/^[\s -㌀-\u{1F000}-\u{1FAFF}·|—–]+$/u;
    window.__barrer=function(){
      const flojos=[], saltados=[], iconos=[], vistos={};
      document.querySelectorAll('body *').forEach(function(el){
        const propio=[...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim());
        if(!propio) return;
        const txt=el.textContent.trim();
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)<0.7) return;
        if(!el.getClientRects().length) return;
        const clave=el.tagName+'|'+el.className+'|'+cs.color;
        if(vistos[clave]) return; vistos[clave]=1;
        const alpha=(String(cs.color).match(/rgba\([^)]*,\s*([\d.]+)\)/)||[])[1];
        const fo=fondoDe(el);
        if(!fo || (alpha!==undefined && Number(alpha)<0.98)){
          saltados.push({clase:String(el.className).slice(0,40), txt:txt.slice(0,24)});
          return;
        }
        const rc=ratio(cs.color, fo);
        const fila={clase:String(el.className).slice(0,40), tag:el.tagName, color:cs.color,
                    fondo:fo, r:rc, txt:txt.slice(0,26), px:Math.round(parseFloat(cs.fontSize))};
        if(ICONO.test(txt)){ if(rc<3) iconos.push(fila); return; }
        if(rc<4.5) flojos.push(fila);
      });
      return { flojos:flojos.sort((a,b)=>a.r-b.r), iconos:iconos, saltados:saltados.length };
    };

    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }

    // 1 · La pantalla de ajustes, antes de analizar nada.
    R.abrir(); await esperar(500);
    const H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    await abrir();
    o.ajustes=window.__barrer();

    // 2 · La ficha entera, que es la pantalla larga.
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1500);
    await abrir();
    o.ficha=window.__barrer();

    // 3 · Y la pestaña «Sector», con una ficha abierta.
    const bg=[...H().querySelectorAll('button')].filter(x=>/Guardar ficha/i.test(x.textContent||''))[0];
    if(bg){ bg.click(); await esperar(600); }
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(900);
    const cab=document.querySelector('.pcr-pest-cab');
    if(cab){ cab.click(); await esperar(800); }
    o.pestana=window.__barrer();
    return o;
  },{C,POL});

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const lista=f=>f.map(x=>x.r+':1 '+x.tag+'.'+(x.clase||'(sin clase)')+' '+x.color+' sobre '+x.fondo+
                          ' «'+x.txt+'»').join('   ·   ');

  [['la pantalla de ajustes','ajustes'],['la ficha del sector','ficha'],['la pestaña «Sector»','pestana']]
    .forEach(function(par){
      const nom=par[0], d=r[par[1]]||{flojos:[],iconos:[],saltados:0};
      console.log('\n  -- '+nom+' --');
      T('todo el texto llega a 4,5:1', (d.flojos||[]).length===0, lista(d.flojos||[]) ||
        'nada por debajo · '+d.saltados+' sin medir (degradado o transparencia)');
      T('y los iconos a 3:1', (d.iconos||[]).length===0, lista(d.iconos||[])||'ninguno flojo');
    });

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
