import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { FormField, email, form, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthApi } from '../../core/auth/auth-api';
import { AuthStore } from '../../core/auth/auth-store';
import {
  INVITE_PATTERN,
  USERNAME_PATTERN,
  normalizeCode,
  passwordProblem,
} from '../../core/auth/auth.model';
import { apiErrorMessage } from '../../core/http/api-error';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { AuthLayout } from './auth-layout';

/** Регистрация: режим стенда (открыта / по инвайтам / закрыта) спрашиваем у API. */
@Component({
  selector: 'app-register',
  imports: [AuthLayout, FormField, RouterLink, Button, Icon, Skeleton],
  template: `
    <app-auth-layout title="Регистрация" [subtitle]="subtitle()">
      @if (mode.isLoading()) {
        <div class="form"><app-skeleton height="180px" /></div>
      } @else if (mode.error()) {
        <div class="form">
          <div class="server-error" role="alert">Сервер недоступен — попробуйте позже</div>
          <button app-button variant="outline" class="submit" (click)="mode.reload()">Повторить</button>
        </div>
      } @else if (!signup()?.enabled) {
        <p class="form hint">Сейчас регистрация закрыта. Если у вас уже есть аккаунт — войдите.</p>
      } @else {
        <form class="form" novalidate (submit)="$event.preventDefault(); createAccount()">
          <div class="tj-field">
            <label for="reg-email">Email</label>
            <input id="reg-email" class="tj-input" type="email" autocomplete="email" [formField]="registerForm.email" />
            @if (registerForm.email().touched() && registerForm.email().invalid()) {
              <span class="tj-error">{{ registerForm.email().errors()[0]?.message }}</span>
            }
          </div>

          <div class="tj-field">
            <label for="reg-username">Имя пользователя</label>
            <input id="reg-username" class="tj-input" autocomplete="username" [formField]="registerForm.username" />
            @if (registerForm.username().touched() && registerForm.username().invalid()) {
              <span class="tj-error">{{ registerForm.username().errors()[0]?.message }}</span>
            } @else {
              <span class="hint">Латинские буквы и цифры, 3–32 символа</span>
            }
          </div>

          <div class="tj-field">
            <label for="reg-password">Пароль</label>
            <div class="secret">
              <input
                id="reg-password"
                class="tj-input"
                autocomplete="new-password"
                [type]="showPassword() ? 'text' : 'password'"
                [formField]="registerForm.password"
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
            @if (registerForm.password().touched() && registerForm.password().invalid()) {
              <span class="tj-error">{{ registerForm.password().errors()[0]?.message }}</span>
            } @else {
              <span class="hint">8–64 символа: строчная и заглавная латинские буквы, цифра и спецсимвол</span>
            }
          </div>

          @if (inviteRequired()) {
            <div class="tj-field">
              <label for="reg-invite">Инвайт-код</label>
              <input
                id="reg-invite"
                class="tj-input tj-input--mono"
                autocomplete="off"
                placeholder="ABCD-1234-EFGH"
                [formField]="registerForm.inviteCode"
              />
              @if (registerForm.inviteCode().touched() && registerForm.inviteCode().invalid()) {
                <span class="tj-error">{{ registerForm.inviteCode().errors()[0]?.message }}</span>
              } @else {
                <span class="hint">Сейчас закрытый запуск — регистрация по приглашениям</span>
              }
            </div>
          }

          @if (serverError()) {
            <div class="server-error" role="alert">{{ serverError() }}</div>
          }

          <button app-button variant="primary" class="submit" type="submit" [disabled]="busy()">
            {{ busy() ? 'Создаём аккаунт…' : 'Создать аккаунт' }}
          </button>
        </form>
      }

      <p class="footer" auth-footer>
        Уже есть аккаунт? <a routerLink="/login">Войти</a>
      </p>
    </app-auth-layout>
  `,
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly api = inject(AuthApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly mode = resource({ loader: () => this.api.signupMode() });
  // value() бросает, пока ресурс в ошибке, — читаем только через hasValue().
  protected readonly signup = computed(() => (this.mode.hasValue() ? this.mode.value() : null));
  protected readonly inviteRequired = computed(() => this.signup()?.inviteRequired ?? false);

  protected readonly subtitle = computed(() =>
    this.signup()?.enabled ? 'После регистрации пришлём на почту код подтверждения' : '',
  );

  protected readonly model = signal({ email: '', username: '', password: '', inviteCode: '' });
  protected readonly registerForm = form(this.model, (p) => {
    required(p.email, { message: 'Введите email' });
    email(p.email, { message: 'Проверьте email' });
    required(p.username, { message: 'Придумайте имя пользователя' });
    validate(p.username, ({ value }) =>
      value() && !USERNAME_PATTERN.test(value())
        ? { kind: 'username', message: 'Только латинские буквы и цифры, 3–32 символа, хотя бы одна буква' }
        : undefined,
    );
    required(p.password, { message: 'Придумайте пароль' });
    validate(p.password, ({ value }) => {
      const problem = value() ? passwordProblem(value()) : null;
      return problem ? { kind: 'password', message: problem } : undefined;
    });
    validate(p.inviteCode, ({ value }) => {
      if (!this.inviteRequired()) return undefined;
      const code = normalizeCode(value());
      if (!code) return { kind: 'required', message: 'Введите инвайт-код' };
      return INVITE_PATTERN.test(code)
        ? undefined
        : { kind: 'invite', message: '12 символов: латинские буквы и цифры' };
    });
  });

  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly serverError = signal('');

  protected createAccount(): void {
    submit(this.registerForm, async () => {
      const m = this.model();
      const emailValue = m.email.trim().toLowerCase();
      this.busy.set(true);
      this.serverError.set('');
      try {
        await this.api.register({
          email: emailValue,
          username: m.username.trim(),
          password: m.password,
          inviteCode: this.inviteRequired() ? normalizeCode(m.inviteCode) : '',
        });
        this.auth.rememberPendingLogin(emailValue, m.password);
        await this.router.navigate(['/verify'], { queryParams: { email: emailValue } });
      } catch (error) {
        this.serverError.set(apiErrorMessage(error, 'Не удалось создать аккаунт'));
      } finally {
        this.busy.set(false);
      }
    });
  }
}
