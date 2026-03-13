import { Routes } from '@angular/router';
import { onboardingGuard } from '../../core/auth/guards/onboarding.guard';
import { workspaceGuard } from '../../core/workspace';

export const appRoutes: Routes = [
  {
    path: '',
    canMatch: [onboardingGuard, workspaceGuard],
    loadComponent: () =>
      import('../../shared/layouts/app-shell/app-shell.component').then(
        (m) => m.AppShellComponent
      ),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('../dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'clientes',
        loadChildren: () =>
          import('../clients/clients.routes').then((m) => m.CLIENTS_ROUTES),
      },
      {
        path: 'catalogo',
        loadChildren: () =>
          import('../catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
      },
      {
        path: 'vendas',
        loadChildren: () =>
          import('../sales/sales.routes').then((m) => m.SALES_ROUTES),
      },
      {
        path: 'consignacoes',
        loadChildren: () =>
          import('../consignations/consignations.routes').then((m) => m.CONSIGNATIONS_ROUTES),
      },
      {
        path: 'relatorios',
        loadChildren: () =>
          import('../reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'central',
        loadChildren: () =>
          import('../central/central.routes').then((m) => m.CENTRAL_ROUTES),
      },
      {
        path: 'mensagens',
        loadChildren: () =>
          import('../messages/messages.routes').then((m) => m.messagesRoutes),
      },
      {
        path: 'metrics',
        loadChildren: () =>
          import('../metrics/metrics.routes').then((m) => m.metricsRoutes),
      },
    ],
  },
];
