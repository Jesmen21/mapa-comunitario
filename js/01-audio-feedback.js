// ==========================================
  // SINTETIZADOR DE AUDIO (FEEDBACK MULTISENSORIAL)
  // ==========================================
  function playDropSound() {
      try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(300, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1); 
          gainNode.gain.setValueAtTime(0.8, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
      } catch (e) { console.log("Audio not supported"); }
  }

  function playSuccessSound() {
      try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.05);

          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
      } catch (e) { console.log("Audio not supported"); }
  }

  // Toque "cute" para seleccionar un módulo del inicio: dos notas suaves y
  // rápidas (boop-beep ascendente), volumen bajo para que sea agradable y no
  // invasivo. Se reutiliza un solo AudioContext para no crear uno por toque.
  let _urbisTapCtx = null;
  function playCuteTap() {
      try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          if (!_urbisTapCtx) _urbisTapCtx = new AudioContext();
          const ctx = _urbisTapCtx;
          if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
          const t0 = ctx.currentTime;
          const notas = [
              { f: 660, start: 0,    dur: 0.09 },
              { f: 990, start: 0.07, dur: 0.12 }
          ];
          notas.forEach(n => {
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(n.f, t0 + n.start);
              g.gain.setValueAtTime(0.0001, t0 + n.start);
              g.gain.exponentialRampToValueAtTime(0.16, t0 + n.start + 0.012);
              g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur);
              osc.connect(g); g.connect(ctx.destination);
              osc.start(t0 + n.start);
              osc.stop(t0 + n.start + n.dur + 0.02);
          });
      } catch (e) { /* audio no soportado: silencio */ }
  }
  window.playCuteTap = playCuteTap;
