/**
 * Закрытие недели или месяца: короткий вывод трейдера и самооценка. Хранится
 * в профиле (раздел `journal`, `{ reviews }`), поэтому длина вывода
 * ограничена — весь раздел не больше 64 КБ.
 */
export type ReviewGrade = 'plan' | 'mistakes' | 'tilt';

export const REVIEW_GRADE_LABELS: Record<ReviewGrade, string> = {
  plan: 'по плану',
  mistakes: 'были ошибки',
  tilt: 'тильт',
};

export interface PeriodReview {
  /** ISO-время закрытия. */
  closedAt: string;
  note: string;
  grade: ReviewGrade | null;
}

export type PeriodReviews = Readonly<Record<string, PeriodReview>>;

export const REVIEW_NOTE_MAX = 280;
/** Храним последние закрытия — история журнала всё равно 183 дня. */
const REVIEWS_MAX = 60;

const isGrade = (v: unknown): v is ReviewGrade => v === 'plan' || v === 'mistakes' || v === 'tilt';

/** Только валидные записи с ключами `w:YYYY-MM-DD` / `m:YYYY-MM`, самые свежие. */
export function sanitizeReviews(raw: unknown): PeriodReviews {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
    if (!/^(w:\d{4}-\d{2}-\d{2}|m:\d{4}-\d{2})$/.test(key) || !value || typeof value !== 'object') return [];
    const v = value as Record<string, unknown>;
    if (typeof v['closedAt'] !== 'string') return [];
    const review: PeriodReview = {
      closedAt: v['closedAt'],
      note: typeof v['note'] === 'string' ? v['note'].slice(0, REVIEW_NOTE_MAX) : '',
      grade: isGrade(v['grade']) ? v['grade'] : null,
    };
    return [[key, review] as const];
  });
  // Ключи сортируются как даты: оставляем последние.
  entries.sort(([a], [b]) => a.slice(2).localeCompare(b.slice(2)));
  return Object.fromEntries(entries.slice(-REVIEWS_MAX));
}
