const E = require('../entorno.js');
/* Dos cosas reportadas desde el celular: que los textos no se leen, y que al
   elegir radio/área la hoja debe bajar para ver el mapa. Se mide el CONTRASTE
   de verdad (no "puse un color", sino qué contraste da contra su fondo) y se
   recorre el flujo completo. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078};
const elements=[{type:'node',id:1,lat:C.lat+0.001,lon:C.lng,tags:{amenity:'pharmacy',name:'Drogas'}}];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block', viewport:{width:412,height:915}, isMobile:true, hasTouch:true});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    /* Desde que la licencia se pide AL TOCAR el botón (js/69 permitido),
       una suite sin licencia guardada se queda en la pantalla de licencia
       en vez de analizar. Es el comportamiento correcto: acá se pone la
       licencia igual que la pondría el curso en cada dispositivo. */
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t'}));
    localStorage.removeItem('aia_overpass_cache_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2500);

  const r = await pg.evaluate(async (C) => {
    const o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    document.body.classList.add('u52-real-map');
    const pant=document.querySelector('.u52-screen[data-u52-screen="map"]');
    if(pant) pant.classList.add('active','u52-procity-mapscreen');
    window.urbisProCityActivo=true;
    window.map.setView([C.lat,C.lng],15);
    await new Promise(r=>setTimeout(r,600));

    /* Contraste real: se convierte el color calculado a luminancia y se mide
       contra el fondo, como manda la norma. Decir «le puse #233748» no prueba
       nada si otra regla lo pisa. */
    function lum(c){
      const m=String(c).match(/[\d.]+/g)||[0,0,0];
      const v=[m[0],m[1],m[2]].map(x=>{ x=Number(x)/255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); });
      return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
    }
    function fondoDe(el){
      let p=el;
      while(p && p!==document.documentElement){
        const bg=getComputedStyle(p).backgroundColor;
        if(bg && !/rgba?\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
        p=p.parentElement;
      }
      return 'rgb(255,255,255)';
    }
    function contraste(el){
      const cs=getComputedStyle(el);
      const col=cs.webkitTextFillColor && cs.webkitTextFillColor!=='rgb(0, 0, 0)' && /rgb/.test(cs.webkitTextFillColor)
        ? cs.webkitTextFillColor : cs.color;
      const a=lum(col), c=lum(fondoDe(el));
      return Math.round(((Math.max(a,c)+0.05)/(Math.min(a,c)+0.05))*100)/100;
    }

    window.URBIS_PC_RECON.abrir();
    await new Promise(r=>setTimeout(r,400));
    const h=document.getElementById('pcr-hoja');

    // se mide TODO el texto de la hoja
    const textos=Array.from(h.querySelectorAll('p,small,label,b,span,li,em'))
      .filter(e=>e.offsetParent!==null && (e.textContent||'').trim().length>3);
    const flojos=textos.map(e=>({t:(e.textContent||'').trim().slice(0,34), c:contraste(e), cls:e.className}))
      .filter(x=>x.c < 4.5);
    o.nTextos=textos.length;
    o.flojos=flojos.slice(0,6);
    o.peor=textos.length?Math.min.apply(null,textos.map(contraste)):0;

    // ── la hoja baja al elegir la forma ──
    o.altaAntes=Math.round(h.getBoundingClientRect().height);
    h.querySelector('[data-pcr="forma"][data-f="radio"]').click();
    await new Promise(r=>setTimeout(r,400));
    o.encogida=h.classList.contains('pcr-encogida');
    o.altaDespues=Math.round(h.getBoundingClientRect().height);
    o.bajo = o.altaDespues < o.altaAntes * 0.75;
    o.mapaVisible = Math.round(innerHeight - h.getBoundingClientRect().height);

    // ── el círculo sigue al mapa ──
    const antes=window.URBIS_PC_RECON.estado().centro;
    window.map.setView([C.lat+0.01, C.lng+0.01], 15);
    await new Promise(r=>setTimeout(r,900));
    const despues=window.URBIS_PC_RECON.estado().centro;
    o.siguioAlMapa = !!antes && !!despues && Math.abs(despues.lat-antes.lat)>0.005;
    o.ecoActualizado = (document.getElementById('pcr-eco')||{}).textContent||'';

    // ── el radio se cambia sin abrir la hoja ──
    const btn1k=h.querySelector('[data-pcr="radio"][data-r="1000"]');
    o.hayRadiosEncogida=!!btn1k;
    if(btn1k){ btn1k.click(); await new Promise(r=>setTimeout(r,300)); }
    o.radioNuevo=window.URBIS_PC_RECON.estado().radioM;
    o.sigueEncogida=document.getElementById('pcr-hoja').classList.contains('pcr-encogida');

    // ── analizar: la hoja se abre sola con el resultado ──
    document.getElementById('pcr-hoja').querySelector('[data-pcr="analizar"]').click();
    await new Promise(r=>setTimeout(r,1600));
    const h2=document.getElementById('pcr-hoja');
    o.trasAnalizar=h2.classList.contains('pcr-encogida');
    o.hayFicha=/Lo que hay/.test(h2.innerText);

    // ── y el asa devuelve la hoja entera ──
    return o;
  }, C);

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- el texto se lee (contraste ≥ 4.5, la norma) --');
  P('todo el texto pasa', r.flojos.length===0,
    r.nTextos+' textos medidos, el peor da '+r.peor+
    (r.flojos.length?'  ✗ flojos: '+r.flojos.map(f=>f.t+' ('+f.c+')').join(' · '):''));

  console.log('\n  -- la hoja baja para ver el mapa --');
  P('al elegir el radio se encoge', r.encogida);
  P('y ocupa mucho menos', r.bajo, r.altaAntes+'px → '+r.altaDespues+'px');
  P('queda mapa a la vista', r.mapaVisible>380, r.mapaVisible+'px de mapa');

  console.log('\n  -- el círculo se ubica moviendo el mapa --');
  P('sigue al centro del mapa', r.siguioAlMapa);
  P('y lo dice en la barra', /-72\.49/.test(r.ecoActualizado)||/7\.90/.test(r.ecoActualizado), r.ecoActualizado);
  P('el radio se cambia sin abrir la hoja', r.hayRadiosEncogida && r.radioNuevo===1000 && r.sigueEncogida,
    r.radioNuevo+' m, encogida: '+r.sigueEncogida);

  console.log('\n  -- y al analizar vuelve a abrirse --');
  P('se abre sola con el resultado', !r.trasAnalizar && r.hayFicha);

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó')+'\n');
  await b.close(); process.exit(mal?1:0);
})();
