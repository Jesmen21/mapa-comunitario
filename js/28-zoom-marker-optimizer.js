/* URBIS V78 · Ocultar marcadores al alejarse para rendimiento móvil */
(function(){
  'use strict';

  const HIDE_BELOW_ZOOM = 14;
  const FADE_BELOW_ZOOM = 15;

  /* `window.map` no siempre es el mapa.

     Mientras js/03 no lo asigna, el navegador deja ahí el `<div id="map">`
     por sus variables globales automáticas: un objeto verdadero, sin `on` ni
     `getZoom`. Este módulo se carga ANTES que js/03 y su reloj arranca de
     inmediato, así que la primera vuelta puede llegar antes que el mapa
     exista —y llega, en cuanto la máquina va cargada o Leaflet tarda—.

     `bind` comprobaba solo que hubiera algo, y le pedía `on` a un div:
     «map.on is not a function», una excepción tirada dentro de un
     `setInterval` que nadie ve pasar salvo cuando una prueba mira los
     errores de la página. Se comprueba que sea el mapa de verdad. */
  function getMap(){
    const m = window.map || window.urbisMap || null;
    return (m && typeof m.on === 'function' && typeof m.getZoom === 'function') ? m : null;
  }

  function applyZoomState(){
    const map = getMap();
    if(!map) return;

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
