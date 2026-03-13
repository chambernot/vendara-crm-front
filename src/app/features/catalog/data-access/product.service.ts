import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { ApiClient } from '../../../core/api';
import { Product, ProductImage, ProductImageUploadResponse, ProductMaterial, ProductStatus, ProductType } from './catalog.models';
import { environment } from '../../../../environments/environment';

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

export interface ProductApiDto {
  id: string;
  workspaceId?: string;
  name: string;
  type: ProductType | string;
  material: ProductMaterial | string;
  price: number;
  quantityAvailable: number;
  photoUrl?: string;
  images?: ProductImage[];  // NOVO: array de imagens
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;

  // Campos da Vitrine (API usa nomes em INGLÊS)
  category?: string;
  collection?: string;
  color?: string;
  size?: string;
  videoUrl?: string;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isOnSale?: boolean;

  // Campos legados (podem existir no backend antigo)
  status?: ProductStatus;
  daysStopped?: number;
  imageUrl?: string;
  sku?: string;
  description?: string;
}

export interface ProductListQuery {
  name?: string;
  type?: ProductType | string;
  material?: ProductMaterial | string;
  activeOnly?: boolean;
  sort?: 'updatedAt_desc' | 'updatedAt_asc' | 'name_asc' | 'price_asc' | 'price_desc';
  pageNumber?: number;
  pageSize?: number;
}

export interface ProductCreateDto {
  name: string;
  type: ProductType;
  material: ProductMaterial;
  price: number;
  quantityAvailable: number;
  photoUrl?: string;
  notes?: string;
  active: boolean;
  // Campos da Vitrine (API usa nomes em INGLÊS)
  category?: string;
  collection?: string;
  color?: string;
  size?: string;
  videoUrl?: string;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isOnSale?: boolean;
}

export interface ProductUpdateDto {
  name?: string;
  type?: ProductType;
  material?: ProductMaterial;
  price?: number;
  quantityAvailable?: number;
  photoUrl?: string;
  notes?: string;
  active?: boolean;
  // Campos da Vitrine (API usa nomes em INGLÊS)
  category?: string;
  collection?: string;
  color?: string;
  size?: string;
  videoUrl?: string;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isOnSale?: boolean;

  // compat
  status?: ProductStatus;
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
export class ProductService {
  private apiClient = inject(ApiClient);
  private readonly endpoint = '/products';

  list(query?: ProductListQuery): Observable<PaginatedResult<Product>> {
    const queryParams = new URLSearchParams();

    if (query?.name) queryParams.append('search', query.name);
    if (query?.type) queryParams.append('type', String(query.type).toUpperCase());
    if (query?.material) queryParams.append('material', String(query.material).toUpperCase());
    if (query?.activeOnly !== undefined) {
      queryParams.append('activeOnly', String(query.activeOnly));
    }

    if (query?.pageNumber) queryParams.append('page', String(query.pageNumber));
    if (query?.pageSize) queryParams.append('pageSize', String(query.pageSize));

    if (query?.sort) {
      queryParams.append('sort', query.sort);
    }

    const url = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;

    // Suporta tanto payload paginado quanto lista simples
    return this.apiClient.get<any>(url).pipe(
      map((raw) => {
        console.log('🔍 [ProductService] Raw API Response:', raw);
        return this.normalizeListResponse(raw);
      }),
      map((result) => {
        console.log('📦 [ProductService] Normalized result:', result);
        return {
          ...result,
          items: result.items.map((dto) => this.mapApiDtoToProduct(dto)),
        };
      })
    );
  }

  getById(id: string): Observable<Product> {
    return this.apiClient.get<any>(`${this.endpoint}/${id}`).pipe(
      map((raw) => {
        const dto = (raw?.data ?? raw) as ProductApiDto;
        return this.mapApiDtoToProduct(dto);
      })
    );
  }

  create(dto: ProductCreateDto): Observable<Product> {
    return this.apiClient.post<any>(this.endpoint, dto).pipe(
      map((raw) => this.mapApiDtoToProduct((raw?.data ?? raw) as ProductApiDto))
    );
  }

  update(id: string, dto: ProductUpdateDto): Observable<Product> {
    return this.apiClient.put<any>(`${this.endpoint}/${id}`, dto).pipe(
      map((raw) => this.mapApiDtoToProduct((raw?.data ?? raw) as ProductApiDto))
    );
  }

  /**
   * Atualiza apenas o estoque do produto (PATCH parcial)
   */
  updateStock(id: string, quantityAvailable: number): Observable<Product> {
    return this.apiClient.patch<any>(`${this.endpoint}/${id}`, { quantityAvailable }).pipe(
      map((raw) => this.mapApiDtoToProduct((raw?.data ?? raw) as ProductApiDto)),
      catchError((err) => {
        // Fallback: tenta PUT com todos os campos se PATCH falhar
        return this.getById(id).pipe(
          switchMap((product) => {
            const updateDto: ProductUpdateDto = {
              name: product.name,
              type: product.type,
              material: product.material,
              price: product.price,
              quantityAvailable: quantityAvailable,
              photoUrl: product.photoUrl,
              notes: product.notes,
              active: product.active,
            };
            return this.apiClient.put<any>(`${this.endpoint}/${id}`, updateDto).pipe(
              map((raw) => this.mapApiDtoToProduct((raw?.data ?? raw) as ProductApiDto))
            );
          })
        );
      })
    );
  }

  deactivate(id: string): Observable<Product> {
    // Preferência: PATCH /products/:id/deactivate
    return this.apiClient.patch<any>(`${this.endpoint}/${id}/deactivate`, {}).pipe(
      map((raw) => this.mapApiDtoToProduct((raw?.data ?? raw) as ProductApiDto)),
      catchError(() =>
        // Fallback: PATCH /products/:id { active: false }
        this.apiClient.patch<any>(`${this.endpoint}/${id}`, { active: false }).pipe(
          map((raw) => this.mapApiDtoToProduct((raw?.data ?? raw) as ProductApiDto))
        )
      )
    );
  }

  // =============================================
  // MÉTODOS DE CATÁLOGO
  // =============================================

  /**
   * Obtém o catálogo de produtos
   * GET /api/catalogo
   */
  getCatalogo(): Observable<Product[]> {
    return this.apiClient.get<any>('/catalogo').pipe(
      map((raw) => {
        console.log('📚 [ProductService] Catálogo recebido:', raw);
        const data = raw?.data ?? raw;
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        return items.map((dto: ProductApiDto) => this.mapApiDtoToProduct(dto));
      })
    );
  }

  /**
   * Obtém produto por ID através da rota /api/produtos/{id}
   * GET /api/produtos/{id}
   */
  getProdutoById(id: string): Observable<Product> {
    return this.apiClient.get<any>(`/produtos/${id}`).pipe(
      map((raw) => {
        console.log('🔍 [ProductService] Produto recebido:', raw);
        const dto = (raw?.data ?? raw) as ProductApiDto;
        return this.mapApiDtoToProduct(dto);
      })
    );
  }

  // =============================================
  // NOVOS MÉTODOS DE IMAGEM
  // =============================================

  /**
   * Upload de imagem para um produto.
   * Envia como multipart/form-data.
   * Máximo: 5MB. Formatos: JPEG, PNG, WebP.
   */
  uploadImage(productId: string, file: File): Observable<ProductImageUploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    // ⚠️ NÃO definir Content-Type manualmente!
    // O browser define automaticamente com o boundary correto para multipart/form-data.
    return this.apiClient.post<ApiResponse<ProductImageUploadResponse>>(
      `${this.endpoint}/${productId}/images`,
      formData
    ).pipe(map(res => res.data));
  }

  /**
   * Gera a URL completa para exibir uma imagem.
   * Uso: <img [src]="productService.getImageUrl(productId, imageId)">
   *
   * ⚠️ Este endpoint é PÚBLICO, não precisa de JWT nem x-workspace-id.
   */
  getImageUrl(productId: string, imageId: string): string {
    const relativePath = `/api/products/${productId}/images/${imageId}/file`;
    return environment.apiBaseUrl.replace('/api', '') + relativePath;
  }

  /**
   * Gera URL completa a partir de um path relativo retornado pela API
   */
  getFullImageUrl(relativePath: string): string {
    if (!relativePath) return '';
    return environment.apiBaseUrl.replace('/api', '') + relativePath;
  }

  /**
   * Deleta uma imagem do produto.
   * Retorna o produto atualizado (sem a imagem removida).
   */
  deleteImage(productId: string, imageId: string): Observable<Product> {
    return this.apiClient.delete<ApiResponse<Product>>(
      `${this.endpoint}/${productId}/images/${imageId}`
    ).pipe(map(res => this.mapApiDtoToProduct(res.data as any)));
  }

  /**
   * Reordena as imagens do produto.
   * A primeira imagem da lista se torna a capa (photoUrl).
   */
  reorderImages(productId: string, imageIds: string[]): Observable<Product> {
    return this.apiClient.put<ApiResponse<Product>>(
      `${this.endpoint}/${productId}/images/reorder`,
      { imageIds }
    ).pipe(map(res => this.mapApiDtoToProduct(res.data as any)));
  }

  private normalizeListResponse(raw: any): PaginatedResult<ProductApiDto> {
    const data = raw?.data ?? raw;

    // Unwrap common nesting patterns
    const unwrapped =
      data?.result ??
      data?.Result ??
      data?.payload ??
      data?.Payload ??
      data?.value ??
      data?.Value ??
      data;

    // Paginated response (camelCase)
    if (unwrapped && typeof unwrapped === 'object' && Array.isArray((unwrapped as any).items)) {
      return {
        items: (unwrapped as any).items,
        totalCount: (unwrapped as any).totalCount,
        pageNumber: (unwrapped as any).pageNumber,
        pageSize: (unwrapped as any).pageSize,
        totalPages: (unwrapped as any).totalPages,
        hasPrevious: (unwrapped as any).hasPrevious,
        hasNext: (unwrapped as any).hasNext,
      };
    }

    // Paginated response (PascalCase)
    if (unwrapped && typeof unwrapped === 'object' && Array.isArray((unwrapped as any).Items)) {
      return {
        items: (unwrapped as any).Items,
        totalCount: (unwrapped as any).TotalCount,
        pageNumber: (unwrapped as any).PageNumber,
        pageSize: (unwrapped as any).PageSize,
        totalPages: (unwrapped as any).TotalPages,
        hasPrevious: (unwrapped as any).HasPrevious,
        hasNext: (unwrapped as any).HasNext,
      };
    }

    // Array response
    if (Array.isArray(unwrapped)) {
      return { items: unwrapped };
    }

    // Common keys: products/products
    const productsArray = (unwrapped as any)?.products ?? (unwrapped as any)?.Products;
    if (Array.isArray(productsArray)) {
      return { items: productsArray };
    }

    // Heuristic: pick the first array property that looks like a list of products
    if (unwrapped && typeof unwrapped === 'object') {
      for (const key of Object.keys(unwrapped)) {
        const value = (unwrapped as any)[key];
        if (Array.isArray(value)) {
          // If array items look like product DTOs, accept it
          const first = value[0];
          if (!first || typeof first !== 'object') {
            continue;
          }
          if ('id' in first || '_id' in first || 'name' in first) {
            return { items: value };
          }
        }
      }
    }

    return { items: [] };
  }

  private mapApiDtoToProduct(dto: ProductApiDto): Product {
    return {
      id: dto.id,
      name: dto.name,
      type: this.normalizeType(dto.type),
      material: this.normalizeMaterial(dto.material),
      price: dto.price,
      quantityAvailable: dto.quantityAvailable ?? 0,
      photoUrl: dto.photoUrl ?? dto.imageUrl,
      images: dto.images ?? [],  // NOVO: campo images
      notes: dto.notes ?? dto.description,
      active: dto.active ?? true,
      createdAt: dto.createdAt ?? new Date().toISOString(),
      updatedAt: dto.updatedAt,

      // Campos da Vitrine - mapear de INGLÊS (API) para PORTUGUÊS (Model)
      categoria: dto.category,
      colecao: dto.collection,
      cor: dto.color,
      tamanho: dto.size,
      videoUrl: dto.videoUrl,
      maisVendido: dto.isBestSeller,
      novidade: dto.isNewArrival,
      promocao: dto.isOnSale,

      // compat
      status: dto.status ?? 'available',
      daysStopped: dto.daysStopped ?? 0,
      sku: dto.sku,
      description: dto.description,
      imageUrl: dto.imageUrl,
    };
  }

  private normalizeType(value: unknown): ProductType {
    const raw = String(value ?? '').trim();
    if (!raw) return 'OUTRO';

    const upper = raw.toUpperCase();

    // Direct match with backend values
    if (['ANEL', 'COLAR', 'PULSEIRA', 'BRINCO', 'CORRENTE', 'OUTRO'].includes(upper)) {
      return upper as ProductType;
    }

    const v = this.normalizeText(raw);
    if (v.includes('anel') || v === 'ring') return 'ANEL';
    if (v.includes('colar') || v === 'necklace') return 'COLAR';
    if (v.includes('corrente') || v === 'chain') return 'CORRENTE';
    if (v.includes('pulseira') || v === 'bracelet') return 'PULSEIRA';
    if (v.includes('brinco') || v.includes('argola') || v === 'earring') return 'BRINCO';

    return 'OUTRO';
  }

  private normalizeMaterial(value: unknown): ProductMaterial {
    const raw = String(value ?? '').trim();
    if (!raw) return 'OUTRO';

    const upper = raw.toUpperCase();

    // Direct match with backend values
    if (['OURO', 'PRATA', 'ACO', 'PEROLA', 'FOLHEADO', 'OUTRO'].includes(upper)) {
      return upper as ProductMaterial;
    }

    const v = this.normalizeText(raw);
    if (v.startsWith('ouro') || v.includes('gold') || v.includes('18k') || v.includes('24k')) return 'OURO';
    if (v.startsWith('prata') || v.includes('silver') || v.includes('925')) return 'PRATA';
    if (v.includes('aco') || v.includes('inox') || v.includes('steel') || v.includes('cirurgico')) return 'ACO';
    if (v.includes('perola') || v.includes('pearl')) return 'PEROLA';
    if (v.includes('folheado') || v.includes('banho') || v.includes('semijoia') || v.includes('semi joia')) return 'FOLHEADO';

    return 'OUTRO';
  }

  private normalizeText(input: string): string {
    // Lowercase + remove accents to improve matching (e.g., "Aço" -> "aco")
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
