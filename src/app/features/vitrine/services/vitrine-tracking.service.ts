import { Injectable } from '@angular/core';

export type VitrineEventType = 
  | 'produto_visualizado'
  | 'produto_whatsapp_click'
  | 'produto_favoritado'
  | 'produto_desfavoritado'
  | 'catalogo_aberto'
  | 'home_aberto'
  | 'filtro_aplicado'
  | 'busca_realizada';

export interface VitrineEvent {
  id: string;
  type: VitrineEventType;
  timestamp: string; // ISO 8601
  workspaceSlug: string;
  productId?: string;
  productName?: string;
  meta?: Record<string, string | number | boolean>;
}

const MAX_EVENTS = 500; // Limite de eventos por workspace

@Injectable({
  providedIn: 'root'
})
export class VitrineTrackingService {
  
  /**
   * Registra um evento de tracking da vitrine
   */
  track(
    type: VitrineEventType,
    workspaceSlug: string,
    data?: {
      productId?: string;
      productName?: string;
      meta?: Record<string, string | number | boolean>;
    }
  ): void {
    try {
      const event: VitrineEvent = {
        id: this.generateId(),
        type,
        timestamp: new Date().toISOString(),
        workspaceSlug,
        productId: data?.productId,
        productName: data?.productName,
        meta: data?.meta
      };

      const storageKey = this.getStorageKey(workspaceSlug);
      const events = this.getEvents(workspaceSlug);
      events.push(event);

      // Manter apenas os últimos MAX_EVENTS
      const trimmedEvents = events.slice(-MAX_EVENTS);
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(trimmedEvents));
      }

      // Log no console em desenvolvimento
      if (!this.isProduction()) {
        console.log(`[Vitrine Tracking] ${type}`, event);
      }
    } catch (error) {
      // Falha silenciosa - tracking nunca deve quebrar a aplicação
      console.warn('Falha ao registrar evento de tracking:', error);
    }
  }

  /**
   * Obtém eventos de tracking de um workspace
   */
  getEvents(workspaceSlug: string, limit = 100): VitrineEvent[] {
    try {
      const storageKey = this.getStorageKey(workspaceSlug);
      
      if (typeof localStorage === 'undefined') {
        return [];
      }

      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        return [];
      }

      const events = JSON.parse(stored) as VitrineEvent[];
      return events.slice(-limit).reverse(); // Mais recentes primeiro
    } catch (error) {
      console.warn('Falha ao obter eventos de tracking:', error);
      return [];
    }
  }

  /**
   * Obtém estatísticas de eventos
   */
  getStats(workspaceSlug: string, days = 7): {
    total: number;
    byType: { type: string; count: number }[];
    produtosMaisVistos: { productId: string; productName: string; count: number }[];
  } {
    try {
      const events = this.getEvents(workspaceSlug, 1000);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentEvents = events.filter(e => new Date(e.timestamp) >= cutoffDate);

      // Contar por tipo
      const countsByType: Record<string, number> = {};
      recentEvents.forEach(e => {
        countsByType[e.type] = (countsByType[e.type] || 0) + 1;
      });

      const byType = Object.entries(countsByType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Produtos mais vistos
      const produtosVisualizados = recentEvents.filter(
        e => e.type === 'produto_visualizado' && e.productId
      );

      const produtosCounts: Record<string, { id: string; name: string; count: number }> = {};
      produtosVisualizados.forEach(e => {
        if (e.productId) {
          if (!produtosCounts[e.productId]) {
            produtosCounts[e.productId] = {
              id: e.productId,
              name: e.productName || e.productId,
              count: 0
            };
          }
          produtosCounts[e.productId].count++;
        }
      });

      const produtosMaisVistos = Object.values(produtosCounts)
        .map(p => ({
          productId: p.id,
          productName: p.name,
          count: p.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        total: recentEvents.length,
        byType,
        produtosMaisVistos
      };
    } catch (error) {
      console.warn('Falha ao obter estatísticas:', error);
      return {
        total: 0,
        byType: [],
        produtosMaisVistos: []
      };
    }
  }

  /**
   * Limpa eventos de um workspace
   */
  clear(workspaceSlug: string): void {
    try {
      const storageKey = this.getStorageKey(workspaceSlug);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.warn('Falha ao limpar eventos:', error);
    }
  }

  /**
   * Exporta eventos como JSON
   */
  export(workspaceSlug: string): string {
    const events = this.getEvents(workspaceSlug, 1000);
    return JSON.stringify({
      workspaceSlug,
      exportedAt: new Date().toISOString(),
      eventsCount: events.length,
      events
    }, null, 2);
  }

  private getStorageKey(workspaceSlug: string): string {
    return `vendara_vitrine_tracking_${workspaceSlug}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isProduction(): boolean {
    if (typeof window === 'undefined') return true;
    return window.location.hostname !== 'localhost' && 
           !window.location.hostname.includes('127.0.0.1');
  }
}
