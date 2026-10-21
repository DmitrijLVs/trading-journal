import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/ui/toast';
import { AuthApi } from './auth-api';
import { UserInfo } from './auth.model';

export type SessionState = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Сессия пользователя. Токены живут в httpOnly-куках — фронт их не видит,
 * поэтому «вошёл ли пользователь» узнаём запросом `/account/info`.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly _user = signal<UserInfo | null>(null);
  private readonly _state = signal<SessionState>('unknown');
  private restoring: Promise<boolean> | null = null;
  private refreshing: Promise<boolean> | null = null;
  /**
   * Пароль из формы регистрации — только в памяти и только до подтверждения
   * почты: после кода входим сами, не заставляя вводить его снова.
   */
  private pendingLogin: { email: string; password: string } | null = null;

  readonly user = this._user.asReadonly();
  readonly state = this._state.asReadonly();
  readonly isAuthenticated = computed(() => this._state() === 'authenticated');

  /** Есть ли живая сессия; проверяется один раз, дальше — из памяти. */
  ensureSession(): Promise<boolean> {
    const state = this._state();
    if (state !== 'unknown') return Promise.resolve(state === 'authenticated');
    this.restoring ??= this.loadUser().finally(() => (this.restoring = null));
    return this.restoring;
  }

  async login(email: string, password: string): Promise<void> {
    await this.api.login(email, password);
    this.pendingLogin = null;
    if (!(await this.loadUser())) throw new Error('session was not created');
  }

  /** После регистрации: запомнить вход до подтверждения почты. */
  rememberPendingLogin(email: string, password: string): void {
    this.pendingLogin = { email, password };
  }

  /** Почта подтверждена: войти паролем из регистрации, если он ещё в памяти. */
  async loginAfterVerification(email: string): Promise<boolean> {
    const pending = this.pendingLogin;
    if (!pending || pending.email !== email) return false;
    try {
      await this.login(pending.email, pending.password);
      return true;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.logout();
    } catch {
      // куки всё равно чистит сервер; без сети — просто забываем сессию
    }
    this.clear();
    await this.router.navigateByUrl('/login');
  }

  /**
   * Новая пара токенов по refresh-куке. Одновременные 401 ждут один запрос:
   * refresh одноразовый, повторное использование отзывает всю сессию.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= this.api
      .refresh()
      .then(() => true)
      .catch((error: unknown) => {
        this.expire(error);
        return false;
      })
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async loadUser(): Promise<boolean> {
    try {
      this._user.set(await this.api.info());
      this._state.set('authenticated');
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  /** Сессия умерла посреди работы — на вход, с возвратом на ту же страницу. */
  private expire(error: unknown): void {
    const wasActive = this._state() === 'authenticated';
    this.clear();
    if (!wasActive) return;
    const blocked = error instanceof HttpErrorResponse && error.status === 403;
    this.toast.error(blocked ? 'Аккаунт заблокирован' : 'Сессия закончилась — войдите снова');
    const next = this.router.url;
    void this.router.navigate(['/login'], { queryParams: next.startsWith('/login') ? {} : { next } });
  }

  private clear(): void {
    this._user.set(null);
    this._state.set('anonymous');
  }
}
