import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../../../core/api';

/**
 * Resposta do endpoint POST /api/followUpsJob/run
 */
export interface FollowUpsJobResult {
  created: number;
  skipped: number;
  completed: number;
}

/**
 * Wrapper padrão da API
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Serviço para disparar o job de geração automática de follow-ups (48h sem resposta).
 * Endpoint: POST /api/followUpsJob/run
 */
@Injectable({
  providedIn: 'root',
})
export class FollowUpsJobService {
  private apiClient = inject(ApiClient);
  private readonly endpoint = '/followUpsJob';

  /**
   * Executa o job de geração de follow-ups para um workspace.
   * POST /api/followUpsJob/run
   * @param workspaceId ID do workspace ativo
   */
  run(workspaceId: string): Observable<FollowUpsJobResult> {
    return this.apiClient
      .post<ApiResponse<FollowUpsJobResult>>(`${this.endpoint}/run`, { workspaceId })
      .pipe(
        map((response) => {
          const data = response.data ?? (response as any);
          return {
            created: data.created ?? 0,
            skipped: data.skipped ?? 0,
            completed: data.completed ?? 0,
          };
        })
      );
  }
}
