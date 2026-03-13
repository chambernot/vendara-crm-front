import { Injectable, inject, signal, computed } from '@angular/core';
import { WorkspaceService } from '../../../core/workspace';
import {
  ScheduledMessage,
  CreateScheduledMessageDto,
  UpdateScheduledMessageDto,
  ScheduledMessageStatus,
} from './scheduled-message.models';

/**
 * Scheduled Message Store - gerencia mensagens agendadas com persistência por workspace
 */
@Injectable({
  providedIn: 'root',
})
export class ScheduledMessageStore {
  private workspaceService = inject(WorkspaceService);

  private scheduledMessagesSignal = signal<ScheduledMessage[]>([]);

  // Computed signals
  scheduledMessages = computed(() => this.scheduledMessagesSignal());

  // Mensagens agendadas ativas (futuras)
  activeScheduled = computed(() => {
    const now = new Date();
    return this.scheduledMessagesSignal()
      .filter(m => m.status === 'scheduled' && new Date(m.plannedAt) > now)
      .sort((a, b) => new Date(a.plannedAt).getTime() - new Date(b.plannedAt).getTime());
  });

  // Mensagens prontas para envio (hora chegou)
  readyToSend = computed(() => {
    const now = new Date();
    return this.scheduledMessagesSignal()
      .filter(m => m.status === 'scheduled' && new Date(m.plannedAt) <= now)
      .sort((a, b) => new Date(a.plannedAt).getTime() - new Date(b.plannedAt).getTime());
  });

  // Mensagens enviadas
  sentScheduled = computed(() => {
    return this.scheduledMessagesSignal()
      .filter(m => m.status === 'sent')
      .sort((a, b) => new Date(b.sentAt || b.updatedAt).getTime() - new Date(a.sentAt || a.updatedAt).getTime());
  });

  // Mensagens canceladas
  cancelledScheduled = computed(() => {
    return this.scheduledMessagesSignal()
      .filter(m => m.status === 'cancelled')
      .sort((a, b) => new Date(b.cancelledAt || b.updatedAt).getTime() - new Date(a.cancelledAt || a.updatedAt).getTime());
  });

  constructor() {
    this.loadScheduledMessages();
    // Verificar mensagens prontas a cada minuto
    this.startPeriodicCheck();
  }

  /**
   * Verifica periodicamente se há mensagens prontas
   */
  private startPeriodicCheck(): void {
    setInterval(() => {
      const ready = this.readyToSend();
      if (ready.length > 0) {
        // Emitir evento customizado para notificação
        window.dispatchEvent(new CustomEvent('scheduled-messages-ready', {
          detail: { count: ready.length, messages: ready }
        }));
      }
    }, 60000); // Check a cada 1 minuto
  }

  /**
   * Carrega mensagens agendadas do localStorage do workspace atual
   */
  private loadScheduledMessages(): void {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) {
      this.scheduledMessagesSignal.set([]);
      return;
    }

    const key = this.getStorageKey(currentWorkspace.id);
    const raw = localStorage.getItem(key);
    
    if (!raw) {
      this.scheduledMessagesSignal.set([]);
      return;
    }

    try {
      const messages = JSON.parse(raw) as ScheduledMessage[];
      this.scheduledMessagesSignal.set(messages);
    } catch {
      this.scheduledMessagesSignal.set([]);
    }
  }

  /**
   * Persiste mensagens agendadas no localStorage
   */
  private saveScheduledMessages(): void {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) return;

    const key = this.getStorageKey(currentWorkspace.id);
    const messages = this.scheduledMessagesSignal();
    localStorage.setItem(key, JSON.stringify(messages));
  }

  /**
   * Gera chave de storage por workspace
   */
  private getStorageKey(workspaceId: string): string {
    return `vendara_scheduled_messages_${workspaceId}`;
  }

  /**
   * Gera ID único para mensagem agendada
   */
  private generateId(): string {
    return `sched_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cria uma nova mensagem agendada
   */
  create(dto: CreateScheduledMessageDto): ScheduledMessage {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) {
      throw new Error('Nenhum workspace ativo');
    }

    const now = new Date().toISOString();
    const scheduledMessage: ScheduledMessage = {
      id: this.generateId(),
      workspaceId: currentWorkspace.id,
      clientId: dto.clientId,
      clientName: dto.clientName,
      templateId: dto.templateId,
      messageContent: dto.messageContent,
      plannedAt: dto.plannedAt,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
      meta: dto.meta,
    };

    const messages = [...this.scheduledMessagesSignal(), scheduledMessage];
    this.scheduledMessagesSignal.set(messages);
    this.saveScheduledMessages();

    return scheduledMessage;
  }

  /**
   * Atualiza uma mensagem agendada
   */
  update(id: string, dto: UpdateScheduledMessageDto): ScheduledMessage | null {
    const messages = this.scheduledMessagesSignal();
    const index = messages.findIndex(m => m.id === id);
    
    if (index === -1) return null;

    const updated: ScheduledMessage = {
      ...messages[index],
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    const newMessages = [...messages];
    newMessages[index] = updated;
    this.scheduledMessagesSignal.set(newMessages);
    this.saveScheduledMessages();

    return updated;
  }

  /**
   * Marca mensagem como enviada
   */
  markAsSent(id: string): ScheduledMessage | null {
    return this.update(id, {
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  }

  /**
   * Cancela uma mensagem agendada
   */
  cancel(id: string): ScheduledMessage | null {
    return this.update(id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });
  }

  /**
   * Reagenda uma mensagem
   */
  reschedule(id: string, newPlannedAt: string): ScheduledMessage | null {
    return this.update(id, {
      plannedAt: newPlannedAt,
      status: 'scheduled',
    });
  }

  /**
   * Busca mensagem por ID
   */
  getById(id: string): ScheduledMessage | null {
    return this.scheduledMessagesSignal().find(m => m.id === id) || null;
  }

  /**
   * Busca mensagens de um cliente
   */
  getByClientId(clientId: string): ScheduledMessage[] {
    return this.scheduledMessagesSignal()
      .filter(m => m.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Remove uma mensagem agendada
   */
  delete(id: string): boolean {
    const messages = this.scheduledMessagesSignal();
    const filtered = messages.filter(m => m.id !== id);
    
    if (filtered.length === messages.length) return false;

    this.scheduledMessagesSignal.set(filtered);
    this.saveScheduledMessages();
    return true;
  }

  /**
   * Limpa todas as mensagens agendadas do workspace atual
   */
  clear(): void {
    this.scheduledMessagesSignal.set([]);
    this.saveScheduledMessages();
  }

  /**
   * Recarrega mensagens do storage
   */
  reload(): void {
    this.loadScheduledMessages();
  }

  /**
   * Retorna estatísticas de mensagens agendadas
   */
  getStats() {
    const messages = this.scheduledMessagesSignal();
    const now = new Date();
    
    return {
      total: messages.length,
      scheduled: messages.filter(m => m.status === 'scheduled').length,
      ready: messages.filter(m => m.status === 'scheduled' && new Date(m.plannedAt) <= now).length,
      sent: messages.filter(m => m.status === 'sent').length,
      cancelled: messages.filter(m => m.status === 'cancelled').length,
      failed: messages.filter(m => m.status === 'failed').length,
    };
  }
}
