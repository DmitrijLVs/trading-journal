import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shared/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
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
      // Счета живут во вкладке настроек; старый адрес ведёт туда же.
      { path: 'accounts', redirectTo: 'settings/accounts' },
      { path: 'settings', pathMatch: 'full', redirectTo: 'settings/profile' },
      {
        path: 'settings/:tab',
        loadComponent: () => import('./features/accounts/settings').then((m) => m.Settings),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
