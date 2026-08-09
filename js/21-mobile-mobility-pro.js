(function(){
  'use strict';
  const app = document.getElementById('urbis-mobile-app');
  if(!app) return;

  const V = '66';
  let voiceReady = false;
  let lastVoice = '';
  let lastVoiceAt = 0;
  let stableVoice = null;
  const VOICE_CACHE_KEY = 'urbis_voice_es_female_v66';
  let routeRunning = false;
  let lastMatchedAt = 0;
  let finishLock = false;
  let audioCtx = null;
  let lastOffRouteWarnAt = 0;
  let lastRecalcRequestAt = 0;
  let lastKnownDeviation = 0;

  function status(text){
    try { if(typeof window.urbisMobileSetMobilityStatus === 'function') window.urbisMobileSetMobilityStatus(text); } catch(e) {}
    const nav = app.querySelector('#u52-route-state');
    if(nav) nav.textContent = String(text || '').replace(/<[^>]*>/g,' ');
  }

  function voiceScore(v){
    const name = String(v && v.name || '').toLowerCase();
    const lang = String(v && v.lang || '').toLowerCase();
    let score = 0;
    if(lang.startsWith('es')) score += 100;
    if(lang.includes('co') || lang.includes('mx') || lang.includes('419') || lang.includes('us')) score += 18;
    if(/female|mujer|paulina|monica|mónica|helena|sabina|laura|maria|maría|sofia|sofía|google español|spanish/.test(name)) score += 32;
    if(/google|samsung|microsoft|apple/.test(name)) score += 8;
    if(/male|hombre|jorge|diego|carlos|juan|pablo/.test(name)) score -= 18;
    return score;
  }

  function getVoice(force=false){
    if(!('speechSynthesis' in window)) return null;
    const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    if(stableVoice && voices.some(v => v.voiceURI === stableVoice.voiceURI || v.name === stableVoice.name)) return stableVoice;
    if(!voices || !voices.length) return null;

    const cached = localStorage.getItem(VOICE_CACHE_KEY);
    if(cached){
      stableVoice = voices.find(v => v.voiceURI === cached || v.name === cached) || null;
      if(stableVoice) return stableVoice;
    }

    const sorted = voices.slice().sort((a,b)=>voiceScore(b)-voiceScore(a));
    stableVoice = sorted[0] || null;
    if(stableVoice){
      try{ localStorage.setItem(VOICE_CACHE_KEY, stableVoice.voiceURI || stableVoice.name || ''); }catch(e){}
    }
    return stableVoice;
  }



  function unlockAudioUrbis(){
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      if(!audioCtx) audioCtx = new AC();
      if(audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }catch(e){ return null; }
  }

  function playDeviationAlert(){
    const ctx = unlockAudioUrbis();
    if(!ctx) return;
    try{
      const now = ctx.currentTime;
      const freqs = [660, 520];
      freqs.forEach((freq, i)=>{
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.16);
        gain.gain.setValueAtTime(0.0001, now + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.20, now + i * 0.16 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + i * 0.16 + 0.15);
      });
    }catch(e){}
  }

  function requestSmartReroute(reason='desvio'){
    const now = Date.now();
    if(now - lastRecalcRequestAt < 14000) return;
    lastRecalcRequestAt = now;
    document.body.classList.add('u64-offroute-warning');
    status('Te saliste de la ruta · recalculando');
    playDeviationAlert();
    speak('Te saliste de la ruta. Recalculando recorrido.', true);
    setTimeout(()=>document.body.classList.remove('u64-offroute-warning'), 4200);
    try{
      // Recalcula desde el GPS real actual hacia el mismo destino.
      const gps = (window.UrbisMobileGPS && window.UrbisMobileGPS.getLast && window.UrbisMobileGPS.getLast()) || window.urbisMobileLastGPS || null;
      if(gps && typeof routeRealPointA !== 'undefined') {
        routeRealPointA = { lat: Number(gps.lat), lng: Number(gps.lng) };
      }
      // Antes de calcular la ruta alternativa, limpia la ruta vieja para evitar doble ruta.
      try { if(typeof limpiarRutaRealVisual === 'function') limpiarRutaRealVisual(false); } catch(_e) {}
      try {
        if(typeof rutaLayer !== 'undefined' && rutaLayer && rutaLayer.eachLayer) {
          rutaLayer.eachLayer(layer => {
            const cn = layer?.options?.className || '';
            if(String(cn).includes('urbis-route-completed') || String(cn).includes('urbis-route-shadow')) rutaLayer.removeLayer(layer);
          });
        }
      } catch(_e) {}
      if(typeof window.calcularRutaRealActual === 'function') window.calcularRutaRealActual();
    }catch(e){ console.warn('No se pudo solicitar recálculo URBIS', e); }
  }

  function speak(text, priority=false){
    if(!('speechSynthesis' in window)) return;
    const clean = String(text || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(!clean) return;
    const now = Date.now();
    if(!priority && clean === lastVoice && now - lastVoiceAt < 9000) return;
    if(!priority && now - lastVoiceAt < 4500) return;
    try{
      if(priority) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      const v = getVoice();
      if(v) u.voice = v;
      u.lang = (v && v.lang) || 'es-CO';
      u.rate = 0.94;
      u.pitch = 1.12;
      u.volume = 1;
      speechSynthesis.speak(u);
      lastVoice = clean;
      lastVoiceAt = now;
    }catch(e){}
  }

  function primeVoice(){
    unlockAudioUrbis();
    if(!('speechSynthesis' in window)) return;
    getVoice(true);
    if(voiceReady) return;
    voiceReady = true;
    try{
      const u = new SpeechSynthesisUtterance(' ');
      const v = getVoice(true);
      if(v) u.voice = v;
      u.lang = (v && v.lang) || 'es-CO';
      u.rate = 0.94;
      u.pitch = 1.12;
      u.volume = 0.01;
      speechSynthesis.speak(u);
    }catch(e){}
  }

  function enableMapGestures(){
    try{
      if(!window.map) return;
      map.dragging && map.dragging.enable();
      map.touchZoom && map.touchZoom.enable();
      map.doubleClickZoom && map.doubleClickZoom.enable();
      map.scrollWheelZoom && map.scrollWheelZoom.enable();
      map.boxZoom && map.boxZoom.enable();
      map.keyboard && map.keyboard.enable();
      map.tap && map.tap.enable && map.tap.enable();
      const c = map.getContainer && map.getContainer();
      if(c){
        c.style.touchAction = 'pan-x pan-y pinch-zoom';
        c.style.pointerEvents = 'auto';
      }
    }catch(e){}
  }

  function setTransportAccent(mode){
    const labels = {walking:'A pie', bike:'Bici', bus:'Bus', motorcycle:'Moto', car:'Carro'};
    status(`${labels[mode] || 'Carro'} seleccionado · elige destino`);
  }

  function updateRouteUIAfterStart(){
    try{
      const mode = typeof routeRealMode !== 'undefined' ? routeRealMode : 'car';
      const labels = {walking:'A pie', bike:'Bici', bus:'Bus', motorcycle:'Moto', car:'Carro'};
      const route = typeof routeRealLastResult !== 'undefined' ? routeRealLastResult : null;
      if(route && route.distance){
        const km = (route.distance/1000).toFixed(route.distance > 10000 ? 0 : 1);
        status(`${labels[mode] || 'Carro'} · ${km} km · ruta activa`);
      } else {
        status(`${labels[mode] || 'Carro'} · ruta activa`);
      }
    }catch(e){ status('Ruta activa'); }
  }

  function startProfessionalRouteState(){
    unlockAudioUrbis();
    routeRunning = true;
    document.body.classList.add('u59-mobility-blue', 'u59-route-running');
    document.body.classList.remove('u59-route-ended');
    enableMapGestures();
    try { if(typeof iniciarRastreoGPS === 'function') iniciarRastreoGPS(); } catch(e) {}
    try { if(typeof window.UrbisMobileAppV58?.ensureMobileGps === 'function') window.UrbisMobileAppV58.ensureMobileGps(false); } catch(e) {}
    updateRouteUIAfterStart();
    speak('Recorrido iniciado.', true);
    setTimeout(() => {
      try{
        if(typeof routeRealLastResult !== 'undefined' && routeRealLastResult && routeRealLastResult.legs && routeRealLastResult.legs[0]){
          const steps = routeRealLastResult.legs[0].steps || [];
          const next = steps.find(s => s && s.maneuver && s.maneuver.type !== 'depart' && s.maneuver.type !== 'arrive') || steps[0];
          if(next && next.maneuver){
            const mod = String(next.maneuver.modifier || '').toLowerCase();
            const d = Math.round(Number(next.distance || 0));
            if(mod.includes('right')) speak(d ? `En ${d} metros, gira a la derecha.` : 'Gira a la derecha.');
            else if(mod.includes('left')) speak(d ? `En ${d} metros, gira a la izquierda.` : 'Gira a la izquierda.');
            else speak('Sigue la ruta marcada.');
          }
        }
      }catch(e){}
    }, 2100);
  }

  function finishProfessionalRoute(){
    if(finishLock) return;
    finishLock = true;
    setTimeout(()=>finishLock=false, 700);
    routeRunning = false;
    document.body.classList.remove('u59-route-running', 'route-focus-active', 'route-choice-active');
    document.body.classList.add('u59-route-ended');
    try { if('speechSynthesis' in window) speechSynthesis.cancel(); } catch(e) {}
    try { originalCleanRoute && originalCleanRoute(); } catch(e) {}
    try { if(typeof quitarOverlayInicioRecorridoCiudadano === 'function') quitarOverlayInicioRecorridoCiudadano(); } catch(e) {}
    try { if(typeof window.UrbisMobileAppV58?.show === 'function') window.UrbisMobileAppV58.show('mobility'); } catch(e) {}
    enableMapGestures();
    status('Ruta finalizada · elige un nuevo destino');
    setTimeout(()=>document.body.classList.remove('u59-route-ended'), 1500);
  }

  const originalCalc = window.calcularRutaRealActual;
  const originalCleanRoute = window.limpiarRutaReal;
  const originalPrepare = window.prepararDestinoDesdeGPS;
  const originalMode = window.seleccionarModoRutaReal;

  window.seleccionarModoRutaReal = function(mode){
    try { originalMode && originalMode(mode); } catch(e) {}
    setTransportAccent(mode);
  };

  window.prepararDestinoDesdeGPS = async function(){
    enableMapGestures();
    primeVoice();
    document.body.classList.add('u59-mobility-blue');
    status('Toca el mapa para elegir destino.');
    try{
      if(typeof originalPrepare === 'function') return await originalPrepare();
    }catch(e){
      console.warn('Destino GPS móvil', e);
      status('Activa permisos de ubicación.');
    } finally {
      enableMapGestures();
    }
  };

  window.calcularRutaRealActual = async function(){
    primeVoice();
    enableMapGestures();
    document.body.classList.add('u59-mobility-blue');
    status('Calculando ruta azul...');
    try{
      const result = typeof originalCalc === 'function' ? await originalCalc() : undefined;
      startProfessionalRouteState();
      return result;
    }catch(e){
      console.warn('Ruta profesional móvil', e);
      status('No se pudo iniciar la ruta.');
      speak('No se pudo iniciar la ruta.', true);
    } finally {
      enableMapGestures();
    }
  };

  window.limpiarRutaReal = finishProfessionalRoute;

  const originalStartGps = window.iniciarRastreoGPS;
  window.iniciarRastreoGPS = function(){
    enableMapGestures();
    try { return originalStartGps && originalStartGps(); } finally { setTimeout(enableMapGestures, 250); }
  };

  // Refuerzo: si el usuario toca el mapa durante navegación, no se bloquean gestos.
  function bindMapMobilitySafety(){
    if(!window.map || map._urbisV60Bound) return;
    map._urbisV60Bound = true;
    map.on('dragstart zoomstart touchstart movestart', () => {
      enableMapGestures();
      if(routeRunning){
        document.body.classList.add('u59-user-exploring');
        status('Mapa libre · GPS activo');
      }
    });
  }

  setInterval(() => {
    enableMapGestures();
    bindMapMobilitySafety();
    if(routeRunning){
      try{
        if(typeof urbisNavRouteState !== 'undefined' && urbisNavRouteState){
          const deviation = Number(urbisNavRouteState.deviationM || 0);
          lastKnownDeviation = deviation;
          if(deviation > 70 && Date.now() - lastOffRouteWarnAt > 9000){
            lastOffRouteWarnAt = Date.now();
            document.body.classList.add('u64-offroute-warning');
            playDeviationAlert();
            speak('Atención. Parece que te saliste de la ruta.', true);
            status('Fuera de ruta · recalculando si continúa');
            setTimeout(()=>document.body.classList.remove('u64-offroute-warning'), 3500);
          }
          if(deviation > 95){
            requestSmartReroute('desvio');
          }
          if(Date.now() - lastMatchedAt > 1700){
            lastMatchedAt = Date.now();
            const left = Math.max(0, urbisNavRouteState.total - urbisNavRouteState.currentDistance);
            const km = left > 1000 ? `${(left/1000).toFixed(1)} km` : `${Math.round(left)} m`;
            status(deviation > 70 ? `Fuera de ruta · ${Math.round(deviation)} m` : `Ruta activa · faltan ${km}`);
          }
        }
      }catch(e){}
    }
  }, 1800);

  document.addEventListener('click', ev => {
    const call = ev.target.closest('[data-u52-call]');
    if(!call) return;
    if(['start-route','choose-destination','finish-route','locate'].includes(call.dataset.u52Call)) { unlockAudioUrbis(); primeVoice(); }
  }, true);


  if('speechSynthesis' in window){
    try{ speechSynthesis.onvoiceschanged = () => getVoice(true); }catch(e){}
  }

  document.body.classList.add('u59-mobility-ready');
  window.UrbisMobilityProV60 = {speak, primeVoice, enableMapGestures, finishProfessionalRoute, playDeviationAlert, requestSmartReroute};
  window.UrbisMobilityProV64 = {playDeviationAlert, requestSmartReroute, speak};
})();

/* URBIS V60 · helper visual destino */
(function(){
  window.urbisDestinoKawaiiIcon = function(){
    if(!window.L) return null;
    return L.divIcon({
      className: 'urbis-destination-kawaii-icon',
      html: '<img src="assets/icons/llegada.png" alt="Destino">',
      iconSize: [52, 68],
      iconAnchor: [26, 60],
      popupAnchor: [0, -58]
    });
  };
})();
