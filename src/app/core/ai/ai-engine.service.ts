import { Injectable, inject } from '@angular/core';
import { AiClientAnalysis, AiContextSignal, AiScoreResult, AiSuggestion } from './ai.models';
import { computeScore, computeSuggestions } from './ai.rules';
import { FollowupCandidate, COOLDOWN_KEYWORDS } from '../../features/central/data-access/followup.models';
import { SuggestionApplicationsService } from './suggestion-applications.service';

/**
 * AI Engine Service - Núcleo centralizado de IA rule-based
 * 
 * Responsável por calcular scores, gerar sugestões e análises
 * baseadas em regras (sem LLM). Preparado para futura substituição
 * por IA real mantendo a mesma interface.
 */
@Injectable({
  providedIn: 'root'
})
export class AiEngineService {
  private suggestionApplicationsService = inject(SuggestionApplicationsService);

  // Template padrão (fallback) quando nenhuma recomendação específica está disponível
  // Este ID deve corresponder a um template real no sistema
  private readonly DEFAULT_TEMPLATE_ID = 'default_followup';
  
  // Mapeamento de IDs de recomendação para títulos parciais de templates
  private readonly TEMPLATE_MAPPING: Record<string, string[]> = {
    'closing_deal': ['preço', 'price', 'fechamento'],
    'price_offer': ['preço', 'price', 'oferta'],
    'gift_options': ['presente', 'gift'],
    'delivery_info': ['entrega', 'delivery'],
    'vip_reactivation': ['retomada', 'sumiu', 'multi'],
    'new_products': ['novidades', 'new'],
    're_engagement': ['sumiu', 'retomada', 'multi'],
    'post_sale': ['pós-venda', 'agradecimento'],
    'follow_up_leve': ['follow-up', 'leve', 'padrão', 'default'],
  };

  /**
   * Calcula o score de um cliente baseado em sinais de contexto
   */
  computeScore(signals: AiContextSignal): AiScoreResult {
    return computeScore(signals);
  }

  /**
   * Gera sugestões de ação baseadas em sinais de contexto
   * Filtra sugestões já aplicadas recentemente
   * @param signals Sinais de contexto do cliente
   * @param clientId ID do cliente (necessário para filtrar sugestões aplicadas)
   */
  computeSuggestions(signals: AiContextSignal, clientId?: string): AiSuggestion[] {
    const allSuggestions = computeSuggestions(signals);
    
    // Se não temos clientId, retornar todas as sugestões (sem filtro)
    if (!clientId) {
      return allSuggestions;
    }

    // Filtrar sugestões já aplicadas recentemente
    const filteredSuggestions = allSuggestions.filter(suggestion => {
      // Determinar dias de cooldown baseado no tipo de ação
      let cooldownDays = 7; // Padrão: 7 dias
      
      if (suggestion.action === 'wait') {
        // "Aguardar resposta" tem cooldown mais curto
        cooldownDays = 2;
      }

      // Verificar se foi aplicada recentemente
      const wasApplied = this.suggestionApplicationsService.wasAppliedRecently(
        clientId,
        suggestion.id,
        cooldownDays
      );

      return !wasApplied;
    });

    console.log(`🔍 [AiEngine] Sugestões filtradas: ${allSuggestions.length} -> ${filteredSuggestions.length} (clientId: ${clientId})`);
    
    return filteredSuggestions;
  }

  /**
   * Realiza análise completa de IA (score + sugestões)
   * @param signals Sinais de contexto do cliente
   * @param clientId ID do cliente (necessário para filtrar sugestões aplicadas)
   */
  computeClientAi(signals: AiContextSignal, clientId?: string): AiClientAnalysis {
    return {
      score: this.computeScore(signals),
      suggestions: this.computeSuggestions(signals, clientId)
    };
  }

  /**
   * Constrói um candidato a follow-up baseado nos sinais do cliente
   * Retorna score normalizado (0-100), reasons (max 3), recommendedTemplateId e timing
   * Se isCooldown=true, NÃO deve criar follow-up
   * @param signals Sinais de contexto do cliente
   * @param clientId ID do cliente (opcional, para filtrar sugestões aplicadas)
   */
  buildFollowupCandidate(signals: AiContextSignal, clientId?: string): FollowupCandidate {
    const scoreResult = this.computeScore(signals);
    const suggestions = this.computeSuggestions(signals, clientId);

    // Normalizar score para 0-100
    const normalizedScore = Math.max(0, Math.min(100, scoreResult.score));

    // Extrair até 3 reasons principais
    const reasons = scoreResult.reasons
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 3)
      .map(r => r.text);

    // Verificar se há keywords de cooldown nas reasons
    const hasCooldownKeyword = reasons.some(reason =>
      COOLDOWN_KEYWORDS.some(keyword =>
        reason.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    // Se contato muito recente (< 2 dias), marcar como cooldown
    const isCooldown = hasCooldownKeyword || signals.daysSinceLastContact < 2;

    // Buscar sugestão com maior prioridade para template recomendado
    const highestPrioritySuggestion = suggestions
      .filter(s => s.action === 'send_message')
      .sort((a, b) => b.followupPriorityScore - a.followupPriorityScore)[0];

    // Template ID recomendado (com fallback)
    const recommendedTemplateId =
      highestPrioritySuggestion?.recommendedTemplateId || this.DEFAULT_TEMPLATE_ID;

    // Timing recomendado
    const recommendedTiming = highestPrioritySuggestion?.recommendedTiming || 'today';

    return {
      score: normalizedScore,
      reasons: reasons.length > 0 ? reasons : ['Cliente sem interação recente'],
      recommendedTemplateId,
      recommendedTiming,
      isCooldown
    };
  }
}
