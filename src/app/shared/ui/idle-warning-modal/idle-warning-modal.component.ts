import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Modal de aviso de inatividade
 * Aparece 2 minutos antes da sessão expirar
 */
@Component({
  selector: 'app-idle-warning-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
           (click)="onBackdropClick($event)">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
             (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-center gap-3 mb-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Sessão Inativa</h3>
              <p class="text-sm text-gray-500">Aviso de inatividade</p>
            </div>
          </div>

          <!-- Message -->
          <div class="mb-6">
            <p class="text-gray-700 mb-2">
              Sua sessão está inativa há algum tempo.
            </p>
            <p class="text-gray-600 text-sm">
              Por segurança, você será desconectado em <strong class="text-orange-600">{{ countdown() }} segundos</strong> 
              caso não haja nenhuma atividade.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button
              (click)="onContinue()"
              class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Continuar Trabalhando
            </button>
            <button
              (click)="onLogout()"
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors">
              Sair
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class IdleWarningModalComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  
  isVisible = signal(false);
  countdown = signal(120); // 2 minutos em segundos
  
  private countdownInterval: any = null;

  ngOnInit(): void {
    // Escutar evento de aviso de inatividade
    window.addEventListener('idle-warning', this.handleIdleWarning.bind(this));
    
    // Escutar evento de timeout (fechar modal se expirou)
    window.addEventListener('idle-timeout', this.handleIdleTimeout.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('idle-warning', this.handleIdleWarning.bind(this));
    window.removeEventListener('idle-timeout', this.handleIdleTimeout.bind(this));
    this.clearCountdown();
  }

  private handleIdleWarning(event: Event): void {
    const customEvent = event as CustomEvent;
    console.log('[IDLE-MODAL] Aviso de inatividade recebido:', customEvent.detail);
    
    this.isVisible.set(true);
    this.countdown.set(120); // 2 minutos
    this.startCountdown();
  }

  private handleIdleTimeout(event: Event): void {
    console.log('[IDLE-MODAL] Timeout! Fechando modal...');
    this.isVisible.set(false);
    this.clearCountdown();
  }

  private startCountdown(): void {
    this.clearCountdown();
    
    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current > 0) {
        this.countdown.set(current - 1);
      } else {
        this.clearCountdown();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  onContinue(): void {
    console.log('[IDLE-MODAL] Usuário escolheu continuar trabalhando');
    this.isVisible.set(false);
    this.clearCountdown();
    
    // Qualquer interação já resetará o timer automaticamente
    // O IdleService detecta eventos de mouse/teclado
  }

  onLogout(): void {
    console.log('[IDLE-MODAL] Usuário escolheu sair');
    this.isVisible.set(false);
    this.clearCountdown();
    
    // Redirecionar para página de login
    this.router.navigate(['/auth/login']);
  }

  onBackdropClick(event: Event): void {
    // Fechar ao clicar fora (equivalente a continuar)
    this.onContinue();
  }
}
