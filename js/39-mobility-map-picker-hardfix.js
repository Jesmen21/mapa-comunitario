/* URBIS V103 · HARD FIX Multimapas en Movilidad
   El icono de mapa de la barra inferior NO navega a otra interfaz.
   Solo abre una burbuja visible para elegir el mapa base. */
(function(){
  'use strict';

  const MAPS = [
    {key:'mobilityPoi', icon:'✨', title:'Estético', desc:'Limpio para rutas GPS'},
    {key:'actual', icon:'🟦', title:'URBIS', desc:'Base normal de la app'},
    {key:'googleRoads', icon:'🏙️', title:'Calles', desc:'Vías y nombres urbanos'},
    {key:'cartoLightMatter', icon:'☀️', title:'Claro', desc:'Plano suave y legible'},
    {key:'osmHumanitarian', icon:'🌿', title:'Comunitario', desc:'Servicios y referencias'},
    {key:'cartoDarkMatter', icon:'🌙', title:'Nocturno', desc:'Oscuro para rutas'},
    {key:'esriHD', icon:'🛰️', title:'Satélite HD', desc:'Imagen aérea real'},
    {key:'googleHybrid', icon:'🧭', title:'Híbrido', desc:'Satélite con vías'},
    {key:'googleTerrain', icon:'⛰️', title:'Terreno', desc:'Relieve urbano'},
    {key:'googleTerrainHybrid', icon:'🗻', title:'Relieve + vías', desc:'Terreno con calles'}
  ];

  let lastMobilityScreen = 'mobility';

  function app(){ return document.getElementById('urbis-mobile-app'); }
  function activeScreen(){
    const a = app();
    return a?.querySelector('.u52-screen.active')?.dataset?.u52Screen || '';
  }
  function inMobility(){
    return document.body.classList.contains('u88-mobility-mode') ||
           document.body.classList.contains('u70-mobility-context') ||
           ['mobility','nav','mobility-destinations'].includes(activeScreen());
  }
  function currentKey(){
    return (window.URBIS_BASEMAPS && window.URBIS_BASEMAPS.mobilityKey) ||
           (window.URBIS_BASEMAPS && typeof window.URBIS_BASEMAPS.getCurrent === 'function' && window.URBIS_BASEMAPS.getCurrent()) ||
           'mobilityPoi';
  }
  function renderCards(){
    const cur = currentKey();
    return MAPS.map(m => `
      <button type="button" class="u103-map-option ${cur===m.key?'active':''}" data-u103-map="${m.key}" data-u103-title="${m.title}">
        <span class="u103-map-emoji">${m.icon}</span>
        <span class="u103-map-copy"><b>${m.title}</b><small>${m.desc}</small></span>
        <span class="u103-map-check">✓</span>
      </button>`).join('');
  }
  function ensurePicker(){
    let picker = document.getElementById('u103-map-picker');
    if(picker) return picker;
    picker = document.createElement('div');
    picker.id = 'u103-map-picker';
    picker.innerHTML = `
      <div class="u103-map-backdrop" data-u103-close></div>
      <section class="u103-map-sheet" role="dialog" aria-modal="true" aria-label="Tipos de mapa">
        <div class="u103-map-handle"></div>
        <header class="u103-map-head">
          <div><b>Tipos de mapa</b><small id="u103-current-label">Selecciona el mapa base de Movilidad</small></div>
          <button type="button" class="u103-map-close" data-u103-close>×</button>
        </header>
        <div class="u103-map-grid"></div>
      </section>`;
    document.body.appendChild(picker);
    picker.addEventListener('click', function(ev){
      const close = ev.target.closest('[data-u103-close]');
      if(close){ ev.preventDefault(); ev.stopPropagation(); closePicker(); return; }
      const card = ev.target.closest('[data-u103-map]');
      if(!card) return;
      ev.preventDefault();
      ev.stopPropagation();
      chooseMap(card.dataset.u103Map, card.dataset.u103Title || 'Mapa');
    });
    return picker;
  }
  function updatePicker(){
    const picker = ensurePicker();
    const grid = picker.querySelector('.u103-map-grid');
    const label = picker.querySelector('#u103-current-label');
    const cur = currentKey();
    const found = MAPS.find(m => m.key === cur);
    if(grid) grid.innerHTML = renderCards();
    if(label) label.textContent = `Mapa actual: ${found ? found.title : 'Movilidad'}`;
  }
  function openPicker(){
    lastMobilityScreen = activeScreen() || 'mobility';
    updatePicker();
    document.body.classList.add('u103-map-picker-open');
  }
  function closePicker(){
    document.body.classList.remove('u103-map-picker-open');
  }
  function chooseMap(key, title){
    if(window.URBIS_BASEMAPS) window.URBIS_BASEMAPS.mobilityKey = key;
    try{
      if(typeof window.cambiarMapaBase === 'function') window.cambiarMapaBase(key, {silent:true});
    }catch(e){ console.warn('URBIS: no se pudo cambiar mapa base', e); }
    updatePicker();
    try{
      if(typeof window.urbisToast === 'function') window.urbisToast(`Mapa ${title} activo`);
      if(typeof window.urbisMobileSetMobilityStatus === 'function') window.urbisMobileSetMobilityStatus(`Mapa ${title} activo.`);
    }catch(e){}
    // Mantener al usuario exactamente en Movilidad: no navegar a Mapa general.
    try{
      if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function'){
        const s = activeScreen();
        if(!['mobility','nav','mobility-destinations'].includes(s)) window.UrbisMobileAppV58.show(lastMobilityScreen || 'mobility', false);
      }
    }catch(e){}
    closePicker();
  }

  function hardPatchU88Dock(){
    const shell = document.getElementById('u88-mobility-shell');
    if(!shell) return;
    const btn = shell.querySelector('[data-u88-go="map"]');
    if(!btn) return;
    btn.setAttribute('aria-label','Elegir tipo de mapa');
    btn.dataset.u103MapButton = '1';
  }

  function interceptMapButton(ev){
    const target = ev.target;
    if(!target || !target.closest) return;
    const u88MapBtn = target.closest('#u88-mobility-shell [data-u88-go="map"], #u88-mobility-shell [data-u103-map-button="1"]');
    const u52MapBtn = target.closest('#urbis-mobile-app .u52-bottom-nav button[data-u70-action="open-map-picker"], #urbis-mobile-app .u52-bottom-nav button[data-u52-go="mobility-multimaps"], #urbis-mobile-app .u52-bottom-nav button[data-u52-go="map"]');
    const imgMap = target.closest('#urbis-mobile-app .u52-bottom-nav button img[src*="urbis-map"], #u88-mobility-shell button img[src*="urbis-map"]');
    if((u88MapBtn || u52MapBtn || imgMap) && inMobility()){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      openPicker();
    }
  }

  function patchShow(){
    const api = window.UrbisMobileAppV58;
    if(!api || typeof api.show !== 'function' || api.__u103MapPatch) return;
    const original = api.show;
    api.show = function(screen){
      // Si algún handler viejo intenta mandar el icono de mapas a otra pantalla,
      // lo convertimos en apertura del selector y NO cambiamos de interfaz.
      if((screen === 'mobility-multimaps' || screen === 'map') && inMobility()){
        openPicker();
        return null;
      }
      return original.apply(this, arguments);
    };
    api.__u103MapPatch = true;
  }

  function init(){
    ensurePicker();
    hardPatchU88Dock();
    patchShow();
  }

  window.urbisOpenMobilityMapPicker = openPicker;
  document.addEventListener('click', interceptMapButton, true);
  document.addEventListener('touchstart', function(ev){
    // No abre en touchstart para evitar doble apertura; solo bloquea navegación rara en algunos WebViews.
    const t = ev.target;
    if(t && t.closest && t.closest('#u88-mobility-shell [data-u88-go="map"]') && inMobility()){
      // no preventDefault aquí para conservar sensación táctil; click real abre el selector.
    }
  }, {capture:true, passive:true});

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init,0);
  setInterval(function(){ hardPatchU88Dock(); patchShow(); }, 500);
})();
