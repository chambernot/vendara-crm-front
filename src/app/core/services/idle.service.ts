import { Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, merge, Subject, timer } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AuthService } from '../auth';

/**
 * Serviço de detecção de inatividade do usuário
 * Faz logout automático após 15 minutos sem atividade
 */
@Injectable({
  providedIn: 'root'
})
export class IdleService {
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  
  private destroy$ = new Subject<void>();
  private idleTimer: any = null;
  
  // Tempo de inatividade em milissegundos (15 minutos)
  private readonly IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
  
  // Tempo de aviso antes de expirar (2 minutos antes)
  private readonly WARNING_TIME_MS = 2 * 60 * 1000; // 2 minutos
  
  private isWarningShown = false;
  private warningTimer: any = null;

  /**
   * Inicia o monitoramento de inatividade
   */
  startWatching(): void {
    if (!this.authService.isLoggedIn()) {
      console.log('[IDLE] Usuário não autenticado, não iniciando monitoramento');
      return;
    }

    console.log('[IDLE] Iniciando monitoramento de inatividade (timeout: 15 min)');
    
    // Lista de eventos que indicam atividade do usuário
    this.ngZone.runOutsideAngular(() => {
      const activityEvents$ = merge(
        fromEvent(document, 'mousedown'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'touchstart'),
        fromEvent(document, 'scroll'),
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'click')
      );

      // Debounce para evitar reset excessivo do timer
      activityEvents$.pipe(
        debounceTime(1000), // Agrupa eventos em janelas de 1 segundo
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.resetIdleTimer();
      });
    });

    // Iniciar o timer pela primeira vez
    this.resetIdleTimer();
  }

  /**
   * Para o monitoramento de inatividade
   */
  stopWatching(): void {
    console.log('[IDLE] Parando monitoramento de inatividade');
    this.destroy$.next();
    this.clearTimers();
  }

  /**
   * Reseta o timer de inatividade
   */
  private resetIdleTimer(): void {
    this.clearTimers();
    this.isWarningShown = false;

    // Timer de aviso (13 minutos - 2 minutos antes de expirar)
    this.warningTimer = setTimeout(() => {
      this.showWarning();
    }, this.IDLE_TIMEOUT_MS - this.WARNING_TIME_MS);

    // Timer final de logout
    this.idleTimer = setTimeout(() => {
      this.onIdleTimeout();
    }, this.IDLE_TIMEOUT_MS);
  }

  /**
   * Limpa todos os timers
   */
  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  /**
   * Mostra aviso de inatividade iminente
   */
  private showWarning(): void {
    if (this.isWarningShown) return;
    
    this.ngZone.run(() => {
      this.isWarningShown = true;
      console.warn('[IDLE] ⚠️ Sessão expirará em 2 minutos por inatividade');
      
      // Emitir evento customizado para modal de aviso (opcional)
      const event = new CustomEvent('idle-warning', { 
        detail: { 
          remainingTime: this.WARNING_TIME_MS,
          message: 'Sua sessão expirará em 2 minutos por inatividade. Mova o mouse ou pressione uma tecla para continuar.'
        } 
      });
      window.dispatchEvent(event);
    });
  }

  /**
   * Executado quando o tempo de inatividade expira
   */
  private onIdleTimeout(): void {
    this.ngZone.run(() => {
      console.warn('[IDLE] ⏱️ Tempo de inatividade expirado (15 min). Fazendo logout...');
      
      // Emitir evento de timeout
      const event = new CustomEvent('idle-timeout', {
        detail: { message: 'Sessão expirada por inatividade. Faça login novamente.' }
      });
      window.dispatchEvent(event);
      
      // Fazer logout
      this.authService.logout();
      
      // Redirecionar para login com mensagem
      this.router.navigate(['/auth/login'], {
        queryParams: { expired: 'true' }
      });
    });
  }

  /**
   * Destrói o serviço
   */
  ngOnDestroy(): void {
    this.stopWatching();
  }
}
