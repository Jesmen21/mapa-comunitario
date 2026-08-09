/* URBIS · App shell
   Separa el modo móvil del panel de escritorio sin duplicar lógica visual. */
(function(){
  'use strict';

  var MOBILE_QUERY = '(max-width: 820px), (pointer: coarse) and (max-width: 1024px)';
  var state = {
    mode: null,
    lastDesktopTab: 'mobility'
  };

  function isMobileViewport(){
    // URBIS v299 · el shell unificado (v296-298) se revierte: forzar SIEMPRE
    // "mobile" rompía el modo de escritorio real (#sidebar + #map a pantalla
    // completa), que es lo que PC necesita. Detección real de nuevo.
    try { return window.matchMedia(MOBILE_QUERY).matches; } catch(e) { return window.innerWidth <= 820; }
  }

  function invalidateMap(){
    setTimeout(function(){
      try {
        var m = window.map || window.urbisMap;
        if(m && typeof m.invalidateSize === 'function') m.invalidateSize();
      } catch(e) {}
    }, 160);
  }

  function setMode(nextMode){
    if(state.mode === nextMode) return;
    state.mode = nextMode;
    document.documentElement.setAttribute('data-urbis-shell', nextMode);
    document.body.classList.toggle('urbis-shell-mobile', nextMode === 'mobile');
    document.body.classList.toggle('urbis-shell-desktop', nextMode === 'desktop');

    if(nextMode === 'desktop') {
      document.body.classList.remove('u88-mobility-mode');
      try { if(window.URBIS_MOBILITY_V102 && typeof window.URBIS_MOBILITY_V102.disable === 'function') window.URBIS_MOBILITY_V102.disable(); } catch(e) {}
    }

    invalidateMap();
    window.dispatchEvent(new CustomEvent('urbis:shell-mode', { detail: { mode: nextMode } }));
  }

  function refresh(){
    setMode(isMobileViewport() ? 'mobile' : 'desktop');
  }

  window.UrbisAppShell = {
    get mode(){ return state.mode; },
    get isMobile(){ return state.mode === 'mobile'; },
    get isDesktop(){ return state.mode === 'desktop'; },
    refresh: refresh,
    setDesktopTab: function(tab){ if(tab) state.lastDesktopTab = tab; },
    getDesktopTab: function(){ return state.lastDesktopTab; }
  };

  refresh();
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('orientationchange', function(){ setTimeout(refresh, 250); }, { passive: true });
  document.addEventListener('DOMContentLoaded', refresh);
})();
