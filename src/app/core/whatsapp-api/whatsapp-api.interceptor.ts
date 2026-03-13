import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Interceptor para adicionar API Key nas requisições para a API do WhatsApp
 */
export const whatsappApiInterceptor: HttpInterceptorFn = (req, next) => {
  // Adiciona o header X-API-KEY apenas para requisições ao backend configurado
  if (req.url.startsWith(environment.apiBaseUrl) && environment.whatsappApiKey) {
    const clonedRequest = req.clone({
      setHeaders: {
        'X-API-KEY': environment.whatsappApiKey
      }
    });
    return next(clonedRequest);
  }

  return next(req);
};
