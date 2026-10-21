import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SKIP_REFRESH } from '../http/api-context';
import { RegisterDraft, SignupMode, UserInfo, UserInfoDto, toUserInfo } from './auth.model';

/** Account-Service: регистрация, почта, вход и сессия. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  /** Публичные ручки: их 401 — ответ по делу, а не протухший токен. */
  private readonly open = { context: new HttpContext().set(SKIP_REFRESH, true) };

  async signupMode(): Promise<SignupMode> {
    const dto = await firstValueFrom(
      this.http.get<{ enabled: boolean; invite_required: boolean }>('/account/signup', this.open),
    );
    return { enabled: dto.enabled, inviteRequired: dto.invite_required };
  }

  async login(email: string, password: string): Promise<void> {
    await firstValueFrom(this.http.post('/account/login', { email, password }, this.open));
  }

  async register(draft: RegisterDraft): Promise<void> {
    const body: Record<string, string> = {
      email: draft.email,
      username: draft.username,
      password: draft.password,
    };
    if (draft.inviteCode) body['invite_code'] = draft.inviteCode;
    await firstValueFrom(this.http.post('/account/register', body, this.open));
  }

  async verify(email: string, code: string): Promise<void> {
    await firstValueFrom(this.http.post('/account/verify', { email, code }, this.open));
  }

  async resendVerification(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/account/verify/resend', { email }, this.open));
  }

  async requestPasswordReset(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/account/password/restore', { email }, this.open));
  }

  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        '/account/password/restore/confirm',
        { email, code, new_password: newPassword },
        this.open,
      ),
    );
  }

  async refresh(): Promise<void> {
    await firstValueFrom(this.http.post('/account/refresh', null, this.open));
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.get('/account/logout', this.open));
  }

  async info(): Promise<UserInfo> {
    return toUserInfo(await firstValueFrom(this.http.get<UserInfoDto>('/account/info')));
  }
}
