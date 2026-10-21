import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, booleanAttribute, inject, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { apiErrorMessage, errorText } from '../../core/http/api-error';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { AccountsStore } from './accounts-store';
import { EXCHANGES } from './data/account.model';

/** Страница управления API-ключами Binance. */
export const BINANCE_API_URL = 'https://www.binance.com/ru/my/settings/api-management';

/**
 * Подключение биржевого аккаунта read-only ключом. Ключ проверяется на
 * бирже сразу: если у него есть права торговли или вывода — отказ с
 * перечнем прав, которые нужно снять.
 */
@Component({
  selector: 'app-exchange-key-form',
  imports: [FormField, Button, Icon],
  template: `
    <form class="form" novalidate (submit)="$event.preventDefault(); connect()">
      @if (showExchanges()) {
        <div class="exchanges" role="radiogroup" aria-label="Биржа">
          @for (ex of exchanges; track ex.id) {
            <span
              class="exchange"
              role="radio"
              [attr.aria-checked]="ex.available"
              [attr.aria-disabled]="!ex.available"
              [class.active]="ex.available"
            >
              <span class="mark" [style.background]="ex.color + '22'" [style.color]="ex.color">{{ ex.mark }}</span>
              <span class="ex-name">{{ ex.label }}</span>
              @if (ex.available) {
                <span class="ex-market">{{ ex.market }}</span>
              } @else {
                <span class="soon">скоро</span>
              }
            </span>
          }
        </div>
      }

      <div class="tj-field">
        <label for="key-api">API Key</label>
        <input
          id="key-api"
          class="tj-input tj-input--mono"
          autocomplete="off"
          spellcheck="false"
          placeholder="64 символа из Binance"
          [formField]="keyForm.apiKey"
        />
        @if (keyForm.apiKey().touched() && keyForm.apiKey().invalid()) {
          <span class="tj-error">{{ keyForm.apiKey().errors()[0]?.message }}</span>
        }
      </div>

      <div class="tj-field">
        <label for="key-secret">Secret Key</label>
        <div class="secret">
          <input
            id="key-secret"
            class="tj-input tj-input--mono"
            autocomplete="off"
            spellcheck="false"
            [type]="showSecret() ? 'text' : 'password'"
            [formField]="keyForm.apiSecret"
          />
          <button
            type="button"
            class="reveal"
            [attr.aria-label]="showSecret() ? 'Скрыть секрет' : 'Показать секрет'"
            (click)="showSecret.set(!showSecret())"
          >
            <app-icon [name]="showSecret() ? 'eye-off' : 'eye'" style="--icon-size: 15px" />
          </button>
        </div>
        @if (keyForm.apiSecret().touched() && keyForm.apiSecret().invalid()) {
          <span class="tj-error">{{ keyForm.apiSecret().errors()[0]?.message }}</span>
        }
      </div>

      <div class="tj-field">
        <label for="key-label">Название</label>
        <input id="key-label" class="tj-input" autocomplete="off" [formField]="keyForm.label" />
        @if (keyForm.label().touched() && keyForm.label().invalid()) {
          <span class="tj-error">{{ keyForm.label().errors()[0]?.message }}</span>
        } @else {
          <span class="hint">Чтобы отличать счета, если подключите несколько</span>
        }
      </div>

      @if (serverError()) {
        <div class="server-error" role="alert">{{ serverError() }}</div>
      }

      <div class="actions">
        <button app-button variant="primary" type="submit" [disabled]="busy()">
          @if (busy()) {
            Проверяем ключ на Binance…
          } @else {
            <app-icon name="link" style="--icon-size: 14px" />
            Подключить
          }
        </button>
        @if (cancelable()) {
          <button app-button variant="ghost" type="button" (click)="cancelled.emit()">Отмена</button>
        }
      </div>

      <p class="safety">
        <app-icon name="info" style="--icon-size: 13px" />
        Ключ хранится в отдельном зашифрованном хранилище и используется только для чтения истории.
        Ключ с правами торговли или вывода мы не примем.
      </p>
    </form>
  `,
  styles: `
    @use 'styles/index' as *;

    .form {
      display: flex;
      flex-direction: column;
      gap: $space-4;
    }

    .exchanges {
      display: flex;
      flex-wrap: wrap;
      gap: $space-2;
    }

    .exchange {
      display: inline-flex;
      align-items: center;
      gap: $space-2;
      height: 34px;
      padding: 0 $space-3 0 5px;
      border: 1px solid var(--border-muted);
      border-radius: $radius-lg;
      color: var(--fg-subtle);
      font-size: $text-sm;

      &.active {
        border-color: var(--accent-fg);
        color: var(--fg-default);
        box-shadow: 0 0 0 3px var(--accent-subtle);
      }
    }

    .mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: $radius-md;
      font-size: $text-xs;
      font-weight: 700;
    }

    .exchange:not(.active) .mark { filter: grayscale(1); opacity: 0.6; }

    .ex-name { font-weight: 600; }
    .ex-market { color: var(--fg-muted); font-size: $text-xs; }

    .soon {
      padding: 0 6px;
      border-radius: $radius-full;
      background: var(--canvas-overlay);
      font-size: $text-xs;
    }

    .secret {
      position: relative;

      .tj-input { padding-right: 40px; }
    }

    .reveal {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
      display: flex;
      padding: 5px;
      background: none;
      border: none;
      border-radius: $radius-sm;
      color: var(--fg-subtle);
      cursor: pointer;

      &:hover { color: var(--fg-default); }
    }

    .hint {
      color: var(--fg-subtle);
      font-size: $text-xs;
    }

    .server-error {
      padding: $space-2 $space-3;
      border-radius: $radius-md;
      background: var(--danger-subtle);
      color: var(--danger-fg);
      font-size: $text-sm;
      line-height: 1.45;
    }

    .actions {
      display: flex;
      gap: $space-2;
    }

    .safety {
      display: flex;
      gap: $space-2;
      margin: 0;
      color: var(--fg-subtle);
      font-size: $text-xs;
      line-height: 1.5;

      app-icon { flex: none; margin-top: 2px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExchangeKeyForm {
  private readonly store = inject(AccountsStore);

  /** Показать выбор биржи (Binance; остальные — «скоро»). */
  readonly showExchanges = input(true, { transform: booleanAttribute });
  readonly cancelable = input(false, { transform: booleanAttribute });
  readonly connected = output<void>();
  readonly cancelled = output<void>();

  protected readonly exchanges = EXCHANGES;
  protected readonly showSecret = signal(false);
  protected readonly busy = signal(false);
  protected readonly serverError = signal('');

  protected readonly model = signal({ label: defaultLabel(this.store.accounts().length), apiKey: '', apiSecret: '' });
  protected readonly keyForm = form(this.model, (p) => {
    required(p.apiKey, { message: 'Вставьте API Key' });
    minLength(p.apiKey, 16, { message: 'Ключ выглядит обрезанным — у Binance это 64 символа' });
    required(p.apiSecret, { message: 'Вставьте Secret Key' });
    minLength(p.apiSecret, 16, { message: 'Секрет выглядит обрезанным — у Binance это 64 символа' });
    required(p.label, { message: 'Как назвать счёт?' });
    maxLength(p.label, 100, { message: 'Не длиннее 100 символов' });
  });

  protected connect(): void {
    submit(this.keyForm, async () => {
      const m = this.model();
      this.busy.set(true);
      this.serverError.set('');
      try {
        await this.store.create({ label: m.label.trim(), apiKey: m.apiKey.trim(), apiSecret: m.apiSecret.trim() });
        this.connected.emit();
      } catch (error) {
        this.serverError.set(keyErrorMessage(error));
      } finally {
        this.busy.set(false);
      }
    });
  }
}

function defaultLabel(existing: number): string {
  return existing === 0 ? 'Binance Futures' : `Binance Futures ${existing + 1}`;
}

/** 422 — ключ не read-only: API перечисляет, какие права снять. */
function keyErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 422) {
    const details = errorText(error);
    return details
      ? `Нужен ключ только для чтения — отключите в Binance лишние права. Ответ биржи: ${details}`
      : 'Нужен ключ только для чтения — отключите в Binance права торговли, вывода и переводов.';
  }
  if (error instanceof HttpErrorResponse && error.status === 409 && !errorText(error)?.includes('label')) {
    return 'Этот аккаунт Binance уже подключён';
  }
  return apiErrorMessage(error, 'Не удалось подключить ключ');
}
