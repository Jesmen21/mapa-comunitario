/* URBIS V175 · estabilizador de runtime móvil
   Limpia estados viejos y evita pantallas superpuestas. */
(function(){
  'use strict';

  function isMobile(){
    try { return matchMedia('(max-width:1024px), (pointer:coarse)').matches; }
    catch(e){ return innerWidth <= 1024; }
  }

  function app(){ return document.getElementById('urbis-mobile-app'); }
  function activeScreen(){
    const a = app()?.querySelector('.u52-screen.active');
    return a ? (a.getAttribute('data-u52-screen') || '') : '';
  }
  function mapScreens(){ return new Set(['mobility','map','nav','runner-live']); }

  function oneActiveScreen(){
    const root = app();
    if(!root) return;
    const active = [...root.querySelectorAll('.u52-screen.active')];
    if(active.length <= 1) return;
    // Preferir la última pantalla que el usuario abrió; si hay movilidad activa, conservarla.
    let keep = active.find(s => s.dataset.u52Screen === 'mobility') || active[active.length - 1];
    active.forEach(s => { if(s !== keep) s.classList.remove('active'); });
  }

  function hideLegacyPanels(screen){
    const ids = ['sidebar','urbis-mobile-bottom-nav','basemap-panel','basemap-backdrop'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if(el){
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
      }
    });
    document.querySelectorAll('.basemap-switcher, .basemap-backdrop, .basemap-panel').forEach(el=>{
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    });

    if(!mapScreens().has(screen)){
      document.body.classList.remove('u88-mobility-mode','u70-mobility-context','u52-real-map','u120-map-picker-open','u103-map-picker-open');
      const map = document.getElementById('map');
      if(map){ map.style.display = 'none'; map.style.visibility = 'hidden'; map.style.pointerEvents = 'none'; }
    } else {
      const map = document.getElementById('map');
      if(map){ map.style.visibility = 'visible'; map.style.pointerEvents = 'auto'; }
    }
  }

  function normalizePickers(screen){
    if(screen !== 'mobility' && screen !== 'mobility-multimaps' && screen !== 'mobility-destinations'){
      document.body.classList.remove('u70-mobility-context','u120-map-picker-open','u103-map-picker-open');
      document.querySelectorAll('#u70-map-picker-sheet, #u120-mobility-map-picker, #u103-map-picker').forEach(el=>{
        el.classList.remove('visible');
        el.style.pointerEvents = 'none';
      });
      const bd = document.getElementById('u70-map-picker-backdrop');
      if(bd) bd.hidden = true;
    }
  }

  function apply(){
    if(!isMobile()) return;
    const root = app();
    if(!root) return;
    document.documentElement.classList.add('urbis-mobile-runtime');
    document.body.classList.add('urbis-mobile-runtime');
    oneActiveScreen();
    const screen = activeScreen() || 'home';
    hideLegacyPanels(screen);
    normalizePickers(screen);

    root.style.display = 'block';
    root.style.visibility = 'visible';
    root.style.opacity = '1';
    root.style.pointerEvents = 'auto';

    root.querySelectorAll('.u52-screen').forEach(s => {
      const isActive = s.classList.contains('active');
      if(!isActive){
        s.style.display = 'none';
        s.style.visibility = 'hidden';
        s.style.pointerEvents = 'none';
      } else {
        s.style.display = 'block';
        s.style.visibility = 'visible';
        s.style.pointerEvents = 'auto';
      }
    });
  }

  function wrapShow(){
    const api = window.UrbisMobileAppV58;
    if(!api || typeof api.show !== 'function' || api.__v175StableWrapped) return;
    const original = api.show;
    api.show = function(){
      const r = original.apply(this, arguments);
      setTimeout(apply, 0);
      setTimeout(apply, 80);
      setTimeout(apply, 260);
      return r;
    };
    api.__v175StableWrapped = true;
  }

  document.addEventListener('click', function(){ setTimeout(apply, 0); setTimeout(apply, 140); }, true);
  document.addEventListener('touchend', function(){ setTimeout(apply, 60); }, {passive:true, capture:true});
  window.addEventListener('load', function(){ wrapShow(); apply(); setTimeout(apply, 300); setTimeout(apply, 900); });
  document.addEventListener('DOMContentLoaded', function(){ wrapShow(); apply(); });
  window.addEventListener('resize', function(){ setTimeout(apply, 150); }, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(apply, 300); }, {passive:true});
  setInterval(function(){ wrapShow(); apply(); }, 900);

  window.URBIS_V175_STABILIZER = { apply, activeScreen };
})();
