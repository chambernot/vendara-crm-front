import { FollowupReason } from './central.models';

// ---------------------------------------------------------------------------
// Template Context (para sugestões)
// ---------------------------------------------------------------------------
export type TemplateContext = 'NEEDS_REPLY' | 'NO_RESPONSE_48H' | 'POST_SALE' | 'PECA_PARADA';

// ---------------------------------------------------------------------------
// MessageTemplateDto — interface canônica vinda do backend
// ---------------------------------------------------------------------------
export interface MessageTemplateDto {
  id: string;
  code: string;
  name: string;
  category: string;
  channel: 'SIMULATOR' | 'WHATSAPP' | 'ANY';
  body: string;
  variables: string[];
  isActive: boolean;
  isSystem: boolean;
}

// ---------------------------------------------------------------------------
// TemplateSuggestionDto — resposta de GET /api/templates/suggestions
// ---------------------------------------------------------------------------
export interface TemplateSuggestionDto {
  templateId: string;
  code: string;
  name: string;
  score: number;
  reason: string;
  previewBody: string;
}

// ---------------------------------------------------------------------------
// Meta Template Status
// ---------------------------------------------------------------------------
export type MetaTemplateStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';

// ---------------------------------------------------------------------------
// MessageTemplate — interface interna do frontend (mantida para compatibilidade)
// ---------------------------------------------------------------------------
export interface MessageTemplate {
  id: string;
  title: string;
  body: string; // com placeholders: {{primeiro_nome}}, {{nome_completo}}, {{produto}}, {{preco}}
  /**
   * Tags normalizadas para o modelo antigo do frontend (usado pela Central / follow-ups).
   * Ex.: pediu_preco, sumiu, pos_venda...
   */
  tags: FollowupReason[];
  /**
   * Tags reais do backend (persistidas no banco).
   * Ex.: NEEDS_REPLY, NO_RESPONSE_48H, POST_SALE, PORTFOLIO...
   */
  backendTags?: string[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Meta (WhatsApp Business) template information
   */
  meta?: {
    name?: string; // Meta template name (e.g. "vendara_xxx")
    status?: MetaTemplateStatus; // Approval status
    rejectionReason?: string; // Reason if rejected
    lastSyncedAt?: string; // Last time status was synced
  };
}

export interface CreateTemplateDto {
  title: string;
  body: string;
  /** Tags no formato do backend (strings) */
  tags: string[];
  isActive: boolean;
}

export interface UpdateTemplateDto {
  title?: string;
  body?: string;
  /** Tags no formato do backend (strings) */
  tags?: string[];
  isActive?: boolean;
}
