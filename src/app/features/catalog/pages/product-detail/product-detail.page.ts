import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { Product, ProductMaterial, ProductType } from '../../data-access';
import { ProductService } from '../../data-access/product.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './product-detail.page.html'
})
export class ProductDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private toast = inject(ToastService);

  product = signal<Product | null>(null);
  loading = signal(true);
  notFound = signal(false);
  saving = signal(false);
  editMode = signal(false);

  productTypes: ProductType[] = ['ANEL', 'COLAR', 'PULSEIRA', 'BRINCO', 'CORRENTE', 'OUTRO'];
  productMaterials: ProductMaterial[] = ['OURO', 'PRATA', 'ACO', 'PEROLA', 'FOLHEADO', 'OUTRO'];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['ANEL' as ProductType, Validators.required],
    material: ['OURO' as ProductMaterial, Validators.required],
    price: [0, [Validators.required, Validators.min(0.01)]],
    quantityAvailable: [0, [Validators.required, Validators.min(0)]],
    photoUrl: [''],
    notes: [''],
    active: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.productService.getById(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.patchForm(product);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.showError(err?.message || 'Produto não encontrado');
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
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
      OUTRO: 'Outro'
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
      OUTRO: 'Outro'
    };
    return labels[material] || material;
  }

  goBack(): void {
    this.router.navigate(['/app/catalogo']);
  }

  toggleEdit(): void {
    const next = !this.editMode();
    this.editMode.set(next);
    if (next && this.product()) {
      this.patchForm(this.product()!);
    }
  }

  cancelEdit(): void {
    if (this.product()) {
      this.patchForm(this.product()!);
    }
    this.editMode.set(false);
  }

  save(): void {
    const product = this.product();
    if (!product) return;

    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach((key) => this.form.get(key)?.markAsTouched());
      return;
    }

    const v = this.form.value;
    this.saving.set(true);

    this.productService
      .update(product.id, {
        name: v.name!,
        type: v.type!,
        material: v.material!,
        price: Number(v.price!),
        quantityAvailable: Number(v.quantityAvailable ?? 0),
        photoUrl: (v.photoUrl || undefined) ?? undefined,
        notes: (v.notes || undefined) ?? undefined,
        active: v.active ?? true,
      })
      .subscribe({
        next: (updated) => {
          this.product.set(updated);
          this.patchForm(updated);
          this.saving.set(false);
          this.editMode.set(false);
          this.toast.showSuccess('Produto atualizado com sucesso');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.showError(err?.message || 'Erro ao atualizar produto');
        },
      });
  }

  deactivate(): void {
    const product = this.product();
    if (!product) return;
    if (!confirm('Deseja desativar este produto?')) return;

    this.saving.set(true);
    this.productService.deactivate(product.id).subscribe({
      next: (updated) => {
        this.product.set(updated);
        this.patchForm(updated);
        this.saving.set(false);
        this.toast.showSuccess('Produto desativado');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.showError(err?.message || 'Erro ao desativar produto');
      },
    });
  }

  shareOnWhatsApp(): void {
    const product = this.product();
    if (!product) return;

    const msgLines: string[] = [];
    msgLines.push(`✨ ${product.name}`);
    msgLines.push(`Tipo: ${this.getTypeLabel(product.type)}`);
    msgLines.push(`Material: ${this.getMaterialLabel(product.material)}`);
    msgLines.push(`Preço: R$ ${this.formatPricePlain(product.price)}`);
    msgLines.push(`Disponível: ${product.quantityAvailable ?? 0}`);
    if (product.photoUrl) msgLines.push(product.photoUrl);

    const url = `https://wa.me/?text=${encodeURIComponent(msgLines.join('\n'))}`;
    window.open(url, '_blank');
  }

  /** Monta a URL completa para exibir a imagem */
  getFullImageUrl(relativePath: string): string {
    return this.productService.getFullImageUrl(relativePath);
  }

  private patchForm(product: Product): void {
    this.form.reset(
      {
        name: product.name,
        type: product.type,
        material: product.material,
        price: product.price,
        quantityAvailable: product.quantityAvailable ?? 0,
        photoUrl: product.photoUrl ?? '',
        notes: product.notes ?? '',
        active: product.active ?? true,
      },
      { emitEvent: false }
    );
  }
}
