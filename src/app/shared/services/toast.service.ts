import { Injectable, signal } from '@angular/core';

/**
 * Tipo de toast
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Interface para toast
 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms
  createdAt: number;
}

/**
 * Serviço para exibir notificações toast
 * Pode ser conectado a um componente de UI posteriormente
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSignal = signal<Toast[]>([]);
  
  /**
   * Lista de toasts ativos
   */
  toasts = this.toastsSignal.asReadonly();

  /**
   * Duração padrão dos toasts (ms)
   */
  private defaultDuration = 5000;

  /**
   * Exibe toast de sucesso
   */
  showSuccess(message: string, duration?: number): void {
    this.show('success', message, duration);
  }

  /**
   * Exibe toast de erro
   */
  showError(message: string, duration?: number): void {
    this.show('error', message, duration);
  }

  /**
   * Exibe toast de informação
   */
  showInfo(message: string, duration?: number): void {
    this.show('info', message, duration);
  }

  /**
   * Exibe toast de aviso
   */
  showWarning(message: string, duration?: number): void {
    this.show('warning', message, duration);
  }

  /**
   * Exibe toast genérico
   */
  private show(type: ToastType, message: string, duration?: number): void {
    const toast: Toast = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      message,
      duration: duration || this.defaultDuration,
      createdAt: Date.now()
    };

    // Adiciona à lista
    this.toastsSignal.update(toasts => [...toasts, toast]);

    // Remove automaticamente após duração
    setTimeout(() => {
      this.remove(toast.id);
    }, toast.duration);

    // Log no console para debug
    const icon = this.getIcon(type);
    console.log(`${icon} [Toast ${type.toUpperCase()}]:`, message);
  }

  /**
   * Remove toast por ID
   */
  remove(id: string): void {
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }

  /**
   * Remove todos os toasts
   */
  clearAll(): void {
    this.toastsSignal.set([]);
  }

  /**
   * Retorna ícone para o tipo de toast
   */
  private getIcon(type: ToastType): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      default: return '📝';
    }
  }
}
