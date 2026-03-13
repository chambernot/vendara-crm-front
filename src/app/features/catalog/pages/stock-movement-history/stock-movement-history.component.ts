import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StockMovementService } from '../../data-access/stock-movement.service';
import { StockMovement, StockMovementListQuery, StockMovementType } from '../../data-access/stock-movement.models';
import { ToastService } from '../../../../shared/services/toast.service';
import { catchError, of } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-stock-movement-history',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, RouterLink],
  templateUrl: './stock-movement-history.component.html',
})
export class StockMovementHistoryComponent implements OnInit {
  private stockMovementService = inject(StockMovementService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  movements = signal<StockMovement[]>([]);
  loading = signal(true);
  hasNext = signal(false);
  pageNumber = signal(1);
  readonly pageSize = 20;

  // Filtros
  productId = signal<string | undefined>(undefined);
  selectedType = signal<StockMovementType | 'all'>('all');
  fromDate = signal<string>('');
  toDate = signal<string>('');

  readonly typeOptions: Array<{ value: StockMovementType | 'all'; label: string }> = [
    { value: 'all', label: 'Todos os tipos' },
    { value: 'ENTRADA', label: 'Entrada' },
    { value: 'VENDA', label: 'Venda' },
    { value: 'AJUSTE', label: 'Ajuste' },
  ];

  ngOnInit(): void {
    // Verifica se existe productId na query
    this.route.queryParams.subscribe((params) => {
      if (params['productId']) {
        this.productId.set(params['productId']);
      }
      this.loadMovements();
    });
  }

  loadMovements(append: boolean = false): void {
    this.loading.set(true);

    const query: StockMovementListQuery = {
      productId: this.productId(),
      type: this.selectedType() === 'all' ? undefined : (this.selectedType() as StockMovementType),
      fromDate: this.fromDate() || undefined,
      toDate: this.toDate() || undefined,
      pageNumber: append ? this.pageNumber() + 1 : 1,
      pageSize: this.pageSize,
    };

    this.stockMovementService
      .list(query)
      .pipe(
        catchError((err) => {
          this.toast.showError(err?.message || 'Erro ao carregar movimentações');
          return of({ items: [], hasNext: false, pageNumber: 1 });
        })
      )
      .subscribe((result) => {
        if (append) {
          this.movements.set([...this.movements(), ...result.items]);
          this.pageNumber.set(result.pageNumber);
        } else {
          this.movements.set(result.items);
          this.pageNumber.set(1);
        }
        this.hasNext.set(result.hasNext);
        this.loading.set(false);
      });
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as StockMovementType | 'all';
    this.selectedType.set(value);
    this.loadMovements();
  }

  onFromDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.fromDate.set(value);
    this.loadMovements();
  }

  onToDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.toDate.set(value);
    this.loadMovements();
  }

  loadMore(): void {
    if (this.loading() || !this.hasNext()) return;
    this.loadMovements(true);
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  getTypeLabel(type: StockMovementType): string {
    const labels: Record<StockMovementType, string> = {
      ENTRADA: 'Entrada',
      VENDA: 'Venda',
      AJUSTE: 'Ajuste',
    };
    return labels[type];
  }

  getTypeColor(type: StockMovementType): string {
    const colors: Record<StockMovementType, string> = {
      ENTRADA: 'bg-green-100 text-green-800 border-green-200',
      VENDA: 'bg-red-100 text-red-800 border-red-200',
      AJUSTE: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return colors[type];
  }

  getDeltaSign(delta: number): string {
    return delta >= 0 ? '+' : '';
  }

  getDeltaColor(delta: number): string {
    return delta >= 0 ? 'text-green-600' : 'text-red-600';
  }

  trackById(index: number, movement: StockMovement): string {
    return movement.id;
  }
}
