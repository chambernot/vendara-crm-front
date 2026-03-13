import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ConsignationsStore } from '../../data-access';
import { ClientsStore } from '../../../clients/data-access';
import { CatalogStore } from '../../../catalog/data-access';
import { Client } from '../../../clients/data-access/clients.models';
import { Product } from '../../../catalog/data-access/catalog.models';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-consignation-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './consignation-create.page.html'
})
export class ConsignationCreatePage implements OnInit {
  form!: FormGroup;
  clients = signal<Client[]>([]);
  availableProducts = signal<Product[]>([]);
  isLoading = signal(true);
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);
  searchClientTerm = signal('');
  searchProductTerm = signal('');

  private currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  constructor(
    private fb: FormBuilder,
    private consignationsStore: ConsignationsStore,
    private clientsStore: ClientsStore,
    private catalogStore: CatalogStore,
    private router: Router
  ) {}

  ngOnInit() {
    this.initForm();
    this.loadData();
  }

  initForm() {
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      productId: ['', Validators.required],
      expectedReturnAt: [''],
      notes: ['']
    });
  }

  loadData() {
    this.isLoading.set(true);
    
    Promise.all([
      this.clientsStore.getClients().toPromise(),
      this.catalogStore.getProducts().toPromise()
    ]).then(([clients, products]) => {
      this.clients.set(clients || []);
      this.availableProducts.set((products || []).filter(p => p.status === 'available'));
      this.isLoading.set(false);
    }).catch(() => {
      this.isLoading.set(false);
      this.errorMessage.set('Erro ao carregar dados');
    });
  }

  get filteredClients(): Client[] {
    const term = this.searchClientTerm().toLowerCase();
    if (!term) return this.clients();
    return this.clients().filter(c => c.name.toLowerCase().includes(term));
  }

  get filteredProducts(): Product[] {
    const term = this.searchProductTerm().toLowerCase();
    if (!term) return this.availableProducts();
    return this.availableProducts().filter(p => p.name.toLowerCase().includes(term));
  }

  formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.value;
    this.consignationsStore.create({
      clientId: formValue.clientId,
      productId: formValue.productId,
      expectedReturnAt: formValue.expectedReturnAt || undefined,
      notes: formValue.notes || undefined
    }).subscribe({
      next: (newId) => {
        this.router.navigate(['/app/consignacoes', newId]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.message || 'Erro ao criar consignação');
      }
    });
  }

  cancel() {
    this.router.navigate(['/app/consignacoes']);
  }

  navigateToCatalog() {
    this.router.navigate(['/app/catalogo']);
  }
}
