/* URBIS V79 · Controlador movilidad compacta */
(function(){
  'use strict';

  const MINT_ROUTE = '#49d8c8';
  const MINT_ROUTE_DARK = '#28bda8';

  function getMap(){
    return window.map || window.urbisMap || null;
  }

  function clickByText(texts){
    const lower = texts.map(t => t.toLowerCase());
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], .u70-basemap-option, .layer-option'));
    const found = buttons.find(btn => lower.some(t => (btn.textContent || '').toLowerCase().includes(t)));
    if(found) found.click();
    return !!found;
  }

  function forceMapaClaro(){
    try{
      document.body.dataset.urbisMobilityBasemap = 'claro';
      window.URBIS_MOBILITY_DEFAULT_BASEMAP = 'claro';
      localStorage.setItem('urbis_mobility_basemap', 'claro');
      localStorage.setItem('urbis_basemap_mobility', 'claro');
      localStorage.setItem('urbis_active_basemap', 'claro');
    }catch(e){}

    // Si existe selector propio, intenta activar mapa claro sin abrir pantallas.
    setTimeout(() => {
      try{
        const candidates = Array.from(document.querySelectorAll('[data-basemap], [data-map], button'));
        const claro = candidates.find(el => {
          const v = String(el.dataset.basemap || el.dataset.map || el.textContent || '').toLowerCase();
          return v.includes('claro') || v.includes('light') || v.includes('carto');
        });
        if(claro && claro.dataset.basemap) {
          claro.dispatchEvent(new Event('click', {bubbles:true}));
        }
      }catch(e){}
    }, 500);
  }

  function patchPanel(){
    const screen = document.querySelector('#urbis-mobile-app .u52-screen[data-u52-screen="mobility"]');
    if(!screen) return;

    const panel = screen.querySelector('.u70-mobility-panel, .u52-route-panel, .u57-route-panel, .u52-sheet');
    if(!panel || panel.dataset.u79Compact === '1') return;

    panel.dataset.u79Compact = '1';
    panel.classList.add('u70-mobility-panel');

    const title = panel.querySelector('h2, h1, .u52-title');
    const subtitle = Array.from(panel.querySelectorAll('p, small')).find(el => /destino|transporte|ruta/i.test(el.textContent || ''));

    if(title){
      const head = document.createElement('div');
      head.className = 'u79-mobility-head';

      const titleBox = document.createElement('div');
      titleBox.className = 'u79-title-box';
      titleBox.appendChild(title);
      if(subtitle && subtitle.parentElement === panel) titleBox.appendChild(subtitle);

      const actions = document.createElement('div');
      actions.className = 'u79-mobility-actions';

      const gps = document.createElement('button');
      gps.type = 'button';
      gps.className = 'u79-mini-gps';
      gps.innerHTML = '⌖';
      gps.title = 'Centrar ubicación';
      gps.addEventListener('click', () => {
        const oldGps = screen.querySelector('[data-u52-call="center-gps"], [data-u52-call="locate"], [data-u52-call="center-map"]');
        if(oldGps) oldGps.click();
        else if(typeof window.centrarEnMiUbicacion === 'function') window.centrarEnMiUbicacion();
        else if(typeof window.ubicarUsuario === 'function') window.ubicarUsuario();
      });

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'u79-transport-toggle';
      toggle.innerHTML = '<strong>Transporte</strong> ▼';
      toggle.addEventListener('click', () => {
        panel.classList.toggle('urbis-transport-open');
        toggle.innerHTML = panel.classList.contains('urbis-transport-open') ? '<strong>Transporte</strong> ▲' : '<strong>Transporte</strong> ▼';
      });

      actions.appendChild(gps);
      actions.appendChild(toggle);
      head.appendChild(titleBox);
      head.appendChild(actions);

      panel.insertBefore(head, panel.firstChild);
    }

    // Eliminar caja GPS grande si existe.
    Array.from(panel.querySelectorAll('*')).forEach(el => {
      const txt = (el.textContent || '').trim().toLowerCase();
      if(/^gps activo/.test(txt) || txt.includes('gps activo ·')) {
        el.style.display = 'none';
      }
    });
  }

  function patchRouteStyles(){
    const map = getMap();
    if(!map) return;

    // Recolorizar polilíneas existentes y quitar duplicadas muy similares.
    const lines = [];
    map.eachLayer(layer => {
      if(layer && typeof layer.setStyle === 'function' && layer.getLatLngs) {
        try {
          const latlngs = layer.getLatLngs();
          const flatLen = JSON.stringify(latlngs).length;
          if(flatLen > 100) lines.push({layer, flatLen});
        } catch(e){}
      }
    });

    lines.forEach(({layer}) => {
      try{
        layer.setStyle({
          color: MINT_ROUTE,
          weight: 7,
          opacity: .92,
          lineCap: 'round',
          lineJoin: 'round'
        });
      }catch(e){}
    });

    // Si hay dos rutas casi idénticas, deja visible la última/principal y baja duplicadas.
    if(lines.length > 1){
      lines
        .sort((a,b) => b.flatLen - a.flatLen)
        .slice(1)
        .forEach(({layer}) => {
          try { layer.setStyle({ opacity: 0, weight: 0 }); }
          catch(e){}
        });
    }
  }

  function bind(){
    if(!document.body.classList.contains('u70-mobility-context') && !document.body.classList.contains('u52-real-map')) return;
    patchPanel();
    forceMapaClaro();
    patchRouteStyles();
  }

  const timer = setInterval(bind, 700);
  window.addEventListener('load', () => setTimeout(bind, 500));
  document.addEventListener('click', () => setTimeout(bind, 250), true);

  // Reaplica al cambiar zoom/mover o iniciar ruta.
  setInterval(patchRouteStyles, 1500);
})();
