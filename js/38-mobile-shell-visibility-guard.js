/* URBIS · Guardia visual móvil
   Evita que la barra de búsqueda de Movilidad quede visible al volver a Inicio u otras pantallas. */
(function(){
  'use strict';

  function activeMobileScreen(){
    var active = document.querySelector('#urbis-mobile-app .u52-screen.active');
    return active ? (active.getAttribute('data-u52-screen') || '') : '';
  }

  function isMobileMode(){
    try {
      if (window.UrbisAppShell && window.UrbisAppShell.isDesktop) return false;
      return window.matchMedia('(max-width: 820px), (pointer: coarse) and (max-width: 1024px)').matches;
    } catch(e) {
      return window.innerWidth <= 820;
    }
  }

  function hideMobilityShell(){
    var shell = document.getElementById('u88-mobility-shell');
    document.body.classList.remove('u88-mobility-mode');
    document.body.classList.add('u88-mobility-hidden');
    window.urbisMobilityDestinationOnly = false;
    window.urbisDisableReportMapClick = false;
    if (shell) shell.setAttribute('aria-hidden', 'true');
  }

  function showMobilityShell(){
    var shell = document.getElementById('u88-mobility-shell');
    document.body.classList.remove('u88-mobility-hidden');
    if (shell) shell.removeAttribute('aria-hidden');
  }

  function enforceMobilityVisibility(){
    if (!isMobileMode()) {
      hideMobilityShell();
      return;
    }

    var screen = activeMobileScreen();
    var shouldShow = screen === 'mobility';

    if (shouldShow) {
      showMobilityShell();
      try {
        if (window.URBIS_MOBILITY_V102 && typeof window.URBIS_MOBILITY_V102.enable === 'function') {
          window.URBIS_MOBILITY_V102.enable();
        }
      } catch(e) {}
    } else {
      try {
        if (window.URBIS_MOBILITY_V102 && typeof window.URBIS_MOBILITY_V102.disable === 'function') {
          window.URBIS_MOBILITY_V102.disable();
        }
      } catch(e) {}
      hideMobilityShell();
    }
  }

  function wrapMobileShow(){
    var api = window.UrbisMobileAppV58;
    if (!api || api.__urbisMobilityVisibilityGuard) return;
    var originalShow = api.show;
    if (typeof originalShow !== 'function') return;

    api.show = function(screen){
      var result = originalShow.apply(this, arguments);
      setTimeout(enforceMobilityVisibility, 0);
      setTimeout(enforceMobilityVisibility, 90);
      setTimeout(enforceMobilityVisibility, 280);
      return result;
    };
    api.__urbisMobilityVisibilityGuard = true;
  }

  document.addEventListener('click', function(ev){
    var go = ev.target && ev.target.closest ? ev.target.closest('[data-u52-go],[data-u88-go],[data-u52-back]') : null;
    if (!go) return;
    setTimeout(enforceMobilityVisibility, 0);
    setTimeout(enforceMobilityVisibility, 120);
    setTimeout(enforceMobilityVisibility, 350);
  }, true);

  window.addEventListener('urbis:shell-mode', enforceMobilityVisibility);
  window.addEventListener('resize', function(){ setTimeout(enforceMobilityVisibility, 120); }, { passive:true });
  window.addEventListener('orientationchange', function(){ setTimeout(enforceMobilityVisibility, 280); }, { passive:true });

  document.addEventListener('DOMContentLoaded', function(){
    wrapMobileShow();
    enforceMobilityVisibility();
    var app = document.getElementById('urbis-mobile-app');
    if (app) {
      new MutationObserver(enforceMobilityVisibility).observe(app, { subtree:true, attributes:true, attributeFilter:['class','hidden'] });
    }
  });

  window.addEventListener('load', function(){
    wrapMobileShow();
    setTimeout(enforceMobilityVisibility, 250);
    setTimeout(enforceMobilityVisibility, 900);
  });

  setInterval(function(){
    wrapMobileShow();
    enforceMobilityVisibility();
  }, 700);

  window.URBIS_MOBILITY_VISIBILITY_GUARD = { enforce: enforceMobilityVisibility, activeScreen: activeMobileScreen };
})();
