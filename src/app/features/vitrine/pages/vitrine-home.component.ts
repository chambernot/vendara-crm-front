import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { VitrineService, Produto } from '../services/vitrine.service';
import { VitrineTrackingService } from '../services/vitrine-tracking.service';
import { ProductCardComponent } from '../components/product-card.component';
import { HeaderComponent } from '../components/header.component';

@Component({
  selector: 'app-vitrine-home',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white">
      <!-- Header -->
      <app-header 
        [titulo]="workspaceSlug || 'Minha Joalheria'"
        [workspaceSlug]="workspaceSlug"
        [buscaAtual]="termoBusca"
        [todosProdutos]="produtos()"
        (buscaChange)="onBuscaChange($event)"
        (whatsappClick)="abrirWhatsApp()"
      />

      <!-- Hero Section -->
      <section class="relative h-[70vh] md:h-[85vh] overflow-hidden">
        <!-- Imagem de fundo -->
        <div class="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1920&q=80"
            alt="Joias elegantes"
            class="w-full h-full object-cover"
          />
          <!-- Overlay branco suave para legibilidade -->
          <div class="absolute inset-0 bg-white/70 backdrop-blur-sm"></div>
        </div>
        
        <div class="relative h-full flex items-center justify-center px-4">
          <div class="text-center max-w-4xl mx-auto">
            <div class="mb-6 md:mb-8">
              <span class="inline-block text-xs md:text-sm tracking-[0.3em] text-gray-700 uppercase mb-4 font-medium">
                Joias Exclusivas
              </span>
            </div>
            
            <h1 class="font-serif text-5xl md:text-7xl lg:text-8xl tracking-wider text-gray-900 mb-6 md:mb-8 leading-tight">
              Elegância Atemporal
            </h1>
            
            <p class="text-base md:text-lg text-gray-700 max-w-2xl mx-auto mb-10 md:mb-14 leading-relaxed">
              Descubra peças únicas que contam histórias e celebram momentos especiais
            </p>
            
            <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                (click)="scrollToSection('novidades')"
                class="w-full sm:w-auto px-10 py-4 bg-gray-900 hover:bg-gray-800 text-white text-sm tracking-wider uppercase transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
              >
                Explorar Coleção
              </button>
              <button
                (click)="abrirWhatsApp()"
                class="w-full sm:w-auto px-10 py-4 border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white text-sm tracking-wider uppercase transition-all duration-300 hover:scale-105"
              >
                Fale Conosco
              </button>
            </div>
          </div>
        </div>
        
        <!-- Scroll Indicator -->
        <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </div>
      </section>

      <!-- Categorias Section -->
      <section class="py-16 md:py-24 px-4 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-12 md:mb-16">
            <h2 class="font-serif text-3xl md:text-5xl tracking-wider text-gray-900 mb-4">
              Categorias
            </h2>
            <div class="w-16 h-0.5 bg-gray-900 mx-auto"></div>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            @for (categoria of categoriasComContador(); track categoria.nome) {
              <button
                (click)="navegarParaCategoria(categoria.valor)"
                class="group relative aspect-square overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500"
              >
                <!-- Imagem de fundo real -->
                <img 
                  [src]="categoria.imagem"
                  [alt]="categoria.nome"
                  class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                
                <!-- Overlay gradiente -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:from-black/90 transition-all duration-500"></div>
                
                <!-- Badge contador -->
                @if (categoria.quantidade > 0) {
                  <div class="absolute top-3 right-3 bg-white/90 text-gray-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    {{ categoria.quantidade }}
                  </div>
                }
                
                <!-- Nome da categoria -->
                <div class="absolute inset-0 flex flex-col items-center justify-end p-4 md:p-6">
                  <span class="text-3xl md:text-4xl mb-2 group-hover:scale-110 transition-transform duration-300">
                    {{ categoria.icone }}
                  </span>
                  <h3 class="text-white text-base md:text-lg font-semibold tracking-wider uppercase text-center">
                    {{ categoria.nome }}
                  </h3>
                  @if (categoria.quantidade > 0) {
                    <p class="text-white/80 text-xs mt-1">{{ categoria.quantidade }} {{ categoria.quantidade === 1 ? 'pe\u00e7a' : 'pe\u00e7as' }}</p>
                  }
                </div>
              </button>
            }
          </div>
        </div>
      </section>

      <!-- Novidades Section -->
      <section id="novidades" class="py-16 md:py-24 px-4 bg-gray-50">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-12 md:mb-16">
            <span class="text-xs md:text-sm tracking-[0.3em] text-gray-600 uppercase mb-2 block">
              Recém-chegados
            </span>
            <h2 class="font-serif text-3xl md:text-5xl tracking-wider text-gray-900 mb-4">
              Novidades
            </h2>
            <div class="w-16 h-0.5 bg-gray-900 mx-auto"></div>
          </div>
          
          @if (loading()) {
            <div class="flex justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          } @else if (novidades().length > 0) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              @for (produto of novidades(); track produto.id) {
                <app-product-card
                  [produto]="produto"
                  (verDetalhes)="verDetalhes($event)"
                  (pedirWhatsApp)="pedirWhatsApp($event)"
                />
              }
            </div>
          } @else {
            <div class="text-center py-12 text-gray-500">
              <div class="text-4xl mb-4">✨</div>
              <p class="text-base font-medium mb-2">Em breve, novidades incríveis!</p>
              <p class="text-sm">Estamos preparando lançamentos exclusivos para você</p>
            </div>
          }
        </div>
      </section>

      <!-- Promoções Section -->
      @if (promocoes().length > 0) {
        <section class="py-16 md:py-24 px-4 bg-gradient-to-br from-red-50 to-orange-50">
          <div class="max-w-7xl mx-auto">
            <div class="text-center mb-12 md:mb-16">
              <span class="text-xs md:text-sm tracking-[0.3em] text-red-600 uppercase mb-2 block font-bold">
                Ofertas Especiais
              </span>
              <h2 class="font-serif text-3xl md:text-5xl tracking-wider text-gray-900 mb-4">
                Em Promoção
              </h2>
              <div class="w-16 h-0.5 bg-red-600 mx-auto"></div>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              @for (produto of promocoes(); track produto.id) {
                <app-product-card
                  [produto]="produto"
                  (verDetalhes)="verDetalhes($event)"
                  (pedirWhatsApp)="pedirWhatsApp($event)"
                />
              }
            </div>
          </div>
        </section>
      }

      <!-- Mais Vendidos Section -->
      <section class="py-16 md:py-24 px-4 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-12 md:mb-16">
            <span class="text-xs md:text-sm tracking-[0.3em] text-gray-600 uppercase mb-2 block">
              Favoritos dos Clientes
            </span>
            <h2 class="font-serif text-3xl md:text-5xl tracking-wider text-gray-900 mb-4">
              Mais Vendidos
            </h2>
            <div class="w-16 h-0.5 bg-gray-900 mx-auto"></div>
          </div>
          
          @if (loading()) {
            <div class="flex justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          } @else if (maisVendidos().length > 0) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              @for (produto of maisVendidos(); track produto.id) {
                <app-product-card
                  [produto]="produto"
                  (verDetalhes)="verDetalhes($event)"
                  (pedirWhatsApp)="pedirWhatsApp($event)"
                />
              }
            </div>
          } @else {
            <div class="text-center py-12 text-gray-500">
              <div class="text-4xl mb-4">🏆</div>
              <p class="text-base font-medium mb-2">Nossos favoritos estão chegando</p>
              <p class="text-sm">Em breve você verá os produtos mais amados pelos clientes</p>
            </div>
          }
        </div>
      </section>

      <!-- Mais Vistos Section -->
      <section class="py-16 md:py-24 px-4 bg-gray-50">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-12 md:mb-16">
            <span class="text-xs md:text-sm tracking-[0.3em] text-gray-600 uppercase mb-2 block">
              Tendências
            </span>
            <h2 class="font-serif text-3xl md:text-5xl tracking-wider text-gray-900 mb-4">
              Mais Vistos
            </h2>
            <div class="w-16 h-0.5 bg-gray-900 mx-auto"></div>
          </div>
          
          @if (loading()) {
            <div class="flex justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          } @else if (maisVistos().length > 0) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              @for (produto of maisVistos(); track produto.id) {
                <app-product-card
                  [produto]="produto"
                  (verDetalhes)="verDetalhes($event)"
                  (pedirWhatsApp)="pedirWhatsApp($event)"
                />
              }
            </div>
          } @else {
            <div class="text-center py-12 text-gray-500">
              <div class="text-4xl mb-4">🔥</div>
              <p class="text-base font-medium mb-2">Explore nossa coleção</p>
              <p class="text-sm">Navegue pelo catálogo e descubra as tendências do momento</p>
            </div>
          }
        </div>
      </section>

      <!-- Escolha por Material Section -->
      @if (materiaisDisponiveis().length > 0) {
        <section class="py-16 md:py-24 px-4 bg-white">
          <div class="max-w-7xl mx-auto">
            <div class="text-center mb-12 md:mb-16">
              <span class="text-xs md:text-sm tracking-[0.3em] text-gray-600 uppercase mb-2 block">
                Exclusividade
              </span>
              <h2 class="font-serif text-3xl md:text-5xl tracking-wider text-gray-900 mb-4">
                Escolha por Material
              </h2>
              <div class="w-16 h-0.5 bg-gray-900 mx-auto"></div>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              @for (material of materiaisDisponiveis(); track material.nome) {
                <button
                  (click)="navegarParaMaterial(material.nome)"
                  class="group relative p-6 md:p-8 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:shadow-xl hover:scale-105"
                >
                  <div class="text-center">
                    <div class="text-4xl md:text-5xl mb-3">{{ material.icone }}</div>
                    <h3 class="text-sm md:text-base font-semibold text-gray-900 mb-2">
                      {{ material.nome.replace('_', ' ') }}
                    </h3>
                    <p class="text-xs text-gray-600">{{ material.quantidade }} {{ material.quantidade === 1 ? 'pe\u00e7a' : 'pe\u00e7as' }}</p>
                  </div>
                </button>
              }
            </div>
          </div>
        </section>
      }

      <!-- Coleções Section -->
      @if (colecoesDisponiveis().length > 0) {
        <section class="py-16 md:py-24 px-4 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div class="max-w-7xl mx-auto">
            <div class="text-center mb-12 md:mb-16">
              <span class="text-xs md:text-sm tracking-[0.3em] text-gray-300 uppercase mb-2 block">
                Exclusividade
              </span>
              <h2 class="font-serif text-3xl md:text-5xl tracking-wider mb-4">
                Nossas Coleções
              </h2>
              <div class="w-16 h-0.5 bg-white mx-auto mb-4"></div>
              <p class="text-sm text-gray-300">Descubra as suas novas joias favoritas</p>
            </div>
            
            <div class="space-y-12 md:space-y-16">
              @for (colecao of colecoesDisponiveis(); track colecao.nome) {
                <div class="border-t border-white/10 pt-8">
                  <div class="flex items-center justify-between mb-8">
                    <div>
                      <h3 class="font-serif text-2xl md:text-3xl tracking-wider mb-2">
                        {{ colecao.nome }}
                      </h3>
                      <p class="text-sm text-gray-400">{{ colecao.quantidade }} {{ colecao.quantidade === 1 ? 'peça' : 'peças' }}</p>
                    </div>
                    <button
                      (click)="navegarParaColecao(colecao.nome)"
                      class="text-xs tracking-wider uppercase text-white hover:text-gray-300 transition-colors inline-flex items-center gap-2"
                    >
                      Ver Tudo
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                      </svg>
                    </button>
                  </div>
                  
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    @for (produto of colecao.produtos; track produto.id) {
                      <app-product-card
                        [produto]="produto"
                        (verDetalhes)="verDetalhes($event)"
                        (pedirWhatsApp)="pedirWhatsApp($event)"
                      />
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      }

      <!-- Seção Confiança -->
      <section class="py-16 md:py-24 px-4 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-12 md:mb-16">
            <h2 class="font-serif text-3xl md:text-5xl tracking-wider text-gray-900 mb-4">
              Por Que Nos Escolher
            </h2>
            <div class="w-16 h-0.5 bg-gray-900 mx-auto"></div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            @for (item of confianca; track item.titulo) {
              <div class="text-center group">
                <div class="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-50 group-hover:bg-gray-900 transition-colors duration-300 mb-6">
                  <span class="text-3xl md:text-4xl group-hover:scale-110 transition-transform duration-300">
                    {{ item.icone }}
                  </span>
                </div>
                <h3 class="text-lg md:text-xl font-semibold text-gray-900 mb-3 tracking-wide">
                  {{ item.titulo }}
                </h3>
                <p class="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
                  {{ item.descricao }}
                </p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- CTA Final -->
      <section class="py-16 md:py-24 px-4 bg-gradient-to-br from-gray-50 to-gray-100">
        <div class="max-w-4xl mx-auto text-center">
          <h2 class="font-serif text-3xl md:text-5xl tracking-wider text-gray-900 mb-6">
            Encontre Sua Joia Perfeita
          </h2>
          <p class="text-sm md:text-base text-gray-600 mb-8 md:mb-12 leading-relaxed">
            Estamos aqui para ajudá-lo a encontrar a peça ideal.
            Entre em contato e descubra uma coleção exclusiva.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              (click)="navegarParaCatalogo()"
              class="w-full sm:w-auto px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white text-sm tracking-wider uppercase transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Ver Catálogo Completo
            </button>
            <button
              (click)="abrirWhatsApp()"
              class="w-full sm:w-auto px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-sm tracking-wider uppercase transition-all duration-300 inline-flex items-center justify-center gap-3"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Chamar no WhatsApp
            </button>
          </div>
        </div>
      </section>

      <!-- Footer Minimalista -->
      <footer class="py-8 px-4 bg-gray-900 text-white text-center">
        <p class="text-xs tracking-wider uppercase text-gray-400">
          {{ currentYear }} • {{ workspaceSlug }} • Joias de Excelência
        </p>
      </footer>
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
export class VitrineHomeComponent implements OnInit {
  private vitrineService = inject(VitrineService);
  private trackingService = inject(VitrineTrackingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  produtos = signal<Produto[]>([]);
  loading = signal(true);
  workspaceSlug = '';
  termoBusca = '';
  currentYear = new Date().getFullYear();

  // Categorias
  categorias = [
    { 
      nome: 'Anéis', 
      valor: 'ANEL', 
      icone: '💍',
      imagem: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80'
    },
    { 
      nome: 'Colares', 
      valor: 'COLAR', 
      icone: '📿',
      imagem: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80'
    },
    { 
      nome: 'Brincos', 
      valor: 'BRINCO', 
      icone: '✨',
      imagem: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80'
    },
    { 
      nome: 'Pulseiras', 
      valor: 'PULSEIRA', 
      icone: '⚜️',
      imagem: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80'
    }
  ];

  // Seção de Confiança
  confianca = [
    {
      icone: '🏆',
      titulo: 'Qualidade Garantida',
      descricao: 'Cada peça é cuidadosamente selecionada e inspecionada para garantir a máxima qualidade.'
    },
    {
      icone: '🔒',
      titulo: 'Compra Segura',
      descricao: 'Atendimento personalizado e processo de compra totalmente seguro via WhatsApp.'
    },
    {
      icone: '💌',
      titulo: 'Atendimento Exclusivo',
      descricao: 'Acompanhamento dedicado em cada etapa, desde a escolha até a entrega da sua joia.'
    }
  ];

  // Computed - Novidades (produtos marcados como novidade)
  novidades = computed(() => 
    this.produtos()
      .filter(p => p.novidade)
      .slice(0, 4)
  );

  // Computed - Mais vendidos
  maisVendidos = computed(() => 
    this.produtos()
      .filter(p => p.maisVendido)
      .slice(0, 4)
  );

  // Computed - Mais vistos (baseado em tracking)
  maisVistos = computed(() => {
    const stats = this.trackingService.getStats(this.workspaceSlug, 30); // últimos 30 dias
    const produtosVistosIds = stats.produtosMaisVistos.map(p => p.productId);
    
    // Filtrar produtos que estão nos mais vistos
    return this.produtos()
      .filter(p => produtosVistosIds.includes(p.id))
      .slice(0, 4);
  });

  // Computed - Promoções (produtos em promoção)
  promocoes = computed(() => 
    this.produtos()
      .filter(p => p.promocao)
      .slice(0, 4)
  );

  // Computed - Categorias com contadores dinâmicos
  categoriasComContador = computed(() => {
    return this.categorias.map(cat => ({
      ...cat,
      quantidade: this.produtos().filter(p => p.categoria === cat.valor).length
    }));
  });

  // Computed - Materiais únicos dos produtos
  materiaisDisponiveis = computed(() => {
    const materiais = new Set(
      this.produtos()
        .map(p => p.material)
        .filter((m): m is string => Boolean(m))
    );
    return Array.from(materiais).map(material => ({
      nome: material,
      quantidade: this.produtos().filter(p => p.material === material).length,
      icone: this.getIconeMaterial(material)
    }));
  });

  // Computed - Coleções dinâmicas baseadas nos produtos
  colecoesDisponiveis = computed(() => {
    const colecoes = new Set(
      this.produtos()
        .map(p => (p as any).colecao)
        .filter((c): c is string => Boolean(c))
    );
    return Array.from(colecoes).map(colecao => ({
      nome: colecao,
      quantidade: this.produtos().filter(p => (p as any).colecao === colecao).length,
      produtos: this.produtos().filter(p => (p as any).colecao === colecao).slice(0, 4)
    }));
  });

  ngOnInit(): void {
    this.workspaceSlug = this.route.snapshot.paramMap.get('workspaceSlug') || '';

    if (this.workspaceSlug) {
      // Registrar abertura da home da vitrine
      this.trackingService.track('home_aberto', this.workspaceSlug);
      
      this.carregarProdutos();
    } else {
      this.loading.set(false);
    }
  }

  carregarProdutos(): void {
    this.loading.set(true);

    this.vitrineService.getProdutos(this.workspaceSlug).subscribe({
      next: (produtos) => {
        this.produtos.set(produtos);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar produtos:', err);
        this.loading.set(false);
      }
    });
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  navegarParaCategoria(categoria: string): void {
    this.router.navigate(['/vitrine', this.workspaceSlug, 'catalogo'], {
      queryParams: { categoria }
    });
  }

  navegarParaCatalogo(): void {
    this.router.navigate(['/vitrine', this.workspaceSlug, 'catalogo']);
  }

  verDetalhes(produto: Produto): void {
    // Registrar visualização do produto
    this.trackingService.track(
      'produto_visualizado',
      this.workspaceSlug,
      {
        productId: produto.id,
        productName: produto.nome
      }
    );

    this.router.navigate(['/vitrine', this.workspaceSlug, produto.id]);
  }

  pedirWhatsApp(produto: Produto): void {
    // Registrar clique no WhatsApp
    this.trackingService.track(
      'produto_whatsapp_click',
      this.workspaceSlug,
      {
        productId: produto.id,
        productName: produto.nome,
        meta: {
          origem: 'home',
          preco: produto.preco
        }
      }
    );

    const vitrineUrl = `${window.location.origin}/vitrine/${this.workspaceSlug}/${produto.id}`;
    this.vitrineService.chamarNoWhatsApp(produto, vitrineUrl);
  }

  abrirWhatsApp(): void {
    const mensagem = 'Olá! Gostaria de conhecer mais sobre suas joias exclusivas.';
    const encodedMessage = encodeURIComponent(mensagem);
    const telefone = '5511963723387';
    window.open(`https://wa.me/${telefone}?text=${encodedMessage}`, '_blank');
  }

  onBuscaChange(termo: string): void {
    console.log('🔍 [Home] Termo de busca recebido:', termo);
    this.termoBusca = termo;
  }

  navegarParaMaterial(material: string): void {
    this.router.navigate(['/vitrine', this.workspaceSlug, 'catalogo'], {
      queryParams: { material }
    });
  }

  navegarParaColecao(colecao: string): void {
    this.router.navigate(['/vitrine', this.workspaceSlug, 'catalogo'], {
      queryParams: { colecao }
    });
  }

  getIconeMaterial(material: string): string {
    const icones: Record<string, string> = {
      'OURO': '🥇',
      'PRATA': '⚪',
      'OURO_BRANCO': '💍',
      'PLATINA': '💎',
      'ACO': '⚙️'
    };
    return icones[material] || '✨';
  }
}
