import { Injectable, inject, signal, computed } from '@angular/core';
import { WorkspaceService } from '../../../core/workspace';
import {
  Followup,
  CreateFollowupDto,
  UpdateFollowupDto,
  FollowupStatus,
  FollowupCandidate,
  TODAY_THRESHOLD,
  SCHEDULE_THRESHOLD,
  FollowupBucket,
} from './followup.models';

/**
 * Followup Store - gerencia estado de followups com persistência por workspace
 */
@Injectable({
  providedIn: 'root',
})
export class FollowupStore {
  private workspaceService = inject(WorkspaceService);

  private followupsSignal = signal<Followup[]>([]);

  // Computed signals
  followups = computed(() => this.followupsSignal());

  // Followups pendentes (não completados e não adiados para o futuro)
  pendingFollowups = computed(() => {
    const now = new Date();
    return this.followupsSignal()
      .filter(f => (f.status === 'open' || f.status === 'scheduled') && new Date(f.dueDate) <= now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  });

  // Followups atrasados (open e dueDate no passado)
  overdueFollowups = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.followupsSignal()
      .filter(f => f.status === 'open' && new Date(f.dueDate) < today)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  });

  // Followups para hoje
  todayFollowups = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.followupsSignal()
      .filter(f => {
        if (f.status !== 'open') return false;
        const dueDate = new Date(f.dueDate);
        return dueDate >= today && dueDate < tomorrow;
      })
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  });

  // Followups concluídos
  completedFollowups = computed(() => {
    return this.followupsSignal()
      .filter(f => f.status === 'done')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  // Followups adiados (mantido para compatibilidade)
  snoozedFollowups = computed(() => {
    return this.followupsSignal()
      .filter(f => f.status === 'canceled')
      .sort((a, b) => {
        const aDate = a.snoozedUntil ? new Date(a.snoozedUntil).getTime() : 0;
        const bDate = b.snoozedUntil ? new Date(b.snoozedUntil).getTime() : 0;
        return aDate - bDate;
      });
  });

  // Followups agendados (scheduled ou open com dueDate no futuro)
  scheduledFollowups = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.followupsSignal()
      .filter(f => {
        if (f.status === 'done' || f.status === 'canceled') return false;
        const dueDate = new Date(f.dueDate);
        return dueDate >= tomorrow;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  });

  constructor() {
    this.loadFollowups();
  }

  /**
   * Carrega followups do localStorage do workspace atual
   */
  private loadFollowups(): void {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) {
      this.followupsSignal.set([]);
      return;
    }

    const key = this.getStorageKey(currentWorkspace.id);
    const raw = localStorage.getItem(key);
    
    if (!raw) {
      this.followupsSignal.set([]);
      return;
    }

    try {
      const followups = JSON.parse(raw) as Followup[];
      this.followupsSignal.set(followups);
    } catch {
      this.followupsSignal.set([]);
    }
  }

  /**
   * Persiste followups no localStorage
   */
  private saveFollowups(): void {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) return;

    const key = this.getStorageKey(currentWorkspace.id);
    const followups = this.followupsSignal();
    localStorage.setItem(key, JSON.stringify(followups));
  }

  /**
   * Gera chave de storage por workspace
   */
  private getStorageKey(workspaceId: string): string {
    return `vendara_followups_${workspaceId}`;
  }

  /**
   * Gera ID único para followup
   */
  private generateId(): string {
    return `fup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Calcula o bucket baseado em status e dueDate
   */
  private calculateBucket(status: FollowupStatus, dueDate: string): FollowupBucket {
    if (status === 'done') return 'done';
    if (status === 'canceled') return 'done'; // Cancelados também vão para done
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const due = new Date(dueDate);
    
    if (due < today) return 'overdue';
    if (due >= today && due < tomorrow) return 'today';
    return 'scheduled';
  }

  /**
   * Cria um novo followup
   */
  create(dto: CreateFollowupDto): Followup {
    const currentWorkspace = this.workspaceService.getActive();
    if (!currentWorkspace) {
      throw new Error('Nenhum workspace ativo');
    }

    const now = new Date().toISOString();
    const primaryReason = dto.reasons[0] || 'Cliente sem interação recente';
    const bucket = this.calculateBucket('open', dto.dueDate);
    
    const followup: Followup = {
      id: this.generateId(),
      workspaceId: currentWorkspace.id,
      clientId: dto.clientId,
      status: 'open',
      bucket,
      dueDate: dto.dueDate,
      priorityScore: dto.priorityScore,
      reasons: dto.reasons,
      primaryReason,
      recommendedTemplateId: dto.recommendedTemplateId,
      recommendedTiming: dto.recommendedTiming,
      createdAt: now,
      updatedAt: now,
      // Campos legados (opcional)
      suggestionId: dto.suggestionId,
    };

    const followups = [...this.followupsSignal(), followup];
    this.followupsSignal.set(followups);
    this.saveFollowups();

    return followup;
  }

  /**
   * Atualiza um followup
   */
  update(id: string, dto: UpdateFollowupDto): Followup | null {
    const followups = this.followupsSignal();
    const index = followups.findIndex(f => f.id === id);
    
    if (index === -1) return null;

    const updated: Followup = {
      ...followups[index],
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    const newFollowups = [...followups];
    newFollowups[index] = updated;
    this.followupsSignal.set(newFollowups);
    this.saveFollowups();

    return updated;
  }

  /**
   * Marca followup como concluído
   */
  complete(id: string): Followup | null {
    return this.update(id, {
      status: 'done',
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Adia followup para uma data futura (mantido para compatibilidade)
   */
  snooze(id: string, until: string): Followup | null {
    return this.update(id, {
      status: 'scheduled',
      dueDate: until,
    });
  }

  /**
   * Reativa followup adiado
   */
  unsnooze(id: string): Followup | null {
    return this.update(id, {
      status: 'open',
    });
  }

  /**
   * Marca followup como done
   */
  markDone(id: string): Followup | null {
    return this.complete(id);
  }

  /**
   * Reagendar followup
   */
  reschedule(id: string, newDueDate: string): Followup | null {
    return this.update(id, {
      dueDate: newDueDate,
      status: 'scheduled',
    });
  }

  /**
   * Busca followup por ID
   */
  getById(id: string): Followup | null {
    return this.followupsSignal().find(f => f.id === id) || null;
  }

  /**
   * Busca followups de um cliente
   */
  getByClientId(clientId: string): Followup[] {
    return this.followupsSignal()
      .filter(f => f.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Busca followup por suggestionId
   */
  getBySuggestionId(suggestionId: string): Followup | null {
    return this.followupsSignal().find(f => f.suggestionId === suggestionId) || null;
  }

  /**
   * Cria ou atualiza um followup baseado em clientId
   * Se já existir um followup open/scheduled para o mesmo cliente, atualiza
   * Se não existir, cria um novo
   * EVITA DUPLICAÇÃO DE FOLLOW-UPS ATIVOS PARA O MESMO CLIENTE
   */
  createOrUpdate(dto: CreateFollowupDto): Followup {
    // Buscar followup ativo existente para este cliente
    const existingFollowup = this.followupsSignal().find(
      f => f.clientId === dto.clientId && 
           (f.status === 'open' || f.status === 'scheduled')
    );

    if (existingFollowup) {
      // Atualizar existente: mesclar reasons, atualizar score, template, etc
      const mergedReasons = this.mergeReasons(existingFollowup.reasons, dto.reasons);
      const maxScore = Math.max(existingFollowup.priorityScore, dto.priorityScore);
      const newStatus: FollowupStatus = 'open'; // Reabrir se estava scheduled
      
      // Atualizar dueDate apenas se o novo for mais urgente (antes)
      const newDueDate = new Date(dto.dueDate) < new Date(existingFollowup.dueDate)
        ? dto.dueDate
        : existingFollowup.dueDate;
      
      const updated = this.update(existingFollowup.id, {
        status: newStatus,
        priorityScore: maxScore,
        reasons: mergedReasons,
        recommendedTemplateId: dto.recommendedTemplateId,
        dueDate: newDueDate,
      });
      
      return updated!;
    }

    // Criar novo
    return this.create(dto);
  }

  /**
   * Mescla reasons sem duplicar (max 3)
   */
  private mergeReasons(existing: string[], newReasons: string[]): string[] {
    const merged = [...existing];
    
    for (const reason of newReasons) {
      if (!merged.includes(reason)) {
        merged.push(reason);
      }
    }
    
    return merged.slice(0, 3);
  }

  /**
   * Upsert a partir de um FollowupCandidate (usado pela geração de fila)
   */
  upsertFromCandidate(
    clientId: string,
    candidate: FollowupCandidate,
    timing: 'today' | 'scheduled' = 'today'
  ): Followup | null {
    // Se candidato indica cooldown, não criar follow-up
    if (candidate.isCooldown) {
      return null;
    }

    // Aplicar threshold
    if (candidate.score < SCHEDULE_THRESHOLD) {
      // Score muito baixo, não criar
      return null;
    }

    // Determinar dueDate baseado no score e timing
    const dueDate = this.calculateDueDateFromScore(candidate.score, timing);
    
    const dto: CreateFollowupDto = {
      clientId,
      dueDate: dueDate.toISOString().split('T')[0], // yyyy-mm-dd
      priorityScore: candidate.score,
      reasons: candidate.reasons,
      recommendedTemplateId: candidate.recommendedTemplateId,
      recommendedTiming: this.convertTimingToRecommended(candidate.recommendedTiming),
    };

    return this.createOrUpdate(dto);
  }

  /**
   * Calcula dueDate baseado em score e timing recomendado
   */
  private calculateDueDateFromScore(score: number, timing: 'today' | 'scheduled'): Date {
    const now = new Date();
    
    if (score >= TODAY_THRESHOLD || timing === 'today') {
      // Score alto -> Hoje
      return now;
    }
    
    // Score médio -> Agendar para amanhã ou +2 dias
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + 2);
    return scheduledDate;
  }

  /**
   * Converte timing da IA para RecommendedTiming
   */
  private convertTimingToRecommended(
    timing?: 'now' | 'today' | 'tomorrow' | 'this_week'
  ): 'morning' | 'afternoon' | 'evening' | 'this_week' | undefined {
    if (!timing) return undefined;
    
    switch (timing) {
      case 'now':
      case 'today':
        return 'morning';
      case 'tomorrow':
        return 'afternoon';
      case 'this_week':
        return 'this_week';
      default:
        return undefined;
    }
  }

  /**
   * Remove um followup
   */
  delete(id: string): boolean {
    const followups = this.followupsSignal();
    const filtered = followups.filter(f => f.id !== id);
    
    if (filtered.length === followups.length) return false;

    this.followupsSignal.set(filtered);
    this.saveFollowups();
    return true;
  }

  /**
   * Limpa todos os followups do workspace atual
   */
  clear(): void {
    this.followupsSignal.set([]);
    this.saveFollowups();
  }

  /**
   * Recarrega followups do storage
   */
  reload(): void {
    this.loadFollowups();
  }

  /**
   * Retorna estatísticas de followups
   */
  getStats() {
    const followups = this.followupsSignal();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      total: followups.length,
      pending: followups.filter(f => f.status === 'open' || f.status === 'scheduled').length,
      overdue: followups.filter(f => f.status === 'open' && new Date(f.dueDate) < today).length,
      today: this.todayFollowups().length,
      completed: followups.filter(f => f.status === 'done').length,
      snoozed: followups.filter(f => f.status === 'canceled').length,
    };
  }

  /**
   * Retorna os buckets de follow-ups (hoje, atrasados, agendados, concluídos)
   */
  getBuckets() {
    return {
      today: this.todayFollowups(),
      overdue: this.overdueFollowups(),
      scheduled: this.scheduledFollowups(),
      done: this.completedFollowups(),
    };
  }
}
