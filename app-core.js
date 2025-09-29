/**
 * app-core.js
 * Core: EventBus, Store (persist + versioning), Hash Router.
 * Vanilla JS, без зависимостей.
 */

(function (window, document) {
  'use strict';

  // ===== Versioning =====
  const STORE_VERSION = 1;
  const STORE_KEY = 'appStore_v' + STORE_VERSION;

  // ===== Event Bus (pub/sub) =====
  const createEventBus = () => {
    const listeners = new Map(); // event -> Set(callback)
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
          try { cb(payload); } catch (e) { console.error('EventBus listener error', e); }
        }
      }
    };
  };

  // ===== Store with persist & selectors =====
  const createStore = (initial) => {
    // load persisted
    let state = (() => {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      return JSON.parse(JSON.stringify(initial));
    })();

    const subscribers = new Set();

    const notify = () => {
      for (const fn of subscribers) {
        try { fn(state); } catch (e) { console.error('subscriber error', e); }
      }
    };

    const persist = () => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
      catch (e) { console.warn('Persist failed', e); }
    };

    return {
      getState() { return state; },
      setState(patchOrFn, { silent = false } = {}) {
        const next = typeof patchOrFn === 'function' ? patchOrFn(state) : { ...state, ...patchOrFn };
        state = next;
        persist();
        if (!silent) notify();
      },
      update(path, value, { silent = false } = {}) {
        // update('profile.theme', 'dark')
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
  };

  // ===== Initial State =====
  const initialState = {
    version: STORE_VERSION,
    ui: {
      page: 'chat',   // 'chat' | 'practices' | 'tests' | 'settings' | 'sos' | 'profile' | 'stats' | 'calendar' | 'help'
      theme: 'auto'   // 'auto' | 'light' | 'dark' | 'brand'
    },
    profile: {
      language: 'ru',
      soundOn: true,
      averages: {},    // computed
      triggers: {},    // computed
      helps: []        // e.g. practices that helped
    },
    journal: [],       // {id, dateISO, text, mood?, tags?: string[], source?: 'chat'|'quick'|'practice'}
    testsResults: {
      phq2: []         // {dateISO, score, answers}
    },
    catalog: {
      tests: [],       // from JSON later
      practices: []    // from JSON later
    },
    settings: {
      reminders: []    // {id, type: 'daily'|'weekly', hour, minute, dow?: number[]}
    }
  };

  // ===== Theme helper =====
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  // ===== Router (hash-based) =====
  function showPage(id) {
    const pages = document.querySelectorAll('[data-page]');
    pages.forEach(p => {
      p.style.display = p.getAttribute('data-page') === id ? '' : 'none';
    });
  }

  function navigateTo(id) {
    if (!id) id = 'chat';
    if (location.hash !== '#' + id) {
      location.hash = id;
    }
    showPage(id);
    window.App.store.update('ui.page', id, { silent: true });
    window.App.bus.emit('route:change', id);
  }

  function handleHashChange() {
    const id = (location.hash || '#chat').slice(1);
    navigateTo(id);
  }

  // ===== Boot =====
  function boot() {
    const bus = createEventBus();
    const store = createStore(initialState);

    window.App = Object.freeze({ bus, store, navigateTo });

    // Theme watch
    applyTheme(store.getState().ui.theme);
    store.subscribe((s) => applyTheme(s.ui.theme));

    // Router
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // initial

    // Nav helpers: любой элемент с [data-nav="pageId"]
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-nav]');
      if (!el) return;
      const id = el.getAttribute('data-nav');
      e.preventDefault();
      navigateTo(id);
    });

    bus.emit('app:ready', null);
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window, document);
