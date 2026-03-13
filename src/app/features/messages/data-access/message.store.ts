import { Injectable, inject, signal, computed, Injector } from '@angular/core';
import { WorkspaceService } from '../../../core/workspace';
import {
  Message,
  CreateMessageDto,
  UpdateMessageDto,
  MessageFilters,
  MessageStatus,
} from './message.models';

/**
 * Message Store - gerencia mensagens com persistência por workspace
 */
@Injectable({
  providedIn: 'root',
})
export class MessageStore {
  private workspaceService = inject(WorkspaceService);
  private injector = inject(Injector);

  private messagesSignal = signal<Message[]>([]);

  // Computed signals
  messages = computed(() => this.messagesSignal());
  
  messagesByClient = computed(() => {
    const messages = this.messagesSignal();
    const byClient = new Map<string, Message[]>();
    
    messages.forEach(msg => {
      const list = byClient.get(msg.clientId) || [];
      list.push(msg);
      byClient.set(msg.clientId, list);
    });
    
    return byClient;
  });

  constructor() {
    this.loadMessages();
  }

  /**
   * Obtém o ClientsStore de forma lazy para evitar dependência circular
   */
  private getClientsStore() {
    // Importação lazy para evitar dependência circular no momento da criação
    const { ClientsStore } = require('../../clients/data-access');
    return this.injector.get(ClientsStore);
  }

  /**
   * Carrega mensagens do localStorage do workspace atual
   */
  private loadMessages(): void {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) {
      this.messagesSignal.set([]);
      return;
    }

    const key = this.getStorageKey(currentWorkspace.id);
    const raw = localStorage.getItem(key);
    
    if (!raw) {
      this.messagesSignal.set([]);
      return;
    }

    try {
      const messages = JSON.parse(raw) as Message[];
      this.messagesSignal.set(messages);
    } catch {
      this.messagesSignal.set([]);
    }
  }

  /**
   * Persiste mensagens no localStorage
   */
  private saveMessages(): void {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) return;

    const key = this.getStorageKey(currentWorkspace.id);
    const messages = this.messagesSignal();
    localStorage.setItem(key, JSON.stringify(messages));
  }

  /**
   * Gera chave de storage por workspace
   */
  private getStorageKey(workspaceId: string): string {
    return `vendara_messages_${workspaceId}`;
  }

  /**
   * Gera ID único para mensagem
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cria uma nova mensagem
   */
  create(dto: CreateMessageDto): Message {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) {
      throw new Error('Nenhum workspace ativo');
    }

    const now = new Date().toISOString();
    const message: Message = {
      id: this.generateId(),
      workspaceId: currentWorkspace.id,
      clientId: dto.clientId,
      channel: dto.channel,
      provider: dto.provider,
      direction: dto.direction,
      templateId: dto.templateId,
      textPreview: dto.textPreview || dto.text.substring(0, 100),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      meta: dto.meta,
    };

    const messages = [...this.messagesSignal(), message];
    this.messagesSignal.set(messages);
    this.saveMessages();

    // Update client timestamps based on message direction
    const clientsStore = this.getClientsStore();
    if (message.direction === 'outbound') {
      clientsStore.updateLastOutbound(message.clientId, message.createdAt);
    } else if (message.direction === 'inbound') {
      clientsStore.updateLastInbound(message.clientId, message.createdAt);
    }

    return message;
  }

  /**
   * Atualiza uma mensagem
   */
  update(id: string, dto: UpdateMessageDto): Message | null {
    const messages = this.messagesSignal();
    const index = messages.findIndex(m => m.id === id);
    
    if (index === -1) return null;

    const original = messages[index];
    const updated: Message = {
      ...original,
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    const newMessages = [...messages];
    newMessages[index] = updated;
    this.messagesSignal.set(newMessages);
    this.saveMessages();

    // Check if status changed to 'sent' or 'failed' to create activities
    if (dto.status && dto.status !== original.status) {
      this.handleStatusChange(updated, original.status, dto.status);
    }

    return updated;
  }

  /**
   * Manipula mudanças de status de mensagem
   */
  private handleStatusChange(message: Message, oldStatus: MessageStatus, newStatus: MessageStatus): void {
    // Only create activities for outbound messages
    if (message.direction !== 'outbound') return;

    const clientsStore = this.getClientsStore();

    if (newStatus === 'sent' || newStatus === 'delivered') {
      // Update lastContactAt when message is sent/delivered
      clientsStore.updateLastOutbound(message.clientId);

      // Create activity only on first successful send
      if (oldStatus === 'queued' && newStatus === 'sent') {
        clientsStore.createActivity(
          message.clientId,
          'message_sent',
          `Mensagem enviada: "${this.truncateText(message.textPreview, 50)}"`,
          { 
            messageId: message.id,
            provider: message.provider,
            templateId: message.templateId
          }
        );
      }
    } else if (newStatus === 'failed') {
      // Create activity for failed message
      clientsStore.createActivity(
        message.clientId,
        'message_failed',
        `Falha ao enviar mensagem: "${this.truncateText(message.textPreview, 50)}"`,
        { 
          messageId: message.id,
          provider: message.provider,
          templateId: message.templateId
        }
      );
      
      // Recalculate score when a message fails (triggers failure penalty)
      clientsStore.updateLastOutbound(message.clientId);
    }
  }

  /**
   * Trunca texto para exibição
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Atualiza status de uma mensagem
   */
  updateStatus(id: string, status: MessageStatus): Message | null {
    return this.update(id, { status });
  }

  /**
   * Atualiza status de uma mensagem pelo providerMessageId
   */
  updateStatusByProviderId(providerMessageId: string, status: MessageStatus): Message | null {
    const messages = this.messagesSignal();
    const message = messages.find(m => m.providerMessageId === providerMessageId);
    
    if (!message) return null;
    
    return this.update(message.id, { status });
  }

  /**
   * Reenvia uma mensagem (cria nova mensagem baseada na original)
   */
  retry(messageId: string): Message | null {
    const original = this.getById(messageId);
    if (!original) return null;

    const dto: CreateMessageDto = {
      clientId: original.clientId,
      channel: original.channel,
      provider: original.provider,
      direction: original.direction,
      text: original.textPreview, // Usar textPreview como text para retry
      templateId: original.templateId,
      textPreview: original.textPreview,
      meta: {
        ...original.meta,
        retryOf: original.id,
        retryCount: ((original.meta?.['retryCount'] as number) || 0) + 1,
      },
    };

    return this.create(dto);
  }

  /**
   * Busca mensagem por ID
   */
  getById(id: string): Message | null {
    return this.messagesSignal().find(m => m.id === id) || null;
  }

  /**
   * Busca mensagens de um cliente
   */
  getByClientId(clientId: string, limit?: number): Message[] {
    const messages = this.messagesSignal()
      .filter(m => m.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return limit ? messages.slice(0, limit) : messages;
  }

  /**
   * Filtra mensagens
   */
  filter(filters: MessageFilters): Message[] {
    let filtered = this.messagesSignal();

    if (filters.clientId) {
      filtered = filtered.filter(m => m.clientId === filters.clientId);
    }

    if (filters.status) {
      filtered = filtered.filter(m => m.status === filters.status);
    }

    if (filters.channel) {
      filtered = filtered.filter(m => m.channel === filters.channel);
    }

    if (filters.direction) {
      filtered = filtered.filter(m => m.direction === filters.direction);
    }

    if (filters.provider) {
      filtered = filtered.filter(m => m.provider === filters.provider);
    }

    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      filtered = filtered.filter(m => new Date(m.createdAt).getTime() >= start);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      filtered = filtered.filter(m => new Date(m.createdAt).getTime() <= end);
    }

    // Ordena por data decrescente
    return filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Remove uma mensagem
   */
  delete(id: string): boolean {
    const messages = this.messagesSignal();
    const filtered = messages.filter(m => m.id !== id);
    
    if (filtered.length === messages.length) return false;

    this.messagesSignal.set(filtered);
    this.saveMessages();
    return true;
  }

  /**
   * Limpa todas as mensagens do workspace atual
   */
  clear(): void {
    this.messagesSignal.set([]);
    this.saveMessages();
  }

  /**
   * Recarrega mensagens do storage
   */
  reload(): void {
    this.loadMessages();
  }

  /**
   * Retorna estatísticas de mensagens
   */
  getStats() {
    const messages = this.messagesSignal();
    
    return {
      total: messages.length,
      queued: messages.filter(m => m.status === 'queued').length,
      sent: messages.filter(m => m.status === 'sent').length,
      delivered: messages.filter(m => m.status === 'delivered').length,
      read: messages.filter(m => m.status === 'read').length,
      failed: messages.filter(m => m.status === 'failed').length,
      outbound: messages.filter(m => m.direction === 'outbound').length,
      inbound: messages.filter(m => m.direction === 'inbound').length,
    };
  }
}
