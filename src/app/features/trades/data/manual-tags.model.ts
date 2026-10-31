/**
 * Ручные теги сделок — то, что трейдер пишет сам: сетап, стратегия, ошибка
 * («пробой», «новости», «вход без плана»). Автотеги тренера — отдельно, в
 * analytics/data/behavior.ts.
 *
 * TODO(release): временное хранилище. API платформы тегов не умеет, поэтому они
 * лежат в разделе профиля `/config/widgets/journal` (лимит раздела — 64 КБ,
 * общий с дисциплиной и закрытыми неделями). Перед релизом теги должны уехать
 * в Journal-Service (поле у сделки + фильтр в `/journal/trades`), а этот формат —
 * мигрировать туда один раз. См. «Перед релизом» в CLAUDE.md.
 */

/** Сделка → её теги (в нижнем регистре, без «#»). */
export type ManualTags = ReadonlyMap<string, readonly string[]>;

/**
 * Как теги лежат в профиле: словарь имён и индексы в нём — так влезает
 * в несколько раз больше размеченных сделок, чем при именах у каждой.
 */
export interface StoredManualTags {
  v: 1;
  /** Имена тегов. */
  n: string[];
  /** id сделки → индексы в `n`. */
  t: Record<string, number[]>;
}

export const MAX_TAG_LENGTH = 32;
export const MAX_TAGS_PER_TRADE = 8;
/** Лимит раздела профиля — 64 КБ; оставляем запас под дисциплину и закрытые недели. */
export const JOURNAL_CONFIG_BUDGET_BYTES = 60_000;

/** «  #Пробой  уровня » → «пробой уровня»; пустое или слишком длинное — null. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!tag || tag.length > MAX_TAG_LENGTH) return null;
  return tag;
}

/** Из профиля (что угодно) → карта; битые записи пропускаются. */
export function readManualTags(raw: unknown): ManualTags {
  const map = new Map<string, readonly string[]>();
  if (!raw || typeof raw !== 'object') return map;
  const stored = raw as Partial<StoredManualTags>;
  const names = Array.isArray(stored.n) ? stored.n : [];
  const byTrade = stored.t && typeof stored.t === 'object' ? stored.t : {};
  for (const [id, indices] of Object.entries(byTrade)) {
    if (!Array.isArray(indices)) continue;
    const tags = indices
      .map((i) => names[i])
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
    if (tags.length > 0) map.set(id, [...new Set(tags)]);
  }
  return map;
}

/** Карта → формат профиля; имена — по частоте, чтобы частым достались короткие индексы. */
export function encodeManualTags(tags: ManualTags): StoredManualTags {
  const names = tagUsage(tags).map((u) => u.tag);
  const index = new Map(names.map((name, i) => [name, i]));
  const t: Record<string, number[]> = {};
  for (const [id, list] of tags) {
    if (list.length > 0) t[id] = list.map((name) => index.get(name) ?? 0);
  }
  return { v: 1, n: names, t };
}

export function withTag(tags: ManualTags, tradeId: string, tag: string): ManualTags {
  const current = tags.get(tradeId) ?? [];
  if (current.includes(tag)) return tags;
  const next = new Map(tags);
  next.set(tradeId, [...current, tag]);
  return next;
}

export function withoutTag(tags: ManualTags, tradeId: string, tag: string): ManualTags {
  const current = tags.get(tradeId) ?? [];
  if (!current.includes(tag)) return tags;
  const next = new Map(tags);
  const rest = current.filter((t) => t !== tag);
  if (rest.length > 0) next.set(tradeId, rest);
  else next.delete(tradeId);
  return next;
}

export interface TagUsage {
  tag: string;
  count: number;
}

/** Теги по числу сделок, затем по алфавиту — для подсказок и фильтра. */
export function tagUsage(tags: ManualTags): TagUsage[] {
  const counts = new Map<string, number>();
  for (const list of tags.values()) for (const tag of list) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ru'));
}

/** Размер JSON в байтах UTF-8 — так его считает сервер (кириллица — 2 байта). */
export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** Фильтр таблицы по ручному тегу хранится как «#тег», по автотегу — его кодом. */
export const MANUAL_TAG_PREFIX = '#';

export function manualTagFilter(tag: string): string {
  return MANUAL_TAG_PREFIX + tag;
}

export function manualTagOfFilter(value: string | undefined): string | null {
  return value?.startsWith(MANUAL_TAG_PREFIX) ? value.slice(MANUAL_TAG_PREFIX.length) : null;
}
