import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMoney, formatPercent, formatR } from '../../features/trades/data/trade.model';

/**
 * Значение P&L: моноширинное, окрашенное по знаку, всегда со знаком —
 * знак является обязательным вторичным кодированием поверх цвета.
 */
@Component({
  selector: 'app-pnl',
  template: `{{ text() }}`,
  styles: `
    @use 'styles/index' as *;

    :host {
      font-family: $font-mono;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    :host(.pos) { color: var(--success-fg); }
    :host(.neg) { color: var(--danger-fg); }
    :host(.zero) { color: var(--fg-muted); }
  `,
  host: {
    '[class.pos]': 'value() > eps()',
    '[class.neg]': 'value() < -eps()',
    '[class.zero]': 'value() >= -eps() && value() <= eps()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PnlValue {
  readonly value = input.required<number>();
  readonly kind = input<'money' | 'percent' | 'r'>('money');
  /** Порог «нуля» — сделки в ноль не красим. */
  readonly eps = input(0.005);

  protected readonly text = computed(() => {
    const v = this.value();
    switch (this.kind()) {
      case 'money':
        return formatMoney(v, { sign: true });
      case 'percent':
        return formatPercent(v, { sign: true });
      case 'r':
        return formatR(v);
    }
  });
}
