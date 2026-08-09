/* URBIS V78 · Ocultar marcadores al alejarse para rendimiento móvil */
(function(){
  'use strict';

  const HIDE_BELOW_ZOOM = 14;
  const FADE_BELOW_ZOOM = 15;

  function getMap(){
    return window.map || window.urbisMap || null;
  }

  function applyZoomState(){
    const map = getMap();
    if(!map || typeof map.getZoom !== 'function') return;

    const z = map.getZoom();
    document.body.classList.toggle('urbis-zoom-hide-markers', z < HIDE_BELOW_ZOOM);
    document.body.classList.toggle('urbis-zoom-fade-markers', z >= HIDE_BELOW_ZOOM && z < FADE_BELOW_ZOOM);
    document.body.dataset.urbisZoom = String(z);
  }

  function bind(){
    const map = getMap();
    if(!map || map.__urbisZoomOptimizerBound) return;
    map.__urbisZoomOptimizerBound = true;
    map.on('zoomend moveend', applyZoomState);
    applyZoomState();
  }

  const timer = setInterval(() => {
    bind();
    applyZoomState();
    if(getMap() && getMap().__urbisZoomOptimizerBound) clearInterval(timer);
  }, 500);

  window.addEventListener('load', () => setTimeout(bind, 300));
})();
