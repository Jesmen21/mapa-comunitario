/* URBIS V70 · guard móvil SheetDB
   Evita que Android/iPhone bloquee URBIS si SheetDB tarda, falla o responde con límite.
   No cambia la interfaz. Solo evita alertas y usa caché local para lectura.
*/
(function(){
  'use strict';

  const CACHE_KEY = 'urbis_sheetdb_cache_v70_mobile';
  const COOLDOWN_KEY = 'urbis_sheetdb_mobile_cooldown_until';
  const REAL_FETCH = window.fetch.bind(window);
  const MOBILE_Q = '(max-width:1024px), (pointer:coarse)';

  function isMobile(){
    try { return matchMedia(MOBILE_Q).matches; }
    catch(e){ return innerWidth <= 1024; }
  }

  function isSheetDB(input){
    try { return String(input && (input.url || input)).toLowerCase().includes('sheetdb.io/api'); }
    catch(e){ return false; }
  }

  function cacheGet(){
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch(e){ return []; }
  }

  function cacheSet(data){
    try {
      if(Array.isArray(data)) localStorage.setItem(CACHE_KEY, JSON.stringify(data.slice(-1500)));
    } catch(e){}
  }

  function responseJSON(data){
    return new Response(JSON.stringify(Array.isArray(data) ? data : []), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-URBIS-MOBILE-FALLBACK': '1' }
    });
  }

  function setCooldown(){
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now() + 10 * 60 * 1000)); } catch(e){}
    document.body.classList.add('urbis-sheetdb-mobile-fallback');
  }

  function inCooldown(){
    try { return Number(localStorage.getItem(COOLDOWN_KEY) || 0) > Date.now(); }
    catch(e){ return false; }
  }

  window.fetch = async function(input, options){
    if(!isMobile() || !isSheetDB(input)) return REAL_FETCH(input, options);

    const method = String((options && options.method) || 'GET').toUpperCase();

    if(method === 'GET' && inCooldown()){
      return responseJSON(cacheGet());
    }

    try {
      const res = await REAL_FETCH(input, options);

      if([402,403,429].includes(res.status)){
        setCooldown();
        if(method === 'GET') return responseJSON(cacheGet());
        return new Response('URBIS móvil: cambio guardado localmente por falla SheetDB', {status:202});
      }

      if(method === 'GET' && res.ok){
        try {
          const clone = res.clone();
          const data = await clone.json();
          if(Array.isArray(data)) cacheSet(data);
        } catch(e){}
      }

      return res;
    } catch(error) {
      setCooldown();
      if(method === 'GET') return responseJSON(cacheGet());
      return new Response('URBIS móvil: guardado local pendiente', {status:202});
    }
  };
})();
