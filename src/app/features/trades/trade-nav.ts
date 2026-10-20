import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Trade } from './data/trade.model';
import { Icon } from '../../shared/ui/icon';
import { PnlValue } from '../../shared/ui/pnl-value';

/** Строка списка сделок: сделка плюс посчитанные для неё значения. */
export interface TradeRow {
  trade: Trade;
  pnl: number;
  pnlPct: number;
  r: number | null;
  notional: number;
}

/**
 * Навигация по сделкам в режиме «График»: компактный список справа от
 * разбора. Клик выбирает сделку, стрелки листают страницу.
 */
@Component({
  selector: 'app-trade-nav',
  imports: [Icon, PnlValue],
  template: `
    <header class="head">
      <span class="title">Сделки</span>
      <span class="range">{{ rangeLabel() }}</span>
    </header>

    <div class="rows">
      @for (row of rows(); track row.trade.id) {
        <button
          type="button"
          class="row"
          [class.active]="row.trade.id === selectedId()"
          (click)="select.emit(row.trade)"
        >
          <span class="line">
            <span class="sym">{{ row.trade.symbol }}</span>
            <span class="tj-side" [class]="row.trade.side">
              <app-icon [name]="row.trade.side" style="--icon-size: 11px" />
              {{ row.trade.side === 'long' ? 'L' : 'S' }}×{{ row.trade.leverage }}
            </span>
            <span class="grow"></span>
            @if (row.trade.status === 'closed') {
              <app-pnl class="pnl" [value]="row.pnl" />
            } @else {
              <span class="open">открыта</span>
            }
          </span>
          <span class="line meta">
            <span class="tags">
              @for (tag of row.trade.tags.slice(0, 2); track tag) {
                <span class="tag">{{ tag }}</span>
              }
            </span>
            <span class="date">{{ shortDate(row.trade.openedAt) }}</span>
          </span>
        </button>
      } @empty {
        <p class="empty">Ничего не найдено</p>
      }
    </div>

    <footer class="pager">
      <button type="button" class="nav" [disabled]="page() === 1" aria-label="Назад" (click)="goTo.emit(page() - 1)">
        <app-icon name="chevron-left" style="--icon-size: 14px" />
      </button>
      <span class="page">{{ page() }} / {{ pageCount() }}</span>
      <button
        type="button"
        class="nav"
        [disabled]="page() === pageCount()"
        aria-label="Вперёд"
        (click)="goTo.emit(page() + 1)"
      >
        <app-icon name="chevron-right" style="--icon-size: 14px" />
      </button>
    </footer>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: var(--canvas-subtle);
      border: 1px solid var(--border-muted);
      border-radius: $radius-xl;
      box-shadow: $shadow-md;
      overflow: hidden;
    }

    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: $space-2;
      padding: $space-3 $space-4;
      border-bottom: 1px solid var(--border-muted);
    }

    .title { font-size: $text-md; font-weight: 600; }

    .range {
      font-family: $font-mono;
      font-size: $text-xs;
      color: var(--fg-subtle);
    }

    .rows {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      @include styled-scrollbar;
    }

    .row {
      appearance: none;
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 100%;
      padding: $space-2 $space-4;
      background: none;
      border: none;
      border-left: 2px solid transparent;
      border-bottom: 1px solid var(--border-muted);
      text-align: left;
      color: var(--fg-default);
      cursor: pointer;
      transition: background $duration-fast $ease-apple;

      &:hover { background: var(--canvas-overlay); }

      &.active {
        background: var(--canvas-overlay);
        border-left-color: var(--accent-fg);
      }
    }

    .line {
      display: flex;
      align-items: baseline;
      gap: $space-2;
      min-width: 0;
    }

    .grow { flex: 1; }
    .sym { font-size: $text-sm; font-weight: 600; }
    .pnl { font-family: $font-mono; font-size: $text-sm; }

    .open {
      font-size: $text-xs;
      color: var(--accent-fg);
      background: var(--accent-subtle);
      border-radius: $radius-full;
      padding: 1px $space-2;
    }

    // Второй строкой — теги и время. Время намеренно самое тихое в строке.
    .meta {
      justify-content: space-between;
      min-height: 17px;
    }

    .tags {
      display: flex;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
    }

    .tag {
      font-size: 11px;
      line-height: 15px;
      color: var(--fg-muted);
      background: var(--canvas-inset);
      border-radius: $radius-sm;
      padding: 0 5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .date {
      flex: none;
      font-family: $font-mono;
      font-size: 11px;
      color: var(--fg-subtle);
      opacity: 0.6;
    }

    .empty {
      margin: $space-6 $space-4;
      text-align: center;
      color: var(--fg-muted);
      font-size: $text-sm;
    }

    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: $space-2;
      padding: $space-2;
      border-top: 1px solid var(--border-muted);
    }

    .page {
      font-family: $font-mono;
      font-size: $text-sm;
      color: var(--fg-muted);
      min-width: 56px;
      text-align: center;
    }

    .nav {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      background: none;
      border: none;
      border-radius: $radius-md;
      color: var(--fg-muted);
      cursor: pointer;

      &:hover:not(:disabled) {
        background: var(--canvas-inset);
        color: var(--fg-default);
      }

      &:disabled { opacity: 0.35; cursor: default; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeNav {
  readonly rows = input.required<readonly TradeRow[]>();
  readonly selectedId = input<string | null>(null);
  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly rangeLabel = input('');

  readonly select = output<Trade>();
  readonly goTo = output<number>();

  /** «18.09 10:00» — в узком списке длинная дата не нужна. */
  protected shortDate(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
