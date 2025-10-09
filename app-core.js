/**
 * Core logic for Mood Calendar: event bus, state management and simple router.
 *
 * The purpose of this module is to expose a global `App` object with a
 * persistent store and a basic pub/sub system. It also provides simple
 * navigation helpers which update the UI by toggling visibility of elements
 * annotated with `data-page` attributes.
 *
 * Usage:
 *   App.store.update('ui.theme', 'dark');
 *   const state = App.store.getState();
 *   App.bus.emit('event:name', payload);
 *   App.bus.on('event:name', handler);
 *   App.navigateTo('pageId');
 */

(function (window, document) {
  'use strict';

  // Current version of the persisted store. Bump this when you change the
  // structure of the initial state to force a reset of localStorage.
  const STORE_VERSION = 1;
  const STORE_KEY = 'appStore_v' + STORE_VERSION;

  /**
   * Very small event bus. Allows you to subscribe to and emit events.
   */
  function createEventBus() {
    const listeners = new Map();
    return {
      on(event, cb) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(cb);
        return () => this.off(event, cb);
      },
      off(event, cb) {
        if (!listeners.has(event)) return;
        listeners.get(event).delete(cb);
      },
      emit(event, payload) {
        if (!listeners.has(event)) return;
        for (const cb of listeners.get(event)) {
          try { cb(payload); } catch (err) { console.error(err); }
        }
      }
    };
  }

  /**
   * Create a store with a persistent state. The store will merge patches
   * into its internal state and notify subscribers when changes occur.
   */
  function createStore(initialState) {
    // Attempt to load persisted state; fall back to initialState clone if none.
    let state;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      state = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(initialState));
    } catch (err) {
      state = JSON.parse(JSON.stringify(initialState));
    }
    const subscribers = new Set();

    function persist() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn('Failed to persist state', err);
      }
    }

    function notify() {
      subscribers.forEach((fn) => {
        try { fn(state); } catch (err) { console.error(err); }
      });
    }

    return {
      getState() { return state; },
      /**
       * Update a deep key in the state. Accepts a dot-separated path.
       * Optionally suppress notifications (silent) to batch updates.
       */
      update(path, value, { silent = false } = {}) {
        const parts = path.split('.');
        const next = structuredClone(state);
        let node = next;
        for (let i = 0; i < parts.length - 1; i++) {
          const key = parts[i];
          if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
          node = node[key];
        }
        node[parts[parts.length - 1]] = value;
        state = next;
        persist();
        if (!silent) notify();
      },
      subscribe(fn) {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      }
    };
  }

  // Baseline initial state for the application. You can extend this as the
  // application grows; bump STORE_VERSION when you make incompatible changes.
  const initialState = {
    version: STORE_VERSION,
    ui: {
      page: 'calendar',
      theme: 'auto'
    },
    profile: {
      language: 'ru',
      soundOn: true,
      averages: {},
      triggers: {},
      helps: []
    },
    journal: [],
    testsResults: {
      phq2: []
    },
    catalog: {
      tests: [],
      practices: []
    },
    settings: {
      reminders: []
    }
  };

  /**
   * Apply a theme by setting the `data-theme` attribute on the root element.
   */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  /**
   * Show only the page matching the given identifier. Pages should be marked
   * with a `data-page` attribute whose value matches the id.
   */
  function showPage(id) {
    const pages = document.querySelectorAll('[data-page]');
    pages.forEach((el) => {
      if (el.getAttribute('data-page') === id) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  }

  /**
   * Navigate to a page id. Updates the hash and persists page in store.
   */
  function navigateTo(id) {
    // default fallback
    if (!id) id = 'calendar';
    if (location.hash !== '#' + id) {
      location.hash = id;
    }
    showPage(id);
    store.update('ui.page', id, { silent: true });
    bus.emit('route:change', id);
  }

  function handleHashChange() {
    const id = (location.hash || '#calendar').slice(1);
    navigateTo(id);
  }

  // Create bus and store at module initialisation time so they are ready
  const bus = createEventBus();
  const store = createStore(initialState);

  // Expose the App object globally. Use Object.freeze to prevent tampering.
  window.App = Object.freeze({ bus, store, navigateTo });

  // Apply the persisted or initial theme immediately.
  applyTheme(store.getState().ui.theme);
  // Subscribe to store updates and apply theme changes automatically.
  store.subscribe((state) => applyTheme(state.ui.theme));

  // Boot the router when DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.addEventListener('hashchange', handleHashChange);
      handleHashChange();
      bus.emit('app:ready');
    });
  } else {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    bus.emit('app:ready');
  }

  // Allow navigation via elements with data-nav attributes.
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (!nav) return;
    const id = nav.getAttribute('data-nav');
    if (id) {
      e.preventDefault();
      navigateTo(id);
    }
  });

})(window, document);

// ======== Статистика: состояние ========
let statsModalOpen = false;
let overallRange = '3d';
let yScaleMode = 'auto'; // 'auto' | 'fixed'
let hourlyChart = null;

const RANGE_LABELS = { '3d':'3 дня', '7d':'Неделя', '1m':'Месяц', 'all':'Все время' };

// ======== Открыть / закрыть модалку ========
function openStatsModal() {
  const modal = document.getElementById('stats-modal');
  if (!modal) return;
  modal.removeAttribute('hidden');
  modal.setAttribute('aria-hidden', 'false');
  statsModalOpen = true;

  // инициализация табов
  initOverallRangeTabs();
  // дефолт: авто масштаб
  initScaleToggle();

  // рендер «сегодня» и «общая статистика»
  renderTodayHourlyChart();
  renderOverallStats();
}

function closeStatsModal() {
  const modal = document.getElementById('stats-modal');
  if (!modal) return;
  modal.setAttribute('hidden', '');
  modal.setAttribute('aria-hidden', 'true');
  statsModalOpen = false;

  // чистим график
  if (hourlyChart && typeof hourlyChart.destroy === 'function') {
    hourlyChart.destroy();
    hourlyChart = null;
    }
  }

// обработчик нижней кнопки "Закрыть"
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-modal]')) {
    closeStatsModal();
  }
});

// ======== Диапазон дат для общей статистики ========
function getDateKeysForRange(rangeKey){
  const allKeys = Object.keys(window.moodData || {}).sort(); // 'YYYY-MM-DD'
  if (!allKeys.length) return [];
  if (rangeKey === 'all') return allKeys;

  const now = new Date();
  const from = new Date(now);
  if (rangeKey === '3d') from.setDate(from.getDate() - 2);
  if (rangeKey === '7d') from.setDate(from.getDate() - 6);
  if (rangeKey === '1m') from.setMonth(from.getMonth() - 1);

  const fromStr = from.toISOString().slice(0,10);
  return allKeys.filter(k => k >= fromStr);
}

// ======== Агрегация и карточка общей статистики ========
function aggregateRange(dateKeys) {
  let total = 0, zeroCnt = 0, activeDays = 0;
  let posCnt = 0, negCnt = 0, posSum = 0, negSum = 0;

  for (const k of dateKeys) {
    const arr = (window.moodData?.[k] ?? []);
    if (arr.length) activeDays++;
    total += arr.length;
    for (const e of arr) {
      const v = Number(e.score) || 0;
      if (v > 0) { posCnt++; posSum += v; }
      else if (v < 0) { negCnt++; negSum += v; }
      else { zeroCnt++; }
    }
  }

  const considered = posCnt + negCnt;
  const positiveShare = considered ? Math.round((posCnt / considered) * 100) : 0;
  const negativeShare = considered ? (100 - positiveShare) : 0;
  return {
    totalEntries: total,
    zeroEntries: zeroCnt,
    activeDays,
    entriesPerDay: activeDays ? total / activeDays : 0,
    positiveShare, negativeShare,
    balanceSum: posSum + negSum
  };
}

function buildOverallStatsHTML(dateKeys) {
  const s = aggregateRange(dateKeys);
  const sign = s.balanceSum > 0 ? '+' : (s.balanceSum < 0 ? '−' : '');
  return `
    <div class="stats-grid">
      <div class="row two">
        <div class="metric"><div class="label">Доля позитива</div><div class="value">${s.positiveShare}%</div></div>
        <div class="metric"><div class="label">Доля негатива</div><div class="value">${s.negativeShare}%</div></div>
      </div>
      <hr />
      <div class="row three">
        <div class="metric"><div class="label">Баланс настроения</div><div class="value">${s.balanceSum === 0 ? '0' : (sign + Math.abs(s.balanceSum))}</div></div>
        <div class="metric"><div class="label">Записей в день</div><div class="value">${s.entriesPerDay.toFixed(1)}</div></div>
        <div class="metric"><div class="label">Активных дней</div><div class="value">${s.activeDays}</div></div>
      </div>
      <div class="footnote">Всего записей: ${s.totalEntries}${s.zeroEntries ? ` · 0-балльных: ${s.zeroEntries} (не в процентах)` : ''}</div>
    </div>`;
}

// стили для карточки (минимальные, если их нет)
const styleBlockId = 'stats-grid-inline-style';
if (!document.getElementById(styleBlockId)) {
  const s = document.createElement('style');
  s.id = styleBlockId;
  s.textContent = `
  .stats-grid .row { display:grid; gap:12px; }
  .stats-grid .row.two { grid-template-columns: 1fr 1fr; }
  .stats-grid .row.three { grid-template-columns: repeat(3, 1fr); }
  .stats-grid .metric .label { color: var(--text-secondary, #6b7280); font-size:12px; }
  .stats-grid .metric .value { font-weight:700; font-size:20px; }
  .stats-grid .footnote { margin-top:8px; color:var(--text-secondary, #6b7280); font-size:12px; text-align:center; }
  @media (max-width:420px){ .stats-grid .row.three { grid-template-columns: 1fr 1fr; } }
  `;
  document.head.appendChild(s);
}

function renderOverallStats(){
  const labelEl = document.getElementById('overall-range-label');
  if (labelEl) labelEl.textContent = RANGE_LABELS[overallRange] || '';
  const dateKeys = getDateKeysForRange(overallRange);
  const container = document.getElementById('overall-stats-body');
  if (container) container.innerHTML = buildOverallStatsHTML(dateKeys);
}

function initOverallRangeTabs(){
  const tabsRoot = document.getElementById('overall-range-tabs');
  if (!tabsRoot) return;
  if (!tabsRoot.dataset.bound) {
    tabsRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('button.tab');
      if (!btn) return;
      const newRange = btn.dataset.range;
      if (!newRange || newRange === overallRange) return;
      overallRange = newRange;
      tabsRoot.querySelectorAll('.tab').forEach(b => {
        const active = b.dataset.range === overallRange;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderOverallStats();
    });
    tabsRoot.dataset.bound = '1';
  }

  tabsRoot.querySelectorAll('.tab').forEach(b => {
    const active = b.dataset.range === overallRange;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

// ======== «Сегодня по часам» (Chart.js, фолбэк, фиксы оси X) ========
function renderTodayHourlyChart(){
  // агрегируем сегодня
  const todayKey = new Date().toISOString().slice(0,10);
  const entries = (window.moodData?.[todayKey] ?? []);
  const hourlyTotals = Array(24).fill(0);
  const hourHasData = Array(24).fill(false);
  const hourlyEntriesList = Array.from({length:24}, () => []);
  for (const e of entries) {
    const h = Number(e.hour) || 0;
    const v = Number(e.score) || 0;
    hourlyTotals[h] += v;
    hourHasData[h] = true;
    hourlyEntriesList[h].push(e);
  }

  // агрегаты
  const totalSum = entries.reduce((s,e) => s + (Number(e.score)||0), 0);
  const avg = entries.length ? (totalSum / entries.length) : 0;
  let peakHour = null, peakVal = 0;
  hourlyTotals.forEach((v,h) => { if (Math.abs(v) > Math.abs(peakVal)) { peakVal=v; peakHour=h; } });
  const sign = totalSum>0?'+':(totalSum<0?'−':'');
  const peakDisp = peakHour===null ? '—' : `${String(peakHour).padStart(2,'0')}:00 (${peakVal>0?'+':''}${peakVal})`;

  const elAvg = document.getElementById('agg-avg');
  const elSum = document.getElementById('agg-sum');
  const elPeak= document.getElementById('agg-peak');
  if (elAvg) elAvg.textContent = avg.toFixed(1);
  if (elSum) elSum.textContent = `${sign}${Math.abs(totalSum)}`;
  if (elPeak) elPeak.textContent = peakDisp;

  // если Chart.js недоступен — выходим без ошибки
  if (typeof window.Chart !== 'function') return;

  // вычисление шага подписей X (фикс «гряды»)
  function computeLabelStep() {
    const wrap = document.getElementById('today-hourly');
    const w = wrap?.clientWidth || window.innerWidth;
    if (w < 340) return 4;
    if (w < 420) return 3;
    if (w < 560) return 2;
    return 1;
  }

  const labelStep = computeLabelStep();

  // палитра
  const isDark = document.documentElement.classList.contains('theme-dark');

  // уничтожаем предыдущий график
  if (hourlyChart && typeof hourlyChart.destroy === 'function') hourlyChart.destroy();

  const canvas = document.getElementById('hourly-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  hourlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length:24}, (_,h)=>h),
      datasets: [{
        data: hourlyTotals,
        backgroundColor: hourlyTotals.map((total, h) => {
          if (!hourHasData[h]) return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
          return (window.Palette?.moodColor?.(total)) || (total>=0?'#22c55e':'#3b82f6');
        }),
        borderColor: hourlyTotals.map((total, h) => {
          if (!hourHasData[h]) return isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
          return (window.Palette?.moodColor?.(total)) || (total>=0?'#22c55e':'#3b82f6');
        }),
        borderWidth: hourlyTotals.map((_,h)=> hourHasData[h]?0:1 ),
      }]
    },
   options: {
      animation: false,
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(ctx){ return `${ctx[0].label}:00`; },
            label(ctx){
              const hour = ctx.dataIndex;
              const total = ctx.parsed.y;
              const arr = hourlyEntriesList[hour];
              if (!arr.length) return `${total} (нет записей)`;
              if (arr.length === 1) {
                const n = arr[0].note ? ` — "${arr[0].note}"` : '';
                return `${total>0?'+':''}${total}${n}`;
              }
              return `${total>0?'+':''}${total} (${arr.length} записей)`;
            }
          }
        }
      },
      scales: {
        x: {
          offset: true,
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: false,
            padding: 6,
            color: isDark ? '#9AA0A6' : '#5f6368',
            callback(val){ return (Number(val) % labelStep === 0) ? `${val}:00` : ''; }
          }
        },
        y: {
          beginAtZero: true,
          min: yScaleMode==='fixed' ? -50 : undefined,
          max: yScaleMode==='fixed' ?  50 : undefined,
          ticks: { color: isDark ? '#9AA0A6' : '#5f6368', stepSize: yScaleMode==='fixed' ? 10 : undefined },
          grid: {
            color: (ctx) => ctx.tick.value===0
              ? (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)')
              : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
            lineWidth: (ctx) => ctx.tick.value===0 ? 1 : .5
          }
        }
      }
    }
  });
}

// переключатель масштаба
function initScaleToggle(){
  const root = document.querySelector('.scale-toggle');
  if (!root) return;
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const mode = btn.dataset.scale; // 'auto' | 'fixed'
    if (!mode || mode === yScaleMode) return;
    yScaleMode = mode;
    root.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.scale===mode));
    renderTodayHourlyChart(); // перерисовать с новым масштабом
  });
}

// (опционально) экспорт в глобал, если открытие по кнопке снаружи
window.openStatsModal = openStatsModal;
window.closeStatsModal = closeStatsModal;
