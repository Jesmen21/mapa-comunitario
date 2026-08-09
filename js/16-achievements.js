// ==========================================
// URBIS V10 · Sistema de logros con validación
// - Los logros de reportes SOLO se desbloquean con reportes aprobados.
// - Notificación estilo Steam con sonido elegante.
// - Prototipo localStorage; listo para conectar a SheetDB/Backend después.
// ==========================================
(function() {
  const STORAGE_PREFIX = 'urbis_achievements_v1_';
  const METRICS_PREFIX = 'urbis_metrics_v1_';
  const PROFILE_PROGRESS_LIMIT = 24;

  const REPORT_TYPES = {
    hole: p => textoReporte(p).includes('hueco') || textoReporte(p).includes('bache'),
    flood: p => textoReporte(p).includes('inund') || textoReporte(p).includes('drenaje') || textoReporte(p).includes('fuga'),
    traffic: p => textoReporte(p).includes('tráfico') || textoReporte(p).includes('trafico') || textoReporte(p).includes('accidente') || textoReporte(p).includes('congest') || textoReporte(p).includes('retén') || textoReporte(p).includes('reten'),
    light: p => textoReporte(p).includes('luz') || textoReporte(p).includes('alumbrado') || textoReporte(p).includes('luminaria'),
    trash: p => textoReporte(p).includes('basura') || textoReporte(p).includes('residuos'),
    green: p => textoReporte(p).includes('árbol') || textoReporte(p).includes('arbol') || textoReporte(p).includes('parque') || textoReporte(p).includes('ambiental') || textoReporte(p).includes('verde')
  };

  function make(id, icon, name, description, category, rarity, condition, options = {}) {
    return { id, icon, name, description, category, rarity, condition, ...options };
  }

  const ACHIEVEMENTS = [
    // Reportes: todos requieren validación admin/JAC
    make('rep_first_validated','🚨','Primer reporte validado','Publica un reporte que sea aprobado por administración.','Reportes','Común', stats => stats.approvedReports >= 1, { requiresApproval: true }),
    make('rep_photo_validated','📸','Evidencia confiable','Logra que aprueben un reporte con foto o enlace de evidencia.','Reportes','Común', stats => stats.approvedWithPhoto >= 1, { requiresApproval: true }),
    make('rep_gps_validated','📍','Ubicación precisa','Logra que aprueben un reporte con ubicación válida.','Reportes','Común', stats => stats.approvedReports >= 1, { requiresApproval: true }),
    make('rep_3_validated','✅','Voz ciudadana','Consigue 3 reportes aprobados.','Reportes','Poco común', stats => stats.approvedReports >= 3, { requiresApproval: true }),
    make('rep_5_validated','👀','Ojos del barrio','Consigue 5 reportes aprobados.','Reportes','Poco común', stats => stats.approvedReports >= 5, { requiresApproval: true }),
    make('rep_10_validated','🛡️','Guardián urbano','Consigue 10 reportes aprobados.','Reportes','Raro', stats => stats.approvedReports >= 10, { requiresApproval: true }),
    make('rep_20_validated','🏙️','Constructor de ciudad','Consigue 20 reportes aprobados.','Reportes','Épico', stats => stats.approvedReports >= 20, { requiresApproval: true }),
    make('rep_50_validated','👑','Leyenda ciudadana','Consigue 50 reportes aprobados.','Reportes','Legendario', stats => stats.approvedReports >= 50, { requiresApproval: true }),
    make('rep_hole_validated','🕳️','Cuidando el camino','Consigue un reporte aprobado de hueco o bache.','Reportes','Común', stats => stats.approvedByKind.hole >= 1, { requiresApproval: true }),
    make('rep_flood_validated','🌊','Contra la inundación','Consigue un reporte aprobado de inundación, drenaje o fuga.','Reportes','Común', stats => stats.approvedByKind.flood >= 1, { requiresApproval: true }),
    make('rep_traffic_validated','🚦','Ruta más segura','Consigue un reporte aprobado de tránsito, accidente o congestión.','Reportes','Común', stats => stats.approvedByKind.traffic >= 1, { requiresApproval: true }),
    make('rep_light_validated','💡','Luz para todos','Consigue un reporte aprobado de alumbrado o luminaria.','Reportes','Poco común', stats => stats.approvedByKind.light >= 1, { requiresApproval: true }),
    make('rep_trash_validated','🗑️','Barrio más limpio','Consigue un reporte aprobado de basura o residuos.','Reportes','Poco común', stats => stats.approvedByKind.trash >= 1, { requiresApproval: true }),
    make('rep_green_validated','🌳','Reporte verde','Consigue un reporte aprobado de parque, árbol o ambiente.','Reportes','Poco común', stats => stats.approvedByKind.green >= 1, { requiresApproval: true }),
    make('rep_3_categories_validated','🧩','Mapa vivo','Consigue reportes aprobados en 3 categorías distintas.','Reportes','Raro', stats => stats.approvedCategories >= 3, { requiresApproval: true }),
    make('rep_5_places_validated','🔎','Detective del barrio','Consigue reportes aprobados en 5 lugares distintos.','Reportes','Raro', stats => stats.approvedPlaces >= 5, { requiresApproval: true }),
    make('rep_liked_validated','👍','Reporte apoyado','Consigue un reporte aprobado con al menos 1 apoyo.','Reportes','Poco común', stats => stats.approvedLiked >= 1, { requiresApproval: true }),
    make('rep_popular_validated','🔥','Reporte comunitario popular','Consigue un reporte aprobado con 5 apoyos o más.','Reportes','Épico', stats => stats.approvedPopular >= 1, { requiresApproval: true }),
    make('rep_no_reject_10','🤝','Ciudadano confiable','Consigue 10 reportes aprobados sin usar reportes pendientes como atajo.','Reportes','Raro', stats => stats.approvedReports >= 10, { requiresApproval: true }),
    make('rep_temporal_validated','🔔','Alerta comunitaria','Consigue un reporte temporal aprobado.','Reportes','Poco común', stats => stats.approvedTemporal >= 1, { requiresApproval: true }),

    // Actividad física
    make('move_first','🚶','Primer paso urbano','Registra tu primera caminata, trote o bici.','Movimiento','Común', stats => stats.activities >= 1),
    make('move_1k','🏘️','Caminante de barrio','Completa 1 km acumulado.','Movimiento','Común', stats => stats.distanceKm >= 1),
    make('move_3k','🛣️','Ruta de 3K','Completa 3 km acumulados.','Movimiento','Común', stats => stats.distanceKm >= 3),
    make('move_5k','🌿','Cinco kilómetros de vida','Completa 5 km acumulados.','Movimiento','Poco común', stats => stats.distanceKm >= 5),
    make('run_4k','⚡','Trote de 4K','Completa 4 km trotando.','Movimiento','Poco común', stats => stats.runKm >= 4),
    make('run_8k','🔥','Trote de 8K','Completa 8 km trotando.','Movimiento','Raro', stats => stats.runKm >= 8),
    make('run_12k','🏅','Trote de 12K','Completa 12 km trotando.','Movimiento','Épico', stats => stats.runKm >= 12),
    make('move_week_3','📆','Constancia semanal','Registra 3 salidas en una semana.','Movimiento','Poco común', stats => stats.weeklyActivities >= 3),
    make('move_week_5','💪','Semana activa','Registra 5 actividades en una semana.','Movimiento','Raro', stats => stats.weeklyActivities >= 5),
    make('move_25k','💚','Amo caminar','Acumula 25 km caminando o trotando.','Movimiento','Raro', stats => stats.distanceKm >= 25),
    make('move_50k','🦵','Piernas urbanas','Acumula 50 km.','Movimiento','Épico', stats => stats.distanceKm >= 50),
    make('move_100k','🏁','Maratonista de barrio','Acumula 100 km.','Movimiento','Legendario', stats => stats.distanceKm >= 100),
    make('move_morning','🌅','Ruta temprana','Registra una actividad antes de las 8 a. m.','Movimiento','Poco común', stats => stats.morningActivities >= 1),
    make('move_night','🌙','Ruta nocturna','Registra una actividad después de las 6 p. m.','Movimiento','Poco común', stats => stats.nightActivities >= 1),
    make('move_park','🌳','Vuelta al parque','Registra una ruta cerca de un parque.','Movimiento','Poco común', stats => stats.parkActivities >= 1),
    make('move_personal_best','📈','Mi mejor distancia','Supera tu distancia personal anterior.','Movimiento','Raro', stats => stats.personalBests >= 1),

    // Bienestar
    make('mood_first','😊','Primer check-in emocional','Registra tu estado de ánimo por primera vez.','Bienestar','Común', stats => stats.moodLogs >= 1),
    make('mood_3','🫶','Me escuché hoy','Registra cómo te sientes 3 días.','Bienestar','Común', stats => stats.moodLogs >= 3),
    make('mood_7','📔','Diario de ánimo','Registra ánimo 7 veces.','Bienestar','Poco común', stats => stats.moodLogs >= 7),
    make('mood_week','🌈','Semana consciente','Registra ánimo todos los días de una semana.','Bienestar','Raro', stats => stats.moodStreak >= 7),
    make('mood_30','🗓️','Mes emocional','Registra ánimo 30 veces.','Bienestar','Épico', stats => stats.moodLogs >= 30),
    make('mood_low','💬','Reconocer también cuenta','Registra un día de bajo ánimo.','Bienestar','Común', stats => stats.lowMoodLogs >= 1),
    make('mood_move','🧠','Mente y movimiento','Registra actividad física y ánimo el mismo día.','Bienestar','Poco común', stats => stats.moodAndMoveDays >= 1),
    make('mood_better_move','🌤️','Mejor después de moverme','Registra mejor ánimo después de caminar o trotar.','Bienestar','Raro', stats => stats.betterAfterMove >= 1),
    make('mood_gratitude','🙏','Día de gratitud','Escribe una nota positiva.','Bienestar','Poco común', stats => stats.gratitudeNotes >= 1),
    make('mood_selfcare','🧡','Cuidé de mí','Registra una actividad de descanso o autocuidado.','Bienestar','Poco común', stats => stats.selfcareLogs >= 1),

    // Eventos
    make('event_first_view','🎪','Primer evento visto','Abre la ficha de un evento.','Eventos','Común', stats => stats.eventViews >= 1),
    make('event_first_attend','🙋','Asistí a uno','Marca asistencia a un evento.','Eventos','Común', stats => stats.eventsAttended >= 1),
    make('event_3','🏘️','Vida de barrio','Asiste a 3 eventos.','Eventos','Poco común', stats => stats.eventsAttended >= 3),
    make('event_5','🤝','Vecino activo','Asiste a 5 eventos.','Eventos','Raro', stats => stats.eventsAttended >= 5),
    make('event_10','🫂','Comunidad presente','Asiste a 10 eventos.','Eventos','Épico', stats => stats.eventsAttended >= 10),
    make('event_sport','⚽','Evento deportivo','Participa en un evento deportivo.','Eventos','Poco común', stats => stats.sportEvents >= 1),
    make('event_culture','🎨','Evento cultural','Participa en un evento cultural.','Eventos','Poco común', stats => stats.cultureEvents >= 1),
    make('event_route','🧭','Ruta al evento','Usa una ruta hacia un evento.','Eventos','Poco común', stats => stats.eventRoutes >= 1),
    make('event_share','📣','Reto compartido','Comparte un evento o reto comunitario.','Eventos','Raro', stats => stats.eventShares >= 1),
    make('event_20','🏆','Embajador del barrio','Participa en 20 eventos.','Eventos','Legendario', stats => stats.eventsAttended >= 20),

    // Minijuegos
    make('game_first','🎮','Primer intento gamer','Juega tu primer minijuego.','Juegos','Común', stats => stats.gamesPlayed >= 1),
    make('game_challenge','🏁','Reto aceptado','Participa en un reto comunitario.','Juegos','Común', stats => stats.challengesJoined >= 1),
    make('game_100','💯','Primeros 100 puntos','Consigue 100 puntos acumulados.','Juegos','Común', stats => stats.gamePoints >= 100),
    make('game_1000','🔥','Mil puntos urbanos','Consigue 1.000 puntos acumulados.','Juegos','Poco común', stats => stats.gamePoints >= 1000),
    make('game_top10','🏘️','Top del barrio','Entra al top 10 de un ranking barrial.','Juegos','Raro', stats => stats.top10Count >= 1),
    make('game_podium','🥉','Podio comunitario','Queda en top 3 de un reto.','Juegos','Épico', stats => stats.podiumCount >= 1),
    make('game_50k','👑','Campeón 50K','Gana un evento con premio de $50.000 COP.','Juegos','Legendario', stats => stats.prizeWins >= 1),
    make('game_mountain','🚗','Montaña URBIS','Juega el minijuego de montaña.','Juegos','Común', stats => stats.mountainGames >= 1),
    make('game_personal_best','🔁','Sin rendirse','Mejora tu propio puntaje anterior.','Juegos','Raro', stats => stats.gamePersonalBests >= 1),
    make('game_3_wins','🏆','Leyenda del reto','Gana 3 retos comunitarios.','Juegos','Legendario', stats => stats.challengeWins >= 3),

    // Exploración y perfil
    make('profile_created','👤','Perfil creado','Completa tu perfil básico.','Perfil','Común', stats => stats.profileComplete >= 1),
    make('profile_photo','🖼️','Foto lista','Sube foto de perfil.','Perfil','Común', stats => stats.profilePhoto >= 1),
    make('profile_phone','📱','Celular verificado','Registra o verifica tu número celular.','Perfil','Común', stats => stats.phoneVerified >= 1),
    make('profile_theme','🎨','Estilo propio','Cambia el tema de la app.','Perfil','Común', stats => stats.themeChanges >= 1),
    make('profile_7days','🟢','Ciudadano activo','Entra a la app 7 días distintos.','Perfil','Poco común', stats => stats.loginDays >= 7),
    make('profile_30days','🔐','Usuario constante','Entra a la app 30 días distintos.','Perfil','Épico', stats => stats.loginDays >= 30),
    make('explore_first','📍','Primer lugar descubierto','Abre un punto del mapa.','Exploración','Común', stats => stats.mapPointsOpened >= 1),
    make('explore_10','🧭','Explorador de Cúcuta','Explora 10 puntos del mapa.','Exploración','Poco común', stats => stats.mapPointsOpened >= 10),
    make('explore_layer_3','🔍','Mapa curioso','Activa 3 capas distintas.','Exploración','Poco común', stats => stats.layersActivated >= 3),
    make('explore_favorite','⭐','Punto importante','Guarda un lugar como favorito.','Exploración','Poco común', stats => stats.favorites >= 1),
    make('edu_mode','🎓','Modo educativo activado','Activa permisos educativos.','Educativo','Común', stats => stats.eduModeActivated >= 1),
    make('edu_raster','🧩','Aprendiz GIS','Genera tu primer raster o mapa de calor.','Educativo','Raro', stats => stats.rastersGenerated >= 1),
    make('gov_mode','🏛️','Rol comunitario activado','Activa modo JAC o funcionario.','JAC','Común', stats => stats.govModeActivated >= 1),
    make('gov_review','🧾','Primer reporte revisado','Revisa o aprueba un reporte ciudadano.','JAC','Común', stats => stats.reportsReviewed >= 1),
    make('social_react','❤️','Reacción enviada','Reacciona a un evento, logro o publicación.','Social','Común', stats => stats.socialReactions >= 1),
    make('social_5','🫂','Comunidad conectada','Interactúa con 5 usuarios.','Social','Raro', stats => stats.socialInteractions >= 5)
  ];

  // Relleno planificado: más logros visibles desde ya para que el perfil se sienta grande.
  const EXTRA_TIERS = [
    ['move_150k','🚀','150 km urbanos','Acumula 150 km.','Movimiento','Legendario','distanceKm',150],
    ['move_200k','🌎','Ciudad completa','Acumula 200 km.','Movimiento','Legendario','distanceKm',200],
    ['rep_75_validated','🏅','Voz territorial mayor','Consigue 75 reportes aprobados.','Reportes','Legendario','approvedReports',75,true],
    ['rep_100_validated','🏆','Archivo vivo de ciudad','Consigue 100 reportes aprobados.','Reportes','Legendario','approvedReports',100,true],
    ['mood_60','🌻','Dos meses consciente','Registra ánimo 60 veces.','Bienestar','Legendario','moodLogs',60],
    ['event_30','🎟️','Agenda viva','Participa en 30 eventos.','Eventos','Legendario','eventsAttended',30],
    ['game_5000','💎','Cinco mil puntos','Consigue 5.000 puntos acumulados.','Juegos','Épico','gamePoints',5000],
    ['game_10000','🌟','Diez mil puntos','Consigue 10.000 puntos acumulados.','Juegos','Legendario','gamePoints',10000],
    ['explore_25','🗺️','Veinticinco lugares','Explora 25 puntos del mapa.','Exploración','Raro','mapPointsOpened',25],
    ['explore_50','🧭','Cartógrafo ciudadano','Explora 50 puntos del mapa.','Exploración','Épico','mapPointsOpened',50]
  ];
  EXTRA_TIERS.forEach(([id, icon, name, desc, cat, rarity, metric, value, requiresApproval]) => {
    ACHIEVEMENTS.push(make(id, icon, name, desc, cat, rarity, stats => Number(stats[metric] || 0) >= value, { requiresApproval: !!requiresApproval }));
  });

  function userKey() {
    const raw = [window.userEmailGlobal, window.userCedulaGlobal, window.userNameGlobal, window.userBarrioGlobal]
      .filter(Boolean).join('|') || 'demo-user';
    return raw.toLowerCase().replace(/[^a-z0-9@._-]+/g, '_').slice(0, 90);
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || ''); } catch(e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn('URBIS achievements localStorage unavailable', e); }
  }
  function unlockedStore() { return readJSON(STORAGE_PREFIX + userKey(), {}); }
  function saveUnlocked(store) { writeJSON(STORAGE_PREFIX + userKey(), store); }
  function metricsStore() { return readJSON(METRICS_PREFIX + userKey(), {}); }
  function saveMetrics(store) { writeJSON(METRICS_PREFIX + userKey(), store); }

  function textoReporte(p) {
    const d = String(p?.descripcion || '').split(' | ');
    return `${p?.tipo || ''} ${d[0] || ''} ${d[1] || ''} ${d[2] || ''}`.toLowerCase();
  }

  function isApprovedReport(p) {
    const d = String(p?.descripcion || '').split(' | ');
    return String(d[BASE_OFFSET + 1] || '').toLowerCase() === 'aprobado';
  }

  function sameValue(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function isCurrentUserReport(p) {
    const d = String(p?.descripcion || '').split(' | ');
    const correo = d[BASE_OFFSET + 5] || '';
    const cedula = d[BASE_OFFSET + 6] || '';
    const nombre = d[BASE_OFFSET + 2] || '';
    return sameValue(correo, window.userEmailGlobal) || sameValue(cedula, window.userCedulaGlobal) || sameValue(nombre, window.userNameGlobal);
  }

  function hasPhoto(p) {
    const d = String(p?.descripcion || '').split(' | ');
    const foto = String(d[BASE_OFFSET] || '').trim();
    return foto && foto !== 'N/A';
  }

  function reportPlaceKey(p) {
    const lat = Number(String(p?.lat || '').replace(',', '.'));
    const lng = Number(String(p?.lng || '').replace(',', '.'));
    if(Number.isFinite(lat) && Number.isFinite(lng)) return `${lat.toFixed(4)},${lng.toFixed(4)}`;
    return String(p?.lat || '') + ',' + String(p?.lng || '');
  }

  function buildStats() {
    const local = metricsStore();
    const mineApproved = (Array.isArray(window.globalData) ? window.globalData : [])
      .filter(p => p && p.descripcion && isApprovedReport(p) && isCurrentUserReport(p));

    const approvedByKind = { hole:0, flood:0, traffic:0, light:0, trash:0, green:0 };
    mineApproved.forEach(p => {
      Object.keys(REPORT_TYPES).forEach(k => { if(REPORT_TYPES[k](p)) approvedByKind[k] += 1; });
    });

    const categories = new Set(mineApproved.map(p => p.tipo || 'Sin tipo'));
    const places = new Set(mineApproved.map(reportPlaceKey));
    const approvedWithPhoto = mineApproved.filter(hasPhoto).length;
    const approvedLiked = mineApproved.filter(p => {
      const d = String(p.descripcion || '').split(' | ');
      return (parseInt(d[BASE_OFFSET + 4]) || 0) >= 1;
    }).length;
    const approvedPopular = mineApproved.filter(p => {
      const d = String(p.descripcion || '').split(' | ');
      return (parseInt(d[BASE_OFFSET + 4]) || 0) >= 5;
    }).length;
    const approvedTemporal = mineApproved.filter(p => {
      try { return obtenerMetaTemporal(p).temporal; } catch(e) { return false; }
    }).length;

    return {
      ...local,
      approvedReports: mineApproved.length,
      approvedWithPhoto,
      approvedLiked,
      approvedPopular,
      approvedTemporal,
      approvedCategories: categories.size,
      approvedPlaces: places.size,
      approvedByKind,
      distanceKm: Number(local.distanceKm || 0),
      runKm: Number(local.runKm || 0)
    };
  }

  function playAchievementSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      const ctx = window.__urbisAudioCtx || new Ctx();
      window.__urbisAudioCtx = ctx;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.06);
      master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.45);
      master.connect(ctx.destination);
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx < 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.035);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18 / (idx + 1), ctx.currentTime + 0.10 + idx * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.15 + idx * 0.05);
        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime + idx * 0.035);
        osc.stop(ctx.currentTime + 1.55 + idx * 0.05);
      });
    } catch(e) { console.warn('No se pudo reproducir sonido de logro', e); }
  }

  function ensureStack() {
    let stack = document.getElementById('urbis-achievement-toast-stack');
    if(!stack) {
      stack = document.createElement('div');
      stack.id = 'urbis-achievement-toast-stack';
      stack.className = 'urbis-achievement-toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function notifyAchievement(achievement) {
    const stack = ensureStack();
    const toast = document.createElement('div');
    toast.className = 'urbis-achievement-toast';
    toast.innerHTML = `
      <div class="urbis-achievement-icon">${achievement.icon}</div>
      <div class="urbis-achievement-copy">
        <small>Logro desbloqueado</small>
        <b>${escapeHTML(achievement.name)}</b>
        <span>${escapeHTML(achievement.description)}</span>
        ${achievement.requiresApproval ? '<span class="urbis-achievement-validated">✅ validado por administración</span>' : ''}
      </div>`;
    stack.appendChild(toast);
    playAchievementSound();
    setTimeout(() => toast.remove(), 6200);
    if(typeof renderAchievementsProfile === 'function') renderAchievementsProfile();
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function evaluateAchievements(reason = 'sync') {
    if(!window.userRole) return [];
    const stats = buildStats();
    const unlocked = unlockedStore();
    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach(achievement => {
      if(unlocked[achievement.id]) return;
      let ok = false;
      try { ok = !!achievement.condition(stats); } catch(e) { ok = false; }
      if(ok) {
        unlocked[achievement.id] = { unlockedAt: new Date().toISOString(), reason };
        newlyUnlocked.push(achievement);
      }
    });
    if(newlyUnlocked.length) {
      saveUnlocked(unlocked);
      newlyUnlocked.slice(0, 4).forEach((a, idx) => setTimeout(() => notifyAchievement(a), idx * 900));
    }
    renderAchievementsProfile();
    return newlyUnlocked;
  }

  function recordMetric(name, amount = 1, mode = 'add') {
    const metrics = metricsStore();
    const value = Number(amount) || 0;
    if(mode === 'set') metrics[name] = value;
    else metrics[name] = Number(metrics[name] || 0) + value;
    saveMetrics(metrics);
    evaluateAchievements('metric:' + name);
  }

  function renderAchievementsProfile() {
    const container = document.getElementById('achievements-profile-list');
    const progress = document.getElementById('achievements-progress-pill');
    if(!container) return;
    const unlocked = unlockedStore();
    const stats = buildStats();
    const unlockedCount = ACHIEVEMENTS.filter(a => unlocked[a.id]).length;
    if(progress) progress.textContent = `${unlockedCount}/${ACHIEVEMENTS.length}`;
    const ordered = ACHIEVEMENTS.slice().sort((a,b) => {
      const au = unlocked[a.id] ? 0 : 1;
      const bu = unlocked[b.id] ? 0 : 1;
      if(au !== bu) return au - bu;
      return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });
    container.innerHTML = ordered.slice(0, PROFILE_PROGRESS_LIMIT).map(a => {
      const isUnlocked = !!unlocked[a.id];
      const status = isUnlocked ? `✅ ${new Date(unlocked[a.id].unlockedAt).toLocaleDateString('es-CO')}` : (a.requiresApproval ? '🔒 requiere aprobación' : '🔒 pendiente');
      return `<div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="ac-icon">${a.icon}</div>
        <div><b>${escapeHTML(a.name)}</b><small>${escapeHTML(a.description)}</small><small class="ac-status">${status}</small></div>
      </div>`;
    }).join('');
  }

  function onReportApproved(punto) {
    // Si el admin aprueba su propio reporte, se evalúa al instante.
    // Si aprueba el reporte de otro ciudadano, ese ciudadano desbloqueará el logro al entrar o refrescar,
    // porque la evaluación solo cuenta reportes aprobados que coinciden con su identidad.
    recordMetric('reportsReviewed', 1);
    if(isCurrentUserReport(punto)) evaluateAchievements('report-approved');
  }

  window.urbisAchievementsCatalog = ACHIEVEMENTS;
  window.urbisEvaluateAchievements = evaluateAchievements;
  window.urbisRecordMetric = recordMetric;
  window.urbisNotifyAchievement = notifyAchievement;
  window.urbisOnReportApproved = onReportApproved;
  window.renderAchievementsProfile = renderAchievementsProfile;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(renderAchievementsProfile, 400);
  });
})();
