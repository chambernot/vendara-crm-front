import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth';

export const workspaceRoutes: Routes = [
  {
    path: 'select',
    loadComponent: () =>
      import('./pages/workspace-select/workspace-select.page').then(
        (m) => m.WorkspaceSelectPage
      ),
    canActivate: [authGuard],
  },
];
