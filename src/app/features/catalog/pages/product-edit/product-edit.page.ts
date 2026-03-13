import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { ProductImageUploadComponent } from '../../ui/product-image-upload/product-image-upload.component';

import { Product, ProductMaterial, ProductType, ProductImageUploadResponse } from '../../data-access/catalog.models';
import { ProductService } from '../../data-access/product.service';
import { PRODUCT_CATEGORIES } from '../../../../shared/constants/product-categories.constants';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, ProductImageUploadComponent],
  templateUrl: './product-edit.page.html',
})
export class ProductEditPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private toast = inject(ToastService);

  product = signal<Product | null>(null);
  loading = signal(true);
  notFound = signal(false);
  saving = signal(false);
  deactivating = signal(false);

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

  readonly typeOptions: Array<{ value: ProductType; label: string }> = [
    { value: 'ANEL', label: 'Anel' },
    { value: 'COLAR', label: 'Colar' },
    { value: 'PULSEIRA', label: 'Pulseira' },
    { value: 'BRINCO', label: 'Brinco' },
    { value: 'CORRENTE', label: 'Corrente' },
    { value: 'OUTRO', label: 'Outro' },
  ];

  readonly materialOptions: Array<{ value: ProductMaterial; label: string }> = [
    { value: 'OURO', label: 'Ouro' },
    { value: 'PRATA', label: 'Prata' },
    { value: 'ACO', label: 'Aço' },
    { value: 'PEROLA', label: 'Pérola' },
    { value: 'FOLHEADO', label: 'Folheado' },
    { value: 'OUTRO', label: 'Outro' },
  ];

  productCategories = PRODUCT_CATEGORIES;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.productService.getById(id).subscribe({
      next: (product) => {
        if (!product) {
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }

        this.product.set(product);
        this.form.patchValue({
          nome: product.name,
          descricao: product.description ?? '',
          tipo: product.type,
          material: product.material,
          preco: product.price,
          precoPromocional: 0, // TODO: adicionar campo promotionalPrice no backend
          quantidadeDisponivel: product.quantityAvailable ?? 0,
          urlFoto: product.photoUrl ?? '',
          observacoes: product.notes ?? '',
          active: product.active ?? true,
          // Campos da Vitrine - mapear de portugu\u00eas (Model) para portugu\u00eas (Form)
          categoriaVitrine: product.categoria ?? '',
          colecao: product.colecao ?? '',
          cor: product.cor ?? '',
          tamanho: product.tamanho ?? '',
          urlVideo: product.videoUrl ?? '',
          maisVendido: product.maisVendido ?? false,
          novidade: product.novidade ?? false,
          promocao: product.promocao ?? false,
        });

        this.loading.set(false);
      },
      error: (err) => {
        this.toast.showError(err?.message || 'Erro ao carregar produto');
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/app/catalogo']);
  }

  save(): void {
    const current = this.product();
    if (!current) return;

    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach((k) => this.form.get(k)?.markAsTouched());
      return;
    }

    this.saving.set(true);
    const v = this.form.value;

    // Mapear os campos do formulário para o payload da API
    // IMPORTANTE: A API usa nomes em INGLÊS
    const payload: any = {
      name: v.nome || '',
      type: v.tipo!,
      material: v.material!,
      price: Number(v.preco ?? 0),
      quantityAvailable: Number(v.quantidadeDisponivel ?? 0),
      active: v.active ?? true,
      // Campos da Vitrine (nomes em inglês conforme API)
      isBestSeller: !!v.maisVendido,
      isNewArrival: !!v.novidade,
      isOnSale: !!v.promocao
    };

    // Adicionar campos opcionais apenas se tiverem valor
    if (v.descricao?.trim()) payload.description = v.descricao.trim();
    
    // Categoria é obrigatória agora
    if (v.categoriaVitrine) payload.category = v.categoriaVitrine;
    
    if (v.colecao?.trim()) payload.collection = v.colecao.trim();
    if (v.cor?.trim()) payload.color = v.cor.trim();
    if (v.tamanho?.trim()) payload.size = v.tamanho.trim();
    if (v.precoPromocional && v.precoPromocional > 0) payload.promotionalPrice = Number(v.precoPromocional);
    
    // URLs - validar que começam com http:// ou https://
    const urlFoto = v.urlFoto?.trim();
    if (urlFoto && (urlFoto.startsWith('http://') || urlFoto.startsWith('https://'))) {
      payload.photoUrl = urlFoto;
    }
    
    const urlVideo = v.urlVideo?.trim();
    if (urlVideo && (urlVideo.startsWith('http://') || urlVideo.startsWith('https://'))) {
      payload.videoUrl = urlVideo;
    }
    
    if (v.observacoes?.trim()) payload.notes = v.observacoes.trim();

    console.log('[DEBUG] Payload enviado para API (deve ter campos em inglês):', payload);

    this.productService
      .update(current.id, payload)
      .subscribe({
        next: (updated) => {
          console.log('[DEBUG] Produto retornado pela API:', updated);
          console.log('[DEBUG] Campos da vitrine no model:', {
            maisVendido: updated.maisVendido,
            novidade: updated.novidade,
            promocao: updated.promocao
          });
          this.product.set(updated);
          this.saving.set(false);
          this.toast.showSuccess('Produto salvo');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.showError(err?.message || 'Erro ao salvar produto');
        },
      });
  }

  deactivate(): void {
    const current = this.product();
    if (!current) return;

    if (!confirm('Deseja desativar este produto?')) return;

    this.deactivating.set(true);
    this.productService.deactivate(current.id).subscribe({
      next: (updated) => {
        this.product.set(updated);
        this.form.patchValue({ active: false });
        this.deactivating.set(false);
        this.toast.showSuccess('Produto desativado');
      },
      error: (err) => {
        this.deactivating.set(false);
        this.toast.showError(err?.message || 'Erro ao desativar');
      },
    });
  }

  shareOnWhatsApp(): void {
    const product = this.product();
    if (!product) return;

    const typeLabel = this.getTypeLabel(product.type);
    const materialLabel = this.getMaterialLabel(product.material);
    const pricePlain = this.formatPricePlain(product.price);
    const qtd = product.quantityAvailable ?? 0;

    let msg = `✨ ${product.name}\nTipo: ${typeLabel}\nMaterial: ${materialLabel}\nPreço: R$ ${pricePlain}\nDisponível: ${qtd}`;
    if (product.photoUrl) {
      msg += `\n${product.photoUrl}`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  formatPricePlain(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }

  formatCurrency(price: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  }

  getTypeLabel(type: ProductType): string {
    const item = this.typeOptions.find((t) => t.value === type);
    return item?.label || type;
  }

  getMaterialLabel(material: ProductMaterial | string): string {
    const item = this.materialOptions.find((m) => m.value === material);
    return item?.label || material;
  }

  // =============================================
  // MÉTODOS DE IMAGEM
  // =============================================

  /** Monta a URL completa para exibir a imagem */
  getFullImageUrl(relativePath: string): string {
    return this.productService.getFullImageUrl(relativePath);
  }

  /** Callback quando uma imagem foi enviada com sucesso */
  onImageUploaded(response: ProductImageUploadResponse): void {
    // Atualiza o produto local com os dados retornados pela API
    this.product.set(response.product);
    this.toast.showSuccess('Imagem enviada com sucesso!');
  }

  /** Callback de erro no upload */
  onUploadError(message: string): void {
    this.toast.showError(message);
  }

  /** Remove uma imagem do produto */
  removeImage(imageId: string): void {
    const current = this.product();
    if (!current) return;

    if (!confirm('Deseja remover esta imagem?')) return;

    this.productService.deleteImage(current.id, imageId).subscribe({
      next: (updatedProduct) => {
        this.product.set(updatedProduct);
        this.toast.showSuccess('Imagem removida!');
      },
      error: (err) => {
        this.toast.showError(err.message || 'Erro ao remover imagem');
      }
    });
  }

  /** Define uma imagem como capa (order=0) */
  setAsCover(imageId: string): void {
    const current = this.product();
    if (!current) return;

    // Monta a nova ordem: imageId selecionada primeiro, depois as outras na ordem atual
    const reordered = [
      imageId,
      ...current.images
        .filter(img => img.id !== imageId)
        .sort((a, b) => a.order - b.order)
        .map(img => img.id)
    ];

    this.productService.reorderImages(current.id, reordered).subscribe({
      next: (updatedProduct) => {
        this.product.set(updatedProduct);
        this.toast.showSuccess('Imagem de capa atualizada!');
      },
      error: (err) => {
        this.toast.showError(err.message || 'Erro ao reordenar imagens');
      }
    });
  }
}
