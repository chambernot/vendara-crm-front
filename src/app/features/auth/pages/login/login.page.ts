import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { WorkspaceService } from '../../../../core/workspace';
import { TelemetryService } from '../../../../core/telemetry';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.page.html',
})
export class LoginPage implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private telemetryService = inject(TelemetryService);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = false;
  errorMessage = '';
  sessionExpired = signal(false);

  ngOnInit(): void {
    // Verificar se usuário foi redirecionado por expiração de sessão
    this.route.queryParams.subscribe(params => {
      if (params['expired'] === 'true') {
        this.sessionExpired.set(true);
        // Limpar o parâmetro da URL sem recarregar a página
        this.router.navigate([], {
          queryParams: {},
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';

    const email = this.loginForm.value.email;
    const password = this.loginForm.value.password;
    
    // Fazer login via API
    this.authService.login(email, password).subscribe({
      next: (authResponse) => {
        console.log('✅ Login bem-sucedido:', authResponse);
        console.log('🔍 Debug completo da resposta:', JSON.stringify(authResponse, null, 2));
        
        // 🧹 IMPORTANTE: não limpar localStorage/sessionStorage por completo.
        // Isso remove token/usuário/flags e causa perda de contexto (workspace) em páginas do app.
        // Mantemos apenas a limpeza do workspace anterior.
        console.log('🧹 [LOGIN PAGE] Limpando workspace anterior pós-login...');
        this.workspaceService.clearActive();
        console.log('✅ [LOGIN PAGE] Workspace anterior limpo');
        
        this.loading = false;
        
        // Backend retorna: { success: true, data: { token, user, onboardingComplete, hasWorkspaces }, message }
        const data = (authResponse as any).data || authResponse;
        const user = data.user || authResponse.user;
        
        console.log('🔍 Debug data:', data);
        console.log('🔍 Debug user:', user);
        console.log('🔍 Debug data.onboardingComplete:', data.onboardingComplete);
        console.log('🔍 Debug data.hasWorkspaces:', data.hasWorkspaces);
        
        // Verificar se usuário tem defaultWorkspaceId VÁLIDO (não vazio)
        const defaultWorkspaceId = user?.defaultWorkspaceId 
          || data.defaultWorkspaceId 
          || authResponse.defaultWorkspaceId;
        
        // Validar se é uma string válida (não vazia, não null, não undefined)
        const hasValidDefaultWorkspace = defaultWorkspaceId && 
                                         typeof defaultWorkspaceId === 'string' && 
                                         defaultWorkspaceId.trim().length > 0;
        
        console.log('🔍 Debug defaultWorkspaceId:', {
          'user?.defaultWorkspaceId': user?.defaultWorkspaceId,
          'data.defaultWorkspaceId': data.defaultWorkspaceId,
          'authResponse.defaultWorkspaceId': authResponse.defaultWorkspaceId,
          'FINAL': defaultWorkspaceId,
          'É VÁLIDO?': hasValidDefaultWorkspace
        });
        
        // NÃO USAR defaultWorkspaceId - pode ser de outro usuário
        // Sempre fazer o usuário selecionar ou passar pelo onboarding
        console.log('⚠️ Ignorando defaultWorkspaceId por segurança - usuário deve selecionar workspace');
        
        console.log('⚠️ Verificando flags de onboarding e workspaces...');
        
        // Usar dados da API para decidir fluxo (com valores padrão)
        // Se a API não retornar, verificar localStorage
        const onboardingComplete = data.onboardingComplete 
          ?? authResponse.onboardingComplete 
          ?? this.authService.isOnboardingComplete();
        const hasWorkspaces = data.hasWorkspaces 
          ?? authResponse.hasWorkspaces 
          ?? this.authService.hasWorkspaces();
        
        console.log('🔍 Debug flags finais:', {
          onboardingComplete,
          hasWorkspaces,
          'data.onboardingComplete': data.onboardingComplete,
          'authResponse.onboardingComplete': authResponse.onboardingComplete,
          'localStorage onboarding': this.authService.isOnboardingComplete(),
          'data.hasWorkspaces': data.hasWorkspaces,
          'authResponse.hasWorkspaces': authResponse.hasWorkspaces,
          'localStorage hasWorkspaces': this.authService.hasWorkspaces()
        });
        
        console.log('📊 Status do usuário:', { 
          onboardingComplete, 
          hasWorkspaces,
          fonte: authResponse.onboardingComplete !== undefined ? 'API' : 'localStorage'
        });
        
        // Se onboarding não está completo E não tem workspaces, ir para onboarding
        if (!onboardingComplete && !hasWorkspaces) {
          console.log('📋 Primeiro acesso, redirecionando para onboarding...');
          this.router.navigate(['/onboarding']);
          return;
        }
        
        // Se tem workspaces (mesmo sem onboarding completo), buscar da API e decidir
        // Isso evita que usuário veja onboarding novamente após criar workspace
        if (hasWorkspaces) {
          console.log('✅ Usuário tem workspaces, buscando lista e decidindo fluxo...');
          
          // Buscar workspaces do usuário via /api/workspaces/my
          this.workspaceService.getMyWorkspaces().subscribe({
            next: (workspaces) => {
              console.log('✅ Workspaces carregados:', workspaces);
              
              // Se não tem workspaces (apesar da flag), ir para onboarding
              if (!workspaces || workspaces.length === 0) {
                console.log('⚠️ Flag hasWorkspaces=true mas API retornou 0 workspaces, indo para onboarding');
                this.router.navigate(['/onboarding']);
                return;
              }
              
              // Se tem exatamente 1 workspace, selecionar automaticamente
              if (workspaces.length === 1) {
                const workspace = workspaces[0];
                console.log('✅ Usuário tem apenas 1 workspace, selecionando automaticamente:', workspace);
                
                // Salvar workspace
                this.workspaceService.select(workspace);
                
                // Notificar backend
                this.workspaceService.selectWorkspace(workspace.id).subscribe({
                  next: () => {
                    console.log('✅ Backend confirmou seleção automática do workspace');
                    // Marcar onboarding como completo
                    localStorage.setItem('vendara_onboarding', 'true');
                    localStorage.setItem('vendara_has_workspaces', 'true');
                    
                    // Navegar para dashboard
                    this.router.navigate(['/app/central']);
                  },
                  error: (err) => {
                    console.error('❌ Erro ao notificar backend, mas continuando:', err);
                    // Continuar mesmo com erro
                    localStorage.setItem('vendara_onboarding', 'true');
                    localStorage.setItem('vendara_has_workspaces', 'true');
                    this.router.navigate(['/app/central']);
                  }
                });
                return;
              }
              
              // Se tem múltiplos workspaces, mostrar tela de seleção
              console.log(`✅ Usuário tem ${workspaces.length} workspaces, redirecionando para seleção`);
              this.router.navigate(['/workspace/select']);
            },
            error: (err) => {
              console.error('❌ Erro ao buscar workspaces, redirecionando para seleção:', err);
              // Em caso de erro, redirecionar para seleção manual
              this.router.navigate(['/workspace/select']);
            }
          });
          return;
        }
        
        // Fallback: se onboarding completo mas sem workspaces (caso raro)
        console.log('🏢 Onboarding completo mas sem workspaces, redirecionando para onboarding...');
        this.router.navigate(['/onboarding']);
      },
      error: (err) => {
        this.loading = false;
        console.error('❌ Erro ao fazer login:', err);
        
        // Verificar se é erro 403 com ACCOUNT_EXPIRED
        if (err.status === 403) {
          const errors = err.error?.errors || [];
          if (errors.includes('ACCOUNT_EXPIRED')) {
            // Redirecionar para página de conta expirada
            this.router.navigate(['/auth/account-expired']);
            return;
          }
        }
        
        // Mensagens amigáveis baseadas no tipo de erro
        if (err.status === 0) {
          this.errorMessage = '🔌 Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
        } else if (err.status === 401 || err.status === 403) {
          this.errorMessage = '🔐 Email ou senha incorretos. Por favor, verifique suas credenciais.';
        } else if (err.status === 404) {
          this.errorMessage = '👤 Usuário não encontrado. Entre em contato com o administrador para criar sua conta.';
        } else if (err.status === 400) {
          // Tentar extrair mensagem específica do backend
          const message = err.error?.message || err.error?.error || '';
          if (message.toLowerCase().includes('password') || message.toLowerCase().includes('senha')) {
            this.errorMessage = '🔐 Senha inválida. Por favor, verifique sua senha.';
          } else if (message.toLowerCase().includes('email')) {
            this.errorMessage = '📧 Email inválido. Por favor, verifique seu email.';
          } else if (message) {
            this.errorMessage = `⚠️ ${message}`;
          } else {
            this.errorMessage = '⚠️ Dados de login inválidos. Verifique email e senha.';
          }
        } else if (err.status === 500) {
          this.errorMessage = '🛠️ Erro no servidor. Por favor, tente novamente em alguns instantes.';
        } else {
          this.errorMessage = '❌ Erro ao fazer login. Por favor, tente novamente ou entre em contato com o suporte.';
        }
      }
    });
  }
}
