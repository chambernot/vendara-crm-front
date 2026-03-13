import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MessageTemplate, CreateTemplateDto, UpdateTemplateDto } from './template.models';
import { TemplatesApiService, TemplateSuggestion, TemplateSuggestionContext } from './templates-api.service';
import { DEFAULT_TEMPLATES } from './template.seed';
import { TelemetryService } from '../../../core/telemetry';
import { WorkspaceService } from '../../../core/workspace';
import { EventBusService } from '../../../shared/services/event-bus.service';

/**
 * TemplateStore — in-memory cache backed by the /api/templates API.
 *
 * ✅ NO localStorage — all persistence is in MongoDB via the backend.
 * ✅ Signal-based reactive state.
 * ✅ Reloads on workspace switch.
 */
@Injectable({
  providedIn: 'root',
})
export class TemplateStore implements OnDestroy {
  private api = inject(TemplatesApiService);
  private telemetry = inject(TelemetryService);
  private workspaceService = inject(WorkspaceService);
  private eventBus = inject(EventBusService);

  // In-memory cache (replaces localStorage)
  private templatesSignal = signal<MessageTemplate[]>([]);
  private loadingSignal = signal(false);
  private loadedSignal = signal(false);
  private suggestionsSignal = signal<TemplateSuggestion[]>([]);
  private suggestionsLoadingSignal = signal(false);

  private subs: Subscription[] = [];

  // Public computed signals
  allTemplates = computed(() => this.templatesSignal());
  
  activeTemplates = computed(() =>
    this.templatesSignal().filter(t => t.isActive)
  );

  /**
   * Only templates approved by Meta (official WhatsApp Business templates).
   * Use this for sending messages to comply with WhatsApp Business Policy.
   */
  approvedTemplates = computed(() =>
    this.templatesSignal().filter(t => t.isActive && t.meta?.status === 'APPROVED')
  );
  
  loading = computed(() => this.loadingSignal());
  loaded = computed(() => this.loadedSignal());
  suggestions = computed(() => this.suggestionsSignal());
  suggestionsLoading = computed(() => this.suggestionsLoadingSignal());

  /** Top suggestion (first item) */
  topSuggestion = computed(() => this.suggestionsSignal()[0] ?? null);

  constructor() {
    // Load approved templates on startup
    console.log('[TemplateStore] 🚀 Constructor - iniciando carregamento');
    this.loadFromApi();

    // Re-load when workspace changes
    try {
      const sub = this.eventBus.on('workspaceChanged').subscribe(() => {
        console.log('[TemplateStore] 🔄 Workspace changed - recarregando templates');
        this.clearCache();
        this.loadFromApi();
      });
      this.subs.push(sub);
    } catch {
      // EventBus may not have 'workspaceChanged' — silently ignore
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  /**
   * Loads approved templates from the API into the in-memory cache.
   * Only loads templates with status=APPROVED to ensure compliance with Meta requirements.
   * The list endpoint returns bodyPreview (truncated). We fetch full detail
   * for each template to get the complete body.
   */
  loadFromApi(): void {
    const workspace = this.workspaceService.getActive();
    if (!workspace) {
      console.warn('[TemplateStore] ⚠️ No active workspace — skipping load');
      this.loadingSignal.set(false);
      return;
    }

    console.log('[TemplateStore] 🔄 Iniciando carregamento de templates aprovados para workspace:', workspace.id);
    this.loadingSignal.set(true);

    this.api.listApproved().subscribe({
      next: (templates) => {
        console.log('[TemplateStore] ✅ Response recebida da API:', templates);
        console.log('[TemplateStore] 📊 Número de templates:', templates.length);
        
        // Set list immediately (with bodyPreview) for fast UI render
        this.templatesSignal.set(templates);
        console.log('[TemplateStore] Loaded', templates.length, 'APPROVED templates from API');

        if (templates.length > 0) {
          console.log('[TemplateStore] 🔍 Templates recebidos:', templates.map(t => ({ id: t.id, title: t.title, status: t.meta?.status })));
          // Enrich with full body via detail endpoint
          this.enrichWithFullBody(templates);
        } else {
          console.warn('[TemplateStore] ⚠️ No approved templates found. Please configure templates in Meta Business Manager.');
        }
        
        this.loadedSignal.set(true);
        this.loadingSignal.set(false);
      },
      error: (err) => {
        console.error('[TemplateStore] ❌ Failed to load approved templates:', err);
        console.error('[TemplateStore] ❌ Error details:', {
          status: err.status,
          statusText: err.statusText,
          message: err.message,
          error: err.error
        });
        this.templatesSignal.set([]);
        this.loadedSignal.set(true);
        this.loadingSignal.set(false);
      },
    });
  }

  /**
   * Fetches full detail (including complete body) for each template.
   * Updates the in-memory cache in-place when details arrive.
   */
  private enrichWithFullBody(templates: MessageTemplate[]): void {
    const detailRequests = templates.map(t =>
      this.api.getById(t.id).pipe(
        catchError(() => of(null)) // If detail fails, keep the list item as-is
      )
    );

    if (detailRequests.length === 0) return;

    forkJoin(detailRequests).subscribe({
      next: (details) => {
        const enriched = templates.map((t, i) => {
          const detail = details[i];
          if (detail && detail.body) {
            return { ...t, body: detail.body };
          }
          return t;
        });
        this.templatesSignal.set(enriched);
        console.log('[TemplateStore] Enriched', details.filter(Boolean).length, 'templates with full body');
      },
      error: () => {
        // Keep list items as-is (bodyPreview)
        console.warn('[TemplateStore] Failed to enrich templates with full body');
      },
    });
  }

  /**
   * Populates in-memory cache with local DEFAULT_TEMPLATES.
   * Used as fallback when the API is unavailable or returns no data.
   */
  private useFallbackSeed(): void {
    const now = new Date().toISOString();
    const seeded = DEFAULT_TEMPLATES.map((t, i) => ({
      ...t,
      id: `local_${Date.now()}_${i}`,
      createdAt: now,
      updatedAt: now,
    }));
    this.templatesSignal.set(seeded);
    console.log('[TemplateStore] Loaded', seeded.length, 'templates from local fallback');
  }

  /**
   * Clears in-memory cache (called on workspace switch).
   */
  clearCache(): void {
    this.templatesSignal.set([]);
    this.suggestionsSignal.set([]);
    this.loadedSignal.set(false);
  }

  // ---------------------------------------------------------------------------
  // Suggestions
  // ---------------------------------------------------------------------------

  /**
   * Loads template suggestions for a given client+context.
   * Results are stored in `suggestions` / `topSuggestion` signals.
   * Only returns suggestions for APPROVED templates (Meta compliance).
   */
  loadSuggestions(clientId: string, context: TemplateSuggestionContext): void {
    this.suggestionsLoadingSignal.set(true);
    this.suggestionsSignal.set([]);

    this.api.suggestions(clientId, context).subscribe({
      next: (suggestions) => {
        // Filter to only include suggestions for approved templates
        const approvedTemplateIds = this.approvedTemplates().map(t => t.id);
        const approvedSuggestions = suggestions.filter(s => 
          approvedTemplateIds.includes(s.templateId)
        );
        
        this.suggestionsSignal.set(approvedSuggestions);
        this.suggestionsLoadingSignal.set(false);
        console.log('[TemplateStore] Loaded', approvedSuggestions.length, 'APPROVED suggestions (filtered from', suggestions.length, 'total) for', clientId, context);
      },
      error: (err) => {
        console.error('[TemplateStore] Error loading suggestions:', err);
        this.suggestionsSignal.set([]);
        this.suggestionsLoadingSignal.set(false);
      },
    });
  }

  /**
   * Clears current suggestions.
   */
  clearSuggestions(): void {
    this.suggestionsSignal.set([]);
  }

  // ---------------------------------------------------------------------------
  // CRUD — delegates to API, then refreshes in-memory cache
  // ---------------------------------------------------------------------------

  /**
   * Creates a new template via API, then refreshes cache.
   */
  create(dto: CreateTemplateDto): void {
    this.api.create(dto).subscribe({
      next: (created) => {
        this.templatesSignal.update(list => [...list, created]);
        this.telemetry.log('template_created', {
          templateId: created.id,
          tags: created.tags.join(','),
        });
      },
      error: (err) => console.error('[TemplateStore] create error:', err),
    });
  }

  /**
   * Updates an existing template via API, then refreshes cache.
   */
  update(id: string, dto: UpdateTemplateDto): void {
    this.api.update(id, dto).subscribe({
      next: (updated) => {
        this.templatesSignal.update(list =>
          list.map(t => (t.id === id ? updated : t))
        );
        this.telemetry.log('template_updated', { templateId: id });
      },
      error: (err) => console.error('[TemplateStore] update error:', err),
    });
  }

  /**
   * Toggles active/inactive for a template.
   */
  toggleActive(id: string): void {
    const template = this.templatesSignal().find(t => t.id === id);
    if (!template) return;
    this.update(id, { isActive: !template.isActive });
    this.telemetry.log('template_toggled', {
      templateId: id,
      newState: !template.isActive,
    });
  }

  /**
   * Duplicates a template via API create.
   */
  duplicate(id: string): void {
    const original = this.templatesSignal().find(t => t.id === id);
    if (!original) return;

    this.create({
      title: `${original.title} (Cópia)`,
      body: original.body,
      tags: [...original.tags],
      isActive: original.isActive,
    });

    this.telemetry.log('template_duplicated', { originalId: id });
  }

  /**
   * Deletes a template via API.
   */
  delete(id: string): boolean {
    const template = this.templatesSignal().find(t => t.id === id);
    if (!template) return false;

    if (template.isDefault) {
      console.warn('Templates padrão não podem ser removidos');
      return false;
    }

    this.api.delete(id).subscribe({
      next: () => {
        this.templatesSignal.update(list => list.filter(t => t.id !== id));
        this.telemetry.log('template_deleted', { templateId: id });
      },
      error: (err) => console.error('[TemplateStore] delete error:', err),
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getById(id: string): MessageTemplate | null {
    return this.templatesSignal().find(t => t.id === id) || null;
  }

  getByTag(tag: string): MessageTemplate[] {
    return this.approvedTemplates().filter(t => t.tags.includes(tag as any));
  }
}
