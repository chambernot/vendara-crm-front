import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { Product, ProductStatus } from './catalog.models';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root'
})
export class CatalogStore {
  private productService = inject(ProductService);

  // Mantém assinatura pública, mas a fonte agora é a API.

  getProducts(): Observable<Product[]> {
    return this.productService
      .list({ pageNumber: 1, pageSize: 200, sort: 'updatedAt_desc' })
      .pipe(map((r) => r.items));
  }

  getProduct(id: string): Observable<Product | null> {
    return this.productService.getById(id).pipe(catchError(() => of(null)));
  }

  setStatus(id: string, status: ProductStatus): Observable<void> {
    return this.productService.update(id, { status } as any).pipe(
      map(() => undefined),
      catchError(() => of(undefined))
    );
  }

  /**
   * Cria novo produto (com persistência)
   */
  createProduct(product: Omit<Product, 'id' | 'createdAt'>): Observable<Product> {
    return this.productService.create({
      name: product.name,
      type: product.type,
      material: product.material,
      price: product.price,
      quantityAvailable: (product as any).quantityAvailable ?? 0,
      photoUrl: (product as any).photoUrl ?? (product as any).imageUrl,
      notes: (product as any).notes ?? (product as any).description,
      active: (product as any).active ?? true,
    } as any);
  }
}
