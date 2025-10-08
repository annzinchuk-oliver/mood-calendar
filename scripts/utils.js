// scripts/utils.js
(function (w) {
  // Не переобъявляем, если уже есть
  if (!w.getCSSVariable) {
    w.getCSSVariable = function(name, el = document.documentElement) {
      const v = getComputedStyle(el).getPropertyValue(name);
      return v ? v.trim() : '';
    };
  }

  if (!w.setTheme) {
    w.setTheme = function(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    };
  }

  if (!w.getTheme) {
    w.getTheme = function() {
      return document.documentElement.getAttribute('data-theme') || 'light';
    };
  }
})(window);
