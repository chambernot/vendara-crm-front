import { Injectable, inject } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../../../core/api';
import { WorkspaceService } from '../../../core/workspace';

/**
 * Interface para resposta da API (wrapper padrão .NET Core)
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

/**
 * Status da mensagem (alinhado com backend)
 */
export type MessageStatus = 'intent' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Canal de mensagem
 */
export type MessageChannel = 'whatsapp';

/**
 * Provider de mensagem
 */
export type MessageProvider = 'simulator' | 'meta';

/**
 * Direção da mensagem
 */
export type MessageDirection = 'outbound' | 'inbound';

/**
 * Interface para mensagem (alinhado com backend)
 */
export interface Message {
  id: string;
  workspaceId: string;
  clientId: string;
  channel: MessageChannel;
  provider: MessageProvider;
  direction: MessageDirection;
  templateId?: string;
  textPreview: string;
  status: MessageStatus;
  providerMessageId?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  failureReason?: string;
  meta?: Record<string, any>;
}

/**
 * Interface para criar mensagem
 */
export interface CreateMessageDto {
  clientId: string;
  channel: MessageChannel;
  provider: MessageProvider;
  direction: MessageDirection;
  text: string; // Texto da mensagem (obrigatório no backend - minLength: 1, maxLength: 4096)
  templateId?: string;
  textPreview?: string; // Preview opcional
  meta?: Record<string, any>;
}

/**
 * Interface para atualizar mensagem
 */
export interface UpdateMessageDto {
  status?: MessageStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  failureReason?: string;
  providerMessageId?: string;
  meta?: Record<string, any>;
}

/**
 * Status de mensagem agendada
 */
export type ScheduledMessageStatus = 'scheduled' | 'sent' | 'cancelled' | 'failed';

/**
 * Interface para mensagem agendada
 */
export interface ScheduledMessage {
  id: string;
  clientId: string;
  text: string;
  plannedAt: string; // ISO string
  status: ScheduledMessageStatus;
  sentAt?: string;
  cancelledAt?: string;
  messageId?: string; // ID da mensagem criada quando enviada
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Interface para criar mensagem agendada
 */
export interface CreateScheduledMessageDto {
  clientId: string;
  text: string;
  plannedAt: string; // ISO string
  metadata?: Record<string, any>;
}

/**
 * Serviço API para gerenciamento de mensagens
 */
@Injectable({
  providedIn: 'root'
})
export class MessagesApiService {
  private apiClient = inject(ApiClient);
  private workspaceService = inject(WorkspaceService);
  private readonly messagesEndpoint = '/Messages';  // Backend .NET usa PascalCase na URL
  private readonly scheduledEndpoint = '/ScheduledMessages';  // Backend .NET usa PascalCase na URL

  /**
   * Mapeia strings para enums numéricos da API .NET
   * Backend real: MessageChannelDto { WhatsAppApi=0, WhatsAppWeb=1, Simulator=2, WhatsApp=3 }
   */
  private mapStringToChannel(value: MessageChannel): number {
    const map: Record<MessageChannel, number> = {
      'whatsapp': 3  // WhatsApp = 3
    };
    return map[value] ?? 3;
  }

  /**
   * Backend real: MessageProviderDto { Simulator=0, Meta=1 }
   */
  private mapStringToProvider(value: MessageProvider): number {
    const map: Record<MessageProvider, number> = {
      'simulator': 0,
      'meta': 1
    };
    return map[value] ?? 0;
  }

  /**
   * Backend real: MessageDirectionDto { Out=0, In=1, Outbound=2, Inbound=3 }
   */
  private mapStringToDirection(value: MessageDirection): number {
    const map: Record<MessageDirection, number> = {
      'outbound': 2,  // Outbound = 2
      'inbound': 3    // Inbound = 3
    };
    return map[value] ?? 2;
  }

  private mapStringToStatus(value: MessageStatus): number {
    const map: Record<MessageStatus, number> = {
      'intent': 4,    // Intent = 4
      'queued': 1,    // Queued = 1
      'sent': 2,      // Sent = 2
      'delivered': 2,  // Não existe no backend, mapeia para Sent
      'read': 2,       // Não existe no backend, mapeia para Sent
      'failed': 3      // Failed = 3
    };
    return map[value] ?? 2;
  }

  /**
   * Mapeia enums numéricos da API para strings
   * Backend .NET pode retornar enums como números (0, 1, 2...)
   * Também mapeia campo 'text' para 'textPreview' para compatibilidade
   */
  private mapApiEnumsToStrings(message: any): Message {
    return {
      ...message,
      // Campo 'text' do backend → 'textPreview' no frontend
      textPreview: message.textPreview || message.text || '(sem texto)',
      channel: typeof message.channel === 'number' ? this.mapChannel(message.channel) : (message.channel || 'whatsapp'),
      provider: typeof message.provider === 'number' ? this.mapProvider(message.provider) : (message.provider || 'simulator'),
      direction: typeof message.direction === 'number' ? this.mapDirection(message.direction) : this.normalizeDirection(message.direction),
      status: typeof message.status === 'number' ? this.mapStatus(message.status) : this.normalizeStatus(message.status),
    };
  }

  /**
   * Normaliza strings de direction do backend (Out/In/Outbound/Inbound) para o formato do frontend
   */
  private normalizeDirection(value: string): MessageDirection {
    if (!value) return 'outbound';
    const lower = value.toLowerCase();
    if (lower === 'out' || lower === 'outbound') return 'outbound';
    if (lower === 'in' || lower === 'inbound') return 'inbound';
    return 'outbound';
  }

  /**
   * Normaliza strings de status do backend (Draft/Queued/Sent/Failed/Intent) para o formato do frontend
   */
  private normalizeStatus(value: string): MessageStatus {
    if (!value) return 'sent';
    const lower = value.toLowerCase();
    if (lower === 'draft') return 'intent';
    if (lower === 'queued') return 'queued';
    if (lower === 'sent') return 'sent';
    if (lower === 'failed') return 'failed';
    if (lower === 'intent') return 'intent';
    if (lower === 'delivered') return 'delivered';
    if (lower === 'read') return 'read';
    return 'sent';
  }

  /**
   * Backend real: MessageChannelDto { WhatsAppApi=0, WhatsAppWeb=1, Simulator=2, WhatsApp=3 }
   */
  private mapChannel(value: number): MessageChannel {
    // Todos os canais mapeiam para 'whatsapp' no frontend
    return 'whatsapp';
  }

  private mapProvider(value: number): MessageProvider {
    const providers: MessageProvider[] = ['simulator', 'meta'];
    return providers[value] ?? 'simulator';
  }

  /**
   * Backend real: MessageDirectionDto { Out=0, In=1, Outbound=2, Inbound=3 }
   */
  private mapDirection(value: number): MessageDirection {
    if (value === 0 || value === 2) return 'outbound';
    if (value === 1 || value === 3) return 'inbound';
    return 'outbound';
  }

  /**
   * Backend real: MessageStatusDto { Draft=0, Queued=1, Sent=2, Failed=3, Intent=4 }
   */
  private mapStatus(value: number): MessageStatus {
    const statuses: MessageStatus[] = ['intent', 'queued', 'sent', 'failed', 'intent'];
    return statuses[value] ?? 'sent';
  }

  /**
   * Extrai array de qualquer formato de resposta da API
   * Suporta: array direto, { data: [...] }, { data: { messages: [...] } }, { data: { items: [...] } }, { $values: [...] }
   */
  private extractArray(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (response?.data) {
      // Formato paginado: { data: { messages: [...], page, totalCount } }
      if (Array.isArray(response.data?.messages)) return response.data.messages;
      if (Array.isArray(response.data)) return response.data;
      if (Array.isArray(response.data?.items)) return response.data.items;
      if (Array.isArray(response.data?.$values)) return response.data.$values;
    }
    if (Array.isArray(response?.$values)) return response.$values;
    if (Array.isArray(response?.messages)) return response.messages;
    if (Array.isArray(response?.items)) return response.items;
    console.warn('⚠️ [MessagesApi] Formato inesperado de resposta:', typeof response, Object.keys(response || {}));
    return [];
  }

  // ===== Mensagens =====

  /**
   * Cria nova mensagem com status=intent
   * POST /api/Messages
   */
  createMessage(dto: CreateMessageDto): Observable<Message> {
    console.log('🔍 [MessagesApi] DTO recebido:', dto);
    
    // Backend .NET espera enums numéricos
    const payload = {
      clientId: dto.clientId,
      channel: this.mapStringToChannel(dto.channel),
      direction: this.mapStringToDirection(dto.direction),
      provider: this.mapStringToProvider(dto.provider || 'simulator'),
      text: dto.text,
      templateId: dto.templateId,
    };
    
    console.log('📤 [MessagesApi] Payload convertido para backend:', payload);
    
    return this.apiClient.post<any>(this.messagesEndpoint, payload).pipe(
      map(response => {
        console.log('✅ [MessagesApi] Response recebida:', response);
        const msg = response?.data ?? response;
        return this.mapApiEnumsToStrings(msg);
      })
    );
  }

  /**
   * Lista mensagens de um cliente
   * GET /api/Messages?clientId={clientId}&workspaceId={workspaceId}
   */
  getMessagesByClient(clientId: string): Observable<Message[]> {
    console.log('📥 [MessagesApi] Carregando mensagens do cliente:', clientId);
    
    // Pegar workspace ativo
    const workspace = this.workspaceService.getActive();
    const workspaceId = workspace?.id;
    
    // Construir query params
    const params = new URLSearchParams();
    params.set('clientId', clientId);
    if (workspaceId) {
      params.set('workspaceId', workspaceId);
    }
    
    const url = `${this.messagesEndpoint}?${params.toString()}`;
    console.log('📥 [MessagesApi] URL:', url);
    console.log('📥 [MessagesApi] WorkspaceId:', workspaceId);
    
    return this.apiClient.get<any>(url).pipe(
      map(response => {
        console.log('📥 [MessagesApi] getMessagesByClient raw:', JSON.stringify(response)?.substring(0, 500));
        const items = this.extractArray(response);
        const messages = items.map((msg: any) => this.mapApiEnumsToStrings(msg));
        console.log('📥 [MessagesApi] Messages mapeadas:', messages.length);
        return messages;
      })
    );
  }

  /**
   * Lista todas as mensagens com filtros opcionais
   * GET /api/messages?status=&direction=&channel=&provider=&workspaceId=
   */
  listMessages(filters?: { 
    status?: MessageStatus; 
    direction?: MessageDirection;
    channel?: MessageChannel;
    provider?: MessageProvider;
  }): Observable<Message[]> {
    // Pegar workspace ativo
    const workspace = this.workspaceService.getActive();
    const workspaceId = workspace?.id;
    
    const params = new URLSearchParams();
    
    // SEMPRE incluir workspaceId
    if (workspaceId) {
      params.set('workspaceId', workspaceId);
    }
    
    // Adicionar filtros opcionais
    if (filters) {
      if (filters.status) params.set('status', filters.status);
      if (filters.direction) params.set('direction', filters.direction);
      if (filters.channel) params.set('channel', filters.channel);
      if (filters.provider) params.set('provider', filters.provider);
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `${this.messagesEndpoint}${query}`;
    
    console.log('📥 [MessagesApi] listMessages URL:', url);
    console.log('📥 [MessagesApi] WorkspaceId:', workspaceId);
    
    return this.apiClient.get<any>(url).pipe(
      map(response => {
        console.log('📥 [MessagesApi] listMessages raw response:', JSON.stringify(response)?.substring(0, 500));
        const items = this.extractArray(response);
        return items.map((msg: any) => this.mapApiEnumsToStrings(msg));
      })
    );
  }

  /**
   * Busca mensagem por ID
   * GET /api/Messages/{id}
   */
  getMessageById(id: string): Observable<Message> {
    return this.apiClient.get<ApiResponse<any>>(`${this.messagesEndpoint}/${id}`).pipe(
      map(response => this.mapApiEnumsToStrings(response.data))
    );
  }

  /**
   * Marca mensagem como enviada
   * PUT /api/Messages/{id}/sent
   */
  markMessageAsSent(id: string, data?: { sentAt?: string; providerMessageId?: string }): Observable<any> {
    return this.apiClient.put<ApiResponse<any>>(`${this.messagesEndpoint}/${id}/sent`, data || {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * Marca mensagem como falha
   * PUT /api/Messages/{id}/failed
   */
  markMessageAsFailed(id: string, reason?: string): Observable<any> {
    return this.apiClient.put<ApiResponse<any>>(`${this.messagesEndpoint}/${id}/failed`, { reason }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Atualiza status da mensagem (compatibilidade)
   * Mapeia para os endpoints corretos do backend
   */
  updateMessageStatus(id: string, status: MessageStatus, additionalData?: Partial<UpdateMessageDto>): Observable<any> {
    console.log('📝 [MessagesApi] Updating message status:', id, status, additionalData);
    
    if (status === 'sent' || status === 'delivered' || status === 'read') {
      // Backend só tem /sent, então usar para sent/delivered/read
      return this.markMessageAsSent(id, {
        sentAt: additionalData?.sentAt,
        providerMessageId: additionalData?.providerMessageId
      });
    } else if (status === 'failed') {
      return this.markMessageAsFailed(id, additionalData?.failureReason);
    } else {
      // Para outros status (intent, queued), não fazer nada pois o backend não tem endpoint
      console.warn('⚠️ [MessagesApi] Status', status, 'não tem endpoint no backend. Ignorando atualização.');
      return of({ id, status }); // Usar 'of' do RxJS
    }
  }

  /**
   * Atualiza mensagem (deprecated - backend não tem PATCH genérico)
   * Use markMessageAsSent ou markMessageAsFailed
   */
  updateMessage(id: string, dto: UpdateMessageDto): Observable<any> {
    console.warn('⚠️ [MessagesApi] updateMessage está deprecated. Use markMessageAsSent ou markMessageAsFailed');
    
    if (dto.status) {
      return this.updateMessageStatus(id, dto.status, dto);
    }
    
    // Backend não tem PATCH genérico, retornar erro
    return throwError(() => new Error('Backend não suporta atualização genérica de mensagens'));
  }

  // ===== Mensagens Agendadas =====

  /**
   * Cria mensagem agendada
   * POST /api/scheduled-messages
   */
  createScheduled(dto: CreateScheduledMessageDto): Observable<ScheduledMessage> {
    return this.apiClient.post<ApiResponse<ScheduledMessage>>(this.scheduledEndpoint, dto).pipe(
      map(response => response.data)
    );
  }

  /**
   * Lista mensagens agendadas
   * GET /api/scheduled-messages?status=&clientId=
   */
  listScheduled(filters?: { status?: ScheduledMessageStatus; clientId?: string }): Observable<ScheduledMessage[]> {
    let query = '';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.clientId) params.set('clientId', filters.clientId);
      query = `?${params.toString()}`;
    }
    return this.apiClient.get<ApiResponse<ScheduledMessage[]>>(`${this.scheduledEndpoint}${query}`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Busca mensagem agendada por ID
   * GET /api/scheduled-messages/{id}
   */
  getScheduledById(id: string): Observable<ScheduledMessage> {
    return this.apiClient.get<ApiResponse<ScheduledMessage>>(`${this.scheduledEndpoint}/${id}`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Cancela mensagem agendada
   * PATCH /api/scheduled-messages/{id}/cancel
   */
  cancelScheduled(id: string): Observable<ScheduledMessage> {
    return this.apiClient.patch<ApiResponse<ScheduledMessage>>(`${this.scheduledEndpoint}/${id}/cancel`, {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * Reagenda mensagem
   * PATCH /api/scheduled-messages/{id}/reschedule
   */
  reschedule(id: string, newPlannedAt: string): Observable<ScheduledMessage> {
    return this.apiClient.patch<ApiResponse<ScheduledMessage>>(`${this.scheduledEndpoint}/${id}/reschedule`, { 
      plannedAt: newPlannedAt 
    }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Marca mensagem agendada como enviada
   * PATCH /api/scheduled-messages/{id}/mark-sent
   */
  markScheduledAsSent(id: string, messageId: string): Observable<ScheduledMessage> {
    return this.apiClient.patch<ApiResponse<ScheduledMessage>>(`${this.scheduledEndpoint}/${id}/mark-sent`, { 
      messageId 
    }).pipe(
      map(response => response.data)
    );
  }

  // ===== Envio unificado =====

  /**
   * Envia mensagem via endpoint unificado.
   * POST /api/messages/send
   *
   * O backend:
   *  - grava a mensagem
   *  - atualiza score / lastContactAt do cliente
   *  - se followUpId estiver presente, marca o followup como DONE
   *  - retorna 409 (Conflict) se:
   *    - OUTSIDE_WINDOW: fora da janela de 24h, force template
   *    - TEMPLATE_NOT_APPROVED: template não aprovado no Meta
   */
  sendMessage(payload: {
    clientId: string;
    provider: MessageProvider;
    text: string;
    templateId?: string;
    followUpId?: string;
  }): Observable<Message> {
    console.log('[MessagesApi] 🔍 sendMessage - INPUT payload:', payload);
    
    // Determine mode based on whether a template is being used
    const mode = payload.templateId ? 'TEMPLATE' : 'TEXT';
    
    // Backend DTO structure from Swagger
    const dto = {
      clientId: payload.clientId,
      mode: mode,
      text: payload.text,
      origin: 'COMPOSER',
      ...(payload.templateId ? { templateId: payload.templateId } : {}),
      ...(payload.followUpId ? { followUpId: payload.followUpId } : {}),
    };
    
    console.log('[MessagesApi] 📤 Sending DTO to backend:', dto);
    console.log('[MessagesApi] 📤 DTO keys:', Object.keys(dto));
    console.log('[MessagesApi] 📤 DTO stringified:', JSON.stringify(dto, null, 2));
    
    return this.apiClient.post<any>('/messages/send', dto).pipe(
      map(response => {
        console.log('[MessagesApi] ✅ Response from backend:', response);
        const msg = response?.data ?? response;
        return this.mapApiEnumsToStrings(msg);
      })
    );
  }
}

/**
 * Error codes returned by /api/messages/send on 409 Conflict
 */
export type MessageSendErrorCode = 'OUTSIDE_WINDOW' | 'TEMPLATE_NOT_APPROVED' | 'UNKNOWN';

export interface MessageSendError {
  code: MessageSendErrorCode;
  message: string;
}
