import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { workspaceInterceptor } from './core/workspace';
import { whatsappApiInterceptor } from './core/whatsapp-api';
import { authInterceptor } from './core/api';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

// Registra locale pt-BR para formatação de moeda
registerLocaleData(localePt);

/**
 * Configuração principal da aplicação
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withInterceptors([
      // IMPORTANT: workspace must run before auth so x-workspace-* headers
      // are present and preserved for auth fallback/retry logic.
      workspaceInterceptor,
      authInterceptor,
      whatsappApiInterceptor,
    ])),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
  ],
};
