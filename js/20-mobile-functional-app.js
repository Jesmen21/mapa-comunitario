(function(){
  const app = document.getElementById('urbis-mobile-app');
  if(!app) return;

  const STORAGE_KEY = 'urbis_mobile_runner_history_v56';
  const AVATAR_KEY = 'urbis_mobile_avatar_skin_v65';
  const URBIS_AVATARS = [
    ...Array.from({length:10}, (_,i)=>({
      id: `avatar-${String(i+1).padStart(2,'0')}`,
      name: `Opción ${i+1}`,
      src: `assets/avatars/avatar-${String(i+1).padStart(2,'0')}.png`
    })),
    { id:'avatar-11', name:'Exploradora URBIS', src:'assets/avatars/avatar-11.png' },
    { id:'avatar-12', name:'Spartan URBIS', src:'assets/avatars/avatar-12.png' }
  ];
  let stack = ['login'];
  let selectedActivity = 'correr';
  let mobileRole = 'citizen';
  let runner = {
    active:false, paused:false, startAt:0, elapsed:0, totalM:0,
    last:null, points:[], watchId:null, timer:null, layers:[]
  };

  function loadHistory(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch(e){ return []; }
  }
  function saveHistory(items){
    const persistir = arr => localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-80)));
    try{ persistir(items); return true; }
    catch(e){
      // localStorage lleno (los puntos GPS pesan): adelgazar puntos (1 de cada 2)
      // y recortar el historial antes de rendirse — antes esto reventaba en
      // silencio y el recorrido se perdía sin ningún aviso.
      try{
        const liviano = items.slice(-40).map(it => Object.assign({}, it, { points: (it.points||[]).filter((_,i)=>i%2===0) }));
        persistir(liviano); return true;
      }catch(e2){
        alert('No se pudo guardar el recorrido: la memoria del navegador está llena. Elimina recorridos viejos en Progreso.');
        return false;
      }
    }
  }
  function historyStats(){
    const h = loadHistory();
    const totalKm = h.reduce((a,x)=>a+(Number(x.distanceKm)||0),0);
    const bestKm = h.reduce((a,x)=>Math.max(a, Number(x.distanceKm)||0),0);
    const bestPace = h.filter(x=>x.paceSecKm).reduce((a,x)=>Math.min(a, x.paceSecKm), Infinity);
    return {count:h.length,totalKm,bestKm,bestPace: isFinite(bestPace)?bestPace:null, latest:h[h.length-1]||null};
  }
  function fmtTime(sec){ sec=Math.max(0,Math.floor(sec||0)); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  function fmtPace(secKm){ if(!secKm || !isFinite(secKm)) return '--'; const m=Math.floor(secKm/60), s=Math.round(secKm%60); return `${m}:${String(s).padStart(2,'0')}`; }
  function esc(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function getSelectedAvatarId(){
    return localStorage.getItem(AVATAR_KEY) || '';
  }
  function getSelectedAvatar(){
    const saved = getSelectedAvatarId() || 'avatar-01';
    return URBIS_AVATARS.find(a=>a.id===saved) || URBIS_AVATARS[0];
  }
  // NUEVA METODOLOGÍA: el avatar es parte de la IDENTIDAD del usuario y se guarda en
  // el backend de Apps Script (columna 'avatar' en usuarios_registro), NO en SheetDB.
  // Apps Script escribe por nombre de columna => sin el bug de columnas corridas.
  // Luego viaja junto con los datos del amigo (social_get_friends / social_find_user).
  function urbisGuardarAvatarSheet(usuario, avatarId){
    try{
      avatarId = String(avatarId||'').trim();
      if(!avatarId) return;
      const s = socialSession() || {};
      const ident = s.user_id || s.friend_code || s.usuario || String(usuario||'') || s.cedula_numero || s.cedula || s.correo || '';
      if(!ident) return;
      if(typeof socialAPI === 'function'){
        socialAPI({ action:'set_avatar', user_id: s.user_id || '', identifier: ident, usuario: s.usuario || String(usuario||''), avatar: avatarId })
          .then(function(){ try{ if(typeof window.urbisRefrescarAvataresAmigos === 'function') window.urbisRefrescarAvataresAmigos(); }catch(e){} })
          .catch(function(){});
      }
    }catch(e){}
  }

  function setSelectedAvatar(id){
    const avatar = URBIS_AVATARS.find(a=>a.id===id) || URBIS_AVATARS[0];
    localStorage.setItem(AVATAR_KEY, avatar.id);
    refreshAvatarUI();
    if(mobileGps && mobileGps.last && mobileGps.marker) updateMobileGpsMarker(mobileGps.last, true);
    const s = socialSession();
    const usuario = (s && s.usuario) ? s.usuario : (typeof window.urbisUsuarioActual === 'function' ? window.urbisUsuarioActual() : '');
    urbisGuardarAvatarSheet(usuario, avatar.id);
    window.__urbisAvatarSynced = true;
  }
  function refreshAvatarUI(){
    const savedAvatarId = getSelectedAvatarId();
    const avatar = getSelectedAvatar();
    const avatarHtml = `<img src="${avatar.src}" alt="${esc(avatar.name)}">`;
    app?.querySelectorAll('[data-u65-current-avatar]').forEach(el=>{ el.innerHTML = avatarHtml; });
    app?.querySelectorAll('[data-u65-profile-icon-avatar]').forEach(el=>{
      if(savedAvatarId){
        el.classList.add('has-avatar');
        el.innerHTML = avatarHtml;
      }else{
        el.classList.remove('has-avatar');
        el.innerHTML = '<img src="assets/brand/topbar-profile-icon.png" alt="Perfil">';
      }
    });
    app?.querySelectorAll('[data-u65-avatar-choice]').forEach(btn=>btn.classList.toggle('active', btn.dataset.u65AvatarChoice===avatar.id));
  }
  function distM(a,b){
    if(!a||!b) return 0; const R=6371000, toRad=d=>d*Math.PI/180;
    const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
    const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  }


  // URBIS V58 · GPS activo sin bloquear el mapa móvil
  // Regla: el GPS actualiza el punto azul, pero NO recentra automáticamente si el usuario explora el mapa.
  const mobileGps = {
    watchId: null,
    marker: null,
    last: null,
    autoFollow: false,
    userExploringUntil: 0,
    lastCenterAt: 0,
    layer: null
  };
  const communityComposer = {
    pickMode: '',
    selected: null,
    overlay: null,
    bubble: null,
    title: null,
    mapReady: false,
    reportPanel: null,
    activeReportSection: 'vial',
    selectedAlertId: ''
  };
  // Estado propio de URBIS Pro City — INDEPENDIENTE de communityComposer para
  // no mezclar el flujo de reportes/eventos ciudadanos con el mapeo técnico.
  const proCity = { pickMode:'', selected:null, dim:'', active:false };
  // Las 13 dimensiones "técnicas" de `dimensiones` (js/04): vivienda, comercio,
  // equipamientos, deportivas, verdes, infraestructura, servicios ocultos,
  // salud, patrimonio, industria, animal, smart, oficinas. Whitelist EXPLÍCITA
  // para no arrastrar Alertas/Tráfico/Eventos/Desastres/Riesgos del Terreno
  // (que también viven en el mismo objeto `dimensiones`).
  const PRO_CITY_DIMS = [
    'Vivienda y Residencial', 'Comercio y Servicios', 'Grandes Equipamientos',
    'Áreas Deportivas', 'Áreas Verdes y Ambiental', 'Infraestructura y Peatonal',
    'Servicios Ocultos', 'Salud y Emergencias', 'Patrimonio y Turismo',
    'Industria y Logística', 'Animal y Bienestar', 'Infraestructura Smart',
    'Oficinas y Co-working', '🗺️ Matriz de Usos'
  ];
  // Lista AUTORITATIVA para que otros módulos (ej. "Mis reportes" en js/12)
  // puedan excluir lo georreferenciado en Pro City sin duplicar la lista a
  // mano. URBIS_TIPOS_AUTOMAPEO (js/12) es una lista MÁS VIEJA/INCOMPLETA
  // (le faltan Áreas Verdes, Salud y Emergencias, Animal y Bienestar,
  // Matriz de Usos) — esta es la que manda.
  window.urbisEsCategoriaProCity = function(tipo){ return PRO_CITY_DIMS.includes(String(tipo || '')); };
  window.__urbisMobileMapFreeMode = true;

  function isUserExploringMap(){ return Date.now() < mobileGps.userExploringUntil; }
  function pauseAutoFollow(reason='explorar'){
    mobileGps.autoFollow = false;
    mobileGps.userExploringUntil = Date.now() + 15000;
    if(reason) setMobilityStatus(`Mapa libre · GPS activo`);
    document.body.classList.add('u58-map-free');
  }
  function enableMobileMapGestures(){
    try{
      // `map` es el const global (js/03); NO depender de window.map (que a veces no está seteado).
      if(typeof map === 'undefined' || !map) return;
      map.dragging && map.dragging.enable();
      map.touchZoom && map.touchZoom.enable();
      map.doubleClickZoom && map.doubleClickZoom.enable();
      map.scrollWheelZoom && map.scrollWheelZoom.enable();
      map.boxZoom && map.boxZoom.enable();
      map.keyboard && map.keyboard.enable();
      map.tap && map.tap.enable && map.tap.enable();
      map.options.tap = true;
      map.options.touchZoom = true;
      map.options.dragging = true;
      map.options.bounceAtZoomLimits = true;
      const c = map.getContainer && map.getContainer();
      if(c){
        // touch-action:none (con prioridad) => Leaflet recibe el arrastre/pellizco en iOS.
        c.style.setProperty('touch-action', 'none', 'important');
        c.style.pointerEvents = 'auto';
        if(!c.dataset.urbisMobileTouchInit){
          c.dataset.urbisMobileTouchInit = '1';
          ['touchstart','pointerdown','mousedown','wheel'].forEach(evt=>{
            c.addEventListener(evt, () => pauseAutoFollow(''), {passive:true});
          });
        }
      }
      if(!map._urbisMobileMapEvents){
        map._urbisMobileMapEvents = true;
        map.on('dragstart zoomstart movestart', () => pauseAutoFollow(''));
      }
    }catch(e){ console.warn('No se pudieron habilitar gestos de mapa móvil', e); }
  }
  function ensureMobileGpsLayer(){
    try{
      if(!window.L || !window.map) return null;
      if(!mobileGps.layer) mobileGps.layer = L.layerGroup().addTo(map);
      return mobileGps.layer;
    }catch(e){ return null; }
  }
  function updateMobileGpsMarker(point, forceIcon=false){
    try{
      const layer = ensureMobileGpsLayer();
      if(!layer || !window.L) return;
      const latlng = [point.lat, point.lng];
      const avatar = getSelectedAvatar();
      const icon = L.divIcon({
        className:'',
        html:`<div class="u65-gps-avatar-marker"><img src="${avatar.src}" alt="${esc(avatar.name)}"><span></span></div>`,
        iconSize:[91,101],
        iconAnchor:[46,78]
      });
      if(!mobileGps.marker){
        mobileGps.marker = L.marker(latlng, {
          interactive:false,
          zIndexOffset: 1800,
          icon
        }).addTo(layer);
      } else {
        if(forceIcon) mobileGps.marker.setIcon(icon);
        mobileGps.marker.setLatLng(latlng);
      }
    }catch(e){}
  }
  function centerOnMobileGps(forceZoom=false){
    if(!mobileGps.last || !window.map) return;
    try{
      mobileGps.autoFollow = true;
      mobileGps.userExploringUntil = 0;
      document.body.classList.remove('u58-map-free');
      const z = forceZoom ? Math.max(map.getZoom() || 16, 16) : (map.getZoom() || 16);
      map.setView([mobileGps.last.lat, mobileGps.last.lng], z, {animate:true});
      mobileGps.lastCenterAt = Date.now();
      setMobilityStatus(`Ubicación centrada · GPS activo`);
      setTimeout(()=>{ mobileGps.autoFollow = false; }, 9000);
    }catch(e){}
  }
  function onMobileGpsPoint(pos){
    if((pos.coords.accuracy || 0) > 50) return; // ignorar lecturas con error > 50 m
    const point = {lat:pos.coords.latitude, lng:pos.coords.longitude, accuracy:pos.coords.accuracy||0, t:Date.now()};
    mobileGps.last = point;
    window.urbisMobileLastGPS = point;
    updateMobileGpsMarker(point);
    const accuracy = Math.round(point.accuracy || 0);
    const status = accuracy ? `GPS activo · ${accuracy} m` : 'GPS activo';
    const statusEl = app.querySelector('#u56-mobility-status');
    if(statusEl && !isUserExploringMap()) statusEl.innerHTML = status;
    if(mobileGps.autoFollow && !isUserExploringMap() && Date.now() - mobileGps.lastCenterAt > 1800){
      try{ map.panTo([point.lat, point.lng], {animate:true, duration:.55}); mobileGps.lastCenterAt = Date.now(); }catch(e){}
    }
  }
  function startMobileGpsWatch(){
    enableMobileMapGestures();
    if(mobileGps.watchId !== null || !navigator.geolocation) return;
    mobileGps.watchId = navigator.geolocation.watchPosition(onMobileGpsPoint, err=>{
      console.warn('GPS móvil no disponible', err);
      setMobilityStatus('Activa permisos de ubicación.');
    }, {enableHighAccuracy:true, maximumAge:500, timeout:12000});
  }

  app.innerHTML = `
    
    <section class="u52-screen active" data-u52-screen="login">
      <div class="u52-auth-mobile-wrap u52-auth-welcome-figma" aria-label="Acceso inicial URBIS">
        <div class="u52-auth-welcome-illustration" style="background-image:url('assets/brand/welcome-illustration.jpg')" aria-hidden="true"></div>

        <header class="u52-auth-hero u52-auth-hero-figma">
          <img src="assets/brand/urbis-logo.png" alt="Logo URBIS" class="u52-auth-logo-img-figma">
          <strong class="u52-auth-wordmark-figma">URBIS</strong>
          <p class="u52-auth-tagline-figma">
            <span>Conecta <b>tu ciudad.</b></span>
            <span>Transforma <b>tu territorio.</b></span>
          </p>
        </header>

        <div class="u52-auth-actions-figma" role="group" aria-label="Acceso de usuario URBIS">
          <button class="u52-auth-pill-btn primary" data-u52-auth-open="register" type="button">
            <span>Comenzar</span>
            <i aria-hidden="true">›</i>
          </button>
          <button class="u52-auth-pill-btn secondary" data-u52-auth-open="login" type="button">
            <span>Iniciar sesión</span>
            <i aria-hidden="true">›</i>
          </button>
        </div>
      </div>
    </section>

    <section class="u52-screen u52-auth-login-screen" data-u52-screen="auth-login">
      <div class="u52-kawaii-login-wrap" aria-label="Inicio de sesión URBIS">
        <button class="u52-kawaii-back" data-u52-auth-back type="button">← Volver</button>

        <header class="u52-kawaii-login-hero">
          <div class="u52-kawaii-login-wordmark">URBIS</div>
          <div class="u52-kawaii-login-slogan">MOVILIDAD • CONECTIVIDAD • FUTURO</div>
          <p>¡Nos alegra tenerte de vuelta!<br>Ingresa para continuar en URBIS 💙</p>
        </header>

        <section class="u52-kawaii-login-card">
          <label class="u52-kawaii-field">
            <span>Usuario o cédula</span>
            <div class="u52-kawaii-input user">
              <i aria-hidden="true">👤</i>
              <input id="mobile-login-username" type="text" placeholder="Ingresa tu usuario o cédula" autocomplete="username" enterkeyhint="next">
            </div>
            <small class="u52-login-field-help">Puedes entrar con tu nombre de usuario o con tu número de cédula.</small>
          </label>

          <label class="u52-kawaii-field password">
            <span>Contraseña</span>
            <div class="u52-kawaii-input pass has-eye">
              <i aria-hidden="true">🔒</i>
              <input id="mobile-login-password" type="password" placeholder="Ingresa tu contraseña" autocomplete="current-password" enterkeyhint="done">
              <button type="button" class="u52-login-eye" data-urbis-password-toggle="mobile-login-password" aria-label="Mostrar contraseña" aria-pressed="false">👁️</button>
            </div>
          </label>

          <button id="mobile-urbis-login-btn" class="u52-kawaii-login-submit" data-u52-auth-login-submit type="button">Ingresar</button>
          <button class="u52-kawaii-forgot" data-u52-auth-forgot type="button">¿Olvidaste tu contraseña?</button>
        </section>
      </div>
    </section>


    
    <section class="u52-screen" data-u52-screen="home">
      <header class="u52-k-home-topbar">
        <button class="u52-k-home-pill profile" data-u52-go="profile" aria-label="Ir a perfil">
          <span class="u52-k-home-icon-shell u52-k-profile-avatar-shell" data-u65-profile-icon-avatar><img src="assets/brand/topbar-profile-icon.png" alt="Perfil"></span>
          <small>Perfil</small>
        </button>
        <div class="u52-k-home-brand" aria-label="Identidad de usuario URBIS">
          <span>
            <b>URBIS</b>
            <small id="u52-role-label">Ciudadano</small>
          </span>
        </div>
        <button class="u52-k-home-pill notify" data-u52-go="notifications" aria-label="Ir a notificaciones">
          <span class="u52-k-home-icon-shell u52-noti-icon-wrap"><img src="assets/brand/topbar-bell-icon.png" alt="Notificaciones" class="u52-k-home-icon-img"><i id="u52-noti-badge" class="u52-noti-badge" hidden>0</i></span>
          <small>Noti</small>
        </button>
      </header>
      <main class="u52-content u52-k-home-content">
        <div class="u52-k-home-hero u52-home-hero-cute">
          <div class="u52-home-hero-copy">
            <span class="u52-home-hero-kicker">👋 ¡Hola!</span>
            <h1>¿Qué hacemos hoy?</h1>
            <div class="u52-hero-carousel">
              <button type="button" class="u52-hero-nav prev" data-u52-call="hero-msg-prev" aria-label="Mensaje anterior">‹</button>
              <p class="u52-hero-msg" id="u52-hero-msg"></p>
              <button type="button" class="u52-hero-nav next" data-u52-call="hero-msg-next" aria-label="Mensaje siguiente">›</button>
            </div>
          </div>
          <div class="u52-home-hero-spark" aria-hidden="true">✨</div>
        </div>

        <div class="u52-k-section-label mint">✦ Módulos principales</div>
        <div class="u52-grid u52-grid-primary u52-k-home-grid-primary u52-jac-main-grid">
          <button class="u52-module map u52-jac-module" data-u52-go="map"><span><img src="assets/icons/urbis-map.png" alt="Reportar"></span><b>Reportar</b><small>Mapa y alertas en vivo</small></button>
          <button class="u52-module events u52-jac-module" data-u52-go="events"><span><img src="assets/icons/urbis-events.svg" alt="Eventos"></span><b>Eventos</b><small>Disponibles</small></button>
          <button class="u52-module social u52-jac-module" data-u52-go="social"><span><img src="assets/brand/social.png" alt="Social URBIS"></span><b>Social</b><small>Comunidad</small></button>
          <button class="u52-module games u52-jac-module" data-u52-go="games"><span class="u52-games-ico">🎮</span><b>Minijuegos</b><small>Juega y gana</small></button>
          <button class="u52-module sport u52-jac-module" data-u52-go="sport"><span><img src="assets/icons/urbis-runner.png" alt="URBIS Rush"></span><b>URBIS Rush</b><small>Corre y compite</small></button>
        </div>

        <div class="u52-k-section-label sky">✦ Módulo UrbisProCity</div>
        <div class="u52-grid u52-grid-secondary u52-k-home-grid-secondary u52-jac-dev-grid" aria-label="Módulo UrbisProCity">
          <button class="u52-module procity u52-premium-module" data-u52-call="procity-open-map"><span class="u52-procity-home-ico">🏙️</span><b>Pro City</b><small>Mapeo profesional</small></button>
          <button class="u52-module aia u52-premium-module" id="u52-aia-module" hidden onclick="location.href='analisis-ia.html'"><span class="u52-procity-home-ico">🤖</span><b>Análisis IA</b><small>Implantación territorial</small></button>
        </div>

        <div class="u52-k-section-label lilac">✦ Apps en desarrollo</div>
        <div class="u52-grid u52-grid-secondary u52-k-home-grid-secondary u52-jac-dev-grid" aria-label="Apps en desarrollo URBIS">
          <button class="u52-module mascotas u52-dev-module" data-u52-go="mascotas"><span class="u52-mascotas-ico">🐾</span><b>Mascotas</b><small>Próximamente</small></button>
          <button class="u52-module mobility u52-dev-module" data-u52-go="mobility"><span>🚗</span><b>Movilidad</b><small>Próximamente</small></button>
        </div>
        <!-- "Noti" y "Perfil" se quitaron de aquí (pedido explícito): ya viven
             arriba a la derecha (campana) y abajo a la derecha (avatar) del
             inicio, así que repetirlos en "Apps en desarrollo" era relleno
             duplicado. -->


      </main>
    </section>


    <section class="u52-screen map-screen" data-u52-screen="mobility">
      <header class="u52-topbar u52-touch"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Movilidad</h2><button class="u52-icon-btn" data-u52-call="locate">⌖</button></header>
      <div class="u52-map-actions u52-map-actions-clean" hidden aria-hidden="true"></div>
      <div class="u52-sheet u52-mobility-sheet"><div class="u52-sheet-row"><div><b>Guía de ruta</b><br><span>Elige destino y transporte</span></div><span class="u52-pill-blue">Movilidad</span></div><div id="u56-mobility-status" class="u56-mobility-status">GPS activo. Muévete libremente por el mapa y toca “Elegir destino”.</div><div class="u57-transport-row" aria-label="Modo de movilidad"><button class="active" data-u52-transport="car">🚗<small>Carro</small></button><button data-u52-transport="motorcycle">🏍️<small>Moto</small></button><button data-u52-transport="bike">🚲<small>Bici</small></button><button data-u52-transport="walking">🚶<small>A pie</small></button><button data-u52-transport="bus">🚌<small>Bus</small></button></div><div class="u52-two"><button class="u52-secondary" data-u52-call="choose-destination">Elegir destino</button><button class="u52-primary blue" data-u52-call="start-route">Iniciar ruta</button></div></div>
    </section>

    <section class="u52-screen map-screen u52-jac-map-screen u52-jac-mapcentric" data-u52-screen="map">
      <header class="u52-mapcentric-topbar" aria-label="Crear reporte o evento URBIS">
        <button class="u52-mapcentric-round" data-u52-back aria-label="Volver">←</button>
        <div class="u52-mapcentric-title">
          <b>Reporte o evento</b>
          <small>Toca el mapa para ubicarlo</small>
        </div>
        <button class="u52-mapcentric-filter u52-procity-filter-btn" data-u52-call="procity-filter-open" aria-label="Filtrar matriz de usos" hidden>🔷</button>
        <button class="u52-mapcentric-filter u52-cfilter-btn" data-u52-call="cfilter-open" aria-label="Filtrar reportes y eventos">🎚️</button>
        <button class="u52-mapcentric-filter" data-u52-call="locate" aria-label="Centrar en mi ubicación GPS">◎</button>
      </header>
      <button class="u52-mapcentric-locate" data-u52-call="locate" aria-label="Centrar mi ubicación">⌖</button>
      <button class="u52-procity-visual-toggle" data-u52-call="procity-visual-toggle" aria-label="Cambiar entre íconos y colores por categoría" hidden>😀</button>
      <button class="u52-procity-active-folder-btn" data-u52-call="procity-active-folder-open" aria-label="Elegir carpeta cooperativa activa para mapear" hidden>📁</button>
      <button class="u52-procity-view-filter-btn" data-u52-call="procity-view-filter-open" aria-label="Elegir qué se ve en el mapa" hidden>👁️</button>
      <button class="u52-procity-dibujar-btn" data-u52-call="pca-dibujar" aria-label="Dibujar área de análisis" hidden>✏️</button>
      <div id="u52-map-report-status" class="u52-map-report-status u52-mapcentric-toast" aria-live="polite"></div>
      <div class="u52-mapcentric-actions" aria-label="Acciones rápidas de mapeo comunitario">
        <button data-u52-call="report-gps"><span class="gps">⌖</span><b>Reporte con<br>mi ubicación</b></button>
        <button data-u52-call="report-manual"><span class="manual">☝</span><b>En mapa</b></button>
        <button data-u52-call="layers"><span class="layers">▰</span><b>Capas</b></button>
      </div>
    </section>

    <section class="u52-screen map-screen" data-u52-screen="nav">
      <div class="u52-nav-card u61-nav-card-clean"><div><small>Movilidad</small><b>Ruta activa</b><span id="u52-route-state">El recorrido se actualiza con tu GPS.</span></div></div>
      <div class="u52-sheet"><div class="u52-sheet-row"><b>Navegación</b><span>GPS guía</span></div><button class="u52-danger" data-u52-call="finish-route">Finalizar recorrido</button></div>
    </section>

    <section class="u52-screen rush-home-screen" data-u52-screen="sport">
      <header class="u52-topbar rush-home-top"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">URBIS Rush</h2><span class="u52-icon-btn" style="visibility:hidden">·</span></header>
      <main class="u52-content rush-home">
        <div class="rush-home-hero">
          <div class="rush-home-emoji">🏃‍♂️💨</div>
          <div class="rush-home-hero-copy">
            <h1>¡A moverte!</h1>
            <p>Elige tu actividad y URBIS Rush rastrea tu recorrido en vivo.</p>
          </div>
        </div>
        <div class="rush-home-stats" id="rush-home-stats">
          <div class="rush-home-stat"><b>0</b><span>actividades</span></div>
          <div class="rush-home-stat"><b>0.0</b><span>km totales</span></div>
          <div class="rush-home-stat"><b>--</b><span>mejor /km</span></div>
        </div>
        <div class="rush-home-label">Elige tu actividad</div>
        <div class="u52-activity-grid rush-acts">
          <button class="u52-activity rush-act active" data-u52-activity="correr"><span class="rush-act-ic">⚡</span><b>Correr</b></button>
          <button class="u52-activity rush-act" data-u52-activity="ciclismo"><span class="rush-act-ic">🚲</span><b>Ciclismo</b></button>
          <button class="u52-activity rush-act" data-u52-activity="caminar"><span class="rush-act-ic">👣</span><b>Caminar</b></button>
          <button class="u52-activity rush-act" data-u52-activity="senderismo"><span class="rush-act-ic">⛰️</span><b>Senderismo</b></button>
        </div>
        <button class="rush-home-start" data-u52-call="start-runner">▶ Iniciar actividad</button>
        <div class="rush-home-last" id="u52-sport-state"><img class="rush-pin-ico" src="assets/brand/llegada.png" alt=""><div><b>Todavía no has iniciado actividades</b><small>Tu recorrido aparecerá aquí.</small></div></div>
      </main>
    </section>

    <section class="u52-screen map-screen rush-live-screen" data-u52-screen="runner-live">
      <div class="rush-live-top">
        <button class="rush-live-pill" data-u52-call="stop-runner" aria-label="Volver">←</button>
        <div class="rush-live-clock"><b id="u52-time">00:00</b></div>
        <span class="rush-live-gps" id="u52-gps-status">● GPS</span>
      </div>
      <div class="rush-live-hud">
        <div class="rush-live-metric main"><b id="u52-distance">0.00</b><span>km</span></div>
        <div class="rush-live-metric"><b id="u52-pace">--</b><span>/km</span></div>
        <div class="rush-live-metric"><b id="u52-speed">0.0</b><span>km/h</span></div>
        <div class="rush-live-metric"><b id="u52-points">0</b><span>gps</span></div>
      </div>
      <div class="rush-live-controls">
        <button class="rush-ctrl pause" data-u52-call="pause-runner" aria-label="Pausar / reanudar">❚❚</button>
        <button class="rush-ctrl report" data-u52-call="rush-report-live" aria-label="Reportar algo en el camino sin detener tu actividad">📢</button>
        <button class="rush-ctrl finish" data-u52-call="stop-runner">Finalizar</button>
      </div>
    </section>

    <section class="u52-screen" data-u52-screen="runner-summary">
      <header class="u52-topbar"><button class="u52-icon-btn" data-u52-go="sport">←</button><h2 class="u52-title">URBIS Rush</h2><button class="u52-icon-btn" onclick="window.urbisRunnerTarjeta&&window.urbisRunnerTarjeta()" aria-label="Compartir">↗</button></header>
      <main class="u52-content rush-summary">
        <div class="rush-summary-card">
          <canvas id="u52-route-preview" class="rush-route-canvas" width="660" height="420"></canvas>
          <div class="rush-summary-head"><span class="rush-kicker" id="u52-summary-type">URBIS Rush</span><h1>¡Actividad lista! 🔥</h1></div>
          <div class="rush-stat-grid">
            <div class="rush-stat"><b id="u52-summary-distance">0.00</b><span>km</span></div>
            <div class="rush-stat"><b id="u52-summary-time">00:00</b><span>tiempo</span></div>
            <div class="rush-stat"><b id="u52-summary-pace">--</b><span>ritmo /km</span></div>
          </div>
          <canvas id="rush-summary-chart" class="rush-pace-chart" width="660" height="240"></canvas>
          <div id="rush-summary-splits" class="rush-splits-wrap"></div>
          <div class="rush-actions">
            <button class="rush-btn replay" onclick="window.urbisRunnerReplay&&window.urbisRunnerReplay()">▶ Ver recorrido</button>
            <button class="rush-btn card" onclick="window.urbisRunnerTarjeta&&window.urbisRunnerTarjeta()">📸 Crear foto</button>
          </div>
          <button class="rush-btn trim" onclick="window.urbisRunnerRecortar&&window.urbisRunnerRecortar()">✂️ Recortar recorrido (quitar moto/carro)</button>
          <button class="rush-btn social" data-u52-call="rush-publicar">🌍 Publicar en Social Rush</button>
          <button class="u52-primary rush-save" data-u52-call="save-runner">Guardar actividad</button>
        </div>
      </main>
    </section>

    <section class="u52-screen" data-u52-screen="social"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Social</h2><button class="u52-icon-btn" onclick="window.urbisAbrirBandejaChats&&window.urbisAbrirBandejaChats()" aria-label="Mensajes" style="position:relative;">💬<i data-urbis-chat-badge hidden style="position:absolute;top:-3px;right:-3px;background:#ef4444;color:#fff;font-size:.6rem;font-weight:800;min-width:16px;height:16px;border-radius:999px;align-items:center;justify-content:center;padding:0 4px;display:none;">0</i></button><button class="u52-icon-btn" data-u52-go="map">🗺️</button></header><main class="u52-content"><div class="u52-hero"><h1>Amigos URBIS</h1><p>Busca personas registradas por usuario, cédula o ID URBIS.</p></div><div class="u52-card u52-social-card u52-social-my-card"><span><img src="assets/brand/social.png" alt="Social URBIS"></span><div><b>Tu ID URBIS privado</b><small>Compártelo solo con personas que quieras agregar.</small><code id="u52-social-my-code">Cargando...</code></div><button type="button" data-u52-social-copy-id>Copiar</button></div><div class="u52-card u52-social-search-card"><label><b>Agregar amigo</b><small>Escribe un usuario, una cédula o un ID URBIS de 8 caracteres.</small><input id="u52-social-search-input" type="text" placeholder="Ej: usuario_amigo, cédula o ZX4M8PQL" autocomplete="off"></label><button type="button" class="u52-primary green" data-u52-social-search>Buscar usuario</button><div id="u52-social-result" class="u52-social-result"></div></div><div class="u52-empty-card"><span>🔐</span><div><b>Privacidad primero</b><small>Nadie verá tu ubicación sin permiso. Por ahora solo se crea la solicitud de amistad.</small></div></div><div class="u52-amigos-card"><div class="u52-amigos-topbar"><b>👥 Mis amigos</b><button type="button" data-u52-call="ver-contactos-mapa">🗺️ Ver en mapa</button></div><div id="u52-contactos-lista"><div class="amigo-empty"><span>👥</span><span>Aún no tienes amigos en URBIS.</span></div></div></div></main></section>

    <section class="u52-screen" data-u52-screen="progress"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Mis recorridos</h2><button class="u52-icon-btn">📅</button></header><main class="u52-content" id="u52-progress-content"></main></section>

    <section class="u52-screen" data-u52-screen="rush-social"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">🌍 Social Rush</h2><button class="u52-icon-btn" data-u52-call="rushsocial-refresh" aria-label="Actualizar">↻</button></header><main class="u52-content" id="u52-rushsocial-content"><div class="u52-empty-card"><span>🌍</span><div><b>Cargando Social Rush…</b><small>Recorridos publicados por la comunidad.</small></div></div></main></section>

    <section class="u52-screen" data-u52-screen="notifications"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Noti</h2><button class="u52-icon-btn" data-u52-noti-refresh>↻</button></header><main class="u52-content"><div class="u52-hero"><h1>Notificaciones</h1><p>Solicitudes de amistad y avisos importantes de URBIS.</p></div><div id="u52-noti-list" class="u52-noti-list"><div class="u52-empty-card"><span>🔔</span><div><b>Sin notificaciones</b><small>Cuando recibas solicitudes o avisos aparecerán aquí.</small></div></div></div></main></section>

    <section class="u52-screen" data-u52-screen="alerts"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Alertas</h2><button class="u52-icon-btn" data-u52-go="map">🗺️</button></header><main class="u52-content"><div class="u52-empty-card"><span>⚠️</span><div><b>Sin reportes recientes</b><small>Consulta el mapa o reporta.</small></div><button data-u52-go="map">Mapa</button></div><button class="u52-primary green" data-u52-call="open-report">Nuevo reporte</button></main></section>

    <section class="u52-screen" data-u52-screen="events"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Eventos</h2><button class="u52-icon-btn" data-u52-call="eventos-refresh" aria-label="Actualizar">↻</button></header><main class="u52-content" id="u52-eventos-content"><div class="u52-empty-card"><span>📅</span><div><b>Cargando eventos…</b><small>Eventos de la comunidad.</small></div></div></main></section>

    <section class="u52-screen" data-u52-screen="mascotas"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">🐾 Mascotas</h2><span class="u52-icon-btn" style="visibility:hidden">·</span></header><main class="u52-content" id="mascotas-root-mobile"><div class="u52-empty-card"><span>🐾</span><div><b>Cargando Patitas URBIS…</b><small>Fundación de perritos y gaticos.</small></div></div></main></section>

    <section class="u52-screen u52-games-screen" data-u52-screen="games"><header class="u52-topbar u52-games-top"><button class="u52-games-back" data-u52-back aria-label="Volver">◄</button><h2 class="u52-title">🎮 URBIS Arcade</h2><span class="u52-games-spacer"></span></header><main class="u52-content" id="u52-games-content"><div class="ug-empty">Cargando arcade…</div></main></section>

    <section class="u52-screen u52-aurea-screen" data-u52-screen="aurea"><header class="u52-topbar u52-aurea-top"><button class="u52-aurea-back" data-u52-back aria-label="Volver">◄</button><h2 class="u52-title">✨ Áurea Premium</h2><span class="u52-aurea-spacer"></span></header><main class="u52-content" id="u52-aurea-content"><div class="ah-empty">Cargando evento premium…</div></main></section>

    <section class="u52-screen" data-u52-screen="timeline"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Mis reportes</h2><button class="u52-icon-btn" data-u52-call="timeline-refresh" aria-label="Actualizar">↻</button></header><main class="u52-content" id="u52-timeline-content"><div class="u52-empty-card"><span>🕒</span><div><b>Cargando tus reportes…</b><small>Aquí verás todo lo que has reportado.</small></div></div></main></section>

    <section class="u52-screen" data-u52-screen="mis-eventos"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Mis eventos</h2><button class="u52-icon-btn" data-u52-call="miseventos-refresh" aria-label="Actualizar">↻</button></header><main class="u52-content" id="u52-miseventos-content"><div class="u52-empty-card"><span>🎪</span><div><b>Cargando tus eventos…</b><small>Aquí verás los eventos que has creado, incluso los ya finalizados.</small></div></div></main></section>

    <section class="u52-screen" data-u52-screen="profile"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Perfil</h2><span class="u52-icon-btn" style="visibility:hidden">·</span></header><main class="u52-content"><div class="u52-card u52-profile-card"><div class="u65-profile-avatar" data-u65-current-avatar></div><h1 id="u52-profile-name">Usuario URBIS</h1><div id="u52-profile-username" class="u52-profile-username">@usuario</div><p id="u52-profile-role">Configura tu perfil</p><button class="u52-secondary u65-avatar-open u65-avatar-open-pulse" data-u52-go="avatar">🎨 Elegir avatar</button></div><div class="u52-card u52-profile-id-card"><span class="u52-profile-id-icon">🪪</span><div><b>ID URBIS privado</b><small>Compártelo para que te agreguen sin dar tu cédula ni correo.</small><code id="u52-profile-friend-code">Cargando...</code></div><button type="button" class="u52-profile-copy-id" data-u52-profile-copy-id aria-label="Copiar ID URBIS"><span>⧉</span><small>Copiar</small></button></div><div class="u52-empty-card"><span>🏆</span><div><b>No tienes logros aún</b><small>Completa actividades reales.</small></div></div><div class="u52-empty-card"><span>📋</span><div><b>Sin reportes guardados</b><small>Los reportes validados aparecerán aquí.</small></div></div><button class="u52-profile-logout" data-u52-call="logout-session" type="button"><span>🚪</span><div><b>Cerrar sesión</b><small>Salir de URBIS en este dispositivo</small></div></button></main></section>

    <section class="u52-screen" data-u52-screen="avatar"><header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button><h2 class="u52-title">Avatar GPS</h2><span class="u52-icon-btn" style="visibility:hidden">·</span></header><main class="u52-content"><div class="u52-hero"><h1>Elige tu skin</h1><p>Se verá sobre tu ubicación.</p></div><div class="u65-avatar-preview"><div data-u65-current-avatar></div><span>Avatar activo</span></div><div class="u65-avatar-grid">${URBIS_AVATARS.map(a=>`<button class="u65-avatar-card" data-u65-avatar-choice="${a.id}"><img src="${a.src}" alt="${a.name}"><small>${a.name}</small></button>`).join('')}</div></main></section>

    <nav class="u52-bottom-nav u52-bottom-nav-png u52-jac-bottom-nav" aria-label="Navegación inferior móvil">
      <button class="active" data-u52-go="home"><img class="u52-bottom-icon-img u52-bottom-icon-home" src="assets/icons/urbis-home.png" alt="Inicio"><span>Inicio</span></button>
      <button data-u52-go="map"><img class="u52-bottom-icon-img u52-bottom-icon-map" src="assets/icons/urbis-map.png" alt="Reportar"><span>Reportar</span></button>
      <button class="plus" data-u52-call="open-report" aria-label="Generar reporte">＋</button>
      <button data-u52-go="timeline" aria-label="Mis reportes"><span class="u52-bottom-icon-clock" aria-hidden="true">🕒</span><span>Mis reportes</span></button>
      <button data-u52-go="profile" class="u52-nav-profile-avatar-btn"><span class="u52-bottom-avatar" data-u65-profile-icon-avatar><img src="assets/brand/topbar-profile-icon.png" alt="Perfil"></span><span>Perfil</span></button>
    </nav>

    <nav class="u52-bottom-nav u52-bottom-nav-png u52-jac-bottom-nav u52-rush-nav" aria-label="Navegación URBIS Rush" hidden>
      <button data-u52-go="sport"><span class="rush-nav-ico" aria-hidden="true">⚡</span><span>Rush</span></button>
      <button data-u52-go="progress"><span class="rush-nav-ico" aria-hidden="true">🏃</span><span>Mis recorridos</span></button>
      <button class="plus rush-plus" data-u52-call="report-gps" aria-label="Generar reporte">＋</button>
      <button data-u52-go="rush-social"><span class="rush-nav-ico" aria-hidden="true">🌍</span><span>Social Rush</span></button>
      <button data-u52-go="profile" class="u52-nav-profile-avatar-btn"><span class="u52-bottom-avatar" data-u65-profile-icon-avatar><img src="assets/brand/topbar-profile-icon.png" alt="Perfil"></span><span>Perfil</span></button>
    </nav>

    <nav class="u52-bottom-nav u52-bottom-nav-png u52-jac-bottom-nav u52-procity-nav" aria-label="Navegación URBIS Pro City" hidden>
      <button data-u52-call="procity-loc-gps" aria-label="Ubicar con mi ubicación GPS"><span class="procity-nav-ico" aria-hidden="true">⌖</span><span>Mi ubicación</span></button>
      <button data-u52-call="procity-loc-manual" aria-label="Ubicar tocando el mapa"><span class="procity-nav-ico" aria-hidden="true">☝</span><span>En el mapa</span></button>
      <button class="plus procity-plus" data-u52-call="procity-category-open" aria-label="Elegir categoría">🏙️</button>
      <button data-u52-call="layers" aria-label="Cambiar tipo de mapa"><span class="procity-nav-ico" aria-hidden="true">🛰️</span><span>Mapa</span></button>
      <button data-u52-call="procity-stats-open" aria-label="Ver estadísticas de mapeo"><span class="procity-nav-ico" aria-hidden="true">📊</span><span>Mapeado</span></button>
    </nav>

    <div class="u52-layer-sheet u52-basemap-sheet" id="u52-layer-sheet" hidden>
      <button class="u52-layer-close" data-u52-call="layers-close">×</button>
      <h2>Tipo de mapa</h2>
      <p class="u52-basemap-hint">Elige cómo se ve el mapa base.</p>
      <div class="u52-basemap-grid" id="u52-basemap-grid"></div>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════════════
  // Tarjeta de bienvenida "¿Qué hacemos hoy?" — carrusel de mensajes sobre
  // qué es URBIS, su misión/visión, y el espíritu de cooperación y cuidado
  // mutuo entre vecinos. Pedido explícito: rotación automática, flechas
  // sutiles para navegar manualmente, y un toque de color pastel distinto
  // por mensaje. Sin nombrar ninguna ciudad específica (para que cualquier
  // usuario, de cualquier lugar, se sienta identificado).
  // ═══════════════════════════════════════════════════════════════════════
  const URBIS_HERO_MESSAGES = [
    '🌱 Somos una app hecha por y para la comunidad — cada reporte tuyo hace crecer una ciudad mejor.',
    '🤝 Juntos vemos lo que antes nadie veía. Tu voz, sumada a la de tu barrio, mueve montañas.',
    '🏙️ URBIS es el mapa vivo de tu ciudad: lo que reportas hoy ayuda a decidir mejor mañana.',
    '💚 Nuestra misión: darle a cada vecino una forma fácil y real de mejorar su entorno.',
    '✨ Nuestra visión: una ciudad donde cada problema se ve, se atiende y se resuelve más rápido.',
    '🚨 Cada alerta que publicas es un cuidado que le regalas a otro vecino — así nos protegemos entre todos.',
    '🛡️ Avisar a tiempo también es ayudar: tu reporte puede evitar que alguien más pase por lo mismo.',
    '🧑‍🤝‍🧑 No estás solo reportando — estás construyendo comunidad, un punto en el mapa a la vez.',
    '🕊️ Aquí no hay extraños, hay vecinos cuidándose los unos a los otros.',
    '🫶 De la mano de la ciudadanía, la JAC y quien quiera ayudar: así se construye una URBIS mejor.',
    '🎉 Reportar también puede ser divertido — gana, participa y sé parte del cambio.',
    '👁️ Reportar situaciones de riesgo no es señalar a nadie: es avisar a tu comunidad para tomar precauciones en esa zona.',
    '🚔 Tus reportes también hablan por la ciudad: ayudan a que la policía y otras autoridades sepan qué sectores necesitan más atención.',
    '🔦 La información pública ilumina zonas que antes quedaban en la sombra — así todos, incluidas las autoridades, pueden actuar mejor.',
    '📊 Entre más reportamos, más real es el retrato de nuestra ciudad: información ciudadana transparente, difícil de manipular u ocultar.',
    '🗳️ Los datos no tienen partido: cada reporte es un hecho verificable, no una opinión.',
    '🏛️ La transparencia no es un favor, es un derecho — y cada reporte ciudadano la hace más fuerte.',
    '🔐 Una ciudad bien informada es una ciudad más difícil de engañar.',
    '📢 Cuando muchos vecinos reportan lo mismo, la información se vuelve imposible de ignorar.',
    '⚖️ Los hechos reportados por la comunidad pesan más que cualquier discurso.',
    '🌊 Un reporte es una gota. Miles de reportes son una ola que nadie puede detener.',
    '🔊 Solos nos pueden ignorar. Juntos, nos tienen que escuchar.',
    '🧩 Cada reporte es una pieza pequeña — juntas, arman un mapa que nadie puede negar.',
    '🐜 Como un hormiguero: cada quien aporta un poquito, y entre todos movemos lo que parecía imposible.',
    '💪 La fuerza de URBIS no es un algoritmo — somos nosotros, reportando juntos.',
    '🗿 "Quien no puede recordar el pasado está condenado a repetirlo." — George Santayana',
    '🗿 "Un pueblo ignorante es instrumento ciego de su propia destrucción." — Simón Bolívar',
    '🗿 "La propaganda es a la democracia lo que la cachiporra es a un estado totalitario." — Noam Chomsky',
    '🗿 "Quien controla el pasado controla el futuro; quien controla el presente controla el pasado." — George Orwell',
    '🗿 "La libertad es el derecho a decirle a la gente lo que no quiere oír." — George Orwell',
    '🗿 "No sé con qué armas se peleará la Tercera Guerra Mundial, pero la Cuarta será con piedras y palos." — Albert Einstein',
    '🗿 "Nadie tiene el derecho de obedecer." — Hannah Arendt',
    '🗿 "La guerra es demasiado importante para dejársela a los militares." — Georges Clemenceau',
    '🗿 "La guerra se vota con el control remoto en la mano — y se muere en ella con las manos vacías." — dicho popular',
    '🗿 "Nadie que vota la guerra desde el sofá va a pisar la trinchera." — dicho popular',
    '🗿 "Los políticos firman la guerra desde el escritorio; el pueblo la paga con sus hijos." — dicho popular',
    '🗿 "Quien declara la guerra casi nunca entierra a su propio hijo." — dicho popular',
    '🌻 Nadie construye una ciudad solo — cada mano que se suma hace la diferencia.',
    '🧵 Cada reporte es un hilo. Entre todos tejemos la red que cuida al barrio.',
    '🐾 Muy pronto, Patitas URBIS te ayudará a cuidar también a los animales de tu ciudad — porque ellos también son comunidad.',
    '🐶 Los animales no pueden reportar lo que les pasa — por eso estamos construyendo Patitas URBIS, para ser su voz.',
    '🏃 Con el modo Rush no solo te mueves tú: se mueve la salud de todo el pueblo, un paso a la vez.',
    '❤️‍🔥 Cuidar tu cuerpo también es cuidar tu comunidad — actívate con URBIS Rush.',
    '🎮 Los minijuegos de URBIS no son solo diversión — también ayudan a sostener esta plataforma para que siga siendo gratis para tu comunidad.',
    '💰 Cada evento premium que se juega también aporta a que URBIS pueda seguir creciendo y llegando a más gente.',
    '🕹️ Aquí jugar también construye: entre risas y retos, seguimos financiando una herramienta hecha para cuidar el barrio.',
    '🎯 Cada partida que juegas ayuda, sin que lo notes, a que esta app siga en pie para todos.',
    '🪙 Divertirte aquí también es apoyar: los juegos mantienen viva la plataforma que todos usamos gratis.',
    '🎡 Jugar, ganar y compartir — así, sin darte cuenta, ayudas a que URBIS siga funcionando para tu comunidad.',
    '🧡 Detrás de cada minijuego hay un propósito: mantener esta herramienta viva para quien la necesite.',
    '💼 A futuro, URBIS también te ayudará a buscar empleo y a impulsar tu emprendimiento — porque una ciudad fuerte es una ciudad con trabajo.',
    '🌟 Soñamos con crecer para abrir oportunidades reales: empleo, emprendimiento y crecimiento para toda la comunidad.',
    '🏙️ El urbanismo es como un ser vivo: las calles son sus arterias, los parques sus pulmones, y los vecinos, el corazón que lo mantiene latiendo.',
    '🌳 Una ciudad no se construye solo con cemento — se construye con quienes la habitan y la cuidan cada día.',
    '👀 "La urbanista Jane Jacobs decía que las mejores ciudades se cuidan con \'ojos en la calle\' — cada reporte tuyo es uno de esos ojos."',
    '🌆 Como cualquier ser vivo, una ciudad enferma si nadie la cuida, y florece cuando todos la atienden.',
    '🎓 UrbisProCity crecerá para ser la herramienta de análisis urbano de estudiantes y universitarios — mapas de calor, gráficos y datos reales de la ciudad.',
    '📊 Más que reportar, UrbisProCity busca enseñar: convertir cada dato georreferenciado en conocimiento para quien estudia la ciudad.',
    '🗺️ Pensamos en los futuros urbanistas: UrbisProCity será su laboratorio de datos, gráficos y mapas de calor para entender la ciudad de verdad.',
    '🚨 Un reporte a tiempo puede avisar a todo el barrio de un enfrentamiento armado que se acerca — y darles minutos valiosos para protegerse.',
    '📡 Denunciar la inseguridad no es exagerar: es darle a tu comunidad la oportunidad de reaccionar antes de que sea tarde.',
    '🌪️ Ante un desastre natural, cada reporte cuenta: minutos de aviso pueden significar vidas salvadas.',
    '🌊 No podemos evitar una creciente o un sismo, pero sí podemos avisarnos entre todos a tiempo para estar a salvo.',
    '⛈️ Los desastres naturales no avisan solos — por eso cada reporte tuyo se vuelve la alerta que otro vecino necesita.',
    '🔔 Muy pronto, URBIS te avisará con anticipación: cierres de vía, accidentes, robos, sismos, movimientos de masas o crecientes cerca de ti.',
    '📲 Estamos preparando notificaciones anticipadas — para que el reporte de un vecino te avise a ti antes de que la sorpresa te alcance.',
    '👨‍👩‍👧‍👦 También estamos preparando un Modo Familia: para que sepas que tus hijos, padres o hermanos están bien, estés donde estés.',
    '🛡️ Pronto, URBIS te ayudará a cuidar a los tuyos con un Modo Familia — tranquilidad para quienes más quieres.',
    '🧪 URBIS todavía está en etapa experimental (beta) — si algo falla, cuéntanos a urbisprocity@gmail.com y lo arreglamos.',
    '💌 ¿Encontraste un error? Escríbenos a urbisprocity@gmail.com — cada aviso nos ayuda a mejorar más rápido.',
    '🛠️ Seguimos construyendo URBIS todos los días — si ves un error, ten paciencia: ya estamos trabajando en mejorarlo.',
    '🌤️ Como toda app en desarrollo, a veces algo puede fallar — gracias por tu paciencia mientras seguimos creciendo.',
    '🧑‍🎨 Elige tu avatar en URBIS — a futuro podrás verlo en el mapa junto al de tus amigos y familiares.',
    '👥 Muy pronto podrás ver en el mapa dónde están tus amigos y familiares, cada uno con su propio avatar.'
  ];
  // Paleta pastel cute — un tono distinto por mensaje, cíclica.
  const URBIS_HERO_COLORS = ['#4fd9c0','#7fa8e8','#f2a6cf','#b596ef','#ffbf6b','#7bd48f','#ff9d9d','#f6d365'];
  let heroMsgIndex = Math.floor(Math.random() * URBIS_HERO_MESSAGES.length);
  let heroMsgTimer = null;
  function renderHeroMessage(){
    const p = app.querySelector('#u52-hero-msg');
    if(!p) return;
    p.textContent = URBIS_HERO_MESSAGES[heroMsgIndex];
    p.style.setProperty('--u52-hero-accent', URBIS_HERO_COLORS[heroMsgIndex % URBIS_HERO_COLORS.length]);
    p.classList.remove('u52-hero-anim');
    void p.offsetWidth; // reinicia la animación CSS aunque sea el mismo texto
    p.classList.add('u52-hero-anim');
  }
  function heroMsgStep(delta){
    heroMsgIndex = (heroMsgIndex + delta + URBIS_HERO_MESSAGES.length) % URBIS_HERO_MESSAGES.length;
    renderHeroMessage();
    restartHeroTimer();
  }
  function restartHeroTimer(){
    if(heroMsgTimer) clearInterval(heroMsgTimer);
    heroMsgTimer = setInterval(()=>{ heroMsgIndex = (heroMsgIndex + 1) % URBIS_HERO_MESSAGES.length; renderHeroMessage(); }, 10000);
  }
  renderHeroMessage();
  restartHeroTimer();

  function setMobilityStatus(html){
    const el = app.querySelector('#u56-mobility-status');
    if(el) el.innerHTML = html;
    const nav = app.querySelector('#u52-route-state');
    if(nav) nav.innerHTML = html.replace(/<[^>]+>/g,' ');
  }
  window.urbisMobileSetMobilityStatus = setMobilityStatus;
  function ensureMobileGps(center=false){
    enableMobileMapGestures();
    startMobileGpsWatch();
    if(center){
      if(mobileGps.last) centerOnMobileGps(true);
      else if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(pos=>{
          onMobileGpsPoint(pos);
          centerOnMobileGps(true);
        },()=>setMobilityStatus('Activa permisos de ubicación.'),{enableHighAccuracy:true,maximumAge:1000,timeout:12000});
      }
    }
  }

  // Auto-ubicación al volver de segundo plano: pedido explícito — "cuando
  // la app cargue donde estoy yo, automáticamente me envíe donde estoy sin
  // tener que darle al botón". El primer centrado ocurre al iniciar sesión
  // (ver js/41 startSession → ensureMobileGps(true)); esto cubre el OTRO
  // caso: la app ya estaba abierta y vuelve de suspensión/segundo plano
  // (cambiar de app, bloquear pantalla, llamada entrante, etc.).
  let urbisMobileHiddenAt = 0;
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){
      urbisMobileHiddenAt = Date.now();
      return;
    }
    if(document.visibilityState !== 'visible' || !urbisMobileHiddenAt) return;
    const away = Date.now() - urbisMobileHiddenAt;
    urbisMobileHiddenAt = 0;
    // Umbral de 2 minutos: evita re-centrar de golpe en cambios rapidísimos
    // de app (ej. abrir la cámara para una foto de reporte y volver).
    if(away > 120000){ try{ ensureMobileGps(true); }catch(e){} }
  }, false);
  // iOS/Safari a veces restaura la página desde bfcache sin visibilitychange.
  window.addEventListener('pageshow', function(ev){
    if(ev.persisted){ try{ ensureMobileGps(true); }catch(e){} }
  });

  function describeCurrentRoute(){
    try{
      const mode = (window.routeRealMode || 'car');
      const names = {walking:'A pie', bike:'Bici', bus:'Bus', motorcycle:'Moto', car:'Carro'};
      const route = window.routeRealLastResult;
      if(route && route.distance){
        const km = (route.distance/1000).toFixed(route.distance>10000?0:1);
        setMobilityStatus(`${names[mode] || 'Carro'} · ${km} km · ruta activa`);
      } else if(window.routeRealPointB){
        setMobilityStatus(`${names[mode] || 'Carro'} · destino listo`);
      }
    }catch(e){}
  }


  function resetInitialAuthViewport(){
    try{
      const loginScreen = app.querySelector('[data-u52-screen="login"]');
      const wrap = app.querySelector('.u52-auth-mobile-wrap');
      if(loginScreen){ loginScreen.scrollLeft = 0; if(loginScreen.classList.contains('active')) loginScreen.scrollTop = 0; }
      if(wrap){ wrap.scrollLeft = 0; }
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    }catch(e){}
  }
  setTimeout(resetInitialAuthViewport, 30);
  window.addEventListener('orientationchange', function(){ setTimeout(resetInitialAuthViewport, 180); }, {passive:true});
  window.addEventListener('resize', function(){ setTimeout(resetInitialAuthViewport, 80); }, {passive:true});


  function socialSession(){ try{ return window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function' ? window.URBIS_AUTH.readSession() : null; }catch(e){ return null; } }
  function socialIdentifier(){ const s = socialSession() || {}; return s.user_id || s.friend_code || s.usuario || s.cedula_numero || s.cedula || s.correo || ''; }
  async function socialAPI(payload){ if(window.URBIS_AUTH && typeof window.URBIS_AUTH.socialAPI === 'function') return await window.URBIS_AUTH.socialAPI(payload); throw new Error('Social URBIS necesita actualizar el módulo de autenticación.'); }
  function socialSetResult(html){ const el = app.querySelector('#u52-social-result'); if(el) el.innerHTML = html || ''; }
  function firstTwoNames(value){
    const parts = String(value || 'Usuario URBIS').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).join(' ') || 'Usuario URBIS';
  }
  function socialUserCard(user, message, opts = {}){
    const name = esc(user?.display_name || firstTwoNames(user?.nombres || user?.nombre_completo || 'Usuario URBIS'));
    const username = esc(user?.usuario || 'sin_usuario');
    const code = esc(user?.friend_code || '');
    const uid = esc(user?.user_id || '');
    const showCancel = !!opts.showCancel;
    const showButton = opts.showButton !== false && !showCancel;
    // Avatar — primero desde la identidad del backend (user.avatar), luego respaldo SheetDB.
    const key = String(username).toLowerCase();
    const _avOk = s => /^avatar[-_][a-z0-9-]+$/i.test(String(s||'').trim());
    let avId = (user && _avOk(user.avatar)) ? String(user.avatar).trim() : '';
    if(!avId){
      const avRow = (window.urbisAvatares || []).find(r => String(r.lng||'').toLowerCase() === key);
      const avIdRaw = avRow ? String(avRow.descripcion||'').trim() : '';
      if(_avOk(avIdRaw)) avId = avIdRaw;
    }
    const ini = (String(username)[0]||'?').toUpperCase();
    const paleta = ['#00B68D','#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6'];
    const color = paleta[String(username).charCodeAt(0) % paleta.length];
    const avHtml = avId
      ? `<img src="assets/avatars/${avId}.png" style="width:56px;height:56px;border-radius:50%;object-fit:cover;box-shadow:0 2px 10px rgba(0,0,0,.12);flex-shrink:0;" onerror="this.outerHTML='<div style=\\'display:flex;width:56px;height:56px;border-radius:50%;background:${color};align-items:center;justify-content:center;color:#fff;font-size:1.3rem;font-weight:900;flex-shrink:0;\\'>${ini}</div>'">`
      : `<div style="display:flex;width:56px;height:56px;border-radius:50%;background:${color};align-items:center;justify-content:center;color:#fff;font-size:1.3rem;font-weight:900;flex-shrink:0;">${ini}</div>`;
    let actionBtn = '';
    if(showButton) actionBtn = `<button type="button" data-u52-social-add data-target-user-id="${uid}" data-target-code="${code}" style="flex:1;padding:10px;border-radius:12px;border:none;background:#00B68D;color:#fff;font-size:.88rem;font-weight:700;cursor:pointer;">Agregar amigo</button>`;
    else if(showCancel) actionBtn = `<button type="button" class="ghost" data-u52-social-cancel data-target-user-id="${uid}" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:.88rem;font-weight:700;cursor:pointer;">Cancelar solicitud</button>`;
    const verBtn = `<button type="button" onclick="window.urbisVerPerfilAmigo&&window.urbisVerPerfilAmigo('${username}')" style="padding:10px 14px;border-radius:12px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#334155;font-size:.88rem;font-weight:700;cursor:pointer;white-space:nowrap;">Ver perfil</button>`;
    return `<div class="u52-social-found" style="background:#fff;border-radius:18px;padding:16px;box-shadow:0 2px 16px rgba(0,0,0,.07);">
      <div style="display:flex;align-items:center;gap:13px;margin-bottom:12px;">
        <div style="flex-shrink:0;">${avHtml}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:1rem;font-weight:800;color:#0f172a;line-height:1.3;">${name}</div>
          <div style="font-size:.82rem;font-weight:700;color:#00B68D;">@${username}</div>
          ${code ? `<div style="font-size:.74rem;font-weight:700;color:#1e40af;letter-spacing:.06em;margin-top:2px;">ID&nbsp;${code}</div>` : ''}
          ${message ? `<div style="font-size:.74rem;color:#64748b;margin-top:3px;">${esc(message)}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:7px;">${verBtn}${actionBtn}</div>
    </div>`;
  }
  function setFriendCodeUI(code){
    const clean = code || 'Generando...';
    const socialCodeEl = app.querySelector('#u52-social-my-code');
    const profileCodeEl = app.querySelector('#u52-profile-friend-code');
    if(socialCodeEl) socialCodeEl.textContent = clean;
    if(profileCodeEl) profileCodeEl.textContent = clean;
  }
  let socialContactRel = 'todos';
  function setContactTab(){
    window.__urbisSocialRel = socialContactRel;
    const want = 'contactos-' + (socialContactRel === 'familia' ? 'familia' : (socialContactRel === 'amigo' ? 'amigos' : (socialContactRel === 'online' ? 'online' : 'todos')));
    app.querySelectorAll('.u52-seg-tabs button').forEach(b => b.classList.toggle('active', b.dataset.u52Call === want));
  }

  async function refreshSocialProfile(){
    const s = socialSession();
    applyProfileIdentityUI();
    // Mostrar cache de amigos inmediatamente mientras llegan los datos del servidor
    try{
      const cacheKey = 'urbis_friends_cache_' + (s?.user_id || 'anon');
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if(cached && Array.isArray(cached) && cached.length){
        window.urbisAmigosFromServer = cached;
      }
    }catch(e){}
    try{ if(typeof window.urbisRenderContactos === 'function') window.urbisRenderContactos('todos', true); }catch(e){}
    // Sincronizar avatar propio al SheetDB (idempotente, una sola vez por sesión, sin duplicados).
    try{
      const avatarId = localStorage.getItem('urbis_mobile_avatar_skin_v65') || '';
      const usuarioSync = s && s.usuario ? s.usuario : '';
      if(!window.__urbisAvatarSynced && avatarId && usuarioSync && usuarioSync !== 'sin_usuario'){
        urbisGuardarAvatarSheet(usuarioSync, avatarId);
        window.__urbisAvatarSynced = true;
      }
    }catch(e){}
    setFriendCodeUI(s?.friend_code || 'Generando...');
    const id = socialIdentifier();
    if(!id){ setFriendCodeUI('Inicia sesión'); return; }
    try{
      const out = await socialAPI({ action:'social_profile', current_user_id:s?.user_id || '', identifier:id, usuario:s?.usuario || '', cedula:s?.cedula_numero || s?.cedula || '' });
      if(out.ok && out.user){
        const code = out.user.friend_code || 'Sin ID';
        setFriendCodeUI(code);
        const serverUsuario = (out.user.usuario || '').trim();
        const sessionUsuario = (s?.usuario || '').trim();
        // Auto-reparar si el servidor devuelve sin_usuario o vacío
        if(!serverUsuario || serverUsuario === 'sin_usuario'){
          try{
            const repair = await socialAPI({ action:'social_repair_username', user_id:s?.user_id || '' });
            if(repair.ok && repair.fixed && repair.usuario){
              if(typeof window.urbisSetMiUsuario === 'function') window.urbisSetMiUsuario(repair.usuario);
              try{
                const cur = window.URBIS_AUTH.readSession() || {};
                cur.usuario = repair.usuario;
                cur.friend_code = out.user.friend_code || cur.friend_code || '';
                localStorage.setItem((window.URBIS_CONFIG?.AUTH?.SESSION_KEY || 'urbis_auth_session_v1'), JSON.stringify(cur));
              }catch(e2){}
              // Volver a renderizar contactos con el username correcto
              try{ if(typeof window.urbisRenderContactos === 'function') window.urbisRenderContactos('todos'); }catch(e){}
            }
          }catch(e2){}
        } else if(serverUsuario !== sessionUsuario && sessionUsuario === 'sin_usuario'){
          // Sesión local tiene sin_usuario pero servidor ya lo tiene correcto
          if(typeof window.urbisSetMiUsuario === 'function') window.urbisSetMiUsuario(serverUsuario);
          try{
            const cur = window.URBIS_AUTH.readSession() || {};
            cur.usuario = serverUsuario;
            cur.friend_code = out.user.friend_code || cur.friend_code || '';
            localStorage.setItem((window.URBIS_CONFIG?.AUTH?.SESSION_KEY || 'urbis_auth_session_v1'), JSON.stringify(cur));
          }catch(e2){}
        }
        try{ const current = window.URBIS_AUTH.readSession() || {}; current.friend_code = out.user.friend_code || current.friend_code || ''; localStorage.setItem((window.URBIS_CONFIG?.AUTH?.SESSION_KEY || 'urbis_auth_session_v1'), JSON.stringify(current)); }catch(e){}
      }
      // Cargar lista de amigos: primero del cache local (instantáneo), luego servidor en fondo
      try{
        const cacheKey = 'urbis_friends_cache_' + (s?.user_id || 'anon');
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if(cached && Array.isArray(cached) && cached.length){
          window.urbisAmigosFromServer = cached;
          try{ if(typeof window.urbisRenderContactos === 'function') window.urbisRenderContactos('todos', true); }catch(e){}
        }
        // Actualizar desde servidor en segundo plano
        socialAPI({ action:'social_get_friends', current_user_id:s?.user_id || '', identifier:id }).then(friendsOut => {
          if(friendsOut.ok && Array.isArray(friendsOut.friends)){
            window.urbisAmigosFromServer = friendsOut.friends;
            try{ localStorage.setItem(cacheKey, JSON.stringify(friendsOut.friends)); }catch(e){}
            try{ if(typeof window.urbisRenderContactos === 'function') window.urbisRenderContactos('todos', true); }catch(e){}
          }
        }).catch(()=>{});
      }catch(e2){}
    }catch(e){
      const fallback = (s && s.friend_code) ? s.friend_code : 'No disponible';
      setFriendCodeUI(fallback);
    }
  }
  async function socialSearchFriend(){
    const input = app.querySelector('#u52-social-search-input'); const q = (input?.value || '').trim(); if(!q){ socialSetResult('<div class="u52-social-msg">Escribe usuario, cédula o ID URBIS.</div>'); return; } socialSetResult('<div class="u52-social-msg">Buscando usuario...</div>'); const s = socialSession() || {};
    try{ const out = await socialAPI({ action:'social_find_user', query:q, current_user_id:s.user_id || '', current_identifier:s.friend_code || s.usuario || s.cedula_numero || s.cedula || '' }); if(!out.ok) throw new Error(out.message || 'No se pudo buscar.'); if(!out.found){ socialSetResult(`<div class="u52-social-msg">${esc(out.message || 'No encontramos ese usuario.')}</div>`); return; } socialSetResult(socialUserCard(out.user, out.message)); }catch(err){ socialSetResult(`<div class="u52-social-msg error">${esc(err.message || 'Error buscando usuario.')}</div>`); }
  }
  async function socialAddFriend(btn){
    const target = btn?.dataset?.targetUserId || btn?.dataset?.targetCode || '';
    const s = socialSession() || {};
    if(!target){ socialSetResult('<div class="u52-social-msg error">Busca primero un usuario.</div>'); return; }
    try{
      btn.disabled = true; btn.textContent = 'Enviando...';
      const out = await socialAPI({ action:'social_add_friend', requester_user_id:s.user_id || '', requester_identifier:s.friend_code || s.usuario || s.cedula_numero || s.cedula || '', target_user_id:btn.dataset.targetUserId || '', target_friend_code:btn.dataset.targetCode || '' });
      if(!out.ok) throw new Error(out.message || 'No se pudo agregar.');
      // Si ya existe solicitud pendiente → mostrar opción de cancelar
      if(out.status === 'pendiente' && out.message && out.message.indexOf('ya existe') !== -1){
        socialSetResult(socialUserCard(out.user, 'Ya tienes una solicitud pendiente con este usuario.', {showCancel:true}));
        return;
      }
      // Si ya son amigos aceptados
      if(out.status === 'aceptado'){
        socialSetResult(socialUserCard(out.user, 'Ya son amigos en URBIS.', {showButton:false}));
        return;
      }
      socialSetResult(socialUserCard(out.user, out.message || 'Solicitud enviada. El otro usuario verá la notificación en su pestaña Noti.', {showButton:false}));
    }catch(err){
      socialSetResult(`<div class="u52-social-msg error">${esc(err.message || 'No se pudo agregar amigo.')}</div>`);
    } finally{ if(btn){ btn.disabled = false; btn.textContent = 'Agregar'; } }
  }
  async function socialCancelRequest(btn){
    const s = socialSession() || {};
    try{
      btn.disabled = true; btn.textContent = 'Cancelando...';
      const out = await socialAPI({ action:'social_cancel_request', current_user_id:s.user_id || '', identifier:s.user_id || s.friend_code || s.usuario || s.cedula_numero || s.cedula || '', target_user_id:btn.dataset.targetUserId || '' });
      if(!out.ok) throw new Error(out.message || 'No se pudo cancelar.');
      socialSetResult('<div class="u52-social-msg">Solicitud cancelada. Puedes buscar el usuario y enviar una nueva solicitud.</div>');
    }catch(err){ alert(err.message || 'No se pudo cancelar la solicitud.'); }
    finally{ if(btn){ btn.disabled = false; btn.textContent = 'Cancelar solicitud'; } }
  }
  function copySocialId(source){ const profileCode = (app.querySelector('#u52-profile-friend-code')?.textContent || '').trim(); const socialCode = (app.querySelector('#u52-social-my-code')?.textContent || '').trim(); const code = (source === 'profile' ? profileCode : socialCode) || profileCode || socialCode; if(!code || code === 'Cargando...' || code === 'Generando...' || code === 'Inicia sesión' || code === 'No disponible') return; try{ navigator.clipboard?.writeText(code); }catch(e){} try{ if(typeof showAchievementToast === 'function') showAchievementToast('ID URBIS copiado', code); else alert('ID URBIS copiado: ' + code); }catch(e){ alert('ID URBIS copiado: ' + code); } }


  function isMissingBirthdateSession(s){
    s = s || socialSession() || {};
    return !(s.fecha_nacimiento || s.nacimiento_anio || s.edad);
  }
  function buildLocalBirthdateNotification(){
    const s = socialSession() || {};
    if(!s || !s.active || !s.verified || !isMissingBirthdateSession(s)) return null;
    return {
      id:'local_birthdate_missing',
      type:'complete_birthdate',
      title:'Completa tu fecha de nacimiento',
      message:'Ayúdanos a mejorar el análisis demográfico de URBIS. Solo se usará para estadísticas y validación de edad.',
      action:'abrir_perfil_demografia'
    };
  }
  function birthModalOptions(kind){
    if(kind === 'day') return Array.from({length:31}, (_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${i+1}</option>`).join('');
    if(kind === 'month'){
      const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      return months.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('');
    }
    const yNow = new Date().getFullYear();
    let html='';
    for(let y=yNow; y>=yNow-120; y--) html += `<option value="${y}">${y}</option>`;
    return html;
  }
  function validateBirthModal(day, month, year){
    const d=Number(day), m=Number(month), y=Number(year);
    if(!d || !m || !y) return {ok:false,message:'Selecciona día, mes y año.'};
    const dt = new Date(y, m-1, d);
    if(dt.getFullYear() !== y || dt.getMonth() !== m-1 || dt.getDate() !== d) return {ok:false,message:'Fecha de nacimiento inválida.'};
    const today = new Date();
    if(dt > today) return {ok:false,message:'La fecha no puede ser futura.'};
    let age = today.getFullYear() - y;
    const beforeBirthday = today.getMonth() < m-1 || (today.getMonth() === m-1 && today.getDate() < d);
    if(beforeBirthday) age--;
    if(age < 0 || age > 120) return {ok:false,message:'Revisa el año seleccionado.'};
    return {ok:true, fecha:`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, dia:String(d).padStart(2,'0'), mes:String(m).padStart(2,'0'), anio:String(y), edad:age, es_mayor_edad: age >= 18 ? 'si' : 'no'};
  }
  function ensureBirthdateModal(){
    let modal = document.getElementById('u52-birthdate-modal');
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = 'u52-birthdate-modal';
    modal.className = 'u52-birthdate-modal';
    modal.innerHTML = `<div class="u52-birthdate-backdrop" data-u52-birthdate-close></div>
      <section class="u52-birthdate-sheet" role="dialog" aria-modal="true" aria-label="Completar fecha de nacimiento">
        <button type="button" class="u52-birthdate-x" data-u52-birthdate-close>×</button>
        <div class="u52-birthdate-icon">🎂</div>
        <h2>Completa tu fecha de nacimiento</h2>
        <p>Este dato ayuda a URBIS a hacer análisis demográfico y verificar rangos de edad. No se mostrará públicamente.</p>
        <div class="u52-birthdate-grid">
          <label><span>Día</span><select id="u52-birth-day"><option value="">Día</option>${birthModalOptions('day')}</select></label>
          <label><span>Mes</span><select id="u52-birth-month"><option value="">Mes</option>${birthModalOptions('month')}</select></label>
          <label><span>Año</span><select id="u52-birth-year"><option value="">Año</option>${birthModalOptions('year')}</select></label>
        </div>
        <div id="u52-birth-status" class="u52-birth-status">Selecciona la fecha para calcular la edad.</div>
        <button type="button" class="u52-primary green" data-u52-birthdate-save>Guardar fecha</button>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', ev => { if(ev.target.closest('[data-u52-birthdate-close]')) closeBirthdateModal(); });
    modal.querySelector('[data-u52-birthdate-save]')?.addEventListener('click', saveBirthdateFromModal);
    modal.querySelectorAll('select').forEach(sel => sel.addEventListener('change', updateBirthdateStatus));
    return modal;
  }
  function openBirthdateModal(){
    const modal = ensureBirthdateModal();
    const s = socialSession() || {};
    const d = s.nacimiento_dia || '', m = s.nacimiento_mes || '', y = s.nacimiento_anio || '';
    const day = modal.querySelector('#u52-birth-day'), month = modal.querySelector('#u52-birth-month'), year = modal.querySelector('#u52-birth-year');
    if(day) day.value = d;
    if(month) month.value = m;
    if(year) year.value = y;
    modal.classList.add('show');
    updateBirthdateStatus();
  }
  function closeBirthdateModal(){ document.getElementById('u52-birthdate-modal')?.classList.remove('show'); }
  function updateBirthdateStatus(){
    const modal = document.getElementById('u52-birthdate-modal');
    if(!modal) return;
    const res = validateBirthModal(modal.querySelector('#u52-birth-day')?.value, modal.querySelector('#u52-birth-month')?.value, modal.querySelector('#u52-birth-year')?.value);
    const status = modal.querySelector('#u52-birth-status');
    if(!status) return;
    status.classList.toggle('ok', !!res.ok);
    status.textContent = res.ok ? `Edad calculada: ${res.edad} años · ${res.es_mayor_edad === 'si' ? 'Mayor de edad' : 'Menor de edad'}` : res.message;
  }
  async function saveBirthdateFromModal(){
    const modal = document.getElementById('u52-birthdate-modal');
    if(!modal) return;
    const res = validateBirthModal(modal.querySelector('#u52-birth-day')?.value, modal.querySelector('#u52-birth-month')?.value, modal.querySelector('#u52-birth-year')?.value);
    if(!res.ok){ alert(res.message); return; }
    const s = socialSession() || {};
    const btn = modal.querySelector('[data-u52-birthdate-save]');
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'Guardando...'; }
      const out = await socialAPI({action:'update_birthdate', current_user_id:s.user_id || '', identifier:s.user_id || s.friend_code || s.usuario || s.cedula_numero || s.cedula || s.correo || '', ...res});
      if(!out.ok) throw new Error(out.message || 'No se pudo guardar la fecha.');
      const current = (window.URBIS_AUTH && window.URBIS_AUTH.readSession && window.URBIS_AUTH.readSession()) || s || {};
      const updated = {...current, ...res, fecha_nacimiento_pendiente:'NO'};
      try{ localStorage.setItem((window.URBIS_CONFIG?.AUTH?.SESSION_KEY || 'urbis_auth_session_v1'), JSON.stringify(updated)); }catch(e){}
      closeBirthdateModal();
      try{ if(typeof showAchievementToast === 'function') showAchievementToast('Fecha guardada','Gracias por actualizar tu perfil.'); else alert('Fecha guardada.'); }catch(e){}
      await loadNotifications();
    }catch(err){ alert(err.message || 'No se pudo guardar la fecha.'); }
    finally{ if(btn){ btn.disabled = false; btn.textContent = 'Guardar fecha'; } }
  }
  function setNotiBadge(count){
    const n = Math.max(0, Number(count || 0));
    const badge = app.querySelector('#u52-noti-badge');
    if(!badge) return;
    badge.hidden = n <= 0;
    badge.textContent = n > 99 ? '99+' : String(n);
  }
  function renderNotifications(items){
    const list = app.querySelector('#u52-noti-list');
    if(!list) return;
    const arr = Array.isArray(items) ? items : [];
    if(!arr.length){
      list.innerHTML = '<div class="u52-empty-card"><span>🔔</span><div><b>Sin notificaciones</b><small>Cuando recibas solicitudes o avisos aparecerán aquí.</small></div></div>';
      return;
    }
    list.innerHTML = arr.map(n => {
      if(n.type === 'friend_request'){
        const u = n.user || {};
        const name = esc(u.display_name || firstTwoNames(u.nombres || u.nombre_completo || 'Usuario URBIS'));
        const username = esc(u.usuario || 'sin_usuario');
        const code = esc(u.friend_code || '');
        const fid = esc(n.friend_id || n.id || '');
        const nkey = String(username).toLowerCase();
        let navId = (u && /^avatar[-_][a-z0-9-]+$/i.test(String(u.avatar||'').trim())) ? String(u.avatar).trim() : '';
        if(!navId){
          const navRow = (window.urbisAvatares || []).find(r => String(r.lng||'').toLowerCase() === nkey);
          const navIdRaw = navRow ? String(navRow.descripcion||'').trim() : '';
          if(/^avatar[-_][a-z0-9-]+$/i.test(navIdRaw)) navId = navIdRaw;
        }
        const nini = (String(username)[0]||'?').toUpperCase();
        const npaleta = ['#00B68D','#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6'];
        const ncolor = npaleta[String(username).charCodeAt(0) % npaleta.length];
        const navHtml = navId
          ? `<img src="assets/avatars/${navId}.png" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;cursor:pointer;" onclick="window.urbisVerPerfilAmigo&&window.urbisVerPerfilAmigo('${username}')" onerror="this.style.display='none'">`
          : `<div style="display:flex;width:48px;height:48px;border-radius:50%;background:${ncolor};align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:900;flex-shrink:0;cursor:pointer;" onclick="window.urbisVerPerfilAmigo&&window.urbisVerPerfilAmigo('${username}')">${nini}</div>`;
        return `<div class="u52-noti-card friend" style="padding:14px;">
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:10px;">
            ${navHtml}
            <div style="flex:1;min-width:0;">
              <div style="font-size:.9rem;font-weight:800;color:#0f172a;">${name}</div>
              <div style="font-size:.8rem;font-weight:700;color:#00B68D;">@${username}</div>
              ${code ? `<div style="font-size:.72rem;font-weight:700;color:#1e40af;">ID&nbsp;${code}</div>` : ''}
              <div style="font-size:.78rem;color:#475569;margin-top:2px;">quiere agregarte a URBIS</div>
            </div>
          </div>
          <div class="u52-noti-actions">
            <button type="button" data-u52-noti-accept data-friend-id="${fid}" data-requester-usuario="${username}">Aceptar</button>
            <button type="button" class="ghost" data-u52-noti-reject data-friend-id="${fid}">Rechazar</button>
          </div>
        </div>`;
      }
      if(n.type === 'evento_premium'){
        return `<div class="u52-noti-card aurea"><span>✨</span><div><b>${esc(n.title || '¡Evento Áurea Premium!')}</b><small>${esc(n.message || 'Hay un evento premium activo. ¡Toca para competir!')}</small></div><div class="u52-noti-actions single"><button type="button" class="aurea-go" data-u52-aurea-go data-aurea-juego="${esc(n.juegoId||'')}" data-aurea-titulo="${esc(n.titulo||'Evento Áurea')}" data-aurea-premio="${esc(n.premio||'')}" data-aurea-fin="${esc(n.fin||'')}">🎮 Jugar</button></div></div>`;
      }
      if(n.type === 'complete_birthdate'){
        return `<div class="u52-noti-card demographic"><span>🎂</span><div><b>${esc(n.title || 'Completa tu fecha de nacimiento')}</b><small>${esc(n.message || 'Agrega tu fecha para análisis demográfico y validación de edad.')}</small></div><div class="u52-noti-actions single"><button type="button" data-u52-birthdate-open>Agregar fecha</button></div></div>`;
      }
      return `<div class="u52-noti-card"><span>🔔</span><div><b>${esc(n.title || 'Notificación')}</b><small>${esc(n.message || 'Nuevo aviso de URBIS.')}</small></div></div>`;
    }).join('');
  }
  // ── Notificaciones de EVENTOS PREMIUM (Áurea) ────────────────────────────
  // Se DERIVAN de globalData (que TODOS los usuarios cargan, igual que la gota),
  // así llegan a todos sin tocar el backend. Aparecen en la campanita/noti y
  // disparan un toast UNA vez por evento. El badge las cuenta hasta que el
  // usuario abre la pantalla de notificaciones.
  const _aureaToastedSession = new Set();
  function _aureaSeenSet(){ try{ return new Set(JSON.parse(localStorage.getItem('urbis_aurea_noti_seen')||'[]')); }catch(e){ return new Set(); } }
  function _aureaToastedSet(){ try{ return new Set(JSON.parse(localStorage.getItem('urbis_aurea_noti_toasted')||'[]')); }catch(e){ return new Set(); } }
  function _aureaMarkSeen(ids){ try{ const s=_aureaSeenSet(); ids.forEach(id=>s.add(id)); localStorage.setItem('urbis_aurea_noti_seen', JSON.stringify([...s])); }catch(e){} }
  function _aureaMarkToasted(id){ try{ const s=_aureaToastedSet(); s.add(id); localStorage.setItem('urbis_aurea_noti_toasted', JSON.stringify([...s])); }catch(e){} }
  function buildPremiumEventNotifications(){
    // globalData es un `let` global (NO está en window). Se accede por nombre directo
    // (igual que `map`), con respaldo a window por si acaso.
    const data = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData
               : (Array.isArray(window.globalData) ? window.globalData : []);
    const out = [];
    data.forEach(p => {
      try{
        if(typeof window.urbisEsEventoAurea !== 'function' || !window.urbisEsEventoAurea(p)) return;
        let archivado = false, expira = '';
        try{ if(typeof obtenerMetaTemporal === 'function'){ const mt = obtenerMetaTemporal(p); archivado = !!(mt && mt.archivado); expira = (mt && mt.expira) || ''; } }catch(e){}
        if(archivado) return; // evento terminado: ya no es "nuevo"
        const d = String(p.descripcion||'').split(' | ');
        const titulo = (d[1] && d[1].trim()) ? d[1].trim() : 'Evento Áurea';
        const notas = String(d[2]||'');
        const mPremio = notas.match(/Premio:\s*([^·|]+)/i);
        const premio = mPremio ? mPremio[1].trim() : 'un premio en dinero real';
        const latDigits = String(p.lat).replace(/[^0-9]/g,'');
        let fin = '';
        const mFin = notas.match(/termina\s*([^·|]+)/i);
        if(mFin) fin = mFin[1].trim();
        else if(expira){ try{ if(typeof formatearFechaHora === 'function') fin = formatearFechaHora(expira); }catch(e){} }
        out.push({ id:'aurea_evt_'+latDigits, type:'evento_premium', title:'✨ ¡Evento Áurea Premium!', message:'“'+titulo+'” ya está activo. Compite por '+premio+' (dinero real). ¡Toca para jugar!', juegoId:'aurea_'+latDigits, titulo:titulo, premio:premio, fin:fin });
      }catch(e){}
    });
    return out;
  }
  function _aureaToastNuevos(premiumNotis){
    const toasted = _aureaToastedSet();
    premiumNotis.forEach(n => {
      if(toasted.has(n.id) || _aureaToastedSession.has(n.id)) return;
      _aureaToastedSession.add(n.id); _aureaMarkToasted(n.id);
      try{ if(typeof showAchievementToast === 'function') showAchievementToast(n.title, n.message); }catch(e){}
    });
  }
  function _aureaBadgeNuevos(premiumNotis){
    const seen = _aureaSeenSet();
    return premiumNotis.filter(n => !seen.has(n.id)).length;
  }
  async function loadNotifications(){
    const s = socialSession() || {};
    const identifier = s.user_id || s.friend_code || s.usuario || s.cedula_numero || s.cedula || s.correo || '';
    if(!identifier){
      const birthNoti = buildLocalBirthdateNotification();
      const premiumNotis = buildPremiumEventNotifications();
      _aureaToastNuevos(premiumNotis);
      const arr = premiumNotis.concat(birthNoti ? [birthNoti] : []);
      setNotiBadge(_aureaBadgeNuevos(premiumNotis) + (birthNoti ? 1 : 0));
      renderNotifications(arr);
      return;
    }
    try{
      const out = await socialAPI({ action:'social_notifications', current_user_id:s.user_id || '', identifier, current_identifier:identifier });
      if(out && out.ok){
        const notifications = Array.isArray(out.notifications) ? out.notifications.slice() : [];
        const birthNoti = buildLocalBirthdateNotification();
        if(birthNoti && !notifications.some(n => n.type === 'complete_birthdate')) notifications.unshift(birthNoti);
        const premiumNotis = buildPremiumEventNotifications();
        _aureaToastNuevos(premiumNotis);
        const all = premiumNotis.concat(notifications); // los eventos premium van ARRIBA
        setNotiBadge(notifications.length + _aureaBadgeNuevos(premiumNotis));
        renderNotifications(all);
      }
    }catch(e){
      const list = app.querySelector('#u52-noti-list');
      if(list) list.innerHTML = `<div class="u52-social-msg error">${esc(e.message || 'No se pudieron cargar las notificaciones.')}</div>`;
    }
  }
  async function respondFriendRequest(btn, response){
    const friendId = btn?.dataset?.friendId || '';
    const s = socialSession() || {};
    if(!friendId) return;
    try{
      btn.disabled = true;
      const out = await socialAPI({ action:'social_respond_friend', friend_id:friendId, response, current_user_id:s.user_id || '', identifier:s.user_id || s.friend_code || s.usuario || s.cedula_numero || s.cedula || s.correo || '' });
      if(!out.ok) throw new Error(out.message || 'No se pudo responder.');
      // Al aceptar: escribir ambos lados en SheetDB para que ambos se vean como contactos.
      if(response === 'accepted'){
        const yo = s.usuario || '';
        const solicitante = out.requester_usuario || btn.dataset.requesterUsuario || '';
        if(yo && solicitante && typeof window.urbisAgregarContactoSheetDB === 'function'){
          window.urbisAgregarContactoSheetDB(yo, solicitante);         // carol→jesmen21
          window.urbisAgregarContactoSheetDB(solicitante, yo);         // jesmen21→carol (si no existe ya)
        }
      }
      try{ if(typeof showAchievementToast === 'function') showAchievementToast(response === 'accepted' ? 'Amigo agregado' : 'Solicitud actualizada', out.message || 'Listo'); }catch(e){}
      await loadNotifications();
    }catch(err){ alert(err.message || 'No se pudo responder la solicitud.'); }
    finally{ if(btn) btn.disabled = false; }
  }
  function screens(){ return [...app.querySelectorAll('.u52-screen')]; }
  function mapScreens(){ return ['mobility','map','nav','runner-live']; }

  function ensureIOSAppInteraction(screen){
    try{
      document.body.dataset.urbisAuthenticated = '1';
      document.body.classList.remove('urbis-ios-picker-open','urbis-auth-registering','urbis-auth-panel-open','urbis-auth-login-view');
      document.documentElement.classList.remove('urbis-ios-picker-open');
      document.querySelectorAll('.urbis-ios-location-picker.show').forEach(el => el.classList.remove('show'));
      const loginScreen = document.getElementById('login-screen');
      if(loginScreen){
        loginScreen.style.display = 'none';
        loginScreen.style.visibility = 'hidden';
        loginScreen.style.pointerEvents = 'none';
      }
      const isMap = mapScreens().includes(screen);
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      // En MAPA el body no debe reclamar el gesto (que lo reciba Leaflet); en pantallas normales, pan-y.
      document.body.style.setProperty('touch-action', isMap ? 'none' : 'pan-y', 'important');
      app.style.display = 'block';
      app.style.visibility = 'visible';
      // CLAVE iOS: en MAPA el shell de la app es PASS-THROUGH (pointer-events:none → el toque
      // llega al #map de abajo) y touch-action:none (Leaflet hace pan/zoom). Inline !important
      // para GANAR sobre el CSS enredado. Los controles (botones/topbar) se reactivan por CSS.
      app.style.setProperty('pointer-events', isMap ? 'none' : 'auto', 'important');
      app.style.setProperty('touch-action', isMap ? 'none' : 'pan-y', 'important');
      app.style.overflow = 'hidden';
      screens().forEach(s => {
        const active = s.dataset.u52Screen === screen;
        const interactivo = active && !isMap;   // SOLO las pantallas NO-mapa atrapan el toque
        s.style.setProperty('pointer-events', interactivo ? 'auto' : 'none', 'important');
        s.style.overflowX = 'hidden';
        s.style.overflowY = interactivo ? 'auto' : 'hidden';
        s.style.webkitOverflowScrolling = active ? 'touch' : 'auto';
        s.style.setProperty('touch-action', interactivo ? 'pan-y' : 'none', 'important');
      });
      const active = app.querySelector(`[data-u52-screen="${screen}"]`);
      if(active){
        // En mapa la pantalla activa es PASS-THROUGH; en normales recibe toque y hace scroll.
        active.style.setProperty('pointer-events', isMap ? 'none' : 'auto', 'important');
        active.style.overflowX = 'hidden';
        active.style.overflowY = isMap ? 'hidden' : 'auto';
        active.style.webkitOverflowScrolling = 'touch';
        active.style.setProperty('touch-action', isMap ? 'none' : 'pan-y', 'important');
      }
      app.querySelectorAll('.u52-content').forEach(c => {
        c.style.touchAction = 'pan-y';
        c.style.webkitOverflowScrolling = 'touch';
      });
      // El #map (contenedor Leaflet) SIEMPRE táctil con touch-action:none en pantallas de mapa.
      if(isMap){
        const mc = (typeof map !== 'undefined' && map && map.getContainer) ? map.getContainer() : document.getElementById('map');
        if(mc){
          mc.style.setProperty('touch-action', 'none', 'important');
          mc.style.setProperty('pointer-events', 'auto', 'important');
        }
      }
    }catch(e){}
  }
  function show(screen, push=true){
    if(screen !== 'map') { hideCommunityChooser(false); hideQuickReportPanel(); }
    screens().forEach(s => s.classList.toggle('active', s.dataset.u52Screen === screen));
    app.querySelectorAll('.u52-bottom-nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.u52Go === screen));
    // En las pantallas del modo URBIS Rush se muestra SU PROPIA nav (Rush,
    // Mis recorridos, +, Social Rush, Perfil) en lugar de la general.
    const enRush = ['sport','progress','runner-summary','rush-social'].includes(screen);
    // Pro City: mientras el modo esté activo DENTRO del mapa, se reemplaza la
    // nav general por la propia de Pro City (Salir / Categoría / Ubicación) —
    // pedido explícito: "oculte lo de los reportes, este es un módulo nuevo".
    const enProCity = screen === 'map' && proCity.active;
    app.querySelector('.u52-bottom-nav:not(.u52-rush-nav):not(.u52-procity-nav)')?.toggleAttribute('hidden', screen === 'login' || screen === 'auth-login' || screen === 'runner-live' || screen === 'nav' || enRush || enProCity);
    app.querySelector('.u52-rush-nav')?.toggleAttribute('hidden', !enRush || screen === 'runner-live');
    app.querySelector('.u52-procity-nav')?.toggleAttribute('hidden', !enProCity);
    document.body.classList.toggle('u52-real-map', mapScreens().includes(screen));
    document.body.classList.toggle('rush-running', screen === 'runner-live'); // oculta el nav y prioriza los controles de correr
    ensureIOSAppInteraction(screen);
    // Chip flotante "volver a tu actividad": si hay un rastreo VIVO (activo o en
    // pausa) y el usuario navega a otra pantalla (p.ej. a reportar algo que vio
    // en el camino), este chip lo regresa a la carrera sin perder nada.
    try{ actualizarChipVolverCarrera(screen); }catch(e){}
    if(screen === 'rush-social') { try{ if(typeof window.urbisRenderRushSocial === 'function') window.urbisRenderRushSocial(); }catch(e){} }
    if(push && stack[stack.length-1] !== screen) stack.push(screen);
    if(screen === 'timeline') { try{ if(typeof window.urbisRenderMisReportes === 'function') window.urbisRenderMisReportes(); }catch(e){} }
    if(screen === 'mis-eventos') { try{ if(typeof window.urbisRenderMisEventos === 'function') window.urbisRenderMisEventos(); }catch(e){} }
    // Pro City ya no es una pantalla de menú: si el usuario navega a OTRA
    // pantalla que no sea el mapa, se apaga el modo (oculta el FAB de
    // categorías, no queda "pegado" en pantallas ajenas al mapeo urbano).
    if(screen !== 'map' && proCity.active){ proCity.active = false; try{ hideProCityCategorySheet(); hideProCityStats(); hideProCityFilterSheet(); hideProCitySelectedPanel(); updateProCityMapChrome(false); renderProCityPoints(); }catch(e){} }
    if(screen === 'events') { try{ if(typeof window.urbisRenderEventosMovil === 'function') window.urbisRenderEventosMovil(); }catch(e){} }
    if(screen === 'mascotas') { try{ if(typeof window.renderMascotasModulo === 'function') window.renderMascotasModulo('mascotas-root-mobile'); }catch(e){} }
    if(screen === 'runner-summary') { try{ if(typeof window.urbisRunnerPintarResumen === 'function') setTimeout(window.urbisRunnerPintarResumen, 60); }catch(e){}
      setTimeout(()=>{ try{
        const ses = window.urbisRunnerSesionActual;
        if(typeof window.urbisRunnerSplitsRender === 'function') window.urbisRunnerSplitsRender(document.getElementById('rush-summary-splits'), ses);
        if(typeof window.urbisRunnerPaceChart === 'function') window.urbisRunnerPaceChart(document.getElementById('rush-summary-chart'), ses);
      }catch(e){} }, 90);
    }
    if(screen === 'games') { document.body.classList.add('urbis-gamer'); try{ if(typeof window.urbisRenderGamesHub === 'function') window.urbisRenderGamesHub(); }catch(e){} } else { document.body.classList.remove('urbis-gamer'); }
    if(screen === 'aurea') { try{ if(typeof window.urbisRenderAureaHub === 'function') window.urbisRenderAureaHub(); }catch(e){} }
    if(screen === 'home' || screen === 'sport' || screen === 'progress' || screen === 'profile' || screen === 'avatar' || screen === 'social' || screen === 'notifications') { renderRealStates(); refreshAvatarUI(); }
    if(screen === 'notifications'){ try{ _aureaMarkSeen(buildPremiumEventNotifications().map(n => n.id)); }catch(e){} } // al abrir noti, los eventos premium dejan de contar en el badge (pero siguen listados)
    if(screen === 'home' || screen === 'social' || screen === 'notifications') setTimeout(loadNotifications, 120);
    if(screen === 'social' || screen === 'profile') setTimeout(refreshSocialProfile, 80);
    if(screen === 'social') setTimeout(function(){ try{ if(typeof window.urbisRefrescarInbox==='function') window.urbisRefrescarInbox(window.urbisActualizarBadgeChat); }catch(e){} }, 150);
    if(mapScreens().includes(screen)) { document.body.classList.add('u58-map-free-enabled'); setTimeout(()=>{ try{ map.invalidateSize(); enableMobileMapGestures(); }catch(e){} },80); if(screen==='mobility' || screen==='map' || screen==='nav') setTimeout(()=>ensureMobileGps(false),120); describeCurrentRoute(); if(screen==='runner-live'){ try{ if(typeof window.urbisDetenerRadarContactos==='function') window.urbisDetenerRadarContactos(); }catch(e){} } else { try{ if(typeof window.urbisIniciarRadarContactos==='function') window.urbisIniciarRadarContactos(); }catch(e){} } } else { document.body.classList.remove('u58-map-free-enabled'); }
    const active = app.querySelector(`[data-u52-screen="${screen}"]`); if(active){ active.scrollTop = 0; active.scrollLeft = 0; }
    if(screen === 'login') setTimeout(resetInitialAuthViewport, 30);
  }
  function back(){ if(stack.length>1) stack.pop(); show(stack[stack.length-1] || 'home', false); }
  function setRole(role){
    mobileRole = role; document.body.dataset.role = role;
    const lbl = app.querySelector('#u52-role-label'); if(lbl) lbl.textContent = role === 'admin' ? 'Administrador' : 'Ciudadano';
    applyProfileIdentityUI();
  }
  // Rellena el perfil con la identidad REAL de la sesión (nombre + @usuario),
  // no con un texto fijo. El vínculo usuario↔contenido es crítico.
  function applyProfileIdentityUI(){
    let s = null;
    try{ s = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null; }catch(e){}
    const nombre  = (s && (s.nombre_completo || s.usuario)) || window.userNameGlobal || '';
    const usuario = (typeof window.urbisUsuarioActual === 'function') ? window.urbisUsuarioActual() : ((s && s.usuario) || window.userUsernameGlobal || '');
    const rol     = (s && s.rol) || window.userRole || mobileRole || 'citizen';
    const name = app.querySelector('#u52-profile-name');
    const userEl = app.querySelector('#u52-profile-username');
    const pr   = app.querySelector('#u52-profile-role');
    const haySesion = (typeof window.urbisHaySesion === 'function') ? window.urbisHaySesion() : !!s;
    if(name) name.textContent = nombre || (rol === 'admin' ? 'Administrador URBIS' : 'Completa tu perfil');
    if(userEl){
      userEl.style.display = '';
      if(usuario){
        // Usuario ya identificado (registrado): se muestra FIJO, no se re-define.
        userEl.textContent = '@' + usuario;
        userEl.classList.remove('is-empty');
        userEl.onclick = null;
        userEl.style.cursor = 'default';
      } else if(haySesion){
        // Sesión iniciada pero sin usuario legible: no ofrecer re-definir (conflicto);
        // la solución es volver a iniciar sesión con su usuario.
        userEl.textContent = 'Cierra sesión y vuelve a entrar con tu usuario';
        userEl.classList.add('is-empty');
        userEl.onclick = null;
        userEl.style.cursor = 'default';
      } else {
        // Sin sesión (caso defensivo): permitir definir usuario local.
        userEl.textContent = '➕ Definir mi usuario';
        userEl.classList.add('is-empty');
        userEl.style.cursor = 'pointer';
        userEl.onclick = function(){
          const actual = (typeof window.urbisUsuarioActual === 'function' ? window.urbisUsuarioActual() : '') || '';
          const nuevo = prompt('Tu nombre de usuario URBIS (sin @):', actual);
          if(nuevo && typeof window.urbisSetMiUsuario === 'function'){
            window.urbisSetMiUsuario(nuevo);
            applyProfileIdentityUI();
            try{ if(typeof window.urbisRenderContactos === 'function') window.urbisRenderContactos(typeof socialContactRel!=='undefined'?socialContactRel:'amigo'); }catch(e){}
          }
        };
      }
    }
    if(pr)   pr.textContent = (rol === 'admin' ? 'Administrador' : 'Ciudadano');
  }
  window.urbisApplyProfileIdentityUI = applyProfileIdentityUI;
  function callNativeLogin(role){
    try{
      if(role === 'admin'){
        const pass = document.getElementById('u52-admin-pass')?.value || '';
        const real = document.getElementById('admin-pass'); if(real) real.value = pass;
        if(typeof intentarLoginAdmin === 'function') intentarLoginAdmin();
      } else if(typeof entrarDirectoPruebas === 'function') entrarDirectoPruebas();
    }catch(e){}
  }

  const URBIS_LOGIN_FALLBACK_STATS = { total: 1219, commerce: 815, equip: 234, nature: 68, risk: 10 };

  function formatLoginMetric(v){
    return (Number(v) || 0).toLocaleString('es-CO');
  }

  function computeTerritorialLoginStats(data){
    const arr = Array.isArray(data) ? data : [];
    if(!arr.length) return {...URBIS_LOGIN_FALLBACK_STATS};
    const byType = {};
    arr.forEach(item => {
      const tipo = String(item?.tipo || '').trim();
      byType[tipo] = (byType[tipo] || 0) + 1;
    });
    return {
      total: arr.length,
      commerce: byType['Comercio y Servicios'] || 0,
      equip: byType['Grandes Equipamientos'] || 0,
      nature: (byType['Áreas Verdes y Ambiental'] || 0) + (byType['Áreas Deportivas'] || 0),
      risk: (byType['Conflictos de Uso (Riesgo)'] || 0) + (byType['🚗 Reportes de Tráfico'] || 0) + (byType['🚨 Alertas y Riesgos Urbanos'] || 0)
    };
  }

  function updateTerritorialLoginStats(data){
    const stats = computeTerritorialLoginStats(data);
    const set = (id, value) => { const el = app.querySelector('#' + id); if(el) el.textContent = formatLoginMetric(value); };
    set('u52-k-stat-total', stats.total);
    set('u52-k-stat-commerce', stats.commerce);
    set('u52-k-stat-equip', stats.equip);
    set('u52-k-stat-nature', stats.nature);
    const totalChip = app.querySelector('#u52-k-total-chip');
    const riskChip = app.querySelector('#u52-k-risk-chip');
    if(totalChip) totalChip.textContent = 'Registros: ' + formatLoginMetric(stats.total);
    if(riskChip) riskChip.textContent = 'Riesgos: ' + formatLoginMetric(stats.risk);
  }

  function loadTerritorialLoginStats(){
    updateTerritorialLoginStats([]);
    try{
      (window.urbisDBRead ? window.urbisDBRead() : Promise.resolve([]))
      .then(data => updateTerritorialLoginStats(Array.isArray(data) ? data : []))
      .catch(() => updateTerritorialLoginStats([]));
    } catch(e){
      updateTerritorialLoginStats([]);
    }
  }


  function renderRealStates(){
    const stats = historyStats();
    const home = app.querySelector('#u52-home-runner-state');
    if(home) home.innerHTML = stats.count
      ? `<span>🔥</span><div><b>${stats.count} actividad(es)</b><small>${stats.totalKm.toFixed(2)} km registrados.</small></div><button data-u52-go="progress">Ver</button>`
      : `<span>🔥</span><div><b>Aún no tienes actividades</b><small>Inicia tu primer recorrido.</small></div><button data-u52-go="sport">Iniciar</button>`;
    const sport = app.querySelector('#u52-sport-state');
    if(sport) sport.innerHTML = stats.count
      ? `<span>📊</span><div><b>Última actividad guardada</b><small>${esc(stats.latest?.type || 'Runner')} · ${(stats.latest?.distanceKm||0).toFixed(2)} km</small></div><button data-u52-go="progress">Ver</button>`
      : `<img class="rush-pin-ico" src="assets/brand/llegada.png" alt=""><div><b>Todavía no has iniciado actividades</b><small>Tu recorrido aparecerá aquí.</small></div>`;
    const rushStats = app.querySelector('#rush-home-stats');
    if(rushStats) rushStats.innerHTML =
      `<div class="rush-home-stat"><b>${stats.count}</b><span>actividades</span></div>` +
      `<div class="rush-home-stat"><b>${stats.totalKm.toFixed(1)}</b><span>km totales</span></div>` +
      `<div class="rush-home-stat"><b>${fmtPace(stats.bestPace)}</b><span>mejor /km</span></div>`;
    const progress = app.querySelector('#u52-progress-content');
    if(progress) {
      const _labelTipo = t=>({'correr':'Carrera 🏃','ciclismo':'Ciclismo 🚲','caminar':'Caminata 👣','senderismo':'Senderismo ⛰️'})[t]||'Actividad ⚡';
      const hist = loadHistory().slice().reverse();
      progress.innerHTML = stats.count ? `
        <div class="u52-stat-grid" style="padding:14px 14px 0">
          <div class="u52-stat"><b>${stats.count}</b><span>actividades</span></div>
          <div class="u52-stat"><b>${stats.totalKm.toFixed(1)}</b><span>km totales</span></div>
          <div class="u52-stat"><b>${fmtPace(stats.bestPace)}</b><span>mejor ritmo</span></div>
        </div>
        <div style="padding:0 14px">${rushCalendarHTML(hist)}</div>
        <div id="rush-pro-panel" class="rush-pro-panel"></div>
        <div class="rush-hist-title">📜 Historial de recorridos</div>
        <div class="rush-hist-list">
          ${hist.map(item=>{
            const fecha=new Date(item.createdAt||Date.now()).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'2-digit'});
            return `<div class="rush-hist-item">
              <div class="rush-hist-left">
                <b>${esc(_labelTipo(item.type))}</b>
                <small>${fecha}</small>
              </div>
              <div class="rush-hist-stats">
                <span><b>${(item.distanceKm||0).toFixed(2)}</b> km</span>
                <span><b>${fmtTime(item.elapsed)}</b></span>
                <span><b>${fmtPace(item.paceSecKm)}</b> /km</span>
              </div>
              <div class="rush-hist-btns">
                <button class="rush-hist-btn" title="Ver recorrido" onclick="window.urbisRunnerDetalle&&window.urbisRunnerDetalle(${item.id})">▶</button>
                <button class="rush-hist-btn ghost" title="Eliminar" onclick="window.urbisRunnerEliminar&&window.urbisRunnerEliminar(${item.id})">🗑</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : `
        <div style="padding:14px 14px 0">${rushCalendarHTML([], true)}</div>
        <div class="u52-empty-card rush-empty"><span>📊</span><div><b>No hay recorridos todavía</b><small>Inicia una actividad y tu progreso aparecerá aquí.</small></div><button data-u52-go="sport">▶ Iniciar</button></div>
        <div class="u52-empty-card rush-empty"><span>🏆</span><div><b>Aún no tienes logros</b><small>Completa recorridos para desbloquearlos.</small></div></div>
      `;
      try{ if(typeof window.urbisRunnerStatsRenderProgreso === 'function') window.urbisRunnerStatsRenderProgreso(); }catch(e){}
    }
  }
  // ── Calendario de actividad (estilo Strava): mes actual, cada día con
  // recorrido se ilumina con intensidad según los km hechos ese día. ──
  const _MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function _fechaLocalYMD(d){ const dt=new Date(d); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
  function rushCalendarHTML(hist, preview){
    const hoy = new Date();
    const anio = hoy.getFullYear(), mes = hoy.getMonth();
    const porDia = {};
    (hist||[]).forEach(it=>{
      const key = _fechaLocalYMD(it.createdAt || Date.now());
      porDia[key] = (porDia[key] || 0) + (Number(it.distanceKm) || 0);
    });
    // Sin recorridos aún: en vez de un calendario en blanco (poco llamativo),
    // se ve una MUESTRA de días encendidos (ejemplo, sin datos reales) para
    // que el usuario entienda de un vistazo cómo se vería su racha.
    const demoDias = preview ? new Set([2,5,9,10,16,22,23,29]) : null;
    const demoNivel = { 2:2, 5:1, 9:4, 10:3, 16:2, 22:1, 23:3, 29:4 };
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    // Lunes=0 ... Domingo=6 (semana empieza en lunes, como Strava).
    const offset = (primerDia.getDay() + 6) % 7;
    let celdas = '';
    for(let i = 0; i < offset; i++) celdas += '<span class="rush-cal-day empty"></span>';
    for(let dia = 1; dia <= ultimoDia; dia++){
      const key = anio+'-'+String(mes+1).padStart(2,'0')+'-'+String(dia).padStart(2,'0');
      const km = porDia[key] || 0;
      const esHoy = dia === hoy.getDate();
      let nivel = 0, esDemo = false;
      if(km > 0) nivel = km >= 8 ? 4 : km >= 5 ? 3 : km >= 2 ? 2 : 1;
      else if(demoDias && demoDias.has(dia)){ nivel = demoNivel[dia]; esDemo = true; }
      const titulo = km ? km.toFixed(1) + ' km' : (esDemo ? 'Ejemplo' : 'Sin actividad');
      celdas += `<span class="rush-cal-day${nivel ? ' on lvl' + nivel : ''}${esDemo ? ' demo' : ''}${esHoy ? ' today' : ''}" title="${titulo}">
        <b>${dia}</b>${km ? `<small>${km.toFixed(1)}</small>` : ''}
      </span>`;
    }
    return `<div class="rush-calendar-card${preview ? ' preview' : ''}">
      <div class="rush-calendar-head"><b>📅 ${_MESES_ES[mes]} ${anio}</b><span>${preview ? 'Así se verá tu racha 🔥' : 'Tu racha de actividad'}</span></div>
      <div class="rush-calendar-week"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="rush-calendar-grid">${celdas}</div>
      <div class="rush-calendar-legend"><span>Menos</span><i class="lvl0"></i><i class="lvl1"></i><i class="lvl2"></i><i class="lvl3"></i><i class="lvl4"></i><span>Más</span></div>
      ${preview ? '<button class="rush-cal-cta" data-u52-go="sport">▶ Empieza tu primera actividad</button>' : ''}
    </div>`;
  }

  function runnerClear(){ try{ (runner.layers||[]).forEach(l=>{ if(window.map&&map.hasLayer(l)) map.removeLayer(l); }); }catch(e){} runner.layers=[]; }
  // Suavizado Chaikin: redondea los quiebres del GPS para una curva fluida estilo Strava.
  function chaikin(pts, iters){
    let out = pts;
    for(let k=0;k<(iters||2);k++){
      if(out.length<3) break;
      const res=[out[0]];
      for(let i=0;i<out.length-1;i++){
        const a=out[i], b=out[i+1];
        res.push([a[0]*0.75+b[0]*0.25, a[1]*0.75+b[1]*0.25]);
        res.push([a[0]*0.25+b[0]*0.75, a[1]*0.25+b[1]*0.75]);
      }
      res.push(out[out.length-1]); out=res;
    }
    return out;
  }
  // Ancho de la traza en PÍXELES equivalente a ~X metros reales según el zoom actual.
  function metrosAPixeles(metros){
    try{
      const z = map.getZoom();
      const lat = (map.getCenter && map.getCenter().lat) || 7.9;
      const res = 156543.03392 * Math.cos(lat*Math.PI/180) / Math.pow(2, z); // metros por píxel
      return metros / res;
    }catch(e){ return 10; }
  }
  let _runnerZoomHooked = false;
  function runnerDraw(){
    if(!window.L || !window.map || runner.points.length < 2) return;
    // Solo re-dibujar con el zoom si la actividad sigue VIVA (activa o en pausa):
    // sin esta condición, un zoom en cualquier otro módulo resucitaba el trazo
    // del recorrido ya finalizado sobre el mapa de Reportar/Eventos.
    if(!_runnerZoomHooked){ try{ map.on('zoomend', ()=>{ if((runner.active || runner.paused) && runner.points && runner.points.length>1) runnerDraw(); }); _runnerZoomHooked=true; }catch(e){} }
    runnerClear();
    const raw = runner.points.map(p=>[p.lat,p.lng]);
    const latlngs = chaikin(raw, 2);          // curva suavizada para dibujar
    const last = raw[raw.length-1];           // posición real (para el punto y el paneo)
    // Traza GRUESA equivalente a ~7 m reales (escala con el zoom), con piso/techo en px.
    const w = Math.max(9, Math.min(72, Math.round(metrosAPixeles(7))));
    const halo=L.polyline(latlngs,{color:'#ff2d78',weight:Math.round(w*1.9),opacity:.14,lineCap:'round',lineJoin:'round',smoothFactor:2.5}).addTo(map);
    const line=L.polyline(latlngs,{color:'#ff2d78',weight:w,opacity:.96,lineCap:'round',lineJoin:'round',smoothFactor:2.5}).addTo(map);
    const dot=L.circleMarker(last,{radius:Math.max(8,Math.round(w*0.7)),color:'#fff',weight:3,fillColor:'#a45cff',fillOpacity:1}).addTo(map);
    runner.layers.push(halo,line,dot); try{ map.panTo(last,{animate:true,duration:.4}); }catch(e){}
  }
  function updateRunnerUI(){
    const elapsed = runner.active ? Math.floor((Date.now()-runner.startAt)/1000) + runner.elapsed : runner.elapsed;
    const km = runner.totalM/1000, paceSecKm = km>0 ? elapsed/km : 0, speed = elapsed>0 ? km/(elapsed/3600) : 0;
    const set=(id,v)=>{ const el=app.querySelector('#'+id); if(el) el.textContent=v; };
    set('u52-time',fmtTime(elapsed)); set('u52-distance',km.toFixed(2)); set('u52-speed',speed.toFixed(1)); set('u52-points',String(runner.points.length)); set('u52-pace',fmtPace(paceSecKm));
    set('u52-summary-distance',km.toFixed(2)); set('u52-summary-time',fmtTime(elapsed)); set('u52-summary-pace',fmtPace(paceSecKm)); set('u52-summary-type',`⚡ URBIS RUSH`);
  }
  // ---- Overlay de calentamiento/estabilización de GPS ----
  function showGpsWarmup(onCancel){
    hideGpsWarmup();
    const ov=document.createElement('div'); ov.id='rush-warmup'; ov.className='rush-warmup';
    ov.innerHTML='<div class="rush-warmup-card"><div class="rush-warmup-ring">📡</div>'+
      '<h3>Estabilizando GPS…</h3><p id="rush-warmup-acc">Buscando señal…</p>'+
      '<div class="rush-warmup-bar"><i id="rush-warmup-fill"></i></div>'+
      '<button id="rush-warmup-go" class="rush-btn replay" disabled>Iniciar ahora</button>'+
      '<button id="rush-warmup-cancel" class="rush-warmup-cancel">Cancelar</button></div>';
    document.body.appendChild(ov);
    ov.querySelector('#rush-warmup-cancel').onclick=()=>{ hideGpsWarmup(); if(onCancel) onCancel(); };
  }
  function updateGpsWarmup(acc, fixes, onGo){
    const accEl=document.getElementById('rush-warmup-acc'), fill=document.getElementById('rush-warmup-fill'), go=document.getElementById('rush-warmup-go');
    const q = acc<=15?'excelente':acc<=25?'buena':acc<=40?'aceptable':'débil';
    if(accEl) accEl.textContent='Precisión: ±'+Math.round(acc)+' m · señal '+q;
    if(fill){ const pct=Math.max(8, Math.min(100, Math.round(100-(acc-8)*1.6))); fill.style.width=pct+'%'; }
    if(go && fixes>=1){ go.disabled=false; go.textContent='Iniciar ahora'; go.onclick=()=>{ if(onGo) onGo(); }; }
  }
  function hideGpsWarmup(){ const ov=document.getElementById('rush-warmup'); if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); }

  function startRunner(){
    if(!navigator.geolocation){ alert('Tu dispositivo no permite GPS. URBIS Rush solo rastrea con ubicación activa.'); return; }
    let best=null, fixes=0, done=false, warmWatch=null, warmTimer=null;
    const cleanupWarm=()=>{ if(warmWatch!=null){ try{navigator.geolocation.clearWatch(warmWatch);}catch(e){} warmWatch=null; } if(warmTimer){ clearTimeout(warmTimer); warmTimer=null; } };
    showGpsWarmup(()=>{ done=true; cleanupWarm(); });
    // Arranca el rastreo desde una posición YA estabilizada (evita el salto macro inicial).
    const begin=(pos)=>{
      if(done) return; done=true; cleanupWarm(); hideGpsWarmup();
      runnerClear();
      runner = {...runner,active:true,paused:false,startAt:Date.now(),elapsed:0,totalM:0,last:null,points:[],layers:[],watchId:null};
      show('runner-live'); updateRunnerUI();
      try{ if(window.map) map.setView([pos.coords.latitude, pos.coords.longitude], 17, {animate:true}); }catch(e){}
      const push = (lat,lng,acc=0,alt=null) => {
        if(runner.paused) return;
        const p={lat,lng,t:Date.now(),acc};
        if(alt!=null && !isNaN(alt)) p.alt=alt; // altitud para desnivel acumulado (si el GPS la entrega)
        if(runner.last){
          const d=distM(runner.last,p);
          const minMove = Math.max(4, (acc||0)*0.5); // ignora el "temblor" del GPS
          if(d < minMove) return;
          if(d<120) runner.totalM+=d;
        }
        runner.last=p; runner.points.push(p); updateRunnerUI(); runnerDraw();
      };
      push(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy||0, pos.coords.altitude);
      const s0=app.querySelector('#u52-gps-status'); if(s0) s0.textContent='● GPS activo';
      runner.watchId = navigator.geolocation.watchPosition(p2=>{
        const acc = p2.coords.accuracy || 0; const s=app.querySelector('#u52-gps-status');
        if(acc && acc>55){ if(s) s.textContent='● GPS débil'; return; }
        if(s) s.textContent='● GPS activo'; push(p2.coords.latitude,p2.coords.longitude,acc,p2.coords.altitude);
      },()=>{ const s=app.querySelector('#u52-gps-status'); if(s) s.textContent='● GPS intermitente'; },{enableHighAccuracy:true,maximumAge:1200,timeout:9000});
      runner.timer=setInterval(updateRunnerUI,1000);
    };
    const GOOD=22;
    warmWatch = navigator.geolocation.watchPosition(pos=>{
      fixes++; const acc=pos.coords.accuracy||999;
      if(!best || acc < (best.coords.accuracy||999)) best=pos;
      updateGpsWarmup(acc, fixes, ()=>begin(best||pos));
      if(acc<=GOOD && fixes>=2) begin(pos); // auto-arranca con señal buena y estable
    }, err=>{ if(!done){ cleanupWarm(); hideGpsWarmup(); alert('No pudimos activar tu GPS. Revisa los permisos de ubicación y vuelve a intentar. 📡'); } },
       {enableHighAccuracy:true, maximumAge:0, timeout:16000});
    warmTimer = setTimeout(()=>{ if(!done){ if(best) begin(best); else { cleanupWarm(); hideGpsWarmup(); alert('GPS sin señal suficiente. Sal a cielo abierto e intenta de nuevo. 📡'); } } }, 16000);
  }
  function pauseRunner(btn){
    if(!runner.active && !runner.paused) return;
    runner.paused = !runner.paused;
    if(runner.paused){
      runner.elapsed += Math.floor((Date.now()-runner.startAt)/1000);
      runner.active = false;
      if(runner.timer){ clearInterval(runner.timer); runner.timer=null; }
    } else {
      runner.active = true; runner.startAt = Date.now();
      runner.timer = setInterval(updateRunnerUI,1000);
    }
    if(btn) btn.textContent = runner.paused ? '▶' : '❚❚';
    document.body.classList.toggle('rush-paused', runner.paused);
    updateRunnerUI();
  }
  function stopRunner(){
    if(runner.active){ runner.elapsed += Math.floor((Date.now()-runner.startAt)/1000); }
    runner.active=false; runner.paused=false; if(runner.timer) clearInterval(runner.timer); runner.timer=null;
    document.body.classList.remove('rush-paused');
    if(runner.watchId!==null && navigator.geolocation) navigator.geolocation.clearWatch(runner.watchId);
    updateRunnerUI();
    // Expone la sesión recién terminada para el ecosistema URBIS Rush (replay + tarjeta).
    var _km = runner.totalM/1000;
    window.urbisRunnerSesionActual = {
      id: Date.now(),
      type: selectedActivity, distanceKm: _km, elapsed: runner.elapsed,
      paceSecKm: _km>0 ? runner.elapsed/_km : null,
      points: (runner.points||[]).slice(), createdAt: new Date().toISOString()
    };
    // AUTOGUARDADO al finalizar: antes el recorrido SOLO se persistía si el
    // usuario tocaba "Guardar actividad" en el resumen; salir con "←" o con la
    // barra inferior lo perdía TODO en silencio. Ahora queda en el historial
    // de inmediato; "Guardar actividad" solo ACTUALIZA este mismo registro
    // (mismo id) si el usuario recorta el recorrido — no lo duplica.
    if((runner.points||[]).length >= 2){
      const s = window.urbisRunnerSesionActual;
      const h = loadHistory();
      h.push({ id:s.id, type:s.type, distanceKm:s.distanceKm, elapsed:s.elapsed, paceSecKm:s.paceSecKm, points:s.points.slice(), createdAt:s.createdAt });
      saveHistory(h);
    }
    // Limpia el trazo vivo del mapa: el resumen dibuja el suyo propio (canvas),
    // y sin esto la línea rosada quedaba pegada en el mapa de Reportar/Eventos.
    runnerClear();
    runner.points = []; runner.last = null;
    show('runner-summary');
  }
  function saveRunner(){
    // Prefiere la sesión de URBIS Rush (ya puede venir RECORTADA por el usuario).
    const s = window.urbisRunnerSesionActual;
    let item;
    if(s){
      item = {id:s.id||Date.now(), type:s.type||selectedActivity, distanceKm:Number(s.distanceKm)||0, elapsed:Number(s.elapsed)||0, paceSecKm:s.paceSecKm||null, points:(s.points||[]).slice(), createdAt:s.createdAt||new Date().toISOString()};
    } else {
      const elapsed = runner.elapsed || Math.floor((Date.now()-runner.startAt)/1000);
      const km = runner.totalM/1000;
      item = {id:Date.now(), type:selectedActivity, distanceKm:km, elapsed, paceSecKm: km>0?elapsed/km:null, points:runner.points, createdAt:new Date().toISOString()};
    }
    // Si el recorrido ya se autoguardó al finalizar, se REEMPLAZA (mismo id)
    // con la versión final (posiblemente recortada) en vez de duplicarlo.
    const h=loadHistory();
    const idx = h.findIndex(x => x && x.id === item.id);
    if(idx >= 0) h[idx] = item; else h.push(item);
    if(saveHistory(h)){
      try{ if(typeof showAchievementToast==='function') showAchievementToast('Actividad guardada','URBIS Rush 🏃'); }catch(e){}
    }
    show('progress');
  }

  // ── Chip flotante "volver a tu actividad" (reportar sin interrumpir) ──
  // El rastreo (watchPosition + cronómetro) NO se detiene al cambiar de
  // pantalla: solo stopRunner() lo apaga. Este chip hace visible esa verdad.
  function actualizarChipVolverCarrera(screen){
    const vivo = runner.active || runner.paused;
    let chip = document.getElementById('rush-return-chip');
    if(vivo && screen !== 'runner-live'){
      if(!chip){
        chip = document.createElement('button');
        chip.id = 'rush-return-chip'; chip.type = 'button';
        chip.innerHTML = '▶ Volver a tu actividad · <b>GPS grabando</b>';
        chip.onclick = ()=> show('runner-live');
        document.body.appendChild(chip);
      }
    } else if(chip){ chip.remove(); }
  }

  // ── Social Rush: publicar recorridos (voluntario) y muro comunidad/amigos ──
  // La descripción viaja compacta con separador '~' (los reportes usan ' | ')
  // y la polyline va adelgazada a ≤60 puntos para caber en la celda de Sheets.
  function puntosAPolyline(points, maxN){
    const pts = points || [];
    if(pts.length < 2) return '';
    const paso = Math.max(1, Math.ceil(pts.length / (maxN || 60)));
    const out = [];
    for(let i = 0; i < pts.length; i += paso) out.push(pts[i]);
    if(out[out.length-1] !== pts[pts.length-1]) out.push(pts[pts.length-1]);
    return out.map(p => p.lat.toFixed(5) + ',' + p.lng.toFixed(5)).join(';');
  }
  async function publicarRushSocial(){
    const s = window.urbisRunnerSesionActual;
    if(!s || !(s.points||[]).length){ alert('No hay una actividad reciente para publicar.'); return; }
    const usuario = (typeof window.urbisUsuarioActual === 'function' && window.urbisUsuarioActual()) || '';
    if(!usuario){ alert('Inicia sesión para publicar en Social Rush.'); return; }
    if(!confirm('¿Publicar este recorrido en Social Rush?\n\nOtros usuarios de URBIS podrán ver tu ruta, distancia y ritmo. Publicar es totalmente voluntario.')) return;
    const btn = document.querySelector('[data-u52-call="rush-publicar"]');
    if(btn){ btn.disabled = true; btn.textContent = 'Publicando…'; }
    const desc = [usuario, s.type||'correr', (Number(s.distanceKm)||0).toFixed(2), Math.round(s.elapsed||0), Math.round(s.paceSecKm||0), s.createdAt||new Date().toISOString(), puntosAPolyline(s.points, 60)].join('~');
    const p0 = s.points[0];
    const fila = { tipo:'🏃 Social Rush', lat:String(p0.lat), lng:String(p0.lng), descripcion:desc, fecha:new Date().toISOString() };
    try{
      await window.urbisGuardarFila(fila);
      (window.urbisRushSocial = window.urbisRushSocial || []).push(fila);
      if(btn){ btn.textContent = '✅ Publicado en Social Rush'; }
      try{ if(typeof showAchievementToast==='function') showAchievementToast('Recorrido publicado','Social Rush 🌍'); }catch(e){}
    }catch(e){
      alert('No se pudo publicar: ' + (e && e.message || e));
      if(btn){ btn.disabled = false; btn.textContent = '🌍 Publicar en Social Rush'; }
    }
  }
  let _rushSocialTab = 'comunidad';
  window.urbisRenderRushSocial = function(tab){
    if(tab) _rushSocialTab = tab;
    const cont = document.getElementById('u52-rushsocial-content');
    if(!cont) return;
    const filas = Array.isArray(window.urbisRushSocial) ? window.urbisRushSocial : [];
    if(!filas.length && !window._rushSocialCargado){
      // Primer ingreso sin datos en memoria: refrescar desde la base una vez.
      window._rushSocialCargado = true;
      cont.innerHTML = '<div class="u52-empty-card rush-empty"><span>⏳</span><div><b>Cargando Social Rush…</b><small>Buscando recorridos publicados.</small></div></div>';
      try{ if(typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos(); }catch(e){}
      setTimeout(()=>{ try{ window.urbisRenderRushSocial(); }catch(e){} }, 1600);
      return;
    }
    const parse = f => { const d = String(f.descripcion||'').split('~'); return { usuario:d[0]||'', type:d[1]||'', km:Number(d[2])||0, elapsed:Number(d[3])||0, pace:Number(d[4])||0, createdAt:d[5]||f.fecha||'', poly:d[6]||'' }; };
    let items = filas.map(parse).filter(x => x.usuario && x.km > 0);
    const yo = ((typeof window.urbisUsuarioActual === 'function' && window.urbisUsuarioActual()) || '').toLowerCase();
    if(_rushSocialTab === 'amigos'){
      let amigos = [];
      if(Array.isArray(window.urbisAmigosFromServer) && window.urbisAmigosFromServer.length) amigos = window.urbisAmigosFromServer.map(f => String(f.usuario||'').toLowerCase());
      else if(typeof urbisMisContactos === 'function'){ try{ amigos = (urbisMisContactos('todos')||[]).map(c => String(c).toLowerCase()); }catch(e){} }
      items = items.filter(x => amigos.includes(x.usuario.toLowerCase()));
    }
    items.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const _labelTipo = t=>({'correr':'Carrera 🏃','ciclismo':'Ciclismo 🚲','caminar':'Caminata 👣','senderismo':'Senderismo ⛰️'})[t]||'Actividad ⚡';
    let html = `<div class="mis-tabs rush-social-tabs">
      <button class="mis-tab ${_rushSocialTab==='comunidad'?'active':''}" onclick="window.urbisRenderRushSocial('comunidad')">🌍 Comunidad</button>
      <button class="mis-tab ${_rushSocialTab==='amigos'?'active':''}" onclick="window.urbisRenderRushSocial('amigos')">👥 Amigos</button>
    </div>`;
    if(!items.length){
      html += _rushSocialTab === 'amigos'
        ? '<div class="u52-empty-card rush-empty"><span>👥</span><div><b>Tus amigos aún no publican</b><small>Cuando un amigo publique un recorrido, aparecerá aquí.</small></div></div>'
        : '<div class="u52-empty-card rush-empty"><span>🌍</span><div><b>Aún no hay recorridos publicados</b><small>Termina una actividad y toca "Publicar en Social Rush" para inaugurar el muro.</small></div></div>';
    } else {
      html += '<div class="rush-social-list">' + items.map(x => `
        <div class="rush-social-card">
          <div class="rush-social-head"><span class="rush-social-av">${x.usuario.toLowerCase()===yo?'⭐':'🏃'}</span><div><b>@${esc(x.usuario)}</b><small>${esc(_labelTipo(x.type))} · ${new Date(x.createdAt).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</small></div></div>
          <canvas class="rush-social-mini" data-rush-poly="${esc(x.poly)}" width="280" height="90"></canvas>
          <div class="rush-social-stats"><span><b>${x.km.toFixed(2)}</b> km</span><span><b>${fmtTime(x.elapsed)}</b> tiempo</span><span><b>${fmtPace(x.pace)}</b> /km</span></div>
        </div>`).join('') + '</div>';
    }
    cont.innerHTML = html;
    // Mini-mapa de cada tarjeta: la polyline publicada, normalizada al canvas.
    cont.querySelectorAll('canvas[data-rush-poly]').forEach(cv => {
      try{
        const pts = (cv.dataset.rushPoly||'').split(';').map(s => s.split(',').map(Number)).filter(p => p.length === 2 && !isNaN(p[0]));
        if(pts.length < 2){ cv.style.display = 'none'; return; }
        const ctx = cv.getContext('2d');
        const lats = pts.map(p=>p[0]), lngs = pts.map(p=>p[1]);
        const mLa = Math.min(...lats), MLa = Math.max(...lats), mLn = Math.min(...lngs), MLn = Math.max(...lngs);
        const pad = 12, W = cv.width, H = cv.height;
        const sx = v => pad + (MLn === mLn ? 0.5 : (v - mLn) / (MLn - mLn)) * (W - 2*pad);
        const sy = v => H - pad - (MLa === mLa ? 0.5 : (v - mLa) / (MLa - mLa)) * (H - 2*pad);
        ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#ff2d78';
        ctx.beginPath(); pts.forEach((p,i) => i ? ctx.lineTo(sx(p[1]), sy(p[0])) : ctx.moveTo(sx(p[1]), sy(p[0]))); ctx.stroke();
      }catch(e){}
    });
  };
  const URBIS_EVENT_SECTIONS = [
    {
      id:'deporte', label:'Deportivo', icon:'⚽',
      items:[
        ['ev-futbol','⚽','Fútbol / Microfútbol'],
        ['ev-basket','🏀','Baloncesto'],
        ['ev-tenis','🎾','Tenis / Pádel'],
        ['ev-atletismo','🏃','Atletismo / Carrera'],
        ['ev-ciclismo','🚲','Ciclismo'],
        ['ev-patinaje','⛸️','Patinaje'],
        ['ev-natacion','🏊','Natación'],
        ['ev-gimnasio','💪','Gimnasio / CrossFit'],
        ['ev-artes-marciales','🥋','Artes marciales'],
        ['ev-senderismo','⛰️','Senderismo / Marcha'],
        ['ev-maraton','🏅','Maratón / Evento deportivo masivo'],
      ]
    },
    {
      id:'cultural', label:'Cultural', icon:'🎭',
      items:[
        ['ev-concierto','🎤','Concierto / Show musical'],
        ['ev-teatro','🎭','Teatro / Obra'],
        ['ev-circo','🎪','Circo / Espectáculo'],
        ['ev-danza','💃','Danza / Ballet'],
        ['ev-exposicion','🖼️','Exposición de arte'],
        ['ev-cine','🎬','Cine / Festival audiovisual'],
        ['ev-folklorico','🪘','Festival folclórico'],
        ['ev-diversidad-cultural','🌈','Festival de diversidad cultural / migrante'],
      ]
    },
    {
      id:'comunitario', label:'Comunitario', icon:'🤝',
      items:[
        ['ev-jac','🤝','Reunión JAC / Asamblea'],
        ['ev-limpieza','🧹','Jornada de limpieza'],
        ['ev-brigada','❤️','Brigada de salud'],
        ['ev-arboles','🌳','Siembra de árboles'],
        ['ev-minga','👐','Minga comunitaria'],
        ['ev-olla','🍲','Olla comunitaria'],
        ['ev-integracion','🎉','Integración barrial'],
        ['ev-vacunacion','💉','Jornada de vacunación'],
      ]
    },
    {
      id:'comercial', label:'Comercial', icon:'🛍️',
      items:[
        ['ev-feria-emprend','💡','Feria de emprendedores'],
        ['ev-mercado','🌾','Mercado campesino'],
        ['ev-remate','🏷️','Remate / Liquidación'],
        ['ev-lanzamiento','🚀','Lanzamiento de negocio'],
        ['ev-muestra','🏬','Muestra empresarial'],
        ['ev-feria-gastro','🍔','Feria gastronómica'],
        ['ev-mercado-nocturno','🌙','Mercado nocturno'],
      ]
    },
    {
      id:'educativo', label:'Educativo', icon:'📚',
      items:[
        ['ev-taller','🎨','Taller / Curso'],
        ['ev-conferencia','🎙️','Conferencia / Charla'],
        ['ev-capacitacion','🛠️','Capacitación técnica'],
        ['ev-jornada-edu','📖','Jornada educativa'],
        ['ev-libro','📚','Feria del libro'],
      ]
    },
    {
      id:'otro', label:'Otro', icon:'✨',
      items:[
        ['ev-politico','📢','Evento político / Debate'],
        ['ev-religioso','⛪','Evento religioso'],
        ['ev-verbena','🎆','Verbena / Festival'],
        ['ev-familiar','👨‍👩‍👧','Día de la familia'],
        ['ev-diversidad','🤗','Evento de diversidad e inclusión'],
        ['ev-esports','🎮','Evento de videojuegos / e-sports'],
        ['ev-otro','✨','Otro (personalizado)'],
      ]
    }
  ];

  const URBIS_EVENTS_MAP = URBIS_EVENT_SECTIONS.reduce((acc, s)=>{ s.items.forEach(([id,icon,label])=>{ acc[id]={id,icon,label,section:s.id,sectionLabel:s.label}; }); return acc; }, {});

  // Pestaña PREMIUM (Evento Áurea) — solo visible para admin / usuarios autorizados.
  const URBIS_EVENT_PREMIUM_SECTION = { id:'premium', label:'Premium', icon:'✨', items:[ ['ev-coliseo','✨','Evento Áurea'] ] };
  URBIS_EVENTS_MAP['ev-coliseo'] = { id:'ev-coliseo', icon:'✨', label:'Evento Áurea', section:'premium', sectionLabel:'Evento Premium' };
  function eventSectionsVisibles(){
    const base = URBIS_EVENT_SECTIONS.slice();
    try{ if(window.urbisPuedeCrearEspecial && window.urbisPuedeCrearEspecial()) base.push(URBIS_EVENT_PREMIUM_SECTION); }catch(e){}
    return base;
  }

  let communityEventComposer = { activeSection:'deporte', selectedTypeId:'', panel:null };

  function ensureQuickEventPanel(){
    if(communityEventComposer.panel) return communityEventComposer.panel;
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return null;
    const panel = document.createElement('div');
    panel.id = 'u52-quick-event-panel';
    panel.className = 'u52-quick-report-panel u52-quick-event-panel';
    panel.hidden = true;
    mapScreen.appendChild(panel);
    communityEventComposer.panel = panel;
    return panel;
  }

  function hideQuickEventPanel(){
    const panel = ensureQuickEventPanel();
    if(panel) panel.hidden = true;
    communityEventComposer.selectedTypeId = '';
  }

  function renderQuickEventCategories(){
    const panel = ensureQuickEventPanel();
    const point = communityComposer.selected;
    if(!panel || !point) return;
    const secciones = eventSectionsVisibles();
    const active = secciones.find(s=>s.id===communityEventComposer.activeSection) || secciones[0];
    const tabs = secciones.map(s=>`<button type="button" class="${s.id===active.id?'active':''} ${s.id==='premium'?'u52-ev-tab-premium':''}" data-u52-event-section="${s.id}"><span>${s.icon}</span><b>${s.label}</b></button>`).join('');
    const cards = active.items.map(([id,icon,label])=>`<button type="button" class="u52-alert-card" data-u52-event-id="${id}"><span>${icon}</span><b>${esc(label)}</b></button>`).join('');
    panel.innerHTML = `
      <div class="u52-quick-report-head">
        <button type="button" data-u52-call="quick-event-close" aria-label="Cerrar">×</button>
        <div><b>Tipo de evento</b><small>Elige la categoría</small></div>
      </div>
      <div class="u52-quick-report-tabs">${tabs}</div>
      <div class="u52-quick-report-grid">${cards}</div>`;
    panel.hidden = false;
  }

  function openQuickEventDetails(typeId){
    const evType = URBIS_EVENTS_MAP[typeId];
    const point = communityComposer.selected;
    const panel = ensureQuickEventPanel();
    if(!evType || !point || !panel) return;
    communityEventComposer.selectedTypeId = typeId;
    if(typeId === 'ev-coliseo'){
      panel.innerHTML = `
        <div class="u52-quick-report-head">
          <button type="button" data-u52-call="quick-event-back" aria-label="Volver">‹</button>
          <div><b>✨ Evento Áurea</b><small>Evento premium · premio en dinero real</small></div>
          <button type="button" data-u52-call="quick-event-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-quick-report-selected u52-coliseo-selected"><span>✨</span><div><b>Competencia premium</b><small>El #1 se lleva el premio</small></div></div>
        <div class="u52-quick-report-form">
          <input id="ev-titulo-custom" type="text" maxlength="80" placeholder="Nombre del Evento Áurea *" value="Evento Áurea">
          <input id="ev-premio" type="text" maxlength="60" placeholder="💰 Premio real (ej: 100.000 COP) *">
          <textarea id="ev-descripcion" maxlength="220" placeholder="📜 ¿En qué consiste el juego?">Reto de reflejos: el que más puntos haga, gana.</textarea>
          <label class="u52-ev-horas"><span>⏳ Termina en (horas)</span><input id="ev-horas" type="number" min="1" max="720" value="24"></label>
          <button type="button" class="u52-quick-publish u52-coliseo-publish" data-u52-call="quick-event-publish">✨ Publicar Evento Áurea</button>
        </div>`;
      panel.hidden = false;
      return;
    }
    const isOtro = typeId === 'ev-otro';
    panel.innerHTML = `
      <div class="u52-quick-report-head">
        <button type="button" data-u52-call="quick-event-back" aria-label="Volver">‹</button>
        <div><b>Nuevo evento</b><small>${esc(evType.sectionLabel)}</small></div>
        <button type="button" data-u52-call="quick-event-close" aria-label="Cerrar">×</button>
      </div>
      <div class="u52-quick-report-selected"><span>${evType.icon}</span><div><b>${esc(evType.label)}</b></div></div>
      <div class="u52-quick-report-form">
        <input id="ev-direccion" type="text" maxlength="120" placeholder="Dirección o lugar del evento *" autocomplete="street-address">
        ${isOtro ? `<input id="ev-titulo-custom" type="text" maxlength="80" placeholder="Nombre del evento *">` : `<input id="ev-titulo-custom" type="hidden" value="${esc(evType.label)}">`}
        <textarea id="ev-descripcion" maxlength="220" placeholder="Descripción del evento (opcional)"></textarea>
        <div class="u52-ev-datetime">
          <label><span>Fecha</span><input id="ev-fecha" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
          <label><span>Hora inicio</span><input id="ev-hora" type="time" value="08:00"></label>
        </div>
        <label class="u52-quick-photo"><span class="u52-photo-label-text">📷 Foto del evento (opcional)</span><input type="file" id="ev-foto-file" accept="image/*" capture="environment"></label>
        <button type="button" class="u52-quick-publish" data-u52-call="quick-event-publish">Publicar evento</button>
      </div>`;
    panel.hidden = false;
    const fileInput = panel.querySelector('#ev-foto-file');
    if(fileInput) fileInput.addEventListener('change', function(){
      const lbl = panel.querySelector('.u52-photo-label-text');
      if(lbl) lbl.textContent = this.files && this.files[0] ? '✓ Foto lista' : '📷 Foto del evento (opcional)';
    });
  }

  function showQuickEventCategories(){
    if(!communityComposer.selected){ beginCommunityMapSelection(); return; }
    hideCommunityChooser(false);
    communityEventComposer.selectedTypeId = '';
    renderQuickEventCategories();
  }

  async function publishQuickEvent(btn){
    const point = communityComposer.selected;
    const evType = URBIS_EVENTS_MAP[communityEventComposer.selectedTypeId];
    if(!point || !evType) return;
    const panel = communityEventComposer.panel;

    // Evento Áurea (premium): se crea en el punto tocado, no por GPS.
    if(communityEventComposer.selectedTypeId === 'ev-coliseo'){
      if(!(window.urbisPuedeCrearEspecial && window.urbisPuedeCrearEspecial())){ alert('Solo el administrador o usuarios autorizados pueden crear el Evento Áurea.'); return; }
      const titulo = (panel?.querySelector('#ev-titulo-custom')?.value || 'Evento Áurea').trim();
      const premio = (panel?.querySelector('#ev-premio')?.value || '').trim();
      const detalle = (panel?.querySelector('#ev-descripcion')?.value || '').trim();
      const horas = Math.max(1, parseInt(panel?.querySelector('#ev-horas')?.value, 10) || 24);
      if(!premio){ alert('Indica el premio en dinero para el ganador.'); return; }
      try{
        btn.disabled = true; btn.innerText = 'Publicando...';
        if(typeof window.urbisCrearEventoPremiumEn === 'function'){
          await window.urbisCrearEventoPremiumEn(String(point.lat), String(point.lng), titulo, premio, detalle, horas);
        }
        if(typeof hideQuickEventPanel === 'function') hideQuickEventPanel();
        if(typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos();
      }catch(e){ alert('No se pudo crear el Evento Áurea: ' + (e && e.message || e)); }
      finally{ if(btn){ btn.disabled = false; btn.innerText = '✨ Publicar Evento Áurea'; } }
      return;
    }

    const direccionEl = panel && panel.querySelector('#ev-direccion');
    const direccion = (direccionEl?.value || '').trim();
    if(!direccion){ alert('Ingresa la dirección o lugar del evento.'); direccionEl?.focus(); return; }

    const tituloEl = panel && panel.querySelector('#ev-titulo-custom');
    const titulo = (tituloEl?.value || evType.label).trim() || evType.label;

    const desc = (panel?.querySelector('#ev-descripcion')?.value || '').trim();
    const fecha = panel?.querySelector('#ev-fecha')?.value || new Date().toISOString().slice(0,10);
    const hora = panel?.querySelector('#ev-hora')?.value || '';

    const _sess = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null;
    const creador = (_sess && _sess.usuario) ? _sess.usuario : 'Ciudadano';

    const fileInput = panel && panel.querySelector('#ev-foto-file');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    try{
      btn.disabled = true;
      btn.innerText = 'Publicando...';
      let fotoData = 'N/A';
      if(file){
        btn.innerText = '📷 Procesando...';
        try{ if(typeof window.urbanProcesarImagen === 'function') fotoData = await window.urbanProcesarImagen(file); }catch(e){}
      }
      const descripcionEvento = [titulo, direccion, desc || 'Sin descripción', fecha, hora, creador, fotoData, evType.sectionLabel, evType.icon].join(' | ');
      const res = await window.urbisGuardarFila({ tipo:'📅 Eventos', lat:String(point.lat), lng:String(point.lng), descripcion:descripcionEvento, fecha: new Date().toISOString() });
      if(res && res.ok === false && res.status) throw new Error(`HTTP ${res.status}`);
      if(typeof playSuccessSound === 'function') playSuccessSound();
      try{ if(typeof showAchievementToast === 'function') showAchievementToast('Evento publicado', titulo); }catch(e){}
      hideQuickEventPanel();
      hideCommunityChooser(false);
      setTimeout(()=>{ try{ if(typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos(); }catch(e){} }, 3000);
    }catch(err){
      alert('No se pudo publicar el evento: ' + (err.message || err));
      btn.disabled = false;
      btn.innerText = 'Publicar evento';
    }
  }

  const URBIS_QUICK_REPORT_SECTIONS = [
    {
      id:'vial', label:'Vial y movilidad', icon:'🚦', hint:'Alertas rápidas de movilidad, infraestructura y ciudad.',
      items:[
        ['preventive-area','🛡️','Área preventiva','🚨 Alertas y Riesgos Urbanos'],
        ['traffic-crash','🚗','Accidente de tránsito','🚗 Reportes de Tráfico'],
        ['traffic-check','🚓','Retén de tránsito','🚗 Reportes de Tráfico'],
        ['road-hole','🕳️','Hueco en la vía','🚨 Alertas y Riesgos Urbanos'],
        ['road-closed','⛔','Vía cerrada','🚗 Reportes de Tráfico'],
        ['traffic-light','🚦','Semáforo dañado','🚗 Reportes de Tráfico'],
        ['road-work','🚧','Obra en la vía','🚗 Reportes de Tráfico'],
        ['heavy-traffic','🚙','Tráfico pesado','🚗 Reportes de Tráfico'],
        ['fallen-tree','🌳','Árbol caído u obstáculo','🚨 Alertas y Riesgos Urbanos'],
        ['stalled-car','🛞','Vehículo varado','🚗 Reportes de Tráfico'],
        ['open-drain','🕳️','Alcantarilla destapada','🚨 Alertas y Riesgos Urbanos'],
        ['water-leak','💧','Fuga de agua','🚨 Alertas y Riesgos Urbanos'],
        ['street-light','💡','Alumbrado público dañado','🚨 Alertas y Riesgos Urbanos'],
        ['trash','🗑️','Basura acumulada','🚨 Alertas y Riesgos Urbanos'],
        ['blocked-sidewalk','🚶','Andén obstruido','🚨 Alertas y Riesgos Urbanos'],
        ['blocked-bike-lane','🚲','Cicloruta bloqueada','🚗 Reportes de Tráfico'],
        ['animal-road','🐾','Animal en la vía','🚨 Alertas y Riesgos Urbanos'],
        ['fallen-pole','⚡','Poste caído','🚨 Alertas y Riesgos Urbanos'],
        ['wire-road','🔌','Cable en la vía','🚨 Alertas y Riesgos Urbanos'],
        ['sign-damaged','🚸','Señal dañada','🚗 Reportes de Tráfico'],
        ['bridge-bad','🌉','Puente o paso peatonal dañado','🚨 Alertas y Riesgos Urbanos'],
        ['bike-lane-damaged','🚲','Cicloruta en mal estado','🚗 Reportes de Tráfico'],
        ['bike-rack','🅿️','Bicicletero faltante o dañado','🚨 Alertas y Riesgos Urbanos'],
        ['crosswalk-missing','🚸','Cruce peatonal sin demarcación','🚨 Alertas y Riesgos Urbanos'],
        ['footbridge-rail','🌉','Puente peatonal sin baranda','🚨 Alertas y Riesgos Urbanos'],
        ['livestock-road','🐄','Semoviente suelto en vía','🚗 Reportes de Tráfico'],
        ['border-congestion','🛂','Congestión en paso fronterizo','🚗 Reportes de Tráfico']
      ]
    },
    {
      id:'security', label:'Seguridad y emergencias', icon:'🛡️', hint:'Reporta la situación. No publiques nombres, rostros ni datos personales.', sensitive:true,
      items:[
        ['robbery','🚨','Robo','🚨 Alertas y Riesgos Urbanos'],
        ['robbery-attempt','⚠️','Intento de robo','🚨 Alertas y Riesgos Urbanos'],
        ['assault','🚨','Asalto','🚨 Alertas y Riesgos Urbanos'],
        ['suspicious','👀','Persona sospechosa','🚨 Alertas y Riesgos Urbanos'],
        ['fight','⚠️','Riña o pelea','🚨 Alertas y Riesgos Urbanos'],
        ['vandalism','🧱','Vandalismo','🚨 Alertas y Riesgos Urbanos'],
        ['detonations','🔊','Disparos o detonaciones','🚨 Alertas y Riesgos Urbanos'],
        ['serious-security','🚨','Emergencia grave de seguridad','🚨 Alertas y Riesgos Urbanos'],
        ['aggression','⚠️','Violencia o agresión','🚨 Alertas y Riesgos Urbanos'],
        ['danger-zone','📍','Zona peligrosa','🚨 Alertas y Riesgos Urbanos'],
        ['harassment','🛡️','Acoso en espacio público','🚨 Alertas y Riesgos Urbanos'],
        ['threat','⚠️','Extorsión o amenaza','🚨 Alertas y Riesgos Urbanos'],
        ['substances','🚫','Consumo de sustancias en espacio público','🚨 Alertas y Riesgos Urbanos'],
        ['property-damage','🏚️','Daño a propiedad','🚨 Alertas y Riesgos Urbanos'],
        ['guerrilla-presence','⚠️','Presencia de guerrilla','🚨 Alertas y Riesgos Urbanos'],
        ['drug-use','💊','Consumo de drogas','🚨 Alertas y Riesgos Urbanos'],
        // Conflicto armado — pedido explícito: Colombia es un país en
        // conflicto y Cúcuta es zona fronteriza afectada. Mismo tratamiento
        // sensible que el resto de esta sección; SIN foto obligatoria (sería
        // peligroso e inapropiado pedir evidencia de un atentado o combate).
        ['attack-explosive','💣','Atentado o artefacto explosivo','🚨 Alertas y Riesgos Urbanos'],
        ['suspicious-package','🧨','Objeto o paquete sospechoso','🚨 Alertas y Riesgos Urbanos'],
        ['armed-combat','🪖','Combate armado o enfrentamiento','🚨 Alertas y Riesgos Urbanos'],
        ['illegal-checkpoint','🚷','Retén ilegal o armado','🚨 Alertas y Riesgos Urbanos'],
        ['forced-displacement','🏃','Desplazamiento forzado','🚨 Alertas y Riesgos Urbanos'],
        ['armed-threat','🎯','Amenaza armada a la comunidad','🚨 Alertas y Riesgos Urbanos'],
        // Ayuda urgente (antes sección "Emergencias y protección" aparte) —
        // se une acá porque es el mismo tipo de situación: personas en
        // riesgo que necesitan ayuda inmediata.
        ['need-ambulance','🚑','Necesito una ambulancia ahora','🚨 Alertas y Riesgos Urbanos'],
        ['mental-health-crisis','🧠','Persona en crisis de salud mental','🚨 Alertas y Riesgos Urbanos'],
        ['elder-abandonment','👴','Adulto mayor en abandono o riesgo','🚨 Alertas y Riesgos Urbanos'],
        ['minor-at-risk','🧒','Menor en situación de calle o riesgo','🚨 Alertas y Riesgos Urbanos']
      ]
    },
    {
      id:'natural', label:'Desastres y riesgo natural', icon:'🌪️', hint:'Fenómenos naturales, clima y riesgos del terreno.',
      items:[
        ['cyclone','🌪️','Ciclón','🌪️ Desastres Naturales y Clima'],
        ['earthquake','🌎','Sismo','🌪️ Desastres Naturales y Clima'],
        ['storm','⛈️','Tormenta','🌪️ Desastres Naturales y Clima'],
        ['tsunami-wave','🌊','Tsunami','🌪️ Desastres Naturales y Clima'],
        ['geological-damage','⛰️','Daño geológico','⛰️ Riesgos del Terreno'],
        ['river-rising','🌊','Nivel de río en aumento / riesgo de creciente','🌪️ Desastres Naturales y Clima'],
        // Movidos aquí desde Vial/Ambiente: son fenómenos naturales, no
        // fallas de infraestructura — quedan mejor agrupados por su causa.
        ['flood-road','🌊','Inundación en vía','🚨 Alertas y Riesgos Urbanos'],
        ['landslide','⛰️','Derrumbe o deslizamiento','🚨 Alertas y Riesgos Urbanos'],
        ['overflow','🌊','Desbordamiento de arroyo o canal','🚨 Alertas y Riesgos Urbanos'],
        ['rain-risk','🌧️','Riesgo por lluvia','🚨 Alertas y Riesgos Urbanos']
      ]
    },
    {
      id:'ambiental', label:'Ambiente y salud', icon:'🌿', hint:'Ambiente, salud pública y espacios comunitarios.',
      items:[
        ['fire-smoke','🔥','Incendio o humo visible','🚨 Alertas y Riesgos Urbanos'],
        ['pollution','🏭','Contaminación','Áreas Verdes y Ambiental'],
        ['bad-smell','💨','Mal olor fuerte','🚨 Alertas y Riesgos Urbanos'],
        ['noise','🔊','Ruido excesivo','🚨 Alertas y Riesgos Urbanos'],
        ['trash-burning','🔥','Quema de basura','🚨 Alertas y Riesgos Urbanos'],
        ['dark-zone','🌙','Zona sin iluminación','🚨 Alertas y Riesgos Urbanos'],
        ['stagnant-water','🦟','Agua estancada','🚨 Alertas y Riesgos Urbanos'],
        ['pest-danger','🐍','Plaga o animales peligrosos','Animal y Bienestar'],
        ['public-space','🚧','Espacio público invadido','🚨 Alertas y Riesgos Urbanos'],
        ['park-damage','🌳','Daño en parque o zona verde','Áreas Verdes y Ambiental'],
        ['industrial-noise','🏭','Ruido industrial fuera de horario','🚨 Alertas y Riesgos Urbanos'],
        ['water-source-pollution','🌊','Contaminación de fuente hídrica','Áreas Verdes y Ambiental'],
        ['vehicle-emissions','🚗','Emisión de gases vehicular/industrial','🚨 Alertas y Riesgos Urbanos'],
        ['crop-burning','🌾','Quema agrícola no controlada','🚨 Alertas y Riesgos Urbanos'],
        ['mosquito-breeding','🦟','Criadero de zancudos (dengue)','🚨 Alertas y Riesgos Urbanos'],
        ['market-sanitary-risk','🥬','Riesgo sanitario en plaza de mercado','🚨 Alertas y Riesgos Urbanos'],
        ['stray-animal','🐕','Animal callejero o herido','Animal y Bienestar'],
        ['animal-abuse','🚫','Maltrato animal','Animal y Bienestar'],
        ['wasp-nest','🐝','Nido de avispas o abejas peligroso','🚨 Alertas y Riesgos Urbanos'],
        ['rodents','🐀','Presencia de roedores','🚨 Alertas y Riesgos Urbanos']
      ]
    },
    {
      id:'espacio', label:'Espacio público y accesibilidad', icon:'🪑', hint:'Bancas, parques, patrimonio, accesibilidad y ocupación indebida.',
      items:[
        ['bench-damaged','🪑','Banca dañada','🚨 Alertas y Riesgos Urbanos'],
        ['playground-unsafe','🛝','Parque infantil inseguro','🚨 Alertas y Riesgos Urbanos'],
        ['public-bathroom','🚻','Baño público en mal estado','🚨 Alertas y Riesgos Urbanos'],
        ['fountain-broken','⛲','Bebedero dañado o sin agua','🚨 Alertas y Riesgos Urbanos'],
        ['shade-missing','🌳','Falta de sombra o arborización','Áreas Verdes y Ambiental'],
        ['bin-missing','🗑️','Caneca faltante o desbordada','🚨 Alertas y Riesgos Urbanos'],
        ['graffiti-heritage','🎨','Grafiti en sitio patrimonial','🚨 Alertas y Riesgos Urbanos'],
        ['monument-damage','🏛️','Deterioro de monumento histórico','🚨 Alertas y Riesgos Urbanos'],
        ['street-vendor-block','🛒','Venta ambulante bloqueando andén','🚨 Alertas y Riesgos Urbanos'],
        ['unauthorized-occupation','🏪','Ocupación no autorizada del espacio público','🚨 Alertas y Riesgos Urbanos'],
        ['ramp-damaged','♿','Rampa dañada o inexistente','🚨 Alertas y Riesgos Urbanos'],
        ['sidewalk-wheelchair','🦯','Andén sin acceso para silla de ruedas','🚨 Alertas y Riesgos Urbanos'],
        ['disabled-parking','🅿️','Parqueadero de discapacidad invadido','🚨 Alertas y Riesgos Urbanos'],
        ['traffic-light-sound','🔇','Semáforo sin señal sonora','🚨 Alertas y Riesgos Urbanos'],
        ['bus-stop-access','🚏','Parada de bus sin acceso','🚨 Alertas y Riesgos Urbanos']
      ]
    },
    {
      id:'servicios', label:'Servicios, vivienda y desarrollo', icon:'🏗️', hint:'Redes de servicios, construcción y ciudad preparada.',
      items:[
        ['gas-leak','🔥','Fuga de gas','🚨 Alertas y Riesgos Urbanos'],
        ['power-outage','🔌','Corte masivo de energía','🚨 Alertas y Riesgos Urbanos'],
        ['water-outage','🚰','Corte de agua programado','🚨 Alertas y Riesgos Urbanos'],
        ['internet-down','📶','Falla de internet o telecomunicaciones','🚨 Alertas y Riesgos Urbanos'],
        ['trash-collection-missed','🚛','Recolección de basura incumplida','🚨 Alertas y Riesgos Urbanos'],
        ['illegal-construction','🏗️','Construcción ilegal','🚨 Alertas y Riesgos Urbanos'],
        ['abandoned-building','🏚️','Predio o edificio abandonado','🚨 Alertas y Riesgos Urbanos'],
        ['informal-settlement','⚠️','Asentamiento informal en riesgo','🚨 Alertas y Riesgos Urbanos'],
        ['migrant-settlement','🏕️','Asentamiento de población migrante en riesgo','🚨 Alertas y Riesgos Urbanos'],
        ['first-aid-missing','🩹','Punto de primeros auxilios / desfibrilador faltante','🚨 Alertas y Riesgos Urbanos'],
        ['extinguisher-missing','🧯','Extintor faltante en edificio público','🚨 Alertas y Riesgos Urbanos'],
        ['hydrant-blocked','🚒','Hidrante bloqueado o dañado','🚨 Alertas y Riesgos Urbanos']
      ]
    }
  ];

  const MANDATORY_PHOTO_IDS = new Set([
    'road-hole','road-closed','traffic-light','road-work','fallen-tree','landslide',
    'stalled-car','open-drain','water-leak','street-light','trash','blocked-sidewalk',
    'blocked-bike-lane','fallen-pole','wire-road','sign-damaged','bridge-bad',
    'property-damage','fire-smoke','pollution','trash-burning','stagnant-water',
    'public-space','park-damage',
    // Categorías nuevas (v359) — mismo criterio que las de arriba: se pide
    // foto cuando es daño de infraestructura/ambiental verificable con una
    // imagen. Se deja SIN foto obligatoria lo sensible/social (personas en
    // riesgo, asentamientos, animales en movimiento) y lo que es difícil o
    // peligroso de fotografiar (ruido, tráfico, semoviente en vía).
    'bike-lane-damaged','footbridge-rail','ramp-damaged','bench-damaged',
    'playground-unsafe','public-bathroom','fountain-broken','bin-missing',
    'graffiti-heritage','monument-damage','gas-leak','trash-collection-missed',
    'illegal-construction','abandoned-building','wasp-nest','water-source-pollution',
    'crop-burning','market-sanitary-risk','mosquito-breeding','first-aid-missing',
    'extinguisher-missing','hydrant-blocked','disabled-parking'
  ]);

  const URBIS_QUICK_REPORTS = URBIS_QUICK_REPORT_SECTIONS.reduce((acc, section)=>{
    section.items.forEach(([id, icon, label, dim])=>{ acc[id] = {id, icon, label, dim, section:section.id, sensitive:!!section.sensitive}; });
    return acc;
  }, {});

  // Vínculo Android↔PC (pedido explícito): este catálogo (secciones, items,
  // iconos) es la ÚNICA fuente de verdad del panel de Alertas en AMBAS
  // plataformas. El panel de escritorio (js/10-visible-markers.js) lee estos
  // mismos globales para pintar exactamente los mismos datos e iconos que
  // Android — agregar/quitar una alerta aquí la agrega/quita en las dos.
  window.URBIS_QUICK_REPORT_SECTIONS = URBIS_QUICK_REPORT_SECTIONS;
  window.URBIS_QUICK_REPORTS = URBIS_QUICK_REPORTS;

  function ensureQuickReportItemsInDimensions(){
    try{
      if(typeof dimensiones === 'undefined') return;
      Object.values(URBIS_QUICK_REPORTS).forEach(item=>{
        if(!dimensiones[item.dim]) return;
        dimensiones[item.dim].items = Array.from(new Set([...(dimensiones[item.dim].items || []), item.label]));
      });
    }catch(e){}
  }

  function ensureQuickReportPanel(){
    if(communityComposer.reportPanel) return communityComposer.reportPanel;
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return null;
    const panel = document.createElement('div');
    panel.id = 'u52-quick-report-panel';
    panel.className = 'u52-quick-report-panel';
    panel.hidden = true;
    mapScreen.appendChild(panel);
    communityComposer.reportPanel = panel;
    return panel;
  }

  function hideQuickReportPanel(){
    const panel = ensureQuickReportPanel();
    if(panel) panel.hidden = true;
    communityComposer.selectedAlertId = '';
  }

  function closeProCityPanel(){
    hideQuickReportPanel();
    proCity.pickMode = ''; proCity.selected = null; proCity.dim = ''; proCity.editLat = '';
    try{ if(typeof tempMarker !== 'undefined' && tempMarker && window.map){ map.removeLayer(tempMarker); tempMarker = null; } }catch(e){}
    resetMapForCommunityReport();
    setMapReportStatus('');
  }

  function getActiveReportSection(){
    return URBIS_QUICK_REPORT_SECTIONS.find(s=>s.id === communityComposer.activeReportSection) || URBIS_QUICK_REPORT_SECTIONS[0];
  }

  function renderQuickReportCategories(){
    ensureQuickReportItemsInDimensions();
    const panel = ensureQuickReportPanel();
    const point = communityComposer.selected;
    if(!panel || !point) return;
    const active = getActiveReportSection();
    const tabs = URBIS_QUICK_REPORT_SECTIONS.map(s=>`<button type="button" class="${s.id===active.id?'active':''}" data-u52-report-section="${s.id}"><span>${s.icon}</span><b>${s.label}</b></button>`).join('');
    const cards = active.items.map(([id, icon, label])=>`<button type="button" class="u52-alert-card" data-u52-alert-id="${id}"><span>${icon}</span><b>${esc(label)}</b></button>`).join('');
    const safety = active.sensitive ? '<div class="u52-quick-report-safety">Informa la situación sin nombres, rostros, placas ni datos personales. Si hay peligro inmediato, contacta a emergencias.</div>' : '';
    panel.innerHTML = `
      <div class="u52-quick-report-head">
        <button type="button" data-u52-call="quick-report-close" aria-label="Cerrar">×</button>
        <div><b>Tipo de alerta</b><small>Elige una opción para este punto</small></div>
      </div>
      <div class="u52-quick-report-tabs">${tabs}</div>
      ${safety}
      <div class="u52-quick-report-grid">${cards}</div>`;
    panel.classList.remove('u52-procity-mode');
    panel.hidden = false;
  }

  function showQuickReportCategories(){
    if(!communityComposer.selected){
      beginCommunityMapSelection();
      return;
    }
    hideCommunityChooser(false);
    communityComposer.selectedAlertId = '';
    renderQuickReportCategories();
  }

  function openQuickReportDetails(alertId){
    const item = URBIS_QUICK_REPORTS[alertId];
    const point = communityComposer.selected;
    const panel = ensureQuickReportPanel();
    if(!item || !point || !panel) return;
    ensureQuickReportItemsInDimensions();
    communityComposer.selectedAlertId = alertId;
    const nombreLugar = item.label;
    // js/20 es un IIFE aparte: NO ve los globales del scope compartido (userEmailGlobal,
    // etc. → typeof 'undefined'). Por eso la identidad se toma SIEMPRE de la sesión,
    // que es la fuente fiable del vínculo usuario↔reporte.
    const _sess = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null;
    // PRIVACIDAD: el autor que se guarda/muestra es SIEMPRE el nombre de usuario,
    // nunca el nombre real. Si no hay usuario, se deriva del correo o 'Ciudadano'.
    const creadorNom = (_sess && _sess.usuario) || window.userUsernameGlobal || ((_sess && _sess.correo) ? String(_sess.correo).split('@')[0] : '') || 'Ciudadano';
    const rolStr     = (_sess && _sess.rol) || window.userRole || 'citizen';
    const correoReq  = (_sess && _sess.correo) || window.userEmailGlobal || 'No registrado';
    const cedulaReq  = (_sess && (_sess.cedula_numero || _sess.cedula)) || window.userCedulaGlobal || 'No registrado';
    const barrioReq  = (_sess && _sess.barrio) || window.userBarrioGlobal || 'Reporte ciudadano';
    const photoRequired = MANDATORY_PHOTO_IDS.has(alertId);
    window.__urbisCurrentFormContext = {
      cat:item.dim,
      lat:String(point.lat),
      lng:String(point.lng),
      isEdit:false,
      estadoVal:(rolStr === 'admin' || rolStr === 'gov') ? 'Aprobado' : 'Pendiente',
      creadorNom,
      creadorRolStr:rolStr,
      likesActuales:0,
      correoReq,
      cedulaReq,
      barrioReq,
      quickReport:true,
      quickIcon:item.icon,
      quickLabel:item.label,
      photoRequired
    };
    const sensitive = item.sensitive ? '<div class="u52-quick-report-safety">No escribas nombres, acusaciones directas, rostros ni datos personales. Reporta solo la situación.</div>' : '';
    const photoLabelText = photoRequired ? '📷 Foto obligatoria *' : '📷 Evidencia opcional';
    const photoClass = photoRequired ? 'u52-quick-photo required' : 'u52-quick-photo';
    panel.innerHTML = `
      <div class="u52-quick-report-head">
        <button type="button" data-u52-call="quick-report-back" aria-label="Volver">‹</button>
        <div><b>Nuevo reporte</b><small>Activo durante 8 horas</small></div>
        <button type="button" data-u52-call="quick-report-close" aria-label="Cerrar">×</button>
      </div>
      <div class="u52-quick-report-selected"><span>${item.icon}</span><div><b>${esc(item.label)}</b><small>${esc(item.dim.replace(/^\S+\s*/, ''))}</small></div></div>
      ${sensitive}
      <div class="u52-quick-report-form">
        <select id="sel-item" hidden><option value="${esc(item.label)}" selected>${esc(item.label)}</option></select>
        <input id="sel-nombre" type="hidden" value="${esc(nombreLugar)}">
        <select id="sel-estado" hidden><option value="Malo" selected>Malo</option></select>
        <select id="sel-mat" hidden><option value="N/A" selected>N/A</option></select>
        <input id="ins-foto" type="hidden" value="">
        <input id="ins-direccion" type="text" maxlength="120" placeholder="Dirección o punto de referencia *" autocomplete="street-address">
        <textarea id="ins-nota" maxlength="180" placeholder="Descripción corta opcional"></textarea>
        <label class="${photoClass}"><span class="u52-photo-label-text">${photoLabelText}</span><input type="file" id="ins-foto-file" accept="image/*" capture="environment"></label>
        <button type="button" class="u52-quick-publish" data-u52-call="quick-report-publish">Publicar reporte</button>
      </div>`;
    panel.classList.remove('u52-procity-mode');
    panel.hidden = false;
    const fileInput = panel.querySelector('#ins-foto-file');
    if(fileInput){
      fileInput.addEventListener('change', function(){
        const label = panel.querySelector('.u52-quick-photo');
        const txt = label && label.querySelector('.u52-photo-label-text');
        if(!label || !txt) return;
        if(this.files && this.files[0]){
          label.classList.add('has-file');
          txt.textContent = '✓ Foto lista';
        } else {
          label.classList.remove('has-file');
          txt.textContent = photoRequired ? '📷 Foto obligatoria *' : '📷 Evidencia opcional';
        }
      });
    }
  }

  function switchQuickReportSection(sectionId){
    if(!URBIS_QUICK_REPORT_SECTIONS.some(s=>s.id===sectionId)) return;
    communityComposer.activeReportSection = sectionId;
    renderQuickReportCategories();
  }

  function publishQuickReport(btn){
    const ctx = window.__urbisCurrentFormContext;
    if(!ctx || !ctx.quickReport) return;

    const direccionEl = document.getElementById('ins-direccion');
    const direccion = (direccionEl?.value || '').trim();
    if(!direccion){
      alert('Ingresa la dirección o punto de referencia del reporte.');
      direccionEl?.focus();
      return;
    }

    if(ctx.photoRequired){
      const fileInput = document.getElementById('ins-foto-file');
      if(!fileInput || !fileInput.files || !fileInput.files[0]){
        alert('Este tipo de reporte requiere una foto como evidencia.');
        return;
      }
    }

    // Limpiar formulario desktop del sidebar para evitar IDs duplicados (sel-item, sel-nombre, etc.)
    // que confunden a document.getElementById en enviarDatos.
    const _ic = document.getElementById('info-content');
    if(_ic) _ic.innerHTML = '';

    const nombreEl = document.getElementById('sel-nombre');
    if(nombreEl) nombreEl.value = direccion + ' — ' + (ctx.quickLabel || nombreEl.value);

    // Recientes de la Matriz de Usos (Pro City): al guardar un uso, queda como
    // acceso directo para volver a colocar el MISMO tipo en otro punto sin
    // navegar los dos niveles otra vez.
    if(ctx.cat === '🗺️ Matriz de Usos' && ctx.quickLabel){ try{ addMatrizRecent(ctx.quickLabel); }catch(e){} }

    try{
      btn.disabled = true;
      btn.dataset.originalText = btn.dataset.originalText || btn.innerText || 'Publicar reporte';
      btn.innerText = 'Publicando...';
      if(typeof window.enviarDatosDesdeFormulario === 'function') window.enviarDatosDesdeFormulario(btn);
      if(typeof window.urbisEsCategoriaProCity === 'function' && window.urbisEsCategoriaProCity(ctx.cat)){
        try{ tagProCityFolderIfNeeded(ctx.lat); }catch(e){}
      }
      setTimeout(()=>{ hideQuickReportPanel(); hideCommunityChooser(false); }, 1400);
      setTimeout(()=>{ try{ if(typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos(); }catch(e){} }, 3500);
    }catch(e){
      btn.disabled = false;
      btn.innerText = btn.dataset.originalText || 'Publicar reporte';
      console.warn('URBIS quick report failed', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // URBIS PRO CITY — mapeo urbano profesional (vivienda, comercio, verdes...)
  // Reutiliza el MISMO panel (#u52-quick-report-panel), el mismo pin y el
  // mismo pipeline de guardado (publishQuickReport → enviarDatosDesdeFormulario)
  // que los reportes ciudadanos, cambiando solo el contenido/las categorías.
  // ═══════════════════════════════════════════════════════════════════════
  // Entrada a Pro City: pedido explícito — "lo primero que quiero ver es el
  // mapa satelital, no menús". Se abre el mapa de inmediato y las categorías
  // viven en un panel flotante (FAB + hoja), no en una pantalla previa.
  function openProCityMap(){
    proCity.active = true; proCity.pickMode = ''; proCity.selected = null; proCity.dim = ''; proCity.editLat = '';
    resetMapForCommunityReport();
    show('map');
    ensureCommunityMapPicker();
    hideCommunityChooser(false);
    hideQuickReportPanel();
    updateProCityMapChrome(true);
    // Sin letrero pegado (bug reportado: el aviso "toca 🏙️ abajo" quedaba
    // fijo y nunca desaparecía). Las acciones de ubicar (GPS/mapa) viven
    // directo en la barra de abajo, no en un aviso ni burbuja aparte.
    setMapReportStatus('');
    // Dibuja los elementos ya georeferenciados (formas) al entrar al módulo.
    try{ renderProCityPoints(); }catch(e){}
  }

  // Ubicar PRIMERO (con GPS o tocando el mapa) y elegir la categoría DESPUÉS
  // — mismo espíritu que el flujo ciudadano (Reporte con mi ubicación / En
  // mapa), pero llevando a la hoja de categorías de Pro City en vez del panel
  // de reportes.
  function beginProCityLocationManual(){
    proCity.dim = ''; proCity.pickMode = 'manual'; proCity.selected = null; proCity.editLat = '';
    resetMapForCommunityReport();
    ensureCommunityMapPicker();
    hideCommunityChooser(false);
    hideQuickReportPanel();
    hideProCityCategorySheet();
    try{ window.urbisDisableReportMapClick = true; }catch(e){}
    setMapReportStatus('📍 Toca el mapa para ubicar lo que quieres mapear.');
  }

  function beginProCityLocationGps(){
    proCity.dim = ''; proCity.editLat = '';
    const usar = (lat, lng) => pickProCityPoint(lat, lng);
    if(mobileGps.last){ usar(Number(mobileGps.last.lat), Number(mobileGps.last.lng)); return; }
    if(!navigator.geolocation){ setMapReportStatus('Sin GPS disponible. Usa "En el mapa".'); return; }
    setMapReportStatus('Buscando tu ubicación GPS…');
    navigator.geolocation.getCurrentPosition(pos=>{
      onMobileGpsPoint(pos);
      usar(pos.coords.latitude, pos.coords.longitude);
    }, ()=>{ setMapReportStatus('Sin GPS. Usa "En el mapa".'); }, { enableHighAccuracy:true, maximumAge:1000, timeout:12000 });
  }


  // Título/subtítulo del topbar del mapa + fila de acciones rápidas
  // ("Reporte con mi ubicación / En mapa / Capas"): se cambian cuando el modo
  // Pro City está activo — pedido explícito: título "UrbisProCity" (misma
  // tipografía delgada de "Crear reporte o evento") y ocultar las acciones
  // de reporte ciudadano, porque este es un módulo nuevo/separado.
  function updateProCityMapChrome(activo){
    const titleB = app.querySelector('.u52-mapcentric-title b');
    const titleSmall = app.querySelector('.u52-mapcentric-title small');
    const actions = app.querySelector('.u52-mapcentric-actions:not(.u52-procity-actions)');
    const filterBtn = app.querySelector('.u52-procity-filter-btn');
    const cfilterBtn = app.querySelector('.u52-cfilter-btn');
    const visualToggle = app.querySelector('.u52-procity-visual-toggle');
    const activeFolderBtn = app.querySelector('.u52-procity-active-folder-btn');
    const viewFilterBtn = app.querySelector('.u52-procity-view-filter-btn');
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(titleB) titleB.textContent = activo ? 'UrbisProCity' : 'Reporte o evento';
    if(titleSmall) titleSmall.textContent = activo ? 'Mapeo urbano profesional' : 'Toca el mapa para ubicarlo';
    if(actions) actions.hidden = !!activo;
    // Botón de filtro de la matriz (arriba a la derecha, al lado del GPS): solo
    // en Pro City. El de reportes/eventos ciudadanos es lo opuesto: siempre
    // visible salvo en Pro City. Se marca la pantalla para el topbar a 4 cols.
    if(filterBtn) filterBtn.hidden = !activo;
    if(cfilterBtn) cfilterBtn.hidden = !!activo;
    // Botoncito flotante para alternar Emojis ↔ Colores/formas por categoría
    // (pedido explícito): solo tiene sentido dentro de Pro City.
    if(visualToggle){ visualToggle.hidden = !activo; updateProCityVisualToggleIcon(); }
    // Botoncito flotante para elegir/ver la carpeta cooperativa ACTIVA (pedido
    // explícito): se pone verde cuando el mapeo cooperativo está activo.
    if(activeFolderBtn){ activeFolderBtn.hidden = !activo; updateProCityActiveFolderBtn(); if(activo && !proCity.foldersLoaded) loadProCityFolders(); }
    // Botoncito flotante para elegir QUÉ se ve en el mapa (pedido explícito):
    // solo yo / mis amigos / una carpeta cooperativa / todo el mundo.
    if(viewFilterBtn){ viewFilterBtn.hidden = !activo; updateProCityViewFilterBtn(); }
    // Acceso rápido para dibujar el área de análisis (js/24) sin tener que
    // entrar antes a la pantalla de estadísticas.
    const dibujarBtn = app.querySelector('.u52-procity-dibujar-btn');
    if(dibujarBtn) dibujarBtn.hidden = !activo;
    if(mapScreen) mapScreen.classList.toggle('u52-procity-mapscreen', !!activo);
  }

  // BUG real reportado: al ir de Pro City DIRECTO a "Reportar" (o cualquier
  // entrada ciudadana al mapa), el router show() solo limpia el modo Pro City
  // cuando la pantalla destino es DISTINTA de 'map' — pero el flujo ciudadano
  // también usa la pantalla 'map', así que ese chequeo nunca se disparaba y
  // el botón de filtro ⛃ (y el resto del chrome de Pro City) se quedaba
  // "pegado" encima del módulo de reportes y eventos. Toda entrada ciudadana
  // al mapa debe llamar esto ANTES de mostrar la pantalla.
  function exitProCityModeIfActive(){
    if(!proCity.active) return;
    proCity.active = false;
    try{
      hideProCityCategorySheet(); hideProCityStats(); hideProCityFilterSheet();
      hideProCitySelectedPanel(); updateProCityMapChrome(false); renderProCityPoints();
    }catch(e){}
  }

  function showProCityCategorySheet(){
    if(typeof dimensiones === 'undefined') return;
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    let sheet = document.getElementById('u52-procity-sheet');
    if(!sheet){
      sheet = document.createElement('div');
      sheet.id = 'u52-procity-sheet';
      sheet.className = 'u52-procity-sheet';
      mapScreen.appendChild(sheet);
    }
    proCity.categorySearch = proCity.categorySearch || '';
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-category-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>🏙️ URBIS Pro City</b><small>Elige qué vas a ubicar</small></div>
          <button type="button" data-u52-call="procity-category-close" aria-label="Cerrar">×</button>
        </div>
        <input type="text" class="u52-matriz-search" id="u52-category-search" placeholder="🔎 Buscar en la Matriz de Usos (ej. hospital, cancha…)" value="${esc(proCity.categorySearch)}" oninput="window.urbisProCityCategorySearch(this.value)" autocomplete="off">
        <div class="u52-procity-grid" id="u52-procity-category-results"></div>
      </div>`;
    sheet.hidden = false;
    fillProCityCategoryResults();
  }

  function fillProCityCategoryResults(){
    const cont = document.getElementById('u52-procity-category-results');
    if(!cont || typeof dimensiones === 'undefined') return;
    const q = _norm(proCity.categorySearch);
    if(!q){
      // Pantalla principal de Pro City: las 10 categorías temáticas de la
      // Matriz de Usos (reemplaza el listado viejo de 13 dimensiones sueltas).
      cont.innerHTML = MATRIZ_GRUPOS.map(g=>{
        const total = g.usos.reduce((n,u)=>{ const x = PROCITY_MATRIZ_USOS.find(p=>p.u===u); return n + (x ? x.t.length : 0); }, 0);
        return `<button type="button" class="u52-procity-card" data-u52-procity-group-entry="${esc(g.id)}">
          <span class="u52-procity-card-ico">${g.i}</span>
          <b>${esc(g.t)}</b>
          <small>${g.usos.length} usos · ${total} tipos</small>
        </button>`;
      }).join('');
      return;
    }
    // Búsqueda directa sobre el listado extendido de la Matriz de Usos (48
    // usos × sus tipos exactos) — acceso inmediato sin tener que abrir la
    // tarjeta "Matriz de Usos" primero ni elegir ubicación antes de buscar.
    const hits = matrizFlatIndex().filter(x => _norm(x.tipo).includes(q) || _norm(x.uso).includes(q)).slice(0, 60);
    cont.innerHTML = hits.length
      ? hits.map(x=>`<button type="button" class="u52-procity-card" data-u52-procity-search-item="${esc(x.label)}"><span class="u52-procity-card-ico">${x.i}</span><b>${esc(x.tipo)}</b></button>`).join('')
      : `<div class="u52-matriz-empty">Sin resultados para “${esc(proCity.categorySearch)}”.</div>`;
  }
  window.urbisProCityCategorySearch = function(val){ proCity.categorySearch = val; fillProCityCategoryResults(); };

  // Al elegir un resultado del buscador (ya viene con uso+tipo exactos), se
  // salta directo a pedir la ubicación en el mapa y, apenas se elige el
  // punto, se abre la ficha de ESE tipo sin pasar por los dos niveles.
  // Entrar directo a una categoría de la Matriz de Usos desde la pantalla
  // principal de Pro City (ya no se eligen primero las 13 dimensiones viejas).
  function beginProCityGroupSelection(groupId){
    if(typeof dimensiones === 'undefined' || !dimensiones[MATRIZ_USOS_KEY]) return;
    const grupo = MATRIZ_GRUPOS.find(g=>g.id === groupId);
    proCity.dim = MATRIZ_USOS_KEY; proCity.active = true;
    proCity.matrizUse = ''; proCity.matrizSearch = '';
    proCity.matrizGroup = groupId;
    hideProCityCategorySheet();
    if(proCity.selected){ renderProCityItems(); return; }
    proCity.pickMode = 'manual'; proCity.selected = null;
    resetMapForCommunityReport();
    ensureCommunityMapPicker();
    hideCommunityChooser(false);
    hideQuickReportPanel();
    try{ window.urbisDisableReportMapClick = true; }catch(e){}
    setMapReportStatus(`📍 Toca el mapa para ubicar: <b>${esc(grupo ? grupo.t : 'Matriz de Usos')}</b>`);
  }

  function pickProCityFromSearch(label){
    const uso = label.split(' · ')[0] || '';
    proCity.categorySearch = '';
    proCity.matrizPendingItem = label;
    beginProCityMapSelection(MATRIZ_USOS_KEY);
  }

  function hideProCityCategorySheet(){
    const sheet = document.getElementById('u52-procity-sheet');
    if(sheet) sheet.hidden = true;
  }

  // Estadísticas: cuántos elementos urbanos se han mapeado/georeferenciado
  // por categoría técnica, contando directamente sobre los datos ya cargados
  // (globalData), sin llamadas extra al backend.
  // Pestaña activa del panel 📊: "totales" (conteo por categoría, de TODOS)
  // o "mios" (lista individual de lo que YO he georreferenciado) — pedido
  // explícito: "agrega mis georeferenciaciones en el módulo de procity para
  // tener visual de todo lo que hemos georeferenciado".
  proCity.statsTab = 'totales';
  function showProCityStats(){
    if(typeof dimensiones === 'undefined') return;
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    if(!proCity.foldersLoaded) loadProCityFolders();
    const datosCrudo = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    // Pedido explícito: "que no me sume cosas de Chinácota" — Totales solo
    // cuenta lo que cae dentro del radio de Cúcuta (ver proCityEnRadioCucuta).
    const datos = datosCrudo.filter(p => p && proCityEnRadioCucuta(p));
    const dimSet = new Set(PRO_CITY_DIMS);
    const conteos = {};
    let total = 0;
    PRO_CITY_DIMS.forEach(dim=>{ conteos[dim] = 0; });
    datos.forEach(p=>{ if(p && Object.prototype.hasOwnProperty.call(conteos, p.tipo)){ conteos[p.tipo]++; total++; } });
    // Conteo por GRUPO (las 10 categorías compactas que ya se ven al elegir
    // dónde mapear: Vivienda y ocio, Comercio y economía…) dentro del radio
    // de Cúcuta — pedido explícito: mostrar tal cual se ve al mapear, con
    // TODAS las categorías (incluyendo las que dan 0%, antes desaparecían).
    const conteoGrupos = {};
    let totalMatriz = 0;
    datos.forEach(p=>{
      if(!p || p.tipo !== MATRIZ_USOS_KEY) return;
      const uso = _procityPuntoUso(p);
      const g = MATRIZ_GRUPOS.find(gr => gr.usos.includes(uso));
      const gid = g ? g.id : 'mixtos';
      conteoGrupos[gid] = (conteoGrupos[gid] || 0) + 1;
      totalMatriz++;
    });

    const mios = datos.filter(p => p && dimSet.has(p.tipo) && esPropioProCity(p));
    mios.sort((a,b) => new Date(b.fecha||0).getTime() - new Date(a.fecha||0).getTime());
    const deAmigos = datos.filter(p => p && dimSet.has(p.tipo) && !esPropioProCity(p) && esDeAmigoProCity(p));
    deAmigos.sort((a,b) => new Date(b.fecha||0).getTime() - new Date(a.fecha||0).getTime());

    const tabs = `<div class="u52-procity-stats-tabs">
        <button type="button" class="${proCity.statsTab==='totales'?'active':''}" data-u52-call="procity-stats-tab-totales">Totales</button>
        <button type="button" class="${proCity.statsTab==='mios'?'active':''}" data-u52-call="procity-stats-tab-mios">Mis mapeos (${mios.length})</button>
        <button type="button" class="${proCity.statsTab==='amigos'?'active':''}" data-u52-call="procity-stats-tab-amigos">👥 Amigos (${deAmigos.length})</button>
        <button type="button" class="${proCity.statsTab==='carpetas'?'active':''}" data-u52-call="procity-stats-tab-carpetas">🤝 Cooperativo (${proCity.myFolders.length})</button>
        <button type="button" class="${proCity.statsTab==='analisis'?'active':''}" data-u52-call="procity-stats-tab-analisis">📊 Análisis</button>
      </div>`;

    function _mineCard(p, permiteSeleccion){
      const d = String(p.descripcion||'').split(' | ');
      const dim = String(p.tipo||'');
      // BUG real (mismo de Cooperativo): dim = p.tipo es SIEMPRE
      // "🗺️ Matriz de Usos" para los 48 usos, así que dimensiones[dim] daba
      // un ícono/color genérico IGUAL para todos. Se usa el uso real.
      const esMatriz = dim === MATRIZ_USOS_KEY;
      const uso = esMatriz ? _procityPuntoUso(p) : '';
      const usoInfo = esMatriz ? PROCITY_MATRIZ_USOS.find(x=>x.u === uso) : null;
      const dInfo = usoInfo ? { color:'#6b70e0', icon:usoInfo.i } : (dimensiones[dim] || { color:'#6b70e0', icon:'📍' });
      // Pedido explícito: el título de la tarjeta debe ser la categoría de
      // grupo (ej. "Vivienda y ocio"), y el uso específico (ej. "Residencial")
      // queda como subtítulo pequeño — así todo el sistema queda anclado a
      // la Matriz de Grupos, en vez de mostrar la dirección/nombre suelto.
      const grupoDeUso = esMatriz ? MATRIZ_GRUPOS.find(gr => gr.usos.includes(uso)) : null;
      const label = esMatriz ? (grupoDeUso ? grupoDeUso.t : uso) : ((d[1] && d[1].trim()) ? d[1] : (d[0] || 'Elemento urbano'));
      const subUso = esMatriz ? uso : dim;
      const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '';
      const lat = String(p.lat);
      // Selección múltiple (pedido explícito): "seleccionar varios mapeos y
      // agregarlos a la carpeta" — se activa con el botón Seleccionar o
      // manteniendo presionada una tarjeta (long-press). Pedido explícito:
      // el ícono representativo se queda SIEMPRE visible (ayuda visualmente
      // a identificar qué es cada mapeo) — la casilla va aparte, donde antes
      // estaba la flechita, en vez de reemplazar el ícono.
      const enSeleccion = permiteSeleccion && proCity.selectMode;
      const marcado = enSeleccion && proCity.selectedLats.has(lat);
      // Pedido explícito: si el mapeo ya pertenece a una carpeta cooperativa,
      // mostrar un subtítulo pequeño que lo indique (con el nombre si se
      // conoce el proyecto).
      const folderIdDeEste = proCityPointFolderId(p);
      const folderDeEste = folderIdDeEste ? proCity.myFolders.find(f=>f.id === folderIdDeEste) : null;
      const folderTag = folderIdDeEste ? `<small class="u52-procity-mine-folder-tag">🔗 En carpeta cooperativa${folderDeEste ? ': ' + esc(folderDeEste.nombre) : ''}</small>` : '';
      return `<button type="button" class="u52-procity-mine-card${marcado?' seleccionado':''}" data-u52-procity-mine="${esc(lat)}" data-u52-procity-select-target="${esc(lat)}">
        <span class="u52-procity-mine-ico" style="background:var(--pc-chip);color:var(--pc-lav-deep)">${dInfo.icon}</span>
        <div class="u52-procity-mine-info"><b>${esc(label)}</b><small>${esc(subUso)} · ${esc(fecha)}</small>${folderTag}</div>
        ${enSeleccion ? `<span class="u52-procity-mine-check">${marcado?'✅':'⬜'}</span>` : '<span class="u52-procity-mine-arrow">›</span>'}
      </button>`;
    }

    let body;
    if(proCity.statsTab === 'mios'){
      const selToolbar = mios.length ? `
        <div class="u52-procity-select-toolbar">
          <button type="button" class="u52-procity-select-toggle${proCity.selectMode?' activo':''}" data-u52-call="procity-select-toggle">${proCity.selectMode ? '✕ Cancelar selección' : '☑️ Seleccionar varios'}</button>
          ${proCity.selectMode && proCity.selectedLats.size ? `<button type="button" class="u52-procity-select-bulk-add" data-u52-call="procity-select-bulk-add">📁 Agregar ${proCity.selectedLats.size} a carpeta</button>` : ''}
        </div>` : '';
      body = mios.length ? `${selToolbar}<div class="u52-procity-mine-list">${mios.map(p=>_mineCard(p, true)).join('')}</div>`
        : `<div class="u52-empty-card"><span>🗺️</span><div><b>Aún no has georreferenciado nada</b><small>Lo que mapees en Pro City aparecerá aquí.</small></div></div>`;
    } else if(proCity.statsTab === 'amigos'){
      body = deAmigos.length ? `<div class="u52-procity-mine-list">${deAmigos.map(p=>_mineCard(p, false)).join('')}</div>`
        : `<div class="u52-empty-card"><span>👥</span><div><b>Aún no ves mapeos de amigos</b><small>Cuando un amigo tuyo en URBIS Social georreferencie algo, aparece aquí.</small></div></div>`;
    } else if(proCity.statsTab === 'analisis'){
      // El análisis por área vive en js/24; aquí solo se le pasa lo que él no
      // puede saber (la Matriz, los colores y cómo leer el autor de un punto).
      body = window.URBIS_PC_ANALISIS
        ? window.URBIS_PC_ANALISIS.htmlPanel(proCityCtxAnalisis())
        : '<div class="u52-empty-card"><span>📊</span><div><b>Análisis no disponible</b><small>Recarga la app para activar el módulo de análisis por área.</small></div></div>';
    } else {
      // Pedido explícito: mostrar tal cual se ve al elegir dónde mapear —
      // las 10 categorías compactas de la Matriz de Usos (Vivienda y ocio,
      // Comercio y economía…), TODAS, incluyendo las que dan 0% (antes una
      // categoría sin ningún punto, como Usos combinados, desaparecía).
      const filasGrupo = MATRIZ_GRUPOS.map(g=>({ gid:g.id, icon:g.i, titulo:g.t, n: conteoGrupos[g.id] || 0 }))
        .sort((a,b)=>b.n - a.n);
      let acumulado = 0;
      const conic = filasGrupo.filter(f=>f.n > 0).map(({gid,n})=>{
        const color = MATRIZ_GRUPO_COLOR[gid] || '#6b70e0';
        const pct = totalMatriz ? (n/totalMatriz)*100 : 0;
        const desde = acumulado;
        acumulado += pct;
        return `${color} ${desde}% ${acumulado}%`;
      }).join(', ');
      // Pedido explícito: cada título de categoría (Vivienda y ocio, Comercio
      // y economía…) no es decoración — tocarlo abre el desglose de los
      // usos específicos que la componen (ver showProCityGrupoDetalle).
      const _barRow = ({gid,icon,titulo,n})=>{
        const color = MATRIZ_GRUPO_COLOR[gid] || '#6b70e0';
        const pct = totalMatriz ? Math.round((n/totalMatriz)*100) : 0;
        return `<button type="button" class="u52-procity-stat-bar-row" data-u52-call="procity-grupo-detalle" data-gid="${esc(gid)}">
          <div class="u52-procity-stat-bar-label"><span>${icon}</span><b>${esc(titulo)}</b><small>${n} · ${pct}%</small><span class="u52-procity-stat-bar-arrow">›</span></div>
          <div class="u52-procity-stat-bar-track"><div class="u52-procity-stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </button>`;
      };
      const barras = filasGrupo.map(_barRow).join('');
      // Otra barra desplegable con el mismo detalle por categoría (conteo y
      // porcentaje) — también tocable para ver el desglose de usos.
      const detalle = `<details class="u52-procity-totales-detalle">
        <summary>📊 Ver el detalle completo de la Matriz de Usos (${totalMatriz})</summary>
        <div class="u52-procity-stats-list">${filasGrupo.map(({gid,icon,titulo,n})=>{
          const pct = totalMatriz ? Math.round((n/totalMatriz)*100) : 0;
          return `<button type="button" class="u52-procity-stat-row" data-u52-call="procity-grupo-detalle" data-gid="${esc(gid)}">
            <span class="u52-procity-stat-ico" style="background:var(--pc-chip);color:var(--pc-lav-deep)">${icon}</span>
            <b>${esc(titulo)}</b>
            <span class="u52-procity-stat-n">${n} · ${pct}%</span>
          </button>`;
        }).join('')}</div>
      </details>`;
      body = `<div class="u52-procity-stats-list">
        <button type="button" class="u52-procity-totales-scope" data-u52-call="procity-radio-open">
          <img class="u52-procity-totales-scope-pin" src="assets/icons/urbis-pin-kawaii.png" alt="">
          <span>Radio de ${proCityRadioKmActual()} km en Cúcuta · ${totalMatriz} elemento${totalMatriz===1?'':'s'}</span>
          <span class="u52-procity-totales-scope-edit">Ajustar</span>
        </button>
        ${totalMatriz ? `<div class="u52-procity-pie-wrap">
          <div class="u52-procity-pie" style="background:conic-gradient(${conic})"></div>
        </div>` : ''}
        <div class="u52-procity-folder-stats">${barras}</div>
        ${detalle}
      </div>`;
    }

    let sheet = document.getElementById('u52-procity-stats');
    if(!sheet){
      sheet = document.createElement('div');
      sheet.id = 'u52-procity-stats';
      sheet.className = 'u52-procity-sheet';
      mapScreen.appendChild(sheet);
    }
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-stats-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>📊 Total mapeado: ${total}</b><small>Elementos urbanos georeferenciados</small></div>
          <button type="button" data-u52-call="procity-stats-close" aria-label="Cerrar">×</button>
        </div>
        ${tabs}
        ${body}
      </div>`;
    sheet.hidden = false;
    // Las gráficas del análisis por área se montan después de inyectar el
    // HTML: Chart.js necesita el <canvas> ya presente en el documento.
    if(proCity.statsTab === 'analisis' && window.URBIS_PC_ANALISIS){
      try{ window.URBIS_PC_ANALISIS.montar(proCityCtxAnalisis()); }catch(e){}
    }
  }
  // Puente hacia js/24: le entrega la Matriz de Usos, los colores y las
  // funciones de autoría que solo existen dentro de este archivo.
  function proCityCtxAnalisis(){
    return {
      grupos: MATRIZ_GRUPOS,
      colorGrupo: MATRIZ_GRUPO_COLOR,
      matrizKey: MATRIZ_USOS_KEY,
      usoDe: _procityPuntoUso,
      esProCity: tipo => PRO_CITY_DIMS.includes(String(tipo || '')),
      esPropio: esPropioProCity
    };
  }
  // Los usa js/24 para volver al panel tras cerrar o cargar un área.
  window.urbisProCityAbrirAnalisis = function(){
    proCity.statsTab = 'analisis';
    showProCityStats();
  };
  window.urbisProCityCerrarStats = function(){ hideProCityStats(); };
  function setProCityStatsTab(tab){
    proCity.statsTab = tab;
    showProCityStats();
  }
  function openProCityMineFromList(lat){
    const datos = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    const p = datos.find(x => x && String(x.lat) === String(lat));
    if(!p) return;
    // BUG real: dentro de Cooperativo (pantalla propia, encima del mapa) el
    // panel normal de "punto seleccionado" se dibuja EN el mapa — que queda
    // TAPADO detrás de la pantalla de Cooperativo (su z-index es mayor), así
    // que se abría pero no se veía nada. Ahí se muestra una ficha propia,
    // por encima de todo, sin salir de la carpeta.
    if(proCityCoopScreenOpen()){ showProCityCoopPointSheet(p); return; }
    hideProCityStats();
    try{
      const lt = parseFloat(String(p.lat).replace(',','.')), lg = parseFloat(String(p.lng).replace(',','.'));
      if(window.map && !isNaN(lt) && !isNaN(lg)) map.setView([lt,lg], Math.max(map.getZoom ? map.getZoom() : 17, 17), { animate:true });
    }catch(e){}
    showProCitySelectedPanel(p);
  }
  // Ficha de detalle de un mapeo, PROPIA de Cooperativo (se ve por encima de
  // la pantalla del proyecto, no requiere salir a ver el mapa): ícono real
  // del uso, "Uso · Tipo", dirección/descripción, autor y fecha — resuelve
  // "toco un mapeo y no pasa nada" dentro de una carpeta.
  function showProCityCoopPointSheet(p){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    const d = String(p.descripcion || '').split(' | ');
    const uso = _procityPuntoUso(p);
    const g = PROCITY_MATRIZ_USOS.find(x=>x.u === uso);
    const icon = g ? g.i : '📍';
    const tipoExacto = (d[0] || '').split(' · ').slice(1).join(' · ') || '';
    const direccion = (d[1] || '').split(' — ')[0] || '';
    const nota = d[2] || '';
    const autor = d[BASE_OFFSET + 2] || 'Anónimo';
    const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : '';
    const ownFolderId = proCityPointFolderId(p);
    // "Georreferencia" = las coordenadas exactas (lat, lng), listas para
    // pegar en Google Earth/Maps — antes esta fila mostraba la dirección de
    // texto, que no sirve para eso. La dirección queda en su propia fila.
    const latNum = String(p.lat || '').replace(',', '.');
    const lngNum = String(p.lng || '').replace(',', '.');
    const coordsTexto = `${latNum}, ${lngNum}`;
    let sheet = document.getElementById('u52-procity-coop-point');
    if(!sheet){ sheet = document.createElement('div'); sheet.id = 'u52-procity-coop-point'; sheet.className = 'u52-procity-sheet'; mapScreen.appendChild(sheet); }
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-coop-point-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>${icon} ${esc(uso)}</b><small>${esc(tipoExacto)}</small></div>
          <button type="button" data-u52-call="procity-coop-point-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-procity-coop-point-info">
          <div class="u52-procity-coop-point-row">
            <span>🌐</span>
            <div><b>Georreferencia</b><small class="u52-procity-coop-point-coords">${esc(coordsTexto)}</small></div>
            <button type="button" class="u52-procity-coop-point-copy" data-u52-call="procity-coop-point-copy" data-coords="${esc(coordsTexto)}" aria-label="Copiar coordenadas">📋</button>
          </div>
          ${direccion ? `<div class="u52-procity-coop-point-row"><span>📍</span><div><b>Dirección</b><small>${esc(direccion)}</small></div></div>` : ''}
          ${nota ? `<div class="u52-procity-coop-point-row"><span>📝</span><div><b>Descripción</b><small>${esc(nota)}</small></div></div>` : ''}
          <div class="u52-procity-coop-point-row"><span>👤</span><div><b>Publicado por</b><small>${esc(autor)}</small></div></div>
          ${fecha ? `<div class="u52-procity-coop-point-row"><span>🗓️</span><div><b>Fecha</b><small>${esc(fecha)}</small></div></div>` : ''}
        </div>
        <button type="button" class="u52-procity-coop-point-map" data-u52-call="procity-coop-point-onmap" data-lat="${esc(String(p.lat))}" data-lng="${esc(String(p.lng))}">🛰️ Ver en el mapa</button>
      </div>`;
    sheet.hidden = false;
  }
  function hideProCityCoopPointSheet(){
    const s = document.getElementById('u52-procity-coop-point');
    if(s) s.hidden = true;
  }

  function hideProCityStats(){
    const sheet = document.getElementById('u52-procity-stats');
    if(sheet) sheet.hidden = true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRO CITY · PUNTOS COMO FORMAS (no íconos) + selección/edición/mover/filtro
  // Los elementos urbanos NO son reportes: se pintan como formas geométricas
  // simples (círculo/cuadrado/triángulo/rombo) coloreadas por su dimensión.
  // Van en su PROPIA capa Leaflet, visible solo dentro del módulo, para no
  // ensuciar el mapa ciudadano ni sobrecargar el render en uso normal.
  // ═══════════════════════════════════════════════════════════════════════
  // Forma por dimensión (según el tipo de uso): cuadrado = construcción/edificio,
  // triángulo = infraestructura/redes/servicios, círculo = actividad/verde,
  // rombo = matriz de usos (zonificación).
  const PRO_CITY_SHAPE = {
    'Vivienda y Residencial':'square', 'Grandes Equipamientos':'square',
    'Oficinas y Co-working':'square', 'Industria y Logística':'square',
    'Patrimonio y Turismo':'square',
    'Infraestructura y Peatonal':'triangle', 'Servicios Ocultos':'triangle',
    'Infraestructura Smart':'triangle', 'Salud y Emergencias':'triangle',
    'Comercio y Servicios':'circle', 'Áreas Deportivas':'circle',
    'Áreas Verdes y Ambiental':'circle', 'Animal y Bienestar':'circle',
    '🗺️ Matriz de Usos':'diamond'
  };
  // ═══ Alcance geográfico de "Totales" (pedido explícito): "que no me sume
  // cosas de Chinácota" — se limita el conteo a un radio alrededor del centro
  // de Cúcuta. Un CÍRCULO es mucho más simple y confiable que dibujar el
  // contorno exacto del municipio (que necesitaría datos de límites reales
  // que no tenemos) y, con 15 km, cubre toda la zona urbana sin mezclar
  // municipios vecinos (Chinácota queda a ~30 km del centro). ═══
  const CUCUTA_CENTER = { lat: 7.8891, lng: -72.5079 };
  const CUCUTA_RADIO_KM_DEFAULT = 15;
  const CUCUTA_RADIO_KM_STORE = 'urbis_procity_radio_km';
  // Pedido explícito: el radio de "Totales" debe poder ajustarse (1, 2, 20
  // km…), no quedar fijo en 15 — se guarda en este dispositivo.
  function proCityRadioKmActual(){
    try{
      const v = parseFloat(localStorage.getItem(CUCUTA_RADIO_KM_STORE));
      if(!isNaN(v) && v > 0) return v;
    }catch(e){}
    return CUCUTA_RADIO_KM_DEFAULT;
  }
  function proCitySetRadioKm(km){
    const v = Math.max(1, Math.min(200, Math.round(km)));
    try{ localStorage.setItem(CUCUTA_RADIO_KM_STORE, String(v)); }catch(e){}
    return v;
  }
  function _haversineKm(lat1, lng1, lat2, lng2){
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI/180;
    const dLng = (lng2 - lng1) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  function proCityEnRadioCucuta(p){
    const lat = parseFloat(String(p.lat||'').replace(',','.'));
    const lng = parseFloat(String(p.lng||'').replace(',','.'));
    if(isNaN(lat) || isNaN(lng)) return false;
    return _haversineKm(lat, lng, CUCUTA_CENTER.lat, CUCUTA_CENTER.lng) <= proCityRadioKmActual();
  }
  function showProCityRadioConfigSheet(){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    let sheet = document.getElementById('u52-procity-radio-sheet');
    if(!sheet){ sheet = document.createElement('div'); sheet.id = 'u52-procity-radio-sheet'; sheet.className = 'u52-procity-sheet'; mapScreen.appendChild(sheet); }
    const actual = proCityRadioKmActual();
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-radio-close"></div>
      <div class="u52-procity-sheet-card u52-procity-radio-card">
        <div class="u52-procity-sheet-head">
          <div><b>📍 Radio de análisis</b><small>Qué tan lejos de Cúcuta se cuenta</small></div>
          <button type="button" data-u52-call="procity-radio-close" aria-label="Cerrar">×</button>
        </div>
        <p class="u52-procity-radio-hint">Los elementos de la Matriz de Usos fuera de este radio no se cuentan en "Totales" — así ciudades vecinas como Chinácota no se mezclan con Cúcuta.</p>
        <div class="u52-procity-radio-input-row">
          <input type="number" id="u52-procity-radio-input" min="1" max="200" step="1" value="${actual}">
          <span>km</span>
        </div>
        <div class="u52-procity-radio-presets">
          ${[1,2,5,10,15,20,30].map(km=>`<button type="button" class="${km===actual?'active':''}" data-u52-call="procity-radio-preset" data-km="${km}">${km} km</button>`).join('')}
        </div>
        <button type="button" class="u52-quick-publish u52-procity-publish" data-u52-call="procity-radio-save">Guardar radio</button>
      </div>`;
    sheet.hidden = false;
  }
  function hideProCityRadioConfigSheet(){
    const s = document.getElementById('u52-procity-radio-sheet');
    if(s) s.hidden = true;
  }
  function saveProCityRadioFromInput(){
    const input = document.getElementById('u52-procity-radio-input');
    const km = input ? parseFloat(input.value) : NaN;
    if(isNaN(km) || km <= 0){ alert('Ingresa un radio válido en kilómetros.'); return; }
    proCitySetRadioKm(km);
    hideProCityRadioConfigSheet();
    showProCityStats();
  }
  function pickProCityRadioPreset(km){
    proCitySetRadioKm(Number(km));
    showProCityRadioConfigSheet();
  }
  // Pedido explícito: tocar el título de una categoría en Totales (ej.
  // "Vivienda y ocio") abre su desglose — cuáles usos específicos
  // (Residencial, VIS/VIP, Deportivo…) la componen y cuántos hay de cada
  // uno, dentro del mismo radio configurado. Si se pasa `puntosOverride`
  // (pedido explícito, mismo tratamiento dentro de una carpeta cooperativa),
  // el desglose se acota a esos mapeos en vez de al radio de Cúcuta.
  function showProCityGrupoDetalle(gid, puntosOverride){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    const grupo = MATRIZ_GRUPOS.find(g=>g.id === gid);
    if(!grupo) return;
    let datos;
    if(puntosOverride){
      datos = puntosOverride.filter(p => p && p.tipo === MATRIZ_USOS_KEY);
    } else {
      const datosCrudo = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
      datos = datosCrudo.filter(p => p && proCityEnRadioCucuta(p) && p.tipo === MATRIZ_USOS_KEY);
    }
    const conteoUso = {};
    const conteoTipo = {};
    datos.forEach(p=>{
      const uso = _procityPuntoUso(p);
      if(!grupo.usos.includes(uso)) return;
      conteoUso[uso] = (conteoUso[uso] || 0) + 1;
      const crudo = String(p.descripcion||'').split(' | ')[0] || '';
      const tipo = crudo.split(' · ').slice(1).join(' · ');
      if(tipo){
        conteoTipo[uso] = conteoTipo[uso] || {};
        conteoTipo[uso][tipo] = (conteoTipo[uso][tipo] || 0) + 1;
      }
    });
    const totalGrupo = Object.values(conteoUso).reduce((a,b)=>a+b, 0);
    // Pedido explícito: debajo de cada uso, ver los ítems exactos que se
    // están contando (ej. bajo "Residencial": Vivienda 1 piso, Vivienda 2
    // piso…), no solo el total del uso.
    const filas = grupo.usos.map(uso=>{
      const info = PROCITY_MATRIZ_USOS.find(x=>x.u === uso);
      const n = conteoUso[uso] || 0;
      const pct = totalGrupo ? Math.round((n/totalGrupo)*100) : 0;
      const color = MATRIZ_GRUPO_COLOR[gid] || '#6b70e0';
      const tipos = conteoTipo[uso] || {};
      const tiposHtml = Object.keys(tipos).sort((a,b)=>tipos[b]-tipos[a]).map(t=>
        `<div class="u52-procity-tipo-item"><span>${esc(t)}</span><b>${tipos[t]}</b></div>`
      ).join('');
      return `<div class="u52-procity-stat-bar-row">
        <div class="u52-procity-stat-bar-label"><span>${info ? info.i : '📍'}</span><b>${esc(uso)}</b><small>${n} · ${pct}%</small></div>
        <div class="u52-procity-stat-bar-track"><div class="u52-procity-stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        ${tiposHtml ? `<div class="u52-procity-tipo-list">${tiposHtml}</div>` : ''}
      </div>`;
    }).join('');
    // Pedido explícito: debajo del desglose, otra barra desplegable con los
    // mapeos individuales (ícono real + fecha) de este grupo — tocar uno
    // lleva directo a ese punto en el mapa.
    const puntosGrupo = datos.filter(p => grupo.usos.includes(_procityPuntoUso(p)))
      .sort((a,b) => new Date(b.fecha||0).getTime() - new Date(a.fecha||0).getTime());
    const listaPuntos = puntosGrupo.map(p=>{
      const uso = _procityPuntoUso(p);
      const info = PROCITY_MATRIZ_USOS.find(x=>x.u === uso);
      const dCampos = String(p.descripcion||'').split(' | ');
      const tipoExacto = (dCampos[0] || '').split(' · ').slice(1).join(' · ') || uso;
      const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '';
      return `<button type="button" class="u52-procity-mine-card" data-u52-call="procity-grupo-item-open" data-lat="${esc(String(p.lat))}">
        <span class="u52-procity-mine-ico" style="background:var(--pc-chip);color:var(--pc-lav-deep)">${info ? info.i : '📍'}</span>
        <div class="u52-procity-mine-info"><b>${esc(tipoExacto)}</b><small>${esc(uso)} · ${esc(fecha)}</small></div>
        <span class="u52-procity-mine-arrow">›</span>
      </button>`;
    }).join('');
    const detallePuntos = `<details class="u52-procity-totales-detalle">
      <summary>📍 Ver los mapeos en el mapa (${puntosGrupo.length})</summary>
      <div class="u52-procity-mine-list">${listaPuntos || '<div class="u52-empty-card"><span>📍</span><div><b>Aún no hay mapeos de esta categoría en este radio</b></div></div>'}</div>
    </details>`;
    let sheet = document.getElementById('u52-procity-grupo-detalle');
    if(!sheet){ sheet = document.createElement('div'); sheet.id = 'u52-procity-grupo-detalle'; sheet.className = 'u52-procity-sheet'; mapScreen.appendChild(sheet); }
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-grupo-detalle-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>${grupo.i} ${esc(grupo.t)}</b><small>${totalGrupo} elemento${totalGrupo===1?'':'s'} · desglose por uso</small></div>
          <button type="button" data-u52-call="procity-grupo-detalle-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-procity-folder-stats">${filas}</div>
        ${detallePuntos}
      </div>`;
    sheet.hidden = false;
  }
  function hideProCityGrupoDetalle(){
    const s = document.getElementById('u52-procity-grupo-detalle');
    if(s) s.hidden = true;
  }
  // Tocar un mapeo dentro del desglose de categoría: cierra las hojas de
  // estadísticas y lleva al punto en el mapa (mismo comportamiento que
  // "Mis mapeos").
  function openProCityGrupoDetalleItem(lat){
    hideProCityGrupoDetalle();
    openProCityMineFromList(lat);
  }
  // ═══ Modo visual de la Matriz de Usos: Emojis (pedagógico) ↔ Colores y
  // formas por categoría (profesional, tipo mapa de calor). Pedido explícito:
  // poder alternar entre las 2 vistas con un botón en el mapa. ═══
  proCity.matrizVisualMode = 'emoji'; // 'emoji' | 'color'
  // Un color BASE por cada una de las 10 categorías temáticas de la Matriz
  // (MATRIZ_GRUPOS) — de lejos, el mapa se ve como una gama de colores por
  // uso del suelo. Dentro de cada categoría, cada uso recibe un MATIZ
  // distinto (más claro/oscuro del mismo color) + una FORMA distinta, para
  // diferenciarse incluso dentro de la misma familia de color.
  const MATRIZ_GRUPO_COLOR = {
    vivienda: '#ff8a4a',       // naranja — Vivienda y ocio
    comercio: '#e5484d',       // rojo — Comercio y economía
    institucional: '#3b82f6',  // azul — Institucional y gobierno
    industria: '#8b6f47',      // marrón — Industria y logística
    salud: '#ec4899',          // rosado — Salud y emergencias
    cultura: '#a855f7',        // morado — Cultura, educación y culto
    servicios: '#14b8a6',      // teal — Servicios e infraestructura
    ambiente: '#22c55e',       // verde — Ambiente y zona rural
    riesgo: '#eab308',         // ámbar — Riesgo, deterioro y suelo sin definir
    mixtos: '#6366f1'          // índigo — Usos combinados
  };
  function _procityHexToHsl(hex){
    const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max+min)/2;
    if(max===min){ h = s = 0; }
    else{
      const d = max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      if(max===r) h = (g-b)/d + (g<b?6:0);
      else if(max===g) h = (b-r)/d + 2;
      else h = (r-g)/d + 4;
      h /= 6;
    }
    return [h*360, s*100, l*100];
  }
  function _procityHslToHex(h,s,l){
    s/=100; l/=100;
    const k = n=>(n+h/30)%12;
    const a = s*Math.min(l,1-l);
    const f = n=> l - a*Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n),1)));
    const toHex = x=> Math.round(255*x).toString(16).padStart(2,'0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }
  // Genera un matiz (más claro→más oscuro) del color base según la posición
  // del uso dentro de su categoría — así, si se agotan las formas/colores
  // "obvios", automáticamente sigue habiendo variedad dentro de la gama.
  function proCityMatrizShade(baseColor, index, total){
    const [h,s] = _procityHexToHsl(baseColor);
    const lightMin = 32, lightMax = 64;
    const l = total<=1 ? (lightMin+lightMax)/2 : lightMin + (index*(lightMax-lightMin)/(total-1));
    return _procityHslToHex(h, Math.max(s,55), l);
  }
  const PROCITY_SHAPES_CICLO = ['circle','square','triangle','diamond'];
  function proCityMatrizColorFor(uso){
    for(let gi=0; gi<MATRIZ_GRUPOS.length; gi++){
      const g = MATRIZ_GRUPOS[gi];
      const idx = g.usos.indexOf(uso);
      if(idx >= 0){
        const base = MATRIZ_GRUPO_COLOR[g.id] || '#6b70e0';
        return { color: proCityMatrizShade(base, idx, g.usos.length), shape: PROCITY_SHAPES_CICLO[idx % PROCITY_SHAPES_CICLO.length], groupColor: base };
      }
    }
    return { color:'#6b70e0', shape:'circle', groupColor:'#6b70e0' };
  }
  function updateProCityVisualToggleIcon(){
    const btn = app.querySelector('.u52-procity-visual-toggle');
    if(btn) btn.textContent = proCity.matrizVisualMode === 'color' ? '🎨' : '😀';
  }
  function toggleProCityVisualMode(){
    proCity.matrizVisualMode = proCity.matrizVisualMode === 'emoji' ? 'color' : 'emoji';
    updateProCityVisualToggleIcon();
    try{ renderProCityPoints(); }catch(e){}
    try{
      if(typeof showAchievementToast === 'function'){
        showAchievementToast(
          proCity.matrizVisualMode === 'color' ? '🎨 Modo colores' : '😀 Modo íconos',
          proCity.matrizVisualMode === 'color' ? 'Los puntos se ven por color y forma según su categoría.' : 'Los puntos se ven con su ícono representativo.'
        );
      }
    }catch(e){}
  }
  let proCityLayer = null;
  proCity.hidden = new Set();   // dimensiones ocultas por el filtro
  proCity.selPoint = null;      // punto seleccionado (para editar/mover)
  proCity.editLat = '';         // lat del punto en edición (vacío = alta nueva)
  // Por defecto, SOLO se ven los puntos propios — pedido explícito: el
  // mapeo masivo de otros usuarios queda desactivado por defecto para no
  // sobrecargar la plataforma en el celular. Se puede desactivar desde el
  // filtro ("Mostrar todo lo mapeado").
  proCity.onlyMine = true;
  // ── Carpetas compartidas de mapeo (georreferenciación grupal entre amigos) ──
  proCity.myFolders = [];       // carpetas donde el usuario actual es miembro
  proCity.foldersLoaded = false;
  proCity.activeFolder = '';    // si hay una activa, lo que se georreferencie se etiqueta con su código
  proCity.folderFilter = '';    // si está puesto, el mapa solo muestra puntos de ESA carpeta
  // Campo extra al FINAL del array de descripcion (nunca leído por nada más:
  // reportes ciudadanos usan hasta BASE_OFFSET+TIMELINE_EXTRA_OFFSET+4). Solo
  // los puntos de Pro City lo usan, para no arriesgar el offset de reportes.
  const PROCITY_FOLDER_FIELD_OFFSET = BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 5;
  function proCityCurrentUsername(){
    try{ return (typeof urbisIdentidadActual === 'function' ? urbisIdentidadActual().usuario : '') || window.userUsernameGlobal || ''; }catch(e){ return ''; }
  }
  function proCityPointFolderId(p){
    try{ return String(p.descripcion || '').split(' | ')[PROCITY_FOLDER_FIELD_OFFSET] || ''; }catch(e){ return ''; }
  }
  function proCityFriendsUsernames(){
    try{ if(Array.isArray(window.urbisAmigosFromServer)) return window.urbisAmigosFromServer.map(f=>String(f.usuario||'').toLowerCase()).filter(Boolean); }catch(e){}
    return [];
  }
  function esDeAmigoProCity(p){
    try{
      const autorNombre = String(p.descripcion||'').split(' | ')[BASE_OFFSET + 2] || '';
      const clave = autorNombre.toLowerCase().trim();
      if(!clave) return false;
      if(proCityFriendsUsernames().includes(clave)) return true;
      if(Array.isArray(window.urbisAmigosFromServer)){
        return window.urbisAmigosFromServer.some(f => String(f.nombre||'').toLowerCase().trim() === clave || String(f.usuario||'').toLowerCase().trim() === clave);
      }
    }catch(e){}
    return false;
  }
  // Después de publicar un punto en Pro City con una carpeta activa, lo
  // etiqueta con el código de esa carpeta (escritura extra, no interfiere con
  // el guardado normal ni con el offset de reportes ciudadanos).
  function tagProCityFolderIfNeeded(lat){
    if(!proCity.activeFolder) return;
    const folderId = proCity.activeFolder;
    setTimeout(function(){
      if(typeof window.urbisDBRead !== 'function' || typeof window.urbisDBUpdate !== 'function') return;
      window.urbisDBRead().then(function(out){
        const rows = (out && out.data) || [];
        const row = rows.find(function(r){ return String(r.lat) === String(lat); });
        if(!row) return;
        const d = String(row.descripcion || '').split(' | ');
        d[PROCITY_FOLDER_FIELD_OFFSET] = folderId;
        return window.urbisDBUpdate('lat', lat, { descripcion: d.join(' | ') });
      }).catch(function(){});
    }, 1800);
  }
  function loadProCityFolders(){
    const usuario = proCityCurrentUsername();
    if(!usuario) return Promise.resolve();
    return socialAPI({ action:'procity_folder_list_mine', usuario: usuario }).then(function(out){
      proCity.myFolders = (out && out.folders) || [];
      proCity.foldersLoaded = true;
      if(proCityCoopScreenOpen()) renderProCityCoopScreen();
      updateProCityActiveFolderBtn();
    }).catch(function(){});
  }
  // Crear carpeta = "nuevo proyecto": pide el nombre y de una vez muestra la
  // lista de amigos para marcar con quién se hace el análisis en grupo,
  // en vez de crear vacío y tener que invitar uno por uno después.
  function showProCityFolderCreateSheet(){
    const usuario = proCityCurrentUsername();
    if(!usuario){ alert('Inicia sesión para crear un proyecto cooperativo.'); return; }
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    const friends = Array.isArray(window.urbisAmigosFromServer) ? window.urbisAmigosFromServer : [];
    const chips = friends.length ? friends.map(f=>{
      const u = String(f.usuario || '');
      if(!u) return '';
      return `<label class="u52-procity-folder-pick"><input type="checkbox" class="u52-procity-folder-pick-chk" value="${esc(u)}"><span>👤 ${esc(u)}</span></label>`;
    }).join('') : `<div class="u52-matriz-empty">Aún no tienes amigos agregados en URBIS Social. Puedes crear el proyecto igual e invitarlos después con el código.</div>`;
    let sheet = document.getElementById('u52-procity-invite-sheet');
    if(!sheet){ sheet = document.createElement('div'); sheet.id = 'u52-procity-invite-sheet'; sheet.className = 'u52-procity-sheet'; mapScreen.appendChild(sheet); }
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-invite-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>🤝 Nuevo proyecto cooperativo</b><small>Ponle nombre y elige con quién lo haces</small></div>
          <button type="button" data-u52-call="procity-invite-close" aria-label="Cerrar">×</button>
        </div>
        <input type="text" class="u52-matriz-search" id="u52-folder-new-name" placeholder="Nombre del proyecto (ej. La esquina de Juancho)" autocomplete="off">
        <div class="u52-procity-folder-picklist">${chips}</div>
        <button type="button" class="u52-procity-folder-create-confirm" data-u52-call="procity-folder-create-confirm">Crear proyecto</button>
      </div>`;
    sheet.hidden = false;
  }
  function confirmProCityFolderCreate(){
    const usuario = proCityCurrentUsername();
    const nameEl = document.getElementById('u52-folder-new-name');
    const nombre = (nameEl?.value || '').trim();
    if(!nombre){ alert('Escribe un nombre para el proyecto.'); nameEl?.focus(); return; }
    const seleccionados = Array.from(document.querySelectorAll('.u52-procity-folder-pick-chk:checked')).map(c=>c.value);
    socialAPI({ action:'procity_folder_create', nombre: nombre, usuario: usuario }).then(function(out){
      if(!out || !out.ok){ alert((out && out.message) || 'No se pudo crear el proyecto.'); return; }
      const folderId = out.folder.id;
      const invitaciones = seleccionados.map(u => socialAPI({ action:'procity_folder_join', id: folderId, miembro: u }).catch(function(){}));
      Promise.all(invitaciones).then(function(){
        hideProCityFolderInviteSheet();
        loadProCityFolders();
        alert('Proyecto creado: "' + out.folder.nombre + '". Código para invitar: ' + folderId);
      });
    }).catch(function(){ alert('No se pudo crear el proyecto.'); });
  }
  function joinProCityFolderByCode(){
    const usuario = proCityCurrentUsername();
    if(!usuario){ alert('Inicia sesión para unirte a un proyecto cooperativo.'); return; }
    const codigo = prompt('Código del proyecto cooperativo:');
    if(!codigo || !codigo.trim()) return;
    socialAPI({ action:'procity_folder_join', id: codigo.trim().toUpperCase(), miembro: usuario }).then(function(out){
      if(out && out.ok){ loadProCityFolders(); alert('Te uniste a "' + out.folder.nombre + '".'); }
      else alert((out && out.message) || 'No se encontró ese proyecto.');
    }).catch(function(){ alert('No se pudo unir al proyecto.'); });
  }
  // Gestionar miembros de una carpeta YA creada: quitar los que están y
  // agregar amigos que aún no están — vive en un "ladito" (⚙️) de la
  // tarjeta de la carpeta, sin tener que recrearla.
  function showProCityFolderMembersSheet(folderId){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    const folder = proCity.myFolders.find(f=>f.id === folderId);
    if(!folder) return;
    const miembros = folder.miembros || [];
    const esCreador = u => String(u).toLowerCase() === String(folder.creador||'').toLowerCase();
    const friends = Array.isArray(window.urbisAmigosFromServer) ? window.urbisAmigosFromServer : [];
    const yaAdentro = miembros.map(u => esCreador(u)
      ? `<div class="u52-procity-folder-member"><span>👑 ${esc(u)}</span><b>Anfitrión</b></div>`
      : `<button type="button" class="u52-procity-folder-member" data-u52-procity-folder-remove="${esc(folderId)}" data-u52-procity-remove-user="${esc(u)}"><span>👤 ${esc(u)}</span><b>✕ Quitar</b></button>`
    ).join('');
    const disponibles = friends.filter(f => miembros.indexOf(String(f.usuario||'')) < 0);
    const paraAgregar = disponibles.length ? disponibles.map(f=>{
      const u = String(f.usuario || '');
      if(!u) return '';
      return `<button type="button" class="u52-procity-folder-member" data-u52-procity-folder-invite="${esc(folderId)}" data-u52-procity-invite-user="${esc(u)}"><span>👤 ${esc(u)}</span><b>＋ Agregar</b></button>`;
    }).join('') : `<div class="u52-matriz-empty">No tienes más amigos para agregar.</div>`;
    let sheet = document.getElementById('u52-procity-invite-sheet');
    if(!sheet){ sheet = document.createElement('div'); sheet.id = 'u52-procity-invite-sheet'; sheet.className = 'u52-procity-sheet'; mapScreen.appendChild(sheet); }
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-invite-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>⚙️ Miembros de "${esc(folder.nombre)}"</b><small>Código: ${esc(folder.id)}</small></div>
          <button type="button" data-u52-call="procity-invite-close" aria-label="Cerrar">×</button>
        </div>
        <small class="u52-procity-folder-sublabel">En la carpeta</small>
        <div class="u52-procity-folder-memberlist">${yaAdentro}</div>
        <small class="u52-procity-folder-sublabel">Agregar por usuario o ID URBIS</small>
        <div class="u52-procity-folder-addbyid">
          <input type="text" id="u52-folder-add-username" placeholder="Nombre de usuario o código de amigo" autocomplete="off">
          <button type="button" data-u52-call="procity-folder-add-byid" data-folder-id="${esc(folderId)}">＋ Agregar</button>
        </div>
        <small class="u52-procity-folder-sublabel">Agregar amigo</small>
        <div class="u52-procity-folder-memberlist">${paraAgregar}</div>
      </div>`;
    sheet.hidden = false;
  }
  function hideProCityFolderInviteSheet(){
    const s = document.getElementById('u52-procity-invite-sheet');
    if(s) s.hidden = true;
  }
  function addProCityFolderMemberById(folderId){
    const input = document.getElementById('u52-folder-add-username');
    const usuario = (input?.value || '').trim();
    if(!usuario){ alert('Escribe un nombre de usuario o código de amigo.'); input?.focus(); return; }
    socialAPI({ action:'procity_folder_join', id: folderId, miembro: usuario }).then(function(out){
      if(out && out.ok){
        loadProCityFolders().then(function(){ showProCityFolderMembersSheet(folderId); });
        try{ if(typeof showAchievementToast === 'function') showAchievementToast('Agregado', usuario + ' se unió al proyecto.'); }catch(e){}
      } else alert((out && out.message) || 'No se encontró ese usuario. Verifica que esté escrito igual a su nombre de usuario en URBIS.');
    }).catch(function(){ alert('No se pudo agregar.'); });
  }
  function removeProCityFolderMember(folderId, usuario){
    socialAPI({ action:'procity_folder_remove_member', id: folderId, miembro: usuario }).then(function(out){
      if(out && out.ok){ loadProCityFolders().then(function(){ showProCityFolderMembersSheet(folderId); }); }
      else alert((out && out.message) || 'No se pudo quitar de la carpeta.');
    }).catch(function(){ alert('No se pudo quitar de la carpeta.'); });
  }
  function renameProCityFolder(folderId){
    const folder = proCity.myFolders.find(f=>f.id === folderId);
    const actual = folder ? folder.nombre : '';
    const nuevo = prompt('Nuevo nombre del proyecto:', actual);
    if(!nuevo || !nuevo.trim() || nuevo.trim() === actual) return;
    socialAPI({ action:'procity_folder_rename', id: folderId, nombre: nuevo.trim() }).then(function(out){
      if(out && out.ok){
        loadProCityFolders().then(function(){ if(proCityCoopScreenOpen()) renderProCityCoopScreen(); });
        try{ if(typeof showAchievementToast === 'function') showAchievementToast('Renombrado', 'El proyecto ahora se llama "' + nuevo.trim() + '".'); }catch(e){}
      } else alert((out && out.message) || 'No se pudo cambiar el nombre.');
    }).catch(function(){ alert('No se pudo cambiar el nombre.'); });
  }
  function toggleProCityFolderView(folderId){
    proCity.folderFilter = (proCity.folderFilter === folderId) ? '' : folderId;
    hideProCityStats();
    closeProCityCoop();
    try{ renderProCityPoints(); }catch(e){}
    try{ if(typeof showAchievementToast === 'function') showAchievementToast(proCity.folderFilter ? 'Mostrando proyecto' : 'Mostrando todo', proCity.folderFilter ? 'Solo se ven los mapeados de este proyecto.' : 'Ya no filtras por proyecto.'); }catch(e){}
  }
  function toggleProCityFolderActive(folderId){
    proCity.activeFolder = (proCity.activeFolder === folderId) ? '' : folderId;
    if(proCityCoopScreenOpen()) renderProCityCoopScreen(); else showProCityStats();
    updateProCityActiveFolderBtn();
    try{
      if(typeof showAchievementToast === 'function'){
        showAchievementToast(proCity.activeFolder ? 'Proyecto activo' : 'Proyecto desactivado', proCity.activeFolder ? 'Lo que georreferencies ahora quedará en este proyecto.' : 'Ya no se etiquetan los nuevos mapeos.');
      }
    }catch(e){}
  }
  // ── Botón flotante en el mapa: elegir/ver la carpeta cooperativa ACTIVA ──
  // Pedido explícito: acceso directo desde el mapa (sin tener que entrar a
  // Cooperativo) para elegir en qué proyecto quedará etiquetado lo que se
  // georreferencie, y que el botón se ilumine en VERDE cuando haya una activa.
  function updateProCityActiveFolderBtn(){
    const btn = app.querySelector('.u52-procity-active-folder-btn');
    if(!btn) return;
    const folder = proCity.activeFolder ? proCity.myFolders.find(f=>f.id === proCity.activeFolder) : null;
    btn.classList.toggle('activa', !!folder);
    btn.textContent = folder ? '🟢' : '📁';
    btn.setAttribute('aria-label', folder ? `Mapeo cooperativo activo en "${folder.nombre}" — toca para cambiar` : 'Elegir carpeta cooperativa activa para mapear');
    btn.title = folder ? `Activo: ${folder.nombre}` : 'Elegir carpeta cooperativa';
  }
  function showProCityActiveFolderPicker(){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    if(!proCity.foldersLoaded){ loadProCityFolders().then(showProCityActiveFolderPicker); return; }
    const activaHtml = proCity.activeFolder ? `
      <button type="button" class="u52-procity-active-folder-off" data-u52-call="procity-active-folder-clear">✕ Desactivar mapeo cooperativo</button>` : '';
    const lista = proCity.myFolders.length ? proCity.myFolders.map(f=>{
      const activa = proCity.activeFolder === f.id;
      return `<button type="button" class="u52-procity-folder-card${activa?' activa':''}" data-u52-procity-active-pick="${esc(f.id)}">
        <div class="u52-procity-folder-head">
          <div><b>${activa?'🟢':'📁'} ${esc(f.nombre)}</b><small>Código: ${esc(f.id)} · ${(f.miembros||[]).length} miembro(s)</small></div>
        </div>
      </button>`;
    }).join('') : `<div class="u52-empty-card"><span>🤝</span><div><b>Aún no tienes proyectos cooperativos</b><small>Crea uno desde 🤝 Cooperativo para poder elegirlo aquí.</small></div></div>`;
    let sheet = document.getElementById('u52-procity-active-folder-sheet');
    if(!sheet){ sheet = document.createElement('div'); sheet.id = 'u52-procity-active-folder-sheet'; sheet.className = 'u52-procity-sheet'; mapScreen.appendChild(sheet); }
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-active-folder-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>📁 Mapear dentro de un proyecto</b><small>Elige la carpeta cooperativa activa</small></div>
          <button type="button" data-u52-call="procity-active-folder-close" aria-label="Cerrar">×</button>
        </div>
        ${activaHtml}
        <div class="u52-procity-mine-list">${lista}</div>
      </div>`;
    sheet.hidden = false;
  }
  function hideProCityActiveFolderPicker(){
    const s = document.getElementById('u52-procity-active-folder-sheet');
    if(s) s.hidden = true;
  }
  function pickProCityActiveFolder(folderId){
    proCity.activeFolder = folderId;
    updateProCityActiveFolderBtn();
    hideProCityActiveFolderPicker();
    const folder = proCity.myFolders.find(f=>f.id === folderId);
    try{ if(typeof showAchievementToast === 'function') showAchievementToast('Proyecto activo', 'Lo que georreferencies ahora quedará en "' + (folder ? folder.nombre : folderId) + '".'); }catch(e){}
  }
  function clearProCityActiveFolder(){
    proCity.activeFolder = '';
    updateProCityActiveFolderBtn();
    hideProCityActiveFolderPicker();
    try{ if(typeof showAchievementToast === 'function') showAchievementToast('Proyecto desactivado', 'Ya no se etiquetan los nuevos mapeos.'); }catch(e){}
  }
  // ── Botón flotante en el mapa: elegir QUÉ se ve (pedido explícito) ──
  // 4 vistas: solo yo / solo mis amigos / una carpeta cooperativa (elegir
  // cuál) / todo el mundo. Reutiliza onlyMine/onlyFriends/folderFilter, que
  // ya usa renderProCityPoints para decidir qué dibujar.
  proCity.onlyFriends = false;
  proCity.viewFilterStep = 'main'; // 'main' o 'folder' (submenú de carpetas)
  function updateProCityViewFilterBtn(){
    const btn = app.querySelector('.u52-procity-view-filter-btn');
    if(!btn) return;
    let icon = '👤', label = 'Viendo: solo lo tuyo';
    if(proCity.folderFilter){
      const f = proCity.myFolders.find(x=>x.id === proCity.folderFilter);
      icon = '📁'; label = 'Viendo: proyecto "' + (f ? f.nombre : proCity.folderFilter) + '"';
    } else if(proCity.onlyFriends){
      icon = '👥'; label = 'Viendo: solo tus amigos';
    } else if(!proCity.onlyMine){
      icon = '🌐'; label = 'Viendo: todo el mundo';
    }
    btn.textContent = icon;
    btn.setAttribute('aria-label', label + ' — toca para cambiar');
    btn.title = label;
  }
  function showProCityViewFilterPicker(){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    if(proCity.viewFilterStep === 'folder' && !proCity.foldersLoaded){ loadProCityFolders().then(showProCityViewFilterPicker); return; }
    let sheet = document.getElementById('u52-procity-view-filter-sheet');
    if(!sheet){ sheet = document.createElement('div'); sheet.id = 'u52-procity-view-filter-sheet'; sheet.className = 'u52-procity-sheet'; mapScreen.appendChild(sheet); }
    let contenido;
    if(proCity.viewFilterStep === 'folder'){
      const lista = proCity.myFolders.length ? proCity.myFolders.map(f=>`
        <button type="button" class="u52-procity-folder-card${proCity.folderFilter===f.id?' activa':''}" data-u52-procity-view-folder-pick="${esc(f.id)}">
          <div class="u52-procity-folder-head"><div><b>📁 ${esc(f.nombre)}</b><small>Código: ${esc(f.id)} · ${(f.miembros||[]).length} miembro(s)</small></div></div>
        </button>`).join('') : `<div class="u52-empty-card"><span>🤝</span><div><b>Aún no tienes proyectos cooperativos</b><small>Crea uno desde 🤝 Cooperativo primero.</small></div></div>`;
      contenido = `
        <div class="u52-procity-sheet-head">
          <button type="button" data-u52-call="procity-view-filter-back" aria-label="Volver">‹</button>
          <div><b>📁 ¿Qué proyecto?</b><small>Elige la carpeta cooperativa a ver</small></div>
          <button type="button" data-u52-call="procity-view-filter-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-procity-mine-list">${lista}</div>`;
    } else {
      contenido = `
        <div class="u52-procity-sheet-head">
          <div><b>👁️ ¿Qué quieres ver en el mapa?</b><small>Elige la vista</small></div>
          <button type="button" data-u52-call="procity-view-filter-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-procity-view-filter-options">
          <button type="button" class="u52-procity-view-filter-opt${(proCity.onlyMine && !proCity.folderFilter && !proCity.onlyFriends)?' activa':''}" data-u52-call="procity-view-filter-mine"><span>👤</span><b>Solo lo mío</b><small>Lo que yo he georreferenciado</small></button>
          <button type="button" class="u52-procity-view-filter-opt${proCity.onlyFriends?' activa':''}" data-u52-call="procity-view-filter-friends"><span>👥</span><b>Solo mis amigos</b><small>Lo mapeado por tus contactos</small></button>
          <button type="button" class="u52-procity-view-filter-opt${proCity.folderFilter?' activa':''}" data-u52-call="procity-view-filter-folder-step"><span>📁</span><b>Una carpeta cooperativa</b><small>Elegir cuál proyecto ver</small></button>
          <button type="button" class="u52-procity-view-filter-opt${(!proCity.onlyMine && !proCity.onlyFriends && !proCity.folderFilter)?' activa':''}" data-u52-call="procity-view-filter-all"><span>🌐</span><b>Todo el mundo</b><small>Todo lo que hay mapeado</small></button>
        </div>`;
    }
    sheet.innerHTML = `<div class="u52-procity-sheet-backdrop" data-u52-call="procity-view-filter-close"></div><div class="u52-procity-sheet-card">${contenido}</div>`;
    sheet.hidden = false;
  }
  function hideProCityViewFilterPicker(){
    const s = document.getElementById('u52-procity-view-filter-sheet');
    if(s) s.hidden = true;
    proCity.viewFilterStep = 'main';
  }
  function setProCityViewFilter(mode, folderId){
    if(mode === 'mine'){ proCity.onlyMine = true; proCity.onlyFriends = false; proCity.folderFilter = ''; }
    else if(mode === 'friends'){ proCity.onlyMine = false; proCity.onlyFriends = true; proCity.folderFilter = ''; }
    else if(mode === 'folder'){ proCity.onlyMine = false; proCity.onlyFriends = false; proCity.folderFilter = folderId || ''; }
    else { proCity.onlyMine = false; proCity.onlyFriends = false; proCity.folderFilter = ''; }
    hideProCityViewFilterPicker();
    updateProCityViewFilterBtn();
    try{ renderProCityPoints(); }catch(e){}
    const labels = { mine:'Mostrando solo lo tuyo.', friends:'Mostrando lo mapeado por tus amigos.', folder:'Mostrando solo este proyecto cooperativo.', all:'Mostrando todo lo mapeado.' };
    try{ if(typeof showAchievementToast === 'function') showAchievementToast('Vista del mapa', labels[mode] || ''); }catch(e){}
  }
  // ── Agregar MANUALMENTE uno o varios mapeos ya existentes a una carpeta ──
  // Pedido explícito: "por si en algún momento olvidé activar el modo
  // cooperativo" — sin esto, un mapeo hecho sin carpeta activa se quedaba
  // fuera de cualquier proyecto para siempre. También soporta selección
  // múltiple (varios mapeos de una sola vez).
  function showProCityTagFolderPicker(points){
    // Se guardan los PUNTOS YA CARGADOS (mismos registros que ya tenías en
    // pantalla) — así se editan directo sin tener que volver a buscarlos en
    // el servidor por coordenadas (eso podía fallar si el lat no calzaba
    // exacto como texto). Son los mismos mapeos, solo se les agrega la
    // etiqueta de carpeta a su descripción ya existente.
    proCity.tagTargetPoints = (points || []).filter(Boolean);
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    if(!proCity.tagTargetPoints.length){ alert('No se encontró ese mapeo. Intenta de nuevo.'); return; }
    if(!proCity.foldersLoaded){ loadProCityFolders().then(function(){ showProCityTagFolderPicker(points); }); return; }
    const n = proCity.tagTargetPoints.length;
    const lista = proCity.myFolders.length ? proCity.myFolders.map(f=>`
      <button type="button" class="u52-procity-folder-card" data-u52-procity-tag-pick="${esc(f.id)}">
        <div class="u52-procity-folder-head"><div><b>📁 ${esc(f.nombre)}</b><small>Código: ${esc(f.id)} · ${(f.miembros||[]).length} miembro(s)</small></div></div>
      </button>`).join('') : `<div class="u52-empty-card"><span>🤝</span><div><b>Aún no tienes proyectos cooperativos</b><small>Crea uno desde 🤝 Cooperativo primero.</small></div></div>`;
    let sheet = document.getElementById('u52-procity-tag-folder-sheet');
    if(!sheet){ sheet = document.createElement('div'); sheet.id = 'u52-procity-tag-folder-sheet'; sheet.className = 'u52-procity-sheet'; mapScreen.appendChild(sheet); }
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-tag-folder-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>📁 Agregar ${n > 1 ? n + ' mapeos' : 'a una carpeta'}</b><small>Elige el proyecto cooperativo</small></div>
          <button type="button" data-u52-call="procity-tag-folder-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-procity-mine-list">${lista}</div>
      </div>`;
    sheet.hidden = false;
  }
  function hideProCityTagFolderPicker(){
    const s = document.getElementById('u52-procity-tag-folder-sheet');
    if(s) s.hidden = true;
  }
  function tagExistingProCityPoint(folderId){
    const puntos = proCity.tagTargetPoints || [];
    if(!puntos.length){ alert('No se encontró ese mapeo. Intenta de nuevo.'); return; }
    if(typeof window.urbisDBUpdate !== 'function') return;
    hideProCityTagFolderPicker();
    // Actualización OPTIMISTA: se edita `p` (la MISMA referencia que vive
    // dentro de globalData) de una vez en memoria para cada punto elegido,
    // así cualquier vista ya abierta lo refleja al instante sin esperar
    // ninguna vuelta al servidor. El guardado real sigue en segundo plano.
    puntos.forEach(function(p){
      const d = String(p.descripcion || '').split(' | ');
      d[PROCITY_FOLDER_FIELD_OFFSET] = folderId;
      const nuevaDescripcion = d.join(' | ');
      p.descripcion = nuevaDescripcion;
      window.urbisDBUpdate('lat', p.lat, { descripcion: nuevaDescripcion }).catch(function(){});
    });
    if(proCity.selectMode) toggleProCitySelectMode(false); else if(proCityCoopScreenOpen()) renderProCityCoopScreen();
    try{ renderProCityPoints(); }catch(e){}
    const folder = proCity.myFolders.find(f=>f.id === folderId);
    const nombreFolder = folder ? folder.nombre : folderId;
    try{
      if(typeof showAchievementToast === 'function'){
        showAchievementToast('Agregado a la carpeta', (puntos.length > 1 ? puntos.length + ' mapeos ya quedan' : 'Este mapeo ya queda') + ' dentro de "' + nombreFolder + '".');
      }
    }catch(e){}
    setTimeout(function(){
      try{ if(typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos(); }catch(e){}
    }, 1500);
  }
  // ── Selección múltiple en "Mis mapeos": para agregar varios mapeos a la
  // vez a una carpeta cooperativa (pedido explícito), en vez de entrar uno
  // por uno. Se activa con el botón "Seleccionar" o manteniendo presionado
  // un mapeo (long-press). ──
  proCity.selectMode = false;
  proCity.selectedLats = new Set();
  function toggleProCitySelectMode(forceOn){
    proCity.selectMode = (forceOn === undefined) ? !proCity.selectMode : !!forceOn;
    if(!proCity.selectMode) proCity.selectedLats.clear();
    showProCityStats();
  }
  function toggleProCitySelectLat(lat){
    const key = String(lat);
    if(proCity.selectedLats.has(key)) proCity.selectedLats.delete(key);
    else proCity.selectedLats.add(key);
    showProCityStats();
  }
  function showProCityBulkTagFolderPicker(){
    const datos = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    const puntos = datos.filter(p => p && proCity.selectedLats.has(String(p.lat)));
    if(!puntos.length){ alert('Selecciona al menos un mapeo primero (mantén presionado uno para empezar).'); return; }
    showProCityTagFolderPicker(puntos);
  }
  // ── Modo Cooperativo: pantalla propia (NO flotante) para el mapeo grupal ──
  // Pedido explícito: no debe sentirse como una hoja flotante encima del
  // mapa — se abre como una ventana que se apropia de toda la pantalla,
  // con sus propias opciones abajo y navegación (lista de proyectos → tocar
  // uno entra a ver lo mapeado ahí por el usuario y sus amigos).
  proCity.coopView = 'list';    // 'list' (todos mis proyectos) o 'detail' (dentro de uno)
  proCity.coopFolderId = '';
  function proCityCoopScreenOpen(){
    const el = document.getElementById('u52-procity-coop');
    return !!(el && !el.hidden);
  }
  function openProCityCoop(){
    hideProCityStats();
    proCity.coopView = 'list';
    proCity.coopFolderId = '';
    if(!proCity.foldersLoaded) loadProCityFolders();
    renderProCityCoopScreen();
  }
  function closeProCityCoop(){
    const el = document.getElementById('u52-procity-coop');
    if(el) el.hidden = true;
  }
  function openProCityCoopFolder(folderId){
    proCity.coopFolderId = folderId;
    proCity.coopView = 'detail';
    proCity.coopSearch = ''; proCity.coopAuthorFilter = '';
    renderProCityCoopScreen();
  }
  function backProCityCoop(){
    if(proCity.coopView === 'detail'){
      proCity.coopView = 'list'; proCity.coopFolderId = '';
      proCity.coopSearch = ''; proCity.coopAuthorFilter = '';
      renderProCityCoopScreen();
    } else { closeProCityCoop(); }
  }
  // Barras de "lo que existe" dentro de un proyecto cooperativo, agrupadas
  // por USO (Vivienda/Residencial, Árboles/Forestal, Comercio, Deporte…),
  // contando la etiqueta guardada "Uso · Tipo". Se llama desde
  // renderProCityCoopScreen cada vez que se abre/actualiza el detalle, así
  // que siempre refleja lo que YA esté mapeado en ese momento (en vivo).
  // Pedido explícito: mismo tratamiento que "Totales" — barras por las 10
  // categorías de la Matriz de Grupos (no por uso individual), y cada
  // título es tocable para ver el desglose de usos/ítems (ver
  // showProCityGrupoDetalle), acotado a los mapeos de ESTA carpeta.
  function renderProCityFolderStats(puntos){
    if(!puntos.length) return '';
    proCity.coopStatsPuntos = puntos;
    const conteoGrupos = {};
    puntos.forEach(p=>{
      const uso = _procityPuntoUso(p);
      const g = MATRIZ_GRUPOS.find(gr => gr.usos.includes(uso));
      const gid = g ? g.id : 'mixtos';
      conteoGrupos[gid] = (conteoGrupos[gid] || 0) + 1;
    });
    const total = puntos.length;
    const filas = MATRIZ_GRUPOS.map(g=>({ gid:g.id, icon:g.i, titulo:g.t, n: conteoGrupos[g.id] || 0 }))
      .sort((a,b)=>b.n - a.n)
      .map(({gid,icon,titulo,n})=>{
        const pct = total ? Math.round((n/total)*100) : 0;
        const color = MATRIZ_GRUPO_COLOR[gid] || '#6b70e0';
        return `<button type="button" class="u52-procity-stat-bar-row" data-u52-call="procity-grupo-detalle-folder" data-gid="${esc(gid)}">
          <div class="u52-procity-stat-bar-label"><span>${icon}</span><b>${esc(titulo)}</b><small>${n} · ${pct}%</small><span class="u52-procity-stat-bar-arrow">›</span></div>
          <div class="u52-procity-stat-bar-track"><div class="u52-procity-stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </button>`;
      }).join('');
    return `<div class="u52-procity-folder-stats">
      <small class="u52-procity-folder-sublabel">Lo que hay mapeado · ${total} en total</small>
      ${filas}
    </div>`;
  }

  function _procityPuntoUso(p){
    const d = String(p.descripcion||'').split(' | ');
    // BUG real: d[1] ("nombre") viene como "dirección — Uso · Tipo" (con la
    // dirección pegada delante), así que buscar el uso ahí devolvía
    // "Sector 1, Cúcuta — Residencial" (no coincide con nada de la Matriz →
    // caía al ícono de repuesto 📍). d[0] ("item") SÍ es el "Uso · Tipo"
    // puro, sin la dirección — es la fuente correcta.
    const puro = (d[0] || '').trim();
    return puro.split(' · ')[0] || 'Otro';
  }
  // Rellena SOLO el contenedor de resultados (chips de autor + lista) para
  // que el buscador no pierda el foco entre teclas — mismo patrón que el
  // buscador de la Matriz de Usos.
  function fillProCityCoopResults(puntos){
    const cont = document.getElementById('u52-coop-results');
    if(!cont) return;
    const autoresConteo = {};
    puntos.forEach(p=>{
      const d = String(p.descripcion||'').split(' | ');
      const autor = d[BASE_OFFSET + 2] || 'Anónimo';
      autoresConteo[autor] = (autoresConteo[autor]||0) + 1;
    });
    const autores = Object.keys(autoresConteo).sort((a,b)=>autoresConteo[b]-autoresConteo[a]);
    const chipsAutores = autores.length > 1 ? `
      <div class="u52-procity-coop-authors">
        <button type="button" class="u52-procity-coop-author-chip${!proCity.coopAuthorFilter?' active':''}" data-u52-call="procity-coop-author" data-author="">Todos · ${puntos.length}</button>
        ${autores.map(a=>`<button type="button" class="u52-procity-coop-author-chip${proCity.coopAuthorFilter===a?' active':''}" data-u52-call="procity-coop-author" data-author="${esc(a)}">👤 ${esc(a)} · ${autoresConteo[a]}</button>`).join('')}
      </div>` : '';

    // Pedido explícito: filtro rápido por categoría (Vivienda, Industria,
    // Salud…) para simplificar la lista, además del filtro por autor.
    const grupoConteo = {};
    puntos.forEach(p=>{
      const uso = _procityPuntoUso(p);
      const g = MATRIZ_GRUPOS.find(gr => gr.usos.includes(uso));
      const gid = g ? g.id : 'mixtos';
      grupoConteo[gid] = (grupoConteo[gid] || 0) + 1;
    });
    const gruposPresentes = MATRIZ_GRUPOS.filter(g => grupoConteo[g.id]).sort((a,b)=>grupoConteo[b.id]-grupoConteo[a.id]);
    // Pedido explícito: que se vea como un menú desplegable (no chips sueltos
    // que repetían el mismo "Todos" del filtro de autor) — un <details> con
    // el nombre de la categoría activa en el propio título.
    const grupoActivo = proCity.coopGrupoFilter ? gruposPresentes.find(g=>g.id === proCity.coopGrupoFilter) : null;
    const chipsGrupos = gruposPresentes.length > 1 ? `
      <details class="u52-procity-totales-detalle"${proCity.coopGrupoFilter ? ' open' : ''}>
        <summary>🏷️ Categoría${grupoActivo ? ': ' + grupoActivo.i + ' ' + esc(grupoActivo.t) : ' (todas)'}</summary>
        <div class="u52-procity-coop-authors">
          ${proCity.coopGrupoFilter ? `<button type="button" class="u52-procity-coop-author-chip" data-u52-call="procity-coop-grupo" data-gid="">✕ Quitar filtro</button>` : ''}
          ${gruposPresentes.map(g=>`<button type="button" class="u52-procity-coop-author-chip${proCity.coopGrupoFilter===g.id?' active':''}" data-u52-call="procity-coop-grupo" data-gid="${esc(g.id)}">${g.i} ${esc(g.t)} · ${grupoConteo[g.id]}</button>`).join('')}
        </div>
      </details>` : '';

    const q = _norm(proCity.coopSearch);
    const puntosFiltrados = puntos.filter(p=>{
      const d = String(p.descripcion||'').split(' | ');
      if(proCity.coopAuthorFilter && (d[BASE_OFFSET + 2] || 'Anónimo') !== proCity.coopAuthorFilter) return false;
      if(proCity.coopGrupoFilter){
        const uso = _procityPuntoUso(p);
        const g = MATRIZ_GRUPOS.find(gr => gr.usos.includes(uso));
        const gid = g ? g.id : 'mixtos';
        if(gid !== proCity.coopGrupoFilter) return false;
      }
      if(!q) return true;
      const label = (d[1] && d[1].trim()) ? d[1] : (d[0] || '');
      return _norm(label).includes(q);
    });

    const list = puntosFiltrados.length ? `<div class="u52-procity-mine-list">${puntosFiltrados.map(p=>{
      const d = String(p.descripcion||'').split(' | ');
      const uso = _procityPuntoUso(p);
      const g = PROCITY_MATRIZ_USOS.find(x=>x.u === uso);
      const icon = g ? g.i : '📍';
      const label = (d[1] && d[1].trim()) ? d[1] : (d[0] || 'Elemento urbano');
      const autor = d[BASE_OFFSET + 2] || 'Anónimo';
      const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '';
      return `<button type="button" class="u52-procity-mine-card" data-u52-procity-mine="${esc(String(p.lat))}">
        <span class="u52-procity-mine-ico" style="background:var(--pc-chip);color:var(--pc-lav-deep)">${icon}</span>
        <div class="u52-procity-mine-info"><b>${esc(label)}</b><small>👤 ${esc(autor)} · ${esc(fecha)}</small></div>
        <span class="u52-procity-mine-arrow">›</span>
      </button>`;
    }).join('')}</div>` : (puntos.length
      ? `<div class="u52-empty-card"><span>🔎</span><div><b>Sin resultados</b><small>Nada coincide con la búsqueda o el autor elegido.</small></div></div>`
      : `<div class="u52-empty-card"><span>🗺️</span><div><b>Aún no hay nada mapeado en este proyecto</b><small>Toca "Mapear aquí" y georreferencia algo en Pro City para empezar.</small></div></div>`);
    cont.innerHTML = chipsAutores + chipsGrupos + list;
  }
  window.urbisProCityCoopSearch = function(val){
    proCity.coopSearch = val;
    const datos = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    const puntos = datos.filter(p => p && proCityPointFolderId(p) === proCity.coopFolderId);
    fillProCityCoopResults(puntos);
  };
  function pickProCityCoopAuthor(autor){
    proCity.coopAuthorFilter = autor || '';
    const datos = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    const puntos = datos.filter(p => p && proCityPointFolderId(p) === proCity.coopFolderId);
    fillProCityCoopResults(puntos);
  }
  function pickProCityCoopGrupo(gid){
    proCity.coopGrupoFilter = gid || '';
    const datos = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    const puntos = datos.filter(p => p && proCityPointFolderId(p) === proCity.coopFolderId);
    fillProCityCoopResults(puntos);
  }

  function renderProCityCoopScreen(){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    let el = document.getElementById('u52-procity-coop');
    if(!el){ el = document.createElement('div'); el.id = 'u52-procity-coop'; el.className = 'u52-procity-coop-screen'; mapScreen.appendChild(el); }

    if(proCity.coopView === 'detail' && proCity.coopFolderId){
      const fid = proCity.coopFolderId;
      const folder = proCity.myFolders.find(f=>f.id === fid);
      const datos = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
      const puntos = datos.filter(p => p && proCityPointFolderId(p) === fid);
      puntos.sort((a,b) => new Date(b.fecha||0).getTime() - new Date(a.fecha||0).getTime());
      const activa = proCity.activeFolder === fid;
      // Estadísticas EN VIVO del proyecto: se recalculan cada vez que se
      // abre/re-renderiza (los datos ya vienen de globalData), así que
      // reflejan cualquier mapeo nuevo sin trabajo extra. Usa TODOS los
      // puntos (no el filtro de búsqueda/autor de abajo).
      const statsHtml = renderProCityFolderStats(puntos);
      proCity.coopSearch = proCity.coopSearch || '';
      proCity.coopAuthorFilter = proCity.coopAuthorFilter || '';
      proCity.coopGrupoFilter = proCity.coopGrupoFilter || '';
      el.innerHTML = `
        <div class="u52-procity-coop-head">
          <button type="button" data-u52-call="procity-coop-back" aria-label="Volver">‹</button>
          <div><b>🤝 ${esc(folder ? folder.nombre : '')}</b><small>Código: ${esc(fid)} · ${puntos.length} mapeado(s) entre todos</small></div>
          <button type="button" class="u52-procity-folder-gear" data-u52-call="procity-folder-rename" data-folder-id="${esc(fid)}" aria-label="Cambiar nombre del proyecto">✏️</button>
          <button type="button" class="u52-procity-folder-gear" data-u52-call="procity-folder-manage" data-folder-id="${esc(fid)}" aria-label="Gestionar miembros">⚙️</button>
        </div>
        <div class="u52-procity-coop-actions">
          <button type="button" data-u52-call="procity-folder-view" data-folder-id="${esc(fid)}">👁️ Ver en el mapa</button>
          <button type="button" data-u52-call="procity-folder-activate" data-folder-id="${esc(fid)}">${activa ? '🟢 Mapeando aquí' : '⚪ Mapear aquí'}</button>
        </div>
        <div class="u52-procity-coop-body">
          ${statsHtml}
          <input type="text" class="u52-matriz-search" id="u52-coop-search" placeholder="🔎 Buscar por uso, tipo o dirección…" value="${esc(proCity.coopSearch)}" oninput="window.urbisProCityCoopSearch(this.value)" autocomplete="off">
          <div id="u52-coop-results"></div>
        </div>`;
      fillProCityCoopResults(puntos);
    } else {
      const folderCards = proCity.myFolders.map(f=>{
        const activa = proCity.activeFolder === f.id;
        const viendo = proCity.folderFilter === f.id;
        // Todo el rectángulo entra al proyecto — solo estos 2 botones
        // conservan su propia acción y no abren el detalle al tocarlos.
        // La tuerquita también abre el detalle (la gestión de miembros vive
        // en su encabezado), así que puede ser un <button> normal.
        return `<div class="u52-procity-folder-card${activa?' activa':''}" data-u52-procity-folder-open="${esc(f.id)}">
          <div class="u52-procity-folder-head">
            <div><b>📁 ${esc(f.nombre)}</b><small>Código: ${esc(f.id)} · ${(f.miembros||[]).length} miembro(s)</small></div>
            <button type="button" class="u52-procity-folder-gear" data-u52-procity-folder-open="${esc(f.id)}" aria-label="Entrar al proyecto">⚙️</button>
          </div>
          <div class="u52-procity-folder-actions">
            <button type="button" data-u52-call="procity-folder-view" data-folder-id="${esc(f.id)}">${viendo ? '✅ Viendo' : '👁️ Ver mapeados'}</button>
            <button type="button" data-u52-call="procity-folder-activate" data-folder-id="${esc(f.id)}">${activa ? '🟢 Activa' : '⚪ Mapear aquí'}</button>
          </div>
        </div>`;
      }).join('');
      el.innerHTML = `
        <div class="u52-procity-coop-head">
          <button type="button" data-u52-call="procity-coop-back" aria-label="Cerrar">‹</button>
          <div><b>🤝 Modo Cooperativo</b><small>Mapeo grupal con tus amigos</small></div>
          <span class="u52-procity-coop-head-spacer"></span>
        </div>
        <div class="u52-procity-coop-body">
          <div class="u52-procity-folder-tools">
            <button type="button" class="u52-procity-folder-create" data-u52-call="procity-folder-create">＋ Crear proyecto cooperativo</button>
            <button type="button" class="u52-procity-folder-join" data-u52-call="procity-folder-join">🔑 Unirme con código</button>
          </div>
          ${folderCards || `<div class="u52-empty-card"><span>🤝</span><div><b>Aún no tienes proyectos cooperativos</b><small>Crea uno y comparte el código con tus amigos para mapear juntos un mismo sector.</small></div></div>`}
        </div>`;
    }
    el.hidden = false;
  }
  // ── Línea de tiempo tipo CALENDARIO ("viajar en el tiempo" para ver qué
  // se reportó entre una fecha y otra) — pedido explícito: "como cuando uno
  // va a reservar vuelos de un día a otro de otro mes". Se elige un RANGO
  // tocando dos días (o uno solo para ver ese único día), navegando entre
  // meses con ◀/▶. Inactiva por defecto (se ve TODO, sin importar fecha).
  function urbisStartOfDay(ms){ const d = new Date(ms); d.setHours(0,0,0,0); return d.getTime(); }
  function urbisStartOfMonth(ms){ const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
  proCity.timeFilter = { active:false, start:null, end:null, pickingRange:false, viewMonth: urbisStartOfMonth(Date.now()) };

  // ═══ Helpers de tiempo COMPARTIDOS por ambos filtros (Pro City y
  // ciudadano) — un solo cálculo de rango/calendario para no duplicar
  // lógica de fechas entre los dos módulos. ═══
  function urbisTimeRangeFor(tf){
    // end es EXCLUSIVO: se suma 1 día completo al último día elegido para
    // que ese día quede incluido entero en el filtro.
    const start = urbisStartOfDay(tf.start);
    const endDay = new Date(urbisStartOfDay(tf.end != null ? tf.end : tf.start));
    endDay.setDate(endDay.getDate() + 1);
    return { start, end: endDay.getTime() };
  }
  // Selección de un día en el calendario: el primer toque de una selección
  // nueva marca ESE día como rango de un solo día (filtra de inmediato); el
  // segundo toque completa el rango con el día anterior; el tercer toque
  // vuelve a empezar una selección nueva — igual que un buscador de vuelos.
  function urbisSelectCalendarDay(tf, ms){
    const day = urbisStartOfDay(ms);
    if(!tf.pickingRange){
      tf.start = day; tf.end = day; tf.active = true; tf.pickingRange = true;
    } else if(day < tf.start){
      tf.end = tf.start; tf.start = day; tf.pickingRange = false;
    } else {
      tf.end = day; tf.pickingRange = false;
    }
    tf.viewMonth = urbisStartOfMonth(day);
  }
  // Cuando el rango del calendario queda completo (start y end elegidos), el
  // botón "Ver reportes/eventos" aparece al final de la hoja, pero queda
  // tapado por la barra inferior fija sin que el usuario note que ya está
  // ahí — pedido explícito: bajar suave y automático para que lo vea.
  function urbisScrollToViewBtn(sheetId, tf){
    if(!(tf.active && tf.start != null && !tf.pickingRange)) return;
    setTimeout(()=>{
      try{
        const btn = document.querySelector(`#${sheetId} .u52-tf-view-btn`);
        if(btn) btn.scrollIntoView({ behavior:'smooth', block:'end', inline:'nearest' });
      }catch(e){}
    }, 60);
  }
  function urbisRangeLabelFor(tf){
    if(tf.start == null) return 'Elige una fecha o un rango';
    const a = new Date(tf.start).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
    if(tf.end == null || tf.end === tf.start) return a;
    const b = new Date(tf.end).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
    return `${a} → ${b}`;
  }
  // Sin fecha válida en el punto (dato viejo/incompleto): se EXCLUYE al
  // viajar en el tiempo, porque no hay forma de saber a qué momento pertenece.
  function urbisPointInTimeRange(p, range){
    const t = new Date((p && p.fecha) || 0).getTime();
    if(!t || isNaN(t)) return false;
    return t >= range.start && t < range.end;
  }
  function urbisCalendarGridHtml(ns, tf){
    const view = new Date(tf.viewMonth);
    const year = view.getFullYear(), month = view.getMonth();
    const first = new Date(year, month, 1);
    const leadBlanks = (first.getDay() === 0 ? 6 : first.getDay() - 1); // grid Lunes-primero
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = urbisStartOfDay(Date.now());
    const lo = tf.start, hi = (tf.end != null ? tf.end : tf.start);
    let cells = '';
    for(let i = 0; i < leadBlanks; i++) cells += `<span class="u52-tf-cal-cell empty"></span>`;
    for(let day = 1; day <= daysInMonth; day++){
      const ms = new Date(year, month, day).getTime();
      let cls = 'u52-tf-cal-cell';
      if(ms === today) cls += ' today';
      if(lo != null && (ms === lo || ms === hi)) cls += ' sel';
      else if(lo != null && hi != null && ms > lo && ms < hi) cls += ' inrange';
      cells += `<button type="button" class="${cls}" data-u52-call="${ns}-tf-day" data-ms="${ms}">${day}</button>`;
    }
    const monthLabel = view.toLocaleDateString('es-CO',{month:'long',year:'numeric'});
    const wd = ['L','M','M','J','V','S','D'].map(w=>`<span class="u52-tf-cal-wd">${w}</span>`).join('');
    return `
      <div class="u52-tf-cal-nav">
        <button type="button" data-u52-call="${ns}-tf-month-prev" aria-label="Mes anterior">◀</button>
        <span class="u52-tf-cal-month">${esc(monthLabel)}</span>
        <button type="button" data-u52-call="${ns}-tf-month-next" aria-label="Mes siguiente">▶</button>
      </div>
      <div class="u52-tf-cal-grid">${wd}${cells}</div>`;
  }
  // Bloque de UI reutilizado en AMBAS hojas de filtro (Pro City y ciudadano)
  // — solo cambia el prefijo `ns` de los data-u52-call para que cada uno
  // dispare su propio estado independiente.
  function urbisTimelineBlockHtml(ns, tf, closeCall){
    // El botón "Ver reportes/eventos" solo aparece con un rango YA elegido
    // (no a mitad de selección, cuando falta el segundo toque) — pedido
    // explícito para que quede claro que hay que tocar el botón para ver el
    // resultado en el mapa, en vez de adivinar que ya se aplicó el filtro.
    const rangoListo = tf.active && tf.start != null && !tf.pickingRange;
    return `
        <div class="u52-tf-block${tf.active?' active':''}">
          <div class="u52-tf-head">
            <b>🗓️ Línea de tiempo</b>
            ${tf.active?`<button type="button" class="u52-tf-reset" data-u52-call="${ns}-tf-reset">Ver todo ✕</button>`:''}
          </div>
          <div class="u52-tf-range-label">${esc(urbisRangeLabelFor(tf))}</div>
          ${urbisCalendarGridHtml(ns, tf)}
          ${rangoListo?`<button type="button" class="u52-tf-view-btn" data-u52-call="${closeCall}">👁️ Ver reportes/eventos en esas fechas</button>`:''}
        </div>`;
  }

  // Identidad ESTRICTA (a diferencia de esAutorDelReporte, que deja pasar a
  // admin/gov para poder GESTIONAR cualquier reporte): aquí "mío" siempre
  // significa que YO lo georreferencié, sin excepción de rol.
  function esPropioProCity(p){
    try{
      if(!p || !p.descripcion) return false;
      const d = String(p.descripcion).split(' | ');
      const autorNombre = d[BASE_OFFSET + 2] || '';
      const autorCorreo = d[BASE_OFFSET + 5] || '';
      const autorCedula = d[BASE_OFFSET + 6] || '';
      const yo = (typeof window.urbisIdentidadActual === 'function') ? window.urbisIdentidadActual() : null;
      if(!yo) return false;
      const cmp = window.esMismoValorNoVacio;
      if(typeof cmp !== 'function') return false;
      return cmp(autorCorreo, yo.correo) || cmp(autorCedula, yo.cedula) || cmp(autorNombre, yo.nombre) || cmp(autorNombre, yo.usuario);
    }catch(e){ return false; }
  }

  function ensureProCityLayer(){
    if(!window.map || !window.L) return null;
    if(!proCityLayer) proCityLayer = L.layerGroup();
    return proCityLayer;
  }

  function proCityShapeHtml(shape, color){
    const s = `width:16px;height:16px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(30,40,90,.45);display:block;`;
    if(shape==='square')   return `<span style="${s}border-radius:3px"></span>`;
    if(shape==='diamond')  return `<span style="${s}border-radius:3px;transform:rotate(45deg)"></span>`;
    if(shape==='triangle') return `<span style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:17px solid ${color};filter:drop-shadow(0 2px 3px rgba(30,40,90,.45));display:block"></span>`;
    return `<span style="${s}border-radius:50%"></span>`; // círculo
  }

  // Redibuja TODOS los puntos Pro City desde globalData ya cargado (cero
  // llamadas extra al backend — clave para el escalado masivo). Se invoca al
  // entrar al módulo, tras guardar/mover/editar y en cada recarga de datos
  // (hook desde pintarPuntos en js/12).
  function renderProCityPoints(){
    const layer = ensureProCityLayer();
    if(!layer) return;
    layer.clearLayers();
    if(!proCity.active){ try{ if(window.map && map.hasLayer(layer)) map.removeLayer(layer); }catch(e){} return; }
    try{ if(window.map && !map.hasLayer(layer)) layer.addTo(map); }catch(e){}
    const datos = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    const dimSet = new Set(PRO_CITY_DIMS);
    datos.forEach(p=>{
      if(!p) return;
      const tipo = String(p.tipo || '');
      if(!dimSet.has(tipo)) return;
      if(proCity.hidden && proCity.hidden.has(tipo)) return;
      // BUG real: si hay un proyecto cooperativo filtrado (folderFilter), debe
      // verse TODO lo mapeado ahí por CUALQUIER miembro — "solo lo mío"
      // (onlyMine, activo por defecto) no debe aplicar en ese caso, porque
      // si no, los puntos de los demás miembros nunca aparecían en el mapa
      // aunque el filtro de carpeta ya los hubiera dejado pasar.
      if(proCity.folderFilter){
        if(proCityPointFolderId(p) !== proCity.folderFilter) return;
      } else if(proCity.onlyFriends){
        // Vista "Solo mis amigos" (pedido explícito, botón 👁️ del mapa).
        if(!esDeAmigoProCity(p)) return;
      } else if(proCity.onlyMine && !esPropioProCity(p)){
        return;
      }
      if(proCity.timeFilter && proCity.timeFilter.active && !urbisPointInTimeRange(p, urbisTimeRangeFor(proCity.timeFilter))) return;
      const lat = parseFloat(String(p.lat).replace(',','.')), lng = parseFloat(String(p.lng).replace(',','.'));
      if(isNaN(lat) || isNaN(lng)) return;
      // BUG real: los puntos de la Matriz de Usos se dibujaban TODOS con la
      // misma forma gris genérica, porque esa rama usa el color/forma de
      // `tipo` (siempre "🗺️ Matriz de Usos" para los 48 usos) en vez del
      // ícono representativo de CADA uso (🏠 Residencial, 🌲 Forestal…).
      // Aquí se usa un pin con el emoji real solo para Matriz de Usos; el
      // resto de dimensiones de Pro City sigue con su forma+color de siempre.
      let iconHtml, iconSize, iconAnchor;
      if(tipo === MATRIZ_USOS_KEY && proCity.matrizVisualMode === 'color'){
        // Modo profesional: color + forma según la categoría del uso (de
        // lejos se ve como un mapa de calor por gama de colores).
        const uso = _procityPuntoUso(p);
        const cf = proCityMatrizColorFor(uso);
        iconHtml = proCityShapeHtml(cf.shape, cf.color);
        iconSize = [22,22]; iconAnchor = [11,11];
      } else if(tipo === MATRIZ_USOS_KEY){
        const usoInfo = PROCITY_MATRIZ_USOS.find(x=>x.u === _procityPuntoUso(p));
        iconHtml = `<div class="u52-procity-matriz-pin">${usoInfo ? usoInfo.i : '📍'}</div>`;
        iconSize = [30,30]; iconAnchor = [15,15];
      } else {
        const d = dimensiones[tipo] || { color:'#6b70e0' };
        const shape = PRO_CITY_SHAPE[tipo] || 'circle';
        iconHtml = proCityShapeHtml(shape, d.color || '#6b70e0');
        iconSize = [22,22]; iconAnchor = [11,11];
      }
      const m = L.marker([lat,lng], { icon: L.divIcon({ className:'u52-procity-shape', html: iconHtml, iconSize, iconAnchor }), zIndexOffset:1500 });
      m.on('click', ev=>{ try{ L.DomEvent.stopPropagation(ev); }catch(e){} if(window.__urbisMovingReport) return; showProCitySelectedPanel(p); });
      m.addTo(layer);
    });
  }
  window.urbisRenderProCityPoints = renderProCityPoints;

  // Panel compacto al tocar un punto: quién lo publicó + Editar (permite
  // cambiar uso/matriz) + Mover. Sin likes/validación/comentarios: esto es
  // análisis urbano, no un reporte ciudadano.
  function showProCitySelectedPanel(p){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    proCity.selPoint = p;
    // Para poder mostrar el nombre de la carpeta cooperativa vinculada (si
    // aplica) — si aún no se cargaron, se vuelve a pintar el panel al llegar.
    if(!proCity.foldersLoaded) loadProCityFolders().then(()=>{ if(proCity.selPoint === p) showProCitySelectedPanel(p); });
    const d = String(p.descripcion || '').split(' | ');
    const dim = String(p.tipo || '');
    // Si es de la Matriz de Usos, el ícono/etiqueta correctos vienen del USO
    // real del punto (ej. "Residencial"), NO de p.tipo (que es SIEMPRE
    // "🗺️ Matriz de Usos" para todos, sin importar qué se mapeó — ese era
    // el bug real de "todos con el mismo ícono").
    const esMatriz = dim === MATRIZ_USOS_KEY;
    const usoReal = esMatriz ? _procityPuntoUso(p) : '';
    const usoInfo = esMatriz ? PROCITY_MATRIZ_USOS.find(x=>x.u === usoReal) : null;
    const dInfo = usoInfo ? { color:'#6b70e0', icon:usoInfo.i } : (dimensiones[dim] || { color:'#6b70e0', icon:'📍' });
    // Pedido explícito: "se ve todo continuo, quiero que se vea clasificado
    // por importancia" — antes el título mostraba el campo crudo (que trae
    // pegada la dirección + "Uso · Tipo") y la dirección se repetía. Ahora,
    // para puntos de la Matriz: 1) el TIPO exacto (lo más específico, ej.
    // "Casa de un piso") como título grande, 2) el USO (ej. "Residencial")
    // como insignia mediana, 3) la dirección como texto pequeño al final.
    const tipoExacto = esMatriz ? ((d[0] || '').split(' · ').slice(1).join(' · ') || '') : '';
    const direccion = esMatriz ? ((d[1] || '').split(' — ')[0] || '') : '';
    const label = esMatriz ? '' : (d[1] || d[0] || 'Elemento urbano');
    const autorFull = d[BASE_OFFSET + 2] || 'Anónimo';
    const shape = PRO_CITY_SHAPE[dim] || 'circle';
    const puedeGestionar = (typeof window.esAutorDelReporte === 'function') ? window.esAutorDelReporte(p) : true;
    const _rol = (window.userRole || '');
    const admin = (_rol === 'admin' || _rol === 'gov');
    const ownFolderId = proCityPointFolderId(p);
    // Pedido explícito: si el mapeo pertenece a una carpeta cooperativa, un
    // subtítulo elegante y discreto lo indica (con el nombre si se conoce).
    const folderDeEste = ownFolderId ? proCity.myFolders.find(f=>f.id === ownFolderId) : null;
    const folderTagSel = ownFolderId ? `<div class="u52-procity-selpanel-folder-tag">🔗 En carpeta cooperativa${folderDeEste ? ': ' + esc(folderDeEste.nombre) : ''}</div>` : '';
    const acciones = (puedeGestionar || admin) ? `
        <div class="u52-procity-sel-actions">
          <button type="button" data-u52-call="procity-sel-edit"><span>✏️</span><b>Editar<br><small>uso / matriz</small></b></button>
          <button type="button" data-u52-call="procity-sel-move"><span>📍</span><b>Mover</b></button>
          <button type="button" class="u52-procity-sel-delete" data-u52-call="procity-sel-delete"><span>🗑️</span><b>Eliminar</b></button>
        </div>` : '';
    // Pedido explícito: se quita el botón "Ver mis mapeos aquí" — para eso
    // ya está la búsqueda manual abajo a la derecha.
    // Pedido explícito: "por si en algún momento olvidé activar el modo
    // cooperativo" — agregar MANUALMENTE este mapeo ya existente a una
    // carpeta, sin tener que haberlo mapeado con esa carpeta activa.
    const addFolderBtn = (!ownFolderId && (puedeGestionar || admin)) ? `<button type="button" class="u52-procity-selpanel-vermapeos" data-u52-call="procity-sel-addfolder" data-lat="${esc(String(p.lat))}">📁 Agregar a una carpeta cooperativa</button>` : '';
    let panel = document.getElementById('u52-procity-selected-panel');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'u52-procity-selected-panel';
      panel.className = 'u52-procity-selpanel';
      mapScreen.appendChild(panel);
    }
    panel.innerHTML = `
      <div class="u52-procity-selpanel-card">
        <button type="button" class="u52-procity-selpanel-x" data-u52-call="procity-sel-close" aria-label="Cerrar">×</button>
        <div class="u52-procity-selpanel-head">
          <span class="u52-procity-selpanel-shape">${esMatriz ? `<span class="u52-procity-selpanel-emoji">${dInfo.icon}</span>` : proCityShapeHtml(shape, dInfo.color || '#6b70e0')}</span>
          ${esMatriz ? `<div>
            <b>${esc(tipoExacto || usoReal)}</b>
            <span class="u52-procity-selpanel-uso-badge">${esc(usoReal)}</span>
            ${direccion ? `<small class="u52-procity-selpanel-dir">📍 ${esc(direccion)}</small>` : ''}
          </div>` : `<div><b>${esc(label)}</b><small>${esc(dim)}</small></div>`}
        </div>
        <div class="u52-procity-selpanel-autor">👤 Publicado por <b>${esc(autorFull)}</b></div>
        ${folderTagSel}
        ${addFolderBtn}
        ${acciones}
      </div>`;
    panel.hidden = false;
  }

  function hideProCitySelectedPanel(){
    const panel = document.getElementById('u52-procity-selected-panel');
    if(panel) panel.hidden = true;
    proCity.selPoint = null;
  }

  // Editar: pedido explícito — antes reabría el flujo de cero (categoría →
  // uso → tipo) antes de llegar al formulario. Ahora va DIRECTO al
  // formulario editable (dirección, descripción) con lo ya elegido; si el
  // usuario quiere cambiar la categoría/uso, el botón "‹ Volver" del propio
  // formulario lo manda al selector (grupo → uso → tipo) sin perder el
  // punto que se está editando. Al guardar, se ACTUALIZA la misma fila (por
  // lat) en vez de crear otra — una sola escritura al backend.
  function beginProCityEdit(p){
    if(!p) return;
    hideProCitySelectedPanel();
    const d = String(p.descripcion || '').split(' | ');
    const dim = String(p.tipo || '') || MATRIZ_USOS_KEY;
    proCity.selected = { lat:Number(String(p.lat).replace(',','.')), lng:Number(String(p.lng).replace(',','.')) };
    proCity.editLat = String(p.lat);
    proCity.dim = dim;
    proCity.pickMode = '';
    proCity.matrizGroup = '';
    proCity.matrizUse = '';
    if(dim === MATRIZ_USOS_KEY){
      const labelActual = (d[0] || '').trim();
      openProCityItemDetails(labelActual);
    } else {
      showProCityCategorySheet();
    }
  }

  function moveProCitySelected(){
    const p = proCity.selPoint;
    hideProCitySelectedPanel();
    if(p && typeof window.urbisIniciarMoverReporte === 'function'){
      window.urbisIniciarMoverReporte(String(p.lat), String(p.lng));
    }
  }

  // Eliminar: reutiliza el mismo borrado (con confirmación, permisos y
  // backend) que ya usan reportes/eventos — window.eliminarPunto (js/12).
  function deleteProCitySelected(){
    const p = proCity.selPoint;
    hideProCitySelectedPanel();
    if(p && typeof window.eliminarPunto === 'function'){
      window.eliminarPunto(String(p.lat));
    }
  }

  // ── Filtro de la matriz de usos: mostrar/ocultar categorías en el mapa ──
  function showProCityFilterSheet(){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return;
    const chips = PRO_CITY_DIMS.map(dim=>{
      const d = dimensiones[dim];
      if(!d) return '';
      const off = proCity.hidden.has(dim);
      return `<button type="button" class="u52-procity-filter-chip${off?' off':''}" data-u52-procity-filter="${esc(dim)}">
        <span class="u52-procity-filter-dot" style="background:${d.color}"></span>
        <b>${esc(dim)}</b>
        <span class="u52-procity-filter-check">${off?'○':'●'}</span>
      </button>`;
    }).join('');
    let sheet = document.getElementById('u52-procity-filter');
    if(!sheet){
      sheet = document.createElement('div');
      sheet.id = 'u52-procity-filter';
      sheet.className = 'u52-procity-sheet';
      mapScreen.appendChild(sheet);
    }
    // Al tocar un día del calendario, la hoja entera se vuelve a construir
    // (sheet.innerHTML) para reflejar el nuevo rango — sin esto, el
    // contenedor con scroll se reinicia a 0 en cada toque y se SIENTE como
    // si la página se recargara/saltara arriba. Se guarda y restaura.
    const prevScroll = sheet.querySelector('.u52-procity-sheet-card')?.scrollTop || 0;
    sheet.innerHTML = `
      <div class="u52-procity-sheet-backdrop" data-u52-call="procity-filter-close"></div>
      <div class="u52-procity-sheet-card">
        <div class="u52-procity-sheet-head">
          <div><b>🔷 Filtrar matriz de usos</b><small>Toca para mostrar u ocultar cada capa</small></div>
          <button type="button" data-u52-call="procity-filter-close" aria-label="Cerrar">×</button>
        </div>
        <button type="button" class="u52-procity-filter-mine${proCity.onlyMine?' on':''}" data-u52-call="procity-filter-mine">
          <span>${proCity.onlyMine?'👤':'🌐'}</span>
          <b>${proCity.onlyMine ? 'Mostrando solo lo mío' : 'Mostrando todo lo mapeado'}</b>
          <small>Toca para ${proCity.onlyMine ? 'ver también lo de otros usuarios' : 'ver solo lo que tú georreferenciaste'}</small>
        </button>
        <div class="u52-procity-filter-tools">
          <button type="button" data-u52-call="procity-filter-all">Mostrar todas</button>
          <button type="button" data-u52-call="procity-filter-none">Ocultar todas</button>
        </div>
        <div class="u52-procity-filter-list">${chips}</div>
        ${urbisTimelineBlockHtml('procity', proCity.timeFilter, 'procity-filter-close')}
      </div>`;
    sheet.hidden = false;
    const cardEl = sheet.querySelector('.u52-procity-sheet-card');
    if(cardEl) cardEl.scrollTop = prevScroll;
  }
  function hideProCityFilterSheet(){
    const sheet = document.getElementById('u52-procity-filter');
    if(sheet) sheet.hidden = true;
  }
  function toggleProCityFilter(dim){
    if(proCity.hidden.has(dim)) proCity.hidden.delete(dim);
    else proCity.hidden.add(dim);
    renderProCityPoints();
    showProCityFilterSheet(); // re-render de los chips
  }
  function setAllProCityFilter(hideAll){
    proCity.hidden = hideAll ? new Set(PRO_CITY_DIMS) : new Set();
    renderProCityPoints();
    showProCityFilterSheet();
  }
  function toggleProCityOnlyMine(){
    proCity.onlyMine = !proCity.onlyMine;
    renderProCityPoints();
    showProCityFilterSheet();
  }
  function pickProCityCalendarDay(ms){
    urbisSelectCalendarDay(proCity.timeFilter, Number(ms));
    renderProCityPoints();
    showProCityFilterSheet();
    urbisScrollToViewBtn('u52-procity-filter', proCity.timeFilter);
  }
  function stepProCityCalendarMonth(dir){
    const d = new Date(proCity.timeFilter.viewMonth);
    d.setMonth(d.getMonth() + dir);
    proCity.timeFilter.viewMonth = d.getTime();
    showProCityFilterSheet();
  }
  function resetProCityTime(){
    proCity.timeFilter = { active:false, start:null, end:null, pickingRange:false, viewMonth: urbisStartOfMonth(Date.now()) };
    renderProCityPoints();
    showProCityFilterSheet();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTRO CIUDADANO (reportes/eventos) — módulo de reportes y eventos, NO
  // Pro City. Muestra/oculta por categoría los pines que YA se pintan en el
  // mapa vía pintarPuntos()/capas[dim] (js/12), reutilizando esas mismas
  // capas Leaflet — no crea marcadores propios ni pega al backend.
  // ═══════════════════════════════════════════════════════════════════════
  // aplicarCapasSegunZoom() (js/06) reactiva TODAS las capas en cada
  // recarga de datos porque en móvil no existe el checkbox de escritorio
  // (#layers-toggles) que consulta capaManualEstaActiva(). Se parchea esa
  // función para que también respete el filtro móvil, sin tocar el
  // comportamiento de escritorio (que sigue intacto si hay checkboxes).
  window.urbisCitizenFilterHidden = window.urbisCitizenFilterHidden || new Set();
  (function(){
    const _origCapaManualEstaActiva = window.capaManualEstaActiva;
    window.capaManualEstaActiva = function(capaName){
      if(window.urbisCitizenFilterHidden && window.urbisCitizenFilterHidden.has(capaName)) return false;
      return (typeof _origCapaManualEstaActiva === 'function') ? _origCapaManualEstaActiva(capaName) : true;
    };
  })();

  // ── Línea de tiempo ciudadana: mismo concepto que la de Pro City pero
  // aplicada a TODAS las categorías de reportes/eventos a la vez (no es por
  // capa). Se implementa parcheando pintarPuntos() (js/12) para filtrar por
  // fecha el arreglo ANTES de crear los marcadores — reutiliza 100% del
  // pipeline de dibujo existente, cero marcadores propios.
  window.urbisCitizenTimeFilter = window.urbisCitizenTimeFilter || { active:false, start:null, end:null, pickingRange:false, viewMonth: urbisStartOfMonth(Date.now()) };
  // Pedido explícito: al viajar en el tiempo, los reportes TEMPORALES
  // (Alertas/Tráfico, 8h de vigencia) deben verse igual aunque ya hayan
  // vencido — "la idea de archivarlos es solo para no sobresaturar el mapa
  // en vivo, pero si viajo en el tiempo quiero ver todo lo que se reportó
  // ese día". datosVisiblesActuales() (js/05) ya los descarta ANTES de que
  // mi filtro los vea, así que en modo viaje en el tiempo se ignora esa
  // vigencia y se reconstruye la lista visible SOLO por aprobación +
  // fecha de creación (sin el chequeo de "ya expiró").
  function urbisVisibleIgnorandoVigencia(p){
    try{
      const d = String((p && p.descripcion) || '').split(' | ');
      const validacion = d[BASE_OFFSET + 1] || 'Aprobado';
      const meta = (typeof obtenerMetaTemporal === 'function') ? obtenerMetaTemporal(p) : { temporal:false };
      if(meta.temporal) return true; // se filtra por fecha de creación más abajo, no por vigencia
      return validacion === 'Aprobado';
    }catch(e){ return true; }
  }
  (function(){
    const _origPintarPuntos = window.pintarPuntos;
    if(typeof _origPintarPuntos !== 'function') return;
    window.pintarPuntos = function(data){
      const tf = window.urbisCitizenTimeFilter;
      let usar = data;
      if(tf && tf.active){
        const range = urbisTimeRangeFor(tf);
        const base = (typeof globalData !== 'undefined' && Array.isArray(globalData) && typeof window.esFilaMetaUrbis === 'function')
          ? globalData.filter(p => p && !window.esFilaMetaUrbis(p) && urbisVisibleIgnorandoVigencia(p))
          : data;
        usar = base.filter(p => urbisPointInTimeRange(p, range));
      }
      return _origPintarPuntos(usar);
    };
  })();
  function refreshCitizenMapData(){
    try{ if(typeof datosVisiblesActuales === 'function' && typeof pintarPuntos === 'function') pintarPuntos(datosVisiblesActuales()); }catch(e){}
  }

  function citizenFilterDims(){
    if(typeof dimensiones === 'undefined') return [];
    return Object.keys(dimensiones).filter(d => !PRO_CITY_DIMS.includes(d) && !(typeof window.urbisEsCategoriaAutomapeo === 'function' && window.urbisEsCategoriaAutomapeo(d)));
  }

  function applyCitizenFilterToMap(){
    try{
      if(!window.map || typeof capas === 'undefined') return;
      Object.keys(capas).forEach(dim=>{
        const layer = capas[dim];
        if(!layer) return;
        if(window.urbisCitizenFilterHidden.has(dim)){ if(map.hasLayer(layer)) map.removeLayer(layer); }
        else{ if(!map.hasLayer(layer)) map.addLayer(layer); }
      });
    }catch(e){}
  }

  function showCitizenFilterSheet(){
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen || typeof dimensiones === 'undefined') return;
    const chips = citizenFilterDims().map(dim=>{
      const d = dimensiones[dim];
      if(!d) return '';
      const off = window.urbisCitizenFilterHidden.has(dim);
      return `<button type="button" class="u52-cfilter-chip${off?' off':''}" data-u52-cfilter="${esc(dim)}">
        <span class="u52-cfilter-dot" style="background:${d.color}">${d.icon || ''}</span>
        <b>${esc(dim)}</b>
        <span class="u52-cfilter-check">${off?'○':'●'}</span>
      </button>`;
    }).join('');
    let sheet = document.getElementById('u52-cfilter-sheet');
    if(!sheet){
      sheet = document.createElement('div');
      sheet.id = 'u52-cfilter-sheet';
      sheet.className = 'u52-cfilter-sheet';
      mapScreen.appendChild(sheet);
    }
    // Ver comentario equivalente en showProCityFilterSheet(): sin esto, la
    // hoja "saltaba" arriba en cada toque del calendario.
    const prevScroll = sheet.querySelector('.u52-cfilter-card')?.scrollTop || 0;
    sheet.innerHTML = `
      <div class="u52-cfilter-backdrop" data-u52-call="cfilter-close"></div>
      <div class="u52-cfilter-card">
        <div class="u52-cfilter-head">
          <div><b>🎚️ Filtrar reportes y eventos</b><small>Toca para mostrar u ocultar cada tipo</small></div>
          <button type="button" data-u52-call="cfilter-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-cfilter-tools">
          <button type="button" data-u52-call="cfilter-all">Mostrar todos</button>
          <button type="button" data-u52-call="cfilter-none">Ocultar todos</button>
        </div>
        <div class="u52-cfilter-list">${chips}</div>
        ${urbisTimelineBlockHtml('cfilter', window.urbisCitizenTimeFilter, 'cfilter-close')}
      </div>`;
    sheet.hidden = false;
    const cardEl = sheet.querySelector('.u52-cfilter-card');
    if(cardEl) cardEl.scrollTop = prevScroll;
  }
  function hideCitizenFilterSheet(){
    const sheet = document.getElementById('u52-cfilter-sheet');
    if(sheet) sheet.hidden = true;
  }
  function toggleCitizenFilterDim(dim){
    if(window.urbisCitizenFilterHidden.has(dim)) window.urbisCitizenFilterHidden.delete(dim);
    else window.urbisCitizenFilterHidden.add(dim);
    applyCitizenFilterToMap();
    showCitizenFilterSheet();
  }
  function setAllCitizenFilter(hideAll){
    window.urbisCitizenFilterHidden = hideAll ? new Set(citizenFilterDims()) : new Set();
    applyCitizenFilterToMap();
    showCitizenFilterSheet();
  }
  function pickCitizenCalendarDay(ms){
    urbisSelectCalendarDay(window.urbisCitizenTimeFilter, Number(ms));
    refreshCitizenMapData();
    showCitizenFilterSheet();
    urbisScrollToViewBtn('u52-cfilter-sheet', window.urbisCitizenTimeFilter);
  }
  function stepCitizenCalendarMonth(dir){
    const tf = window.urbisCitizenTimeFilter;
    const d = new Date(tf.viewMonth);
    d.setMonth(d.getMonth() + dir);
    tf.viewMonth = d.getTime();
    showCitizenFilterSheet();
  }
  function resetCitizenTime(){
    window.urbisCitizenTimeFilter = { active:false, start:null, end:null, pickingRange:false, viewMonth: urbisStartOfMonth(Date.now()) };
    refreshCitizenMapData();
    showCitizenFilterSheet();
  }

  function beginProCityMapSelection(dim){
    if(typeof dimensiones === 'undefined' || !dimensiones[dim]) return;
    proCity.dim = dim; proCity.active = true;
    proCity.matrizUse = ''; proCity.matrizGroup = ''; proCity.matrizSearch = ''; // reinicia el flujo de 3 niveles de la Matriz de Usos
    hideProCityCategorySheet();
    // Si ya se había ubicado el punto ANTES de elegir categoría (flujo "Con
    // mi ubicación" / "En el mapa"), se salta directo a elegir el ítem —
    // no hay que tocar el mapa otra vez.
    if(proCity.selected){ renderProCityItems(); return; }
    proCity.pickMode = 'manual'; proCity.selected = null;
    resetMapForCommunityReport();
    ensureCommunityMapPicker();
    hideCommunityChooser(false);
    hideQuickReportPanel();
    try{ window.urbisDisableReportMapClick = true; }catch(e){}
    setMapReportStatus(`📍 Toca el mapa para ubicar: <b>${esc(dim)}</b>`);
  }

  function pickProCityPoint(lat, lng){
    proCity.pickMode = '';
    proCity.selected = { lat:Number(lat), lng:Number(lng) };
    try{ window.urbisDisableReportMapClick = true; }catch(e){}
    setMapReportStatus('');
    try{ if(window.map) map.setView([lat, lng], Math.max(map.getZoom ? map.getZoom() : 17, 17), { animate:true }); }catch(e){}
    renderCommunityPickMarker(lat, lng);
    // Si ya venía elegida la categoría (flujo "🏙️ Categoría" primero), se
    // muestran directo sus ítems; si no, se pregunta QUÉ ubicar en este punto.
    if(proCity.dim) renderProCityItems();
    else showProCityCategorySheet();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MATRIZ DE USOS EN DOS NIVELES — EXCLUSIVO de Pro City (categoría
  // "🗺️ Matriz de Usos"). Pedido explícito: NO tocar el checklist de 37
  // usos del flujo ciudadano (todosLosUsos en js/04, que además define
  // BASE_OFFSET y no se puede cambiar sin romper la lectura de reportes ya
  // guardados). Por eso esta estructura es SEPARADA y vive solo aquí: 47
  // usos, cada uno abierto en sus tipos exactos. Al guardar, la etiqueta
  // combina "Uso · Tipo" para que el análisis conserve ambos niveles.
  // ═══════════════════════════════════════════════════════════════════════
  const PROCITY_MATRIZ_USOS = [
    { u:'Residencial', i:'🏠', t:['Casa de un piso','Casa de dos pisos','Casa de tres o más pisos','Casa con antejardín','Casa con garaje','Casa patio / casalote','Casa esquinera','Edificio de apartamentos (1–3 pisos)','Torre residencial (4–10 pisos)','Torre alta (10+ pisos)','Conjunto cerrado / urbanización','Casa campestre / quinta','Vivienda multifamiliar','Inquilinato / pieza en arriendo'] },
    { u:'Vivienda de Interés Social (VIS/VIP)', i:'🏘️', t:['VIS unifamiliar','VIS multifamiliar','Proyecto VIP','Vivienda rural VIS','Mejoramiento de vivienda','Vivienda por autoconstrucción','Reubicación por riesgo','Subsidio nacional','Subsidio de caja de compensación','Proyecto de vivienda gratuita','Legalización / titulación de barrio'] },
    { u:'Ocio / Negocio', i:'🍸', t:['Bar','Discoteca / rumba','Restaurante de entretenimiento','Casino / juegos de azar','Billar / salón de juegos','Café-bar / lounge','Licorera / estanco','Taberna / cantina','Sala de eventos / recepciones','Karaoke','Zona de comidas nocturna','Entretenimiento adulto'] },
    { u:'Deportivo', i:'⚽', t:['Cancha sintética','Cancha de tierra / cemento','Cancha múltiple (polideportivo)','Coliseo cubierto','Estadio','Gimnasio / CrossFit','Piscina pública','Pista de patinaje / skatepark','Pista de atletismo','Cancha de tenis / pádel','BMX / ciclomontañismo','Gimnasio al aire libre (biosaludable)'] },
    { u:'Esp. Público', i:'🌳', t:['Parque de barrio','Parque metropolitano','Plaza / plazoleta','Plaza cívica / de banderas','Andén / vía peatonal','Alameda','Bulevar','Zona verde / separador','Mirador','Malecón / ronda recreativa','Juegos infantiles públicos','Plazoleta de comidas'] },
    { u:'Comercial', i:'🏬', t:['Local pequeño (tienda de barrio)','Centro comercial','Supermercado / gran superficie','Plaza de mercado (minorista)','Almacén de cadena','Servicios personales (peluquería, lavandería)','Taller mecánico / lavadero','Ferretería / materiales','Panadería / repostería','Papelería / miscelánea','Droguería / farmacia','Tecnología / celulares','Ropa / calzado','Comercio informal fijo (caseta)'] },
    { u:'Parqueadero / Estacionamiento', i:'🅿️', t:['Parqueadero en lote (cielo abierto)','Parqueadero en edificio','Parqueadero subterráneo','Parqueadero de motos','Cicloparqueadero','Parqueadero de carga','Parqueadero público municipal','Parqueadero privado / concesionado','Zona azul (parqueo regulado en vía)','Patio de inmovilizados (grúas)'] },
    { u:'Turístico / Hotelero', i:'🏨', t:['Hotel','Hostal / alojamiento económico','Motel','Apartahotel','Posada / casa de huéspedes','Camping / glamping','Atractivo turístico','Punto de información turística','Balneario / centro recreativo','Finca de agroturismo','Alojamiento de plataforma (tipo Airbnb)'] },
    { u:'Zona Franca / Comercio Exterior', i:'🛂', t:['Bodega de importación/exportación','Punto de control aduanero','Zona franca industrial','Zona franca comercial','Depósito habilitado de aduana','Terminal de carga fronteriza','Paso fronterizo formal','Trocha / paso informal','Casa de cambio / cambista','Bodega de mercancía en tránsito','Puerto seco'] },
    { u:'Estación de Servicio (Gasolinera)', i:'⛽', t:['Estación de gasolina','Estación con tienda de conveniencia','Estación de gas vehicular (GNV)','Estación de carga (camiones)','Punto de carga eléctrica','Lubricación / lavado','Estación mixta (combustible + servicios)','Planta de abastecimiento de combustible','Expendio informal (pimpineros)','Estación fluvial de combustible'] },
    { u:'Abastecimiento Mayorista (Central de Abastos)', i:'🥬', t:['Central de abastos','Bodega mayorista de alimentos','Plaza mayorista de frutas y verduras','Bodega de granos / abarrotes','Frigorífico / planta de sacrificio','Mercado campesino (acopio)','Bodega de pescado / mariscos','Distribuidora de bebidas','Cava / bodega de flores','Centro de acopio agrícola'] },
    { u:'Institucional', i:'🏛️', t:['Sede institucional pequeña','Sede institucional grande / campus','ONG / fundación','Junta de Acción Comunal (JAC)','Sede sindical / gremial','Cooperativa / asociación','Notaría','Cámara de comercio','Registraduría','Atención de servicios públicos','Curaduría urbana'] },
    { u:'Gubernamental / Administrativo', i:'🏢', t:['Alcaldía / sede principal','Gobernación','Oficina de trámites / CADE','Secretaría (salud, movilidad…)','Sede de entidad descentralizada','Concejo municipal','Personería / Contraloría','Casa de justicia','Comisaría de familia','Inspección de policía','DIAN / entidad tributaria'] },
    { u:'Militar / Policial', i:'🪖', t:['Estación de policía (CAI)','Comando de policía','Base militar / batallón','Cuartel','Control fronterizo militar','Policía de carreteras','Base de fuerza aérea','Estación fluvial / guardacostas','Escuela de formación','Punto de reacción inmediata'] },
    { u:'Seguridad / Judicial', i:'⚖️', t:['Juzgado','Fiscalía','Centro de reclusión / cárcel','Estación penitenciaria (INPEC)','URI (reacción inmediata)','Medicina legal','Casa de justicia','Centro transitorio de menores','Palacio de justicia / tribunal','Centro de conciliación'] },
    { u:'Industrial (Pesada/Ligera)', i:'🏭', t:['Industria ligera (talleres)','Industria pesada (fábricas)','Planta de procesamiento','Industria de alimentos','Industria textil / confección','Industria de la construcción','Industria química','Metalmecánica','Maquila','Parque industrial','Industria artesanal / famiempresa'] },
    { u:'Logístico / Almacenamiento', i:'📦', t:['Bodega de almacenamiento','Centro de distribución','Patio de contenedores','Bodega de frío (cadena de frío)','Cross-docking / plataforma logística','Depósito de materiales de construcción','Almacén de repuestos','Silo / almacenamiento de granos','Bodega de mensajería / paquetería','Depósito de combustible / gas'] },
    { u:'Extractivo (Minería/Canteras)', i:'⛏️', t:['Cantera de material de construcción','Mina activa','Zona de extracción inactiva','Extracción de arena / gravilla (río)','Explotación de carbón','Ladrillera / chircal','Restauración post-minera','Título minero','Extracción ilegal','Planta de trituración'] },
    { u:'Logística de carga (patios y talleres)', i:'🚛', t:['Patio de camiones','Taller de vehículos pesados','Báscula / pesaje','Estación de transferencia de carga','Zona de cargue y descargue','Depósito de maquinaria','Terminal de contenedores','Parqueadero de tractomulas','Bodega de tránsito aduanero','Centro de reparto de última milla'] },
    { u:'Salud (Clínicas/Hospitales)', i:'🚑', t:['Puesto de salud','Centro de salud / CAP','Clínica','Hospital','Consultorio independiente','Farmacia / droguería','Centro de rehabilitación','Laboratorio clínico','Imágenes diagnósticas','Banco de sangre','Centro de salud mental','Sede de IPS / EPS','Puesto de vacunación'] },
    { u:'Emergencias (Bomberos/Rescate)', i:'🚒', t:['Estación de bomberos','Base de defensa civil','Cruz Roja / rescate','Base de ambulancias','Central de emergencias (123)','Punto de encuentro / evacuación','Refugio ante desastres','Base de rescate acuático','Helipuerto de emergencia','Bodega de ayuda humanitaria'] },
    { u:'Cuidado Animal (Veterinaria)', i:'🐾', t:['Clínica veterinaria','Refugio de animales','Centro de adopción','Centro de zoonosis / control','Pet shop / tienda de mascotas','Guardería canina','Peluquería canina','Coso municipal','Centro de bienestar animal (público)','Veterinaria móvil'] },
    { u:'Hogar de Cuidado', i:'🏡', t:['Hogar geriátrico / adulto mayor','Hogar de bienestar infantil (ICBF)','Albergue / refugio para migrantes','Hogar de paso (habitante de calle)','Casa hogar / orfanato','Rehabilitación (adicciones)','Atención a discapacidad','Refugio para víctimas de violencia','Comedor comunitario','Guardería / sala cuna'] },
    { u:'Cultural / Patrimonio', i:'🏛️', t:['Museo','Teatro','Biblioteca','Monumento / sitio histórico','Centro cultural / casa de la cultura','Galería de arte','Archivo histórico','Iglesia patrimonial','Edificio patrimonial (BIC)','Sala de cine / cineteca','Escuela de artes / conservatorio','Sitio arqueológico'] },
    { u:'Educativo (Básico/Superior)', i:'📚', t:['Jardín infantil / preescolar','Colegio (básica/media)','Universidad','Instituto técnico / tecnológico','Centro de capacitación (SENA)','Escuela rural','Educación para adultos','Biblioteca escolar','Internado','Escuela de idiomas','Academia (música, danza…)','Centro de investigación'] },
    { u:'Religioso / Culto', i:'⛪', t:['Iglesia católica','Templo cristiano no católico','Culto de otra religión','Capilla','Catedral / basílica','Salón del reino','Mezquita','Sinagoga','Convento / monasterio','Seminario','Cementerio parroquial','Casa de retiro espiritual'] },
    { u:'Espacio Ferial / Eventos Masivos', i:'🎪', t:['Centro de convenciones','Recinto ferial','Coliseo de exposiciones','Plaza de toros / coso','Concha acústica','Parque de eventos / conciertos','Lote de circo','Parque de diversiones itinerante','Sala de banquetes','Autódromo / kartódromo'] },
    { u:'Mobiliario Urbano', i:'🪑', t:['Banca','Luminaria pública','Señalización vial','Parada de bus / paradero','Caneca / punto ecológico','Bolardo / protección peatonal','Kiosco / caseta','Baño público','Bebedero / fuente','Punto digital / WiFi','Reductor de velocidad','Semáforo peatonal','Tótem informativo'] },
    { u:'Gestión de Residuos / Reciclaje', i:'♻️', t:['Punto de acopio de reciclaje','Planta de tratamiento de residuos','Relleno sanitario','Estación de transferencia','Escombrera','Punto limpio','Bodega de reciclador','Planta de compostaje','Incinerador (peligrosos/hospitalarios)','Botadero a cielo abierto (ilegal)'] },
    { u:'Transporte (Terminales/Estaciones)', i:'🚏', t:['Terminal intermunicipal','Terminal satélite','Estación de bus / metro','Parada techada','Estación de transporte masivo (BRT)','Patio-taller de buses','Terminal de carga','Aeropuerto','Aeródromo / pista','Puerto fluvial','Estación de taxis / piquete','Ciclo-estación (bicis públicas)'] },
    { u:'Infra. Servicios (Plantas)', i:'🔌', t:['Planta de agua potable (PTAP)','Planta de aguas residuales (PTAR)','Subestación eléctrica','Planta de gas','Tanque de almacenamiento de agua','Bocatoma / captación','Estación de bombeo','Central telefónica / nodo','Central de generación (energía)','Reservorio de servicio','Estación reguladora de gas'] },
    { u:'Comunicaciones / Antenas', i:'📡', t:['Antena de telefonía celular','Torre de comunicaciones','Repetidora','Antena de radio / TV','Estación satelital','Nodo de fibra óptica','Data center','Antena de radioaficionados','Torre de vigilancia / cámaras','Punto WiFi público'] },
    { u:'Servicios Funerarios', i:'⚰️', t:['Funeraria','Sala de velación','Cementerio','Parque cementerio / jardín','Osario / columbario','Crematorio','Morgue / anfiteatro','Cementerio patrimonial','Lapidaria / bodega de ataúdes','Cementerio de mascotas'] },
    { u:'Vías e Infraestructura Vial', i:'🛣️', t:['Vía principal / arteria','Vía secundaria / local','Vía peatonal','Ciclorruta','Puente vehicular','Puente peatonal','Intercambiador (glorieta, deprimido)','Túnel','Vía sin pavimentar','Trocha / camino rural','Malla vial en construcción','Peaje'] },
    { u:'Protección Ambiental', i:'🌿', t:['Reserva natural','Zona de conservación','Humedal protegido','Parque natural (regional/nacional)','Recarga de acuíferos','Corredor ecológico','Área de compensación ambiental','Vivero municipal','Jardín botánico','Zona de amortiguación'] },
    { u:'Forestal', i:'🌲', t:['Bosque nativo','Zona de reforestación','Plantación forestal (comercial)','Bosque protector','Área quemada / en recuperación','Vivero forestal','Cerca viva / arborización urbana','Bosque de galería (ronda de río)','Zona de tala controlada','Reserva forestal'] },
    { u:'Agropecuario / Rural', i:'🌾', t:['Cultivo transitorio','Cultivo permanente (frutales, café)','Zona ganadera / potrero','Finca / predio rural','Invernadero / cultivo bajo cubierta','Galpón avícola / porcícola','Establo / lechería','Parcela de pancoger','Distrito de riego','Centro de acopio rural','Agroindustria (trapiche, beneficiadero)'] },
    { u:'Ronda Hídrica / Protección de Cuerpos de Agua', i:'🌊', t:['Ronda de río','Ronda de quebrada','Nacimiento / manantial','Laguna / lago','Humedal','Canal / caño','Jarillón / dique','Zona de inundación periódica','Reservorio / jagüey','Playa / ribera'] },
    { u:'Zona Baldía', i:'🟫', t:['Lote urbano sin construir','Lote encerrado / cercado','Manzana sin desarrollar','Potrero urbano','Lote con escombros','Lote invadido por vegetación','Predio en litigio','Reserva de lote (proyecto futuro)','Lote de relleno','Franja sobrante sin uso'] },
    { u:'Zona de Riesgo', i:'⚠️', t:['Deslizamiento / remoción en masa','Inundación','Sísmico / falla geológica','Avenida torrencial','Incendio forestal','Tecnológico (industria peligrosa)','Estructural (edificación insegura)','Líneas de alta tensión','Ductos (gas / combustible)','Zona de mitigación'] },
    { u:'En Obra / Construcción', i:'🏗️', t:['Obra residencial','Obra comercial/institucional','Obra de infraestructura vial','Excavación / movimiento de tierra','Cimentación / estructura','Obra paralizada','Demolición','Remodelación / adecuación','Obra sin licencia (informal)','Urbanización en desarrollo'] },
    { u:'Abandono / Ruina', i:'🏚️', t:['Vivienda abandonada','Edificio comercial/industrial abandonado','Predio en ruina total','Construcción inconclusa (obra muerta)','Casa tapiada','Bodega deshabitada','Edificio en riesgo de colapso','Ocupado por habitantes de calle','Estructura quemada','Fábrica cerrada / en desuso'] },
    { u:'Espacio Residual', i:'📐', t:['Medianera / retazo entre construcciones','Franja bajo puente','Bajo línea de alta tensión','Recodo vial','Oreja de intercambiador','Talud / ladera sin uso','Zona bajo escalera / rampa','Cuña entre lotes','Aislamiento obligatorio','Antejardín residual'] },
    { u:'Asentamiento Informal', i:'🏕️', t:['Asentamiento consolidado','Asentamiento emergente / reciente','Invasión en zona de riesgo','Invasión en ronda hídrica','Cambuche / vivienda precaria','Asentamiento de migrantes','Loteo pirata','Invasión en zona de protección','Barrio en legalización','Ocupación de predio público'] },
    { u:'Zona de Expansión Urbana', i:'🧭', t:['Expansión residencial planificada','Expansión industrial/comercial planificada','Suelo de expansión sin desarrollar','Plan parcial en trámite','Plan parcial adoptado','Suelo suburbano','Borde urbano-rural','Reserva vial de expansión','Equipamientos futuros','Cesión urbanística futura'] },
    { u:'Mixto (Residencial-Comercial)', i:'🧩', t:['Local abajo + vivienda arriba','Vivienda con taller','Vivienda con tienda de barrio','Vivienda con oficina','Edificio de uso mixto','Vivienda con consultorio','Vivienda con restaurante','Vivienda con bodega pequeña','Vivienda con hospedaje','Vivienda con parqueadero comercial'] },
    { u:'Mixto (Residencial-Industrial)', i:'🧩', t:['Vivienda con confección','Vivienda con carpintería','Vivienda con ornamentación / metalmecánica','Vivienda con panadería industrial','Vivienda con famiempresa de alimentos','Vivienda con reciclaje / bodega','Vivienda con litografía / imprenta','Vivienda con marroquinería / calzado','Vivienda con taller mecánico','Vivienda con procesamiento artesanal'] },
    { u:'Uso Múltiple / Mixto General', i:'🧩', t:['Comercial + institucional','Comercial + educativo','Comercial + salud','Residencial + comercial + oficinas','Torre de usos combinados','Centro empresarial (oficinas + comercio)','Complejo dotacional (varios equipamientos)','Comercial + hotelero','Institucional + cultural','Educativo + deportivo'] }
  ];
  const MATRIZ_USOS_KEY = '🗺️ Matriz de Usos';
  // Agrupación temática de los 48 usos en 10 categorías, para no mostrar los
  // 48 de una sola vez (queda como Grupo → Uso → Tipo exacto). Los nombres de
  // "usos" deben calzar EXACTO con el campo `u` de PROCITY_MATRIZ_USOS.
  const MATRIZ_GRUPOS = [
    { id:'vivienda', i:'🏠', t:'Vivienda y ocio', usos:['Residencial','Vivienda de Interés Social (VIS/VIP)','Ocio / Negocio','Deportivo','Esp. Público'] },
    { id:'comercio', i:'🏬', t:'Comercio y economía', usos:['Comercial','Parqueadero / Estacionamiento','Turístico / Hotelero','Zona Franca / Comercio Exterior','Estación de Servicio (Gasolinera)','Abastecimiento Mayorista (Central de Abastos)'] },
    { id:'institucional', i:'🏛️', t:'Institucional y gobierno', usos:['Institucional','Gubernamental / Administrativo','Militar / Policial','Seguridad / Judicial'] },
    { id:'industria', i:'🏭', t:'Industria y logística', usos:['Industrial (Pesada/Ligera)','Logístico / Almacenamiento','Extractivo (Minería/Canteras)','Logística de carga (patios y talleres)'] },
    { id:'salud', i:'🚑', t:'Salud y emergencias', usos:['Salud (Clínicas/Hospitales)','Emergencias (Bomberos/Rescate)','Cuidado Animal (Veterinaria)','Hogar de Cuidado'] },
    { id:'cultura', i:'🎭', t:'Cultura, educación y culto', usos:['Cultural / Patrimonio','Educativo (Básico/Superior)','Religioso / Culto','Espacio Ferial / Eventos Masivos'] },
    { id:'servicios', i:'🚛', t:'Servicios e infraestructura', usos:['Mobiliario Urbano','Gestión de Residuos / Reciclaje','Transporte (Terminales/Estaciones)','Infra. Servicios (Plantas)','Comunicaciones / Antenas','Servicios Funerarios','Vías e Infraestructura Vial'] },
    { id:'ambiente', i:'🌳', t:'Ambiente y zona rural', usos:['Protección Ambiental','Forestal','Agropecuario / Rural','Ronda Hídrica / Protección de Cuerpos de Agua'] },
    { id:'riesgo', i:'⚠️', t:'Riesgo, deterioro y suelo sin definir', usos:['Zona Baldía','Zona de Riesgo','En Obra / Construcción','Abandono / Ruina','Espacio Residual','Asentamiento Informal','Zona de Expansión Urbana'] },
    { id:'mixtos', i:'🧩', t:'Usos combinados', usos:['Mixto (Residencial-Comercial)','Mixto (Residencial-Industrial)','Uso Múltiple / Mixto General'] },
  ];

  function renderProCityItems(){
    const panel = ensureQuickReportPanel();
    const point = proCity.selected;
    const d = typeof dimensiones !== 'undefined' ? dimensiones[proCity.dim] : null;
    if(!panel || !point || !d) return;

    // La Matriz de Usos se abre en DOS niveles (uso → tipo exacto). El resto
    // de dimensiones de Pro City siguen mostrando su lista plana de siempre.
    if(proCity.dim === MATRIZ_USOS_KEY){
      // Si el usuario ya eligió el tipo exacto desde el buscador (antes de
      // ubicar el punto), nos saltamos los dos niveles y vamos directo a la
      // ficha del ítem.
      if(proCity.matrizPendingItem){
        const pending = proCity.matrizPendingItem;
        proCity.matrizPendingItem = '';
        openProCityItemDetails(pending);
        return;
      }
      renderProCityMatriz(panel, d);
      return;
    }

    const items = (d.items || []).map(label=>{
      const icono = (typeof obtenerIconoItem === 'function') ? obtenerIconoItem(proCity.dim, label) : d.icon;
      return `<button type="button" class="u52-alert-card" data-u52-procity-item="${esc(label)}"><span>${icono}</span><b>${esc(label)}</b></button>`;
    }).join('');
    panel.innerHTML = `
      <div class="u52-quick-report-head u52-procity-panel-head">
        <button type="button" data-u52-call="procity-close" aria-label="Cerrar">×</button>
        <div><b>${d.icon} ${esc(proCity.dim)}</b><small>Elige qué hay en este punto</small></div>
      </div>
      <div class="u52-quick-report-grid">${items}</div>`;
    panel.classList.add('u52-procity-mode');
    panel.hidden = false;
  }

  // Recientes de la Matriz de Usos — guardados en localStorage (máx. 8, el
  // más reciente primero). Acceso directo para volver a colocar el mismo
  // tipo en otro punto sin recorrer los dos niveles otra vez.
  const MATRIZ_RECIENTES_KEY = 'urbis_procity_matriz_recientes_v1';
  function getMatrizRecents(){
    try{ const a = JSON.parse(localStorage.getItem(MATRIZ_RECIENTES_KEY) || '[]'); return Array.isArray(a) ? a : []; }catch(e){ return []; }
  }
  function addMatrizRecent(label){
    try{
      let a = getMatrizRecents().filter(x => x !== label);
      a.unshift(label); a = a.slice(0, 8);
      localStorage.setItem(MATRIZ_RECIENTES_KEY, JSON.stringify(a));
    }catch(e){}
  }
  // Índice plano de todos los tipos para el buscador (uso · tipo → ícono).
  let _matrizFlatIndex = null;
  function matrizFlatIndex(){
    if(_matrizFlatIndex) return _matrizFlatIndex;
    const flat = [];
    PROCITY_MATRIZ_USOS.forEach(g => g.t.forEach(t => flat.push({ label: g.u + ' · ' + t, tipo:t, uso:g.u, i:g.i })));
    _matrizFlatIndex = flat;
    return flat;
  }
  function _norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

  function renderProCityMatriz(panel, d){
    proCity.matrizSearch = proCity.matrizSearch || '';
    proCity.matrizGroup = proCity.matrizGroup || '';
    if(!proCity.matrizGroup && !proCity.matrizUse){
      // Nivel 1: buscador + recientes + los 10 grupos temáticos (o resultados de búsqueda).
      const recientes = getMatrizRecents();
      const recientesHtml = recientes.length ? `
        <div class="u52-matriz-recientes">
          <small>🕘 Recientes</small>
          <div class="u52-matriz-recientes-row">
            ${recientes.map(label=>{
              const tipo = label.split(' · ').slice(1).join(' · ') || label;
              const grupo = PROCITY_MATRIZ_USOS.find(g => label.startsWith(g.u + ' · '));
              return `<button type="button" class="u52-matriz-reciente" data-u52-procity-item="${esc(label)}"><span>${grupo ? grupo.i : '🗺️'}</span>${esc(tipo)}</button>`;
            }).join('')}
          </div>
        </div>` : '';
      panel.innerHTML = `
        <div class="u52-quick-report-head u52-procity-panel-head">
          <button type="button" data-u52-call="procity-close" aria-label="Cerrar">×</button>
          <div><b>${d.icon} Matriz de Usos</b><small>Elige la categoría</small></div>
        </div>
        <input type="text" class="u52-matriz-search" id="u52-matriz-search" placeholder="🔎 Buscar uso o tipo (ej. hospital, cancha…)" value="${esc(proCity.matrizSearch)}" oninput="window.urbisProCityMatrizSearch(this.value)" autocomplete="off">
        ${recientesHtml}
        <div class="u52-quick-report-grid" id="u52-matriz-results"></div>`;
      fillMatrizResults();
    } else if(proCity.matrizGroup && !proCity.matrizUse){
      // Nivel 2: los usos dentro del grupo elegido.
      const grupo = MATRIZ_GRUPOS.find(g=>g.id === proCity.matrizGroup);
      const usos = grupo ? grupo.usos : [];
      const cards = usos.map(u=>{
        const g = PROCITY_MATRIZ_USOS.find(x=>x.u === u);
        if(!g) return '';
        return `<button type="button" class="u52-alert-card" data-u52-procity-use="${esc(u)}"><span>${g.i}</span><b>${esc(u)}</b><small>${g.t.length} tipos</small></button>`;
      }).join('');
      panel.innerHTML = `
        <div class="u52-quick-report-head u52-procity-panel-head">
          <button type="button" data-u52-call="procity-matriz-back" aria-label="Volver a categorías">‹</button>
          <div><b>${grupo ? grupo.i : '🗺️'} ${esc(grupo ? grupo.t : '')}</b><small>Elige el uso del suelo</small></div>
          <button type="button" data-u52-call="procity-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-quick-report-grid">${cards}</div>`;
    } else {
      // Nivel 3: los tipos exactos del uso elegido. Se guarda "Uso · Tipo".
      const grupo = PROCITY_MATRIZ_USOS.find(g=>g.u === proCity.matrizUse);
      const tipos = grupo ? grupo.t : [];
      const cards = tipos.map(t=>
        `<button type="button" class="u52-alert-card" data-u52-procity-item="${esc(proCity.matrizUse + ' · ' + t)}"><span>${grupo.i}</span><b>${esc(t)}</b></button>`
      ).join('');
      panel.innerHTML = `
        <div class="u52-quick-report-head u52-procity-panel-head">
          <button type="button" data-u52-call="procity-matriz-back" aria-label="Volver a usos">‹</button>
          <div><b>${grupo ? grupo.i : '🗺️'} ${esc(proCity.matrizUse)}</b><small>Elige el tipo exacto</small></div>
          <button type="button" data-u52-call="procity-close" aria-label="Cerrar">×</button>
        </div>
        <div class="u52-quick-report-grid">${cards}</div>`;
    }
    panel.classList.add('u52-procity-mode');
    panel.hidden = false;
  }
  // Rellena SOLO la grilla de resultados (no todo el panel) para que el input
  // de búsqueda no pierda el foco entre teclas.
  function fillMatrizResults(){
    const cont = document.getElementById('u52-matriz-results');
    if(!cont) return;
    const q = _norm(proCity.matrizSearch);
    if(!q){
      // Sin búsqueda: los 10 grupos temáticos (nivel 1).
      cont.innerHTML = MATRIZ_GRUPOS.map(g=>{
        const total = g.usos.reduce((n,u)=>{ const x = PROCITY_MATRIZ_USOS.find(p=>p.u===u); return n + (x ? x.t.length : 0); }, 0);
        return `<button type="button" class="u52-alert-card" data-u52-procity-group="${esc(g.id)}"><span>${g.i}</span><b>${esc(g.t)}</b><small>${g.usos.length} usos · ${total} tipos</small></button>`;
      }).join('');
      return;
    }
    // Con búsqueda: tipos de TODOS los usos que coincidan (acceso directo, sin pasar por grupos).
    const hits = matrizFlatIndex().filter(x => _norm(x.tipo).includes(q) || _norm(x.uso).includes(q)).slice(0, 60);
    cont.innerHTML = hits.length
      ? hits.map(x=>`<button type="button" class="u52-alert-card" data-u52-procity-item="${esc(x.label)}"><span>${x.i}</span><b>${esc(x.tipo)}</b></button>`).join('')
      : `<div class="u52-matriz-empty">Sin resultados para “${esc(proCity.matrizSearch)}”.</div>`;
  }
  window.urbisProCityMatrizSearch = function(val){ proCity.matrizSearch = val; fillMatrizResults(); };
  function pickProCityMatrizGroup(id){
    proCity.matrizGroup = id;
    renderProCityItems();
  }
  function pickProCityMatrizUse(use){
    proCity.matrizUse = use;
    renderProCityItems();
  }
  function backProCityMatrizUses(){
    if(proCity.matrizUse){ proCity.matrizUse = ''; }
    else { proCity.matrizGroup = ''; proCity.matrizSearch = ''; }
    renderProCityItems();
  }

  function openProCityItemDetails(label){
    const point = proCity.selected;
    const d = typeof dimensiones !== 'undefined' ? dimensiones[proCity.dim] : null;
    const panel = ensureQuickReportPanel();
    if(!point || !d || !panel) return;
    // BUG real (mismo patrón de "todos con el mismo ícono" de otras
    // pantallas): obtenerIconoItem busca el label DENTRO de dimensiones[dim]
    // .items, pero para la Matriz de Usos el label es "Uso · Tipo" y esa
    // lista no existe ahí — siempre caía al ícono genérico 🗺️ de la
    // dimensión. Al editar, se usa el ícono real del USO (ej. 🏠).
    const usoParaIcono = (proCity.dim === MATRIZ_USOS_KEY) ? label.split(' · ')[0] : '';
    const usoInfoIcono = usoParaIcono ? PROCITY_MATRIZ_USOS.find(x=>x.u === usoParaIcono) : null;
    const icono = usoInfoIcono ? usoInfoIcono.i : ((typeof obtenerIconoItem === 'function') ? obtenerIconoItem(proCity.dim, label) : d.icon);
    const _sess = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null;
    const creadorNom = (_sess && _sess.usuario) || window.userUsernameGlobal || ((_sess && _sess.correo) ? String(_sess.correo).split('@')[0] : '') || 'Ciudadano';
    const rolStr     = (_sess && _sess.rol) || window.userRole || 'citizen';
    const correoReq  = (_sess && _sess.correo) || window.userEmailGlobal || 'No registrado';
    const cedulaReq  = (_sess && (_sess.cedula_numero || _sess.cedula)) || window.userCedulaGlobal || 'No registrado';
    const barrioReq  = (_sess && _sess.barrio) || window.userBarrioGlobal || 'Mapeo Pro City';
    // Modo edición: cambiar el uso/matriz de un punto ya georeferenciado. Se
    // actualiza la MISMA fila (por lat) en vez de crear otra — una escritura.
    const editando = !!proCity.editLat;
    let dirPrefill = '';
    let notaPrefill = '';
    if(editando){
      const dp = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData.find(x => String(x.lat) === String(proCity.editLat)) : null;
      if(dp){
        const dpCampos = String(dp.descripcion || '').split(' | ');
        const nomOrig = dpCampos[1] || '';
        dirPrefill = nomOrig.split(' — ')[0] || '';
        notaPrefill = dpCampos[2] || '';
      }
    }
    window.__urbisCurrentFormContext = {
      cat: proCity.dim,
      lat: editando ? String(proCity.editLat) : String(point.lat),
      lng: String(point.lng),
      isEdit: editando,
      estadoVal: (rolStr === 'admin' || rolStr === 'gov') ? 'Aprobado' : 'Pendiente',
      creadorNom, creadorRolStr: rolStr, likesActuales:0,
      correoReq, cedulaReq, barrioReq,
      quickReport:true, quickIcon:icono, quickLabel:label, photoRequired:false
    };
    // Pedido explícito: el título debe ser lo más específico (el TIPO
    // exacto, ej. "Casa de un piso"), no el uso — el uso (ej. "Residencial")
    // es subtítulo, misma jerarquía que ya se aplicó en el panel del mapa.
    // Además, tocar esta tarjeta lleva directo al selector de grupo/uso/tipo
    // (sin tener que buscar el botón "‹").
    const partesLabelSel = label.split(' · ');
    const tipoParteSel = partesLabelSel.length > 1 ? partesLabelSel.slice(1).join(' · ') : '';
    const usoParteSel = partesLabelSel[0] || '';
    const tituloSel = tipoParteSel || usoParteSel || label;
    const subSel = tipoParteSel ? usoParteSel : proCity.dim;
    panel.innerHTML = `
      <div class="u52-quick-report-head u52-procity-panel-head">
        <button type="button" data-u52-call="procity-back" aria-label="Volver">‹</button>
        <div><b>${editando ? 'Editar mapeo' : 'Nuevo elemento urbano'}</b><small>Toca la tarjeta de abajo para cambiar la categoría/uso</small></div>
        <button type="button" data-u52-call="procity-close" aria-label="Cerrar">×</button>
      </div>
      <div class="u52-quick-report-selected u52-procity-selected u52-procity-selected-tap" data-u52-call="procity-change-category" role="button" tabindex="0">
        <span>${icono}</span>
        <div><b>${esc(tituloSel)}</b><small>${esc(subSel)}</small></div>
        <span class="u52-procity-selected-chevron">✏️</span>
      </div>
      <div class="u52-quick-report-form">
        <select id="sel-item" hidden><option value="${esc(label)}" selected>${esc(label)}</option></select>
        <input id="sel-nombre" type="hidden" value="${esc(label)}">
        <select id="sel-estado" hidden><option value="Bueno" selected>Bueno</option></select>
        <select id="sel-mat" hidden><option value="N/A" selected>N/A</option></select>
        <input id="ins-foto" type="hidden" value="">
        <input id="ins-direccion" type="text" maxlength="120" placeholder="Dirección o punto de referencia *" autocomplete="street-address" value="${esc(dirPrefill)}">
        <textarea id="ins-nota" maxlength="180" placeholder="Descripción técnica opcional">${esc(notaPrefill)}</textarea>
        <label class="u52-quick-photo"><span class="u52-photo-label-text">📷 Foto de referencia (opcional)</span><input type="file" id="ins-foto-file" accept="image/*" capture="environment"></label>
        <button type="button" class="u52-quick-publish u52-procity-publish" data-u52-call="procity-publish">${editando ? 'Actualizar en Pro City' : 'Guardar en Pro City'}</button>
      </div>`;
    panel.classList.add('u52-procity-mode');
    panel.hidden = false;
  }

  function ensureCommunityChooser(){
    if(communityComposer.overlay) return communityComposer.overlay;
    const mapScreen = app.querySelector('[data-u52-screen="map"]');
    if(!mapScreen) return null;
    const overlay = document.createElement('div');
    overlay.id = 'u52-community-choice';
    overlay.className = 'u52-community-choice';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="u52-community-choice-card" aria-live="polite">
        <div class="u52-community-choice-title">¿Qué quieres crear aquí?</div>
        <div class="u52-community-choice-actions" role="group" aria-label="Elegir tipo de creación">
          <button type="button" data-u52-call="choice-report"><span class="report">📝</span><b>Reporte</b></button>
          <button type="button" data-u52-call="choice-event"><span class="event">📅</span><b>Evento</b></button>
        </div>
      </div>`;
    mapScreen.appendChild(overlay);
    communityComposer.overlay = overlay;
    communityComposer.bubble = overlay.querySelector('.u52-community-choice-card');
    communityComposer.title = overlay.querySelector('.u52-community-choice-title');
    return overlay;
  }

  function ensureCommunityMapPicker(){
    if(communityComposer.mapReady || !window.map) return;
    communityComposer.mapReady = true;
    ensureCommunityChooser();
    map.on('click', function(ev){
      if(!ev || !ev.latlng) return;
      // Dibujar el área de análisis (js/24) manda sobre cualquier otro modo:
      // si no se atajara aquí, cada toque para marcar un vértice abriría
      // además el formulario de mapeo.
      if(window.URBIS_PC_ANALISIS && window.URBIS_PC_ANALISIS.estaDibujando()){
        window.URBIS_PC_ANALISIS.agregarPunto(ev.latlng.lat, ev.latlng.lng);
        return;
      }
      if(proCity.pickMode === 'manual'){ pickProCityPoint(ev.latlng.lat, ev.latlng.lng); return; }
      if(communityComposer.pickMode !== 'manual') return;
      pickCommunityPoint(ev.latlng.lat, ev.latlng.lng, 'manual');
    });
    map.on('move zoom resize', function(){
      if(communityComposer.overlay && !communityComposer.overlay.hidden && communityComposer.selected){
        positionCommunityChooser(communityComposer.selected.lat, communityComposer.selected.lng);
      }
    });
  }

  function hideCommunityChooser(clearSelection=false){
    if(communityComposer.overlay) communityComposer.overlay.hidden = true;
    if(clearSelection) communityComposer.selected = null;
  }

  function renderCommunityPickMarker(lat, lng){
    try{
      if(!window.map || !window.L) return;
      if(typeof tempMarker !== 'undefined' && tempMarker){ map.removeLayer(tempMarker); tempMarker = null; }
      tempMarker = L.marker([lat, lng], {
        zIndexOffset: 2600,
        icon: L.divIcon({
          className: 'u52-community-pick-pin-wrap',
          html: '<div class="u52-community-pick-pin"><span class="u52-community-pick-core"></span></div>',
          iconSize: [58,58],
          iconAnchor: [29,29]
        })
      }).addTo(map);
    }catch(e){}
  }

  function positionCommunityChooser(lat, lng){
    const overlay = ensureCommunityChooser();
    if(!overlay || !window.map || !map.getContainer) return;
    try{
      const point = map.latLngToContainerPoint([lat, lng]);
      const mapRect = map.getContainer().getBoundingClientRect();
      const appRect = app.getBoundingClientRect();
      const bubbleW = 286;
      const minX = (bubbleW / 2) + 12;
      const maxX = appRect.width - minX;
      const x = Math.max(minX, Math.min(maxX, (mapRect.left - appRect.left) + point.x));
      const y = Math.max(126, (mapRect.top - appRect.top) + point.y);
      overlay.style.left = x + 'px';
      overlay.style.top = y + 'px';
    }catch(e){}
  }

  function pickCommunityPoint(lat, lng, source='manual'){
    communityComposer.pickMode = '';
    communityComposer.selected = { lat:Number(lat), lng:Number(lng), source };
    try{ window.urbisDisableReportMapClick = true; }catch(e){}
    setMapReportStatus('');
    try{
      if(window.map){
        const zoom = Math.max((map.getZoom ? map.getZoom() : 16), 16);
        map.setView([lat, lng], zoom, { animate:true });
      }
    }catch(e){}
    renderCommunityPickMarker(lat, lng);
    const overlay = ensureCommunityChooser();
    if(overlay){
      overlay.hidden = false;
      positionCommunityChooser(lat, lng);
    }
  }

  function beginCommunityMapSelection(){
    exitProCityModeIfActive();
    resetMapForCommunityReport();
    show('map');
    ensureCommunityMapPicker();
    hideCommunityChooser(false);
    communityComposer.pickMode = 'manual';
    communityComposer.selected = null;
    try{ window.urbisDisableReportMapClick = true; }catch(e){}
    setMapReportStatus('Toca un punto en el mapa.');
    try{ if(window.map && map.getContainer) map.getContainer().classList.add('u52-community-report-ready'); }catch(e){}
  }

  function openCommunityReportAt(lat, lng){
    hideCommunityChooser(false);
    resetMapForCommunityReport();
    setMapReportStatus('');
    try{
      if(window.map && window.L){
        map.setView([lat, lng], Math.max(map.getZoom ? map.getZoom() : 17, 17), {animate:true});
        setTimeout(()=>{
          try{ map.fire('click', { latlng: L.latLng(lat, lng), originalEvent: null }); }catch(e){}
        }, 180);
      }
    }catch(e){ console.warn('URBIS report GPS failed', e); }
  }

  function openCommunityEventAt(lat, lng){
    hideCommunityChooser(false);
    resetMapForCommunityReport();
    setMapReportStatus('');
    show('map');
    try{
      if(typeof activarModoUbicacionEvento === 'function') activarModoUbicacionEvento();
      if(window.map && window.L){
        map.setView([lat, lng], Math.max(map.getZoom ? map.getZoom() : 17, 17), {animate:true});
        setTimeout(()=>{
          try{ map.fire('click', { latlng: L.latLng(lat, lng), originalEvent: null }); }catch(e){}
        }, 200);
      }
    }catch(e){ console.warn('URBIS event point failed', e); }
  }

  function confirmCommunityChoice(kind){
    const point = communityComposer.selected;
    if(!point) return;
    if(kind === 'report') showQuickReportCategories();
    if(kind === 'event') showQuickEventCategories();
  }

  function renderBasemapPicker(){
    const grid = app.querySelector('#u52-basemap-grid');
    if(!grid) return;
    if(!(window.URBIS_BASEMAPS && typeof window.URBIS_BASEMAPS.list === 'function')){
      grid.innerHTML = '<div class="u52-basemap-empty">Los tipos de mapa se cargarán al abrir el mapa.</div>';
      return;
    }
    const mapas = window.URBIS_BASEMAPS.list();
    grid.innerHTML = mapas.map(m=>`
      <button type="button" class="u52-basemap-card${m.active?' active':''}" data-u52-basemap="${m.key}">
        <span class="u52-basemap-card-icon">${m.icon}</span>
        <b>${esc(m.nombre)}</b>
        <span class="u52-basemap-card-badge">${esc(m.badge)}</span>
      </button>`).join('');
  }

  function selectBasemap(key){
    if(window.URBIS_BASEMAPS && typeof window.cambiarMapaBase === 'function' && window.URBIS_BASEMAPS.has(key)){
      window.cambiarMapaBase(key, { silent:true });
    }
    renderBasemapPicker();
  }

  function setMapReportStatus(html){
    const el = app.querySelector('#u52-map-report-status');
    if(el) el.innerHTML = html;
  }

  function resetMapForCommunityReport(){
    communityComposer.pickMode = '';
    try{ window.urbisMobilityDestinationOnly = false; }catch(e){}
    try{ window.urbisDisableReportMapClick = false; }catch(e){}
    try{ window.__urbisSuppressNormalMapClickUntil = 0; }catch(e){}
  }

  function openManualCommunityReport(){
    ensureMobileGps(false);
    beginCommunityMapSelection();
  }

  function openGpsCommunityReport(){
    exitProCityModeIfActive();
    resetMapForCommunityReport();
    show('map');
    ensureCommunityMapPicker();
    hideCommunityChooser(false);
    setMapReportStatus('Buscando GPS...');
    if(mobileGps.last){
      pickCommunityPoint(Number(mobileGps.last.lat), Number(mobileGps.last.lng), 'gps');
      return;
    }
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        onMobileGpsPoint(pos);
        pickCommunityPoint(pos.coords.latitude, pos.coords.longitude, 'gps');
      },()=>{
        setMapReportStatus('Sin GPS. Usa En mapa.');
      },{enableHighAccuracy:true,maximumAge:1000,timeout:12000});
    }else{
      setMapReportStatus('Sin permiso GPS. Usa En mapa.');
    }
  }

  function openCommunityEventMode(){
    show('events');
  }

  async function nativeCall(name){
    try{
      if(name==='hero-msg-prev') { heroMsgStep(-1); return; }
      if(name==='hero-msg-next') { heroMsgStep(1); return; }
      if(name==='timeline-refresh') { try{ if(typeof window.urbisCargarPuntos==='function') window.urbisCargarPuntos(); if(typeof window.urbisRenderMisReportes==='function') window.urbisRenderMisReportes(); }catch(e){} return; }
      if(name==='miseventos-refresh') { try{ if(typeof window.urbisCargarPuntos==='function') window.urbisCargarPuntos(); if(typeof window.urbisRenderMisEventos==='function') window.urbisRenderMisEventos(); }catch(e){} return; }
      if(name==='eventos-refresh') { try{ if(typeof window.urbisCargarPuntos==='function') window.urbisCargarPuntos(); if(typeof window.urbisRenderEventosMovil==='function') window.urbisRenderEventosMovil(); }catch(e){} return; }
      // Reportar SIN interrumpir la actividad: el rastreo (watch + cronómetro)
      // sigue vivo; el chip "volver a tu actividad" (show()) trae de regreso.
      if(name==='rush-report-live') { openGpsCommunityReport(); return; }
      if(name==='rush-publicar') { publicarRushSocial(); return; }
      if(name==='rushsocial-refresh') { try{ if(typeof window.urbisCargarPuntos==='function') window.urbisCargarPuntos(); setTimeout(()=>{ try{ window.urbisRenderRushSocial(); }catch(e){} }, 1200); }catch(e){} return; }
      if(name==='games-refresh') { try{ if(typeof window.urbisCargarPuntos==='function') window.urbisCargarPuntos(); if(typeof window.urbisRenderGamesHub==='function') window.urbisRenderGamesHub(); }catch(e){} return; }
      if(name==='compartir-ubicacion') { try{ if(typeof window.urbisCompartirUbicacion==='function') window.urbisCompartirUbicacion(); }catch(e){} return; }
      if(name==='ver-contactos-mapa') { try{ if(typeof window.urbisVerContactosEnMapa==='function') window.urbisVerContactosEnMapa(socialContactRel); }catch(e){} return; }
      if(name==='contactos-todos') { socialContactRel='todos'; setContactTab(); try{ if(typeof window.urbisRenderContactos==='function') window.urbisRenderContactos('todos'); }catch(e){} return; }
      if(name==='contactos-amigos') { socialContactRel='amigo'; setContactTab(); try{ if(typeof window.urbisRenderContactos==='function') window.urbisRenderContactos('amigo'); }catch(e){} return; }
      if(name==='contactos-familia') { socialContactRel='familia'; setContactTab(); try{ if(typeof window.urbisRenderContactos==='function') window.urbisRenderContactos('familia'); }catch(e){} return; }
      if(name==='contactos-online') { socialContactRel='online'; setContactTab(); try{ if(typeof window.urbisRenderContactosOnline==='function') window.urbisRenderContactosOnline(); }catch(e){} return; }
      if(name==='locate') ensureMobileGps(true);
      if(name==='choose-destination' && typeof prepararDestinoDesdeGPS==='function') { ensureMobileGps(false); await prepararDestinoDesdeGPS(); setMobilityStatus('Toca el mapa para marcar destino. Puedes mover o alejar el mapa.'); }
      if(name==='start-route' && typeof calcularRutaRealActual==='function') { ensureMobileGps(false); setMobilityStatus('Calculando ruta azul...'); await calcularRutaRealActual(); try{ if(typeof iniciarRastreoGPS==='function') iniciarRastreoGPS(); }catch(e){} describeCurrentRoute(); show('nav'); }
      if(name==='finish-route' && typeof limpiarRutaReal==='function') { limpiarRutaReal(); setMobilityStatus('Ruta finalizada. Elige un nuevo destino.'); show('mobility'); }
      if(name==='report-gps') { openGpsCommunityReport(); return; }
      if(name==='report-manual') { exitProCityModeIfActive(); show('map'); setTimeout(openManualCommunityReport, 80); return; }
      if(name==='event-map') { openCommunityEventMode(); return; }
      if(name==='open-report') { exitProCityModeIfActive(); show('map'); setTimeout(openManualCommunityReport, 80); return; }
      if(name==='choice-report') { confirmCommunityChoice('report'); return; }
      if(name==='choice-event') { confirmCommunityChoice('event'); return; }
      if(name==='quick-report-close') { hideQuickReportPanel(); return; }
      if(name==='quick-report-back') { renderQuickReportCategories(); return; }
      if(name==='quick-report-publish') { publishQuickReport(app.querySelector('[data-u52-call="quick-report-publish"]')); return; }
      if(name==='procity-open-map') { openProCityMap(); return; }
      if(name==='procity-category-open') { showProCityCategorySheet(); return; }
      if(name==='procity-category-close') { hideProCityCategorySheet(); return; }
      if(name==='procity-stats-open') { showProCityStats(); return; }
      if(name==='procity-stats-close') { hideProCityStats(); return; }
      if(name==='procity-stats-tab-totales') { setProCityStatsTab('totales'); return; }
      if(name==='procity-stats-tab-mios') { setProCityStatsTab('mios'); return; }
      if(name==='procity-stats-tab-amigos') { setProCityStatsTab('amigos'); return; }
      if(name==='procity-stats-tab-carpetas') { openProCityCoop(); return; }
      if(name==='procity-stats-tab-analisis') { setProCityStatsTab('analisis'); return; }
      if(name==='procity-coop-back') { backProCityCoop(); return; }
      if(name==='procity-coop-point-close') { hideProCityCoopPointSheet(); return; }
      if(name==='procity-visual-toggle') { toggleProCityVisualMode(); return; }
      if(name==='procity-active-folder-open') { showProCityActiveFolderPicker(); return; }
      if(name==='procity-active-folder-close') { hideProCityActiveFolderPicker(); return; }
      if(name==='procity-active-folder-clear') { clearProCityActiveFolder(); return; }
      if(name==='procity-tag-folder-close') { hideProCityTagFolderPicker(); return; }
      if(name==='procity-select-toggle') { toggleProCitySelectMode(); return; }
      if(name==='procity-select-bulk-add') { showProCityBulkTagFolderPicker(); return; }
      if(name==='procity-view-filter-open') { proCity.viewFilterStep = 'main'; showProCityViewFilterPicker(); return; }
      if(name==='procity-view-filter-close') { hideProCityViewFilterPicker(); return; }
      if(name==='procity-view-filter-back') { proCity.viewFilterStep = 'main'; showProCityViewFilterPicker(); return; }
      if(name==='procity-view-filter-mine') { setProCityViewFilter('mine'); return; }
      if(name==='procity-view-filter-friends') { setProCityViewFilter('friends'); return; }
      if(name==='procity-view-filter-all') { setProCityViewFilter('all'); return; }
      if(name==='procity-view-filter-folder-step') { proCity.viewFilterStep = 'folder'; showProCityViewFilterPicker(); return; }
      if(name==='procity-folder-create') { showProCityFolderCreateSheet(); return; }
      if(name==='procity-folder-create-confirm') { confirmProCityFolderCreate(); return; }
      if(name==='procity-folder-join') { joinProCityFolderByCode(); return; }
      if(name==='procity-invite-close') { hideProCityFolderInviteSheet(); return; }
      if(name==='procity-loc-manual') { beginProCityLocationManual(); return; }
      if(name==='procity-loc-gps') { beginProCityLocationGps(); return; }
      if(name==='procity-close') { closeProCityPanel(); return; }
      if(name==='procity-back') { renderProCityItems(); return; }
      if(name==='procity-change-category') { proCity.matrizGroup = ''; proCity.matrizUse = ''; renderProCityItems(); return; }
      if(name==='procity-radio-open') { showProCityRadioConfigSheet(); return; }
      if(name==='procity-radio-close') { hideProCityRadioConfigSheet(); return; }
      if(name==='procity-radio-save') { saveProCityRadioFromInput(); return; }
      if(name==='procity-grupo-detalle-close') { hideProCityGrupoDetalle(); return; }
      if(name==='procity-matriz-back') { backProCityMatrizUses(); return; }
      if(name==='procity-publish') { publishQuickReport(app.querySelector('[data-u52-call="procity-publish"]')); return; }
      if(name==='procity-filter-open') { showProCityFilterSheet(); return; }
      if(name==='procity-filter-close') { hideProCityFilterSheet(); return; }
      if(name==='procity-filter-all') { setAllProCityFilter(false); return; }
      if(name==='procity-filter-none') { setAllProCityFilter(true); return; }
      if(name==='procity-filter-mine') { toggleProCityOnlyMine(); return; }
      if(name==='procity-tf-month-prev') { stepProCityCalendarMonth(-1); return; }
      if(name==='procity-tf-month-next') { stepProCityCalendarMonth(1); return; }
      if(name==='procity-tf-reset') { resetProCityTime(); return; }
      if(name==='procity-sel-close') { hideProCitySelectedPanel(); return; }
      if(name==='procity-sel-edit') { beginProCityEdit(proCity.selPoint); return; }
      if(name==='procity-sel-move') { moveProCitySelected(); return; }
      if(name==='procity-sel-delete') { deleteProCitySelected(); return; }
      if(name==='cfilter-open') { showCitizenFilterSheet(); return; }
      if(name==='cfilter-close') { hideCitizenFilterSheet(); return; }
      if(name==='cfilter-all') { setAllCitizenFilter(false); return; }
      if(name==='cfilter-none') { setAllCitizenFilter(true); return; }
      if(name==='cfilter-tf-month-prev') { stepCitizenCalendarMonth(-1); return; }
      if(name==='cfilter-tf-month-next') { stepCitizenCalendarMonth(1); return; }
      if(name==='cfilter-tf-reset') { resetCitizenTime(); return; }
      if(name==='quick-event-close') { hideQuickEventPanel(); return; }
      if(name==='quick-event-back') { renderQuickEventCategories(); return; }
      if(name==='quick-event-publish') { publishQuickEvent(app.querySelector('[data-u52-call="quick-event-publish"]')); return; }
      if(name==='layers') { renderBasemapPicker(); app.querySelector('#u52-layer-sheet')?.removeAttribute('hidden'); }
      if(name==='layers-close') app.querySelector('#u52-layer-sheet')?.setAttribute('hidden','');
      if(name==='logout-session'){
        const ok = confirm('¿Cerrar sesión de URBIS en este dispositivo?');
        if(!ok) return;
        if(window.URBIS_AUTH && typeof window.URBIS_AUTH.logout === 'function') window.URBIS_AUTH.logout();
        else {
          try{ localStorage.removeItem((window.URBIS_CONFIG && window.URBIS_CONFIG.AUTH && window.URBIS_CONFIG.AUTH.SESSION_KEY) || 'urbis_auth_session_v1'); }catch(e){}
          location.reload();
        }
      }
    }catch(e){ console.warn('URBIS mobile call failed:', name, e); }
  }

  // Long-press sobre una tarjeta de "Mis mapeos" → entra directo al modo
  // selección múltiple y marca esa tarjeta (pedido explícito, alternativa
  // al botón "Seleccionar varios"). Se suprime el click que sigue al soltar
  // para no abrir también el detalle del punto.
  let _procityLongPressTimer = null;
  let _procityLongPressSuppressClick = false;
  app.addEventListener('pointerdown', ev=>{
    const card = ev.target.closest('[data-u52-procity-select-target]');
    if(!card || proCity.selectMode) return;
    const lat = card.dataset.u52ProcitySelectTarget;
    _procityLongPressTimer = setTimeout(()=>{
      _procityLongPressTimer = null;
      _procityLongPressSuppressClick = true;
      proCity.selectMode = true;
      proCity.selectedLats.add(String(lat));
      showProCityStats();
      try{ if(navigator.vibrate) navigator.vibrate(30); }catch(e){}
    }, 500);
  }, { passive:true });
  ['pointerup','pointercancel','pointerleave'].forEach(evt=>{
    app.addEventListener(evt, ()=>{ if(_procityLongPressTimer){ clearTimeout(_procityLongPressTimer); _procityLongPressTimer = null; } }, { passive:true });
  });

  app.addEventListener('click', ev=>{
    if(_procityLongPressSuppressClick){ _procityLongPressSuppressClick = false; ev.preventDefault(); ev.stopPropagation(); return; }
    const avatarChoice = ev.target.closest('[data-u65-avatar-choice]');
    if(avatarChoice){ setSelectedAvatar(avatarChoice.dataset.u65AvatarChoice); return; }
    const authBack = ev.target.closest('[data-u52-auth-back]');
    if(authBack){
      ev.preventDefault();
      ev.stopPropagation();
      show('login');
      setTimeout(()=>app.querySelector('[data-u52-screen="login"]')?.scrollTo?.({top:0, behavior:'instant'}), 20);
      return;
    }

    const mobileLoginSubmit = ev.target.closest('[data-u52-auth-login-submit]');
    if(mobileLoginSubmit){
      ev.preventDefault();
      ev.stopPropagation();
      if(typeof window.URBIS_AUTH?.loginRegisteredUser === 'function') window.URBIS_AUTH.loginRegisteredUser(ev);
      else alert('El inicio de sesión aún no está listo.');
      return;
    }

    const mobileForgot = ev.target.closest('[data-u52-auth-forgot]');
    if(mobileForgot){
      ev.preventDefault();
      ev.stopPropagation();
      if(typeof window.URBIS_AUTH?.openRecoveryModal === 'function') window.URBIS_AUTH.openRecoveryModal();
      return;
    }

    const authOpen = ev.target.closest('[data-u52-auth-open]');
    if(authOpen){
      ev.preventDefault();
      ev.stopPropagation();
      const mode = authOpen.dataset.u52AuthOpen === 'register' ? 'register' : 'login';
      if(mode === 'login'){
        show('auth-login');
        setTimeout(()=>app.querySelector('#mobile-login-username')?.focus?.(), 160);
      }else if(typeof window.URBIS_AUTH?.showCitizenRegistrationForm === 'function'){
        window.URBIS_AUTH.showCitizenRegistrationForm('register');
      }else if(typeof window.mostrarAccesoNormal === 'function'){
        window.mostrarAccesoNormal();
      }else{
        alert('Abre el registro ciudadano.');
      }
      return;
    }
    const birthdateOpen = ev.target.closest('[data-u52-birthdate-open]');
    if(birthdateOpen){ ev.preventDefault(); ev.stopPropagation(); openBirthdateModal(); return; }
    const aureaGo = ev.target.closest('[data-u52-aurea-go]');
    if(aureaGo){ ev.preventDefault(); ev.stopPropagation(); const j=aureaGo.dataset.aureaJuego||'', t=aureaGo.dataset.aureaTitulo||'Evento Áurea', pr=aureaGo.dataset.aureaPremio||'', f=aureaGo.dataset.aureaFin||''; try{ if(typeof window.urbisAbrirAureaModulo==='function') window.urbisAbrirAureaModulo(j,t,pr,f,false); }catch(e){} return; }
    const notiRefresh = ev.target.closest('[data-u52-noti-refresh]');
    if(notiRefresh){ ev.preventDefault(); ev.stopPropagation(); loadNotifications(); return; }
    const notiAccept = ev.target.closest('[data-u52-noti-accept]');
    if(notiAccept){ ev.preventDefault(); ev.stopPropagation(); respondFriendRequest(notiAccept, 'accepted'); return; }
    const notiReject = ev.target.closest('[data-u52-noti-reject]');
    if(notiReject){ ev.preventDefault(); ev.stopPropagation(); respondFriendRequest(notiReject, 'rejected'); return; }
    const socialSearch = ev.target.closest('[data-u52-social-search]');
    if(socialSearch){ ev.preventDefault(); ev.stopPropagation(); socialSearchFriend(); return; }
    const socialAdd = ev.target.closest('[data-u52-social-add]');
    if(socialAdd){ ev.preventDefault(); ev.stopPropagation(); socialAddFriend(socialAdd); return; }
    const socialCancel = ev.target.closest('[data-u52-social-cancel]');
    if(socialCancel){ ev.preventDefault(); ev.stopPropagation(); socialCancelRequest(socialCancel); return; }
    const socialCopy = ev.target.closest('[data-u52-social-copy-id]');
    if(socialCopy){ ev.preventDefault(); ev.stopPropagation(); copySocialId('social'); return; }
    const profileCopy = ev.target.closest('[data-u52-profile-copy-id]');
    if(profileCopy){ ev.preventDefault(); ev.stopPropagation(); copySocialId('profile'); return; }
    const adminToggle = ev.target.closest('[data-u52-show-admin]'); if(adminToggle){ app.querySelector('#u52-admin-box')?.toggleAttribute('hidden'); return; }
    const login = ev.target.closest('[data-u52-login]');
    if(login){
      const role = login.dataset.u52Login;

      // Seguridad/registro: el ingreso normal NO puede saltarse el formulario.
      // Si no hay sesión verificada, se abre el registro real y se detiene el flujo móvil.
      if(role === 'citizen'){
        const auth = window.URBIS_AUTH;
        const session = auth && typeof auth.readSession === 'function' ? auth.readSession() : null;
        if(!session || !session.active || !session.verified){
          ev.preventDefault();
          ev.stopPropagation();
          if(typeof window.URBIS_AUTH?.showCitizenRegistrationForm === 'function'){
            window.URBIS_AUTH.showCitizenRegistrationForm();
          }else if(typeof window.mostrarAccesoNormal === 'function'){
            window.mostrarAccesoNormal();
          }else{
            alert('Primero completa el registro ciudadano.');
          }
          return;
        }
      }

      // Seguridad: no permitir admin por clave quemada en frontend.
      if(role === 'admin'){
        ev.preventDefault();
        ev.stopPropagation();
        alert('El acceso administrador por clave local fue desactivado por seguridad. Usa autenticación verificada desde backend.');
        return;
      }

      setRole(role);
      callNativeLogin(role);
      show('home');
      setTimeout(()=>ensureMobileGps(true),250);
      return;
    }
    const transport=ev.target.closest('[data-u52-transport]');
    if(transport){
      const mode = transport.dataset.u52Transport || 'car';
      app.querySelectorAll('[data-u52-transport]').forEach(x=>x.classList.toggle('active', x===transport));
      try{ if(typeof seleccionarModoRutaReal === 'function') seleccionarModoRutaReal(mode); }catch(e){}
      const names={walking:'A pie',bike:'Bici',bus:'Bus',motorcycle:'Moto',car:'Carro'};
      setMobilityStatus(`${names[mode]||'Carro'} seleccionado. Ahora elige destino.`);
      return;
    }
    const quickSection = ev.target.closest('[data-u52-report-section]');
    if(quickSection){ ev.preventDefault(); ev.stopPropagation(); switchQuickReportSection(quickSection.dataset.u52ReportSection); return; }
    const quickAlert = ev.target.closest('[data-u52-alert-id]');
    if(quickAlert){ ev.preventDefault(); ev.stopPropagation(); openQuickReportDetails(quickAlert.dataset.u52AlertId); return; }
    const evSection = ev.target.closest('[data-u52-event-section]');
    if(evSection){ ev.preventDefault(); ev.stopPropagation(); communityEventComposer.activeSection=evSection.dataset.u52EventSection; renderQuickEventCategories(); return; }
    const procityDim = ev.target.closest('[data-u52-procity-dim]');
    if(procityDim){ beginProCityMapSelection(procityDim.dataset.u52ProcityDim); return; }
    const procityGroupEntry = ev.target.closest('[data-u52-procity-group-entry]');
    if(procityGroupEntry){ beginProCityGroupSelection(procityGroupEntry.dataset.u52ProcityGroupEntry); return; }
    const procitySearchItem = ev.target.closest('[data-u52-procity-search-item]');
    if(procitySearchItem){ pickProCityFromSearch(procitySearchItem.dataset.u52ProcitySearchItem); return; }
    const procityGroup = ev.target.closest('[data-u52-procity-group]');
    if(procityGroup){ pickProCityMatrizGroup(procityGroup.dataset.u52ProcityGroup); return; }
    const procityUse = ev.target.closest('[data-u52-procity-use]');
    if(procityUse){ pickProCityMatrizUse(procityUse.dataset.u52ProcityUse); return; }
    const procityItem = ev.target.closest('[data-u52-procity-item]');
    if(procityItem){ openProCityItemDetails(procityItem.dataset.u52ProcityItem); return; }
    const procityFilter = ev.target.closest('[data-u52-procity-filter]');
    if(procityFilter){ toggleProCityFilter(procityFilter.dataset.u52ProcityFilter); return; }
    const cfilterChip = ev.target.closest('[data-u52-cfilter]');
    if(cfilterChip){ toggleCitizenFilterDim(cfilterChip.dataset.u52Cfilter); return; }
    const procityMine = ev.target.closest('[data-u52-procity-mine]');
    if(procityMine){
      // En modo selección, tocar la tarjeta marca/desmarca en vez de abrir
      // el detalle (pedido explícito de selección múltiple).
      if(proCity.selectMode && procityMine.hasAttribute('data-u52-procity-select-target')){
        toggleProCitySelectLat(procityMine.dataset.u52ProcitySelectTarget);
        return;
      }
      openProCityMineFromList(procityMine.dataset.u52ProcityMine);
      return;
    }
    const folderView = ev.target.closest('[data-u52-call="procity-folder-view"]');
    if(folderView){ toggleProCityFolderView(folderView.dataset.folderId); return; }
    const folderActivate = ev.target.closest('[data-u52-call="procity-folder-activate"]');
    if(folderActivate){ toggleProCityFolderActive(folderActivate.dataset.folderId); return; }
    const coopAuthor = ev.target.closest('[data-u52-call="procity-coop-author"]');
    if(coopAuthor){ pickProCityCoopAuthor(coopAuthor.dataset.author || ''); return; }
    const coopGrupo = ev.target.closest('[data-u52-call="procity-coop-grupo"]');
    if(coopGrupo){ pickProCityCoopGrupo(coopGrupo.dataset.gid || ''); return; }
    const coopPointCopy = ev.target.closest('[data-u52-call="procity-coop-point-copy"]');
    if(coopPointCopy){
      const coords = coopPointCopy.dataset.coords || '';
      try{
        if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(coords);
        if(typeof showAchievementToast === 'function') showAchievementToast('Copiado', 'Coordenadas copiadas: ' + coords);
      }catch(e){}
      return;
    }
    const coopPointMap = ev.target.closest('[data-u52-call="procity-coop-point-onmap"]');
    if(coopPointMap){
      const lt = parseFloat(String(coopPointMap.dataset.lat).replace(',','.'));
      const lg = parseFloat(String(coopPointMap.dataset.lng).replace(',','.'));
      hideProCityCoopPointSheet();
      closeProCityCoop();
      hideProCityStats();
      try{ if(window.map && !isNaN(lt) && !isNaN(lg)) map.setView([lt,lg], Math.max(map.getZoom ? map.getZoom() : 17, 17), { animate:true }); }catch(e){}
      return;
    }
    const folderRenameOpen = ev.target.closest('[data-u52-call="procity-folder-rename"]');
    if(folderRenameOpen){ renameProCityFolder(folderRenameOpen.dataset.folderId); return; }
    const folderManageOpen = ev.target.closest('[data-u52-call="procity-folder-manage"]');
    if(folderManageOpen){ showProCityFolderMembersSheet(folderManageOpen.dataset.folderId); return; }
    const folderAddById = ev.target.closest('[data-u52-call="procity-folder-add-byid"]');
    if(folderAddById){ addProCityFolderMemberById(folderAddById.dataset.folderId); return; }
    const folderInvitePick = ev.target.closest('[data-u52-procity-folder-invite]');
    if(folderInvitePick){
      const fid = folderInvitePick.dataset.u52ProcityFolderInvite;
      const user = folderInvitePick.dataset.u52ProcityInviteUser;
      socialAPI({ action:'procity_folder_join', id: fid, miembro: user }).then(function(out){
        if(out && out.ok){
          loadProCityFolders().then(function(){ showProCityFolderMembersSheet(fid); });
          try{ if(typeof showAchievementToast === 'function') showAchievementToast('Agregado', user + ' se unió a la carpeta.'); }catch(e){}
        } else alert((out && out.message) || 'No se pudo agregar.');
      }).catch(function(){ alert('No se pudo agregar.'); });
      return;
    }
    const folderRemovePick = ev.target.closest('[data-u52-procity-folder-remove]');
    if(folderRemovePick){
      const fidr = folderRemovePick.dataset.u52ProcityFolderRemove;
      const userr = folderRemovePick.dataset.u52ProcityRemoveUser;
      removeProCityFolderMember(fidr, userr);
      return;
    }
    const folderOpen = ev.target.closest('[data-u52-procity-folder-open]');
    if(folderOpen){ openProCityCoopFolder(folderOpen.dataset.u52ProcityFolderOpen); return; }
    const activeFolderPick = ev.target.closest('[data-u52-procity-active-pick]');
    if(activeFolderPick){ pickProCityActiveFolder(activeFolderPick.dataset.u52ProcityActivePick); return; }
    const viewFolderPick = ev.target.closest('[data-u52-procity-view-folder-pick]');
    if(viewFolderPick){ setProCityViewFilter('folder', viewFolderPick.dataset.u52ProcityViewFolderPick); return; }
    const addFolderOpen = ev.target.closest('[data-u52-call="procity-sel-addfolder"]');
    if(addFolderOpen){
      hideProCitySelectedPanel();
      const latSel = addFolderOpen.dataset.lat;
      const datosSel = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
      const puntoSel = datosSel.find(x => x && String(x.lat) === String(latSel)) || (proCity.selPoint && String(proCity.selPoint.lat) === String(latSel) ? proCity.selPoint : null);
      showProCityTagFolderPicker(puntoSel ? [puntoSel] : []);
      return;
    }
    const tagFolderPick = ev.target.closest('[data-u52-procity-tag-pick]');
    if(tagFolderPick){ tagExistingProCityPoint(tagFolderPick.dataset.u52ProcityTagPick); return; }
    const evCard = ev.target.closest('[data-u52-event-id]');
    if(evCard){ ev.preventDefault(); ev.stopPropagation(); openQuickEventDetails(evCard.dataset.u52EventId); return; }
    const basemapCard = ev.target.closest('[data-u52-basemap]');
    if(basemapCard){ ev.preventDefault(); ev.stopPropagation(); selectBasemap(basemapCard.dataset.u52Basemap); return; }
    const call=ev.target.closest('[data-u52-call]');
    if(call){
      const c=call.dataset.u52Call;
      const modulo = call.closest('.u52-module');
      if(modulo){
        // Mismo "pop" cute + sonidito que los módulos con data-u52-go (ej. Pro
        // City, que abre el mapa directo en vez de navegar a otra pantalla).
        try{ if(typeof window.playCuteTap === 'function') window.playCuteTap(); }catch(e){}
        modulo.classList.remove('u52-module-tapped'); void modulo.offsetWidth;
        modulo.classList.add('u52-module-tapped');
        setTimeout(()=>{ try{ modulo.classList.remove('u52-module-tapped'); }catch(e){} }, 340);
      }
      if(c==='start-runner') startRunner(); else if(c==='stop-runner') stopRunner(); else if(c==='pause-runner') { pauseRunner(call); } else if(c==='save-runner') saveRunner();
      else if(c==='procity-tf-day') { pickProCityCalendarDay(call.dataset.ms); }
      else if(c==='cfilter-tf-day') { pickCitizenCalendarDay(call.dataset.ms); }
      else if(c==='procity-radio-preset') { pickProCityRadioPreset(call.dataset.km); }
      else if(c==='procity-grupo-detalle') { showProCityGrupoDetalle(call.dataset.gid); }
      else if(c==='procity-grupo-detalle-folder') { showProCityGrupoDetalle(call.dataset.gid, proCity.coopStatsPuntos || []); }
      else if(c==='procity-grupo-item-open') { openProCityGrupoDetalleItem(call.dataset.lat); }
      // Acciones del análisis por área (js/24). Van aquí y no en nativeCall
      // porque varias necesitan el elemento (data-id del área guardada).
      else if(c.indexOf('pca-') === 0 && window.URBIS_PC_ANALISIS) { window.URBIS_PC_ANALISIS.accion(c.slice(4), call); }
      else nativeCall(c);
      return;
    }
    const go=ev.target.closest('[data-u52-go]');
    if(go){
      const modulo = go.closest('.u52-module');
      // Módulos del inicio: "pop" cute + sonidito antes de navegar. La
      // navegación se retrasa ~190ms para que la animación alcance a verse
      // (show() esconde la pantalla de inicio de inmediato). El resto de
      // enlaces (pills del topbar, botones) navegan al instante como siempre.
      if(modulo){
        try{ if(typeof window.playCuteTap === 'function') window.playCuteTap(); }catch(e){}
        modulo.classList.remove('u52-module-tapped'); void modulo.offsetWidth;
        modulo.classList.add('u52-module-tapped');
        const destino = go.dataset.u52Go;
        setTimeout(()=>{ try{ modulo.classList.remove('u52-module-tapped'); }catch(e){} if(destino==='map') exitProCityModeIfActive(); show(destino); }, 190);
        return;
      }
      if(go.dataset.u52Go==='map') exitProCityModeIfActive();
      show(go.dataset.u52Go); return;
    }
    const b=ev.target.closest('[data-u52-back]'); if(b){ if(document.body.classList.contains('urbis-moving-mode')){ try{ if(window.urbisCancelarMoverReporte) window.urbisCancelarMoverReporte(); }catch(e){} return; } back(); return; }
    const act=ev.target.closest('[data-u52-activity]'); if(act){ selectedActivity=act.dataset.u52Activity; app.querySelectorAll('.u52-activity').forEach(x=>x.classList.toggle('active',x===act)); return; }
  });

  app.addEventListener('keydown', function(ev){
    if(ev.key === 'Enter' && ev.target && ev.target.id === 'u52-social-search-input'){
      ev.preventDefault();
      socialSearchFriend();
    }
  });

  loadTerritorialLoginStats();
  ensureCommunityChooser();
  ensureQuickReportPanel();
  ensureQuickEventPanel();
  setTimeout(()=>{ try{ ensureCommunityMapPicker(); ensureQuickReportItemsInDimensions(); }catch(e){} }, 800);
  renderRealStates();
  refreshAvatarUI();
  setTimeout(loadNotifications, 500);
  window.urbisCargarNotificaciones = loadNotifications; // lo llama js/47 al detectar una gota nueva (noti inmediata)
  // Refresco periódico de datos (eventos/gota) + notificaciones: así un EVENTO PREMIUM
  // recién creado llega a TODOS los usuarios (campanita + toast) en ~90s sin recargar.
  setInterval(()=>{
    try{ if(document.hidden) return; }catch(e){}
    try{ if(typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos(); }catch(e){}
    setTimeout(()=>{ try{ loadNotifications(); }catch(e){} }, 1800); // tras refrescar globalData
  }, 90000);

  // Exponer historial para js/46 (detalle + eliminar desde overlay)
  window.urbisRunnerLoadHistory = loadHistory;
  window.urbisRunnerEliminar = function(id){
    if(!confirm('¿Eliminar esta actividad?')) return;
    saveHistory(loadHistory().filter(x=>x.id!==id));
    renderRealStates();
    // Cerrar overlay de detalle si está abierto
    const ov=document.getElementById('rush-detail-ov'); if(ov) ov.remove();
  };
  window.urbisRunnerRefrescarHistorial = renderRealStates;

  window.UrbisMobileAppV58 = {show,startRunner,stopRunner,historyStats, ensureMobileGps, centerOnMobileGps, ensureIOSAppInteraction, openManualCommunityReport, openGpsCommunityReport, openCommunityEventMode, beginCommunityMapSelection, pickCommunityPoint, confirmCommunityChoice, showQuickReportCategories, beginProCityMapSelection, pickProCityPoint};
  window.UrbisMobileGPS = {ensureMobileGps, centerOnMobileGps, getLast:()=>mobileGps.last, setMobilityStatus, setSelectedAvatar, getSelectedAvatar};

  // ── Módulo "Análisis de Implantación IA" (analisis-ia.html) ─────────────
  // Página standalone exclusiva del dueño + admin. Aquí solo se destapa su
  // botón del Home cuando la sesión está autorizada; el resto del módulo
  // vive en sus propios archivos (js/60-63) y no toca nada de este shell.
  function u52AiaAutorizado(){
    try{
      var s = (window.URBIS_AUTH && window.URBIS_AUTH.readSession) ? (window.URBIS_AUTH.readSession() || {})
            : JSON.parse(localStorage.getItem('urbis_auth_session_v1') || '{}');
      var u = String(s.usuario || '').trim().toLowerCase();
      var esAdmin = (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin()) || String(s.rol || '').toLowerCase() === 'admin';
      return esAdmin || u === 'jesmen21' || u === 'jesmen21s';
    }catch(e){ return false; }
  }
  function u52RefreshAiaModule(){
    var b = document.getElementById('u52-aia-module');
    if(b) b.hidden = !u52AiaAutorizado();
  }
  document.addEventListener('DOMContentLoaded', u52RefreshAiaModule);
  setTimeout(u52RefreshAiaModule, 1500); // la sesión/roles pueden cargar tarde
  window.addEventListener('storage', u52RefreshAiaModule);
  // El login ocurre en esta misma pestaña sin evento storage: re-chequear
  // periódicamente cuesta casi nada y destapa el botón sin recargar.
  setInterval(u52RefreshAiaModule, 5000);
})();
