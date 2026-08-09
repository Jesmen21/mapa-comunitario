(function(){
  const app = document.getElementById('urbis-mobile-app');
  if(!app) return;
  let history = ['home'];
  let selectedActivity = 'Correr';
  const screens = () => [...app.querySelectorAll('.u51-screen')];
  function show(screen, push=true){
    screens().forEach(s => s.classList.toggle('is-active', s.dataset.u51Screen === screen));
    app.querySelectorAll('.u51-bottom-nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.u51Go === screen || (screen !== 'home' && btn.dataset.u51Go === 'home' && false)));
    if(push && history[history.length-1] !== screen) history.push(screen);
    const active = app.querySelector(`[data-u51-screen="${screen}"]`);
    if(active) active.scrollTop = 0;
  }
  app.addEventListener('click', (ev)=>{
    const go = ev.target.closest('[data-u51-go]');
    if(go){ show(go.dataset.u51Go); return; }
    const back = ev.target.closest('[data-u51-back]');
    if(back){
      history.pop();
      show(history[history.length-1] || 'home', false);
      return;
    }
    const act = ev.target.closest('[data-u51-activity]');
    if(act){
      selectedActivity = act.dataset.u51Activity;
      app.querySelectorAll('.u51-activity').forEach(b=>b.classList.toggle('active', b === act));
    }
  });
  window.UrbisMobileApp = { show, getActivity:()=>selectedActivity };
})();
