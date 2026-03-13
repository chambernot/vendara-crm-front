import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  SendWhatsAppMessageRequest,
  SendWhatsAppMessageResponse,
  MessageStatusResponse,
  WhatsAppError
} from './whatsapp-api.models';
import { TelemetryService } from '../telemetry/telemetry.service';

/**
 * WhatsApp API Service
 * Serviço para integração com a API do WhatsApp (backend)
 * 
 * @deprecated Este serviço está deprecado. Use MessagesApiService.sendMessage() em vez disso.
 * O endpoint unificado /api/messages/send deve ser usado para todos os envios de mensagens.
 */
@Injectable({
  providedIn: 'root'
})
export class WhatsAppApiService {
  private readonly http = inject(HttpClient);
  private readonly telemetry = inject(TelemetryService);
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Envia uma mensagem via API do WhatsApp
   * @deprecated Use MessagesApiService.sendMessage() em vez disso
   */
  sendMessage(request: SendWhatsAppMessageRequest): Observable<SendWhatsAppMessageResponse> {
    this.telemetry.log('whatsapp_api_send_attempt', {
      type: request.type,
      templateName: request.templateName || 'text',
      hasParams: (request.templateParams?.length ?? 0) > 0
    });

    return this.http.post<SendWhatsAppMessageResponse>(
      `${this.baseUrl}/api/whatsapp/send`,
      request
    ).pipe(
      tap(response => {
        this.telemetry.log('whatsapp_api_send_success', {
          messageId: response.messageId,
          status: response.status,
          provider: response.provider,
          templateName: request.templateName || 'text'
        });
      }),
      catchError(error => this.handleError(error, request.templateName))
    );
  }

  /**
   * Consulta o status de uma mensagem
   */
  getStatus(messageId: string): Observable<MessageStatusResponse> {
    return this.http.get<MessageStatusResponse>(
      `${this.baseUrl}/api/whatsapp/status/${messageId}`
    ).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Trata erros da API
   */
  private handleError(error: HttpErrorResponse, templateName?: string): Observable<never> {
    let errorMessage = 'Erro ao comunicar com a API do WhatsApp';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.error instanceof ErrorEvent) {
      // Erro do lado do cliente
      errorMessage = `Erro: ${error.error.message}`;
      errorCode = 'CLIENT_ERROR';
    } else {
      // Erro do lado do servidor
      errorCode = error.error?.code || `HTTP_${error.status}`;
      errorMessage = error.error?.message || errorMessage;
    }

    this.telemetry.log('whatsapp_api_send_fail', {
      errorCode,
      errorMessage,
      status: error.status,
      templateName: templateName || 'unknown'
    });

    const whatsappError: WhatsAppError = {
      code: errorCode,
      message: errorMessage,
      details: error.error
    };

    return throwError(() => whatsappError);
  }
}
