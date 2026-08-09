/* URBIS V78 · AutoMapeo apagado por defecto */
(function(){
  'use strict';

  const KEYS = [
    'urbis_automapeo_visible',
    'urbis_auto_mapeo_visible',
    'urbis_osm_automap_visible',
    'urbis_auto_places_visible',
    'automapeo_visible',
    'autoMapeoVisible',
    'osmAutoMapVisible'
  ];

  function forceDefaultOff(){
    try{
      KEYS.forEach(k => {
        if(localStorage.getItem(k) === null) localStorage.setItem(k, 'false');
      });
      document.body.classList.add('urbis-automapeo-default-off');
    }catch(e){}
  }

  forceDefaultOff();

  window.URBIS_AUTOMAP_DEFAULT_VISIBLE = false;
  window.URBIS_AUTOMAP_ENABLED_BY_DEFAULT = false;

  // No elimina botones ni funciones: solo evita que arranque visible automáticamente.
  window.addEventListener('DOMContentLoaded', forceDefaultOff);
  window.addEventListener('load', forceDefaultOff);
})();
