/**
 * AI Score Result - Resultado da análise de score
 */
export interface AiScoreResult {
  score: number; // 0..100
  level: 'high' | 'medium' | 'low';
  reasons: AiScoreReason[];
  updatedAt: string; // ISO date
}

/**
 * Razão que contribuiu para o score
 */
export interface AiScoreReason {
  code: string;
  text: string;
  weight: number;
}

/**
 * Tipos de ação que uma sugestão pode executar
 */
export type SuggestionActionType = 'send_message' | 'offer_product' | 'wait' | 'ask_budget' | 'post_sale' | 'MULTI';

/**
 * Payload de ação para criar follow-up
 */
export interface SuggestionFollowupPayload {
  dueAt: string; // 'hoje', '+2 dias', '+7 dias'
  reason: string;
  templateId: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Payload de ação para aplicar tag
 */
export interface SuggestionTagPayload {
  name: string;
}

/**
 * Payload de ação para abrir composer
 */
export interface SuggestionComposerPayload {
  templateId: string;
}

/**
 * Payload completo de ações de uma sugestão
 */
export interface SuggestionActionPayload {
  followup?: SuggestionFollowupPayload;
  tag?: SuggestionTagPayload;
  composer?: SuggestionComposerPayload;
}

/**
 * Sugestão gerada pela IA
 */
export interface AiSuggestion {
  id: string;
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  action: SuggestionActionType;
  // Novos campos para recomendações inteligentes
  recommendedTemplateId?: string;
  recommendedReasonText?: string;
  recommendedTiming?: 'now' | 'today' | 'tomorrow' | 'this_week';
  followupPriorityScore: number; // 0..100
  // Payload de ações (para implementar botão "Aplicar")
  payload?: SuggestionActionPayload;
}

/**
 * Sinais de contexto para análise da IA
 */
export interface AiContextSignal {
  daysSinceLastContact: number;
  hasNegotiatingTag: boolean;
  hasBoughtBefore: boolean;
  lifetimeValue: number;
  lastMessageIntent?: 'price' | 'gift' | 'delivery' | 'other';
  daysSinceLastPurchase?: number; // undefined se nunca comprou
}

/**
 * Resultado completo da análise de IA
 */
export interface AiClientAnalysis {
  score: AiScoreResult;
  suggestions: AiSuggestion[];
}

/**
 * Efeitos da aplicação de uma sugestão
 */
export interface SuggestionApplicationEffects {
  createdFollowupId?: string;
  openedComposer?: boolean;
  sentMessageId?: string; // ID da mensagem enviada ao aplicar sugestão
  tagsAdded?: string[];
  updatedClientFields?: Partial<{ waitingReply: boolean; lastContactAt: string }>; // Campos do cliente que foram atualizados
  followupStatus?: 'IN_PROGRESS' | 'DONE'; // Status do follow-up após aplicação
}

/**
 * Registro de aplicação de uma sugestão
 */
export interface SuggestionApplication {
  id: string;
  clientId: string;
  suggestionId: string;
  appliedAt: string; // ISO timestamp
  status: 'SUCCESS' | 'FAILED';
  effects: SuggestionApplicationEffects;
}
