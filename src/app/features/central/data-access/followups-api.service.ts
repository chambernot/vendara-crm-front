import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ApiClient } from '../../../core/api';
import { Followup, CreateFollowupDto, UpdateFollowupDto, FollowupBucket } from './followup.models';
import { WorkspaceService } from '../../../core/workspace/workspace.service';

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
 * Interface para Followup da API (FollowupDto no backend)
 */
export interface FollowupApiDto {
  id: string;
  workspaceId: string;
  clientId: string;
  status: 'open' | 'scheduled' | 'done' | 'canceled';
  bucket: FollowupBucket;
  dueDate?: string; // ISO date string (alguns backends)
  dueAt?: string; // ISO date string (HCAJOAIAS backend usa este)
  priorityScore: number;
  reasons?: string[];
  reason?: string;
  primaryReason?: string;
  recommendedTemplateId?: string;
  recommendedTiming?: 'morning' | 'afternoon' | 'evening' | 'this_week';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  doneAt?: string; // Alguns backends usam doneAt
  scoreSnapshot?: {
    score: number;
    label: string;
    capturedAt: string;
  };
  clientSnapshot?: {
    name: string;
    phone: string;
  };
  templateId?: string;
}

/**
 * Interface para criar followup via API
 */
export interface CreateFollowupApiDto {
  clientId: string;
  dueDate: string;
  priorityScore: number;
  reasons: string[];
  recommendedTemplateId: string;
  recommendedTiming?: 'morning' | 'afternoon' | 'evening' | 'this_week';
}

/**
 * Interface para atualizar followup via API
 */
export interface UpdateFollowupApiDto {
  status?: 'open' | 'scheduled' | 'done' | 'canceled';
  dueDate?: string;
  dueAt?: string; // HCAJOAIAS backend usa este
  priorityScore?: number;
  reasons?: string[];
  recommendedTemplateId?: string;
  recommendedTiming?: 'morning' | 'afternoon' | 'evening' | 'this_week';
}

/**
 * Interface para reagendar followup
 */
export interface RescheduleFollowupDto {
  newDueDate: string; // ISO date string
}

/**
 * SkipReason retornado pelo backend (SkipReasonDto)
 */
export interface SkipReasonDto {
  reason: string;
  count: number;
}

/**
 * Resposta do endpoint POST /api/Followups/generate-now
 */
export interface GenerateFollowupsResponse {
  createdCount: number;
  skippedCount: number;
  reasons: string[];   // Top motivos de skip formatados (ex: "Já possui follow-up aberto (5)")
  message: string;
}

/**
 * Resposta agrupada de todos os buckets via /api/Followups/summary
 * Backend HCAJOAIAS.Api usa 'completed', composer-api usa 'done'
 */
export interface FollowupSummaryResponse {
  today: FollowupApiDto[];
  overdue: FollowupApiDto[];
  scheduled: FollowupApiDto[];
  completed?: FollowupApiDto[];
  done?: FollowupApiDto[];
}

/**
 * Resultado mapeado do summary com modelos locais
 */
export interface FollowupSummary {
  today: Followup[];
  overdue: Followup[];
  scheduled: Followup[];
  done: Followup[];
}

/**
 * Serviço API para gerenciamento de followups
 * Mapeia rotas da API: /api/Followups
 *
 * Endpoints padronizados:
 *  - GET /api/Followups?bucket={bucket}  → list()
 *  - GET /api/Followups/summary          → summary()  (todos os buckets em 1 request)
 */
@Injectable({
  providedIn: 'root'
})
export class FollowupsApiService {
  private apiClient = inject(ApiClient);
  private readonly endpoint = '/Followups';
  private workspaceService = inject(WorkspaceService);

  /**
   * Lista followups por bucket
   * GET /api/Followups?bucket={bucket}
   * WorkspaceId é enviado via header x-workspace-id pelo interceptor
   */
  list(params?: {
    bucket?: FollowupBucket;
    workspaceId?: string; // Deprecated - usar interceptor
  }): Observable<Followup[]> {
    const queryParams = new URLSearchParams();
    
    // Apenas bucket é enviado como query param
    // workspaceId é enviado via header pelo interceptor
    if (params?.bucket) queryParams.append('bucket', params.bucket);

    const url = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
    
    return this.apiClient.get<ApiResponse<FollowupApiDto[]>>(url).pipe(
      map(response => {
        const items = response.data ?? (response as any);
        return (Array.isArray(items) ? items : []).map((dto: FollowupApiDto) => this.mapApiDtoToFollowup(dto));
      })
    );
  }

  /**
   * Busca followup por ID
   * GET /api/Followups/{id}
   */
  getById(id: string): Observable<Followup> {
    return this.apiClient.get<ApiResponse<FollowupApiDto>>(`${this.endpoint}/${id}`).pipe(
      map(response => this.mapApiDtoToFollowup(response.data))
    );
  }

  /**
   * Cria novo followup
   * POST /api/Followups
   */
  create(dto: CreateFollowupApiDto): Observable<Followup> {
    return this.apiClient.post<ApiResponse<FollowupApiDto>>(this.endpoint, dto).pipe(
      map(response => this.mapApiDtoToFollowup(response.data))
    );
  }

  /**
   * Atualiza followup existente
   * PUT /api/Followups/{id}
   */
  update(id: string, dto: UpdateFollowupApiDto): Observable<Followup> {
    return this.apiClient.put<ApiResponse<FollowupApiDto>>(`${this.endpoint}/${id}`, dto).pipe(
      map(response => this.mapApiDtoToFollowup(response.data))
    );
  }

  /**
   * Marca followup como concluído
   * PUT /api/Followups/{id}/done
   */
  complete(id: string, reason?: string): Observable<Followup> {
    console.log('[FollowupsApiService] 📤 Concluindo follow-up via /done:', id);
    
    const payload = reason ? { reason } : {};
    
    return this.apiClient.put<ApiResponse<FollowupApiDto>>(`${this.endpoint}/${id}/done`, payload).pipe(
      tap(response => {
        console.log('[FollowupsApiService] ✅ Follow-up concluído:', response);
      }),
      map(response => {
        if (!response.data) {
          console.error('[FollowupsApiService] ❌ Response.data vazio:', response);
          throw new Error('Response data is null or undefined');
        }
        return this.mapApiDtoToFollowup(response.data);
      }),
      catchError(error => {
        console.error('[FollowupsApiService] ❌ Erro ao concluir:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Reagenda followup para nova data
   * PUT /api/Followups/{id} com dueDate
   * Backend não tem endpoint /reschedule, então usamos PUT.
   */
  reschedule(id: string, dto: RescheduleFollowupDto): Observable<Followup> {
    console.log('[FollowupsApiService] 📅 Reagendando follow-up via PUT:', { id, dto });
    console.log('[FollowupsApiService] 📅 newDueDate:', dto.newDueDate, 'type:', typeof dto.newDueDate);
    
    // IMPORTANTE: O backend HCAJOAIAS usa "dueAt" (não "dueDate")
    // Converter a data YYYY-MM-DD para ISO DateTime format
    const dueDateISO = new Date(dto.newDueDate + 'T12:00:00.000Z').toISOString();
    
    const updateDto = {
      dueAt: dueDateISO  // Backend espera "dueAt" no formato ISO DateTime
    };
    
    console.log('[FollowupsApiService] 📤 Payload final para API:', JSON.stringify(updateDto));
    
    return this.apiClient.put<ApiResponse<FollowupApiDto>>(`${this.endpoint}/${id}`, updateDto).pipe(
      tap(response => {
        console.log('[FollowupsApiService] ✅ Follow-up reagendado:', response);
        console.log('[FollowupsApiService] 🔍 RAW response.data:', response.data);
        console.log('[FollowupsApiService] 🔍 RAW response.data COMPLETO:', JSON.stringify(response.data, null, 2));
        
        if (response.data) {
          console.log('[FollowupsApiService] ✅ Followup atualizado - status:', response.data.status, 'bucket:', response.data.bucket, 'dueAt:', response.data.dueAt, 'dueDate:', response.data.dueDate);
        }
      }),
      map(response => {
        const mapped = this.mapApiDtoToFollowup(response.data);
        console.log('[FollowupsApiService] 🔍 FOLLOWUP MAPEADO:', JSON.stringify(mapped, null, 2));
        return mapped;
      }),
      catchError(error => {
        console.error('[FollowupsApiService] ❌ Erro ao reagendar:', error);
        console.error('[FollowupsApiService] ❌ Error status:', error.status);
        console.error('[FollowupsApiService] ❌ Error body:', error.error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Remove followup
   * DELETE /api/Followups/{id}
   */
  delete(id: string): Observable<void> {
    return this.apiClient.delete<ApiResponse<any>>(`${this.endpoint}/${id}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Mapeia skipReasons (SkipReasonDto[]) do backend para strings legíveis
   * Backend retorna: [{ reason: "Já possui follow-up aberto", count: 5 }]
   * Frontend precisa: ["Já possui follow-up aberto (5)"]
   */
  private mapSkipReasons(data: any): string[] {
    // Tentar ler skipReasons (nome correto do backend)
    const skipReasons = data.skipReasons ?? data.SkipReasons ?? data.reasons ?? data.Reasons ?? [];
    
    console.log('[FollowupsAPI] 🔍 Raw skipReasons do backend:', skipReasons);
    
    if (!Array.isArray(skipReasons) || skipReasons.length === 0) {
      return [];
    }
    
    return skipReasons.map((sr: any) => {
      // Se já é string, retornar direto
      if (typeof sr === 'string') return sr;
      
      // Se é SkipReasonDto { reason, count }
      const reason = sr.reason ?? sr.Reason ?? sr.message ?? 'Motivo desconhecido';
      const count = sr.count ?? sr.Count ?? 0;
      return count > 0 ? `${reason} (${count})` : reason;
    });
  }

  /**
   * Gera follow-ups automaticamente para um workspace
   * POST /api/Followups/generate-now
   * WorkspaceId é enviado via header x-workspace-id pelo interceptor
   * Retorna createdCount, skippedCount e reasons[] com motivos de skip
   */
  generateNow(): Observable<GenerateFollowupsResponse> {
    return this.apiClient.post<any>(
      `${this.endpoint}/generate-now`,
      {}
    ).pipe(
      map(response => {
        console.log('[FollowupsAPI] 🔍 generateNow() RAW response:', response);
        const data = response.data ?? response;
        console.log('[FollowupsAPI] 🔍 generateNow() data extraído:', data);
        console.log('[FollowupsAPI] 🔍 Campos disponíveis:', Object.keys(data));
        
        const reasons = this.mapSkipReasons(data);
        
        const result: GenerateFollowupsResponse = {
          createdCount: data.created ?? data.createdCount ?? data.Created ?? 0,
          skippedCount: data.skipped ?? data.skippedCount ?? data.Skipped ?? 0,
          reasons,
          message: data.message ?? data.Message ?? 'Follow-ups gerados com sucesso',
        };
        
        console.log('[FollowupsAPI] ✅ generateNow() resultado mapeado:', result);
        return result;
      })
    );
  }

  /**
   * Gera follow-up para um cliente específico
   * POST /api/Followups/generate
   * Body: { clientId: string }
   * Usa a lógica do backend para criar followup com score, reasons, etc.
   */
  generateForClient(clientId: string): Observable<GenerateFollowupsResponse> {
    console.log('[FollowupsAPI] 📤 generateForClient() enviando:', { clientId });
    
    return this.apiClient.post<any>(
      `${this.endpoint}/generate`,
      { clientId }
    ).pipe(
      map(response => {
        console.log('[FollowupsAPI] 🔍 generateForClient() RAW response:', JSON.stringify(response));
        const data = response?.data ?? response;
        console.log('[FollowupsAPI] 🔍 generateForClient() data extraído:', JSON.stringify(data));
        console.log('[FollowupsAPI] 🔍 Campos disponíveis:', data ? Object.keys(data) : 'null');
        console.log('[FollowupsAPI] 🔍 Valores de contagem:', {
          'data.created': data?.created,
          'data.createdCount': data?.createdCount,
          'data.Created': data?.Created,
          'data.skipped': data?.skipped,
          'data.skippedCount': data?.skippedCount,
          'data.Skipped': data?.Skipped,
          'data.success': data?.success,
        });
        
        const reasons = this.mapSkipReasons(data);
        
        const result: GenerateFollowupsResponse = {
          createdCount: data?.created ?? data?.createdCount ?? data?.Created ?? 0,
          skippedCount: data?.skipped ?? data?.skippedCount ?? data?.Skipped ?? 0,
          reasons,
          message: data?.message ?? data?.Message ?? 'Follow-up gerado com sucesso',
        };
        
        console.log('[FollowupsAPI] ✅ generateForClient() resultado mapeado:', result);
        return result;
      })
    );
  }

  /**
   * @deprecated Use generateNow() instead
   */
  generate(workspaceId?: string): Observable<{ success: boolean; message: string; followupsCreated: number }> {
    return this.generateNow().pipe(
      map(result => ({
        success: true,
        message: result.message,
        followupsCreated: result.createdCount
      }))
    );
  }

  /**
   * Busca todos os buckets de followups em um único request
   * GET /api/Followups/summary
   * WorkspaceId é enviado via header x-workspace-id pelo interceptor
   */
  summary(): Observable<FollowupSummary> {
    console.log('📊 [FollowupsAPI] Chamando /summary - workspaceId será enviado via interceptor');
    
    // NÃO enviar workspaceId como query param - o interceptor adiciona via header x-workspace-id
    return this.apiClient.get<ApiResponse<FollowupSummaryResponse>>(`${this.endpoint}/summary`).pipe(
      map(response => {
        // Defensivo: o backend pode retornar { success, data: { today, ... } }
        // ou diretamente { today, ... } dependendo do ambiente/proxy.
        const data = response.data ?? (response as any);
        // Backend HCAJOAIAS.Api retorna 'completed', composer-api retorna 'done'
        const doneItems = data.completed || data.done || [];
        return {
          today: (data.today || []).map((dto: FollowupApiDto) => this.mapApiDtoToFollowup(dto)),
          overdue: (data.overdue || []).map((dto: FollowupApiDto) => this.mapApiDtoToFollowup(dto)),
          scheduled: (data.scheduled || []).map((dto: FollowupApiDto) => this.mapApiDtoToFollowup(dto)),
          done: doneItems.map((dto: FollowupApiDto) => this.mapApiDtoToFollowup(dto)),
        };
      })
    );
  }

  /**
   * @deprecated Use summary() para carregar todos os buckets de uma vez.
   * Mantido temporariamente para compatibilidade.
   */
  getToday(): Observable<Followup[]> {
    return this.list({ bucket: 'today' });
  }

  /** @deprecated Use summary() */
  getOverdue(): Observable<Followup[]> {
    return this.list({ bucket: 'overdue' });
  }

  /** @deprecated Use summary() */
  getScheduled(): Observable<Followup[]> {
    return this.list({ bucket: 'scheduled' });
  }

  /** @deprecated Use summary() */
  getDone(): Observable<Followup[]> {
    return this.list({ bucket: 'done' });
  }

  /**
   * Mapeia FollowupApiDto para Followup (modelo local)
   */
  private mapApiDtoToFollowup(dto: FollowupApiDto): Followup {
    // Backend pode retornar dueDate ou dueAt - aceitar ambos
    const dueDate = dto.dueDate || dto.dueAt || '';
    // Backend pode retornar completedAt ou doneAt - aceitar ambos
    const completedAt = dto.completedAt || dto.doneAt;
    
    return {
      id: dto.id,
      workspaceId: dto.workspaceId,
      clientId: dto.clientId,
      status: dto.status,
      bucket: dto.bucket,
      dueDate: dueDate,
      priorityScore: dto.priorityScore,
      reasons: dto.reasons || (dto.reason ? [dto.reason] : []),
      primaryReason: dto.primaryReason || (dto.reasons && dto.reasons[0]) || '',
      recommendedTemplateId: dto.recommendedTemplateId || '',
      recommendedTiming: dto.recommendedTiming || undefined,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      completedAt: completedAt,
    };
  }
}
