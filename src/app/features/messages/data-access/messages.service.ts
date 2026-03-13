import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { MessagesApiService, Message } from './messages-api.service';

/**
 * Representa uma conversa agrupada por cliente
 */
export interface Conversation {
  clientId: string;
  clientName: string;
  clientWhatsapp: string;
  lastMessage: string;
  lastMessageAt: string;
  lastDirection: 'inbound' | 'outbound';
  unreadCount: number;
  messageCount: number;
}

/**
 * Serviço de alto nível para mensagens.
 * Usa a API real (MongoDB via backend .NET) como fonte de dados.
 * Implementa inserção local otimista + refetch para consistência.
 */
@Injectable({
  providedIn: 'root'
})
export class MessagesService {
  private messagesApi = inject(MessagesApiService);

  // Signals
  conversations = signal<Conversation[]>([]);
  loadingConversations = signal(false);
  conversationsError = signal<string | null>(null);

  threadMessages = signal<Message[]>([]);
  loadingThread = signal(false);
  threadError = signal<string | null>(null);
  loadingMessages = signal(false);

  // Rastreamento de conversas visualizadas (clientId -> timestamp da última visualização)
  private readonly VIEWED_CONVERSATIONS_KEY = 'messages_viewed_conversations';
  private viewedConversations: Map<string, number> = new Map();

  constructor() {
    // Carregar conversas visualizadas do localStorage
    this.loadViewedConversations();
  }

  /**
   * Carrega do localStorage o mapa de conversas visualizadas
   */
  private loadViewedConversations(): void {
    try {
      const stored = localStorage.getItem(this.VIEWED_CONVERSATIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.viewedConversations = new Map(Object.entries(parsed).map(([k, v]) => [k, v as number]));
      }
    } catch (err) {
      console.warn('[MessagesService] Erro ao carregar conversas visualizadas:', err);
    }
  }

  /**
   * Salva no localStorage o mapa de conversas visualizadas
   */
  private saveViewedConversations(): void {
    try {
      const obj = Object.fromEntries(this.viewedConversations.entries());
      localStorage.setItem(this.VIEWED_CONVERSATIONS_KEY, JSON.stringify(obj));
    } catch (err) {
      console.warn('[MessagesService] Erro ao salvar conversas visualizadas:', err);
    }
  }

  /**
   * Marca uma conversa como visualizada agora
   */
  markConversationAsViewed(clientId: string): void {
    this.viewedConversations.set(clientId, Date.now());
    this.saveViewedConversations();
    // Atualizar o unreadCount da conversa para 0
    const conversations = this.conversations();
    const updated = conversations.map(conv =>
      conv.clientId === clientId ? { ...conv, unreadCount: 0 } : conv
    );
    this.conversations.set(updated);
  }

  /**
   * Carrega lista de conversas (agrupadas por cliente) via API
   */
  loadConversations(): void {
    this.loadConversationsWithClients();
  }

  /**
   * Carrega conversas já enriquecidas com dados de clientes
   * Resolve race condition: agrupa mensagens e mapeia nomes no mesmo subscribe
   */
  loadConversationsWithClients(clients?: Array<{ id: string; name: string; whatsapp?: string }>): void {
    this.loadingConversations.set(true);
    this.conversationsError.set(null);

    const clientMap = clients ? new Map(clients.map(c => [c.id, c])) : null;

    this.messagesApi.listMessages().subscribe({
      next: (messages) => {
        const convMap = new Map<string, Conversation>();
        // Map para contar mensagens inbound não lidas por cliente
        const inboundMessagesMap = new Map<string, Message[]>();

        for (const msg of messages) {
          const existing = convMap.get(msg.clientId);
          const client = clientMap?.get(msg.clientId);
          
          // Adicionar à lista de mensagens inbound
          if (msg.direction === 'inbound') {
            if (!inboundMessagesMap.has(msg.clientId)) {
              inboundMessagesMap.set(msg.clientId, []);
            }
            inboundMessagesMap.get(msg.clientId)!.push(msg);
          }

          if (!existing) {
            convMap.set(msg.clientId, {
              clientId: msg.clientId,
              clientName: client?.name || '',
              clientWhatsapp: client?.whatsapp || '',
              lastMessage: msg.textPreview || '(sem texto)',
              lastMessageAt: msg.createdAt,
              lastDirection: msg.direction,
              unreadCount: 0, // Will be calculated below
              messageCount: 1,
            });
          } else {
            existing.messageCount++;
            if (new Date(msg.createdAt) > new Date(existing.lastMessageAt)) {
              existing.lastMessage = msg.textPreview || '(sem texto)';
              existing.lastMessageAt = msg.createdAt;
              existing.lastDirection = msg.direction;
            }
          }
        }

        // Calcular unreadCount para cada conversa
        for (const [clientId, conversation] of convMap.entries()) {
          const lastViewed = this.viewedConversations.get(clientId) || 0;
          const inboundMessages = inboundMessagesMap.get(clientId) || [];
          
          // Contar mensagens inbound mais recentes que a última visualização
          const unreadCount = inboundMessages.filter(msg => 
            new Date(msg.createdAt).getTime() > lastViewed
          ).length;
          
          conversation.unreadCount = unreadCount;
        }

        const sorted = Array.from(convMap.values()).sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );

        this.conversations.set(sorted);
        this.loadingConversations.set(false);
      },
      error: (err) => {
        console.error('❌ [MessagesService] Erro ao carregar conversas:', err);
        this.conversationsError.set(err?.message || 'Erro ao carregar conversas');
        this.loadingConversations.set(false);
      }
    });
  }

  /**
   * Enriquece conversas com dados de clientes
   */
  enrichConversationsWithClients(clients: Array<{ id: string; name: string; whatsapp?: string }>): void {
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const enriched = this.conversations().map(conv => {
      const client = clientMap.get(conv.clientId);
      return {
        ...conv,
        clientName: client?.name || conv.clientId,
        clientWhatsapp: client?.whatsapp || '',
      };
    });
    this.conversations.set(enriched);
  }

  /**
   * Carrega thread de mensagens de um cliente via API
   */
  loadThread(clientId: string): void {
    this.loadingThread.set(true);
    this.threadError.set(null);

    this.messagesApi.getMessagesByClient(clientId).subscribe({
      next: (messages) => {
        const sorted = [...messages].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        this.threadMessages.set(sorted);
        this.loadingThread.set(false);
        
        // Marcar conversa como visualizada
        this.markConversationAsViewed(clientId);
      },
      error: (err) => {
        console.error('❌ [MessagesService] Erro ao carregar thread:', err);
        this.threadError.set(err?.message || 'Erro ao carregar mensagens');
        this.loadingThread.set(false);
      }
    });
  }

  /**
   * Envia uma mensagem manual (outbound) via API.
   * Insere localmente no thread para feedback imediato e depois faz refetch.
   * Se followUpId for informado, o backend marca o follow-up como DONE.
   * Se templateId for informado, grava junto ao payload para rastreabilidade.
   */
  sendMessage(clientId: string, text: string, followUpId?: string, templateId?: string): Observable<Message> {
    return this.messagesApi.sendMessage({
      clientId,
      provider: 'simulator',
      text,
      ...(followUpId ? { followUpId } : {}),
      ...(templateId ? { templateId } : {}),
    }).pipe(
      tap((msg) => {
        // Inserção local otimista no thread
        const current = this.threadMessages();
        const alreadyExists = current.some(m => m.id === msg.id);
        if (!alreadyExists) {
          this.threadMessages.set([...current, msg]);
        }
        // Refetch para consistência com backend
        setTimeout(() => this.loadThread(clientId), 500);
      })
    );
  }

  /**
   * Simula resposta (inbound) via API.
   * Insere localmente no thread para feedback imediato e depois faz refetch.
   */
  simulateInbound(clientId: string, text: string): Observable<Message> {
    return this.messagesApi.createMessage({
      clientId,
      channel: 'whatsapp',
      provider: 'simulator',
      direction: 'inbound',
      text,
    }).pipe(
      tap((msg) => {
        // Inserção local otimista
        const current = this.threadMessages();
        const alreadyExists = current.some(m => m.id === msg.id);
        if (!alreadyExists) {
          this.threadMessages.set([...current, msg]);
        }
        // Refetch para consistência
        setTimeout(() => this.loadThread(clientId), 500);
      })
    );
  }

  /**
   * Recarrega thread após envio
   */
  refreshThread(clientId: string): void {
    this.loadThread(clientId);
  }

  /**
   * Carrega últimas N mensagens de um cliente (para uso no detalhe de cliente)
   */
  loadClientMessages(clientId: string, limit = 10): void {
    this.loadingMessages.set(true);
    this.messagesApi.getMessagesByClient(clientId).subscribe({
      next: (messages) => {
        const sorted = [...messages].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.threadMessages.set(sorted.slice(0, limit));
        this.loadingMessages.set(false);
      },
      error: (err) => {
        console.error('❌ [MessagesService] Erro ao carregar mensagens do cliente:', err);
        this.loadingMessages.set(false);
      }
    });
  }

  /**
   * Limpa state de thread (ao navegar fora)
   */
  clearThread(): void {
    this.threadMessages.set([]);
    this.threadError.set(null);
  }
}
