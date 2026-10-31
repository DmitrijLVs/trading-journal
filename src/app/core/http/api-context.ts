import { HttpContextToken } from '@angular/common/http';

/**
 * Префиксы API платформы (как на edge-прокси) и `/ai` — «Разбор от ИИ» нашего
 * сервера, который проверяет ту же сессию. Остальное — не наше: свечи бирж и т. п.
 */
const API_PATH = /^\/(account|exchange|journal|stats|payment|config|ai)(\/|\?|$)/;

/**
 * Запрос, на 401 которого не нужно обновлять сессию: логин (401 — неверный
 * пароль), сам refresh, публичные шаги регистрации и восстановления.
 */
export const SKIP_REFRESH = new HttpContextToken<boolean>(() => false);

export function isApiUrl(url: string): boolean {
  return API_PATH.test(url);
}
