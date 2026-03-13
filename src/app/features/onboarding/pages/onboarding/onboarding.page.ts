import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { WorkspaceService } from '../../../../core/workspace';
import { OnboardingData } from '../../../../core/auth/models/user.model';

type BusinessType = 'pf' | 'mei' | 'loja';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding.page.html',
})
export class OnboardingPage {
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);
  private router = inject(Router);

  currentStep = signal(1);
  businessType = signal<BusinessType | null>(null);
  selectedProducts = signal<string[]>([]);
  objective = signal<string | null>(null);
  
  loading = signal(false);
  errorMessage = signal('');

  readonly businessTypes = [
    { value: 'pf' as BusinessType, label: 'Pessoa Física', icon: '👤' },
    { value: 'mei' as BusinessType, label: 'MEI', icon: '📋' },
    { value: 'loja' as BusinessType, label: 'Loja', icon: '🏪' },
  ];

  readonly products = [
    { value: 'OURO', label: 'Ouro' },
    { value: 'PRATA', label: 'Prata' },
    { value: 'FOLHEADO', label: 'Folheado / Semijoia' },
    { value: 'ACO', label: 'Aço / Acessórios' },
  ];

  readonly objectives = [
    { value: 'vender_mais', label: 'Vender mais', icon: '📈' },
    { value: 'organizar_clientes', label: 'Organizar clientes', icon: '👥' },
    { value: 'controlar_consignacao', label: 'Controlar consignação', icon: '📦' },
  ];

  selectBusinessType(type: BusinessType): void {
    this.businessType.set(type);
  }

  toggleProduct(product: string): void {
    const current = this.selectedProducts();
    if (current.includes(product)) {
      this.selectedProducts.set(current.filter((p) => p !== product));
    } else {
      this.selectedProducts.set([...current, product]);
    }
  }

  selectObjective(obj: string): void {
    this.objective.set(obj);
  }

  canProceed(): boolean {
    const step = this.currentStep();
    if (step === 1) return !!this.businessType();
    if (step === 2) return this.selectedProducts().length > 0;
    if (step === 3) return !!this.objective();
    return false;
  }

  nextStep(): void {
    if (this.canProceed() && this.currentStep() < 3) {
      this.currentStep.update((v) => v + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((v) => v - 1);
    }
  }

  complete(): void {
    if (!this.canProceed()) return;
    if (this.loading()) return;

    const workspaceName = 'Meu Ambiente';

    // Preparar payload no formato esperado pelo backend
    const payload = {
      businessType: this.businessType()!,  // Backend espera "businessType"
      goal: this.objective()!,             // Backend espera "goal"
      sellTypes: this.selectedProducts(),  // Backend espera "sellTypes"
      workspaceName: workspaceName         // Backend espera "workspaceName"
    };

    this.loading.set(true);
    this.errorMessage.set('');

    // Completar onboarding via API (que já cria o workspace automaticamente)
    this.authService.completeOnboarding(payload).subscribe({
      next: () => {
        console.log('✅ Onboarding completado com sucesso');
        
        // IMPORTANTE: Marcar onboarding como completo localmente
        console.log('✅ [ONBOARDING] Marcando onboarding como completo...');
        localStorage.setItem('vendara_onboarding', 'true');
        
        // Marcar que usuário tem workspaces (onboarding cria um automaticamente)
        localStorage.setItem('vendara_has_workspaces', 'true');
        console.log('✅ [ONBOARDING] Usuário marcado como tendo workspaces');
        
        this.loading.set(false);
        
        // Navegar para workspace select onde o usuário verá o workspace criado
        this.router.navigate(['/workspace/select']);
      },
      error: (err) => {
        console.error('❌ Erro ao completar onboarding:', err);
        this.loading.set(false);
        
        // Se 401, token inválido - redirecionar para login
        if (err.status === 401) {
          console.error('🔐 Token inválido ou expirado. Redirecionando para login...');
          this.errorMessage.set('Sua sessão expirou. Redirecionando para login...');
          
          // Limpar dados locais
          localStorage.clear();
          
          // Redirecionar após 2 segundos
          setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, 2000);
          return;
        }
        
        // Tratar erros específicos
        if (err.status === 400 && err.error?.errors) {
          const errors = err.error.errors;
          let errorMsg = 'Por favor, preencha todos os campos corretamente:';
          
          if (errors.Goal) errorMsg += `\n• ${errors.Goal[0]}`;
          if (errors.SellTypes) errorMsg += `\n• ${errors.SellTypes[0]}`;
          if (errors.WorkspaceName) errorMsg += `\n• ${errors.WorkspaceName[0]}`;
          
          this.errorMessage.set(errorMsg);
        } else {
          this.errorMessage.set('Erro ao salvar dados do onboarding. Tente novamente.');
        }
      }
    });
  }
}
