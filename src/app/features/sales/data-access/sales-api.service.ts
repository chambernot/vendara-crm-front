import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/api';
import {
  Sale,
  SaleApiDto,
  CreateSaleDto,
  SalesListQuery,
  SalesSummary
} from './sales.models';

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
  totalPages?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SalesApiService {
  private apiClient = inject(ApiClient);
  private readonly endpoint = '/sales';

  /**
   * Criar uma nova venda
   */
  createSale(dto: CreateSaleDto): Observable<Sale> {
    return this.apiClient.post<ApiResponse<SaleApiDto>>(this.endpoint, dto).pipe(
      map((response) => this.mapApiDtoToSale(response.data))
    );
  }

  /**
   * Listar vendas com filtros
   */
  listSales(query?: SalesListQuery): Observable<PaginatedResult<Sale>> {
    const queryParams = new URLSearchParams();

    if (query?.startDate) queryParams.append('from', query.startDate);
    if (query?.endDate) queryParams.append('to', query.endDate);
    if (query?.clientId) queryParams.append('clientId', query.clientId);
    if (query?.paymentMethod) queryParams.append('paymentMethod', query.paymentMethod);
    if (query?.pageNumber) queryParams.append('page', String(query.pageNumber));
    if (query?.pageSize) queryParams.append('pageSize', String(query.pageSize));

    const url = queryParams.toString() 
      ? `${this.endpoint}?${queryParams.toString()}`
      : this.endpoint;

    return this.apiClient
      .get<ApiResponse<any>>(url)
      .pipe(
        map((response) => {
          // A API retorna data como array direto (SaleListItemDto[])
          const data = response.data;
          const salesArray = Array.isArray(data) ? data : (data?.items || []);
          return {
            items: salesArray.map((dto: any) => this.mapListItemToSale(dto)),
            totalCount: salesArray.length,
          };
        })
      );
  }

  /**
   * Obter resumo de vendas de hoje
   */
  getTodaySummary(): Observable<SalesSummary> {
    return this.apiClient
      .get<ApiResponse<SalesSummary>>(`${this.endpoint}/summary/today`)
      .pipe(map((response) => response.data));
  }

  /**
   * Obter uma venda por ID
   */
  getSaleById(id: string): Observable<Sale> {
    return this.apiClient
      .get<ApiResponse<SaleApiDto>>(`${this.endpoint}/${id}`)
      .pipe(map((response) => this.mapApiDtoToSale(response.data)));
  }

  /**
   * Mapear DTO da API para modelo Sale
   */
  private mapApiDtoToSale(dto: SaleApiDto): Sale {
    return {
      id: dto.id,
      workspaceId: dto.workspaceId,
      clientId: dto.clientId,
      clientName: dto.clientName,
      paymentMethod: dto.paymentMethod,
      items: dto.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      total: dto.total,
      notes: dto.notes,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
    };
  }

  /**
   * Mapear SaleListItemDto da API (campos: saleDate, totalAmount, itemCount)
   * para modelo Sale do frontend
   */
  private mapListItemToSale(dto: any): Sale {
    return {
      id: dto.id,
      workspaceId: dto.workspaceId,
      clientId: dto.clientId,
      clientName: dto.clientName,
      paymentMethod: dto.paymentMethod,
      items: dto.items || Array.from({ length: dto.itemCount || 0 }, () => ({
        productId: '',
        productName: '',
        quantity: 1,
        unitPrice: 0,
        subtotal: 0,
      })),
      total: dto.totalAmount ?? dto.total ?? 0,
      notes: dto.note ?? dto.notes,
      createdAt: dto.saleDate ?? dto.createdAt,
      updatedAt: dto.updatedAt,
    };
  }
}
