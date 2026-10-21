import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { apiErrorMessage, errorText, retryAfterSeconds } from '../../core/http/api-error';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { AuthLayout } from './auth-layout';

/** Вход по email и паролю. `next` — куда вернуться, `email` — подставить. */
@Component({
  selector: 'app-login',
  imports: [AuthLayout, FormField, RouterLink, Button, Icon],
  template: `
    <app-auth-layout title="Вход" subtitle="Журнал сделок с вашего биржевого аккаунта">
      <form class="form" novalidate (submit)="$event.preventDefault(); signIn()">
        <div class="tj-field">
          <label for="login-email">Email</label>
          <input
            id="login-email"
            class="tj-input"
            type="email"
            autocomplete="email"
            [formField]="loginForm.email"
          />
          @if (loginForm.email().touched() && loginForm.email().invalid()) {
            <span class="tj-error">{{ loginForm.email().errors()[0]?.message }}</span>
          }
        </div>

        <div class="tj-field">
          <div class="label-row">
            <label for="login-password">Пароль</label>
            <a routerLink="/restore" [queryParams]="{ email: model().email || null }">Забыли пароль?</a>
          </div>
          <div class="secret">
            <input
              id="login-password"
              class="tj-input"
              autocomplete="current-password"
              [type]="showPassword() ? 'text' : 'password'"
              [formField]="loginForm.password"
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
          @if (loginForm.password().touched() && loginForm.password().invalid()) {
            <span class="tj-error">{{ loginForm.password().errors()[0]?.message }}</span>
          }
        </div>

        @if (lockedText(); as text) {
          <div class="server-error" role="alert">{{ text }}</div>
        } @else if (serverError()) {
          <div class="server-error" role="alert">{{ serverError() }}</div>
        }

        <button app-button variant="primary" class="submit" type="submit" [disabled]="busy() || lockedFor() > 0">
          {{ busy() ? 'Входим…' : 'Войти' }}
        </button>
      </form>

      <p class="footer" auth-footer>
        Нет аккаунта? <a routerLink="/register">Зарегистрироваться</a>
      </p>
    </app-auth-layout>
  `,
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** Query-параметры (withComponentInputBinding). */
  readonly next = input<string>();
  readonly email = input<string>();

  protected readonly model = linkedSignal(() => ({ email: this.email() ?? '', password: '' }));
  protected readonly loginForm = form(this.model, (p) => {
    required(p.email, { message: 'Введите email' });
    email(p.email, { message: 'Проверьте email' });
    required(p.password, { message: 'Введите пароль' });
  });

  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly serverError = signal('');
  /** Секунд до конца блокировки после серии неудачных попыток. */
  protected readonly lockedFor = signal(0);
  protected readonly lockedText = computed(() => {
    const seconds = this.lockedFor();
    if (seconds <= 0) return '';
    const minutes = Math.floor(seconds / 60);
    const rest = String(seconds % 60).padStart(2, '0');
    return `Слишком много попыток входа. Повторите через ${minutes}:${rest}`;
  });

  private lockTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopLockTimer());
  }

  protected signIn(): void {
    submit(this.loginForm, async () => {
      const { email, password } = this.model();
      this.busy.set(true);
      this.serverError.set('');
      try {
        await this.auth.login(email.trim(), password);
        await this.router.navigateByUrl(safeNext(this.next()));
      } catch (error) {
        await this.handleError(error, email.trim());
      } finally {
        this.busy.set(false);
      }
    });
  }

  private async handleError(error: unknown, email: string): Promise<void> {
    if (error instanceof HttpErrorResponse && error.status === 403 && errorText(error) === 'account is not verified') {
      await this.router.navigate(['/verify'], { queryParams: { email } });
      return;
    }
    const retry = error instanceof HttpErrorResponse && error.status === 429 ? retryAfterSeconds(error) : null;
    if (retry) {
      this.startLockTimer(retry);
      return;
    }
    this.serverError.set(apiErrorMessage(error, 'Не удалось войти'));
  }

  private startLockTimer(seconds: number): void {
    this.stopLockTimer();
    this.lockedFor.set(seconds);
    this.lockTimer = setInterval(() => {
      this.lockedFor.update((s) => Math.max(0, s - 1));
      if (this.lockedFor() === 0) this.stopLockTimer();
    }, 1000);
  }

  private stopLockTimer(): void {
    if (this.lockTimer) clearInterval(this.lockTimer);
    this.lockTimer = null;
  }
}

/** Только свои пути: `next` из адресной строки не должен уводить на чужой сайт. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}
