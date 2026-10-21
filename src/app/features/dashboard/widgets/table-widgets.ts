import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WidgetBase } from './widget-base';
import { EmptyState } from '../../../shared/ui/empty-state';
import { PnlValue } from '../../../shared/ui/pnl-value';
import { Icon } from '../../../shared/ui/icon';
import { Trade, calculatePnl, calculatePnlPercent, formatPrice } from '../../trades/data/trade.model';
import { PortfolioStore } from '../../analytics/portfolio-store';

const TABLE_STYLE = `
  @use 'styles/index' as *;

  :host { display: block; height: 100%; overflow: auto; container-type: inline-size; @include styled-scrollbar; }
  .tj-table th { background: var(--canvas-subtle); }
  // Узкий виджет — прячем второстепенные колонки, чтобы не резать основные.
  @container (max-width: 440px) { .col-narrow-hide { display: none; } }
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
            <th class="num col-narrow-hide">%</th>
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
              <td class="num col-narrow-hide"><app-pnl [value]="row.pct" kind="percent" /></td>
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
      .map((trade) => ({ trade, pnl: calculatePnl(trade), pct: calculatePnlPercent(trade) }));
  });

  /** «08.07 16:11» — в виджете года и месяца словами не нужно. */
  protected closedAt(trade: Trade): string {
    const d = new Date(trade.closedAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

/** Открытые позиции по данным биржи: объём, вход и нереализованный P&L. */
@Component({
  selector: 'app-widget-open-positions',
  imports: [RouterLink, EmptyState, PnlValue, Icon],
  template: `
    @if (rows().length > 0) {
      <table class="tj-table">
        <thead>
          <tr>
            <th>Тикер</th>
            <th></th>
            <th class="num col-narrow-hide">Объём</th>
            <th class="num">Вход</th>
            <th class="num">Нереализ.</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.accountId + row.symbol + row.side) {
            <tr>
              <td>
                @if (row.tradeId) {
                  <a class="sym" [routerLink]="['/trades', row.tradeId]">{{ row.symbol }}</a>
                } @else {
                  <span class="sym">{{ row.symbol }}</span>
                }
              </td>
              <td>
                <span class="tj-side" [class]="row.side">
                  <app-icon [name]="row.side" style="--icon-size: 12px" />
                  {{ row.side === 'long' ? 'L' : 'S' }}
                </span>
              </td>
              <td class="num muted col-narrow-hide">{{ row.quantity }}</td>
              <td class="num">{{ price(row.entryPrice) }}</td>
              <td class="num"><app-pnl [value]="row.unrealizedPnl" /></td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <app-empty-state icon="zap" title="Нет открытых позиций" description="Все позиции закрыты — рынок подождёт." />
    }
  `,
  styles: TABLE_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetOpenPositions extends WidgetBase {
  /** Нереализованный P&L биржа присылает при изменении позиции, а не по тикам цены. */
  protected readonly rows = inject(PortfolioStore).positions;

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
