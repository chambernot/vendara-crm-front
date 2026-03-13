import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/guards/auth.guard';

export const onboardingRoutes: Routes = [
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPage),
  },
];
