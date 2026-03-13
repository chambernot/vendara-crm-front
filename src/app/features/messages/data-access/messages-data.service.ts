import { Injectable, inject, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { 
  MessagesApiService, 
  CreateMessageDto as ApiCreateMessageDto,
  UpdateMessageDto as ApiUpdateMessageDto,
  CreateScheduledMessageDto as ApiCreateScheduledMessageDto,
  Message as ApiMessage,
  ScheduledMessage as ApiScheduledMessage
} from './messages-api.service';
import { 
  MessageStatus,
  MessageChannel,
  MessageDirection,
  MessageProvider
} from './message.models';
import { WorkspaceService } from '../../../core/workspace';

/**
 * Facade que gerencia acesso a dados de mensagens via API
 * SEMPRE usa a API - sem fallback para LocalStorage
 */
@Injectable({
  providedIn: 'root'
})
export class MessagesDataService {
  private messagesApi = inject(MessagesApiService);
  private workspaceService = inject(WorkspaceService);

  // Estado de loading
  private loadingSignal = signal<boolean>(false);
  loading = this.loadingSignal.asReadonly();

  // Estado de erro
  private errorSignal = signal<string | null>(null);
  error = this.errorSignal.asReadonly();

  /**
   * Lista mensagens com filtros opcionais
   */
  listMessages(filters?: { 
    status?: MessageStatus; 
    direction?: MessageDirection;
    channel?: MessageChannel;
    provider?: MessageProvider;
  }): Observable<ApiMessage[]> {
    return this.withLoadingAndError(() => this.messagesApi.listMessages(filters));
  }

  /**
   * Lista mensagens de um cliente
   */
  getMessagesByClient(clientId: string): Observable<ApiMessage[]> {
    return this.withLoadingAndError(() => this.messagesApi.getMessagesByClient(clientId));
  }

  /**
   * Busca mensagem por ID
   */
  getMessageById(id: string): Observable<ApiMessage> {
    return this.withLoadingAndError(() => this.messagesApi.getMessageById(id));
  }

  /**
   * Cria nova mensagem
   */
  createMessage(dto: ApiCreateMessageDto): Observable<ApiMessage> {
    return this.withLoadingAndError(() => this.messagesApi.createMessage(dto));
  }

  /**
   * Atualiza mensagem
   */
  updateMessage(id: string, dto: ApiUpdateMessageDto): Observable<ApiMessage> {
    return this.withLoadingAndError(() => this.messagesApi.updateMessage(id, dto));
  }

  /**
   * Atualiza status da mensagem
   */
  updateMessageStatus(
    id: string, 
    status: MessageStatus, 
    additionalData?: Partial<ApiUpdateMessageDto>
  ): Observable<ApiMessage> {
    return this.withLoadingAndError(() => 
      this.messagesApi.updateMessageStatus(id, status, additionalData)
    );
  }

  /**
   * Lista mensagens agendadas
   */
  listScheduledMessages(filters?: { 
    status?: 'scheduled' | 'sent' | 'cancelled' | 'failed'; 
    clientId?: string 
  }): Observable<ApiScheduledMessage[]> {
    return this.withLoadingAndError(() => this.messagesApi.listScheduled(filters));
  }

  /**
   * Busca mensagem agendada por ID
   */
  getScheduledById(id: string): Observable<ApiScheduledMessage> {
    return this.withLoadingAndError(() => this.messagesApi.getScheduledById(id));
  }

  /**
   * Cria mensagem agendada
   */
  createScheduled(dto: ApiCreateScheduledMessageDto): Observable<ApiScheduledMessage> {
    return this.withLoadingAndError(() => this.messagesApi.createScheduled(dto));
  }

  /**
   * Cancela mensagem agendada
   */
  cancelScheduled(id: string): Observable<ApiScheduledMessage> {
    return this.withLoadingAndError(() => this.messagesApi.cancelScheduled(id));
  }

  /**
   * Reagenda mensagem
   */
  reschedule(id: string, newPlannedAt: string): Observable<ApiScheduledMessage> {
    return this.withLoadingAndError(() => this.messagesApi.reschedule(id, newPlannedAt));
  }

  /**
   * Marca mensagem agendada como enviada
   */
  markScheduledAsSent(id: string, messageId: string): Observable<ApiScheduledMessage> {
    return this.withLoadingAndError(() => 
      this.messagesApi.markScheduledAsSent(id, messageId)
    );
  }

  /**
   * Wrapper para gerenciar loading e erros
   */
  private withLoadingAndError<T>(fn: () => Observable<T>): Observable<T> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return fn().pipe(
      catchError((error) => {
        const errorMsg = error?.message || 'Erro ao processar requisição';
        this.errorSignal.set(errorMsg);
        console.error('[MessagesDataService]', errorMsg, error);
        return throwError(() => error);
      }),
      finalize(() => this.loadingSignal.set(false))
    );
  }

  /**
   * Limpa mensagem de erro
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
