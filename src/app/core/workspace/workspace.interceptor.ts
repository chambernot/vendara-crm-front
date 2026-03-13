import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { WorkspaceService } from './workspace.service';

/**
 * Interceptor HTTP para adicionar x-workspace-id e tratar erros de workspace
 * Injeta o header em todas as chamadas /api/* (exceto rotas públicas)
 */
export const workspaceInterceptor: HttpInterceptorFn = (req, next) => {
  const workspaceService = inject(WorkspaceService);
  const router = inject(Router);

  // LOG INICIAL - verificar se interceptor está sendo executado
  console.log('🔍 [WORKSPACE INTERCEPTOR] REQUEST INTERCEPTADO:', {
    url: req.url,
    method: req.method,
    urlIncluesApi: req.url.includes('/api'),
  });

  // Interceptar requisições para /api (privadas) e /public (rotas públicas diretas em produção)
  const isApiRequest = req.url.includes('/api');
  const isPublicRequest = req.url.includes('/public');
  if (!isApiRequest && !isPublicRequest) {
    console.log('⏭️ [WORKSPACE] URL não é /api nem /public - pulando:', req.url);
    return next(req);
  }

  // Rotas públicas ainda precisam de contexto de workspace no backend atual.
  // Para /api/public/catalog/{workspaceSlug}[/{productId}], enviamos x-workspace-slug
  // extraído da própria URL, sem depender de sessão/workspace selecionado.
  const urlWithoutQuery = req.url.split('?')[0];
  const publicCatalogPrefixes = ['/api/public/catalog/', '/public/catalog/'];
  const matchedPrefix = publicCatalogPrefixes.find(prefix => urlWithoutQuery.includes(prefix));
  if (matchedPrefix) {
    const publicCatalogIndex = urlWithoutQuery.indexOf(matchedPrefix);
    const tail = urlWithoutQuery.substring(publicCatalogIndex + matchedPrefix.length);
    const workspaceSlug = tail.split('/')[0];
    if (workspaceSlug) {
      console.log('🌐 [WORKSPACE] Rota pública catálogo - adicionando x-workspace-slug:', {
        url: req.url,
        workspaceSlug,
      });

      const publicReq = req.clone({
        setHeaders: {
          'x-workspace-slug': workspaceSlug,
        },
      });

      return next(publicReq);
    }
  }

  // Outras rotas públicas não exigem workspace selecionado
  if (isPublicRequest) {
    console.log('⏭️ [WORKSPACE] Rota pública (não catálogo) - pulando:', req.url);
    return next(req);
  }

  // Não interceptar rotas que não precisam de workspace
  const noWorkspaceRequired = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/status',
    '/api/public',         // Rotas públicas não dependem de workspace selecionado (slug é injetado quando aplicável)
    '/api/workspaces',      // Lista e criação de workspaces
    '/api/onboarding',      // Completar onboarding
  ];

  const isNoWorkspaceRoute = noWorkspaceRequired.some(route => req.url.includes(route));

  if (isNoWorkspaceRoute) {
    console.log('✅ [WORKSPACE] Rota sem workspace requerido:', req.url);
    return next(req);
  }

  console.log('✅ [WORKSPACE] Rota PRECISA de workspace - continuando:', req.url);

  // ===== OBTER WORKSPACE ID - PRIORIDADES =====
  // 1. localStorage (persistente entre sessões)
  // 2. sessionStorage (sessão atual)
  // 3. Service (memória)
  let currentWorkspaceId: string | null = null;
  
  // PRIORIDADE 1: localStorage (conforme backend recomenda)
  try {
    currentWorkspaceId = localStorage.getItem('workspaceId') || localStorage.getItem('currentWorkspaceId');
    if (currentWorkspaceId) {
      console.log('✅ [WORKSPACE INTERCEPTOR] localStorage encontrado:', currentWorkspaceId);
    }
  } catch (e) {
    console.error('❌ [WORKSPACE INTERCEPTOR] Erro ao ler localStorage:', e);
  }
  
  // PRIORIDADE 2: sessionStorage
  if (!currentWorkspaceId) {
    try {
      currentWorkspaceId = sessionStorage.getItem('currentWorkspaceId');
      if (currentWorkspaceId) {
        console.log('✅ [WORKSPACE INTERCEPTOR] sessionStorage encontrado:', currentWorkspaceId);
      }
    } catch (e) {
      console.error('❌ [WORKSPACE INTERCEPTOR] Erro ao ler sessionStorage:', e);
    }
  }
  
  // PRIORIDADE 3: Service
  if (!currentWorkspaceId) {
    currentWorkspaceId = workspaceService.getCurrentWorkspaceId();
    if (currentWorkspaceId) {
      console.log('✅ [WORKSPACE INTERCEPTOR] Service encontrado:', currentWorkspaceId);
    }
  }
  
  // Log detalhado para debug
  console.log('🔍 [WORKSPACE INTERCEPTOR] Request URL:', req.url);
  console.log('🔍 [WORKSPACE INTERCEPTOR] currentWorkspaceId final:', currentWorkspaceId);
  console.log('🔍 [WORKSPACE INTERCEPTOR] Tipo:', typeof currentWorkspaceId);

  // ===== VALIDAÇÃO SIMPLIFICADA =====
  // Se não tiver workspaceId, apenas avisar mas NÃO bloquear
  // (permite que algumas rotas funcionem mesmo sem workspace)
  if (!currentWorkspaceId) {
    console.warn('⚠️ [WORKSPACE INTERCEPTOR] Nenhum workspace encontrado para:', req.url);
    console.warn('⚠️ [WORKSPACE INTERCEPTOR] Request será enviado SEM header x-workspace-id');
    console.warn('⚠️ [WORKSPACE INTERCEPTOR] Se a rota precisar, o backend retornará 400');
    
    // Não bloquear - deixar o backend decidir se precisa ou não
    return next(req);
  }

  // ===== ADICIONAR HEADER x-workspace-id =====
  console.log('🏢 [WORKSPACE] ===== ADICIONANDO WORKSPACE AO REQUEST =====');
  console.log('🏢 [WORKSPACE] URL:', req.url);
  console.log('🏢 [WORKSPACE] Method:', req.method);
  console.log('🏢 [WORKSPACE] WorkspaceId:', currentWorkspaceId);
  console.log('🏢 [WORKSPACE] WorkspaceId length:', currentWorkspaceId.length);
  console.log('🏢 [WORKSPACE] WorkspaceId type:', typeof currentWorkspaceId);
  
  console.log('🔍 [WORKSPACE] Headers ANTES de clonar:', {
    authorization: req.headers.get('Authorization') ? 'Bearer ***' : null,
    contentType: req.headers.get('Content-Type'),
    accept: req.headers.get('Accept'),
    apiKey: req.headers.get('X-API-KEY')
  });

  const workspaceReq = req.clone({ 
    setHeaders: { 
      'x-workspace-id': currentWorkspaceId 
    } 
  });
  
  // Verificar se o header foi adicionado corretamente
  const headerValue = workspaceReq.headers.get('x-workspace-id');
  console.log('✅ [WORKSPACE] Header x-workspace-id RESULTADO:', headerValue);
  console.log('✅ [WORKSPACE] Header x-workspace-id length:', headerValue?.length);
  
  console.log('🔍 [WORKSPACE] TODOS os headers APÓS clonar:', {
    'x-workspace-id': workspaceReq.headers.get('x-workspace-id'),
    'Authorization': workspaceReq.headers.get('Authorization') ? 'Bearer ***' : null,
    'Content-Type': workspaceReq.headers.get('Content-Type'),
    'Accept': workspaceReq.headers.get('Accept'),
    'X-API-KEY': workspaceReq.headers.get('X-API-KEY')
  });
  
  // Listar TODOS os headers para debug
  console.log('🔍 [WORKSPACE] KEYS de todos os headers:', workspaceReq.headers.keys());
  
  if (headerValue !== currentWorkspaceId) {
    console.error('❌❌❌ [WORKSPACE] ERRO CRÍTICO: Header não foi adicionado corretamente!');
    console.error('  - Esperado:', currentWorkspaceId);
    console.error('  - Obtido:', headerValue);
    console.error('  - São iguais?:', headerValue === currentWorkspaceId);
  } else {
    console.log('✅✅✅ [WORKSPACE] Header x-workspace-id foi adicionado CORRETAMENTE!');
  }
  
  console.log('🏢 [WORKSPACE] ===== FIM DA ADIÇÃO DO HEADER =====');

  // Processar requisição e tratar erros de workspace
  return next(workspaceReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorMessageRaw = (error as any)?.error?.message || (error as any)?.error?.error || '';
      const errorMessage = typeof errorMessageRaw === 'string' ? errorMessageRaw : '';

      // Se o backend responder "workspaceId required" mesmo com workspaceId local,
      // normalmente significa que o backend depende de uma seleção/sincronização de sessão/claims.
      // Tentamos sincronizar chamando POST /api/workspaces/{id}/select e reexecutar a request 1 vez.
      const alreadyRetried = req.headers.has('x-workspace-sync-retry');
      const isWorkspaceRequired =
        error.status === 400 &&
        errorMessage.toLowerCase().includes('workspaceid required');

      if (isWorkspaceRequired && currentWorkspaceId && !alreadyRetried) {
        console.warn('🔁 [WORKSPACE] Backend pediu workspaceId mesmo com header enviado!');
        console.warn('🔁 [WORKSPACE] Request URL:', req.url);
        console.warn('🔁 [WORKSPACE] WorkspaceId enviado:', currentWorkspaceId);
        console.warn('🔁 [WORKSPACE] Header x-workspace-id:', workspaceReq.headers.get('x-workspace-id'));
        console.warn('🔁 [WORKSPACE] Tentando sincronizar seleção e retry...');

        const retriedReq = workspaceReq.clone({
          setHeaders: {
            'x-workspace-sync-retry': '1',
          },
        });

        return workspaceService.selectWorkspace(currentWorkspaceId).pipe(
          switchMap(() => {
            console.log('✅ [WORKSPACE] Sync OK. Retentando request original...');
            return next(retriedReq);
          }),
          catchError((syncErr) => {
            console.error('❌ [WORKSPACE] Sync falhou. Não foi possível satisfazer workspaceId required.');
            console.error('❌ [WORKSPACE] Status:', syncErr?.status);
            console.error('❌ [WORKSPACE] Mensagem:', syncErr?.error?.message || syncErr?.message);
            console.error('❌ [WORKSPACE] WorkspaceId tentado:', currentWorkspaceId);
            console.error('❌ [WORKSPACE] O problema pode ser:');
            console.error('  1. Backend não reconhece o endpoint POST /api/workspaces/{id}/select');
            console.error('  2. Backend não está lendo o header x-workspace-id corretamente');
            console.error('  3. WorkspaceId inválido ou workspace não existe');
            return throwError(() => error);
          }),
        );
      }

      // DESABILITADO TEMPORARIAMENTE: Não limpar workspace em erros 403
      // O problema pode ser sincronização com backend, não workspace inválido
      
      // Apenas logar o erro para diagnóstico
      if ((error.status === 400 || error.status === 403) && error.error) {
        const errorMessage = error.error.message || error.error.error || '';
        const isWorkspaceError = 
          errorMessage.toLowerCase().includes('workspace') ||
          errorMessage.toLowerCase().includes('ambiente');

        if (isWorkspaceError) {
          console.error('❌ [WORKSPACE] Erro de workspace detectado:', errorMessage);
          console.error('❌ [WORKSPACE] URL:', req.url);
          console.error('❌ [WORKSPACE] Workspace ID:', currentWorkspaceId);
          console.warn('⚠️ [WORKSPACE] Mantendo workspace (não limpar automaticamente)');
          
          // TODO: O backend precisa implementar/corrigir:
          // 1. POST /api/workspaces/{id}/select - para associar workspace ao usuário
          // 2. Middleware de workspace - para verificar x-workspace-id corretamente
          // 3. Permissões de workspace - para permitir acesso após seleção
        }
      }

      return throwError(() => error);
    })
  );
};
