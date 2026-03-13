export type PaymentMethod = 'PIX' | 'CARTAO' | 'DINHEIRO' | 'TRANSFERENCIA' | 'OUTRO';

/**
 * Item de uma venda
 */
export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/**
 * Modelo de venda
 */
export interface Sale {
  id: string;
  workspaceId: string;
  clientId?: string;
  clientName?: string;
  paymentMethod: PaymentMethod;
  items: SaleItem[];
  total: number;
  totalAmount?: number; // Alias para 'total' usado pelo backend em algumas respostas
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * DTO para criar uma venda
 */
export interface CreateSaleDto {
  clientId?: string;
  paymentMethod: PaymentMethod;
  items: CreateSaleItemDto[];
  notes?: string;
}

/**
 * Item para criação de venda
 */
export interface CreateSaleItemDto {
  productId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Resposta da API de venda
 */
export interface SaleApiDto {
  id: string;
  workspaceId: string;
  clientId?: string;
  clientName?: string;
  paymentMethod: PaymentMethod;
  items: SaleItemApiDto[];
  total: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Item de venda da API
 */
export interface SaleItemApiDto {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/**
 * Resumo de vendas
 */
export interface SalesSummary {
  totalSales: number;
  totalAmount: number;
  periodLabel?: string;
}

/**
 * Query para listar vendas
 */
export interface SalesListQuery {
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  clientId?: string;
  paymentMethod?: PaymentMethod;
  pageNumber?: number;
  pageSize?: number;
}
