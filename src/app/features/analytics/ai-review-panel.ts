import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { AiReviewStore } from './ai-review-store';

/**
 * «Разбор от ИИ» сделки или дня: кнопка → ожидание → вывод тренера (заголовок
 * почерком), 2–4 предложения и что сделать дальше. Факты собирает родитель
 * через стор по событию `run` — панель только показывает состояние по ключу.
 */
@Component({
  selector: 'app-ai-review-panel',
  imports: [Button, Icon],
  template: `
    @switch (state().status) {
      @case ('idle') {
        <div class="idle">
          <button app-button variant="outline" size="sm" (click)="run.emit()">
            <app-icon name="brain" style="--icon-size: 14px" />
            {{ label() }}
          </button>
          <span class="hint">{{ hint() }}</span>
        </div>
      }
      @case ('loading') {
        <div class="loading" role="status">
          <span class="pulse" aria-hidden="true"></span>
          Тренер читает цифры…
        </div>
      }
      @case ('error') {
        <div class="error" role="alert">
          <span>{{ errorText() }}</span>
          <button app-button variant="ghost" size="xs" (click)="run.emit()">Повторить</button>
        </div>
      }
      @case ('done') {
        @if (review(); as r) {
          <article class="review" [class]="'review ' + r.tone">
            <h5 class="headline">{{ r.headline }}</h5>
            <p class="text">{{ r.review }}</p>
            @if (r.actions.length > 0) {
              <ul class="actions">
                @for (action of r.actions; track $index) {
                  <li>{{ action }}</li>
                }
              </ul>
            }
            <footer>
              <span>ИИ видит только цифры журнала и может ошибаться</span>
              <button type="button" class="again" (click)="run.emit()">
                <app-icon name="refresh" style="--icon-size: 12px" />
                Заново
              </button>
            </footer>
          </article>
        }
      }
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; }

    .idle {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: $space-2 $space-3;
    }

    .hint { font-size: $text-xs; color: var(--fg-subtle); }

    .loading {
      display: flex;
      align-items: center;
      gap: $space-2;
      font-size: $text-sm;
      color: var(--fg-muted);
    }

    .pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-fg);
      animation: pulse 1.1s $ease-in-out infinite;
    }

    @keyframes pulse {
      50% { opacity: 0.25; transform: scale(0.7); }
    }

    @media (prefers-reduced-motion: reduce) {
      .pulse { animation: none; }
    }

    .error {
      display: flex;
      align-items: center;
      gap: $space-2;
      font-size: $text-sm;
      color: var(--danger-fg);
    }

    .review {
      display: flex;
      flex-direction: column;
      gap: $space-2;
      padding: $space-3 $space-4;
      border-radius: $radius-lg;
      border: 1px solid var(--border-muted);
      border-left: 3px solid var(--attention-fg);
      background: var(--canvas-inset);

      &.good { border-left-color: var(--success-fg); }
      &.bad { border-left-color: var(--danger-fg); }
    }

    // Голос тренера — почерком, как заголовки инсайтов.
    .headline {
      margin: 0;
      @include coach-voice(19px);
      color: var(--fg-default);
    }

    .text {
      margin: 0;
      font-size: $text-sm;
      line-height: 1.55;
      color: var(--fg-default);
    }

    .actions {
      margin: 0;
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: $text-sm;
      color: var(--fg-muted);

      li::marker { color: var(--accent-fg); }
    }

    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: $space-2;
      font-size: $text-xs;
      color: var(--fg-subtle);
    }

    .again {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px;
      border: none;
      background: none;
      color: var(--fg-muted);
      font: inherit;
      cursor: pointer;

      &:hover { color: var(--fg-default); }
      @include focus-ring($offset: 1px);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiReviewPanel {
  private readonly store = inject(AiReviewStore);

  /** Ключ разбора (AiReviewStore.tradeKey / dayKey). */
  readonly reviewKey = input.required<string>();
  readonly label = input('Разбор от ИИ');
  readonly hint = input('');
  /** Нажали «разобрать» — родитель собирает факты и зовёт стор. */
  readonly run = output<void>();

  protected readonly state = computed(() => this.store.stateOf(this.reviewKey()));
  protected readonly review = computed(() => {
    const state = this.state();
    return state.status === 'done' ? state.review : null;
  });
  protected readonly errorText = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.message : '';
  });
}
