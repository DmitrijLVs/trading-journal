import { Injectable, computed, inject } from '@angular/core';
import { JournalConfigStore } from '../../core/config/journal-config-store';
import {
  JOURNAL_CONFIG_BUDGET_BYTES,
  MAX_TAGS_PER_TRADE,
  ManualTags,
  encodeManualTags,
  jsonBytes,
  normalizeTag,
  readManualTags,
  tagUsage,
  withTag,
  withoutTag,
} from './data/manual-tags.model';

/** Почему тег не добавился — компонент показывает это пользователю. */
export type AddTagResult = 'added' | 'exists' | 'invalid' | 'too-many' | 'storage-full';

/**
 * Ручные теги сделок. Живут в разделе профиля `journal` (`{ tags }`) рядом с
 * дисциплиной и закрытыми неделями — один владелец раздела, JournalConfigStore.
 *
 * TODO(release): перенести в Journal-Service — см. data/manual-tags.model.ts.
 */
@Injectable({ providedIn: 'root' })
export class ManualTagsStore {
  private readonly config = inject(JournalConfigStore);

  /** Сделка → теги. */
  readonly byTrade = computed<ManualTags>(() => readManualTags(this.config.state().tags));
  /** Все теги по частоте — подсказки и фильтр. */
  readonly usage = computed(() => tagUsage(this.byTrade()));
  /** Доля лимита профиля, занятая разделом (0…1) — показываем, когда подходит к концу. */
  readonly storageShare = computed(() => jsonBytes(this.config.state()) / JOURNAL_CONFIG_BUDGET_BYTES);

  tagsOf(tradeId: string): readonly string[] {
    return this.byTrade().get(tradeId) ?? [];
  }

  add(tradeId: string, raw: string): AddTagResult {
    const tag = normalizeTag(raw);
    if (!tag) return 'invalid';
    const current = this.tagsOf(tradeId);
    if (current.includes(tag)) return 'exists';
    if (current.length >= MAX_TAGS_PER_TRADE) return 'too-many';
    const next = encodeManualTags(withTag(this.byTrade(), tradeId, tag));
    // Сервер отвергает раздел больше 64 КБ — тогда теги жили бы только в этом браузере.
    if (jsonBytes({ ...this.config.state(), tags: next }) > JOURNAL_CONFIG_BUDGET_BYTES) {
      return 'storage-full';
    }
    this.config.patch({ tags: next });
    return 'added';
  }

  remove(tradeId: string, tag: string): void {
    const next = withoutTag(this.byTrade(), tradeId, tag);
    if (next !== this.byTrade()) this.config.patch({ tags: encodeManualTags(next) });
  }
}
