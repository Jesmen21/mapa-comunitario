/* ============================================================================
   URBIS · RUSH — ecosistema runner estilo Strava (sobre el runner móvil js/20).
   Aporta lo que faltaba: (1) REPLAY animado del recorrido (el "video"), y
   (2) TARJETA/FOTO final con la ruta dibujada (descargable y compartible),
   con opción de poner tu propia foto de fondo. Identidad propia "URBIS Rush":
   gradiente coral→fucsia→violeta sobre carbón. No toca el GPS ni el guardado.
   ============================================================================ */
(function(){
  'use strict';

  var RUSH = { a:'#ff5e3a', b:'#ff2d78', c:'#a45cff', start:'#37f0b0', ink:'#0b0d12' };

  // ---- utilidades ----
  function fmtTime(sec){ sec=Math.max(0,Math.floor(sec||0)); var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return h?(p(h)+':'+p(m)+':'+p(s)):(p(m)+':'+p(s)); }
  function fmtPace(secKm){ if(!secKm||!isFinite(secKm)) return '--'; var m=Math.floor(secKm/60),s=Math.round(secKm%60); return m+':'+p(s); }
  function p(n){ return String(n).padStart(2,'0'); }
  function labelTipo(t){ return ({correr:'Carrera 🏃', ciclismo:'Ciclismo 🚲', caminar:'Caminata 👣', senderismo:'Senderismo ⛰️'})[t] || 'Actividad'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>'"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]);}); }
  function haversine(a,b){ if(!a||!b) return 0; var R=6371,toRad=function(d){return d*Math.PI/180;}; var dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng); var aa=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)*Math.sin(dLng/2); return 2*R*Math.asin(Math.sqrt(aa)); }
  function sesion(s){ return s || window.urbisRunnerSesionActual || null; }
  function fechaBonita(iso){ try{ return new Date(iso||Date.now()).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}); }catch(e){ return ''; } }

  // ---- proyección de coordenadas a píxeles (norte arriba, proporción real) ----
  function proyectar(points, w, h, pad){
    pad = pad==null ? 34 : pad;
    if(!points || !points.length) return [];
    var lats=points.map(function(p){return p.lat;}), lngs=points.map(function(p){return p.lng;});
    var minLat=Math.min.apply(null,lats), maxLat=Math.max.apply(null,lats);
    var minLng=Math.min.apply(null,lngs), maxLng=Math.max.apply(null,lngs);
    var midLat=(minLat+maxLat)/2, k=Math.cos(midLat*Math.PI/180);
    var spanLat=Math.max(1e-7, maxLat-minLat), spanLng=Math.max(1e-7,(maxLng-minLng)*k);
    var availW=w-pad*2, availH=h-pad*2;
    var scale=Math.min(availW/spanLng, availH/spanLat);
    var drawW=spanLng*scale, drawH=spanLat*scale;
    var offX=(w-drawW)/2, offY=(h-drawH)/2;
    return points.map(function(pt){
      return { x: offX + ((pt.lng-minLng)*k)*scale, y: offY + (drawH - (pt.lat-minLat)*scale) };
    });
  }
  // ---- cámara con zoom (sigue el recorrido y se aleja según avanzas, estilo Strava) ----
  var MINSPAN = 0.00035; // ~38 m: piso de zoom para que un recorrido corto se vea de cerca
  function limpiarPuntos(points){
    var out=[]; for(var i=0;i<(points||[]).length;i++){ var p=points[i]; if(!out.length){ out.push(p); continue; } var l=out[out.length-1]; if(Math.abs(p.lat-l.lat)>1e-7 || Math.abs(p.lng-l.lng)>1e-7) out.push(p); } return out;
  }
  // Suavizado Chaikin (redondea los quiebres del GPS). Solo para DIBUJAR (no toca stats).
  function suavizar(points, iters){
    var out = (points||[]).slice();
    if(out.length < 3) return out;
    for(var k=0;k<(iters||2);k++){
      if(out.length<3) break;
      var res=[out[0]];
      for(var i=0;i<out.length-1;i++){
        var a=out[i], b=out[i+1];
        res.push({lat:a.lat*0.75+b.lat*0.25, lng:a.lng*0.75+b.lng*0.25});
        res.push({lat:a.lat*0.25+b.lat*0.75, lng:a.lng*0.25+b.lng*0.75});
      }
      res.push(out[out.length-1]); out=res;
    }
    return out;
  }
  function boundsDe(points, n){
    n = n==null ? points.length : n; var a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;
    for(var i=0;i<n;i++){ var p=points[i]; if(p.lat<a)a=p.lat; if(p.lat>b)b=p.lat; if(p.lng<c)c=p.lng; if(p.lng>d)d=p.lng; }
    return {minLat:a,maxLat:b,minLng:c,maxLng:d};
  }
  function proyectarBounds(points, n, bb, w, h, pad){
    pad=pad==null?70:pad; var midLat=(bb.minLat+bb.maxLat)/2, k=Math.cos(midLat*Math.PI/180);
    var spanLat=Math.max(MINSPAN, bb.maxLat-bb.minLat), spanLng=Math.max(MINSPAN*k, (bb.maxLng-bb.minLng)*k);
    var availW=w-pad*2, availH=h-pad*2, scale=Math.min(availW/spanLng, availH/spanLat);
    var drawW=spanLng*scale, drawH=spanLat*scale, offX=(w-drawW)/2, offY=(h-drawH)/2, out=[];
    for(var i=0;i<n;i++){ var pt=points[i]; out.push({ x:offX+((pt.lng-bb.minLng)*k)*scale, y:offY+(drawH-(pt.lat-bb.minLat)*scale) }); }
    return out;
  }
  // ---- stats y recorte ----
  function distKm(points){ var d=0; for(var i=1;i<points.length;i++){ var s=haversine(points[i-1],points[i]); if(s<0.12) d+=s; } return d; }
  function elapsedDe(points, fb){ if(points.length>1 && points[0].t && points[points.length-1].t) return Math.max(0,Math.round((points[points.length-1].t-points[0].t)/1000)); return fb||0; }
  function quitarVehiculo(points, type){
    var lim = (type==='ciclismo') ? 45 : 20; if(points.length<2) return points.slice();
    var out=[points[0]];
    for(var i=1;i<points.length;i++){ var dt=(points[i].t-points[i-1].t)/3600000, dk=haversine(points[i-1],points[i]); var v=dt>0?dk/dt:0; if(v<=lim) out.push(points[i]); }
    return out;
  }
  function sesionDe(pts, base){ var d=distKm(pts), el=elapsedDe(pts, base.elapsed); return { type:base.type, distanceKm:d, elapsed:el, paceSecKm:d>0?el/d:null, points:pts.slice(), createdAt:base.createdAt }; }

  function gradiente(ctx,w,h){ var g=ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,RUSH.a); g.addColorStop(.5,RUSH.b); g.addColorStop(1,RUSH.c); return g; }
  function punto(ctx,p,color,glow){ if(!p) return; ctx.save(); ctx.shadowColor=color; ctx.shadowBlur=glow||0; ctx.fillStyle=color; ctx.beginPath(); ctx.arc(p.x,p.y,glow?7:6,0,Math.PI*2); ctx.fill(); ctx.restore(); }

  // Dibuja la ruta (o una parte, upTo) sobre el canvas ya con fondo puesto.
  function dibujarRuta(ctx, px, opts){
    opts = opts||{};
    var w=ctx.canvas.width, h=ctx.canvas.height;
    if(!px.length){ return; }
    if(px.length<2){ punto(ctx,px[0],RUSH.b,16); return; }
    var n = opts.upTo!=null ? Math.max(2,Math.min(px.length,opts.upTo)) : px.length;
    ctx.save();
    ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.strokeStyle=gradiente(ctx,w,h);
    ctx.shadowColor='rgba(255,45,120,.55)'; ctx.shadowBlur=opts.glow!=null?opts.glow:16;
    ctx.lineWidth=opts.weight||7;
    ctx.beginPath();
    for(var i=0;i<n;i++){ if(i===0) ctx.moveTo(px[i].x,px[i].y); else ctx.lineTo(px[i].x,px[i].y); }
    ctx.stroke();
    ctx.restore();
    if(opts.startEnd!==false) punto(ctx, px[0], RUSH.start, 8);
    var lead = px[Math.min(px.length-1, n-1)];
    if(opts.lead) punto(ctx, lead, '#ffffff', 18);
    else if(opts.startEnd!==false) punto(ctx, px[px.length-1], RUSH.c, 8);
  }

  function fondoOscuro(ctx,w,h){
    var g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,'#171a22'); g.addColorStop(1,'#0b0d12');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    // huellas/grid sutil
    ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=1;
    for(var x=0;x<w;x+=46){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for(var y=0;y<h;y+=46){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  }

  // ====================== PREVIEW en el resumen ======================
  window.urbisRunnerPintarResumen = function(){
    var cv = document.getElementById('u52-route-preview');
    if(!cv || !cv.getContext) return;
    var s = sesion(); var ctx = cv.getContext('2d');
    fondoOscuro(ctx, cv.width, cv.height);
    var pts = suavizar(limpiarPuntos((s && s.points) || []));
    if(pts.length < 2){
      ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font='600 22px Segoe UI, system-ui, sans-serif';
      ctx.textAlign='center'; ctx.fillText('Recorrido muy corto para dibujar', cv.width/2, cv.height/2);
      ctx.fillText('🐾 ¡muévete un poco más!', cv.width/2, cv.height/2+30);
      return;
    }
    dibujarRuta(ctx, proyectar(pts, cv.width, cv.height, 38), { weight:7, glow:16 });
  };

  // ====================== REPLAY (el "video") ======================
  function overlay(id){
    var ov = document.getElementById(id);
    if(ov) ov.parentNode.removeChild(ov);
    ov = document.createElement('div'); ov.id = id; ov.className='rush-overlay';
    document.body.appendChild(ov); return ov;
  }

  // Replay sobre mapa satelital real (canvas transparente sobre Leaflet)
  window.urbisRunnerReplay = function(sess){
    var s = sesion(sess);
    var P = suavizar(limpiarPuntos(s && s.points));
    if(!s || P.length < 2){ alert('Aún no hay recorrido suficiente para reproducir. ¡Muévete un poco más! 🏃'); return; }

    var lmap = (typeof map !== 'undefined' && map && map.getContainer) ? map : null;

    // Si no hay mapa disponible, caer en modo oscuro clásico
    if(!lmap){ _replayOscuro(s, P); return; }

    // 1. Ir a pantalla de mapa para ver el satélite de fondo
    if(typeof window.UrbisMobileAppV58 !== 'undefined') window.UrbisMobileAppV58.show('map');

    setTimeout(function(){
      // 2. Encuadrar el mapa al recorrido
      try{
        lmap.fitBounds(L.latLngBounds(P.map(function(pt){ return [pt.lat, pt.lng]; })), {padding:[60,80], animate:true});
      }catch(e){}

      // 3. HUD flotante sobre el mapa (no oscurece el fondo)
      var hud = document.createElement('div');
      hud.id = 'rush-sat-hud'; hud.className = 'rush-sat-hud';
      hud.innerHTML =
        '<div class="rush-sat-top"><span class="rush-ov-kicker">⚡ URBIS RUSH</span>' +
        '<button class="rush-ov-x" id="rush-sat-close">✕</button></div>' +
        '<div class="rush-replay-hud">' +
          '<div class="rush-hud-big"><b id="rush-rep-dist">0.00</b><span>km</span></div>' +
          '<div class="rush-hud-row"><div><b id="rush-rep-time">00:00</b><span>tiempo</span></div>' +
          '<div><b id="rush-rep-pace">--</b><span>ritmo /km</span></div></div></div>' +
        '<div class="rush-replay-bar"><i id="rush-rep-fill"></i></div>' +
        '<div class="rush-sat-actions">' +
          '<button class="rush-btn replay" id="rush-rep-again">▶ Repetir</button>' +
          '<button class="rush-btn card" onclick="window.urbisRunnerTarjeta&&window.urbisRunnerTarjeta()">📸 Foto</button></div>';
      document.body.appendChild(hud);

      // 4. Canvas transparente encima del mapa (dibuja solo la ruta)
      var mapEl = lmap.getContainer();
      var cv = document.createElement('canvas');
      cv.id = 'rush-sat-cv';
      cv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:900;';
      if(mapEl.style.position !== 'absolute' && mapEl.style.position !== 'fixed') mapEl.style.position = 'relative';
      mapEl.appendChild(cv);

      var ctx = cv.getContext('2d');
      var pxCache = [];
      var cum=[0]; for(var i=1;i<P.length;i++){ cum[i]=cum[i-1]+haversine(P[i-1],P[i]); }
      var totalCum = cum[cum.length-1] || 1;
      var distTotal = Number(s.distanceKm)||0, timeTotal=Number(s.elapsed)||0;

      function resize(){ cv.width=mapEl.offsetWidth||320; cv.height=mapEl.offsetHeight||480; }
      resize();

      function updateCache(){
        pxCache = P.map(function(pt){
          try{ var px=lmap.latLngToContainerPoint([pt.lat,pt.lng]); return {x:px.x,y:px.y}; }catch(e){ return {x:0,y:0}; }
        });
      }
      updateCache();
      try{ lmap.on('moveend zoomend', updateCache); }catch(e){}

      var setT=function(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; };

      function frame(prog){
        resize(); ctx.clearRect(0,0,cv.width,cv.height);
        var n = Math.max(2, Math.round(prog*(P.length-1))+1);
        var px = pxCache.slice(0,n);
        if(px.length<2) return;
        // sombra blanca para que la ruta se vea sobre cualquier fondo satelital
        ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
        ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=14; ctx.shadowBlur=0;
        ctx.beginPath(); for(var i=0;i<px.length;i++){ i?ctx.lineTo(px[i].x,px[i].y):ctx.moveTo(px[i].x,px[i].y); } ctx.stroke();
        // ruta gradiente coral-fucsia-violeta
        ctx.strokeStyle=gradiente(ctx,cv.width,cv.height);
        ctx.shadowColor='rgba(255,45,120,.75)'; ctx.shadowBlur=16; ctx.lineWidth=8;
        ctx.beginPath(); for(var j=0;j<px.length;j++){ j?ctx.lineTo(px[j].x,px[j].y):ctx.moveTo(px[j].x,px[j].y); } ctx.stroke();
        ctx.restore();
        punto(ctx,px[0],RUSH.start,9);
        punto(ctx,px[px.length-1],'#ffffff',20);
        var idx=Math.min(P.length-1,n-1), ratio=totalCum?cum[idx]/totalCum:prog;
        setT('rush-rep-dist',(distTotal*ratio).toFixed(2));
        setT('rush-rep-time',fmtTime(timeTotal*prog));
        var pace=(distTotal*ratio)>0?(timeTotal*prog)/(distTotal*ratio):0;
        setT('rush-rep-pace',fmtPace(pace));
        var fill=document.getElementById('rush-rep-fill'); if(fill) fill.style.width=(prog*100)+'%';
      }

      function animar(){
        var dur=Math.min(8000,Math.max(4200,P.length*70)); var t0=null;
        updateCache();
        function step(ts){
          if(!document.body.contains(hud)){ cleanup(); return; }
          if(t0==null) t0=ts; var prog=Math.min(1,(ts-t0)/dur);
          var e=prog<.5?2*prog*prog:1-Math.pow(-2*prog+2,2)/2;
          frame(e);
          if(prog<1) requestAnimationFrame(step);
          else{
            setT('rush-rep-dist',distTotal.toFixed(2)); setT('rush-rep-time',fmtTime(timeTotal));
            // zoom out suave para ver TODO el recorrido
            try{ lmap.fitBounds(L.latLngBounds(P.map(function(pt){ return [pt.lat,pt.lng]; })),{padding:[60,80],animate:true}); }catch(e){}
          }
        }
        requestAnimationFrame(step);
      }

      function cleanup(){
        try{ lmap.off('moveend zoomend', updateCache); }catch(e){}
        if(cv.parentNode) cv.parentNode.removeChild(cv);
        if(hud.parentNode) hud.parentNode.removeChild(hud);
      }

      document.getElementById('rush-sat-close').onclick = cleanup;
      document.getElementById('rush-rep-again').onclick = animar;
      animar();
    }, 420);
  };

  // Modo oscuro clásico (fallback si no hay mapa disponible)
  function _replayOscuro(s, P){
    var ov = overlay('rush-replay-ov');
    ov.innerHTML =
      '<div class="rush-ov-top"><span class="rush-ov-kicker">⚡ URBIS RUSH</span><button class="rush-ov-x" onclick="this.closest(\'.rush-overlay\').remove()">✕</button></div>' +
      '<div class="rush-replay-stage"><canvas id="rush-replay-cv" width="720" height="940"></canvas>' +
        '<div class="rush-replay-hud"><div class="rush-hud-big"><b id="rush-rep-dist">0.00</b><span>km</span></div>' +
        '<div class="rush-hud-row"><div><b id="rush-rep-time">00:00</b><span>tiempo</span></div><div><b id="rush-rep-pace">--</b><span>ritmo /km</span></div></div></div>' +
        '<div class="rush-replay-bar"><i id="rush-rep-fill"></i></div>' +
      '</div>' +
      '<div class="rush-ov-actions"><button class="rush-btn replay" id="rush-rep-again">▶ Repetir</button>' +
      '<button class="rush-btn card" onclick="window.urbisRunnerTarjeta&&window.urbisRunnerTarjeta()">📸 Crear foto</button></div>';
    var cv=ov.querySelector('#rush-replay-cv'), ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
    var cum=[0]; for(var i=1;i<P.length;i++){ cum[i]=cum[i-1]+haversine(P[i-1],P[i]); }
    var totalCum=cum[cum.length-1]||1, distTotal=Number(s.distanceKm)||0, timeTotal=Number(s.elapsed)||0;
    var setT=function(id,v){ var e=ov.querySelector('#'+id); if(e) e.textContent=v; };
    var cam=boundsDe(P,2);
    function easeCam(t){ var pl=(t.maxLat-t.minLat)*.2,pg=(t.maxLng-t.minLng)*.2; cam.minLat+=((t.minLat-pl)-cam.minLat)*.16; cam.maxLat+=((t.maxLat+pl)-cam.maxLat)*.16; cam.minLng+=((t.minLng-pg)-cam.minLng)*.16; cam.maxLng+=((t.maxLng+pg)-cam.maxLng)*.16; }
    function pintar(n){ var px=proyectarBounds(P,n,cam,W,H,84); fondoOscuro(ctx,W,H); ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round'; ctx.strokeStyle=gradiente(ctx,W,H); ctx.shadowColor='rgba(255,45,120,.55)'; ctx.shadowBlur=18; ctx.lineWidth=9; ctx.beginPath(); for(var i=0;i<n;i++){ i?ctx.lineTo(px[i].x,px[i].y):ctx.moveTo(px[i].x,px[i].y); } ctx.stroke(); ctx.restore(); punto(ctx,px[0],RUSH.start,9); punto(ctx,px[n-1],'#ffffff',20); }
    function frame(prog){ var n=Math.max(2,Math.round(prog*(P.length-1))+1); easeCam(boundsDe(P,n)); pintar(n); var idx=Math.min(P.length-1,n-1),ratio=totalCum?cum[idx]/totalCum:prog; setT('rush-rep-dist',(distTotal*ratio).toFixed(2)); setT('rush-rep-time',fmtTime(timeTotal*prog)); var pace=(distTotal*ratio)>0?(timeTotal*prog)/(distTotal*ratio):0; setT('rush-rep-pace',fmtPace(pace)); var fill=ov.querySelector('#rush-rep-fill'); if(fill) fill.style.width=(prog*100)+'%'; }
    function colaZoomOut(c){ if(!document.body.contains(ov)||c>40) return; easeCam(boundsDe(P,P.length)); pintar(P.length); requestAnimationFrame(function(){ colaZoomOut(c+1); }); }
    function animar(){ var dur=Math.min(8000,Math.max(4200,P.length*70)); var t0=null; cam=boundsDe(P,2); function step(ts){ if(!document.body.contains(ov)) return; if(t0==null) t0=ts; var prog=Math.min(1,(ts-t0)/dur); var e=prog<.5?2*prog*prog:1-Math.pow(-2*prog+2,2)/2; frame(e); if(prog<1) requestAnimationFrame(step); else{ setT('rush-rep-dist',distTotal.toFixed(2)); setT('rush-rep-time',fmtTime(timeTotal)); colaZoomOut(0); } } requestAnimationFrame(step); }
    ov.querySelector('#rush-rep-again').onclick=animar;
    animar();
  }

  // ====================== TARJETA / FOTO (Strava-style) ======================
  var _fotoFondo = null; // Image

  function dibujarTarjeta(cv, s){
    var ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
    // fondo: foto del usuario o gradiente oscuro
    if(_fotoFondo){
      var ir=_fotoFondo.width/_fotoFondo.height, cr=W/H, dw,dh,dx,dy;
      if(ir>cr){ dh=H; dw=H*ir; dx=(W-dw)/2; dy=0; } else { dw=W; dh=W/ir; dx=0; dy=(H-dh)/2; }
      ctx.drawImage(_fotoFondo, dx,dy,dw,dh);
      var sc=ctx.createLinearGradient(0,0,0,H); sc.addColorStop(0,'rgba(8,9,13,.35)'); sc.addColorStop(.5,'rgba(8,9,13,.45)'); sc.addColorStop(1,'rgba(8,9,13,.92)');
      ctx.fillStyle=sc; ctx.fillRect(0,0,W,H);
    } else {
      fondoOscuro(ctx,W,H);
      var band=ctx.createLinearGradient(0,0,W,H*.5); band.addColorStop(0,'rgba(255,94,58,.16)'); band.addColorStop(1,'rgba(164,92,255,.10)');
      ctx.fillStyle=band; ctx.fillRect(0,0,W,H);
    }
    // marca
    ctx.textAlign='left'; ctx.fillStyle='#fff';
    ctx.font='800 40px Segoe UI, system-ui, sans-serif'; ctx.fillText('⚡ URBIS', 60, 92);
    ctx.fillStyle=RUSH.b; ctx.fillText('RUSH', 60+ctx.measureText('⚡ URBIS ').width, 92);
    ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='600 30px Segoe UI, system-ui, sans-serif';
    ctx.fillText(labelTipo(s.type)+'  ·  '+fechaBonita(s.createdAt), 60, 140);

    // ruta (zona central)
    var pts=suavizar(limpiarPuntos((s.points)||[]));
    if(pts.length>=2){
      var regionH=H*0.46, regionTop=H*0.20;
      var px=proyectar(pts, W-120, regionH, 30).map(function(q){ return {x:q.x+60, y:q.y+regionTop}; });
      _trazarRutaEnCtx(ctx, px, W, H);
    }
    // stats grandes abajo
    var by=H-300;
    ctx.fillStyle='#fff'; ctx.textAlign='left';
    ctx.font='900 150px Segoe UI, system-ui, sans-serif';
    ctx.fillText((Number(s.distanceKm)||0).toFixed(2), 56, by+120);
    ctx.font='700 44px Segoe UI, system-ui, sans-serif'; ctx.fillStyle='rgba(255,255,255,.8)';
    ctx.fillText('km recorridos', 60, by+170);
    // fila tiempo / ritmo
    var ry=H-90;
    ctx.fillStyle='#fff'; ctx.font='800 56px Segoe UI, system-ui, sans-serif';
    ctx.fillText(fmtTime(s.elapsed), 60, ry);
    ctx.fillText(fmtPace(s.paceSecKm)+' /km', W*0.52, ry);
    ctx.fillStyle='rgba(255,255,255,.7)'; ctx.font='600 28px Segoe UI, system-ui, sans-serif';
    ctx.fillText('tiempo', 62, ry+38); ctx.fillText('ritmo', W*0.52+2, ry+38);
  }
  function _trazarRutaEnCtx(ctx, px, W, H){
    if(px.length<2) return;
    ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
    var g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,RUSH.a); g.addColorStop(.5,RUSH.b); g.addColorStop(1,RUSH.c);
    ctx.strokeStyle=g; ctx.shadowColor='rgba(255,45,120,.6)'; ctx.shadowBlur=22; ctx.lineWidth=10;
    ctx.beginPath(); for(var i=0;i<px.length;i++){ i?ctx.lineTo(px[i].x,px[i].y):ctx.moveTo(px[i].x,px[i].y); } ctx.stroke();
    ctx.restore();
    punto(ctx, px[0], RUSH.start, 10); punto(ctx, px[px.length-1], '#fff', 14);
  }

  window.urbisRunnerTarjeta = function(sess){
    var s = sesion(sess);
    if(!s){ alert('Primero finaliza una actividad para crear su tarjeta.'); return; }
    var ov = overlay('rush-card-ov');
    ov.innerHTML =
      '<div class="rush-ov-top"><span class="rush-ov-kicker">📸 Tu recorrido</span><button class="rush-ov-x" onclick="this.closest(\'.rush-overlay\').remove()">✕</button></div>' +
      '<div class="rush-card-stage"><canvas id="rush-card-cv" width="1080" height="1350"></canvas></div>' +
      '<div class="rush-ov-actions rush-ov-actions-wrap">' +
        '<label class="rush-btn ghost"><input type="file" accept="image/*" id="rush-card-foto"> 🖼️ Poner foto</label>' +
        '<button class="rush-btn ghost" id="rush-card-quitar">🗑️ Quitar foto</button>' +
        '<button class="rush-btn card" id="rush-card-descargar">⬇️ Descargar</button>' +
        '<button class="rush-btn replay" id="rush-card-compartir">📤 Compartir</button>' +
      '</div>';
    var cv = ov.querySelector('#rush-card-cv');
    var repintar = function(){ dibujarTarjeta(cv, s); };
    repintar();

    ov.querySelector('#rush-card-foto').addEventListener('change', function(ev){
      var f = ev.target.files && ev.target.files[0]; if(!f) return;
      var rd=new FileReader();
      rd.onload=function(){ var im=new Image(); im.onload=function(){ _fotoFondo=im; repintar(); }; im.src=rd.result; };
      rd.readAsDataURL(f);
    });
    ov.querySelector('#rush-card-quitar').onclick=function(){ _fotoFondo=null; repintar(); };
    ov.querySelector('#rush-card-descargar').onclick=function(){ exportar(cv, 'descargar'); };
    ov.querySelector('#rush-card-compartir').onclick=function(){ exportar(cv, 'compartir'); };
  };

  // ====================== RECORTAR (trim) ======================
  window.urbisRunnerRecortar = function(sess){
    var s = sesion(sess);
    var trab = limpiarPuntos(s && s.points);
    if(!s || trab.length < 3){ alert('Necesitas un recorrido con varios puntos GPS para recortarlo.'); return; }
    var base = s;
    var ov = overlay('rush-trim-ov');
    ov.innerHTML =
      '<div class="rush-ov-top"><span class="rush-ov-kicker">✂️ Recortar recorrido</span><button class="rush-ov-x" onclick="this.closest(\'.rush-overlay\').remove()">✕</button></div>' +
      '<div class="rush-trim-stage"><canvas id="rush-trim-cv" width="720" height="560"></canvas></div>' +
      '<div class="rush-trim-info" id="rush-trim-info">—</div>' +
      '<div class="rush-trim-sliders">' +
        '<label><span>Inicio</span><input type="range" id="rush-trim-ini" min="0" max="100" value="0"></label>' +
        '<label><span>Fin</span><input type="range" id="rush-trim-fin" min="0" max="100" value="100"></label>' +
      '</div>' +
      '<button class="rush-btn ghost rush-trim-auto" id="rush-trim-auto">🏍️ Quitar tramos en vehículo (auto)</button>' +
      '<div class="rush-ov-actions"><button class="rush-btn ghost" onclick="this.closest(\'.rush-overlay\').remove()">Cancelar</button>' +
      '<button class="rush-btn replay" id="rush-trim-aplicar">✅ Aplicar</button></div>';
    var cv=ov.querySelector('#rush-trim-cv'), ctx=cv.getContext('2d');
    var ini=ov.querySelector('#rush-trim-ini'), fin=ov.querySelector('#rush-trim-fin');
    function rango(){ var n=trab.length-1; var a=Math.round((+ini.value/100)*n), b=Math.round((+fin.value/100)*n); if(a>b){ var t=a;a=b;b=t; } return {a:a,b:b}; }
    function pintar(){
      var r=rango(), px=proyectar(trab, cv.width, cv.height, 40);
      fondoOscuro(ctx, cv.width, cv.height);
      ctx.save(); ctx.strokeStyle='rgba(255,255,255,.16)'; ctx.lineWidth=5; ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath(); for(var i=0;i<px.length;i++){ i?ctx.lineTo(px[i].x,px[i].y):ctx.moveTo(px[i].x,px[i].y); } ctx.stroke(); ctx.restore();
      ctx.save(); ctx.strokeStyle=gradiente(ctx,cv.width,cv.height); ctx.shadowColor='rgba(255,45,120,.5)'; ctx.shadowBlur=14; ctx.lineWidth=8; ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath(); for(var j=r.a;j<=r.b;j++){ (j===r.a)?ctx.moveTo(px[j].x,px[j].y):ctx.lineTo(px[j].x,px[j].y); } ctx.stroke(); ctx.restore();
      punto(ctx, px[r.a], RUSH.start, 8); punto(ctx, px[r.b], '#fff', 10);
      var ses=sesionDe(trab.slice(r.a, r.b+1), base);
      var info=ov.querySelector('#rush-trim-info'); if(info) info.textContent = ses.distanceKm.toFixed(2)+' km · '+fmtTime(ses.elapsed)+' · '+fmtPace(ses.paceSecKm)+' /km';
    }
    ini.oninput=pintar; fin.oninput=pintar;
    ov.querySelector('#rush-trim-auto').onclick=function(){ var antes=trab.length; trab=quitarVehiculo(trab, base.type); ini.value=0; fin.value=100; pintar(); var info=ov.querySelector('#rush-trim-info'); if(info && trab.length<antes) info.textContent += '  ·  quitados '+(antes-trab.length)+' pts rápidos'; };
    ov.querySelector('#rush-trim-aplicar').onclick=function(){
      var r=rango(), kept=trab.slice(r.a, r.b+1);
      if(kept.length<2){ alert('El recorte deja muy pocos puntos. Ajusta el rango.'); return; }
      window.urbisRunnerSesionActual = sesionDe(kept, base);
      ov.remove();
      try{ if(typeof window.urbisRunnerPintarResumen==='function') window.urbisRunnerPintarResumen(); }catch(e){}
      var ss=window.urbisRunnerSesionActual, setEl=function(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; };
      setEl('u52-summary-distance', ss.distanceKm.toFixed(2)); setEl('u52-summary-time', fmtTime(ss.elapsed)); setEl('u52-summary-pace', fmtPace(ss.paceSecKm));
    };
    pintar();
  };

  function exportar(cv, modo){
    try{
      cv.toBlob(function(blob){
        if(!blob){ alert('No se pudo generar la imagen.'); return; }
        var file = (window.File) ? new File([blob],'urbis-rush.png',{type:'image/png'}) : null;
        if(modo==='compartir' && file && navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
          navigator.share({ files:[file], title:'Mi recorrido URBIS Rush', text:'¡Mira mi recorrido con URBIS Rush! 🏃⚡' }).catch(function(){});
          return;
        }
        var url=URL.createObjectURL(blob); var a=document.createElement('a');
        a.href=url; a.download='urbis-rush-'+Date.now()+'.png'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
      }, 'image/png');
    }catch(e){ alert('No se pudo exportar la imagen en este dispositivo.'); }
  }

  // ====================== DETALLE DE RECORRIDO PASADO ======================
  window.urbisRunnerDetalle = function(id){
    var h = typeof window.urbisRunnerLoadHistory === 'function' ? window.urbisRunnerLoadHistory() : [];
    var s = h.find(function(x){ return x.id === id; });
    if(!s){ alert('Actividad no encontrada.'); return; }

    // Exponer como sesión actual para que replay y tarjeta funcionen
    window.urbisRunnerSesionActual = s;

    var labelT = esc(labelTipo(s.type));
    var fecha = fechaBonita(s.createdAt);

    var ov = overlay('rush-detail-ov');
    ov.innerHTML =
      '<div class="rush-ov-top"><span class="rush-ov-kicker">' + labelT + '</span>' +
      '<button class="rush-ov-x" onclick="this.closest(\'.rush-overlay\').remove()">✕</button></div>' +
      '<div class="rush-detail-date">' + fecha + '</div>' +
      '<canvas id="rush-detail-cv" width="660" height="320" class="rush-route-canvas rush-detail-cv"></canvas>' +
      '<div class="rush-stat-grid rush-detail-stats">' +
        '<div class="rush-stat"><b>' + (Number(s.distanceKm)||0).toFixed(2) + '</b><span>km</span></div>' +
        '<div class="rush-stat"><b>' + fmtTime(s.elapsed) + '</b><span>tiempo</span></div>' +
        '<div class="rush-stat"><b>' + fmtPace(s.paceSecKm) + '</b><span>ritmo /km</span></div>' +
      '</div>' +
      '<canvas id="rush-detail-chart" class="rush-pace-chart" width="660" height="240"></canvas>' +
      '<div id="rush-detail-splits" class="rush-splits-wrap"></div>' +
      '<div class="rush-ov-actions">' +
        '<button class="rush-btn replay" onclick="window.urbisRunnerReplay&&window.urbisRunnerReplay()">▶ Ver recorrido</button>' +
        '<button class="rush-btn card" onclick="window.urbisRunnerTarjeta&&window.urbisRunnerTarjeta()">📸 Foto</button>' +
      '</div>' +
      '<button class="rush-btn trim rush-detail-del" onclick="window.urbisRunnerEliminar&&window.urbisRunnerEliminar(' + id + ')">🗑️ Eliminar actividad</button>';

    // Dibujar miniatura del recorrido en el canvas
    setTimeout(function(){
      var cv = document.getElementById('rush-detail-cv');
      if(!cv || !cv.getContext) return;
      var ctx = cv.getContext('2d');
      fondoOscuro(ctx, cv.width, cv.height);
      var pts = suavizar(limpiarPuntos((s.points)||[]));
      if(pts.length >= 2){
        dibujarRuta(ctx, proyectar(pts, cv.width, cv.height, 30), {weight:7, glow:14});
      } else {
        ctx.fillStyle='rgba(255,255,255,.55)'; ctx.font='600 18px Segoe UI,system-ui,sans-serif';
        ctx.textAlign='center'; ctx.fillText('Sin puntos GPS suficientes', cv.width/2, cv.height/2);
      }
      // Splits + gráfica de ritmo del recorrido pasado
      try{
        if(typeof window.urbisRunnerSplitsRender === 'function') window.urbisRunnerSplitsRender(document.getElementById('rush-detail-splits'), s);
        if(typeof window.urbisRunnerPaceChart === 'function') window.urbisRunnerPaceChart(document.getElementById('rush-detail-chart'), s);
      }catch(e){}
    }, 80);
  };

})();
