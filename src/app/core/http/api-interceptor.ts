import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth-store';
import { SKIP_REFRESH, apiUrl, isApiUrl } from './api-context';

/**
 * Запросы к API платформы: браузерный режим авторизации (`X-FROM: BROWSER`
 * + httpOnly-куки). Протух access — один раз обновляем пару через
 * `/account/refresh` и повторяем запрос; не вышло — сессия закончилась.
 * Запросы к биржам заголовок и куки не получают: их CORS это не пропустит.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) return next(req);
  const auth = inject(AuthStore);
  const apiReq = req.clone({
    url: apiUrl(req.url),
    withCredentials: true,
    setHeaders: { 'X-FROM': 'BROWSER' },
  });
  if (req.context.get(SKIP_REFRESH)) return next(apiReq);
  return next(apiReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return from(auth.refresh()).pipe(
        switchMap((renewed) => (renewed ? next(apiReq) : throwError(() => error))),
      );
    }),
  );
};
