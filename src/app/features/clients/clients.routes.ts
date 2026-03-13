import { Routes } from '@angular/router';

export const CLIENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/clients-list/clients-list.page').then(m => m.ClientsListPage)
  },
  {
    path: 'novo',
    loadComponent: () => import('./pages/client-create/client-create.page').then(m => m.ClientCreatePage)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/client-detail/client-detail.page').then(m => m.ClientDetailPage)
  }
];
