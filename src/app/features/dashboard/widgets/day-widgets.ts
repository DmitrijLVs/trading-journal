import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';
import { WidgetBase } from './widget-base';
import { SessionStore } from '../../analytics/session-store';
import { daySummary, dayTimeline, tradingDays } from '../../analytics/data/session';
import { currentPeriodNet } from '../../analytics/data/periods';
import { plural } from '../../analytics/data/behavior';
import {
  formatMoney,
  formatMoneyAxis,
  formatSpan,
  localDay,
} from '../../trades/data/trade.model';
import { EChart } from '../../../shared/charts/echart';
import { CHART, alpha, baseTooltip } from '../../../shared/charts/chart-theme';
import { EmptyState } from '../../../shared/ui/empty-state';
import { Icon } from '../../../shared/ui/icon';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** «пн, 27 окт» для дня YYYY-MM-DD. */
function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Итог дня ────────────────────────────────────────────────────────────────

/**
 * Главная полоса листа «Сегодня»: итог дня крупно, лимит убытка, серия,
 * открытые позиции и короткая рукописная реплика тренера.
 */
@Component({
  selector: 'app-widget-day-hero',
  imports: [RouterLink],
  template: `
    @let s = session.summary();
    <div class="hero">
      <div class="main">
        <span class="label">Сегодня · {{ todayLabel() }}</span>
        @if (s.closed > 0) {
          <span class="value" [class.pos]="s.net > 0" [class.neg]="s.net < 0">{{ money(s.net, true) }}</span>
          <span class="sub">до комиссий {{ money(s.gross, true) }} · комиссии {{ money(s.fees) }}</span>
        } @else {
          <span class="value idle">без сделок</span>
          @if (lastDay(); as last) {
            <span class="sub">{{ last.label }}: {{ money(last.net, true) }} · {{ last.closed }} сд.</span>
          }
        }
      </div>

      <div class="stats">
        <div class="stat">
          <span class="v">{{ s.entries }}</span>
          <span class="k">{{ tradesWord(s.entries) }} · норма {{ session.settings().maxTrades }}</span>
        </div>
        <div class="stat">
          <span class="v"><span class="pos">{{ s.wins }}</span><span class="sep">/</span><span class="neg">{{ s.losses }}</span></span>
          <span class="k">плюс / минус</span>
        </div>
        <div class="stat" [class.alarm]="s.lossStreak >= session.settings().pauseAfterLosses">
          <span class="v">{{ s.lossStreak }}</span>
          <span class="k">убытков подряд</span>
        </div>
      </div>

      <div class="limit">
        @if (session.settings().dailyLossLimit; as limit) {
          @let usage = session.limitUsage() ?? 0;
          <div class="limit-head">
            <span>Лимит дня</span>
            <span class="mono">{{ money(-(s.net < 0 ? s.net : 0)) }} из {{ money(limit) }}</span>
          </div>
          <div class="bar" [class.warn]="usage >= 0.75" [class.hit]="usage >= 1">
            <i [style.width.%]="usage * 100 > 100 ? 100 : usage * 100"></i>
          </div>
        } @else {
          <div class="limit-head"><span>Лимит дня не задан</span></div>
          <a class="set-limit" routerLink="/settings/discipline">Задать правила →</a>
        }
      </div>

      <div class="side">
        @if (session.positions().length > 0) {
          <span class="open">
            {{ session.positions().length }} {{ positionsWord(session.positions().length) }}
            <b [class.pos]="session.unrealizedPnl() > 0" [class.neg]="session.unrealizedPnl() < 0">
              {{ money(session.unrealizedPnl(), true) }}
            </b>
          </span>
        } @else {
          <span class="open">позиций нет</span>
        }
        <span class="periods">
          неделя <b [class.pos]="weekNet() > 0" [class.neg]="weekNet() < 0">{{ money(weekNet(), true) }}</b>
          · месяц <b [class.pos]="monthNet() > 0" [class.neg]="monthNet() < 0">{{ money(monthNet(), true) }}</b>
        </span>
        <span class="note" [class]="'note ' + coach().tone">{{ coach().text }}</span>
      </div>
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; container-type: size; }

    .hero {
      display: grid;
      grid-template-columns: minmax(200px, 1.2fr) auto minmax(180px, 1fr) minmax(150px, auto);
      align-items: center;
      gap: $space-6;
      height: 100%;
      padding: $space-3 $space-6;
    }

    .main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .label { color: var(--fg-muted); font-size: $text-sm; }
    .value {
      @include figure(clamp(28px, 42cqh, 46px));
      color: var(--fg-default);
      white-space: nowrap;
      &.idle { color: var(--fg-subtle); font-size: clamp(22px, 30cqh, 30px); font-weight: 600; }
    }
    .sub { color: var(--fg-muted); font-size: $text-sm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .stats { display: flex; gap: $space-6; }
    .stat { display: flex; flex-direction: column; gap: 2px; }
    .stat .v { @include figure(24px, 600); color: var(--fg-default); }
    .stat .k { font-size: $text-xs; color: var(--fg-muted); white-space: nowrap; }
    .stat.alarm .v { color: var(--attention-fg); }
    .sep { color: var(--fg-subtle); margin: 0 3px; }

    .limit { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .limit-head { display: flex; justify-content: space-between; gap: $space-2; font-size: $text-sm; color: var(--fg-muted); }
    .mono { font-family: $font-mono; font-size: $text-xs; color: var(--fg-default); }
    .bar {
      height: 8px;
      border-radius: $radius-full;
      background: var(--canvas-inset);
      overflow: hidden;
      i { display: block; height: 100%; background: var(--fg-subtle); border-radius: inherit; transition: width $duration-slow $ease-out; }
      &.warn i { background: var(--attention-fg); }
      &.hit i { background: var(--danger-fg); }
    }
    .set-limit { font-size: $text-sm; color: var(--accent-fg); text-decoration: none; &:hover { text-decoration: underline; } }

    .side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; text-align: right; min-width: 0; }
    .open { font-size: $text-sm; color: var(--fg-muted); b { font-family: $font-mono; font-weight: 600; margin-left: 4px; } }
    .periods { font-size: $text-sm; color: var(--fg-muted); white-space: nowrap; b { font-family: $font-mono; font-weight: 600; } }
    .note { @include coach-voice(22px); color: var(--fg-muted); }
    .note.good { color: var(--success-fg); }
    .note.warn { color: var(--attention-fg); }
    .note.stop { color: var(--danger-fg); }

    .pos { color: var(--success-fg); }
    .neg { color: var(--danger-fg); }

    // Узкая полоса: прячем второстепенное, главное остаётся.
    @container (max-width: 980px) {
      .hero { grid-template-columns: minmax(180px, 1fr) minmax(160px, 1fr) minmax(140px, 0.8fr); gap: $space-4; }
      .stats { display: none; }
    }
    // Телефон: только итог дня — остальное есть ниже на листе.
    @container (max-width: 620px) {
      .hero { grid-template-columns: 1fr; gap: 0; padding: $space-2 $space-4; }
      .limit, .side { display: none; }
      .label { white-space: nowrap; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetDayHero extends WidgetBase {
  protected readonly session = inject(SessionStore);

  protected readonly todayLabel = computed(() => dayLabel(this.session.day()));

  /** С начала недели и месяца — то, что трейдер будет «закрывать». */
  protected readonly weekNet = computed(() =>
    currentPeriodNet(this.tradesStore.accountScoped(), 'week', this.session.day()),
  );
  protected readonly monthNet = computed(() =>
    currentPeriodNet(this.tradesStore.accountScoped(), 'month', this.session.day()),
  );

  /** Сегодня пусто — напоминаем, чем закончился последний торговый день. */
  protected readonly lastDay = computed(() => {
    const trades = this.tradesStore.accountScoped();
    const day = tradingDays(trades).find((d) => d !== this.session.day());
    if (!day) return null;
    const s = daySummary(trades, day);
    return { label: dayLabel(day), net: s.net, closed: s.closed };
  });

  /** Реплика тренера — одна, самая важная. */
  protected readonly coach = computed<{ text: string; tone: 'good' | 'warn' | 'stop' | 'calm' }>(() => {
    const s = this.session.summary();
    const rules = this.session.settings();
    const usage = this.session.limitUsage();
    if (usage !== null && usage >= 1) return { text: 'на сегодня всё', tone: 'stop' };
    if (s.lossStreak >= rules.pauseAfterLosses) return { text: 'пауза 15 минут', tone: 'warn' };
    if (s.entries > rules.maxTrades) return { text: 'хватит на сегодня?', tone: 'warn' };
    if (usage !== null && usage >= 0.75) return { text: 'лимит рядом — аккуратно', tone: 'warn' };
    if (s.closed === 0) return { text: 'рынок подождёт', tone: 'calm' };
    if (s.net > 0) return { text: 'держим план', tone: 'good' };
    return { text: 'спокойно, по плану', tone: 'calm' };
  });

  protected money(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }

  protected tradesWord(n: number): string {
    return plural(n, 'сделка', 'сделки', 'сделок');
  }

  protected positionsWord(n: number): string {
    return plural(n, 'открытая позиция', 'открытые позиции', 'открытых позиций');
  }
}

// ── Лента дня ───────────────────────────────────────────────────────────────

/**
 * День на одной оси времени: сверху — накопленный итог по закрытиям,
 * снизу — каждая сделка полоской от входа до выхода (цвет — результат).
 * По умолчанию — сегодня, а если сегодня пусто — последний торговый день.
 */
@Component({
  selector: 'app-widget-day-timeline',
  imports: [EChart, EmptyState, Icon],
  template: `
    <div class="wrap">
      <div class="head">
        <button type="button" class="nav" aria-label="Предыдущий день" [disabled]="!canPrev()" (click)="shift(1)">
          <app-icon name="chevron-left" style="--icon-size: 14px" />
        </button>
        <span class="day">{{ label() }}</span>
        <button type="button" class="nav" aria-label="Следующий день" [disabled]="!canNext()" (click)="shift(-1)">
          <app-icon name="chevron-right" style="--icon-size: 14px" />
        </button>
        @let s = summary();
        <span class="total" [class.pos]="s.net > 0" [class.neg]="s.net < 0">{{ money(s.net) }}</span>
        <span class="meta">{{ s.closed }} сд. · {{ s.wins }}/{{ s.losses }}</span>
      </div>
      @if (timeline().trades.length > 0) {
        <app-echart class="chart" [options]="options()" />
      } @else {
        <app-empty-state icon="clock" title="Сделок нет" description="Как только появится первая сделка, она встанет на ленту." />
      }
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; }
    .wrap { display: flex; flex-direction: column; height: 100%; padding: $space-1 $space-3 $space-2; }
    .head { display: flex; align-items: center; gap: 4px; flex: none; height: 30px; }
    .nav {
      appearance: none; display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; background: none; border: none; border-radius: $radius-sm;
      color: var(--fg-muted); cursor: pointer;
      &:hover:not(:disabled) { background: var(--border-muted); color: var(--fg-default); }
      &:disabled { opacity: 0.35; cursor: default; }
    }
    .day { font-weight: 600; font-size: $text-sm; min-width: 92px; text-align: center; }
    .total { margin-left: auto; font-family: $font-mono; font-weight: 600; font-size: $text-sm; }
    .meta { color: var(--fg-subtle); font-size: $text-xs; margin-left: $space-2; }
    .pos { color: var(--success-fg); }
    .neg { color: var(--danger-fg); }
    .chart { flex: 1; min-height: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetDayTimeline extends WidgetBase {
  private readonly session = inject(SessionStore);
  /** Сколько торговых дней назад от «стартового» дня. */
  private readonly offset = signal(0);

  /** Сегодня + торговые дни истории, новые первыми. */
  private readonly days = computed(() => {
    const today = this.session.day();
    const days = tradingDays(this.tradesStore.accountScoped());
    const hasToday = days.includes(today) || this.tradesStore.openTrades().length > 0;
    return hasToday && !days.includes(today) ? [today, ...days] : days.length ? days : [today];
  });

  private readonly day = computed(() => this.days()[Math.min(this.offset(), this.days().length - 1)]);
  protected readonly canPrev = computed(() => this.offset() < this.days().length - 1);
  protected readonly canNext = computed(() => this.offset() > 0);

  protected readonly label = computed(() => {
    const day = this.day();
    return day === this.session.day() ? `Сегодня, ${dayLabel(day).split(', ')[1]}` : dayLabel(day);
  });

  protected readonly summary = computed(() => daySummary(this.tradesStore.accountScoped(), this.day()));

  protected readonly timeline = computed(() =>
    dayTimeline(this.tradesStore.accountScoped(), this.day(), this.session.now()),
  );

  protected readonly options = computed<EChartsCoreOption>(() => {
    const tl = this.timeline();
    const pad = Math.max(5 * 60_000, (tl.to - tl.from) * 0.03);
    const min = tl.from - pad;
    const max = tl.to + pad;
    const lanes = Math.max(1, tl.lanes);
    const color = (pnl: number, open: boolean) => (open ? CHART.accent : pnl >= 0 ? CHART.pos : CHART.neg);
    const last = tl.curve[tl.curve.length - 1]?.[1] ?? 0;

    return {
      animation: false,
      tooltip: { ...baseTooltip(), trigger: 'item' },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [
        { left: 8, right: 12, top: 10, height: '50%', containLabel: true },
        { left: 8, right: 12, top: '64%', bottom: 22, containLabel: true },
      ],
      xAxis: [
        { type: 'time', gridIndex: 0, min, max, axisLabel: { show: false }, splitLine: { show: false } },
        {
          type: 'time',
          gridIndex: 1,
          min,
          max,
          splitLine: { show: true, lineStyle: { color: CHART.grid } },
          axisLabel: { formatter: (v: number) => hhmm(v), hideOverlap: true },
        },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          axisLabel: { formatter: (v: number) => formatMoneyAxis(v) },
          splitNumber: 3,
        },
        { type: 'value', gridIndex: 1, min: -0.6, max: lanes - 0.4, inverse: true, show: false },
      ],
      series: [
        {
          name: 'Итог дня',
          type: 'line',
          step: 'end',
          xAxisIndex: 0,
          yAxisIndex: 0,
          showSymbol: false,
          data: [...tl.curve.map(([t, v]) => [t, round2(v)])],
          lineStyle: { width: 2, color: last >= 0 ? CHART.pos : CHART.neg },
          areaStyle: { color: alpha(last >= 0 ? CHART.pos : CHART.neg, 0.1) },
          tooltip: {
            formatter: (p: { value: [number, number] }) => `${hhmm(p.value[0])}<br/>итог ${formatMoney(p.value[1], { sign: true })}`,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: CHART.border, type: 'dashed' },
            data: [{ yAxis: 0 }],
          },
        },
        {
          name: 'Сделки',
          type: 'lines',
          coordinateSystem: 'cartesian2d',
          xAxisIndex: 1,
          yAxisIndex: 1,
          polyline: false,
          data: tl.trades.map((t) => ({
            coords: [
              [t.start, t.lane],
              [Math.max(t.end, t.start + 60_000), t.lane],
            ],
            lineStyle: { color: color(t.pnl, t.trade.status === 'open'), width: 6, cap: 'round', opacity: 0.9 },
            trade: t,
          })),
          tooltip: {
            formatter: (p: { data: { trade: (typeof tl.trades)[number] } }) => {
              const t = p.data.trade;
              const side = t.trade.side === 'long' ? 'лонг' : 'шорт';
              const result = t.trade.status === 'open' ? 'открыта' : formatMoney(t.pnl, { sign: true });
              return `<b>${t.trade.symbol}</b> · ${side}<br/>${hhmm(t.start)}–${hhmm(t.end)} · ${formatSpan(t.end - t.start)}<br/>${result}`;
            },
          },
        },
      ],
    };
  });

  protected shift(delta: number): void {
    this.offset.update((v) => Math.max(0, Math.min(this.days().length - 1, v + delta)));
  }

  protected money(value: number): string {
    return formatMoney(value, { sign: true });
  }
}

// ── Предупреждения ──────────────────────────────────────────────────────────

/** Живые предупреждения дисциплины за сегодня — голосом тренера. */
@Component({
  selector: 'app-widget-alerts',
  imports: [RouterLink],
  template: `
    <div class="list">
      @for (alert of session.alerts(); track alert.id) {
        <div class="alert" [class]="'alert ' + alert.tone">
          <span class="dot"></span>
          <div class="body">
            <div class="title">{{ alert.title }}</div>
            <div class="text">{{ alert.text }}</div>
          </div>
          <span class="time">{{ time(alert.at) }}</span>
        </div>
      } @empty {
        <div class="calm">
          <div class="calm-title">всё спокойно</div>
          <p>{{ rulesText() }}</p>
          <a routerLink="/settings/discipline">Изменить правила →</a>
        </div>
      }
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; overflow-y: auto; @include styled-scrollbar; }
    .list { display: flex; flex-direction: column; gap: $space-2; padding: $space-2 $space-3 $space-3; }
    .alert {
      display: grid;
      grid-template-columns: 8px 1fr auto;
      gap: $space-2 $space-3;
      align-items: start;
      padding: $space-2 $space-3;
      border-radius: $radius-lg;
      background: var(--attention-subtle);
      &.danger { background: var(--danger-subtle); }
    }
    .dot { width: 8px; height: 8px; margin-top: 8px; border-radius: 50%; background: var(--attention-fg); }
    .danger .dot { background: var(--danger-fg); }
    .title { @include coach-voice(19px); color: var(--attention-fg); }
    .danger .title { color: var(--danger-fg); }
    .text { font-size: $text-sm; color: var(--fg-default); line-height: 1.4; }
    .time { font-family: $font-mono; font-size: $text-xs; color: var(--fg-subtle); margin-top: 4px; }

    .calm { padding: $space-2 $space-1; }
    .calm-title { @include coach-voice(22px); color: var(--success-fg); }
    .calm p { margin: $space-1 0 $space-2; font-size: $text-sm; color: var(--fg-muted); line-height: 1.45; }
    .calm a { font-size: $text-sm; color: var(--accent-fg); text-decoration: none; &:hover { text-decoration: underline; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetAlerts extends WidgetBase {
  protected readonly session = inject(SessionStore);
  protected readonly rulesText = computed(() => {
    const r = this.session.settings();
    const limit = r.dailyLossLimit ? `, лимит дня ${formatMoney(r.dailyLossLimit)}` : '';
    return (
      `Сегодня правила не нарушены. Норма — ${r.maxTrades} сделок в день, пауза после ` +
      `${r.pauseAfterLosses} убытков подряд, реванш — вход в ту же монету в течение ` +
      `${r.revengeMinutes} мин после убытка${limit}.`
    );
  });

  protected time(ms: number): string {
    return localDay(ms) === this.session.day() ? hhmm(ms) : '';
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
