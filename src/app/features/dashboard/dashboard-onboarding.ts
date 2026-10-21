import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AccountsStore } from '../accounts/accounts-store';
import { BinanceKeyGuide } from '../accounts/binance-key-guide';
import { ExchangeKeyForm } from '../accounts/exchange-key-form';
import { Account, SYNC_STATUS } from '../accounts/data/account.model';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast';

/**
 * Первый вход: ключ ещё не подключён (или история только импортируется).
 * Ведём за руку прямо здесь — создать ключ, вставить, дождаться импорта, —
 * не отправляя искать настройки.
 */
@Component({
  selector: 'app-dashboard-onboarding',
  imports: [BinanceKeyGuide, ExchangeKeyForm, Icon],
  template: `
    <div class="onboarding">
      <header class="intro">
        @if (connected()) {
          <h1>Ключ подключён — загружаем историю</h1>
          <p>Как только придут первые сделки, здесь появится дашборд.</p>
        } @else {
          <h1>Подключите Binance — журнал заполнится сам</h1>
          <p>
            Сделки, комиссии, фандинг и P&L мы берём из истории вашего аккаунта Binance USDⓈ-M Futures.
            Нужен API-ключ только для чтения: торговать или выводить средства с ним нельзя.
          </p>
        }
      </header>

      <ol class="steps">
        <li class="step" [class.done]="connected()" [class.current]="!connected()">
          <span class="num">
            @if (connected()) {
              <app-icon name="check" style="--icon-size: 14px" />
            } @else {
              1
            }
          </span>
          <div class="body">
            <h2>Создайте ключ на Binance</h2>
            @if (!connected()) {
              <app-binance-key-guide />
            }
          </div>
        </li>

        <li class="step" [class.done]="connected()" [class.current]="!connected()">
          <span class="num">
            @if (connected()) {
              <app-icon name="check" style="--icon-size: 14px" />
            } @else {
              2
            }
          </span>
          <div class="body">
            <h2>Вставьте ключ</h2>
            @if (connected()) {
              <p class="muted">Ключ принят: {{ account()?.label }}</p>
            } @else {
              <app-exchange-key-form [showExchanges]="false" (connected)="onConnected()" />
            }
          </div>
        </li>

        <li class="step" [class.current]="connected()">
          <span class="num">3</span>
          <div class="body">
            <h2>Загрузим историю</h2>
            <p class="muted">
              Подтянем сделки за последние ~3 месяца — обычно это несколько минут. Дашборд оживёт сам,
              страницу можно не обновлять и даже закрыть.
            </p>
            @if (account(); as acc) {
              <div class="progress" role="status">
                <i class="spinner"></i>
                {{ statusText() }}
              </div>
            }
          </div>
        </li>
      </ol>
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: block;
      padding: $space-8 $space-6;
    }

    .onboarding {
      max-width: 720px;
      margin: 0 auto;
    }

    .intro {
      margin-bottom: $space-8;

      h1 {
        margin: 0;
        font-family: $font-hand;
        font-size: 30px;
        font-weight: 400;
        line-height: 1.2;
      }

      p {
        margin: $space-3 0 0;
        color: var(--fg-muted);
        font-size: $text-md;
        line-height: 1.55;
      }
    }

    .steps {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .step {
      position: relative;
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      gap: $space-4;
      padding-bottom: $space-6;

      // Линия, связывающая шаги.
      &:not(:last-child)::before {
        content: '';
        position: absolute;
        top: 36px;
        bottom: 4px;
        left: 15px;
        width: 2px;
        background: var(--border-muted);
      }
    }

    .num {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--border-default);
      color: var(--fg-subtle);
      font-family: $font-mono;
      font-size: $text-sm;
      font-weight: 600;
    }

    .step.current .num {
      border-color: var(--accent-fg);
      background: var(--accent-subtle);
      color: var(--accent-fg);
    }

    .step.done .num {
      border-color: var(--success-fg);
      background: var(--success-subtle);
      color: var(--success-fg);
    }

    .body {
      min-width: 0;
      padding-top: 5px;

      h2 {
        margin: 0 0 $space-3;
        font-size: $text-md;
        font-weight: 600;
        color: var(--fg-default);
      }
    }

    .step:not(.current):not(.done) .body h2 { color: var(--fg-muted); }

    .muted {
      margin: 0;
      color: var(--fg-muted);
      font-size: $text-sm;
      line-height: 1.5;
    }

    .progress {
      display: inline-flex;
      align-items: center;
      gap: $space-2;
      margin-top: $space-3;
      padding: $space-2 $space-3;
      border-radius: $radius-md;
      background: var(--accent-subtle);
      color: var(--accent-fg);
      font-size: $text-sm;
      font-weight: 500;
    }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (prefers-reduced-motion: reduce) {
      .spinner { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardOnboarding {
  private readonly accounts = inject(AccountsStore);
  private readonly toast = inject(ToastService);

  protected readonly account = computed<Account | null>(() => this.accounts.accounts()[0] ?? null);
  protected readonly connected = computed(() => this.account() !== null);

  protected readonly statusText = computed(() => {
    const account = this.account();
    if (!account) return '';
    if (account.status === 'pending') return 'Ключ принят, импорт вот-вот начнётся…';
    if (account.status === 'importing') return 'Импортируем сделки с Binance…';
    return SYNC_STATUS[account.status].hint;
  });

  protected onConnected(): void {
    this.toast.success('Ключ принят — загружаем историю сделок');
  }
}
