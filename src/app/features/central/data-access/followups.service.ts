import { Injectable, inject, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { FollowupsApiService, FollowupSummary, GenerateFollowupsResponse } from './followups-api.service';
import { Followup, FollowupBucket } from './followup.models';

/**
 * Serviço de alto nível para Follow-ups.
 * Provê: carregamento de buckets via endpoint único (summary), geração, loading/error states.
 * Se /summary retornar 404, faz fallback para chamadas individuais por bucket.
 */
@Injectable({
  providedIn: 'root'
})
export class FollowUpsService {
  private api = inject(FollowupsApiService);

  // Signals
  todayItems = signal<Followup[]>([]);
  overdueItems = signal<Followup[]>([]);
  scheduledItems = signal<Followup[]>([]);
  doneItems = signal<Followup[]>([]);
  
  loading = signal(false);
  error = signal<string | null>(null);
  generating = signal(false);
  generateError = signal<string | null>(null);

  /**
   * Retorna Observable com todos os buckets.
   * Tenta GET /api/Followups/summary primeiro.
   * Se receber 404, faz fallback com forkJoin dos 4 buckets individuais.
   */
  summary(): Observable<FollowupSummary> {
    return this.api.summary().pipe(
      catchError((err) => {
        const status = err?.status;
        // Fallback para buckets individuais em erros de servidor (404, 500, 502, 503)
        // Erros de autenticação (401, 403) e validação (400) são propagados
        if (status === 404 || status === 500 || status === 502 || status === 503) {
          console.warn(`⚠️ [FollowUpsService] /summary retornou ${status}, tentando fallback para buckets individuais`);
          return forkJoin({
            today: this.api.getToday().pipe(catchError(() => of([] as Followup[]))),
            overdue: this.api.getOverdue().pipe(catchError(() => of([] as Followup[]))),
            scheduled: this.api.getScheduled().pipe(catchError(() => of([] as Followup[]))),
            done: this.api.getDone().pipe(catchError(() => of([] as Followup[]))),
          }).pipe(
            catchError(() => {
              // Se todos os fallbacks falharem, retornar listas vazias
              console.warn('⚠️ [FollowUpsService] Fallback falhou, retornando listas vazias');
              return of({ today: [], overdue: [], scheduled: [], done: [] } as FollowupSummary);
            })
          );
        }
        throw err;
      })
    );
  }

  /**
   * Carrega todos os buckets de follow-ups via summary() (com fallback automático).
   * Atualiza os signals internos.
   */
  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);

    this.summary().subscribe({
      next: (summary) => {
        this.todayItems.set(summary.today);
        this.overdueItems.set(summary.overdue);
        this.scheduledItems.set(summary.scheduled);
        this.doneItems.set(summary.done);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('❌ [FollowUpsService] Erro ao carregar follow-ups:', err);
        const status = err?.status;
        let errorMsg: string;
        if (status === 400) {
          errorMsg = 'Workspace não selecionado';
        } else if (status === 401) {
          errorMsg = 'Sessão expirada';
        } else {
          errorMsg = err?.error?.message || err?.message || 'Erro ao carregar follow-ups';
        }
        this.error.set(errorMsg);
        this.todayItems.set([]);
        this.overdueItems.set([]);
        this.scheduledItems.set([]);
        this.doneItems.set([]);
        this.loading.set(false);
      }
    });
  }

  /**
   * Carrega um bucket específico via GET /api/Followups?bucket={bucket}
   */
  loadBucket(bucket: FollowupBucket): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.list({ bucket }).subscribe({
      next: (items) => {
        switch (bucket) {
          case 'today': this.todayItems.set(items); break;
          case 'overdue': this.overdueItems.set(items); break;
          case 'scheduled': this.scheduledItems.set(items); break;
          case 'done': this.doneItems.set(items); break;
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error(`❌ [FollowUpsService] Erro ao carregar bucket ${bucket}:`, err);
        this.error.set(err?.error?.message || err?.message || `Erro ao carregar ${bucket}`);
        this.loading.set(false);
      }
    });
  }

  /**
   * Gera follow-ups automaticamente via backend
   * POST /api/Followups/generate-now
   */
  generate(): Observable<GenerateFollowupsResponse> {
    this.generating.set(true);
    this.generateError.set(null);

    return this.api.generateNow().pipe(
      tap((result) => {
        this.generating.set(false);
        // Após gerar, recarregar todos os buckets
        this.loadAll();
      }),
      catchError((err) => {
        this.generating.set(false);
        const status = err?.status;
        let errorMsg: string;
        if (status === 400) {
          errorMsg = 'Workspace não selecionado';
        } else if (status === 401) {
          errorMsg = 'Sessão expirada';
        } else if (status === 403) {
          errorMsg = 'Sem acesso ao ambiente';
        } else {
          errorMsg = err?.error?.message || err?.message || 'Erro ao gerar follow-ups';
        }
        this.generateError.set(errorMsg);
        throw err;
      })
    );
  }
}
