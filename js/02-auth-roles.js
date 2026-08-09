// ==========================================
  // SISTEMA DE ROLES, REGISTRO Y DATOS GLOBALES
  // ==========================================
  let userRole = ''; 
  let userNameGlobal = ''; 
  let userCedulaGlobal = '';
  let userEmailGlobal = '';
  let userUsernameGlobal = '';
  let userBarrioGlobal = '';
  let userPhoneGlobal = '';
  let userGenderGlobal = 'femenino';
  let userBaseRoleGlobal = 'citizen';
  let userWellnessGlobal = 'prefiero-no-decir';
  let userMoodGlobal = 'normal';
  let globalData = [];

  // El módulo de login (js/41) es un IIFE aparte y solo puede escribir en window.*
  // Este hook —definido en el scope compartido— copia esa identidad a las
  // variables compartidas (userRole, userEmailGlobal...) que usan cargarPuntos,
  // visibleParaRol, esAutorDelReporte, etc. Sin esto, al INICIAR SESIÓN el mapa
  // queda vacío (userRole==='' hace que cargarPuntos retorne de inmediato).
  window.urbisSyncSharedIdentity = function() {
    try {
      const w = window;
      if(w.userRole)        userRole        = w.userRole;
      if(w.userNameGlobal)  userNameGlobal  = w.userNameGlobal;
      if(w.userCedulaGlobal)userCedulaGlobal= w.userCedulaGlobal;
      if(w.userEmailGlobal) userEmailGlobal = w.userEmailGlobal;
      if(w.userUsernameGlobal) userUsernameGlobal = w.userUsernameGlobal;
      if(w.userBarrioGlobal)userBarrioGlobal= w.userBarrioGlobal;
      if(w.userPhoneGlobal) userPhoneGlobal = w.userPhoneGlobal;
      if(w.userGenderGlobal)userGenderGlobal= w.userGenderGlobal;
      if(w.userBaseRoleGlobal) userBaseRoleGlobal = w.userBaseRoleGlobal;
    } catch(e){}
  };

  function simularGoogleAuth() {
      alert("🌐 MODO DESARROLLADOR: La interfaz visual está lista. En la siguiente fase conectaremos Firebase Authentication para que el inicio con Google funcione de verdad. Por ahora, llena tus datos manualmente abajo.");
  }

  function activarFeedbackUI() {
      try { if(navigator.vibrate) navigator.vibrate(8); } catch(e) {}
      try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if(!Ctx) return;
          if(!window.__urbisAudioCtx) window.__urbisAudioCtx = new Ctx();
          const ctx = window.__urbisAudioCtx;
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = 620; g.gain.value = 0.015;
          o.connect(g); g.connect(ctx.destination); o.start();
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
          o.stop(ctx.currentTime + 0.05);
      } catch(e) {}
  }

  function marcarAccesoSeleccionado(tipo) {
      const normalBtn = document.getElementById('btn-acceso-normal');
      const registerBtn = document.getElementById('btn-acceso-register');
      const adminBtn = document.getElementById('btn-acceso-admin');
      if(normalBtn) normalBtn.classList.toggle('active', tipo === 'normal' || tipo === 'login');
      if(registerBtn) registerBtn.classList.toggle('active', tipo === 'register');
      if(adminBtn) adminBtn.classList.toggle('active', tipo === 'admin');
  }

  function prepararPortadaInicial() {
      const normal = document.getElementById('normal-access-panel');
      const admin = document.getElementById('admin-access-panel');
      const adminLink = document.querySelector('.admin-link');
      if(normal) normal.style.display = '';
      if(admin) admin.style.display = 'none';
      if(adminLink) adminLink.style.display = 'none';
      document.body.classList.remove('urbis-auth-panel-open','urbis-auth-login-view','urbis-auth-registering');
      marcarAccesoSeleccionado('');
  }

  let perfilNormalSeleccionado = '';

  function mostrarAccesoNormal() {
      activarFeedbackUI();
      const normal = document.getElementById('normal-access-panel');
      const admin = document.getElementById('admin-access-panel');
      const adminLink = document.querySelector('.admin-link');
      document.body.classList.add('urbis-auth-panel-open','urbis-auth-login-view');
      if(normal) normal.style.display = 'block';
      if(admin) admin.style.display = 'none';
      if(adminLink) adminLink.style.display = 'none';
      marcarAccesoSeleccionado('login');
  }

  function seleccionarPerfilNormal(perfil) {
      activarFeedbackUI();
      // En la portada ya no se elige JAC/Educativo. Todo usuario normal entra como ciudadano.
      perfilNormalSeleccionado = 'citizen';
      const dataPanel = document.getElementById('normal-data-panel');
      const secretPanel = document.getElementById('normal-secret-panel');
      const submit = document.getElementById('normal-submit-btn');
      if(dataPanel) dataPanel.style.display = 'block';
      if(secretPanel) secretPanel.style.display = 'none';
      if(submit) submit.innerText = 'Ingresar como ciudadano';
  }

  function mostrarCajaGov() { mostrarAccesoNormal(); seleccionarPerfilNormal('gov'); }
  function mostrarCajaEdu() { mostrarAccesoNormal(); seleccionarPerfilNormal('edu'); }
  function mostrarCajaAdmin() { mostrarAccesoNormal(); }

  function usarDatosDemoCiudadano() {
      alert('El ingreso directo de pruebas fue desactivado por seguridad. Completa el registro ciudadano.');
      if(typeof window.URBIS_AUTH?.showCitizenRegistrationForm === 'function') window.URBIS_AUTH.showCitizenRegistrationForm();
  }

  function validarRegistro() {
      let nameInput = document.getElementById('reg-name').value.trim();
      let surnameInput = document.getElementById('reg-surname')?.value.trim() || '';
      let usernameInput = document.getElementById('reg-username')?.value.trim() || '';
      let docInput = document.getElementById('reg-doc-num').value.trim();
      let phoneInput = document.getElementById('reg-phone')?.value.trim() || '';
      let genderInput = document.getElementById('reg-gender')?.value || 'femenino';
      let emailInput = document.getElementById('reg-email').value.trim();
      let countryOption = document.getElementById('reg-country')?.value.trim() || 'Colombia';
      let otherCountryInput = document.getElementById('reg-country-other')?.value.trim() || '';
      let countryInput = countryOption === 'Otro país' ? otherCountryInput : countryOption;
      let deptInput = countryInput === 'Colombia' ? (document.getElementById('reg-department')?.value.trim() || '') : '';
      let cityInput = countryInput === 'Colombia' ? (document.getElementById('reg-city')?.value.trim() || '') : '';
      let barrioInput = countryInput === 'Colombia' ? (document.getElementById('reg-barrio')?.value.trim() || '') : '';

      // Seguridad: ya no se rellenan datos demo. El ciudadano debe registrar datos reales.
      if(!nameInput || !surnameInput || !usernameInput || !docInput || !phoneInput || !emailInput || !countryInput || (countryInput === 'Colombia' && (!deptInput || !cityInput || !barrioInput))){
          alert('Completa nombres, apellidos, usuario, documento, celular, correo y ubicación para continuar.');
          return false;
      }
      if(!/^[a-z0-9._-]{5,30}$/.test(usernameInput.toLowerCase())){
          alert('El nombre de usuario debe tener mínimo 5 caracteres.');
          return false;
      }
      userNameGlobal = (nameInput + ' ' + surnameInput).trim().replace(/\|/g, "-"); 
      userUsernameGlobal = usernameInput.replace(/\|/g, "-");
      userCedulaGlobal = (document.getElementById('reg-doc-type').value + " " + docInput).replace(/\|/g, "-");
      userPhoneGlobal = phoneInput.replace(/\|/g, "-");
      userGenderGlobal = (genderInput || 'femenino').replace(/\|/g, "-");
      userEmailGlobal = emailInput.replace(/\|/g, "-");
      userBarrioGlobal = [countryInput, deptInput, cityInput, barrioInput].filter(Boolean).join(' · ').replace(/\|/g, "-");
      userWellnessGlobal = 'prefiero-no-decir';
      userMoodGlobal = 'normal';
      userBaseRoleGlobal = 'citizen';
      return true;
  }

  function continuarPerfilNormal() {
      perfilNormalSeleccionado = 'citizen';
      if(!validarRegistro()) return;
      userRole = 'citizen';
      iniciarPlataforma();
  }

  function entrarDirectoPruebas() {
      usarDatosDemoCiudadano();
  }

  function entrarComoCiudadano() { continuarPerfilNormal(); }

  function intentarLoginGov() { activarSubmodoCiudadano('gov'); }

  function intentarLoginEdu() { activarSubmodoCiudadano('edu'); }

  function intentarLoginAdmin() {
      let nameInput = (document.getElementById('admin-name-optional')?.value || '').trim();
      userNameGlobal = nameInput !== '' ? nameInput.replace(/\|/g, "-") : 'Arquitecto (Admin)';
      userBarrioGlobal = 'Admin Central';
      userEmailGlobal = 'admin@urbis.com';
      userCedulaGlobal = 'ADMIN-001';
      userPhoneGlobal = '3000000001';
      userGenderGlobal = 'femenino';
      userBaseRoleGlobal = 'admin';
      
      const pass = document.getElementById('admin-pass').value;
      alert('Acceso administrador por clave local desactivado por seguridad. Usa autenticación del lado servidor.');
  }


  function actualizarBadgeRol() {
      const badge = document.getElementById('role-display');
      if(!badge) return;
      badge.className = 'role-badge';
      if(userRole === 'admin') { badge.innerText = 'MODO ARQUITECTO'; badge.classList.add('role-admin'); }
      else if(userRole === 'gov') { badge.innerText = 'CIUDADANO + JAC'; badge.classList.add('role-gov'); }
      else if(userRole === 'edu') { badge.innerText = 'CIUDADANO + EDU'; badge.classList.add('role-edu'); }
      else { badge.innerText = 'CIUDADANO'; badge.classList.add('role-citizen'); }
      const title = document.getElementById('profile-access-title');
      const desc = document.getElementById('profile-access-description');
      if(title) title.textContent = badge.innerText;
      if(desc) desc.textContent = userRole === 'gov'
        ? 'Tienes habilitadas funciones de JAC/funcionario mientras conservas tu perfil ciudadano.'
        : userRole === 'edu'
          ? 'Tienes habilitado el modo educativo y avanzado mientras conservas tu perfil ciudadano.'
          : 'Estás usando URBIS como ciudadano. Puedes solicitar permisos temporales de JAC o modo educativo.';
      const basic = document.getElementById('profile-basic-data');
      if(basic) {
          const genero = userGenderGlobal === 'femenino' ? 'Femenino / mujer'
              : userGenderGlobal === 'masculino' ? 'Masculino / hombre'
              : 'No registrado';
          basic.textContent = `Nombre: ${userNameGlobal || 'Sin registrar'} · Usuario: ${userUsernameGlobal || 'Sin registrar'} · Celular: ${userPhoneGlobal || 'Sin registrar'} · Barrio: ${userBarrioGlobal || 'Sin registrar'} · Género: ${genero}`;
      }
  }

  function aplicarPermisosRolActual(origen = '') {
      actualizarBadgeRol();
      document.body.dataset.role = userRole || 'citizen';
      const advancedBtn = document.getElementById('tab-btn-advanced');
      if(advancedBtn) advancedBtn.style.display = (userRole === 'admin' || userRole === 'edu') ? 'flex' : 'none';
      const statsBtn = document.getElementById('tab-btn-stats');
      if(statsBtn) statsBtn.style.display = userRole === 'citizen' ? 'none' : 'flex';
      if(typeof aplicarPerfilVisualPorRol === 'function') aplicarPerfilVisualPorRol();
      if(typeof aplicarPerfilCapasIniciales === 'function') aplicarPerfilCapasIniciales();
      if(typeof actualizarUIRutaReal === 'function') actualizarUIRutaReal();
      if(typeof renderTimeline === 'function') renderTimeline();
      if(origen && typeof setSidebarTab === 'function') setSidebarTab(origen);
  }

  function activarSubmodoCiudadano(modo) {
      const clave = prompt(modo === 'gov' ? 'Clave demo para habilitar JAC/funcionario:' : 'Clave demo para habilitar modo educativo:');
      if(clave === null) return;
      alert('Modo por clave local desactivado por seguridad.'); return;
      userRole = modo === 'gov' ? 'gov' : 'edu';
      if(typeof urbisRecordMetric === 'function') urbisRecordMetric(userRole === 'gov' ? 'govModeActivated' : 'eduModeActivated', 1);
      aplicarPermisosRolActual('access');
      playSuccessSound();
  }

  function volverAModoCiudadano() {
      userRole = 'citizen';
      aplicarPermisosRolActual('access');
  }

  function iniciarPlataforma() {
      const loginScreen = document.getElementById('login-screen');
      if(loginScreen){
          loginScreen.style.opacity = '0';
          setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
      }
      document.body.classList.remove('urbis-pre-login');
      try{ if(window.urbisInitProfileFab) window.urbisInitProfileFab(); }catch(e){}

      actualizarBadgeRol();
      document.body.dataset.role = userRole || 'citizen';
      const advancedBtn = document.getElementById('tab-btn-advanced');
      if(advancedBtn) advancedBtn.style.display = (userRole === 'admin' || userRole === 'edu') ? 'flex' : 'none';
      const statsBtn = document.getElementById('tab-btn-stats');
      if(statsBtn) statsBtn.style.display = userRole === 'citizen' ? 'none' : 'flex';
      if(typeof aplicarPerfilVisualPorRol === 'function') aplicarPerfilVisualPorRol();
      if(typeof aplicarPerfilCapasIniciales === 'function') aplicarPerfilCapasIniciales();
      
      actualizarUIRutaReal();
      if(typeof volverMenuModulos === 'function') {
          volverMenuModulos();
      } else {
          document.body.classList.remove('module-focused');
          document.body.setAttribute('data-active-module', 'menu');
      }
      cargarPuntos();
      // Auto-mapeo masivo (capa de análisis/usos de otras plataformas) DESACTIVADO
      // en móvil: el dispositivo solo muestra reportes y eventos. Para reactivarlo:
      // window.URBIS_CARGAR_AUTOMAPEO = true;
      setTimeout(() => {
          if(window.URBIS_CARGAR_AUTOMAPEO && userRole === 'admin' && typeof cargarAutoMapeoCucuta === 'function' && !autoMapeoAutoCargado) {
              cargarAutoMapeoCucuta(true);
          }
      }, 1100);
      if(typeof actualizarModoRendimientoPorZoom === 'function') actualizarModoRendimientoPorZoom();

      try {
          const mobileLike = (window.UrbisAppShell && window.UrbisAppShell.isMobile) || window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
          if(mobileLike){
              const mobileApp = document.getElementById('urbis-mobile-app');
              if(mobileApp){
                  mobileApp.style.display = 'block';
                  mobileApp.style.visibility = 'visible';
                  mobileApp.style.opacity = '1';
                  mobileApp.style.pointerEvents = 'auto';
              }
              const legacyNav = document.getElementById('urbis-mobile-bottom-nav');
              if(legacyNav) legacyNav.style.display = 'none';
              const openHome = () => {
                  if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function'){
                      window.UrbisMobileAppV58.show('home');
                      return true;
                  }
                  return false;
              };
              if(!openHome()){
                  setTimeout(openHome, 120);
                  setTimeout(openHome, 350);
                  setTimeout(openHome, 800);
              }
          }
      } catch(e) {}
  }
  document.addEventListener('DOMContentLoaded', () => {
      prepararPortadaInicial();
      document.body.addEventListener('click', (ev) => { if(ev.target.closest('button, .sidebar-tab-btn, .tab-btn, .map-toggle-btn, .admin-link, .tool-btn')) activarFeedbackUI(); });
  });

  window.switchTab = function(tabId) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active', 'active-red'));
      document.getElementById(tabId).classList.add('active');
      
      let btn = document.getElementById('btn-' + tabId);
      if(tabId === 'tab-rapido') { btn.classList.add('active-red'); }
      else { btn.classList.add('active'); }
  };


  function registrarCheckinBienestar() {
      const wellness = document.getElementById('profile-wellness')?.value || 'prefiero-no-decir';
      const mood = document.getElementById('profile-mood')?.value || 'normal';
      const note = (document.getElementById('profile-mood-note')?.value || '').trim();
      userWellnessGlobal = String(wellness).replace(/\|/g, '-');
      userMoodGlobal = String(mood).replace(/\|/g, '-');

      const log = {
          fecha: new Date().toISOString(),
          wellness: userWellnessGlobal,
          mood: userMoodGlobal,
          note: note.replace(/\|/g, '-'),
          barrio: userBarrioGlobal || 'Sin barrio'
      };
      try {
          const key = 'urbis_mood_logs_v1_' + (userEmailGlobal || userCedulaGlobal || 'demo').toLowerCase().replace(/[^a-z0-9@._-]+/g, '_');
          const prev = JSON.parse(localStorage.getItem(key) || '[]');
          prev.push(log);
          localStorage.setItem(key, JSON.stringify(prev.slice(-120)));
      } catch(e) { console.warn('No se pudo guardar bienestar local', e); }

      if(typeof urbisRecordMetric === 'function') {
          urbisRecordMetric('moodLogs', 1);
          if(['mal','muy-mal'].includes(userMoodGlobal)) urbisRecordMetric('lowMoodLogs', 1);
          if(note.length > 8) urbisRecordMetric('gratitudeNotes', 1);
          if(['sin-seguimiento','acompanamiento'].includes(userWellnessGlobal)) urbisRecordMetric('selfcareLogs', 1);
      }
      const status = document.getElementById('wellness-profile-status');
      if(status) status.textContent = 'Estado guardado para hoy: ' + document.getElementById('profile-mood')?.selectedOptions?.[0]?.textContent + '.';
      if(typeof playSuccessSound === 'function') playSuccessSound();
  }
  window.registrarCheckinBienestar = registrarCheckinBienestar;
