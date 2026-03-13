import { Component, OnInit, Input, Output, EventEmitter, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesApiService, Sale, PaymentMethod, CreateSaleItemDto } from '../../data-access';
import { ProductService } from '../../../catalog/data-access/product.service';
import { Product } from '../../../catalog/data-access/catalog.models';
import { ClientsApiService } from '../../../clients/data-access/clients-api.service';
import { Client } from '../../../clients/data-access/clients.models';
import { ToastService } from '../../../../shared/services/toast.service';

interface SaleItemForm {
  id: string;
  product: Product | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale-form.component.html',
  styleUrls: ['./sale-form.component.css'],
})
export class SaleFormComponent implements OnInit {
  @Input() clientId?: string; // Optional clientId for pre-filling
  @Output() saleCreated = new EventEmitter<Sale>();
  @Output() cancel = new EventEmitter<void>();

  // Form fields
  selectedClient = signal<Client | null>(null);
  clientSearchTerm = '';
  paymentMethod = 'PIX' as PaymentMethod;
  notes = '';
  items = signal<SaleItemForm[]>([]);
  
  // Autocomplete
  clientSuggestions = signal<Client[]>([]);
  showClientSuggestions = signal(false);
  productSearchTerm = '';
  productSuggestions = signal<Product[]>([]);
  showProductSuggestions = signal(false);
  
  // UI state
  submitting = signal(false);
  errorMessage = signal('');

  // Payment methods
  paymentMethods: PaymentMethod[] = ['PIX', 'CARTAO', 'DINHEIRO', 'TRANSFERENCIA', 'OUTRO'];
  paymentMethodLabels: Record<PaymentMethod, string> = {
    PIX: 'PIX',
    CARTAO: 'Cartão',
    DINHEIRO: 'Dinheiro',
    TRANSFERENCIA: 'Transferência',
    OUTRO: 'Outro',
  };

  // Computed
  total = computed(() => {
    return this.validItems().reduce((sum, item) => sum + item.subtotal, 0);
  });

  validItems = computed(() => {
    return this.items().filter(i => i.product !== null && i.quantity > 0);
  });

  canSubmit = computed(() => {
    const hasItems = this.validItems().length > 0;
    const hasPaymentMethod = Boolean(this.paymentMethod);
    const noStockExceeded = !this.validItems().some(item => this.isQuantityExceeded(item));
    return hasItems && hasPaymentMethod && noStockExceeded && !this.submitting();
  });

  constructor(
    private salesApi: SalesApiService,
    private productService: ProductService,
    private clientsApi: ClientsApiService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // If clientId is provided, load that client
    if (this.clientId) {
      this.loadClientById(this.clientId);
    }
  }

  // Load client by ID (when opened from client detail)
  private loadClientById(clientId: string): void {
    this.clientsApi.getById(clientId).subscribe({
      next: (client) => {
        this.selectedClient.set(client);
        console.log('✅ Cliente pré-carregado:', client.name);
      },
      error: (error) => {
        console.error('❌ Erro ao carregar cliente:', error);
        this.toastService.showError('Erro ao carregar informações do cliente');
      },
    });
  }

  // Cliente autocomplete
  searchClients(): void {
    const term = this.clientSearchTerm.trim();
    if (term.length < 2) {
      this.clientSuggestions.set([]);
      this.showClientSuggestions.set(false);
      return;
    }

    // Busca todos os clientes e filtra por nome localmente
    this.clientsApi.list({ pageSize: 100 }).subscribe({
      next: (clients: any) => {
        const filtered = clients.filter((c: Client) =>
          c.name.toLowerCase().includes(term.toLowerCase())
        ).slice(0, 10);
        this.clientSuggestions.set(filtered);
        this.showClientSuggestions.set(filtered.length > 0);
      },
      error: (error: any) => {
        console.error('Erro ao buscar clientes:', error);
      },
    });
  }

  selectClient(client: Client): void {
    this.selectedClient.set(client);
    this.clientSearchTerm = client.name;
    this.showClientSuggestions.set(false);
  }

  clearClient(): void {
    this.selectedClient.set(null);
    this.clientSearchTerm = '';
  }

  // Produto autocomplete
  searchProducts(): void {
    const term = this.productSearchTerm.trim();
    if (term.length < 2) {
      this.productSuggestions.set([]);
      this.showProductSuggestions.set(false);
      return;
    }

    this.productService.list({ name: term, activeOnly: true, pageSize: 20 }).subscribe({
      next: (result) => {
        // Mostra todos os produtos ativos, mesmo sem estoque
        this.productSuggestions.set(result.items);
        this.showProductSuggestions.set(result.items.length > 0);
      },
      error: (error) => {
        console.error('Erro ao buscar produtos:', error);
      },
    });
  }

  selectProduct(product: Product): void {
    // Verifica se o produto tem estoque
    if (product.quantityAvailable <= 0) {
      this.errorMessage.set(`O produto "${product.name}" está sem estoque disponível.`);
      this.showProductSuggestions.set(false);
      return;
    }

    // Adiciona o produto como novo item
    const newItem: SaleItemForm = {
      id: this.generateId(),
      product: product,
      quantity: 1,
      unitPrice: product.price,
      subtotal: product.price,
    };
    
    this.items.update(items => [...items, newItem]);
    this.productSearchTerm = '';
    this.showProductSuggestions.set(false);
    this.errorMessage.set(''); // Limpa mensagem de erro se havia
  }

  // Gerenciar itens
  removeItem(itemId: string): void {
    this.items.update(items => items.filter(i => i.id !== itemId));
  }

  updateItemQuantity(itemId: string, quantity: string): void {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return;
    
    this.items.update(items =>
      items.map(item => {
        if (item.id === itemId) {
          const newQuantity = Math.max(1, qty);
          return {
            ...item,
            quantity: newQuantity,
            subtotal: newQuantity * item.unitPrice,
          };
        }
        return item;
      })
    );
  }

  updateItemPrice(itemId: string, price: string): void {
    const prc = parseFloat(price);
    if (isNaN(prc) || prc < 0) return;
    
    this.items.update(items =>
      items.map(item => {
        if (item.id === itemId) {
          const newPrice = Math.max(0, prc);
          return {
            ...item,
            unitPrice: newPrice,
            subtotal: item.quantity * newPrice,
          };
        }
        return item;
      })
    );
  }

  getMaxQuantity(product: Product | null): number {
    return product ? product.quantityAvailable : 999;
  }

  isQuantityExceeded(item: SaleItemForm): boolean {
    return item.product ? item.quantity > item.product.quantityAvailable : false;
  }

  // Submit
  submitSale(): void {
    // Validações
    const validItems = this.validItems();
    
    if (validItems.length === 0) {
      this.errorMessage.set('Adicione pelo menos um produto à venda');
      return;
    }

    if (!this.paymentMethod) {
      this.errorMessage.set('Selecione uma forma de pagamento');
      return;
    }

    // Verifica estoque
    for (const item of validItems) {
      if (this.isQuantityExceeded(item)) {
        this.errorMessage.set(
          `Quantidade de ${item.product!.name} excede o estoque disponível (${item.product!.quantityAvailable})`
        );
        return;
      }
    }

    this.submitting.set(true);
    this.errorMessage.set('');

    const dto = {
      clientId: this.selectedClient()?.id,
      paymentMethod: this.paymentMethod,
      notes: this.notes.trim() || undefined,
      items: validItems.map(item => ({
        productId: item.product!.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };

    this.salesApi.createSale(dto).subscribe({
      next: (sale) => {
        console.log('✅ Venda criada com sucesso:', sale);
        this.toastService.showSuccess('Venda registrada com sucesso!');
        this.saleCreated.emit(sale);
      },
      error: (error) => {
        console.error('❌ Erro ao criar venda:', error);
        
        // Trata erro de estoque insuficiente
        if (error.error?.code === 'INSUFFICIENT_STOCK') {
          const productName = error.error?.data?.productName || 'produto';
          const available = error.error?.data?.available || 0;
          this.errorMessage.set(
            `Estoque insuficiente para ${productName}. Disponível: ${available} unidade(s).`
          );
        } else if (error.error?.message) {
          this.errorMessage.set(error.error.message);
        } else if (error.error?.errors && error.error.errors.length > 0) {
          this.errorMessage.set(error.error.errors.join(', '));
        } else {
          this.errorMessage.set('Erro ao registrar venda. Tente novamente.');
        }
        
        this.submitting.set(false);
      },
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private generateId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
