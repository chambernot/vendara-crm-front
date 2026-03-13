import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Product, ProductMaterial, ProductType } from '../../data-access';
import { ProductListQuery, ProductService } from '../../data-access/product.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { BehaviorSubject, Subscription, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { StockMovementModalComponent, StockMovementFormData } from '../../ui/stock-movement-modal/stock-movement-modal.component';
import { StockMovementService } from '../../data-access/stock-movement.service';
import { StockMovementCreateDto } from '../../data-access';
import { SalesApiService } from '../../../sales/data-access/sales-api.service';

@Component({
  selector: 'app-catalog-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, EmptyStateComponent, StockMovementModalComponent],
  templateUrl: './catalog-list.page.html'
})
export class CatalogListPage implements OnInit {
  private productService = inject(ProductService);
  private stockMovementService = inject(StockMovementService);
  private salesApiService = inject(SalesApiService);
  private toast = inject(ToastService);
  private subs = new Subscription();

  products = signal<Product[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  hasNext = signal(false);

  // Modal de movimentação
  selectedProductForMovement = signal<Product | null>(null);

  // filtros
  searchTerm = signal('');
  selectedType = signal<ProductType | 'all'>('all');
  selectedMaterial = signal<ProductMaterial | 'all'>('all');
  activeOnly = signal(true);
  sort = signal<ProductListQuery['sort']>('updatedAt_desc');

  pageNumber = signal(1);
  readonly pageSize = 24;

  private query$ = new BehaviorSubject<ProductListQuery>({
    pageNumber: 1,
    pageSize: this.pageSize,
    sort: 'updatedAt_desc',
    activeOnly: true,
  });

  readonly typeOptions: Array<{ value: ProductType | 'all'; label: string }> = [
    { value: 'all', label: 'Todos os tipos' },
    { value: 'ANEL', label: 'Anel' },
    { value: 'COLAR', label: 'Colar' },
    { value: 'PULSEIRA', label: 'Pulseira' },
    { value: 'BRINCO', label: 'Brinco' },
    { value: 'CORRENTE', label: 'Corrente' },
    { value: 'OUTRO', label: 'Outro' },
  ];

  readonly materialOptions: Array<{ value: ProductMaterial | 'all'; label: string }> = [
    { value: 'all', label: 'Todos os materiais' },
    { value: 'OURO', label: 'Ouro' },
    { value: 'PRATA', label: 'Prata' },
    { value: 'ACO', label: 'Aço' },
    { value: 'PEROLA', label: 'Pérola' },
    { value: 'FOLHEADO', label: 'Folheado' },
    { value: 'OUTRO', label: 'Outro' },
  ];

  readonly sortOptions: Array<{ value: ProductListQuery['sort']; label: string }> = [
    { value: 'updatedAt_desc', label: 'Atualizados recentemente' },
    { value: 'name_asc', label: 'Nome (A-Z)' },
    { value: 'price_asc', label: 'Preço (menor)' },
    { value: 'price_desc', label: 'Preço (maior)' },
  ];

  ngOnInit(): void {
    this.subs.add(
      this.query$
        .pipe(
          debounceTime(250),
          distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
          tap(() => this.loading.set(true)),
          switchMap((query) =>
            this.productService.list(query).pipe(
              catchError((err) => {
                this.toast.showError(err?.message || 'Erro ao carregar produtos');
                return of({ items: [] as Product[], hasNext: false });
              })
            )
          )
        )
        .subscribe((result) => {
          this.products.set(result.items);
          this.hasNext.set(Boolean(result.hasNext));
          this.loading.set(false);
        })
    );

    this.applyFilters(true);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  formatCurrency(price: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  }

  formatPricePlain(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }

  getTypeLabel(type: ProductType): string {
    const labels: Record<string, string> = {
      ANEL: 'Anel',
      COLAR: 'Colar',
      PULSEIRA: 'Pulseira',
      BRINCO: 'Brinco',
      CORRENTE: 'Corrente',
      OUTRO: 'Outro',
    };
    return labels[type] || type;
  }

  getMaterialLabel(material: string): string {
    const labels: Record<string, string> = {
      OURO: 'Ouro',
      PRATA: 'Prata',
      ACO: 'Aço',
      PEROLA: 'Pérola',
      FOLHEADO: 'Folheado',
      OUTRO: 'Outro',
    };
    return labels[material] || material;
  }

  trackByProductId(index: number, product: Product): string {
    return product.id;
  }

  /** Monta a URL completa para exibir a imagem */
  getFullImageUrl(relativePath: string): string {
    return this.productService.getFullImageUrl(relativePath);
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.applyFilters(true);
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ProductType | 'all';
    this.selectedType.set(value);
    this.applyFilters(true);
  }

  onMaterialChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ProductMaterial | 'all';
    this.selectedMaterial.set(value);
    this.applyFilters(true);
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ProductListQuery['sort'];
    this.sort.set(value);
    this.applyFilters(true);
  }

  toggleActiveOnly(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.activeOnly.set(checked);
    this.applyFilters(true);
  }

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasNext()) return;

    const nextPage = this.pageNumber() + 1;
    this.loadingMore.set(true);

    this.productService
      .list(this.buildQuery(nextPage))
      .pipe(
        catchError((err) => {
          this.toast.showError(err?.message || 'Erro ao carregar mais produtos');
          return of({ items: [] as Product[], hasNext: this.hasNext() });
        }),
        map((r) => ({ items: r.items, hasNext: Boolean(r.hasNext) }))
      )
      .subscribe(({ items, hasNext }) => {
        this.products.set([...(this.products() || []), ...items]);
        this.hasNext.set(hasNext);
        this.pageNumber.set(nextPage);
        this.loadingMore.set(false);
      });
  }

  shareOnWhatsApp(product: Product): void {
    const typeLabel = this.getTypeLabel(product.type);
    const materialLabel = this.getMaterialLabel(product.material);
    const pricePlain = this.formatPricePlain(product.price);
    const qtd = product.quantityAvailable ?? 0;

    let msg = `✨ ${product.name}\nTipo: ${typeLabel}\nMaterial: ${materialLabel}\nPreço: R$ ${pricePlain}\nDisponível: ${qtd}`;
    if (product.photoUrl) {
      msg += `\n${product.photoUrl}`;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  private applyFilters(resetPage: boolean): void {
    if (resetPage) {
      this.pageNumber.set(1);
    }
    this.query$.next(this.buildQuery(this.pageNumber()));
  }

  private buildQuery(pageNumber: number): ProductListQuery {
    return {
      name: this.searchTerm().trim() || undefined,
      type: this.selectedType() === 'all' ? undefined : this.selectedType(),
      material: this.selectedMaterial() === 'all' ? undefined : this.selectedMaterial(),
      activeOnly: this.activeOnly(),
      sort: this.sort() || 'updatedAt_desc',
      pageNumber,
      pageSize: this.pageSize,
    };
  }

  // Movimentação de Estoque
  openStockMovementModal(product: Product): void {
    this.selectedProductForMovement.set(product);
  }

  closeStockMovementModal(): void {
    this.selectedProductForMovement.set(null);
  }

  onStockMovementSave(formData: StockMovementFormData): void {
    const product = this.selectedProductForMovement();
    if (!product) return;

    // Se for VENDA, registrar via API de vendas (que já deduz estoque automaticamente)
    if (formData.type === 'VENDA') {
      this.salesApiService
        .createSale({
          paymentMethod: formData.paymentMethod || 'PIX',
          items: [
            {
              productId: product.id,
              quantity: formData.quantity,
              unitPrice: product.price,
            },
          ],
          notes: formData.observation,
        })
        .pipe(
          switchMap(() => this.productService.getById(product.id)),
          catchError((err) => {
            const errorMsg =
              err?.error?.message ||
              err?.error?.errors?.join(', ') ||
              err?.message ||
              'Erro ao registrar venda';
            this.toast.showError(errorMsg);
            this.closeStockMovementModal();
            return of(null);
          })
        )
        .subscribe((updatedProduct) => {
          if (updatedProduct) {
            const currentProducts = this.products();
            const index = currentProducts.findIndex((p) => p.id === product.id);
            if (index !== -1) {
              currentProducts[index] = updatedProduct;
              this.products.set([...currentProducts]);
            }
            this.toast.showSuccess('Venda registrada com sucesso');
          }
          this.closeStockMovementModal();
        });
      return;
    }

    // ENTRADA ou AJUSTE: fluxo normal de movimentação de estoque
    let quantityDelta = formData.quantity;
    if (formData.type === 'AJUSTE') {
      quantityDelta = formData.adjustmentMode === 'decrease' ? -quantityDelta : quantityDelta;
    }
    // ENTRADA: delta já é positivo

    const dto: StockMovementCreateDto = {
      productId: product.id,
      type: formData.type,
      quantityDelta,
      observation: formData.observation,
    };

    this.stockMovementService
      .create(dto)
      .pipe(
        switchMap(() => this.productService.getById(product.id)),
        catchError((err) => {
          const errorMsg = err?.error?.message || err?.message || 'Erro ao registrar movimentação';
          this.toast.showError(errorMsg);
          this.closeStockMovementModal();
          return of(null);
        })
      )
      .subscribe((updatedProduct) => {
        if (updatedProduct) {
          // Atualizar produto na lista
          const currentProducts = this.products();
          const index = currentProducts.findIndex((p) => p.id === product.id);
          if (index !== -1) {
            currentProducts[index] = updatedProduct;
            this.products.set([...currentProducts]);
          }
          this.toast.showSuccess('Movimentação registrada com sucesso');
        }
        this.closeStockMovementModal();
      });
  }
}
