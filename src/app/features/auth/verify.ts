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
import { FormField, email, form, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthApi } from '../../core/auth/auth-api';
import { AuthStore } from '../../core/auth/auth-store';
import { CODE_PATTERN, normalizeCode } from '../../core/auth/auth.model';
import { apiErrorMessage, errorText } from '../../core/http/api-error';
import { Button } from '../../shared/ui/button';
import { ToastService } from '../../shared/ui/toast';
import { AuthLayout } from './auth-layout';

/** Повторно отправить письмо — не чаще раза в минуту (лимит почты — 10 писем в час). */
const RESEND_COOLDOWN_S = 60;

/** Подтверждение почты кодом из письма; после — вход паролем из регистрации. */
@Component({
  selector: 'app-verify',
  imports: [AuthLayout, FormField, RouterLink, Button],
  template: `
    <app-auth-layout title="Подтвердите почту" [subtitle]="subtitle()">
      <form class="form" novalidate (submit)="$event.preventDefault(); confirm()">
        @if (!email()) {
          <div class="tj-field">
            <label for="verify-email">Email</label>
            <input id="verify-email" class="tj-input" type="email" autocomplete="email" [formField]="verifyForm.email" />
            @if (verifyForm.email().touched() && verifyForm.email().invalid()) {
              <span class="tj-error">{{ verifyForm.email().errors()[0]?.message }}</span>
            }
          </div>
        }

        <div class="tj-field">
          <label for="verify-code">Код из письма</label>
          <input
            id="verify-code"
            class="tj-input code"
            autocomplete="one-time-code"
            placeholder="XXXXXXXX"
            [formField]="verifyForm.code"
          />
          @if (verifyForm.code().touched() && verifyForm.code().invalid()) {
            <span class="tj-error">{{ verifyForm.code().errors()[0]?.message }}</span>
          } @else {
            <span class="hint">8 символов. Не пришло — проверьте «Спам»</span>
          }
        </div>

        @if (serverError()) {
          <div class="server-error" role="alert">{{ serverError() }}</div>
        }
        @if (notice()) {
          <div class="notice" role="status">{{ notice() }}</div>
        }

        <button app-button variant="primary" class="submit" type="submit" [disabled]="busy()">
          {{ busy() ? 'Проверяем…' : 'Подтвердить' }}
        </button>
        <div class="secondary">
          <button app-button variant="ghost" size="sm" type="button" [disabled]="cooldown() > 0" (click)="resend()">
            {{ cooldown() > 0 ? 'Отправить код снова через ' + cooldown() + ' с' : 'Отправить код снова' }}
          </button>
        </div>
      </form>

      <p class="footer" auth-footer>
        <a routerLink="/login" [queryParams]="{ email: model().email || null }">Вернуться ко входу</a>
      </p>
    </app-auth-layout>
  `,
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Verify {
  private readonly api = inject(AuthApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly email = input<string>();

  protected readonly model = linkedSignal(() => ({ email: this.email() ?? '', code: '' }));
  protected readonly verifyForm = form(this.model, (p) => {
    required(p.email, { message: 'Введите email' });
    email(p.email, { message: 'Проверьте email' });
    required(p.code, { message: 'Введите код' });
    validate(p.code, ({ value }) =>
      value() && !CODE_PATTERN.test(normalizeCode(value()))
        ? { kind: 'code', message: '8 символов: латинские буквы и цифры' }
        : undefined,
    );
  });

  protected readonly busy = signal(false);
  protected readonly serverError = signal('');
  protected readonly notice = signal('');
  protected readonly cooldown = signal(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly subtitle = computed(() => {
    const target = this.email();
    return target
      ? `Мы отправили 8-значный код на ${target}. Введите его, чтобы завершить регистрацию.`
      : 'Введите email и код из письма.';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopCooldown());
  }

  protected confirm(): void {
    submit(this.verifyForm, async () => {
      const emailValue = this.model().email.trim().toLowerCase();
      this.busy.set(true);
      this.serverError.set('');
      this.notice.set('');
      try {
        await this.api.verify(emailValue, normalizeCode(this.model().code));
        await this.finish(emailValue);
      } catch (error) {
        if (error instanceof HttpErrorResponse && errorText(error) === 'account is already verified') {
          await this.finish(emailValue);
          return;
        }
        this.serverError.set(apiErrorMessage(error, 'Не удалось подтвердить почту'));
      } finally {
        this.busy.set(false);
      }
    });
  }

  protected async resend(): Promise<void> {
    const emailValue = this.model().email.trim().toLowerCase();
    if (!emailValue) {
      this.serverError.set('Введите email, на который регистрировались');
      return;
    }
    this.serverError.set('');
    try {
      await this.api.resendVerification(emailValue);
      this.notice.set('Если такой аккаунт есть, новый код уже в пути');
      this.startCooldown();
    } catch (error) {
      this.serverError.set(apiErrorMessage(error, 'Не удалось отправить код'));
    }
  }

  /** Сразу внутрь, если пароль из регистрации ещё в памяти; иначе — ко входу. */
  private async finish(emailValue: string): Promise<void> {
    if (await this.auth.loginAfterVerification(emailValue)) {
      this.toast.success('Почта подтверждена — добро пожаловать');
      await this.router.navigateByUrl('/dashboard');
      return;
    }
    this.toast.success('Почта подтверждена — войдите');
    await this.router.navigate(['/login'], { queryParams: { email: emailValue } });
  }

  private startCooldown(): void {
    this.stopCooldown();
    this.cooldown.set(RESEND_COOLDOWN_S);
    this.cooldownTimer = setInterval(() => {
      this.cooldown.update((s) => Math.max(0, s - 1));
      if (this.cooldown() === 0) this.stopCooldown();
    }, 1000);
  }

  private stopCooldown(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = null;
  }
}
