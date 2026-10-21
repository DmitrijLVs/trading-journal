import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { apiErrorMessage, errorText, retryAfterSeconds } from './api-error';

function httpError(status: number, error: unknown, headers?: Record<string, string>): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, headers: new HttpHeaders(headers ?? {}) });
}

describe('apiErrorMessage', () => {
  it('переводит известные ответы API', () => {
    expect(apiErrorMessage(httpError(401, { error: 'invalid email or password' }))).toBe('Неверный email или пароль');
    expect(apiErrorMessage(httpError(400, { error: 'password must contain a digit' }))).toBe('Пароль должен содержать цифру');
    expect(apiErrorMessage(httpError(429, { error: 'too many login attempts, try again in 5 minutes' }))).toBe(
      'Слишком много попыток входа. Повторите через 5 мин',
    );
  });

  it('незнакомый текст показывает как есть, без тела — по статусу', () => {
    expect(apiErrorMessage(httpError(400, { error: 'something new' }))).toBe('something new');
    expect(apiErrorMessage(httpError(429, null))).toBe('Слишком много запросов — подождите немного');
    expect(apiErrorMessage(httpError(0, null))).toBe('Нет связи с сервером — проверьте интернет');
    expect(apiErrorMessage(new Error('x'), 'запасной')).toBe('запасной');
  });
});

describe('errorText / retryAfterSeconds', () => {
  it('достают исходный текст и Retry-After', () => {
    const error = httpError(429, { error: 'too many login attempts, try again in 1 minutes' }, { 'Retry-After': '42' });
    expect(errorText(error)).toBe('too many login attempts, try again in 1 minutes');
    expect(retryAfterSeconds(error)).toBe(42);
    expect(retryAfterSeconds(httpError(429, null))).toBeNull();
  });
});
