
(function(){
  'use strict';
  const NAV_ITEMS = [
    { key:'mobility', icon:'🧭', label:'Mover' },
    { key:'sport', icon:'🔥', label:'Runner' },
    { key:'alerts', icon:'🚨', label:'Alertas' },
    { key:'events', icon:'🎪', label:'Eventos' },
    { key:'access', icon:'👤', label:'Perfil' }
  ];

  function isMobile(){ return window.matchMedia('(max-width: 760px)').matches; }

  function shouldUseLegacyNav(){
    const hasNativeApp = !!document.getElementById('urbis-mobile-app');
    const mobileShell = (window.UrbisAppShell && window.UrbisAppShell.isMobile) || window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
    return !(hasNativeApp && mobileShell);
  }

  function createBottomNav(){
    if(!shouldUseLegacyNav()) return;
    if(document.getElementById('urbis-mobile-bottom-nav')) return;
    const nav = document.createElement('nav');
    nav.id = 'urbis-mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Navegación principal móvil');
    nav.innerHTML = NAV_ITEMS.map(item => `
      <button type="button" class="urbis-mobile-nav-btn" data-module="${item.key}" aria-label="Abrir ${item.label}">
        <span>${item.icon}</span><b>${item.label}</b>
      </button>
    `).join('');
    document.body.appendChild(nav);
    nav.addEventListener('click', ev => {
      const btn = ev.target.closest('.urbis-mobile-nav-btn');
      if(!btn) return;
      const module = btn.dataset.module;
      if(typeof window.setSidebarTab === 'function') window.setSidebarTab(module);
    });
  }

  function updateBottomNav(){
    const nav = document.getElementById('urbis-mobile-bottom-nav');
    if(!nav) return;
    if(!shouldUseLegacyNav()){ nav.style.display = 'none'; return; }
    const active = document.body.getAttribute('data-active-module') || 'menu';
    nav.querySelectorAll('.urbis-mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.module === active);
      btn.classList.toggle('is-home', active === 'menu');
    });
    const hide = document.body.classList.contains('route-focus-active') ||
                 document.body.classList.contains('route-choice-active') ||
                 document.body.classList.contains('runner-session-active') ||
                 document.body.classList.contains('sport-runner-active');
    nav.style.display = (isMobile() && !hide) ? 'grid' : 'none';
  }

  function compactCopy(){
    if(!isMobile()) return;
    const map = {
      'module-focus-subtitle': {
        mobility:'Rutas, GPS y alertas viales.',
        sport:'Actividad, progreso y runner.',
        alerts:'Reportes ciudadanos rápidos.',
        access:'Datos, permisos y logros.',
        events:'Comunidad y actividades.',
        stats:'Indicadores de ciudad.',
        mapping:'Capas y mapas.',
        advanced:'Herramientas técnicas.'
      }
    };
    const active = document.body.getAttribute('data-active-module') || 'menu';
    const subtitle = document.getElementById('module-focus-subtitle');
    if(subtitle && map['module-focus-subtitle'][active]) subtitle.textContent = map['module-focus-subtitle'][active];

    const shortText = [
      ['.sport-runner-cta-card h4','Modo runner'],
      ['.route-real-title','Guía rápida'],
      ['.map-tools-title','Herramientas'],
      ['.sport-hero-card h3','Plan de actividad']
    ];
    shortText.forEach(([sel,txt]) => {
      const el = document.querySelector(sel);
      if(el && !el.dataset.mobileShortened){ el.dataset.originalText = el.textContent; el.textContent = txt; el.dataset.mobileShortened='1'; }
    });
  }

  function scrollModuleTop(){
    if(!isMobile()) return;
    const sidebar = document.getElementById('sidebar');
    if(sidebar && document.body.classList.contains('module-focused')) {
      setTimeout(()=> sidebar.scrollTo({ top: 0, behavior: 'smooth' }), 40);
    }
  }

  function init(){
    createBottomNav();
    compactCopy();
    updateBottomNav();

    const observer = new MutationObserver(() => {
      compactCopy();
      updateBottomNav();
    });
    observer.observe(document.body, { attributes:true, attributeFilter:['class','data-active-module'] });

    document.addEventListener('click', ev => {
      if(ev.target.closest('.sidebar-tab-btn') || ev.target.closest('.urbis-mobile-nav-btn')) scrollModuleTop();
    }, true);
    window.addEventListener('resize', () => { compactCopy(); updateBottomNav(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
