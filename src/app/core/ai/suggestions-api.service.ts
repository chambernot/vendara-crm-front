import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../api';

/**
 * Status de aplicação de sugestão
 */
export type SuggestionApplicationStatus = 'pending' | 'applied' | 'rejected' | 'failed';

/**
 * Interface para aplicação de sugestão
 */
export interface SuggestionApplication {
  id: string;
  clientId: string;
  suggestionType: string;
  suggestionText: string;
  status: SuggestionApplicationStatus;
  appliedAt?: string;
  rejectedAt?: string;
  failedAt?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface para criar aplicação de sugestão
 */
export interface CreateSuggestionApplicationDto {
  clientId: string;
  suggestionType: string;
  suggestionText: string;
  metadata?: Record<string, any>;
}

/**
 * Interface para atualizar aplicação de sugestão
 */
export interface UpdateSuggestionApplicationDto {
  status?: SuggestionApplicationStatus;
  appliedAt?: string;
  rejectedAt?: string;
  failedAt?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Serviço API para persistência de sugestões aplicadas
 */
@Injectable({
  providedIn: 'root'
})
export class SuggestionsApiService {
  private apiClient = inject(ApiClient);
  private readonly endpoint = '/suggestion-applications';

  /**
   * Registra aplicação de sugestão
   */
  create(dto: CreateSuggestionApplicationDto): Observable<SuggestionApplication> {
    return this.apiClient.post<SuggestionApplication>(this.endpoint, dto);
  }

  /**
   * Lista aplicações de sugestões
   */
  list(filters?: { clientId?: string; status?: SuggestionApplicationStatus }): Observable<SuggestionApplication[]> {
    let query = '';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.clientId) params.set('clientId', filters.clientId);
      if (filters.status) params.set('status', filters.status);
      query = `?${params.toString()}`;
    }
    return this.apiClient.get<SuggestionApplication[]>(`${this.endpoint}${query}`);
  }

  /**
   * Busca aplicação por ID
   */
  getById(id: string): Observable<SuggestionApplication> {
    return this.apiClient.get<SuggestionApplication>(`${this.endpoint}/${id}`);
  }

  /**
   * Atualiza status de aplicação
   */
  update(id: string, dto: UpdateSuggestionApplicationDto): Observable<SuggestionApplication> {
    return this.apiClient.patch<SuggestionApplication>(`${this.endpoint}/${id}`, dto);
  }

  /**
   * Marca aplicação como aplicada com sucesso
   */
  markAsApplied(id: string): Observable<SuggestionApplication> {
    return this.update(id, { 
      status: 'applied',
      appliedAt: new Date().toISOString()
    });
  }

  /**
   * Marca aplicação como rejeitada
   */
  markAsRejected(id: string): Observable<SuggestionApplication> {
    return this.update(id, { 
      status: 'rejected',
      rejectedAt: new Date().toISOString()
    });
  }

  /**
   * Aplica uma sugestão e registra no backend
   * Endpoint: POST /api/suggestions/apply
   */
  apply(dto: {
    clientId: string;
    suggestionId: string;
    suggestionType: string;
    suggestionText: string;
    metadata?: Record<string, any>;
  }): Observable<SuggestionApplication> {
    return this.apiClient.post<SuggestionApplication>('/suggestions/apply', dto);
  }

  /**
   * Marca aplicação como falhada
   */
  markAsFailed(id: string, reason: string): Observable<SuggestionApplication> {
    return this.update(id, { 
      status: 'failed',
      failedAt: new Date().toISOString(),
      failureReason: reason
    });
  }
}
