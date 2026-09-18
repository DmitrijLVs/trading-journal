/**
 * Детерминированный ГПСЧ (mulberry32): один и тот же сид всегда даёт одну и
 * ту же вселенную мок-данных — перезагрузка страницы не «перерисовывает»
 * историю сделок.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Равномерное [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))];
  }

  /** Взвешенный выбор: [значение, вес][]. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  /** Несколько уникальных элементов. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    while (result.length < count && pool.length > 0) {
      const idx = Math.floor(this.next() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  /** Приблизительно нормальное (сумма трёх равномерных). */
  gaussian(mean = 0, stdDev = 1): number {
    const u = this.next() + this.next() + this.next();
    return mean + (u - 1.5) * 2 * stdDev;
  }
}

/** Числовой сид из строки (для генерации свечей по id сделки). */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
