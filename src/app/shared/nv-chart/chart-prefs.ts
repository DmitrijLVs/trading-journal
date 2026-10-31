/**
 * Настройки панели рисования в localStorage (избранное, магнит, стили
 * инструментов): удобства одного браузера, без сервера. Приватный режим или
 * переполнение — работаем на значениях по умолчанию.
 */
export function readChartPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeChartPref(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // приватный режим — настройка живёт до перезагрузки
  }
}
