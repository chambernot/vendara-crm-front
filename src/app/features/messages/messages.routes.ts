import { Routes } from '@angular/router';

export const messagesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/conversations/conversations.page').then(
        m => m.ConversationsPage
      ),
  },
  {
    path: ':clientId',
    loadComponent: () =>
      import('./pages/message-thread/message-thread.page').then(
        m => m.MessageThreadPage
      ),
  },
];
