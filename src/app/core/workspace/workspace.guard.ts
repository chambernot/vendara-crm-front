import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { WorkspaceService } from './workspace.service';

/**
 * Guard que verifica se existe workspace ativo
 * Redireciona para /workspace/select se não houver
 */
export const workspaceGuard: CanActivateFn = (route, state) => {
  const workspaceService = inject(WorkspaceService);
  const router = inject(Router);

  console.log('🛡️ [WORKSPACE GUARD] ========== VERIFICANDO WORKSPACE ==========');
  console.log('🛡️ [WORKSPACE GUARD] Rota destino:', state.url);
  
  const currentWorkspaceId = workspaceService.getCurrentWorkspaceId();
  console.log('🛡️ [WORKSPACE GUARD] currentWorkspaceId:', currentWorkspaceId);
  console.log('🛡️ [WORKSPACE GUARD] currentWorkspaceId tipo:', typeof currentWorkspaceId);
  console.log('🛡️ [WORKSPACE GUARD] currentWorkspaceId length:', currentWorkspaceId?.length);
  console.log('🛡️ [WORKSPACE GUARD] currentWorkspaceId é null:', currentWorkspaceId === null);
  console.log('🛡️ [WORKSPACE GUARD] currentWorkspaceId é empty:', currentWorkspaceId === '');
  
  const activeWorkspace = workspaceService.getActive();
  console.log('🛡️ [WORKSPACE GUARD] activeWorkspace:', activeWorkspace);
  
  // Se não há workspace ativo, redirecionar
  if (!currentWorkspaceId) {
    console.warn('⚠️ [GUARD] Nenhum workspace ativo, redirecionando para seleção');
    return router.createUrlTree(['/workspace/select']);
  }

  // Sincronizar seleção de workspace com o backend (1x por sessão) para garantir
  // que o backend associe o usuário/claims ao workspace (evita 400 workspaceId required).
  const SYNC_KEY = 'vendara_workspace_synced_v1';
  let alreadySynced = false;
  try {
    alreadySynced = sessionStorage.getItem(SYNC_KEY) === currentWorkspaceId;
  } catch {
    alreadySynced = false;
  }

  if (!alreadySynced) {
    console.log('🔄 [WORKSPACE GUARD] Workspace ainda não sincronizado com backend. Sincronizando...');
    console.log('🔄 [WORKSPACE GUARD] WorkspaceId a sincronizar:', currentWorkspaceId);
    console.log('🔄 [WORKSPACE GUARD] Endpoint:', `/workspaces/${currentWorkspaceId}/select`);
    
    return workspaceService.selectWorkspace(currentWorkspaceId).pipe(
      map(() => {
        try {
          sessionStorage.setItem(SYNC_KEY, currentWorkspaceId);
        } catch {
          // ignore
        }
        console.log('✅ [WORKSPACE GUARD] Workspace sincronizado com sucesso!');
        return true;
      }),
      catchError((err) => {
        // Não bloquear navegação por falha de sync (ambientes podem não implementar /select).
        console.error('❌ [WORKSPACE GUARD] Falha ao sincronizar workspace com backend!');
        console.error('  Status:', err?.status);
        console.error('  Mensagem:', err?.error?.message || err?.message);
        console.error('  URL tentada:', `/api/workspaces/${currentWorkspaceId}/select`);
        console.warn('⚠️ [WORKSPACE GUARD] Continuando mesmo assim (backend pode não ter endpoint)');
        return of(true);
      })
    );
  }

  console.log('✅ [GUARD] Workspace ativo encontrado:', currentWorkspaceId);
  console.log('🛡️ [WORKSPACE GUARD] ========== GUARD OK ==========');
  return true;
};
