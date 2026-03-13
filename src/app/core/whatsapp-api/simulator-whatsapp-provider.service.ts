import { Injectable, inject } from '@angular/core';
import { MessageStore } from '../../features/messages/data-access/message.store';

/**
 * Simulator WhatsApp Provider
 * Simula o comportamento de uma API real do WhatsApp com transições de status realistas
 * 
 * Ciclo de vida de uma mensagem simulada:
 * 1. queued → sent (300ms)
 * 2. sent → delivered (3 segundos)
 * 3. delivered → read (8 segundos total desde o início)
 */
@Injectable({
  providedIn: 'root'
})
export class SimulatorWhatsAppProvider {
  private messageStore = inject(MessageStore);
  
  // Timeouts ativos para permitir cancelamento se necessário
  private activeTimeouts = new Map<string, NodeJS.Timeout[]>();

  /**
   * Simula o envio de uma mensagem com atualização progressiva de status
   * @param messageId - ID da mensagem no MessageStore
   * @returns Promise que resolve quando a mensagem chega ao status 'read'
   */
  async simulateSend(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeouts: NodeJS.Timeout[] = [];
      
      // Step 1: queued → sent (300ms)
      const sentTimeout = setTimeout(() => {
        const sentAt = new Date().toISOString();
        const providerMessageId = this.generateProviderMessageId();
        
        this.messageStore.update(messageId, {
          status: 'sent',
          sentAt,
          providerMessageId
        });
        
        // Step 2: sent → delivered (após 3s do início, ou seja, mais 2.7s)
        const deliveredTimeout = setTimeout(() => {
          const deliveredAt = new Date().toISOString();
          
          this.messageStore.update(messageId, {
            status: 'delivered',
            deliveredAt
          });
          
          // Step 3: delivered → read (após 8s do início, ou seja, mais 5s)
          const readTimeout = setTimeout(() => {
            const readAt = new Date().toISOString();
            
            this.messageStore.update(messageId, {
              status: 'read',
              readAt
            });
            
            // Limpa os timeouts registrados
            this.activeTimeouts.delete(messageId);
            resolve();
          }, 5000); // 5s após delivered = 8s total
          
          timeouts.push(readTimeout);
        }, 2700); // 2.7s após sent = 3s total
        
        timeouts.push(deliveredTimeout);
      }, 300); // 300ms para sent
      
      timeouts.push(sentTimeout);
      
      // Registra os timeouts para possível cancelamento
      this.activeTimeouts.set(messageId, timeouts);
    });
  }

  /**
   * Simula uma falha no envio (útil para testes)
   * @param messageId - ID da mensagem no MessageStore
   * @param delayMs - Delay antes de marcar como failed
   */
  async simulateFailure(messageId: string, delayMs: number = 1000): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.messageStore.update(messageId, {
          status: 'failed',
          meta: {
            errorCode: 'SIMULATOR_FAILED',
            errorMessage: 'Falha simulada para testes'
          }
        });
        resolve();
      }, delayMs);
    });
  }

  /**
   * Cancela todas as atualizações pendentes de uma mensagem
   * @param messageId - ID da mensagem
   */
  cancelSimulation(messageId: string): void {
    const timeouts = this.activeTimeouts.get(messageId);
    if (timeouts) {
      timeouts.forEach(timeout => clearTimeout(timeout));
      this.activeTimeouts.delete(messageId);
    }
  }

  /**
   * Gera um ID de mensagem fake do provider (simula ID do Meta/WhatsApp)
   */
  private generateProviderMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `wamid.simulator_${timestamp}_${random}`;
  }

  /**
   * Limpa todos os timeouts ativos (útil para cleanup)
   */
  cleanup(): void {
    this.activeTimeouts.forEach((timeouts) => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    });
    this.activeTimeouts.clear();
  }
}
