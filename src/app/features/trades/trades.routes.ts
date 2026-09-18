import { Routes } from '@angular/router';

/** Список сделок; `/trades/:id` открывает тот же список с раскрытой сделкой. */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./trade-list').then((m) => m.TradeList),
  },
  {
    path: ':id',
    loadComponent: () => import('./trade-list').then((m) => m.TradeList),
  },
];
