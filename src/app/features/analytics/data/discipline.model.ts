/**
 * Правила дисциплины трейдера: по ним размечаются сделки (автотеги) и
 * срабатывают живые предупреждения. Задаются в «Настройки → Дисциплина».
 */
export interface DisciplineSettings {
  /** Дневной лимит убытка в $; null — не задан. */
  dailyLossLimit: number | null;
  /** Сколько сделок в день — норма; всё сверх неё — овертрейд. */
  maxTrades: number;
  /** После скольких убытков подряд нужна пауза. */
  pauseAfterLosses: number;
  /** Окно реванша, минут: повторный вход в ту же монету после убытка. */
  revengeMinutes: number;
}

export const DEFAULT_DISCIPLINE: DisciplineSettings = {
  dailyLossLimit: null,
  maxTrades: 25,
  pauseAfterLosses: 2,
  revengeMinutes: 10,
};

/** Поля из хранилища — только валидные числа, остальное — по умолчанию. */
export function sanitizeDiscipline(raw: unknown): DisciplineSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const positive = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  return {
    dailyLossLimit: positive(source['dailyLossLimit']),
    maxTrades: Math.round(positive(source['maxTrades']) ?? DEFAULT_DISCIPLINE.maxTrades),
    pauseAfterLosses: Math.round(
      positive(source['pauseAfterLosses']) ?? DEFAULT_DISCIPLINE.pauseAfterLosses,
    ),
    revengeMinutes: Math.round(positive(source['revengeMinutes']) ?? DEFAULT_DISCIPLINE.revengeMinutes),
  };
}
