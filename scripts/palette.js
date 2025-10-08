// Диапазон суммарного балла дня
export const MAX_ABS = 50;

// Ровно твои коды, от тёмного к светлому
export const BLUE_STEPS  = ['#104fcd', '#1259e7', '#296aee', '#437df0', '#5e8ff2']; // -50..-10
export const GREEN_STEPS = ['#1b9744', '#20b351', '#25d05e', '#3adc70', '#56e184']; // +50..+10
export const NEUTRAL_YELLOW = '#fced9f'; // 0

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Возвращает индекс 0..4: 0=самый тёмный, 4=самый светлый */
export function bucketIndex(totalRaw) {
  const total = clamp(totalRaw, -MAX_ABS, MAX_ABS);
  if (total === 0) return null; // специальный случай

  const abs = Math.abs(total);
  // корзины: 1..5 для 10,20,30,40,50
  const bucket = Math.ceil(abs / 10);    // 1..5
  return 5 - bucket;                      // 4..0 => от светлого к тёмному
}

/** Цвет по сумме дня: HEX из фикс-ступеней */
export function moodColor(totalRaw) {
  const idx = bucketIndex(totalRaw);
  if (idx === null) return NEUTRAL_YELLOW;
  return totalRaw > 0 ? GREEN_STEPS[idx] : BLUE_STEPS[idx];
}
