/* URBIS V176 · Home reset runtime */
(function(){
  'use strict';
  const MOBILE_Q = '(max-width:1024px), (pointer:coarse)';
  function isMobile(){ try{return matchMedia(MOBILE_Q).matches;}catch(e){return innerWidth<=1024;} }
  function app(){ return document.getElementById('urbis-mobile-app'); }
  function screenName(){ const s=app()?.querySelector('.u52-screen.active'); return s?.dataset?.u52Screen || ''; }
  function isAuthVisible(){ const login=document.getElementById('login-screen'); return !!(login && getComputedStyle(login).display !== 'none' && login.style.pointerEvents !== 'none'); }
  function clearLegacy(){
    if(!isMobile()) return;
    document.documentElement.classList.add('urbis-mobile-runtime','urbis-v176-reset');
    document.body.classList.add('urbis-mobile-runtime','urbis-v176-reset');
    const s = screenName();
    const mapMode = ['mobility','map','nav','runner-live'].includes(s) || document.body.classList.contains('u88-mobility-mode');
    // No dejar pantallas contextuales viejas activas.
    app()?.querySelectorAll('[data-u52-screen="mobility-multimaps"],[data-u52-screen="mobility-destinations"],.u70-context-screen').forEach(el=>{
      el.classList.remove('active');
      el.style.display='none'; el.style.visibility='hidden'; el.style.pointerEvents='none';
    });
    // Si no estamos en mapa, limpiar clases que levantan overlays de movilidad.
    if(!mapMode){
      document.body.classList.remove('u70-mobility-context','u120-map-picker-open','u103-map-picker-open','u88-mobility-mode','u52-real-map');
      const map=document.getElementById('map'); if(map){ map.style.display='none'; map.style.visibility='hidden'; map.style.pointerEvents='none'; }
    }
    document.querySelectorAll('#u70-map-picker-sheet,#u70-map-picker-backdrop,#u120-mobility-map-picker,#u103-map-picker,#module-focus-shell,.module-access-shell,.module-access-grid,.sidebar-page,.sidebar-tabs').forEach(el=>{
      try{ el.classList.remove('visible','active'); el.hidden = el.id==='u70-map-picker-backdrop' ? true : el.hidden; }catch(e){}
      el.style.display='none'; el.style.visibility='hidden'; el.style.opacity='0'; el.style.pointerEvents='none';
    });
    const root=app(); if(root){ root.style.display='block'; root.style.visibility='visible'; root.style.opacity='1'; root.style.pointerEvents='auto'; }
  }
  function keepOneActive(prefer){
    const root=app(); if(!root) return;
    const list=[...root.querySelectorAll('.u52-screen.active')];
    if(list.length<=1) return;
    let keep = prefer ? list.find(x=>x.dataset.u52Screen===prefer) : null;
    keep = keep || list.find(x=>x.dataset.u52Screen==='home') || list[list.length-1];
    list.forEach(x=>{ if(x!==keep) x.classList.remove('active'); });
  }
  function showHomeOnce(){
    if(!isMobile()) return;
    if(isAuthVisible()) return;
    const root=app(); if(!root) return;
    const current=screenName();
    // Si viene de caché con avatar/multimapas/overlay, volver al Home.
    if(!current || ['avatar','mobility-multimaps','mobility-destinations'].includes(current)){
      try{ window.UrbisMobileAppV58?.show?.('home'); }catch(e){}
      root.querySelectorAll('.u52-screen').forEach(s=>s.classList.toggle('active', s.dataset.u52Screen==='home'));
    }
    keepOneActive('home');
    clearLegacy();
  }
  function refresh(){ clearLegacy(); keepOneActive(); }
  window.addEventListener('load', ()=>{ setTimeout(showHomeOnce,250); setTimeout(showHomeOnce,900); setTimeout(refresh,1600); }, {passive:true});
  document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(showHomeOnce,400); }, {passive:true});
  document.addEventListener('click', ev=>{
    const go = ev.target?.closest?.('[data-u52-go]');
    if(go && go.dataset.u52Go === 'home') setTimeout(showHomeOnce, 30);
    else setTimeout(refresh, 80);
  }, true);
  document.addEventListener('touchend', ()=>setTimeout(refresh,120), {passive:true,capture:true});
  setInterval(refresh, 1200);
  window.URBIS_V176_HOME_RESET = {refresh, showHomeOnce};
})();
