import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shared/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'trades' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'trades',
        loadChildren: () => import('./features/trades/trades.routes').then((m) => m.routes),
      },
      {
        path: 'journal',
        loadComponent: () => import('./features/journal/journal').then((m) => m.Journal),
      },
      {
        path: 'account',
        loadComponent: () => import('./features/accounts/account').then((m) => m.Account),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/accounts/settings').then((m) => m.Settings),
      },
    ],
  },
];
