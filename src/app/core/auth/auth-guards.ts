import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from './auth-store';

/** Приложение — только с сессией; иначе на вход с возвратом туда, куда шли. */
export const authGuard: CanMatchFn = async (_route, segments) => {
  const router = inject(Router);
  if (await inject(AuthStore).ensureSession()) return true;
  const next = segments.map((s) => s.path).join('/');
  return router.createUrlTree(['/login'], { queryParams: next ? { next: `/${next}` } : {} });
};

/** Вход и регистрация — только без сессии. */
export const guestGuard: CanMatchFn = async () => {
  const router = inject(Router);
  return (await inject(AuthStore).ensureSession()) ? router.createUrlTree(['/dashboard']) : true;
};
