import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth-guards';

export const routes: Routes = [
  // Вход и регистрация — без каркаса приложения и только без сессии.
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'verify',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/verify').then((m) => m.Verify),
  },
  {
    path: 'restore',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/restore').then((m) => m.Restore),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./shared/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'trades',
        loadChildren: () => import('./features/trades/trades.routes').then((m) => m.routes),
      },
      // Не `/journal`: этот префикс edge-прокси отдаёт API платформы.
      {
        path: 'diary',
        loadComponent: () => import('./features/journal/journal').then((m) => m.Journal),
      },
      { path: 'journal', redirectTo: 'diary' },
      { path: 'accounts', redirectTo: 'settings/exchange' },
      { path: 'settings', pathMatch: 'full', redirectTo: 'settings/exchange' },
      {
        path: 'settings/:tab',
        loadComponent: () => import('./features/accounts/settings').then((m) => m.Settings),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
