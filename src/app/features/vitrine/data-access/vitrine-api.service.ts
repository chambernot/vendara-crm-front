import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

/**
 * Imagem do produto público
 */
export interface PublicProductImage {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  order: number;
  uploadedAt: string;
}

export interface PublicProduct {
  id: string;
  name: string;
  type: string;
  material: string;
  price: number;
  photoUrl?: string;
  images?: PublicProductImage[];  // NOVO: array de imagens
  description?: string;
  isOutOfStock: boolean;
  // Campos da Vitrine (API retorna em inglês)
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isOnSale?: boolean;
  category?: string;
  collection?: string;
  color?: string;
  size?: string;
  videoUrl?: string;
}

export interface PublicCatalogResponse {
  success: boolean;
  data: PublicProduct[];
  message?: string;
}

// Backend atual (Swagger) retorna { workspace: {...}, products: [...] }
export interface PublicCatalogResponseV2 {
  workspace: {
    name: string;
    slug: string;
    description?: string | null;
    logoUrl?: string | null;
  };
  products: Array<{
    id: string;
    name: string;
    type: string;
    material: string;
    price: number;
    photoUrl?: string | null;
    images?: PublicProductImage[];  // NOVO: array de imagens
    shortDescription?: string | null;
    description?: string | null;
    isOutOfStock: boolean;
    // Campos da Vitrine
    isNewArrival?: boolean;
    isBestSeller?: boolean;
    isOnSale?: boolean;
    category?: string;
    collection?: string;
    color?: string;
    size?: string;
    videoUrl?: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class VitrineApiService {
  // Remove /api para endpoints públicos (backend usa /public diretamente)
  private baseUrl = environment.apiBaseUrl.replace(/\/api$/, '');
  
  constructor(private http: HttpClient) {}

  /**
   * Lista produtos públicos por workspace slug
   * Usa /public/catalog (sem /api) para rotas públicas (sem autenticação)
   */
  getPublicCatalog(workspaceSlug: string): Observable<PublicProduct[]> {
    const url = `${this.baseUrl}/public/catalog/${workspaceSlug}`;
    console.log('🌐 [Vitrine] Carregando catálogo público de:', workspaceSlug);
    console.log('🌐 [Vitrine] Base URL:', this.baseUrl);
    console.log('🌐 [Vitrine] URL completa:', url);
    console.log('🌐 [Vitrine] Esta rota NÃO requer autenticação nem workspace selecionado');
    
    return this.http.get<PublicCatalogResponseV2 | PublicCatalogResponse>(url).pipe(
      map((response: any) => {
        console.log('✅ [Vitrine] Resposta recebida:', response);

        // Formato antigo: { success, data: [...] }
        if (response && Array.isArray(response.data)) {
          return response.data as PublicProduct[];
        }

        // Formato atual (Swagger): { workspace, products: [...] }
        const products = Array.isArray(response?.products) ? response.products : [];
        const mapped = products.map((p: any) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          material: p.material,
          price: p.price,
          photoUrl: p.photoUrl ?? undefined,
          images: p.images ?? [],  // NOVO: array de imagens
          description: p.description ?? p.shortDescription ?? undefined,
          isOutOfStock: !!p.isOutOfStock,
          // Campos da Vitrine - API retorna em inglês
          isNewArrival: p.isNewArrival ?? false,
          isBestSeller: p.isBestSeller ?? false,
          isOnSale: p.isOnSale ?? false,
          category: p.category ?? undefined,
          collection: p.collection ?? undefined,
          color: p.color ?? undefined,
          size: p.size ?? undefined,
          videoUrl: p.videoUrl ?? undefined,
        })) as PublicProduct[];
        
        console.log('✅ [Vitrine API] Produtos mapeados:', mapped);
        console.log('✅ [Vitrine API] Primeiro produto mapeado:', mapped[0]);
        console.log('✅ [Vitrine API] Campos vitrine:', {
          isNewArrival: mapped[0]?.isNewArrival,
          isBestSeller: mapped[0]?.isBestSeller,
          isOnSale: mapped[0]?.isOnSale
        });
        
        return mapped;
      })
    );
  }

  /**
   * Obtém produto público por ID
   */
  getPublicProduct(workspaceSlug: string, productId: string): Observable<PublicProduct> {
    const url = `${this.baseUrl}/public/catalog/${workspaceSlug}/${productId}`;
    console.log('🌐 [Vitrine] Buscando produto individual:', { workspaceSlug, productId, url });
    
    return this.http.get<any>(url).pipe(
      map((response: any) => {
        console.log('✅ [Vitrine] Produto recebido:', response);
        // Suporta tanto resposta direta quanto wrapped em data
        const product = response.data ?? response;
        return {
          id: product.id,
          name: product.name,
          type: product.type,
          material: product.material,
          price: product.price,
          photoUrl: product.photoUrl ?? undefined,
          images: product.images ?? [],  // NOVO: array de imagens
          description: product.description ?? product.shortDescription ?? undefined,
          isOutOfStock: !!product.isOutOfStock,
          // Campos da Vitrine
          isNewArrival: product.isNewArrival ?? false,
          isBestSeller: product.isBestSeller ?? false,
          isOnSale: product.isOnSale ?? false,
          category: product.category ?? undefined,
          collection: product.collection ?? undefined,
          color: product.color ?? undefined,
          size: product.size ?? undefined,
          videoUrl: product.videoUrl ?? undefined,
        } as PublicProduct;
      })
    );
  }

  /**
   * Gera mensagem para compartilhar no WhatsApp
   */
  generateWhatsAppMessage(product: PublicProduct, vitrineUrl: string): string {
    const msg = `✨ ${product.name}\n💎 ${product.type} - ${product.material}\n💰 R$ ${this.formatPrice(product.price)}\n\nVeja a foto aqui 👇\n${vitrineUrl}`;
    return msg;
  }

  /**
   * Abre WhatsApp com mensagem pré-formatada
   * Direciona para o telefone de contato fixo
   */
  shareOnWhatsApp(product: PublicProduct, vitrineUrl: string): void {
    const message = this.generateWhatsAppMessage(product, vitrineUrl);
    const encodedMessage = encodeURIComponent(message);
    // Telefone fixo de contato
    const contactPhone = '5511963723387';
    const whatsappUrl = `https://wa.me/${contactPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }

  /**
   * Abre WhatsApp direto (para botão "Chamar no WhatsApp")
   * Usa telefone fixo se não for especificado
   */
  openWhatsApp(phone?: string): void {
    const contactPhone = phone || '5511963723387';
    const url = `https://wa.me/${contactPhone}`;
    window.open(url, '_blank');
  }

  private formatPrice(price: number): string {
    return price.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}
