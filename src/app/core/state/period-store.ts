import { Injectable, computed, effect, signal } from '@angular/core';

export type PeriodPreset = '7d' | '30d' | '90d' | 'ytd' | '1y' | 'all' | 'custom';

export interface PeriodRange {
  fromMs: number | null;
  toMs: number | null;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '90d': '90 дней',
  ytd: 'С начала года',
  '1y': 'Год',
  all: 'Всё время',
  custom: 'Диапазон',
};

const STORAGE_KEY = 'tj.period';

/** Глобальный период анализа — общий для дашборда, сделок и журнала. */
@Injectable({ providedIn: 'root' })
export class PeriodStore {
  private readonly _preset = signal<PeriodPreset>('90d');
  private readonly _customFrom = signal<string | null>(null); // YYYY-MM-DD
  private readonly _customTo = signal<string | null>(null);

  readonly preset = this._preset.asReadonly();
  readonly customFrom = this._customFrom.asReadonly();
  readonly customTo = this._customTo.asReadonly();

  readonly range = computed<PeriodRange>(() => {
    const preset = this._preset();
    if (preset === 'custom') {
      const from = this._customFrom();
      const to = this._customTo();
      return {
        fromMs: from ? new Date(`${from}T00:00:00Z`).getTime() : null,
        toMs: to ? new Date(`${to}T23:59:59Z`).getTime() : null,
      };
    }
    return presetRange(preset);
  });

  readonly label = computed(() => {
    const preset = this._preset();
    if (preset !== 'custom') return PERIOD_LABELS[preset];
    const from = this._customFrom();
    const to = this._customTo();
    if (from && to) return `${shortDate(from)} — ${shortDate(to)}`;
    if (from) return `с ${shortDate(from)}`;
    if (to) return `по ${shortDate(to)}`;
    return PERIOD_LABELS.custom;
  });

  constructor() {
    this.restore();
    effect(() => {
      const state = { preset: this._preset(), from: this._customFrom(), to: this._customTo() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // приватный режим — пропускаем
      }
    });
  }

  setPreset(preset: PeriodPreset): void {
    this._preset.set(preset);
  }

  setCustomRange(from: string | null, to: string | null): void {
    this._customFrom.set(from);
    this._customTo.set(to);
    this._preset.set('custom');
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as { preset?: PeriodPreset; from?: string | null; to?: string | null };
      if (state.preset && state.preset in PERIOD_LABELS) this._preset.set(state.preset);
      this._customFrom.set(state.from ?? null);
      this._customTo.set(state.to ?? null);
    } catch {
      // повреждённое хранилище — остаёмся на дефолте
    }
  }
}

/** Диапазон пресета относительно «сейчас» (для пер-виджетных периодов). */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>): PeriodRange {
  const now = Date.now();
  const day = 86_400_000;
  switch (preset) {
    case '7d':
      return { fromMs: now - 7 * day, toMs: null };
    case '30d':
      return { fromMs: now - 30 * day, toMs: null };
    case '90d':
      return { fromMs: now - 90 * day, toMs: null };
    case '1y':
      return { fromMs: now - 365 * day, toMs: null };
    case 'ytd':
      return { fromMs: Date.UTC(new Date().getUTCFullYear(), 0, 1), toMs: null };
    case 'all':
      return { fromMs: null, toMs: null };
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
