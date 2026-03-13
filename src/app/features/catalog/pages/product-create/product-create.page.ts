import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductMaterial, ProductType } from '../../data-access/catalog.models';
import { ProductService } from '../../data-access/product.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { PRODUCT_CATEGORIES } from '../../../../shared/constants/product-categories.constants';

@Component({
  selector: 'app-product-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-create.page.html',
  styleUrl: './product-create.page.css'
})
export class ProductCreatePage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private productService = inject(ProductService);
  private toast = inject(ToastService);

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    descricao: [''],
    tipo: ['ANEL' as ProductType, Validators.required],
    material: ['OURO' as ProductMaterial, Validators.required],
    preco: [0, [Validators.required, Validators.min(0.01)]],
    precoPromocional: [0],
    quantidadeDisponivel: [0, [Validators.required, Validators.min(0)]],
    urlFoto: [''],
    observacoes: [''],
    active: [true],
    // Campos da Vitrine
    categoriaVitrine: ['', Validators.required],
    colecao: [''],
    cor: [''],
    tamanho: [''],
    urlVideo: [''],
    maisVendido: [false],
    novidade: [false],
    promocao: [false]
  });

  productTypes: ProductType[] = ['ANEL', 'COLAR', 'PULSEIRA', 'BRINCO', 'CORRENTE', 'OUTRO'];
  productMaterials: ProductMaterial[] = ['OURO', 'PRATA', 'ACO', 'PEROLA', 'FOLHEADO', 'OUTRO'];
  productCategories = PRODUCT_CATEGORIES;

  cancel(): void {
    this.router.navigate(['/app/catalogo']);
  }

  save(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    const formValue = this.form.value;

    // Mapear os campos do formulário para o payload da API
    // IMPORTANTE: A API usa nomes em INGLÊS
    const payload: any = {
      name: formValue.nome || '',
      type: formValue.tipo!,
      material: formValue.material!,
      price: Number(formValue.preco ?? 0),
      quantityAvailable: Number(formValue.quantidadeDisponivel ?? 0),
      active: formValue.active ?? true,
      // Campos da Vitrine (nomes em inglês conforme API)
      isBestSeller: !!formValue.maisVendido,
      isNewArrival: !!formValue.novidade,
      isOnSale: !!formValue.promocao
    };

    // Adicionar campos opcionais apenas se tiverem valor
    if (formValue.descricao?.trim()) payload.description = formValue.descricao.trim();
    
    // Categoria é obrigatória agora
    if (formValue.categoriaVitrine) payload.category = formValue.categoriaVitrine;
    
    if (formValue.colecao?.trim()) payload.collection = formValue.colecao.trim();
    if (formValue.cor?.trim()) payload.color = formValue.cor.trim();
    if (formValue.tamanho?.trim()) payload.size = formValue.tamanho.trim();
    if (formValue.precoPromocional && formValue.precoPromocional > 0) payload.promotionalPrice = Number(formValue.precoPromocional);
    
    // URLs - validar que começam com http:// ou https://
    const urlFoto = formValue.urlFoto?.trim();
    if (urlFoto && (urlFoto.startsWith('http://') || urlFoto.startsWith('https://'))) {
      payload.photoUrl = urlFoto;
    }
    
    const urlVideo = formValue.urlVideo?.trim();
    if (urlVideo && (urlVideo.startsWith('http://') || urlVideo.startsWith('https://'))) {
      payload.videoUrl = urlVideo;
    }
    
    if (formValue.observacoes?.trim()) payload.notes = formValue.observacoes.trim();

    this.productService
      .create(payload)
      .subscribe({
        next: (product) => {
          this.toast.showSuccess('Produto criado com sucesso');
          this.router.navigate(['/app/catalogo', product.id]);
        },
        error: (err) => {
          this.toast.showError(err?.message || 'Erro ao criar produto');
        },
      });
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

  getMaterialLabel(material: ProductMaterial): string {
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
}
