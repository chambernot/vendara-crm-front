import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage';
import { SuggestionApplication, SuggestionApplicationEffects, AiSuggestion } from './ai.models';

/**
 * Chave de storage para aplicações de sugestões
 */
const SUGGESTION_APPLICATIONS_KEY = 'vendara_suggestion_applications_v1';

/**
 * Serviço para gerenciar o histórico de aplicações de sugestões
 * Permite persistir, consultar e filtrar sugestões já aplicadas
 */
@Injectable({
  providedIn: 'root'
})
export class SuggestionApplicationsService {
  private storageService = inject(StorageService);

  /**
   * Lista todas as aplicações de um cliente
   */
  listByClient(clientId: string): SuggestionApplication[] {
    const all = this.getAll();
    return all.filter(app => app.clientId === clientId);
  }

  /**
   * Marca uma sugestão como aplicada
   * Retorna o registro criado
   */
  markApplied(
    clientId: string,
    suggestion: AiSuggestion,
    effects: SuggestionApplicationEffects
  ): SuggestionApplication {
    const all = this.getAll();
    
    const application: SuggestionApplication = {
      id: this.generateId(),
      clientId,
      suggestionId: suggestion.id,
      appliedAt: new Date().toISOString(),
      status: 'SUCCESS',
      effects
    };

    all.push(application);
    this.saveAll(all);

    console.log('✅ [SuggestionApplications] Aplicação registrada:', application);
    return application;
  }

  /**
   * Verifica se uma sugestão foi aplicada recentemente
   * @param clientId ID do cliente
   * @param suggestionId ID da sugestão (usamos o 'action' type como identificador universal)
   * @param days Número de dias para considerar "recente" (default: 7)
   */
  wasAppliedRecently(clientId: string, suggestionId: string, days: number = 7): boolean {
    const applications = this.listByClient(clientId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Verificar se existe aplicação recente
    const recentApplication = applications.find(app => {
      // Comparar pelo ID base da sugestão (sem o número sequencial)
      // Ex: "sug-offer-product-3" -> match com qualquer "offer-product"
      const appBaseId = this.extractBaseSuggestionId(app.suggestionId);
      const targetBaseId = this.extractBaseSuggestionId(suggestionId);
      
      const isMatch = appBaseId === targetBaseId;
      const isRecent = new Date(app.appliedAt) >= cutoffDate;
      const isSuccess = app.status === 'SUCCESS';

      return isMatch && isRecent && isSuccess;
    });

    if (recentApplication) {
      console.log(`⏭️ [SuggestionApplications] Sugestão '${suggestionId}' foi aplicada recentemente (${recentApplication.appliedAt})`);
      return true;
    }

    return false;
  }

  /**
   * Extrai o ID base de uma sugestão removendo o sufixo numérico
   * Ex: "sug-offer-product-3" -> "offer-product"
   */
  private extractBaseSuggestionId(suggestionId: string): string {
    // Remove prefixo "sug-" e sufixo numérico
    const withoutPrefix = suggestionId.replace(/^sug-/, '');
    const withoutSuffix = withoutPrefix.replace(/-\d+$/, '');
    return withoutSuffix;
  }

  /**
   * Marca aplicação como falha
   */
  markFailed(
    clientId: string,
    suggestionId: string,
    error: string
  ): SuggestionApplication {
    const all = this.getAll();
    
    const application: SuggestionApplication = {
      id: this.generateId(),
      clientId,
      suggestionId,
      appliedAt: new Date().toISOString(),
      status: 'FAILED',
      effects: {}
    };

    all.push(application);
    this.saveAll(all);

    console.error('❌ [SuggestionApplications] Aplicação falhou:', application, error);
    return application;
  }

  /**
   * Remove aplicações antigas (cleanup)
   * @param olderThanDays Remove aplicações mais antigas que X dias (default: 90)
   */
  cleanup(olderThanDays: number = 90): number {
    const all = this.getAll();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const remaining = all.filter(app => new Date(app.appliedAt) >= cutoffDate);
    const removedCount = all.length - remaining.length;

    if (removedCount > 0) {
      this.saveAll(remaining);
      console.log(`🧹 [SuggestionApplications] Cleanup: ${removedCount} aplicações antigas removidas`);
    }

    return removedCount;
  }

  /**
   * Busca todas as aplicações do storage
   */
  private getAll(): SuggestionApplication[] {
    return this.storageService.get<SuggestionApplication[]>(SUGGESTION_APPLICATIONS_KEY) || [];
  }

  /**
   * Salva todas as aplicações no storage
   */
  private saveAll(applications: SuggestionApplication[]): void {
    this.storageService.set(SUGGESTION_APPLICATIONS_KEY, applications);
  }

  /**
   * Gera um ID único para a aplicação
   */
  private generateId(): string {
    return `app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
