import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormField, email, form, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthApi } from '../../core/auth/auth-api';
import { CODE_PATTERN, normalizeCode, passwordProblem } from '../../core/auth/auth.model';
import { apiErrorMessage } from '../../core/http/api-error';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast';
import { AuthLayout } from './auth-layout';

/** Восстановление пароля: код на почту, затем код и новый пароль. */
@Component({
  selector: 'app-restore',
  imports: [AuthLayout, FormField, RouterLink, Button, Icon],
  template: `
    <app-auth-layout
      title="Восстановление пароля"
      [subtitle]="
        codeSent()
          ? 'Код отправлен на ' + model().email + '. Введите его и новый пароль.'
          : 'Пришлём на почту код для смены пароля'
      "
    >
      @if (!codeSent()) {
        <form class="form" novalidate (submit)="$event.preventDefault(); sendCode()">
          <div class="tj-field">
            <label for="restore-email">Email</label>
            <input id="restore-email" class="tj-input" type="email" autocomplete="email" [formField]="emailForm.email" />
            @if (emailForm.email().touched() && emailForm.email().invalid()) {
              <span class="tj-error">{{ emailForm.email().errors()[0]?.message }}</span>
            }
          </div>
          @if (serverError()) {
            <div class="server-error" role="alert">{{ serverError() }}</div>
          }
          <button app-button variant="primary" class="submit" type="submit" [disabled]="busy()">
            {{ busy() ? 'Отправляем…' : 'Получить код' }}
          </button>
        </form>
      } @else {
        <form class="form" novalidate (submit)="$event.preventDefault(); changePassword()">
          <div class="tj-field">
            <label for="restore-code">Код из письма</label>
            <input
              id="restore-code"
              class="tj-input code"
              autocomplete="one-time-code"
                placeholder="XXXXXXXX"
              [formField]="resetForm.code"
            />
            @if (resetForm.code().touched() && resetForm.code().invalid()) {
              <span class="tj-error">{{ resetForm.code().errors()[0]?.message }}</span>
            }
          </div>
          <div class="tj-field">
            <label for="restore-password">Новый пароль</label>
            <div class="secret">
              <input
                id="restore-password"
                class="tj-input"
                autocomplete="new-password"
                [type]="showPassword() ? 'text' : 'password'"
                [formField]="resetForm.password"
              />
              <button
                type="button"
                class="reveal"
                [attr.aria-label]="showPassword() ? 'Скрыть пароль' : 'Показать пароль'"
                (click)="showPassword.set(!showPassword())"
              >
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" style="--icon-size: 15px" />
              </button>
            </div>
            @if (resetForm.password().touched() && resetForm.password().invalid()) {
              <span class="tj-error">{{ resetForm.password().errors()[0]?.message }}</span>
            } @else {
              <span class="hint">8–64 символа: строчная и заглавная латинские буквы, цифра и спецсимвол</span>
            }
          </div>
          @if (serverError()) {
            <div class="server-error" role="alert">{{ serverError() }}</div>
          }
          <button app-button variant="primary" class="submit" type="submit" [disabled]="busy()">
            {{ busy() ? 'Сохраняем…' : 'Сменить пароль' }}
          </button>
          <div class="secondary">
            <button app-button variant="ghost" size="sm" type="button" (click)="codeSent.set(false)">
              Другой email
            </button>
          </div>
        </form>
      }

      <p class="footer" auth-footer>
        <a routerLink="/login" [queryParams]="{ email: model().email || null }">Вернуться ко входу</a>
      </p>
    </app-auth-layout>
  `,
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Restore {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly email = input<string>();

  protected readonly model = linkedSignal(() => ({ email: this.email() ?? '' }));
  protected readonly emailForm = form(this.model, (p) => {
    required(p.email, { message: 'Введите email' });
    email(p.email, { message: 'Проверьте email' });
  });

  protected readonly reset = signal({ code: '', password: '' });
  protected readonly resetForm = form(this.reset, (p) => {
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

  protected readonly codeSent = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly serverError = signal('');

  protected sendCode(): void {
    submit(this.emailForm, async () => {
      this.busy.set(true);
      this.serverError.set('');
      try {
        const emailValue = this.model().email.trim().toLowerCase();
        await this.api.requestPasswordReset(emailValue);
        this.model.set({ email: emailValue });
        this.codeSent.set(true);
      } catch (error) {
        this.serverError.set(apiErrorMessage(error, 'Не удалось отправить код'));
      } finally {
        this.busy.set(false);
      }
    });
  }

  protected changePassword(): void {
    submit(this.resetForm, async () => {
      this.busy.set(true);
      this.serverError.set('');
      try {
        const emailValue = this.model().email;
        await this.api.confirmPasswordReset(
          emailValue,
          normalizeCode(this.reset().code),
          this.reset().password,
        );
        this.toast.success('Пароль изменён — войдите с новым паролем');
        await this.router.navigate(['/login'], { queryParams: { email: emailValue } });
      } catch (error) {
        this.serverError.set(apiErrorMessage(error, 'Не удалось сменить пароль'));
      } finally {
        this.busy.set(false);
      }
    });
  }
}
