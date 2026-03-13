import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { User, OnboardingData, LoginDto, AuthResponse } from '../models/user.model';
import { WorkspaceService } from '../../workspace';
import { TelemetryService } from '../../telemetry';
import { ApiClient } from '../../api';

const STORAGE_KEYS = {
  TOKEN: 'vendara_token',
  USER: 'vendara_user',
  ONBOARDING: 'vendara_onboarding',
} as const;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private workspaceService = inject(WorkspaceService);
  private telemetryService = inject(TelemetryService);
  private apiClient = inject(ApiClient);
  private currentUser = signal<User | null>(null);
  private onboardingCompleteState = signal<boolean>(false);
  private hasWorkspacesState = signal<boolean>(false);

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
    if (userJson) {
      try {
        this.currentUser.set(JSON.parse(userJson));
      } catch {
        this.currentUser.set(null);
      }
    }
  }

  /**
   * Login via API - cria ou autentica usuário
   */
  login(email: string, password?: string): Observable<AuthResponse> {
    const dto: LoginDto = { email };
    if (password) {
      dto.password = password;
    }
    
    console.log('🔐 [AUTH] Iniciando login via API:', email);
    
    // 🧹 LIMPAR WORKSPACE ANTES DE FAZER LOGIN
    console.log('🧹 [AUTH] Limpando workspace anterior ANTES do login...');
    this.workspaceService.clearActive();
    console.log('✅ [AUTH] Workspace limpo!');
    
    return this.apiClient.post<AuthResponse>('/auth/login', dto).pipe(
      tap(response => {
        console.log('✅ [AUTH] Resposta da API recebida:', response);
        
        // 🧹 LIMPAR WORKSPACE NOVAMENTE APÓS SUCESSO (dupla garantia)
        console.log('🧹 [AUTH] Limpando workspace novamente APÓS resposta da API...');
        this.workspaceService.clearActive();
        console.log('✅ [AUTH] Workspace limpo novamente!');
        
        // Backend retorna { success, data: { token, user, ... }, message }
        const data = (response as any).data || response;
        const token = data.token;
        const user = data.user;
        
        console.log('🔍 [AUTH] Debug extração:', {
          'response': response,
          'data': data,
          'user': user,
          'user.defaultWorkspaceId': user?.defaultWorkspaceId
        });
        
        // Verificar se token existe
        if (!token) {
          console.error('❌ [AUTH] Backend não retornou token!', response);
          throw new Error('Backend não retornou token de autenticação');
        }
        
        // Salvar token no localStorage
        console.log('💾 [AUTH] Salvando token:', token.substring(0, 20) + '...');
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        
        // Verificar e salvar user
        if (user) {
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          this.currentUser.set(user);
          console.log('✅ [AUTH] Usuário salvo:', user);
        } else {
          console.warn('⚠️ [AUTH] Backend não retornou dados do usuário');
        }
        
        // Verificar se token foi salvo
        const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
        console.log('✅ [AUTH] Token verificado no localStorage:', savedToken ? 'Presente ✓' : 'ERRO: Não salvo!');
        
        console.log('🔍 [AUTH] ANTES DE EXTRAIR FLAGS - Debug completo:');
        console.log('   - data:', data);
        console.log('   - user:', user);
        console.log('   - user?.defaultWorkspaceId:', user?.defaultWorkspaceId);
        console.log('   - data.onboardingComplete:', data.onboardingComplete);
        console.log('   - data.hasWorkspaces:', data.hasWorkspaces);
        
        // Armazenar estado de onboarding e workspaces (podem estar em data ou direto)
        let onboardingComplete = data.onboardingComplete ?? (response as any).onboardingComplete ?? false;
        let hasWorkspaces = data.hasWorkspaces ?? (response as any).hasWorkspaces ?? false;
        
        console.log('🔍 [AUTH] DEPOIS primeira extração:');
        console.log('   - onboardingComplete:', onboardingComplete);
        console.log('   - hasWorkspaces:', hasWorkspaces);
        
        // IMPORTANTE: Se usuário tem defaultWorkspaceId, então tem workspaces e onboarding completo
        const userHasDefaultWorkspace = user?.defaultWorkspaceId;
        console.log('🔍 [AUTH] Verificando defaultWorkspaceId:', userHasDefaultWorkspace);
        
        if (userHasDefaultWorkspace) {
          console.log('✅ [AUTH] Usuário tem defaultWorkspaceId, forçando flags para true');
          onboardingComplete = true;
          hasWorkspaces = true;
        }
        
        console.log('🔍 [AUTH] FLAGS FINAIS:');
        console.log('   - onboardingComplete:', onboardingComplete);
        console.log('   - hasWorkspaces:', hasWorkspaces);
        
        this.onboardingCompleteState.set(onboardingComplete);
        this.hasWorkspacesState.set(hasWorkspaces);
        
        // Salvar estado da API no localStorage para persistência
        if (onboardingComplete) {
          localStorage.setItem(STORAGE_KEYS.ONBOARDING, 'true');
          console.log('✅ [AUTH] Onboarding marcado como completo no localStorage');
        } else {
          localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
        }
        
        if (hasWorkspaces) {
          localStorage.setItem('vendara_has_workspaces', 'true');
          console.log('✅ [AUTH] Has workspaces marcado como true no localStorage');
        }
        
        console.log('✅ [AUTH] Login salvo localmente');
        console.log('📋 [AUTH] Onboarding completo:', onboardingComplete);
        console.log('🏢 [AUTH] Tem workspaces:', hasWorkspaces);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
    this.workspaceService.clearActive(); // Limpar workspace ativo
    this.currentUser.set(null);
    this.onboardingCompleteState.set(false);
    this.hasWorkspacesState.set(false);
    this.router.navigate(['/auth/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  isOnboardingComplete(): boolean {
    // Usar estado da API se disponível
    if (this.onboardingCompleteState()) {
      return true;
    }
    // Fallback para localStorage apenas para sessões já existentes
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING) === 'true';
  }
  
  hasWorkspaces(): boolean {
    // Usar estado da API se disponível
    if (this.hasWorkspacesState()) {
      return true;
    }
    // Fallback para localStorage
    return localStorage.getItem('vendara_has_workspaces') === 'true';
  }

  /**
   * Verifica status do usu\u00e1rio na API (onboarding e workspaces)
   * \u00datil para guards e verifica\u00e7\u00f5es ass\u00edncronas
   */
  checkUserStatus(): Observable<{ onboardingComplete: boolean; hasWorkspaces: boolean }> {
    console.log('\ud83d\udd0d [AUTH] Verificando status do usu\u00e1rio na API...');
    
    return this.apiClient.get<{ onboardingComplete: boolean; hasWorkspaces: boolean }>('/auth/status').pipe(
      tap(status => {
        console.log('\u2705 [AUTH] Status recebido da API:', status);
        this.onboardingCompleteState.set(status.onboardingComplete);
        this.hasWorkspacesState.set(status.hasWorkspaces);
        
        // Atualizar localStorage
        if (status.onboardingComplete) {
          localStorage.setItem(STORAGE_KEYS.ONBOARDING, 'true');
        } else {
          localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
        }
      })
    );
  }
  completeOnboarding(payload: any): Observable<void> {
    console.log('📋 [ONBOARDING] Enviando para API:', payload);
    
    // Enviar para API
    return this.apiClient.post<void>('/onboarding/complete', payload).pipe(
      tap(() => {
        console.log('✅ [ONBOARDING] API confirmou sucesso');
        
        // Atualizar estado local
        this.onboardingCompleteState.set(true);
        localStorage.setItem(STORAGE_KEYS.ONBOARDING, 'true');
        
        // Log telemetry
        try {
          this.telemetryService.log('onboarding_complete');
        } catch {
          // Silent fail
        }
        
        console.log('✅ [ONBOARDING] Estado atualizado');
      })
    );
  }

  /**
   * Verifica o status da conta do usuário (expiração, plano, etc)
   * Consulta GET /api/auth/me para obter dados atualizados
   */
  checkAccountStatus(): Observable<User> {
    console.log('🔍 [AUTH] Verificando status da conta na API...');
    
    return this.apiClient.get<User>('/auth/me').pipe(
      tap(user => {
        console.log('✅ [AUTH] Status da conta recebido:', user);
        
        // Atualizar dados do usuário no localStorage e signal
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        this.currentUser.set(user);
        
        // Verificar se a conta está próxima de expirar
        if (user.daysRemaining !== null && user.daysRemaining !== undefined && user.daysRemaining <= 15) {
          console.warn(`⚠️ [AUTH] Conta expira em ${user.daysRemaining} dias!`);
        }
        
        // Verificar se a conta está expirada
        if (user.accountStatus === 'EXPIRED') {
          console.error('❌ [AUTH] Conta expirada!');
        }
      })
    );
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }
}
