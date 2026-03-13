import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';

@Component({
  selector: 'app-account-expired',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-expired.page.html',
})
export class AccountExpiredPage {
  private router = inject(Router);
  private authService = inject(AuthService);

  currentUser = this.authService.getCurrentUser();
  supportEmail = 'suporte@vendara.com.br';
  supportPhone = '(11) 99999-9999';

  onLogout(): void {
    this.authService.logout();
  }

  onContactSupport(): void {
    // Abrir email para suporte
    const subject = encodeURIComponent('Renovação de Conta - Vendara CRM');
    const body = encodeURIComponent(
      `Olá,\n\nGostaria de renovar minha conta no Vendara CRM.\n\nEmail: ${this.currentUser?.email || ''}\n\nAguardo retorno.\n\nObrigado!`
    );
    window.open(`mailto:${this.supportEmail}?subject=${subject}&body=${body}`, '_blank');
  }

  onContactWhatsApp(): void {
    // Abrir WhatsApp para suporte
    const message = encodeURIComponent(
      `Olá! Gostaria de renovar minha conta no Vendara CRM.\n\nEmail: ${this.currentUser?.email || ''}`
    );
    const phoneNumber = this.supportPhone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phoneNumber}?text=${message}`, '_blank');
  }
}
