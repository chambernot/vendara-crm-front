import { Routes } from '@angular/router';

export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/catalog-list/catalog-list.page').then(m => m.CatalogListPage)
  },
  {
    path: 'novo',
    loadComponent: () => import('./pages/product-create/product-create.page').then(m => m.ProductCreatePage)
  },
  {
    path: 'movimentacoes',
    loadComponent: () => import('./pages/stock-movement-history/stock-movement-history.component').then(m => m.StockMovementHistoryComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/product-edit/product-edit.page').then(m => m.ProductEditPage)
  }
];
