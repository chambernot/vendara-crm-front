import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ApiClient } from '../../../core/api';
import { MessageTemplate, CreateTemplateDto, UpdateTemplateDto } from './template.models';
import { DEFAULT_TEMPLATES } from './template.seed';
import { WorkspaceService } from '../../../core/workspace';

// ---------------------------------------------------------------------------
// DTOs & Response types
// ---------------------------------------------------------------------------

export interface TemplateSuggestion {
  templateId: string;
  templateName: string;
  code: string;
  reason: string;
  score: number;
  previewBody: string;
}

export interface TemplateSuggestionsResponse {
  suggestions: TemplateSuggestion[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ---------------------------------------------------------------------------
// Context types for template suggestions
// ---------------------------------------------------------------------------
export type TemplateSuggestionContext =
  | 'NEEDS_REPLY'
  | 'NO_RESPONSE_48H'
  | 'POST_SALE'
  | 'PECA_PARADA'
  | 'GENERAL';

/**
 * Service for communicating with the /api/templates backend endpoints.
 * All templates are persisted in MongoDB — no localStorage.
 */
@Injectable({
  providedIn: 'root',
})
export class TemplatesApiService {
  private api = inject(ApiClient);
  private workspaceService = inject(WorkspaceService);

  private readonly BASE = '/templates';

  private withWorkspaceId(path: string): string {
    const workspaceId = this.workspaceService.getCurrentWorkspaceId();
    if (!workspaceId) return path;

    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}workspaceId=${encodeURIComponent(workspaceId)}`;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * GET /api/templates — lista todos os templates do workspace ativo.
   * NOTE: This endpoint returns bodyPreview (truncated). normalizeTemplate() uses it as body.
   */
  list(): Observable<MessageTemplate[]> {
    return this.api.get<ApiResponse<MessageTemplate[]>>(this.withWorkspaceId(this.BASE)).pipe(
      map(res => this.normalizeList(res)),
      catchError(err => {
        console.error('[TemplatesApi] list error:', err);
        return of([]);
      }),
    );
  }

  /**
   * GET /api/templates?includeInactive=false&status=approved — lista apenas templates aprovados pelo Meta.
   * Usado para garantir que apenas templates aprovados sejam mostrados ao usuário.
   * WorkspaceId é enviado via header x-workspace-id pelo interceptor.
   * 
   * WORKAROUND: O backend filtra por status=approved mas não retorna o campo meta.
   * Assumimos que todos os templates desta resposta estão aprovados.
   */
  listApproved(): Observable<MessageTemplate[]> {
    const url = `${this.BASE}?includeInactive=false&status=approved`;
    console.log('[TemplatesApi] 🔍 Chamando:', url);
    
    return this.api.get<ApiResponse<MessageTemplate[]>>(url).pipe(
      tap(rawResponse => {
        console.log('[TemplatesApi] 📦 Raw response recebida:', rawResponse);
      }),
      map(res => {
        const normalized = this.normalizeList(res);
        
        // WORKAROUND: Force meta.status = APPROVED for all templates from this endpoint
        // since the backend filters by status=approved but doesn't include the meta field
        const withApprovedStatus = normalized.map(t => ({
          ...t,
          meta: {
            ...t.meta,
            status: 'APPROVED' as const,
            name: t.meta?.name,
            rejectionReason: t.meta?.rejectionReason,
            lastSyncedAt: t.meta?.lastSyncedAt ?? new Date().toISOString(),
          }
        }));
        
        console.log('[TemplatesApi] 🔄 Após normalização com status forçado:', withApprovedStatus);
        return withApprovedStatus;
      }),
      tap(templates => {
        console.log(`[TemplatesApi] ✅ Retornando ${templates.length} approved templates`);
        if (templates.length > 0) {
          console.log('[TemplatesApi] 📋 Templates:', templates.map(t => ({ 
            id: t.id, 
            title: t.title, 
            status: t.meta?.status,
            isActive: t.isActive 
          })));
        }
      }),
      catchError(err => {
        console.error('[TemplatesApi] ❌ listApproved error:', err);
        return of([]);
      }),
    );
  }

  /**
   * GET /api/templates/:id — retorna template com body completo + variáveis.
   */
  getById(id: string): Observable<MessageTemplate> {
    return this.api.get<ApiResponse<MessageTemplate>>(this.withWorkspaceId(`${this.BASE}/${id}`)).pipe(
      map(res => this.normalizeOne(res)),
      catchError(err => {
        console.error('[TemplatesApi] getById error:', err);
        throw err;
      }),
    );
  }

  /**
   * POST /api/templates — cria novo template
   */
  create(dto: CreateTemplateDto): Observable<MessageTemplate> {
    const payload = { ...dto, tags: this.denormalizeTags(dto.tags ?? []) };
    return this.api.post<ApiResponse<MessageTemplate>>(this.withWorkspaceId(this.BASE), payload).pipe(
      map(res => this.normalizeOne(res)),
      tap(t => console.log('[TemplatesApi] created:', t.id)),
    );
  }

  /**
   * PUT /api/templates/:id — atualiza template existente
   */
  update(id: string, dto: UpdateTemplateDto): Observable<MessageTemplate> {
    const payload = { ...dto };
    if (payload.tags) {
      payload.tags = this.denormalizeTags(payload.tags) as any;
    }
    return this.api.put<ApiResponse<MessageTemplate>>(this.withWorkspaceId(`${this.BASE}/${id}`), payload).pipe(
      map(res => this.normalizeOne(res)),
    );
  }

  /**
   * DELETE /api/templates/:id
   */
  delete(id: string): Observable<void> {
    return this.api.delete<any>(this.withWorkspaceId(`${this.BASE}/${id}`)).pipe(
      map(() => void 0),
    );
  }

  // ---------------------------------------------------------------------------
  // Seed & Suggestions
  // ---------------------------------------------------------------------------

  /**
   * POST /api/templates/seed — seeds default templates for the workspace.
   * Idempotent: backend skips if templates already exist.
   * Sends the default template data so the backend can create them.
   */
  seed(): Observable<MessageTemplate[]> {
    const seedPayload = {
      templates: DEFAULT_TEMPLATES.map(t => ({
        title: t.title,
        body: t.body,
        // Enviar tags no formato do backend
        tags: this.denormalizeTags(t.tags as unknown as string[]),
        isActive: t.isActive,
        isDefault: t.isDefault,
      })),
    };
    return this.api.post<ApiResponse<MessageTemplate[]>>(this.withWorkspaceId(`${this.BASE}/seed`), seedPayload).pipe(
      map(res => this.normalizeList(res)),
      catchError(err => {
        console.warn('[TemplatesApi] seed error (may already be seeded):', err);
        return of([]);
      }),
    );
  }

  /**
   * GET /api/templates/suggestions?clientId=...&context=...
   * Returns ranked template suggestions for the given client+context.
   */
  suggestions(clientId: string, context: TemplateSuggestionContext): Observable<TemplateSuggestion[]> {
    const params = `?clientId=${encodeURIComponent(clientId)}&context=${encodeURIComponent(context)}`;
    return this.api.get<ApiResponse<TemplateSuggestionsResponse>>(this.withWorkspaceId(`${this.BASE}/suggestions${params}`)).pipe(
      map(res => {
        const data = this.extractData(res);
        const list: any[] = (data as any)?.suggestions ?? data ?? [];
        return list.map(s => this.normalizeSuggestion(s));
      }),
      catchError(err => {
        console.warn('[TemplatesApi] suggestions error:', err);
        return of([]);
      }),
    );
  }

  /**
   * Normaliza sugestão vinda do backend.
   */
  private normalizeSuggestion(raw: any): TemplateSuggestion {
    return {
      templateId: raw.templateId ?? raw.template_id ?? '',
      code: raw.code ?? raw.Code ?? '',
      templateName: raw.templateName ?? raw.name ?? raw.Name ?? '',
      score: raw.score ?? raw.Score ?? 0,
      reason: raw.reason ?? raw.Reason ?? '',
      previewBody: raw.previewBody ?? raw.preview_body ?? raw.body ?? '',
    };
  }

  // ---------------------------------------------------------------------------
  // Normalization helpers — handles both wrapped {success,data} and raw arrays
  // ---------------------------------------------------------------------------

  private normalizeList(res: any): MessageTemplate[] {
    const data = this.extractData(res);
    const list = Array.isArray(data) ? data : [];
    return list.map(item => this.normalizeTemplate(item)).filter(t => this.isValidTemplate(t));
  }

  private normalizeOne(res: any): MessageTemplate {
    const data = this.extractData(res);
    return this.normalizeTemplate(data);
  }

  private extractData(res: any): any {
    if (res && typeof res === 'object' && 'data' in res) return res.data;
    return res;
  }

  /**
   * Normalizes backend DTO to frontend MessageTemplate.
   * Handles _id → id mapping (MongoDB), PascalCase, camelCase,
   * and list-endpoint quirks (bodyPreview, isSystem, context-based tags).
   */
  private normalizeTemplate(raw: any): MessageTemplate {
    // Body: list endpoint returns "bodyPreview"; detail endpoint returns "body"
    const body =
      raw.body ?? raw.Body ??
      raw.bodyPreview ?? raw.BodyPreview ??
      raw.content ?? raw.Content ??
      raw.text ?? raw.Text ?? '';

    // Tags: backend may return context-style tags (NEEDS_REPLY, POST_SALE, etc.)
    // Map them to frontend FollowupReason values when possible
    const rawTags: string[] = raw.tags ?? raw.Tags ?? [];
    const tags = rawTags.map(t => this.normalizeTag(t)).filter(Boolean);

    // Meta WhatsApp Business template information
    // Try multiple possible field names
    let meta: MessageTemplate['meta'] = undefined;
    const rawMeta = raw.meta ?? raw.Meta ?? raw.metadata ?? raw.Metadata ?? raw.whatsappMeta ?? raw.whatsapp_meta;
    
    if (rawMeta) {
      meta = {
        name: rawMeta.name ?? rawMeta.Name,
        status: rawMeta.status ?? rawMeta.Status ?? 'NONE',
        rejectionReason: rawMeta.rejectionReason ?? rawMeta.RejectionReason,
        lastSyncedAt: rawMeta.lastSyncedAt ?? rawMeta.LastSyncedAt,
      };
    }

    // Determine isActive: Meta APPROVED templates should always be active
    const metaIsApproved = (meta?.status === 'APPROVED');
    let isActive = raw.isActive ?? raw.IsActive ?? raw.is_active;
    
    // If isActive is explicitly false but template is approved, force it to true
    if (metaIsApproved && (isActive === false || isActive === undefined || isActive === null)) {
      isActive = true;
    } else if (isActive === undefined || isActive === null) {
      isActive = true; // Default to true if not specified
    }

    const normalized = {
      id: raw._id ?? raw.id ?? raw.Id ?? '',
      title: raw.title ?? raw.Title ?? raw.name ?? raw.Name ?? '',
      body,
      tags: tags as any[],
      backendTags: rawTags,
      isActive,
      isDefault: raw.isDefault ?? raw.IsDefault ?? raw.isSystem ?? raw.IsSystem ?? raw.is_default ?? false,
      createdAt: raw.createdAt ?? raw.CreatedAt ?? raw.created_at ?? new Date().toISOString(),
      updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? raw.updated_at ?? new Date().toISOString(),
      meta,
    };
    
    return normalized;
  }

  /**
   * Maps backend tag/context strings to frontend FollowupReason values.
   * Accepts both backend context format and legacy FollowupReason format.
   */
  private normalizeTag(tag: string): string {
    const lower = tag.toLowerCase().trim();

    // Backend context strings → FollowupReason
    const contextMap: Record<string, string> = {
      'needs_reply': 'pediu_preco',
      'no_response_48h': 'sumiu',
      'post_sale': 'pos_venda',
      'peca_parada': 'novidades',
      'general': 'novidades',
      // Backend seed codes
      'portfolio': 'novidades',
      'resposta_padrao': 'pediu_preco',
      'reengajar_leve': 'sumiu',
      'pos_venda': 'pos_venda',
      'post_venda': 'pos_venda',
      'promocao': 'novidades',
      'cobranca_leve': 'pediu_preco',
      'presente': 'presente',
    };

    // Already a valid FollowupReason?
    const validReasons = ['pediu_preco', 'sumiu', 'presente', 'novidades', 'pos_venda', 'awaiting_customer_reply'];
    if (validReasons.includes(lower)) {
      return lower;
    }

    return contextMap[lower] ?? '';
  }

  /**
   * Reverse-maps frontend FollowupReason tags to backend tag format.
   * Used when creating/updating templates to send backend-compatible tags.
   */
  denormalizeTag(tag: string): string {
    const reverseMap: Record<string, string> = {
      'pediu_preco': 'NEEDS_REPLY',
      'sumiu': 'NO_RESPONSE_48H',
      'pos_venda': 'POST_SALE',
      'novidades': 'PORTFOLIO',
      'presente': 'PRESENTE',
      'awaiting_customer_reply': 'GENERAL',
    };
    return reverseMap[tag.toLowerCase()] ?? tag.toUpperCase();
  }

  /**
   * Converts CreateTemplateDto tags from frontend format to backend format.
   */
  private denormalizeTags(tags: string[]): string[] {
    return tags.map(t => this.denormalizeTag(t));
  }

  /**
   * Returns true if a template has valid data (non-empty title).
   * Used to filter out ghost records from bad normalization.
   */
  private isValidTemplate(template: MessageTemplate): boolean {
    return !!(template.title && template.title.trim().length > 0);
  }
}
