import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../../../core/api';
import { Client, ScoreTier, ScoreLabel } from './clients.models';  // Importar modelo local + types

/**
 * Interface para resposta paginada da API
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/**
 * Interface para resposta da API (wrapper padrão)
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

/**
 * Interface para cliente da API (usa 'phone')
 */
export interface ClientApiDto {
  id: string;
  workspaceId?: string;
  name: string;
  whatsApp?: string;  // Backend retorna 'whatsApp' (camelCase de WhatsApp)
  phone?: string;     // Fallback para dados antigos
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  lastContactAt: string;
  lastPurchaseAt?: string;
  waitingReply: boolean;
  // Score fields from backend (campos separados)
  score?: number;           // 0-100
  scoreLabel?: string;      // "Baixa", "Média", "Alta"
  scoreTier?: string;       // "COLD", "WARM", "HOT"
  scoreBreakdown?: Array<{
    key?: string;           // Chave única do fator
    label: string;
    detail?: string;
    points: number;
  }>;
}

/**
 * Interface para item de lista (ClientListItemDto da API)
 */
export interface ClientListItem {
  id: string;
  workspaceId?: string;
  name: string;
  whatsApp?: string;  // Backend retorna 'whatsApp'
  phone?: string;     // Fallback para dados antigos
  tags: string[];
  createdAt: string;
  lastContactAt?: string;
  lastPurchaseAt?: string;
  waitingReply: boolean;
  // Score fields from backend (campos separados)
  score?: number;           // 0-100
  scoreLabel?: string;      // "Baixa", "Média", "Alta"
  scoreTier?: string;       // "COLD", "WARM", "HOT"
  scoreBreakdown?: Array<{
    key?: string;
    label: string;
    detail?: string;
    points: number;
  }>;
}

/**
 * Interface para criar cliente (ClientCreateDto da API)
 */
export interface CreateClientDto {
  name: string;
  WhatsApp: string;  // Campo obrigatório no backend
  notes?: string;
  tags?: string[];
  workspaceId?: string;
}

/**
 * Interface para atualizar cliente (ClientUpdateDto da API)
 */
export interface UpdateClientDto {
  name?: string;
  WhatsApp?: string;
  notes?: string;
  tags?: string[];
  lastContactAt?: string;
  lastPurchaseAt?: string;
  waitingReply?: boolean;
}

/**
 * DTO de score retornado pela API (camelCase do backend .NET)
 * GET /api/Clients/{id}/score
 */
export interface ScoreResultDto {
  score: number;        // 0-100
  label: string;        // "Baixa", "Média", "Alta"
  tier: string;         // "COLD", "WARM", "HOT"
  breakdown: Array<{
    key?: string;       // Chave única do fator
    label: string;
    points: number;
    detail?: string;
  }>;
}

/**
 * Resultado de score mapeado para consumo no frontend
 */
export interface ScoreResult {
  score: number;        // 0-100
  label: string;        // "Baixa", "Média", "Alta"
  tier: string;         // "COLD", "WARM", "HOT"
  breakdown: Array<{
    key?: string;
    label: string;
    detail?: string;
    points: number;
  }>;
}

/**
 * Serviço API para gerenciamento de clientes
 * Mapeia rotas da API: /api/Clients
 */
@Injectable({
  providedIn: 'root'
})
export class ClientsApiService {
  private apiClient = inject(ApiClient);
  private readonly endpoint = '/Clients';  // apiBaseUrl já tem /api

  /**
   * Lista todos os clientes com paginação
   * GET /api/Clients?tag=&waitingReply=&pageNumber=1&pageSize=50
   * workspaceId é enviado via header x-workspace-id pelo interceptor
   */
  list(params?: {
    tag?: string;
    waitingReply?: boolean;
    pageNumber?: number;
    pageSize?: number;
  }): Observable<Client[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.tag) queryParams.append('tag', params.tag);
    if (params?.waitingReply !== undefined) queryParams.append('waitingReply', String(params.waitingReply));
    if (params?.pageNumber) queryParams.append('pageNumber', String(params.pageNumber));
    if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

    const url = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
    
    return this.apiClient.get<ApiResponse<PaginatedResponse<ClientListItem>>>(url).pipe(
      map(response => {
        // Converter ClientListItem[] para Client[]
        return response.data.items.map(item => this.mapApiDtoToClient(item));
      })
    );
  }

  /**
   * Busca cliente por ID
   * GET /api/Clients/{id}
   */
  getById(id: string): Observable<Client> {
    return this.apiClient.get<ApiResponse<ClientApiDto>>(`${this.endpoint}/${id}`).pipe(
      map(response => this.mapApiDtoToClient(response.data))
    );
  }

  /**
   * Cria novo cliente
   * POST /api/Clients
   */
  create(dto: CreateClientDto): Observable<Client> {
    console.log('🔵 [ClientsApiService] POST /api/Clients - DTO:', dto);
    return this.apiClient.post<ApiResponse<ClientApiDto>>(this.endpoint, dto).pipe(
      map(response => {
        console.log('✅ [ClientsApiService] Client created:', response.data);
        return this.mapApiDtoToClient(response.data);
      })
    );
  }

  /**
   * Atualiza cliente existente
   * PUT /api/Clients/{id}
   */
  update(id: string, dto: UpdateClientDto): Observable<Client> {
    return this.apiClient.put<ApiResponse<ClientApiDto>>(`${this.endpoint}/${id}`, dto).pipe(
      map(response => this.mapApiDtoToClient(response.data))
    );
  }

  /**
   * Remove cliente
   * DELETE /api/Clients/{id}
   */
  delete(id: string): Observable<void> {
    return this.apiClient.delete<ApiResponse<any>>(`${this.endpoint}/${id}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Busca score do cliente com breakdown detalhado
   * GET /api/Clients/{id}/score
   * Retorna: { score, label, tier, breakdown[] }
   */
  getClientScore(id: string): Observable<ScoreResult> {
    return this.apiClient.get<ApiResponse<ScoreResultDto>>(`${this.endpoint}/${id}/score`).pipe(
      map(response => ({
        score: response.data.score ?? 50,
        label: response.data.label || this.deriveLabelFromScore(response.data.score ?? 50),
        tier: response.data.tier || this.deriveTierFromScore(response.data.score ?? 50),
        breakdown: (response.data.breakdown || []).map(item => ({
          key: item.key,
          label: item.label,
          detail: item.detail,
          points: item.points,
        })),
      }))
    );
  }

  /**
   * Verifica se o cliente está dentro da janela de atendimento do WhatsApp (24h)
   * GET /api/Clients/{id}/whatsapp-window-status
   * Retorna: { withinWindow: boolean }
   */
  getWhatsAppWindowStatus(id: string): Observable<{ withinWindow: boolean }> {
    return this.apiClient.get<ApiResponse<{ withinWindow: boolean }>>(`${this.endpoint}/${id}/whatsapp-window-status`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Deriva tier do score baseado no valor
   */
  private deriveTierFromScore(value: number): string {
    if (value >= 70) return 'HOT';
    if (value >= 40) return 'WARM';
    return 'COLD';
  }

  /**
   * Deriva label do score baseado no valor
   */
  private deriveLabelFromScore(value: number): string {
    if (value >= 70) return 'Alta';
    if (value >= 40) return 'Média';
    return 'Baixa';
  }

  /**
   * Mapeia ClientApiDto para Client (modelo local usa 'whatsapp')
   */
  private mapApiDtoToClient(dto: ClientApiDto | ClientListItem): Client {
    // Mapeia breakdown da API para o modelo local
    const scoreBreakdown = dto.scoreBreakdown?.map(item => ({
      label: item.label,
      detail: item.detail,
      points: item.points
    }));

    // Score, label e tier são campos separados na API
    const score = dto.score ?? 50;
    const scoreLabel = (dto.scoreLabel as ScoreLabel) || this.deriveLabelFromScore(score);
    const scoreTier = (dto.scoreTier as ScoreTier) || this.deriveTierFromScore(score);

    return {
      id: dto.id,
      name: dto.name,
      whatsapp: dto.whatsApp || dto.phone,  // Backend retorna 'whatsApp', fallback para 'phone' (dados antigos)
      tags: dto.tags || [],
      lastContactAt: dto.lastContactAt || new Date().toISOString(),
      score,          // Valor numérico 0-100
      scoreLabel,     // "Baixa", "Média", "Alta"
      scoreTier,      // "COLD", "WARM", "HOT"
      scoreBreakdown, // Breakdown detalhado do score
      whatsappOptIn: false, // Padrão, pode ser atualizado depois
      notes: 'notes' in dto ? dto.notes : undefined,
      waitingReply: dto.waitingReply || false,
    };
  }
}

