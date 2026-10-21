import { HttpErrorResponse } from '@angular/common/http';

/**
 * Тексты ошибок API приходят по-английски (`{"error": "..."}`) — переводим
 * известные; незнакомый текст показываем как есть, он всё же понятнее,
 * чем «что-то пошло не так».
 */
const EXACT: Readonly<Record<string, string>> = {
  'invalid email or password': 'Неверный email или пароль',
  'account is not verified': 'Почта ещё не подтверждена',
  'account is blocked': 'Аккаунт заблокирован. Напишите в поддержку',
  'email and password are required': 'Введите email и пароль',
  'email or password too long': 'Слишком длинный email или пароль',
  'email is already registered': 'Этот email уже зарегистрирован — войдите',
  'username is already taken': 'Это имя пользователя уже занято',
  'invite code is required': 'Нужен инвайт-код',
  'invite code must be 12 characters [0-9A-Z]': 'Инвайт-код — 12 символов: латинские буквы и цифры',
  'invalid or already used invite code': 'Инвайт-код неверный или уже использован',
  'code must be 8 characters [0-9A-Z]': 'Код — 8 символов: латинские буквы и цифры',
  'invalid or expired code': 'Код неверный или устарел — запросите новый',
  'account is already verified': 'Почта уже подтверждена — можно войти',
  'missing refresh token': 'Сессия закончилась — войдите снова',
  'invalid refresh token': 'Сессия закончилась — войдите снова',
  'session revoked, please log in again': 'Сессия завершена — войдите снова',
  'exchange is not supported': 'Эта биржа пока не поддерживается',
  'exchange account label is already used': 'Счёт с таким названием уже есть',
  'invalid input: account label must be 1-100 characters': 'Название — от 1 до 100 символов',
  'invalid input: api key and secret are required': 'Нужны API Key и API Secret',
  'exchange account not found': 'Счёт не найден — возможно, его уже удалили',
  'internal error': 'Ошибка на сервере — попробуйте ещё раз',
};

const PATTERNS: readonly [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^too many login attempts, try again in (\d+) minutes?$/, (m) => `Слишком много попыток входа. Повторите через ${m[1]} мин`],
  [/^too many login attempts, try again in (\d+) seconds?$/, (m) => `Слишком много попыток входа. Повторите через ${m[1]} с`],
  [/^password must contain a digit/, () => 'Пароль должен содержать цифру'],
  [/^password must contain an? (lower|lowercase)/, () => 'Пароль должен содержать строчную букву'],
  [/^password must contain an? (upper|uppercase)/, () => 'Пароль должен содержать заглавную букву'],
  [/^password must contain a special/, () => 'Пароль должен содержать спецсимвол'],
  [/^password must be/, () => 'Пароль — от 8 до 64 символов'],
  [/^email must be/, () => 'Проверьте email'],
  [/^username must/, () => 'Имя пользователя — 3–32 латинские буквы или цифры, хотя бы одна буква'],
  [/already connected|already exists/, () => 'Этот аккаунт Binance уже подключён'],
];

/** Текст ошибки для пользователя. */
export function apiErrorMessage(error: unknown, fallback = 'Не удалось выполнить запрос'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'Нет связи с сервером — проверьте интернет';
  const text = errorText(error);
  if (text) return translate(text);
  if (error.status === 429) return 'Слишком много запросов — подождите немного';
  if (error.status >= 500) return 'Сервер временно недоступен — попробуйте позже';
  return fallback;
}

/** Исходный текст `{"error": "..."}` ответа, если он есть. */
export function errorText(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (body && typeof body === 'object' && 'error' in body) {
    const text = (body as { error: unknown }).error;
    if (typeof text === 'string' && text) return text;
  }
  return null;
}

/** Через сколько секунд можно повторить (заголовок Retry-After у блокировки входа). */
export function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const value = Number(error.headers.get('Retry-After'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function translate(text: string): string {
  const exact = EXACT[text];
  if (exact) return exact;
  for (const [pattern, render] of PATTERNS) {
    const match = text.match(pattern);
    if (match) return render(match);
  }
  return text;
}
