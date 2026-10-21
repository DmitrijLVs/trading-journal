import { HttpContextToken } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Префиксы API платформы (как на edge-прокси). Остальное — не наше: свечи бирж и т. п. */
const API_PATH = /^\/(account|exchange|journal|stats|payment|config)(\/|\?|$)/;

/** Origin гейтвея: в проде — отдельный хост, в деве — '' (прокси дев-сервера). */
const API_ORIGIN = environment.apiOrigin;

/**
 * Запрос, на 401 которого не нужно обновлять сессию: логин (401 — неверный
 * пароль), сам refresh, публичные шаги регистрации и восстановления.
 */
export const SKIP_REFRESH = new HttpContextToken<boolean>(() => false);

export function isApiUrl(url: string): boolean {
  return API_PATH.test(url);
}

/** Путь API (`/account/info`) → адрес на гейтвее. */
export function apiUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}

/** WebSocket гейтвея: `wss://<гейтвей>/ws/...`, без своего origin — текущий хост. */
export function apiSocketUrl(path: string): string {
  const origin = API_ORIGIN || location.origin;
  return `${origin.replace(/^http/, 'ws')}${path}`;
}
