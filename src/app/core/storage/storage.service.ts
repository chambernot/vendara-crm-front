import { Injectable, inject } from '@angular/core';
import { WorkspaceService } from '../workspace';
import { keyFor } from '../workspace/workspace.storage';

/**
 * Serviço genérico de persistência LocalStorage
 * Pronto para ser substituído por API futuramente
 * Suporta namespace por workspace
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private workspaceService = inject(WorkspaceService);
  
  /**
   * Busca dados do LocalStorage (workspace-aware)
   * Retorna null se não existir ou houver erro no parse
   */
  get<T>(baseKey: string): T | null {
    const key = this.resolveKey(baseKey);
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`[StorageService] Erro ao ler '${key}':`, error);
      // Limpar key corrompido
      this.remove(baseKey);
      return null;
    }
  }

  /**
   * Persiste dados no LocalStorage (workspace-aware)
   */
  set<T>(baseKey: string, value: T): void {
    const key = this.resolveKey(baseKey);
    try {
      const json = JSON.stringify(value);
      localStorage.setItem(key, json);
    } catch (error) {
      console.error(`[StorageService] Erro ao salvar '${key}':`, error);
    }
  }

  /**
   * Remove key específico (workspace-aware)
   */
  remove(baseKey: string): void {
    const key = this.resolveKey(baseKey);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[StorageService] Erro ao remover '${key}':`, error);
    }
  }

  /**
   * Limpa múltiplas keys
   */
  clear(keys: string[]): void {
    keys.forEach(key => this.remove(key));
  }

  /**
   * Busca dados ou inicializa com seed
   * Perfeito para bootstrap inicial
   */
  getOrSeed<T>(baseKey: string, seedFactory: () => T): T {
    const existing = this.get<T>(baseKey);
    
    if (existing !== null) {
      return existing;
    }

    // Primeira execução: criar seed
    const seed = seedFactory();
    this.set(baseKey, seed);
    return seed;
  }

  /**
   * Verifica se existe dados para uma key
   */
  has(baseKey: string): boolean {
    const key = this.resolveKey(baseKey);
    return localStorage.getItem(key) !== null;
  }

  /**
   * Resolve a chave final com namespace de workspace
   * Se houver workspace ativo, adiciona namespace
   */
  private resolveKey(baseKey: string): string {
    try {
      const workspace = this.workspaceService.getActive();
      if (workspace) {
        return keyFor(workspace.id, baseKey);
      }
    } catch {
      // Workspace não disponível (ex: durante login)
    }
    return baseKey; // Fallback para key sem namespace
  }
}
