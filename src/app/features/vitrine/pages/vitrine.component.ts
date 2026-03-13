import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { VitrineService, Produto } from '../services/vitrine.service';
import { VitrineTrackingService } from '../services/vitrine-tracking.service';
import { HeaderComponent } from '../components/header.component';
import { ProductCardComponent } from '../components/product-card.component';

type OrdenacaoType = 'relevancia' | 'maior-preco' | 'menor-preco' | 'mais-vendidos' | 'novidades';

@Component({
  selector: 'app-vitrine',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white">
      <!-- Header -->
      <app-header
        [titulo]="workspaceSlug"
        [subtitulo]="'Catálogo'"
        [buscaAtual]="termoBusca()"
        (buscaChange)="onBuscaChange($event)"
        (whatsappClick)="abrirWhatsAppGeral()"
      />

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <div class="flex flex-col lg:flex-row gap-6 lg:gap-8">
          <!-- Sidebar Filtros (Desktop) / Collapsible (Mobile) -->
          <aside class="w-full lg:w-64 flex-shrink-0">
            <!-- Toggle Filtros Mobile -->
            <button
              (click)="filtrosAbertos.set(!filtrosAbertos())"
              class="lg:hidden w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg mb-4 text-sm font-medium text-gray-900"
            >
              <span class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                </svg>
                Filtros
              </span>
              <svg class="w-5 h-5 transition-transform" [class.rotate-180]="filtrosAbertos()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            <!-- Painel de Filtros -->
            <div [class.hidden]="!filtrosAbertos() && isMobile()" class="space-y-6 bg-white lg:bg-transparent p-4 lg:p-0 rounded-lg border lg:border-0 border-gray-200">
              <!-- Header Filtros -->
              <div class="flex items-center justify-between pb-3 border-b border-gray-200">
                <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">Filtros</h3>
                @if (temFiltrosAtivos()) {
                  <button
                    (click)="limparFiltros()"
                    class="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Limpar
                  </button>
                }
              </div>

              <!-- Filtro Categoria -->
              <div>
                <h4 class="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Categoria</h4>
                <div class="space-y-2">
                  @for (cat of categorias(); track cat) {
                    <label class="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        [value]="cat"
                        [(ngModel)]="categoriaSelecionada"
                        (ngModelChange)="categoriaSelecionada.set($event)"
                        class="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                      />
                      <span class="ml-2 text-sm text-gray-700 group-hover:text-gray-900">{{ cat }}</span>
                    </label>
                  }
                </div>
              </div>

              <!-- Filtro Material -->
              @if (materiais().length > 0) {
                <div>
                  <h4 class="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Material</h4>
                  <div class="space-y-2">
                    @for (material of materiais(); track material) {
                      @if (material) {
                        <label class="flex items-center cursor-pointer group">
                          <input
                            type="checkbox"
                            [checked]="materiaisSelecionados().includes(material)"
                            (change)="toggleMaterial(material)"
                            class="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                          />
                          <span class="ml-2 text-sm text-gray-700 group-hover:text-gray-900">{{ material }}</span>
                        </label>
                      }
                    }
                  </div>
                </div>
              }

              <!-- Filtro Preço -->
              <div>
                <h4 class="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Faixa de Preço</h4>
                <div class="space-y-3">
                  <div>
                    <label class="text-xs text-gray-600 mb-1 block">Mínimo</label>
                    <input
                      type="number"
                      [(ngModel)]="precoMin"
                      (ngModelChange)="precoMin.set($event)"
                      placeholder="R$ 0"
                      min="0"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label class="text-xs text-gray-600 mb-1 block">Máximo</label>
                    <input
                      type="number"
                      [(ngModel)]="precoMax"
                      (ngModelChange)="precoMax.set($event)"
                      placeholder="R$ 10000"
                      min="0"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <!-- Filtro Coleção (se houver) -->
              @if (colecoes().length > 0) {
                <div>
                  <h4 class="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Coleção</h4>
                  <div class="space-y-2">
                    @for (colecao of colecoes(); track colecao) {
                      <label class="flex items-center cursor-pointer group">
                        <input
                          type="checkbox"
                          [checked]="colecoesSelecionadas().includes(colecao)"
                          (change)="toggleColecao(colecao)"
                          class="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                        />
                        <span class="ml-2 text-sm text-gray-700 group-hover:text-gray-900">{{ colecao }}</span>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>
          </aside>

          <!-- Área Principal -->
          <div class="flex-1 min-w-0">
            <!-- Toolbar: Resultados + Ordenação -->
            @if (!loading() && !error()) {
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
                <!-- Contador de Resultados -->
                <div>
                  <p class="text-sm text-gray-600">
                    <span class="font-semibold text-gray-900">{{ produtosFiltrados().length }}</span>
                    {{ produtosFiltrados().length === 1 ? 'produto encontrado' : 'produtos encontrados' }}
                  </p>
                </div>

                <!-- Ordenação -->
                <div class="flex items-center gap-2">
                  <label class="text-sm text-gray-600 hidden sm:block">Ordenar por:</label>
                  <select
                    [(ngModel)]="ordenacao"
                    (ngModelChange)="ordenacao.set($event)"
                    class="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                  >
                    <option value="relevancia">Relevância</option>
                    <option value="mais-vendidos">Mais Vendidos</option>
                    <option value="novidades">Novidades</option>
                    <option value="menor-preco">Menor Preço</option>
                    <option value="maior-preco">Maior Preço</option>
                  </select>
                </div>
              </div>
            }

            <!-- Error State -->
            @if (error()) {
              <div class="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
                <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <span class="text-3xl">⚠️</span>
                </div>
                <h2 class="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
                  Ops! Algo deu errado
                </h2>
                <p class="text-sm text-gray-600 text-center max-w-md mb-6">
                  {{ error() }}
                </p>
                <button
                  (click)="carregarProdutos()"
                  class="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all text-sm"
                >
                  Tentar novamente
                </button>
              </div>
            }

            <!-- Loading State -->
            @if (loading()) {
              <div class="flex items-center justify-center py-20">
                <div class="text-center">
                  <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
                  <p class="text-sm text-gray-600">Carregando produtos...</p>
                </div>
              </div>
            }

            <!-- Product Grid -->
            @if (!loading() && !error()) {
              @if (produtosFiltrados().length > 0) {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  @for (produto of produtosFiltrados(); track produto.id) {
                    <app-product-card
                      [produto]="produto"
                      (verDetalhes)="verDetalhes($event)"
                      (pedirWhatsApp)="chamarNoWhatsApp($event)"
                    />
                  }
                </div>
              } @else {
                <!-- Empty State -->
                <div class="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
                  <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <span class="text-3xl">🔍</span>
                  </div>
                  <h2 class="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
                    Nenhum produto encontrado
                  </h2>
                  <p class="text-sm text-gray-600 text-center max-w-md mb-6">
                    Tente ajustar os filtros ou fazer uma nova busca
                  </p>
                  @if (temFiltrosAtivos()) {
                    <button
                      (click)="limparFiltros()"
                      class="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all text-sm"
                    >
                      Limpar Filtros
                    </button>
                  }
                </div>
              }
            }
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `]
})
export class VitrineComponent implements OnInit {
  private vitrineService = inject(VitrineService);
  private trackingService = inject(VitrineTrackingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  produtos = signal<Produto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  termoBusca = signal('');
  categoriaSelecionada = signal<string>('TODOS');
  materiaisSelecionados = signal<string[]>([]);
  colecoesSelecionadas = signal<string[]>([]);
  precoMin = signal<number | null>(null);
  precoMax = signal<number | null>(null);
  ordenacao = signal<OrdenacaoType>('relevancia');
  filtrosAbertos = signal(false);
  workspaceSlug = '';

  // Subject para debounce da busca
  private buscaSubject = new Subject<string>();

  // Computed - categorias disponíveis
  categorias = computed(() => {
    const cats = new Set(this.produtos().map(p => p.categoria).filter(Boolean));
    return ['TODOS', ...Array.from(cats).sort()];
  });

  // Computed - materiais disponíveis
  materiais = computed(() => {
    const mats = new Set(this.produtos().map(p => p.material).filter(Boolean));
    return Array.from(mats).sort();
  });

  // Computed - coleções disponíveis
  colecoes = computed(() => {
    const cols = new Set(
      this.produtos()
        .map(p => (p as any).colecao)
        .filter(Boolean)
    );
    return Array.from(cols).sort();
  });

  // Computed - verifica se tem filtros ativos
  temFiltrosAtivos = computed(() => {
    return (
      this.categoriaSelecionada() !== 'TODOS' ||
      this.materiaisSelecionados().length > 0 ||
      this.colecoesSelecionadas().length > 0 ||
      this.precoMin() !== null ||
      this.precoMax() !== null
    );
  });

  // Computed - produtos filtrados e ordenados
  produtosFiltrados = computed(() => {
    let produtos = this.produtos();

    // Filtrar por categoria
    const categoria = this.categoriaSelecionada();
    if (categoria !== 'TODOS') {
      produtos = produtos.filter(p => p.categoria === categoria);
    }

    // Filtrar por material
    const materiais = this.materiaisSelecionados();
    if (materiais.length > 0) {
      produtos = produtos.filter(p => p.material && materiais.includes(p.material));
    }

    // Filtrar por coleção
    const colecoes = this.colecoesSelecionadas();
    if (colecoes.length > 0) {
      produtos = produtos.filter(p => {
        const colecaoProduto = (p as any).colecao;
        return colecaoProduto && colecoes.includes(colecaoProduto);
      });
    }

    // Filtrar por preço
    const min = this.precoMin();
    const max = this.precoMax();
    if (min !== null && min > 0) {
      produtos = produtos.filter(p => p.preco >= min);
    }
    if (max !== null && max > 0) {
      produtos = produtos.filter(p => p.preco <= max);
    }

    // Filtrar por busca
    const termo = this.termoBusca().toLowerCase().trim();
    if (termo) {
      produtos = produtos.filter(p => 
        p.nome.toLowerCase().includes(termo) ||
        p.descricao?.toLowerCase().includes(termo) ||
        p.categoria.toLowerCase().includes(termo) ||
        p.material?.toLowerCase().includes(termo) ||
        p.tags?.some(tag => tag.toLowerCase().includes(termo))
      );
    }

    // Ordenar
    const ordem = this.ordenacao();
    produtos = [...produtos]; // Clone para não mutar o array original

    switch (ordem) {
      case 'mais-vendidos':
        produtos.sort((a, b) => {
          // Produtos marcados como maisVendido primeiro
          if (a.maisVendido && !b.maisVendido) return -1;
          if (!a.maisVendido && b.maisVendido) return 1;
          return 0;
        });
        break;

      case 'novidades':
        produtos.sort((a, b) => {
          // Produtos marcados como novidade primeiro
          if (a.novidade && !b.novidade) return -1;
          if (!a.novidade && b.novidade) return 1;
          return 0;
        });
        break;

      case 'menor-preco':
        produtos.sort((a, b) => a.preco - b.preco);
        break;

      case 'maior-preco':
        produtos.sort((a, b) => b.preco - a.preco);
        break;

      case 'relevancia':
      default:
        // Mantém ordem original ou por relevância de busca
        break;
    }

    return produtos;
  });

  // Helper para detectar mobile
  isMobile = computed(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });

  ngOnInit(): void {
    // Captura workspace slug da rota
    this.workspaceSlug = this.route.snapshot.paramMap.get('workspaceSlug') || '';

    if (!this.workspaceSlug) {
      this.error.set('Workspace não encontrado na URL');
      this.loading.set(false);
      return;
    }

    // Registrar abertura do catálogo
    this.trackingService.track('catalogo_aberto', this.workspaceSlug);

    // Captura categoria da queryParam se existir
    const categoriaParam = this.route.snapshot.queryParamMap.get('categoria');
    if (categoriaParam) {
      this.categoriaSelecionada.set(categoriaParam);
    }

    // Configura debounce para busca
    this.buscaSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(termo => {
      this.termoBusca.set(termo);
      
      // Registrar busca realizada
      if (termo.trim()) {
        this.trackingService.track('busca_realizada', this.workspaceSlug, {
          meta: { termo }
        });
      }
    });

    // Carrega produtos
    this.carregarProdutos();
  }

  carregarProdutos(): void {
    this.loading.set(true);
    this.error.set(null);

    this.vitrineService.getProdutos(this.workspaceSlug).subscribe({
      next: (produtos) => {
        this.produtos.set(produtos);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar produtos:', err);
        
        let mensagemErro = 'Erro ao carregar produtos';
        if (err.status === 404) {
          mensagemErro = 'Catálogo não encontrado';
        } else if (err.status === 0) {
          mensagemErro = 'Erro de conexão. Verifique sua internet.';
        }
        
        this.error.set(mensagemErro);
        this.loading.set(false);
      }
    });
  }

  onBuscaChange(termo: string): void {
    this.buscaSubject.next(termo);
  }

  toggleMaterial(material: string): void {
    const atuais = this.materiaisSelecionados();
    if (atuais.includes(material)) {
      this.materiaisSelecionados.set(atuais.filter(m => m !== material));
    } else {
      this.materiaisSelecionados.set([...atuais, material]);
    }
  }

  toggleColecao(colecao: string): void {
    const atuais = this.colecoesSelecionadas();
    if (atuais.includes(colecao)) {
      this.colecoesSelecionadas.set(atuais.filter(c => c !== colecao));
    } else {
      this.colecoesSelecionadas.set([...atuais, colecao]);
    }
  }

  limparFiltros(): void {
    this.categoriaSelecionada.set('TODOS');
    this.materiaisSelecionados.set([]);
    this.colecoesSelecionadas.set([]);
    this.precoMin.set(null);
    this.precoMax.set(null);
    this.termoBusca.set('');
  }

  verDetalhes(produto: Produto): void {
    this.router.navigate(['/vitrine', this.workspaceSlug, produto.id]);
  }

  chamarNoWhatsApp(produto: Produto): void {
    // Registrar clique no WhatsApp
    this.trackingService.track(
      'produto_whatsapp_click',
      this.workspaceSlug,
      {
        productId: produto.id,
        productName: produto.nome,
        meta: {
          origem: 'catalogo',
          preco: produto.preco
        }
      }
    );

    const vitrineUrl = `${window.location.origin}/vitrine/${this.workspaceSlug}/${produto.id}`;
    this.vitrineService.chamarNoWhatsApp(produto, vitrineUrl);
  }

  abrirWhatsAppGeral(): void {
    const mensagem = 'Olá! Gostaria de conhecer mais sobre suas joias.';
    const encodedMessage = encodeURIComponent(mensagem);
    const telefone = '5511963723387';
    window.open(`https://wa.me/${telefone}?text=${encodedMessage}`, '_blank');
  }
}
