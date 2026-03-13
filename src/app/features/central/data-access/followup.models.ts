/**
 * Followup models and types
 */

// Constantes de threshold para geração de fila
export const TODAY_THRESHOLD = 60;
export const SCHEDULE_THRESHOLD = 40;
export const COOLDOWN_DAYS_DEFAULT = 2;

// Keywords que indicam que NÃO deve criar follow-up (anti-ação)
export const COOLDOWN_KEYWORDS = [
  'contato muito recente',
  'contato recente',
  'dar tempo para resposta',
  'dar tempo',
  'aguardar',
  'aguardar resposta',
  'esperar',
];

export type FollowupStatus = 'open' | 'scheduled' | 'done' | 'canceled';
export type FollowupBucket = 'today' | 'overdue' | 'scheduled' | 'done';
export type RecommendedTiming = 'morning' | 'afternoon' | 'evening' | 'this_week';

export interface Followup {
  id: string;
  workspaceId: string;
  clientId: string;
  status: FollowupStatus;
  bucket: FollowupBucket; // Derivado de status + dueDate
  dueDate: string; // ISO date (yyyy-mm-dd)
  priorityScore: number; // 0..100
  reasons: string[]; // Máximo 3 motivos
  primaryReason: string; // Motivo principal (primeiro da lista)
  recommendedTemplateId: string; // Template recomendado (obrigatório)
  recommendedTiming?: RecommendedTiming;
  createdAt: string;
  updatedAt: string;
  completedAt?: string; // ISO date
  // Campos legados (mantidos para compatibilidade, mas podem ser removidos)
  suggestionId?: string;
  snoozedUntil?: string; // ISO date
}

export interface FollowupCandidate {
  score: number; // 0..100
  reasons: string[]; // Max 3
  recommendedTemplateId: string;
  recommendedTiming?: 'now' | 'today' | 'tomorrow' | 'this_week';
  isCooldown?: boolean; // Se true, não criar follow-up
}

export interface CreateFollowupDto {
  clientId: string;
  dueDate: string;
  priorityScore: number;
  reasons: string[];
  recommendedTemplateId: string;
  recommendedTiming?: RecommendedTiming;
  suggestionId?: string; // Opcional (legacy)
}

export interface UpdateFollowupDto {
  status?: FollowupStatus;
  priorityScore?: number;
  reasons?: string[];
  recommendedTemplateId?: string;
  dueDate?: string;
  completedAt?: string;
}

export const FollowupStatusLabels: Record<FollowupStatus, string> = {
  open: 'Aberto',
  scheduled: 'Agendado',
  done: 'Concluído',
  canceled: 'Cancelado'
};

export const FollowupBucketLabels: Record<FollowupBucket, string> = {
  today: 'Hoje',
  overdue: 'Atrasados',
  scheduled: 'Agendadas',
  done: 'Concluídos'
};
