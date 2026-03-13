import { Routes } from '@angular/router';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/sales-list.page').then((m) => m.SalesListPage),
  },
];
