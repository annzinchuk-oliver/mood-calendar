/* scripts/safe-prelude.js
 * Загружается САМЫМ ПЕРВЫМ. Даёт безопасные дефолты, чтобы ничего не падало
 * даже если дальнейшие скрипты подключены в любом порядке.
 */

/* ===== ТЕМА (безопасные реализации) ===== */
(function () {
  const THEME_KEY = 'THEME';

  // getTheme: вернуть сохранённую тему или 'light'
  if (typeof window.getTheme !== 'function') {
    window.getTheme = function getTheme() {
      try { return localStorage.getItem(THEME_KEY) || 'light'; }
      catch { return 'light'; }
    };
  }

  // setTheme: применить и сохранить
  if (typeof window.setTheme !== 'function') {
    window.setTheme = function setTheme(t) {
      try { localStorage.setItem(THEME_KEY, t); } catch {}
      document.documentElement.dataset.theme = t;
      // на случай использования классов:
      document.documentElement.classList.toggle('theme-dark', t === 'dark');
      document.documentElement.classList.toggle('theme-light', t !== 'dark');
    };
  }

  // applyTheme: совместимость со старым кодом
  if (typeof window.applyTheme !== 'function') {
    window.applyTheme = function applyTheme(t) { window.setTheme(t); };
  }

  // bootTheme: единоразовое применение при старте
  if (typeof window.bootTheme !== 'function') {
    window.bootTheme = function bootTheme() {
      const t = window.getTheme();
      window.setTheme(t);
    };
  }

  // применяем тему немедленно, чтобы верстка не прыгала
  try { window.bootTheme(); } catch {}
})();

/* ===== КОНСТАНТЫ СХЕМЫ (должны существовать ДО миграций) ===== */
(function () {
  if (typeof window.SCHEMA_KEY === 'undefined') {
    window.SCHEMA_KEY = 'mood.schema.v2';
  }
  if (typeof window.SCHEMA_VERSION === 'undefined') {
    window.SCHEMA_VERSION = 2;
  }
})();

// Глобальная "заглушка" на случай, если реальную функцию ещё не загрузили
if (typeof window.enableStatsSwipe !== 'function') {
  window.enableStatsSwipe = function enableStatsSwipe() {};
}
