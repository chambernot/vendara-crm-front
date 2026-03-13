import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../api';

export interface StaleProductDto {
  productId: string;
  name: string;
  photoUrl?: string;
  price: number;
  quantity?: number;
  lastMovementAt?: string | null;
  daysStale: number;
  staleReason: 'never_moved' | 'no_sales_30d' | 'no_movement_30d' | string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private apiClient = inject(ApiClient);

  getStaleProducts(days: number = 30, limit: number = 10): Observable<StaleProductDto[]> {
    console.log('📊 [DASHBOARD SERVICE] Buscando produtos parados via API');
    console.log('📊 [DASHBOARD SERVICE] Params:', { days, limit });
    return this.apiClient.get<StaleProductDto[]>(
      `/dashboard/stale-products?days=${days}&limit=${limit}`
    );
  }
}
