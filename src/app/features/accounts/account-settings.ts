import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required, submit, validate } from '@angular/forms/signals';
import { AuthApi } from '../../core/auth/auth-api';
import { AuthStore } from '../../core/auth/auth-store';
import { CODE_PATTERN, normalizeCode, passwordProblem } from '../../core/auth/auth.model';
import { apiErrorMessage } from '../../core/http/api-error';
import { formatDate } from '../trades/data/trade.model';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast';

/** Настройки → Аккаунт: email, смена пароля кодом из письма, выход. */
@Component({
  selector: 'app-account-settings',
  imports: [FormField, Button, Icon],
  template: `
    <header class="head">
      <h2>Аккаунт</h2>
    </header>

    <dl class="props">
      <dt>Email</dt>
      <dd>{{ auth.user()?.email }}</dd>
      <dt>Регистрация</dt>
      <dd>{{ registered() }}</dd>
    </dl>

    <section class="block">
      <h3>Пароль</h3>
      @if (step() === 'idle') {
        <p class="muted">Пришлём код на {{ auth.user()?.email }} — им подтвердите новый пароль.</p>
        @if (serverError()) {
          <div class="server-error" role="alert">{{ serverError() }}</div>
        }
        <button app-button variant="outline" size="sm" [disabled]="busy()" (click)="sendCode()">
          {{ busy() ? 'Отправляем…' : 'Сменить пароль' }}
        </button>
      } @else {
        <form class="form" novalidate (submit)="$event.preventDefault(); changePassword()">
          <p class="muted">Код отправлен на {{ auth.user()?.email }}. После смены пароля войдите заново на всех устройствах.</p>
          <div class="tj-field">
            <label for="pw-code">Код из письма</label>
            <input id="pw-code" class="tj-input tj-input--mono" autocomplete="one-time-code" [formField]="passwordForm.code" />
            @if (passwordForm.code().touched() && passwordForm.code().invalid()) {
              <span class="tj-error">{{ passwordForm.code().errors()[0]?.message }}</span>
            }
          </div>
          <div class="tj-field">
            <label for="pw-new">Новый пароль</label>
            <input id="pw-new" class="tj-input" type="password" autocomplete="new-password" [formField]="passwordForm.password" />
            @if (passwordForm.password().touched() && passwordForm.password().invalid()) {
              <span class="tj-error">{{ passwordForm.password().errors()[0]?.message }}</span>
            }
          </div>
          @if (serverError()) {
            <div class="server-error" role="alert">{{ serverError() }}</div>
          }
          <div class="actions">
            <button app-button variant="primary" size="sm" type="submit" [disabled]="busy()">
              {{ busy() ? 'Сохраняем…' : 'Сменить пароль' }}
            </button>
            <button app-button variant="ghost" size="sm" type="button" (click)="step.set('idle')">Отмена</button>
          </div>
        </form>
      }
    </section>

    <section class="block">
      <button app-button variant="outline" size="sm" (click)="auth.logout()">
        <app-icon name="logout" style="--icon-size: 13px" />
        Выйти из аккаунта
      </button>
    </section>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; max-width: 520px; }

    .head h2 { margin: 0 0 $space-4; font-size: $text-lg; font-weight: 650; }

    .props {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: $space-2 $space-4;
      margin: 0;
      font-size: $text-sm;

      dt { color: var(--fg-muted); }
      dd { margin: 0; font-weight: 500; }
    }

    .block {
      margin-top: $space-6;
      padding-top: $space-5;
      border-top: 1px solid var(--border-muted);

      h3 { margin: 0 0 $space-2; font-size: $text-sm; font-weight: 600; }
    }

    .muted {
      margin: 0 0 $space-3;
      color: var(--fg-muted);
      font-size: $text-sm;
      line-height: 1.5;
    }

    .form { display: flex; flex-direction: column; gap: $space-3; }
    .actions { display: flex; gap: $space-2; }

    .server-error {
      margin-bottom: $space-3;
      padding: $space-2 $space-3;
      border-radius: $radius-md;
      background: var(--danger-subtle);
      color: var(--danger-fg);
      font-size: $text-sm;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettings {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(AuthApi);
  private readonly toast = inject(ToastService);

  protected readonly registered = computed(() => {
    const at = this.auth.user()?.registeredAt;
    return at ? formatDate(at) : '—';
  });

  protected readonly step = signal<'idle' | 'code'>('idle');
  protected readonly busy = signal(false);
  protected readonly serverError = signal('');

  protected readonly model = signal({ code: '', password: '' });
  protected readonly passwordForm = form(this.model, (p) => {
    required(p.code, { message: 'Введите код' });
    validate(p.code, ({ value }) =>
      value() && !CODE_PATTERN.test(normalizeCode(value()))
        ? { kind: 'code', message: '8 символов: латинские буквы и цифры' }
        : undefined,
    );
    required(p.password, { message: 'Придумайте новый пароль' });
    validate(p.password, ({ value }) => {
      const problem = value() ? passwordProblem(value()) : null;
      return problem ? { kind: 'password', message: problem } : undefined;
    });
  });

  protected async sendCode(): Promise<void> {
    const email = this.auth.user()?.email;
    if (!email) return;
    this.busy.set(true);
    this.serverError.set('');
    try {
      await this.api.requestPasswordReset(email);
      this.model.set({ code: '', password: '' });
      this.step.set('code');
    } catch (error) {
      this.serverError.set(apiErrorMessage(error, 'Не удалось отправить код'));
    } finally {
      this.busy.set(false);
    }
  }

  protected changePassword(): void {
    submit(this.passwordForm, async () => {
      const email = this.auth.user()?.email;
      if (!email) return;
      this.busy.set(true);
      this.serverError.set('');
      try {
        await this.api.confirmPasswordReset(email, normalizeCode(this.model().code), this.model().password);
        // Смена пароля отзывает все сессии — входим заново.
        this.toast.success('Пароль изменён — войдите с новым паролем');
        await this.auth.logout();
      } catch (error) {
        this.serverError.set(apiErrorMessage(error, 'Не удалось сменить пароль'));
      } finally {
        this.busy.set(false);
      }
    });
  }
}
