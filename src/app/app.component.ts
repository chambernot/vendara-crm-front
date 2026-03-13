import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/ui/toast-container/toast-container.component';
import { IdleWarningModalComponent } from './shared/ui/idle-warning-modal/idle-warning-modal.component';
import { AccountExpirationBannerComponent } from './shared/ui/account-expiration-banner/account-expiration-banner.component';
import { IdleService } from './core/services/idle.service';
import { AuthService } from './core/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, IdleWarningModalComponent, AccountExpirationBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private idleService = inject(IdleService);
  private authService = inject(AuthService);
  
  title = 'Vendara';
  daysRemaining = signal<number | null>(null);

  ngOnInit(): void {
    // Iniciar monitoramento de inatividade se usuário estiver logado
    if (this.authService.isLoggedIn()) {
      console.log('[APP] Usuário autenticado, iniciando monitoramento de inatividade');
      this.idleService.startWatching();
      
      // Verificar status da conta
      this.checkAccountStatus();
    }
  }
  
  private checkAccountStatus(): void {
    this.authService.checkAccountStatus().subscribe({
      next: (user) => {
        console.log('✅ [APP] Status da conta atualizado:', user);
        
        // Verificar se deve exibir banner de aviso
        if (user.daysRemaining !== null && user.daysRemaining !== undefined && user.daysRemaining <= 15) {
          this.daysRemaining.set(user.daysRemaining);
          console.warn(`⚠️ [APP] Exibindo banner: conta expira em ${user.daysRemaining} dias`);
        }
      },
      error: (err) => {
        // Erro ao verificar status - não impede o uso do sistema
        console.error('❌ [APP] Erro ao verificar status da conta:', err);
      }
    });
  }

  ngOnDestroy(): void {
    // Parar monitoramento ao destruir o componente
    this.idleService.stopWatching();
  }
}
