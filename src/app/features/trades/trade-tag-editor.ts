import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ToastService } from '../../shared/ui/toast';
import { MAX_TAGS_PER_TRADE, MAX_TAG_LENGTH } from './data/manual-tags.model';
import { ManualTagsStore } from './manual-tags-store';

let sequence = 0;

/**
 * Ручные теги сделки в панели разбора: чипы с крестиком и поле «+ тег» с
 * подсказками из уже использованных тегов. Enter или запятая — добавить.
 */
@Component({
  selector: 'app-trade-tag-editor',
  template: `
    <div class="tags" role="list" aria-label="Теги сделки">
      @for (tag of tags(); track tag) {
        <span class="tj-chip" role="listitem">
          {{ tag }}
          <button type="button" class="remove" [attr.aria-label]="'Убрать тег ' + tag" (click)="remove(tag)">×</button>
        </span>
      }
      @if (tags().length < maxTags) {
        <input
          #field
          type="text"
          class="add"
          placeholder="+ тег"
          aria-label="Добавить тег"
          autocomplete="off"
          [attr.list]="listId"
          [attr.maxlength]="maxLength + 1"
          (keydown)="typed($event, field)"
          (change)="pickedFromList(field)"
        />
        <datalist [id]="listId">
          @for (s of suggestions(); track s) {
            <option [value]="s"></option>
          }
        </datalist>
      }
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    .tags {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .remove {
      appearance: none;
      margin: 0 -3px 0 4px;
      padding: 0 2px;
      border: none;
      background: none;
      color: var(--fg-subtle);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;

      &:hover { color: var(--danger-fg); }
      @include focus-ring($offset: 1px);
    }

    .add {
      width: 96px;
      height: 22px;
      padding: 0 8px;
      border: 1px dashed var(--border-default);
      border-radius: $radius-full;
      background: transparent;
      color: var(--fg-default);
      font: 500 12px $font-sans;

      &::placeholder { color: var(--fg-subtle); }
      &:focus { outline: none; border-style: solid; border-color: var(--accent-fg); width: 160px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeTagEditor {
  private readonly store = inject(ManualTagsStore);
  private readonly toast = inject(ToastService);

  readonly tradeId = input.required<string>();

  protected readonly listId = `trade-tags-${++sequence}`;
  protected readonly maxTags = MAX_TAGS_PER_TRADE;
  protected readonly maxLength = MAX_TAG_LENGTH;
  protected readonly tags = computed(() => this.store.byTrade().get(this.tradeId()) ?? []);
  /** Уже использованные теги, которых у сделки нет, — частые первыми. */
  protected readonly suggestions = computed(() => {
    const own = new Set(this.tags());
    return this.store
      .usage()
      .map((u) => u.tag)
      .filter((tag) => !own.has(tag))
      .slice(0, 40);
  });

  protected typed(event: KeyboardEvent, field: HTMLInputElement): void {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    this.addFrom(field);
  }

  /** Выбор из подсказок браузера приходит событием change без Enter. */
  protected pickedFromList(field: HTMLInputElement): void {
    if (this.suggestions().includes(field.value.trim().toLowerCase())) this.addFrom(field);
  }

  protected remove(tag: string): void {
    this.store.remove(this.tradeId(), tag);
  }

  private addFrom(field: HTMLInputElement): void {
    if (!field.value.trim()) return;
    switch (this.store.add(this.tradeId(), field.value)) {
      case 'added':
      case 'exists':
        field.value = '';
        break;
      case 'invalid':
        this.toast.info(`Тег — от 1 до ${MAX_TAG_LENGTH} символов`);
        break;
      case 'too-many':
        this.toast.info(`У сделки уже ${MAX_TAGS_PER_TRADE} тегов`);
        break;
      case 'storage-full':
        this.toast.error('Место под теги в профиле закончилось — уберите старые теги');
        break;
    }
  }
}
