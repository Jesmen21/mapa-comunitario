const E = require('../entorno.js');
/* Abre las cuatro páginas como las abre un visitante y anota lo que se rompe.
   El backend de Google y los mapas están bloqueados desde acá, así que se
   sirven dobles: si no, todo fallaría por la red y no se vería el código. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const LEAFLET=E.MODULOS + '/leaflet/dist/';

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const paginas=['index.html','analisis-ia.html','reportes.html','seguimiento.html'];
  let totalRotas=0;

  for (const pag of paginas){
    const ctx=await b.newContext({serviceWorkers:'block'});
    // OJO CON EL ORDEN: Playwright prueba las rutas de la ÚLTIMA a la primera,
    // así que el comodín va PRIMERO y los dobles concretos después. Al revés,
    // el comodín bloqueaba Leaflet y la página se caía por culpa de la prueba.
    await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
    await ctx.route('**/*.tile.*/**', r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.alloc(0)}));
    await ctx.route('**/script.google.com/**', r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
    await ctx.route('**/unpkg.com/**', r=>{
      const u=r.request().url();
      try{
        const f = u.endsWith('.css') ? LEAFLET+'leaflet.css' : LEAFLET+'leaflet.js';
        r.fulfill({status:200, contentType:u.endsWith('.css')?'text/css':'text/javascript', body:fs.readFileSync(f,'utf8')});
      }catch(e){ r.abort(); }
    });

    const pg=await ctx.newPage();
    const errores=[];
    pg.on('pageerror', e=>errores.push('JS: '+String(e.message).slice(0,120)));
    pg.on('console', m=>{ if(m.type()==='error') errores.push('consola: '+m.text().slice(0,120)); });
    pg.on('response', r=>{ if(r.status()>=400 && /localhost:8199/.test(r.url()))
      errores.push('falta el archivo: '+r.url().replace(E.ESTATICO + '/','')+' ('+r.status()+')'); });

    await pg.goto(E.ESTATICO + '/'+pag,{waitUntil:'domcontentloaded',timeout:30000}).catch(e=>errores.push('no cargó: '+e.message));
    await pg.waitForTimeout(3500);

    const estado = await pg.evaluate(()=>({
      version: window.URBIS_APP_VERSION || null,
      titulo: document.title,
      // ¿se pintó algo, o quedó la pantalla en blanco?
      visible: document.body ? document.body.innerText.trim().length : 0,
      leaflet: typeof window.L,
      motor: typeof window.AIA_MOTOR,
      puente: typeof window.AIA_REMOTO
    })).catch(()=>({}));

    const rotas = errores.filter(e=>!/L is not defined|Unexpected end of input|tile|favicon|net::ERR/.test(e));
    totalRotas += rotas.length;
    console.log('\n  ── '+pag+'  ('+estado.titulo+')');
    console.log('     Leaflet: '+estado.leaflet+(estado.leaflet!=='object'&&estado.leaflet!=='function'?'   ← sin Leaflet no vale nada de lo de abajo':''));
    console.log('     texto en pantalla: '+estado.visible+' caracteres'+(estado.visible<200?'   ← ¿PÁGINA EN BLANCO?':''));
    if(pag==='analisis-ia.html') console.log('     AIA_MOTOR: '+estado.motor+' · AIA_REMOTO: '+estado.puente);
    if(rotas.length){ rotas.slice(0,6).forEach(e=>console.log('     ✗ '+e)); }
    else console.log('     ✓ sin errores');
    await ctx.close();
  }
  console.log('\n  '+(totalRotas?totalRotas+' problemas':'las cuatro páginas cargan limpias')+'\n');
  await b.close();
})();
