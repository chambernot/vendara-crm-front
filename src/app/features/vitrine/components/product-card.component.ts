import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Produto } from '../services/vitrine.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="bg-white overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-2xl"
      [class.opacity-60]="!produto().disponivel"
    >
      <!-- Imagem -->
      <div class="relative aspect-[4/5] overflow-hidden bg-gray-50">
        <img 
          [src]="produto().imagens[0]" 
          [alt]="produto().nome"
          (error)="onImageError($event)"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        
        <!-- Badges superiores -->
        <div class="absolute top-3 left-3 flex flex-col gap-2">
          @if (produto().novidade) {
            <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold bg-blue-600 text-white shadow-lg">
              NOVIDADE
            </span>
          }
          @if (produto().promocao) {
            <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold bg-red-600 text-white shadow-lg animate-pulse">
              PROMOÇÃO
            </span>
          }
          @if (produto().maisVendido) {
            <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold bg-amber-500 text-white shadow-lg">
              MAIS VENDIDO
            </span>
          }
        </div>

        <!-- Badge de disponibilidade -->
        <div class="absolute top-3 right-3">
          @if (produto().disponivel) {
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold bg-green-600 text-white shadow-sm">
              <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              Disponível
            </span>
          } @else if (getEstoqueStatus() === 'esgotado') {
            <span class="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-semibold bg-gray-700 text-white shadow-sm">
              ESGOTADO
            </span>
          } @else if (getEstoqueStatus() === 'ultima-peca') {
            <span class="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-semibold bg-orange-600 text-white shadow-sm">
              ÚLTIMA PEÇA
            </span>
          } @else {
            <span class="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-semibold bg-purple-600 text-white shadow-sm">
              SOB ENCOMENDA
            </span>
          }
        </div>
      </div>

      <!-- Conteúdo -->
      <div class="p-3">
        <!-- Código e Categoria -->
        <div class="flex items-center justify-between mb-1">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {{ produto().codigo }}
          </p>
          @if (produto().categoria) {
            <span class="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
              {{ produto().categoria }}
            </span>
          }
        </div>

        <!-- Nome do produto -->
        <h3 class="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 leading-snug min-h-[2.5rem]">
          {{ produto().nome }}
        </h3>

        <!-- Material (se houver) -->
        @if (produto().material) {
          <p class="text-xs text-gray-600 mb-2 flex items-center gap-1">
            <span class="text-gray-400">✨</span>
            {{ produto().material }}
          </p>
        }

        <!-- Preço DESTACADO -->
        <div class="mb-3">
          <p class="text-xl font-semibold text-gray-900 tracking-tight">
            {{ produto().preco | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
          </p>
          @if (produto().promocao) {
            <p class="text-sm text-gray-500 line-through">
              {{ (produto().preco * 1.2) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
            </p>
          }
        </div>

        <!-- Botões -->
        <div class="flex gap-2">
          <button
            (click)="verDetalhes.emit(produto())"
            class="flex-1 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold tracking-wider uppercase transition-colors duration-200"
          >
            Ver Produto
          </button>
          <button
            (click)="pedirWhatsApp.emit(produto())"
            [disabled]="!produto().disponivel"
            class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold tracking-wider uppercase transition-colors duration-200 flex items-center justify-center gap-1"
            title="Pedir no WhatsApp"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span class="hidden sm:inline">WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ProductCardComponent {
  // Inputs
  produto = input.required<Produto>();

  // Outputs
  verDetalhes = output<Produto>();
  pedirWhatsApp = output<Produto>();
  
  // Legacy outputs (manter compatibilidade)
  cardClick = output<Produto>();
  whatsappClick = output<Produto>();

  // Determina o status do estoque para exibir badge correto
  getEstoqueStatus(): 'esgotado' | 'ultima-peca' | 'sob-encomenda' {
    // Por padrão, se não disponível, considera esgotado
    // Futuramente pode-se adicionar lógica baseada em quantityAvailable
    return 'esgotado';
  }

  // Método para lidar com erro de carregamento de imagem
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    // Usa uma imagem placeholder cinza
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y5ZmFmYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IiNkMWQ1ZGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn5KOPC90ZXh0Pjwvc3ZnPg==';
  }
}
