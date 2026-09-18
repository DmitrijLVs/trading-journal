import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { WidgetBase } from './widget-base';
import { summarize } from '../../analytics/data/metrics';
import { formatMoney } from '../../trades/data/trade.model';
import { CHART } from '../../../shared/charts/chart-theme';
import { RingSegment, SketchRing } from '../../../shared/ui/sketch/sketch-ring';

/**
 * Сводка периода: оборот, комиссии, число сделок и доля лонг/шорт.
 * Раскладка плиток адаптивна к размеру виджета (container queries):
 * 2×2 по умолчанию, в одну строку на широких, без кольца на низких.
 */
@Component({
  selector: 'app-widget-summary',
  imports: [SketchRing],
  template: `
    @let s = stats();
    <div class="tiles">
      <div class="tile">
        <span class="v">{{ money(s.totalVolume) }}</span>
        <span class="k">Оборот</span>
      </div>
      <div class="tile">
        <span class="v">{{ money(s.fees + s.funding) }}</span>
        <span class="k">Комиссия</span>
      </div>
      <div class="tile">
        <span class="v">
          {{ s.tradeCount }}
          <span class="v-sub"><span class="pos">{{ s.winCount }}W</span> · <span class="neg">{{ s.lossCount }}L</span></span>
        </span>
        <span class="k">Сделок</span>
      </div>
      <div class="tile">
        <span class="v ls-v"><span class="pos">{{ share().long }}%</span><span class="neg">{{ share().short }}%</span></span>
        <span class="k">Лонг / Шорт</span>
        <app-sketch-ring class="ring" [segments]="ring()" [thickness]="7" sketchSeed="summary-ring" />
      </div>
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: block;
      height: 100%;
      container-type: size;
    }

    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
      gap: 2px $space-4;
      height: 100%;
      padding: $space-2 $space-4;
    }

    // Каждая плитка — одна и та же сетка: значение над подписью, слева;
    // декор (кольцо) — во второй колонке на обе строки. Так базовые линии
    // всех четырёх плиток совпадают.
    .tile {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto auto;
      align-content: center;
      align-items: end;
      column-gap: $space-2;
      row-gap: 1px;
      min-width: 0;
      min-height: 0;
    }

    .v {
      grid-column: 1;
      grid-row: 1;
      font-family: $font-mono;
      font-variant-numeric: tabular-nums;
      font-weight: 650;
      font-size: clamp(14px, 19cqh, 22px);
      letter-spacing: -0.02em;
      line-height: 1.15;
      color: var(--fg-default);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .v-sub {
      font-size: 0.62em;
      font-weight: 500;
      color: var(--fg-muted);
    }

    .k {
      grid-column: 1;
      grid-row: 2;
      font-family: $font-hand;
      font-size: 13px;
      line-height: 1.2;
      color: var(--fg-muted);
      white-space: nowrap;
    }

    .pos { color: var(--success-fg); }
    .neg { color: var(--danger-fg); }

    .ring {
      grid-column: 2;
      grid-row: 1 / span 2;
      align-self: center;
      width: clamp(34px, 40cqh, 52px);
      height: clamp(34px, 40cqh, 52px);
      color: var(--border-strong);
    }

    .ls-v {
      display: flex;
      gap: 8px;
    }

    // Широкий виджет — четыре плитки в ряд.
    @container (min-width: 640px) {
      .tiles {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: 1fr;
      }
    }

    // Совсем низкий — без кольца, только проценты.
    @container (max-height: 84px) {
      .ring { display: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetSummary extends WidgetBase {
  protected readonly stats = computed(() => summarize(this.trades()));

  protected readonly share = computed(() => {
    const trades = this.trades();
    if (trades.length === 0) return { long: 0, short: 0 };
    const long = Math.round((trades.filter((t) => t.side === 'long').length / trades.length) * 100);
    return { long, short: 100 - long };
  });

  protected readonly ring = computed<RingSegment[]>(() => {
    const { long, short } = this.share();
    return [
      { value: long, color: CHART.pos },
      { value: short, color: CHART.neg },
    ];
  });

  protected money(value: number): string {
    return formatMoney(value);
  }
}
