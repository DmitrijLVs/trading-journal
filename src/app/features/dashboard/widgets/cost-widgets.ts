import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { WidgetBase } from './widget-base';
import { MAKER_RATE, TAKER_RATE, costBreakdown } from '../../analytics/data/costs';
import { decimal, formatMoney } from '../../trades/data/trade.model';
import { EmptyState } from '../../../shared/ui/empty-state';

const money = (v: number, sign = false) => formatMoney(v, { sign });
const share = (v: number) => `${Math.round(v * 100)}%`;

// ── Комиссии ────────────────────────────────────────────────────────────────

/**
 * Главная полоса листа «Издержки»: сколько ушло бирже, к чему это привело,
 * сколько должна пройти цена до безубытка и что даст смена типа ордеров.
 */
@Component({
  selector: 'app-widget-fee-lab',
  imports: [EmptyState],
  template: `
    @let c = costs();
    @if (c.tradeCount > 0) {
      <div class="lab">
        <div class="cell main">
          <span class="k">Комиссии за период</span>
          <span class="v neg">{{ money(c.fees) }}</span>
          <span class="s">≈ {{ money(c.avgFeePerTrade) }} за сделку · {{ c.tradeCount }} сд.</span>
        </div>
        <div class="cell">
          <span class="k">До комиссий → итог</span>
          <span class="v">
            <span [class.pos]="c.gross > 0" [class.neg]="c.gross < 0">{{ money(c.gross, true) }}</span>
            <span class="arrow">→</span>
            <span [class.pos]="c.net > 0" [class.neg]="c.net < 0">{{ money(c.net, true) }}</span>
          </span>
          <span class="s">
            @if (c.feeShareOfGross !== null) {
              бирже ушло {{ percent(c.feeShareOfGross) }} валовой прибыли
            } @else {
              до комиссий результат не в плюсе
            }
          </span>
        </div>
        <div class="cell">
          <span class="k">Движение до безубытка</span>
          <span class="v">{{ c.breakevenMovePct === null ? '—' : decimal(c.breakevenMovePct, 2) + '%' }}</span>
          <span class="s">столько цена должна пройти, чтобы окупить комиссию круга</span>
        </div>
        <div class="cell">
          <span class="k">Маркет → маркет</span>
          <span class="v">{{ c.marketRoundTripShare === null ? '—' : percent(c.marketRoundTripShare) }}</span>
          <span class="s">лимитных входов {{ c.limitEntries }}, выходов {{ c.limitExits }}</span>
        </div>
        <div class="cell coach">
          @if (c.limitEntrySavings >= 1) {
            <span class="note">лимитные входы сэкономили бы ≈ {{ money(c.limitEntrySavings) }}</span>
            <span class="s">оценка: мейкер {{ rate(maker) }} вместо тейкера {{ rate(taker) }} на маркет-входах</span>
          } @else {
            <span class="note">с ордерами всё в порядке</span>
            <span class="s">входы и так в основном лимитные</span>
          }
        </div>
      </div>
    } @else {
      <app-empty-state icon="coins" title="Нет сделок за период" />
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; container-type: size; }
    .lab {
      display: grid;
      grid-template-columns: 1fr 1.5fr 1fr 0.9fr 1.3fr;
      align-content: center;
      align-items: start;
      gap: $space-5;
      height: 100%;
      padding: $space-3 $space-6;
    }
    .cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .k { font-size: $text-sm; color: var(--fg-muted); white-space: nowrap; }
    .v { @include figure(clamp(20px, 26cqh, 28px), 600); color: var(--fg-default); white-space: nowrap; }
    .main .v { @include figure(clamp(26px, 36cqh, 40px)); }
    // Пара «до → после» длиннее остальных значений — чуть мельче.
    .cell:nth-child(2) .v { font-size: clamp(18px, 22cqh, 24px); }
    .s { font-size: $text-xs; color: var(--fg-subtle); line-height: 1.35; }
    .arrow { color: var(--fg-subtle); margin: 0 6px; font-weight: 400; }
    .pos { color: var(--success-fg); }
    .neg { color: var(--danger-fg); }
    .note { @include coach-voice(21px); color: var(--attention-fg); }

    @container (max-width: 1000px) {
      .lab { grid-template-columns: 1fr 1.2fr 1fr; }
      .cell:nth-child(4), .cell:nth-child(5) { display: none; }
    }
    @container (max-width: 560px) {
      .lab { grid-template-columns: 1fr 1fr; padding: $space-2 $space-4; }
      .cell:nth-child(3) { display: none; }
      .s { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetFeeLab extends WidgetBase {
  protected readonly costs = computed(() => costBreakdown(this.trades()));
  protected readonly maker = MAKER_RATE;
  protected readonly taker = TAKER_RATE;
  protected readonly money = money;
  protected readonly percent = share;
  protected readonly decimal = decimal;

  protected rate(value: number): string {
    return `${decimal(value * 100, 2)}%`;
  }
}

// ── Из чего итог ────────────────────────────────────────────────────────────

interface Step {
  label: string;
  /** Изменение на этом шаге (у итогов — сам итог). */
  value: number;
  from: number;
  to: number;
  kind: 'total' | 'delta';
}

/**
 * Водопад: биржевой результат → комиссии → фандинг → итог. Рисуется HTML —
 * четыре столбца не стоят canvas, а подписи остаются чёткими.
 */
@Component({
  selector: 'app-widget-fee-waterfall',
  imports: [EmptyState],
  template: `
    @if (steps().length > 0) {
      <div class="fall">
        @for (step of steps(); track step.label) {
          <div class="col">
            <div class="plot">
              <span
                class="value"
                [class.pos]="step.value > 0"
                [class.neg]="step.value < 0"
                [style.bottom.%]="labelBottom(step)"
              >{{ money(step.value, true) }}</span>
              <i
                class="block"
                [class.total]="step.kind === 'total'"
                [class.pos]="step.value > 0"
                [class.neg]="step.value < 0"
                [style.bottom.%]="y(min(step))"
                [style.height.%]="y(max(step)) - y(min(step))"
              ></i>
              <i class="zero" [style.bottom.%]="y(0)"></i>
            </div>
            <span class="label">{{ step.label }}</span>
          </div>
        }
      </div>
    } @else {
      <app-empty-state icon="chart-bar" title="Нет сделок за период" />
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; }
    .fall { display: grid; grid-template-columns: repeat(4, 1fr); gap: $space-3; height: 100%; padding: $space-3 $space-4 $space-3; }
    .col { display: flex; flex-direction: column; min-width: 0; }
    .plot { position: relative; flex: 1; min-height: 0; margin: 22px 0 6px; }
    .block {
      position: absolute;
      left: 18%;
      right: 18%;
      min-height: 2px;
      border-radius: 3px;
      background: var(--fg-subtle);
      opacity: 0.85;
      &.pos { background: var(--success-fg); }
      &.neg { background: var(--danger-fg); }
      &.total { opacity: 1; }
      &:not(.total) { opacity: 0.55; }
    }
    .zero { position: absolute; left: 0; right: 0; height: 1px; background: var(--border-default); }
    .value {
      position: absolute;
      left: 0;
      right: 0;
      transform: translateY(-4px);
      text-align: center;
      font-family: $font-mono;
      font-size: $text-xs;
      font-weight: 600;
      white-space: nowrap;
      &.pos { color: var(--success-fg); }
      &.neg { color: var(--danger-fg); }
    }
    .label { text-align: center; font-size: $text-xs; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetFeeWaterfall extends WidgetBase {
  protected readonly steps = computed<Step[]>(() => {
    const c = costBreakdown(this.trades());
    if (c.tradeCount === 0) return [];
    const afterFees = c.gross - c.fees;
    return [
      { label: 'До комиссий', value: c.gross, from: 0, to: c.gross, kind: 'total' },
      { label: 'Комиссии', value: -c.fees, from: c.gross, to: afterFees, kind: 'delta' },
      { label: 'Фандинг', value: c.funding, from: afterFees, to: afterFees + c.funding, kind: 'delta' },
      { label: 'Итог', value: c.net, from: 0, to: c.net, kind: 'total' },
    ];
  });

  /** Шкала: от минимума до максимума всех уровней, ноль всегда внутри. */
  private readonly range = computed(() => {
    const levels = this.steps().flatMap((s) => [s.from, s.to]);
    const lo = Math.min(0, ...levels);
    const hi = Math.max(0, ...levels);
    return { lo, span: hi - lo || 1 };
  });

  protected y(value: number): number {
    const { lo, span } = this.range();
    return ((value - lo) / span) * 100;
  }

  protected min(step: Step): number {
    return Math.min(step.from, step.to);
  }

  protected max(step: Step): number {
    return Math.max(step.from, step.to);
  }

  /** Подпись — над верхним краем блока. */
  protected labelBottom(step: Step): number {
    return this.y(this.max(step));
  }

  protected money(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }
}
