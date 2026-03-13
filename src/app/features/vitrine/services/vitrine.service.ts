import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { VitrineApiService, PublicProduct } from '../data-access';
import { environment } from '../../../../environments/environment';

/**
 * Modelo de produto conforme especificação
 */
export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagens: string[];
  categoria: string;
  material?: string;
  disponivel: boolean;
  tags?: string[];
  
  // Selos e destaques
  novidade?: boolean;
  maisVendido?: boolean;
  promocao?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VitrineService {
  private vitrineApi = inject(VitrineApiService);

  /**
   * Converte PublicProduct para Produto
   */
  private mapToProduto(p: PublicProduct): Produto {
    // Gera código baseado no ID (ex: AF10082)
    const codigo = 'AF' + p.id.slice(-5).toUpperCase().replace(/[^0-9]/g, '').padStart(5, '0');
    
    const baseUrl = environment.apiBaseUrl.replace(/\/api$/, '');
    
    // Usa as imagens do novo sistema, ou fallback para photoUrl
    let imagens: string[] = [];
    if (p.images && p.images.length > 0) {
      // Usa o array completo de imagens
      imagens = p.images.map(img => {
        // Se a URL já começa com http, usa ela diretamente
        if (img.url.startsWith('http://') || img.url.startsWith('https://')) {
          return img.url;
        }
        // Senão, concatena com baseUrl garantindo que tem barra
        const url = img.url.startsWith('/') ? img.url : '/' + img.url;
        return baseUrl + url;
      });
      console.log('📸 [Vitrine] Imagens mapeadas para', p.name, ':', imagens);
    } else if (p.photoUrl) {
      // Fallback: usa photoUrl antigo
      if (p.photoUrl.startsWith('http://') || p.photoUrl.startsWith('https://')) {
        imagens = [p.photoUrl];
      } else {
        const url = p.photoUrl.startsWith('/') ? p.photoUrl : '/' + p.photoUrl;
        imagens = [baseUrl + url];
      }
      console.log('📸 [Vitrine] PhotoUrl mapeada para', p.name, ':', imagens);
    } else {
      // Placeholder quando não tem imagem
      imagens = ['data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y5ZmFmYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IiNkMWQ1ZGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn5KOPC90ZXh0Pjwvc3ZnPg=='];
      console.warn('⚠️ [Vitrine] Produto sem imagem:', p.name);
    }
    
    const preco = p.price ?? 0;
    console.log('💰 [Vitrine] Produto:', p.name, '| Preço no backend:', p.price, '| Preço mapeado:', preco);
    
    return {
      id: p.id,
      codigo: codigo,
      nome: p.name,
      descricao: p.description,
      preco: preco,
      imagens: imagens,
      categoria: p.type,
      material: p.material,
      disponivel: !p.isOutOfStock,
      tags: [p.type, p.material].filter(Boolean),
      
      // Selos - API retorna em INGLÊS
      novidade: p.isNewArrival ?? false,
      maisVendido: p.isBestSeller ?? false,
      promocao: p.isOnSale ?? false
    };
  }

  /**
   * Obtém catálogo público do workspace
   */
  getProdutos(workspaceSlug: string): Observable<Produto[]> {
    return this.vitrineApi.getPublicCatalog(workspaceSlug).pipe(
      map(products => products.map(p => this.mapToProduto(p)))
    );
  }

  /**
   * Obtém produto específico por ID
   */
  getProduto(workspaceSlug: string, produtoId: string): Observable<Produto> {
    return this.vitrineApi.getPublicProduct(workspaceSlug, produtoId).pipe(
      map(p => this.mapToProduto(p))
    );
  }

  /**
   * Formata preço em BRL
   */
  formatarPreco(preco: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(preco);
  }

  /**
   * Gera link do WhatsApp para produto
   */
  obterLinkWhatsApp(produto: Produto, vitrineUrl: string): string {
    const message = this.gerarMensagemWhatsApp(produto, vitrineUrl);
    const encodedMessage = encodeURIComponent(message);
    // Telefone de contato padrão (pode ser configurável)
    const telefone = '5511963723387';
    return `https://wa.me/${telefone}?text=${encodedMessage}`;
  }

  /**
   * Abre WhatsApp em nova aba
   */
  chamarNoWhatsApp(produto: Produto, vitrineUrl: string): void {
    const link = this.obterLinkWhatsApp(produto, vitrineUrl);
    window.open(link, '_blank');
  }

  /**
   * Gera mensagem para WhatsApp
   */
  private gerarMensagemWhatsApp(produto: Produto, vitrineUrl: string): string {
    return `Olá! Gostaria de saber mais sobre:

💎 *${produto.nome}*
${produto.categoria ? `📂 Categoria: ${produto.categoria}` : ''}
${produto.material ? `✨ Material: ${produto.material}` : ''}
💰 Valor: ${this.formatarPreco(produto.preco)}

🔗 ${vitrineUrl}`;
  }
}
