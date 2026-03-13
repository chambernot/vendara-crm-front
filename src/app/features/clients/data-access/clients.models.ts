import { AiScoreResult, AiSuggestion } from '../../../core/ai';

/**
 * Item do breakdown de score (formato retornado pela API)
 */
export interface ScoreBreakdownItem {
  label: string;
  detail?: string; // Detalhes adicionais (ex: data e dias para compra)
  points: number;
}

/**
 * Tier do score (níveis de temperatura)
 */
export type ScoreTier = 'COLD' | 'WARM' | 'HOT';

/**
 * Label do score em português
 */
export type ScoreLabel = 'Baixa' | 'Média' | 'Alta';

export interface Client {
  id: string;
  name: string;
  whatsapp?: string;
  score: number; // 0-100 (valor numérico)
  scoreLabel: ScoreLabel; // "Baixa", "Média", "Alta"
  scoreTier: ScoreTier; // "COLD", "WARM", "HOT"
  scoreBreakdown?: ScoreBreakdownItem[]; // Detalhamento do cálculo do score (vem do backend)
  lastContactAt: string; // ISO string
  lastOutboundAt?: string; // ISO string - última mensagem enviada (outbound)
  lastInboundAt?: string; // ISO string - última mensagem recebida (inbound)
  tags: string[];
  notes?: string;
  // WhatsApp Compliance
  whatsappOptIn: boolean; // Cliente autorizou receber mensagens no WhatsApp
  whatsappOptInAt?: string; // ISO string - quando autorizou
  // Follow-up status
  waitingReply?: boolean; // Cliente está aguardando resposta (aplicado pela sugestão "Aguardar resposta")
}

export interface ClientInsight {
  lastMessageSnippet: string;
  daysSinceLastContact: number;
  lifetimeValue: number;
  lastPurchaseAt?: string;
  totalPurchasedValue: number; // Soma total de todas as vendas
}

/**
 * Tipos de atividades do cliente
 */
export type ClientActivityType = 
  | 'message_sent'
  | 'message_failed' 
  | 'message_received'
  | 'tag_added'
  | 'tag_removed'
  | 'opt_in_enabled'
  | 'opt_in_disabled'
  | 'client_created'
  | 'client_updated';

/**
 * Atividade do cliente
 */
export interface ClientActivity {
  id: string;
  clientId: string;
  type: ClientActivityType;
  text: string;
  createdAt: string; // ISO string
  meta?: Record<string, any>;
}

/**
 * Venda registrada para um cliente
 */
export interface Sale {
  id: string;
  clientId: string;
  amount: number; // Valor da venda em R$ (modelo antigo)
  total?: number; // Valor total da venda (modelo intermediário)
  totalAmount?: number; // Valor total da venda (backend atual - USAR SEMPRE ESTE PRIMEIRO)
  description?: string; // Descrição opcional da venda
  date: string; // ISO string - data da venda
  createdAt: string; // ISO string - quando foi registrado no sistema
}

export interface ClientDetailVm {
  client: Client;
  insight: ClientInsight;
  ai: AiScoreResult;
  suggestions: AiSuggestion[];
  recentActivity: ClientActivity[];
  sales: Sale[]; // Vendas do cliente
}
