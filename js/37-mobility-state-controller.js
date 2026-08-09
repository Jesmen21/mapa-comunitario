/* URBIS · Mobility state controller
   Capa final para que Movilidad use un estado único: origen, destino, transporte y ruta activa. */
(function(){
  'use strict';

  var STORAGE_KEY = 'urbis_mobility_transport';
  var allowedModes = { car:true, motorcycle:true, bike:true, walking:true, bus:true };
  var state = {
    active: false,
    origin: null,
    destination: null,
    transport: localStorage.getItem(STORAGE_KEY) || 'car',
    routeRunning: false,
    updatedAt: Date.now()
  };

  function normalizePoint(lat, lng){
    if(typeof lat === 'object' && lat) { lng = lat.lng; lat = lat.lat; }
    lat = Number(lat); lng = Number(lng);
    if(!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: lat, lng: lng };
  }

  function emit(name, extra){
    state.updatedAt = Date.now();
    try { window.dispatchEvent(new CustomEvent('urbis:mobility:' + name, { detail: Object.assign({ state: api.snapshot() }, extra || {}) })); } catch(e) {}
  }

  function syncGlobals(){
    try {
      window.destinoSeleccionado = state.destination;
      window.urbisDestinoSeleccionado = state.destination;
      window.destinoActual = state.destination;
      window.routeRealPointB = state.destination;
      if(state.origin) window.routeRealPointA = state.origin;
    } catch(e) {}
  }

  function setOrigin(point){
    var p = normalizePoint(point);
    if(!p) return false;
    state.origin = p;
    syncGlobals();
    emit('origin', { origin: p });
    return true;
  }

  function setDestination(lat, lng, source){
    var p = normalizePoint(lat, lng);
    if(!p) return false;
    state.destination = p;
    syncGlobals();
    emit('destination', { destination: p, source: source || 'manual' });
    return true;
  }

  function clearDestination(){
    state.destination = null;
    syncGlobals();
    emit('destination-cleared');
  }

  function setTransport(mode){
    mode = allowedModes[mode] ? mode : 'car';
    state.transport = mode;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch(e) {}
    try { if(typeof window.seleccionarModoRutaReal === 'function') window.seleccionarModoRutaReal(mode); } catch(e) {}
    emit('transport', { transport: mode });
  }

  function requestGPS(){
    return new Promise(function(resolve, reject){
      if(!navigator.geolocation) return reject(new Error('GPS no disponible'));
      navigator.geolocation.getCurrentPosition(function(pos){
        var p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || 0 };
        state.origin = { lat: p.lat, lng: p.lng };
        try { window.userLastLatLng = p; } catch(e) {}
        syncGlobals();
        emit('origin', { origin: state.origin });
        resolve(p);
      }, reject, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
    });
  }

  async function startRoute(){
    if(!state.destination) throw new Error('No hay destino seleccionado');
    if(!state.origin) {
      try { await requestGPS(); } catch(e) { /* el módulo anterior puede resolver GPS */ }
    }
    setTransport(state.transport);
    syncGlobals();
    state.routeRunning = true;
    emit('route-starting');
    if(typeof window.calcularRutaRealActual === 'function') await window.calcularRutaRealActual();
    try { if(typeof window.iniciarRastreoGPS === 'function') window.iniciarRastreoGPS(); } catch(e) {}
    emit('route-started');
  }

  function finishRoute(){
    state.routeRunning = false;
    state.destination = null;
    syncGlobals();
    try { if(typeof window.limpiarRutaReal === 'function') window.limpiarRutaReal(); } catch(e) {}
    emit('route-finished');
  }

  var api = {
    snapshot: function(){ return JSON.parse(JSON.stringify(state)); },
    setOrigin: setOrigin,
    setDestination: setDestination,
    clearDestination: clearDestination,
    setTransport: setTransport,
    requestGPS: requestGPS,
    startRoute: startRoute,
    finishRoute: finishRoute
  };

  window.URBIS_MOBILITY_STATE = api;

  // Puente con la interfaz móvil V102, sin obligar a escritorio a usarla.
  window.addEventListener('urbis:mobility:destination', function(){
    try {
      if(window.URBIS_MOBILITY_V102 && window.URBIS_MOBILITY_V102.state) {
        var mState = window.URBIS_MOBILITY_V102.state;
        if(mState && mState.destLatlng && (!state.destination || state.destination.lat !== mState.destLatlng.lat || state.destination.lng !== mState.destLatlng.lng)) {
          setDestination(mState.destLatlng, null, 'mobile-ui');
        }
      }
    } catch(e) {}
  });

  // Wrappers finales: mantienen compatibilidad con botones viejos pero centralizan estado.
  var originalIniciarRutaHacia = window.iniciarRutaHacia;
  window.iniciarRutaHacia = async function(lat, lng){
    if(!setDestination(lat, lng, 'legacy-button')) {
      alert('Destino inválido.');
      return;
    }
    try {
      if(originalIniciarRutaHacia) return await originalIniciarRutaHacia(lat, lng);
      return await startRoute();
    } catch(e) {
      console.warn('[URBIS] iniciarRutaHacia:', e);
      throw e;
    }
  };

  var originalLimpiar = window.limpiarRutaReal;
  window.limpiarRutaReal = function(){
    state.routeRunning = false;
    state.destination = null;
    syncGlobals();
    try { return originalLimpiar && originalLimpiar(); } finally { emit('route-cleared'); }
  };

  // Mejor integración con la UI móvil V102.
  window.addEventListener('load', function(){
    try {
      if(window.URBIS_MOBILITY_V102 && window.URBIS_MOBILITY_V102.state) {
        var m = window.URBIS_MOBILITY_V102.state;
        if(m.transport) setTransport(m.transport);
      }
    } catch(e) {}
  });
})();
