import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { ApiClient } from '../../../core/api';
import {
  StockMovement,
  StockMovementCreateDto,
  StockMovementListQuery,
  StockMovementApiDto,
  StockMovementType,
} from './stock-movement.models';
import { ProductService } from './product.service';

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

// Chave para localStorage
const STORAGE_KEY = 'stock_movements_local';

@Injectable({
  providedIn: 'root',
})
export class StockMovementService {
  private apiClient = inject(ApiClient);
  private productService = inject(ProductService);
  private readonly endpoint = '/StockMovements';  // Backend .NET usa PascalCase

  /**
   * Lista movimentações
   * TEMPORÁRIO: Usa localStorage até backend implementar a API
   */
  list(query?: StockMovementListQuery): Observable<PaginatedResponse<StockMovement>> {
    return of(this.getLocalMovements()).pipe(
      map((movements) => {
        // Aplicar filtros
        let filtered = [...movements];

        if (query?.productId) {
          filtered = filtered.filter((m) => m.productId === query.productId);
        }
        if (query?.type) {
          filtered = filtered.filter((m) => m.type === query.type);
        }
        if (query?.fromDate) {
          filtered = filtered.filter((m) => new Date(m.createdAt) >= new Date(query.fromDate!));
        }
        if (query?.toDate) {
          filtered = filtered.filter((m) => new Date(m.createdAt) <= new Date(query.toDate!));
        }

        // Ordenar por data (mais recente primeiro)
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Paginação
        const pageNumber = query?.pageNumber || 1;
        const pageSize = query?.pageSize || 20;
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const items = filtered.slice(startIndex, endIndex);
        const totalCount = filtered.length;
        const totalPages = Math.ceil(totalCount / pageSize);

        return {
          items,
          totalCount,
          pageNumber,
          pageSize,
          totalPages,
          hasPrevious: pageNumber > 1,
          hasNext: pageNumber < totalPages,
        };
      })
    );
  }

  /**
   * Busca movimentação por ID
   */
  getById(id: string): Observable<StockMovement> {
    const movement = this.getLocalMovements().find((m) => m.id === id);
    if (movement) {
      return of(movement);
    }
    return throwError(() => new Error('Movimentação não encontrada'));
  }

  /**
   * Cria movimentação
   * Atualiza o produto diretamente e salva histórico local
   */
  create(dto: StockMovementCreateDto): Observable<StockMovement> {
    // Primeiro, buscar o produto atual
    return this.productService.getById(dto.productId).pipe(
      switchMap((product) => {
        // Calcular novo estoque
        const currentStock = product.quantityAvailable;
        const newStock = currentStock + dto.quantityDelta;

        // Validar estoque
        if (newStock < 0) {
          return throwError(() => ({
            error: { message: `Estoque insuficiente. Disponível: ${currentStock}` }
          }));
        }

        // Atualizar produto usando método específico para estoque
        return this.productService.updateStock(dto.productId, newStock).pipe(
          map(() => {
            // Criar movimentação local
            const movement: StockMovement = {
              id: this.generateId(),
              workspaceId: '', // Será preenchido pelo interceptor
              productId: dto.productId,
              productName: product.name,
              type: dto.type,
              quantityDelta: dto.quantityDelta,
              observation: dto.observation,
              createdAt: new Date().toISOString(),
            };

            // Salvar no localStorage
            this.saveLocalMovement(movement);

            return movement;
          })
        );
      })
    );
  }

  /**
   * Gera ID único para movimentação local
   */
  private generateId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtém movimentações do localStorage
   */
  private getLocalMovements(): StockMovement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Salva movimentação no localStorage
   */
  private saveLocalMovement(movement: StockMovement): void {
    try {
      const movements = this.getLocalMovements();
      movements.unshift(movement); // Adiciona no início
      
      // Manter apenas as últimas 1000 movimentações
      const limited = movements.slice(0, 1000);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
    } catch (error) {
      console.warn('Erro ao salvar movimentação no localStorage:', error);
    }
  }

  /**
   * Limpa movimentações locais (útil para debug/testes)
   */
  clearLocalMovements(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
