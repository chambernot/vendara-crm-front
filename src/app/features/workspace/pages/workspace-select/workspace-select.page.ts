import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../../core/workspace';
import { Workspace } from '../../../../core/workspace/workspace.models';
import { AuthService } from '../../../../core/auth/services/auth.service';

@Component({
  selector: 'app-workspace-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workspace-select.page.html',
})
export class WorkspaceSelectPage implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private router = inject(Router);
  private authService = inject(AuthService);

  workspaces = signal<Workspace[]>([]);
  newWorkspaceName = signal('');
  creating = signal(false);
  loading = signal(false);
  errorMessage = signal('');

  ngOnInit(): void {
    this.loadWorkspaces();
  }

  private loadWorkspaces(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.workspaceService.list().subscribe({
      next: (workspaces) => {
        console.log('✅ Workspaces carregados:', workspaces);
        this.workspaces.set(workspaces);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('❌ Erro ao carregar workspaces:', err);
        this.errorMessage.set('Erro ao carregar ambientes. Tente novamente.');
        this.loading.set(false);
      }
    });
  }

  selectWorkspace(workspace: Workspace): void {
    console.log('📌 ========== SELECIONANDO WORKSPACE ==========');
    console.log('📌 Workspace recebido:', workspace);
    console.log('📌 Workspace ID:', workspace.id);
    console.log('📌 Workspace Name:', workspace.name);
    console.log('📌 Tipo do ID:', typeof workspace.id);
    
    if (!workspace.id) {
      console.error('❌ Workspace sem ID!', workspace);
      this.errorMessage.set('Erro: Workspace sem identificador válido.');
      return;
    }
    
    this.loading.set(true);
    this.errorMessage.set('');
    
    // PRIMEIRO: Salvar workspace completo FORÇANDO sincronização
    console.log('💾 [WORKSPACE SELECT] ========== SALVANDO WORKSPACE ==========');
    console.log('💾 [WORKSPACE SELECT] Workspace:', workspace);
    console.log('💾 [WORKSPACE SELECT] ID:', workspace.id);
    
    try {
      // Salvar no service
      this.workspaceService.select(workspace);
      
      // FORCE: Salvar diretamente no sessionStorage E localStorage (garantir persistência)
      sessionStorage.setItem('currentWorkspaceId', workspace.id);
      sessionStorage.setItem('currentWorkspace', JSON.stringify(workspace));
      
      // ✅ IMPORTANTE: Salvar com chave 'workspaceId' para compatibilidade com backend
      localStorage.setItem('workspaceId', workspace.id);
      localStorage.setItem('currentWorkspaceId', workspace.id);
      localStorage.setItem('currentWorkspace', JSON.stringify(workspace));
      
      console.log('✅ [WORKSPACE SELECT] Workspace salvo no service + sessionStorage + localStorage');
      
      // Verificação TRIPLA para garantir
      const check1 = this.workspaceService.getCurrentWorkspaceId();
      const check2 = sessionStorage.getItem('currentWorkspaceId');
      const check3 = sessionStorage.getItem('currentWorkspace');
      const check4 = localStorage.getItem('workspaceId');
      
      console.log('🔍 [WORKSPACE SELECT] Verificação completa:');
      console.log('  1. Service:', check1);
      console.log('  2. SessionStorage ID:', check2);
      console.log('  3. SessionStorage Workspace:', check3);
      console.log('  4. LocalStorage workspaceId:', check4);
      
      if (check1 !== workspace.id || check2 !== workspace.id || check4 !== workspace.id) {
        throw new Error(`Falha na verificação: service=${check1}, session=${check2}, local=${check4}, expected=${workspace.id}`);
      }
      
      console.log('✅ [WORKSPACE SELECT] Verificação completa passou!');
    } catch (err) {
      console.error('❌ [WORKSPACE SELECT] Erro crítico ao salvar workspace:', err);
      this.errorMessage.set('Erro ao salvar ambiente. Tente novamente.');
      this.loading.set(false);
      return;
    }
    
    console.log('✅ [WORKSPACE SELECT] Workspace verificado, agora notificando backend...');
    
    console.log('📡 [WORKSPACE SELECT] Notificando backend...');
    
    // SEGUNDO: Chamar POST /api/workspaces/{id}/select para notificar o backend
    // Workspace JÁ está salvo, então podemos navegar independente da resposta do backend
    this.workspaceService.selectWorkspace(workspace.id).subscribe({
      next: () => {
        console.log('✅ Backend confirmou seleção do workspace');
        
        // IMPORTANTE: Marcar onboarding como completo localmente
        // Isso garante que o guard não bloqueie a navegação
        console.log('✅ [WORKSPACE SELECT] Marcando onboarding como completo...');
        localStorage.setItem('vendara_onboarding', 'true');
        
        // Marcar que usuário tem workspaces (para não ver onboarding novamente)
        localStorage.setItem('vendara_has_workspaces', 'true');
        console.log('✅ [WORKSPACE SELECT] Usuário marcado como tendo workspaces');
        
        this.loading.set(false);
        
        // AGUARDAR 500ms para backend processar a seleção antes de navegar
        console.log('⏳ [WORKSPACE SELECT] Aguardando backend processar...');
        setTimeout(() => {
          console.log('🚀 [WORKSPACE SELECT] Navegando para /app/central');
          this.router.navigate(['/app/central']);
        }, 500);
      },
      error: (err) => {
        console.error('❌ Erro ao notificar backend:', err);
        // Workspace está salvo localmente - continuar mesmo com erro
        console.warn('⚠️ Backend falhou mas workspace está salvo, continuando...');
        
        // Marcar onboarding como completo mesmo com erro
        localStorage.setItem('vendara_onboarding', 'true');
        localStorage.setItem('vendara_has_workspaces', 'true');
        
        this.loading.set(false);
        
        // Aguardar um pouco antes de navegar
        setTimeout(() => {
          this.router.navigate(['/app/central']);
        }, 500);
      }
    });
  }

  createWorkspace(): void {
    const name = this.newWorkspaceName().trim();
    
    if (!name) {
      this.errorMessage.set('Digite um nome para o ambiente');
      return;
    }

    if (name.length < 2) {
      this.errorMessage.set('Nome deve ter pelo menos 2 caracteres');
      return;
    }

    this.creating.set(true);
    this.errorMessage.set('');
    
    this.workspaceService.create(name).subscribe({
      next: (workspace) => {
        console.log('✅ Workspace criado:', workspace);
        console.log('✅ Workspace ID:', workspace.id);
        console.log('✅ Workspace Name:', workspace.name);
        console.log('✅ Workspace Slug:', workspace.slug);
        
        // Verificar se o workspace foi retornado corretamente
        if (!workspace || !workspace.id) {
          console.error('❌ Workspace criado mas resposta inválida:', workspace);
          console.warn('⚠️ Backend criou workspace mas não retornou dados. Recarregando lista...');
          
          // Workspace foi criado, mas sem dados. Recarregar lista e mostrar
          this.creating.set(false);
          this.newWorkspaceName.set('');
          this.loadWorkspaces();
          
          // Mostrar mensagem informativa
          this.errorMessage.set('✅ Ambiente criado! Selecione-o na lista acima.');
          
          // Limpar mensagem após 5 segundos
          setTimeout(() => {
            if (this.errorMessage() === '✅ Ambiente criado! Selecione-o na lista acima.') {
              this.errorMessage.set('');
            }
          }, 5000);
          
          return;
        }
        
        console.log('📤 [WORKSPACE] Workspace criado, salvando localmente primeiro...');
        
        // PRIMEIRO: Salvar workspace localmente
        try {
          this.workspaceService.select(workspace);
          console.log('✅ [WORKSPACE] Workspace salvo localmente');
        } catch (err) {
          console.error('❌ [WORKSPACE] Erro ao salvar workspace:', err);
          this.errorMessage.set('Erro ao salvar ambiente. Tente novamente.');
          this.creating.set(false);
          return;
        }
        
        // Verificar se foi salvo
        const storedId = this.workspaceService.getCurrentWorkspaceId();
        console.log('🔍 [WORKSPACE] ID armazenado:', storedId);
        
        if (!storedId || storedId !== workspace.id) {
          console.error('❌ [WORKSPACE] Erro ao salvar workspace!');
          console.error('Expected:', workspace.id, 'Got:', storedId);
          this.errorMessage.set('Erro ao configurar ambiente. Tente novamente.');
          this.creating.set(false);
          return;
        }
        
        console.log('✅ [WORKSPACE] Workspace verificado, notificando backend...');
        
        // SEGUNDO: Chamar POST /api/workspaces/{id}/select
        this.workspaceService.selectWorkspace(workspace.id).subscribe({
          next: () => {
            console.log('✅ Backend confirmou seleção do workspace criado');
            
            // IMPORTANTE: Marcar onboarding como completo
            console.log('✅ [WORKSPACE] Marcando onboarding como completo...');
            localStorage.setItem('vendara_onboarding', 'true');
            
            // Marcar que usuário tem workspaces
            localStorage.setItem('vendara_has_workspaces', 'true');
            console.log('✅ [WORKSPACE] Usuário marcado como tendo workspaces');
            
            this.creating.set(false);
            
            // Aguardar 500ms para backend processar a seleção
            setTimeout(() => {
              // Verificação final antes de navegar
              const finalCheck = this.workspaceService.getCurrentWorkspaceId();
              console.log('🔍 [WORKSPACE] Verificação final antes de navegar:', finalCheck);
              
              if (finalCheck !== workspace.id) {
                console.error('❌ [WORKSPACE] AVISO: workspace ID inconsistente antes de navegar!');
                // Forçar salvar novamente
                this.workspaceService.select(workspace);
              }
              
              console.log('🚀 [WORKSPACE] Navegando para /app/central');
              this.router.navigate(['/app/central']);
            }, 500);
          },
          error: (err) => {
            console.error('❌ Erro ao selecionar workspace criado:', err);
            // Workspace já está salvo localmente, então podemos continuar
            console.warn('⚠️ Backend falhou mas workspace está salvo, continuando...');
            
            // Marcar onboarding como completo mesmo com erro
            localStorage.setItem('vendara_onboarding', 'true');
            localStorage.setItem('vendara_has_workspaces', 'true');
            
            this.creating.set(false);
            
            setTimeout(() => {
              this.router.navigate(['/app/central']);
            }, 500);
          }
        });
      },
      error: (err) => {
        console.error('❌ Erro ao criar workspace:', err);
        this.creating.set(false);
        
        // Tratar erro específico de slug duplicado
        if (err.status === 409) {
          this.errorMessage.set('⚠️ Você já possui um ambiente com este nome. Escolha outro nome.');
        } else if (err.status === 400 && err.error?.errors) {
          const errors = err.error.errors;
          let errorMsg = 'Erro ao criar ambiente:';
          
          if (errors.Slug) errorMsg += ` ${errors.Slug[0]}`;
          if (errors.Name) errorMsg += ` ${errors.Name[0]}`;
          
          this.errorMessage.set(errorMsg);
        } else {
          this.errorMessage.set('Erro ao criar ambiente. Tente novamente.');
        }
      }
    });
  }

  formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getRoleLabel(role: string): string {
    const roleLabels: Record<string, string> = {
      'owner': 'Proprietário',
      'admin': 'Administrador',
      'manager': 'Gerente',
      'user': 'Usuário',
      'member': 'Membro',
      'viewer': 'Visualizador',
    };
    return roleLabels[role.toLowerCase()] || role;
  }
}
