import { WritableSignal, effect, signal } from '@angular/core';

/**
 * Настройки устройства в localStorage (ширина панели, вид снимка): сигнал
 * читает сохранённое при создании и пишет каждое изменение. Приватный режим
 * или мусор в хранилище — работаем на `fallback`. Вызывать в контексте
 * внедрения (поле компонента или сервиса).
 */
function storedSignal<T>(key: string, fallback: T, parse: (raw: string) => T | null): WritableSignal<T> {
  const value = signal(readStored(key, fallback, parse));
  effect(() => {
    const current = value();
    try {
      localStorage.setItem(key, String(current));
    } catch {
      // приватный режим — настройка живёт до перезагрузки
    }
  });
  return value;
}

export function storedNumber(key: string, fallback: number): WritableSignal<number> {
  return storedSignal(key, fallback, (raw) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  });
}

/** Один из `options`; чужое значение в хранилище — `fallback`. */
export function storedChoice<T extends string>(key: string, options: readonly T[], fallback: T): WritableSignal<T> {
  return storedSignal<T>(key, fallback, (raw) => (options as readonly string[]).includes(raw) ? (raw as T) : null);
}

function readStored<T>(key: string, fallback: T, parse: (raw: string) => T | null): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (parse(raw) ?? fallback);
  } catch {
    return fallback;
  }
}
