
// =====================================================
// URBIS · Módulo Deporte
// Rutina adaptativa básica + seguimiento local.
// =====================================================
(function(){
  const STORAGE_PROFILE = 'urbis_sport_profile_v1';
  const STORAGE_ACTIVITIES = 'urbis_sport_activities_v1';

  function num(id) {
    const el = document.getElementById(id);
    const value = el ? parseFloat(el.value) : NaN;
    return Number.isFinite(value) ? value : 0;
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if(el) el.innerHTML = html;
  }

  function getActivities() {
    try { return JSON.parse(localStorage.getItem(STORAGE_ACTIVITIES) || '[]'); }
    catch(e) { return []; }
  }

  function saveActivities(items) {
    localStorage.setItem(STORAGE_ACTIVITIES, JSON.stringify(items.slice(-120)));
  }

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(STORAGE_PROFILE) || 'null'); }
    catch(e) { return null; }
  }

  function saveProfile(profile) {
    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
  }

  function calcularIMC(pesoKg, estaturaCm) {
    const m = estaturaCm / 100;
    if(!pesoKg || !m) return 0;
    return pesoKg / (m * m);
  }

  function prioridadPorObjetivo(objetivo) {
    if(objetivo === 'musculo') return 'fuerza';
    if(objetivo === 'resistencia') return 'cardio';
    return 'equilibrio';
  }

  function intensidadPorNivel(nivel) {
    if(nivel === 'avanzado') return 'alta';
    if(nivel === 'intermedio') return 'media';
    return 'baja';
  }

  function etiquetaObjetivo(objetivo) {
    if(objetivo === 'musculo') return 'Fuerza / músculo';
    if(objetivo === 'resistencia') return 'Resistencia / cardio';
    return 'Composición corporal saludable';
  }

  function generarRutina(profile) {
    const nivel = profile.nivel || 'principiante';
    const objetivo = profile.objetivo || 'resistencia';
    const intensidad = intensidadPorNivel(nivel);

    const base = {
      principiante: { dias: 3, descanso: '1 día de descanso entre sesiones', carga: 'suave y técnica' },
      intermedio: { dias: 4, descanso: 'alternar días fuertes y suaves', carga: 'moderada y progresiva' },
      avanzado: { dias: 5, descanso: 'descanso activo y control de fatiga', carga: 'alta con control' }
    }[nivel];

    if(objetivo === 'musculo') {
      return [
        ['Día 1 · Tren superior', `Empuje + jalón. 3 bloques de fuerza, intensidad ${intensidad}. Prioriza técnica y descanso.`],
        ['Día 2 · Tren inferior', `Pierna y glúteo. Series controladas, carga ${base.carga}.`],
        ['Día 3 · Core + movilidad', 'Zona media, estabilidad, estiramiento dinámico y caminata ligera.'],
        ['Adaptación', `${base.dias} sesiones/semana. ${base.descanso}. Si hay fatiga, baja carga antes de subir volumen.`]
      ];
    }

    if(objetivo === 'resistencia') {
      return [
        ['Sesión 1 · Base aeróbica', `Caminar/trotar ${nivel === 'principiante' ? '20-30' : '35-50'} min a ritmo conversacional.`],
        ['Sesión 2 · Intervalos suaves', 'Bloques cortos de ritmo rápido + recuperación. Evita forzar si hay dolor o fatiga.'],
        ['Sesión 3 · Ruta larga', 'Recorrido cómodo para sumar distancia semanal con estabilidad.'],
        ['Adaptación', `${base.dias} sesiones/semana. Prioridad cardio. Aumenta tiempo poco a poco.`]
      ];
    }

    return [
      ['Sesión 1 · Cardio moderado', 'Caminar, trotar suave o bici. Mantén intensidad cómoda y constante.'],
      ['Sesión 2 · Fuerza funcional', 'Ejercicios multiarticulares con peso controlado y buena técnica.'],
      ['Sesión 3 · HIIT moderado', 'Intervalos cortos, seguros y progresivos. No hacerlo si estás muy fatigado.'],
      ['Adaptación', `${base.dias} sesiones/semana. Enfoque en constancia, descanso y progreso saludable.`]
    ];
  }

  function renderProfile(profile) {
    if(!profile) {
      setHTML('sport-profile-output', 'Aún no hay perfil deportivo guardado.');
      setHTML('sport-status-pill', 'Sin perfil');
      setHTML('sport-status-help', 'Completa los datos para generar tu plan.');
      return;
    }
    const imc = calcularIMC(profile.peso, profile.estatura);
    const prioridad = prioridadPorObjetivo(profile.objetivo);
    setHTML('sport-profile-output', `
      <b>Perfil listo.</b><br>
      Edad: ${profile.edad || '—'} · Peso: ${profile.peso || '—'} kg · Estatura: ${profile.estatura || '—'} cm<br>
      Objetivo: <b>${etiquetaObjetivo(profile.objetivo)}</b> · Nivel: <b>${profile.nivel}</b><br>
      IMC referencial: <b>${imc ? imc.toFixed(1) : '—'}</b> · Prioridad del plan: <b>${prioridad}</b><br>
      <small>Este módulo es orientativo y no reemplaza acompañamiento profesional.</small>
    `);
    setHTML('sport-status-pill', prioridad.charAt(0).toUpperCase() + prioridad.slice(1));
    setHTML('sport-status-help', `Intensidad ${intensidadPorNivel(profile.nivel)} · ${etiquetaObjetivo(profile.objetivo)}`);
  }

  function renderRoutine(profile) {
    const cont = document.getElementById('sport-routine-output');
    if(!cont) return;
    if(!profile) {
      cont.innerHTML = '<div class="sport-empty">Completa tu perfil para generar una rutina.</div>';
      return;
    }
    cont.innerHTML = generarRutina(profile).map(([title, desc]) => `
      <div class="sport-routine-card">
        <b>${title}</b>
        <span>${desc}</span>
      </div>
    `).join('');
  }

  function evaluarProgreso(actual, history) {
    const prev = history.slice(-4);
    if(!prev.length) return { estado:'inicio', texto:'Primera actividad registrada. Desde la próxima sesión compararemos tu progreso.' };

    const prevScore = prev.reduce((acc, a) => acc + (Number(a.score) || 0), 0) / prev.length;
    const score = Number(actual.score) || 0;

    if(score > prevScore * 1.08) return { estado:'progreso', texto:'Vas mejorando. Mantén la progresión sin subir todo de golpe.' };
    if(score < prevScore * 0.82) return { estado:'fatiga', texto:'El rendimiento bajó frente a sesiones recientes. Considera descanso, movilidad o una sesión suave.' };
    return { estado:'estable', texto:'Rendimiento estable. Si se mantiene igual varias sesiones, cambia estímulo o ajusta intensidad.' };
  }

  function renderMetrics() {
    const items = getActivities();
    const sessions = items.length;
    const distance = items.reduce((a,b)=>a + (Number(b.distancia)||0),0);
    const volume = items.reduce((a,b)=>a + (Number(b.volumen)||0),0);
    setHTML('sport-metric-sessions', String(sessions));
    setHTML('sport-metric-distance', `${distance.toFixed(1)} km`);
    setHTML('sport-metric-volume', `${Math.round(volume)} kg`);

    const unlock = (id, ok) => {
      const el = document.getElementById(id);
      if(el) {
        el.classList.toggle('unlocked', !!ok);
        el.classList.toggle('locked', !ok);
      }
    };
    unlock('ach-first-session', sessions >= 1);
    unlock('ach-5k', distance >= 5);
    unlock('ach-3sessions', sessions >= 3);
    unlock('ach-strength', items.filter(x => x.tipo === 'gym' || x.tipo === 'crossfit').length >= 3);
  }

  window.guardarPerfilDeportivoUrbis = function() {
    const profile = {
      edad: num('sport-age'),
      peso: num('sport-weight'),
      estatura: num('sport-height'),
      objetivo: val('sport-goal') || 'resistencia',
      nivel: val('sport-level') || 'principiante',
      updatedAt: new Date().toISOString()
    };
    saveProfile(profile);
    renderProfile(profile);
    renderRoutine(profile);
    renderMetrics();
    if(typeof playSuccessSound === 'function') playSuccessSound();
  };

  window.generarRutinaDeportivaUrbis = function() {
    let profile = getProfile();
    if(!profile) {
      window.guardarPerfilDeportivoUrbis();
      profile = getProfile();
    }
    renderProfile(profile);
    renderRoutine(profile);
  };

  window.actualizarCamposActividadUrbis = function() {
    const type = val('sport-activity-type');
    const running = document.getElementById('sport-running-fields');
    const gym = document.getElementById('sport-gym-fields');
    if(running) running.style.display = (type === 'correr') ? 'grid' : 'none';
    if(gym) gym.style.display = (type === 'gym' || type === 'crossfit') ? 'grid' : 'none';
  };

  window.registrarActividadDeportivaUrbis = function() {
    const type = val('sport-activity-type') || 'correr';
    const tiempo = num('sport-time');
    const distancia = type === 'correr' ? num('sport-distance') : 0;
    const peso = (type === 'gym' || type === 'crossfit') ? num('sport-lift-weight') : 0;
    const reps = (type === 'gym' || type === 'crossfit') ? num('sport-reps') : 0;
    const volumen = peso * reps;
    const score = type === 'correr' ? (distancia * 1000) + (tiempo * 5) : volumen + (tiempo * 12);
    const items = getActivities();
    const actual = {
      id: Date.now(),
      tipo: type,
      tiempo,
      distancia,
      peso,
      reps,
      volumen,
      heart: num('sport-heart'),
      notes: val('sport-notes'),
      score,
      createdAt: new Date().toISOString()
    };
    const evalRes = evaluarProgreso(actual, items);
    items.push(actual);
    saveActivities(items);

    const typeLabel = type === 'correr' ? 'Correr / caminar' : type === 'gym' ? 'Gym / fuerza' : 'Crossfit / funcional';
    setHTML('sport-activity-output', `
      <b>Actividad guardada:</b> ${typeLabel}<br>
      Tiempo: ${tiempo || '—'} min ${distancia ? `· Distancia: ${distancia.toFixed(2)} km` : ''} ${volumen ? `· Volumen: ${Math.round(volumen)} kg` : ''}<br>
      Estado: <b>${evalRes.estado}</b> · ${evalRes.texto}
    `);
    setHTML('sport-adaptation-output', `
      <b>Evaluación:</b> ${evalRes.estado}<br>
      ${evalRes.texto}<br>
      <small>Regla adaptativa: progreso = subir intensidad gradualmente; fatiga = reducir carga o descansar; estable = variar estímulo.</small>
    `);
    renderMetrics();
    if(typeof showAchievementToast === 'function') {
      showAchievementToast('Actividad registrada', 'Tu progreso deportivo quedó guardado.');
    } else if(typeof playSuccessSound === 'function') {
      playSuccessSound();
    }
  };

  window.limpiarRegistroDeportivoUrbis = function() {
    ['sport-time','sport-distance','sport-heart','sport-lift-weight','sport-reps','sport-notes'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    setHTML('sport-activity-output', 'Formulario limpio. Puedes registrar una nueva sesión.');
  };

  window.renderSportModuleUrbis = function() {
    const profile = getProfile();
    if(profile) {
      const set = (id, value) => { const el = document.getElementById(id); if(el && value !== undefined && value !== null) el.value = value; };
      set('sport-age', profile.edad || '');
      set('sport-weight', profile.peso || '');
      set('sport-height', profile.estatura || '');
      set('sport-goal', profile.objetivo || 'resistencia');
      set('sport-level', profile.nivel || 'principiante');
    }
    renderProfile(profile);
    renderRoutine(profile);
    renderMetrics();
    window.actualizarCamposActividadUrbis();
  };




  function syncSportModuleHeader() {
    const k = document.getElementById('module-focus-kicker');
    const t = document.getElementById('module-focus-title');
    const s = document.getElementById('module-focus-subtitle');
    if(k) k.textContent = 'Modo deportivo';
    if(t) t.textContent = 'Deporte';
    if(s) s.textContent = 'Actividad física, rutas, rutina, progreso e historial con una experiencia enfocada al entrenamiento.';
  }

  const STORAGE_RUNNER_HISTORY = 'urbis_runner_history_v2';
  let runnerState = {
    active: false,
    startAt: 0,
    elapsedSec: 0,
    timer: null,
    watchId: null,
    points: [],
    distanceKm: 0,
    lastPoint: null,
    pendingSession: null,
    heatVisible: false,
    mapLayers: [],
    selectedKind: 'correr',
    currentView: 'home',
    photoDraft: null
  };

  function labelForRunnerKind(kind) {
    return ({ correr:'Correr', caminar:'Caminar', senderismo:'Senderismo' })[kind] || 'Correr';
  }
  function getRunnerHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_RUNNER_HISTORY) || '[]'); }
    catch(e) { return []; }
  }
  function saveRunnerHistory(items) {
    localStorage.setItem(STORAGE_RUNNER_HISTORY, JSON.stringify(items.slice(-120)));
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function haversine(a, b) {
    if(!a || !b) return 0;
    const toRad = d => d * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const aa = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(aa));
  }
  function clearRunnerMapLayers() {
    try {
      (runnerState.mapLayers || []).forEach(layer => {
        try { if(layer && window.map && map.hasLayer(layer)) map.removeLayer(layer); } catch(e) {}
      });
    } catch(e) {}
    runnerState.mapLayers = [];
  }
  function drawRunnerPath(points, opts = {}) {
    clearRunnerMapLayers();
    if(!window.map || !window.L || !points || points.length < 2) return;
    const latlngs = points.map(p => [p.lat, p.lng]);
    const halo = L.polyline(latlngs, { color:'#ff6a3b', weight: 26, opacity: .08, lineCap:'round', lineJoin:'round' }).addTo(map);
    const glow = L.polyline(latlngs, { color:'#ff7d45', weight: 14, opacity: .18, lineCap:'round', lineJoin:'round' }).addTo(map);
    const main = L.polyline(latlngs, { color:'#ff6f3c', weight: 8, opacity: .98, lineCap:'round', lineJoin:'round' }).addTo(map);
    const core = L.polyline(latlngs, { color:'#ffd8bf', weight: 3, opacity: .94, lineCap:'round', lineJoin:'round' }).addTo(map);
    const first = points[0], last = points[points.length - 1];
    const start = L.circleMarker([first.lat, first.lng], { radius: 8, color:'#fff3ea', weight:2, fillColor:'#ff6f3c', fillOpacity: 1 }).addTo(map);
    const end = L.circleMarker([last.lat, last.lng], { radius: 8, color:'#fff8f1', weight:2, fillColor:'#ffb148', fillOpacity: 1 }).addTo(map);
    runnerState.mapLayers.push(halo, glow, main, core, start, end);
    if(opts.fit !== false) {
      try { map.fitBounds(main.getBounds(), { padding:[34,34], maxZoom: 17 }); } catch(e) {}
    }
  }
  function renderRunnerHeatmap() {
    clearRunnerMapLayers();
    if(!runnerState.heatVisible || !window.map || !window.L) return;
    const history = getRunnerHistory();
    const pts = history.flatMap(h => Array.isArray(h.points) ? h.points.filter((_,i)=> i % 4 === 0) : []);
    if(!pts.length) {
      const out = document.getElementById('runner-map-status');
      if(out) out.textContent = 'Aún no hay recorridos suficientes para mostrar calor runner.';
      return;
    }
    pts.forEach(p => {
      const dot = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        color: 'rgba(255,135,66,.18)',
        weight: 0,
        fillColor: '#ff7b39',
        fillOpacity: .16
      }).addTo(map);
      runnerState.mapLayers.push(dot);
    });
    const out = document.getElementById('runner-map-status');
    if(out) out.textContent = 'Mapa de calor runner activo. Muestra zonas donde más se usan rutas deportivas en este dispositivo.';
  }
  function updateRunnerLive() {
    const time = runnerState.active ? Math.floor((Date.now() - runnerState.startAt)/1000) : (runnerState.elapsedSec || 0);
    const dist = runnerState.distanceKm || 0;
    const pace = dist > 0 ? (time / 60) / dist : 0;
    const speed = time > 0 ? dist / (time / 3600) : 0;
    setHTML('runner-live-time', fmtTime(time));
    setHTML('runner-live-distance', `${dist.toFixed(2)} km`);
    setHTML('runner-live-pace', dist > 0 ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2,'0')} min/km` : '--');
    setHTML('runner-live-speed', `${speed.toFixed(1)} km/h`);
  }
  function weeklyStreakInfo(history) {
    if(!history.length) return { weeks: 0 };
    const weekKeys = [...new Set(history.map(h => {
      const d = new Date(h.createdAt || h.savedAt || Date.now());
      const jan1 = new Date(d.getFullYear(),0,1);
      const diff = Math.floor((d - jan1) / 86400000);
      const week = Math.ceil((diff + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${week}`;
    }))].sort();
    return { weeks: weekKeys.length };
  }
  function resetRunnerPhotoDraft() {
    runnerState.photoDraft = null;
    const input = document.getElementById('runner-save-photo-file');
    if(input) input.value = '';
    const prev = document.getElementById('runner-photo-preview');
    if(prev) prev.innerHTML = 'Puedes subir una foto desde tu celular o computador.';
  }
  function resetRunnerStartFlow() {
    const startStage = document.getElementById('runner-start-stage');
    const typeStage = document.getElementById('runner-type-stage');
    if(startStage) startStage.hidden = false;
    if(typeStage) typeStage.hidden = true;
    window.selectRunnerKindUrbis(runnerState.selectedKind || 'correr');
  }
  function setRunnerView(view) {
    const home = document.getElementById('sport-runner-home');
    const views = document.querySelectorAll('.sport-runner-view');
    if(view === 'home') {
      if(home) home.hidden = false;
      views.forEach(v => v.hidden = true);
      runnerState.currentView = 'home';
      return;
    }
    if(home) home.hidden = true;
    views.forEach(v => v.hidden = (v.id !== `sport-runner-view-${view}`));
    runnerState.currentView = view;
    if(view === 'runner') resetRunnerStartFlow();
    if(view === 'user') renderRunnerUserSummary();
    if(view === 'history') {
      renderRunnerHistory();
      renderRunnerPRs();
      renderRunnerShareCard(runnerState.pendingSession);
    }
    if(view === 'live') updateRunnerLive();
    setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 120);
  }
  function renderRunnerUserSummary() {
    const profile = getProfile();
    const cont = document.getElementById('runner-user-summary');
    if(cont) {
      if(!profile) cont.innerHTML = 'No hay perfil deportivo guardado. Completa tu perfil para personalizar la experiencia runner.';
      else cont.innerHTML = `
        <b>${etiquetaObjetivo(profile.objetivo)}</b><br>
        Nivel: <b>${profile.nivel}</b> · Edad: <b>${profile.edad || '—'}</b><br>
        Peso: <b>${profile.peso || '—'} kg</b> · Estatura: <b>${profile.estatura || '—'} cm</b><br>
        IMC referencial: <b>${calcularIMC(profile.peso, profile.estatura).toFixed(1)}</b>
      `;
    }
    const streak = weeklyStreakInfo(getRunnerHistory());
    const out = document.getElementById('runner-streak-summary');
    if(out) {
      out.innerHTML = streak.weeks
        ? `Has registrado actividad en <b>${streak.weeks} semana(s)</b>.<br><span style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;background:rgba(255,110,48,.12);border:1px solid rgba(255,130,70,.22);margin-top:10px;">🍃 <b style="color:#ffb148;">Insignia runner · ${streak.weeks} semana(s)</b></span>`
        : 'Aún no hay semanas activas registradas. Empieza tu primer recorrido y URBIS contará tu constancia.';
    }
  }
  function renderRunnerPRs() {
    const items = getRunnerHistory();
    const out = document.getElementById('runner-pr-output');
    if(!out) return;
    if(!items.length) {
      out.textContent = 'Aún no hay récords personales guardados.';
      return;
    }
    const bestDistance = items.reduce((m, i) => Math.max(m, Number(i.distanceKm)||0), 0);
    const bestSpeed = items.reduce((m, i) => Math.max(m, Number(i.speedAvg)||0), 0);
    const bestDuration = items.reduce((m, i) => Math.max(m, Number(i.elapsedSec)||0), 0);
    out.innerHTML = `
      <div class="sport-progress-grid">
        <div class="sport-metric"><span>Mejor distancia</span><strong>${bestDistance.toFixed(2)} km</strong></div>
        <div class="sport-metric"><span>Mejor velocidad</span><strong>${bestSpeed.toFixed(1)} km/h</strong></div>
        <div class="sport-metric"><span>Mayor duración</span><strong>${fmtTime(bestDuration)}</strong></div>
      </div>
    `;
  }
  function renderRunnerHistory() {
    const history = getRunnerHistory();
    const cont = document.getElementById('runner-history-output');
    if(!cont) return;
    if(!history.length) {
      cont.innerHTML = 'Aún no hay recorridos guardados.';
      return;
    }
    const bestDistance = Math.max(...history.map(h => Number(h.distanceKm)||0), 0);
    const bestDuration = Math.max(...history.map(h => Number(h.elapsedSec)||0), 0);
    const bestSpeed = Math.max(...history.map(h => Number(h.speedAvg)||0), 0);
    cont.innerHTML = history.slice().reverse().map(h => {
      const badges = [];
      if((Number(h.distanceKm)||0) >= bestDistance && bestDistance > 0) badges.push('PR distancia');
      if((Number(h.elapsedSec)||0) >= bestDuration && bestDuration > 0) badges.push('PR duración');
      if((Number(h.speedAvg)||0) >= bestSpeed && bestSpeed > 0) badges.push('PR velocidad');
      return `
      <div class="runner-history-item">
        ${h.photo ? `<img src="${h.photo}" alt="Portada ${h.title || 'runner'}" style="width:100%;height:120px;object-fit:cover;border-radius:14px;margin-bottom:10px;">` : (h.photoName ? `<div class="runner-photo-name">📷 ${h.photoName}</div>` : '')}
        <h5>${h.title || 'Actividad runner'}</h5>
        <small>${h.kindLabel || h.kind || 'correr'} · ${new Date(h.createdAt || Date.now()).toLocaleString()}</small>
        <div style="margin-top:8px;line-height:1.5;">
          <b>${(Number(h.distanceKm)||0).toFixed(2)} km</b> · ${fmtTime(h.elapsedSec||0)} · ${(Number(h.speedAvg)||0).toFixed(1)} km/h<br>
          <span>Ubicación aprox.: ${h.locationLabel || 'Trayecto urbano guardado'}</span>
        </div>
        <div class="runner-history-badges">${badges.map(b => `<span>${b}</span>`).join('')}</div>
      </div>`;
    }).join('');
  }
  function renderRunnerShareCard(session) {
    const out = document.getElementById('runner-share-output');
    if(!out) return;
    if(!session) {
      out.textContent = 'Cuando guardes una actividad, aquí verás una tarjeta visual de tu recorrido.';
      return;
    }
    out.innerHTML = `
      <div class="runner-history-item">
        ${session.photo ? `<img src="${session.photo}" alt="Portada ${session.title || 'recorrido'}" style="width:100%;height:140px;object-fit:cover;border-radius:14px;margin-bottom:10px;">` : (session.photoName ? `<div class="runner-photo-name">📷 ${session.photoName}</div>` : '')}
        <h5>${session.title || 'Mi recorrido URBIS'}</h5>
        <div style="font-size:.95rem;line-height:1.6;">
          <b>${session.kindLabel}</b> · ${session.distanceKm.toFixed(2)} km · ${fmtTime(session.elapsedSec)}<br>
          Ritmo medio: ${(session.paceMinKm || 0).toFixed(2)} min/km · Velocidad media: ${(session.speedAvg || 0).toFixed(1)} km/h<br>
          ${session.notes ? `Nota: ${session.notes}<br>` : ''}
          Mensaje sugerido: “Completé ${session.distanceKm.toFixed(2)} km con URBIS en ${session.locationLabel || 'mi ciudad'}”.
        </div>
      </div>`;
  }

  window.abrirModoRunnerUrbis = function() {
    document.body.classList.add('sport-runner-active');
    syncSportModuleHeader();
    const mode = document.getElementById('sport-runner-mode');
    if(mode) mode.hidden = false;
    resetRunnerStartFlow();
    setRunnerView('home');
    renderRunnerUserSummary();
    renderRunnerHistory();
    renderRunnerPRs();
    renderRunnerShareCard(runnerState.pendingSession);
    updateRunnerLive();
    setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 100);
  };
  window.cerrarModoRunnerUrbis = function() {
    if(runnerState.active) window.stopRunnerSessionUrbis();
    document.body.classList.remove('sport-runner-active');
    document.body.classList.remove('runner-session-active');
    const mode = document.getElementById('sport-runner-mode');
    if(mode) mode.hidden = true;
    clearRunnerMapLayers();
    runnerState.heatVisible = false;
    const out = document.getElementById('runner-map-status');
    if(out) out.textContent = 'Mapa claro activo. El mapa de calor usa los recorridos guardados en este dispositivo.';
  };
  window.abrirVistaRunnerUrbis = function(view) {
    setRunnerView(view);
  };
  window.volverInicioRunnerUrbis = function() {
    if(runnerState.active) return;
    setRunnerView('home');
  };
  window.mostrarTipoRunnerUrbis = function() {
    const startStage = document.getElementById('runner-start-stage');
    const typeStage = document.getElementById('runner-type-stage');
    if(startStage) startStage.hidden = true;
    if(typeStage) typeStage.hidden = false;
  };
  window.volverEtapaInicioRunnerUrbis = function() {
    resetRunnerStartFlow();
  };
  window.selectRunnerKindUrbis = function(kind) {
    runnerState.selectedKind = kind || 'correr';
    document.querySelectorAll('.runner-kind-card').forEach(btn => btn.classList.toggle('active', btn.dataset.runnerKind === runnerState.selectedKind));
  };
  window.confirmarInicioRunnerUrbis = function() {
    window.startRunnerSessionUrbis();
  };
  window.setRunnerMapStyleUrbis = function(style) {
    if(typeof window.cambiarMapaBase === 'function') {
      if(style === 'dark') cambiarMapaBase('carto_dark');
      else if(style === 'sat') cambiarMapaBase('esri_sat');
      else cambiarMapaBase('carto_light');
    }
    const out = document.getElementById('runner-map-status');
    if(out) out.textContent = style === 'dark' ? 'Mapa oscuro activo.' : style === 'sat' ? 'Mapa satelital activo.' : 'Mapa claro activo.';
  };
  window.toggleRunnerHeatmapUrbis = function() {
    runnerState.heatVisible = !runnerState.heatVisible;
    if(runnerState.heatVisible) renderRunnerHeatmap();
    else if(runnerState.active && runnerState.points.length > 1) drawRunnerPath(runnerState.points, { fit: false });
    else {
      clearRunnerMapLayers();
      const out = document.getElementById('runner-map-status');
      if(out) out.textContent = 'Mapa de calor runner oculto.';
    }
  };
  window.startRunnerSessionUrbis = function() {
    if(runnerState.active) return;
    runnerState.active = true;
    runnerState.startAt = Date.now();
    runnerState.elapsedSec = 0;
    runnerState.points = [];
    runnerState.distanceKm = 0;
    runnerState.lastPoint = null;
    runnerState.pendingSession = null;
    clearRunnerMapLayers();
    const saveCard = document.getElementById('runner-save-card');
    if(saveCard) saveCard.style.display = 'none';
    const stopBtn = document.getElementById('runner-stop-btn');
    if(stopBtn) stopBtn.disabled = false;
    const out = document.getElementById('runner-session-status');
    if(out) out.innerHTML = `<b>${labelForRunnerKind(runnerState.selectedKind)} en curso.</b> GPS activo y recorrido naranja registrándose en tiempo real.`;
    document.body.classList.add('runner-session-active');
    setRunnerView('live');
    runnerState.timer = setInterval(updateRunnerLive, 1000);
    updateRunnerLive();

    const pushPoint = (lat, lng) => {
      const p = { lat, lng, t: Date.now() };
      if(runnerState.lastPoint) {
        const jump = haversine(runnerState.lastPoint, p);
        if(jump < 0.25) runnerState.distanceKm += jump;
      }
      runnerState.points.push(p);
      runnerState.lastPoint = p;
      updateRunnerLive();
      if(runnerState.points.length > 1 && !runnerState.heatVisible) drawRunnerPath(runnerState.points, { fit: true });
    };

    const seed = (typeof userMarker !== 'undefined' && userMarker && userMarker.getLatLng) ? userMarker.getLatLng() : (window.map ? map.getCenter() : null);
    if(seed) pushPoint(seed.lat, seed.lng);

    if(navigator.geolocation) {
      runnerState.watchId = navigator.geolocation.watchPosition(pos => {
        pushPoint(pos.coords.latitude, pos.coords.longitude);
        if(out && runnerState.points.length > 1) out.innerHTML = `<b>${labelForRunnerKind(runnerState.selectedKind)} en curso.</b> Registro en vivo activo.`;
      }, err => {
        if(out) out.innerHTML = `<b>${labelForRunnerKind(runnerState.selectedKind)} en curso.</b> No se pudo leer el GPS en vivo. La prueba seguirá con la ruta local disponible.`;
      }, { enableHighAccuracy: true, maximumAge: 1500, timeout: 9000 });
    }
  };
  window.stopRunnerSessionUrbis = function() {
    if(!runnerState.active) return;
    runnerState.active = false;
    document.body.classList.remove('runner-session-active');
    runnerState.elapsedSec = Math.floor((Date.now() - runnerState.startAt)/1000);
    if(runnerState.timer) clearInterval(runnerState.timer);
    runnerState.timer = null;
    if(runnerState.watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(runnerState.watchId);
    runnerState.watchId = null;
    const dist = runnerState.distanceKm || 0;
    const elapsed = runnerState.elapsedSec || 0;
    const pace = dist > 0 ? (elapsed / 60) / dist : 0;
    const speed = elapsed > 0 ? dist / (elapsed / 3600) : 0;
    runnerState.pendingSession = {
      kind: runnerState.selectedKind || 'correr',
      kindLabel: labelForRunnerKind(runnerState.selectedKind || 'correr'),
      elapsedSec: elapsed,
      distanceKm: dist,
      paceMinKm: pace,
      speedAvg: speed,
      points: [...runnerState.points],
      locationLabel: runnerState.points[0] ? `${runnerState.points[0].lat.toFixed(4)}, ${runnerState.points[0].lng.toFixed(4)}` : 'Ruta local',
      createdAt: new Date().toISOString()
    };
    const out = document.getElementById('runner-session-status');
    if(out) out.innerHTML = `<b>Actividad finalizada.</b> ${dist.toFixed(2)} km · ${fmtTime(elapsed)} · ${speed.toFixed(1)} km/h.`;
    const saveCard = document.getElementById('runner-save-card');
    if(saveCard) saveCard.style.display = 'block';
    const saveSummary = document.getElementById('runner-save-summary');
    if(saveSummary) saveSummary.innerHTML = `<b>${runnerState.pendingSession.kindLabel}</b> · ${dist.toFixed(2)} km · ${fmtTime(elapsed)} · ${(pace || 0).toFixed(2)} min/km`;
    const stopBtn = document.getElementById('runner-stop-btn');
    if(stopBtn) stopBtn.disabled = true;
    renderRunnerShareCard(runnerState.pendingSession);
    renderRunnerPRs();
    updateRunnerLive();
    setRunnerView('history');
  };
  function resizeRunnerPhotoToThumb(file, cb) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 720;
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Mantener la miniatura liviana para localStorage y móvil.
        while(dataUrl.length > 420000 && quality > 0.42) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        cb(null, dataUrl);
      };
      img.onerror = () => cb(new Error('No se pudo leer la imagen'));
      img.src = reader.result;
    };
    reader.onerror = () => cb(new Error('No se pudo abrir el archivo'));
    reader.readAsDataURL(file);
  }

  window.handleRunnerPhotoFileUrbis = function(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    const prev = document.getElementById('runner-photo-preview');
    if(!file) {
      resetRunnerPhotoDraft();
      return;
    }
    if(!file.type || !file.type.startsWith('image/')) {
      runnerState.photoDraft = null;
      if(prev) prev.innerHTML = 'El archivo seleccionado no parece ser una imagen.';
      return;
    }
    runnerState.photoDraft = { name: file.name, dataUrl: null };
    if(prev) prev.innerHTML = `Procesando miniatura de <b>${file.name}</b>...`;
    resizeRunnerPhotoToThumb(file, (err, dataUrl) => {
      if(err || !dataUrl) {
        runnerState.photoDraft = { name: file.name, dataUrl: null };
        if(prev) prev.innerHTML = `Foto seleccionada: <b>${file.name}</b><br><small>No se pudo generar miniatura, pero se conservará el nombre del archivo.</small>`;
        return;
      }
      runnerState.photoDraft = { name: file.name, dataUrl };
      if(prev) {
        prev.innerHTML = `
          <div class="runner-photo-thumb-wrap">
            <img src="${dataUrl}" alt="Miniatura de portada">
            <small>Miniatura lista: <b>${file.name}</b></small>
          </div>
        `;
      }
    });
  };

  window.saveRunnerSessionUrbis = function() {
    if(!runnerState.pendingSession) return;
    const history = getRunnerHistory();
    const session = {
      ...runnerState.pendingSession,
      id: Date.now(),
      title: val('runner-save-title') || `${runnerState.pendingSession.kindLabel} URBIS`,
      notes: val('runner-save-notes'),
      photo: runnerState.photoDraft && runnerState.photoDraft.dataUrl ? runnerState.photoDraft.dataUrl : '',
      photoName: runnerState.photoDraft ? runnerState.photoDraft.name : '',
      savedAt: new Date().toISOString()
    };
    history.push(session);
    saveRunnerHistory(history);
    renderRunnerHistory();
    renderRunnerPRs();
    renderRunnerUserSummary();
    renderRunnerShareCard(session);
    if(typeof showAchievementToast === 'function') showAchievementToast('Runner guardado', `Sesión guardada: ${session.title}`);
    const titleEl = document.getElementById('runner-save-title');
    const notesEl = document.getElementById('runner-save-notes');
    if(titleEl) titleEl.value = '';
    if(notesEl) notesEl.value = '';
    resetRunnerPhotoDraft();
    const saveCard = document.getElementById('runner-save-card');
    if(saveCard) saveCard.style.display = 'none';
    runnerState.pendingSession = null;
    const out = document.getElementById('runner-session-status');
    if(out) out.innerHTML = '<b>Recorrido guardado.</b> Ya puedes revisar historial, PR y tu tarjeta del trayecto.';
  };
  window.discardRunnerSessionUrbis = function() {
    runnerState.pendingSession = null;
    const saveCard = document.getElementById('runner-save-card');
    if(saveCard) saveCard.style.display = 'none';
    renderRunnerShareCard(null);
    resetRunnerPhotoDraft();
  };
  const originalRenderSport = window.renderSportModuleUrbis;
  window.renderSportModuleUrbis = function() {
    if(typeof originalRenderSport === 'function') originalRenderSport();
    if(document.body.getAttribute('data-active-module') === 'sport') syncSportModuleHeader();
    renderRunnerUserSummary();
    renderRunnerHistory();
    renderRunnerPRs();
    renderRunnerShareCard(runnerState.pendingSession);
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.renderSportModuleUrbis, 120);
  });
})();
