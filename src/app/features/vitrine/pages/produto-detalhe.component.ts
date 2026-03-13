import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { VitrineService, Produto } from '../services/vitrine.service';
import { VitrineTrackingService } from '../services/vitrine-tracking.service';
import { ProductCardComponent } from '../components/product-card.component';

@Component({
  selector: 'app-produto-detalhe',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white">
      <!-- Header -->
      <header class="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <button
              (click)="voltar()"
              class="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span class="font-medium text-sm uppercase tracking-wider">Voltar</span>
            </button>

            <button
              (click)="toggleFavorito()"
              class="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Adicionar aos favoritos"
            >
              <svg 
                class="w-6 h-6 transition-colors"
                [class.text-red-500]="isFavorito()"
                [class.text-gray-400]="!isFavorito()"
                [class.fill-current]="isFavorito()"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <!-- Loading -->
      @if (loading()) {
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 animate-pulse">
            <div>
              <div class="aspect-square bg-gray-200 rounded-lg mb-4"></div>
              <div class="grid grid-cols-4 gap-2">
                <div class="aspect-square bg-gray-200 rounded"></div>
                <div class="aspect-square bg-gray-200 rounded"></div>
                <div class="aspect-square bg-gray-200 rounded"></div>
                <div class="aspect-square bg-gray-200 rounded"></div>
              </div>
            </div>
            <div class="space-y-6">
              <div class="h-10 bg-gray-200 rounded w-3/4"></div>
              <div class="h-6 bg-gray-200 rounded w-1/2"></div>
              <div class="h-16 bg-gray-200 rounded w-1/3"></div>
              <div class="h-32 bg-gray-200 rounded"></div>
              <div class="h-14 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      }

      <!-- Error -->
      @if (error()) {
        <div class="flex flex-col items-center justify-center py-20 px-4">
          <div class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <span class="text-4xl">⚠️</span>
          </div>
          <h2 class="text-2xl font-semibold text-gray-900 mb-2 text-center">Produto não encontrado</h2>
          <p class="text-gray-600 mb-6 text-center">{{ error() }}</p>
          <button
            (click)="voltar()"
            class="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium shadow-lg transition-all"
          >
            Voltar ao Catálogo
          </button>
        </div>
      }

      <!-- Produto -->
      @if (produto() && !loading() && !error()) {
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <!-- Grid principal: Galeria + Info -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-16">
            
            <!-- Galeria de Imagens -->
            <div class="order-1">
              <div class="sticky top-24 space-y-4">
                <!-- Imagem Principal com Zoom -->
                <div 
                  class="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-zoom-in group"
                  (mouseenter)="zoomAtivo.set(true)"
                  (mouseleave)="zoomAtivo.set(false)"
                  (mousemove)="onMouseMove($event)"
                >
                  <img 
                    [src]="imagemSelecionada()"
                    [alt]="produto()!.nome"
                    class="w-full h-full object-cover transition-transform duration-300"
                    [class.scale-150]="zoomAtivo()"
                    [style.transform-origin]="transformOrigin()"
                  />
                  
                  <!-- Selos -->
                  <div class="absolute top-4 left-4 flex flex-col gap-2">
                    @if (produto()!.novidade) {
                      <span class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold bg-blue-500 text-white shadow-lg">
                        ✨ NOVIDADE
                      </span>
                    }
                    @if (produto()!.maisVendido) {
                      <span class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold bg-amber-500 text-white shadow-lg">
                        🔥 MAIS VENDIDO
                      </span>
                    }
                    @if (produto()!.promocao) {
                      <span class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold bg-red-500 text-white shadow-lg">
                        🏷️ PROMOÇÃO
                      </span>
                    }
                  </div>

                  <!-- Badge Disponibilidade -->
                  <div class="absolute top-4 right-4">
                    @if (produto()!.disponivel) {
                      <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-green-500 text-white shadow-sm">
                        <span class="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        Disponível
                      </span>
                    } @else {
                      <span class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-gray-600 text-white shadow-sm">
                        Indisponível
                      </span>
                    }
                  </div>
                </div>

                <!-- Thumbnails -->
                @if (produto()!.imagens.length > 1) {
                  <div class="grid grid-cols-4 gap-2">
                    @for (imagem of produto()!.imagens; track $index) {
                      <button
                        (click)="selecionarImagem($index)"
                        [class.ring-2]="imagemSelecionadaIndex() === $index"
                        [class.ring-gray-900]="imagemSelecionadaIndex() === $index"
                        class="aspect-square rounded overflow-hidden bg-gray-100 hover:opacity-75 transition-opacity"
                      >
                        <img 
                          [src]="imagem"
                          [alt]="produto()!.nome + ' - ' + ($index + 1)"
                          class="w-full h-full object-cover"
                        />
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Informações do Produto -->
            <div class="order-2 space-y-6">
              <!-- Código do Produto -->
              <div>
                <p class="text-sm text-gray-500 font-medium">
                  Ref: {{ produto()!.codigo }}
                </p>
              </div>

              <!-- Nome -->
              <h1 class="text-3xl lg:text-4xl font-serif tracking-wide text-gray-900 leading-tight">
                {{ produto()!.nome }}
              </h1>

              <!-- Categoria e Material -->
              <div class="flex flex-wrap items-center gap-3">
                @if (produto()!.categoria) {
                  <span class="px-3 py-1.5 bg-gray-100 text-gray-800 rounded text-sm font-medium">
                    {{ produto()!.categoria }}
                  </span>
                }
                @if (produto()!.material) {
                  <span class="px-3 py-1.5 bg-gray-100 text-gray-800 rounded text-sm font-medium">
                    {{ produto()!.material }}
                  </span>
                }
              </div>

              <!-- Preço -->
              <div class="py-6 border-y border-gray-200">
                <p class="text-sm text-gray-600 mb-2 uppercase tracking-wide">Preço</p>
                <p class="text-4xl font-bold text-gray-900">
                  {{ produto()!.preco | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                </p>
              </div>

              <!-- Botões de Ação -->
              <div class="flex gap-3">
                <button
                  (click)="chamarNoWhatsApp()"
                  [disabled]="!produto()!.disponivel"
                  class="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>Comprar via WhatsApp</span>
                </button>
                
                <button
                  (click)="toggleFavorito()"
                  class="px-6 py-4 border-2 border-gray-300 hover:border-gray-900 rounded-lg transition-all"
                  title="Adicionar aos favoritos"
                >
                  <svg 
                    class="w-6 h-6 transition-colors"
                    [class.text-red-500]="isFavorito()"
                    [class.text-gray-400]="!isFavorito()"
                    [class.fill-current]="isFavorito()"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>

              <!-- Descrição -->
              @if (produto()!.descricao) {
                <div class="pt-6">
                  <h2 class="text-lg font-semibold text-gray-900 mb-3 uppercase tracking-wide">Descrição</h2>
                  <p class="text-gray-700 leading-relaxed">
                    {{ produto()!.descricao }}
                  </p>
                </div>
              }

              <!-- Especificações -->
              <div class="pt-6 border-t border-gray-200">
                <h2 class="text-lg font-semibold text-gray-900 mb-4 uppercase tracking-wide">Especificações</h2>
                <dl class="space-y-3">
                  @if (produto()!.categoria) {
                    <div class="flex justify-between py-2 border-b border-gray-100">
                      <dt class="text-sm font-medium text-gray-600">Categoria</dt>
                      <dd class="text-sm font-semibold text-gray-900">{{ produto()!.categoria }}</dd>
                    </div>
                  }
                  @if (produto()!.material) {
                    <div class="flex justify-between py-2 border-b border-gray-100">
                      <dt class="text-sm font-medium text-gray-600">Material</dt>
                      <dd class="text-sm font-semibold text-gray-900">{{ produto()!.material }}</dd>
                    </div>
                  }
                  @if (colecao()) {
                    <div class="flex justify-between py-2 border-b border-gray-100">
                      <dt class="text-sm font-medium text-gray-600">Coleção</dt>
                      <dd class="text-sm font-semibold text-gray-900">{{ colecao() }}</dd>
                    </div>
                  }
                  @if (cor()) {
                    <div class="flex justify-between py-2 border-b border-gray-100">
                      <dt class="text-sm font-medium text-gray-600">Cor</dt>
                      <dd class="text-sm font-semibold text-gray-900">{{ cor() }}</dd>
                    </div>
                  }
                  @if (tamanho()) {
                    <div class="flex justify-between py-2 border-b border-gray-100">
                      <dt class="text-sm font-medium text-gray-600">Tamanho</dt>
                      <dd class="text-sm font-semibold text-gray-900">{{ tamanho() }}</dd>
                    </div>
                  }
                  <div class="flex justify-between py-2 border-b border-gray-100">
                    <dt class="text-sm font-medium text-gray-600">Código</dt>
                    <dd class="text-sm font-semibold text-gray-900">{{ produto()!.codigo }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <!-- Produtos Relacionados -->
          @if (produtosRelacionados().length > 0) {
            <div class="border-t border-gray-200 pt-16">
              <div class="text-center mb-12">
                <h2 class="text-3xl font-serif tracking-wider text-gray-900 mb-2">
                  Você Também Pode Gostar
                </h2>
                <div class="w-16 h-0.5 bg-gray-900 mx-auto mt-4"></div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                @for (produtoRel of produtosRelacionados(); track produtoRel.id) {
                  <app-product-card
                    [produto]="produtoRel"
                    (verDetalhes)="verOutroProduto($event)"
                    (pedirWhatsApp)="chamarWhatsAppProduto($event)"
                  />
                }
              </div>
            </div>
          }
        </main>
      }
    </div>
  `,
  styles: [`
    .cursor-zoom-in {
      cursor: zoom-in;
    }
  `]
})
export class ProdutoDetalheComponent implements OnInit {
  private vitrineService = inject(VitrineService);
  private trackingService = inject(VitrineTrackingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  produto = signal<Produto | null>(null);
  todosProdutos = signal<Produto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  workspaceSlug = '';
  produtoId = '';

  // Galeria
  imagemSelecionadaIndex = signal(0);
  zoomAtivo = signal(false);
  transformOrigin = signal('center center');

  // Favoritos (localStorage)
  favoritos = signal<string[]>([]);

  // Computed - imagem selecionada
  imagemSelecionada = computed(() => {
    const prod = this.produto();
    const index = this.imagemSelecionadaIndex();
    if (!prod || !prod.imagens || prod.imagens.length === 0) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y5ZmFmYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IiNkMWQ1ZGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn5KOPC90ZXh0Pjwvc3ZnPg==';
    }
    return prod.imagens[index] || prod.imagens[0];
  });

  // Computed - produtos relacionados (mesma categoria, excluindo o atual)
  produtosRelacionados = computed(() => {
    const prod = this.produto();
    if (!prod) return [];

    return this.todosProdutos()
      .filter(p => 
        p.id !== prod.id && 
        p.categoria === prod.categoria
      )
      .slice(0, 4);
  });

  // Computed - verificar se produto está favoritado
  isFavorito = computed(() => {
    const prod = this.produto();
    if (!prod) return false;
    return this.favoritos().includes(prod.id);
  });

  // Computed - campos estendidos do produto
  colecao = computed(() => {
    const prod = this.produto();
    return (prod as any)?.colecao || null;
  });

  cor = computed(() => {
    const prod = this.produto();
    return (prod as any)?.cor || null;
  });

  tamanho = computed(() => {
    const prod = this.produto();
    return (prod as any)?.tamanho || null;
  });

  ngOnInit(): void {
    this.workspaceSlug = this.route.snapshot.paramMap.get('workspaceSlug') || '';
    this.produtoId = this.route.snapshot.paramMap.get('productId') || '';

    if (!this.workspaceSlug || !this.produtoId) {
      this.error.set('Produto não encontrado');
      this.loading.set(false);
      return;
    }

    // Carregar favoritos do localStorage
    this.carregarFavoritos();

    // Carregar produto e relacionados
    this.carregarProduto();
    this.carregarProdutosRelacionados();

    // Scroll ao topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  carregarFavoritos(): void {
    if (typeof localStorage !== 'undefined') {
      const favoritosStr = localStorage.getItem('vendara_favoritos');
      if (favoritosStr) {
        try {
          const favs = JSON.parse(favoritosStr) as string[];
          this.favoritos.set(favs);
        } catch (e) {
          console.error('Erro ao carregar favoritos:', e);
          this.favoritos.set([]);
        }
      }
    }
  }

  salvarFavoritos(favoritos: string[]): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('vendara_favoritos', JSON.stringify(favoritos));
      } catch (e) {
        console.error('Erro ao salvar favoritos:', e);
      }
    }
  }

  toggleFavorito(): void {
    const prod = this.produto();
    if (!prod) return;

    const atuais = this.favoritos();
    let novos: string[];
    let isFavoritado = false;

    if (atuais.includes(prod.id)) {
      // Remover dos favoritos
      novos = atuais.filter(id => id !== prod.id);
      isFavoritado = false;
    } else {
      // Adicionar aos favoritos
      novos = [...atuais, prod.id];
      isFavoritado = true;
    }

    this.favoritos.set(novos);
    this.salvarFavoritos(novos);

    // Registrar ação de favoritar/desfavoritar
    this.trackingService.track(
      isFavoritado ? 'produto_favoritado' : 'produto_desfavoritado',
      this.workspaceSlug,
      {
        productId: prod.id,
        productName: prod.nome
      }
    );
  }

  selecionarImagem(index: number): void {
    this.imagemSelecionadaIndex.set(index);
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.zoomAtivo()) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    this.transformOrigin.set(`${x}% ${y}%`);
  }

  carregarProduto(): void {
    this.loading.set(true);
    this.error.set(null);

    this.vitrineService.getProduto(this.workspaceSlug, this.produtoId).subscribe({
      next: (produto) => {
        this.produto.set(produto);
        this.loading.set(false);
        
        // Registrar visualização do produto
        this.trackingService.track(
          'produto_visualizado',
          this.workspaceSlug,
          {
            productId: produto.id,
            productName: produto.nome,
            meta: {
              categoria: produto.categoria || '',
              preco: produto.preco
            }
          }
        );
      },
      error: (err) => {
        console.error('Erro ao carregar produto:', err);
        this.error.set('Não foi possível carregar o produto');
        this.loading.set(false);
      }
    });
  }

  carregarProdutosRelacionados(): void {
    this.vitrineService.getProdutos(this.workspaceSlug).subscribe({
      next: (produtos) => {
        this.todosProdutos.set(produtos);
      },
      error: (err) => {
        console.error('Erro ao carregar produtos relacionados:', err);
      }
    });
  }

  voltar(): void {
    this.router.navigate(['/vitrine', this.workspaceSlug, 'catalogo']);
  }

  chamarNoWhatsApp(): void {
    const prod = this.produto();
    if (!prod) return;

    // Registrar clique no WhatsApp
    this.trackingService.track(
      'produto_whatsapp_click',
      this.workspaceSlug,
      {
        productId: prod.id,
        productName: prod.nome,
        meta: {
          origem: 'detalhes',
          preco: prod.preco
        }
      }
    );

    const vitrineUrl = window.location.href;
    this.vitrineService.chamarNoWhatsApp(prod, vitrineUrl);
  }

  verOutroProduto(produto: Produto): void {
    // Navega para outro produto e recarrega
    this.router.navigate(['/vitrine', this.workspaceSlug, produto.id]).then(() => {
      this.produtoId = produto.id;
      this.imagemSelecionadaIndex.set(0); // Reset galeria
      this.carregarProduto();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  chamarWhatsAppProduto(produto: Produto): void {
    // Registrar clique no WhatsApp do produto relacionado
    this.trackingService.track(
      'produto_whatsapp_click',
      this.workspaceSlug,
      {
        productId: produto.id,
        productName: produto.nome,
        meta: {
          origem: 'relacionados',
          preco: produto.preco
        }
      }
    );

    const vitrineUrl = `${window.location.origin}/vitrine/${this.workspaceSlug}/${produto.id}`;
    this.vitrineService.chamarNoWhatsApp(produto, vitrineUrl);
  }
}
