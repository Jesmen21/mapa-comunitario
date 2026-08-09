/* URBIS V77 · Resiliencia SheetDB
   La app no debe romperse cuando SheetDB supera el límite mensual o responde 429/403.
   Activa modo local/cache y evita bucles de peticiones.
*/
(function(){
  'use strict';

  const CACHE_KEY = 'urbis_sheetdb_cache_v77';
  const QUEUE_KEY = 'urbis_sheetdb_pending_queue_v77';
  const COOLDOWN_KEY = 'urbis_sheetdb_cooldown_until_v77';
  const COOLDOWN_MS = 30 * 60 * 1000;
  const REAL_FETCH = window.fetch.bind(window);

  function isSheetDBUrl(url){
    try { return String(url && (url.url || url)).toLowerCase().includes('sheetdb.io/api'); }
    catch(e){ return false; }
  }
  function now(){ return Date.now(); }
  function cooldownUntil(){ return Number(localStorage.getItem(COOLDOWN_KEY) || 0); }
  function setCooldown(ms = COOLDOWN_MS){
    try { localStorage.setItem(COOLDOWN_KEY, String(now() + ms)); } catch(e) {}
    document.body.classList.add('urbis-sheetdb-offline');
    window.dispatchEvent(new CustomEvent('urbis:sheetdb-offline', { detail:{ until: now()+ms } }));
  }
  function inCooldown(){
    return cooldownUntil() > now();
  }
  function cachedData(){
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch(e){ return []; }
  }
  function saveCache(data){
    try {
      if(Array.isArray(data)) localStorage.setItem(CACHE_KEY, JSON.stringify(data.slice(-1200)));
    } catch(e) {}
  }
  function queueWrite(url, options){
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      q.push({
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        url:String(url),
        method:String((options && options.method) || 'GET').toUpperCase(),
        body: options && options.body ? String(options.body).slice(0, 200000) : '',
        at:new Date().toISOString()
      });
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-80)));
    } catch(e){}
  }
  function responseJSON(data, status=200){
    return new Response(JSON.stringify(data), {
      status,
      headers:{ 'Content-Type':'application/json', 'X-URBIS-LOCAL-FALLBACK':'1' }
    });
  }
  function responseText(text, status=202){
    return new Response(text || 'URBIS local fallback', {
      status,
      headers:{ 'Content-Type':'text/plain', 'X-URBIS-LOCAL-FALLBACK':'1' }
    });
  }
  function showBanner(){
    if(document.getElementById('urbis-sheetdb-banner')) return;
    const div = document.createElement('div');
    div.id = 'urbis-sheetdb-banner';
    div.innerHTML = 'Modo local activo: SheetDB alcanzó el límite mensual. URBIS carga con caché y guarda cambios pendientes.';
    document.body.appendChild(div);
  }
  window.addEventListener('urbis:sheetdb-offline', showBanner);

  window.URBIS_SHEETDB_RESILIENCE = {
    isOffline: inCooldown,
    setCooldown,
    getCachedData: cachedData,
    saveCache,
    getPendingQueue(){
      try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
      catch(e){ return []; }
    },
    clearCooldown(){
      try { localStorage.removeItem(COOLDOWN_KEY); } catch(e){}
      document.body.classList.remove('urbis-sheetdb-offline');
    }
  };

  window.fetch = async function(input, options = {}){
    if(!isSheetDBUrl(input)) return REAL_FETCH(input, options);

    const method = String((options && options.method) || 'GET').toUpperCase();

    if(inCooldown()){
      document.body.classList.add('urbis-sheetdb-offline');
      if(method === 'GET') return responseJSON(cachedData(), 200);
      queueWrite(input, options);
      return responseText('Guardado localmente por límite de SheetDB', 202);
    }

    try{
      const res = await REAL_FETCH(input, options);

      if([402,403,429].includes(res.status)){
        setCooldown();
        if(method === 'GET') return responseJSON(cachedData(), 200);
        queueWrite(input, options);
        return responseText('Guardado localmente por límite de SheetDB', 202);
      }

      if(method === 'GET' && res.ok){
        try {
          const clone = res.clone();
          const data = await clone.json();
          if(Array.isArray(data)) saveCache(data);
        } catch(e){}
      }
      return res;
    }catch(error){
      setCooldown(10 * 60 * 1000);
      if(method === 'GET') return responseJSON(cachedData(), 200);
      queueWrite(input, options);
      return responseText('Guardado localmente por fallo de conexión', 202);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    if(inCooldown()){
      document.body.classList.add('urbis-sheetdb-offline');
      showBanner();
    }
  });
})();
