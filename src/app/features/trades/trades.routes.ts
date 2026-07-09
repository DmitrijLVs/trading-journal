import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./trade-list').then((m) => m.TradeList),
  },
];
