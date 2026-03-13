import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

/**
 * Componente de toast para exibir notificações
 * Adicionar no app.component.html para exibir globalmente
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toasts(); track toast.id) {
        <div 
          class="toast"
          [class.toast-success]="toast.type === 'success'"
          [class.toast-error]="toast.type === 'error'"
          [class.toast-info]="toast.type === 'info'"
          [class.toast-warning]="toast.type === 'warning'"
          (click)="remove(toast.id)">
          <div class="toast-icon">{{ getIcon(toast.type) }}</div>
          <div class="toast-message">{{ toast.message }}</div>
          <button class="toast-close" (click)="remove(toast.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
      border-left: 4px solid;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-success {
      border-left-color: #10b981;
      background: #f0fdf4;
    }

    .toast-error {
      border-left-color: #ef4444;
      background: #fef2f2;
    }

    .toast-info {
      border-left-color: #3b82f6;
      background: #eff6ff;
    }

    .toast-warning {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }

    .toast-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      font-size: 14px;
      color: #374151;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #9ca3af;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .toast-close:hover {
      color: #374151;
    }

    @media (max-width: 640px) {
      .toast-container {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }
    }
  `]
})
export class ToastContainerComponent {
  private toastService = inject(ToastService);
  
  toasts = this.toastService.toasts;

  remove(id: string): void {
    this.toastService.remove(id);
  }

  getIcon(type: Toast['type']): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      default: return '📝';
    }
  }
}
