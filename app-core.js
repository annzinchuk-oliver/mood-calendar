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
