import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WidgetBase } from './widget-base';
import { EmptyState } from '../../../shared/ui/empty-state';
import { PnlValue } from '../../../shared/ui/pnl-value';
import { Icon } from '../../../shared/ui/icon';
import {
  Trade,
  calculatePnl,
  calculateRMultiple,
  formatDateTime,
  formatPrice,
  plannedRiskReward,
  plannedRiskUsd,
} from '../../trades/data/trade.model';

const TABLE_STYLE = `
  @use 'styles/index' as *;

  :host { display: block; height: 100%; overflow-y: auto; @include styled-scrollbar; }
  .tj-table th { background: var(--canvas-subtle); }
  .tj-table td { padding-block: 6px; }
  .sym {
    font-weight: 600;
    color: var(--fg-default);
    text-decoration: none;
    &:hover { color: var(--accent-fg); }
  }
`;

/** Последние сделки периода. */
@Component({
  selector: 'app-widget-recent-trades',
  imports: [RouterLink, EmptyState, PnlValue, Icon],
  template: `
    @if (rows().length > 0) {
      <table class="tj-table">
        <thead>
          <tr>
            <th>Тикер</th>
            <th></th>
            <th>Закрыта</th>
            <th class="num">P&L</th>
            <th class="num">R</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.trade.id) {
            <tr>
              <td><a class="sym" [routerLink]="['/trades', row.trade.id]">{{ row.trade.symbol }}</a></td>
              <td>
                <span class="tj-side" [class]="row.trade.side">
                  <app-icon [name]="row.trade.side" style="--icon-size: 12px" />
                  {{ row.trade.side === 'long' ? 'L' : 'S' }}
                </span>
              </td>
              <td class="muted">{{ closedAt(row.trade) }}</td>
              <td class="num"><app-pnl [value]="row.pnl" /></td>
              <td class="num muted">{{ rText(row.r) }}</td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <app-empty-state icon="table" title="Нет сделок за период" />
    }
  `,
  styles: TABLE_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetRecentTrades extends WidgetBase {
  protected readonly rows = computed(() => {
    const limit = this.settings().limit ?? 8;
    return this.trades()
      .filter((t) => t.status === 'closed')
      .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
      .slice(0, limit)
      .map((trade) => ({ trade, pnl: calculatePnl(trade), r: calculateRMultiple(trade) }));
  });

  protected closedAt(trade: Trade): string {
    return formatDateTime(trade.closedAt);
  }

  protected rText(r: number | null): string {
    if (r === null) return '—';
    return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(1)}R`;
  }
}

/** Открытые позиции с риском и целями. */
@Component({
  selector: 'app-widget-open-positions',
  imports: [RouterLink, EmptyState, Icon],
  template: `
    @if (rows().length > 0) {
      <table class="tj-table">
        <thead>
          <tr>
            <th>Тикер</th>
            <th></th>
            <th class="num">Вход</th>
            <th class="num">SL</th>
            <th class="num">TP</th>
            <th class="num">Риск</th>
            <th class="num">R:R</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.trade.id) {
            <tr>
              <td><a class="sym" [routerLink]="['/trades', row.trade.id]">{{ row.trade.symbol }}</a></td>
              <td>
                <span class="tj-side" [class]="row.trade.side">
                  <app-icon [name]="row.trade.side" style="--icon-size: 12px" />
                  {{ row.trade.side === 'long' ? 'L' : 'S' }}
                  ×{{ row.trade.leverage }}
                </span>
              </td>
              <td class="num">{{ price(row.trade.entryPrice) }}</td>
              <td class="num loss">{{ row.trade.stopLoss !== null ? price(row.trade.stopLoss) : '—' }}</td>
              <td class="num win">{{ row.trade.takeProfit !== null ? price(row.trade.takeProfit) : '—' }}</td>
              <td class="num muted">{{ row.risk === null ? '—' : '$' + row.risk.toFixed(0) }}</td>
              <td class="num muted">{{ row.rr === null ? '—' : '1:' + row.rr.toFixed(1) }}</td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <app-empty-state icon="zap" title="Нет открытых позиций" description="Все позиции закрыты — рынок подождёт." />
    }
  `,
  styles:
    TABLE_STYLE +
    `
    .loss { color: var(--danger-fg); }
    .win { color: var(--success-fg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetOpenPositions extends WidgetBase {
  protected readonly rows = computed(() =>
    this.trades()
      .filter((t) => t.status === 'open')
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .map((trade) => ({
        trade,
        risk: plannedRiskUsd(trade),
        rr: plannedRiskReward(trade),
      })),
  );

  protected price(value: number): string {
    return formatPrice(value);
  }
}

/** Топ прибыльных и убыточных сделок. */
@Component({
  selector: 'app-widget-best-worst',
  imports: [RouterLink, EmptyState, PnlValue],
  template: `
    @if (best().length > 0) {
      <div class="cols">
        <div class="col">
          <div class="col-title win">Лучшие</div>
          @for (row of best(); track row.trade.id) {
            <a class="item" [routerLink]="['/trades', row.trade.id]">
              <span class="s">{{ row.trade.symbol }}</span>
              <span class="d">{{ date(row.trade) }}</span>
              <app-pnl [value]="row.pnl" />
            </a>
          }
        </div>
        <div class="col">
          <div class="col-title loss">Худшие</div>
          @for (row of worst(); track row.trade.id) {
            <a class="item" [routerLink]="['/trades', row.trade.id]">
              <span class="s">{{ row.trade.symbol }}</span>
              <span class="d">{{ date(row.trade) }}</span>
              <app-pnl [value]="row.pnl" />
            </a>
          }
        </div>
      </div>
    } @else {
      <app-empty-state icon="star" title="Нет сделок за период" />
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; overflow-y: auto; @include styled-scrollbar; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: $space-2; padding: $space-2 $space-3; }
    .col { min-width: 0; }
    .col-title {
      font-size: $text-xs;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: $space-1 $space-2;
      &.win { color: var(--success-fg); }
      &.loss { color: var(--danger-fg); }
    }
    .item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0 $space-2;
      align-items: center;
      padding: 5px $space-2;
      border-radius: $radius-md;
      text-decoration: none;
      transition: background $duration-instant $ease-apple;

      &:hover { background: var(--canvas-overlay); }

      .s { font-size: $text-sm; font-weight: 600; color: var(--fg-default); }
      .d { grid-row: 2; font-size: $text-xs; color: var(--fg-subtle); }
      app-pnl { grid-row: 1 / span 2; font-size: $text-sm; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetBestWorst extends WidgetBase {
  private readonly closed = computed(() =>
    this.trades()
      .filter((t) => t.status === 'closed')
      .map((trade) => ({ trade, pnl: calculatePnl(trade) }))
      .sort((a, b) => b.pnl - a.pnl),
  );

  protected readonly best = computed(() =>
    this.closed()
      .filter((r) => r.pnl > 0)
      .slice(0, this.settings().limit ?? 5),
  );

  protected readonly worst = computed(() =>
    [...this.closed()]
      .reverse()
      .filter((r) => r.pnl < 0)
      .slice(0, this.settings().limit ?? 5),
  );

  protected date(trade: Trade): string {
    return trade.closedAt.slice(0, 10);
  }
}
