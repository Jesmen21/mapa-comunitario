(function(){
  'use strict';
  const app = document.getElementById('urbis-mobile-app');
  if(!app) return;

  const MOBILITY_SCREENS = new Set(['mobility','nav','mobility-multimaps','mobility-destinations']);
  const BASEMAPS = [
    {key:'mobilityPoi', icon:'✨', title:'Estético', desc:'Minimalista y limpio para navegación GPS.'},
    {key:'actual', icon:'🟦', title:'URBIS', desc:'Mapa base normal de la app.'},
    {key:'googleRoads', icon:'🏙️', title:'Calles', desc:'Calles y nombres urbanos con más detalle.'},
    {key:'cartoLightMatter', icon:'☀️', title:'Claro', desc:'Plano suave, limpio y muy legible.'},
    {key:'osmHumanitarian', icon:'🌿', title:'Comunitario', desc:'Servicios, barrios y referencias ciudadanas.'},
    {key:'cartoDarkMatter', icon:'🌙', title:'Nocturno', desc:'Oscuro para resaltar rutas y pines.'},
    {key:'esriHD', icon:'🛰️', title:'Satélite HD', desc:'Imagen aérea real del territorio.'},
    {key:'googleHybrid', icon:'🧭', title:'Híbrido', desc:'Satélite con nombres de vías.'},
    {key:'googleTerrain', icon:'⛰️', title:'Terreno', desc:'Relieve y estructura del suelo.'},
    {key:'googleTerrainHybrid', icon:'🗻', title:'Relieve + vías', desc:'Terreno combinado con calles.'}
  ];

  function destinationIconHtml(extraClass=''){
    return `<span class="u70-destination-icon ${extraClass}"><img src="assets/icons/llegada.png" alt="Destino"></span>`;
  }

  function navIconHtml(file, alt, extraClass=''){
    return `<span class="u70-nav-img ${extraClass}"><img src="assets/icons/${file}" alt="${alt}"></span>`;
  }

  function activeScreen(){
    return app.querySelector('.u52-screen.active')?.dataset?.u52Screen || 'login';
  }
  function isMobilityContext(){ return MOBILITY_SCREENS.has(activeScreen()); }

  let baseBeforeMobility = null;
  function syncMobilityBasemap(){
    const api = window.URBIS_BASEMAPS;
    if(!api || typeof window.cambiarMapaBase !== 'function' || typeof api.getCurrent !== 'function') return;
    const current = api.getCurrent();
    const mobilityKey = api.mobilityKey || 'mobilityPoi';
    const defaultKey = api.defaultKey || 'actual';
    if(isMobilityContext()){
      if(current !== mobilityKey){
        if(!baseBeforeMobility && current !== mobilityKey) baseBeforeMobility = current;
        window.cambiarMapaBase(mobilityKey, { silent:true });
      }
      return;
    }
    if(current === mobilityKey){
      window.cambiarMapaBase(baseBeforeMobility || defaultKey, { silent:true });
      baseBeforeMobility = null;
    }
  }


  function renderMapOptionsCards(extraClass=''){
    const current = (window.URBIS_BASEMAPS && window.URBIS_BASEMAPS.mobilityKey) || 'mobilityPoi';
    return BASEMAPS.map(m=>`<button class="u70-map-card ${extraClass} ${current===m.key?'active':''}" data-u70-basemap="${m.key}" data-u70-map-title="${m.title}"><span class="u70-map-icon">${m.icon}</span><b>${m.title}</b><small>${m.desc}</small></button>`).join('');
  }

  function ensureMapPickerSheet(){
    if(app.querySelector('#u70-map-picker-sheet')) return;
    app.insertAdjacentHTML('beforeend', `
      <div class="u70-map-picker-backdrop" id="u70-map-picker-backdrop" hidden></div>
      <aside class="u70-map-picker-sheet" id="u70-map-picker-sheet" aria-hidden="true">
        <div class="u70-sheet-handle"></div>
        <header class="u70-map-picker-head">
          <div><b>Personalizar mapa</b><small>Elige una base para Movilidad</small></div>
          <button type="button" class="u70-map-picker-close" data-u70-close-map-picker aria-label="Cerrar selector de mapas">×</button>
        </header>
        <div class="u70-map-picker-grid" id="u70-map-picker-grid">${renderMapOptionsCards('compact')}</div>
        <div class="u70-map-picker-status" id="u70-map-picker-status">Toca una opción para cambiar solo el mapa base de Movilidad.</div>
      </aside>
    `);
  }

  function openMapPickerSheet(){
    ensureMapPickerSheet();
    const sheet = app.querySelector('#u70-map-picker-sheet');
    const backdrop = app.querySelector('#u70-map-picker-backdrop');
    const grid = app.querySelector('#u70-map-picker-grid');
    if(grid) grid.innerHTML = renderMapOptionsCards('compact');
    const status = app.querySelector('#u70-map-picker-status');
    const currentOpt = BASEMAPS.find(m => m.key === ((window.URBIS_BASEMAPS && window.URBIS_BASEMAPS.mobilityKey) || 'mobilityPoi'));
    if(status) status.textContent = `Mapa actual: ${currentOpt ? currentOpt.title : 'Movilidad'}`;
    if(backdrop) backdrop.hidden = false;
    if(sheet){
      sheet.classList.add('visible');
      sheet.setAttribute('aria-hidden','false');
    }
  }

  function closeMapPickerSheet(){
    const sheet = app.querySelector('#u70-map-picker-sheet');
    const backdrop = app.querySelector('#u70-map-picker-backdrop');
    if(sheet){
      sheet.classList.remove('visible');
      sheet.setAttribute('aria-hidden','true');
    }
    if(backdrop) backdrop.hidden = true;
  }

  function ensureContextScreens(){
    ensureMapPickerSheet();
    if(app.querySelector('[data-u52-screen="mobility-multimaps"]')) return;
    const nav = app.querySelector('.u52-bottom-nav');
    if(!nav) return;
    nav.insertAdjacentHTML('beforebegin', `
      <section class="u52-screen u70-context-screen" data-u52-screen="mobility-multimaps">
        <header class="u52-topbar"><button class="u52-icon-btn" data-u52-go="mobility">←</button><h2 class="u52-title">Multimapas</h2><button class="u52-icon-btn" data-u52-call="locate">⌖</button></header>
        <main class="u52-content">
          <div class="u52-hero"><h1>Mapas para navegar</h1><p>Cambia la base del mapa sin salir de Movilidad.</p></div>
          <div class="u70-map-grid">
            ${renderMapOptionsCards()}
          </div>
          <div class="u70-empty-real"><span class="ico">🚦</span><div><b>Tráfico conectado a la ruta</b><small>URBIS no pinta tráfico decorativo en todo el mapa. La congestión aparece cuando existe una ruta activa y el proveedor entrega datos reales.</small></div></div>
        </main>
      </section>
      <section class="u52-screen u70-context-screen" data-u52-screen="mobility-destinations">
        <header class="u52-topbar"><button class="u52-icon-btn" data-u52-go="mobility">←</button><h2 class="u52-title">Destinos</h2><button class="u52-icon-btn" data-u52-call="locate">⌖</button></header>
        <main class="u52-content">
          <div class="u52-hero"><h1>Rutas y destinos</h1><p>Usa datos reales del GPS y del motor de rutas.</p></div>
          <div class="u70-empty-real u70-destination-state" id="u70-route-real-state">${destinationIconHtml('card')}<div><b>Sin destino seleccionado</b><small>Toca “Elegir destino” y marca el punto en el mapa.</small></div></div>
          <div class="u70-destination-actions"><button class="secondary" data-u52-call="choose-destination">Elegir destino</button><button class="primary" data-u52-call="start-route">Iniciar ruta</button></div>
          <div class="u70-empty-real"><span class="ico">⭐</span><div><b>Sin destinos guardados todavía</b><small>Cuando exista un sistema real de favoritos o historial, aparecerá aquí. No se muestran datos inventados.</small></div></div>
        </main>
      </section>
    `);
  }

  const HOME_NAV = [
    {sel:'home', icon:'🏠', label:'Inicio', go:'home'},
    {sel:'mobility', icon:'🚗', label:'Movilidad', go:'mobility'},
    {sel:'sport', icon:'🔥', label:'Runner', go:'sport'},
    {sel:'profile', icon:'👤', label:'Perfil', go:'profile'}
  ];
  const MOBILITY_NAV = [
    {sel:'home', icon:navIconHtml('urbis-home.png', 'Inicio', 'home'), label:'Inicio', go:'home'},
    {sel:'mobility', icon:navIconHtml('urbis-car.png', 'Movilidad', 'car'), label:'Movilidad', go:'mobility'},
    {sel:'sport', icon:destinationIconHtml('nav'), label:'Destinos', go:'mobility-destinations'},
    {sel:'profile', icon:navIconHtml('urbis-map.png', 'Multimapas', 'map'), label:'Multimapas', go:'mobility', action:'open-map-picker'}
  ];

  function setButton(btn, item){
    if(!btn || !item) return;
    if(item.action){
      delete btn.dataset.u52Go; // evita que el handler principal cambie de pantalla
      btn.dataset.u70Action = item.action;
    } else {
      btn.dataset.u52Go = item.go;
      delete btn.dataset.u70Action;
    }
    btn.innerHTML = `${item.icon}<span>${item.label}</span>`;
    btn.setAttribute('aria-label', `Abrir ${item.label}`);
  }

  function updateContextNav(){
    ensureContextScreens();
    const screen = activeScreen();
    const mobility = MOBILITY_SCREENS.has(screen);
    document.body.classList.toggle('u70-mobility-context', mobility);
    syncMobilityBasemap();
    const nav = app.querySelector('.u52-bottom-nav');
    if(!nav) return;
    const items = mobility ? MOBILITY_NAV : HOME_NAV;
    items.forEach(item => setButton(nav.querySelector(`button[data-u52-go="${item.sel}"]`) || nav.querySelector(`button[data-u70-nav-slot="${item.sel}"]`), item));
    // Añade ranuras estables para que los botones puedan restaurarse después de cambiar data-u52-go.
    const order = ['home','mobility','sport','profile'];
    [...nav.querySelectorAll('button:not(.plus)')].forEach((btn, i)=>{ if(!btn.dataset.u70NavSlot) btn.dataset.u70NavSlot = order[i] || ''; });
    [...nav.querySelectorAll('button')].forEach(btn=>{
      const go = btn.dataset.u52Go;
      const active = !btn.dataset.u70Action && (go === screen || (mobility && go === 'mobility' && screen === 'nav'));
      btn.classList.toggle('active', active);
    });
    const plus = nav.querySelector('.plus');
    if(plus){
      plus.dataset.u52Go = 'alerts';
      plus.innerHTML = '＋';
      plus.setAttribute('aria-label','Crear o consultar alertas');
    }
  }

  function updateRouteStateCard(){
    const card = app.querySelector('#u70-route-real-state');
    if(!card) return;
    let html = `${destinationIconHtml('card')}<div><b>Sin destino seleccionado</b><small>Toca “Elegir destino” y marca el punto en el mapa.</small></div>`;
    try{
      const route = window.routeRealLastResult;
      const dest = window.routeRealPointB;
      if(route && (route.distance || route.duration)){
        const km = Number(route.distance || 0) / 1000;
        const min = Math.max(1, Math.round(Number(route.duration || 0) / 60));
        html = `${destinationIconHtml('card')}<div><b>Ruta calculada</b><small>${km.toFixed(km > 10 ? 0 : 1)} km · ${min} min aprox. · datos del motor de rutas.</small></div>`;
      } else if(dest){
        html = `${destinationIconHtml('card')}<div><b>Destino seleccionado</b><small>Lat ${Number(dest.lat).toFixed(5)}, Lng ${Number(dest.lng).toFixed(5)}. Listo para calcular ruta.</small></div>`;
      }
    }catch(e){}
    card.innerHTML = html;
  }

  function bindBasemapCards(){
    if(app.dataset.u70BasemapBound === '1') return;
    app.dataset.u70BasemapBound = '1';
    app.addEventListener('click', ev=>{
      const mapNav = ev.target.closest('.u52-bottom-nav button[data-u70-action="open-map-picker"]');
      if(mapNav && isMobilityContext()){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        openMapPickerSheet();
        return;
      }
      if(ev.target.closest('[data-u70-close-map-picker]') || ev.target.closest('#u70-map-picker-backdrop')){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        closeMapPickerSheet();
        return;
      }
      const card = ev.target.closest('[data-u70-basemap]');
      if(!card) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const key = card.dataset.u70Basemap;
      const title = card.dataset.u70MapTitle || 'Mapa';
      if(window.URBIS_BASEMAPS) window.URBIS_BASEMAPS.mobilityKey = key;
      try{
        if(typeof window.cambiarMapaBase === 'function'){
          window.cambiarMapaBase(key);
          if(typeof window.cerrarBasemapPanel === 'function') window.cerrarBasemapPanel();
          app.querySelectorAll('[data-u70-basemap]').forEach(x=>x.classList.toggle('active', x.dataset.u70Basemap === key));
          const grid = app.querySelector('#u70-map-picker-grid');
          if(grid) grid.innerHTML = renderMapOptionsCards('compact');
          const status = app.querySelector('#u70-map-picker-status');
          if(status) status.textContent = `Mapa actual: ${title}`;
          if(card.closest('#u70-map-picker-sheet')) closeMapPickerSheet();
          if(typeof window.urbisMobileSetMobilityStatus === 'function') window.urbisMobileSetMobilityStatus(`Mapa ${title} activo.`);
        } else if(typeof window.urbisMobileSetMobilityStatus === 'function'){
          window.urbisMobileSetMobilityStatus('Selector de mapas no disponible todavía.');
        }
      }catch(e){ console.warn('No se pudo cambiar mapa base URBIS', e); }
    }, true);
  }

  function wrapShow(){
    const api = window.UrbisMobileAppV58;
    if(!api || api.__u70Wrapped) return;
    const original = api.show;
    api.show = function(screen){
      const r = original.apply(this, arguments);
      setTimeout(()=>{ updateContextNav(); updateRouteStateCard(); }, 0);
      return r;
    };
    api.__u70Wrapped = true;
  }

  function init(){
    ensureContextScreens();
    bindBasemapCards();
    wrapShow();
    updateContextNav();
    updateRouteStateCard();
    const mo = new MutationObserver(()=>{ updateContextNav(); updateRouteStateCard(); });
    mo.observe(app, {subtree:true, attributes:true, attributeFilter:['class']});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
