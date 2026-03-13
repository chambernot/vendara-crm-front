import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesApiService, Sale, SalesSummary } from '../data-access';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { SaleFormComponent } from '../ui/sale-form/sale-form.component';
import { ProductService } from '../../catalog/data-access/product.service';
import { ClientsApiService } from '../../clients/data-access/clients-api.service';

@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    SaleFormComponent,
  ],
  templateUrl: './sales-list.page.html',
  styleUrls: ['./sales-list.page.css'],
})
export class SalesListPage implements OnInit {
  sales = signal<Sale[]>([]);
  loading = signal(true);
  showSaleForm = signal(false);
  
  // Mapa de clientId → clientName
  private clientNames = signal<Record<string, string>>({});
  
  // Filtros - inicializar com data de hoje (exibir vendas do dia)
  startDate = signal(this.getToday());
  endDate = signal(this.getToday());

  // Resumo calculado a partir das vendas filtradas
  filteredSummary = computed(() => {
    const salesList = this.sales();
    return {
      totalSales: salesList.length,
      totalAmount: salesList.reduce((sum, sale) => sum + (sale.total || 0), 0),
    };
  });

  // Mapeamento de labels de forma de pagamento
  paymentMethodLabels: Record<string, string> = {
    PIX: 'PIX',
    CARTAO: 'Cartão',
    DINHEIRO: 'Dinheiro',
    TRANSFERENCIA: 'Transferência',
    OUTRO: 'Outro',
  };

  constructor(
    private salesApi: SalesApiService,
    private productService: ProductService,
    private clientsApi: ClientsApiService
  ) {}

  ngOnInit(): void {
    this.loadClients();
    this.loadSales();
  }

  /** Carrega a lista de clientes para resolver nomes */
  private loadClients(): void {
    this.clientsApi.list({ pageSize: 500 }).subscribe({
      next: (clients) => {
        const map: Record<string, string> = {};
        clients.forEach(c => { map[c.id] = c.name; });
        this.clientNames.set(map);
        // Enriquecer vendas já carregadas
        this.enrichSalesWithClientNames();
      },
      error: (err) => console.error('❌ Erro ao carregar clientes:', err),
    });
  }

  /** Adiciona clientName às vendas que possuem clientId */
  private enrichSalesWithClientNames(): void {
    const names = this.clientNames();
    const currentSales = this.sales();
    if (Object.keys(names).length === 0 || currentSales.length === 0) return;
    const enriched = currentSales.map(sale => ({
      ...sale,
      clientName: sale.clientName || (sale.clientId ? names[sale.clientId] : undefined),
    }));
    this.sales.set(enriched);
  }

  loadSales(): void {
    this.loading.set(true);
    const query: any = {};
    
    if (this.startDate()) {
      // Enviar início do dia em UTC para evitar problemas de timezone
      query.startDate = this.startDate() + 'T00:00:00.000Z';
    }
    if (this.endDate()) {
      // Enviar fim do dia em UTC para incluir vendas do dia inteiro
      query.endDate = this.endDate() + 'T23:59:59.999Z';
    }

    this.salesApi.listSales(query).subscribe({
      next: (result: any) => {
        this.sales.set(result.items);
        this.enrichSalesWithClientNames();
        this.loading.set(false);
        console.log('✅ [SalesList] Vendas carregadas:', result.items.length);
      },
      error: (error: any) => {
        console.error('❌ [SalesList] Erro ao carregar vendas:', error);
        this.loading.set(false);
      },
    });
  }

  openSaleForm(): void {
    this.showSaleForm.set(true);
  }

  closeSaleForm(): void {
    this.showSaleForm.set(false);
  }

  onSaleCreated(sale: Sale): void {
    console.log('✅ [SalesList] Venda criada:', sale);
    this.showSaleForm.set(false);
    
    // Recarregar vendas
    this.loadSales();
    
    // Recarregar produtos vendidos para atualizar o estoque no catálogo
    const productIds = sale.items.map(item => item.productId);
    productIds.forEach(productId => {
      this.productService.getById(productId).subscribe({
        next: (product) => {
          console.log('✅ Produto atualizado no cache:', product.name);
        },
        error: (error) => {
          console.error('❌ Erro ao atualizar produto:', error);
        }
      });
    });
  }

  applyFilters(): void {
    this.loadSales();
  }

  clearFilters(): void {
    this.startDate.set(this.getToday());
    this.endDate.set(this.getToday());
    this.loadSales();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /** Retorna a data de hoje no formato YYYY-MM-DD */
  private getToday(): string {
    const now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  }

  /** Retorna o primeiro dia do mês atual no formato YYYY-MM-DD */
  private getFirstDayOfMonth(): string {
    const now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-01';
  }
}
