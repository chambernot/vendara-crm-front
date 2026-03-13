import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { StorageService } from '../../../core/storage';

/**
 * Storage key para estado da Central
 * Armazena o cliente alvo selecionado
 */
const CENTRAL_STATE_KEY = 'central_selected_client_v1';

/**
 * Estado persistente da Central
 */
export interface CentralState {
  selectedClientId?: string;
}

/**
 * Store para gerenciar estado da Central
 * Persiste o cliente selecionado no LocalStorage (namespaced por workspace)
 */
@Injectable({
  providedIn: 'root'
})
export class CentralStore {
  private storageService = inject(StorageService);
  
  // Estado reativo
  private state = signal<CentralState>({});
  
  // Selectores públicos
  selectedClientId = computed(() => this.state().selectedClientId);
  
  constructor() {
    // Carregar estado inicial do localStorage
    this.loadState();
    
    // Persistir automaticamente mudanças no localStorage
    effect(() => {
      const currentState = this.state();
      this.storageService.set(CENTRAL_STATE_KEY, currentState);
    });
  }
  
  /**
   * Carrega estado do LocalStorage
   */
  private loadState(): void {
    const savedState = this.storageService.get<CentralState>(CENTRAL_STATE_KEY);
    if (savedState) {
      this.state.set(savedState);
    }
  }
  
  /**
   * Define o cliente alvo selecionado
   */
  setSelectedClient(clientId: string): void {
    this.state.update(state => ({
      ...state,
      selectedClientId: clientId
    }));
  }
  
  /**
   * Limpa o cliente alvo selecionado
   */
  clearSelectedClient(): void {
    this.state.update(state => ({
      ...state,
      selectedClientId: undefined
    }));
  }
  
  /**
   * Verifica se há um cliente selecionado
   */
  hasSelectedClient(): boolean {
    return !!this.state().selectedClientId;
  }
}
