export type ConsignationStatus = 'open' | 'sold' | 'returned';

export interface Consignation {
  id: string;
  clientId: string;
  productId: string;
  status: ConsignationStatus;
  startedAt: string; // ISO
  expectedReturnAt?: string; // ISO opcional
  notes?: string;
  salePrice?: number; // quando sold
  closedAt?: string; // ISO quando sold/returned
}

export interface ConsignationListItemVm {
  id: string;
  status: ConsignationStatus;
  startedAt: string;
  daysOpen: number;
  clientName: string;
  clientScore?: number;
  productName: string;
  productPrice: number;
}

export interface ConsignationDetailVm {
  consignation: Consignation;
  client: {
    id: string;
    name: string;
    whatsapp?: string;
    score?: number;
  };
  product: {
    id: string;
    name: string;
    price: number;
    status: string;
    material?: string;
    type?: string;
  };
  daysOpen: number;
}
