import { AiContextSignal, AiScoreReason, AiScoreResult, AiSuggestion } from './ai.models';

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calcula o score baseado nos sinais de contexto
 */
export function computeScore(signals: AiContextSignal): AiScoreResult {
  let score = 30; // base score
  const reasons: AiScoreReason[] = [];

  // Score based on recency of contact
  const recencyBonus = clamp((10 - signals.daysSinceLastContact) * 4, -20, 20);
  if (recencyBonus !== 0) {
    score += recencyBonus;
    reasons.push({
      code: 'RECENCY',
      text: signals.daysSinceLastContact <= 3
        ? 'Contato muito recente (alta relevância)'
        : signals.daysSinceLastContact <= 7
        ? 'Contato recente'
        : 'Contato há mais tempo (reduz relevância)',
      weight: recencyBonus
    });
  }

  // Negotiating tag bonus
  if (signals.hasNegotiatingTag) {
    score += 20;
    reasons.push({
      code: 'NEGOTIATING',
      text: 'Cliente está em negociação ativa',
      weight: 20
    });
  }

  // Previous purchase bonus
  if (signals.hasBoughtBefore) {
    score += 10;
    reasons.push({
      code: 'REPEAT_CUSTOMER',
      text: 'Cliente já comprou anteriormente',
      weight: 10
    });
  }

  // Purchase boost (MVP) - recent purchase increases score significantly
  if (signals.daysSinceLastPurchase !== undefined) {
    let purchaseBoost = 0;
    let purchaseText = '';

    if (signals.daysSinceLastPurchase === 0) {
      purchaseBoost = 30;
      purchaseText = 'Compra realizada hoje (alta prioridade)';
    } else if (signals.daysSinceLastPurchase <= 7) {
      purchaseBoost = 25;
      purchaseText = `Compra recente (${signals.daysSinceLastPurchase} ${signals.daysSinceLastPurchase === 1 ? 'dia' : 'dias'} atrás)`;
    } else if (signals.daysSinceLastPurchase <= 30) {
      purchaseBoost = 15;
      purchaseText = `Compra no último mês (${signals.daysSinceLastPurchase} dias atrás)`;
    }

    if (purchaseBoost > 0) {
      score += purchaseBoost;
      reasons.push({
        code: 'PURCHASE_BOOST',
        text: purchaseText,
        weight: purchaseBoost
      });
    }
  }

  // High lifetime value bonus
  if (signals.lifetimeValue > 500) {
    score += 10;
    reasons.push({
      code: 'HIGH_VALUE',
      text: 'Cliente de alto valor (LTV > R$ 500)',
      weight: 10
    });
  }

  // Message intent bonus
  if (signals.lastMessageIntent) {
    let intentBonus = 0;
    let intentText = '';

    switch (signals.lastMessageIntent) {
      case 'price':
        intentBonus = 10;
        intentText = 'Última mensagem sobre preço (alta intenção)';
        break;
      case 'gift':
        intentBonus = 12;
        intentText = 'Última mensagem sobre presente (urgência)';
        break;
      case 'delivery':
        intentBonus = 8;
        intentText = 'Última mensagem sobre entrega';
        break;
      case 'other':
        intentBonus = 0;
        break;
    }

    if (intentBonus > 0) {
      score += intentBonus;
      reasons.push({
        code: `INTENT_${signals.lastMessageIntent.toUpperCase()}`,
        text: intentText,
        weight: intentBonus
      });
    }
  }

  // Final clamping
  score = clamp(score, 0, 100);

  // Determine level
  let level: 'high' | 'medium' | 'low';
  if (score >= 70) {
    level = 'high';
  } else if (score >= 40) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    score: Math.round(score),
    level,
    reasons,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Gera sugestões baseadas nos sinais de contexto
 */
export function computeSuggestions(signals: AiContextSignal): AiSuggestion[] {
  const suggestions: AiSuggestion[] = [];
  let suggestionId = 1;

  // Suggestion based on negotiating status
  if (signals.hasNegotiatingTag && signals.daysSinceLastContact <= 2) {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Fechar negociação em andamento',
      reason: 'Cliente em negociação com contato recente',
      priority: 'high',
      action: 'MULTI',
      recommendedTemplateId: 'closing_deal',
      recommendedReasonText: 'Cliente demonstrou interesse recente e está em fase de decisão. Momento ideal para reforçar a oferta.',
      recommendedTiming: 'now',
      followupPriorityScore: 95,
      payload: {
        tag: { name: 'negociando' },
        followup: {
          dueAt: 'hoje',
          reason: 'Fechar negociação em andamento',
          templateId: 'closing_deal',
          priority: 'high'
        },
        composer: { templateId: 'closing_deal' }
      }
    });
  }

  // Suggestion based on message intent
  if (signals.lastMessageIntent === 'price') {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Enviar proposta de preço personalizada',
      reason: 'Cliente demonstrou interesse em preço',
      priority: 'high',
      action: 'send_message',
      recommendedTemplateId: 'price_offer',
      recommendedReasonText: 'Cliente perguntou sobre preço, indicando intenção de compra. Resposta rápida aumenta conversão.',
      recommendedTiming: 'now',
      followupPriorityScore: 92
    });
  }

  if (signals.lastMessageIntent === 'gift') {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Oferecer opções de presente',
      reason: 'Cliente procurando presente (ocasião especial)',
      priority: 'high',
      action: 'offer_product',
      recommendedTemplateId: 'gift_options',
      recommendedReasonText: 'Cliente busca presente, possivelmente com data limite. Urgência alta para não perder a oportunidade.',
      recommendedTiming: 'now',
      followupPriorityScore: 90
    });
  }

  if (signals.lastMessageIntent === 'delivery') {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Confirmar prazo de entrega',
      reason: 'Cliente perguntou sobre entrega',
      priority: 'medium',
      action: 'send_message',
      recommendedTemplateId: 'delivery_info',
      recommendedReasonText: 'Dúvida sobre entrega pode ser barreira para compra. Esclarecer aumenta confiança.',
      recommendedTiming: 'today',
      followupPriorityScore: 75
    });
  }

  // Suggestion for high-value customers
  if (signals.lifetimeValue > 500 && signals.daysSinceLastContact > 30) {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Reativar cliente de alto valor',
      reason: 'Cliente valioso sem contato há mais de 30 dias',
      priority: 'high',
      action: 'send_message',
      recommendedTemplateId: 'vip_reactivation',
      recommendedReasonText: 'Cliente VIP inativo. Reativação pode recuperar vendas de alto ticket.',
      recommendedTiming: 'today',
      followupPriorityScore: 85
    });
  }

  // Suggestion for repeat customers
  if (signals.hasBoughtBefore && signals.daysSinceLastContact > 60) {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Oferecer novidades ou promoção',
      reason: 'Cliente que já comprou, sem contato há muito tempo',
      priority: 'medium',
      action: 'offer_product',
      recommendedTemplateId: 'new_collection',
      recommendedReasonText: 'Cliente com histórico de compra mas inativo. Novidades podem despertar interesse.',
      recommendedTiming: 'this_week',
      followupPriorityScore: 65
    });
  }

  // Post-sale follow-up for recent buyers (HIGH PRIORITY)
  if (signals.daysSinceLastPurchase !== undefined && signals.daysSinceLastPurchase <= 7) {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Fazer pós-venda',
      reason: `Cliente comprou há ${signals.daysSinceLastPurchase} ${signals.daysSinceLastPurchase === 1 ? 'dia' : 'dias'}`,
      priority: 'high',
      action: 'post_sale',
      recommendedTemplateId: 'post_sale',
      recommendedReasonText: 'Pós-venda em momento certo fortalece relacionamento e gera recomendações. Considere criar follow-up para +7 dias.',
      recommendedTiming: 'today',
      followupPriorityScore: 95,
      payload: {
        followup: {
          dueAt: '+7 dias',
          reason: 'Pós-venda',
          templateId: 'post_sale',
          priority: 'medium'
        },
        composer: { templateId: 'post_sale' }
      }
    });
  } else if (signals.hasBoughtBefore && signals.daysSinceLastContact <= 7) {
    // Keep existing lower-priority post-sale suggestion for older purchases
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Fazer pós-venda',
      reason: 'Cliente comprou recentemente',
      priority: 'medium',
      action: 'post_sale',
      recommendedTemplateId: 'post_sale_satisfaction',
      recommendedReasonText: 'Pós-venda em momento certo fortalece relacionamento e gera recomendações.',
      recommendedTiming: 'today',
      followupPriorityScore: 70,
      payload: {
        followup: {
          dueAt: '+7 dias',
          reason: 'Pós-venda',
          templateId: 'post_sale_satisfaction',
          priority: 'medium'
        },
        composer: { templateId: 'post_sale_satisfaction' }
      }
    });
  }

  // Budget inquiry for negotiating without price discussion
  if (signals.hasNegotiatingTag && !signals.lastMessageIntent) {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Perguntar sobre orçamento',
      reason: 'Negociação em andamento sem discussão clara de valor',
      priority: 'medium',
      action: 'ask_budget',
      recommendedTemplateId: 'budget_inquiry',
      recommendedReasonText: 'Entender orçamento ajuda a oferecer opções adequadas e acelerar decisão.',
      recommendedTiming: 'today',
      followupPriorityScore: 80
    });
  }

  // Wait suggestion for very recent contact
  if (signals.daysSinceLastContact === 0 || signals.daysSinceLastContact === 1) {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Aguardar resposta do cliente',
      reason: 'Contato muito recente, dar tempo para resposta',
      priority: 'low',
      action: 'wait',
      recommendedTemplateId: 'aguardar-resposta',
      recommendedReasonText: 'Mensagens muito frequentes podem ser invasivas. Aguardar 2-3 dias antes de novo contato.',
      recommendedTiming: 'tomorrow',
      followupPriorityScore: 30,
      payload: {
        followup: {
          dueAt: '+2 dias',
          reason: 'Aguardar resposta do cliente',
          templateId: 'aguardar-resposta',
          priority: 'low'
        },
        tag: {
          name: 'aguardando_resposta'
        }
      }
    });
  }

  // Default suggestion if no specific suggestions
  if (suggestions.length === 0) {
    suggestions.push({
      id: `sug-${suggestionId++}`,
      title: 'Fazer contato de relacionamento',
      reason: 'Manter proximidade com o cliente',
      priority: 'low',
      action: 'send_message',
      recommendedTemplateId: 'relationship_check',
      recommendedReasonText: 'Manter contato regular mantém marca presente na mente do cliente.',
      recommendedTiming: 'this_week',
      followupPriorityScore: 50
    });
  }

  return suggestions;
}
