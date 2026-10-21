/** Пользователь платформы (`GET /account/info`). */
export interface UserInfo {
  id: string;
  email: string;
  registeredAt: string;
  /** `active` | `pending` (почта не подтверждена). */
  status: string;
}

export interface UserInfoDto {
  id: string;
  email: string;
  registered_at: string;
  status: string;
  subscription_name?: string | null;
  subscription_expires_at?: string | null;
}

/** Режим регистрации стенда (`GET /account/signup`). */
export interface SignupMode {
  enabled: boolean;
  inviteRequired: boolean;
}

export interface RegisterDraft {
  email: string;
  username: string;
  password: string;
  inviteCode: string;
}

/** Правила полей — как у Account-Service: ошибки ловим до запроса. */
export const PASSWORD_SPECIALS = `!@#$%^&*()_+-=[]{}|;':,.<>?/`;
export const USERNAME_PATTERN = /^(?=.*[A-Za-z])[A-Za-z0-9]{3,32}$/;
export const CODE_PATTERN = /^[0-9A-Z]{8}$/;
export const INVITE_PATTERN = /^[0-9A-Z]{12}$/;

/** Почему пароль не подходит (null — подходит). */
export function passwordProblem(password: string): string | null {
  const length = [...password].length;
  if (length < 8 || length > 64 || new TextEncoder().encode(password).length > 72) {
    return 'От 8 до 64 символов';
  }
  if (!/[a-z]/.test(password)) return 'Нужна строчная латинская буква';
  if (!/[A-Z]/.test(password)) return 'Нужна заглавная латинская буква';
  if (!/[0-9]/.test(password)) return 'Нужна цифра';
  if (![...password].some((ch) => PASSWORD_SPECIALS.includes(ch))) return 'Нужен спецсимвол: ! @ # $ % …';
  return null;
}

/** Инвайт и коды из письма: регистр, пробелы и дефисы не важны. */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

export function toUserInfo(dto: UserInfoDto): UserInfo {
  return { id: dto.id, email: dto.email, registeredAt: dto.registered_at, status: dto.status };
}
