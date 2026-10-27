import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WidgetBase } from './widget-base';
import { Insight, InsightBar, buildInsights } from '../../analytics/data/insights';
import { DisciplineStore } from '../../analytics/discipline-store';
import { formatMoney, formatMoneyCompact } from '../../trades/data/trade.model';

/** Бар доказательства: доля от максимума по модулю и знак. */
interface EvidenceBar extends InsightBar {
  share: number;
  text: string;
}

/**
 * «Что важно»: выводы, которые журнал делает сам. Заголовок — от руки (голос
 * тренера), цифры — обычным шрифтом, под ними мини-доказательство и переход
 * к сделкам, на которых вывод построен.
 */
@Component({
  selector: 'app-widget-insights',
  template: `
    <div class="list">
      @for (item of items(); track item.insight.id) {
        <article class="insight" [class]="'insight ' + item.insight.tone">
          <h4 class="title">{{ item.insight.title }}</h4>
          <p class="text">{{ item.insight.text }}</p>
          @if (item.bars.length > 0) {
            <div class="bars" [class.many]="item.bars.length > 4">
              @for (bar of item.bars; track bar.label) {
                <div class="bar">
                  <span class="bar-label">{{ bar.label }}</span>
                  <span class="track">
                    <i [class.neg]="bar.value < 0" [style.width.%]="bar.share * 100"></i>
                  </span>
                  <span class="bar-value" [class.neg]="bar.value < 0">{{ bar.text }}</span>
                </div>
              }
            </div>
          }
          @if (item.insight.link; as link) {
            <button type="button" class="show" (click)="showTrades(link)">Показать сделки →</button>
          }
        </article>
      } @empty {
        <div class="quiet">
          <div class="quiet-title">пока молчу</div>
          <p>
            Для выводов нужно хотя бы 30 закрытых сделок за период. Расширьте период или
            вернитесь, когда история наберётся.
          </p>
        </div>
      }
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; overflow-y: auto; @include styled-scrollbar; }
    .list { display: flex; flex-direction: column; gap: $space-3; padding: $space-2 $space-4 $space-4; }

    .insight {
      position: relative;
      padding: $space-1 0 $space-3 $space-4;
      border-bottom: 1px solid var(--border-muted);
      &:last-child { border-bottom: none; }
      // Маркер тона слева — карандашная черта.
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 8px;
        bottom: 14px;
        width: 3px;
        border-radius: 2px;
        background: var(--fg-subtle);
      }
      &.neg::before { background: var(--danger-fg); }
      &.warn::before { background: var(--attention-fg); }
      &.pos::before { background: var(--success-fg); }
      &.info::before { background: var(--accent-fg); }
    }

    .title { margin: 0 0 2px; @include coach-voice(21px); color: var(--fg-default); }
    .text { margin: 0; font-size: $text-sm; line-height: 1.45; color: var(--fg-muted); }

    .bars { display: flex; flex-direction: column; gap: 3px; margin-top: $space-2; max-width: 460px; }
    .bar { display: grid; grid-template-columns: 132px 1fr 76px; align-items: center; gap: $space-2; }
    .bars.many .bar { grid-template-columns: 96px 1fr 64px; }
    .bar-label { font-size: $text-xs; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .track { height: 6px; border-radius: 3px; background: var(--canvas-inset); overflow: hidden; }
    .track i { display: block; height: 100%; border-radius: inherit; background: var(--success-fg); opacity: 0.85; }
    .track i.neg { background: var(--danger-fg); }
    .bar-value { font-family: $font-mono; font-size: $text-xs; text-align: right; color: var(--success-fg); }
    .bar-value.neg { color: var(--danger-fg); }

    .show {
      appearance: none;
      margin-top: $space-2;
      padding: 0;
      background: none;
      border: none;
      color: var(--accent-fg);
      font-size: $text-sm;
      cursor: pointer;
      &:hover { text-decoration: underline; }
    }

    .quiet { padding: $space-3 0; }
    .quiet-title { @include coach-voice(22px); color: var(--fg-muted); }
    .quiet p { margin: $space-1 0 0; font-size: $text-sm; color: var(--fg-subtle); line-height: 1.45; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetInsights extends WidgetBase {
  private readonly router = inject(Router);
  private readonly discipline = inject(DisciplineStore);

  protected readonly items = computed(() =>
    buildInsights(this.trades(), this.tradesStore.tags(), this.discipline.settings())
      .slice(0, this.settings().limit ?? 6)
      .map((insight) => ({ insight, bars: evidence(insight) })),
  );

  protected showTrades(link: NonNullable<Insight['link']>): void {
    void this.router.navigate(['/trades'], { queryParams: { tag: link.tag, side: link.side } });
  }
}

/** Мини-доказательство: бары в долях от максимума; проценты винрейта — как есть. */
function evidence(insight: Insight): EvidenceBar[] {
  const bars = insight.bars ?? [];
  const max = Math.max(1e-9, ...bars.map((b) => Math.abs(b.value)));
  const percent = insight.id === 'tilt';
  return bars.map((b) => ({
    ...b,
    share: Math.abs(b.value) / max,
    text: percent ? `${Math.round(b.value)}%` : signed(b.value),
  }));
}

/** Мелкие суммы — с центами, крупные — компактно. */
function signed(value: number): string {
  return Math.abs(value) < 10_000
    ? formatMoney(value, { sign: true })
    : formatMoneyCompact(value, { sign: true });
}
