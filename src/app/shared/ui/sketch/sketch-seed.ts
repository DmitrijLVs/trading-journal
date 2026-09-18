/**
 * Детерминированный seed для rough.js из строки (id виджета, id вкладки).
 * Один и тот же элемент всегда рисуется одинаково, штрихи не «дрожат»
 * при перерисовке на ресайз.
 */
export function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 2147483646) + 1;
}
