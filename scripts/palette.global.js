// scripts/palette.global.js
(function (global) {
  const MAX_ABS = 50;

  // РОВНО ТВОИ HEX (от тёмного к светлому)
  const BLUE_STEPS  = ['#104fcd', '#1259e7', '#296aee', '#437df0', '#5e8ff2']; // -50..-10
  const GREEN_STEPS = ['#1b9744', '#20b351', '#25d05e', '#3adc70', '#56e184']; // +50..+10
  const NEUTRAL_YELLOW = '#CDAA4A'; // 0

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // 0..4: 0 — самый тёмный, 4 — самый светлый. Для 0 возвращаем null.
  function bucketIndex(totalRaw) {
    const total = clamp(totalRaw, -MAX_ABS, MAX_ABS);
    if (total === 0) return null;
    const b = Math.ceil(Math.abs(total) / 10); // 1..5
    return 5 - b; // 4..0
  }

  // Главная функция: HEX по значению [-50..50]
  function moodColor(totalRaw) {
    const idx = bucketIndex(totalRaw);
    if (idx === null) return NEUTRAL_YELLOW;
    return totalRaw > 0 ? GREEN_STEPS[idx] : BLUE_STEPS[idx];
  }

  const api = { MAX_ABS, BLUE_STEPS, GREEN_STEPS, NEUTRAL_YELLOW, bucketIndex, moodColor };

  // Глобально (для браузера)
  global.Palette = api;

  // На всякий — поддержка CommonJS (если вдруг где-то потребуется)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(window);
