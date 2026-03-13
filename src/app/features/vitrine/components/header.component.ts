import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VitrineService, Produto } from '../services/vitrine.service';

interface Category {
  name: string;
  value: string;
}

// Force rebuild
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
      <!-- Barra 1 - Informações Comerciais -->
      <div class="bg-gray-100 border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4">
          <div class="flex items-center justify-center gap-6 h-10 text-xs text-gray-700">
            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span class="hidden sm:inline">Frete grátis acima de R$200</span>
              <span class="sm:hidden">Frete grátis R$200+</span>
            </div>
            <div class="hidden md:flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Garantia nas peças</span>
            </div>
            <button 
              (click)="onWhatsAppClick()"
              class="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span class="hidden sm:inline">Atendimento via WhatsApp</span>
              <span class="sm:hidden">WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Barra 2 - Header Principal -->
      <div class="border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4">
          <div class="flex items-center gap-4 h-[70px]">
            
            <!-- Menu Hambúrguer (Mobile) -->
            <button 
              (click)="toggleMobileMenu()"
              class="lg:hidden w-10 h-10 flex items-center justify-center text-gray-700 hover:text-gray-900"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <!-- Logo (Esquerda) -->
            <div class="flex-shrink-0">
              <h1 class="text-xl sm:text-2xl font-serif tracking-wider text-gray-900">
                {{ titulo() }}
              </h1>
            </div>

            <!-- Menu de Categorias (Desktop) -->
            <nav class="hidden lg:flex items-center gap-6">
              @for (category of categories; track category.value) {
                <button
                  (click)="navegarParaCategoria(category.value)"
                  class="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  {{ category.name }}
                </button>
              }
            </nav>

            <!-- Campo de Busca (Centro) -->
            <div class="hidden md:flex flex-1 max-w-xl mx-4 relative">
              <div class="relative w-full">
                <input
                  type="text"
                  [value]="buscaAtual()"
                  (input)="onSearch($event)"
                  (focus)="showSuggestions.set(true)"
                  (blur)="onBlurSearch()"
                  placeholder="Buscar produtos ou código"
                  class="w-full px-4 py-2.5 pl-11 text-sm bg-gray-50 border border-gray-300 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white transition-all"
                />
                <svg 
                  class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                
                <!-- Dropdown de Sugestões -->
                @if (showSuggestions() && buscaAtual().trim() && sugestoesFiltradas().length > 0) {
                  <div class="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                    <div class="p-2 text-xs text-gray-500 font-medium border-b border-gray-100">
                      {{ sugestoesFiltradas().length }} resultado(s) encontrado(s)
                    </div>
                    @for (produto of sugestoesFiltradas(); track produto.id) {
                      <button
                        (mousedown)="selecionarProduto(produto)"
                        class="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0"
                      >
                        <img 
                          [src]="produto.imagens[0]" 
                          [alt]="produto.nome"
                          class="w-12 h-12 object-cover rounded"
                        />
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 truncate">{{ produto.nome }}</p>
                          <p class="text-xs text-gray-500">{{ produto.codigo }}</p>
                        </div>
                        <p class="text-sm font-semibold text-gray-900">
                          R$ {{ produto.preco.toFixed(2).replace('.', ',') }}
                        </p>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Ícones (Direita) -->
            <div class="flex items-center gap-2 ml-auto">
              <!-- Ícone busca (mobile) -->
              <button 
                (click)="toggleMobileSearch()"
                class="md:hidden w-10 h-10 flex items-center justify-center text-gray-700 hover:text-gray-900"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              <!-- Ícone usuário/conta -->
              <button 
                class="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-gray-900 transition-colors"
                title="Minha Conta"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              <!-- Ícone carrinho -->
              <button 
                class="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-gray-900 transition-colors relative"
                title="Carrinho"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span class="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                  0
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Menu Mobile (Hambúrguer) -->
      @if (isMobileMenuOpen()) {
        <div class="lg:hidden border-b border-gray-200 bg-white">
          <nav class="max-w-7xl mx-auto px-4 py-3 space-y-1">
            @for (category of categories; track category.value) {
              <button
                (click)="navegarParaCategoria(category.value); closeMobileMenu()"
                class="w-full text-left block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded transition-colors"
              >
                {{ category.name }}
              </button>
            }
          </nav>
        </div>
      }

      <!-- Campo de Busca Mobile -->
      @if (isMobileSearchOpen()) {
        <div class="md:hidden border-b border-gray-200 bg-white">
          <div class="max-w-7xl mx-auto px-4 py-3">
            <div class="relative">
              <input
                type="text"
                [value]="buscaAtual()"
                (input)="onSearch($event)"
                (focus)="showSuggestions.set(true)"
                (blur)="onBlurSearch()"
                placeholder="Buscar produtos ou código"
                class="w-full px-4 py-2.5 pl-11 text-sm bg-gray-50 border border-gray-300 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white transition-all"
                autofocus
              />
              <svg 
                class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <!-- Sugestões Mobile -->
            @if (showSuggestions() && buscaAtual().trim() && sugestoesFiltradas().length > 0) {
              <div class="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <div class="p-2 text-xs text-gray-500 font-medium border-b border-gray-100">
                  {{ sugestoesFiltradas().length }} resultado(s)
                </div>
                @for (produto of sugestoesFiltradas(); track produto.id) {
                  <button
                    (mousedown)="selecionarProduto(produto)"
                    class="w-full flex items-center gap-2 p-2 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0"
                  >
                    <img 
                      [src]="produto.imagens[0]" 
                      [alt]="produto.nome"
                      class="w-10 h-10 object-cover rounded"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-medium text-gray-900 truncate">{{ produto.nome }}</p>
                      <p class="text-xs text-gray-500">R$ {{ produto.preco.toFixed(2).replace('.', ',') }}</p>
                    </div>
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    </header>

    <!-- Spacer para compensar header fixo -->
    <div class="h-[80px]"></div>
  `,
  styles: []
})
export class HeaderComponent {
  private router = inject(Router);
  private vitrineService = inject(VitrineService);
  
  // Inputs
  titulo = input<string>('Minha Joalheria');
  subtitulo = input<string>('');
  buscaAtual = input<string>('');
  workspaceSlug = input<string>('');
  todosProdutos = input<Produto[]>([]);

  // Outputs
  buscaChange = output<string>();
  whatsappClick = output<void>();

  // State
  isMobileMenuOpen = signal(false);
  isMobileSearchOpen = signal(false);
  showSuggestions = signal(false);
  
  // Sugestões filtradas baseadas na busca
  sugestoesFiltradas = computed(() => {
    const termo = this.buscaAtual().toLowerCase().trim();
    console.log('🔍 [Header] Computed - Termo busca:', termo);
    console.log('🔍 [Header] Computed - Total produtos:', this.todosProdutos().length);
    
    if (!termo) {
      console.log('🔍 [Header] Termo vazio, retornando array vazio');
      return [];
    }
    
    const filtrados = this.todosProdutos()
      .filter(p => 
        p.nome.toLowerCase().includes(termo) ||
        p.codigo.toLowerCase().includes(termo) ||
        p.categoria?.toLowerCase().includes(termo) ||
        p.material?.toLowerCase().includes(termo)
      )
      .slice(0, 8); // Máximo 8 sugestões
    
    console.log('🔍 [Header] Produtos filtrados:', filtrados.length);
    return filtrados;
  });

  // Categorias de produtos
  categories: Category[] = [
    { name: 'Anéis', value: 'ANEL' },
    { name: 'Colares', value: 'COLAR' },
    { name: 'Brincos', value: 'BRINCO' },
    { name: 'Pulseiras', value: 'PULSEIRA' },
    { name: 'Conjuntos', value: 'CONJUNTO' }
  ];

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    console.log('🔍 [Header] Busca digitada:', value);
    console.log('🔍 [Header] Produtos disponíveis:', this.todosProdutos().length);
    console.log('🔍 [Header] Sugestões filtradas:', this.sugestoesFiltradas().length);
    this.buscaChange.emit(value);
    this.showSuggestions.set(true);
  }

  onBlurSearch(): void {
    // Delay para permitir click no produto
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  selecionarProduto(produto: Produto): void {
    const slug = this.workspaceSlug();
    if (slug) {
      this.router.navigate(['/vitrine', slug, produto.id]);
    }
    this.showSuggestions.set(false);
    this.isMobileSearchOpen.set(false);
  }

  navegarParaCategoria(categoria: string): void {
    const slug = this.workspaceSlug();
    if (slug) {
      this.router.navigate(['/vitrine', slug, 'catalogo'], {
        queryParams: { categoria }
      });
    }
  }

  onWhatsAppClick(): void {
    this.whatsappClick.emit();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
    if (this.isMobileMenuOpen()) {
      this.isMobileSearchOpen.set(false);
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  toggleMobileSearch(): void {
    this.isMobileSearchOpen.set(!this.isMobileSearchOpen());
    if (this.isMobileSearchOpen()) {
      this.isMobileMenuOpen.set(false);
    }
  }
}
