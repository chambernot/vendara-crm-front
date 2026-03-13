import { AiSuggestion } from '../../../core/ai';

export type FollowupReason = "pediu_preco" | "sumiu" | "presente" | "novidades" | "pos_venda" | "awaiting_customer_reply";

export interface FollowupItemVm {
  clientId: string;
  clientName: string;
  score: number;
  daysSinceLastContact: number;
  reason: FollowupReason;
  suggestedTemplateId: string;
  // Novos campos da IA
  suggestion?: AiSuggestion;
  dueDate?: string;
  followupId?: string;
  completedAt?: string; // Data de conclusão do followup
}

export const FOLLOWUP_REASON_LABELS: Record<FollowupReason, string> = {
  pediu_preco: "Pediu preço",
  sumiu: "Sumiu",
  presente: "Presente",
  novidades: "Novidades",
  pos_venda: "Pós-venda",
  awaiting_customer_reply: "Aguardar resposta do cliente",
};
