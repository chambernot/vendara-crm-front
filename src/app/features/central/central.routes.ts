import { Routes } from '@angular/router';

export const CENTRAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/followups/followups.page').then((m) => m.FollowupsPage),
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./pages/templates/templates.page').then((m) => m.TemplatesPage),
  },
  {
    path: 'whatsapp-templates',
    loadComponent: () =>
      import('./pages/whatsapp-templates/whatsapp-templates.page').then(
        (m) => m.WhatsAppTemplatesPage
      ),
  },
];
