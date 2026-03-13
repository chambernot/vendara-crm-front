import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'onboarding',
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then(
        (m) => m.onboardingRoutes
      ),
  },
  {
    path: 'workspace',
    loadChildren: () =>
      import('./features/workspace/workspace.routes').then(
        (m) => m.workspaceRoutes
      ),
  },
  {
    path: 'app',
    loadChildren: () =>
      import('./features/app/app.routes').then((m) => m.appRoutes),
  },
  {
    path: 'vitrine',
    loadChildren: () =>
      import('./features/vitrine/vitrine.routes').then((m) => m.VITRINE_ROUTES),
  },
  {
    path: '',
    redirectTo: '/auth/login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/auth/login',
  },
];
