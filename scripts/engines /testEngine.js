(function(){
  // Публичное API: TestEngine.openById('phq2')
  window.TestEngine = {
    openById(id){
      const cfg = (window.TESTS || []).find(t => t.id === id);
      if (!cfg) { console.warn('[test] not found', id); return; }
      render(cfg);
    }
  };

  function render(cfg){
    // заголовки
    setText('testTitle', cfg.title || 'Тест');
    setText('testDesc',  cfg.description || '');

    // контент
    const host = byId('testFormHost'); host.innerHTML = '';
    cfg.questions.forEach((q, qi) => {
      const block = document.createElement('div');
      block.className = 'card test-card';
      block.innerHTML = `
        <div class="test-question">${q}</div>
        <div class="test-options">
          ${cfg.scale.map((opt, oi) => `
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="radio" name="q${qi}" value="${oi}">
              <span>${opt}</span>
            </label>`).join('')}
        </div>`;
      host.appendChild(block);
    });

    byId('testSubmitBtn').onclick = () => submit(cfg);
    byId('testCancelBtn').onclick = closeTest;

    // показать модалку
    byId('testPopup').classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function submit(cfg){
    let sum = 0, answered = 0;
    cfg.questions.forEach((_, qi) => {
      const v = document.querySelector(`input[name="q${qi}"]:checked`)?.value;
      if (v != null) { answered++; sum += (cfg.scoring?.[v] ?? 0); }
    });
    if (answered < cfg.questions.length) { alert('Ответьте на все вопросы.'); return; }

    const result = (typeof cfg.resultText === 'function') ? cfg.resultText(sum) : `Ваш результат: ${sum}`;
    alert(`${cfg.title}\nСумма баллов: ${sum}\n${result}`);
    closeTest();
  }

  // helpers
  function setText(id, txt){ const el = byId(id); if (el) el.textContent = txt; }
  function byId(id){ return document.getElementById(id); }
  window.closeTest = function(){
    byId('testPopup')?.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };
})();

