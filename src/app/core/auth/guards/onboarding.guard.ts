import { inject } from '@angular/core';
import { Router, CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { WorkspaceService } from '../../workspace';
import { map, catchError, of } from 'rxjs';

export const onboardingGuard: CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log(' [ONBOARDING GUARD] Verificando onboarding...');

  if (!authService.isLoggedIn()) {
    console.warn(' [ONBOARDING GUARD] Usuário não logado, redirecionando para login');
    router.navigate(['/auth/login']);
    return false;
  }

  // IMPORTANTE: Verificar localStorage PRIMEIRO antes de chamar API
  // Isso evita loop de redirecionamento após selecionar workspace
  const onboardingCompleteLocal = authService.isOnboardingComplete();
  console.log(' [ONBOARDING GUARD] isOnboardingComplete():', onboardingCompleteLocal);
  
  if (onboardingCompleteLocal) {
    console.log(' [ONBOARDING GUARD] Onboarding completo (localStorage), permitindo acesso');
    return true;
  }

  console.log(' [ONBOARDING GUARD] Estado local indisponível, consultando API...');

  // Caso contrário, verificar na API
  return authService.checkUserStatus().pipe(
    map(status => {
      console.log(' [ONBOARDING GUARD] Status da API:', status);
      
      if (!status.onboardingComplete) {
        console.warn(' [ONBOARDING GUARD] Onboarding incompleto, redirecionando');
        router.navigate(['/onboarding']);
        return false;
      }
      
      console.log(' [ONBOARDING GUARD] Onboarding completo (API), permitindo acesso');
      return true;
    }),
    catchError(err => {
      console.error(' [ONBOARDING GUARD] Erro ao verificar status:', err);
      
      // Se der erro na API mas temos workspace selecionado, permitir acesso
      // (workspace só é selecionado após onboarding)
      const workspaceService = inject(WorkspaceService);
      const hasWorkspace = !!workspaceService.getCurrentWorkspaceId();
      
      if (hasWorkspace) {
        console.log(' [ONBOARDING GUARD] Erro na API mas workspace presente, permitindo acesso');
        return of(true);
      }
      
      console.warn(' [ONBOARDING GUARD] Erro na API, redirecionando para onboarding');
      router.navigate(['/onboarding']);
      return of(false);
    })
  );
};
