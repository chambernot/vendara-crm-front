import { Routes } from '@angular/router';

export const CONSIGNATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/consignations-list/consignations-list.page').then(m => m.ConsignationsListPage)
  },
  {
    path: 'nova',
    loadComponent: () => import('./pages/consignation-create/consignation-create.page').then(m => m.ConsignationCreatePage)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/consignation-detail/consignation-detail.page').then(m => m.ConsignationDetailPage)
  }
];
