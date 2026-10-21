import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatDate } from '../trades/data/trade.model';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { ToastService } from '../../shared/ui/toast';
import { apiErrorMessage } from '../../core/http/api-error';
import { AccountsStore } from './accounts-store';
import { BinanceKeyGuide } from './binance-key-guide';
import { ExchangeKeyForm } from './exchange-key-form';
import { Account, SYNC_STATUS, exchangeMeta } from './data/account.model';

/** Настройки → Биржа: подключённые аккаунты и подключение нового ключа. */
@Component({
  selector: 'app-exchange-settings',
  imports: [Button, Icon, Skeleton, BinanceKeyGuide, ExchangeKeyForm],
  template: `
    <header class="head">
      <h2>Биржевой аккаунт</h2>
      <p>Сделки попадают в журнал сами — по API-ключу только для чтения. Сейчас поддерживаем Binance USDⓈ-M Futures.</p>
    </header>

    @if (!store.hasLoaded() && !store.error()) {
      <app-skeleton height="120px" />
    } @else if (store.error() && !store.hasLoaded()) {
      <div class="load-error">
        Не удалось загрузить счета. {{ errorText() }}
        <button app-button variant="outline" size="sm" (click)="store.reload()">Повторить</button>
      </div>
    } @else if (!store.hasAccounts() || adding()) {
      <div class="connect">
        <section class="guide">
          <h3>Как получить ключ</h3>
          <app-binance-key-guide />
        </section>
        <section class="form">
          <h3>{{ store.hasAccounts() ? 'Ещё один аккаунт' : 'Ключ' }}</h3>
          <app-exchange-key-form [cancelable]="store.hasAccounts()" (connected)="onConnected()" (cancelled)="adding.set(false)" />
        </section>
      </div>
    } @else {
      <ul class="accounts">
        @for (account of store.accounts(); track account.id) {
          <li class="account">
            <span class="mark" [style.background]="meta(account).color + '22'" [style.color]="meta(account).color">
              {{ meta(account).mark }}
            </span>
            <div class="info">
              <div class="name">
                {{ account.label }}
                <span class="market">{{ meta(account).label }} {{ meta(account).market }}</span>
              </div>
              <div class="status" [class]="'tone-' + status(account).tone">
                <i class="dot"></i>
                <span>{{ status(account).label }}</span>
                <span class="status-hint">· {{ statusHint(account) }}</span>
              </div>
              @if ((account.status === 'key_rejected' || account.status === 'error') && account.lastError) {
                <div class="error-text">{{ account.lastError }}</div>
              }
            </div>
            <span class="since">с {{ date(account.createdAt) }}</span>
            <button
              app-button
              variant="ghost"
              size="sm"
              [disabled]="removingId() === account.id"
              (click)="remove(account)"
            >
              <app-icon name="trash" style="--icon-size: 13px" />
              Удалить
            </button>
          </li>
        }
      </ul>
      <button app-button variant="outline" size="sm" class="add" (click)="adding.set(true)">
        <app-icon name="plus" style="--icon-size: 13px" />
        Подключить ещё аккаунт
      </button>
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; }

    .head {
      margin-bottom: $space-5;

      h2 { margin: 0; font-size: $text-lg; font-weight: 650; }

      p {
        margin: $space-1 0 0;
        max-width: 620px;
        color: var(--fg-muted);
        font-size: $text-sm;
        line-height: 1.5;
      }
    }

    h3 {
      margin: 0 0 $space-3;
      font-size: $text-sm;
      font-weight: 600;
      color: var(--fg-default);
    }

    .connect {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      gap: $space-8;
      align-items: start;

      @media (max-width: 960px) { grid-template-columns: minmax(0, 1fr); gap: $space-6; }
    }

    .accounts {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
      border-top: 1px solid var(--border-muted);
    }

    .account {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: $space-3;
      padding: $space-3 0;
      border-bottom: 1px solid var(--border-muted);
    }

    .mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: $radius-md;
      font-size: $text-sm;
      font-weight: 700;
    }

    .name {
      font-size: $text-md;
      font-weight: 600;

      .market {
        margin-left: $space-2;
        color: var(--fg-subtle);
        font-size: $text-xs;
        font-weight: 500;
      }
    }

    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
      font-size: $text-xs;
      font-weight: 600;

      .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
      .status-hint { color: var(--fg-muted); font-weight: 400; }

      &.tone-ok { color: var(--success-fg); }
      &.tone-progress { color: var(--accent-fg); }
      &.tone-warn { color: var(--attention-fg); }
      &.tone-danger { color: var(--danger-fg); }
      &.tone-progress .dot { animation: pulse 1.6s ease-in-out infinite; }
    }

    @keyframes pulse { 50% { opacity: 0.3; } }

    @media (prefers-reduced-motion: reduce) {
      .status.tone-progress .dot { animation: none; }
    }

    .error-text {
      margin-top: $space-1;
      color: var(--danger-fg);
      font-size: $text-xs;
    }

    .since {
      color: var(--fg-subtle);
      font-size: $text-xs;
      white-space: nowrap;
    }

    .add { margin-top: $space-4; }

    .load-error {
      display: flex;
      align-items: center;
      gap: $space-3;
      color: var(--danger-fg);
      font-size: $text-sm;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExchangeSettings {
  protected readonly store = inject(AccountsStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly adding = signal(false);
  protected readonly removingId = signal<string | null>(null);

  protected readonly meta = (account: Account) => exchangeMeta(account.exchange);
  protected readonly status = (account: Account) => SYNC_STATUS[account.status];
  protected readonly date = formatDate;

  protected readonly errorText = computed(() => apiErrorMessage(this.store.error()));

  protected statusHint(account: Account): string {
    if (account.status === 'live') {
      const parts = ['новые сделки появляются сами'];
      if (account.historyFrom) parts.push(`история с ${formatDate(account.historyFrom)}`);
      if (account.openPositions > 0) parts.push(`открытых позиций: ${account.openPositions}`);
      return parts.join(' · ');
    }
    return SYNC_STATUS[account.status].hint.toLowerCase();
  }

  protected onConnected(): void {
    this.adding.set(false);
    this.toast.success('Ключ принят — загружаем историю сделок');
  }

  protected async remove(account: Account): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Удалить «${account.label}»?`,
      message:
        'Ключ удалится из хранилища, а вся записанная история сделок этого аккаунта — безвозвратно. Подключить его можно будет заново, история импортируется за ~3 месяца.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    this.removingId.set(account.id);
    try {
      await this.store.remove(account.id);
      this.toast.info(`«${account.label}» удалён`);
    } catch (error) {
      this.toast.error(apiErrorMessage(error, 'Не удалось удалить счёт'));
    } finally {
      this.removingId.set(null);
    }
  }
}
