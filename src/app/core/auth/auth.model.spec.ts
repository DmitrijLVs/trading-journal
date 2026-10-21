import { describe, expect, it } from 'vitest';
import { USERNAME_PATTERN, normalizeCode, passwordProblem } from './auth.model';

describe('passwordProblem — правила Account-Service', () => {
  it('принимает пароль со всеми классами символов', () => {
    expect(passwordProblem('Trade2026!')).toBeNull();
  });

  it('называет первое нарушение', () => {
    expect(passwordProblem('Ab1!')).toBe('От 8 до 64 символов');
    expect(passwordProblem('TRADE2026!')).toBe('Нужна строчная латинская буква');
    expect(passwordProblem('trade2026!')).toBe('Нужна заглавная латинская буква');
    expect(passwordProblem('TradeTrade!')).toBe('Нужна цифра');
    expect(passwordProblem('Trade20260')).toBe('Нужен спецсимвол: ! @ # $ % …');
  });
});

describe('коды и имя пользователя', () => {
  it('инвайт и код из письма: регистр, пробелы и дефисы не важны', () => {
    expect(normalizeCode('abcd-1234 efgh')).toBe('ABCD1234EFGH');
  });

  it('имя: 3–32 латинские буквы/цифры, хотя бы одна буква', () => {
    expect(USERNAME_PATTERN.test('trader42')).toBe(true);
    expect(USERNAME_PATTERN.test('1234')).toBe(false);
    expect(USERNAME_PATTERN.test('тр')).toBe(false);
  });
});
