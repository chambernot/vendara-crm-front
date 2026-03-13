export type StockMovementType = 'ENTRADA' | 'VENDA' | 'AJUSTE';

export interface StockMovement {
  id: string;
  workspaceId: string;
  productId: string;
  productName?: string;
  type: StockMovementType;
  quantityDelta: number; // +10 (ENTRADA), -5 (VENDA), +3/-3 (AJUSTE)
  observation?: string;
  createdAt: string;
  createdBy?: string;
}

export interface StockMovementCreateDto {
  productId: string;
  type: StockMovementType;
  quantityDelta: number;
  observation?: string;
}

export interface StockMovementListQuery {
  productId?: string;
  type?: StockMovementType;
  fromDate?: string; // ISO string
  toDate?: string; // ISO string
  pageNumber?: number;
  pageSize?: number;
}

export interface StockMovementApiDto {
  id: string;
  workspaceId?: string;
  productId: string;
  productName?: string;
  type: StockMovementType | string;
  quantityDelta: number;
  observation?: string;
  createdAt: string;
  createdBy?: string;
}
