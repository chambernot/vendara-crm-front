import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiClient } from '../../../core/api';
import { WorkspaceService } from '../../../core/workspace';
import { MessageTemplate } from './template.models';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Service for Meta (WhatsApp Business) template operations.
 * Communicates with /api/meta/templates endpoints.
 */
@Injectable({
  providedIn: 'root',
})
export class MetaTemplatesApiService {
  private api = inject(ApiClient);
  private workspaceService = inject(WorkspaceService);

  private readonly BASE = '/meta/templates';

  private withWorkspaceId(path: string): string {
    const workspaceId = this.workspaceService.getCurrentWorkspaceId();
    if (!workspaceId) return path;

    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}workspaceId=${encodeURIComponent(workspaceId)}`;
  }

  /**
   * POST /api/meta/templates/publish/{templateId}
   * Publishes an internal template to Meta for approval.
   */
  publish(templateId: string): Observable<MessageTemplate> {
    return this.api
      .post<ApiResponse<MessageTemplate>>(
        this.withWorkspaceId(`${this.BASE}/publish/${templateId}`),
        {}
      )
      .pipe(
        map((res) => res.data),
        catchError((err) => {
          console.error('[MetaTemplatesApi] publish error:', err);
          throw err;
        })
      );
  }

  /**
   * POST /api/meta/templates/sync
   * Syncs all published templates with Meta to update their approval status.
   */
  syncAll(): Observable<MessageTemplate[]> {
    return this.api
      .post<ApiResponse<MessageTemplate[]>>(
        this.withWorkspaceId(`${this.BASE}/sync`),
        {}
      )
      .pipe(
        map((res) => res.data),
        catchError((err) => {
          console.error('[MetaTemplatesApi] syncAll error:', err);
          return of([]);
        })
      );
  }

  /**
   * GET /api/meta/templates/status/{templateId}
   * Gets the current approval status of a specific template from Meta.
   */
  getStatus(templateId: string): Observable<MessageTemplate> {
    return this.api
      .get<ApiResponse<MessageTemplate>>(
        this.withWorkspaceId(`${this.BASE}/status/${templateId}`)
      )
      .pipe(
        map((res) => res.data),
        catchError((err) => {
          console.error('[MetaTemplatesApi] getStatus error:', err);
          throw err;
        })
      );
  }
}
