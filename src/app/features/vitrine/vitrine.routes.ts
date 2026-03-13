import { Routes } from '@angular/router';
import { VitrineHomeComponent } from './pages/vitrine-home.component';
import { VitrineComponent } from './pages/vitrine.component';
import { ProdutoDetalheComponent } from './pages/produto-detalhe.component';
import { VitrineAnalyticsComponent } from './pages/vitrine-analytics.component';

export const VITRINE_ROUTES: Routes = [
  {
    path: ':workspaceSlug',
    component: VitrineHomeComponent
  },
  {
    path: ':workspaceSlug/catalogo',
    component: VitrineComponent
  },
  {
    path: ':workspaceSlug/analytics',
    component: VitrineAnalyticsComponent
  },
  {
    path: ':workspaceSlug/:productId',
    component: ProdutoDetalheComponent
  }
];
