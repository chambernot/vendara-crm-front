import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-account-expiration-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="daysRemaining !== null && daysRemaining <= 15" 
         class="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 shadow-lg">
      <div class="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center space-x-3">
          <svg class="w-6 h-6 flex-shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          
          <div>
            <p class="font-semibold">
              <ng-container *ngIf="daysRemaining === 0">
                ⚠️ Sua conta expira hoje!
              </ng-container>
              <ng-container *ngIf="daysRemaining === 1">
                ⚠️ Sua conta expira amanhã!
              </ng-container>
              <ng-container *ngIf="daysRemaining > 1">
                ⚠️ Sua conta expira em {{ daysRemaining }} dias
              </ng-container>
            </p>
            <p class="text-sm opacity-90">
              Renove agora para continuar usando todos os recursos sem interrupções
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <button 
            (click)="onRenew()"
            class="bg-white text-orange-600 hover:bg-orange-50 font-semibold px-6 py-2 rounded-lg transition-colors duration-200 shadow-md">
            Renovar Agora
          </button>
          
          <button 
            *ngIf="dismissible"
            (click)="onDismiss()"
            class="text-white hover:text-orange-100 p-2 rounded-lg transition-colors duration-200"
            aria-label="Fechar aviso">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AccountExpirationBannerComponent {
  @Input() daysRemaining: number | null = null;
  @Input() dismissible: boolean = true;
  
  private router = inject(Router);

  onRenew(): void {
    // Redirecionar para página de renovação ou abrir contato
    const supportEmail = 'suporte@vendara.com.br';
    const subject = encodeURIComponent('Renovação de Conta - Vendara CRM');
    const body = encodeURIComponent(
      'Olá,\n\nGostaria de renovar minha conta no Vendara CRM para continuar utilizando o sistema.\n\nAguardo retorno.\n\nObrigado!'
    );
    window.open(`mailto:${supportEmail}?subject=${subject}&body=${body}`, '_blank');
  }

  onDismiss(): void {
    // Ocultar banner temporariamente (pode usar localStorage para persistir)
    this.daysRemaining = null;
  }
}
