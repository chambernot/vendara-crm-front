import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../../../core/api';
import { WorkspaceService } from '../../../core/workspace';
import { Sale } from './clients.models';

// Re-exportar Sale para compatibilidade com arquivos que importam daqui
export type { Sale } from './clients.models';

/**
 * Interface para item de venda
 */
export interface SaleItem {
  productId: string;  // Obrigatório: ID do produto
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * Interface para criar venda
 */
export interface CreateSaleDto {
  clientId: string;
  items: SaleItem[];  // Obrigatório: pelo menos 1 item
  paymentMethod: string;  // Obrigatório: método de pagamento
  totalAmount: number;
  notes?: string;
  saleDate?: string; // ISO string, defaults to now
}

/**
 * Interface para atividade de cliente
 */
export interface ClientActivity {
  id: string;
  clientId: string;
  type: 'message_sent' | 'message_failed' | 'message_received' | 'tag_added' | 'tag_removed' | 'opt_in_enabled' | 'opt_in_disabled' | 'sale_recorded' | 'note_added';
  text: string;
  at: string; // ISO string
  meta?: Record<string, any>;
}

/**
 * Interface para criar atividade
 */
export interface CreateActivityDto {
  clientId: string;
  type: ClientActivity['type'];
  text: string;
  meta?: Record<string, any>;
}

/**
 * Serviço API para gerenciamento de vendas e atividades
 */
@Injectable({
  providedIn: 'root'
})
export class SalesApiService {
  private apiClient = inject(ApiClient);
  private workspaceService = inject(WorkspaceService);
  private readonly salesEndpoint = '/sales';
  private readonly activitiesEndpoint = '/activities';

  /**
   * Registra nova venda
   */
  createSale(dto: CreateSaleDto): Observable<Sale> {
    return this.apiClient.post<Sale>(this.salesEndpoint, dto);
  }

  /**
   * Lista vendas de um cliente
   */
  getSalesByClient(clientId: string): Observable<Sale[]> {
    const workspace = this.workspaceService.requireActive();
    const url = `${this.salesEndpoint}?clientId=${clientId}&workspaceId=${workspace.id}`;
    return this.apiClient.get<any>(url)
      .pipe(
        map((response: any) => {
          console.log('📦 [SalesApi] Response:', JSON.stringify(response, null, 2));
          let sales = response?.data?.items || response?.data || response;
          
          if (!Array.isArray(sales)) {
            console.warn('⚠️ [SalesApi] Sales não é array');
            return [];
          }
          
          console.log('🔍 [SalesApi] Sale 0:', JSON.stringify(sales[0], null, 2));
          
          const mappedSales = sales.map((sale: any) => ({
            ...sale,
            amount: sale.amount || sale.total || sale.totalAmount || 0,
          }));
          
          console.log('✅ [SalesApi] Mapped sale 0:', JSON.stringify(mappedSales[0], null, 2));
          return mappedSales;
        })
      );
  }

  /**
   * Lista todas as vendas
   */
  listSales(): Observable<Sale[]> {
    return this.apiClient.get<Sale[]>(this.salesEndpoint);
  }

  /**
   * Busca venda por ID
   */
  getSaleById(id: string): Observable<Sale> {
    return this.apiClient.get<Sale>(`${this.salesEndpoint}/${id}`);
  }

  /**
   * Cria atividade para um cliente
   */
  createActivity(dto: CreateActivityDto): Observable<ClientActivity> {
    return this.apiClient.post<ClientActivity>(this.activitiesEndpoint, dto);
  }

  /**
   * Lista atividades de um cliente
   */
  getActivitiesByClient(clientId: string): Observable<ClientActivity[]> {
    return this.apiClient.get<ClientActivity[]>(`${this.activitiesEndpoint}?clientId=${clientId}`);
  }

  /**
   * Lista todas as atividades (com limite)
   */
  listActivities(limit?: number): Observable<ClientActivity[]> {
    const query = limit ? `?limit=${limit}` : '';
    return this.apiClient.get<ClientActivity[]>(`${this.activitiesEndpoint}${query}`);
  }
}
