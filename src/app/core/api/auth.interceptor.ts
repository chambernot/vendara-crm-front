import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Interceptor HTTP para adicionar autenticação JWT
 * Usa Bearer token JWT para todas as requisições autenticadas
 * 
 * NOTA: x-workspace-id é adicionado pelo workspaceInterceptor
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Somente interceptar requisições para /api
  if (!req.url.includes('/api')) {
    return next(req);
  }

  // Em desenvolvimento, muitos endpoints do backend exigem X-API-KEY.
  // Mantemos isso aqui para evitar 401 ao consultar/criar recursos.
  const devApiKey = !environment.production ? environment.apiKey : '';

  // Não interceptar rotas públicas
  if (req.url.includes('/api/public/')) {
    console.log('🌐 [AUTH] Rota pública detectada, não adicionar autenticação:', req.url);

    if (devApiKey) {
      const publicReq = req.clone({
        setHeaders: {
          'X-API-KEY': devApiKey,
          'Accept': req.headers.get('Accept') || 'application/json',
        },
      });
      return next(publicReq);
    }

    return next(req);
  }

  // Obter token JWT do localStorage
  let token = localStorage.getItem('vendara_token');
  token = token ? token.trim() : token;
  if (token && token.toLowerCase().startsWith('bearer ')) {
    token = token.substring(7).trim();
  }
  
  // Se não houver token, continuar sem autenticação (backend retornará 401 se necessário)
  if (!token) {
    console.warn('⚠️ [AUTH] Nenhum token encontrado para:', req.url);

    if (devApiKey) {
      const apiKeyReq = req.clone({
        setHeaders: {
          'X-API-KEY': devApiKey,
          'Accept': req.headers.get('Accept') || 'application/json',
        },
      });
      return next(apiKeyReq);
    }

    return next(req);
  }

  console.log('🔐 [AUTH] Token encontrado:', token ? token.substring(0, 20) + '...' : 'undefined');
  console.log('🔐 [AUTH] Adicionando token JWT para:', req.url);
  console.log('🔐 [AUTH] Dev API Key configurada?', !!devApiKey);

  // Criar headers com token JWT
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };

  // Em dev, também enviar API key (se configurada)
  if (devApiKey) {
    headers['X-API-KEY'] = devApiKey;
  }

  // Adicionar Content-Type apenas se não for GET e não for FormData
  // FormData (upload de arquivos) define automaticamente multipart/form-data com boundary
  if (req.method && req.method.toUpperCase() !== 'GET' && !(req.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const authReq = req.clone({ setHeaders: headers });

  console.log('📤 [AUTH] Headers configurados:', {
    'Authorization': 'Bearer ***',
    'Accept': authReq.headers.get('Accept'),
    'Content-Type': authReq.headers.get('Content-Type')
  });
  
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Se erro 403 com ACCOUNT_EXPIRED, redirecionar para tela específica
      if (error.status === 403) {
        const errors = error.error?.errors || [];
        if (errors.includes('ACCOUNT_EXPIRED')) {
          console.error('❌ [AUTH] Conta expirada:', {
            url: error.url,
            message: error.error?.message || 'Sua conta expirou',
            hint: 'Entre em contato para renovar sua assinatura'
          });
          
          // Redirecionar para página de conta expirada
          router.navigate(['/auth/account-expired']);
          return throwError(() => error);
        }
      }
      
      // Se erro 401, token JWT inválido ou expirado
      if (error.status === 401) {
        console.error('❌ [AUTH] Erro de autenticação 401:', {
          url: error.url,
          message: (error as any).error?.message || error.message,
          statusText: error.statusText,
          hint: 'Token inválido/expirado. Faça login novamente.'
        });

        // Token expirado/inválido - limpar e redirecionar para login
        console.warn('⚠️ [AUTH] Token JWT expirado. Redirecionando para login...');
        localStorage.removeItem('vendara_token');
        localStorage.removeItem('vendara_user');
        router.navigate(['/auth/login']);
      } else if (error.status === 0) {
        console.error('❌ [AUTH] Erro de conexão:', {
          url: error.url,
          message: 'Não foi possível conectar ao servidor',
          hint: 'Verifique se o backend está rodando'
        });
      }
      return throwError(() => error);
    })
  );
};
