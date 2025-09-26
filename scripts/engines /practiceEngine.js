(function () {
  // Публичное API: PracticeEngine.openById('478')
  window.PracticeEngine = {
    openById(id) {
      const cfg = (window.PRACTICES || []).find(p => p.id === id);
      if (!cfg) return console.warn("[practice] not found", id);
      openModal(cfg);
    }
  };

  let timer = null;
  let state = null;

  function openModal(cfg) {
    state = { cfg, running: false, cycle: 0, step: 0 };
    // заголовки
    setText('therapyTitle',   cfg.title);
    setText('therapySubtitle',cfg.subtitle);
    setPhase("Готовы?"); setTime("00"); setHint(""); setRing(0);

    // кнопки
    byId('therapyStartBtn').onclick = start;
    byId('therapyStopBtn').onclick  = stop;

    // показать модалку
    byId('therapyPopup').classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function start() {
    stop(); // safety
    state.running = true;
    const { cfg } = state;
    if (cfg.type === "timer") { state.cycle = 0; runTimerCycle(); }
    else if (cfg.type === "steps") { state.step = 0; showStep(); }
  }

  function stop() {
    state && (state.running = false);
    if (timer) { clearInterval(timer); timer = null; }
    setHint(""); setPhase("Пауза"); setRing(0);
  }

  // === timer-практики (фазы × циклы)
  function runTimerCycle() {
    const { cfg } = state;
    if (!state.running) return;
    if (state.cycle >= (cfg.cycles || 1)) {
      setPhase("Готово!"); setTime(""); setHint("Отлично ✨"); setRing(360);
      return;
    }
    let i = 0;

    const runPhase = () => {
      if (!state.running) return;
      if (i >= cfg.phases.length) { state.cycle++; setTimeout(runTimerCycle, 300); return; }

      const phase = cfg.phases[i++];
      setPhase(`${phase.name} (цикл ${state.cycle + 1}/${cfg.cycles || 1})`);
      setHint(phase.hint || ""); setRing(0);

      let left = phase.seconds;
      setTime(left);
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (!state.running) return clearInterval(timer);
        left--;
        setTime(Math.max(left,0));
        const done = (phase.seconds - left) / phase.seconds;
        setRing(Math.min(360 * done, 360));
        if (left <= 0) { clearInterval(timer); setRing(360); setTimeout(runPhase, 200); }
      }, 1000);
    };
    runPhase();
  }

  // === step-практики (пошаговые подсказки)
  function showStep() {
    const { cfg } = state;
    if (!state.running) return;
    if (state.step >= cfg.steps.length) {
      setPhase("Готово!"); setTime(""); setHint("Вы молодец ✨"); setRing(360); return;
    }
    setPhase(`Шаг ${state.step + 1}/${cfg.steps.length}`);
    setHint(cfg.steps[state.step]); setTime("—"); setRing(0);

    const startBtn = byId('therapyStartBtn');
    startBtn.textContent = (state.step < cfg.steps.length - 1) ? "Далее" : "Завершить";
    startBtn.onclick = () => { state.step++; showStep(); };
  }

  // helpers (UI)
  function setPhase(t){ setText('thermoPhase', t); }
  function setTime(v){  setText('thermoTime',  String(v).padStart(2,"0")); }
  function setHint(t){  setText('therapyHint', t || ""); }
  function setRing(deg){
    const ring = byId('thermoRing'); if (!ring) return;
    const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
    ring.style.background = `conic-gradient(${brand} ${deg}deg, rgba(0,0,0,0.08) 0)`;
  }
  function setText(id, txt){ const el = byId(id); if (el) el.textContent = txt; }
  function byId(id){ return document.getElementById(id); }

  // Экспорт закрытия (используется из кнопки «Закрыть»)
  window.closeTherapy = function(){
    stop();
    byId('therapyPopup')?.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };
})();
