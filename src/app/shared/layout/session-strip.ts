import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../../features/analytics/session-store';
import { WorkspacesStore } from '../../features/dashboard/workspaces-store';
import { formatMoney } from '../../features/trades/data/trade.model';
import { plural } from '../../features/analytics/data/behavior';

/**
 * Строка сессии в шапке — на всех страницах: итог дня, сделки против нормы,
 * лимит, серия и открытые позиции. Клик — лист «Сегодня».
 */
@Component({
  selector: 'app-session-strip',
  template: `
    @let s = session.summary();
    <button type="button" class="strip" [class.alarm]="alarm()" (click)="openToday()" title="Открыть лист «Сегодня»">
      <span class="live" aria-hidden="true"></span>
      <span class="k">Сегодня</span>
      @if (s.closed > 0 || s.entries > 0) {
        <span class="pnl" [class.pos]="s.net > 0" [class.neg]="s.net < 0">{{ money(s.net, true) }}</span>
        <span class="item" [class.warn]="s.entries > rules().maxTrades">
          {{ s.entries }}<span class="of">/{{ rules().maxTrades }}</span> сд
        </span>
      } @else {
        <span class="idle">без сделок</span>
      }
      @if (session.limitUsage() !== null) {
        @let usage = session.limitUsage() ?? 0;
        <span class="item limit" [class.warn]="usage >= 0.75" [class.hit]="usage >= 1">
          <span class="bar"><i [style.width.%]="usage > 1 ? 100 : usage * 100"></i></span>
          {{ percent(usage) }} лимита
        </span>
      }
      @if (s.lossStreak >= rules().pauseAfterLosses) {
        <span class="item warn streak">{{ s.lossStreak }} {{ lossesWord(s.lossStreak) }} подряд</span>
      }
      @if (session.positions().length > 0) {
        <span class="item positions">
          {{ session.positions().length }} поз.
          <b [class.pos]="session.unrealizedPnl() > 0" [class.neg]="session.unrealizedPnl() < 0">
            {{ money(session.unrealizedPnl(), true) }}
          </b>
        </span>
      }
    </button>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: flex; min-width: 0; margin-left: $space-2; }
    @media (max-width: 760px) { :host { margin-left: 0; } }

    .strip {
      appearance: none;
      display: flex;
      align-items: center;
      gap: $space-3;
      min-width: 0;
      height: 36px;
      padding: 0 $space-3;
      background: var(--canvas-subtle);
      border: 1px solid var(--border-muted);
      border-radius: $radius-lg;
      color: var(--fg-muted);
      font: inherit;
      font-size: $text-sm;
      white-space: nowrap;
      cursor: pointer;
      transition: border-color $duration-fast $ease-apple, background $duration-fast $ease-apple;

      &:hover { border-color: var(--border-default); background: var(--canvas-overlay); }
      &.alarm { border-color: var(--attention-muted); }
    }

    .live {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--success-fg);
      box-shadow: 0 0 0 3px var(--success-subtle);
      flex: none;
    }

    .k { color: var(--fg-muted); }
    .idle { color: var(--fg-subtle); }

    .pnl {
      @include figure(16px, 650);
      color: var(--fg-default);
    }

    .item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding-left: $space-3;
      border-left: 1px solid var(--border-muted);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .of { color: var(--fg-subtle); }
    .warn { color: var(--attention-fg); }
    .hit { color: var(--danger-fg); }

    .bar {
      width: 54px;
      height: 6px;
      border-radius: 3px;
      background: var(--canvas-inset);
      overflow: hidden;
      i { display: block; height: 100%; background: var(--fg-subtle); }
    }
    .limit.warn .bar i { background: var(--attention-fg); }
    .limit.hit .bar i { background: var(--danger-fg); }

    .positions b { font-family: $font-mono; font-weight: 600; }
    .pos { color: var(--success-fg); }
    .neg { color: var(--danger-fg); }

    // Узкая шапка: остаются итог и сделки.
    @media (max-width: 1100px) {
      .positions, .streak { display: none; }
    }
    @media (max-width: 760px) {
      .strip { gap: $space-2; padding: 0 $space-2; }
      .k, .limit { display: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionStrip {
  protected readonly session = inject(SessionStore);
  private readonly workspaces = inject(WorkspacesStore);
  private readonly router = inject(Router);

  protected readonly rules = this.session.settings;

  protected readonly alarm = computed(() => this.session.alerts().length > 0);

  protected openToday(): void {
    const today = this.workspaces.workspaces().find((ws) => ws.name === 'Сегодня');
    if (today) this.workspaces.setActive(today.id);
    void this.router.navigate(['/dashboard']);
  }

  protected money(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }

  protected percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  protected lossesWord(n: number): string {
    return plural(n, 'убыток', 'убытка', 'убытков');
  }
}
