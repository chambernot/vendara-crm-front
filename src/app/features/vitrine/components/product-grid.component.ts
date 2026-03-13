import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Produto } from '../services/vitrine.service';
import { ProductCardComponent } from './product-card.component';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Loading Skeleton -->
    @if (loading()) {
      <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2">
        @for (item of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; track item) {
          <div class="bg-white rounded overflow-hidden animate-pulse border border-gray-100">
            <div class="aspect-[3/4] bg-gray-100"></div>
            <div class="p-1.5 space-y-1">
              <div class="h-2 bg-gray-100 rounded w-2/3"></div>
              <div class="h-2 bg-gray-100 rounded w-full"></div>
              <div class="h-2.5 bg-gray-100 rounded w-1/2"></div>
            </div>
          </div>
        }
      </div>
    }

    <!-- Empty State -->
    @if (!loading() && produtos().length === 0) {
      <div class="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <span class="text-3xl">💎</span>
        </div>
        <h2 class="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
          {{ mensagemVazia() || 'Nenhum produto encontrado' }}
        </h2>
        <p class="text-sm text-gray-500 text-center max-w-md">
          {{ submensagemVazia() || 'Em breve teremos novidades incríveis para você!' }}
        </p>
      </div>
    }

    <!-- Products Grid -->
    @if (!loading() && produtos().length > 0) {
      <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2">
        @for (produto of produtos(); track produto.id) {
          <app-product-card
            [produto]="produto"
            (cardClick)="produtoClick.emit($event)"
            (whatsappClick)="whatsappClick.emit($event)"
          />
        }
      </div>
    }
  `,
  styles: []
})
export class ProductGridComponent {
  // Inputs
  produtos = input.required<Produto[]>();
  loading = input<boolean>(false);
  mensagemVazia = input<string>('');
  submensagemVazia = input<string>('');

  // Outputs
  produtoClick = output<Produto>();
  whatsappClick = output<Produto>();
}
