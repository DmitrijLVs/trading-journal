import { Mood } from '../../trades/data/trade.model';

/** Запись дневника на календарный день (YYYY-MM-DD). */
export interface JournalEntry {
  date: string;
  note: string;
  mood: Mood | null;
  /** Чек-лист дисциплины: соблюдал ли план в этот день. */
  followedPlan: boolean | null;
}

export function journalDateKey(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
