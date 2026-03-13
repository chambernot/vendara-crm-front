import { Routes } from '@angular/router';

export const metricsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/metrics/metrics.page').then((m) => m.MetricsPage),
  },
];
